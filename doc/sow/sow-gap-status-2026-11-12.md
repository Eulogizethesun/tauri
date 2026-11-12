# SOW 缺口遗留项现状报告（2026-11-12）

> **口径**：以 2026-11-09 能力×用例对照总账（7 硬缺口）与 2026-11-10 质量加固收官呈报（5 产品缺口披露）为基线，按 2026-11-12 逐项核实的现状刷新。核实方法 = 注册表/源码/manual_tests.md 口径行逐条 grep + `npm run sow:check` 当日实跑。
>
> **一句话结论**：1109 总账的 6 项"待解决"遗留 + 1 项平台契约已**全部消解**（补用例 3、已有实现补登记 2、豁免登记 2）；1110 呈报的 5 个产品披露缺口经同日 fix 批（用户拍板「修复 3,1,2,5,4」）修复 4 项行为 + 1 项判据修订。机读账面 ⚠️0/❌0。fix 批首轮真机（09:07）的 14 ❌ 当日定位完毕——3 处缺陷修复后复验干净轮（09:51 生成报告）**385 行 ✅374/⏭11/❌0 收口**（修复+1 轮零问题）；同日两遗留 manual 行复验归一（⑤ §36.12 zoom 绝对语义 / ④ §36.10 scale watch），**scale tao 层披露就此关闭——fix 批五项全部真机闭环，产品级披露缺口清零**（残余=「显示大小」切档不转发与 payload/scaleFactor 口径分立两条设计性披露）。

---

## 一、机读账面现状（2026-11-12 当日 `npm run sow:check` 实跑）

| 项 | 值 |
|---|---|
| 判定 | **PASS**（机检门绿） |
| 注册表条目 | 514（§一 88 / §二 64 / §三 61 / §四 10 / §五菜单 86 / §五托盘 48 / §六 157） |
| 四档 | **✅502 / 🟡0 / ⚠️0 / ❌0 / excluded 12**（§四 10 流程级豁免 + §六 2：sidecar、updater download_and_install） |
| std 口径 | 461 条目 / 76 manual 标记 / 实跑 385 |
| cov 合计 | 341（driver 209 / side-replay 17 / bad-input 26 / fault 52 / windowOps 8 / apiGap 29） |
| MTD | 251 行（127 T0 / 124 T1） |
| WARN | 1 条 reverse-orphan：38 条文档行未被注册表引用（按钮驱动/系统交互域=预期） |

与 1110 收官口径（✅501 / excluded 13）的 delta：fix 批③ webview reload 由 excluded 转 std → **excluded −1、✅ +1**（sow-registry.ts:155-157 记录 B 批建账时的 Tier 语义转换，fix 批后 S2-004 转 std 落地）。

## 二、1109 总账 7 硬缺口逐项终局

| # | 1109 判定项 | 终局 | 证据 |
|---|---|---|---|
| 1 | ❌ 剪贴板大图（std 上限 4x4） | **已消（B 批补用例）** | S6-009 `writeImage(64x64)+readImage`（sow-registry-S6a.ts:100-107）：64×64 渐变 RGBA 16KiB 过 TSFN，size 精确往返 + 四角/中心 5 采样逐字节断言，plugins.ts:689-698 实现在。真机形态为已知种群 ⏭（READ_PASTEBOARD 未授权，与 4x4 系同降级契约） |
| 2 | ❌ log 统一输出（attachConsole/attachLogger 全树零命中） | **已消（B 批补用例）** | `attachLogger round-trip` + `attachConsole` 两条 auto（plugins.ts:134/168）；产品侧 OHOS 统一 sink 本为 hilog（JS info() → Rust log command → ohos_log → hilog），Webview target 形态按 app 配置 honest-skip（skip_logger + Stdout-only） |
| 3 | ❌ updater download_and_install | **excluded（平台契约，非缺口）** | S6-149（sow-registry-S6b.ts:480-490）：lib.rs:278-283 注释明示"intentionally NOT registered on OHOS — updates are AppGallery-owned，对齐上游 android/ios"；cov 侧保留错误分支盲调 |
| 4 | ⚠️ relaunch 空 fn | **已消（实现本在 + 登记补全）** | 产品实现：commands.rs:8-10 `restart → app.request_restart()` → `AppControlExt::restartApp` / `ApplicationContext.restartApp`（API 12+，CHANGELOG Unreleased 记录 + 真机三 boot 状态机实证）。用例为 manual 类非空转占位——杀进程无法 auto 断言（plugins.ts:931-936 注释）；S6-134 挂 std + MTD §三十九「relaunch — 进程冷重启」（sow-registry-S6b.ts:331-332） |
| 5 | ⚠️ sidecar 空壳 | **excluded（结构性豁免登记）** | S6-137（sow-registry-S6b.ts:353-354）："externalBin 结构性前置 + OHOS 沙箱不可 exec 任意二进制"；相邻能力 `Command.spawn` 由 S6-137 std 落名分（desktop risk-supplement 实跑臂 + mobile 沙箱形态占位），MTD §三十一 manual 行承载 |
| 6 | ⚠️ window-state clear（文档无行） | **已消（B 批补用例）** | S6-099（sow-registry-S6a.ts:915-922）`clear round-trip` std：save 确保文件存在 → clear 断 `deleted===true` + state_file 路径前缀 → 幂等二断 → 尾态 re-save；命令与 TestRunner.svelte:3773 按钮同源，cov driver 专条保留 |
| 7 | ⚠️ updater 对话框（准孤儿） | **已消（实现本在 + 登记补全）** | 产品实现：ohos.rs:92-101 `show_app_gallery_update_dialog` → bridge `download_and_install()`；S6-150 挂 std + MTD §三十行（sow-registry-S6b.ts:497-498，B 批补 TR 按钮）；用户交互形态 manual-by-nature |

**小结**：7 项中没有一项是能力欠缺——2 项产品实现一直都在（relaunch、updater 对话框），缺的只是登记/名分；2 项为结构性豁免（平台契约 1 + 沙箱前置 1）；3 项为用例缺口，B 批已全部补上。1109 的 ❌/⚠️ 语义是"能力×用例覆盖"判定，非"产品未实现"。

## 三、1110 五产品披露缺口现状（fix 批「修复 3,1,2,5,4」）

fix 批为 1110 收官后用户拍板的行为修复批（manual_tests.md 统计口径行 2026-11-10 fix 批段记录），**突破了此前"产品代码不动"的披露纪律**：

| # | 披露缺口 | fix 批动作 | 现状 |
|---|---|---|---|
| ① | 窗口居中（无窗口级 API） | 实装 `WindowExt::center` OHOS 覆写：current_monitor → calculate_window_center_position(work_area) → set_outer_position，与建窗期 cfg(desktop) centering 同公式（core.ts:892-897 注释） | S1-017 std 用例改几何比对（±8 物理px 容差）。首轮 #27 红=用例 JS 自身 bug（currentMonitor 是模块级函数被误作实例方法，core.ts 已修）；**11-12 复验 #27 ✅ 1831ms 归一** |
| ② | title getter（tao 恒空串） | tao set_title 增意图镜像：title() 读 app 最后请求值（window.rs:1725-1730 "Cache the intent for title()"） | S1-029 `setTitle+title round-trip` std；**2026-11-12 真机 #22 ✅ 374ms 归一** |
| ③ | webview reload 路由（Rust 能力在、JS 无 API、命令未注册） | S2-004 转 std：`webview child reload re-runs page script (probe re-reports)`（core.ts:2760-2804，子 webview probe 采样数重报断言）+ cov fault 错误分支（fault-injection-generated.ts:82-84） | 首轮 #97 红=命令面第 4 处漏注册（plugin.rs 之外，`crates/tauri/build.rs` PLUGINS 权限生成真源 + capabilities/run-app.json；「加命令改四处」坑）；**11-12 复验 #97 ✅ 641ms 归一，S2-004 excluded→std 落地闭环** |
| ④ | scale 源/tao 转发（S1-061） | 判据②修订为「事件应到达」；配置层已修（AppScope fontSizeScale:followSystem + 卸载重装，UpdateConfiguration fontSizeScale 0.85 到达 + onConfigurationUpdate 触发实证） | **已归一（11-12 复验 PASS）**：fix 批④ config 驱动边沿+组合值 payload 真机闭环——字体 0.85→1.30 档事件数 1、payload 2.47=1.9×1.3 精确对表（按钮监听+独立 CDP 预挂监听双通道互证；hilog onConfigurationUpdate→ConfigChanged composite=2.47 forward=true → JS 事件 74ms 送达）；§36.10 行 ✅ 归一。残余披露=「显示大小」切档 0 事件（VPR 不入边沿，两腿不动）+ payload 组合值与 Window.scaleFactor() 裸密度口径分立（均设计性披露非缺口） |
| ⑤ | ArkWeb zoom() 相对/乘法语义 vs 上游绝对值契约 | wry target/current 换算落地；新增 §36.12「Set Zoom 绝对语义复验」T1（S1-018/S2-032 复验行） | 已归一的旧相对语义披露行不动；**§36.12 复验行 11-12 真机 ✅ 归一**（10:21 三击全流程：1.5 放大→1.0 复原 100% 判据①② 目视，ARKWEB-CONSOLE [ManualTest] 三段佐证、零 set_zoom failed/桥接失败；wry 模型 ×1.5→×0.667 自洽） |

fix 批另将 4 项修复的行为判据收敛进既有 std 用例（不新增 MTD 行），仅 zoom 复验新增 1 例（合计 127 T0/124 T1/251）。

## 四、真机复验状态

| 轮次 | 形态 | 结果 |
|---|---|---|
| 1110 第 5/7 轮（fix 批前） | Run All | 384 行 ✅373 / ⏭11 / ❌0（两轮账一致，P0-2 勾销） |
| 2026-11-12 09:07 轮（fix 批构建后首轮） | Run All | 385 行 = ✅361 / ⏭10 / ❌14（footer 齐；三缺陷定性见下） |
| **2026-11-12 09:51 轮（三缺陷修复后干净轮）** | Run All | 385 行 = **✅374 / ⏭11 / ❌0**（footer 齐，App 新实例）——fix 批收口 |
| **2026-11-12 10:21/10:29 manual 归一轮（同实例）** | 手动按钮 | ⑤ §36.12 三击 PASS（判据①② 目视 + [ManualTest] 佐证）；④ §36.10 事件数 1、payload 2.47 组合值（双通道互证）——两行 ✅ 归一，fix 批遗留清零 |

**首轮 14 ❌ 终局定性（2026-11-12 当日定位完毕，修复后复验全绿）**：
- **#27 center**：`t.currentMonitor is not a function` = 用例 JS 自身 bug（模块级函数误作实例方法）→ core.ts 修（改用 `currentMonitor()` 模块函数 + null 时 honest skip）→ 复验 ✅1831ms。
- **#97 reload**：`webview_reload not allowed. Command not found` = 命令注册漏了第 4 处——`crates/tauri/build.rs` PLUGINS 是 ACL 权限生成真源（plugin.rs/capability/命令注册之外），加 `("webview_reload", false)` + `core:webview:allow-webview-reload` → 复验 ✅641ms。
- **#66-70 RunEvent 族 5 条 + #379-385 zombie 族 7 条（12 超时）= run_events 洪水**：tao-ohos event_loop 把 `MainEventsCleared` 逐事件派发（#84 handle 包装，桌面 tao 每循环迭代一次），demo lib.rs 恒推且 run_events 刻意永不清空，App 长时存活（当日 4h 空转）累积 **6,192,779 条**；每次 `get_tracked_run_events` 持锁克隆 ~120MB 拖死 run 回调，排队 invoke 全堵——只有调该命令的用例挂（与 RunEvent/zombie 两个死亡区完美相关；1110 第 5/7 轮绿是因为 App 只活几分钟，是存活时长差异不是二进制差异）。修=demo `lib.rs`（examples/api/src-tauri/src/lib.rs）`PUSHED` AtomicBool 门只推一条（#67 仅断存在性；披露权衡：「断言某动作后**新**一条 MainEventsCleared」不再可表达）→ 复验 #66-70 ✅41-1588ms、#379-384 ✅1-4s、#385 ⏭ fault-injection honest skip（回到 1110 种群 11 条）；live 复核 invoke 14ms / count=30 / MainEventsCleared=1（修复前 17.2s / 6.19M）。
- 环境放大项（非根因）：首轮跑至中段系统字号被切——④ 前向恰在失败区前只 fire 2 次，判读中已排除为主因。

**首轮 10 ⏭ / 干净轮 11 ⏭ 差一条之谜已解**：#385 fault-injection 的 honest skip 在首轮被洪水超时遮蔽（未跑到 fault 调用即 20s 超时记 ❌）→ 干净轮回到 11 条=1110 第 5/7 轮种群精确一致。11 条种群：READ_PASTEBOARD 未授权 4 条（writeText+readText / 4x4 ×2 / 64x64）、attachLogger 配置性 honest-skip 1、notification 权限 1、NFC 硬件 1、haptics 振子 1、version-gate 1、cookie 不可观测 1、fault-injection 未编入构建 1。

**本轮定位的取证方法坑（1112 新，后续 CDP/hilog 判读适用）**：
- **CDP 选窗**：按 title/url 选 target 会命中 incognito-probe 窗（与主窗同 URL 同标题）——选窗须逐 target 探测 `window.__TAURI__.window.getCurrent().label === 'main'`；
- **hilog 流前几秒回放缓冲区历史行**：直接计数算速率虚高（实测 3649 行/4s 实为 ~2/s）——实速率以两次真 invoke 间隔取样；
- **CDP dpr 探针不反映 ArkWeb zoom**（zoom=渲染面缩放不动 CSS 像素，dpr 恒 1.9）——§36.12 复验以目视 + [ManualTest] 报文为判据，dpr 读数不采信。

## 五、遗留待办（收敛后清单）

1. ~~当日真机 14 ❌ 定位~~ **已毕（2026-11-12 当日收口）**——三缺陷修复（#27 用例 JS / #97 命令面第 4 处 / run_events 洪水门）+ 干净轮 385 行 ✅374/⏭11/❌0，定性见 §四。
2. ~~scale S1-061 tao 层~~ **已闭（11-12 复验归一）**——fix 批④ config 驱动边沿真机闭环（§三④行）；残余披露=「显示大小」切档不转发（VPR 不入边沿）+ payload/scaleFactor 口径分立，均为设计性披露非缺口。
3. ~~zoom §36.12 复验行待按钮~~ **已毕（11-12 归一）**——fix 批四项行为修复全部真机归一：#22 首轮即绿（374ms，干净轮 363ms）；#27/#97 修复后干净轮归一（✅1831ms / ✅641ms）；§36.12/§36.10 于 10:21-10:29 manual 归一轮 ✅（§三⑤/④行）。
4. **披露文档同步**（全链最后一项）——fix 批 5 项行为修复落地后，`tauri-ohos-gap-analysis` / `tauri-ohos-dev-guide` / `tauri-ohos-api-support` 中的对应"已知限制"条目须按两版同源纪律同步修订（验证表述按「复验至 <版本/轮次>」级写）；scale 的两条残余披露（「显示大小」切档不转发、payload/scaleFactor 口径分立）随文一并写入。完成后本报告全链闭环。

## 六、证据来源

- 机检门：`npm run sow:check` 2026-11-12 输出（§一表全文转录；修复轮后复跑 PASS 同账）
- 注册表：`examples/api/src/lib/tests/sow-registry*.ts`（S1-017/S1-029/S2-004/S6-009/S6-099/S6-134/S6-137/S6-149/S6-150 等逐条行号）
- 产品源码：`tao/src/platform_impl/ohos/window.rs:1725`、`plugins-workspace/plugins/process/src/commands.rs:8-10`、`plugins-workspace/plugins/updater/src/ohos.rs:92-101`、`plugins-workspace/plugins/updater/src/lib.rs:278-283`
- 用例源码：`examples/api/src/lib/tests/core.ts:887-925/2760-2804`、`plugins.ts:134/168/519-598/689-698/931-936`
- 手册：`doc/manual_tests.md` 统计口径行（fix 批段）+ §三十/§三十九
- 真机：`examples/api/test-report.md`（2026-11-12T01:51:26Z 生成，385 行 ✅374/⏭11/❌0；首轮 09:07 报告已复验覆盖，14❌ 取证在 `D:\xuqiu\tauri-3.0\fixwave-logs\`）
- manual 归一轮：`D:\xuqiu\tauri-3.0\fixwave-logs\manual-5-4-2026-11-12.log`（hilog 双埋点 + [ManualTest] 三段/停止报文全文；CDP 独立监听读回 scaleFactor=2.47/size 2091×1324 @10:29:25.043）

---

*本报告为内部呈报文档；对外引用须遵守「计数不进公开指南、无出处数字不写、已知限制章必含」纪律，验证表述保留「复验至 <版本>」级。*
