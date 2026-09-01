## Why

`tauri-plugin-deep-link` 完全未适配 OHOS，且现有条件编译在 OHOS 上**无法编译**：`init_deep_link`（`src/lib.rs:19-85`）仅有 android/ios/desktop 三分支，OHOS（`target_os="linux"` + `cfg(desktop)=false`）无匹配分支导致函数无返回值；`register`/`unregister`/`is_registered` 的 `#[cfg(target_os="linux")]` 误命中 OHOS，错误调用 `xdg-mime`；`Cargo.toml:45` 误将 `rust-ini` 引入 OHOS。

与此同时，OHOS 运行时**已端到端产生 `RunEvent::Opened`**（`NativeAbility.onNewWant` → `Event::NewWant{uri}` → tao `Event::Opened{urls}` → `tauri-runtime-wry` → `RunEvent::Opened`），且 `single-instance` 插件已验证此路径，但 deep-link 的 `on_event` 闭包被 `#[cfg(any(macos, ios))]` 排除，丢弃了 OHOS 产生的事件。本 Phase 打通编译、接入这条现成事件链路（运行中收链接），并通过 `openharmony-ability` 新增 `onCreate` want.uri getter 实现首启动 `get_current`，覆盖 deep-link 的核心唤起能力。

## What Changes

- **编译打通**：`Cargo.toml` 声明 `openharmony` 平台支持；Linux 依赖加 `not(target_env="ohos")` 排除（避免 `rust-ini` 误入 OHOS）；新增 `[target.'cfg(target_env="ohos")'.dependencies] tauri={features=["wry"]}`。
- **`init_deep_link` 新增 OHOS 分支**：返回 `DeepLink{app, current, config}`（与 iOS 分支一致），**无需 `register_ohos_plugin`**（deep-link 是事件驱动型，非命令型插件）。
- **`on_event` 接入事件链路（运行中事件）**：将 `#[cfg(any(target_os="macos", target_os="ios"))]` 扩展为含 `target_env="ohos"`，消费 `RunEvent::Opened{urls}`，emit `deep-link://new-url` 并更新 `current`。**关键：过滤 `urls.is_empty()`**——OHOS 的 `onNewWant` 每次再启动都触发，空 URI 也 emit 空 `Vec`（`tao mod.rs:596`），不过滤会误触发事件。
- **首启动 `get_current`（冷启动）**：`openharmony-ability` 新增 `take_initial_want_uri()` getter（复刻 `take_want_parameters`，pull 模型，无新 Event），在 `NativeAbility.onCreate` 提取 `want.uri` 存储；deep-link 的 `get_current` 在 OHOS 调该 getter 读取首启动链接。
- **修复 Linux 误命中**：`register`/`unregister`/`is_registered` 的 `#[cfg(target_os="linux")]` → `#[cfg(all(target_os="linux", not(target_env="ohos")))]`。
- **`register`/`unregister`/`is_registered` OHOS 语义**：新增独立 `#[cfg(target_env="ohos")]` 分支——`register`/`unregister` 返回 `Ok(())`（no-op，scheme 注册由 Phase 2 module.json5 skills 处理）；`is_registered` 返回 `Ok(false)`（OHOS 无运行时注册状态）。
- **不影响其他平台**：所有改动通过 `cfg(target_env="ohos")` 隔离，Windows/macOS/Linux/iOS/Android 现有代码路径不变。

## Capabilities

### New Capabilities
- `ohos-deep-link-event`: OHOS 平台 deep-link 插件的编译打通、运行中事件接入（`RunEvent::Opened`）、首启动 `get_current`（`take_initial_want_uri` getter）、`register`/`unregister` no-op、`is_registered` 返回 `Ok(false)`。

### Modified Capabilities
<!-- 无现有 deep-link 相关 spec（openspec/specs/ 中无 deep-link capability），本 Phase 为新增。 -->

## Impact

- **代码-deep-link 插件**：`plugins-workspace/plugins/deep-link/` 的 `Cargo.toml`、`src/lib.rs`、`src/commands.rs`（3 文件；`build.rs` 经审计无需结构性改动——`try_build()` 在 `ohos_path=None` 时 OHOS 安全跳过，见 design D7）
- **代码-openharmony-ability**：`crates/ability/src/app.rs`（INITIAL_WANT_URI+store+take）、`crates/ability/src/lifecycle.rs`（onAbilityCreateWithWant 闭包）、`native_ability/src/main/ets/ability/type.ets`（字段）、`native_ability/src/main/ets/ability/NativeAbility.ets`（onCreate 调用）— 4 文件
- **依赖**：OHOS target 新增 `tauri` wry feature；移除 OHOS 误引的 `rust-ini`
- **无核心仓改动**：复用 tao（`platform_impl/ohos/mod.rs:595`）、tauri-runtime-wry（`lib.rs:4737`）、tauri 核心（`app.rs:2675`）已就绪的 `RunEvent::Opened` 链路
- **平台隔离**：严格遵守 `cfg(target_env="ohos")` 隔离，Linux 依赖加 `not(target_env="ohos")` 排除（铁律 2）
- **后续 Phase**：scheme 注册声明（Phase 2）、测试文档（Phase 3）不在本 Phase 范围
