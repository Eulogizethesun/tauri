## ADDED Requirements

### Requirement: Full Test Tray automated test
The test suite SHALL include an automated test that creates a tray icon with a comprehensive menu containing all supported menu item types, mirroring the "Full Test Tray" button in Tray.svelte.

The menu SHALL include: Normal MenuItem, CheckMenuItem, IconMenuItem, PredefinedMenuItem (Separator, Copy, Cut, Paste, Undo, Redo, Minimize, Maximize, Fullscreen, CloseWindow, Hide, Quit).

The test SHALL verify the tray is created successfully and all menu items are associated.

#### Scenario: Create tray with all menu item types
- **WHEN** test creates a Menu with Normal + Check + Icon + Separator + Copy + Cut + Paste + Undo + Redo + Minimize + Maximize + Fullscreen + CloseWindow + Hide + Quit items, and passes it to `TrayIcon.new()`
- **THEN** the tray SHALL be created with a non-empty ID
- **AND** `TrayIcon.getById()` SHALL find the tray

#### Scenario: Full Test Tray cleanup
- **WHEN** the Full Test Tray test completes
- **THEN** the tray SHALL be removed via `TrayIcon.removeById()` to avoid leaking state

### Requirement: Tray event chain automated test
The test suite SHALL include an automated test that verifies the tray icon click event chain using the `simulate_tray_click` command.

#### Scenario: Tray icon click event is dispatched
- **WHEN** test creates a TrayIcon with an `action` callback, calls `simulate_tray_click` with the tray's ID
- **THEN** the tray's event handler SHALL have been invoked (verified via a flag set by the callback)

### Requirement: Tray menu item click automated test
The test suite SHALL include an automated test that verifies clicking a tray menu item triggers the action callback through the event chain.

#### Scenario: Tray menu item click fires action callback
- **WHEN** test creates a TrayIcon with a Menu containing a MenuItem with an action callback, calls `simulate_menu_click` on the menu item's ID
- **THEN** `get_tracked_menu_events` SHALL contain the menu item's ID

### Requirement: Tray + menu integration test
The test suite SHALL include an automated test that creates a tray with a multi-item menu and verifies all menu items are correctly associated with the tray.

#### Scenario: Tray with multi-item menu
- **WHEN** test creates a Menu with 5+ items of different types and associates it with a TrayIcon via `TrayIcon.new({ menu })`
- **THEN** the tray SHALL be created successfully
- **AND** `TrayIcon.getById()` SHALL find the tray
- **AND** `TrayIcon.removeById()` SHALL clean up successfully
