# Phase B2 技术设计

## 0. 前置上下文

| 组件 | 位置 | 状态 |
|------|------|------|
| plugin-webview facade | `openharmony-ability/crates/plugin-webview/src/lib.rs` | A1 完成，含全部 action |
| WebviewCallbacksBuilder | `openharmony-ability/crates/plugin-webview/src/callbacks.rs` | A1 完成，含 drag/new-window/page/close-window |
| BridgeRuntime | `openharmony-ability/crates/ability/src/bridge/mod.rs` | A0 完成，TSFN + Promise + oneshot |
| tao B1 (BridgeExecutor) | `tao/src/platform_impl/ohos/mod.rs` | B1 完成，可参考 |
| wry OHOS 旧实现 | `wry/src/ohos/mod.rs` (822 行) | 本次重写目标 |

---

## 1. 类型变更

### 1.1 OhosWebviewHandle 重定义

```rust
// 旧 (wry/src/ohos/mod.rs:27)
pub type OhosWebviewHandle = openharmony_ability::Webview;

// 新
pub type OhosWebviewHandle = openharmony_ability_plugin_webview::WebviewHandle;
```

`WebviewHandle` 是 `{ client: WebviewClient, id: String }`，`Clone + Send + Sync`。公开 API `WebViewExtOhos::webview_handle()` 返回类型随之变更，调用方（tauri-runtime-wry `lib.rs:4331`）无需改动——`web_page_snapshot` 等消费方仅依赖 `Clone`。

### 1.2 InnerWebView 字段更新

```rust
// 旧
pub struct InnerWebView {
  id: String,
  pub(crate) webview: Webview,                    // 旧 NAPI ObjectRef 包装
  page_loaded: Arc<AtomicBool>,
  bounds_cache: Mutex<Rect>,
  is_child: bool,
  disposed: AtomicBool,
}

// 新
pub struct InnerWebView {
  id: String,
  pub(crate) handle: WebviewHandle,               // 新 bridge 句柄
  runtime: BridgeExecutor,                        // 后台 tokio runtime（spawn async bridge calls）
  page_loaded: Arc<AtomicBool>,
  url_cache: Mutex<String>,                       // 新：从 page-begin/end 事件缓存 URL
  bounds_cache: Mutex<Rect>,
  devtools_open: AtomicBool,                      // 新：缓存 set_web_debugging_access 状态
  is_child: bool,
  disposed: AtomicBool,
}
```

**设计决策**：
- `WebviewHandle` 替代 `Webview`，是唯一的 ArkWeb 操作入口
- `BridgeExecutor` 参照 tao B1 设计：后台 current-thread tokio runtime + 独立线程 `ohos-wry-bridge-rt` 驱动
- `url_cache` 新增：因 `WebviewHandle::url()` 是 async，而 wry `WebView::url()` 是 sync → 返回缓存值（从 page-begin/page-end 反向事件更新）
- `devtools_open` 新增：因 `WebviewHandle` 无 `is_web_debugging_access()` sync 方法 → 缓存 `set_visible(true/false)` 的最后值

### 1.3 PlatformSpecificWebViewAttributes 扩展

```rust
// wry/src/lib.rs (OHOS cfg 块)
pub struct PlatformSpecificWebViewAttributes {
  pub window_id: Option<i64>,
  pub use_https: bool,
  pub drag_drop_overlay: bool,
  pub bridge_runtime: Option<openharmony_ability::BridgeRuntime>,  // 新增
}
```

新增 builder 方法：
```rust
pub trait WebViewBuilderExtOhos {
  fn with_window_id(self, window_id: i64) -> Self;
  fn with_https_scheme(self, enabled: bool) -> Self;
  fn with_drag_drop_overlay(self, enabled: bool) -> Self;
  fn with_bridge_runtime(self, runtime: BridgeRuntime) -> Self;     // 新增
}
```

### 1.4 跨仓入口：BridgeRuntime 传递链

**问题**：wry `InnerWebView::new()` 仅接收 `&impl HasWindowHandle` + attrs，无 `OpenHarmonyApp`。新 `WebviewClient::new()` 需要 `&OpenHarmonyApp`（内部调 `app.bridge()`）。

**方案**：通过 `PlatformSpecificWebViewAttributes.bridge_runtime` 字段传递。

```
tao EventLoop (持有 OpenHarmonyApp)
  └─ Window.app (crate-private) → WindowExtOpenHarmony::bridge_runtime() [新增]
       └─ tauri-runtime-wry build_webview() 调用 window.bridge_runtime()
            └─ wry WebViewBuilderExtOhos::with_bridge_runtime(runtime)
                 └─ wry InnerWebView 从 runtime 构造 WebviewClient
```

**tao 改动**（`tao/src/platform/ohos.rs` + `tao/src/platform_impl/ohos/mod.rs`）：

> **已修复**：原始设计写 `self.window.app.bridge()`，但 `platform_impl::ohos::Window.app` 字段无可见性修饰符（模块私有），`src/platform/ohos.rs` 在不同模块中无法直接访问。必须在 platform_impl Window 上新增 `pub(crate)` 访问器方法。

```rust
// tao/src/platform_impl/ohos/mod.rs — Window 上新增访问器
impl Window {
  pub(crate) fn bridge_runtime(&self) -> openharmony_ability::Result<openharmony_ability::BridgeRuntime> {
    self.app.bridge()
  }
}

// tao/src/platform/ohos.rs
pub trait WindowExtOpenHarmony {
  fn content_rect(&self) -> Rect;
  fn config(&self) -> Configuration;
  fn window_id(&self) -> Option<i64>;
  fn bridge_runtime(&self) -> openharmony_ability::BridgeRuntime;  // 新增
}

impl WindowExtOpenHarmony for Window {
  fn bridge_runtime(&self) -> openharmony_ability::BridgeRuntime {
    self.window.bridge_runtime()
      .expect("BridgeRuntime not available — EventLoop not initialized")
  }
}
```

`OpenHarmonyApp::bridge()` 已是 `pub` 方法（返回 `Result<BridgeRuntime>`，plugin-webview `WebviewClient::new` 已使用）。但 `platform_impl::ohos::Window.app` 字段是模块私有（无 `pub(crate)` 修饰符），`src/platform/ohos.rs` 中的 `WindowExtOpenHarmony` impl 在不同模块中无法直接访问该字段。因此必须在 platform_impl Window 上新增 `pub(crate) fn bridge_runtime(&self) -> Result<BridgeRuntime>` 访问器（内部调 `self.app.bridge()`），公开 trait 方法委托到该访问器。

**plugin-webview 改动**（`crates/plugin-webview/src/lib.rs`）：
```rust
impl WebviewClient {
  pub fn from_bridge(bridge: BridgeRuntime) -> Self {
    Self { bridge }
  }
}
```

`WebviewClient` 的 `bridge` 字段是 private，但 `from_bridge` 是同模块内的构造器。wry 通过 `WebviewClient::from_bridge(runtime)` 构造，无需 `OpenHarmonyApp`。

**tauri-runtime-wry 改动**（`crates/tauri-runtime-wry/src/lib.rs` OHOS 分支）：
```rust
#[cfg(target_env = "ohos")]
{
  use tao::platform::ohos::WindowExtOpenHarmony;
  webview_builder = webview_builder
    .with_window_id(window_id.unwrap_or(0))
    .with_https_scheme(webview_attributes.use_https_scheme)
    .with_drag_drop_overlay(webview_attributes.drag_drop_overlay)
    .with_bridge_runtime(window.bridge_runtime());  // 新增
}
```

---

## 2. 同步/异步适配策略

### 2.1 核心矛盾

| wry 公共 API | WebviewHandle 方法 | 矛盾 |
|-------------|-------------------|------|
| `pub fn load_url(&self, url: &str) -> Result<()>` | `pub async fn load_url(&self, url) -> Result<()>` | sync vs async |
| `pub fn url(&self) -> Result<String>` | `pub async fn url(&self) -> Result<String>` | sync 需返回值 |

OHOS 约束 §1.2：**禁止** `run_on_main_thread + rx.recv()` 阻塞模式——ArkUI JS 线程阻塞会导致 TSFN callback 无法执行 → 死锁。

### 2.2 四种适配模式

#### Pattern A: fire-and-forget（无返回值，spawn 后不等待）

适用于 wry 方法签名 `-> Result<()>` 且调用方不依赖返回值的方法。

```rust
pub fn load_url(&self, url: &str) -> Result<()> {
  let handle = self.handle.clone();
  let url = url.to_string();
  self.runtime.spawn(async move {
    if let Err(e) = handle.load_url(url).await {
      log::warn!("[wry] load_url bridge call failed: {}", e);
    }
  });
  Ok(())
}
```

`BridgeExecutor::spawn()` 在后台 tokio runtime 上 poll future，TSFN callback 在 ArkTS 主线程执行 → 无死锁（参照 tao B1 `BridgeExecutor`）。

#### Pattern B: callback（已有回调参数，spawn 后异步触发回调）

适用于 wry 方法签名包含 `callback: impl Fn(...) + Send + 'static` 的方法。

```rust
pub fn eval(&self, js: &str, callback: Option<impl Fn(String) + Send + 'static>) -> Result<()> {
  let handle = self.handle.clone();
  let js = js.to_string();
  self.runtime.spawn(async move {
    match handle.evaluate_script(js).await {
      Ok(result) => {
        if let Some(cb) = callback {
          cb(result.unwrap_or_default());
        }
      }
      Err(e) => log::warn!("[wry] evaluate_script bridge call failed: {}", e),
    }
  });
  Ok(())
}
```

#### Pattern C: cached（返回缓存值，从反向事件更新）

适用于 wry 方法签名 `-> Result<T>` 且 T 可从反向事件推算的方法。

| 方法 | 缓存源 | 更新时机 |
|------|--------|---------|
| `url()` | `url_cache: Mutex<String>` | page-begin / page-end 事件 |
| `bounds()` | `bounds_cache: Mutex<Rect>`（已有） | `set_bounds()` 调用 |
| `is_devtools_open()` | `devtools_open: AtomicBool` | `open_devtools()` / `close_devtools()` |

```rust
pub fn url(&self) -> Result<String> {
  Ok(self.url_cache.lock().unwrap().clone())
}
```

**行为变更**：`url()` 返回最后一次 page-begin/end 的 URL，而非实时查询。这与 Android 平台行为一致（Android 也有类似缓存/降级）。调用方（tauri-runtime-wry）仅在 `webview_handle()` 快照场景使用，不依赖实时性。

#### Pattern D: async-with-blocking-from-worker（需同步返回值且不可缓存）

仅适用于 `cookies_for_url()` / `cookies()` / `set_cookie()`。这些方法在 bridge 上无 sync 路径，且无法从事件推算。

**策略**：spawn async call + `oneshot::channel` + `recv_timeout(3s)`。**仅当不在 ArkUI 主线程时可用**——用 `main_thread_id` 检查守卫，主线程调用返回降级值。

```rust
pub fn cookies_for_url(&self, url: &str) -> Result<Vec<Cookie<'static>>> {
  if std::thread::current().id() == self.runtime.main_thread_id() {
    // 主线程阻塞会死锁 TSFN → 降级返回空（与 Android 一致）
    log::warn!("[wry] cookies_for_url called on main thread — returning empty (degraded)");
    return Ok(vec![]);
  }
  let handle = self.handle.clone();
  let url = url.to_string();
  let (tx, rx) = std::sync::mpsc::channel::<String>();
  self.runtime.spawn(async move {
    let result = handle.cookies_with_url(url).await;
    let _ = tx.send(result.unwrap_or_default());
  });
  let cookie_str = rx.recv_timeout(std::time::Duration::from_secs(3))
    .map_err(|_| Error::OpenHarmonyWebviewError("cookies_for_url timed out".into()))?;
  // parse cookie_str → Vec<Cookie>（复用现有解析逻辑）
  ...
}
```

`main_thread_id` 在 `BridgeExecutor::new()` 中记录（`std::thread::current().id()`），与 `BridgeClient::main_thread_id` 同模式（见 `bridge/mod.rs:798`）。

**安全性**：Tauri 命令处理器运行在 tokio runtime worker 线程（非 ArkUI 主线程），`cookies_for_url` 在此场景下可安全阻塞。wry 事件循环回调（page-load handler 等）运行在主线程，但这些回调不调用 cookies 方法。

---

## 3. 方法映射（全量）

### 3.1 Outbound 方法（Rust → ArkTS，24 个）

| # | wry 方法 | 旧实现 (`Webview::*`) | 新实现 (`WebviewHandle::*`) | bridge action | 适配模式 | 备注 |
|---|---------|----------------------|----------------------------|---------------|---------|------|
| 1 | `load_url` | `.load_url(url)` | `.load_url(url)` | `load-url` | A (fire-and-forget) | |
| 2 | `load_url_with_headers` | `.load_url_with_headers(url, headers)` | `.load_url_with_headers(url, headers)` | `load-url` (headers 字段) | A | headers 从 `http::HeaderMap` 转 `BTreeMap<String,String>` |
| 3 | `load_html` | `.load_html(html)` | `.load_html(html)` | `load-html` | A | |
| 4 | `reload` | `.reload()` | `.reload()` | `reload` | A | |
| 5 | `url` | `.url()` | `.url()` | `get-url` | C (cached) | 从 page-begin/end 缓存 |
| 6 | `eval` | `.evaluate_script_with_callback(js, cb)` | `.evaluate_script(js)` / `.evaluate_script_with_callback(js, cb)` | `evaluate-script` | B (callback) | |
| 7 | `zoom` | `.set_zoom(scale)` | `.set_zoom(zoom)` | `set-zoom` | A | |
| 8 | `set_background_color` | `.set_background_color(u32)` | `.set_background_color(color: String)` | `set-background-color` | A | RGBA → `"#AARRGGBB"` 字符串转换 |
| 9 | `set_visible` | `.set_visible(bool)` | `.set_visible(visible)` | `set-visible` | A | |
| 10 | `set_bounds` | `.set_bounds(x, y, w, h)` | 无直接对应 | 通过 `WebviewControllerRequest` | A | 见 3.2 节 |
| 11 | `focus` | `.focus()` | `.focus()` | `focus` | A | |
| 12 | `focus_parent` | `.focus()` | `.focus()` | `focus` | A | OHOS 无独立 parent focus，与 focus 同 |
| 13 | `clear_all_browsing_data` | `.clear_all_browsing_data()` | `.clear_all_browsing_data()` | `clear-all-browsing-data` | A | |
| 14 | `cookies` | `.url()` + `cookies_for_url(url)` | `.url()` + `.cookies_with_url(url)` | `get-url` + `cookies-with-url` | D (blocking) | 先 async 获取 url 再 async 获取 cookies；主线程降级 |
| 15 | `cookies_for_url` | `.cookies_with_url(url)` | `.cookies_with_url(url)` | `cookies-with-url` | D (blocking) | |
| 16 | `set_cookie` | `.set_cookie(url, value)` | 无直接 action | 需新增 `set-cookie` action | A | 见 3.3 节 |
| 17 | `delete_cookie` | no-op | no-op | 无 | — | OHOS 无单 cookie 删除，保持 no-op |
| 18 | `print` | `.print(path)` | `.create_pdf(path)` + 生成 PDF + `print` action | `create-pdf` | A + 回调 | 见 3.4 节 |
| 19 | `create_pdf` | `.create_pdf(path, config, cb)` | `.create_pdf(path)` | `create-pdf` | B (callback) | `PdfConfig` 暂用固定 A4（facade 不支持自定义 config） |
| 20 | `open_devtools` | `.set_web_debugging_access(true)` | 无 bridge action | 保留 legacy core NAPI | — | 见 3.5 节 |
| 21 | `close_devtools` | `.set_web_debugging_access(false)` | 无 bridge action | 保留 legacy core NAPI | — | |
| 22 | `is_devtools_open` | `.is_web_debugging_access()` | 无 bridge action | 缓存 `devtools_open: AtomicBool` | C | |
| 23 | `dispose_child` | `.dispose()` | `.remove()` | `remove` | A | |
| 24 | `id` | 本地 `self.id` | 本地 `self.id` | — | — | 不变 |

### 3.2 set_bounds 特殊处理

`WebviewHandle` 没有 `set_bounds` 方法——bounds 在 create 请求的 `WebviewStyle` 中设置，运行时变更 bounds 需要通过 `WebviewControllerRequest`。

**方案**：复用 `WebviewHandle` 的内部 `acknowledge` 机制。但 `WebviewControllerRequest` 当前只有 `visible/color/url/html/headers/zoom` 字段，无 `bounds` 字段。

**B2 方案**：在 plugin-webview 的 `WebviewControllerRequest` 中新增 `bounds: Option<WebviewBounds>` 字段 + `set-bounds` action。或者更简单：wry 在 OHOS 后端直接调用 `WebviewHandle` 的（新增）`set_bounds` 便利方法，内部组装 `WebviewControllerRequest`。

> **决策**：B2 在 plugin-webview 中新增 `set-bounds` action（`WebviewControllerRequest` 增加 `x/y/width/height` 字段）。这是 A1 范围的补充（A1 清单未提及 bounds），但属于 B2 必需的前置。改动量 ~20 行（Rust facade + ArkTS handler）。

```rust
// plugin-webview: WebviewControllerRequest 新增字段
pub struct WebviewControllerRequest {
  pub id: String,
  pub visible: Option<bool>,
  pub color: Option<String>,
  pub url: Option<String>,
  pub html: Option<String>,
  pub headers: Option<BTreeMap<String, String>>,
  pub zoom: Option<f64>,
  pub x: Option<f64>,        // 新增
  pub y: Option<f64>,        // 新增
  pub width: Option<f64>,   // 新增
  pub height: Option<f64>,  // 新增
}

// WebviewHandle 新增方法
impl WebviewHandle {
  pub async fn set_bounds(&self, x: f64, y: f64, width: f64, height: f64) -> Result<()> {
    self.acknowledge("set-bounds", WebviewControllerRequest {
      x: Some(x), y: Some(y), width: Some(width), height: Some(height),
      ..self.controller_request()
    }).await
  }
}
```

### 3.3 set_cookie 特殊处理

`WebviewHandle` 当前无 `set_cookie` / `set-cookie` action。旧实现调用 `Webview::set_cookie(url, value)` 同步写入 `WebCookieManager.configCookieSync`。

**B2 方案**：在 plugin-webview 中新增 `set-cookie` action（`WebviewControllerRequest` 无法表达，需独立 request 类型）。

```rust
// plugin-webview: 新增
#[napi(object)]
pub struct WebviewSetCookieRequest {
  pub id: String,
  pub url: String,
  pub value: String,  // Set-Cookie 格式
}
impl_bridge_napi_type!(WebviewSetCookieRequest, "ohos.webview.SetCookieRequest");

impl WebviewHandle {
  pub async fn set_cookie(&self, url: String, value: String) -> Result<()> {
    self.client.call::<_, WebviewAcknowledgement>("set-cookie",
      WebviewSetCookieRequest { id: self.id.clone(), url, value }).await?.ensure()
  }
}
```

wry 端 `set_cookie` 方法使用 Pattern A（fire-and-forget spawn）。

### 3.4 print 特殊处理

旧 `print()` 流程：1) 生成 temp PDF 路径 → 2) `Webview::print(path)` → ArkTS `print(path)` 调用 `@ohos.print`。

新流程：1) `WebviewHandle::create_pdf(path)` 生成 PDF → 2) 调用 `@ohos.print` print action。但 plugin-webview facade 当前无 `print` action（只有 `create-pdf`）。

**B2 方案**：在 plugin-webview 中新增 `print` action（`WebviewPrintRequest` 已存在但仅用于 create-pdf request）。重新审视：实际上 `WebviewPrintRequest { id, path }` 已存在，`print` action 应该调用 `@ohos.print` 打印该 PDF。

> **决策**：新增 `print` action，复用 `WebviewPrintRequest` 类型：
> ```rust
> impl WebviewHandle {
>   pub async fn print(&self, path: String) -> Result<()> {
>     self.client.call::<_, WebviewAcknowledgement>("print",
>       WebviewPrintRequest { id: self.id.clone(), path }).await?.ensure()
>   }
> }
> ```

wry `print()` 方法使用 Pattern A：spawn `handle.create_pdf(path).await` → 成功后 spawn `handle.print(path).await`。

### 3.5 devtools 保留 legacy core

`set_web_debugging_access` / `is_web_debugging_access` 是 ArkWeb C-API（`WebviewController.setWebDebuggingAccess`），在旧 `Webview` 类型上。新 `WebviewHandle` 无对应 action。

**B2 方案**：保留 legacy core NAPI 调用（不走 bridge）。`ohos_web_binding::Web` 类型仍提供这些 C-API 绑定。wry 通过 `Web::new(native_tag)` 获取底层 controller 并调用。

```rust
pub fn open_devtools(&self) {
  // WebviewController.setWebDebuggingAccess(true) — process-global static
  // 保留 legacy core NAPI（非 bridge）
  if let Ok(tag) = controller::native_tag_for(&self.id) {
    if let Err(e) = Web::new(tag).set_web_debugging_access(true) {
      log::warn!("[wry] open_devtools failed: {}", e);
    }
  }
  self.devtools_open.store(true, Ordering::SeqCst);
}
```

`controller::native_tag_for()` 是 plugin-webview 的 `pub(crate)` 函数，需改为 `pub` 供 wry 使用（或通过 `WebviewHandle` 新增 `native_tag()` 访问器）。

---

## 4. 反向回调映射（ArkTS → Rust）

### 4.1 回调注册方式变更

```rust
// 旧方式：WebViewBuilder 上注册 Function 闭包（build 前）
let mut builder = WebViewBuilder::new()
  .on_navigation_request(move |url: String| -> bool { navigation_handler(url) })
  .on_title_change(move |title: String| document_title_changed_handler(title))
  .on_download_start(move |url, path| -> bool { ... })
  .on_download_end(move |url, path, success| { ... })
  .on_page_begin(move |url| { ... })
  .on_page_end(move |url| { ... })
  .on_window_new(move |url, is_alert, is_user| { ... })
  .on_drag_and_drop(move |raw| { ... });
let webview = builder.build()?;

// 新方式：WebviewCallbacksBuilder 注册 Rust 闭包（create 前）
WebviewCallbacksBuilder::new(&id)
  .on_navigation_request(move |req: WebviewNavigationRequest| -> bool {
    // controller::is_current() 已由 callbacks.rs 内部调用，此处仅处理当前 controller
    navigation_handler(req.url)
  })
  .on_title_change(move |event: WebviewTitleChangeEvent| {
    document_title_changed_handler(event.title);
  })
  .on_download_start(move |req: WebviewDownloadStartRequest| -> WebviewDownloadStartResponse {
    let mut path = req.temp_path.map(PathBuf::from).unwrap_or_default();
    let allow = download_started_handler(req.url, &mut path);
    WebviewDownloadStartResponse {
      allow,
      temp_path: path.to_str().map(|s| s.to_string()),
    }
  })
  .on_download_end(move |event: WebviewDownloadEndEvent| {
    download_completed_handler(event.url, event.temp_path.map(PathBuf::from), event.success);
  })
  .on_page_begin(move |event: WebviewPageEvent| {
    page_loaded_begin.store(false, Ordering::SeqCst);
    url_cache.lock().unwrap().clone_from(&event.url);
    if let Some(handler) = &on_page_load_handler { handler(PageLoadEvent::Started, event.url); }
  })
  .on_page_end(move |event: WebviewPageEvent| {
    page_loaded_end.store(true, Ordering::SeqCst);
    url_cache.lock().unwrap().clone_from(&event.url);
    if let Some(handler) = &on_page_load_handler { handler(PageLoadEvent::Finished, event.url); }
  })
  .on_new_window_request(move |req: WebviewNewWindowRequest| -> bool {
    let features = NewWindowFeatures { size: None, position: None, opener: NewWindowOpener {} };
    match new_window_req_handler(req.target_url, features) {
      NewWindowResponse::Allow | NewWindowResponse::Create { .. } => true,
      NewWindowResponse::Deny => false,
    }
  })
  .on_drag_enter(move |event: WebviewDragEvent| {
    drag_drop_handler(DragDropEvent::Enter { paths: vec![], position: (event.x as i32, event.y as i32) });
  })
  .on_drag_over(move |event: WebviewDragEvent| {
    drag_drop_handler(DragDropEvent::Over { position: (event.x as i32, event.y as i32) });
  })
  .on_drag_drop(move |event: WebviewDropEvent| {
    let paths: Vec<PathBuf> = event.paths.into_iter().map(PathBuf::from).collect();
    drag_drop_handler(DragDropEvent::Drop { paths, position: (event.x as i32, event.y as i32) });
  })
  .on_drag_leave(move |_event: WebviewDragEvent| {
    drag_drop_handler(DragDropEvent::Leave);
  })
  .build()?;

let handle = client.create(create_request).await?;
```

### 4.2 反向回调映射表

| # | wry 回调 | 旧方式 | 新方式 (WebviewCallbacksBuilder) | bridge main-thread event | 响应类型 | 备注 |
|---|---------|--------|-------------------------------|-------------------------|---------|------|
| 1 | `navigation_handler` | `on_navigation_request(Fn(String)->bool)` | `on_navigation_request(Fn(WebviewNavigationRequest)->bool)` | `navigation-request` | `WebviewNavigationResponse { intercept }` | 语义反转见 4.3 |
| 2 | `document_title_changed_handler` | `on_title_change(Fn(String))` | `on_title_change(Fn(WebviewTitleChangeEvent))` | `title-change` | `WebviewEventAcknowledgement` | |
| 3 | `download_started_handler` | `on_download_start(Fn(String,&mut PathBuf)->bool)` | `on_download_start(Fn(WebviewDownloadStartRequest)->WebviewDownloadStartResponse)` | `download-start` | `WebviewDownloadStartResponse { allow, temp_path }` | temp_path 双向 |
| 4 | `download_completed_handler` | `on_download_end(Fn(String,Option<PathBuf>,bool))` | `on_download_end(Fn(WebviewDownloadEndEvent))` | `download-end` | `WebviewEventAcknowledgement` | |
| 5 | `on_page_load_handler` (Started) | `on_page_begin(Fn(String))` | `on_page_begin(Fn(WebviewPageEvent))` | `page-begin` | `WebviewEventAcknowledgement` | 同时更新 url_cache + page_loaded |
| 6 | `on_page_load_handler` (Finished) | `on_page_end(Fn(String))` | `on_page_end(Fn(WebviewPageEvent))` | `page-end` | `WebviewEventAcknowledgement` | 同上 |
| 7 | `new_window_req_handler` | `on_window_new(Fn(String,bool,bool)->OnWindowNewResult)` | `on_new_window_request(Fn(WebviewNewWindowRequest)->bool)` | `new-window-request` | `WebviewNewWindowResponse { allow }` | `Create` 变体降级为 `Allow`（bridge 只返回 bool） |
| 8 | `drag_drop_handler` (Enter) | `on_drag_and_drop(Fn(String))` → 解析 pipe | `on_drag_enter(Fn(WebviewDragEvent))` | `drag-enter` | `WebviewEventAcknowledgement` | paths 在 enter 时为空（getData 仅 drop 有效） |
| 9 | `drag_drop_handler` (Over) | 同上 | `on_drag_over(Fn(WebviewDragEvent))` | `drag-over` | 同上 | |
| 10 | `drag_drop_handler` (Drop) | 同上 | `on_drag_drop(Fn(WebviewDropEvent))` | `drag-drop` | 同上 | paths 从 UDMF 提取 |
| 11 | `drag_drop_handler` (Leave) | 同上 | `on_drag_leave(Fn(WebviewDragEvent))` | `drag-leave` | 同上 | |
| 12 | IPC handler | `on_controller_attach(Fn)` + `WebProxyBuilder` | `WebviewHandle::on_controller_attach(Fn)` + `WebviewJavascriptProxyBuilder` | `controller-attached` | `WebviewEventAcknowledgement` | 见 4.4 |

### 4.3 onLoadIntercept 语义反转

OHOS constraint §4.2：`onLoadIntercept` 返回 `true` = 拦截（阻止导航），`false` = 允许。Tauri/wry `navigation_handler` 返回 `true` = 允许，`false` = 阻止。

**新 bridge 层已处理**：`callbacks.rs::navigation_decision()` 中 `callback(request)` 返回 wry 语义的 bool（true=允许），然后构造 `WebviewNavigationResponse { intercept: !callback_result }`。ArkTS 侧 `onLoadIntercept` 收到 `intercept` 字段直接返回。

```rust
// callbacks.rs (已存在，B2 无需修改)
Ok(WebviewNavigationResponse {
  intercept: callback.map(|cb| cb(request)).unwrap_or(false),  // callback 返回 true=允许 → intercept=false
})
```

**wry 端**：`WebviewCallbacksBuilder::on_navigation_request` 闭包返回 wry 语义（`true` = 允许导航），与旧 `navigation_handler` 一致。wry 无需做语义反转——bridge facade 已处理。

### 4.4 IPC handler 与 controller-attached

旧实现通过 `webview.on_controller_attach(move || { WebProxyBuilder::new(id, "ipc").add_method("postMessage", handler).build() })` 注册 IPC。

新架构中：
- `controller-attached` 是 `on_main_thread_event`（由 `WebviewBridgePlugin::on_main_thread_event` 处理），内部调用 `controller::on_attached()` + `protocol::on_controller_attached()` + `js_proxy::on_controller_attached()`
- IPC handler 应通过 `WebviewJavascriptProxyBuilder` 注册（plugin-webview 导出的 `WebviewJavascriptProxyBuilder`）
- `WebviewHandle::on_controller_attach(FnMut)` 仍可用（通过 `Web::new(native_tag).on_controller_attach()` C-API 路径）

**B2 方案**：保留 `WebviewHandle::on_controller_attach()` + 内部用 `WebProxyBuilder` 或迁移到 `WebviewJavascriptProxyBuilder`。由于 `WebProxyBuilder` 是 `openharmony_ability::native_web` 模块（legacy），而 `WebviewJavascriptProxyBuilder` 是新 plugin-webview 模块，B2 优先迁移到 `WebviewJavascriptProxyBuilder`。若 `WebviewJavascriptProxyBuilder` API 不兼容 IPC postMessage，则保留 legacy `WebProxyBuilder` + `on_controller_attach` C-API 路径（标注 TODO 后续迁移）。

### 4.5 close-window 路由

A1 新增 `close-window.invalid` URL 前缀路由：当 navigation-request 的 URL 匹配 `close-window.invalid` / `http://close-window.invalid` 时，`callbacks.rs` 将其路由到 `on_close_window` 回调（而非 `on_navigation_request`），并返回 `intercept: true`（阻止导航）。

**wry B2**：wry 当前无 `close_window` handler 暴露给上层。B2 可选注册 `on_close_window` 回调（如果 tauri 上层需要）。默认不注册——`WebviewCallbacksBuilder` 要求至少注册一个回调才 build，wry 总会注册 navigation 等，所以 close-window 不注册时 `callbacks.rs` 仍能正确拦截 close-window URL 并返回 `intercept: true`（只是不触发 Rust 回调）。

---

## 5. Cargo.toml 依赖调整

### 5.1 wry/Cargo.toml

```toml
[target.'cfg(target_env = "ohos")'.dependencies]
openharmony-ability = { path = "../openharmony-ability/crates/ability", features = ["drag_and_drop"] }
openharmony-ability-derive = { path = "../openharmony-ability/crates/derive" }
openharmony-ability-plugin-webview = { path = "../openharmony-ability/crates/plugin-webview" }  # 新增
tokio = { version = "1", features = ["rt"] }  # 新增（BridgeExecutor 需要）
log = "0.4"
base64 = "0.22"
```

### 5.2 tao/Cargo.toml

无新增依赖——`BridgeRuntime` 已在 `openharmony-ability` 中，tao 已依赖。

### 5.3 tauri-runtime-wry/Cargo.toml

无新增依赖——`WebViewBuilderExtOhos` 在 wry 中，tao `WindowExtOpenHarmony` 在 tao 中，tauri-runtime-wry 已依赖两者。

---

## 6. BridgeExecutor 设计

参照 tao B1 `BridgeExecutor`，wry 需要等价设施来 spawn async bridge calls。

```rust
// wry/src/ohos/mod.rs
pub(crate) struct BridgeExecutor {
  runtime: tokio::runtime::Runtime,
  main_thread_id: std::thread::ThreadId,
}

impl BridgeExecutor {
  pub(crate) fn new() -> Self {
    let runtime = tokio::runtime::Builder::new_current_thread()
      .enable_all()
      .thread_name("ohos-wry-bridge-rt")
      .build()
      .expect("Failed to create wry bridge runtime");
    // 后台线程驱动 runtime
    std::thread::Builder::new()
      .name("ohos-wry-bridge-rt".to_string())
      .spawn(move || {
        runtime.block_on(std::future::pending::<()>());
      })
      .expect("Failed to spawn wry bridge thread");
    // 注意：runtime 被 move 到 thread 中，需改用 Handle 模式
    Self {
      runtime: /* 见下方修正 */,
      main_thread_id: std::thread::current().id(),
    }
  }
}
```

**修正**：tao B1 使用 `tokio::runtime::Handle`（`Clone + Send + Sync`）。wry 同模式：

```rust
pub(crate) struct BridgeExecutor {
  handle: tokio::runtime::Handle,
  main_thread_id: std::thread::ThreadId,
}

impl BridgeExecutor {
  pub(crate) fn new() -> Self {
    let runtime = tokio::runtime::Builder::new_current_thread()
      .enable_all()
      .build()
      .expect("Failed to create wry bridge runtime");
    let handle = runtime.handle().clone();
    std::thread::Builder::new()
      .name("ohos-wry-bridge-rt".to_string())
      .spawn(move || { runtime.block_on(std::future::pending::<()>()); })
      .expect("Failed to spawn wry bridge thread");
    Self { handle, main_thread_id: std::thread::current().id() }
  }

  pub(crate) fn spawn<F>(&self, future: F)
  where F: std::future::Future<Output: ()> + Send + 'static
  {
    let _ = self.handle.spawn(future);
  }
}
```

`BridgeExecutor` 在 `InnerWebView::new_inner()` 中创建（一次 per webview）。或共享一个全局 executor（后续优化）。B2 采用 per-webview 实例（简单，与 tao Window 一对一模式一致）。

---

## 7. InnerWebView::new_inner 重写骨架

```rust
fn new_inner(window, attributes, pl_attrs, is_child) -> Result<Self> {
  let WebViewAttributes { id, url, html, initialization_scripts, ipc_handler,
    devtools, custom_protocols, background_color, transparent, headers, autoplay,
    user_agent, javascript_disabled, navigation_handler, document_title_changed_handler,
    on_page_load_handler, new_window_req_handler, download_started_handler,
    download_completed_handler, bounds, clipboard, zoom_hotkeys_enabled,
    drag_drop_handler, .. } = attributes;

  let id = id.map(|i| i.to_string()).unwrap_or_else(|| COUNTER.next().to_string());
  let runtime = pl_attrs.bridge_runtime
    .ok_or_else(|| Error::OpenHarmonyInitError("BridgeRuntime not provided".into()))?;
  let client = WebviewClient::from_bridge(runtime);
  let executor = BridgeExecutor::new();

  // 1. 注册反向回调（create 前）
  let page_loaded = Arc::new(AtomicBool::new(false));
  let url_cache = Mutex::new(String::new());
  let devtools_open = AtomicBool::new(false);

  let mut callbacks = WebviewCallbacksBuilder::new(&id);
  if let Some(nav) = navigation_handler { callbacks = callbacks.on_navigation_request(...); }
  if let Some(title) = document_title_changed_handler { callbacks = callbacks.on_title_change(...); }
  if let Some(ds) = download_started_handler { callbacks = callbacks.on_download_start(...); }
  if let Some(de) = download_completed_handler { callbacks = callbacks.on_download_end(...); }
  // page-begin/end 总是注册（用于 page_loaded + url_cache）
  callbacks = callbacks.on_page_begin(...).on_page_end(...);
  if let Some(nw) = new_window_req_handler { callbacks = callbacks.on_new_window_request(...); }
  if let Some(dd) = drag_drop_handler { callbacks = callbacks.on_drag_enter(...).on_drag_over(...).on_drag_drop(...).on_drag_leave(...); }
  callbacks.build()?;

  // 2a. 声明 custom protocol schemes（create 前，引擎初始化前）
  //
  // OHOS ArkWeb 采用两阶段自定义协议模型：scheme 必须先通过
  // `WebviewProtocol::register` 进程级 *声明*，才能通过
  // `custom_protocol_async` 每 controller *绑定*（绑定内部 `require_declared`
  // 强校验）。引擎在下方 `create` 调用内部（`ensureWebEngineInitialized`）懒
  // 初始化，即本同步段之后，故在此声明满足时序——尽管 tauri 的 scheme 列表
  // 是运行期（`Builder::run`）才收集的，无法在 `#[ability]` 初始化期声明。
  // 重复声明已声明 scheme 是 no-op，故子/第二个 webview 安全。
  let options = WebviewProtocolOptions::Standard
    | WebviewProtocolOptions::CorsEnabled
    | WebviewProtocolOptions::CspBypassing
    | WebviewProtocolOptions::FetchEnabled
    | WebviewProtocolOptions::CodeCacheEnabled;
  for scheme in custom_protocols.keys() {
    WebviewProtocol::register(scheme, options)?;
  }

  // 2b. 绑定 custom protocols（create 前，通过 WebviewClient::custom_protocol_async）
  for (scheme, callback) in &custom_protocols {
    client.custom_protocol_async(&id, scheme, move |wid, req, is_main, responder| { ... })?;
  }

  // 3. 构建 create request
  let mut create_req = WebviewCreateRequest::new(&id)
    .style(WebviewStyle { x, y, width, height, visible, background_color: ... })
    .javascript_enabled(!javascript_disabled)
    .autoplay(autoplay)
    .initialization_scripts(...)
    .transparent(transparent)
    .clipboard(clipboard)
    .zoom_hotkeys(zoom_hotkeys_enabled);
  if let Some(html) = html { create_req = create_req.html(html); }
  else if let Some(url) = url { create_req = create_req.url(url); }
  if let Some(ua) = user_agent { create_req = create_req.user_agent(ua); }  // 或 set-user-agent action

  // 4. create (async — 需要 spawn + block，但 new_inner 是 sync...)
  //    → 见 7.1 节：create 的同步性难题
  let handle = ???;  // client.create(create_req).await — 但 new_inner 不是 async!

  // 5. 注册 IPC handler (controller-attached)
  handle.on_controller_attach(move || { ... })?;

  // 6. https intercept (保留 legacy thread_local)
  if pl_attrs.use_https && !custom_protocols.is_empty() { ... }

  Ok(Self { id, handle, runtime: executor, page_loaded, url_cache, bounds_cache, devtools_open, is_child, disposed })
}
```

### 7.1 create 的同步性难题

`WebviewClient::create()` 是 `async`，但 `InnerWebView::new_inner()` 是 `sync`（被 `WebViewBuilder::build()` 同步调用）。wry 公共 API `WebViewBuilder::build()` 是 sync 且不能改（跨平台约束）。

**方案**：`new_inner()` 中 block_on `client.create()`。

**死锁风险**：`new_inner()` 在 ArkUI JS 线程调用（wry `WebViewBuilder::build()` 由 tauri-runtime-wry 在主线程调用）。block_on 会导致 TSFN callback 无法执行 → 死锁。

**解决**：与 Pattern D 同理——在后台 runtime 线程上 spawn create future，主线程通过 `oneshot` channel 等待结果。但主线程等待仍会死锁。

**最终方案**：`new_inner()` 在后台 BridgeExecutor 线程上 block_on create future。具体：

```rust
let (tx, rx) = std::sync::mpsc::channel::<Result<WebviewHandle>>();
let client_clone = client.clone();
let create_req = create_req;  // move
std::thread::spawn(move || {
  let rt = tokio::runtime::Runtime::new().unwrap();  // 临时 runtime
  let result = rt.block_on(client_clone.create(create_req));
  let _ = tx.send(result);
});
let handle = rx.recv().map_err(|_| Error::OpenHarmonyInitError("create channel closed".into()))??;
```

**问题**：`client.create()` 内部调 `bridge.call_async()` → TSFN → ArkTS Promise。TSFN callback 在 ArkTS 主线程执行。如果 ArkTS 主线程正在等待 `new_inner()` 返回（因为 `build()` 是同步的），则 TSFN callback 无法执行 → 死锁。

**这与 OHOS constraint §1.2 完全一致——主线程不能等待 bridge 返回。**

### 7.2 create 难题的根本解法

**回顾 tao B1**：tao 的 `create_os_window` 保留为 core 同步 NAPI（不走 bridge），正是为了避免此问题。wry 的 webview create 必须走 bridge（无 core 等价），这是 B2 的核心难题。

**三个候选方案**：

#### 方案 1: 延迟 attach（create 后异步绑定回调）

`new_inner()` 不等待 create 完成。立即返回一个 `InnerWebView`，其中 `handle: Option<WebviewHandle>` 初始为 `None`。在 BridgeExecutor 上 spawn create future，完成后通过 `Mutex<Option<WebviewHandle>>` 设置 handle。所有方法调用前检查 `handle.is_some()`，未就绪时返回 `Ok(())`（静默跳过）或入队重放。

```rust
pub struct InnerWebView {
  id: String,
  handle: Mutex<Option<WebviewHandle>>,  // 异步就绪
  pending_ops: Mutex<Vec<PendingOp>>,     // create 完成前排队
  ...
}
```

**优点**：不死锁，主线程不阻塞。
**缺点**：复杂度高——需要 pending ops 队列 + 所有方法检查 handle 就绪状态。create 完成前的 load_url / eval 等调用需缓存重放。

#### 方案 2: 保留旧 core NAPI create + bridge 方法调用

webview create 仍走旧 `openharmony_ability::WebViewBuilder::build()`（同步 NAPI），获得旧 `Webview`。但从旧 `Webview` 中提取 `id` / `native_tag`，然后用 `WebviewClient::handle(id)` 构造一个 `WebviewHandle` facade（不调 `create` action）。后续方法调用走 bridge。

```rust
let legacy_webview = openharmony_ability::WebViewBuilder::new()...build()?;
let handle = client.handle(&id);  // WebviewClient::handle — 不调 create，仅包装 id
```

**问题**：ArkTS 侧 controller-attached 事件由 `create` action 触发。不调 `create` 的话，ArkTS 侧的 `WebviewPlugin` 不会初始化 controller → 后续 bridge action 无目标 controller。旧 `WebViewBuilder::build()` 走的是旧 ArkTS 路径（DefaultWebview.ets），不走新 plugin 路径。两套路径冲突。

#### 方案 3: create 走 bridge，但在独立线程 block_on + ArkTS 主线程不等待

关键洞察：如果 `new_inner()` 能在 **非 ArkTS 主线程** 上执行，则 block_on 安全。

但 `WebViewBuilder::build()` 由 tauri-runtime-wry 调用，后者在 ArkTS 主线程运行。

**除非**：将 `InnerWebView::new_inner()` 的 bridge create 部分移到 BridgeExecutor 后台线程，主线程仅等待结果。但主线程等待 = 死锁。

#### 方案 4（推荐）: Hybrid — create 用 core sync NAPI，方法用 bridge

这是方案 2 的改进版。分析 `WebviewClient::create()` 的 ArkTS 侧行为：create action 在 ArkTS 侧创建 `Web` 组件 + `WebviewController` + 触发 `controller-attached` 事件。

旧 `WebViewBuilder::build()` 也在 ArkTS 侧创建 `Web` 组件 + controller（但走旧 `DefaultWebview.ets` 路径）。

**如果两条路径创建的 controller 都注册到同一个 `controller::CONTROLLER_REGISTRY`**，那么：
1. 旧 `WebViewBuilder::build()` 创建 controller（同步，立即可用）
2. `client.handle(id)` 包装 facade
3. 后续 bridge action 通过 `id` → `controller::native_tag_for(id)` → 找到 controller

**前提**：controller 注册在 ArkTS 侧由 `Web` 组件的 `onControllerAttached` 触发（无论 create 走旧路径还是新 plugin 路径）。如果旧路径也触发 `controller-attached` main-thread event，则 Rust 侧 `controller::on_attached()` 会执行。

**风险**：旧 `DefaultWebview.ets` 不触发新 `controller-attached` 事件（它不是新 plugin 的一部分）。

> **决策**：B2 采用 **方案 1（延迟 attach）**。这是唯一不依赖旧路径且不死锁的方案。复杂度可控——参照旧 ProxyJsHelper 三级队列模式（ohos-constraints §4.3）。

### 7.3 方案 1 详细设计：延迟 attach + ops 队列

```rust
pub struct InnerWebView {
  id: String,
  // handle 在 create 完成后通过 OnceLock 设置
  handle: Arc<tokio::sync::OnceCell<WebviewHandle>>,
  // create 完成前的操作缓存在 Vec 中，create 完成后回放。
  // CRITICAL: pending_ops 同时充当 handle 就绪检查的守卫锁——
  // 方法调用必须持有 pending_ops.lock() 时检查 handle.get()，
  // create 完成回放也必须持有同一锁时 set handle + drain，
  // 否则 get() 与 push() 之间存在 TOCTOU 竞态：create 完成
  // drain 在两者之间执行 → push 的 op 永远不会被回放（丢失）。
  pending_ops: Mutex<Vec<PendingOp>>,
  runtime: BridgeExecutor,
  page_loaded: Arc<AtomicBool>,
  url_cache: Mutex<String>,
  bounds_cache: Mutex<Rect>,
  devtools_open: AtomicBool,
  is_child: bool,
  disposed: AtomicBool,
}
```

`new_inner()` 流程：
1. 注册 callbacks + custom_protocols（同 7 节骨架）
2. spawn `client.create(create_req)` 在 BridgeExecutor 上
3. create 完成后：`handle.set(result?)` + 回放 pending ops
4. `new_inner()` 立即返回 `InnerWebView { handle: Arc::new(OnceCell::new()), ... }`

方法调用模式（**必须持有 pending_ops 锁时检查 handle，避免 TOCTOU**）：
```rust
pub fn load_url(&self, url: &str) -> Result<()> {
  let url = url.to_string();
  // 持有锁时检查 handle 就绪状态，与 create 完成回放的 set+drain 互斥
  let mut guard = self.pending_ops.lock().unwrap();
  if let Some(handle) = self.handle.get() {
    drop(guard);  // 释放锁后再 spawn（不在持有锁时 await）
    let handle = handle.clone();
    self.runtime.spawn(async move { let _ = handle.load_url(url).await; });
  } else {
    // 未就绪：缓存到 pending ops（create 完成后回放）
    guard.push(PendingOp::LoadUrl(url));
  }
  Ok(())
}
```

**回放**：create future 完成后（**必须持有 pending_ops 锁时 set handle + drain，与方法调用互斥**）：
```rust
// create completion（在 BridgeExecutor 上 spawn 的 future 内）：
let mut guard = self.pending_ops.lock().unwrap();
if self.handle.set(handle).is_err() {
  // handle 已被设置（不应发生）— 丢弃
  return;
}
let handle_clone = self.handle.get().unwrap().clone();  // 刚 set 成功，安全
let pending = guard.drain().collect::<Vec<_>>();
drop(guard);  // 释放锁后再 spawn 回放（不在持有锁时 await）
self.runtime.spawn(async move {
  for op in pending { op.execute(&handle_clone).await; }
});
```

**复杂度评估**：~60 行额外代码（OnceCell + PendingOp enum + 回放逻辑）。可控。

---

## 8. All-or-nothing 迁移策略

### 8.1 为什么无法分步

`OhosWebviewHandle` 类型从 `Webview` 改为 `WebviewHandle` 后：
- `InnerWebView.webview` 字段类型变 → 所有 `self.webview.xxx()` 调用编译失败（~20 处）
- `WebViewExtOhos::webview_handle()` 返回类型变 → 返回值不匹配
- 回调注册从 `WebViewBuilder::on_*` 变为 `WebviewCallbacksBuilder::on_*` → 构造逻辑完全不同
- `use openharmony_ability::{WebViewBuilder, Webview, WebViewStyle}` 导入失效

必须一次性替换全部类型 + 方法 + 回调 + 构造逻辑。

### 8.2 验证点

| 验证项 | 方式 | 通过标准 |
|--------|------|---------|
| 编译 | `cargo check --target aarch64-unknown-linux-ohos` | 0 error |
| 跨平台 | `cargo check` (Windows host) | 0 error，确认 OHOS cfg 隔离 |
| 设备 load_url | 设备端 navigate | webview 加载页面 |
| 设备 evaluate_script | 设备端 JS eval | 返回正确结果 |
| 设备 navigation handler | 设备端拦截导航 | 拦截生效 |
| 设备 download | 设备端下载 | 下载启动 + 完成 |
| 设备 title change | 设备端标题更新 | 回调触发 |
| 设备 drag-drop | 设备端拖拽文件 | 4 事件触发 |
| 设备 new-window | 设备端 window.open | Allow/Deny 生效 |

### 8.3 回退方案

如果 create 同步性难题（方案 1）在实现中无法解决，回退到 **方案 2（hybrid core+bridge）**：create 保留旧 core NAPI，仅方法调用走 bridge。但这需要验证旧 `Web` 组件是否触发新 `controller-attached` 事件。若否，则方法调用也无法走 bridge（controller 未注册）→ 需要在 A2/A3 中扩展 bridge 框架支持同步 create。

---

## 9. 约束遵守

| 约束 | 遵守方式 |
|------|---------|
| 铁律 #1: openharmony-ability 唯一桥接仓 | wry 仅通过 plugin-webview facade 调用，不直接 NAPI |
| 铁律 #2: 不影响其他平台 | 所有改动在 `#[cfg(target_env = "ohos")]` 内 |
| 铁律 #3: OHOS_DEVICE_TYPE | 本 change 不涉及 desktop/mobile 分歧，无新增 cfg |
| §1.2 禁止主线程阻塞 | Pattern A/B (spawn) 不阻塞；Pattern C 返回缓存；Pattern D 主线程降级；create 用方案 1 延迟 attach |
| §2.1 NAPI camelCase | bridge facade 已处理，wry 不直接调 NAPI |
| §4.2 onLoadIntercept 语义反转 | bridge facade `navigation_decision()` 已处理 `intercept = !result` |
| §4.3 异步竞态 | 方案 1 延迟 attach + pending ops 队列参照 ProxyJsHelper 模式 |
| §6 API 版本 | devtools `setWebDebuggingAccess` 是 process-global API，无版本守卫需求 |

---

## 10. 关键风险

1. **create 同步性（最高风险）** — `WebviewClient::create()` 是 async，`WebViewBuilder::build()` 是 sync。方案 1（延迟 attach + ops 队列）增加复杂度但可解。若不可解需回退方案 2 或扩展 bridge 框架（A2 范围）。
2. **Pattern D 主线程降级** — `cookies_for_url` 在主线程返回空（与 Android 一致），但可能影响依赖 cookies 的 Tauri 命令（如果命令在主线程运行——实际不会，命令在 tokio worker 运行）。
3. **plugin-webview 补充 action** — B2 需要 `set-bounds` / `set-cookie` / `print` 三个新 action（A1 清单遗漏）。需在 plugin-webview + ArkTS WebviewPlugin.ets 中补充（~60 行）。
4. **IPC handler 迁移** — `WebProxyBuilder` → `WebviewJavascriptProxyBuilder` 的 API 兼容性需验证。若不兼容则保留 legacy C-API 路径。
5. **controller-attached 触发** — 新 bridge 路径的 `controller-attached` 事件是否在 create action 后正确触发，决定 `on_controller_attach` 注册的 IPC/custom-protocol 回放是否工作。
6. **session_active 前置（实测回归）** — `dispatch_main_thread_event` 要求 `session_active==true`，仅由 `on_ability_create` NAPI 回调（`AbilityCreated`）置位。NativeAbility 重构保留了 `onWindowStageCreate` 的 `lifecycle.windowStageEventCallback.onWindowStageCreate()` 调用，却漏掉 onCreate 的 `onAbilityCreate` 调用 → `session_active` 恒 false → create 期间 reverse event 全被拒，白屏。修复：onCreate per-module 循环 push 后、`activateAbility` 前调 `lifecycle.windowStageEventCallback.onAbilityCreate(restoredState)`。`activateAbility` 不能替代（不触达 Rust `dispatch_lifecycle`）。见 spec REQ-010c。
7. **controller-attached 的 UiContext 就绪性（下一道坎）** — session 修复后，`seal-engine-schemes`/`before-engine-init`/`engine-initialized`（仅需 `Ability` context）可过；但 `controller-attached` 默认需 `UiContext`（`BridgePlugin` REQUIRED_CONTEXTS）。create 在 `RunEvent::Ready` 后 spawn，`controller-attached` 在引擎初始化期间派发，此时 Web 组件的 UIContext 是否就绪取决于 ArkTS `onControllerAttached` 时序。若未就绪，会撞 "before its required context was ready"（区别于 session 错误）。
8. **ohpm/hvigor HAR 缓存** — 改 `native_ability` ArkTS 后必须清 `oh_modules` + `CompileArkTS` + `.hvigor` 缓存并重建 HAR，否则设备跑旧 abc（demo 此前"能用"的假象即来自带 `onAbilityCreate` 的旧 HAR 缓存）。
