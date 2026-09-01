## Requirements

### MenuPlugin.ets 创建

#### Requirement: 新建 MenuPlugin.ets ArkTS bridge 插件
A new `MenuPlugin.ets` SHALL be created in `openharmony-ability/plugins/menu/src/main/ets/` implementing the `ohos.menu` bridge plugin, following the `WindowPlugin.ets` pattern. It SHALL handle `set-menubar`, `popup`, `set-menubar-visible`, and `execute-predefined` actions.

#### Requirement: MenuPlugin 注册到 EntryAbility
The `MenuPlugin` SHALL be registered in `EntryAbility.bridgePlugins` alongside existing plugins.

#### Scenario: set-menubar action
- **WHEN** the Rust facade calls `bridgeInvoke("ohos.menu", "set-menubar", ...)` with menu JSON
- **THEN** MenuPlugin.ets receives the menu JSON
- **AND** sets the window menubar accordingly
- **AND** returns success/failure via `pluginContext.invokeAsync`

#### Scenario: popup action
- **WHEN** the Rust facade calls `bridgeInvoke("ohos.menu", "popup", ...)` with coordinates
- **THEN** MenuPlugin.ets displays a popup context menu at the specified coordinates

### StatusbarPlugin.ets 创建

#### Requirement: 新建 StatusbarPlugin.ets ArkTS bridge 插件
A new `StatusbarPlugin.ets` SHALL be created in `openharmony-ability/plugins/statusbar/src/main/ets/` implementing the `ohos.statusbar` bridge plugin. It SHALL handle `add`, `remove`, `update-icon`, `update-menu`, and `update-tips` actions.

#### Requirement: StatusbarPlugin 注册到 EntryAbility
The `StatusbarPlugin` SHALL be registered in `EntryAbility.bridgePlugins`.

#### Scenario: add action
- **WHEN** the Rust facade calls `bridgeInvoke("ohos.statusbar", "add", ...)` with icon + menu data
- **THEN** StatusbarPlugin.ets creates a status bar icon with the specified menu

#### Scenario: remove action
- **WHEN** the Rust facade calls `bridgeInvoke("ohos.statusbar", "remove", ...)`
- **THEN** StatusbarPlugin.ets removes the status bar icon

### 延迟 Consumer 迁移

#### Requirement: N13 tauri core window 迁移到 MenuClient facade
The `tauri/crates/tauri/src/window/mod.rs` SHALL migrate `set_menubar_visible`/`set_menu_json`/`is_menubar_visible` calls (7 sites) from direct ArkHelper calls to the `MenuClient` plugin facade, after MenuPlugin.ets is in place.

#### Requirement: N4 tauri core menu 迁移到 menu bridge facade
The `tauri/crates/tauri/src/menu/plugin.rs` SHALL migrate `start_popup_forwarder` to the menu bridge plugin facade.

#### Scenario: N13 迁移后无直调核心 crate
- **WHEN** `tauri/crates/tauri/src/window/mod.rs` is migrated
- **THEN** all 7 `set_menubar_visible`/`set_menu_json`/`is_menubar_visible` calls go through `MenuClient` facade
- **AND** no direct `openharmony_ability::menu::` calls remain

#### Scenario: N4 迁移后 popup forwarder 走 bridge
- **WHEN** `start_popup_forwarder` is migrated
- **THEN** the menu popup mechanism uses the menu bridge plugin facade
- **AND** the old `start_popup_forwarder` API is deleted

### ArkHelper 调用链删除

#### Requirement: window/mod.rs 迁移到 bridge
The `openharmony-ability/crates/ability/src/window/mod.rs` module (20+ `get_helper()` calls) SHALL be migrated to the `plugin-window` bridge facade. Any methods not covered by the facade SHALL have corresponding facade actions added.

#### Requirement: clipboard/mod.rs + opener.rs 迁移到 bridge
The `clipboard/mod.rs` and `opener.rs` modules SHALL be migrated to their respective plugin bridge facades (`plugin-clipboard` and `plugin-url`).

#### Requirement: menu 旧 API 删除
The old menu API (`set_menu_json`/`is_menubar_visible`/`start_popup_forwarder`/`MENU_CHANNEL`/`MENU_CALLBACK`) SHALL be deleted after consumer migration.

#### Requirement: StatusBarUtils.ets 解耦 ArkHelper 类型
The `StatusBarUtils.ets` SHALL remove `import { ArkHelper }` and `helperRef: ArkHelper | null` type dependencies, replacing with bridge plugin types or native OHOS types.

#### Requirement: ArkHelper.ets 删除或缩减
The `ArkHelper.ets` SHALL be deleted, or reduced to only general-purpose capability methods (e.g., `checkCanIUse`, `getWindowAvoidArea`) with all Tauri-shaped methods migrated out.

#### Scenario: window/mod.rs 全部迁移
- **WHEN** `window/mod.rs` is migrated to plugin-window facade
- **THEN** all `get_helper()` calls are replaced with `WindowClient` facade calls
- **AND** any missing facade actions are added to plugin-window
- **AND** the old `window/mod.rs` code is deleted or moved to `_legacy/`

#### Scenario: ArkHelper.ets 最终状态
- **WHEN** all Tauri-shaped methods are migrated out of ArkHelper
- **THEN** ArkHelper.ets is either deleted or contains only general-purpose capability methods
- **AND** no Tauri-specific method remains in ArkHelper

### N8 键名泛化

#### Requirement: NativeAbility.ets Tauri 硬编码键名泛化
The `NativeAbility.ets` SHALL rename `tauri_window_id` to `ohos_window_id` and `tauri_transparent` to `ohos_transparent` in want parameter key reads. The Rust side SHALL update the corresponding key names if it passes these parameters.

#### Scenario: want 参数键名中性化
- **WHEN** `NativeAbility.ets` reads want parameters for window creation
- **THEN** it reads `ohos_window_id` (not `tauri_window_id`)
- **AND** it reads `ohos_transparent` (not `tauri_transparent`)
- **AND** the Rust side passes these parameters with the new key names
