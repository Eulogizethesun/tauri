# Design: ohos-gate-debt-cleanup

## Context

三仓工作区(分支 ohdev):tauri(HEAD bb36848e6)/ tao(D:\xuqiu\tauri-3.0\tao,HEAD 6ea1e5f5)/ openharmony-ability(D:\xuqiu\tauri-3.0\openharmony-ability,HEAD 606abf3);`ohos-committer-issues-followup` 的 13 commit 已全部落在这三个 HEAD 之下。2026-10-26 14:55-15:09 rb-verifier 全量运行 blocking-9(fmt/check/clippy/test/doc-test/doc-check/supply-chain/metric;miri/sanitizer/valgrind 维持 skip)三仓全 failed,三重归因(blame + botgate 历史 + commit 触达)全部为既有/环境类。

**失败全景与一手证据锚点**(三仓 `.botgate/logs/`,`metric.json` 挂 15:08 未被 15:12 supply-chain 定向复跑覆盖):

| # | 仓 | 组件 | 失败 | 证据锚点 | 归因 |
|---|----|------|------|---------|------|
| 1 | tauri | fmt | 105 处 Diff + 多文件 Incorrect newline style(crates/tauri/src/lib.rs、manager/webview.rs、tauri-cli dev.rs、dev_eco_studio_script.rs、runtime-wry dialog/mod.rs 等) | fmt.log | 05-22/09-11 工具链漂移 |
| 2 | tauri | check+test | crates/tauri/src/tray/mod.rs:811-823 E0425/E0433 ×4 —— 测试 `tray_icon_event_from_fallback_no_panic`(:804-810 全限定 `tray_icon::` 路径可编译;:811/:813/:822/:823 未限定引用 `TrayIconEvent`/`MouseButton`/`MouseButtonState`) | test.log | 05-23 18b636409 |
| 3 | tauri | clippy | crates/tauri-utils/src/config.rs:3292 手写 `impl Default for OpenHarmonyConfig`(struct :3259,字段全 Option/Default 型)→ derivable_impls(-D complexity 拒绝) | clippy.log | 06-29 30c91a75f |
| 4 | tauri | doc-check | crates/tauri/src/lib.rs:55 `#![warn(missing_docs, rust_2018_idioms)]` 与 CLI `-F missing_docs` 冲突 E0453 | doc-check.log | 既有 |
| 5 | tauri | doc-test | tauri-utils 两 doctest 失败:config.rs `AppConfig::windows`(line 3058)、`WindowConfig::create`(line 1931),STATUS_ENTRYPOINT_NOT_FOUND(0xC0000139,Windows DLL 环境类) | doc-test-tauri-utils.log | 环境 |
| 6 | tauri | metric | 阻塞发现 22 条:too_complex 11 + fn_too_large 7 + file_too_large 4(bundler msi/nsis、cli rust.rs、codegen context.rs、runtime-wry、examples/api 等;以 gate `blocking_findings` 结构化字段实测为准,raw grep 计数受 message+rendered 双渲染污染不可信);unsafe_usage 121 条按默认策略**只报告不阻塞** | metric.json(15:08) | 上游既有文件 |
| 7 | tauri/tao/ability | supply-chain | `couldn't fetch advisory database: git operation failed`(gix 拉 https://github.com/RustSec/advisory-db.git 直连卡死) | supply-chain.log ×3 | 环境(机器侧代理 127.0.0.1:7897 可解) |
| 8 | tao | fmt | 8 处 Diff + tests/sync_object.rs newline style | fmt.log | 09-11~10-21 |
| 9 | tao | clippy | examples/handling_close.rs:60/:73 collapsible_match | clippy.log | 2021 上游 |
| 10 | tao | doc-check | src/window.rs:574 `#[allow(rustdoc::broken_intra_doc_links)]`(挂于 `with_theme`,文档引用 `EventLoopBuilderExtWindows::with_theme` 并带链接定义行)与 CLI `-F rustdoc::broken_intra_doc_links` 冲突 E0453 | doc-check.log | 08-13 |
| 11 | tao | metric | 阻塞发现 18 条:too_complex 14 + fn_too_large 2 + file_too_large 2;路径几乎全在上游平台文件(linux/macos/windows keyboard、event、keycode.rs)+ 我方 ohos/keycodes.rs;unsafe_usage 726 条不阻塞 | metric.json | 上游既有文件 |
| 12 | ability | fmt | 28 处 Diff | fmt.log | 既有 |
| 13 | ability | clippy | display.rs:109/:121/:125 手写 nul 结尾字符串;event.rs:75/:76 doc_lazy_continuation;waker.rs:58 type_complexity(`RwLock<Option<Arc<ThreadsafeFunction<(),(),(),Status,false>>>>` 需 type alias) | clippy.log | 08-25/09-11 |
| 14 | ability | test | host `cargo test --all-targets` 链接失败 **LNK1181: cannot open input file 'ohinputmethod.lib'** —— 链接行含 `kernel32.lib "ohinputmethod.lib" "native_display_manager.lib" "ace_ndk.z.lib" ...`,OHOS NDK 库名来自依赖链 `ohos-ime-binding → ohos-native-bindings git checkout 的 ohos-input-method-sys`(`#[link]`/extern 无条件生效);botgate 历史**无任何绿色记录**(首跑 10-21 即红) | test.log 链接行;C:\Users\65468\.cargo\git\checkouts\ohos-native-bindings-*\c05f75e\sys\ohos-input-method-sys\src\lib.rs | 10-22 轨道已知"host 编译结构性缺口" |
| 15 | ability | doc-test | version.rs 两个 doctest E0433:`version::sdk_api_version()`(line 66 例)与 `version::distribution_api_version()`(line 93 例)未用全路径/未导入 | doc-test-openharmony-ability.log | 06-08 fb33ff19 |
| 16 | ability | doc-check | **399 条 missing_docs**(逐 crate 实测:ability crate 266 + plugin-menu 41 + plugin-clipboard 31 + plugin-files 18 + plugin-permission 13 + plugin-screenshot 8 + plugin-resource 7 + plugin-url 6 + demo_native 5 + demo_sub_native 2 + derive 1 + continuation 1,合计恰 399;逐类型:struct field 170 / variant 70 / method 58 / struct 52 / assoc fn 12 / enum 11 及其余按实测清单;日志消息 message+rendered 双渲染,计数须按结构化字段去重) | doc-check.log | 上游/我方既有 |
| 17 | ability | metric | 阻塞发现 3 条:crates/ability/src/global_shortcut/types.rs `from_name`(复杂度 76)、crates/plugin-webview/src/lib.rs `on_main_thread_event`(复杂度 67)、crates/ability/src/lifecycle.rs `create_lifecycle_handle`(330 行);unsafe_usage 17 条不阻塞 | metric.json | 我方桥接代码 |

**关键基础设施事实**:ability `target/host-stub-libs/` 已存在 20 个 .lib 桩(**含 ohinputmethod.lib**)+ stubs.rs(`#[no_mangle] extern "C" fn OH_*(){}` 空桩)+ stub-web.rs + symbols_round1/2.txt(ohos-host-stubs.lib 为其一) —— 为 10-22 结构性缺口调查的**未提交遗产**;缺失的是①机制入库 ②host 链接路径接线。botgate 各组件命令固定(`cargo test --all-targets`、`cargo audit --json --file Cargo.lock`、doc-check 携带 `-F missing_docs`/`-F rustdoc::broken_intra_doc_links`),项目级可配置点仅 metric(bot-metric 1.2.3 文档:仓根 `bot-metric.toml` 存在则 botgate 以 `--config` 传入,`blocking_severities = []` 即不阻塞、发现条目仍完整保留报告)。

## Goals & Non-Goals

### Goals

1. 三仓 blocking-9 复跑全绿(fmt/check/clippy/test/doc-test/doc-check/supply-chain/metric;miri/sanitizer/valgrind 维持 skip 口径)——验收命令 `bot-gate run fmt check clippy test doc-test doc-check supply-chain metric --project .`(supply-chain 需带代理环境变量)。
2. 第 1-4 类失败按最小 diff 清偿;结构性项(host 链接)落地为**已提交、可复现**的机制而非机器侧手工状态。
3. metric 按用户裁定执行混合策略:tauri/tao 项目级策略文件(上游基线债豁免、理由注释)、ability 3 条实修。
4. 清扫 commit 与手写修复 commit 分离;followup change 的 ship 在全绿后放行。

### Non-Goals

- 不重构 tauri/tao 上游既有文件(bundler/cli/codegen/winit keyboard 等 92 条 metric 阻塞发现)——属上游范围,以策略文件豁免并披露。
- 不修改 wry 仓;不动 MenuBarComponent.ets(归乙 #205);不处理四条已开 PR 的既有内容,仅追加增量。
- 不改任何运行时行为;ability 13 条 metric 实修为行为保持重构,以设备 UT 套件复验。
- 不做 botgate 工具本身的修改;不设置全局(用户级)环境变量。

## Decisions

### D1 tray 测试修复 = 测试模块补 import(非 cfg 门控)

证据:`tray/mod.rs:804-810` 同测试内全限定 `tray_icon::` 路径已可编译(类型在当前特性集下可见,不存在"cfg 出局"问题);:811/:813/:822/:823 仅缺模块内 `use`。修法 = 按编译器建议在测试模块补 `use crate::tray::TrayIconEvent;` 等三条 import(~3 行)。备选(为测试单独开 tray-icon 特性)被证据否定——类型可见性无问题。

### D2 E0453 冲突一律改代码侧,不动门禁

botgate doc-check 的 `-F` forbid 非项目级可配置(工具文档无 override 入口);代码级 `warn`/`allow` 与 CLI forbid 冲突时(E0453)唯一路径是删代码侧指令。两处:
- tauri lib.rs:55 → `#![warn(rust_2018_idioms)]`(去 missing_docs 项;CLI forbid 继续强制 missing_docs,tauri 文档本就完备)
- tao window.rs:574 → 删 allow 属性 + 把该 doc 注释中 `[`EventLoopBuilderExtWindows::with_theme`]` 的三处 intra-doc 链接改为普通代码串并删除链接定义行——非 Windows 平台 doc 构建不再可能产生断链(allow 属性存在的唯一理由),host 门禁与上游多平台构建同时满足。**风险披露**:E0453 修复后 doc-check 才能跑完整个 lint,若 tauri/tao 在 `-F missing_docs` 下暴露新的 missing_docs(当前被 E0453 提前中止遮蔽),按 doc-check.log 实测清单并入第 4 组文档清偿,上限以日志为准。

### D3 ability 399 条 missing_docs = 补写文档,按 crate 分批

`-F missing_docs` 下代码级 allow 不可用(E0453 同理),botgate 无项目级 doc-check 配置 → 唯一绿掉路径 = 补写。执行:实现首步从 doc-check.log 提取逐条精确清单(路径+条目类型;按结构化字段去重,日志 message+rendered 双渲染勿重复计数),按 crate 分批(ability 266 / plugin-menu 41 / plugin-clipboard 31 / plugin-files 18 / plugin-permission 13 / plugin-screenshot 8 / plugin-resource 7 / plugin-url 6 / demo_native 5 / demo_sub_native 2 / derive 1 / continuation 1,合计 399),英文 ASCII 单行优先,语义须真实(描述字段/方法用途,禁止 `/// doc` 类空话)。预估 ~400-600 行文档注释。

### D4 ability host 链接桩:机制入库 + 仓级 host-only 接线

现状:桩文件在 `target/`(gitignore 区,不可复现)且链接行无 `/LIBPATH` 指向它。设计:
1. 新建已提交目录 `host-stubs/`(ability 仓根):迁入 stubs.rs、stub-web.rs、symbols_round1.txt、symbols_round2.txt + 生成脚本 `host-stubs/generate.ps1`(PowerShell;用 rustc 编译 stubs.rs 为 .obj、`lib.exe` 生成各 .lib 含 ohos-host-stubs.lib 与各空档 .lib,输出到 `target/host-stub-libs/`;脚本幂等可重跑)。
2. 仓级 `.cargo/config.toml`(该仓现无 `.cargo/` 目录,直接新建单表;rustflags 为替换式键,未来引入其他 host rustflags 须并入同一数组,禁止出现第二个 `[target.x86_64-pc-windows-msvc]` 表)新增**仅 host 段**:
   ```toml
   [target.x86_64-pc-windows-msvc]
   rustflags = ["-L", "native=target/host-stub-libs"]
   ```
   交叉构建(aarch64-unknown-linux-ohos)不受影响(target 段隔离);rustc 以 workspace 根为 cwd 解析相对路径,botgate 的 `cargo test --all-targets`(cwd=仓根)可达。
3. 执行序:跑 generate.ps1 → `cargo test --all-targets` host 链接 → 未解析符号(extern 声明超出桩覆盖)则扩 symbols 清单再生成(现有 symbols_round1/2 即此迭代的第 1/2 轮记录,预期需 round3)。
4. **运行期失败的处置边界**:链接通过后,host 测试执行中调用真实原生函数将命中空桩(返回零值/空)。处置 = 对确属设备专属的测试加 `#[cfg(target_env = "ohos")]` 门控(与 tao/wry 既有测试模式一致)。**升级判据**:需门控测试 >20 条,或门控会掩盖纯逻辑测试 → 停手,携证据(失败清单+根因分类)上报 PM/用户裁决(候选:gate 层 test 组件改设备侧运行/文档化豁免)。禁止静默跳过或删测试。

### D5 metric 混合策略(用户 2026-10-26 裁定)

- **tauri/tao**:仓根新增 `bot-metric.toml` 并提交(工具文档建议提交;进 PR 披露)。策略:`[rules] blocking_severities = ["error"]` —— 三仓阻塞发现实测全为 warning 级(tauri 143 warning/0 error),error 级仍阻塞;warning 级(含 tauri 22 + tao 18 共 40 条上游既有尺寸/复杂度阻塞发现)降为报告,发现条目仍完整进 metric.json 可追溯。文件头部注释说明理由(upstream fork 基线债,不属本 fork 清偿范围)与恢复条件(上游重构后可收紧)。备选(逐规则 trim blocking_rules / 调阈值)复杂且脆弱(阈值需逐文件实测),弃。
- **ability**:不落策略文件,默认策略下实修 3 条(crates/ability/src/global_shortcut/types.rs `from_name` 复杂度 76、crates/plugin-webview/src/lib.rs `on_main_thread_event` 复杂度 67、crates/ability/src/lifecycle.rs `create_lifecycle_handle` 330 行),实现首步从 metric.json `blocking_findings` 结构化字段提取清单复核(路径+函数+数值)。重构为行为保持(拆函数/提公共块),修后设备 UT 全量复验。

### D6 supply-chain = gate 运行时代理环境,不落仓不改全局

gix 拉 advisory-db 直连卡死,本地代理 127.0.0.1:7897 实证可达 GitHub。gate 复跑命令统一前置 `HTTPS_PROXY=http://127.0.0.1:7897`(HTTP_PROXY 同设);不设用户级全局变量(会影响 rsproxy 等直连可达链路)。运行手册(本设计 + ship 报告)记录:代理须在跑;不可用期间 supply-chain 将红,属环境态非代码回归。

### D7 tauri-utils doctest ×2 = 独立复现诊断后定修

两个失败 doctest 名字已定位(config.rs:3058 `AppConfig::windows`、:1931 `WindowConfig::create`),失败态 0xC0000139 为运行期 DLL 入口缺失。诊断序:① host 单独 `cargo test -p tauri-utils --doc` 复现性判定;② standalone 绿 → botgate 运行环境差异(PATH/DLL 加载序),定位 botgate 子进程 env 差异并修正 gate 调用侧环境(机器侧);③ standalone 红 → dumpbin/Dependencies 定位 DLL 链,修机器侧工具链状态。**不允许**改 doctest 内容来绕过环境问题(两 doctest 本身有效)。

### D8 fmt 机械清扫独立 commit + schema churn 过滤

三仓 `cargo fmt --all` 各自独立 commit(用户约束:机械项与手写修复分开);tauri commit 显式点名路径并**排除** schema.json churn(git status 既有 M 行全量,实测 6 文件:crates/tauri-cli/config.schema.json + crates/tauri-schema-generator/schemas/ 下 4 个 + examples/api/src-tauri/tauri-plugin-sample/permissions/schemas/schema.json;提交时按当时 git status M 行全量点名,不碰不提交)。fmt 大 diff 属预期(工具链漂移归位),进 PR 已在 proposal Impact 披露。

### D9 叠加与 ship 顺序

本 change 全部 commit 落三仓 ohdev 当前 HEAD 之上(followup 13 commit 之下不重排、不 rebase);验收全绿后 followup change 先 ship(其归档含本 change 之前状态),本 change 再 ship。openspec 基础设施在 tauri 仓(four 产物落 tauri/openspec/)。

## Risks & Trade-offs

- [E0453 修复后暴露新的 missing_docs(tauri/tao)] → 以 doc-check.log 实测为准并入文档清偿组,上限受控;若 tauri/tao 暴露量级 >50 条则升级 PM 裁定是否同样分批。
- [host 桩链接通过但运行期原生调用失败面大] → D4.4 升级判据(>20 条或掩盖逻辑)停手上报,不静默豁免。
- [399 文档注释质量稀释] → 每条须语义真实;实现内建审查(audit)对空话/复制粘贴文档打回。
- [metric 策略文件弱化未来门禁] → error 级仍阻塞 + 发现条目完整保留 + 文件注释写明恢复条件;ability 仓不落策略保持诚实基线。
- [`.cargo/config.toml` host 段影响其他开发者] → 仅 x86_64-pc-windows-msvc target 生效;目标目录缺失时 host 构建回到当前失败态(LNK1181),不会静默错误链接;README 注明生成入口。
- [fmt 大 diff 污染已开 PR review] → 已在 proposal Impact 披露;commit 与手写修复分离,reviewer 可按 commit 粒度跳过机械段。
- [supply-chain 绿依赖代理在跑] → 运行手册明示;代理不可用为环境态,不阻断其余组件判读。

## Test Design

### 测试策略

- 单元测试:本 change 修复既有失败测试(tray `tray_icon_event_from_fallback_no_panic` 恢复编译并通过;version.rs 两 doctest 恢复通过);不新增产品代码,故无新单测;ability host 测试套件经桩接线后首次在 host 可链接执行。
- 集成/门禁测试:验收主体 = 三仓 blocking-9 组件级复跑(命令见 Goals.1),每组件 exit 0 为通过判据。
- 设备回归:ability 任何源码改动(clippy 3 项 / doctest / 399 文档不改运行时、3 条 metric 重构改)后,设备 UT 全量复验(既有配方:source tauri/.claude/skills/ohos-build/scripts/env.sh 交叉构建 + hdc -t 定向推送;workspace `--lib` 全量基线 **195 passed / 0 failed**,其中 openharmony_ability 本体 92/0)。

### Spec → Test 映射

| Spec Scenario | Test Function / 命令 | Type | 期望值 |
|---------------|---------------------|------|--------|
| ohos-gate-hygiene: host 测试链接(ability) | `cargo test --all-targets`(host,桩接线后) | integration | LNK1181 消失,链接成功;host 可执行测试全过或失败项全部归因分类 [test.log 链接行 + 桩目录实测] |
| ohos-gate-hygiene: tray 测试恢复 | `tray_icon_event_from_fallback_no_panic`(既有) | unit | 编译通过 + PASS,断言 fallback 事件映射不 panic [tray/mod.rs:804 既有断言] |
| ohos-gate-hygiene: version doctest 恢复 | doctest `version::sdk_api_version`(line 66)/`version::distribution_api_version`(line 93) | unit(doc) | 两 doctest 编译并断言通过 [doc-test log E0433 消除] |
| ohos-gate-hygiene: 文档完备(ability) | `cargo doc --no-deps -p <crate>`(或 botgate doc-check 组件) | integration | missing_docs 诊断 = 0 [doc-check.log 399 → 0] |
| ohos-gate-hygiene: tauri/tao metric 绿且可追溯 | `bot-metric check`(经 botgate,读仓根 bot-metric.toml)×2 仓 | integration | 组件 exit 0;metric.json 仍含全部 warning 级发现(tauri 阻塞基线 22 / unsafe 121;tao 18 / 726;warning 不丢弃)[metric.json 15:08 基线] |
| ohos-gate-hygiene: ability metric 默认策略下绿 | `bot-metric check` 默认策略 | integration | 阻塞发现 3 → 0(from_name cc76 / on_main_thread_event cc67 / create_lifecycle_handle 330 行)[metric.json 基线] |
| ohos-gate-hygiene: fmt 归位后保持 | `cargo fmt --all` 提交后 fmt 组件复跑 ×3 仓 | integration | `cargo fmt --check` 零 Diff,组件 pass |
| ohos-gate-hygiene: doc-check lint 冲突消除 | doc-check 组件(tauri) | integration | lib.rs E0453 消除且组件通过;E0453 修复后暴露的新 missing_docs 并入组 4 清单(>50 条升级)[doc-check.log] |
| ohos-gate-hygiene: with_theme 文档链接跨平台安全 | 结构性判据:三处 intra-doc 链接已改普通代码串 + 链接定义行已删;辅证 Windows host doc-check 组件 | integration(结构性) | intra-doc 链接不存在 → 任意平台结构性不可能断链;Windows host doc-check pass(验证环境仅 Windows host,跨平台断言由结构性判据承载) |
| ohos-gate-hygiene: 交叉构建不受接线影响 | aarch64-unknown-linux-ohos 交叉构建(source env.sh 配方) | integration | 构建产物与链接行为同接线前一致(host-only rustflags 不参与目标构建) |
| ohos-gate-hygiene: ability clippy 清偿 | clippy 组件(ability) | integration | 零诊断(基线:display.rs:109/:121/:125 nul-string、event.rs:75/:76 doc_lazy、waker.rs:58 type_complexity)[clippy.log] |
| ohos-gate-hygiene: 代理下 supply-chain | `HTTPS_PROXY=http://127.0.0.1:7897 bot-gate run supply-chain --project .` ×3 仓 | integration | advisory-db fetch 成功,exit 0 [supply-chain.log 失败态] |
| ohos-gate-hygiene: blocking-9 全绿 | `bot-gate run fmt check clippy test doc-test doc-check supply-chain metric --project .` ×3 仓(带代理) | integration | 三仓全部组件 pass;miri/sanitizer/valgrind 维持 skip |
| 行为保持:设备回归 | 设备 UT 套件(workspace --lib,device 3QC0124C11000038) | device | 195 passed / 0 failed(基线 2026-10-26,ut-*-device-1026.log) |

### 测试基础设施

- 无新增测试夹具;host 桩生成脚本 `host-stubs/generate.ps1` 为新增基础设施(产出物在 target/,不入库)。
- 设备 UT 配方沿用 ut-tao-device-1026.log / ut-ability-device-1026.log 溯源头(env.sh 链接器环境 + hdc -t)。

## Task Signals

tags: [ohos, c-ffi]
routed_skills: [rust-ohos, rust-ffi]

依据:change 主体为 OHOS 三仓门禁清偿;D4 host 桩机制涉及 `extern "C"`/`#[no_mangle]` C-ABI 桩与 MSVC link 行为(c-ffi);不涉 async/python-ffi/cxx。
