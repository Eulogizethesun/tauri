## ADDED Requirements

### Requirement: Per-window rect storage in openharmony-ability

openharmony-ability SHALL store window rect per window identity (i64 windowId)
rather than a single shared field. The main window uses key `0`; Float sub-windows
use their `NEXT_WINDOW_ID`-allocated id. A query for an unregistered windowId SHALL
return `Rect::default()` (0,0,0,0), preserving the existing uninitialized-rect
semantics.

#### Scenario: Main window rect isolated from sub-window changes
- **WHEN** a Float sub-window (windowId=1) changes its rect via windowRectChange
- **AND** the main window (windowId=0) rect is queried via `window_rect_for(0)`
- **THEN** the returned rect SHALL be the main window's own rect, unaffected by the
  sub-window change

#### Scenario: Unregistered windowId returns default rect
- **WHEN** `window_rect_for(999)` is called for a windowId with no recorded callback
- **THEN** the returned rect SHALL be `Rect { left: 0, top: 0, width: 0, height: 0 }`

#### Scenario: Sub-window rect retrieved by its own key
- **WHEN** a Float sub-window (windowId=2) has received a windowRectChange callback
- **AND** `window_rect_for(2)` is called
- **THEN** the returned rect SHALL equal the rect from that sub-window's most recent
  callback

### Requirement: windowRectChange callback carries window identity

The `window_rect_change` NAPI closure (lifecycle.rs) SHALL read a `windowId` field
from the options object passed by ArkTS. ArkTS SHALL wrap the native
`window.RectChangeOptions` into an object containing `windowId`, `reason`, and
`rect` before invoking the closure. The main window registration
(NativeAbility.ets) SHALL set `windowId: 0`; the component window registration
(BridgeHost.ets) SHALL set `windowId: 0` (hardcoded — this path is always the
main window, see DefaultXComponent.ets:92-97 early return for sub-windows).

#### Scenario: Main window callback carries windowId 0
- **WHEN** the main window emits a windowRectChange event
- **THEN** the Rust `window_rect_change` closure SHALL read `windowId == 0` from
  the options object and store the rect under key `0`

### Requirement: Sub-window windowRectChange registration at createSubWindow

Float sub-windows do NOT pass through `attachComponent` (DefaultXComponent.ets:92-97
returns early). Therefore, sub-window `windowRectChange` registration SHALL be added in
`WindowManager.createSubWindow` after the `win` instance is obtained (post
`this.windows.set(windowId, ...)`). The handler SHALL wrap options with the sub-window's
`windowId` before invoking the Rust callback. Sub-window destruction SHALL call
`win.off("windowRectChange", handler)`. The main window's second registration at
BridgeHost.ets:631 (component window) SHALL wrap with `windowId: 0` (hardcoded — this
path is always the main window). No `attachComponent` signature change is needed.

#### Scenario: Float sub-window registered for windowRectChange at creation
- **WHEN** `WindowManager.createSubWindow` succeeds in obtaining `win` for windowId=2
- **THEN** `win.on("windowRectChange", ...)` SHALL be registered with a handler that wraps
  `windowId: 2` into the options
- **AND** the handler reference SHALL be stored for later `off()` cleanup

#### Scenario: Sub-window rect stored under its own key
- **WHEN** the sub-window (windowId=2) emits a windowRectChange event
- **THEN** the Rust closure SHALL read `windowId == 2` and store the rect under key `2`

#### Scenario: Main window component window second registration uses windowId 0
- **WHEN** BridgeHost.attachComponentWindow registers windowRectChange on the main window's
  componentWindow
- **THEN** the options SHALL carry `windowId: 0` (hardcoded, not from HostComponentState)

#### Scenario: Sub-window cleanup unregisters windowRectChange
- **WHEN** a Float sub-window is destroyed via WindowManager.destroyWindow
- **THEN** `win.off("windowRectChange", handler)` SHALL be called

### Requirement: tao reads per-window rect by window_id

tao OHOS `inner_size()`, `outer_position()`, `inner_position()`, and `outer_size()`
SHALL read the rect for `self.window_id.unwrap_or(0)` via the per-window query API,
not the shared single field. These calls SHALL be non-blocking cache reads (no
`run_on_main_thread + recv`).

#### Scenario: Sub-window inner_size reads its own rect
- **WHEN** a Float sub-window (window_id=Some(1)) calls `inner_size()`
- **THEN** it SHALL return the dimensions of the rect stored under key `1`, not the
  most-recently-changed window's rect

#### Scenario: Main window outer_position unaffected by sub-window drag
- **WHEN** a sub-window is being dragged (its rect updating rapidly)
- **AND** the main window calls `outer_position()`
- **THEN** the returned position SHALL be the main window's own rect position (key 0)

### Requirement: window-state plugin OHOS save refreshes size and position unconditionally

On OHOS, `save_window_state` SHALL refresh both `state.width`/`state.height` (via
`inner_size()`) and `state.x`/`state.y` (via `outer_position()`) for every tracked
window before serializing, regardless of the `StateFlags` passed. The refresh SHALL
NOT call `is_maximized()`/`is_minimized()` (those remain skipped due to blocking
NAPI). `maximized`/`minimized` fields retain their event-driven cache values.

**Phased gate**: Until per-window rect storage (Phase 2) is in effect, the refresh
SHALL be gated to `window.label() == "main"` only — because `window_rect` is a shared
single field and unconditionally refreshing all windows would write the main window's
rect into every sub-window's state. This gate SHALL be removed in Phase 2 once
per-window rect queries are available.

#### Scenario: Save after resize persists current size (Phase 2+, gate removed)
- **WHEN** the user resizes the main window and immediately calls save_window_state
  (before any Resized event fires)
- **THEN** the persisted state SHALL contain the current inner_size at save time
  (read from the live per-window rect cache), not a stale event-cache value

#### Scenario: Save with SIZE-only flags still persists correct position
- **WHEN** save_window_state is called with `StateFlags::SIZE` only
- **THEN** the persisted state SHALL contain the current position (refreshed from
  outer_position), not the stale (0,0) creation default

#### Scenario: Phase 1 gate limits refresh to main window
- **WHEN** Phase 1 is deployed (per-window rect not yet available)
- **AND** save_window_state is called
- **THEN** only the window with `label() == "main"` SHALL be refreshed
- **AND** sub-window states SHALL retain their event-cache values (no live refresh)

#### Scenario: Position persisted after drag without Moved event
- **WHEN** the user drags the main window (OHOS emits ContentRectChange, never Moved)
  and saves
- **THEN** the persisted position SHALL equal the dragged-to position (read from
  outer_position live cache), not (0,0)

### Requirement: Restore applies saved size and position on restart

On OHOS, `RunEvent::Ready` SHALL restore window state with `state_flags = all`
(including SIZE and POSITION). The restored size and position SHALL match the values
persisted by the last save_window_state call.

#### Scenario: Main window restores correct geometry after restart
- **WHEN** the app is restarted after saving a non-default size and position
- **THEN** the main window SHALL be restored to the saved size and position, not
  760x570 at (0,0)

#### Scenario: Multi-window restore preserves each window geometry
- **WHEN** the app is restarted after saving state for the main window and a
  sub-window
- **THEN** each window SHALL restore to its own saved size and position

### Requirement: OHOS event routing uses real window identity

tao OHOS `WindowId` SHALL carry the i64 window id (not be a ZST). `MainEvent::ContentRectChange`
and `MainEvent::WindowResize` SHALL carry the originating window's windowId. All three
`WindowResize` construction points (lifecycle.rs window_resize closure,
lifecycle.rs window_rect_change closure, and xcomponent.rs:139 on_surface_changed)
SHALL propagate windowId. tao run_loop SHALL construct `window::WindowId(event_window_id)`
for these events. tauri-runtime-wry SHALL populate `window_id_map` with the real OHOS
window id at window creation so Resized/Moved events route to the correct WindowWrapper.

#### Scenario: Sub-window resize event routes to sub-window
- **WHEN** a Float sub-window (window_id=1) resizes
- **THEN** the resulting `WindowEvent::Resized` SHALL carry `window_id == 1`
- **AND** tauri-runtime-wry SHALL dispatch it to the sub-window's WindowWrapper, not
  the main window's

#### Scenario: Main window events still route to main window
- **WHEN** the main window (window_id=0) resizes
- **THEN** the `WindowEvent::Resized` SHALL carry `window_id == 0` and route to the
  main window's WindowWrapper

### Requirement: No impact on non-OHOS platforms

All changes SHALL be isolated behind `cfg(target_env = "ohos")`. Linux dependencies
that must be excluded SHALL use `cfg(all(target_os = "linux", not(target_env = "ohos")))`.
Windows, macOS, and true-Linux code paths and behavior SHALL be unchanged.

#### Scenario: Windows build unaffected
- **WHEN** the project is built for Windows
- **THEN** no OHOS-specific code SHALL compile into the Windows binary
- **AND** window-state plugin behavior on Windows SHALL be identical to before
