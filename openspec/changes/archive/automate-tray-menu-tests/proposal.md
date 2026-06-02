## Why

The API demo app currently has 14 manual test cases in `menu.ts` that require human interaction to verify. These cover popup menus, predefined menu item actions (minimize/maximize/hide/close/fullscreen/quit), and end-to-end workflows. As the OHOS adaptation matures, this manual test burden is difficult to sustain. We should add new automated tests alongside the existing manual tests to provide automated coverage — without removing or modifying any existing manual test cases.

The real menu click event chain on OHOS flows through a single shared channel:

```
ArkTS handleItemClick(item)
  → primaryModule.emitMenuEvent(itemId)           // NAPI call
    → MENU_EVENT_CHANNEL.send(menu_id)             // shared Rust channel
      → muda event listener thread
        → MenuEvent::send() → proxy → event loop
          ├── app.on_menu_event() → EventTracker   // Path A: event recording
          └── plugins.on_event(MenuEvent)
              → menu plugin MenuChannels.send()    // Path B: JS action callback
```

Both Path A (EventTracker recording) and Path B (JS action callback) are downstream of the same `MENU_EVENT_CHANNEL`. The openharmony-ability crate exposes `send_menu_event(menu_id)` — a **public pure-Rust function** that pushes directly into this channel. This function is already used in production by `tray-icon` for bridging StatusBar menu clicks into the tauri event system. Our `simulate_menu_click` command simply calls this same function, entering the event chain at the exact same point as both real menu clicks and tray menu clicks.

The key constraint is that **PredefinedMenuItem actions (minimize/maximize/fullscreen/hide/closeWindow) are executed directly by the ArkTS `PredefinedActionExecutor`** in a separate branch of `handleItemClick` — **before** `emitMenuEvent` is ever called. These actions never enter `MENU_EVENT_CHANNEL` and therefore cannot be triggered by `send_menu_event`. They remain manual-only.

Therefore, new automated tests focus on:
- **Popup IPC chain**: create menu → popup → verify menu structure intact
- **Full event chain**: create menu item → simulate click → verify **both** `EventTracker` recorded the event **and** JS action callback was invoked
- **Integration workflows**: full lifecycle tests combining popup + event chain + assertion
- **Tray scenarios**: Full Test Tray creation and tray event chain

Additionally, the Tray.svelte page supports a "Full Test Tray" scenario (tray with all menu item types + QuickOperation) that has no automated equivalent in `tray.ts`.

## What Changes

- **Add two Rust test-helper commands** in `examples/api/src-tauri/src/`:
  - `simulate_menu_click(item_id)` — on OHOS (`#[cfg(target_env = "ohos")]`), calls `tauri::ohos::openharmony_ability::menu::send_menu_event(item_id)` which pushes into `MENU_EVENT_CHANNEL`. This triggers the full event chain: muda event listener → event loop → `app.on_menu_event()` (EventTracker) → menu plugin `MenuChannels` (JS action callback). OHOS-only: on non-OHOS desktop platforms, `muda::MenuEvent::send()` is `pub(crate)` and inaccessible from the example app.
  - `simulate_tray_click(tray_id, button)` — dispatches a `TrayIconEvent::Click` to the tray's registered event handler, enabling tray click event chain testing.
- **Add new automated tests** in `menu.ts` alongside existing manual tests (no existing tests are modified or deleted):
  - Popup tests: new `side-effect` tests that call `popup()`, then verify `menu.items()` returns the expected count (Menu.popup, Menu.popup_at, Submenu.popup, Submenu.popup_at, Submenu.nested).
  - Integration tests: new `auto` tests (**OHOS-only**, depend on `simulate_menu_click`) that create menu → popup → simulate click → verify **both** `get_tracked_menu_events` contains the item ID **and** the JS action callback was invoked (full_workflow, with_submenu).
  - About test: new `side-effect` test that creates an about PredefinedMenuItem with metadata, verifies item properties (id, text), and popups a menu containing it.
- **Add new automated tests** in `tray.ts`:
  - `Full Test Tray` equivalent: create tray with all item types (Normal + Check + Icon + Predefined × 10+) — mirrors the Tray.svelte "Full Test Tray" button.
  - Tray + menu integration (**OHOS-only**): create tray with menu → simulate tray click → verify event handler fires.
  - Tray menu item click (**OHOS-only**): create tray with menu items → simulate menu click on a tray menu item → verify event tracked.
- **Update `capabilities/run-app.json`** to include the new test-helper commands.
- **Update `lib.rs`** to register the new commands.

### What is NOT automated (and why)

The following manual tests are intentionally **not** given automated counterparts:

| Manual Test | Reason |
|-------------|--------|
| `PredefinedMenuItem.minimize` | Executed by ArkTS `PredefinedActionExecutor` in a separate branch of `handleItemClick`, before `emitMenuEvent` is called. `send_menu_event` cannot reach this code path. |
| `PredefinedMenuItem.maximize` | Same as above. |
| `PredefinedMenuItem.fullscreen` | Same as above. |
| `PredefinedMenuItem.hide` | Same as above. |
| `PredefinedMenuItem.closeWindow` | Same as above. |
| `PredefinedMenuItem.quit` | Kills the process — incompatible with test runner. |

## Capabilities

### New Capabilities
- `test-simulation-commands`: Rust-side commands (`simulate_menu_click`, `simulate_tray_click`) in the example app. `simulate_menu_click` calls `openharmony_ability::menu::send_menu_event()` — the same function already used by tray-icon for StatusBar menu clicks — entering the event chain at `MENU_EVENT_CHANNEL` and triggering both EventTracker recording and JS action callback dispatch.
- `menu-auto-tests`: New automated menu tests covering popup IPC validation (with menu structure assertions) and integration workflows with full event chain verification (EventTracker + action callback). Added alongside existing manual tests, not replacing them.
- `tray-auto-tests`: New automated tray tests covering full-menu-type tray creation and tray event chain verification.

### Modified Capabilities
_(none — no existing spec-level requirements are changing)_

## Impact

- **Code locations affected**:
  - `examples/api/src-tauri/src/menu_plugin.rs` — add `simulate_menu_click` command
  - `examples/api/src-tauri/src/tray.rs` — add `simulate_tray_click` command
  - `examples/api/src-tauri/src/lib.rs` — register new commands
  - `examples/api/src-tauri/capabilities/run-app.json` — add permissions for new commands
  - `examples/api/src/lib/tests/menu.ts` — add new auto/side-effect tests (existing manual tests unchanged)
  - `examples/api/src/lib/tests/tray.ts` — add new automated tests (existing tests unchanged)
- **APIs/dependencies**: No changes to core framework (`crates/tauri/`) or public APIs. All changes are scoped to the example app. Uses existing public API `tauri::ohos::openharmony_ability::menu::send_menu_event`.
- **Systems**: Tests run inside the app on both Windows and OHOS devices via the existing `test-runner.ts` framework and `run-tests.sh` pipeline.
