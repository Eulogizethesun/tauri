## ADDED Requirements

### Requirement: autostart plugin crate 声明 BridgePlugin 契约
`plugin-autostart` crate SHALL 声明 `AutostartBridgePlugin` 实现 `BridgePlugin` trait，`ID = "ohos.autostart"`，`Mode = AsyncBridge`，`REQUIRED_CONTEXTS = [Ability]`。

#### Scenario: 插件 ID 唯一且稳定
- **WHEN** Rust registry 注册 `AutostartBridgePlugin`
- **THEN** `AutostartBridgePlugin::ID` SHALL 等于 `"ohos.autostart"`
- **AND** 不会与其他 BridgePlugin ID 冲突

#### Scenario: 上下文要求为 Ability
- **WHEN** BridgeHost 检查 `AutostartBridgePlugin` 的 `REQUIRED_CONTEXTS`
- **THEN** SHALL 返回 `&[BridgeContextRequirement::Ability]`

### Requirement: enable action 跳转系统设置页
`enable` action SHALL 接收空 `AutostartEnableRequest`，返回 `AutostartAcknowledgement`。ArkTS 侧 SHALL 调用 `context.abilityContext.startAbility(want)` 跳转到系统"应用启动管理"设置页。

#### Scenario: 正常跳转设置页
- **WHEN** Rust 调用 `enable` action
- **THEN** ArkTS 侧 SHALL 构造 `Want { bundleName: 'com.huawei.hmos.settings', abilityName: 'com.huawei.hmos.settings.MainAbility', uri: 'pc_app_setup_settings' }`
- **AND** 调用 `context.abilityContext.startAbility(want)`
- **AND** 返回 `{ accepted: true }`

#### Scenario: startAbility 失败
- **WHEN** `startAbility` 抛出异常
- **THEN** ArkTS 侧 SHALL catch 错误
- **AND** 返回 `{ accepted: false }`

### Requirement: disable action 跳转系统设置页
`disable` action SHALL 与 `enable` 行为一致 — 都跳转到同一个系统设置页。OHOS 不允许普通应用程序化关闭自启动，方法名反映用户意图而非保证结果。

#### Scenario: disable 与 enable 跳转相同页面
- **WHEN** Rust 调用 `disable` action
- **THEN** ArkTS 侧 SHALL 构造与 `enable` 相同的 `Want`
- **AND** 调用 `startAbility(want)`
- **AND** 返回 `{ accepted: true }`

### Requirement: is-enabled action 查询自启动状态
`is-enabled` action SHALL 接收空 `AutostartIsEnabledRequest`，返回 `AutostartIsEnabledResponse`（含 `enabled: bool`）。ArkTS 侧 SHALL 调用 `autoStartupManager.getAutoStartupStatusForSelf()`。

#### Scenario: API 21+ 查询成功
- **WHEN** 设备 API 版本 >= 21
- **AND** `autoStartupManager.getAutoStartupStatusForSelf()` 返回 `true`
- **THEN** SHALL 返回 `{ enabled: true }`

#### Scenario: API 21+ 查询返回 false
- **WHEN** 设备 API 版本 >= 21
- **AND** `autoStartupManager.getAutoStartupStatusForSelf()` 返回 `false`
- **THEN** SHALL 返回 `{ enabled: false }`

#### Scenario: 设备不支持 autoStartupManager
- **WHEN** `getAutoStartupStatusForSelf()` 抛出 error 801（设备不支持）
- **THEN** ArkTS 侧 SHALL catch 错误
- **AND** 返回 `{ enabled: false }`

#### Scenario: API 21 以下版本强制回退
- **WHEN** `version::sdk_api_version() < 21`
- **THEN** Rust facade SHALL 不发起 bridge 调用
- **AND** 返回 `Ok(false)`

### Requirement: 无版本守卫的 enable/disable
`enable` 和 `disable` action SHALL 不需要 API 版本守卫。`startAbility` 跳转设置页在 API 12+ 可用。

#### Scenario: API 12 设备正常跳转设置页
- **WHEN** 设备 API 版本为 12
- **AND** Rust 调用 `enable` action
- **THEN** SHALL 正常发起 bridge 调用
- **AND** ArkTS 侧正常跳转设置页

### Requirement: BridgeNapiType 稳定命名契约
所有 Request/Response 类型 SHALL 通过 `impl_bridge_napi_type!` 注册稳定 type name。

#### Scenario: 类型名验证
- **WHEN** 检查 `AutostartEnableRequest` 的 TYPE_NAME
- **THEN** SHALL 等于 `"ohos.autostart.EnableRequest"`
- **AND** `AutostartAcknowledgement` 的 TYPE_NAME SHALL 等于 `"ohos.autostart.Acknowledgement"`
- **AND** `AutostartIsEnabledResponse` 的 TYPE_NAME SHALL 等于 `"ohos.autostart.IsEnabledResponse"`

### Requirement: AutostartClient facade 提供异步 API
`AutostartClient` SHALL 提供 `enable`、`disable`、`is_enabled` 异步方法。

#### Scenario: 通过 OpenHarmonyApp 获取 client
- **WHEN** 调用 `app.autostart()`
- **THEN** SHALL 返回 `AutostartClient` 实例
- **AND** client 内部持有 `BridgeRuntime`

#### Scenario: enable 调用 bridge
- **WHEN** 调用 `client.enable().await`
- **THEN** SHALL 通过 `bridge.call_async::<AutostartBridgePlugin, _, _>("enable", request, options)` 发起调用
- **AND** 返回 `Ok(())` 当 `accepted == true`

#### Scenario: is_enabled 调用 bridge
- **WHEN** 调用 `client.is_enabled().await`
- **AND** 设备 API >= 21
- **THEN** SHALL 通过 bridge 调用 `is-enabled` action
- **AND** 返回 `Ok(bool)` 值

#### Scenario: is_enabled 版本守卫短路
- **WHEN** 调用 `client.is_enabled().await`
- **AND** 设备 API < 21
- **THEN** SHALL 不发起 bridge 调用
- **AND** 直接返回 `Ok(false)`
