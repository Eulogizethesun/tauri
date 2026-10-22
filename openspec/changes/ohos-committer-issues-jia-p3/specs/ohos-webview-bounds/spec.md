# ohos-webview-bounds Specification

## ADDED Requirements

### Requirement: Bounds conversion SHALL apply virtualPixelRatio

wry OHOS 后端的 bounds 换算 SHALL 接入 virtualPixelRatio(vp):`set_bounds`/create 的 `to_logical::<f64>(1.0)` 改为 `to_logical::<f64>(vp)`。vp 来源为 openharmony-ability 既有 display 绑定的薄包装(绑定返回 ≤0/异常时回落 1.0),零新增 NAPI wire、零 ArkTS 面。`bounds()` 回读 SHALL 维持 cache 语义,不经 vp 换算。

#### Scenario: vp=1.0 keeps conversion identical

- **WHEN** 绑定返回 vp=1.0(桌面基线)且 set_bounds 以 Physical Rect 调用
- **THEN** 换算结果 SHALL 与现状逐值一致(to_logical 对 Physical 输入 = 物理值 ÷ scale,除以 1.0 恒等;Logical 输入本就恒等)

#### Scenario: vp≠1.0 divides physical by vp

- **WHEN** 真机绑定报告 vp=2.0 且 set_bounds 以 Physical (200,100) 调用
- **THEN** 下发 ArkUI 的值 SHALL 为 (100,50) vp(物理 ÷ vp,窗口与物理像素对齐)
- **AND** `bounds()` 回读 SHALL 返回设置值原样(cache 语义不变,不经 vp 换算)

#### Scenario: Fallback when binding is unavailable

- **WHEN** 绑定 API 返回 ≤0 或异常(早期调用或设备不支持)
- **THEN** `virtual_pixel_ratio()` 包装 SHALL 返回 1.0,不 panic、不阻塞

#### Scenario: bounds cache semantics unchanged

- **WHEN** vp 接入后调用 `bounds()`
- **THEN** 既有「wry OHOS bounds SHALL return cached value」requirement 全部场景保持成立
