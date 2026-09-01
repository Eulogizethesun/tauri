## Why

Tauri/tao 的 `Window::set_ignore_cursor_events(ignore)` 用于实现窗口事件穿透（ignore=true 时本窗口不消费鼠标/触摸事件，事件落到下层窗口）。OHOS 后端当前是空实现（`tao/platform_impl/ohos/mod.rs:1215` 直接返回 `NotSupported`），导致依赖该 API 的功能（如悬浮信息层、拖拽预览层让事件穿透到下层 webview）在 OHOS 上不可用。OHOS `ohos.window` 的 `setWindowTouchable(false)` 可实现窗口级事件穿透，需按当前 `ohdev` 旧模型（TSFN + ArkHelper）接入。

## What Changes

- 在 `openharmony-ability/crates/ability/src/window/mod.rs` 新增 `set_window_touchable(window_id, touchable)` TSFN 函数，模式对称现有 `set_window_blur`（`TSFN_SET_WINDOW_TOUCHABLE` + init + fire-and-forget 调用）。
- 在 `init_vibrancy_tsfn`（或等价 ArkHelper setup 点）追加 touchable TSFN 初始化，从 ArkHelper 取 `setWindowTouchable` 方法建 TSFN。
- `ArkHelper.ets` 新增 `setWindowTouchable(windowId, touchable)` 方法，调 `wm.setWindowTouchable(touchable)` 并 `.catch` 处理 Promise reject（避免闪退）。
- `tao` 填实 `set_ignore_cursor_events`：`ignore=true` → `set_window_touchable(window_id, false)`（逻辑取反：Tauri "ignore=穿透" ↔ OHOS "touchable=false=穿透"）。

## Capabilities

### New Capabilities
- `ohos-window-ignore-cursor-events`: OHOS 窗口事件穿透能力，映射 Tauri `setIgnoreCursorEvents` 到 `setWindowTouchable`，包含 TSFN 桥接、ArkHelper 暴露、Promise reject 处理、逻辑取反映射、真机验证约束。

### Modified Capabilities
- 无（`set_window_blur`/`set_window_background_color` 等现有 TSFN 能力不变；新增独立的 touchable TSFN）。

## Impact

- **openharmony-ability**：`window/mod.rs` 加 touchable TSFN + 公开函数；`ArkHelper.ets` 加 `setWindowTouchable` 方法；`lib.rs` re-export。
- **tao**：`platform_impl/ohos/mod.rs` 填实 `set_ignore_cursor_events`（Phase 2）。
- **其他平台**：无影响（OHOS 改动 `cfg(target_env = "ohos")` 隔离）。
- **真机验证依赖**：`setWindowTouchable(false)` 穿透语义（触摸 + hover）官方两版文档矛盾，Phase 2 真机为定论。
