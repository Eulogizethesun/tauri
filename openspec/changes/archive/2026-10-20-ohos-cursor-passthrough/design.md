# Design: ohos-cursor-passthrough

## Context

### 现场与根因

消费方 zhkt60(HarmonyOS PC 2in1,`com.example.tauri_hello_ohos` 6.0.0)工具栏 = 全屏透明 Float 子窗 + `set_ignore_cursor_events` 穿透 + app 侧轮询命中测试(读 `cursor_position()`,按**屏幕全局坐标**减工具栏窗全局原点)。真机:渲染正常、点击无反应。现场:`D:\支撑Task\zhkt60-6.0.0-20261019\BUILD-INFO.md`。

两条根因均已在源码实证:

1. **喂入源单一**:Rust 侧光标快照只由 `MainPage.ets:222-232` 的 `onMouse`(Move/Press)经 NAPI `update_cursor_position` 喂入(`openharmony-ability/crates/ability/src/app.rs:1272-1276`)。Float 子窗宿主 `FloatPage.ets`(经 `WindowManager.createSubWindow` → `loadContentByName(FloatPage.RouteName)` 承载所有子窗)全文无 `onMouse`——光标在子窗上时无任何喂入,快照停在最后一次主窗坐标。
2. **坐标系错位**:喂入值是 MainPage 组件相对 vp;tao 上游 `Window::cursor_position` 语义是**全局屏幕物理 px**(Windows 实现直调 `GetCursorPos`,`tao/src/platform_impl/windows/window.rs:503`);OHOS 实现把组件相对值乘 scale 当全局值读出(`app.rs:952-958`)——两头不靠。

系统级替代路径不可用:公共 SDK `@ohos.multimodalInput.pointer.d.ts` 仅导出 setPointerStyle/getPointerStyle/setPointerVisible/isPointerVisible/setCustomCursor 族(本地 SDK 类型声明直读),无 `getPointerLocation`;ArkUI 事件喂入是唯一数据源。

### 关键 SDK 事实(本地 SDK 类型声明直读;行号按本机副本 `D:/Sdk/20/ets/ets1.1/component/common.d.ts` 逐条复核——原引用行号属另一 SDK 副本,字段事实经本机副本再证不变形)

ArkUI `MouseEvent`(即 `onMouse` 回调参数,接口声明 `common.d.ts:11199-11320`)自带三层坐标:

| 字段 | 参照系 | 说明 |
|---|---|---|
| `x` / `y` | 命中组件左上角 | 现 MainPage 喂入源(根因二来源) |
| `windowX` / `windowY` | 所在应用窗口左上角 | 备选 |
| `displayX` / `displayY` | **设备屏幕左上角** | 本设计采用的主喂入源(since 10 必填) |
| `globalDisplayX` / `globalDisplayY` | 全局显示(多显示器) | since 20,optional,版本守卫下优先采用 |

`onMouse` 本身是**鼠标指针语义**(`common.d.ts:21776-21784`「Triggered when the component is clicked by a mouse button or the mouse pointer moves on the component」)——注入式测试的刺激必须走**鼠标注入**而非触摸注入(触摸注入是否合成 onMouse 无项目先例可证,见 Test Design「注入刺激与地面真值」)。since-10 层文档措辞「device screen」与 since-11 层措辞「application screen」并存,即 R1 记录的措辞漂移。

公共 SDK `@ohos.multimodalInput.pointer.d.ts` 无 `getPointerLocation`(仅 style/visible/custom-cursor 族)——系统级轮询读光标在消费方设备(非系统应用)上不可用,事件喂入是唯一路径。

### 既有链路(本 change 不动其结构)

- 穿透链:`set_ignore_cursor_events(ignore)` → tao `window.rs:1774-1806` 取反 → `WindowClient.set_window_touchable` facade → ArkTS `WindowPlugin.ets:770` → `win.setWindowTouchable`。fire-and-forget,行为不变。
- 读出链:tao `Window::cursor_position` / `EventLoopWindowTarget::cursor_position` → `cursor_position_from_app`(`tao/src/platform_impl/ohos/event_loop.rs:266-271`)→ `OpenHarmonyApp::cursor_position`(vp × scale)→ tauri-runtime-wry(`lib.rs:3513-3522`,tao Err → `Error::FailedToGetCursorPosition`)→ tauri `getter!` 命令(`window/plugin.rs:22-29`,Err → 命令 Err)→ JS `cursorPosition()` reject。
- 喂入链:ArkTS `onMouse` → NAPI `update_cursor_position(x, y)`(`#[napi]` 自动 camelCase → `updateCursorPosition`)→ `CURSOR_POSITION_X/Y` AtomicU64(f64 位打包)。

## Goals / Non-Goals

**Goals:**

- 修复根因一:所有 runtime 创建的窗口(主窗 MainPage + Float 子窗 FloatPage)的鼠标 Move/Press 都喂入光标快照——非主窗上坐标新鲜。
- 修复根因二:喂入源换为屏幕全局系(`displayX/displayY`),`cursor_position()` 读数对齐 tao 上游「全局屏幕物理 px」语义,消费方既有命中测试(按全局坐标写)数据变对即工作。
- fail-safe 契约(B 纪律的 runtime 化):未跟踪态(从未喂入)全链返回 Err 直至 JS reject;app 侧纪律「读不到/不可信 → 一律 `ignore=true`」文档化 + 用例化。
- 红灯用例先行:子窗坐标新鲜度(真语义断言)在当前 HEAD 上必须失败。

**Non-Goals:**

- 不采纳方向 B 的「按 `snapshot.interactive` 并集矩形收窗几何」进 runtime(裁定见 D0;作为 app 侧备选记录,当 R1 真机否定 `displayX` 语义时是 fallback 路径)。
- 不做时长衰减 staleness(「超过 N 秒未喂即不可信」)——D4 论证其对该模式是误杀。
- 不改穿透链(`setWindowTouchable` 映射、fire-and-forget 错误模型均保持)。
- 不做 hover 状态跟踪(`onHover` enter/leave 维护「光标是否在某 tauri 窗上」集合)——对工具栏模式收益不成立(D4 附注),留作后续独立 change。
- 不解决多显示器下的 `displayX` 参照系歧义(单显 2in1 为验收面;API 20 `globalDisplayX` 分支预留)。
- 不修 `update_cursor_position` 之外的任何 NAPI 签名(`Module` 接口零改动)。

## Decisions

### D0: 方向裁定——A 为主修 + B 的 fail-safe 纪律;B 几何收编不采纳

| 评估维度 | 方向 A(修正 cursor_position) | 方向 B(并集矩形收窗 + 整窗可命中) |
|---|---|---|
| tao/上游语义一致性 | **对齐**:喂入即全局系,`cursor_position()` 恢复上游「全局屏幕物理 px」语义,所有消费方受益 | 不触及 cursor_position(其错误语义留存) |
| 消费方侵入度 | **业务代码零改动**:命中测试已按全局坐标写,数据变对即工作;只需同步 fork commit 重打 HAR+HAP | app 侧重写工具栏窗几何管线(snapshot.interactive 解析 + 并集计算 + 移窗/缩窗时序),在落后数十 commit 的 ohdev-git 分支上交付成本高 |
| 复杂度与风险 | 改动面小(2 个 ArkTS 喂点 + 1 个 helper + Rust Err 契约);风险点(R1/R2)与现产 MainPage 机制同源,一次真机定论 | 圆盘为圆形,bbox 四角死区**挡住下层 canvas 书写窗**(像素级穿透的硬伤);多形状需多窗,复杂度爆炸 |
| 可测试性(真机自动化) | 分层:设备 UT(纯函数)+ uinput 注入式 e2e(断言坐标真值,可半自动) | 只能人工目测「圆盘可点」 |
| 可组合性 | A 修复正确性 + B 的 fail-safe 纪律(Err → ignore=true)= 推荐组合 | 与像素级穿透互斥(圆盘),仅作 R1 fallback |

**推荐与理由**:A 是正确性修复且交付面最小;B 的核心价值(fail-safe 纪律)被 D3 收编为 runtime 契约,B 的几何收编降级为 app 侧备选(R1 fallback)。两方向可组合,组合形态即本 change。

### D1: 喂入源 = `event.displayX/displayY`(设备屏幕系),NAPI 签名不变

**选择**:MainPage 与 FloatPage 的 `onMouse` 都改喂 `event.displayX/event.displayY`(全局屏幕 vp);Rust `cursor_position()` 维持「× scale → 物理px」读出。`update_cursor_position(x, y)` 签名不变,语义升格为「屏幕全局 vp」。

**理由**:
- `displayX/displayY` since 10(必填字段,本机 SDK 副本 `common.d.ts:11199-11320` 复核),demo `compatibleSdkVersion=12` 直接可用,无版本守卫负担(相比 since 20 的 `globalDisplayX`)。
- 全局系喂入使 Rust 侧**零换算、零新增状态**(不需要 windowId、不需要 per-window rect 快照参与),规避 D1-备选中「rect 快照 16ms 节流导致拖窗期漂移」的整个问题类。
- 上游语义对齐:`displayX × scale` ≡ Windows `GetCursorPos` 产出的全局物理 px。
- NAPI 签名与 `Module` 接口零改动 → 消费方 ArkTS 侧零适配。

**多显示器预留**:helper 内 `deviceInfo.sdkApiVersion >= 20 && Number.isFinite(event.globalDisplayX)` 时优先 `globalDisplayX ?? displayX`(API 20 起才有真正的「全局显示」声明);API 12-19 设备用 `displayX`(单显 = 全局)。多显 + API<20 的参照系歧义记入 R4。

**备选(否决)**:`update_cursor_position(window_id, windowX, windowY)` + Rust 侧用 `inner_rect_for(window_id)` 快照换算——需要 per-window 喂入状态、受 windowRectChange 16ms 节流影响(拖窗时光标全局值漂移)、`inner_rect` 对带装饰主窗的 drawable 偏移引入第三层坐标系假设;复杂度与误差面全面劣于 D1。

**单位假设(待实现期真机验证)**:ArkUI 事件坐标惯例为 vp,现有代码对 `event.x` 同样按 vp 乘 scale 处理;若真机注入验证判定 `displayX` 实为 px,修正收敛为「读出侧删乘法」单点(`app.rs::cursor_position`),见 R1 校准点。

### D2: FloatPage 根 Stack 挂 onMouse + 两页共用 helper `cursor_feed.ets`(模块引用由调用方传入,不读 AppStorage)

**选择**:
- 新建 `native_ability/src/main/ets/helper/cursor_feed.ets`,导出 `feedCursorFromMouse(module: Module | null | undefined, event: MouseEvent): void`:版本守卫取 `globalDisplayX ?? displayX`、`Number.isFinite` 有限数值守卫、`typeof module?.updateCursorPosition === 'function'` 守卫、`updateCursorPosition(gx, gy)` 调用(NAPI snake_case→camelCase,约束见 ohos-constraints.md §2.1)、try/catch 吞错(best-effort,对齐 MainPage 现状)、hilog.debug 记录实际采用字段与喂入坐标(固定 tag `cursor_feed`)。
- **模块引用由调用方传入,helper 不读 AppStorage**:两页各传己有引用——MainPage 传自有 `this.nativeModule`(`MainPage.ets:41` 声明、`:61` load 赋值),FloatPage 传其既有 AppStorage 取得的引用(与 `FloatPage.ets:82/161/170/352` 现状同模式)。坐标提取/守卫逻辑仍单一事实源(只在 helper 一处)。
- `MainPage.ets:222-232` 的 `onMouse` 改调 helper(action 守卫 Move/Press 保持)。
- `FloatPage.ets` 根 Stack(与既有 `onKeyPreIme`/`onTouch` 同层)挂 `onMouse`,同守卫调 helper。

**理由**:
- **不依赖 AppStorage 全局单值**:`MainPage.ets:34` 既有注释明诫 AppStorage 是「进程全局单值,spawned instance 会覆写」——helper 若改用 `AppStorage.get(NATIVE_MODULE_STORAGE_KEY)` 取模块,会迫使 MainPage 放弃自有 `this.nativeModule` 引用、引入该告诫所警告的耦合;参数化后取模块职责留在各页现状,不新增全局单值依赖。FloatPage 侧的 AppStorage 时序已由进程期 seed 保证安全(`ProcessInitializer.ets:193-195`:`AppStorage.setOrCreate(NATIVE_MODULE_STORAGE_KEY, this.nativeModules[0])` 在进程初始化期写入,早于任何页面喂点)。
- 根 Stack 挂点覆盖 MenuBarComponent + DefaultXComponent(webview)+ drag bar + resize handles 全子树——ArkUI `onMouse` 自子组件冒泡,该机制正是 MainPage 现产事实(「NDK DispatchMouseEvent 在 WebView 上不触发,ArkTS onMouse 冒泡可用」,`tao event_loop.rs:83-88` 注释 + MainPage 注释),FloatPage 组件树同构(DefaultXComponent 同一组件),风险同源。
- helper 单一事实源:两个页面不得各自内联坐标提取逻辑(版本守卫 + 有限数值守卫 + 语义注释只写一处)。
- **守卫用 `Number.isFinite` 而非 `typeof === 'number'`**:typeof NaN === 'number',NaN 可穿透守卫并经 f64 位打包 × scale 得 NaN 读数(命中测试恒 false 且粘滞至下次有效喂入)。选 `Number.isFinite` 使 spec「有限数值」措辞字面成立、NaN 由构造排除;NaN 在当前 ArkUI 类型契约下(`MouseEvent` 坐标字段声明 number,字段缺失为 undefined)来源不可达,守卫属纵深防御而非已证缺陷路径。
- Move/Press 守卫与 MainPage 现状一致(不喂 Release/Leave,避免释放瞬间坐标噪声)。

### D3: 未跟踪态契约 = `Err(NotSupported)` 全链传播(fail-safe 的 runtime 化)

**选择**:
- `app.rs` 光标快照增加 `EVER_FED: AtomicBool`;`update_cursor_position` 置位。**内存序纪律**:喂入序 `X.store(Relaxed)` → `Y.store(Relaxed)` → `EVER_FED.store(true, Release)`(Release 置于 X/Y 之后);读序 `EVER_FED.load(Acquire)` 先于 X/Y 读——保证「观察到 ever_fed=true ⇒ 该次喂入(及更早)的 X/Y 值对读方可见」。否则并发读可在首次喂入瞬间观察到 ever_fed=true 而 X/Y 尚不可见 → 返回 `Ok((0,0))`,违背「Ok 恒等于有真实喂入的坐标」承诺。替代实现:X/Y+fed 标志并入单个打包字(单 AtomicU64)使其原子,可一并消除 X/Y 双 store 的撕裂读——两案二选一,取舍记录在任务 2.1。
- `OpenHarmonyApp::cursor_position()` 改返回 `Result<(f64, f64), CursorUntracked>`(错误类型为 unit-like 公开枚举,tao 可映射);内部拆纯函数 `cursor_position_with(ever_fed: bool, x_vp: f64, y_vp: f64, scale: f32) -> Result<(f64, f64), CursorUntracked>`(可 UT,满足「OHOS UT 只能测纯函数」约束,规避进程级 statics 的测试顺序耦合——既有 `update_cursor_position_stores_vp_coordinates` 用例同样喂 statics)。
- tao `cursor_position_from_app`(`event_loop.rs:266`):`Ok(p) => Ok(p)`;`Err(_) => Err(ExternalError::NotSupported(...))`(对齐 §1.5 错误转换约束:warn! 可选、NotSupported 唯一变体)。
- 下游零改动:runtime-wry 已映射 `FailedToGetCursorPosition`(`lib.rs:3513-3522`),tauri `getter!` 传播命令 Err,JS `cursorPosition()` reject。
- spec 化 app 纪律:捕获 untracked/Err → 一律 `set_ignore_cursor_events(true)`(默认穿透),命中测试成功才置 touchable。

**理由**:
- 这就是 BUILD-INFO fail-safe 的 runtime 可观察形态:「光标读不到 → app 一律 ignore=true」。HEAD 上未喂入返回 `Ok((0,0))`——垃圾值与真值不可区分(app 无法判定可信性);Err 让「读不到」成为类型化事实。
- (0,0) 哨兵歧义消除:`Ok` 恒等于「有真实喂入的全局坐标」。
- 对齐上游的偏差是**收窄**而非扩大:tao 文档「Unsupported 平台返回 0,0」指平台无实现;OHOS 是「有实现但尚无数据」,Windows 的 `GetCursorPos` 失败同样返回 Err——Err 分支在 Result 类型内是上游既有形态。
- 纯函数拆分让两分支可设备 UT(红光用例,见 Test Design),不受进程 statics 污染。
- 内存序取舍注记:X/Y 双 statics 在并发喂入下的撕裂读(新 X 配旧 Y)是现状既有属性,本 change 不扩大(命中测试带 ±40px 容差,影响量级与现状相同);选择单打包字方案的实现者可一并消除,选择 Release/Acquire 纪律者消除的是「ever_fed=true 而 X/Y 不可见」这一本 change 新引入状态位的竞态(必选项),撕裂属性维持现状(非必选项)。

**兼容性核对(已实证)**:全仓 grep 无内部逻辑消费 `Ok((0,0))`;命令消费面是 `cursorPosition` 命令 + 例套件用例;`AppHandle::cursor_position`(`app.rs:966-969`)/`Window::cursor_position`(`window/mod.rs:1872-1873`)/`Webview::cursor_position`(`webview/mod.rs:1539-1540`)/`WebviewWindow::cursor_position`(`webview_window.rs:1974-1975`)四处公开 Rust API 与命令同链路,Err 同契约透传——Rust 侧调用方以 `match Err` 实现同一 fail-safe。examples/api 既有 `cursorPosition` 用例在本 change 内同步升级(见 tasks 组 1/4),桌面基线不回归。

### D4: 不做时长衰减 staleness(误杀论证)+ 不做 hover 跟踪(收益论证)

**时长衰减否决**:穿透生效期间(`touchable=false`)**本窗**收不到任何鼠标事件——事件全部落到 Z 轴下层窗(全屏透明工具窗场景下,即下层 FloatPage 宿主窗,其 onMouse 正是本设计的喂入源——这是修复链自洽的前提);光标**静止悬停**时 Move 不再触发(无移动),若按「超 N 秒未喂 = 不可信」判定,悬停 30s 后的点击会被判 stale → ignore=true 恒真 → 圆盘永远点不动,**恰好复刻本 change 要修的故障**。Press 喂入不能补救:穿透生效态下本窗根本收不到 Press。故「新鲜度」对该模式不是有效性信号;有效性判据只有 D3 的「是否曾喂入」。
**hover 跟踪延后**:它能区分「光标在某 tauri 窗上」与「光标在系统桌面」,但对工具栏模式收益不成立——光标在非 tauri 表面时快照坐标虽旧,此时工具栏窗也收不到事件,其 touchable 状态无拦截效果;光标重新进入工具栏窗的瞬间 Move 恢复喂入,自愈。留作独立 change(若未来出现「陈旧坐标导致误置 touchable」的实际故障再立项)。

### D5: cfg 隔离与平台零影响

- ArkTS 改动(FloatPage/MainPage/helper)在 `native_ability` 单一 ArkTS 代码基,无 cfg 概念,天然不影响其他平台构建。
- Rust 改动全部落在 `app.rs`(openharmony-ability,仅 ohos 目标可编译)与 `tao/src/platform_impl/ohos/`(OHOS 平台实现文件)——其他平台实现(`platform_impl/windows|macos|linux`)零触碰。
- tauri 仓仅测试文件改动,`crates/tauri` 零改动。
- 验证锚:`cargo check`(tao host + tao ohos 目标 + ability ohos 目标)双/三路零 error;tauri crate 未触碰故 `cfg(not(target_env = "ohos"))` 测试面无影响。

### D6: 方向 B 的记录形态(app 侧备选,fallback 路径)

B(按 `snapshot.interactive` 并集外包矩形设定 Scene 窗几何、整窗可命中)不进本 change,记录两个触发条件:
1. **R1 fallback**:若真机注入验证否定 `displayX` 全局语义(如实为窗口系或 px 单位且修正式不可收敛),A 路径失效,B 是结构上不依赖 cursor_position 的替代(其 runtime 依赖 `set_outer_position`/`set_bounds` 已存在,`tao/src/platform_impl/ohos/window.rs:1086` 实证)。
2. **形状退化特例**:若消费方工具栏退化为纯矩形侧栏(无圆盘),B 的死区问题消失,「整窗可命中 + 不依赖穿透轮询」反而更稳,B 可作为 app 侧优化自行采纳(runtime 无需任何配合改动)。

## Risks / Trade-offs

- [R1 `displayX`/`globalDisplayX` 的「设备屏幕/全局显示」语义与单位(vp)未真机定论;文档 since-10/since-11 措辞存在 device screen / application screen 漂移] → 注入式 e2e 用例(Task 组 1.2,HEAD 红灯)是真值仲裁:uinput **鼠标模式**注入已知屏幕坐标,断言 `cursor_position()` 读数 ≈ 注入值(容差 ±40px,vp 取整 + 注入落点圆整);仲裁结论按 helper **实际采用字段**归因(API≥20 设备实际喂入 `globalDisplayX`,见 D1 优先分支),读出侧修正(scale 乘法增删)是字段无关单点(`app.rs::cursor_position`);若参照系判定为窗口系,退 `windowX + 窗口全局原点` 换算(D1 备选预案)或触发 D6-B。**标注:待实现期真机验证。**
- [R2 光标在 webview 上时 FloatPage 根 Stack 的 onMouse 不冒泡(与 MainPage 机制相悖)] → MainPage 现产事实是同构组件树上 onMouse 冒泡可用(Task 组 5.5 真机验证点);若真机否定,fallback 是在 `DefaultXComponent` 层加 onMouse 喂点(与 MainPage 注释预留的 fallback 位一致)。
- [R3 穿透态(fire-and-forget)下 Promise reject 不反向通知 Rust] → 既有约束(ohos-constraints §1.5),本 change 不改变;fail-safe 由 app 轮询读取路径承担,与穿透错误感知正交。
- [R4 多显示器 + API<20 时 `displayX` 参照系歧义] → 验收面限定单显 2in1 PC;helper 已留 `globalDisplayX` API20 优先分支;多显设备行为记入 manual_tests 已知限制。
- [R5 `cursor_position` 契约变化(未喂 → Err)对既有调用方是行为变化] → 兼容性核对(D3)实证无内部逻辑消费 `Ok((0,0))`;四处公开 Rust API 同契约透传 Err(fail-safe 语义对 Rust 调用方同样可用);用例同 change 升级容忍 untracked reject;tao 文档注释同步更新,记入交付说明供消费方知悉(proposal Impact 已带同款限定)。
- [R6 FloatPage 桌面态 decorations=false 时的透明 drag bar(40px)与 resize handles(10px 边缘)位于 webview 之上,可能影响工具栏窗顶缘点击] → 既有行为,非本 change 引入;真机验证时观察并记录,若证实属独立 change(拖拽条命中策略)。
- [R7 静止悬停无 Move 喂入,快照值是「到达时」坐标] → 语义正确(位置未变);轮询 app 读到的即到达点,命中判定不受影响(D4 论证)。

## 交付面

| 仓 | 改动 | 消费方(ohdev-git 落后分支)如何受益 |
|---|---|---|
| openharmony-ability(fork) | ArkTS 喂点 ×2 + helper + `app.rs` 契约 | 同步 fork commit → `ohrs build` 重打 HAR → 重打 HAP;**业务代码零改动** |
| tao(fork) | `cursor_position_from_app` Err 传播 + 注释 | 同步 fork commit → 编译进 `libbase_core.so`(随 HAP 重建) |
| tauri(fork) | 仅 `examples/api` 测试 + `doc/manual_tests.md` | 可选(测试资产);runtime 零改动 |
| 消费方 app | 无 | 命中测试按全局坐标写的既有逻辑直接开始工作;若需 fail-safe 纪律,按 manual_tests 新章节补 `catch → ignore=true` 守卫(一行级) |

**升级配合清单**(交付说明用,任务 5.6):同步 openharmony-ability + tao 两 fork → 重建 HAR(改 ArkTS 必走全链,ohos-constraints §3.2)→ 重打 HAP;无需 gen/ohos 手工改动、无需权限/manifest 变更、无需 API 版本提升(全部 since ≤ 12,`globalDisplayX` 分支为运行时可选)。

**消费方升级知悉项**(交付说明引用):
1. **R5 契约变化**:`cursor_position()` 未喂入时由 `Ok((0,0))` 变为 `Err` —— tauri 四处公开 Rust API(`Window`/`WebviewWindow`/`AppHandle`/`Webview` 的 `cursor_position`)同契约透传为 `Err(NotSupported)`(tao `ExternalError::NotSupported`);JS 侧 `cursorPosition()` 同步 reject。消费方 Rust/JS 若有「reject/Err 时按 (0,0) 处理」的隐性假设须改为 fail-safe 守卫(未跟踪 → 保持穿透 `ignore=true`,仅命中测试匹配才置 touchable,见 manual_tests §三十八)。
2. **平台隔离核对结论(任务 5.1,git diff 范围核对)**:`tauri/crates/tauri` 目录零源码变更(仅 `examples/api` 测试与 `doc/manual_tests.md`)→ tauri runtime 层无需同步;消费方只需两 fork(openharmony-ability + tao)commit 同步。
3. **行为语义**:读数为屏幕全局物理 px(全局 vp × scale);静止悬停无 Move 喂入时读数为「到达时」坐标(位置未变,命中判定不受影响,D4/R7);多显示器跨屏 R4 已知限制(design「D4 不做时长衰减」与 proposal Impact 同源)。

## Test Design

### 测试策略

- **单元测试(openharmony-ability,设备侧 UT,手工配方——`run-ut.sh` 已不在本机,配方见任务 5.3)**:`crates/ability/src/app.rs` `#[cfg(test)] mod tests` 内新增纯函数两分支用例(不依赖进程 statics 状态,规避既有 `update_cursor_position_stores_vp_coordinates` 的喂入污染);`--lib` 必须(既有约束,否则 examples 编炸)。
- **前端套件(tauri/examples/api)**:`core.ts` 升级既有盲区用例;`ohos-adapter.ts` 新增注入式真值用例(manual/半自动,**鼠标模式 uinput** host 配方,参照既有 `ohos-adapter.window.ignore-cursor-events` 形态),**先于实现组(Task 组 1.2)编写并在 HEAD 记录红灯**。
- **验证脚本**:构建部署用 `.claude/skills/ohos-build/scripts/run-tests.sh("" desktop)`;桌面基线 307✅ 不得回归。

### 注入刺激与地面真值(测试设计硬约束)

- **注入模式 = 鼠标,不是触摸**:ArkUI `onMouse` 是鼠标指针语义(SDK `common.d.ts:21776`),而本项目全部已归档注入配方均为 `-T`(触摸)/`-K`(按键)先例(`doc/manual_tests.md` 全文),**无 `uinput -M` 鼠标模式先例**;触摸注入是否合成 onMouse 未证——若不合成,红灯永不转绿、R1/R2 仲裁失灵。故:实现期第一步在验收设备验证 `uinput -M` 可用性(以 `hdc shell uinput` help 实测语法为准);**降级为物理鼠标 manual 协议仅由「`-M` 不可用/语法不符」触发**——「onMouse 无痕」不是降级条件:HEAD 无任何喂入插桩(MainPage 既有 onMouse 零日志 `MainPage.ets:219-233`、NAPI 喂入函数零日志 `app.rs:1273-1276`、helper 未建),痕判据在红灯阶段不可用(见下条分级)。旧触摸模板(`uinput -T -m/-d`)废除。
- **保真度仲裁步(分级,红灯阶段不依赖新增插桩)**:
  - **红灯级(3.3 完成前)门槛 = 两级**:①几何地面真值——hidumper WMS rect 确认注入点 ∈ 目标窗 rect(主窗段/子窗段各取各 rect);②响应增量——段 0 向主窗注入两个相距 ≥100px 的点,`cursorPosition()` 读数随注入位置变化(HEAD 既有主窗喂入对刺激的响应即「刺激已达」证,scale=2.0 下响应可观察)。两级齐 → 刺激已达成立、红灯证据可记;①不齐 → 修注入坐标;②不齐(主窗)→ 修注入方式。
  - **痕门控级(3.3 完成后同刺激复跑适用)**:复跑同刺激——hilog 出现 `cursor_feed` 喂入痕 ⇒ 归因闭合(刺激已达 + 喂入路径活);痕出现而读数仍错 ⇒ 归因「喂入值/换算缺陷」(真喂入链红灯);同刺激无痕 ⇒ 方可归因「刺激未达」(修注入方式/查 R2 冒泡)。**禁止无痕时把读数异常归因喂入链,禁止把「HEAD 无插桩导致的无痕」误判为「注入模态失效」而降级**——降级后同样无痕,协议死路。
  - (可选)允许 1.2 脚手架给 MainPage 既有 onMouse 加临时 hilog(随 3.2 正式化为 helper 痕),使痕门控提前到红灯阶段可用;不采用则按上述两级执行。
- **地面真值双源**:窗位 = `outerPosition()` 就绪守卫(轮询至非零——window_rect 快照由 window_rect_change 回调在内容加载后才 seed,`app.rs:973-975`,刚创建即读可能得 (0,0) → 注入点错算到屏幕左上角)+ `hidumper` WMS rect 交叉验证。纯 move 后的 outerPosition 回读停旧值(`window-ops.ts:545-553` 实证:Float 窗 orig(515,343)→after(515,343) 完全不变,setPosition 已降级 smoke)——移窗后的窗位**禁止**以 outerPosition 单源判定,必须 hidumper。
- **移窗判别弃用记录(major-2 处置)**:spec 场景「读数不随窗口原点漂移(与窗口相对假设可区分)」以**不依赖移窗的原点偏移量判别**实现(1.2 段 1 + 段 3,双注入点;原场景措辞「移动窗口后同一物理点读数不变」已按机制无关表述改写,物理移窗降为可选增强刺激)。理由:OHOS 纯 move 物理窗位不可靠且无 JS 可读回执,移窗注入存在双失败模式——「窗未真移 → 注入点落窗外 → 结果不可解释」或「注入点恰好压在其他喂入窗上 → 读数≈注入点 → 假通过」;而判别的本质(读数跟随物理注入点而非窗内相对值)由「读数 ≈ 全局注入点 且 与窗内相对假设之差 ≥ 窗口原点模长 − 80px」承载,不依赖移窗即可成立。**边界注记**:「stale-origin 换算」类缺陷(读数 = 旧窗位原点 + 窗内偏移)只有真移窗才能区分;本 change 采用的 displayX 直喂路径无任何窗位参与,该缺陷类仅在 R1 仲裁选中 D1 备选(`windowX + 窗口全局原点` 换算)时才进入实现空间——**若实现期真选中 D1 备选,测试设计必须加回「hidumper 确认窗位真变」仲裁下的移窗段**(条件性要求,动作项已入任务 5.5);若实现期确证可靠移窗手段,亦可选增强段重复本判别(非必需)。
- **主窗喂入路径覆盖(minor-2 处置)**:「主窗 Move 喂入」spec 场景由纯函数 UT + 1.2 段 0(主窗注入前置段)**双**测试位覆盖——纯函数 UT 只验 Rust 读出换算,不覆盖 3.2 把 MainPage 从自有模块引用切到 helper 后的真实喂入路径;缺段 0 时 3.2 的守卫/导入回归是静默 skip。段 0 在 Float 子窗创建之前执行(此时主窗是唯一活跃喂入源),断言分两相:红灯相「读数响应增量(刺激已达证)+ 读数 ≠ 注入点全局值(根因二红)」;3.3 完成后同刺激复跑相「读数 ≈ 注入点 + hilog 出现 helper `cursor_feed` 喂入痕」——痕断言直接证明 3.2 切换生效。

### Spec → Test 映射(specs 共 6 Requirement / 13 Scenario,逐行对应)

| Spec Scenario | Test Function | Type | 期望值 |
|---|---|---|---|
| 全窗口喂入/主窗 Move 喂入 | `cursor_position_with_tracked_feed_multiplies_scale_by_scale` + `ohos-adapter.window.cursor-position-freshness` 段 0(主窗注入前置段) | unit(设备 UT)+ manual/半自动 e2e | UT:喂 `(100.5, 50.25)`,scale=2.0 → `Ok((201.0, 100.5))`;段 0:红灯相 = 注入主窗两点读数响应增量且读数 ≠ 注入点全局值(根因二红);复跑相(3.3 后)= 读数 ≈ 注入点(±40px)+ hilog 出现 helper `cursor_feed` 喂入痕(3.2 真实路径覆盖);来源:换算契约「全局vp × scale = 全局px」(design D1)+ 3.2 路径 |
| 全窗口喂入/子窗喂入覆盖旧值(新鲜度) | `ohos-adapter.window.cursor-position-freshness` 段 1(注入式) | manual/半自动 e2e | 鼠标模式注入光标至子窗中心(屏幕坐标 = 子窗全局原点 + 子窗尺寸/2;outerPosition 就绪守卫 + hidumper 交叉取原点)→ `cursorPosition()` 与注入点差 ≤ 40px,且与「窗内相对假设」之差 ≥ 原点模长 − 80px(判别断言);红灯证据门槛 = 几何地面真值(hidumper 确认注入点 ∈ Float rect,无插桩依赖);**HEAD 上失败**(快照停在主窗陈旧值)——红灯用例;来源:根因一 |
| 全窗口喂入/子窗上的 Press 同样喂入 | 同上用例段 2(move 后鼠标 down) | manual/半自动 e2e | Press 喂入后读数 ≈ 按下点屏幕坐标(±40px),且 Release 不改写快照(读数稳定);来源:D2 守卫(Move/Press 同 MainPage 现状) |
| 全局坐标系/读数为屏幕全局坐标 | `ohos-adapter.window.cursor-position-freshness` 段 1 判别断言 | manual/半自动 e2e | 注入点屏幕坐标(= 全局原点 + 窗内偏移)与读数一致,与「窗口相对坐标」假设差 ≥ 窗口原点模长 − 80px(原点 > 80px 时两假设不可混淆);来源:根因二 + tao 上游语义(`windows/window.rs:503` GetCursorPos) |
| 全局坐标系/读数不随窗口原点漂移(与窗口相对假设可区分) | 同上用例段 3:**不依赖移窗的原点偏移量判别**(第二注入点 + 判别复立) | manual/半自动 e2e | 第二已知窗内点(如 1/4 点)注入 → 读数 ≈ 该点全局坐标且判别断言复立(读数跟随物理注入点而非窗内相对值,不随窗口原点/窗内偏移漂移);物理移窗实现弃用(理由与条件性恢复见「注入刺激与地面真值」);来源:D1 全局系契约 |
| 未跟踪 fail-safe/冷启动未喂入 → reject | `cursor_position_with_untracked_feed_returns_untracked_error`(UT,**权威验证位**)+ core.ts catch 容忍分支 | unit(设备 UT)+ auto(套件,容忍) | UT:`ever_fed=false` → `Err(CursorUntracked)`(来源:D3 契约;**HEAD 行为红**:未喂返回 `Ok((0,0))`);套件:catch 为容忍分支——套件运行前 EVER_FED 必已置位(套件必有鼠标交互),reject 实际不可达,不写为必经断言(见任务 4.1) |
| 未跟踪 fail-safe/喂入后恢复 resolve | `cursor_position_with_tracked_feed_multiplies_scale_by_scale`(同用例 tracked 分支)+ core.ts try 分支 | unit + auto(套件) | UT:`ever_fed=true` → `Ok(...)`;套件:resolve 时 x/y 为有限数且在 `currentMonitor()` 尺寸域内(+40px 容差);来源:D3 |
| 未跟踪 fail-safe/Err 只表示未跟踪 | `ohos-adapter.window.ignore-cursor-events`(4.2 更新)fail-safe 指引段 | manual | 演示步骤:穿透链调用失败(或未调用)不影响已喂入快照的 resolve——两条错误通道独立;来源:D3 + R3 |
| 事件值守卫/非数值不覆盖快照 | 实现期 debug 变体:合成非有限数值 event 直调 `feedCursorFromMouse`(观察跳过 + hilog 无喂入痕)或代码走查级(3.1 完成后) | 实现期验证(非真机可执行) | helper 对坐标字段非有限数值(`Number.isFinite` false,含 undefined/NaN)跳过喂入;`displayX` 声明必填、D2 论证 NaN/undefined 来源不可达,真机注入无法制造该分支,hilog 断言无真机触发手段;来源:D2 守卫 |
| 事件值守卫/API 20+ 优先全局显示字段 | 同 freshness 用例段 5:helper hilog.debug 记录实际采用字段 | manual | API 23 验收设备(≥20)上 hilog 显示喂入字段来源为 `globalDisplayX`;API<20 设备显示 `displayX`;来源:D1 多显示器预留 |
| 穿透链零回归/既有 smoke 保持 | `ohos-adapter.window.ignore-cursor-events`(既有,更新指引文本) | manual | `setIgnoreCursorEvents(false)` smoke OK;穿透/恢复视觉验证步骤保留;fail-safe 指引(Err → ignore=true)新增;来源:proposal Modified Capabilities |
| 平台隔离/非 OHOS 编译不受影响 | `cargo check` 三路(任务 5.1) | 构建 | tao host / tao ohos / ability ohos 零 error;tauri crate 未触碰;来源:D5 |
| 平台隔离/tauri 运行时零改动 | 任务 5.1 的 git diff 范围核对(5.6 交付说明引用其结论) | 构建 | `crates/tauri` 目录零源码变更(仅 examples/api 测试与文档);来源:D5 + 交付面 |

**离散值守卫矩阵**(helper 喂入守卫,D2):`{globalDisplayX 存在(API≥20), displayX}` × `{Number.isFinite=true, false(含 undefined/NaN)}` → 喂入/跳过两分支均有断言位(UT 覆盖 Rust 读出侧两分支;ArkTS skip 支路断言位为实现期验证——debug 变体合成 event 直调或代码走查级,**非真机可执行**:`displayX` 声明必填、NaN/undefined 来源不可达[D2 论证],记为已知限制)。

### 测试基础设施

- Fixtures:无新增(复用设备 UT 进程;套件 TestCase 骨架与 `skipOnMobile`/`smoke` 既有 helper)。
- Shared:**鼠标模式** uinput host 配方(实现期验证 `-M` 语法,无项目先例——见「注入刺激与地面真值」;降级物理鼠标 manual 协议仅由 `-M` 不可用/语法不符触发;`hdc shell` + `MSYS_NO_PATHCONV`);地面真值用 `hidumper` WMS rect + outerPosition 就绪守卫;子窗创建复用套件既有 `WebviewWindow` 构造形态(window-ops.ts 先例);注入式用例**显式 `timeout: 20000`**(runner 默认 5s,既有 #291 教训)。
- 外部依赖:无新增。

## Task Signals
tags: [ohos]
routed_skills: [rust-ohos]

(PB-C unavailable:各仓无 `.botbrain/`/`.projectbrain/` 图谱;PB-A 未命中新增知识——rust-ohos 域内容为 BUILD.gn 构建模板,与本 change 的 cargo/ohrs 工具链不适用;NAPI/TSFN/cfg 约束以项目内 `ohos-constraints.md` 为准,已全文遵守。)

## Findings 台账(跨轮统一编号,审查 residual 处置索引)

> 背景:设计经三轮审计,各轮 findings 编号独立(如「major-2」「minor-2」为某一轮内编号),正文处置标注沿用了轮内编号,跨轮读易错位。本表为唯一权威索引:统一编号 → 正文处置位置 → 状态。

| 统一编号 | 内容摘要 | 正文处置位置 | 状态 |
|---|---|---|---|
| F1(major,第 X 轮 major-2) | 移窗判别存在双失败模式,改用不依赖移窗的原点偏移量判别 | Risks/Test Design「移窗判别弃用记录(major-2 处置)」;tasks 1.2 段 3;spec 场景「读数不随窗口原点漂移」 | 已裁定并入(条件性移窗段入 5.5) |
| F2(minor,第 X 轮 minor-2) | 主窗 Move 喂入的 spec 场景缺真实 ArkTS 喂入路径测试位 | Test Design「主窗喂入路径覆盖(minor-2 处置)」;tasks 1.2 段 0 复跑相 | 已裁定并入 |
| F3(minor,残余 1) | 段 0 红灯判别式缺主窗原点几何守卫(主窗近屏幕原点且组件顶格时偏差塌缩 ≤40px,红灯假性满足) | tasks 1.2 段 0 geometry guard 行;实现期注入前 hidumper 实测「主窗原点 + 组件偏移模长 > 40px」,不满足移窗或记「红灯弱化」明示 | 已裁定并入(实现期处置) |
| F4(suggestion,残余 2) | spec 场景内嵌 design 章节名引用,长期合约依赖可变章节 | spec.md「读数不随窗口原点漂移」THEN 已收敛为机制无关语义(物理移窗仅可选增强刺激);机制引用保留在 Test Design 映射表 | 已处置(实现期) |
| F5(concern,残余 3①) | 痕门控相断言依赖 hilog.debug,验收设备默认过滤 DEBUG 会假性「无痕」 | tasks 3.1/1.2;实现期第一步实测:验收设备 `hilog -b D` 配置下 DEBUG 级可捕获(NativeAbility 既有 debug 行实证),验证协议须带 `-b D`,helper 维持 hilog.debug | 已处置(实测可捕获) |
| F6(concern,残余 3②) | design 内部处置标注编号与 findings 编号跨轮不对齐 | 本台账(唯一权威索引),正文轮内编号保留不改 | 已处置(本表) |
| F7(concern,残余 3③) | 段 0 复跑相门控排在 3.3 后偏保守 | 维持不改(无害;复跑相本就依赖 3.3 的 helper 痕) | 已裁定维持 |
