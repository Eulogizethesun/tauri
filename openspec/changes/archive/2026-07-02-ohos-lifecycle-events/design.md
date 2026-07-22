## Context

4 个 OHOS 生命周期事件被 warn/TODO 拦截，`Event::Resumed`/`Suspended` 在 wry 桥接缺失。

## Decisions

- `Start` → `Started`（过去时，与 Resumed/Suspended 一致）
- `SaveState` → `SaveStateRequested`（系统请求保存，不是已保存）
- `ContentRectChange` → `ContentRectChanged`（过去时）
- `Pause` → `Suspended`（复用已有 tao Event 变体）
- `Event::Resumed`/`Suspended` 桥接不加 cfg gate（惠及 Android/iOS）
