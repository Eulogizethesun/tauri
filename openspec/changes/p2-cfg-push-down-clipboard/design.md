# Design: P2 — clipboard write_image async push-down

## Context

`clipboard-manager` layers clipboard operations as methods on a `Clipboard<R>` struct (desktop impl backed by arboard; OHOS impl a no-arboard stub). Every method except `write_image` follows this layering: `commands.rs` calls `clipboard.<op>()`, the impl does the platform work.

`write_image` is the exception. On OHOS, the TSFN bridge call (`openharmony_ability::clipboard::clipboard_write_image(&rgba, width, height).await`) is inlined directly in `commands.rs:63-78` behind a `#[cfg(target_env = "ohos")]` block, because the OHOS `Clipboard` impl has no `write_image` method. The non-OHOS branch wraps `clipboard.write_image(&image)` in `#[cfg(not(target_env = "ohos"))]`. This paired branch is the `1.6` violation.

The TSFN call is `async` (returns a `Future`), so the OHOS backend method must be `async`. For the command to call both backends uniformly via `.await`, the desktop (arboard) `write_image` must also become `async`.

## Goals

- Move the OHOS TSFN bridge logic out of `commands.rs` into the OHOS `Clipboard` impl as `pub async fn write_image`, restoring the layering that every other clipboard method already has.
- Make `commands.rs::write_image` a pure dispatcher: one unconditional `clipboard.write_image(&image).await`, no `cfg` branches.
- Make `Clipboard::write_image` `async` on both desktop and OHOS impls so the dispatcher compiles without `cfg`.

## Non-Goals

- Adding OHOS support for `write_text`/`read_text`/`read_image`/etc. Those remain `Err(PlatformNotAvailable)` on OHOS — out of scope for this refactor.
- Changing the JS-side `writeImage` IPC command contract (stays async, same args/return).
- Refactoring the mobile `Clipboard` (mobile uses `run_mobile_plugin` IPC, not the arboard/TSFN path).
- Avoiding the pub-API break. `Clipboard::write_image` sync→async is an inherent-method signature change; it is accepted as breaking-change for the next plugin major.

## Decisions

### Decision 1: OHOS `Clipboard` gains `pub async fn write_image`

**Decision.** Move the 16-line TSFN block (`commands.rs:63-78`) verbatim into the OHOS `Clipboard` impl (`desktop.rs`, inside the `#[cfg(target_env = "ohos")] impl<R: Runtime> Clipboard<R>` block):

```rust
#[cfg(target_env = "ohos")]
impl<R: Runtime> Clipboard<R> {
    pub async fn write_image(&self, rgba: &[u8], width: u32, height: u32) -> crate::Result<()> {
        openharmony_ability::clipboard::clipboard_write_image(rgba, width, height)
            .await
            .map_err(|e| crate::Error::Clipboard(e.to_string()))?;
        Ok(())
    }
    // ... other methods unchanged ...
}
```

**Rationale.** The TSFN logic is OHOS-specific by nature; it belongs in the OHOS backend, not in the shared command. This is the textbook `1.6` fix: differential logic lives behind whole-module `cfg` (`#[cfg(target_env = "ohos")] impl`), not scattered in shared code. The RGBA extraction (the `resources_table` scope) stays in the command (Decision 3) because it's shared by all backends, not OHOS-specific.

### Decision 2: Desktop `write_image` becomes `async` with the triple signature

**Decision.** `desktop.rs:54` changes from `pub fn write_image(&self, image: &Image<'_>) -> crate::Result<()>` to:

```rust
pub async fn write_image(&self, rgba: &[u8], width: u32, height: u32) -> crate::Result<()> {
    match &self.clipboard {
        Ok(clipboard) => clipboard.lock().unwrap().as_mut().unwrap().set_image(ImageData {
            bytes: Cow::Borrowed(rgba),
            width: width as usize,
            height: height as usize,
        }).map_err(Into::into),
        Err(e) => Err(crate::Error::Clipboard(e.to_string())),
    }
}
```

**Rationale.** The dispatcher calls `clipboard.write_image(&rgba, w, h).await` uniformly; both desktop and OHOS impls must return `Future<Output = crate::Result<()>>`. The arboard body stays sync (no real `.await` inside — `async` only changes the call convention). The `&Image<'_>` param is replaced by the extracted triple because the OHOS path cannot hold `&Image` across `.await` (Decision 4 `Send` constraint), so the desktop path adopts the same signature for uniform dispatch.

**Alternatives considered.**
- *Keep desktop sync, `cfg` the call in commands.rs.* Rejected: reintroduces the paired `cfg` branch we're removing — defeats the point.
- *Return `Pin<Box<dyn Future>>>` from a sync signature.* Rejected: adds heap allocation and `dyn` indirection; `async fn` is the idiomatic zero-cost equivalent.
- *Keep `&Image<'_>` signature on desktop, triple on OHOS.* Rejected: the command must call one signature on both — `cfg` branching in the command is what we're eliminating.

### Decision 3: `commands.rs` becomes a pure dispatcher

**Decision.** `commands.rs:54-86` becomes:

```rust
#[command]
pub(crate) async fn write_image<R: Runtime>(
    webview: Webview<R>,
    clipboard: State<'_, Clipboard<R>>,
    image: JsImage,
) -> Result<()> {
    // Extract RGBA into owned data BEFORE .await: Image<'_> from the Resource
    // variant borrows resources_table (a MutexGuard, !Send), so it cannot be
    // held across the async TSFN .await. The block scope drops the guard.
    let (rgba, width, height) = {
        let resources_table = webview.resources_table();
        let img = image.into_img(&resources_table)?;
        (img.rgba().to_vec(), img.width(), img.height())
    };
    clipboard.write_image(&rgba, width, height).await
}
```

Both `cfg` branches deleted. The command is now platform-neutral.

### Decision 4: Uniform `(rgba, width, height)` signature on all backends

**Decision.** All three `Clipboard` impls (desktop/arboard, OHOS/TSFN, mobile/unsupported) get the same signature:

```rust
pub async fn write_image(&self, rgba: &[u8], width: u32, height: u32) -> crate::Result<()>
```

- **OHOS** (`desktop.rs` OHOS impl): body = the old inlined TSFN block — `clipboard_write_image(rgba, width, height).await.map_err(...)?; Ok(())`.
- **Desktop arboard** (`desktop.rs:54`): body wraps `ImageData { bytes: Cow::Borrowed(rgba), width: width as usize, height: height as usize }` + arboard `set_image`. Same logic as today, fed from the triple instead of `&Image<'_>`.
- **Mobile** (`mobile.rs:62`): `pub async fn write_image(&self, _rgba: &[u8], _w: u32, _h: u32) -> crate::Result<()> { Err(PlatformNotSupported) }` — sync→async, signature aligned, behavior unchanged.

**Rationale — the `Send` constraint.** The OHOS TSFN call is `async`. The future returned by `async fn write_image` must be `Send` (Tauri's async command executor moves futures across threads). If the OHOS method took `&Image<'_>`, the future would capture that borrow for the method's whole lifetime — and `Image<'_>` from the `JsImage::Resource` variant borrows the `ResourceTable`'s `MutexGuard` (which is `!Send`), making the future `!Send` → compile error or runtime panic. Passing owned `(rgba: &[u8], w, h)` extracted *before* the `.await` means the future captures only owned `Vec<u8>` (and a `&[u8]` borrow of it, which is `Send` since `Vec<u8>` is `Send`). This is the same reason the current inlined code uses an explicit block scope. The desktop and mobile backends adopt the same signature for uniform dispatch.

**Mobile impact.** `commands::write_image` is registered unconditionally in `generate_handler!` (`lib.rs:50`, no `cfg`), so the mobile `Clipboard::write_image` must compile against the same call. Mobile gains the `async` keyword + new params but still returns `Err(PlatformNotSupported)` — no behavior change. (Mobile already pays the `into_img` decode cost before returning `Err` today; no regression.)

**Trade-off.** The desktop arboard path loses the `&Image<'_>` borrow convenience and reconstructs `ImageData` from the triple. Functionally identical (arboard only needs bytes + dims). The mobile path gains a no-op signature alignment. The benefit: one platform-neutral dispatch in the shared command.

## Risks / Trade-offs

- **Pub-API break (`Clipboard::write_image` sync→async + signature change).** Any external code calling `Clipboard::write_image(&image)` directly breaks. Mitigation: this is a plugin-internal type; external direct callers are rare. Tagged `breaking-change`, scheduled for next plugin major. The JS IPC surface is unaffected.
- **Future `Send`-ness on OHOS.** The OHOS `write_image` future must be `Send`. Resolved by Decision 4: the method takes owned `(rgba: &[u8], w, h)` extracted before the `.await`, so the future captures only `Send` data. Taking `&Image<'_>` would capture the `!Send` `MutexGuard` borrow and break `Send`. **Verified:** the current inlined code uses the same block-scope extraction pattern for this exact reason.
- **`async` on a sync arboard body.** The arboard `set_image` is sync; marking the fn `async` doesn't spawn — the future is polled inline by the command's `.await`. No deadlock risk (arboard doesn't touch the OHOS main-thread loop).

## Migration Plan

1. Add `pub async fn write_image(&self, rgba: &[u8], width: u32, height: u32) -> crate::Result<()>` to the OHOS `Clipboard` impl in `desktop.rs` (body = TSFN call verbatim).
2. Change desktop arboard `write_image` (`desktop.rs:54`) to `pub async fn write_image(&self, rgba: &[u8], width: u32, height: u32)`; body wraps `ImageData { bytes: Cow::Borrowed(rgba), width: width as usize, height: height as usize }` + `set_image`.
3. Change mobile `write_image` (`mobile.rs:62`) to `pub async fn write_image(&self, _rgba: &[u8], _w: u32, _h: u32) -> crate::Result<()>` returning `Err(PlatformNotSupported)`.
4. Rewrite `commands.rs::write_image`: extract `(rgba, width, height)` in a block scope + `clipboard.write_image(&rgba, width, height).await`. Delete both `cfg` branches.
5. `cargo check` on Windows (must be 0 errors) + OHOS `cargo check`.
6. OHOS build + device-verify clipboard `write_image`.

## Open Questions

- **Is the `write_image` IPC command registered on mobile?** **Resolved (audit):** yes, unconditionally at `lib.rs:50` in `generate_handler!` (no `cfg`). So mobile's `Clipboard::write_image` must match the new `(rgba, w, h)` async signature — Decision 4 step 3 aligns it. Mobile still returns `Err(PlatformNotSupported)`; no behavior change. The two `Clipboard` types (`desktop::Clipboard` and `mobile::Clipboard`) are mutually exclusive via `cfg`, so only one is compiled per target — but the shared `commands.rs` must type-check against whichever is active, hence the uniform signature.
