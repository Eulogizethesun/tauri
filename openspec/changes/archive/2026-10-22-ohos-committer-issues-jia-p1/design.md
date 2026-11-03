# Design: ohos-committer-issues-jia-p1

## Context

### 任务与证据基线

本 phase = roadmap Phase 1:38 条对账 + 第 0 波文档/披露批 + 基线重锚。设计期完成的取证基线(2026-10-20):

- 四仓 HEAD:tao `d42e8950` / wry `8e381e6` / openharmony-ability `5c4b5a9` / tauri `f6bb0889f`,分支统一 ohdev,工作面干净(仅未跟踪构建产物 + tauri schema.json churn,约束 5 过滤)。
- 权威方案:`D:\xuqiu\tauri-3.0\COMMITTER-ISSUES-168-236.md`(下称 md);批次报告 `.tmp/issue-scan/agent-reports/{tao-1,tao-2,wry-1,wry-2,tauri-cli}.md`;issue 正文 `.tmp/issue-scan/issues/*.md`。
- BUILD-INFO 三 change 归档产物(tauri 仓 `openspec/changes/archive/2026-10-20-*`)已通读:cursor-passthrough(#179/#180 相关)、webview-sizing(#185/#198 相关)、iframe-ipc(仅 core.js 单文件,#180 事件路由域零交叠——设计期排除)。
- 设计期取证方式:git show 归因 + HEAD file:line 重开比对 + 全仓 grep 反证(与任务期 D1 方法论同源)。

### 范围对齐(md 第 0 波 → 本 phase 文档批条目)

md 第 0 波甲侧文档批 = tao #170/#171/#172/#175/#176/#177/#182/#183/#169(latch 注释半);wry #185/#187/#193(披露半)/#196/#197;OHA #223(乙域,不在本 roadmap);tauri #228。roadmap 另把 #179(披露半)与 #185(文案刷新)列入待对账落定——经 D3 对账,#179/#185/#196 三条**文档已闭合**,零必需改动。最终文档批 = **tao 9 条 + ability 1 条(#170 半)+ wry 3 条 + tauri 1 条(#228)+ test-mapping 矛盾行 = 14 个施工条目**。

## D1: 对账方法论与三态判定规则(任务期扫表的唯一依据)

### 证据链四步(沿用 10-12 复核轮,md §一 方法论)

1. **git show 归因**:对每条 issue 的诉求锚点,用 `git log --oneline -S "<诉求符号/注释关键句>" -- <file>` 与 `git log -L <fn>` 追溯行为/文本的引入与变更 commit;把 commit 映射到轨道(底座 PR 复核轨道 / BUILD-INFO 三 change / 09 月多 UIAbility·多屏等既有修复 / 无=未动)。
2. **file:line 重开比对**:10-12 锚点(roadmap 条目与 md 中的行号)一律**重 derive**,不照抄(scope 锚纪律,约束 11);行号漂移在 ledger 备注列记「锚点 N→M」。
3. **SDK d.ts 落证**:B 类(平台限制)判定必须闭合到本地 SDK 类型声明(`D:/Sdk/20/ets/...`,按 10-12 轮先例),凡「平台无 API」断言都要有声明级引证;SDK 副本行号漂移只证字段事实不变形即可(cursor-passthrough design 先例)。
4. **反证 grep**:对「未动」判定,必须给出「全链无相关实现」的 grep 证据(符号零命中),不得以「报告没提」替代。

### 三态判定规则

| 判定 | 充要条件 | 动作 |
|---|---|---|
| **已修** | issue 诉求的可观察行为/文档在 HEAD 存在,且可归因到具体 commit(file:line + commit 双证据);残差子项为空 | 登记轨道+commit;**不进 p2/p3**;若 issue 未回复,记「回复素材」列(回复本身排除,澄清决策 2) |
| **残差** | 部分子项落地、部分未落地;逐子项列明 | 落地子项登记证据;剩余子项按 md 波次归属标注去向(p1 文档批 / p2 S / p3 M / 第 3 波专项) |
| **未动** | HEAD 与 09-10 快照在诉求面无差异(反证 grep 佐证) | 按 md 波次归属进 p2/p3;ledger 预填「待任务核验(预判未动)」,任务期落证后转正 |

### 防误判护栏(roadmap 关键风险的对策落点)

- 「已修」必须双证据(commit + HEAD file:line),单证据降级为「残差(存疑)」并升级 PM 仲裁。
- 「未动」必须附反证 grep 命令与零命中输出摘录。
- 多部件条目(#168/#180/#188/#190/#193/#225 等 md 带 ①②③/披露-实现拆分的)按**子项粒度**判定,整条判定取「残差」并在子项列展开;禁止整条打「已修」。
- 判定与 md 冲突时(md 判 X、HEAD 证据判 Y):以 HEAD 证据为准,ledger 备注列记冲突 + 设计 D4 的既有纠偏先例;影响 p2/p3 scope 的变化汇总进 ledger 尾部「scope 影响清单」,由 PM 更新 roadmap(澄清决策 7)。

## D2: 对账表产物形态

- **落点**:`openspec/changes/ohos-committer-issues-jia-p1/reconciliation-ledger.md`(随 change 归档,供 p2/p3 设计与后续回复直接引用)。
- **列 schema**(9 列):`#` | `主题` | `落点仓` | `10-12 判定(md 原判定+定性+量级)` | `md 波次归属` | `HEAD 判定(已修/残差/未动)` | `HEAD 证据(file:line + commit;未动条目附反证 grep)` | `残差去向` | `备注/回复素材要点`。
- **预置策略**:设计期已预填 38 行骨架——md 判定列全量预填(取 md §二 总表),四簇行(#168/#179/#180/#185/#198)与设计期取证覆盖行(#169/#170/#171/#172/#175/#176/#177/#182/#183/#187/#193/#196/#197/#228/#173/#184)的 HEAD 判定与证据列已落;其余行 HEAD 列标「待任务核验(预判未动)」+ 预判依据。
- **汇总节**(ledger 尾):①统计行(已修 X / 残差 Y / 未动 Z);②**p2/p3 scope 影响清单**(相对 roadmap Phase 2/3 条目的增删改,PM 回写 roadmap 的输入);③基线重锚记录节(D6);④回复素材索引(标注「排除,澄清决策 2」)。
- ledger 是过程产物不是 spec:不进 `openspec/specs/`,不参与 validate(除 change 级文件完整性)。

## D3: 四簇证据级对账结论(决定 p2/p3 scope 与文档批文案)

> 四仓 HEAD 现场取证,commit 均已 `git show --stat` 核验。每条结论给「已落地面 / 残差面 / 对 p2/p3 的裁定」。

### #168 创建期参数仅部分读取(tao+ability+tauri)→ **残差:几何面已修,参数面按 md 分层保持**

**已落地面(几何)**:

| 仓 | commit | 证据 |
|---|---|---|
| tao | `15491f9d` + `823318fa` | `start_options_geometry`(`tao/src/platform_impl/ohos/window.rs:405-413`,逻辑 px→物理 px 换算 + 单测 :2090-2130);UIAbility spawn 分支消费 builder `inner_size/position` 经 StartOptions `windowWidth/Height/Left/Top` 下发(:573-598,含 T26-N3 官方约束注释:free windows only / display-local 坐标 / WM clamp);Float 分支 `WindowCreateParams` 携带 width/height/x/y/decorations/transparent/background_color(:645-665) |
| ability | `d7e8e3a0` | `crates/plugin-app-control/src/lib.rs` + `AppControlPlugin.ets` start-ui-ability 通道透传几何 |
| tauri | `1a34b6b97` | runtime-wry 创建失败传播 + examples/api 创建期几何断言用例(window-ops.ts +25 行) |

**残差面(参数)**:设计期反证 grep——`platform_impl/ohos/window.rs` 对 `window_attrs.fullscreen / maximized / focus / visible` **零消费**(0 命中);主窗(UIAbility spawn)分支无 decorations 通道(StartOptions 不含);Float 分支 decorations 虽携带但 ArkTS 消费面待任务核验。与 issue 正文自陈「生效的:decorations(双路径,主窗口创建期即时应用)」的出入(resizable/minimizable 等)由任务期按 D1 逐参数落证。

**裁定**:p3 #168 条目**保留**,但 scope 明确「几何面不重做」;分层顺序(md:播种 S → 补发 M → 披露)不变;visible 按 md 判 B(创建期隐藏不可达)披露方向。文档批无 #168 条目(其披露归 p3 收尾)。

### #179 cursorPosition 全局单源(tao+ability)→ **已修:两半均落地,剔除 p3 M 档,披露零新增**

**已落地面**:

| 子项 | 证据 |
|---|---|
| FloatPage onMouse(M 档) | `FloatPage.ets:635-659` 根 Stack 挂 onMouse 调 `feedCursorFromMouse`(commit `baf4f3f9`,29 行);helper `cursor_feed.ets` 新建(`baf4f3f9` + 审计打磨 `ac911c2`) |
| 屏幕全局系 + Err 契约 | `app.rs` EVER_FED/`cursor_position_with`(`baf4f3f9`);tao `cursor_position_from_app` → `Err(NotSupported)`(`d42e8950`) |
| 披露半 | `tao/src/window.rs:1376-1381` cursor_position doc 已载「fed by the ArkTS onMouse handlers (screen-global frame); before any feed the call fails with Err(NotSupported)」(`d42e8950` 携带) |

**裁定**:md 第 0 波把 #179 披露半列在「muda/tray」批——**落定:落点仓 = tao,且披露文案已由 `d42e8950` 承载,muda/tray-icon 零动作,无需知会乙**(roadmap「落点仓由对账表显式落定」的答案)。p3 条目「#179 M 档(FloatPage onMouse)视 p1 对账:若 cursor feed 轨道已覆盖则剔除」→ **剔除**。剩余唯一动作 = issue 回复(排除),回复素材要点记 ledger。

### #180 Focused/ScaleFactorChanged 硬编码主窗(tao)→ **残差:核心已修,两项残差实证在,维持 p3**

**已落地面**:Focused 按 per-UIAbility-instance 路由——`event_loop.rs:1040-1070`(注释「route by the gaining instance's window id … HAS_FOCUS stays a single app-level bit」),`handle_gained_focus`(:731-796)派发 `Focused(true)`,:1062-1069 派发 `Focused(false)`;来源链 `lifecycle.rs:195-198`(StageEventType Active/Inactive → Gained/LostFocus)。ScaleFactorChanged 广播到全部存活窗口(:1071-1107,`live_window_ids` :182-198)。

**残差面(设计期实证)**:

1. **Float 子窗无焦点通道**:`Gained/LostFocus` 只来自 UIAbility stage 事件;Float 子窗(同 UIAbility 内 ArkTS sub-window)焦点变化不产生任何事件——ability 全仓 grep `windowFocusChange|onWindowFocusChange|focusChange` **零命中**(子窗焦点链根本未桥接);`is_focused` 读 app 级 `HAS_FOCUS` 单位(`window.rs:1292-1305`,注释「NOT per-window (O10-5)」)。
2. **ScaleFactorChanged 无去噪**:每次 `ConfigChanged` 无条件逐窗重发当前 scale,**无变化沿检测**(全 tao 无 LAST_SCALE 类状态);同文件 ThemeChanged 已有现成沿检测模板(:1119-1126,`LAST_EFFECTIVE_THEME.swap` + `prev_bits != theme_bits`)。

**裁定**:p3 #180①(Float 焦点接通,依赖 p2 #173 前置基建)+ scale 去噪(S 半)**保留**;#173 的 10-12 修法(「WindowStateMirror 加 focused 位」)经核 mirror 现仅 visible/fullscreen/maximized/minimized 四位(`window.rs:89-100`),focused 位方案仍成立。

### #185 setBounds 宽高丢弃 + #198 setBounds Physical 不换算(wry+ability+tauri)→ **#185 已修零缺口;#198 残差收窄为实现侧**

**#185 已落地面**(webview-sizing 轨道,超出原「披露」方案按实现修复):wry `8e381e6`(bounds()/set_bounds doc 增「Render semantics (openspec ohos-webview-sizing)」段,`src/ohos/mod.rs:1127-1134`)+ ability `5c4b5a9`(ArkTS 渲染层 Stack wrapper + AttributeUpdater 全几何消费,`WebviewPlugin.ets:2771-2803` 注释自陈推翻「intentionally ignored」)+ tauri `dd4956b63`(runtime-wry 注释改写 + 探针用例)。全仓 grep "intentionally ignored" 在 wry/tauri 已零命中。

**#198 残差面**:`set_bounds` 仍 `to_logical::<f64>(1.0)`(`mod.rs:1140-1141`,scale=1 硬编码);ability/wry 全链 `virtualPixelRatio` **零命中**。披露半已落:bounds() doc unit contract 段明示「physical px == vp (scale factor 1) assumption … needs an explicit decision before reuse」——即 md p3 计划里的「mod.rs 失准注释更正」**已由 `8e381e6` 完成**。

**裁定**:#185 从 p1 文档批**剔除**(回复素材);#198 的 p3 scope **收窄为实现侧**(ability 暴露 virtualPixelRatio → wry 接入,Logical 链路零变化),文档半不再列 p3 任务;真机 vp 标定保持。

## D4: 设计期 scope 锚纠偏清单(约束 11 的运行实例,ledger 预置行已采用)

| 条目 | 10-12 锚(roadmap/md) | HEAD 现场纠偏 |
|---|---|---|
| #184 | 「OnceLock→Mutex<Option<WindowClient>>」 | tao **无 OnceLock**;一次性语义 = `window_client: Option<WindowClient>` 字段在 `Window::new` 一次捕获(`window.rs:270`,`:719-732` 失败即 warn+None,`:848-853` `bridge_client()` 无补取路径)。p2 修法适配为「失败后懒补取 + 成功覆盖」,锚点行号全部重 derive |
| #169 | 「UIABILITY_CREATED latch 不复位(window.rs:1605-1619)」 | 旧 `UIABILITY_CREATED` 已被 `FIRST_WINDOW_CREATED` 取代(`window.rs:67` 注释自证);新语义下「后续 UIAbility 合法」,latch 残差 = 注释声明 process-lifetime 语义(声明处 :69,Drop :2002-2014 仅注销 mirror) |
| #170 | 「tao facade :744-748/:777-781」 | 漂移至 :757-761/:789-793(58ad4377 引入后未动);且 issue 关联的「测试映射文档」=`tauri/doc/ohos-window-test-mapping.md`(窗口位置/大小两行 :23-24 与 :72-73 矛盾实锤) |
| #196 | 「window.open features 披露待补」 | **文档已闭合**:wry `lib.rs:1360-1368` 已有 OHOS 行(size/position 恒 None;Create 按 Deny 处理);p1 零必需改动 |
| #185 | 「披露+注释(S)」 | 按 D3 升格为「已修,零缺口」 |
| #172 | 「tao/src/window.rs:1283-1287」 | 漂移至 :1295-1297(set_cursor_position)/:1310-1312(set_cursor_grab) |

## D5: 文档批逐条目落点与文案要点(行号为 2026-10-20 HEAD 设计锚,实现期重 derive 后允许 ±5 内漂移,超界须回报)

### tao(单 commit;tao/src/window.rs 为主战场 + platform_impl/ohos 两文件)

| 条目 | 落点(file:line) | 动作与文案要点 |
|---|---|---|
| #169 | `src/platform_impl/ohos/window.rs:69`(FIRST_WINDOW_CREATED 声明处) | 注释 +3 行:process-lifetime bootstrap 标记,**窗口 Drop 不复位**(Drop 仅注销 mirror,:2002-2014)系有意——首窗必须 UIAbility(D2 latch,:458-470);后续窗口 kind 缺省 Float,显式 UIAbility 仍合法 |
| #170 | `src/window.rs:757-761`(set_outer_position doc)、`:789-793`(set_inner_size doc) | 两处失实注释重写。现状文本宣称「moveWindowTo()/resize() 返回 1300002,主窗静默 no-op」——与实现不符:派发链无条件(`set_outer_position`→`move_window_to` ohos/window.rs:1086;`set_inner_size`→`resize_window` :1015,decor 精确补偿随 #97)。更正要点:①主窗几何派发**会执行**;②resize 受系统约束钳制(自由窗口 WM),非 no-op;③move 派发成功但效果从 JS 不可靠读回(window_rect 回调不随纯 move 触发,test-mapping #143 smoke 注);④1300002 仅在窗口状态异常时瞬时出现,非必然结果。注释同步引用 `tauri/doc/ohos-window-test-mapping.md` |
| #171 | `src/platform_impl/ohos/window.rs:1537` + `src/window.rs:1132-1136` | 空实现体加一行 `log::warn!("[tao-ohos] set_always_on_bottom is not supported on OHOS; call ignored")`(对齐 iOS 先例);facade Platform-specific 补 **OHOS 行**(Unsupported——no-op 并 warn 一条日志;builder `with_always_on_bottom` doc :511-517 可选同步) |
| #172 | `src/window.rs:1295-1297`、`:1310-1312` | set_cursor_position 补 OHOS 行(恒 `Err(NotSupported)`,impl :1764-1768);set_cursor_grab 补 OHOS 行(API 22+,`OH_WindowManager_LockCursor` 经 dlopen,confined-follow,仅获焦生效、失焦自动解锁需 re-grab——impl :1636-1642 注释现成,提到 facade 公开文档) |
| #175 | `src/window.rs:1186-1189` | Platform-specific 补 OHOS 行(Unsupported——静默 no-op,与上游 iOS/Android 一致;OHOS 无任务栏进度概念。facade body 对 OHOS 已 cfg 编译出,ohos impl 无此 fn,文档须言明) |
| #176 | `src/window.rs:1255-1258` | Platform-specific 补 OHOS 行(Unsupported no-op;OHOS 无多工作区概念) |
| #177 | `src/window.rs:1139-1148`(set_always_on_top)、`:909-913`(is_always_on_top) | 两处各补 OHOS 行:set 记录 intent 位并派发 `setWindowTopmost`(API 14+,需 `ohos.permission.WINDOW_TOPMOST`),仅 freeform 窗口形态生效、主窗专用(Float 报错被 ArkTS 捕获 warn 非致命);is 读 intent 位**非系统真值**(与实际 z-order 脱节)。impl 内部注释(:1539-1560)已有全部语义,本条目是把它提到公开 facade 文档 |
| #182 | `src/window.rs:1085-1097` | Platform-specific 补 OHOS 行(两种 Fullscreen 变体折叠为同一沉浸式布尔开关;`fullscreen()` 恒回 `Borderless(None)`,无独占全屏概念;不做 intent 回读防新失真) |
| #183 | `src/platform_impl/ohos/monitor.rs:116-120` | video_modes 注释扩行:返回单一「当前模式」项——SDK 无 per-display 模式列表与色深 API(bit_depth 恒 32 已有注释);多屏枚举/尺寸/刷新率真值已由 #106 落地(monitor.rs 既有注释引用 ohos-monitor-real-values)。公开 facade doc(重 derive 共享 doc 位置)如无 Platform-specific 段则以 impl 注释为披露位 |
| #179 | — | 零代码(台账登记,见 D3) |

### ability(单 commit;#170 的 ArkTS 半,两份副本同步)

| 条目 | 落点 | 动作与文案要点 |
|---|---|---|
| #170 | `native_ability/src/main/ets/window/WindowManager.ets:305-306` + `package/src/main/ets/window/WindowManager.ets:305-306` | isUIAbilityMainWindow 上方注释中「win.resize()/moveWindowTo() return 1300002」失实句更正(与 tao facade 同一事实基:派发会执行、效果受 WM 管理约束);**两份副本同步改**(约束 4;grep 确认 1300002 失实句仅此一处成对出现,:614/:743/:1974 的错误码枚举注释不属失实,不动) |

### wry(单 commit;全部在 src/lib.rs 公开文档)

| 条目 | 落点(file:line) | 动作与文案要点 |
|---|---|---|
| #187 | `src/lib.rs:1978-1990`(with_https_scheme)、`:1111-1139`(with_asynchronous_custom_protocol) | 各补 OHOS 行:use_https 拦截通道仅支持同步 respond——异步 handler 的结果被丢弃并 passthrough 放行(`src/ohos/mod.rs:1357-1370` None 分支行为);异步 handler 须走原生 scheme 路径。注意 :1111-1139 现有示例恰是 `thread::spawn` 异步 respond,OHOS 行须警示该示例在 use_https 形态正中丢弃场景 |
| #193 | `src/lib.rs:1184-1197`(with_drag_drop_handler);可选 `:2299-2321`(DragDropEvent 变体) | Platform-specific 补 OHOS 段,三点(纠偏后语义):①四类 handler 的 bool 返回被忽略——**但默认 drop 行为并非"阻止不了"**:ArkTS `onLoadIntercept` 对 file:// drop 恒拦截并转发为 drag-drop 事件(`WebviewPlugin.ets:1757-1763`,默认导航已被阻止);②`Enter` 事件 paths 恒空,仅 `Drop` 携带 paths(`src/ohos/mod.rs:483/:495`);③不支持经 bool 放行默认行为。「纠偏限于仓内文档方向修正」(roadmap 明文),GitHub 回复不在本批 |
| #197 | `src/lib.rs:1023-1026`(with_initialization_script_for_main_only) | Platform-specific 补 OHOS 行:scripts 经 ArkWeb ScriptItem 注入所有匹配 scriptRules(`"*"` + 注册 scheme,`src/ohos/mod.rs:625-631`)的框架,`for_main_frame_only` 被忽略(:658-660 注释自陈);file:// 是否被 `"*"` 覆盖未验证,留真机探针(不随本批) |
| #185 / #196 | — | 零必需改动(D3/D4)。可选增值(同 commit 顺手,不计入验收):#196 `NewWindowResponse::Create` 变体 doc(:481-505)重复一句 OHOS;#185 `set_bounds` doc(:2268-2274)补「OHOS 应用全几何,自然布局 webview 首次 set_bounds 翻转显式尺寸」 |

### tauri(两个 commit:代码 doc 一个 + openspec 产物一个)

| 条目 | 落点(file:line) | 动作与文案要点 |
|---|---|---|
| #228 | `crates/tauri/src/window/mod.rs:2220-2223`、`crates/tauri/src/webview/webview_window.rs:2100-2103` | 两处 set_effects 的 Platform-specific 各补 OHOS 行:仅 `Blur`/`Acrylic` 生效(`src/vibrancy/ohos.rs:38-56` 实锤:Mica/Tabbed 六变体 info 日志后跳过;macOS 专有效果按基础 blur 近似;需窗口 transparent) |
| #170 关联 | `doc/ohos-window-test-mapping.md:23-24` | 窗口位置/大小两行与 :72-73 实测记录矛盾消解(按 :72-73 事实更正),随 tauri commit ① |

## D6: 基线重锚口径与判据

- **设备/命令**:MateBook Pro(HAD-W32,desktop 真机;1015 报告 provenance SN `3QC0124C11000038`,执行期 `hdc list targets` 复核)。命令 `.claude/skills/ohos-build/scripts/run-tests.sh <SN> desktop`(脚本自带 HAR 重建→build→install→launch→report 拉取)。
- **口径统一规则**(消除 313/314/311 漂移):基线数字 ≡ **report 文件表格行数计的用例总数**(含 auto/manual/smoke 全类别),表述为 `N 例(M✅/K⏭/J❌)`;判跑完 = report footer `*Report generated at end of test run.*`(约束 6);报告 provenance 须记当次 HEAD sha。参考系:1015 报告(1a34b6b97+脏)= 314 例,BUILD-INFO 三 change 又新增 cursor-position-freshness / viewport 探针 / iframe 路由用例,预期新基线 >314,以实跑为准。
- **干净基线要求**:❌ 预期 0;若出现 ❌,先归因(残留窗吃点击→重启套件进程复跑;真回归→停,升级 PM),**不得带 ❌ 记基线**。跑前禁 `hilog -r`(约束 10),按残留窗排查配方列窗确认。
- **产物**:report 落 `examples/api/device-report-<MMDD>-desktop.md`;计数与路径记入 ledger「基线重锚记录」节。
- **回写**:master roadmap p2 SC3「313 例回归不低于基线(307✅/6⏭)」、p3 SC2「313 例回归零新增 ❌」与 Phase 表验证方式列的 313 口径,统一替换为新数字+报告文件引用;回写动作归本 phase 任务,完成后 PM 知会(澄清决策 7;数字回写属机械同步,scope 变更才需 PM 改 Phase Details)。

## D7: commit 切分、构建验证与 ArkTS 注释/HAR 边界

### commit 计划(分支 ohdev;**全部不 push**,禁 GitHub 回复)

| 仓 | commit | 内容 |
|---|---|---|
| tao | 1 | #169/#170(半)/#171/#172/#175/#176/#177/#182/#183 文档批(docs(ohos)) |
| openharmony-ability | 1 | #170(半)WindowManager.ets 两副本注释更正(docs(ohos)) |
| wry | 1 | #187/#193/#197 文档批(docs(ohos);可选增值行随同) |
| tauri | 2 | ①#228 两处 doc + test-mapping 矛盾行(docs(ohos));②openspec p1 change 产物 + 主 spec 规范化 + roadmap 基线回写(chore(openspec)) |

### 构建验证(验收门槛,非提交门槛)

- tao:`cargo check`(host)+ `cargo check --lib --target aarch64-unknown-linux-ohos`(镜像 cursor-passthrough 先例);wry:同双路;ability:`cargo check --target aarch64-unknown-linux-ohos`(crates 面;ArkTS 注释不涉 cargo);tauri:`cargo check -p tauri -p tauri-runtime-wry`。四路零 error。
- `openspec validate --strict`:change 四产物 + delta 通过(主 spec 规范化为前置,见 R7/task 7.1)。

### ArkTS 注释改动与 HAR 重打的边界裁定

约束 2(凡动 ArkTS 须清 oh_modules+CompileArkTS+重打 HAR)的立法目的 = 防「行为修复被旧 HAR 缓存吞掉」的无效假象。本 phase ability 侧改动为**纯注释行、零行为变更、零设备验证依赖**(验收走 grep/diff 审计,不走上机)——裁定:**不触发 HAR 重打/设备部署**,注释随仓 commit 进入源,下次任何行为波构建时自然生效;p2/p3 行为波按约束 2 全链执行。此裁定记入 ledger 备注,防后续审计误判「漏重打」。

## D8: 跨 phase 架构约束继承映射(11 条逐条)

1. cfg 隔离铁律:#171 warn 落 `platform_impl/ohos/window.rs`(ohos-only 文件),facade 侧不新增 cfg;其余纯文档不触 cfg。✔
2. ArkTS→清缓存+重打 HAR:本 phase 按裁定豁免(纯注释,见 D7);两份 WindowManager.ets 副本同步落。✔(带裁定注记)
3. NAPI 契约两端同步:本 phase 零 NAPI 面。✔
4. 三处副本同步:#170 注释 native_ability+package 两副本成对改(窗口插件 ArkTS 源仅两份实体,plugins 侧无第三份,grep 实证)。✔
5. 构建 churn 过滤:tauri 仓现存 schema.json 4 文件 churn 不入任何 commit;`openharmony/.tauri/`、ability.har、profraw/target-cov 均为未跟踪产物,commit 时显式点名文件(禁 `git add -A`)。✔
6. 新用例随波并入+AppManifest 四处:本 phase 零新命令零新用例;基线重锚遵守 report footer 判据。✔
7. 桥接语义铁律(禁 recv_timeout/block_on 族):本 phase 零桥接改动;对账时若发现某条目残差涉及该域,ledger 标注供 p2/p3 设计避让。✔
8. 回复纪律:ledger 专设「回复素材要点」列(附 HEAD 证据),#193 纠偏等五处正文失实的纠偏素材从 diff 现场 derive;回复动作本身排除。✔
9. 分支与推送:ohdev;origin-tauri 禁提交;不 push;不动 MenuBarComponent.ets(#231×#205 冲突对,p1 本就不涉)。✔
10. 设备纪律:基线跑前禁 hilog -r;Bash 显式绝对 cd(多仓跳转,脚本用绝对路径调用)。✔
11. scope 锚纪律:全部锚点 HEAD 重 derive(成果见 D4 纠偏清单);D5 行号为设计锚,实现期重 derive 允许 ±5 漂移,超界回报。✔

## Risks / Trade-offs

- [R1 对账误判「已修→未动」导致 p2/p3 重复实现] → D1 防误判护栏(双证据 + 反证 grep + 子项粒度);四簇已由设计定调,风险集中于 34 条中的多部件条目,ledger 抽检(任务 1.5)兜底。
- [R2 文档批把注释改错方向(如 #170 改成过度承诺「主窗 move 完全可靠」)] → 文案要点已按实测定调(test-mapping :72-73 的「效果不可靠读回」事实必须保留);#170 注释重写后须与 test-mapping 两行矛盾消解同步(任务 5.2)。
- [R3 基线跑受环境干扰(残留窗/签名/hap 陈旧 ABI)] → D6 干净基线要求 + 残留窗排查配方;fat hap ABI 累积陷阱(单 target 构建不刷另一 ABI libs)——desktop 单 target 面不受影响,若复用 mobile 包则必须重建。
- [R4 行号锚漂移超界] → D5 允许 ±5;超界(结构变化)触发「重 derive 并回报」,禁止按旧锚硬插。
- [R5 ledger 预置行的「预判未动」被任务期推翻] → 允许且预期(纠偏进 scope 影响清单);预判仅为效率优化不构成判定。
- [R6 tao #171 warn 触发套件噪声] → 套件现无 setAlwaysOnBottom 调用路径(setter 无用例),零翻红预期;若后续波引入,warning 级不改变用例结果。
- [R7 主 spec `openspec/specs/ohos-platform-limitations/spec.md` 存在既有结构破损(validate --strict 实证:`## ADDED Requirements` 头误用于主 spec、尾部两组游离 Requirement 在解析主节之外——**归档将拒收任何指向该 capability 的 delta,非本 change 引入**)] → 任务 7.1 机械规范化(头改 `## Requirements`、游离节收拢,内容零删改,PM 校验 diff 仅见标题层级);若 PM 裁定主 spec 修复不属本 phase,则本 change 的 delta 归档改挂新 capability(升级 PM 决策,当前按规范化路径设计)。

## Test Design

### 验收标准(roadmap SC × 本设计细化)

1. **对账表 38/38**:ledger 每行 HEAD 判定列非空且属三态之一;证据列非空(已修/残差=commit+file:line;未动=反证 grep);四簇行与 D3 结论一致;汇总节统计 + scope 影响清单 + 基线记录 + 回复素材索引四节齐备。**抽检**:审计者按 D1 方法对随机 6 条(每仓至少 1、必含 1 条「未动」、1 条多部件)重开复核,零翻车。
2. **基线重锚**:report 文件落盘且 footer 判据成立、provenance 记 HEAD;ledger 基线节含 N/M/K/J 计数;master roadmap p2/p3 硬门槛数字已替换且与 report 一致;PM 知会留痕。
3. **文档批**:14 个施工条目逐条落点命中(D5 表);cargo check 四路零 error;`openspec validate --strict` 通过(以任务 7.1 主 spec 规范化为前置)。
4. **零行为变更**:`git diff` 审计——Rust 侧仅注释/doc 行 + #171 恰一行 `log::warn!`;ArkTS 侧两副本 diff 对称且仅注释行;无签名/逻辑/依赖变化(Cargo.toml 零 diff、无新增 use/impl 块);tauri commit ② 限 openspec/ 与 roadmap 文件。

### Spec → 验证映射

specs delta 全部为「披露 SHALL 存在」型契约,验证 = 代码走查/grep(任务 7.4):每条 Requirement 的 Scenario 对应 D5 表一行,验收判据 = 对应落点存在含指定语义关键词的 OHOS 行(如 tao facade set_always_on_bottom doc 命中 `OHOS` + `Unsupported`/`warn`)。无设备用例、无 Rust UT(零行为变更,无新增可测行为面);基线重锚是本 phase 唯一设备任务(D6)。

### 测试基础设施

- Fixtures:无。Shared:既有 run-tests.sh 流程、残留窗排查配方、git 取证命令集(均项目内先例)。外部依赖:无新增。

## Task Signals

tags: [ohos]
routed_skills: [rust-ohos]

(PB-C:tao/wry 图谱已建(9130/4945 节点),设计期取证以直接 Read/grep 源码完成,未依赖图谱查询;ability/tauri 图谱构建中。四簇与文档批锚点全部 HEAD 现场落证,不依赖 10-12 快照。)
