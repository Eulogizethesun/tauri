## Requirements

### Menu Channel 迁移

#### Requirement: menu channel 迁移到 muda OHOS 适配层
The `MENU_EVENT_CHANNEL`, `menu_event_receiver()`, and `send_menu_event()` SHALL be moved from `plugin-menu/src/lib.rs` to `muda/src/platform_impl/ohos/mod.rs`. The plugin-menu crate SHALL no longer expose consumer-facing channel API.

#### Requirement: plugin-menu 保留 bridge 对接
The plugin-menu crate SHALL retain the `on_main_thread_event` handler for `menu-click` event decoding and the `impl_bridge_napi_type!` type contract, but SHALL push decoded events to the muda-side channel instead of a plugin-local channel.

#### Scenario: menu 事件从 bridge 到 muda channel
- **WHEN** the ArkTS bridge dispatches a `menu-click` event via `on_main_thread_event`
- **THEN** plugin-menu decodes the event into a `MenuEvent`
- **AND** the decoded event is pushed to the channel defined in `muda/src/platform_impl/ohos/mod.rs`
- **AND** muda's event listener thread receives the event via `muda::platform_impl::ohos::menu_event_receiver()`

#### Scenario: plugin-menu 不再暴露 channel API
- **WHEN** a consumer crate (e.g., muda) needs to receive menu events
- **THEN** it imports `menu_event_receiver` from its own OHOS platform implementation
- **AND** `plugin_menu::menu_event_receiver` no longer exists in the public API

### Statusbar Channel 迁移

#### Requirement: statusbar channel 迁移到 tray-icon OHOS 适配层
The `ICON_CLICK_CHANNEL`, `MENU_CLICK_CHANNEL`, `icon_click_receiver()`, and `menu_click_receiver()` SHALL be moved from `plugin-statusbar/src/lib.rs` to `tray-icon/src/platform_impl/ohos/event.rs`. The plugin-statusbar crate SHALL no longer expose consumer-facing channel API.

#### Scenario: statusbar icon click 事件到 tray-icon channel
- **WHEN** the ArkTS bridge dispatches a statusbar icon click event
- **THEN** the event is pushed to the channel defined in `tray-icon/src/platform_impl/ohos/event.rs`
- **AND** tray-icon's event-forward thread receives the event via `tray_icon::platform_impl::ohos::icon_click_receiver()`

#### Scenario: plugin-statusbar 不再暴露 channel API
- **WHEN** a consumer crate (e.g., tray-icon) needs to receive statusbar events
- **THEN** it imports `icon_click_receiver`/`menu_click_receiver` from its own OHOS platform implementation
- **AND** `plugin_statusbar::icon_click_receiver`/`menu_click_receiver` no longer exist in the public API

### Plugin Crate Channel API 删除

#### Requirement: plugin crate 删除 consumer-facing channel API
The plugin-menu and plugin-statusbar crates SHALL delete all consumer-facing channel API functions (`menu_event_receiver`, `send_menu_event`, `icon_click_receiver`, `menu_click_receiver`) and associated channel definitions. The crates SHALL retain only bridge对接 and type contract code.

#### Scenario: 删除后编译验证
- **WHEN** the channel API is removed from plugin-menu and plugin-statusbar
- **THEN** `cargo check` for muda and tray-icon succeeds (they use their own OHOS adapter channels)
- **AND** `cargo check` for plugin-menu and plugin-statusbar succeeds (no dangling references)
