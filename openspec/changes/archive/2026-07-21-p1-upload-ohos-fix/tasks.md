## 1. 诊断先行（D3 硬性先决门槛 — 第 2 节不得在本节通过前启动）

- [ ] 1.1 在 `crates/tauri/src/ipc/protocol.rs` `parse_invoke_request` 内增加 `cfg(target_env = "ohos")` 隔离的 `log::trace!` 诊断：记录 cmd、Content-Type、`has_payload`、body 字节数、最终 `InvokeBody` 变体（Json/Raw）
- [ ] 1.2 `cargo check --target aarch64-linux-ohos -p tauri` 通过；非 OHOS `cargo check -p tauri` 通过（确认 cfg 隔离）
- [ ] 1.3 构建设备端 app，复现 `plugin:upload|upload` invoke，hilog 抓取诊断日志，按以下门槛判定：
  - **通过（推进第 2 节）**：日志显示 body 空 / Content-Type 丢失 / `InvokeBody::Raw` 或空 `Json({})`，与假设 A 一致
  - **证伪（第 2 节暂停）**：日志显示 body 为合法 JSON 且 `InvokeBody::Json` 但 upload 仍失败 → 回 `design.md` "根因分析" 修正假设与方案，转查 B/C/D，重新评估后再推进
  - **其他（第 2 节暂停）**：日志显示未预期变体 → 据实修正 `design.md` 根因分析与 D1/D2 决策

## 2. IPC 传输路径修复（tauri 核心 — 仅在第 1.3 节"通过"判定后执行）

- [ ] 2.1 修改 `crates/tauri/src/app.rs` `Builder::new()` 中 `InvokeInitializationScript.os_name`：`cfg!(target_env = "ohos")` 时设为 `"ohos"`，否则 `std::env::consts::OS`
- [ ] 2.2 修改 `crates/tauri/scripts/ipc-protocol.js`：`canUseCustomProtocol = osName !== 'android' && osName !== 'ohos'`
- [ ] 2.3 确认 `window/plugin.rs` drag.js 的 `os_name="ohos"` 既有逻辑未被破坏（一致性核对）
- [ ] 2.4 `cargo check --target aarch64-linux-ohos -p tauri` 通过；非 OHOS `cargo check -p tauri` 回归通过

## 3. upload 插件平台元数据与文档

- [ ] 3.1 `plugins-workspace/plugins/upload/Cargo.toml` `[package.metadata.platforms.support]` 增加 `ohos = { level = "full", notes = "" }`
- [ ] 3.2 `plugins-workspace/plugins/upload/README.md` 增加 OHOS 小节：IPC 走 postMessage、需 `ohos.permission.INTERNET`、诊断日志经 hilog、mobile 形态限制
- [ ] 3.3 `cargo check --target aarch64-linux-ohos -p tauri-plugin-upload` 通过；非 OHOS `cargo check -p tauri-plugin-upload` 回归通过

## 4. 设备端端到端验证

- [ ] 4.1 构建含 upload 插件的 OHOS desktop app，确认 app `module.json5` 含 `ohos.permission.INTERNET`
- [ ] 4.2 前端调用 `upload(url, filePath, onProgress, headers, HttpMethod.Post)`：验证上传成功、`onProgress` 收到 `ProgressPayload` 事件、响应 text 正确
- [ ] 4.3 验证 `HttpMethod.Put` / `HttpMethod.Patch` 变体行为与 Windows/macOS 一致
- [ ] 4.4 前端调用 `download(url, filePath, onProgress, headers, body)`：验证下载成功、进度回调正常
- [ ] 4.5 回归核心命令（window/event/log 等）确认 postMessage 路径无退化

## 5. 非回归与收尾

- [ ] 5.1 非 OHOS 全平台 `cargo check`（tauri + tauri-plugin-upload）回归通过
- [ ] 5.2 确认 `cfg(target_env = "ohos")` 与 `osName !== 'ohos'` 双重隔离，无平台泄漏
- [ ] 5.3 更新 `openspec/upload-ohos-fix-plan.md` Phase 1 状态为 `✓ 设计完成`，归档诊断日志结论
