# ohos-window-focus-state Specification

## Purpose

OHOS 窗口焦点态保真:①per-window 焦点镜像(为 Float 子窗焦点接通提供写入面,#180① 前置基建);②主窗 `set_focusable` 不再静默假成功(真机仲裁双支路收束)。本 spec 以分支中立措辞约束可观察行为——具体支路以真机仲裁结论为准,两支路均满足本 spec。

## ADDED Requirements

### Requirement: WindowStateMirror SHALL carry a focused bit
The per-window OHOS state mirror SHALL carry a `focused` flag in addition to the existing visible/fullscreen/maximized/minimized flags. The flag SHALL be initialized from the app-level focus state at mirror registration time, and SHALL be updated on focus-gained and focus-lost events for the matching window.

#### Scenario: Initial snapshot at registration
- **WHEN** a window mirror is registered while the app-level focus state is `true`
- **THEN** the mirror's `focused` flag is initialized to `true`
- **AND** when registered while the app-level focus state is `false`, the mirror initializes to `false`

#### Scenario: Focus transitions write the per-window bit
- **WHEN** a focus-gained event is handled for window N
- **THEN** window N's mirror `focused` flag is set to `true`
- **AND** when a focus-lost event is handled for window N, the flag is set to `false`

#### Scenario: Mirror lookup miss is tolerated
- **WHEN** a focus event arrives for a window id whose mirror has already been unregistered
- **THEN** the write is silently skipped and no error is raised

#### Scenario: is_focused semantics unchanged this phase
- **WHEN** `is_focused()` is called on an OHOS window
- **THEN** it reads the app-level focus state as before (per-window focus semantics are a later-phase concern)

### Requirement: Main-window setFocusable SHALL NOT fake success
`set_focusable` on the main OHOS window SHALL NOT be a silent no-op: either the request is forwarded to the window manager with its outcome surfaced (success forwards like sub-windows; failure warns with the window id and the platform error), or the request is declined with a structured warn that records the OS-managed rationale and the arbitration evidence. The public facade documentation SHALL carry an OpenHarmony platform-specific line stating which branch applies.

#### Scenario: Arbitration Branch A — main window forwards
- **WHEN** the device arbitration shows the window manager accepts `setWindowFocusable` for the main window
- **THEN** the main-window gate is removed and the request is dispatched through the same bridge path as sub-windows
- **AND** a failed apply warns with the window id and platform error

#### Scenario: Arbitration Branch B — main window stays OS-managed
- **WHEN** the device arbitration shows the window manager rejects `setWindowFocusable` for the main window
- **THEN** the no-op is upgraded to a structured warn recording the OS-managed rationale and arbitration evidence
- **AND** the existing window-id gate is kept

#### Scenario: Either branch keeps the suite green
- **WHEN** the desktop regression suite runs after the arbitration branch is implemented
- **THEN** the existing setFocusable smoke cases pass unchanged
