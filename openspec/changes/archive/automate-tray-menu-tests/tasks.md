## 1. Rust Simulation Commands

- [x] 1.1 Add `simulate_menu_click` command in `menu_plugin.rs` — OHOS-only (`#[cfg(target_env = "ohos")]`), accept `item_id: String`, call `tauri::ohos::openharmony_ability::menu::send_menu_event(item_id)` (one line — pushes into `MENU_EVENT_CHANNEL`, triggering the full event chain: muda listener → event loop → EventTracker + MenuChannels → JS action callback). Non-OHOS: command not available (`muda::MenuEvent::send` is `pub(crate)`, inaccessible from example app).
- [x] 1.2 Add `simulate_tray_click` command in `tray.rs` — accept `tray_id: String` and `button: String`, look up tray via `app.tray_by_id()`, dispatch `TrayIconEvent::Click` through the tray's event handler; return error if tray not found
- [x] 1.3 Register `simulate_menu_click` in `menu_plugin.rs`'s `init()` function's `generate_handler!` macro
- [x] 1.4 Register `simulate_tray_click` in `lib.rs`'s `invoke_handler`'s `generate_handler!` macro

## 2. Permissions

- [x] 2.1 Add `simulate_menu_click` and `simulate_tray_click` permissions to `capabilities/run-app.json`

## 3. Menu Auto Tests (new tests added alongside existing manual tests)

- [x] 3.1 Add new `Menu.popup_auto` test
- [x] 3.2 Add new `Menu.popup_at_auto` test
- [x] 3.3 Add new `Submenu.popup_auto` test
- [x] 3.4 Add new `Submenu.popup_at_auto` test
- [x] 3.5 Add new `Submenu.nested_auto` test
- [x] 3.6 Add new `PredefinedMenuItem.about_exec_auto` test
- [x] 3.7 Add new `Menu.full_workflow_auto` test
- [x] 3.8 Add new `Menu.with_submenu_auto` test

## 4. Tray Auto Tests (new tests added alongside existing tests)

- [x] 4.1 Add `TrayIcon.full_test_tray` test
- [x] 4.2 Add `TrayIcon.tray_event_chain` test
- [x] 4.3 Add `TrayIcon.tray_menu_item_click` test
- [x] 4.4 Add `TrayIcon.tray_multi_item_menu` test

## 5. Verification

- [x] 5.1 Build the example app on OHOS target and verify no compilation errors
- [x] 5.2 Build the example app on Windows/macOS and verify no compilation errors (simulate commands not compiled on non-OHOS)
- [x] 5.3 Run the full test suite on OHOS device (via `run-tests.sh`) and verify all new auto tests pass (including integration tests), and all existing manual tests remain unchanged and functional
