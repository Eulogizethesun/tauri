# Tasks: ohos-committer-issues-jia-p1

> 锚点路径以工作区根 `D:\xuqiu\tauri-3.0` 为参照;`tao::` `wry::` `ability::`(openharmony-ability)`tauri::` 四仓,分支统一 ohdev,**全部不 push、不回 GitHub**(澄清决策 2)。
> D5 的 file:line 为 2026-10-20 HEAD 设计锚:实现期重 derive,±5 内漂移直接落,超界(结构变化)须回报不得硬插(约束 11)。
> 零行为变更纪律:本 change 所有代码改动仅注释/doc 行,唯一例外 tao #171 一行 `log::warn!`;每 commit 前跑对应仓 cargo check,commit 用显式文件点名(禁 `git add -A`,约束 5 churn 过滤)。

## 1. 38 条全量对账扫表(填 reconciliation-ledger.md)

- [x] 1.1 复核设计期预置行 —— anchor: tauri::openspec/changes/ohos-committer-issues-jia-p1/reconciliation-ledger.md
  - 四簇行(#168/#179/#180/#185/#198)与已取证行(#169/#170/#171/#172/#175/#176/#177/#182/#183/#187/#193/#196/#197/#173/#184/#228)直接采用(design D3/D4/D5 证据),逐条点验 file:line 仍命中即可
- [x] 1.2 「待任务核验(预判未动)」行落证(约 22 条:#174/#178/#181/#186/#188/#189/#190/#191/#192/#194/#195/#199/#219/#221/#225/#231/#233 等)—— 按 design D1 四步(git show 归因 → file:line 重开 → SDK d.ts 落证(B 类)→ 反证 grep)逐条转正;每行证据列必须非空(未动=反证 grep 命令+零命中摘录)
  - 特别锚:#186 的 SDK d.ts 三方法版本(@9/@8/@9)、#197 的 ScriptItem 声明、#183 的 SDK 模式列表/色深 API 缺失落证(任务 1.3 一并)
  - 多部件条目(#188/#190/#193/#225/#168/#180)按子项粒度展开,禁止整条「已修」(D1 护栏)
- [x] 1.3 SDK d.ts 落证批量(本地 SDK `D:/Sdk/20/ets/` 类型声明)—— B 类判定的「平台无 API」断言全部闭合到声明级;SDK 副本行号漂移只证字段事实不变形(cursor-passthrough 先例)
- [x] 1.4 ledger 尾部四节终版 —— 统计(已修/残差/未动最终计数,与总表逐行一致)、p2/p3 scope 影响清单(相对 roadmap Phase 2/3 的增删改,含 D3 五条既定变化 + 任务期新发现)、基线重锚记录(任务 6.x 回填)、回复素材索引(「已修」条目补齐 commit 哈希)
- [x] 1.5 对账抽检自审 —— 随机抽 6 条(每仓≥1,必含 1「未动」+1 多部件)按 D1 方法独立重开复核,零翻车;翻车即修 ledger 并扩抽

## 2. tao 文档批(单 commit)

- [x] 2.1 #169 latch 注释 —— anchor: tao::src/platform_impl/ohos/window.rs:69(FIRST_WINDOW_CREATED 声明) *(D5 文案要点:process-lifetime 标记、Drop 不复位系有意(:2002-2014 仅注销 mirror)、后续窗口缺省 Float 显式 UIAbility 合法)*
- [x] 2.2 #170 facade 两处失实注释重写 —— anchor: tao::src/window.rs:757-761(set_outer_position)、:789-793(set_inner_size) *(文案要点 D5 #170 行:派发无条件执行/resize 受 WM 钳制有 decor 补偿/move 效果 JS 不可靠读回/1300002 仅异常态瞬时;引用 tauri::doc/ohos-window-test-mapping.md)*
- [x] 2.3 #171 warn 一行 + facade OHOS 行 —— anchor: tao::src/platform_impl/ohos/window.rs:1537(空体加 `log::warn!`,对齐 iOS 先例,前缀沿用 `[tao-ohos] `)+ tao::src/window.rs:1132-1136(Platform-specific 补 OHOS;builder doc :511-517 可选同步)
- [x] 2.4 #172 文档 ×2 —— anchor: tao::src/window.rs:1295-1297(set_cursor_position 补 OHOS 恒 NotSupported)、:1310-1312(set_cursor_grab 补 OHOS API22+/confined-follow/失焦自动解锁需 re-grab)
- [x] 2.5 #175 facade OHOS 行 —— anchor: tao::src/window.rs:1186-1189(Unsupported 静默 no-op,与上游 iOS/Android 一致;OHOS 无 impl,facade body 已 cfg 编译出,文档须言明)
- [x] 2.6 #176 facade OHOS 行 —— anchor: tao::src/window.rs:1255-1258(Unsupported no-op,无多工作区概念)
- [x] 2.7 #177 文档 ×2 —— anchor: tao::src/window.rs:1139-1148(set_always_on_top 补 intent+setWindowTopmost API14+/WINDOW_TOPMOST/freeform only/Float 报错非致命)、:909-913(is_always_on_top 补「读 intent 非系统真值」)
- [x] 2.8 #182 facade OHOS 行 —— anchor: tao::src/window.rs:1085-1097(变体折叠沉浸式布尔;fullscreen() 恒 Borderless(None);不做 intent 回读)
- [x] 2.9 #183 video_modes 披露 —— anchor: tao::src/platform_impl/ohos/monitor.rs:116-120(注释扩行:单一当前模式/SDK 无模式列表与色深 API/多屏真值已 #106);公开 facade doc 位重 derive,无 Platform-specific 段则以 impl 注释为披露位
- [x] 2.10 cargo check(tao)+ commit —— `cargo check` 与 `cargo check --lib --target aarch64-unknown-linux-ohos` 零 error;显式点名 3 文件(window.rs / platform_impl/ohos/window.rs / platform_impl/ohos/monitor.rs)提交 `docs(ohos): committer issues #169-#183 wave-0 disclosure batch`

## 3. ability 文档批(单 commit;#170 半)

- [x] 3.1 #170 注释更正两副本同步 —— anchor: ability::native_ability/src/main/ets/window/WindowManager.ets:305-306 + ability::package/src/main/ets/window/WindowManager.ets:305-306 *(失实句「win.resize()/moveWindowTo() return 1300002」按 D5 事实基更正;:614/:743/:1974 的错误码枚举注释不动;两副本 diff 对称——约束 4)*
- [x] 3.2 commit —— 显式点名 2 文件,`docs(ohos): correct stale 1300002 comment in isUIAbilityMainWindow (committer #170)`;**不触发 HAR 重打/设备部署**(design D7 裁定:纯注释零行为,ledger 备注留痕)

## 4. wry 文档批(单 commit)

- [x] 4.1 #187 文档 ×2 —— anchor: wry::src/lib.rs:1978-1990(with_https_scheme 补 OHOS 同步-only 契约/异步丢弃+passthrough/原生 scheme 指引)、:1111-1139(with_asynchronous_custom_protocol 补 OHOS 行;现示例 thread::spawn 异步 respond 须加 OHOS 警示语)
- [x] 4.2 #193 披露+纠偏 —— anchor: wry::src/lib.rs:1184-1197(with_drag_drop_handler 补 Platform-specific OHOS 段,三点:bool 忽略/file:// 默认导航已被 onLoadIntercept 恒拦截兜底/Enter 无 paths 仅 Drop 携带);可选 :2299-2321(DragDropEvent 变体同步);**纠偏限于仓内文档,不回 GitHub**(roadmap 明文)
- [x] 4.3 #197 披露 —— anchor: wry::src/lib.rs:1023-1026(补 OHOS 行:全 scriptRules 匹配框架注入/for_main_frame_only 忽略/file:// 覆盖未验证留真机)
- [x] 4.4 可选增值行(同 commit,不计验收)—— #196 Create 变体 doc :481-505 一句 OHOS;#185 set_bounds doc :2268-2274 一句 OHOS
- [x] 4.5 cargo check(wry)+ commit —— host + ohos 双路零 error;点名 src/lib.rs 提交 `docs(ohos): committer issues #187/#193/#197 wave-0 disclosure batch`

## 5. tauri 文档批(commit ①)

- [x] 5.1 #228 两处 doc —— anchor: tauri::crates/tauri/src/window/mod.rs:2220-2223 + tauri::crates/tauri/src/webview/webview_window.rs:2100-2103 *(各补 OHOS 行:Blur/Acrylic only;Mica/Tabbed info 跳过;macOS 效果 blur 近似;需 transparent;实现面 vibrancy/ohos.rs:38-56 为事实基)*
- [x] 5.2 #170 关联矛盾行消解 —— anchor: tauri::doc/ohos-window-test-mapping.md:23-24(「窗口位置设置/窗口大小调整」两行按 :72-73 实测事实更正:主窗 move/resize 派发执行、效果受 WM 管理、非 1300002 静默 no-op)
- [x] 5.3 cargo check + commit ① —— `cargo check -p tauri -p tauri-runtime-wry` 零 error;点名 3 文件提交 `docs(ohos): committer #228 set_effects OHOS scope + window-test-mapping correction (#170)`;schema.json churn 不入(commit 前按约束 5 过滤)

## 6. 重锚回归基线(全部代码 commit 之后执行,HEAD 进 provenance)

- [x] 6.1 设备预检 —— MateBook Pro(HAD-W32)在位(`hdc list targets` 复核 SN,1015 报告参考 `3QC0124C11000038`);残留窗排查(列窗确认无套件残留透明窗;**禁 `hilog -r`**,约束 10)
- [x] 6.2 全量桌面套件 —— `.claude/skills/ohos-build/scripts/run-tests.sh <SN> desktop`;判跑完 = report footer `*Report generated at end of test run.*`(约束 6);产物 `tauri::examples/api/device-report-<MMDD>-desktop.md`
- [x] 6.3 基线判定与归因 —— 统计 N 例(M✅/K⏭/J❌);❌ 预期 0,出现即先归因(残留窗→重启套件进程复跑;真回归→停,升级 PM),**不带 ❌ 记基线**(design D6)
- [x] 6.4 基线记录回填 —— ledger「基线重锚记录」节(执行日期/SN/HEAD/report 路径/计数)

## 7. 收尾:主 spec 规范化 + roadmap 回写 + commit ② + 终检

- [x] 7.1 主 spec 结构规范化(validate 期发现的既有破损,非本 delta 引入)—— anchor: tauri::openspec/specs/ohos-platform-limitations/spec.md *(机械重排:line 6 误用的 `## ADDED Requirements` 头改 `## Requirements`,尾部「平台限制汇总/增补」两节的游离 Requirement 收拢进同一 Requirements 节(`## ` 二级头降级,内容零删改);不做则 openspec archive 将拒收本 delta。结构变更内容零变更,PM 校验时 diff 应仅见标题层级)*
- [x] 7.2 roadmap 硬门槛回写 —— anchor: tauri::openspec/changes/ohos-committer-issues-jia-master/roadmap.md *(p2 SC3「313 例…(307✅/6⏭)」、p3 SC2「313 例回归零新增 ❌」、Phase 表验证方式列 313 口径 → 统一替换为 6.3 新数字+报告文件引用;scope 变化部分(p3 剔除 #179、#198 收窄、p1 条目 16→14)以 1.4 scope 影响清单为输入提示 PM 确认——数字回写属机械同步直接做,scope 措辞变更经 PM)*
- [x] 7.3 零行为变更 diff 审计 —— 四仓 commit 逐个 `git show`:Rust 仅注释/doc 行 + tao 恰一行 warn!(2.3);ArkTS 仅注释行且两副本 diff 对称;Cargo.toml 零 diff;无签名/逻辑/use 变化;tauri commit ② 限 openspec/ 与 roadmap 文件
- [x] 7.4 spec 契约走查 —— specs/ohos-platform-limitations delta 的每个 Scenario 对应 D5 落点 grep 验证(OHOS 披露行存在且语义命中);结果记 ledger 备注
- [x] 7.5 tauri commit ② —— openspec/changes/ohos-committer-issues-jia-p1/(proposal/design/tasks/specs/ledger/.openspec.yaml)+ 主 spec 规范化 + roadmap 回写,`chore(openspec): p1 reconciliation ledger + wave-0 disclosure batch + baseline re-anchor (ohos-committer-issues-jia-p1)`
- [x] 7.6 全仓终检 —— 四仓 `git status` 干净(仅允许既有未跟踪构建产物与 schema.json churn);commit 清单与 D7 计划一致;**不 push**;PM 知会包(基线数字 + scope 影响清单 + 本 change 路径)就绪
- [x] 7.7 openspec validate --strict —— 四产物 + specs delta 通过(PM 校验前自检)
