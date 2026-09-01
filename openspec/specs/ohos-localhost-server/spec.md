# ohos-localhost-server Specification

## Purpose
TBD - created by archiving change p1-localhost-ohos-fix. Update Purpose after archive.
## Requirements
### Requirement: 实施前 SHALL 先经 D0 诊断门槛验证根因

在合入绑定地址修复（D1）与错误处理修复（D2）之前，SHALL 先在 `cfg(target_env = "ohos")` 分支合入 D0 诊断探针并完成设备端门槛判定。D0 探针 SHALL 不改变绑定地址、不动 `.expect()`，仅观测 `localhost` 解析顺序、实际 bind 地址、ArkWeb fetch 路径。D1+D2 不得在 D0 门槛判定完成前合入——与 `p1-upload-ohos-fix` D3 诊断纪律一致，消除"IPv4/IPv6 错配"候选根因未定位即固化 `127.0.0.1` 的自相矛盾风险。

#### Scenario: D0 诊断探针合入并产出 hilog
- **WHEN** 在 OHOS desktop 上注册带 D0 探针的 `Builder::new(3005).build()` 并触发一次前端 `fetch('http://localhost:3005/index.html')`
- **THEN** hilog 输出：`("localhost", 0).to_socket_addrs()` 全部返回地址及顺序、`TcpListener::bind("localhost:3005")` 的 `local_addr()`、前端 `fetch('http://localhost:3005/probe')` 与 `fetch('http://127.0.0.1:3005/probe')` 各自结果

#### Scenario: 门槛判定分支① — 绑定 127.0.0.1
- **WHEN** D0 hilog 显示 `localhost` 解析含 `127.0.0.1`（IPv4 优先或与 ::1 并存），且 server bind 127.0.0.1 后 ArkWeb `fetch('http://localhost:3005/...')` 成功
- **THEN** D1 选定绑定 `127.0.0.1:3005`，前端 URL 不变，进入 D1+D2 实施

#### Scenario: 门槛判定分支② — IPv6 优先，改双栈或改前端 URL
- **WHEN** D0 hilog 显示 `localhost` 解析为 `::1` 优先或仅 `::1`，或 ArkWeb fetch localhost 走 IPv6
- **THEN** D1 改为双栈绑定（`[::]:PORT` + `IPV6_V6ONLY=false`，或两个 Server 分别 bind `127.0.0.1:PORT` 与 `[::1]:PORT`），或前端 fetch URL 改用 `http://127.0.0.1:PORT`（同步更新 README 与 `WebviewUrl::External` 示例）

#### Scenario: 门槛判定分支③ — A/B 证伪，D1 暂停
- **WHEN** D0 hilog 显示 bind 成功且 IPv4 可达，但 `fetch('http://127.0.0.1:3005/...')` 仍失败
- **THEN** 假设 A/B 证伪，D1+D2 暂停，回 design.md "根因分析" 修正假设与方案后重新评估

### Requirement: OHOS 上 tiny_http server SHALL 按 D0 门槛结果绑定 loopback 显式地址

在 `cfg(target_env = "ohos")` 下，localhost 插件 SHALL 按 D0 门槛判定的分支选定绑定地址（分支①为 `127.0.0.1:PORT`；分支②为双栈或前端 URL 改 `127.0.0.1`），而非依赖 `"localhost"` 主机名解析。其他平台 SHALL 保持原有 `"{host}:{port}"` 行为不变。

#### Scenario: OHOS 上 server 成功监听（分支①）
- **WHEN** 在 OHOS desktop 上 D0 门槛判定为分支①，注册 `Builder::new(3005).build()` 并完成 setup
- **THEN** tiny_http server 线程成功 bind 到 `127.0.0.1:3005` 并进入 `incoming_requests()` 循环，无 panic

#### Scenario: OHOS 上 server 成功监听（分支②双栈）
- **WHEN** D0 门槛判定为分支②且选用双栈方案
- **THEN** tiny_http server 同时监听 IPv4 与 IPv6 loopback（`127.0.0.1:3005` 与 `[::1]:3005`，或单 `[::]:3005` 双栈），前端 `fetch('http://localhost:3005/...')` 无论走 IPv4 还是 IPv6 均可达

#### Scenario: 非 OHOS 平台行为不变
- **WHEN** 在 Windows/macOS/Linux 上注册 `Builder::new(3005).build()`
- **THEN** server 仍以 `"localhost:3005"` 绑定，行为与修复前一致（回归无变化）

#### Scenario: 自定义 host 在 OHOS 上的语义
- **WHEN** 用户调用 `Builder::new(3005).host("myhost").build()` 在 OHOS 上
- **THEN** `host` 字段保留用于日志/文档，但实际 bind 地址按 D0 门槛分支选定（OHOS 跳过主机名解析）；该行为在 README 中显式标注

### Requirement: server 启动失败 SHALL 经 hilog 可见诊断而非静默 panic

在所有平台，`Server::http(...)` 失败时 SHALL NOT 调用 `.expect()` 导致线程 panic；SHALL 通过 `log::error!`（OHOS 上经宿主 `ohos_log` 转发到 hilog）输出包含绑定地址与错误信息的诊断日志，随后线程正常退出。

#### Scenario: OHOS 绑定失败可诊断
- **WHEN** OHOS 上 `Server::http("127.0.0.1:3005")` 返回错误（如端口占用）
- **THEN** 线程不 panic，`log::error!` 输出 `localhost plugin: failed to bind 127.0.0.1:3005: <e>` 到 hilog，前端 fetch 收到连接拒绝（"Failed to fetch"），但 hilog 有失败记录

#### Scenario: 非 OHOS 绑定失败可诊断
- **WHEN** 其他平台 `Server::http(...)` 失败
- **THEN** 线程不 panic，`log::error!` 输出诊断信息到标准日志后端

### Requirement: ArkWeb WebView SHALL 能通过 http://localhost:PORT 访问 server

OHOS 上 server 绑定 `127.0.0.1:PORT` 后，ArkWeb WebView（Chromium 内核将 "localhost" 视为 secure context 并解析到 127.0.0.1）SHALL 能通过 `http://localhost:PORT/index.html` 成功获取资源。

#### Scenario: 同源 fetch 返回 200
- **WHEN** 主页面以 `WebviewUrl::External("http://localhost:3005")` 加载（与 server 同源），前端执行 `fetch('http://localhost:3005/index.html')`
- **THEN** 返回 HTTP 200，`Content-Type` 为 `text/html`，body 为 `index.html` 资源内容且非空

#### Scenario: 资源由 asset_resolver 提供
- **WHEN** 请求 `http://localhost:3005/index.html`
- **THEN** server 从 `app.asset_resolver().get("index.html")` 取得资产并响应；资产字节、mime_type、CSP（若有）、`Cache-Control: no-cache` 头与 Windows/macOS 一致

### Requirement: OHOS 变更 SHALL 经 cfg 隔离且不影响其他平台

所有 OHOS 专属绑定/诊断逻辑 SHALL 通过 `cfg(target_env = "ohos")`（或 `cfg!` 宏）隔离。非 OHOS 目标的编译与运行时行为 MUST 与修复前完全一致。

#### Scenario: 非 OHOS 编译回归
- **WHEN** 执行 `cargo check -p tauri-plugin-localhost`（默认目标）
- **THEN** 编译通过，且生成的代码路径不含 OHOS 绑定分支

#### Scenario: OHOS 编译通过
- **WHEN** 执行 `cargo check --target aarch64-linux-ohos -p tauri-plugin-localhost`
- **THEN** 编译通过

### Requirement: OHOS 使用 SHALL 依赖 INTERNET 权限且文档显式声明

localhost 插件在 OHOS 上绑定监听 socket 依赖 app `module.json5` 中声明 `ohos.permission.INTERNET`。README SHALL 在 OHOS 小节显式说明此要求及 server 内部绑定 `127.0.0.1` 的行为。

#### Scenario: 缺少 INTERNET 权限时 server 启动失败可诊断
- **WHEN** app `module.json5` 未声明 `ohos.permission.INTERNET` 且注册 localhost 插件
- **THEN** `Server::http` 返回权限错误，`log::error!` 输出到 hilog，线程退出不 panic

#### Scenario: 文档包含 OHOS 说明
- **WHEN** 阅读 `plugins-workspace/plugins/localhost/README.md`
- **THEN** 包含 OHOS 小节，说明 `ohos.permission.INTERNET` 依赖、内部绑定 `127.0.0.1`、日志经 hilog

### Requirement: 跨源 fetch CORS 为可选增强（默认关闭）

默认情况下 server SHALL NOT 添加 `Access-Control-Allow-Origin` 响应头（保持与现有安全策略一致）。仅当验证要求 api 示例跨源测试通过时，SHALL 作为可选增强在 OHOS 上添加 `Access-Control-Allow-Origin: *`。

#### Scenario: 默认同源不受 CORS 影响
- **WHEN** 主页面与 server 同源（均 `http://localhost:PORT`）发起 fetch
- **THEN** 不触发 CORS 预检，请求成功

#### Scenario: 跨源 fetch 默认行为
- **WHEN** 主页面为 `tauri://localhost`，跨源 fetch `http://localhost:3005/index.html`
- **THEN** 默认无 CORS 头，浏览器按同源策略处理（可能被阻止）；此为本期可接受行为，记为 manual 测试

