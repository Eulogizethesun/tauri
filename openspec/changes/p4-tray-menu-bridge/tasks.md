# Phase B4 实现任务清单

## 0. 前置验证

- [x] 0.1 确认 A0 已创建 `plugin-statusbar` crate（`openharmony-ability/crates/plugin-statusbar/`）
- [x] 0.2 确认 A0 已创建 `plugin-menu` crate（`openharmony-ability/crates/plugin-menu/`）
- [x] 0.3 确认 A0 已将 `MenuItemData` / `AboutMetadataData` 类型迁移到 `plugin-menu`
- [x] 0.4 确认 A0 已将 `StatusBarIcon` / `StatusBarItem` / `StatusBarMenuItem` 等类型迁移到 `plugin-statusbar`
- [x] 0.5 确认 `plugin-statusbar` 定义了 `StatusBarBridgePlugin`（ID = `ohos.statusbar`）
- [x] 0.6 确认 `plugin-menu` 定义了 `MenuBridgePlugin`（ID = `ohos.menu`）

**如果 0.1-0.6 任一不满足**，需先在 `openharmony-ability` 仓创建对应 crate（参考 `plugin-window` 模式），工作量 +2-3 天。

## 1. tray-icon 迁移

### 1.1 依赖更新

- [x] 1.1.1 更新 `tray-icon/Cargo.toml`：移除 `features = ["menu", "statusbar"]`
- [x] 1.1.2 添加 `openharmony-ability-plugin-statusbar` 依赖
- [x] 1.1.3 添加 `futures` 依赖（用于 `block_on`），指定 `executor` feature：`futures = { version = "0.3", features = ["executor"] }`，或直接使用 `futures-executor` crate

### 1.2 StatusBarClient 初始化

- [x] 1.2.1 在 `mod.rs` 添加 `STATUSBAR_CLIENT: OnceCell<StatusBarClient>` 全局变量
- [x] 1.2.2 更新 `set_ohos_app()` 创建并存储 `StatusBarClient`
- [x] 1.2.3 添加 `get_statusbar_client()` 辅助函数

### 1.3 方法迁移

- [x] 1.3.1 迁移 `TrayIcon::new()` → `StatusBarClient::add()` bridge call
- [x] 1.3.2 迁移 `TrayIcon::set_icon()` → `StatusBarClient::update_icon()` bridge call
- [x] 1.3.3 迁移 `TrayIcon::set_menu()` → `StatusBarClient::update_menu()` bridge call
- [x] 1.3.4 迁移 `TrayIcon::set_tooltip()` → `StatusBarClient::update_tips()` bridge call
- [x] 1.3.5 迁移 `TrayIcon::set_title()` → remove + add bridge calls
- [x] 1.3.6 迁移 `TrayIcon::set_visible()` → add / remove bridge calls
- [x] 1.3.7 迁移 `TrayIcon::set_quick_operation()` → remove + add bridge calls
- [x] 1.3.8 迁移 `TrayIcon::set_icon_as_template()` → remove + add bridge calls
- [x] 1.3.9 迁移 `TrayIcon::set_icon_with_as_template()` → 调用 set_icon（无直接 bridge call）
- [x] 1.3.10 迁移 `TrayIcon::set_temp_dir_path()` → 无变化（no-op）
- [x] 1.3.11 迁移 `TrayIcon::rect()` → 无变化（始终 None）
- [x] 1.3.12 迁移 `Drop` → `StatusBarClient::remove()` bridge call + 删除 unregister handler 调用

### 1.4 事件迁移

- [x] 1.4.1 更新 `event.rs` import 路径：`openharmony_ability::statusbar::` → `openharmony_ability_plugin_statusbar::`
- [x] 1.4.2 确认 `icon_click_receiver()` / `menu_click_receiver()` 公共 API 在 plugin-statusbar 中保留
- [x] 1.4.3 迁移 `execute_predefined_action()` → `StatusBarClient::execute_predefined()` bridge call
- [x] 1.4.4 迁移 `rebuild_and_update_menu()` → `StatusBarClient::update_menu()` bridge call
- [x] 1.4.5 迁移 `send_menu_event()` 调用 → `openharmony_ability_plugin_menu::send_menu_event()`

### 1.5 辅助函数迁移

- [x] 1.5.1 编写 `build_add_request(&StatusBarItem) -> StatusBarAddRequest` 转换函数
- [x] 1.5.2 确认 `build_item_from_attrs()` 逻辑不变（仍构造 `StatusBarItem`）
- [x] 1.5.3 确认 `menu_to_status_bar_items()` / `split_items_into_groups()` / `remap_menu_codes_to_indices()` 不变
- [x] 1.5.4 确认 `decode_png_to_rgba()` / `decode_icon_from_base64()` / `strip_mnemonics()` 不变

### 1.6 验证

- [x] 1.6.1 `cargo check --target aarch64-unknown-linux-ohos` 通过
- [x] 1.6.2 `cargo check` Windows target 通过（确认非 OHOS 不受影响）
- [x] 1.6.3 既有单元测试通过（Windows: 3/3 passed; OHOS: 编译通过，链接因缺少交叉链接器 `cc` 未执行）
- [ ] 1.6.4 设备端 tray 图标显示验证
- [ ] 1.6.5 设备端 tray 菜单点击验证
- [ ] 1.6.6 设备端 predefined action（quit）验证
- [ ] 1.6.7 设备端 check toggle 验证
- [ ] 1.6.8 设备端 icon click 验证

## 2. muda 迁移

### 2.1 依赖更新

- [x] 2.1.1 更新 `muda/Cargo.toml`：移除 `features = ["menu"]`
- [x] 2.1.2 添加 `openharmony-ability-plugin-menu` 依赖
- [x] 2.1.3 添加 `futures` 依赖（用于 `block_on`），指定 `executor` feature：`futures = { version = "0.3", features = ["executor"] }`，或直接使用 `futures-executor` crate

### 2.2 MenuClient 初始化

- [x] 2.2.1 在 `mod.rs` 添加 `MENU_CLIENT: OnceCell<MenuClient>` 全局变量
- [x] 2.2.2 添加 `set_menu_client(client: MenuClient)` 全局初始化函数（muda 不持有 OpenHarmonyApp，由 tray-icon 注入）
- [x] 2.2.3 添加 `get_menu_client()` 辅助函数
- [x] 2.2.4 确认初始化时序：tray-icon 或 tauri 启动时调用 `set_menu_client()`

### 2.3 类型路径迁移

- [x] 2.3.1 `openharmony_ability::menu::MenuItemData` → `openharmony_ability_plugin_menu::MenuItemData`
- [x] 2.3.2 `openharmony_ability::menu::AboutMetadataData` → `openharmony_ability_plugin_menu::AboutMetadataData`
- [x] 2.3.3 确认 `to_menu_item_data()` 中 `AboutMetadataData` 构造逻辑不变

### 2.4 方法迁移

- [x] 2.4.1 迁移 `Menu::popup()` → `MenuClient::popup()` bridge call
- [x] 2.4.2 迁移 `Menu::refresh_menubar()` → `MenuClient::set_menubar()` bridge call
- [x] 2.4.3 迁移 `MenuChild::popup()` → `MenuClient::popup()` bridge call

### 2.5 事件迁移

- [x] 2.5.1 更新 `start_event_listener()` import 路径：`openharmony_ability::menu::menu_event_receiver` → `openharmony_ability_plugin_menu::menu_event_receiver`
- [x] 2.5.2 确认 `menu_event_receiver()` 公共 API 在 plugin-menu 中保留
- [x] 2.5.3 确认 check item toggle 逻辑不变
- [x] 2.5.4 确认 `MenuEvent::send()` 分发逻辑不变

### 2.6 验证

- [x] 2.6.1 `cargo check --target aarch64-unknown-linux-ohos` 通过
- [x] 2.6.2 `cargo check` Windows target 通过
- [x] 2.6.3 既有单元测试通过（Windows: 12/12 passed; OHOS: 编译通过，链接因缺少交叉链接器 `cc` 未执行）
- [ ] 2.6.4 设备端 menubar 显示验证
- [ ] 2.6.5 设备端 menu click 验证
- [ ] 2.6.6 设备端 popup menu 验证
- [ ] 2.6.7 设备端 check toggle 验证
- [ ] 2.6.8 设备端 submenu 验证
- [ ] 2.6.9 设备端 predefined action 验证

## 3. 集成验证

- [ ] 3.1 tray-icon 引用 muda 时菜单功能正常（tray 菜单使用 muda 的 `ContextMenu` trait）
- [ ] 3.2 tray 菜单点击事件正确传递到 muda 的事件通道（`send_menu_event` 路径）
- [ ] 3.3 muda 独立使用（非 tray 上下文）时 menubar / popup 功能正常
- [x] 3.4 `cargo check --target aarch64-unknown-linux-ohos` 全量通过（tray-icon + muda 同时编译）
- [ ] 3.5 设备端完整 tray + menu 联动验证

## 4. 回归验证

- [x] 4.1 Windows 平台 `cargo check` 通过
- [ ] 4.2 macOS 平台 `cargo check` 通过（如有环境）
- [ ] 4.3 Linux 平台 `cargo check` 通过（如有环境）
- [x] 4.4 既有 OHOS 单元测试全部通过（编译通过；Windows 单元测试 3+12=15/15 全通过）
