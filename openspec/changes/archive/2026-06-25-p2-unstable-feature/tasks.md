# Phase 2: 运行时集成与安全防护 - 实施任务

## 1. Reparent OHOS 安全返回

- [x] 1.1 在 `tauri-runtime-wry/src/lib.rs` 的 `Message::Webview` 处理区域，在现有 `#[cfg(all(any(...), not(target_env = "ohos")))]` Reparent block（约 line 3807-3876）之后、通用 match 前的 prep 代码（约 line 3878）之前，新增 `#[cfg(target_env = "ohos")]` 拦截块（实际 `match webview_message` 在 line 3885）：
  ```rust
  #[cfg(target_env = "ohos")]
  if let WebviewMessage::Reparent(_new_parent_window_id, tx) = webview_message {
    log::warn!("Webview reparent is not supported on OHOS (BuilderNode is bound to UIContext)");
    tx.send(Err(Error::FailedToSendMessage)).unwrap();
    return;
  }
  ```
- [x] 1.2 验证 `Error::FailedToSendMessage` 在当前作用域可用（检查 `use` 语句或完整路径 `tauri_runtime::Error::FailedToSendMessage`）— 已确认 `Error` 在 `lib.rs:31` 导入

## 2. 构建验证

- [ ] 2.1 在 OHOS desktop target 上 `cargo check` tauri-runtime-wry crate（`cargo check --target aarch64-linux-ohos --features unstable`）
- [ ] 2.2 在非 OHOS target 上 `cargo check` tauri-runtime-wry crate，验证 OHOS 分支不影响其他平台（`cargo check --features unstable`）
- [ ] 2.3 验证 `WebviewMessage::Reparent` 枚举变体在 OHOS 上可构造（无编译错误）

## 3. 死锁防护验证

- [ ] 3.1 编写单元测试或集成测试：在 OHOS 上调用 `WryWebviewDispatcher::reparent()`，验证返回 `Err` 而非阻塞（需 mock 或设备端测试）
- [ ] 3.2 验证 `current_window_id` Mutex 锁在 reparent 返回后被释放（后续 webview 操作不死锁）
- [ ] 3.3 验证 `log::warn!` 输出包含 "not supported on OHOS" 信息
