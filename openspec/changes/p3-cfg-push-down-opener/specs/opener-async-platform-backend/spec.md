# Specification: opener-async-platform-backend

## ADDED Requirements

### Requirement: opener commands are pure async dispatchers

The `open_url`, `open_path`, and `reveal_item_in_dir` commands in `commands.rs` SHALL contain no `#[cfg(target_env = "ohos")]` branch. Each command SHALL perform its scope check (where applicable) then dispatch to the backend via a single `.await` call.

#### Scenario: commands.rs has no OHOS branches

- **WHEN** `commands.rs` source is inspected
- **THEN** `open_url` SHALL end with `app.opener().open_url(url, with).await`
- **AND** `open_path` SHALL end with `app.opener().open_path(path, with).await`
- **AND** `reveal_item_in_dir` SHALL end with `crate::reveal_items_in_dir(&paths).await`
- **AND** there SHALL be no `#[cfg(target_env = "ohos")]` directive in `commands.rs`
- **AND** there SHALL be no `openharmony_ability` reference in `commands.rs`

### Requirement: opener free fns are async

The re-exported free fns `open_url`, `open_path`, `reveal_item_in_dir`, and `reveal_items_in_dir` SHALL be `pub async fn`.

#### Scenario: Free fns return futures

- **WHEN** each free fn is compiled
- **THEN** its signature SHALL be `pub async fn ... -> crate::Result<()>`
- **AND** callers SHALL `.await` the result

### Requirement: Opener inherent methods are async and exist on OHOS

The `Opener::open_url`, `Opener::open_path`, `Opener::reveal_item_in_dir`, and `Opener::reveal_items_in_dir` inherent methods SHALL be `pub async fn`. The `open_url`/`open_path` methods SHALL be compiled on OHOS (both desktop and mobile device types) via a `cfg` that includes `target_env = "ohos"`, so the commands can dispatch to them on all targets.

#### Scenario: Inherent methods compile on OHOS

- **WHEN** the crate is compiled with `target_env = "ohos"` (desktop or mobile device type)
- **THEN** `Opener::open_url` and `Opener::open_path` SHALL exist
- **AND** each SHALL be `pub async fn`
- **AND** each SHALL delegate to the corresponding free fn via `.await`

#### Scenario: Android/iOS still use the mobile plugin path

- **WHEN** the crate is compiled for `target_os = "android"` or `target_os = "ios"`
- **THEN** the mobile `open_url`/`open_path` inherent methods SHALL route through `run_mobile_plugin("open", ...)`
- **AND** the OHOS arms SHALL NOT be compiled

### Requirement: Platform logic lives in backend modules, not commands

All `openharmony_ability` calls (`open_with_system`, `reveal_in_dir`) SHALL reside in `open.rs` or `reveal_item_in_dir.rs` backend code, gated by `#[cfg(target_env = "ohos")]`. `commands.rs` SHALL NOT reference `openharmony_ability`.

#### Scenario: openharmony_ability is backend-only

- **WHEN** the crate source is searched for `openharmony_ability`
- **THEN** matches SHALL appear only in `open.rs` and `reveal_item_in_dir.rs`
- **AND** no match SHALL appear in `commands.rs`
