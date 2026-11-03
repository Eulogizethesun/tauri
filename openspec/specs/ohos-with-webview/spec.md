# ohos-with-webview Specification

## Purpose
TBD - created by archiving change p2-web-page-snapshot. Update Purpose after archive.

## Requirements

### Requirement: wry exposes WebViewExtOhos trait
wry SHALL provide a `WebViewExtOhos` trait (gated by `cfg(target_env = "ohos")`) with a `webview_handle()` method that returns the `openharmony_ability::Webview` instance.

#### Scenario: Access OHOS webview handle from wry
- **WHEN** user calls `WebViewExtOhos::webview_handle()` on a wry `WebView`
- **THEN** SHALL return a clone of the inner `openharmony_ability::Webview`

### Requirement: openharmony_ability::Webview is Send
`openharmony_ability::Webview` SHALL implement `Send` via `unsafe impl Send` to allow passing through the `WithWebview` message channel.

#### Scenario: Webview crosses thread boundary
- **WHEN** `Webview` is moved into a `Box<dyn FnOnce(Webview) + Send>` closure
- **THEN** SHALL compile without Send trait errors

### Requirement: tauri-runtime-wry OHOS Webview type is openharmony_ability::Webview
`tauri-runtime-wry` OHOS `Webview` type alias SHALL be `openharmony_ability::Webview` instead of `()`.

#### Scenario: WithWebview handler passes real handle
- **WHEN** `WebviewMessage::WithWebview` is processed on OHOS
- **THEN** handler SHALL call `WebViewExtOhos::webview_handle()` and pass the result to the closure, instead of logging a warning

### Requirement: PlatformWebview OHOS inner() accessor
`PlatformWebview` SHALL provide an `inner()` method (gated by `cfg(target_env = "ohos")`) returning `openharmony_ability::Webview`.

#### Scenario: User accesses OHOS webview via PlatformWebview
- **WHEN** user calls `webview.with_webview(|wv| { let handle = wv.inner(); })`
- **THEN** `handle` SHALL be an `openharmony_ability::Webview` instance with full access to Phase 1 methods (e.g., `web_page_snapshot`)

### Requirement: webview Drop SHALL dispose unconditionally

wry OHOS 后端的 `dispose_child` 与 `InnerWebView::Drop` SHALL 不再以 `is_child` 作前置门控:任何 webview(主 webview 与子 webview)在销毁时 SHALL 触发 `PendingOp::Remove` 派发(dispatch_or_queue:未就绪入队、就绪直发),幂等标志(`disposed` swap)保持不变。该门控原本只对主 webview 跳过 dispose,导致 ArkTS Web 组件残留(僵尸组件吃点击/占资源);移除后主 webview 销毁链与子 webview 一致。桥未就绪时排队的 Remove 若永不补发,由 bridge 既有 15s 超时兜底(DEFAULT_TIMEOUT_MS),设计注释 SHALL 记录该悬挂边界。

#### Scenario: Main webview Drop triggers dispose

- **WHEN** 主窗 webview(非 child)被 Drop(如窗口关闭链)
- **THEN** `PendingOp::Remove` SHALL 派发(dispatch 或入队)
- **AND** ArkTS 侧对应 Web 组件被销毁,不再残留

#### Scenario: Child webview behavior unchanged

- **WHEN** 子 webview Drop(既有路径)
- **THEN** 行为与移除门控前一致(仍走同一 dispatch_or_queue)

#### Scenario: Double dispose remains idempotent

- **WHEN** dispose 被显式调用后 Drop 再次触发
- **THEN** `disposed` AtomicBool swap SHALL 吞掉第二次,只派发一次 Remove

#### Scenario: Not-yet-ready window queues Remove

- **WHEN** Drop 发生在 bridge 握手完成前
- **THEN** Remove SHALL 入 pending 队列;若窗口永不就绪,由 bridge 15s 超时兜底,不悬挂进程退出
