## Why

`clipboard-manager`'s `write_image` command (`plugins/clipboard-manager/src/commands.rs:54-86`) carries a 16-line inline `#[cfg(target_env = "ohos")]` block that does TSFN bridge setup (resource-table scope, RGBA extraction, `openharmony_ability::clipboard::clipboard_write_image(&rgba, width, height).await`). The non-OHOS branch is a one-liner `clipboard.write_image(&image)`. This is a `1.6` violation (reference §1.6): OHOS differential logic scattered in a shared command, instead of pushed down to the platform backend.

The OHOS `Clipboard` struct (`desktop.rs:150`) has *no* `write_image` method — the TSFN logic lives only in commands.rs, breaking the layering. Every other clipboard operation (read_text/write_text/etc.) is a method on `Clipboard`; `write_image` is the exception.

## What Changes

- **Add `pub async fn write_image` to the OHOS `Clipboard` impl** (`desktop.rs`): move the TSFN call (`clipboard_write_image(rgba, width, height).await`) into a method taking `(rgba: &[u8], width: u32, height: u32)`.
- **Make desktop `write_image` async with the same triple signature**: the arboard-backed `pub fn write_image(&self, image: &Image<'_>)` (`desktop.rs:54`) becomes `pub async fn write_image(&self, rgba: &[u8], width: u32, height: u32)`. Body wraps `ImageData` from the triple + arboard `set_image` (same logic as today).
- **Mobile `write_image` aligned**: `mobile.rs:62` becomes `pub async fn write_image(&self, _rgba: &[u8], _w: u32, _h: u32) -> crate::Result<()>` still returning `Err(PlatformNotSupported)` — the command is registered unconditionally, so mobile must match the signature. No behavior change.
- **`commands.rs` unifies**: the command extracts `(rgba, width, height)` in a block scope (drops the `!Send` `MutexGuard` before `.await`), then calls `clipboard.write_image(&rgba, width, height).await` unconditionally. Both `cfg` branches deleted.
- No trait change: `ClipboardExt` only has the `clipboard()` accessor; `write_image` is inherent.
- **`Send` constraint** is the reason the signature is `(rgba, &[u8], w, h)` not `&Image<'_>`: `Image<'_>` from the `JsImage::Resource` variant borrows the `ResourceTable` `MutexGuard` (`!Send`), so it cannot be held across the OHOS `.await`.

## Capabilities

### New Capabilities
- `clipboard-write-image-async-backend`: the `Clipboard::write_image` method is `async` and the OHOS impl owns the TSFN bridge call; commands.rs is a pure dispatcher with no platform branches.

### Modified Capabilities
- None. (No existing clipboard-write spec in this repo to modify; `ohos-webview-flag-clipboard` is about ArkWeb clipboard flags, unrelated.)

## Impact

- **Code**: `plugins/clipboard-manager/src/commands.rs` (delete OHOS branch, unify to `.await`), `plugins/clipboard-manager/src/desktop.rs` (OHOS impl gains `async fn write_image`; desktop `write_image` → `async`), `plugins/clipboard-manager/src/mobile.rs` (verify sync-unsupported compiles under async signature — no change expected).
- **APIs**: `Clipboard::write_image` signature changes sync→async on the desktop/OHOS impl. This is **pub API breaking** for any external code calling `Clipboard::write_image` directly (rare — it's a plugin-internal type). Tagged `breaking-change`, scheduled with the next plugin major. No trait break (`ClipboardExt` unchanged). The Tauri command surface (`write_image` IPC command) stays async — no JS-side change.
- **Dependencies**: none.
- **Platform isolation**: compliant — OHOS TSFN logic moves from a `cfg` branch in a shared command into the OHOS-only `Clipboard` impl (already `#[cfg(target_env = "ohos")]`); the shared command becomes platform-neutral.
- **Risk**: `Clipboard::write_image` becoming `async` on the arboard desktop path is a signature break. The arboard call itself stays sync (no `.await` needed in the body); the `async` keyword only changes the call convention. The sole internal caller (`commands.rs:84`) is updated to `.await`.
