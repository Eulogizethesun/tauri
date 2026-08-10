# ohos-webview-proxy-config Specification

## Purpose
让 wry `WebViewAttributes.proxy_config`（`ProxyConfig::Http` / `ProxyConfig::Socks5`，`wry/src/lib.rs:781`）在 OHOS 后端真正生效。当前 `wry/src/ohos/mod.rs:61-87` 解构 `WebViewAttributes` 时该字段落入 `..` catch-all 被静默丢弃，全文无 `proxy_config` 引用。本 spec 通过 `openharmony-ability` NAPI 桥调用 ArkWeb `webview.ProxyController.applyProxyOverride`（`@ohos.web.webview`，`SystemCapability.Web.Webview.Core`，`since 15`），将 wry `ProxyConfig` 映射为 ArkWeb 代理规则。

契约差距 = wry 公共字段 `proxy_config` 在 OHOS 无实现 → 流量始终走系统代理或直连，开发者通过 `WebViewBuilder::with_proxy_config(...)`（`wry/src/lib.rs:1400`）设置的代理被忽略。

## ADDED Requirements

### Requirement: wry OHOS SHALL extract proxy_config from WebViewAttributes
`InnerWebView::new_inner`（`wry/src/ohos/mod.rs`）SHALL 在解构 `WebViewAttributes` 时显式列出 `proxy_config` 字段，不再让其落入 `..` catch-all。提取的 `Option<ProxyConfig>` SHALL 在 webview 创建后、初始 URL 加载前，经 `openharmony_ability` 桥接下发到 ArkWeb。

#### Scenario: proxy_config is None
- **WHEN** 开发者未调用 `.with_proxy_config(...)`（`proxy_config = None`）
- **THEN** Rust 端 SHALL NOT 调用 `apply_proxy_override`
- **AND** ArkWeb SHALL 沿用系统代理设置（与 Windows / webkitgtk 行为一致）

#### Scenario: proxy_config is Http
- **WHEN** 开发者调用 `.with_proxy_config(ProxyConfig::Http(ProxyEndpoint { host, port }))`
- **THEN** Rust 端 SHALL 调用 `openharmony_ability::apply_proxy_override("http", host, port)`
- **AND** ArkTS 端 SHALL 构造 `new webview.ProxyConfig()` 并 `insertProxyRule(\`http://${host}:${port}\`)`（无 schemeFilter = MATCH_ALL_SCHEMES）
- **AND** SHALL 调用 `webview.ProxyController.applyProxyOverride(config, callback)`

#### Scenario: proxy_config is Socks5
- **WHEN** 开发者调用 `.with_proxy_config(ProxyConfig::Socks5(ProxyEndpoint { host, port }))`
- **THEN** Rust 端 SHALL 调用 `openharmony_ability::apply_proxy_override("socks", host, port)`（wry `ProxyConfig::Socks5` 对应 ArkWeb scheme `"socks"`）
- **AND** ArkTS 端 SHALL `insertProxyRule(\`socks://${host}:${port}\`)`
- **AND** SHALL 调用 `webview.ProxyController.applyProxyOverride(config, callback)`

### Requirement: openharmony-ability SHALL expose apply_proxy_override / remove_proxy_override
`openharmony-ability` crate（唯一 ArkTS 桥接仓，见 CLAUDE.md 三铁律 #1）SHALL 暴露 Rust 公共函数：
- `pub fn apply_proxy_override(scheme: &str, host: &str, port: &str) -> Result<()>`
- `pub fn remove_proxy_override() -> Result<()>`

`apply_proxy_override` 内部 SHALL 通过 `get_main_thread_env()` + `get_helper()` 获取 ArkTS helper 对象，调用名为 `applyProxyOverride` 的 ArkTS 方法（camelCase，见 ohos-constraints §2.1）。`remove_proxy_override` 同理调用 `removeProxyOverride`。

ArkTS 侧 SHALL 在 helper 对象上实现：
```ts
applyProxyOverride(scheme: string, host: string, port: string): void {
  const config = new webview.ProxyConfig();
  config.insertProxyRule(`${scheme}://${host}:${port}`);
  webview.ProxyController.applyProxyOverride(config, () => {
    // callback on UI thread; no Rust round-trip (NAPI reentry per ohos-constraints §2.3)
  });
}
removeProxyOverride(): void {
  webview.ProxyController.removeProxyOverride(() => {});
}
```

#### Scenario: applyProxyOverride NAPI name camelCase
- **WHEN** Rust 通过 NAPI 调用 ArkTS
- **THEN** ArkTS 方法名 SHALL 为 `applyProxyOverride`（不是 `apply_proxy_override`）
- **AND** 若误用 snake_case，`typeof helper.apply_proxy_override` SHALL 为 `undefined` 且静默失败（见 ohos-constraints §2.1）

#### Scenario: applyProxyOverride is fire-and-forget
- **WHEN** Rust 调用 `apply_proxy_override(...)`
- **THEN** Rust SHALL NOT 阻塞等待 ArkWeb callback（避免 Chrome_IOThread × ArkTS 主线程死锁，见 ohos-constraints §1.2）
- **AND** ArkWeb callback SHALL 仅做 log，不回 Rust（NAPI 重入限制，见 ohos-constraints §2.3）
- **AND** Rust SHALL 在调用后立即继续 webview 创建流程

### Requirement: Version guard SHALL skip on API < 15
ArkWeb `ProxyController` / `ProxyConfig` / `ProxySchemeFilter` 自 API 15 起可用（`@ohos.web.webview.d.ts:9005/9056/9334`）。tauri api demo 默认 `compatibleSdkVersion = 12`（见 ohos-constraints §6.4）。`apply_proxy_override` SHALL 在 Rust 侧检查 `openharmony_ability::version::sdk_api_version() >= 15`，低版本 SHALL 静默跳过（不调 ArkTS，不报错，不打 warn——与既有平台"静默跳过"策略一致，见 ohos-constraints §6.4）。

#### Scenario: API >= 15 applies proxy
- **WHEN** `version::sdk_api_version() >= 15` 且 `proxy_config = Some(...)`
- **THEN** SHALL 调用 ArkTS `applyProxyOverride`
- **AND** ArkWeb SHALL 应用代理规则

#### Scenario: API < 15 silently skips
- **WHEN** `version::sdk_api_version() < 15` 且 `proxy_config = Some(...)`
- **THEN** SHALL NOT 调用 ArkTS
- **AND** SHALL NOT 打日志
- **AND** SHALL NOT 返回错误
- **AND** ArkWeb SHALL 沿用系统代理（开发者无法通过 wry 设置代理，文档化）

### Requirement: proxy_config SHALL be applied before initial URL load
`InnerWebView::new_inner` SHALL 在 `WebViewBuilder::build()` 完成后、`webview.load_url(initial_url)` 之前调用 `apply_proxy_override`。该时序使 ArkWeb 有最大窗口应用代理规则。

#### Scenario: proxy applied before first navigation
- **WHEN** 开发者创建 webview 并设置 `proxy_config` + `url`
- **THEN** Rust SHALL 在 load 初始 URL 前调用 `apply_proxy_override`
- **AND** 首次页面加载 SHALL 尽量走代理（受 ArkWeb 异步 callback 时序限制）

### Requirement: NAPI failure SHALL NOT block webview creation
若 `apply_proxy_override` 因 NAPI 错误失败（env 不可用、helper 未就绪等），Rust 端 SHALL 仅 `log::warn!` 记录错误并继续 webview 创建流程，不向上抛 `Error`。该行为与 Windows / webkitgtk 一致——代理配置失败不应阻塞 webview 创建。

#### Scenario: env not available
- **WHEN** `get_main_thread_env()` 返回 `None`
- **THEN** SHALL `log::warn!` 并返回 `Ok(())`
- **AND** webview 创建 SHALL 继续

#### Scenario: helper not ready
- **WHEN** helper 对象未初始化（`get_helper()` 返回 `None`）
- **THEN** SHALL `log::warn!` 并返回 `Ok(())`
- **AND** webview 创建 SHALL 继续

## KNOWN_LIMITATIONS Requirements

### Requirement: ArkWeb ProxyController is app-wide (not per-webview)
ArkWeb `ProxyController.applyProxyOverride` 文档明确："Sets ProxyConfig which will be used by **all Webs in the app**"。OHOS 不支持 per-webview 代理。wry `proxy_config` 是 per-`WebViewAttributes` 字段，但 OHOS 实现下多次设置 `proxy_config`（多个 webview 或同一 webview 重复设置）SHALL 走 last-write-wins——后调用的覆盖先调用的。

#### Scenario: multiple webviews with different proxy_config
- **WHEN** 开发者创建 webview A（`proxy_config=Http(h1,p1)`）后创建 webview B（`proxy_config=Socks5(h2,p2)`）
- **THEN** webview A 和 B 的流量 SHALL 都走 Socks5 代理 `h2:p2`（last-write-wins）
- **AND** 文档 SHALL 引导开发者避免多 webview 不同代理的场景

#### Scenario: applyProxyOverride overrides system proxy
- **WHEN** 开发者设置 `proxy_config` 且 ArkWeb 应用成功
- **THEN** ArkWeb SHALL 忽略系统全局代理设置（"calling applyProxyOverride will cause any existing system wide setting to be ignored"）
- **AND** 文档 SHALL 标注此副作用

### Requirement: First page load may bypass proxy (async race)
ArkWeb `applyProxyOverride` 异步：callback 在 UI 线程触发，"Requests are not guaranteed to use the new proxy immediately; wait for the listener before loading a page"。wry 采用 fire-and-forget（见 fire-and-forget Requirement），不阻塞等待 callback。因此首次页面加载可能未走代理。此为已知限制，SHALL 在文档中标注；开发者如需严格同步，建议在 `setup` 钩子中提前设置 `proxy_config` 或显式延后 `load_url`。

#### Scenario: first load races with proxy apply
- **WHEN** 开发者创建 webview + `proxy_config` + `url`，且 ArkWeb callback 未在 load 前返回
- **THEN** 首次页面加载 SHALL 可能直连（不走代理）
- **AND** 后续导航 SHALL 走代理
- **AND** 文档 SHALL 建议开发者在 setup 阶段尽早配置代理

## Test Scenarios

### auto (Rust 单元测试，纯函数)
- `proxy_config` 字段从 `WebViewAttributes` 解构不被丢弃：UT 验证 `InnerWebView::new_inner` 路径在 `proxy_config=Some(Http(...))` 时调用 `apply_proxy_override`（mock helper 计数）
- 版本守卫：`sdk_api_version() < 15` 时 `apply_proxy_override` 立即返回 `Ok(())` 且不触达 NAPI

### side-effect (设备端可验证)
- HTTP 代理：本地起 `mitmproxy` / `charles` 监听 `127.0.0.1:8080`，`with_proxy_config(ProxyConfig::Http(...))`，加载 `https://example.com`，代理端能抓到请求
- SOCKS5 代理：本地起 SOCKS5 代理，`with_proxy_config(ProxyConfig::Socks5(...))`，加载页面，代理端能抓到请求
- 移除代理：调用 `remove_proxy_override` 后，新加载页面不再走指定代理

### manual (需人工确认)
- 低版本设备（API 12/14）：设置 `proxy_config` 后页面仍能正常加载（直连或走系统代理），不崩溃
- 多 webview：两个 webview 设置不同代理，确认 last-write-wins 行为符合预期

## API Mapping

| wry Rust API | OHOS ArkWeb API | 备注 |
|--------------|-----------------|------|
| `ProxyConfig::Http(ProxyEndpoint{host,port})` | `webview.ProxyConfig` + `insertProxyRule(\`http://${host}:${port}\`)` + `ProxyController.applyProxyOverride` | schemeFilter 省略 = MATCH_ALL_SCHEMES |
| `ProxyConfig::Socks5(ProxyEndpoint{host,port})` | `webview.ProxyConfig` + `insertProxyRule(\`socks://${host}:${port}\`)` + `ProxyController.applyProxyOverride` | wry Socks5 映射为 ArkWeb `socks://`（ArkWeb scheme 仅接受 http/https/socks） |
| `proxy_config = None` | 不调用 `applyProxyOverride` | 沿用系统代理 |
| — | `webview.ProxyController.removeProxyOverride(callback)` | 由 `openharmony_ability::remove_proxy_override` 暴露 |
| Windows: `--proxy-server=http://host:port` 参数 | OHOS: `ProxyController.applyProxyOverride` | 平台差异：Windows env-wide，OHOS app-wide |
| webkitgtk: `NetworkProxySettings` + `set_network_proxy_settings` | OHOS: `ProxyController.applyProxyOverride` | 平台差异：webkitgtk context-wide，OHOS app-wide |

## Version Compatibility

| API | since | 守卫 |
|-----|-------|------|
| `webview.ProxyController.applyProxyOverride` | 15 | `version::sdk_api_version() >= 15` |
| `webview.ProxyController.removeProxyOverride` | 15 | 同上 |
| `webview.ProxyConfig.insertProxyRule` | 15 | 同上 |
| `webview.ProxySchemeFilter` enum | 15 | 同上 |
| `atomicservice` since 19 变体 | 19 | 不依赖（用 since 15 路径即可） |

## Platform Differences (显式标注)

| 项 | Windows | webkitgtk | OHOS |
|----|---------|-----------|------|
| 作用域 | env-wide（CoreWebView2Environment） | context-wide（WebContext） | app-wide（ProxyController） |
| 设置时机 | env 创建时通过 `additional_browser_arguments` | web_context 创建后 `set_network_proxy_settings` | webview 创建后 `applyProxyOverride` |
| 同步性 | 同步（参数注入） | 同步 | 异步（callback on UI thread） |
| 系统代理覆盖 | 是（`--proxy-server` 覆盖） | 是（Custom mode 覆盖） | 是（applyProxyOverride 使系统设置被忽略） |
| 多 webview 隔离 | env 共享则共享代理 | context 共享则共享代理 | 始终 app-wide，无隔离 |
