# Technical Design: Phase 2 — 内部重构

## Context

Phase 1 完成后，所有外部 consumer 已迁移到 plugin facade。openharmony-ability 核心 crate 内部仍残留大量运行时耦合点：cursor 位置全局变量、waker 全局 TSFN 单例、helper 子模块中 13 个 TSFN 全局、`GLOBAL_DISPATCHER`、以及 5 处 unsafe transmute/ptr::read/ManuallyDrop。这些遗留物假设单一消费者实例、使用 unsafe 跨线程传递引用，是 Phase 2 的清理目标。

本 Phase 纯内部重构，不改变外部行为，不涉及外部 consumer 迁移。

## Goals

- 删除 `app.rs` 全局 `CURSOR_POSITION_X/Y` + NAPI `update_cursor_position`，cursor 位置由 tao 本地缓存
- 评估 `waker.rs` 全局 `WAKER` TSFN 替代方案（复用 tao EventLoop 已有 `ProxyJsHelper`/waker vs 保留全局）
- 删除 helper 子模块（account/opener/autostart/restart/permission/updater）中 13 个 TSFN 全局
- 删除 `menu/event.rs` 的 `GLOBAL_DISPATCHER`
- 修复 5 处 unsoundness（transmute + ptr::read + ManuallyDrop）
- 接缝 1 close 队列：评估 tauri-runtime-wry 自建队列 vs 中性化注释保留

## Non-Goals

- 不迁移外部 consumer（Phase 1 已完成，Phase 4 处理延迟 consumer）
- 不迁移 plugin crate channel API（Phase 3 负责）
- 不删除 ArkHelper 旧调用链（Phase 4 负责）
- 不清理 Tauri 耦合注释（Phase 5 负责）
- 不改变任何外部可见 API 行为

## Decisions

### D1 cursor: tao 本地缓存替代全局

**决策**：tao `handle_mouse_event` 的 Move 分支已拿到 `mouse_event.x/y` 并 emit `CursorMoved`，但未本地缓存。改为在该分支存 `self.cursor_x/y`，`cursor_position()` 读本地缓存，然后删除 `app.rs` 全局 `CURSOR_POSITION_X/Y` + NAPI `update_cursor_position` + ArkTS `onMouse→NAPI` 旁路。

**理由**：
- cursor 位置只有 tao 一个消费者，全局变量是冗余的跨模块耦合
- tao 本地缓存消除了 NAPI 调用开销和全局 AtomicI32 同步成本
- 删除后 `app.rs` cursor 全局注释中的 "tao reads these values in cursor_position()" 自动消失

**涉及文件**：
- `openharmony-ability/crates/ability/src/app.rs`（删除 `CURSOR_POSITION_X/Y` + `update_cursor_position`）
- `tao/src/platform_impl/ohos/mod.rs`（`handle_mouse_event` Move 分支存本地缓存 + `cursor_position()` 改读本地）

### D2 waker: 评估 tao EventLoop 已有 waker 机制

**决策**：tao EventLoop 已有 `ProxyJsHelper`/waker 机制。评估是否可直接复用 tao 侧 waker 替代 `waker.rs` 全局 `WAKER` TSFN 单例。

**评估方向**：
- 若 tao EventLoopProxy 可独立唤醒主线程（不依赖全局 TSFN），则删除 `WAKER` 全局 + `app.rs:create_waker` + `waker.rs` 模块
- 若 tao 侧 waker 仍需底层 TSFN 支撑，则保留 `waker.rs` 但将其归属从"核心 crate 全局"降级为"运行时集成层基础设施"，加中性化注释说明其角色

**理由**：`WAKER` 全局单例假设单一事件循环消费者。tao 是唯一合法消费者，若 tao 自身可提供 waker 能力，全局即为冗余。

**涉及文件**：
- `openharmony-ability/crates/ability/src/waker.rs`
- `openharmony-ability/crates/ability/src/app.rs`（`create_waker` 调用点）

### D3 TSFN 删除: helper 子模块 13 个全局随 consumer 迁移完成而删除

**决策**：helper 子模块中的 13 个 TSFN 全局（account 3 + opener 2 + autostart 3 + restart 1 + permission 1 + updater 3）随 Phase 1 consumer 迁移完成后已无外部调用者。逐个验证无活跃引用后删除。

**删除清单**：
- `helper/account.rs`：3 个 TSFN 全局
- `helper/opener.rs`：2 个 TSFN 全局
- `helper/autostart.rs`：3 个 TSFN 全局
- `helper/restart.rs`：1 个 TSFN 全局
- `helper/permission.rs`：1 个 TSFN 全局
- `helper/updater.rs`：3 个 TSFN 全局

**验证方式**：每个 TSFN 全局删除前 grep 确认零活跃引用。

### D4 unsoundness: 5 处 transmute/ptr::read/ManuallyDrop 用安全替代

**决策**：5 处 unsoundness 用安全 handle + 显式生命周期替代。

| # | 位置 | 问题 | 修复方案 |
|---|------|------|---------|
| 1 | `helper/mod.rs:43` | `std::mem::forget(helper)` | 改用安全 handle 持有 ownership |
| 2 | `helper/mod.rs:57-58,61,63,71,73` | `ptr::read` + `ManuallyDrop` 包裹 `ObjectRef` | 改用 NAPI safe handle API + 显式生命周期标注 |
| 3 | `app.rs:736` | `transmute<Box<dyn FnMut(Event)+'a>, Box<dyn FnMut(Event)+'static+Sync+Send>>` | 重构为不依赖 lifetime transmute 的安全回调封装 |
| 4 | `app.rs:751` | `on_back_press_intercept` 同款 transmute | 同上方案 |
| 5 | `helper/mod.rs:1,63,73` | `ManuallyDrop` import + 使用 | 随 #2 一并移除 |

**理由**：bridge 迁移未触及这些 unsoundness。独立修复不影响功能，但消除 UB 风险。

### D5 close 队列: 接受为持久旁路 + 中性化注释

**决策**：接缝 1 close 队列（`PENDING_WINDOW_CLOSES`/`notify_window_close`/`drain_pending_window_closes`）接受为持久旁路，中性化注释后保留。

**理由**：
- 根治 WindowId ZST 问题（让 `MainEvent::WindowDestroy` 携带真实 window id）代价过高，需重构 tao OHOS 后端的 WindowId 类型设计
- close 队列功能正确，只是注释中提及 tauri-runtime-wry/WindowsStore/tao ZST WindowId
- 中性化注释（移除 Tauri 专有术语引用）即可满足"通用层无 Tauri 认知"的判据
- 若未来 tao WindowId 重构完成，可再迁移到 tauri-runtime-wry 适配层自建队列

**涉及文件**：
- `openharmony-ability/crates/ability/src/app.rs`（`PENDING_WINDOW_CLOSES`/`notify_window_close`/`drain_pending_window_closes` 注释中性化）

## Risks

| 风险 | 级别 | 缓解 |
|------|------|------|
| cursor 本地缓存引入行为回归（cursor_position 读到旧值） | 中 | tao Move 分支已 emit CursorMoved，本地缓存在同一调用中写入，时序一致 |
| waker 替代方案引入死锁（tao EventLoop waker 覆盖不全） | 中 | 先评估，若不满足则保留全局 + 降级注释，不强制删除 |
| TSFN 删除遗漏活跃引用导致编译失败 | 低 | 每个全局删除前 grep 确认 + cargo check 逐模块验证 |
| unsoundness 修复改变回调生命周期语义 | 中 | 保持外部行为等价，逐处添加单元测试 |
| close 队列注释中性化后仍被未来审计标记 | 低 | 记录为已知决策，Phase 5 验收时确认 |
