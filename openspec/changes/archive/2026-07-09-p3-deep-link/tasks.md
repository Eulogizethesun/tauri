## 1. 前端测试用例（plugins.ts）

- [x] 1.1 `tauri/examples/api/src/lib/tests/plugins.ts` 新增 deep-link 测试块（动态 `import`），4 个 auto 用例：`getCurrent`/`isRegistered`(false)/`register+unregister`(不抛错)/`onOpenUrl` 注册返回 UnlistenFn。参考 global-shortcut 模式
- [x] 1.2 新增 3 个 manual 用例：`onOpenUrl` 事件触发/`getCurrent` 冷启动/外部链接唤起 — **实现调整**：用 `category: 'manual'`（与现有 dialog manual 用例一致），未用 `wrapManual()`

## 2. api demo 接入 deep-link（4 步）

- [x] 2.1 `tauri/examples/api/src-tauri/Cargo.toml` 加 `tauri-plugin-deep-link = { path = "../../../../plugins-workspace/plugins/deep-link" }`
- [x] 2.2 `tauri/examples/api/package.json` 加 `"@tauri-apps/plugin-deep-link": "file:..."`
- [x] 2.3 `tauri/examples/api/src-tauri/src/lib.rs` 注册 `.plugin(tauri_plugin_deep_link::init())`（desktop 块 + OHOS 块各一处）
- [x] 2.4 `tauri/examples/api/src-tauri/capabilities/run-app.json` 加 `"deep-link:default"`

## 3. examples/app OHOS 化

- [x] 3.1 `tauri.conf.json` — **无需改**：mobile domains 配置已存在（`fabianlars.de`/`tauri.app`/`taurideeplink`），OHOS 复用 mobile 配置（Phase 2 build.rs 读 `config.mobile` 生成 skills）
- [x] 3.2 `examples/app/src-tauri/Cargo.toml` desktop feature 隔离：`tauri={features=["wry"]}` + `[target.'cfg(not(target_env="ohos"))'.dependencies] tauri={features=["common-controls-v6","x11"]}`
- [x] 3.3 `examples/app/src-tauri/src/lib.rs` `register_all` cfg 加 `not(target_env="ohos")`：`#[cfg(any(all(target_os="linux", not(target_env="ohos")), all(debug_assertions, windows)))]`

## 4. README 补充 OHOS 章节

- [x] 4.1 平台表加 `| OpenHarmony | ✓ |`
- [x] 4.2 Configuration 段加 OpenHarmony 说明（mobile→module.json5 skills 静态声明、register no-op、getCurrent 首启动、onOpenUrl onNewWant）

## 5. Rust UT（可选）

- [ ] 5.1 跳过 — `ohos_skill` 在 build.rs 内，提取为可测纯函数需重构 build.rs 结构，留作后续优化

## 6. 验证

- [ ] 6.1 api demo OHOS 构建：deep-link 注册 + 前端 import 加载 — **待 OHOS 构建环境**
- [ ] 6.2 Run All（auto）：4 个 auto 用例通过 — **待设备**
- [ ] 6.3 manual 用例：`hdc shell aa start` 唤起 — **待设备**
- [ ] 6.4 examples/app OHOS 构建通过 — **待 OHOS 构建环境**
- [x] 6.5 README 平台表 + Configuration 段含 OHOS 说明
