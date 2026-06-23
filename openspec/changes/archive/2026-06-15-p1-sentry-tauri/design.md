## Context

sentry-tauri 是一个独立的 Tauri v2 插件（仓库：`ljy9812/sentry-tauri`），用于将 Sentry 错误追踪 SDK 桥接到 Tauri 应用。其架构为双层：

- **Rust 端**：`tauri-plugin-sentry` crate，提供 `envelope` 和 `breadcrumb` 两个 Tauri command，将 JS 端转发的错误数据通过 `sentry` crate (v0.42) 发送到 Sentry 服务器
- **JS 端**：`@sentry/browser` SDK 的自定义 transport，通过 Tauri invoke IPC 将 envelope 和 breadcrumb 转发到 Rust 进程

当前支持 Windows/macOS/Linux/Android。iOS 已排除 minidump。OHOS 不在支持列表中。

**约束**：
- sentry-tauri 是外部插件仓库，不是 tauri 核心代码
- 插件代码已是跨平台设计，`lib.rs` 和 `commands.rs` 无平台特有 cfg
- Tauri v2 的 OHOS 支持已成熟（IPC、WebView JS 注入、网络均可用）
- `sentry-rust-minidump` 依赖 `crash-handler` crate，不支持 OHOS

## Goals / Non-Goals

**Goals:**
- sentry-tauri 插件在 OHOS desktop 设备上编译通过（`cargo check --target aarch64-unknown-linux-ohos`）
- JS 错误捕获完整工作：WebView 中 JS 异常 → @sentry/browser → invoke IPC → Rust sentry → Sentry 服务器
- Breadcrumb 同步完整工作
- 示例应用可在 OHOS desktop 设备上部署并验证端到端功能

**Non-Goals:**
- ❌ OHOS 原生崩溃捕获（minidump 替代方案）— 作为后续增强
- ❌ 修改 openharmony-ability / tao / wry / muda 等底层仓
- ❌ 修改 tauri 核心代码
- ❌ 移动端 (OHOS mobile) 适配 — 本次仅针对 desktop

## Decisions

### Decision 1: minidump 在 OHOS 上排除（类似 iOS 处理）

**选择**：在 `Cargo.toml` 中将 `sentry-rust-minidump` 的 OHOS 排除，与 iOS 一致。

```toml
[target.'cfg(all(not(target_os = "ios"), not(target_env = "ohos")))'.dependencies]
sentry-rust-minidump = { version = "0.13", optional = true }
```

同时 `lib.rs` 中的 re-export 需要调整 cfg：

```rust
#[cfg(all(not(target_os = "ios"), not(target_env = "ohos"), feature = "minidump"))]
pub use sentry_rust_minidump as minidump;
```

**理由**：`sentry-rust-minidump` 依赖 `crash-handler` crate，该 crate 仅支持 Windows (SEH)、macOS (Mach exceptions)、Linux (signal handler)、Android。OHOS 虽然 `target_os` 是 `"linux"`，但其信号处理和 crash 机制与标准 Linux 不同，`crash-handler` 无法直接编译。

**替代方案**：
- 在 OHOS 上使用 `hiAppEvent` API 订阅崩溃事件 → 需要 openharmony-ability 新模块 + ArkTS 桥接，工作量远超本 Phase 范围
- 自行实现 OHOS signal handler → 不安全且复杂度高

### Decision 2: sentry crate TLS 后端切换到 rustls

**选择**：在示例应用 `Cargo.toml` 中显式使用 `rustls` 替代默认的 `native-tls`（openssl）。

```toml
sentry = { version = "0.42", default-features = false, features = ["reqwest", "rustls", "backtrace", "contexts", "panic", "debug-images"] }
```

**理由**：
- sentry crate 默认使用 `native-tls` → 依赖 `openssl-sys` C 库，OHOS 交叉编译需要手动通过 lycium 编译 openssl，流程复杂
- Tauri v2 自身已在 OHOS 上使用 `rustls`（通过 reqwest），验证了 `rustls` 在 OHOS 上的可用性
- `rustls` 是纯 Rust 实现，无需 C 编译器，交叉编译零额外依赖
- OHOS WebView 中 @sentry/browser 的 HTTPS 请求由 WebView 内部 Chromium 网络栈处理，不受 Rust TLS 后端影响

**替代方案**：
- 通过 lycium 手动编译 openssl for OHOS → 流程复杂，且增加应用包大小
- 使用 `ureq` 替代 `reqwest` → sentry crate 支持 ureq transport，但功能较 reqwest 少

### Decision 3: 示例应用需要 cfg 条件编译

**选择**：示例应用 `lib.rs` 中需要添加平台条件编译。

```rust
// minidump::init 仅在支持的平台调用
#[cfg(all(not(target_os = "ios"), not(target_env = "ohos")))]
let _guard = tauri_plugin_sentry::minidump::init(&client);

// native crash 测试仅在支持的平台可用
#[cfg(all(not(target_os = "ios"), not(target_env = "ohos")))]
#[tauri::command]
fn native_crash() {
    unsafe { sadness_generator::raise_segfault() }
}
```

**理由**：
- `tauri_plugin_sentry::minidump` 模块在 OHOS 上不存在（re-export 已排除），无条件调用将导致编译错误
- `sadness-generator` crate 依赖平台 signal/crash 机制，OHOS 上可能无法编译
- 示例应用的 `Cargo.toml` 中 `sadness-generator` 依赖也需要条件排除

**选择**：不修改 JS 端代码（`js/index.ts`、`js/inject.ts`）。

**理由**：
- `js_init_script` 机制在 OHOS 上通过 wry 的 `javaScriptOnDocumentStart()` (API 12) 实现，openharmony-ability 的 ArkHelper.ets 已将 `string[]` 自动转换为 `ScriptItem[]`（`scriptRules: ["*"]`）
- OHOS WebView 基于 Chromium 内核，完全支持 ES6+ 语法
- `@sentry/browser` SDK 是标准 JS，不依赖任何平台特有 API
- Tauri invoke IPC 在 OHOS 上已完整支持

### Decision 4: OHOS 网络权限配置在示例应用中处理

**选择**：在示例应用的 `module.json5` 中添加 `ohos.permission.INTERNET` 权限。

**理由**：sentry crate 通过 HTTP 将数据发送到 Sentry 服务器。OHOS 应用必须在 `module.json5` 中声明网络权限。这是应用级配置，不是插件级配置。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `sentry` crate 传递依赖在 OHOS 编译失败 | 插件无法编译 | 切换到 `rustls` feature；如果特定 crate 不兼容，fork 并打 patch |
| OHOS 无原生崩溃捕获 | 只有 JS 错误被捕获，Rust native crash 不报 | 记录为 known limitation；后续通过 hiAppEvent 补充 |
| OHOS WebView 网络策略限制 | JS SDK 的 envelope 无法到达 Rust | OHOS WebView 不限制 invoke IPC，仅限制外部网络访问 |
| sentry crate 版本锁定 v0.42 | 可能缺少 OHOS 平台的修复 | 评估升级到最新版本是否必要 |

## Open Questions

1. **sentry crate OHOS 编译验证**：需要实际执行 `cargo check --target aarch64-unknown-linux-ohos` 确认传递依赖兼容性
2. **sentry DSN 配置**：示例应用需要一个有效的 Sentry DSN 才能进行端到端测试
3. **OHOS 崩溃捕获增强**：是否在后续 Phase 中通过 `hiAppEvent` API 实现 OHOS 原生崩溃上报？
