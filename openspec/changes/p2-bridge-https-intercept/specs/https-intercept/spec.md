# https-intercept 规格规格

## 事件名称

`https-intercept`

## 方向

ArkTS → Rust（同步 main-thread event）

## 调用时机

ArkWeb `onInterceptRequest` 回调触发。当请求 URL 匹配 `https://<protocol>.localhost/<path>` 且 `<protocol>` 在该 WebView 的 live protocol set 中时，通过 `context.invokeNativeSync` 同步调用 Rust handler。

## 调用链路

```
ArkWeb onInterceptRequest 回调
  → handleHttpsIntercept(data, context, event)
  → context.invokeNativeSync("https-intercept", reqType, respType, payload)
  → BridgeHost.invokeNativeSync(pluginId, "https-intercept", ...)
  → mainThreadEventSink("ohos.webview", "https-intercept", reqType, respType, value)
  → NAPI on_bridge_sync_event(env, pluginId, event, reqType, respType, value)
  → BridgeMainThreadEvent::new(env, ...)
  → BridgePluginRegistry::dispatch_main_thread_event(event)
  → WebviewBridgePlugin::on_main_thread_event(event)
  → event.decode::<WebviewHttpsInterceptRequest>()?
  → callbacks::https_intercept_decision(request)?
  → event.respond(WebviewHttpsInterceptResponse { ... })
  → 返回 Unknown<'env> → NAPI return → ArkTS ESObject
  → 构造 WebResourceResponse → 返回给 ArkWeb
```

## 请求类型

**类型名**：`ohos.webview.HttpsInterceptRequest`

**Rust**：
```rust
#[napi(object)]
#[derive(Clone)]
pub struct WebviewHttpsInterceptRequest {
    pub id: String,
    pub native_tag: String,
    pub url: String,
}
```

**ArkTS**：
```typescript
interface WebviewHttpsInterceptRequest {
    id: string;
    nativeTag: string;
    url: string;
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | WebView 业务 ID |
| `nativeTag` | `string` | ArkWeb controller tag |
| `url` | `string` | 完整请求 URL（`https://<protocol>.localhost/<path>`） |

## 响应类型

**类型名**：`ohos.webview.HttpsInterceptResponse`

**Rust**：
```rust
#[napi(object)]
#[derive(Clone)]
pub struct WebviewHttpsInterceptResponse {
    pub handled: bool,
    pub status: u16,
    pub mime_type: String,
    pub body: Vec<u8>,
}
```

**ArkTS**：
```typescript
interface WebviewHttpsInterceptResponse {
    handled: boolean;
    status: number;
    mimeType: string;
    body: Uint8Array;
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `handled` | `boolean` | `true` = 拦截并返回自定义响应；`false` = 不拦截，ArkWeb 使用默认网络栈 |
| `status` | `u16` / `number` | HTTP 状态码（`handled=false` 时为 0） |
| `mimeType` | `string` | 响应 MIME 类型（`handled=false` 时为空字符串） |
| `body` | `Vec<u8>` / `Uint8Array` | 响应体原始字节（`handled=false` 时为空数组） |

## ArkTS 响应构造

```typescript
function buildWebResourceResponse(resp: WebviewHttpsInterceptResponse): WebResourceResponse | null {
    if (!resp || !resp.handled) return null;
    const response = new WebResourceResponse();
    response.setResponseData(new Uint8Array(resp.body).buffer);
    response.setResponseMimeType(resp.mimeType);
    response.setResponseCode(resp.status);
    response.setResponseIsReady(true);
    return response;
}
```

## 失败回退

- bridge dispatch 抛出异常时，`handleHttpsIntercept` 返回 `null`，ArkWeb 使用默认网络栈
- Rust handler 返回 `handled=false` 时，ArkTS 返回 `null`
- URL 不匹配 `https://` 前缀或 protocol 不在 live set 时，不触发 bridge dispatch，直接返回 `null`

## 上下文要求

- `required_contexts_for_main_thread_event("https-intercept")` 返回 `[UiContext]`（默认值）
- WebView 必须已通过 `onControllerAttached` 完成控制器初始化

## 相关 action

### `register-https-intercept`（Rust → ArkTS，async）

注册 custom protocol 名称到 WebView 的 live protocol set。

**请求类型**：`ohos.webview.RegisterHttpsInterceptRequest`
```rust
#[napi(object)]
pub struct WebviewRegisterHttpsInterceptRequest {
    pub id: String,
    pub protocols: Vec<String>,
}
```

**响应类型**：`ohos.webview.Acknowledgement`（复用现有）

ArkTS 侧将 `protocols` 合并到 `ManagedWebview.httpsInterceptProtocols: Set<string>` 中（去重）。后续 `onInterceptRequest` 回调读取此 Set 决定是否拦截。

## 旧 NAPI 散函数废弃

| 废弃项 | 替代方案 |
|--------|---------|
| `dispatch_https_intercept` NAPI 散函数 | `on_bridge_sync_event` → `https-intercept` event |
| `HTTPS_INTERCEPT_REGISTRY` thread_local | bridge plugin 注册的 handler 闭包 |
| `Webview::set_https_intercept_handler` | `register-https-intercept` action + bridge callback |
| `_legacy/DefaultWebview.ets` `handleInterceptRequest` | `WebviewPlugin.ets` `handleHttpsIntercept` |
| JSON + base64 响应编码 | `WebviewHttpsInterceptResponse` 具名 NAPI object + `Vec<u8>` body |
