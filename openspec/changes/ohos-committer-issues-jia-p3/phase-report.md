# Phase report — ohos-committer-issues-jia-p3（甲 p3 M 级行为波）

设备：MateBook Pro SN 3QC0124C11000038（desktop 2in1）。日期：2026-10-22。
基线：device-report-1021-desktop.md（319 例 311✅/8⏭/0❌）。

## 1. Commit 清单（D15）

| commit | 仓 | 内容 | issue |
|---|---|---|---|
| ability-① `b358319` | openharmony-ability | get-url 同步插件 Rust 侧（WebviewUrlBridgePlugin）+ vp wrapper + napi 契约增补 | #192 #198 #186 #180 #188 |
| ability-② `99d843e` | openharmony-ability | 拦截请求采集 + Float 焦点回调 + incognito 注入 + tracked window ops + pack.bat tar 修复（12 canonical 文件） | #186 #180 #188 #219 |
| wry-① `1affb83` | wry | dispose gate 移除 + url 三态同步桥 + devtools 队列 + vp bounds + 拦截 method/headers | #189 #192 #195 #198 #186 #188 |
| tao-① `0af7415c` | tao | creation attrs seeding + float focus edge + scale dedup | #168 #180 #219 |
| tao-② `efa78c04` | tao | docs：创建期视觉属性限制披露 | #168 |
| tauri-① `0f6defa22` | tauri | docs：创建期视觉属性限制披露 | #168 |
| tauri-② `2c2dab839` | tauri | examples 三用例 + 六命令注册 + AppManifest 四处 + openspec 账本 | #192 #188 #219 |
| ability-③ `0e9be40` | openharmony-ability | getRequestHeader Header[] 形状修正（ArkTS 10505001 编译断）+ 同步 cookie 桥 incognito 选择子 | #186 #188 |
| wry-② `b7aa7ea` | wry | InnerWebView 保留 incognito 并前传同步 cookie 桥（主线程 cookies_for_url 店选择） | #188 |

注：ability-② canonical 清单按实际触碰面扩为 12 文件（含 pack.bat 滚动修复与 rust_example/demo_native incognito 字段）；package/ 四镜像为 gitignore 生成态不入 commit；har-chain-stageA.sh 为工作区辅助脚本不入（p2 accel-inject-diag.sh 先例）。

## 2. 四仓 UT receipts（定向 --lib）

| 仓 | 结果 | 备注 |
|---|---|---|
| openharmony-ability crates host | 87 passed / 0 failed | 其中 plugin-webview 31/0，含 #192 wire 断言（lib.rs:2278-2294：ID `ohos.webview-url`、TYPE_NAME `ohos.webview.UrlGetRequest`/`UrlGetResponse`）与 #188 扩展请求形状断言（ability-③ 后复跑 31/0，host 走 `target/host-stub-libs` 桩链接路径） |
| wry host `--lib` | 20 passed / 0 failed | #189/#192/#195/#198 面在 1affb83 |
| tao host `--lib` | 0 tests（ohos 测试模块 cfg-gated，门结构认可） | ohos gates EXIT=0；tao 设备 UT 为权威（79/79 为 09-29 基线，本波未重跑）。tao-① 0af7415c 新增 10 个 `#[test]`（focus/scale dedup 5 + creation attrs seeding 5，含 `ut_scale_dedup_forwards_change_once_and_swallows_repeats`）本波无执行回执——host 无法运行 ohos cfg 门内测试，设备侧留待下次设备 UT 首跑验证（符号已核验存在，编译风险低）；#219 零码结论（根因不在 tao）见第 4 节 |
| tauri app crate | cargo check exit 0 / 0 error | §6 六命令 + 注册 + capabilities |

## 3. SDK 复核结论（当次构建实证，非文档转抄）

- `setResponseHeader` **PRESENT**（web.d.ts:4426，@since 12）→ §5.1 #186 拦截面按 6 字段 payload（method/headerNames/headerValues 增补）透传 invokeNativeSync。
- `incognitoMode?: boolean` 是 **WebOptions 成员**（web.d.ts:5217，@since 11/18），**不是** @since 20 链式属性 → §5.4 两处 `Web()` 站点 `incognitoMode: data.style.incognito === true`。
- `fetchCookieSync(url, incognito?)`（@ohos.web.webview.d.ts:1642）/ `configCookieSync(url, value, incognito?)`（:1717）@since 11；`clearAllCookiesSync(incognito?)`（:1952）→ incognito 分区经同一 style 标志解析。

## 4. tao #219 消费核验结论（零码）

ack 语义失真的根因不在 tao：创建期视觉属性（title/topmost/decoration 等）在 ArkTS 侧由 WindowManager API14 能力守卫决定成败，tao 侧 wire 已原样携带平台错误。tao-① 仅落 creation attrs seeding（让属性进入创建参数而非事后 setter）+ float focus edge + scale dedup；tao-② 披露创建期限制。**真失败语义由 ability-② tracked ops 兑现**：`serializeOpTracked` 逐窗队列 + restoreWindow/setWindowTopmost/setWindowTitle/setFullscreen/showWindowMethod 全部 await 并上抛真实失败，fire-and-forget 调用面（NativeAbility.ets:186/:738、menu.ets:344/:361、WindowPlugin.ets 各 arm）补 `.catch` 防 unhandled-rejection；API14 能力守卫（setWindowTopmost/restoreWindow 的 API14 分支）保持 warn+no-op（设备能力差异，非操作失败）。

## 5. #192 同步桥双端核验

- Rust 真源：ability `crates/plugin-webview/src/lib.rs:1326-1383`（`WebviewUrlBridgePlugin` ID `ohos.webview-url`，随 `set_cookie_sync_app` 同一 COOKIE_SYNC_APP OnceLock 注册，:1281）。
- ArkTS：`plugins/webview/src/main/ets/WebviewUrlPlugin.ets`（SyncPluginBase，action `get-url`，`{id:string}`→`GetUrlResponse{url}`），controller 取自 WebviewPlugin.ets 模块级 live-controller 注册表（attach 成功注册 / remove·dispose·attach 失败注销）。
- wry 消费：`src/ohos/mod.rs` `url_with_main_thread_refresh` 三态路由（Main=同步刷新缓存 / Worker·Uninitialized=纯缓存），零 recv_timeout、零 block_on（MainThreadSync 重入直调）。

## 6. HEAD re-derive 回执（收口时点 2026-10-22 实测 git log）

| 仓 | HEAD | 修正 |
|---|---|---|
| tao | `efa78c04` | p3=两 commit（0af7415c 代码 + efa78c04 披露），非单一 commit |
| wry | `b7aa7ea` | 两 commit：1affb83（主批五 issue）+ b7aa7ea（#188 同步桥 incognito 前传，设备回归修复） |
| openharmony-ability | `0e9be40` | 三 commit：b358319（Rust 契约）+ 99d843e（ArkTS 行为主批）+ 0e9be40（Header[] 形状 + 同步 cookie incognito，设备回归修复） |
| tauri | `2c2dab839` | 0f6defa22 docs + 2c2dab839 examples/账本 |

基带修正三处：①ability-② 文件清单 4→12（pack.bat tar 修复 + rust_example incognito 字段属同批触碰面）；②#192 wire 常量真源在 ability 仓 plugin-webview crate（wry 仓仅注释引用）；③回归基数 318→319（#192/#188/#219 三用例入 allTests）。

## 7. HAR 全链（5.6）

- stage A run5 全绿：A1 SKIP（Rust 零变化）→ A2 pack.bat（pushd 锚定 + 相对参数 tar）→ A3 package 同步校验（18 re-exports / WebviewUrlPlugin / notifyWindowFocus / serializeOpTracked / incognitoMode 全命中，ability.har 198269B @10-22 08:50）→ A4 ohpm install + CompileArkTS 缓存清除 + entry_desktop/oh_modules 新鲜度（@ohos-rs/ability index 含 WebviewUrlPlugin=1、serializeOpTracked=6、notifyWindowFocus=1、incognitoMode=6、allBridgePlugins=1）。
- pack.bat tar 根因：GNU tar 的 CRT 参数解析把引号内尾反斜杠（`"...ability\"`）当转义引号，吞掉后续 `package` 操作数 → "Cowardly refusing to create an empty archive"（stage A run4 实证）；xcopy/cmd 内建不受影响。修法 = `pushd "%SCRIPT_DIR%"` + 相对参数。
- 环境坑：`NoDefaultCurrentDirectoryInExePath=1` 使 cmd 拒绝从 cwd 裸名解析脚本（stage A run2/run3 的 `'pack.bat' 不是内部或外部命令`）；绝对路径调用与 PowerShell `& '.\pack.bat'`（run-tests.sh Step 0 现行形态）均不受影响。

## 8. 319 例桌面回归（7.1）

**终态（run4，2026-10-22 09:45）：322 行 314✅ / 8⏭ / 0❌，`ALL TESTS PASSED!`，footer `*Report generated at end of test run.*`**。report 存档 `examples/api/device-report-1022-desktop.md`（provenance head `2c2dab839` + 6 个修复期未提交 tracked 文件，即 ability-③/wry-② 修复内容本身；SC2 硬门：零新增 ❌，基线 311✅/8⏭/0❌ → 314✅ 恰为基线+3 新用例，⏭ 数不变）。

三新用例全绿：#78 `webview.url() main-thread sync read after SPA navigation (#192)` ✅ 3206ms；#79 `webview.incognito create + cookie isolation (#188)` ✅ 2786ms；#80 `window.set_title tracked ack: real window resolves, illegal label rejects (#219)` ✅ 883ms。重点复核面全绿：CORS/https-scheme 面（row 17/18/93 等）、关窗面（row 35/36 CloseRequested/Destroyed）、窗口命令族（maximize/minimize/unmaximize/set_position/set_size/decorations 等 rows 41-47）。

**修复披露（真回归→修复→复跑，未带病收口）**：
- run1（regression-319-p3.log）：hap 构建 FAIL —— `getRequestHeader() ?? {}` 的 `Header[] | {}` 联合类型不能赋给 `Record<string,string>`（ArkTS 10505001）。修复 = 直接迭代 `Array<Header>`（ability-③）。
- run2/run3（313✅/1❌）：#188 用例 ❌ —— incognito 店探针读到默认店 cookie（marker 缺席 + control 在场）。hilog 诊断（run3 埋点）锁链：`create[incognito-diag] id=incognito-probe-… raw=true normalized=true`（wire/normalStyle 全对）+ `setCookie[incognito-diag] resolved=true`（写对店）+ **cookiesWithUrl 诊断行对探针 id 缺席** → 主线程读走的是 id-less 的 `ohos.webview-cookie` MainThreadSync 桥（issue #110 面），从未携带 incognito 标志。修复 = 同步请求增可选 `incognito` 字段（ability-③）+ wry InnerWebView 保留创建期标志并前传（wry-②）。run4 全绿。

## 9. 真机专项（7.2）

- **#192 SPA 路由 url() 真值**：设备用例 row 78 ✅ —— SPA pushState 导航后主线程同步读返回含 `#spa-route-192` 的非空 URL；同步桥 `ohos.webview-url` 双端（ability `WebviewUrlPlugin` ↔ wry `url_with_main_thread_refresh`）真机闭环。
- **#198 vp/bounds 换算**：设备（2in1 desktop，vp=1.0）rows 58/60/71 全 ✅ —— wry-① `geometry_to_logical_vp`（live display ratio）桌面恒等结论成立；vp≠1 设备标定留待 mobile 批（entry_mobile 显式 LazyPlugin 清单需补 WebviewUrlPlugin 条目后上真机）。
- **#188 incognito 隔离**：设备用例 row 79 ✅ —— `incognitoMode(true)` webview 的 cookie 与主窗默认店严格分区（marker_in_incognito=true、marker_in_main=false、control_in_main=true、control_in_incognito=false 四断言全过）。desktop WebView2 仅 smoke（分支护栏），本结论为 OHOS 真机。
- **#189 关窗链**：hilog 抓取（grep --line-buffered 落盘，未 `hilog -r`）——close 后链路完整：`Destroy WindowInputChannel → WMS NotifyWMSWindowDestroyed → JsUIAbility onWindowStageDestroy → RunEvent WindowEvent::Destroyed`，无残留窗告警（`IsWindowSessionInvalid: already destroyed` 为 WMS 二次销毁守卫的良性 warn）；套件关窗面 rows 35/36 ✅。

## 10. concerns

- desktop 侧 #188 用例为 smoke 断言（WebView2 incognito 语义平台差异风险）；OHOS 严格 4 断言经 `ohosSdkApiVersion()` 分支生效。
- WindowManager 5.5 分类（D10）：minimize/maximize/recover/hideWindow 维持原样；restoreWindow/setFullscreen 转 tracked；setWindowTopmost/setWindowTitle/showWindowMethod 子窗支转 await+tracked；API14 能力守卫保持 warn+no-op。
- entry_mobile（gen/ohos）为显式 LazyPlugin 清单，WebviewUrlPlugin 需手工补条目后方可上真机 mobile 跑 #192（desktop 全链已通）。
- wry #195 边界：排队的 `PendingOp::SetDevtools` 因 create 失败永不重放时，`DEVTOOLS_ENABLED` 进程级意图不复位，后续另一 webview 的 `open_devtools` 静默 no-op（窄边界，内建审查 minor，留待下次触碰 devtools 面时一并处理）。

## 11. 内建审查（rb-auditor）

- 结论 **APPROVED**（0 blocking / 0 major / 3 minor）。minor ①：本报告第 2 节 tao UT 措辞已按审查意见修正（0af7415c 新增 10 UT 有落盘无执行回执）；minor ②：entry_mobile LazyPlugin 缺 WebviewUrlPlugin（上条已披露）；minor ③：#195 DEVTOOLS_ENABLED 不复位边界（上条已披露）。
- 审查实证要点：serializeOpTracked 链中性尾 `next.catch(()=>{})` + 窗销毁时删队列（无死锁/无泄漏）；NAPI wire 两端一致（incognito 只上 `Some(true)`、url 同步桥 TYPE_NAME 双端、主线程路径零 block_on/recv_timeout）；六命令四处注册齐；#186 采集失败降级不沉拦截；cfg 隔离无泄漏（desktop 322 例回归佐证）。
- churn 复核：9 commit 文件清单零 schema.json / package/ / ability.har / 覆盖率产物（显式点名提交，无 `git add -A`）。
