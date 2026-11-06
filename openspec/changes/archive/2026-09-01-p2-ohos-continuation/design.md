# Design: p2-ohos-continuation

## Context

- Phase 1c 已交付（p1-ohos-continuation，2026-08-27）：`openharmony-ability-plugin-continuation` facade 提供 `is_continuation_restore()`（peek）/ `take_continuation_data()`（drain，空串=非接续或已消费），零 bridge 纯同步。
- 插件先例已两次真机验证（screenshot / accessibility）：crate 级 `#![cfg(not(any(target_os = "android", target_os = "ios")))]`、Builder 双分支、`[target.'cfg(target_env = "ohos")'.dependencies]` path 依赖、build.rs COMMANDS、TAURI_PLUGIN_PERMISSIONS_OUT_DIR 权限生成、guest-js rollup 产 dist-js。
- R228 现文（ohos-platform-limitations/spec.md:26-30）判定"暂不实现"，依据 continuationManager 独立 API——该前提已被调研推翻（API 废弃，接续改生命周期驱动）。

## Goals / Non-Goals

- **Goals**: `tauri-plugin-continuation` JS API（isContinuationRestoreLaunch / getContinuationData）；examples/api 集成 + 单设备 auto 验证；R228 分阶段边界声明。
- **Non-Goals**: 源端 onContinue 保存（3c）、continuable 模板门控（3c）、双设备端到端（3c）、主动迁移（平台不可做，永久排除）。

## Decisions

### D1: 两命令、纯同步、无 bridge

- `is_continuation_restore` → `bool`：委托 facade peek，幂等可重复调用。
- `get_continuation_data` → `Option<String>`：委托 facade take；**空串归一化为 None**（JS 侧拿到 null 而非 ""，语义=非接续启动或已被消费）。
- 两命令均为 `async fn`（tauri command 惯例）但体内无 .await、无 bridge 往返、无锁竞争面（Mutex 短临界区）。无 `webview` 参数注入需求（非 webview 作用域 API）。
- OHOS 依赖仅 `openharmony-ability-plugin-continuation`（path 依赖）；client 经 `tauri::ohos::APP` + `ContinuationExt`，或直接 `ContinuationClient::default()`（零大小无状态）——取后者，**无需 APP handle、无 mutex 中毒处理面**，比 screenshot 的 client() helper 更简。

### D2: Error 极简——仅 Unsupported

无运行时错误源（Mutex poison 已在 facade 层降级 false/空串），Error 枚举只需 `Unsupported`（非 OHOS 平台）。不设字符串变体。

### D3: crate 骨架完全复刻 screenshot 先例

Cargo.toml（links="tauri-plugin-continuation"、platforms.support 逐平台 ohos partial 声明）、build.rs（COMMANDS = ["is_continuation_restore", "get_continuation_data"]）、src/lib.rs（crate 级 cfg 排除 android/ios + Builder 双分支 + OHOS setup 仅 log）、src/ohos.rs（两命令）、src/commands.rs（非 OHOS stub）、error.rs、permissions/default.toml（allow-is-continuation-restore / allow-get-continuation-data）、guest-js/index.ts、tsconfig/rollup/package.json。

### D4: 消费型 API 语义显式化

`getContinuationData` 是 draining take（一次消费）——guest-js JSDoc 与 demo 页均显式标注；`isContinuationRestoreLaunch` 是 peek（可重复）。两 API 的差异是本插件唯一易误用点。

### D5: 单设备测试设计（auto 断言 + manual 边界）

- auto：普通启动下 `isContinuationRestoreLaunch() === false`；`getContinuationData() === null`；连续两次调用均 null（无数据时 take 幂等空）。
- manual（manual_tests.md §三十四 追加 1 例）：`hdc shell aa start` 带 parameters 的 want 触发 onNewWant → `getContinuationData() === null` 且 `isContinuationRestoreLaunch() === false`（边界验证：非 CONTINUATION launchReason 的参数走 deep-link 通道，不算接续）。
- 真接续（launchReason=CONTINUATION）单设备不可注入，JS 层链路留 3c 双设备验证（Rust 层已被 1c UT 覆盖）。

### D6: R228 修订为分阶段边界声明

参照 R229（截图）修订模式：被动恢复查询/数据回传已可用（本插件）；源端保存与完整迁移流见后续；主动迁移系统 UI 独占、SHALL NOT 提供。汇总表行同步。

## Risks / Trade-offs

- 消费型 API 被测试用例消费后 demo 页读到 null——demo 页与测试不同时竞争（demo 按钮显式调用并展示结果，语义即"本次会话首次查询"）。
- 非 OHOS 桌面平台 Unsupported：与 screenshot 先例一致，plugins-workspace cargo check 仅验证编译。
- js API 无事件形态（无 onContinuation 事件）——冷启动场景 JS 侧主动查询即可覆盖；事件化非必要（webview 起来时数据仍在 Mutex 里未被消费）。

## Open Questions

- 无（先例充分、依赖已就绪）。
