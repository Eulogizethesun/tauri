# Tasks: ohos-committer-issues-jia-p3

> 锚点路径以工作区根 `D:\xuqiu\tauri-3.0` 为参照;`tao::` `wry::` `ability::`(openharmony-ability)`tauri::` 四仓,分支统一 ohdev,**全部不 push、不回 GitHub**(origin-tauri 禁止提交)。
> file:line 为 2026-10-20/21 HEAD 设计锚(wry e5e9024):实现期重 derive,±5 内漂移直接落,超界(结构变化)须回报不得硬插(design R8)。
> 行为波纪律:ArkTS 面(#186/#180①/#188/#219)走 HAR 全链(清 oh_modules + CompileArkTS + 重打 HAR);NAPI 契约新增字段两端同步(#186 payload/#180① notifyWindowFocus/#188 WebviewStyle.incognito;#192 url 同步插件两端注册;#198 走既有 display 绑定零 wire);commit 用显式文件点名(禁 `git add -A`,churn 过滤:schema.json、openharmony/.tauri/ 副本、ability.har、覆盖率产物)。
> 顺序说明:Rust 批先行(§1-§4,host 可闭环),ArkTS 批殿后(§5);**不动 MenuBarComponent.ets(归乙 #205)**;bot-gate 不作门槛(存量红项 tauri-utils clippy::derivable_impls + metric BM002);>2min 命令一律后台跑 + 轮询判据,禁并发大构建。

## 1. tao 批:#168 播种 + #180① 消费 + scale 去噪 + #219 消费核验(commit tao-①)

- [x] 1.1 #168 UT 先行 —— anchor: tao::src/platform_impl/ohos/window.rs(ohos 测试模块) *(用例:①build() 携 always_on_top=true 且未就绪→PENDING_WINDOW_OPS 入队 1 条;②decoration_flags≠FLAG_ALL→set-decoration-flags 播种;③默认值→零播种;④就绪后 setter 直发不排队,design D1)*
- [x] 1.2 #168 build() 尾 attrs 播种+补发 —— anchor: tao::src/platform_impl/ohos/window.rs:594-741(UIAbility 分支尾)/:742-807(Float 分支尾) *(读 `always_on_top`(HEAD :1664 setter,attrs 位现场定位)与 `decoration_flags`,与默认值有差异才调既有 setter;补发半按 attrs 存在性调 set_fullscreen/set_maximized/set_focus(HEAD 零消费实证,design Context 修正 1);setter 已全走 dispatch_or_queue(:982-1027)→播种→补发零新增机制;upstream 先例 windows/window.rs:1338-1339;visible/icon/theme 不动——归披露 §4,design D1)*
- [x] 1.3 #180① UT 先行(沿去重+配对) —— anchor: tao::src/platform_impl/ohos/event_loop.rs(ohos 测试模块) *(用例:①首次激活沿→GainedFocus 转发 + mirror.focused=true + 前持焦窗合成 Focused(false)(配对语义);②同窗同态重复沿→吞、WindowEvent 零新增;③stage 路径与 Float 路径共享 LAST_FOCUSED_WINDOW_ID,跨路径重复沿同样吞,design D7)*
- [x] 1.4 #180① drain 消费(沿去重+配对合成) —— anchor: tao::src/platform_impl/ohos/event_loop.rs:875(status drain 旁) *(镜像 PENDING_WINDOW_STATUS 模板(ability::crates/ability/src/app.rs:1363-1395 供给端):drain_pending_window_focus → LAST_FOCUSED_WINDOW_ID: AtomicI64 变化沿 → 真增益沿先对前持焦窗合成失焦(失焦应用逻辑与 stage LostFocus 臂共用单一写入面)再走既有 handle_gained_focus(:731-799);失焦沿走 LostFocus 通路 + last 归零;stage 两臂(:731-799/:1051-1076)各补一行 last 快照同步写;is_focused() 语义不改,design D7)*
- [x] 1.5 scale 事件去噪 —— anchor: tao::src/platform_impl/ohos/event_loop.rs:1071-1107(ScaleFactorChanged) *(镜像 ThemeChanged 沿检测(:1116-1138,LAST_EFFECTIVE_THEME :47):LAST_EFFECTIVE_SCALE: AtomicU64 存 f64 to_bits;按位相等→吞;不等或首事件→转发+更新;与 ThemeChanged 沿检测互不影响,design D8;UT 补同值 3 发→转发 1 次计数断言)*
- [x] 1.6 #219 tao 消费侧静态核验(预期零代码) —— anchor: tao::src/platform_impl/ohos/window.rs(setter 区:ledger 快照 :1539 → HEAD 漂移至 :1664 附近,现场定位) *(逐点核验 set_title/set_always_on_top/set_cursor_icon/set_cursor_visible/set_decoration_flags/set_fullscreen/set_show 的 `ensure()` Err 分支已有处理(warn 或返 Err);仅缺处理处补 warn,预期 0-2 处;核验结论记 phase report,design D10)*
- [x] 1.7 验证 + commit tao-① —— `cargo test --lib`(host)全绿 + ohos-target `--no-run` 编译门(必须 --lib,examples 不编);点名 `src/platform_impl/ohos/window.rs`、`src/platform_impl/ohos/event_loop.rs` 提交 `fix(ohos): creation attrs seeding + float focus edge + scale dedup (committer #168 #180 #219)`

## 2. wry 批:#189/#192/#195/#198/#186/#188(commit wry-①)

- [x] 2.1 #189 去 is_child 门控 —— anchor: wry::src/ohos/mod.rs:1181-1185(dispose_child)/:1199-1203(Drop) *(删 `self.is_child &&` 前置,保留 disposed swap 幂等;注释更新「主/子 webview 统一 dispose」+ 悬挂边界注记(未就绪排队→bridge 15s 超时兜底,ability::crates/ability/src/bridge/mod.rs:31 实证);UT 补主 webview Drop→Remove 派发 + double-drop 幂等,design D3)*
- [x] 2.2 #192 url() 三态分流 —— anchor: wry::src/ohos/mod.rs:909-911(url())/cookies 三态模板 :1003-1057 *(main_thread_status() 三态:Main→COOKIE_SYNC_APP OnceLock + with_main_thread_bridge call_sync get-url(同 fetchCookieSync 机械 :1279-1310;插件寻址 = §3.2 的 WebviewUrlBridgePlugin ID ohos.webview-url)→写回 url_cache 返回真值;Worker→cache 回落;Uninitialized/失败→cache 回落 + debug 日志;**零 recv_timeout/block_on**;UT 补三态 + 超时护栏,design D4)*
- [x] 2.3 #195 open_devtools 排队 —— anchor: wry::src/ohos/mod.rs:155(PendingOp enum)/:927-936(open_devtools) *(新增 PendingOp::SetDevtools;try_handle 失败→dispatch_or_queue;就绪→既有 set_web_debugging_access 通道;`static DEVTOOLS_ENABLED: AtomicBool` 调用点置位 + 幂等;cfg 维持既有 devtools 门;UT 补排队→重放/就绪直发/幂等,design D5)*
- [x] 2.4 #198 to_logical(vp) —— anchor: wry::src/ohos/mod.rs:745-747(create)/:1153-1158(set_bounds) *(1.0 → ability 侧 `virtual_pixel_ratio()` 薄包装(§3.2 供给,ohos_display_binding 既有绑定);换算语义=Physical÷vp、Logical 输入恒等(design D6);bounds() :1149 cache 语义不动;UT 补 vp=1 恒等/vp=2 Physical(200,100)→(100,50)/绑定 ≤0 回落,design D6)*
- [x] 2.5 #186 Request builder —— anchor: wry::src/ohos/mod.rs:1311 *(payload 有值时追加 `.method()`(from_bytes 失败回落 GET+debug)/`.headers()`(并行数组 zip 重组;非法头名/值跳过+debug);缺省回落现状(method=GET/无 headers,旧版桥接兼容);UT 补 GET/POST/缺字段三例,design D2)*
- [x] 2.6 #188 wry 侧 —— anchor: wry::src/ohos/mod.rs:676-682 区(WebviewStyle 构造)/:1003-1057(cookie 调用链) *(attrs incognito → style 载荷 `incognito: Some(true)`;cookie 三态调用点携带 incognito 标志(经 §3.4 wire 传至 ArkTS 第三参);默认 false 零变化;design D9)*
- [x] 2.7 验证 + commit wry-① —— `cargo test --lib`(host)全绿 + ohos-target `--no-run` 编译门;点名 `src/ohos/mod.rs` 提交 `fix(ohos): dispose gate removal + sync url bridge + devtools queue + vp bounds + intercept method/headers (committer #189 #192 #195 #198 #186 #188)`

## 3. ability Rust 批:NAPI 契约新增 + 同步插件/绑定包装(commit ability-①)

- [x] 3.1 #186 payload struct —— anchor: ability::crates/plugin-webview/src/lib.rs:549(WebviewHttpsInterceptRequest) *(新增 `method: Option<String>`/`header_names: Option<Vec<String>>`/`header_values: Option<Vec<String>>`(并行同序;**不引入 HashMap——BridgeNapiType 手写宏无嵌套 map 先例,Vec<String> 有 protocols 先例**,design Context 修正 4);#[napi] camelCase 默认 + Option skip 序列化对齐存量契约纪律;design D2)*
- [x] 3.2 #192 url 同步插件 + #198 vp 薄包装 —— anchor: ability::crates/plugin-webview/src/lib.rs:1190-1263(WebviewCookieBridgePlugin/set_cookie_sync_app 模板区)/ability::crates/ability/src/display.rs:26(既有 ohos_display_binding import) *(①`WebviewUrlBridgePlugin`(ID ohos.webview-url)镜像 cookie 同步插件形态,`set_cookie_sync_app`(:1260-1263)内同点 register_plugin,COOKIE_SYNC_APP OnceLock 复用(按插件 ID 寻址,零新 OnceLock);②display.rs 新增 `virtual_pixel_ratio() -> f32` 薄包装(消费既有 `default_display_virtual_pixel_ratio() -> f32`,≤0/异常回落 1.0),re-export 供 wry(§2.4);UT 补插件 ID 注册断言 + 回落,design D4/D6)*
- [x] 3.3 #180① PENDING_WINDOW_FOCUS —— anchor: ability::crates/ability/src/app.rs:1363-1395(镜像 PENDING_WINDOW_STATUS 模板) *(存储 + `notify_window_focus(window_id: i64, focused: bool)`(#[napi] camelCase→notifyWindowFocus)+ drain_pending_window_focus;供给 §1.4 消费;design D7)*
- [x] 3.4 #188 WebviewStyle.incognito —— anchor: ability::crates/plugin-webview/src/lib.rs:263-275(WebviewStyle)/:357(WebviewCreateRequest,devtools :371 先例) *(新增 `incognito: Option<bool>`(skip 兼容);create 请求透传;design D9)*
- [x] 3.5 验证 + commit ability-① —— `cargo test -p openharmony-ability --lib`(host)全绿;点名 3 文件(plugin-webview lib.rs、ability display.rs、ability app.rs)提交 `fix(ability): url sync plugin + vp wrapper + napi contract additions (committer #192 #198 #186 #180 #188)`

## 4. tauri 批:facade 披露行(commit tauri-①)

- [x] 4.1 #168 facade 披露 —— anchor: tauri::crates/tauri/src/window/mod.rs(WindowBuilder Platform-specific 区,实现期 grep 定位) *(OHOS 行:visible/window_icon/theme 创建期不生效(设计 D1 披露三参数);always_on_top/decorations/fullscreen/maximized/focused 已播种/补发生效不在披露之列;tao::src/window.rs 同步对齐措辞)*
- [x] 4.2 验证 + commit tauri-① —— `cargo check -p tauri` 零 error(host);点名 2 文件提交 `docs(ohos): creation-time visual attributes limitation (committer #168)`

## 5. ArkTS 行为批:#186/#192/#188/#180①/#219 + HAR 全链(commit ability-②)

- [x] 5.1 #186 拦截采集 —— anchor: ability::plugins/webview/src/main/ets/WebviewPlugin.ets:1102-1170(handleHttpsIntercept)/:1805-1823(handleWebviewInterceptRequest)/:596-614(payload 类) *(采集 `getRequestMethod()`/`getRequestHeader()` 入 payload `method`/`headerNames`+`headerValues`(并行同序,Object.entries);**setResponseHeader 当次构建 SDK 复核前置门:grep 当次 SDK 副本,缺席→响应头写路径不实现,复核结论记 phase report**(design D2;specs/ohos-platform-limitations 已约束))* 
- [x] 5.2 #180① FloatPage windowEvent 订阅 —— anchor: ability::native_ability/src/ets/components/FloatPage.ets:156(windowStatusChange 注册点旁) *(typeof 探测 `win.on`/WindowEventType;WINDOW_ACTIVE(2)/WINDOW_INACTIVE(3)→notifyWindowFocus(windowId, true/false)(camelCase wire 对齐 §3.3);缺 API 降级:结构化 warn 不 panic;**windowFocusChange 在本地 SDK20 @ohos.window.d.ets 缺席(:2202-3005 重载表核验),windowEvent 是 @since 20 等价物**(design D7))*
- [x] 5.3 #192 get-url 同步 handler —— anchor: ability::plugins/webview/src/main/ets/WebviewPlugin.ets:2439(fetchCookieSync 注册形态) *(镜像 SyncPluginBase + invokeNativeSync 同步桥(BridgeHost.ets :1100/:1391-1456 既有):读 controller.getUrl() 回传;插件类与 cookie 同步插件**同一注册清单注册**(供 wry call_sync(§2.2)经 §3.2 插件消费);design D4)*
- [x] 5.4 #188 ArkTS 两分支 + cookie 第三参 —— anchor: ability::plugins/webview/src/main/ets/WebviewPlugin.ets:1386-1420 与 :1520(Web() 构造)/:2439(fetchCookieSync)/:2835(configCookieSync) *(payload.incognito===true → `Web().incognitoMode(true)`(SDK20 web.d.ets :1927 @since 20);两分支对称;cookie 调用点补 incognito 第三参(源 webview 标志);默认 false 零变化(design D9))*
- [x] 5.5 #219 serializeOpTracked + 7 命令 —— anchor: ability::native_ability/src/main/ets/window/WindowManager.ets:329-345(serializeOp 旁新增)/:912-918(set-topmost)/:920-926(set-title)/:1214-1223(set-cursor-icon)/:1226-1233(set-cursor-visible)/:1235-1243(set-decoration-flags)/:648-660(set-fullscreen)/:899-901(show) *(新增 serializeOpTracked:链延续 + tracked promise 失败 reject;4 操作型改 windowCommand await 先例(:1280-1316)+ 失败 throw;3 void-setter try/throw;WindowPlugin.ets 对应 4 臂 await+throw(:739/:751 throw 先例形态);serializeOp 调用点(:579/:718/:851/:838/:975)逐点核对归类,非 4 类保持吞错现状;**不动 MenuBarComponent.ets**(design D10))*
- [x] 5.6 HAR 全链 —— 清 oh_modules + CompileArkTS + 重打 HAR(pack.bat 后手动校验 package 同步,pack 命令行吃字符坑);canonical 源 4 文件(WebviewPlugin.ets/FloatPage.ets/WindowManager.ets/WindowPlugin.ets)入 commit,`package/` 为 gitignore 生成态不入
- [x] 5.7 commit ability-② —— 点名 canonical 4 文件提交 `fix(ability): intercept capture + float focus + incognito + tracked window ops (committer #186 #180 #188 #219)`

## 6. examples/api:新用例 + AppManifest(commit tauri-②)

- [x] 6.1 #192 url 同步用例 —— anchor: tauri::examples/api/src-tauri/src/main.rs(auto 用例区,实现期 grep 定位) *(SPA 导航后 url() 返回真值断言;期望值=导航后 URL 非空且匹配路由)*
- [x] 6.2 #188 incognito 用例 *(incognito webview 创建成功 + cookie 隔离断言;期望值=incognito 写 cookie 后主 webview 读不到)*
- [x] 6.3 #219 失败 ack 用例 *(对已销毁/非法窗口发 set-title→invoke 错误链断言;期望值=reject 而非假成功 ack)*
- [x] 6.4 AppManifest 四处同步 —— anchor: tauri::examples/api/src-tauri/build.rs(AppManifest 唯一真源) *(新增命令四处:manifest 声明/权限/入口/注册;schema.json churn 不入 commit)*
- [x] 6.5 commit tauri-② —— 点名 examples/api 变更文件 + build.rs 提交 `test(examples): url sync + incognito + ack-chain cases (committer #192 #188 #219)`

## 7. 波末回归 + phase report

- [ ] 7.1 319 例桌面全量回归 —— run-tests.sh;footer `*Report generated at end of test run.*` 判跑完(跑前禁 hilog -r);**SC2 硬门槛:零新增 ❌(基线 311✅/8⏭/0❌,report examples/api/device-report-1021-desktop.md)**;CORS 4 例(#186 定向面)+ 关窗面(#189)+ 窗口命令面(#219)重点复核;任一新增 ❌ 即停下定性,禁止带病收口
- [ ] 7.2 真机专项(SC3,roadmap) —— #192 SPA 路由 url() 真值、#198 vp≠1 设备 bounds 换算(如无 vp≠1 设备则记录桌面恒等结论)、#188 incognito 创建+cookie 隔离、#189 关窗链无残留窗日志
- [ ] 7.3 phase-report.md —— 四仓 UT 数字、SDK setResponseHeader 当次构建复核结论(§5.1 门)、tao #219 消费核验结论(§1.6)、HEAD re-derive 三修正回执、319 回归 report 路径、concerns
