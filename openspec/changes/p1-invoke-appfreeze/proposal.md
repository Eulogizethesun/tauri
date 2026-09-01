## Why

Tauri 核心 invoke 路径 `AppManager::extend_api`（`crates/tauri/src/manager/mod.rs` L475-481）以阻塞式锁获取 plugin store：

```rust
pub fn extend_api(&self, plugin: &str, invoke: Invoke<R>) -> bool {
  self
    .plugins
    .lock()
    .expect("poisoned plugin store")
    .extend_api(plugin, invoke)
}
```

在 OHOS 上，`on_message`（`crates/tauri/src/webview/mod.rs` L1785，插件命令分支 L1903）运行于主线程，`extend_api` 在主线程执行 `plugins.lock()`。当 `plugins` 锁被另一路径长持有时（典型为某插件的 `on_event` 在锁内阻塞，如 http 插件 `RunEvent::Exit` 的 `rx.recv()`，或 `initialize_all` / `register` 持锁期间执行慢初始化），`extend_api` 在主线程自旋等待 → OHOS appfreeze 看门狗（约 5s 无响应）触发 `SIGABRT`。

`app.rs` L2691 的 `on_event` 已在 OHOS 上改为 `try_lock`（争用则跳过 + `log::warn`），消除了 `on_event` 自身持锁阻塞主线程的风险。但 `mod.rs` L475 的 `extend_api` 仍为阻塞式 `lock().expect()`，且 `PluginStore::extend_api`（`plugin.rs` L975-985）在 `store.iter_mut()` 循环中执行 `p.extend_api(invoke)` —— **整个插件命令执行期间都持有 `plugins` 锁**。任一慢命令（store load 同步 I/O、http 阻塞、或与 `on_event`/`initialize` 争用）都会让主线程上的下一个 invoke 阻塞。现场 hilog 高频出现 `plugin store lock busy, skipping on_event (appfreeze try_lock)` 持续 6s+，即 plugin store 锁被长持有、`extend_api` 在主线程阻塞、store load 等命令不执行，最终看门狗 `SIGABRT`。

## What Changes

- `AppManager::extend_api`（`crates/tauri/src/manager/mod.rs` L475-481）改为 `self: &Arc<Self>` 接收者，并在 `cfg(target_env = "ohos")` 下用 `try_lock`：成功则原路执行 `PluginStore::extend_api`；争用失败时将命令处理 `spawn_blocking` 到 `tauri::async_runtime` 的 tokio 阻塞线程池（**不持主线程**），在线程池上以阻塞式 `lock().expect()` 获取锁后执行 `PluginStore::extend_api`，命令的 resolve/reject 由 `InvokeResolver` 异步回传 webview。其他平台（`cfg(not(target_env = "ohos"))`）保持原 `lock().expect()` 阻塞语义，行为字节级不变。
- 调整唯一调用点 `webview/mod.rs` L1903：`manager`（`Arc<AppManager<R>>`）直接调用新签名的 `extend_api`，`self: &Arc<Self>` 接收者与现有 `Arc` 变量天然兼容，非 OHOS 平台调用形态不变。
- OHOS 降级路径返回 `true`（已接管命令归属）：命令已被移入异步任务，由 `PluginStore::extend_api` 内部对未命中插件调用 `invoke.resolver.reject("plugin {plugin} not found")`（`plugin.rs` L983）保证明确 reject，不丢命令。
- 所有 OHOS 分支用 `cfg(target_env = "ohos")` / `cfg(not(target_env = "ohos"))` 编译期隔离；`desktop`/`mobile` 两种设备形态均启用降级（invoke 路径与设备形态无关）。

## Capabilities

### New Capabilities
- `ohos-invoke-appfreeze-hardening`: OHOS 上 `AppManager::extend_api`（核心 invoke 派发路径）的 plugin store 锁防御性硬化——`try_lock` 争用失败时将命令处理卸载到 tokio `spawn_blocking` 线程池，避免主线程阻塞触发 appfreeze/SIGABRT；命令不丢失（异步执行或明确 reject）；其他平台锁语义不变。

### Modified Capabilities
<!-- 无既有 spec-level 行为变更面向最终用户 API；硬化仅由 cfg 隔离在 OHOS 生效，其他平台无可观察行为差异。 -->

## Impact

- **代码**：`crates/tauri/src/manager/mod.rs`（`extend_api` 签名 `&self` → `self: &Arc<Self>`，OHOS try_lock + spawn_blocking 降级分支）、`crates/tauri/src/webview/mod.rs`（L1903 调用点适配，非 OHOS 路径不变）。
- **依赖**：不新增、不修改任何 Rust crate 依赖。`tauri::async_runtime::spawn_blocking` 已存在（`crates/tauri/src/async_runtime.rs` L278-285）。
- **平台**：OHOS desktop/mobile（invoke 派发 try_lock + 异步降级）；Windows/macOS/Linux/Android/iOS 行为不变（`cfg(not(target_env = "ohos"))` 走原 `lock().expect()` 路径）。
- **API**：`AppManager::extend_api` 接收者由 `&self` 变为 `self: &Arc<Self>`。该方法为框架内部派发路径，唯一调用点在 `webview/mod.rs` L1903（已持 `Arc<AppManager>`），无外部用户代码依赖。
- **验证**：`cargo check --target aarch64-linux-ohos -p tauri` 通过；OHOS 设备端构造 plugin store 锁长持有场景（并发 `on_event`/慢命令）触发 `extend_api` 争用，主线程不阻塞、无 `SIGABRT`、命令最终 resolve 或 reject；其他平台 `cargo check` 回归通过。
