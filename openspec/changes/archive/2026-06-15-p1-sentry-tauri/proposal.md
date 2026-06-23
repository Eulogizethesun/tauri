## Why

sentry-tauri 是一个将 Sentry 错误追踪 SDK 桥接到 Tauri 应用的插件，目前支持 Windows/macOS/Linux/Android，但不支持 OHOS。随着 Tauri v2 在 OHOS 平台的逐步成熟，开发者需要在 OHOS desktop 应用中使用 Sentry 进行错误监控和崩溃上报。该插件代码已是跨平台设计，OHOS 适配工作量小（仅 3-5 个文件），是补齐 OHOS 生态的低成本高价值改进。

## What Changes

- **Cargo.toml minidump 排除**：将 `sentry-rust-minidump` 的 OHOS 排除加入（类似已有的 iOS 排除），因为 minidump 依赖的 `crash-handler` crate 不支持 OHOS 平台
- **编译兼容性验证与修复**：验证 `sentry` crate (v0.42) 及其传递依赖（`reqwest`、`openssl` 等）在 `aarch64-linux-ohos` 目标上的编译兼容性，必要时调整依赖配置或 feature flags
- **示例应用 OHOS 配置**：为 `examples/basic-app` 添加 OHOS 目标配置，确保端到端可构建和部署
- **OHOS 崩溃上报方案评估**：评估是否需要在 OHOS 上使用 `hiAppEvent` API 替代 minidump 进行原生崩溃捕获，或作为后续增强

## Capabilities

### New Capabilities
- `sentry-tauri-ohos`: 让 sentry-tauri 插件在 OHOS desktop 平台上编译通过并正常工作，包括 JS 错误捕获、breadcrumb 同步、envelope 转发到 Sentry 服务器

### Modified Capabilities
<!-- 无需修改已有 spec，sentry-tauri 是独立的外部插件 -->

## Impact

- **代码**：sentry-tauri 仓库（外部仓库，非 tauri 核心代码），涉及 `Cargo.toml`、`src/lib.rs`（可能无需修改）、`examples/basic-app/` 配置
- **依赖**：
  - `sentry` crate v0.42 — 需验证 OHOS 编译兼容性
  - `sentry-rust-minidump` v0.13 — OHOS 上排除
  - `tauri` v2 — 已支持 OHOS
  - `@sentry/browser` v10.8.0 — JS 端，OHOS WebView 基于 Chromium 完全兼容
- **平台能力依赖**：
  - `javaScriptOnDocumentStart` (API 9+) — wry OHOS 已实现支持
  - Tauri invoke IPC — OHOS 已支持
  - `ohos.permission.INTERNET` — 网络权限，需在 `module.json5` 中配置
- **不支持的功能**：
  - `sentry-rust-minidump` 原生崩溃捕获 — OHOS 上不可用，需 stub/fallback
  - OHOS 原生崩溃捕获可通过 `hiAppEvent` API 实现，但作为后续增强
