# Specification: clipboard-write-image-async-backend

## ADDED Requirements

### Requirement: write_image command has no platform cfg branches

The `write_image` command in `commands.rs` SHALL be a pure dispatcher: it SHALL extract RGBA data from the `JsImage` once, then call `Clipboard::write_image` unconditionally via `.await`. No `#[cfg(target_env = "ohos")]` / `#[cfg(not(target_env = "ohos"))]` paired branches SHALL exist in the command body.

#### Scenario: Command body is platform-neutral

- **WHEN** the `write_image` command source is inspected
- **THEN** the body SHALL contain exactly one call to `clipboard.write_image(...)`
- **AND** that call SHALL be followed by `.await`
- **AND** there SHALL be no `#[cfg(target_env = "ohos")]` directive in the command body

### Requirement: RGBA extraction happens before the await boundary

The command SHALL extract `(rgba, width, height)` into owned data within a block scope that drops the `ResourceTable` `MutexGuard` before any `.await` point, so the resulting future is `Send`.

#### Scenario: MutexGuard is not held across await

- **WHEN** the `write_image` command is compiled for an OHOS target
- **THEN** the `resources_table()` guard SHALL be dropped before the `clipboard.write_image(...).await` call
- **AND** the future returned by the command SHALL be `Send`

### Requirement: Clipboard::write_image is async on all backends

The `Clipboard::write_image` method SHALL be `async fn` on the desktop (arboard) impl, the OHOS (TSFN) impl, and the mobile impl. All three impls SHALL accept the same parameter list `(rgba: &[u8], width: u32, height: u32)` and return `crate::Result<()>`.

#### Scenario: All backends share one signature

- **WHEN** `Clipboard::write_image` is compiled on desktop, OHOS, or mobile
- **THEN** the method signature SHALL be `pub async fn write_image(&self, rgba: &[u8], width: u32, height: u32) -> crate::Result<()>`
- **AND** the shared `commands.rs` dispatch `clipboard.write_image(&rgba, width, height).await` SHALL compile on all three targets without `cfg`

### Requirement: OHOS write_image owns the TSFN bridge call

The OHOS `Clipboard::write_image` impl SHALL contain the `openharmony_ability::clipboard::clipboard_write_image(rgba, width, height).await` call. This TSFN call SHALL NOT appear in `commands.rs`.

#### Scenario: TSFN logic lives in the OHOS backend

- **WHEN** the OHOS `Clipboard` impl source is inspected
- **THEN** the `clipboard_write_image` call SHALL be inside `Clipboard::write_image`
- **AND** `commands.rs` SHALL NOT reference `openharmony_ability::clipboard::clipboard_write_image`

### Requirement: Desktop arboard path is functionally preserved

The desktop (arboard) `Clipboard::write_image` SHALL construct an `ImageData { bytes: Cow::Borrowed(rgba), width, height }` from the extracted triple and call arboard `set_image`, producing the same clipboard write behavior as the pre-change `&Image<'_>` path.

#### Scenario: Arboard receives the same bytes and dimensions

- **WHEN** the desktop `write_image` is called with `(rgba, width, height)`
- **THEN** arboard `set_image` SHALL receive `ImageData` with `bytes` equal to `rgba`, `width` equal to `width as usize`, and `height` equal to `height as usize`
- **AND** the call SHALL return `Ok(())` on success

### Requirement: Mobile write_image remains unsupported

The mobile `Clipboard::write_image` SHALL return `Err(PlatformNotSupported)` (or equivalent), unchanged in behavior from the pre-change mobile path, but with the `async` signature and `(rgba, width, height)` parameter list aligned for uniform dispatch.

#### Scenario: Mobile rejects write_image

- **WHEN** `write_image` is invoked on a mobile target
- **THEN** the mobile `Clipboard::write_image` SHALL return an `Err` variant indicating the platform is unsupported
- **AND** the method SHALL be `async fn` with the uniform signature
