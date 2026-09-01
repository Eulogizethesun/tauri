## Context

Tauri 核心 invoke 派发路径：JS 侧 `__TAURI_INVOKE__` → webview IPC → `Webview::on_message`（`crates/tauri/src/webview/mod.rs` L1785）→ 对 `plugin:*` 命令调用 `manager.extend_api(plugin, invoke)`（L1903）→ `AppManager::extend_api`（`crates/tauri/src/manager/mod.rs` L475-481）→ `PluginStore::extend_api`（`crates/tauri/src/plugin.rs` L975-985）。

当前 `AppManager::extend_api` 用阻塞式锁：

```rust
pub fn extend_api(&self, plugin: &str, invoke: Invoke<R>) -> bool {
  self.plugins.lock().expect("poisoned plugin store").extend_api(plugin, invoke)
}
```

`PluginStore::extend_api`（plugin.rs L975-985）在 `self.store.iter_mut()` 循环中调用 `p.extend_api(invoke)`，**整个插件命令执行期间持有 `plugins: Mutex<PluginStore<R>>` 锁**。

**plugins 锁的持有方**（均为阻塞式 `lock()`，跨平台代码）：
- `AppManager::extend_api`（mod.rs L475）— 持锁期间执行插件命令（可能含同步 I/O、阻塞调用）。
- `AppManager::initialize_plugins`（mod.rs L483-489）— 持锁调用 `initialize_all`，逐个执行 `plugin.initialize()`，可能慢。
- `AppManager::on_event`（经 app.rs L2691 入口）— OHOS 上已改 `try_lock`（app.rs L2691-2697），争用则跳过；**非 OHOS 平台仍阻塞**。
- `PluginStore::register` / `initialize_all` / `on_page_load` / `on_event` / `extend_api`（plugin.rs L880-985）— 均要求 `&mut self`，由上述 manager 方法持锁调用。

**OHOS 风险链**：
1. `on_message` 在 OHOS 主线程执行（WebView IPC 回调派发到 ArkTS/Chrome_IOThread 主线程）。
2. 某路径长持有 `plugins` 锁（典型：http 插件 `on_event` 的 `RunEvent::Exit` 分支 `rx.recv()` 阻塞；或 `initialize_all` 慢初始化；或并发 invoke 的慢命令）。注意 app.rs L2691 的 `try_lock` 只让 `on_event` 入口不阻塞，但 `extend_api` 自身仍持锁执行命令，慢命令同样长持有锁。
3. 主线程上的下一个 `extend_api` 调用 `plugins.lock()` 自旋等待 → 主线程阻塞。
4. OHOS appfreeze 看门狗（约 5s 无响应）→ `SIGABRT`。

现场观测：hilog 高频 `plugin store lock busy, skipping on_event (appfreeze try_lock)` 持续 6s+（app.rs L2696 的 `log::warn`，证明 `on_event` `try_lock` 持续失败 → 锁被长持有），同时 store load 等 invoke 不执行（`extend_api` 阻塞在 `lock()`），最终 `SIGABRT`。

**已完成的同类修复**：app.rs L2691 `on_event` 已用 `try_lock` 跳过（不阻塞、不丢事件仅跳过 `on_event` 钩子）。本变更对 `extend_api` 做同类硬化，但 `extend_api` **不能简单跳过**——跳过即丢失 invoke 命令，前端 Promise 永不 resolve/reject。因此 `extend_api` 的降级策略必须是"执行或明确 reject"，而非"跳过"。

**约束**（遵守 OHOS 三铁律）：openharmony-ability 是唯一 ArkTS 桥接仓（本变更不调用任何 OHOS 系统能力，纯 Rust 锁语义硬化，无需 ArkTS 桥接）；不影响其他平台（`cfg(target_env = "ohos")` 隔离，其他平台 `lock().expect()` 不变）；`OHOS_DEVICE_TYPE` 决定设备形态（desktop/mobile 均硬化，invoke 路径与设备形态无关）。

## Goals / Non-Goals

**Goals:**
- 消除 `AppManager::extend_api` 在 OHOS 主线程上对 `plugins` 锁的阻塞式获取：`try_lock` 争用失败时将命令处理卸载到 tokio `spawn_blocking` 线程池，主线程立即返回，不触发 appfreeze。
- 不丢命令：降级路径下 invoke 必须被执行或被明确 reject（`PluginStore::extend_api` 内部对未命中插件 reject `"plugin {plugin} not found"`；命中插件则正常派发，由插件 resolve/reject）。
- 所有 OHOS 改动用 `cfg(target_env = "ohos")` 隔离；Windows/macOS/Linux/Android/iOS 构建与运行行为字节级不变（仍走 `lock().expect()`）。

**Non-Goals:**
- 不修改 `PluginStore::extend_api`（plugin.rs L975-985）内部逻辑——锁的持有范围（整个命令执行）不变；仅改变 `AppManager::extend_api` 入口的锁获取方式与失败降级。
- 不重构 `PluginStore` 把命令执行移出锁外（涉及 `Box<dyn Plugin>` 生命周期、不可 `Clone`，风险大，超出 appfreeze 修复范围）。
- 不修改 `on_message` 的线程派发模型（不把 `on_message` 整体移出主线程）。
- 不修改前端 JS invoke 协议、IPC 响应格式、命令返回顺序保证（OHOS 降级路径下命令可能乱序完成，与移动端异步命令语义一致，前端已容忍）。
- 不在 OHOS 上跑依赖 `mock_runtime` 的 tauri crate 单元测试（已由 `cfg(not(target_env = "ohos"))` 排除）。
- 不修改 `initialize_plugins` / `register` / `on_event` 的锁语义（`on_event` 已由 app.rs L2691 硬化；其余为短临界段或非主线程路径，不在本次范围）。

## Decisions

### Decision 1: `extend_api` 接收者改为 `self: &Arc<Self>`（所有平台）

`extend_api` 的降级策略需要将命令处理 `spawn_blocking` 到 tokio 线程池，异步任务需持有 `Arc<AppManager<R>>` 才能访问 `self.plugins`。`&self` 无法构造 `Arc<Self>`（无 weak 自引用）。

将签名由 `pub fn extend_api(&self, ...)` 改为 `pub fn extend_api(self: &Arc<Self>, plugin: &str, invoke: Invoke<R>) -> bool`。

**为什么改签名而非在调用点内联**：`extend_api` 是 appfreeze 修复的语义入口，把 try_lock + 降级逻辑收敛在方法内，与 app.rs L2691 `on_event` 的 try_lock 模式对称，便于审计与回归。调用点（webview/mod.rs L1903）`manager` 已是 `Arc<AppManager<R>>`，`manager.extend_api(plugin, invoke)` 对 `self: &Arc<Self>` 接收者天然匹配，调用形态不变。

**为什么不用 `Weak<Self>` 自引用**：引入 `Weak<AppManager>` 字段需在 `AppManager::new` 后补设，增加构造时序复杂度与不变量维护负担；`&Arc<Self>` 是零成本惯用法，AppManager 全程经 `Arc` 持有。

**替代方案（否决）**：在 webview/mod.rs L1903 调用点内联 `manager.plugins.try_lock()` + spawn。虽最小化签名变更，但把锁策略散落到 webview 模块，与 `on_event` 在 app.rs 的对称硬化分离，审计成本高。本设计选择改签名以保持修复点单一。

**签名变更的兼容性**：`AppManager` 由框架内部构造，`extend_api` 唯一调用点在 `webview/mod.rs` L1903（持 `Arc<AppManager>`）。该方法虽 `pub`，但 `AppManager` 非用户直接实例化类型，无已知外部用户代码依赖 `&self` 形态调用 `extend_api`。

### Decision 2: OHOS 上 `try_lock` 成功走原路，失败 `spawn_blocking` 降级

`cfg(target_env = "ohos")` 分支：

```rust
#[cfg(target_env = "ohos")]
{
  match self.plugins.try_lock() {
    Ok(mut store) => store.extend_api(plugin, invoke),
    Err(_) => {
      // plugin store 锁争用（典型：某 on_event/initialize 持锁阻塞，或并发慢命令）。
      // 主线程不得阻塞等待 → 卸载到 tokio 阻塞线程池，命令不丢失。
      let this = self.clone();
      let plugin_owned = plugin.to_owned();
      crate::async_runtime::spawn_blocking(move || {
        this
          .plugins
          .lock()
          .expect("poisoned plugin store")
          .extend_api(&plugin_owned, invoke)
      });
      // 命令归属已转移到异步任务：PluginStore::extend_api 命中插件则由插件 resolve/reject，
      // 未命中则 invoke.resolver.reject("plugin {plugin} not found")（plugin.rs L983）。
      true
    }
  }
}
#[cfg(not(target_env = "ohos"))]
{
  self.plugins.lock().expect("poisoned plugin store").extend_api(plugin, invoke)
}
```

**为什么 `spawn_blocking` 而非 `spawn`**：`plugins.lock()` 是阻塞式系统 Mutex，tokio 普通 `spawn` 在异步 worker 上阻塞会饿死 reactor；`spawn_blocking` 专用阻塞线程池，不污染异步运行时。`tauri::async_runtime::spawn_blocking` 已存在（async_runtime.rs L278-285），语义匹配。

**为什么降级返回 `true` 而非 `false`**：`on_message`（webview/mod.rs L1944-1946）对 `!handled` 会 `resolver.reject("Command {command} not found")`。降级时命令已移入异步任务即将执行，必须返回 `true` 阻止 `on_message` 立即 reject；命令的 resolve/reject 由异步任务内的 `PluginStore::extend_api` 完成（命中插件由插件处理，未命中插件 reject `"plugin {plugin} not found"`）。

**为什么不短暂重试后 reject**：重试仍可能阻塞主线程（自旋/睡眠均消耗主线程时间片，与 appfreeze 修复目标冲突）；reject 则让 store load 等正常命令在前端表现为失败，体验劣于异步执行。`spawn_blocking` 既不阻塞主线程又不丢命令，严格优于重试/reject。`spawn_blocking` 本身开销极低（tokio 阻塞池复用），高频降级不会成为瓶颈。

**Send/Sync 保证**：`Arc<AppManager<R>>: Send` 要求 `AppManager<R>: Send + Sync`（`R: Runtime` 即 `Send + Sync`，`AppManager` 字段均为 `Send + Sync`：`Mutex<PluginStore<R>>`、`Config`、`Arc<StateManager>` 等）。`Invoke<R>: Send`（`InvokeMessage<R>`/`InvokeResolver<R>` 在移动端 mobile 路径已跨线程移动，L1900 `message.clone()`、L1928 `run_command` 回调均跨线程）。闭包捕获 `this: Arc<AppManager<R>>`、`plugin_owned: String`、`invoke: Invoke<R>` 均 `Send + 'static`，返回 `bool: Send`，满足 `spawn_blocking` 约束。

### Decision 3: 降级路径不新增重试/超时/告警日志

异步任务内的 `lock().expect()` 在最坏情况下阻塞 tokio 阻塞线程池线程 6s+（与现场观测一致），但：
- 阻塞池线程非主线程，不触发 appfreeze。
- tokio 阻塞池默认上限 512 线程，单线程长阻塞不会饿死池（且持锁方终会释放）。
- 不在降级路径加 `try_lock` 重试或超时 reject：超时 reject 仍丢命令，违背"不丢命令"约束。
- 不加 `log::warn` 告警：app.rs L2691 `on_event` 的 warn 已足以观测锁争用（同一把锁），`extend_api` 降级路径重复告警会产生日志风暴（现场 warn 已高频 6s+）。降级是静默兜底，命令最终 resolve/reject 即可观测。

**例外**：若 `spawn_blocking` 返回的 `JoinHandle` panic（如 `lock().expect()` 因锁中毒 panic），tokio 默认打印 panic 到 stderr/hilog。锁中毒只在持锁线程 panic 时发生，本设计不引入新的 panic 路径。

## Risks / Trade-offs

- **[命令乱序完成]** OHOS 降级路径下，多个 invoke 经 `spawn_blocking` 并发执行，完成顺序可能与发起顺序不一致。→ 与移动端 mobile 异步命令语义一致（webview/mod.rs L1899-1942 mobile 路径已是异步 `run_command`），前端 invoke Promise 独立、不依赖跨命令顺序。可接受。
- **[`extend_api` 签名变更（`&self` → `self: &Arc<Self>`）]** 影响 `pub` API。→ 该方法为框架内部派发路径，唯一调用点已持 `Arc`；审计 tauri crate 无其他调用点；外部用户代码不直接调用 `AppManager::extend_api`。风险低。若未来发现外部依赖，可补充一个 `pub fn extend_api_ref(&self, ...)` 包装（非 OHOS 直接转发，OHOS panic 指示需 Arc），但当前不预留。
- **[tokio 阻塞池线程长占用]** 降级任务在阻塞池线程上 `lock()` 等待，最坏 6s+。→ 非主线程，不触发 appfreeze；阻塞池容量大（默认 512）；持锁方终会释放。若锁争用成为常态，应另起 change 排查持锁方根因（如 http `on_event` Exit `rx.recv()`），本变更只做兜底防崩。
- **[降级路径下 `handled=true` 但插件未命中时 reject 延迟]** `on_message` 不会立即 reject，未命中 reject 由异步任务内 `PluginStore::extend_api`（plugin.rs L983）发出，前端 Promise 收到 `"plugin {plugin} not found"`。→ reject 内容与同步路径一致，仅时序异步化，前端无感。
- **[OHOS 上 `on_message` 是否真在主线程]** 本设计假设 `on_message` 在 OHOS 主线程执行（基于现场 appfreeze 现象与 WebView IPC 回调派发模型）。→ 即使 `on_message` 在非主线程，`try_lock` + `spawn_blocking` 降级仍是安全收紧（避免任一线程长阻塞），不会引入回归。若实际非主线程，降级路径仅产生少量异步任务开销，可接受。

## Migration Plan

无数据/配置迁移。代码改动为单文件两处（mod.rs 签名+body、webview/mod.rs 调用点适配）。

**部署**：随 tauri crate OHOS 构建下发，无运行时开关。其他平台编译不受影响（`cfg(not(target_env = "ohos"))` 走原路径）。

**回滚**：还原 `extend_api` 签名为 `&self` + 阻塞 `lock().expect()`，还原 webview/mod.rs 调用点。无状态需清理。

## Open Questions

- 持锁方根因（http `on_event` Exit `rx.recv()` 是否仍在 OHOS 上阻塞、`initialize_all` 慢初始化是否需要同类硬化）超出本变更范围，应另起 change 排查。本变更为兜底防崩，不修复根因。

---

## Addendum: 异步命令响应的 waker/drain 通道（#81 完整根因与修复）

Decision 2 的 `extend_api` try_lock 降级是必要但不充分的：它在锁争用时避免主线程 appfreeze，但**异步插件命令响应仍超时**。深挖 IPC 响应链定位到第二层根因——主线程唤醒通道（waker + drain）从未工作。

### 响应链（异步命令）
异步插件命令是 `async fn`，在 tokio worker 线程上 resolve → `responder_eval`（`ipc/protocol.rs`）→ `webview.eval("runCallback(...)")` → `tauri-runtime-wry::send_user_message`（lib.rs:317）。`send_user_message` 关键分叉：
- 主线程（`current_thread().id() == context.main_thread_id`）→ 直接 `handle_user_message`（**同步命令走此路，为何同步命令不超时**）。
- 非主线程 → `context.proxy.send_event(message)` → tao `EventLoopProxy::send_event`（`tao/.../ohos/mod.rs:760`）：压入 `user_events_sender` mpsc 后 `self.waker.wake()`。

`waker.wake()` 触发 TSFN `NonBlocking` 回调（`lifecycle.rs:69`）→ `h(Event::UserEvent)` → tao run_loop（`mod.rs:531`）的 `MainEvent::UserEvent` 分支（`mod.rs:690`）→ drain `user_events_receiver` → `handle_user_message` → `webview.evaluate_script`。**整个 `WindowsStore` RefCell borrow 只在此主线程 drain 路径发生**（`unsafe impl Send/Sync for WindowsStore` 的健全性不变量：仅主线程 borrow）。

### 第二层根因：waker 快照时序 bug
`OpenHarmonyWaker` 在 `create_proxy`/`create_waker`（`app.rs:160`）时**快照** `WAKER` 全局 TSFN。`WAKER` 由 `create_lifecycle_handle`（`lifecycle.rs:82-88`）填充，但**时序**：
- `#[ability]` derive 的 NAPI `init`（`derive/lib.rs:135-136`）：行 135 跑 tauri 入口 `#fn_name`（mobile_entry_point 生成）→ `Builder::build()` → `Wry::init`（`context.proxy = event_loop.create_proxy()` 在 lib.rs:3174 **快照 WAKER**）→ `app.run()` → `event_loop.run`/`run_return`（OHOS 上**非阻塞**，只注册 handler 即返回，`tao/.../ohos/mod.rs:511-531` + `app.rs:730-751`）→ `#fn_name` 返回。
- 行 136：`create_lifecycle_handle` → **此时才填充 WAKER**。

因此 `context.proxy.waker`（send_user_message 实际使用的 proxy，在 `#fn_name` 内构造，永不重建）的 waker **永久为 `None`** → `wake()` 静默空操作 → `MainEvent::UserEvent` 从不 fire → worker 线程的异步响应永不 drain → JS Promise 永不 settle → 5000ms 超时。同步命令在主线程 resolve 走同步分支，不经 waker，故不受影响——这解释了"同步命令过、异步命令超时"的分布。`[DRAIN-DIAG]` count=0 实测证实 `MainEvent::UserEvent` 从未 fire。

### 修复
**Fix 1（drain，前序会话）**：`tao/.../ohos/mod.rs:690` `MainEvent::UserEvent` 分支由单次 `try_recv` 改为 `while let` 全量 drain。TSFN `NonBlocking` 唤醒会合并 N 个排队事件为一次 `MainEvent::UserEvent`；单次 `try_recv` 只取一个，余下滞留至下次唤醒（可能迟迟不来）。`while let` 一次唤醒取尽。**必要但不充分**——waker 不 fire 时 drain 根本不触发。

**Fix 2（waker live-read，本会话）**：`OpenHarmonyWaker::wake()` 改为**实时读** `WAKER` 全局（`waker.rs`），而非用构造时快照的 `Option<Arc<TSFN>>` 字段。`OpenHarmonyWaker` 变为零字段 struct（`#[derive(Clone)]`，保留 `EventLoopProxy::clone` 所需 Clone）。`create_waker`（`app.rs:160`）不再快照，返回 `OpenHarmonyWaker::new()`。等任意 worker 线程命令 resolve 调 `wake()` 时，`create_lifecycle_handle` 早已执行完，实时读必得 `Some`。

**健全性**：`WAKER` 是 `LazyLock<RwLock<Option<Arc<TSFN>>>>`，`wake()` 从任意线程 `read()` 后 clone `Arc` 出来再 drop guard 再 `.call(NonBlocking)`（不在持锁期间 call）。修法只改 waker **何时被读**，不改 callback **在哪运行**——TSFN 回调仍在主线程 fire → `MainEvent::UserEvent` → 主线程 drain → 主线程 borrow，`WindowsStore` 不变量保持。审计子 agent 复核：修法 sound、三铁律合规（仅改 openharmony-ability，OHOS-only by nature，不碰跨平台代码）。

### 实测验证（HUAWEI MateBook Pro，desktop）
- `[WAKE-CALL] waker=Some`（修前 None）；来自主线程 ThreadId(1) + tokio worker 23/24/33。
- `[WAKE-FIRE] waker TSFN callback running on thread ThreadId(1)`——TSFN 回调**在主线程 fire**（审计担心的残留风险排除：既功能可用又保证 RefCell borrow 健全性）。
- 163 次 wake → 163 次 callback fire（1:1）→ 163 事件被 drain；48 次"queue empty"为合并唤醒的良性现象（前次合并唤醒已 drain 完）。
- **修前超时的异步窗口命令现在全部 PASS**：`window.set_position`(559ms)、`window.set_size`(614ms)、`maximize/unmaximize`(532/1051ms)、`create_transparent_borderless_window`(538ms) 等。原 #81 的 event 通道 `listen`/`emit` 测试不再出现在失败列表。

### 残留：#85 多窗口死锁
#81 修好后，测试跑到第 45 个 `on_new_window: Allow triggers event with correct URL`（`examples/api/src/lib/tests/core.ts:933`，**真正创建新窗口**）时**死锁**主线程，整个 runner 卡住。这是 **#85 多窗口**问题（`WebviewCreateRequest` 丢失 `window_id` 字段，`WindowCreate` 被忽略）。之前 #81 bug 把它**掩盖成 5s 超时**（runner 能跳过继续到 157 个测试）；#81 修好后异步命令真正执行，`window.open` 创建新窗口路径反而死锁。**必须修 #85 才能跑完整测试套件**。

### 诊断日志（待 #65 统一清理）
本会话临时加的 `[WAKE-CALL]`/`[WAKE-FIRE]` INFO 日志已确认修复后**移除**（高频刷屏 hilog 挤掉测试结果）。`[DRAIN-DIAG]`（tao mod.rs:690）+ `[IPC-DIAG]`（protocol.rs）为前序会话所加，待全功能通过后由 #65 统一清理。
