## ADDED Requirements

### Requirement: Window::add_child SHALL be available on OHOS desktop with unstable feature
`Window::add_child` SHALL 在 OHOS desktop 上 `unstable` feature 启用时编译可用，cfg gate 不再排除 `target_env = "ohos"`。

#### Scenario: add_child compiles on OHOS desktop with unstable
- **WHEN** 在 OHOS desktop 上以 `--features unstable` 编译 tauri crate
- **THEN** `Window::add_child` SHALL 编译通过（无 `not(target_env = "ohos")` 排除）
- **AND** `webview/plugin.rs` 的 `create_webview` 命令 SHALL 编译通过（调用 `add_child`）

#### Scenario: add_child compiles on non-OHOS platforms unchanged
- **WHEN** 在 macOS/Windows/Linux 上以 `--features unstable` 编译 tauri crate
- **THEN** `Window::add_child` SHALL 行为不变（cfg gate 仅移除 `not(target_env = "ohos")`，其他条件保留）

#### Scenario: add_child excluded without unstable feature on OHOS
- **WHEN** 在 OHOS desktop 上不启用 `unstable` feature 编译
- **THEN** `Window::add_child` SHALL 不可用（`all(desktop, feature = "unstable")` 条件不满足）

### Requirement: add_child SHALL not deadlock on OHOS
`Window::add_child` 在 OHOS 上调用时 SHALL 不死锁，无论从主线程还是非主线程调用。

#### Scenario: add_child from setup (main thread)
- **WHEN** 在 `setup` 回调（主线程）中调用 `window.add_child(builder, position, size)`
- **THEN** `run_on_main_thread` → `send_user_message` SHALL 检测主线程并同步执行 task
- **AND** task 内 `build` → `create_webview` → `send_user_message` SHALL 同步执行
- **AND** `tx.send(res)` SHALL 在 `rx.recv()` 之前被调用
- **AND** `rx.recv()` SHALL 立即返回，不死锁

#### Scenario: add_child from async command (non-main thread)
- **WHEN** 在 async 命令（非主线程）中调用 `window.add_child(builder, position, size)`
- **THEN** `run_on_main_thread` → `send_user_message` SHALL 发送 task 到事件循环队列
- **AND** `rx.recv()` SHALL 阻塞调用线程（非事件循环线程）
- **AND** 事件循环 SHALL 在主线程处理 task 并调用 `tx.send(res)`
- **AND** `rx.recv()` SHALL 解除阻塞并返回结果

### Requirement: create_webview JS command SHALL work on OHOS desktop with unstable
`plugin:webview|create_webview` JS 命令 SHALL 在 OHOS desktop 上 `unstable` feature 启用时可用，创建子 webview。

#### Scenario: create_webview from JS
- **WHEN** 前端调用 `invoke('plugin:webview|create_webview', { windowLabel, options })`
- **THEN** SHALL 调用 `window.add_child(builder, position, size)` 创建子 webview
- **AND** 子 webview SHALL 出现在指定窗口的指定位置和尺寸

### Requirement: reparent SHALL return error on OHOS with unstable
`Webview::reparent` 在 OHOS 上 `unstable` feature 启用时 SHALL 返回 `Error::FailedToSendMessage`（Phase 2 修复），不死锁。

#### Scenario: reparent with unstable on OHOS
- **WHEN** 在 OHOS desktop 上以 `unstable` feature 调用 `webview.reparent(&window)`
- **THEN** `is_webview_window()` 检查 SHALL 被跳过（`#[cfg(not(feature = "unstable"))]` 条件不满足）
- **AND** `dispatcher.reparent()` SHALL 被调用
- **AND** Phase 2 的 OHOS Reparent handler SHALL 返回 `Err(Error::FailedToSendMessage)`
- **AND** `reparent()` SHALL 返回 `Err(Error::FailedToSendMessage)`，不死锁
