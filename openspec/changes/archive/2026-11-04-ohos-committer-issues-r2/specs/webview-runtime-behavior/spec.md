# webview-runtime-behavior — ohos-committer-issues-r2

## ADDED Requirements

### Requirement: SetAutoResize re-arm on OHOS

The tauri-runtime-wry webview auto-resize machinery SHALL re-arm on OHOS when `set_auto_resize(true)` is issued after a prior disable — restoring parked rates or re-deriving them for fully-explicit geometry. When rates cannot be derived, it SHALL emit a specific error log naming the webview and the remedy, never a silent success.

#### Scenario: disable then enable restores tracking

- **WHEN** a webview created with explicit bounds has `set_auto_resize(false)` then `set_auto_resize(true)` issued, and the window is subsequently resized
- **THEN** the webview's bounds track the window resize (the Resized handler re-fires set_bounds with restored rates)

#### Scenario: runtime enable on fully-explicit geometry arms tracking

- **WHEN** a webview created with explicit bounds but without auto-resize has `set_auto_resize(true)` issued at runtime, and the window is subsequently resized
- **THEN** rates are derived from the webview's cached bounds relative to the window size, and the webview tracks the resize

#### Scenario: natural webview follows the container

- **WHEN** a webview created with natural layout has `set_auto_resize(true)` issued and the window is resized
- **THEN** the webview continues to follow its ArkTS container and no error is emitted

#### Scenario: non-derivable corner is loud

- **WHEN** a webview whose geometry is only partially explicit (never fully specified since creation, no parked rates) has `set_auto_resize(true)` issued
- **THEN** a specific error log naming the webview and the remedy (issue a full set_bounds first) is emitted; no silent success

### Requirement: No registry residue on window creation failure

The tauri-runtime-wry window creation path on OHOS SHALL remove the main-window registry entry for a window id when webview creation for that window fails, so a failed `create_window` leaves no residual registry entry.

#### Scenario: create_webview failure removes the entry

- **WHEN** `create_window` proceeds past the registry record and `create_webview` then fails
- **THEN** the registry no longer contains the failed window's id after the error is returned

### Requirement: Examples Window page handles main-window rejections

The examples/api Window page SHALL catch and report rejections from main-window `hide()` and the four decoration setter calls (resizable/maximizable/minimizable/closable) through the page's message surface, producing zero unhandled promise rejections on the OHOS desktop form factor.

#### Scenario: hide and toggles produce zero unhandled rejections

- **WHEN** the Window page is opened on the OHOS desktop form factor with the main window as the selected target, and hide is clicked and the four setters are toggled
- **THEN** every rejection is surfaced as a reported message and the console shows zero unhandled promise rejections

### Requirement: Devtools flag reflects open failure

wry's OHOS devtools state SHALL report `is_devtools_open()` as false for a webview whose `open_devtools` call failed.

#### Scenario: failed open reports closed

- **WHEN** `open_devtools` is invoked and the open fails
- **THEN** `is_devtools_open()` for that webview returns false

### Requirement: Ability-side UT properties

The openharmony-ability host tests SHALL pin (a) that the decoration-flags facade performs no Rust-side main-window pre-gate, discriminated by error identity rather than source-text markers, and (b) that the `Key::from_name` name table round-trips for every Key variant.

#### Scenario: helper-form pre-gate regression is caught

- **WHEN** a Rust-side main-window pre-gate is introduced in the facade in any form (direct comparison, helper function, or matches! pattern) and the host test for the facade runs
- **THEN** the test fails, because the returned error no longer originates from the napi host-stub path

#### Scenario: name table edit is caught

- **WHEN** any `Key` variant's name-table row is renamed or removed and the round-trip test runs
- **THEN** the test fails for that variant
