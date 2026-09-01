> **状态（2026-08-21）**：本 change 大部分已随 pluginize 重构落地（MenuPlugin.ets/StatusbarPlugin.ets 已创建注册、旧 ArkHelper 调用链已删、opener.rs 已删）。**N8 被 supersede**：原方案"tauri_window_id → ohos_window_id 重命名"，实际经解耦方案 v3 审计确认为零写入方死读取（全工作区 grep 含模板/gen 目录），已直接删除（v3 P0-1，2026-08-21 落地验证）。N6 huawei-account 已定性为核心特权能力（v3 P1-1，不做 facade）。后续以 `openharmony-ability/docs/decoupling-plan-v3.md` 为准，本 change 仅存档参考。

## Why

Phase 1 迁移了大部分 consumer，但依赖 ArkHelper 旧 TSFN 路径的模块（window/mod.rs、clipboard/mod.rs、opener.rs）和依赖 menu/statusbar ArkTS 插件的 consumer（tauri core N13/N4）仍未处理。Phase 4 收尾这些遗留：创建 MenuPlugin.ets/StatusbarPlugin.ets 补齐 ArkTS 侧，迁移延迟 consumer，删除旧 ArkHelper 调用链，泛化 ArkTS 层 Tauri 硬编码键名，处理 huawei-account facade。

## What Changes

- **新建 MenuPlugin.ets**：`ohos.menu` ArkTS bridge 插件（set-menubar / popup / set-menubar-visible / execute-predefined handlers）
- **新建 StatusbarPlugin.ets**：`ohos.statusbar` ArkTS bridge 插件
- 注册到 EntryAbility.bridgePlugins + 对应 package export
- 迁移延迟 consumer：tauri core window（N13）+ tauri core menu（N4）
- 删除 menu 旧 API（`set_menu_json`/`is_menubar_visible`/`start_popup_forwarder`/`MENU_CHANNEL`/`MENU_CALLBACK`）
- `window/mod.rs` 20+ 处 `get_helper()` 调用迁移/确认覆盖
- `clipboard/mod.rs` + `opener.rs` 迁移到 bridge
- `StatusBarUtils.ets` 解耦 ArkHelper 类型
- N8 NativeAbility.ets `tauri_window_id`/`tauri_transparent` 泛化
- N6 huawei-account facade 决策
- 删除 ArkHelper.ets 或仅保留通用能力方法

## Capabilities

### New Capabilities
- `decoupling-arkhelper-cleanup`: ArkHelper 旧调用链删除 + ArkTS 插件补齐 + Tauri 键名泛化 + 延迟 consumer 迁移

### Modified Capabilities
（无——功能等价迁移）

## Impact

- **新增 2 个 ArkTS 插件**：MenuPlugin.ets + StatusbarPlugin.ets
- **ability core**：window/mod.rs、clipboard/mod.rs、opener.rs 大幅重构或删除
- **ArkTS**：StatusBarUtils.ets、NativeAbility.ets、ArkHelper.ets 改动
- **tauri core**：window/mod.rs（N13）+ menu/plugin.rs（N4）延迟迁移
