## Why
tao OHOS `MonitorHandle::video_modes()` 硬编码 `refresh_rate: 60`、`monitor_from_point` 始终返回 None+warn。高刷新率设备（90/120Hz）无法反映真实值；点-显示器查询无意义返回 None。

## What Changes
- **openharmony-ability app.rs**：新增 `refresh_rate()`/`display_width()`/`display_height()` 方法，封装 `ohos-display-binding` 的 `default_display_*`（遵守铁律#1，tao 不直依赖 binding）
- **tao MonitorHandle**：
  - `video_modes()` refresh_rate 取 `app.refresh_rate()` 真实值
  - `size()` 取 DisplayManager 物理像素，0 时回退 content_rect + warn
  - `monitor_from_point`（EventLoopWindowTarget + Window）基于单显示器边界判定返回 Some(primary)/None，不再 warn

## Impact
- 高刷新率设备返回真实 refresh_rate
- monitor_from_point 屏幕内坐标返回 Some，屏幕外 None
- 不影响其他平台
## 风险（待构建验证）
- `default_display_width`/`default_display_height` 函数名按 `default_display_*` 模式推断（refresh_rate agent 已确认），width/height 需构建校验
