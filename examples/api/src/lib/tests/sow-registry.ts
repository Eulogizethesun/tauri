// SOW 能力清单 ↔ ohdev 分支用例映射注册表（504 条 + §四 10 条流程级豁免 = 514 条目）
//
// 数据源：
//   - SOW 原文：D:\支撑Task\ohos-sow-20260909.md「三、能力清单与验收测试用例」§一~§六
//   - 1109 逐条审计：tauri\doc\sow\sow-blocks-2026-11.md（转录证据源，BLOCK×节）
//
// 铁律：
//   1. 判定四档不手填——scripts\sow-check.mjs 从 std/cov/manual 证据推导
//      （✅=std 非 manual 锚 或 文档行；🟡=仅 cov；⚠️=仅 manual 锚无文档行；❌=全空；excluded 单列）。
//   2. std/cov 引用=数组条目 name 逐字相等（cov 含 'driver: ' 等前缀）；
//      manual 引用='§节号|用例名称'（节号=manual_tests.md 标题键，脱✅，不存行号）。
//   3. plan 字段只出现在 72 条缺口条目（47 auto / 22 manual / 3 excluded + §四 10 条豁免；C4+C5 后）。
//   4. 分片由节 agent 转录（BLOCK×行号→精确 name），脚本「引用存在性校验」是转录质量的机器关卡。

export interface SowItem {
  id: string;            // 'S1-001'..（节内序号，顺序=SOW 原文；§四= 'S4-001'..）
  section: '一' | '二' | '三' | '四' | '五菜单' | '五托盘' | '六';
  group: string;         // SOW 能力域名，如 '窗口几何'
  name: string;          // SOW 原文短语，如 '窗口居中'
  std?: string[];        // std 数组条目 name（逐字相等；含 category:'manual' 锚点条目）
  cov?: string[];        // cov 条目最终 name（含 'driver: ' 等前缀）
  manual?: string[];     // '§十四|Full Test Tray — …'（节号+用例名称，脱✅，不存行号）
  plan?: {
    kind: 'auto' | 'manual' | 'excluded';
    batch: 'B' | 'C1a' | 'C1b' | 'C2' | 'C3' | 'C4' | 'C5' | 'S4';
    reason?: string;     // kind='excluded' 必填
    probe?: string;      // 可选契约探针说明
  };
  note?: string;         // 口径备注（豁免依据、双态登记、降级预案等）
}

import { sowS1 } from './sow-registry-S1';
import { sowS2 } from './sow-registry-S2';
import { sowS3 } from './sow-registry-S3';
import { sowS4 } from './sow-registry-S4';
import { sowS5m } from './sow-registry-S5m';
import { sowS5t } from './sow-registry-S5t';
import { sowS6a } from './sow-registry-S6a';
import { sowS6b } from './sow-registry-S6b';

/** 全量注册表（SOW 原文节序）。 */
export const sowRegistry: SowItem[] = [
  ...sowS1,
  ...sowS2,
  ...sowS3,
  ...sowS4,
  ...sowS5m,
  ...sowS5t,
  ...sowS6a,
  ...sowS6b
];

/** 节序（渲染与统计用）。 */
export const SOW_SECTIONS = ['一', '二', '三', '四', '五菜单', '五托盘', '六'] as const;

/** 每节应有条目数（SOW 原文口径；sow-check.mjs 对账，缺漏即 FAIL）。 */
export const SOW_EXPECTED_COUNTS: Record<string, number> = {
  '一': 88,
  '二': 64,
  '三': 61,
  '四': 10,
  '五菜单': 86,
  '五托盘': 48,
  '六': 157
};

/** 冻结基线（A3 2026-11-10 冻结；B 批同日更新）：机器推导 504 口径四档分布
 *  （全量 514 − §四 10 流程豁免）。sow-check.mjs 对账目标。对 1109 审计账
 *  439/58/4/3 的全部差额已逐条归因（见下），实测优先——禁止改判据凑数，
 *  禁止回填手填判定。
 *
 *  B 批（Phase B 硬缺口落地，2026-11-10）：+5✅——大图/log×2/wsc 补 std 真断言
 *  （S6-009/S6-069×2/S6-099），relaunch/updater 对话框补 TR 按钮（锚名归一）+
 *  manual_tests.md 文档行（S6-134/S6-150，新增 §三十九、统计顺延 §四十）。
 *  A3 冻结账 437/61/2/1 → B 批后 442/59/0/0。真机验证轮全过（341 行=330✅/11⏭/0❌，
 *  relaunch pid 冷重启实证、updater 对话框按契约拒绝分支 PASS、hilog sow-log 双标记）。
 *
 *  C1a 批（Phase C 纯平移 9 条，2026-11-10）：+9✅——path 6（S3-041~046）+ fromPath
 *  （S3-039）+ 子窗 hide+show+center（S1-069）+ availableMonitors（S1-072）从 cov
 *  层断言同源平移入 std。B 批后 442/59 → C1a 后 451/50。
 *
 *  C1b 批（Phase C §三收官 19 条，2026-11-10）：+19✅——app-info 8（S3-003~008/
 *  011/012）+ 目录 11（S3-048/050~058/060）。§三 至此 61✅/0🟡。两处按源码实证的
 *  契约改判：app.hide+show 与 setDockVisibility 均为非 macOS no-op（plugin.rs cfg
 *  门，manual 判据定义性不可验→auto 契约断言，#237 先例）；runtimeDir 为定义性缺席
 *  （BaseDirectory::Runtime cfg 摘除，android 同款）→「必然拒绝」探针。目录断言按
 *  ohos.rs 映射表改 el2 严格后缀（计划稿 includes(identifier) 因 el2 挂载视不含
 *  bundle 名而失效）。真机首轮勘误（2026-11-10 第二轮前修正）：目录断言首版期望
 *  bundle 级 el2/base/files，实测 JS 层 10/10 为模块级 el2/base/haps/<module>/…
 *  （与 appCacheDir 模块级路径陷阱同源，Rust/物理侧才是 bundle 级）——assertDirPath
 *  改为模块段可选+尾部严格，bundle 级/模块级两形态皆合法。
 *  C1a 后 451/50 → C1b 后 470/31。
 *
 *  C2 批（Phase C §六插件生态收官 13 条，2026-11-10）：auto 6 + manual 7 = §六 0🟡。
 *  - auto 平移 5（S6-081 fs.open+write+readFile / S6-082 readTextFileLines /
 *    S6-092 store.reset / S6-096 sqlite.memory / S6-105 persisted-scope.clear /
 *    S6-117 upload.download localhost:3005——按「auto 5+1 download」实施）；
 *  - manual 7（S6-124 barcode 设置页 / S6-141 opener 缓存目录 / S6-142 opener
 *    本地链接 / S6-138 shell.open help / S6-155 sentry panic release dormant
 *    契约行，新增 §四十 Shell / 统计顺延 §四十一；S6-123 barcode cancel 与
 *    S6-103 恢复fs授权为纯链接零新增——后者系审计漏挂既有行与既有按钮的反向
 *    孤儿勘误，不新增行/按钮）。
 *  C1b 后 470/31 → C2 后 483/18。
 *
 *  C3 批（Phase C §一窗口能力收官 13 条，2026-11-10）：auto 7 + manual 6 = §一 0🟡。
 *  - auto 7（core.ts 新 std）：S1-073 primaryMonitor（null-or-valid 契约）/ S1-029
 *    setTitle+title 往返 / S1-052 getAllWindows（main+子窗枚举+destroy 收尾）/
 *    S1-062 onThemeChanged+setTheme 回环（降级预案：红→转 manual）/ S1-066 子窗
 *    toggleMaximize mirror / S1-067 子窗 setEnabled mirror / S1-017 center 几何比对
 *    （与 S1-069 链路条互补：069 验链路、017 验几何）；
 *  - manual 6（core.ts 锚点 + TR 按钮 + manual_tests.md §36.10 新增 6 行）：S1-018
 *    setZoom（webview 层 API，d.ts:347；与 S2-032 共用）/ S1-037 setSkipTaskbar /
 *    S1-040 setShadow / S1-042 setIcon（1x1 PNG；推翻 §36.9:823「窗口层无运行时
 *    API」旧备注——Window.setIcon d.ts:940 存在）/ S1-061 onScaleChanged（须单独
 *    排程，系统显示设置）/ S1-088 startDragging（位移≥10 逻辑 px）。
 *  C2 后 483/18 → C3 后 496/5。
 *
 *  C4 批（Phase C §二收官 4 条，2026-11-10）：auto 1 + manual 3 = §二 0🟡。
 *  - auto 1（core.ts 新 std）：S2-019 emitTo（EventTarget 对象形式定向：
 *    {kind:'Webview',label}→本窗 listen 断 payload 逐字段）；
 *  - manual 3（core.ts webview 节锚点 + TR 三按钮 + manual_tests.md §36.11 新增
 *    3 行）：S2-032 子 Webview setZoom（动态建子窗，与 S1-018 泛化行分立）/
 *    S2-034 子 Webview setFocus（判据按 A/B 定案收敛为 z-order 置前）/
 *    S2-035 子 Webview hide+show（两击式，计数按钮承载未重载判据）。
 *  C3 后 496/5 → C4 后 500/1（余 §五 S5M-052）。
 *
 *  C5 批（Phase C §五菜单收官 1 条，2026-11-10）：auto 1（menu.ts 新 std）：
 *  S5M-052 Menu.default——id 非空 + items() 数组 + 长度≥2 + 逐项 id 非空
 *  string（Rust menu.rs:187 非 macOS 模板：Edit/Window/Help）。
 *  C4 后 500/1 → C5 后 501/0：🟡 cov-only 清零，504 口径全量 ✅/excluded。
 *
 *  P0-3 批（孤儿标记消解，2026-11-10，C5 后追加；不改四档计数）：4 孤儿全落名分——
 *  ① shell.sidecar→S6-136 excluded（B 批已登记）；② shell.Command.spawn→
 *  S6-137 std 落名分（desktop risk-supplement 实跑臂 + mobile 沙箱形态占位）；
 *  ③ menu.about_exec→S5M-034 manual=§2.1 新行（复用既有 MenuBar Show 按钮恢复的
 *  默认菜单 Help→About→ArkTS showAlertDialog，NativeAbility.ets:703）；
 *  ④ ut_pending_close_drain_confirms_removal→S3-021 std+manual=§九 新行（子窗 ✕
 *  排水级，与主窗进程级两行分立）。manual_tests.md 同批 2 新行（127 T0/123 T1/250）。
 *
 *  fix 批（产品缺口修复轮，2026-11-10，用户拍板「修复 3,1,2,5,4」）：③ S2-004 webview
 *  reload excluded→std——plugin.rs 注册 webview_reload（#[cfg(target_env="ohos")]，
 *  桌面命令面不变）+ JS api Webview.reload() + core.ts 子窗 reload std 用例（探针
 *  重报判据）。①center/②title getter/⑤zoom 绝对语义/④scale 事件为行为修复，
 *  不新增条目（各自 std/manual 行已存在，判据随修复收敛）。⑤ 额外挂复验载体：
 *  MTD 新 §36.12 行（S1-018/S2-032 manual 各 +1 引用）+ 两条目 std 各 +1 锚点
 *  （三击 TR 按钮，绝对语义判定；基线漂移披露=ArkWeb 原生热键/捏合缩放不经
 *  wry，无 getter 读真值不可行）——MTD 行 250→251，四档计数不变。
 *  C5/P0-3 后 501/3 → fix 批后 502/2。
 *
 *  审计账 → 冻结基线 差额归因（类别级，逐条见各分片 note）：
 *  ① 审计汇总表自身算术错（以逐条表+机器推导为准）：§一 汇总 72✅/16🟡 vs 逐条 73✅/15🟡
 *     （机器=逐条）；§五菜单 汇总 0⚠️ vs 逐条 4⚠️（机器 0⚠️=4 条预定义菜单经托盘
 *     full_test_tray + §十四行交叉承载转 ✅）；§六 净变行与总报告 ⚠️/🟡 计数互相矛盾。
 *  ② Tier 语义转换（审计无 excluded 档；硬缺口按终版方案登记 plan）：
 *     sidecar ⚠️→excluded；updater download_and_install ❌→excluded；S2-004 webview
 *     reload 🟡→excluded（JS→Rust 路由缺口，Rust 能力存在）；剪贴板大图 ❌→🟡（B-auto）；
 *     window-state clear ⚠️→🟡（B-auto 补断言）。
 *  ③ 交叉承载显式化（审计✅但证据未落引用；泛化=特化联合，5 条）：S6-010 弹出消息框
 *     （message() 默认 kind=info）、S6-046 读取深链监听器（JS API 面无 getCurrentListeners，
 *     口径=经监听器读链接→§二十 onOpenUrl 行）、S6-087 查询文件元数据（=fs.stat 断言）、
 *     S6-114 请求本地服务（std http 全打 localhost:3003 本地 echo）、S6-154 测试Sentry面包屑
 *     （与 S6-153 同 sentry_test_breadcrumb 命令）。
 *  ④ 真缺口新发现（审计✅无证据支撑，转 🟡+plan C2）：S6-103 恢复fs授权（跨重启恢复
 *     无断言载体）、S6-105 清空持久化Scope（clear 无 std 断言）。
 *  ⑤ ⚠️ 4→2：relaunch 与 updater 对话框保留 ⚠️（plan manual，Phase B 补文档行回流）；
 *     sidecar 转 excluded、window-state clear 转 🟡（见②）。
 *  ⑥ ❌ 3→1：updater download_and_install 转 excluded、剪贴板大图转 🟡（见②）；
 *     log 统一输出保持 ❌（attachLogger/attachConsole 回环 = B-auto 补齐）。 */
export const SOW_BASELINE_1109 = {
  ok: 502,       // ✅（fix③ 后；A3 437 → B 442 → C1a 451 → C1b 470 → C2 483 → C3 496 → C4 500 → C5 §五收官 501 → fix③ S2-004 reload 转 std 502）
  covOnly: 0,    // 🟡（C5 后清零；A3 冻结 61 → B 59 → C1a 50 → C1b 31 → C2 18 → C3 5 → C4 1 → C5 0）
  manualOnly: 0, // ⚠️（manual 锚点无文档行；A3 冻结时 2，B 批 relaunch/updater 对话框回流）
  missing: 0,    // ❌（A3 冻结时 1：log 统一输出，B 批补 std 断言）
  excluded: 2    // plan.kind='excluded'（不含 §四 10 条流程级豁免；C5 后 3 → fix③ S2-004 转 std 后 2：updater download_and_install + sidecar）
};
