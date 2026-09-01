## 1. Store::save_or_skip 实现

- [x] 1.1 在 `plugins/store/src/store.rs` 的 `Store` impl 块新增 `pub(crate) fn save_or_skip(&self) -> crate::Result<()>`
- [x] 1.2 OHOS 分支（`#[cfg(target_env = "ohos")]`）：`self.store.try_lock()`，成功时取消待决 auto-save（`auto_save_debounce_sender.lock().unwrap().take()` + `send(Cancel)`）并调用 `guard.save()`；失败时 `tracing::warn!("store: StoreInner locked on exit, skipping save")` 返回 `Ok(())`
- [x] 1.3 其他平台分支（`#[cfg(not(target_env = "ohos"))]`）：直接 `self.save()` 透传
- [x] 1.4 确认 `save_or_skip` 为 `pub(crate)`，不暴露为面向应用 API

## 2. on_event 退出处理器硬化

- [x] 2.1 在 `plugins/store/src/lib.rs` L448-460 的 `.on_event` `RunEvent::Exit` 分支，将 `collection.stores.read().unwrap()` 替换为 `cfg` 分支：OHOS 用 `try_read()`，失败时 `tracing::warn!("store: stores map locked on exit, skipping save")` 并 `return`；其他平台保持 `read().unwrap()`
- [x] 2.2 将循环内 `store.save()` 调用改为 `store.save_or_skip()`
- [x] 2.3 确认 `let Ok(store) = ... else { continue }` 模式与原 `if let Ok(store)` 语义一致（保持原行为，避免无关改动）

## 3. cfg 隔离验证

- [x] 3.1 确认所有 OHOS 分支用 `cfg(target_env = "ohos")` / `cfg(not(target_env = "ohos"))`，无 `cfg(all(target_env = "ohos", desktop))` 误用（mobile 同样硬化）
- [x] 3.2 确认未引入 `watch` / `disable_watch` / `DEFAULT_WATCH` 等 API（当前版本无文件 watch 机制）
- [x] 3.3 确认未引入对 `notify` 依赖的任何修改（当前 Cargo.toml 无 notify 依赖）
- [x] 3.4 确认未新增面向应用的 Rust 配置方法或 JS `LoadStoreOptions` 字段

## 4. 元数据与文档

- [x] 4.1 修改 `plugins/store/Cargo.toml` 的 `[package.metadata.platforms.support]` 增加 `ohos = { level = "full", notes = "RunEvent::Exit save path hardened with try_read/try_lock; other platforms unchanged" }`
- [x] 4.2 修改 `plugins/store/README.md` 增加 "## OHOS" 小节：说明 Exit 路径硬化、退出时锁争用降级语义、其他平台无行为变化；**不**提及文件 watch（当前版本无该机制）
- [x] 4.3 在 README 注明 `RunEvent::Exit` 在 OHOS 锁争用时跳过最后一次落盘，应用应依赖 auto-save debounce 与 `Drop` 兜底

## 5. 验证

- [ ] 5.1 Windows 主机执行 `cargo check --target aarch64-linux-ohos -p tauri-plugin-store` 退出码 0
- [ ] 5.2 Windows 主机执行 `cargo check -p tauri-plugin-store`（默认目标）退出码 0（回归）
- [ ] 5.3 Linux/macOS 主机 `cargo check -p tauri-plugin-store` 退出码 0（回归，若有 CI 矩阵）
- [ ] 5.4 OHOS 设备端构造 `RunEvent::Exit` 与并发 auto-save debounce 争用：连续 `set` 触发 debounce 保存，立即触发进程退出，验证主线程不阻塞、无 appfreeze/SIGABRT
- [ ] 5.5 OHOS 设备端构造 `RunEvent::Exit` 与并发 `Store::close` 争用：验证 `try_read` 立即返回、warn 日志、不崩溃
- [ ] 5.6 OHOS 设备端验证无锁争用时 `save_or_skip` 正常落盘（`try_lock` 成功路径）
- [ ] 5.7 Windows/macOS 验证 `RunEvent::Exit` 阻塞式保存行为不变（`read().unwrap()` / `lock().unwrap()`）
