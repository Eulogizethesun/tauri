## Why

Phase 1/2 实现了 deep-link 的 OHOS 功能（运行中事件接入 + 首启动 `get_current` + scheme 注册声明），但缺少前端测试用例和文档。deep-link 当前**完全不在 api demo**（`examples/api` 的 `package.json`/`Cargo.toml`/`lib.rs`/`capabilities` 均无 deep-link），README 无 OHOS 章节（`README.md:5-11` 平台表无 OHOS）。Phase 3 补充测试与文档，确保 deep-link 在 OHOS 上的行为可验证、可维护，对标其他已适配插件（notification/global-shortcut）的测试覆盖。

## What Changes

- **前端测试用例**（`examples/api/src/lib/tests/plugins.ts`）：4 个 auto（`getCurrent`/`isRegistered`/`register`+`unregister`/`onOpenUrl` 注册返回 UnlistenFn）+ 3 个 manual（`onOpenUrl` 事件触发/`getCurrent` 首启动/外部链接唤起）。
- **api demo 接入 deep-link**：4 步（`Cargo.toml` 依赖/`package.json` 依赖/`lib.rs` 注册/`capabilities` `deep-link:default`）。Phase 3 在 Phase 1/2 完成后进行，deep-link 已能 OHOS 编译，无需 cfg 排除。
- **`examples/app` OHOS 化**：`tauri.conf.json` 加 OHOS deep-link 配置段、`Cargo.toml` cfg 隔离 desktop feature、`lib.rs` OHOS 注册。
- **README 补充 OHOS 章节**：平台表加 OHOS 行 + Configuration 段补 OHOS 配置说明。
- **Rust UT（可选）**：若 Phase 1/2 产出可测纯函数（如 scheme 映射），按 `ohos-rust-ut` skill 设备端 `--test-threads=1`。

## Capabilities

### New Capabilities
- `ohos-deep-link-testing`: deep-link OHOS 前端测试用例（auto/manual 分类）+ api demo 接入 + `examples/app` OHOS 化 + README 文档。

### Modified Capabilities
<!-- 无现有 deep-link 测试 spec，本 Phase 为新增。 -->

## Impact

- **代码-测试**：`tauri/examples/api/src/lib/tests/plugins.ts`（新增 deep-link 测试用例）
- **代码-api demo 配置**：`tauri/examples/api/src-tauri/Cargo.toml`、`tauri/examples/api/package.json`、`tauri/examples/api/src-tauri/src/lib.rs`、`tauri/examples/api/src-tauri/capabilities/run-app.json`— 4 文件
- **代码-examples/app**：`plugins-workspace/plugins/deep-link/examples/app/src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/src/lib.rs`— 3 文件
- **文档**：`plugins-workspace/plugins/deep-link/README.md`
- **后续**：无（Phase 3 为最后一个 Phase）
