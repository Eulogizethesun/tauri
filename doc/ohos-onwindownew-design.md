# Tauri OHOS onWindowNew 新窗口请求拦截设计文档

> 创建时间: 2026-06-10
> 状态: ✅ 已实现 — Phase 2「Create→Float OS 窗口」（见 §十一 实现落地记录）
> 功能: 拦截 Web 组件的 `window.open()` / `target="_blank"` 等新窗口请求，允许开发者通过 `on_new_window` 回调决定 Allow / Deny / Create

---

## 一、问题分析

### 1.1 当前状态

| 层 | 文件 | 状态 |
|---|------|------|
| **tauri** | `crates/tauri/src/webview/mod.rs:262` | `NewWindowResponse` 只有 `Allow(PhantomData)` 和 `Deny`，缺少 `Create` |
| **tauri-runtime-wry** | `crates/tauri-runtime-wry/src/lib.rs:5113` | Bridge 存在，但 wry OHOS 层不消费 handler |
| **wry** | `src/ohos/mod.rs:154` | `let _ = new_window_req_handler;` — handler 被显式丢弃 |
| **openharmony-ability (Rust)** | `crates/ability/src/helper/webview.rs:39` | `WebViewInitData` 无 `on_window_new` 字段 |
| **openharmony-ability (ArkTS)** | `DefaultWebview.ets` | Web 组件未调用 `.multiWindowAccess()` / `.onWindowNew()` |

**结论**: 整条链路从 wry 到 ArkTS 完全断开。开发者设置的 `on_new_window` 闭包在 OHOS 上静默无效。

### 1.2 桌面平台参考实现

```
Desktop 完整链路:
  window.open() → WebView Engine → wry platform handler → new_window_req_handler closure
                                                          ↓
  Tauri handler returns:
    Allow   → Engine 自行创建窗口（WebView2/WebKit/NSWindow）
    Create  → Tauri 预创建窗口，将 webview ref 传回 Engine
    Deny    → Engine 取消新窗口
```

### 1.3 OHOS ArkWeb 的 onWindowNew 机制

| 接口 | API 版本 | 说明 |
|------|---------|------|
| `.multiWindowAccess(true)` | API 9 | **必须启用**，否则 `onWindowNew` 不触发 |
| `.allowWindowOpenMethod(true)` | API 9 | 允许 JS `window.open()` 触发新窗口 |
| `.onWindowNew(callback)` | API 9 | 新窗口请求事件，参数 `OnWindowNewEvent` |
| `ControllerHandler.setWebController(ctrl)` | API 9 | **必须调用**，否则渲染进程阻塞 |

**OnWindowNewEvent 结构** (API 12+):

| 字段 | 类型 | 说明 |
|------|------|------|
| `isAlert` | boolean | true = 请求创建对话框，false = 新标签页 |
| `isUserTrigger` | boolean | true = 用户触发 |
| `targetUrl` | string | 目标 URL |
| `handler` | ControllerHandler | 用于设置新窗口的 WebviewController |

**关键约束**: `event.handler.setWebController()` 必须被调用。传入有效 `WebviewController` = 允许新窗口，传入 `null` = 阻止新窗口。**不调用会导致渲染进程永久阻塞。**

---

## 二、架构设计

### 2.1 完整数据流

```
前端: window.open(url) / <a target="_blank">
    │
    ▼
[ArkTS] Web component .onWindowNew(event) fires
    │   event = { targetUrl, isAlert, isUserTrigger, handler }
    │
    ▼
[ArkTS] 调用 NAPI 回调 onWindowNew(targetUrl, isAlert, isUserTrigger) → boolean
    │   同步调用，handler 闭包在 Chrome_IOThread 执行
    │
    ▼
[openharmony-ability Rust] NAPI Function closure
    │   解析参数 → 调用 on_window_new handler 闭包
    │   handler 返回 bool (true=allow, false=deny)
    │
    ▼
[ArkTS] 根据返回值:
    │   false → event.handler.setWebController(null)     // 阻止
    │   true  → 创建新 WebviewController
    │           创建 CustomDialog 嵌入 Web 组件
    │           event.handler.setWebController(newCtrl)   // 允许
    │
    ▼
[wry OHOS] new_window_req_handler 通过 WebViewBuilder.on_window_new() 桥接
    │   (替代原来的 `let _ = new_window_req_handler`)
    │
    ▼
[tauri-runtime-wry] 转换 tauri_runtime types ↔ wry types
    │
    ▼
[Tauri 用户 API] .on_new_window(|url, features| { ... })
    返回 NewWindowResponse::Allow / Deny
```

### 2.2 NAPI 回调接口设计

```rust
// openharmony-ability: WebViewInitData 新增字段
pub struct OnWindowNewResult {
    pub allow: bool,
}

// WebViewInitData 新增:
pub on_window_new: Option<Function<'a, (String, bool, bool), OnWindowNewResult>>,
// ArkTS 侧名称: onWindowNew (camelCase 自动转换)
// 参数: (targetUrl: string, isAlert: boolean, isUserTrigger: boolean)
// 返回: OnWindowNewResult { allow: boolean }
```

**设计理由**:
- 回调返回 bool 而非 WebviewController 对象 — ControllerHandler 是 ArkTS 端对象，无法跨 NAPI 传回
- `OnWindowNewResult` struct 包装 bool — 遵循 napi-ohos `callee_handled::<false>()` 规则，避免裸 bool 序列化问题
- 同步调用模式 — 与 `on_navigation_request` 一致，handler 闭包立即返回结果

### 2.3 wry OHOS 桥接设计

```rust
// wry/src/ohos/mod.rs — 替代 `let _ = new_window_req_handler`
if let Some(new_window_req_handler) = new_window_req_handler {
    webview_builder = webview_builder.on_window_new(
        move |target_url: String, is_alert: bool, is_user_trigger: bool| -> bool {
            let Ok(url) = target_url.parse() else {
                return false; // Deny on parse failure
            };
            let features = wry::NewWindowFeatures {
                size: None,
                position: None,
                opener: wry::NewWindowOpener { /* ... */ },
            };
            match new_window_req_handler(url, features) {
                wry::NewWindowResponse::Allow => true,
                wry::NewWindowResponse::Create { .. } => true,  // Phase 1: 降级为 Allow
                wry::NewWindowResponse::Deny => false,
            }
        }
    );
}
```

### 2.4 ArkTS 端 onWindowNew 处理设计

```typescript
// DefaultWebview.ets — WebBuilder 新增
Web({ src: '', controller: nodeData.controller })
    // ... 现有配置 ...
    .multiWindowAccess(true)           // 启用多窗口
    .allowWindowOpenMethod(true)       // 允许 JS window.open()
    .onWindowNew((event: OnWindowNewEvent) => {
        if (nodeData.onWindowNew) {
            // 调用 Rust 回调，获取 allow/deny 决定
            const result = nodeData.onWindowNew(
                event.targetUrl,
                event.isAlert,
                event.isUserTrigger
            );
            if (result.allow) {
                // 创建新窗口（CustomDialog + Web 组件）
                const newCtrl = new webview.WebviewController();
                NewWindowDialog.open(event.targetUrl, newCtrl);
                event.handler.setWebController(newCtrl);
            } else {
                // 阻止新窗口
                event.handler.setWebController(null);
            }
        } else {
            // 未注册 handler → 默认阻止（安全默认值）
            event.handler.setWebController(null);
        }
    })
```

### 2.5 Tauri 层 NewWindowResponse 扩展

```rust
// Phase 1: 保持现有 Allow/Deny，与 mobile 一致
#[cfg(target_env = "ohos")]
pub enum NewWindowResponse<R: Runtime> {
    /// Allow — 新窗口在 ArkTS 端以 dialog 形式打开
    Allow(std::marker::PhantomData<R>),
    /// Deny — 阻止新窗口
    Deny,
    // Phase 2: 添加 Create
    // Create { window: crate::WebviewWindow<R> },
}
```

**Phase 1 不添加 `Create` 的原因**:
- OHOS 的 OS 级窗口创建（`@ohos.window.createWindow`）尚在 [ohos-os-level-window-design.md](ohos-os-level-window-design.md) 设计阶段
- `Create` 需要 Tauri 预创建窗口并获取对应的 WebviewController，依赖 OS 级窗口基础设施
- 当前 mobile 平台上 `Create` 也是降级为 `Allow`（见 `mod.rs:722-724`）

---

## 三、Phase 拆分

**判断依据**: 涉及 4 个代码层（openharmony-ability / wry / tauri-runtime-wry / tauri），预估影响 10+ 个文件。

| Phase | 名称 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|--------|---------|---------|
| 1 | openharmony-ability NAPI + ArkTS | openharmony-ability | 6 | Rust 单元测试 + ArkTS 编译 |
| 2 | wry + tauri-runtime-wry + tauri 桥接 | wry + tauri-runtime-wry + tauri | 5 | cargo check + 设备端测试 |
| 3 | 前端 API 测试 | examples/api | 3 | 设备端自动测试 |

### Phase 1: openharmony-ability NAPI + ArkTS

**目标**: 在 openharmony-ability 层实现 `onWindowNew` 事件的完整桥接

**文件清单**:

| 文件 | 修改内容 |
|------|---------|
| `crates/ability/src/helper/webview.rs` | 新增 `OnWindowNewResult` struct + `on_window_new` 字段 |
| `crates/ability/src/webview/mod.rs` | WebViewBuilder 新增 `on_window_new` 字段和 builder 方法 + build() 中传递 |
| `native_ability/src/main/ets/ability/type.ets` | `WebViewInitData` 接口新增 `onWindowNew` 字段 |
| `native_ability/src/main/ets/webview/DefaultWebview.ets` | WebBuilder/EmbeddedWebBuilder 添加 `.multiWindowAccess(true)` + `.onWindowNew()` |
| `native_ability/src/main/ets/webview/NewWindowDialog.ets` | **新文件** — 新窗口 dialog 组件 |
| `package/...` | 同步 package 目录的对应文件 |

**验证**: `ohrs build --arch arm64` 编译通过 + HAR 包重建

### Phase 2: wry + tauri-runtime-wry + tauri 桥接

**目标**: 打通 wry → tauri-runtime-wry → tauri 的 handler 链路

**文件清单**:

| 文件 | 修改内容 |
|------|---------|
| `wry/src/ohos/mod.rs` | 移除 `let _ = new_window_req_handler`，桥接到 `WebViewBuilder.on_window_new()` |
| `wry/src/lib.rs` | (可选) 为 OHOS 新增 `NewWindowOpener` 的空实现 |
| `tauri/crates/tauri-runtime-wry/src/lib.rs` | 确认 OHOS 路径的 `NewWindowOpener` 字段处理 |
| `tauri/crates/tauri/src/webview/mod.rs` | OHOS `NewWindowResponse` 文档更新 + `into_pending_webview` 确认 |
| `examples/api/src-tauri/src/lib.rs` | 示例代码更新 |

**验证**: `cargo check --target aarch64-unknown-linux-ohos` + 设备端 `window.open()` 拦截测试

### Phase 3: 前端 API 测试

**目标**: 在 examples/api 中添加 onWindowNew 的前端测试用例

**测试用例设计**:

| 分类 | 测试 | 预期结果 |
|------|------|---------|
| `auto` | `window.open()` 被 Deny 时不打开新窗口 | 页面不跳转，无新 dialog |
| `auto` | `<a target="_blank">` 被 Deny 时不打开新窗口 | 同上 |
| `side-effect` | `window.open()` 被 Allow 时弹出 dialog | dialog 出现，含新 Web 组件 |
| `side-effect` | `targetUrl` 参数正确传递 | 断言回调收到的 URL 匹配 |
| `manual` | Allow 后 dialog 中的 Web 组件可交互 | 手动确认页面加载和滚动 |
| `manual` | dialog 关闭后原页面正常 | 手动确认原 webview 不受影响 |

**验证**: 设备端测试脚本通过

---

## 四、详细实现

### 4.1 openharmony-ability: Rust NAPI 层

#### 4.1.1 WebViewInitData 新增字段

**文件**: `crates/ability/src/helper/webview.rs`

```rust
/// Result returned from the on_window_new callback.
#[napi(object)]
#[derive(Default)]
pub struct OnWindowNewResult {
    /// Whether to allow the new window.
    pub allow: bool,
}

#[napi(object)]
#[derive(Default)]
pub struct WebViewInitData<'a> {
    // ... 现有字段保持不变 ...

    /// Callback when a new window is requested.
    /// Parameters: (targetUrl, isAlert, isUserTrigger)
    /// Returns: OnWindowNewResult { allow }
    pub on_window_new: Option<Function<'a, (String, bool, bool), OnWindowNewResult>>,
}
```

**NAPI 自动转换**: `on_window_new` (Rust snake_case) → `onWindowNew` (ArkTS camelCase)

#### 4.1.2 WebViewBuilder 新增方法

**文件**: `crates/ability/src/webview/mod.rs`

```rust
pub struct WebViewBuilder {
    // ... 现有字段 ...
    on_window_new: Option<Box<dyn Fn(String, bool, bool) -> bool>>,
}

impl WebViewBuilder {
    /// Register a callback for new window requests.
    ///
    /// The callback receives:
    /// - `target_url`: The URL requested to open
    /// - `is_alert`: Whether the request is for a dialog (true) or new tab (false)
    /// - `is_user_trigger`: Whether the request was triggered by user action
    ///
    /// Return `true` to allow, `false` to deny.
    pub fn on_window_new<F>(mut self, handler: F) -> Self
    where
        F: Fn(String, bool, bool) -> bool + 'static,
    {
        self.on_window_new = Some(Box::new(handler));
        self
    }
}
```

#### 4.1.3 build() 方法中传递回调

```rust
// 在 build() 方法中，构建 NAPI Function:
let on_window_new = self.on_window_new.and_then(|handler| {
    env.create_function_from_closure("on_window_new", move |ctx| {
        let target_url = ctx.try_get::<String>(0)?;
        let is_alert = ctx.try_get::<bool>(1)?;
        let is_user_trigger = ctx.try_get::<bool>(2)?;

        let url = match target_url {
            Either::A(s) => s,
            Either::B(_) => String::new(),
        };
        let alert = match is_alert {
            Either::A(b) => b,
            Either::B(_) => false,
        };
        let user_trigger = match is_user_trigger {
            Either::A(b) => b,
            Either::B(_) => false,
        };

        let allow = handler(url, alert, user_trigger);
        Ok(OnWindowNewResult { allow })
    })
    .ok()
});

// 传入 WebViewInitData:
let webview = create_webview_func.call(WebViewInitData {
    // ... 现有字段 ...
    on_window_new,
})?;
```

### 4.2 openharmony-ability: ArkTS 层

#### 4.2.1 type.ets — WebViewInitData 接口

**文件**: `native_ability/src/main/ets/ability/type.ets`

```typescript
interface OnWindowNewResult {
    allow?: boolean;
}

interface WebViewInitData {
    // ... 现有字段 ...

    /**
     * Callback when a new window is requested.
     * @param targetUrl - The URL to open
     * @param isAlert - Whether it's a dialog request
     * @param isUserTrigger - Whether user triggered the request
     * @returns OnWindowNewResult with allow flag
     */
    onWindowNew?: (targetUrl: string, isAlert: boolean, isUserTrigger: boolean) => OnWindowNewResult;
}
```

#### 4.2.2 DefaultWebview.ets — WebBuilder 修改

**文件**: `native_ability/src/main/ets/webview/DefaultWebview.ets`

在 `@Builder WebBuilder()` 的 `Web({...})` 链中添加:

```typescript
@Builder
WebBuilder(nodeData: WebviewNodeData) {
    Web({ src: '', controller: nodeData.controller })
        .javaScriptAccess(nodeData.javascriptEnable ?? true)
        // ... 现有配置 ...
        .multiWindowAccess(true)           // ← 新增: 启用多窗口拦截
        .allowWindowOpenMethod(true)       // ← 新增: 允许 JS window.open()
        .onWindowNew((event: OnWindowNewEvent) => {
            if (nodeData.onWindowNew) {
                const result = nodeData.onWindowNew(
                    event.targetUrl,
                    event.isAlert,
                    event.isUserTrigger
                );
                if (result?.allow) {
                    // Allow: 创建新 WebviewController + dialog
                    const newCtrl = new webview.WebviewController();
                    NewWindowDialogManager.open(event.targetUrl, newCtrl, () => {
                        event.handler.setWebController(newCtrl);
                    });
                } else {
                    // Deny: 阻止新窗口
                    event.handler.setWebController(null);
                }
            } else {
                // 无 handler: 默认阻止
                event.handler.setWebController(null);
            }
        })
        // ... 现有事件 ...
}
```

**关键实现注意**:
1. `multiWindowAccess(true)` 是 `onWindowNew` 触发的前提条件
2. `setWebController` 必须在 `onWindowNew` 回调中同步调用，或通过 `NewWindowDialogManager` 确保在 dialog 创建后立即调用
3. 默认行为（无 handler 时）是 Deny — 安全默认值

#### 4.2.3 NewWindowDialog.ets — 新窗口 dialog 组件

**新文件**: `native_ability/src/main/ets/webview/NewWindowDialog.ets`

```typescript
import { webview } from '@kit.ArkWeb';

/**
 * Manages new window dialogs created via onWindowNew.
 * Uses CustomDialogController to display a new Web component
 * with the controller provided to setWebController.
 */

interface NewWindowDialogParams {
    url: string;
    controller: webview.WebviewController;
    onExit: () => void;
}

@CustomDialog
export struct NewWindowDialog {
    private dialogController?: CustomDialogController;
    @Prop url: string = '';
    @Prop controller: webview.WebviewController = new webview.WebviewController();
    onExit?: () => void;

    build() {
        Column() {
            // 标题栏
            Row() {
                Text(this.url).fontSize(14).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
                Blank()
                Button('×').fontSize(20).onClick(() => {
                    this.dialogController?.close();
                })
            }
            .width('100%')
            .padding(8)

            // WebView 内容
            Web({ src: this.url, controller: this.controller })
                .javaScriptAccess(true)
                .multiWindowAccess(false)    // 子窗口不再允许新窗口
                .width('100%')
                .layoutWeight(1)
                .onWindowExit(() => {
                    this.dialogController?.close();
                    this.onExit?.();
                })
        }
        .width('90%')
        .height('80%')
    }
}

/**
 * Singleton manager for new window dialogs.
 */
export class NewWindowDialogManager {
    private static dialogController: CustomDialogController | null = null;

    static open(url: string, controller: webview.WebviewController, onReady: () => void): void {
        // 关闭已有 dialog
        if (NewWindowDialogManager.dialogController) {
            NewWindowDialogManager.dialogController.close();
        }

        NewWindowDialogManager.dialogController = new CustomDialogController({
            builder: NewWindowDialog({
                url: url,
                controller: controller,
                onExit: () => {
                    NewWindowDialogManager.dialogController = null;
                }
            }),
            isModal: false,
            autoCancel: true,
        });

        NewWindowDialogManager.dialogController.open();

        // dialog 打开后通知调用者设置 controller
        // 注意: CustomDialog 的 open() 是同步的，controller 在 dialog 内的
        // Web 组件 build 后即可使用
        onReady();
    }
}
```

### 4.3 wry OHOS 层

#### 4.3.1 桥接 new_window_req_handler

**文件**: `wry/src/ohos/mod.rs`

**替换**:
```rust
// Suppress unused new_window_req_handler (openharmony-ability has no corresponding interface)
let _ = new_window_req_handler;
```

**为**:
```rust
// Wire new window request handler
if let Some(new_window_req_handler) = new_window_req_handler {
    webview_builder = webview_builder.on_window_new(
        move |target_url: String, is_alert: bool, is_user_trigger: bool| -> bool {
            // Parse URL
            let url = match target_url.parse() {
                Ok(u) => u,
                Err(_) => return false, // Deny on invalid URL
            };

            // Construct NewWindowFeatures (OHOS doesn't provide size/position info)
            let features = crate::NewWindowFeatures {
                size: None,
                position: None,
                opener: crate::NewWindowOpener {
                    // OHOS doesn't expose opener webview reference
                },
            };

            match new_window_req_handler(url, features) {
                crate::NewWindowResponse::Allow => true,
                crate::NewWindowResponse::Create { .. } => true,  // Degrade to Allow on OHOS
                crate::NewWindowResponse::Deny => false,
            }
        },
    );
}
```

**注意**: `NewWindowOpener` 在 OHOS 上可能是空 struct，因为 ArkTS `OnWindowNewEvent` 不暴露 opener webview 引用。需要检查 wry 中 `NewWindowOpener` 的定义是否为 platform-specific。

#### 4.3.2 NewWindowOpener 适配

如果 `wry::NewWindowOpener` 包含平台特定字段（如 `webview`, `environment`），OHOS 上需要:

```rust
// 可能需要在 wry/src/lib.rs 中为 OHOS 定义空的 NewWindowOpener
#[cfg(target_env = "ohos")]
pub struct NewWindowOpener {
    // OHOS 不暴露 opener 信息
}
```

### 4.4 tauri-runtime-wry 层

#### 4.4.1 确认 bridge 兼容性

**文件**: `tauri/crates/tauri-runtime-wry/src/lib.rs:5113-5170`

现有代码已经处理了 OHOS 的情况（通过 `#[cfg(target_env = "ohos")]` 排除 opener 字段），但需要确认:

```rust
// 检查 NewWindowOpener 在 OHOS 上的字段处理
tauri_runtime::webview::NewWindowOpener {
    #[cfg(all(desktop, not(target_env = "ohos")))]
    webview: features.opener.webview,
    #[cfg(windows)]
    environment: features.opener.environment,
    #[cfg(target_os = "macos")]
    target_configuration: features.opener.target_configuration,
},
```

**需要**: 确保 `NewWindowFeatures::new()` 在 OHOS 上能正确构造（size/position 均为 None）。

### 4.5 tauri 层

#### 4.5.1 NewWindowResponse 文档更新

**文件**: `tauri/crates/tauri/src/webview/mod.rs`

```rust
/// Response for the new window request handler on OHOS.
#[cfg(target_env = "ohos")]
pub enum NewWindowResponse<R: Runtime> {
    /// Allow the new window to open.
    ///
    /// On OHOS, this creates a new Web component in a dialog overlay.
    /// The new window is NOT a Tauri-managed window — it cannot be
    /// controlled via Tauri's window API.
    ///
    /// **Platform note**: For full window management, wait for the
    /// `Create` variant support (requires OS-level window creation).
    Allow(std::marker::PhantomData<R>),
    /// Deny the new window from opening.
    /// The render process will be notified and the request cancelled.
    Deny,
}
```

#### 4.5.2 into_pending_webview 确认

**文件**: `tauri/crates/tauri/src/webview/mod.rs:715-740`

现有代码中 OHOS 的 `NewWindowResponse::Allow(_)` 已正确转换为 `tauri_runtime::NewWindowResponse::Allow`。无需修改。

### 4.6 examples/api 示例更新

**文件**: `examples/api/src-tauri/src/lib.rs`

```rust
// 更新 on_new_window 示例以展示 Deny 功能
.on_new_window(|url, _features| {
    #[cfg(target_env = "ohos")]
    {
        // OHOS: 拦截所有新窗口请求
        println!("New window request: {}", url);
        tauri::webview::NewWindowResponse::Deny
    }
    #[cfg(not(target_env = "ohos"))]
    {
        // Desktop: Allow with default behavior
        tauri::webview::NewWindowResponse::Allow
    }
})
```

---

## 五、约束遵守审计

### 5.1 cfg 隔离

| 检查项 | 结论 |
|--------|------|
| OHOS 代码通过 `cfg(target_env = "ohos")` 隔离 | ✅ wry OHOS 代码在 `ohos/mod.rs` 中，天然隔离 |
| 不影响 Windows/macOS/Linux | ✅ openharmony-ability 修改只影响 OHOS；wry 修改在 `ohos/` 目录 |
| Linux 依赖排除 | ✅ 不涉及新依赖 |

### 5.2 线程模型

| 检查项 | 结论 |
|--------|------|
| 无 `run_on_main_thread + rx.recv()` 阻塞 | ✅ `onWindowNew` 回调在 ArkTS 主线程同步调用 NAPI，handler 闭包直接执行 |
| Mutex 不跨阻塞 I/O 持有 | ✅ handler 闭包不使用全局 Mutex |
| TSFN 不涉及 | ✅ 使用同步 NAPI Function，不使用 TSFN |

### 5.3 NAPI/TSFN

| 检查项 | 结论 |
|--------|------|
| 函数名 snake_case → camelCase | ✅ `on_window_new` → `onWindowNew` |
| `callee_handled::<false>()` | ✅ `OnWindowNewResult` struct 包装，无 null 插入问题 |
| 不使用全局 Mutex 中转 | ✅ 每个闭包独立 Box，与 `on_navigation_request` 模式一致 |

### 5.4 ArkTS 框架

| 检查项 | 结论 |
|--------|------|
| `@Builder` 上下文 | ✅ `.onWindowNew()` 在 `WebBuilder` @Builder 内 pre-build 注册 |
| `onLoadIntercept` 语义反转 | ✅ 不涉及（onWindowNew 语义一致: true=allow） |
| `setWebController` 必须调用 | ✅ Deny 时传 null，Allow 时传新 controller |

### 5.5 API 版本

| 检查项 | 结论 |
|--------|------|
| `onWindowNew` API 版本 | API 9+ ✅ (tauri api demo 默认 API 12) |
| `multiWindowAccess` API 版本 | API 9+ ✅ |
| `ControllerHandler.setWebController` | API 9+ ✅ |
| `OnWindowNewEvent` (with targetUrl) | API 12+ ⚠️ 需确认 |

**⚠️ 版本风险**: `OnWindowNewEvent` 的 `targetUrl`/`isAlert`/`isUserTrigger` 字段标注为 API 12+。如果设备运行 API < 12，这些字段可能不存在。**缓解方案**: 在 ArkTS 侧做 fallback — `event.targetUrl ?? ''`。

### 5.6 新窗口 dialog 的 @CustomDialog

| 检查项 | 结论 |
|--------|------|
| `@CustomDialog` 在 `@Builder` 上下文使用 | ⚠️ `CustomDialogController` 需要在 `@Component` 或有 `this` 上下文的 scope 中创建 |
| `NewWindowDialogManager` 是静态类 | ✅ 但 `CustomDialogController` 构造可能需要组件上下文 |

**⚠️ @CustomDialog 风险**: `CustomDialogController` 的 `open()` 方法可能需要 `@Component` 上下文。如果 `@Builder WebBuilder` 是模块级 Builder（无 `this`），则无法直接创建 dialog。

**备选方案**: 使用 `promptAction.openCustomDialog()` (API 12+)，它不依赖 `@Component` 上下文:

```typescript
import { promptAction } from '@kit.ArkUI';

// 替代 CustomDialogController
promptAction.openCustomDialog({
    builder: NewWindowDialogBuilder({ url, controller }),
    isModal: false,
});
```

**需要在实现阶段验证哪种方案可行。**

---

## 六、文件修改清单

| 层 | 文件 | 修改类型 | 说明 |
|---|------|---------|------|
| openharmony-ability | `crates/ability/src/helper/webview.rs` | 修改 | +`OnWindowNewResult` struct +`on_window_new` 字段 |
| openharmony-ability | `crates/ability/src/webview/mod.rs` | 修改 | +`on_window_new` 字段/builder 方法/build() 传递 |
| openharmony-ability | `native_ability/src/main/ets/ability/type.ets` | 修改 | +`OnWindowNewResult` 接口 +`onWindowNew` 字段 |
| openharmony-ability | `native_ability/src/main/ets/webview/DefaultWebview.ets` | 修改 | +`.multiWindowAccess()` +`.onWindowNew()` |
| openharmony-ability | `native_ability/src/main/ets/webview/NewWindowDialog.ets` | **新建** | 新窗口 dialog 组件 + Manager |
| openharmony-ability | `package/...` (对应文件) | 同步 | 同步 native_ability 的修改 |
| wry | `src/ohos/mod.rs` | 修改 | 替换 `let _ =` 为 `on_window_new` 桥接 |
| wry | `src/lib.rs` | (可能) 修改 | OHOS `NewWindowOpener` 空定义 |
| tauri-runtime-wry | `src/lib.rs` | 检查 | 确认 OHOS 路径兼容 |
| tauri | `crates/tauri/src/webview/mod.rs` | 修改 | 文档更新 |
| examples/api | `src-tauri/src/lib.rs` | 修改 | 示例代码更新 |

**预估影响文件**: 11 个

---

## 七、测试计划

### 7.1 Rust 单元测试 (设备端)

```rust
#[cfg(all(test, target_env = "ohos"))]
mod tests {
    use super::*;

    #[test]
    fn test_on_window_new_result_default() {
        let result = OnWindowNewResult::default();
        assert!(!result.allow); // Default deny
    }
}
```

### 7.2 前端 API 测试

#### auto 测试

```typescript
// test: window.open denied
async function testWindowOpenDenied(): Promise<TestResult> {
    // 设置 handler 返回 Deny
    const result = window.open('https://example.com', '_blank');
    // result 应为 null (被阻止)
    return { pass: result === null };
}

// test: target="_blank" link denied
async function testTargetBlankDenied(): Promise<TestResult> {
    const link = document.createElement('a');
    link.href = 'https://example.com';
    link.target = '_blank';
    link.click();
    // 验证无新窗口/无导航
    return { pass: true }; // 无异常即为 pass
}
```

#### side-effect 测试

```typescript
// test: window.open allowed creates dialog
async function testWindowOpenAllowed(): Promise<TestResult> {
    // 设置 handler 返回 Allow
    const result = window.open('https://example.com', '_blank');
    // 验证 dialog 出现
    await new Promise(resolve => setTimeout(resolve, 1000));
    // 手动关闭 dialog
    return { pass: result !== null };
}
```

#### manual 测试

```typescript
// test: dialog webview is interactive
// 手动验证: dialog 中的网页可以滚动和点击

// test: closing dialog doesn't affect original page
// 手动验证: 关闭 dialog 后原页面功能正常
```

### 7.3 设备端验证步骤

1. 构建 HAR 包: `ohrs build --arch arm64 && pack.sh`
2. 构建 HAP: `bash .claude/skills/ohos-build/scripts/build-ohos.sh`
3. 安装到设备: `hdc install -r <hap-file>`
4. 运行测试: `bash .claude/skills/ohos-build/scripts/run-tests.sh`
5. 手动验证:
   - 打开 example app → 导航到 Window 测试页
   - 点击 "Open new window (Deny)" → 确认无新窗口
   - 点击 "Open new window (Allow)" → 确认 dialog 弹出，包含 Web 组件
   - 关闭 dialog → 确认原页面正常

---

## 八、已知限制与未来工作

### 8.1 Phase 1 限制

| 限制 | 说明 | 未来缓解 |
|------|------|---------|
| 无 `Create` 变体 | OHOS 上不支持 Tauri 预创建窗口 | Phase 2: OS 级窗口创建就绪后添加 |
| Allow 创建的窗口非 Tauri 管理 | dialog 中的 Web 组件不受 Tauri window API 控制 | Phase 2: 使用 Tauri WebviewWindowBuilder |
| 单个 dialog | 同时只允许一个新窗口 dialog | 使用 Stack/Tab 管理多个 dialog |
| `OnWindowNewEvent` 字段可能 API 12+ | `targetUrl` 等字段需要 API 12 | 运行时 fallback 为空字符串 |
| `@CustomDialog` 上下文限制 | 可能需要 `@Component` 上下文 | 备选: `promptAction.openCustomDialog()` |

### 8.2 未来 Phase

**Phase 2: Create 变体 + OS 级窗口**
- 依赖 `ohos-os-level-window-design.md` 中的 `WindowManager` 和 `create_os_window` NAPI
- 在 `on_new_window` handler 中创建 Tauri `WebviewWindow`
- 将新窗口的 WebviewController 传回 ArkTS `setWebController`
- 新窗口完全由 Tauri 管理（可关闭、调整大小、获取 URL 等）

**Phase 3: onWindowNewExt 增强**
- 使用 `onWindowNewExt` (API 12+) 获取更丰富的窗口特征（`NavigationPolicy`, `WindowFeatures`）
- 将 `WindowFeatures` 映射到 Tauri 的 `NewWindowFeatures`（size, position）

---

## 九、与桌面平台行为对比

| 行为 | Windows/macOS/Linux | OHOS (Phase 1) |
|------|-------------------|----------------|
| `Allow` | Engine 创建默认窗口 | ArkTS 创建 dialog + Web |
| `Create` | Tauri 预创建窗口，传回 Engine | **不支持** (降级为 Allow) |
| `Deny` | Engine 取消请求 | `setWebController(null)` |
| `NewWindowFeatures.size` | 有 (来自 Engine) | None (OHOS 不提供) |
| `NewWindowFeatures.position` | 有 (来自 Engine) | None (OHOS 不提供) |
| `NewWindowOpener.webview` | 有 (opener 引用) | 无 (OHOS 不暴露) |

---

## 十、风险与缓解

| 风险 | 影响 | 概率 | 缓解 |
|------|------|------|------|
| `@CustomDialog` 在 @Builder 中不可用 | dialog 创建失败 | 中 | 备选 `promptAction.openCustomDialog()` |
| `setWebController` 异步调用导致阻塞 | 渲染进程卡死 | 低 | 确保 Deny 同步调用 `setWebController(null)` |
| `OnWindowNewEvent.targetUrl` 在 API < 12 为空 | 无法获取目标 URL | 低 | ArkTS fallback `event.targetUrl ?? ''` |
| wry `NewWindowOpener` 在 OHOS 上编译失败 | 编译错误 | 中 | 为 OHOS 添加空 struct 定义 |
| HAR 包重建后签名变更 | 安装失败 | 高 | 先卸载旧版再安装 |

---

## 十一、实现落地记录 (2026-08-14, #85)

> 本节记录**实际实现**，并标注其与 §二/§四 Phase 1 设计的偏差。Phase 1 的
> `@CustomDialog`/`NewWindowDialogManager` dialog 方案**未采用**——调研子agent
> 指出 `@CustomDialog` 在 `@Builder` 上下文不 sound（§5.6 风险成立），改为直接
> 走 §8.2 所述「Phase 2: Create 变体 + OS 级窗口」目标路径，一步到位。

### 11.1 核心决策：Allow→Create 折叠

`on_new_window` 闭包的 OHOS 分支把 **Allow 折叠为 Create**：除非显式 Deny，
否则每次 `window.open()` 都构建一个真实的 `WebviewWindow`（`OHOSWindowKind::Float`
OS 子窗口）并加载 target URL——而非 §四所述的在主 webview 上叠 dialog。

- **文件**: `examples/api/src-tauri/src/lib.rs`（`on_new_window` OHOS cfg 分支）
- **行为**: `WebviewWindowBuilder::new(&app, "new-{n}", WebviewUrl::External(url))`
  `.inner_size(900,700).position(120,90).ohos_window_kind(Float).build()`
  → 成功返回 `NewWindowResponse::Create { window }`，失败回退 `Allow`。
- **`set_create_new_window` 标志已移除**：Create 现在是默认行为，不再需要前置开关。

### 11.2 非阻塞性（关键前提）

ArkWeb `onWindowNew` 是主线程同步回调。在该回调里同步触发 `window.open`→`Create`
→`build()` 安全，因为 **`WebviewWindowBuilder::build()` 在 OHOS 主线程非阻塞**
（全链路确认，详见 memory `ohos-webviewwindow-build-nonblocking`）：

`build()` → `with_webview` → `build_internal` → `runtime.create_window`（无
`recv()`）→ 主线程 `send_user_message` inline 跑 `handle_user_message`（无
channel）→ `Window::new` → `create_os_window` → 同步 NAPI `func.call(config)` 调
ArkTS `async createOSWindow`，**Rust 丢弃返回的 Promise**（NAPI 只跑到第一个
await）→ 真正 `createSubWindow`/`loadContentByName`/`resize`/`show` 全异步在
`onWindowNew` 返回后跑。webview create 是 `runtime.spawn(async { create().await })`
fire-and-forget。**全 create 路径无 `block_on`、无 `recv()`、无 await-result NAPI。**

> 对比：`ohos_window_spawn`（lib.rs:182-197）的 window **operations**
> （focus/resize/destroy/...）才用 `futures_executor::block_on`——那是
> tray-icon/muda 死锁路径，与 create 路径无关。

### 11.3 wry 侧：`Create => false`（ArkWeb 取消自己的 popup）

- **文件**: `wry/src/ohos/mod.rs` `new_window_req_handler` 闭包
- **修正**: 原 `Create { .. } => true` 改为 `=> false`（仅非 android/ios）。
- **理由**: Tauri 已经自己建了 Float OS 窗口并会加载 target URL，返回 `true` 会让
  ArkWeb **也**开一个 popup（重复 + 该 popup controller 无同步 Web host，有主线程
  阻塞风险）。返回 `false` 让 ArkWeb 走非阻塞 Deny 路径
  （`setWebController(null)`）取消自己的 popup，真正的 popup 是 Rust 建的 Float 窗口。
- Allow/Deny 维持 `true`/`false` 不变。

### 11.4 tao 侧：Float 窗口尺寸/位置生效

- **文件**: `tao/src/platform_impl/ohos/mod.rs` `Window::new` Float 分支（原 line ~1001）
- **修正**: 原代码用 `..WindowCreateParams::default()`（width=800/height=600/x=100/
  y=100），**忽略** `window_attrs.inner_size`/`position`，导致 builder 的
  `.inner_size()/.position()` 对 Float 窗口无效。改为读
  `window_attrs.inner_size`/`position`，经 `el.app.scale()` 转 physical px，填入
  `WindowCreateParams.width/height/x/y`。
- **下游**: `create_os_window` → ArkTS `createSubWindow` → `await win.resize(w,h)` +
  `await win.moveWindowTo(x,y)` 应用尺寸；`FloatPage.aboutToAppear` 用
  `getGlobalRect()` 读回（不覆盖为全屏）。
- **铁律遵守**: tao 经 openharmony-ability 的 `create_os_window` 桥接（Rule #1），
  改动仅在 OHOS Float 分支（Rule #2 cfg 隔离）。

### 11.5 URL 传播

`WebviewUrl::External(url)` → wry `pending.url`(manager/webview.rs:501) →
`initial_url`(mod.rs:300) → `create_req.url(url)`(mod.rs:638)。target URL 进
create_req，由 `client.create(create_req)` 异步加载到 Float 窗口的 webview。

### 11.6 运行验证 (2026-08-14)

18:03 折叠构建部署后 hilog：
- Allow 测试（**未设** `set_create_new_window`）→ `new window requested: /allow-test`
  → `[WRY OHOS] build` + `CreateWindow callback: inner=true` → `TEST pass
  on_new_window: Allow triggers event with correct URL (2057ms)`（无死锁/无冻结）。
- `AceSubWindow: Create Subwindow` + `ARK_APP_SUBWINDOW_api00, id:1269,
  parentId:1267, type:1001` + `Show: Window show success` + 可拖拽子窗口。

独立 Float 子窗口已创建、可见、可拖拽、非阻塞。**结论**：Phase 2 Create→Float
路径功能正确。

### 11.7 待确认 gap（视觉）

`wry/src/ohos/mod.rs:307` `let _window_id = pl_attrs.window_id` 丢弃 window_id，
`WebviewCreateRequest` 无 window 绑定字段——Float 子窗口 webview 的
`pluginContext.getUIContext()` 是否解析到 Float 子窗口 UIContext（而非主窗口）需
**设备视觉**确认（hilog 只证窗口创建，不证像素内容）。关联 memory
`ohos-window-plugin-registry-gap`、`ohos-attach-component-windowstage-regression`。

### 11.8 与 §九 桌面对比表的更新

| 行为 | OHOS（Phase 2 实现） |
|------|------|
| `Allow` | 折叠为 Create→建 Float OS 子窗口加载 target URL |
| `Create` | **支持** — `WebviewWindowBuilder` + `OHOSWindowKind::Float` |
| `Deny` | `setWebController(null)` |
| `NewWindowFeatures.size/position` | builder 的 `.inner_size()/.position()` 经 tao 转 physical 生效 |
