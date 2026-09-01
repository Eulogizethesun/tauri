## Why

Phase 1 完成后 plugin-menu/plugin-statusbar 的 Rust facade 已就绪，但仍保留 consumer-facing channel API（`menu_event_receiver`/`send_menu_event`/`icon_click_receiver`/`menu_click_receiver`）。按解耦判据，这些 channel API 本质是 muda/tray-icon 契约——Tauri-shaped，不应留在 openharmony-ability。Phase 3 将它们迁到 muda/tray-icon 的 OHOS 适配层。

## What Changes

- `plugin-menu/src/lib.rs` 的 `menu_event_receiver()`/`send_menu_event()` 迁到 `muda/src/platform_impl/ohos/mod.rs`
- `plugin-statusbar/src/lib.rs` 的 `icon_click_receiver()`/`menu_click_receiver()` 迁到 `tray-icon/src/platform_impl/ohos/event.rs`
- plugin crate 保留 bridge 对接 + 类型契约，删除 consumer-facing channel API
- **注意**：此 Phase 可与 Phase 2 并行执行

## Capabilities

### New Capabilities
- `decoupling-channel-remigration`: 将 plugin crate 的 consumer-facing channel API 迁移到实际消费者（muda/tray-icon）的 OHOS 适配层

### Modified Capabilities
（无——功能等价迁移，不改变行为）

## Impact

- **plugin-menu/plugin-statusbar**：删除 channel API，保留 bridge 类型和 plugin 声明
- **muda**：OHOS 适配层新增 channel 定义
- **tray-icon**：OHOS 适配层新增 channel 定义（已有部分）
