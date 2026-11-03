# ohos-window-scale-events Specification

## Purpose

OHOS 窗口 scale 事件保真:ScaleFactorChanged 沿去噪。ArkTS 侧配置/布局回调可能对同一 effective scale 重复触发 tao 事件;重复转发会引发上游(tauri)侧多余的重算与重绘。本 spec 要求 scale 事件仅在真变化时向上转发,镜像 ThemeChanged 沿检测先例(tao event_loop.rs ThemeChanged 沿检测)。

## ADDED Requirements

### Requirement: ScaleFactorChanged SHALL fire only on effective change

tao OHOS 事件循环 SHALL 维护 `LAST_EFFECTIVE_SCALE` 原子快照(AtomicU64 位模式存储 f64);ScaleFactorChanged 仅当新 effective scale 与快照不同(按位比较)时才向事件循环转发,转发后更新快照。

#### Scenario: First event forwards

- **WHEN** 事件循环启动后收到首个 scale 事件(快照为空/哨兵值)
- **THEN** ScaleFactorChanged SHALL 转发且快照写为该值

#### Scenario: Repeated same-scale events are dropped

- **WHEN** 新 scale 与快照按位相等(如 1.0 重复触发)
- **THEN** SHALL 不转发 ScaleFactorChanged

#### Scenario: Real change forwards and updates snapshot

- **WHEN** 设备 virtualPixelRatio 或显示配置变化使 effective scale 变为不同值
- **THEN** ScaleFactorChanged SHALL 转发且快照更新为新值

#### Scenario: ThemeChanged de-dup precedent untouched

- **WHEN** 既有 ThemeChanged 沿检测(LAST_EFFECTIVE_THEME)与新 scale 去噪并存
- **THEN** 两条沿检测 SHALL 互不影响,各自独立维护快照
