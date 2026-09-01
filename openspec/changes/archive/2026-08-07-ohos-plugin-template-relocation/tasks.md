## 1. 源码搬迁

- [x] 1.1 迁移 `dialog` 的 6 文件（`oh-package.json5` / `build-profile.json5` / `hvigorfile.ts` / `src/main/module.json5` / `src/main/ets/index.ets` / `src/main/ets/Plugin.ets`）从 `tauri-cli/templates/mobile/open-harmony/dialog/` 到 `plugins-workspace/plugins/dialog/openharmony/`
- [x] 1.2 迁移 `global-shortcut` 的 6 文件到 `plugins-workspace/plugins/global-shortcut/openharmony/`，并删除该目录下既有 `.gitkeep`
- [x] 1.3 迁移 `notification` 的 6 文件到 `plugins-workspace/plugins/notification/openharmony/`
- [x] 1.4 删除 `tauri-cli/templates/mobile/open-harmony/{dialog,global-shortcut,notification}/` 三个已搬空的目录
- [x] 1.5 核对迁移后文件内容与原模板逐字一致：`module.json5` 设备形态差异保留（dialog/global-shortcut `["default","tablet","2in1"]`、notification `["default","phone","tablet","2in1"]`；module 名 `dialog`/`globalshortcut`/`notification`）、dialog 的 `hvigorfile.ts` 与另两个的差异保留、`oh-package.json5` 的 `name`（`@tauri/plugin-<x>`）与 `"@tauri/app": "file:../tauri"` 保留

## 2. 移除 BUILTIN_PLUGINS 特殊处理（plugins.rs）

- [x] 2.1 删除 `BUILTIN_PLUGINS` 常量定义（plugins.rs:129-141）
- [x] 2.2 删除 `detect_all_plugins` 的 builtin 分支（155-169），所有插件统一走 `find_plugin_har`
- [x] 2.3 删除 `parse_plugin_meta` 的 builtin 分支（246-255），统一走 `parse_oh_package` + `try_parse_class_name_from_index`
- [x] 2.4 删除 `copy_plugin_har` 的 `__builtin__` 跳过分支（380-386）
- [x] 2.5 删除 `verify_plugin_before_update` 的 `__builtin__` 跳过分支（755-760）
- [x] 2.6 在 `try_parse_class_name_from_index` 的 patterns 数组（plugins.rs:287-291）增加 `r"export\s+\{\s*(\w+Plugin)\s+as\s+\w+\s*\}"`，匹配 `export { <Class>Plugin as default }` 形式（三个插件实际使用的 export 写法），使 className 由 parse 得出而非依赖 `infer_class_name` 巧合

## 3. 修复搜索路径（plugins.rs）

- [x] 3.1 改写 `get_tauri_workspace_root` 回退分支：从 `CARGO_MANIFEST_DIR` 向上遍历祖先，命中含 `plugins-workspace` 子目录的祖先即返回该祖先；保留 `TAURI_WORKSPACE_ROOT` env 覆盖优先
- [x] 3.2 改写 `find_plugin_har` 路径 2：从 `project_dir` 向上遍历祖先，命中"祖先含 `plugins-workspace` 兄弟"或"祖先本身即 `plugins-workspace`"时返回 `<命中点>/plugins/<name>/openharmony`
- [x] 3.3 确认路径 1（`project_dir/plugins/<name>/openharmony`，app in-tree 布局）与 env 覆盖路径行为不变，先命中先返回

## 4. copy_plugin_har 生成物过滤（plugins.rs）

- [x] 4.1 在 `copy_plugin_har` 的 `WalkDir` 过滤器（plugins.rs:422 附近）增加：`relative` 以 `.tauri` 或 `target` 开头的条目跳过复制

## 5. 编译验证

- [x] 5.1 `cargo check -p tauri-cli` 编译通过
- [x] 5.2 全仓搜索 `BUILTIN_PLUGINS` 与 `__builtin__` 无残留（`openspec/changes/archive` 历史归档除外）

## 6. 端到端验证

- [x] 6.1 `tauri ohos init`（examples/api）：生成工程含 `{project}/{dialog,global-shortcut,notification}/` 三个目录且不含 `.tauri/`；根 `build-profile.json5` 的 modules 含 `dialog` / `globalshortcut` / `notification`；`entry_{form}/oh-package.json5` 含 `@tauri/plugin-dialog` / `@tauri/plugin-global-shortcut` / `@tauri/plugin-notification` 三条依赖；渲染后 `EntryAbility.ets` 含三插件的 `import <Class> from '<identifier>'` 与 `STATIC_PLUGINS.set('<name>', new <Class>())`
- [x] 6.2 `tauri ohos build`：HAR 构建 + HAP 签名成功（desktop 形态：build-ohos.sh 全流程通过，`entry_desktop-default-signed.hap` 生成，hvigorw assembleHap 签名成功；openharmony-ability HAR up-to-date）
- [ ] 6.3 设备端 mobile 形态：**BLOCKED** — mobile build 被既有 OHOS 适配缺口阻塞（非本次 change 引入）：(1) `tauri-plugin-opener` `cfg(mobile)` 引用未定义 `handle`（缺 `cfg(target_env="ohos")` 注册分支，上游 PR #3343 引入）；(2) `tauri-plugin-window-state` `set_decorations`/`maximize`/`set_fullscreen` 等 Window 方法 mobile 下缺 cfg 门控。递延至新 change「plugins-workspace mobile OHOS 适配缺口集合」专项处理。本次三插件（dialog/global-shortcut/notification）的 mobile 验收随该 change 一并完成。
- [x] 6.4 设备端 desktop 形态：自动测试 247 项 245✅/2❌，**三插件全过**——notification（#95-99 isPermissionGranted/createChannel+channels/cancel+cancelAll/removeChannel/pending+active 5✅）、global-shortcut（#101-114 register+isRegistered/unregister/unregisterAll/multipleCycles/singleModifier/twoModifiers/threeModifiers_fails/noModifier_fails/invalidKey_fails/duplicateModifier/duplicateRegister/unregisterNotRegistered 14✅）；dialog 无 auto 测试（文件选择器/保存/消息框需手动交互，见手动用例）。2 个失败是既有无关问题：#33 RunEvent::Resumed（archived runevent）、#85 clipboard write_text 平台限制（archived clipboard-writeimage）。
