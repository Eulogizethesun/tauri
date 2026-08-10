# ohos-window-ignore-cursor-events 适配计划

**创建时间**：2026-08-05
**功能描述**：为 Tauri/tao 的 `setIgnoreCursorEvents` 在 OHOS 上提供实现，基于 `ohos.window.setWindowTouchable(false)` 实现窗口级事件穿透（触摸 + 鼠标事件传给下层窗口）。
**架构基线**：当前 `ohdev` 分支（旧模型：`get_helper()` + `get_named_property` + TSFN），**不考虑新模型 plugin-window 重构**。
**判断依据**：涉及 3 个代码层（openharmony-ability / tao / ArkTS），预估 6 个文件。

## OHOS API 基线

- **API**：`ohos.window` 的 `setWindowTouchable(isTouchable: boolean): Promise<void>`
- **语义**（官方智能问答最新版，待真机验证）：`false` = 窗口不消费触摸/鼠标事件，事件穿透到 Z 轴下层窗口
- **版本**：API 9+ 支持，元服务 API 12+；tauri demo 默认 API 12，满足
- **系统能力**：`SystemCapability.WindowManager.WindowManager.Core`
- **错误码**：401（参数）、1300002（窗口状态异常/跨进程）、1300003（UI 未加载）—— **均通过 Promise reject 异步传递**（非同步抛出）
- **约束**：仅同进程窗口（1300002）；UI 加载完成后调用（1300003）

## Tauri API 映射

| Tauri/tao API | OHOS API | 语义 |
|---------------|----------|------|
| `Window::set_ignore_cursor_events(ignore: bool)` | `window.setWindowTouchable(!ignore)` | `ignore=true` → 穿透 ↔ `touchable=false`（逻辑取反） |

## 旧模型实现模式（参照 `set_window_blur`）

`set-touchable` 走 **TSFN fire-and-forget** 模式（和 `set_window_blur`/`set_window_background_color` 对称），不用同步直调（`set_window_decorations` 那种主线程限）——因为 tao 命令可能在 worker 线程。

- **Rust 侧**：`window/mod.rs` 加 `TSFN_SET_WINDOW_TOUCHABLE` + 在 `init_vibrancy_tsfn` 内追加初始化 + `set_window_touchable(window_id, touchable)`，TSFN 调 ArkHelper 的 `setWindowTouchable` 方法。`init_vibrancy_tsfn` 在 `render/xcomponent.rs:37` 的 XComponent render 初始化时被调用（非 ArkHelper setup）
- **ArkTS 侧**：`ArkHelper.ets` 加 `setWindowTouchable(windowId, touchable)` 方法，调 `wm.setWindowTouchable` 或 `WindowManager` 封装
- **tao 侧**：填实 `set_ignore_cursor_events`，调 `openharmony_ability::set_window_touchable(window_id, !ignore)`

## Phase 列表

| Phase | 名称 | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|------|--------|---------|---------|
| 1 | 底层实现 — ability TSFN + ArkHelper | ✓ 已归档 | openharmony-ability + ArkTS | 3 | cargo check + 契约自洽（通过） |
| 2 | 上层集成 — tao 填实 + 真机验证 | ✓ 已归档 | tao + examples | 3 | 真机 setIgnoreCursorEvents 穿透测试（API 23 desktop 通过） |

## Phase 详细说明

### Phase 1: 底层实现 — ability TSFN + ArkHelper
- **目标**：在 `openharmony-ability` 加 `set_window_touchable(window_id, touchable)` TSFN 函数（对称 `set_window_blur`），ArkHelper 暴露 `setWindowTouchable` 方法调 `wm.setWindowTouchable`。
- **文件列表**：
  - `openharmony-ability/crates/ability/src/window/mod.rs`（`TSFN_SET_WINDOW_TOUCHABLE` + `init_vibrancy_tsfn` 内追加 touchable TSFN 初始化 + `set_window_touchable` 公开函数）
  - `openharmony-ability/native_ability/src/main/ets/ability/ArkHelper.ets`（`setWindowTouchable: (windowId, touchable) => { wm.setWindowTouchable... }` 方法）
  - `openharmony-ability/crates/ability/src/lib.rs`（re-export `set_window_touchable`，若需要）
- **依赖**：无
- **验证**：`cargo check`；TSFN init 在 ArkHelper setup 时调（参照 `init_vibrancy_tsfn` 调用点）

### Phase 2: 上层集成 — tao 填实 + 真机验证
- **目标**：填实 `tao/platform_impl/ohos/mod.rs:1215` 的 `set_ignore_cursor_events`（当前返回 NotSupported），调 `openharmony_ability::set_window_touchable(self.window_id, !ignore)`；加手动测试。
- **文件列表**：
  - `tao/src/platform_impl/ohos/mod.rs`（填实 `set_ignore_cursor_events`）
  - `tauri/examples/api/src/lib/tests/ohos-adapter.ts`（手动测试）
  - `tauri/doc/manual_tests.md`（手动用例归档）
- **依赖**：Phase 1 完成
- **验证**：真机 — 子窗口叠主窗口，`setIgnoreCursorEvents(true)`，测触摸 + hover 是否穿透

## 风险与待验证

1. **真机验证穿透语义**：官方两版文档矛盾。Phase 2 真机为定论。hover 不穿透则叠加 `hitTestBehavior(HitTestMode.Transparent)`（R72 已验证）。
2. **Promise reject 不可感知**：TSFN fire-and-forget 模式下，ArkTS `setWindowTouchable` 的 Promise reject 无法反向通知 Rust（和 `set_window_blur` 同样限制）。ArkTS 侧必须 `.catch` 处理避免闪退，但 Rust 侧始终返回 Ok。若需错误感知，改 `call_with_return_value` + oneshot（如 `clipboard_write_image`）——Phase 2 视需求决定。
3. **1300002 跨进程约束**：tao 多窗口同进程，OK。
4. **逻辑取反**：`ignore=true` ↔ `touchable=false`，取反在 tao 层。
