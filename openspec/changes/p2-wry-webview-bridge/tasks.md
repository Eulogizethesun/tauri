## 1. plugin-webview 补充 action（openharmony-ability 仓库）

- [x] 1.1 在 `crates/plugin-webview/src/lib.rs` 的 `WebviewControllerRequest` 中新增 `x/y/width/height: Option<f64>` 字段
- [x] 1.2 在 `WebviewHandle` 中新增 `async fn set_bounds(&self, x, y, width, height)` 方法（action: `set-bounds`）
- [x] 1.3 新增 `WebviewSetCookieRequest { id, url, value }` NAPI 类型 + `impl_bridge_napi_type!`
- [x] 1.4 在 `WebviewHandle` 中新增 `async fn set_cookie(&self, url, value)` 方法（action: `set-cookie`）
- [x] 1.5 在 `WebviewHandle` 中新增 `async fn print(&self, path)` 方法（action: `print`，复用 `WebviewPrintRequest`）
- [x] 1.6 新增 `WebviewClient::from_bridge(bridge: BridgeRuntime) -> Self` 构造器
- [x] 1.7 将 `controller::native_tag_for()` 改为 `pub`（供 wry devtools legacy 调用使用）
- [x] 1.8 在 ArkTS `WebviewPlugin.ets` 中实现 `set-bounds` / `set-cookie` / `print` 三个 action handler
- [ ] 1.9 重建 HAR 包（`ohrs build --arch arm64` + `pack.bat`）

## 2. tao 跨仓入口暴露

- [x] 2.1 在 `tao/src/platform/ohos.rs` 的 `WindowExtOpenHarmony` trait 中新增 `fn bridge_runtime(&self) -> openharmony_ability::BridgeRuntime`
- [x] 2.2 在 `tao/src/platform_impl/ohos/mod.rs` 的 `Window` 上新增 `pub(crate) fn bridge_runtime(&self) -> Result<BridgeRuntime>` 访问器（内部调 `self.app.bridge()`），因为 `app` 字段是模块私有，`src/platform/ohos.rs` 无法直接访问
- [x] 2.3 在 `tao/src/platform/ohos.rs` 的 `WindowExtOpenHarmony for Window` impl 中通过 `self.window.bridge_runtime()` 获取（委托到 platform_impl 访问器）
- [x] 2.4 确认 `OpenHarmonyApp::bridge()` 是 `pub`（plugin-webview `WebviewClient::new` 已使用）

## 3. tauri-runtime-wry 传递 BridgeRuntime

- [x] 3.1 在 `crates/tauri-runtime-wry/src/lib.rs` OHOS 分支中调用 `window.bridge_runtime()` 获取 `BridgeRuntime`
- [x] 3.2 通过 `webview_builder.with_bridge_runtime(runtime)` 传入 wry builder

## 4. wry Cargo.toml 依赖

- [x] 4.1 在 `wry/Cargo.toml` 的 `[target.'cfg(target_env = "ohos")'.dependencies]` 中新增 `openharmony-ability-plugin-webview` 依赖
- [x] 4.2 在 `wry/Cargo.toml` 的 `[target.'cfg(target_env = "ohos")'.dependencies]` 中新增 `tokio = { version = "1", features = ["rt"] }`

## 5. wry 类型变更

- [x] 5.1 将 `OhosWebviewHandle` 从 `openharmony_ability::Webview` 重定义为 `openharmony_ability_plugin_webview::WebviewHandle`
- [x] 5.2 更新 `InnerWebView` struct：移除 `webview: Webview`，新增 `handle: Arc<OnceCell<WebviewHandle>>` / `runtime: BridgeExecutor` / `url_cache: Mutex<String>` / `devtools_open: AtomicBool`
- [x] 5.3 更新 `PlatformSpecificWebViewAttributes`（OHOS cfg）：新增 `bridge_runtime: Option<BridgeRuntime>` 字段
- [x] 5.4 在 `WebViewBuilderExtOhos` trait 中新增 `with_bridge_runtime(self, runtime: BridgeRuntime) -> Self` 方法 + impl

## 6. wry BridgeExecutor 实现

- [x] 6.1 定义 `BridgeExecutor` struct（`handle: tokio::runtime::Handle`, `main_thread_id: ThreadId`）
- [x] 6.2 实现 `BridgeExecutor::new()` — 创建 current-thread runtime + 后台线程 `ohos-wry-bridge-rt` 驱动
- [x] 6.3 实现 `BridgeExecutor::spawn<F: Future + Send>(&self, future: F)` 方法

## 7. wry InnerWebView::new_inner 重写

- [x] 7.1 从 `pl_attrs.bridge_runtime` 构造 `WebviewClient`（via `from_bridge`）
- [x] 7.2 创建 `BridgeExecutor` 实例
- [x] 7.3 注册反向回调（`WebviewCallbacksBuilder`）— navigation / title / download-start / download-end / page-begin / page-end / new-window / drag 4 事件
- [x] 7.4 注册 custom protocols（`WebviewClient::custom_protocol_async`）
- [x] 7.5 构建 `WebviewCreateRequest`（style / url / html / scripts / flags）
- [x] 7.6 spawn `client.create(create_req)` 在 BridgeExecutor 上（延迟 attach 模式）
- [x] 7.7 实现 `PendingOp` enum + `pending_ops: Mutex<Vec<PendingOp>>` 队列（**TOCTOU 守卫**：方法调用锁内检查 handle.get()，create 完成锁内 set+drain）
- [x] 7.8 create 完成后回放 pending ops（持有 pending_ops 锁时 set handle + drain，释放锁后 spawn 回放）
- [x] 7.9 注册 IPC handler（`WebviewJavascriptProxyBuilder`）
- [x] 7.10 保留 https 拦截（通过 `on_https_intercept_request` 回调 + `register_https_intercept` 注册）

## 8. wry 方法迁移（Pattern A: fire-and-forget）

- [x] 8.1 迁移 `load_url` → `handle.load_url` (spawn)
- [x] 8.2 迁移 `load_url_with_headers` → `handle.load_url_with_headers` (spawn, headers 转换)
- [x] 8.3 迁移 `load_html` → `handle.load_html` (spawn)
- [x] 8.4 迁移 `reload` → `handle.reload` (spawn)
- [x] 8.5 迁移 `zoom` → `handle.set_zoom` (spawn)
- [x] 8.6 迁移 `set_background_color` → `handle.set_background_color` (spawn, RGBA → color string)
- [x] 8.7 迁移 `set_visible` → `handle.set_visible` (spawn)
- [x] 8.8 迁移 `set_bounds` → `handle.set_bounds` (spawn, 新增 action)
- [x] 8.9 迁移 `focus` → `handle.focus` (spawn)
- [x] 8.10 迁移 `focus_parent` → `handle.focus` (spawn, OHOS 无 parent focus)
- [x] 8.11 迁移 `clear_all_browsing_data` → `handle.clear_all_browsing_data` (spawn)
- [x] 8.12 迁移 `set_cookie` → `handle.set_cookie` (spawn, 新增 action)
- [x] 8.13 迁移 `print` → `handle.create_pdf` + `handle.print` (spawn, 新增 print action)
- [x] 8.14 迁移 `dispose_child` → `handle.remove` (spawn)

## 9. wry 方法迁移（Pattern B: callback）

- [x] 9.1 迁移 `eval` → `handle.evaluate_script` (spawn, 回调异步触发)
- [x] 9.2 迁移 `create_pdf` → `handle.create_pdf` (spawn, 回调异步触发)

## 10. wry 方法迁移（Pattern C: cached）

- [x] 10.1 `url()` 返回 `url_cache`（从 page-begin/end 事件更新）
- [x] 10.2 `bounds()` 返回 `bounds_cache`（已有，不变）
- [x] 10.3 `is_devtools_open()` 返回 `devtools_open: AtomicBool`
- [x] 10.4 `open_devtools()` 调用 bridge action `set_web_debugging_access(true)` + `devtools_open.store(true)`
- [x] 10.5 `close_devtools()` 调用 bridge action `set_web_debugging_access(false)` + `devtools_open.store(false)`
- [x] 10.6 `id()` 返回本地 `self.id`（不变）

## 11. wry 方法迁移（Pattern D: blocking-from-worker）

- [x] 11.1 迁移 `cookies_for_url` → spawn + oneshot + `recv_timeout(3s)`，主线程降级返回空 vec
- [x] 11.2 迁移 `cookies` → 先从 cache 获取 url 再 async 获取 cookies，主线程降级
- [x] 11.3 `delete_cookie` 保持 no-op（OHOS 无单 cookie 删除）

## 12. wry 导入清理

- [x] 12.1 移除 `use openharmony_ability::{WebViewBuilder, WebViewStyle, Webview, DragDropEvent as AbilityDragDropEvent, Either}` 旧导入
- [x] 12.2 新增 `use openharmony_ability_plugin_webview::{WebviewClient, WebviewHandle, WebviewCallbacksBuilder, WebviewCreateRequest, WebviewStyle, ...}` 导入
- [x] 12.3 `PdfConfig` 定义为本地 struct（bridge API 使用固定 A4 配置，不需要旧 `openharmony_ability::PdfConfig`）
- [x] 12.4 `controller` 模块已设为 `pub`，`native_tag_for` 可用

## 13. WebViewExtOhos 适配

- [x] 13.1 更新 `WebViewExtOhos::webview_handle()` 返回 `WebviewHandle`（从 `handle.get()` clone，未就绪时从 `client.handle()` 构造 facade）
- [x] 13.2 处理 handle 未就绪时 `webview_handle()` 的返回（返回 facade handle，方法调用会被 dispatch_or_queue 排队）

## 14. 验证

- [x] 14.1 `cargo check --target aarch64-unknown-linux-ohos -p wry` 编译通过（0 error）
- [x] 14.2 `cargo check` (Windows host) 编译通过 — 确认不影响其他平台
- [x] 14.2b `cargo check --target aarch64-unknown-linux-ohos -p tauri-runtime-wry` 编译通过（0 error）
- [ ] 14.3 设备端 load_url 功能验证
- [ ] 14.4 设备端 evaluate_script 功能验证（含回调）
- [ ] 14.5 设备端 navigation handler 验证（拦截生效）
- [ ] 14.6 设备端 download 验证（start + end 回调）
- [ ] 14.7 设备端 title change 验证
- [ ] 14.8 设备端 drag-drop 验证（4 事件）
- [ ] 14.9 设备端 new-window 验证（Allow/Deny）
- [ ] 14.10 设备端 cookies_for_url 验证（从 worker 线程调用）
- [ ] 14.11 设备端 print 验证（PDF 生成 + 打印）
- [ ] 14.12 设备端 custom protocol 验证（加载 tauri:// 资源）
- [ ] 14.13 设备端 https scheme 验证（on_https_intercept_request 回调）
- [ ] 14.14 设备端 create 延迟 attach 验证（webview 创建后操作正确执行）
