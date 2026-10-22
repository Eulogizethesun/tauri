# ohos-window-ops Delta

## ADDED Requirements

### Requirement: Bridge client is lazily re-fetched after a construction-time failure
The OHOS window's cached bridge client SHALL be recoverable: when the client could not be captured at window construction (bridge not yet ready), subsequent access attempts SHALL re-fetch through the application bridge, and a successful re-fetch SHALL overwrite the cached value for later callers. Re-fetch failures SHALL be reported with a warn that is emitted once (not per call).

#### Scenario: Client captured at construction is used without re-fetch
- **WHEN** the window was constructed with a working bridge and a consumer requests the bridge client
- **THEN** the cached client is returned and no re-fetch is attempted

#### Scenario: Failed capture recovers on later access
- **WHEN** the construction-time capture failed and a later access attempt finds the bridge available
- **THEN** the client is re-fetched, stored in the cache (overwriting the empty value), and returned
- **AND** subsequent access attempts use the stored client without a new fetch

#### Scenario: Persistent failure warns once
- **WHEN** the construction-time capture failed and the bridge remains unavailable across multiple access attempts
- **THEN** each attempt returns no client
- **AND** exactly one warn is emitted for the failure (deduplicated, no log storm from hot paths)

### Requirement: set_enabled on OHOS reports unsupported instead of faking success
`set_enabled` on OHOS SHALL return `Err(Error::NotSupported)` from the window dispatcher instead of silently succeeding, so callers can distinguish the platform gap. The behavior SHALL be isolated to OHOS builds, and the public `WindowExt::set_enabled`/`is_enabled` docs SHALL carry an OpenHarmony platform-specific line describing this.

#### Scenario: set_enabled returns NotSupported on OHOS
- **WHEN** `window.set_enabled(false)` is called on OHOS
- **THEN** the dispatcher returns `Err` with a `NotSupported` error mentioning the OHOS gap
- **AND** the no-op tao-side implementation is never invoked

#### Scenario: Other platforms unchanged
- **WHEN** `set_enabled` is called on Windows/macOS/Linux/mobile
- **THEN** the existing behavior (enable/disable, or mobile no-op) is unchanged

### Requirement: set_cursor_grab failures are surfaced with a structured warning
`set_cursor_grab` failures SHALL NOT be silent anywhere in the dispatch chain: the OHOS implementation SHALL emit a structured warn containing the window identifier (window id) and the platform error when the asynchronous apply fails (this warn already exists at HEAD and is kept — the implementation task is verification, not new code), and the tauri-runtime-wry dispatcher SHALL warn when the underlying call returns `Err` instead of discarding it.

#### Scenario: Asynchronous grab failure warns with context
- **WHEN** `set_cursor_grab(true)` is dispatched on OHOS (API >= 22) and the asynchronous apply fails
- **THEN** a warn containing the window id and the failure reason is emitted (verified present at HEAD, unchanged)

#### Scenario: Dispatcher no longer swallows the error
- **WHEN** the tauri-runtime-wry main-thread arm executes `set_cursor_grab` and it returns `Err`
- **THEN** the error is logged via `warn` (the value is no longer discarded with `let _`)
- **AND** the functional behavior on all platforms is unchanged (log-only change)
