## Why

Bridge 架构迁移（PR #67/#68）将旧的 `get_named_property` 字符串直调模型替换为统一的 `bridgeInvoke(pluginId, action, reqType, respType, value, timeout)` 具名契约传输层。内置插件（window、webview、clipboard、app-control、menu、statusbar 等）已在 A0/A1 完成 bridge 迁移。

但 `global-shortcut`、`deep-link`、`autostart` 三个能力域在新 bridge 模型中没有对应的内置插件。它们目前仍使用旧架构（散函数 NAPI 导出 + 全局 TSFN + `get_helper` 直调），与铁律 #1（openharmony-ability 是唯一 ArkTS 桥接仓）和新的 BridgePlugin 契约模型不一致。

## What Changes

为这三个能力域创建成对的 bridge 插件（Rust facade crate + ArkTS plugin）：

1. **`ohos.global-shortcut`** — 全局快捷键注册/注销/触发
   - Rust crate: `plugin-global-shortcut`（AsyncBridge，`REQUIRED_CONTEXTS = [Ability]`）
   - ArkTS plugin: 使用 `inputConsumer` API（API 14+），含 60+ key code 映射
   - 3 个 action: `register`、`unregister`、`unregister-all`
   - 1 个反向事件: `on-shortcut-triggered`（通过 `invokeNativeSync` 推送）

2. **`ohos.deep-link`** — 深度链接读取
   - Rust crate: `plugin-deep-link`（AsyncBridge，`REQUIRED_CONTEXTS = [Ability]`）
   - ArkTS plugin: 读取 `want.uri`（冷启动）和 `want.parameters`（onNewWant）
   - 1 个 action: `get-initial-uri`
   - 存储层保留在 core `app.rs`（`INITIAL_WANT_URI` / `WANT_PARAMETERS` Mutex），插件只提供读取 facade

3. **`ohos.autostart`** — 开机自启动管理
   - Rust crate: `plugin-autostart`（AsyncBridge，`REQUIRED_CONTEXTS = [Ability]`）
   - ArkTS plugin: `autoStartupManager`（API 21+）+ 设置页跳转
   - 3 个 action: `enable`、`disable`、`is-enabled`

## Capabilities

### New Capabilities

- `ohos.global-shortcut`: 全局快捷键注册、注销和触发回调
- `ohos.deep-link`: 读取冷启动和 onNewWant 的 want.uri 深度链接
- `ohos.autostart`: 开机自启动状态查询和设置页引导跳转

### Modified Capabilities

（无 — 旧实现将被替换，不影响其他插件）

## Impact

- **仓库**: openharmony-ability（新增 3 个 plugin crate + 3 个 ArkTS plugin 实现）
- **新 crate**: `plugin-global-shortcut`、`plugin-deep-link`、`plugin-autostart`
- **ArkTS**: 新增 3 个 AsyncBridgePlugin 实现（在 `native_ability/` 下的 plugins 目录）
- **旧代码处置**: `crates/ability/src/global_shortcut/` 和 `crates/ability/src/autostart.rs` 标记为 deprecated，待 B5 集成完成后删除
- **API 版本要求**:
  - `inputConsumer`（global-shortcut）: API 14+，低版本静默跳过
  - `autoStartupManager`（autostart）: API 21+，低版本 `is-enabled` 返回 `false`
  - `want.uri` 解析（deep-link）: 无版本限制，API 12+ 原生支持
- **依赖**: 消费方（tauri-plugin-global-shortcut、tauri-plugin-deep-link、tauri-plugin-autostart）在 B5 阶段接入新 facade
