## 0. 诊断先行 (D0 硬性门槛 — D1+D2 不得在本节通过前合入)

- [ ] 0.1 在 `Builder::build` 的 `setup` 闭包 `cfg(target_env = "ohos")` 分支中，加入 `("localhost", 0).to_socket_addrs()` 解析探针，`log::info!` 输出全部返回地址及顺序（区分 `127.0.0.1` / `::1`）
- [ ] 0.2 加入 `std::net::TcpListener::bind("localhost:PORT")` 探针（bind 后取 `local_addr()` 再 drop），`log::info!` 输出实际 bind 的 socket 地址（IPv4 / IPv6）
- [ ] 0.3 设备端构建 app，复现一次前端 `fetch('http://localhost:PORT/index.html')`，hilog `grep "localhost plugin"` 抓取 0.1 / 0.2 输出
- [ ] 0.4 前端分别 `fetch('http://localhost:PORT/probe')` 与 `fetch('http://127.0.0.1:PORT/probe')`，记录各自结果（200 / Failed to fetch / 连接拒绝）到 hilog 或 console
- [ ] 0.5 **门槛判定**（严格按 design.md D0 三分支标准）：
  - 分支①（`localhost` 解析含 127.0.0.1 且 fetch localhost 在 bind 127.0.0.1 后成功）→ 进入第 1 节，D1 绑 `127.0.0.1`
  - 分支②（`localhost` 解析为 ::1 优先或仅 ::1 / ArkWeb fetch localhost 走 IPv6）→ 进入第 1 节，D1 改双栈或前端 URL 改 `http://127.0.0.1:PORT`（同步改 README 与 `WebviewUrl::External` 示例）
  - 分支③（A/B 均证伪：bind 成功且 IPv4 可达但 `fetch('http://127.0.0.1:PORT')` 仍失败）→ **D1+D2 暂停**，回 design.md "根因分析" 修正假设与方案后重新评估
- [ ] 0.6 将 0.5 判定结果（分支号 + hilog 关键行）回写入 design.md D1 节"分支②实现要点"或新建"门槛验证记录"小节

## 1. 核心修复 (lib.rs)

> 依赖：第 0 节门槛判定通过（分支①或②）。分支③不进入本节。

- [ ] 1.1 在 `Builder::build` 的 `setup` 闭包中，引入 `bind_addr`：按第 0 节门槛判定的分支选定——分支①为 `format!("127.0.0.1:{port}")`；分支②为双栈（`[::]:PORT` + `IPV6_V6ONLY=false`，或两个 Server 分别 bind `127.0.0.1:PORT` 与 `[::1]:PORT`）或前端 URL 改 `http://127.0.0.1:PORT`；非 OHOS 保持 `format!("{host}:{port}")`
- [ ] 1.2 将 `Server::http(format!("{host}:{port}")).expect("Unable to spawn server")` 替换为 `match Server::http(&bind_addr) { Ok(s) => s, Err(e) => { log::error!("localhost plugin: failed to bind {bind_addr}: {e}"); return; } }`
- [ ] 1.3 在 server 成功 bind 后增加 `log::info!("localhost plugin: listening on {bind_addr}")` 启动日志（OHOS 经宿主 ohos_log 转发 hilog）
- [ ] 1.4 确认 `host` 变量仍用于日志/文档，公开 API `Builder::host` 默认值 `"localhost"` 不变
- [ ] 1.5 确认请求响应循环（`asset_resolver.get` + `Response` 头 + `req.respond`）逻辑未改，OHOS 复用既有路径

## 2. 平台元数据与文档

- [ ] 2.1 在 `plugins-workspace/plugins/localhost/Cargo.toml` 的 `[package.metadata.platforms.support]` 补充 OHOS 支持级别（参考其他 ohos 适配插件）
- [ ] 2.2 在 `plugins-workspace/plugins/localhost/README.md` 增加 OHOS 小节：需 `ohos.permission.INTERNET`、server 内部绑定 `127.0.0.1`（跳过 "localhost" 解析）、日志经 hilog、`ohos_log::init()` 前置要求
- [ ] 2.3 核对 `tauri/crates/tauri-cli/templates/mobile/open-harmony/entry_desktop/src/main/module.json5` 与 `entry_mobile/src/main/module.json5` 均已含 `ohos.permission.INTERNET`（审计已核对，预计不改，仅核对）

## 3. CORS 可选增强评估（默认不做）

- [ ] 3.1 验证阶段若 api 示例 `@tauri-apps/plugin-localhost.fetch 200` 跨源 manual 测试需在 OHOS 通过，则在 `cfg(target_env = "ohos")` 下为 `Response` 默认加 `Access-Control-Allow-Origin: *`；否则跳过并在 tasks 注明保留默认

## 4. 编译验证

- [ ] 4.1 `cargo check --target aarch64-linux-ohos -p tauri-plugin-localhost` 退出码 0
- [ ] 4.2 `cargo check -p tauri-plugin-localhost`（默认目标）退出码 0，回归无变化
- [ ] 4.3 确认无 `cfg(target_env = "ohos")` 分支泄漏到非 OHOS 编译路径

## 5. 设备端验证

- [ ] 5.1 构建带 localhost 插件 (port 3005) 的 OHOS app，确认 `module.json5` 含 INTERNET 权限
- [ ] 5.2 `hilog | grep "localhost plugin"` 观察到 `listening on 127.0.0.1:3005` 启动日志
- [ ] 5.3 前端 `fetch('http://localhost:3005/index.html')` 返回 200，body 非空（manual 测试）
- [ ] 5.4 （可选）若使用 `WebviewUrl::External("http://localhost:3005")` 同源加载，确认主页面正常渲染
- [ ] 5.5 故意占用 3005 端口验证失败路径：hilog 出现 `failed to bind` 日志，线程不 panic

## 6. 回归与收尾

- [ ] 6.1 非 OHOS 平台手动回归：localhost 插件在 Windows/macOS 仍以 `"localhost:PORT"` 绑定且可用
- [ ] 6.2 更新 `openspec/localhost-ohos-fix-plan.md` Phase 1 状态为 `✓ 设计完成`
