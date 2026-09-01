# OHOS 窗口能力 ↔ 测试按钮 一一对应总表

> 创建时间: 2026-08-20
> 数据来源: [ohos-window-test-mapping.md](ohos-window-test-mapping.md)（45 项能力表）+ TestRunner.svelte 实际按钮扫描（examples/api/src/views/TestRunner.svelte，Manual Tests 区约 2629 行起）
> 辩证参考: [ohos-window-test-buttons.md](ohos-window-test-buttons.md)（2026-08-20 版）——本文以**代码里的真实按钮标签为准**
> 测试结果图例: ✅ = 已实现且验证通过（自动测试或真机手动验证）；❌ = 未实现/接口不支持

## ⚠️ 沿用 buttons 文档的两个提醒

1. **mapping 文档的 `#NN` 编号已失效** — git pull 后测试集从 220 项增长，编号整体错位。**按测试名找，别按号**。下表「自动测试」列写的是测试名而非编号。

---

## 一、已实现能力 —— 有手动按钮（41 项，按表行计）

按钮标签均为 TestRunner.svelte 中的**实际文本**（toggle 按钮列出起始标签）。全部位于页面底部 Manual Tests 区。

| 能力 | 实际状态 | 测试结果 | 手动按钮（verbatim） | 所在分区 | 自动测试（按名） | 备注 |
|------|---------|---------|---------------------|---------|----------------|------|
| 窗口 ID | ✅ | ✅ | `Window ID (getCurrentWindow)` | 自动测试补充区 | getCurrentWindow | label 非空（主窗口 "main"） |
| 窗口大小获取 | ✅ | ✅ | `Window DPI (resize/drag to verify)` | 顶部通用区 | innerSize / outerSize | 拖拽/缩放后读回即新值（2026-08-20 真机实测） |
| 窗口位置获取 | ✅ | ✅ | `Window DPI (resize/drag to verify)`（同上按钮同时显示 outerPosition） | 顶部通用区 | innerPosition / outerPosition | inner 已补 decor_height 补偿；程序化 setPosition 读回 stale 属 #143 已知问题 |
| 窗口内容区域 | ✅ | ✅ | 无独立按钮（`Window DPI` 读数即基于 content_rect） | — | innerSize | content_rect() 天然不含标题栏 |
| 配置获取 | ✅ | ✅ | `currentMonitor` | 顶部通用区 | scaleFactor | 返回分辨率 + scaleFactor + position |
| 窗口创建（无装饰） | ✅ | ✅ | `Create Borderless Window (decorations=false)` | Decorations & Transparency | create_borderless | |
| 窗口创建（透明） | ✅ | ✅ | `Create Transparent+Borderless` | Decorations & Transparency | create_transparent | 兼测创建期透明度 |
| 窗口创建（有装饰） | ✅ | ✅ | `Create Decorated Window (title bar)` | Decorations & Transparency | — | 也是拖拽窗口/装饰 flag/BG 按钮的前置 |
| 窗口创建（多实例） | ✅ | ✅ | `Create UIAbility Instance Window` | 多 UIAbility 实例区 | createUIAbilityWindow | |
| 窗口销毁 | ✅ | ✅ | `CloseRequested (close sub-window)` | 自动测试补充区 | CloseRequested / Destroyed | 顶部另有 `Close All Test Windows` 批量清理 |
| 多窗口 | ✅ | ✅ | `on_new_window: Allow (window.open)` | 自动测试补充区 | on_new_window | 另有独立 on_new_window 区三按钮（见「四、buttons 文档未收录的关联按钮」） |
| 窗口位置设置 | ✅ | ✅ | `setOuterPosition (toggle 100/400)` | 几何/状态区 | set_position / setOuterPosition(smoke) | 作用于最后创建的子窗口（主窗口系统管理返回 1300002 静默 no-op） |
| 窗口大小调整 | ✅ | ✅ | `setInnerSize (half size, restore)` | 几何/状态区 | set_size / setInnerSize | 同上作用于子窗口 |
| 窗口大小限制 | ✅ | ✅ 手动 | `Set Min Size 1600×1200 (main window)` / `Set Min+Max (1600×1200 / 2400×1800 px)` / `Reset Min Size (null)` | 自动测试补充区 | 无 | ⚠️ 主窗口改尺寸触发 sizeChange 风暴，勿频繁点。`Set Min+Max` 按钮 buttons 文档未收录 |
| 窗口装饰 | ✅ | ✅ | `Toggle Decorations (main window)` | Decorations & Transparency | setDecorations | |
| 窗口背景色 | ✅ | ✅ | `Set BG Red (opaque)` / `Set BG Blue (alpha=128)` / `Set BG Green (alpha=0)` / `Reset BG (null)` | Window Background Color | create_borderless/transparent | 先创建子窗口再点 BG 按钮 |
| 窗口透明度（运行期 alpha） | ✅ | ✅ | `Set BG Blue (alpha=128)` / `Set BG Green (alpha=0)`（背景色含 alpha 即运行期透明度） | Window Background Color | — | 整窗 alpha 无 API（见「三」） |
| 窗口主题 | ✅ | ✅ 手动 | `Set Theme (toggle Light/Dark/System)` | 自动测试补充区 | 无 | None→COLOR_MODE_NOT_SET 系统跟随 |
| 窗口标题 | ✅ | ✅ 手动 | `Set Title (main window)` | 自动测试补充区 | 无 | setWindowTitle API15+；tao getter 仍返回空串 |
| 窗口效果 vibrancy | ✅ | ✅ | `vibrancy: Blur effect visible` / `vibrancy: Acrylic effect visible` / `vibrancy: clearEffects removes blur` / `vibrancy: build-time Blur (WindowBuilder::effects)` | Vibrancy 区 | setEffects / build-time effects | Mica/Tabbed 系列在 OHOS 上不支持（no-op 跳过，无模糊/底色） |
| 窗口最大化 | ✅ | ✅ | `Toggle Maximize` | 几何/状态区 | maximize / unmaximize / maximize fills | |
| 窗口最小化 | ✅ | ✅ | `Minimize (2s restore)` | 几何/状态区 | is_minimized / minimize smoke | 另有 `Minimize then is_minimized`（Persisted-Scope 区，buttons 文档未收录） |
| 全屏模式 | ✅ | ✅ | `Toggle Fullscreen` | 几何/状态区 | setFullscreen smoke | 实际走 maximize(ENTER_IMMERSIVE) + setTitleAndDockHoverShown（mapping 文档该行 API 链已过时；setWindowLayoutFullScreen 直连路径曾实现验证后于 2026-08-21 回退移除） |
| 窗口可见性 | ✅ | ✅ 手动 | `Hide/Show (2s restore)` | 几何/状态区 | 无 | 主窗口 hide=minimize / show=startAbility 复用实例 |
| 窗口聚焦 | ✅ | ✅ | `setFocus` + `isFocused (should be true)` + `Watch onFocusChanged`(toggle) + `Window Focus (create + focus sub-window)` | 几何/状态区 + 顶部 + Window Focus 区 | isFocused / onFocusChanged | `Window Focus` 按钮 buttons 文档未收录 |
| 窗口置顶 | ✅ | ✅ | `Toggle AlwaysOnTop (partial)` | 几何/状态区 | setAlwaysOnTop smoke | **实际按钮带 `(partial)` 后缀**，buttons 文档写的是无后缀版；功能已完整实现（setWindowTopmost API14+），后缀疑似 UI 文案滞后 |
| 用户注意力请求 | ✅ | ✅ 手动 | `Request User Attention (notification)` | 自动测试补充区 | 无 | 首次弹授权框→允许→右下角通知 |
| 窗口可关闭 | ✅ | ✅ | `Toggle Closable` | 装饰按钮区 | decoration flags smoke | 需先 Create Decorated Window |
| 窗口可最大化 | ✅ | ✅ | `Toggle Maximizable` | 装饰按钮区 | 同上 | |
| 窗口可最小化 | ✅ | ✅ | `Toggle Minimizable` | 装饰按钮区 | 同上 | |
| 窗口可聚焦 | ✅ | ✅ | `setFocusable(false) (3s)` | 装饰按钮区 | 同上 | |
| 窗口可调整大小 | ✅ | ✅ | `Toggle Resizable` | 装饰按钮区 | 同上 | |
| 光标位置（读） | ✅ | ✅ | `Get Cursor Position` + `Start Mouse Tracking`(toggle) | Mouse Events 区 | cursorPosition | |
| 光标可见性 | ✅ | ✅ | `setCursorVisible(false) (3s)` | 光标区 | cursor smoke | |
| 光标图标 | ✅ | ✅ | `Cycle CursorIcon` | 光标区 | 同上 | |
| 光标抓取 | ✅ | ✅ 手动 | `setCursorGrab(true) 5s (Lock to window)` | 自动测试补充区 | 无 | LockCursor NDK API22+；锁定 5 秒，失焦自动解锁 |
| 忽略光标事件 | ✅ | ✅ | `Toggle IgnoreCursor (3s)` | 光标区 | ignoreCursorEvents smoke | 命令不崩溃已验；穿透效果未验 |
| IME 位置 | ✅ | ✅ 手动 | `Set IME Position (200,400)` | 自动测试补充区 | 无 | 前置：窗口内有聚焦编辑框（按钮自动注入）；结果回读显示在 manualResult |
| 窗口嵌入（子 WebView） | ✅ | ✅ 手动 | `create_webview (multi-webview)` | **Unstable Feature 区**（非窗口分区） | 无 | 300×200@(50,50) 矩形；buttons 文档把它放在 C 区表格里，易误读为无入口 |
| 窗口状态持久化 | ✅ | ✅ 手动 | `window-state save+restore` | 自动测试补充区 | 无 | 另有 Persisted-Scope 区 `Window-State Save/Restore/Clear` 三按钮（buttons 文档未收录） |
| 窗口事件 on_window_event | ✅ | ✅ | `Watch Window Events`(toggle) | 自动测试补充区 | on_window_event | |

## 二、已实现但**无按钮**——靠物理操作测试（2 项）

| 能力 | 实际状态 | 测试结果 | 测试方式 | 原因 |
|------|---------|---------|---------|------|
| 拖拽窗口 | ✅ | ✅ 手动 | `Create Decorated Window` 后**物理拖动子窗口标题栏** | startMoving 必须在 ArkTS touch 事件内调用，无法从 Rust/JS 按钮触发；仅 Float 子窗口标题栏可拖 |
| 拖拽调整窗口大小 | ✅ | ✅ 手动 | **物理拖拽主窗口边缘** | enableDrag(true) 是边缘缩放开关，方向/边缘由系统决定，无独立触发 API |

## 三、接口不支持 / 平台限制 —— 无测试入口（4 项）

| 能力 | 测试结果 | 结论 | 依据 |
|------|---------|------|------|
| 请求重绘 | ❌ | 部分支持 stub，**no-op 合理** | OHOS 由系统 vsync 自动驱动重绘（MainEvent::WindowRedraw），无需 API |
| 窗口图标 | ❌ | ❌ 接口不支持 | @ohos.window 无窗口图标接口，应用图标只能 module.json5 静态配置 |
| 窗口置底 | ❌ | ❌ 接口不支持 | z-order 仅有置顶方向 setWindowTopmost，无 bottommost 对应接口 |
| 折叠屏支持 | ❌ | ❌ 接口不支持 | 窗口层无折叠专用 API；display 层监听未接线；本机 HAD-W32 非折叠屏 |

> 另：**窗口透明度第三层「整窗 alpha」**❌ 无 API（无 SetLayeredWindowAttributes 类接口），创建期/运行期背景色 alpha 两层已实现且有按钮（见一）。
> 另：**可用区域避让**❌ 未实现（C 组 P2，无按钮；2026-08-21 从 PR 回退移除）。

---

## 四、测试顺序速查（沿 buttons 文档，补充新按钮）

1. 基础几何：`Window DPI` + `currentMonitor`
2. 安全按钮（不改尺寸）：`Set Title` / `Set Theme` / `Window ID` / `set_bounds round-trip (webview)`
3. 子窗口链：`Create Decorated Window` → 装饰 flag 五按钮 → BG 四按钮 → `setOuterPosition` / `setInnerSize` → `Hide/Show`
4. 拖拽：拖子窗口标题栏（startMoving）；拖主窗口边缘（enableDrag）
5. 大小限制：`Set Min+Max`（一次验合并下发）→ `Reset Min Size`（⚠️ 勿频繁点，sizeChange 风暴）
6. 通知/光标/IME/置顶：按 buttons 文档顺序
7. 收尾：`Close All Test Windows` 清理测试子窗口
