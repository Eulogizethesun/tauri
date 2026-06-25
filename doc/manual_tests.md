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
| core | tray | icon_as_template | Icon as Template — template 模式下深色/浅色壁纸适配 | **T0** | 应用已启动，进入 Manual Tests 区域 | 1. 点击 "Icon as Template (check wallpaper)" 按钮 2. 确认状态栏出现托盘图标 3. 切换系统深色/浅色壁纸 4. 观察状态栏图标颜色变化 | ① 托盘图标创建成功（iconAsTemplate=true） ② 深色壁纸下图标为白色版本（保持可见） ③ 浅色壁纸下图标为黑色版本（保持可见） ④ 切换后图标颜色自动适配，无需重建托盘 | **仅 OHOS 平台**；验证 `to_monochrome()` 生成的白/黑双色 PixelMap 正确工作 |
| core | tray | icon_as_template | White Icon NO Template — 非 template 模式对比验证 | **T1** | 应用已启动，进入 Manual Tests 区域 | 1. 点击 "White Icon NO Template (compare)" 按钮 2. 确认状态栏出现纯白托盘图标 3. 切换系统深色/浅色壁纸 4. 观察图标是否有变化 | ① 托盘图标创建成功（32×32 纯白 PNG，iconAsTemplate=false） ② 切换壁纸后图标**不变**，始终保持纯白色 ③ 与 "Icon as Template" 对比：template 模式图标会变，非 template 不变 | 验证系统**不会**自动对非 template 图标做色反；确认 `icon_as_template` 功能的必要性 |

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

## 三、Clipboard（剪贴板）手动用例

### 3.1 writeImage 全参数类型

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | clipboard | writeImage/rgba | writeImage(rgba) — { rgba, width, height } 对象 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "writeImage(rgba)" 按钮 2. 切换到备忘录或其他应用 3. 粘贴 | ① Console 输出 `writeImage({ rgba: … }) OK` ② 粘贴后出现 1×1 红色图像 | 验证 visit_map → JsImage::Rgba 路径 |
| core | clipboard | writeImage/data-uri | writeImage(data-uri) — data URI 字符串 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "writeImage(data-uri)" 按钮 2. 切换到其他应用 3. 粘贴 | ① Console 输出 `writeImage(dataUri) OK` ② 粘贴后出现图像 | 验证 visit_str → JsImage::DataUri 路径 |
| core | clipboard | writeImage/rid | writeImage(Image rid) — Image 资源对象 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "writeImage(Image rid)" 按钮 2. 切换到其他应用 3. 粘贴 | ① Console 输出 `writeImage(Image rid=N) OK` ② 粘贴后出现 1×1 红色图像 | 验证 duck-type rid → JsImage::Resource 路径 |
| core | clipboard | writeImage/bytes | writeImage(Uint8Array) — PNG 字节数组 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "writeImage(Uint8Array)" 按钮 2. 切换到其他应用 3. 粘贴 | ① Console 输出 `writeImage(Uint8Array) OK` ② 粘贴后出现 1×1 红色图像 | 验证 visit_seq → JsImage::Bytes 路径 |
| core | clipboard | writeImage/path | writeImage(filePath) — 文件路径字符串 | **T1** | 应用已启动，进入 Tests 页面 | 1. 点击 "writeImage(filePath)" 按钮 2. 切换到其他应用 3. 粘贴 | ① Console 输出 `writeImage(filePath) OK` + 路径信息 ② 粘贴后出现 1×1 红色图像 | 验证 visit_str → JsImage::Path 路径；使用 fs plugin + path API 写临时文件 |
| core | clipboard | writeImage/number-array | writeImage(number[]) — 数字数组 | **T1** | 应用已启动，进入 Tests 页面 | 1. 点击 "writeImage(number[])" 按钮 2. 切换到其他应用 3. 粘贴 | ① Console 输出 `writeImage(number[]) OK` ② 粘贴后出现 1×1 红色图像 | 验证 visit_seq → JsImage::Bytes 路径（OHOS IPC：Array → sequence） |
| core | clipboard | writeImage/arraybuffer | writeImage(ArrayBuffer) — ArrayBuffer | **T1** | 应用已启动，进入 Tests 页面 | 1. 点击 "writeImage(ArrayBuffer)" 按钮 2. 切换到其他应用 3. 粘贴 | ① Console 输出 `writeImage(ArrayBuffer) OK` ② 粘贴后出现 1×1 红色图像 | 验证 visit_seq → JsImage::Bytes 路径（OHOS IPC：buffer → sequence） |

---

## 四、Dialog（对话框）手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| plugin | dialog | open/基础 | Dialog.open (single) — 单文件选择 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Dialog.open (single)" 按钮 2. 在弹出的文件选择器中选择一个文件 3. 点击确认 | ① 弹出系统文件选择器 ② 选择文件后 UI 显示所选文件路径（字符串） ③ 路径非空 | `open({ multiple: false })` |
| plugin | dialog | open/多选 | Dialog.open (multiple) — 多文件选择 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Dialog.open (multiple)" 按钮 2. 在选择器中选择多个文件 3. 点击确认 | ① 弹出系统文件选择器 ② UI 显示所有选中文件的路径列表（字符串数组） ③ 数组长度 ≥ 2 | `open({ multiple: true })` |
| plugin | dialog | save/基础 | Dialog.save — 保存文件对话框 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Dialog.save" 按钮 2. 在保存对话框中输入文件名 3. 点击保存 | ① 弹出系统保存文件对话框 ② 默认文件名为 `test.txt` ③ 确认后 UI 显示所选保存路径 | `save({ defaultPath: 'test.txt' })` |
| plugin | dialog | confirm/基础 | Dialog.confirm — Ok/Cancel 确认 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Dialog.confirm" 按钮 2. 分别点击 OK 和 Cancel | ① 弹出对话框，标题 "Confirm Action"，warning 图标 ② 包含 OK/Cancel 两个按钮 ③ 点击 OK → 返回 `true` ④ 点击 Cancel → 返回 `false` | `confirm('...', { title: 'Confirm Action', kind: 'warning' })` |
| plugin | dialog | message/info | Dialog.message (info) — 信息对话框 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Dialog.message (info)" 按钮 2. 查看弹出的对话框 3. 点击 OK | ① 弹出消息对话框 ② 标题为 "Info Dialog" ③ 显示 info 类型图标 ④ 包含 "OK" 按钮 ⑤ 点击 OK 后对话框关闭 | `message('...', { title: 'Info Dialog', kind: 'info' })` |
| plugin | dialog | message/warning | Dialog.message (warning) — 警告对话框 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Dialog.message (warning)" 按钮 2. 查看弹出的对话框 3. 点击 OK | ① 弹出消息对话框 ② 标题为 "Warning Dialog" ③ 显示 warning 类型图标 ④ 包含 "OK" 按钮 ⑤ 点击 OK 后对话框关闭 | `message('...', { title: 'Warning Dialog', kind: 'warning' })` |
| plugin | dialog | message/error | Dialog.message (error) — 错误对话框 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Dialog.message (error)" 按钮 2. 查看弹出的对话框 3. 点击 OK | ① 弹出消息对话框 ② 标题为 "Error Dialog" ③ 显示 error 类型图标 ④ 包含 "OK" 按钮 ⑤ 点击 OK 后对话框关闭 | `message('...', { title: 'Error Dialog', kind: 'error' })` |

---

## 五、plugin-os（平台检测）手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| plugin | os | platform/基础 | platform() — 平台标识返回值 | **T0** | 应用已启动，进入 OS/Platform 页面或控制台 | 1. 点击`OS info(platform/type/version)`按钮 2. 调用 `platform()` API | ① `platform()` 返回 `"ohos"`（非 `"linux"`） ② 前端 TypeScript 类型包含 `'ohos'` | 编译期通过 `cfg(target_env = "ohos")` 覆盖 `std::env::consts::OS` |
| plugin | os | type/基础 | type() — OS 类型返回值 | **T0** | 应用已启动 | 1. 调用 `type()` API 2. 观察返回值 | ① `type()` 返回 `"ohos"`（非 `"linux"`） ② 前端 TypeScript `OsType` 类型包含 `'ohos'` | `OsType::Ohos` 在 `cfg(target_env = "ohos")` 下优先于 Linux 分支 |
| plugin | os | version/基础 | version() — 版本号返回值 | **T1** | 应用已启动 | 1. 调用 `version()` API 2. 观察返回值 | ① `version()` 返回 `"0.0.0"` ② 不崩溃、不报错 | OHOS 上 `os_info` 不支持，使用 `Version::Semantic(0,0,0)` 占位 |
| plugin | os | family/基础 | family() — 系统家族返回值 | **T1** | 应用已启动 | 1. 调用 `family()` API | `family()` 返回 `"unix"` | OHOS 属于 unix 家族，无需覆盖 |
| plugin | os | arch/基础 | arch() — 架构返回值 | **T1** | 应用已启动 | 1. 调用 `arch()` API | `arch()` 返回 `"aarch64"` | OHOS 目标为 aarch64，无需覆盖 |
| plugin | os | eol/基础 | eol() — 行尾标记返回值 | **T1** | 应用已启动 | 1. 调用 `eol()` API | `eol()` 返回 `"\n"` | OHOS 非 Windows，使用 POSIX 行尾 |

---

## 六、Autostart（开机自启动）手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | autostart | enable/跳转设置 | enable() — 跳转到应用启动管理页面 | **T0** | 应用已启动，进入 Tests 页面，滚动到 Manual Tests 区域 | 1. 找到 "Autostart Manual Tests" 分组 2. 点击 "enable() (opens settings)" 按钮 3. 观察应用是否跳转到系统设置页面 4. 在系统设置页面中找到当前应用（com.tauri.api） 5. 确认该应用旁有"自启动"开关 | ① 点击按钮后，应用无报错，Console 区输出 `enable() called. On OHOS: System "App launch management" settings page should open now.` ② 系统自动跳转到"应用启动管理"设置页面（bundleName: `com.huawei.hmos.settings`，URI: `pc_app_setup_settings`） ③ 设置页面中可见当前应用名称及其自启动开关 ④ 应用未崩溃、未卡死 | OHOS 平台限制：普通应用无法程序化开启自启动，只能引导用户到设置页面手动操作 |
| core | autostart | isEnabled/状态查询 | isEnabled() — 查询自启动状态 | **T0** | 应用已启动，进入 Tests 页面；设备 API ≥ 21 | 1. 找到 "Autostart Manual Tests" 分组 2. 点击 "isEnabled()" 按钮 3. 观察 Console 输出结果（应为 `false` 或 `true`，取决于当前设置） 4. 切换到系统设置 → 应用启动管理 → 找到当前应用 5. 手动开启自启动开关 6. 返回应用，再次点击 "isEnabled()" 按钮 7. 再次切换到系统设置，手动关闭自启动开关 8. 返回应用，第三次点击 "isEnabled()" 按钮 | ① 步骤 2 后 Console 输出 `isEnabled() → <布尔值>`，并提示 `Verify: Go to Settings → App launch management` ② 步骤 6 后 Console 输出 `isEnabled() → true`（与步骤 5 手动开启一致） ③ 步骤 8 后 Console 输出 `isEnabled() → false`（与步骤 7 手动关闭一致） ④ 每次调用无报错、无超时（5s 内返回） | 需要 API 21+ 支持 `autoStartupManager.getAutoStartupStatusForSelf()`；API < 21 设备始终返回 `false` |
| core | autostart | disable/跳转设置 | disable() — 跳转到应用启动管理页面 | **T1** | 应用已启动，进入 Tests 页面 | 1. 找到 "Autostart Manual Tests" 分组 2. 点击 "disable() (opens settings)" 按钮 3. 观察应用是否跳转到系统设置页面 4. 确认设置页面中可见当前应用及其自启动开关 | ① 点击按钮后，应用无报错，Console 区输出 `disable() called. On OHOS: System "App launch management" settings page should open now.` ② 系统自动跳转到"应用启动管理"设置页面（与 enable() 相同的目标页面） ③ 设置页面中可见当前应用名称及其自启动开关（可手动关闭） | OHOS 平台限制：disable() 与 enable() 行为一致，都是跳转到设置页面，由用户手动操作 |
| core | autostart | 完整流程 | enable → 手动开启 → isEnabled → disable → 手动关闭 → isEnabled | **T1** | 应用已启动，进入 Tests 页面；设备 API ≥ 21 | 1. 点击 "enable() (opens settings)" 按钮 2. 系统跳转到设置页面，手动开启当前应用的自启动开关 3. 返回应用，点击 "isEnabled()" 按钮 4. 点击 "disable() (opens settings)" 按钮 5. 系统跳转到设置页面，手动关闭当前应用的自启动开关 6. 返回应用，点击 "isEnabled()" 按钮 | ① 步骤 3 Console 输出 `isEnabled() → true`（与步骤 2 手动开启一致） ② 步骤 6 Console 输出 `isEnabled() → false`（与步骤 5 手动关闭一致） ③ 整个 enable→check→disable→check 流程无报错、无崩溃 ④ 每次操作均在 5s 内完成 | 验证完整的用户操作流程：引导设置 → 手动操作 → 状态查询一致性 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Autostart | 2 | 2 | **4** |

---

## 七、Webview（WebView）手动用例

### 7.1 createPdf（PDF 生成）

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | webview | createPdf/默认 | Create PDF A4 — 默认 A4 尺寸生成 PDF | **T0** | 应用已启动；WebView 已加载页面 | 1. 滚动到 "Create PDF Manual Test" 区域 2. 点击 "Create PDF A4 (default)" 按钮 | ① 页面显示 `SUCCESS ✅` ② 设备 `/data/storage/el2/base/cache/test.pdf` 文件生成 ③ `hdc file recv` 拉取后可打开查看，内容为 A4 尺寸 | 默认配置: 8.27×11.69in, 无边距, 含背景 |
| core | webview | createPdf/自定义 | Create PDF Square — 正方形自定义尺寸 | **T1** | 应用已启动；WebView 已加载页面 | 1. 滚动到 "Create PDF Manual Test" 区域 2. 点击 "Create PDF Square (8.27×8.27)" 按钮 | ① 页面显示 `SUCCESS ✅` ② 设备 `/data/storage/el2/base/cache/test-square.pdf` 文件生成 ③ 拉取后打开，页面为正方形尺寸 | 验证 PdfConfig 透传: width=8.27, height=8.27 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Webview — createPdf | 1 | 1 | **2** |

---

## 八、WebView User-Agent 自定义 手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | webview | userAgent/custom | 自定义 User-Agent 设置验证 | **T0** | 应用已启动，进入 Tests 页面 | 1. 滚动到 "WebView User-Agent" 测试分组 2. 点击 "userAgent (custom)" 按钮 3. 观察新打开的窗口中 useragent-test.html 页面显示结果 | ① 新窗口成功打开并加载 `useragent-test.html` 页面 ② 页面显示绿色 "✓ PASS: Custom UA detected" ③ `navigator.userAgent` 包含 `MyApp/1.0 Tauri/2.0` | OHOS 平台通过 `WebviewController.setCustomUserAgent()` 实现；在 `onControllerAttached` 回调中设置；Rust 侧通过 `eval_with_callback` 将 UA 输出到 hilog |
| core | webview | userAgent/default | 默认 User-Agent 验证 | **T1** | 应用已启动，进入 Tests 页面 | 1. 滚动到 "WebView User-Agent" 测试分组 2. 点击 "userAgent (default)" 按钮 3. 观察新打开的窗口中 useragent-test.html 页面显示结果 | ① 新窗口成功打开并加载 `useragent-test.html` 页面 ② 页面显示蓝色 "ℹ System default UA (no custom UA set)" ③ `navigator.userAgent` 为系统默认值（如 `Mozilla/5.0 (Phone; OpenHarmony 5.0) AppleWebKit/537.36 ...`） | 未提供自定义 User-Agent 时，WebView 使用系统默认值 |
| core | webview | userAgent/多窗口隔离 | 多窗口 User-Agent 隔离验证 | **T1** | 应用已启动，进入 Tests 页面 | 1. 点击 "userAgent (multi-window)" 按钮 2. 观察两个新打开的窗口中 useragent-test.html 页面分别显示的结果 3. 可通过 `hdc shell "hilog \| grep UA-TEST"` 查看 Rust 侧日志 | ① 两个新窗口成功打开 ② 窗口 A 页面显示 "Multi-window UA detected" ③ 窗口 B 页面显示 "Multi-window UA detected" ④ hilog 中两个窗口的 `navigator.userAgent` 值分别包含各自的自定义标识 | 验证 OHOS 平台上多个 WebView 实例的 User-Agent 设置互不干扰 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| WebView User-Agent | 1 | 2 | **3** |

---

## 九、RunEvent（生命周期事件）手动用例

> **背景**: Phase 1 修复了 `ExitRequested`/`Exit` 在 `LoopDestroyed` 路径上的触发；Phase 2 修复了子窗口 `Destroyed` 事件缺失和 `WindowsStore` 清理问题。
>
> **日志监控命令**: `hdc shell hilog | grep tauritest`

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | runevent | ExitRequested/LoopDestroyed | 系统关闭应用 — ExitRequested + prevent_exit | **T0** | 应用已启动，打开 DevEco Studio 观察日志，关键词runevent | 1. 关闭应用 2. 观察日志输出 | ① 日志依次出现 `LoopDestroyed received` → `ExitRequested, code=None` → `prevent_exit() called` → `Exit` ② 应用仍然退出（`LoopDestroyed` 时系统已开始销毁，`prevent_exit()` 无法阻止） | 验证 Phase 1：LoopDestroyed handler 先触发 ExitRequested 再触发 Exit；OHOS 平台限制：prevent_exit 仅通知清理，无法阻止退出 |
| core | runevent | ExitRequested/防重复 | ExitRequested 防重复触发 | **T1** | 应用已启动，打开 DevEco Studio 观察日志，关键词runevent；已创建多个子窗口 | 1. 逐个关闭子窗口（每个观察日志） 2. 关闭最后一个窗口（主窗口） 3. 统计 `ExitRequested` 出现次数 | ① 每个子窗口关闭时：`CloseRequested` → `Destroyed` ② 最后一个窗口关闭时：`ExitRequested` **仅一次** ③ 随后 LoopDestroyed 时**不再重复** ExitRequested，直接发送 `Exit` | 验证 `ExitState(AtomicBool)` 防重复机制 |
| core | runevent | Resumed/跨平台遗留 | Resumed 事件 — 不触发（预期行为） | **T1** | 自动测试报告已生成 | 1. 查看 Test #29 `RunEvent::Resumed fires on startup` 结果 | ① 状态为 ❌ ② 预期失败，跨平台遗留问题 | 不在本次修复范围内 |
| core | runevent | Opened/深度链接 | Opened 事件 — 深度链接触发 | **T1** | 应用已启动，打开 DevEco Studio 观察日志 | 1. 执行 `hdc shell aa start -a EntryAbility -b com.tauri.api -U myapp://test/path` 2. 观察日志输出和 UI 响应 | ① 日志出现 `[RunEvent] Opened, urls=["myapp://test/path"]` ② UI 显示深度链接信息（如有处理逻辑） | 验证 Phase 2：OHOS 平台 Opened 事件已启用（代码 511-515 行），通过深度链接触发 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| RunEvent（生命周期事件） | 1 | 3 | **4** |

---

## 十、Transparent（透明窗口）手动用例

> **背景**: OHOS 平台 Web 引擎渲染表面不支持透明穿透，主窗口设置 `transparent: true` 后 Web 内容区仍不透明（详见 `doc/ohos-main-window-transparent-analysis.md`）。仅 Float 子窗口（`transparent: true` + `decorations: false`）可实现完整穿透效果。
>
> **测试入口**: `examples/api` 应用 → TransparencyTest 页面

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | transparent | float-window/透明+无边框 | 创建透明无边框 Float 子窗口 | **T0** | 应用已启动，进入 TransparencyTest 页面 | 1. 点击 "创建透明无边框窗口" 按钮 2. 观察新弹出的子窗口外观 3. 验证窗口是否可穿透看到桌面内容 4. 点击窗口内关闭链接关闭子窗口 | ① 新窗口弹出，无标题栏（`decorations: false`） ② 窗口背景透明，可穿透看到桌面内容（`transparent: true`） ③ 窗口内显示半透明黑色卡片，标题 "✨ Transparent + Borderless"，文字 `decorations: false + transparent: true` ④ 窗口底部状态栏显示 `isDecorated: false` ⑤ 点击关闭链接后窗口正常关闭 | Float 子窗口类型；`WindowMode.Float` + `transparent(true)` + `decorations(false)`；内部分配 `window_id = transparency_test_<timestamp>` |
| core | transparent | float-window/仅透明有边框 | 创建透明有边框 Float 子窗口 | **T1** | 应用已启动，进入 TransparencyTest 页面 | 1. 点击 "创建透明有边框窗口" 按钮 2. 观察新弹出的子窗口外观 3. 确认窗口有标题栏、背景透明效果可见 4. 点击窗口内关闭链接关闭子窗口 | ① 子窗口有标题栏（`decorations: true` 默认） ② 窗口内容区背景透明，可穿透看到桌面 ③ 窗口内显示 "🪟 Transparent Window" 卡片，底部状态栏显示 `isDecorated: true` ④ 点击关闭链接后窗口正常关闭 | 验证 `transparent: true` 单独使用（不加 `decorations: false`）时 OHOS 表现；标题栏由系统渲染不受 transparent 影响 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Transparent（透明窗口） | 1 | 1 | **2** |

---

## 十一、on_new_window（新窗口拦截）手动用例

> **背景**: OHOS 平台通过 ArkWeb `onWindowNew` 事件拦截 `window.open()` / `target="_blank"` 等新窗口请求，Rust 侧 `on_new_window` handler 可返回 Allow（弹出 dialog）或 Deny（阻止）。
>
> **测试入口**: `examples/api` 应用 → Tests 页面 → Manual Tests 区域

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | on_new_window | Allow/弹窗关闭 | Allow dialog 关闭按钮验证 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "on_new_window: Allow dialog has close button (manual)" 2. 观察弹窗外观 3. 点击标题栏 ✕ 按钮 | ① 弹出非模态对话框，标题栏显示 URL ② 标题栏右上角有 ✕ 关闭按钮 ③ 点击 ✕ 对话框关闭 ④ 点击对话框内嵌 Web 组件加载对应 URL | `promptAction.openCustomDialog` + `setTimeout` 延迟打开避免阻塞事件循环 |
| core | on_new_window | Deny/无弹窗 | Deny 模式阻止弹窗验证 | **T1** | 应用已启动，进入 Tests 页面 | 1. 点击 "on_new_window: Deny prevents dialog (manual)" 2. 观察屏幕 | ① 不弹出任何对话框 ② 页面保持不变，无导航跳转 ③ hilog 可见 `DENY` 日志 | `setWebController(null)` 阻止新窗口 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| on_new_window（新窗口拦截） | 1 | 1 | **2** |

---

## 十二、Notification（通知）手动用例

> **测试入口**: `examples/api` 应用 → Tests 页面 → **Notification Manual Tests** 区域
>
> **自动测试已覆盖**: `isPermissionGranted`、`createChannel+channels`、`removeChannel`、`cancel+cancelAll`、`pending+active`、`sendNotification`、`sendWithChannel` 共 7 个自动测试已在 `plugins.ts` 中，每次构建自动运行。
>
> **以下 3 个用例需要人眼确认通知中心的视觉显示**，已集成为 Tests 页面的按钮：

| 一级场景 | 二级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|------|
| plugin | notification | Send Notification — 通知中心视觉确认 | **T0** | 应用已启动，通知权限已授予 | 1. 进入 Tests 页面，滚动到 "Notification Manual Tests" 区域 2. 点击 **"Send Notification"** 按钮 3. 点击屏幕右上角系统通知图标，打开通知中心 | ① 结果区域显示 `sendNotification() 调用成功` ② 系统通知中心（屏幕右下角系统托盘🔔图标）出现通知，标题 "Tauri 手动测试"，内容 "如果你在通知中心看到这条消息，测试通过！" ③ 点击通知后通知消失 | 自动测试只验证 API 不报错，通知是否真正显示必须人眼确认 |
| plugin | notification | Send With Channel — 渠道通知视觉确认 | **T1** | 应用已启动，通知权限已授予 | 1. 点击 **"Send With Channel"** 按钮 2. 打开系统通知中心 | ① 结果区域显示 `createChannel() + sendNotification(channelId) 调用成功` ② 屏幕右下角出现通知，标题 "渠道通知测试"| 按钮自动创建渠道 `manual-test-ch` 并通过该渠道发送 |
| plugin | notification | Request Permission — 系统弹窗确认 | **T1** | **需卸载重装应用**（权限弹窗仅首次弹出） | 1. 卸载应用：`hdc shell bm uninstall -n com.tauri.api`（首次执行不用） 2. 重新构建安装 3. 点击 **"Request Permission"** 按钮 | ① 系统弹出通知权限授权对话框 ② 点击"允许"后结果区域显示 `requestPermission() → "granted"` ③ 再次点击不再弹窗 | 此测试需要干净环境，日常回归可跳过 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Notification manual（手动测试） | 1 | 2 | **3** |

---

## 十三、Single-Instance（单实例）手动用例

> **前置条件**: example app 已集成 `tauri-plugin-single-instance`，callback 中通过 `log::info!("[single-instance] callback fired! args={:?}, cwd={:?}", args, cwd)` 输出日志。
>
> **验证方法**: 在宿主机执行 `hdc shell` 命令触发二次启动，通过 `hilog` 观察 callback 是否触发。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | single-instance | 首次启动 | App Normal Launch — 首次启动不触发 callback | **T0** | 设备已连接；app 未运行 | 1. `hdc shell hilog -r`（清空日志） 2. 启动 app（点击图标或 `hdc shell aa start -a EntryAbility -b com.tauri.api`） 3. `hdc shell "hilog -x \| grep single-instance"` | hilog 中**无** `[single-instance] callback fired` 日志输出；app 正常启动显示主界面 | 首次启动走 `onCreate` 路径，不触发 `onNewWant` |
| core | single-instance | 二次启动 | Second Launch Callback — 再次启动触发 callback | **T0** | app 已在运行 | 1. `hdc shell hilog -r`（清空日志） 2. `hdc shell "aa start -a EntryAbility -b com.tauri.api -U 'tauri://test'"` 3. `hdc shell "hilog -x \| grep single-instance"` | ① hilog 输出 `[single-instance] callback fired! args=["tauri://test", "{...}"], cwd=""` ② app 回到前台 ③ 不会创建新的 app 实例 | OHOS 默认 `launchType: singleton`，OS 层面阻止新实例 |
| core | single-instance | 参数传递 | Want Parameters — 二次启动携带 URI | **T0** | app 已在运行 | 1. `hdc shell hilog -r` 2. `hdc shell "aa start -a EntryAbility -b com.tauri.api -U 'myapp://action?key=value'"` 3. `hdc shell "hilog -x \| grep single-instance"` | ① args 第一个元素为 `"myapp://action?key=value"`（want.uri） ② args 第二个元素为 JSON 字符串，包含系统注入的 want.parameters（具体字段因 API 版本和设备而异，验证重点为非空 JSON 字符串） ③ cwd 为空字符串 `""` | `aa start -U` 仅设置 want.uri，want.parameters 由系统自动注入 |
| core | single-instance | 无 URI 启动 | Second Launch Without URI — 无 URI 二次启动 | **T1** | app 已在运行 | 1. `hdc shell hilog -r` 2. `hdc shell "aa start -a EntryAbility -b com.tauri.api"` 3. `hdc shell "hilog -x \| grep NativeAbility"` 4. `hdc shell "hilog -x \| grep single-instance"` | ① `hilog \| grep NativeAbility` 有 `onNewWant - uri: , parametersJson.length: <N>` 日志（URI 为空，length > 0） ② `hilog \| grep single-instance` 有 `[single-instance] callback fired!` 日志，args 仅包含系统注入的 want.parameters JSON（空 URI 被过滤） | 与 macOS/Windows 行为对齐：第二次启动无论有无参数，callback 均触发 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Single-Instance（单实例） | 3 | 1 | **4** |

---

## 十四、Predefined Multi-Window（预定义操作多窗口支持）手动用例

> **背景**: 修复 predefined menu 操作在多窗口场景下的目标窗口解析：hide/close/minimize 语义修正、showAll/bringAllToFront 恢复应用、剪贴板/编辑操作使用目标窗口 webview controller、onTouch 迁移到页面根容器。
>
> **测试入口**: `examples/api` 应用，需创建 Full Test Tray 后操作。涉及左键点击托盘图标的用例需先清空 QuickOperation abilityName。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | predefined-multi-window | clipboard/copy | Tray Copy 子窗口 — 复制子窗口选中文本 | **T0** | 应用已启动；已创建子窗口（如 Hello World）；子窗口有可选择的文本 | 1. 在子窗口中选中一段文本 2. 右键点击状态栏托盘图标打开菜单 3. 点击 Copy 4. 在主窗口或其他位置粘贴验证 | ① 粘贴得到的文本为子窗口中选中的文本 ② 不是主窗口的文本 ③ hilog 无 `Clipboard copy failed` 错误 | 验证：剪贴板操作使用目标窗口的 webview controller |
| core | predefined-multi-window | clipboard/cut | Tray Cut 子窗口 — 剪切子窗口选中文本 | **T1** | 应用已启动；已创建子窗口；子窗口有可编辑的文本输入框 | 1. 在子窗口的输入框中选中一段文本 2. 右键点击托盘图标打开菜单 3. 点击 Cut 4. 观察子窗口输入框 5. 在其他位置粘贴验证 | ① 子窗口输入框中选中的文本被删除 ② 粘贴得到的文本为被剪切的文本 | 验证 Cut 操作在目标窗口 webview 上执行 JS |
| core | predefined-multi-window | clipboard/selectAll | Tray SelectAll 子窗口 — 全选子窗口内容 | **T1** | 应用已启动；已创建子窗口；子窗口有文本内容 | 1. 确保子窗口有焦点 2. 右键点击托盘图标打开菜单 3. 点击 SelectAll 4. 观察子窗口文本选中状态 | ① 子窗口中所有文本被选中 ② 主窗口的文本未被选中 | 验证 SelectAll 操作在目标窗口 webview 上执行 |
| core | predefined-multi-window | clipboard/copy | Tray Copy 主窗口 — 复制主窗口选中文本 | **T1** | 应用已启动；主窗口有可选择的文本 | 1. 点击主窗口使其成为焦点 2. 在主窗口中选中一段文本 3. 右键点击托盘图标打开菜单 4. 点击 Copy 5. 在其他位置粘贴验证 | ① 粘贴得到的文本为主窗口中选中的文本 | 验证 fallback 到主窗口 controller 仍然正常工作 |
| core | predefined-multi-window | hide-restore | Menu Hide → 托盘左键恢复 | **T0** | 应用已启动；已创建 Full Test Tray；QuickOperation 的 abilityName 已清空（点击 "Disable QuickOp" 或将 abilityName 置空），确保左键点击托盘图标触发 icon click 事件 | 1. 右键点击托盘图标打开菜单 2. 点击 Hide 3. 确认应用隐藏到后台 4. 左键点击状态栏托盘图标 | ① 步骤 3 应用隐藏，所有窗口不可见 ② 步骤 4 应用恢复到前台，窗口重新可见 ③ hilog 输出 `startAbility succeeded` | 验证：hide → hideAbility() + 托盘 startAbility() 恢复；QuickOperation abilityName 必须清空，否则左键点击打开 QuickOp 面板而非触发恢复 |
| core | predefined-multi-window | hide-restore | Menu Close 主窗口 → 托盘左键恢复 | **T0** | 应用已启动；已创建 Full Test Tray；QuickOperation 的 abilityName 已清空 | 1. 点击主窗口使其成为焦点 2. 右键点击托盘图标打开菜单 3. 点击 CloseWindow 4. 确认应用隐藏到后台 5. 左键点击状态栏托盘图标 | ① 步骤 4 应用隐藏（主窗口 close 等价于 hideAbility），所有窗口不可见 ② 步骤 5 应用恢复到前台 ③ hilog 无 crash 或 freeze | 验证：closeWindow(id=0) → hideAbility()；主窗口不可 destroyWindow（WindowStage 会失效） |
| core | predefined-multi-window | window-lifecycle | Menu Minimize — 最小化到最近任务 | **T1** | 应用已启动 | 1. 右键点击托盘图标打开菜单 2. 点击 Minimize | ① 窗口最小化到最近任务列表 ② 从最近任务列表点击可恢复应用 ③ 行为与修改前一致（未回归） | 验证：minimize 行为不变 |
| core | predefined-multi-window | window-lifecycle | Menu Quit — 应用退出 | **T1** | 应用已启动 | 1. 右键点击托盘图标打开菜单 2. 点击 Quit | ① 应用完全退出 ② 不在最近任务列表中 ③ 行为与修改前一致（未回归） | 验证：quit 使用 terminateSelf()，行为不变 |
| core | predefined-multi-window | icon-click | 前台点击托盘图标 — 无副作用 | **T1** | 应用已启动且在前台；已创建 Full Test Tray；QuickOperation 的 abilityName 已清空 | 1. 确保应用在前台显示 2. 左键点击状态栏托盘图标 | ① 应用保持在前台，无闪烁或抖动 ② 无异常行为 ③ hilog 无错误日志 | 验证：startAbility() 幂等安全，应用已在前台时不产生副作用 |
| core | predefined-multi-window | restore | Tray ShowAll — 隐藏后恢复应用 | **T0** | 应用已启动；已创建 Full Test Tray（含 ShowAll 菜单项） | 1. 右键点击托盘图标打开菜单 2. 点击 Hide 3. 确认应用隐藏 4. 右键点击托盘图标打开菜单 5. 点击 ShowAll | ① 步骤 3 应用隐藏到后台 ② 步骤 5 应用恢复到前台 ③ 所有窗口可见 | 验证：showAll → showAbility() + 遍历窗口 showWindow() |
| core | predefined-multi-window | restore | Tray BringAllToFront — 隐藏后恢复应用 | **T0** | 应用已启动；已创建 Full Test Tray（含 BringAllToFront 菜单项） | 1. 右键点击托盘图标打开菜单 2. 点击 Hide 3. 确认应用隐藏 4. 右键点击托盘图标打开菜单 5. 点击 BringAllToFront | ① 步骤 3 应用隐藏到后台 ② 步骤 5 应用恢复到前台 ③ 所有窗口可见 | 验证：bringAllToFront 在 OHOS 上等价于 showAll（无跨应用置顶权限） |
| core | predefined-multi-window | restore | BringAllToFront 子窗口恢复 | **T1** | 应用已启动；已创建子窗口；子窗口处于最小化状态 | 1. 确保主窗口可见 2. 右键点击托盘图标打开菜单 3. 点击 BringAllToFront | ① 主窗口保持可见 ② 被最小化的子窗口恢复显示 | 验证：遍历 WindowManager 所有窗口调用 showWindow() 可恢复最小化子窗口 |
| core | predefined-multi-window | restore | 前台点击 ShowAll — 无副作用 | **T1** | 应用已启动且在前台；已创建 Full Test Tray（含 ShowAll 菜单项） | 1. 确保应用在前台，所有窗口可见 2. 右键点击托盘图标打开菜单 3. 点击 ShowAll | ① 应用保持在前台，无闪烁或异常 ② 所有窗口保持可见 ③ hilog 无错误 | 验证：showAbility() 幂等安全，showWindow() 对已可见窗口不产生副作用 |
| core | predefined-multi-window | clipboard/copy | MenuBar Copy 主窗口 — 通过 MenuBar 触发 Copy | **T0** | 应用已启动；主窗口有可选择的文本 | 1. 点击主窗口 MenuBar 打开菜单 2. 点击 Edit → Copy 3. 在其他位置粘贴验证 | ① 粘贴得到的文本为主窗口中选中的文本 ② 操作目标为主窗口 webview | 验证：Window Menu Bar 路径 targetWindowId 有值，直接操作菜单所属窗口 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Predefined Multi-Window（预定义操作多窗口支持） | 6 | 8 | **15** |

---

## 十五、Sentry（错误追踪）手动用例

> **测试应用**: `examples/api`（主测试应用）
>
> **前提**: sentry 插件已注册（`tauri_plugin_sentry::init`），DSN 已配置；设备已联网
>
> **测试入口**: TestRunner.svelte → "Sentry (错误追踪) Manual Tests" 区域
>
> **验证方式**: 优先通过自动测试报告 + 设备日志判断，Sentry 仪表盘为可选增强验证

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | sentry | JS Error 捕获 | JS Error Capture — WebView JS 异常捕获 | **T0** | 应用已启动；点击 "JS Error Capture" 按钮 | 1. 打开 DevEco Studio 检查日志 2. 点击 "JS Error Capture" 按钮 | ① 日志 输出 `[Sentry Test] Caught error: Error: OHOS test error from examples/api` ② `[ManualTest] Completed: sentryJsError` 确认测试完成 | 若 js_init_script 未注入，JS error 仍会被 WebView console.error 记录；注入验证：在 WebView 中执行 `typeof Sentry !== 'undefined'` |
| core | sentry | Rust Panic 捕获 | Rust Panic Capture — Rust panic 导致 app 崩溃 | **T1** | 应用已启动；点击 "Rust Panic (may crash)" 按钮 | 1.1. 打开 DevEco Studio 检查日志 2. 点击 "Rust Panic (may crash)" 按钮 3. 等待 2 秒，app 崩溃退出 4. 查看crash日志 | ① app 崩溃退出（预期行为，SIGABRT） ② cppcrash 日志 `Reason` 行包含 `Signal:SIGABRT(SI_TKILL)` ③ 栈回溯中 `libapi_lib.so` 出现在顶层帧（Rust panic → abort） ④ 崩溃时间与按钮点击时间吻合 | 仅在DEBUG模式下支持，sentry-panic crate 在 panic 时捕获事件并尝试上报；panic 导致进程退出需重启应用；breadcrumb/envelope/rust_breadcrumb 的 IPC 通路由自动测试 #74-#76 覆盖 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Sentry（错误追踪） | 1 | 1 | **2** |

---

## 十六、Unstable Feature（窗口与 Webview 解耦）手动用例

> **背景**: Phase 1 补齐 wry OHOS `set_bounds`/`set_visible`/`bounds` 实现 + ProxyJsHelper pending path 修复；Phase 2 添加 Reparent OHOS 安全返回防死锁；Phase 3 移除 `add_child` 的 OHOS 排除。
>
> **测试入口**: TestRunner.svelte → "Unstable Feature (窗口与 Webview 解耦) Manual Tests" 区域

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | unstable | phase2/reparent | webview.reparent returns error — 防死锁验证 | **T0** | 应用已启动，进入 TestRunner 页面 | 1. 找到 `reparent returns error (no deadlock)` 2. 点击运行 3. 观察测试是否在 5 秒内完成 | ① 测试状态 PASS ② 查看日志 `webview.reparent(window)` 返回 Error ③ 不卡住（无 timeout） | 验证 Phase 2：`#[cfg(target_env = "ohos")]` Reparent handler 调用 `tx.send(Err(...))` 解除 `rx.recv()` 阻塞 |
| core | unstable | phase2/reparent | webview operations after failed reparent — 无级联死锁 | **T1** | 应用已启动 | 1. 找到 `reparent cascade check` 2. 点击运行 | ① 测试状态 PASS ② 查看日志 `webview.size()` 正常返回非零值 | 验证 reparent 失败后 `current_window_id` Mutex 锁被释放 |
| core | unstable | phase3/multi-webview | webview.create_webview — multi-webview 创建验证 | **T0** | 应用已启动；**Cargo.toml 需启用 `unstable` feature** | 1. 找到 `create_webview (multi-webview)` 2. 点击运行 3. 观察是否出现 300x200 子 webview 4. 等待 1 秒后子 webview 自动关闭 | ① 测试状态 PASS ② 子 webview 在 (50,50) 位置出现，显示 "Child Webview" ③ 1 秒后子 webview 关闭 | **需要 `unstable` feature**；验证 `add_child` + `dispose_child` 完整链路 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| **合计** | **2** | **1** | **3** |

---

## 十七、用例统计

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Tray（系统托盘） | 5 | 6 | **11** |
| Menu — MenuBar | 9 | 14 | **23** |
| Menu — PopupMenu | 3 | 3 | **6** |
| Clipboard — writeImage | 4 | 3 | **7** |
| Dialog | 7 | 0 | **7** |
| plugin-os（平台检测） | 2 | 4 | **6** |
| Autostart（开机自启动） | 2 | 2 | **4** |
| Webview — createPdf | 1 | 1 | **2** |
| WebView User-Agent | 1 | 2 | **3** |
| RunEvent（生命周期事件） | 1 | 3 | **4** |
| Transparent（透明窗口） | 1 | 1 | **2** |
| on_new_window（新窗口拦截） | 1 | 1 | **2** |
| Single-Instance（单实例） | 3 | 1 | **4** |
| WebView webPageSnapshot（网页截图） | 1 | 0 | **1** |
| Predefined Multi-Window（预定义操作多窗口支持） | 6 | 8 | **14** |
| Notification（通知） | 1 | 2 | **3** |
| Sentry（错误追踪） | 1 | 1 | **2** |
| Unstable Feature（窗口与 Webview 解耦） | 2 | 1 | **3** |
| **合计** | **51** | **53** | **104** |

