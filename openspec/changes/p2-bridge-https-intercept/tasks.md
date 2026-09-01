# Phase A2 实现任务清单

## 1. 技术验证（A2 本阶段，只读分析）

- [x] 1.1 分析 `BridgeMainThreadEvent` 的 `respond()` 方法和 env 生命周期
- [x] 1.2 分析 `on_main_thread_event` 回调的调用时序
- [x] 1.3 分析 `on_bridge_sync_event` NAPI 导出的 env 有效范围
- [x] 1.4 分析 `BridgeHost.invokeNativeSync` 的同步分发机制
- [x] 1.5 确认 `onInterceptRequest` 回调是同步回调，NAPI env 在回调期间有效（arkts-helper MCP）
- [x] 1.6 确认 `WebResourceResponse` 构造方式（`setResponseData(ArrayBuffer)` 等）
- [x] 1.7 确认已有先例：`navigationDecision` / `downloadStartDecision` 通过 `invokeNativeSync` 同步 dispatch
- [x] 1.8 评估方案 1（respond 同步返回）：✅ 可行
- [x] 1.9 评估方案 2（扩展 bridge 框架）：不必要，方案 1 已覆盖
- [x] 1.10 评估方案 3（保留散函数旁路）：可作为回退，但方案 1 验证通过后不采用
- [x] 1.11 选定方案：方案 1 — `on_main_thread_event` + `respond()` 同步返回

## 2. Rust 类型定义（B2 实现阶段）

- [x] 2.1 新增 `WebviewHttpsInterceptRequest`（`#[napi(object)]` + `impl_bridge_napi_type!`）
- [x] 2.2 新增 `WebviewHttpsInterceptResponse`（`#[napi(object)]` + `impl_bridge_napi_type!`，body 为 `Vec<u8>`）
- [x] 2.3 新增 `WebviewRegisterHttpsInterceptRequest`（`#[napi(object)]`，用于 `register-https-intercept` action）
- [x] 2.4 `WebviewCreateRequest` / `ManagedWebview` 扩展 `https_intercept_protocols` 字段（可选，若 create 时已知协议列表）

## 3. Rust bridge plugin（B2 实现阶段）

- [x] 3.1 `WebviewBridgePlugin::on_main_thread_event` 新增 `"https-intercept"` match 分支
- [x] 3.2 `callbacks::https_intercept_decision(request)` 分发函数：查找 handler 闭包，同步执行，返回 `WebviewHttpsInterceptResponse`
- [x] 3.3 `callbacks` 或 `protocol` 模块新增 handler 注册/查找机制（替代旧 `HTTPS_INTERCEPT_REGISTRY` thread_local）
- [x] 3.4 `WebviewPlugin::invokeAsync` 新增 `"register-https-intercept"` action 分支

## 4. ArkTS WebviewPlugin（B2 实现阶段）

- [x] 4.1 `BuildWebview` builder 新增 `.onInterceptRequest((event) => handleHttpsIntercept(data, pluginContext, event))`
- [x] 4.2 新增 `handleHttpsIntercept(data, context, event)` 函数：URL 匹配 → `invokeNativeSync("https-intercept", ...)` → 构造 `WebResourceResponse`
- [x] 4.3 `ManagedWebview` 新增 `httpsInterceptProtocols: Set<string>` 字段
- [x] 4.4 `invokeAsync` 新增 `"register-https-intercept"` action：合并 protocols 到 live set
- [x] 4.5 `WebviewCreatePayload` / `WebviewEventOptions` 扩展 `httpsIntercept` 相关字段（如需要）

## 5. 旧代码废弃（B2 完成后）

- [x] 5.1 `_legacy/helper_webview.rs` `dispatch_https_intercept` NAPI 函数标记 `#[deprecated]`
- [x] 5.2 `_legacy/helper_webview.rs` `HTTPS_INTERCEPT_REGISTRY` thread_local 标记废弃
- [x] 5.3 `_legacy/helper_webview.rs` `Webview::set_https_intercept_handler` / `dispatch_https_intercept` 方法标记 `#[deprecated]`
- [x] 5.4 `_legacy/DefaultWebview.ets` `handleInterceptRequest` / `buildInterceptResponse` 标记废弃

## 6. 验证

- [x] 6.1 cargo check：`crates/plugin-webview` 编译通过
- [x] 6.2 cargo check：`crates/ability` 编译通过（验证旧散函数废弃不破坏编译）
- [ ] 6.3 ArkTS 编译：`plugins/webview` 编译通过
- [ ] 6.4 设备验证：custom protocol `https://tauri.localhost/` 请求被正确拦截并返回响应
- [ ] 6.5 设备验证：未注册协议的 https 请求不受影响（返回 null，ArkWeb 默认处理）
- [ ] 6.6 设备验证：bridge dispatch 异常时回退到默认网络栈（不崩溃）
