## Why

dialog / global-shortcut / notification 三个插件的 OHOS ArkTS 源码（`Plugin.ets` 等）当前滞留在 `tauri-cli/templates/mobile/open-harmony/{dialog,global-shortcut,notification}/` 的 app 模板里，靠 `plugins.rs` 的 `BUILTIN_PLUGINS` 硬编码特殊处理（塞 `__builtin__{name}` 哨兵、跳过 HAR 复制、硬编码 identifier/className）。这违背了"插件源码归属插件仓"的结构一致性——其他平台（android/ios）源码都在 `plugins-workspace/plugins/<name>/` 下，唯独 OHOS 这三个的 ArkTS 落在 CLI 模板里；同时 `find_plugin_har` 的三条搜索路径在本 monorepo（`tauri/` 与 `plugins-workspace/` 为兄弟目录）全部失效，`TAURI_WORKSPACE_ROOT` env 又无人设置，内置机制恰是绕过该搜索路径缺陷的权宜之计。现需把源码归位、移除特殊处理、修复搜索路径，使所有 OHOS 插件统一走同一条 discover+copy 路径。

## What Changes

- **搬迁**：`tauri-cli/templates/mobile/open-harmony/{dialog,global-shortcut,notification}/**`（各 6 文件：`oh-package.json5` / `build-profile.json5` / `hvigorfile.ts` / `src/main/module.json5` / `src/main/ets/index.ets` / `src/main/ets/Plugin.ets`）迁到 `plugins-workspace/plugins/<name>/openharmony/`，作为 tracked 源码与 gitignored 的 `openharmony/.tauri/tauri-api/` 生成物并存；删除 `plugins-workspace/plugins/global-shortcut/openharmony/.gitkeep`。
- **移除 `BUILTIN_PLUGINS` 特殊处理**：删除 `plugins.rs` 的 `BUILTIN_PLUGINS` 常量及其在 `detect_all_plugins` / `parse_plugin_meta` / `copy_plugin_har` / `verify_plugin_before_update` 的 5 处 builtin 分支，让所有插件统一走 `find_plugin_har → parse_oh_package → try_parse_class_name_from_index → copy_plugin_har`。
- **修复搜索路径**：修复 `find_plugin_har` / `get_tauri_workspace_root` 在本 monorepo 的回退分支（当前 `CARGO_MANIFEST_DIR.parent().parent()` = `tauri/`，少上一级，导致 `tauri/plugins-workspace/...` 误判）；覆盖从源码 dev 运行（回退分支）与已安装二进制（`TAURI_WORKSPACE_ROOT` env）两种场景。
- **`copy_plugin_har` 生成物过滤**：为 `WalkDir` 增加 `.tauri` / `target` 过滤，避免把构建产物（`@tauri/app` 运行时 HAR、Rust 编译输出）复制进生成工程。

**非变更**：三个 `Plugin.ets` 的 ArkTS 逻辑、OHOS API 使用、`module.json5` 设备形态差异（dialog/global-shortcut `["default","tablet","2in1"]`、notification `["default","phone","tablet","2in1"]`）、各插件 `build.rs`（已 `.ohos_path("openharmony")`）均不变。Windows/macOS/Linux 路径完全不受影响（`plugins.rs` 属 `mobile/open_harmony/`，仅 OHOS init/build 调用）。

## Capabilities

### New Capabilities

- `ohos-plugin-har-discovery`: tauri-cli 如何发现 OHOS 插件的 tracked ArkTS 源码并复制进生成的 DevEco 工程——统一 discover+copy 路径、搜索路径可达性、生成物过滤、源码归属（插件仓 `openharmony/` 下与 `.tauri/tauri-api/` 生成物并存）、插件元数据校验（identifier/className）。

### Modified Capabilities

<!-- 无。dialog/notification/global-shortcut 的 spec 级行为不变（Plugin.ets 逻辑仅搬迁不改）；既有 specs/ 中无任何 spec 编码 "builtin 模板" 期望。 -->

## Impact

- **代码**：`tauri/crates/tauri-cli/src/mobile/open_harmony/plugins.rs`（1 文件编辑）；`tauri-cli/templates/mobile/open-harmony/{dialog,global-shortcut,notification}/`（3 目录移除）；`plugins-workspace/plugins/{dialog,global-shortcut,notification}/openharmony/`（18 文件迁入 + 1 `.gitkeep` 删除）。
- **API/依赖**：无新增。搬迁的 `oh-package.json5` 保持 `"@tauri/app": "file:../tauri"`，`adjust_paths_in_file` 对其原样保留（复制到 `{project}/<plugin>/` 后 `../tauri` 指向模板 `tauri/` 模块）。
- **构建/init/build**：`tauri ohos init` 与 `tauri ohos build` 均依赖 `detect_all_plugins → parse_plugin_meta → copy_plugin_har → update_plugin_configs → validate_plugin_configs`（build.rs 的 `inject_plugins` 走同一套）；修复后两条路径均能定位到三个插件。
- **外部普通 app**：无 `plugins-workspace` 兄弟检出且未设 `TAURI_WORKSPACE_ROOT` 时，这三个插件在 OHOS 上会被跳过——这是所有非内置 OHOS 插件（clipboard-manager/fs/http 等）当前的共同现状，本次只让这三个与现状对齐，不新增回归。外部分发方案（crate 打包源码 / OHPM 发布 HAR）为独立后续项。
- **既有验收**：dialog/notification/global-shortcut 的 archived openspec（`2026-06-03-ohos-dialog-plugin`、`2026-06-13-notification-ohos-gap-analysis`、`2026-06-16-global-shortcut-plan` + `p1/p2/p3-global-shortcut`）的 API 验证与验收点继续适用。
