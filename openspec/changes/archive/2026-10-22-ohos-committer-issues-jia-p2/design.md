# Design: ohos-committer-issues-jia-p2

## Context

### 任务与证据基线(2026-10-20 设计期)

- 四仓 HEAD(设计期实测,即 p1 文档批 commit 本身):tao `9627c4e0` / wry `28f8c08` / openharmony-ability `3d10f73` / tauri `4f37e9f96`,分支统一 ohdev。p1 已并入:四仓文档批 + #169 latch 注释,施工起点即此。
- **scope 权威来源** = p1 `reconciliation-ledger.md`(38 行对账 + 尾部 scope 影响清单);本 phase = md 第 1 波 S 级代码修复的落地波。ledger 的裁剪已吸收:#179/#185 剔除(已修)、#190 收窄为①、#184 修法锚纠偏(字段非 OnceLock)、#225 落点重 derive。
- **本 phase 是行为波**:13 条 S 级行为变更 + 1 项真机仲裁;凡动 ArkTS 走全链(清 oh_modules + CompileArkTS + 重打 HAR,ability.har 缓存坑),与 p1 的「纯注释豁免」裁定相反。
- 仓库工作面:`D:\xuqiu\tauri-3.0\{tao,wry,openharmony-ability,tauri}`;本文锚写法沿用 p1 约定 `仓/路径:行`,行号为设计锚,**实现期重 derive,允许 ±5 漂移,超界回报**(D8-11)。

### SDK 事实纠偏(#181 方案前提)

md 与 roadmap 对 #181 写的 `Context.getConfiguration()` 在本地 SDK20 **不是公开 API**(设计期核查 `D:/sdk/20/ets/{ets1.1,ets1.2}/api/application/Context.d.ets` 零命中;UIAbilityContext/ApplicationContext 同)。可用替代:`resourceManager.getConfigurationSync()`(`@ohos.resourceManager.d.ets:1225`,`@since 20`)。resmgr `Configuration` 携带 colorMode/direction/screenDensity/locale/mcc(number)/mnc(number),**缺** language/fontSizeScale/hasPointerDevice/displayId/fontWeightScale。数值兼容已闭合:ConfigurationConstant(NOT_SET=-1/DARK=0/LIGHT=1)== resmgr(DARK=0/LIGHT=1)== ability crate(`NoSet=-1/Dark=0/Light=1`),零映射表。D2 按此纠偏落地,roadmap Phase Details 的 API 名以本节为准。

### SDK 落证补充(#191 ArkTS 半,审计 F2)

`WebCookieManager.clearAllCookiesSync` 本地 SDK20 d.ts(`D:/sdk/20/ets/ets1.2/api/@ohos.web.webview.d.ets:784`)标 **@since 20**,且整族(fetchCookieSync :721 / configCookieSync :737 / saveCookieAsync :755 等)同标——但 fetchCookieSync 低于 20 可用已被既有用例实证,**该族注解不可按字面采信**(与 p1 D1-3「SDK 副本注解只证字段事实」先例一致)。处置:D4 落地加**防御守卫**(typeof 探针 + try/catch,#222 先例),不可用时 warn 披露并继续既有清理逻辑,不阻塞;版本断言以当次构建 SDK 复核为准。`clearAllCookiesSync(false)` 参数语义按 d.ts(:779-780)释读:**false = 清非 incognito 存储(持久 + 会话 cookie 均含)**。

## D1: #221 StageEventType 恐慌转软失败(openharmony-ability,host 单测)

- **锚**:`openharmony-ability/crates/ability/src/stage/event.rs:19` `impl From<i32>` 携 `_ => panic!("Invalid StageEventType value: {}")`;唯一调用点 `crates/ability/src/lifecycle.rs:195` `StageEventType::from(event_type)`(window_stage_event NAPI 闭包内,`:183-211`)。系统侧任何未枚举值(系统升级/灰度新事件)当前直接 panic 整个 bridge 线程。
- **修法**:
  1. 删除 `impl From<i32>`,新增 `impl TryFrom<i32> for StageEventType`(`type Error = i32`,known 1..=6 映射,其余 `Err(v)`)。全仓 grep 确认 `StageEventType::from` 仅 :195 一处(实现期复验)。
  2. 调用点改 `match StageEventType::try_from(event_type) { Ok(e) => e, Err(v) => { log::warn!("[ability] unknown StageEventType value {}, ignoring", v); return Ok(()); } }`;既有 `_ => return Ok(())`(:205)防御臂保留(match 穷尽性仍需要)。
  3. 日志落 **call site 而非 enum impl**(库类型保持纯转换语义),复用 crate 既有 log 依赖。
- **测试**:`event.rs` 增 `#[cfg(test)]` host 单测——known 集合 1..=6 **逐值** `Ok` 映射;集合外负面用例 0/7/-1/2147483647 → `Err(同值)`。`crates/ability` host 可编(lifecycle.rs `continuation_tests` :1647 先例),随 `cargo test -p openharmony-ability --lib` 全绿。

## D2: #181 主题首回调前恒 Light → init 链尾主动灌入(openharmony-ability,SDK 纠偏)

- **症状**:tao `theme()`(`tao/src/platform_impl/ohos/window.rs:1912-1920`)读 app.configuration 的 colorMode;该值仅由系统 `onConfigurationUpdate` 回调链写入(`NativeAbility.ets:1378-1391` → NAPI `on_configuration_updated` 闭包,`crates/ability/src/lifecycle.rs:133-175`)。系统只在**变更**时回调 → 冷启动暗色模式下首次 `theme()` 恒返回 Light。
- **注入点定案(2026-10-20 审计 blocking-1 修正)**:`onConfigurationUpdate` 入口首行守卫 `if (!this.acceptingLifecycle) return`(:1379),主路径 `acceptingLifecycle` 仅在 module loop 结束后置 true(:495)——**loop try 块尾(:439-443)处守卫恒 false,在该处注入是静默 no-op**。修法(零新增 NAPI,复用既有回调链):
  1. `NativeAbility.ets` 主路径 onCreate 内、**module loop 结束且 `acceptingLifecycle` 置 true(:495)之后、onWindowStageCreate 之前**加嵌套 try/catch 注入一次(守卫已放行;时序早于任何窗口查询 theme,满足 spec「before any window queries the theme」):
     - `const cfg = moduleCtx.resourceManager.getConfigurationSync()`;
     - 按 `on_configuration_updated` 闭包所需键**手工合成** Configuration 对象:
       - **resmgr 直取 6 键**(逐键注释「resmgr 直取」):colorMode、direction、screenDensity、locale→language、mcc、mnc(后两者 resmgr 为 **number、app 侧 Configuration 为 string,须 `String()` 转换**后写入——tasks 5.1 口径,防类型错配);
       - **中性默认 4 键**(逐键注释「SDK20 resmgr 无此字段,中性默认」):fontSizeScale=1.0、fontWeightScale=1.0、hasPointerDevice=true、displayId=0;
     - 以合成对象调用既有 `this.onConfigurationUpdate(cfg)`(:1378 同一入口,此时守卫已放行)→ 走系统路径同一转发链,Rust 侧闭包原样写 app.configuration + 派发 Event::ConfigChanged。ConfigChanged 派发时窗尚未创建,tao 侧 `:1071+` 广播到零窗 + ThemeChanged 沿检测(:1108-1126)顺带建立 LAST_EFFECTIVE_THEME 基线——副作用安全。
  2. **两份副本同步**(`native_ability/src/main/ets/ability/NativeAbility.ets` + `package/src/main/ets/ability/NativeAbility.ets`)。
  3. **joined-instance 早退路径**(:250-272)不注入——该路径在 module loop 前返回,桥接闭包注册状态相同受限,与既有事件转发面的 pre-existing 限制同界,记 known limitation 不扩 scope。若任务期实证桥接注册早于 module loop,可把注入 helper 提前到 :272 前复用(注入点参数化),不改变方案结构。
- **验证**(真机,MateBook Pro SN 3QC0124C11000038):系统切暗色 → 冷启动 → hilog 注入行(合成 colorMode=0/Dark)+ 套件 `win.theme` 冒烟(driver-generated.ts:420-421)返回 Dark;浅色对照;结论(含暗色下 `theme()` 读值)记入 phase report。**`win.theme`=Dark 同时是「注入未被 :1379 守卫吞掉」的反证**(守卫吞没时注入链 no-op,theme 仍读旧值)。**不新增常驻套件用例**(暗色依赖会破坏 318 基线确定性)。
- **降级门**:若真机 `win.theme` 仍读 Light,**归因顺序 = 先排除守卫/时序吞没(:495 置位与注入相对顺序,加临时日志仲裁),再查 `getConfigurationSync` 返回值(colorMode NOT_SET 等)**——禁止直接归因「colorMode 异常」;披露 + 在 report 记结论,不阻塞波末(roadmap SC 允许 #181 真机验证「有结论」而非「必成功」)。

## D3: #231 console 日志治理 + 判读链保全(openharmony-ability;不动 MenuBarComponent.ets)

- **accelerator_matcher.ets**(helper,3 处 console.info):`:175-177`(combo + 全表)、`:192-194`(disabled 命中)、`:227`(getModifierKeyState 拒绝)→ 改 `hilog.debug`(domain 0x1999,tag 先例 key_synthesis.ets),**消息文本逐字保留**。调用上下文 = ArkTS UI 回调(FloatPage.ets:592 / MainPage.ets),非 NAPI 同步体内,hilog 安全(C5 反例不适用)。
- **WindowManager.ets `setPointerStyle`**(:1108-1131):**删除**成功 console.info(:1124-1126);**保留** warn(:1118)与 error(:1128)的 console 形态——该文件处于 NAPI 同步体内(hilog 禁区,`:1112-1116` 注释即 C5 先例),保留是正确行为,注释补一句「success 日志已移除(issue #231),failure 路径 console 为 NAPI 重入豁免」。
- **判读链保全**:`accel-inject-diag.sh`(工作区根,**非仓文件,不 commit**)grep `Accelerator|combo=` 依赖 hilog 可见性——debug 级需先 `hilog -b D` 开启、抓完恢复 `hilog -b I`;脚本 :17/:37 grep 区前加使能、收尾恢复。脚本改动不入仓不进 commit。
- **副本**×2(`native_ability` + `package` 各自的 helper/accelerator_matcher.ets、window/WindowManager.ets)。
- **明确排除**:`MenuBarComponent.ets` 归乙 #205,#231 与 #205 的同文件冲突对靠波次错开(约束 2)。

## D4: #191 clearAllBrowsingData 补清 cookie + 披露(openharmony-ability + wry + examples/api)

- **ArkTS**:`WebviewPlugin.ets clearAllBrowsingData`(:2445-2455)入口补清 cookie 调用(先于既有逻辑):
  - 主路径 `webview.WebCookieManager.clearAllCookiesSync(false)`(d.ts :779-780:参数 false = 清**非 incognito 存储**,持久 + 会话均含);
  - **防御守卫**(SDK 落证见 Context 节):调用前 `typeof webview?.WebCookieManager?.clearAllCookiesSync === 'function'` 探针 + try/catch(#222 typeof-probe 先例)——不可用或抛错时 `console.warn`/log 披露并**继续既有清理逻辑**,零阻断、零 panic 面;版本断言以当次构建 SDK 复核,不写死 11+/20 于守卫注释之外的代码语义;
  - 副本×2(diff 仅 :28 import 行)。
- **wry 披露半**:`wry/src/lib.rs clear_all_browsing_data`(:2301-2302)doc 补 OHOS 行——已清 cookie;**SSL cache / clientAuthCache 两缺口保留**(SDK20 无对应公开 API,设计期 d.ts 核查零命中),按 p1 披露格式措辞。
- **套件新用例**:`tauri/examples/api/src/lib/tests/core.ts` 在既有 clearAllBrowsingData 路由用例(:1422-1490)后新增 auto 用例——`document.cookie` 先 set → 调 clearAllBrowsingData → 断言 `document.cookie` 为空。**零新命令 → build.rs AppManifest 零改动**。预期基线 318 → **319**。

## D5: #233 createPdf 补 scale(ArkTS 双副本 + wry 注释纠偏)

- **ArkTS**:`WebviewPlugin.ets` `DEFAULT_PDF_CONFIG`(:2524-2534)与 cfg 构造器(:2536-2548)缺 scale;接口 `WebviewPdfConfig.scale?: number` 已在(:627)。构造器补 `if (cfg.scale !== undefined) { pdfConfig.scale = cfg.scale; }`(`@ohos.web.webview.d.ets` PdfConfiguration.scale :287 @since 20)。副本×2。
- **wry**:`wry/src/ohos/mod.rs` PDF 注释(:56-61)宣称「PdfConfiguration has no scale field」失实 → 更正为「scale 经 WebviewPdfConfig 透传(本波 #233)」,随 wry commit。

## D6: #174 主窗 setFocusable 真机仲裁(双支路判据一次定案)

- **现状**:tao `set_focusable`(`tao/src/platform_impl/ohos/window.rs:1256-1274`)对主窗 gate:`if window_id > 0`(:1258),else 分支 no-op + log(:1272「focusable is OS-managed」)。子窗路径经 bridge → ArkTS `setWindowFocusable`(`WindowManager.ets:603-613`;成功日志 :609 为 **hilog.debug 级**,失败 :1303 为 hilog.warn 级)。主窗是否真被 OS 拒绝**从未实测**(判据来源 = 2026-08-27 A/B 实测的间接推断,`tauri/doc/ohos-window-test-mapping.md` 行 44)。
- **仲裁流程**(真机,一次定案):临时 scratch 构建(仅注释 :1258 gate,不入 commit)→ run-tests.sh 全量跑 → hilog 判读主窗路径。**抓取前 `hilog -b D` 使能 debug 级(成功日志是 debug 级,默认 I 级不可见——不开启会系统性偏判 Branch B)、判读后 `hilog -b I` 恢复**;双证判读:①`setWindowFocusable: window 0` 成功行(:609)出现 → Branch A;②该行缺席而 :1303 `BusinessError` 失败 warn 出现(或辅以 BridgeHost 侧派发日志)→ Branch B。
- **Branch A(成功)**:移除 gate(主窗与子窗同路派发);失败分支保留结构化 warn(window id + 平台错误串);`tao/src/window.rs` facade set_focusable doc(:897-901)补 OHOS 行「forwarded to the window manager;主窗成败以系统仲裁为准(2026-10 仲裁记录)」。
- **Branch B(BusinessError/拒)**:保留 gate,把 :1272 no-op 升级为结构化 warn(含「OS-managed + 仲裁失败证据」),facade doc 补 OHOS 行「ignored — OS-managed(真机仲裁 YYYY-MM-DD,错误码 X)」。
- **共同约束**:套件行 44 判据与 `window-ops.ts:742-743` setFocusable 冒烟在两支路下均须保持绿(冒烟断言不含主窗 focusable 成败语义,预判零翻红,若翻红按 R2 处置);仲裁结论(支路 + 证据行)写入 phase report 与 tao commit message 正文。**scratch 构建产物不入任何 commit**。

## D7: #173 WindowStateMirror focused 位 + 初始快照(tao;#180① 前置基建,零行为面变化)

- **锚**:mirror 现仅 visible/fullscreen/maximized/minimized 四位(`window.rs:96-107`);`new()` :110-117;`WINDOW_MIRRORS` :173-175;注册点 :766-770;app 级 `HAS_FOCUS` static(`event_loop.rs:28`)。
- **修法**:
  1. mirror 加 `focused: AtomicBool`;构造时以 `HAS_FOCUS.load(SeqCst)` **初始快照**注册(注册点 :766-770,补齐「注册时刻前发生的焦点迁移不可见」缺口)。
  2. `handle_gained_focus`(:725-796)在 `HAS_FOCUS.store(true)`(:735)后按 window_id 写对应 mirror 位;LostFocus 臂(:1048-1070,:1062)对称写 false。mirror 查找 miss(窗口已 Drop)静默跳过(与既有 mirror 注销时序 :2002-2014 一致)。
  3. `is_focused`(:1310-1312)**不改**——仍读 app 级 HAS_FOCUS(语义变更属 p3 #180①,本波只落写入面)。
- **测试**:ohos 测试模块(:2051+)新用例——快照初值(gained 前注册=false / 后=true)、Gained/Lost 迁移写入、miss 容错。host `cargo test --lib` 不覆盖(cfg 门,测试层裁定见 D8),走 D14 编译门 + 设备链。

## D8: #184 bridge client 懒补取 + 成功覆盖(tao;ledger 锚纠偏的适配)

- **锚**:字段 `window_client: Option<WindowClient>`(:277);构造期捕获 :730-739(失败 warn-once 即 None);构造保存 :753;`bridge_client()` :851-860 现状 `.clone().or_else(|| { log::debug!(...); None })` **无补取路径**。`WindowClient::new = app.bridge()?`(`plugin-window/src/lib.rs:384-388` → `crates/ability/src/app.rs` bridge() :733-744 = RwLock read + clone,**非阻塞 host 安全**,无 recv_timeout)。
- **修法**:字段改 `Mutex<Option<WindowClient>>`(成功覆盖需要内部可变性;ledger 纠偏明确**不引入 OnceLock**——既有字段机制原地加固);`bridge_client()` 改:lock → Some 则 clone 返回;None 则重试 `WindowClient::new` 等价路径(存续的 app handle)→ 成功**覆盖字段**并返回;失败 warn-once(AtomicBool 去抖,装饰种子等热路径防日志风暴)。
- **读点改造清单**(Mutex 化非机械换 clone,直读处须 lock 内 clone;实现期 grep 复验):
  - :730-739 构造捕获(改写入 Mutex)、:753 构造保存;
  - :792 装饰种子(`if let Some(ref client)` 直读 → lock + clone);
  - **:1671 `set_cursor_grab` 内 `match &self.window_client` 直读**(match 持引用跨臂,须 lock 内先 clone 再 match,防跨锁点持有);
  - **:1796 `set_ignore_cursor_events` 内 `if let Some(ref client)` 直读**(同上);
  - :855 `bridge_client` 自身与消费方(dispatch_or_queue :875 等)。
- **测试层裁定(2026-10-20 审计 major 修正)**:tao ohos 平台层整体在 `#[cfg(target_env = "ohos")]` path 门内(`tao/src/platform_impl/mod.rs:29-30`),`ohos/window.rs:2051+` 测试模块 **host `cargo test --lib` 不编译不执行**。三用例(client 在 → 不触发补取;client 缺 + bridge ok → 补取 + 覆盖;client 缺 + bridge Err → None 且 warn 恰一次)落 ohos 测试模块,**断言载体用 AtomicBool 去抖状态而非日志捕获**(不依赖日志后端);验证 = ohos-target `--no-run` 编译门 + **设备 run-ut.sh 补跑**(tao 设备 UT 79/79 先例),与 D7 同判——**host `cargo test --lib` 全绿对本条零证明力**,不得在验收中引用。

## D9: #178 set_cursor_grab 失败面收口(tao 核验 + tauri 臂实修;审计 F1 重定 scope)

- **tao(核验型,预期零代码改动)**:HEAD 现场复核——`set_cursor_grab`(:1648-1707)的**两处异步失败路径(:1687-1694 / :1696-1703)已是含 window id + 平台错误串的结构化 `log::warn!`**(`8dd79f77` 引入,先于 10-12 快照;ledger :21 记录一致)。故 tao 侧**无实质残差**:任务面 = 实现期重 derive 后核验两处 warn 满足「不静默 + 含窗口标识符与错误串」判据即可;**仅当两处格式不一致(一处有 id 一处无)才做最小统一**,禁止为统一而统一引入噪音 churn(R8 超界回报纪律)。API<22 同步 Err(:1663-1667)与 `:1706` Ok 语义均不变。tao 层无 label 概念,判据用 **window id 标识符**(非 label)。
- **tauri(真缺口,实修)**:`tauri-runtime-wry/src/lib.rs` SetCursorGrab 主线程臂(:3989-3991)`let _ = window.set_cursor_grab(grab)` → `if let Err(e) = ... { log::warn!("failed to set cursor grab: {e}") }`。**log-only 跨平台变更,零功能行为变化**(值本就丢弃),不影响其他平台功能路径(铁律 2 判定:纯日志);如任务期审计仍判跨平台敏感,可 `#[cfg(not(any(windows, target_os = "macos")))]` 收窄,默认按全局 warn 设计。

## D10: #190① set_cookie 补 Expires/Max-Age(wry;scope 收窄后仅此一项)

- **锚**:`format_set_cookie_value`(:1411-1429)现只拼 name/value/Domain/Path 等,丢 Expires/Max-Age → 持久 cookie 落 ArkTS `configCookieSync` 后退化为会话 cookie。
- **修法**:cookie 0.18.2 `expires() → Option<Expiration>`(DateTime(OffsetDateTime) | Session)、`max_age() → Option<Duration>`、crate `pub use time` **零新依赖**(wry 现有 cookie 依赖 features 覆盖 std/parsing/formatting/macros,实现期核 Cargo.toml,缺则补 features 不换 crate):
  - `Expiration::DateTime(dt)` → IMF-fixdate:时间格式宏 `format_description!("[weekday repr:short], [day] [month repr:short] [year] [hour]:[minute]:[second] GMT")` + `to_offset(UTC)`(**IMF-fixdate ≠ Rfc2822 格式**,禁用 Rfc2822 直接 to_string);
  - `max_age()` → `Max-Age=<secs>`;
  - Session cookie 两键均省略(现状行为);
  - 同时出现时按 RFC 6265 §5.3 以 Max-Age 优先落 ArkTS(Expires 仍拼出,ArkTS 端语义由系统管)。
- **测试**:`src/ohos/mod.rs` 既有 tests 模块(:1447+)新用例——固定 OffsetDateTime → 精确 `Expires=Thu, 01 Jan 2026 00:00:00 GMT` 断言;max_age → `Max-Age=3600`;Session → 两键皆无;同时给 → 两键皆有。cfg 门同 D7/D14。
- **范围声明**:②已由上游 #110 关闭(零动作);③是回复素材(排除,澄清决策 2)。

## D11: #194 eval 失败以 "null" 回调(wry)

- **锚**:`PendingOp::Eval` 臂(:239-248)Err 分支仅 `log::warn!`(:246)即吞——上层 promise 永不 settle。
- **修法**:Err 分支保留 warn 后,以 `"null".to_string()` 走与 Ok 路径相同的回调调用形态(镜像 Ok 分支的 invoke 序列),pending promise 以 null resolve。
- **测试**:tests 模块新用例——构造 Eval 失败路径,断言回调收到 `"null"`(host 不可跑走 D14 门)。

## D12: #199 url_cache 预填 initial_url(wry)

- **锚**:url_cache 空 init(:378);initial_url(:350);ipc handler(:530-546)缺 URL 时 about:blank 兜底(:537-542)→ 页面导航完成前首个 invoke 拿到错误 URL。
- **修法**:init 时以 initial_url(规范化后)预填 url_cache;ipc handler 缓存命中优先,兜底分支保留。与既有 create 流程时序无冲突(url_cache 为本波引入消费面的唯一改动点)。
- **副作用披露(审计 F4)**:`url()`(:895-896)与 ipc handler(:536)共读同一 url_cache——预填后导航完成前 `url()` 返回值由空串变为 initial_url。方向良性(更真实),被全量回归覆盖;spec Requirement 措辞已按「URL 观察面」放宽(见 specs/ohos-webview-bridge-fidelity)。
- **测试**:tests 模块新用例——create 带 initial_url X → ipc handler 解析出 X 而非 about:blank。

## D13: #188 visible 一行直传(wry + facade doc)

- **锚**:create_req 解构(:323-348)的 `..`(:347)吞掉 style.visible;WebviewStyle 构造(:676-682)仅 background_color。wire 早已就绪:`plugin-webview/src/lib.rs WebviewStyle.visible: Option<bool>`(:273),ArkTS 消费面四点已通(`WebviewPlugin.ets:953-954/:1404/:1537/:2359`)。**零 NAPI 变更**。
- **修法**:解构补 visible 绑定(或直取 `create_req.style.visible`)→ WebviewStyle 构造 `visible: Some(visible)` 透传;`wry/src/lib.rs with_visible` doc(:971-977)「OpenHarmony: Ignored — the webview is always created visible」失实行更正为「forwarded as style.visible」。
- **测试**:tests 模块新用例——create visible=false → 出站 WebviewStyle 载荷含 `visible: false`。

## D14: 验证矩阵(四仓 cargo + 设备链)

| 层 | 命令 | 覆盖 |
|---|---|---|
| tao | `cargo test --lib`(host)+ `cargo test --lib --target aarch64-unknown-linux-ohos --no-run` | 存量 UT 全绿;#173/#184 cfg 门新测编译门(必须 --lib,examples 不编;host 对新测零证明力,见 D8) |
| wry | `cargo test --lib`(host)+ ohos-target `--no-run` | 存量 UT;#190①/#194/#199/#188 编译门 |
| ability | `cargo test -p openharmony-ability --lib`(host) | **#221 新单测实际运行**;#221 之外零 Rust 行为面 |
| tauri | `cargo test -p tauri-runtime-wry --lib`(host 存量 UT)+ `cargo check -p tauri -p tauri-runtime-wry` | #225/#178 编译;tauri-runtime Error::NotSupported(:123+)复用;**注记**:test 以 `-p tauri-runtime-wry` 面向改动 crate,不跑全 workspace(避免 examples 全编,roadmap SC2「四仓全绿」按此口径,tauri 全仓 UT 由既有 CI/设备链兜底) |
| 设备 | `.claude/skills/ohos-build/scripts/run-tests.sh 3QC0124C11000038 desktop` | 全量回归(预期 319 例);report footer `*Report generated at end of test run.*` 判跑完;**跑前禁 hilog -r**;#174 仲裁(hilog -b D 使能)与 #181 真机验证同机完成 |
| 设备 UT(补跑) | `run-ut.sh`(tao/wry) | D7/D8 ohos 模块新测实跑(tao 设备 UT 79/79 先例);非门槛可选项 |

- cfg 隔离自查:#225 早退 `#[cfg(target_env = "ohos")]` 块内(加性变更,无需 not(ohos));D9 tauri 臂全局 log-only(见 D9 判定);tao/wry 改动全在 ohos-only 文件(**tao ohos 模块新测 host 不编译执行,验证判据 = 编译门 + 设备 UT 补跑,D8**);ArkTS 面不触 cfg。桥接语义:D8 补取走 RwLock read(clone 语义),无 recv_timeout/block_on。

## D15: commit 计划(分支 ohdev;全部不 push,禁 GitHub 回复)

| 仓 | commit | 显式点名文件(禁 git add -A) |
|---|---|---|
| openharmony-ability | ① `fix(ability)`: #221 | `crates/ability/src/stage/event.rs`、`crates/ability/src/lifecycle.rs` |
| openharmony-ability | ② `fix(arkts)`: #181/#231/#191/#233(HAR 全链重打后) | `native_ability/src/main/ets/ability/NativeAbility.ets` + `package/.../NativeAbility.ets`;`helper/accelerator_matcher.ets` ×2;`window/WindowManager.ets` ×2;`plugins/webview/WebviewPlugin.ets` + `package/.../WebviewPlugin.ets` |
| tao | ① `fix(ohos)`: #173/#184/#178(核验)/#174 + facade doc | `src/platform_impl/ohos/window.rs`、`src/platform_impl/ohos/event_loop.rs`、`src/window.rs` |
| wry | ① `fix(ohos)`: #190①/#194/#199/#188/#233 注释 + doc | `src/ohos/mod.rs`、`src/lib.rs`(若 2.2 补 cookie features,`Cargo.lock` 单边 diff 随同) |
| tauri | ① `fix(runtime)`: #225/#178 + WindowExt doc | `crates/tauri-runtime-wry/src/lib.rs`、`crates/tauri-runtime-wry/src/window/mod.rs` |
| tauri | ② `test(api)`: #191 用例 | `examples/api/src/lib/tests/core.ts`(driver-generated.ts regen 产出若产生,随同) |
| tauri | ③ `chore(openspec)`: p2 产物 + 双 report | `openspec/changes/ohos-committer-issues-jia-p2/**`、`openspec/specs/ohos-event-lifecycle-forward/spec.md` + `openspec/specs/ohos-webview-print/spec.md`(归档前置规范化,tasks 7.1;**仅当 PM 裁定随本波收口**,否则剔除并留 R9 遗留)、`examples/api/device-report-1020-desktop.md`(若仍未入库)+ `examples/api/device-report-<MMDD>-desktop.md` |

- **churn 过滤**:tauri schema.json 构建空白 diff 不入 commit(git status 过滤);`openspec/changes/ohos-committer-issues-jia-master/roadmap.md` 的 p1 PM 未提交 diff **不属本 phase**,零触碰;`.tmp/`、`accel-inject-diag.sh`、#174 scratch 构建产物不入仓。
- tauri 仓推送面:origin-tauri 禁止提交/推送,仅本地 commit。

## 跨 phase 约束继承映射(roadmap 11 条逐条)

1. 不 push / 不回 issue / origin-tauri 禁提交:D15 全 commit 仅本地;回复素材(如 #190③)不落本波。✔
2. 不动 MenuBarComponent.ets(#231×#205 冲突对,波次错开):D3 明示排除 + tasks 5.3/7.2 双处 grep 审计。✔
3. 行为波 ArkTS 全链(清 oh_modules + CompileArkTS + 重打 HAR)+ NAPI 两端同步 + **副本同步**:ability commit ② 执行;#188/#233 走既有 wire 零 NAPI 变更;副本成对改(grep 审计 diff 对称,仅 import 行差异豁免)。**副本数对账**:roadmap 沿用「三副本」口径,本波 4 个涉改文件经 find 实测各 **×2**(native_ability + package;plugins 侧 WebviewPlugin.ets 与 package 侧互为两实体),与 p1 D8-4 grep 结论一致——按实测 ×2 执行,差异注记于此,不回改 roadmap 口径。✔
4. cfg 隔离铁律(OHOS 用 `cfg(target_env="ohos")`,Linux 依赖 `not(ohos)`)+ 桥接禁 recv_timeout + 主线程 block_on 规避:D14 自查节。✔
5. 新用例随波并入 + AppManifest 四处:本波零新命令(#191 用例复用既有命令),AppManifest 零改动;基线 318→319 不低于、❌=0;双 report 随 commit ③ 收口。✔
6. 验证矩阵 + #174/#181 真机结论:D14 表;两结论落 phase report。✔
7. scope 锚纪律:全部 HEAD 重 derive(ledger 纠偏清单基础上再核);#186(SDK 缺席)属 p3 不在本波。✔
8. commit 计列入 design(D15):按仓分 commit、显式点名、churn 过滤。✔
9. 回复纪律:回复素材(#190③ 披露纠偏、#174 仲裁结论转 issue 素材等)只入 ledger/report 索引,回复动作排除(澄清决策 2)。✔
10. 设备纪律:基线跑前禁 `hilog -r`;**Bash 显式绝对 cd**(多仓跳转,脚本用绝对路径调用,p1 D8-10 先例)。✔
11. 架构级决策升级:凡涉 trait 层级/crate 边界改动(本波设计判定为零)须 NEEDS_CONTEXT 升级 PM,不在任务内自行决策。✔

## Risks / Trade-offs

- [R1 #181 合成配置键缺漏致 NAPI 闭包读数失败,或注入被 `acceptingLifecycle` 守卫(:1379,主路径 :495 才置 true)吞没——注入点已按此定案移至 :495 后(见 D2 修法 1)] → 合成对象按闭包(lifecycle.rs:133-175)所需键逐键核对 + 注释来源(mcc/mnc String() 转换已入 D2);真机 hilog 注入行仲裁;`win.theme`=Dark 兼作守卫放行反证;降级门归因顺序 = 先排除守卫时序、再查 resmgr 返回值(D2 降级门)。
- [R2 #174 Branch A 若改变主窗焦点行为(如套件行 44 判据翻红)] → 判据双支路预写死(D6);翻红即回退 Branch B 并在 report 记录翻红证据,仲裁一次定案不反复。
- [R3 #184 Mutex 化触碰多处直读点(:792/:1671/:1796 持引用形态)引发锁问题] → 短临界区 + lock 内 clone(不在跨臂持有引用);D8 读点清单点名 + grep 复验兜底;无嵌套锁、无跨锁调用。
- [R4 HAR 缓存吞行为修复(ability.har 坑)] → commit ② 前强制全链(清 oh_modules + CompileArkTS + 重打 HAR);以 #181 注入行 hilog 证据作为「新 HAR 已生效」的探针。
- [R5 wry cookie time features 变更牵动 Cargo.lock] → 仅 wry 仓单边 lock 变化(随 wry commit ①);若 features 已覆盖则零 lock diff。
- [R6 #191 用例受 webview cookie 策略干扰] → 用例内先 set 后清、断言空;失败降级 skip 并披露(不计 ❌,基线表述 319 例含 skip)。
- [R7 D9 tauri 臂全局 warn 的跨平台敏感性争议] → 已按 log-only 判定零功能影响;审计若判敏感则 cfg 收窄(预案已写 D9)。
- [R8 行号锚漂移超界] → ±5 允许;超界重 derive 并回报,禁按旧锚硬插。
- [R9 两个既有主 spec 结构破损会拒收本 change 的归档(validate 实证 INFO):`ohos-event-lifecycle-forward` 与 `ohos-webview-print` 主 spec 携带残留 `## ADDED/MODIFIED Requirements` 头] → 与 p1 R7/任务 7.1 同类处方:归档前机械规范化(头改 `## Requirements`、游离 Requirement 收拢,内容零删改,PM 校验 diff 仅标题层级);**validate --strict 本身已通过**(INFO 非错误);处置已排入本波 tasks 7.1/7.4(commit ③ 内),**若 PM 裁定规范化不属本波则从 commit ③ 剔除并留为遗留**(D15 条件项),不阻塞产物。
- [R10 `clearAllCookiesSync` SDK 族注解 @since 20 与既有实证矛盾,低 API/mobile 设备为隐性失败面] → D4 防御守卫(typeof 探针 + try/catch,#222 先例)不可用时披露并继续既有清理;桌面高 API 设备回归覆盖不到该支路,守卫注释标注「当次构建 SDK 复核」(审计 F2)。

## Test Design

### 验收标准(roadmap Phase 2 SC × 本设计细化)

1. 13 条 S 级修复逐条落点命中(D1-D13 锚 ±5;#178 tao 侧按 D9 核验型收口),四仓 cargo 验证矩阵全绿(D14,含 tauri-runtime-wry host UT)。
2. 设备全量回归 ≥318 基线且 ❌=0,预期 319(新增 #191 用例);report footer 判据成立、provenance 记 HEAD。
3. #174 仲裁与 #181 真机验证各有一份结论(支路/证据行)入 phase report。
4. 凡动 ArkTS 的条目(#181/#231/#191/#233)HAR 全链重打证据在案(#181 注入行探针);副本 diff 对称审计通过。
5. `openspec validate ohos-committer-issues-jia-p2 --strict` 通过;commit 计划执行后四仓 `git status` 无计划外文件。

### Spec → 验证映射(含期望值列,审计 F8)

| spec 场景(specs delta) | 验证 | 层 | 期望值(具体值/判定) |
|---|---|---|---|
| ohos-event-lifecycle-forward(未知值忽略) | #221 host 单测 actual run | host cargo | 1..=6 → `Ok(对应变体)`;0/7/-1/2147483647 → `Err(同值)`;warn 文本含 `unknown StageEventType value` |
| ohos-window-focus-state(镜像 focused 位/快照) | tao ohos 测试模块 + --no-run 编译门 | host 编译 + 设备 | 注册时 HAS_FOCUS=true → mirror.focused=true;Gained→true/Lost→false;miss → 无 panic |
| ohos-window-focus-state(主窗 setFocusable 非静默) | #174 真机仲裁 + window-ops 冒烟 | 设备(一次性) | Branch A:主窗路径 hilog `setWindowFocusable: window 0` 成功(hilog -b D 使能);Branch B:结构化 warn 含仲裁证据;两支路下套件 setFocusable 冒烟 ✅ |
| ohos-window-ops(懒补取) | tao ohos 测试模块 --no-run 编译门 + 设备 run-ut.sh 补跑(D8 裁定,host 不实跑) | host 编译 + 设备 | 三例:cache hit 不补取;补取后覆盖(二次调用走 cache);Err → None 且 warn 恰 1 次(AtomicBool 状态断言,二次调用 0 新增) |
| ohos-window-ops(set_enabled Err) | tauri-runtime-wry host UT + cargo check + WindowExt doc 走查 | host cargo | OHOS `set_enabled` → `Err(Error::NotSupported(..))`;arm :3889 OHOS 下不可达 |
| ohos-window-ops(grab 失败不静默) | tao 核验(D9)+ tauri 臂实修 | host cargo + 设备 | tao :1687/:1696 两处既有 warn 含 window id + 错误串(核验);runtime 臂 Err → `log::warn!` 输出 |
| webview-cookie-mgmt(Expires/Max-Age) | wry tests(编译门) | host 编译 | 固定时刻 → `Expires=Thu, 01 Jan 2026 00:00:00 GMT`;max_age → `Max-Age=3600`;Session → 两键皆无;双给 → 两键皆有 |
| webview-cookie-mgmt(clearAllBrowsingData 清 cookie) | 套件新 auto 用例 | 设备 319 | set `k=v` 后 clear → `document.cookie` 为空;守卫不可用支路 → warn + 既有清理继续 |
| webview-cookie-mgmt(既有 set_cookie 三场景,MODIFIED 携带未变行为) | 既有套件 cookie 用例回归 | 设备 319 | 既有 cookie 用例 ✅ 不翻红 |
| ohos-webview-print(scale 透传) | 代码走查 + 设备既有 print 冒烟 | 设备 | cfg.scale=2.0 → createPdf 的 PdfConfiguration.scale==2.0;缺省 → 不设字段 |
| ohos-theme-forwarding(启动灌入) | #181 真机 hilog + win.theme 冒烟 | 设备(一次性 + 套件) | 暗色冷启动:注入行先于窗口创建日志且含 colorMode=0;`theme()` 返回 Dark(兼作 :1379 守卫放行反证) |
| ohos-webview-bridge-fidelity(eval null) | wry tests(编译门) | host 编译 | Eval Err → 回调载荷恰为 `"null"`(promise settle) |
| ohos-webview-bridge-fidelity(url 预填) | wry tests(编译门) | host 编译 | initial_url=X → ipc handler 解析 X(≠about:blank);无 URL 时兜底保留 |
| ohos-webview-bridge-fidelity(visible) | wry tests(编译门) | host 编译 | with_visible(false) → 出站载荷含 `visible: false`;doc 无「Ignored」失实句 |
| #231 日志治理 | accel-inject-diag.sh 判读链 | 设备(一次性) | `hilog -b D` 后 grep `Accelerator|combo=` 命中 debug 行;WindowManager 成功 info 行零命中 |

### 测试基础设施

- Fixtures:无新增。Shared:run-tests.sh 设备链、run-ut.sh 设备 UT 配方(tao/wry cfg 门新测补跑,非门槛)、accel-inject-diag.sh(工作区)。外部依赖:无新增。

## Task Signals

tags: [ohos]
routed_skills: [rust-ohos]

(PB-C:gn-guide 已查——本波全部改动走既有 cargo/hvigor 链,零 BUILD.gn 变更,rust-ohos 构建模板知识 N/A;桥接/NAPI 纪律与 cfg 铁律按记忆条目直接引用,不复述。)

## 审计处置记录(2026-10-20,rb-auditor CHANGES_REQUESTED → 已处置)

- **B1(blocking)已修**:D2 注入点仲裁——原锚 :439-443(loop try 块尾)处 `acceptingLifecycle` 尚为 false(:1379 守卫 `if (!this.acceptingLifecycle) return` 拒绝,主路径 :495 才置 true),按原设计落地注入是静默 no-op;注入点移至 **:495 之后(onCreate 内、onWindowStageCreate 前)**,R1/降级门/映射表同步增补守卫吞没失效模式与归因顺序。
- **B2(blocking)已修**:D14 tauri 行补 `cargo test -p tauri-runtime-wry --lib`(host 存量 UT,四仓 cargo test 完整性,不再 check-only 静默降级;口径注记见 D14 表)。
- **F1(major)已修**:D9 重定 scope——tao 侧 :1687-1694/:1696-1703 经复核为既有结构化 warn(8dd79f77),改为核验型任务(预期零代码,禁噪音 churn);spec「window label」改「window identifier」;真缺口收口到 tauri-runtime-wry 臂。
- **F2(major)已修**:D4 补 SDK 落证节(clearAllCookiesSync @since 20 族注解与 fetchCookieSync 实证矛盾) + typeof-probe/try-catch 守卫 + `false` 参数释读更正(清非 incognito 存储);spec 补降级场景;R10 新增。
- **F3-F8(minor)已修**:D8 读点清单补 :1671/:1796(持引用形态注记);D12 披露 url() 副作用;Context HEAD 更正为实测值(tao 9627c4e0/wry 28f8c08/ability 3d10f73/tauri 4f37e9f96);D15 补 Cargo.lock/driver-generated.ts 条件项与 R9 处置时机对齐 tasks 7.1/7.4;约束映射扩为 11 条(含 Bash 绝对 cd、三副本 ×2 对账注记);D2 键计数 6+4 更正 + mcc/mnc String() 转换;D14 tauri 补 `cargo test -p tauri-runtime-wry --lib` 并注记口径;映射表补期望值列;#174 仲裁判据补 hilog -b D 使能 + 双证(成功日志为 hilog.debug 级,默认 I 级不可见,不开启会系统性偏判 Branch B)。
