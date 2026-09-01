# Tasks: p2-ohos-continuation

## 1. 插件 crate 骨架

- [x] 1.1 创建 `plugins-workspace/plugins/continuation/`：Cargo.toml（links="tauri-plugin-continuation"、platforms.support 逐平台声明参照 screenshot、`[target.'cfg(target_env = "ohos")'.dependencies] openharmony-ability-plugin-continuation = { path = "../../../openharmony-ability/crates/plugin-continuation" }`）、build.rs（COMMANDS = ["is_continuation_restore", "get_continuation_data"]）、error.rs（仅 Unsupported 变体）、tsconfig.json、rollup.config.js、package.json（@tauri-apps/plugin-continuation）、guest-js/index.ts（isContinuationRestoreLaunch/getContinuationData + 消费型语义 JSDoc）
- [x] 1.2 src/lib.rs：crate 级 `#![cfg(not(any(target_os = "android", target_os = "ios")))]` + Builder 双分支 + OHOS setup 仅 log
- [x] 1.3 src/ohos.rs：两命令经 `ContinuationClient::default()`（零大小无状态，无 APP handle/mutex 处理面）；`get_continuation_data` 空串归一化 Option::None；src/commands.rs：非 OHOS stub 返回 Error::Unsupported

## 2. 权限与构建

- [x] 2.1 permissions/default.toml（allow-is-continuation-restore / allow-get-continuation-data）；cargo build 触发权限生成
- [x] 2.2 guest-js `npm run build` 产 dist-js，校验非 0 字节

## 3. examples/api 接入

- [x] 3.1 src-tauri/Cargo.toml OHOS target 依赖 + src/lib.rs OHOS 块 `.plugin(tauri_plugin_continuation::init())` + capabilities/ohos-plugins.json 加 `"continuation:default"` + package.json `file:` 依赖 + pnpm install
- [x] 3.2 新建 `src/views/Continuation.svelte`（恢复状态/数据查询 + 消费型语义标注），注册进 App.svelte views 数组
- [x] 3.3 新建 `src/lib/tests/ohos-continuation.ts`（auto：false + null + 二次 null），注册进 test-runner

## 4. spec 修订与验证

- [x] 4.1 修订 ohos-platform-limitations R228：分阶段边界声明（被动恢复可用/源端保存后续/主动迁移不可用）+ 汇总表行更新
- [x] 4.2 manual_tests.md §三十四 追加 1 例：hdc aa start 带 parameters 的 want → getContinuationData null + isContinuationRestoreLaunch false（非 CONTINUATION 边界）
- [x] 4.3 cargo check：插件 crate host + aarch64-unknown-linux-ohos 双侧 0 error；examples/api src-tauri OHOS target check 通过
- [x] 4.4 真机验证（run-tests.sh desktop）：ohos-continuation auto 用例绿；测试报告确认新增用例计数
