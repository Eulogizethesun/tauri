# localhost 插件 OHOS 适配修复 适配计划

**创建时间**：2026-07-17
**功能描述**：localhost 插件 `Builder::new(3005).build()` 注册后，前端 `fetch('http://localhost:3005/index.html')` 报 "Failed to fetch"，疑似 tiny_http server 在 OHOS 上未正确启动。需定位根因并修复，使 localhost 插件在 OHOS desktop 上端到端可用，行为与 Windows/macOS 一致。
**判断依据**：涉及 1 个代码层（localhost 插件 Rust 实现），预估影响文件 ≤ 4 个。按 SKILL 规则（≤2 层、≤5 文件 → 不拆分），单 Phase 完成。OHOS 三铁律：cfg(target_env="ohos") 隔离 / openharmony-ability 唯一桥接（本插件不调用 ArkTS，无需桥接）/ 不影响其他平台。

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | tiny_http 绑定与诊断修复 | p1_localhost-ohos-fix | ✓ 设计完成 | localhost 插件（Rust） | 3-4 | cargo check OHOS + 设备端 fetch http://localhost:3005/index.html 返回 200 |

## Phase 详细说明

### Phase 1: tiny_http 绑定与诊断修复
- **目标**：
  1. **D0 诊断门槛先行**：定位 OHOS 上 `tiny_http::Server::http("localhost:PORT")` 静默失败根因（hostname 解析 / IPv4-IPv6 错配 / `.expect()` panic 不可见）——设备端实测 `localhost` 解析顺序、实际 bind 地址、ArkWeb fetch 路径，按三分支门槛判定，**不直接固化 127.0.0.1**。
  2. 用 `cfg(target_env = "ohos")` 隔离的最小修复：按 D0 门槛分支选定绑定地址（分支① `127.0.0.1`；分支②双栈或前端 URL 改 `127.0.0.1`；分支③回退修正根因），并将 `.expect()` 改为可诊断的错误处理（hilog 输出），使 server 线程成功监听且失败可见。D1+D2 不得在 D0 门槛判定前合入（与 `p1-upload-ohos-fix` D3 诊断纪律一致）。
  3. 确认 `ohos.permission.INTERNET` 已在 module.json5 模板中（无需改桥接仓）。
  4. 不影响 Windows/macOS/Linux/Android/iOS 既有路径。
- **文件列表（预估）**：
  - `plugins-workspace/plugins/localhost/src/lib.rs`（D0 诊断探针 + D1 按分支绑定 + D2 错误处理 + CORS 评估）
  - `plugins-workspace/plugins/localhost/Cargo.toml`（平台支持元数据补充 ohos）
  - `plugins-workspace/plugins/localhost/README.md`（OHOS 使用说明：INTERNET 权限、host 注意事项、D0 诊断探针输出位置）
  - `tauri/examples/api/src-tauri/gen/ohos/entry/src/main/module.json5`（仅核对 INTERNET 权限，模板已含，预计不改）
- **依赖**：无
- **验证方式**：
  - `cargo check --target aarch64-linux-ohos -p tauri-plugin-localhost` 退出码 0
  - 非 OHOS 目标 `cargo check -p tauri-plugin-localhost` 回归通过
  - 设备端 D0 门槛：hilog 可见 `localhost` 解析结果 / 实际 bind 地址 / fetch localhost 与 127.0.0.1 各自结果，并完成三分支判定
  - 设备端：前端 `fetch('http://localhost:3005/index.html')`（分支①/②双栈）或 `fetch('http://127.0.0.1:3005/index.html')`（分支②改前端 URL）返回 200，body 非空
  - 设备端：hilog 可见 server 启动日志（或失败日志）

## 状态说明
- `○ 待开始` — 未开始设计
- `● 进行中` — 正在设计或实现
- `✓ 设计完成` — 设计文档已生成并通过审计
- `✓ 已归档` — 已完成实现、测试并归档
