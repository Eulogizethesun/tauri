## ADDED Requirements

### Requirement: check_input_monitoring_permission returns false (OHOS stub)
系统 SHALL 提供 `check_input_monitoring_permission` IPC 命令，始终返回 `false`。

OHOS 的 `ohos.permission.INPUT_MONITORING` 是 `system_basic` 级别权限，三方应用无法获取。
macOS 通过 IOKit FFI（`IOHIDCheckAccess`）检查全局输入监控权限，OHOS 无等价 API。
注意：Tauri 已有的窗口内鼠标事件（通过 XComponent 回调）不需要此权限，两者是不同概念。

非 OHOS 平台 SHALL 返回 `true`（降级空操作，与 macOS 插件行为一致）。

#### Scenario: OHOS 平台始终返回 false
- **WHEN** 在 OHOS 平台调用 `check_input_monitoring_permission()`
- **THEN** 返回 `false`

#### Scenario: 非 OHOS 平台返回 true
- **WHEN** 在 Windows/macOS/Linux 平台调用 `check_input_monitoring_permission()`
- **THEN** 返回 `true`

### Requirement: request_input_monitoring_permission is no-op (OHOS stub)
系统 SHALL 提供 `request_input_monitoring_permission` IPC 命令，为空操作（返回 `Ok(())`）。

#### Scenario: 所有平台空操作
- **WHEN** 调用 `request_input_monitoring_permission()`
- **THEN** 返回 `Ok(())`，不弹出任何对话框

### Requirement: guest-js checkInputMonitoringPermission API
`guest-js/index.ts` SHALL 导出 `checkInputMonitoringPermission(): Promise<boolean>` 函数。

#### Scenario: JS API 调用
- **WHEN** 前端调用 `await checkInputMonitoringPermission()`
- **THEN** 通过 invoke 调用 Rust command 并返回 `boolean`

### Requirement: guest-js requestInputMonitoringPermission API
`guest-js/index.ts` SHALL 导出 `requestInputMonitoringPermission(): Promise<void>` 函数。

#### Scenario: JS API 调用
- **WHEN** 前端调用 `await requestInputMonitoringPermission()`
- **THEN** 通过 invoke 调用 Rust command 并返回 void
