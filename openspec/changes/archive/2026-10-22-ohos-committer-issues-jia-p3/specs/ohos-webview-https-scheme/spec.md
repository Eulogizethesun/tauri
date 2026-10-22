# ohos-webview-https-scheme Specification

## ADDED Requirements

### Requirement: Intercept request SHALL carry method and headers

https 拦截链 SHALL 把被拦截请求的 method 与请求头穿透到 wry 构造的 `Request`,消除当前 `.method`/`.headers` 恒为默认值的保真缺口。三层穿透:①ArkTS 采集 `getRequestMethod()`/`getRequestHeader()` 入 payload `method: string` 与并行数组 `headerNames: string[]`/`headerValues: string[]`(同序);②NAPI payload struct 新增同形 Option 字段(`Option<Vec<String>>` 走 impl_bridge_napi_type! 既有宏路径,不引入嵌套 map 形态);③wry `Request::builder().uri(&original_url)` 追加 `.method()`/`.headers()`(并行数组 zip 重组),字段缺失时回落现状(method=GET、无 headers)。

**SDK 复核前置门**:`setResponseHeader` 在本地 SDK20 副本零命中;实现当次构建 SHALL 复核实际 SDK 副本,仍缺席则响应头写路径降级为披露(见 ohos-platform-limitations)。CORS 4 例既有基线 SHALL 零回归。

#### Scenario: GET request carries method and headers

- **WHEN** ArkWeb 发起携带自定义头的 GET 请求命中 https 拦截
- **THEN** payload 含 `method="GET"` 与请求头并行数组(同序)
- **AND** wry 构造的 Request `.method()`/`.headers()` 与之一致

#### Scenario: POST method is preserved

- **WHEN** 拦截命中 POST 请求
- **THEN** wry Request 的 method SHALL 为 POST(现状恒 GET 的缺口闭合)

#### Scenario: Missing optional fields keep current behavior

- **WHEN** ArkTS 侧采集失败或旧版桥接插件未提供新字段(payload 字段为 None)
- **THEN** wry 构造 SHALL 回落现状(method 默认 GET、headers 为空),不 panic

#### Scenario: Malformed method or header degrades safely

- **WHEN** method 解析失败或某头名/值非合法 HTTP token
- **THEN** 该项 SHALL 回落(method→GET)或跳过(该头),记 debug 日志,不 panic、不炸整个请求

#### Scenario: CORS baseline unchanged

- **WHEN** examples/api CORS 4 例在波末回归运行
- **THEN** SHALL 全部保持既有 PASS(拦截语义变化不影响响应侧)

#### Scenario: SDK gate discloses absent setResponseHeader

- **WHEN** 当次构建 SDK 复核确认 setResponseHeader 缺席
- **THEN** 响应头写路径 SHALL 不实现,并以结构化披露记录(链接 ohos-platform-limitations)
