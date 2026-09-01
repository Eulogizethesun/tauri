# ohos-splash Specification

## Purpose
定义 OHOS 平台"启动画面"（splash screen）的契约边界。OHOS 在系统层提供启动画面能力（通过 `module.json5` 的 `splashIcon` / `backgroundColor` 等配置或 `window` 启动阶段），Tauri 不提供独立 `tauri-plugin-splashscreen` 插件，因此 OHOS 适配 SHALL 采用"系统配置 + 模板生成"方式，不在运行时通过 Rust/ArkTS API 控制启动画面。本规范评估 R226 的可实现性与降级边界。

## 现状审计
- Tauri plugins-workspace 无 `splash` / `splashscreen` 插件；启动画面在桌面端通常由前端窗口控制（首窗口隐藏 → 加载完成显示）。
- OHOS 系统 UI 在 ability 启动到 `onWindowStageCreate` 之间会显示系统级启动画面，由 `module.json5` 配置。
- `tauri-cli` OHOS 模板（`templates/mobile/open-harmony/`）应在 `module.json5` 中预留 splash 配置位。

## ADDED Requirements

### Requirement: OHOS 启动画面 SHALL 通过 module.json5 配置
OHOS 启动画面 SHALL 通过 `module.json5` 中 ability 的 `startWindowIcon` / `startWindowBackground` 字段配置，SHALL NOT 通过运行时 Rust/ArkTS API 动态创建系统启动画面。

#### Scenario: 模板生成 splash 配置
- **WHEN** `tauri-cli` 生成 OHOS 工程模板
- **THEN** `entry/src/main/module.json5` SHALL 包含 `startWindowIcon` 指向应用图标资源
- **AND** `startWindowBackground` 指向应用主题色资源
- **AND** 系统在 ability 冷启动期间显示该启动画面

#### Scenario: 运行时不控制系统 splash
- **WHEN** 应用运行时
- **THEN** Tauri SHALL NOT 提供 Rust API 关闭/显示系统启动画面
- **AND** 系统 splash 由 OHOS 自动在首窗口绘制完成后消失

### Requirement: 应用内 splash 窗口 SHALL 走窗口 cfg 路径
若应用需要应用内（非系统）splash 窗口（如前端 loading 视图），SHALL 通过 Tauri 窗口 API 实现，与本规范解耦；该路径属于 `ohos-window-*` 契约范围，本规范不重复定义。

#### Scenario: 应用内 loading 窗口
- **WHEN** 应用需要加载完成前的 loading UI
- **THEN** 应用 SHALL 创建普通 Tauri 窗口承载 loading 视图
- **AND** 不调用任何"启动画面专用"API

## 平台限制说明
- OHOS 系统 splash 仅在冷启动阶段显示，不支持运行时动态控制（显示/隐藏/动画）。
- 若未来 OHOS 开放运行时 splash 控制 API（如 `window.setSplash`），本规范应升级。
- 当前判定：R226 在 OHOS 上"系统 splash 已由平台提供，无需 Tauri 适配插件"，降级为模板配置。
