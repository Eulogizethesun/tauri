## Why

Tauri `unstable` feature 的核心 API `Window::add_child` 被 `not(target_env = "ohos")` 显式排除（`window/mod.rs:1176`），导致 OHOS desktop 上无法创建多 webview。Phase 1 已补齐 wry/OHA 底层几何能力（`set_bounds`/`set_visible`/`bounds`），Phase 2 已修复 Reparent 死锁。Phase 3 移除最后一处排除，使整个 unstable feature 链路在 OHOS desktop 上编译并可用。

## What Changes

- **移除 `add_child` 的 OHOS 排除**：`window/mod.rs:1174-1177` 的 `#[cfg(all(any(test, all(desktop, feature = "unstable")), not(target_env = "ohos")))]` 改为 `#[cfg(all(any(test, all(desktop, feature = "unstable"))))]`
- **不修改其他文件**：`create_webview` 插件命令（`plugin.rs:163`）、`WebviewBuilder::build`（`mod.rs:803`）、`desktop_commands` 模块（`plugin.rs:75`）、Manager 方法（`lib.rs:553-585`）均无 OHOS 排除，移除 `add_child` 排除后自动可用

## Capabilities

### New Capabilities
- `ohos-multi-webview`: OHOS desktop 上 `Window::add_child` 可用，支持在单窗口内创建多个独立定位/尺寸的子 webview

### Modified Capabilities
（无现有 capability 的需求变更）

## Impact

- **tauri crate**：`src/window/mod.rs` 的 `add_child` 方法 cfg 属性修改（1 处）
- **不修改其他文件**：所有依赖链路（`create_webview` 命令、`WebviewBuilder::build`、`desktop_commands` 注册、Manager getter、reparent）均无 OHOS 排除
- **编译链路**：移除排除后 `add_child` → `WebviewBuilder::build`（`cfg(desktop)` ✅）→ `dispatcher.create_webview`（已实现）→ wry `build_as_child`（已编译）→ OHA `WebViewBuilder::build`（已实现）
- **线程安全**：`add_child` 使用 `run_on_main_thread + rx.recv()` 模式，但 `send_user_message`（`lib.rs:250`）在主线程上同步执行消息，不会死锁
- **不影响其他平台**：仅移除 `not(target_env = "ohos")` 条件，其他平台的 cfg 逻辑不变
