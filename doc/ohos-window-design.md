# OHOS 窗口能力支持现状与缺失功能设计

> 创建时间: 2026-07-02
> 核对基准: `tao/src/platform_impl/ohos/mod.rs`（1271 行）+ `openharmony-ability/crates/ability/src/window/mod.rs` + `native_ability/.../ArkHelper.ets` / `WindowManager.ets`
> 约束: 遵守 CLAUDE.md 三铁律 —— ① 所有 ArkTS 调用经 `openharmony-ability`；② `cfg(target_env = "ohos")` 隔离，不影响 Win/mac/Linux；③ `OHOS_DEVICE_TYPE` 决定形态，桌面专属能力用 `cfg(all(target_env = "ohos", desktop))`。
> 本文合并「现状核对」与「缺失功能设计」两部分，作为分组的开发依据。

---

# 第一部分 现状核对

原表共 38 项。核对后发现 **6 项标注与代码不符**：

| # | 能力 | 原表标注 | 实际状态 | 依据 |
|---|------|---------|---------|------|
| 1 | 请求重绘 | ✅ 支持 | ⚠️ 空实现（stub） | `pub fn request_redraw(&self) {}` 第 869 行，函数体为空 |
| 2 | 窗口背景色 | ❌ 不支持 | ✅ 已实现 | `set_background_color` 第 1079–1090 行，调 `set_window_background_color`，且尊重 `transparent` 标志 |
| 3 | 窗口装饰 | ❌ 不支持 | ✅ 已实现 | `set_decorations` 第 994–999 行调 `set_window_decorations`；`is_decorated` 读 `AtomicBool` |
| 4 | 窗口透明度 | ❌ 不支持（仅桌面） | ⚠️ 部分支持 | `transparent` 在创建期传入 `WindowCreateParams`，`set_background_color` 在 transparent=true 时强制 `0x00000000` |
| 5 | 窗口主题 | ❌ 不支持（始终返回 Light） | ⚠️ 部分支持 | `set_theme` 第 1099–1119 行调 `set_color_mode` 并写入 `AtomicU8`；`theme()` 读回。仅缺系统主题跟随事件 |
| 6 | 光标位置 | ❌ 不支持（返回 0） | ⚠️ 部分支持 | `cursor_position` 第 1051–1055 行读 `CURSOR_POSITION_X/Y` 原子量；该量由 ArkTS `onMouse` 经 NAPI `update_cursor_position` 更新。仅首次移动前为 (0,0)，且为窗口相对坐标 |

## 纠正后的完整能力表

> 状态图例：✅ 已支持 ｜ ⚠️ 部分支持 ｜ ❌ 未支持 ｜ ➖ 平台不适用

### 窗口生命周期与基础

| 能力 | 状态 | 实现说明 |
|------|------|---------|
| 窗口 ID | ✅ | `WindowId::dummy()` 返回单例 ID（OHOS 当前为单窗口模型，ID 恒为 0） |
| 窗口创建 | ✅ | `Window::new` 区分 UIAbility（复用主容器，window_id=0）与 Float（`create_os_window`，window_id>0） |
| 窗口销毁 | ⚠️ | `MainEvent::WindowDestroy` → 补发 `CloseRequested` + `Destroyed`；无主动销毁 API |
| 请求重绘 | ⚠️ | **`request_redraw` 为空实现**；重绘实际由 `MainEvent::WindowRedraw` 驱动 |
| 配置获取 | ✅ | `config()` 透传 `OpenHarmonyApp::config()` |
| 多窗口 | ⚠️ | Float 子窗口可创建（`OHOSWindowKind::Float` + `TypeFloat`），但 `supports_multiple_windows` 仍返回 false，`NewWindowResponse` 缺 `Create` 变体 |

### 几何与位置

| 能力 | 状态 | 实现说明 |
|------|------|---------|
| 窗口位置获取 | ✅ | `inner_position` = window_rect + content_rect 偏移；`outer_position` = window_rect.left/top |
| 窗口内容区域 | ✅ | `content_rect()` 透传 |
| 窗口大小获取 | ⚠️ | `inner_size`=content_rect；`outer_size`=window_rect（早期可为 (0,0)，回退 content_rect） |
| 窗口位置设置 | ❌ | `set_outer_position` 空实现 |
| 窗口大小调整 | ❌ | `set_inner_size` 仅 warn |
| 窗口大小限制 | ❌ | `set_min/max_inner_size` 空实现 |

### 外观与样式

| 能力 | 状态 | 实现说明 |
|------|------|---------|
| 窗口装饰 | ✅ | `set_decorations`/`is_decorated` 已实现，创建期亦应用 |
| 窗口背景色 | ✅ | `set_background_color` 已实现，transparent 时让位于透明 |
| 窗口透明度 | ⚠️ | 创建期 transparent 生效；运行期无独立 alpha 接口 |
| 窗口主题 | ⚠️ | `set_theme`/`theme()` 可读写；缺系统主题跟随 |
| 窗口图标 | ❌ | `set_window_icon` 空实现（OHOS 窗口无标题栏图标概念） |
| 窗口标题 | ❌ | `set_title` 空实现，`title` 返回空串 |
| 窗口效果 (vibrancy) | ➖ | OHOS 无窗口级背景模糊，平台不适用 |

### 状态控制

| 能力 | 状态 | 实现说明 |
|------|------|---------|
| 窗口最大化 | ❌ | `set_maximized` 空实现，`is_maximized` 返回 false |
| 窗口最小化 | ❌ | `set_minimized` 空实现，`is_minimized` 返回 false |
| 全屏模式 | ❌ | `set_fullscreen` warn，`fullscreen` 返回 None |
| 窗口可见性 | ❌ | `set_visible` 空实现，`is_visible` 返回 false |
| 窗口聚焦 | ❌ | `set_focus` warn；`is_focused` 读 `HAS_FOCUS`（事件侧已工作） |
| 窗口置顶 | ❌ | `set_always_on_top` 空实现，`is_always_on_top` 返回 false |
| 窗口置底 | ❌ | `set_always_on_bottom` 空实现 |
| 用户注意力请求 | ❌ | `request_user_attention` 空实现 |

### 装饰按钮可用性

| 能力 | 状态 | 实现说明 |
|------|------|---------|
| 窗口可关闭 | ❌ | `set_closable` warn |
| 窗口可最大化 | ❌ | `set_maximizable` warn |
| 窗口可最小化 | ❌ | `set_minimizable` warn |
| 窗口可聚焦 | ❌ | `set_focusable` warn |
| 窗口可调整大小 | ❌ | `set_resizable` warn |

### 输入与光标

| 能力 | 状态 | 实现说明 |
|------|------|---------|
| 光标位置 | ⚠️ | 读 `CURSOR_POSITION_X/Y`（ArkTS onMouse 经 NAPI 更新）；窗口相对、首次移动前为 (0,0) |
| 光标可见性 | ❌ | `set_cursor_visible` 空实现 |
| 光标图标 | ❌ | `set_cursor_icon` 空实现 |
| 光标抓取 | ❌ | `set_cursor_grab` 返回 `NotSupportedError` |
| 忽略光标事件 | ❌ | `set_ignore_cursor_events` 返回 `NotSupportedError` |
| IME 位置 | ❌ | `set_ime_position` 空实现 |

### 拖拽与高级

| 能力 | 状态 | 实现说明 |
|------|------|---------|
| 拖拽窗口 | ❌ | `drag_window` 返回 `NotSupportedError` |
| 拖拽调整窗口大小 | ❌ | `drag_resize_window` 返回 `NotSupportedError` |
| 可用区域避让 | ❌ | 未实现（需接 `window.on('avoidAreaChange')`） |
| 折叠屏支持 | ❌ | 未实现（需折叠传感器 + display API） |
| 窗口嵌入能力 | ❌ | 未实现 |
| 窗口状态持久化 | ❌ | 未实现（属插件层，非 tao 职责） |

## 统计

| 状态 | 数量 | 占比 |
|------|------|------|
| ✅ 已支持 | 8 | 21% |
| ⚠️ 部分支持 | 8 | 21% |
| ❌ 未支持 | 21 | 55% |
| ➖ 平台不适用 | 1 | 3% |
| 合计 | 38 | 100% |

---

# 第二部分 缺失功能设计

## 设计原则

1. **桥接层归一**：所有 OHOS `window.Window` 调用必须在 `openharmony-ability/crates/ability/src/window/mod.rs` 新增 Rust 封装 + `ArkHelper.ets` 新增 handler + `WindowManager.ets` 新增方法。tao 层只调 `openharmony-ability`，不直接 NAPI。
2. **形态分流**：UIAbility 主窗口（window_id=0）受系统管理；Float 子窗口（window_id>0）经 `FloatPage` LocalStorage 驱动 ArkUI 重渲染；桌面专属能力用 `cfg(all(target_env="ohos", desktop))`。
3. **错误语义对齐 tao**：能做返回 `Ok(())`；OHOS 无对应能力返回 `NotSupportedError`。
4. **事件回灌**：状态变更通过既有 `MainEvent` 通道上报。

## 能力分组

| 组 | 含义 | 项数 | 优先级 |
|----|------|------|--------|
| A | OHOS `window.Window` 有直接等价 API，可立即实现 | 11 | P0 |
| D | 装饰按钮可用性，依赖 FloatPage LocalStorage | 5 | P1 |
| E | 输入/光标，OHOS 能力有限 | 6 | P1 |
| C | 需底层传感器/系统级 API | 4 | P2 |
| B | 平台不适用或属插件层 | 3 | ➖ |

---

## 落地状态与预期效果（A/D/E 组已实现，实测后）

### A 组 — 窗口几何/状态

| 能力 | 状态 | 预期效果 | 手动按钮 |
|------|------|---------|---------|
| set_outer_position | ✅ 已修复 | tao→openharmony-ability→ArkTS moveWindowTo。曾因 napi-ohos bare-tuple bug（多参数被当成 1 个传）不生效，改用 `FnArgs { data: (...) }` 包裹后修复。rigorous 读回测试通过。**限制：主窗口(id=0)由系统管理，moveWindowTo 返回 1300002，静默 no-op；仅 Float 子窗口(id>0)可移动** | setOuterPosition(100,100) |
| set_inner_size | ✅ 已修复 | 同上，resize_window 经 FnArgs 修复后 win.resize() 真实生效，innerSize 读回向目标靠拢。**限制：主窗口(id=0)由系统管理，resize 返回 1300002（window state abnormal），静默 no-op；仅 Float 子窗口(id>0)可 resize** | setInnerSize(600×400) |
| drag_window | ❌ 平台限制 | OHOS 无 startWindowMove API；Float 子窗口拖拽由 FloatPage PanGesture 手柄处理 | — |
| drag_resize_window | ❌ 平台限制 | OHOS 无 startWindowResize/Direction；同上由手柄处理 | — |
| set_maximized / is_maximized | ✅ | desktop：窗口最大化填满屏幕 / 还原 | Toggle Maximize |
| set_minimized / is_minimized | ✅ | 窗口最小化到任务栏；unminimize 恢复 | Minimize (2s restore) |
| set_visible / is_visible | ✅ | hide：主窗口 hideAbility 后台、子窗口 minimize；show 恢复 | Hide/Show (2s restore) |
| set_focus | ✅ | 子窗口 raiseToAppTop 置前；主窗口聚焦系统管理 | setFocus |
| set_fullscreen / fullscreen | ✅ | 进入沉浸布局（隐藏状态栏/导航条）；退出还原。无独占全屏，映射 Borderless | Toggle Fullscreen |
| set_always_on_top / is_always_on_top | ⚠️ partial | OHOS 无 z-order API，仅记录意图标志；Float 子窗口天然浮于主窗口 | Toggle AlwaysOnTop ⚠️partial |
| set_ignore_cursor_events | ✅ | ignore=true 时点击穿透（setWindowTouchable=false），可点到后面窗口 | Toggle IgnoreCursor (3s) |

### D 组 — 装饰按钮可用性 + focusable

| 能力 | 状态 | 预期效果 | 手动按钮 |
|------|------|---------|---------|
| set_closable / is_closable | ✅ | 仅 Float 子窗口：控制 FloatPage 关闭按钮显隐。主窗口 no-op（装饰系统管理），但 isClosable() 状态翻转 | Toggle Closable |
| set_maximizable / is_maximizable | ✅ | Float 子窗口：控制 maximize 按钮显隐。主窗口 no-op | （同上，在 Float 窗口测） |
| set_minimizable / is_minimizable | ✅ | Float 子窗口：控制 minimize 按钮显隐。主窗口 no-op | （同上） |
| set_resizable / is_resizable | ✅ | Float 子窗口：控制 resize 手柄显隐。主窗口 no-op | Toggle Resizable |
| set_focusable | ✅ | setWindowFocusable(false) 后窗口不获取焦点；主/子窗口均有效 | setFocusable(false) (3s) |

> D 组按钮在主窗口点击仅翻转 is*() 状态（无视觉变化）。要观察按钮显隐效果，先用「Create Borderless Window」创建 Float 子窗口，再在其上测试。

### E 组 — 输入/光标

| 能力 | 状态 | 预期效果 | 手动按钮 |
|------|------|---------|---------|
| set_cursor_visible | ✅ | 全局鼠标光标隐藏/显示（pointer.setPointerVisible） | Toggle CursorVisible (3s) |
| set_cursor_icon | ✅ | 光标变为指定样式（hand/crosshair/text/wait/copy/not-allowed/grab/zoom-in，pointer.setPointerStyleSync） | Cycle CursorIcon |
| set_cursor_position | ❌ 平台限制 | OHOS 不开放写 cursor 位置 | — |
| set_cursor_grab | ❌ 平台限制 | OHOS 无指针锁定 API | — |
| set_ime_position | ❌ 平台限制 | inputMethod 无位置 API，面板位置系统管理 | — |
| cursor_position (读) | ⚠️ 已工作 | 返回窗口相对光标坐标（首次移动前为 0,0） | （已有 Get Cursor Position） |

### 未实现（C 组 P2 + B 组）## A 组 —— 直接映射 OHOS window API（P0）

### A1 窗口位置设置 `set_outer_position`
- tao: `Window::set_outer_position(&self, Position)`
- OHOS: `window.Window.moveWindowTo(x, y)`
- 形态: 通用
- 改造: `openharmony-ability` 新增 `move_window_to(window_id, x, y)`；ArkTS handler 调 `win.moveWindowTo(x, y)`；tao 用 `scale_factor` 转 physical px 后调用。`FloatPage.ets:74` 已有先例。

### A2 窗口大小调整 `set_inner_size`
- tao: `Window::set_inner_size(&self, Size)`
- OHOS: `window.Window.resize(width, height)`
- 形态: 通用
- 改造: `resize_window(window_id, w, h)`；`FloatPage.ets:239` 已有先例。

### A3 拖拽窗口 `drag_window`
- tao: `Window::drag_window(&self)`
- OHOS: **无 `startWindowMove` 公开 API**（SDK 23 / HarmonyOS 6.1 实测 `window.Window` 不导出该方法）
- 形态: desktop
- 状态: ❌ 平台限制。Float 子窗口拖拽由 `FloatPage` PanGesture 手柄处理（UI 层），不通过编程式 API 暴露。tao 侧返回 `NotSupportedError`。

### A4 拖拽调整大小 `drag_resize_window`
- tao: `Window::drag_resize_window(&self, ResizeDirection)`
- OHOS: **无 `startWindowResize` / `window.Direction` 枚举**（SDK 23 实测不存在）
- 形态: desktop
- 状态: ❌ 平台限制。同 A3，由 `FloatPage` 手柄处理。tao 侧返回 `NotSupportedError`。

### A5 窗口最大化 `set_maximized` / `is_maximized`
- OHOS: `window.Window.maximize()` / `restore()`
- 形态: desktop
- 改造: `maximize_window`/`restore_window`；tao 维护 `AtomicU8` 状态；ArkTS `windowSizeChange` → `MainEvent` 回灌状态。

### A6 窗口最小化 `set_minimized` / `is_minimized`
- OHOS: `window.Window.minimize()` / `restore()`
- 形态: desktop
- 改造: 同 A5 模式。`WindowManager.minimizeWindow` 已存在，复用。

### A7 窗口可见性 `set_visible` / `is_visible`
- OHOS: `showWindow()` 存在；**`hideWindow()` 不存在**（SDK 23 实测）
- 形态: 通用
- 改造: show → `win.showWindow()`；hide → 主窗口 `context.hideAbility()`，子窗口 `win.minimize()`（OHOS 无独立 hide，minimize 后 showWindow 可恢复）。tao 维护 `AtomicBool`。

### A8 窗口聚焦 `set_focus`
- OHOS: **`window.Window.focus()` 不存在**；子窗口用 `raiseToAppTop()`（since 14）
- 形态: 通用
- 改造: 子窗口 → `win.raiseToAppTop()`；主窗口聚焦由系统管理（no-op）。移除 warn。`is_focused` 已读 `HAS_FOCUS`。

### A9 全屏 `set_fullscreen` / `fullscreen`
- OHOS: `window.Window.setWindowLayoutFullScreen(true)` + `setWindowSystemBarEnable([])`
- 形态: 通用
- 改造: `set_fullscreen(window_id, bool)`；`Fullscreen::Exclusive` OHOS 无对应，统一映射 `Borderless(None)`。

### A10 窗口置顶 `set_always_on_top` / `is_always_on_top`
- OHOS: Float 子窗口天然浮于主窗口；跨窗口 z-order 调整
- 形态: desktop
- 改造: `set_window_z_level(window_id, top)`；`cfg(all(target_env="ohos", desktop))`，mobile 返回 `NotSupportedError`。

### A11 忽略光标事件 `set_ignore_cursor_events`
- OHOS: `window.Window.setWindowTouchable(false)`
- 形态: 通用（浮窗穿透）
- 改造: `set_window_touchable(window_id, bool)`；`set_ignore_cursor_events(true)` → `set_window_touchable(window_id, false)`。

---

## D 组 —— 装饰按钮可用性（P1）

`set_closable` / `set_maximizable` / `set_minimizable` / `set_focusable` / `set_resizable`。

OHOS UIAbility 主窗口装饰按钮由系统提供，不可逐项禁用。仅 Float 子窗口可逐项控制。
- `FloatPage.ets` 已用 `@LocalStorageProp` 响应 `decorations`，新增 `closable`/`maximizable`/`minimizable`/`resizable` 键，按钮 `if (closable)` 条件渲染。
- `openharmony-ability`: `set_window_decoration_flags(window_id, flags)`，handler 写 LocalStorage。
- tao: 五个 setter 调之；主窗口静默忽略。

---

## E 组 —— 输入与光标（P1）

### E1 光标可见性 `set_cursor_visible` ✅ 已实现
`@ohos.multimodalInput.pointer.setPointerVisible(visible)`（全局光标显隐）。openharmony-ability `set_pointer_visible` → ArkHelper `setPointerVisible`。

### E2 光标图标 `set_cursor_icon` ✅ 已实现
`@ohos.multimodalInput.pointer.setPointerStyleSync(windowId, PointerStyle)`。tao 侧 `CursorIcon → PointerStyle` 数值映射（DEFAULT=0, CROSS=13, HAND_POINTING=19, TEXT_CURSOR=26, LOADING=42, CURSOR_FORBID=15, CURSOR_COPY=14, HAND_OPEN=18, HAND_GRABBING=17, ZOOM_IN/OUT=27/28, 各方向 resize=1-12）。

### E3 光标位置写入 `set_cursor_position` ❌ 平台限制
OHOS 不开放应用写 cursor 位置（无 `setPointerLocation`）→ 保留 `NotSupportedError`。

### E4 光标抓取 `set_cursor_grab` ❌ 平台限制
OHOS 无指针锁定 API → 保留 `NotSupportedError`。

### E5 IME 位置 `set_ime_position` ❌ 平台限制
`@ohos.inputMethod` 无位置 API（仅 `showTextInput`/`setCallingWindow`，面板位置系统管理）→ 保留 no-op。

### E6 光标位置读取 ⚠️ 已工作
`cursor_position` 读 `CURSOR_POSITION_X/Y`（ArkTS onMouse 经 NAPI 更新），窗口相对坐标。补强为屏幕绝对坐标低优先级。

---

## C 组 —— 需系统级 API（P2）

### C1 可用区域避让
OHOS `window.Window.on('avoidAreaChange')` + `getWindowAvoidArea()`。
- `openharmony-ability` 注册监听 → `MainEvent::AvoidAreaChange(Rect)` → tao 新事件。mobile 键盘避让必要。

### C2 折叠屏支持
OHOS `@ohos.display` fold sensor + `window.on('displayFoldChanged')`。
- `MainEvent::FoldChanged{folded}` → `ScaleFactorChanged`/`Resized`。

### C3 窗口嵌入能力
OHOS 无 widget embed 公开 API → 平台限制。

### C4 窗口状态持久化
属 `tauri-plugin-window-state` 插件层，非 tao 职责。

---

## B 组 —— 平台不适用（➖）

| 能力 | 原因 |
|------|------|
| 窗口效果 (vibrancy) | OHOS 无窗口级背景模糊 |
| 窗口图标 | OHOS 窗口无标题栏图标 |
| 窗口标题 | UIAbility 标题为应用级；Float 窗口标题可经 FloatPage LocalStorage，低优先级 |

---

## 用户注意力请求 `request_user_attention`
OHOS 无直接等价；可用 `@ohos.notificationManager` 或 Float 窗口闪烁。P2，无明确 API 时保留空实现 + warn。

---

## 实施分层与铁律遵守

### openharmony-ability 层（铁律 1）
`crates/ability/src/window/mod.rs` 新增（均 `#[cfg(target_env = "ohos")]`）：
```rust
pub fn move_window_to(window_id: i64, x: i32, y: i32) -> napi_ohos::Result<()>;
pub fn resize_window(window_id: i64, w: i32, h: i32) -> napi_ohos::Result<()>;
pub fn start_window_move(window_id: i64) -> napi_ohos::Result<()>;
pub fn start_window_resize(window_id: i64, dir: i32) -> napi_ohos::Result<()>;
pub fn maximize_window(window_id: i64) -> napi_ohos::Result<()>;
pub fn minimize_window(window_id: i64) -> napi_ohos::Result<()>;
pub fn restore_window(window_id: i64) -> napi_ohos::Result<()>;
pub fn show_window(window_id: i64) -> napi_ohos::Result<()>;
pub fn hide_window(window_id: i64) -> napi_ohos::Result<()>;
pub fn focus_window(window_id: i64) -> napi_ohos::Result<()>;
pub fn set_fullscreen(window_id: i64, on: bool) -> napi_ohos::Result<()>;
pub fn set_window_touchable(window_id: i64, touchable: bool) -> napi_ohos::Result<()>;
pub fn set_window_decoration_flags(window_id: i64, flags: DecorationFlags) -> napi_ohos::Result<()>;
```
ArkTS 源在 `native_ability/src/main/ets/`（`pack.sh` 复制到 `package/`），handler 加到 `ArkHelper.ets`，方法加到 `WindowManager.ets`。

### tao 层（铁律 2/3）
`tao/src/platform_impl/ohos/mod.rs` 内新增实现天然由模块路径隔离；桌面专属用 `#[cfg(all(target_env = "ohos", desktop))]`，mobile 分支返回 `NotSupportedError`。

---

## 平台硬限制清单（不可实现，文档声明）

| 能力 | 限制 |
|------|------|
| 光标位置写入 | OHOS 不开放应用写 cursor 位置 |
| 光标抓取 | OHOS 无指针锁定 API |
| 窗口嵌入 | OHOS 无跨应用 widget embed 公开 API |
| vibrancy | OHOS 无窗口级背景模糊 |
| 光标可见性/图标 | 待 `@ohos.cursor` 调研确认 |

这些项不强行实现，tao 层保留 `NotSupportedError` 并在 API 文档标注 OHOS 平台限制。

---

## 开发节奏（按组别）

| 批次 | 内容 | 验证 |
|------|------|------|
| A | 11 项直接映射 | 开发 → 写测试 → 编译运行通过 → 下一组 |
| D | 5 项装饰按钮 | 同上 |
| E | 6 项输入/光标 | 同上 |
| C | 4 项系统级 | 同上 |

每批独立交付，落地后跑 `examples/api` 桌面 + mobile 双形态构建验证（参考 `ohos-build` skill）。
