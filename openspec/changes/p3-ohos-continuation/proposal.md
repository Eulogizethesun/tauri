# Proposal: p3-ohos-continuation

## 概述

应用接续 Phase 3c（最终阶段）：补齐**源端保存**链路（NativeAbility `onContinue` 预注册快照方案）与**构建期门控**（tauri-cli `module.json5` `continuable`/`continueType` 可选配置），完成被动应用接续的最后一块拼图。目标端恢复查询（Phase 1c/2c）已交付。

## 背景与动机

- Phase 1c 打通了目标端信号链（`launchReason === CONTINUATION` → `isContinuation` 布尔 → Rust `CONTINUATION_RESTORE`/`CONTINUATION_DATA` 双 Mutex）。
- Phase 2c 交付 `tauri-plugin-continuation`（`isContinuationRestoreLaunch` peek / `getContinuationData` draining take）。
- 尚缺两端：
  1. **源端**：系统发起迁移时回调 UIAbility `onContinue(wantParam)`，当前 NativeAbility 未 override，默认返回拒绝——源设备永远无法接续出去。
  2. **构建期**：`module.json5` 未声明 `continuable: true` + `continueType`，系统根本不会把该应用列为可接续目标。当前模板硬编码不含这两个字段。

华为官方文档（arkts-helper 核实，2026-08-27）：
- `onContinue(wantParam: Record<string, Object>): AbilityConstant.OnContinueResult` 是**同步回调**，不能做异步操作——状态必须在运行期"实时维护"，这正是预注册快照方案的依据。
- `continueType` 是字符串数组，同华为账号 + 同 continueType 匹配目标设备；`continuable: true` 声明可接续。
- 仅 wantParam 键值对传递**无需 DISTRIBUTED_DATASYNC 权限**，三方应用可用。

## 目标

1. **源端快照**：JS 侧提前调用 `setContinuationData(data)` 把待迁移状态镜像进 Rust 侧 `CONTINUATION_SNAPSHOT: Mutex<String>`（peek 不 drain——迁移被取消后可重试）；NativeAbility `onContinue` 同步直读快照写入 wantParam 并返回 `AGREE`，**绝不等待 JS 回填**（规避主线程死锁，tray-icon/muda block_on 教训）。
2. **同步 NAPI 读**：ability crate 新增 `#[napi]` 同步函数 `read_continue_snapshot() -> String`（先例 `update_cursor_position`），ArkTS 侧经 `ProcessInitializer.getNativeModules()[0]` 调用（NativeAbility 现有模式，onContinue 时机 AppStorage 尚未就绪）。
3. **构建期门控**：`tauri.conf.json` `bundle.openHarmony` 新增可选字段 `continuable: boolean` + `continueType: string[]`；tauri-cli 在 build 时（`write_entry_device_types` 同一注入点）写入 module.json5。缺省不写——不影响现有项目。
4. **插件命令**：`tauri-plugin-continuation` 新增 `setContinuationData(data: string)`（源端保存），非 OHOS stub 返回 Unsupported。
5. **examples demo**：Continuation.svelte 增加"保存接续数据"输入区；单设备可验证 set→读取回环 + onContinue 返回 AGREE（hdc 日志）；双设备完整迁移流作为 T1 手动用例记录（需用户第二台设备，不阻塞本 Phase 交付）。

## 非目标

- 主动发起迁移（continuationManager/系统 UI 独占）——永久排除（R228）。
- 异步 onContinue（`DATA_READY` 模式）——快照方案下无必要，保持同步最简。
- 跨版本兼容协商（wantParam.version 比对）——业务层职责，插件透传不掺和。

## 涉及层与预估文件

| 层 | 文件 | 预估 |
|----|------|------|
| openharmony-ability | NativeAbility.ets(onContinue)、app.rs(快照 Mutex+napi)、plugin-continuation(facade)、UT | 4 |
| tauri-cli | tauri-utils config.rs(新字段)、open_harmony/plugins.rs(写入)、build.rs(调用)、模板 module.json5(示例注释) | 4 |
| plugins-workspace | continuation 插件 4 文件(命令/权限/guest-js/dist-js) | 4 |
| tauri examples | Continuation.svelte、ohos-continuation.ts、Cargo/capabilities | 3 |
| 文档 | manual_tests.md、ohos-continuation-plan.md、R228 收尾 | 3 |
| **合计** | | **~18** |

## 依赖

- Phase 2c 已完成（p2-ohos-continuation 已实现）。
- 双设备真机验证需第二台华为设备（同账号 + 已装 app）——验证项不阻塞实现交付。
