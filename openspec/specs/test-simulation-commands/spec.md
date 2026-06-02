## ADDED Requirements

### Requirement: simulate_menu_click command
The example app SHALL expose a Tauri command `simulate_menu_click` that programmatically triggers a menu event by pushing into `MENU_EVENT_CHANNEL` — the same channel that both real user clicks (via `emit_menu_event` NAPI) and tray menu clicks (via tray-icon's `send_menu_event`) use.

The command SHALL be OHOS-only (`#[cfg(target_env = "ohos")]`), calling `tauri::ohos::openharmony_ability::menu::send_menu_event(item_id)`. On non-OHOS desktop platforms, `muda::MenuEvent::send()` is `pub(crate)` and inaccessible from the example app, so the command is not available.

This pushes into `MENU_EVENT_CHANNEL`, triggering the full downstream event chain:

```
MENU_EVENT_CHANNEL → muda event listener → MenuEvent::send() → event loop
  → app.on_menu_event() → EventTracker recording
  → plugins.on_event(MenuEvent) → menu plugin MenuChannels.send() → JS action callback
```

The command SHALL accept a single parameter `item_id: String`.

The command SHALL be registered in the `app-menu` plugin's `invoke_handler` alongside existing commands (`popup`, `toggle`, etc.).

The command SHALL be gated by `#[cfg(all(desktop, not(test)))]` consistent with other commands in `menu_plugin.rs`.

Note: This command triggers event dispatch at the `MENU_EVENT_CHANNEL` level. It does NOT execute predefined actions (minimize, maximize, etc.) — those are handled by `PredefinedActionExecutor` in ArkTS in a separate branch of `handleItemClick` that never calls `emitMenuEvent`.

#### Scenario: Simulate click triggers EventTracker recording
- **WHEN** test creates a MenuItem, builds a Menu containing it, clears tracked events, and calls `invoke('simulate_menu_click', { itemId: item.id })`
- **THEN** `get_tracked_menu_events` SHALL return a list containing the item's ID

#### Scenario: Simulate click triggers JS action callback
- **WHEN** test creates a MenuItem with an `action` callback (setting a flag variable), builds a Menu containing it, calls `invoke('simulate_menu_click', { itemId: item.id })`, and waits for the event to propagate
- **THEN** the `action` callback SHALL have been invoked (the flag variable is set to `true`)

#### Scenario: Simulate click on an ID with no matching handler
- **WHEN** test calls `simulate_menu_click` with an ID that has no matching menu item
- **THEN** the command SHALL complete without error

### Requirement: simulate_tray_click command
The example app SHALL expose a Tauri command `simulate_tray_click` that programmatically dispatches a tray icon click event for a given tray ID.

The command SHALL accept parameters `tray_id: String` and `button: String` (where button is `"Left"` or `"Right"`).

The command SHALL look up the tray icon by ID via `app.tray_by_id()` and dispatch a `TrayIconEvent::Click` through the tray's registered event handler.

If the tray is not found, the command SHALL return an error.

#### Scenario: Simulate left-click on tray with event handler
- **WHEN** test creates a TrayIcon with an `action` callback (setting a flag variable) and calls `invoke('simulate_tray_click', { trayId: tray.id, button: 'Left' })`
- **THEN** the `action` callback SHALL have been invoked (the flag variable is set to `true`)

#### Scenario: Simulate click on non-existent tray
- **WHEN** test calls `simulate_tray_click` with a tray ID that does not exist
- **THEN** the command SHALL return an error

### Requirement: Command permissions
Both `simulate_menu_click` and `simulate_tray_click` SHALL be added to `capabilities/run-app.json` so the test runner can invoke them.

#### Scenario: Test runner can invoke simulate commands
- **WHEN** the JS test code calls `invoke('simulate_menu_click', ...)` or `invoke('simulate_tray_click', ...)`
- **THEN** the invoke SHALL succeed without permission errors
