# Tray 模块 API 支持清单

> 基于 tray-icon/src/lib.rs 完整定义
> 更新时间：2026-05-20

---

## 模块总览

Tauri tray 模块由以下 4 个核心模块组成：

```
tray-icon crate
    │
    ├── TrayIconBuilder      # 托盘图标构建器
    │       └── 构建和配置 TrayIcon 实例
    │
    ├── TrayIcon             # 托盘图标实例（见 §二）
    │       └── 管理图标生命周期
    │
    ├── TrayIconEvent        # 托盘事件类型（见 §三）
    │       ├── Click / DoubleClick / Enter / Move / Leave
    │       ├── MouseButton（见 §四）
    │       └── MouseButtonState（见 §五）
    │
    └── Rect                 # 位置和尺寸信息（见 §六）
```

### 四大模块职责

| 模块 | 职责 | OHOS 适配状态 |
|------|------|---------------|
| **TrayIconBuilder** | 构建 TrayIcon，配置图标/菜单/提示 | ✅ 已适配（见 §一） |
| **TrayIconEvent** | 定义事件类型，提供事件接收机制 | ✅ 已适配（仅 Click）（见 §三） |
| **MouseButton** | 鼠标按钮枚举（Left/Right/Middle） | ✅ 已适配（Left/Right）（见 §四） |
| **MouseButtonState** | 鼠标按钮状态（Up/Down） | ✅ 固定 Up（见 §五） |

### 模块依赖关系

```
TrayIconBuilder
    │
    │ build()
    │
    ▼
TrayIcon
    │
    │ 用户点击
    │
    ▼
TrayIconEvent
    │
    │ Click { button, button_state }
    │
    ├──► MouseButton (Left/Right)
    │
    └──► MouseButtonState (Up)
```

---

## 一、TrayIconBuilder

| API | OHOS 支持 | 说明 |
|-----|-----------|------|
| `new()` | ✓ | 创建 builder |
| `with_id()` | ✓ | 设置 TrayIconId |
| `with_icon()` | ✓ | 设置图标（需转换为 white/black PixelMap） |
| `with_menu()` | ✓ | 设置菜单（OHOS 右键菜单） |
| `with_tooltip()` | △ | **部分支持**：仅 6.0.2(22)+ 且是 hoverTips（hover 时显示文本），部分设备/版本不显示 |
| `with_title()` | ✓ | 设置标题（左键弹窗标题） |
| `with_temp_dir_path()` | ✗ | **Linux only**，OHOS 不支持 |
| `with_icon_as_template()` | ✗ | **macOS only**，OHOS 不支持 |
| `with_menu_on_left_click()` | ✗ | **OHOS 不支持**：左键固定触发 statusBarIconClick 事件 |
| `with_menu_on_right_click()` | ✗ | **OHOS 不支持**：右键固定弹出菜单 |
| `id()` | ✓ | 获取 ID |
| `build()` | ✓ | 构建 TrayIcon |

---

## 二、TrayIcon

| API | OHOS 支持 | 说明 |
|-----|-----------|------|
| `new()` | ✓ | 创建 TrayIcon |
| `with_id()` | ✓ | 带指定 ID 创建 |
| `id()` | ✓ | 获取 TrayIconId |
| `set_icon()` | ✓ | 更新图标（updateStatusBarIcon） |
| `set_menu()` | ✓ | 更新菜单（updateStatusBarMenu） |
| `set_tooltip()` | △ | **部分支持**：仅 6.0.2(22)+ 且是 hoverTips（非标准 tooltip），部分设备/版本不显示 |
| `set_title()` | △ | **需重建**：无 `updateQuickOperationTitle` API，需重建 StatusBarItem（调用 addToStatusBar） |
| `set_visible()` | ✓ | 显示/隐藏（addToStatusBar/removeFromStatusBar） |
| `set_temp_dir_path()` | ✗ | **Linux only**，OHOS 不支持 |
| `set_icon_as_template()` | ✗ | **macOS only**，OHOS 不支持 |
| `set_icon_with_as_template()` | ✗ | **macOS only**，OHOS 不支持 |
| `set_show_menu_on_left_click()` | ✗ | **macOS/Windows only**，OHOS 不支持 |
| `set_show_menu_on_right_click()` | ✗ | **macOS/Windows only**，OHOS 不支持 |
| `show_menu()` | ✗ | **macOS/Windows only**，OHOS 不支持 |
| `rect()` | ✗ | **OHOS 不支持**：无 API 获取图标位置和尺寸 |
| `window_handle()` | ✗ | **Windows only** |
| `ns_status_item()` | ✗ | **macOS only** |
| `app_indicator()` | ✗ | **Linux only** |

---

## 三、TrayIconEvent

### 3.1 事件类型

| 事件类型 | OHOS 支持 | 说明 |
|----------|-----------|------|
| `Click` | ✓ 部分支持 | 左键点击图标 + 右键点击菜单项 |
| `DoubleClick` | ✗ | **Windows only**，OHOS 不支持 |
| `Enter` | ✗ | OHOS 不支持，与 Linux 一致 |
| `Move` | ✗ | OHOS 不支持，与 Linux 一致 |
| `Leave` | ✗ | OHOS 不支持，与 Linux 一致 |

### 3.2 Click 事件字段

| 字段 | OHOS 支持 | 说明 |
|------|-----------|------|
| `id` | ✓ | TrayIconId（全局存储） |
| `position` | ✗ | **固定 (0, 0)**：OHOS 不提供位置 |
| `rect` | ✗ | **固定 default**：OHOS 不提供尺寸 |
| `button` | ✓ 部分支持 | Left（左键点击图标）+ Right（右键点击菜单项），不支持 Middle |
| `button_state` | ✓ 固定值 | **固定 Up**：OHOS 不区分按下/释放 |

### 3.3 TrayIconEvent 方法

| API | OHOS 支持 | 说明 |
|-----|-----------|------|
| `id()` | ✓ | 获取事件 ID |
| `receiver()` | ✓ | 获取事件接收器 |
| `set_event_handler()` | ✓ | 设置事件处理器 |
| `send()` | ✓ | 发送事件（内部使用） |

---

## 四、MouseButton

| 值 | OHOS 支持 | 来源 |
|----|-----------|------|
| `Left` | ✓ | statusBarIconClick.iconClickType = "leftClick" |
| `Right` | ✓ | rightMenuClick.menuCode 存在时推断 |
| `Middle` | ✗ | OHOS 无中键概念 |

---

## 五、MouseButtonState

| 值 | OHOS 支持 | 说明 |
|----|-----------|------|
| `Up` | ✓ | OHOS 固定返回此值（只发送点击完成事件） |
| `Down` | ✗ | OHOS 不区分按下/释放状态 |

---

## 六、Rect

| API | OHOS 支持 | 说明 |
|-----|-----------|------|
| `size` | ✗ | 固定 (0, 0) |
| `position` | ✗ | 固定 (0, 0) |

---

## 七、平台专属 API（OHOS 无需实现）

| API | 平台 | 说明 |
|-----|------|------|
| `with_temp_dir_path()` | Linux | 图标临时存储路径 |
| `set_temp_dir_path()` | Linux | 图标临时存储路径 |
| `with_icon_as_template()` | macOS | 模板图标 |
| `set_icon_as_template()` | macOS | 模板图标 |
| `set_icon_with_as_template()` | macOS | 模板图标 |
| `set_show_menu_on_left_click()` | macOS/Windows | 左键显示菜单开关 |
| `set_show_menu_on_right_click()` | macOS/Windows | 右键显示菜单开关 |
| `show_menu()` | macOS/Windows | 手动显示菜单 |
| `window_handle()` | Windows | HWND |
| `ns_status_item()` | macOS | NSStatusItem |
| `app_indicator()` | Linux | AppIndicator |
| `DoubleClick` 事件 | Windows | 双击事件 |

---

## 八、OHOS 特有限制

| 限制 | 影响 | 设计决策 |
|------|------|----------|
| 单图标限制 | 不支持多 TrayIcon | 文档说明，多 tray 时创建者覆盖前者 |
| 左键固定事件模式 | `menu_on_left_click` 无效 | 左键固定触发 statusBarIconClick |
| 右键固定弹出菜单 | `menu_on_right_click` 无效 | 右键固定弹出系统菜单 |
| 无位置/尺寸 API | `rect()` 返回 None | 文档说明 |
| 无 Down 状态 | `button_state` 固定 Up | 与 Linux 一致 |
| hoverTips 版本限制 | 6.0.2(22) 起 | 低版本静默失败 `.ok()` |
| hoverTips 非标准 tooltip | 不是桌面 tooltip | 仅为 hover 时显示文本，部分设备不显示 |

---

## 九、tooltip 能力对比分析

| 平台 | tooltip 支持 | 说明 |
|------|-------------|------|
| **Windows** | ✓ 完整支持 | 标准 tooltip，所有版本可用 |
| **macOS** | ✓ 完整支持 | 标准 tooltip，所有版本可用 |
| **Linux (gtk)** | △ 部分支持 | 仅支持简单文本提示，部分 gtk 主题不显示 |
| **OHOS** | △ 部分支持 | 仅 6.0.2(22)+ 支持 hoverTips，非标准 tooltip，部分设备不显示 |

**结论**：Linux 和 OHOS 在 tooltip 上都属于**部分支持**，不能算完整支持 Tauri tooltip 能力。

| 对比项 | Linux | OHOS | 差异 |
|--------|-------|------|------|
| API 名称 | gtk tooltip | hoverTips | 不同实现 |
| 版本要求 | 无 | 6.0.2(22)+ | OHOS 有版本门槛 |
| 显示可靠性 | 部分主题不显示 | 部分设备不显示 | 都不可靠 |
| 功能完整性 | 简单文本 | 简单文本 (1~128字符) | 相似 |
| 用户感知 | 悬停显示 | 悬停显示 | 相似 |

**设计决策**：将 tooltip 标记为 `△ 部分支持`，与 Linux 一致，文档说明版本要求和限制。

---

## 十、muda OHOS 后端菜单支持

> muda crate OHOS 平台支持（Phase 0）

### 10.1 muda 菜单类型支持

| muda 类型 | OHOS 支持 | 实现方式 |
|-----------|-----------|----------|
| `Menu` | ✓ | statusBarManager.publish() |
| `MenuItem` | ✓ | StatusBarMenuItem (notifyOnly=true) |
| `Submenu` | ✓ | StatusBarMenuItem + subMenu |
| `PredefinedMenuItem::separator()` | ✓ | 空标题 + disabled |
| `PredefinedMenuItem::minimize()` | ✓ | executePredefinedAction("minimize") + setTimeout(300ms) |
| `PredefinedMenuItem::hide()` | ✓ | executePredefinedAction("hide") + setTimeout(300ms) |
| `PredefinedMenuItem::close()` | ✓ | executePredefinedAction("close") → minimize + setTimeout(300ms) |
| `PredefinedMenuItem::maximize()` | ✓ | executePredefinedAction("maximize") |
| `PredefinedMenuItem::fullscreen()` | ✓ | executePredefinedAction("fullscreen") |
| `PredefinedMenuItem::quit()` | ✓ | app.exit(0) |
| `CheckMenuItem` | ✓ | toggle_check_item + MENU_METADATA check_state |
| `IconMenuItem` | ✓ | PNG decode + icon_rgba → createPixelMapFromRgba |
| `accelerator` | ✗ stub | 忽略快捷键，显示文本 |

### 10.2 ContextMenu trait 支持

| ContextMenu 方法 | OHOS 实现 | 说明 |
|------------------|-----------|------|
| `as_menu()` | ✓ | 返回 Menu 引用 |
| `as_submenu()` | ✓ | 返回 Submenu 引用 |
| `ohos_context_menu()` | ✓ | 构建 StatusBarMenu |
| `show_context_menu_for_hwnd()` | ✗ stub | Windows only |
| `show_context_menu_for_gtk_window()` | ✗ stub | Linux only |
| `show_context_menu_for_nsview()` | ✗ stub | macOS only |

### 10.3 MenuEvent 支持

| MenuEvent | OHOS 实现 | 说明 |
|-----------|-----------|------|
| `MenuEvent::id` | ✓ | menuCode → MenuId 映射 |
| `MenuEvent::receiver()` | ✓ | crossbeam channel |
| `MenuEvent::set_event_handler()` | ✓ | 事件处理器 |

### 10.4 OHOS 菜单限制

| 限制 | 影响 | 设计决策 |
|------|------|----------|
| 无 Window Menu Bar | `Menu::init_for_*` 无效 | stub：API 存在但无实际效果 |
| 一级菜单项≤20 | 菜单项数量限制 | 文档说明 |
| 子菜单≤20 | 子菜单项的数量限制 | 文档说明 |
| 无快捷键系统 | accelerator 无效 | stub：忽略快捷键，显示文本 |
| minimize/hide/close 窗口激活竞争 | 系统先激活窗口再执行动作 | setTimeout(300ms) 延迟执行 |
| close 等价于 minimize | OHOS 无法 destroyWindow 后恢复 | close → minimize |
| 托盘菜单项无法禁用 | StatusBarMenuItem 无 enabled 字段，禁用标志被忽略、禁用项仍可点仍触发命令 | 平台限制：Rust 侧每进程 warn 一次，文档说明；窗口菜单栏/弹窗菜单路径不受限 |
| 托盘子菜单封顶一层 | StatusBarSubMenuItem 无嵌套字段，二层以上子项被丢弃、嵌套标题降级为可点叶子 | 平台限制：Rust 侧每进程 warn 一次，文档说明；menubar/弹窗菜单多层不受限 |

---

## 十一、实现优先级

| 优先级 | API | 状态 |
|--------|-----|------|
| **P0** | muda OHOS 后端 | ✅ 已实现（Phase 0） |
| **P0** | TrayIconBuilder.build() | ✅ 已实现（Phase 2） |
| **P0** | TrayIcon.set_icon() | ✅ 已实现（Phase 2） |
| **P0** | TrayIcon.set_menu() | ✅ 已实现（Phase 2，依赖 muda） |
| **P0** | TrayIconEvent.Click | ✅ 已实现（Phase 3） |
| **P1** | TrayIcon.set_tooltip() | ✅ 已实现（△ 部分，6.0.2+） |
| **P1** | TrayIcon.set_visible() | ✅ 已实现 |
| **P2** | TrayIcon.set_title() | ✅ stub（OHOS 无 updateQuickOperationTitle API） |
| **P2** | PredefinedMenuItem (minimize/hide/close/maximize/fullscreen/quit) | ✅ 已实现（Phase 7） |
| **P2** | CheckMenuItem | ✅ 已实现（Phase 7） |
| **P2** | IconMenuItem | ✅ 已实现（Phase 7） |
| **N/A** | 平台专属 API | 不实现 |