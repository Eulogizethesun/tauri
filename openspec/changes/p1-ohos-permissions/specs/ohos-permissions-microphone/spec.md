## ADDED Requirements

### Requirement: check_microphone_permission returns boolean
系统 SHALL 提供 `check_microphone_permission` IPC 命令，返回 `bool` 表示 Microphone 权限是否已授权。

OHOS 实现 SHALL 使用 `abilityAccessCtrl.createAtManager().checkAccessToken(tokenId, 'ohos.permission.MICROPHONE')`，将 `GrantStatus.PERMISSION_GRANTED` 映射为 `true`，其他映射为 `false`。

非 OHOS 平台 SHALL 返回 `true`（降级空操作）。

#### Scenario: Microphone 权限已授权
- **WHEN** 用户已授予 `ohos.permission.MICROPHONE` 权限
- **THEN** `check_microphone_permission()` 返回 `true`

#### Scenario: Microphone 权限未授权
- **WHEN** 用户未授予 `ohos.permission.MICROPHONE` 权限（从未申请或被拒绝）
- **THEN** `check_microphone_permission()` 返回 `false`

#### Scenario: 非 OHOS 平台降级
- **WHEN** 在 Windows/macOS/Linux 平台调用 `check_microphone_permission()`
- **THEN** 返回 `true`

### Requirement: request_microphone_permission triggers system dialog
系统 SHALL 提供 `request_microphone_permission` IPC 命令，触发 OHOS 系统权限申请弹窗。

OHOS 实现 SHALL 使用 `atManager.requestPermissionsFromUser(context, ['ohos.permission.MICROPHONE'])`。
- `authResults[0] === 0` → 返回 `Ok(())`
- `authResults[0] !== 0` → 调用 `requestPermissionOnSetting` 引导设置，返回 `Ok(())`

非 OHOS 平台 SHALL 为空操作（返回 `Ok(())`）。

#### Scenario: 用户授权 Microphone
- **WHEN** 调用 `request_microphone_permission()` 且用户在系统弹窗中点击"允许"
- **THEN** 返回 `Ok(())`，后续 `check_microphone_permission()` 返回 `true`

#### Scenario: 用户拒绝 Microphone
- **WHEN** 调用 `request_microphone_permission()` 且用户在系统弹窗中点击"拒绝"
- **THEN** 返回 `Ok(())`，后续 `check_microphone_permission()` 返回 `false`

#### Scenario: 永久拒绝后引导设置
- **WHEN** 用户之前已选择"不再询问"，再次调用 `request_microphone_permission()`
- **THEN** 系统 SHALL 调用 `requestPermissionOnSetting(context, ['ohos.permission.MICROPHONE'])` 引导用户到系统设置，返回 `Ok(())`

### Requirement: module.json5 声明 Microphone 权限
`module.json5` 的 `requestPermissions` SHALL 包含 `ohos.permission.MICROPHONE` 声明，包括 `reason` 和 `usedScene` 字段。

#### Scenario: 权限声明存在
- **WHEN** `tauri ohos init` 生成 `gen/ohos/` 项目后
- **THEN** `entry/src/main/module.json5` 中 `requestPermissions` 包含 `{"name": "ohos.permission.MICROPHONE", "reason": "$string:microphone_reason", "usedScene": {"abilities": ["EntryAbility"], "when": "inuse"}}`

### Requirement: guest-js checkMicrophonePermission API
`guest-js/index.ts` SHALL 导出 `checkMicrophonePermission(): Promise<boolean>` 函数，内部调用 `invoke<boolean>('plugin:ohos-permissions|check_microphone_permission')`。

#### Scenario: JS API 调用
- **WHEN** 前端调用 `await checkMicrophonePermission()`
- **THEN** 通过 invoke 调用 Rust command 并返回 `boolean`

### Requirement: guest-js requestMicrophonePermission API
`guest-js/index.ts` SHALL 导出 `requestMicrophonePermission(): Promise<void>` 函数，内部调用 `invoke('plugin:ohos-permissions|request_microphone_permission')`。

#### Scenario: JS API 调用
- **WHEN** 前端调用 `await requestMicrophonePermission()`
- **THEN** 通过 invoke 触发系统权限弹窗
