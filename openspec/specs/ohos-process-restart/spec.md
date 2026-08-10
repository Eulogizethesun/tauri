# ohos-process-restart Specification

## Purpose
定义 Tauri 在 OHOS 平台"重启应用"（`process::restart` / `tauri-plugin-process` 的 `restart` 命令）的契约。OHOS 不允许第三方应用通过 `Command::new(exe).spawn()` 自行重启进程， SHALL 通过 `openharmony-ability` 桥接调用系统 `@ohos.app.ability.appRecovery.restartApp()` 实现原生重启。本规范补齐 R192（重启应用）的 OHOS 契约。

## 现状审计
- tauri core：`crates/tauri/src/app.rs` 中 `do_restart(env)` 在 OHOS target 走 `#[cfg(target_env = "ohos")]` 分支，调用 `crate::ohos::APP.lock()` 后 `app_ref.restart()`，随后 `std::process::exit(0)`。非 OHOS 走 `crate::process::restart(env)`（`Command::spawn`）。
- tauri-plugin-process：`plugins-workspace/plugins/process/src/lib.rs` 在 OHOS target 注册 `ohos::restart` 命令（替代 `commands::restart`）；`src/ohos.rs` 调用 `app_ref.restart()`，成功后无限阻塞让 `restartApp` 杀死进程。
- `openharmony-ability` 提供 `App::restart()` 通过 TSFN 调用 ArkTS `appRecovery.restartApp()`。
- `tauri::process::current_binary` 在 OHOS 跳过 AppImage 检测（R193 已隔离）。

## ADDED Requirements

### Requirement: OHOS 重启 SHALL 调用 appRecovery.restartApp
OHOS 平台调用 `tauri::process::restart` 或 `tauri-plugin-process` 的 `restart` 命令时，SHALL 通过 `openharmony-ability` 的 `App::restart()` 调用系统 `@ohos.app.ability.appRecovery.restartApp()`，SHALL NOT 使用 `std::process::Command::spawn` 启动新进程。

#### Scenario: core restart 路径
- **WHEN** 用户代码在 OHOS 调用 `app.restart()`（最终走 `do_restart(env)`）
- **THEN** 进入 `#[cfg(target_env = "ohos")]` 分支
- **AND** 获取 `crate::ohos::APP` 锁，调用 `app_ref.restart()`
- **AND** `restart()` 通过 TSFN 向主线程派发 `appRecovery.restartApp()`
- **AND** 随后调用 `std::process::exit(0)`
- **AND** 不调用 `Command::new(current_binary).spawn()`

#### Scenario: plugin restart 命令路径
- **WHEN** 前端调用 `process.restart()` 在 OHOS 平台
- **THEN** 调用 `ohos::restart` 命令（`#[cfg(target_env = "ohos")]`）
- **AND** 调用 `app_ref.restart()`
- **AND** 若返回 `Ok(0)`，进入无限 `sleep` 循环阻塞当前线程，等待 `restartApp` 杀死进程
- **AND** 若返回 `Ok(non-zero)` 或 `Err`，记录 `log::error!` 后 `std::process::exit(0)`

### Requirement: OHOS 重启 SHALL NOT 触发 onDestroy
`appRecovery.restartApp()` 直接重启进程，SHALL NOT 保证 `onDestroy` 回调被触发。文档 SHALL 明确告知用户：重启前需自行保存状态（通过 `appRecovery.saveState()` 或自定义持久化）。

#### Scenario: 重启前保存状态
- **WHEN** 应用需要在重启后恢复状态
- **THEN** 用户代码 SHALL 在调用 `restart` 前手动持久化状态
- **AND** 不依赖 `RunEvent::ExitRequested` / `onDestroy` 在重启路径上被触发

### Requirement: OHOS 重启 SHALL 通过 openharmony-ability 桥接
所有 OHOS 原生重启系统调用 SHALL 经 `openharmony-ability` TSFN 桥接，SHALL NOT 在 tauri / plugin-process 中直接 NAPI 调用。

#### Scenario: 桥接链路
- **WHEN** `restart` 被调用
- **THEN** 调用链为：plugin-process / tauri core → `crate::ohos::APP` → `openharmony-ability::App::restart()` → TSFN → ArkTS `appRecovery.restartApp()`
- **AND** 不绕过 `openharmony-ability`（铁律 #1）

### Requirement: cfg 隔离 SHALL 不影响其他平台
OHOS 重启实现 SHALL 通过 `cfg(target_env = "ohos")` 隔离；Windows/macOS/Linux SHALL 保留 `Command::spawn` 路径不变。

#### Scenario: 非 OHOS 平台不变
- **WHEN** 在 Windows/macOS/Linux 调用 `tauri::process::restart(env)`
- **THEN** 走 `#[cfg(not(target_env = "ohos"))]` 分支
- **AND** 调用 `Command::new(current_binary).args(...).spawn()`
- **AND** OHOS 代码不参与编译

### Requirement: AppImage 检测在 OHOS SHALL 被排除
`tauri::process::current_binary` 中的 AppImage 检测分支 SHALL 通过 `cfg(all(target_os = "linux", not(target_env = "ohos")))` 隔离；OHOS SHALL 不执行 AppImage 路径（R193 降级）。

#### Scenario: OHOS 不检测 AppImage
- **WHEN** 在 OHOS target 调用 `current_binary(env)`
- **THEN** 跳过 `_env.appimage` 检查
- **AND** 直接返回 `tauri_utils::platform::current_exe()` 结果
- **AND** `Env::appimage` 字段在 OHOS 始终为 `None`

## 设计要点
- 已实现：core `app.rs::do_restart` 与 plugin-process `ohos::restart` 均已落地，本规范为契约补档。
- 关键未知项（已离线确认，2026-07-20）：经 SDK `.d.ts` 核实，`appRecovery.restartApp()` 声明为 `@syscap SystemCapability.Ability.AbilityRuntime.Core`、`@StageModelOnly`、since 9/11——**Core 能力，设备覆盖广**（非 phone-only），mobile/desktop 均支持。wearable 等特殊形态若返回 801（能力不支持），当前实现已 `log::error!` + `exit(0)` 降级，符合契约。残留不确定仅限个别非 Core 能力设备，无需阻塞实现。
- 权限：`appRecovery` 需在 `module.json5` 声明 `"abilities"` 中配置 `recoverable` 等属性；该配置由 tauri-cli 模板处理，不在本规范范围。
- 权限：`appRecovery` 需在 `module.json5` 声明 `"abilities"` 中配置 `recoverable` 等属性；该配置由 tauri-cli 模板处理，不在本规范范围。
