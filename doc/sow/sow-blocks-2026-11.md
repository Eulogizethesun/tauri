

===== BLOCK 0 len=7848 =====
# SOW §五 托盘部分（tray-icon）逐条对照审计

证据文件缩写：
- **std** = `D:\xuqiu\tauri-3.0\tauri\examples\api\src\lib\tests\tray.ts`（31 条，category 全为 `auto`/`side-effect`，无 manual 标记，整套经 `desktopOnlySuite` 桌面形态门控，L495）
- **doc** = `D:\xuqiu\tauri-3.0\tauri\doc\manual_tests.md`（§一 Tray L19-29；§十四 Predefined Multi-Window L325-338）
- **btn** = `D:\xuqiu\tauri-3.0\tauri\examples\api\src\views\TestRunner.svelte`
- **cov** = `driver-generated.ts`（仅 L280 `cmd.simulate_tray_click` 1 条）；`fault-injection-generated.ts` 托盘零条目
- SOW 原文核实于 `D:\支撑Task\ohos-sow-20260909.md` L102-108（§五、桌面能力（muda、tray-icon：菜单与托盘），托盘表 7 行）

## 1. 逐条对照表

### 行1 托盘创建（11 条）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 创建托盘 | ✅ | std L28 `@tauri-apps/api/tray.TrayIcon.new`（断言 id 非空）；doc L19 T0 | std+doc 双层 |
| 创建带ID托盘 | ✅ | std L39 `TrayIcon.new_with_id`（断言 `tray.id === 'my-custom-tray'`，用后 removeById） | |
| 创建全选项托盘 | ✅ | std L216 `TrayIcon.new_with_full_options`（id/icon/tooltip/title/menu 全配，getById 复核+移除复核） | |
| 重建托盘 | ✅ | std L238 `TrayIcon.removeById_then_recreate`（remove→getById null→重建→getById 复核） | |
| 查询托盘 | ✅ | std L50 `TrayIcon.getById`（存在性+id 相等断言）；L61 `getById_not_found`（null 断言） | 正反两例 |
| 移除托盘 | ✅ | std L70 `TrayIcon.removeById`（side-effect，remove 后 getById null 断言） | |
| 移除全部托盘 | ✅ | doc L24 T1「Tray Page — Remove All Trays」；btn 佐证 `Tray.svelte:216` Remove All Trays 按钮 | std 层无批量移除用例，靠文档行达标 |
| 清理托盘 | ✅ | std L327 `TrayIcon.cleanup`（close() 前断言 sharedTray 已初始化） | smoke 级可运行；对应 JS 侧资源清理（close） |
| 创建全功能托盘 | ✅ | std L340 `TrayIcon.full_test_tray`（20 项菜单：普通/复选/图标/分隔/Copy/Cut/Paste/Undo/Redo/Minimize/Maximize/Fullscreen/CloseWindow/Hide/ShowAll/BringAllToFront/Quit，getById+移除断言）；doc L19-22 | |
| 创建多项托盘 | ✅ | std L454 `TrayIcon.tray_multi_item_menu`（6 项混合菜单，getById+移除断言） | |
| 自定义创建托盘 | ✅ | doc L23 T1「Tray Page — 自定义参数创建托盘」（Title/Tooltip/Icon 参数化创建，含 tooltip 悬停判据） | std 无独立自定义参数用例，靠文档行达标 |

### 行2 托盘图标（4 条）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 设置托盘图标 | ✅ | std L83 `TrayIcon.setIcon`（setIcon(TEST_ICON)，失败即 invoke reject）；另 L164 `_true` 亦先 setIcon | |
| 清空托盘图标 | ✅ | std L91 `TrayIcon.setIcon_null` | |
| 切换模板图标 | ✅ | std L155/L164/L173/L181 `setIconAsTemplate`×4（含 `_toggle` true→false→true→false）；doc L28 T0「Icon as Template — template 模式下深色/浅色壁纸适配」 | std 切 API 调用+doc 视觉适配双层 |
| 非模板图标对比 | ✅ | doc L29 T1「White Icon NO Template — 非 template 模式对比验证」（切壁纸图标不变+与 template 对照） | 壁纸对比语义只在文档层；std `_false` 仅置 false 无对照判据 |

### 行3 托盘菜单（7 条）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 设置托盘菜单 | ✅ | std L99 `TrayIcon.setMenu`（Menu.new+MenuItem 构造后挂载） | |
| 清空托盘菜单 | ✅ | std L110 `TrayIcon.setMenu_null` | |
| 替换托盘菜单 | ✅ | std L257 `TrayIcon.setMenu_replace`（menu1→null→menu2(2 项)→null） | |
| 显示托盘菜单 | ✅ | doc L20 T0「Full Test Tray — 右键菜单结构与项类型」（①弹出上下文菜单 ②4 自定义项+分隔线 ③11 预定义项逐项判据） | 显示为视觉判据，仅文档层 |
| 点击菜单项 | ✅ | std L422 `TrayIcon.tray_menu_item_click`（OHOS-only：`simulate_menu_click` + `get_tracked_menu_events` 包含断言）；doc L21 T0 | |
| 执行预定义操作 | ✅ | doc L22 T0「Full Test Tray — 预定义菜单项操作验证」（Copy/Cut/Minimize/Maximize/Fullscreen/Hide/ShowAll/CloseWindow 逐项+Menu Event Log 判据）；btn L3983 `Tray Predefined Actions`（L991 manualTrayPredefined）佐证 | 明确不测 Paste（OHOS 剪贴板读权限） |
| 验证托盘菜单点击 | ✅ | doc L21 T0「Full Test Tray — 自定义菜单项点击」（`[menu-event #N lid=1] global:normal-item` 日志判据）；std L422 同为事件链断言 | |

### 行4 托盘属性（5 条）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 设置托盘提示 | ✅ | std L118 `TrayIcon.setTooltip`（set→set null） | |
| 设置托盘标题 | ✅ | std L127 `TrayIcon.setTitle`（set→set null） | |
| 切换托盘可见 | ✅ | std L136 `TrayIcon.setVisible`（false→true）；L202 `getById_after_setVisible_false`（隐藏托盘仍在注册表断言） | |
| 设置临时目录 | ✅ | std L146 `TrayIcon.setTempDirPath`（'/tmp'→null） | |
| 设置左键菜单 | ✅ | std L192 `TrayIcon.setShowMenuOnLeftClick`（true→false） | |

### 行5 快捷操作面板（5 条）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 设置快捷操作 | ✅ | std L275 `TrayIcon.setQuickOperation`（title/height/abilityName/moduleName 全参） | |
| 清空快捷操作 | ✅ | std L288 `TrayIcon.setQuickOperation_null`；doc L27 T1（Disable QuickOp 即 setQuickOperation(null)） | |
| 更新快捷操作 | ✅ | std L296 `TrayIcon.setQuickOperation_update`（二次 set 后置 null）；doc L26 T1「Update QuickOp」（标题/高度变化判据） | |
| 启用快速面板 | ✅ | doc L25 T1「Enable QuickOp — 启用快速操作面板」（弹出 "Test Panel" 250vp 判据，仅 OHOS、需预注册 TestTrayAbility）；btn L3991/L2185 `manualQuickOperationEnable` | |
| 禁用快速面板 | ✅ | doc L27 T1「Disable QuickOp — 禁用快速操作」（不再弹出、仅事件判据）；btn L3993/L2199 `manualQuickOperationDisable` | |

### 行6 托盘事件（2 条）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 注册托盘事件 | ✅ | std L309 `TrayIcon.event_handler_register`（带 action 回调创建+getById 断言） | smoke 级：注册链路断言存在性，回调触发未在此条断言（由下条补） |
| 验证托盘点击 | ✅ | std L396 `TrayIcon.tray_event_chain`（OHOS-only：`simulate_tray_click` 后断言 `callbackFired === true`）；doc L333 T1（TrayIconEvent 转发到前端，`tray event {"type":"click"...}` 判据）；Rust 佐证 `examples\api\src-tauri\src\tray.rs:19` | |

### 行7 多窗口下的菜单与托盘操作（14 条）——全部在 doc §十四

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 复制子窗文本 | ✅ | doc L325 T0「Tray Copy 子窗口」（hilog `resolvedWindowId=1`/`copy textLen=16` 判据，2026-08-31 复验 PASS） | |
| 剪切子窗文本 | ✅ | doc L326 T1「Tray Cut 子窗口」（`T5cut rawLen=18` + 目视输入框删除） | |
| 全选子窗文本 | ✅ | doc L327 T1「Tray SelectAll 子窗口」（`T5selAll invoked` + 主窗不受影响） | |
| 复制主窗文本 | ✅ | doc L328 T1「Tray Copy 主窗口」（fallbackToExecutor=true 路径，`copy textLen=24`） | |
| 菜单栏复制文本 | ✅ | doc L338 T0「MenuBar Copy 主窗口」（MenuBar→Edit→Copy，targetWindowId 直达路径） | |
| 隐藏并托盘恢复 | ✅ | doc L329 T0「Menu Hide → 托盘左键恢复」（`startAbility succeeded` 判据；前置需清空 QuickOp abilityName） | |
| 关闭并托盘恢复 | ✅ | doc L330 T0「Menu Close 主窗口 → 托盘左键恢复」（closeWindow≡hideAbility，无 crash 判据） | |
| 最小化到任务栏 | ✅ | doc L331 T1「Menu Minimize — 最小化到最近任务」（`minimizeWithRestoreGuard` + WMSPc 系统日志判据） | |
| 优雅退出应用 | ✅ | doc L332 T1「Menu Quit — 应用退出」（`terminateSelf` 优雅退出、faultlogger 零新增 cppcrash 判据，含 exit(0)→SIGABRT 修复史） | |
| 显示全部窗口 | ✅ | doc L334 T0「Tray ShowAll — 隐藏后恢复应用」（showAbility+遍历 showWindow 判据） | |
| 窗口全部置前 | ✅ | doc L335 T0「Tray BringAllToFront — 隐藏后恢复应用」（OHOS 上等价 showAll 判据） | |
| 恢复子窗显示 | ✅ | doc L336 T1「BringAllToFront 子窗口恢复」（最小化子窗恢复；含 match 缺臂缺陷修复记录） | |
| 前台点击托盘 | ✅ | doc L333 T1「前台点击托盘图标 — 无副作用」（无闪烁 + Tray 页输出 tray event + startAbility 幂等） | |
| 前台显示全部 | ✅ | doc L337 T1「前台点击 ShowAll — 无副作用」（showAbility 幂等/对已可见窗无副作用） | |

## 2. 统计（57 条）

| 判定 | 数量 |
|---|---|
| ✅ 有对应用例 | **57** |
| ⚠️ 有名无实 | 0 |
| 🟡 仅覆盖率层 | 0 |
| ❌ 零用例 | 0 |

分层分布：std 层直接命中 22 条（tray.ts 31 条中约 22 条映射到 SOW 条目，其余为正例/边界补充如 `getById_not_found`、`setIcon_null` 系列）；manual 文档层直接命中 13 条（§一 L23/L24/L28/L29/L20/L22/L25/L26/L27 + §十四 14 条中有 5 条为唯一证据：L326/L327/L328/L336/L337 等文档专属判据）；双层互证 22 条。cov 层仅 1 条托盘相邻条目（`driver-generated.ts:280` `cmd.simulate_tray_click`），无任何 SOW 条目仅靠 cov 达标。

## 3. ❌/⚠️/🟡 关键词清单

无 ❌/⚠️/🟡 条目，无需关键词豁免清单。审计过程中实际执行过的排查：`grep tray/Tray` 于 tray.ts、driver-generated.ts、fault-injection-generated.ts、core.ts、ohos-init.ts、TestRunner.svelte（含 `QuickOp`）、cmd.rs、lib.rs、tray.rs、Tray.svelte、manual_tests.md 全文（中文「托盘/恢复/任务栏/优雅退出」及 §十四）；SOW 原文逐行核对于 `D:\支撑Task\ohos-sow-20260909.md` L98-110。

## 备注（非判定项，供验收参考）

1. **std 层桌面形态门控**：tray.ts L489-495 整套包 `desktopOnlySuite`，mobile 形态构建下整套 skip——与 SOW §五「桌面启用、移动不启用」验收点一致，属预期行为而非缺口。
2. **Rust 侧 builder 变体未单列**：SOW 用例表述未逐条点名 `withId/withDefault/withIcons/fromResource`、`TrayMenu::with_items` 等 Rust builder API；std 层经 `TrayIcon.new({...})` 选项间接覆盖 id/icon/menu 组合（`new_with_id`、`new_with_full_options`）。四层中无独立 builder 用例，但 SOW 条目本身不构成缺口。
3. **std 层 smoke 倾向**：属性类用例（setTooltip/setTitle/setVisible/setTempDirPath/setShowMenuOnLeftClick/setIcon）多为「调用不抛错」型，无回读断言；但均按口径计入 ✅（smoke 级可运行），且配套正反例（`setIcon_null`、`getById_not_found`、`getById_after_setVisible_false`）补强。
4. **文档层强判据**：§十四 14 条全部带 2026-08-31 真机复验 hilog 判据与 PASS 记录，判据质量高于 std smoke 层；doc L22 预定义操作明确披露 Paste 不测（OHOS 剪贴板读权限平台限制）。
5. **托盘事件前端按钮无独立文档行**：TestRunner.svelte 的 `Tray Icon Show`(L3980)/`Tray Event`(L3981)/`Tray Menu`(L3982) 三按钮无 §一 专属行，但其对应 SOW 条目均已由 std 或 doc 行达标，不构成 ⚠️（⚠️ 口径=该 SOW 条目仅有按钮无判据）。

===== BLOCK 1 len=10291 =====
# SOW §五 菜单部分 用例对照审计（tauri 仓 ohdev 工作树）

**分层证据源核实**（先给出四层现状，逐条引用）：
- std 实跑层：`D:\xuqiu\tauri-3.0\tauri\examples\api\src\lib\tests\menu.ts`（1233 行；`menuTestsInner` 全套经 `desktopOnlySuite` 包裹，menu.ts:1232；**category='manual' 在 runAll 中直接记 skip**，test-runner.ts:187-198——故 manual 标记按口径判 ⚠️）。menu.ts 共 **14 个 manual 占位**：`Menu.popup`(218)、`Menu.popup_at`(232)、`Submenu.popup`(524)、`Submenu.popup_at`(536)、`Submenu.nested`(548)、`PredefinedMenuItem.minimize`(656)、`maximize`(665)、`closeWindow`(674)、`hide`(683)、`quit`(692)、`about_exec`(959)、`Menu.full_workflow`(969)、`Menu.with_submenu`(977)、`Menu.popup_at_position`(1010)。
- cov 层菜单相关 4 处：api-gap.ts:236 `gapCase('menu.set_as_app_menu+window_menu+nsapp')`（真调 setAsAppMenu+setAsWindowMenu；该文件自述仅 VITE_COVERAGE_TESTS 注入，api-gap.ts:25-26）；driver-generated.ts:914 `driverCase('menu.Menu.default')`；driver-generated.ts:205 `cmd.get_tracked_menu_events`；fault-injection-generated.ts:163 `menu.set-menubar.error` + :166 `menu.popup.timeout`。
- 手动文档层：`D:\xuqiu\tauri-3.0\tauri\doc\manual_tests.md` §二 2.1 菜单栏 22 行表（59-81 行）+ 2.2 弹出菜单 7 行表（87-92 行）。
- 手动按钮区：`examples\api\src\views\TestRunner.svelte`「Menu Bar Manual Tests」22 按钮（3999-4022 行，函数体 608-1004 行）；`views\Menu.svelte` MenuBuilder 4 按钮（81-84 行）。

---

## 1. 菜单创建（7 条）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 创建菜单 | ✅ | menu.ts:30 `@tauri-apps/api/menu.Menu.new`（id 非空断言） | |
| 创建带ID菜单 | ✅ | menu.ts:40 `Menu.with_id`（id === 'custom-menu-id'） | |
| 创建带项菜单 | ✅ | menu.ts:49 `Menu.with_items`（items.length===2） | |
| 创建混合菜单 | ✅ | menu.ts:992 `Menu.mixed_items`（MenuItem+Submenu+Separator+Check+Icon 五类混装，length===5） | |
| 创建应用菜单 | ✅ | manual_tests.md:92「Menu Page — Create menu 创建应用菜单」T1；按钮 TestRunner.svelte:81 + Menu.svelte:43 `macOS ? setAsAppMenu() : setAsWindowMenu()` | std 层无 setAsAppMenu/setAsWindowMenu 自动用例；纯 setAsAppMenu 真调用在 cov api-gap.ts:236 |
| 创建图标菜单 | ✅ | menu.ts:800 `IconMenuItem(native icon variants)`（auto，8 变体创建断言）+ manual_tests.md:90 T1「Create menu with NativeIcon」（Submenu 级 Folder 图标，2026-08-29 真机 PASS） | |
| 创建图片菜单 | ✅ | manual_tests.md:91 T1「Create menu with Image icon」（defaultWindowIcon）；Menu.svelte:29-35/55 | std 层 IconMenuItem 用的是 data URI 位图，非「图片菜单」原始语义 |

## 2. 菜单项操作（10 条，全 std 实跑）

| SOW 用例 | 判定 | 证据（menu.ts） |
|---|---|---|
| 追加菜单项 | ✅ | :75 `Menu.append`（length===1） |
| 批量追加菜单项 | ✅ | :87 `Menu.append_items`（length===2） |
| 前插菜单项 | ✅ | :100 `Menu.prepend`（首项 id 相等断言） |
| 批量前插菜单项 | ✅ | :115 `Menu.prepend_items`（length===3） |
| 插入菜单项 | ✅ | :130 `Menu.insert`（中位 id 相等断言） |
| 批量插入菜单项 | ✅ | :147 `Menu.insert_items`（length===3） |
| 移除菜单项 | ✅ | :162 `Menu.remove`（归零断言） |
| 按索引移除菜单项 | ✅ | :175 `Menu.removeAt`（剩余 text==='B' 断言） |
| 查找菜单项 | ✅ | :190 `Menu.get`（id==='lookup-item'）——JS API 名为 get()，非 find/indexOf |
| 列出菜单项 | ✅ | :203 `Menu.items`（数组+length===2） |

## 3. 菜单项类型（19 条 = 4 + 预定义 13 + 关于对话框 + 校验类型）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 创建菜单项 | ✅ | menu.ts:244 `MenuItem.new`（text 回读断言） | |
| 创建勾选项 | ✅ | menu.ts:717 `CheckMenuItem.new` | |
| 创建图标项 | ✅ | menu.ts:786 `IconMenuItem.new` | |
| 创建分隔符 | ✅ | menu.ts:568 `PredefinedMenuItem.separator`（id 非空） | |
| 预定义·复制 | ✅ | menu.ts:579 `PredefinedMenuItem.copy`（text 非空）+ 文档 2.1:65 T0 + 2.2:89 T0 + 按钮 900/4019 | |
| 预定义·剪切 | ✅ | menu.ts:590 `cut` + 文档 2.1:81 T1「Menu Edit→Cut」+ 按钮 924/4021 | |
| 预定义·粘贴 | ✅ | menu.ts:601 `paste` + 文档 2.1:80 T1「Menu Edit→Paste」+ 按钮 912/4020 | 文档注明 OHOS 剪贴板读权限限制当前无法验证 |
| 预定义·全选 | ✅ | menu.ts:612 `selectAll`（text 非空） | |
| 预定义·撤销 | ✅ | menu.ts:623 `undo` | |
| 预定义·重做 | ✅ | menu.ts:634 `redo` | |
| 预定义·全屏 | ✅ | menu.ts:645 `fullscreen` + 文档 2.1:67 T0「MenuBar Fullscreen」（真点击进全屏） | |
| 预定义·最小化 | ⚠️ | menu.ts:656 `PredefinedMenuItem.minimize` category='manual' 占位（fn 有 smoke 断言但 runAll 直接 skip） | 无专行文档/按钮；仅在 menuBarRestore 组合（TestRunner.svelte:628）与 tray phase13（:998）间接出现 |
| 预定义·最大化 | ⚠️ | menu.ts:665 `maximize` manual 占位 | 同上，仅 TestRunner.svelte:629 组合 |
| 预定义·关闭窗口 | ⚠️ | menu.ts:674 `closeWindow` manual 占位 | 仅 TestRunner.svelte:615/629 组合；window-ops.ts:783 的 closeWindow 是窗口关闭语义非预定义项 |
| 预定义·隐藏 | ✅ | std 占位 menu.ts:683（manual）；但文档 2.1:77 T1「MenuBar Predefined Hide — 预定义隐藏窗口」专行（有步骤判据）+ 按钮 855/4016 | 2026-11-05 起 PC/2in1 口径改平台限制 SKIP（hideAbility 拒绝），裁定不降级 |
| 预定义·退出 | ⚠️ | menu.ts:692 `quit` manual 占位 | 无专行文档/按钮；仅 menuBarRestore File 子菜单（TestRunner.svelte:617）与 tray phase13（:1002）间接出现 |
| 预定义·关于 | ✅ | menu.ts:946 `PredefinedMenuItem.about`（AboutMetadata 形态，text 非空）+ menu.ts:1151 `about_exec_auto`（side-effect，popup 后 items===1） | 对话框实际弹出仍需人工点击（about_exec 占位 menu.ts:959 manual） |
| 关于对话框 | ✅ | 同上：menu.ts:946 + :1151 | 与预定义·关于证据重叠 |
| 校验菜单项类型 | ✅ | menu.ts:897 `MenuItem.kind`；另 `Submenu.kind`:907 / `PredefinedMenuItem.kind`:916 / `CheckMenuItem.kind`:925 / `IconMenuItem.kind`:934 | |

## 4. 菜单项属性（8 条，全 std 实跑）

| SOW 用例 | 判定 | 证据（menu.ts） |
|---|---|---|
| 读取项文本 | ✅ | :264 `MenuItem.text` |
| 设置项文本 | ✅ | :274 `MenuItem.setText`（回读断言） |
| 查询项启用 | ✅ | :285 `MenuItem.isEnabled` |
| 设置项启用 | ✅ | :295 `MenuItem.setEnabled(false)`（回读 false） |
| 设置项快捷键 | ✅ | :306 `MenuItem.setAccelerator('Ctrl+O')`（Check/Icon 同族 :774/:866） |
| 设置勾选状态 | ✅ | :737 `CheckMenuItem.setChecked`（回读 false） |
| 设置图标项图标 | ✅ | :831 `IconMenuItem.setIcon` |
| 注册项回调 | ✅ | :878 `MenuItem.action`（注册无错断言）；真实触发链由 :1170 full_workflow_auto 补全 |

## 5. 子菜单（6 条，全 std 实跑）

| SOW 用例 | 判定 | 证据（menu.ts） |
|---|---|---|
| 创建子菜单 | ✅ | :318 `Submenu.new`（+ with_id :328 / with_items :337） |
| 子菜单项增删改查 | ✅ | append :351 / append_items :363 / prepend :377 / prepend_items :391 / insert :406 / insert_items :420 / remove :435 / removeAt :448 / items :461 / get :474 |
| 设置子菜单图标 | ✅ | :513 `Submenu.setIcon` |
| 读写子菜单文本 | ✅ | :487 `Submenu.text`（含 setText 回读断言） |
| 切换子菜单启用 | ✅ | :500 `Submenu.isEnabled`（含 setEnabled(false) 断言） |
| 嵌套子菜单 | ✅ | :1123 `Submenu.nested_auto`（side-effect，父子双层 items 断言）；manual 占位 `Submenu.nested` :548 |

## 6. 菜单栏（25 条：24✅ + 1🟡）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 设置应用菜单 | ✅ | 文档 2.2:92 T1 + cov api-gap.ts:236 | std 无自动用例；按钮区 636/658/675/688/701/715 等大量 setAsWindowMenu 调用 |
| 获取默认菜单 | 🟡 | 仅 cov：driver-generated.ts:914 `menu.Menu.default`（Menu.default()+items() 盲调） | std/文档/按钮无专行；TestRunner「Restore Default Menu」:611-638 是手工重建 File/Edit/Window/Help，非 Menu.default()；Rust 默认菜单在 lib.rs:632 `Menu::default` 仅作 app 装配 |
| 查询菜单可见 | ✅ | 文档 2.1:59 T0「MenuBar Visible」+ 按钮 :642 `is_menu_visible` | |
| 查询菜单状态 | ✅ | 文档 2.1:69 T1「MenuBar is_menu_visible — 可见性查询」+ 按钮 :740 | OHOS 侧唯一状态查询 API 即 is_menu_visible，与上条同 API 双行覆盖 |
| 展开下拉菜单 | ✅ | 文档 2.1:60 T0「MenuBar Dropdown」+ 按钮 :650 | |
| 隐藏菜单栏 | ✅ | 文档 2.1:61 T0「MenuBar Hide」+ 按钮 :721（hide_menu） | |
| 显示菜单栏 | ✅ | 文档 2.1:62 T0「MenuBar Show」+ 按钮 :730（show_menu） | |
| 移除菜单栏 | ✅ | 文档 2.1:68 T1「MenuBar Remove」+ 按钮 :748（空菜单 setAsWindowMenu） | |
| 触发自定义快捷键 | ✅ | 文档 2.1:63 T0「MenuBar Accelerator Ctrl+O」+ 按钮 :811 | 2026-09-07 host uinput 注入真机 PASS；原自动用例 09-09 迁档出套件（risk-supplement.ts:10-12），判据完整留存文档 |
| 复制快捷键 | ✅ | 文档 2.1:74 T1「MenuBar Accelerator Ctrl+C」+ 按钮 :831 | |
| 点击菜单事件 | ✅ | 文档 2.1:64 T0「MenuBar Action Event」+ 按钮 :878 | JS action 回调 + Rust 全局 menu-event 双验证（lib.rs:454 on_menu_event） |
| 切换勾选状态 | ✅ | 文档 2.1:66 T0「MenuBar Check Item」+ 按钮 :772 | |
| 全屏窗口操作 | ✅ | 文档 2.1:67 T0「MenuBar Fullscreen」+ 按钮 :843 | |
| 展开嵌套菜单 | ✅ | 文档 2.1:70 T1「MenuBar Nested Submenu」+ 按钮 :664 | |
| 悬停高亮菜单 | ✅ | 文档 2.1:71 T1「MenuBar Hover」+ 按钮 :681 | |
| 显示栏级图标 | ✅ | 文档 2.1:72 T1「MenuBar Bar-Level Icon」+ 按钮 :694 | |
| 禁用菜单项 | ✅ | 文档 2.1:73 T1「MenuBar Disabled Item」+ 按钮 :707 | |
| 刷新菜单文本 | ✅ | 文档 2.1:75 T1「MenuBar Auto Refresh Text」+ 按钮 :758 | |
| 刷新勾选状态 | ✅ | 文档 2.1:76 T1「MenuBar Auto Refresh Checked」+ 按钮 :772 | |
| 隐藏窗口 | ✅ | 文档 2.1:77 T1「MenuBar Predefined Hide」+ 按钮 :855 | PC/2in1 hideAbility 平台拒绝→SKIP 口径，诚实契约不降级 |
| 回归弹出菜单 | ✅ | 文档 2.1:78 T1「MenuBar Popup Regression」+ 按钮 :867 | |
| 映射原生图标 | ✅ | 文档 2.1:79 T1「MenuBar NativeIcon Symbols」+ 按钮 :936（Mapped/Unmapped 两组）+ std menu.ts:800 | 56 变体全量映射（#112），2026-11-05 真机复验 PASS |
| 预定义复制 | ✅ | 文档 2.1:65 T0「Menu Edit→Copy」+ 按钮 :900 | |
| 预定义粘贴 | ✅ | 文档 2.1:80 T1「Menu Edit→Paste」+ 按钮 :912 | 剪贴板读权限限制，当前无法验证 |
| 预定义剪切 | ✅ | 文档 2.1:81 T1「Menu Edit→Cut」+ 按钮 :924 | |

## 7. 弹出菜单（11 条，全 ✅）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 弹出菜单 | ✅ | menu.ts:1054 `Menu.popup_auto`（side-effect，popup 后 items===3）+ 文档 2.2:87 T0 | manual 占位 `Menu.popup` :218 |
| 定点弹出菜单 | ✅ | menu.ts:1071 `Menu.popup_at_auto`（LogicalPosition(100,200)） | manual 占位 `popup_at` :232 / `popup_at_position` :1010 |
| 弹出上下文菜单 | ✅ | 文档 2.2:87 T0（「光标位置弹出上下文菜单」判据）+ menu.ts:1054 | |
| 点击弹出菜单项 | ✅ | 文档 2.2:88 T0「Popup Click Item」（UI 输出 `Item ... clicked` 判据） | 自动等价 = full_workflow_auto simulate_menu_click |
| 弹出菜单复制 | ✅ | 文档 2.2:89 T0「Popup Predefined Copy」 | |
| 弹出子菜单 | ✅ | menu.ts:1088 `Submenu.popup_auto` | |
| 定点弹出子菜单 | ✅ | menu.ts:1105 `Submenu.popup_at_auto` | |
| 嵌套子菜单校验 | ✅ | menu.ts:1123 `Submenu.nested_auto`（父子双层断言） | |
| 模拟点击触发回调 | ✅ | menu.ts:1170 `Menu.full_workflow_auto`（`plugin:app-menu\|simulate_menu_click` + callbackFired + get_tracked_menu_events 三重断言） | |
| 子菜单点击回调 | ✅ | menu.ts:1196 `Menu.with_submenu_auto`（同链，子菜单项 id） | |
| 验证剪贴板原语 | ✅ | menu.ts:1020 `predefined_clipboard_primitives`（side-effect：getSelection / execCommand insertText / selectAll 三断言） | |

---

## 统计（按逐条枚举共 86 条；预定义按 13 子项计，其中「关于」与「关于对话框」证据重叠）

| 判定 | 数量 | 占比 |
|---|---|---|
| ✅ 有对应用例 | **81** | 94.2% |
| ⚠️ 有名无实 | **4** | 4.7% |
| 🟡 仅覆盖率层 | **1** | 1.2% |
| ❌ 零用例 | **0** | 0% |

⚠️ 4 条：预定义·最小化（menu.ts:656）、预定义·最大化（menu.ts:665）、预定义·关闭窗口（menu.ts:674）、预定义·退出（menu.ts:692）——均为 manual 占位（fn 有 smoke 断言但 runAll 记 skip），无专行文档/按钮，仅在 menuBarRestore 与 tray phase13 组合中间接出现。
🟡 1 条：获取默认菜单（driver-generated.ts:914）。

## ❌/⚠️/🟡 逐条搜过的关键词

- 最小化：menu.ts `Minimize`；manual_tests.md `Minimize`（仅 62 行组合语提及）；TestRunner.svelte `Minimize`（:628 menuBarRestore 组合、:998 tray 组合）
- 最大化：`Maximize`（同上三处，均组合非专行）
- 关闭窗口：`CloseWindow`（menu.ts/manual_tests.md/TestRunner :615/:629）；window-ops.ts:783 `closeWindow`（窗口语义，非预定义项）
- 退出：`Quit|Exit|退出`（manual_tests.md 全文无菜单域 Quit 专行）；TestRunner `Quit`（:617/:1002 组合）
- 获取默认菜单：`Menu.default`、`default menu`、`默认菜单`（std/文档/按钮均无专行；仅 cov driver-generated.ts:914）

**结论**：菜单域覆盖近乎满格，std 实跑层承担全部数据面 API（创建/增删改查/属性/子菜单/预定义文案），UI 交互面（下拉/悬停/隐藏显隐/快捷键/预定义窗口动作）由 manual_tests.md §二 22+7 行 T0/T1 承担且每行有按钮支撑。仅「获取默认菜单」缺 std 层专行（cov 有盲调），预定义 Minimize/Maximize/CloseWindow/Quit 四项无创建级实跑用例。

===== BLOCK 2 len=7477 =====
复核完成。四层证据（std / cov / manual / 按钮）+ Rust/ArkTS API 佐证均已重定位。分层口径先注明：`driver-generated.ts`（driverCase/sideCase/badCase）、`api-gap.ts`、`fault-injection-generated.ts`、`window-ops-extra.ts` 全部只在 `VITE_COVERAGE_TESTS` 时拼入（TestRunner.svelte:116）= 覆盖率层；`risk-supplement.ts` 无条件进 allTests（TestRunner.svelte:117）= std 层。

## 18 条逐条复核

**1. 剪贴板大图写入读回 — 维持 ❌**
std 上限仍 4x4：`plugins.ts:397` `@tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage`、`plugins.ts:451` `writeImage(4x4 alpha)+readImage x2 [V5 #113]`；manual 按钮 7 个全 1x1（TestRunner.svelte:3947-3953，handlers 1032-1110）；cov 仅错误分支 `driver-generated.ts:1008` `side.clipboard.writeImage.tiny`。全树 grep `writeImage|大图|512|1024` 无大图条目。

**2. log 统一输出 — 维持 ❌**
std 仍 5 条分级 smoke（plugins.ts:83/91/99/107/115 trace/debug/info/warn/error）；cov 新增 4 条同级 smoke（driver-generated.ts:344/347/350/353）；`attachConsole|attachLogger|统一输出` 在 examples/api/src 全目录与 manual_tests.md 零命中；manual 无 log 章节。

**3. store 重置存储数据 — 翻转 ❌→🟡（仅覆盖率层）**
cov：`driver-generated.ts:400` `driverCase('store.reset')`（load→set k1/k2→reset→close）。std 仍无：plugins.ts:1385 `set+get+has+keys+entries+delete` 不含 reset；manual §23 三行（manual_tests.md:479-481）无 reset；TestRunner 无 reset 按钮（4189-4190 仅 Persist/Verify）。API 佐证：plugins-workspace `store/src/lib.rs:200-202` `fn reset` + `:445` generate_handler 含 reset（原 446-448 漂移至 445）。

**4. sql 内存数据库 :memory: — 翻转 ❌→🟡**
cov：`driver-generated.ts:404` happy path（`sqlite::memory:` CREATE/INSERT/SELECT/close）+ `:407` bad-SQL 错误分支。std 仍文件型：plugins.ts:1412 `load+execute+select+close` → :1417 `sqlite:${uniq('test')}.db`；manual 无 sql 行。

**5. upload 下载远程文件 — 翻转 ❌→🟡**
cov：`driver-generated.ts:412` `driverCase('upload.download.localhost')`（download http://localhost:3005/ → appCacheDir 落盘 + progress 回调）。std 仍仅上传：plugins.ts:1460 `upload (echo+progress)`；manual §24 仅 upload progress 行（:493）。API 佐证：upload/src/lib.rs:76 `fn download` + :192 generate_handler `[download, upload]`（原 192 行号语义漂移，现为 handler 行）。

**6. barcode 取消扫码 cancel — 翻转 ❌→🟡**
cov：`driver-generated.ts:466` `driverCase('barcode-scanner.cancel')`。API 佐证：plugins-workspace `barcode-scanner/openharmony/src/main/ets/Plugin.ets:126` cancel → `:205-208` handleCancel `resolve('')`（:206-207 注明 OHOS 无程序化 cancel API）。std 仍仅 `ohos-mobile-plugins.ts:72` `check_permissions`；manual §31 仅 scan(:636)/vibrate(:637) 两行；TestRunner:4141-4142 仅 Scan/Vibrate 按钮。注：ArkTS 插件现居 plugins-workspace 仓（原审计记 openharmony-ability 仓 Plugin.ets:126——行号恰同、仓归属已漂移）。

**7. barcode 打开扫码设置 openAppSettings — 翻转 ❌→🟡**
cov：`driver-generated.ts:469` `driverCase('barcode-scanner.open_app_settings')`。API 佐证：Plugin.ets:129 + `:382-402`（UIAbilityContext startAbility 设置页）。其余层同第 6 条全空。

**8. updater download_and_install — 维持 ❌（OHOS 有意不注册=平台契约，非缺口）**
门控原样：plugins-workspace `updater/src/lib.rs:269-274` desktop 命令（含 download_and_install :273）在 cfg(not(ohos))；`:278-283` 注释「intentionally NOT registered on OHOS…aligns with upstream android/ios」；`:284-290` OHOS 仅注册 check_app_gallery_update/show_app_gallery_update_dialog。新增佐证两条（均不构成用例翻转）：cov `driver-generated.ts:1017` `side.updater.download_and_install` 盲调用（OHOS 上 check 即拒=错误分支）；TestRunner.svelte:2019-2045/3941 `manualDownloadAndInstall` 按钮在 OHOS 上 check() 必拒（仅记录形态）。manual 无 download_and_install 行（§30 仅 updater.check :601）。

**9. sentry test_panic — 翻转 ❌→🟡（附两处过时注释新发现）**
cov 新增：`driver-generated.ts:286` `driverCase('cmd.sentry_test_panic')`。std 维持零用例（plugins.ts sentry 段仅 breadcrumb :988/envelope :1072/rust_breadcrumb :1155）。manual T1 行（manual_tests.md:359「Rust Panic Capture」）指向同一命令，原审将其计入「捕获Rust崩溃」行。漂移发现：`cmd.rs:1970` 已新增 `#[cfg(debug_assertions)]` 门控（命令原 cmd.rs:1359 漂移至 :1972）——manual_tests.md:359 的 08-31 备注「无 debug 门控、release 同样触发」与 TestRunner.svelte:3365 注释「sentry_test_panic has no cfg gate」双双过时；release 插桩形态下该 cov 用例走命令不存在分支。

**10. process 重启应用 relaunch — 维持 ⚠️**
plugins.ts:719-722 `@tauri-apps/plugin-process.relaunch` 占位空 fn（category manual）不变；TestRunner.svelte:2008-2016/3940 `manualRelaunch` 按钮真实调 relaunch 并带「promise 不 resolve/2s 内重启」说明文字，但 manual_tests.md 无 plugin-process 行（grep relaunch|plugin-process 零命中）；manual:235 danger-mode restart 验的是 core request_restart（#101），非 plugin-process relaunch。

**11. shell 创建Shell命令 Command.spawn — 翻转 ⚠️→✅（有限定）**
std 层已有全断言用例：risk-supplement.ts:93-118 `shell spawn + stdin_write + kill（交互式子进程全生命周期）`（Command.create('sh')+spawn+pid/stdin/stdout/close 全断言，:79 skipOnMobile——mobile 沙箱拒 exec，2in1 desktop 实跑）；另有 :75-91 `shell execute: sh -c echo`。plugins.ts:777-780 `plugin-shell.open` 占位与 manual 无 shell 章节的事实不变；ohos-gap.ts:387-393 另有一条 `plugin-shell.Command.spawn (manual)` 占位（声称 OHOS 沙箱不能 exec 任意二进制，与 risk-supplement desktop 实跑并存=形态差异表述，且 :391 引用 manual §三十一为悬空引用）。注意：risk-supplement 该用例自 2026-09-04 即在树上（文件头注明），原审 10-13 时点可见——原 ⚠️ 若按「plugins.ts 占位+manual 无行」口径成立，按「std 有断言」口径当时即应 ✅。

**12. shell 运行Sidecar sidecar — 维持 ⚠️**
ohos-gap.ts:379-385 `@tauri-apps/plugin-shell.sidecar (manual — external binary)` manual 占位（console.log 空壳、无按钮）；cov 零命中（grep sidecar 仅此一处）；manual_tests.md 无 sidecar 行（:377/:383 引用「manual_tests.md §三十一」悬空——§31 是移动原生插件章）；结构性前置（externalBin 外部二进制）未变。

**13. opener 打开缓存目录/打开本地链接 — 翻转 ⚠️→🟡（两个特指形态已进 cov）+ manual 相邻形态已实收**
cov：`driver-generated.ts:992` `side.opener.openPath.cache`（openPath(appCacheDir) 目录本体）+ `:989` `side.opener.openUrl.localhost`（http://localhost:3005/）+ 错误分支 `:427/:430`（nonexistent path）。同时 opener 整体已实收 manual：plugins.ts:1536-1540 注明 opener 改 manual-only，manual_tests.md §二十二（:447-464）新增 4 行 T0 全 ✅ 并附 08-31 真机复验证据（openPath 缓存目录文件/reveal 沙箱 documented error/reveal 公共目录 FM/openUrl 外链），TestRunner.svelte:3620-3678/4180-4188 四按钮均带 PASS 判据文案。特指「缓存目录本体」「localhost 本地链接」两形态仍仅 cov。

**14. window-state 清空窗口状态 clear — 维持 ⚠️**
TestRunner.svelte:3482-3484 `manualWindowStateClear` → cmd.rs:2848 `clear_window_state`（原 :2235 漂移）、按钮 :4172；cov `driver-generated.ts:268` `cmd.clear_window_state` + `:436` `window-state.save+restore`；manual_tests.md 仍无 clear 行（§21 仅 save/restore 行 :441）。

**15. updater 打开更新对话框 showAppGalleryUpdateDialog — 维持 ⚠️（准孤儿）**
唯一变化：plugins.ts:954-960 新增有名 manual 占位 `@tauri-apps/plugin-updater.showAppGalleryUpdateDialog`（空 fn、runner 恒 skip、无 TestRunner 按钮——updater 区仅 relaunch/downloadAndInstall 两按钮 :3940-3941、无 doc 行；§30 仅 updater.check :601）。API 侧已注册（updater lib.rs:289 ohos::show_app_gallery_update_dialog）。

**16. fs.open+write 打开写入文件 — 维持 🟡**
api-gap.ts:113-121 `fs.open+write`（open(rid)→write(33B)→close，步级 gapLog）；仅 VITE_COVERAGE_TESTS 注入；std/manual 无新增。

**17. fs readTextFileLines 按行读取 — 维持 🟡**
api-gap.ts:122-130 `fs.readTextFileLines+next`（writeTextFile→lines.next 首行断言 'line1'）；同上 cov-only。

**18. shell open('help') 打开帮助 — 维持 🟡**
cov：`driver-generated.ts:1014` `side.shell.open.help`（原 :715 漂移）。std 新增近邻：risk-supplement.ts:127-133 `shell.open URL 经 OHOS url 桥接 resolve（#207 修复回归）`（https URL 形态，非 'help' scheme）；plugins.ts:777 shell.open manual 占位不变；manual 无行。

## 7 条推荐补例落点结论

- **均已补的：0 条全补；5 条半补（仅 cov 层）**：store reset（driver-generated.ts:400）、upload download（:412）、sql :memory:（:404/:407）、barcode cancel（:466）、barcode openAppSettings（:469）。这 5 条正是本轮 ❌→🟡 翻转的来源。
- **未补的 2 条**：剪贴板大图（上限仍 4x4）、log 统一输出（attachConsole/attachLogger 全树零命中，cov 只加了同级分级 smoke）。
- **risk-supplement 两条已落 std**（risk-supplement.ts:127 shell.open #207、:143 resourceDir #226，均为有断言用例）：对第 18 条只覆盖 shell.open 的 URL 形态，'help' 形态仍仅 cov；对第 13 条不构成覆盖（plugin-shell ≠ plugin-opener），第 13 条是经 manual §二十二独立翻转为实收。

**净变化**：139✅/9❌/6⚠️/3🟡 → 140✅/2❌/4⚠️/8🟡（按当前树四层口径；第 8 条按「平台契约非缺口」维持 ❌）。两处新发现的过时注释（cmd.rs:1970 debug 门控 vs manual:359/TestRunner:3365「无门控」）建议随下轮订正。

===== BLOCK 3 len=10532 =====
审计完成。以下为逐条判定结果。

# SOW §三「核心能力 tauri（应用框架与事件）」逐条对照

前置事实（影响判定的套件结构）：
- std 实跑批 = `TestRunner.svelte:117` 的 `allTests`（core/plugins/dpi/windowDpi/image/menu/tray/ohos-*/window-ops/risk-supplement/stronghold/zombie-close），`TestRunner.svelte:134` 只过滤 `category:'manual'`，`side-effect` 照跑。
- cov 批 = `TestRunner.svelte:116` `coverageTests`（仅 `VITE_COVERAGE_TESTS`）：driver-generated / side-replay / bad-input / fault-injection / window-ops-extra / api-gap，共 6 文件，全部为盲调用或盲测语义。
- `api-gap.ts:25-26` 自证「仅 VITE_COVERAGE_TESTS 注入，283 例标准 demo 不含本批」。

## 一、应用信息与主题（12 条：4 ✅ / 8 🟡 / 0 ⚠️ / 0 ❌）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 读取应用版本 | ✅ | `core.ts:383` `@tauri-apps/api/app.getVersion`（auto，断言非空 string） | |
| 查询OHOS版本 | ✅ | `core.ts:364` `@tauri-apps/ohos.versionInfo`（auto，断言 sdkApiVersion≥12 / distributionApiVersion&gt;0）；Rust 侧 `cmd.rs:612` `get_ohos_version_info`、`lib.rs:988` 注册 | |
| 读取应用名称 | 🟡 | `driver-generated.ts:845` `app.getName`（cov 盲调用） | std 仅 core.ts 的 getVersion |
| 读取Tauri版本 | 🟡 | `driver-generated.ts:848` `app.getTauriVersion` | |
| 读取应用标识 | 🟡 | `driver-generated.ts:851` `app.getIdentifier` | |
| 读取包类型 | 🟡 | `driver-generated.ts:854` `app.getBundleType` | 实际 API 名为 getBundleType（非 packageType） |
| 读取默认图标 | 🟡 | `driver-generated.ts:857` `app.defaultWindowIcon` | 间接使用：`manual_tests.md:91` §二 Menu「Create menu with Image icon」（T1）用 defaultWindowIcon() 造菜单图标，判据是菜单图标显示，非 app API 本体 |
| 查询多窗口支持 | 🟡 | `driver-generated.ts:860` `app.supportsMultipleWindows` + `driver-generated.ts:667` `win.getAllWindows` | `manual_tests.md:317` §十四「Predefined Multi-Window」是预定义菜单多窗操作（14 例），非查询 API 本体 |
| 设置应用主题 | ✅ | `manual_tests.md:827` §36.9 T0「Set Theme — 深浅色切换」（步骤：连续点击 toggle，判据：Light/Dark/System 循环）；按钮 `TestRunner.svelte:1941` `manualSetTheme`（:3926 按钮） | cov 另有 `driver-generated.ts:863` app.setTheme、`:649` win.setTheme.dark+light、`window-ops-extra.ts:116-124` |
| 切换系统主题 | ✅ | 同上 `manual_tests.md:827`（System 腿=「跟随系统设置」，setColorMode NOT_SET） | cov：`driver-generated.ts:664` `win.onThemeChanged`、`:864` `app.setTheme(null)` |
| 隐藏显示应用 | 🟡 | `api-gap.ts:247` `app.hide+show`（invoke `plugin:app\|app_hide`/`app_show`，cov 盲调用） | std 的 hide/show 均为窗口级：`window-ops.ts:843-911`（#237 主窗 hide 契约拒绝）、`manual_tests.md:783` §36.5 Hide/Show——应用级 app_hide 无 std/文档层用例 |
| 设置Dock可见 | 🟡 | `api-gap.ts:252` `app.set_dock_visibility`（cov 盲调用） | TestRunner 无 dock 按钮、manual_tests.md 无 dock 用例（唯一「Dock」命中是 `manual_tests.md:782` 全屏隐藏 Dock 的副产物） |

## 二、运行事件（10 条：10 ✅ / 0 🟡）

Rust 侧跟踪：`lib.rs:1020-1084`（Ready/Resumed/MainEventsCleared/ExitRequested/Exit/Opened 全部 push 进 tracked list）。

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| Ready启动事件 | ✅ | `core.ts:1007` `RunEvent::Ready fires on startup`（auto，断言 tracked 含 'Ready'） | |
| 恢复事件 | ✅ | `core.ts:1029` `RunEvent::Resumed fires on startup`（auto） | |
| 转发恢复事件 | ✅ | `manual_tests.md:554` §27 T0「MainEvent::Start → Event::Resumed 转发」（hilog 判据：`NotifyAfterLifecycleResumed`+`[RunEvent] Resumed`；并披露按钮 JS 监听 `tauri://resumed` 设计性不触发）；按钮 `TestRunner.svelte:506` `manualEventResumed` | |
| 主循环清空事件 | ✅ | `core.ts:1016` `RunEvent::MainEventsCleared fires`（auto） | |
| 关闭请求事件 | ✅ | `core.ts:1037` `RunEvent::WindowEvent::CloseRequested fires`（auto，建窗→close→断言 tracked）；另 `manual_tests.md:819` §36.9 T0 CloseRequested 按钮 | |
| 窗口销毁事件 | ✅ | `core.ts:1062` `RunEvent::WindowEvent::Destroyed fires`（auto，含 CloseRequested→Destroyed 顺序断言） | |
| 打开事件 | ✅ | `manual_tests.md:233` §九 T1「✅ Opened 事件 — 深度链接触发」（步骤 `aa start -U myapp://test/path`，判据 `[RunEvent] Opened, urls=[…]`，含 2026-11-05 复验记录） | `core.ts:1094` `RunEvent::Opened (manual — requires deep link)` 为 manual 占位（fn 空），由文档行补实 |
| 关闭应用事件 | ✅ | `manual_tests.md:234` §九 T0「danger-mode exit — app.exit(0) 真实退出（#100）」（判据① `[RunEvent] ExitRequested, code=Some(0)` → `[RunEvent] Exit`）；另 `manual_tests.md:230` §九 T0 系统关闭路径判据含 `Exit` | |
| 防重复退出事件 | ✅ | `manual_tests.md:232` §九 T1「✅ ExitRequested 防重复触发」（统计 ExitRequested 恰一次）；std 自动层 `zombie-close.ts:91` `ut_main_window_close_prevented_keeps_accounting`（auto，ExitRequested veto 门 + Destroyed 零增量断言） | |
| 触发打开事件 | ✅ | 同 `manual_tests.md:233`（其步骤 1 即触发方式 `hdc shell aa start -U myapp://test/path`） | 另有 TestRunner deep-link 按钮 `TestRunner.svelte:3532`（plugin-deep-link onOpenUrl，触发指引在 ：3544） |

## 三、输入事件（7 条：7 ✅ / 0 🟡）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 派发鼠标事件 | ✅ | `core.ts:2125` `DOM MouseEvent.dispatch (synthetic)`（side-effect，4 断言 mousemove/mousedown/mouseup/click）；文档层 `manual_tests.md:751` §36.2 T1「Start Mouse Tracking — 鼠标事件实时流」；按钮 `TestRunner.svelte:3557` `toggleMouseTracking` | |
| 校验鼠标坐标 | ✅ | `core.ts:2153` `DOM MouseEvent.coordinates`（auto，断言 clientX=250/clientY=150/button=2）；文档层 `manual_tests.md:750` §36.2 T1「Get Cursor Position — 光标坐标读取」；std 另有 `core.ts:2221` `@tauri-apps/api/window.cursorPosition`（auto，容差双分支契约） | |
| 派发滚轮事件 | ✅ | `core.ts:2180` `DOM WheelEvent.dispatch (synthetic)`（side-effect，断言 deltaY=-3）；`manual_tests.md:751`（scroll 行） | |
| 模拟捏合缩放 | ✅ | `core.ts:2198` `DOM WheelEvent.ctrlKey (pinch zoom simulation)`（auto，断言 ctrlKey wheel + delta）；`manual_tests.md:751`（「双指缩放产生 pinch-zoom（列表紫色高亮）」）；TestRunner `:3584-3595` pinch-zoom 分类 | |
| 长按按键连发 | ✅ | `manual_tests.md:671` §三十三 T0「Hold Key — 长按按键触发连发 repeat ✅」（四判据：repeat=true 连发/无 U 行/松开单 U/jjjj 不翻倍，含 hilog 20Hz 佐证）；按钮区 `TestRunner.svelte:4241-4275` Key Repeat Detection | |
| 点按按键验证 | ✅ | `manual_tests.md:672` §三十三 T0「Tap Key — 快速点按不触发 repeat ✅」 | |
| 拦截快捷键事件 | ✅ | `manual_tests.md:673` §三十三 T1「Accelerator Interception — 被消费按键不泄入页面 ✅」 | |

## 四、新窗口拦截（5 条：5 ✅ / 0 🟡）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 拦截新窗口 | ✅ | `core.ts:1323` `on_new_window: Deny blocks window.open()`（auto，set_deny_new_window(true)→断言 handler 收到 URL） | mobile 形态 skipOnMobile（手机 ArkWeb null-URL 平台 gap） |
| 触发新窗口事件 | ✅ | `core.ts:1344` `on_new_window: window.open triggers event with correct URL`（auto，断言 `new-window-requested` 事件 payload 含 URL） | |
| 创建真实窗口 | ✅ | `manual_tests.md:270` §十一 T0「Create real OS window 验证」（判据：独立 OS 子窗口/加载目标 URL/hilog `response: Create`/无 destroy 噪音/可重复创建）；按钮 `TestRunner.svelte:4090`（:2726-2742 实现） | |
| 关闭允许弹窗 | ✅ | `manual_tests.md:268` §十一 T0「Allow dialog 关闭按钮验证」（判据：✕ 关闭/hilog `NewWindowDialog: Close button clicked`/内嵌 Web 直载目标 URL） | `core.ts:1377` `on_new_window: Allow dialog has close button (manual)` 为 manual 占位，由文档行补实 |
| 阻止弹窗打开 | ✅ | `manual_tests.md:269` §十一 T1「Deny 模式阻止弹窗验证」（判据：无对话框/页面不变/hilog DENY） | `core.ts:1392` 同上占位 |

## 五、图像资源（6 条：5 ✅ / 1 🟡）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 创建图像 | ✅ | `image.ts:17` `@tauri-apps/api/image.new`（auto，断言 rid&gt;0） | |
| 读取图像尺寸 | ✅ | `image.ts:27` `@tauri-apps/api/image.size`（断言 1×1） | |
| 读取RGBA数据 | ✅ | `image.ts:39` `@tauri-apps/api/image.rgba`（断言长度/通道值） | |
| 从字节加载图像 | ✅ | `image.ts:52` `@tauri-apps/api/image.fromBytes`（MINIMAL_PNG，断言尺寸） | |
| 从路径加载图像 | 🟡 | `api-gap.ts:133` `image.fromPath`（cov 盲调用，内部有断言但整批仅 VITE_COVERAGE_TESTS 注入） | std 五例全在 image.ts，独缺 fromPath |
| 关闭图像资源 | ✅ | `image.ts:63` `@tauri-apps/api/image.close`（断言 close 后调用必错） | |

## 六、路径解析（21 条：4 ✅ / 17 🟡 / 0 ❌）

| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 解析文件名 (basename) | 🟡 | `api-gap.ts:83` `path.basename`（cov） | |
| 解析目录名 (dirname) | 🟡 | `api-gap.ts:87` `path.dirname` | |
| 解析扩展名 (extname) | 🟡 | `api-gap.ts:91` `path.extname` | |
| 判定绝对路径 (isAbsolute) | 🟡 | `api-gap.ts:96` `path.isAbsolute` | |
| 归一化路径 (normalize) | 🟡 | `api-gap.ts:100` `path.normalize` | |
| 解析绝对路径 (resolve) | 🟡 | `api-gap.ts:104` `path.resolve` | |
| 读取应用缓存目录 | ✅ | `core.ts:578` `@tauri-apps/api/path.appCacheDir`（auto，断言非空/含分隔符/含 cache 段） | |
| 读取应用配置目录 (appConfigDir) | 🟡 | `driver-generated.ts:869` | |
| 读取应用数据目录 (appDataDir) | ✅ | `core.ts:2477` `PathResolver app_data_dir valid (OHOS)`（auto，经 desktop_features_test 读回并断言） | 另有 cov `driver-generated.ts:872` 直接调用 |
| 读取本地数据目录 (appLocalDataDir) | 🟡 | `driver-generated.ts:875` | |
| 读取应用日志目录 (appLogDir) | 🟡 | `driver-generated.ts:878` | |
| 读取音频目录 (audioDir) | 🟡 | `driver-generated.ts:881` | |
| 读取系统配置目录 (configDir) | 🟡 | `driver-generated.ts:887` | |
| 读取系统数据目录 (dataDir) | 🟡 | `driver-generated.ts:890` | |
| 读取文档目录 (documentDir) | 🟡 | `driver-generated.ts:893` | |
| 读取下载目录 (downloadDir) | 🟡 | `driver-generated.ts:896` | |
| 读取图片目录 (pictureDir) | 🟡 | `driver-generated.ts:899` | |
| 读取临时目录 (tempDir) | 🟡 | `driver-generated.ts:902` | |
| 读取资源目录 (resourceDir) | ✅ | `risk-supplement.ts:143` `path.resourceDir 指向 OHOS 解包 resfile 且内容可读（#226 修复回归）`（auto，断言 `/data/storage/el1/bundle/…/resources/resfile` 形态 + readDir 含 tauri.conf.json） | cov `driver-generated.ts:905` 盲调用 |
| 读取运行时目录 (runtimeDir) | 🟡 | `driver-generated.ts:908` | |
| 校验数据目录 | ✅ | `core.ts:2477-2486` 同一用例的校验腿（断言非空 + `!path_has_double_files` 即无 `files/files` 双拼） | 与「读取应用数据目录」共用 std 用例 |

## 统计（61 条）

| 判定 | 数量 |
|---|---|
| ✅ 有对应用例 | 35 |
| 🟡 仅覆盖率层 | 26 |
| ⚠️ 有名无实 | 0 |
| ❌ 零用例 | 0 |

分布：应用信息与主题 4✅/8🟡；运行事件 10✅；输入事件 7✅；新窗口拦截 5✅；图像资源 5✅/1🟡；路径解析 4✅/17🟡。

与任务书预期的两点偏差（以实际文件为准）：
1. 任务书描述 core.ts 含 app 段 getName/getIdentifier/getTauriVersion 与 path 段全目录 API——实际 core.ts 的 app 段仅 getVersion、path 段仅 appCacheDir；其余全在 cov 层（driver-generated/api-gap），故这批按固定口径落 🟡 而非 ✅。
2. SOW「读取包类型」对应实际 API 为 `getBundleType`（driver-generated.ts:854），不存在 getPackageType/packageType 命名。

## 🟡 逐条搜索关键词披露

- **app 信息 6 条**（getName/getTauriVersion/getIdentifier/getBundleType/defaultWindowIcon/supportsMultipleWindows）：`getName|getIdentifier|getTauriVersion|getPackageType|packageType|defaultIcon|metadata|multiwindow|getAll|setTheme|listThemes|systemTheme|onThemeChanged`（tests 目录全文）、`theme|Theme|dock|packageType|bundleType|defaultWindowIcon|supportsMultipleWindows|getAllWindows|多窗口`（manual_tests.md 全文）、`get_ohos_version_info|request_restart|app_hide|app_show|set_dock_visibility|system_theme`（src-tauri/src）。命中面仅 driver-generated.ts:842-865 + manual_tests.md:91（defaultWindowIcon 间接使用）。
- **多窗口支持**：另搜 `getAllWindows|getByLabel`（driver 两处）+ §十四（多窗操作非查询）。
- **隐藏显示应用**：`app_hide|app_show|hide\(\)|show\(\)`（tests 目录）、`app_hide|app_show|dock`（TestRunner.svelte，零命中；window-ops 命中均为窗口级）。
- **设置Dock可见**：`dock|Dock|set_dock`（tests/TestRunner/manual_tests.md/Rust 四处），仅 api-gap.ts:252。
- **图像 fromPath**：`fromPath`（tests 目录），仅 api-gap.ts:133。
- **路径 6 纯函数 + 11 目录 API**：`basename|dirname|extname|isAbsolute|normalize\(|resolve\(|appConfigDir|appDataDir|appLocalDataDir|appLogDir|audioDir|configDir|dataDir|localDataDir|documentDir|downloadDir|pictureDir|tempDir|runtimeDir|videoDir|homeDir|resourceDir`（tests 目录全文），std 命中仅 core.ts appCacheDir/app_data_dir 与 risk-supplement resourceDir，其余全落 driver-generated.ts:866-910 与 api-gap.ts:83-107。

===== BLOCK 4 len=15033 =====
审计完成。所有判定基于四层证据（std 自动层 / cov 覆盖率层 / manual_tests.md 文档行 / TestRunner 按钮），分层依据已核实：`D:\xuqiu\tauri-3.0\tauri\examples\api\src\views\TestRunner.svelte:116-117` —— `coverageTests = [driverTests, sideReplayTests, badInputTests, faultInjectionTests, windowOpsExtraTests, apiGapTests]` 仅 `VITE_COVERAGE_TESTS` 装配；其余（core/window-ops/dpi/window-dpi/ohos-adapter/zombie-close/ohos-screenshot/risk-supplement 等）恒入 `allTests`。

路径缩写：core=tests\core.ts、wops=tests\window-ops.ts、dpi=tests\dpi.ts、wdpi=tests\window-dpi.ts、zomb=tests\zombie-close.ts、adp=tests\ohos-adapter.ts、wox=tests\window-ops-extra.ts(cov)、drv=tests\driver-generated.ts(cov)、MTD=doc\manual_tests.md、TR=views\TestRunner.svelte、cmd=src-tauri\src\cmd.rs（前缀 `D:\xuqiu\tauri-3.0\tauri\examples\api\`，MTD 为 `D:\xuqiu\tauri-3.0\tauri\doc\manual_tests.md`）。

## 1. 逐条判定（11 能力行，88 条）

### 创建窗口（7）
| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 创建多窗口 | ✅ | core:1137 `create_borderless_window command`（getByLabel+isDecorated 断言）；wops:159 `window.createUIAbilityWindow (webview registered + new instance IPC)`（webview_acquired===true 断言）；MTD §36.6:792 Create UIAbility Instance T0 | cov 另有 drv:313 `create_ui_ability_windows_x3` |
| 创建隔离存储窗口 | ✅ | core:915/956/987（用例 `on_page_load events`/`on_navigation interceptor`/`on_document_title_changed` 内 `create_isolated_window`，dataSuffix 入参）+ cmd:534-535 `data_dir=webview_data_&lt;suffix&gt;_&lt;seq&gt;` 隔离存储目录 | 无「隔离读回」专条；建窗+隔离参数真实走通并带事件断言 |
| 创建无边框窗口 | ✅ | core:1137（断言 decorations=false）+ MTD §36.3:758 Create Borderless T1 | 同用例兼作多窗口载体 |
| 创建透明窗口 | ✅ | core:2604 `transparent UIAbility window (create + self-driven ops + hilog verifiable)`（webview_acquired 断言）+ MTD §36.6:793 Create Transparent UIAbility T1 | cov 另有 drv:292/310 |
| 创建透明无边框窗口 | ✅ | core:1157 `create_transparent_borderless_window command`（exists+decorated=false 断言）+ MTD §十:251 T0 | |
| 创建有边框透明窗 | ✅ | MTD §十:252 T1「创建透明有边框 Float 子窗口」（有步骤+预期①-④） | std 无专条（1157 为无边框变体）；cov drv:292 |
| 创建自定义UA窗口 | ✅ | MTD §八:212/213/214 三行（custom T0 / default T1 / 多窗口隔离 T1，2026-11-05 实测 PASS）+ TR userAgent 按钮 | cov drv:301 `cmd.create_window_with_custom_ua`；std 无 auto 专条 |

### 窗口几何（11）
| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 读取窗口内尺寸 | ✅ | wdpi:10 `@tauri-apps/api/window.innerSize` + MTD §36.1:741 Window DPI T0 | cov drv:493 |
| 读取窗口外尺寸 | ✅ | wdpi:22 outerSize | cov drv:496 |
| 读取窗口内位置 | ✅ | wdpi:33 innerPosition | cov drv:499 |
| 读取窗口外位置 | ✅ | wdpi:45 outerPosition + wops:557 `window.setOuterPosition smoke`（读回 orig） | cov drv:502 |
| 设置窗口尺寸 | ✅ | core:1269 `window.set_size resizes window`（innerSize&gt;0 断言）+ wops:361 `window.setInnerSize actually resizes`（精确读回） | |
| 设置窗口位置 | ✅ | core:1247 `window.set_position moves window`（outerPosition≈100±50 断言）+ MTD §36.5:778 setOuterPosition T0 | |
| 设置最小尺寸 | ✅ | wops:467 用例内 setMinSize(null)/setMinSize(600,400) 往返 + min-floor 钳制断言；MTD §36.9:824 Set Min Size T1 | cov drv:643 |
| 设置最大尺寸 | ✅ | MTD §36.9:825 Set Min+Max T1（判据：setMaxSize 后 min 保留、max=2400×1800、拖拽上下限） | std 无 setMaxSize 专条；cov drv:646 + bad.set_size_constraints.inverted(drv:1070) |
| 设置尺寸约束 | ✅ | wops:467 `window.setSizeConstraints runtime min-floor clamps (and null clears)`（钳制+null 清除精确读回，PC/2in1 门控） | cov drv:628 |
| 窗口居中 | 🟡 | 仅 drv:788（float.hide+show+center 用例内 center()） | 四层检索见 §3 |
| 缩放窗口内容 | 🟡 | 仅 cov：drv:818 `webview.setZoom` + drv:1079/1037 bad 两例 | TR zoom 按钮(4053/4054/4097)=zoomHotkeys flag（MTD §27:557/558），非 setZoom API |

### 窗口状态控制（9）
| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 最大化窗口 | ✅ | core:1199 `window.maximize then is_maximized reflects state`（断言 true）+ wops:573 `window.maximize fills monitor`（outerSize≥90% 显示器断言） | cov float.maximize+unmaximize(drv:676) |
| 还原窗口 | ✅ | core:1211 `window.unmaximize (recover)`（断言 false） | |
| 最小化窗口 | ✅ | wops:621 `window.minimize smoke`（minimize+unminimize 不抛）+ MTD §21:440 T0（任务栏恢复判据）/§36.5:781 T1 | core:1287 同语义用例 category:'manual'（真断言但 runner 不过滤执行，不计 ✅ 依据）；cov float.minimize+unminimize(drv:679) |
| 切换最大化 | ✅ | MTD §36.5:780 Toggle Maximize T0（isMaximized 翻转判据）+ TR:1461 manualMaximize（isMaximized 驱动 maximize/unmaximize 切换） | toggleMaximize API 本体仅 cov drv:682 盲调用 |
| 全屏切换 | ✅ | wops:609 `window.setFullscreen smoke`（true→false 不抛）+ MTD §36.5:782 Toggle Fullscreen T0（isFullscreen 翻转判据） | wops:129 diag 用例无硬断言（仅日志），不计入依据；cov drv:634 |
| 简单全屏 | ✅ | wops:614-616 setFullscreen(true) 单程 smoke + MTD §36.5:782 | 映射假设：简单全屏=setFullscreen(true) 基本全屏（与 toggle 区分），与上一条共用 API 族证据 |
| 置顶切换 | ✅ | wops:633 `window.setAlwaysOnTop smoke`（&lt;API14 必拒断言 650-653）+ MTD §36.5:784 Toggle AlwaysOnTop T1 | cov drv:568 |
| 隐藏显示窗口 | ✅ | wops:848 `ut_window.hide rejects on OHOS (main window, #237)`（契约拒绝断言）+ wops:877 `ut_window.show keeps maximized state`（双臂断言 897-912）+ MTD §36.5:783 Hide/Show T0 | 主窗 hide 在 OHOS=契约拒绝（拒绝即正确） |
| 窗口聚焦置顶 | ✅ | wops:971 setFocus smoke（E 组）+ MTD §十八:402 T0（setFocus→raiseToAppTop 层级判据，2026-08-31 PASS） | cov drv:631 |

### 窗口属性（15）
| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 设置窗口标题 | ✅ | core:2736 `window.set_title tracked ack`（real window resolve + bogus reject 双断言）+ MTD §36.9:823 Set Title T0 | cov drv:562 |
| 读取窗口标题 | 🟡 | 仅 cov drv:541 `win.title` 盲调用 | core:2736 只验 ack 无读回；§36.9:823 判据为标题栏视觉非 title() |
| 设置窗口装饰 | ✅ | core:1115 `window.setDecorations toggles decorations state`（isDecorated 翻转断言）+ MTD §36.3:757 T0 | |
| 切换窗口装饰 | ✅ | 同 core:1115（off/on 双腿）+ wops:786 D11 Float setDecorations 读回断言（799-803） | 同一用例覆盖两条 |
| 设置可调整 | ✅ | wops:771-774 smoke + wops:813/821 Float isResizable 读回断言 + MTD §36.7:804 T1 | cov drv:574 |
| 设置可最大化 | ✅ | wops:745-746 smoke + 809/817 Float 读回 + 921 #238 主窗必拒断言 + MTD §36.7:802 T1 | cov drv:577 |
| 设置可最小化 | ✅ | wops:747-748 + 811-812/819-820 + 939-940 + MTD §36.7:803 T1 | cov drv:580 |
| 设置可关闭 | ✅ | wops:743-744 + 807-808/815-816 + 941 + MTD §36.7:801 Toggle Closable T0（唯一被 SubWindowPage 消费的 flag，✕ 显隐判据） | cov drv:583 |
| 设置可见性 | ✅ | 与「隐藏显示窗口」同 API 族：wops:848/877 + MTD §36.5:783 | Tauri 无独立 setVisible，SOW 两条共用一组用例 |
| 设置跳过任务栏 | 🟡 | 仅 cov drv:571 `win.setSkipTaskbar` | 四层检索见 §3 |
| 设置内容保护 | ✅ | wops:980 `window.setContentProtection (demo cmd)`（往返）+ MTD §21:443 privacy-mode T1（截屏变黑判据，2026-09-20 PASS）+ TR Content Protection 按钮(3880) | cov drv:607 setContentProtected |
| 设置窗口背景色 | ✅ | wops:836 Float setBackgroundColor smoke + MTD §36.4:767-770 四行 T0/T1（Red/Blue/Green/Reset） | cov drv:610 |
| 设置窗口阴影 | 🟡 | 仅 cov drv:586 `win.setShadow` | 四层检索见 §3 |
| 请求用户注意 | ✅ | MTD §36.9:828 Request User Attention T0（系统通知弹出判据）+ TR:3927 按钮 | cov drv:626 + wox:132；std 无 auto |
| 设置窗口图标 | 🟡 | 仅 cov wox:136/136-143/220（error path acceptable / dispatcher+arm 盲调用） | MTD §36.9:823 备注「图标不可改（窗口层无运行时 API，module.json5 静态配置）」 |

### 窗口状态查询（10）
| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 查询最大化 | ✅ | core:1178 `window.is_maximized returns boolean`（boolean 断言）+ wops:897 等读回断言 | cov drv:514 |
| 查询最小化 | ✅ | core:1188 + wops:830 Float isMinimized round-trip 断言 | cov drv:517 |
| 查询全屏状态 | ✅ | MTD §36.5:782 判据② isFullscreen 读数翻转 | std wops:136-149 isFullscreen 仅 diag 读数无断言；cov drv:505 |
| 查询焦点状态 | ✅ | core:540 `@tauri-apps/api/window.isFocused`（boolean 断言）+ MTD §36.1:743 T0 | cov drv:508 |
| 查询可见性 | ✅ | zomb:126/291/354 isVisible 断言（std，僵尸关闭用例内）+ MTD §36.5:783 判据② isVisible 仍 true | 无独立 std 专条；cov drv:532 |
| 查询置顶状态 | ✅ | MTD §36.5:784 判据① isAlwaysOnTop 读数翻转 | std wops:660 明确不做该读回；cov drv:535 |
| 查询可调整 | ✅ | wops:814/822 Float isResizable 读回断言 + MTD §36.7:804 判据① | cov drv:520 |
| 查询装饰状态 | ✅ | core:1105 `window.isDecorated returns boolean` + wops:799-803 | cov drv:511 |
| 读取缩放因子 | ✅ | wdpi:55 `@tauri-apps/api/window.scaleFactor` + MTD §36.1:741 判据①五项含 scaleFactor | cov drv:544 |
| 获取所有窗口 | 🟡 | 仅 cov drv:667 `win.getAllWindows` 盲调用 | 四层检索见 §3 |

### 窗口效果（5）
| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 设置窗口效果 | ✅ | core:2531 `window.setEffects (Blur/Acrylic) — no throw`（auto，desktop 门控）+ MTD §19:409 自动用例注记 | cov drv:637 + side.side.win.setEffects.acrylic/mica(971-977) |
| 设置模糊半径 | ✅ | core:2539 `setEffects({effects:[Blur], radius:25})`（同上用例内）+ MTD §19:416 Blur radius=25 T0 | 同一用例覆盖两条 |
| 设置亚克力效果 | ✅ | core:2540 Acrylic + MTD §19:417 Acrylic T1 | 同一用例覆盖两条 |
| 清除窗口效果 | ✅ | core:2541 clearEffects（同 auto 用例内）+ MTD §19:418 clearEffects T0（双清除判据） | cov drv:640 + wox:189 |
| 构建期窗口效果 | ✅ | core:2586 `vibrancy build-time effects (WindowBuilder::effects) — no throw` + MTD §19:419 build-time T0 | |

### 窗口事件（5）
| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 监听窗口调整 | ✅ | MTD §36.9:821 Watch Window Events T1（监听 Resized/Moved/FocusChanged，步骤+判据） | std 无 onResized 专条（core:712 on_window_event 仅数组断言）；cov drv:652 |
| 监听窗口移动 | ✅ | MTD §36.9:821 同一行（Types 含 Moved） | cov drv:655 |
| 监听焦点变化 | ✅ | core:625 `@tauri-apps/api/window.onFocusChanged`（unlisten 断言）+ MTD §36.1:744 T1 | cov drv:658 |
| 监听缩放变化 | 🟡 | 仅 cov drv:661 `win.onScaleChanged` | 四层检索见 §3 |
| 监听主题变化 | 🟡 | 仅 cov drv:664 `win.onThemeChanged` | §36.9:827 Set Theme 按钮只切主题不验事件 |

### 子窗口（Float）（8）
| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 调整子窗口几何 | ✅ | wops:530 `float window setInnerSize exact readback (decor=0)`（精确读回断言）+ core:1858 `webview child setSize/setPosition change rendered geometry` + MTD §36.5:778/779 T0 | cov float.setSize+setPosition(drv:673) |
| 最大化子窗口 | ✅ | MTD §36.3:759 Create Decorated T0 步骤③「□ 最大化再 ❐ 还原…还原位置不漂移」 | 路径=自绘标题栏 □/❐（非 maximize API）；cov float.maximize+unmaximize(drv:676) |
| 最小化子窗口 | ✅ | wops:786 D11 ③ minimize→show round-trip 断言（828-833）+ MTD §36.5:781 互补 | cov float.minimize+unminimize(drv:679) |
| 切换子窗口最大化 | 🟡 | toggleMaximize API 仅 cov drv:682 `float.toggleMaximize` 盲调用 | §36.3:759 为标题栏路径（视觉判据）非该 API；四层检索见 §3 |
| 切换启用状态 | 🟡 | 仅 cov drv:685 `float.setEnabled.toggle` + drv:538 win.isEnabled | 四层检索见 §3 |
| 销毁子窗口 | ✅ | zomb:174 `ut_subwindow_destroy_success_confirmed_removal` + 203 `ut_window_destroy_message_confirmed_removal` + 233 idempotent ack（确认式移除断言） | cov float.destroy(drv:688) |
| 隐藏显示居中子窗口 | 🟡 | 仅 cov drv:702-796 `driver: float.hide+show+center smoke`（cov 批内但有真断言：hide 必 resolve + isVisible 镜像 2s 轮询 + show + center） | std wops:786 D11 仅 show-from-minimized 腿；主窗 hide 契约拒绝（#237/#241 kind-split）；四层检索见 §3 |
| 子窗口置顶聚焦 | ✅ | MTD §十八:402 T0（子窗口 setFocus→raiseToAppTop 层级+hilog 判据，2026-08-31 PASS） | std wops:971 setFocus smoke 为主窗；cov float.setFocus+alwaysOnTop(drv:803) + wox:179 |

### 显示器与 DPI（10）
| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 获取当前显示器 | ✅ | core:552 `@tauri-apps/api/window.currentMonitor`（non-null+size/position 断言，desktop 门控）+ adp:33 `ohos-adapter.monitor.real-size` + MTD §36.1:742 T1 | cov drv:547 |
| 获取可用显示器 | 🟡 | 仅 cov drv:550 `win.availableMonitors` + wox:65/73（cov 批，assert Array.isArray） | 四层检索见 §3 |
| 获取主显示器 | 🟡 | 仅 cov drv:553 `win.primaryMonitor` + wox:64 | 四层检索见 §3 |
| 按点查显示器 | ✅ | MTD §27:551 monitor_from_point 边界判定 T1（五行 ALL PASS 判据，2026-08-31 PASS）+ TR monitorFromPoint 按钮(2342/2360/4043) | cov drv:556 |
| 读取显示器尺寸 | ✅ | core:558-559 monitor.size&gt;0 断言 + adp:39-51 size&gt;0+连续调用稳定断言 | |
| 查询屏幕刷新率 | ✅ | adp:61 `ohos-adapter.monitor.refresh-rate`（auto，refresh_rate&gt;0 正则断言）+ MTD §27:552 T1 + TR:4044 Display Refresh Rate 按钮（probe+rAF 交叉验证） | |
| 判定显示器边界 | ✅ | MTD §27:551 同一行（屏内 Some/屏外 None 半开区间判定） | 与「按点查显示器」同一用例覆盖两条；cov bad.monitorFromPoint.far(drv:1082) |
| 构造物理尺寸 | ✅ | dpi:9 `@tauri-apps/api/dpi.PhysicalSize.constructor` | |
| 构造逻辑尺寸 | ✅ | dpi:32 `@tauri-apps/api/dpi.LogicalSize.constructor` | |
| 物理逻辑互转 | ✅ | dpi:20 PhysicalSize.toLogical + 43 LogicalSize.toPhysical + 55/65 Position 互转（四例） | |

### 光标（7）
| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 读取光标位置 | ✅ | core:2221 `@tauri-apps/api/window.cursorPosition` + MTD §36.2:750 T1 + MTD §三十八（契约+fail-safe 纪律章） | adp:214 cursor-position-freshness 为 manual 类别存档协议；cov drv:598 |
| 设置光标图标 | ✅ | wops:968-969 setCursorIcon 9 种循环 smoke（desktop 门控）+ MTD §36.8:812 Cycle CursorIcon T1 | cov drv:592 |
| 设置光标可见 | ✅ | wops:966-967 smoke + MTD §36.8:811 T0（全局隐藏+3s 恢复判据） | cov drv:589 |
| 设置光标抓取 | ✅ | wops:667/702-709 version-gate 负断言（&lt;API22 必拒+错误文案断言）+ MTD §36.9:820 setCursorGrab T0（锁定/失焦解锁判据） | cov drv:595 |
| 设置忽略光标事件 | ✅ | wops:719 `window.setIgnoreCursorEvents smoke` + core:2496 `set_ignore_cursor_events is no-op`（平台契约）+ MTD §28 按钮路径 | cov drv:601 |
| 穿透鼠标点击 | ✅ | MTD §28:583 T0（overlay 触摸穿透+`SetTouchable: id:N,0` hilog 判据，2026-08-31 PASS） | TR 专用按钮 Overlay Ignore Cursor |
| 穿透悬停事件 | ✅ | MTD §28:584 T1（hover 穿透+API 15 分支判据） | |

### 窗口拖拽（1）
| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 窗口拖拽与边缘拉伸 | 🟡 | startDragging/startResizeDragging 仅 cov wox:147 `float window dragging (startDragging/startResizeDragging)`（startResizeDragging&lt;API20 版本门负断言 170-173） | MTD §21:442 T0（鼠标拖边缘缩放 UX）与 §36.1:741（拖动窗口）覆盖手动拖拽体验但不驱动这两个 API；四层检索见 §3 |

## 2. 统计（总 88 条）

- ✅ 有对应用例：**72**
- 🟡 仅覆盖率层（cov 批）：**16**
- ⚠️ 有名无实：**0**
- ❌ 零用例：**0**

分布：创建窗口 7✅/0🟡；窗口几何 9✅/2🟡；状态控制 9✅/0；属性 11✅/4🟡；查询 9✅/1🟡；效果 5✅/0；事件 3✅/2🟡；子窗口 5✅/3🟡；显示器 7✅/3🟡；光标 7✅/0；拖拽 0✅/1🟡。

## 3. 🟡 各条四层检索记录（std 文件=core/wops/dpi/wdpi/zomb/adp/ohos-screenshot/risk-supplement；关键词均在 tests 目录、doc\manual_tests.md、TestRunner.svelte 三处各搜过）

1. **窗口居中**：tests `\.center\(|center\(` → 仅 drv:788；MTD `居中|center\(` → 0 命中；TR grep -i `center` → 无按钮（仅 monitorFromPoint 误配）。
2. **缩放窗口内容**：tests `setZoom` → 仅 drv:818/1079/1037；MTD `setZoom` → 0（zoom 行 557/558 均为 zoom_hotkeys flag）；TR grep -i `zoom` → 仅 Zoom OFF/ON(4053/4054)、Hotkey Zoom(4097)，无 setZoom。
3. **读取窗口标题**：tests `\.title\(` → 仅 drv:542；core:2736 set_title ack 无读回；MTD §36.9:823 判据=标题栏视觉。
4. **设置跳过任务栏**：tests `setSkipTaskbar` → 仅 drv:571；MTD `skipTaskbar` → 0（`任务栏` 命中行均为托盘/标题栏语义）；TR grep -i `skip.?taskbar` → 0。
5. **设置窗口阴影**：tests `setShadow` → 仅 drv:586；MTD `阴影|setShadow` → 0；TR grep -i `shadow` → 0。
6. **设置窗口图标**：tests `setIcon` → 仅 wox:136/220（window 域，menu/tray 域同名除外）；MTD `窗口图标|setIcon` → 行 91 为 menu icon；TR grep -i `setIcon|window icon` → 0。
7. **获取所有窗口**：tests `getAllWindows` → 仅 drv:142(import)/667；MTD `getAllWindows` → 0（`所有窗口` 行 329-337 为 tray showAll/bringAllToFront）；TR grep -i `all windows` → 0。
8. **监听缩放变化**：tests `onScaleChange` → 仅 drv:661；MTD `ScaleChange|缩放变化` → 0；TR → 0。
9. **监听主题变化**：tests `onThemeChanged` → 仅 drv:664；MTD `ThemeChanged|主题变化` → 0；TR → 0（Set Theme 按钮 3926 仅 setColorMode）。
10. **切换子窗口最大化**：tests `toggleMaximize` → 仅 drv:682；MTD → 0（§36.3:759 为标题栏 □/❐ 路径）；TR → 0（manualMaximize:1461 用 maximize/unmaximize）。
11. **切换启用状态**：tests `setEnabled` → 仅 drv:685 + drv:538（其余命中均为 menu.ts/tray.ts）；MTD `isEnabled|setEnabled` → 行 145/147 为 Autostart；TR grep -i → 0。
12. **隐藏显示居中子窗口**：tests `center\(` → 仅 drv:788（该用例 702-796 为 cov 批内带断言用例）；MTD `居中` → 0；TR → 0；std wops:786 D11 仅 minimize→show 腿。
13. **获取可用显示器**：tests `availableMonitors` → 仅 drv:550 + wox:65/73（均 cov）；MTD → 0；TR → 0。
14. **获取主显示器**：tests `primaryMonitor` → 仅 drv:553 + wox:64（cov）；MTD → 0；TR → 0。
15. **窗口拖拽与边缘拉伸**：tests `startDragging|startResizeDragging` → 仅 wox:147（cov）；MTD `startDragging|窗口拖拽|边缘拉伸` → 0；TR grep -i `drag window` → 行 552 帮助文案（Window DPI 说明）。

补充定性备注（供验收文档措辞参考）：多处 std 用例带 `skipOnMobile`（cfg(desktop) 命令在 mobile 构建缺席，如 core:1108/1118/1140/1160、wops:132/476/576/612/624/636/789/893/936/964），真机 mobile 轮次这些条目按 ⏭ 计，desktop/2in1 轮次实跑；「设置最小尺寸/尺寸约束」的 std 钳制断言另有 freeform 可缩放窗前置（wops:475-476）。

===== BLOCK 5 len=43 =====
现在我来检查一下 `std` 测试文件和 `runner` 组件中剩余的特定 API。

===== BLOCK 6 len=8717 =====
# SOW §二 wry（Webview 与通信）用例对照审计

文件索引（下表用短名）：
- **core** = D:\xuqiu\tauri-3.0\tauri\examples\api\src\lib\tests\core.ts（std 实跑）
- **wops** = D:\xuqiu\tauri-3.0\tauri\examples\api\src\lib\tests\window-ops.ts（std 实跑）
- **adapter** = D:\xuqiu\tauri-3.0\tauri\examples\api\src\lib\tests\ohos-adapter.ts（std，含 manual 占位标记）
- **driver / gap / fault** = 同目录 driver-generated.ts / api-gap.ts / fault-injection-generated.ts（cov 层）
- **MTD** = D:\xuqiu\tauri-3.0\tauri\doc\manual_tests.md；**TR** = D:\xuqiu\tauri-3.0\tauri\examples\api\src\views\TestRunner.svelte

## 1. 逐条判定表

**一、页面加载与导航（5）**
| SOW 用例 | 判定 | 证据 | 备注 |
|---|---|---|---|
| 导航拦截 | ✅ | core:945 `on_navigation interceptor` | auto，断言拦截回调 |
| 页面加载事件 | ✅ | core:899 `on_page_load events` | on_page_begin/end |
| 标题变更事件 | ✅ | core:976 `on_document_title_changed` | |
| 重载页面 | 🟡 | fault:82 `webview.reload.error`（对 `plugin:webview\|webview_reload` 注错盲调） | std/manual/按钮全无；core:2645 注释明言该用例「no reload」 |
| 读取当前页面URL | ✅ | core:2649 `webview.url() main-thread sync read after SPA navigation (#192)` | SPA 导航后读回活 URL，±断言 |

**二、JavaScript 执行（5）**
| 执行eval | ✅ | core:751 `app_handle.get_webview_window (test_eval)` | eval 改 title 后断言含 'Eval Success' |
| 回调式eval | ✅ | core:773 `webview.eval_with_callback` | 断言 arithmetic=3/stringLen=5/bool=true |
| 网页快照 | ✅ | core:799 `webview.webPageSnapshot`（width/height/png_base64 三断言）；旁证 ohos-screenshot.ts:58 `captureWebview` | |
| 注入初始化脚本 | ✅ | core:682 `append_invoke_initialization_script` | 断言 init script 已跑+internals 被改 |
| 读写本地存储 | ✅ | core:697 `localStorage set/get/remove`；cov driver:244 `cmd.test_local_storage` | set/get/remove 全断言 |

**三、IPC 通信（9）**
| 调用invoke命令 | ✅ | core:393 `@tauri-apps/api/core.invoke` | |
| 测试通道消息 | ✅ | core:402 `@tauri-apps/api/core.Channel` | |
| 测试资源封装 | ✅ | core:590 `@tauri-apps/api/core.Resource` | TestCounter rid 全生命周期，increment=1/2+getValue=2 断言 |
| 收发事件 | ✅ | core:499 `@tauri-apps/api/event.emit+listen` | |
| 单次事件监听 | ✅ | core:515 `@tauri-apps/api/event.once` | |
| 后端发送事件 | ✅ | core:830 `app_handle.emit` | |
| 后端监听事件 | ✅ | core:856 `app_handle.listen` | |
| 异步任务派生 | ✅ | core:879 `tauri::async_runtime::spawn` | 断言收 'async done' |
| 定向发送事件 | 🟡 | gap:148 `event.emitTo`（盲 emit，无接收断言） | std/manual/TR 全无 emitTo |

**四、自定义协议（6）**
| 注册同步协议 | ✅ | core:662 `register_uri_scheme_protocol (sync)` | |
| 注册异步协议 | ✅ | core:671 `register_asynchronous_uri_scheme_protocol (async)` | |
| 加载HTTPS页面 | ✅ | MTD:527 `ohos/https-scheme/page-load` **T0**（onInterceptRequest→custom_protocol→渲染，08-31 复验 PASS）；std 另有 core:2809 `https-intercept response headers reach the page (#186 M1)` auto 断言 | |
| 验证安全上下文 | ✅ | MTD:528 `secure-context` **T0**（isSecureContext=true + crypto.subtle OK） | adapter:157 同名标记仅 console.log（占位），文档层补齐 |
| 放行外部HTTPS | ✅ | MTD:529 `external-https` **T1**（example.com opaque，不误拦） | |
| 拦截子资源请求 | ✅ | MTD:530 `subresource` **T1**（子资源 fetch 被 onInterceptRequest 拦截 status=200） | |

**五、子 Webview（12）**
| 创建子Webview | ✅ | core:1719 `webview.create_webview (multi-webview via add_child)` + core:1774 explicit bounds 渲染 | |
| 创建Webview窗口 | ✅ | core:2649（create_isolated_window→`WebviewWindow.getByLabel` 断言存在+URL 读回）；wops:159 `window.createUIAbilityWindow` | 专用 `create_webview_window` wire 仅 cov（gap:177） |
| 读取Webview位置 | ✅ | core:2427 `webview.set_bounds round-trip`（readback x,y ±2 断言）+ core:1858 position read-back | cfg(desktop)，mobile skip |
| 读取Webview尺寸 | ✅ | core:2427（readback width/height ±2）+ core:1774 | 同上 |
| 设置Webview位置 | ✅ | core:1858 `setSize/setPosition change rendered geometry` + core:1919 + core:2427 | |
| 设置Webview尺寸 | ✅ | core:1774/1858/2427 | |
| 设置Webview缩放 | 🟡 | driver:818 `webview.setZoom` + fault:67 + bad:1037/1079（全 cov） | std/manual/TR 无 setZoom |
| 设置Webview背景 | ✅(smoke) | wops:836（Float 子窗 `setBackgroundColor([255,0,0,255])` smoke，在 auto 用例 `window Float kind-branch ops (D11)` 内）；cov driver:824 + fault:76 | smoke 无读回断言，判据弱 |
| 设置Webview焦点 | 🟡 | driver:830 `webview.setFocus`（盲调）；fault:128 是 window 级 | std 无 webview 级焦点用例 |
| 隐藏显示Webview | 🟡 | driver:833 `webview.hide+show`（盲调）+ fault:73 `webview.set-visible.error` | std 848/877 均为 window 级 hide/show |
| 设置自动调整 | ✅ | core:1996 `webview setAutoResize disable→enable re-arms tracking (issue #244)` | |
| 清除浏览数据 | ✅ | core:1484 `clearAllBrowsingData routes to the labeled target` + core:1539 `clears document.cookie` | 三腿定位断言 |

**六、Cookie（5）**
| 设置Cookie | ✅ | core:2299 `webview.set_cookie round-trip (OHOS)` | |
| 读取Cookie列表 | ✅ | core:2324 `webview.cookies() returns array (OHOS best-effort)` | |
| 按URL读Cookie | ✅ | core:2372 `webview.cookies_for_url readable` + core:2400（#110 主线程同步桥） | |
| 删除Cookie | ✅ | core:2348 `webview.delete_cookie no-op (OHOS platform limit)`（side-effect，真调用+断言 ok 前缀；语义=平台 no-op 已披露） | |
| 验证Cookie生效 | ✅ | MTD:176 `Cookie Live (httpbin echo)` **T0**（服务端回显收到 set_cookie 写入）+ core:2689 incognito 隔离四断言 + core:1539 | TR:3966 按钮在 |

**七、下载（5）**
| 下载请求事件 | ✅ | core:1561 `on_download: Requested event fires` | blob 下载触发+轮询断言 |
| 下载完成事件 | ✅ | core:1651 `on_download: Finished event fires on successful download` | |
| 重定向下载目录 | ✅ | core:1582 `custom directory redirects path`（断言 mode=CustomDir + destination 含 /downloads/） | |
| 拦截危险下载 | ✅ | core:1605 `block dangerous file types` | |
| 记录下载审计 | ✅ | core:1627 `audit log contains metadata` | |

**八、打印与 PDF（4）**
| 生成PDF | ✅ | core:1410 `webview.createPdf (default A4)`（success+路径断言，含 API&lt;14 版本门负臂）+ MTD:161 T0 | TR:2048 按钮 |
| 生成自定义PDF | ✅ | MTD:162 `Create PDF Square (8.27×8.27)` **T1**（2026-11-05 复验 PASS，#233 自定义尺寸链已修） | TR:2082 manualCreatePdfSquare 传 config |
| 打印网页 | ✅ | MTD:553 `WebView 打印 — 系统打印对话框` **T0**（对话框+job submitted+临时 PDF 清理+未加载 Err 四判据） | TR:4042 按钮 |
| 验证Web打印 | ✅ | 同 MTD:553（succeed/cancel 双终态 08-31/2026-08-28 实证） | adapter:103 标记为 console.log 占位，文档层补齐 |

**九、User-Agent（3）**（MTD §八 212-214）
| 设置自定义UA | ✅ | MTD:212 `userAgent/custom` **T0**（页面渲染 `Custom UA detected`，2026-11-05 PASS） | cov driver:301 `cmd.create_window_with_custom_ua` |
| 验证默认UA | ✅ | MTD:213 `userAgent/default` **T1** | TR:2595 |
| 隔离多窗UA | ✅ | MTD:214 `userAgent/多窗口隔离` **T1**（双窗各自渲染，2026-11-05 PASS+hilog 时序勘误披露） | TR:4080+ |

**十、DevTools（2）**（MTD §7.3）
| 打开开发者工具 | ✅ | MTD:188 `DevTools (open/is_open/close) toggle` **T1**（判据 after_open=true，2026-11-05 debug 构建真机 PASS） | cov driver:271 `cmd.devtools_open_only`；fault:79 |
| 关闭开发者工具 | ✅ | 同 MTD:188（after_close=false） | cov driver:274/277；TR:3972 按钮 |

**十一、拖放（3）**（MTD §二十六 525-526）
| 监听拖放事件 | ✅ | MTD:525（hilog `[DRAG-TEST]` Enter→Over→Drop 事件链判据，cmd.rs:1922-1942） | cov driver:836 `webview.listen.onDragDropEvent`（注册+unlisten） |
| 接收拖拽文件 | ✅ | MTD:525 **T0**（Drop paths 含文件 URI，08-31 复验 PASS） | adapter:128/143 为 console.log 占位 |
| 透传鼠标事件 | ✅ | MTD:526 `pointer-passthrough` **T0**（HitTestMode.Transparent，点击/滚动/HTML5 DnD 不受扰） | |

**十二、全屏渲染（1）**
| 全屏无黑边 | ✅ | MTD:200 `Fullscreen No Black Bars` **T0**（§7.4 set_bounds resize 传播回归防护，四方向判据） | wops:129/609 为 fullscreen API diag/smoke，非黑边判据，不冲突 |

**十三、配置开关（4）**（MTD §二十七 555-558）
| 拦截剪贴板复制 | ✅ | MTD:555 `with_clipboard(false) — 拦截 Ctrl+C` **T0**（粘贴不变，08-31 PASS） | TR:4049 |
| 开启剪贴板复制 | ✅ | MTD:556 `with_clipboard(true) — 正常复制` **T0** | TR:4050 |
| 拦截缩放快捷键 | ✅ | MTD:557 `with_zoom_hotkeys(false) — 拦截 Ctrl+=` **T0**（Ctrl+0 拦截层实抓证据） | TR:4053 |
| 开启页面缩放 | ✅ | MTD:558 `with_zoom_hotkeys(true) — 正常缩放` **T0**（Ctrl+0 平台不适用已修订披露） | TR:4054 |

## 2. 统计（共 64 条）

- ✅ 有对应用例：**59**（其中 22 条落在 manual_tests.md 文档 T0/T1 层，37 条 std 实跑）
- 🟡 仅覆盖率层：**5**
- ⚠️ 有名无实：**0**（adapter.ts 的 https-scheme/print/drag-drop/clipboard-zoom 四个 console.log 占位标记均被 MTD 文档 T0/T1 行补齐，不单独计 ⚠️）
- ❌ 零用例：**0**

## 3. 🟡 五条的检索关键词清单

1. **重载页面**：tests\*.ts `webview_reload|reload_webview|fn reload`（0）；`\breload\b`（仅 core:2645/2662 注释、stronghold 字符串、driver:398 store.reload）；MTD `reload|重载`（仅 §三十一 stronghold 表 712-714）；TR `webview_reload|reload|重载`（仅 stronghold Reload Verify 按钮 4199）；src-tauri\src `webview_reload|fn reload`（0）。唯一落点 fault:82。
2. **定向发送事件**：tests `emitTo|emit_to|emit-to`（仅 gap:148）；TR `emitTo|emit_to|定向`（0）；MTD `emitTo|emit_to|定向发送`（0）。
3. **设置Webview缩放**：tests `setZoom|set_webview_zoom|set_zoom`（仅 driver:818、fault:67、bad:1037/1079）；TR 同词（0）；MTD `缩放|zoom|Zoom`（仅 zoom-hotkey flag 行、monitor 缩放、pinch-zoom）；std 层 setZoom（0）。
4. **设置Webview焦点**：tests `setFocus|set_focus`（仅 driver:631 win 级、driver:830 webview 级盲调、window-ops-extra S9 cov 批 126/179、fault:128 win 级）；std webview 级（0）；TR/MTD（0；core:540 `window.isFocused` 为窗级读）。
5. **隐藏显示Webview**：tests `\.hide\(\)|set_visible|setVisible`（仅 driver:833、fault:73；driver:772 w.hide() 为 cov 批）；std 中 hide/show 均窗级（wops:848/877 ut_window）；TR/MTD webview 级（0）。

补充观察：设置Webview位置/尺寸/位置读取三组 std 用例均为 `skipOnMobile`（cfg(desktop)），在 mobile 形态跳过、desktop 形态实跑——验收表述若需覆盖 mobile 形态应注明该门控。

===== BLOCK 7 len=3 =====
...

===== BLOCK 8 len=64 =====
 blocks.

Simpler with regex on raw lines: find all `<result>.*?

===== BLOCK 9 len=202 =====
', extract.

Let me write it robustly:

```python
import json, re
path = r"C:\Users\65468\.claude\projects\D--xuqiu-tauri-3-0\d7265d27-9d89-4b6a-aab0-04727286f810.jsonl"
pat = re.compile(r'<result>(.*?)

===== BLOCK 10 len=13819 =====
' in o:
            for m in pat.findall(o):
                if ('SOW' in m or '§' in m) and m not in seen:
                    seen.add(m); out.append(m)
    walk(obj)
print('\n\n=====NOTIF=====\n\n'.join(out))
```

That prints all distinct agent result blocks mentioning SOW/§. That would include §一, §二 (old stalled + new), §三, §五, §六 reports. §六 report is long (the 157-item one). Total could be 20-30KB. That's a lot but acceptable? Hmm. Maybe filter to print only the ones for §一/§三/§五 (skip §六 since I have its final corrected tally and precise ❌/⚠️ lists, and skip §二 since it just arrived in full).

Filter: keep results whose text contains '§一' or '§三' or '§五' in its header... The report headers were like "# SOW §二 wry（Webview 与通信）用例对照审计". §一 report header probably "# SOW §一 tao..." etc. So filter on the first 200 chars containing '§一' or '§三' or '§五'.

Output size: three reports × ~4KB = 12KB. OK.

Encoding: Windows Python printing UTF-8 to stdout — pit: GBK. Use PYTHONIOENCODING=utf-8 or write to a temp file and Read it. Per memory [win-python-subprocess-gbk], safest: write to file with utf-8, then Read the file. Let me do that: script writes extracted reports to a temp md file; then I Read it.

Let me write the script via Bash heredoc? Bash tool with python? Python availability: there's python on this machine (used in past sessions). Use `python -c` with a here-doc via Bash, or write a .py file with Write then run. Cleaner: Write the script file, run `python script.py`, which writes output.md, then Read output.md.

Where to put temp files? Maybe D:\xuqiu\tauri-3.0\.dep-diffs\ or temp dir. Use C:\Users\65468\AppData\Local\Temp. Actually simplest in cwd... cwd is D:\xuqiu\tauri-3.0. Don't pollute the repo (it's not a git repo per env, but still). Use %TEMP%\claude. Let me just use the session temp dir mentioned in notifications: C:\Users\65468\AppData\Local\Temp\claude\D--xuqiu-tauri-3-0\... eh. I'll use C:\Users\65468\AppData\Local\Temp\sow-extract.md.

OK so my plan:
1. Run the spot-check greps for §二 (parallel batch)
2. Write + run the python extraction script for §一/§三/§五 reports; Read output
3. Compose final report; update tasks; write memory file

Actually, I can do steps 1 and 2's script write in parallel (Write tool + greps). Then run script, then Read.

Let me define the greps carefully (paths absolute, forward slashes fine for ripgrep on Windows):

Base: D:/xuqiu/tauri-3.0/tauri/examples/api/src/lib/tests
MTD: D:/xuqiu/tauri-3.0/tauri/doc/manual_tests.md
core.ts path: D:/xuqiu/tauri-3.0/tauri/examples/api/src/lib/tests/core.ts

Grep calls:
1. pattern `webview\.reload\.error`, path tests dir, content, -n
2. pattern `emitTo`, path tests dir, content, -n
3. pattern `setZoom`, path tests dir, content, -n
4. pattern `webview\.(setFocus|hide|show)`, path tests dir, content, -n — hmm `webview\.hide` matches driver:833 name 'webview.hide+show'. Also matches maybe nothing else. OK.
5. pattern `reload`, path core.ts, content, -n
6. pattern `userAgent/|DevTools|Fullscreen No Black|pointer-passthrough`, path MTD, content, -n
7. pattern `with_clipboard|with_zoom|https-scheme|secure-context|external-https|subresource`, path MTD, content, -n
8. pattern `Cookie Live|PDF Square|打印`, path MTD, content, -n
9. pattern `on_navigation|on_page_load|on_document_title_changed|eval_with_callback|webPageSnapshot|append_invoke_initialization_script|set_bounds`, path core.ts, content, -n
10. pattern `setBackgroundColor`, path tests dir, content, -n
11. pattern `console\.log`, path ohos-adapter.ts, content, -n

Plus Write the python script.

For the Write + greps: all independent, can go in one message. Then Bash run script, then Read output.

Wait, do I even need python? Let me reconsider — is the item-level §一/§三/§五 detail worth it? The final report quality improves substantially with exact item lists. And it's cheap. Yes, do it.

One risk: the JSONL file might be huge (long session). The walk over every line's JSON is fine, seconds.

Also note: the earlier stalled agents (§一 first attempt, §二 first attempt) died without results — no results in notifications for them. The completed ones: §一 relaunch (completed), §三 (completed earlier), §五 menu+tray (one agent "SOW §五" covering menu+tray? or two agents?), §六, §二 relaunch (just now). The summary said "§一/§三/§五菜单/§五托盘 done and spot-verified" — suggesting §五 menu and §五 tray were possibly one agent or two. The extraction filter on '§一'|'§三'|'§五' will catch them all.

Let me now also double check the plan for the final answer language: Chinese. Structure:

# SOW 能力清单 × ohdev 分支用例对照 · 总报告

**结论**: 513 条能力用例中 448 条在 ohdev 分支有真实对应用例（std 实跑断言或 manual 文档行），58 条仅覆盖率层盲调，4 条有名无实占位，3 条零用例。若按 SOW 自身口径（cov 批计入自动套件），覆盖率接近全量，硬缺口只有 7 条。

**前置**: 十仓已切 ohdev；套件文件在 ohdev↔ohdev-git 无差异（差异纯依赖接线），结论对两分支同有效。

Then per-section table:

| 组 | 条目 | ✅ | 🟡 | ⚠️ | ❌ | 
|---|---|---|---|---|---|
| §一 tao 窗口管理 | 88 | 72 | 16 | 0 | 0 |
| §二 wry Webview与通信 | 64 | 59 | 5 | 0 | 0 |
| §三 tauri 应用框架与事件 | 61 | 35 | 26 | 0 | 0 |
| §四 工具链 | 10 (流程级) | — SOW 豁免 — |
| §五 菜单 | 86 | 85 | 1 | 0 | 0 |
| §五 托盘 | 57 | 57 | 0 | 0 | 0 |
| §六 插件生态 | 157 | 140 | 10 | 4 | 3 |
| 合计 | 513 | 448 | 58 | 4 | 3 |

Then 缺口清单 section:
- ❌ 3: 剪贴板大图 (read_image 4x4), log 统一输出 (attachConsole/attachLogger 零调用), updater download_and_install (平台契约有意不注册，AppGallery 流)
- ⚠️ 4: process.relaunch 空 fn 占位, shell sidecar, window-state clear (按钮+cov 无文档行), updater 更新对话框 (showAppGalleryUpdateDialog 准孤儿)

Hmm wait, from the summary: "⚠️: relaunch/sidecar/window-state clear/updater dialog" — 4 items. But 10-13 memory said 6 ⚠️: relaunch, shell Command.spawn, sidecar, opener 2 items, window-state clear. The 1109 refresh changed: shell Command.spawn flipped ⚠️→✅ (risk-supplement.ts:93-118 full lifecycle test), opener 打开缓存目录/打开本地链接 flipped to ✅ via manual §二十二 4 rows T0 实收. So remaining ⚠️ = relaunch, sidecar, window-state clear, updater dialog = 4. ✓ consistent with summary.

- 🟡 58 by section: §二 5 (list them), §六 10 (list key ones), §一 16 (concentration), §三 26 (concentration), §五 1 (获取默认菜单)

Hmm, §六 10 🟡: from summary "5 items flipped ❌→🟡 (store.reset/sql :memory:/upload download/barcode cancel/barcode openAppSettings)" plus original 3 🟡 (fs.open+write, readTextFileLines, shell open('help')) = 8... plus? 10-13 had 3 🟡; +5 flips = 8. But final says 10. Hmm. The summary says "§六 插件： 157 = 140✅/3❌/4⚠️/10🟡 (❌: 剪贴板大图、log 统一输出、updater download_and_install〔平台契约〕； ⚠️: relaunch/sidecar/window-state clear/updater dialog; agent's own summary arithmetic corrected)". And "140✅/3❌/4⚠️/10🟡 = 157". So 10 🟡 — the §六 agent's per-item verdicts gave 10 🟡. Which 10? 3 original + 5 flips = 8, plus 2 more flips I'm not sure about. Possibly 2 more ❌→🟡 or ⚠️→🟡 flips. E.g., sentry ❌→🟡 (driver:286 sentry_test_panic — I verified this flip). And maybe another one.

Hmm: 10-13 baseline was 139✅/9❌/6⚠️/3🟡. 1109 refresh: flips to reach 140✅/3❌/4⚠️/10🟡:
- ❌ 9→3: 6 flips out of ❌. Known flips: store.reset→🟡, sql memory→🟡, upload download→🟡, barcode cancel→🟡, barcode openAppSettings→🟡 (5 flips to 🟡), sentry 测试崩溃→🟡 (driver:286) = 6 flips ❌→🟡. That accounts for 3🟡+6=9... wait 3+6=9 🟡? But total is 10 🟡. Hmm, 3 original + 6 flips = 9, not 10.
- ⚠️ 6→4: 2 flips out of ⚠️: shell Command.spawn→✅, opener 2 items→✅ = that's 3 flips ⚠️→✅... 6−3=3, but final says 4. So one ⚠️→🟡 flip? Or the counts differ.

Let me recompute: 6 ⚠️ original = relaunch, shell.Command.spawn, sidecar, opener 打开缓存目录, opener 打开本地链接, window-state clear. Flips: spawn→✅, opener×2→✅ = 3 leave ⚠️. Final ⚠️=4 (relaunch, sidecar, window-state clear, updater dialog). updater dialog was previously... in 10-13 it was "准孤儿" under ⚠️? The 10-13 ⚠️ 6 条 listed: process.relaunch, shell Command.spawn/sidecar (counted as 1 or 2?), opener 2, window-state clear. If spawn/sidecar counted as 2, that's 7 items... The 10-13 memory says "⚠️ 6 条：process.relaunch 占位空 fn...且 manual 无行（§九 danger-mode 验的是 core request_restart）；shell Command.spawn/sidecar 占位且 manual 无 shell 章节；opener 打开缓存目录/打开本地链接无专属...；window-state 清空有按钮+driver 批但 manual 无行" — so spawn+sidecar = 2, relaunch = 1, opener = 2, window-state = 1 → total 6. ✓.

1109: spawn→✅ (risk-supplement full lifecycle). opener×2→✅ (manual §二十二 4 rows T0). Leaves relaunch, sidecar, window-state = 3 ⚠️. But final = 4 including updater dialog. So updater dialog must have been newly classified ⚠️ (previously it was "准孤儿" mentioned within ⚠️ discussion or ❌? In 10-13 ❌ list: ①剪贴板大图 ②log统一输出 ③store reset ④sql memory ⑤upload download ⑥barcode cancel ⑦barcode openAppSettings ⑧updater下载安装 ⑨sentry测试崩溃. So updater download_and_install was ❌ ⑧. The "打开更新对话框" item — where was it? It was presumably ✅ or ⚠️. The 10-13 memory notes "准孤儿：updater.showAppGalleryUpdateDialog 最近行仅 §三十 updater.check". So in 1109 it's counted ⚠️ 4th item.

And ❌ 3 = 剪贴板大图, log统一输出, updater download_and_install. ✓ (store reset, sql memory, upload download, barcode cancel, barcode openAppSettings, sentry → 6 flips to 🟡). So 🟡 = 3 original + 6 flips + updater dialog ⚠️→? no wait. 3+6 = 9. Final 10. Hmm one more.

Maybe one more flip I don't recall — possibly fs family or another. The summary says "§六 agent's per-item verdicts give 140✅/3❌/4⚠️/10🟡 = 157. Corrected from per-item verdicts (source of truth)". So 10 🟡 per-item. 139✅→140✅ means net +1 ✅. Flips: spawn ⚠️→✅, opener×2 ⚠️→✅ = +3 ✅. So something ✅→🟡 or ✅→❌... ✅ count 139→140 with +3 in and −2 out? E.g., 2 items ✅→🟡. Possible: some items previously ✅ downgraded to 🟡 on re-inspection (e.g., 通知 "发送通知" T0 vs auto schedule variant, or single-instance 验证, or nfc...). 

I can't reconstruct precisely from memory. The extraction script will give me the §六 report too — but I decided to filter only §一/§三/§五. Let me include §六 as well to get its final per-item tallies. Actually the §六 report from the agent had an arithmetic error in summary but per-item verdicts correct — the report text will show per-section tables. Let me include all four (§一/§三/§五/§六) in the extraction; output ~16-20KB. That's OK. Actually, let me just extract ALL result blocks (including §二 just-arrived? no need, it's in context). Filter: exclude the §二 wry one (already in context) to save tokens. I'll filter by header keyword: skip if 'wry' in first 100 chars.

Alright. Also: the summary said "5 items flipped ❌→🟡 (cov layer now has store.reset/sql :memory:/upload download/barcode cancel/barcode openAppSettings); shell Command.spawn flipped ⚠️→✅". And separately "verified: sentry ❌→🟡 flip stands" — so sentry flip confirmed = 6th flip. OK so 🟡 = 3+6 = 9 from flips, +1 unknown = 10. The extraction will resolve.

Now, the spot-check greps. Let me also spot-check 2-3 §六 🟡 new claims? I already verified sentry (driver:286) and relaunch placeholder. store.reset at driver:400, sql :memory: driver:404, upload download driver:412, barcode cancel driver:466, openAppSettings driver:469 — from the summary, these line numbers were noted as "verified blind calls" in the Files section: "driver-generated.ts — cov blind calls verified: :286 cmd.sentry_test_panic, :400 store.reset, :404 sqlite::memory:, :412 upload.download.localhost, :466 barcode-scanner.cancel, :469 barcode-scanner.open_app_settings". Hmm — "verified" in the summary's file notes. Were they verified by me or just claimed by agent? The summary file notes say "cov blind calls verified" — I'll take these as previously spot-verified (the summary explicitly lists them under Files and Code Sections as verified). Actually to be safe, I can include a couple in my grep batch: driver:400/404/412/466/469. Let me add one grep: pattern `store\.reset|sqlite|upload\.download|barcode-scanner\.(cancel|open_app_settings)` in driver-generated.ts, -n content. That covers all five in one grep. 

Let me finalize the parallel batch:

Greps (11):
G1. `webview\.reload\.error` — tests dir, content, -n
G2. `emitTo` — tests dir, content, -n
G3. `setZoom` — tests dir, content, -n
G4. `webview\.(setFocus|hide|show)` — tests dir, content, -n
G5. `reload` — core.ts, content, -n
G6. `userAgent/|DevTools|Fullscreen No Black|pointer-passthrough` — MTD, content, -n
G7. `with_clipband|with_zoom_hotkeys|https-scheme|secure-context|external-https|subresource` — MTD (typo watch: with_clipboard), content, -n
G8. `Cookie Live|PDF Square|打印` — MTD, content, -n
G9. `on_navigation|on_page_load|on_document_title_changed|eval_with_callback|webPageSnapshot|append_invoke_initialization_script|set_bounds` — core.ts, content, -n
G10. `setBackgroundColor` — tests dir, content, -n
G11. `store\.reset|sqlite|upload\.download|barcode-scanner\.(cancel|open_app_settings)` — driver-generated.ts, content, -n
G12. `console\.log` — ohos-adapter.ts, content, -n

Plus Write python script.

Then run script → Read output → compose.

Actually for G6: MTD content is Chinese; grep for `userAgent/` matches table rows like `| **T0** | ... userAgent/custom ...`. Let me use pattern `userAgent` (simpler). And `DevTools|Fullscreen|pointer-passthrough`. Keep it simple: `userAgent|DevTools|Fullscreen No Black|pointer-passthrough`.

Also G7 pattern `with_clipboard|with_zoom_hotkeys|https-scheme|secure-context|external-https|subresource` — fine.

G8: `Cookie Live|PDF Square|系统打印` — MTD uses "打印" a lot (§7 print rows). Keep `Cookie Live|PDF Square` and rely on G6-ish… actually 打印网页 T0 at :553 "WebView 打印 — 系统打印对话框". Pattern `打印` will hit many lines (~10). Acceptable.

Now the Python script. Write to C:\Users\65468\AppData\Local\Temp\claude\sow_extract.py? The Temp\claude dir exists (from task output paths). I'll write script there and output to same dir.

Script:

```python
import json, re, io, sys

src = r"C:\Users\65468\.claude\projects\D--xuqiu-tauri-3-0\d7265d27-9d89-4b6a-aab0-04727286f810.jsonl"
dst = r"C:\Users\65468\AppData\Local\Temp\claude\sow-agent-reports.md"
pat = re.compile(r"<result>(.*?)

===== BLOCK 11 len=11146 =====
" not in line:
        continue
    try:
        obj = json.loads(line)
    except Exception:
        continue
    texts = []
    def walk(o):
        if isinstance(o, dict):
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
        elif isinstance(o, str):
            if "<result>" in o:
                texts.append(o)
    walk(obj)
    for t in texts:
        for m in pat.findall(t):
            m = m.strip()
            if m in seen:
                continue
            seen.add(m)
            head = m[:120]
            if "wry" in head:  # §二 already in context
                continue
            if ("SOW" in head) or ("§" in m[:400]):
                chunks.append(m)

with io.open(dst, "w", encoding="utf-8") as f:
    f.write("\n\n=====\n\n".join(chunks))

print("chunks:", len(chunks))
```

Hmm, the condition: I want results that are the SOW section audit reports. Their headers: "# SOW §一 tao（窗口管理）用例对照审计" etc. (the §二 one had "# SOW §二 wry（Webview 与通信）用例对照审计"). So filter: m starts with "# SOW §" or contains "# SOW §". Let me use: if m.startswith("# SOW") or "# SOW" in m[:5]. And exclude wry. Also there might be an earlier stalled §二 result? Stalled agents died without completing → no notification result. But there could be partial results? The §一 stalled one — no result. OK.

Also the §六 report — starts with "# SOW §六..." presumably. Include.

Wait, also possible: my own messages in the JSONL contain "# SOW" text? Unlikely.

Also the extraction dedups by exact content — the same notification may appear multiple times in the JSONL (notification + maybe re-delivery). seen-set handles it.

One more thing: agent final reports also exist as the Agent tool result — in the JSONL they'd be in tool_result blocks, not <result> tags. The <result> tags are only in task-notification synthetic user messages. But for background agents, the completion notification contains the full result. Good. But some agents might have completed without me seeing a notification with full result? The summary said agents completed and I read their reports — those came through notifications. OK.

Hmm, actually there's a subtlety: for agents spawned with run_in_background (default), the result comes in the task-notification. For run_in_background: false, result comes in the Agent tool result directly. Either way, the report text would be in the JSONL somewhere — possibly as tool_result content (JSON string in the assistant/tool message). My walk over ALL string values catches those too, but only strings containing "<result>". The Agent tool result content wouldn't have <result> tags. Hmm. Let me broaden: also collect strings that start with "# SOW" from any field. Modify: if "# SOW §" in o → collect o (the whole string, which for tool_result is the full report text). That covers both notification-embedded and direct results.

Let me restructure:

```python
def walk(o):
    ...
    elif isinstance(o, str):
        if "# SOW §" in o or o.startswith("# SOW"):
            texts.append(o)
```

then for each collected string, if it contains <result> extract those, else take the string itself if it starts with "# SOW" (truncate leading junk?). Tool_result strings might have wrapper text. Hmm, keep it simple: collect candidates; for each, if "<result>" present, extract inner; else use whole. Dedup by first 200 chars (in case of notification + tool_result duplication).

Risk: whole-string collection of a huge tool_result could include the whole report — that's what I want. OK.

Also dedup: notification result and agent tool result may differ slightly (identical usually). Dedup by hash of normalized content? Dedup by content[:300]. Fine.

Let me also guard output size: print chunk lengths.

Then I Read the dst file.

Now — one more piece for the final report: §四 toolchain. I have build.rs content in context now (read at session start). Good: :39-89 Options with `--app` flag (lines 73-78 in my summary; actual read shows lines 73-78: the clap doc comment + `pub app: bool` at :78; conflicts_with_all at :77). The read shows: lines 73-78 (comment + #[clap(long, conflicts_with_all...)] + pub app: bool). run_app at :274-292. sign_if_configured at :413-458. Also cargo-mobile2 target.rs:194-195 release push. Templates exist. I verified these earlier. Good.

Also the "sentry debug gate stale comment" new finding — cite cmd.rs:1968-1976 (#[cfg(debug_assertions)] on sentry_test_panic) vs manual_tests.md:359 & TestRunner.svelte:3365 stale comments. I verified cmd.rs earlier per summary. Should I re-verify quickly? It was already verified in the prior session portion (summary states it as verified finding with line numbers). OK.

Let me also think about whether to include the dual-caliber framing. SOW's 口径 line: "自动测试为应用内测试套件（src/lib/tests，18 个套件共 692 例；core / plugins / menu / tray / window / dpi / image / ohos 系列为标准套件，driver / bad-input / 故障注入 / api-gap 批随覆盖率插桩构建执行）". So SOW explicitly counts driver/bad-input/fault/api-gap batches as part of the auto suite. Under that caliber, 🟡 items DO have cases (they're listed in the SOW chapter's test case names, which came from examples/api — the chapter was authored from this suite). So by SOW's own standard: 513 items − 3❌ − 4⚠️ = 506 have cases; hard gaps 7. Under strict std-assertion caliber: 448/513.

The user asked "看看对应能力的测试用例是否我们当前ohdev分支上的代码都提供了" — i.e., does the ohdev code provide the test cases listed in the SOW chapter. The honest answer: yes for ~98.6% at SOW's own caliber (cov batches included); 3 items have zero case; 4 items are placeholders; 58 items exist only as coverage-layer blind calls which SOW counts but which don't assert behavior.

Also should mention: 2 🟡-related "断档" disclosure — cov layer last run 10-28 (12 days), so cov-only items' last execution evidence is stale; and mobile form staleness (25 days) + §二's observation that webview position/size std tests are skipOnMobile (desktop-only) — for mobile-form acceptance those 3 groups would skip. Wait — which §二 items are skipOnMobile per agent: 设置Webview位置/尺寸/位置读取 (and 创建子Webview explicit bounds?). The agent said "设置Webview位置/尺寸/位置读取三组 std 用例均为 skipOnMobile（cfg(desktop)）". Hmm "三组" = 读取位置/设置位置/设置尺寸? It says "设置Webview位置/尺寸/位置读取三组". OK, in mobile form those skip. Disclose.

Also §一 has mobile gating too presumably (cursor etc. — desktop-only). I'll mention generally.

Now the final report also needs the branch-switch part: already reported in earlier turns (10 repos switched). In final report, mention as context line: 树 = ohdev (10 仓), 套件与 11-06 验证树 (ohdev-git 73bffac6f) 内容等价（差异纯依赖接线 11 文件，不含测试文件），故本审计结论对两分支均成立。

Let me now also prepare the memory file to write after the report:
name: sow-capability-coverage-audit-ohdev-1109
description: SOW 能力清单×ohdev 用例对照总账 1109——513 条=448✅/58🟡/4⚠️/3❌;§四流程级豁免;双口径;缺口清单与 10-13 delta
Content: the tallies, gap lists, dual caliber, corrections vs 10-13 (6 flips ❌→🟡, spawn ⚠️→✅, opener ×2 ⚠️→✅, menu 4 预定义 ⚠️→✅ via cross-section), §二 5 🟡 list, §一/§三 🟡 concentrations, toolchain evidence, new findings (sentry debug-gate stale comments), mobile/cov 断档 disclosure, spot-check discipline. Link [[plugins-sow-audit-2026-10-13]], [[demo-case-counts-three-layers]], [[ohos-sow-20260909]].

OK. Now execute. First message: parallel greps + Write script. Wait — Write and Grep are different tools; can I call them in one block? Yes, multiple tool calls in one message are fine.

Actually, let me reconsider G4 pattern: `webview\.(setFocus|hide|show)` — in driver-generated.ts entries are strings like 'webview.setFocus', 'webview.hide+show'? Hmm names like driverCase('webview.hide+show'...)? The agent said driver:833 `webview.hide+show`. Pattern `webview\.hide` matches. `webview\.show` might match 'webview.show' too. Fine. But also matches code like `this.webview.hide()` — rare in TS tests. OK.

G2 `emitTo` — matches gap:148 `event.emitTo`. Also maybe TestRunner references? Agent says TR 0. My grep path is tests dir only, not views. OK, but I also want TR absence... skip, trust agent for absence claims; my spot-check validates presence claims + a few absences. The absences were checked by agent with keyword lists (shown in its §3 关键词清单 — quite thorough). I'll trust absence given its keyword audit looks rigorous, and validate presence.

G3 `setZoom` in tests dir — expect driver:818, fault:67, bad:1037/1079 only.

G5 `reload` in core.ts — expect comments at 2645/2662 + maybe others.

G9 core.ts — expect lines 899/945/976, 773, 799, 682, 2427 etc.

G10 setBackgroundColor in tests dir — expect wops:836, driver:824, fault:76.

G12 console.log in ohos-adapter.ts — expect placeholders at 103/128/143/157 etc.

Also G13: verify gap:148? covered by G2 (emitTo in tests dir → gap.ts:148 + driver? maybe also driver has emitTo? Agent says only gap:148). G2 output will show.

And G14: MTD line numbers check for §五-related? Not needed — menu/tray were spot-verified previously.

OK, let me also include a grep for `setAutoResize` core:1996 (agent claim) in G9? Add `setAutoResize|clearAllBrowsingData` to G9 pattern. Sure — extend G9: `on_navigation|on_page_load|on_document_title_changed|eval_with_callback|webPageSnapshot|append_invoke_initialization_script|set_bounds|setAutoResize|clearAllBrowsingData`.

Alright, also I realize for the extraction script — the current session's JSONL is the same file being appended? The transcript path given is the pre-compaction transcript. The current session continues in the same file? "the full transcript at: ...jsonl" — that's the transcript of this conversation including pre-compaction. Post-compaction turns append to it (likely same session id). Fine either way — the §一/§三/§五/§六 notifications are in the pre-compaction portion which is in that file.

Let me write the commands now.

Batch:
1-12 Greps + 1 Write (script). 13 calls in one message. That's a lot but fine. Actually let me trim: G8 打印 pattern may be noisy; keep `Cookie Live|PDF Square|系统打印对话框`. G6 `userAgent|DevTools|Fullscreen No Black Bars|pointer-passthrough`. 

Python availability check: `python` should exist. I'll run `python C:\...\sow_extract.py` via Bash. If python not found, try py. Handle in the run step.

Let me write the script file content:

```python
import json, re, io

src = r"C:\Users\65468\.claude\projects\D--xuqiu-tauri-3-0\d7265d27-9d89-4b6a-aab0-04727286f810.jsonl"
dst = r"C:\Users\65468\AppData\Local\Temp\claude\sow-agent-reports.md"

cands = []
for line in io.open(src, encoding="utf-8", errors="replace"):
    if "# SOW" not in line:
        continue
    try:
        obj = json.loads(line)
    except Exception:
        continue
    stack = [obj]
    while stack:
        o = stack.pop()
        if isinstance(o, dict):
            stack.extend(o.values())
        elif isinstance(o, list):
            stack.extend(o)
        elif isinstance(o, str) and "# SOW" in o and len(o) > 500:
            cands.append(o)

seen = set()
chunks = []
for t in cands:
    # notification wrapper: take inner <result> if present
    if "<result>" in t:
        for m in re.findall(r"<result>(.*?)

===== BLOCK 12 len=197 =====
 extraction (they have no <result>) → m.strip().startswith("# SOW") false → skipped. But wait — notification content: the full user message string contains <task-notification>...<result># SOW §一...

===== BLOCK 13 len=1039 =====
 extraction pulls the inner report which starts with "# SOW". ✓.

But hmm — what if the agent reports don't start with "# SOW"? The §二 one does ("# SOW §二 wry（Webview 与通信）用例对照审计"). Likely §一/§三/§五/§六 follow the same format since I presumably used consistent prompts. If some don't start with it, I'll get fewer chunks and can adjust. The print statement reports chunk count; if it's fewer than expected, I'll relax the filter (e.g., contains "判定" tables). Let me add a fallback in the same run: also count how many <result> blocks were found total. I'll add prints: total candidate strings, total result blocks extracted. Then decide.

Actually let me make the filter less brittle: collect <result> blocks that contain "判定" AND ("§" or "SOW") and len>1000. Then for non-notification strings skip. Simpler: extract all <result> blocks; keep those with "用例对照" or "SOW §" or containing "🟡". Keep the wry exclusion by header. Let me do:

```python
blocks = []
for t in cands:
    if "<result>" in t:
        for m in re.findall(r"<result>(.*?)

===== BLOCK 14 len=418 =====
" not in line:
        continue
    n_lines += 1
    try:
        obj = json.loads(line)
    except Exception:
        continue
    stack = [obj]
    while stack:
        o = stack.pop()
        if isinstance(o, dict):
            stack.extend(o.values())
        elif isinstance(o, list):
            stack.extend(o)
        elif isinstance(o, str) and "<result>" in o:
            for m in re.findall(r"<result>(.*?)

===== BLOCK 15 len=133 =====
"? Because I was reasoning about the extraction approach and quoted "<result>" tags in my thinking! So the regex found `<result>(.*?)

===== BLOCK 16 len=230 =====
-like quotes... Actually my thinking block contained literal "<result>" strings? I wrote "the <result> tags are only in task-notification synthetic user messages" and regex-extracted... no wait. The extraction regex `<result>(.*?)

===== BLOCK 17 len=224 =====
". My thinking text contains the literal substring "<result>" (in "only strings containing '<result>'" — hmm, that's with quotes around it: `'<result>'`). The regex would match from that occurrence to... there's no closing `

===== BLOCK 18 len=52 =====
 extract those" — contains `<result>` literal. And `

===== BLOCK 19 len=5 =====
(.*?)

===== BLOCK 20 len=18 =====
` mention to the `

===== BLOCK 21 len=3922 =====
 quoted... The script scanned ALL records. The §六 report might have been in an Agent tool result (run_in_background: false?) rather than a notification. If I ran §六 agent with run_in_background: false, the result comes in the Agent tool call result — which in the JSONL is a tool_result block whose content is a JSON-escaped string — my walk would still find it IF it contains "<result>" — but tool_result content doesn't have <result> tags! It has the raw report text. So it's missed by the "<result>" filter.

Right — the script's first filter: `if "<result>" not in line: continue` — skips lines without <result> entirely. Tool-result lines (for foreground agents) don't have it.

But per my flow, all section agents were background (default). §六, §一... The §一 relaunch and §六 results came via task-notifications (I recall notifications). Hmm, but the extraction says blocks: 23 total <result> blocks found, 6 kept after SOW filter. 23 result blocks = all task notifications in the whole transcript (including non-SOW agents — e.g., earlier session had other agents? This session is the audit session; notifications: §一 attempt1 (no result, stalled), §二 attempt1 (no result), §一 relaunch ✓, §二 relaunch ✓ (just now, excluded by wry filter), §三 ✓, §五 ✓ (one agent covering menu+tray? or two — extraction shows TWO §五 chunks: 托盘 + 菜单, so two agents or one agent two chunks), §六 ✓... that accounts for: §一relaunch, §二relaunch(excluded), §三, §五托盘, §五菜单, §六 = 6 SOW blocks + this turn's polluted thinking matches (3) = 9. But blocks total = 23. The other 14 = non-SOW notifications? This session shouldn't have many... unless the JSONL contains earlier-session agents (the file is the full transcript since session start — including the pre-compaction conversation which had agents for branch switching? No wait — the branch switch was done in the main thread per summary. Hmm, the file d7265d27 is the CURRENT session's transcript, which started... this session has had: §一, §二, §三, §五(menu), §五(tray), §六 agents + relaunches. Plus possibly earlier agents before the section audits (e.g., baseline recount agents?). 23 blocks with <result> — some may be duplicate deliveries of the same notification (notification + re-notification), and dedup by key [:300] handled that.

Key question: where are §一 and §六? Let me check the kept chunks again: chunks kept = [§五托盘 7848, §五菜单 10291, §三 10532, thinking-polluted 13819, 196, 1038]. So §一 and §六 notifications either:
(a) weren't delivered as <result> blocks (foreground Agent calls — tool_result without tags), or
(b) their headers failed the "SOW in first 400 chars" filter.

For (b): §六 report header — the refresh agent's report. Hmm. Actually wait — the §六 agent completed LONG ago in the pre-compaction session, and there was a "§六 refresh" — Task #3 says "SOW §六 插件 18 条缺口项复核" completed. The refresh may have been done by me in the main thread (not an agent) — "复核" = spot-check by me. The original §六 report came from the 10-13 session (different session, different JSONL!) or from a §六 agent in this session?

From the summary: "Task #3 (completed): §六 refresh" and the flow mentions §六 agent's summary arithmetic error — so there WAS a §六 agent in this session whose report I have partially reconstructed. Its notification should be in this JSONL...

Hmm, and §一: "§一 relaunch succeeded (67 tool uses, completed)". Its notification should be here too.

Unless... the first filter `if "<result>" not in line: continue` — these notification lines DO contain <result>. Both should pass. Then blocks get collected. Then the SOW filter: `"SOW" not in b[:400] and not b.startswith("# SOW")` → skip. If §一's report starts with something like "# SOW §一 tao..." it passes. Unless the §一 report header is different, e.g. "# SOW §一（tao 窗口管理）…" — still contains "SOW". Hmm, so why missing?

Wait — maybe the §一 and §六 reports ARE in the polluted chunk 4! The regex `<result>(.*?)

===== BLOCK 22 len=23 =====
` mention and a later `

===== BLOCK 23 len=159 =====
 pair. My thinking strings are separate records. Each string yields its own matches. The pollution happened because my THINKING string contained `<result>` … `

===== BLOCK 24 len=6249 =====
 blocks exist? Hmm — earlier in this session (pre-compaction), were there other background agents? Possibly: the "baseline recount" agents, "branch safety" agents... The summary says the main thread did branch switching and recount inline. But there might have been more agents (e.g., §四? No — §四 was inline. §五 was one or two agents).

OK rather than guess, let me just grep the JSONL directly for the §一 and §六 report headers. Grep the raw jsonl for `# SOW §一` and `# SOW §六` and `SOW §六`. The raw JSONL has these as escaped strings — rg on the raw file matches the escaped content fine (the content is inside a JSON string, but "# SOW §一" would appear literally... well, with \n escapes for newlines but the header line itself is intact).

Hmm wait — but actually, do I even need §一 and §六 reports in full? Let me assess what I still need:

For the final report, per-item gap lists:
- §一 16 🟡 — NEED the item list. This is the biggest missing piece.
- §六 10 🟡 + 3❌ + 4⚠ — I know ❌ and ⚠️ precisely; the 10th 🟡 is uncertain. Nice to confirm.
- §五 menu: raw agent said 4⚠ (预定义最小化/最大化/关闭窗口/退出) + 1🟡 (获取默认菜单); I corrected the 4⚠→✅ via cross-section. Final: 86 = 85✅/1🟡. ✓ Have it.
- §五 tray 57✅ ✓.
- §三: now have full 🟡 list: 8 app-info + 1 image.fromPath + 17 path = 26 ✓.
- §二: 5 🟡 ✓.

So I need §一's 16 🟡 list and §六's exact 🟡 10 list.

Let me grep the JSONL raw for distinctive markers. For §一: search for `SOW §一` in the jsonl. For §六: `SOW §六` or the report's stat lines. If rg finds the lines, I can then extract with a targeted python pass (adjust the filter: drop the [:400] SOW requirement, instead require the report to contain "tao" section markers... better: just extract ALL <result> blocks >2000 bytes and print their first 100 chars + list, then pick).

Simpler fix: modify script to dump every distinct <result> block's first line (header) with size, to a listing; then extract chosen ones fully. Let me do a quick python one-liner (or rewrite script) that prints block headers:

```python
import json, re, io
src = ...
blocks = []
... same walk ...
# dedup
seen=set(); uniq=[]
for b in blocks:
    k=b[:250]
    if k in seen: continue
    seen.add(k); uniq.append(b)
for i,b in enumerate(uniq):
    print(i, len(b), repr(b[:90]))
```

Write output to a file to avoid GBK issues (print may hit GBK console encoding with Chinese — use ASCII-safe by writing to file with utf-8 and reading it).

Then pick indices for §一/§六 and write those to the reports file.

Actually — wait. Alternative explanation for missing §一/§六: maybe those agents were run with run_in_background: false (foreground), so their reports are in Agent TOOL RESULTS, not notifications. The summary says "Subagents run in the background by default" — but §一's first agent stalled (600s watchdog), meaning I waited on it... The §六 agent — hmm. If foreground, tool_result content in JSONL is the report text directly (no <result> tags) → my script missed them at the first line filter.

So the robust approach: scan for report text patterns in ALL strings (not just <result>): strings containing "SOW §" or starting with "# SOW" or containing "逐条对照审计". Let me rewrite:

- Walk every JSON record's strings.
- If a string contains "逐条对照" or "# SOW §" → candidate.
- If it contains <result>, extract inner blocks; else if len>2000 use the string (truncated to remove wrapper? tool_result content might have prefix text like the usage stats? For foreground Agent calls in this harness, the tool result includes the final report plus metadata possibly. The report text itself would be embedded).

Then dedup by [:300], dump headers list, then select.

Let me just do it in one script pass that writes ALL SOW-audit candidates (containing "逐条对照" or "# SOW") to the md file with separators, excluding wry, and ALSO print header list. Then I grep the md for gap rows again. The file might include duplicates from multiple sources (notification + tool_result) — dedup by [:300] key should collapse identical ones.

Also exclude my thinking pollution: my thinking contains "# SOW 能力清单 × ohdev 分支用例对照 · 总报告" (line 467 grep hit) — my drafted report title! That chunk is my own draft. Filter: exclude blocks containing "内部 thinking marker"? Can't distinguish reliably. But my thinking blocks were ALREADY matched via <result> regex pollution; with the new "contains # SOW §" filter, my thinking (which contains "# SOW §一 tao"? hmm, does it? My thinking this turn discussed §一/§三/§五 — yes I wrote "§一 tao: 88 = 72✅/16🟡" etc. and the grep output line 490/492 shows my draft text with "- 🟡 58 by section: §二 5 ... §一 16 (concentration), §三 26 (concentration)". So my thinking WILL pollute a substring-match filter.

Better discriminator: require the string to START with "# SOW" after stripping, OR be an extracted <result> that starts with "# SOW". My thinking never starts with "# SOW" at the string level (thinking strings start with actual prose, and the pollution came from inner <result> regex matches — those extracted matches start mid-thinking). For the new filter: check `b.startswith("# SOW")` after strip for direct strings; for <result> extractions also require startswith. But §一/§六 reports might not start with "# SOW" if delivered via tool_result with a wrapper prefix...

Ugh. Pragmatic approach: two-step. Step 1: dump a CATALOG of all <result> blocks AND all long strings (>3000 chars) containing "SOW §" with their first 120 chars. Review catalog, identify §一/§六 entries. Step 2: extract those specific ones by index. Small writes, cheap reads.

Let me write script v2:

```python
import json, re, io

src = r"...jsonl"
cat_path = r"...sow-catalog.md"

entries = []  # (source, size, head120)
def add(kind, s):
    s = s.strip()
    entries.append((kind, len(s), s[:120].replace("\n"," | ")))

for line in io.open(src, encoding="utf-8", errors="replace"):
    if "SOW" not in line and "<result>" not in line:
        continue
    try: obj = json.loads(line)
    except Exception: continue
    stack=[obj]
    while stack:
        o=stack.pop()
        if isinstance(o,dict): stack.extend(o.values())
        elif isinstance(o,list): stack.extend(o)
        elif isinstance(o,str):
            if "<result>" in o:
                for m in re.findall(r"<result>(.*?)

===== BLOCK 25 len=533 =====
 extraction produced blocks whose [:400] lacks "SOW" — e.g. report starts with "文件索引" preamble before title? The §二 report starts with "# SOW §二 wry..." directly. Likely others too. But then they'd be in the catalog as result-blocks with head showing their first 120 chars — I'll see.

Wait, actually — hmm, why did the first script's `blocks: 23` → kept 6 include thinking pollution? The thinking pollution chunks (13819, 196, 1038) came from result-blocks extracted out of MY THINKING strings (which contained literal <result> ... 

===== BLOCK 26 len=7966 =====
 extraction captured it with leading whitespace (m.strip() applied ✓)...

OR: the §一 notification result was DELIVERED but the <result> block for §一 exists — was it excluded by the wry filter? "if 'wry' in b[:80]" — no, §一's header has no wry.

Hmm wait — look at kept chunk sizes: [7848, 10291, 10532, 13819, 196, 1038]. And the dedup key = b[:300]. If the §一 report's first 300 chars IDENTICAL to something else? No.

OR the §一 result block was TRUNCATED in the JSONL? Long agent results in notifications get truncated with "... [result truncated]"? Hmm.

OR — the §一 report was delivered in a notification where result text does NOT start with "# SOW" but with something before it (like a preamble line). m.strip() then startswith("# SOW") fails, and "SOW" in b[:400]... would still be True if the header is within the first 400 chars! The filter was `if "SOW" not in b[:400] and not b.startswith("# SOW"): continue` — so kept if SOW appears anywhere in first 400 chars. A preamble < ~380 chars before the header → kept. Longer preamble → dropped!

So §一's report probably has a preamble (e.g., 文件索引 + 复核说明) longer than 400 chars before "SOW" appears... but wait, the header "# SOW §一 tao（窗口管理）用例对照审计" appears in the raw grep — that's the report's first line. Unless the <result> for §一 notification contains the report but the extraction regex captured something before it...

Hmm, actually — look again at grep #1 output: `# SOW §一 tao（窗口管理）用例对照审计` appears ONCE in the early part and again later. And there's also `# SOW §一 tao...` (with literal dots) = my thinking. So the real report header exists at least once.

Wait, maybe the issue: the §一 result block is in the JSONL but in a record type the json.loads handles fine... Let me think about why blocks=23 kept only 6.

23 blocks total. Real agent reports in this session: §一(attempt1 stalled - no result), §二(attempt1 stalled - no result), §一(relaunch - result!), §二(relaunch - excluded wry), §三, §五菜单, §五托盘, §六. That's 6 reports + wry = 6 real blocks expected to pass the filter... but only 3 real were kept (§五×2 + §三). So §一 AND §六 blocks were dropped by the SOW[:400] filter, meaning their first 400 chars lack "SOW" AND they don't start with "# SOW" after strip.

But the grep shows the header "# SOW §一 tao（窗口管理）用例对照审计" IS in the raw file... Maybe that occurrence is in the AGENT's own final message within the agent's TRANSCRIPT record (the JSONL stores all messages including subagent's? No — subagent transcripts are separate files). Hmm, the JSONL is the main conversation only. So "# SOW §一 tao（窗口管理）用例对照审计" in the main JSONL = either the notification result (starts with it) or my quoting of it.

If the notification result starts with "# SOW §一 tao（窗口管理）用例对照审计", extraction would keep it. It didn't. Contradiction... UNLESS the §一 result text in the notification has the header NOT at position 0 — e.g., the <result> block starts with a preamble from the agent ("文件索引（下表用短名）：" like §二's? No wait — §二's result DID start with "# SOW §二 wry...". Hmm, §二's report starts with the header. Different agents, different formats. The §一 relaunch agent used my anti-stall prompt; its report might start with "## 文件索引" or something before the title.

And the raw-grep hit "# SOW §一 tao（窗口管理）用例对照审计" — maybe that's from MY message where I quoted the header (in my turn text or thinking "§一 relaunch succeeded" I might have written the header). Looking at grep #1 output order, `# SOW §一 tao（窗口管理）用例对照审计` appears right after `# SOW 能力清单 × ohdev...` (my draft) and `# SOW §一 tao...` — these are all in the recent (post-compaction) portion = my thinking this turn. Indeed: my thinking this turn wrote "§一 report header probably '# SOW §一 tao（窗口管理）用例对照审计' etc." — I literally wrote that string in my thinking! So that grep hit is MY OWN thinking, not the report.

Ugh. So does the actual §一 report header exist in the JSONL at all? The bare `# SOW` hits with zero following chars — suspicious. Those could be occurrences where "# SOW §" has the § unicode-escaped as \u00a7! In JSON, non-ASCII CAN be escaped as \uXXXX. If the notification result string was serialized with ensure_ascii=True (some writers do), then "§" appears as \u00a7 in the raw file. My pattern `[^\\]{0,90}` stops at the backslash of \u00a7! That explains bare "# SOW" matches — they're "# SOW \u00a7\u4e00 tao..." escaped!

And json.loads DECODES them back to § properly — so the extraction script handled them correctly... but then why dropped? The [:400] filter on the decoded text — decoded text starts with "# SOW §一..." → "SOW" in b[:400] ✓ → kept!

Hmm wait, but were they even collected as blocks? The first line filter: `if "<result>" not in line: continue` — raw line contains "<result>" literally (tags aren't escaped, ASCII). ✓. Then json.loads succeeds... unless the line is huge and contains multiple records? No, JSONL = one per line. But wait — what if the §一 notification record's line FAILED json.loads (e.g., line contains raw control chars or the line is split)? `except Exception: continue` would silently skip. Hmm.

Also possible: the notifications for §一 and §六 are stored as records whose type is NOT walked properly — e.g., the task-notification user message might be stored with content as a LIST of blocks [{"type":"text","text":"..."}] — my walk handles dicts/lists ✓.

OK let me stop theorizing and empirically find where "# SOW §一" (decoded) lives. Use a python probe: scan lines containing '一' and 'result' ... simpler: search for the encoded forms. Let me grep raw for `SOW \\u00a7` — pattern `SOW \\u00a7` (backslash-u escaped). In rg pattern, to match literal backslash: `SOW \\u00a7` → regex `SOW \\u00a7` means SOW + backslash + u00a7. Write pattern as `SOW \\\\u00a7`? In the JSON tool call, I write the pattern string; regex needs `\\u00a7` to match literal \u00a7... The tool pattern `SOW \\u00a7` (double backslash in JSON source → regex `SOW \\u00a7` → matches "SOW \u00a7" literal). Hmm wait: in my tool call JSON, pattern value "SOW \\\\u00a7" would give regex `SOW \\u00a7` which matches literal `SOW \u00a7`. Let me just use pattern `SOW .u00a7` (dot matches the backslash) — simpler: `SOW .u00a7.{0,60}`.

Also try finding "§一 tao" decoded in raw: the raw UTF-8 file may have literal § (unescaped) — the earlier grep DID find "SOW §一 tao 窗口能力" (the Agent prompt) as literal UTF-8. So the file stores literal UTF-8 mostly. But some writer (maybe the notification record specifically) escapes.

Alternatively — completely different approach: give up on the JSONL archaeology for §一/§六 and check if the §六 result is reconstructible from what I know + a fresh quick probe of the report contents via different markers. Hmm.

Actually — better idea: search the JSONL for distinctive CONTENT strings that would be in the §一 report, e.g., its 统计 line "## 2. 统计（88 条）" or "88 条" or "72✅". The summary said §一: 88 = 72✅/16🟡. Let me grep raw for `统计（88` or `88 条`... Also §六: "157" markers.

Hmm, wait. Actually, let me reconsider: maybe §一 and §六 results were never delivered as <task-notification> in THIS file because those agents completed BEFORE compaction and their notifications were part of the pre-compaction transcript — which IS this same file (d7265d27...). The compaction summary said the transcript is at that path. So they're in there.

Let me look at this from the "23 blocks" angle: 23 <result> blocks found. Which notifications existed in this session? Let me count expected: §一 attempt1 (stalled — may still have produced a task-notification with status=failed/dead? A stalled agent that hits the watchdog gets killed — notification with error, possibly containing <result> with error text), §二 attempt1 (same), §一 relaunch (completed ✓ full report), §二 relaunch (just now ✓), §三 ✓, §五菜单 ✓, §五托盘 ✓, §六 ✓. That's potentially 8 notifications. Plus spurious matches from my thinking (I wrote "<result>" many times in thinking across turns — each thinking string with both <result> and 

===== BLOCK 27 len=1338 =====
 blocks it contains and the first 80 chars of each block.

Let me write a quick diagnostic:

```python
import json, re, io
src = r"...jsonl"
for idx, line in enumerate(io.open(src, encoding="utf-8", errors="replace")):
    if "<result>" not in line: continue
    try: obj = json.loads(line)
    except Exception as e:
        # find marker text raw
        tag = "PARSE-FAIL"
        ...
```

Better: for each line with <result>, decode all strings, extract result blocks, and print each block's first 100 chars (to a catalog file). That's the catalog approach from before. 23 blocks × 100 chars = tiny file. Then I'll see §一/§六 blocks' heads and can pull them by content.

Let me write catalog script:

```python
import json, re, io
src = r"C:\Users\65468\.claude\projects\D--xuqiu-tauri-3-0\d7265d27-9d89-4b6a-aab0-04727286f810.jsonl"
cat = r"C:\Users\65468\AppData\Local\Temp\claude\sow-catalog.md"
blocks = []
for line in io.open(src, encoding="utf-8", errors="replace"):
    if "<result>" not in line: continue
    try: obj = json.loads(line)
    except Exception: continue
    stack=[obj]
    while stack:
        o=stack.pop()
        if isinstance(o,dict): stack.extend(o.values())
        elif isinstance(o,list): stack.extend(o)
        elif isinstance(o,str) and "<result>" in o:
            for m in re.findall(r"<result>(.*?)

===== BLOCK 28 len=166 =====
 blocks and unescape the JSON string escapes manually. But the <result> tags appear inside JSON string values where newlines are \n escapes — raw regex `<result>(.*?)

===== BLOCK 29 len=2145 =====
 in MY OWN message text (my messages are also JSON-escaped, so any <result> I typed is stored escaped as part of string content — the tags themselves are ASCII, stored literally). Raw regex would find those too (my thinking quoted <result> tags). Same pollution either way; the catalog + selection handles it.

OK, plan: rewrite script as catalog+dump-all-blocks:
1. Parse per-line JSON (primary), fallback raw-regex per-line for parse failures.
2. Collect blocks (decoded).
3. Write catalog (index, len, first 150 chars).
4. ALSO write every block with len>3000 to individual files block-<i>.md? That's ~20 files. Simpler: write ALL blocks to one big file with "===== BLOCK i (len) =====" separators, then I grep THAT file for the §一/§六 gap rows directly (grep pattern by content: "窗口" for §一? My thinking also has 窗口...).

Hmm, the pollution problem for content-grep: my thinking blocks discuss the same topics. Distinguishing: agent reports contain markdown table rows with file:line evidence; my thinking contains meta-discussion. The grep for `^\| .*🟡` (table rows starting with |) would preferentially hit report tables! My thinking rarely has lines starting with `|`... except my drafted report table ("| 组 | 条目 |..."). Which lines start with `|`? Agent tables do; my draft has `|---|---|` etc. in the draft chunk — pollution visible but recognizable (I know my draft's content).

OK simplest robust path: dump all blocks with separators + catalog to one file; grep it for table-gap rows `^\|[^|]*\|\s*(🟡|❌|⚠️?)` — matches table rows whose verdict cell is a gap marker. My draft table rows have ✅/counts, not 🟡 in second cell... my draft has "| §一 tao 窗口管理 | 88 | 72 | 16 | 0 | 0 |" — no 🟡 marker cells. Good. Also grep `统计（` lines and `^# SOW` headers with block context.

Let me write script v2 now. Also — dedup: notification may be recorded twice (summary + message). Dedup by first 200 chars.

Script:

```python
import json, re, io

src = r"C:\Users\65468\.claude\projects\D--xuqiu-tauri-3-0\d7265d27-9d89-4b6a-aab0-04727286f810.jsonl"
out = r"C:\Users\65468\AppData\Local\Temp\claude\sow-blocks.md"
pat = re.compile(r"<result>(.*?)