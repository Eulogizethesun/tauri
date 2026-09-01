# store-ohos-exit-path-hardening Specification

## Purpose
TBD - created by archiving change p1-store-ohos-fix. Update Purpose after archive.
## Requirements
### Requirement: on_event 退出处理器在 OHOS 上不得阻塞主线程

`Builder::build` 的 `.on_event` 处理器（`plugins/store/src/lib.rs` L448-460）在 `RunEvent::Exit` 分支 SHALL 在 `cfg(target_env = "ohos")` 目标上使用 `try_read` 获取 stores map 的 `RwLock`，争用失败时 SHALL 以 `tracing::warn` 记录并跳过本次退出保存、立即返回，绝不阻塞主线程。其他平台 SHALL 保持原有 `read().unwrap()` 阻塞语义。

#### Scenario: OHOS 退出时 stores map 锁争用降级
- **WHEN** OHOS 上进程退出触发 `RunEvent::Exit`，且 `StoreState::stores` 的 `RwLock` 被写锁持有（如并发的 `StoreBuilder::build_inner` 或 `Store::close` 正在执行）
- **THEN** `.on_event` 通过 `try_read` 立即返回，记录 warn 日志并跳过本次退出保存，主线程不阻塞，不触发 appfreeze/SIGABRT

#### Scenario: OHOS 退出时无争用正常遍历
- **WHEN** OHOS 上进程退出触发 `RunEvent::Exit`，且 stores map 无锁争用
- **THEN** `.on_event` 遍历所有 store 并对每个 store 调用 `save_or_skip`，无争用时正常尝试落盘

#### Scenario: 其他平台退出语义不变
- **WHEN** Windows/macOS/Linux/Android/iOS 上进程退出触发 `RunEvent::Exit`
- **THEN** `.on_event` 用 `read().unwrap()` 阻塞式遍历所有 store，行为与变更前一致，`cfg(target_env = "ohos")` 分支不编译进二进制

### Requirement: Store::save_or_skip 在 OHOS 上对 StoreInner 锁争用降级

`Store` SHALL 提供 `pub(crate) fn save_or_skip(&self) -> crate::Result<()>` 内部方法。在 `cfg(target_env = "ohos")` 目标上 SHALL 使用 `try_lock` 获取 `StoreInner` 的 `Mutex`，争用失败时 SHALL 以 `tracing::warn` 记录并返回 `Ok(())` 跳过本次保存；成功获取锁时 SHALL 取消待决的 auto-save debounce 任务并执行落盘。其他平台 SHALL 编译为直接调用原 `save()`，无额外锁开销或分支。

#### Scenario: OHOS 退出时 StoreInner 锁争用跳过
- **WHEN** OHOS 上 `RunEvent::Exit` 调用 `store.save_or_skip()`，且 `StoreInner` 的 `Mutex` 被 auto-save debounce 任务（`store.rs` L592 `store.lock().unwrap().save()`）持有
- **THEN** `try_lock` 立即返回 `Err`，记录 warn 日志，`save_or_skip` 返回 `Ok(())`，主线程不阻塞，该 store 本次跳过落盘（由 `Drop for Store::apply_pending_auto_save` 与正常 auto-save 兜底）

#### Scenario: OHOS 无争用时正常落盘
- **WHEN** OHOS 上 `RunEvent::Exit` 调用 `store.save_or_skip()`，且 `StoreInner` 的 `Mutex` 无争用
- **THEN** `try_lock` 成功，取消待决 auto-save debounce 任务，执行 `guard.save()` 正常落盘

#### Scenario: 其他平台 save_or_skip 透传原 save
- **WHEN** Windows/macOS/Linux/Android/iOS 上调用 `store.save_or_skip()`
- **THEN** 方法编译为直接调用原 `save()`，`cfg(target_env = "ohos")` 的 `try_lock` 分支不编译进二进制，锁语义与变更前一致

### Requirement: OHOS 改动通过 cfg 隔离不影响其他平台构建

所有 OHOS 相关的 try_read/try_lock 降级路径 SHALL 通过 `cfg(target_env = "ohos")` 编译期隔离。Windows、macOS、Linux、Android、iOS 目标的 `cargo check` / `cargo build` SHALL 与变更前行为一致，不引入新的 panic 路径、环境变量依赖或配置 API。

#### Scenario: OHOS 目标编译通过
- **WHEN** 执行 `cargo check --target aarch64-linux-ohos -p tauri-plugin-store`
- **THEN** 命令退出码为 0，无编译错误

#### Scenario: Windows 目标回归通过
- **WHEN** 执行 `cargo check -p tauri-plugin-store`（默认 Windows 目标）
- **THEN** 命令退出码为 0，OHOS 分支不编译进二进制，`on_event` 阻塞式保存路径与锁语义不变

#### Scenario: Linux 目标回归通过
- **WHEN** 执行 `cargo check --target x86_64-unknown-linux-gnu -p tauri-plugin-store`
- **THEN** 命令退出码为 0，`cfg(target_env = "ohos")` 为 false，行为与变更前一致

