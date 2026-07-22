## 1. tao 层
- [x] event.rs: Started/SaveStateRequested/ContentRectChanged 变体 + Clone/map/to_static
- [x] mod.rs: MainEvent::Start/SaveState/ContentRectChange/Pause 转发

## 2. tauri-runtime 层
- [x] lib.rs: Started/SaveStateRequested/ContentRectChanged/Suspended 变体

## 3. tauri-runtime-wry 层
- [x] lib.rs: Suspended/Resumed/Started/SaveStateRequested/ContentRectChanged 桥接

## 4. tauri 层
- [x] app.rs: RunEvent 变体 + RuntimeRunEvent→RunEvent 映射
- [x] lib.rs: 事件追踪
- [x] core.ts: 3 个自动测试

## 5. 验证
- [x] 215 pass / 1 fail
