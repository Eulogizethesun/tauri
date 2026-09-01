# ohos-deep-link-testing Specification

## Purpose
deep-link OHOS 前端测试用例（auto/manual 分类）+ api demo 接入 + examples/app OHOS 化 + README 文档规范。确保 deep-link 在 OHOS 上的行为可验证、可维护。

## ADDED Requirements

### Requirement: auto 测试用例可自动断言
`plugins.ts` SHALL 包含以下 auto 测试用例（可自动断言，5 秒超时）：`getCurrent()`（非链接启动返回 `null` 或空数组）、`isRegistered(scheme)`（返回 `false`）、`register(scheme)`+`unregister(scheme)`（no-op 不抛错）、`onOpenUrl` 注册返回 `UnlistenFn`（`typeof === 'function'`）。用例 SHALL 用动态 `import('@tauri-apps/plugin-deep-link')` 加载。

#### Scenario: getCurrent 非链接启动
- **WHEN** app 正常启动（非 deep-link 触发），调用 `getCurrent()`
- **THEN** SHALL 返回 `null` 或空数组，auto 断言 `result === null || Array.isArray(result)`

#### Scenario: isRegistered 返回 false
- **WHEN** 调用 `isRegistered("myapp")`
- **THEN** SHALL 返回 `false`（OHOS no-op 语义），auto 断言 `result === false`

#### Scenario: register/unregister no-op 不抛错
- **WHEN** 调用 `register("myapp")` 后 `unregister("myapp")`
- **THEN** SHALL 不抛错（no-op 返回 null），auto 断言无 throw

#### Scenario: onOpenUrl 注册返回 UnlistenFn
- **WHEN** 调用 `onOpenUrl(() => {})` 注册回调
- **THEN** SHALL 返回 `UnlistenFn`，auto 断言 `typeof unlisten === 'function'`

### Requirement: manual 测试用例人工确认
`plugins.ts` SHALL 包含以下 manual 测试用例（用 `wrapManual()` 包装，需人工确认）：`onOpenUrl` 事件实际触发（需外部链接唤起）、`getCurrent()` 经链接启动（需外部唤起 app）、外部链接唤起 app（跨 app 行为）。

#### Scenario: onOpenUrl 事件触发
- **WHEN** 注册 `onOpenUrl` 回调后，人工用 `hdc shell aa start -d myapp://path` 唤起
- **THEN** 回调 SHALL 被调用，urls 包含 `["myapp://path"]`，人工确认

#### Scenario: getCurrent 经链接启动
- **WHEN** app 未运行，人工用 `myapp://path` 链接拉起，调用 `getCurrent()`
- **THEN** SHALL 返回 `["myapp://path"]`，人工确认

#### Scenario: 外部链接唤起 app
- **WHEN** 人工从浏览器/其他 app 点击 `myapp://path` 链接
- **THEN** app SHALL 被唤起到前台，人工确认

### Requirement: api demo 接入 deep-link
api demo（`examples/api`）SHALL 接入 deep-link 插件：`src-tauri/Cargo.toml` 加 `tauri-plugin-deep-link` 依赖；`package.json` 加 `@tauri-apps/plugin-deep-link` 依赖；`src-tauri/src/lib.rs` 注册 `.plugin(tauri_plugin_deep_link::init())`；`capabilities/run-app.json` 加 `deep-link:default` 权限。Phase 3 在 Phase 1/2 完成后进行，无需 `cfg(not(ohos))` 排除。

#### Scenario: api demo OHOS 构建含 deep-link
- **WHEN** api demo 在 OHOS target 构建
- **THEN** deep-link 插件 SHALL 被注册，前端 `import('@tauri-apps/plugin-deep-link')` SHALL 成功加载

#### Scenario: capabilities 含 deep-link 权限
- **WHEN** 检查 `run-app.json`
- **THEN** SHALL 含 `deep-link:default` 权限

### Requirement: examples/app OHOS 化
`examples/app` SHALL 支持 OHOS：`tauri.conf.json` 加 OHOS deep-link 配置段（mobile domains）；`Cargo.toml` 的 desktop feature（`x11`/`common-controls-v6`）加 `not(target_env="ohos")` 隔离；`lib.rs` 的 `register_all` 加 `not(target_env="ohos")` 排除。

#### Scenario: examples/app OHOS 构建通过
- **WHEN** `examples/app` 在 OHOS target 构建
- **THEN** SHALL 编译成功，desktop feature 不误入 OHOS

#### Scenario: tauri.conf.json 含 OHOS 配置
- **WHEN** 检查 `examples/app/src-tauri/tauri.conf.json`
- **THEN** SHALL 含 deep-link 的 mobile domains 配置（用于 Phase 2 module.json5 skills 注入）

### Requirement: README 补充 OHOS 章节
`README.md` 平台表 SHALL 加 OHOS 行（`openharmony = { level = "partial" }`）；Configuration 段 SHALL 补 OHOS 配置说明（`mobile` domains → module.json5 skills 声明，scheme 注册为构建时静态声明，非运行时动态注册）。

#### Scenario: README 平台表含 OHOS
- **WHEN** 检查 `README.md` 平台表
- **THEN** SHALL 含 OHOS 行，标注支持等级与限制

#### Scenario: README Configuration 段含 OHOS 说明
- **WHEN** 检查 Configuration 段
- **THEN** SHALL 说明 OHOS scheme 注册为构建时 module.json5 skills 声明（非运行时 register）
