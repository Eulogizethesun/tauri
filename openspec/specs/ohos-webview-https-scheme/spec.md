# ohos-webview-https-scheme Specification

> ✅ **验证状态：完全通过（2026-08-06，API 23 desktop）。** 根因是 `tauri-runtime-wry` OHOS 分支漏传 `with_https_scheme`（Windows/Android 传了，OHOS 没）→ `pl_attrs.use_https` 始终 false → URL 不改写。已修复。真机验证三项全通过：`isSecureContext=true` + `location.href=https://tauri.localhost/` + `crypto.subtle OK (SHA-256 32 bytes)`。

## ADDED Requirements

### Requirement: wry OHOS SHALL honor `with_https_scheme(true)` by rewriting the initial URL and registering https interception

当 `WebViewBuilderExtOhos::with_https_scheme(true)` 被调用且 `custom_protocols` 非空时，wry OHOS 后端的 `InnerWebView::new_inner` SHALL：

1. 在调用 `WebViewBuilder::build()` 之前，对 `attributes.url` 中所有 scheme 命中 `custom_protocols` 键的 URL 应用 `custom_protocol_workaround::apply_uri_work_around(url, "https", protocol)`，把 `<protocol>://localhost/path` 改写为 `https://<protocol>.localhost/path`；
2. 通过 `WebViewBuilder::use_https_intercept(true)` 与 `https_intercept_protocols(Vec<String>)` 把所有 `custom_protocols` 的协议名传给 openharmony-ability，由 ArkTS 侧 `onInterceptRequest` 完成转发；
3. 不再 emit 现有的 `log::warn!("[WRY OHOS] with_https_scheme: https scheme registration not yet implemented ...")` 警告（该警告仅在设计未实现期存在）。

当 `with_https_scheme(false)`（默认）或 `custom_protocols` 为空时，SHALL 保持现有行为不变：URL 不改写、不注册 https 拦截、custom_protocols 仍按原始 scheme 经 `OH_ArkWeb_SetSchemeHandler` 注册。

`with_https_scheme(true)` 与现有「按原始 scheme 注册 `custom_protocol_async`」**不互斥**——两条路径并存：原始 scheme 注册保留（向后兼容），新增的 https 拦截负责把 `https://<protocol>.<host>/<path>` 转回原始 URL 后投递给同一个 `custom_protocol_async` 闭包。

#### Scenario: with_https_scheme(true) rewrites tauri://localhost URL
- **WHEN** 调用方 `WebViewBuilder::new().with_url("tauri://localhost/index.html").with_https_scheme(true)` 且 `custom_protocols` 含 `"tauri"`
- **THEN** wry OHOS SHALL 在 build 前把 url 改写为 `"https://tauri.localhost/index.html"`
- **AND** SHALL 调用 `WebViewBuilder::use_https_intercept(true).https_intercept_protocols(["tauri".to_string()])`
- **AND** `WebViewBuilder::build()` 接收到的 `url` 字段为改写后的 `https://tauri.localhost/index.html`

#### Scenario: with_https_scheme(false) preserves raw scheme
- **WHEN** 调用方未调用 `with_https_scheme`（默认 `false`），或显式 `with_https_scheme(false)`
- **THEN** wry OHOS SHALL 不改写 url（保持 `tauri://localhost/index.html`）
- **AND** SHALL 不调用 `use_https_intercept`
- **AND** 现有 `custom_protocol_async` 经 `OH_ArkWeb_SetSchemeHandler("tauri", ...)` 注册的路径 SHALL 继续工作

#### Scenario: with_https_scheme(true) but no custom_protocols registered
- **WHEN** `with_https_scheme(true)` 但 `custom_protocols` 为空
- **THEN** wry OHOS SHALL 视为 no-op：不调用 `use_https_intercept`、不改写 url、不打 warn 日志
- **AND** SHALL 不产生任何 https 拦截副作用

#### Scenario: with_https_scheme(true) and URL scheme not in custom_protocols
- **WHEN** `with_https_scheme(true)`，`custom_protocols = {"tauri"}`，但 `url = "https://example.com/page"`
- **THEN** wry OHOS SHALL 不改写该 url（scheme 不匹配任何 custom_protocol）
- **AND** 该 url 在 ArkTS 侧 `onInterceptRequest` 中 SHALL 被「不匹配任何已注册协议」分支处理（返回 null，让 ArkWeb 走默认网络栈）

#### Scenario: warning log removed when implemented
- **WHEN** `with_https_scheme(true)` 且本特性已实现
- **THEN** wry OHOS SHALL NOT emit `log::warn!("[WRY OHOS] with_https_scheme: https scheme registration not yet implemented ...")`
- **AND** 该 warn 字符串 SHALL 从 `wry/src/ohos/mod.rs` 删除

### Requirement: openharmony-ability WebViewBuilder SHALL carry use_https_intercept and https_intercept_protocols fields

`openharmony-ability::WebViewBuilder` SHALL 新增两个字段及对应 builder 方法：

- `use_https_intercept: bool`（默认 `false`），方法 `.use_https_intercept(self, bool) -> Self`
- `https_intercept_protocols: Vec<String>`（默认空），方法 `.https_intercept_protocols(self, Vec<String>) -> Self`

`build()` SHALL 把这两个字段经 `WebViewInitData` NAPI 结构传给 ArkTS `createWebview` / `createEmbeddedWebview`。

#### Scenario: builder methods populate fields
- **WHEN** `WebViewBuilder::new().use_https_intercept(true).https_intercept_protocols(vec!["tauri".into()])` 调用后 `build()`
- **THEN** `WebViewInitData.use_https_intercept = Some(true)`
- **AND** `WebViewInitData.https_intercept_protocols = Some(vec!["tauri".to_string()])`

#### Scenario: default values when not set
- **WHEN** `WebViewBuilder::new().build()` 未调用上述方法
- **THEN** `WebViewInitData.use_https_intercept = Some(false)`
- **AND** `WebViewInitData.https_intercept_protocols = None`（或 `Some(vec![])`）

### Requirement: Webview SHALL expose register_https_intercept NAPI method for late binding

`openharmony-ability::Webview` SHALL 暴露 `pub fn register_https_intercept(&self, protocols: Vec<String>) -> Result<()>` 方法，通过 NAPI 调用 ArkTS 控制器的 `registerHttpsIntercept` 方法。该方法用于「webview 已创建后追加 https 拦截协议」的场景（如 tauri-runtime-wry 在 `with_webview` 回调中补注册）。

ArkTS 侧 `ret.controller.registerHttpsIntercept(protocols: string[])` SHALL 把协议名合并入 webview 的 https-intercept 协议集合（去重），并保证后续 `onInterceptRequest` 回调能匹配到这些协议。

#### Scenario: Rust calls register_https_intercept
- **WHEN** Rust 调用 `webview.register_https_intercept(vec!["tauri".to_string()])`
- **THEN** SHALL 通过 NAPI 调用 ArkTS `ret.controller.registerHttpsIntercept(["tauri"])`
- **AND** ArkTS 侧 SHALL 把 `"tauri"` 加入该 webview 的 https-intercept 协议集合

#### Scenario: register_https_intercept fails when main thread env unavailable
- **WHEN** `get_main_thread_env()` 返回 `None` 时调用 `register_https_intercept`
- **THEN** SHALL 返回 `Error::from_reason("Failed to get main thread env")`

### Requirement: ArkHelper SHALL attach registerHttpsIntercept to controller

`ArkHelper.ets` 的 `createWebview` 和 `createEmbeddedWebview` SHALL 在 `ret.controller` 上挂载 `registerHttpsIntercept(protocols: string[])` 方法。该方法 SHALL：

1. 把传入的协议名合并到该 webview 对应的内部 `httpsInterceptProtocols: Set<string>`（per-webview 隔离，去重）；
2. 不立即触发任何重渲染——协议集合在 `onInterceptRequest` 闭包中通过闭包捕获或 `data` 字段读取。

#### Scenario: registerHttpsIntercept on normal webview
- **WHEN** 通过 `createWebview` 创建 webview 后调用 `controller.registerHttpsIntercept(["tauri", "asset"])`
- **THEN** SHALL 把 `"tauri"`、`"asset"` 加入该 webview 的 https-intercept 协议集合
- **AND** 后续 `onInterceptRequest` SHALL 能匹配 `https://tauri.localhost/...` 与 `https://asset.localhost/...`

#### Scenario: per-webview isolation of protocol set
- **WHEN** webview A 调用 `registerHttpsIntercept(["tauri"])`，webview B 不调用
- **THEN** webview A 的 `onInterceptRequest` SHALL 匹配 `https://tauri.localhost/...`
- **AND** webview B 的 `onInterceptRequest` SHALL 不匹配任何 https 协议（返回 null）

### Requirement: DefaultWebview SHALL register onInterceptRequest when useHttpsIntercept is true

`DefaultWebview.ets` 的 `WebBuilder` 与 `EmbeddedWebBuilder` SHALL 根据 `data.useHttpsIntercept === true` 条件挂载 `.onInterceptRequest(callback)` 属性。当 `data.useHttpsIntercept` 为 `false` 或 `undefined` 时 SHALL NOT 挂载该属性（保持现有行为）。

`onInterceptRequest` 回调 SHALL：

1. 从 `event.request.getRequestUrl()` 读取 URL；
2. 用 `custom_protocol_workaround::is_work_around_uri(url, "https", protocol)` 等价逻辑（在 ArkTS 侧实现：`/^https:\/\/<protocol>\./`）匹配 `data.httpsInterceptProtocols` 中的任一协议；
3. **匹配**：创建 `new WebResourceResponse()`，调用 `setResponseIsReady(false)`，异步调用 NAPI `dispatchHttpsIntercept(url, applyResponseFn)`，**同步返回** 该 response 对象；
4. **不匹配**：返回 `null`（让 ArkWeb 继续走默认网络栈）。

#### Scenario: matching https URL intercepted
- **WHEN** `data.useHttpsIntercept === true`，`data.httpsInterceptProtocols = ["tauri"]`，webview 发起 `fetch("https://tauri.localhost/api/data")`
- **THEN** `onInterceptRequest` SHALL 匹配 `tauri`
- **AND** SHALL 创建 `WebResourceResponse` 并调用 `setResponseIsReady(false)`
- **AND** SHALL 调用 NAPI `dispatchHttpsIntercept("https://tauri.localhost/api/data", applyResponseFn)`
- **AND** SHALL 同步返回该 response 对象（不返回 null）

#### Scenario: non-matching https URL passes through
- **WHEN** `data.useHttpsIntercept === true`，`data.httpsInterceptProtocols = ["tauri"]`，webview 发起 `fetch("https://example.com/api")`
- **THEN** `onInterceptRequest` SHALL 不匹配任何协议
- **AND** SHALL 返回 `null`
- **AND** ArkWeb SHALL 走默认 https 网络栈加载该请求

#### Scenario: useHttpsIntercept false does not attach onInterceptRequest
- **WHEN** `data.useHttpsIntercept` 为 `false` 或 `undefined`
- **THEN** Web 组件 SHALL NOT 挂载 `.onInterceptRequest` 属性
- **AND** 所有 https 请求 SHALL 走 ArkWeb 默认网络栈

#### Scenario: onInterceptRequest covers sub-resource and main-frame requests
- **WHEN** `data.useHttpsIntercept === true` 且 webview 主框架导航到 `https://tauri.localhost/index.html`
- **THEN** `onInterceptRequest` SHALL 对该主框架请求触发
- **AND** SHALL 按 matching 流程处理（创建 response、异步 dispatch）
- **NOTE**：ArkWeb 是否对主框架导航也触发 `onInterceptRequest` 需设备验证（见 plan 未知项 1）；若不触发，初始 URL 加载需 `onLoadIntercept` 配合（fallback 设计见 plan Phase 2）。

### Requirement: NAPI dispatchHttpsIntercept SHALL bridge https URL to existing custom_protocol_async handler

openharmony-ability SHALL 暴露 NAPI 函数 `dispatchHttpsIntercept(url: string, applyResponse: Function)`，行为：

1. 接收 ArkTS 传入的 `https://<protocol>.<host>/<path>` URL 与一个 `applyResponse` 回调函数；
2. 用 `custom_protocol_workaround::revert_uri_work_around(url, "https", protocol)` 把 URL 还原为 `<protocol>://<host>/<path>`（其中 `<protocol>` 从 URL 解析得到，且必须命中该 webview 已注册的 custom_protocol 闭包集合）；
3. 构造 `http::Request<Vec<u8>>`（method 默认 `GET`，headers 从 ArkTS 透传或为空——见未知项 4），调用对应 webview 的 `custom_protocol_async` 闭包（即 wry 在 `InnerWebView::new_inner` 中通过 `webview.custom_protocol_async(protocol, ...)` 注册的那个）；
4. 闭包的 `RequestAsyncResponder` SHALL 在响应到达时把 `{statusCode, headers, mimeType, body}` 经 `Function::call` + `FnArgs` 元组模式回调 `applyResponse`（遵守 ohos-constraints §2.2 `callee_handled::<false>()` + `FnArgs` 包装规则）；
5. `applyResponse` 在 ArkTS 侧 SHALL 调用 `response.setResponseCode(statusCode)`、`response.setResponseMimeType(mimeType)`、`response.setResponseHeader(headers)`、`response.setResponseData(body)`，最后 `response.setResponseIsReady(true)`。

**线程模型**：`onInterceptRequest` 在 ArkUI JS 线程触发，NAPI `dispatchHttpsIntercept` 在同线程被调用。`custom_protocol_async` 闭包可能立即同步调 responder（资源已缓存），也可能异步调（文件 IO、网络）。responder 触发时通过 TSFN NonBlocking 调度回 ArkUI JS 线程执行 `applyResponse` 回调（遵守 ohos-constraints §1.2：禁止 `run_on_main_thread + recv()` 阻塞模式）。

#### Scenario: dispatchHttpsIntercept rewrites URL and invokes handler
- **WHEN** ArkTS 调用 `dispatchHttpsIntercept("https://tauri.localhost/index.html", applyResponse)`
- **THEN** Rust SHALL 把 URL 还原为 `"tauri://localhost/index.html"`
- **AND** SHALL 构造 `Request` 并调用 `"tauri"` 对应的 `custom_protocol_async` 闭包
- **AND** SHALL 把闭包的 `RequestAsyncResponder` 包装成调用 `applyResponse({statusCode, headers, mimeType, body})`

#### Scenario: responder applies response fields and marks ready
- **WHEN** `custom_protocol_async` 闭包调 `responder.respond(Response{ status: 200, headers: {"content-type": "text/html"}, body: b"<html>...</html>" })`
- **THEN** Rust SHALL 通过 NAPI `Function::call` 调用 `applyResponse`，参数为 `{ statusCode: 200, headers: [{headerKey:"content-type", headerValue:"text/html"}], mimeType: "text/html", body: Uint8Array }`
- **AND** ArkTS `applyResponse` SHALL 调用 `response.setResponseCode(200)`、`response.setResponseMimeType("text/html")`、`response.setResponseHeader([...])`、`response.setResponseData(uint8Array)`
- **AND** SHALL 调用 `response.setResponseIsReady(true)` 触发 ArkWeb 交付响应

#### Scenario: handler returns error response
- **WHEN** `custom_protocol_async` 闭包调 `responder.respond(Response{ status: 404, body: b"not found" })`
- **THEN** Rust SHALL 调 `applyResponse({ statusCode: 404, ... })`
- **AND** ArkTS SHALL 调 `response.setResponseCode(404)` 与 `setResponseIsReady(true)`
- **AND** ArkWeb SHALL 把该响应作为 404 交付给页面

#### Scenario: unknown protocol returns null response (defensive)
- **WHEN** ArkTS 调用 `dispatchHttpsIntercept("https://unknown.localhost/x", applyResponse)` 但 `"unknown"` 不在该 webview 的 custom_protocol 集合中
- **THEN** Rust SHALL 不调用任何闭包
- **AND** SHALL 通过 `applyResponse({ statusCode: 404, body: empty, mimeType: "text/plain" })` 通知 ArkTS
- **AND** ArkTS SHALL 调 `setResponseIsReady(true)` 让 ArkWeb 终结该请求
- **NOTE**：这是防御性路径——正常情况下 ArkTS 侧 `onInterceptRequest` 已经过滤了未知协议；此场景仅在「ArkTS 协议集合与 Rust 闭包集合不一致」时触发

### Requirement: WebviewInitData SHALL carry use_https_intercept and https_intercept_protocols fields

Rust NAPI 结构 `WebViewInitData` SHALL 新增字段：

- `use_https_intercept: Option<bool>`
- `https_intercept_protocols: Option<Vec<String>>`

ArkTS 侧 `WebviewInitData` 接口（`DefaultWebview.ets`）SHALL 新增对应字段：

- `useHttpsIntercept?: boolean`
- `httpsInterceptProtocols?: string[]`

`ArkHelper.ets` `createWebview` / `createEmbeddedWebview` SHALL 在构造 `WebviewInitData` 透传对象时保留这两个字段（不剥离、不重命名）。

#### Scenario: fields flow from Rust to ArkTS
- **WHEN** wry 调用 `WebViewBuilder::new().use_https_intercept(true).https_intercept_protocols(["tauri"]).build()`
- **THEN** `WebViewInitData.use_https_intercept = Some(true)` 经 NAPI 传到 ArkTS
- **AND** ArkTS `data.useHttpsIntercept === true`
- **AND** ArkTS `data.httpsInterceptProtocols` 深度等于 `["tauri"]`

#### Scenario: fields default to false/empty when not set
- **WHEN** wry 不调用 `use_https_intercept` 与 `https_intercept_protocols`
- **THEN** `WebViewInitData.use_https_intercept = Some(false)`（或 `None`，ArkTS 侧 `undefined`）
- **AND** ArkTS `data.useHttpsIntercept` 为 `false` 或 `undefined`（falsy）
- **AND** `onInterceptRequest` SHALL NOT 被挂载

### Requirement: JsHelper interface SHALL include registerHttpsIntercept method

`Utils.ets` 的 `JsHelper` 接口 SHALL 新增 `registerHttpsIntercept: (protocols: string[]) => void` 方法签名，使 `ProxyJsHelper` 和 `buildJsHelper` 返回的对象均需实现此方法。

#### Scenario: ProxyJsHelper caches registerHttpsIntercept when controller not ready
- **WHEN** controller 未就绪时调用 `proxy.registerHttpsIntercept(["tauri"])`
- **THEN** `ProxyJsHelper` SHALL 将操作缓存到 `pendingOperations`
- **AND** 当 `bindToRealController` 被调用时 SHALL 回放 `registerHttpsIntercept(["tauri"])` 到真实 controller

#### Scenario: buildJsHelper returns object with registerHttpsIntercept stub
- **WHEN** `buildJsHelper(controller)` 返回 `JsHelper` 对象
- **THEN** 返回对象 SHALL 包含 `registerHttpsIntercept` no-op 桩函数（随后被 `ArkHelper.ets` 覆盖为真实实现）

### Requirement: cfg isolation SHALL keep OHOS https-intercept code out of other platforms

所有为支持 `with_https_scheme` 而新增的代码（URL 改写、`use_https_intercept` 字段、`register_https_intercept` NAPI 方法、`onInterceptRequest` 挂载、`dispatchHttpsIntercept` NAPI 函数）SHALL 通过 `cfg(target_env = "ohos")` 隔离，不影响 Windows/macOS/Linux/Android/iOS 的现有代码路径。

`custom_protocol_workaround` 模块（已存在，Android 共享）SHALL 在 OHOS 上也复用，不重复实现 URL 改写逻辑。

#### Scenario: OHOS-only fields do not appear on other platforms
- **WHEN** 在 Windows/macOS/Linux 上编译 wry
- **THEN** `PlatformSpecificWebViewAttributes` SHALL NOT 包含 `use_https` 或 `use_https_intercept` 字段
- **AND** `WebViewBuilderExtOhos` trait SHALL NOT 在非 OHOS 平台可见

#### Scenario: custom_protocol_workaround shared between Android and OHOS
- **WHEN** OHOS 编译 wry
- **THEN** `wry/src/custom_protocol_workaround.rs` SHALL 被复用（不创建 OHOS 专属副本）
- **AND** `apply_uri_work_around(url, "https", protocol)` 与 `revert_uri_work_around(url, "https", protocol)` SHALL 在 OHOS 上下文中可用

### Requirement: Secure-context behavior SHALL be verified on device (verification gate)

本特性的最终验收标准是 **`https://<scheme>.localhost` origin 下 secure-context API 可用**——即页面内 `window.isSecureContext === true` 且 `crypto.subtle.digest(...)` 等 secure-only API 不抛错。此为运行时行为，依赖 ArkWeb 对 `https://<custom-scheme>.localhost` origin 的 secure-context 判定，无法仅靠编译期或单元测试断言，必须在设备端验证。

#### Scenario: secure context flag true under https scheme
- **WHEN** `with_https_scheme(true)` 且 webview 加载 `https://tauri.localhost/index.html`
- **THEN** 页面内 `window.isSecureContext` SHALL 等于 `true`
- **AND** `crypto.subtle` SHALL 不为 `undefined`

#### Scenario: crypto.subtle digest succeeds under https scheme
- **WHEN** 页面执行 `await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hello'))`
- **THEN** SHALL 返回 `ArrayBuffer`（不抛 `TypeError: crypto.subtle is undefined`）

#### Scenario: fallback when ArkWeb does not treat custom https origin as secure
- **WHEN** 设备验证发现 `https://tauri.localhost` 下 `window.isSecureContext === false` 或 `crypto.subtle` 不可用
- **THEN** 该 Scenario 标记为「未通过设备验证」，设计 SHALL 回退到 plan 的「未知项 3」分支：
  - 评估改用 `https://localhost.<protocol>/` 反向域名形态
  - 或评估 `OH_ArkWeb_RegisterCustomSchemes` + Standard option 的方案
  - 或在文档中显式标注「OHOS 不支持 secure-context 自定义 origin」并保留 `with_https_scheme` API 形态为 no-op + warn

#### Scenario: ipc_handler URL preserves https origin
- **WHEN** `with_https_scheme(true)` 且 webview 内 IPC 触发 `ipc_handler(Request{ uri })`
- **THEN** wry OHOS `ipc_handler` 收到的 `Request::uri()` SHALL 为 `https://tauri.localhost/...`（与 webview 当前 url 一致）
- **AND** `url()` 方法 SHALL 返回 `https://tauri.localhost/...`
- **NOTE**：现有 `InnerWebView::new_inner` 的 `on_controller_attach` IPC 注册闭包从 `ipc_webview.url()` 读取 url——在 https 模式下 url 已是 `https://...`，无需额外改写
