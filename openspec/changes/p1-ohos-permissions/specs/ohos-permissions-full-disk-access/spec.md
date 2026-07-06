## ADDED Requirements

### Requirement: check_full_disk_access_permission returns true (OHOS stub)
系统 SHALL 提供 `check_full_disk_access_permission` IPC 命令，始终返回 `true`。

OHOS 采用应用沙箱模型，不存在 macOS "完全磁盘访问"的等价概念。每个应用只能访问自己的沙箱目录，无需额外授权。

非 OHOS 平台 SHALL 返回 `true`（降级空操作，与 macOS 插件行为一致）。

#### Scenario: OHOS 平台始终返回 true
- **WHEN** 在 OHOS 平台调用 `check_full_disk_access_permission()`
- **THEN** 返回 `true`

#### Scenario: 非 OHOS 平台返回 true
- **WHEN** 在 Windows/macOS/Linux 平台调用 `check_full_disk_access_permission()`
- **THEN** 返回 `true`

### Requirement: request_full_disk_access_permission is no-op (OHOS stub)
系统 SHALL 提供 `request_full_disk_access_permission` IPC 命令，为空操作（返回 `Ok(())`）。

#### Scenario: 所有平台空操作
- **WHEN** 调用 `request_full_disk_access_permission()`
- **THEN** 返回 `Ok(())`，不弹出任何对话框

### Requirement: guest-js checkFullDiskAccessPermission API
`guest-js/index.ts` SHALL 导出 `checkFullDiskAccessPermission(): Promise<boolean>` 函数。

#### Scenario: JS API 调用
- **WHEN** 前端调用 `await checkFullDiskAccessPermission()`
- **THEN** 通过 invoke 调用 Rust command 并返回 `boolean`

### Requirement: guest-js requestFullDiskAccessPermission API
`guest-js/index.ts` SHALL 导出 `requestFullDiskAccessPermission(): Promise<void>` 函数。

#### Scenario: JS API 调用
- **WHEN** 前端调用 `await requestFullDiskAccessPermission()`
- **THEN** 通过 invoke 调用 Rust command 并返回 void
