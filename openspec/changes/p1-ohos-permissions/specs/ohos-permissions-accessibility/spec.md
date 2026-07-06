## ADDED Requirements

### Requirement: check_accessibility_permission returns false (OHOS stub)
系统 SHALL 提供 `check_accessibility_permission` IPC 命令，始终返回 `false`。

OHOS 平台的 `AccessibilityExtensionAbility` 自 API 12 废弃，替代 API 仅限系统应用。
三方应用无法注册自己的辅助功能服务，因此无法像 macOS 的 `application_is_trusted()` 那样检查应用级辅助功能权限。

非 OHOS 平台 SHALL 返回 `true`（降级空操作，与 macOS 插件行为一致）。

#### Scenario: OHOS 平台始终返回 false
- **WHEN** 在 OHOS 平台调用 `check_accessibility_permission()`
- **THEN** 返回 `false`

#### Scenario: 非 OHOS 平台返回 true
- **WHEN** 在 Windows/macOS/Linux 平台调用 `check_accessibility_permission()`
- **THEN** 返回 `true`

### Requirement: request_accessibility_permission is no-op (OHOS stub)
系统 SHALL 提供 `request_accessibility_permission` IPC 命令，为空操作（返回 `Ok(())`）。

OHOS 无等价的辅助功能权限申请弹窗 API（macOS 的 `application_is_trusted_with_prompt()` 无对应）。

#### Scenario: OHOS 平台空操作
- **WHEN** 在 OHOS 平台调用 `request_accessibility_permission()`
- **THEN** 返回 `Ok(())`，不弹出任何对话框

#### Scenario: 非 OHOS 平台空操作
- **WHEN** 在 Windows/macOS/Linux 平台调用 `request_accessibility_permission()`
- **THEN** 返回 `Ok(())`

### Requirement: guest-js checkAccessibilityPermission API
`guest-js/index.ts` SHALL 导出 `checkAccessibilityPermission(): Promise<boolean>` 函数。

#### Scenario: JS API 调用
- **WHEN** 前端调用 `await checkAccessibilityPermission()`
- **THEN** 通过 invoke 调用 Rust command 并返回 `boolean`

### Requirement: guest-js requestAccessibilityPermission API
`guest-js/index.ts` SHALL 导出 `requestAccessibilityPermission(): Promise<void>` 函数。

#### Scenario: JS API 调用
- **WHEN** 前端调用 `await requestAccessibilityPermission()`
- **THEN** 通过 invoke 调用 Rust command 并返回 void
