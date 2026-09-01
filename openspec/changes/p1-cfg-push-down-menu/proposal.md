## Why

The Tauri menu/tray wrapper layer (~89 sites across 7 files) uses paired `#[cfg(target_env = "ohos")]` / `#[cfg(not(target_env = "ohos"))]` branches to work around a deadlock: the `run_main_thread!` / `run_item_main_thread!` macros bundle a closure with `run_on_main_thread` + `rx.recv()` blocking, which deadlocks on OHOS (Chrome_IOThread ↔ ArkTS main thread, per ohos-constraints §1.2). Each OHOS branch duplicates the non-OHOS logic minus the macro wrap, plus an OHOS-only `auto_refresh_menubar` call for mutations. This is the largest `cfg` scatter in the OHOS adaptation and the canonical maintainability problem flagged in reference §1.6.

## What Changes

- **Macro passthrough on OHOS**: `run_main_thread!` and `run_item_main_thread!` gain an `#[cfg(target_env = "ohos")]` branch that executes the closure directly on the calling thread and returns its result, skipping the `run_on_main_thread` + `rx.recv()` blocking path. Non-OHOS behavior is byte-for-byte unchanged.
- **Collapse paired branches to single macro call**: ~57 of 89 sites (all getters, constructors, and every tray/mod.rs method) become a single unconditional macro invocation — the macro itself selects the passthrough on OHOS. OHOS-only post-call `auto_refresh_menubar` is not needed for these.
- **Retain single-sided refresh for menu mutations**: the ~32 menu mutation methods (setText/setEnabled/setAccelerator/setChecked/setIcon/add/remove/append/insert/prepend) keep a one-line `#[cfg(target_env = "ohos")] super::auto_refresh_menubar(&self.app_handle())` after the (now single) macro call. This downgrades them from "paired branch divergence" to "single OHOS-only post-call".
- **tray/mod.rs largely normalized**: 10 paired branches collapse to single macro calls. **Audit correction**: 3 single-sided OHOS-only sites remain (kept, not collapsed): `quick_operation`/`set_quick_operation` (OHOS StatusBar popup API, no non-OHOS counterpart) and `set_icon_as_template` (three-way macos/ohos/else split, *simplifies* to `cfg(any(macos,ohos))` single macro + no-op but retains the cfg). See audit doc §P1 差异 1.
- No public API change. No behavior change on any platform (OHOS menu/tray behavior is preserved bit-for-bit; only the code path to reach it changes).

## Capabilities

### New Capabilities
- `menu-thread-dispatch-passthrough`: OHOS-aware execution of menu/tray main-thread closures — the macro dispatch layer that decides whether to block on `run_on_main_thread`+`recv` (non-OHOS) or execute inline (OHOS). Covers the passthrough contract and the refresh hook for mutations.

### Modified Capabilities
- None. `menu-auto-tests` and `tray-auto-tests` are exercised by this change but have no requirement-level behavior delta (menu mutation/refresh semantics and tray method semantics are unchanged; only the internal dispatch path the tests route through changes). Per openspec guidance, a capability is only MODIFIED when a requirement changes — so they are not listed here.

## Impact

- **Code**: `crates/tauri/src/lib.rs` (run_main_thread! macro), `crates/tauri/src/menu/mod.rs` (run_item_main_thread! macro + auto_refresh_menubar), `crates/tauri/src/menu/{submenu,predefined,icon,menu,check,normal}.rs` (~78 paired sites), `crates/tauri/src/tray/mod.rs` (10 sites).
- **APIs**: none public. `run_main_thread!`/`run_item_main_thread!` are `pub(crate)`.
- **Dependencies**: none.
- **Risk**: the passthrough changes the thread on which OHOS closures execute (from scheduled on Chrome_IOThread to the calling thread, typically an ArkTS callback chain). OHOS constraints §1.2 state TrayIcon is Sync+Send with no main-thread restriction, and muda's OHOS backend handles thread safety via TSFN internally — so inline execution is safe, but this must be device-verified for menu mutations (JSON re-serialize + TSFN push from the calling thread).
- **Platform isolation**: compliant — the passthrough is inside `cfg(target_env = "ohos")`; non-OHOS code path untouched.
