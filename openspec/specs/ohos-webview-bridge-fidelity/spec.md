# ohos-webview-bridge-fidelity Specification

## Purpose
wry OHOS 桥载荷保真:三处桥面丢真值/吞错误——eval 失败吞回调(promise 永不 settle)、invoke 缺 URL 兜底 about:blank(导航完成前取错)、create 通道丢 `style.visible`。本 spec 约束三处的可观察行为。

## Requirements

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

### Requirement: url() SHALL return synchronously with cache fallback

`InnerWebView::url()` SHALL 永不阻塞、永不调用 recv_timeout/block_on(主线程 block_on 死锁族铁律),按线程语境三态分流:Main thread 经既有同步桥基建(`COOKIE_SYNC_APP` OnceLock + `with_main_thread_bridge`)发起 get-url 同步桥调用,成功后写回 `url_cache` 并返回当前真实 URL;Worker thread 直接返回 `url_cache`(p2 #199 已预填),零桥调用;Bridge uninitialized 或同步桥调用失败返回 `url_cache` 并记结构化 debug 日志。

#### Scenario: Main thread returns live URL

- **WHEN** 在主线程调用 `url()` 且同步桥可用
- **THEN** SHALL 经 get-url 同步桥返回 ArkTS 当前真实 URL
- **AND** `url_cache` SHALL 被写回该值

#### Scenario: get-url sync plugin is registered on both ends

- **WHEN** `wry::set_ohos_app` 执行注册链
- **THEN** `WebviewUrlBridgePlugin`(ID `ohos.webview-url`)SHALL 随既有 `set_cookie_sync_app` 注册点 register_plugin(app 句柄 OnceLock 复用,按插件 ID 寻址)
- **AND** ArkTS 侧 get-url 同步 handler SHALL 与 cookie 同步插件同一注册清单注册

#### Scenario: Worker thread returns cache

- **WHEN** 在非主线程调用 `url()`
- **THEN** SHALL 返回 `url_cache` 当前值,零桥调用、零阻塞

#### Scenario: Uninitialized bridge falls back to cache

- **WHEN** bridge 未初始化(Uninitialized)或同步桥调用失败,且 `url()` 被调用
- **THEN** SHALL 返回 `url_cache` 回落值,不 panic、不阻塞

#### Scenario: No main-thread deadlock under bridge re-entry

- **WHEN** 主线程正处于事件循环回调内(桥重入语境)调用 `url()`
- **THEN** 调用 SHALL 返回而不等待桥队列(同步桥为可重入直调形态,与 fetchCookieSync 同一模式)

### Requirement: Webview creation SHALL forward incognitoMode

创建通道 SHALL 支持 incognito 语境:`WebviewStyle` 新增 `incognito` 字段(wire 契约两端同步);`incognitoMode` 是 `WebOptions` **成员**(本地 SDK20 web.d.ts:5217 实证,@since 11;非链式属性)——ArkTS 两分支(Web()/createWebview)在 `incognito === true` 时以 `incognitoMode: true` 传入 WebOptions,默认 false 时行为与现状逐字节一致。

#### Scenario: Incognito webview creation

- **WHEN** wry 以 `with_incognito(true)`(或等价 attrs)创建 webview
- **THEN** WebviewStyle wire 载荷携带 `incognito: true`
- **AND** ArkTS 构造的 Web 组件 `incognitoMode(true)`,cookie/storage 隔离于临时 profile

#### Scenario: Default creation unchanged

- **WHEN** 创建未指定 incognito
- **THEN** wire 载荷该字段缺省(false/absent),ArkTS 分支与现状一致
