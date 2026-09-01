## ADDED Requirements

### Requirement: 旧 menu channel API 标记 deprecated
`menu/mod.rs` 中的旧 channel API（`MENU_EVENT_CHANNEL`、`menu_event_receiver`、`send_menu_event`、`popup_request_receiver`、`menu_request_receiver`、`start_popup_forwarder`、`start_menu_forwarder`、`popup_context_menu`、`set_menu_json`）SHALL 添加 `#[deprecated(note = "Use plugin-menu facade instead")]` 标注。`lib.rs` 中对应的 re-export SHALL 添加 `#[allow(deprecated)]` 以避免 self-deprecation warning。

#### Scenario: 旧 menu API 编译产生 deprecation warning
- **WHEN** 外部代码调用 `openharmony_ability::menu_event_receiver()`
- **THEN** 编译器产生 deprecation warning，消息包含 "Use plugin-menu facade instead"

#### Scenario: 旧 menu API 仍可正常使用
- **WHEN** 现有消费者（muda、tray-icon）编译
- **THEN** 编译通过，仅产生 deprecation warning，不产生 error

### Requirement: 旧 statusbar channel API 标记 deprecated
`statusbar/event.rs` 中的旧 channel API（`ICON_CLICK_CHANNEL`、`MENU_CLICK_CHANNEL`、`icon_click_receiver`、`menu_click_receiver`、`icon_click_sender`、`menu_click_sender`、`register_icon_click_handler`、`register_menu_click_handler`）SHALL 添加 `#[deprecated(note = "Use plugin-statusbar facade instead")]` 标注。

#### Scenario: 旧 statusbar API 编译产生 deprecation warning
- **WHEN** 外部代码调用 `openharmony_ability::statusbar::icon_click_receiver()`
- **THEN** 编译器产生 deprecation warning，消息包含 "Use plugin-statusbar facade instead"

### Requirement: 删除永不编译的 helper/webview.rs 死代码
`crates/ability/src/helper/webview.rs`（970 行）SHALL 被删除。`helper/mod.rs:13-14` 的 `#[cfg(feature = "webview")] mod webview;` 声明和 `:25-26` 的 `#[cfg(feature = "webview")] pub use webview::*;` 声明 SHALL 被移除。

#### Scenario: helper/webview.rs 删除后编译通过
- **WHEN** `helper/webview.rs` 被删除且 `helper/mod.rs` 的 cfg 声明被移除
- **THEN** `cargo check --target aarch64-unknown-linux-ohos` 编译通过，无新增 warning

#### Scenario: 无其他代码依赖 helper/webview.rs
- **WHEN** 搜索整个 workspace 中对 `helper::webview` 的引用
- **THEN** 结果为零（因为 feature `webview` 未定义，模块永不编译）

### Requirement: 移除空壳 drag_and_drop feature
`ability/Cargo.toml:10` 的 `drag_and_drop = []` feature 定义 SHALL 被移除。`wry/Cargo.toml` 中 `features = ["drag_and_drop"]` 启用 SHALL 被移除。

#### Scenario: 移除 drag_and_drop feature 后编译通过
- **WHEN** `ability/Cargo.toml` 和 `wry/Cargo.toml` 中的 `drag_and_drop` 被移除
- **THEN** 两个 crate 的 `cargo check` 均通过，无新增 warning

#### Scenario: wry OHOS 代码无 drag_and_drop cfg gate
- **WHEN** 搜索 wry 源码中 `cfg(feature = "drag_and_drop")` 的引用
- **THEN** 结果为零（feature 仅 gate 死代码，wry 自身代码不使用此 feature）
