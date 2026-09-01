## Requirements

### Cursor 全局删除 + 本地缓存

#### Requirement: tao 本地缓存 cursor 位置
The tao OHOS platform implementation SHALL cache cursor coordinates (`cursor_x`/`cursor_y`) locally in the `handle_mouse_event` Move branch, and `cursor_position()` SHALL read from this local cache instead of global atomic variables.

#### Requirement: 删除 cursor 全局变量
The `app.rs` module SHALL remove `CURSOR_POSITION_X` and `CURSOR_POSITION_Y` global `AtomicI32` variables, the `update_cursor_position` NAPI entry point, and the ArkTS `onMouse→NAPI` bypass path.

#### Scenario: cursor 移动后 cursor_position 返回最新值
- **WHEN** the OHOS runtime dispatches a mouse Move event with coordinates (x, y)
- **THEN** tao's `handle_mouse_event` Move branch stores `self.cursor_x = x; self.cursor_y = y`
- **AND** a subsequent call to `cursor_position()` returns `(x, y)` from the local cache
- **AND** no global atomic variable is read or written

#### Scenario: 删除后无活跃引用
- **WHEN** `CURSOR_POSITION_X`/`CURSOR_POSITION_Y`/`update_cursor_position` are deleted
- **THEN** `cargo check --target aarch64-unknown-linux-ohos` succeeds with zero references to the deleted symbols

### TSFN 全局删除

#### Requirement: 删除 helper 子模块 TSFN 全局
The helper submodules (account, opener, autostart, restart, permission, updater) SHALL delete all 13 TSFN global singletons after confirming zero active references from external consumers.

#### Scenario: TSFN 全局逐个删除
- **WHEN** Phase 1 consumer migration is complete and a TSFN global has zero active references
- **THEN** the TSFN global and its associated `LazyLock`/`OnceLock` declaration are deleted
- **AND** `cargo check` confirms no compilation errors for that submodule

### Unsoundness 修复

#### Requirement: 消除 transmute/ptr::read/ManuallyDrop
The 5 unsoundness sites (2 in `helper/mod.rs` ptr::read + ManuallyDrop, 1 `std::mem::forget`, 2 in `app.rs` lifetime transmute) SHALL be replaced with safe handle APIs and explicit lifetime annotations.

#### Scenario: helper/mod.rs ObjectRef 安全持有
- **WHEN** `ObjectRef` is stored for cross-thread access
- **THEN** `ptr::read` and `ManuallyDrop` wrapping are replaced with a safe NAPI handle that maintains ownership semantics
- **AND** no `unsafe` block is required for the storage operation

#### Scenario: app.rs 回调生命周期安全封装
- **WHEN** `run_loop` or `on_back_press_intercept` registers a callback with a borrowed lifetime
- **THEN** the `transmute` extending the lifetime to `'static + Sync + Send` is replaced with a safe callback encapsulation
- **AND** the callback behavior remains functionally equivalent

### GLOBAL_DISPATCHER 删除

#### Requirement: 删除 menu/event.rs GLOBAL_DISPATCHER
The `GLOBAL_DISPATCHER` lazy singleton in `menu/event.rs` SHALL be deleted as part of seam #4 cleanup, after confirming no active consumers remain.

#### Scenario: GLOBAL_DISPATCHER 删除
- **WHEN** `GLOBAL_DISPATCHER` has zero active references (Phase 0 deprecated the channel, Phase 1 migrated consumers)
- **THEN** the `LazyLock<Mutex<MenuEventDispatcher>>` declaration and all associated methods are deleted
- **AND** `cargo check` succeeds

### Close 队列中性化

#### Requirement: close 队列注释中性化
The close queue (`PENDING_WINDOW_CLOSES`/`notify_window_close`/`drain_pending_window_closes`) SHALL retain its functional behavior but comments referencing `tauri-runtime-wry`/`WindowsStore`/`tao ZST WindowId` SHALL be neutralized or removed.

#### Scenario: close 队列功能不变
- **WHEN** a window close is pending
- **THEN** `drain_pending_window_closes()` still drains the pending close queue
- **AND** comments use neutral terminology (e.g., "consumer event loop") instead of Tauri-specific names
