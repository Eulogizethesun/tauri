# ohos-platform-limitations Specification

## ADDED Requirements

### Requirement: Creation-time visual attributes SHALL be disclosed as not applied

创建期 attrs 中 `visible`、`window_icon`、`preferred_theme` 三项在 OHOS 后端 SHALL 维持不生效现状并落披露:OHOS 侧窗口初始可见性由创建通道与 ArkTS 布局决定(无独立等价 setter 语义)、图标无窗口级 API、主题经既有 onConfigurationUpdate 链运行期生效。facade 文档 SHALL 携带 OHOS 平台专属行;`always_on_top`/`decoration_flags`(播种)与 `fullscreen`/`maximized`/`focused`(补发)已由 pending-ops 机制覆盖,不在披露范围。

#### Scenario: Facade documents unapplied attributes

- **WHEN** 开发者以 `with_visible(false)`/`with_window_icon(...)`/`with_theme(...)` 在 OHOS 创建窗口
- **THEN** 行为 SHALL 维持现状(参数不生效),文档披露该限制
- **AND** 不产生 panic 或错误返回

### Requirement: Intercept fidelity gaps SHALL be gated by SDK availability

https 拦截链的平台保真缺口 SHALL 以 SDK 事实为门并落披露,含两项:

1. **响应头注入(已实现,p3 修复变体 M1 路线 A)**:本地 SDK20 副本 `web.d.ts:4426` `setResponseHeader` @since 12 **PRESENT**(p1 对账曾误判缺席;当次构建复核实证推翻该结论)→ 响应头写路径已实现:wry 从协议 handler 响应提取头(Content-Type 除外,经 mime 通道避免 ArkWeb 双重应用;非 UTF-8 头逐条跳过降级)→ wire 并行数组(headerNames/headerValues,请求侧同型)→ ArkTS `WebResourceResponse.setResponseHeader(Array<Header>)`;旧原生模块缺省字段时与既有行为逐字节一致(D9)。设备断言:跨源 fetch 依赖新路径送达的 ACAO/Expose-Headers 通过,且 handler 设置的 echo 头 JS 可读。
2. **请求 body 访问**:拦截请求 body 在 OHOS 平台无公开访问器——method/headers 仅头部采集,body 不穿透;披露 SHALL 记录该边界。

两项 SHALL 一并记录 CORS 4 例基线不变的验证结论。

#### Scenario: Response header write reaches the page

- **WHEN** 自定义协议 handler 在 `http::Response` 上设置响应头(如 `Access-Control-Allow-Origin`、`X-Tauri-Scheme-Echo`)
- **THEN** wry SHALL 提取头并经 wire 并行数组送达 ArkTS,`setResponseHeader` 应用到 `WebResourceResponse`
- **AND** 跨源 fetch 依 ACAO 通过,handler 设置的头在 JS `response.headers` 可读
- **AND** fetch() 形态的消费者 SHALL 在应用 CSP `connect-src` 允许 https 重写主机 `https://<scheme>.localhost`（OHOS use_https 将 `<scheme>://localhost` 重写为该主机形态；裸 `<scheme>:` 条目只覆盖 iframe/导航流。设备实证：connect-src 缺该条目时 fetch 在 8ms 内被 CSP 拒绝 "Refused to connect"，拦截器不可达）
- **AND** 既有 CORS 4 例行为零回归

#### Scenario: Headerless response keeps the old wire shape

- **WHEN** 协议 handler 仅设置 Content-Type(或未设头)
- **THEN** wire 载荷的 header 数组 SHALL 为缺省(None/absent),行为与 M1 之前逐字节一致

#### Scenario: Request body is not forwarded

- **WHEN** 拦截命中携带 body 的请求(如 POST)
- **THEN** wry 构造的 Request SHALL 仅携带穿透的 method/headers(body 为空),披露条目说明该平台边界
