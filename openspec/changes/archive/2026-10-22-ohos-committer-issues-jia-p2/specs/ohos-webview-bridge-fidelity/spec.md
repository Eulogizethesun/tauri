# ohos-webview-bridge-fidelity Specification

## Purpose

wry OHOS 桥载荷保真:三处桥面丢真值/吞错误——eval 失败吞回调(promise 永不 settle)、invoke 缺 URL 兜底 about:blank(导航完成前取错)、create 通道丢 `style.visible`。本 spec 约束三处的可观察行为。

## ADDED Requirements

### Requirement: Failed eval SHALL resolve the callback with "null"
When the asynchronous evaluation of a script fails on OHOS, the pending callback SHALL be invoked with the literal string `"null"` (in addition to the failure warn), so the awaiting promise settles instead of hanging forever.

#### Scenario: Eval failure settles the awaiting promise
- **WHEN** an eval dispatched to the webview fails to execute
- **THEN** a warn is emitted and the callback is invoked with `"null"`
- **AND** the awaiting promise resolves (with `null`) rather than never settling

#### Scenario: Successful eval unchanged
- **WHEN** an eval succeeds
- **THEN** the callback receives the evaluation result exactly as before

### Requirement: Invoke before navigation SHALL use the initial URL
The IPC handler's URL resolution SHALL observe the webview's initial URL from the moment of creation: the URL cache SHALL be pre-filled with the initial URL, so the first invoke that occurs before page navigation completes resolves against the real page URL instead of the `about:blank` fallback.

#### Scenario: First invoke resolves the initial URL
- **WHEN** a webview is created with initial URL `https://example.com/app` and an IPC invoke arrives before navigation completes
- **THEN** the handler resolves the URL as `https://example.com/app`, not `about:blank`

#### Scenario: about:blank fallback remains as a last resort
- **WHEN** neither the cache nor the webview yields a URL
- **THEN** the existing `about:blank` fallback applies unchanged

### Requirement: Creation SHALL forward style.visible
The webview creation request SHALL forward the requested visibility to the ArkTS layer via the existing `style.visible` field of the outbound style payload (zero NAPI contract change), and the public `with_visible` documentation SHALL state that OHOS forwards the value instead of ignoring it.

#### Scenario: Visible false is carried in the creation payload
- **WHEN** a webview is created with `with_visible(false)`
- **THEN** the outbound creation style payload contains `visible: false`

#### Scenario: Default creation omits or forwards true unchanged
- **WHEN** a webview is created with default visibility
- **THEN** the ArkTS receiver observes the same visibility semantics as before (no regression)

#### Scenario: Documentation matches behavior
- **WHEN** the `with_visible` public documentation is read for the OpenHarmony platform
- **THEN** it no longer claims the value is ignored and always-created-visible
- **AND** it states the value is forwarded as `style.visible`
