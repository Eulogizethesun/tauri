# OHOS Tray Icon Degradation Specification

## Purpose

显式记录 tray-icon OHOS 实现中因 OHOS StatusBar API 缺失而无法满足跨平台契约
的 API，及其降级行为。涉及：
- `TrayIcon::set_temp_dir_path`（R176）— Linux appindicator 临时图标目录语义，
  OHOS 无对应概念；
- `TrayIcon::rect`（R177）— StatusBar API 不提供托盘图标位置/尺寸。

## ADDED Requirements

### Requirement: set_temp_dir_path 为 no-op 并文档化

`TrayIcon::set_temp_dir_path` 在 Linux 上用于指定 appindicator 后端写入临时图标
文件的目录。OHOS StatusBar 通过 NAPI 传递图标 RGBA 数据（非文件路径），无临时
目录概念。

OHOS 实现 SHALL 保持 `set_temp_dir_path` 为 no-op（空函数体），并 SHALL 在源码
注释中说明 "OHOS StatusBar uses NAPI RGBA transfer, no temp dir; see openspec
ohos-tray-degradation"。SHALL NOT 输出 `warn!`（no-op 是预期行为）。

#### Scenario: 调用 set_temp_dir_path
- **WHEN** 应用调用 `tray.set_temp_dir_path(Some("/tmp/myapp"))`
- **THEN** 调用 SHALL 不抛异常、无副作用
- **AND** 不输出 warn 日志
- **AND** 后续 set_icon 仍通过 NAPI RGBA 传输，不写临时文件

#### Scenario: 跨平台应用调用
- **WHEN** 跨平台应用在所有平台调用 `set_temp_dir_path`
- **THEN** OHOS 上 SHALL 静默忽略，不影响 tray 图标显示
- **AND** Linux 上仍按 appindicator 语义生效

### Requirement: rect 返回 None 并文档化

OHOS StatusBar API 不提供托盘图标在屏幕上的位置或尺寸。`AvoidArea.topRect` 返回
整个状态栏区域（如 `{0, 0, 1440, 48}`），并非托盘图标本身——若用作近似会误导依赖
`rect` 做 popup 定位或尺寸计算的调用方。

OHOS 实现 SHALL 使 `TrayIcon::rect()` 返回 `None`，与 Linux 行为一致。SHALL 在
源码注释中说明降级原因（已在 `tray-icon/src/platform_impl/ohos/mod.rs` 既有注释
中体现，本 spec 要求保留并引用本 spec 名称）。

#### Scenario: 调用 rect
- **WHEN** 应用调用 `tray.rect()`
- **THEN** SHALL 返回 `None`
- **AND** 不输出 warn（None 是明确语义，非忽略）

#### Scenario: popup 定位回退
- **WHEN** 应用依赖 `rect()` 做托盘菜单 popup 定位
- **THEN** 应用 SHALL 在 OHOS 上回退到窗口中心或屏幕默认位置
- **AND** SHALL NOT 假设 OHOS 上 `rect()` 返回 Some

### Requirement: 降级行为文档化与一致性

本 spec 列出的降级行为 SHALL 与 Linux 平台行为对齐（Linux `rect()` 也返回
`None`，`set_temp_dir_path` 在 Linux 有语义而在 OHOS 无语义）。SHALL 在
`tray-icon/src/platform_impl/ohos/mod.rs` 对应函数注释中引用本 spec 名称。

#### Scenario: 跨平台行为对照
- **WHEN** 审查 OHOS 与 Linux tray-icon 实现
- **THEN** `rect()` 在 OHOS 与 Linux 均返回 `None`
- **AND** `set_temp_dir_path` 在 OHOS 为 no-op、在 Linux 有 appindicator 语义
- **AND** OHOS 注释引用 `openspec/specs/ohos-tray-degradation`
