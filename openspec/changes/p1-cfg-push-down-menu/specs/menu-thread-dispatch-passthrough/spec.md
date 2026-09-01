# Specification: menu-thread-dispatch-passthrough

## ADDED Requirements

### Requirement: OHOS macro dispatch executes closures inline

The `run_main_thread!` and `run_item_main_thread!` macros SHALL, when compiled with `target_env = "ohos"`, execute the wrapped closure directly on the calling thread and return its result, without scheduling onto the main thread or blocking on a receive channel.

#### Scenario: OHOS macro does not schedule onto the main thread

- **WHEN** a menu/tray wrapper method invokes `run_main_thread!` or `run_item_main_thread!` on an OHOS target
- **THEN** the macro SHALL execute the closure on the calling thread
- **AND** the macro SHALL NOT call `run_on_main_thread`
- **AND** the macro SHALL NOT block on an mpsc `recv()`

#### Scenario: OHOS macro returns the closure result

- **WHEN** the wrapped closure returns `Result<T, E>`
- **THEN** the macro SHALL return that `Result` to the caller unchanged
- **AND** no `FailedToReceiveMessage` error SHALL be introduced on the OHOS path

### Requirement: Non-OHOS macro dispatch is unchanged

The macros SHALL, when compiled on any non-OHOS target, retain the existing `run_on_main_thread` + `rx.recv()` blocking dispatch, byte-for-byte identical to the pre-change behavior.

#### Scenario: Windows/macOS/Linux path still blocks on the main thread

- **WHEN** a wrapper method invokes the macro on a non-OHOS target
- **THEN** the macro SHALL create an mpsc channel, schedule the closure via `run_on_main_thread`, and block on `rx.recv()`
- **AND** the `FailedToReceiveMessage` error path SHALL be preserved

### Requirement: Call sites are platform-neutral

Menu and tray wrapper methods SHALL invoke the dispatch macro unconditionally, without a per-site `#[cfg(target_env = "ohos")]` inline-execution branch for non-mutation operations. The macro itself SHALL be the single decision point for OHOS vs. non-OHOS dispatch.

#### Scenario: Getter and constructor sites have no OHOS branch

- **WHEN** a menu getter (`text`, `is_enabled`, `is_checked`, `id`, etc.), constructor, or any `tray/mod.rs` method is compiled
- **THEN** the method body SHALL contain exactly one macro invocation
- **AND** there SHALL be no `#[cfg(target_env = "ohos")]` branch selecting an inline alternative

#### Scenario: Tray methods are fully normalized

- **WHEN** any method in `tray/mod.rs` is compiled
- **THEN** the method body SHALL be a single unconditional macro call
- **AND** there SHALL be no residual `#[cfg(target_env = "ohos")]` directive in the method body

### Requirement: Menu mutations retain an OHOS-only refresh hook

Menu mutation methods (`setText`, `setEnabled`, `setAccelerator`, `setChecked`, `setIcon`, `add`, `remove`, `append`, `insert`, `prepend`) SHALL invoke the dispatch macro once, followed by a single-sided `#[cfg(target_env = "ohos")] auto_refresh_menubar(...)` post-call. No paired `#[cfg(not(target_env = "ohos"))]` branch SHALL remain.

#### Scenario: Menu mutation dispatches through the macro then refreshes on OHOS

- **WHEN** a menu mutation method is invoked on OHOS
- **THEN** the muda mutation SHALL be executed via the macro's inline-dispatch arm
- **AND** `auto_refresh_menubar` SHALL be called afterward to re-serialize the menu and push it to ArkTS
- **AND** on non-OHOS targets the `auto_refresh_menubar` call SHALL not be compiled

#### Scenario: Menu mutation has no paired non-OHOS branch

- **WHEN** a menu mutation method body is inspected
- **THEN** there SHALL be exactly one macro invocation
- **AND** there SHALL be at most one `#[cfg(target_env = "ohos")]` directive (the refresh hook)
- **AND** there SHALL be no `#[cfg(not(target_env = "ohos"))]` directive

### Requirement: Platform isolation

The OHOS inline-dispatch arm SHALL be gated exclusively by `cfg(target_env = "ohos")`. No non-OHOS target SHALL compile the inline-dispatch arm, and no OHOS target SHALL compile the `run_on_main_thread` + `recv` arm.

#### Scenario: Non-OHOS builds do not include the inline arm

- **WHEN** the crate is compiled for a non-OHOS target
- **THEN** the OHOS inline-dispatch macro arm SHALL not be compiled
- **AND** only the `run_on_main_thread` + `recv` arm SHALL be present

#### Scenario: OHOS builds do not include the blocking arm

- **WHEN** the crate is compiled with `target_env = "ohos"`
- **THEN** the `run_on_main_thread` + `recv` macro arm SHALL not be compiled
- **AND** only the inline-dispatch arm SHALL be present
