## ADDED Requirements

### Requirement: check_screen_recording_permission returns false (OHOS stub)
系统 SHALL 提供 `check_screen_recording_permission` IPC 命令，始终返回 `false`。

OHOS 的 `ohos.permission.CAPTURE_SCREEN` 是 `system_basic` 级别权限，三方应用无法获取。
macOS 通过 CoreGraphics FFI（`CGPreflightScreenCaptureAccess`）检查，OHOS 无等价的用户级 API。

非 OHOS 平台 SHALL 返回 `true`（降级空操作，与 macOS 插件行为一致）。

#### Scenario: OHOS 平台始终返回 false
- **WHEN** 在 OHOS 平台调用 `check_screen_recording_permission()`
- **THEN** 返回 `false`

#### Scenario: 非 OHOS 平台返回 true
- **WHEN** 在 Windows/macOS/Linux 平台调用 `check_screen_recording_permission()`
- **THEN** 返回 `true`

### Requirement: request_screen_recording_permission is no-op (OHOS stub)
系统 SHALL 提供 `request_screen_recording_permission` IPC 命令，为空操作（返回 `Ok(())`）。

#### Scenario: 所有平台空操作
- **WHEN** 调用 `request_screen_recording_permission()`
- **THEN** 返回 `Ok(())`，不弹出任何对话框

### Requirement: guest-js checkScreenRecordingPermission API
`guest-js/index.ts` SHALL 导出 `checkScreenRecordingPermission(): Promise<boolean>` 函数。

#### Scenario: JS API 调用
- **WHEN** 前端调用 `await checkScreenRecordingPermission()`
- **THEN** 通过 invoke 调用 Rust command 并返回 `boolean`

### Requirement: guest-js requestScreenRecordingPermission API
`guest-js/index.ts` SHALL 导出 `requestScreenRecordingPermission(): Promise<void>` 函数。

#### Scenario: JS API 调用
- **WHEN** 前端调用 `await requestScreenRecordingPermission()`
- **THEN** 通过 invoke 调用 Rust command 并返回 void
