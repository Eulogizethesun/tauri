## 1. 插件 Cargo.toml 依赖修改

- [x] 1.1 修改 `Cargo.toml` 中 `sentry-rust-minidump` 的 target 条件，排除 OHOS：`[target.'cfg(all(not(target_os = "ios"), not(target_env = "ohos")))'.dependencies]`
- [x] 1.2 验证 `sentry` crate (v0.42) 默认 features 在 OHOS 上可编译

## 2. 插件 src/lib.rs cfg 调整

- [x] 2.1 修改 `src/lib.rs` 中 `minidump` re-export 的 cfg 条件，添加 `not(target_env = "ohos")`：`#[cfg(all(not(target_os = "ios"), not(target_env = "ohos"), feature = "minidump"))]`

## 3. 插件编译验证

- [x] 3.1 执行 `cargo check --target aarch64-unknown-linux-ohos` 确认编译通过
- [x] 3.2 执行 `cargo check --target aarch64-unknown-linux-ohos --features minidump` 确认 minidump 被静默跳过
- [x] 3.3 执行 `cargo check`（默认 host target）确认不影响 Windows/macOS/Linux 编译
- [x] 3.4 如果编译失败（如 openssl-sys），切换 sentry 依赖到 `rustls` feature：`sentry = { version = "0.42", default-features = false, features = ["reqwest", "rustls", ...] }`

## 4. 示例应用 Cargo.toml 修改

- [x] 4.1 在 `examples/basic-app/src-tauri/Cargo.toml` 中修改 sentry 依赖，显式使用 rustls：`sentry = { version = "0.42", default-features = false, features = ["reqwest", "rustls", "backtrace", "contexts", "panic", "debug-images"] }`
- [x] 4.2 将 `sadness-generator` 依赖改为条件编译：`[target.'cfg(all(not(target_os = "ios"), not(target_env = "ohos")))'.dependencies]`

## 5. 示例应用 src/lib.rs cfg 条件编译

- [x] 5.1 为 `minidump::init(&client)` 调用添加 `#[cfg(all(not(target_os = "ios"), not(target_env = "ohos")))]` 守卫
- [x] 5.2 为 `native_crash` command 及其 `sadness-generator` 使用添加 `#[cfg(all(not(target_os = "ios"), not(target_env = "ohos")))]` 守卫
- [x] 5.3 在 `invoke_handler` 的 `generate_handler!` 宏中条件包含 `native_crash`

## 6. 示例应用 OHOS 平台配置

- [x] 6.1 在 `examples/basic-app` 的 OHOS 配置 `module.json5` 中添加 `ohos.permission.INTERNET` 网络权限
- [x] 6.2 确认示例应用 capabilities（`main.json`）中 sentry 插件权限配置正确（`sentry:default`）
- [ ] 6.3 示例应用可成功构建 OHOS HAP 包

## 7. 端到端功能验证

- [ ] 7.1 在 OHOS desktop 设备上部署示例应用
- [ ] 7.2 触发 JS 错误（`throw new Error('test')`），确认 Sentry 仪表盘收到事件
- [ ] 7.3 触发 breadcrumb（页面导航），确认 Sentry scope 包含该 breadcrumb
- [ ] 7.4 验证 Sentry 仪表盘中事件 platform 为 "javascript"，User-Agent 已清除
- [ ] 7.5 触发 Rust panic（`rust_panic` command），确认 Sentry 捕获到 panic 事件
- [ ] 7.6 确认 OHOS 上 `native_crash` command 不可用（已排除）

## 8. 文档更新

- [x] 8.1 更新 README.md 添加 OHOS 平台支持说明
- [x] 8.2 更新 CHANGELOG.md 记录 OHOS 支持变更
- [x] 8.3 记录 known limitation：OHOS 上无原生崩溃捕获（minidump 不可用），Rust panic 仍可捕获
