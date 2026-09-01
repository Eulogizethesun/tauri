## Context

`tauri-plugin-localhost` 通过 `tiny_http::Server::http(format!("{host}:{port}"))` 在独立线程启动一个 HTTP server，从 `app.asset_resolver()` 取资源并响应。`host` 默认 `"localhost"`。README 推荐用法：用 `WebviewUrl::External("http://localhost:PORT")` 加载主页面（与 server 同源），并通过 `CapabilityBuilder::remote(url)` 授权 IPC。

OHOS desktop 上观察到：注册插件后 `fetch('http://localhost:3005/index.html')` 报 "Failed to fetch"，server 疑未启动。

**当前状态**（`plugins-workspace/plugins/localhost/src/lib.rs` L82-84）：
```rust
std::thread::spawn(move || {
    let server = Server::http(format!("{host}:{port}")).expect("Unable to spawn server");
    for req in server.incoming_requests() { ... }
});
```

**OHOS 约束（铁律）**：
1. cfg 隔离 — OHOS 变更用 `cfg(target_env = "ohos")`，不影响其他平台。
2. openharmony-ability 唯一桥接 — 本插件纯 Rust TCP，不调用 ArkTS/NAPI，无需桥接。
3. OHOS_DEVICE_TYPE — 本修复对所有 OHOS 设备形态通用（loopback 与设备形态无关），用 `cfg(target_env = "ohos")`。
4. 日志（§3.4）— `log::*!` + stdout/stderr 在 OHOS 不可见；`.expect()` panic 走 stderr，静默无日志。

## 根因分析

| 假设 | 说明 | 评估 |
|------|------|------|
| **A. "localhost" 主机名解析失败/仅 ::1** | `tiny_http::Server::http("localhost:PORT")` 内部 `ToSocketAddrs` 解析 "localhost"。OHOS musl 环境下 `/etc/hosts` 可能无 "localhost" 条目，或解析仅返回 `::1`（IPv6 loopback）。server 线程 `bind` 失败 → `.expect()` panic → stderr 不可见 → 静默死亡 | **最可能** |
| **B. IPv4/IPv6 错配** | 即便 "localhost" 解析成功，server 可能 bind 到 `::1`，而 ArkWeb (Chromium) 解析 "localhost" 优先 `127.0.0.1`（IPv4）→ connection refused | 可能（与 A 叠加） |
| C. INTERNET 权限缺失 | OHOS 绑定监听 socket 需 `ohos.permission.INTERNET` | tauri OHOS 模板 `entry_desktop/src/main/module.json5` 与 `entry_mobile/src/main/module.json5` 均已含 `ohos.permission.INTERNET`（审计已核对），非根因，但需在文档强调 |
| D. ArkWeb 阻止 http://localhost 明文 | ArkWeb 基于 Chromium，loopback 视为 secure context，允许 http | 非根因（文档已确认 `loadUrl` 接受 http URL） |
| E. asset_resolver 返回 None | lib.rs 在 `if let Some(asset)` 为假时不响应请求，fetch 会挂起而非 "Failed to fetch" | 与症状不符 |

**结论**：候选根因为 A（+B），但 **B（IPv4/IPv6 错配）未定位即固化绑定方案存在自相矛盾风险**：若 OHOS 上 `localhost` 优先解析为 `::1`（IPv6 优先），则 server 绑定 `127.0.0.1`（IPv4 loopback）而前端 `fetch('http://localhost:PORT')` 仍走 IPv6 → 连接到 `::1` → server 不可达 → 修复不生效。与 `p1-upload-ohos-fix` 的诊断纪律（D3 门槛先行）不一致。

因此本期 **不直接固化绑定方案**，而是先加 D0 诊断门槛（详见 Decisions D0）：设备端实测 `localhost` 解析顺序 + ArkWeb fetch 路径，再按门槛判定结果在 D1 三个分支中选定绑定策略。A/B 在设备端验证前保持为"假设"而非"定论"。

## Goals / Non-Goals

**Goals:**
- localhost 插件在 OHOS desktop/mobile 上 server 线程成功监听，`fetch('http://localhost:PORT/...')` 返回 200 且 body 非空。
- server 启动失败时在 hilog 可见诊断信息（不再静默 panic）。
- 零影响其他平台；OHOS 变更全部 `cfg(target_env = "ohos")` 隔离。

**Non-Goals:**
- 不改变插件公开 API（`Builder` 签名不变）。
- 不替换 `tiny_http` 为其他 server 实现。
- 不实现 HTTPS / TLS。
- 不改动 openharmony-ability / wry / tauri 核心（本插件不依赖桥接）。
- 不解决 api 示例跨源 fetch 测试的 CORS 问题（同源用法是主路径；跨源 CORS 仅作可选增强评估）。

## Decisions

### D0: 诊断先行 — "localhost" 解析顺序与 ArkWeb fetch 路径验证（D1 硬性先决门槛）

**选择**：在 lib.rs 的 `cfg(target_env = "ohos")` 分支中先加入诊断探针（不改绑定地址、不动 `.expect()`），构建设备端 app，复现一次 `fetch('http://localhost:PORT/index.html')`，hilog 抓取以下三类信息：

1. **`localhost` 解析结果**：`("localhost", 0).to_socket_addrs()` 返回的全部地址及顺序（区分 `127.0.0.1` / `::1`，记录是否仅返回其一）。
2. **实际 bind 地址**：用 `std::net::TcpListener::bind("localhost:PORT")` 探针（独立于 tiny_http，bind 后立即 drop）记录 `listener.local_addr()` 的实际 socket 地址（IPv4 / IPv6）。
3. **ArkWeb fetch 路径**：前端分别 `fetch('http://localhost:PORT/probe')` 与 `fetch('http://127.0.0.1:PORT/probe')`，记录各自结果（200 / Failed to fetch / 连接拒绝）。

日志走 `log::info!` / `log::warn!`（OHOS 宿主 `ohos_log::init()` 已把 `log` facade 接到 hilog，符合 §3.4）。探针全部 `cfg(target_env = "ohos")` 隔离。

**门槛判定标准**（实现时严格按此执行）：
- **分支①（A 成立、B 不成立）**：`localhost` 解析含 `127.0.0.1`（IPv4 优先或与 ::1 并存），且 server bind 127.0.0.1 后 ArkWeb `fetch('http://localhost:PORT')` 成功 → **D1 选定绑定 `127.0.0.1`**，前端 URL 不变。
- **分支②（B 成立、IPv6 优先）**：`localhost` 解析为 `::1` 优先或仅 `::1`，或 ArkWeb fetch localhost 走 IPv6 → **D1 改为双栈绑定**（首选 `[::]:PORT` 配合 `IPV6_V6ONLY=false` 双栈；tiny_http 不支持时退化为同时启动两个 Server，分别 bind `127.0.0.1:PORT` 与 `[::1]:PORT`），**或** 前端 fetch URL 改用 `http://127.0.0.1:PORT`（需同步更新 README 推荐用法与 `WebviewUrl::External` 示例）。
- **分支③（A/B 均证伪）**：hilog 显示 bind 成功且 IPv4 可达，但 `fetch('http://127.0.0.1:PORT')` 仍失败 → 假设 A/B 证伪，**D1 暂停**，回"根因分析"修正假设与方案后重新评估（可能涉及 ArkWeb http明文策略 / asset_resolver / 权限运行时授予等）。

**D0 诊断探针本身无条件合入**（有价值、`cfg` 隔离零影响），不论 A/B 是否成立。**D1+D2 不得在 D0 门槛判定前合入**——与 `p1-upload-ohos-fix` D3 门槛纪律一致。

### D1: OHOS 绑定地址策略（按 D0 门槛结果在三分支中选定）

**选择**：D0 门槛通过后，按判定分支在 `cfg(target_env = "ohos")` 中选定绑定地址。默认（分支①）为 `format!("127.0.0.1:{port}")`，跳过主机名解析。

**理由**：
- 直接用 IPv4 loopback 地址，消除 A 类解析问题；分支①下 ArkWeb (Chromium) 将 "localhost" 标准映射到 127.0.0.1，与 server 绑定地址匹配，连接可达。
- 分支②下若仍绑 127.0.0.1 则修复不生效——必须改双栈或改前端 URL，这正是 D0 门槛存在的理由。
- `127.0.0.1` 仅监听 loopback，不暴露到外部网络，安全性等同原 "localhost" 意图；分支②的双栈 `[::]` 同样仅 loopback 可达（:: 与 127.0.0.1 均不对外）。

**备选与分支②处理**：
- 绑定 `0.0.0.0`：监听所有 IPv4 接口，外部可达，安全风险更大，且不解决 IPv6 错配。**不选**。
- 绑定 `[::1]`：IPv6 loopback，但 ArkWeb 未必优先 IPv6。**仅在分支②作为双栈一部分**。
- 双栈 `[::]:PORT` + `IPV6_V6ONLY=false`：tiny_http 不原生暴露 socket option，需评估是否可用；不可用则退化为两个 Server 实例。
- 前端 URL 改用 `http://127.0.0.1:PORT`：分支②的备选，需同步改 README 与示例，公开 API `host` 默认仍为 "localhost"（仅 fetch URL 字面量改）。

**实现要点（分支①，默认）**：
```rust
let bind_addr = if cfg!(target_env = "ohos") {
    format!("127.0.0.1:{port}")   // 跳过 "localhost" 解析（OHOS musl 不可靠）
} else {
    format!("{host}:{port}")       // 其他平台保持原行为
};
```
`host` 变量仍用于文档/日志；公开 API 的 `host` 默认仍为 `"localhost"`。分支②实现要点在 D0 门槛通过后补入本节。

### D2: 用 `match` 替代 `.expect()`，失败统一走 `log::error!` 诊断

**选择**：
```rust
let server = match Server::http(&bind_addr) {
    Ok(s) => s,
    Err(e) => {
        log::error!("localhost plugin: failed to bind {bind_addr}: {e}");
        return; // 线程退出，不 panic
    }
};
```

**理由**：
- OHOS §3.4：stderr 不可见，`.expect()` panic 静默；改 `log::error!`（OHOS 经宿主 `ohos_log` 桥接 hilog）后失败可诊断。
- 不 panic 也避免 panic 在 spawned 线程上的 abort 风险。

**hilog 依赖**：不在插件 `Cargo.toml` 直接依赖 `hilog` crate（避免给非 OHOS 平台引入依赖）。OHOS 上宿主 app 已初始化 `ohos_log`；插件用 `log::error!`，由宿主的 hilog backend 转发。

**决策过程记录**（审计已确认最终一致，无 issue）：D2 草稿曾为 OHOS 用 `hilog::error!`、其他平台 `log::error!`（双分支 + cfg 分歧日志）。复核后修正为统一 `log::error!`——插件已依赖 `log` crate，OHOS 宿主 `ohos_log::init()` 已把 `log` facade 接到 hilog，因此无需 cfg 分支日志、无需新增 `hilog` 依赖，也避免了在插件 `Cargo.toml` 上为 OHOS 平台引入额外 crate。最终实现统一 `log::error!`，与非 OHOS 平台一致。

### D3: CORS 评估——同源主路径不需要，跨源可选增强

**选择**：本期不强制加 CORS。README 推荐用法（`WebviewUrl::External("http://localhost:PORT")`）主页面与 server 同源，fetch 不触发 CORS。api 示例的 `fetch('http://localhost:3005/index.html')` 是从 `tauri://localhost` 主页面发起的跨源请求——若需在 OHOS 上通过该测试，可在 `Response` 默认加 `Access-Control-Allow-Origin: *`（仅 `cfg(target_env = "ohos")` 或全平台）。**作为可选增强项列入 tasks，默认不开启**，避免放宽其他平台安全策略。

**理由**：localhost 插件 README 已声明"considerable security risks"；加 `*` 会进一步放宽。保守起见仅 OHOS 评估。

### D4: 平台元数据与文档

- `Cargo.toml` `[package.metadata.platforms.support]` 增加 OHOS 支持（参考其他 ohos 适配插件约定）。
- `README.md` 增加 OHOS 小节：需 `ohos.permission.INTERNET`、server 绑定 `127.0.0.1`（内部行为）、日志经 hilog。

## API 映射 (Tauri ↔ OHOS)

| Tauri / 跨平台 | OHOS 映射 | 说明 |
|---------------|-----------|------|
| `tiny_http::Server::http("localhost:PORT")` | `tiny_http::Server::http("127.0.0.1:PORT")` | 跳过主机名解析 |
| ArkWeb `Web({ src: 'http://localhost:PORT' })` / `controller.loadUrl('http://localhost:PORT')` | 同（ArkWeb 原生支持 http + loopback secure context） | 无需 ArkTS 改动 |
| `ohos.permission.INTERNET` | app `module.json5` `requestPermissions` | tauri 模板已含，仅文档强调 |
| `log::error!` | hilog（经宿主 `ohos_log::init()`） | 符合 §3.4 日志规则 |
| `asset_resolver.get(path)` | 同（tauri 核心，OHOS 已支持） | 不改动 |

## Risks / Trade-offs

- **[风险] `127.0.0.1` 与 ArkWeb "localhost" 解析不一致** → 即"IPv4/IPv6 错配"自相矛盾风险。已通过 **D0 诊断门槛**控制：D0 设备端实测 `localhost` 解析顺序与 ArkWeb fetch 路径，分支②（IPv6 优先）下改双栈或改前端 URL，分支③（A/B 证伪）下 D1 暂停回退修正。D1+D2 不得在 D0 门槛通过前合入——与 `p1-upload-ohos-fix` D3 诊断纪律一致。
- **[风险] 端口被占用** → 原 `.expect()` 会 panic；现改为 `log::error!` + 线程退出，前端 fetch 失败但有日志可查。
- **[权衡] 不加 CORS** → api 示例跨源测试在 OHOS 可能仍失败；同源主路径可用。若验证要求跨源通过，按 D3 可选项加 `Access-Control-Allow-Origin`。
- **[风险] hilog 未初始化时 `log::error!` 丢失** → 宿主 app 必须先 `ohos_log::init()`（tauri api 示例已做）；文档强调。
- **[权衡] OHOS 绑定地址与公开 `host` 字段语义分离** → `host` 仍为 "localhost"（用于 URL/日志），实际 bind 用 127.0.0.1；行为对用户透明，但需文档说明。

## Migration Plan

1. **D0 先行（硬性门槛，不得与 D1+D2 并行）**：在 lib.rs OHOS 分支加入诊断探针（`localhost` 解析结果、`TcpListener::bind` 实际 local_addr、前端 fetch localhost 与 127.0.0.1 各自结果），构建设备端 app，复现一次 `fetch('http://localhost:PORT/index.html')`，hilog 抓取三类信息。
2. **门槛判定**：按 D0 三分支标准判定 → 分支①进入步骤 3（D1 绑 127.0.0.1）；分支②改 D1 为双栈或前端 URL 改 127.0.0.1 后进入步骤 3；分支③ D1 暂停，回"根因分析"修正假设与方案后重新评估。
3. 修改 `lib.rs`（D1 按分支选定 + D2 错误处理），`cargo check --target aarch64-linux-ohos -p tauri-plugin-localhost` 通过。
4. 非 OHOS `cargo check -p tauri-plugin-localhost` 回归通过。
5. 设备端构建 app（确认 `module.json5` 含 `ohos.permission.INTERNET`），`hilog | grep "localhost plugin"` 观察 server 启动与 `listening on <bind_addr>` 日志。
6. 前端 `fetch('http://localhost:3005/index.html')`（分支①/②双栈）或 `fetch('http://127.0.0.1:3005/index.html')`（分支②改前端 URL）期望 200 + 非空 body。
7. 回滚：还原 `lib.rs`（单文件 cfg 隔离，回滚无副作用）。

## Open Questions

- 是否需要为 api 示例跨源 fetch 测试在 OHOS 开启 CORS（D3 可选项）？验证阶段若该 manual 测试需通过则开启，否则保留默认。
- OHOS mobile 形态是否同样需要本修复？loopback 行为与设备形态无关，预计通用；验证仅在 desktop 进行。

---

## 实现期补充 (2026-07-21，D3 可选项激活)

D3 原定"CORS 可选，默认不开"。验证阶段 examples/api 跨源 fetch 测试(`fetch('http://127.0.0.1:3005/index.html')` 从 `tauri://localhost` 主页面发起)需通过，故**激活 D3 可选项**:在 OHOS(`cfg(target_env = "ohos")`)Response 默认加 `Access-Control-Allow-Origin: *`(以及其他 CORS 头),落地 `plugins/localhost/src/lib.rs:151-163`。同源主路径不受影响;CORS `*` 是跨源兜底。OHOS 绑 `127.0.0.1`(非 `localhost`，D0 诊断确认 OHOS `localhost` 解析不可靠)。

验证:examples/api `plugin-localhost.fetch 200` ✅(跨源 fetch 成功);手动 Localhost fetch(CORS)按钮 `ACAO=*` + PASS。

### Review 修复 (2026-07-22)
- D0 诊断块(to_socket_addrs + 2× TcpListener::bind 探测)在验证绑定策略后**已删除**(原 lib.rs:83-107,每次 setup 做 3 次 socket 探测的开销不再需要)。
- CORS 头(ACAO/Methods/Headers)确认 `#[cfg(target_env = "ohos")]` 门控(与非 OHOS 平台原有更严格 CORS 姿态一致;之前实现误为无条件插入,review 修正)。
