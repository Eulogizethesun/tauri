# Tasks: OHOS 增量覆盖率提升 S1-S5

> 状态标记：[ ] 未开始 / [x] 完成 / [-] 阻塞（注明原因）

## S1 路径 A 全量覆盖跑（0.5 天）

- [x] 1.1 修复 TestRunner.svelte:70 allTests 补 `...windowOpsTests`（一行）
- [x] 1.2 cov-build.sh 重打插桩 hap（含 windowOpsTests 前端变更）→ 签名 → bm install -r
- [x] 1.3 冷启动跑全量用例，回收 profraw → llvm-profdata merge → lcov 导出（s1-cov/app.profdata + app.lcov，3601 SF）
- [x] 1.4 incr-cov2.py 加 `--app-lcov` 参数（per-line max 合并 UT 与 app 来源）；另加 profdata="none" 纯 app 模式
- [x] 1.5 产出 S1 基线数字 **56.5%（8168/14462，较 12.2% +44.3pt）**，已更新 doc/ohos-test-coverage.md；校准结论：偏差 <5pt，S2-S5 预估不变
- [x] 1.6 windowOpsTests 11 用例回归：**11/11 全过**；全量 283 用例 281✅/1❌（#86 剪贴板读权限已知）/1⏭️（#271 haptics 无振动器）

## S2 driver 盲调用套件（2-3 天）

- [x] 2.1 写生成器脚本：uncovered-fns.json + 命令注册表 → driver 用例候选清单（含安全性标注）——`gen-driver.py`，内置 cmd.rs 55 命令 + 31 插件命令面 + @tauri-apps/api window/webview/app 实测方法面（对照 dist/*.d.ts 逐个校验）
- [x] 2.2 人工审白名单，生成 `src/lib/tests/driver-generated.ts`（@generated 头）——213 SAFE + 17 SIDE = 230 用例；排除 8 类破坏性操作（process exit/relaunch/clear_test_report/主窗口 minimize 等），清单 `s1-cov/driver-candidates.md`
- [x] 2.3 test-runner 支持 category 'driver'（catch-all + 3s 超时 + 失败不阻塞 + 报告单列）——TestCategory 加 'driver'；NOT_IMPLEMENTED 正则→skip，其余错误（错误分支被点亮）→pass
- [x] 2.4 手动按钮"side-effect 复放"段（~30 个无断言调用）加入 test-runner 末尾——sideReplayTests 17 用例（setEffects 家族/openUrl/notify/watchPosition/权限弹窗/对话框收尾）
- [x] 2.5 重打 hap 跑一轮 → S2 基线数字 + fn-analysis 复跑对比——**62.8%（9076/14462，较 S1 56.5% +6.3pt）**；完整跑通 519 行报告（491✅/3❌/15⏭️，3 失败均已知：#86 剪贴板平台限制、geolocation requestPermissions 挂起专项、dialog 需人工交互）。踩坑两轮：① test_navigate/test_reload 导航/重载主窗口 SPA 卸载 runner；② close_test_window 签名注入 window=调用者窗口，从主窗口调=自杀（已入 EXCLUDED，现 10 项）。修复 run-app.json 补 12 项 ACL 权限（window destroy/badge/size-constraints、webview zoom/focus/auto-resize/clear-browsing-data、fs 读写文本、shell spawn、sentry panic），盲调 ACL 拒绝 14→0
- [x] 2.6 验收：driver ≥ 150 用例（✅ 209 driver + 17 side）；S1+S2 ≥ 70%（❌ 62.8%）；diff_exec≥5 未覆盖函数减半（❌ 799→759，-5.0%）——**预估值校准**：盲调用快速饱和（表面路径一轮点亮，深层分支需坏输入/故障注入），S2 实得 +6.3pt vs 预估 +16-19pt。S3-S5 目标需按此重定基线：S3 预估 +5-8pt（原 +8-10）、S4 预估 +3-5pt（原 +5-7）、S5 预估 +2-4pt（原 +3-5），终态预估 73-80%（原 87-90%）。分仓：pw 48.7→63.9（+15.2pt 最大）、tauri 50.1→57.9、tao 48.7→56.0、oha 59.3→63.5、wry 56.5→60.0

## S3 坏输入错误用例（2 天）

- [x] 3.1 按 design.md §三矩阵写 bad-input 用例集（非法 JSON/无效 id/越界/不可达 URL/权限拒绝）——gen-driver.py 新增 BAD 段 26 用例（serde 类型错 7/幽灵 label 6/越界值 6/不可达 URL 路径 5/权限拒绝 2），生成 badInputTests
- [x] 3.2 错误用例排 driver 套件尾部 + 用例间无顺序依赖审查——badInputTests 挂 sideReplayTests 之后，全部自包含（幽灵 label 用 uniq 后缀、建毁窗口单用例内闭环）
- [x] 3.3 重打跑一轮 → S3 基线数字；serde/lookup 错误分支覆盖对比（fn-analysis）——**62.7%（9071/14462），与 S2 62.8% 持平（-0.1pt）**；545 行报告 513✅/2❌/20⏭️（#86 剪贴板 + dialog 需交互，geolocation 上轮授权后本轮转 ✅）；文件级 diff：跑间方差 ±5 行，坏输入真实增益仅 +3-4 行
- [x] 3.4 验收：显式错误构造行覆盖可见增长（❌ 实际 ~0）；无测试间串扰（✅）——**根因结论**：driver 盲调用 blind() 语义=吞错但执行，幽灵 label/不存在路径/非法值本就是盲调常态，JS 可达的错误分支在 S2 已全部点亮。剩余未覆盖错误分支为 bridge 失败类（ArkTS 侧返回错误码/异常/超时），只能靠 S4 故障注入触发。**S3 预估 +5-8pt 未达成（实际 ~0）**；终态预估再修正：62.8% + S4（bridge 失败分支，量级待 S4 设计评估）+ S5（形态专属分支）≈ 65-72%

## S4 故障注入（4-5 天，走 design→audit→apply→build 全流程）

- [x] 4.1 oha 故障注入详细设计（registry 数据结构、dispatch 检查点位置、命令 wire 格式、feature 门控方式）——产出 `openspec/changes/ohos-coverage-rampup/s4-fault-injection-design.md`（实现级，52 用例，预估 team +2.7pt / oha +5.4pt / 错误分支 ~65%）
- [x] 4.2 audit 子agent 复核：feature 门控完整性、铁律合规、产线零影响——主体断言全部核实一致（注入点行号/宏/feature 模式/pack.bat xcopy/wire 格式）；**1 个 P1**（timeout 返回 pending Promise 泄漏 callState，修正为 throw 超时格式 Error）+ 4 个 P2（feature 落点 crates/ability/Cargo.toml、requires:[]、ack class 风格、ohpm stale cache）均已并入设计文档；结论：修正后可进 apply；铁律 #1/#2/#3 合规
- [x] 4.3 apply：ArkTS FaultInjectionRegistry + dispatch 检查点 + Rust set_rule/clear 命令——13 文件（ArkTS 2 + Rust 5 + tauri 4 + cov-build 1 + pack/模板零改动）；5 项编译验证全绿（feature on/off × oha/examples/api + 前端）；11 个设计里不存在的 action 名经 ArkTS 源码核实替换（如 controller-request→get-url、set-size→resize、create→create-os-window）
- [x] 4.4 产线验证：不带 feature 的 cargo check（✅ apply 已验证 0 error）+ 正常 hap 构建无注入代码（✅ prod-verify-s4.sh：feature=prod 独立 target（target-prod）构建产物 nm 查 fault_injection/FaultRule 符号 = 0、`__llvm_prf` = 0；对照插桩 .so fault 符号 = 48。注意 `src-tauri/.cargo/config.toml` 无条件带 `-Cinstrument-coverage`（覆盖率基建产物），验证时须移开或走 ohrs 链路绕过——真实产线 cargo tauri build 由 ohrs 的 CARGO_ENCODED_RUSTFLAGS 接管不受影响；ArkTS 侧 FaultInjection.ets 按设计恒编译但运行时 enabled=false 短路）
- [x] 4.5 写错误注入用例（~40-60 个，对照 uncovered-fns 错误分支密集函数）——52 用例 7 组，fault-injection-generated.ts +292 行，TestRunner 挂载（VITE_AUTOTEST 门控）；每用例 set_rule→调用→clear 模式，timeout 类 ≤3 个
- [x] 4.6 插桩构建跑一轮 → S4 基线数字——**62.9%（9190/14616，vs S2 62.8% +0.1pt）**；597 行报告 562✅/5❌/20⏭️（3 已知 + 2 通配注入用例超时）。真实增益拆解（文件级 diff）：旧代码 +53 行（wry +19、tauri-runtime-wry +13、oha plugin-webview +11、tao +4、tauri +5、错误行仅 7 条 0→1）+ S4 自身新代码被执行 +63 行；分母 +154（oha bridge/mod.rs +98、app.rs +56，fault_injection.rs 未跟踪不入 diff 口径）。**预估校准**：设计预估 +2.7pt（~385 exec）实得 +0.1pt，虚高 3.4 倍——错误 handler 体仅 1-3 行、`?` 传播不增行、uncovered-fns 剩余错误分支多在 52 个注入点之外。分仓：tauri 58.3（+0.4）/tao 56.3/wry 62.5（+2.5）/oha 63.0（-0.5，新代码稀释）/pw 63.9。踩坑：① app 命令 ACL 权限需手工登记在 build.rs `AppManifest::commands`（cfg 门控命令无自动生成）——fault_injection 两命令缺登记 → 运行时 ACL 拒绝 52 用例全 skip，修 build.rs + run-app.json 两处；② cov-build.sh `cargo|tee` 无 pipefail 吞退出码，cargo 失败后仍装旧 .so（已补 set -o pipefail）
- [x] 4.7 验收：显式错误构造行覆盖 ≥ 60%——**S4 62.1%（502/809，S2 61.8%）**，达线但需诚实标注：该口径在 S2 已 61.8%（设计"从 ~0 起"前提有误——"~0"只对 uncovered-fns 深层函数成立），S4 注入的独有贡献 = 7 条旧错误行 0→1（bridge attach_promise catch、wry ohos ×4、tauri-runtime-wry、tauri webview/plugin）

## S5 mobile 形态插桩合并（3 天）

- [x] 5.1 cov-build.sh 支持 --device-type mobile（entry_mobile strip:false + 同链路）——cov-build.sh 本就按 `OHOS_DEVICE_TYPE` 参数化（ENTRY_MODULE=entry_mobile + cargo 编译期 cfg_alias 链已核实 tauri-build/src/lib.rs:480-487）；唯一缺口 entry_mobile/build-profile.json5 `strip:true`→`false`（剥离符号破坏 llvm-cov 映射），已改
- [x] 5.2 mobile hap 构建/签名/安装（先解决 mobile 构建已知缺口的回归）——补 3 个缺口后全链路打通：① 根 build-profile.json5 modules 数组无 entry_mobile（tauri-cli 正常会重写，cov-build.sh 绕过 tauri-cli 需自做 module swap，已内置 python 脚本）；② entry_mobile/oh_modules 从未安装 → CompileArkTS 24 个 arkts-no-any-unknown 错，entry_mobile 目录 ohpm install 解决；③ strip:false 已改。hap 构建/签名/安装/启动全绿
- [x] 5.3 挑选 mobile 适用用例子集，跑覆盖——同套 587 用例直接跑（未按形态过滤）：351✅/138❌/98⏭️；❌ 大头是 "Plugin not found: window" 类（window/tray 等 desktop 形态专属 bridge 未注册，mobile 上预期不存在，非回归）；profraw 回收→profdata→lcov（3522 SF）
- [x] 5.4 incr-cov2.py 三来源合并（UT + desktop + mobile）——merge-app-lcov.py（desktop+mobile app.lcov per-line max，语义=任一形态覆盖即覆盖）+ exec-analysis-merged.py 三来源。**踩坑**：首版 `if cnt > old` 丢 count-0 DA 行 → 分母缩 566 行 → 假涨到 65.4%；修正 `if ln not in m or cnt > m[ln]` 保留 0 计数行（0 计数行是 exec 分母的一部分）
- [x] 5.5 S5 最终基线数字 + 排除清单定稿（design.md §六）——**62.9%（9190/14619），与 S4 62.9%（9190/14616）完全持平：mobile 形态新增覆盖 0 行**。根因（已闭环验证）：全八仓 Rust diff 中 cfg(mobile) 专属行 = **0**——所有形态门控均写作 `cfg(any(mobile, target_env = "ohos"))`，desktop 形态编译时同样包含；形态差异只存在于 ArkTS entry 模板（entry_mobile vs entry_desktop）与 bridge 注册面，均在 Rust lcov 口径之外。mobile 独有覆盖行 143 行全是 reqwest/tokio 上游依赖代码（diff 口径外）。分仓不变：tauri 58.3/tao 56.3/wry 62.5/muda 95.4/tray-icon 80.8/window-vibrancy 81.2/oha 63.0/pw 63.8
- [x] 5.6 验收：总口径 87-90%（❌ 实得 62.9%，S2 起已多轮校准下调）；exclusions 口径 ≈ 95-98%（❌ 按 §六清单估算剔 ~1000-1500 行仅到 ~66-67%）——**终态诚实结论**：阶段式爬坡（盲调用快速饱和 + 错误分支需故障注入 + 注入 yield 仅 +0.1pt + mobile 形态零增量）后，本口径可达上限即 ~63%；原 87-90% 预估的失效根因已逐阶段归档（见 tasks 2.6/3.3/4.6/5.5）

## 收尾

- [x] 6.1 doc/ohos-test-coverage.md 全面更新：最终基线表（各阶段演进）、排除清单附录、复现命令——新增 S5 基线段 + "终态总结"（S1-S5 演进表/分仓终态/87-90% 失效根因链五条/诚实结论）+ 排除清单口径附录（§六 定稿）+ 复现命令汇总附录
- [x] 6.2 全部测试/基建改动整理成待审清单（用户审阅后提交，严禁直接 push upstream）——`openspec/changes/ohos-coverage-rampup/review-checklist.md`：按仓分类（oha 故障注入 360 行 / tauri 驱动侧 226 行 / UT 批 3 仓）+ 基建（cov-build.sh、prod-verify-s4.sh、cov-tools/ 分析脚本已收编出 jobs tmp）+ 可丢弃清单 + 5 步提交拆分建议

## S6 休眠纯函数直补 UT（2026-08-24，追加阶段）

- [x] 6.3 剩余未覆盖行函数级休眠分析（三源合并口径）——uncovered-fnlevel3.py：5429 未覆盖 = 2949 整函数休眠（55%）+ 2480 部分覆盖（45%）；**教训：单源（仅 app lcov）分析会把 UT 已覆盖行误判为休眠**（keycodes to_logical 被误报 198 行休眠、实际 UT 已覆盖 163 行），必须 ic.export_lcov(profdata,bins)+merge_lcov 三源合并后再分析
- [x] 6.4 直补 34 用例（4 crate，设备侧全绿）——tao input_tests 20 用例（handle_input_event/handle_mouse_event/handle_axis_event：CursorMoved/MouseInput/MouseWheel/Touch/Key/Ime 全变换路径 + CURSOR_X/Y/PRESSED_KEYS 状态）、tauri-runtime-wry with_config_tests 4（WindowConfig→builder 全字段断言）、oha mouse_event tests 9（From 变换/Default/hover/callback setter）、tauri debug_app_icon 1
- [x] 6.5 cov-run.sh 重跑三仓插桩 UT + exec-analysis-merged.py 复算——**66.0%（9648/14619，+458 行/+3.1pt）**；tao 56.3→75.2（+246，与目标休眠行 248 吻合）、tauri 58.3→61.2（+159，含 runtime-wry 二进制首次入口径）、oha 63.0→64.2（+53）；**踩坑：tauri_runtime_wry-<hash> 下划线二进制名不被 `tauri-*` 匹配，BINPAT 已改 `tauri*`**；测试全绿（tao 69/oha 65/tauri 53/runtime-wry 4）；数据 s6-cov/s6-exec.json

## S7 适配层映射 UT + NAPI 死代码审计删除（2026-08-24，追加阶段）

- [x] 7.1 NAPI 死代码审计（任务 #28）——定论：**3 DEAD**（send_tao_window_event、ohos_plugin_register：tauri app.rs；oha mouse_event.rs legacy NDK 回调全套 ~230 行：extern FFI 声明/thread-local dispatcher/register_mouse_callbacks/dispatch_*，主树已走 ohos-arkui-binding 路径零调用方）/**12 LIVE-BUT-UNTESTED 保留**（bridge dispatch/run、node new、on_main_thread_event ×3 因 ArkTS ABI 必留、on_tray_icon_event、drag callbacks、patch_items）/**0 HALF-WIRED**；InputEvent::AxisEvent 变体 + tao axis 测试保留作未来接线回归保护（ArkTS MainPage 尚未 dispatch Input 事件到 Rust）
- [x] 7.2 死代码删除 + 编译/真机验证——3 处删除落地；oha workspace OHOS check 0 error、tauri host+OHOS check 干净（仅预存警告）、真机 mouse_event 过滤 8/8 绿
- [x] 7.3 纯变换 UT 22 用例（5 文件，设备侧全绿）——runtime-wry mapping_tests 10（CursorIcon 34 变体/Theme/ProgressBar/DeviceEventFilter/DPI/Rect/合成事件包装映射，+53 行）、wry https_intercept 5（passthrough×3/内联响应/responder-drop 快速返回，+45 行）、oha callbacks decision 5（options 派生 + https/download/new_window decision 全分支，+30 行）、tauri image decode_base64 6（全字符类，+1 行）、tauri app.rs 事件映射 1（8 From 臂，+8 行）
- [x] 7.4 cov-run 插桩重跑（tauri 60✅/runtime-wry 14✅/oha 全绿/wry 39✅/muda 88✅/tray-icon 66✅/window-vibrancy 17✅）+ exec-analysis 复算——**S7 = 65.6%（9792/14924）**
- [x] 7.5 口径再校准（S7 过程中发现的测量缺陷）——(a) S6 时 tauri UT 二进制早于 08-22 14:33 emit/Channel commit，app.rs 行表缺 426 行 → S6 分母少算；(b) oha target-cov deps 残留 08-22 旧 hash 二进制被 BINPAT glob 同时命中，llvm-cov 按旧行表输出 count=0 DA → S6/S7 首跑分母虚增 ~119 行。**S6 真实基线 = 64.6%（9648/14926），S7 = 65.6% = 真实 +1.0pt**。防再犯：cov-run 后清理 target-cov deps 中早于最近源码变更的旧 hash 测试二进制（误删未变仓的有效二进制须重跑恢复）；死代码删除的分母收益需 commit + app 侧重编后完全体现（app lcov 行号并集语义）

## S8 全量重测 + S9 driver/fmt 两批（2026-08-24，追加阶段）

- [x] 8.1 S8 全量重测（三源同状态）——UT 7 仓 + desktop/mobile 双形态插桩 hap 重建：**S8 = 67.8%（9753/14377）定稿**；S7 混编号伪影消除（app.rs 分母 1294→840）；死代码删除分母收益兑现（oha -93）
- [x] 9.1 driver 批：window-ops-extra.ts 6 用例（逐调用吞错模式，VITE_AUTOTEST 门控挂载）——monitors 五连/setProgressBar 5 状态/setTheme×3/setVisibleOnAllWorkspaces/setTitleBarStyle/setFocus+setFocusable（主+Float 窗）/setCursorIcon/setCursorPosition/startDragging+startResizeDragging/setEffects+clearEffects；Float 窗 label 必须 test- 前缀（capability windows 匹配）
- [x] 9.2 fmt 批：runtime-wry WindowBuilderWrapper Debug 测试（with_config_tests 内，+7 行，宿主+设备双验证）、tao OsError Display（fmt_tests 新模块文件尾追加，+3 行，设备 70/70 绿）
- [x] 9.3 **ACL 漏登记修复（真实配置缺陷）**——run-app.json 补 8 项 core:window 权限（current-monitor/primary-monitor/available-monitors/monitor-from-point/cursor-position/set-visible-on-all-workspaces/set-title-bar-style/start-resize-dragging）；第一轮全部被 ACL 静默拒（.catch(()=>null) 伪装成返回 null），补登后 currentMonitor 返回真数据（OpenHarmony Device 3120x2080@1.9x）
- [x] 9.4 测量：cov-run tauri（60+15 绿）/tao（70 绿）→ desktop hap 重建×2 轮 → s9-recover（profraw 以套件末 dump_coverage 重写文件为准，90s 窗口截早的快照不含末尾用例）→ 三源合并 → **S9 = 69.2%（9948/14377，+195 行/+1.4pt）**
- [x] 9.5 两疑点定论——疑点1 currentMonitor 静默 null：属实，根因 ACL 漏登记（已修验证）；疑点2 decoration smoke 连坐饿死：推翻（S8 派发入口本就覆盖，黑的是主窗 id≤0 设计内早退 + fallback；Float 窗点亮真实 OHOS bridge 路径）
- [x] 9.6 定论不可点亮项——setBadgeLabel（macos-gated 注册）/setOverlayIcon（windows-gated 注册）：OHOS 命令未注册 ~45 行永黑（上游设计不改）；setIcon 到达 Rust 但败于 icon 解码（需合法 PNG，后续可补）
- [x] 9.7 probe 补漏批（冲 70% 第三轮）——src-tauri/src/probe_apis.rs 4 个 demo 探针命令（双登记 build.rs AppManifest + run-app.json；menu 两个 #[cfg(desktop)] 门控防 mobile 构建炸）点亮 JS API 面未暴露的 Rust-only 方法：probe_app_monitors（AppHandle monitor 四连，app.rs 860-1035 点亮 60/72）、probe_app_menu_set_remove（set_menu prev=false→remove_menu prev=true 完整往返）、probe_window_menu_set_remove（window/mod.rs 菜单区 34/35，含 OHOS menubar 分支）、probe_webview_reparent（reparent 错误分支即覆盖目标，OHOS 预期报错）；另补 setIcon 合法 1x1 PNG 用例（此前坏数据均败于 "failed to process image"，合法 PNG 走通派发函数）
- [x] 9.8 S9 终测：desktop hap 重建（595 用例全绿）→ s9-recover → 三源合并 → exec-analysis——**S9 = 70.1%（10081/14377，+328 行/+2.3pt），跨过 70% 目标线**（需 10064）；分仓 tauri 66.6/tao 79.0/wry 68.3/muda 95.4/tray-icon 80.8/window-vibrancy 81.2/oha 68.6/pw 63.8
