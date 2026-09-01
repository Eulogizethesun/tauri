## 1. Cargo.toml 平台支持与依赖隔离

- [x] 1.1 在 `[package.metadata.platforms.support]` 加 `openharmony = { level = "partial", notes = "运行中事件+首启动get_current+register no-op；scheme注册(Phase 2)待补" }`
- [x] 1.2 将 `[target."cfg(target_os = \"linux\")".dependencies]`（`rust-ini`）改为 `[target."cfg(all(target_os = \"linux\", not(target_env = \"ohos\")))".dependencies]`，排除 OHOS 误引
- [x] 1.3 新增 `[target.'cfg(target_env = "ohos")'.dependencies] openharmony-ability = { path = "../../../openharmony-ability/crates/ability" }`（**实现调整**：移除原设计的 `tauri wry`——deep-link 不调 `register_ohos_plugin` 不需要 wry，且 wry→tao→gtk 在 OHOS target 引入 gdk-sys/pango-sys 编译失败；`[dependencies] tauri={workspace=true}` 已足够）

## 2. openharmony-ability 新增 take_initial_want_uri getter

- [x] 2.1 `crates/ability/src/app.rs`：紧邻 `WANT_PARAMETERS`（`app.rs:789-820`）新增 `static INITIAL_WANT_URI: Mutex<String>` + `pub(crate) fn store_initial_want_uri(&str)` + `pub fn take_initial_want_uri() -> String`（复刻 `take_want_parameters` 模式，take 语义读后清空）
- [x] 2.2 `crates/ability/src/lifecycle.rs`：`WindowStageEventCallback`（:21-33）新增 `on_ability_create_with_want` 字段；`create_lifecycle_handle` 创建闭包从 ctx 取 `uri` → `crate::app::store_initial_want_uri(&uri)`（**不投递 Event**，pull 模型）
- [x] 2.3 `native_ability/src/main/ets/ability/type.ets`：`WindowStageEventCallback`（:28-39）新增 `onAbilityCreateWithWant: (data: { uri: string }) => void`
- [x] 2.4 `native_ability/src/main/ets/ability/NativeAbility.ets`：`onCreate`（:80）中 `onAbilityCreate`（:127）后新增 `lifecycle.windowStageEventCallback.onAbilityCreateWithWant?.({ uri: want.uri ?? '' })`

## 3. src/lib.rs 编译打通（init_deep_link + cfg 独立分支）

- [x] 3.1 `init_deep_link` 新增 `#[cfg(target_env = "ohos")]` 分支：返回 `DeepLink { app, current, config }`（与 iOS 一致，不调 `register_ohos_plugin`）；返回前调 `openharmony_ability::take_initial_want_uri()`，非空则解析为 `Url` 存入 `current`（D6 首启动注入）
- [x] 3.2 `register`：新增 `#[cfg(target_env = "ohos")]` 独立分支返回 `Ok(())`（no-op）；Linux 分支 `#[cfg(target_os = "linux")]` → `#[cfg(all(target_os = "linux", not(target_env = "ohos")))]`（replaceAll 统一）；fallback 不变
- [x] 3.3 `unregister`：新增 `#[cfg(target_env = "ohos")]` 独立分支返回 `Ok(())`（no-op）；Linux 分支加 `not(target_env = "ohos")`
- [x] 3.4 `is_registered`：新增 `#[cfg(target_env = "ohos")]` 独立分支返回 `Ok(false)`；Linux 分支加 `not(target_env = "ohos")`

## 4. src/lib.rs 事件接入（on_event 消费 RunEvent::Opened）

- [x] 4.1 `on_event` 闭包内 `#[cfg(any(target_os = "macos", target_os = "ios"))]` 扩展为 `#[cfg(any(target_os = "macos", target_os = "ios", target_env = "ohos"))]`
- [x] 4.2 在 `RunEvent::Opened { urls }` 处理块内加 `if !urls.is_empty()` 过滤，仅非空时 emit `"deep-link://new-url"` 并更新 `current`（OHOS 空 URI 再启动不误触发）

## 5. src/commands.rs 确认

- [x] 5.1 确认 `commands.rs` 的 `get_current`/`register`/`unregister`/`is_registered` 命令调用 `deep_link` 对应方法，OHOS 行为由 `lib.rs` 的 imp 实现承载，`commands.rs` 无需平台分支

## 6. build.rs 审计确认（无需改动）

- [x] 6.1 确认 `tauri_plugin::Builder::try_build()`（`build.rs:76-79`，无 `ohos_path`）在 OHOS target 下安全跳过不报错（依据 `tauri-plugin/src/build/mobile.rs:118-138` 的 `if let Some(path) = ohos_path`），Phase 1 不引入 ArkTS 插件、不新增 `ohos_path`
- [x] 6.2 确认 `update_android_manifest`（`build.rs:97`）与 entitlements（`build.rs:109`）仅在 `TAURI_DEEP_LINK_PLUGIN_CONFIG` 设置时执行，OHOS 构建不设置该变量时自动跳过，不干扰构建

## 7. 验证

- [ ] 7.1 OHOS target `cargo check` 通过（`tauri-plugin-deep-link` + `openharmony-ability` crate）— **待 OHOS 构建环境**：当前环境缺 pkg-config/sysroot 交叉编译配置，single-instance（已适配）同样失败，证明是环境问题非代码问题；需在 tauri ohos build 完整环境验证
- [x] 7.2 Desktop（windows）target `cargo check` 不回归（39.46s 通过）
- [ ] 7.3 设备端验证：app 运行中，`hdc shell aa start` 携带 `myapp://path` 唤起，前端 `on_open_url` 收到 `deep-link://new-url` 事件且 `get_current` 返回该 URL — **待设备**
- [ ] 7.4 设备端验证：无 URI 的再启动（`onNewWant` 空 uri）不触发 `deep-link://new-url` 事件 — **待设备**
- [ ] 7.5 设备端验证：app 冷启动由 `myapp://path` 拉起，插件初始化后 `get_current` 返回 `Ok(Some(["myapp://path"]))` — **待设备**
- [ ] 7.6 设备端验证：`register`/`unregister` 返回 `Ok(())`，`is_registered` 返回 `Ok(false)` — **待设备**
