## ADDED Requirements

### Requirement: global-shortcut plugin crate 声明 BridgePlugin 契约
`plugin-global-shortcut` crate SHALL 声明 `GlobalShortcutBridgePlugin` 实现 `BridgePlugin` trait，`ID = "ohos.global-shortcut"`，`Mode = AsyncBridge`，`REQUIRED_CONTEXTS = [Ability]`。

#### Scenario: 插件 ID 唯一且稳定
- **WHEN** Rust registry 注册 `GlobalShortcutBridgePlugin`
- **THEN** `GlobalShortcutBridgePlugin::ID` SHALL 等于 `"ohos.global-shortcut"`
- **AND** 不会与其他 BridgePlugin ID 冲突

#### Scenario: 上下文要求为 Ability
- **WHEN** BridgeHost 检查 `GlobalShortcutBridgePlugin` 的 `REQUIRED_CONTEXTS`
- **THEN** SHALL 返回 `&[BridgeContextRequirement::Ability]`
- **AND** 不包含 `WindowStage` 或 `UiContext`

### Requirement: register action 注册全局快捷键
`register` action SHALL 接收 `ShortcutRegisterRequest`（含 `id: u32`、`modifiers: Vec<String>`、`key: String`），返回 `ShortcutAcknowledgement`。ArkTS 侧 SHALL 调用 `inputConsumer.on('hotkeyChange', hotkeyOptions, callback)` 注册快捷键。modifier 字符串值 SHALL 为 `"Control"` / `"Shift"` / `"Alt"` / `"Super"`（与 Tauri cross-platform Modifier 枚举名一致），ArkTS MODIFIER_MAP 的 key SHALL 使用这 4 个名称。

#### Scenario: 正常注册 Ctrl+A
- **WHEN** Rust 调用 `register` action，request 为 `{ id: 1, modifiers: ["Control"], key: "A" }`
- **THEN** ArkTS 侧 SHALL 构造 `HotkeyOptions { preKeys: [2072], finalKey: 2017, isRepeat: false }`
- **AND** 调用 `inputConsumer.on('hotkeyChange', hotkeyOptions, callback)`
- **AND** 返回 `{ accepted: true }`

#### Scenario: 注册带 2 个 modifier 的快捷键
- **WHEN** request 为 `{ id: 2, modifiers: ["Control", "Shift"], key: "T" }`
- **THEN** ArkTS 侧 SHALL 构造 `preKeys: [2072, 2047]`，`finalKey: 2036`

#### Scenario: 快捷键被系统占用
- **WHEN** `inputConsumer.on` 抛出 error 4200002（系统占用）
- **THEN** ArkTS 侧 SHALL catch 错误，返回 `{ accepted: false }`
- **AND** 不抛出异常

#### Scenario: 快捷键已被其他应用注册
- **WHEN** `inputConsumer.on` 抛出 error 4200003（其他应用占用）
- **THEN** ArkTS 侧 SHALL catch 错误，返回 `{ accepted: false }`

#### Scenario: 设备不支持 inputConsumer
- **WHEN** `inputConsumer.on` 抛出 error 801（设备不支持 inputConsumer 能力）
- **THEN** ArkTS 侧 SHALL catch 错误，返回 `{ accepted: false }`
- **AND** 不抛出异常

#### Scenario: API 14 以下版本静默跳过
- **WHEN** `version::sdk_api_version() < 14`
- **THEN** Rust facade SHALL 不发起 bridge 调用
- **AND** 返回 `Ok(())`

### Requirement: modifier 数量限制
`register` action SHALL 限制 modifier 数量最多 2 个（OHOS `inputConsumer.preKeys` 限制）。modifier 数量为 0 时 SHALL 返回错误。连续重复的 modifier SHALL 被去重（如 `["Control", "Control"]` → `["Control"]`），与旧实现一致。

#### Scenario: 0 个 modifier 报错
- **WHEN** request `modifiers` 为空数组
- **THEN** Rust facade SHALL 返回错误 "At least 1 modifier key is required"

#### Scenario: 超过 2 个 modifier 报错
- **WHEN** request `modifiers` 包含 3 个元素
- **THEN** Rust facade SHALL 返回错误 "OHOS supports at most 2 modifier keys"

### Requirement: unregister action 注销快捷键
`unregister` action SHALL 接收 `ShortcutUnregisterRequest`（含 `id: u32`），返回 `ShortcutAcknowledgement`。ArkTS 侧 SHALL 调用 `inputConsumer.off('hotkeyChange', options, callback)`。

#### Scenario: 注销已注册的快捷键
- **WHEN** Rust 调用 `unregister` action，request 为 `{ id: 1 }`
- **AND** id=1 已通过 `register` 注册
- **THEN** ArkTS 侧 SHALL 从 `registeredHotkeys` Map 中取出对应的 options 和 callback
- **AND** 调用 `inputConsumer.off('hotkeyChange', options, callback)`
- **AND** 返回 `{ accepted: true }`

#### Scenario: 注销未注册的快捷键
- **WHEN** Rust 调用 `unregister` action，request 为 `{ id: 999 }`
- **AND** id=999 未注册
- **THEN** ArkTS 侧 SHALL 跳过 `inputConsumer.off` 调用
- **AND** 返回 `{ accepted: true }`（幂等）

### Requirement: unregister-all action 注销所有快捷键
`unregister-all` action SHALL 接收空 request，返回 `ShortcutAcknowledgement`。ArkTS 侧 SHALL 遍历所有已注册快捷键，逐个调用 `inputConsumer.off`。

#### Scenario: 注销多个快捷键
- **WHEN** 已注册 3 个快捷键（id=1,2,3）
- **AND** Rust 调用 `unregister-all` action
- **THEN** ArkTS 侧 SHALL 对每个快捷键调用 `inputConsumer.off`
- **AND** 清空 `registeredHotkeys` Map
- **AND** 返回 `{ accepted: true }`

### Requirement: 快捷键触发反向事件
快捷键触发时，ArkTS plugin SHALL 通过 `context.invokeNativeSync("on-shortcut-triggered", ...)` 推送 `ShortcutTriggeredEvent` 到 Rust。事件包含 `id: u32` 和 `state: String`。

#### Scenario: 按键按下事件
- **WHEN** OHOS `inputConsumer` 触发 hotkeyChange callback
- **THEN** ArkTS plugin SHALL 调用 `invokeNativeSync("on-shortcut-triggered", "ohos.global-shortcut.TriggeredEvent", "std.bool", { id, state: "Pressed" })`

#### Scenario: 合成 Released 事件
- **WHEN** OHOS `inputConsumer` 触发 hotkeyChange callback（仅 key-down）
- **THEN** ArkTS plugin SHALL 在 Pressed 之后立即合成 Released 事件
- **AND** 调用 `invokeNativeSync` 推送 `{ id, state: "Released" }`

### Requirement: Rust facade 处理反向事件并推入 channel
`GlobalShortcutBridgePlugin` SHALL 实现 `on_main_thread_event`，匹配 `"on-shortcut-triggered"` 事件名，解码 `ShortcutTriggeredEvent`，推入 crossbeam channel 供消费方接收。

#### Scenario: 事件解码并推入 channel
- **WHEN** ArkTS 通过 `invokeNativeSync` 推送 `ShortcutTriggeredEvent { id: 1, state: "Pressed" }`
- **THEN** Rust `on_main_thread_event` SHALL 解码事件
- **AND** 推入 crossbeam channel
- **AND** 消费方通过 `event_receiver()` 接收到该事件

### Requirement: key code 映射表覆盖 60+ 按键
ArkTS plugin SHALL 维护 key code 映射表，将 Tauri key name 字符串映射为 OHOS KeyCode 常量。映射表 SHALL 覆盖字母 A-Z（26）、数字 0-9（10）、功能键 F1-F24（24）、特殊键（Space/Enter/Escape/Tab/Backspace/Delete/Insert/Home/End/PageUp/PageDown/ArrowUp/ArrowDown/ArrowLeft/ArrowRight）（16）。

#### Scenario: 字母映射
- **WHEN** key name 为 `"A"`
- **THEN** SHALL 映射为 KeyCode `2017`

#### Scenario: 功能键映射
- **WHEN** key name 为 `"F5"`
- **THEN** SHALL 映射为 KeyCode `2094`

#### Scenario: 未知 key name
- **WHEN** key name 不在映射表中
- **THEN** SHALL 返回 `{ accepted: false }`

### Requirement: GlobalShortcutClient facade 提供异步 API
`GlobalShortcutClient` SHALL 提供 `register`、`unregister`、`unregister_all` 异步方法和 `event_receiver` 方法。

#### Scenario: 通过 OpenHarmonyApp 获取 client
- **WHEN** 调用 `app.global_shortcut()`
- **THEN** SHALL 返回 `GlobalShortcutClient` 实例
- **AND** client 内部持有 `BridgeRuntime`

#### Scenario: register 调用 bridge
- **WHEN** 调用 `client.register(1, &["Control"], "A").await`
- **THEN** SHALL 通过 `bridge.call_async::<GlobalShortcutBridgePlugin, _, _>("register", request, options)` 发起调用
- **AND** 返回 `Ok(())` 当 `accepted == true`

### Requirement: BridgeNapiType 稳定命名契约
所有 Request/Response 类型 SHALL 通过 `impl_bridge_napi_type!` 注册稳定 type name。

#### Scenario: 类型名验证
- **WHEN** 检查 `ShortcutRegisterRequest` 的 TYPE_NAME
- **THEN** SHALL 等于 `"ohos.global-shortcut.RegisterRequest"`
- **AND** `ShortcutAcknowledgement` 的 TYPE_NAME SHALL 等于 `"ohos.global-shortcut.Acknowledgement"`
- **AND** `ShortcutTriggeredEvent` 的 TYPE_NAME SHALL 等于 `"ohos.global-shortcut.TriggeredEvent"`
