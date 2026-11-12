# Tauri OHOS 测试资产与质量交接（2026-11-09）

> **接手人从这一份续上。** 所有数字为 2026-11-09 在 `tauri` 仓 `ohdev-git` HEAD **73bffac6f**（= 11-06 真机全链验证同树）现场盘点核验；计数方法与坑见 §3，勿凭旧文档或记忆里的数。
> 套件本尊 = `tauri\examples\api`（**不是** `plugins-workspace\examples\api`，那是上游插件 demo，勿混）。
> 本文件是**内部交接文档**：对外口径纪律见 §7。

---

## 1. 一页现状

| 层 | 规模 | 上次全绿 | 断档 |
|---|---|---|---|
| std 自动层 desktop | 385 实跑（fix 批后 461 条目） | **2026-11-12**：374✅/11⏭/0❌（fix 批干净轮；11-10 第 5/7 两轮 384/373/11/0） | 无 |
| cov 覆盖层 | 341 装配 | 2026-10-28：668 行（std 327+cov 341）= 581✅/87⏭/0❌（head e092fd18a） | 15 天；当前加固树未跑过 cov（静态计数由 sow-check 机检 ✅） |
| std 自动层 mobile | 314 行口径 | 2026-10-15：167✅/147⏭/0❌（head 1a34b6b97，Mate 70） | **28 天**；std 314→337 演进未在 mobile 复验 |
| manual 文档层 | 251 行（127 T0 + 124 T1） | **2026-11-12**：fix 批两行（§36.12 zoom 绝对语义 / §36.10 Watch ScaleChanged）复验归一，无未归一行 | 依赖人按按钮（scale tao 层披露已闭，唯「显示大小」切档不转发=设计性披露） |
| Rust 侧 tao 设备 UT | 108 用例 | 2026-11-04：108/108 | 无 |
| API 面覆盖率（llvm-cov 插桩） | 97.0%（S10 终局） | 2026-09~10（S1-S10 系列） | 插桩层按需重跑 |

报告归档：`examples/api\` 根下 **42 份**历史报告（`device-report-*` / `emu-report-*` / `test-report-*` / `p*-report` / `issue7-*` / `float-race-*` 系列；活的 `test-report.md` = 11-12 fix 批干净轮，385 行 ✅374/⏭️11/❌0）。仓外证据归档在 `D:\xuqiu\tauri-3.0\.dep-diffs\`。需求口径权威文档 = `D:\支撑Task\ohos-sow-20260909.md`（内部）。

---

## 2. 三层套件总账

### ① std 自动层（`src\lib\tests\`，17 个数组，397 条目）

组装点 `src\views\TestRunner.svelte`：**L117** `allTests` 拼装 17 数组；**L134** Run All 前过滤 `category !== 'manual'`；**L322** 按类目单跑；批序 rationale 见 L95-115 注释（api-gap 破坏性操作排最后；zombie-close 8 条排尾保序号稳定）。

| 数组文件 | 条目 | manual 标记 | 实跑 |
|---|---|---|---|
| core | 93 | 10 | 83 |
| plugins | 85 | 19 | 66 |
| menu（desktopOnlySuite 包裹） | 90 | 14 | 76 |
| tray | 31 | 0 | 31 |
| window-ops | 22 | 0 | 22 |
| ohos-gap | 19 | 5 | 14 |
| ohos-adapter | 10 | 8 | 2 |
| zombie-close（11-04 新） | 8 | 1 | 7 |
| risk-supplement | 5 | 0 | 5 |
| dpi / window-dpi / image / ohos-mobile-plugins | 6/5/5/6 | 0 | 同条目 |
| ohos-screenshot / ohos-continuation / stronghold | 4/4/3 | 1/1/1 | 3/3/2 |
| ohos-init | 1 | 0 | 1 |

**397 − 60 标记 = 337 = 11-06 真机报告行数，全等。**

> **11-12 fix 批后（B/C1-C5/P0-3 + 产品缺口修复轮）**：上表为 11-09 盘点口径。现行权威账见 sow-check：std **461 条目 / 76 manual 标记 / 实跑 385 行**（与 11-12 真机报告 385 行全等；11-10 第 5/7 两轮为 459/75/384）；数组文件与条目分布的演进增量以 `sow-registry.ts` 分片与 `sow:check` 输出为准，不逐表回改。

框架 `src\lib\test-runner.ts`：`skip(reason)` 抛 `skip:` 前缀 → 记 skip 带原因；`TEST_TIMEOUT_MS=5000`（内部延迟 ≥3s 的用例须显式 timeout）；`appendResult` → `invoke('append_test_result')` 5s 兜底（2026-08-27 挂死教训）；`ohosSdkApiVersion()` 版本门控双模断言；`desktopOnlySuite`/`skipOnMobile` 移动端门控。

11-06 报告 9 个真 skip（全带 reason，接手人应熟记这 9 条=已知种群）：#52 cookie 不可观测、#100/104/105 clipboard READ_PASTEBOARD 未授权、#118 通知权限关、#149 无 NFC 硬件、#294 haptics 无马达、#315 版本门控（API 23 ≥ 22，Err 侧仅低 API 设备断言）、#337 fault-injection 特性未编入构建（zombie 批）。

**11-12 fix 批干净轮 11 个真 skip（现行种群，序号随 +1 行整体后移）**：#87 cookie、#126 attachLogger（log://log 未发射——app 配置 skip_logger + Stdout-only，OHOS 统一 sink=hilog，marker 判据须 hilog 侧 grep）、#140/144/145/146 clipboard READ_PASTEBOARD（#146=B 批新增 64×64 大图）、#160 通知、#195 NFC、#342 haptics、#363 版本门控、#385 fault-injection 未编入构建——与 1110 第 5/7 轮 11 skip 种群精确一致（fix 批首轮曾 10 条：#385 被洪水超时遮蔽未跑到 skip，见 §6 fix 批加账）。

### ② cov 覆盖层（6 数组，341 条）

门控：`TestRunner.svelte L116` `VITE_COVERAGE_TESTS ∈ {'true','1'}`——**纯前端构建期环境变量**（vite 原生暴露 `VITE_*`，无 vite.config 改动；构建前设 `$env:VITE_COVERAGE_TESTS='true'` 即烧入）。

组成：driverTests 209（= 208 个 `driverCase(` 调用 + 1 条手写条目，56416e8eb 把 float.hide+show+center 改手写、5b20181e6 重标 smoke）、sideReplay 17、badInput 26、faultInjection 52、apiGap 29、windowOpsExtra 8。api-gap 破坏性操作排最后。

末轮（10-28 covwave-r2）87 个 skip 的种群构成：std 侧已知 9 条同款 + **driver 探测未编入 demo 构建的 command → "Command xxx not found" 族**（devtools_open_only / sentry_test_panic 等）——这是 cov 层的正常种群，不是回归。**11-06 报告不含此层。**

### ③ manual 文档层（`tauri\doc\manual_tests.md`，39 节，231 行）

**勿更新——用户长期指令**（缺口只披露不回写，见 §7）。231 = 122 T0 + 109 T1（文档自带判据 `\| **T[01]** \|` 行 grep；逐行解析为 229 纯行，2 行同含两标记；§十二用 8 列表少「三级场景」列，机读需注意）。真验证走 TestRunner「Manual Tests」按钮区（41 行手动按钮用例 §三十六）。

### 60 标记 ↔ 231 文档行的关系（1109 逐条对过）

标记 = 自动套件同文件内「无法编程断言」的占位锚（fn 空/仅提示，L134 过滤**永不执行**、不进报告）——**不是「手动用例的代码化」**；文档行 = 人执行场景用例（9 列步骤/判据）。粒度轴不同：标记按 API 名，文档按 UI 场景。

- 语义对应约 **54 条**（dialog 8↔§四 8 行严格 1:1；unstable 3↔§十六、deep-link 3↔§二十 同 1:1；多为 1 标记↔N 行场景拆分）
- **孤儿标记 4 条**（有代码锚、无文档行、从未手动验证）：`shell.sidecar`、`shell.Command.spawn`（外部二进制）、`menu.about_exec`、zombie 的 `ut_pending_close_drain_confirms_removal`（11-04 新增未回流，文档禁改中）；准孤儿：`updater.showAppGalleryUpdateDialog`
- **文档独有约 160 行**（tray 11 / menu 29 / 手动按钮 41 / multi-uiability 6 等按钮驱动、人眼判据域，数组零标记；反向 tray.ts 31 条全自动+11 行人工，分层干净）
- 锚定机制是**人读的**：plugins.ts L739-742 注释指回 §4；§十二节头列出 7 条已自动覆盖

### ④ SOW 注册表账本与机检门（2026-11-10 新，P0-2/P0-3/P2-2 的落地形态）

**SOW 504 条能力 ↔ 三层证据的机器账**。审计（§5 缺口）暴露「对应关系全靠 agent 考古」的结构性问题，本日落地为可维护资产：

- **账本**：`examples\api\src\lib\tests\sow-registry.ts` + 7 分片（S1~S6b，514 条目=504 能力+§四 10 流程豁免）。每条存 `std`/`cov`/`manual` 证据引用（逐字 name / '§节号|用例名称' 行锚）+ `plan`（缺口条目的处置批次）+ `note`（口径备注）。**判定四档不手填**——由脚本从证据推导。
- **机检门**：`examples\api\scripts\sow-check.mjs`（`npm run sow:check`，examples/api 下跑）。esbuild headless 求值 23 数组取全部 name→双向校验（注册表引用存在性 / std 锚点↔wrapManual 按钮字面量↔文档行三件套 / 孤儿双向 / id 唯一 / excluded 必有 reason）+ 四档推导对账 `SOW_BASELINE_1109` + manual 行口普查（对 §四十一统计小表互证）。**`--selftest` 5 变异红臂**：删文档行映射/改坏 std 锚/复制 id/置空 reason/制造孤儿锚，逐一必须红——校验脚本自身先被校验（blind-wrapper 教训）。
- **面板**：TestRunner「SOW Coverage」可折叠面板（读注册表按 §一~§六 渲染四档+过滤），只读账本不重复校验——机检门仍在脚本。
- **baseline 快照（C5 后，2026-11-10）**：✅501 / 🟡0 / ⚠️0 / ❌0 / excluded 13（=plan 3 + §四 10）。增量轨迹：A3 437→B 442→C1a 451→C1b 470→C2 483→C3 496→C4 500→C5 501。**🟡 cov-only 清零**——58 条 cov-only 全部按批转正（44 auto 真断言 / 18 manual 按钮行 / 3 excluded 登记）。
- **P0-3 孤儿消解（C5 后同日追加，不改四档计数）**：4 孤儿全落名分（§6 P0-3 条目），manual_tests.md 增至 250 行（127 T0/123 T1）；两条新文档行复用既有按钮，第 5 轮真机已 ✅ 归一（2026-11-10）。
- **excluded 清单（3 条 + §四 10 条流程级豁免）**：① updater download_and_install——平台契约（lib.rs 有意不注册，AppGallery 承担，对齐上游 android/ios）；② sidecar/Command.spawn（externalBin 结构性前置+OHOS 沙箱不可 exec，孤儿锚经注册表落名分）；③ S2-004 webview reload——JS API 无 reload 方法且 `webview_reload` 命令全仓未注册，Rust 能力存在（lib.rs:1905）但缺 JS→Rust 路由，**缺口披露不改产品代码**（可另立 follow-up）。§四 10 条=SOW L82 工具链豁免（build.rs/cargo-mobile2 代码路径证据在各分片 note）。
- **manual_tests.md 已按用户 2026-11-10 拍板解锁·只追加**：既有 229 行一字不动，新增行=解析器同款格式（✅ 只落名称/级别列，复验后归一）；统计小表/节序号顺延=文档自身惯例。§7 红线相应收窄为「只追加不回改既有行」。

### Rust 侧与框架文档

tao 设备 UT 108/108（`--lib` 必带、双设备 `-t` 定向，详见 tauri 仓 run-ut.sh 历史配方）；`tauri::test` 在 OHOS 不可用；examples/api 的 command 权限**唯一真源 = `src-tauri/build.rs` AppManifest**（加命令要改四处）。`doc\auto_test_framework\frontend-test-guide.md` 结构正确但**细节过时**（写 manual→skip，实为 L134 整条过滤；无 cov 层/按钮区内容）——以本文档 1109 口径为准。

---

## 3. 判读判据与计数方法（六坑，全踩过）

**报告判据**：报告文件 `/data/storage/el2/base/cache/test-report.md`（真机路径 `/data/app/el2/100/base/com.tauri.api/cache/`），**footer `*Report generated at end of test run.*` 出现才算跑完**；provenance 行（head / 未跟踪数 / diff-sha256 / device / pulled 时间）**核对后才采信**——报告文件是判据，hilog 只是证据。pull 完先对行数再对内容。

**计数六坑**：
1. helper 构造例：`driverCase/sideCase/badCase/faultCase/gapCase` 调用数各减 1 条定义行；driver-generated 另有 1 条手写条目（Name4 法才数得到）
2. 嵌套数据字段冒充：plugins.ts L996 `category:'test'`（sentry breadcrumb 数据）
3. **顶格 `{` 条目**：plugins.ts L725 缩进异常 → `^  \{` 计数漏 1；**用 `^    name: '` 行数为准**（各文件与真值全等）
4. 注释假阳性：core.ts L1233 `//   category: 'side-effect'`
5. git grep POSIX ERE 无 `\w`（用 `[A-Za-z_]`）；`Case\(` 撞 gapCase/faultCase
6. PS5.1 读这些文件**必须 `-Encoding UTF8`**，否则 mojibake

**铁证判据**：std 静态 397 − 60 = 337 = 真机报告行数。任何一层对不上，先查六坑再怀疑代码。

**HAND-EDIT ANCHORS 协议**：driver-generated.ts 头部要求每次手改追加锚记录；解冲突以 `git log -p -- <file>` 为准，`git log -S` 只是计数变化提示。

**历史基线勘误**（旧数字勿再引用）：旧「manual 59」= 数组 manual 标记数（8fdbbdb21 时点），**不是**手动文档层（当时已 229）；旧「std 325」带误差（plugins 实为 66 非多大 64）；725 之类混合口径作废。当前树漂移链：324（8fdbbdb21）→ +3（9925aac5e，#237/#238）→ +2（3c6b065e5，#207/#226）→ +1（cd157e593，#244）→ +7（c3f7b9596，zombie）= 337。

---

## 4. 运行手册

**std desktop 轮**（HAD-W32，3QC0124C11000038，API 23）：
```powershell
cd D:\xuqiu\tauri-3.0\tauri\examples\api\src-tauri
cargo tauri ohos run --device-type desktop      # >8min，第一秒就后台跑，禁 tail
# 应用起来后 TestRunner 页 Run All；跑完 pull 报告：
hdc file recv /data/storage/el2/base/cache/test-report.md D:\xuqiu\tauri-3.0\tauri\examples\api\test-report.md
```
坑：**目的地必须 `D:\` 反斜杠形式**；hdc `[Fail]` 仍 exit 0——**禁止 `&&` 链**，必须解析输出。

**cov 轮**：同上，构建前 `$env:VITE_COVERAGE_TESTS='true'`。验收先对总行数（当前树应为 337+341=678 量级）再对 footer。

**mobile 轮**（Mate 70，3AQ0124926000712，API 26）：`--device-type mobile`；验收 = 0 ❌ + desktop-only 门控 skip 种群对上（上轮 147）。2in1 模拟器：须 `build --target x86_64-unknown-linux-ohos`。

**manual 轮**：人按 TestRunner「Manual Tests」按钮，验证者同时抓 hilog 判读——工作模式=「用户执行按钮，日志校验由验证侧做」。

**hilog**：`hdc shell hilog | grep --line-buffered <tag> > 文件` 后台跑；**起流先回放缓冲区历史行**（晚开捕获可捞回早前事件，判读以 meta fire 时刻为准）。前端 console 实时进 hilog 的 tag = **ARKWEB-CONSOLE**（A01194）。栈判读：CppCrash 取证 `.gnu_debugdata`+行号扫描；JSCrash 错误码比较前 `Number()` 归一化。

**其他常踩**：长构建 >8min 第一秒 run_in_background；整树 checkout 会回退未提交手改（还原须点名路径）；报告/截图为未跟踪文件不碍 git 状态，但 provenance 的「N uncommitted tracked file(s)」计数只看已跟踪文件。

---

## 5. 质量现状评估（诚实版）

**强**（都有实证）：
- 报告判据闭环：footer + provenance + 行数全等，11-06 两轮全等（git 链全量重编译 + 注册表 clean-room 双重铁证）
- skip 语义化：9 条真 skip 全带 reason，种群已知
- 变异红臂先例：babysit 10-27（先变异再验假绿）、zombie 双变异红臂 11-04、blind-wrapper 吞 skip 四例——纪律已验证有效但**靠人临场做**
- 三层互证 + 静态/动态对账（397−60=337）
- cfg 隔离纪律（CLAUDE.md 三铁律）+ examples 权限真源唯一

**弱**（交接时如实告知）：
1. **门靠人不靠机器**：没有一条 CI 真正跑 OHOS 套件（tauri 22 workflows 非 OHOS 门；openharmony-ability 唯一 workflow 继承上游且红=常态照合；muda 是唯一活 CI 仓且带 4 个环境红）
2. **cov 层断档 12 天**：73bffac6f 树从未跑过 cov 装配；其后 4 个演进 commit 未过 cov
3. **mobile 断档 25 天**：10-15 后 std 314→337（zombie/window-ops/risk 等 23 条）未在 mobile 复验
4. **版本门控 Err 侧从未在硬件 fire**（#315 恒 skip）
5. 97% 覆盖率是 **API 面**（llvm-cov），非用例级——「API verified 但 std 无断言」的洞未排过
6. 文档↔标记↔按钮三方锚定是人读的注释，无机检；TestRunner.svelte 单文件 220KB
7. 计数对账靠人手六坑纪律，无脚本

一句话：**门很强，但扛门的是人。** 加固计划就是把人扛的门换成机器扛。

> **2026-11-10 加固后复核**：弱 3（三方锚定无机检）/6（计数靠人手六坑）已由 sow-check 机检门消解（注册表 514 双向校验+selftest 5 红臂+静态/动态对账全等）；弱 4（版本门控 Err 侧）/5（API↔用例矩阵）仍开放归 P1/P2；弱 2（cov 断档）现口径=当前加固树未跑 cov 装配（静态计数机检 ✅，实跑归 P0-1 延续项）。强清单新增：✅ 归一机制（41+ MTD 行）、披露清单条目化、连续两轮真机账一致判据。

---

## 6. 质量加固计划（P0/P1/P2，按优先级）

### P0 —— 交接窗口内（约 1 天量）

**P0-1 cov 层在 73bffac6f 复跑一轮**
- 动作：`VITE_COVERAGE_TESTS=true` + desktop 全跑
- 验收：总行数 678 量级（337+341）全跑完（footer 出现）；0 ❌；87 条量级已知 skip 逐条对上（9 条 std 种群 + Command-not-found 族），新增 skip 逐条定性
- 依据：cov 末轮 10-28 树 e092fd18a，其后 56416e8eb / 5b20181e6 / c3f7b9596 / cd157e593 均未过 cov 装配

**P0-2 计数对账脚本化（2026-11-10 已落地为 sow-check，见 ④）**
- 内容：① std 静态 = Σ`^    name: '` − manual 标记 == 报告行数 == provenance head == git HEAD；② cov 静态 = 6 数组 helper 调用 − 定义行 + 手写条目；③ manual 文档行按其自身 grep 判据；六坑写进脚本判据与注释
- 落地形态：`npm run sow:check` 收编①②③ + 注册表双向校验 + 四档推导 + MTD 行口普查（对 §四十一统计小表互证）+ `--selftest` 5 变异红臂 5/5（2026-11-10 实测）。报告行数对账（真机侧）随每轮 pull 报告人工核对——脚本管静态口径，真机判据仍按 §3/§4 手册
- 依据：本次全等是人手做的；六坑全部实际踩过；blind-wrapper 教训=校验脚本自身须先被校验
- **勾销达成（2026-11-10 第 7 轮收官）**：sow-check PASS（std 459 条目/75 manual 标记/**实跑口径 384 与真机报告 384 行全等**；MTD 250 行；注册表 514=✅501/🟡0/⚠️0/❌0+excluded 13；wrapManual 183 处）+ selftest 5/5 + **连续两轮真机账一致**（第 5 轮与第 7 轮均 384 行/✅373/⏭️11/❌0、footer 齐、11 skip 均已知种群）——P0-2 收口
- **fix 批加账（2026-11-12 干净轮收官，产品缺口修复轮「修复 3,1,2,5,4」）**：sow-check PASS（std **461 条目/76 manual 标记/实跑口径 385 与真机报告 385 行全等**；MTD 251 行=127 T0/124 T1；注册表 514=**✅502**/🟡0/⚠️0/❌0+**excluded 12**——S2-004 webview reload excluded→std，#97 `webview child reload re-runs page script (probe re-reports)` ✅641ms；wrapManual 184 处）。真机：首轮 09:07 **14❌**（12 超时 RunEvent/zombie 族 + #27 + #97）→ 当日定位完毕 = 三缺陷修复——① #97 命令面第 4 处（`crates/tauri/build.rs` PLUGINS 是 ACL 权限生成真源，「加命令改四处」坑）② #27 用例 JS（currentMonitor 模块级函数误作实例方法）③ **run_events 洪水**（tao-ohos 逐事件派发 MainEventsCleared #84 包装 × demo 恒推 × 永不清空，4h 存活累积 6.19M 条，`get_tracked_run_events` 持锁克隆 ~120MB 拖死回调；修=lib.rs PUSHED 门，live 复核 invoke 14ms/count=30；1110 两轮绿=App 只活几分钟的存活时长差异）→ 复验干净轮 **385 行 ✅374/⏭️11/❌0**（11 skip=1110 种群精确一致）——fix 批收口。**同日 manual 归一轮（10:21/10:29）**：⑤ §36.12 三击 PASS（1.5 放大→1.0 复原 100% 目视+[ManualTest] 佐证）；④ §36.10 字体 0.85→1.30 事件数 1、payload 组合值 2.47=1.9×1.3（按钮+CDP 双通道互证，hilog 全链 74ms 送达）——两行 ✅ 归一，**S1-061 tao 层披露关闭，fix 批五项全部真机闭环**；残余披露=「显示大小」切档不转发（VPR 不入边沿）+ payload/scaleFactor 口径分立（设计性）。run_events 洪水披露权衡=「断言动作后新一条 MainEventsCleared」不再可表达（#67 仅断存在性，门后恒 1 条）。

**P0-3 孤儿标记处置（2026-11-10 已收口，四条全部落名分）**
- `shell.sidecar`→S6-136 excluded 登记；`shell.Command.spawn`→S6-137 std 落名分（desktop risk-supplement 实跑臂 + mobile 沙箱形态占位）；`menu.about_exec`→§2.1 新行「About Dialog — 预定义关于对话框」（复用既有 MenuBar Show 按钮，Help→About→ArkTS showAlertDialog）；`ut_pending_close_drain_confirms_removal`→§九 新行「In-flight Close Drain — 子窗 ✕ 关闭排水」（S3-021 子窗排水级，主窗进程级两行分立）
- 验收达成：每条有处置且注册表/sow-check 机检可见（manual_tests.md +2 行，127 T0/123 T1/250）；两新行已于 2026-11-10 第 5 轮真机 ✅ 归一（About 行=hilog 点击链+用户确认弹窗；排水行=hilog 去重实证）——P0-3 收口
- 依据：1109 逐条对过，孤儿=有代码锚无文档行

### P1 —— 接手后一个月内

**P1-1 门禁机器化**：count-check + footer/provenance 判据 + skip 种群比对 → 手动触发的 GitHub Actions（静态部分进 runner；真机部分留人工+上传报告产物触发校验）。现状所有门长在人的纪律里。
**P1-2 mobile 基线复跑**：Mate 70 跑 std；验收 0 ❌ + skip 种群对上 + 10-15 后新增 23 条在 mobile 逐条定性。
**P1-3 低 API 轮**：找低 API（<22）设备/镜像跑一轮，让 #315 从 skip 变实跑、版本门控 Err 侧真断言一次（PR 文本已披露此限制）。
**P1-4 变异红臂制度化**：每次合入波后至少一条 kill-arm；最小落点=写进 count-check 自检臂。

### P2 —— 结构性（排期拍板）

**P2-1 API 面↔用例映射矩阵**：`tauri-ohos-api-verified.md`（156 条 A/M）× 337 实跑，找「API 声称 verified 但 std 无断言」的洞——97% 是 API 覆盖不是用例质量。
**P2-2 manual 数字化**：文档行↔Manual Tests 按钮↔数组标记三方注册表机检（现在锚定是注释互相指）；同批拆 TestRunner.svelte 220KB。
**P2-3 报告判读半自动化**：footer+provenance+skip 种群 diff 工具，替代逐轮人眼。

---

## 7. 纪律红线（交接必须传承）

1. **对外不写内部套件数据**：328✅/9⏭/0❌、套件计数、clean-room 过程、内部构建规模——一律不进 issue 附件/公开指南；对外验证表述只留「YYYY-MM 复验至 <版本>」或 per-feature「YYYY-MM-DD 真机 E2E 通过」级。本文件是内部文档不受此限。
2. **`doc\manual_tests.md` 解锁·只追加**（用户 2026-11-10 拍板）：既有 229 用例行一字不动；新行=解析器同款格式（✅ 只落名称/级别列，复验后归一）；统计小表/节序号顺延=文档自身惯例；未归一新行的判据修订=允许。
3. **报告先验 provenance 再采信**；报告文件是判据，hilog 是证据；判读先回放 ARKWEB-CONSOLE。
4. **skill 文件永不提交**；`tauri-ohos-publish` skill 有 4 处过时点，用户未批别擅动。
5. **工作模式**：用户按按钮，日志校验由验证侧做——不要替用户按 UI。
6. **凭证不入库**：ohpm/签名材料在用户本地（rc/项目外），交接时线下转。
7. 修复收敛规则：修复 + 1 轮零问题即收口；确认轮新问题修后披露，不无限轮。
8. cfg 三铁律见 `tauri\CLAUDE.md`——任何 OHOS 改动前重读。

---

## 8. 在途未决事项（非测试，交接同步）

| 事项 | 状态 |
|---|---|
| PR #59（Eulogizethesun/openharmony-ability，beta.2 源侧版本线） | 待合并；合并后验形状 → 本地 ff → push fork 对齐（重试配网络直连窗口） |
| 十仓分支切回裁定 | 当前全部在 `ohdev-git`；旧约定「测试统一用 ohdev」已被 11-06 全链验证覆盖，切回与否待用户拍板 |
| 外溢两版 `tauri-ohos-dev-guide.md` / `tauri-ohos-api-support.md` | 与 issue #93 附件同源过时，**未批不动** |
| `tauri-ohos-publish` skill 4 处过时 | 未批不动 |
| issue #93 附件（guide + SKILL + plugin-matrix） | 1106 刷新收官，三 file id SHA256 与本地全等 |

---

*盘点方法与全部过程证据：11-09 会话（三层逐文件计数、60 标记逐条对照、报告逐行 tally）。基线报告：`examples\api\test-report.md`（11-06）与 `test-report-1028-covwave-r2-desktop.md`（cov 末轮）。*
