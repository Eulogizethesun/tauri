# OHOS 插件模板归位 适配计划

**创建时间**：2026-08-07
**功能描述**：将 dialog / global-shortcut / notification 三个插件的 OHOS ArkTS 模板从 `tauri-cli/templates/mobile/open-harmony/` 迁回 `plugins-workspace/plugins/<name>/openharmony/`（与 android/ios 目录对齐），移除 `BUILTIN_PLUGINS` 特殊处理使所有插件统一走 `find_plugin_har → copy_plugin_har`，修复 `find_plugin_har` 在本 monorepo 的搜索路径失效，并为 `copy_plugin_har` 增加生成物（`.tauri`/`target`）过滤。
**判断依据**：涉及 2 个代码层（tauri-cli + plugins-workspace），预估 ~20 个文件；搬迁+去builtin+修搜索路径原子耦合，不可独立交付，故采用单一 change。

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | 插件模板归位与 CLI 机制统一 | ohos-plugin-template-relocation | ✓ 已归档 | tauri-cli + plugins-workspace | ~20 | cargo check + tauri ohos init/build 端到端 |

## Phase 详细说明

### Phase 1: 插件模板归位与 CLI 机制统一

- **目标**：
  1. 搬迁三个插件的 OHOS ArkTS 源码（各 6 文件）到 `plugins-workspace/plugins/<name>/openharmony/`，作为 tracked 源码与 gitignored 的 `openharmony/.tauri/tauri-api/` 生成物并存；删除 `global-shortcut/openharmony/.gitkeep`。
  2. 移除 `plugins.rs` 的 `BUILTIN_PLUGINS` 常量及其 5 处特殊处理（`detect_all_plugins` / `parse_plugin_meta` / `copy_plugin_har` / `verify_plugin_before_update`），让所有插件统一走 `find_plugin_har → parse_oh_package → try_parse_class_name_from_index → copy_plugin_har`。
  3. 修复 `find_plugin_har` / `get_tauri_workspace_root` 在本 monorepo（tauri/ 与 plugins-workspace/ 为兄弟目录）的搜索路径失效；覆盖从源码 dev 运行（回退分支）与已安装二进制（`TAURI_WORKSPACE_ROOT` env）两种场景。
  4. 为 `copy_plugin_har` 的 `WalkDir` 增加 `.tauri` / `target` 过滤，避免把构建产物复制进生成工程。
- **文件列表**：
  - 搬迁（移动 18 + 删 1）：`tauri-cli/templates/mobile/open-harmony/{dialog,global-shortcut,notification}/**` → `plugins-workspace/plugins/{dialog,global-shortcut,notification}/openharmony/**`；删 `plugins-workspace/plugins/global-shortcut/openharmony/.gitkeep`
  - 编辑（1）：`tauri/crates/tauri-cli/src/mobile/open_harmony/plugins.rs`
- **依赖**：无（本仓内自洽；外部普通 app 的取源问题为所有非内置 OHOS 插件共同现状，不在本次范围）
- **验证方式**：
  - `cargo check -p tauri-cli` 编译通过；`BUILTIN_PLUGINS`/`__builtin__` 全仓无残留（archive 除外）
  - `tauri ohos init`（对 examples/api）后：生成工程含 `{project}/{dialog,global-shortcut,notification}/` 三个目录且只含源码（无 `.tauri/`）；根 `build-profile.json5` modules 含 `dialog`/`globalshortcut`/`notification`；`entry_{form}/oh-package.json5` 含三条 `@tauri/plugin-*` 依赖；渲染后 `EntryAbility.ets` 含三插件的 import 与 `STATIC_PLUGINS.set`
  - `tauri ohos build` → HAP 签名安装，mobile/desktop 形态下 dialog/notification/global-shortcut 功能可用（参考 archived openspec 验收点）

## 关键约束（不写入 artifact 文件，生成时自行遵守）

- 三条铁律 #2：本次只动 OHOS mobile 集成层与插件 ArkTS 源码位置，不改 Windows/macOS/Linux 路径；`plugins.rs` 属 `mobile/open_harmony/` 仅 OHOS init/build 调用。
- 搬迁的 `oh-package.json5` 保持 `"@tauri/app": "file:../tauri"`——`adjust_paths_in_file` 只改写 `file:../../tauri`/`file:../../../tauri`，对 `file:../tauri` 原样保留；复制到 `{project}/<plugin>/` 后 `../tauri` 指向模板 `tauri/` 模块 ✓。
- `module.json5` 设备形态差异原样保留：dialog/global-shortcut `["default","tablet","2in1"]`、notification `["default","phone","tablet","2in1"]`；module 名 `dialog`/`globalshortcut`（去连字符）/`notification`。
- 三个 `Plugin.ets` 的 OHOS API 已在 archived openspec 验证（dialog/notification/global-shortcut），本次为搬迁不改逻辑，Step 5 审计做确认性核对。
