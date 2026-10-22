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

1. **响应头注入**:`setResponseHeader` 在本地 SDK20 副本(`api/arkui/component/web.d.ets`)缺席——请求侧 method/headers 照常采集穿透(见 ohos-webview-https-scheme),响应头写路径不实现;披露 SHALL 记录 SDK 版本门(SDK 提供该 API 后可闭合)。
2. **请求 body 访问**:拦截请求 body 在 OHOS 平台无公开访问器——method/headers 仅头部采集,body 不穿透;披露 SHALL 记录该边界。

两项披露 SHALL 一并记录 CORS 4 例基线不变的验证结论。

#### Scenario: Response header write is not implemented

- **WHEN** 拦截请求需要注入响应头(如 CORS 头改写)
- **THEN** 实现 SHALL 不提供该能力,披露条目说明 SDK 门与闭合条件
- **AND** 既有 CORS 4 例行为零回归

#### Scenario: Request body is not forwarded

- **WHEN** 拦截命中携带 body 的请求(如 POST)
- **THEN** wry 构造的 Request SHALL 仅携带穿透的 method/headers(body 为空),披露条目说明该平台边界
