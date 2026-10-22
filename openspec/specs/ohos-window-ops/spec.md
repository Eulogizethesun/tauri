# ohos-window-ops Specification

## Purpose
TBD - created by archiving change p1-ohos-window-ops. Update Purpose after archive.

## Requirements

### Requirement: Window position can be set on OHOS
The system SHALL implement `Window::set_outer_position` on OHOS to move the window by calling `@kit.ArkUI/window` `moveWindowTo(x, y)` through the `openharmony-ability` NAPI bridge. The operation is fire-and-forget (returns immediately after dispatching).

#### Scenario: set_position moves the OHOS window
- **WHEN** `tauri::Window::set_position(PhysicalPosition { x, y })` is called on OHOS
- **THEN** the OHOS window is moved to `(x, y)` via `win.moveWindowTo(x, y)`

#### Scenario: set_position does not block the caller
- **WHEN** `set_position` is invoked
- **THEN** the Rust call returns without awaiting the OHOS async `moveWindowTo` Promise (fire-and-forget)

### Requirement: Window size can be set on OHOS
The system SHALL implement `Window::set_inner_size` on OHOS to resize the window by calling `@kit.ArkUI/window` `resize(width, height)` through the `openharmony-ability` NAPI bridge (fire-and-forget).

#### Scenario: set_size resizes the OHOS window
- **WHEN** `tauri::Window::set_size(PhysicalSize { width, height })` is called on OHOS
- **THEN** the OHOS window is resized via `win.resize(width, height)`

### Requirement: Window maximize state can be set and queried on OHOS
The system SHALL implement `Window::set_maximized` and `Window::is_maximized` on OHOS. `set_maximized(true)` SHALL call `win.maximize(window.MaximizePresentation.EXIT_IMMERSIVE)` (API 12, public; `EXIT_IMMERSIVE` yields a true MAXIMIZE state — the default `ENTER_IMMERSIVE` enters FULL_SCREEN, which would make `getWindowStatus()` return FULL_SCREEN instead of MAXIMIZE and break `is_maximized`; device-test to confirm). `set_maximized(false)` SHALL call `recover_window()` (API 7+, public; transitions MAXIMIZE/FULL_SCREEN → FLOATING), exposed via the openharmony-ability `recover_window` NAPI bridge. (`restore()` only restores from MINIMIZE, not MAXIMIZE, so it cannot be used for unmaximize; `setWindowMode` is system-only.) `is_maximized` SHALL synchronously return `true` iff `win.getWindowStatus() === window.WindowStatusType.MAXIMIZE` (API 12).

#### Scenario: maximize then query returns true
- **WHEN** `set_maximized(true)` is called with EXIT_IMMERSIVE and the window reaches maximized state (getWindowStatus === MAXIMIZE)
- **THEN** a subsequent `is_maximized()` returns `true`

#### Scenario: unmaximize via set_maximized(false) recovers to FLOATING
- **WHEN** `set_maximized(false)` is called on a maximized window
- **THEN** it calls `recover_window()` (API 7+, public), transitioning the window from MAXIMIZE/FULL_SCREEN to FLOATING

#### Scenario: is_maximized returns false for non-maximized window
- **WHEN** `getWindowStatus()` is not MAXIMIZE (UNDEFINED/FULL_SCREEN/FLOATING/SPLIT_SCREEN/MINIMIZE)
- **THEN** `is_maximized()` returns `false`

### Requirement: Window minimize state can be set and queried on OHOS
The system SHALL implement `Window::set_minimized` and `Window::is_minimized` on OHOS. `set_minimized(true)` SHALL call `win.minimize()` (API 11, public, not deprecated). `set_minimized(false)` SHALL call `win.restore()` (API 14) via version guard — on API 12 it is a no-op+warn (`showWindow()` cannot restore a minimized main window; `setWindowMode` is system-only). `is_minimized` SHALL synchronously return `true` iff `win.getWindowStatus() === window.WindowStatusType.MINIMIZE` (API 12).

#### Scenario: minimize then query returns true
- **WHEN** `set_minimized(true)` is called and the window reaches minimized state (getWindowStatus === MINIMIZE)
- **THEN** a subsequent `is_minimized()` returns `true`

#### Scenario: is_minimized returns false for non-minimized window
- **WHEN** `getWindowStatus()` is not MINIMIZE
- **THEN** `is_minimized()` returns `false`

### Requirement: Window visibility can be controlled on OHOS with hide workaround
The system SHALL implement `Window::set_visible` on OHOS. `set_visible(false)` SHALL call `win.minimize()` (API 11, hide workaround; OHOS has no direct hide API). `set_visible(true)` SHALL call `win.restore()` (API 14, version-guarded) + `win.showWindow()` (API 9); on API 12 restore is unavailable → showWindow best-effort (may not restore a minimized main window) + warn. Documented side effect: `set_visible(false)` (minimize) causes `is_minimized()` to return `true` (getWindowStatus === MINIMIZE), unlike Windows/macOS hide which does not affect minimized state.

#### Scenario: show a hidden window
- **WHEN** `set_visible(true)` is called
- **THEN** on API ≥14 `win.restore()` + `win.showWindow()` are invoked; on API 12 `win.showWindow()` best-effort + warn

#### Scenario: hide uses minimize workaround
- **WHEN** `set_visible(false)` is called
- **THEN** the window is minimized via `win.minimize()` (documented workaround; OHOS has no direct hide API)

### Requirement: Window operations are isolated to OHOS
All new OHOS window-operation code SHALL be gated by `cfg(target_env = "ohos")` and MUST NOT alter the behavior of Windows, macOS, or Linux builds. The tao methods replaced (previously no-op on OHOS) SHALL only affect the OHOS compile path.

#### Scenario: non-OHOS builds unaffected
- **WHEN** tao is built for Windows/macOS/Linux
- **THEN** the existing platform implementations remain unchanged (no OHOS code compiled in)

### Requirement: Window operations route through openharmony-ability
All OHOS window operations in tao SHALL be performed via the `openharmony-ability` NAPI bridge (Rust fn → ArkTS method → `@kit.ArkUI/window`). tao MUST NOT call ArkTS/`@kit.ArkUI/window` directly.

#### Scenario: tao calls bridge, not ArkTS directly
- **WHEN** a tao OHOS Window method (set_position/set_size/set_maximized/set_minimized/set_visible/is_maximized/is_minimized) is invoked
- **THEN** it calls the corresponding `openharmony-ability::window::*` function, which calls the ArkTS method, which calls `@kit.ArkUI/window`

### Requirement: window-state plugin restores window geometry on OHOS
With the above operations implemented, `tauri-plugin-window-state` SHALL persist and restore window position, size, maximized, minimized, visible, and decorated state across app restarts on OHOS desktop (the plugin itself is platform-agnostic and requires no code change, only enablement).

#### Scenario: window state restored after restart
- **WHEN** the app is restarted after the window was moved/resized/maximized
- **THEN** window-state restores the saved position, size, and maximized state on launch (decorated already worked; position/size/maximized newly working)

#### Scenario: is_maximized/is_minimized reflect real state on save
- **WHEN** window-state saves state (on close/window event)
- **THEN** `is_maximized()`/`is_minimized()` return the actual window state (via `getWindowStatus()` === WindowStatusType.MAXIMIZE/MINIMIZE), not a constant `false`

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

### Requirement: Creation-time window attributes SHALL seed and replay via pending ops

窗口创建时 `WindowAttributes` 中的创建期参数 SHALL 在 build() 尾经既有 setter 通道接入(dispatch_or_queue:窗口未就绪时入 PENDING_WINDOW_OPS 队列,握手后由 drain_ready_pending_window_ops 补发):

- **播种**:`always_on_top` 与 `decoration_flags` 与默认值存在差异时调用既有 setter;
- **补发**:`fullscreen`/`maximized`/`focused` 三参数按 attrs 存在性一次性补发(HEAD 实证其此前零消费;upstream windows 后端构造尾 attrs 应用先例同形态)。

禁止绕过队列直接调用未就绪的 bridge;默认值不产生多余命令。几何类 attrs(位置/尺寸)已由既有创建通道处理,不在本 requirement 范围。主窗 decorations 的既有 apply 通道(8dd79f77)与 Float create params 传递不受影响。

#### Scenario: always_on_top seeds before ready

- **WHEN** 窗口以 `with_always_on_top(true)` 创建且 bridge client 尚未就绪
- **THEN** build() 尾调用的 set_always_on_top SHALL 入 pending 队列
- **AND** 握手完成后补发,窗口最终置顶生效

#### Scenario: fullscreen attr replays after handshake

- **WHEN** 窗口以 `with_fullscreen(true)`(或等价 attrs)创建且创建时 bridge 未就绪
- **THEN** build() 尾的补发调用 SHALL 入 pending 队列,握手后重放
- **AND** 窗口最终进入 fullscreen 态

#### Scenario: already-ready window applies immediately

- **WHEN** build() 尾 setter 执行时窗口已就绪
- **THEN** SHALL 立即下发而非排队(与运行期同名 setter 语义一致)

#### Scenario: default attributes produce no extra traffic

- **WHEN** 窗口创建未设置 always_on_top/fullscreen/maximized/focused 且 decoration_flags 为 FLAG_ALL 默认值
- **THEN** build() 尾 SHALL 不发多余命令(仅与默认值存在差异的参数才播种/补发)

### Requirement: Window command failures SHALL surface as invoke errors

窗口命令在 ArkTS 侧执行失败时 SHALL 不再被 serializeOp 的 catch 静默吞掉:操作型命令(set-title/set-topmost/set-cursor-icon/set-cursor-visible)SHALL await 执行结果并在失败时 reject 桥接 promise(经既有 windowCommand await 先例);void-setter 类(set-decoration-flags/set-fullscreen/show)SHALL 以 try/throw 上抛。Rust 侧消费沿用既有 `call::<Req, WindowAcknowledgement>().ensure()` ack 通道与 throw→Rust Err 先例(focus/set-decorations),预期零新增传输代码。新增的 tracked 序列化路径(serializeOpTracked)SHALL 保持命令链延续语义(后续命令不因前序失败而停摆)。

#### Scenario: set-title failure propagates

- **WHEN** ArkTS setWindowTitle 抛出(如窗口已销毁)且 Rust 侧发起 set-title
- **THEN** 桥接 promise SHALL reject
- **AND** Rust `ensure()` SHALL 得到 Err(而非默认 WindowAcknowledgement 假成功)

#### Scenario: void-setter failure throws

- **WHEN** set-decoration-flags 执行抛出
- **THEN** 异常 SHALL 上抛至桥层形成 reject(serializeOpTracked 的 catch 不再吞错,只记日志)

#### Scenario: command chain continues after a tracked failure

- **WHEN** 某命令 tracked promise reject 后同一窗口继续下发后续命令
- **THEN** 后续命令 SHALL 正常执行(链延续,无队列停摆)

#### Scenario: success path unchanged

- **WHEN** 命令执行成功
- **THEN** WindowAcknowledgement 返回路径与现状一致,零行为变化
