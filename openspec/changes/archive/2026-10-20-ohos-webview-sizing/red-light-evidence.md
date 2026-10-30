# 红灯证据:ohos-webview-sizing(task 1.5,2026-10-19)

> 设备:桌面真机 `3QC0124C11000038`(2in1);套件:`run-tests.sh 3QC0124C11000038 desktop`。
> 被测栈:tauri head `0765b105f` + 未提交探针批次(serde camelCase 修复后);**ability 仓零改动(HEAD `ac911c2`)——ArkTS 渲染层即缺陷态**。
> 报告原件:本目录 `red-light-test-report-2026-10-19.md`(318 行 = 308✅ 基线 + 3❌ 新用例 + 7⏭;provenance diff-sha256 `9f500ed5b2ad4a1b`)。

## 探针装置修复记录(前代理 `undefined×undefined` 假红 → 真红)

- 根因(PM 假设,本次实证确认):`cmd.rs::ViewportProbeSample` 缺 `#[serde(rename_all = "camelCase")]`——返回侧 JSON 为 snake_case(`inner_width`),core.ts 读 `.innerWidth` 得 undefined。**参数侧 camelCase→snake_case 自动转换无碍**(23:46 轮样本已到达且 tag 匹配,仅键名错);修复 = 结构体加 rename_all,返回侧与 JS 接口对齐。
- 修复后 23:46 假红(`undefined×undefined`)→ 本次真红(真实读数),红灯装置有效。

## 红灯实测值(design「Test Design」判据逐条)

| 用例 | 请求几何 | 实测探针(修复后真值) | 判定 |
|---|---|---|---|
| case a「webview child created with explicit bounds renders at requested size」row 57 | child A bounds (50,50,300×200);child B (400,300,250×180) | **1101×657**(doc 1101×657)——主窗整窗内容区 vp 尺寸 | ❌ 红:S1/S4 显式 bounds 不生效;S6 缺陷签名成立(渲染=整容器,≠请求 300×200) |
| case b「setSize/setPosition change rendered geometry (last call wins)」row 58 | 初始 300×200 → setSize(400,300)+setPosition(60,70) → 再 setSize(250,150) | 全程 **1101×657** 不变 | ❌ 红:S7/S8 运行时 set_bounds 尺寸分量被忽略(HEAD setBounds 仅 position 生效指纹) |
| case c「natural webview follows container then flips explicit via set_bounds」row 59 | 副窗 natural(800×600 创建)→ 窗 resize 600×450 → set_bounds(320,240) | natural 段/跟随段**绿**(探针 601×451 跟随 600×450,±1 边框容差内);翻转段红:320×240 后探针保持 **601×451** | ❌ 红(仅翻转段):S9 首次显式 set_bounds 不覆盖自然布局;S2/S10/S11 防回归护栏绿(与 design S11 注记一致——该段不红非装置错) |

- case a/b 失败消息携带实测读数(`last sample: 1101×657`),红灯证据自描述;case c 失败点为**末段**翻转轮询(7769ms = 前段通过后到达),非前段。
- 基线零回归:308✅ 与修复前基线一致,7⏭ 不变。

## 判据仲裁

- 红灯判据(design/tasks 1.5):case a/b 全部 + case c 翻转段失败,且失败读数≈整窗/前值而非 `undefined` —— **全部满足**。
- 主窗 viewport 地面真值:主窗页面 `window.innerWidth/innerHeight` = 1101×657(用例内 console `[viewport-probe] main window viewport M=...`);子 webview 探针读数与 M 完全相等 ⇒ 渲染层整窗膨胀,非探针链路伪值。
- 单位契约:探针(ArkWeb `innerWidth/innerHeight`)与请求几何同为 vp/CSS px,二者直接可比且与屏密度无关(wry bounds() doc 单位契约)。**更正**:红灯记录时曾注「density 1.0」——绿灯阶段经 Rust 读回实测,本机 `Window.scaleFactor()`(OHOS Display scaledDensity)实为 **1.9**;该密度只影响 Rust 物理读回换算,不影响探针 vp 比较,红灯结论不变。
> **勘误注记(2026-10-28,PR#241 P2-3,原文本保留)**:参照设备 scaleFactor 实测 1.9(非 1.0)。本段「与屏密度无关」仅指**探针 vp 读数 vs 请求几何**这一条比较链;Rust 侧物理读回(position()/size() = 缓存 × sf)与 Physical→vp 换算链**依赖**该 1.9,不适用此句。另:本 change 的 311 例全部以 Logical 几何驱动(创建 x/y/width/height 与 setSize/setPosition 均 Logical),运行时 **Physical→vp 分支在真机上从未被执行**——其行为仅有 host 检查与单元推理覆盖,读本文档的消费者不得把探针比较的密度无关性外推到 Physical 输入路径。

## 结论

组 1 红灯收口:三用例在缺陷态 HEAD 上按设计分布实证失败,红灯装置(探针页 → 裸 invoke → Mutex 存储 → 轮询断言)全链有效。组 2 ArkTS 几何修复(ability 仓 stash `p2-webview-sizing-arkts-fix-held-for-red-run`,D1/D2)据此开工。

---

# 绿灯校准记录(组 2 修复后,2026-10-20)

> 同机同套件;被测栈 = 组 2 ArkTS 几何修复(HAR 重建部署)+ 组 1 探针用例。两轮校准修的都是**用例侧**断言,产品修复(D1/D2)本身在第一轮绿灯即生效。

## 校准一:+1px ArkWeb 视口测量常数(绿灯 run 1 → 修 pollViewportProbe)

- 现象:组 2 修复部署后首轮仍 3❌,但失败读数已变为**请求值 +1**(300×200→301×201、250×180→251×181、600×450→601×451),且主窗、natural 副窗、显式子窗在全尺寸上同号(systematic,双轴各 +1)。
- 定性:**ArkWeb viewport-report 语义**(页面 `innerWidth` 比组件几何多 1px 的平台常数),非几何错误——红灯轮的 natural 段读数(601×451 vs 600×450)同样带此常数,当时已被 ±1 边框容差吸收。
- 修复:`core.ts::pollViewportProbe` 校准为 ±1 容差(长注释记录常数与理由)。**容差必须保持 ≤1**:case b 的 400×300 与 250×150 两腿在同轴差 150vp,±1 不会串腿;放宽到 ±2 以上会弱化断言。

## 校准二:Rust 读回是 Physical API(绿灯 run 2 → 修 case a 读回断言)

- 现象:run 2 中 row 58/59/70 转绿,row 57 探针腿全绿,但 Rust 读回腿报 `child A Rust position (95,95) ≠ requested (50,50)`。
- 根因链(源码级):JS `new Webview({x:50,...})` → `webview/plugin.rs::create_webview` 包 `LogicalPosition/LogicalSize` → `webview_attributes.bounds` 原样 Logical → `with_bounds` 透传 wry → `bounds_cache` 存 **Logical**;而 JS `Webview.position()/size()` 是**文档化 Physical API**——`tauri-runtime-wry` 读缓存后 `.to_physical(window.scale_factor())`(lib.rs WebviewMessage::Position/Size 处理段)。本机 scale factor = 1.9 → round(50×1.9)=95,readback 正确,是**用例把物理读回当逻辑值断言**。
- 修复:case a 读回腿改为 `Math.round(logical × sf)` 期望值(`getCurrentWindow().scaleFactor()` 取数),失败消息携带 sf 与物理期望,自描述。IEEE 乘积两侧一致(50×1.9 的 double 最近邻即 95),严格相等成立。
- 佐证:95 = 50×1.9 双轴精确成立;tao `Window::scale_factor()` = `OpenHarmonyApp::scale()` = `default_display_scaled_density()`(NDK NativeDisplayManager),设备实测 1.9。
> **勘误注记(2026-10-28,PR#241 P2-3,原文本保留)**:本段换算链是「Logical 请求 → 缓存 Logical → 读回 × 1.9 → Physical」;设备上**没有任何用例走 Physical→vp 正向分支**(311 例全 Logical,见上一勘误注记)。因此「95 = 50×1.9 精确成立」只证明读回乘法链,不构成 Physical 输入换算(vp = physical / 1.9 再进 ArkTS)的真机证据;该分支的 round 语义(P2-1 哨兵契约依赖 Logical 值位透传)由 PR#241 的实现注释与 host 检查覆盖。

## 绿灯 run 汇总

| 轮次 | 结果 | 挂点 | 处置 |
|---|---|---|---|
| run 1(组 2 修复后首轮) | 308✅ / 3❌ / 7⏭ | 三新用例全挂,读数=请求+1 | 校准 ±1 容差 |
| run 2 | 310✅ / 1❌ / 7⏭ | row 57 仅 Rust 读回腿(95,95) | 校准 Physical API 换算;同轮 D2 破坏性交互修复:row 70 旧用例对「main」webview set_bounds(200×200) 会把 natural 主 webview 翻转成显式 stale 几何(hilog `set_bounds: id=main ...` 实证)——改为专用显式 bounds 子 webview(cmd.rs `set_bounds_test` 签名改造 + core.ts + TestRunner.svelte + manual_tests.md) |
| run 3 | 311✅ / 0❌ / 7⏭ | 无 | 三新用例(57/58/59)+ 专用子 webview round-trip(row 70)+ 回归面(resize 46 / blur 74 / 子窗 webview 296 / Float ops 311 / menu 族 159-200)全绿 |
| run 4(终轮,审查修复后) | **311✅ / 0❌ / 7⏭** | 无 | 审查 3 minor+2 suggestion 修复后的收口轮;fresh HAR(注释修正版)+ oh_modules/CompileArkTS 缓存已清重建;报告原件本目录 `green-test-report-2026-10-20.md`(331 行,provenance head `0765b105f` diff-sha256 `b0842bf3b6062ab9`,pulled 2026-10-19T17:22:32Z);`on_menu_event_infrastructure`(row 22,clear 后必须为空)绿 = viewport_probes clear 增补无副作用 |

- row 70 转绿 = D2 語義(fresh 显式 bounds 子 webview 上 set position+size 幂等 round-trip)在无污染对象上成立;「main」webview 的旧行为变更是 D2 的**设计内语义**(首次显式 set_bounds 即翻转),非回归。

## 内建审查收敛(rb-auditor,APPROVED → 修复 → 终轮)

- 审查结论:**APPROVED**(0 blocking / 0 major;8 重点问全 OK——D1/D2/D4、三铁律、两处校准正当性、红绿灯同断言集、提交卫生、advisory 一致性)。
- 3 minor 全修 + 2 suggestion 采纳(2026-10-20):
  1. case c S11 跟随腿 ±100/±75 宽容差 → `pollViewportProbe` 严格 ±1(design S11 ±0 减实测 +1px viewport 常数;部分跟随不再放行);
  2. case c 早退断言路径泄漏 Float 子窗 → finally 内按 label `getByLabel` 兜底 destroy;
  3. `clear_tracked_events` 漏清 `viewport_probes` → 补 clear(套件串行执行,不与活跃 poller 竞争);
  4. case a/b/c 轮询预算合计超用例 timeout → case a 20s / case b、c 25s,失败时报腿级消息而非外层超时;
  5. `ViewportProbeSample` 的 `Deserialize` 派生无 wire 消费方(track 命令为独立参数)→ 移除,Serialize-only;
  6. WebviewPlugin.ets `applyGeometry` 注释「density-1 契约下等于 physical px」措辞修正(vp 端到端 + DPI≠1 caveat,指向绿灯校准 2)。
- 修复后复跑终轮(见 run 4)收口。

