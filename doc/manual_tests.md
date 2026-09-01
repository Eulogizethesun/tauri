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
| core | tray | 创建与图标 | Full Test Tray — 创建托盘与图标显示 | **T0** | 应用已启动，进入 Tray 页面 | 1. 点击 "Full Test Tray" 按钮 2. 确认状态栏出现托盘图标 3. 左键点击托盘图标 | ① UI 输出 `Full test tray created` ② 状态栏显示托盘图标（32×32 默认图标） ③ 左键点击弹出 QuickOperation 系统面板，标题 "Tauri API"（QuickOp 面板拦截左键点击；验证 TrayIconEvent 输出需清空 abilityName，见 icon-click 用例 L308） | QuickOperation 配置：title="Tauri API"，height=300，abilityName="TestTrayAbility" |
| core | tray | 右键菜单显示 | Full Test Tray — 右键菜单结构与项类型 | **T0** | 已创建 Full Test Tray | 1. 右键点击（或长按）状态栏托盘图标 2. 检查菜单整体结构 3. 逐项检查各类型菜单项显示 | ① 弹出上下文菜单 ② 自定义项正确显示：Normal Item（普通文字）、Check Item（未勾选状态）、Icon Item（带图标+文字）、Another Normal（普通文字） ③ 分隔符正确渲染为分隔线 ④ 预定义项正确显示：Copy/Cut/SelectAll/Undo/Redo/Minimize/Maximize/Fullscreen/CloseWindow/Hide/Quit | 菜单共含 4 个自定义项 + 4 个分隔符 + 11 个预定义项（不含 Paste 和 3 个分隔符预定义项） |
| core | tray | 菜单项点击事件 | Full Test Tray — 自定义菜单项点击 | **T0** | 已创建 Full Test Tray；已右键打开菜单 | 1. 点击菜单中的 "Normal Item" 2. 重新打开菜单，点击 "Check Item" 3. 重新打开菜单，点击 "Icon Item" | ① 点击 Normal Item → Menu Event Log 输出 `[menu-event #N lid=1] global:normal-item at <时间>` ② 点击 Check Item → 输出 `[menu-event #N lid=1] global:check-item at <时间>` ③ 点击 Icon Item → 输出 `[menu-event #N lid=1] global:icon-item at <时间>` ④ 每次点击后菜单自动关闭 | 验证自定义 MenuItem action 回调 + Rust 全局事件转发 |
| core | tray | 预定义菜单项功能 | Full Test Tray — 预定义菜单项操作验证 | **T0** | 已创建 Full Test Tray；输入框有文本可用于剪贴板测试 | 1. 在输入框中选中一段文本 2. 右键打开托盘菜单，点击 Copy → 在另一处粘贴，验证复制成功 3. 重新选中输入框文本 4. 打开菜单，点击 Cut → 粘贴验证剪切成功 5. 打开菜单，点击 Minimize → 窗口最小化到任务栏，点击任务栏图标恢复窗口 6. 打开菜单，点击 Maximize → 窗口铺满全屏 7. 打开菜单，点击 Fullscreen → 进入沉浸式全屏，按 Esc 退出 8. 打开菜单，点击 Hide → 窗口隐藏，从任务栏点击恢复 9. 打开菜单，点击 CloseWindow → 窗口关闭 | ① Copy：文本被复制到剪贴板，Menu Event Log 输出 `global:copy` ② Cut：文本从输入框消失且被复制到剪贴板，输出 `global:cut` ③ Minimize：窗口最小化到任务栏，无闪烁（窗口不弹回前台） ④ Maximize：窗口铺满全屏 ⑤ Fullscreen：进入沉浸式全屏，菜单栏隐藏，Esc 恢复 ⑥ Hide：窗口隐藏，从任务栏点击可恢复 ⑦ CloseWindow：窗口关闭 ⑧ 每个操作 Menu Event Log 均有对应 id 输出 | **不测试 Paste**（OHOS 剪贴板读权限限制）；Quit 会退出应用，建议最后测试；Minimize 验证 minimizeWithRestoreGuard 已恢复（WINDOW_ACTIVE 竞态保护，hilog 标记 `minimizeWithRestoreGuard: minimizing (settled)`） |
| core | tray | 托盘创建 | Tray Page — 自定义参数创建托盘 | **T1** | 应用已启动，进入 Tray 页面 | 1. 填写 Title/Tooltip/Icon 等参数 2. 点击 "Create tray" 按钮 | 托盘图标按配置参数创建成功；状态栏显示对应图标；悬停显示 tooltip | 会先移除已有的 tray-1 和 manual-tray；OHOS 有 500ms 延迟 |
| core | tray | 托盘清理 | Tray Page — Remove All Trays | **T1** | 已创建过托盘图标 | 1. 点击 "Remove All Trays" 按钮 | 所有托盘图标（tray-1、manual-tray、full-test-tray）从状态栏消失 | 验证批量移除能力 |
| core | tray | QuickOperation | Enable QuickOp — 启用快速操作面板 | **T1** | 应用已启动；tray-1 已创建（Tray 页 "Create tray"）；TestTrayAbility 已在 module.json5 注册 | 1. 在 TestRunner 页 Manual Tests 区域点击 "Enable QuickOp" 按钮 2. 左键点击状态栏托盘图标 | 系统弹出快速操作面板，标题 "Test Panel"，高度 250vp | **仅 OHOS 平台**；需预注册 abilityName；按钮内部 `getById('tray-1')`，只对 tray-1 生效 |
| core | tray | QuickOperation | Update QuickOp — 更新快速操作参数 | **T1** | QuickOperation 已启用 | 1. 点击 "Update QuickOp" 按钮 2. 左键点击托盘图标 | 弹出面板标题变为 "Updated Title"，高度变为 400vp | **仅 OHOS 平台** |
| core | tray | QuickOperation | Disable QuickOp — 禁用快速操作 | **T1** | QuickOperation 已启用 | 1. 点击 "Disable QuickOp" 按钮 2. 左键点击托盘图标 | 不再弹出面板，仅触发点击事件 | **仅 OHOS 平台**；setQuickOperation(null) |
| core | tray | icon_as_template | Icon as Template — template 模式下深色/浅色壁纸适配 | **T0** | 应用已启动，进入 Manual Tests 区域 | 1. 点击 "Icon as Template (check wallpaper)" 按钮 2. 确认状态栏出现托盘图标 3. 切换系统深色/浅色壁纸 4. 观察状态栏图标颜色变化 | ① 托盘图标创建成功（iconAsTemplate=true） ② 深色壁纸下图标为白色版本（保持可见） ③ 浅色壁纸下图标为黑色版本（保持可见） ④ 切换后图标颜色自动适配，无需重建托盘 | **仅 OHOS 平台**；验证 `to_monochrome()` 生成的白/黑双色 PixelMap 正确工作 |
| core | tray | icon_as_template | White Icon NO Template — 非 template 模式对比验证 | **T1** | 应用已启动，进入 Manual Tests 区域 | 1. 点击 "White Icon NO Template (compare)" 按钮 2. 确认状态栏出现纯白托盘图标 3. 切换系统深色/浅色壁纸 4. 观察图标是否有变化 | ① 托盘图标创建成功（32×32 纯白 PNG，iconAsTemplate=false） ② 切换壁纸后图标**不变**，始终保持纯白色 ③ 与 "Icon as Template" 对比：template 模式图标会变，非 template 不变 | 验证系统**不会**自动对非 template 图标做色反；确认 `icon_as_template` 功能的必要性 |

> **⚠️ 平台坑：托盘菜单/图标点击全部无反应（2026-08-27 定论）**
>
> **症状**: 右键菜单能正常弹出、显示完全正常，但点击任何菜单项或图标都无反应；app 侧日志无任何报错（onNewWant 触发但参数为空）。
>
> **根因**: SCB（com.ohos.sceneboard）`AppClientNotifier.handleClientRegistration` 的 `clientProxyMap` 容量为 50，进程死后条目不自动清理。开发期反复 deploy/force-stop 会用僵尸 pid 把 50 个坑占满，新 app 的 receiver 代理注册被拒 → 点击降级为无载荷 startAbility。**属平台缺陷，app 侧无法自救。**
>
> **识别**: SCB 日志出现 `Register client pid fail: out of range`（hilog 默认 INFO 级即可看到；正常应为 `Register client pid success: <pid>`）。
>
> **恢复**: `hdc shell "kill <sceneboard_pid>"` 杀掉 SCB（约 30 秒后自动重生，clientProxyMap 清空）或重启设备，然后重启 app。正常 force-stop / install -r 不泄漏，日常开发不会复现。

> **✅ 已修复（2026-08-29 真机验证 PASS）：已有托盘注册时替换图标需点两次才生效**
>
> **症状**: Remove All Trays → Tests 页创建 "Icon as Template" 托盘 → Tray 页点击 "Full Test Tray"，第一次点击图标无变化，第二次点击才变成新图标。
>
> **根因**: tray-icon OHOS 后端对 `new`/`set_title`/`set_quick_operation`/`set_icon_as_template` 都是 remove+add 连发；`StatusbarPlugin.ets` 的 remove/add 原先在**同步返回**时就向 Rust 应答，`block_on(client.remove())` 得到的只是"ArkTS 收到了"而非"SCB 做完了"，add 的 SCB 处理与 remove 的异步拆除交错 → 状态栏渲染损坏（每层日志都报成功）。注意官方文档明确 `addToStatusBar` **重复添加无效**（同 app 仅一个图标、静默空操作），所以必须保证 remove 真正完成后才 add，不能省掉 remove。
>
> **修复**: `StatusbarPlugin.ets` 的 `remove`/`add` action 改用 AsyncCallback 重载并 `await` 回调触发后才返回应答（错误也回传 Rust），Rust worker 的 remove→add 顺序即由系统完成回调保证，无任何时延猜测。
>
> **⚠️ 部署坑**: 改 `openharmony-ability` ArkTS 插件源码后必须先在仓库根跑 `pack.bat` 重打 `ability.har` 再 build——应用依赖的是预构建 HAR（file: 依赖 + ohpm 内容哈希缓存），不重打则改动不会进 HAP。

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
| core | menu | menubar/快捷键 | MenuBar Accelerator Ctrl+C — 预定义复制快捷键 ✅ | **T1** | 应用已启动；有可选择的文本 | 1. 点击 "MenuBar Accelerator Ctrl+C" 按钮 2. 在输入框输入文本并选中 3. 按 Ctrl+C | 选中文本被复制到剪贴板；粘贴可验证 | 使用 PredefinedMenuItem Copy。2026-08-29 PASS（默认值翻转修复后）。回归根因：ohos-webview-flag-clipboard 初版把 wry `clipboard` 默认 `false` 映射为键盘拦截（`MainPage.ets` onKeyPreIme 吞 Ctrl+C），所有默认配置窗口中招；修复：`tauri-runtime`/`wry` 的 `WebViewAttributes::default().clipboard` OHOS 下为 `true` + 新增 `disable_clipboard_access()` 显式关闭，见 spec `ohos-webview-flag-clipboard` 2026-08-28 修订 |
| core | menu | menubar/自动刷新 | MenuBar Auto Refresh Text — 文本自动刷新 | **T1** | 应用已启动 | 1. 点击 "MenuBar Auto Refresh Text" 按钮 2. 展开 "Refresh" 下拉菜单 | 下拉菜单显示 "Updated!" 而非 "Original" | 先创建 text='Original'，500ms 后 setText('Updated!')；验证 auto_refresh 机制 |
| core | menu | menubar/自动刷新 | MenuBar Auto Refresh Checked — 勾选状态自动刷新 | **T1** | 应用已启动 | 1. 点击 "MenuBar Auto Refresh Checked" 按钮 2. **不点击**，等待 500ms 3. 展开 "Refresh" 下拉菜单 | "Check Me" 项前自动出现勾选标记 ✓（无需手动点击） | 验证 auto_refresh 机制在 500ms 后自动推送 checked 状态变更到原生菜单栏 |
| core | menu | menubar/预定义项 | MenuBar Predefined Hide — 预定义隐藏窗口 | **T1** | 应用已启动 | 1. 点击 "MenuBar Predefined Hide" 按钮 2. 点击 Window → Hide | 窗口最小化；从任务栏恢复后窗口重新出现 | PredefinedMenuItem 'Hide' |
| core | menu | menubar/事件 | MenuBar Popup Regression — popup 回归测试 | **T1** | 应用已启动 | 1. 点击 "MenuBar Popup Regression" 按钮 | 光标位置弹出上下文菜单，显示 "Popup Test" | 验证 AppStorage key 重命名后 `menu.popup()` 仍正常工作 |
| core | menu | menubar/NativeIcon | MenuBar NativeIcon Symbols — 原生图标映射 | **T1** ✅ | 应用已启动 | 1. 点击 "MenuBar NativeIcon Symbols" 按钮 2. 分别展开 "Mapped" 和 "Unmapped" 子菜单 | Mapped 组：Add→★、LockLocked→🔒、Network→📶 显示对应系统图标；Unmapped 组：Home/Share 等仅显示文字无图标（**Folder 已映射为 sys.symbol.folder，2026-08-29 起显示文件夹图标**） | **仅 OHOS 平台**有映射效果；符号名以 SDK `sysResource.js` symbol 段为准（`folder` 无 `ohos_` 前缀） |
| core | menu | menubar/预定义项 | Menu Edit→Paste — 预定义粘贴 | **T1** | 应用已启动；剪贴板有内容 | 1. 点击 "Menu Edit→Paste" 按钮 2. 在外部复制文本 3. 聚焦输入框 4. 点击 Edit → Paste | 剪贴板内容被粘贴到输入框中 | OHOS 剪贴板读权限限制，当前无法验证 |
| core | menu | menubar/预定义项 | Menu Edit→Cut — 预定义剪切 | **T1** | 应用已启动；输入框有选中文本 | 1. 点击 "Menu Edit→Cut" 按钮 2. 选中输入框文本 3. 点击 Edit → Cut | 选中文本从输入框消失，同时被复制到剪贴板 | 验证 PredefinedMenuItem Cut 功能 |

### 2.2 弹出菜单（PopupMenu）

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | menu | popupmenu/基础 | Menu Page — Popup 弹出菜单 | **T0** | 应用已启动，进入 Menu 页面 | 1. 在 MenuBuilder 中配置菜单项 2. 点击 "Popup" 按钮 | 光标位置弹出上下文菜单，显示配置的所有菜单项 | `menu.popup()` 弹出 |
| core | menu | popupmenu/点击交互 | Popup Click Item — 弹出菜单点击菜单项 | **T0** | 应用已启动，进入 Menu 页面 | 1. 在 MenuBuilder 中添加一个 Normal 项（如 "Test Item"） 2. 点击 "Popup" 按钮 3. 在弹出菜单中点击 "Test Item" | ① 光标位置弹出上下文菜单 ② 点击后菜单消失 ③ UI 输出 `Item Test Item clicked` | 验证 MenuItem action 回调 |
| core | menu | popupmenu/点击交互 | Popup Predefined Copy — 弹出菜单预定义复制 | **T0** | 应用已启动，进入 Menu 页面；输入框有文本 | 1. 在 MenuBuilder 中添加一个 Predefined Copy 项 2. 选中输入框文本 3. 点击 "Popup" 按钮 4. 在弹出菜单中点击 Copy | 选中文本被复制到剪贴板；UI 输出 `Item Copy clicked` | 验证弹出菜单中预定义项的原生操作 |
| core | menu | popupmenu/图标 | Menu Page — Create menu with NativeIcon | **T1** ✅ | 应用已启动，进入 Menu 页面 | 1. 点击 "Create menu with NativeIcon" 按钮 | 菜单栏显示带 NativeIcon.Folder 图标的子菜单 | 验证 Submenu 级别的 NativeIcon。2026-08-29 真机 PASS：补 `Folder → sys.symbol.folder` 映射（muda `native_icon_to_ohos`）+ ArkTS 符号表 case + MenuBarRow 顶层 SymbolGlyph 渲染（顶层此前只渲染位图）。注意 folder 符号无 `ohos_` 前缀，符号名以 SDK `sysResource.js` symbol 段为准 |
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
| core | webview | createPdf/自定义 | Create PDF Square — 正方形自定义尺寸 | **T1** | 应用已启动；WebView 已加载页面 | 1. 滚动到 "Create PDF Manual Test" 区域 2. 点击 "Create PDF Square (8.27×8.27)" 按钮 | ① 页面显示 `SUCCESS ✅` ② 设备 `/data/storage/el2/base/cache/test-square.pdf` 文件生成 ③ 拉取后打开，页面为正方形尺寸 | **2026-08-28 实测+根因定位完成**：预期①②满足（`SUCCESS ✅` + test-square.pdf 生成）；预期③**不满足——仍是 A4 尺寸（8.27×11.69in）非正方形**。**根因（有意简化设计，非 bug）**：前端传 `width:8.27,height:8.27`（in，正方形）→ `test_create_pdf`（cmd.rs:1316）正确转发 config → **wry `create_pdf` 参数名 `_config`（下划线=未使用）从不读取**（wry/src/ohos/mod.rs:977），`PendingOp::CreatePdf(path)` 只传 path 不传 config → bridge `WebviewPrintRequest{id,path}` 无 config 字段 → ArkTS `WebviewPlugin.ets:2093` 硬编码 `DEFAULT_PDF_CONFIG{width:8.27,height:11.69}`（A4）。wry L26-29 注释显式写明：「bridge API uses fixed A4 settings, struct retained for API compatibility」。OHOS API 本身支持自定义尺寸（`webview.PdfConfiguration` 有 width/height），是管道未打通。修法需打通 5 处：wry 不丢 config + bridge 两端（WebviewPrintRequest 加 pdf_config 字段）+ ArkTS 用传入值替 DEFAULT（改 HAR 后须删 oh_modules 缓存重建，见 [[ohos-ohpm-ability-har-stale-cache]]） |

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
| core | runevent | ExitRequested/LoopDestroyed | 系统关闭应用 — ExitRequested + prevent_exit | **T0** | 应用已启动；可通过 DevEco Studio 或 `hdc shell hilog -x | grep tauritest` 观察日志 | 1. 关闭应用（任一路径：主窗口关闭按钮 / 托盘 Quit / 最近任务关闭） 2. 观察日志输出 | ① 日志依次出现 `[RunEvent] ExitRequested, code=None` → `[RunEvent] ExitRequested: prevent_exit() called (may not prevent on LoopDestroyed path)` → `[RunEvent] Exit` ② 应用仍然退出（`LoopDestroyed` 时系统已开始销毁，`prevent_exit()` 无法阻止退出） | 验证：LoopDestroyed handler 先触发 ExitRequested 再触发 Exit；prevent_exit 仅通知清理，无法阻止退出（tauri-runtime-wry 在 LoopDestroyed 路径丢弃 prevent 请求）。注：原预期中的 `LoopDestroyed received` 字面日志不存在于任何源码，已订正为实际字面量（examples/api lib.rs L902/911/916）；2026-08-31 修复 NativeAbility.onDestroy 将 onAbilityDestroy 同步前置（此前排在 async 队列尾部、系统 ~12ms ClearSession 强杀前跑不完，系统关闭路径零日志），关闭按钮路径修复前即正常。**2026-08-31 复验 PASS（上库前终验）**（MateBook Pro）：三路径全验——① 最近任务关闭（pid 12663，ClearSession 强杀）：`onWindowStageDestroy → CloseRequested/Destroyed(main) → ExitRequested, code=None → prevent_exit() called → Exit`（15:42:07.890-.895，Exit 早于 ClearSession kill 18ms，修复前此路径零日志）；② 托盘 Quit（pid 12217，15:40:22.681-.822）：`execute-predefined 'quit'` → 退出链全出 → `Kill Reason:app exit` 优雅退出；③ 主窗口关闭按钮（pid 3600，15:23:58）：退出链全出（修复前即正常）。应用均仍然退出（prevent_exit 无法阻止） |
| core | runevent | ExitRequested/防重复 | ✅ ExitRequested 防重复触发 | **T1** | 应用已启动，可通过 `hdc shell hilog -x \| grep tauritest` 观察日志；已创建多个子窗口 | 1. 逐个关闭子窗口（每个观察日志） 2. 关闭最后一个窗口（主窗口） 3. 统计 `ExitRequested` 出现次数 | ① 每个子窗口关闭时：`CloseRequested` → `Destroyed` ② 最后一个窗口关闭时：`ExitRequested` **仅一次** ③ 随后 LoopDestroyed 时**不再重复** ExitRequested，直接发送 `Exit` | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 14376）：3 个子窗口逐一关闭（borderless-test / transparent-borderless / decorated，15:44:43.269-15:44:45.997）各出 `CloseRequested → Destroyed`、均无 ExitRequested；主窗口关闭（15:44:51.857）出 `ExitRequested, code=None` 恰好一次 → `Exit`（12ms 后）无重复。验证 `ExitState(AtomicBool)` 防重复机制 |
| core | runevent | Opened/深度链接 | ✅ Opened 事件 — 深度链接触发 | **T1** | 应用已启动；可通过 `hdc shell hilog -x \| grep tauritest` 观察日志 | 1. 执行 `hdc shell aa start -a EntryAbility -b com.tauri.api -U myapp://test/path` 2. 观察日志输出和 UI 响应 | ① 日志出现 `[RunEvent] Opened, urls=[Url { scheme: "myapp", ..., host: Some(Domain("test")), path: "/path", ... }]`（Url 结构体 Debug 格式，scheme/host/path 与所传 URI 对应） | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 14376）：hilog `[RunEvent] Opened, urls=[Url { scheme: "myapp", host: Some(Domain("test")), path: "/path", ... }]` + `opened urls:` 同步输出（15:43:40.467）。验证：OHOS 平台 Opened 事件已启用，通过深度链接触发。注：原预期 `urls=["myapp://test/path"]` 为简化写法，实际为 Url 结构体 Debug 格式，已订正 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| RunEvent（生命周期事件） | 1 | 2 | **3** |

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
| core | on_new_window | Allow/弹窗关闭 | Allow dialog 关闭按钮验证 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "on_new_window: Allow dialog has close button (manual)" 2. 观察弹窗外观 3. 点击标题栏 ✕ 按钮 | ① 弹出非模态对话框，标题栏显示目标 URL ② 标题栏右上角有 ✕ 关闭按钮 ③ 点击 ✕ 对话框关闭（hilog `NewWindowDialog: Close button clicked`）④ 对话框内嵌 `Web` 组件**直接加载目标 URL**（`src: params.url`，非空白页） | `openNewWindowDialog` → `openCustomDialog`；Allow 分支先 `setWebController(null)` 取消 ArkWeb 自有弹窗（避免无宿主 controller 阻塞 UI 线程），再由独立 dialog 的 `Web` 加载 targetUrl。注：对话框内嵌 `Web` 占满 90%×80% 区域并消费点击，点外部区域不触发 autoCancel 关闭——须用标题栏 ✕ 关闭 |
| core | on_new_window | Deny/无弹窗 | Deny 模式阻止弹窗验证 | **T1** | 应用已启动，进入 Tests 页面 | 1. 点击 "on_new_window: Deny prevents dialog (manual)" 2. 观察屏幕 | ① 不弹出任何对话框 ② 页面保持不变，无导航跳转 ③ hilog 可见 `DENY` 日志 | `setWebController(null)` 阻止新窗口 |
| core | on_new_window | Create/真窗口 | Create real OS window 验证 | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Create (real OS window)" 2. 观察 3. 用 FloatPage 标题栏 ✕ 关闭子窗口 4. 再次点击创建第二个，用系统 X / Ctrl+W 关闭 | ① 弹出独立 OS 子窗口（非页内对话框，Float 类型，挂载 FloatPage 自绘标题栏）② 窗口加载目标 URL ③ 关闭子窗口不影响主应用 ④ hilog 可见 `on_new_window: CREATE real OS window` + `response: Create` ⑤ **两种关闭方式均有** `CloseRequested → Destroyed`：✕ 按钮走 `FloatPage: Close button clicked`→`notifyWindowClose`；系统 X 走 `FloatPage: aboutToDisappear: system close detected`→`notifyWindowClose` ⑥ 关闭时 destroy-window bridge 返回成功（`receiver.await returned`），**无** `destroy_window failed: Unknown OS sub-window` 噪音日志（#2 幂等修复）⑦ 可重复点击创建多个独立子窗口 | `NewWindowResponse::Create` → `WebviewWindowBuilder::build()` → `createOSWindow` → Float 子窗口；OHOS 子窗口无系统装饰，`decorations` 控制的是 FloatPage 内自绘 ✕/最小化/最大化按钮渲染；每次点击创建新窗口（非"不弹对话框"） |

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
| core | single-instance | 首次启动 | ✅ App Normal Launch — 首次启动不触发 callback | **T0** | 设备已连接；app 未运行 | 1. `hdc shell hilog -r`（清空日志） 2. 启动 app（点击图标或 `hdc shell aa start -a EntryAbility -b com.tauri.api`） 3. `hdc shell "hilog -x \| grep single-instance"` | hilog 中**无** `[single-instance] callback fired` 日志输出；app 正常启动显示主界面 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 12217）：清日志后 `aa start` 启动，grep single-instance 零命中；tauritest 启动链日志正常（OHOS log initialized → deep-link init → global-shortcut setup）。首次启动走 `onCreate` 路径，不触发 `onNewWant` |
| core | single-instance | 二次启动 | ✅ Second Launch Callback — 再次启动触发 callback | **T0** | app 已在运行 | 1. `hdc shell hilog -r`（清空日志） 2. `hdc shell "aa start -a EntryAbility -b com.tauri.api -U 'tauri://test'"` 3. `hdc shell "hilog -x \| grep single-instance"` | ① hilog 输出 `[single-instance] callback fired! args=["tauri://test", "{...}"], cwd=""` ② app 回到前台 ③ 不会创建新的 app 实例 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 12217）：hilog `[single-instance] callback fired! args=["tauri://test", "{...系统注入 parameters...}"], cwd=""`（15:38:25.075）；pid 保持 12217 无新实例。OHOS 默认 `launchType: singleton`，OS 层面阻止新实例 |
| core | single-instance | 参数传递 | ✅ Want Parameters — 二次启动携带 URI | **T0** | app 已在运行 | 1. `hdc shell hilog -r` 2. `hdc shell "aa start -a EntryAbility -b com.tauri.api -U 'myapp://action?key=value'"` 3. `hdc shell "hilog -x \| grep single-instance"` | ① args 第一个元素为 `"myapp://action?key=value"`（want.uri） ② args 第二个元素为 JSON 字符串，包含系统注入的 want.parameters（具体字段因 API 版本和设备而异，验证重点为非空 JSON 字符串） ③ cwd 为空字符串 `""` | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 12217）：args[0]=`"myapp://action?key=value"`（完整含查询串）、args[1] 为非空 JSON（callerNativeName=_hdcd/callerPid/callerToken 等系统注入字段）、cwd=`""`（15:38:34.848）；pid 不变。`aa start -U` 仅设置 want.uri，want.parameters 由系统自动注入 |
| core | single-instance | 无 URI 启动 | ✅ Second Launch Without URI — 无 URI 二次启动 | **T1** | app 已在运行 | 1. `hdc shell hilog -r` 2. `hdc shell "aa start -a EntryAbility -b com.tauri.api"` 3. `hdc shell "hilog -x \| grep NativeAbility"` 4. `hdc shell "hilog -x \| grep single-instance"` | ① `hilog \| grep NativeAbility` 有 `onNewWant - uri: , parametersJson.length: <N>` 日志（URI 为空，length > 0） ② `hilog \| grep single-instance` 有 `[single-instance] callback fired!` 日志，args 仅包含系统注入的 want.parameters JSON（空 URI 被过滤） | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 12217）：`onNewWant - uri: , parametersJson.length: 397`（URI 空、length>0）+ `[single-instance] callback fired! args=["{...仅系统参数 JSON...}"], cwd=""`（15:38:50.677，空 URI 已过滤）。与 macOS/Windows 行为对齐：第二次启动无论有无参数，callback 均触发 |

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
| core | predefined-multi-window | clipboard/copy | ✅ Tray Copy 子窗口 — 复制子窗口选中文本 | **T0** | 应用已启动；已创建子窗口（如 Hello World）；子窗口有可选择的文本 | 1. 在子窗口中选中一段文本 2. 右键点击状态栏托盘图标打开菜单 3. 点击 Copy 4. 在主窗口或其他位置粘贴验证 | ① 复制目标为子窗口选中文本（OHOS 剪贴板读限制下以 hilog 判据验证） ② 不是主窗口的文本 ③ hilog 无 `Clipboard copy failed` 错误 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 41390）：hilog `Using lastUserInteractedWindow: id=1` → `execute-predefined 'copy' resolvedWindowId=1` → `getTargetController windowId=1 wmHit=true fallbackToExecutor=false`（使用子窗口 controller）→ `copy textLen=16` 成功，无 Clipboard copy failed。验证：剪贴板操作使用目标窗口的 webview controller |
| core | predefined-multi-window | clipboard/cut | ✅ Tray Cut 子窗口 — 剪切子窗口选中文本 | **T1** | 应用已启动；已创建子窗口；子窗口有可编辑的文本输入框 | 1. 在子窗口的输入框中选中一段文本 2. 右键点击托盘图标打开菜单 3. 点击 Cut 4. 观察子窗口输入框 5. 在其他位置粘贴验证 | ① 子窗口输入框中选中的文本被删除 ② 剪切到的文本为子窗口选中文本（OHOS 剪贴板读限制下以 hilog 判据验证） | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 41390）：hilog `execute-predefined 'cut' resolvedWindowId=1` → `getTargetController windowId=1 wmHit=true` → `T5cut rawLen=18`（选中文本获取成功）；用户目视确认子窗口输入框选中文本被删除。验证 Cut 操作在目标窗口 webview 上执行 JS |
| core | predefined-multi-window | clipboard/selectAll | ✅ Tray SelectAll 子窗口 — 全选子窗口内容 | **T1** | 应用已启动；已创建子窗口；子窗口有文本内容 | 1. 确保子窗口有焦点 2. 右键点击托盘图标打开菜单 3. 点击 SelectAll 4. 观察子窗口文本选中状态 | ① 子窗口中所有文本被选中 ② 主窗口的文本未被选中 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 41390）：hilog `execute-predefined 'selectAll' resolvedWindowId=1` → `T5selAll invoked`；用户目视确认子窗口文本全选且主窗口文本未受影响。验证 SelectAll 操作在目标窗口 webview 上执行 |
| core | predefined-multi-window | clipboard/copy | ✅ Tray Copy 主窗口 — 复制主窗口选中文本 | **T1** | 应用已启动；主窗口有可选择的文本 | 1. 点击主窗口使其成为焦点 2. 在主窗口中选中一段文本 3. 右键点击托盘图标打开菜单 4. 点击 Copy 5. 在其他位置粘贴验证 | ① 复制目标为主窗口选中文本（OHOS 剪贴板读限制下以 hilog 判据验证） | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 41390）：hilog `execute-predefined 'copy' resolvedWindowId=0` → `getTargetController windowId=0 wmHit=false fallbackToExecutor=true` → `copy textLen=24` 成功——主窗口走 executor controller fallback 路径。验证 fallback 到主窗口 controller 仍然正常工作 |
| core | predefined-multi-window | hide-restore | ✅ Menu Hide → 托盘左键恢复 | **T0** | 应用已启动；已创建 Full Test Tray；QuickOperation 的 abilityName 已清空（点击 "Disable QuickOp" 或将 abilityName 置空），确保左键点击托盘图标触发 icon click 事件 | 1. 右键点击托盘图标打开菜单 2. 点击 Hide 3. 确认应用隐藏到后台 4. 左键点击状态栏托盘图标 | ① 步骤 3 应用隐藏，所有窗口不可见 ② 步骤 4 应用恢复到前台，窗口重新可见 ③ hilog 输出 `startAbility succeeded` | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 41390）：hilog `execute-predefined 'hide' resolvedWindowId=0`（14:40:37.669，应用隐藏）→ 左键 `iconClickHandler fired` → `forwarding clickType=leftClick` → `startAbility succeeded`（14:40:40.321，恢复前台）；用户目视确认隐藏与恢复。验证：hide → hideAbility() + 托盘 startAbility() 恢复；QuickOperation abilityName 必须清空，否则左键点击打开 QuickOp 面板而非触发恢复 |
| core | predefined-multi-window | hide-restore | ✅ Menu Close 主窗口 → 托盘左键恢复 | **T0** | 应用已启动；已创建 Full Test Tray；QuickOperation 的 abilityName 已清空 | 1. 点击主窗口使其成为焦点 2. 右键点击托盘图标打开菜单 3. 点击 CloseWindow 4. 确认应用隐藏到后台 5. 左键点击状态栏托盘图标 | ① 步骤 4 应用隐藏（主窗口 close 等价于 hideAbility），所有窗口不可见 ② 步骤 5 应用恢复到前台 ③ hilog 无 crash 或 freeze | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 41390）：hilog `execute-predefined 'close' resolvedWindowId=0`（14:40:47.330，应用隐藏）→ 左键 `iconClickHandler fired` → `startAbility succeeded`（14:40:50.702，恢复前台）；进程存活、无 crash/freeze 日志；用户目视确认隐藏与恢复。验证：closeWindow(id=0) → hideAbility()；主窗口不可 destroyWindow（WindowStage 会失效） |
| core | predefined-multi-window | window-lifecycle | ✅ Menu Minimize — 最小化到最近任务 | **T1** | 应用已启动 | 1. 右键点击托盘图标打开菜单 2. 点击 Minimize | ① 窗口最小化到最近任务列表 ② 从最近任务列表点击可恢复应用 ③ 行为与修改前一致（未回归） | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 41390）：hilog `execute-predefined 'minimize'` → `minimizeWithRestoreGuard: waiting for WINDOW_ACTIVE (50ms fallback)` → `minimizeWithRestoreGuard: minimizing (settled)` + 系统 `WMSPc: OnMinimize Window [704] minimize end, ret=0`；用户目视确认最小化与恢复。验证：minimize 行为不变 |
| core | predefined-multi-window | window-lifecycle | ✅ Menu Quit — 应用退出 | **T1** | 应用已启动 | 1. 右键点击托盘图标打开菜单 2. 点击 Quit | ① 应用完全退出 ② 不在最近任务列表中 ③ 行为与修改前一致（未回归） | **2026-08-31 复验 PASS（上库前终验，含修复）**（MateBook Pro）：修复前（pid 61367）quit 走 Rust `std::process::exit(0)`，appspawn 拦截直接 exit 调用转 SIGABRT（faultlog `LastFatalMessage: Unexpected call: exit(0)`），每次 Quit 在 faultlogger 留一条 cppcrash 记录；已修（tray-icon event.rs 删 exit(0) 特判，quit 并入 execute-predefined bridge 分发臂）→ ArkTS `execute-predefined 'quit'` → PredefinedActionExecutor case 'quit' → `context.terminateSelf()` 优雅终止。修复后复验（pid 12217，15:40:22）：`menuClickHandler forwarding menuCode=17` → `execute-predefined 'quit'` → `[RunEvent] ExitRequested, code=None → Exit` 退出链全出 → `Kill Reason:app exit`（优雅退出），faultlogger **零新增** cppcrash；应用退出且不在最近任务（用户目视确认） |
| core | predefined-multi-window | icon-click | ✅ 前台点击托盘图标 — 无副作用 | **T1** | 应用已启动且在前台；已创建 Full Test Tray；QuickOperation 的 abilityName 已清空 | 1. 确保应用在前台显示 2. 左键点击状态栏托盘图标 | ① 应用保持在前台，无闪烁或抖动 ② Tray 页面消息输出 `tray event: {"type":"click",...,"button":"Left","buttonState":"Up"}`（TrayIconEvent 已转发到前端） ③ hilog 无错误日志 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 61367）：hilog `statusBarIconClick` → `iconClickHandler fired` → `iconClickHandler forwarding clickType=leftClick` → `forwarded clickType=leftClick ok`（15:19:48.979-982，主线程 tid=pid）；用户目视确认应用无闪烁、Tray 页面输出 tray event 消息。验证：startAbility() 幂等安全 + iconClickHandler → bridge icon-click → Rust TrayIconEvent 事件链完整 |
| core | predefined-multi-window | restore | ✅ Tray ShowAll — 隐藏后恢复应用 | **T0** | 应用已启动；已创建 Full Test Tray（含 ShowAll 菜单项） | 1. 右键点击托盘图标打开菜单 2. 点击 Hide 3. 确认应用隐藏 4. 右键点击托盘图标打开菜单 5. 点击 ShowAll | ① 步骤 3 应用隐藏到后台 ② 步骤 5 应用恢复到前台 ③ 所有窗口可见 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 61367）：hilog `execute-predefined 'hide'`（15:12:33.288，应用隐藏）→ `execute-predefined 'showAll'`（15:12:37.824，恢复前台）；用户目视确认。验证：showAll → showAbility() + 遍历窗口 showWindow()；修复记录：tray-icon event.rs 曾缺 showAll/bringAllToFront 分发臂（log `unsupported predefined action`），已补 |
| core | predefined-multi-window | restore | ✅ Tray BringAllToFront — 隐藏后恢复应用 | **T0** | 应用已启动；已创建 Full Test Tray（含 BringAllToFront 菜单项） | 1. 右键点击托盘图标打开菜单 2. 点击 Hide 3. 确认应用隐藏 4. 右键点击托盘图标打开菜单 5. 点击 BringAllToFront | ① 步骤 3 应用隐藏到后台 ② 步骤 5 应用恢复到前台 ③ 所有窗口可见 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 61367）：hilog `execute-predefined 'hide'`（15:14:48.564）→ `execute-predefined 'bringAllToFront'`（15:14:52.346，恢复前台）；用户目视确认。验证：bringAllToFront 在 OHOS 上等价于 showAll（无跨应用置顶权限） |
| core | predefined-multi-window | restore | ✅ BringAllToFront 子窗口恢复 | **T1** | 应用已启动；已创建子窗口；子窗口处于最小化状态 | 1. 确保主窗口可见 2. 右键点击托盘图标打开菜单 3. 点击 BringAllToFront | ① 主窗口保持可见 ② 被最小化的子窗口恢复显示 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 61367）：hilog `execute-predefined 'bringAllToFront'` ×2（15:13:17.524 / 15:13:44.856）→ 子窗口恢复显示（用户目视确认）；此前缺陷：修复前该点击仅打出 `[TrayIcon] unsupported predefined action: showAll`（tray-icon/src/platform_impl/ohos/event.rs execute_predefined_action match 缺臂），ArkTS 收不到请求、子窗口不恢复，SCB 主窗口自动 Show reason:4 副作用曾遮蔽主窗口场景；已修（match 臂补 showAll/bringAllToFront）并重建验证。验证：遍历 WindowManager 所有窗口调用 showWindow() 可恢复最小化子窗口 |
| core | predefined-multi-window | restore | ✅ 前台点击 ShowAll — 无副作用 | **T1** | 应用已启动且在前台；已创建 Full Test Tray（含 ShowAll 菜单项） | 1. 确保应用在前台，所有窗口可见 2. 右键点击托盘图标打开菜单 3. 点击 ShowAll | ① 应用保持在前台，无闪烁或异常 ② 所有窗口保持可见 ③ hilog 无错误 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 61367）：hilog `execute-predefined 'showAll'`（15:15:17.199）正常分发、无 error/unsupported 日志；用户目视确认无闪烁错位。验证：showAbility() 幂等安全，showWindow() 对已可见窗口不产生副作用 |
| core | predefined-multi-window | clipboard/copy | ✅ MenuBar Copy 主窗口 — 通过 MenuBar 触发 Copy | **T0** | 应用已启动；主窗口有可选择的文本 | 1. 点击主窗口 MenuBar 打开菜单 2. 点击 Edit → Copy 3. 在其他位置粘贴验证 | ① 复制目标为主窗口选中文本（OHOS 剪贴板读限制下以 hilog 判据验证） ② 操作目标为主窗口 webview | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 41390）：hilog `MenuBar: menuItem onClick id=13 windowId=0 handler=found` → `Menu: handleItemClick ENTER id=13 type=predefined predefinedType=copy` → `[TrayCopyDiag] T1 execute type=copy targetWindowIdParam=0 resolvedWindowId=0`（targetWindowId 有值，直接操作菜单所属窗口）→ `copy textLen=94` 成功。验证：Window Menu Bar 路径 targetWindowId 有值，直接操作菜单所属窗口 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| Predefined Multi-Window（预定义操作多窗口支持） | 6 | 8 | **14** |

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
| core | sentry | JS Error 捕获 | ✅ JS Error Capture — WebView JS 异常捕获 | **T0** | 应用已启动；点击 "JS Error Capture" 按钮 | 1. 打开 DevEco Studio 检查日志 2. 点击 "JS Error Capture" 按钮 | ① 日志 输出 `[Sentry Test] Caught error: Error: OHOS test error from examples/api` ② `[ManualTest] Completed: sentryJsError` 确认测试完成 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 41059）：hilog ARKWEB-CONSOLE `[Sentry Test] Caught error: Error: OHOS test error from examples/api` + `[ManualTest] Completed: sentryJsError in 1 ms`；且 app 启动时 Sentry JS SDK 全套 Integration 注入日志可见（LinkedErrors/Dedupe/HttpContext/InboundFilters/Breadcrumbs/GlobalHandlers 等，Global Handler attached: onerror/onunhandledrejection），证明 js_init_script 注入成功。若 js_init_script 未注入，JS error 仍会被 WebView console.error 记录；注入验证：在 WebView 中执行 `typeof Sentry !== 'undefined'` |
| core | sentry | Rust Panic 捕获 | ✅ Rust Panic Capture — Rust panic 导致 app 崩溃 | **T1** | 应用已启动；点击 "Rust Panic (may crash)" 按钮 | 1.1. 打开 DevEco Studio 检查日志 2. 点击 "Rust Panic (may crash)" 按钮 3. 等待 2 秒，app 崩溃退出 4. 查看crash日志 | ① app 崩溃退出（预期行为，SIGABRT） ② cppcrash 日志 `Reason` 行包含 `Signal:SIGABRT(SI_TKILL)` ③ 栈回溯中 `libapi_lib.so` 出现在顶层帧（Rust panic → abort） ④ 崩溃时间与按钮点击时间吻合 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, release 包，两次复现）：第一次 pid 52915 点击 14:18:55.312（`Starting: sentryRustPanic`，内含 2s 延迟）→ 崩溃 14:18:57.375；第二次 pid 41059（release 包重启后复测）崩溃 14:32:49.853。两份 cppcrash 均 `Reason:Signal:SIGABRT(SI_TKILL)` + 故障线程 #02 起连续多帧 `libapi_lib.so`；设备 panic.log 均记录 `PANIC: panicked at examples\api\src-tauri\src\cmd.rs:1359:3: sentry test panic from examples/api`（OHOS 链式 panic hook：先写 panic.log 再调 sentry hook）。**模式定性（2026-08-31 修订）**：`sentry_test_panic` 与 sentry init/panic hook 均无 debug 门控，release 同样触发崩溃与本地捕获；远端上报需编译期 `SENTRY_DSN` 非空（当前为空 → 仅本地捕获）。TestRunner.svelte 中"only compiled in debug builds"注释为过时描述。panic 导致进程退出需重启应用；breadcrumb/envelope/rust_breadcrumb 的 IPC 通路由自动测试 #74-#76 覆盖 |

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
| core | unstable | phase2/reparent | ✅ webview.reparent returns error — 防死锁验证 | **T0** | 应用已启动，进入 TestRunner 页面 | 1. 找到 `reparent returns error (no deadlock)` 2. 点击运行 3. 观察测试是否在 5 秒内完成 | ① 测试状态 PASS ② 查看日志 `webview.reparent(window)` 返回 Error ③ 不卡住（无 timeout） | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 52915）：hilog `Webview reparent is not supported on OHOS (BuilderNode is bound to UIContext)` → 控制台 `reparent() returned error (expected): runtime error: failed to send message to the webview`，40ms 完成无卡死。验证：`#[cfg(target_env = "ohos")]` Reparent handler 调用 `tx.send(Err(...))` 解除 `rx.recv()` 阻塞 |
| core | unstable | phase2/reparent | ✅ webview operations after failed reparent — 无级联死锁 | **T1** | 应用已启动 | 1. 找到 `reparent cascade check` 2. 点击运行 | ① 测试状态 PASS ② 查看日志 `webview.size()` 正常返回非零值 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 52915）：hilog `After failed reparent, webview.size() = (380,380)`（非零）+ `Mutex released, no cascade deadlock: PASS ✅`，46ms 完成。验证 reparent 失败后 `current_window_id` Mutex 锁被释放 |
| core | unstable | phase3/multi-webview | ✅ webview.create_webview — multi-webview 创建验证 | **T0** | 应用已启动；**Cargo.toml 需启用 `unstable` feature** | 1. 找到 `create_webview (multi-webview)` 2. 点击运行 3. 观察子 webview 出现 4. 等待 1 秒后子 webview 自动关闭 | ① 测试状态 PASS ② 子 webview 出现，显示 "Child Webview"（浅灰背景），1 秒后关闭 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 52915）：hilog `create: id=test-child-1788156803705 windowId=0 isSubWindow=false` → HTML 解析 "Child Webview" → Page Begin/End → `Child webview closed`，全程 1281ms；用户目视确认出现与关闭。 |

| 模块 | T0 | T1 | 合计 |
|------|-----|-----|------|
| **合计** | **2** | **1** | **3** |

---

## 十七、Global Shortcut（全局快捷键）手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| plugin | global-shortcut | 注册与触发 | ✅ Register Shortcut — 注册快捷键并物理键盘触发 | **T0** | 应用已启动；设备连接物理键盘；进入 Tests 页面底部 Global Shortcut Manual Tests 区域 | 1. 点击 "Register Ctrl+Shift+T" 按钮 2. 确认状态显示 "Registered: CommandOrControl+Shift+T" 3. 用物理键盘按下 Ctrl+Shift+T | ① 状态变为 "Triggered! id=xxx, state=Released" ② 控制台输出 `[global-shortcut] Shortcut triggered: id=xxx, state=Released` | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 52915）：hilog `GlobalShortcut: Registered hotkey id=4183485263 key=T modifiers=Control+Shift` + 系统 `KeyShortcutManager: Register global key [No.2019](0x6,2036,SESSION:52915)`（inputConsumer 系统级注册成功）；按键后 `hotkeyChange callback fired id=4183485263` + `Pressed event dispatched` → 控制台 `Shortcut triggered: id=4183485263, state=Pressed` 与 `state=Released` 双行。OHOS 使用 inputConsumer API（API 14+），仅在 key-down 时触发 Pressed 回调；代码合成 Released 事件以匹配 global-hotkey 合约，UI 最终显示 Released；最多支持 2 个修饰键 |
| plugin | global-shortcut | 注销验证 | ✅ Unregister All — 注销后快捷键不再触发 | **T0** | 已注册 Ctrl+Shift+T 且已验证触发成功 | 1. 点击 "Unregister All" 按钮 2. 确认状态显示 "All shortcuts unregistered" 3. 用物理键盘再次按下 Ctrl+Shift+T | ① 状态不再变为 "Triggered" ② 快捷键已被注销，系统不再拦截该组合键 | **2026-08-31 复验 PASS（上库前终验）**（MateBook Pro, pid 52915）：hilog `GlobalShortcut: unregister-all` + 系统 `KeyShortcutManager: Unregister global key(0x6,2036,SESSION:52915)`（inputConsumer.off 精确注销）→ 控制台 `All shortcuts unregistered`；其后再次按键无任何 `hotkeyChange`/`Shortcut triggered` 日志，验证 inputConsumer.off() 精确注销，不影响其他应用的快捷键 |

---

## 十八、Window Focus（窗口聚焦）手动用例

> **背景**: 窗口聚焦（set_focus）需要人眼确认的手动测试。
>
> **测试入口**: `examples/api` 应用 → Tests 页面 → **Window Focus + Hotkey Zoom Manual Tests** 区域

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | 窗口聚焦 | 多窗口层级 | Window Focus 多窗口层级验证 ✅ | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Window Focus" 创建子窗口 2. 手动将其他子窗口拖到该窗口上方 3. 再次点击 "Window Focus" | ① 首次点击创建 Float 子窗口 ② 再次点击调用 `setFocus()` → `raiseToAppTop()` ③ 窗口回到所有 Float 窗口最上方 | **2026-08-31 验证 PASS（上库前终验）**（3QC0124C11000038，pid 52915）：11:57:21/11:57:54 两次 `[WRY] set_focus → RaiseToAppTop: id:699 [focus-test-window] zorder raise success`，窗口回顶层（用户确认）。注：按钮流程为"创建→等 2s→setFocus"，首次创建点击的 setFocus 偶发 `Unknown OS sub-window '9'`（窗口注册表异步未就绪的时序竞态，hilog 11:57:19 实录），再次点击即成功——与本用例"再次点击聚焦"步骤吻合，良性；与 [[ohos-window-plugin-registry-gap]] 同族。`Message::Task` 派发到主线程 → `focus_window(id)` → NAPI → `WindowManager.focusWindow` → `win.raiseToAppTop()` |

---

## 十九、Vibrancy（窗口模糊）手动用例

> 自动用例 2 个（side-effect）：
> 1. `window.setEffects(Blur/Acrylic) + clearEffects` 不抛错（运行时 setEffects，AttributeUpdater 刷新 backdropBlur/backgroundColor；Mica/Tabbed 系列在 OHOS 上为 no-op 跳过）
> 2. `create_transparent_window(effect=Blur)` build 时 effects 不抛错（WindowBuilder::effects，registerController inject）
>
> 以下为手动用例，通过 Tests 视图的手动按钮触发。vibrancy 窗口用 create_transparent_window（Float 子窗口，避开 UIAbility singleton 冲突）。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | vibrancy | Blur | Blur effect visible ✅ | **T0** | 应用已启动，进入 Tests 视图 | 1. 点击 "vibrancy: Blur effect visible" 手动测试按钮 2. 观察弹出的透明窗口 | 窗口背景呈磨砂模糊（backdropBlur(25)），能透出背后内容且带模糊 | **2026-08-31 验证 PASS（上库前终验）**（3QC0124C11000038，pid 52915）：11:49:44 `[vibrancy] applied effect Blur to window_id 1` + `blur refresh: id=manual-vibrancy-Blur radius=25`，毛玻璃现象用户确认。窗口加载 vibrancy.html 透明页，Effect::Blur radius=25 |
| core | vibrancy | Acrylic | Acrylic effect visible ✅ | **T1** | 应用已启动，进入 Tests 视图 | 1. 点击 "vibrancy: Acrylic effect visible" 手动测试按钮 2. 观察弹出的透明窗口 | 窗口背景呈模糊 + 半透明深色 tint（blur + color） | **2026-08-31 验证 PASS（上库前终验）**（3QC0124C11000038，pid 52915）：11:49:47 `applied effect Acrylic` + `blur refresh radius=25` + `SetBackgroundColor value:2147483648`（= 0x80000000，精确对应 Effect::Acrylic color=[0,0,0,128] 的半透明黑 tint），现象用户确认。Effect::Acrylic radius=25, color=[0,0,0,128] |
| core | vibrancy | clearEffects | clearEffects removes blur ✅ | **T0** | 应用已启动，进入 Tests 视图 | 1. 点击 "vibrancy: clearEffects removes blur" 手动测试按钮 2. 观察：先模糊 1s，然后 clearEffects 后模糊消失 | ① 初始窗口背景呈磨砂模糊 ② clearEffects 后窗口背景变清晰，且无半透明颜色遮罩（完全透出背后内容，不发暗/无色调） | **2026-08-31 验证 PASS（上库前终验）**（3QC0124C11000038，pid 52915）：11:49:52.405 `blur refresh radius=25`（模糊生效）→ 1.04s 后 11:49:53.445 `blur refresh radius=0` + `SetBackgroundColor value:0`（blur 与 tint **双清除**，hilog 时序精确匹配"1s 后清除"）；第二轮（window_id 8）同样配对。现象用户确认。验证 clearEffects 同时移除 backdropBlur 和 backgroundColor tint |
| core | vibrancy | build-time effects | build-time Blur effect visible ✅ | **T0** | 应用已启动，进入 Tests 视图 | 1. 点击 "vibrancy: build-time Blur (WindowBuilder::effects)" 手动测试按钮 2. 观察弹出的透明窗口 | 窗口出现时即呈磨砂模糊（build 时 effects，非运行时 setEffects） | **2026-08-31 验证 PASS（上库前终验）**（3QC0124C11000038，pid 52915）：11:49:59 `Creating transparent window: manual-vibrancy-build-blur (effect=Some("Blur"), radius=Some(25.0))` → `applied effect Blur to window_id 4` **先于** `Creating sub-window`（.214）——效果在窗口创建时 apply，非运行时 setEffects；窗口一出现即毛玻璃（用户确认）。create_transparent_window(effect=Blur, radius=25)，WindowBuilder::effects |

---

## 二十、Deep-Link 手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | deep-link | onOpenUrl | onOpenUrl 事件触发 — 运行中收到外部链接 ✅ | **T0** | app 已运行 | 1. 在 TestRunner UI manual 区点击 "onOpenUrl (trigger with hdc)" 按钮注册监听 2. 执行 `hdc shell "aa start -U taurideeplink://manualtest"` | UI 消息区显示 `[deep-link] onOpenUrl received: ["taurideeplink://manualtest"]` | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 50114）：点按钮注册监听后 `aa start -U taurideeplink://manualtest` @11:46:24，hilog 全链路 `OnNewWant` → `NativeAbility onNewWant - uri: taurideeplink://manualtest` → `[RunEvent] Opened, urls=[Url{scheme:"taurideeplink",host:manualtest}]`，用户确认 UI 消息区显示 `[deep-link] onOpenUrl received`。RunEvent::Opened urls 非空时触发 |
| core | deep-link | getCurrent | getCurrent 冷启动 — 首启动链接拉起 ✅ | **T0** | app 未运行 | 1. `hdc shell "aa force-stop com.tauri.api"` 2. `hdc shell "aa start -U taurideeplink://coldstart"` 3. 等 app 冷启动后在 TestRunner UI manual 区点击 "getCurrent" 按钮 | UI 消息区显示 `[deep-link] getCurrent → ["taurideeplink://coldstart"]` | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 50204）：force-stop → `aa start -U taurideeplink://coldstart` 冷启动，hilog `onCreate`@11:47:29.515 → `[deep-link] init_deep_link OHOS branch`@.575（want.uri 存入 INITIAL_WANT_URI 的 lazy-take 注入点）→ 用户点 getCurrent 按钮显示 `coldstart`（消息区确认）。冷启动 onCreate want.uri 经 lazy take 注入 |
| core | deep-link | 外部唤起 | 外部链接唤起 app — 跨 app 跳转 ✅ | **T0** | app 已安装 | 1. `hdc shell "aa force-stop com.tauri.api"` 2. `hdc shell "aa start -U taurideeplink://foreground-test"` | app 唤起到前台（onCreate 冷启动或 onNewWant 运行中） | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 52915）：force-stop 后 `aa start -U taurideeplink://foreground-test` 冷启动唤起，系统侧实锤 `app 52915 foreground` + `Ability state changed isForeground: true, state 2` + `onCreate`@11:48:37.341。force-stop 杀死后外部 scheme 唤起成功拉起 app（module.json5 skills 匹配）。aa start -U 与浏览器 `<a href>` 走相同系统 Want 路由 |

> **验证记录**: 2026-08-28 真机（HUAWEI MateBook Pro HAD-W32, desktop 形态）3 例全 **PASS**：
> - onOpenUrl 运行中触发 **PASS**：app 运行中点 "onOpenUrl (trigger with hdc)" 注册监听后 `aa start -U taurideeplink://manualtest`（11:20:54），hilog 全链路：`OnNewWant` → `NativeAbility onNewWant - uri: taurideeplink://manualtest` → `[single-instance] callback fired! args=["taurideeplink://manualtest", ...]` → `[RunEvent] Opened, urls=[taurideeplink://manualtest]` → `opened urls: [...]`。后端 RunEvent::Opened urls 非空触发，前端 onOpenUrl 回调显示该 url。
> - getCurrent 冷启动 **PASS**：force-stop → `aa start -U taurideeplink://coldstart` 冷启动（pid 55083，11:21:31），hilog：`onCreate` → `NativeAbility onCreate - moduleName: "api_lib"` → **`[deep-link] init_deep_link OHOS branch`**（onCreate 时把 want.uri 存入 INITIAL_WANT_URI 的 lazy-take 注入点）→ `[RunEvent] Ready/Resumed`。app 就绪后点 "getCurrent" 按钮，前端显示 `[deep-link] getCurrent → ["taurideeplink://coldstart"]`（ARKWEB-CONSOLE 域 A01194）。lazy-take 注入链路实锤。
> - 外部唤起 **PASS**：force-stop → `aa start -U taurideeplink://foreground-test`，app 冷启动唤起到前台（pid 55505，11:23:09 `onCreate` → `[RunEvent] Resumed`）。force-stop 杀死后外部 scheme 唤起成功拉起 app，跨 app 跳转路径正常（module.json5 skills 匹配 taurideeplink scheme）。

## 二十一、Window Operations（窗口操作）手动用例

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | window-ops | minimize | 窗口最小化与恢复 ✅ | **T0** | app 已运行，进入 Tests 视图 | 1. 在 TestRunner UI 底部 "Window Operations" 区找到 "Minimize then is_minimized" 按钮，点击 2. 窗口最小化到任务栏 3. 从任务栏点击 app 图标恢复窗口 4. 查看按钮下方显示的测试结果 | ① 窗口成功最小化到任务栏 ② 按钮下方显示 `isMinimized() = true` → PASS ③ 从任务栏恢复窗口后底部内容完整无缺失 | `win.minimize()` 调 `window.Window.minimize()`（API11）；`is_minimized()` 调 `getWindowStatus() === MINIMIZE`。恢复通过任务栏点击（系统行为），非 API 调用。**2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 50114）：11:42:31.969 hilog `minimize() -> isMinimized() = true` + `如 isMinimized() = true -> PASS`（1581ms），最小化+任务栏恢复正常（用户确认） |
| core | window-ops | window-state | 窗口位置记忆与恢复 ✅ | **T0** | app 已运行 | 1. 将窗口拖动到一个明显的位置（如左上角） 2. 在 TestRunner UI 底部 "Window Operations" 区找到 "Window-State Save" 按钮，点击（保存当前位置） 3. 重启 app：终端执行 `hdc shell aa force-stop com.tauri.api` 后重新启动 4. 观察重启后窗口的位置变化 5. 也可在重启后点击 "Window-State Restore" 按钮手动恢复 | ① 重启后窗口先出现在屏幕中心（OS 默认位置） ② 随后窗口自动闪现到步骤 1 保存的位置 ③ 注意：自动测试中的 "set_position moves window" 用例会调 `setPosition(100,100)` 移动主窗口，可能覆盖恢复结果——请等自动测试跑完后（约 30 秒）再观察窗口最终位置 | OHOS 适配要点：① restore_state 从文件读取保存的位置（绕过被 Moved 事件覆盖的内存缓存）② 在 `RunEvent::Ready` 时对主窗口触发 restore（OHOS 的 `on_window_ready` 不对主窗口触发）③ `moveWindowTo` 对主窗口（id=0）用 `windowStage.getMainWindowSync()` 获取窗口句柄 ④ NAPI 调用用 Object 传参 ⑤ `inner_size()` 返回 window_rect 使 save→resize 循环幂等 ⑥ OHOS 跳过 `RunEvent::Exit` 自动保存。**2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 43431→50114）：save 按钮（"window-state save/restore"，657ms）落盘 `.window-state.json` 2696 bytes，`main:{width:2388,height:1440,x:-171,y:21}`（hdc cat 实锤）；force-stop 重启后 `[RunEvent] Ready`@11:41:21.495 → 双次 `ohos.window/restore` TSFN bridge → SCB `OnRestoreMainWindow`@.716 → **用户视觉确认窗口闪回 x=-171/y:21 保存位置**。本轮为交互包（无自动测试），预期③的 setPosition 干扰不适用 |
| core | window-ops | resize | 窗口缩放后底部内容完整 ✅ | **T0** | app 已运行，页面有可滚动内容 | 1. 用鼠标拖动窗口右边缘或下边缘向内缩小窗口 2. 松开鼠标后观察页面底部内容是否完整显示 3. 再拖动边缘向外放大窗口 4. 松开鼠标后再次观察 5. 重复缩放操作 3-5 次 | ① 缩小窗口后底部内容完整可见，无裁剪 ② 放大窗口后底部内容完整可见 ③ 多次缩放均正常 | 根因：commit `6fd8c0a` 把 Web 组件尺寸改为 `.width(data.style.width)`（BuilderNode.update 不通知 ArkWeb 重新布局）→ 缩放后底部被裁。修复：Web `.width/.height` 改回 `"100%"` 自然布局。**2026-08-31 复验 PASS（上库前终验）**（用户视觉确认多次缩放底部内容完整无裁剪） |
| core | persisted-scope | save | fs scope 保存到文件 ✅ | **T0** | app 已运行（建议先点 "Persisted-Scope Clear" 清掉旧 `.persisted-scope` 避免残留干扰） | 1. 在 TestRunner UI 底部 "Window Operations & Persisted-Scope Manual Tests" 区点击 "Persisted-Scope Test" 按钮 2. 查看按钮下方显示的结果 3.（可选）`hdc shell ls -l <结果中的 state_file 路径>` 核对文件落盘 | ① `allow_directory: ✅ 成功` ② `.persisted-scope 文件: ✅ 已生成 (N bytes)` ③ `路径:` 显示 state_file 完整路径 | 因 OHOS 不支持 DragDrop，通过自定义 `test_persisted_scope` command 直接调 `scope.allow_directory(test_path, true)` 触发 PathAllowed 事件 → persisted-scope 插件写 `.persisted-scope`（bincode）。**2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 43431）：先 Clear 清旧档（48ms）→ Test 输出 `.persisted-scope 文件: ✅ 已生成 (500 bytes)` + 路径 `/data/storage/el2/base/haps/entry_desktop/files/.persisted-scope`（49ms） |
| core | persisted-scope | restore | 重启后 fs scope 自动恢复 ✅ | **T0** | 已执行 save 用例（`.persisted-scope` 文件已生成） | 1. 重启 app：`hdc shell aa force-stop com.tauri.api` 后重新启动 2. 重启后**先不要点 Test**（点 Test 会再次 `allow_directory` 同一路径，使 count 恒定，掩盖 restore 是否生效） 3. 直接点击 "Persisted-Scope Clear" 按钮 4. 查看按钮下方**结果框**的 `remaining_patterns_count`（消息区会被 "Console log saved" 覆盖，看结果框或 hilog） | ① `文件删除: ✅ 已删除`（证明 `.persisted-scope` 跨重启留存）+ `remaining_patterns_count > 0` → ✅ restore 生效 ② `remaining_patterns_count = 0` → ❌ restore 失败 | persisted-scope 插件 setup 时读 `.persisted-scope`（bincode 反序列化）并恢复 fs scope。**count 判据**：`allow_directory(path, true)` 一次实际产生 **4 个 pattern**（`push_pattern` 的 canonicalize_parent 变体 + 各自 `/**`，`fs.rs:87,126-128`），幂等去重不累积；判据为 `count > 0`。**2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 43431→50114）：save 落盘 500 bytes → force-stop 重启 → hdc `ls` 实锤 `.persisted-scope` 跨重启留存（500 bytes, mtime 11:41，setup 幂等重写）→ 重启后首次 Clear 删除成功（用户操作，判据①）→ 第二次 Clear 读到 `内存中剩余 patterns: 4 个`（>0，判据② restore 生效；恰等于单次 allow_directory 的 4 pattern 理论值）。注：第二次 Clear 显示"文件不存在（无需删除）"是因为首次 Clear 已删，属操作时序非异常 |

## 二十二、Opener（打开文件/URL）手动用例

> autotest 已移除（原 `category:'manual'` 被运行器一律 skip，零覆盖）。opener 的 OHOS 实现走 `openharmony_ability::open_with_system` / plugin-url bridge `reveal-in-dir`（系统意图），行为依赖系统，必须人眼验证。测试入口：TestRunner 底部 "Plugins Manual Tests" 区按钮。
>
> **revealItemInDir 平台限制说明**：OHOS 文件管理器**不支持高亮选中文件**（无此 API），只能打开目标路径的**父目录**。**应用沙箱路径**（appCacheDir、`/data/storage/` 等）无法在文件管理器打开（平台限制，非 bug），会返回 documented 错误；只有**公共目录**（`/storage/media/100/local/files/<顶层>` 且顶层可映射为 FM 虚拟名）可 reveal。
>
> **验证记录**: 2026-08-28 真机（HUAWEI MateBook Pro HAD-W32）4 例：
> - openPath **PASS**：`openPath(/data/storage/el2/base/haps/entry_desktop/cache/opener-<ts>.txt) called.`（159ms）。文件落盘（病毒扫描印证），系统弹"选择打开方式"AppSelector（`isFileOpenScene:true reqMimeType:.txt`，10:49:43.966）——OHOS 无默认 txt handler 故弹选择器，符合预期②"或文件管理器"兜底。`plugin:opener|open_path` ok=true。
> - revealItemInDir 沙箱 **PASS**：`→ documented error (expected)` 错误含 `cannot open app-sandbox paths` + `This is a platform limitation`（59ms），`respond ok=false` 未拉起 FM。文件落盘 `opener-reveal-<ts>.txt`。与 [[reveal 文件管理器 uri 形态]] 一致。
> - revealItemInDir 公共目录 **PASS**（2026-08-28，Want 参数修复后真机验证）：根因是 Want 参数放错位置——代码把 URI 放 `want.uri`（顶层）但 FM MainAbility 只读 `want.parameters.fileUri` + `want.parameters.external_storage_uuid`，`want.uri` 被忽略→FM 默认导航 home（停主页）。修复（UrlPlugin.ets:195-209）：URI 改放 `parameters.fileUri` + `external_storage_uuid="LOCAL"`。真机验证：`initAddressByWant startAbilityFileUri: file://docs/storage/Users/currentUser/Documents`（修复前是 `home`）→ 双阶段 `setCurrentUri`（先 `myPC` 中间态，最终 `= file://docs/.../Documents`）= 导航成功。注：Rust 侧 `reveal_item_in_dir.rs:98` 取 `path.parent()`，故无论输入 `Docs` 或 `Docs/IDEProjects`，parent 均为 `.../Docs` → 映射 `Documents`（app 语义下 reveal 总打开文件所在父目录）。2026-08-20 旧"PASS"实为误报（FM 停首页/我的电脑被误读）；`empty uri when get uuid` 是 FM 每次启动的噪音非 URI 拒绝。见 [[reveal 文件管理器 uri 形态]]。
> - openUrl **PASS**：`openUrl('https://tauri.app') called.`（76ms）+ 浏览器 `com.huawei.hmos.browser` 拉起（pid 43906），DNS `tauri.app`→2 A 记录→TCP→SSL 证书校验→加载页面。`plugin:opener|open_url` ok=true。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | opener | openPath | Opener openPath — 打开文件 ✅ | **T0** | app 已运行，进入 TestRunner → "Plugins Manual Tests" 区 | 1. 点击 "Opener openPath (open file)" 按钮 2. 观察系统反应 3. 查看按钮下方 manualResult 输出 | ① manualResult 输出 `openPath(<appCacheDir>/opener-<ts>.txt) called.` ② 系统弹出默认文本查看器/编辑器打开该文件（或文件管理器） ③ 无 `OpenharmonyAbility` 错误 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 43431）：11:35:46 `openPath(.../opener-1788147346381.txt) called.`（605ms）+ 系统侧 AppSelector 弹窗实锤（`AppSelectorExtensionAbility com.huawei.hmsapp.appgallery` session 创建 @11:33:17 首轮）。OHOS 无默认 txt handler→弹"选择打开方式"AppSelector（符合②兜底）。实现：`commands.rs:84` `open_path` → `openharmony_ability::open_with_system(file_uri)` |
| core | opener | revealItemInDir | Opener revealItemInDir — 沙箱路径返回 documented 错误 ✅ | **T0** | app 已运行 | 1. 点击 "Opener revealItemInDir (sandbox→err)" 按钮 2. 查看 manualResult 3. 观察系统反应 | ① manualResult 输出 `revealItemInDir(<appCacheDir>/opener-reveal-<ts>.txt) → documented error (expected):` ② 错误信息含 `app-sandbox paths` / `platform limitation` ③ 文件管理器/备忘录**不**打开 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 43431）：11:35:52 `revealItemInDir(.../opener-reveal-1788147352899.txt) → documented error (expected)` + `[reveal-in-dir] OHOS file manager cannot open app-sandbox paths` + `This is a platform limitation`（80ms），全程无 FM 拉起（hilog 无 filemanager StartAbility）。实现：`reveal_item_in_dir.rs` OHOS imp → `UrlPlugin.ets` `mapToVirtualUri` 沙箱检测 → 错误上抛 |
| core | opener | revealItemInDir | Opener revealItemInDir — 公共目录打开 FM ✅ | **T0** | app 已运行；输入框路径默认 `/storage/media/100/local/files/Docs/IDEProjects`（该目录需真实存在，可改为 Docs 下任意已存在文件/目录） | 1. 在输入框确认/填入公共目录下真实存在的路径 2. 点击 "Opener revealItemInDir (public dir→FM)" 3. 观察 FM | ① FM 打开所填路径的**父目录**（地址栏显示 `我的电脑>文档>...`） ② **不**高亮选中文件（OHOS 无此能力，平台限制，非 FAIL 项） ③ 无错误 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 43431）：11:33:33 `revealItemInDir(/storage/media/100/local/files/Docs/IDEProjects) called.`（44ms）→ hilog 实锤 `StartAbility com.huawei.hmos.filemanager/MainAbility` @11:33:33.075 + FM 窗口创建（windowNum 1→2，pid 21725）→ 用户确认 FM 落在父目录（文档），未高亮（平台限制）。Rust `reveal_item_in_dir.rs:98` 取 `path.parent()`，故 reveal 总打开父目录。实证形态：显式 Want `{bundleName:com.huawei.hmos.filemanager, abilityName:MainAbility, moduleName:pc, parameters:{fileUri:<虚拟uri>, external_storage_uuid:"LOCAL"}}`（UrlPlugin.ets:195-209 修复后）。注：FM 自身 ArkCompiler/AceStateMgmt 错误日志是 FM 内部噪音非我方缺陷；`empty uri when get uuid` 是 FM 启动噪音 |
| core | opener | openUrl | Opener openUrl — 打开 URL ✅ | **T0** | app 已运行；设备已联网 | 1. 点击 "Opener openUrl (open browser)" 按钮 2. 观察系统反应 3. 查看 manualResult | ① manualResult 输出 `openUrl('https://tauri.app') called.` ② 系统浏览器打开 https://tauri.app ③ 无错误 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 43431）：11:33:41 `openUrl('https://tauri.app') called.`（84ms）→ 系统侧实锤浏览器拉起（`com.huawei.hmos.browser` pid 25097，`caller pid: 43431, bundleName: com.tauri.api, tabOpenType:1` @11:33:44）。实现：`commands.rs:42` `open_url` → `openharmony_ability::open_with_system(url)`。**autotest 从未覆盖 openUrl**，仅手动验证 |

---

## 二十三、Store（持久化存储）手动用例

> autotest 仅覆盖内存 CRUD（set/get/has/keys/entries/delete/close），**刻意不碰 Exit/Drop 路径**。store timeout 修复（OHOS Drop-skip `store.rs:644`、Exit `save_or_skip` `store.rs:555`/`lib.rs:454`）是 defense-in-depth，autotest 不覆盖；磁盘持久化（set→退出→重开→数据在）也需手动验证。测试入口：TestRunner "Plugins Manual Tests" 区。
>
> **验证记录**: 2026-08-28 真机（HUAWEI MateBook Pro HAD-W32）3 例全 **PASS**：
> - 持久化-写入 **PASS**：`store.save() done. key='manual-sentinel' value='persisted-1787884832317' → manual-store.json.`（61ms）。病毒扫描日志印证落盘 `/data/app/el2/100/base/com.tauri.api/haps/entry_desktop/files/manual-store.json`。IPC `plugin:store|load→set→save` 全 `ok=true`。
> - 持久化-恢复 **PASS**：force-stop（pid 30862→35681）重启后 `store.get('manual-sentinel') → {"value":"persisted-1787884832317"}` + `PASS: value persisted across restart.`（44ms）。sentinel 值跨重启完全一致，磁盘反序列化恢复。
> - Exit 不阻塞 **PASS**：关主窗 CloseRequested(10:44:17.024)→Destroyed→ExitRequested→`[RunEvent] Exit`(10:44:17.033)→进程 `exit with code:0`(10:44:17.149)，全程 9ms 干净退出。零条 `StoreInner locked`/`save_or_skip` 异常、零 `appfreeze`/`THREAD_BLOCK`/ANR。OHOS Drop-skip（`store.rs:644`）+ Exit `save_or_skip` 降级（`store.rs:555`）未阻塞退出。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | store | 持久化-写入 | Store Persist — set+save 落盘 ✅ | **T0** | app 已运行 | 1. 点击 "Store Persist (set+save)" 按钮 2. 查看 manualResult | ① manualResult 输出 `store.save() done. key='manual-sentinel' value='persisted-<ts>' → manual-store.json.` ② 无错误 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：11:27:00.784 `store.save() done. key='manual-sentinel' value='persisted-1788146820740' → manual-store.json.`（96ms），无错误。路径 `manual-store.json` 经 `resolve_store_path`（`store.rs:30`，`BaseDirectory::AppData`）解析到 AppData 目录落盘。autotest 不调 `save()`，本用例补此路径 |
| core | store | 持久化-恢复 | Store Verify — 重启后数据留存 ✅ | **T0** | 已执行 Persist 用例 | 1. force-stop app：`hdc shell aa force-stop com.tauri.api` 2. 重新启动 app，进入 TestRunner "Plugins Manual Tests" 区 3. 点击 "Store Verify (after restart)" 按钮 4. 查看 manualResult | ① manualResult 输出 `store.get('manual-sentinel') → {"value":"persisted-<ts>"}` ② 输出 `PASS: value persisted across restart.` ③ 若输出 `FAIL: value missing` → 持久化失败 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038）：force-stop 重启（pid 17693→42348）后 11:29:03.984 `store.get('manual-sentinel') → {"value":"persisted-1788146820740"}` + `PASS: value persisted across restart.`（48ms）——sentinel 与写入轮**逐字一致**，磁盘反序列化恢复无误。force-stop 模拟进程退出后重启 |
| core | store | Exit 不阻塞 | Store Exit — 退出无 appfreeze ✅ | **T1** | app 已运行，已 load 过 store（如执行过 Persist 用例） | 1. 正常关闭 app 主窗口（触发 `RunEvent::Exit`）2. 观察窗口是否立即关闭、无卡顿/超时 3. 重新启动 app 确认正常 | ① 窗口立即关闭，无 5s 卡顿/ANR ② 重启正常 ③ hilog 无 `store: StoreInner locked on exit, skipping save` 之外的异常 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 42348）：关主窗 CloseRequested(11:31:41.200)→Destroyed(.203)→ExitRequested(.203)→Exit(.223)→进程 `exit with code:0`(.325)，全程 125ms 干净退出（本轮含 prevent_exit 测试日志行，仍无阻塞）；零 `StoreInner locked` 异常、faultlog 无今日新增 appfreeze/cppcrash（最新分别为 8-25/8-28 旧档）；重启 pid 43431 正常。验证 OHOS Drop-skip（`store.rs:644`）+ Exit `save_or_skip` 降级（`store.rs:555`）未阻塞退出 |

---

## 二十四、Upload（文件上传）手动用例

> autotest 调 upload 并注册 progress 回调，但**只断言响应体非空，未断言 progress 回调触发**。本用例验证 progress 事件确实触发。测试入口：TestRunner "Plugins Manual Tests" 区。依赖 app 内 3003 端口 echo server（autotest upload 已验证可用）。
>
> **验证记录**: 2026-08-28 真机（HUAWEI MateBook Pro HAD-W32）**PASS**：`upload response: xxx...xxx (65536 bytes)` + `progress events: 8`（progressTotal 32768→40960→49152→57344→65536 分块递增）+ `PASS: upload succeeded`，165ms 完成。`writeFile` 64KB 文件 `upload-<ts>.txt` 落盘（病毒扫描日志印证）。备注担心的"fast small uploads 可能不触发 progress"未发生——64KB 在 localhost 触发了 8 次 progress 回调。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | upload | progress 回调 | Upload — echo + progress 触发 ✅ | **T0** | app 已运行；3003 echo server 已起（autotest upload 通过即满足） | 1. 点击 "Upload (echo+progress)" 按钮 2. 查看 manualResult | ① manualResult 输出 `upload response: xxx... (65536 bytes)` ② 输出 `progress events: 8`（N ≥ 1）③ 列出最近 5 条 progress 事件（`progress=8192 total=<递增>`）④ 输出 `PASS: upload succeeded (response received)` ⑤ 若 `FAIL: no progress events` → progress 回调未触发 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：11:22:00.071-855 hilog 五判据全中——`upload response: xxx... (65536 bytes)` + `progress events: 8` + 5 条 `progress=8192 total=32768→65536` + `PASS: upload succeeded (response received)`，783ms 完成。上传 64KB 文件到 `http://localhost:3003/up`，progress 回调收 `ProgressPayload{progress, progressTotal}`。autotest 仅 `Math.max(lastProgress, p.progress)` 抓了未断言，本用例补断言 |

---

## 二十五、Localhost（本地资源服务）手动用例

> autotest fetch `127.0.0.1:3005/index.html` 断言 200 + body，但**未直接断言 CORS 头**。本用例显式检查 `Access-Control-Allow-Origin`。测试入口：TestRunner "Plugins Manual Tests" 区。
>
> **验证记录**: 2026-08-28 真机（HUAWEI MateBook Pro HAD-W32）**PASS**：`status=200 bodyLen=968 ACAO=null` + `PASS: localhost serve OK.`。服务端确认设了 `Access-Control-Allow-Origin: *`（`localhost/src/lib.rs:134-137`，`#[cfg(target_env="ohos")]` 专属）+ Allow-Methods + Allow-Headers，**但前端 `resp.headers.get('access-control-allow-origin')` 读到 null**。根因：ArkWeb 对跨源响应只暴露 safelisted response headers（Cache-Control/Content-Language/Content-Type/Expires/Last-Modified/Pragma），ACAO 不在其中且服务端未设 `Access-Control-Expose-Headers` → 前端 JS 读不到该头。**但 fetch 跨源成功拿到 200+968 字节 body 本身即证明 CORS 实际放行生效**（否则 ArkWeb 会拦截跨源响应、拿不到 body）。故 ACAO=null 是 ArkWeb 响应头过滤行为，非服务端缺头、非 CORS 失效。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| core | localhost | serve+CORS | Localhost fetch — 200 + CORS 放行 ✅ | **T0** | app 已运行；localhost 插件已在 3005 起服务 | 1. 点击 "Localhost fetch (CORS)" 按钮 2. 查看 manualResult | ① manualResult 输出 `fetch 127.0.0.1:3005/index.html → status=200 bodyLen=968 ACAO=null` ② 输出 `PASS: localhost serve OK. (warning: no Access-Control-Allow-Origin header)`——**warning 后缀是提示性文案非失败信号**（ACAO=null 属正常，见④） ③ **CORS 放行判据 = fetch 跨源成功拿到 body**（status=200 + bodyLen>0），而非前端读 ACAO 头 ④ `ACAO=null` 属正常（ArkWeb 不向跨源 JS 暴露此头，非服务端缺失）；仅当 status≠200 或 bodyLen=0 才算 FAIL | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：11:22:02.812-918 hilog `fetch 127.0.0.1:3005/index.html → status=200 bodyLen=968 ACAO=null` + `PASS: localhost serve OK. (warning: no Access-Control-Allow-Origin header)`，107ms 完成，与 8-28 现象逐字一致。原文预期②漏写 warning 后缀，已按实际输出修正（避免验证者把 warning 误判为失败）。OHOS 绑 `127.0.0.1`（`lib.rs:110`，非 `localhost`）。服务端 CORS 头在 `lib.rs:132-146`（OHOS 专属：ACAO=`*` + Allow-Methods + Allow-Headers）。前端读 ACAO=null 因 ArkWeb 跨源响应头白名单过滤（未设 `Access-Control-Expose-Headers`），不代表 CORS 失效——fetch 拿到 body 即放行证据 |

---

## 二十六、OHOS 适配真 gap 功能 手动用例

> **验证记录**: 2026-08-28 真机（HUAWEI MateBook Pro HAD-W32，desktop 形态）：
> - drag-overlay drag-in **PASS**（2026-08-28）：点 "Drag Overlay (§二十六)" 按钮弹出测试窗口（overlay 模式，`drag_drop_overlay=true`），从文件管理器拖入 `CodeAgentCLI-develop-green/.../package.json`，hilog `[DRAG-TEST]` 完整序列：Enter(358,268)→Over 持续(267,218→227,205)→Drop paths=["docs/storage/Users/currentUser/Desktop/CodeAgentCLI-develop-green/.../package.json"]@(227,205)。Drop 后无 Leave 属正常（Drop 即终态，ArkUI 不补 Leave；Leave 仅在拖出窗口不释放时触发）。事件链 Rust→ArkUI Stack→wry drag_drop_handler→WindowEvent→`[DRAG-TEST]` 不经页面 JS。
> - drag-overlay pointer-passthrough **PASS**（2026-08-28）：overlay 窗口内点击/滚动/选中文本均正常，`HitTestMode.Transparent`（`WebviewPlugin.ets:1341`）透传指针事件到下方 Web。
> - https-scheme 4 例（page-load/secure-context/external-https/subresource）**全 PASS**（2026-08-28，两层修复后真机验证）：点 "HTTPS Scheme" 按钮，hilog 全链路证据：
>   - create 时种子协议集成功：`[wry https-intercept] URL rewrite: tauri://localhost → https://tauri.localhost (use_https=true, protocols=["asset","myapp-async","tauri","isolation","myapp","ipc"])`——protocols 非空（修复前空集导致 onInterceptRequest early-return null）。
>   - **page-load PASS**：`[bridge https-intercept] received url=https://tauri.localhost/` → `[wry https-intercept] enter/extracted protocol='tauri'/reverted/calling handler/success status=200 mime=text/html body_len=968`。子资源 `index.js body_len=450853`、`rolldown-runtime.js`、`index.html` 均拦截成功。`location.href=https://tauri.localhost/`（非 arkweb-error 占位）。
>   - **secure-context PASS**：`[https-scheme] isSecureContext=true`（修复前 false）+ `[https-scheme] crypto.subtle OK, bytes=32`（修复前 undefined）。
>   - **subresource PASS**：`[https-scheme] subresource fetch OK: status=200 bytes=968`——子资源 fetch 被 onInterceptRequest 拦截返回内容。
>   - **external-https PASS**：`[https-scheme] external fetch resolved: type=opaque status=0`——外部 example.com fetch 未被误拦截（走真实网络栈，opaque 是 no-cors 正常返回），拦截器只处理 tauri.localhost 不误伤外部 https。
>   - 两层修复：①create 时种子 https_intercept_protocol_list（`wry/src/ohos/mod.rs:663-672`）治 create-vs-register 竞态；②`dispatch_https_intercept_sync` 用 `Arc<Mutex<Option<Response>>>` 非阻塞替 `rx.recv_timeout(3s)`（`mod.rs:1065-1149`）治主线程阻塞。见 [[OHOS https scheme issecurecontext=false]]。
> - **2026-08-31 上库前终验（全 6 例复验 PASS）**（3QC0124C11000038，pid 17693）：drag-overlay Enter(228,296)→Over×57→Drop(paths)@11:18:28 完整序列 + 透传正常；https-scheme 4 例判据行全中（success status=200 body_len=968 / isSecureContext=true+crypto.subtle OK / external resolved opaque / subresource OK bytes=968），renderer 启动参数实锤六自定义协议注册。新观察：探针在 isolation 隔离层首轮执行时 fetch 类判据报 TypeError（隔离上下文 CSP 拒绝），https 上下文终判全 OK——两轮执行形态属预期，已注明于各行备注防误判。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| ohos | drag-overlay | drag-in | Overlay 拖拽接收 — 文件拖入 webview ✅ | **T0** | desktop 形态。点 "Drag Overlay (§二十六)" 按钮即运行时创建 overlay 测试窗口（`create_ohos_test_webview` 传 `dragDropOverlay:true`），**无需改 app 配置重建** | 1. 点 "Drag Overlay (§二十六)" 按钮弹出测试窗口 2. 从文件管理器拖拽文件到测试窗口 webview 区域 3. 释放 4. hilog 搜 `[DRAG-TEST]` | ① `Enter` → `Over` → `Drop(paths)` 事件序列（Drop 后无 Leave 属正常，Drop 即终态）② paths 含拖入文件的 URI ③ Web 级 handler 被抑制（不双发） | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：`Enter paths=[] pos=(228,296)` @11:18:27.807 → `Over`×57（230,162→230,116 连续轨迹）→ `Drop paths=["…/CodeAgentCLI-develop-green/新建 文本文档.txt"] pos=(230,114)` @11:18:28.455，Drop 后无 Leave（与 8-28 记录一致）。事件链 `cmd.rs:1922-1942` `on_window_event`→`WindowEvent::DragDrop` match 打 `[DRAG-TEST]`。overlay 模式 = `WebviewPlugin.ets:1248` `data.dragDropOverlay===true` 分支，透明 Stack（`HitTestMode.Transparent`）接收 ArkUI drag 事件；主窗口走 direct 模式（`dragDropOverlay=false` 默认），ArkWeb 抢占 drop→靠 onLoadIntercept 拦 file:// 兜底恢复，机制不同，故必须用测试窗口。 |
| ohos | drag-overlay | pointer-passthrough | Overlay 透传 — 鼠标/触摸不受影响 ✅ | **T0** | 同上（overlay 窗口已渲染） | 1. 在测试窗口 webview 区域点击、滚动、选中文本 2. 页内 HTML5 拖拽（DOM 元素间拖动） | ① 鼠标点击/滚动/触摸正常响应 ② 文本选择正常 ③ HTML5 DnD 不被 overlay 干扰 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：overlay 窗口内点击/滚动/选中文本均正常（用户确认），无卡死无无响应。`HitTestMode.Transparent`（`WebviewPlugin.ets:1341`）透传指针事件到下方 Web。 |
| ohos | https-scheme | page-load | HTTPS Scheme — 页面加载 ✅ | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "HTTPS Scheme" 按钮 2. 观察弹出的测试窗口页面是否渲染 3. hilog 搜 `onInterceptRequest` / `[wry https-intercept]` | ① `onInterceptRequest` 触发 ② custom_protocol 闭包被调用 ③ 页面 HTML 正常渲染 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693，webview id=test-https-1788146328708）：11:18:49 全链路 `[wry https-intercept] enter→extracted protocol='tauri'→reverted→calling handler→success status=200 mime=text/html body_len=968`（含 favicon.ico 二次请求同样走通），renderer 启动参数 `--ohos-scheme-handler-custom-scheme={"asset","ipc","isolation","myapp","myapp-async","tauri"}` 六协议注册齐全。页面渲染正常（用户确认）。修复：create 时种子协议集（`mod.rs:663-672`）+ 非阻塞 dispatch（`mod.rs:1065-1149`）。 |
| ohos | https-scheme | secure-context | HTTPS Scheme — Secure Context 验证 ✅ | **T0** | 同上；页面加载成功 | 1. 点 "HTTPS Scheme" 按钮（代码已自动执行探针，无需 DevTools）2. hilog 搜 `[https-scheme] isSecureContext=` 和 `crypto.subtle` | ① `[https-scheme] isSecureContext=true` ② `[https-scheme] crypto.subtle OK, bytes=32` ③ 不抛异常 | **2026-08-31 复验 PASS（上库前终验）**（同上）：`[https-scheme] isSecureContext=true` + `crypto.subtle OK, bytes=32`（两轮各一次），`location.href=isolation://localhost/`（首帧隔离层，属探针两段执行形态）。`cmd.rs:1874-1900` init script 自动执行探针→hilog ARKWEB-CONSOLE。最终验收门槛已过。 |
| ohos | https-scheme | external-https | HTTPS Scheme — 外部 HTTPS 不被误拦截 ✅ | **T1** | 同上 | 1. 点 "HTTPS Scheme" 按钮 2. hilog 搜 `[https-scheme] external fetch` | ① `[https-scheme] external fetch resolved`（不被误拦截） | **2026-08-31 复验 PASS（上库前终验）**（同上）：`[https-scheme] external fetch resolved: type=opaque status=0` @11:18:49.787——外部 example.com 走真实网络栈（opaque 是 no-cors 正常返回），拦截器只处理 tauri.localhost 不误伤外部 https。注：isolation 隔离层首轮探针有 `external fetch REJECTED: TypeError`（隔离上下文 CSP 拒绝，预期内），终判以 https 上下文的 resolved 行为准。 |
| ohos | https-scheme | subresource | HTTPS Scheme — 子资源 fetch/XHR 拦截 ✅ | **T1** | 同上 | 1. 点 "HTTPS Scheme" 按钮 2. hilog 搜 `[https-scheme] subresource fetch` | ① `[https-scheme] subresource fetch OK`（被 onInterceptRequest 拦截） | **2026-08-31 复验 PASS（上库前终验）**（同上）：`[https-scheme] subresource fetch OK: status=200 bytes=968` @11:18:49.177——子资源 fetch 被 onInterceptRequest 拦截返回内容。注：同轮 isolation 首帧有 `subresource fetch REJECTED: TypeError`（隔离层 CSP `default-src 'none'` 拒绝 connect，与 8-28 记录的 CSP 拒绝同源，预期内非拦截器失败）。 |

## 二十七、OHOS 适配 8 项功能 手动用例

> **背景**: openspec 8 项适配（clipboard/zoom flag、dialog error 降级、event 转发、monitor 真实值、dialog folder-picker、webview print、drag-drop）的手动验证。**2026-08-27 起约定：已由自动测试覆盖并验证的用例不保留在本文档**——monitor 刷新率用例（其测试步骤本身即"等 auto 运行"）由 `ohos-adapter.monitor.real-size`（auto，报告 #254 PASS）覆盖后移除，断言已收紧（连续两次调用 size 一致）；注：refreshRate 是 Rust `video_modes()` 字段，JS Monitor API 未暴露（name/size/position/workArea/scaleFactor）——2026-08-29 起新增 `probe_display_refresh_rate` 探针命令（经 `tauri::ohos::APP` 核心特权模式读 DisplayManager，与 tao `video_modes()` 同源）+ TestRunner「Display Refresh Rate」按钮，手动验证路径已补齐（见下表）。测试入口：TestRunner「OHOS Adapter Manual Tests」区按钮。
>
> **验证记录**: 2026-08-27 真机（HUAWEI MateBook Pro HAD-W32）：
> - monitor from-point **PASS**（3120×2080 物理像素，hilog 无 warn）
> - webview print **判据①②③全 PASS（判据③PDF 清理缺陷已修复并复验）**：2026-08-28 复验（pid 57908）点 Print 按钮→对话框弹出→`createPrintJob`+`startPrintJob jobId=1787906950767_156`→`handleCompletedJob`(5ms)+`removePrintJob success`；原始 temp PDF `wry_print_1787906950554.pdf` 复核时 cache 目录已无残留。**修复**（`WebviewPlugin.ets:2347`）：printPdf 加 `cleanup()` 闭包（`fileIo.unlinkSync`），覆盖 4 早退路径 + 3 终态事件（succeed 延 10s/fail/cancel）+ 120s 无条件兜底。**succeed 终态事件实测确投递**（修正前误判）：全量抓取（清缓冲+Debug级+关流控）后可见 `eventType 16: success pid [57908]` + `NapiCallFunction success` + `evaluate-script` 桥接调用（notifyPrintState 副作用，铁证），`PrintTask 'succeed': job submitted` 那行在 hilog socket 丢弃的 25 行中（`write socket failed, 25 line(s) dropped!`）。故 succeed 10s 延迟 cleanup 命中、是主清理路径，120s 兜底是双保险非唯一路径。旧缺陷（273KB 残留）根因=清理逻辑只在遗留路径 `DefaultWebview.ets printPage`、桥接路径 `WebviewPlugin.printPdf` 从不删文件（属 [[bridge 重构丢失注入点]] 同族），现已闭环。
> - event start-resumed **转发链 PASS、按钮判据不适用**：hilog `[RunEvent] Resumed` 在切前台瞬间触发（20:27:31.033）证明 Rust 转发正确；但按钮监听 `tauri://resumed` 永远 FAIL——**该事件在所有平台都不存在**（TauriEvent enum 无 resumed 成员，tauri core 从不向 JS emit RunEvent::Resumed），是按钮设计缺陷非适配缺陷。建议按钮改走 Rust probe 或标注平台语义。
> - save-state 用例已移除（无法真机触发系统内存回收；代码路径保证 tao mod.rs:668-673 `debug!` drop，无 warn、不转发 Event，定性无验证价值）。
> - dialog error-degrade **PASS**（按钮显示说明信息 ×2，无崩溃；该函数 Windows-only，OHOS 分支 log::error! 不 panic）。
> - clipboard OFF/ON **PASS**：OFF 窗口选中文本 Ctrl+C 后粘贴，剪贴板内容不变（拦截生效）；ON 窗口复制粘贴正常（2026-08-27 用户确认）。
> - clipboard 默认值翻转 **PASS**（2026-08-29）：主窗口（未显式设置 clipboard）启动日志 `setWebviewFlags windowId=0 clipboard=true`，真实键盘 Ctrl+C 复制正常（manual_tests T1 回归修复，用户确认）。§27 OFF 用例在翻转后**真机回归 PASS**（2026-08-29 用户确认）：显式 `false` 走新增的 `disable_clipboard_access()`，OFF 窗口拦截仍然生效。
> - zoom OFF/ON **PASS**：OFF 窗口 Ctrl+=/-/0 页面缩放不变（拦截生效）；ON 窗口缩放/重置正常（2026-08-27 用户确认）。
> - **2026-08-31 上库前终验（全 9 例复验）**（3QC0124C11000038，pid 17693）：即点即验 4 例（monitor 边界 ALL PASS / refresh_rate 60Hz+rAF~58 自洽 / dialog 降级无 crash / Resumed hilog 判据成立）+ 弹窗 4 例（clipboard OFF/ON、zoom OFF/ON）+ print 1 例（cancel 终态路径，临时 PDF 零残留）全 PASS，逐例证据见表内备注。**新定性**：Ctrl+0 在 OHOS 无 ArkWeb 原生缩放重置绑定（事件链完整送达、透传后 webview 不响应，hilog keyCode:2000 实抓），属平台语义非适配缺口，zoom 两例预期已修订；其余预期描述与本轮实测一致（start-resumed 判据改 hilog、refresh_rate"~120"措辞已修正）。
>
> **§二十七 结论**：8 例全 PASS（save-state 已移除；2026-08-31 终验 9 例复验全 PASS）。webview print 判据③临时 PDF 清理缺陷已修复并复验通过（`WebviewPlugin.ets:2347` printPdf cleanup 闭包：succeed 延 10s 命中主清理路径 + fail/cancel 即删 + 120s 无条件兜底双保险；succeed 路径 8-28 实测、cancel 路径 8-31 实测，3 终态分支均覆盖）；start-resumed 按钮监听 `tauri://resumed` 的判据设计缺陷已注明（事件在所有平台都不存在，Rust 转发本身正确）；zoom Ctrl+0 属 ArkWeb 平台无绑定（非缺陷）。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| ohos | monitor | from-point | monitor_from_point — 边界判定 ✅ | **T1** | 应用已启动，进入 Tests 页面 | 1. 点击 "monitorFromPoint (边界测试)" 按钮 2. 查看输出的五行边界判定结果 3. hilog 确认 `monitor_from_point` 无 warn 日志 | ① 显示 monitor size（DisplayManager 物理像素） ② 屏内坐标（含 w-1,h-1 右下角）返回 `Some(primary)` ③ 屏外坐标（-1/99999/w,h）返回 `None` ④ 按钮结果为 ALL PASS ⑤ 无 warn | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：hilog 10:51:53.717-819 实锤五行判定 `(100,200)`✅ / `(3119,2079)`✅ / `(3120,2080)`✅ / `(-1,0)`✅ / `(99999,0)`✅ + `ALL PASS ✅`，`monitor size: 3120x2080`，104ms 完成，无 warn。OHOS 单显示器，边界判定 `0<=x<w && 0<=y<h`（半开区间）；JS API `monitorFromPoint` 经 `core:window:allow-monitor-from-point` 权限直接调用，desktop 形态命令已注册 |
| ohos | monitor | refresh-rate | display_refresh_rate — 刷新率探针 ✅ | **T1** | 应用已启动（OHOS 设备） | 1. 点击 "Display Refresh Rate" 按钮 | ① 返回 `refresh_rate=<N> Hz`（N 以设备**当前屏幕模式**为准，面板峰值规格不代表当前刷新率） ② rAF 实测帧率与上报值同数量级 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：`refresh_rate=60 Hz` + rAF 实测 `~58 fps` 同量级自洽（probe 与 NDK DisplayManager 同源，读的是当前模式真值）。注：旧版预期写 "~120" 是面板规格假设——本机当前屏幕模式即 60Hz，实测与探针一致，已修正措辞。探针命令 `probe_display_refresh_rate` 走 NDK 直连（DisplayManager），非 bridge 插件；JS Monitor API 无 refreshRate 属上游全平台语义 |
| ohos | webview | print | WebView 打印 — 系统打印对话框 ✅ | **T0** | 应用已启动；页面已加载（onPageEnd）；进入 Tests 页面 | 1. 点击 "WebView Print" 按钮 2. 观察系统打印对话框 3. 检查临时 PDF 清理（hilog 搜 `print`） | ① 弹出系统打印对话框 ② 打印任务提交后 `log.info('print: job submitted')` ③ 临时 PDF 文件清理（`fileIo.unlinkSync`） ④ 页面未加载时返回 Err | **2026-08-31 复验 PASS（上库前终验，cancel 终态路径）**（3QC0124C11000038，pid 17693）：11:08:33 按钮触发 `window.print()` → 11:08:34.8 spooler 收到 `wry_print_1788145713764.pdf` → 对话框弹出、用户**取消** → `Notify Spooler Closed for canceled` jobId=1788145713907_979 + spooler `start deleting pdf cache`；app cache 目录复检 `wry_print_*` **零残留**（旁证：11:09:30 病毒扫描回访该路径 errno=2 文件已不存在）。succeed 终态路径 8-28 已复验，本次补齐 cancel 路径，cleanup 闭包 3 终态分支均实测覆盖。`@ohos.print` + `createPdf` 降级 |
| ohos | event | start-resumed | MainEvent::Start → Event::Resumed 转发 ✅ | **T0** | 应用已启动 | 1. 点 `RunEvent::Resumed` 按钮（监听 tauri://resumed）2. 按 Home 键将应用切到后台 3. 从最近任务列表切回应用 4. 看按钮结果（30s 内 PASS/FAIL） | ① **判据以 hilog 为准**：切回时 hilog 见 `NotifyAfterLifecycleResumed` + `[RunEvent] Resumed`（Rust 转发正确）；按钮本身**确定性 FAIL**——`tauri://resumed` 在所有平台都不存在（TauriEvent enum 无 resumed 成员，core 从不向 JS emit），属按钮设计缺陷非适配缺陷 ② hilog 无 `warn: TODO: forward onStart` ③ 与 SurfaceCreate/Resume 的重复 Resumed 可接受（幂等） | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：按钮按预期 FAIL（`did not fire within 30s`，30.7s 完成，设计性）；hilog 判据成立：10:52:21.589 切前台 → `NotifyAfterLifecycleResumed: in` → `[RunEvent] Resumed` @10:52:21.591，Rust 转发链正确。预期①原文"按钮显示 PASS"与实测/头部记录矛盾，已改为 hilog 判据。tao `MainEvent::Start`（SHOWN）转发为 `Event::Resumed`；按钮自动监听 30s |
| ohos | clipboard | flag-off | with_clipboard(false) — 拦截 Ctrl+C ✅ | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Clipboard OFF" 按钮 2. 在弹出的测试窗口选中文本 3. 按 Ctrl+C 4. 在输入框 Ctrl+V 粘贴 | ① 剪贴板内容**不变**（未复制） ② hilog 无错误 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：11:07:34.602 `Test webview created with clipboard=false`（133ms），OFF 窗口选中文本 Ctrl+C 后粘贴为旧内容（用户确认），hilog 无错误。ArkUI `onKeyPreIme` 拦截 CLIPBOARD_ACCELERATORS（MainPage/FloatPage 双路径） |
| ohos | clipboard | flag-on | with_clipboard(true) — 正常复制 ✅ | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Clipboard ON" 按钮 2. 在弹出的测试窗口选中文本 3. 按 Ctrl+C 4. 在输入框 Ctrl+V 粘贴 | ① 剪贴板内容**已更新**（复制成功） | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：11:07:52.122 `Test webview created with clipboard=true`（40ms），复制粘贴新内容正常（用户确认）。ArkWeb 原生处理（flag=true 不拦截） |
| ohos | zoom | flag-off | with_zoom_hotkeys(false) — 拦截 Ctrl+= ✅ | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Zoom OFF" 按钮 2. 在弹出的测试窗口按 Ctrl+= 3. 按 Ctrl+- 4. 按 Ctrl+0 | ① Ctrl+= / Ctrl+- 页面缩放**不变** ② hilog 无错误 ③ Ctrl+0 无可见差异属预期（ArkWeb 原生本就无 Ctrl+0 绑定，拦截语义无从观察） | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：11:08:12.225 `Test webview created with zoom_hotkeys=false`（38ms），Ctrl+=/- 缩放不变（用户确认）；11:08:17.522 实抓 `keyCode:2000`（数字 0）down/up 送达——**Ctrl+0 组合事件正常到达且被 onKeyPreIme 拦截**（accelerator_matcher.ets:160 含 `'0'`），无可见差异是因为 ArkWeb 原生不响应 Ctrl+0（见 flag-on 行定性），拦截层本身生效。`onKeyPreIme` 拦截 ZOOM_HOTKEY（Ctrl+=/-/0） |
| ohos | zoom | flag-on | with_zoom_hotkeys(true) — 正常缩放 ✅ | **T0** | 应用已启动，进入 Tests 页面 | 1. 点击 "Zoom ON" 按钮 2. 在弹出的测试窗口按 Ctrl+= 3. 按 Ctrl+- 4. 按 Ctrl+0 | ① Ctrl+= 放大 ② Ctrl+- 缩小 ③ Ctrl+0 重置——**OHOS 不适用**（2026-08-31 定性：ArkWeb 原生无 Ctrl+0 缩放重置绑定，事件透传后 webview 不响应；Ctrl+=/- 正常，属平台语义非适配缺口） | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：11:08:21.228 `Test webview created with zoom_hotkeys=true`（43ms），Ctrl+= 放大 / Ctrl+- 缩小正常（用户确认）；Ctrl+0 无效果——11:08:25.633 实抓 `keyCode:2000` down/up + Ctrl(2072) 修饰键均送达 InputManager，事件链完整，ON 窗口不拦截、事件已透传 webview，是 ArkWeb 原生侧无此快捷键（Windows/macOS webview 均有，OHOS 平台差异）。原文预期③"Ctrl+0 重置"已修订为不适用。ArkWeb 原生缩放（flag=true 不拦截） |
| ohos | dialog | error-degrade | dialog::error() 降级 — 不 panic ✅ | **T1** | 应用已启动；进入 Tests 页面 | 1. 点击 "Dialog Error (degrade)" 按钮 2. 查看 hilog 搜 `dialog::error` | ① 按钮显示说明信息（该函数仅 Windows 运行时调用） ② OHOS 分支为 `log::error!` 不 panic ③ 应用不崩溃 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：按钮输出 `dialog::error() is an internal runtime function.` 说明文字，1ms 完成，无崩溃（用户视觉+hilog 双确认）。`log::error!` 替代 `unimplemented!()`；实际运行时不触发（仅 Windows 调用） |

---

## 二十八、Window Ignore Cursor Events（窗口事件穿透）手动用例

> **背景**: Tauri `Window::set_ignore_cursor_events(ignore)` 在 OHOS 映射到 `ohos.window.setWindowTouchable(!ignore)`（`ignore=true` 穿透 ↔ `touchable=false` 不消费事件，取反在 tao 层）。**桥接走 WindowClient（plugin-window `set_window_touchable`，"set-touchable" typed bridge call）**，tao 层 `runtime.spawn` fire-and-forget 不等结果（防主线程死锁模式）；失败仅 hilog warn，不反向通知 Rust。
>
> **API 版本矛盾（待真机定论）**: 本地缓存文档标注 setWindowTouchable API 9+/12+，但华为官方智能问答确认为 **API 15+（HarmonyOS 5.0.0+）**。tauri api demo 默认 `compatibleSdkVersion = API 12`。若设备 API < 15，`win.setWindowTouchable` 为 undefined → ArkTS 同步抛 TypeError → 被 ArkHelper `safeLogError` 捕获，**不闪退**，仅穿透不生效。真机验证设备实际 API level 为定论步骤（design R5）。
>
> **测试入口**: `examples/api` 应用 → Tests 页面 → Manual Tests 区域 → `setIgnoreCursorEvents (3s toggle)` 按钮（smoke：toggle true→false 验证 TSFN 桥接 + 3s 穿透观察）。完整穿透验证需手动创建 Float overlay 子窗口（见 T0 用例）。
>
> **日志监控**: `hdc shell hilog | grep -iE "setWindowTouchable|WindowManager"`
>
> **验证记录**: 2026-08-27 真机（HUAWEI MateBook Pro HAD-W32，API 23）通过。新增专用按钮 `Overlay Ignore Cursor (穿透, §二十八)`（TestRunner）：`create_transparent_window` 创建 800×600 透明 Float 子窗口（label `manual-ignore-cursor-overlay`，WMS id 239）→ 子窗口 `setIgnoreCursorEvents(true)` → hilog 实锤 `WMSEvent SetTouchable: id:239, 0`（穿透生效），T0 点击穿透 + T1 hover 穿透视觉确认（下层主窗口按钮可点、hover 高亮正常）；30s 定时恢复 `SetTouchable: id:239, 1` 正常。设备 API 23 ≥ 15，T1 落在分支①（单 setWindowTouchable 足够，无需 hitTestBehavior fallback 与版本守卫）。穿透期间 overlay 自身 UI（含 "✕ Close" 链接）不可点击为**预期内**——窗口级 touchable=false 使整个窗口（含内部 webview）不消费事件，跨平台一致语义；恢复入口必须在其他窗口/定时器（本按钮即 30s 自动恢复）。
>
> **新发现缺陷（关闭生命周期，2026-08-28 已修复）**: overlay 的 "✕ Close" 链接走 `WebviewPlugin.ets` onLoadIntercept → `onCloseWindow` → `WindowManager.destroyWindow()`，ArkTS 侧直接销毁子窗口但不通知 Rust/tauri manager 摘除条目。后果：① `getAllWebviews()` 仍含已关闭 webview → `getByLabel` 返回僵尸句柄 → 同 label 重建被跳过（再次点击按钮无法创建新窗口）；② 对僵尸窗口的任何 window op（set-touchable 等）报 `Unknown OS sub-window '1' for this plugin instance`。
>
> **根因（深两层）**：① `WebviewPlugin.onCloseWindow` 回调调 `WindowManager.destroyWindow` 前漏调 `notifyWindowClose`（FloatPage × 按钮/aboutToDisappear 路径本有，但 close-window URL 路径漏）；② **更深的真根因**：`ProcessInitializer.initialize()` 从未 `AppStorage.setOrCreate(NATIVE_MODULE_STORAGE_KEY, ...)`，导致全仓所有 `AppStorage.get(NATIVE_MODULE_STORAGE_KEY)` 读取方（FloatPage × 按钮/aboutToDisappear、menu.ets closeWindow、NativeAbility windowStatusChange seed）恒 undefined → hilog 报 `NAPI notifyWindowClose not available` → notifyWindowClose 从未真正调用 → Rust drain 队列恒空 → tauri manager 残留僵尸条目。
>
> **修法（2026-08-28 落地验证通过）**：① `ProcessInitializer.ets` initialize 末尾补 `AppStorage.setOrCreate(NATIVE_MODULE_STORAGE_KEY, this.nativeModules[0])`（一处写入修复所有读取方）；② `WebviewPlugin.ets` onCloseWindow 在 destroyWindow 前补 notifyWindowClose（镜像 FloatPage × 按钮模式）。真机 hilog 实锤 `WebviewSurface: onCloseWindow: destroying windowId=1` + `FloatPage: Window 1 close notified via NAPI (system close)`（不再 not available）；windowId 递增 1→2→3 同 label 反复创建关闭全正常。详见 memory `ohos-appstorage-native-module-never-set`。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| ohos | ignore-cursor-events | touch-passthrough | setIgnoreCursorEvents(true) 触摸穿透 ✅ | **T0** | 应用已启动；已创建一个 Float 子窗口叠在主窗口上方（如透明 overlay）；设备 API ≥ 15 | 1. 在 overlay 子窗口上调用 `setIgnoreCursorEvents(true)` 2. 用手指/鼠标点击 overlay 覆盖区域 3. 观察主窗口是否收到点击 4. hilog 搜 `setWindowTouchable` 5. 调 `setIgnoreCursorEvents(false)` 恢复 | ① 点击穿透到下层主窗口（overlay 不消费触摸/鼠标事件）② hilog 输出 `setWindowTouchable: window N touchable=false`（debug）③ `setIgnoreCursorEvents(false)` 恢复后 overlay 重新消费事件 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：两轮 overlay（WMS id 647/648）hilog 实锤 `WMSEvent SetTouchable: id:647,0 → 30.0s → :1` / `id:648,0 → 30.0s → :1` 开/恢复配对；点击穿透下层按钮响应（用户视觉确认）；两次不同 WMS id 创建正常、全程无 Unknown OS sub-window（8-28 僵尸修复保持有效）。`ignore=true` ↔ `touchable=false`（tao 层取反）；fire-and-forget，Rust 返回 Ok 不代表 ArkTS 成功，以 hilog + 视觉为准 |
| ohos | ignore-cursor-events | hover-passthrough | setIgnoreCursorEvents hover 穿透 + API 版本 ✅ | **T1** | 同上 | 1. overlay 调 `setIgnoreCursorEvents(true)` 2. 鼠标悬停 overlay 覆盖区域 3. 观察下层主窗口的 hover/光标交互是否生效 4. 若 hover 不穿透，确认触摸仍穿透 5. 确认设备 API level（`hdc shell param get const.ohos.apicomversion` 或 deviceInfo.sdkApiVersion） | ① **API ≥ 15 且 hover 穿透**：单 setWindowTouchable 足够 ② **hover 不穿透但触摸穿透**：需追加组件级 `hitTestBehavior(HitTestMode.Transparent)`（参考 R72 drag-drop-overlay，task 4.3）③ **API < 15**：hilog 输出 `setWindowTouchable failed: ...`（TypeError），穿透完全不生效，需在 WindowManager 加 `deviceInfo.sdkApiVersion >= 15` 版本守卫静默跳过 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，API 23 ≥ 15，落在分支①）：穿透期间下层按钮 hover 高亮正常（用户视觉确认），单 setWindowTouchable 足够、无需 hitTestBehavior fallback。真机为定论（design R1/R5）；hover fallback 走 task 4.3；版本守卫属底层仓（openharmony-ability）职责，不加在 tao 层 |


<!-- §二十九（OHOS 初始化链 init-chain）已于 2026-08-27 移除：3 个用例（window/menu/tray T0）全部由自动测试 `ohos-init.chain.window-menu-tray`（ohos-init.ts，side-effect 类别）覆盖并真机验证（2026-08-27 报告 #255 PASS）。回归签名（not initialized / not installed / client not initialized）已内嵌为 INIT_BREAK_PATTERNS 断言，判据强于原手动 hilog grep（grep 会被无关来源的 "not installed" 日志误伤——如 huawei-account 注册缺陷）。节号保留空缺以维持既有交叉引用。 -->

## 三十、OHOS Gap 补测（notification 触发/updater）手动用例

> **背景**: 测试覆盖率分析发现的零覆盖缺口补测。自动测试位于 `examples/api/src/lib/tests/ohos-gap.ts`。**2026-08-27 起约定：已由自动测试覆盖并验证的用例不保留在本文档**——os 插件（type/family/arch/eol/exeExtension/version/locale/hostname，断言已收紧为 OHOS 精确值）与 clipboard（writeHtml/clear/round-trip）共 4 个用例从本节移除，证据见自动测试报告（2026-08-27 真机 289 例标准集 #256-269 全 PASS）。本节仅保留无法自动化的部分：通知回调**触发**（register 路径已自动化）与 updater check（环境前置条件无法满足，仅手动占位）。
>
> **版本兼容策略**: 任务1（os.version/locale、clipboard writeHtml/clear 实现）已落地（2026-08-27 验证：os.version 真实版本号非 0.0.0 占位，clipboard 三项 PASS）。
>
> **验证记录**: 2026-08-27 真机（HUAWEI MateBook Pro）：① os 七项 + clipboard 三项 auto 全 PASS（报告 #256-269），按上述约定移出本节；② onAction 触发（T0）随 §三十二 4/4 验证通过（同一按钮）；③ onNotificationReceived 触发（T1）2026-08-27 补按钮 `Send & Listen (onNotificationReceived)` 后真机验证：注册/发布链路正常（`registerListener` ok=true、`notify→show` ok），两轮 15s 窗口回调均未触发（fired=false）——**定性平台限制**：华为官方确认 `notificationManager.subscribe` 为 `@systemapi`，需 `ohos.permission.NOTIFICATION_CONTROLLER`（system_basic 级，三方不可申请），三方应用无法订阅"通知到达"事件；插件设计注释"registration succeeds but no events will be delivered"与实测一致，按用例预期②"记录形态"判定通过；④ updater check 维持占位——需 AppGallery 发布环境，且当日实锤 `UpdaterBridgePlugin` Rust 侧未注册（连带缺陷，见 §三十一 验证记录）。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| plugin | notification | onAction/trigger | onAction 触发 — 展开通知点 Action 按钮 ✅ | **T0** | 应用已启动；通知权限已授予；进入 Tests 页面 | 1. 点 Notification Manual Tests 区 `Send With Action Button (onAction)` 按钮 2. 下拉通知栏，展开 "Action 手动测试" 通知 3. 点击 "Tap Me" Action 按钮 4. 等待回调（热启动即时；冷启动需先杀进程，见 manual_tests §三十二） | ① console 输出 `[onAction] fired (N): {…}`（manualResult 显示 actionId === "manual-action" ✅）② 回调 payload 含 action id | **2026-08-31 复验 PASS（上库前终验，随 §三十二 同按钮）**（3QC0124C11000038）：回调实际触发两次、actionId='manual-action'（用户 UI 确认）。manual 类别；回调触发依赖真机通知交付；2026-08-27 已补专用手动按钮（原引用的 `onAction trigger (manual)` autotest 按钮不存在——manual 类别被 Run All 过滤且无独立运行入口） |
| plugin | notification | onNotificationReceived/trigger | onNotificationReceived 触发 — 发送后回调 ✅ | **T1** | 同上 | 1. 点 Notification Manual Tests 区 `Send & Listen (onNotificationReceived)` 按钮（2026-08-27 补齐：原引用的 `onNotificationReceived trigger (manual)` autotest 按钮不存在——manual 类别被 Run All 过滤且无独立运行入口）2. 等待最多 15s 3. 观察 console 区输出 | ① console 区输出 `onNotificationReceived manual: fired=false`（当前设备实测原文）② fired=false 为最终态，回调永不触发 ③ 通知栏可见 "onNotificationReceived 手动测试" 通知（sendNotification 链路 OK，与回调缺失无关）④ manualResult 区文案随源码版本而异（当前源码 L2497 为 `⏳ 15s 内未触发 onNotificationReceived 回调（OHOS 平台限制…记录形态）`，重建部署后应与此一致） | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 17693）：registerListener ok → 通知 id=9002 送达通知中心（sceneboard `onConsume __…com.tauri.api__9002`）→ 两轮 15s 窗口均 `⏳ …未触发…（OHOS 平台限制…记录形态）`，fired=false 最终态、manualResult 文案与当前源码逐字一致。**平台限制（2026-08-28 源码核实定论）**：OHOS 无三方可用的"通知到达"订阅 API——`notificationManager.subscribe` 为 `@systemapi`（需 `ohos.permission.NOTIFICATION_CONTROLLER`，system_basic 级，三方不可申请），故插件实现根本未 subscribe（`Plugin.ets:633` 注释："no corresponding OHOS subscription API; registration succeeds but no events will be delivered"），注册仅记 listener channel 无事件源驱动，fired=false 即最终态、不可避免。非缺陷、非待修。对照：actionPerformed 有驱动源（EntryAbility.handleNotificationAction，WantAgent 冷启动/onNewWant 热启动），故 §32 onAction T0 真 PASS。 |
| plugin | updater | check | updater.check — AppGallery 更新检查 ✅ | **T1** | 应用已发布到 AppGallery 且存在更高版本 | 1. 点击 `plugin-updater.check (manual)` 占位测试 2. 查看 console 输出 | ① check() 返回非 null Update 对象（有新版本）② 无 AppGallery 源时 reject（预期）| **2026-08-31 复验 PASS（预期② reject 路径）**（3QC0124C11000038，pid 17693）：bridge 注册正常且 **AppGalleryKit 真实查询链路走通**（CheckAppUpdate → appgallery_service `getSingleAppInfo com.tauri.api` → 回调 `{"resultCode":0,"hasNew":0}` → `UpdaterPlugin.ets: No update available`）→ null → Rust 反序列化 `check() rejected: StringExpected … UpdaterCheckResponse.body`——与 8-28 记录同错误（走到真实业务路径，非 not installed）。**UpdaterBridgePlugin 漏注册缺陷已修复验证通过（2026-08-28）**：在 updater 插件 `.setup()` 闭包 register_plugin 后，错误从 `not installed for 'api_lib'` 变成 `StringExpected, Failed to convert JavaScript value Null into rust type String on UpdaterCheckResponse.body`（走到真实业务路径——无 AppGallery 更新源，ArkTS 返回 null → Rust 反序列化 body 字段失败）。另修 updater config null panic：tauri.conf.json 加最小 `"updater":{"pubkey":""}`（endpoints default 空，pubkey 必填故补空串；只影响 OHOS，桌面不注册 updater 不读此配置）。需 AppGallery 环境（T1，前置条件重） |

---

## 三十一、OHOS 移动原生插件（barcode/biometric/geolocation/haptics/nfc/huawei-account）手动用例

> **背景**: 任务3 新适配的 5 个移动原生插件 + huawei-account 集成。UI 交互类流程无法自动化，自动测试仅覆盖安全子集（`examples/api/src/lib/tests/ohos-mobile-plugins.ts`：biometric.status / nfc.is_available / barcode.check_permissions / geolocation.check_permissions / haptics.selection_feedback 路由冒烟）。本节为 UI 绑定流程的手动用例。
>
> **前置**: 集成落地后重新构建部署（5 插件已注册到 examples/api lib.rs OHOS builder 链；entry module.json5 已声明 VIBRATE/LOCATION/APPROXIMATELY_LOCATION/CAMERA/ACCESS_BIOMETRIC 权限；ACCESS_BIOMETRIC 为 2026-08-29 补声明）。测试入口：TestRunner「Mobile Native Plugins Manual Tests」区按钮（2026-08-27 补齐：Barcode Scan / Biometric Authenticate / NFC / Haptics / Huawei Account；geolocation 两按钮在「Geolocation Manual Tests」区）。
>
> **验证记录**: 2026-08-27 真机（HUAWEI MateBook Pro HAD-W32，pid 17635）点击前 5 个按钮实测，逐项「设备问题 / 代码问题」判定（hilog 全链路证据）：
>
> - **barcode scan（T0）— 平台形态限制，非代码缺陷（2026-08-28 定位完成）**。权限链完整通过：check_permissions → request_permissions → 系统弹窗 → selfPermissionStateChange settle（3.1s，轮询 attempt=0，§三十二权限竞态修复在此同样生效），camera=granted。scan 本身失败：首次 `code=1000500001 Internal error`；第二次进到 HMS ScanFrameworkUIServiceExtension（SetInputOptions/ExecuteStartScanCenter 均执行）后 UIExtension 启动失败 `errorCode=1011, name=start_ability_fail`。**根因已确认**：我方用 `@kit.ScanKit` 的 `scanBarcode.startScanForResult`（默认界面扫码，`Plugin.ets:95`），该能力（及 `detectBarcode`/`customScan`）**官方明确不支持 PC/2in1 形态**（仅 Phone/Tablet/Wearable），系统无法在桌面形态拉起 `ScanUIExtAbility` 这个 UIExtensionAbility → 1011；首次 1000500001 同源（框架服务初始化在不受支持形态上失败）。我方 context/Want/CAMERA 权限声明均正确，失败在华为框架内部。验证需切 phone/tablet 形态真机或模拟器。建议（体验优化非功能修复）：scan 命令对 desktop 形态前置 reject 返回明确错误，避免触发无意义调用链。
> - **biometric（T0）— 权限缺失已修复 + 认证链路已通 + widget context 缺陷已修复验证通过（2026-08-29 mobile 真机）**。三层递进定位：
>   1. **权限缺失（已修）**：desktop/mobile 两形态 `module.json5` 均漏声明 `ohos.permission.ACCESS_BIOMETRIC`（system_grant/normal 级，HAR 模块无权声明，须 entry 模块声明）。修复前 status 查询 FACE/FINGERPRINT 均 `errCode:201`（权限拒绝）→ `isAvailable:false`。补声明后 201 消失。注：`biometric/src/main/module.json5`（type:har）层 ArkTS 静态检查器仍提示「需申请 ACCESS_BIOMETRIC」是**无害警告**——HAR 无权声明权限，检查器无法跨模块感知 entry 声明，运行时以 entry module.json5 为准。
>   2. **设备未录入（用户侧）**：权限生效后 FINGERPRINT 查询变 `errCode:12500010`（FINGERPRINT_AUTH_NOT_ENROLLED 未录入指纹），FACE 变 `12500005`（FACE_AUTH_NOT_ENROLLED）。用户录入指纹后 FINGERPRINT `result=0, errCode=0`（指纹可用）。
>   3. **认证 widget context 缺陷（已修，2026-08-29 真机验证通过）**：原缺陷——`getUserAuthInstance`/`start` 均 `result=0`（实例创建成功），但 `BeginWidgetAuth has context: 0` → `AuthWidget fail, ret:8` → 弹窗不出现。根因双层：
>      - **层一 uiContext 未注入（已修）**：API 10+ 设备 `getUserAuthInstance` 走 V10 widget 认证模式（`BeginWidgetAuth`/`AuthWidget`），`widgetParam.uiContext` 字段（`@since 18`，类型 `Context`，控制 modal-application 模式）未传 → `has context: 0`。biometric 是 tauri-cli 模板生成的 `extends Plugin`（`@tauri/app` 基类），`Plugin` 基类已持 `UIAbilityContext`（`this.context`，由 `PluginManager.setContext` 注入），而 `UIAbilityContext extends Context` 直接满足 `widgetParam.uiContext?: Context` 字段。修法：`doAuthenticate` 设 `widgetParam.uiContext = this.context`。修复后日志 `widgetParam has uiContext` + `widgetParam has valid uiContext` + `has context: 1` + `GetUserAuthInstanceV10 SUCCESS`。
>      - **层二 authType 组合不合法（已修）**：仅修 uiContext 后 `has context:1` 但仍 `AuthWidget fail ret:8` + `check permission and auth widget param failed` + `authType check fail:0`。根因：widget 认证 `authParam.authType` **只接受单一生物认证类型**，原代码传 `[FACE, FINGERPRINT]` 两种（`authTypeSize:2`）被拒。华为官方确认 widget 控件一次只展示一种生物认证方式，不能同时传两种。修法：`doAuthenticate` 先 `getAvailableStatus` 探测设备支持类型（复用 `doStatus` 逻辑），优先 FACE 其次 FINGERPRINT，只传单一 `authType: [authType]`（`authTypeSize:1`）。修复后 `BeginWidgetAuth authTypeSize:1` + `UserAuthInstance::start result:0 ret:0` + 指纹弹窗出现 + 用户认证 `✅ resolve（认证成功）`（1764ms）。
>      - status 链路（V9 getAvailableStatus）与 authenticate 链路（V10 widget）均已全通。
> - **nfc（T1）— 设备侧，符合预期**。is_available 真实查询 `nfcController.isNfcAvailable()` 返回 false（PC 无 NFC 读卡器）；scan 按文档化设计决策 reject（tag 发现需 Ability 级 ACTION_TAG_DISCOVERED intent 集成），报错含能力说明，属预期行为。
> - **haptics（T1）— 设备侧，符合预期**。4 命令（vibrate/impact_feedback/notification_feedback/selection_feedback）全部真实调到 vibrator，被拒 `Device operation failed.`（PC 无马达）；错误如实上报、无假成功，降级路径正确。
> - **huawei-account（T1）— 代码缺陷（实锤）**。login/silent_login/logout 全部 reject `Bridge plugin 'ohos.account' is not installed for 'api_lib'`。根因：ArkTS `AccountPlugin.ets`（id=`ohos.account`）存在且 EntryAbility bridgePlugins 工厂已注册，但 **Rust 侧 `BridgePluginRegistry` 无任何 `register_plugin::<AccountBridgePlugin>` 调用点**——对照：tauri-runtime-wry 注册 webview/window/url，tray-icon 注册 statusbar/menu，plugin-resource 注册 resource；account 与 updater 均无（pluginize 重构丢注入点同款系统性缺陷）。修法方向：仿 tray-icon `set_ohos_app` 模式在 huawei-account 插件 init 中注册（待修）；`UpdaterBridgePlugin` 疑似同款漏注册。
> - **geolocation get_current_position（T1）— 已验证通过（2026-08-27 补测）**。`Get Current Position` 按钮：getCurrentPosition 1445ms 返回 `lat=30.184877, lng=120.1998408, acc=4.3m, alt=0`（Wi-Fi/网络定位，坐标与 §三十二 watchPosition fix 同区域），链路（JS→runCommand getCurrentPosition→geolocationmanager）正常。本节 6 用例全部完成实测定性。
>
> **mobile 形态真机验证（2026-08-29，HUAWEI Mate 70 CLS-AL00，pid 2147）**：切 mobile 形态（`--device-type mobile`）重测前述 desktop 形态下因「PC 无硬件 / 平台不支持」而 false 的用例：
> - **barcode scan（T0）✅ 通过**：mobile 形态 `scanBarcode.startScanForResult` 正常拉起相机扫码 UI（对比 desktop 形态报 UIExtension 1011）。证实 §31 barcode 失败根因确为「scanBarcode 不支持 PC/2in1 形态」非代码缺陷。
> - **nfc is_available（T1）✅ 通过**：手机「设置→NFC」开关打开后 `isNfcAvailable` 返回 true（修复前 `NFC SA not started yet` 是系统设置 NFC 关闭，非代码缺陷）。
> - **haptics（T1）✅ 通过**：4 命令均产生震动（手机有马达，对比 desktop 形态 BusinessError 801 无马达）。
> - **geolocation get_current_position（T1）✅ 通过**：`Get Current Position` 返回位置信息。
> - **biometric authenticate（T0）✅ 通过**：详见上方 biometric 条目。双层修复（uiContext 注入 + authType 单类型）后 `has context:1` + `authTypeSize:1` + `UserAuthInstance::start result:0 ret:0` + 指纹弹窗出现 + `✅ authenticate() resolve（认证成功）`（1764ms）。对比修复前 `has context:0` + `authTypeSize:2` + `AuthWidget fail ret:8` + 弹窗不出现。
> - **huawei-account（T1）— 待修**：Rust 侧注册缺失（见上方条目），mobile 形态同 desktop 形态结论。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| plugin | barcode-scanner | scan | 扫码 — 拉起相机扫码 ✅ | **T0** | 应用已启动；CAMERA 权限已授予（首次触发系统弹窗） | 1. 点 `Barcode Scan (camera)` 按钮（内部先 check/request 权限再 scan）2. 对准任意二维码 3. 观察 manualResult | ① scan resolve 返回 `{ content, format }`，content 为二维码内容 ② 相机扫码 UI 正常拉起与关闭 ③ 无摄像头时 reject 且报错清晰 | context 注入修复后 scan 才可用（audit B2）。**desktop 形态（2026-08-27 MateBook Pro）**：权限链通过（check→request→系统弹窗→selfPermissionStateChange settle 3.1s，camera=granted），但 scan 报 UIExtension `errorCode=1011 start_ability_fail`——根因 `scanBarcode.startScanForResult` **官方不支持 PC/2in1 形态**（仅 Phone/Tablet/Wearable），非代码缺陷。**mobile 形态（2026-08-29 Mate 70）✅ 通过**：mobile 形态 `scanBarcode.startScanForResult` 正常拉起相机扫码 UI，扫码成功返回 content+format 且手机有系统内置振动反馈（见下行 vibrate 用例） |
| plugin | barcode-scanner | vibrate | 扫码成功振动反馈 ✅ | **T1** | 设备有振动马达 | 1. 完成一次 scan 2. 触发 vibrate 命令 | ① 设备振动 ② 无马达设备 reject/静默 | 复用 @ohos.vibrator（`vibrator.startVibration` duration 100ms，与 §三十一 haptics vibrate 同 API 同路径）。**2026-08-29 mobile 真机（Mate 70，pid 43842）实测通过**：点 `Barcode Vibrate` 按钮 → `IPC-DIAG: cmd=plugin:barcode-scanner\|vibrate reached Rust` → `JSAPP: runCommand: plugin=barcode-scanner, cmd=vibrate` → `MiscdeviceService: Vibrate Start vibrator, duration:100, package:com.tauri.api` → `vibrator_host: VibrateOn: duration is 100` → `respond ok=true` → `✅ vibrate() resolve`。插件 `vibrate` 命令本身真实触发马达振动 100ms（区别于系统扫码内置震动）。另：实际扫二维码成功时手机亦有系统内置振动反馈（OHOS `scanBarcode` 默认 UI 内置，非插件 `vibrate` 命令触发；插件 `doScan` L95-101 成功路径不调 vibrate）。按预期②"无马达设备 reject"在 desktop 形态 haptics 已验证 BusinessError 801 降级路径（同 `vibrator.startVibration` API） |
| plugin | biometric | authenticate | 生物认证 — 拉起系统认证框 ✅ | **T0** | 应用已启动；设备已录入指纹/人脸；ACCESS_BIOMETRIC 权限已声明（2026-08-29 补） | 1. 点 `Biometric Authenticate` 按钮（内部先 status 再 authenticate）2. 完成认证/取消 3. 观察 manualResult | ① 认证成功 resolve（result.success=true），hilog `✅ authenticate() resolve（认证成功）` ② 取消/失败 reject 且 errorCode 清晰 ③ 系统认证 UI（指纹 widget）正常显示，hilog `widgetParam has valid uiContext` + `has context:1` + `authTypeSize:1` + `UserAuthInstance::start result:0 ret:0` | 双层修复（2026-08-29 mobile 真机验证通过）：层一 `widgetParam.uiContext = this.context`（UIAbilityContext extends Context）；层二 `authType` 只传单一类型（widget 不支持 FACE+FINGERPRINT 组合，先 getAvailableStatus 探测）。详见验证记录 |
| plugin | geolocation | get_current_position | 定位 — 获取当前位置 ✅ | **T1** | LOCATION 权限已授予；设备定位服务开启 | 1. 点 Geolocation Manual Tests 区 `Get Current Position` 按钮 2. 观察 manualResult | ① 返回 `{ coords: { latitude, longitude, ... }, timestamp }` 数值合理（Wi-Fi/网络定位）② 无 fix 时超时 reject——记录形态即可 | ~~watchPosition 流式回推是已知架构限制~~ **已过时**：emit/Channel 已落地（§三十二），watchPosition 流式回传真机验证通过（2026-08-27 收到位置 fix 回调） |
| plugin | haptics | vibrate 效果 | 触觉反馈 — 三种效果 ✅ | **T1** | 设备有振动马达 | 1. 点 `Haptics (vibrate/impact/notification/selection)` 按钮（内部依次调 4 个命令）2. 观察 manualResult | ① 各命令 resolve ② 有马达设备产生对应振动模式 | **desktop 形态（2026-08-27 MateBook Pro）**：4 命令（vibrate/impact_feedback/notification_feedback/selection_feedback）全部真实调到 vibrator，被拒 `Device operation failed.`（PC 无马达）；错误如实上报、无假成功，降级路径正确。**mobile 形态（2026-08-29 Mate 70）✅ 通过**：4 命令均产生震动（手机有马达，对比 desktop 形态 BusinessError 801 无马达）。PC 无马达时 BusinessError 801→测试 skip（路由链已验证） |
| plugin | nfc | scan/write | NFC 扫描/写入 ✅ | **T1** | 设备支持 NFC；备一张可写 NFC 标签 | 1. 点 `NFC isAvailable + scan` 按钮 2. 观察 manualResult | ① is_available 返回布尔 ② scan 当前明确 reject（未实现，设计决策）③ 报错信息含能力说明 | **desktop 形态（2026-08-27 MateBook Pro）**：is_available 真实查询 `nfcController.isNfcAvailable()` 返回 false（PC 无 NFC 读卡器）；scan 按设计决策 reject（tag 发现需 Ability 级 ACTION_TAG_DISCOVERED intent 集成），报错含能力说明，属预期行为。**mobile 形态（2026-08-29 Mate 70）✅ 通过**：手机「设置→NFC」开关打开后 `isNfcAvailable` 返回 true（修复前 `NFC SA not started yet` 是系统设置 NFC 关闭，非代码缺陷）。scan/write 属下一轮；Plugin 基类 emit/Channel 已落地（§三十二）但 nfc scan 尚未接入；本轮验 is_available |
| plugin | huawei-account | login | 华为账号一键登录 | **T1** | 设备已登录华为账号；AppGallery Connect 配置完成 | 1. 点 `Huawei Account (login/silent/logout)` 按钮 2. 完成一键登录授权 3. 观察 manualResult | ① resolve 返回 { openId, unionId, ... } ② silent_login 免弹窗返回 ③ logout 后 silent_login reject | **AccountBridgePlugin 漏注册缺陷已修复验证通过（2026-08-28）**：在 huawei-account 插件 `.setup()` 闭包 register_plugin（仿 tray-icon 模式）后，错误从 `not installed for 'api_lib'` 变成真实 Account Kit 业务错误 `1001502003:Invalid clientId or profile`（AGConnect 配置缺失，app_id 为空）。bridge 链路完整：`[bridge] call_raw: ohos.account/login` → ArkTS `controller.executeRequest` → Account Kit SDK 返回 1001502003 → catch logError → 回传 Rust → 前端 runCallback。**前端显示修复**：原 `onMessage('huawei-account flow attempted')` 未推 manualResult，现补 `onMessage(manualResult)`，UI 可见 `❌ login() reject：1001502003...` + `silent_login reject：1001502003...` + `(logout 已调用)`。要弹登录界面需：AppGallery Connect 注册 com.tauri.api + 开通 Account Kit + 下载 agconnect-services.json 放 entry_desktop/resources/rawfile/ + 设备登录华为账号 + 重建部署（环境前置，非代码缺陷）。零自动覆盖为已知缺口 |

---

## 三十二、OHOS Plugin 基类 emit/Channel 事件回传机制

> **背景**: 打通 ArkTS→webview 事件流：ArkTS `Plugin.emit(channelId, payload)` → NAPI `tauri_send_channel_data` → Rust CHANNELS 注册表 → `Channel.send` → webview.eval → JS 回调。对标 Android `send_channel_data` / iOS `send_channel_data_handler`。
>
> **改动范围**: Rust（channel.rs cfg + mobile.rs CHANNELS pub + ohos_plugin.rs NAPI）、ArkTS Plugin 基类（emit/setEmitHandler/parseChannelId/onNotificationAction）、PluginManager（getPlugin）、EntryAbility（setEmitHandler 注入 + onNewWant/handleNotificationAction）、geolocation（watchPosition channel emit）、notification（registerListener/removeListener + action dispatch）。
>
> **自动测试**（`examples/api/src/lib/tests/ohos-mobile-plugins.ts`）：notification.registerListener（注册/注销不报错即通过）。geolocation watchPosition 的 emit 事件流依赖设备位置开关与位置 fix，环境依赖强，转为手动用例（TestRunner「Geolocation Manual Tests」两按钮：①请求权限+打开定位设置 ②Watch Position (emit)）。
>
> **验证记录**: 2026-08-27 真机（HUAWEI MateBook Pro）4/4 用例通过。① 权限链：requestPermissionsFromUser 发起→settle 3.3s（selfPermissionStateChange 兜底胜出，四路竞合去重正常，轮询 attempt=1 双 granted），无挂起；② watchPosition：10s 窗口收到 1 次位置 fix（lat=30.1849/lng=120.1998/acc=3.6m，Wi-Fi 定位），clearWatch 正常，emit 端到端验证通过；③ 冷启动：`aa force-stop` 后点 action → 新 pid onCreate 拉起 + `Notification action: id=9001` 派发，emit 被吞（`No listener registered` warn，无 crash，文档预告限制精确复现）；④ 热启动：onNewWant 派发 + `evaluate-script`（webview.eval）注入回调链 hilog 闭环。另补手动按钮 `Send With Action Button (onAction)`（TestRunner Notification Manual Tests 区，热/冷启动共用，监听常驻跨后台）。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| plugin | geolocation | 权限+开关 | 请求权限 + 打开定位设置（按钮一） ✅ | **T1** | 应用已安装 | 1. 点击「请求权限 + 打开定位设置」按钮 2. 系统弹权限对话框时选"允许" 3. 跳转设置页后开启「定位服务」总开关 4. 返回应用 | ① 弹出位置权限对话框（LOCATION + APPROXIMATELY_LOCATION）② 跳转到系统定位设置页（uri=location_manager_settings；失败则兜底跳应用详情页 application_info_settings）③ requestPermissions 返回 granted ④ 弹窗授权后数秒内完成（不挂起） | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038）：ATM `Pop ui extension dialog` → `{"location":"granted","coarseLocation":"granted"}` → openLocationSettings 跳定位设置页（用户 UI 确认）→ 2274ms 结算不挂起。平台坑（2026-08-22 修复+真机验证）：`requestPermissionsFromUser` 的 Promise 在地图预览弹窗形态下可能永不 resolve（事件循环不冻结，是 Promise 本身不结算）→ ArkTS 侧 fire-and-forget + 四路兜底 settle（onForeground 生命周期 / on('selfPermissionStateChange') 事件（API 18+）/ 60s setTimeout 安全网 / Promise 本身）；且 selfPermissionStateChange 事件在 ATM 提交前触发，同步 checkAccessTokenSync 读到旧 denied → settle 后轮询（立即首查+300ms×6 次直到全 granted）；应用级权限与系统总开关是两道独立门槛，总开关关闭时 locManager 报 3301100 |
| plugin | geolocation | watchPosition | Watch Position 位置流回传（按钮二） ✅ | **T1** | 按钮一已完成（权限 granted + 定位服务开启） | 1. 点击「Watch Position (emit)」按钮 2. 观察 10s 内结果区的位置更新计数 3. 自动 clearWatch 结束 | ① watchPosition resolve 返回 channelId ② 设备产生位置 fix 时收到 `{ coords: { latitude, longitude, accuracy, ... }, timestamp }` 回调（计数递增）③ 结果区显示「emit 端到端链路验证通过」④ clearWatch 后不再有回调 ⑤ 无位置 fix 时提示注册/注销链路已通过，事件流待有 fix 设备验证 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 2074）：前端判词「✅ emit 端到端链路验证通过：locationChange → Plugin.emit → NAPI → Channel → JS 回调」（收到 Wi-Fi fix 回调后打出，10s 窗口 10098ms）；clearWatch 后 locationhub remove request 干净、无后续回调。验证链路：locationChange → Plugin.emit(channelId, position) → NAPI tauri_send_channel_data → Rust CHANNELS → Channel.send → JS 回调；MateBook Pro 无 GPS，事件依赖 Wi-Fi/网络定位 fix |
| plugin | notification | actionPerformed | 通知 action 按钮 — 冷启动 ✅ | **T0** | 通知权限已授予；已 registerActionTypes；前台发一条带 actionTypeId 的通知 | 1. `onAction(cb)` 注册监听 2. 发通知 `notify({ id, title, body, actionTypeId })` 3. 切到后台 4. 点击通知 action 按钮 5. App 冷启动拉起 | ① App 被拉起 ② hilog 见 `Notification action: id=…, actionId=…` 派发且无 crash（冷启动 emit 早于 webview 注册监听，**确定性**被 warn 吞——cb 不触发属预告限制，非 FAIL）③ actionId（hilog 侧）与点击的按钮一致 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038）：杀 app 后点通知 action → 新 pid 17693 拉起 + `Notification action: id=9001, actionId=manual-action` 派发 + `No listener registered` warn 吞 emit、无 crash（确定性限制精确复现）。冷启动 webview 未就绪→emit 被 warn 吞（不 crash，2026-08-27/08-31 两次实测均确定性复现，非"可能"）；热启动更可靠 |
| plugin | notification | actionPerformed | 通知 action 按钮 — 热启动 ✅ | **T1** | 同上；App 在后台运行 | 1. `onAction(cb)` 注册监听 2. 发通知 3. 点击通知 action 按钮 4. App 回到前台（onNewWant） | ① cb 收到 `{ id, actionId }` ② actionId 与点击的按钮一致 ③ `removeListener` 注销后不再收到回调 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 2074）：两次点击通知 action 均派发 `Notification action: id=9001, actionId=manual-action` 且页面回调收到（用户 UI 确认 actionId='manual-action'）；注：removeListener 子判据今日未显式触发（前端仅在下一次运行开始时 unregister 旧监听，全程无报错；API 层注册/注销不报错由 auto 测试覆盖）。热启动走 onNewWant→handleNotificationAction→onNotificationAction→emit 链路 |

---

## 三十三、Key Repeat Detection（键盘连发检测）手动用例

> **背景**: ArkWeb 物理键盘走 IME 插入管线，原生 DOM keydown 为空壳事件（无 key/code、不连发、e.repeat 恒 false，且每个重复周期合成一对假 keydown/keyup）。`ohos-webview-key-synthesis` 在 MainPage.onKeyPreIme 检测连发并派发合成 KeyboardEvent（带按键身份与 repeat），shim 抑制原生退化事件。测试入口：Tests 页面 → Key Repeat Detection (OHOS desktop / 2in1)。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| webview | key-synthesis | 长按连发 | Hold Key — 长按按键触发连发 repeat ✅ | **T0** | 应用已启动；设备连接物理键盘；进入 Tests 页面 Key Repeat Detection 区域 | 1. 点击 "Start" 2. 点击输入框获取焦点（光标闪烁） 3. **长按**字母键 j 约 3 秒（手指不松开） 4. 松开 | ① 首行 `D key="j" code=KeyJ repeat=false` ② 长按期间连续多行 `D ... repeat=true`（绿色高亮），中间**无 U 行、无灰色空壳 D/U 对** ③ 松开后单行 `U key="j" code=KeyJ` ④ 输入框正常连出 `jjjj`（无翻倍） | **2026-08-31 验证 PASS（上库前终验）**（3QC0124C11000038，pid 2074）：①②③④全符（绿色 repeat=true 连发、无 U 行/灰色行、松开单 U、jjjj 不翻倍，用户页面确认）；hilog 佐证 OnKeyPreIme ~51ms 间隔连发（10:11:14.764→10:11:16.216 ≈20Hz）+ KeyAutoRepeat Stop 松键。关键判定：`code=KeyJ` 有值 + `repeat=true` 连发；灰色行=shim 失效（scriptRules 匹配问题） |
| webview | key-synthesis | 点按对照 | Tap Key — 快速点按不触发 repeat ✅ | **T0** | 同上；已完成长按用例 | 1. 快速点按字母键 j 一次（按下立即松开） 2. 再快速点按一次 | ① 每次 `D ... repeat=false` ② 每次点按配对一行 `U` ③ 无 repeat=true 出现 | **2026-08-31 验证 PASS（上库前终验）**（3QC0124C11000038）：两次快速点按各一行 D repeat=false + 配对 U、无 repeat=true（用户页面确认）；hilog 佐证两次点按各一对 KeyboardReDispatch type:0/2（10:15:18.965/10:15:19.180），无连发串。验证 Up 正确清除按下集合，不误报 |
| webview | key-synthesis | 快捷键拦截 | Accelerator Interception — 被消费按键不泄入页面 ✅ | **T1** | 应用配置了菜单快捷键（如 Ctrl+Shift+T 类 accelerator） | 1. 长按快捷键组合 2 秒 | ① 页面**不**收到该组合键的 keydown/keyup（被 onKeyPreIme 拦截链消费） ② 松开修饰键后页面收到修饰键事件正常 | **2026-08-31 验证 PASS（上库前终验）**（3QC0124C11000038）：长按 Ctrl+M（已注册 accelerator）→ hilog `[Accelerator] combo="ctrl+m"` 匹配 + `menuClickHandler id=5 predefinedType=minimize` 执行（10:18:52.548/10:18:56.477 两次）+ **无 KeyboardReDispatch 泄入页面**；松开后修饰键 keyup 页面正常收到（用户确认两点）。对照组：未注册 ctrl+shift+t 全量透传页面（fall-through 正常，非 FAIL）。验证 fall-through 接线：拦截优先于合成 |
| webview | key-synthesis | 告警检查 | No Warnings — hilog 无派发失败 ✅ | **T1** | 已完成长按用例 | 1. `hdc shell "hilog -x \| grep KeySynthesis"` | ① 无 `runJavaScript failed` 告警 | **2026-08-31 验证 PASS（上库前终验）**（3QC0124C11000038）：全量 hilog 复查（覆盖长按/点按/快捷键全部操作）0 条 `runJavaScript failed` 告警。派发失败仅 warn 不刷屏（20Hz 连发下静默成功） |

---

## 三十四、OHOS P1/P2 新插件（无障碍/截图取色/应用接续）手动用例

> **背景**: 2026-08-27 交付的无障碍、截图取色与应用接续（被动恢复）插件。只收录自动测试**未覆盖**的维度（系统设置联动、事件端到端、人眼比对、接续边界）；已被自动用例覆盖的断言（getFontScale 正数、红块阈值、base64 前缀+宽高、接续普通启动 false/null）不再重复。splash/字体（P0）已有 hilog/静态验证结论，不设手动用例。
>
> **自动测试**: 无障碍 `plugins.ts`（getFontScale auto / 查询 auto / onAccessibilityStateChange manual-console）；截图 `ohos-screenshot.ts`（captureWebview auto / 红块取色 side-effect / 越界 auto / demo manual-console）；接续 `ohos-continuation.ts`（isContinuationRestoreLaunch false+peek 幂等 auto / getContinuationData null+take 幂等空 auto / setContinuationData 保存+清空+超限拒绝 auto / demo manual-console）。
>
> **手动入口**: 无障碍三按钮在 TestRunner「Accessibility Manual Tests」区；截图在 App 侧栏「Screenshot」demo 页；接续在 App 侧栏「Continuation」demo 页。
>
> **双设备接续迁移流用例**: 见下表 continuation source-restore 行（Phase 3c 已交付源端保存 setContinuationData + onContinue 快照 + continuable 门控）。

| 一级场景 | 二级场景 | 三级场景 | 用例名称 | 用例级别 | 预置条件 | 测试步骤 | 预期结果 | 备注 |
|---------|---------|---------|---------|---------|---------|---------|---------|------|
| plugin | accessibility | fontScale | 字号缩放跟随系统设置 ✅ | **T1** | 应用已安装 | 1. TestRunner 点「Font Scale 查询」记录当前值 2. 系统设置 → 显示和亮度 → 字体大小与显示大小，调大字号 3. 返回应用重新点击按钮 | ① 第一次返回正数（默认 1.0）② 第二次返回值 > 第一次（fontSizeScale 跟随系统变化） | **2026-08-31 复验 PASS（上库前终验，交互包）**（3QC0124C11000038，pid 2074）：基线 `getFontScale() → 1`（09:58:45）→ 调大系统字号后 `→ 1.45`（09:59:00，hilog ARKWEB-CONSOLE `[ManualTest] getFontScale() → 1.45`），①②均符。**2026-08-28 PASS（配置补全后）**（3QC0124C11000038）：预期①✅ 基线 `getFontScale() → 1`（hilog ARKWEB-CONSOLE + IPC-DIAG `get_font_scale respond ok=true`）。预期②**首次实测值不跟随**——根因：`AccessibilityPlugin.ets:115-121` 读 `abilityContext.config.fontSizeScale`，该属性**仅在 app.json5 声明 `"fontSizeScale": "followSystem"` 后才跟随系统字体大小**（华为 AI 确认）；原 `AppScope/app.json5` 未配 `configuration` 字段 → 默认 nonFollowSystem → 恒 1。**补 configuration.json (`fontSizeScale:followSystem`) + app.json5 加 `$profile:configuration` 引用、重建部署后，调系统字体大小，Font Scale 值随之变化**（用户确认 2026-08-28）。插件读取代码本身正确，无 cfg 缺陷。注：app 主界面(ArkWeb 网页)字体不自动跟随系统 fontSizeScale（网页有 CSS 字体定义），需应用层 onConfigurationUpdated 应用到 webview 字体缩放——属增强项非本用例判据（本用例只要求返回值跟随系统变化）。零权限；auto 用例只断言正数；配置属 init 后手动补（模板无此字段，见 [[ohos-fontscale-followsystem-config]]） |
| plugin | accessibility | screenReader | 屏幕阅读器查询与开关对照 ✅ | **T1** | 应用已安装 | 1. TestRunner 点「Screen Reader 查询对照」记录两查询值 2. 设置 → 辅助功能，开关屏幕阅读器 3. 返回重新点击按钮 | ① `isScreenReaderEnabled()` 与系统开关一致 ② 切换后查询值跟随变化 ③ 全程无权限错误（真机实测 ACCESSIBILITY 只读不设防） | **2026-08-31 复验 PASS（desktop ①③，上库前终验）**（3QC0124C11000038）：`isScreenReaderEnabled() → false` + `touchEnabled[0]`，39ms 完成无权限错误。**①③2026-08-28 desktop 基线已验 + ②2026-08-29 mobile 补验通过**。desktop（3QC0124C11000038）：`isScreenReaderEnabled() → false` + `isTouchExploreEnabled() → false`，链路完整（IPC-DIAG `respond ok=true` + napi `touchEnabled[0]`），预期①③满足，②因 desktop 无屏幕阅读器能力无法验。**mobile（HUAWEI Mate 70 CLS-AL00，pid 43842）2026-08-29 补验 ② 通过**：系统设置 → 辅助功能 → 屏幕阅读器(TalkBack) 拨开（hilog 14:26:14 `Toggle switch isOn:true` → 14:26:24 `set accessibility state to TP, state = 1` + com.huawei.hmos.screenreader pid 44421 拉起）后，再点「Screen Reader 查询对照」→ `IsOpenTouchExploration touchEnabled[1]`（基线 OFF 时 `touchEnabled[0]`）→ 前端 `isTouchExploreEnabled` 返回 true。**`touchEnabled` 从 [0]→[1] 证明查询值跟随系统开关变化**。③全程无权限错误（ACCESSIBILITY 只读不设防，desktop/mobile 一致）。结论：2in1 桌面形态无屏幕阅读器能力属实，但 mobile 有 TalkBack，链路在 mobile 上完整验证通过，原"设备能力限制"定性被 mobile 实测补全。零权限 |
| plugin | accessibility | stateChange | 屏幕阅读器状态事件端到端 ✅ | **T1** | 应用已安装 | 1. TestRunner 点「State Change Watch (20s)」 2. 20s 内：设置 → 辅助功能，开关屏幕阅读器 | ① 结果区显示「✅ 状态事件链路验证通过：共 N 次事件」② 事件 payload enabled 与开关动作一致 | **2026-08-29 mobile 真机验证通过**（HUAWEI Mate 70 CLS-AL00，pid 43842）。desktop（3QC0124C11000038）因无屏幕阅读器能力无法触发状态变更事件（2026-08-28 定性），**mobile 补验通过**：点「State Change Watch (20s)」订阅后，20s 内在系统设置关掉屏幕阅读器（TalkBack）→ hilog 14:28:57 系统侧分发 `OnAccessibilityStateChange: 0`（值 0=切到关闭态），**插件订阅收到事件并回调前端**（用户确认前端"有收到"），emit→listen 链路端到端打通。结论：订阅注册 + 状态变更事件分发 + 插件回调全链路在 mobile 实测通过，原"设备能力限制"定性被 mobile 补全。auto 测试无法触达（需操作系统设置），手动验证收口 |
| plugin | screenshot | preview | 截图预览与页面一致 ✅ | **T0** | 应用已安装 | 1. App 侧栏切到「Screenshot」页 2. 点「📷 截图预览」 3. 检查预览 img | ① 预览图完整显示当前页面（含 5 个色块）② 无空白/截断 ③ 尺寸信息 ≈ 视口物理分辨率（实测 2092×1249） | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038）：人眼比对预览完整含 5 色块、无空白/截断；同会话 capture 2092×1249 与本行记录尺寸逐字一致。**2026-08-28 PASS**（3QC0124C11000038，人眼比对）：点「📷 截图预览」→ 预览图完整显示当前页面（含 5 个色块、无空白/截断），用户确认预览与页面一致。hilog 佐证：render_service 侧 `GetImageSnapshot: DDGRSurface::GetImageSnapshot! 0 1955 3120 2080`（3120×2080 物理像素快照链路系统侧证据）。auto 已断言 base64 前缀+宽高（iVBOR…/width>0/height>0）；pickColor（本行下行）已验取色链路正常，间接证明截图内容可读。内容正确性判据以人眼为准（不能自动化/不能读截图，见 [[subagent-no-screenshot-reads]]） |
| plugin | screenshot | pickColor | 全色块取色人眼比对 ✅ | **T1** | Screenshot 页已打开 | 1. 依次点击 5 个色块（#FF0000/#00FF00/#0000FF/#FFFFFF/#000000） 2. 核对每次显示的 rgba | ① 各色块通道与色值一致（±极小偏差；红块实测像素级精确 rgba(255,0,0,255)）② 显示的 snapshot 坐标与色块位置对应 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038）：5 色块人眼核对符合（opacity 陷阱修复保持有效）。**2026-08-28 真机（3QC0124C11000038）实测 + 根因定位完成**：首次实测 5 色块"应 0"通道恒为 101（红 rgba(255,101,101) 等），白色精确。**根因非插件缺陷**——demo 页 `testPickColor` 设 `busy=true`→按钮 `disabled`→CSS `.block:disabled{opacity:0.6}` 在 `await captureWebview()` 让出事件循环后、快照捕获前已应用，TOCTOU 时序致快照取到 60% 透明度混合后的像素（opacity:0.6 混合公式 `fg*0.6+bg*0.4`，白底理论 102，ArkWeb 量化为 101，完美匹配 5 色块）。像素读取代码 BGRA→RGBA 转换正确（WebviewPlugin.ets:2212-2214）；auto 测试不受影响（注入 div 无 disabled/opacity，阈值 g<60 正常）。旧设备正常是渲染管线慢未及时应用 opacity（TOCTOU 时序差异）。**已修复**（Screenshot.svelte `.block:disabled` 移除 `opacity:0.6`，仅保留 `cursor:wait`），**2026-08-28 重建部署后真机验证通过**（用户确认 pickColor 修复确认，5 色块取色像素级精确）。auto 已覆盖红块阈值断言；本用例补全其余 4 色块 |
| plugin | screenshot | canvas-snapshot | Take Snapshot canvas 渲染与页面一致 ✅ | **T0** | 应用已启动，TestRunner 页已加载 | 1. 点 TestRunner「Take Snapshot (verify canvas matches page)」按钮 2. 检查下方 canvas 是否渲染出当前 WebView 内容 | ① canvas 显示当前页面（非空白）② manualResult 显示尺寸+base64 字符数 ③ 视觉与页面一致 → PASS | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 2074）：hilog `[ManualTest] Snapshot captured: 2092×1249, base64 523296 chars` + canvas 渲染确认。**2026-08-28 修复+验证通过**（3QC0124C11000038，pid 17061）。**原缺陷（接线 bug，非平台限制）**：`test_web_page_snapshot` 命令走 `web_page_snapshot()` 桥接路径，ArkTS `WebviewPlugin.ets:2132 webPageSnapshot` **按设计不传 RGBA 像素字节**（1.9MB 跨 NAPI 太慢，只返回 `success/width/height/rgba_len`），但前端 `manualWebPageSnapshot`（TestRunner.svelte:2262）却读 `result.rgba` 做 `putImageData` → `new Uint8ClampedArray(undefined)` 0 长度 → `ImageData` 抛 RangeError → canvas 永远空白。**修法（方案 A，复用已验证路径）**：`cmd.rs:1255` 改调 `handle.capture_webview()`（返回 base64 PNG）替代 `web_page_snapshot()`，emit `png_base64`+width+height；前端改用 `new Image()` + `ctx.drawImage` 替代 `putImageData(result.rgba)`，与 Screenshot.svelte 截图预览逻辑统一。hilog 铁证：`test_web_page_snapshot called` → `capture_webview success: 2389x1492 (389148 base64 chars)`（链路走通，base64 返回前端）。用户确认 canvas 渲染当前 WebView 内容 OK。对比：「📷 截图预览」按钮走 `capture-webview` 命令本就带 base64 PNG（一直正常），两按钮现统一路径 |
| plugin | continuation | boundary | 非 CONTINUATION 启动的参数不误判为接续 ✅ | **T1** | 应用已运行， hdc 可用 | 1. App 侧栏「Continuation」页点「查询恢复状态+数据」记录基线（普通启动：false/null） 2. `hdc shell aa start -b com.tauri.api -m entry_desktop -a EntryAbility --ps customKey customValue` 触发 onNewWant（带 parameters 的普通 want） 3. 回到 Continuation 页再点查询 | ① `isContinuationRestoreLaunch()` 仍为 false（launchReason 非 CONTINUATION）② `getContinuationData()` 仍为 null ③ hilog 无 onNewWant 异常 | **2026-08-31 复验 PASS（上库前终验）**（3QC0124C11000038，pid 2074）：基线 false/null → `aa start --ps customKey customValue` 注入后 hilog `onNewWant - uri: , parametersJson.length: 422` + `[JUA1277] not in continuation` → 复查询仍 false/null。**2026-08-28 PASS**。真机（3QC0124C11000038，pid 19880）hilog 铁证（清缓冲+Debug级+关流控全量抓取）：① 基线 `plugin:continuation\|is_continuation_restore respond ok=true`（UI `isContinuationRestoreLaunch: false`）+ `get_continuation_data respond ok=true`（UI 结果框 `getContinuationData：null（非接续启动或已被消费）`）；② `aa start --ps customKey customValue` 触发后 hilog 见 `NativeAbility: onNewWant - uri: , parametersJson.length: 423`（应用收到带参数 want）+ 框架判定 `[JUA1277] not in continuation`——带参数普通 want 走 WANT_PARAMETERS 通道不误入接续存储，与预期一致。注：getContinuationData 返回 null 时前端只赋 dataText 不 onMessage（结果框可见但 console 消息流不显示），非 invoke 挂起。真接续（launchReason=CONTINUATION）单设备不可注入，双设备流见下行 |
| plugin | continuation | source-save | 源端快照保存与 onContinue AGREE ✅ | **T1** | 双设备（同华为账号、均安装 app、`tauri.conf.json` 开 `bundle.openHarmony.continuable: true` 后 build 部署） | 1. 源设备 Continuation 页输入 payload（如 `{"route":"/article/42"}`），点「💾 保存快照」 2. `hdc shell hilog | grep -i onContinue` 开始监听 3. 从系统迁移入口（超级终端/接续）把 app 迁移到目标设备 | ① 源端 hilog 出现 `onContinue - AGREE, snapshot length: N`（N 为 payload 长度）② 目标设备 app 启动且迁移完成 | **2026-08-29 PASS**。双设备真机（源 Mate 70 CLS-AL00，目标 MateBook Pro 3QC0124C11000038，同华为账号，`bundle.openHarmony.continuable:true` 已验传播至 module.json5 ability 级 `continuable:true`+`continueType:["com.tauri.api"]`）。源端 setContinuationData(`{"route":"/article/42"}`) 后从超级终端迁移，hilog 铁证：`onContinue - AGREE, snapshot length: 23`（= `{"route":"/article/42"}` 23 字符）→ `DSchedContinueStateMachine update state from 0 to 1` → `OnContinueEndCmd called` → `update state from 1 to 2` → `update state from 2 to 3` → `onContinueDeviceChange set true: com.tauri.api`。状态机 0→1→2→3 完整流转，AGREE 确认。 |
| plugin | continuation | source-restore | 双设备完整往返（set → 迁移 → 目标端恢复） ✅ | **T1** | 上一用例通过（源端已 set 快照） | 1. 在源设备完成迁移 2. 目标设备 app 内进入 Continuation 页，点「isContinuationRestoreLaunch」 3. 点「getContinuationData」查看 payload | ① 目标端 `isContinuationRestoreLaunch()` === true（launchReason 为 CONTINUATION）② `getContinuationData()` 返回 JSON 串且 `JSON.parse(...).continuationData` 与源端 set 的 payload 逐字一致 ③ 再次调用返回 null（消费型） | **2026-08-29 PASS**。双设备真机（源 Mate 70→目标 MateBook Pro）。三判据全过：① `isContinuationRestoreLaunch` UI 显示 **true**；② 首次 `getContinuationData` UI 显示 JSON 内容（含 `{"route":"/article/42","scrollOffset":120}`，与源端 payload 逐字一致）；③ 再次 `getContinuationData` UI 显示 **null**（消费型）。hilog 铁证三按钮桥接全 `respond ok=true`（pid 8703）：`is_continuation_restore` + 首次 `get_continuation_data` + 二次 `get_continuation_data`。**关键修复**：此前目标端接续拉起白屏（只剩 app 图标，`SetUIContent timeout`），根因 `NativeAbility` 缺 `onWindowStageRestore` override——接续目标端（进程已存在 warm 路径）系统调 `onWindowStageRestore` 而非 `onWindowStageCreate`，基类空实现 → 不 loadContentByName + 不接线 bridge → webview 不创建 → 白屏。修法：加 `onWindowStageRestore(windowStage): void` override，warm continuation（`windowStageActive=true`）跳过重复 setup 避免覆盖已加载页，cold continuation（进程关掉重拉起）委托 `onWindowStageCreate` 全量 setup。两条路径真机均验白屏未复现：warm（pid 5766 `onWindowStageRestore: stage already active, skipping full setup`→`Resumed`）+ cold（pid 8703 `onWindowStageRestore: cold continuation, delegating to window-stage setup`→全量 webview/create→`Page End`）。注：接续后前端停在默认 Tests 页不自动导航到 `/article/42` 是 example app 设计（无自动恢复导航逻辑，需手动进 Continuation 页查 getContinuationData），非 native 层缺陷。`onWindowStageRestore` 签名须对齐基类 `(windowStage) => void`（三参数+async 版被 ArkTS 编译拒）。[[ohos-continuation-onwindowstagerestore-fix]] |

---

## 三十五、手动用例统计汇总

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
| RunEvent（生命周期事件） | 1 | 2 | **3** |
| Transparent（透明窗口） | 1 | 1 | **2** |
| on_new_window（新窗口拦截） | 2 | 1 | **3** |
| Single-Instance（单实例） | 3 | 1 | **4** |
| Predefined Multi-Window（预定义操作多窗口支持） | 6 | 8 | **14** |
| Notification（通知） | 1 | 2 | **3** |
| Sentry（错误追踪） | 1 | 1 | **2** |
| Unstable Feature（窗口与 Webview 解耦） | 2 | 1 | **3** |
| Global Shortcut（全局快捷键） | 2 | 0 | **2** |
| Window Focus（窗口聚焦） | 1 | 0 | **1** |
| Vibrancy（窗口模糊） | 3 | 1 | **4** |
| Deep-Link（深度链接） | 3 | 0 | **3** |
| Window Operations（窗口操作） | 3 | 0 | **3** |
| Persisted Scope（fs scope 持久化） | 2 | 0 | **2** |
| Opener（打开文件/URL） | 4 | 0 | **4** |
| Store（持久化存储） | 2 | 1 | **3** |
| Upload（文件上传） | 1 | 0 | **1** |
| Localhost（本地资源服务） | 1 | 0 | **1** |
| OHOS — Drag Overlay（拖拽降级） | 2 | 0 | **2** |
| OHOS — HTTPS Scheme（安全上下文） | 2 | 2 | **4** |
| OHOS — Monitor（真实值 + from-point） | 0 | 1 | **1** |
| OHOS — WebView Print（打印） | 1 | 0 | **1** |
| OHOS — Event Lifecycle（Start→Resumed） | 1 | 0 | **1** |
| OHOS — Clipboard Flag（with_clipboard 开/关） | 2 | 0 | **2** |
| OHOS — Zoom Flag（with_zoom_hotkeys 开/关） | 2 | 0 | **2** |
| OHOS — Dialog Error（降级不 panic） | 0 | 1 | **1** |
| OHOS — Window Ignore Cursor Events（事件穿透） | 1 | 1 | **2** |
| OHOS Gap — notification 触发（onAction/onNotificationReceived） | 1 | 1 | **2** |
| OHOS Gap — updater check（AppGallery 占位） | 0 | 1 | **1** |
| OHOS 移动原生插件 — barcode-scanner（scan/vibrate） | 1 | 1 | **2** |
| OHOS 移动原生插件 — biometric（authenticate） | 1 | 1 | **2** |
| OHOS 移动原生插件 — geolocation（定位/权限） | 0 | 1 | **1** |
| OHOS 移动原生插件 — haptics（三种效果） | 1 | 1 | **2** |
| OHOS 移动原生插件 — nfc（is_available/scan/write） | 1 | 1 | **2** |
| OHOS 移动原生插件 — huawei-account（一键登录） | 0 | 1 | **1** |
| OHOS Plugin emit/Channel（geolocation watch/notification action） | 1 | 3 | **4** |
| OHOS — Accessibility 插件（fontScale/屏幕阅读器） | 0 | 3 | **3** |
| OHOS — Screenshot 插件（截图预览/色块取色/canvas snapshot） | 2 | 1 | **3** |
| OHOS — Continuation 插件（接续边界/源端保存/双设备往返） | 0 | 3 | **3** |
| Key Repeat Detection（key-synthesis 长按/点按） | 2 | 2 | **4** |
| **合计** | **94** | **80** | **174** |

> **统计口径（2026-08-27 起）**: 已由自动测试覆盖并验证的用例不保留在本文档（从 §三十 移除 os 七项 + clipboard 三项，断言收紧进 `ohos-gap.ts`）。2026-08-27 逐行实核：此前合计含 4 个幽灵 T0（声称 96/78/174，实际 92/77/173），已按逐节表格行修正为 92/79/171（含本日新增 continuation T1 一例）。同日 Phase 3c 二次实核又发现分项表 6 处与表格行不符（Opener 少计 1 T0、Monitor 多计 1 T0、webPageSnapshot 幽灵行、emit/Channel 多计 1 T1、Accessibility 错记 1 T0 为 T1），已全部修正。2026-08-28 复验期间移除 §二十七 save-state（无法触发的定性用例，1 T1）；同日补 §三十四 screenshot canvas-snapshot（Take Snapshot 接线 bug 修复，1 T0）→ 92 T0 / 79 T1 / 171；key-synthesis 新增 2 T0 + 2 T1。以逐行 grep 实数为准（`grep -cE "\*\*T0\*\*"` / `"\*\*T1\*\*"` 校验行数，勿用 -o 计出现次数）。2026-08-29 移除 §九 Resumed T1（接续目标端白屏修复后由自动测试覆盖，判据 hilog `onWindowStageRestore` 双路径），合计 94 T0 / 81 T1 / 175。2026-08-31 移除 §十八 热键缩放 T1（主窗口默认 opt-in 不响应、flag=true 路径由 §二十七 覆盖，避免误判为缺陷），合计 94 T0 / 80 T1 / 174。

