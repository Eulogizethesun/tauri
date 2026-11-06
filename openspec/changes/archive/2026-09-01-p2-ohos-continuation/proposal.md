# Proposal: p2-ohos-continuation

## Why

应用接续 Phase 1c（p1-ohos-continuation，2026-08-27 完成双审计通过）已打通目标端恢复信号链：NativeAbility 生命周期回调 → lifecycle 闭包 → `CONTINUATION_RESTORE`/`CONTINUATION_DATA` Rust Mutex → `crates/plugin-continuation/` 纯同步 facade。本 Phase 把该能力以标准 Tauri 插件形态暴露给 JS 侧，并修订 R228 spec（原判定"暂不实现"的前提——continuationManager 独立 API 已废弃且 Tauri 无对应概念——已被 2026-08-27 调研推翻：接续现由 UIAbility 生命周期驱动，三方可用）。

## What Changes

1. **plugins-workspace 新插件 `tauri-plugin-continuation`**（参照 screenshot/accessibility 先例，~12 文件）：
   - 命令 `is_continuation_restore`（返回 bool，peek 幂等）/ `get_continuation_data`（返回 `Option<String>`，draining take；空串 → null）
   - OHOS 分支经 `openharmony-ability-plugin-continuation` facade（零 bridge、纯同步）；非 OHOS 返回 `Unsupported`
   - guest-js：`isContinuationRestoreLaunch(): Promise<boolean>` / `getContinuationData(): Promise<string | null>`
2. **examples/api 集成**（4 文件）：Cargo.toml OHOS target 依赖、lib.rs 插件注册、capabilities、package.json + demo 页/测试
3. **单设备验证**：auto 用例断言普通启动下 `isContinuationRestoreLaunch() === false` 且 `getContinuationData() === null`、take 一次性消费语义（二次调用 null）；真接续触发（launchReason=CONTINUATION）单设备不可注入，留 Phase 3c 双设备
4. **R228 spec 修订**：从"暂不实现"改为分阶段边界声明（被动恢复查询/数据回传已可用；源端保存见 Phase 3c；主动迁移系统 UI 独占不可用）+ 汇总表行更新

不做（Phase 3c）：源端 `onContinue` 保存（预注册快照）、module.json5 `continuable` 模板门控、双设备端到端验证。

## Impact

- 新增：plugins-workspace/plugins/continuation/（crate + guest-js + permissions）
- 修改：examples/api 集成 4 文件 + 测试注册；ohos-platform-limitations R228 修订
- 依赖：p1-ohos-continuation 已完成（facade 就绪）；本 Phase 无 ArkTS/HAR 改动（纯 Rust + JS 层）
- 风险：低——完全复刻已两次验证的插件先例；无 bridge 往返故无死锁面；draining take 语义需在 JS 文档中显式说明（消费型 API）
