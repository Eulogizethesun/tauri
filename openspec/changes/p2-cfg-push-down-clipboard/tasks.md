# Tasks: P2 — clipboard write_image async push-down

## 1. OHOS backend — add async write_image

- [x] 1.1 In `plugins/clipboard-manager/src/desktop.rs`, inside the `#[cfg(target_env = "ohos")] impl<R: Runtime> Clipboard<R>` block, add `pub async fn write_image(&self, rgba: &[u8], width: u32, height: u32) -> crate::Result<()>` whose body calls `openharmony_ability::clipboard::clipboard_write_image(rgba, width, height).await` + `.map_err(...)?; Ok(())`
- [x] 1.2 Remove the stale comment at `desktop.rs:172` ("write_image is handled via TSFN bridge in commands.rs")

## 2. Desktop arboard backend — async + triple signature

- [x] 2.1 In `plugins/clipboard-manager/src/desktop.rs:54`, change `pub fn write_image(&self, image: &Image<'_>)` to `pub async fn write_image(&self, rgba: &[u8], width: u32, height: u32)`
- [x] 2.2 Rewrite the body to construct `ImageData { bytes: Cow::Borrowed(rgba), width: width as usize, height: height as usize }` + arboard `set_image`, preserving the `Ok/Err` match arms

## 3. Mobile backend — align signature

- [x] 3.1 In `plugins/clipboard-manager/src/mobile.rs:62`, change `pub fn write_image(&self, _image: &Image<'_>)` to `pub async fn write_image(&self, _rgba: &[u8], _width: u32, _height: u32)` still returning `Err(PlatformNotSupported)`

## 4. Command — pure dispatcher

- [x] 4.1 Rewrite `plugins/clipboard-manager/src/commands.rs::write_image` to extract `(rgba, width, height)` in a block scope (drops `MutexGuard`) then call `clipboard.write_image(&rgba, width, height).await`
- [x] 4.2 Delete the `#[cfg(target_env = "ohos")]` block (L63-78) and the `#[cfg(not(target_env = "ohos"))]` wrapper
- [x] 4.3 Remove the now-stale `// unused on OHOS` comment on the `clipboard` param if it becomes used on all targets

## 5. Verify — non-OHOS untouched behavior

- [x] 5.1 `cargo check` (Windows host) on `clipboard-manager` — 0 errors
- [x] 5.2 Grep `commands.rs` to confirm no surviving `#[cfg(target_env = "ohos")]` branches
- [x] 5.3 Grep `commands.rs` to confirm no `openharmony_ability::clipboard::clipboard_write_image` reference (it now lives only in `desktop.rs` OHOS impl)

## 6. Verify — OHOS build + device (ohos-build skill)

- [ ] 6.1 OHOS desktop build — HAP produced, EXIT=0
- [ ] 6.2 OHOS mobile build — HAP produced, EXIT=0
- [ ] 6.3 Device: write an image to clipboard via the `writeImage` IPC command and verify it lands on the OHOS system clipboard (paste into a notes app and confirm the image appears)
