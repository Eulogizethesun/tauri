## ADDED Requirements

### Requirement: OHOS 上 extend_api 不得阻塞主线程获取 plugin store 锁

`AppManager::extend_api`（`crates/tauri/src/manager/mod.rs`）在 `cfg(target_env = "ohos")` 目标上 SHALL 使用 `try_lock` 获取 `plugins` 锁，而非阻塞式 `lock()`。当 `try_lock` 争用失败（锁被其他路径持有）时，`extend_api` MUST NOT 在主线程上自旋/睡眠等待锁释放。

#### Scenario: plugin store 锁空闲时正常派发

- **WHEN** OHOS 上 `extend_api` 被调用且 `plugins` 锁当前未被持有
- **THEN** `try_lock` 成功，`PluginStore::extend_api` 在调用线程上同步执行，命令按原语义 resolve 或 reject

#### Scenario: plugin store 锁被长持有时不阻塞主线程

- **WHEN** OHOS 上 `extend_api` 被调用且 `plugins` 锁被另一路径长持有（如某插件 `on_event` 阻塞、`initialize_all` 慢初始化、并发慢命令）
- **THEN** `try_lock` 返回 `Err`，`extend_api` 立即将命令处理卸载到 `tauri::async_runtime::spawn_blocking` 线程池并返回，主线程不阻塞
- **AND** OHOS appfreeze 看门狗不触发 `SIGABRT`

#### Scenario: 其他平台保持阻塞式锁语义

- **WHEN** 非 OHOS 平台（Windows/macOS/Linux/Android/iOS）上 `extend_api` 被调用
- **THEN** 代码走 `cfg(not(target_env = "ohos"))` 分支，使用原 `plugins.lock().expect("poisoned plugin store")` 阻塞式获取锁
- **AND** 锁获取与命令派发行为与本变更前字节级一致

### Requirement: 降级路径不丢失 invoke 命令

当 OHOS 上 `extend_api` 的 `try_lock` 争用失败时，invoke 命令 MUST 被执行或被明确 reject，前端 Promise 不得永不 resolve。

#### Scenario: 降级路径下命中插件时命令正常执行

- **WHEN** `try_lock` 失败，命令被 `spawn_blocking` 卸载到阻塞线程池，线程池上 `lock()` 成获锁后 `PluginStore::extend_api` 命中目标插件
- **THEN** 插件的 `extend_api` 钩子被调用，命令按插件语义 resolve 或 reject
- **AND** 前端 Promise 收到对应的 resolve 值或 reject 错误

#### Scenario: 降级路径下未命中插件时明确 reject

- **WHEN** `try_lock` 失败，命令被 `spawn_blocking` 卸载到阻塞线程池，`PluginStore::extend_api` 未在 store 中找到目标插件
- **THEN** `PluginStore::extend_api` 调用 `invoke.resolver.reject("plugin {plugin} not found")`（`crates/tauri/src/plugin.rs` L983）
- **AND** 前端 Promise 收到 `"plugin {plugin} not found"` reject

#### Scenario: 降级路径阻止 on_message 立即 reject

- **WHEN** `try_lock` 失败且命令已移入 `spawn_blocking` 任务
- **THEN** `extend_api` 返回 `true`（已接管命令归属）
- **AND** `Webview::on_message`（`crates/tauri/src/webview/mod.rs` L1944-1946）不对该命令执行 `resolver.reject("Command {command} not found")` 兜底
- **AND** 命令的最终 resolve/reject 仅由异步任务内的 `PluginStore::extend_api` 完成

### Requirement: OHOS 改动由 cfg 隔离且不影响其他平台

所有 `extend_api` 的锁语义变更 MUST 由 `cfg(target_env = "ohos")` / `cfg(not(target_env = "ohos"))` 编译期隔离。非 OHOS 平台的构建产物、锁语义、invoke 派发行为 MUST NOT 改变。

#### Scenario: OHOS desktop 与 mobile 均启用降级

- **WHEN** `cfg(all(target_env = "ohos", desktop))` 或 `cfg(all(target_env = "ohos", mobile))` 目标编译
- **THEN** `extend_api` 启用 `try_lock` + `spawn_blocking` 降级路径（invoke 路径与设备形态无关，两种形态均硬化）

#### Scenario: 非 OHOS 平台编译不引入降级代码

- **WHEN** `cfg(not(target_env = "ohos"))` 目标编译（Windows/macOS/Linux/Android/iOS）
- **THEN** `extend_api` 编译为原 `lock().expect()` 阻塞路径
- **AND** 二进制中不包含 `try_lock` / `spawn_blocking` 降级分支的代码

### Requirement: extend_api 签名适配 Arc 接收者

`AppManager::extend_api` 的接收者 SHALL 为 `self: &Arc<Self>`，以支持 OHOS 降级路径将 `Arc<AppManager<R>>` 移入 `spawn_blocking` 任务。唯一调用点（`crates/tauri/src/webview/mod.rs` L1903）MUST 通过既有的 `Arc<AppManager<R>>` 变量调用，调用形态保持 `manager.extend_api(plugin, invoke)`。

#### Scenario: 调用点持 Arc 时签名兼容

- **WHEN** `webview/mod.rs` L1903 的 `manager: Arc<AppManager<R>>` 调用 `manager.extend_api(plugin, invoke)`
- **THEN** 方法解析命中 `self: &Arc<Self>` 接收者，编译通过
- **AND** 非 OHOS 平台运行行为与 `&self` 接收者时一致

#### Scenario: spawn_blocking 任务持 Arc 访问 plugins

- **WHEN** OHOS 降级路径启动 `spawn_blocking` 任务
- **THEN** 任务闭包捕获 `self.clone()` 产生的 `Arc<AppManager<R>>`，在阻塞线程池上通过 `this.plugins.lock()` 访问 plugin store
- **AND** `Arc<AppManager<R>>: Send` 与 `Invoke<R>: Send` 成立，满足 `spawn_blocking` 的 `Send + 'static` 约束
