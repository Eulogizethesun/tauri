## ADDED Requirements

### Requirement: WebviewMessage::Reparent SHALL signal tx on OHOS
tauri-runtime-wry 在 OHOS 上处理 `WebviewMessage::Reparent` 时 SHALL 调用 `tx.send(...)` 信号化调用方，使 `rx.recv()` 不阻塞。

#### Scenario: Reparent returns error on OHOS
- **WHEN** 在 OHOS 上调用 `WryWebviewDispatcher::reparent(window_id)`
- **THEN** `WebviewMessage::Reparent(window_id, tx)` SHALL 被 `#[cfg(target_env = "ohos")]` 分支拦截
- **AND** SHALL 调用 `tx.send(Err(Error::FailedToSendMessage))`
- **AND** `rx.recv()` SHALL 返回 `Err(Error::FailedToSendMessage)`
- **AND** `reparent()` SHALL 返回 `Err(Error::FailedToSendMessage)`

#### Scenario: Reparent does not deadlock on OHOS
- **WHEN** 在 OHOS 上调用 `WryWebviewDispatcher::reparent(window_id)`
- **THEN** `rx.recv()` SHALL 在有限时间内返回（不永久阻塞）
- **AND** `current_window_id` Mutex 锁 SHALL 被释放
- **AND** 后续 webview 操作（set_bounds、set_focus 等）SHALL 不死锁

#### Scenario: Reparent logs warning on OHOS
- **WHEN** 在 OHOS 上处理 `WebviewMessage::Reparent`
- **THEN** SHALL 输出 `warn` 级别日志，包含 "not supported on OHOS" 信息
- **AND** 不输出 `error` 级别日志（已知降级，非意外错误）

### Requirement: OHOS Reparent handler SHALL NOT affect other platforms
OHOS 的 Reparent 拦截分支 SHALL 通过 `#[cfg(target_env = "ohos")]` 隔离，不影响 Windows/macOS/Linux 的现有 Reparent handler。

#### Scenario: macOS/Windows/Linux Reparent unchanged
- **WHEN** 在非 OHOS 平台上调用 `reparent()`
- **THEN** 现有 `#[cfg(all(any(macos, windows, linux, BSDs), not(target_env = "ohos")))]` Reparent handler SHALL 正常执行
- **AND** OHOS `#[cfg(target_env = "ohos")]` 分支 SHALL 不编译

### Requirement: OHOS Reparent handler SHALL return before generic match
OHOS 的 Reparent 拦截分支 SHALL 在通用 `match webview_message` 之前执行并 `return`，不落入 `/* already handled */` 空分支。

#### Scenario: Reparent intercepted before generic match
- **WHEN** 在 OHOS 上 `WebviewMessage::Reparent` 到达 `Message::Webview` handler
- **THEN** `#[cfg(target_env = "ohos")]` 分支 SHALL 匹配并处理该消息
- **AND** SHALL `return` 后不执行通用 match（line 3878+）
- **AND** 通用 match 的 `Reparent(_window_id, _tx) => { /* already handled */ }` arm SHALL 不被执行
