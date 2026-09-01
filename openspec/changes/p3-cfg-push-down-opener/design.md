# Design: P3 — opener reveal/open async push-down

## Context

`opener` has three async commands (`open_url`, `open_path`, `reveal_item_in_dir` in `commands.rs`), each with a paired `#[cfg(target_env = "ohos")]` / `#[cfg(not(target_env = "ohos"))]` branch. The OHOS branch calls `openharmony_ability::open_with_system` / `reveal_in_dir` directly — bypassing the backend layer. The non-OHOS branch calls `app.opener().open_url(...)` / `crate::reveal_items_in_dir(&paths)`.

The bypass exists because the backend layer doesn't support OHOS:
- `Opener` inherent `open_url`/`open_path` (`lib.rs:62`, `116`) are gated `#[cfg(desktop)]` and `#[cfg(all(mobile, not(target_env = "ohos")))]`. On OHOS neither cfg matches → the methods don't exist on the `Opener` type. (Recall: per CLAUDE.md, OHOS sets `cfg(desktop)` or `cfg(mobile)` based on `OHOS_DEVICE_TYPE` — but the inherent methods explicitly exclude OHOS via `not(target_env = "ohos")` on the mobile arm, and the desktop arm relies on the `open` crate which is broken on OHOS.)
- Free fns `open_url`/`open_path` (`open.rs`) call the `open` crate (`open::that_detached`) — Linux-only, no OHOS.
- Free `reveal_items_in_dir` (`reveal_item_in_dir.rs:43`) returns `Err(UnsupportedPlatform)` on OHOS (the `not(any(..., not(target_env = "ohos"), ...))` arm).

So the OHOS command branches were inlined *because the backends had no OHOS path*. The fix is to give the backends an OHOS path, make them `async` (the `openharmony_ability` calls are `async`), and let `commands.rs` dispatch uniformly — exactly the Phase 2 pattern, applied to opener.

## Goals

- Move OHOS `openharmony_ability::open_with_system` / `reveal_in_dir` calls out of `commands.rs` into the backend free fns (`open.rs`, `reveal_item_in_dir.rs`), behind `#[cfg(target_env = "ohos")]` arms/modules.
- Make the free fns `open_url`/`open_path`/`reveal_items_in_dir` and the `Opener` inherent methods `async`, so `commands.rs` dispatches via `.await` with no `cfg`.
- Preserve OHOS behavior bit-for-bit (canonicalize, `file://` URI construction, parent-dir reveal, first-path-only reveal limitation) — ported verbatim from the command branches.
- Keep desktop/mobile behavior unchanged (async is call-convention only on sync `open`-crate bodies).

## Non-Goals

- Adding multi-file reveal on OHOS (the first-path-only limitation is a platform constraint — `startAbility(viewData)` opens a single chooser). Documented limitation stays.
- Supporting `with` (open-with-program) on OHOS. Currently ignored; stays ignored.
- Changing the JS IPC command surface.
- Changing `OpenerExt` trait (only the `opener()` accessor).

## Decisions

### Decision 1: Free fns `open_url`/`open_path` become async with an OHOS arm

**Decision.** In `open.rs`:

```rust
pub async fn open_url<P: AsRef<str>, S: AsRef<str>>(url: P, with: Option<S>) -> crate::Result<()> {
    let url = url.as_ref();
    #[cfg(target_env = "ohos")]
    {
        let _ = with; // 'open with' unsupported on OHOS
        openharmony_ability::open_with_system(url.to_string())
            .await
            .map_err(|e| crate::Error::OpenharmonyAbility(e.to_string()))?;
        return Ok(());
    }
    #[cfg(not(target_env = "ohos"))]
    {
        open(url, with)
    }
}

pub async fn open_path<P: AsRef<Path>, S: AsRef<str>>(path: P, with: Option<S>) -> crate::Result<()> {
    #[cfg(target_env = "ohos")]
    {
        let _ = with;
        let canon = std::fs::canonicalize(path.as_ref())?;
        let uri = url::Url::from_file_path(&canon)
            .map_err(|_| crate::Error::InvalidPath(path.as_ref().to_string_lossy().to_string()))?;
        openharmony_ability::open_with_system(uri.to_string())
            .await
            .map_err(|e| crate::Error::OpenharmonyAbility(e.to_string()))?;
        return Ok(());
    }
    #[cfg(not(target_env = "ohos"))]
    {
        let path = path.as_ref();
        if with.is_none() { _ = path.metadata()?; }
        open(path, with)
    }
}
```

The `pub(crate) fn open` helper stays sync — it's internal to the non-OHOS arm only.

**Rationale.** The `openharmony_ability` call is OHOS-specific; it belongs in the backend, not the command. The OHOS arms are verbatim ports of `commands.rs:42-49` and `84-97`. Canonicalize-to-`file://` for `open_path` matches the existing command behavior (and the reveal branch).

### Decision 2: `reveal_items_in_dir` free fn becomes async + OHOS `mod imp`

**Decision.** In `reveal_item_in_dir.rs`, the top-level `reveal_items_in_dir` becomes `pub async fn`. A new `#[cfg(target_env = "ohos")] mod imp` block provides:

```rust
#[cfg(target_env = "ohos")]
mod imp {
    use std::path::PathBuf;
    pub async fn reveal_items_in_dir(paths: &[PathBuf]) -> crate::Result<()> {
        // OHOS: no multi-file reveal. Only the first path's parent is revealed.
        if let Some(path) = paths.first() {
            let path = std::fs::canonicalize(path)?;
            let parent = path.parent()
                .ok_or_else(|| crate::Error::NoParent(path.to_path_buf()))?;
            let uri = url::Url::from_file_path(parent)
                .map_err(|_| crate::Error::InvalidPath(parent.to_string_lossy().to_string()))?;
            openharmony_ability::reveal_in_dir(uri.to_string())
                .await
                .map_err(|e| crate::Error::OpenharmonyAbility(e.to_string()))?;
        }
        Ok(())
    }
}
```

The top-level fn dispatches: `imp::reveal_items_in_dir(&canonicalized).await` on OHOS; existing platform `imp` (Windows/macOS/Linux/BSD) on others. The existing per-platform `mod imp` blocks (already `cfg`-gated) stay sync — they're `await`ed by the top-level async dispatcher (sync body, `async` call convention).

**Dispatch cfg revision (explicit, audit item D).** The free fns `reveal_item_in_dir`/`reveal_items_in_dir` currently gate their non-OHOS dispatch with `#[cfg(any(windows, target_os="macos", all(target_os="linux", not(target_env="ohos")), BSDs))]` and return `Err(UnsupportedPlatform)` on the `#[cfg(not(any(...)))]` fallback — which today includes OHOS. To make OHOS hit the new `mod imp` instead of the `UnsupportedPlatform` fallback, **the dispatch `any(...)` must add `target_env = "ohos"`** so OHOS matches the OHOS `mod imp`. (Without this, the new `mod imp` compiles but is never reached — a silent no-op. The audit flagged that the current task 2.2 only implies this; it must be stated.)

The singular `reveal_item_in_dir` wrapper also becomes `async` (it delegates to `reveal_items_in_dir(&[path]).await`).

**Rationale.** The OHOS reveal logic (canonicalize → parent → `file://` → `reveal_in_dir`) is a verbatim port of `commands.rs:107-126`. Putting it in `mod imp` mirrors the existing platform-`imp` structure (Windows/macOS/Linux each have their own `mod imp`). This is the canonical `1.6` fix: OHOS gets its own `mod imp` behind whole-module `cfg`, like every other platform.

### Decision 3: `Opener` inherent methods become async + OHOS cfg

**Decision.** In `lib.rs`, the 4 inherent methods become `pub async fn` and `.await` the free fns:

- `open_url` (`lib.rs:62` desktop, `88` mobile): each becomes `pub async fn` with body `crate::open::open_url(...).await` (or the free fn). The `cfg` adds `target_env = "ohos"` so the method exists on OHOS: `#[cfg(any(desktop, target_env = "ohos"))]` and `#[cfg(all(mobile, not(target_env = "ohos")))]` (mobile stays as-is — OHOS mobile uses the desktop-arm? No — see Open Questions).
- `open_path` (`116`/`146`): same.
- `reveal_item_in_dir` (`156`) / `reveal_items_in_dir` (`160`): become `pub async fn`, `.await` the free fns. No cfg change needed (they're not cfg-gated currently).

**OHOS cfg matrix resolution (key audit point).** Today: desktop arm `#[cfg(desktop)]`, mobile arm `#[cfg(all(mobile, not(target_env = "ohos")))]`. On OHOS desktop (`cfg(desktop)` true) the desktop arm compiles and calls the `open` crate (broken on OHOS). On OHOS mobile (`cfg(mobile)` true, but the mobile arm excludes OHOS) → no method. 

The fix: the desktop arm's `#[cfg(desktop)]` already includes OHOS-desktop, but it must call the OHOS-aware free fn (not the raw `open` crate) — which Decision 1 provides. So the desktop arm body changes from `crate::open::open(url, with)` to `crate::open::open_url(url, with).await` (the free fn, which itself has the OHOS arm). For OHOS mobile, the mobile arm's `cfg(all(mobile, not(target_env = "ohos")))` must drop the `not(target_env = "ohos")` exclusion OR a third OHOS-mobile arm is added. Since the mobile arm uses `run_mobile_plugin` (Android/iOS IPC, not OHOS), OHOS mobile should NOT use it — OHOS mobile should use the `openharmony_ability` path. So the cleanest fix: the desktop arm `#[cfg(any(desktop, target_env = "ohos"))]` covers both OHOS desktop and OHOS mobile (both call the free fn with OHOS arm); the mobile arm stays `#[cfg(all(mobile, not(target_env = "ohos")))]` (Android/iOS only).

**Rationale.** This unifies OHOS (both device types) onto the `openharmony_ability` path via the free fn, removes the gap that forced the command-level bypass, and keeps Android/iOS on their mobile-plugin path.

### Decision 4: `commands.rs` becomes a pure async dispatcher

**Decision.** Delete all three OHOS branches. The bodies become:

```rust
// open_url, after scope check:
app.opener().open_url(url, with).await

// open_path, after scope check:
app.opener().open_path(path, with).await

// reveal_item_in_dir:
crate::reveal_items_in_dir(&paths).await
```

No `cfg(target_env = "ohos")` anywhere in `commands.rs`.

**Rationale.** Once the backends own the OHOS path, the command is a scope-check + delegate. The `.await` is uniform because all backends are now `async`. This is the end state reference §1.6 prescribes.

## Risks / Trade-offs

- **Largest breaking surface of the three phases.** 3 pub free fns + 4 inherent methods go sync→async. All external callers break. Mitigation: tag `breaking-change`, next plugin major. The `commands.rs:104` TODO already anticipated this rename+async move.
- **OHOS cfg matrix subtlety.** Getting the inherent-method `cfg` wrong could (a) leave OHOS mobile without a method (compile error) or (b) route OHOS desktop through the broken `open` crate (runtime failure). Mitigation: Decision 3's `#[cfg(any(desktop, target_env = "ohos"))]` desktop arm covers both OHOS device types; device-verify both desktop and mobile.
- **`async` on sync `open`-crate / platform-`imp` bodies.** Like Phase 2's arboard, the desktop `open::that_detached` and the Windows/macOS reveal `imp`s are sync; `async` is call-convention only. No deadlock (these don't touch the OHOS main-thread loop). The futures are `Send` (no `MutexGuard`/borrow held across `.await` — paths are owned `PathBuf`/`String`).
- **`Send`-ness of OHOS futures.** The OHOS arms hold only owned `String`/`PathBuf`/`Url` across `.await` — all `Send`. No `MutexGuard` (unlike Phase 2's clipboard). Safe.
- **Behavior preservation — first-path-only reveal.** The OHOS `mod imp` must preserve the "only first path's parent is revealed" limitation (verbatim port). Documented in the comment.

## Migration Plan

1. `open.rs`: make `open_url`/`open_path` `pub async fn`; add OHOS arm (port from `commands.rs:42-49`, `84-97`); non-OHOS arm `async`-wraps the existing `open` call. Keep `pub(crate) fn open` sync.
2. `reveal_item_in_dir.rs`: add `#[cfg(target_env = "ohos")] mod imp` (port from `commands.rs:107-126`); make top-level `reveal_items_in_dir` `pub async fn` dispatching to `imp::...await`; make `reveal_item_in_dir` (singular) `async`.
3. `lib.rs`: 4 inherent methods → `pub async fn` + `.await` free fns; fix desktop arm cfg to `#[cfg(any(desktop, target_env = "ohos"))]`; mobile arm stays `#[cfg(all(mobile, not(target_env = "ohos")))]`.
4. `commands.rs`: delete 3 OHOS branches; add `.await` to the 3 dispatch calls.
5. `cargo check` on Windows (0 errors) + OHOS `cargo check`.
6. OHOS desktop + mobile build; device-verify open_url (http link), open_path (local file), reveal_item_in_dir (folder reveal).

## Open Questions

- **Singular `reveal_item_in_dir` async?** It's `pub fn` and delegates to `reveal_items_in_dir`. Making it `async` is consistent but adds to the breaking surface. **Recommendation:** yes, make it async for consistency (it just `.await`s the plural). It's a pub re-export (`lib.rs:30`), so it's breaking either way once the plural is async.
- **Does the singular `reveal_item_in_dir` canonicalize stay in the wrapper or move to `mod imp`?** Today the wrapper canonicalizes then calls `imp`. On OHOS the command branch canonicalizes again (redundant if wrapper already did). **Recommendation:** keep canonicalize in the wrapper (shared by all platforms); the OHOS `mod imp` receives already-canonicalized paths (same as other `imp`s). Avoids double-canonicalize.
