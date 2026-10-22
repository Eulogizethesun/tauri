# ohos-window-focus-state Specification

## MODIFIED Requirements(Purpose 扩展)

Purpose 增补:③Float 子窗口焦点事件接通(经 `windowEvent` WINDOW_ACTIVE/WINDOW_INACTIVE 采集、NAPI 上报、变化沿去重 + 配对合成后闭环到 per-window focused 位,p3 #180①)。

## ADDED Requirements

### Requirement: Float window focus transitions SHALL reach WindowStateMirror

Float 子窗口的激活/失活 SHALL 经 ArkTS `windowEvent` 订阅(WINDOW_ACTIVE=2 / WINDOW_INACTIVE=3,`windowFocusChange` 在本地 SDK20 `@ohos.window.d.ets` 缺席,以 @since 20 的 windowEvent 为等价物)上报 NAPI `notify_window_focus`,tao 侧经共享 lastFocusedWindowId 快照的变化沿去重后写入对应窗口的 WindowStateMirror focused 位(p2 #173 写入面)。增益沿 SHALL 对前一持焦窗合成失焦(配对语义);stage 通路 SHALL 同步维护同一快照以吞跨路径重复沿。订阅注册 SHALL 带 typeof 探测与降级:宿主不支持 windowEvent 时记录结构化日志且不 panic。

#### Scenario: Float window activation sets focused bit

- **WHEN** Float 子窗口 W 收到 WINDOW_ACTIVE(2)且 tao 侧记录的 lastFocusedWindowId ≠ W
- **THEN** NAPI `notify_window_focus(window_id=W, focused=true)` 触发
- **AND** W 的 WindowStateMirror `focused` 位写为 `true`(p2 #173 写入面)
- **AND** 主窗收到 lastFocusedWindowId 变化通知

#### Scenario: Gain edge synthesizes loss for the previous focus holder

- **WHEN** Float 子窗口 W 收到 WINDOW_ACTIVE(2)而 lastFocusedWindowId 记录的前持焦窗 P≠W 且 P 仍标记 focused=true
- **THEN** tao 侧 SHALL 先对 P 合成失焦(mirror `focused` 位清 false + Focused(false) 事件),再对 W 走增益通路
- **AND** ArkTS 未发 P 的 WINDOW_INACTIVE(快速切换)时 P 的 focused 位不滞留

#### Scenario: Float window deactivation clears focused bit

- **WHEN** Float 子窗口 W 收到 WINDOW_INACTIVE(3)且当前 lastFocusedWindowId = W
- **THEN** W 的 WindowStateMirror `focused` 位写为 `false`
- **AND** lastFocusedWindowId 按语义更新(归零)

#### Scenario: Duplicate transitions are de-duplicated

- **WHEN** 同一窗口连续上报相同焦点态(如已 focused=true 再收 WINDOW_ACTIVE)
- **THEN** 变化沿去重 SHALL 吞掉重复沿,不产生重复 WindowEvent
- **AND** 主窗监听者不收到重复 lastFocusedWindowId 通知

#### Scenario: stage-path events share the same de-dup guard

- **WHEN** 主窗(UIAbility stage 路径)与 Float 路径的事件先后到达
- **THEN** 两条路径 SHALL 共用同一 lastFocusedWindowId 沿检测(stage GainedFocus/LostFocus 臂同步维护该快照),跨路径重复沿同样被吞

#### Scenario: Unsupported windowEvent degrades safely

- **WHEN** 宿主 ArkTS 运行时不提供 `window.on('windowEvent')`(typeof 探测失败)
- **THEN** 订阅跳过并记录结构化 warn(含窗口 id 与原因)
- **AND** 不抛出、不 panic,mirror 维持注册时快照值
