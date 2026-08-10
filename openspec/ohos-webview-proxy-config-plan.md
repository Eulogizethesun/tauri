# ohos-webview-proxy-config 实施计划

**创建时间**：2026-07-20
**功能描述**：让 wry `WebViewAttributes.proxy_config`（`ProxyConfig::Http` / `ProxyConfig::Socks5`）在 OHOS 后端真正生效——通过 ArkWeb `webview.ProxyController.applyProxyOverride` 将代理规则下发给 ArkWeb 引擎。
**关联 spec**：`openspec/specs/ohos-webview-proxy-config/spec.md`
**取代**：—（真 gap，OHOS 端当前完全忽略 `proxy_config`，落入 `wry/src/ohos/mod.rs:61-87` 解构的 `..` catch-all）

## 背景

- wry `WebViewAttributes.proxy_config: Option<ProxyConfig>`（`wry/src/lib.rs:781`），由 `WebViewBuilder::with_proxy_config` 设置（`wry/src/lib.rs:1400`）
- `ProxyConfig` 枚举（`wry/src/proxy.rs`）：`Http(ProxyEndpoint{host,port})` / `Socks5(ProxyEndpoint{host,port})`
- 已有实现：
  - Windows（`wry/src/webview2/mod.rs:304-319`）：拼 `--proxy-server=http://host:port` / `socks5://host:port` 到 `additional_browser_arguments`
  - webkitgtk（`wry/src/webkitgtk/mod.rs:267-279`）：`NetworkProxySettings::new("http://host:port" / "socks5://host:port")` → `website_data_manager.set_network_proxy_settings(Custom, ...)`
- OHOS 现状：`wry/src/ohos/mod.rs:61-87` 解构 `WebViewAttributes` 时未列出 `proxy_config`，落入 `..` 被静默丢弃。全文无 `proxy_config` / `ProxyConfig` 引用。

## ArkWeb 能力确认（关键判定）

ArkWeb **具备**代理能力（`@ohos.web.webview` 模块，`SystemCapability.Web.Webview.Core`，`since 15`）：

- `class ProxyController`（静态类）：
  - `static applyProxyOverride(proxyConfig: ProxyConfig, callback: OnProxyConfigChangeCallback): void`
  - `static removeProxyOverride(callback: OnProxyConfigChangeCallback): void`
- `class ProxyConfig`：`insertProxyRule(proxyRule: string, schemeFilter?: ProxySchemeFilter)`、`insertBypassRule(bypassRule: string)`、`insertDirectRule(schemeFilter?)`
- `proxyRule` 格式：`[scheme://]host[:port]`，scheme 必须是 `http` / `https` / `socks`，缺省为 `http`
- `enum ProxySchemeFilter { MATCH_ALL_SCHEMES=0, MATCH_HTTP=1, MATCH_HTTPS=2 }`
- **作用域**：app-wide（"used by all Webs in the app"）。等价于 Windows env-wide、webkitgtk context-wide，与既有平台语义一致。
- **异步**：callback 在 UI 线程触发；"Requests are not guaranteed to use the new proxy immediately; wait for the listener before loading a page"。
- **副作用**：`applyProxyOverride` 会使系统全局代理设置被忽略。

**版本守卫**：tauri api demo 默认 `compatibleSdkVersion = 12`。`ProxyController` `since 15`。必须用 `openharmony_ability::version::sdk_api_version() >= 15` 守卫，低版本静默跳过（与既有平台"不配置即用系统代理"语义对齐）。

## Phase 列表

| Phase | 名称 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|--------|---------|---------|
| 1 | openharmony-ability 代理桥（NAPI + ArkTS） | openharmony-ability | 4 | Rust 单测 + 设备端验证 applyProxyOverride 被调用 |
| 2 | wry 透传 + 版本守卫 + 验证 | wry | 2 | 设备端：HTTP 代理拦截到流量；低版本静默跳过 |

## Phase 详细说明

### Phase 1: openharmony-ability 代理桥

- **目标**：在 `openharmony-ability` 暴露 Rust API `apply_proxy_override(scheme: &str, host: &str, port: &str) -> Result<()>`，内部通过 NAPI 调用 ArkTS，ArkTS 构造 `webview.ProxyConfig` 调 `ProxyController.applyProxyOverride(config, cb)`。同时提供 `remove_proxy_override() -> Result<()>`。
- **文件列表**：
  - `openharmony-ability/crates/ability/src/webview/mod.rs`（或新建 `proxy.rs`）：新增 `pub fn apply_proxy_override` / `remove_proxy_override`，通过 `get_main_thread_env` + `get_helper` 调 ArkTS 函数 `applyProxyOverride(scheme, host, port)` / `removeProxyOverride()`
  - `openharmony-ability/crates/ability/src/helper/webview.rs` 或 `lib.rs`：导出新 API
  - `openharmony-ability/crates/ability/src/lib.rs`：模块导出
  - `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets`（或 ArkHelper.ets）：实现 `applyProxyOverride(scheme: string, host: string, port: string): void` 函数 —— 构造 `webview.ProxyConfig`、`insertProxyRule(\`${scheme}://${host}:${port}\`)`、`ProxyController.applyProxyOverride(config, () => {})`
- **约束**：
  - NAPI 函数名 camelCase（ArkTS 调用侧）
  - `applyProxyOverride` 异步回调——Rust 侧**fire-and-forget**，不阻塞（避免 Chrome_IOThread × ArkTS 主线程死锁，见 ohos-constraints §1.2）。回调内仅可做 log，不能回 Rust（NAPI 重入限制，见 §2.3）
  - 版本守卫放在 **Rust 侧**：`if version::sdk_api_version() < 15 { return Ok(()); }`（ArkTS 侧不需要再查，避免重复）
  - `applyProxyOverride` 是 app-wide，文档化"多 webview 不同 proxy_config 时 last-write-wins"
- **依赖**：无

### Phase 2: wry 透传 + 版本守卫 + 验证

- **目标**：`wry/src/ohos/mod.rs` 解构 `WebViewAttributes` 时显式保留 `proxy_config`，转换 `ProxyConfig::Http/Socks5` 为 `(scheme, host, port)` 调用 Phase 1 的 `openharmony_ability::apply_proxy_override(...)`。scheme 映射：`ProxyConfig::Http` → `"http"`，`ProxyConfig::Socks5` → `"socks"`（ArkWeb scheme 仅接受 http/https/socks，不接受 `socks5`）。
- **文件列表**：
  - `wry/src/ohos/mod.rs`：解构新增 `proxy_config,`（不再落入 `..`）；在 `webview_builder` 构建后、URL 加载前调用 `apply_proxy_override`；低版本静默跳过
  - `wry/src/ohos/mod.rs`：如需 `use crate::ProxyConfig;` 引入
- **设计要点**：
  - 调用时机：在 `WebViewBuilder::build()` 之后、`initial_url` load 之前调用——给 ArkWeb 一帧时间应用代理。但 ArkWeb 不保证 callback 完成前不加载页面；**文档化已知限制**：首次页面加载可能未走代理（与 Windows/webkitgtk 同样存在类似竞态，但它们在 env/context 创建期就设好代理，时序更紧；OHOS 的 fire-and-forget 更宽松但仍非阻塞同步）
  - 多 webview：每次 `InnerWebView::new` 都会调 `apply_proxy_override`；后创建的覆盖先创建的。app-wide 行为由 ArkWeb 决定，不可绕过
  - 错误处理：NAPI 调用失败仅 `log::warn!`，不向上抛（与 Windows/webkitgtk 一致——代理失败不应阻塞 webview 创建）
- **依赖**：Phase 1 完成

## 风险

- **异步竞态**：ArkWeb `applyProxyOverride` 回调未返回前页面已加载 → 首次 URL 可能不走代理。文档化为已知限制，建议开发者在 `setup` 阶段尽早设置 proxy_config（在 load_url 之前）。如未来需要严格同步，可考虑 TSFN NonBlocking + 一次性 callback 回 Rust（但成本高，当前不实现）
- **app-wide 语义**：ArkWeb `ProxyController` 不支持 per-webview 代理。多 webview 场景 last-write-wins。文档化，建议应用层避免多 webview 不同代理
- **低版本降级**：API < 15 静默跳过，与 Windows "无 proxy_config 即用系统代理" 不完全对齐（OHOS 低版本即使有 proxy_config 也用系统代理）。文档化
- **系统代理被覆盖**：`applyProxyOverride` 会使 ArkWeb 忽略系统全局代理。开发者设置 `proxy_config` 后，所有 webview 流量都走指定代理，包括未显式设置 proxy_config 的 webview（因 app-wide）。文档化
- **ProxyController 单例时机**：需确认 `webview.ProxyController` 是否需在 webview controller 初始化后才能调；若首帧调失败，可在 `onPageBegin` 首次触发后再 apply（实现时验证）
