# ohos-event-lifecycle-forward Tasks

- [x] 1. `MainEvent::Start` 转发 `Event::Resumed` + 注释说明
- [x] 2. `MainEvent::SaveState` 降级 `debug!` + 注释说明（移除 warn 与 XXX 注释）

## 真机验证发现（2026-08-06，API 23 desktop）

- [ ] 3. **`tauri://resumed` 事件真机不触发（已知不工作）**：代码转发链 `MainEvent::Start → Event::Resumed → RunEvent::Resumed` 已实现（tao mod.rs:559-566 + tauri app.rs:2628），但真机切后台→切回后，前端 `listen('tauri://resumed')` 30s 内未收到事件。与自动测试 #33 `RunEvent::Resumed fires on startup` 一直 FAIL 一致。
  - hilog 有 `WMSLife: NotifyAfterLifecycleResumed: in`（系统层 resumed 信号），但 tao `MainEvent::Start` 未触发或 `Event::Resumed` emit 链路断裂。
  - **结论**：OHOS 上 Resumed 事件不触发是已知现状，暂不深挖（与 #33 长期 FAIL 一致，非本次适配引入）。
  - **影响**：依赖 Resumed 的插件（如 deep-link 冷启动后恢复、状态恢复）在 OHOS 上不工作。后续如需修复，排查 `MainEvent::Start`（SHOWN）在 OHOS 2in1 切后台切回时是否产生 + `Event::Resumed` 到 JS `tauri://resumed` 的 emit 链路。
