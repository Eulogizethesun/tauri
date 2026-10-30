# ohos-webview-bridge-fidelity Specification

## MODIFIED Requirements(Purpose 扩展)

Purpose 增补:③`url()` 同步读取三态语义(#192);④创建通道转发 incognitoMode(#188)。

## ADDED Requirements

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
