## Context

Phase 1/2 实现了 deep-link 的 OHOS 功能。Phase 3 补充测试与文档。

**测试基础设施**（`frontend-api-testing` skill）：
- 分类：`auto`（可自动断言）/ `side-effect`（有副作用可程序验证）/ `manual`（需人工确认）
- 位置：`examples/api/src/lib/tests/plugins.ts`（动态 import 防加载失败）
- 约束：5 秒超时（`test-runner.ts:30`）；OHOS 不支持的 plugin 用 cfg 排除但测试保留
- 最佳参考：`global-shortcut` 的 `register+isRegistered` 模式（`plugins.ts:674-702`）、`notification` 的 try/catch 容错（`plugins.ts:496-499`）

**deep-link 现状**：完全不在 api demo（无依赖/注册/权限/测试）；`examples/app` 无 OHOS 配置；README 无 OHOS 章节。

**OHOS 测试约束**（`ohos-rust-ut` skill）：不能用 mock runtime（desktop 专用），只能测纯函数；设备端 `--test-threads=1`。

**前置依赖**：Phase 3 在 Phase 1/2 完成后进行，deep-link 已能 OHOS 编译，`getCurrent`/`isRegistered`/`register`/`onOpenUrl` 均有 OHOS 实现可测。

## Goals / Non-Goals

**Goals:**
- 4 个 auto 测试用例（可自动断言）
- 3 个 manual 测试用例（人工确认清单）
- api demo 接入 deep-link（4 步配置）
- `examples/app` OHOS 化
- README OHOS 章节

**Non-Goals:**
- 完整 e2e 自动化（外部链接唤起需 manual，无法自动化）
- side-effect 用例（deep-link 无可程序验证的副作用场景——register 是 no-op，onOpenUrl 触发需外部唤起）

## Decisions

### D1: 测试分类——4 auto + 3 manual
**选择**：
- auto：`getCurrent()`（非链接启动返回 null/空数组）、`isRegistered(scheme)`（返回 false）、`register(scheme)`+`unregister(scheme)`（no-op 不抛错）、`onOpenUrl` 注册返回 UnlistenFn（`typeof === 'function'`）
- manual：`onOpenUrl` 事件实际触发（需外部链接唤起）、`getCurrent()` 经链接启动（需外部唤起）、外部链接唤起 app（跨 app 行为）

**理由**：auto 用例基于 Phase 1 的 no-op 语义（`isRegistered`→`Ok(false)`、`register`/`unregister`→`Ok(())`）和纯注册行为（`onOpenUrl` 返回 UnlistenFn），可自动断言。manual 用例需外部链接唤起，autotest 无法触发。无 side-effect 用例——deep-link 的 register 是 no-op 无副作用，onOpenUrl 触发需外部唤起不可程序验证。

### D2: 测试位置——plugins.ts 动态 import
**选择**：测试写 `examples/api/src/lib/tests/plugins.ts`，用动态 `import('@tauri-apps/plugin-deep-link')` 防加载失败影响其他测试。

**理由**：`frontend-api-testing` skill 规定 plugin 测试用动态 import（`SKILL.md:81-91`）。参考 `notification`/`global-shortcut` 的模式。

### D3: api demo 接入 deep-link（4 步）
**选择**：
1. `examples/api/src-tauri/Cargo.toml` 加 `tauri-plugin-deep-link` 依赖
2. `examples/api/package.json` 加 `@tauri-apps/plugin-deep-link` 依赖
3. `examples/api/src-tauri/src/lib.rs` 注册 `.plugin(tauri_plugin_deep_link::init())`
4. `examples/api/src-tauri/capabilities/run-app.json` 加 `deep-link:default` 权限

**理由**：`frontend-api-testing` skill 的 4 步接入流程（`test-template.md:139-172`）。Phase 3 在 Phase 1/2 完成后，deep-link 已能 OHOS 编译，**无需 `cfg(not(ohos))` 排除**。

### D4: examples/app OHOS 化
**选择**：
- `tauri.conf.json` 加 OHOS deep-link 配置段（mobile domains，对标现有 mobile/desktop 段）
- `Cargo.toml` 的 desktop feature（`x11`/`common-controls-v6`）加 `not(target_env="ohos")` 隔离
- `lib.rs` 的 `register_all`（`:37-38`）加 `not(target_env="ohos")` 排除（OHOS 不支持运行时注册）

**理由**：`examples/app` 当前仅 desktop 配置（`tauri.conf.json:30-46`）。OHOS 化让 example app 可在 OHOS 设备演示 deep-link。

### D5: README OHOS 章节
**选择**：`README.md` 平台表（`:5-11`）加 OHOS 行；Configuration 段（`:103-121`）补 OHOS 配置说明（`mobile` domains → module.json5 skills）。

**理由**：对标其他已适配插件的 README。让用户了解 OHOS 配置方式。

### D6: Rust UT（可选）
**选择**：若 Phase 1/2 产出可测纯函数（如 Phase 2 的 `ohos_skill` 字段映射逻辑），按 `ohos-rust-ut` skill 提取为纯函数，设备端 `cargo test --target aarch64-unknown-linux-ohos --no-run` → `hdc file send` → `hdc shell ... --test-threads=1`。

**理由**：`ohos-rust-ut` skill 约束：OHOS 不能用 mock runtime，只能测纯函数。`ohos_skill` 映射逻辑是纯函数，可测。但依赖 Phase 2 实现是否提取为可测函数，故标可选。

## Risks / Trade-offs

- **[测试依赖 Phase 1/2]** → D3 明确 Phase 3 在 Phase 1/2 完成后进行；若 Phase 1/2 未完成，auto 用例会失败（`getCurrent`/`isRegistered` 走错误路径）。
- **[manual 测试无法自动化]** → D1 manual 用例写为 `wrapManual()` 清单（`SKILL.md:101-134`），console-log 自动捕获，hdc 拉取。
- **[api demo 接入回归]** → D3 4 步配置需确保不破坏现有 api demo 构建；cfg 隔离 desktop feature。
- **[Rust UT 可选]** → D6 依赖 Phase 2 实现，若 `ohos_skill` 未提取为纯函数则跳过。
