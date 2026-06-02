## Context

The Tauri OHOS adaptation has a working menu and tray system with two layers of tests:
1. **Automated tests** (`menu.ts`: 66 auto, `tray.ts`: 23 auto) — run inside the app, verify API calls succeed
2. **Manual tests** (`menu.ts`: 14 manual) — require human interaction to verify popup display, window state changes, and click event handling

The app already has an `EventTracker` (in `cmd.rs`) that records menu events emitted from Rust to JS, with `get_tracked_menu_events` and `clear_tracked_events` commands. The global `app.on_menu_event` handler in `lib.rs` logs events with format `"global:{item_id}"` and pushes them to the tracker.

### Real menu click event chain on OHOS

The entire chain flows through a **single shared channel** (`MENU_EVENT_CHANNEL`):

```
ArkTS: User clicks bindMenu menu item
  → MenuBarComponent.ets .onClick() / MenuPopup.ets .onClick()
    → getMenuClickHandler(windowId)(item)
      → MenuManager.handleItemClick(item)                 [menu.ets:232]
        ├─ predefined → executor.execute(...)              // ArkTS-side action (separate branch)
        └─ custom ──→ emitMenuEventFn(item.id, windowId)   // NAPI call
                        → emit_menu_event(menu_id, window_id)  [mod.rs:119]
                          → MENU_EVENT_CHANNEL.0.send(menu_id) [mod.rs:120]
                            ↓
                            ↓ (single shared channel)
                            ↓
                          muda start_event_listener() thread [ohos/mod.rs:521]
                            → toggle CHECK_ITEMS (if check item) [ohos/mod.rs:525-529]
                            → MenuEvent::send(MenuEvent{id})     [ohos/mod.rs:531]
                              → handler set by Builder::build()  [app.rs:2368]
                                → proxy.send_event(EventLoopMessage::MenuEvent)
                                  ↓
                                event loop processing          [app.rs:2599]
                                  ├── global_event_listeners    → app.on_menu_event() → EventTracker
                                  ├── per-window event_listeners → window.on_menu_event()
                                  ↓
                                plugins.on_event(RunEvent::MenuEvent) [app.rs:2659]
                                  → menu plugin on_event         [plugin.rs:945]
                                    → MenuChannels.get(id).send(e.id) [plugin.rs:947-948]
                                      → channel.send() → webview.eval(JS) [channel.rs:296]
                                        → JS action callback in webview
```

**Key insight**: EventTracker recording and JS action callback invocation are **not two separate paths** — they are sequential steps in a single chain, both downstream of `MENU_EVENT_CHANNEL.send()`.

### Existing production usage

The openharmony-ability crate already exposes a public Rust function that pushes into the same channel:

```rust
// openharmony-ability/crates/ability/src/menu/mod.rs:100-105
/// Rust API: Send a menu event into the shared channel (for tray-icon to bridge StatusBar clicks).
/// This pushes the menu_id into the same channel that muda's event listener reads from,
/// so tauri's `on_menu_event` chain is triggered for tray menu item clicks.
pub fn send_menu_event(menu_id: String) {
    MENU_EVENT_CHANNEL.0.send(menu_id).ok();
}
```

This function is **already used in production** by the tray-icon crate (`tray-icon/src/platform_impl/ohos/event.rs:85,89`) to bridge StatusBar tray menu clicks into the tauri event system. The pattern is proven.

The function is accessible from the example app via `tauri::ohos::openharmony_ability::menu::send_menu_event()` — `tauri::ohos` is a `#[cfg(target_env = "ohos")]` public re-export of `openharmony_ability` (defined in `crates/tauri/src/ohos.rs:3`).

### Dead code note

`emit_menu_event` (the `#[napi]` function) also calls `dispatch_menu_event(&MenuEvent::new(...))` in addition to `MENU_EVENT_CHANNEL.send()`. However, `dispatch_menu_event` routes to a `GLOBAL_DISPATCHER` that has **no registered listeners** anywhere in the codebase. This is dead code and should not be relied upon.

### Existing infrastructure

The existing in-app test runner (`test-runner.ts`) runs tests sequentially on the device, supports `auto`/`side-effect`/`manual` categories, and writes results to a report file pulled via `hdc`.

## Goals / Non-Goals

**Goals:**
- Add 8 new automated menu test cases alongside existing manual tests, with meaningful assertions on every test (no "just doesn't throw" tests)
- Add 4 new automated tray tests covering the "Full Test Tray" scenario and event chain verification
- Enable **full event chain** testing: simulate click enters through `MENU_EVENT_CHANNEL` (same as real clicks and tray menu clicks), triggering both EventTracker recording and JS action callback invocation
- Keep all changes scoped to the example app — no modifications to core framework crates
- **Preserve all existing manual tests unchanged** — new auto tests supplement, not replace

**Non-Goals:**
- Deleting or modifying any existing manual test cases
- Automating PredefinedMenuItem action tests (minimize/maximize/fullscreen/hide/closeWindow) — these are executed by ArkTS `PredefinedActionExecutor` in a separate branch of `handleItemClick`, before `emitMenuEvent` is called; `send_menu_event` cannot reach this code path
- Adding screenshot/image-comparison based verification
- Modifying the core `crates/tauri/` menu or tray implementation
- Building an external UI testing harness (Playwright, etc.)
- Testing `setAsAppMenu`/`setAsWindowMenu` (not supported on OHOS)

## Decisions

### 1. Event simulation via `send_menu_event()` (pure Rust, no TSFN)

**Decision**: `simulate_menu_click` on OHOS SHALL call `tauri::ohos::openharmony_ability::menu::send_menu_event(item_id)`. This is a one-line function call — no TSFN, no ArkTS handler, no `primaryModule.emitMenuEvent` round-trip.

**Rationale**: `send_menu_event()` pushes into `MENU_EVENT_CHANNEL`, which is the exact same channel that both real menu clicks (via `emit_menu_event` NAPI) and tray menu clicks (via tray-icon crate) write to. Everything downstream of this channel is shared:

```
send_menu_event(item_id)  →  MENU_EVENT_CHANNEL  →  muda listener  →  event loop  →  EventTracker + MenuChannels → JS callback
```

This gives us:
- **Path A** (EventTracker): `app.on_menu_event()` records the event in `EventTracker.menu_events` ✅
- **Path B** (action callback): menu plugin's `on_event` handler looks up the `Channel<MenuId>` by item ID and calls `channel.send()`, which evaluates JS in the webview, invoking the action callback ✅

**Why not TSFN → ArkTS → `emitMenuEvent`**: That approach would work (it enters the same channel), but it adds unnecessary complexity:
- Requires registering a new TSFN callback
- Requires new ArkTS handler code
- Adds a Rust→ArkTS→Rust round-trip with timing concerns
- `send_menu_event()` achieves the identical result with one line of code and zero new infrastructure

**Implementation**:

`simulate_menu_click` is OHOS-only (`#[cfg(target_env = "ohos")]`). On non-OHOS desktop platforms, there is no public API to programmatically trigger the menu event chain — `muda::MenuEvent::send()` is `pub(crate)`, and desktop menu events flow through native OS event loops (Win32/NSMenu/GTK) that cannot be injected from the example app. Tests that depend on `simulate_menu_click` (integration workflows) are therefore OHOS-only. Popup and property tests remain cross-platform.

```rust
// In menu_plugin.rs, gated for OHOS only
#[cfg(target_env = "ohos")]
#[command]
pub fn simulate_menu_click(item_id: String) {
    tauri::ohos::openharmony_ability::menu::send_menu_event(item_id);
}
```

Tests that use this command should be conditionally invoked on OHOS only (e.g., via the test runner or `#[cfg]` gating).

### 2. PredefinedMenuItem action tests: deliberately excluded

**Decision**: Do NOT add automated tests for PredefinedMenuItem actions that have window-side-effects (minimize, maximize, fullscreen, hide, closeWindow).

**Rationale**: Looking at the ArkTS `handleItemClick` implementation (`menu.ets:232`):

```typescript
handleItemClick(item: MenuItemData): void {
    if (item.type === 'predefined' && item.predefinedType) {
      this.executor.execute(item.predefinedType, ...);  // ← predefined action branch (ArkTS)
    } else {
      this.emitMenuEventFn(item.id, ...);               // ← NAPI call → MENU_EVENT_CHANNEL
    }
}
```

Predefined actions are executed in a **separate if-branch** that never calls `emitMenuEvent`. They are executed directly by `PredefinedActionExecutor` in ArkTS, calling system APIs (`window.minimize()`, etc.). `send_menu_event()` only pushes into `MENU_EVENT_CHANNEL` — it cannot trigger code in the other branch.

Asserting `isMinimized()` after `send_menu_event` on a minimize item would always fail. The event dispatch chain is already covered by Regular MenuItem integration tests. The actual window state change is inherently a UI interaction.

### 3. Test file organization: append to existing files, don't create new ones

**Decision**: Add new tests to the existing `menu.ts` and `tray.ts` files. Do not create separate test files.

**Rationale**: The test runner aggregates all tests from these files via `App.svelte`. The existing files already have the imports, utilities (`assert`, `delay`, `TEST_ICON`), and shared state patterns. Adding tests in-place keeps the structure consistent.

### 4. Simulation commands in existing Rust modules

**Decision**: Place `simulate_menu_click` in `menu_plugin.rs` (alongside existing menu test commands) and `simulate_tray_click` in `tray.rs` (alongside `create_tray`).

**Rationale**: Both files are already `#[cfg(all(desktop, not(test)))]` and contain test-infrastructure commands. This keeps related code together and avoids adding new module declarations.

**Registration**: Both commands need to be registered in `lib.rs`'s `invoke_handler` (for tray) or the plugin's `generate_handler!` (for menu), and permissions added to `capabilities/run-app.json`.

### 5. Popup tests assert menu structure integrity

**Decision**: After calling `popup()`, verify `menu.items()` returns the expected count rather than just asserting "no exception".

**Rationale**: A bare "no exception" assertion only proves the IPC call didn't fail. Verifying the menu structure is still intact after popup provides deeper coverage — it confirms the popup didn't corrupt or consume the menu's internal state.

### 6. Tray "Full Test Tray" test mirrors Tray.svelte button

**Decision**: Add a test that creates a tray with all menu item types (Normal + Check + Icon + Separator + Predefined items), equivalent to the "Full Test Tray" button in Tray.svelte.

**Rationale**: This is a gap between the manual UI and automated coverage. The Tray.svelte "Full Test Tray" button creates a tray with ~15 menu items spanning all types. No automated test currently creates a tray with this level of complexity.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| `simulate_menu_click` is OHOS-only; integration tests cannot run on desktop | Accepted. `muda::MenuEvent::send()` is `pub(crate)` and cannot be called from the example app. Integration tests (full_workflow, with_submenu) that depend on simulate_menu_click are OHOS-only. Popup and property tests remain cross-platform. |
| Timing: event flows through a background thread (muda listener) → event loop → webview | Add delay (500ms-1000ms) between `simulate_menu_click` and assertions, matching the pattern already used in tray tests |
| `simulate_tray_click` needs to identify which tray to trigger | Pass the tray ID string; look up via `app.tray_by_id()` in the command |
| New commands add to the capability surface of the example app | These are test-only commands in the example app, not the published framework. No impact on end users. |
| PredefinedMenuItem action tests remain manual-only | Documented in proposal as intentional. The manual tests in `menu.ts` continue to cover these scenarios for human verification. |
