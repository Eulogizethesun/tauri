# Phase A3 技术设计

## Context

Bridge 架构迁移已完成 A0（merge）和 A1（补 action）。新 `BridgePlugin` trait 提供了具名契约传输层：`AsyncBridge` 通过 TSFN 异步调用 ArkTS，`MainThreadSyncBridge` 在 N-API 主线程同步调用。每个插件声明 `ID`、`REQUIRED_CONTEXTS`（Ability/WindowStage/UiContext），Rust facade 通过 `BridgeRuntime::call_async::<P, Request, Response>` 发起调用。

三个能力域（global-shortcut、deep-link、autostart）目前仍使用旧架构（全局 TSFN + `get_helper` 直调 + `run_on_main_thread` forwarder）。Phase A3 将它们迁移到 bridge 插件模型。

### Bridge 插件模式参考

以 `plugin-clipboard` 为标准模板：

```
crates/plugin-clipboard/
  Cargo.toml          # 依赖 openharmony-ability + napi-ohos + napi-derive-ohos
  src/lib.rs          # BridgePlugin trait impl + #[napi(object)] types + Client facade
```

Rust facade 核心结构：
```rust
pub struct ClipboardBridgePlugin;

impl BridgePlugin for ClipboardBridgePlugin {
    type Mode = AsyncBridge;
    const ID: &'static str = "ohos.clipboard";
    const REQUIRED_CONTEXTS: &'static [BridgeContextRequirement] =
        &[BridgeContextRequirement::Ability];
}

// Request/Response types
#[napi(object)]
#[derive(Clone, Debug)]
pub struct ClipboardReadTextRequest {}
impl_bridge_napi_type!(ClipboardReadTextRequest, "ohos.clipboard.ReadTextRequest");

// Client facade
pub struct ClipboardClient { bridge: BridgeRuntime }
impl ClipboardClient {
    pub fn new(app: &OpenHarmonyApp) -> Result<Self> { ... }
    pub async fn read_text(&self) -> Result<Option<String>> { ... }
}
```

ArkTS plugin 在 `native_ability/` 的 plugins 目录中实现 `AsyncBridgePlugin` 接口（`type.ets` 中定义），通过 `BridgePluginFactory` 注册到 `NativeAbility.bridgePlugins`。

---

## 1. global-shortcut 插件

### 1.1 Rust facade

**plugin crate**: `plugin-global-shortcut`

**BridgePlugin 声明**:
```rust
pub struct GlobalShortcutBridgePlugin;

impl BridgePlugin for GlobalShortcutBridgePlugin {
    type Mode = AsyncBridge;
    const ID: &'static str = "ohos.global-shortcut";
    const REQUIRED_CONTEXTS: &'static [BridgeContextRequirement] =
        &[BridgeContextRequirement::Ability];
}
```

**选择 Ability 而非 UiContext 的理由**: `inputConsumer` API 是 Ability 级别的能力，不依赖 WindowStage 或 UiContext。快捷键注册在 Ability `onCreate` 后即可生效，无需等待 UI 渲染。

**Actions**:

| Action | Request 类型 | Response 类型 | 说明 |
|--------|-------------|---------------|------|
| `register` | `ShortcutRegisterRequest` | `ShortcutAcknowledgement` | 注册一个全局快捷键 |
| `unregister` | `ShortcutUnregisterRequest` | `ShortcutAcknowledgement` | 注销一个已注册的快捷键 |
| `unregister-all` | `ShortcutUnregisterAllRequest` | `ShortcutAcknowledgement` | 注销所有快捷键 |

**Types**:

```rust
#[napi(object)]
pub struct ShortcutRegisterRequest {
    pub id: u32,
    pub modifiers: Vec<String>,   // ["Control", "Shift", "Alt", "Super"]
    pub key: String,              // "A", "F5", "Space", ...
}
impl_bridge_napi_type!(ShortcutRegisterRequest, "ohos.global-shortcut.RegisterRequest");

#[napi(object)]
pub struct ShortcutUnregisterRequest {
    pub id: u32,
}
impl_bridge_napi_type!(ShortcutUnregisterRequest, "ohos.global-shortcut.UnregisterRequest");

#[napi(object)]
pub struct ShortcutUnregisterAllRequest {}
impl_bridge_napi_type!(ShortcutUnregisterAllRequest, "ohos.global-shortcut.UnregisterAllRequest");

#[napi(object)]
pub struct ShortcutAcknowledgement {
    pub accepted: bool,
}
impl_bridge_napi_type!(ShortcutAcknowledgement, "ohos.global-shortcut.Acknowledgement");
```

**回调事件类型**（ArkTS → Rust 反向推送）:

快捷键触发时，ArkTS plugin 通过 `context.invokeNativeSync` 推送事件到 Rust：

```rust
#[napi(object)]
pub struct ShortcutTriggeredEvent {
    pub id: u32,
    pub state: String,   // "Pressed" | "Released"
}
impl_bridge_napi_type!(ShortcutTriggeredEvent, "ohos.global-shortcut.TriggeredEvent");
```

Rust facade 实现 `on_main_thread_event` 处理 `on-shortcut-triggered` 事件，将事件推入 crossbeam channel 供消费方接收。

**Client facade**:

```rust
pub struct GlobalShortcutClient {
    bridge: BridgeRuntime,
    event_receiver: Receiver<ShortcutTriggeredEvent>,
}

impl GlobalShortcutClient {
    pub fn new(app: &OpenHarmonyApp) -> Result<Self>;
    pub async fn register(&self, id: u32, modifiers: &[String], key: &str) -> Result<()>;
    pub async fn unregister(&self, id: u32) -> Result<()>;
    pub async fn unregister_all(&self) -> Result<()>;
    pub fn event_receiver(&self) -> &Receiver<ShortcutTriggeredEvent>;
}
```

**版本守卫**: `register` action 在 Rust facade 中检查 `version::sdk_api_version() >= 14`，低版本静默返回 `Ok(())`。ArkTS 侧保留 try-catch 处理 error 801（设备不支持）。

### 1.2 ArkTS plugin

**文件**: `native_ability/src/main/ets/plugins/GlobalShortcutPlugin.ets`

**实现**: 继承 `AsyncPluginBase`，实现 `invokeAsync`。

**Key code 映射**: 从旧 `helper/global_shortcut.ets` 搬迁 `KEY_MAP`（60+ 条目）和 `MODIFIER_MAP`（4 条目）。映射逻辑不变，但 **MODIFIER_MAP 的 key 必须更新**：旧实现使用 `"Ctrl"` / `"Meta"`，新设计的 Rust facade 通过 `ShortcutRegisterRequest.modifiers: Vec<String>` 直接传递 modifier 名称字符串，spec 约定的值为 `"Control"` / `"Shift"` / `"Alt"` / `"Super"`（与 Tauri cross-platform Modifier 枚举名一致）。因此 ArkTS MODIFIER_MAP 的 key 必须改为 `"Control"` → 2072、`"Shift"` → 2047、`"Alt"` → 2045、`"Super"` → 2076。KEY_MAP 的 key（`"A"`, `"F5"`, `"Space"` 等）与旧实现一致，无需改动。

**已知限制**: `Home` 键映射为 KeyCode `1`（`KEYCODE_HOME`），这是系统 Home 按钮的键码，不是键盘 Home（光标移至行首）。OHOS 无独立的键盘 Home 键码。此限制从旧实现继承，在迁移时保留并标注注释。

**inputConsumer API 调用**:
- `register` action: 调用 `inputConsumer.on('hotkeyChange', hotkeyOptions, callback)`
- `unregister` action: 调用 `inputConsumer.off('hotkeyChange', options, callback)`
- `unregister-all` action: 遍历已注册快捷键，逐个调用 `off`

**事件回推**: callback 触发时，通过 `context.invokeNativeSync("on-shortcut-triggered", ...)` 推送到 Rust。OHOS `inputConsumer` 只在 key-down 时触发，ArkTS 侧合成 `Released` 事件（与旧实现一致）。

### 1.3 与旧实现的关系

| 旧实现（`crates/ability/src/global_shortcut/`） | 新实现（`plugin-global-shortcut`） | 处置 |
|---|---|---|
| `mod.rs` — forwarder thread + crossbeam channel | 删除 — bridge TSFN 替代 forwarder | A3 完成后标记 deprecated |
| `types.rs` — Key/Modifier/ShortcutEvent 枚举 | 搬迁到 plugin crate，改为 String-based（通过 NAPI 传输） | 搬迁 |
| `event.rs` — `emit_shortcut_event` NAPI + crossbeam channel | 改为 `invokeNativeSync` 反向事件 | 重写 |
| `helper/global_shortcut.ets` — ArkTS key code 映射 + inputConsumer | 搬迁到 `GlobalShortcutPlugin.ets` | 搬迁 |

**关键变化**:
1. 旧实现的 `init_forwarder` + `dispatch_to_main_thread` + `get_helper` + `get_main_thread_env` 全部删除 — bridge TSFN 替代了这一整套 forwarder 机制
2. 旧的 fire-and-forget 语义变为 bridge 的 async 调用（返回 `ShortcutAcknowledgement`），但注册失败（4200002/4200003）仍由 ArkTS 侧 catch 后返回 `accepted: false`
3. Key/Modifier 从 Rust enum 改为 String（通过 NAPI object 的 String 字段传输），因为 bridge 契约使用 `#[napi(object)]` 而非 serde JSON

---

## 2. deep-link 插件

### 2.1 Rust facade

**plugin crate**: `plugin-deep-link`

**BridgePlugin 声明**:
```rust
pub struct DeepLinkBridgePlugin;

impl BridgePlugin for DeepLinkBridgePlugin {
    type Mode = AsyncBridge;
    const ID: &'static str = "ohos.deep-link";
    const REQUIRED_CONTEXTS: &'static [BridgeContextRequirement] =
        &[BridgeContextRequirement::Ability];
}
```

**Actions**:

| Action | Request 类型 | Response 类型 | 说明 |
|--------|-------------|---------------|------|
| `get-initial-uri` | `DeepLinkGetUriRequest` | `DeepLinkGetUriResponse` | 获取冷启动 want.uri |

**Types**:

```rust
#[napi(object)]
pub struct DeepLinkGetUriRequest {}
impl_bridge_napi_type!(DeepLinkGetUriRequest, "ohos.deep-link.GetUriRequest");

#[napi(object)]
pub struct DeepLinkGetUriResponse {
    pub uri: Option<String>,
}
impl_bridge_napi_type!(DeepLinkGetUriResponse, "ohos.deep-link.GetUriResponse");
```

**Client facade**:

```rust
pub struct DeepLinkClient { bridge: BridgeRuntime }

impl DeepLinkClient {
    pub fn new(app: &OpenHarmonyApp) -> Result<Self>;
    pub async fn get_initial_uri(&self) -> Result<Option<String>>;
}
```

### 2.2 ArkTS plugin

**文件**: `native_ability/src/main/ets/plugins/DeepLinkPlugin.ets`

**实现**: 极简 — `get-initial-uri` action 读取 `AppStorage` 中存储的 want.uri（由 `NativeAbility.onCreate` 存入），返回给 Rust。

**无版本守卫**: `want.uri` 是 API 12 原生支持的字段，无需版本检查。

### 2.3 与 app.rs 静态变量的关系

当前存储机制（`app.rs`）:
- `INITIAL_WANT_URI: Mutex<String>` — 冷启动 `onCreate` 时由 `on_ability_create_with_want` NAPI 闭包存入
- `WANT_PARAMETERS: Mutex<String>` — `onNewWant` 时由 `on_new_want` NAPI 闭包存入

**设计决策**: 存储层保留在 core `app.rs`，**不搬迁**。插件只提供读取 facade。

理由：
1. `INITIAL_WANT_URI` / `WANT_PARAMETERS` 的写入时机是 lifecycle NAPI 闭包（`lifecycle.rs`），属于 core 模块职责
2. 插件 facade 调用 `openharmony_ability::take_initial_want_uri()` 读取后通过 bridge 返回给 ArkTS plugin — 但这造成循环（Rust → ArkTS → Rust 读 core 静态变量）

**修正方案**: `get-initial-uri` action 的 ArkTS 实现直接从 `AppStorage` 读取（`NativeAbility.onCreate` 将 `want.uri` 存入 `AppStorage`），不需要经过 Rust core 静态变量。Rust facade 的 `get_initial_uri()` 方法调用 bridge，bridge 在 ArkTS 侧读 `AppStorage.get("wantUri")` 返回。

**存储时机**: `NativeAbility.onCreate` 在每次 Ability 创建时执行（含冷启动），`AppStorage.setOrCreate("wantUri", want.uri ?? '')` 确保每次冷启动的 URI 都被正确存储。旧的 Rust 静态变量 `INITIAL_WANT_URI`（由 `ProcessInitializer` 中的 `onAbilityCreateWithWant` NAPI 闭包写入）仅在进程级初始化时写入一次，不如 AppStorage 路径可靠。新插件不使用 `take_initial_want_uri()`，旧路径保留供 B5 迁移完成后删除。

**`onNewWant` 的 deep-link**: `onNewWant` 的 uri 已通过 `Event::NewWant { uri }` 推送到 Rust event loop。deep-link 插件不处理 `onNewWant` — 消费方（tauri-plugin-deep-link）监听 `Event::NewWant` 获取后续 deep-link。`get-initial-uri` 只负责冷启动场景。冷启动 uri 与 `onNewWant` uri 的分离确保 `get-initial-uri` 始终返回冷启动值，不受后续 `onNewWant` 影响。

---

## 3. autostart 插件

### 3.1 Rust facade

**plugin crate**: `plugin-autostart`

**BridgePlugin 声明**:
```rust
pub struct AutostartBridgePlugin;

impl BridgePlugin for AutostartBridgePlugin {
    type Mode = AsyncBridge;
    const ID: &'static str = "ohos.autostart";
    const REQUIRED_CONTEXTS: &'static [BridgeContextRequirement] =
        &[BridgeContextRequirement::Ability];
}
```

**Actions**:

| Action | Request 类型 | Response 类型 | 说明 |
|--------|-------------|---------------|------|
| `enable` | `AutostartEnableRequest` | `AutostartAcknowledgement` | 跳转到系统设置页 |
| `disable` | `AutostartDisableRequest` | `AutostartAcknowledgement` | 跳转到系统设置页（同 enable） |
| `is-enabled` | `AutostartIsEnabledRequest` | `AutostartIsEnabledResponse` | 查询自启动状态 |

**Types**:

```rust
#[napi(object)]
pub struct AutostartEnableRequest {}
impl_bridge_napi_type!(AutostartEnableRequest, "ohos.autostart.EnableRequest");

#[napi(object)]
pub struct AutostartDisableRequest {}
impl_bridge_napi_type!(AutostartDisableRequest, "ohos.autostart.DisableRequest");

#[napi(object)]
pub struct AutostartIsEnabledRequest {}
impl_bridge_napi_type!(AutostartIsEnabledRequest, "ohos.autostart.IsEnabledRequest");

#[napi(object)]
pub struct AutostartAcknowledgement {
    pub accepted: bool,
}
impl_bridge_napi_type!(AutostartAcknowledgement, "ohos.autostart.Acknowledgement");

#[napi(object)]
pub struct AutostartIsEnabledResponse {
    pub enabled: bool,
}
impl_bridge_napi_type!(AutostartIsEnabledResponse, "ohos.autostart.IsEnabledResponse");
```

**Client facade**:

```rust
pub struct AutostartClient { bridge: BridgeRuntime }

impl AutostartClient {
    pub fn new(app: &OpenHarmonyApp) -> Result<Self>;
    pub async fn enable(&self) -> Result<()>;
    pub async fn disable(&self) -> Result<()>;
    pub async fn is_enabled(&self) -> Result<bool>;
}
```

**版本守卫**: `is_enabled()` 在 Rust facade 中检查 `version::sdk_api_version() >= 21`，低版本返回 `Ok(false)`（强制回退值）。`enable()` / `disable()` 无版本守卫（`startAbility` 跳转设置页在 API 12+ 可用）。

### 3.2 ArkTS plugin (autoStartupManager API 21+)

**文件**: `native_ability/src/main/ets/plugins/AutostartPlugin.ets`

**实现**: 从旧 `helper/autostart.ets` 搬迁逻辑。

- `enable` / `disable`: 调用 `context.abilityContext.startAbility(want)` 跳转到系统设置页（`bundleName: 'com.huawei.hmos.settings'`, `abilityName: 'com.huawei.hmos.settings.MainAbility'`, `uri: 'pc_app_setup_settings'`）。`pc_app_setup_settings` 是 PC/2in1 设备的"应用启动管理"设置页 URI（旧实现已验证）。注意：OHOS 官方文档建议的通用 URI 是 `application_startup_settings`，且需在 `want.parameters.pushParams` 中传入当前应用 bundleName。旧实现使用 `pc_app_setup_settings` 不传 `pushParams`，在 PC 设备上可工作。设备测试时验证此路径是否正确跳转到当前应用的启动管理页，如不正确则改为 `application_startup_settings` + `pushParams`
- `is-enabled`: 调用 `autoStartupManager.getAutoStartupStatusForSelf()`，error 801 返回 `false`

### 3.3 与旧实现的关系

| 旧实现 | 新实现 | 处置 |
|---|---|---|
| `crates/ability/src/autostart.rs` — `AutostartManager` struct + 3 个 TSFN | `plugin-autostart` crate + bridge async call | 重写 |
| `helper/autostart.ets` — `openAutostartSettings` / `getAutostartStatus` | `AutostartPlugin.ets` 的 `invokeAsync` | 搬迁 |
| 3 个全局 TSFN（`AUTOSTART_ENABLE_TSFN` 等） | bridge TSFN 统一传输 | 删除 |

**关键变化**:
1. 旧实现的 3 个独立 TSFN（`get_autostart_enable_tsfn` / `get_autostart_disable_tsfn` / `get_autostart_is_enabled_tsfn`）全部删除 — bridge 的统一 TSFN 替代
2. 旧的 `oneshot::channel` + `handle_void_promise` / `handle_bool_promise` 逻辑删除 — bridge 的 `call_async` 内部处理 Promise → Future
3. 旧的 `tokio::time::timeout` 手动超时删除 — bridge 的 `BridgeCallOptions::timeout_ms` 统一管理
4. 版本守卫位置不变（Rust facade 中 `version::sdk_api_version()` 检查）

---

## 4. 约束遵守

### 4.1 铁律遵守

| 铁律 | 遵守方式 |
|------|---------|
| #1 openharmony-ability 是唯一 ArkTS 桥接仓 | 3 个 plugin crate 都在 openharmony-ability workspace 内，ArkTS plugin 在 native_ability 内 |
| #2 不影响其他平台 | 所有新 crate 的 Cargo.toml 中不带 `cfg(target_env = "ohos")` — plugin crate 只在 OHOS workspace 中编译 |
| #3 OHOS_DEVICE_TYPE 决定设备形态 | global-shortcut 和 autostart 不区分 desktop/mobile；deep-link 不区分 |

### 4.2 Bridge 契约遵守

| 约束 | 遵守方式 |
|------|---------|
| BridgePlugin::ID 唯一 | 3 个 ID: `ohos.global-shortcut`、`ohos.deep-link`、`ohos.autostart` |
| BridgeNapiType 命名契约 | 每个 Request/Response 类型使用 `impl_bridge_napi_type!` 注册稳定 type name |
| REQUIRED_CONTEXTS | 3 个插件都使用 `[Ability]` — 不依赖 WindowStage 或 UiContext |
| AsyncBridge 模式 | 3 个插件都用 AsyncBridge（非 MainThreadSyncBridge）— 调用从 Rust worker 发起 |

### 4.3 版本守卫

| 插件 | API | 最低版本 | 守卫方式 | 降级策略 |
|------|-----|---------|---------|---------|
| global-shortcut | `inputConsumer.on('hotkeyChange')` | API 14 | Rust facade `version::sdk_api_version() >= 14` | 静默跳过，返回 `Ok(())` |
| autostart | `autoStartupManager.getAutoStartupStatusForSelf()` | API 21 | Rust facade `version::sdk_api_version() >= 21` | 返回 `Ok(false)` |
| deep-link | `want.uri` | API 12 | 无需守卫 | N/A |

### 4.4 旧代码迁移策略

- **A3 阶段**: 新建 3 个 plugin crate，旧代码标记 `#[deprecated]` 但保留编译
- **B5 阶段**: 消费方（tauri-plugin-global-shortcut 等）切换到新 facade
- **B5 完成后**: 删除旧代码（`crates/ability/src/global_shortcut/`、`crates/ability/src/autostart.rs`、`helper/global_shortcut.ets`、`helper/autostart.ets`）

### 4.5 测试策略

| 插件 | 单测内容 | 设备测试 |
|------|---------|---------|
| global-shortcut | key code 映射、modifier 验证、版本守卫逻辑 | 注册快捷键 → 按键 → 验证回调触发 |
| deep-link | bridge 契约类型名验证、空 uri 处理 | 冷启动带 uri → 验证 `get_initial_uri()` 返回值 |
| autostart | 版本守卫逻辑、acknowledgement 解析 | `is_enabled()` 返回值、`enable()` 跳转设置页 |

### 4.6 global-shortcut 反向事件设计

旧实现使用 NAPI 散函数 `emit_shortcut_event` + crossbeam channel。新实现使用 bridge 的 `invokeNativeSync` 反向事件。

**ArkTS 侧**: callback 触发时调用 `this.getContext().invokeNativeSync("on-shortcut-triggered", "ohos.global-shortcut.TriggeredEvent", "std.bool", eventObj)`。注意此处 `context` 是 `PluginBase.attachContext()` 注入的 session 级 `BridgePluginContext`（通过 `this.getContext()` 获取），**不是** `invokeAsync` 传入的 `BridgeCallContext`。因为 `inputConsumer.on('hotkeyChange')` 的 callback 在 `invokeAsync` 作用域之外异步触发，必须使用持久化的 session context。`BridgePluginContext.invokeNativeSync` 签名为 `(event, requestTypeName, responseTypeName, value) => ESObject`，`pluginId` 已由 `BridgeHost` 在创建 context 时绑定，不需要额外传递。

**Rust 侧**: `GlobalShortcutBridgePlugin` 实现 `on_main_thread_event`，匹配 `"on-shortcut-triggered"` 事件名，解码 `ShortcutTriggeredEvent`，推入 crossbeam channel，并通过 `event.respond(true)` 返回 `bool` 响应（`"std.bool"` 类型）。

**`required_contexts_for_main_thread_event`**: 默认实现返回 `Self::REQUIRED_CONTEXTS`（即 `[Ability]`），`on-shortcut-triggered` 事件不需要覆盖此方法。`invokeNativeSync` 需要 `Ability` context ready（由 BridgeHost 保证），不需要 UiContext。这与 `REQUIRED_CONTEXTS = [Ability]` 一致。
