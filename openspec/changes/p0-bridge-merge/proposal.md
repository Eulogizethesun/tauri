## Why

当前 openharmony-ability 的 NAPI 桥接使用 `get_named_property("方法名")` 字符串硬编码直调模式，存在以下硬伤：

1. **只能在主线程调用** — `get_main_thread_env()` 在 worker 上返回 `None`，Tauri 命令被迫为每个跨线程能力单独造全局 TSFN 绕路
2. **方法名无契约校验** — ArkTS 改名 Rust 编译不报错，运行时才崩
3. **ArkTS 对象引用（ObjectRef）跨 worker 不安全** — 靠 `unsafe impl Send` 强行声明
4. **无超时、无取消、无 context 就绪保护**
5. **core 认识所有业务** — `crates/ability` 充满具体能力的全局静态，违背框架只管通用传输的原则

上游 `harmony-contrib/openharmony-ability` 已完成 pluginized bridge 重构（PR #67 核心架构 + PR #68 内置插件），将调用模型从字符串直调统一到 `bridgeInvoke(pluginId, action, reqType, respType, value, timeout)` 具名契约传输层。本地 ohdev 分支需要合入这两笔 PR 以获得新架构。

## What Changes

- **BREAKING**: 旧的 `helper/webview.rs`、`webview/mod.rs`、`webview/drag.rs`、`DefaultWebview.ets`、`Utils.ets` 被新架构删除/移动，本地 9 项 Tauri 适配功能的代码需要手工搬迁到新 plugin 位置
- **BREAKING**: `ArkHelper.ets` 功能被 `BridgeHost.ets` + `BridgeNodeSlot.ets` + `NativeModuleLoader.ets` 取代，可能废弃
- **新增**: `crates/ability/src/bridge/mod.rs` — 统一传输层（~1100 行）
- **新增**: 11 个内置插件 crate（plugin-webview/plugin-window/plugin-app-control/plugin-clipboard/plugin-menu/plugin-statusbar/plugin-updater/plugin-version/plugin-permission/plugin-url/plugin-files）
- **新增**: 对应 ArkTS plugin HAR 包
- **修改**: `crates/ability/src/app.rs` — 新增 `bridge()`/`register_plugin()`/`main_thread()` 入口
- **修改**: `crates/derive/src/lib.rs` — `#[ability]` 宏参数变化
- **修改**: `native_ability/.../NativeAbility.ets` — 生命周期重构
- **合入**: harmony-contrib/main (commit `c6c4c9a` PR #67) + harmony-contrib/feat/pr63-pluginized (commit `7030df1` PR #68)

## Capabilities

### New Capabilities

- `bridge-merge-conflict-resolution`: 覆盖 PR #67/#68 合入时的 30+ 个冲突解决策略，包括 modify/delete 文件处置、content 冲突手工合并、ArkHelper.ets 废弃处置

### Modified Capabilities

（无 spec 级别的行为变更。本次是基础设施层重构，不改变任何面向用户的功能行为。合入后需要验证以下现有 capability 仍然正常工作：）

- `ohos-webview-drag-drop`: R72 拖拽功能代码在 `webview/drag.rs`（被删除），需搬迁
- `ohos-webview-https-scheme`: R75 https 拦截代码在 `helper/webview.rs`（被删除），需搬迁
- `ohos-webview-print`: R83 打印代码在 `helper/webview.rs`（被删除），需搬迁
- `ohos-webview-flag-clipboard`: R82 clipboard flag 代码在 `webview/mod.rs`（被删除），需搬迁
- `ohos-webview-flag-zoom-hotkeys`: R91 zoom flag 代码在 `webview/mod.rs`（被删除），需搬迁
- `ohos-window-ops`: window ops 代码在 `app.rs`（content 冲突），需手工合并
- `ohos-event-lifecycle-forward`: lifecycle 代码在 `lifecycle.rs`（被修改），需验证
- `ohos-monitor-real-values`: monitor 代码在 `app.rs`（content 冲突），需手工合并

## Impact

- **openharmony-ability 仓库**: ~30 个文件冲突（11 modify/delete + 19 content），需要全手工解决
- **编译**: merge 后需要 `cargo check --target aarch64-unknown-linux-ohos` 验证编译通过
- **HAR 包**: merge 后 ArkTS 侧变化需要重建 HAR 包
- **消费方（wry/tao/tauri/tray-icon/muda）**: 本次 merge 不改动消费方代码，但 merge 后消费方调用的旧 API 将不存在，后续 Phase 需要改写
- **设备端**: merge 后需要重新部署验证基本功能
