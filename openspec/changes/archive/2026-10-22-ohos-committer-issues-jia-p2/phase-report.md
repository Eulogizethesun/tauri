# Phase report — ohos-committer-issues-jia-p2（甲 p2 S 级行为波）

设备：MateBook Pro SN 3QC0124C11000038（desktop 2in1）。日期：2026-10-21。
基线：device-report-1020-desktop.md（311✅/7⏭/0❌，head 1147f3ae5）。

## 1. Commit 清单（D15）

| commit | 仓 | 内容 | issue |
|---|---|---|---|
| ability-① `13f2438` | openharmony-ability | StageEventType unknown → TryFrom + warn soft-fail | #221 |
| wry-① `e5e9024` | wry | set-cookie 两属性 / Eval Err null 回调 / url_cache 预填 / visible 直传 / pdf scale 注释纠偏 / clear_all_browsing_data OHOS 披露 | #190① #194 #199 #188 #233 #191 |
| tao-① `675dfb6b` | tao | focused mirror 位 / window_client Mutex+懒补取 / #178 验证(零码) / #174 仲裁 Branch A | #173 #184 #178 #174 |
| tauri-① `eb38df2a5` | tauri | set_enabled OHOS 早退 Err + cursor grab warn | #225 #178 |
| ability-② `6e59c4b` | openharmony-ability | #181 注入 / #231 日志治理 / #191 cookie 清理 / #233 pdf scale 透传（本报告第 4 节；**入 commit = 4 个 canonical 源文件**,package/ 四镜像为 gitignore 生成态 staging(commit 371d3d01,#87 minor-8,pack.bat xcopy 自 native_ability 再生),工作区刷新+字节校验不入 commit） | #181 #231 #191 #233 |
| tauri-② `d825e8786` | tauri | #191 套件用例 core.ts | #191 |
| tauri-③ | tauri | openspec 产物 + 双设备报告 + 主 spec 规范化 | — |

## 2. #174 仲裁结论（D6，一次定案）

**Branch A — 主窗 `window_id > 0` no-op gate 移除，setFocusable 真转发。**

- 仲裁日期：2026-10-21；设备 3QC0124C11000038；scratch 构建仅 :1258 gate 注释化，判读后已回退。
- hilog 证据（`hilog -b D` 使能后抓取）：
  - `10:19:51.879` `[tao-ohos] set_focusable dispatching window 0 focusable=false (arbitration probe)`
  - `10:19:51.898` `[tao-ohos] set_focusable dispatching window 0 focusable=true (arbitration probe)`
  - 全程 **无** `set_focusable: set_window_focusable failed` 失败 warn → OS 接受主窗 setFocusable。
- 判读方法学注记：桥接 set-focusable action 走 WindowPlugin.ets:755 `requireWindow` 后**直接调 `win.setFocusable`**（成功路径静默）；WindowManager.ets:603-613 的 `setWindowFocusable` hilog.debug 成功行是**死代码**，不构成 Branch B 证据源。可判读观测面 = Rust 侧 probe 行 + 失败 warn 缺席。
- 胜者支路落码：tao-① gate 移除 + 结构化失败 warn 保留；facade doc（tao::src/window.rs:897-901）补 OHOS 行「forwarded,成败以系统为准,拒绝以携带 window id 与平台错误的 warning log 浮出（仲裁 2026-10-21）」。
- scratch 产物零入 commit（.tmp 构建产物 + accel-inject-diag.sh 均不入）。

## 3. #178 核验结论（D9，验证为主）

- tao 侧两处异步失败臂（`src/platform_impl/ohos/window.rs`，tao-① 后行号）：
  - FFI 失败臂 :1801-1808 `set_cursor_grab({}) failed for window {} (real id {}): {}`（grab 值 + window id + real id + 平台错误串）
  - id 解析失败臂 :1809-1816 `set_cursor_grab({}): get_real_window_id failed for window {}: {:?}`（同结构）
  - 两处格式一致、均不静默、均含窗口标识符与错误串 → **判据满足，零代码改动**（禁统一而统一的噪音 churn）。
- 真缺口在 runtime 层：tauri-runtime-wry `SetCursorGrab` arm 原 `let _ = window.set_cursor_grab(grab)` 吞错 → tauri-① 补 `log::warn!("failed to set cursor grab: {e}")`（log-only 跨平台，零功能行为差）。
- `WindowDispatcher::set_enabled` OHOS 早退 `Err(NotSupported("setEnabled"))`（主线程 arm OHOS 下不可达，不动）；WindowExt set_enabled/is_enabled doc 补 OHOS 语义行。

## 4. ArkTS 行为波（ability-②）

### 4.1 #181 冷启动配置注入（D2）
- 注入点：NativeAbility.ets 主路径 `acceptingLifecycle = true`（:495）之后、onWindowStageCreate 前，嵌套 try/catch；joined-instance 早退路径（:250-272）**不注入**（known limitation，与事件转发同边界）。
- 类型换算（SDK 20 d.ts 实证）：resmgr `Configuration.locale` → app `Configuration.language`；colorMode/direction/screenDensity 为 distinct-but-value-equal 数字枚举（DARK=0/LIGHT=1、VERTICAL=0/HORIZONTAL=1、SDPI=120…XXXLDPI=640）→ `as number as ConfigurationConstant.*` 换算；mcc/mnc resmgr 为 number → `String()`。
- 失败兜底：catch 落 `hilog.warn "#181 config injection failed (theme stays default)"`，绝不 fail onCreate。
- 探针：`hilog.debug "#181 config injected: colorMode=%{public}d language=%{public}s direction=%{public}d"` 兼作「新 HAR 已生效」判据（R4）。

### 4.2 #231 日志治理
- accelerator_matcher.ets：3 处 console.info → `hilog.debug(DOMAIN, "AcceleratorMatcher", "%{public}s", …)`，消息文本逐字保留（accel-inject-diag.sh grep `Accelerator|combo=` 判据不变）。
- WindowManager.ets setPointerStyle 成功 console.info 删除（NAPI 同步体 hilog 禁区 C5）；失败 console 豁免保留。
- accel-inject-diag.sh（工作区文件，不 commit）：捕获前 `hilog -b D`、收尾 `hilog -b I`。

### 4.3 #191 / #233
- WebviewPlugin.ets clearAllBrowsingData 入口前置守卫式 cookie 清理：`typeof webview?.WebCookieManager?.clearAllCookiesSync === "function"` 探针 + try/catch，不可用/抛错 warn 披露并继续既有清理（#222 先例形态）。
- createPdf：`if (pdfConfig?.scale !== undefined) { cfg.scale = pdfConfig.scale; }` 透传（接口 :627 已就绪）。
- 双副本对称：ability.har 由 `package/` 打包（run-tests.sh Step 0 → pack.bat）；两副本逐字节同（WebviewPlugin 仅 :28 import 行差异豁免——native 面 `@ohos-rs/ability` vs package 面 `../../ability_exports`）。

## 5. 设备回归（6.3）＋ #181 真机验证（6.4）＋ #231 判读链复验（6.5）

### 5.1 全量回归（2026-10-21，run-tests.sh 3QC0124C11000038 desktop，双系统态各一轮）

- **319 例 ≥ 基线 318**，两轮同结果：311✅ / 8⏭ / **0❌**；footer `*Report generated at end of test run.*` 成立。
  - 亮色轮 11:06-11:08（系统态=亮色,Settings UI 深色模式「已关闭」截图存证 .tmp/jia-p2/set3.jpeg,provenance head eb38df2a5 pulled 03:08:41Z,diff-sha 9b784e9a969a9e16）
  - 暗色轮 11:13-11:15（系统态=暗色,见 5.2 切换链,provenance 同 head/diff-sha,pulled 03:15:25Z）——**入库的 device-report-1021-desktop.md 为暗色轮拉取**(两轮计数逐行一致)
- ⏭ 集合 = 1020 基线已知 7 条 + 本波新用例 1 条：row 52 `webview.clearAllBrowsingData clears document.cookie` 触发 design R6 降级门（`document.cookie` 在自定义协议 origin 下 set/read 不可观测，before=""）——skip 披露、不计 ❌，#191 的 ArkTS 侧清 cookie 代码路径仍随用例执行（clearAllBrowsingData 路由用例 row 51 ✅）。
- 构建面：hvigor 零 `module setup THREW`；**#181 注入行兼作「新 HAR 已生效」探针（R4）**——出现即证明部署的是本波 HAR。

### 5.2 #181 冷启动注入（6.4，D2）——双模式对照已取得

- **暗色冷启动实证**（系统 Settings→显示和亮度→深色模式→全天开启,uinput 驱动切换,新 HAR 冷启,pid 65449）：
  - `11:13:27.160` `#181 config injected: colorMode=0 language=zh_Hans_CN direction=1`（resmgr ColorMode DARK=0,合成值 = 系统真值）
  - `onWindowStageCreate: windowId=0` 晚于注入行 —— 注入先于窗口创建,时序判据成立
  - Rust 插件初始化行（tauritest tag）全部晚于注入行 → 灌入先于任何窗口/主题查询
  - `#181 config injection failed` warn：**0 条**（嵌套 try/catch 未触发）
- **亮色对照实证**（切换前主回归轮,pid 62186）：`11:06:00.015` `#181 config injected: colorMode=1 language=zh_Hans_CN direction=1`（resmgr LIGHT=1 = 切换前系统态）——同一注入代码在两种系统态下读取值随系统真实状态变化,即 resmgr 实时真值。
- 守卫吞没排除（代码确定性 + 证据）：注入点在 `acceptingLifecycle = true`（:495）之后,守卫（:1437）代码路径必然放行;注入行由注入代码在调用 onConfigurationUpdate 后同步打出,证明注入体执行;配置经 SerialTaskQueue 进 environmentCallback.onConfigurationUpdated——与系统回调**同一生产链**。套件 `win.theme` 冒烟（driver-generated.ts:420）无值断言,仅作调用不抛错的旁证。
- 工具学注记（fork 尝试留档）：带外 `param set persist.ace.darkmode` 写入不传播到系统内存态 colorMode（Settings 走内部 API 而非 param）——**可靠切换路径 = Settings UI uinput 驱动**（本报告即用此路径取得双模式对照）。
- 残余披露（不阻塞）：tao theme() 读回 Dark 无直接观测面（prod 构建无 CDP、driver 无值断言）;下游写入 app.configuration 与系统回调同链同码,亮/暗两态注入值均正确。

### 5.3 #231 判读链复验（6.5）

- accel-inject-diag.sh（DIAG 11:21:11→11:21:37，自带 `hilog -b D` 使能/`-b I` 恢复）：
  - `A01999/com.tauri.api/AcceleratorMatcher: [Accelerator] combo="a"/"k"/"ctrl+k" available=[]` —— **新 tag + hilog.debug 行可见** = 5.2 日志降级生效证明（旧代码走 ARKWEB-CONSOLE，新 HAR 才有 AcceleratorMatcher hilog 行）
  - 共捕获 4 条 combo 行；v1-v5 注入变体本身无新行（投递面为 diag 自有课题，超出 6.5 判据范围）

## 6. 行为波 diff 审计（7.2）

- 四 commit `git show --stat`：tao-① 3 文件 / wry-① 2 文件 / ability-① 2 文件 / tauri-① 2 文件；**Cargo.toml/Cargo.lock 全零 diff**（wry cookie `pub use time` 零新依赖实证）。
- **MenuBarComponent.ets 零触碰**（归乙 #205）；四 commit 无任何 .ets。
- NAPI 契约层零 diff（napi wire 类型未动；#188 visible 走既有 WebviewStyle wire，零 NAPI 改动;wry-① 新增面均为私有 fn + 测试）。
- host UT 收口（2026-10-21 复跑）：ability `cargo test -p openharmony-ability --lib` **84 passed/0 failed**；wry `cargo test --lib` **20 passed/0 failed**；tao host --lib 0 例（cfg(target_env="ohos") 门测试不编入 host,权威数=设备 UT **90 passed/0 failed**,tao-① 正文）。
- ability-② 两副本对称：matcher/WindowManager/NativeAbility 三文件镜像逐字节同;WebviewPlugin 仅 :28 import 行差异（既有豁免）。
- schema.json churn（5 仓构建再生成）不入任何 commit。
- 本报告第 4 节两副本对称审计见 4.3。

## 7. spec 契约走查（7.3，7 deltas / 39 scenarios）

| spec delta | scenario 数 | 落点证据 |
|---|---|---|
| ohos-event-lifecycle-forward | 2 | ability-① host UT（TryFrom round-trip + unknown 软失败 warn）实际运行 |
| ohos-theme-forwarding | 5 | #181 注入链 + 设备 hilog 探针 + `win.theme` 冒烟（第 5 节） |
| ohos-webview-bridge-fidelity | 7 | wry-① tests（Eval null 回调 / url 预填 / visible 载荷）+ doc 行 |
| ohos-webview-print | 3 | createPdf scale 透传 + wry 注释纠偏（2.6）+ 套件 print 用例存量 |
| ohos-window-focus-state | 7 | tao-① 设备 UT ×2（mirror 位）+ #174 仲裁 Branch A（第 2 节）+ 套件绿 |
| ohos-window-ops | 7 | tao-① 设备 UT ×3（#184 策略缝）+ tauri-① set_enabled Err / grab warn + 既有 window-ops 冒烟 |
| webview-cookie-mgmt | 8 | wry-① format UT（Expires/Max-Age/Session）+ #191 cookie 清理 + 套件新用例（第 5 节） |

## 8. openspec validate

`openspec validate ohos-committer-issues-jia-p2 --strict` → **valid**（7.6）。

## 9. PM 收尾注记（2026-10-21,W2 关口；developer 第 5 次中断后按 ④ 规则由 PM 从真相源重建收口）

### 9.1 "回归链 exit 1" 定案：bot-gate pr profile + 磁盘满污染

developer 收尾自检跑了 bot-gate（profile=pr，11:35 与 11:46 两轮）报 exit 1，其在定位中反复中断。PM 磁上取证定案：

- **根因一：D 盘 0 字节可用**（600G 满）。tauri/target ~210G（debug 113G / aarch64-ohos 74G / release 12G / x86_64-ohos 7.6G）+ plugins-workspace/target 74G + 兄弟仓 target ~28G 慢性逼近满，gate 三步（clippy/test/metric 各一套 flag 的全 workspace 编译）压垮。11:46 轮 tauri-utils "could not compile due to 1 previous error"（零编码诊断）与 metric "analysis: partial" 均为 os error 112 的伪装。处置：删 `target/debug/incremental`（42G 纯缓存，可再生），不动 aarch64-ohos 交叉产物（设备部署依赖，重建 45min+）。
- **根因二：两处 examples/api 存量 host `cargo test --all-targets` 编译断**（gate `cargo test --all-targets` 必炸，与 wave 改动面无关）：
  - E0599 `create_ohos_test_webview` 调 ohos-only `disable_clipboard_access` 无 cfg 门 —— developer 11:41 已修（fn+注册双门，对齐同列表 test_create_pdf 惯用法），未及提交。
  - E0433 `tray::simulate_tray_click` 注册（lib.rs:957）只门 `#[cfg(desktop)]`,而 tray.rs:5 内部属性 `#![cfg(all(desktop, not(test)))]` 在 test 构建把整个模块 cfg 掉——任何 cfg(test) 编译 api lib 必炸。11:35 轮 E0599 先炸致 build 取消未暴露，非 developer 编辑引入。PM 对齐为 `#[cfg(all(desktop, not(test)))]`（同 :330 setup 块惯用法）。
  - 两修复合并 commit `d35ad55ba`;复验 `cargo test --all-targets -p api --no-run` Finished、api lib UT **1/0**、tauri-runtime-wry `--lib` UT **15/0**（4.4 数字此前未录，补齐）。
- **残余 gate 红项（存量，非 wave 面，不修）**：tauri-utils `clippy::derivable_impls` @ config.rs:3292（上游代码在 gate `-D clippy::style/complexity/perf` flag 下的既有 lint）；metric BM002/BM004 unsafe-review 政策门（144+ 诊断遍布上游 crates/tauri）。后续 phase 跑 gate 前须先清磁盘余量。

### 9.2 SC2 终态（四仓）

ability host `--lib` **84/0** · wry host `--lib` **20/0** · tao 设备 UT **90/0**（aarch64-ohos 真机，tao-① 正文）· tauri-runtime-wry host `--lib` **15/0** —— 四仓全绿。

### 9.3 concerns 留痕

- developer 中断 ×5（watchdog ×3 / 网络 ×1 / Unknown ×1），返回值按 ④ 规则由 PM 从真相源（git log / tasks.md 44/44 / report 文件 / .botgate 日志）重建，零产物损失。
- 磁盘事件对用户披露：见 9.1;进一步清理（plugins-workspace 74G、release 12G、x86_64 模拟器 target 7.6G 均可再生）留用户裁定。
- E0433/E0599 两修复属 wave SC 外的 gate 基建修复，已入 d35ad55ba 正文披露。
