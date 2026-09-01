# Post-Implementation Audit: cfg push-down refactor (P1 + P2 + P3)

Audited after coding + Windows `cargo check` (0 errors) + OHOS `cargo check --target aarch64-unknown-linux-ohos` from the `examples/api` context (correct, OHOS-patched tauri/tao/wry dep tree).

Dimensions: spec 符合性 · API 正确性 · 约束遵守 · 平台隔离.

## A. Spec 符合性

### P1 — menu-thread-dispatch-passthrough
- OHOS macro inline dispatch arm added to both `run_main_thread!` (lib.rs) and `run_item_main_thread!` (menu/mod.rs). ✓
- Non-OHOS arm byte-for-byte unchanged (Windows host compiles identically to pre-refactor). ✓
- Call sites collapsed to platform-neutral single macro calls (getters/constructors/mutations). ✓
- Mutations retain OHOS-only `auto_refresh_menubar` refresh hook (single-sided `#[cfg(target_env="ohos")]`). ✓
- `auto_refresh_menubar` itself unchanged (`#[cfg(all(target_env="ohos", desktop))]`). ✓ (iron rule #3)

### P2 — clipboard-write-image-async-backend
- OHOS `write_image` async, calls `openharmony_ability::clipboard::clipboard_write_image(...).await`. ✓
- desktop arboard `write_image` async + uniform `(rgba, w, h)` triple signature. ✓
- mobile `write_image` async triple, returns `Err(PlatformNotSupported)`. ✓
- `commands.rs::write_image` pure dispatcher; extracts `(rgba, w, h)` in block scope (drops !Send `MutexGuard`) before `.await`. ✓

### P3 — opener-async-platform-backend + opener-ohos-platform
- `open_url`/`open_path` free fns async + OHOS arms (verbatim ports of the deleted command branches). ✓
- `reveal_items_in_dir` free fn async + new `#[cfg(target_env="ohos")] mod imp` (async). ✓
- Inherent methods `Opener::{open_url,open_path,reveal_item_in_dir,reveal_items_in_dir}` async; desktop arm `#[cfg(any(desktop, target_env="ohos"))]`. ✓
- `commands.rs` pure async dispatcher (no `cfg(ohos)`, no `openharmony_ability`, no `url::`). ✓
- **Audit item D**: dispatch `any(...)` cfg in `reveal_items_in_dir` adds `target_env = "ohos"` so OHOS hits the new `mod imp` (not the `UnsupportedPlatform` fallback). ✓

## B. API 正确性

### Behavior-divergent branches correctly left paired (NOT collapsed)
- `set_accelerator` (check.rs, icon.rs, normal.rs): OHOS discards the muda `Result` (`let _ =`) + refreshes; non-OHOS propagates via `?.map_err(Into::into)`. Collapsing to one form would change a side. Left paired. ✓
- `popup`/`popup_inner` (menu.rs, submenu.rs): OHOS calls `muda::popup(x,y,window_id)`; non-OHOS calls `show_context_menu_for_{nsview,gtk_window,hwnd}`. Left paired. ✓
- `append_items`/`prepend_items`/`insert_items` (menu.rs, submenu.rs): structurally different (OHOS direct muda loop + single refresh; non-OHOS delegates to per-item methods). Left paired. ✓
- tray `build()` (tray/mod.rs:413): hand-written OHOS-inline vs non-OHOS channel dispatch (same deadlock-avoidance pattern as the macro, out of scope). ✓

### tray_icon setters — return-type audit (path dep `tray-icon` 0.24.0)
- `Result<()>`-returning (`set_icon`, `set_tooltip`, `set_visible`) → collapsed with `?.map_err(Into::into)` (propagate). ✓
- `()`-returning (`set_menu`, `set_title`, `set_temp_dir_path`, `set_icon_as_template`, `set_show_menu_on_left_click`) → collapsed with `?;` + `Ok(())` (no `Result` to discard). ✓
- **No silent discard** — the `?;` pattern is used ONLY on `()`-returning methods. The `set_accelerator` mistake class (discard vs propagate disagreement) does NOT occur in tray.

### Type-inference fixes (statement-position `Into::into`)
- submenu.rs / menu.rs mutations (append/prepend/insert/remove): `.map_err(Into::into)?` in statement position lost the return-position type inference the original relied on → E0282. Fixed with explicit turbofish `.map_err(Into::<crate::Error>::into)?`. Preserves propagation. ✓

### OHOS macro arm error-type pinning (CRITICAL — caught by OHOS check, invisible on Windows)
- The OHOS arm `Ok(f())` / `Ok(f(self_))` did NOT pin the outer `Result`'s error type. When the closure returns a `Result` (muda/tray_icon), the outer error type `E` was ambiguous → E0282 (61 errors on the OHOS target; Windows skipped the OHOS arm so passed).
- **Fix**: `Ok::<_, crate::Error>(f())` / `Ok::<_, crate::Error>(f(self_))` pins `E = crate::Error`, matching the non-OHOS arm which explicitly produces `Result<T, crate::Error>` via `.map_err(|_| crate::Error::FailedToReceiveMessage)`.
- After fix: OHOS `cargo check` Finished (0 errors). ✓

### `open` crate not broken on OHOS
- The `open` crate (v5.3.2) depends only on `dunce`/`is-wsl`/`libc`/`pathdiff` (pure Rust, no gtk) — it compiles on OHOS. The design's premise ("open crate broken on OHOS") was about runtime (`xdg-open` absent), not compile. The `pub(crate) fn open` helper + its `OsStr` import are `#[cfg(not(target_env="ohos"))]`-gated (OHOS uses `openharmony_ability` at runtime, never `open`). No `Cargo.toml` change needed. ✓

## C. 约束遵守 (OHOS iron rules)

1. **openharmony-ability is the only ArkTS bridge** — all OHOS syscalls (clipboard write_image, open_with_system, reveal_in_dir) route through `openharmony_ability`. No direct ArkTS/NAPI in tauri/tray-icon/muda/opener. ✓
2. **Don't affect other platforms** — all OHOS code `cfg(target_env="ohos")`-isolated; non-OHOS byte-for-byte unchanged (Windows host 0 errors). `zbus` excluded on OHOS (opener error.rs). `open` helper gated `not(ohos)`. ✓
3. **OHOS_DEVICE_TYPE determines form** — `auto_refresh_menubar` is `cfg(all(target_env="ohos", desktop))`; `Opener` desktop arm `cfg(any(desktop, target_env="ohos"))` covers both OHOS desktop (`cfg(desktop)`) and OHOS mobile (`cfg(mobile)`, routed to the desktop/free-fn arm, not the Android/iOS mobile-plugin arm which stays `cfg(all(mobile, not(target_env="ohos")))`). ✓

## D. 平台隔离

- Standalone `cargo check --target ohos -p tauri-plugin-opener` from `plugins-workspace` fails on `gobject-sys`/`gio-sys` (gtk-rs) — **pre-existing dep-tree artifact**: plugins-workspace resolves `tauri` to a non-OHOS-patched version (tao/wry gtk not excluded on OHOS). NOT a regression (Cargo.toml unchanged) and NOT representative of the real app build. The correct verification is the `examples/api` context (OHOS-patched path deps) — which **passes** (0 errors). ✓
- No OHOS code leaks into non-OHOS paths (grep-verified: commands.rs has no `cfg(ohos)`/`openharmony_ability`/`url::`; menu/ has only legitimate behavior-divergent `cfg(not(ohos))` arms + macro definition arm + single-sided refresh hooks). ✓

## Verification matrix

| Check | P1 tauri | P2 clipboard | P3 opener |
|---|---|---|---|
| Windows `cargo check` (non-OHOS arms) | 0 errors ✓ | 0 errors ✓ | 0 errors ✓ |
| OHOS `cargo check` (OHOS arms, api-app dep tree) | 0 errors ✓ | 0 errors ✓ | 0 errors ✓ |
| Grep: no leaked `cfg(ohos)` in commands | n/a | ✓ | ✓ |
| Grep: OHOS arms contain `openharmony_ability`+`url::` | n/a | ✓ | ✓ |

## Remaining (not code-verification — needs ohos-build skill + device)

- P1 6.1/6.2: full HAP build (desktop + mobile) — `cargo tauri ohos build`.
- P1 7.1–7.3: device menu/tray test suites.
- P2 6.1/6.2/6.3: HAP build + device write_image paste-verify.
- P3 6.2–6.5: HAP build + device open_url/open_path/reveal verify.

These are gated on the heavy ohos-build flow (frontend + cross-compile + HAP sign + device install/launch) and a connected device. All OHOS-side compile correctness is already verified via the api-app OHOS `cargo check`.
