# OHOS Monitor Real Values Specification

## Purpose

定义 tao OHOS `MonitorHandle` 与 `EventLoopWindowTarget` 对显示器真实属性与
点-显示器查询的契约。当前实现：
- `video_modes()` 硬编码 `refresh_rate: 60`、`bit_depth: 32`；
- `monitor_from_point()` 始终返回 `None` 并 `warn!`。

本 spec：
- 要求刷新率 SHALL 取自 OHOS DisplayManager 真实值；
- 要求 `monitor_from_point` SHALL 基于单显示器边界判定返回 `Some(primary)` 或 `None`；
- 位深、显示器位置、显示器名称因 OHOS 无对应 API，由 `ohos-monitor-degradation`
  spec 显式降级，本 spec 不涉及。

> **2026-08-28 勘误**：`ohos-display-sys 0.1.3` 已声明多屏 API
> （`CreateAllDisplays` @since 14、`GetDisplayPosition` @since 20、DisplayAdd/Remove
> 监听），"无多屏枚举"的前提在 sys 层已不成立；binding/openharmony-ability/tao
> 尚未接入。本 spec 的单显示器语义在多屏接入前继续有效（多屏下副屏坐标返回
> None 是已确认的语义缺口）。升级路径详见
> `openspec/ohos-event-monitor-tray-plan.md` "OHOS API 关键未知项"。

## ADDED Requirements

### Requirement: 刷新率取自 OHOS DisplayManager 真实值

`MonitorHandle::video_modes()` SHALL 返回的 `VideoMode` 中 `refresh_rate` 字段取自
OHOS DisplayManager 的 `OH_NativeDisplayManager_GetDefaultDisplayRefreshRate` 真实
值，而非硬编码 60。

由于 OHOS `target_env = "ohos"` 下 `MonitorHandle` 只代表默认（唯一）显示器，
`video_modes()` SHALL 返回单个 `VideoMode`，其：
- `size` = 当前显示器物理尺寸（沿用 `content_rect`）；
- `refresh_rate` = `default_display_refresh_rate()` 返回值（如 60/90/120）；
- `bit_depth` = 32（见 ohos-monitor-degradation）。

#### Scenario: 高刷新率设备
- **WHEN** 设备真实刷新率为 120Hz，调用 `monitor.video_modes().next()`
- **THEN** 返回的 `VideoMode::refresh_rate()` SHALL 为 120
- **AND** 不再硬编码返回 60

#### Scenario: 标准 60Hz 设备
- **WHEN** 设备真实刷新率为 60Hz
- **THEN** `refresh_rate()` SHALL 为 60（与真实值一致，非硬编码巧合）

### Requirement: 刷新率 API 经由 openharmony-ability 暴露

为遵守 "openharmony-ability 是唯一桥接仓" 约束，OHOS DisplayManager 的刷新率
查询 SHALL 通过 `openharmony-ability` 暴露（例如在 `OpenHarmonyApp` 上新增
`refresh_rate()` 方法，或新增 `display` 模块 re-export
`ohos_display_binding::default_display_refresh_rate`）。

tao OHOS `Cargo.toml` SHALL NOT 直接依赖 `ohos-display-binding`；调用路径必须为
`tao → openharmony_ability → ohos_display_binding`。

#### Scenario: tao 通过 openharmony-ability 查询刷新率
- **WHEN** `MonitorHandle::video_modes()` 需要刷新率
- **THEN** 调用 SHALL 经由 `self.app.refresh_rate()` 或等价 openharmony-ability API
- **AND** tao 的 Cargo.toml 不出现 `ohos-display-binding` 直接依赖

### Requirement: monitor_from_point 基于单显示器边界判定

OHOS 为单显示器系统（DisplayManager 仅暴露 `GetDefaultDisplay*` API，无多屏枚举）。
`EventLoopWindowTarget::monitor_from_point(x, y)` 与 `Window::monitor_from_point(x, y)`
SHALL 基于默认显示器边界判定：
- 若 `(x, y)` 落在默认显示器矩形内（`0 <= x < width` 且 `0 <= y < height`，使用
  `default_display_width/height` 物理像素），返回 `Some(primary_monitor)`；
- 否则返回 `None`；
- SHALL NOT 输出 `warn!`（该判定是预期行为，非忽略）。

#### Scenario: 点在屏幕内
- **WHEN** 调用 `monitor_from_point(100.0, 200.0)` 且屏幕分辨率为 1440×2960
- **THEN** SHALL 返回 `Some(primary_monitor)`
- **AND** 不输出 warn

#### Scenario: 点在屏幕外
- **WHEN** 调用 `monitor_from_point(-1.0, 0.0)` 或 `monitor_from_point(99999.0, 0.0)`
- **THEN** SHALL 返回 `None`
- **AND** 不输出 warn

#### Scenario: cursor_position 落点查询
- **WHEN** 应用读取 `cursor_position()` 后调用 `monitor_from_point` 验证光标所在屏
- **THEN** 在屏幕内坐标 SHALL 返回 `Some(primary)`，与单显示器语义一致

### Requirement: 显示器尺寸使用 DisplayManager 真实值

`MonitorHandle::size()` SHALL 返回 OHOS DisplayManager
`GetDefaultDisplayWidth/Height` 的物理像素值，而非 `content_rect`（content_rect 是
窗口内容区，会随窗口状态变化，不适合代表显示器）。

当 DisplayManager 查询失败时，SHALL 回退到 `content_rect` 尺寸并 `log::warn!`。

#### Scenario: 正常查询
- **WHEN** 调用 `monitor.size()`
- **THEN** 返回 DisplayManager 物理像素尺寸（例如 1440×2960）
- **AND** 该值不随窗口最小化/恢复变化

#### Scenario: DisplayManager 查询失败
- **WHEN** `OH_NativeDisplayManager_GetDefaultDisplayWidth/Height` 返回非 0
- **THEN** SHALL 回退到 `content_rect` 尺寸
- **AND** 输出 `warn!` 记录回退
