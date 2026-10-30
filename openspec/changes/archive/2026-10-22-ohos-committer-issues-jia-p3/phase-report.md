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
- wry #195 边界：排队的 `PendingOp::SetDevtools` 因 create 失败永不重放时，`DEVTOOLS_ENABLED` 进程级意图不复位，后续另一 webview 的 `open_devtools` 静默 no-op（窄边界，内建审查 minor，留待下次触碰 devtools 面时一并处理）——**已由修复变体 m5 消除**（failed_create_cleanup，见 §12）。

## 11. 内建审查（rb-auditor）

- 结论 **APPROVED**（0 blocking / 0 major / 3 minor）。minor ①：本报告第 2 节 tao UT 措辞已按审查意见修正（0af7415c 新增 10 UT 有落盘无执行回执）；minor ②：entry_mobile LazyPlugin 缺 WebviewUrlPlugin（上条已披露）；minor ③：#195 DEVTOOLS_ENABLED 不复位边界（上条已披露）。
- 审查实证要点：serializeOpTracked 链中性尾 `next.catch(()=>{})` + 窗销毁时删队列（无死锁/无泄漏）；NAPI wire 两端一致（incognito 只上 `Some(true)`、url 同步桥 TYPE_NAME 双端、主线程路径零 block_on/recv_timeout）；六命令四处注册齐；#186 采集失败降级不沉拦截；cfg 隔离无泄漏（desktop 322 例回归佐证）。
- churn 复核：9 commit 文件清单零 schema.json / package/ / ability.har / 覆盖率产物（显式点名提交，无 `git add -A`）。

## 12. PM 修复变体（2026-10-22，M1/M2/M3 + m1-m6）

PM 侧独立审计 CHANGES_REQUESTED（3 major + 4 minor + 1 suggestion）→ 逐条处置（commit 显式点名，四仓 ohdev）：

| finding | 处置 | 路线与证据 |
|---|---|---|
| **M1** #186 响应头半丢弃 + spec 自相矛盾 | 修复（路线 A） | wry `dispatch_https_intercept_sync` 提取 handler 响应头（Content-Type 走 mime 通道防 ArkWeb 双重应用；非 UTF-8 逐条跳过降级；空集 None 保 D9 逐字节）→ wire 并行数组 `headerNames/headerValues`（请求侧同型，ability 1250c67）→ ArkTS `setResponseHeader(Array<Header>)`（WebviewPlugin.ets 构建点：在场/非空/等长三守卫，旧原生模块缺字段时跳过=逐字节现状）。**设备断言 row 82 ✅ 280ms**：useHttpsScheme 探针窗自 https://tauri.localhost 跨源 fetch https://myapp.localhost，ACAO 依新路径通过 + echo 头 JS 可读；hilog 全链（`protocol=myapp — dispatching to bridge` → `Custom scheme request: myapp://localhost/p3-m1-header-probe` → `handled=true`）。CORS 4 例基线零回归。spec M1 requirement 重写（p1 缺席判定被当次构建复核实证推翻）+ 补 https 重写主机 CSP 平台事实 |
| **M2** tao 9 新 UT 零执行回执 | 补执行回执 | run-ut.sh tao（aarch64-ohos 设备）：**100 passed / 0 failed**（含 0af7415c 全部 9 UT，验收线 ≥88）。首跑即暴露 scale dedup UT 的 EPSILON 断言错误（2.0+EPSILON 在 2.0 处为半 ULP 舍入回 2.0，位型不变）→ `from_bits(to_bits()+1)` 修正（261bf020） |
| **M3** #219 tracked reject 无真实覆盖 | 修复（套件探针） | 新命令 `tracked_reject_probe`（四处注册齐）：tauri 层先 `get_webview_window("main")` 实解析，再走真 `WindowClient`→WindowPlugin set-title→`WindowManager.getWindow` throw→arm 重抛 `set-title failed:`→NAPI reject→invoke Err，断言错误串含 "set-title failed" 证明拒绝源于 ArkTS tracked op。**row 81 ✅ 45ms**。in-queue serializeOpTracked 字面拒绝不可确定性构造（restore/fullscreen 对未知 id 在入队前即 throw，getWindow 预检）——set-title arm 为 tracked 家族代表，已在探针注释记录 |
| **m1** tao 注释失实 | 修复 | window.rs `no_initial_focus` 注释重写：config `focus`（默认 true 可设 false）经 runtime-wry 透传（9e351273）；spec delta 新增 creation-time focusability requirement（3 scenarios，持久 `set_focusable(false)`=gtk `accept_focus` 语义、异于 Windows） |
| **m2** spec incognitoMode 失实 | 修复 | bridge-fidelity spec 改为 WebOptions 成员（web.d.ts:5217 @since 11，非链式属性）（386a6e8e5） |
| **m3** ps1 计数 17→18 | 修复 | pack-plugins.ps1 头注释（1250c67） |
| **m4** wry 队列 UT 假覆盖 | 修复 | `dispatch_or_queue_op` 提取为自由函数，UT 驱动真生产 queue/failed/ready 路径；设备 UT `ut_dispatch_or_queue_set_devtools_real_path` ✅ |
| **m5** #195 devtools 意图不复位 | 修复 | `failed_create_cleanup`：create 失败分支释放进程级 `DEVTOOLS_ENABLED`（排队 SetDevtools 永不重放时不再吞后续 open_devtools）；设备 UT `ut_failed_create_releases_queued_devtools_intent` ✅；§10 对应 concern 已消 |
| **m6** FloatPage 静默丢弃 | 修复 | windowEvent 回调 else 分支一次性结构化 warn（notifyWindowFocus 不可用=stale HAR 提示）（1250c67） |

**修复期设备实证三连环（M1 断言载体重定位）**：
1. r2（10ms `Failed to fetch`）：主窗 use_https=false → `https://myapp.localhost` 不存在于该 URL 空间，fetch 落真网 DNS 失败；raw `myapp://` iframe 流走原生 scheme 路径完全绕过 setResponseHeader → 断言载体必须迁移到 useHttpsScheme webview（runtime-wry OHOS 分支已有 with_https_scheme 透传，ohos-webview-https-scheme 轨道）。
2. CSP 首拒（r2 hilog ARKWEB-CONSOLE `Refused to connect` 8ms）：conf connect-src 只列裸 `<scheme>:` 条目，https 重写主机须显式允许 → tauri.conf.json 增 `https://myapp.localhost` + `https://myapp-async.localhost`（3a1544ca3；裸条目只覆盖 iframe/导航流，已记入 spec）。
3. r4 全绿：探针窗（useHttpsScheme Float 子窗，`create_isolated_window` 增可选 useHttps 参数 dd2e30022）经 https-intercept 链加载（protocol=tauri），跨源 fetch 命中 protocol=myapp → bridge → Rust handler → `setResponseHeader` → echo 头 JS 可读；报告通道=既有 `document-title-changed` emit（探针页零 IPC）。

**设备 UT 回执（wry）**：68 passed / 0 failed——M1 2 例（headers forwarded / headerless D9 形状）+ m4/m5 2 例 + 存量 p3 UT。首跑暴露 3 个从未执行过的测试缺陷并当场修正：E0599 `HeaderName::to_str`→`as_str`（cfg(ohos) 代码 host 从未编译，53c8d86）、vp UT 宿主环境假设→纯函数 `vp_ratio_sanitized` guard（NaN/±inf/≤0→1.0，live wrapper 仅探 total）、devtools close 极性反转（close 返回 pre-swap 旗标：已应用 open 后首次 close=true）。

**终态回归（r4，2026-10-22 12:16）**：324 行 **316✅ / 8⏭ / 0❌**，footer 判据成立，零新增 ❌（基线 314✅/8⏭/0❌ + M1/M3 两新用例全绿）。report 存档 `examples/api/device-report-1022-fixvariant-desktop.md`。HAR 链 stage A 两轮全绿（A1 重建 + A2/A3/A4，har 199140B @11:35，消费点 setResponseHeader/headerNames 标记全命中）。

**返工披露（修复变体漏 strict 复验，已返工）**：M1 改写的 platform-limitations delta 曾把实现叙事+SDK 判定史嵌进单个 Requirement 正文（>500 字符，`openspec validate --strict` 翻黄 WARNING=FAIL）。已按 validator 建议拆为两个各说一事的短 Requirement（「Response headers SHALL reach the page via setResponseHeader」+「Intercepted request body SHALL be disclosed as inaccessible」），三个 Scenario 原样承载细节、新标题脱离 SDK 门控叙事、CORS 基线结论留在 Scenario 1 的 AND 行；复跑 `openspec validate ohos-committer-issues-jia-p3 --strict` = **valid**（全 change 含另两 delta 一并通过）。
