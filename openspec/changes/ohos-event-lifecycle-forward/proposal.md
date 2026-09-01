## Why
tao OHOS 事件循环对 `MainEvent::Start`（SHOWN）与 `MainEvent::SaveState` 仅 `warn!` 丢弃，应用无法感知"窗口恢复显示"。`Start` 是 OHOS 最重要的"对用户可见"信号（从最近任务切回），应转发。

## What Changes
- `tao/src/platform_impl/ohos/mod.rs`：`MainEvent::Start` 转发为 `event::Event::Resumed`（与 SurfaceCreate/Resume 一致，接受重复触发，下游幂等）
- `MainEvent::SaveState`：tao 无对应 Event/StartCause 变体，降级为 `debug!` 日志（不再 `warn!`）
- 移除 `XXX: how to forward` 注释，替换为本 spec 处置说明

## Impact
- 应用能通过 `RunEvent::Resumed` 感知窗口恢复显示
- SaveState 不再产生 warn 噪音
- 不影响其他平台
