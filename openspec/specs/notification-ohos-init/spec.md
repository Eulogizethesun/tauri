# notification-ohos-init Specification

## Purpose
TBD - created by archiving change notification-ohos-gap-analysis. Update Purpose after archive.
## Requirements
### Requirement: build.rs SHALL register OHOS ArkTS path
`build.rs` SHALL call `.ohos_path("openharmony")` on the `tauri_plugin::Builder`, enabling the build system to set up OHOS cfg flags and copy the tauri-api ArkTS library into `openharmony/.tauri/tauri-api/`.

#### Scenario: OHOS build triggers ArkTS module scaffolding
- **WHEN** the crate is compiled with `target_env = "ohos"`
- **THEN** the tauri-api ArkTS library SHALL be copied to `openharmony/.tauri/tauri-api/` and `cargo:ohos_library_path` SHALL be emitted

#### Scenario: Non-OHOS build is unaffected
- **WHEN** the crate is compiled for Windows, macOS, or Linux (non-OHOS)
- **THEN** the `.ohos_path()` call SHALL have no effect and build SHALL proceed as before

### Requirement: lib.rs SHALL route OHOS to mobile module via cfg gates
All `#[cfg(desktop)]` and `#[cfg(mobile)]` gates in `src/lib.rs` SHALL be updated to explicitly handle OHOS:
- `#[cfg(desktop)]` → `#[cfg(all(desktop, not(target_env = "ohos")))]`
- `#[cfg(mobile)]` → `#[cfg(any(mobile, target_env = "ohos"))]`

This applies to: `mod` declarations, `use` imports, `pub use` re-exports, struct fields, constructor methods, and the `setup` closure.

#### Scenario: OHOS Desktop compiles mobile module
- **WHEN** compiled with `target_env = "ohos"` and `OHOS_DEVICE_TYPE=desktop`
- **THEN** the `mobile` module SHALL be compiled (not `desktop`) and `NotificationBuilder` SHALL use `PluginHandle<R>` (not `AppHandle<R>`)

#### Scenario: OHOS Mobile compiles mobile module
- **WHEN** compiled with `target_env = "ohos"` and `OHOS_DEVICE_TYPE=mobile`
- **THEN** the `mobile` module SHALL be compiled, same as OHOS Desktop scenario

#### Scenario: Windows/macOS/Linux compile desktop module
- **WHEN** compiled for Windows, macOS, or Linux (non-OHOS)
- **THEN** the `desktop` module SHALL be compiled, `NotificationBuilder` SHALL use `AppHandle<R>`

### Requirement: Cargo.toml SHALL exclude notify-rust from OHOS
The `notify-rust` dependency target SHALL include `not(target_env = "ohos")` to prevent compilation on OHOS, since `notify-rust` depends on D-Bus and other Linux system libraries unavailable on OHOS.

#### Scenario: notify-rust not compiled for OHOS
- **WHEN** compiled with `target_env = "ohos"`
- **THEN** `notify-rust` SHALL NOT be included as a dependency

#### Scenario: notify-rust compiled for real desktop
- **WHEN** compiled for Windows, macOS, or Linux (non-OHOS)
- **THEN** `notify-rust` SHALL be included as a dependency

### Requirement: Cargo.toml SHALL declare OHOS tauri dependency
A new `[target.'cfg(target_env = "ohos")'.dependencies]` section SHALL declare `tauri` with the `wry` feature, which is required for the `PluginHandle` infrastructure on OHOS.

#### Scenario: OHOS build includes tauri with wry
- **WHEN** compiled with `target_env = "ohos"`
- **THEN** `tauri` with `wry` feature SHALL be available

### Requirement: Cargo.toml SHALL declare OHOS platform support
The `[package.metadata.platforms.support]` section SHALL include an `ohos` entry with level `"partial"`.

#### Scenario: Platform support metadata includes OHOS
- **WHEN** querying crate metadata
- **THEN** `ohos` SHALL be listed with level `"partial"` and a notes field describing supported features

### Requirement: mobile.rs SHALL register OHOS plugin
`src/mobile.rs` SHALL add:
1. A `PLUGIN_IDENTIFIER` constant gated with `#[cfg(target_env = "ohos")]` set to `"@tauri/plugin-notification"`
2. An `api.register_ohos_plugin(PLUGIN_IDENTIFIER, "NotificationPlugin")` call gated with `#[cfg(target_env = "ohos")]`

#### Scenario: OHOS plugin registration succeeds
- **WHEN** `init()` is called on OHOS
- **THEN** the plugin SHALL be registered with identifier `"@tauri/plugin-notification"` and class name `"NotificationPlugin"`, and `run_mobile_plugin()` calls SHALL be dispatched to the ArkTS `NotificationPlugin`

#### Scenario: Android/iOS registration unaffected
- **WHEN** `init()` is called on Android or iOS
- **THEN** the existing `register_android_plugin` / `register_ios_plugin` calls SHALL work as before

### Requirement: Channel methods SHALL support OHOS
The `create_channel`, `delete_channel`, and `list_channels` methods in `src/mobile.rs` SHALL change their cfg gate from `#[cfg(target_os = "android")]` to `#[cfg(any(target_os = "android", target_env = "ohos"))]`, since HarmonyOS 4+ requires notification channels.

#### Scenario: create_channel callable on OHOS
- **WHEN** `notification.create_channel(channel)` is called on OHOS
- **THEN** the call SHALL be dispatched to the ArkTS `NotificationPlugin` via `run_mobile_plugin("createChannel", channel)`

#### Scenario: create_channel still works on Android
- **WHEN** `notification.create_channel(channel)` is called on Android
- **THEN** behavior SHALL be unchanged

