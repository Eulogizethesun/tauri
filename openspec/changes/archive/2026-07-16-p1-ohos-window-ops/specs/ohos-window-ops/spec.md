## ADDED Requirements

### Requirement: Window position can be set on OHOS
The system SHALL implement `Window::set_outer_position` on OHOS to move the window by calling `@kit.ArkUI/window` `moveWindowTo(x, y)` through the `openharmony-ability` NAPI bridge. The operation is fire-and-forget (returns immediately after dispatching).

#### Scenario: set_position moves the OHOS window
- **WHEN** `tauri::Window::set_position(PhysicalPosition { x, y })` is called on OHOS
- **THEN** the OHOS window is moved to `(x, y)` via `win.moveWindowTo(x, y)`

#### Scenario: set_position does not block the caller
- **WHEN** `set_position` is invoked
- **THEN** the Rust call returns without awaiting the OHOS async `moveWindowTo` Promise (fire-and-forget)

### Requirement: Window size can be set on OHOS
The system SHALL implement `Window::set_inner_size` on OHOS to resize the window by calling `@kit.ArkUI/window` `resize(width, height)` through the `openharmony-ability` NAPI bridge (fire-and-forget).

#### Scenario: set_size resizes the OHOS window
- **WHEN** `tauri::Window::set_size(PhysicalSize { width, height })` is called on OHOS
- **THEN** the OHOS window is resized via `win.resize(width, height)`

### Requirement: Window maximize state can be set and queried on OHOS
The system SHALL implement `Window::set_maximized` and `Window::is_maximized` on OHOS. `set_maximized(true)` SHALL call `win.maximize(window.MaximizePresentation.EXIT_IMMERSIVE)` (API 12, public; `EXIT_IMMERSIVE` yields a true MAXIMIZE state — the default `ENTER_IMMERSIVE` enters FULL_SCREEN, which would make `getWindowStatus()` return FULL_SCREEN instead of MAXIMIZE and break `is_maximized`; device-test to confirm). `set_maximized(false)` SHALL call `recover_window()` (API 7+, public; transitions MAXIMIZE/FULL_SCREEN → FLOATING), exposed via the openharmony-ability `recover_window` NAPI bridge. (`restore()` only restores from MINIMIZE, not MAXIMIZE, so it cannot be used for unmaximize; `setWindowMode` is system-only.) `is_maximized` SHALL synchronously return `true` iff `win.getWindowStatus() === window.WindowStatusType.MAXIMIZE` (API 12).

#### Scenario: maximize then query returns true
- **WHEN** `set_maximized(true)` is called with EXIT_IMMERSIVE and the window reaches maximized state (getWindowStatus === MAXIMIZE)
- **THEN** a subsequent `is_maximized()` returns `true`

#### Scenario: unmaximize via set_maximized(false) recovers to FLOATING
- **WHEN** `set_maximized(false)` is called on a maximized window
- **THEN** it calls `recover_window()` (API 7+, public), transitioning the window from MAXIMIZE/FULL_SCREEN to FLOATING

#### Scenario: is_maximized returns false for non-maximized window
- **WHEN** `getWindowStatus()` is not MAXIMIZE (UNDEFINED/FULL_SCREEN/FLOATING/SPLIT_SCREEN/MINIMIZE)
- **THEN** `is_maximized()` returns `false`

### Requirement: Window minimize state can be set and queried on OHOS
The system SHALL implement `Window::set_minimized` and `Window::is_minimized` on OHOS. `set_minimized(true)` SHALL call `win.minimize()` (API 11, public, not deprecated). `set_minimized(false)` SHALL call `win.restore()` (API 14) via version guard — on API 12 it is a no-op+warn (`showWindow()` cannot restore a minimized main window; `setWindowMode` is system-only). `is_minimized` SHALL synchronously return `true` iff `win.getWindowStatus() === window.WindowStatusType.MINIMIZE` (API 12).

#### Scenario: minimize then query returns true
- **WHEN** `set_minimized(true)` is called and the window reaches minimized state (getWindowStatus === MINIMIZE)
- **THEN** a subsequent `is_minimized()` returns `true`

#### Scenario: is_minimized returns false for non-minimized window
- **WHEN** `getWindowStatus()` is not MINIMIZE
- **THEN** `is_minimized()` returns `false`

### Requirement: Window visibility can be controlled on OHOS with hide workaround
The system SHALL implement `Window::set_visible` on OHOS. `set_visible(false)` SHALL call `win.minimize()` (API 11, hide workaround; OHOS has no direct hide API). `set_visible(true)` SHALL call `win.restore()` (API 14, version-guarded) + `win.showWindow()` (API 9); on API 12 restore is unavailable → showWindow best-effort (may not restore a minimized main window) + warn. Documented side effect: `set_visible(false)` (minimize) causes `is_minimized()` to return `true` (getWindowStatus === MINIMIZE), unlike Windows/macOS hide which does not affect minimized state.

#### Scenario: show a hidden window
- **WHEN** `set_visible(true)` is called
- **THEN** on API ≥14 `win.restore()` + `win.showWindow()` are invoked; on API 12 `win.showWindow()` best-effort + warn

#### Scenario: hide uses minimize workaround
- **WHEN** `set_visible(false)` is called
- **THEN** the window is minimized via `win.minimize()` (documented workaround; OHOS has no direct hide API)

### Requirement: Window operations are isolated to OHOS
All new OHOS window-operation code SHALL be gated by `cfg(target_env = "ohos")` and MUST NOT alter the behavior of Windows, macOS, or Linux builds. The tao methods replaced (previously no-op on OHOS) SHALL only affect the OHOS compile path.

#### Scenario: non-OHOS builds unaffected
- **WHEN** tao is built for Windows/macOS/Linux
- **THEN** the existing platform implementations remain unchanged (no OHOS code compiled in)

### Requirement: Window operations route through openharmony-ability
All OHOS window operations in tao SHALL be performed via the `openharmony-ability` NAPI bridge (Rust fn → ArkTS method → `@kit.ArkUI/window`). tao MUST NOT call ArkTS/`@kit.ArkUI/window` directly.

#### Scenario: tao calls bridge, not ArkTS directly
- **WHEN** a tao OHOS Window method (set_position/set_size/set_maximized/set_minimized/set_visible/is_maximized/is_minimized) is invoked
- **THEN** it calls the corresponding `openharmony-ability::window::*` function, which calls the ArkTS method, which calls `@kit.ArkUI/window`

### Requirement: window-state plugin restores window geometry on OHOS
With the above operations implemented, `tauri-plugin-window-state` SHALL persist and restore window position, size, maximized, minimized, visible, and decorated state across app restarts on OHOS desktop (the plugin itself is platform-agnostic and requires no code change, only enablement).

#### Scenario: window state restored after restart
- **WHEN** the app is restarted after the window was moved/resized/maximized
- **THEN** window-state restores the saved position, size, and maximized state on launch (decorated already worked; position/size/maximized newly working)

#### Scenario: is_maximized/is_minimized reflect real state on save
- **WHEN** window-state saves state (on close/window event)
- **THEN** `is_maximized()`/`is_minimized()` return the actual window state (via `getWindowStatus()` === WindowStatusType.MAXIMIZE/MINIMIZE), not a constant `false`
