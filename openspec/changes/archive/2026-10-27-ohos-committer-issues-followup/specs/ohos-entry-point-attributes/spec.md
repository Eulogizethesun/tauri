# ohos-entry-point-attributes — ohos-committer-issues-followup Spec Delta

## ADDED Requirements

### Requirement: Dual entry-point attributes expand to exactly one glue set
The system SHALL provide `tauri::ohos::entry_point` (proc macro `ohos_entry_point` re-exported from `tauri::ohos`, present only on OHOS targets) alongside `tauri::mobile_entry_point`. Both attributes SHALL expand the same products from a single implementation; when both are written (either order) the first expander SHALL strip the sibling attribute from the re-emitted function, so exactly one glue set is generated without duplicate definitions (no E0428).

#### Scenario: both attributes in either order
- **WHEN** a function carries `#[cfg_attr(mobile, tauri::mobile_entry_point)]` and `#[cfg_attr(target_env = "ohos", tauri::ohos::entry_point)]` (either order)
- **THEN** exactly one expander emits glue and the crate compiles on phone/tablet and 2in1 OHOS forms

#### Scenario: full-path sibling stripping
- **WHEN** both attributes are written with their full paths (`tauri::mobile_entry_point` / `tauri::ohos::entry_point`)
- **THEN** the sibling is recognized and stripped; an aliased import (`use tauri::ohos::entry_point as x`) is NOT recognized, degrading to two glue sets caught at build time (E0428) — disclosed boundary

### Requirement: Entry glue is platform-complementary gated
Emitted entry glue SHALL be gated by target platform: the mobile half (iOS `start_app`, Android JNI binding) under `cfg(not(target_env = "ohos"))`, the OHOS half (NAPI module) under `cfg(target_env = "ohos")`, so any target compiles exactly one set (proc macros cannot see the target platform). Unrelated attributes on the function SHALL pass through unaffected.

#### Scenario: single-line any-form remains valid
- **WHEN** a function uses only `#[cfg_attr(any(mobile, target_env = "ohos"), tauri::mobile_entry_point)]`
- **THEN** it compiles and provides the entry on both OHOS forms (upstream-compatible form still legal)

#### Scenario: upstream single mobile line on 2in1 does not expand
- **WHEN** a function uses only `#[cfg_attr(mobile, tauri::mobile_entry_point)]` and is built for the 2in1 form (OHOS_DEVICE_TYPE=desktop)
- **THEN** the attribute does not expand (cfg(mobile) is false) and the symbol check fails the build — an inherent boundary of the upstream form, disclosed rather than fixed

#### Scenario: other attributes unaffected
- **WHEN** the entry function also carries unrelated attributes
- **THEN** they are re-emitted unchanged

### Requirement: OHOS symbol-check failures point to both entry attributes
The tauri CLI's OHOS symbol check (DevEco studio script / `.so` validation) SHALL, on a missing `openharmony_ability_mod` symbol, report an error naming both `tauri::mobile_entry_point` and `tauri::ohos::entry_point` as the ways to provide the entry (instead of naming only the mobile attribute).

#### Scenario: missing symbol error text
- **WHEN** the built `.so` lacks the required entry symbol
- **THEN** the build fails with a message pointing to both entry-point attributes
