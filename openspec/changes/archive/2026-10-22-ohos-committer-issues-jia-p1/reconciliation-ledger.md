# 甲 38 条全量对账表(reconciliation-ledger)

> change: ohos-committer-issues-jia-p1 · 设计期预置(2026-10-20,HEAD:tao d42e8950 / wry 8e381e6 / ability 5c4b5a9 / tauri f6bb0889f)
> 方法论与三态判定规则见 design.md D1;列 schema 见 design.md D2;四簇证据结论见 design.md D3;本表是唯一权威对账产物,p2/p3 设计与后续回复从这里取数。
> 「待任务核验(预判未动)」行的 HEAD 列须由任务 1.x 按 D1 四步落证后转正;预判不构成判定(design R5)。

## 对账总表

| # | 主题 | 落点仓 | 10-12 判定(md) | md 波次 | HEAD 判定 | HEAD 证据(file:line + commit) | 残差去向 | 备注/回复素材要点 |
|---|---|---|---|---|---|---|---|---|
| 168 | 创建期参数仅部分读取 | tao+ability+tauri | 属实 A+B,分层 M | p3(M)+披露 | **残差** | 几何已修:tao `15491f9d`+`823318fa`(start_options_geometry,platform_impl/ohos/window.rs:405-598+单测 :2090-2130)、ability `d7e8e3a0`(app-control start-ui-ability)、tauri `1a34b6b97`(传播+断言)。参数面:build() 对 window_attrs.{fullscreen,maximized,focus,visible} 零消费(grep 0 命中,设计期预证);主窗分支无 decorations 通道 | p3 #168(几何不重做;播种→补发→披露分层);visible 按披露 | p3 scope 加「几何面已修」防重做;StartOptions 官方约束(T26-N3)注释可作披露素材 |
| 169 | 多 UIAbility 仅支持 1 个 | tao | 部分属实 D | 回复+p1 注释 | **残差(注释半)** | 旧 UIABILITY_CREATED 已被 FIRST_WINDOW_CREATED 取代(platform_impl/ohos/window.rs:67 注释自证);latch 块 :458-482;Drop :2002-2014 仅注销 mirror 不复位 latch;spawn 链已恢复(db864605 轨道) | p1 注释(声明处 :69);回复 | 回复素材:spawn 链恢复+后续 UIAbility 合法+latch process-lifetime 语义;测试映射「多窗口」行可佐证 |
| 170 | resize/move 1300002 注释失实 | tao+ability+tauri | 属实 C | p1 | **残差** | tao window.rs:757-761/:789-793 失实文本在(58ad4377 引入未动);ability WindowManager.ets:305-306(native_ability+package 两副本);tauri/doc/ohos-window-test-mapping.md :23-24 与 :72-73 矛盾实锤 | p1 文档批(三仓) | 更正事实基:派发链无条件执行、resize 受 WM 钳制、move 效果 JS 不可靠读回、1300002 仅异常态瞬时 |
| 171 | setAlwaysOnBottom 空实现 | tao | 属实 B+C | p1 | **残差** | platform_impl/ohos/window.rs:1537 空体零 warn;facade window.rs:1126-1136 无 OHOS 行 | p1(warn 一行+facade 文档) | 对齐 iOS warn 先例;签名返回 `()` 改 Err 不做(md 认可) |
| 172 | setCursorPosition 文档漏 OHOS | tao | 属实 C | p1 | **残差** | facade window.rs:1295-1297/:1310-1312 无 OHOS 行;impl set_cursor_position :1764-1768 Err(NotSupported)、set_cursor_grab :1636-1642 API22+ dlopen 注释在 | p1 文档 ×2 | grab 文案:confined-follow、仅获焦生效失焦自动解锁需 re-grab |
| 173 | isFocused 读进程级 | tao | 属实 A | p2 S | **未动** | WindowStateMirror 仅 visible/fullscreen/maximized/minimized 四位(window.rs:89-100),无 focused;is_focused 走 app 级 HAS_FOCUS(:1292-1305,agent 取证) | p2 #173(mirror 加 focused 位,修法仍成立) | p3 #180① 前置基建 |
| 174 | setFocusable 主窗 no-op | tao | 属实 A/B 待仲裁 | p2 S+真机 | **未动** | impl `set_focusable` platform_impl/ohos/window.rs:1249-1266:`window_id > 0` gate + 主窗注释「focusable is OS-managed, no-op」原样;`git log -S "set_focusable" -- src/platform_impl/ohos/window.rs` 仅 8dd79f77(#84 重构,早于 issue);反证:`grep -n "set_focusable" tao/src/platform_impl/ohos/window.rs` 仅命中该 no-op 实现与 :1178 注释,零 Err 化/零仲裁痕迹 | p2 #174 真机仲裁(id=0 可用性→去 gate 或 warn) | 判据复用测试映射行 44 |
| 175 | setProgressBar 空实现 | tao | 属实 B+C | p1 | **残差** | facade window.rs:1186-1189 无 OHOS 行;OHOS 无 impl(facade body cfg 编译出) | p1 文档 | 与上游 iOS/Android 静默一致,披露即可 |
| 176 | setVisibleOnAllWorkspaces 空实现 | tao | 属实 B+C | p1 | **残差** | facade window.rs:1255-1258 无 OHOS 行 | p1 文档 | OHOS 无多工作区概念 |
| 177 | setAlwaysOnTop 仅 freeform | tao | 属实 B+C | p1 | **残差** | facade :1139-1148 / is_always_on_top :909-913 无 OHOS 行;impl :1539-1560 内部注释语义齐(API14+/WINDOW_TOPMOST/freeform/Float 报错非致命) | p1 文档 ×2 | isAlwaysOnTop 读 intent 非真值——披露核心 |
| 178 | setCursorGrab 异步失败仍 Ok | tao(+tauri runtime-wry) | 属实 A+B | p2 S | **未动** | impl :1636-1694 两阶段:Phase1 同步 Err(API<22/window/client 缺),Phase2 fire-and-forget——`if let Err(e) = set_cursor_grab(...)` 仅 log::warn(:1674-1681),fn 返回 `Ok(())`(:1693);tauri runtime-wry lib.rs:3990 `let _ = window.set_cursor_grab(grab)` 原样;反证:`grep -n "PendingOp" ` 无 devtools 式排队/grab 失败回执通道 | p2 #178 | 彻底回传受 upstream 无 reply channel 限制不做(md) |
| 179 | cursorPosition 全局单源 | tao(+ability) | 属实 D+A | 披露 S+M(FloatPage onMouse) | **已修** | FloatPage.ets:635-659 onMouse(feedCursorFromMouse,`baf4f3f9`);cursor_feed.ets 新建(`baf4f3f9`+`ac911c2`);app.rs Err 契约(`baf4f3f9`);tao window.rs:1376-1381 披露 doc+Err 映射(`d42e8950`) | 剔除;回复素材 | 落定:披露落点仓=tao 已落;muda/tray-icon 零动作,无需知会乙 |
| 180 | Focused/ScaleFactor 硬编码主窗 | tao | 部分属实 A+D | 核心已修;残差 p3 | **残差** | Focused per-instance 路由(event_loop.rs:1040-1070,:731-796,:1062-1069);ScaleFactorChanged 全窗广播 :1071-1107 无变化沿去噪(ThemeChanged 模板 :1119-1126);Float 子窗零焦点通道(ability 全仓 windowFocusChange 0 命中;lifecycle.rs:195-198 仅 stage 事件);HAS_FOCUS 单位(window.rs:1292-1305) | p3 #180①(依赖 p2 #173)+scale 去噪 S | 去噪用 ThemeChanged 沿检测现成模板 |
| 181 | theme() 首回调前恒 Light | ability | 属实 A(比 issue 更重) | p2 S+真机 | **未动** | tao theme() :1900-1910 = `effective_theme(&self.app)`(FOLLOW 回落 app.config().color_mode,仅由 ConfigChanged/onConfigurationUpdated 刷新);反证:`grep -rn "getConfiguration" ability/{native_ability,package}/src/main/ets/` **0 命中**——启动不主动灌入,m 修法(per-module init 链尾灌入)未落 | p2 #181(真机深色冷启动) | 时序敏感 |
| 182 | setFullscreen 折叠沉浸式 | tao | 属实 B+D | p1 | **残差** | facade window.rs:1085-1097 无 OHOS 行 | p1 文档 | Exclusive≡Borderless;回读恒 Borderless(None);不做 intent 回读 |
| 183 | video_modes 恒 1 项/色深 32 | tao | 属实 B | p1 | **残差** | monitor.rs:116-120 仅 bit_depth 内联注释;单一模式无披露;多屏真值已 #106 | p1 文档 | SDK 无模式列表/色深 API(SDK d.ts 落证随任务 1.3) |
| 184 | bridge client 一次性获取 | tao | 属实 A | p2 S | **未动** | 锚点纠偏:非 OnceLock——`window_client: Option<WindowClient>` 字段 Window::new 一次捕获(window.rs:270,:719-732,:848-853 无补取;agent 取证) | p2 #184(修法=失败懒补取+成功覆盖,防 session 重建死句柄) | 修法锚点已重 derive |
| 185 | 子 webview setBounds 宽高丢弃 | wry(+ability+tauri) | 属实 D | 原披露 S | **已修** | webview-sizing 轨道:wry `8e381e6`(mod.rs:1127-1134 Render semantics 段)+ability `5c4b5a9`(WebviewPlugin.ets:2771-2803 全几何消费)+tauri `dd4956b63`;grep "intentionally ignored" wry/tauri 零命中 | 剔除;回复素材 | 超出原「披露」方案按实现修复;可选增值:set_bounds doc OHOS 行 |
| 186 | https 拦截字段丢失 | wry | 属实 A+B | p3 M | **残差(matcher 半已修,fields 半未动)** | matcher 半:`9f390e3`/`51fca97` 已落(md 归因);fields 半:wry ohos/mod.rs:1297 `Request::builder().uri(&original_url).body(Vec::new())`(method 恒 GET/空体/零头);反证:`grep -n "getRequestMethod\|getRequestHeader\|setResponseHeader" wry/src/ohos/mod.rs` 0 命中;ability WebviewPlugin.ets:222 `onHttpsInterceptRequest: (url: string) => …` 仅 url;SDK d.ts(ets1.2):`getRequestMethod` web.d.ets:1647、`getRequestHeader` :1607、`isMainFrame` :1640 声明在(SDK20 副本 @since 20,md @9/@8 为旧副本——字段事实成立);**setResponseHeader 在 SDK20 副本缺席**(WebResourceResponse 仅 setResponseData/Encoding/MimeType/ReasonMessage/ResponseCode,:1655-1746)——响应头 setter 可用性随当次构建 SDK 复核 | p3 #186(保 CORS 4 例基线;body 平台无访问器披露;响应头 setter 依 SDK 副本复核) | SDK 副本差异=任务期新发现,记 scope 影响清单 |
| 187 | use_https 异步 handler 放行 | wry | 属实 B+D | p1 | **残差** | src/ohos/mod.rs:1357-1370 None 分支 warn+passthrough 原样;公开文档 lib.rs:1978-1990/:1111-1139 无 OHOS 行 | p1 文档 ×2 | 指引原生 scheme 路径;两阶段 setResponseIsReady 待 PoC 不做(第 3 波) |
| 188 | 8 构建属性忽略 | wry(+ability) | 属实 A/B/E | p2 visible S+p3 incognito M | **未动(按子项:8 属性面零消费)** | 反证:`grep -n "attributes.visible\|attributes.incognito\|attributes.focused\|attributes.proxy" wry/src/ohos/mod.rs` 0 命中;`grep -n "incognito" wry/src/ohos/mod.rs` 0 命中(仅 lib.rs facade 字段+builder);`git log -S "incognito" -- src/ohos/mod.rs` 零 commit;ArkTS 渲染层 style.visible 消费在(WebviewPlugin.ets:953/:1404)但 wry create 通道不发送——`create_req.style.visible` 一行直传未落;SDK d.ts:`incognitoMode?: boolean` web.d.ets:1927 声明在(SDK20 副本 @since 20;md 旧副本 @since 11,字段事实成立) | p2 #188(visible 一行);p3 #188(incognito+cookie 桥联动,真机) | 复核翻案:incognitoMode 可修(SDK 字段在) |
| 189 | 主 webview Drop no-op | wry | 属实 A | p3 | **未动** | `dispose_child` :1166-1170 `if self.is_child && !self.disposed.swap(true, SeqCst)`,`impl Drop` :1185-1189 `self.dispose_child()` 原样——is_child 门控仍在,主 webview Drop 零派发;反证:门控条件与 09-10 快照一致,无去门控 commit | p3 #189(去门控;关窗链全量回归) | ArkTS remove 幂等已就绪 |
| 190 | cookie Expires/Max-Age 丢弃 | wry | 部分属实 A+D | p2 S | **残差(①未动;②③已闭合)** | ①`format_set_cookie_value` :1411-1430 仅 Domain/Path/Secure/HttpOnly/SameSite——无 Expires/Max-Age(反证:grep "Expires\|max_age" ohos/mod.rs 仅注释零实现);②cookies() 已实时化(#110 轨道):`cookies_for_url` :990-1055 主线程同步桥 `cookies_for_url_on_main_thread`(fetchCookieSync)+worker 异步桥,非 url_cache——md ②「只查 url 缓存」被后续修复推翻;③披露纠偏归回复 | p2 #190(①补两属性;③披露纠偏随回复) | IMF-fixdate≠Rfc2822 注意;scope 收窄记 scope 影响清单 |
| 191 | clearAllBrowsingData 不清 cookie | wry(+ability) | 属实 A | p2 S | **未动** | `clearAllBrowsingData`(package WebviewPlugin.ets:2445-2454)仅 `WebStorage.deleteAllData(true)`/`WebDataBase.deleteHttpAuthCredentials()`/`removeCache(true)`/`clearHistory()`;反证:`grep -n "clearAllCookies\|WebCookieManager" WebviewPlugin.ets(两份源)` 仅 fetchCookieSync(:2439)/configCookieSync(:2807),无 clearAllCookiesSync 调用 | p2 #191(+SSL cache/clientAuthCache 两缺口披露) | 与 c133ee8e2(清谁)互补 |
| 192 | url() 返回事件缓存 | wry | 属实 A | p3 M | **未动** | `url()` :895-897 返回 `url_cache.lock().clone()`(:428-447 on_page_begin/end 写入);反证:`grep -n "get-url\|get_url" wry/src/ohos/mod.rs` 0 命中——同步 get-url 桥未建 | p3 #192(镜像 cookie 三态分流;避主线程 block_on 族) | url() 主线程执行,同步桥是主路径必需件 |
| 193 | 拖放 bool 丢弃/Enter paths 恒空 | wry(+ability) | 部分属实 B+D | p1 披露+纠偏 | **残差** | src/ohos/mod.rs:477-505 四处 let _ 原样;:483 Enter vec![];:495 Drop paths 可达;ArkTS WebviewPlugin.ets:1757-1763 file:// 拦截恒阻止默认(纠偏实锤);公开文档 lib.rs:1184-1197/:2299-2321 无 OHOS 行 | p1 文档+仓内纠偏;回复(排除) | 纠偏:「阻止不了」方向反了;恒空仅 Enter |
| 194 | eval 失败不回调 | wry(+tauri 消费) | 属实 A | p2 S | **未动** | `PendingOp::Eval` 分支 :239-247:Ok 分支调 callback,Err 分支仅 `log::warn!("pending evaluate_script failed")`——callback 不回调;反证:Err 分支无 callback 调用,与 09-10 快照一致 | p2 #194(以 "null" 回调) | tauri menu/plugin.rs:685-703 消费方实锤 |
| 195 | open_devtools 未就绪丢弃 | wry(+tauri 门控) | 属实 A+B+C | p3 M | **未动** | `open_devtools` :913-921 `if let Some(handle) = self.try_handle()` else 静默丢弃(handle 未就绪无 PendingOp 排队);`is_devtools_open` :937-939 读本地 `devtools_open` 布尔镜像;反证:`grep -n "PendingOp::Devtools\|OpenDevtools" wry/src/ohos/mod.rs` 0 命中 | p3 #195 | 进程级布尔对齐 ArkWeb 语义 |
| 196 | window.open features 丢弃 | wry | 属实 D+B | p1 | **已修(文档半)** | wry lib.rs:1360-1368 OHOS 行已在(size/position 恒 None;Create 按 Deny 处理);src/ohos/mod.rs:453-475 注释自洽 | 零必需;可选增值(Create 变体 doc :481-505);回复素材 | 文档已闭合,issue 回复确认设计意图即可 |
| 197 | init script frame 区分丢失 | wry | 属实 B | p1 | **残差** | src/ohos/mod.rs:625-631 规则表无 file://;:658-660 注释自陈 for_main_frame_only dropped;公开文档 lib.rs:1023-1026 无 OHOS 行 | p1 文档;file:// 覆盖面真机探针不随本批 | ScriptItem 无 frame 维度(SDK d.ts 落证随任务 1.3) |
| 198 | setBounds Physical 不换算 | wry(+ability) | 属实 A+D(复核改写 M) | p3 M | **残差(披露半已落)** | set_bounds to_logical::<f64>(1.0) mod.rs:1140-1141 原样;bounds() doc :1127-1134 unit contract 段已披露 scale-1 假设(`8e381e6`);ability/wry 全链 virtualPixelRatio 0 命中 | p3 收窄为实现侧(ability 暴露→wry 接入);真机 vp 标定 | mod.rs 失准注释更正已由 8e381e6 完成,p3 文档半剔除 |
| 199 | invoke URL 取事件缓存 | wry | 属实 A+B | p2 S | **未动** | ipc handler :530-542 读 `url_cache_ipc.lock()`(:536),空回落 `about:blank`(:538/:542);url_cache 初始化为空串(:378),无 initial_url 预填;反证:grep "initial_url\|prefill" ohos/mod.rs 0 命中 | p2 #199(mod.rs 附近预填 initial_url) | SPA 滞后披露 |
| 219 | 4 类窗口命令先 ack 后执行 | ability(+tao 消费) | 属实 A | p3 M | **未动** | 反证:`grep -rn "serializeOpTracked" package/src/main/ets/` **0 命中**(变体不存在);void-setter/异步派发原样:WindowManager.ets `fireAndForget(win.setWindowTopmost)` :744、`fireAndForget(win.setWindowTitle)` :766、`fireAndForget(win.showWindow)` :914;`serializeOp` :325-339 catch 仅记日志(「op failed」)——失败被吞链路未收敛 | p3 #219(void-setter 族依赖 tao 消费 Result,同波前置;313 全量硬门槛) | 回归面最大 |
| 221 | StageEventType 未知值 panic | ability | 属实 A | p2 S | **未动** | crates/ability/src/stage/event.rs:10-21 `impl From<i32>` `_ => panic!("Invalid StageEventType value: {}")`(:19)原样;反证:`grep -n "TryFrom" crates/ability/src/stage/event.rs` 0 命中 | p2 #221(+单测) | `_ => return Ok(())` 兜底修复后激活 |
| 225 | set_enabled 假成功+work_area 未扣栏 | tauri | 属实 A+B+C | p2 S(+L 专项) | **未动** | runtime-wry set_enabled :2403-2407 派发 `Message::Window(…, SetEnabled)`(无 Err 化);dispatcher lib.rs:3889 `WindowMessage::SetEnabled(enabled) => window.set_enabled(enabled)` 结果丢弃(md 锚 :2387 重 derive→**:3889**);is_enabled :2302 恒 true 面未动;work_area :716 直通 tao `monitor.0.work_area()`,无 avoid-area 扣除;反证:`git log -S "set_enabled" -- crates/tauri-runtime-wry/src/lib.rs` 仅 b27be063f(upstream feat,非 OHOS 修复) | p2 #225(set_enabled→Err);work_area 归第 3 波专项 | scope 锚已重 derive(:2387→:3889) |
| 228 | set_effects 文档未注明范围 | tauri | 属实 C | p1 | **残差** | window/mod.rs:2220-2223 与 webview_window.rs:2100-2103 Platform-specific 无 OHOS 行;vibrancy/ohos.rs:38-56 仅 Blur/Acrylic 实锤(Mica/Tabbed info 跳过;macOS 效果 blur 近似) | p1 文档 ×2 | 零回归面(纯 doc) |
| 231 | ArkTS console 调试残留 | ability | 属实 A+D | p2 S | **未动** | accelerator_matcher.ets(两副本)console.info :175/:192/:227 原样(全量快捷键表打印+disabled 命中+getModifierKeyState 拒绝);WindowManager.ets:1120 setPointerStyle OK console.info;BridgeHost.ets :409/:417/:421/:841/:846 [DBG-*] console.debug;反证:grep "console.info" 上述文件全部命中(零清理 commit) | p2 #231(降级 hilog.debug 保 accel-inject-diag.sh 判读链+三副本同步) | **不动 MenuBarComponent.ets**(归乙 #205) |
| 233 | createPdf scale 构造遗漏 | wry(+ability 两份源) | 属实 A | p2 S | **未动** | ArkTS cfg 构造(plugins/webview + package 两份源;package :2534-2544)仅 width/height/marginTop/Bottom/Left/Right/shouldPrintBackground——**无 scale 行**;wry ohos/mod.rs:59-60 注释「`scale` … has no ArkWeb counterpart (`PdfConfiguration` has no scale field) and is dropped」原样(失实注释未更正);反证:构造清单与 09-10 快照一致,零补行 commit | p2 #233(两份 ArkTS 源同步+wry 注释更正) | 凡动 ArkTS 全链(约束 2) |

## 统计与 scope 影响清单(任务 1.4 终版)

### 统计(任务 1.4 终值,2026-10-20 HEAD:tao d42e8950 / wry 8e381e6 / ability 5c4b5a9 / tauri f6bb0889f)

- 已修(整条或子项闭环):**3**(#179 全条、#185 全条、#196 文档半)
- 残差:**18**(#168 几何修/参数残、#169 注释半、#170、#171、#172、#175、#176、#177、#180、#182、#183、#186 matcher 半修、#187、#190 ②③闭合/①未动、#193、#197、#198 披露半修、#228)
- 未动:**17**(#173 #174 #178 #181 #184 #188 #189 #191 #192 #194 #195 #199 #219 #221 #225 #231 #233)
- 合计 3+18+17 = **38**,与总表逐行一致 ✔(任务 1.2 全部转正,零「待任务核验」残留)

### p2/p3 scope 影响清单(供 PM 更新 roadmap,澄清决策 7)

| roadmap 条目 | 变化 | 依据 |
|---|---|---|
| p3「#179 M 档(FloatPage onMouse)视 p1 对账:若 cursor feed 轨道已覆盖则剔除」 | **剔除** | D3 #179(已修) |
| p1 文档批「wry #185」「wry #179 披露」「wry #196」 | **零必需改动**(施工条目 16→14) | D3/D4 |
| p3「#198 …+ mod.rs 失准注释更正」 | **文档半剔除**,scope=ability 暴露 virtualPixelRatio→wry 接入+真机 vp 标定 | D3 #198 |
| p2「#184(OnceLock→Mutex)」 | 修法锚点纠偏:字段捕获形态(`Option<WindowClient>`)的懒补取+成功覆盖 | D4 |
| p3「#168」 | 加注「几何面不重做」防重复实现 | D3 #168 |
| p2「#190(format_set_cookie_value 补两属性)」 | **scope 收窄**:②已被 #110 轨道闭合(cookies() 已实时化,主线程同步桥 fetchCookieSync)——残差仅①Expires/Max-Age+③披露纠偏 | 任务期新发现(HEAD :990-1055 实证) |
| p3「#186(三层扩展 method/headers/响应头)」 | **实现前 SDK 复核**:setResponseHeader 在本地 SDK20 副本(ets1.2 web.d.ets)缺席(getRequestMethod/getRequestHeader 在)——响应头半边依当次构建 SDK 复核可用性后再定修法 | 任务期新发现(任务 1.3 落证) |
| p2「#225(set_enabled→Err)」 | 修法落点锚重 derive:dispatcher 层 lib.rs **:2387→:3889** | 任务期重 derive(约束 11) |
| (任务期无其他新发现;#188/#191/#192/#194/#195/#199/#219/#221/#231/#233 等 17 条「未动」与 md 预判一致,scope 不变) | | |

### 基线重锚记录(任务 6.x 填写)

- 设备预检(6.1):`hdc list targets` → 3QC0124C11000038 在位 ✔;残留窗排查 = `hidumper -s WindowManagerService -a '-a'` 列窗仅系统窗(SCB*/wallpaper/desktop/dock),无套件残留透明窗 ✔;全程未执行 `hilog -r` ✔
- 执行日期 / 设备 SN / HEAD:2026-10-20 / 3QC0124C11000038(MateBook Pro HAD-W32 desktop 真机) / tauri 仓 HEAD = 文档批 commit ① 1147f3ae5(代码 doc 批全部落地后)
- report 文件:`examples/api/device-report-1020-desktop.md`(footer 判据成立 ✔;provenance:head `1147f3ae5`,7 uncommitted tracked files = openspec change 产物,由 commit ② 收口;device-type desktop,pulled 2026-10-20T11:15:20Z)
- 基线数字:**318 例(311✅ / 7⏭ / 0❌)**(口径 = D6:report 表格行数计的用例总数,含 auto/manual/smoke 全类别)
- ❌ 归因:**0 条 ❌,预期达成,无需归因**;⏭ 7 条均为既有已知平台限制(非本 phase 回归):clipboard READ_PASTEBOARD 未授权 ×3(#93/#97/#98)/ notification 授权关闭(#111)/ 无 NFC 硬件(#142)/ haptics 无 vibrator(#287)/ version-gate negative probes 在 API23≥22 正向设备上 Err 支路不适用(#308)
- roadmap 回写:What p2/p3 / 澄清决策 5 / 切割理由 / Phase 表 p2·p3 验证方式列 / Phase1 SC2(重锚结果留痕) / p2 SC3(311✅/7⏭+report 引用) / Phase3 #219 行 / p3 SC2(report 引用) / 跨 phase 约束 6·10 → **318 口径统一替换(✔,10 处编辑,唯一保留的 313 = Phase1 SC2 漂移表述本身)** · scope 措辞零变更(PM 校验) · PM 知会(✔ 随本 change 返回摘要)
- 留痕:report 文件按 commit ② 范围约束(D7/design 验收 4「限 openspec/ 与 roadmap 文件」)不入本次 commit,落盘为 phase 产物,后续归档时点由 PM 裁定(1015 报告先例由行为 commit 6d9a8c489 收口)

### 回复素材索引(回复动作排除,澄清决策 2)

- #179:已修证据包(FloatPage onMouse + 全局系 + Err 契约 + tao doc;commit baf4f3f9/ac911c2/d42e8950)
- #185:webview-sizing 轨道修复证据包(三仓 commit 8e381e6/5c4b5a9/dd4956b63 + Render semantics 段 + 探针用例)
- #196:文档已闭合(wry lib.rs OHOS 行,size/position 恒 None + Create→Deny;本次 28f8c08 再补 Create 变体 doc 一句)
- #193:纠偏文案(file:// 恒拦截 + Drop paths 可达 + bool 忽略)——回复时须先纠偏再披露(md 回复纪律);披露行随 28f8c08 落库
- #169:spawn 链恢复 + latch 语义注释(commit 9627c4e0,platform_impl/ohos/window.rs FIRST_WINDOW_CREATED 声明处)
- #170:三仓注释更正证据包(tao 9627c4e0 / ability 3d10f73 / tauri 1147f3ae5 test-mapping :23-24)——回复从 diff 现场 derive
- 第 0 波文档批 commit 清单(供回复引用):tao 9627c4e0(#169-#183)/ ability 3d10f73(#170 半)/ wry 28f8c08(#187/#193/#197)/ tauri 1147f3ae5(#228+#170 关联);**回复动作本身排除,不回 GitHub(澄清决策 2)**

### spec 契约走查(任务 7.4,结果留痕)

- 走查日期:2026-10-20 · 方法:每 Requirement 的 Scenario 按 D5 落点 grep 验证(存在含指定语义关键词的 OHOS 行)
- 结果:**12/12 Requirement 场景全部命中,零缺失**
  - tao facade(9627c4e0):set_always_on_bottom(Unsupported+warn 且 impl :1548 有 log::warn!)/set_progress_bar+set_visible_on_all_workspaces(Unsupported silent no-op ×2)/set_always_on_top(setWindowTopmost intent 位)+is_always_on_top(intent bit :922)/set_fullscreen(immersive fold :1108)/set_cursor_position(NotSupported :1328)/set_cursor_grab(API22+ LockCursor :1344)/video_modes(单一当前模式 :159 + impl :118)/#170 几何两处(transiently ×2)
  - ability(3d10f73):isUIAbilityMainWindow 注释两副本各 1 命中(1300002 transiently)
  - wry(28f8c08):with_https_scheme+with_asynchronous_custom_protocol(synchronous-only ×2)/with_drag_drop_handler(NOT unblockable :1216 + Enter empty :1220)/init script(for_main_frame_only ignored :1032)/window.open features(既有 OHOS 行核验仍在)
  - tauri(1147f3ae5):set_effects 两处(Blur/Acrylic only ×2)
- 主 spec 规范化后 `openspec validate --specs --strict` 对 ohos-platform-limitations 零 ERROR(余两 WARNING 为既有内容特征,按内容零删改纪律保留)
