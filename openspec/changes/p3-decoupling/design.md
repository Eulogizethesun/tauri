# Technical Design: Phase 3 — Channel 再迁移

## Context

Phase 1 迁移了大部分 consumer，但 plugin-menu/plugin-statusbar 的 Rust facade 中仍保留 consumer-facing channel API（`menu_event_receiver`/`send_menu_event`/`icon_click_receiver`/`menu_click_receiver`）。审计发现这些 plugin crate 不是中性 OHOS 能力门面，而是 muda/tray-icon 形状的复刻——channel API 本质是 muda/tray-icon 契约（Tauri-shaped），按解耦判据不应留在 openharmony-ability。

Phase 3 将这些 channel API 迁移到实际消费者（muda/tray-icon）的 OHOS 适配层。plugin crate 保留 ArkTS bridge 对接 + 类型契约，但删除 consumer-facing channel API。

## Goals

- 将 `menu_event_receiver()`/`send_menu_event()` 从 plugin-menu 迁到 `muda/src/platform_impl/ohos/mod.rs`
- 将 `icon_click_receiver()`/`menu_click_receiver()` 从 plugin-statusbar 迁到 `tray-icon/src/platform_impl/ohos/event.rs`
- plugin crate 保留 bridge 对接 + 类型契约，删除 consumer-facing channel API
- bridge `on_main_thread_event` 中的 `menu-click` 事件解码逻辑保留在 plugin-menu，但 push 到 muda 侧 channel

## Non-Goals

- 不改变 menu/statusbar 功能行为（功能等价迁移）
- 不创建新的 ArkTS 插件（Phase 4 负责 MenuPlugin.ets/StatusbarPlugin.ets）
- 不清理注释（Phase 5 负责）
- 不影响其他平台实现

## Decisions

### D1 menu channel 迁移到 muda

**决策**：将 `MENU_EVENT_CHANNEL` + `menu_event_receiver()`/`send_menu_event()` 从 `plugin-menu/src/lib.rs` 迁移到 `muda/src/platform_impl/ohos/mod.rs`。

**迁移内容**：
- `MENU_EVENT_CHANNEL: LazyLock<Sender<MenuEvent>>` 定义迁到 muda OHOS 适配层
- `menu_event_receiver()` 函数迁到 muda，muda 内部调用方改为直接引用本地 channel
- `send_menu_event()` 迁到 muda（或保留在 plugin-menu 作为 bridge 对接点，push 到 muda 侧 channel）

**理由**：
- `plugin-menu/src/lib.rs` 明写 `muda's event listener thread`，channel 的消费者是 muda
- 按「是否 Tauri-shaped」判据，`menu_event_receiver`/`send_menu_event` 本质是 muda 契约
- 迁移后 muda OHOS 适配层自持 channel，openharmony-ability 不再承载 muda 形态契约

**涉及文件**：
- `openharmony-ability/crates/plugin-menu/src/lib.rs`（删除 channel API）
- `muda/src/platform_impl/ohos/mod.rs`（新增 channel 定义 + receiver/sender 函数）

### D2 statusbar channel 迁移到 tray-icon

**决策**：将 `icon_click_receiver()`/`menu_click_receiver()` 从 `plugin-statusbar/src/lib.rs` 迁移到 `tray-icon/src/platform_impl/ohos/event.rs`。

**迁移内容**：
- `ICON_CLICK_CHANNEL`/`MENU_CLICK_CHANNEL` 定义迁到 tray-icon OHOS 适配层
- `icon_click_receiver()`/`menu_click_receiver()` 函数迁到 tray-icon
- tray-icon 内部调用方改为直接引用本地 channel

**理由**：
- `plugin-statusbar/src/lib.rs` 明写 `tray-icon's event-forward thread`/`used by tray-icon`，channel 的消费者是 tray-icon
- channel API 本质是 tray-icon 契约，不应留在 openharmony-ability

**涉及文件**：
- `openharmony-ability/crates/plugin-statusbar/src/lib.rs`（删除 channel API）
- `tray-icon/src/platform_impl/ohos/event.rs`（新增 channel 定义 + receiver 函数）
- `tray-icon/src/platform_impl/ohos/mod.rs`（若需调整引用）

### D3 bridge 事件保持不变

**决策**：`on_main_thread_event` 中的 `menu-click` 事件解码仍留在 plugin-menu，但解码后 push 到 muda 侧的 channel（而非 plugin-menu 自有的 channel）。

**理由**：
- bridge 反向事件（`on_main_thread_event`）是 plugin crate 的职责——plugin crate 负责 ArkTS bridge 对接
- 但事件分发目标 channel 应在消费者的适配层（muda），而非 plugin crate
- 这样 plugin crate 保留 bridge 类型契约，但不再持有 consumer-facing channel

**数据流**：
```
ArkTS menu click → bridge on_main_thread_event("menu-click")
  → plugin-menu 解码事件
  → muda::platform_impl::ohos::send_menu_event(event)  // push 到 muda 侧 channel
  → muda event listener thread receives via menu_event_receiver()
```

## Risks

| 风险 | 级别 | 缓解 |
|------|------|------|
| channel 迁移后 muda/tray-icon 编译失败（缺少依赖） | 中 | muda/tray-icon OHOS 适配层需添加 crossbeam channel 依赖（若未有） |
| bridge 事件 push 路径改变引入事件丢失 | 中 | 保持 `send_menu_event` 签名不变，仅改变 channel 定义位置 |
| tray-icon 已有部分 channel 定义，迁移后重复 | 低 | 迁移前检查 tray-icon OHOS 适配层现有 channel，合并去重 |
| 迁移后 plugin-menu/plugin-statusbar 仍有残留 channel 引用 | 低 | grep 确认 + cargo check 验证 |
