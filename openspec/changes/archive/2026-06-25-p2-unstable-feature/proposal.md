## Why

tauri-runtime-wry 中 `WebviewMessage::Reparent` 的 handler 被 `not(target_env = "ohos")` 排除（`lib.rs:3807-3818`），但 `WryWebviewDispatcher::reparent()` 仍通过 `rx.recv()` 阻塞等待 `tx` 响应（`lib.rs:1828`）。在 OHOS 上 `tx` 永不被调用，导致 `rx.recv()` 永久阻塞 → **死锁**。此外，`reparent()` 持有的 `current_window_id` Mutex 锁（`lib.rs:1817`）永不释放，后续所有需要该锁的操作级联死锁。

## What Changes

- **Reparent handler OHOS 安全返回**：在 `tauri-runtime-wry/src/lib.rs` 的 `Message::Webview` 处理中，为 OHOS 添加 `#[cfg(target_env = "ohos")]` 分支，在 `Reparent` 消息到达通用 match 之前拦截，调用 `tx.send(Err(...))` 解除 `rx.recv()` 阻塞
- **错误类型**：使用 `Error::FailedToSendMessage` 作为 reparent 不支持的错误返回（避免新增 error variant，与现有错误处理一致）
- **不实现 true reparent**：OHOS 的 ArkUI `BuilderNode` 绑定到特定 `UIContext`（per-window），无法跨窗口迁移 Web 组件。返回 Error 是正确的降级策略

## Capabilities

### New Capabilities
- `ohos-webview-reparent-safety`: OHOS 上 webview reparent 操作的安全降级，防止死锁，返回明确错误

### Modified Capabilities
（无现有 capability 的需求变更）

## Impact

- **tauri-runtime-wry**：`src/lib.rs` 的 `Message::Webview` 处理区域（约 line 3805-3890）新增 OHOS `#[cfg]` 分支
- **不影响其他平台**：OHOS 分支通过 `#[cfg(target_env = "ohos")]` 隔离，Windows/macOS/Linux 的 Reparent handler 不变
- **不依赖 wry OHOS reparent 实现**：wry OHOS 后端无 `reparent` 方法，本 Phase 不在 wry 层添加，仅返回错误
- **Phase 3 关联**：tauri crate 的 `Webview::reparent()` 在 `unstable` feature 下会跳过 `is_webview_window()` 检查允许任意 reparent，Phase 2 的错误返回确保此路径不死锁
