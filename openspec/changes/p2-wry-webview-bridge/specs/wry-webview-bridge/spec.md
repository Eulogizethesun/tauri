# wry-webview-bridge spec

## Purpose

将 wry 的 OHOS webview 后端从旧的 `openharmony_ability::Webview` / `WebViewBuilder` 直接 NAPI 模型重写为 `openharmony-ability-plugin-webview` facade（`WebviewClient` + `WebviewHandle` + `WebviewCallbacksBuilder`）。覆盖类型变更、方法映射、反向回调映射、同步/异步适配、跨仓入口传递。

## Requirements

### REQ-001: OhosWebviewHandle 类型重定义

`OhosWebviewHandle` 必须从 `openharmony_ability::Webview` 重定义为 `openharmony_ability_plugin_webview::WebviewHandle`。

```rust
// wry/src/ohos/mod.rs
pub type OhosWebviewHandle = openharmony_ability_plugin_webview::WebviewHandle;
```

`WebViewExtOhos::webview_handle()` 返回 `WebviewHandle`（`Clone + Send + Sync`），调用方（tauri-runtime-wry `web_page_snapshot`）无需改动。

### REQ-002: InnerWebView 字段更新

`InnerWebView` 必须用 `WebviewHandle` 替代 `Webview`，并新增缓存字段：

- `handle: Arc<tokio::sync::OnceCell<WebviewHandle>>`（延迟 attach，见 REQ-008）
- `pending_ops: Mutex<Vec<PendingOp>>`（新增，create 完成前的操作队列，同时作为 handle 就绪检查的守卫锁，见 REQ-008）
- `runtime: BridgeExecutor`（后台 tokio runtime，spawn async bridge calls）
- `page_loaded: Arc<AtomicBool>`（保留，从 page-end 更新）
- `url_cache: Mutex<String>`（新增，从 page-begin/end 事件更新，供 `url()` 同步返回）
- `bounds_cache: Mutex<Rect>`（保留）
- `devtools_open: AtomicBool`（新增，缓存 devtools 状态）
- `is_child: bool` / `disposed: AtomicBool`（保留）

旧字段 `webview: Webview` 必须移除。

### REQ-003: PlatformSpecificWebViewAttributes 扩展

`PlatformSpecificWebViewAttributes`（OHOS cfg）必须新增 `bridge_runtime: Option<BridgeRuntime>` 字段。

`WebViewBuilderExtOhos` trait 必须新增 `with_bridge_runtime(self, runtime: BridgeRuntime) -> Self` 方法。

`InnerWebView::new_inner()` 必须从 `pl_attrs.bridge_runtime` 获取 `BridgeRuntime`，缺失时返回 `Error::OpenHarmonyInitError`。

### REQ-004: 跨仓 BridgeRuntime 传递

**tao** (`src/platform/ohos.rs`)：`WindowExtOpenHarmony` trait 必须新增 `fn bridge_runtime(&self) -> openharmony_ability::BridgeRuntime`。实现从 `self.window.app.bridge()` 获取（`app` 是 `pub(crate)` 但 impl 在同 crate）。

**tauri-runtime-wry** (`crates/tauri-runtime-wry/src/lib.rs`)：OHOS 分支必须调用 `window.bridge_runtime()` 并通过 `webview_builder.with_bridge_runtime(runtime)` 传入。

**openharmony-ability** (`crates/plugin-webview/src/lib.rs`)：必须新增 `WebviewClient::from_bridge(bridge: BridgeRuntime) -> Self` 构造器（无需 `OpenHarmonyApp`）。

### REQ-005: BridgeExecutor

wry 必须实现 `BridgeExecutor`（参照 tao B1），用于在后台线程 spawn async bridge calls：

- 后台 current-thread tokio runtime + 独立线程 `ohos-wry-bridge-rt` 驱动
- 存储 `tokio::runtime::Handle`（`Clone + Send + Sync`）
- 存储 `main_thread_id: std::thread::ThreadId`（用于 Pattern D 主线程检查）
- `spawn<F: Future<Output: ()> + Send + 'static>(&self, future: F)` 方法

### REQ-006: 同步/异步适配模式

wry 公共 API 保持同步签名。OHOS 后端内部使用以下四种模式适配 async bridge calls：

| 模式 | 适用 | 行为 |
|------|------|------|
| A: fire-and-forget | 无返回值方法（load_url, load_html, reload, set_bounds, set_visible, set_background_color, set_zoom, focus, clear_all_browsing_data, set_cookie, print, dispose） | `runtime.spawn(async { handle.method().await })`，不等待 |
| B: callback | 有回调参数方法（eval, create_pdf） | `runtime.spawn(async { result = handle.method().await; callback(result) })` |
| C: cached | 需返回值且可从事件推算（url, bounds, is_devtools_open） | 返回缓存值，从反向事件更新 |
| D: async-with-blocking-from-worker | 需返回值且不可缓存（cookies_for_url, cookies） | spawn + oneshot + `recv_timeout(3s)`；主线程调用时返回降级值（空 vec），与 Android 平台一致 |

**死锁禁止**（OHOS constraint §1.2）：主线程（ArkUI JS 线程）禁止 `recv()` 阻塞等待 bridge 返回。Pattern D 必须用 `main_thread_id` 检查守卫，主线程降级返回。

### REQ-007: Outbound 方法映射（全量）

以下 wry 方法必须迁移到对应的 `WebviewHandle` bridge action：

| wry 方法 | WebviewHandle 方法 | bridge action | 适配模式 |
|----------|-------------------|---------------|---------|
| `load_url` | `load_url` | `load-url` | A |
| `load_url_with_headers` | `load_url_with_headers` | `load-url` (headers) | A |
| `load_html` | `load_html` | `load-html` | A |
| `reload` | `reload` | `reload` | A |
| `url` | `url` | `get-url` | C (cached from page events) |
| `eval` | `evaluate_script` / `evaluate_script_with_callback` | `evaluate-script` | B |
| `zoom` | `set_zoom` | `set-zoom` | A |
| `set_background_color` | `set_background_color` | `set-background-color` | A (RGBA → color string) |
| `set_visible` | `set_visible` | `set-visible` | A |
| `set_bounds` | `set_bounds` | `set-bounds` | A (需新增 action) |
| `focus` | `focus` | `focus` | A |
| `focus_parent` | `focus` | `focus` | A (OHOS 无 parent focus) |
| `clear_all_browsing_data` | `clear_all_browsing_data` | `clear-all-browsing-data` | A |
| `cookies` | `url()` + `cookies_with_url()` | `get-url` + `cookies-with-url` | D |
| `cookies_for_url` | `cookies_with_url` | `cookies-with-url` | D |
| `set_cookie` | `set_cookie` | `set-cookie` (需新增 action) | A |
| `delete_cookie` | (no-op) | — | — (OHOS 无单 cookie 删除) |
| `print` | `create_pdf` + `print` | `create-pdf` + `print` (需新增 print action) | A |
| `create_pdf` | `create_pdf` | `create-pdf` | B |
| `open_devtools` | (legacy core NAPI) | — | 保留 `Web::new(tag).set_web_debugging_access(true)` |
| `close_devtools` | (legacy core NAPI) | — | 同上 |
| `is_devtools_open` | (cached) | — | C |
| `dispose_child` | `remove` | `remove` | A |

### REQ-008: 延迟 attach（create 同步性解法）

`InnerWebView::new_inner()` 必须使用延迟 attach 模式，因为 `WebviewClient::create()` 是 async 而 `WebViewBuilder::build()` 是 sync，且主线程禁止阻塞等待 bridge 返回。

- `handle: Arc<OnceCell<WebviewHandle>>` 初始为空
- `new_inner()` 在 BridgeExecutor 上 spawn `client.create(create_req)` future
- create 完成后：`handle.set(result)` + 回放 pending ops
- create 完成前的方法调用缓存在 `pending_ops: Mutex<Vec<PendingOp>>` 队列
- **TOCTOU 守卫**：方法调用必须持有 `pending_ops.lock()` 时检查 `handle.get()`（锁内检查 + 入队/释放锁后 spawn）；create 完成回放也必须持有同一锁时 `handle.set()` + `drain()`。**禁止**先 `get()` 再单独 `lock().push()` —— create 完成可能在两者之间 drain 导致操作丢失

PendingOp enum 覆盖所有 fire-and-forget + callback 方法。create 完成后按顺序回放。

### REQ-009: 反向回调映射

反向回调必须从旧的 `WebViewBuilder::on_*` Function 闭包迁移到 `WebviewCallbacksBuilder`（create 前注册 Rust 闭包）：

| wry 回调 | WebviewCallbacksBuilder 方法 | bridge main-thread event |
|---------|------------------------------|-------------------------|
| `navigation_handler` | `on_navigation_request(Fn(WebviewNavigationRequest) -> bool)` | `navigation-request` |
| `document_title_changed_handler` | `on_title_change(Fn(WebviewTitleChangeEvent))` | `title-change` |
| `download_started_handler` | `on_download_start(Fn(WebviewDownloadStartRequest) -> WebviewDownloadStartResponse)` | `download-start` |
| `download_completed_handler` | `on_download_end(Fn(WebviewDownloadEndEvent))` | `download-end` |
| `on_page_load_handler` (Started) | `on_page_begin(Fn(WebviewPageEvent))` | `page-begin` |
| `on_page_load_handler` (Finished) | `on_page_end(Fn(WebviewPageEvent))` | `page-end` |
| `new_window_req_handler` | `on_new_window_request(Fn(WebviewNewWindowRequest) -> bool)` | `new-window-request` |
| `drag_drop_handler` (Enter) | `on_drag_enter(Fn(WebviewDragEvent))` | `drag-enter` |
| `drag_drop_handler` (Over) | `on_drag_over(Fn(WebviewDragEvent))` | `drag-over` |
| `drag_drop_handler` (Drop) | `on_drag_drop(Fn(WebviewDropEvent))` | `drag-drop` |
| `drag_drop_handler` (Leave) | `on_drag_leave(Fn(WebviewDragEvent))` | `drag-leave` |

**约束**：
- `page_begin` / `page_end` 必须总是注册（即使无 `on_page_load_handler`），用于更新 `page_loaded` + `url_cache`
- `navigation_request` 语义：闭包返回 `true` = 允许导航（wry 语义），bridge facade `navigation_decision()` 自动反转为 `intercept = !result`（OHOS 语义）
- `new_window_request`：`NewWindowResponse::Create` 变体降级为 `Allow`（bridge 只返回 `{ allow: bool }`）
- `drag_drop_handler` 的 `Enter` 事件 paths 为空（ArkWeb `getData()` 仅在 drop 时有效）
- controller 代际隔离由 `callbacks.rs` 内部 `controller::is_current()` 处理，wry 无需关心

### REQ-010: Custom protocols 迁移

custom protocols 必须从旧 `Webview::custom_protocol_async()` 迁移到 `WebviewClient::custom_protocol_async()`（create 前注册）。

**两阶段模型（声明 + 绑定）**：OHOS ArkWeb 要求每个自定义 scheme 先进程级 *声明*，再每 controller *绑定*：
1. **声明**（declare）：`WebviewProtocol::register(scheme, options)`，必须在 Web 引擎初始化前调用。引擎在 `create` 调用内部（`ensureWebEngineInitialized`）懒初始化，因此 wry 在 `new_inner` 的 bind 循环之前同步声明所有 `custom_protocols.keys()` 即满足时序。tauri 的 scheme 列表是运行期（`Builder::run`）才收集的，无法在 `#[ability]` 初始化期声明，故声明点放在 `new_inner` 而非 `#[ability]` 入口。重复声明已声明 scheme 是 no-op，子/第二个 webview 安全。
2. **绑定**（bind）：`WebviewClient::custom_protocol_async(webview_id, scheme, callback)`（create 前注册），内部 `require_declared` 强校验 scheme 已声明，否则抛 `"WebView scheme '<scheme>' was not declared with WebviewProtocol::register"`。

`WebviewProtocolOptions` 取 `Standard | CorsEnabled | CspBypassing | FetchEnabled | CodeCacheEnabled`（与 openharmony-ability demo 一致：自定义协议需可 fetch、绕 CSP、允许 CORS、启用 code cache）。

`WebviewClient::custom_protocol_async(webview_id, scheme, callback)` 签名要求 `callback: Fn(&str, WebviewProtocolRequest, bool, WebviewProtocolResponder) + Send + Sync + 'static`。wry 的 `custom_protocols` 闭包是 `Fn(WebViewId, Request<Vec<u8>>, RequestAsyncResponder)`，需适配：

```rust
// declare (before bind, before engine init)
let options = WebviewProtocolOptions::Standard | /* ... */;
for scheme in custom_protocols.keys() {
  WebviewProtocol::register(scheme, options)?;
}
// bind
client.custom_protocol_async(&id, scheme, move |wid, req, is_main, responder| {
  // WebviewProtocolRequest → http::Request
  // WebviewProtocolResponder → RequestAsyncResponder
  // 调用原 wry callback
})?;
```

**REQ-010a: WebviewBridgePlugin 注册**：`WebviewClient::create` 是经 `WebviewBridgePlugin` 路由的 bridge 调用，Rust 侧必须在该 webview 创建前于 `OpenHarmonyApp` 上注册该插件，否则 `create` 报 "not installed for '<module>'"。wry 通过 `pub use` re-export `WebviewBridgePlugin`，由 `tauri-runtime-wry::set_ohos_window_client`（app setup 期调用）执行 `app.register_plugin(wry::WebviewBridgePlugin)`。ArkTS 侧 `WebviewPlugin` 须在 EntryAbility 的 `bridgePlugins` 列表中（与 Rust 侧对称）。

**REQ-010b: WindowBridgePlugin 注册**：tao 的 OHOS window 操作（`restore_window` / `set_window_decorations` / `show_window` / `move_window_to` / `resize_window` / `set_window_background_color` …）经 `WindowBridgePlugin`（id=`ohos.window`，`openharmony-ability-plugin-window`）路由的 `call_async` 调用。Rust 侧必须注册该插件，否则 ArkTS `configurePlugins` 不会安装 `WindowPlugin`，所有 window op 报 "is not installed for '<module>'"。注册点与 REQ-010a 对称：`tauri-runtime-wry::set_ohos_window_client` 执行 `app.register_plugin(openharmony_ability_plugin_window::WindowBridgePlugin)`。ArkTS 侧 `WindowPlugin` 须在 EntryAbility 的 `bridgePlugins` 列表中。demo（`rust_example/demo_native`）已 `app.register_plugin(WindowBridgePlugin)`，Tauri 层此前漏注册。

**REQ-010c: session_active 时序约束**：`WebviewClient::create`（及任何经 `WebviewBridgePlugin::on_main_thread_event` 的 ArkTS→Rust reverse event，如引擎初始化期的 `seal-engine-schemes` / `before-engine-init` / `controller-attached`）要求 Rust `BridgePluginRegistryState.session_active == true`，否则 `dispatch_main_thread_event`（`bridge/mod.rs`）拒以 "outside an active Ability session"。`session_active` 仅由 `dispatch_lifecycle(AbilityCreated)` 置 true，而 `AbilityCreated` 仅由 NAPI 回调 `on_ability_create`（`lifecycle.rs`）触发。因此 `NativeAbility.onCreate` 的 per-module 循环必须在 `WebviewClient::create`（及 `onWindowStageCreate`）之前调用 `lifecycle.windowStageEventCallback.onAbilityCreate(restoredState)`。注意：`BridgeHostRegistry.activateAbility({kind:"ability-create"})` 只置 ArkTS `abilityReady` 标志并 deliver 给 ArkTS 插件 `onLifecycle`，**不触达** Rust `dispatch_lifecycle`，不能替代 `onAbilityCreate`。这是 NativeAbility 重构时（保留了 `onWindowStageCreate` 的 callback 调用却独漏 `onAbilityCreate`）引入的回归。

### REQ-011: https 拦截保留

https 拦截（`set_https_intercept_handler` + `dispatch_https_intercept_sync`）在 B2 中保留 thread_local 注册模式（不走 bridge）。B3 将迁移到 bridge。

- `dispatch_https_intercept_sync` 函数不变（NAPI 散函数，thread_local registry）
- 注册改为直接写 thread_local `HTTPS_INTERCEPT_REGISTRY`（不再通过旧 `Webview` 方法）

### REQ-012: plugin-webview 补充 action

B2 需要在 plugin-webview 中补充 A1 遗漏的 3 个 action：

1. **`set-bounds`** — `WebviewControllerRequest` 新增 `x/y/width/height: Option<f64>` 字段 + ArkTS handler 调用 `node.update()` 更新 style
2. **`set-cookie`** — 新增 `WebviewSetCookieRequest { id, url, value }` NAPI 类型 + ArkTS handler 调用 `WebCookieManager.configCookieSync`
3. **`print`** — 复用 `WebviewPrintRequest { id, path }` + ArkTS handler 调用 `@ohos.print`

这三个 action 的 Rust facade 方法 + ArkTS 实现属于 B2 范围（openharmony-ability 仓库改动）。

### REQ-013: Cargo.toml 依赖调整

wry `Cargo.toml` 的 OHOS target 必须新增：
```toml
openharmony-ability-plugin-webview = { path = "../openharmony-ability/crates/plugin-webview" }
tokio = { version = "1", features = ["rt"] }
```

### REQ-014: cfg 隔离

所有改动必须在 `#[cfg(target_env = "ohos")]` 内。Windows / macOS / Linux / iOS / Android 编译不受影响。`cargo check`（Windows host）必须 0 error。

### REQ-015: IPC handler

IPC handler（`window.ipc.postMessage`）必须迁移到 `WebviewHandle::on_controller_attach()` + `WebviewJavascriptProxyBuilder`（或保留 `WebProxyBuilder` legacy C-API 路径，标注 TODO）。

`on_controller_attach` 通过 `Web::new(native_tag).on_controller_attach(callback)` 注册，`native_tag` 通过 `controller::native_tag_for(&id)` 获取（需改为 `pub` 或通过 `WebviewHandle` 暴露）。

## Constraints

- **All-or-nothing**: 类型一换全部编译失败，无中间验证点。整体改完 `cargo check` 通过是唯一编译验证点。
- **不修改 wry 公共 API 签名**: `load_url`, `evaluate_script`, `zoom` 等签名保持同步。async 适配在 OHOS 后端内部。
- **不修改 bridge 框架**: `bridge/mod.rs` 不改动，仅消费 plugin-webview facade。
- **主线程不阻塞**: 禁止 `recv()` 阻塞等待 bridge 返回（OHOS constraint §1.2）。
