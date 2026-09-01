## Why

Phase 1 完成后，所有 consumer 已迁移到 plugin facade，核心 crate 中的旧全局单例（cursor 位置、waker、TSFN 族、menu dispatcher）不再有外部消费者。这些全局单例假设单一消费者实例、使用 unsafe transmute、持有跨线程不安全引用——是遗留的运行时耦合点。Phase 2 清理这些内部耦合，使核心 crate 对 Tauri 运行时的隐式假设归零。

## What Changes

- tao 本地缓存 cursor 位置 → 删除 `app.rs` 全局 `CURSOR_POSITION_X/Y` + NAPI `update_cursor_position`
- 评估 `waker.rs` 全局 `WAKER` TSFN 单例的替代方案（tao EventLoop 自带 waker）
- 删除 `menu/event.rs` 的 `GLOBAL_DISPATCHER`（随接缝 #4 一起）
- 删除 helper 子模块中 13 个 TSFN 全局（account 3 + opener 2 + autostart 3 + restart 1 + permission 1 + updater 3）
- 修复 5 处 unsoundness（transmute + ptr::read + ManuallyDrop）
- 接缝 1 close 队列：评估 tauri-runtime-wry 自建队列 vs 中性化注释保留

## Capabilities

### New Capabilities
- `decoupling-internal-refactor`: 覆盖核心 crate 内部的全局单例清理、TSFN 遗留删除、unsoundness 修复

### Modified Capabilities
（无——纯内部重构，不改变外部行为）

## Impact

- **ability core**：11 个文件变更，全部在 `src/` 内部
- **tao**：cursor 本地缓存改动 `platform_impl/ohos/mod.rs`
- **外部消费者**：无影响（Phase 1 已完成迁移，旧 API 无外部调用者）
