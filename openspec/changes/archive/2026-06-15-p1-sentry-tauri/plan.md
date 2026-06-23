# sentry-tauri OHOS 适配计划

**创建时间**：2026-06-12
**功能描述**：让 sentry-tauri 插件（Sentry 错误追踪桥接）支持在 OHOS desktop 设备上运行
**判断依据**：涉及 1 个代码层（tauri-plugin），预估 3-5 个文件，不拆分

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | sentry-tauri OHOS 编译适配 | p1-sentry-tauri | ✓ 已归档 | tauri-plugin | 3-5 | cargo check + 设备端 e2e 测试 |

## Phase 详细说明

### Phase 1: sentry-tauri OHOS 编译适配
- **目标**：让 sentry-tauri 插件在 OHOS desktop 上编译通过并完整运行
  1. 排除 `minidump` feature（OHOS 不支持，类似 iOS 处理）
  2. 验证 `sentry` crate 及其依赖在 `aarch64-linux-ohos` 上可编译
  3. 确认 JS 注入和 IPC 通信在 OHOS WebView 中正常工作
  4. 在示例应用中完成端到端验证
- **文件列表**：
  - `Cargo.toml` — 排除 minidump 在 OHOS 上的编译
  - `src/lib.rs` — 可能需要微调 cfg（预计不需要）
  - `examples/basic-app/src-tauri/Cargo.toml` — 示例应用适配
  - `examples/basic-app/src-tauri/tauri.conf.json` — OHOS 配置
- **依赖**：无
- **验证**：
  - `cargo check --target aarch64-linux-ohos`（编译通过）
  - 设备端部署，触发 JS 错误 → Sentry 仪表盘收到事件

## 关键技术发现

1. ✅ `js_init_script` 在 OHOS 已支持：wry 使用 `javaScriptOnDocumentStart()` (API 9+)
2. ✅ Tauri invoke IPC 在 OHOS 已支持
3. ⚠️ `sentry-rust-minidump` 在 OHOS 不可用，必须排除（类似 iOS）
4. ⚠️ `sentry` crate 传递依赖需验证 OHOS 编译兼容性
5. ✅ 插件代码完全跨平台，无平台特有 cfg
