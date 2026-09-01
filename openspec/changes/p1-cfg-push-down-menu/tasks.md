# Tasks: P1 — cfg push-down for menu/tray via macro passthrough

## 1. Macro dispatch arms

- [x] 1.1 Add `#[cfg(target_env = "ohos")]` inline-dispatch arm to `run_main_thread!` in `crates/tauri/src/lib.rs`; move existing body under `#[cfg(not(target_env = "ohos"))]`
- [x] 1.2 Add `#[cfg(target_env = "ohos")]` inline-dispatch arm to `run_item_main_thread!` in `crates/tauri/src/menu/mod.rs`; move existing body under `#[cfg(not(target_env = "ohos"))]`
- [x] 1.3 Verify `auto_refresh_menubar` at `menu/mod.rs:~785` remains `#[cfg(all(target_env = "ohos", desktop))]` (unchanged)

## 2. tray/mod.rs — full normalization (10 sites, no refresh)

- [x] 2.1 Collapse all 10 paired-branch methods in `crates/tauri/src/tray/mod.rs` to a single unconditional macro call each, removing all residual `#[cfg(target_env = "ohos")]` from the method bodies

## 3. menu/* — getters & constructors (collapse to single macro call)

- [x] 3.1 `crates/tauri/src/menu/submenu.rs` — collapse getter/constructor paired branches (~15 sites) to single macro call
- [x] 3.2 `crates/tauri/src/menu/predefined.rs` — collapse getter/constructor paired branches (~14 sites) to single macro call
- [x] 3.3 `crates/tauri/src/menu/icon.rs` — collapse getter/constructor paired branches (~7 sites) to single macro call
- [x] 3.4 `crates/tauri/src/menu/menu.rs` — collapse getter/constructor paired branches (~5 sites) to single macro call
- [x] 3.5 `crates/tauri/src/menu/check.rs` — collapse getter/constructor paired branches (~5 sites) to single macro call
- [x] 3.6 `crates/tauri/src/menu/normal.rs` — collapse getter/constructor paired branches (~3 sites) to single macro call

## 4. menu/* — mutations (single macro call + one-sided refresh)

- [x] 4.1 `submenu.rs` mutation methods (~7 sites) — collapse to single macro call + `#[cfg(target_env = "ohos")] super::auto_refresh_menubar(&self.app_handle())`
- [x] 4.2 `predefined.rs` mutation methods (~6 sites) — same pattern
- [x] 4.3 `icon.rs` mutation methods (~4 sites) — same pattern
- [x] 4.4 `menu.rs` mutation methods (~5 sites) — same pattern
- [x] 4.5 `check.rs` mutation methods (~4 sites) — same pattern
- [x] 4.6 `normal.rs` mutation methods (~4 sites) — same pattern

## 5. Verify — non-OHOS untouched

- [x] 5.1 `cargo check -p tauri` on Windows host — 0 errors, 0 new warnings
- [x] 5.2 Grep `crates/tauri/src/menu/` and `tray/mod.rs` to confirm no surviving `#[cfg(not(target_env = "ohos"))]` paired branches (only one-sided OHOS refresh hooks remain)

## 6. Verify — OHOS build (ohos-build skill)

- [ ] 6.1 OHOS desktop build — `entry_desktop-default-signed.hap` produced, EXIT=0
- [ ] 6.2 OHOS mobile build — `entry_mobile-default-signed.hap` produced, EXIT=0

## 7. Verify — device (ohos-build skill)

- [ ] 7.1 Install desktop HAP, run `menu-auto-tests` suite — all menu popup/structure/nested-submenu/click-chain scenarios pass
- [ ] 7.2 Run `tray-auto-tests` suite — full-tray creation, click event chain, tray-menu-item click, integration all pass
- [ ] 7.3 Spot-check menu mutations on device: setText/setEnabled/setChecked/add/remove visibly update the pushed menu
