## Why

p2-mainthread-event-hygiene 的死锁修复验证（2026-08-25）审计发现 `restore_state`
（plugins-workspace/plugins/window-state/src/lib.rs L266-394）存在与已修复的
save_window_state AB 死锁同款的第二个暴露点：

- `WindowStateCache` 锁从 L277 持有到函数结束（L393），横跨 L318 的
  `self.available_monitors()?`
- `available_monitors()` 经 `window_getter!` 宏走 `rx.recv()` 阻塞环回等主线程应答
- cmd.rs 的 `#[command] async fn restore_state` 在 **tokio worker** 上执行
  （worker ≠ main_thread_id，无主线程短路）→ worker 持锁等主线程 + 主线程
  Resized handler `cache.lock()` 等锁 = 互等死锁（THREAD_BLOCK_6S）

**触发条件是生产默认值**：`StateFlags::default() == all()`（L62-66），包含
POSITION——真实应用按 README 用法调 `window.restore_state()` 即踩中。examples/api
测试只传 SIZE 所以未触发，属"测试盲区而非不可达"。

顺带一个同源卫生问题：OHOS 的 saved-state 文件重读块（L286-302）在 cache 锁内做
`std::fs::read`——与 save 侧已修复的"锁内 fs::write"同类（锁内磁盘 I/O）。

## What Changes

- **plugins-workspace/plugins/window-state/src/lib.rs `Window::restore_state`**：
  OHOS 路径（`cfg(target_env = "ohos")` 隔离，非 OHOS 路径逐字节不动）重构为
  "锁外读文件 → 短锁快照/写回 → 锁外做窗口操作"：
  1. 锁外：`std::fs::read` 读 saved-state 文件（原在锁内）
  2. 短锁：文件值写回 cache + `saved = c.get(label).cloned()` + 无 saved 时
     insert `WindowState::default()`（原 else 分支的 OHOS 语义，OHOS 无 getter 调用）
  3. 锁外：POSITION 分支的 `available_monitors()?`/intersects/set_position、SIZE 的
     set_size、DECORATIONS/MAXIMIZED/FULLSCREEN 的 cfg(desktop) setter、VISIBLE 的
     show/set_focus——全部是 fire-and-forget dispatch（无 `rx.recv()` 环回），
     任何线程调用均安全
- `RestoringWindowState` 守卫锁保持跨全函数（event handler 侧全是 `try_lock()`
  非阻塞，无死锁参与面，其"恢复期间防 cache 覆写"语义要求覆盖 set_position
  到 Moved 事件返回的全窗口）

### 不改清单

- 非 OHOS 路径（`cfg(not(ohos))`）：原函数体原样保留——桌面端 getter 在锁内的
  既有行为不动（桌面事件循环 inline 短路，无本死锁面；铁律 2）
- `available_monitors()` 的 `?` 错误传播语义保持（仅从锁内移到锁外，Err 时同样
  中止 restore_state）
- cmd.rs / api.ts 调用方零变化；无 ArkTS 改动，无需 HAR 重建

## Impact

- **代码层**：仅 window-state 一个文件的一个函数；Rust-only，cfg 隔离
- **验证**：cargo check（OHOS + host 双目标）+ 真机套件回归（基线
  281✅/1❌(#86)/1⏭️(#271)）+ faultlog 零新增；examples/api 现有测试不传
  POSITION（盲区），故真机验证补一条 `restoreState(label, StateFlags.ALL)` 的
  手动/探针调用确认恢复行为正常（无 appfreeze、位置正确恢复）
- **风险**：低——与 save_window_state 修复（已验证）完全同款模式；语义差异点
  仅"setter 从锁内挪锁外"（setter 不触碰 cache，无互斥需求）
