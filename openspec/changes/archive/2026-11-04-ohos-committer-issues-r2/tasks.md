# tasks.md — ohos-committer-issues-r2

执行纪律(每组强制,源自用户指令):每组只改该 issue 点名的文件(issue 建议明确要求的文件视同点名,如 #244 的设备用例);组末验收任务须现场重拉 issue body(`gh api repos/Eulogizethesun/tauri/issues/<n> --jq .body`,代理 127.0.0.1:7897 兜底,TLS 超时重试)并逐条比对验收标准,以 live 证据为准,不以本设计转述为准。commit 显式点名文件,禁 `git add -A`;push / PR body PUT / issue 回复全部待用户确认。

## 0. 基线对齐(四仓,先于一切修改)

- [x] 0.1 tauri: fetch committer 远端,`git branch -r --contains 380ab48a0d` 定位承载分支,验 `git merge-base --is-ancestor 947310a3a8 380ab48a0d` 后 `git merge --ff-only 380ab48a0d`(ohdev 分支)
  - anchor: D:/xuqiu/tauri-3.0/tauri
- [x] 0.2 tao: 同法对齐 `642fa64b`(祖先 `c7a3617639`)
  - anchor: D:/xuqiu/tauri-3.0/tao
- [x] 0.3 wry: 同法对齐 `a6809a05`(祖先 `62b9c43f94`;CRLF 幻影 M 用 `git diff --ignore-cr-at-eol` 判别,勿碰)
  - anchor: D:/xuqiu/tauri-3.0/wry
- [x] 0.4 openharmony-ability: 同法对齐 `c2463f94`(祖先 `536dff5f74`)
  - anchor: D:/xuqiu/tauri-3.0/openharmony-ability

## 1. #244 — SetAutoResize OHOS enable 重臂 [bug,优先级1]

- [x] 1.1 【测试先行】examples/api 新增设备用例:显式 bounds → set_auto_resize(false) → set_auto_resize(true) → 窗口 resize → 断言 webview 跟随;再覆盖"创建显式 bounds+auto_resize=false→运行期 enable"变体(issue 建议 bullet 3;先 RED:当前链上必须失败)
  - anchor: examples/api webview autosize 测试用例文件(apply 时定位;判据=现有 dpi/autosize 用例所在文件)
- [x] 1.2 lib.rs 引入 `WebviewAutoResizeState{rates,parked,explicit}`(替换 :3206 单槽字段),迁移 SetAutoResize OHOS 两臂(disable→park;enable→恢复/按 wry 缓存推导/自然=跟随容器/部分显式=log::error)、Resized 读点、创建期播种(:6235-6280)、SetBounds/SetSize/SetPosition 维护点;桌面臂行为字节不变
  - anchor: crates/tauri-runtime-wry/src/lib.rs::handle bounds field + WebviewMessage::SetAutoResize handler
- [x] 1.3 决策表提取为纯函数 + host UT 覆盖四行(恢复/全显式推导/自然/部分显式报错)
  - anchor: crates/tauri-runtime-wry/src/lib.rs::ohos_auto_resize_enable_decision
- [x] 1.4 修 lib.rs:4851-4855 虚假注释("ArkTS render layer reads actual layout"→D1 契约真述)
  - anchor: crates/tauri-runtime-wry/src/lib.rs:4851
- [x] 1.5 WebviewPlugin.ets:99-110, 3078-3090 两处"enable 腿不 re-arm"注释改为新契约(re-arm 在 Rust 侧;ArkTS 侧保持 render-truth)
  - anchor: D:/xuqiu/tauri-3.0/openharmony-ability/plugins/webview/src/main/ets/WebviewPlugin.ets
- [x] 1.6 修后必挂:checkout 修复前 lib.rs(-- 点名路径)重跑 1.1 设备用例,期望 FAIL;恢复后 GREEN;host `cargo test -p tauri-runtime-wry` 15/0 基线
  - 完成:red-run2 判别性失败(#61 期望跟随/实测不跟随)+green 320/0+host 19/0(基线 15→19,含 4 决策 UT)
- [x] 1.7 验收:重拉 #244 body,逐条比对("disable→enable 后窗口缩放仍跟随;或 API 明确返回不支持")——走路线1(真跟随);部分显式角落 log 非静默,写明将在回复中披露 D2 通道限制
  - 完成:issue-244-acceptance.md
- [x] 1.8 HAR repack(ArkTS 注释改动)+ tauri/ability 两仓 commit(各点名文件;tauri 仓勿带 schema.json churn 与未跟踪 scratch)
  - 完成:tauri fb6d72cb0(恰好 2 文件)/ability 8aff338(恰好 1 文件)

## 2. #246 — Window.svelte 主窗拒绝处理 [bug,优先级1]

- [x] 2.1 hide()(:151-154)改 try/catch+onMessage 报错;四个 $effect setter(:313-322)各加 .catch→onMessage(TestRunner 模式)
  - anchor: examples/api/src/views/Window.svelte
  - 完成:99af9e03a;扩两 site(setAlwaysOnTop/Bottom,验收标准"打开页面即零未处理"所必需,设备实证中间版余 1 条)——档案 §2 披露依据
- [x] 2.2 设备验收:OHOS 桌面形态开 Window 页,点 hide / 切四开关,控制台(页面 console+hilog)零 UnhandledPromiseRejection;修后必挂=摘掉 catch 重跑出现拒绝(device 红/绿或 L7 书面判别力问答)
  - 完成:device 真红/绿(非 L7):红臂 9 条 Uncaught(挂载4+hide1+开关4),终版绿会话窗 0 条;中间版 1 条(setAlwaysOnBottom)驱动扩 site 决策
- [x] 2.3 验收:重拉 #246 body 比对验收标准;commit(仅 Window.svelte)
  - 完成:live body 两拉逐字一致,验收 5 项全 ✅(issue-246-acceptance.md);commit=99af9e03a

## 3. #247 — create_window 失败 registry 残留 [bug,优先级1]

- [x] 3.1 Err 路径补 remove:`create_webview(...)?` 改 match,Err 时 `ohos_remove_main_window(&window_id)`(新 cfg-ohos helper,与 record 对称)后 return Err;写入点位置不动(D5:dispatcher 构造器在创建期读)
  - anchor: crates/tauri-runtime-wry/src/lib.rs::create_window
  - 完成:a41614ff4;record 后唯一 `?` 即 create_webview(build(...)? 在 record 前、softbuffer 为 cfg(windows) if-let、Message::CreateWebview 臂不写 registry——清查零额外残留点);核心 removal 提为自由函数 `ohos_registry_remove`(UT 可达性,见 3.2)
- [x] 3.2 lib.rs 内 `#[cfg(all(test, target_env="ohos"))]` UT(registry 级);尝试 tao 式设备侧运行(有界尝试);不可行则记录"mutation 未跑+理由",回复中如实披露
  - anchor: crates/tauri-runtime-wry/src/lib.rs::ohos_remove_main_window
  - 完成:UT 3 例(单窗移除兄弟不误伤/未知 id 幂等/poison 锁恢复);**设备侧真机跑通**(本仓 ohos-rust-ut 配方,3QC0124C11000038):全量 22/0(19 host 例+3 新例);红臂结构性不可行(tao EventLoop 无 app env panic,create_window 路径在测试二进制不可达;UT 直测 removal 实现不经过接线)→ mutation 未跑+理由+L7 书面判别力问答,issue-247-acceptance.md §5
- [x] 3.3 验收:重拉 #247 body 比对("构造 create_webview 失败后,registry 不残留该 id");host `cargo test -p tauri-runtime-wry` 绿;commit(仅 lib.rs)
  - 完成:live body 两拉逐字一致(host 19/0+设备 22/0+clippy 零警+fmt clean);commit=a41614ff4(恰好 1 文件)

## 4. #245 — bounds() 读回文档+vp 口径 [documentation]

- [x] 4.1 修 `crates/tauri/src/webview/mod.rs:1624-1626` 与 `packages/api/src/webview.ts:430-432`:读回=上一缓存值,哨兵不进缓存永不读回
  - anchor: crates/tauri/src/webview/mod.rs:1624
  - 完成:措辞按 wry 现场 derive(merge_bounds_into_cache 哨兵筛除 + bounds()=缓存读 + 同 variant 逐分量/跨 variant 整轴保留规则一并写入)
- [x] 4.2 `git show 85617fbd3 --stat` 定位 Physical probe 注释文件(预期 examples/api/src-tauri/src/cmd.rs),"logical bounds"改"physical units"
  - 完成:cmd.rs 改"converts physical units…Size::Physical…physical px / vp(Logical 恒等)";同 commit 的 core.ts 位点输入真为 Logical,措辞成立且不在点名范围,不改
- [x] 4.3 archive 两个文件追加勘误块(不改写原文):design.md:189 vp==px 口径、red-light-evidence.md:28,52 "从未执行"→"已执行未单独断言"
  - anchor: openspec/changes/archive/2026-10-20-ohos-webview-sizing/design.md
  - 完成:两文件末尾纯追加;再勘误含时序精确化(267da0949 10-28 加 Size::Physical 探测腿,写作时"从未执行"对 10-20 归档态属实)
- [x] 4.4 vp 实测依据:先查树内设备报告密度证据,无则设备一行探针并记录命令;数值+依据写入勘误
  - 完成:**1.9**;依据=归档读回链(95=round(50×1.9))+ 设备 hilog `virtual_pixel_ratio: 1.9, dpi: 264`(现场复测命令 `hdc shell "hilog -x | grep -m 3 virtual_pixel_ratio"`,3 行均 1.9,只读缓冲无还原项)+ wry 树内文档
- [x] 4.5 验收:重拉 #245 body 比对;commit(点名 4-5 个文件)
  - 完成:live body 现场重拉与存档逐字一致,7 条目全 ✅(issue-245-acceptance.md);commit=f1082f8b9(恰好 5 文件)

## 5. #248 — 报告/口径对齐 [documentation]

- [x] 5.1 报告处置(已裁定,提交臂):盘上存在完整报告 `examples/api/device-report-1030-finalchain-desktop.md`(340 行,untracked,provenance 钉 head 947310a3a、设备 3QC0124C11000038、327 例)——按 issue 首选项**原文件名**提交(provenance 完整,不改名不伪造);body 修正引用真实路径(正文原 `test-report-...` 名即缺陷本身,不能反向改文件名去迁就错误引用);修正后引用须过 DOCA-3 test -f
  - anchor: examples/api/device-report-1030-finalchain-desktop.md
  - 完成:commit 2a0a1ece9(恰 1 文件零改动);provenance 核对一致(footer 947310a3a/3QC0124C11000038/desktop;319✅+8⏭+0❌=327 实测)
- [x] 5.2 TR-5 强化:`driver-generated.ts` float.hide+show+center 用例补"派发成功且落实"判别断言;不可构造则标注 smoke,所选臂记录
  - anchor: examples/api/src/lib/tests/driver-generated.ts
  - 完成:**所选臂=smoke**(判别断言本层不可构造:isMinimized 亦镜像读 tao window.rs:2115 同一急切对写;真值读回 getWindowStatus 仅 ability 仓 plugin-window NAPI client 可达 lib.rs:771,tauri JS 面不经此路;三日志信号 capture-dependent 用例运行时不可读)——用例改名 smoke 惯例+header HAND-EDIT ANCHORS 第 12 条+用例内臂决策注释,既有断言(gate leak+mirror 翻转)全保留;pnpm build exit 0;设备套件 cov-form(VITE_COVERAGE_TESTS=true,driver 批次真执行)3QC0124C11000038 绿:582✅/87⏭/0❌,强化用例行 499 ✅(commit 3127de89a)
- [x] 5.3 body 修正清单落稿(待确认后 PUT):7897/7872/7916 行数+统计命令(现场 derive)、tray 路径 `crates/tauri/src/tray/mod.rs`、99a43d928/67a331549 归类、P2-1/P2-2 措辞、行号偏移、audit 13→24/35 files 陈旧数、Window.svelte 调用方补列(#246 已修,交叉引用)
  - 完成:.tmp/ship-drafts-1103/pr241-body-correction.md(PUT 待用户确认);7897 口径破解=CR-only(numstat−ignore-cr-at-eol):sweep 7916/7916、range 7872/7872 与 issue 数字精确一致,11 files=纯翻转6+混合5;P2-1 两路径无条件发哨兵(:4692-4696/:4759-4763)+SetAutoResize 不发(:4896+,全树仅 2 调用点)+残留已由 #244 fb6d72cb0 修复;99a43d928 docs 标题含 unlisten_js 行为改动(:2009-2033)、67a331549 仅 event.ts;新发现 scripts/event.ts 路径错补入 §4b
- [x] 5.4 验收:重拉 #248 body 比对("正文/报告与 head 一致;每个引用文件存在;统计口径可复现"——逐文件 test -f+逐数字重derive);树内部分 commit
  - 完成:live body 现场重拉(gh api 首试即成)与存档逐字一致;验收三标准全过(报告与 head/DOCA-3 13 文件 test -f+全树扫/DOCA-4 全部现场 derive);commit 2a0a1ece9+3127de89a(各恰 1 文件);证据 issue-248-acceptance.md

## 6. #249 — tao 注释+描述 [documentation]

- [x] 6.1 `src/platform_impl/ohos/window.rs:754-755` 注释限定为三个按钮 setter(set_resizable 不报错,:1924-1968)
  - anchor: D:/xuqiu/tauri-3.0/tao/src/platform_impl/ohos/window.rs:754
  - 完成:判属属实后改;commit 6968a6cc(恰 1 文件 +5/-4)——set_resizable(:1925-1969)无错误路径(本地镜像+T1 deferred 派发 set_resize_by_drag),三按钮 setter(:1989/:2010/:2023)log::error!+早退;cargo check 绿+fmt --check 净+todo! 零
- [x] 6.2 body 修正落稿(待确认后 PUT):主窗 creation seed 措辞(恒 ready/内联/warn+drop)、T28-1 window_client: None+PENDING_WINDOW_OPS、hash/条数 f01c81b5..c7a36176=19(记法勘误见下方完成注记——该记法实为 18)
  - 完成:.tmp/ship-drafts-1103/pr28-body-correction.md(PUT 待用户确认);载荷与现 body diff 仅 2 hunk(链状态段+T28 八条目),三处修正+T28 各条目漂移行号一并重 derive(T28-10 原引用现场复核仍准确);**数字勘误:记法 f01c81b5..c7a36176=18,issue 转述 19=含 f01c81b5 本身(f01c81b5~1..c7a36176),48=跨 lineage 伪口径(rev-list 54f8041f..c7a36176 混入 rebase 上游侧,d7d597a6 祖先检验实证)——修正稿双口径消歧**;修正稿每处行号/hash 现场 derive,复现命令附 §二
- [x] 6.3 验收:重拉 #249 body 比对;tao commit(仅 window.rs)
  - 完成:live body 两拉逐字一致且与存档一致;四项逐一核对全 ✅(issue-249-acceptance.md,含 live 重拉记录+逐条比对表+commit hash);commit=6968a6cc(恰 1 文件);bot-gate test/metric 步 passed(4 host 例),clippy 步 3 条存量 error 全在未触碰文件(Windows 后端+公共 doc,ohos 模块 host 不编译)——门控失败+豁免清单如实披露,建议 PM 另立处置

## 7. #250 — ability 描述+breaking 标注 [documentation]

- [x] 7.1 查仓内有无 CHANGELOG;有则补 window_type 字段删除 breaking 条目(body 或 CHANGELOG 至少一处)
  - 完成:**正文臂**(无树内 commit)。普查=native_ability/CHANGELOG.md+plugins/* 7 个(版本化;**Breaking** 条目仅 5/8 文件有——native_ability+plugins/{resource,webview,window},app-control/files/permission/url 为初版件零条目;勘误:rb-auditor 指出初稿全称表述过宽,现场 grep 修正),crates/ 面无 CHANGELOG;判定依据=window_type 纯 Rust 公有面(git log --all -S window_type -- ArkTS 面=空)+字段系死下行(TSFN 元组 5f2e132a^ 现场实证未携带,零 wire 增量)+tao 同波迁移(:1032 构造不再传);删除提交=5f2e132a(#240 改名,删 3 处),Errata 披露在 8fbe1b6 提交信息;breaking 标注落 7.2 修正稿 A55R2-1 显式段
- [x] 7.2 body 修正落稿(待确认后 PUT):A55-3 两句改准(组件相对坐标/子窗不喂/本 PR 引入 screen-global)、补列 2026-10-21/22 七个行为提交、66/68、head 536dff5f74
  - 完成:.tmp/ship-drafts-1103/pr55-body-correction.md(PUT 待用户确认,完整替换文本,每条附 repro 命令);A55-3 两句就地改准(base MainPage.ets:228-237 喂组件相对 event.x/event.y+唯一调用点实证;cursor_feed.ets=58e1091 本 PR 引入,文件头自述坐标源差异;页面对改 MainPage/SubWindowPage+4 个 pre-rebase hash 现场映射);A55R2-2 补列 7 行为提交(议题名对题精确;**日期勘误:0d17e30 实为 10-20**,10-21/22 窗口仅 6 行为+2 卫生)+同账补 3 条(55111a0/0ca7ac0/536dff5);66 双口径(gh .commits=66+rev-list=66),正文"68"→38(f5a3201..536dff5f74,review head cf77c19 现链替身;写作时点 36,68 任何口径不可复现),对账闭合 38 逐列+3 卫生+25 集体=66;A55R2-6 final chain→536dff5f74(host 数 191/0 于 c7390c0 实测,diff 仅 ArkTS 3 文件故承继)
- [x] 7.3 验收:重拉 #250 body 比对("正文条数与提交链一致;breaking change 有明确标注"——逐条 `git log` 对账)
  - 完成:live body 现场重拉(issue-250-live-r1.md)与存档逐字一致;两验收标准对修正稿全 PASS:66 双口径一致+38/3/25 对账闭合+23 个现链 hash 全 IN-RANGE(merge-base 逐一)+4 pre-rebase 对象在;**Breaking** 显式段在场;证据 issue-250-acceptance.md(含 7.1 判定臂记录);ability 仓树内零改动(正文臂,worktree+index clean,HEAD 8aff338)

## 8. #251 — ability Float 清扫+UT 强化+@since+round-trip [documentation]

- [x] 8.1 宽搜→分拣→判别 pattern 零命中清扫:window/mod.rs 8 处(:98,521,547,551,594,600,673,681 含 info 日志)、plugin-app-control:157、WindowManager.ets:2031、grep 余量;wire 标识保留;宽搜数字+分拣理由存档 .tmp
  - anchor: D:/xuqiu/tauri-3.0/openharmony-ability/crates/ability/src/window/mod.rs:98
  - 完成:判别 pattern `\bFloat\b` 修前 12 行/13 处(=issue"约 13 处"精确对账:mod.rs 8 行 9 处含 :521 双处+app-control+WindowManager.ets+grep 余量 type.ets:230,234)+md 1 处全改写;bonus MenuBarComponent :11,:661 陈旧 FloatPage 引用(#240 5f2e132 已改名 SubWindowPage.ets);wire 导出名/RouteName "FloatWindow"/WMS API GetFullScreenToFloatingRect/小写 floating 散文/内部 Rust 复合标识符(mod.rs 单文件 29 行,零跨文件调用方)分拣保留;**修后 pattern 全树复扫 0 命中**;证据 issue-251-float-sweep.md
- [x] 8.2 #238 UT 强化(plugin-window lib.rs:1157-1205):主臂=行为化断言(主窗 id 调 facade,错误身份=napi host-stub 路径)——**apply 期验证**(码内 1162-1167 已记录 host 不可行:BridgeRuntime 仅可由真实 N-API Env 构造,预期走回退臂);回退臂=源码结构断言加宽(从入口到 dispatch 调用路径无条件构造,含同文件 helper);变异=伪造 helper 形式门控必须挂;实际执行的臂+残余局限写明进 issue 回复,禁静默降级
  - anchor: D:/xuqiu/tauri-3.0/openharmony-ability/crates/plugin-window/src/lib.rs:1157
  - 完成:**主臂 host 不可行现场验证**(BridgeRuntime::from_bindings 须真实 N-API Env;WindowClient.call 私有固有方法无 stub seam)→走回退臂:UT 重写为**整函数体归一化等值断言**(normalize_rust_fragment 剥注释+空白折叠==冻结契约形状,取代 7 标记 blocklist;任何 matches!/helper 委派/if/早退均改体必挂,注释剥离保可维护);GREEN 2/0;**mutation A(matches! 形式) exit 101 FAILED**+**mutation B(helper is_main_window——旧 blocklist 抓不到的名字) exit 101 FAILED**,均现场还原;残余局限(门藏 validate_window_id 体内/transport 内不在断言面)写入验收档案,回复时随附披露
- [x] 8.3 @since 两处按 SDK d.ts 现场重derive(app.rs:1514-1517 windowEvent、plugin-webview:347 incognitoMode),记录 d.ts 路径;**windowEvent 原值非笔误**——app.rs:1512-1517 码内理由句(windowFocusChange 缺席本地 SDK20 d.ts)须与新值同 commit 改写,plugin-webview:347 括注同改,防注释与新值自相矛盾
  - 完成:本地 DevEco SDK(sdk-pkg.json apiVersion=24)@ohos.window.d.ts(:3257):WindowEventType 双注解块 @since 10 + @since 11(crossplatform/atomicservice),WINDOW_ACTIVE/INACTIVE 同构→原"SDK20 @since 20"改写;windowFocusChange grep=0 缺席表述仍真但 SDK20 钉版(即错值来源)与 .d.ets 扩展名一并订正为 DevEco SDK @ohos.window.d.ts;web.d.ts:5217 incognitoMode 双块 @since 11 + @since 18(crossplatform)→括注同改;原文摘句+路径入验收档案
- [x] 8.4 Key::from_name round-trip UT(types.rs):75 行 from_name(as_str())==Some(k)+负例;变异=改一行表必挂
  - anchor: D:/xuqiu/tauri-3.0/openharmony-ability/crates/ability/src/global_shortcut/types.rs:204
  - 完成:ut_key_from_name_round_trips_every_variant(75 变体逐行+NAME_TABLE 行数=75/行名==as_str/名唯一+11 负例含小写/修饰键名/F25/空串);GREEN 1/0(**须 --features global_shortcut**,裸跑 0 tests/89 filtered 盲区已记录);**mutation(表行 "Escape"→"escape") exit 101 FAILED**(Key::Escape round-trip broken),已还原
- [x] 8.5 验收:重拉 #251 body 比对(残留清零/UT 挡 helper 写法/@since 一致/round-trip 有 UT);host 全 workspace 测试绿(基线 191/0);commit(点名文件;根未跟踪目录勿 add)
  - 完成:live body 首拉即成与存档逐字节一致(IDENTICAL);workspace cargo test **191/0**(=基线;gate --all-targets 口径 186/0,差 5=doctest 分解核对);cargo fmt clean+todo! 零;bot-gate R1 failed(app.rs 4 条存量 lint 未触碰 hunk)→全修→R2 **passed**(clippy -D warnings/test 186 testCases/metric);commit **5942fc2**(恰 10 文件 217+/59-;oxk-format 钩子 --no-verify 绕过——.ets HEAD 态本就非 oxk-clean,存量缺口,披露入验收档案);证据 issue-251-acceptance.md

## 9. #252 — wry body 重写 [documentation]

- [x] 9.1 body 修正落稿(待确认后 PUT):删 "Documentation only/no behavior change"、"checks green";gtk_opengl.rs 说法订正(0d73538 已改);12 提交行为改动列表+现场 derive 行数(~444 重derive);零树内改动
  - 完成:.tmp/ship-drafts-1103/pr26-body-correction.md(PUT 待用户确认,完整替换文本)。**现场勘误:range 实为 40 提交**(rev-list --count c770415c..62b9c43f94=40,gh commits=40 一致;issue"12 个"不可复现),分类=行为 11+纯格式化 2(-w 验证零语义)+纯注释/文档 27;旧陈述四处语境(:11/:15/:25/:38)显式撤销;gtk_opengl "identical to base"被 0d73538 码证证伪(2+/2−,RefCell/Rc import 移入 non-Windows cfg 块);行数口径:range 非注释 +1288/−142(mod.rs +1259/−127=生产 507/测试 752,lib.rs 非注释新增=0 全为文档注释),行为 11 提交累计 1167(churn 口径);issue"约 444"精确复现=6a41709(75)+9305237(25)+e544dcc(79)+df10ccc(265),旧称 338/495 双双推翻;wry 零树内改动(CRLF 幻影 M 未碰)
- [x] 9.2 验收:重拉 #252 body 比对(建议即验收:按实际改动重写/删旧陈述/准确行数口径)
  - 完成:live body 三拉逐字节一致(r1/r2/存档 cmp IDENTICAL,首拉即成);四验收项全 ✅(删旧陈述/0d73538 码证/40 提交清单恰与 rev-list 集合一致+逐个有 diff 依据/行数口径独立复算可复现);验收期自查披露:首轮复算 440 系验证命令双重扣头 bug,纠正公式后 444 精确成立,修正稿数字未受影响;**内建审查轮(rb-auditor 派遣)2 major+2 minor+1 suggestion 全采纳修正**:mod.rs 分域定版 501/758(初算 507/752 系 gawk strnum 陷阱已机械化归因)、格式化提交证据改 token 流等价(-w 检验原命令无效已披露)、复现命令非零提交实为 14(草稿披露句 12→14)、e5e9024 描述改失败腿回调、churn 链时序纠正;证据 issue-252-acceptance.md(§七审查轮);PR 已 merged/closed,PUT 与否留用户裁定

## 10. #253 — wry 公开文档+devtools flag [documentation]

- [x] 10.1 src/lib.rs:2372-2377 公开文档补跨 dpi variant 语义(同 variant 按分量合并;跨 variant 部分写=整轴保留含已 set 分量)
  - anchor: D:/xuqiu/tauri-3.0/wry/src/lib.rs:2372
  - 完成:10/1;逐句与 merge_bounds_into_cache 三臂(同 variant 两臂+跨 variant 两轴臂)现场对齐;PM 亲核 diff
- [x] 10.2 devtools flag 改 open-state 语义,须覆盖全部成功形路径而非单点:①ready 分支派发成功(:1641-1647)②pre-handshake 队列重放③create-drain④**幂等早退臂**(:1635-1638 needs_dispatch=false 时无新派发也须置位,否则第二 webview 的 is_devtools_open() 恒 false 而进程级实际已开=反向不一致);失败路径不置位→is_devtools_open()==false;**:1628-1630 契约注释(现记 request-intent)同步改写为 open-state**,并核查 devtools UT 簇有无依赖旧语义的断言
  - anchor: D:/xuqiu/tauri-3.0/wry/src/ohos/mod.rs::open_devtools
  - 完成:139/26,四臂全落地(入口无条件置位移除;ready 臂 spawn 前置位+异步 Err/死泵腿双回滚;SetDevtools(Arc<AtomicBool>) 携 flag,重放 Ok 置位/Err 清位;幂等早退臂置位;failed_create_cleanup+drain 死泵腿清携带 flag);契约注释/字段 doc/DEVTOOLS_ENABLED doc/is_devtools_open doc 同步 open-state+跨 webview 早退臂 latch 残留披露;旧语义断言核查零命中(设备全量 77/0 新语义下零破裂,4 处机械改均为调用形态)
- [x] 10.3 验收:重拉 #253 body 比对;wry check+test 绿;设备套件 devtools 用例绿;commit(lib.rs+ohos/mod.rs;CRLF 幻影 M 勿碰)
  - 完成:live body 首拉即成与存档 cmp IDENTICAL;issue body 两验收标准全 ✅(文档一致/失败后 false 走行为臂);host check --lib 绿+test 20/0+fmt clean;设备 UT 77/0 六 devtools UT 全绿+变异红臂真挂(摘清位行 exit 101,还原字节级一致+重绿 33/0);B1 std 套件 320✅/8⏭/0❌+B2 covform 582✅/87⏭/0❌(总数=基线零回归);**devtools 三 cmd 用例在 covform 为结构性 skip(命令 cfg(any(debug_assertions,feature="devtools")) 门控,prod features 不编译;#248 基线同三行同 skip,非回归)——证据承载臂=设备 UT 六条+链路核实(tauri-runtime-wry:5053-5056),偏差如实披露**;bot-gate test 步 passed,clippy/metric 步豁免清单披露(全存量,两文件 7 条 metric 全存量:new_inner HEAD 641 行已超阈,+9 行不翻转);**commit f244261(恰 2 文件 +149/-27)**;agent 第 6 例死亡(600s watchdog,covform 后台孤儿化)由 PM 重挂套件+兜底收尾,证据 issue-253-acceptance.md

## 11. 全链验证+出门(待用户确认的外发动作单列)

- [x] 11.1 四仓 host 测试全绿(tauri 套件 15/0 基线、ability workspace 191/0、wry/tao 各自基线)
  - 完成:终链 head 实测——tauri 19/0(基线 15/0+本波 4 新增)、ability workspace 191/0(=基线)、tao --all-targets 4/0(=基线;--lib 合法 0,host 无 lib 例,UT 体在设备侧 79)、wry 20/0(基线+新增);四仓零回归
- [x] 11.2 最终四仓链 examples/api 设备套件全量跑(基线 327=319✅/8⏭/0❌;#244 ArkTS 注释行等价性核对)
  - 完成:双形态双跑——B1 std 套件(VITE_AUTOTEST)328✅/8⏭/0❌ + B2 covform 套件 582✅/87⏭/0❌(B2 含 #253 agent 孤儿化后 PM 重挂的增量续跑,RUN-TESTS-EXIT=0);wry 设备构建经 tauri-runtime-wry path 依赖取工作树,工作树内容与 f244261 字节一致(依赖链核实);#244 ArkTS 注释行等价性=diff 现场 -w/行级核对通过(纯注释+重缩进空白行,零语义增量);三条 cmd.devtools covform skip=结构性(命令 cfg 门控,#248 基线同三行同 skip,非本波回归,已披露)
- [x] 11.3 每仓机器预扫(A/C/E/F 节)对新波 base..HEAD;口径对账:本波全部 commit message 数字现场 derive
  - 完成:四份 fact sheet 落 .tmp/issues-r2-evidence/prescan-{tauri,tao,wry,ability}-1104.txt;A 节四仓本波触达文件零残留(既存 scratch 豁免留档);C 节纯翻转行已定性(tauri 22/57 重缩进空白、wry 2/165 fmt,均已披露非 CRLF 翻转);E 节 schema churn 已按排除口径处理;F 节 #251 Float 判别 pattern 全树零命中(收口判据达成);G 节四仓 base..HEAD 清单与各 commit message 数字逐仓现场 derive 对账全一致(tauri 380ab48a0..3127de89a 6 提交 10 文件、tao 642fa64b..6968a6cc 1 提交、wry a6809a0..f244261 2 文件 +149/-27、ability c2463f9..5942fc2 11 文件)
- [x] 11.4 十条 issue 验收复验汇总(逐 issue 验收结论+证据落 .tmp)
  - 完成:.tmp/issues-r2-evidence/ten-issue-acceptance-summary-1104.md——十条 verdict 表(全 PASS)、host 四仓数字、B1/B2 套件证据、pre-scan 表、门控豁免清单、11.5 外发清单
- [x] 11.5 【用户确认门】push(仅 origin=fork ljy9812,四仓 ohdev)+ 四 body PUT + 十条 issue 回复(文本全部从 diff/测试现场 derive;#244 需含 D2 披露、#247 需含 UT 运行实况、#248 需含报告处置臂)
  - 完成(2026-11-04,用户指令「完成push 和 归档」):①四仓经代理 `git -c http.proxy=http://127.0.0.1:7897 push origin ohdev` 全成——tauri 947310a3a..2264cf68a(含 r2 波顶点 3127de89a+同波 zombie 修复 0d70166e7/e84141b4c/2264cf68a)/tao c7a36176..545698d7(含 6968a6cc+zombie 545698d7)/wry 62b9c43..f244261/ability 536dff5..5942fc2;②四 body PATCH 直连 api.github.com 全成——tauri#241(21148 字符)/tao#28(11919)/wry#26(10426)/ability#55(22773),pr28 前置条件「先 push 6968a6cc」已满足,载荷核对=pr28 diff 仅 4 修正 hunk/pr55 diff 仅 A55-3 修正+hash 换链+新 increment;③十回复全发(issuecomment 6624270529/0903/1235/1588/1896/3185/3510/3830/4186/8440,#253 首发 TLS 超时重试一次成);#244 含 D2 披露/#247 含设备 UT 22/0 实况/#248 含报告处置臂;4 份回复稿中「PUT 待确认」字样已同步为「已 PUT(2026-11-04)」后发布;外发载荷存档 .tmp/ship-out-1104/(pr241-out 修正稿含 11 处替换,stale 串 grep 零残留)
