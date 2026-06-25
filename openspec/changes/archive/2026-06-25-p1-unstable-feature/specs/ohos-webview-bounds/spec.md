## ADDED Requirements

### Requirement: wry OHOS set_bounds SHALL call OHA NAPI
wry OHOS 后端的 `InnerWebView::set_bounds` SHALL 调用 `openharmony_ability::Webview::set_bounds()` 将 bounds 传递到 ArkTS 层，而非返回 no-op。

#### Scenario: set_bounds positions child webview
- **WHEN** tauri-runtime-wry 调用 `webview.set_bounds(Rect { position: (100, 50), size: (400, 300) })`
- **THEN** wry OHOS SHALL 调用 `self.webview.set_bounds(100.0, 50.0, 400.0, 300.0)`
- **AND** ArkTS `applyStyle({ x: 100, y: 50, width: 400, height: 300 })` SHALL 触发 `updateWebviewStyle` 重渲染
- **AND** Web 组件 `.position({ x: 100, y: 50 })`、`.width(400)`、`.height(300)` SHALL 生效

#### Scenario: set_bounds updates cache
- **WHEN** `set_bounds(bounds)` 被调用
- **THEN** wry OHOS SHALL 更新 `bounds_cache` 为传入的 bounds 值
- **AND** 后续 `bounds()` 调用 SHALL 返回该缓存值

### Requirement: wry OHOS bounds SHALL return cached value
wry OHOS 后端的 `InnerWebView::bounds` SHALL 返回 `bounds_cache` 中缓存的最后设置值，而非 `Rect::default()`。

#### Scenario: bounds returns last set value
- **WHEN** 先调用 `set_bounds(Rect { position: (10, 20), size: (800, 600) })`，再调用 `bounds()`
- **THEN** SHALL 返回 `Rect { position: (10, 20), size: (800, 600) }`

#### Scenario: bounds returns initial value before any set_bounds
- **WHEN** webview 创建时 `WebViewAttributes::bounds` 为 `Some(Rect { position: (0, 0), size: (200, 200) })`（wry 默认值），且未调用 `set_bounds` 时调用 `bounds()`
- **THEN** SHALL 返回初始 bounds 值 `Rect { position: (0, 0), size: (200, 200) }`（由 `InnerWebView::new` 从 `attributes.bounds` 初始化 `bounds_cache`）

#### Scenario: bounds returns default when no initial bounds
- **WHEN** webview 创建时 `WebViewAttributes::bounds` 为 `None`，且未调用 `set_bounds` 时调用 `bounds()`
- **THEN** SHALL 返回 `Rect::default()`（全零）

### Requirement: wry OHOS set_visible SHALL call OHA set_visible
wry OHOS 后端的 `InnerWebView::set_visible` SHALL 调用 `openharmony_ability::Webview::set_visible()` 切换 Web 组件可见性，而非返回 no-op。

#### Scenario: hide webview
- **WHEN** tauri-runtime-wry 调用 `webview.set_visible(false)`
- **THEN** wry OHOS SHALL 调用 `self.webview.set_visible(false)`
- **AND** ArkTS `applyStyle({ visible: false })` SHALL 触发 `updateWebviewStyle`
- **AND** Web 组件 `.visibility(Visibility.Hidden)` SHALL 生效

#### Scenario: show webview
- **WHEN** tauri-runtime-wry 调用 `webview.set_visible(true)`
- **THEN** wry OHOS SHALL 调用 `self.webview.set_visible(true)`
- **AND** Web 组件 `.visibility(Visibility.Visible)` SHALL 生效

### Requirement: WebviewStyle SHALL support width and height fields
`WebviewStyle` 接口（ArkTS）SHALL 新增 `width?: number | string` 和 `height?: number | string` 字段，用于控制 Web 组件的尺寸。

#### Scenario: Web component uses style width/height when set
- **WHEN** `WebviewStyle.width = 400` 且 `WebviewStyle.height = 300`
- **THEN** Web 组件 SHALL 使用 `.width(400)` 和 `.height(300)`

#### Scenario: Web component defaults to 100% when width/height not set
- **WHEN** `WebviewStyle.width` 为 `undefined` 且 `WebviewStyle.height` 为 `undefined`
- **THEN** Web 组件 SHALL 使用 `.width("100%")` 和 `.height("100%")`（向下兼容）

### Requirement: OHA Webview SHALL expose set_bounds NAPI method
`openharmony_ability::Webview` 结构体 SHALL 新增 `set_bounds(&self, x: f64, y: f64, width: f64, height: f64) -> Result<()>` 方法，通过 NAPI 调用 ArkTS 控制器的 `setBounds` 方法。

#### Scenario: Rust calls set_bounds
- **WHEN** Rust 调用 `webview.set_bounds(100.0, 50.0, 400.0, 300.0)`
- **THEN** SHALL 通过 NAPI 调用 ArkTS `ret.controller.setBounds(100, 50, 400, 300)`
- **AND** `setBounds` SHALL 调用 `applyStyle({ x: 100, y: 50, width: 400, height: 300 })`

#### Scenario: set_bounds fails when main thread env unavailable
- **WHEN** `get_main_thread_env()` 返回 `None` 时调用 `set_bounds`
- **THEN** SHALL 返回 `Error::from_reason("Failed to get main thread env")`

### Requirement: ArkHelper SHALL attach setBounds to controller
`ArkHelper.ets` 的 `createWebview` 和 `createEmbeddedWebview` SHALL 在 `ret.controller` 上挂载 `setBounds(x: number, y: number, width: number, height: number)` 方法。

#### Scenario: setBounds on normal webview
- **WHEN** 通过 `createWebview` 创建 webview 后调用 `controller.setBounds(0, 0, 800, 600)`
- **THEN** SHALL 调用 `applyStyle({ x: 0, y: 0, width: 800, height: 600 })`
- **AND** `applyStyle` SHALL 调用 `targetController.updateWebviewStyle(webTag, style)` 触发重渲染

#### Scenario: setBounds on embedded webview
- **WHEN** 通过 `createEmbeddedWebview` 创建 webview 后调用 `controller.setBounds(0, 0, 400, 300)`
- **THEN** SHALL 调用 `applyStyle({ x: 0, y: 0, width: 400, height: 300 })`
- **AND** `applyStyle` SHALL 调用 `manager.updateWebviewStyle(webTag, style)` 触发重渲染

### Requirement: DefaultWebview SHALL parameterize width and height
`DefaultWebview.ets` 的 `WebBuilder` 和 `EmbeddedWebBuilder` SHALL 将 `.width("100%")` 和 `.height("100%")` 改为读取 `data.style?.width ?? "100%"` 和 `data.style?.height ?? "100%"`。

#### Scenario: Width/height from style
- **WHEN** `data.style.width = 400` 且 `data.style.height = 300`
- **THEN** Web 组件 SHALL 渲染为 `.width(400)` 和 `.height(300)`

#### Scenario: Default 100% fallback
- **WHEN** `data.style.width` 和 `data.style.height` 均为 `undefined`
- **THEN** Web 组件 SHALL 渲染为 `.width("100%")` 和 `.height("100%")`
- **AND** 与修改前行为一致（向下兼容）

### Requirement: JsHelper interface SHALL include setBounds method
`Utils.ets` 的 `JsHelper` 接口 SHALL 新增 `setBounds: (x: number, y: number, width: number, height: number) => void` 方法签名，使 `ProxyJsHelper` 和 `buildJsHelper` 返回的对象均需实现此方法。

#### Scenario: ProxyJsHelper caches setBounds when controller not ready
- **WHEN** controller 未就绪时调用 `proxy.setBounds(0, 0, 800, 600)`
- **THEN** `ProxyJsHelper` SHALL 将操作缓存到 `pendingOperations`
- **AND** 当 `bindToRealController` 被调用时 SHALL 回放 `setBounds(0, 0, 800, 600)` 到真实 controller

#### Scenario: buildJsHelper returns object with setBounds stub
- **WHEN** `buildJsHelper(controller)` 返回 `JsHelper` 对象
- **THEN** 返回对象 SHALL 包含 `setBounds` no-op 桩函数（随后被 `ArkHelper.ets` 覆盖为真实实现）

### Requirement: EmbeddedWebBuilder SHALL support position
`DefaultWebview.ets` 的 `EmbeddedWebBuilder` SHALL 在外部 Stack 容器上添加 `.position({ x: data.style?.x ?? 0, y: data.style?.y ?? 0 })`，与 `WebBuilder` 保持一致。

#### Scenario: Embedded webview positioned via style
- **WHEN** `createEmbeddedWebview` 创建 webview 且 `data.style.x = 100`、`data.style.y = 50`
- **THEN** Stack 容器 SHALL 使用 `.position({ x: 100, y: 50 })`

#### Scenario: Embedded webview default position
- **WHEN** `data.style.x` 和 `data.style.y` 均为 `undefined`
- **THEN** Stack 容器 SHALL 使用 `.position({ x: 0, y: 0 })`
