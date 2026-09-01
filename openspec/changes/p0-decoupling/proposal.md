## Why

Bridge 迁移（PR #67/#68）完成后，openharmony-ability 核心仓仍存在多条「双轨」旧代码：旧的 menu/statusbar channel 与新的 plugin facade 并行存活、970 行永不编译的 `helper/webview.rs` 死代码模块、`drag_and_drop` 空壳 feature。这些旧代码虽然不影响运行时行为，但制造维护混淆、增加编译噪音、阻碍后续解耦阶段推进。Phase 0 是 6 阶段解耦的起点，清理双轨旧代码为后续 facade 迁移和内部重构铺路。

## What Changes

- 标记 `menu/mod.rs` 旧 channel API（`MENU_EVENT_CHANNEL`、`menu_event_receiver`、`send_menu_event` 等）为 `#[deprecated]`
- 标记 `statusbar/event.rs` 旧 channel API（`ICON_CLICK_CHANNEL`、`MENU_CLICK_CHANNEL` 等）为 `#[deprecated]`
- 清理 `lib.rs:132-141` 的旧 channel re-export（全限定路径调用已零命中）
- 删除 `helper/webview.rs`（970 行永不编译的死代码）+ `helper/mod.rs` 中 `#[cfg(feature = "webview")]` 声明
- 移除 `ability/Cargo.toml` 的 `drag_and_drop = []` 空壳 feature 定义
- 移除 `wry/Cargo.toml` 对 `drag_and_drop` feature 的启用

## Capabilities

### New Capabilities
- `decoupling-dual-track-cleanup`: 覆盖 Phase 0 的全部清理工作——deprecated 标注、死代码删除、空壳 feature 移除。确保清理后 `cargo check` 仍通过、旧 API 有明确弃用信号。

### Modified Capabilities
（无——Phase 0 是纯内部清理，不改变任何外部可见行为或 spec 级需求）

## Impact

- **openharmony-ability/crates/ability**：7 个文件变更，全部在 `src/` 内部
- **wry/Cargo.toml**：移除 `drag_and_drop` feature 启用
- **外部消费者**：旧 channel API 标 `#[deprecated]` 后，现有消费者（muda、tray-icon）仍可编译但产生 deprecation warning；无 breaking change
- **ArkTS 侧**：无影响（Phase 0 不涉及 ArkTS 代码）
