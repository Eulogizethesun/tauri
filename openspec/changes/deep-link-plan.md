# Deep-Link 适配计划

**创建时间**：2026-07-03
**功能描述**：tauri-plugin-deep-link OHOS 适配 — 接收外部 URI scheme 唤起、`get_current`、`register`/`unregister`/`is_registered`，完整对标 iOS 行为
**判断依据**：涉及 4 个代码层（deep-link 插件 / openharmony-ability / tauri-plugin+cli / tao+tauri 核心），预估 10-13 个文件

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | 编译打通 + 运行中事件 + 首启动 get_current + register no-op | p1-deep-link | ✓ 设计完成 | deep-link 插件 + openharmony-ability | 7-8 | cargo check(ohos) + 设备端 onNewWant/冷启动验证 |
| 2 | scheme 注册声明（构建时注入） | p2-deep-link | ✓ 设计完成 | deep-link + tauri-plugin/cli | 3-4 | 构建产物 `module.json5` 含 `uris/skills` + 外部链接唤起 app |
| 3 | 测试与文档 | p3-deep-link | ✓ 设计完成 | examples + 前端测试 | 2-3 | auto/side-effect/manual 用例通过 |

> 原拆分为 4-Phase。后因首启动 `get_current` 提前到 Phase 1，原 Phase 3（首启动+命令语义）内容并入 Phase 1，改为 3-Phase。

## Phase 详细说明

### Phase 1: 编译打通 + 运行中事件 + 首启动 get_current + register no-op
- **目标**：deep-link 在 OHOS `cargo check` 通过；接入现成 `RunEvent::Opened` 链路实现"运行中收到链接"emit `deep-link://new-url`；通过 `openharmony-ability` 新增 `take_initial_want_uri` getter 实现首启动 `get_current`；`register`/`unregister` no-op、`is_registered` 返回 `Ok(false)`
- **关键发现**：`onNewWant → RunEvent::Opened` 链路已就绪（tao mod.rs:595、tauri-runtime-wry lib.rs:4737、app.rs:2675）；冷启动 `onCreate` 未提取 `want.uri`（NativeAbility.ets:80），需 openharmony-ability 补 getter（复刻 `take_want_parameters` 模式，pull 模型，无新 Event）
- **文件列表**：
  - deep-link 插件：`Cargo.toml`、`src/lib.rs`、`src/commands.rs`（3 文件；`build.rs` 经审计无需结构性改动，见 p1 design D7）
  - openharmony-ability：`crates/ability/src/app.rs`（INITIAL_WANT_URI+store+take）、`crates/ability/src/lifecycle.rs`（onAbilityCreateWithWant 闭包）、`native_ability/src/main/ets/ability/type.ets`（字段）、`native_ability/src/main/ets/ability/NativeAbility.ets`（onCreate 调用）— 4 文件
- **依赖**：无（复用 tao/tauri 已就绪的 `RunEvent::Opened` 链路 + openharmony-ability 新增 getter）

### Phase 2: scheme 注册声明（构建时注入）
- **目标**：实现 `module.json5` 的 `skills/uris` 声明，让系统能识别并路由 deep link 到 app；提供构建时自动注入机制
- **关键缺口**：当前工程 `module.json5` 仅 home 入口 skills，无 `uris/scheme`；`tauri-plugin` 无 OHOS module.json5 注入 API（仅有 `update_android_manifest`/`update_entitlements`）
- **文件列表**：
  - `plugins-workspace/plugins/deep-link/build.rs` — 新增 `#[cfg(target_env="ohos")]` 分支，读 `config.mobile` 生成 skills（`entity.system.browsable` + `ohos.want.action.viewData` + `uris:[{scheme,host}]`）
  - `tauri-plugin/src/mobile.rs` — 新增 `update_ohos_module_json` 注入 API
  - `tauri-cli` 模板 `module.json5` — 增加 skills 模板钩子（若需要）
- **依赖**：Phase 1 完成

### Phase 3: 测试与文档
- **目标**：前端 API 测试（auto/side-effect/manual）+ examples + README 文档
- **文件列表**：
  - `plugins-workspace/plugins/deep-link/examples`（OHOS 用例）
  - 前端测试用例（core.ts/plugins.ts，auto/side-effect/manual 分类）
  - README 更新
- **依赖**：Phase 2 完成

## 状态说明
- `○ 待开始` — 未开始设计
- `● 进行中` — 正在设计或实现
- `✓ 设计完成` — 设计文档已生成并通过审计
- `✓ 已归档` — 已完成实现、测试并归档
