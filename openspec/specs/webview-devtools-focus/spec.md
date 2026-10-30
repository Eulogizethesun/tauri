# webview-devtools-focus Specification

## Purpose
TBD - created by archiving change p2-webview-devtools-focus. Update Purpose after archive.

## Requirements

### Requirement: Enable web debugging access
The system SHALL enable OHOS web debugging by calling `WebviewController.setWebDebuggingAccess(true)` and recording the enabled state, when `open_devtools()` is invoked.

#### Scenario: open_devtools enables debugging
- **WHEN** `open_devtools()` is called
- **THEN** the system calls `WebviewController.setWebDebuggingAccess(true)` and the tracked debugging-access state becomes `true`

### Requirement: Disable web debugging access
The system SHALL disable OHOS web debugging by calling `WebviewController.setWebDebuggingAccess(false)` and recording the disabled state, when `close_devtools()` is invoked.

#### Scenario: close_devtools disables debugging
- **WHEN** `close_devtools()` is called
- **THEN** the system calls `WebviewController.setWebDebuggingAccess(false)` and the tracked debugging-access state becomes `false`

### Requirement: Report tracked debugging-access state
Because OHOS `WebviewController.setWebDebuggingAccess` has no getter, `is_devtools_open()` SHALL return the ArkTS-side tracked state (a module-level variable in `Utils.ets`, initialized from the webview `devtools` init flag and updated by `open_devtools`/`close_devtools`), NOT a query of the OHOS runtime. The ProxyJsHelper SHALL read this module variable directly (so the state is accurate even before the controller is bound, reflecting the init flag). It SHALL return `false` when neither the init `devtools=true` flag nor `open_devtools()` is in effect.

#### Scenario: is_devtools_open returns tracked state
- **WHEN** `open_devtools()` was called and `is_devtools_open()` is called
- **THEN** the system returns `true`

#### Scenario: is_devtools_open default false
- **WHEN** neither `open_devtools()` nor an init `devtools=true` flag is in effect
- **THEN** `is_devtools_open()` returns `false`

#### Scenario: is_devtools_open reflects init flag
- **WHEN** the webview was created with `devtools: true` (init flag) and `is_devtools_open()` is called
- **THEN** the system returns `true` (init called `setWebDebuggingAccess(true)` and set the tracked state)

#### Scenario: state persists across webview recreation
- **WHEN** a webview called `open_devtools()` (state true) and is then destroyed, and a new webview is created (with `devtools: false`)
- **THEN** `is_devtools_open()` on the new webview returns `true` (the module-level tracked state persists, matching the process-global sticky semantics of `setWebDebuggingAccess`)

### Requirement: DevTools methods keep cfg gate
`open_devtools`/`close_devtools`/`is_devtools_open` SHALL remain gated by `#[cfg(any(debug_assertions, feature = "devtools"))]`, consistent with the webview2 and wkwebview backends, so they only compile in debug or devtools-feature builds.

#### Scenario: devtools methods cfg-gated
- **WHEN** wry is built for OHOS in release without the `devtools` feature
- **THEN** `open_devtools`/`close_devtools`/`is_devtools_open` are not compiled (consistent with other platforms)

### Requirement: focus_parent focuses the webview
`focus_parent()` SHALL delegate to `openharmony-ability::helper::webview::Webview::focus()` (ArkTS `requestFocus`). On desktop platforms `focus_parent` focuses the **parent window** (webkitgtk `parent_window().focus()`, webview2 `SetFocus(parent HWND)`); OHOS has no separate parent window for the webview, so focusing the webview itself is the available approximation (not strictly equivalent for child-webview scenarios). `focus_parent` is currently a wry public API with no external caller (contract completion only). It SHALL NOT be cfg-gated.

#### Scenario: focus_parent calls requestFocus
- **WHEN** `focus_parent()` is called
- **THEN** the system invokes the ArkTS `requestFocus` on the webview and returns `Ok(())`

### Requirement: Global debugging-access semantics documented
Because `WebviewController.setWebDebuggingAccess` is a static global setting, `open_devtools`/`close_devtools` on one webview affect all webviews in the process. This global behavior SHALL be documented in code comments, distinguishing it from the per-webview DevTools behavior on desktop platforms.

#### Scenario: global effect noted
- **WHEN** the implementation toggles debugging access
- **THEN** a code comment notes that `setWebDebuggingAccess` is process-global on OHOS

### Requirement: open_devtools SHALL queue before controller ready

wry OHOS 的 `open_devtools` 在 webview controller 尚未绑定(try_handle 失败)时 SHALL 不再静默丢弃:以 `PendingOp::SetDevtools` 入 pending 队列,握手完成后由既有 drain 重放。devtools 开启状态 SHALL 以进程级布尔记录(setWebDebuggingAccess 为进程级静态 API 语义),与 ArkTS 侧既有 module-level tracked state(「Report tracked debugging-access state」requirement)语义一致;重复 open SHALL 幂等。

#### Scenario: open_devtools before ready queues

- **WHEN** 创建后立即调用 `open_devtools()` 且 controller 未就绪
- **THEN** PendingOp::SetDevtools SHALL 入队
- **AND** 握手完成后重放,Web 调试最终生效

#### Scenario: open_devtools when ready applies immediately

- **WHEN** controller 已绑定后调用 `open_devtools()`
- **THEN** SHALL 立即下发(set_web_debugging_access 运行时通道,零排队)

#### Scenario: is_devtools_open stays tracked

- **WHEN** open_devtools 在排队态被调用后查询 `is_devtools_open()`
- **THEN** SHALL 返回 true(进程级布尔在调用点即置位,不等待重放)

#### Scenario: Repeat open is idempotent

- **WHEN** open_devtools 被连续调用两次
- **THEN** 第二次 SHALL 幂等(状态已 true,不重复入队或下发后无副作用)

#### Scenario: cfg gate preserved

- **WHEN** 非 OHOS 平台编译
- **THEN** devtools 相关新增代码 SHALL 维持既有 cfg 门(与「DevTools methods keep cfg gate」requirement 一致)
