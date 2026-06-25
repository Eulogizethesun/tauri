# Phase 3: tauri API 解除阻塞 - 实施任务

## 1. 移除 add_child OHOS 排除

- [x] 1.1 在 `tauri/src/window/mod.rs` 的 `add_child` 方法（约 line 1174-1177），将 cfg 从 `#[cfg(all(any(test, all(desktop, feature = "unstable")), not(target_env = "ohos")))]` 改为 `#[cfg(all(any(test, all(desktop, feature = "unstable"))))]`（移除 `, not(target_env = "ohos")`）— 实际简化为 `#[cfg(any(test, all(desktop, feature = "unstable")))]`

## 2. 编译验证

- [ ] 2.1 在 OHOS desktop target 上 `cargo check` tauri crate（`cargo check --target aarch64-linux-ohos --features unstable`），验证 `add_child`、`create_webview` 命令、`desktop_commands` 模块编译通过
- [ ] 2.2 在非 OHOS target 上 `cargo check` tauri crate（`cargo check --features unstable`），验证其他平台不受影响
- [ ] 2.3 验证不启用 `unstable` 时 `add_child` 仍不可用（`cargo check --target aarch64-linux-ohos` 无 unstable，add_child 不编译）

## 3. 功能验证

- [ ] 3.1 在 OHOS desktop 设备上运行 multiwebview example（或类似测试），验证 `WindowBuilder` + `add_child` 创建多 webview 窗口
- [ ] 3.2 验证 `create_webview` JS 命令：前端调用创建子 webview，验证位置和尺寸正确
- [ ] 3.3 验证 `reparent` JS 命令：调用返回 Error（`FailedToSendMessage`），不死锁
- [ ] 3.4 验证 reparent 后后续 webview 操作正常（无级联死锁）
- [ ] 3.5 验证从 `setup`（主线程）调用 `add_child` 不死锁
