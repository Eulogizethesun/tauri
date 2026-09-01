# Phase A2 技术设计：R75 https 拦截 bridge 可行性验证

## 1. 问题分析

### 1.1 旧模型工作方式

旧 https 拦截通过 thread_local registry + 同步 NAPI 散函数实现：

**ArkTS 侧**（`_legacy/DefaultWebview.ets:125-155`）：
```
onInterceptRequest 回调
  → handleInterceptRequest(data, event)
  → data.dispatchHttpsIntercept(url)   // 同步 NAPI 调用
  → 返回 JSON 字符串: {"status":u16,"mimeType":String,"body":"base64..."}
  → buildInterceptResponse(json) 构造 WebResourceResponse
  → 返回 WebResourceResponse
```

**Rust 侧**（`_legacy/helper_webview.rs:899-906`）：
```rust
#[napi]
pub fn dispatch_https_intercept(web_tag: String, url: String) -> Option<String> {
    let handler_rc = HTTPS_INTERCEPT_REGISTRY.with(|reg| reg.borrow().get(&web_tag).cloned());
    let handler_rc = handler_rc?;
    let handler = handler_rc.borrow();
    handler.as_ref().and_then(|h| h(url))
}
```

**关键特征**：
1. NAPI 散函数 `dispatch_https_intercept` 绕过 bridge 框架，直接通过 thread_local `HTTPS_INTERCEPT_REGISTRY` 查找 handler
2. handler 是 `Rc<RefCell<Option<HttpsInterceptHandler>>>`，只能在主线程访问
3. 返回 JSON 字符串（base64 编码 body），ArkTS 侧再解码构造 `WebResourceResponse`
4. 整个调用链完全同步：ArkTS `onInterceptRequest` → NAPI → Rust handler → 返回 JSON → ArkTS 构造响应

### 1.2 新模型约束

A0 引入的 pluginized bridge 架构有以下关键设计约束：

**`BridgeMainThreadEvent<'env>`**（`bridge/mod.rs:202-295`）：
- Non-Send, non-Sync（`PhantomData<Rc<()>>`），无法跨线程传递
- 持有 `env: &'env Env` 引用，生命周期绑定到 NAPI 回调
- `respond<T: BridgeNapiType>(&self, response: T) -> Result<Unknown<'env>>`：在 env 失效前编码响应
- `decode<T: BridgeNapiType>(&self) -> Result<T>`：解码请求

**`on_main_thread_event` trait 方法**（`bridge/mod.rs:358-367`）：
```rust
fn on_main_thread_event<'env>(
    &self,
    event: BridgeMainThreadEvent<'env>,
) -> Result<Unknown<'env>>
```
- 同步返回 `Unknown<'env>`，env 在整个回调期间有效
- 文档明确说明："the only Rust callback path permitted to synchronously influence a platform callback"

**NAPI 导出 `on_bridge_sync_event`**（`derive/src/lib.rs:153-171`）：
```rust
#[napi_derive_ohos::napi]
pub fn on_bridge_sync_event<'a>(
    env: &'a napi_ohos::Env,
    plugin_id: String, event: String,
    request_type_name: String, response_type_name: String,
    value: Unknown<'a>,
) -> napi_ohos::Result<Unknown<'a>> {
    let event = BridgeMainThreadEvent::new(env, plugin_id, event, ...)?;
    (*APP).dispatch_bridge_main_thread_event(event)
}
```
- 同步 NAPI 函数，`env` 在整个函数执行期间有效
- 调用链：ArkTS `invokeNativeSync(...)` → NAPI `on_bridge_sync_event` → `dispatch_main_thread_event` → `plugin.on_main_thread_event` → `event.respond()` → 返回 `Unknown<'env>` → NAPI 返回给 ArkTS

**ArkTS 侧 `BridgeHost.invokeNativeSync`**（`BridgeHost.ets:946-974`）：
```typescript
private invokeNativeSync(pluginId, event, requestTypeName, responseTypeName, value): ESObject {
    // ... 标识符验证 + hook error 检查 ...
    return sink(pluginId, event, requestTypeName, responseTypeName, value);
}
```
- 不检查 `entry.plugin.execution`——**任何**插件（Async 或 MainThreadSync）都可接收 `on_main_thread_event`
- `sink` 即 `mainThreadEventSink`，绑定到 NAPI `on_bridge_sync_event`

**核心问题**：`onInterceptRequest` 是 ArkWeb 同步回调，必须在回调返回前提供 `WebResourceResponse`。新 bridge 的 `on_main_thread_event` 能否在 env 失效前同步执行 Rust 闭包并返回响应？

### 1.3 ArkWeb `onInterceptRequest` 回调语义（已确认）

通过 arkts-helper MCP 确认：

1. **`onInterceptRequest` 是同步回调**——不能声明为 `async`，不能使用 `await`
2. **可以在回调中同步调用 NAPI 同步接口**并返回 `WebResourceResponse`
3. **`WebResourceResponse` 构造方式**：`new WebResourceResponse()` + setter 方法
   - `setResponseData(string | ArrayBuffer | number | Resource)` —— 支持 ArrayBuffer 二进制数据
   - `setResponseMimeType(string)`
   - `setResponseCode(number)`
   - `setResponseIsReady(boolean)`
4. **`onInterceptRequest` 在 `onLoadIntercept` 返回 `false` 后触发**，拦截主 URL 和所有子资源请求
5. **返回 `null` 表示不拦截**，由 Web 组件默认处理

## 2. 方案评估

### 2.1 方案 1：利用 `BridgeMainThreadEvent::respond()` 同步返回

**可行性：✅ 完全可行**

**证据链**：

1. **env 生命周期覆盖整个 `onInterceptRequest` 回调**

   `onInterceptRequest` 是 ArkUI 组件属性回调，在主线程同步执行。当 ArkTS 在回调内调用 `context.invokeNativeSync(...)` 时：
   - ArkTS `invokeNativeSync` → `mainThreadEventSink(...)` → NAPI `on_bridge_sync_event(env, ...)`
   - NAPI 运行时为这次调用创建/获取 `env`，整个 NAPI 调用期间 `env` 有效
   - `on_bridge_sync_event` → `dispatch_main_thread_event` → `plugin.on_main_thread_event(event)` → `event.respond(response)` 使用 `self.env`
   - 编码后的 `Unknown<'env>` 沿原路返回给 ArkTS
   - ArkTS 拿到 `ESObject` 响应，构造 `WebResourceResponse`
   - `onInterceptRequest` 返回 `WebResourceResponse`

   整条链路**完全同步**，env 在 `on_bridge_sync_event` 函数返回前一直有效。

2. **已有先例：`navigationDecision` / `downloadStartDecision` / `invokeNativeBool`**

   `WebviewPlugin.ets` 的 `onLoadIntercept` 已经通过 `data.onNavigationRequest(url)` → `navigationDecision(this.pluginContext, ...)` → `context.invokeNativeSync("navigation-request", ...)` 执行同步 bridge dispatch。`onWindowNew` 事件同样通过 `invokeNativeBool` → `invokeNativeSync` 执行同步 bridge dispatch 并返回 boolean。

   `onInterceptRequest` 与 `onLoadIntercept` 同为 ArkWeb 同步回调，调用 `invokeNativeSync` 的时序和 env 有效性完全一致。唯一区别是返回值类型：`onLoadIntercept` 返回 `boolean`，`onInterceptRequest` 返回 `WebResourceResponse`。bridge 的 `respond<T: BridgeNapiType>()` 支持任意 `#[napi(object)]` 类型，包括携带 body 字节数据的结构体。

3. **`BridgeNapiType` 已支持 `Vec<u8>`**

   `bridge/mod.rs:125-136` 已为 `Vec<u8>` 实现 `BridgeNapiType`（TYPE_NAME = `"std.bytes"`，通过 `Uint8Array` 传输）。https 拦截响应的 body 可以直接用 `Vec<u8>` 携带，无需 base64 编码/解码（旧模型的 JSON+base64 方案是因为 NAPI 散函数返回 `Option<String>` 的限制）。

**响应数据流**：
```
Rust: WebviewHttpsInterceptResponse { status: u16, mime_type: String, body: Vec<u8> }
  → event.respond() → into_bridge_value(env) → NAPI object { status, mime_type, body: Uint8Array }
  → NAPI return → ArkTS ESObject
  → ArkTS: const resp = context.invokeNativeSync(...) as WebviewHttpsInterceptResponse
  → const response = new WebResourceResponse()
  → response.setResponseData(new Uint8Array(resp.body).buffer)  // ArrayBuffer
  → response.setResponseMimeType(resp.mimeType)
  → response.setResponseCode(resp.status)
  → response.setResponseIsReady(true)
  → return response
```

**选定为实施方案。**

### 2.2 方案 2：扩展 bridge 框架支持同步双向 dispatch

**可行性：✅ 但不必要**

方案 2 提议在 `bridge/mod.rs` 中新增同步请求/响应通道，使 Rust worker 线程能同步等待 ArkTS 响应。但分析方案 1 后发现：

1. R75 https 拦截的调用方向是 **ArkTS → Rust**（`onInterceptRequest` → Rust handler → 返回响应），而非 Rust → ArkTS
2. ArkTS → Rust 方向的同步 dispatch 已经由 `on_main_thread_event` + `respond()` 完整支持
3. Rust → ArkTS 方向的同步 dispatch（`BridgeMainThread::call_sync` / `call_sync_from_worker`）已存在，但 https 拦截不需要这个方向

方案 2 解决的是一个**不存在的问题**。新 bridge 框架已原生支持 R75 所需的同步 ArkTS→Rust request/response 语义。

**工作量**：不适用（无需扩展）。

### 2.3 方案 3：保留散函数旁路

**可行性：✅ 但有维护成本**

方案 3 提议 R75 不走 bridge，保留 `dispatch_https_intercept` NAPI 散函数作为 bridge 框架旁路。

**维护成本**：
1. **双套通信模型**：bridge 插件走 `BridgeHost` + `BridgePluginRegistry`，https 拦截走 thread_local registry + NAPI 散函数，增加认知负担
2. **生命周期割裂**：thread_local `HTTPS_INTERCEPT_REGISTRY` 不受 bridge session 生命周期管理，Ability 销毁后可能残留 handler（需手动清理）
3. **类型安全缺失**：NAPI 散函数返回 `Option<String>`（JSON），无编译期类型检查；bridge 的 `BridgeNapiType` 提供具名类型契约
4. **数据编码开销**：旧模型强制 base64 编码 body（String NAPI 返回值限制），bridge 模型可直接传 `Vec<u8>` / `Uint8Array`

**结论**：方案 3 可作为回退方案，但方案 1 验证可行后不应采用。

## 3. 选定方案：方案 1 — `on_main_thread_event` + `respond()` 同步返回

### 3.1 类型契约

**请求类型**（Rust `#[napi(object)]`，ArkTS 对应 interface）：

```rust
// crates/plugin-webview/src/lib.rs
#[napi(object)]
#[derive(Clone)]
pub struct WebviewHttpsInterceptRequest {
    pub id: String,         // WebView 业务 ID
    pub native_tag: String, // ArkWeb controller tag
    pub url: String,        // 完整 https://<protocol>.localhost/<path> URL
}

impl_bridge_napi_type!(WebviewHttpsInterceptRequest, "ohos.webview.HttpsInterceptRequest");
```

```typescript
// WebviewPlugin.ets
interface WebviewHttpsInterceptRequest {
    id: string;
    nativeTag: string;
    url: string;
}
const HTTPS_INTERCEPT_REQUEST_TYPE = "ohos.webview.HttpsInterceptRequest";
```

**响应类型**：

```rust
#[napi(object)]
#[derive(Clone)]
pub struct WebviewHttpsInterceptResponse {
    pub handled: bool,       // false = 不拦截，返回 null 给 ArkWeb
    pub status: u16,         // HTTP 状态码
    pub mime_type: String,   // MIME 类型
    pub body: Vec<u8>,        // 响应体原始字节（Uint8Array 传输）
}

impl_bridge_napi_type!(WebviewHttpsInterceptResponse, "ohos.webview.HttpsInterceptResponse");
```

```typescript
interface WebviewHttpsInterceptResponse {
    handled: boolean;
    status: number;
    mimeType: string;
    body: Uint8Array;  // Vec<u8> → Uint8Array
}
const HTTPS_INTERCEPT_RESPONSE_TYPE = "ohos.webview.HttpsInterceptResponse";
```

### 3.2 ArkTS 侧：`onInterceptRequest` 挂载

在 `WebviewPlugin.ets` 的 `BuildWebview` builder 中新增 `.onInterceptRequest`：

```typescript
// BuildWebview 内 Web() 链式调用
.onInterceptRequest((event: { request: WebResourceRequest }) => {
    return handleHttpsIntercept(data, this.pluginContext, event);
})
```

```typescript
function handleHttpsIntercept(
    data: ManagedWebview,
    context: BridgePluginContext,
    event: { request: WebResourceRequest },
): WebResourceResponse | null {
    const url = event.request.getRequestUrl();
    if (!url || !url.startsWith('https://')) return null;

    // 协议匹配：仅拦截已注册的 custom protocol
    const rest = url.substring('https://'.length);
    const dotIdx = rest.indexOf('.');
    if (dotIdx <= 0) return null;
    const protocol = rest.substring(0, dotIdx);
    // data 上维护一个 protocol set（通过 register-https-intercept action 注册）
    if (!data.httpsInterceptProtocols?.has(protocol)) return null;

    try {
        const response = context.invokeNativeSync(
            "https-intercept",
            HTTPS_INTERCEPT_REQUEST_TYPE,
            HTTPS_INTERCEPT_RESPONSE_TYPE,
            new WebviewHttpsInterceptRequestPayload(data.id, data.nativeTag, url) as ESObject,
        ) as WebviewHttpsInterceptResponse;
        if (!response || !response.handled) return null;

        const webResponse = new WebResourceResponse();
        const bodyBuffer = new Uint8Array(response.body).buffer;
        webResponse.setResponseData(bodyBuffer);
        webResponse.setResponseMimeType(response.mimeType);
        webResponse.setResponseCode(response.status);
        webResponse.setResponseIsReady(true);
        return webResponse;
    } catch (error) {
        console.error("WebView https-intercept failed: " + String(error));
        return null; // 失败时回退到默认网络栈
    }
}
```

### 3.3 Rust 侧：`on_main_thread_event` 分发

在 `crates/plugin-webview/src/lib.rs` 的 `on_main_thread_event` 中新增分支：

```rust
"https-intercept" => {
    let request = event.decode::<WebviewHttpsInterceptRequest>()?;
    event.respond(callbacks::https_intercept_decision(request)?)
}
```

在 `callbacks.rs` 中新增分发函数：

```rust
pub fn https_intercept_decision(
    request: WebviewHttpsInterceptRequest,
) -> Result<WebviewHttpsInterceptResponse> {
    let (webview_id, native_tag) = (&request.id, &request.native_tag);
    // 查找该 webview 注册的 custom protocol handler 闭包
    // 同步执行 handler，返回响应
    let handler = protocol::lookup_https_handler(webview_id, &request.url)?;
    match handler(&request.url) {
        Some(response) => Ok(WebviewHttpsInterceptResponse {
            handled: true,
            status: response.status,
            mime_type: response.mime_type,
            body: response.body,
        }),
        None => Ok(WebviewHttpsInterceptResponse {
            handled: false,
            status: 0,
            mime_type: String::new(),
            body: Vec::new(),
        }),
    }
}
```

### 3.4 协议注册：`register-https-intercept` action

新增一个 async bridge action `register-https-intercept`，让 Rust 侧（wry 的 `with_webview` hook）注册 custom protocol 名称到 webview 的 live protocol set：

```rust
// Rust → ArkTS 方向（async bridge call）
pub async fn register_https_intercept(&self, protocols: Vec<String>) -> Result<()> {
    self.client
        .call_async::<WebviewBridgePlugin, WebviewRegisterHttpsInterceptRequest, WebviewAcknowledgement>(
            "register-https-intercept",
            WebviewRegisterHttpsInterceptRequest { id: self.id.clone(), protocols },
            BridgeCallOptions::default(),
        )
        .await?;
    Ok(())
}
```

ArkTS 侧 `WebviewPlugin.invokeAsync` 新增 `register-https-intercept` action，将 protocols 合并到 `ManagedWebview.httpsInterceptProtocols` Set 中。

### 3.5 旧散函数废弃

`_legacy/helper_webview.rs` 中的 `dispatch_https_intercept` NAPI 函数和 `HTTPS_INTERCEPT_REGISTRY` thread_local 在 B2 wry 改写完成后标记 `#[deprecated]`，不再被新代码引用。旧 `_legacy/DefaultWebview.ets` 的 `handleInterceptRequest` 同步废弃。

### 3.6 实现注意事项（A2 审计补充）

以下三点经 A2 审计（对照 ArkTS 官方文档与 `BridgeHost.ets`/`WebviewPlugin.ets` 源码）确认，不影响方案 1 可行性，但 B2 实现阶段需知悉：

1. **`setResponseIsReady(false)` 异步逃逸路径**：ArkWeb `onInterceptRequest` 虽然是同步回调，但支持 `setResponseIsReady(false)` 异步模式——先返回未就绪的 `WebResourceResponse`，异步填充数据后再 `setResponseIsReady(true)`。本设计默认 `setResponseIsReady(true)` 同步返回（与旧模型一致，handler 执行快）。若 B2 发现某些 custom protocol handler 耗时（如大文件读取），可改用 `setResponseIsReady(false)` + TSFN 异步回填，无需改动 bridge 类型契约。

2. **`onInterceptRequest` vs `onInterceptRequestEx`**：`onInterceptRequestEx`（API 12+）可通过 `event.request.getRequestData()` 读取 POST 请求体。R75 custom protocol 拦截（`https://<protocol>.localhost/<path>`）以 GET 资源请求为主，`onInterceptRequest` 足够。若后续需要拦截 POST 请求体，可升级为 `onInterceptRequestEx`，bridge 类型契约不变。

3. **响应头缺失**：当前 `WebviewHttpsInterceptResponse` 不含 `headers` 字段（与旧 JSON 模型 `{"status","mimeType","body"}` 一致，非回归）。ArkWeb `WebResourceResponse` 支持 `setResponseHeader(Array<Header>)`。若 B2 发现 custom protocol 需要自定义响应头（CORS、Cache-Control 等），可在响应类型中新增 `headers: HashMap<String, String>` 字段，ArkTS 侧调用 `setResponseHeader`，不影响 bridge 机制。

## 4. 约束遵守

### 4.1 OHOS 三条铁律

1. **openharmony-ability 是唯一 ArkTS 桥接仓** — ✅ 所有改动在 `openharmony-ability` 内部，不涉及其他仓直接调用 ArkTS API
2. **不影响其他平台** — ✅ 所有 Rust 改动在 `cfg(target_env = "ohos")` 隔离内，ArkTS 改动在 OHOS 专属层
3. **OHOS_DEVICE_TYPE 决定设备形态** — ✅ https 拦截是通用能力，不区分 desktop/mobile

### 4.2 Bridge 架构约束

1. **`BridgeMainThreadEvent` non-Send/non-Sync** — ✅ 响应在 `on_main_thread_event` 回调内同步构造并返回，不跨线程（`bridge/mod.rs:202-210` `PhantomData<Rc<()>>`）
2. **env 生命周期** — ✅ env 在整个 `on_bridge_sync_event` NAPI 调用期间有效，覆盖 `onInterceptRequest` 回调全程（`derive/src/lib.rs:153-171` `env: &'a Env` → `BridgeMainThreadEvent::new(env, ...)` → `respond()` 使用 `self.env` → 返回 `Unknown<'env>`；`app.rs:589-594` `dispatch_bridge_main_thread_event` 转发到 `dispatch_main_thread_event`）
3. **具名 NAPI 类型契约** — ✅ 请求/响应使用 `impl_bridge_napi_type!` 声明稳定类型名（`bridge/mod.rs:82-102` 宏 + `respond()` 内 `response_type_name` 校验）
4. **不检查 `execution` mode** — ✅ `BridgeHost.invokeNativeSync`（`BridgeHost.ets:946-974`）不检查 `entry.plugin.execution`，仅检查 session active / identifier / hookError。`invokeSync`（905-944）检查 execution 但那是 Rust→ArkTS 出站路径，与入站 `on_main_thread_event` 无关。`WebviewPlugin` extends `AsyncPluginBase`（Async），已有 `navigationDecision`/`downloadStartDecision`/`invokeNativeBool` 三个先例通过 `invokeNativeSync` 接收 `on_main_thread_event`

### 4.3 ArkWeb 回调约束

1. **`onInterceptRequest` 同步** — ✅ bridge dispatch 链路全程同步，无 `await`（arkts-helper MCP 确认 `onInterceptRequest` 是同步回调）
2. **`WebResourceResponse` 构造** — ✅ 使用 `setResponseData(ArrayBuffer)` + `setResponseMimeType` + `setResponseCode` + `setResponseIsReady`（arkts-helper MCP 确认 setter 方法签名）
3. **失败回退** — ✅ bridge dispatch 异常时返回 `null`，ArkWeb 使用默认网络栈
4. **无死锁风险** — ✅ 全程同步调用链（ArkTS → NAPI → Rust → 返回），无 `run_on_main_thread + rx.recv()` 阻塞模式，无 TSFN 跨线程等待，与 `onLoadIntercept` 已验证模式一致
