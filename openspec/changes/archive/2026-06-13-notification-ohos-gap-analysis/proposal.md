## Why

`tauri-plugin-notification` 是 Tauri 官方通知插件，支持 Windows/macOS/Linux/Android/iOS 五个平台，但完全没有 OHOS 适配代码。当 `OHOS_DEVICE_TYPE=desktop` 时，`cfg(desktop)` 被设置，插件走 `desktop.rs` 路径并依赖 `notify-rust` crate（OHOS 上无法编译），导致 `tauri-plugin-notification::init()` 直接编译失败。

本分析参考已适配的 dialog（插件注册模式）和 clipboard（desktop 内联模式）等插件的 OHOS 适配经验，梳理 notification 插件在 OHOS Desktop 上的适配差距和推荐方案。

## What Changes

这是一份**差距分析文档**，不涉及代码变更。分析内容包括：

### 核心差距（8 项）

1. **build.rs 缺少 `.ohos_path("openharmony")`** — OHOS ArkTS 模块不会被搭建
2. **src/lib.rs cfg 门控不正确**（6 处） — OHOS 被错误路由到 desktop.rs
3. **Cargo.toml 缺少 OHOS 依赖声明** — `notify-rust` 未排除 OHOS
4. **src/mobile.rs 缺少 OHOS 插件注册** — 没有 `register_ohos_plugin` 调用
5. **缺少 `openharmony/` ArkTS HAR 模块** — 没有完整的 HAR 模块（oh-package.json5 + Plugin.ets + index.ets 等）
6. **Cargo.toml 缺少平台支持声明** — `ohos` 未列在 platforms.support
7. **Channel 方法仅限 Android** — OHOS 也需要通知渠道（HarmonyOS 4+ 强制）
8. **js_init_script 模板替换** — 已验证无需修改

### 架构决策

推荐采用**插件注册模式**（与 dialog 一致），而非 desktop 内联模式（clipboard 方式），原因：
- notification 的 `mobile.rs` 已使用 `PluginHandle` 模式，OHOS 只需加 `register_ohos_plugin` 即可复用全部方法
- `desktop.rs` 仅有 3 个方法（builder/request_permission/permission_state），而 `mobile.rs` 有 12+ 个方法（含 cancel/active/pending/channels 等）
- OHOS 通知 API（`notificationManager.publish()`）是 ArkTS API，需要完整的 ArkTS 侧实现

### 参考的已适配插件

| 插件 | 模式 | 参考价值 |
|------|------|---------|
| dialog | 插件注册（mobile 路由） | 完整参考：build.rs + cfg 门控 + register_ohos_plugin + openharmony/ ArkTS |
| clipboard | desktop 内联 | 反面参考：notification 不适合此模式 |
| process | 独立 ohos.rs | 参考：直接调用 `tauri::ohos::APP` |
| updater | OHOS-aware build.rs | 参考：自定义 desktop/mobile alias |
| autostart | 最小改动 | 参考：仅需 cfg 排除 |
| shell/opener | build.rs alias | 参考：OHOS 复用 desktop 路径 |

## Capabilities

### New Capabilities

- `notification-ohos-init`: 插件初始化适配 — build.rs、lib.rs cfg 门控、Cargo.toml 依赖隔离、mobile.rs 插件注册
- `notification-ohos-arkts`: ArkTS 通知实现 — openharmony/ HAR 模块、Plugin.ets（NotificationPlugin 类）、命令到 OHOS API 的映射

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- **插件文件**：build.rs、Cargo.toml、src/lib.rs、src/mobile.rs（共 4 个 Rust 文件修改）
- **新增文件**：openharmony/ HAR 模块（oh-package.json5 + build-profile.json5 + hvigorfile.ts + module.json5 + Plugin.ets + index.ets，共 6 个文件）
- **依赖变化**：新增 `tauri` with `wry` feature（OHOS cfg）；排除 `notify-rust`（OHOS cfg）
- **API 影响**：`create_channel`/`delete_channel`/`list_channels` 从 `target_os = "android"` 扩展为 `any(target_os = "android", target_env = "ohos")`
- **最小打通**：约 5 个文件修改 + 1 个新文件，核心改动量约 20 行 Rust + 30 行 ArkTS
