# Design: P1 — cfg push-down for menu/tray via macro passthrough

## Context

The Tauri menu/tray wrapper layer (`crates/tauri/src/menu/*.rs`, `tray/mod.rs`) wraps every muda call in a `run_main_thread!` / `run_item_main_thread!` macro that does `run_on_main_thread(task)` + `rx.recv()`. On OHOS this blocking RPC deadlocks: the closure is scheduled onto the Chrome_IOThread, but the ArkTS main-thread event loop that resolves those tasks is the very thread the caller is waiting on (ohos-constraints §1.2).

To work around this, the OHOS adaptation wrapped each of ~89 call sites in paired `#[cfg(target_env = "ohos")]` / `#[cfg(not(target_env = "ohos"))]` branches. The OHOS branch executes the closure inline (no macro) and appends `auto_refresh_menubar` for mutations; the non-OHOS branch keeps the macro. This is the largest `cfg` scatter in the OHOS adaptation — the canonical maintainability problem flagged in reference §1.6.

The macro is `pub(crate)` and behavior-agnostic: the closure it wraps already returns the muda result. The divergence between the two branches is purely *how the closure is executed* (block on main thread vs. run inline), not *what it computes*.

## Goals

- Eliminate the paired-branch `cfg` divergence at all ~89 menu/tray sites by moving the dispatch decision *inside* the macro.
- On OHOS, execute the closure inline on the calling thread and return its result — the documented-safe path, since muda's OHOS backend handles thread safety via TSFN and `TrayIcon` is `Sync + Send` with no main-thread restriction (ohos-constraints §1.2).
- Keep non-OHOS behavior byte-for-byte identical (same closure, same `run_on_main_thread` + `recv` path).
- Reduce the ~89 paired-branch sites to: ~57 fully collapsed (single macro call, no residual cfg) + ~32 menu mutations collapsed to a single one-line `#[cfg(target_env = "ohos")] auto_refresh_menubar(...)` post-call.
- Preserve the `auto_refresh_menubar` mutation-refresh contract for OHOS menus (JSON re-serialize + TSFN push).

## Non-Goals

- Removing `auto_refresh_menubar` itself. OHOS menus are pure Rust data pushed to ArkTS as JSON; there is no native menubar to mutate in place. The post-call refresh for mutations is a genuine platform requirement, not a workaround. It stays as a single-sided OHOS-only call — a `1.6`-acceptable residual, not a paired branch.
- Refactoring clipboard `write_image` or opener `reveal_item_in_dir`/`open_path`. Those are Phase 2 and Phase 3 (separate openspec changes) requiring sync→async signature changes.
- Changing any public API. `run_main_thread!` / `run_item_main_thread!` are `pub(crate)`; the macro's expansion is not part of the public surface.
- Changing the `run_on_main_thread` dispatch path on Windows/macOS/Linux.

## Decisions

### Decision 1: Add a `cfg(target_env = "ohos")` branch *inside* the macro

**Decision.** Both macros gain an `#[cfg(target_env = "ohos")]` arm that executes the closure directly and returns its result, skipping `run_on_main_thread` + `recv`. The existing body moves under `#[cfg(not(target_env = "ohos"))]`.

```rust
// crates/tauri/src/lib.rs — run_main_thread!
// Non-OHOS arm: run_on_main_thread + rx.recv() → Result<T, Error>
// OHOS arm: run closure inline, wrap in Ok → Result<T, Error>  (same return type)
#[cfg(target_env = "ohos")]
macro_rules! run_main_thread {
  ($handle:ident, $ex:expr) => {{ Ok($ex()) }};
}
#[cfg(not(target_env = "ohos"))]
macro_rules! run_main_thread {
  ($handle:ident, $ex:expr) => {{ /* unchanged: channel + run_on_main_thread + recv */ }};
}
```

`run_item_main_thread!` mirrors this. Its closure takes an owned `Self` (`|self_: Self| body`); the non-OHOS arm clones `$self` into `self_` and calls `f(self_)`. The OHOS arm calls the closure with the same clone: `{{ Ok($ex($self.clone())) }}`. The clone is kept (cheap `Arc` bump) to preserve the closure's owned-`Self` signature and keep call-site arity uniform.

**Rationale.** The divergence between the two `cfg` branches at every call site is *identical* to the divergence between the two macro arms. Lifting it into the macro removes 89 copies of the same decision and makes the call sites platform-neutral. This is the textbook `1.6` fix: the differential logic lives in exactly one place (the macro), gated with whole-branch `cfg`, instead of scattered across shared code.

**Alternatives considered.**

- *Per-site inline execution (status quo).* Keeps 89 paired branches. Rejected: this is the problem, not the solution.
- *A trait-object dispatch layer.* Introduce a `MenuThreadDispatcher` trait with OHOS/non-OHOS impls. Rejected: adds runtime indirection and an abstraction for a single conditional; the macro already centralizes dispatch at zero runtime cost.
- *Remove the macro entirely on OHOS and call muda directly at each site.* Rejected: loses the single chokepoint and re-scatters the dispatch decision; worse than status quo for maintainability.

### Decision 2: Collapse paired branches to a single macro call

**Decision.** At each of the ~57 non-mutation sites (getters, constructors, all `tray/mod.rs` methods), remove the `#[cfg(target_env = "ohos")]` inline branch and the `#[cfg(not(target_env = "ohos"))]` macro branch, replacing both with one unconditional macro invocation. The macro's OHOS arm handles inline execution.

**Rationale.** Once the macro is OHOS-aware, the paired branches are provably equivalent — the OHOS branch was *exactly* "run the closure inline", which is now what the macro does on OHOS. Keeping both branches would be a `V8`-style redundant `cfg` (reference §4.8).

### Decision 3: Retain a single-sided `auto_refresh_menubar` for mutations

**Decision.** The ~32 menu mutation methods (`setText`/`setEnabled`/`setAccelerator`/`setChecked`/`setIcon`/`add`/`remove`/`append`/`insert`/`prepend`) collapse to a single macro call, followed by one line:

```rust
run_item_main_thread!(self, |self_| { /* muda mutation */ })?;
#[cfg(target_env = "ohos")]
super::auto_refresh_menubar(&self.app_handle());
```

**Rationale.** `auto_refresh_menubar` is OHOS-specific by nature (no other platform has a JSON-push menubar). It is not a paired-branch divergence — there is no non-OHOS counterpart to fold away. This downgrades each mutation site from "paired `cfg` branch" (a `1.6` violation) to "single OHOS-only post-call" (a `1.6`-acceptable platform hook), which is the intended end state per reference §1.6.

### Decision 4: Leave the macro signature/arity unchanged

**Decision.** Both macros keep their existing `($handle:ident, $ex:expr)` / `($self:ident, $ex:expr)` signature. The OHOS arm ignores `$handle` (and the `$self` clone) but still accepts them, so every call site text compiles unchanged on both targets.

**Rationale.** Avoids touching 89 call sites' argument lists. The cost is one unused binding on OHOS, suppressed by the existing `#[allow(unused)]`.

## Risks / Trade-offs

- **Thread-context change on OHOS.** Today the OHOS inline branch runs on whatever thread the caller is on (typically an ArkTS callback chain). The macro passthrough preserves *exactly* this — it runs on the calling thread. So the runtime behavior on OHOS is unchanged; only the *code path* to reach it changes. The risk is that some site today relies on the explicit `#[cfg(target_env = "ohos")]` arm doing something subtly different from "run the closure and return". The exploration found none — every OHOS arm is `let self_ = self.clone(); <muda call>` or a bare `<muda call>`, which is what the macro now does. **Mitigation:** device-verify the full `menu-auto-tests` / `tray-auto-tests` suites (popup, mutation, click-chain) on desktop and mobile after the change.
- **`run_item_main_thread!` `$self.clone()` on OHOS.** The OHOS arm calls `$ex($self.clone())` — the clone is required because the closure signature takes owned `Self`, not `&Self`. For `MenuItem`/`Submenu`/etc. the clone is a cheap `Arc` bump. **Trade-off:** accept the clone on OHOS to keep call-site arity uniform and closure signatures unchanged.
- **Macro return-type preservation (audit finding).** The non-OHOS macro returns `Result<T, Error>` (via `run_on_main_thread` → `.and_then(... rx.recv())`, where `T` = closure return type). A naive OHOS arm `{{ $ex() }}` would return `T`, breaking every call site. The arm must be `{{ Ok($ex()) }}` (`run_main_thread!`) / `{{ Ok($ex($self.clone())) }}` (`run_item_main_thread!`) so both arms yield `Result<T, Error>` and the call-site `?`/`.map_err(...)` chains compile unchanged on both targets. Verified against `set_icon` (closure returns `muda::Result`, `?` + `.map_err(Into::into)` → `crate::Result<()>`) and `set_menu` (closure returns `()`, `?` → `crate::Result<()>`).
- **Audit surface.** The change touches 8 files but the diff in each is mechanical (delete one cfg branch, dedent the other). Review burden is low *if* the macro arms are reviewed carefully; high if reviewers treat it as a blind find/replace.
- **muda OHOS `MenuChild` is `Rc<RefCell<MenuChild>>` (`!Send`) (audit finding).** The OHOS muda backend stores menu items in `Rc<RefCell<MenuChild>>` (`muda/src/platform_impl/ohos/mod.rs:140-152`). The macro's OHOS arm executes the closure *inline on the calling thread* — `Ok($ex($self.clone()))` — so the `Rc` never crosses a thread boundary. This is safe. **Constraint:** menu/tray wrapper methods (`set_text`, `set_enabled`, etc.) MUST remain synchronous `fn` (not `async`), so the `Rc` is never held across a `.await` point (which would make the enclosing future `!Send`). Verified: the menu/tray wrapper methods are all sync today, and the `#[tauri::command]` callers invoke them synchronously (`item.set_text(text)?`), so no `Rc` crosses a `.await`. The passthrough does not introduce async anywhere in this path — confirmed by Decision 4 (no signature change). Non-Goal: making any wrapper method async.

## Migration Plan

1. Add the `#[cfg(target_env = "ohos")]` arm to `run_main_thread!` in `lib.rs`; move existing body under `#[cfg(not(target_env = "ohos"))]`.
2. Same for `run_item_main_thread!` in `menu/mod.rs`.
3. `tray/mod.rs` (10 paired sites): collapse each paired branch to a single macro call. **Audit correction**: 3 single-sided OHOS-only sites remain and are kept (not collapsed): `quick_operation` builder (L360, OHOS StatusBar popup API, no counterpart), `set_quick_operation` (L698, same), and `set_icon_as_template` (L664, three-way macos/ohos/else split) — the last *simplifies* to `cfg(any(macos, ohos))` single macro + else no-op but retains the `any(macos,ohos)` cfg. See audit doc §P1 差异 1.
4. `menu/{submenu,predefined,icon,menu,check,normal}.rs` (~78 sites): for getters/constructors, collapse to single macro call; for mutations, collapse to single macro call + one-line `#[cfg(target_env = "ohos")] auto_refresh_menubar(...)`.
5. `cargo check` on Windows (must be 0 errors — non-OHOS path untouched).
6. OHOS desktop + mobile build via ohos-build skill.
7. Device-verify `menu-auto-tests` + `tray-auto-tests` suites.

No deprecation period: `pub(crate)` macro, no external consumers.

## Open Questions

- **`run_item_main_thread!` OHOS arm: keep the `$self.clone()` or drop it?** **Resolved:** keep it. The closure takes an owned `Self` (`|self_: Self| body`), so the arm must pass an owned value regardless of platform — `$ex($self.clone())` on OHOS mirrors the non-OHOS `f(self_)` path exactly and keeps the return type as `Result<T, Error>`. Dropping the clone would require changing the closure signature at every call site. The clone is a cheap `Arc` bump.
- **Should `menu-auto-tests` / `tray-auto-tests` specs be MODIFIED or left untouched?** **Resolved:** leave them untouched and drop them from this change's `Modified Capabilities` (proposal updated). The behavior under test is unchanged; only the dispatch path changes, which is not a requirement-level delta. openspec MODIFIED is reserved for requirement changes.
