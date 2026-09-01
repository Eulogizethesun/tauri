# Upload 插件 OHOS 反序列化修复 适配计划

**创建时间**：2026-07-17
**功能描述**：upload 插件 `plugin:upload|upload` 在 OHOS desktop 上 invoke 报 "unexpected invoke body"（后端反序列化失败），疑似 Channel/HashMap/enum 在 OHOS 反序列化问题。需定位根因并修复，使 upload/download 命令在 OHOS 上行为与 Windows/macOS 一致。
**判断依据**：涉及 1-2 个代码层（tauri 核心 IPC + upload 插件元数据），预估影响文件 5 个。按 SKILL 规则（≤5 文件、≤2 层 → 不拆分），单 Phase 完成。

## 实施顺序约束（硬性，贯穿 Phase 1）

> **D3 诊断日志是 D1+D2 的硬性先决门槛，不得并行、不得跳过。**
>
> 根因假设 A（ArkWeb 自定义 scheme POST body 交付不可靠）的源码路径分析虽已审计核对无误（`ipc-protocol.js:20` `canUseCustomProtocol=osName!=='android'`、`app.rs:1627` `os_name=std::env::consts::OS`（OHOS 上为 `"linux"`）、`window/plugin.rs:268` 已有 OHOS 设 `os_name='ohos'` 先例三处），但 "body 不可靠" 事实结论 MUST 经设备端 hilog 日志验证后方可作为定论推进 D1+D2。
>
> 实现顺序严格为：
> 1. **先合入 D3**（`parse_invoke_request` OHOS 诊断日志，`cfg` 隔离，无条件合入）→ 构建设备端 app → 复现一次 `plugin:upload|upload` invoke → hilog 抓取 cmd / Content-Type / body 字节数 / `InvokeBody` 变体。
> 2. **门槛判定**：
>    - 通过（推进 D1+D2）：日志显示 body 空 / Content-Type 丢失 / `InvokeBody::Raw` 或空 `Json({})`，与假设 A 一致。
>    - 证伪（D1+D2 暂停）：日志显示 body 为合法 JSON 且 `InvokeBody::Json` 但 upload 仍失败 → 回 `design.md` "根因分析" 修正假设与方案，转查 B/C/D 后重新评估。
>    - 其他（D1+D2 暂停）：日志显示未预期变体 → 据实修正 `design.md` 根因分析与 D1/D2 决策。
> 3. **仅在门槛"通过"后**执行 D1+D2（改 `app.rs` `os_name` 与 `ipc-protocol.js` 守卫）。
>
> 实现者不得跳过诊断直接合传输路径修改。D3 诊断日志本身不论假设 A 是否成立均无条件合入（有价值、`cfg` 隔离零平台影响）。详见 `changes/p1-upload-ohos-fix/design.md` D3 决策与 Migration Plan。

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | 根因定位与反序列化修复（D3 先行 → D1+D2 门槛后执行） | p1-upload-ohos-fix | ✓ 设计完成 | tauri 核心 IPC（app.rs + ipc-protocol.js + protocol.rs） + upload 插件元数据 | 5 | 见下方"验证方式（按顺序）" |

## Phase 详细说明

### Phase 1: 根因定位与反序列化修复

- **目标**：
  1. **D3 先行**：在 `parse_invoke_request` 增加 OHOS 诊断日志，设备端验证根因假设 A（custom-protocol POST body 不可靠）是否成立。此为 D1+D2 的硬性先决门槛。
  2. **D1+D2（仅 D3 门槛"通过"后执行）**：cfg 隔离地将 `InvokeInitializationScript.os_name` 在 OHOS 上设为 `"ohos"`、`ipc-protocol.js` `canUseCustomProtocol` 守卫排除 `'ohos'`，使 OHOS invoke 走 `window.ipc.postMessage` 路径（与 Android 同策略，复用既有 `WebProxy` 桥接，不新增 NAPI）。
  3. **D4**：补 upload 插件平台元数据与文档。
  4. 不影响 Windows/macOS/Linux/Android/iOS 既有路径；所有 OHOS 变更 `cfg(target_env = "ohos")` 隔离。
- **文件列表（与 design.md 一致）**：
  - `crates/tauri/src/ipc/protocol.rs`（D3：`parse_invoke_request` OHOS 诊断日志，`cfg(target_env = "ohos")` 隔离）
  - `crates/tauri/src/app.rs`（D1：`InvokeInitializationScript.os_name` OHOS 分支，`cfg!(target_env = "ohos")` 时设为 `"ohos"`）
  - `crates/tauri/scripts/ipc-protocol.js`（D2：`canUseCustomProtocol = osName !== 'android' && osName !== 'ohos'`）
  - `plugins-workspace/plugins/upload/Cargo.toml`（D4：`[package.metadata.platforms.support]` 增加 `ohos = { level = "full", notes = "" }`）
  - `plugins-workspace/plugins/upload/README.md`（D4：OHOS 小节）
  - 不改 `upload/src/lib.rs` 命令逻辑；不改 `wry` / `openharmony-ability`（design.md Non-Goals 明确排除）。
- **依赖**：无

- **验证方式（按顺序，D3 门槛为 D1+D2 的硬性先决）**：
  1. **D3 门槛验证（必须先通过）**：
     - `cargo check --target aarch64-linux-ohos -p tauri` + 非 OHOS `cargo check -p tauri` 通过（cfg 隔离）。
     - 构建设备端 app，复现 `plugin:upload|upload` invoke，hilog 抓取诊断日志。
     - 门槛判定：日志与假设 A 一致（body 空 / Content-Type 丢失 / `InvokeBody::Raw` 或空 `Json({})`）→ 推进 D1+D2；证伪/其他 → D1+D2 暂停，回 design.md 修正。
  2. **D1+D2 验证（仅 D3 门槛"通过"后执行）**：
     - `cargo check --target aarch64-linux-ohos -p tauri` + 非 OHOS `cargo check -p tauri` 回归通过。
     - 确认 `window/plugin.rs` drag.js 的 `os_name="ohos"` 既有逻辑未被破坏。
  3. **D4 验证**：`cargo check --target aarch64-linux-ohos -p tauri-plugin-upload` + 非 OHOS `cargo check -p tauri-plugin-upload` 回归通过。
  4. **设备端端到端**：前端 `upload(url, filePath, onProgress, headers, method)` 成功上传、`onProgress` 收到 `ProgressPayload` 事件、响应 text 正确；`download(...)` 同样可用；回归核心命令（window/event/log）确认 postMessage 路径无退化。

## 状态说明
- `○ 待开始` — 未开始设计
- `● 进行中` — 正在设计或实现
- `✓ 设计完成` — 设计文档已生成并通过审计
- `✓ 已归档` — 已完成实现、测试并归档
