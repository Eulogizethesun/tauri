# Proposal: p1-ohos-continuation

## Why

应用接续是兼容矩阵"❌ 不支持"五功能中唯一未实现的（R228 判定"暂不实现"）。2026-08-27 调研（子代理+华为官方文档核实）推翻了原判定前提：continuationManager 独立 API 虽废弃，但接续已改为 UIAbility 生命周期驱动（源端 `onContinue(wantParam)` / 目标端 `launchReason === CONTINUATION`），三方应用可用、无需系统签名，恢复链路的集成深度等同已有 deep-link 先例。本 Phase 打通最底层的信号链：NativeAbility 生命周期回调读取 launchReason 与接续 payload 并转发进 Rust，供后续 Phase 的插件消费。

**明确的平台边界**：主动发起迁移由系统 UI 独占（用户点任务管理器接续图标），三方应用不可做——本计划整体只覆盖"被动接续"。

## What Changes

1. **NativeAbility 生命周期扩展**（openharmony-ability/native_ability）：
   - `onCreate(want, launchParam)`：读取 `launchParam.launchReason`，连同 `want.parameters` 的接续 payload 一起传入 `onAbilityCreateWithWant` 转发链（当前只传 uri——deep-link 链路的既有缺口）
   - `onNewWant(want, launchParam)`：同上补 `launchReason`（parameters 已有 JSON 转发，保留兼容）
2. **Rust lifecycle 链**（openharmony-ability/crates/ability）：
   - `lifecycle.rs`：`on_ability_create_with_want` / `on_new_want` 闭包 payload 扩展 launchReason + 接续 payload 字段
   - `app.rs`：新增 `INITIAL_LAUNCH_REASON` / `INITIAL_CONTINUATION_DATA` 两个 Mutex（同 `INITIAL_WANT_URI`/`WANT_PARAMETERS` 的 store_* + take_* draining 模式，app.rs:1115-1151 先例）
3. **Rust facade**：`crates/plugin-continuation/`（`ContinuationClient`：`is_restore_launch()` 双路径——冷启动走同步 Mutex take、热查询走已存的 WANT_PARAMETERS；`take_continuation_data()` 取恢复 payload）
4. **设备侧单元测试**：launchReason/payload 的 store/take draining 语义（run-ut.sh 真机 UT）

不做（后续 Phase）：plugins-workspace 插件（2c）、onContinue 源端保存（3c）、module.json5 continuable 模板门控（3c）、双设备验证（3c）。

## Impact

- 修改：NativeAbility.ets（lifecycle 回调 2 处）、lifecycle.rs、app.rs（新增 2 个 Mutex + take/store）
- 新增：crates/plugin-continuation/{Cargo.toml, src/lib.rs}、设备侧 UT
- 风险：NativeAbility 是模板核心类，回调扩展须不破坏现有 onCreate/onNewWant/onSaveState 时序（历史上 pluginize 重构曾系统性丢回调注入点——MEMORY ohos-bridge-refactor-missing-injection-points）；onAbilityCreateWithWant payload 是既有 wire 结构，扩展字段须向后兼容（Value 往返不丢 key 已验证）
- 不影响其他平台：全部改动在 openharmony-ability（OHOS-only 仓库）
