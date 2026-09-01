# Phase A1 技术设计

## 架构上下文

A0 引入的 bridge 模型有两种执行模式和一种反向事件通道：

- **AsyncBridge**（outbound）：Rust worker → `BridgeRuntime::call_async` → TSFN → ArkTS `invokeAsync` → Promise → Rust future。适合 IO 密集或异步 ArkTS 操作。
- **MainThreadSyncBridge**（outbound）：Rust 主线程 → `BridgeMainThread::call_sync` → ArkTS `invokeSync` → 同步返回。适合进程控制等必须同步完成的操作。
- **on_main_thread_event**（反向）：ArkTS `context.invokeNativeSync(event, reqType, respType, value)` → Rust `on_main_thread_event` → 同步返回响应。适合 ArkWeb 回调等必须在 NAPI env 存活期间返回的场景。

所有 Rust facade 类型必须 `impl BridgeNapiType`（通过 `impl_bridge_napi_type!` 宏），TYPE_NAME 作为 Rust↔ArkTS 契约标识。action 命名使用 kebab-case。

## 1. webview 域 action 补全

### 1.1 create-pdf（R83 打印功能）

**方向**：outbound async（Rust → ArkTS）

**背景**：R83 打印功能在 OHOS 上通过 `WebviewController.createPdf()` 生成 PDF 并写入文件。参考已归档的 `2026-06-01-hmos-webview-create-pdf` 设计，固定使用 A4 默认配置（无 PdfConfig 暴露）。

**Rust facade**：
```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct WebviewPrintRequest {
    pub id: String,
    pub path: String,  // 目标 PDF 文件绝对路径
}
impl_bridge_napi_type!(WebviewPrintRequest, "ohos.webview.PrintRequest");

#[napi(object)]
#[derive(Clone, Debug)]
pub struct WebviewPrintResponse {
    pub success: bool,
}
impl_bridge_napi_type!(WebviewPrintResponse, "ohos.webview.PrintResponse");
```

**WebviewHandle facade**：
```rust
pub async fn create_pdf(&self, path: impl Into<String>) -> Result<()>;
```

**ArkTS 实现**：
```typescript
const DEFAULT_PDF_CONFIG: webview.PdfConfiguration = {
  width: 8.27, height: 11.69,  // A4
  marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  shouldPrintBackground: true,
};
// action: "create-pdf"
// API 14+ guard: createPdf() and PdfData.pdfArrayBuffer() are API 14+,
// not available on API 12/13 devices.
if (typeof controller.createPdf !== 'function') {
  return { typeName: PRINT_RESPONSE_TYPE, value: { success: false } };
}
const pdfData = await controller.createPdf(DEFAULT_PDF_CONFIG);
const buffer = pdfData.pdfArrayBuffer();
const file = fileIo.openSync(path, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE);
await fileIo.write(file.fd, buffer);
fileIo.closeSync(file);
return { typeName: PRINT_RESPONSE_TYPE, value: { success: true } };
```

**约束**：调用方（wry）需在 `page-end` 回调后调用，确保页面加载完成。

**遗留代码差异**：旧代码同时实现了 `printPage`（`createPdf` → 写文件 → `printKit.print` 发送到物理打印机）。本 phase 仅实现 `create-pdf`（生成 PDF 文件），因为 wry/tauri 的消费方 API 是 `create_pdf(path, config, callback)`。本 bridge 简化为 `create_pdf(path)` 固定 A4 配置（不暴露 PdfConfig），B2 wry 改写时将忽略 config 参数或映射到 A4 默认。`printKit.print`（物理打印）为未来扩展，不在 A1 范围内。ArkTS 需引入 `import { fileIo } from '@kit.CoreFileKit'`。

### 1.2 set-user-agent

**方向**：outbound async

**Rust facade**：
```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct WebviewUserAgentRequest {
    pub id: String,
    pub user_agent: String,
}
impl_bridge_napi_type!(WebviewUserAgentRequest, "ohos.webview.UserAgentRequest");
// resp: WebviewAcknowledgement (复用现有类型)
```

**WebviewHandle facade**：
```rust
pub async fn set_user_agent(&self, user_agent: impl Into<String>) -> Result<()>;
```

**ArkTS 实现**：`controller.setCustomUserAgent(userAgent)`。OHOS 官方建议在 `onControllerAttached` 中设置；运行时动态设置也支持但可能概率性失败，用 try-catch 捕获。

### 1.3 拖拽反向事件（drag-enter/drag-over/drag-drop/drag-leave）

**方向**：reverse event（ArkTS → Rust，同步）

**背景**：旧模型使用 pipe 字符串 `"<type>|<paths_nul>|<x>,<y>"` 通过 `onDragAndDrop` 回调传输。新模型使用 4 个独立的具名 N-API 事件，每个携带结构化数据。

**关键约束**（来自旧代码 DefaultWebview.ets 注释）：
- ArkUI `DragEvent.getData()` 返回 UDMF `UnifiedData`，**仅在 onDrop 中有效**；enter/move/leave 传空 paths。
- `DragEvent.getX()/getY()` 在 4 个回调中均有效。
- 文件拖拽记录提取：`UniformDataType.FILE_URI` → `FileUri.oriUri`；图片拖拽回退：`Image.imageUri`。
- `file://` / `datashare://` scheme 被 strip，Rust 侧收到绝对路径。
- **ArkWeb 文件 drop 抢消费问题**：ArkWeb 消费 OS 文件 drop（导航 file://）抢先 onDrop，`setResult(DRAG_SUCCESSFUL)` 无效。可靠拦截点是 `onLoadIntercept` 拦截 `file://` 导航。drop 事件的 paths 从拦截的 file:// URL 中提取。

**Rust facade 类型**：
```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct WebviewDragEvent {
    pub id: String,
    pub native_tag: String,
    pub x: f64,
    pub y: f64,
}
impl_bridge_napi_type!(WebviewDragEvent, "ohos.webview.DragEvent");

#[napi(object)]
#[derive(Clone, Debug)]
pub struct WebviewDropEvent {
    pub id: String,
    pub native_tag: String,
    pub x: f64,
    pub y: f64,
    pub paths: Vec<String>,  // 空数组 for enter/over/leave
}
impl_bridge_napi_type!(WebviewDropEvent, "ohos.webview.DropEvent");
// resp: WebviewEventAcknowledgement (复用现有类型)
```

**Rust callbacks registry**（callbacks.rs 扩展）：
```rust
type DragEnterCallback = Arc<dyn Fn(WebviewDragEvent) + Send + Sync + 'static>;
type DragOverCallback = Arc<dyn Fn(WebviewDragEvent) + Send + Sync + 'static>;
type DragDropCallback = Arc<dyn Fn(WebviewDropEvent) + Send + Sync + 'static>;
type DragLeaveCallback = Arc<dyn Fn(WebviewDragEvent) + Send + Sync + 'static>;
```

`WebviewCallbacksBuilder` 新增 `.on_drag_enter()` / `.on_drag_over()` / `.on_drag_drop()` / `.on_drag_leave()` 方法。

**WebviewBridgePlugin::on_main_thread_event** 新增 4 个 match 分支。

**ArkTS 实现**：
- `WebviewEventOptions` 新增 `dragDrop: bool`。
- `BuildWebview` @Builder 根据 `dragDropOverlay` flag 选择两种模式：
  - `dragDropOverlay = false`（默认）：直接在 Web 组件上绑定 `.onDragEnter/.onDragMove/.onDrop/.onDragLeave`。
  - `dragDropOverlay = true`：在 Web 上叠加透明 Stack，Stack 绑定 4 个 drag 事件（Web 不接收 drag 事件）。
- `onLoadIntercept` 的 `file://` 分支：提取路径后通过 `drag-drop` 反向事件发送（而非旧模型的 pipe 字符串），返回 `true` 拦截导航。
- `onDrop` 中调用 `dragEvent.getData()` 提取 UDMF 记录路径。

### 1.4 new-window-request 反向事件

**方向**：reverse event（ArkTS → Rust，同步）

**背景**：旧模型 `onWindowNew` → NAPI Function → Rust 闭包返回 `{ allow: bool }`。新模型使用具名 N-API 事件。参考已归档 `2026-06-12-p1-on-window-new` 设计。

**ArkWeb 约束**：
- `onWindowNew` 必须搭配 `multiWindowAccess(true)` 才能触发。
- 回调内必须调用 `event.handler.setWebController(ctrl)` —— 传 `null` = 阻止，传有效 controller = 允许。**不调用会导致渲染进程永久阻塞**。
- `OnWindowNewEvent` 提供 `targetUrl`（API 9+）, `isAlert`（API 10+）, `isUserTrigger`（API 10+）。所有字段均满足 API 12 基线，无需版本守卫。

**Rust facade 类型**：
```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct WebviewNewWindowRequest {
    pub id: String,
    pub native_tag: String,
    pub target_url: String,
    pub is_alert: bool,
    pub is_user_trigger: bool,
}
impl_bridge_napi_type!(WebviewNewWindowRequest, "ohos.webview.NewWindowRequest");

#[napi(object)]
#[derive(Clone, Debug)]
pub struct WebviewNewWindowResponse {
    pub allow: bool,
}
impl_bridge_napi_type!(WebviewNewWindowResponse, "ohos.webview.NewWindowResponse");
```

**Rust callback**：
```rust
type NewWindowCallback = Arc<dyn Fn(WebviewNewWindowRequest) -> bool + Send + Sync + 'static>;
```

`WebviewCallbacksBuilder::on_new_window_request(callback)`。

**ArkTS 实现**：
- `WebviewEventOptions` 新增 `newWindow: bool`。
- `BuildWebview` 中当 `newWindow` 为 true 时绑定 `.multiWindowAccess(true).allowWindowOpenMethod(true).onWindowNew(handler)`。
- `handler` 中：调用 `invokeNativeSync("new-window-request", ...)` 获取 `{ allow }`。
  - `allow = false`：`event.handler.setWebController(null)`（阻止）。
  - `allow = true`：创建新 `WebviewController`，用 `@CustomDialog` 或 `promptAction.openCustomDialog()` 展示，调用 `event.handler.setWebController(newController)`。
- 无 handler 注册时默认 Deny（`setWebController(null)`）。

### 1.5 page-begin / page-end 反向事件

**方向**：reverse event（ArkTS → Rust，同步）

**背景**：旧模型通过 `onPageBegin(url)` / `onPageEnd(url)` 回调传输 URL。新模型 WebviewPlugin.ets 的 `BuildWebview` @Builder 需绑定 `.onPageBegin` / `.onPageEnd` 并通过 `invokeNativeSync` 分发。

注意：plugin-webview 的 `WebviewHandle::on_page_begin/on_page_end` 当前通过 `ohos_web_binding::Web` 注册，这是另一条路径（ArkWeb C-API binding）。bridge 模型下应统一走 `invokeNativeSync` 反向事件，由 WebviewPlugin.ets 在 @Builder 中绑定 ArkWeb 的 `.onPageBegin(e)` / `.onPageEnd(e)` 事件。

**迁移要求**：新增 bridge `page-begin`/`page-end` 回调后，必须将现有 `WebviewHandle::on_page_begin` / `on_page_end` 方法（通过 `ohos_web_binding::Web` C-API 注册）标记 `#[deprecated]`，或在 B2 wry 改写时移除。两条路径同时激活会导致回调被触发两次。B2 改写 wry 时应只使用 bridge `invokeNativeSync` 路径。

**Rust facade 类型**：
```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct WebviewPageEvent {
    pub id: String,
    pub native_tag: String,
    pub url: String,
}
impl_bridge_napi_type!(WebviewPageEvent, "ohos.webview.PageEvent");
// resp: WebviewEventAcknowledgement (复用)
```

**Rust callbacks**：
```rust
type PageBeginCallback = Arc<dyn Fn(WebviewPageEvent) + Send + Sync + 'static>;
type PageEndCallback = Arc<dyn Fn(WebviewPageEvent) + Send + Sync + 'static>;
```

`WebviewCallbacksBuilder::on_page_begin(callback)` / `.on_page_end(callback)`。

**ArkTS 实现**：
- `WebviewEventOptions` 新增 `pageBegin: bool`, `pageEnd: bool`。
- `BuildWebview` 绑定 `.onPageBegin((e) => notifyNative("page-begin", ...))` / `.onPageEnd((e) => notifyNative("page-end", ...))`。

### 1.6 create 入参扩展

`WebviewCreateRequest` 新增 3 个 Option 字段：

```rust
pub struct WebviewCreateRequest {
    // ... 现有字段 ...
    /// 启用 ArkWeb 原生剪贴板（Ctrl+C/V/X/A/Z/Y）。默认 true（ArkWeb 默认行为）。
    /// false 时由 accelerator_matcher 拦截剪贴板快捷键。
    pub clipboard: Option<bool>,
    /// 启用缩放快捷键（Ctrl+/-/0）。默认 false。
    pub zoom_hotkeys: Option<bool>,
    /// 使用透明 Stack overlay 接收 drag 事件（而非直接在 Web 组件上绑定）。
    /// 适用于 ArkWeb drag 事件不可靠的场景。
    pub drag_drop_overlay: Option<bool>,
}
```

`WebviewCallbackOptions` 新增：
```rust
pub struct WebviewCallbackOptions {
    // ... 现有字段 ...
    pub drag_drop: bool,    // 任一 drag 回调注册时为 true
    pub new_window: bool,
    pub page_begin: bool,
    pub page_end: bool,
}
```

ArkTS `WebviewCreatePayload` / `WebviewEventOptions` 对应扩展。

### 1.7 close-window 路由（navigation-request 内部路由）

**方向**：无新 action，在现有 `navigation-request` 反向事件内路由。

**机制**：`WebviewCallbacksBuilder::on_close_window(callback)` 注册关闭回调。`navigation_decision()` 检查 URL：
- `url.startsWith("close-window.invalid")` 或 `url.startsWith("http://close-window.invalid")`：调用 close_window 回调，返回 `intercept: true`（阻止导航）。
- 否则：走正常 navigation 回调。

ArkTS 侧无需改动（`onLoadIntercept` 已将所有 URL 转发到 `navigation-request`）。Rust 侧 `navigation_decision` 增加前缀检查分支。

### 1.8 multiWindowAccess / allowWindowOpenMethod

随 `new-window-request` 落地。当 `eventOptions.newWindow = true` 时，`BuildWebview` 中绑定 `.multiWindowAccess(true).allowWindowOpenMethod(true)`。否则不绑定（ArkWeb 默认不允许多窗口）。

## 2. app-control 域 action 补全

### 2.1 hide-ability / show-ability

**方向**：sync（MainThreadSyncBridge），fire-and-forget

**背景**：旧代码中 `hideAbility()` 调用 `context.hideAbility()`（UIAbilityContext），`showAbility()` 调用 `context.startAbility({bundleName, abilityName})`。注意 `hideAbility()` 仅支持 callback（不支持 Promise），`startAbility(want)` 支持 Promise。两者语义均为"发起"而非"完成"。

**执行模式选择**：app-control 是 `MainThreadSyncBridge`。hide/show 涉及异步操作，但 sync 插件无法 await。采用 fire-and-forget 模式：ArkTS 发起异步调用并立即返回 `{accepted: true}`。ack 表示"调用已发起"，非"操作已完成"。这与 `terminate` 的同步语义一致（terminate 也是发起后立即返回）。

**关键 API 差异**：
- `hideAbility(callback: AsyncCallback<void>): void` — **仅支持 callback，不支持 Promise**。必须用 callback 形式：`ctx.hideAbility((error) => { if (error) console.error(...) })`。
- `startAbility(want: Want): Promise<void>` — 支持 Promise，可用 `.catch()` 捕获错误。

**Rust facade 类型**：
```rust
#[napi(object)]
#[derive(Clone, Debug, Default)]
pub struct HideAbilityRequest {}
impl_bridge_napi_type!(HideAbilityRequest, "ohos.app_control.HideAbilityRequest");

#[napi(object)]
#[derive(Clone, Debug)]
pub struct HideAbilityResponse { pub accepted: bool }
impl_bridge_napi_type!(HideAbilityResponse, "ohos.app_control.HideAbilityResponse");

// ShowAbilityRequest / ShowAbilityResponse 同构
```

**Rust facade**：
```rust
pub trait AppControlExt {
    fn terminate(&self, env: &Env, code: i32) -> Result<()>;
    fn hide_ability(&self, env: &Env) -> Result<()>;
    fn show_ability(&self, env: &Env) -> Result<()>;
}
```

**ArkTS 实现**（AppControlPlugin.ets `invokeSync`）：
```typescript
if (action === "hide-ability") {
  const ctx = context.abilityContext;
  // hideAbility() only supports callback, NOT Promise
  ctx.hideAbility((error: BusinessError) => {
    if (error) {
      console.error(`[AppControl] hideAbility failed: ${error.code} ${error.message}`);
    }
  });
  return { typeName: HIDE_ABILITY_RESPONSE_TYPE, value: { accepted: true } };
}
if (action === "show-ability") {
  const ctx = context.abilityContext;
  const want: Want = {
    bundleName: ctx.abilityInfo.bundleName,
    abilityName: ctx.abilityInfo.name,
  };
  // startAbility(want) supports Promise
  ctx.startAbility(want).catch((e: BusinessError) => {
    console.error(`[AppControl] showAbility failed: ${e.code} ${e.message}`);
  });
  return { typeName: SHOW_ABILITY_RESPONSE_TYPE, value: { accepted: true } };
}
```

**约束**：
- `hideAbility()` 仅 UIAbility 主窗口可用；Float 子窗口用 `minimize()`（已在 plugin-window 的 `minimize` action 覆盖）。
- hide 后 show 可能不对称（OHOS 已知限制，已在 WindowManager 注释中记录）。
- `context.abilityInfo` 需在 ability created 后才可用（REQUIRED_CONTEXTS: Ability 已保证）。

### 2.2 BlurModifier / AttributeUpdater 动态刷新

**背景**：旧代码 `DefaultWebview.ets` 中 `BlurModifier extends AttributeUpdater<CommonAttribute>`，通过 `modifier.attribute?.backdropBlur(radius)` 在运行时刷新 Stack 的 `backdropBlur`（因为 `BuilderNode.update` 不刷新 `backdropBlur`）。

**目标**：将 `BlurModifier` 类和动态刷新逻辑从 `_legacy/DefaultWebview.ets` 移入 `plugins/window/.../WindowPlugin.ets`（或共享 helper），供 window 级 vibrancy/blur 使用。

**实现要点**：
- `BlurModifier` 类定义移入 WindowPlugin.ets 或 `plugins/window/src/main/ets/BlurModifier.ets`。
- `set-blur` action 在调用 `setWindowShadowRadius` 的同时，如有关联的 content FrameNode，通过 `AttributeUpdater` 刷新 `backdropBlur`。
- 该 AttributeUpdater 需在窗口创建时初始化并关联到窗口内容节点。
- `backdropBlur` 和 `backgroundColor` 的运行时刷新均通过 `modifier.attribute?.backdropBlur(radius)` / `modifier.attribute?.backgroundColor(color)` 触发，不需 `@State`。

**约束**（ohos-constraints 4.1）：
- `AttributeUpdater` 适合 `@Builder`/`BuilderNode` 场景，不需 `@State`。
- `BuilderNode.update` 不刷新组件属性（已验证：`backdropBlur`、`backgroundColor` 等需 AttributeUpdater）。

## 3. clipboard 域 action 补全

### 3.1 新建 plugin-clipboard crate

**背景**：当前 clipboard 仅在 `crates/ability/src/clipboard/mod.rs` 中实现 `clipboard_write_image`（旧 TSFN 模型，非 bridge plugin）。`ClipboardHelper.ets` 只有 `writeImageToClipboard`。文本读写完全缺失。

**新建 crate**：`crates/plugin-clipboard/`，plugin ID `ohos.clipboard`，`AsyncBridge`，`REQUIRED_CONTEXTS: [Ability]`（pasteboard 不需要 UIContext）。

### 3.2 read-text

**方向**：outbound async

**Rust facade**：
```rust
#[napi(object)]
#[derive(Clone, Debug, Default)]
pub struct ClipboardReadTextRequest {}
impl_bridge_napi_type!(ClipboardReadTextRequest, "ohos.clipboard.ReadTextRequest");

#[napi(object)]
#[derive(Clone, Debug)]
pub struct ClipboardReadTextResponse {
    pub text: Option<String>,
}
impl_bridge_napi_type!(ClipboardReadTextResponse, "ohos.clipboard.ReadTextResponse");
```

**ArkTS 实现**：
```typescript
// action: "read-text"
const systemPasteboard = pasteboard.getSystemPasteboard();
const data = await systemPasteboard.getData();
const text = data.getPrimaryText();
return { typeName: READ_TEXT_RESPONSE_TYPE, value: { text: text ?? null } };
```

### 3.3 write-text

**方向**：outbound async

**Rust facade**：
```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct ClipboardWriteTextRequest {
    pub text: String,
}
impl_bridge_napi_type!(ClipboardWriteTextRequest, "ohos.clipboard.WriteTextRequest");

#[napi(object)]
#[derive(Clone, Debug)]
pub struct ClipboardWriteTextResponse {
    pub accepted: bool,
}
impl_bridge_napi_type!(ClipboardWriteTextResponse, "ohos.clipboard.WriteTextResponse");
```

**ArkTS 实现**：
```typescript
// action: "write-text"
const pasteData = pasteboard.createData(pasteboard.MIMETYPE_TEXT_PLAIN, request.text);
const systemPasteboard = pasteboard.getSystemPasteboard();
await systemPasteboard.setData(pasteData);
return { typeName: WRITE_TEXT_RESPONSE_TYPE, value: { accepted: true } };
```

### 3.4 write-image（迁移自 ability/src/clipboard/mod.rs）

**方向**：outbound async

**Rust facade**：
```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct ClipboardWriteImageRequest {
    pub rgba: Vec<u8>,
    pub width: u32,
    pub height: u32,
}
impl_bridge_napi_type!(ClipboardWriteImageRequest, "ohos.clipboard.WriteImageRequest");

#[napi(object)]
#[derive(Clone, Debug)]
pub struct ClipboardWriteImageResponse {
    pub accepted: bool,
}
impl_bridge_napi_type!(ClipboardWriteImageResponse, "ohos.clipboard.WriteImageResponse");
```

**ArkTS 实现**：复用现有 `ClipboardHelper.ets` 的 `writeImageToClipboard` 逻辑（PixelMap 创建 + `pasteboard.createData(MIMETYPE_PIXELMAP, pm)` + `setData`）。

**迁移策略**：`ability/src/clipboard/mod.rs` 的 `clipboard_write_image` 标记 `#[deprecated]`，功能由新 plugin-clipboard 的 `write-image` action 替代。消费方（clipboard-manager 插件）在 B5 阶段切换到新 API。

### 3.5 ClipboardClient facade

```rust
pub struct ClipboardClient { bridge: BridgeRuntime }

impl ClipboardClient {
    pub async fn read_text(&self) -> Result<Option<String>>;
    pub async fn write_text(&self, text: impl Into<String>) -> Result<()>;
    pub async fn write_image(&self, rgba: &[u8], width: u32, height: u32) -> Result<()>;
}

pub trait ClipboardExt {
    fn clipboard(&self) -> Result<ClipboardClient>;
}
```

## 4. 约束遵守

### 4.1 cfg 隔离策略
- 所有 Rust crate 新增代码在 `cfg(target_env = "ohos")` 下编译（通过 crate 级 cfg 或 target-ohos-only crate）。
- plugin-clipboard 作为新 crate，仅在 OHOS target 下编译（Cargo.toml `[target'cfg(target_env="ohos")'.dependencies]`）。
- 不影响 Windows/macOS/Linux 的任何编译路径。

### 4.2 线程模型
- **禁止** `run_on_main_thread + rx.recv()` 阻塞模式（Chrome_IOThread 死锁）。
- 反向事件通过 `on_main_thread_event` 同步分发，在 NAPI env 存活期间完成，无 TSFN。
- outbound async 调用通过 `BridgeRuntime::call_async` → TSFN NonBlocking → ArkTS Promise。
- outbound sync 调用通过 `BridgeMainThread::call_sync` → 同步返回（仅主线程）。

### 4.3 NAPI 规则
- TSFN 使用 `callee_handled::<false>()`（禁止 `true`，参数偏移 bug）。
- ArkTS 侧使用 camelCase 调用 NAPI 函数。
- 被 NAPI `func.call` 调的 ArkTS 函数内部禁用 `hilog`（Argc mismatch），用 `console.error` 替代。

### 4.4 命名约定
- action：kebab-case（`create-pdf`, `set-user-agent`, `drag-enter`, `read-text`）
- Rust 类型：PascalCase + `impl_bridge_napi_type!`（TYPE_NAME 格式 `ohos.<domain>.<TypeName>`）
- ArkTS 函数：camelCase
