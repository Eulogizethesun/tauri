# OHOS Monitor Degradation Specification

## Purpose

显式记录 tao OHOS `MonitorHandle` 中因 OHOS DisplayManager API 缺失而无法满足
跨平台契约的字段，及其降级行为。涉及：
- 位深（`VideoMode::bit_depth`）— R139
- 显示器位置（`MonitorHandle::position`）— R142
- 显示器名称（`MonitorHandle::name`）— R143

OHOS `ohos-display-sys`（native_display_manager）仅暴露：`Id`、`Width`、`Height`、
`Rotation`、`Orientation`、`VirtualPixelRatio`、`RefreshRate`、`DensityDpi`、
`DensityPixels`、`ScaledDensity`、`DensityXdpi`、`DensityYdpi`、`CutoutInfo`、
`IsFoldable`、`FoldDisplayMode`、DisplayChangeListener。无 `BitDepth` / `Name` /
多屏枚举 / 屏幕坐标 API。

## ADDED Requirements

### Requirement: bit_depth 固定 32（OHOS 标准）

OHOS DisplayManager 不提供位深查询 API。OHOS 设备普遍采用 RGBA8888（32 位）显示
管线，硬编码 `bit_depth: 32` 与真实值一致。

`MonitorHandle::video_modes()` SHALL 返回 `bit_depth: 32`，并在源码注释中说明
"OHOS DisplayManager has no bit-depth API; 32 is the OHOS standard (RGBA8888)"。

#### Scenario: 调用 video_modes
- **WHEN** 调用 `monitor.video_modes().next()`
- **THEN** `VideoMode::bit_depth()` SHALL 返回 32
- **AND** 该值与 OHOS RGBA8888 显示管线一致，非近似

### Requirement: position 固定 (0,0)（单显示器原点）

OHOS DisplayManager 仅暴露默认显示器，无多屏枚举与屏幕坐标空间概念。默认显示器
原点为屏幕坐标 (0, 0)。

`MonitorHandle::position()` SHALL 返回 `PhysicalPosition::new(0, 0)`，并在源码
注释中说明 "OHOS is single-display; default display origin is (0,0)"。

#### Scenario: 调用 position
- **WHEN** 调用 `monitor.position()`
- **THEN** SHALL 返回 `(0, 0)`
- **AND** 该值为真实原点（非占位），因 OHOS 无多屏偏移概念

### Requirement: name 固定 "OpenHarmony Device"（无 API）

OHOS DisplayManager 不提供显示器名称查询 API。`MonitorHandle::name()` SHALL 返回
`Some("OpenHarmony Device".to_owned())`，并在源码注释中说明
"OHOS DisplayManager has no display-name API; returns fixed identifier"。

#### Scenario: 调用 name
- **WHEN** 调用 `monitor.name()`
- **THEN** SHALL 返回 `Some("OpenHarmony Device")`
- **AND** 该值为固定标识，不随设备型号变化

### Requirement: 多屏 API 显式返回单屏

OHOS DisplayManager 无 `getAllDisplays` 等多屏枚举 API。
`available_monitors()` SHALL 返回仅含默认显示器的单元素集合；
`primary_monitor()` SHALL 返回该默认显示器。

#### Scenario: 调用 available_monitors
- **WHEN** 调用 `available_monitors()`
- **THEN** SHALL 返回长度为 1 的集合
- **AND** 唯一元素为默认显示器 MonitorHandle

#### Scenario: 外接显示器
- **WHEN** 设备外接显示器（如 HiCar / 投屏）
- **THEN** OHOS DisplayManager 不暴露该屏，`available_monitors()` 仍返回 1 个
- **AND** 此为已知平台限制，应用 SHALL NOT 假设能枚举所有屏

### Requirement: 降级行为文档化

本 spec 列出的所有降级项 SHALL 在 tao OHOS `mod.rs` 对应函数处通过注释引用
`openspec/specs/ohos-monitor-degradation`，便于审计追溯。

#### Scenario: 源码注释引用
- **WHEN** 审查 `MonitorHandle::name` / `position` / `video_modes` 源码
- **THEN** 注释 SHALL 引用本 spec 名称
- **AND** 不出现 `FIXME` / `TODO` 字样（降级是明确决策，非待办）
