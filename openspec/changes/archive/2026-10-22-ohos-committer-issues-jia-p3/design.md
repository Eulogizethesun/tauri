# Design: ohos-committer-issues-jia-p3

## Context

roadmap Phase 3 = 甲第 2 波 M 级修复(9 条,#179 剔除)。两块输入面:

- **p1 对账表**(reconciliation-ledger)= 条目级残差权威;但 ledger 行号是 2026-10-20 快照,本 phase 主要锚按 R8 纪律从 HEAD 重 derive(wry HEAD e5e9024);个别 setter 区锚与 ledger 快照偏差较大(如 set_always_on_top ledger :1539 → HEAD :1664),已在下文标注,实现期仍须现场定位。
- **p2 交付面**(phase-report)= 前置基建权威:#173 WindowStateMirror focused 位(app.rs mirror 写入面就绪,#180① 只差 Float 信号补齐)、#199 url_cache 预填 initial_url(#192 回落面)、#174 Branch A 定案、回归基线 319 例(311✅/8⏭/0❌,report `examples/api/device-report-1021-desktop.md`)。

**HEAD re-derive 修正与定案**(相对 ledger):

1. **#168 几何播种半已闭合**:主窗 decorations apply 已由 8dd79f77 落地(tao `src/platform_impl/ohos/window.rs` :876-893),Float create params 已携带 decorations(:778)。播种半收敛为 always_on_top + decoration_flags;**补发半(fullscreen/maximized/focus 三参数创建后补发)HEAD 实证零消费**(tao ohos build() 不读 window_attrs.{fullscreen,maximized,focused},runtime-wry/tauri 层亦无创建后补发)→ 本波纳入实现(D1),与播种同机制。
2. **#198 披露半已闭合**:wry 8e381e6 已完成文档侧披露;本波只做实现侧 vp 接入。**再收敛(相对 ledger)**:vp 无需新增 NAPI wire——`ohos_display_binding` 既有依赖(ability display.rs :26 已 import)已导出 `default_display_virtual_pixel_ratio() -> f32`(与 `default_display_scaled_density()` 同族),薄包装即可(D6);ledger 设想的 DisplaySnapshot.vp/set_display_layout 载荷路径删除。
3. **#219 是 ArkTS 侧收敛而非新传输**:plugin-window Rust 侧已有 `call::<Req, WindowAcknowledgement>().ensure()` ack 通道,且 WindowPlugin.ets 已有 throw→Rust Err 先例(focus :739/:751、set-decorations bool→throw :623-649)。缺口 = WindowManager.ets `serializeOp`(:329-345)catch 吞错 + 4 类操作型命令未 await。
4. **#186 headers wire 形态定案**:plugin-webview 全仓零 HashMap 先例、wire 走手写 `impl_bridge_napi_type!` 宏(:288+ 系列实例)→ 请求头用并行数组 `header_names`/`header_values: Option<Vec<String>>`(`protocols: Vec<String>` 既有先例),不引入嵌套 map 形态。

**产物注记**:①本 change 的 ohos-window-focus-state / ohos-webview-bridge-fidelity 两个 delta 建立在 p2 change-local spec 之上,**隐含归档顺序前提 p2 → p3**;顺序颠倒时这两个 delta 须人工对齐。②roadmap Phase 3 SC1 例举的「#173 多窗口 isFocused 互斥」新用例在 p3 无 trace(#173 属 p2 已交付,疑 roadmap 侧残留)——phase report 须记录验证方式映射或请 PM 澄清。

## SDK 事实(2026-10-20 定点核验,含当次构建复核门)

- `D:/sdk/20/ets/ets1.2/api/arkui/component/web.d.ets`:`getRequestHeader` :1607、`isMainFrame` :1631、`getRequestMethod` :1647、`setResponseData` :1714、`setResponseMimeType` :1730;**`setResponseHeader` 零命中**;`incognitoMode` :1927(@since 20)。
- `@ohos.web.webview.d.ets`:`fetchCookieSync(url, incognito?)`/`configCookieSync(url, value, incognito?)` 自带 incognito 第三参。
- `@ohos.window.d.ets`:`on()` 重载表 :2202-3005 中 **无 windowFocusChange**;等价物 = `win.on('windowEvent')` 的 `WindowEventType.WINDOW_ACTIVE=2 / WINDOW_INACTIVE=3`(@since 20;WINDOW_SHOWN=1/HIDDEN=4/DESTROYED=7 同枚举)。
- `ohos_display_binding` 0.1.3(cargo 依赖,ability 仓既有):`default_display_scaled_density()`(display.rs :269 / app.rs :352 既有调用)与 `default_display_virtual_pixel_ratio() -> f32` 同族并存,后者为本波 #198 供给。
- **#186 前置门**:实现当次构建须复核实际 SDK 副本的 `setResponseHeader`(grep 定点);仍缺席则响应头写路径降级披露(specs/ohos-platform-limitations 已约束),不得自行 hack。

## 设计决策

### D1 #168 创建期参数残差——播种 + 补发全量接入(披露降档)

**落点**:tao `src/platform_impl/ohos/window.rs` build() 尾(UIAbility 分支 :594-741 尾部、Float 分支 :742-807 尾部)。

- **播种**(构造尾对与默认值有差异的 attrs 调 setter):`always_on_top`(HEAD :1664 setter;attrs 位实现期 grep 定位)与 `decoration_flags`。
- **补发**(创建后一次性应用创建参数):`fullscreen`/`maximized`/`focused` 三参数——HEAD 零消费(D11 上游 upstream windows 后端 :1338-1339 `if attributes.fullscreen.is_some() { win.set_fullscreen(...) }` 先例同形态),build() 尾按 attrs 存在性调用既有 `set_fullscreen`/`set_maximized`/`set_focus`。三 setter 均已走 dispatch_or_queue(:982-1027,is_window_ready 检查 → 未就绪 push PENDING_WINDOW_OPS :268 → 握手后 `drain_ready_pending_window_ops` 补发):**播种→补发机制零新增代码,纯复用**;差异才发(默认值不发,零多余命令)。
- **披露**(不实现):`visible`/`window_icon`/`preferred_theme`——OHOS 初始可见性由创建通道决定、无窗口级图标 API、主题走 onConfigurationUpdate 运行期链;facade 文档 OHOS 平台行(specs/ohos-platform-limitations)。三字段在 tao ohos build() 无消费点(实现期 grep 复核)。
- 几何面(x/y/width/height)已修,不重做。

### D2 #186 https 拦截字段扩展——method/headers 三层穿透 + SDK 前置门

**落点**:
1. ArkTS(canonical)`plugins/webview/src/main/ets/WebviewPlugin.ets` `handleHttpsIntercept`(:1102-1170)与 `handleWebviewInterceptRequest`(:1805-1823,现状仅 getRequestUrl):采集 `request.getRequestMethod()` + `request.getRequestHeader()`,装入 payload 类(:596-614 区新增 `method?: string`、`headerNames?: string[]` + `headerValues?: string[]`(**并行同序**,由 `Object.entries(getRequestHeader())` 拆分;不引入 `Record`/嵌套 map wire 形态,理由见 Context 修正 4)。
2. NAPI:`crates/plugin-webview/src/lib.rs` intercept payload struct(:549 `WebviewHttpsInterceptRequest` 区)新增同名字段 `method: Option<String>` / `header_names: Option<Vec<String>>` / `header_values: Option<Vec<String>>`(#[napi] camelCase 默认 → wire `headerNames`/`headerValues`;Option skip 序列化对齐存量契约纪律)。
3. wry `src/ohos/mod.rs` :1311 `Request::builder().uri(&original_url).body(Vec::new())`:追加 `.method()`(有值时;`Method::from_bytes` 失败回落 GET + debug 日志)与 `.headers()`(并行数组 zip 重组;头名/值非合法 HTTP token 时跳过该项 + debug 日志,单坏头不炸请求;缺省回落现状 method=GET/无 headers,旧版桥接插件向后兼容)。
- **SDK 门**:当次构建 grep SDK 副本 `setResponseHeader`;缺席(当前事实)→ 响应头写路径不实现,披露归 ohos-platform-limitations;请求侧三层穿透照常落地。
- **请求 body 披露**:拦截请求 body 在 OHOS 平台无公开访问器(SDK20 web.d.ets 无 getRequestData 等价物)→ method/headers 仅头部采集,body 不穿透,披露并入 ohos-platform-limitations(同一条 requirement)。
- **CORS 4 例**是定向回归面:响应侧零改动,预期零回归;波末 319 全量兜底。

### D3 #189 主 webview Drop 去 is_child 门控

**落点**:wry `src/ohos/mod.rs` `dispose_child`(:1181-1185)与 `Drop`(:1199-1203)。

- 现状:`if self.is_child && !self.disposed.swap(true, Ordering::SeqCst) { let _ = self.dispatch_or_queue(PendingOp::Remove); }`——主 webview(is_child=false)被门控跳过 dispose,ArkTS Web 组件残留(全屏透明残留窗吃点击家族)。
- 修改:去 `self.is_child` 前置,保留 `disposed` swap 幂等;两处(Drop + dispose_child)同步;相邻注释更新为「主/子 webview 统一 dispose」。
- 悬挂边界:bridge 未就绪时 Remove 入队,若永不补发由 bridge 15s 超时兜底(`crates/ability/src/bridge/mod.rs:31 DEFAULT_TIMEOUT_MS = 15_000` 实证);代码注释记录该边界。
- **回归面**:关窗链全量(319 全量 + 真机专项 SC3 关窗链日志)。

### D4 #192 url() 同步 get-url 桥——三态分流(零 block_on)+ 两端注册链

**落点**:wry `src/ohos/mod.rs` `url()`(:909-911,现状读 url_cache)。

- 三态(镜像 cookies 三态分流 :1003-1057 的 `main_thread_status()` 模式):
  1. **Main**:经同步桥基建(`COOKIE_SYNC_APP` OnceLock + `with_main_thread_bridge(env, |bridge| bridge.call_sync::<Plugin, Req, Resp>(...))`,与 ability 仓 `crates/plugin-webview/src/lib.rs` :1279 区 `cookies_for_url_on_main_thread` 同步桥机械同模式)发 get-url;成功写回 url_cache 并返回当前真实 URL;
  2. **Worker thread**:`main_thread_status()` 为 Worker → 直接返回 `url_cache`(p2 #199 已预填 initial_url),零桥调用;
  3. **Bridge uninitialized** 或同步桥调用失败 → 返回 `url_cache` + 结构化 debug 日志。
- **注册链(两端,wry::set_ohos_app 既有入口零新增)**:ability `crates/plugin-webview/src/lib.rs` 新增 `WebviewUrlBridgePlugin`(MainThreadSyncBridge 形态,ID `ohos.webview-url`),在既有 `set_cookie_sync_app`(:1260-1263,内部 `app.register_plugin(WebviewCookieBridgePlugin)`)同点追加 `register_plugin(WebviewUrlBridgePlugin)`;`COOKIE_SYNC_APP` OnceLock(app 句柄)复用——同步桥按插件 ID 寻址,无需新 OnceLock。ArkTS 侧:WebviewPlugin.ets 新增 get-url 同步 handler 类,与 cookie 同步插件同一注册清单注册。
- **铁律**:全程零 recv_timeout/block_on(bridge 禁 recv_timeout 记忆条 + 主线程 block_on 死锁族);同步桥为可重入直调形态,与 fetchCookieSync 完全同构,无新并发原语。

### D5 #195 open_devtools PendingOp 排队重放 + tauri 门控对齐核验

**落点**:wry `src/ohos/mod.rs` `open_devtools`(:927-936,现状 `if let Some(handle) = self.try_handle()` else 静默)。

- 方案:`PendingOp` enum(:155 区)新增 `SetDevtools` 变体;try_handle 失败时 `dispatch_or_queue(PendingOp::SetDevtools)`,握手后既有 drain 重放;handle 就绪时走既有 `set_web_debugging_access` 运行时通道(tauri-runtime-wry :1774-1802 cfg 面已有)。
- 进程级布尔:ArkWeb `setWebDebuggingAccess` 为进程级静态 API → wry 侧 `static DEVTOOLS_ENABLED: AtomicBool` 在调用点即置位;与 ArkTS 既有 module-level tracked state(Utils.ets)语义一致(specs/webview-devtools-focus「Report tracked debugging-access state」不变,本波只补排队);重复 open 幂等(已 true 不重复入队)。
- **tauri 层门控对齐核验(预期零代码)**:devtools 热键注入与命令注册的 devtools 门控与 tracked state 语义一致性静态核验(tauri 命令注册 devtools flag、热键注入点);仅在真缺口处最小补齐,核验结论记 phase report。
- cfg:新增代码维持 devtools 既有 cfg 门(非 OHOS 零编译面)。

### D6 #198 实现侧 virtualPixelRatio(既有绑定薄包装,零 NAPI wire)

**落点**:
1. ability `crates/ability/src/display.rs`:新增薄包装 `pub fn virtual_pixel_ratio() -> f32`——直接消费既有依赖 `ohos_display_binding` 的 `default_display_virtual_pixel_ratio() -> f32`(与 `default_display_scaled_density()` 同族,display.rs :26 既有 import 形态),绑定返回 ≤0/异常时回落 1.0(零 panic 零阻塞);crate 内 re-export 供 wry 消费(wry 已依赖 `openharmony_ability`,`src/ohos/mod.rs` :13 既有 use)。**零新增 NAPI wire、零 ArkTS 面、零 HAR 触发**。
2. wry `src/ohos/mod.rs`:`set_bounds`(:1153-1158)与 create(:745-747)的 `to_logical::<f64>(1.0)` 改 `to_logical::<f64>(vp)`;`bounds()`(:1149)返回 cache 语义不变(回读不经 vp 换算)。
- **换算语义**:dpi `to_logical` 对 Physical 输入 = 物理值 ÷ scale,对 Logical 输入 = 恒等。桌面基线 vp=1.0 → 除以 1.0 恒等,319 例与 UT 数值逐位不变;真机 vp≠1 → Physical 坐标 ÷ vp 得 ArkUI vp 单位,窗口与物理像素对齐(披露半已由 8e381e6 闭合,文档不再动)。

### D7 #180① Float 焦点接通(notify_window_focus + 变化沿去重 + 配对合成)

**落点**:
1. ArkTS:`native_ability/src/main/ets/components/FloatPage.ets` :156(windowStatusChange 注册点)旁新增 `windowEvent` 订阅:typeof 探测 `win.on`/`WindowEventType`(宿主降级:缺 API 记结构化 warn 不 panic);WINDOW_ACTIVE→`notifyWindowFocus(windowId, true)`、WINDOW_INACTIVE→`notifyWindowFocus(windowId, false)`(camelCase wire)。
2. NAPI:ability `crates/ability/src/app.rs` 镜像 PENDING_WINDOW_STATUS 模板(:1363-1395):`PENDING_WINDOW_FOCUS` 存储 + `notify_window_focus(window_id, focused)` + `drain_pending_window_focus`。
3. tao `src/platform_impl/ohos/event_loop.rs`:drain 点(:875 status drain 旁)消费 → `LAST_FOCUSED_WINDOW_ID: AtomicI64`(0 = 无)变化沿去重:
   - **增益沿**(focused=true 且 last≠W):若 last≠0,先对前一持焦窗 P=last **合成失焦**(mirror[P].focused=false + Focused(false) 事件)——**配对语义**,防 ArkTS 快速切换只发 ACTIVE 不发 INACTIVE 时旧窗 focused 位滞留;再走既有 handle_gained_focus(:731-799)。失焦应用逻辑提取/复用为单一写入面(stage LostFocus 臂与合成路径共用,防两份实现漂移)。
   - **失焦沿**(focused=false 且 last==W):走既有 LostFocus 通路(mirror 清位 + Focused(false)),last 归零。
   - **同窗同态吞**(focused=true 且 last==W;focused=false 且 last≠W):零 WindowEvent。
   - **stage 路径共享**:UIAbility 主窗 handle_gained_focus(:731-799)与 LostFocus 臂(:1051-1076)各补一行 LAST_FOCUSED_WINDOW_ID 同步写(gain 写窗口 id,loss 归零),跨路径重复沿同样被吞;p2 #173 既有 mirror 写入语义不变。
- 依赖:p2 #173 focused 位写入面已就绪;本波 `is_focused()` 语义仍不变(p2 spec「is_focused semantics unchanged this phase」延续)。

### D8 scale 事件去噪(同属 #180,S 半)

**落点**:tao `src/platform_impl/ohos/event_loop.rs` ScaleFactorChanged(:1071-1107)。

- 方案:镜像 ThemeChanged 沿检测(:1116-1138,LAST_EFFECTIVE_THEME :47):`LAST_EFFECTIVE_SCALE: AtomicU64`(f64 按 to_bits 存储),新 scale 与快照按位相等 → 吞;不等(或首事件)→ 转发 + 更新快照。两条沿检测独立维护,互不影响。

### D9 #188 incognito(incognitoMode + cookie 桥联动)

**落点**:
1. NAPI:`crates/plugin-webview/src/lib.rs` `WebviewStyle`(:263-275,现有 x/y/width/height/visible/background_color)新增 `incognito: Option<bool>`(skip_serializing_if 兼容);`WebviewCreateRequest`(:357,devtools :371 先例)透传。
2. ArkTS(canonical)`plugins/webview/src/main/ets/WebviewPlugin.ets`:两分支 `Web()` 构造(:1386-1420 与 :1520)在 `payload.incognito === true` 时设置 `Web().incognitoMode(true)`(SDK20 :1927);默认 false 零变化。
3. cookie 桥:`fetchCookieSync`/`configCookieSync`(:2439/:2835)调用点补 incognito 第三参(源自该 webview 的 incognito 标志;wry 侧 cookies 三态 :1003-1057 调用链携带)。
4. wry:创建请求携带 incognito(WebViewAttributes incognito 既有位 → style 载荷)。

### D10 #219 4 类窗口命令 ack 链(serializeOpTracked)——两文件分工

**落点 A**:`native_ability/src/main/ets/window/WindowManager.ets`(串行化咽喉):
- `serializeOp`(:329-345)旁新增 `serializeOpTracked`——命令链延续语义不变,但 tracked promise 记录失败并 reject(不再静默吞)。
- 既有 `serializeOp` 调用点(:579/:718/:838/:851/:975)逐点核对归类:被 4 类命令覆盖的改走 serializeOpTracked,其余(非 4 类)保持吞错现状(改动面最小);`fireAndForget` 点(:748 setWindowTopmost/:770 setWindowTitle/:918 showWindowMethod/:929 hideWindow)随 4 类归类相应调整。

**落点 B**:`plugins/window/src/main/ets/WindowPlugin.ets`(命令臂):
- 4 个操作型命令改走 windowCommand await 先例(:1280-1316)+ 失败 throw:set-topmost(:912-918)、set-title(:920-926)、set-cursor-icon(:1214-1223,经 setPointerStyle 链)、set-cursor-visible(:1226-1233)。
- 3 个 void-setter 以 try/throw 上抛:set-decoration-flags(:1235-1243)、set-fullscreen(:648-660)、show(:899-901)。
- throw→Rust Err 先例形态参照本文件 focus 臂(:739/:751)与 set-decorations bool→throw(:623-649)。

**tao 消费侧核验(预期零代码)**:既有 `call::<Req, WindowAcknowledgement>().ensure()` 通道 + throw→Rust Err 先例已覆盖;核验 set_title/set_always_on_top/set_cursor_icon/set_cursor_visible/set_decoration_flags/set_fullscreen/set_show 调用点 Err 分支已有处理(warn 或返 Err),仅在缺处理处补 warn(预期零至 2 处)。

- **回归面最大**:WindowManager.ets 串行化链是全部窗口命令的咽喉;4+3 命令改动 + 链延续语义 → 319 全量硬门槛(SC2),任何新增 ❌ 即 BLOCKED 收敛。

### D11 验证矩阵(沿用 p2 D14 骨架 + 真机专项)

- **分层**:①定向 cargo test(各仓 -p 定向,UT 随代码);②设备 UT(ability/wry/tao 设备侧,--lib 必须);③319 例桌面全量回归(run-tests.sh,footer `*Report generated at end of test run.*` 判跑完,跑前禁 hilog -r);④真机专项(SC3)。
- **bot-gate 不作门槛**(存量红项 tauri-utils clippy::derivable_impls + metric BM002;要跑须先报备 PM)。
- **磁盘纪律**:>2min 命令一律后台跑 + 轮询文件判据;禁并发大构建;全 workspace 构建前查 df(D 盘 ~42G)。
- **SC3 真机专项**(MateBook Pro 桌面形态):#192 SPA 路由下 url() 真值、#198 vp≠1 设备(如有)bounds 换算、#188 incognito 创建+cookie 隔离、#189 关窗链无残留窗日志。

### D12 commit 计划与 churn 过滤

- commit 序列(分支统一 ohdev;**不 push**;按 tasks 执行序):ability-①(Rust NAPI:plugin-webview/display/app)→ tao-①(window.rs/event_loop.rs)→ wry-①(ohos/mod.rs)→ tauri-①(facade 披露行)→ ability-②(ArkTS canonical:WebviewPlugin.ets/FloatPage.ets/WindowManager.ets/WindowPlugin.ets)→ tauri-②(examples/api 用例 + build.rs AppManifest 四处)→ **tauri-③(openspec p3 产物 + 波末 device report 入库)**。
- canonical 源 4 文件入 commit,`package/` 为 gitignore 生成态不入;凡动 ArkTS:清 oh_modules + CompileArkTS + 重打 HAR(HAR pack 元数据:oh-package.json5 + index.ets)。
- churn 提交前过滤:schema.json、openharmony/.tauri/ 副本、ability.har、覆盖率产物、.botbrain。

## 跨 phase 架构约束映射(roadmap 11 条)

| # | 约束 | 本 phase 落点 |
|---|------|--------------|
| 1 | cfg 隔离铁律(cfg(target_env="ohos")/not(ohos)) | D1-D6/D8/D9 全部 OHOS 面;零 cfg(desktop) 新增(防 mobile reparent 坑) |
| 2 | NAPI 契约两端同步(#[napi] camelCase、Option skip) | D2 payload、D7 notifyWindowFocus、D9 WebviewStyle.incognito、D4 url 同步插件两端注册(#198 走既有 display 绑定,零 wire) |
| 3 | bridge 禁 recv_timeout/block_on | D4 三态分流零阻塞;D7 走既有 drain 形态 |
| 4 | ArkTS 全链(oh_modules+HAR) | D2/D7/D9/D10 ArkTS 面触发;D12 流程约束 |
| 5 | openharmony-ability 唯一 ArkTS 桥接仓 | D7 windowEvent 采集落 ability;wry/tao 只消费 NAPI |
| 6 | canonical 源纪律(package/ 生成态) | D12 commit 计划 |
| 7 | 验证口径(定向+设备 UT+319 全量;bot-gate 豁免) | D11 |
| 8 | R8 锚纪律(HEAD re-derive) | Context 修正定案;tasks 锚以 derive 后为准,setter 区锚实现期现场定位 |
| 9 | 不动 MenuBarComponent.ets(乙 #205) | D10 改动面点名排除 |
| 10 | churn 过滤 | D12 |
| 11 | 外部动作排除(不 push/不回 GitHub) | D12;SC 不含外部动作 |

## Risks

| 风险 | 等级 | 缓解 |
|------|------|------|
| #219 WindowManager 链改动引发窗口命令回归 | 高 | serializeOpTracked 链延续语义;4+3 命令最小改动面;319 全量硬门槛;任一新增 ❌ 即收敛停下定性 |
| #189 关窗链去门控后误 dispose(如重建竞态) | 中 | disposed 幂等保留;真机专项关窗链日志;319 全量 |
| #192 同步桥与 fetchCookieSync 共用 COOKIE_SYNC_APP 重入冲突 | 中 | 同形态直调已实证(fetchCookieSync);UT 覆盖三态;真机专项 SPA |
| #168 补发半新接入(fullscreen/maximized/focus)与既有回灌竞争 | 中 | 补发一次性(build 尾单次);mirror 回灌语义已有(p2 #173);UT 覆盖补发入队/重放 |
| #180① 配对合成与 stage 事件双发竞争 | 中 | LAST_FOCUSED_WINDOW_ID 单一沿检测共用;双发第二沿被吞;UT 覆盖跨路径重复沿 |
| SDK 副本与本地 SDK20 不一致(#186 门失效) | 低 | 当次构建 grep 复核前置门;缺席降级披露不硬编码 |
| Float windowEvent 在旧宿主缺 API | 低 | typeof 探测降级 + 结构化 warn(spec scenario 固化) |
| to_logical(vp) 在 vp≠1 真机引入几何回归 | 低 | 桌面 vp=1 恒等;绑定 ≤0 回落 1.0;真机专项仅核 #198 面;bounds cache 语义不变 |

## Test Design(spec→test 映射)

| Spec requirement | 测试层 | 用例 | 期望值 |
|------------------|--------|------|--------|
| ohos-window-ops/Creation-time attrs 播种与补发 | tao 设备 UT | 播种(always_on_top/decoration_flags 差异才发)+ 补发(fullscreen/maximized/focus)入队→握手重放;默认值零流量 | 未就绪入队后 queue len=1/参数;重放后 ops 计数=参数数;默认值→0 |
| ohos-window-ops/命令失败 ack 链 | 设备 UT + 319 | tracked reject→ensure Err;链延续;成功路径 | 失败命令返回 Err;后续命令 Ok;319 零新增 ❌ |
| ohos-with-webview/Drop 无条件 dispose | wry UT + 319 + 真机 | 主 webview Drop→Remove 派发;double-drop 幂等;未就绪入队 | Remove 派发计数=1;未就绪→queue 挂起(bridge 15s 兜底注记) |
| ohos-webview-bridge-fidelity/url() 三态 | wry UT + 真机 | Main 同步桥真值;Worker cache;Uninitialized cache | 三态返回值分别=live/cache/cache;零阻塞(超时护栏) |
| ohos-webview-bridge-fidelity/incognitoMode | 设备 UT + 真机 | incognito=true→wire 载荷+ArkTS 分支;默认零变化 | payload incognito=true;ArkWeb incognitoMode 生效 |
| webview-cookie-mgmt/Set a single cookie(MODIFIED) | 设备 UT + 319 | incognito 第三参透传;非 incognito 兼容 | fetchCookieSync/configCookieSync 收到 incognito 位;cookie 用例零回归 |
| webview-devtools-focus/open_devtools 排队 | wry UT + 设备 UT | 未就绪入队→重放;就绪直发;幂等 | SetDevtools 重放后 setWebDebuggingAccess(true);is_devtools_open=true |
| ohos-webview-https-scheme/method+headers | 设备 UT + CORS 4 例 | GET/POST method 穿透;headers 并行数组采集;缺字段回落;坏头跳过 | Request.method=POST;缺字段回落 method=GET/headers 为空;CORS 4 例全 PASS |
| ohos-webview-bounds/vp 接入 | wry UT | vp=1 恒等;vp=2 Physical 换算;绑定 ≤0 回落 | Physical(200,100)@vp=2 → ArkUI vp(100,50);Physical(100,50)@vp=1 → (100,50);回落=1.0 |
| ohos-window-focus-state/Float 焦点沿 | tao 设备 UT + 真机 | 激活沿写 focused=true + 前持焦窗合成 Focused(false);重复沿吞;跨路径去重 | mirror 翻转计数=真沿数;配对失焦事件=1;WindowEvent 无重复 |
| ohos-window-focus-state/Unsupported 降级 scenario | 既有 UT 形态复用 + 真机注记 | typeof 探测失败→warn 不 panic | (无新 UT;scenario 由降级分支实现 + 真机专项观察覆盖) |
| ohos-window-scale-events/ScaleFactorChanged 去噪 | tao 设备 UT | 同值吞;真变化转发;首事件转发 | 转发计数:重复 3 发→1;变化→2 |
| ohos-platform-limitations/披露两则 | 文档审计 | facade OHOS 行;SDK 门 + body 访问器缺席披露记录 | 披露行存在;SDK/body 复核结论记录在案 |

## Task Signals

- tags: `["ohos"]`
- routed_skills: `["rust-ohos"]`
- 判定:全波 OHOS 运行时库改动(tao/wry/ability),cfg 隔离与 OHOS 平台规范适用;零 BUILD.gn 变更(纯 cargo 仓 + ArkTS HAR 链),BUILD.gn 构建模板知识 N/A(与 p2 同判)。
