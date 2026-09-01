## 1. tauri-plugin 新增 update_ohos_module_json 注入 API

- [x] 1.1 `tauri/crates/tauri-plugin/Cargo.toml` 加 `json5 = { version = "0.4", optional = true }`（在 `[dependencies]`，并在 `build` feature 加 `"dep:json5"`）— **实现调整**：json5 作为 optional dep 在 build feature 启用（非 [build-dependencies]），因 `update_ohos_module_json` 在 build 模块
- [x] 1.2 `tauri/crates/tauri-plugin/src/build/mobile.rs` 新增 `pub fn update_ohos_module_json(skills: serde_json::Value) -> Result<()>`：读 `TAURI_OHOS_PROJECT_PATH` 自门控；定位 `entry_{OHOS_DEVICE_TYPE}/src/main/module.json5`；`json5::from_str` parse → `module.abilities[0].skills` 移除含 `ohos.want.action.viewData` 的旧 skill（幂等）→ 追加新 skill → `serde_json::to_string_pretty` serialize 写回 — **实现调整**：用 serde_json serialize（标准 JSON 是合法 JSON5），简化未用 plugins.rs 的 serialize_json5

## 2. deep-link build.rs OHOS 分支

- [x] 2.1 `plugins-workspace/plugins/deep-link/build.rs` 新增 `fn ohos_skill(domain: &AssociatedDomain) -> serde_json::Value`：映射 `scheme`→`uris[].scheme`（多 scheme 多 uris 对象）、`host`→`uris[].host`、`path`→`uris[].path`、`path_pattern`→`uris[].pathRegex`、`path_prefix`→`uris[].pathStartWith`、`path_suffix`丢弃+`cargo:warning`、`app_link`→`domainVerify`；固定 `entities:["entity.system.browsable"]`、`actions:["ohos.want.action.viewData"]`
- [x] 2.2 `build.rs` 在 iOS 分支后新增 OHOS 分支：检查 `TAURI_OHOS_PROJECT_PATH` 存在，读 `config.mobile`，`config.mobile.iter().map(ohos_skill).collect()` 生成 skills 数组，调 `tauri_plugin::mobile::update_ohos_module_json` — **补充**：`plugins-workspace/Cargo.toml` 的 `[patch.crates-io]` tauri-plugin 从 git ohdev 改为 `path = "../tauri/crates/tauri-plugin"` + `cargo update -p tauri-plugin`，让 deep-link 用本地 tauri-plugin（含 update_ohos_module_json）

## 3. 验证

- [ ] 3.1 OHOS 构建后检查 `entry_mobile/src/main/module.json5`：`abilities[0].skills` 含 deep-link skill — **待 OHOS 构建环境**
- [ ] 3.2 重复构建两次后检查 skills 数组不累积 — **待 OHOS 构建环境**
- [ ] 3.3 检查 home 入口 skill 保留不变 — **待 OHOS 构建环境**
- [x] 3.4 非 OHOS 构建（desktop）确认 `update_ohos_module_json` no-op：desktop `cargo check -p tauri-plugin-deep-link` 通过（44.52s），函数内 `TAURI_OHOS_PROJECT_PATH` 未设时 `return Ok(())`
- [ ] 3.5 设备端验证：`hdc shell aa start -a ohos.want.action.viewData -d myapp://path` 唤起 app — **待设备**
- [ ] 3.6 desktop form 构建后检查 `entry_desktop/src/main/module.json5` — **待 OHOS 构建环境**
