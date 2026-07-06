## ADDED Requirements

### Requirement: check_camera_permission returns boolean
系统 SHALL 提供 `check_camera_permission` IPC 命令，返回 `bool` 表示 Camera 权限是否已授权。

OHOS 实现 SHALL 使用 `abilityAccessCtrl.createAtManager().checkAccessToken(tokenId, 'ohos.permission.CAMERA')`，将 `GrantStatus.PERMISSION_GRANTED` 映射为 `true`，其他映射为 `false`。

非 OHOS 平台 SHALL 返回 `true`（降级空操作）。

#### Scenario: Camera 权限已授权
- **WHEN** 用户已授予 `ohos.permission.CAMERA` 权限
- **THEN** `check_camera_permission()` 返回 `true`

#### Scenario: Camera 权限未授权
- **WHEN** 用户未授予 `ohos.permission.CAMERA` 权限（从未申请或被拒绝）
- **THEN** `check_camera_permission()` 返回 `false`

#### Scenario: 非 OHOS 平台降级
- **WHEN** 在 Windows/macOS/Linux 平台调用 `check_camera_permission()`
- **THEN** 返回 `true`

### Requirement: request_camera_permission triggers system dialog
系统 SHALL 提供 `request_camera_permission` IPC 命令，触发 OHOS 系统权限申请弹窗。

OHOS 实现 SHALL 使用 `atManager.requestPermissionsFromUser(context, ['ohos.permission.CAMERA'])`。
- `authResults[0] === 0` → 返回 `Ok(())`
- `authResults[0] !== 0` → 调用 `requestPermissionOnSetting` 引导设置，返回 `Ok(())`（不返回错误，因为用户拒绝不是系统错误）

非 OHOS 平台 SHALL 为空操作（返回 `Ok(())`）。

#### Scenario: 用户授权 Camera
- **WHEN** 调用 `request_camera_permission()` 且用户在系统弹窗中点击"允许"
- **THEN** 返回 `Ok(())`，后续 `check_camera_permission()` 返回 `true`

#### Scenario: 用户拒绝 Camera
- **WHEN** 调用 `request_camera_permission()` 且用户在系统弹窗中点击"拒绝"
- **THEN** 返回 `Ok(())`，后续 `check_camera_permission()` 返回 `false`

#### Scenario: 永久拒绝后引导设置
- **WHEN** 用户之前已选择"不再询问"，再次调用 `request_camera_permission()`
- **THEN** 系统 SHALL 调用 `requestPermissionOnSetting(context, ['ohos.permission.CAMERA'])` 引导用户到系统设置，返回 `Ok(())`

### Requirement: module.json5 声明 Camera 权限
`module.json5` 的 `requestPermissions` SHALL 包含 `ohos.permission.CAMERA` 声明，包括 `reason` 和 `usedScene` 字段。

#### Scenario: 权限声明存在
- **WHEN** `tauri ohos init` 生成 `gen/ohos/` 项目后
- **THEN** `entry/src/main/module.json5` 中 `requestPermissions` 包含 `{"name": "ohos.permission.CAMERA", "reason": "$string:camera_reason", "usedScene": {"abilities": ["EntryAbility"], "when": "inuse"}}`

### Requirement: guest-js checkCameraPermission API
`guest-js/index.ts` SHALL 导出 `checkCameraPermission(): Promise<boolean>` 函数，内部调用 `invoke<boolean>('plugin:ohos-permissions|check_camera_permission')`。

#### Scenario: JS API 调用
- **WHEN** 前端调用 `await checkCameraPermission()`
- **THEN** 通过 invoke 调用 Rust command 并返回 `boolean`

### Requirement: guest-js requestCameraPermission API
`guest-js/index.ts` SHALL 导出 `requestCameraPermission(): Promise<void>` 函数，内部调用 `invoke('plugin:ohos-permissions|request_camera_permission')`。

#### Scenario: JS API 调用
- **WHEN** 前端调用 `await requestCameraPermission()`
- **THEN** 通过 invoke 触发系统权限弹窗
