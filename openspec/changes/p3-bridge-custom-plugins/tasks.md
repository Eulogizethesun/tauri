# Phase A3 实现任务清单

## 1. global-shortcut 插件

### 1.1 Rust facade crate
- [x] 1.1.1 创建 `crates/plugin-global-shortcut/` 目录结构（Cargo.toml + src/lib.rs）
- [x] 1.1.2 在 workspace Cargo.toml 添加 `plugin-global-shortcut` 成员
- [x] 1.1.3 声明 `GlobalShortcutBridgePlugin`（ID=`ohos.global-shortcut`, AsyncBridge, REQUIRED_CONTEXTS=[Ability]）
- [x] 1.1.4 定义 `ShortcutRegisterRequest` / `ShortcutUnregisterRequest` / `ShortcutUnregisterAllRequest` / `ShortcutAcknowledgement` NAPI types + `impl_bridge_napi_type!`
- [x] 1.1.5 定义 `ShortcutTriggeredEvent` NAPI type + `impl_bridge_napi_type!`（反向事件）
- [x] 1.1.6 Rust facade 不包含 key code 映射逻辑 — 映射完全在 ArkTS 侧（GlobalShortcutPlugin.ets 的 MODIFIER_MAP / KEY_MAP）。Rust facade 只做 modifier 数量验证和版本守卫，key name 有效性由 ArkTS 侧返回 `accepted: false` 处理
- [x] 1.1.7 实现 `on_main_thread_event` 处理 `"on-shortcut-triggered"` 事件，解码并推入 crossbeam channel
- [x] 1.1.8 实现 `GlobalShortcutClient` facade（register/unregister/unregister_all/event_receiver）
- [x] 1.1.9 添加版本守卫：`register` 在 API < 14 时静默返回 `Ok(())`
- [x] 1.1.10 添加 modifier 验证（至少 1 个、最多 2 个）
- [x] 1.1.11 实现 `GlobalShortcutExt` trait（`app.global_shortcut()` 扩展方法）
- [x] 1.1.12 编写单测：key code 映射、modifier 验证、版本守卫逻辑、bridge 契约类型名验证

### 1.2 ArkTS plugin
- [x] 1.2.1 创建 `plugins/global-shortcut/src/main/ets/GlobalShortcutPlugin.ets`
- [x] 1.2.2 继承 `AsyncPluginBase`，声明 `id = "ohos.global-shortcut"`, `requires = ["ability"]`
- [x] 1.2.3 从旧 `helper/global_shortcut.ets` 搬迁 `KEY_MAP`（60+ 条目，key 不变）和 `MODIFIER_MAP`（4 条目，**key 已更新**：`"Ctrl"`→`"Control"`、`"Meta"`→`"Super"`，与 Rust facade 的 modifier 字符串值一致）
- [x] 1.2.4 实现 `invokeAsync` 的 `register` action：构造 `HotkeyOptions`，调用 `inputConsumer.on('hotkeyChange', ...)`，catch 4200002/4200003/801 返回 `accepted: false`
- [x] 1.2.5 实现 `invokeAsync` 的 `unregister` action：从 `registeredHotkeys` Map 取出 options+callback，调用 `inputConsumer.off`
- [x] 1.2.6 实现 `invokeAsync` 的 `unregister-all` action：遍历 Map 逐个 `off`
- [x] 1.2.7 实现 callback：通过 `context.invokeNativeSync("on-shortcut-triggered", ...)` 推送 Pressed + Released 事件
- [x] 1.2.8 实现 `onDispose`：注销所有已注册快捷键

### 1.3 注册与集成
- [x] 1.3.1 在 `EntryAbility.bridgePlugins` 数组中添加 `GlobalShortcutPlugin` factory
- [x] 1.3.2 在 `#[ability]` 初始化代码中注册 `GlobalShortcutBridgePlugin` 到 bridge registry

---

## 2. deep-link 插件

### 2.1 Rust facade crate
- [x] 2.1.1 创建 `crates/plugin-deep-link/` 目录结构（Cargo.toml + src/lib.rs）
- [x] 2.1.2 在 workspace Cargo.toml 添加 `plugin-deep-link` 成员
- [x] 2.1.3 声明 `DeepLinkBridgePlugin`（ID=`ohos.deep-link`, AsyncBridge, REQUIRED_CONTEXTS=[Ability]）
- [x] 2.1.4 定义 `DeepLinkGetUriRequest` / `DeepLinkGetUriResponse` NAPI types + `impl_bridge_napi_type!`
- [x] 2.1.5 实现 `DeepLinkClient` facade（get_initial_uri, get_latest_uri）
- [x] 2.1.6 实现 `DeepLinkExt` trait（`app.deep_link()` 扩展方法）
- [x] 2.1.7 编写单测：bridge 契约类型名验证、空 uri 处理逻辑

### 2.2 ArkTS plugin
- [x] 2.2.1 创建 `plugins/deep-link/src/main/ets/DeepLinkPlugin.ets`
- [x] 2.2.2 继承 `AsyncPluginBase`，声明 `id = "ohos.deep-link"`, `requires = ["ability"]`
- [x] 2.2.3 实现 `invokeAsync` 的 `get-initial-uri` action：从 `AppStorage.get("initialWantUri")` 读取，返回 `{ uri: string | null }`
- [x] 2.2.4 实现 `invokeAsync` 的 `get-latest-uri` action：从 `AppStorage.get("wantUri")` 读取

### 2.3 NativeAbility 适配
- [x] 2.3.1 在 `NativeAbility.onCreate` 中添加 `AppStorage.setOrCreate("initialWantUri", want.uri ?? '')` 和 `AppStorage.setOrCreate("wantUri", want.uri ?? '')`
- [x] 2.3.2 在 `NativeAbility.onNewWant` 中添加 `AppStorage.set("wantUri", want.uri ?? '')`（不更新 `initialWantUri`）
- [x] 2.3.3 在 `EntryAbility.bridgePlugins` 数组中添加 `DeepLinkPlugin` factory
- [x] 2.3.4 在 `#[ability]` 初始化代码中注册 `DeepLinkBridgePlugin` 到 bridge registry
- [x] 2.3.5 在 `demo/entry/oh-package.json5` 中添加 `@ohos-rs/ability-plugin-deep-link` 依赖

---

## 3. autostart 插件

### 3.1 Rust facade crate
- [x] 3.1.1 创建 `crates/plugin-autostart/` 目录结构（Cargo.toml + src/lib.rs）
- [x] 3.1.2 在 workspace Cargo.toml 添加 `plugin-autostart` 成员
- [x] 3.1.3 声明 `AutostartBridgePlugin`（ID=`ohos.autostart`, AsyncBridge, REQUIRED_CONTEXTS=[Ability]）
- [x] 3.1.4 定义 `AutostartEnableRequest` / `AutostartDisableRequest` / `AutostartIsEnabledRequest` / `AutostartAcknowledgement` / `AutostartIsEnabledResponse` NAPI types + `impl_bridge_napi_type!`
- [x] 3.1.5 实现 `AutostartClient` facade（enable/disable/is_enabled）
- [x] 3.1.6 添加版本守卫：`is_enabled` 在 API < 21 时返回 `Ok(false)`
- [x] 3.1.7 实现 `AutostartExt` trait（`app.autostart()` 扩展方法）
- [x] 3.1.8 编写单测：版本守卫逻辑、acknowledgement 解析、bridge 契约类型名验证

### 3.2 ArkTS plugin
- [x] 3.2.1 创建 `plugins/autostart/src/main/ets/AutostartPlugin.ets`
- [x] 3.2.2 继承 `AsyncPluginBase`，声明 `id = "ohos.autostart"`, `requires = ["ability"]`
- [x] 3.2.3 从旧 `helper/autostart.ets` 搬迁 `openAutostartSettings` 逻辑到 `enable` / `disable` action
- [x] 3.2.4 从旧 `helper/autostart.ets` 搬迁 `getAutostartStatus` 逻辑到 `is-enabled` action
- [x] 3.2.5 `enable`/`disable` action：调用 `context.abilityContext.startAbility(want)` 跳转设置页，catch 错误返回 `accepted: false`
- [x] 3.2.6 `is-enabled` action：调用 `autoStartupManager.getAutoStartupStatusForSelf()`，catch error 801 返回 `false`

### 3.3 注册与集成
- [x] 3.3.1 在 `EntryAbility.bridgePlugins` 数组中添加 `AutostartPlugin` factory
- [x] 3.3.2 在 `#[ability]` 初始化代码中注册 `AutostartBridgePlugin` 到 bridge registry
- [x] 3.3.3 在 `demo/entry/oh-package.json5` 中添加 `@ohos-rs/ability-plugin-autostart` 依赖

---

## 4. 旧代码标记 deprecated

- [ ] 4.1 在 `crates/ability/src/global_shortcut/mod.rs` 添加 `#[deprecated]` 注释
- [ ] 4.2 在 `crates/ability/src/autostart.rs` 添加 `#[deprecated]` 注释
- [ ] 4.3 在 `helper/global_shortcut.ets` 添加 `@Deprecated` 注释
- [ ] 4.4 在 `helper/autostart.ets` 添加 `@Deprecated` 注释
- [ ] 4.5 确认旧代码仍可编译（不删除，B5 集成后删除）

---

## 5. 验证

- [x] 5.1 `cargo check` 编译通过（Windows host, 0 errors）
- [x] 5.1.1 `cargo check --target aarch64-unknown-linux-ohos` 编译通过（OHOS target, 0 errors）
- [x] 5.1.2 `demo_native` crate 在两个 target 上均编译通过
- [ ] 5.2 各 plugin crate 单测通过（需 OHOS 设备/交叉编译环境，Windows 主机无法链接 OHOS 原生库）
- [ ] 5.3 HAR 重建后 HAP 构建通过
- [ ] 5.4 设备端验证：
  - global-shortcut：注册 Ctrl+T → 按键 → 验证回调触发
  - deep-link：冷启动带 uri → 验证 `get_initial_uri()` 返回值
  - autostart：`is_enabled()` 返回值、`enable()` 跳转设置页
  - autostart 设置页 URI 验证：确认 `pc_app_setup_settings` 跳转到当前应用的启动管理页（若不正确，改用 `application_startup_settings` + `want.parameters.pushParams = bundleName`）
