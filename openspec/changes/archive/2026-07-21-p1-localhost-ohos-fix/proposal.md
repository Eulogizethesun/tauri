## Why

localhost 插件 (`tauri-plugin-localhost`) 在 OHOS desktop 上注册 `Builder::new(3005).build()` 后，前端 `fetch('http://localhost:3005/index.html')` 报 "Failed to fetch"，tiny_http server 疑未正确启动。根因是 `tiny_http::Server::http("localhost:PORT")` 依赖 "localhost" 主机名解析，在 OHOS (musl) 上不可靠（可能解析失败或仅解析到 ::1），且 `.expect()` panic 走 stderr 在 OHOS 上不可见（OHOS 约束 §3.4），导致 server 线程静默死亡、无任何日志。需在 OHOS 上显式绑定 `127.0.0.1` 并使失败可诊断，使插件行为与 Windows/macOS 一致。

## What Changes

- **D0 诊断门槛先行**：在 `plugins-workspace/plugins/localhost/src/lib.rs` 的 `cfg(target_env = "ohos")` 分支加入诊断探针（不改绑定地址、不动 `.expect()`），设备端实测三类信息——`("localhost", 0).to_socket_addrs()` 解析结果与顺序、`TcpListener::bind("localhost:PORT")` 实际 `local_addr()`、前端 `fetch('http://localhost:PORT')` 与 `fetch('http://127.0.0.1:PORT')` 各自结果——经 `log::info!`/`log::warn!` 输出到 hilog。D0 探针无条件合入（cfg 隔离零影响）。
- **D1 绑定地址按 D0 门槛结果在三分支中选定**（不再直接固化 127.0.0.1）：① `localhost` 解析含 127.0.0.1 且 ArkWeb fetch localhost 在 bind 127.0.0.1 后成功 → 绑 `127.0.0.1:PORT`；② `localhost` 解析为 ::1 优先或仅 ::1（IPv6 优先）→ 改双栈（`[::]:PORT` + `IPV6_V6ONLY=false`，或两个 Server 分别 bind 127.0.0.1 与 [::1]），或前端 fetch URL 改用 `http://127.0.0.1:PORT`；③ A/B 均证伪 → D1 暂停，回根因分析修正。**D1+D2 不得在 D0 门槛判定前合入**，与 `p1-upload-ohos-fix` D3 诊断纪律一致——消除"IPv4/IPv6 错配"候选根因未定位即固化 127.0.0.1 的自相矛盾风险。
- 将 `Server::http(...).expect("Unable to spawn server")` 替换为 `match` 错误处理，失败时统一通过 `log::error!` 输出诊断信息而非静默 panic（OHOS 上经宿主 `ohos_log::init()` 将 `log` facade 桥接到 hilog，不在插件 `Cargo.toml` 新增 `hilog` 依赖）。
- 评估并为跨源 fetch 场景补充 `Access-Control-Allow-Origin` 响应头（仅当请求来源与 server 不同源时；README 推荐的同源用法不受影响）。
- 在 `Cargo.toml` 的 `[package.metadata.platforms.support]` 补充 OHOS 支持级别。
- 在 `README.md` 补充 OHOS 使用说明：需 `ohos.permission.INTERNET`、host 默认行为、D0 诊断探针输出位置、按分支选定的绑定地址行为。
- 不修改 Windows/macOS/Linux/Android/iOS 既有代码路径；所有 OHOS 变更通过 `cfg(target_env = "ohos")` 隔离。

## Capabilities

### New Capabilities
- `ohos-localhost-server`: localhost 插件在 OHOS 上的 tiny_http server 绑定、诊断与请求响应行为，确保 `http://localhost:PORT` 可被 ArkWeb WebView 访问。

### Modified Capabilities
<!-- 无既有 spec 级别需求变更 -->

## Impact

- **代码**：`plugins-workspace/plugins/localhost/src/lib.rs`（D0 诊断探针 + D1 按分支绑定 + D2 错误处理）、`Cargo.toml`（平台元数据）、`README.md`（文档）。
- **API**：插件公开 API (`Builder::new/port/host/on_request/build`) 不变；行为修复仅限 OHOS 内部绑定地址（按 D0 门槛结果选定）与错误处理。
- **依赖**：无新增依赖（`tiny_http` 已有；OHOS 日志复用现有 `ohos_log`/`hilog` 约定，由宿主 app 初始化）。
- **权限**：依赖 app `module.json5` 中已声明 `ohos.permission.INTERNET`（tauri OHOS 模板 `entry_desktop` 与 `entry_mobile` 均已含，审计已核对，无需改桥接仓）。
- **桥接**：本插件为纯 Rust TCP server，不调用 ArkTS/NAPI，无需经 openharmony-ability 桥接（符合"唯一桥接"铁律——无桥接需求）。
- **其他平台**：通过 `cfg(target_env = "ohos")` 隔离，零影响。
