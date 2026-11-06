# Tasks: ohos-committer-issues-jia-p2

> 锚点路径以工作区根 `D:\xuqiu\tauri-3.0` 为参照;`tao::` `wry::` `ability::`(openharmony-ability)`tauri::` 四仓,分支统一 ohdev,**全部不 push、不回 GitHub**(澄清决策 2;origin-tauri 禁止提交)。
> file:line 为 2026-10-20 HEAD 设计锚:实现期重 derive,±5 内漂移直接落,超界(结构变化)须回报不得硬插(design R8)。
> 行为波纪律:ArkTS 面(#181/#231/#191/#233)走 HAR 全链(清 oh_modules + CompileArkTS + 重打 HAR);NAPI 契约零变更(#188/#233 走既有 wire);commit 用显式文件点名(禁 `git add -A`,schema.json churn 过滤)。
> 顺序说明:Rust 批先行(§1-§4,host 可闭环),ArkTS 批与设备链殿后(§5-§6);#174 仲裁 scratch 构建产物不入任何 commit(design D6)。

## 1. ability Rust:#221 恐慌转软失败(host 单测实际运行)

- [x] 1.1 host 单测先行 —— anchor: ability::crates/ability/src/stage/event.rs(`#[cfg(test)] mod tests`)
  - 1..=6 逐值 `TryFrom` → `Ok(对应变体)`;0/7/-1/2147483647 → `Err(同值)`(design D1)
- [x] 1.2 `From<i32>` → `TryFrom<i32>`(type Error = i32)—— anchor: ability::crates/ability/src/stage/event.rs:19 *(panic 臂删除;实现期 grep 全仓复验 `StageEventType::from` 仅 lifecycle.rs 一处消费)*
- [x] 1.3 调用点改造 + warn 落 call site —— anchor: ability::crates/ability/src/lifecycle.rs:195 *(match try_from;Err 臂 `crate::warn!("unknown StageEventType value {}, ignoring", v)` + `return Ok(())`;既有 `_ => return Ok(())` :205 防御臂保留)*
- [x] 1.4 host 验证 + commit ability-① —— `cargo test -p openharmony-ability --lib` 全绿(新单测 actual run);点名 `crates/ability/src/stage/event.rs`、`crates/ability/src/lifecycle.rs` 提交 `fix(ability): StageEventType unknown value soft-fail instead of panic (committer #221)`

## 2. wry Rust 批:#190①/#194/#199/#188 + 文档(commit wry-①)

- [x] 2.1 #190① 测试先行 —— anchor: wry::src/ohos/mod.rs:1447+ tests 模块 *(固定 OffsetDateTime → `Expires=Thu, 01 Jan 2026 00:00:00 GMT` 精确断言;max_age → `Max-Age=3600`;Session → 两键皆无;同时给 → 两键皆有,design D10)*
- [x] 2.2 #190① format_set_cookie_value 补两属性 —— anchor: wry::src/ohos/mod.rs:1411-1429 *(cookie 0.18.2 `pub use time` 零新依赖;IMF-fixdate 用 `format_description!("[weekday repr:short], [day] [month repr:short] [year] [hour]:[minute]:[second] GMT")` + `to_offset(UTC)`,禁 Rfc2822;Max-Age 按 RFC 6265 §5.3 优先语义注释;实现期核 wry Cargo.toml cookie features 覆盖 std/parsing/formatting/macros,缺则补 features)*
- [x] 2.3 #194 Eval Err 分支 "null" 回调 —— anchor: wry::src/ohos/mod.rs:239-248 *(warn 保留,Err 臂以 `"null".to_string()` 镜像 Ok 分支回调形态;tests 模块补失败路径用例)*
- [x] 2.4 #199 url_cache 预填 initial_url —— anchor: wry::src/ohos/mod.rs:378(init)/:350(initial_url)/:530-546(ipc handler 兜底保留) *(规范化后预填;tests 补 create-with-URL 用例;副作用披露:`url()` :895-896 共读 cache,导航前返回空串→initial_url,direction 良性,design D12)*
- [x] 2.5 #188 visible 直传 —— anchor: wry::src/ohos/mod.rs:323-348(解构补 visible,:347 `..` 失吞)/:676-682(WebviewStyle 构造补 `visible: Some(visible)`);wry::src/lib.rs:971-977(with_visible doc「Ignored — always created visible」失实行更正为 forwarded as style.visible) *(wire 就绪零 NAPI;tests 补出站载荷断言)*
- [x] 2.6 #233 wry 侧注释纠偏 —— anchor: wry::src/ohos/mod.rs:56-61 *(「PdfConfiguration has no scale field」失实 → scale 经 WebviewPdfConfig 透传,Sdk20 @since 20)*
- [x] 2.7 #191 披露半 —— anchor: wry::src/lib.rs:2301-2302(clear_all_browsing_data doc 补 OHOS 行:已清 cookie;SSL cache / clientAuthCache 两缺口保留,SDK20 无公开 API,p1 披露格式措辞)
- [x] 2.8 验证 + commit wry-① —— `cargo test --lib`(host)全绿 + `cargo test --lib --target aarch64-unknown-linux-ohos --no-run` 编译门(cfg 门新测);点名 `src/ohos/mod.rs`、`src/lib.rs`(2.2 若补 features 连同 `Cargo.lock` 单边 diff)提交 `fix(ohos): bridge fidelity & cookie persistence (committer #190 #191 #194 #199 #233)`

## 3. tao 批:#173/#184/#178/#174(commit tao-①)

- [x] 3.1 #184 host 单测先行 —— anchor: tao::src/platform_impl/ohos/window.rs(ohos 测试模块 :2051+) *(三例:client 在 → 不补取;client 缺 + bridge 可用 → 补取 + 覆盖;client 缺 + bridge Err → None 且 warn 恰一次(连调两次断言去抖),design D8)*
- [x] 3.2 #184 Mutex 化 + 懒补取 —— anchor: tao::src/platform_impl/ohos/window.rs:277(字段 `Mutex<Option<WindowClient>>`)/:730-739(构造捕获改写入)/:753(构造保存)/:851-860(bridge_client 补取 + 成功覆盖 + AtomicBool warn-once 去抖)/:792(装饰种子 if-let 直读)/:1671(set_cursor_grab match 直读)/:1796(set_ignore_cursor_events if-let 直读) *(直读三处须 lock 内先 clone 再 match/if-let,防跨臂持引用;补取走 RwLock read clone 语义,禁 recv_timeout/block_on;实现期 grep 复验消费方 :875 dispatch_or_queue 等,design D8)*
- [x] 3.3 #173 mirror focused 位 —— anchor: tao::src/platform_impl/ohos/window.rs:96-107(Struct 加 `focused: AtomicBool`)/:110-117(new)/:766-770(注册以 `HAS_FOCUS.load(SeqCst)` 快照播种);tao::src/platform_impl/ohos/event_loop.rs:735(GainedFocus 写 true)/:1062(LostFocus 写 false,miss 静默跳过) *(is_focused :1310-1312 不改——语义变更属 p3 #180①,本波只落写入面;ohos 测试模块补快照初值/迁移写入/miss 容错三用例,design D7)*
- [x] 3.4 #178 tao 侧核验(预期零代码改动)—— anchor: tao::src/platform_impl/ohos/window.rs:1687-1694/:1696-1703 *(HEAD 复核:两处异步失败已是含 window id + 平台错误串的结构化 warn(8dd79f77 引入)——判据「不静默 + 含窗口标识符与错误串」逐处核验记 phase report;**仅当两处格式不一致才做最小统一,禁止为统一而统一的噪音 churn**;API<22 Err :1663-1667 与 :1706 Ok 不动,design D9;真缺口 = §4.2 runtime 臂)*
- [x] 3.5 #174 真机仲裁(一次定案)—— scratch 构建仅注释 :1258 `if window_id > 0` gate → 设备 3QC0124C11000038 部署 → **抓取前 `hilog -b D` 使能 debug 级、判读后 `hilog -b I` 恢复(成功日志是 hilog.debug 级,默认 I 级不可见,不开启会系统性偏判 Branch B)** → 双证判读:①`setWindowFocusable: window 0` 成功行(WindowManager.ets:609)出现 → Branch A;②该行缺席而 :1303 `BusinessError` 失败 warn 出现(或辅以 BridgeHost 侧派发日志)→ Branch B → 按 design D6 落胜者支路(A 去 gate+结构化失败 warn / B 保留 gate+:1272 no-op 升级结构化 warn);**scratch 改动回退,胜者分支落码**
- [x] 3.6 #174 facade doc —— anchor: tao::src/window.rs:897-901(set_focusable Platform-specific 补 OHOS 行,措辞随胜者支路;Branch A「forwarded,成败以系统为准+仲裁日期」/Branch B「ignored — OS-managed+仲裁证据」)
- [x] 3.7 验证 + commit tao-① —— `cargo test --lib`(host)全绿 + ohos-target `--no-run` 编译门(cfg 门新测;必须 --lib,examples 不编);点名 `src/platform_impl/ohos/window.rs`、`src/platform_impl/ohos/event_loop.rs`、`src/window.rs`(3.4 若零改动则 window.rs 仅含 3.2/3.3/3.5 产物)提交 `fix(ohos): focus mirror + bridge client re-fetch + cursor grab warn verification + setFocusable arbitration (committer #173 #174 #178 #184)`

## 4. tauri-runtime:#225/#178(commit tauri-①)

- [x] 4.1 #225 dispatcher 早退 Err —— anchor: tauri::crates/tauri-runtime-wry/src/lib.rs:2403-2407(WindowDispatcher::set_enabled 加 `#[cfg(target_env = "ohos")]` 早退 `Err(Error::NotSupported(..))`;主线程 arm :3889 **不动**——OHOS 下此后不可达)
- [x] 4.2 #178 runtime 臂 warn(本条真缺口)—— anchor: tauri::crates/tauri-runtime-wry/src/lib.rs:3989-3991(`let _ = window.set_cursor_grab(grab)` → `if let Err(e) ... log::warn!`;log-only 跨平台变更,零功能行为差;审计若判跨平台敏感按 D9 预案 cfg 收窄)
- [x] 4.3 WindowExt doc —— anchor: tauri::crates/tauri-runtime-wry/src/window/mod.rs:29(set_enabled OHOS 返回 Err 行)/:36(is_enabled 恒 true 语义行)
- [x] 4.4 验证 + commit tauri-① —— `cargo test -p tauri-runtime-wry --lib`(host 存量 UT,roadmap SC2 口径,design D14 注记)+ `cargo check -p tauri -p tauri-runtime-wry` 零 error(host)+ ohos-target check;点名 2 文件提交 `fix(runtime): set_enabled NotSupported on OHOS + cursor grab warn (committer #225 #178)`

## 5. ArkTS 行为批:#181/#231/#191/#233 + HAR 全链(commit ability-②)

- [x] 5.1 #181 主题初始灌入 —— anchor: ability::native_ability/src/main/ets/ability/NativeAbility.ets:**:495 之后**(主路径 module loop 结束、`acceptingLifecycle` 置 true 后、onWindowStageCreate 前,嵌套 try/catch 注入一次)+ ability::package/src/main/ets/ability/NativeAbility.ets(副本) *(**注入点仲裁(design D2/审计 B1):onConfigurationUpdate 入口首行守卫 `if (!this.acceptingLifecycle) return`(:1379),主路径 acceptingLifecycle 仅 :495 置 true——loop try 块尾(:439-443)处守卫恒 false,在该处注入是静默 no-op,禁用旧锚**;`resourceManager.getConfigurationSync()` 合成 Configuration:resmgr 直取 6 键 locale→language/colorMode/direction/screenDensity/mcc/mnc(后两者 resmgr 为 number,须 `String()` 转换——防类型错配),缺省 4 键中性默认(fontSizeScale=1.0/fontWeightScale=1.0/hasPointerDevice=true/displayId=0)逐键注释来源;经既有 onConfigurationUpdate 入口 :1378 同链转发(此时守卫已放行);joined-instance 早退路径 :250-272 不注入,known limitation)*
- [x] 5.2 #231 accelerator_matcher 日志降级 —— anchor: ability::native_ability/src/main/ets/helper/accelerator_matcher.ets:175-177/:192-194/:227 + package 副本 *(3 处 console.info → hilog.debug(domain 0x1999,tag 先例 key_synthesis.ets;消息文本逐字保留——accel-inject-diag.sh grep `Accelerator|combo=` 判据不变);文件头补 hilog import)*
- [x] 5.3 #231 WindowManager 成功日志删除 —— anchor: ability::native_ability/src/main/ets/window/WindowManager.ets:1124-1126 + package 副本 *(NAPI 同步体 hilog 禁区(C5 注释 :1112-1116 自证)→ 删除成功 console.info;warn :1118/error :1128 保留;注释补「success 日志已移除(issue #231),failure console 为 NAPI 重入豁免」;**不动 MenuBarComponent.ets(归乙 #205)**)*
- [x] 5.4 #191 clearAllBrowsingData 清 cookie —— anchor: ability::plugins/webview/src/main/ets/plugins/webview/WebviewPlugin.ets:2445-2455 + package 副本 *(入口补 `webview.WebCookieManager.clearAllCookiesSync(false)`(false = 清非 incognito 存储,持久 + 会话均含,d.ts :779-780)**先于既有逻辑,带防御守卫**:typeof 探针 `typeof webview?.WebCookieManager?.clearAllCookiesSync === 'function'` + try/catch(#222 先例;SDK 族 d.ts 标 @since 20 但整族注解与 fetchCookieSync 实证矛盾,不可按字面采信)——不可用/抛错时 warn 披露并继续既有清理,零阻断零 panic,design D4/R10)*
- [x] 5.5 #233 createPdf scale 透传 —— anchor: ability::plugins/webview/src/main/ets/plugins/webview/WebviewPlugin.ets:2536-2548(cfg 构造器补 `if (cfg.scale !== undefined) { pdfConfig.scale = cfg.scale; }`,接口 :627 已就绪)+ package 副本 *(双副本 diff 对称审计:仅 :28 import 行差异,其余逐字节同)*
- [x] 5.6 accel-inject-diag.sh 判读链更新(工作区文件,不 commit)—— anchor: `D:\xuqiu\tauri-3.0\accel-inject-diag.sh`:17/:37(grep 区) *(捕获前 `hilog -b D` 使能 debug、收尾 `hilog -b I` 恢复;BridgeHost [DBG-*] 不动)*
- [x] 5.7 HAR 全链重打 + 部署 —— 清 oh_modules + CompileArkTS + 重打 HAR(ability.har 缓存坑);hap 构建日志零 `module setup THREW`;以 #181 注入行 hilog 证据作为「新 HAR 已生效」探针(design R4)
- [x] 5.8 commit ability-② —— 点名 8 文件(NativeAbility.ets ×2、accelerator_matcher.ets ×2、WindowManager.ets ×2、WebviewPlugin.ets ×2)提交 `fix(arkts): theme init injection + accelerator log hygiene + cookie clear + pdf scale (committer #181 #231 #191 #233)` **(实现期事实修正:package/ 为 gitignore 的生成态 staging(commit 371d3d01,#87 minor-8,pack.bat xcopy 自 native_ability 再生)——实际入 commit=4 个 canonical 源文件,4 个 package 镜像仅工作区刷新+字节校验;commit 6e59c4b)**

## 6. 套件用例 + 设备回归 + 真机结论(tauri commit ② 素材)

- [x] 6.1 #191 套件新用例 —— anchor: tauri::examples/api/src/lib/tests/core.ts:1422-1490(clearAllBrowsingData 路由用例后新增) *(document.cookie set → clearAllBrowsingData → 断言空;零新命令,build.rs AppManifest 零改动;失败降级 skip 并披露不计 ❌,design R6)*
- [x] 6.2 设备预检 —— SN 3QC0124C11000038(`hdc list targets`);残留窗排查(列窗确认无套件残留透明窗;**禁 `hilog -r`**)
- [x] 6.3 全量桌面回归 —— `.claude/skills/ohos-build/scripts/run-tests.sh 3QC0124C11000038 desktop`;判跑完 = report footer `*Report generated at end of test run.*`;预期 **319 例 ≥ 基线 318(311✅/7⏭/0❌)且 ❌=0**;产物 `tauri::examples/api/device-report-<MMDD>-desktop.md`(provenance 记 HEAD)
- [x] 6.4 #181 真机验证结论 —— 系统切暗色 → 冷启动 → hilog 注入行(合成 colorMode=0/Dark)先于窗口创建日志 → `win.theme` 冒烟(driver-generated.ts:420-421)读 Dark;浅色对照;**`win.theme`=Dark 兼作「注入未被 :1379 守卫吞掉」的反证**;结论(含降级门裁定——归因顺序 = 先排除守卫/时序吞没(:495 置位相对顺序,临时日志仲裁),再查 resmgr 返回值,禁直接归因「colorMode 异常」,design D2)落 phase report;**不新增常驻套件用例**
- [x] 6.5 #231 判读链复验 —— 更新后 accel-inject-diag.sh 跑一轮,hilog debug 级 `Accelerator|combo=` 行可见(5.2 生效证明)
- [x] 6.6 #174 仲裁结论回写 —— 支路(A/B)+ hilog 证据行 + 仲裁日期记 phase report 与 tao commit message 正文(D6)
- [x] 6.7 commit tauri-② —— 点名 `examples/api/src/lib/tests/core.ts`(driver-generated.ts 若 regen 产出一并)提交 `test(api): clearAllBrowsingData cookie assertion (committer #191)`

## 7. 收尾:主 spec 规范化 + diff 审计 + openspec commit(tauri commit ③)+ validate

- [x] 7.1 两个目标主 spec 结构规范化(validate 期发现的既有破损,非本 delta 引入;不做则 openspec archive 将拒收本波 delta,p1 7.1 先例;**若 PM 裁定规范化不属本波则从 7.4 剔除并留 R9 遗留**)—— anchor: tauri::openspec/specs/ohos-event-lifecycle-forward/spec.md:11(`## ADDED Requirements` 头改 `## Requirements`,其下 :13/:33/:56 三个游离 Requirement 收拢) + tauri::openspec/specs/ohos-webview-print/spec.md(:6 `## ADDED Requirements` 头改 `## Requirements`;:59 `## MODIFIED Requirements` 头删除——其下 requirement 并入同一 Requirements 节) *(机械重排,标题层级外内容零删改;PM 校验时 diff 应仅见标题层级)*
- [x] 7.2 行为波 diff 审计 —— 四仓 commit 逐个 `git show`:ArkTS 两副本 diff 对称(仅 :28 import 行差异豁免);NAPI 契约零 diff(napi crate 层);Cargo.toml 零 diff(若 2.2 补 features 则 Cargo.lock 单边 diff 入 wry commit,R5);MenuBarComponent.ets 零触碰;schema.json churn 不入;**3.4 核验结论(零代码或最小统一)入 phase report**
- [x] 7.3 spec 契约走查 —— 7 个 specs delta 的每个 Scenario 对应 D1-D13 落点 grep/单测/套件验证;结果记 phase report
- [x] 7.4 commit tauri-③ —— 点名 `openspec/changes/ohos-committer-issues-jia-p2/`(proposal/design/tasks/specs/.openspec.yaml)+ `openspec/specs/ohos-event-lifecycle-forward/spec.md`、`openspec/specs/ohos-webview-print/spec.md`(7.1 规范化,条件项见 7.1)+ `examples/api/device-report-<MMDD>-desktop.md` + `examples/api/device-report-1020-desktop.md`(若仍未入库)提交 `chore(openspec): p2 S-level behavior wave + dual device reports (ohos-committer-issues-jia-p2)`;**roadmap.md 不入(p1 未提交 diff 占用,PM 置 ✓ 后随 master 收口)**
- [x] 7.5 全仓终检 —— 四仓 `git status` 干净(仅允许既有未跟踪构建产物与 schema.json churn);commit 清单与 D15 计划一致(7.1 规范化两文件为 validate 期新增条件项);**不 push**;PM 知会包(基线数字 319 + #174/#181/#178 核验结论 + 本 change 路径)就绪
- [x] 7.6 openspec validate --strict —— 四产物 + 7 specs delta 通过(PM 校验前自检)
