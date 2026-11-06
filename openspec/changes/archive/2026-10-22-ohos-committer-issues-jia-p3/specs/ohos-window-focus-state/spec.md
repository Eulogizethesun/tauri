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

### Requirement: Creation-time focus intent SHALL map to persistent focusability (p3 修复变体 m1)

builder `focused:false` SHALL 映射为持久 `set_focusable(false)`(对齐 gtk `accept_focus(focusable && focused)` 的创建期不可聚焦语义;刻意异于 Windows 的"创建不聚焦但保持可聚焦")。`focused` 属性默认 `true`;tauri 窗口 config 的 `focus`(默认 true,可设 false)经 runtime-wry 透传进 attributes——`false` 走同一 differ-from-default 补发路径。任何形态都不产生 `set_focus()` 附加流量(默认构造零调度场景不变)。

#### Scenario: Builder focused false persists non-focusable

- **WHEN** 窗口以 `with_focused(false)` 创建
- **THEN** 补发计划 SHALL 落 `set_focusable(false)`(持久,gtk `accept_focus(false)` 同义)
- **AND** 不产生创建期 `set_focus()` 调用

#### Scenario: Config focus false reaches the same path

- **WHEN** tauri config 窗口条目设 `focus: false`(config.rs 默认 true)
- **THEN** runtime-wry SHALL 透传 `attributes.focused=false`,与 builder 形态共用同一补发路径

#### Scenario: Default and explicit-true stay no-ops

- **WHEN** 窗口以默认 attributes 或 `focused: true` 创建
- **THEN** 补发计划 SHALL 为零调度(不派发焦点相关命令)
