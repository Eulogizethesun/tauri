# Implementation Tasks: Phase 4 — ArkHelper 收尾

## 4.1 MenuPlugin.ets 创建

- [ ] **4.1** 新建 MenuPlugin.ets
  - 文件: `openharmony-ability/plugins/menu/src/main/ets/MenuPlugin.ets`（新建）
  - 基于 WindowPlugin.ets 模式
  - 实现 `set-menubar` / `popup` / `set-menubar-visible` / `execute-predefined` action handlers

- [ ] **4.2** 注册 MenuPlugin 到 EntryAbility
  - 文件: `openharmony-ability/demo/entry/src/main/ets/entryability/EntryAbility.ets`
  - 添加 MenuPlugin 到 bridgePlugins 数组

- [ ] **4.3** 对应 package export
  - 确认 menu plugin package 正确导出 MenuPlugin.ets

## 4.2 StatusbarPlugin.ets 创建

- [ ] **4.4** 新建 StatusbarPlugin.ets
  - 文件: `openharmony-ability/plugins/statusbar/src/main/ets/StatusbarPlugin.ets`（新建）
  - 实现 `add` / `remove` / `update-icon` / `update-menu` / `update-tips` action handlers

- [ ] **4.5** 注册 StatusbarPlugin 到 EntryAbility
  - 文件: `openharmony-ability/demo/entry/src/main/ets/entryability/EntryAbility.ets`
  - 添加 StatusbarPlugin 到 bridgePlugins 数组

## 4.3 延迟 Consumer 迁移

- [ ] **4.6** N13 tauri core window 迁移到 MenuClient facade
  - 文件: `tauri/crates/tauri/src/window/mod.rs`
  - 7 处 `set_menubar_visible`/`set_menu_json`/`is_menubar_visible` 改为 `MenuClient` facade 调用

- [ ] **4.7** N4 tauri core menu start_popup_forwarder 迁移
  - 文件: `tauri/crates/tauri/src/menu/plugin.rs`
  - `start_popup_forwarder` 迁到 menu bridge plugin facade

## 4.4 ArkHelper 调用链删除

- [ ] **4.8** window/mod.rs 迁移到 plugin-window facade
  - 文件: `openharmony-ability/crates/ability/src/window/mod.rs`
  - 列出 20+ 处 `get_helper()` 调用
  - 逐一对照 WindowClient facade action 列表
  - 未覆盖的方法: 在 plugin-window 补 facade action
  - 全部迁移后删除旧 window/mod.rs 代码

- [ ] **4.9** clipboard/mod.rs 迁移到 plugin-clipboard bridge
  - 文件: `openharmony-ability/crates/ability/src/clipboard/mod.rs`
  - 迁移到 `ClipboardClient` facade bridge 调用

- [ ] **4.10** opener.rs 迁移到 plugin-url/opener bridge
  - 文件: `openharmony-ability/crates/ability/src/opener.rs`
  - 迁移到 `OpenerClient` facade bridge 调用

- [ ] **4.11** 删除 menu 旧 API
  - 文件: `openharmony-ability/crates/ability/src/menu/mod.rs`
  - 删除 `set_menu_json` / `is_menubar_visible` / `start_popup_forwarder` / `MENU_CHANNEL` / `MENU_CALLBACK`

- [ ] **4.12** StatusBarUtils.ets 解耦 ArkHelper 类型
  - 文件: `openharmony-ability/native_ability/src/main/ets/helper/StatusBarUtils.ets`
  - 移除 `import { ArkHelper }` + `helperRef: ArkHelper | null`
  - 替换为 bridge plugin 类型或原生 OHOS 类型

- [ ] **4.13** 删除或缩减 ArkHelper.ets
  - 文件: `openharmony-ability/package/src/main/ets/ability/ArkHelper.ets`
  - 确认所有 Tauri-shaped 方法已迁出
  - 删除 ArkHelper.ets 或仅保留通用能力方法（如 `checkCanIUse`/`getWindowAvoidArea`）

## 4.5 N8 键名泛化

- [ ] **4.14** NativeAbility.ets 键名泛化
  - 文件: `openharmony-ability/native_ability/src/main/ets/ability/NativeAbility.ets`
  - `tauri_window_id` → `ohos_window_id`
  - `tauri_transparent` → `ohos_transparent`
  - grep 确认 ArkTS + Rust 双侧全部更新

## 4.6 huawei-account facade 决策

- [ ] **4.15** 评估 huawei-account 是否为通用 OHOS 能力
  - 文件: `plugins-workspace/plugins/huawei-account/src/ohos.rs`
  - 文件: `plugins-workspace/plugins/huawei-account/src/models.rs`
  - 评估华为账号登录是否通用 OHOS 能力
  - 若通用: 新建 `openharmony-ability/crates/plugin-account/` facade crate，迁移调用方
  - 若核心特权: 保留现状，记录为已知决策

- [ ] **4.16** （条件）新建 plugin-account facade crate
  - 仅当 4.15 评估为通用能力时执行
  - 文件: `openharmony-ability/crates/plugin-account/`（新建 crate）
  - 迁移 `HuaweiAccount`/`AccountInfo` 调用到 facade

## 4.7 验证

- [ ] **4.17** 全链路 cargo check
  - ability core: `cargo check --target aarch64-unknown-linux-ohos`
  - tauri core: `cargo check`
  - plugins-workspace: `cargo check --target aarch64-unknown-linux-ohos`

- [ ] **4.18** 设备端功能验证
  - 菜单栏设置/弹出/可见性切换正常
  - statusbar 图标添加/移除/更新正常
  - 窗口管理功能正常
  - 剪贴板功能正常
  - opener 功能正常
  - N8 键名变更后窗口创建正常

- [ ] **4.19** ArkHelper 残留验证
  - grep `get_helper()` 在 window/mod.rs 确认零残留
  - grep `tauri_window_id`/`tauri_transparent` 确认零残留

- [ ] **4.20** ArkHelper.ets 最终状态确认
  - 确认已删除或仅保留通用能力方法
