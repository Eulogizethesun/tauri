## Why

OHOS 有 4 个生命周期事件（Start、SaveState、ContentRectChange、Pause）在 tao 层被 warn/TODO 拦截未转发。同时 `Event::Resumed`/`Event::Suspended` 在 tauri-runtime-wry 中缺失桥接。

## What Changes

- tao: 新增 Started/SaveStateRequested/ContentRectChanged Event 变体，转发 4 个 MainEvent
- tauri-runtime: 新增对应 RuntimeRunEvent 变体 + Suspended
- tauri-runtime-wry: 桥接 Suspended/Resumed + 3 个 OHOS 事件
- tauri: 新增 RunEvent 变体 + 映射 + 事件追踪 + 3 个自动测试

## Capabilities

### New Capabilities
- `ohos-lifecycle-events`: OHOS 生命周期事件转发到 Tauri RunEvent
