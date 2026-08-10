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

### 7.2 Cookie（Cookie 管理真实生效）

> **背景**: 自动用例（cookie_test）只验证 WebCookieManager API 契约（configCookieSync 写入 → fetchCookieSync 读回）。本手动用例补全"set_cookie 写入的 cookie 真实随请求发送到服务端"的真实浏览行为。
>
> **日志监控命令**: `hdc shell hilog | grep tauritest`

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | webview | cookie/真实生效 | Cookie Live (httpbin echo) — set_cookie 后服务端收到 | **T0** | 应用已启动；设备可访问 `https://httpbin.org` | 1. 滚动到 "webview.cookie Manual Tests" 区域 2. 点击 "Cookie Live (httpbin echo)" 按钮 3. 观察弹出的子窗口中 `https://httpbin.org/cookies` 的 JSON 响应 | ① 子窗口成功打开并加载 `https://httpbin.org/cookies` ② JSON 响应包含 `"tauri_test_cookie": "ManualTest123"`（证明 `set_cookie` 写入的 cookie 真实发送到服务端） | 验证 `set_cookie`（`WebCookieManager.configCookieSync`）端到端真实生效；cookie 域 `httpbin.org`、Path `/`、值 `ManualTest123` 由 `cookie_manual_test` 命令预设。注：子窗口为外部页（无 Tauri 工具栏），仅验证首次加载的 cookie 回显，不做刷新/持久化验证 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Webview — Cookie | 1 | 0 | **1** |

### 7.3 DevTools（调试访问开关）

> **背景**: wry OHOS 的 `open_devtools`/`close_devtools` 映射为 `WebviewController.setWebDebuggingAccess` 全局开关，`is_devtools_open` 返回 ArkTS 侧自跟踪状态（OHOS 无 getter）。三方法受 `#[cfg(any(debug_assertions, feature="devtools"))]` 门控，**仅在 devtools feature 构建可测**（标准 release 不编译）。本用例在 devtools 构建下验证 open→true、close→false 的 toggle 行为。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | webview | devtools/toggle | DevTools (open/is_open/close) — 调试访问开关 toggle | **T1** | ① 用 devtools feature 构建并部署：临时把 `examples/api/src-tauri/Cargo.toml` 的 `prod` 改为 `["tauri/custom-protocol", "devtools"]`（或 build-ohos.sh 加 `--features prod,devtools`），跑 `run-tests.sh` 部署；验证后回退该改动 ② 设备屏幕已唤醒（`hdc shell "power-shell setmode 602"`）| 1. 打开 app，进入 Tests 页 2. 滚动到 "webview.devtools Manual Test (OHOS only, needs devtools build)" 区域 3. 点击 "DevTools (open/is_open/close)" 按钮 | 屏幕显示如下即成功：`devtools_test: PASS ✅` 换行 `initial=<true|false>, after_open=true, after_close=false`。关键判定：`after_open=true`（open_devtools 后调试访问开）且 `after_close=false`（close_devtools 后关）。若显示 `FAIL ❌` 或 `devtools feature not enabled` 则失败 | `initial` **有状态、非判定项**：`webDebuggingEnabled` 是进程级全局变量，跨调用持久——首次调用（app 刚启动无 open/close 历史）反映 init 标志（tauri 默认 devtools=true → 通常 true）；若之前已跑过 close_devtools（如自动用例 test 53 先跑）则 initial=false。判定只看 after_open/after_close；标准 release 构建（未加 devtools feature）点击提示 "devtools feature not enabled"，属预期（dormant）|

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Webview — DevTools | 0 | 1 | **1** |

### 7.4 全屏无黑边（set_bounds resize 传播回归防护）

> **背景**: 修复了主 webview `set_bounds` 全屏黑边问题。根因是 tao 不传播 `ContentRectChange` 为 `Resized` 事件 + `WindowIdStore` 的 ZST key 被子窗口覆盖。修复后 set_bounds 在每次窗口 resize 时被正确调用，Web 组件按新尺寸重渲染。本用例防护此回归。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | webview | fullscreen/no-black-bars | Fullscreen No Black Bars — 全屏无黑边 | **T0** | 应用已启动 | 1. 将应用窗口最大化或全屏 2. 观察屏幕四个方向是否有黑边 3. 恢复窗口化 4. 再次观察 | ① 全屏时 Web 内容填满整个窗口，四方向无黑边 ② 窗口化时 Web 内容填满窗口，无黑边 ③ 若出现黑边说明 tao ContentRectChange 传播 / WindowIdStore or_insert / wry set_bounds 链断裂 | 防护三修复链：tao 传播 ContentRectChange→Resized + tauri-runtime-wry or_insert + wry set_bounds 移除 cache-only |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Webview — Fullscreen | 1 | 0 | **1** |

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

> **背景**: 修复了 `ExitRequested`/`Exit` 在 `LoopDestroyed` 路径上的触发；修复了子窗口 `Destroyed` 事件缺失和 `WindowsStore` 清理问题。
>
> **日志监控命令**: `hdc shell hilog | grep tauritest`

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | runevent | ExitRequested/LoopDestroyed | 系统关闭应用 — ExitRequested + prevent_exit | **T0** | 应用已启动，打开 DevEco Studio 观察日志，关键词runevent | 1. 关闭应用 2. 观察日志输出 | ① 日志依次出现 `LoopDestroyed received` → `ExitRequested, code=None` → `prevent_exit() called` → `Exit` ② 应用仍然退出（`LoopDestroyed` 时系统已开始销毁，`prevent_exit()` 无法阻止） | 验证：LoopDestroyed handler 先触发 ExitRequested 再触发 Exit；OHOS 平台限制：prevent_exit 仅通知清理，无法阻止退出 |
| core | runevent | ExitRequested/防重复 | ExitRequested 防重复触发 | **T1** | 应用已启动，打开 DevEco Studio 观察日志，关键词runevent；已创建多个子窗口 | 1. 逐个关闭子窗口（每个观察日志） 2. 关闭最后一个窗口（主窗口） 3. 统计 `ExitRequested` 出现次数 | ① 每个子窗口关闭时：`CloseRequested` → `Destroyed` ② 最后一个窗口关闭时：`ExitRequested` **仅一次** ③ 随后 LoopDestroyed 时**不再重复** ExitRequested，直接发送 `Exit` | 验证 `ExitState(AtomicBool)` 防重复机制 |
| core | runevent | Resumed/跨平台遗留 | Resumed 事件 — 不触发（预期行为） | **T1** | 自动测试报告已生成 | 1. 查看 Test #29 `RunEvent::Resumed fires on startup` 结果 | ① 状态为 ❌ ② 预期失败，跨平台遗留问题 | 不在本次修复范围内 |
| core | runevent | Opened/深度链接 | Opened 事件 — 深度链接触发 | **T1** | 应用已启动，打开 DevEco Studio 观察日志 | 1. 执行 `hdc shell aa start -a EntryAbility -b com.tauri.api -U myapp://test/path` 2. 观察日志输出和 UI 响应 | ① 日志出现 `[RunEvent] Opened, urls=["myapp://test/path"]` ② UI 显示深度链接信息（如有处理逻辑） | 验证：OHOS 平台 Opened 事件已启用（代码 511-515 行），通过深度链接触发 |

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
| core | on_new_window | Create/真窗口 | Create real OS window 验证 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Create (real OS window)" 2. 观察 3. 验证窗口行为 | ① 弹出独立 OS 子窗口（非页内对话框）② 窗口加载目标 URL ③ 关闭子窗口不影响主应用 ④ 再次点击不弹对话框（setWebController(null)） | `NewWindowResponse::Create` → `WebviewWindowBuilder::build()` → `createOSWindow` → Float 子窗口 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| on_new_window（新窗口拦截） | 2 | 1 | **3** |

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

> **背景**: 补齐 wry OHOS `set_bounds`/`set_visible`/`bounds` 实现 + ProxyJsHelper pending path 修复；添加 Reparent OHOS 安全返回防死锁；移除 `add_child` 的 OHOS 排除。
>
> **测试入口**: TestRunner.svelte → "Unstable Feature (窗口与 Webview 解耦) Manual Tests" 区域

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | unstable | phase2/reparent | webview.reparent returns error — 防死锁验证 | **T0** | 应用已启动，进入 TestRunner 页面 | 1. 找到 `reparent returns error (no deadlock)` 2. 点击运行 3. 观察测试是否在 5 秒内完成 | ① 测试状态 PASS ② 查看日志 `webview.reparent(window)` 返回 Error ③ 不卡住（无 timeout） | 验证：`#[cfg(target_env = "ohos")]` Reparent handler 调用 `tx.send(Err(...))` 解除 `rx.recv()` 阻塞 |
| core | unstable | phase2/reparent | webview operations after failed reparent — 无级联死锁 | **T1** | 应用已启动 | 1. 找到 `reparent cascade check` 2. 点击运行 | ① 测试状态 PASS ② 查看日志 `webview.size()` 正常返回非零值 | 验证 reparent 失败后 `current_window_id` Mutex 锁被释放 |
| core | unstable | phase3/multi-webview | webview.create_webview — multi-webview 创建验证 | **T0** | 应用已启动；**Cargo.toml 需启用 `unstable` feature** | 1. 找到 `create_webview (multi-webview)` 2. 点击运行 3. 观察是否出现 300x200 子 webview 4. 等待 1 秒后子 webview 自动关闭 | ① 测试状态 PASS ② 子 webview 在 (50,50) 位置出现，显示 "Child Webview" ③ 1 秒后子 webview 关闭 | **需要 `unstable` feature**；验证 `add_child` + `dispose_child` 完整链路 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| **合计** | **2** | **1** | **3** |

---

## 十七、Global Shortcut（全局快捷键）手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| plugin | global-shortcut | 注册与触发 | Register Shortcut — 注册快捷键并物理键盘触发 | **T0** | 应用已启动；设备连接物理键盘；进入 Tests 页面底部 Global Shortcut Manual Tests 区域 | 1. 点击 "Register Ctrl+Shift+T" 按钮 2. 确认状态显示 "Registered: CommandOrControl+Shift+T" 3. 用物理键盘按下 Ctrl+Shift+T | ① 状态变为 "Triggered! id=xxx, state=Released" ② 控制台输出 `[global-shortcut] Shortcut triggered: id=xxx, state=Released` | OHOS 使用 inputConsumer API（API 14+），仅在 key-down 时触发 Pressed 回调；代码合成 Released 事件以匹配 global-hotkey 合约，UI 最终显示 Released；最多支持 2 个修饰键 |
| plugin | global-shortcut | 注销验证 | Unregister All — 注销后快捷键不再触发 | **T0** | 已注册 Ctrl+Shift+T 且已验证触发成功 | 1. 点击 "Unregister All" 按钮 2. 确认状态显示 "All shortcuts unregistered" 3. 用物理键盘再次按下 Ctrl+Shift+T | ① 状态不再变为 "Triggered" ② 快捷键已被注销，系统不再拦截该组合键 | 验证 inputConsumer.off() 精确注销，不影响其他应用的快捷键 |

---

## 十八、窗口聚焦与热键缩放 手动用例

> **背景**: 窗口聚焦（set_focus）和热键缩放（Ctrl+/-/=）需要人眼确认的手动测试。
>
> **测试入口**: `examples/api` 应用 → Tests 页面 → **Window Focus + Hotkey Zoom Manual Tests** 区域

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | 窗口聚焦 | 多窗口层级 | Window Focus 多窗口层级验证 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Window Focus" 创建子窗口 2. 手动将其他子窗口拖到该窗口上方 3. 再次点击 "Window Focus" | ① 首次点击创建 Float 子窗口 ② 再次点击调用 `setFocus()` → `raiseToAppTop()` ③ 窗口回到所有 Float 窗口最上方 | `Message::Task` 派发到主线程 → `focus_window(id)` → NAPI → `WindowManager.focusWindow` → `win.raiseToAppTop()` |
| core | 热键缩放 | Ctrl+/- | Ctrl+/- 缩放验证 | **T1** | 应用已启动，进入 Tests 页面 | 1. 点击 "Hotkey Zoom" 查看说明 2. 聚焦 webview 区域 3. 按 Ctrl + = 放大 4. 按 Ctrl + - 缩小 | ① 页面内容随快捷键放大/缩小 ② 缩放级别在 0.2~10 之间 | `zoom-hotkey.js` 通过 `cfg(desktop)` 注入。Ctrl+0 被 ArkWeb 引擎拦截，不生效 |

---

## 十九、Vibrancy（窗口模糊）手动用例

> 自动用例 2 个（side-effect）：
> 1. `window.setEffects(Blur/Acrylic/Mica/TabbedDark/TabbedLight) + clearEffects` 不抛错（运行时 setEffects，AttributeUpdater 刷新 backdropBlur/backgroundColor）
> 2. `create_transparent_window(effect=Blur)` build 时 effects 不抛错（WindowBuilder::effects，registerController inject）
>
> 以下为手动用例，通过 Tests 视图的手动按钮触发。vibrancy 窗口用 create_transparent_window（Float 子窗口，避开 UIAbility singleton 冲突）。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | vibrancy | Blur | Blur effect visible | **T0** | 应用已启动，进入 Tests 视图 | 1. 点击 "vibrancy: Blur effect visible" 手动测试按钮 2. 观察弹出的透明窗口 | 窗口背景呈磨砂模糊（backdropBlur(25)），能透出背后内容且带模糊 | 窗口加载 vibrancy.html 透明页，Effect::Blur radius=25 |
| core | vibrancy | Acrylic | Acrylic effect visible | T1 | 应用已启动，进入 Tests 视图 | 1. 点击 "vibrancy: Acrylic effect visible" 手动测试按钮 2. 观察弹出的透明窗口 | 窗口背景呈模糊 + 半透明深色 tint（blur + color） | Effect::Acrylic radius=25, color=[0,0,0,128] |
| core | vibrancy | TabbedDark | TabbedDark effect visible | T1 | 应用已启动，进入 Tests 视图 | 1. 点击 "vibrancy: TabbedDark effect visible" 手动测试按钮 2. 观察弹出的透明窗口 | 窗口背景呈模糊 + 深色 tint | Effect::TabbedDark radius=20（OHOS 下等价于 MicaDark 的深色 tint 实现） |
| core | vibrancy | clearEffects | clearEffects removes blur | **T0** | 应用已启动，进入 Tests 视图 | 1. 点击 "vibrancy: clearEffects removes blur" 手动测试按钮 2. 观察：先模糊 1s，然后 clearEffects 后模糊消失 | ① 初始窗口背景呈磨砂模糊 ② clearEffects 后窗口背景变清晰，且无半透明颜色遮罩（完全透出背后内容，不发暗/无色调） | 验证 clearEffects 同时移除 backdropBlur 和 backgroundColor tint |
| core | vibrancy | build-time effects | build-time Blur effect visible | **T0** | 应用已启动，进入 Tests 视图 | 1. 点击 "vibrancy: build-time Blur (WindowBuilder::effects)" 手动测试按钮 2. 观察弹出的透明窗口 | 窗口出现时即呈磨砂模糊（build 时 effects，非运行时 setEffects） | create_transparent_window(effect=Blur, radius=25)，WindowBuilder::effects 在窗口创建时 apply |

---

## 二十、Deep-Link 手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | deep-link | onOpenUrl | onOpenUrl 事件触发 — 运行中收到外部链接 | **T0** | app 已运行 | 1. 在 TestRunner UI manual 区点击 "onOpenUrl (trigger with hdc)" 按钮注册监听 2. 执行 `hdc shell "aa start -U taurideeplink://manualtest"` | UI 消息区显示 `[deep-link] onOpenUrl received: ["taurideeplink://manualtest"]` | RunEvent::Opened urls 非空时触发 |
| core | deep-link | getCurrent | getCurrent 冷启动 — 首启动链接拉起 | **T0** | app 未运行 | 1. `hdc shell "aa force-stop com.tauri.api"` 2. `hdc shell "aa start -U taurideeplink://coldstart"` 3. 等 app 冷启动后在 TestRunner UI manual 区点击 "getCurrent" 按钮 | UI 消息区显示 `[deep-link] getCurrent → ["taurideeplink://coldstart"]` | 冷启动 onCreate want.uri 经 lazy take 注入 |
| core | deep-link | 外部唤起 | 外部链接唤起 app — 跨 app 跳转 | **T0** | app 已安装 | 1. `hdc shell "aa force-stop com.tauri.api"` 2. `hdc shell "aa start -U taurideeplink://foreground-test"` | app 唤起到前台（onCreate 冷启动或 onNewWant 运行中） | aa start -U 与浏览器点击 `<a href>` 走相同系统 Want 路由（module.json5 skills 匹配）；浏览器地址栏直接输入 scheme 会被当搜索词 |

## 二十一、Window Operations（窗口操作）手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | window-ops | minimize | 窗口最小化与恢复 | **T0** | app 已运行，进入 Tests 视图 | 1. 在 TestRunner UI 底部 "Window Operations" 区找到 "Minimize then is_minimized" 按钮，点击 2. 窗口最小化到任务栏 3. 从任务栏点击 app 图标恢复窗口 4. 查看按钮下方显示的测试结果 | ① 窗口成功最小化到任务栏 ② 按钮下方显示 `isMinimized() = true` → PASS ③ 从任务栏恢复窗口后底部内容完整无缺失 | `win.minimize()` 调 `window.Window.minimize()`（API11）；`is_minimized()` 调 `getWindowStatus() === MINIMIZE`。恢复通过任务栏点击（系统行为），非 API 调用。 |
| core | window-ops | window-state | 窗口位置记忆与恢复 | **T0** | app 已运行 | 1. 将窗口拖动到一个明显的位置（如左上角） 2. 在 TestRunner UI 底部 "Window Operations" 区找到 "Window-State Save" 按钮，点击（保存当前位置） 3. 重启 app：终端执行 `hdc shell aa force-stop com.tauri.api` 后重新启动 4. 观察重启后窗口的位置变化 5. 也可在重启后点击 "Window-State Restore" 按钮手动恢复 | ① 重启后窗口先出现在屏幕中心（OS 默认位置） ② 随后窗口自动闪现到步骤 1 保存的位置 ③ 注意：自动测试中的 "set_position moves window" 用例会调 `setPosition(100,100)` 移动主窗口，可能覆盖恢复结果——请等自动测试跑完后（约 30 秒）再观察窗口最终位置 | OHOS 适配要点：① restore_state 从文件读取保存的位置（绕过被 Moved 事件覆盖的内存缓存）② 在 `RunEvent::Ready` 时对主窗口触发 restore（OHOS 的 `on_window_ready` 不对主窗口触发）③ `moveWindowTo` 对主窗口（id=0）用 `windowStage.getMainWindowSync()` 获取窗口句柄（主窗口不在 WindowManager 的 Map 中）④ NAPI 调用用 Object 传参（napi-ohos 不支持 3 元素元组）⑤ `inner_size()` 返回 window_rect（外尺寸）使 save→resize 循环幂等 ⑥ OHOS 跳过 `RunEvent::Exit` 自动保存（用户通过 Save 按钮显式控制）|
| core | window-ops | resize | 窗口缩放后底部内容完整 | **T0** | app 已运行，页面有可滚动内容 | 1. 用鼠标拖动窗口右边缘或下边缘向内缩小窗口 2. 松开鼠标后观察页面底部内容是否完整显示 3. 再拖动边缘向外放大窗口 4. 松开鼠标后再次观察 5. 重复缩放操作 3-5 次 | ① 缩小窗口后底部内容完整可见，无裁剪 ② 放大窗口后底部内容完整可见 ③ 多次缩放均正常 | 根因：commit `6fd8c0a` 把 Web 组件尺寸从 `.width("100%")`（自然布局）改为 `.width(data.style.width)`（set_bounds/BuilderNode.update），而 BuilderNode.update 不通知 ArkWeb 重新布局 → 缩放后底部被裁。修复：Web `.width/.height` 改回 `"100%"`，让 ArkUI 自然布局驱动 ArkWeb relayout。 |
| core | persisted-scope | save | fs scope 保存到文件 | **T0** | app 已运行（建议先点 "Persisted-Scope Clear" 清掉旧 `.persisted-scope` 避免残留干扰） | 1. 在 TestRunner UI 底部 "Window Operations & Persisted-Scope Manual Tests" 区点击 "Persisted-Scope Test" 按钮 2. 查看按钮下方显示的结果 3.（可选）`hdc shell ls -l <结果中的 state_file 路径>` 核对文件落盘 | ① `allow_directory: ✅ 成功` ② `.persisted-scope 文件: ✅ 已生成 (N bytes)` ③ `路径:` 显示 state_file 完整路径 | 因 OHOS 不支持 DragDrop（tao OHOS 未实现 DragDrop 事件），通过自定义 `test_persisted_scope` command 直接调 `scope.allow_directory(test_path, true)` 触发 PathAllowed 事件 → persisted-scope 插件监听该事件并把 `allowed_patterns()` 写入 `.persisted-scope`（bincode 二进制）。注意：该 command 返回 `allow_ok / test_path / state_file / state_file_exists / state_file_size`，**不返回 allowed_patterns 数量**，故本步只验证文件生成。 |
| core | persisted-scope | restore | 重启后 fs scope 自动恢复 | **T0** | 已执行 save 用例（`.persisted-scope` 文件已生成） | 1. 重启 app：`hdc shell aa force-stop com.tauri.api` 后重新启动 2. 重启后**先不要点 Test**（点 Test 会再次 `allow_directory` 同一路径，使 count 恒为 2，掩盖 restore 是否生效，见备注） 3. 直接点击 "Persisted-Scope Clear" 按钮 4. 查看按钮下方**结果框**（mono 字体 div）的 `remaining_patterns_count`（注意：消息区会被随后的 "Console log saved" 覆盖，看结果框或 hilog） | ① `文件删除: ✅ 已删除`（证明 `.persisted-scope` 跨重启留存）+ `remaining_patterns_count > 0`（典型 = 2：`test_path` + `test_path/**`，因 `allow_directory(recursive=true)` 一次加 2 个 pattern，`crates/tauri/src/scope/fs.rs:284-287`）→ ✅ restore 生效 ② `remaining_patterns_count = 0` → ❌ restore 失败（文件未读 / app_data_dir 在 setup 时不可用 / 反序列化失败） | persisted-scope 插件 setup 时读取 `.persisted-scope`（bincode 反序列化）并对每个 allowed_paths 调 `allow_path`→`scope.allow_directory` 恢复 fs scope。`allow_directory(path, true)` 一次加 2 个 pattern（`path` + `path/**`），fs scope allowed_patterns 是 **HashSet**（`crates/tauri/src/scope/fs.rs`）对同路径幂等去重——故重启后点 Test 仍是 2（不新增），这正是"必须不点 Test 直接 Clear"的原因：不点 Test 时 count>0 证明 restore、count=0 证明失败；点了 Test 则 count 恒=2 无法区分。`clear_persisted_scope` 是唯一返回 count 的入口（读 `scope.allowed_patterns().len()`），但会删 `.persisted-scope`，重复验证需先点 Test 重新保存。 |

## 二十二、Opener（打开文件/URL）手动用例

> autotest 已移除（原 `category:'manual'` 被运行器一律 skip，零覆盖）。opener 的 OHOS 实现走 `openharmony_ability::open_with_system` / `reveal_in_dir`（系统意图），行为依赖系统，必须人眼验证。测试入口：TestRunner 底部 "Plugins Manual Tests" 区按钮。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | opener | openPath | Opener openPath — 打开文件 | **T0** | app 已运行，进入 TestRunner → "Plugins Manual Tests" 区 | 1. 点击 "Opener openPath (open file)" 按钮 2. 观察系统反应 3. 查看按钮下方 manualResult 输出 | ① manualResult 输出 `openPath(<appCacheDir>/opener-<ts>.txt) called.` ② 系统弹出默认文本查看器/编辑器打开该文件（或文件管理器） ③ 无 `OpenharmonyAbility` 错误 | OHOS 实现：`commands.rs:84` `open_path` → `openharmony_ability::open_with_system(file_uri)`。文件写入 appCacheDir。`open with` 参数在 OHOS 被忽略 |
| core | opener | revealItemInDir | Opener revealItemInDir — 在文件管理器中定位 | **T0** | app 已运行 | 1. 点击 "Opener revealItemInDir" 按钮 2. 观察系统反应 3. 查看 manualResult | ① manualResult 输出 `revealItemInDir(<path>) called.` ② 系统文件管理器打开并定位/高亮该文件 ③ 无错误 | OHOS 实现：`commands.rs:103` `reveal_item_in_dir` → 取 parent 目录 → `openharmony_ability::reveal_in_dir(parent_uri)` |
| core | opener | openUrl | Opener openUrl — 打开 URL | **T0** | app 已运行；设备已联网 | 1. 点击 "Opener openUrl (open browser)" 按钮 2. 观察系统反应 3. 查看 manualResult | ① manualResult 输出 `openUrl('https://tauri.app') called.` ② 系统浏览器打开 https://tauri.app ③ 无错误 | OHOS 实现：`commands.rs:42` `open_url` → `openharmony_ability::open_with_system(url)`。**autotest 从未覆盖 openUrl**，仅手动验证 |

---

## 二十三、Store（持久化存储）手动用例

> autotest 仅覆盖内存 CRUD（set/get/has/keys/entries/delete/close），**刻意不碰 Exit/Drop 路径**。store timeout 修复（OHOS Drop-skip `store.rs:644`、Exit `save_or_skip` `store.rs:555`/`lib.rs:454`）是 defense-in-depth，autotest 不覆盖；磁盘持久化（set→退出→重开→数据在）也需手动验证。测试入口：TestRunner "Plugins Manual Tests" 区。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | store | 持久化-写入 | Store Persist — set+save 落盘 | **T0** | app 已运行 | 1. 点击 "Store Persist (set+save)" 按钮 2. 查看 manualResult | ① manualResult 输出 `store.save() done. key='manual-sentinel' value='persisted-<ts>' → manual-store.json.` ② 无错误 | 路径 `manual-store.json` 经 `resolve_store_path`（`store.rs:30`，`BaseDirectory::AppData`）解析到 AppData 目录落盘。autotest 不调 `save()`，本用例补此路径 |
| core | store | 持久化-恢复 | Store Verify — 重启后数据留存 | **T0** | 已执行 Persist 用例 | 1. force-stop app：`hdc shell aa force-stop com.tauri.api` 2. 重新启动 app，进入 TestRunner "Plugins Manual Tests" 区 3. 点击 "Store Verify (after restart)" 按钮 4. 查看 manualResult | ① manualResult 输出 `store.get('manual-sentinel') → {"value":"persisted-<ts>"}` ② 输出 `PASS: value persisted across restart.` ③ 若输出 `FAIL: value missing` → 持久化失败 | 验证 `manual-store.json` 跨进程重启留存 + 反序列化恢复。force-stop 模拟进程退出后重启 |
| core | store | Exit 不阻塞 | Store Exit — 退出无 appfreeze | **T1** | app 已运行，已 load 过 store（如执行过 Persist 用例） | 1. 正常关闭 app 主窗口（触发 `RunEvent::Exit`）2. 观察窗口是否立即关闭、无卡顿/超时 3. 重新启动 app 确认正常 | ① 窗口立即关闭，无 5s 卡顿/ANR ② 重启正常 ③ hilog 无 `store: StoreInner locked on exit, skipping save` 之外的异常 | 验证 OHOS Drop-skip（`store.rs:644` OHOS 下 `Drop` 完全跳过 auto-save）+ Exit `save_or_skip` 降级（`store.rs:555`，mutex 争用时 try_lock 跳过）。这是 store timeout 三处修复的核心，autotest 无法触发 Exit/Drop |

---

## 二十四、Upload（文件上传）手动用例

> autotest 调 upload 并注册 progress 回调，但**只断言响应体非空，未断言 progress 回调触发**。本用例验证 progress 事件确实触发。测试入口：TestRunner "Plugins Manual Tests" 区。依赖 app 内 3003 端口 echo server（autotest upload 已验证可用）。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | upload | progress 回调 | Upload — echo + progress 触发 | **T0** | app 已运行；3003 echo server 已起（autotest upload 通过即满足） | 1. 点击 "Upload (echo+progress)" 按钮 2. 查看 manualResult | ① manualResult 输出 `upload response: <非空>` ② 输出 `progress events: N`（N ≥ 1）③ 列出最近 5 条 progress 事件 ④ 输出 `PASS: progress callback fired.` ⑤ 若 `FAIL: no progress events` → progress 回调未触发 | 上传 64KB 文件到 `http://localhost:3003/up`，progress 回调收 `ProgressPayload{progress, progressTotal}`。autotest 仅 `Math.max(lastProgress, p.progress)` 抓了未断言，本用例补断言 |

---

## 二十五、Localhost（本地资源服务）手动用例

> autotest fetch `127.0.0.1:3005/index.html` 断言 200 + body，但**未直接断言 CORS 头**。本用例显式检查 `Access-Control-Allow-Origin`。测试入口：TestRunner "Plugins Manual Tests" 区。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | localhost | serve+CORS | Localhost fetch — 200 + CORS 头 | **T0** | app 已运行；localhost 插件已在 3005 起服务 | 1. 点击 "Localhost fetch (CORS)" 按钮 2. 查看 manualResult | ① manualResult 输出 `fetch 127.0.0.1:3005/index.html → status=200 bodyLen=<N> ACAO=*` ② 输出 `PASS: localhost serve OK.` ③ ACAO 应为 `*`（OHOS CORS 兜底，`localhost/src/lib.rs:151-163`）④ 若 `warning: no Access-Control-Allow-Origin header` → CORS 头缺失 | OHOS 绑 `127.0.0.1`（`lib.rs:110`，非 `localhost`）。autotest 跨源 fetch 成功已隐式验证 CORS，本用例显式断言 ACAO 头 |

---

## 二十六、OHOS 适配真 gap 功能 手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| ohos | drag-overlay | drag-in | Overlay 拖拽接收 — 文件拖入 webview | **T0** | 修改 app 配置添加 `.with_drag_drop_overlay(true)` + `drag_drop_handler`，重新构建部署；desktop 形态 | 1. 从文件管理器拖拽文件到 webview 区域 2. 释放 3. 观察 hilog 搜 `onDragAndDrop` | ① `Enter` → `Over` → `Drop(paths)` → `Leave` 事件序列 ② paths 含拖入文件的 URI ③ Web 级 handler 被抑制（不双发） | 若 overlay 也不触发 → ArkUI 不下发拖拽事件（平台限制）；需改 app 配置重建 |
| ohos | drag-overlay | pointer-passthrough | Overlay 透传 — 鼠标/触摸不受影响 | **T0** | 同上（overlay 已渲染） | 1. 在 webview 区域点击、滚动、选中文本 2. 页内 HTML5 拖拽（DOM 元素间拖动） | ① 鼠标点击/滚动/触摸正常响应 ② 文本选择正常 ③ HTML5 DnD 不被 overlay 干扰 | `HitTestMode.Transparent` 透传指针事件 |
| ohos | https-scheme | page-load | HTTPS Scheme — 页面加载 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "HTTPS Scheme" 按钮 2. 观察弹出的测试窗口页面是否渲染 3. hilog 搜 `onInterceptRequest` | ① `onInterceptRequest` 触发 ② custom_protocol 闭包被调用 ③ 页面 HTML 正常渲染 | 若不触发 → onInterceptRequest 不对主框架导航生效（降级） |
| ohos | https-scheme | secure-context | HTTPS Scheme — Secure Context 验证 | **T0** | 同上；页面加载成功 | 1. 在测试窗口的 DevTools 控制台执行 `window.isSecureContext` 2. 执行 `crypto.subtle.digest('SHA-256', new TextEncoder().encode('hello'))` 3. hilog 搜 `isSecureContext` | ① `isSecureContext === true` ② `crypto.subtle.digest(...)` 返回 ArrayBuffer（32 bytes） ③ 不抛异常 | **最终验收门槛**：若 `false` → ArkWeb 不识别自定义 https origin（降级 A/B/C） |
| ohos | https-scheme | external-https | HTTPS Scheme — 外部 HTTPS 不被误拦截 | **T1** | 同上 | 1. 在测试窗口的 DevTools 控制台执行 `fetch('https://example.com')` 2. 观察请求是否正常完成 3. hilog 确认 `onInterceptRequest` 返回 null | ① 外部 https 请求正常完成 ② `onInterceptRequest` 返回 null（不匹配 custom protocol） | 非匹配 URL 返回 null，ArkWeb 走默认网络栈 |
| ohos | https-scheme | subresource | HTTPS Scheme — 子资源 fetch/XHR 拦截 | **T1** | 同上 | 1. 在测试窗口的 DevTools 控制台执行 `fetch('tauri://localhost/api')`（改写为 `https://tauri.localhost/api`） 2. hilog 搜 `onInterceptRequest` | ① `onInterceptRequest` 对 fetch/XHR 子资源触发 ② custom_protocol 闭包被调用 ③ fetch 返回闭包响应 | 验证子资源请求也被拦截 |

## 二十七、OHOS 适配 8 项功能 手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| ohos | monitor | refresh-rate | 刷新率真实值 — DisplayManager | **T0** | 应用已启动，进入 Tests 页面 | 1. 等待 auto 测试自动运行 2. 查看 `monitor.real-size` 结果 3. hilog 搜 `monitor` 看输出的 size/scaleFactor | ① auto 测试 PASS ② `size.width > 0 && size.height > 0` ③ 值不随窗口最小化/恢复变化（DisplayManager 物理像素） | `app.refresh_rate()` 取真实刷新率（非硬编码 60） |
| ohos | monitor | from-point | monitor_from_point — 边界判定 | **T1** | 应用已启动，进入 Tests 页面 | 1. 点击 "Monitor Info" 按钮 2. 查看输出的 monitor size + 测试点说明 3. hilog 确认 `monitor_from_point` 无 warn 日志 | ① 显示 monitor size（DisplayManager 物理像素） ② 屏幕内坐标返回 `Some(primary)` ③ 屏幕外坐标返回 `None` ④ 无 warn | OHOS 单显示器，边界判定 `0<=x<w && 0<=y<h`；JS API 不暴露 from_point，通过 hilog/Rust 验证 |
| ohos | webview | print | WebView 打印 — 系统打印对话框 | **T0** | 应用已启动；页面已加载（onPageEnd）；进入 Tests 页面 | 1. 点击 "WebView Print" 按钮 2. 观察系统打印对话框 3. 检查临时 PDF 清理（hilog 搜 `print`） | ① 弹出系统打印对话框 ② 打印任务提交后 `log.info('print: job submitted')` ③ 临时 PDF 文件清理（`fileIo.unlinkSync`） ④ 页面未加载时返回 Err | `@ohos.print` + `createPdf` 降级 |
| ohos | event | start-resumed | MainEvent::Start → Event::Resumed 转发 | **T0** | 应用已启动 | 1. 点 `RunEvent::Resumed` 按钮（监听 tauri://resumed）2. 按 Home 键将应用切到后台 3. 从最近任务列表切回应用 4. 看按钮结果（30s 内 PASS/FAIL） | ① 切回时 `Resumed` 事件触发，按钮显示 PASS ② hilog 无 `warn: TODO: forward onStart` ③ 与 SurfaceCreate/Resume 的重复 Resumed 可接受（幂等） | tao `MainEvent::Start`（SHOWN）转发为 `Event::Resumed`；按钮自动监听 30s |
| ohos | event | save-state | MainEvent::SaveState 降级 | **T1** | 应用已启动 | 1. 触发系统内存回收（打开多个应用占用内存后切回） 2. hilog 搜 `SaveState` | ① `debug: SaveState has no tao Event equivalent; dropped` ② 无 `warn` 噪音 ③ 不转发任何 Event | tao 无 SaveState 变体，降级为 debug log |
| ohos | clipboard | flag-off | with_clipboard(false) — 拦截 Ctrl+C | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Clipboard OFF" 按钮 2. 在弹出的测试窗口选中文本 3. 按 Ctrl+C 4. 在输入框 Ctrl+V 粘贴 | ① 剪贴板内容**不变**（未复制） ② hilog 无错误 | ArkUI `onKeyPreIme` 拦截 CLIPBOARD_ACCELERATORS |
| ohos | clipboard | flag-on | with_clipboard(true) — 正常复制 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Clipboard ON" 按钮 2. 在弹出的测试窗口选中文本 3. 按 Ctrl+C 4. 在输入框 Ctrl+V 粘贴 | ① 剪贴板内容**已更新**（复制成功） | ArkWeb 原生处理（flag=true 不拦截） |
| ohos | zoom | flag-off | with_zoom_hotkeys(false) — 拦截 Ctrl+= | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Zoom OFF" 按钮 2. 在弹出的测试窗口按 Ctrl+= 3. 按 Ctrl+- 4. 按 Ctrl+0 | ① 页面缩放**不变** ② hilog 无错误 | `onKeyPreIme` 拦截 ZOOM_HOTKEY_ACCELERATORS |
| ohos | zoom | flag-on | with_zoom_hotkeys(true) — 正常缩放 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Zoom ON" 按钮 2. 在弹出的测试窗口按 Ctrl+= 3. 按 Ctrl+- 4. 按 Ctrl+0 | ① Ctrl+= 放大 ② Ctrl+- 缩小 ③ Ctrl+0 重置 | ArkWeb 原生缩放（flag=true 不拦截） |
| ohos | dialog | error-degrade | dialog::error() 降级 — 不 panic | **T1** | 应用已启动；进入 Tests 页面 | 1. 点击 "Dialog Error (degrade)" 按钮 2. 查看 hilog 搜 `dialog::error` | ① 按钮显示说明信息（该函数仅 Windows 运行时调用） ② OHOS 分支为 `log::error!` 不 panic ③ 应用不崩溃 | `log::error!` 替代 `unimplemented!()`；实际运行时不触发（仅 Windows 调用） |

---

## 二十八、Window Ignore Cursor Events（窗口事件穿透）手动用例

> **背景**: Tauri `Window::set_ignore_cursor_events(ignore)` 在 OHOS 映射到 `ohos.window.setWindowTouchable(!ignore)`（`ignore=true` 穿透 ↔ `touchable=false` 不消费事件，取反在 tao 层）。桥接走 TSFN fire-and-forget（对称 `set_window_blur`）：Rust 始终返回 Ok，ArkTS Promise reject（1300002/1300003）由 `.catch` 捕获不闪退、不反向通知 Rust。
>
> **API 版本矛盾（待真机定论）**: 本地缓存文档标注 setWindowTouchable API 9+/12+，但华为官方智能问答确认为 **API 15+（HarmonyOS 5.0.0+）**。tauri api demo 默认 `compatibleSdkVersion = API 12`。若设备 API < 15，`win.setWindowTouchable` 为 undefined → ArkTS 同步抛 TypeError → 被 ArkHelper `safeLogError` 捕获，**不闪退**，仅穿透不生效。真机验证设备实际 API level 为定论步骤（design R5）。
>
> **测试入口**: `examples/api` 应用 → Tests 页面 → Manual Tests 区域 → `setIgnoreCursorEvents (3s toggle)` 按钮（smoke：toggle true→false 验证 TSFN 桥接 + 3s 穿透观察）。完整穿透验证需手动创建 Float overlay 子窗口（见 T0 用例）。
>
> **日志监控**: `hdc shell hilog | grep -iE "setWindowTouchable|WindowManager"`

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| ohos | ignore-cursor-events | touch-passthrough | setIgnoreCursorEvents(true) 触摸穿透 | **T0** | 应用已启动；已创建一个 Float 子窗口叠在主窗口上方（如透明 overlay）；设备 API ≥ 15 | 1. 在 overlay 子窗口上调用 `setIgnoreCursorEvents(true)` 2. 用手指/鼠标点击 overlay 覆盖区域 3. 观察主窗口是否收到点击 4. hilog 搜 `setWindowTouchable` 5. 调 `setIgnoreCursorEvents(false)` 恢复 | ① 点击穿透到下层主窗口（overlay 不消费触摸/鼠标事件）② hilog 输出 `setWindowTouchable: window N touchable=false`（debug）③ `setIgnoreCursorEvents(false)` 恢复后 overlay 重新消费事件 | `ignore=true` ↔ `touchable=false`（tao 层取反）；fire-and-forget，Rust 返回 Ok 不代表 ArkTS 成功，以 hilog + 视觉为准 |
| ohos | ignore-cursor-events | hover-passthrough | setIgnoreCursorEvents hover 穿透 + API 版本 | **T1** | 同上 | 1. overlay 调 `setIgnoreCursorEvents(true)` 2. 鼠标悬停 overlay 覆盖区域 3. 观察下层主窗口的 hover/光标交互是否生效 4. 若 hover 不穿透，确认触摸仍穿透 5. 确认设备 API level（`hdc shell param get const.ohos.apicomversion` 或 deviceInfo.sdkApiVersion） | ① **API ≥ 15 且 hover 穿透**：单 setWindowTouchable 足够 ② **hover 不穿透但触摸穿透**：需追加组件级 `hitTestBehavior(HitTestMode.Transparent)`（参考 R72 drag-drop-overlay，task 4.3）③ **API < 15**：hilog 输出 `setWindowTouchable failed: ...`（TypeError），穿透完全不生效，需在 WindowManager 加 `deviceInfo.sdkApiVersion >= 15` 版本守卫静默跳过 | 真机为定论（design R1/R5）；hover fallback 走 task 4.3；版本守卫属底层仓（openharmony-ability）职责，不加在 tao 层 |


## 二十九、手动用例统计汇总

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
| Webview — Cookie | 1 | 0 | **1** |
| Webview — DevTools | 0 | 1 | **1** |
| Webview — Fullscreen | 1 | 0 | **1** |
| WebView User-Agent | 1 | 2 | **3** |
| RunEvent（生命周期事件） | 1 | 3 | **4** |
| Transparent（透明窗口） | 1 | 1 | **2** |
| on_new_window（新窗口拦截） | 2 | 1 | **3** |
| Single-Instance（单实例） | 3 | 1 | **4** |
| WebView webPageSnapshot（网页截图） | 1 | 0 | **1** |
| Predefined Multi-Window（预定义操作多窗口支持） | 6 | 8 | **14** |
| Notification（通知） | 1 | 2 | **3** |
| Sentry（错误追踪） | 1 | 1 | **2** |
| Unstable Feature（窗口与 Webview 解耦） | 2 | 1 | **3** |
| Global Shortcut（全局快捷键） | 2 | 0 | **2** |
| 窗口聚焦与热键缩放 | 1 | 1 | **2** |
| Vibrancy（窗口模糊） | 3 | 2 | **5** |
| Deep-Link（深度链接） | 3 | 0 | **3** |
| Window Operations（窗口操作） | 3 | 0 | **3** |
| Persisted Scope（fs scope 持久化） | 2 | 0 | **2** |
| Opener（打开文件/URL） | 3 | 0 | **3** |
| Store（持久化存储） | 2 | 1 | **3** |
| Upload（文件上传） | 1 | 0 | **1** |
| Localhost（本地资源服务） | 1 | 0 | **1** |
| OHOS — Drag Overlay（拖拽降级） | 2 | 0 | **2** |
| OHOS — HTTPS Scheme（安全上下文） | 2 | 2 | **4** |
| OHOS — Monitor（真实值 + from-point） | 1 | 1 | **2** |
| OHOS — WebView Print（打印） | 1 | 0 | **1** |
| OHOS — Event Lifecycle（Start→Resumed + SaveState） | 1 | 1 | **2** |
| OHOS — Clipboard Flag（with_clipboard 开/关） | 2 | 0 | **2** |
| OHOS — Zoom Flag（with_zoom_hotkeys 开/关） | 2 | 0 | **2** |
| OHOS — Dialog Error（降级不 panic） | 0 | 1 | **1** |
| OHOS — Window Ignore Cursor Events（事件穿透） | 1 | 1 | **2** |
| **合计** | **87** | **64** | **151** |

