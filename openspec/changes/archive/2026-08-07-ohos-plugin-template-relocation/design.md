## Context

tauri-cli 的 OHOS mobile 集成层（`crates/tauri-cli/src/mobile/open_harmony/`）在 `ohos init` 与 `ohos build` 时，需要把每个被依赖插件的 ArkTS HAR 源码复制进生成的 DevEco 工程（`{project}/<plugin>/`），并在 `build-profile.json5` 注册 module、在 `entry_{form}/oh-package.json5` 加依赖、在 `EntryAbility.ets.hbs` 渲染 import 与 `STATIC_PLUGINS.set`。

当前实现（`plugins.rs`）把 dialog / global-shortcut / notification 三个插件硬编码为 `BUILTIN_PLUGINS`：塞 `__builtin__{name}` 哨兵 → `copy_plugin_har` 跳过复制（"rendered by populate_template"）→ `parse_plugin_meta` 走硬编码不读 `oh-package.json5`。这三个插件的 ArkTS 源码因此被放在 app 模板 `templates/mobile/open-harmony/{dialog,global-shortcut,notification}/` 里（静态文件，无 handlebars 占位符），与其他平台（android/ios 源码都在 `plugins-workspace/plugins/<name>/` 下）的结构不一致。

同时 `find_plugin_har` 的三条搜索路径在本 monorepo（`tauri/` 与 `plugins-workspace/` 为兄弟目录）全部失效：
- 路径 1 `project_dir/plugins/<name>/openharmony`：examples/api/src-tauri 下不存在；
- 路径 2 `project_dir.parent().parent()/plugins-workspace/...`：对 `plugins-workspace/examples/api/src-tauri`（3 级深）算到 `examples/plugins-workspace/...` ❌；
- 路径 3 `get_tauri_workspace_root()/plugins-workspace/...`：回退分支 `CARGO_MANIFEST_DIR.parent().parent()` = `tauri/`（少上一级）→ `tauri/plugins-workspace/...` ❌；
- `TAURI_WORKSPACE_ROOT` env 覆盖路径正确，但全仓无任何脚本/skill/CI 设置它。内置机制恰是绕过此搜索路径缺陷的权宜之计。

**约束**：三条铁律 #2（不影响其他平台）——`plugins.rs` 属 `mobile/open_harmony/`，仅 OHOS init/build 调用，Windows/macOS/Linux 路径不受影响。三个 `Plugin.ets` 的 OHOS API 已在 archived openspec 验证（dialog `@ohos.file.picker`/`@ohos.promptAction`；notification `@kit.NotificationKit` notificationManager 全套；global-shortcut 薄壳 + Rust 侧 openharmony-ability），本次搬迁不改逻辑。

## Goals / Non-Goals

**Goals:**
- 三个插件的 OHOS ArkTS 源码归位到 `plugins-workspace/plugins/<name>/openharmony/`（tracked），与 gitignored 的 `openharmony/.tauri/tauri-api/`（`@tauri/app` 运行时，由 `tauri_plugin::Builder::ohos_path` 生成）并存，与 android/ios 目录对齐。
- 移除 `BUILTIN_PLUGINS` 特殊处理，所有 OHOS 插件统一走 `find_plugin_har → parse_oh_package → try_parse_class_name_from_index → copy_plugin_har → validate_plugin_meta`。
- 修复 `find_plugin_har` 在本 monorepo（兄弟目录布局、demo app 3 级深）的可达性，覆盖源码 dev 运行与已安装二进制两种场景。
- `copy_plugin_har` 复制时排除 `.tauri/` 与 `target/` 构建产物。

**Non-Goals:**
- 不改三个 `Plugin.ets` 的 ArkTS 逻辑与 OHOS API 使用。
- 不改各插件 `build.rs`（已 `.ohos_path("openharmony")`）、`Cargo.toml`、模板 `tauri/` 核心、`EntryAbility.ets.hbs`、`project.rs`、`init.rs`、`build.rs` 的 `inject_plugins` 编排。
- 不解决外部普通 app（无 plugins-workspace 兄弟检出、未设 env）的取源问题——这是所有非内置 OHOS 插件共同现状，本次只让这三个对齐。
- 不做 OHPM HAR 发布 / crate 打包 `openharmony/` 源码等外部分发方案（独立后续项）。

## Decisions

### D1: 源码迁到 `plugins-workspace/plugins/<name>/openharmony/`（与 .tauri/ 生成物并存）

**选择**：把三个目录整体迁到插件仓的 `openharmony/` 下，作为 tracked 源码与 gitignored `openharmony/.tauri/tauri-api/` 并存。

**理由**：与 android/ios 目录对齐；`tauri_plugin::Builder::ohos_path("openharmony")` 已把 `openharmony/` 作为插件 OHOS 根，生成物落 `openharmony/.tauri/`——插件特有源码本就该在此根下。`.gitignore` 第 36 行只忽略 `plugins/*/openharmony/.tauri/`，不忽略 `openharmony/` 本身，tracked 源码可正常入库。

**备选**：
- 保留在模板 + 仅修搜索路径：拒绝——保留结构不一致与 builtin 特殊处理，正是要消除的。
- 新建 `plugins/<name>/ohos/` 子目录：拒绝——与 build.rs `ohos_path("openharmony")` 与既有 `.tauri/tauri-api/` 路径冲突，需改 build.rs，扩大改动面。
- 发布 HAR 到 OHPM：超出本次范围（外部分发后续项）。

### D2: 完全移除 `BUILTIN_PLUGINS`（不保留为 fallback）

**选择**：删除 `BUILTIN_PLUGINS` 常量及其 5 处分支（`detect_all_plugins` / `parse_plugin_meta` / `copy_plugin_har` / `verify_plugin_before_update`）。

**理由**：搬迁后模板不再含这三个目录，builtin 的 `__builtin__` 哨兵 + 跳过复制 + 硬编码元数据已无源码可渲染；保留为 fallback 会重新引入双代码路径与不一致。统一路径已能满足：搬迁后的 `oh-package.json5.name == "@tauri/plugin-<name>"`（满足 `validate_identifier`）、className `DialogPlugin`/`NotificationPlugin`/`GlobalShortcutPlugin`（满足 `validate_class_name`）。

**className 推导机制（审计修正）**：三个 `index.ets` 均为 `export { <Class>Plugin as default } from './Plugin'`。`try_parse_class_name_from_index` 现有 3 个正则（plugins.rs:287-291）均**不匹配**此形式——pattern 1 `export { <word> as (<wordPlugin>) }` 捕获 `as` 之后的词并要求以 `Plugin` 结尾，而此处 `as default` 的 `default` 不以 `Plugin` 结尾；pattern 2/3 需 `class` 关键字。故当前 className 实际由 `infer_class_name`（插件名 PascalCase + `Plugin`）fallback 得出——恰巧与三个类名一致才工作。此为搬迁后新暴露的脆弱点：移除 builtin 使这三个插件首次依赖 parse→infer 路径，而 parse 对它们的 export 形式失效。见 D6 扩展正则以让 parse 真正生效。

**备选**：保留 `BUILTIN_PLUGINS` 作为 `find_plugin_har` 失败时的 fallback——拒绝：文件已不在模板，fallback 无法渲染；且重新引入特殊处理。

### D3: 搜索路径用"祖先向上查找 `plugins-workspace`" + 保留 `TAURI_WORKSPACE_ROOT` env 覆盖

**选择**：把路径 2（`project_dir` 固定 2 级 parent）与路径 3（`get_tauri_workspace_root` 固定 2 级 parent）的固定深度假设，替换为从各自起点向上遍历祖先、命中"该祖先的 `plugins-workspace/plugins/<name>/openharmony` 存在"或"该祖先本身即 `plugins-workspace` 且 `plugins/<name>/openharmony` 存在"即返回。

**理由**：固定 2 级对 demo app（`plugins-workspace/examples/api/src-tauri`，3 级深）与兄弟 monorepo 布局都会误判；祖先查找对任意深度鲁棒。路径 3 起点为 `CARGO_MANIFEST_DIR`（编译期 baked），仅在**源码 dev 运行**时指向开发机真实路径——此时祖先查找有效；**已安装二进制**时 `CARGO_MANIFEST_DIR` 指向编译机路径（用户机不存在），祖先查找必然落空，此时只能靠 `TAURI_WORKSPACE_ROOT` env。故两条路径互补：env 覆盖（已安装）+ 祖先查找（源码 dev）。

**备选**：
- 硬编码 3 级 parent：拒绝——对仓库搬迁/重命名脆弱。
- 强制要求 `TAURI_WORKSPACE_ROOT`：拒绝——破坏源码 dev 的零配置体验，且当前无任何脚本设置它。
- 仅靠路径 1（app in-tree plugins）：不覆盖 monorepo 布局。

### D4: `copy_plugin_har` 的 `WalkDir` 过滤 `.tauri` / `target`

**选择**：在 `copy_plugin_har`（plugins.rs:422）的 `WalkDir` 过滤器中，跳过 `relative` 以 `.tauri` 或 `target` 开头的条目。

**理由**：搬迁后插件 `openharmony/` 下既有 tracked 源码又有 `tauri_plugin::Builder` 生成的 `.tauri/tauri-api/`（`@tauri/app` 运行时 HAR）；不过滤会把它复制进生成工程 `{project}/<plugin>/.tauri/`，产生冗余（虽因未注册 module 大概率惰性，但 `adjust_paths_in_file` 会误处理 `.tauri/tauri-api/oh-package.json5`）。`target/` 为 Rust 编译输出，同理排除。

**备选**：依赖 `.gitignore`——拒绝：`copy_plugin_har` 读工作树磁盘（含生成物），不读 git 索引，`.gitignore` 不生效。

### D5: 单一原子 change（不拆分多 Phase）

**选择**：搬迁 + 去 builtin + 修搜索路径 + 过滤 作为一个 openspec change 内的有序 tasks。

**理由**：搬走文件那一刻 builtin 机制（指望模板自带且跳过复制）即失效，必须**同时**移除 builtin 并修好搜索路径才能让 init/build 重新工作——三者原子耦合，无法拆成可独立交付的子步。`copy_plugin_har` 过滤虽与搬迁解耦，但当前无任何非内置插件走复制路径（搬迁前无消费者），独立交付无 observable 效果。独立可验证硬约束优先于">10 文件→拆"启发式。

**备选**：双 change（p1 过滤 + p2 归位）——拒绝：p1 在 p2 落地前无运行时消费者，不满足"独立可验证"实质。

### D6: 扩展 `try_parse_class_name_from_index` 匹配 `export { <Class>Plugin as default }` 形式

**选择**：在 `try_parse_class_name_from_index` 的 patterns 数组（plugins.rs:287-291）增加一条 `r"export\s+\{\s*(\w+Plugin)\s+as\s+\w+\s*\}"`，捕获 `as` **之前**以 `Plugin` 结尾的词，匹配三个插件实际使用的 `export { <Class>Plugin as default }` 形式。

**理由**：移除 builtin 后这三个插件首次依赖 parse→infer 路径，而现有 3 个正则对它们的 export 形式均失效（见 D2 修正），className 退回 `infer_class_name` 巧合命中。扩展正则让 parse 真正生效，消除对"类名须遵循 PascalCase(插件名)+Plugin 约定"的隐式依赖——若某插件类名不符约定（如 `foo-bar` 的类是 `FooBarShortcutPlugin` 而非 `FooBarPlugin`），infer 会产出错误 className 导致运行时 `new <WrongClass>()` 失败。新 pattern 与现有 pattern 1 互补：pattern 1 匹配 `export { default as <Class>Plugin }`（default-as-Class 形式），新 pattern 匹配 `export { <Class>Plugin as default }`（Class-as-default 形式），两者捕获不同的合法 export 写法，无冲突。

**备选**：改 `index.ets` 为 `export { default as <Class>Plugin }` 以命中 pattern 1——拒绝：违背"三个 Plugin.ets/index.ets 逻辑不变"的承诺，且应让 parse 适配常见 export 形式而非让源码迁就正则。

## Risks / Trade-offs

- **[外部 app 找不到 HAR]** → 三个插件在无 plugins-workspace 兄弟检出且未设 `TAURI_WORKSPACE_ROOT` 的外部 app 上被跳过。**缓解**：这是所有非内置 OHOS 插件（clipboard-manager/fs/http 等）的共同现状，本次只让这三个对齐而非新增回归；文档化 `TAURI_WORKSPACE_ROOT`；外部分发方案（OHPM/crate 打包）作独立后续项。
- **[祖先查找误命中同名 `plugins-workspace` 目录]** → 极端情况下用户机可能存在多个同名目录。**缓解**：从最近的祖先开始向上查，首个命中即返回（最近者最可能是 intended）；且路径 1（app in-tree）优先级更高，先命中先返回。
- **[已安装二进制祖先查找必然落空]** → `CARGO_MANIFEST_DIR` 指向编译机路径。**缓解**：env 覆盖路径（`TAURI_WORKSPACE_ROOT`）为已安装二进制的正确机制；design 与 tasks 中明确两种场景的分工。
- **[`copy_plugin_har` 过滤过宽]** → 误排除插件源码。**缓解**：仅跳过 `.tauri` 与 `target` 两个前缀；这两个是 tauri 体系固定的生成/编译目录名，不会与插件源码同名。
- **[搬迁后 `adjust_paths_in_file` 行为变化]** → 源码用 `"@tauri/app": "file:../tauri"`，`adjust_paths_in_file` 只改写 `file:../../tauri`/`file:../../../tauri`，对 `file:../tauri` 原样保留。**缓解**：复制到 `{project}/<plugin>/` 后 `../tauri` 指向模板 `tauri/` 模块 ✓；已确认无需改写。

## Migration Plan

**原子过渡**（单一提交，有序执行）：
1. 搬迁三个目录（18 文件）到 `plugins-workspace/plugins/<name>/openharmony/`；删 `global-shortcut/openharmony/.gitkeep`。
2. 编辑 `plugins.rs`：删 `BUILTIN_PLUGINS` 及 5 处分支；改 `find_plugin_har` 路径 2 与 `get_tauri_workspace_root` 为祖先查找；`copy_plugin_har` WalkDir 加 `.tauri`/`target` 过滤。
3. `cargo check -p tauri-cli`。
4. `tauri ohos init`（examples/api）验证生成工程结构；`tauri ohos build` 验证 HAR/HAP；设备端验证三插件功能（mobile + desktop）。

**回滚**：revert 单一提交——文件回到模板、`BUILTIN_PLUGINS` 恢复、搜索路径与过滤复原，状态完全回到过渡前。

## Open Questions

无遗留决策。外部分发（OHPM/crate 打包 `openharmony/` 源码）为明确排除的后续项，不在本次范围。
