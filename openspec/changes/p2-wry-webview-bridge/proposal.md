# Phase B2: wry webview 改写

## 概述

将 wry 的 OHOS webview 后端 (`wry/src/ohos/mod.rs`) 从旧的 `openharmony_ability::Webview` / `WebViewBuilder` 直接 NAPI 模型重写为 A0/A1 引入的 `openharmony-ability-plugin-webview` facade（`WebviewClient` + `WebviewHandle` + `WebviewCallbacksBuilder` + `bridgeInvoke` 具名契约）。

旧模型中 wry 持有 `openharmony_ability::Webview`（一个包装 NAPI `ObjectRef` 的同步类型），通过 `.load_url()` / `.evaluate_script_with_callback()` / `.on_navigation_request()` 等方法直接操作 ArkWeb。新模型中 wry 持有 `plugin_webview::WebviewHandle`（一个 `{ client: WebviewClient, id: String }` 的 async 句柄），所有操作通过 `bridgeInvoke("ohos.webview", action, req, resp)` TSFN 传输层完成，反向回调通过 `BridgePlugin::on_main_thread_event` 分发到 `WebviewCallbacksBuilder` 注册的 Rust 闭包。

这是 **all-or-nothing 迁移**：`OhosWebviewHandle` 类型一换，~20 个方法 + 7 个反向回调 + builder 构造必须同时迁移，否则全部编译失败。无法分 action 逐步验证，整体改完能编译通过是唯一验证点。

## 动机

A0 (PR #67/#68) 将 openharmony-ability 重构为 pluginized bridge 架构，`helper/webview.rs` 中的旧 `Webview` / `WebViewBuilder` 被搬入 `_legacy/` 目录（虽然仍可编译，但已被标记为遗留）。A1 补齐了 plugin-webview facade 的所有 action（print / drag / new-window / page-begin-end / set-user-agent / close-window 路由）。

wry 的 OHOS 后端当前直接依赖旧 API，存在以下问题：

1. **架构不一致** — wry 是唯一仍消费旧 `openharmony_ability::Webview` 类型的消费方（tao B1 / tray-icon B4 已完成迁移）。旧类型绕过 bridge 的类型契约检查和 context 就绪保护。
2. **回调模型不安全** — 旧 `on_navigation_request` / `on_download_start` 等通过 `Function` 闭包 + NAPI `ObjectRef` 跨线程共享，依赖 `unsafe impl Send`。新模型通过 `BridgeMainThreadEvent`（非 Send / 非 Sync，env 作用域内同步响应）+ Rust 端 `WebviewCallbacksBuilder`（纯 Rust 闭包，`Arc<dyn Fn + Send + Sync>`）彻底消除 NAPI 对象逃逸。
3. **controller 代际隔离** — 新模型引入 `native_tag`（进程唯一 controller 代际标识），`callbacks.rs` 中 `controller::is_current()` 拒绝来自被替换 WebView 的过期回调。旧模型无此保护，替换 WebView 后旧回调仍会触发。
4. **close-window 路由** — A1 新增的 `close-window.invalid` URL 路由到专用 `on_close_window` 回调（而非通用 navigation handler），旧模型不支持。
5. **同步/异步契约** — 旧 NAPI 调用是同步的，新 bridge 是 async（TSFN + Promise + oneshot）。wry 公共 API 是同步的（`pub fn load_url(&self, url: &str) -> Result<()>`），需要适配层。

## 影响范围

### 主要改动文件

| 仓库 | 文件 | 改动类型 | 说明 |
|------|------|---------|------|
| wry | `src/ohos/mod.rs` | 重写 ~820 行 | `InnerWebView` 重写、`OhosWebviewHandle` 重定义、~20 方法迁移、7 反向回调迁移、IPC/cutom-protocol/https-intercept 适配 |
| wry | `src/lib.rs` | 修改 ~15 行 | `PlatformSpecificWebViewAttributes` 新增 `bridge_runtime` 字段、`WebViewBuilderExtOhos::with_bridge_runtime` 方法、`WebViewExtOhos::webview_handle` 返回类型适配 |
| wry | `Cargo.toml` | 修改 ~5 行 | 新增 `openharmony-ability-plugin-webview` 依赖 |
| tao | `src/platform/ohos.rs` | 新增 ~10 行 | `WindowExtOpenHarmony` 新增 `fn bridge_runtime()` 方法（暴露 `BridgeRuntime`） |
| tauri-runtime-wry | `crates/tauri-runtime-wry/src/lib.rs` | 修改 ~5 行 | OHOS 分支调用 `window.bridge_runtime()` 并通过 `with_bridge_runtime()` 传入 wry builder |
| openharmony-ability | `crates/plugin-webview/src/lib.rs` | 新增 ~10 行 | `WebviewClient::from_bridge(bridge: BridgeRuntime)` 构造器（脱离 `OpenHarmonyApp` 依赖） |

### 不受影响

- Windows / macOS / Linux / iOS / Android 平台实现：所有改动在 `#[cfg(target_env = "ohos")]` 内，铁律 #2
- wry 公共 API 签名不变（`load_url`、`evaluate_script`、`zoom` 等签名保持同步）——async 适配在 OHOS 后端内部完成
- bridge 框架核心 (`bridge/mod.rs`)：B2 不修改 bridge 框架本身，仅消费 plugin-webview facade

## Capabilities

### New Capabilities

- `wry-webview-bridge-migration`: wry OHOS 后端从旧 `Webview` 类型迁移到 `WebviewHandle` + `WebviewCallbacksBuilder` 的完整规格，涵盖类型变更、方法映射、反向回调映射、同步/异步适配策略、跨仓入口传递

### Modified Capabilities

- `ohos-webview-drag-drop`: R72 拖拽回调从旧 `on_drag_and_drop(Function<String>)` 迁移到 `WebviewCallbacksBuilder::on_drag_enter/over/drop/leave`（4 个独立事件，path 仅在 drop 时提取）
- `ohos-on-window-new`: 新窗口回调从旧 `on_window_new(Fn)` 迁移到 `WebviewCallbacksBuilder::on_new_window_request(Fn -> bool)`；`NewWindowResponse::Create` 仍不支持（bridge 层只返回 `{ allow: bool }`）
- `ohos-webview-https-scheme`: https 拦截保留 thread_local 注册（B3 迁移到 bridge），`set_https_intercept_handler` 改为直接写 thread_local registry 而非旧 `Webview` 方法
- `ohos-webview-print`: 打印从旧 `Webview::print(path)` 迁移到 `WebviewHandle::create_pdf(path)` + `print` action
- `ohos-webview-user-agent`: UA 从旧 builder 方法迁移到 `WebviewHandle::set_user_agent` / create 请求字段
- `ohos-webview-flag-clipboard` / `ohos-webview-flag-zoom-hotkeys`: create 请求字段透传不变

## Impact

- **wry 仓库**: ~3 个文件（`src/ohos/mod.rs` 重写 + `src/lib.rs` 字段 + `Cargo.toml`）
- **tao 仓库**: ~1 个文件（`src/platform/ohos.rs` 新增 trait 方法）
- **tauri-runtime-wry**: ~1 个文件（OHOS builder 分支）
- **openharmony-ability**: ~1 个文件（plugin-webview 新增构造器）
- **编译验证**: `cargo check --target aarch64-unknown-linux-ohos` + `cargo check`（Windows host，确认不影响其他平台）
- **HAR 包**: 若 plugin-webview 新增 `from_bridge` 构造器涉及 ArkTS 变更则需重建 HAR（预计不涉及——纯 Rust facade 方法）
- **all-or-nothing**: 类型一换全部编译失败，无中间验证点
