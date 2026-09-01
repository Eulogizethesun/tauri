## ADDED Requirements

### Requirement: deep-link consumer 迁移到 DeepLinkClient
`plugins-workspace/plugins/deep-link/src/lib.rs:246` SHALL 从 `openharmony_ability::take_initial_want_uri()` 迁移到 `DeepLinkClient` facade。

#### Scenario: 冷启动 URI 获取
- **WHEN** deep-link 插件在 OHOS 上初始化
- **THEN** 通过 `DeepLinkClient` facade 获取初始 want URI，不再直调核心 crate

### Requirement: single-instance consumer 迁移到 DeepLinkClient
`plugins-workspace/plugins/single-instance/src/platform_impl/ohos.rs:27` SHALL 从 `openharmony_ability::take_want_parameters()` 迁移到 `DeepLinkClient` facade。

#### Scenario: 温启动参数获取
- **WHEN** single-instance 插件在 OHOS 上处理新 want
- **THEN** 通过 `DeepLinkClient` facade 获取 want 参数

### Requirement: autostart consumer 迁移到 AutostartClient
`plugins-workspace/plugins/autostart/src/lib.rs:16` SHALL 从 `openharmony_ability::AutostartManager` 迁移到 `AutostartClient` facade。

#### Scenario: 自启动状态管理
- **WHEN** autostart 插件在 OHOS 上查询/设置自启动状态
- **THEN** 通过 `AutostartClient` facade 操作

### Requirement: clipboard-manager consumer 迁移到 ClipboardClient
`plugins-workspace/plugins/clipboard-manager/src/desktop.rs:176` SHALL 从 `openharmony_ability::clipboard::clipboard_write_image` 迁移到 `ClipboardClient` facade。

#### Scenario: 剪贴板图片写入
- **WHEN** clipboard-manager 在 OHOS 上写入图片到剪贴板
- **THEN** 通过 `ClipboardClient` facade 操作

### Requirement: opener consumer 迁移到 OpenerClient
`plugins-workspace/plugins/opener/src/open.rs:42,79` 和 `reveal_item_in_dir.rs:92` SHALL 从 `openharmony_ability::open_with_system` / `reveal_in_dir` 迁移到对应 facade。

#### Scenario: 系统打开和目录揭示
- **WHEN** opener 在 OHOS 上打开文件或揭示目录
- **THEN** 通过 facade 操作

### Requirement: window-vibrancy consumer 迁移到 WindowClient
`window-vibrancy/src/ohos.rs` 的 7 处调用 SHALL 从 `openharmony_ability::set_window_blur` / `set_window_background_color` 迁移到 `WindowClient` facade。

#### Scenario: 窗口模糊和背景色设置
- **WHEN** window-vibrancy 在 OHOS 上设置窗口模糊或背景色
- **THEN** 通过 `WindowClient::set_window_blur()` / `set_window_background_color()` 操作

### Requirement: tauri-runtime-wry consumer 迁移到 WindowClient
`tauri/crates/tauri-runtime-wry/src/lib.rs:2527,2555,4839` SHALL 从 `openharmony_ability::window::{focus_window, set_window_focusable, destroy_window}` 迁移到 `WindowClient` facade。

#### Scenario: 窗口操作
- **WHEN** tauri-runtime-wry 在 OHOS 上执行窗口聚焦/可聚焦/销毁操作
- **THEN** 通过 `WindowClient` facade 操作

### Requirement: tao consumer 迁移到 WindowClient
`tao/src/platform_impl/ohos/mod.rs:11-13` SHALL 从 `openharmony_ability::window::{create_os_window, set_window_touchable}` 迁移到 `WindowClient` facade。

#### Scenario: 窗口创建和触摸穿透
- **WHEN** tao 在 OHOS 上创建窗口或设置触摸穿透
- **THEN** 通过 `WindowClient::create_os_window()` / `set_window_touchable()` 操作

### Requirement: tauri core window consumer 迁移到 MenuClient
`tauri/crates/tauri/src/window/mod.rs` 的 7 处调用 SHALL 从 `openharmony_ability::menu::{set_menubar_visible, set_menu_json, is_menubar_visible}` 迁移到 `MenuClient` facade。

#### Scenario: 菜单栏操作
- **WHEN** tauri core 在 OHOS 上操作菜单栏可见性或内容
- **THEN** 通过 `MenuClient` facade 操作

### Requirement: tauri core menu popup forwarder 迁移
`tauri/crates/tauri/src/menu/plugin.rs:936` SHALL 从 `openharmony_ability::start_popup_forwarder()` 迁移到 menu bridge plugin facade。

#### Scenario: 菜单弹出转发
- **WHEN** tauri core 在 OHOS 上启动菜单弹出转发
- **THEN** 通过 menu bridge plugin facade 操作

### Requirement: global-shortcut 全套 API 迁移
`plugins-workspace/plugins/global-shortcut/src/lib.rs` 的 ~20 处调用 SHALL 从旧 API（`init_forwarder` / `register_shortcut` / `unregister_shortcut` / `unregister_all_shortcuts` / `shortcut_event_receiver` / `ShortcutModifier` / `ShortcutKey` / `ShortcutState`）全套迁移到 `GlobalShortcutClient` facade，含 `ShortcutModifier`/`ShortcutKey` enum → `Vec<String>`/`&str` 适配层。

#### Scenario: 快捷键注册
- **WHEN** global-shortcut 在 OHOS 上注册 `Ctrl+A` 快捷键
- **THEN** 通过 `GlobalShortcutClient::register(id, &["Control"], "A")` 操作
- **THEN** 内部将 `ShortcutModifier::Control` 转为 `"Control"`，`ShortcutKey::KeyA` 转为 `"A"`

#### Scenario: 快捷键事件接收
- **WHEN** ArkTS 侧触发快捷键事件
- **THEN** 通过 `GlobalShortcutClient::event_receiver()` 接收，替代旧的 `shortcut_event_receiver()`

### Requirement: 删除旧 API
Phase 1 全部 consumer 迁移完成后，SHALL 删除以下旧 API：
- `take_initial_want_uri()` + `INITIAL_WANT_URI`（`app.rs`）
- `take_want_parameters()`（`app.rs`）
- `init_forwarder()` + `DISPATCHER`（`global_shortcut/mod.rs`）
- `lib.rs` 中对应的 re-export

#### Scenario: 旧 API 删除后编译通过
- **WHEN** 全部 consumer 已迁移到 facade 且旧 API 已删除
- **THEN** `cargo check` 全 workspace 通过，无 unresolved import 错误

#### Scenario: 无遗留旧 API 引用
- **WHEN** 搜索 workspace 中 `take_initial_want_uri` / `take_want_parameters` / `init_forwarder` / `DISPATCHER`
- **THEN** 结果为零
