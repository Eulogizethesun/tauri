# Proposal — multi-uiability-windows

## Why

OHOS 新架构（解耦 v3 / bridge plugin）当前**只支持单 UIAbility 实例**：`tao` 的
`UIABILITY_CREATED` guard（`tao/src/platform_impl/ohos/mod.rs:975,1332-1334`）硬拒第二个
UIAbility 窗口。多窗口需求目前仅由 Float 子窗口（同 UIAbility 内 `createSubWindow`）承担。

upstream PR #19（`58ad4377`）曾在旧框架实现 `start_ui_ability` multiton（第二 UIAbility 经
`want.parameters` 启动新 EntryAbility 实例），PR #22（`73212e1e`）bridge facade 迁移时被判
"not ported"（mod.rs:1320-1323 注释明载）。本变更是该 deferred gap 的专项设计
（见 `upstream-ohdev-rebase-window-ops/design.md` 偏差 c）：在新架构上恢复多 UIAbility，
使应用获得 **OS 级窗口隔离**——独立任务卡片、独立最小化/转场、独立存活（关一不关全）。

经调研 + 审计双 agent 复核：新架构**无根本性障碍**，ArkTS 侧管道大半预埋
（`WindowManager.uiAbilityStages` 按 windowId 参数化、`MainPage` `@LocalStorageProp('windowId')`、
`DefaultXComponent` 双模式参数化、Rust `next_window_id`/`register_ui_ability_stage` 存活），但存在
**46 个单例假设**（审计 S1-S46，其中 8 个为已知缺口、38 个新发现）需要分诊处理，
外加 2 个非管道难点（异步握手时序、生命周期语义）与 1 个审计新发现的架构约束
（`BridgeHostRegistry` 模块独占——同模块第二实例 `prepare()` 抛异常，有单测背书）。

## What Changes

- **openharmony-ability（Rust）**：恢复 `start_ui_ability`（走 app-control bridge，fire-and-forget）；
  新增 `PENDING_UI_ABILITIES` 握手注册表（事件驱动，禁 recv_timeout）；`HAS_EVENT`/`WAKER` 由进程级
  静态改为 per-app 实例；`BridgePluginRegistryState` 生命周期状态按 window_id 分区（聚合模型）；
  `INITIAL_WANT_URI`/`WANT_PARAMETERS` per-window 化。
- **openharmony-ability（ArkTS）**：`NativeAbility` 从 `want.parameters.tauri_window_id` 读
  `abilityWindowId`（恢复 upstream `readWindowId()` 语义），`registerUIAbilityStage`/`unregisterUIAbilityStage`/
  `notifyWindowStatus`/`setMenuClickHandler` 等硬编码 0 全部参数化；`loadContentByName` 传
  LocalStorage（windowId + bridgeSessionId）；`bridgeSessionId` 从 AppStorage 全局单值改为 per-instance
  LocalStorage；`BridgeHostRegistry.prepare()` 模块独占异常改为 join 语义（第二实例 join 既有 session）；
  `WindowManager.createSubWindow` 的 stage 0 硬编码参数化（Float 子窗口从调用者所属 stage 创建）。
- **tao**：删除 `UIABILITY_CREATED` guard，换 `FIRST_WINDOW_CREATED` 闩锁（仅约束首窗口必须是
  UIAbility）；第二个 UIAbility 窗口走 `start_ui_ability` 预分配 id 路径；**14 处 `WindowId(0)`
  事件派发硬编码参数化**（input/IME/axis/redraw/focus/destroy；WindowResize/ContentRectChange 已是
  per-window 可作参照）。
- **launchType**：module.json5（tauri-cli 模板 + gen 目录）`singleton` → `standard`；3 个自定位
  `startAbility` 调用点（menu.ets:73、StatusBarUtils.ets:40、AppControlPlugin.ets:181）迁移到
  `WindowManager.showWindowMethod()`（restore() 路径）。
- **验证基建**：examples/api 已有 `create_ui_ability_window` 命令（cmd.rs:923）与
  `create_ui_ability_windows_x3`（build.rs:56）可直接复用。

## Capabilities

### New Capabilities
- `ohos-multi-uiability-windows`: OHOS 多 UIAbility 实例窗口——跨 5 层（tao 事件路由 / oha Rust
  握手与生命周期 / ArkTS stage 注册与会话 / launchType 语义 / 插件层单例分诊）的端到端支持，
  含 Float 子窗口路径零回归约束。

### Modified Capabilities
- `ohos-window-state-persistence`: windowId key 体系从「主窗口=0 + Float 子窗口=NEXT_WINDOW_ID」
  扩展为「多 UIAbility 窗口亦取 NEXT_WINDOW_ID 预分配 id」；`get_real_window_id` 须正确区分
  多 UIAbility 窗口与 Float 子窗口（decor_height 语义依赖）。
- `ohos-deep-link`: `initialWantUri`/`wantUri` per-instance 化（LocalStorage），deep-link
  `getCurrent()` 返回各实例自己的启动 URI。

## Impact

- **代码面**：~15-20 文件跨 openharmony-ability（Rust+ArkTS）/ tao / tauri-cli 模板 / examples/api
  gen 目录；工作量评估 **7-11 天**（6 阶段），风险等级 **High**（时序竞态 + 生命周期语义 + 291 例
  已验证路径回归面）。
- **不回归面**：Float 子窗口路径（291 例已验证）零回归为硬约束；291 例套件每阶段全量回归。
- **明确不做**（Non-Goals 见 design.md）：进程级插件（tray/global-shortcut/menu/statusbar/
  accessibility）不 per-ability 化、cursor 全局单值不升级、接续(continuation)多实例语义延期、
  Sub-UIAbility 键盘合成降级维持现状。
