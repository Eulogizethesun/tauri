# ohos-plugin-har-discovery Specification

## Purpose
TBD - created by archiving change ohos-plugin-template-relocation. Update Purpose after archive.
## Requirements
### Requirement: Plugin ArkTS source location

OHOS 插件的 ArkTS 源码（`Plugin.ets` / `index.ets` / `module.json5` / `oh-package.json5` / `build-profile.json5` / `hvigorfile.ts`）MUST 作为 tracked 文件位于 `plugins-workspace/plugins/<name>/openharmony/` 下，与由 `tauri_plugin::Builder::ohos_path` 生成的 gitignored `openharmony/.tauri/tauri-api/`（`@tauri/app` 运行时 HAR）并存。tauri-cli 的 app 模板（`templates/mobile/open-harmony/`）MUST NOT 内嵌任何插件特有的 ArkTS 源码目录。

#### Scenario: 源码位于插件仓

- **WHEN** 检查 `plugins-workspace/plugins/dialog/openharmony/` 目录
- **THEN** 该目录含 `oh-package.json5`、`build-profile.json5`、`hvigorfile.ts`、`src/main/module.json5`、`src/main/ets/index.ets`、`src/main/ets/Plugin.ets` 六个 tracked 文件

#### Scenario: 模板不含插件源码

- **WHEN** 检查 `tauri-cli/templates/mobile/open-harmony/` 目录树
- **THEN** 该目录下不存在 `dialog/`、`global-shortcut/`、`notification/` 三个插件源码子目录

#### Scenario: 与生成物并存

- **WHEN** 插件 `build.rs` 以 `.ohos_path("openharmony")` 执行后
- **THEN** `openharmony/.tauri/tauri-api/` 生成物存在且被 `.gitignore` 忽略，而 tracked 的 `openharmony/src/main/ets/Plugin.ets` 等源码不受生成/清理影响

### Requirement: Uniform plugin sourcing without builtin special-casing

所有 OHOS 插件（包括 dialog / global-shortcut / notification）SHALL 经由同一条 discover+copy 路径被定位与复制：`detect_plugins`（从 Cargo.toml 收集 `tauri-plugin-*` 依赖）→ `find_plugin_har` → `parse_oh_package` + `try_parse_class_name_from_index` → `copy_plugin_har` → `validate_plugin_meta`。tauri-cli MUST NOT 对任何插件使用硬编码 identifier/className、`__builtin__` 哨兵、或跳过 HAR 复制的特殊分支。

#### Scenario: dialog 走统一路径

- **WHEN** app 的 Cargo.toml 依赖 `tauri-plugin-dialog` 且执行 `tauri ohos init`
- **THEN** dialog 的 identifier（`@tauri/plugin-dialog`）与 className（`DialogPlugin`）由 `parse_oh_package`（读 `openharmony/oh-package.json5`）与 `try_parse_class_name_from_index`（解析 `index.ets` 的 `export { DialogPlugin as default }`）得出，而非硬编码

#### Scenario: 无 builtin 哨兵残留

- **WHEN** 全仓搜索 `BUILTIN_PLUGINS` 与 `__builtin__` 标识符（排除 openspec/changes/archive 历史归档）
- **THEN** tauri-cli 源码中无任何匹配

### Requirement: Monorepo search-path reachability

`find_plugin_har` MUST 在 monorepo 布局（`tauri/` 与 `plugins-workspace/` 为兄弟目录，或 app 位于 `plugins-workspace/examples/<app>/src-tauri` 任意深度）下定位到 `plugins-workspace/plugins/<name>/openharmony/`，且不要求设置 `TAURI_WORKSPACE_ROOT` 环境变量。固定深度的 `parent().parent()` 假设 MUST NOT 作为唯一解析手段。

#### Scenario: 兄弟 monorepo 布局可达

- **WHEN** app 的 `src-tauri` 位于 `<monorepo>/<app>/src-tauri`，且 `<monorepo>/plugins-workspace/plugins/<name>/openharmony/` 存在，执行 `tauri ohos init`
- **THEN** `find_plugin_har` 返回该 `openharmony/` 路径（通过从 `src-tauri` 向上遍历祖先命中 `plugins-workspace` 兄弟），插件被复制进生成工程

#### Scenario: demo app（3 级深）可达

- **WHEN** app 为 `plugins-workspace/examples/api/src-tauri`（src-tauri 距 `plugins-workspace` 3 级），执行 `tauri ohos init`
- **THEN** `find_plugin_har` 返回 `plugins-workspace/plugins/<name>/openharmony/`（通过祖先命中 `plugins-workspace` 本身），不再误算到 `examples/plugins-workspace/...`

#### Scenario: 源码 dev 运行可达

- **WHEN** 从 tauri-cli 源码 `cargo run -- tauri ohos init`（未设 `TAURI_WORKSPACE_ROOT`），`CARGO_MANIFEST_DIR` 指向开发机 `tauri/crates/tauri-cli`
- **THEN** `get_tauri_workspace_root` 通过祖先查找返回 `tauri/` 的父目录（monorepo 根），路径解析到 `<monorepo>/plugins-workspace/plugins/<name>/openharmony/`

### Requirement: Workspace root env override

`TAURI_WORKSPACE_ROOT` 环境变量 SHALL 覆盖任何基于路径推断的 workspace 根，供已安装 tauri-cli 二进制（`CARGO_MANIFEST_DIR` 指向编译机、用户机路径推断失效）的场景使用。设置后 `find_plugin_har` MUST 据此定位 `plugins-workspace/plugins/<name>/openharmony/`。

#### Scenario: env 覆盖优先

- **WHEN** `TAURI_WORKSPACE_ROOT` 设为含 `plugins-workspace/` 的目录，执行已安装 `tauri ohos init`
- **THEN** `get_tauri_workspace_root` 返回该 env 值（优先于祖先查找），`find_plugin_har` 据此命中插件

### Requirement: Build-artifact exclusion during HAR copy

`copy_plugin_har` 复制插件 `openharmony/` 到生成工程时，MUST 排除 `.tauri/`（`@tauri/app` 运行时 HAR 生成物）与 `target/`（Rust 编译输出）子树。仅 tracked 的插件源码与配置文件 SHALL 被复制。

#### Scenario: 生成工程不含 .tauri

- **WHEN** 插件 `openharmony/` 下含已生成的 `.tauri/tauri-api/`，执行 `tauri ohos init` 复制该插件
- **THEN** 生成工程的 `{project}/<plugin>/` 下不存在 `.tauri/` 目录，仅含 `oh-package.json5`、`build-profile.json5`、`hvigorfile.ts`、`src/main/...` 等 tracked 源码

#### Scenario: adjust_paths 不误处理生成物

- **WHEN** `copy_plugin_har` 执行 `adjust_paths_in_file`
- **THEN** 不存在 `.tauri/tauri-api/oh-package.json5` 与 `.tauri/tauri-api/build-profile.json5` 被处理的情形（因 `.tauri/` 已在复制阶段排除）

### Requirement: Plugin metadata validation for sourced plugins

经统一路径取源的插件 MUST 满足 `validate_plugin_meta`：identifier 以 `@tauri/plugin-` 开头且名称部分合法（`validate_identifier`）、className 以 `Plugin` 结尾且 base 仅含字母且首字母大写（`validate_class_name`）。identifier 由 `oh-package.json5.name` 得出；className 由 `try_parse_class_name_from_index` 从 `index.ets` 解析，支持的 export 形式包括 `export { default as <Class>Plugin }`、`export { <Class>Plugin as default }`、`export default class <Class>Plugin`、`export class <Class>Plugin extends Plugin`；解析失败时由 `infer_class_name` 从插件名推断（PascalCase + `Plugin`）。

#### Scenario: 三个插件元数据校验通过

- **WHEN** 对 dialog / global-shortcut / notification 执行 `parse_plugin_meta` + `validate_plugin_meta`
- **THEN** identifier 分别为 `@tauri/plugin-dialog` / `@tauri/plugin-global-shortcut` / `@tauri/plugin-notification`，className 分别为 `DialogPlugin` / `GlobalShortcutPlugin` / `NotificationPlugin`，校验均通过

#### Scenario: className 由 index.ets 解析得出

- **WHEN** 插件 `index.ets` 为 `export { GlobalShortcutPlugin as default } from './Plugin'`
- **THEN** `try_parse_class_name_from_index` 通过 `export { <Class>Plugin as default }` 形式匹配并返回 `GlobalShortcutPlugin`，而非退回 `infer_class_name` fallback

### Requirement: Path-adjustment preservation for @tauri/app dependency

搬迁后的插件 `oh-package.json5` 保持 `"@tauri/app": "file:../tauri"`。`copy_plugin_har` 的 `adjust_paths_in_file` 只改写 `file:../../tauri` 与 `file:../../../tauri` 形式，MUST 对 `file:../tauri` 原样保留。复制到生成工程 `{project}/<plugin>/` 后，`../tauri` SHALL 指向模板渲染的 `tauri/` 模块。

#### Scenario: file:../tauri 不被改写

- **WHEN** 插件 `oh-package.json5` 含 `"@tauri/app": "file:../tauri"`，经 `copy_plugin_har` 复制并 `adjust_paths_in_file` 处理
- **THEN** 生成工程 `{project}/<plugin>/oh-package.json5` 中该依赖仍为 `"file:../tauri"`，且 `../tauri` 解析到 `{project}/tauri/` 模块

