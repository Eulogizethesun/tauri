# Phase A2: R75 https 拦截技术验证

## 概述

在 openharmony-ability 完成 PR #67/#68（A0）引入 pluginized bridge 架构、以及 A1 补全 webview bridge action 之后，需要验证新的 bridge 模型能否支持 R75 https 拦截所需的**同步 request/response 语义**。

R75 https 拦截的核心场景：ArkWeb 的 `onInterceptRequest` 回调是**同步回调**，必须在回调返回前构造并返回 `WebResourceResponse`。旧模型通过 thread_local registry + 同步阻塞 NAPI `dispatch_https_intercept` 散函数实现；新 bridge 模型需验证能否在 `on_main_thread_event` 回调中、在 NAPI env 失效前同步执行 Rust 闭包并返回响应。

## 动机

A0/A1 引入的 pluginized bridge 架构将所有 ArkTS↔Rust 通信收口到 `BridgeHost` + `BridgePluginRegistry`。R75 https 拦截是 B2（wry webview 改写）的关键前置依赖——wry 的 `with_webview` hook 需要注册 custom protocol handler，而这些 handler 在 OHOS 上通过 `onInterceptRequest` 拦截 `https://<protocol>.localhost/<path>` 请求来触发。

如果新 bridge 模型无法支持同步 request/response 语义，则 R75 必须保留旧 NAPI 散函数（`dispatch_https_intercept`）作为 bridge 框架旁路，增加维护成本和架构不一致性。本 phase 的目标是确认方案可行性并选定实现路径。

## 影响范围

### 核心验证文件（只读分析）

| 文件 | 用途 |
|------|------|
| `crates/ability/src/bridge/mod.rs` | Bridge 核心：`BridgeMainThreadEvent`、`respond()`、`dispatch_main_thread_event` |
| `crates/derive/src/lib.rs` | `on_bridge_sync_event` NAPI 导出生成 |
| `crates/ability/src/app.rs` | `dispatch_bridge_main_thread_event` 转发 |
| `native_ability/src/main/ets/bridge/BridgeHost.ets` | ArkTS 侧 `invokeNativeSync` 同步分发 |
| `plugins/webview/src/main/ets/WebviewPlugin.ets` | 当前 webview 插件 `BuildWebview`（无 `onInterceptRequest`） |
| `crates/plugin-webview/src/lib.rs` | Rust 侧 `on_main_thread_event` 分发 |
| `crates/ability/src/_legacy/helper_webview.rs` | 旧 `dispatch_https_intercept` NAPI 散函数 |
| `native_ability/src/main/ets/_legacy/DefaultWebview.ets` | 旧 `handleInterceptRequest` ArkTS 实现 |

### 实现阶段（B2）改动文件

| 文件 | 改动类型 |
|------|---------|
| `crates/plugin-webview/src/lib.rs` | 扩展：`on_main_thread_event` 新增 `https-intercept` 分支 |
| `crates/plugin-webview/src/callbacks.rs` | 扩展：新增 `dispatch_https_intercept` 分发函数 |
| `plugins/webview/src/main/ets/WebviewPlugin.ets` | 扩展：`BuildWebview` 新增 `.onInterceptRequest` |
| `crates/ability/src/_legacy/helper_webview.rs` | 废弃：`dispatch_https_intercept` NAPI 散函数标记 deprecated |
| `native_ability/src/main/ets/_legacy/DefaultWebview.ets` | 废弃：旧 `handleInterceptRequest` 标记 deprecated |

### 不涉及的平台

- Windows / macOS / Linux：无改动（所有改动在 `cfg(target_env = "ohos")` 隔离内或 ArkTS 专属层）
