## Context

Tauri `unstable` feature 的核心是窗口与 webview 解耦——允许多个 webview 嵌入同一窗口并独立定位/尺寸。在 Windows/macOS/Linux 上，这通过 wry 后端的 `set_bounds`/`bounds`/`set_visible` 实现。OHOS 后端（`wry/src/ohos/mod.rs`）中这三个方法均为 no-op，导致整个 multi-webview 能力链断裂。

**当前状态（5 层全链路分析）**：

| 层 | 方法 | 当前状态 |
|---|---|---|
| ArkTS `DefaultWebview.ets` | `.width()`/`.height()` | 硬编码 `"100%"`（3 处） |
| ArkTS `DefaultWebview.ets` | `WebviewStyle` | 只有 x/y/backgroundColor/visible，无 width/height |
| ArkTS `DefaultWebview.ets` | `EmbeddedWebBuilder` | 缺少 `.position({x, y})`（`WebBuilder` 有） |
| ArkTS `DefaultWebview.ets` | `buildJsHelper` | 返回对象有 setBackgroundColor/setVisible/dispose 桩，无 setBounds 桩 |
| ArkTS `Utils.ets` | `JsHelper` 接口 | 缺少 `setBounds` 方法定义 |
| ArkTS `Utils.ets` | `ProxyJsHelper` | 缺少 `setBounds` 缓存实现（controller 未就绪时调用会失败） |
| ArkTS `ArkHelper.ets` | `ret.controller` | 只挂载 setBackgroundColor/setVisible/dispose，无 setBounds |
| OHA Rust `webview.rs` | `Webview` 结构体 | 有 set_visible（NAPI），无 set_bounds/bounds |
| OHA Rust `webview.rs` | `WebViewStyle` 结构体 | 无 width/height 字段 |
| wry `ohos/mod.rs` | `set_bounds`/`bounds`/`set_visible` | 全部 no-op（set_visible 未调用 OHA 的 set_visible） |

**OHOS 系统能力确认**：
- ✅ ArkUI `Web` 组件的 `.width()`/`.height()` 接受 `number | string`（非仅 "100%"）
- ✅ `BuilderNode.update(data)` 触发重渲染（`updateWebviewStyle` 已用此机制）
- ✅ `RustWebviewNodeController` 已支持多 webview（Map 管理 addWebview/removeWebview）

**参考实现（macOS/Windows）**：
- macOS `set_bounds`：逻辑坐标 → `CGRect` → `setFrame`（仅 is_child 时）
- Windows `set_bounds`：物理坐标 → `controller.SetBounds` + `SetWindowPos`
- 两者 `bounds()` 都读取实际 frame/rect，但 OHOS 无等价的同步查询 API

## Goals / Non-Goals

**Goals:**
- wry OHOS `set_bounds` 从 no-op 改为实际调用 OHA NAPI，使 webview 可定位/尺寸
- wry OHOS `set_visible` 从 no-op 改为调用 OHA 已有的 `set_visible`
- wry OHOS `bounds` 从返回默认值改为返回缓存值（Rust 侧缓存最后设置的 bounds）
- ArkTS `WebviewStyle` 支持 width/height，`.width()`/`.height()` 参数化
- OHA Rust 新增 `set_bounds` NAPI 方法，遵循 `set_visible` 模式
- 向下兼容：单 webview 场景（不调用 set_bounds）行为不变，默认 "100%"

**Non-Goals:**
- 不涉及 tauri crate 层的 `add_child` 排除移除（Phase 3）
- 不涉及 tauri-runtime-wry 的 Reparent handler（Phase 2）
- 不涉及 JS `create_webview` 命令修复（Phase 3）
- 不实现 true reparent（跨窗口迁移 Web 组件）—— OHOS 不支持
- 不涉及 `bounds()` 的 ArkUI 实际布局查询（使用缓存值替代，与 macOS 的 is_child 分支类似）

## Decisions

### Decision 1: WebviewStyle 新增 width/height 字段，类型为 `number | string`

**选择**：`WebviewStyle` 接口新增 `width?: number | string` 和 `height?: number | string`。

**理由**：
- ArkUI `.width()`/`.height()` 原生接受 `number | string | Resource`，使用 `number | string` 覆盖主要用例
- `number` 表示 vp（虚拟像素），`string` 可表达 `"100%"`/`"50%"` 等百分比
- 与现有 `x`/`y` 字段类型一致（`number | string`）

**替代方案**：仅用 `number`（vp）→ 无法表达百分比布局，不够灵活。

### Decision 2: `.width()`/`.height()` 默认回退 `"100%"`

**选择**：`.width(data.style?.width ?? "100%")`，当 style 未设置 width 时使用 "100%"。

**理由**：
- 向下兼容：现有单 webview 场景不调用 `set_bounds`，style.width 为 undefined → 回退 "100%" → 行为不变
- multi-webview 场景：`set_bounds` 设置具体 width → style.width 有值 → 使用具体值

**修改位置**：`DefaultWebview.ets` 的 `WebBuilder`（约 line 117-118）和 `EmbeddedWebBuilder`（约 line 246-247 和 339-340），共 3 处。

### Decision 3: OHA Rust `set_bounds` NAPI 方法，参数为 4 个 f64

**选择**：`Webview::set_bounds(&self, x: f64, y: f64, width: f64, height: f64) -> Result<()>`，通过 NAPI 调用 ArkTS `ret.controller.setBounds(x, y, width, height)`。

**理由**：
- 遵循现有 `load_url_with_headers` 的多参数 NAPI 调用模式：`get_main_thread_env()` → `get_named_property::<Function<'_, FnArgs<(f64, f64, f64, f64)>, ()>>("setBounds")` → `.call((x, y, width, height).into())?`
- 使用 `.into()` 将 tuple 转为 `FnArgs`（参照 `webview.rs:199` 的 `.call((url, headers).into())` 模式），否则裸 tuple 会被序列化为 JS Array 而非展开参数
- 使用 `f64` 而非整数，因为 ArkUI 的 `.width()`/`.height()`/`.position()` 接受浮点数
- 4 个独立参数而非结构体，简化 NAPI 调用（避免中间结构体序列化）

**ArkTS 侧实现**：在 `ArkHelper.ets` 的 `createWebview` 和 `createEmbeddedWebview` 中：
```typescript
ret.controller.setBounds = (x: number, y: number, width: number, height: number) => {
  applyStyle({ x, y, width, height });
};
```

`applyStyle` 会 `objectAssign(init.style, { x, y, width, height })` 合并后调用 `updateWebviewStyle` 触发 `BuilderNode.update()` 重渲染。

**替代方案**：传 JSON 字符串 → 增加 序列化/反序列化开销，且与 set_visible/set_background_color 的直接参数模式不一致。

### Decision 4: `bounds()` 返回 Rust 侧缓存值

**选择**：wry OHOS `InnerWebView` 新增 `bounds_cache: Mutex<Rect>` 字段，`set_bounds` 时更新缓存，`bounds()` 返回缓存值。

**理由**：
- ArkUI 无同步的布局查询 API（`getMeasuredWidth` 等需等布局完成，异步）
- macOS 的 `bounds()` 读取 `webview.frame()`，但 OHOS 的 Web 组件 frame 不易从 Rust 侧同步获取
- Windows 的 `bounds()` 在非 child 模式下也使用 `controller.Bounds()`，但 OHOS 无等价 API
- 缓存模式在 tauri-runtime-wry 的 `WebviewBounds`（rate-based 定位）中已隐式使用——runtime 层自己维护了 bounds 比例值
- 用户场景：`bounds()` 主要用于查询已设置的值，而非读取实际渲染尺寸

**替代方案**：通过 NAPI 异步查询 ArkUI 布局 → 增加 NAPI 异步调用复杂度，且 `bounds()` 在 wry trait 中是同步签名。

### Decision 5: `set_visible` 直接调用 OHA 已有的 `set_visible`

**选择**：wry OHOS `set_visible` 从 `Ok(())` 改为 `self.webview.set_visible(visible).map_err(...)`。

**理由**：
- OHA Rust `Webview::set_visible` 已实现（`helper/webview.rs:330`），通过 NAPI 调用 ArkTS `setVisible` → `applyStyle({ visible })` → `updateWebviewStyle`
- wry 层只需补一行调用，无需新增 NAPI 方法
- 这是纯接线遗漏，非功能缺失

### Decision 6: wry `InnerWebView` 新增 `bounds_cache` 字段

**选择**：在 `wry/src/ohos/mod.rs` 的 `InnerWebView` 结构体新增 `bounds_cache: std::sync::Mutex<wry::Rect>` 字段。

**理由**：
- `set_bounds` 调用 OHA NAPI 后，同步更新缓存
- `bounds()` 返回缓存值
- `Mutex` 而非 `Atomic`，因为 `Rect` 包含 4 个字段（position: Position, size: Size），不适合原子操作
- 初始值：若 `WebViewAttributes::bounds` 存在，使用该值初始化缓存；否则 `Rect::default()`（全零），与当前 `bounds()` 返回值一致

### Decision 7: 初始 bounds 在 `InnerWebView::new` 中应用

**选择**：在 `wry/src/ohos/mod.rs` 的 `InnerWebView::new` 中读取 `attributes.bounds`（当前在 `..` 中被忽略），提取 x/y/width/height 传入 `WebViewStyle`，并初始化 `bounds_cache`。

**理由**：
- tauri-runtime-wry 在创建 webview 时通过 `webview_builder.with_bounds(bounds)` 设置初始 bounds（`lib.rs:5224`）
- 但 OHOS `InnerWebView::new` 的 `WebViewAttributes` 解构中 `bounds` 在 `..` 中被忽略（`ohos/mod.rs:68`），初始 bounds 丢失
- 修复：在解构中提取 `bounds`，通过 `to_logical(1.0)` 转为 `f64` 值，传入 `WebViewStyle` 的 x/y/width/height

**Rust `WebViewStyle` 需新增字段**：
```rust
#[napi(object)]
#[derive(Debug, Clone, Default)]
pub struct WebViewStyle {
    pub x: Option<Either<f64, String>>,
    pub y: Option<Either<f64, String>>,
    pub width: Option<Either<f64, String>>,   // 新增
    pub height: Option<Either<f64, String>>,  // 新增
    pub visible: Option<bool>,
    pub background_color: Option<u32>,
}
```

### Decision 8: Scale factor 使用 1.0（已知限制）

**选择**：在 `InnerWebView::new` 和 `set_bounds` 中，使用 `to_logical(1.0)` 提取 `f64` 值。

**理由**：
- `InnerWebView::new` 的 `window: &impl HasWindowHandle` 不提供 scale factor（wry 不依赖 tao）
- macOS 通过 `self.webview.window().backingScaleFactor()` 获取，OHOS 的 `Webview` handle 无等价 API
- tauri-runtime-wry 的 `WebviewBounds` 系统已用正确 scale factor 转换（`lib.rs:3963-3964`），实际发送的 bounds 多为 `Logical` 单位
- `to_logical(1.0)` 对 `Logical` 值是 no-op（正确），对 `Physical` 值在 high-DPI 下有误差

**已知限制**：若用户传 `PhysicalPosition`/`PhysicalSize`，在 scale factor ≠ 1.0 的设备上 bounds 会有偏差。后续 Phase 可通过在 `InnerWebView` 存储 scale factor 修复。

### Decision 9: JsHelper / ProxyJsHelper / buildJsHelper 三处同步添加 setBounds

**选择**：`setBounds` 方法需在 ArkTS 侧三个位置同步添加，遵循现有 `setVisible` 的完整链路模式。

**三处修改**：

1. **`Utils.ets` `JsHelper` 接口**（line 46-61）：新增 `setBounds: (x: number, y: number, width: number, height: number) => void`

2. **`Utils.ets` `ProxyJsHelper`**（line 68-191）：新增 `setBounds` 方法，遵循缓存模式：
   ```typescript
   setBounds(x: number, y: number, width: number, height: number): void {
     if (this.realController) {
       this.realController.setBounds(x, y, width, height);
     } else {
       this.pendingOperations.push(() => this.realController!.setBounds(x, y, width, height));
     }
   }
   ```
   **理由**：当 controller 未就绪时，`ArkHelper.ets` 返回 `ProxyJsHelper`（line 280-282）。若 `setBounds` 在此期间被调用（如初始 bounds 设置），需缓存并在 `bindToRealController` 时回放。

3. **`DefaultWebview.ets` `buildJsHelper`**（line 614-629）：返回对象新增 `setBounds: (_x: number, _y: number, _w: number, _h: number) => {}` no-op 桩。
   **理由**：`buildJsHelper` 返回的 `JsHelper` 对象必须满足接口。`setBackgroundColor`/`setVisible`/`dispose` 已有 no-op 桩（line 625-627），随后被 `ArkHelper.ets` 覆盖为真实实现。`setBounds` 需同样模式。

**完整调用链路**：
```
Rust NAPI set_bounds → get_named_property("setBounds") → JS controller.setBounds
  ↓ (controller 可能是)
  正常路径: ret.controller.setBounds (ArkHelper.ets 覆盖) → applyStyle({x,y,width,height})
  未就绪路径: ProxyJsHelper.setBounds → 缓存 → bindToRealController 时回放 → ret.controller.setBounds
```

### Decision 10: EmbeddedWebBuilder 添加 .position()

**选择**：在 `EmbeddedWebBuilder`（`DefaultWebview.ets:235-345`）的 Stack 容器上添加 `.position({ x: data.style?.x ?? 0, y: data.style?.y ?? 0 })`，与 `WebBuilder`（line 119-122）保持一致。

**理由**：
- `WebBuilder` 已有 `.position()`（line 119-122），multi-webview 路径（`addWebview` → `WebBuilder`）定位正常
- `EmbeddedWebBuilder` 用于 `createEmbeddedWebview` 路径，当前无 `.position()`，`setBounds` 的位置分量不会生效
- 添加 `.position()` 确保两条路径行为一致
- 位置加在 Stack 容器上（而非内部 Web），因为 Stack 控制容器在父布局中的位置，内部 Web 以 100% 填充容器

**替代方案**：不为 `EmbeddedWebBuilder` 添加 `.position()`，标注为限制 → 不一致，且 `applyStyle({x, y, width, height})` 会部分生效（width/height 生效但 x/y 不生效），行为混乱。

## Risks / Trade-offs

- **[ArkUI 重渲染性能]** `setBounds` 频繁调用触发 `BuilderNode.update()` 全量重渲染 → 频率应由调用方（tauri-runtime-wry）控制，已有 `WebviewBounds` rate-based 计算仅在窗口 resize 时更新。正常运行时 `set_bounds` 只在创建时调用一次。
- **[bounds 缓存与实际不一致]** 缓存值可能与 ArkUI 实际布局不同（如窗口 resize 后 ArkUI 自动调整）→ tauri-runtime-wry 的 resize handler 会重新计算并调用 `set_bounds` 更新缓存，保持一致。对于不使用 auto_resize 的 webview，缓存值代表用户最后设置的值，语义正确。
- **[NAPI 线程安全]** `set_bounds` 在 wry event loop 线程调用，`get_main_thread_env()` 返回 Chrome_IOThread 的 env → 与 `set_visible`/`set_background_color` 相同的线程模型，无新增风险。
- **[BuilderNode.update 限制]** `updateWebviewStyle` 调用 `node.update(entry)` 触发 BuilderNode 重新构建 → ArkUI 的 BuilderNode.update 会 diff 数据并更新 UI，但 Web 组件的 controller 不会被重建（controller 是外部传入的）。需验证 update 后 Web 组件的 URL/历史不丢失。
- **[ProxyJsHelper 回放顺序]** `setBounds` 在 controller 未就绪时被缓存，`bindToRealController` 后按 FIFO 回放。若 `setBounds` 在 `loadUrl` 之前被调用，回放顺序正确（先定位再加载）。但若 `setBounds` 在 `loadUrl` 之后被调用，回放时 `setBounds` 会在 `loadUrl` 之后执行，可能导致初始渲染位置闪动。
- **[ProxyJsHelper pending path 已知限制（既有 bug）]** 当 controller 未就绪时，`ArkHelper.ets` 返回 `ProxyJsHelper`（line 280-282），跳过 `ret.controller` 的方法覆盖（line 309-319）。后续 `WindowManager.registerController` 调用 `addWebview` 返回的 `result.controller` 是 `buildJsHelper` 产生的 no-op 桩对象。`proxy.bindToRealController(result.controller)` 回放缓存操作时，`setBounds`/`setBackgroundColor`/`setVisible`/`dispose` 均命中 no-op 桩，**静默丢失**。这是既有 bug（`setBackgroundColor`/`setVisible` 同样受影响），非本 Phase 引入。**缓解措施**：初始 bounds 通过 `WebViewStyle` 在创建时传入（Decision 7），不依赖运行时 `set_bounds` 回放。运行时 `set_bounds` 在 controller 就绪后正常工作。
