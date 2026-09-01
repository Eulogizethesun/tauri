## ADDED Requirements

### Requirement: deep-link plugin crate 声明 BridgePlugin 契约
`plugin-deep-link` crate SHALL 声明 `DeepLinkBridgePlugin` 实现 `BridgePlugin` trait，`ID = "ohos.deep-link"`，`Mode = AsyncBridge`，`REQUIRED_CONTEXTS = [Ability]`。

#### Scenario: 插件 ID 唯一且稳定
- **WHEN** Rust registry 注册 `DeepLinkBridgePlugin`
- **THEN** `DeepLinkBridgePlugin::ID` SHALL 等于 `"ohos.deep-link"`
- **AND** 不会与其他 BridgePlugin ID 冲突

#### Scenario: 上下文要求为 Ability
- **WHEN** BridgeHost 检查 `DeepLinkBridgePlugin` 的 `REQUIRED_CONTEXTS`
- **THEN** SHALL 返回 `&[BridgeContextRequirement::Ability]`

### Requirement: get-initial-uri action 读取冷启动 want.uri
`get-initial-uri` action SHALL 接收空 `DeepLinkGetUriRequest`，返回 `DeepLinkGetUriResponse`（含 `uri: Option<String>`）。ArkTS 侧 SHALL 从 `AppStorage` 读取冷启动 `want.uri`。

#### Scenario: 冷启动携带 uri
- **WHEN** 应用通过 deep-link `tauri://app/page` 冷启动
- **AND** `NativeAbility.onCreate` 将 `want.uri` 存入 `AppStorage`
- **AND** Rust 调用 `get-initial-uri` action
- **THEN** ArkTS plugin SHALL 从 `AppStorage.get("wantUri")` 读取 uri
- **AND** 返回 `{ uri: "tauri://app/page" }`

#### Scenario: 冷启动无 uri
- **WHEN** 应用正常启动（无 deep-link）
- **AND** `want.uri` 为 undefined 或空字符串
- **THEN** ArkTS plugin SHALL 返回 `{ uri: null }`

#### Scenario: uri 读取后不清空
- **WHEN** 多次调用 `get-initial-uri`
- **THEN** 每次都 SHALL 返回相同的 uri（如果存在）
- **AND** 不会因为前一次读取而返回 null

### Requirement: onNewWant 的 deep-link 不通过此插件处理
`onNewWant` 触发的后续 deep-link SHALL 通过 `Event::NewWant { uri }` 推送到 Rust event loop，不通过 `get-initial-uri` action 处理。`get-initial-uri` 只负责冷启动场景。

#### Scenario: 冷启动与 onNewWant 分离
- **WHEN** 应用冷启动带 uri `"tauri://cold"` 后，`onNewWant` 携带 uri `"tauri://warm"`
- **THEN** `get-initial-uri` SHALL 返回 `"tauri://cold"`（冷启动 uri）
- **AND** `"tauri://warm"` 通过 `Event::NewWant { uri: "tauri://warm" }` 推送到 event loop

### Requirement: 无版本守卫
`get-initial-uri` action SHALL 不需要版本守卫。`want.uri` 是 API 12 原生支持的字段。

#### Scenario: API 12 设备正常工作
- **WHEN** 设备 API 版本为 12
- **AND** 应用通过 deep-link 冷启动
- **THEN** `get-initial-uri` SHALL 正常返回 uri，不报错

### Requirement: BridgeNapiType 稳定命名契约
所有 Request/Response 类型 SHALL 通过 `impl_bridge_napi_type!` 注册稳定 type name。

#### Scenario: 类型名验证
- **WHEN** 检查 `DeepLinkGetUriRequest` 的 TYPE_NAME
- **THEN** SHALL 等于 `"ohos.deep-link.GetUriRequest"`
- **AND** `DeepLinkGetUriResponse` 的 TYPE_NAME SHALL 等于 `"ohos.deep-link.GetUriResponse"`

### Requirement: DeepLinkClient facade 提供异步 API
`DeepLinkClient` SHALL 提供 `get_initial_uri` 异步方法。

#### Scenario: 通过 OpenHarmonyApp 获取 client
- **WHEN** 调用 `app.deep_link()`
- **THEN** SHALL 返回 `DeepLinkClient` 实例
- **AND** client 内部持有 `BridgeRuntime`

#### Scenario: get_initial_uri 调用 bridge
- **WHEN** 调用 `client.get_initial_uri().await`
- **THEN** SHALL 通过 `bridge.call_async::<DeepLinkBridgePlugin, _, _>("get-initial-uri", request, options)` 发起调用
- **AND** 返回 `Ok(Some(uri))` 当 uri 非空
- **AND** 返回 `Ok(None)` 当 uri 为空或 null

### Requirement: NativeAbility.onCreate 存储 want.uri 到 AppStorage
`NativeAbility.onCreate` SHALL 将 `want.uri` 存入 `AppStorage.setOrCreate("wantUri", want.uri ?? '')`，供 deep-link plugin 读取。

#### Scenario: 冷启动存储 uri
- **WHEN** `NativeAbility.onCreate(want)` 被调用
- **AND** `want.uri` 为 `"tauri://app/page"`
- **THEN** SHALL 调用 `AppStorage.setOrCreate("wantUri", "tauri://app/page")`

#### Scenario: 冷启动无 uri 存储空字符串
- **WHEN** `NativeAbility.onCreate(want)` 被调用
- **AND** `want.uri` 为 undefined
- **THEN** SHALL 调用 `AppStorage.setOrCreate("wantUri", '')`
