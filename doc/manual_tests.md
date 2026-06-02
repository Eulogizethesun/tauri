# Tauri OHOS 适配手动测试用例清单

> **生成日期**: 2026-06-01
>
> **测试入口**: `examples/api` 应用
>
> **级别说明**: T0 = 冒烟必测（核心功能/主流程）；T1 = 重要回归（辅助功能/边界场景）
>
> **用途**: 本文档归档 Tauri OHOS 适配的所有手动测试用例，涵盖各模块的必测场景。新模块适配完成后将用例追加至对应章节。

---

## 一、Tray（系统托盘）手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | tray | 创建与图标 | Full Test Tray — 创建托盘与图标显示 | **T0** | 应用已启动，进入 Tray 页面 | 1. 点击 "Full Test Tray" 按钮 2. 确认状态栏出现托盘图标 3. 左键点击托盘图标 | ① UI 输出 `Full test tray created` ② 状态栏显示托盘图标（32×32 默认图标） ③ 左键点击弹出 QuickOperation 系统面板，标题 "Tauri API"（无 TrayIconEvent 输出） | QuickOperation 配置：title="Tauri API"，height=300，abilityName="TestTrayAbility" |
| core | tray | 右键菜单显示 | Full Test Tray — 右键菜单结构与项类型 | **T0** | 已创建 Full Test Tray | 1. 右键点击（或长按）状态栏托盘图标 2. 检查菜单整体结构 3. 逐项检查各类型菜单项显示 | ① 弹出上下文菜单 ② 自定义项正确显示：Normal Item（普通文字）、Check Item（未勾选状态）、Icon Item（带图标+文字）、Another Normal（普通文字） ③ 分隔符正确渲染为分隔线 ④ 预定义项正确显示：Copy/Cut/SelectAll/Undo/Redo/Minimize/Maximize/Fullscreen/CloseWindow/Hide/Quit | 菜单共含 4 个自定义项 + 4 个分隔符 + 11 个预定义项（不含 Paste 和 3 个分隔符预定义项） |
| core | tray | 菜单项点击事件 | Full Test Tray — 自定义菜单项点击 | **T0** | 已创建 Full Test Tray；已右键打开菜单 | 1. 点击菜单中的 "Normal Item" 2. 重新打开菜单，点击 "Check Item" 3. 重新打开菜单，点击 "Icon Item" | ① 点击 Normal Item → Menu Event Log 输出 `[menu-event #N lid=1] global:normal-item at <时间>` ② 点击 Check Item → 输出 `[menu-event #N lid=1] global:check-item at <时间>` ③ 点击 Icon Item → 输出 `[menu-event #N lid=1] global:icon-item at <时间>` ④ 每次点击后菜单自动关闭 | 验证自定义 MenuItem action 回调 + Rust 全局事件转发 |
| core | tray | 预定义菜单项功能 | Full Test Tray — 预定义菜单项操作验证 | **T0** | 已创建 Full Test Tray；输入框有文本可用于剪贴板测试 | 1. 在输入框中选中一段文本 2. 右键打开托盘菜单，点击 Copy → 在另一处粘贴，验证复制成功 3. 重新选中输入框文本 4. 打开菜单，点击 Cut → 粘贴验证剪切成功 5. 打开菜单，点击 Minimize → 窗口最小化到任务栏，点击任务栏图标恢复窗口 6. 打开菜单，点击 Maximize → 窗口铺满全屏 7. 打开菜单，点击 Fullscreen → 进入沉浸式全屏，按 Esc 退出 8. 打开菜单，点击 Hide → 窗口隐藏，从任务栏点击恢复 9. 打开菜单，点击 CloseWindow → 窗口关闭 | ① Copy：文本被复制到剪贴板，Menu Event Log 输出 `global:copy` ② Cut：文本从输入框消失且被复制到剪贴板，输出 `global:cut` ③ Minimize：窗口最小化到任务栏 ④ Maximize：窗口铺满全屏 ⑤ Fullscreen：进入沉浸式全屏，菜单栏隐藏，Esc 恢复 ⑥ Hide：窗口隐藏，从任务栏点击可恢复 ⑦ CloseWindow：窗口关闭 ⑧ 每个操作 Menu Event Log 均有对应 id 输出 | **不测试 Paste**（OHOS 剪贴板读权限限制）；Quit 会退出应用，建议最后测试 |
| core | tray | 托盘创建 | Tray Page — 自定义参数创建托盘 | **T1** | 应用已启动，进入 Tray 页面 | 1. 填写 Title/Tooltip/Icon 等参数 2. 点击 "Create tray" 按钮 | 托盘图标按配置参数创建成功；状态栏显示对应图标；悬停显示 tooltip | 会先移除已有的 tray-1 和 manual-tray；OHOS 有 500ms 延迟 |
| core | tray | 托盘清理 | Tray Page — Remove All Trays | **T1** | 已创建过托盘图标 | 1. 点击 "Remove All Trays" 按钮 | 所有托盘图标（tray-1、manual-tray、full-test-tray）从状态栏消失 | 验证批量移除能力 |
| core | tray | QuickOperation | Enable QuickOp — 启用快速操作面板 | **T1** | 应用已启动；tray-1 存在；TestTrayAbility 已在 module.json5 注册 | 1. 点击 "Enable QuickOp" 按钮 2. 左键点击状态栏托盘图标 | 系统弹出快速操作面板，标题 "Test Panel"，高度 250vp | **仅 OHOS 平台**；需预注册 abilityName |
| core | tray | QuickOperation | Update QuickOp — 更新快速操作参数 | **T1** | QuickOperation 已启用 | 1. 点击 "Update QuickOp" 按钮 2. 左键点击托盘图标 | 弹出面板标题变为 "Updated Title"，高度变为 400vp | **仅 OHOS 平台** |
| core | tray | QuickOperation | Disable QuickOp — 禁用快速操作 | **T1** | QuickOperation 已启用 | 1. 点击 "Disable QuickOp" 按钮 2. 左键点击托盘图标 | 不再弹出面板，仅触发点击事件 | **仅 OHOS 平台**；setQuickOperation(null) |

---

## 二、Menu（菜单）手动用例

### 2.1 菜单栏（MenuBar）

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | menu | menubar/基础 | MenuBar Visible — 菜单栏可见性 | **T0** | 应用已启动 | 1. 点击 "MenuBar Visible" 按钮 | `is_menu_visible()` 返回 `true`；菜单栏在窗口顶部可见 | 应用启动时已自带默认菜单栏 |
| core | menu | menubar/基础 | MenuBar Dropdown — 菜单栏下拉菜单 | **T0** | 应用已启动 | 1. 点击 "MenuBar Dropdown" 按钮 2. 点击菜单栏 "Click Me" | 下拉菜单显示 "Item A" 和 "Item B" 两个选项 | 验证基本下拉功能 |
| core | menu | menubar/基础 | MenuBar Hide — 隐藏菜单栏 | **T0** | 应用已启动 | 1. 点击 "MenuBar Hide" 按钮 | 菜单栏从窗口顶部消失；`is_menu_visible()` 返回 `false` | 调用 `plugin:app-menu\|hide_menu` |
| core | menu | menubar/基础 | MenuBar Show — 显示菜单栏 | **T0** | 菜单栏已隐藏 | 1. 点击 "MenuBar Show" 按钮 | 菜单栏重新出现（恢复默认 File/Edit/Window/Help）；`is_menu_visible()` 返回 `true` | 调用 `plugin:app-menu\|show_menu`；会先恢复默认菜单 |
| core | menu | menubar/快捷键 | MenuBar Accelerator Ctrl+O — 自定义快捷键 | **T0** | 应用已启动 | 1. 点击 "MenuBar Accelerator Ctrl+O" 按钮 2. 按下 Ctrl+O（或点击 Accel → Accel Test） | action 回调触发，结果区显示 `Accelerator Ctrl+O FIRED! id=<id>` | 验证 `setAccelerator('Ctrl+O')` |
| core | menu | menubar/事件 | MenuBar Action Event — 菜单项点击事件 | **T0** | 应用已启动 | 1. 点击 "MenuBar Action Event" 按钮 2. 点击 EventTest → Click Me | 结果区显示 `action callback fired! id=menu-event-test`；Menu Event Log 输出 `[menu-event #N lid=1] global:menu-event-test at <时间>` | 验证 JS action 回调 + Rust 全局事件同时触发 |
| core | menu | menubar/预定义项 | Menu Edit→Copy — 预定义复制 | **T0** | 应用已启动；输入框有文本 | 1. 点击 "Menu Edit→Copy" 按钮 2. 选中输入框文本 3. 点击 Edit → Copy | 选中文本被复制到剪贴板 | 验证 PredefinedMenuItem Copy 功能 |
| core | menu | menubar/点击交互 | MenuBar Check Item — 勾选菜单项点击切换 | **T0** | 应用已启动 | 1. 点击 "MenuBar Auto Refresh Checked" 按钮 2. 展开 "Refresh" 下拉菜单 3. 点击 "Check Me" 项 | ① 初始状态未勾选，500ms 后自动变为勾选 ✓ ② 点击后勾选状态切换 ③ Menu Event Log 输出 `[menu-event #N lid=1] global:check_me at <时间>` | 验证 CheckMenuItem 点击行为 |
| core | menu | menubar/点击交互 | MenuBar Fullscreen — 预定义全屏窗口操作 | **T0** | 应用已启动 | 1. 点击 "MenuBar Fullscreen" 按钮 2. 展开 "View" 下拉菜单 3. 点击 Fullscreen 项 4. 按 Esc 退出全屏 | ① 窗口进入全屏，菜单栏隐藏 ② Menu Event Log 输出 `[menu-event #N lid=1] global:fullscreen at <时间>` ③ 按 Esc 退出全屏，菜单栏恢复显示 | 验证预定义项执行原生窗口操作 |
| core | menu | menubar/基础 | MenuBar Remove — 移除菜单栏 | **T1** | 应用已启动 | 1. 点击 "MenuBar Remove Menu" 按钮 | 菜单栏消失（设置空菜单） | `Menu.new({ items: [] })` + `setAsWindowMenu()` |
| core | menu | menubar/基础 | MenuBar is_menu_visible — 可见性查询 | **T1** | 菜单栏处于已知状态 | 1. 点击 "MenuBar is_menu_visible" 按钮 | 返回当前菜单可见性布尔值；默认 `true`，Hide 后 `false` | 验证 API 返回值与实际状态一致 |
| core | menu | menubar/嵌套 | MenuBar Nested Submenu — 嵌套子菜单 | **T1** | 应用已启动 | 1. 点击 "MenuBar Nested Submenu" 按钮 2. 点击 "Outer" → 悬停 "Inner" | 级联菜单：Outer 下拉显示 "Top Item" + "Inner"；悬停 Inner 展开显示 "Deep Item" | 验证多层嵌套菜单展开 |
| core | menu | menubar/交互 | MenuBar Hover — 菜单项悬停效果 | **T1** | 应用已启动 | 1. 点击 "MenuBar Hover" 按钮 2. 鼠标悬停到 "HoverTest" | 悬停时背景色高亮变化；鼠标移开后恢复正常 | 验证 UI 交互反馈 |
| core | menu | menubar/图标 | MenuBar Bar-Level Icon — 菜单栏级图标 | **T1** | 应用已启动 | 1. 点击 "MenuBar Bar-Level Icon" 按钮 | "IconMenu" 在菜单栏级别文字旁显示一个小图标 | MB_TEST_ICON 为 1×1 透明 PNG |
| core | menu | menubar/状态 | MenuBar Disabled Item — 禁用菜单项 | **T1** | 应用已启动 | 1. 点击 "MenuBar Disabled Item" 按钮 2. 点击 "DisTest" 下拉 | "Disabled" 项灰显/半透明且不可点击；"Normal" 项全色可点击 | 验证 `enabled: false` 的视觉表现 |
| core | menu | menubar/快捷键 | MenuBar Accelerator Ctrl+C — 预定义复制快捷键 | **T1** | 应用已启动；有可选择的文本 | 1. 点击 "MenuBar Accelerator Ctrl+C" 按钮 2. 在输入框输入文本并选中 3. 按 Ctrl+C | 选中文本被复制到剪贴板；粘贴可验证 | 使用 PredefinedMenuItem Copy |
| core | menu | menubar/自动刷新 | MenuBar Auto Refresh Text — 文本自动刷新 | **T1** | 应用已启动 | 1. 点击 "MenuBar Auto Refresh Text" 按钮 2. 展开 "Refresh" 下拉菜单 | 下拉菜单显示 "Updated!" 而非 "Original" | 先创建 text='Original'，500ms 后 setText('Updated!')；验证 auto_refresh 机制 |
| core | menu | menubar/自动刷新 | MenuBar Auto Refresh Checked — 勾选状态自动刷新 | **T1** | 应用已启动 | 1. 点击 "MenuBar Auto Refresh Checked" 按钮 2. **不点击**，等待 500ms 3. 展开 "Refresh" 下拉菜单 | "Check Me" 项前自动出现勾选标记 ✓（无需手动点击） | 验证 auto_refresh 机制在 500ms 后自动推送 checked 状态变更到原生菜单栏 |
| core | menu | menubar/预定义项 | MenuBar Predefined Hide — 预定义隐藏窗口 | **T1** | 应用已启动 | 1. 点击 "MenuBar Predefined Hide" 按钮 2. 点击 Window → Hide | 窗口最小化；从任务栏恢复后窗口重新出现 | PredefinedMenuItem 'Hide' |
| core | menu | menubar/事件 | MenuBar Popup Regression — popup 回归测试 | **T1** | 应用已启动 | 1. 点击 "MenuBar Popup Regression" 按钮 | 光标位置弹出上下文菜单，显示 "Popup Test" | 验证 AppStorage key 重命名后 `menu.popup()` 仍正常工作 |
| core | menu | menubar/NativeIcon | MenuBar NativeIcon Symbols — 原生图标映射 | **T1** | 应用已启动 | 1. 点击 "MenuBar NativeIcon Symbols" 按钮 2. 分别展开 "Mapped" 和 "Unmapped" 子菜单 | Mapped 组：Add→★、LockLocked→🔒、Network→📶 显示对应系统图标；Unmapped 组：Home/Folder/Share 等仅显示文字无图标 | **仅 OHOS 平台**有映射效果 |
| core | menu | menubar/预定义项 | Menu Edit→Paste — 预定义粘贴 | **T1** | 应用已启动；剪贴板有内容 | 1. 点击 "Menu Edit→Paste" 按钮 2. 在外部复制文本 3. 聚焦输入框 4. 点击 Edit → Paste | 剪贴板内容被粘贴到输入框中 | OHOS 剪贴板读权限限制，当前无法验证 |
| core | menu | menubar/预定义项 | Menu Edit→Cut — 预定义剪切 | **T1** | 应用已启动；输入框有选中文本 | 1. 点击 "Menu Edit→Cut" 按钮 2. 选中输入框文本 3. 点击 Edit → Cut | 选中文本从输入框消失，同时被复制到剪贴板 | 验证 PredefinedMenuItem Cut 功能 |

### 2.2 弹出菜单（PopupMenu）

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | menu | popupmenu/基础 | Menu Page — Popup 弹出菜单 | **T0** | 应用已启动，进入 Menu 页面 | 1. 在 MenuBuilder 中配置菜单项 2. 点击 "Popup" 按钮 | 光标位置弹出上下文菜单，显示配置的所有菜单项 | `menu.popup()` 弹出 |
| core | menu | popupmenu/点击交互 | Popup Click Item — 弹出菜单点击菜单项 | **T0** | 应用已启动，进入 Menu 页面 | 1. 在 MenuBuilder 中添加一个 Normal 项（如 "Test Item"） 2. 点击 "Popup" 按钮 3. 在弹出菜单中点击 "Test Item" | ① 光标位置弹出上下文菜单 ② 点击后菜单消失 ③ UI 输出 `Item Test Item clicked` | 验证 MenuItem action 回调 |
| core | menu | popupmenu/点击交互 | Popup Predefined Copy — 弹出菜单预定义复制 | **T0** | 应用已启动，进入 Menu 页面；输入框有文本 | 1. 在 MenuBuilder 中添加一个 Predefined Copy 项 2. 选中输入框文本 3. 点击 "Popup" 按钮 4. 在弹出菜单中点击 Copy | 选中文本被复制到剪贴板；UI 输出 `Item Copy clicked` | 验证弹出菜单中预定义项的原生操作 |
| core | menu | popupmenu/图标 | Menu Page — Create menu with NativeIcon | **T1** | 应用已启动，进入 Menu 页面 | 1. 点击 "Create menu with NativeIcon" 按钮 | 菜单栏显示带 NativeIcon.Folder 图标的子菜单 | 验证 Submenu 级别的 NativeIcon |
| core | menu | popupmenu/图标 | Menu Page — Create menu with Image icon | **T1** | 应用已启动，进入 Menu 页面 | 1. 点击 "Create menu with Image icon" 按钮 | 菜单栏显示带 defaultWindowIcon 图标的子菜单 | 使用 `defaultWindowIcon()` 获取应用窗口图标 |
| core | menu | popupmenu/基础 | Menu Page — Create menu 创建应用菜单 | **T1** | 应用已启动，进入 Menu 页面；MenuBuilder 已配置菜单项 | 1. 在 MenuBuilder 中选择菜单项类型并创建 2. 点击 "Create menu" 按钮 | 窗口菜单栏出现 "app" 子菜单，包含所有配置的菜单项 | macOS 设为 AppMenu，其他平台设为 WindowMenu |

---

## 三、用例统计

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Tray（系统托盘） | 4 | 5 | **9** |
| Menu — MenuBar | 9 | 14 | **23** |
| Menu — PopupMenu | 3 | 3 | **6** |
| **合计** | **16** | **22** | **38** |

