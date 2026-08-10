# ohos-platform-limitations Specification

## Purpose
集中记录 Tauri 在 OHOS 平台上"需鸿蒙原生 API 但当前无 Tauri 插件对应、且短期内不实现"的功能降级判定。覆盖 R195（多进程）、R227（字体）、R228（应用接续）、R229（截图取色）、R230（无障碍）、R223/R224（全局托盘/菜单事件监听桌面特性）。本规范为降级报告，不定义新 API，仅声明契约边界。

## ADDED Requirements

### Requirement: R195 多进程在 OHOS 降级为不支持
OHOS 第三方应用 SHALL NOT 通过 Tauri API 派生任意子进程；OHOS 应用模型以 UIAbility / ExtensionAbility 为基本运行单元，每个 ability 实例可独立进程，但无通用 `spawn` 子进程能力。Tauri 的多进程 API（若存在）在 OHOS 上 SHALL 返回 `UnsupportedPlatform` 错误或通过 cfg 隔离不暴露。

#### Scenario: 应用请求派生子进程
- **WHEN** 应用在 OHOS 调用任何多进程派生 API
- **THEN** SHALL 返回明确的平台不支持错误
- **AND** 不调用 `std::process::Command::spawn` 创建任意子进程
- **AND** 文档 SHALL 引导用户使用 OHOS `ExtensionAbility` 实现后台任务

### Requirement: R227 字体 API 在 OHOS 降级为不支持
Tauri 无独立字体插件；OHOS `@ohos.graphics.font` 提供字体注册 API，但 Tauri 当前不暴露跨平台字体 API。OHOS 适配 SHALL NOT 新增字体插件；应用自有字体 SHALL 通过 `resource_dir()` 静态资源加载（由前端 CSS / ArkUI 处理），不通过 Tauri Rust API。

#### Scenario: 应用加载自有字体
- **WHEN** 应用需要在 OHOS 使用自有字体
- **THEN** 应用 SHALL 将字体文件放入 `resources/` 并通过前端 CSS `@font-face` 加载
- **AND** 不通过 Tauri API 注册系统字体
- **AND** `font_dir()` 在 OHOS 不可用（见 ohos-path-desktop-dirs 规范）

### Requirement: R228 应用接续在 OHOS 暂不实现
OHOS `@ohos.app.ability.continuationManager` / `connect` 提供跨设备应用接续能力，但 Tauri 无对应跨平台概念，且实现需深度集成 ability 生命周期与 UI 状态序列化。本项 SHALL 标记为"未来工作"，当前 OHOS 适配 SHALL NOT 提供应用接续 API。

#### Scenario: 应用请求接续
- **WHEN** 应用在 OHOS 期望使用跨设备接续
- **THEN** Tauri SHALL NOT 暴露接续 API
- **AND** 文档 SHALL 指引用户直接使用 OHOS 原生 `continuationManager` 在 ArkTS 层实现
- **AND** 该能力暂不纳入 Tauri 跨平台契约

### Requirement: R229 截图取色在 OHOS 暂不实现
OHOS `@ohos.screenshot` 提供截图能力（系统应用权限），取色可通过 `@ohos.multimodalInput` 或图像像素读取。Tauri 无截图/取色插件。本项 SHALL 标记为"未来工作"，当前 SHALL NOT 提供截图取色 API。

#### Scenario: 应用请求截图
- **WHEN** 应用在 OHOS 期望截图
- **THEN** Tauri SHALL NOT 暴露截图 API
- **AND** 文档 SHALL 指引：`@ohos.screenshot` 仅系统应用可用，第三方应用需通过 `window` 截图能力（属 `ohos-window-*` 范围，若有）

### Requirement: R230 无障碍在 OHOS 暂不实现
OHOS `@ohos.accessibility` 提供无障碍服务与辅助能力，但 Tauri 无跨平台无障碍 API。本项 SHALL 标记为"未来工作"，当前 SHALL NOT 提供无障碍 API。Web 内容无障碍由 ArkWeb 自身 ARIA 支持处理，不属本规范。

#### Scenario: 应用请求无障碍能力
- **WHEN** 应用在 OHOS 期望使用无障碍 API
- **THEN** Tauri SHALL NOT 暴露无障碍 API
- **AND** Web 内容无障碍 SHALL 依赖 ArkWeb 内置 ARIA 实现
- **AND** 原生 UI 无障碍 SHALL 由 OHOS 系统辅助服务处理

### Requirement: R223/R224 全局托盘/菜单事件监听仅在 OHOS desktop 形态启用
OHOS 全局托盘与菜单栏仅在 `OHOS_DEVICE_TYPE=desktop` 时通过 `cfg(all(target_env = "ohos", desktop))` 启用，归 `tray-*` / `menu-*` 规范范围（本规范只读引用）。在 mobile 形态下 SHALL 不存在。

#### Scenario: mobile 形态无托盘
- **WHEN** `OHOS_DEVICE_TYPE=mobile`（默认）
- **THEN** 托盘/全局菜单 API SHALL 不编译
- **AND** 应用不引用托盘相关类型

#### Scenario: desktop 形态托盘归 tray 规范
- **WHEN** `OHOS_DEVICE_TYPE=desktop`
- **THEN** 托盘/菜单行为 SHALL 由 `ohos-tray-*` / `ohos-menu-*` 规范定义
- **AND** 本规范不重复定义

## 平台限制汇总
| 行 | 功能 | 判定 | 处置 |
|----|------|------|------|
| R195 | 多进程 | 平台限制降级 | 不支持，返回错误，引导 ExtensionAbility |
| R223/224 | 全局托盘/菜单事件监听 | 桌面形态归 tray/menu 规范 | mobile 降级，desktop 归其他规范 |
| R227 | 字体 | 平台限制降级 | 静态资源加载，无 Tauri API |
| R228 | 应用接续 | 未来工作 | 暂不实现，引导原生 API |
| R229 | 截图取色 | 未来工作 | 暂不实现，部分仅系统应用 |
| R230 | 无障碍 | 未来工作 | 暂不实现，依赖 ArkWeb/系统 |
