## ADDED Requirements

### Requirement: OHOS minidump exclusion
The plugin SHALL exclude `sentry-rust-minidump` dependency on OHOS platform, similar to the existing iOS exclusion. The `cfg` condition MUST be `all(not(target_os = "ios"), not(target_env = "ohos"))` for the dependency declaration, and `all(not(target_os = "ios"), not(target_env = "ohos"), feature = "minidump")` for the re-export.

#### Scenario: Compile on OHOS without minidump
- **WHEN** the project is compiled with `cargo check --target aarch64-unknown-linux-ohos`
- **THEN** `sentry-rust-minidump` MUST NOT be included as a dependency
- **THEN** compilation MUST succeed without errors related to `crash-handler` or `minidumper`

#### Scenario: Compile on non-OHOS desktop with minidump
- **WHEN** the project is compiled on Windows/macOS/Linux (not OHOS)
- **THEN** `sentry-rust-minidump` MUST be included when the `minidump` feature is enabled
- **THEN** the `minidump` re-export in `lib.rs` MUST be available

### Requirement: JS error capture on OHOS
The plugin SHALL capture JavaScript errors from the WebView on OHOS desktop. The `inject.min.js` script MUST be injected via `js_init_script` mechanism, which maps to `javaScriptOnDocumentStart` on OHOS WebView (API 12).

#### Scenario: JS error forwarded to Rust
- **WHEN** a JavaScript error occurs in the WebView on OHOS desktop
- **THEN** `@sentry/browser` SDK captures the error
- **THEN** `makeRendererTransport` invokes `plugin:sentry|envelope` with the envelope data
- **THEN** the Rust `envelope` command receives and processes the envelope

#### Scenario: Breadcrumb forwarded to Rust
- **WHEN** a breadcrumb event occurs in the WebView (e.g., navigation, console.log)
- **THEN** `sendBreadcrumbToRust` invokes `plugin:sentry|breadcrumb` with the breadcrumb data
- **THEN** the Rust `breadcrumb` command adds it to the sentry scope

### Requirement: Envelope transport on OHOS
The plugin SHALL transport Sentry envelopes from the JS process to the Rust process via Tauri invoke IPC on OHOS. The transport MUST handle both text and raw binary envelope formats.

#### Scenario: Text envelope transport
- **WHEN** the JS SDK sends a text-format envelope via `invoke('plugin:sentry|envelope')`
- **THEN** the Rust `envelope` command MUST parse the envelope correctly
- **THEN** events with `platform: "javascript"` MUST be captured via `sentry::capture_event`

#### Scenario: Envelope with attachments
- **WHEN** the JS SDK sends an envelope containing attachments
- **THEN** attachments MUST be extracted and added to the sentry scope
- **THEN** the event MUST be captured with attachments included

### Requirement: OHOS network permission
Applications using the plugin on OHOS MUST declare `ohos.permission.INTERNET` in their `module.json5` to allow the Rust sentry crate to send data to Sentry servers.

#### Scenario: Network permission configured
- **WHEN** an OHOS application includes sentry-tauri plugin
- **THEN** the application's `module.json5` MUST include `ohos.permission.INTERNET` in `requestPermissions`
- **THEN** the sentry crate MUST be able to send HTTP requests to the Sentry DSN endpoint

### Requirement: Sentry event platform correction
When processing JS-originated events on OHOS, the Rust side MUST set `event.platform = "javascript"`, remove `release`/`environment`/`dist` fields (these come from Rust config), and remove the `User-Agent` header to prevent Sentry from displaying incorrect browser information.

#### Scenario: Event fields corrected for JS origin
- **WHEN** the Rust `envelope` command processes a JS event
- **THEN** `event.platform` MUST be set to `"javascript"`
- **THEN** `event.release`, `event.environment`, `event.dist` MUST be `None`
- **THEN** the `User-Agent` header MUST be removed from `event.request.headers`

### Requirement: TLS backend uses rustls on OHOS
The sentry crate MUST use `rustls` as the TLS backend on OHOS, instead of the default `native-tls` (openssl). This avoids the need to cross-compile openssl for OHOS via lycium.

#### Scenario: rustls backend on OHOS
- **WHEN** the sentry crate sends HTTPS requests to the Sentry server on OHOS
- **THEN** the TLS connection MUST use rustls (pure Rust implementation)
- **THEN** certificate verification MUST work with OHOS system root certificates

#### Scenario: native-tls still used on other platforms
- **WHEN** the sentry crate is compiled on Windows/macOS/Linux
- **THEN** the default `native-tls` backend MAY be used (openssl/Schannel/Security.framework)

### Requirement: Example app conditional compilation
The example application MUST use conditional compilation to exclude platform-specific features on OHOS. The `minidump::init` call and `native_crash` command MUST be guarded with `#[cfg(all(not(target_os = "ios"), not(target_env = "ohos")))]`.

#### Scenario: Example compiles on OHOS without minidump
- **WHEN** the example app is compiled for OHOS target
- **THEN** `tauri_plugin_sentry::minidump::init` MUST NOT be called
- **THEN** the `native_crash` command MUST NOT be registered
- **THEN** `sadness-generator` crate MUST NOT be included as a dependency

#### Scenario: Example retains full functionality on other platforms
- **WHEN** the example app is compiled for Windows/macOS/Linux
- **THEN** `minidump::init` MUST be called
- **THEN** `native_crash` command MUST be available
- **THEN** `sadness-generator` MUST be included

## Test Cases

### auto: 编译验证
- **T-001**: `cargo check --target aarch64-unknown-linux-ohos` 编译通过
- **T-002**: `cargo check --target aarch64-unknown-linux-ohos --features minidump` 编译通过（minidump 被静默跳过）
- **T-003**: `cargo check`（默认 host target）编译通过，minidump 功能正常
- **T-010**: 示例应用 `cargo check --target aarch64-unknown-linux-ohos` 编译通过（minidump 和 native_crash 已排除）

### side-effect: JS 错误端到端
- **T-004**: WebView 中触发 `throw new Error('test')` → Sentry 仪表盘收到事件
- **T-005**: WebView 中触发 breadcrumb（如页面导航） → Sentry scope 包含该 breadcrumb
- **T-006**: 发送包含 attachment 的 envelope → Sentry 事件包含该 attachment
- **T-011**: 触发 `rust_panic` command → Sentry 捕获到 panic 事件（OHOS 上 Rust panic 仍可捕获）

### manual: Sentry 仪表盘验证
- **T-007**: Sentry 仪表盘中事件的 platform 显示为 "javascript"
- **T-008**: Sentry 仪表盘中事件的 User-Agent 不包含 OHOS WebView 信息
- **T-009**: 多次错误事件均被正确捕获和显示
