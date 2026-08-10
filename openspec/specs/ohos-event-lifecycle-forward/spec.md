# OHOS Event Lifecycle Forward Specification

## Purpose

定义 OHOS `openharmony_ability::Event` 生命周期事件（`Start`、`SaveState`）到 tao
`event::Event` 的转发契约。当前实现中两者均以 `warn!` 静默丢弃，本 spec 明确：
- `Start`（`WindowStageEventType::SHOWN`）SHALL 转发为 `Event::Resumed`；
- `SaveState`（`onAbilitySaveState`）因 tao `Event`/`StartCause` 枚举无对应语义，
  SHALL 显式降级为 `debug!` 日志（不再 `warn!`），并文档化平台限制。

## ADDED Requirements

### Requirement: MainEvent::Start 转发为 Event::Resumed

tao OHOS 事件循环 SHALL 将 `MainEvent::Start`（`WindowStageEventType.SHOWN`，窗口
对用户可见）转发为 `event::Event::Resumed`，与 `MainEvent::SurfaceCreate` /
`MainEvent::Resume` 的现有行为保持一致。

tao 的 `Event::Resumed` 是最接近 OHOS "窗口已显示" 语义的生命周期信号（tao 没有
独立的 "window-shown" 事件）。重复触发 `Resumed`（与 SurfaceCreate/Resume 一起）
是可接受的，下游 tauri `RunEvent::Resumed` 处理需具备幂等性。

#### Scenario: 窗口从隐藏恢复显示
- **WHEN** 系统发出 `MainEvent::Start`（SHOWN），例如从最近任务列表切回应用
- **THEN** 事件回调 SHALL 收到 `Event::Resumed`
- **AND** 不再出现 `warn!("TODO: forward onStart notification to application")`

#### Scenario: 与 SurfaceCreate 共存
- **WHEN** 冷启动序列中 `SurfaceCreate` 与 `Start` 先后到达
- **THEN** 回调 SHALL 收到两次 `Event::Resumed`（一次来自 SurfaceCreate，一次来自 Start）
- **AND** 下游 tauri 逻辑 SHALL 对重复 Resumed 幂等处理

### Requirement: MainEvent::SaveState 显式降级

OHOS `onAbilitySaveState` 在系统内存压力下回收应用时触发，用于持久化应用状态。
tao 的 `Event` 枚举与 `StartCause` 枚举（`ResumeTimeReached` / `WaitCancelled` /
`Poll` / `Init`）均无对应语义变体（特别是 `StartCause` 不存在 `Autosave` 变体），
因此无法在 tao 层暴露此信号。

tao OHOS 实现 SHALL 将 `MainEvent::SaveState` 作为平台限制降级处理：
- 不转发任何 `event::Event`；
- 日志级别 SHALL 从 `warn!` 下调为 `debug!`（该事件是预期行为，非错误）；
- 注释 SHALL 说明降级原因与对应 OHOS 文档链接。

#### Scenario: 系统发起 SaveState
- **WHEN** 系统因内存回收调用 `onAbilitySaveState`
- **THEN** tao 事件回调 SHALL NOT 收到任何 `Event`
- **AND** 日志 SHALL 输出 `debug!` 级别说明（"SaveState has no tao Event equivalent; dropped"）
- **AND** 不再出现 `warn!` 噪音

#### Scenario: 应用无需感知状态保存
- **WHEN** 跨平台应用依赖 tao 事件循环做状态持久化
- **THEN** 应用 SHALL 通过 tauri `RunEvent::Exit` / `ExitRequested` 或自定义持久化逻辑处理
- **AND** 不得假设 OHOS 上会收到 SaveState 信号

### Requirement: 注释与文档对齐

tao OHOS `mod.rs` 中 `MainEvent::Start` 与 `MainEvent::SaveState` 分支 SHALL 移除
`XXX: how to forward this state to applications?` 疑问注释，替换为本 spec 的明确
处置说明（转发 Resumed / 平台限制降级）。

#### Scenario: 源码注释更新
- **WHEN** 审查 tao OHOS 事件循环 `run_loop` 闭包
- **THEN** `MainEvent::Start` 分支注释 SHALL 说明 "forwarded as Event::Resumed (window-shown lifecycle signal)"
- **AND** `MainEvent::SaveState` 分支注释 SHALL 说明 "degraded: tao has no SaveState Event variant; see openspec ohos-event-lifecycle-forward"
