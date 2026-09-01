## 1. extend_api 签名与 OHOS 降级实现

- [x] 1.1 在 `crates/tauri/src/manager/mod.rs` 将 `AppManager::extend_api` 接收者由 `&self` 改为 `self: &Arc<Self>`，保持 `pub` 可见性
- [x] 1.2 在 `extend_api` body 内加 `cfg(target_env = "ohos")` 分支：`self.plugins.try_lock()`，成功则 `store.extend_api(plugin, invoke)` 原路返回
- [x] 1.3 在 `cfg(target_env = "ohos")` 的 `try_lock` 失败分支：`let this = self.clone(); let plugin_owned = plugin.to_owned();` 调用 `crate::async_runtime::spawn_blocking(move || this.plugins.lock().expect("poisoned plugin store").extend_api(&plugin_owned, invoke))`，返回 `true`
- [x] 1.4 加 `cfg(not(target_env = "ohos"))` 分支：保持原 `self.plugins.lock().expect("poisoned plugin store").extend_api(plugin, invoke)`，非 OHOS 行为不变

## 2. 调用点适配

- [x] 2.1 核对 `crates/tauri/src/webview/mod.rs` L1903 `manager.extend_api(plugin, invoke)`：确认 `manager` 为 `Arc<AppManager<R>>`（来自 L1786 `self.manager_owned()`），`self: &Arc<Self>` 接收者兼容
- [x] 2.2 确认调用点无需改动（调用形态 `manager.extend_api(plugin, invoke)` 对 `&Arc<Self>` 接收者天然匹配）；若有 `&AppManager` 引用调用则修正为经 `Arc`
- [x] 2.3 全仓 Grep `extend_api` 调用点，确认无 `&self` 形态的其他调用者（plugin.rs L109/L850/L975 为 `Plugin`/`PluginStore` trait/impl，非 `AppManager::extend_api`，不受影响）

## 3. Send/Sync 与编译验证

- [ ] 3.1 确认 `Arc<AppManager<R>>: Send`（`R: Runtime` 即 `Send + Sync`，`AppManager` 字段均 `Send + Sync`），`Invoke<R>: Send`，`spawn_blocking` 闭包 `Send + 'static`
- [ ] 3.2 `cargo check --target aarch64-linux-ohos -p tauri` 通过（OHOS 降级分支编译）
- [ ] 3.3 `cargo check -p tauri`（host 非 OHOS）通过，确认 `cfg(not(target_env = "ohos"))` 分支编译且行为不变
- [ ] 3.4 Windows/macOS/Linux 回归：`cargo check` 各平台无新警告/错误

## 4. 设备端验证（OHOS）

- [ ] 4.1 构造 plugin store 锁长持有场景（并发触发某插件 `on_event` Exit 阻塞 / `initialize_all` 慢初始化 / 慢命令 invoke），在锁持有期间发起 `plugin:*` invoke（如 store load）
- [ ] 4.2 验证主线程不阻塞：hilog 不再出现 appfreeze `SIGABRT`；`on_event` 的 `try_lock` warn 不再持续 6s+（锁释放后即恢复）
- [ ] 4.3 验证命令不丢失：降级路径下 store load 等 invoke 最终 resolve（命中插件）或 reject `"plugin {plugin} not found"`（未命中），前端 Promise 不挂起
- [ ] 4.4 验证 `handled=true` 阻止 `on_message` 兜底 reject：降级路径下前端不应收到 `"Command {command} not found"`（该消息仅由 `PluginStore::extend_api` 的 `"plugin {plugin} not found"` 替代）

## 5. 审计与回归

- [x] 5.1 对照 app.rs L2691 `on_event` try_lock 模式，确认 `extend_api` 降级与之一致（try_lock 入口）且更严（on_event 跳过 vs extend_api 不丢命令）
- [x] 5.2 对照 OHOS 三铁律：openharmony-ability 桥接（不涉及）、cfg 隔离（`cfg(target_env = "ohos")`）、OHOS_DEVICE_TYPE（desktop/mobile 均硬化）
- [x] 5.3 对照 ohos-constraints.md 线程模型：确认未引入 `run_on_main_thread + recv()` 死锁、未跨阻塞 I/O 持锁（降级路径在阻塞池线程持锁，非主线程）
- [x] 5.4 非 OHOS 平台 invoke 行为回归：手工/自动测试 plugin 命令派发与 reject 路径，确认无回归

## 6. 异步命令响应 waker/drain 通道（Addendum，#81 第二层根因）

- [x] 6.1 drain 修复（前序会话）：`tao/.../ohos/mod.rs:690` `MainEvent::UserEvent` 分支由单次 `try_recv` 改 `while let` 全量 drain（应对 TSFN NonBlocking 唤醒合并）
- [x] 6.2 根因定位：`OpenHarmonyWaker` 在 `create_proxy` 时快照 `WAKER`，而 `WAKER` 由 `create_lifecycle_handle` 在 `#fn_name` 之后（derive/lib.rs:136）才填充 → 快照永久 None → `wake()` 空操作 → `MainEvent::UserEvent` 不 fire → 异步响应不 drain → 超时
- [x] 6.3 waker live-read 修复：`openharmony-ability/crates/ability/src/waker.rs` `OpenHarmonyWaker::wake()` 改实时读 `WAKER` 全局；struct 改零字段 + `#[derive(Clone)]`；`create_waker`（app.rs:160）返回 `OpenHarmonyWaker::new()` 不快照；移除 app.rs 的 `WAKER` 未用 import
- [x] 6.4 审计子 agent 复核：live-read 修法 sound、保留 `WindowsStore` 主线程 borrow 不变量、三铁律合规；指出残留 TSFN 主线程派发风险须实测
- [x] 6.5 实测验证（HUAWEI MateBook Pro desktop）：`[WAKE-CALL] waker=Some` + `[WAKE-FIRE]` 在主线程 ThreadId(1) fire + `[DRAIN-DIAG]` drained N events（修前 count=0）；163 wake→163 fire→163 drain；修前超时的异步窗口命令（set_position/set_size/maximize/unmaximize/create_transparent_borderless_window）现在 PASS
- [x] 6.6 清理本会话临时 `[WAKE-CALL]`/`[WAKE-FIRE]` INFO 诊断日志（已确认修复，高频刷屏 hilog 挤掉测试结果）；`[DRAIN-DIAG]`/`[IPC-DIAG]` 待 #65 统一清理
- [ ] 6.7 残留：#85 多窗口 `window.open` 死锁（#81 修好后由"5s 超时"转为"主线程死锁"，须修 #85 才能跑完整套件）
