## Why

Phase 1 实现了 deep-link 的运行中事件接入和首启动 `get_current`，但 OHOS 系统**当前无法路由 deep link 到 app**——工程 `module.json5` 的 `abilities[0].skills` 仅声明 home 入口（`entity.system.home`），**无 `uris/scheme` 声明**（`tauri-cli` 模板 `entry_mobile/src/main/module.json5:22-31`）。外部链接点击不会唤起 app。Phase 2 需在构建时把 deep-link 配置的 scheme/domain 注入 `module.json5` 的 `skills/uris`，让系统能识别并路由 deep link。

现有基础设施已就绪：`TAURI_DEEP_LINK_PLUGIN_CONFIG` 在 OHOS build 时已设置（`helpers/config.rs:218-226`），`TAURI_OHOS_PROJECT_PATH` 已设置（`open_harmony/mod.rs:191`）；`write_entry_device_types`（`plugins.rs:649-677`）已验证 OHOS 侧 json5 parse/serialize 修改 module.json5 的既定模式。缺口仅是：无 OHOS 的 `update_ohos_module_json` 注入 API（`tauri-plugin` 仅有 `update_android_manifest`/`update_entitlements`），且 `tauri-plugin` 未启用 `json5` 依赖。

## What Changes

- **新增 `update_ohos_module_json` 注入 API**（`tauri-plugin/src/build/mobile.rs`），对标 `update_android_manifest` 但用 **json5 parse/serialize** 模式（参考 `write_entry_device_types`）。
- **env 自门控**：读 `TAURI_OHOS_PROJECT_PATH`，未设则 no-op（对标 `TAURI_ANDROID_PROJECT_PATH`）。
- **幂等策略**：JSON5 无块注释，按 skill 签名（`actions` 含 `ohos.want.action.viewData`）去重——先移除旧 deep-link skill 再重新注入。
- **追加独立 skill 对象**到 `abilities[0].skills`，不改 home 入口 skill（依据 `deep-linking-startup.md:18`："应用跳转链接不能在 home skill 中配置，需创建独立 skill 对象"）。
- **AssociatedDomain→OHOS skill 字段映射**：`scheme`→`uris[].scheme`（多 scheme 多 uris 对象）、`host`→`uris[].host`、`path_pattern`→`pathRegex`、`path_prefix`→`pathStartWith`、`path_suffix`丢弃（OHOS 无对应）、`app_link`→`domainVerify`；固定 `entities:["entity.system.browsable"]`、`actions:["ohos.want.action.viewData"]`。
- **tauri-plugin `Cargo.toml` 新增 `json5` build 依赖**。
- **deep-link `build.rs` 新增 OHOS 分支**：读 `config.mobile`，生成 skills JSON，调 `update_ohos_module_json`。
- **不影响其他平台**：注入 API env 自门控，非 OHOS 构建 no-op；deep-link build.rs OHOS 分支仅 `TAURI_OHOS_PROJECT_PATH` 存在时执行。

## Capabilities

### New Capabilities
- `ohos-deep-link-scheme-registration`: OHOS 构建时把 deep-link 配置的 scheme/domain 注入 `module.json5` 的 `skills/uris`，让系统能识别并路由 deep link 到 app。

### Modified Capabilities
<!-- 无现有 scheme 注册相关 spec，本 Phase 为新增。 -->

## Impact

- **代码-tauri-plugin**：`crates/tauri-plugin/src/build/mobile.rs`（新增 `update_ohos_module_json`）、`crates/tauri-plugin/Cargo.toml`（加 `json5` build 依赖）— 2 文件
- **代码-deep-link 插件**：`plugins-workspace/plugins/deep-link/build.rs`（新增 OHOS 分支 + `ohos_skill` 生成函数）— 1 文件
- **无需 tauri-cli 模板改动**：运行时注入，时序兼容 `write_entry_device_types`（deep-link build.rs 步骤6 在 `write_entry_device_types` 步骤7 前，skills 字段被 round-trip 保留）
- **平台隔离**：注入 API env 自门控，非 OHOS no-op（铁律 2）
- **后续 Phase**：测试与文档（Phase 3）不在本 Phase 范围
