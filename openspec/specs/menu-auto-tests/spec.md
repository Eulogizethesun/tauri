## ADDED Requirements

### Requirement: Menu.popup automated test
The test suite SHALL include an automated test for `Menu.popup()` that creates a menu with items, calls `popup()`, and verifies the menu structure remains intact afterward.

#### Scenario: Menu.popup preserves menu structure
- **WHEN** test creates a Menu with 3 MenuItems and calls `menu.popup()`
- **THEN** the call SHALL complete without exception
- **AND** `menu.items()` SHALL return 3 items after popup

### Requirement: Menu.popup_at automated test
The test suite SHALL include an automated test for `Menu.popup({ x, y })` that pops up at specified coordinates and verifies menu structure.

#### Scenario: Menu.popup_at succeeds at given coordinates and preserves structure
- **WHEN** test creates a Menu with 2 items and calls `menu.popup({ x: 100, y: 200 })`
- **THEN** the call SHALL complete without exception
- **AND** `menu.items()` SHALL return 2 items after popup

### Requirement: Submenu.popup automated tests
The test suite SHALL include automated tests for `Submenu.popup()` and `Submenu.popup_at()` that verify popup succeeds and submenu structure is preserved.

#### Scenario: Submenu.popup preserves structure
- **WHEN** test creates a Submenu with 2 items and calls `submenu.popup()`
- **THEN** the call SHALL complete without exception
- **AND** `submenu.items()` SHALL return 2 items after popup

#### Scenario: Submenu.popup_at preserves structure at coordinates
- **WHEN** test creates a Submenu with 2 items and calls `submenu.popup({ x: 100, y: 200 })`
- **THEN** the call SHALL complete without exception
- **AND** `submenu.items()` SHALL return 2 items after popup

### Requirement: Nested submenu popup automated test
The test suite SHALL include an automated test that creates a nested submenu hierarchy and popups it, verifying both levels exist and are structurally intact.

#### Scenario: Nested submenu popup preserves hierarchy
- **WHEN** test creates a parent Submenu containing a nested child Submenu (with its own items), and calls popup on the parent
- **THEN** the call SHALL complete without exception
- **AND** `parentSubmenu.items()` SHALL contain the nested child Submenu
- **AND** `childSubmenu.items()` SHALL return its items

### Requirement: Menu integration workflow automated tests
The test suite SHALL include automated integration tests that verify the full menu lifecycle: create items → build menu → popup → simulate click → verify both EventTracker and action callback. Because `simulate_menu_click` calls `send_menu_event()` which pushes into `MENU_EVENT_CHANNEL` (the same channel as real clicks), the entire downstream chain is triggered: muda event listener → event loop → `app.on_menu_event()` (EventTracker) → menu plugin `MenuChannels.send()` (JS action callback).

#### Scenario: Full workflow verifies EventTracker and action callback
- **WHEN** test creates a MenuItem with an `action` callback (setting a flag), builds a Menu containing it, calls `popup()`, clears tracked events, then calls `simulate_menu_click` on the item, and waits for propagation
- **THEN** the `action` callback SHALL have been invoked (flag is set to `true`)
- **AND** `get_tracked_menu_events` SHALL contain the item's ID

#### Scenario: Submenu integration workflow verifies EventTracker and action callback
- **WHEN** test creates a Menu with a Submenu containing MenuItems (each with an `action` callback), calls `popup()`, clears tracked events, and calls `simulate_menu_click` on a submenu item, and waits for propagation
- **THEN** the submenu item's `action` callback SHALL have been invoked
- **AND** `get_tracked_menu_events` SHALL contain the submenu item's ID

### Requirement: PredefinedMenuItem.about_exec automated test
The test suite SHALL include an automated test that creates an about PredefinedMenuItem with metadata, verifies item properties, and popups a menu containing it.

#### Scenario: About item creation and popup with property verification
- **WHEN** test creates an about PredefinedMenuItem with metadata (name, version)
- **THEN** `item.id` SHALL be a non-empty string
- **AND** `item.text()` SHALL return a non-empty string
- **AND** creating a Menu containing this item and calling `menu.popup()` SHALL complete without exception
- **AND** `menu.items()` SHALL contain the about item after popup
