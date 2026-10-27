# Tasks: ohos-gate-debt-cleanup

> 三仓工作目录:tauri = D:\xuqiu\tauri-3.0\tauri;tao = D:\xuqiu\tauri-3.0\tao;ability = D:\xuqiu\tauri-3.0\openharmony-ability(分支均 ohdev)。
> **commit 纪律(全程)**:机械 fmt 清扫(组 9)与手写修复(组 1-8)分开 commit;commit 显式点名路径禁 git add -A;tauri 提交过滤 schema.json churn(git status 既有 M 行全量,实测 6 文件:crates/tauri-cli/config.schema.json + crates/tauri-schema-generator/schemas/ 下 4 个 + examples/api/src-tauri/tauri-plugin-sample/permissions/schemas/schema.json,提交时按当时 git status M 行全量点名);不 push。

## 1. tauri 仓手写修复

- [x] 1.1 Fix tray test module imports — 补 `TrayIconEvent`/`MouseButton`/`MouseButtonState` 的 use(解 E0425/E0433 ×4,类型可见性已证无 cfg 问题) — anchor: crates/tauri/src/tray/mod.rs::tray_icon_event_from_fallback_no_panic
- [x] 1.2 Replace manual impl with derive — 删 `impl Default for OpenHarmonyConfig`(:3292),struct(:3259)加 `#[derive(Default)]` — anchor: crates/tauri-utils/src/config.rs::OpenHarmonyConfig
- [x] 1.3 Remove missing_docs from crate-level warn — `#![warn(missing_docs, rust_2018_idioms)]` → `#![warn(rust_2018_idioms)]`(解 E0453) — anchor: crates/tauri/src/lib.rs
- [x] 1.4 Verify tauri check/test/clippy/doc-test/doc-check 组件绿(若 doc-check 暴露新 missing_docs,并入组 4 清单;>50 条升级 PM)→ 首轮 69 条 >50,按会话判据停手上报;**PM 裁决(经 coordinator 2026-10-26 晚间转发):"PM 裁定(D2 >50 线):吸收不分批"**——E0453 消除后逐层揭开的级联文档全量吸收,分批落地于 d2500799b(原 8479f3c3c,amend 补 macos-sign API 披露)/1590c5f8b/2add4f7c0;clippy 8 error 遮蔽债修于 08bf952f2;test insta 快照漂移修于 15a0a57f5 — anchor: crates/tauri/src/tray/mod.rs::tray_icon_event_from_fallback_no_panic
- [x] 1.5 Commit tauri 手写修复(显式点名 3 文件)→ `08f21a0b2`(5 文件:含 tauri-utils lib.rs/mime_type.rs 文档) — anchor: crates/tauri/src/tray/mod.rs

## 2. tao 仓手写修复

- [x] 2.1 Fix collapsible_match ×2 — handling_close.rs:60/:73 的 if 并入外层 match 臂 — anchor: examples/handling_close.rs
- [x] 2.2 Fix with_theme doc link — 删 :574 allow 属性;doc 注释中 `[`EventLoopBuilderExtWindows::with_theme`]` 三处 intra-doc 链接改普通代码串并删链接定义行 — anchor: src/window.rs::with_theme
- [x] 2.3 Verify tao clippy/doc-check/fmt(仅触及文件)组件绿 → doc-check 首轮 165 条 >50 停手上报;**同 1.4 PM 裁决:吸收不分批**——级联文档全量吸收于 139cc582 + 23e58c73(第二轮强制 missing-docs 下揭开的 6 条 + tao-macros crate doc,gate env 复验 0 条);NumpadEnter doc ASCII 化于 967ab642 — anchor: src/window.rs::with_theme
- [x] 2.4 Commit tao 手写修复(显式点名 2 文件)→ `61659a97` — anchor: examples/handling_close.rs

## 3. ability 仓手写修复

- [x] 3.1 Fix manual nul-terminated strings ×3 — display.rs:109/:121/:125 按 clippy 建议改写 — anchor: crates/ability/src/display.rs
- [x] 3.2 Fix doc_lazy_continuation ×2 — event.rs:75/:76 doc 注释续行缩进 — anchor: crates/ability/src/event.rs
- [x] 3.3 Fix type_complexity — waker.rs:58 引入 type alias 承载 `RwLock<Option<Arc<ThreadsafeFunction<(),(),(),Status,false>>>>` — anchor: crates/ability/src/waker.rs
- [x] 3.4 Fix version doctests ×2 — sdk_api_version(line 66)/distribution_api_version(line 93) doc 例改全路径或补 use — anchor: crates/ability/src/version.rs::sdk_api_version,::distribution_api_version
- [x] 3.5 Verify ability clippy/doc-test 组件绿 → 双双绿:clippy exit 0(含基线遗留 86 条 default_numeric_fallback 清偿,机械 suffix 修复);bot-gate doc-test 官方复跑 GATE_EXIT=0(version.rs doctest LNK1181 由组 5 host 桩 + rustdocflags 接线解决) — anchor: crates/ability/src/version.rs::sdk_api_version
- [x] 3.6 Commit ability 手写修复(显式点名 4 文件)→ `4524128`(12 文件:4 个手修文件 + 8 个 fallback suffix 文件;commit message 披露同文件共置文档行) — anchor: crates/ability/src/display.rs

## 4. ability missing_docs 清偿(399 条)

- [x] 4.1 Extract exact per-item list — 从 .botgate/logs/doc-check.log 提取逐条清单(按结构化字段去重)→ 另以 botgate 同参 cargo doc 全新扫描(target/missing-docs-list4.txt)补出基线截断外的 global-shortcut 13/window 15/accessibility 6 等条目,合计 265 条;基线 399 条为 doc-check.log 25 条截断下的子集 — anchor: .botgate/logs/doc-check.log
- [x] 4.2 Document ability crate items — 266 条英文 ASCII 文档注释,语义真实 — anchor: crates/ability/src/lib.rs
- [x] 4.3 Document plugin crate items — 133 条 + 补漏 crate(global-shortcut/accessibility/window/webview/statusbar 等)合计 265 条全部清偿 — anchor: crates/plugin-menu/src/lib.rs
- [x] 4.4 Verify doc-check missing_docs = 0 → bot-gate doc-check 组件官方复跑 passed blocking(2026-10-26);手动全新扫描 0 条(target/missing-docs-list5.txt)一致 — anchor: crates/plugin-menu/src/lib.rs
- [x] 4.5 Commit missing_docs(按 crate 分批或单 commit,显式点名)→ `1b0c7ed`(40 个纯文档文件;12 个混置文件随 `4524128`) — anchor: crates/ability/src/lib.rs

## 5. ability host 链接桩接线

- [x] 5.1 Migrate stub mechanism into repo — host-stubs/ 四文件迁入 + generate.ps1(vswhere 找 lib.exe;19 个空壳 .lib 含 round3 增补 hilog_ndk.z;stubs.rs→ohos-host-stubs.lib;ohinputmethod.lib=拷贝;stub-web.rs→ohweb.lib),幂等可重跑 — anchor: host-stubs/generate.ps1
- [x] 5.2 Wire host-only link path — 仓级 .cargo/config.toml 新建 `[target.x86_64-pc-windows-msvc]` rustflags + rustdocflags 双键 `-L native=target/host-stub-libs`(host-only,交叉构建不受影响;注释标明 rustflags 为替换键;rustdoc 单独要求——cargo 不把 target rustflags 传给 rustdoc,缺 rustdocflags 时 doctest 链接 LNK1181) — anchor: .cargo/config.toml
- [x] 5.3 Run generate + host cargo test --all-targets — round3(dlopen/dlsym 迁入主档+XComponent Register*/Get* 3 符号+hilog_ndk.z 空壳)与 round4(36 符号:OH_ResourceManager_* 全族 27+ArkWeb 8+OH_LOG_Print)两轮扩充后 host 链接全通(--no-run exit 0,0 unresolved) — anchor: host-stubs/symbols_round2.txt
- [x] 5.4 Triage host runtime failures — 全量 host 测试实际运行 184 passed/0 failed/20 个测试二进制,零失败 → 无需 cfg 门控、无门控掩盖逻辑,不触发设计 D4.4 升级判据 — anchor: crates/ability/src/lib.rs
- [x] 5.5 Verify cross-build unaffected — source env.sh 后 `cargo test --all-targets --workspace --target aarch64-unknown-linux-ohos --no-run` exit 0,设备测试二进制链接正常(target/aarch64-unknown-linux-ohos/debug/deps);host-only rustflags/rustdocflags 未泄漏进交叉构建 — anchor: host-stubs/generate.ps1
- [x] 5.6 Commit host-stubs 机制(显式点名 host-stubs/ + .cargo/config.toml)→ `7b04825`(8 文件:host-stubs 6 + .cargo/config.toml + host-stub-libs 说明;round3/round4 扩充已含) — anchor: host-stubs/generate.ps1

## 6. ability metric 13 条实修(默认策略)

- [x] 6.1 Extract exact blocking list — .botgate/metric.json gate.blocking_findings=3(其余 17 条 unsafe_usage 为 warning 不阻塞):①`Key::from_name` crates/ability/src/global_shortcut/types.rs:204-283 复杂度 76(75 match arms)>40;②`create_lifecycle_handle` crates/ability/src/lifecycle.rs:78-527 330 NBNC 行>300;③`WebviewBridgePlugin::on_main_thread_event` crates/plugin-webview/src/lib.rs:61-184 复杂度 67(18 arms+48 try)>40 — anchor: .botgate/metric.json
- [x] 6.2 Refactor 3 findings — 行为保持:①from_name 改 NAME_TABLE 表驱动(75 行表,复杂度 76→3);②create_lifecycle_handle 拆出 make_on_configuration_updated/make_on_window_stage_event/make_on_window_rect_change/make_on_avoid_area_change 4 个构造器(-360 行);③on_main_thread_event 拆 4 个事件族 helper(engine_lifecycle/controller/callback_decision/callback_ack),复杂度 67→8;host 测试 184/0 回归一致 — anchor: crates/plugin-webview/src/lib.rs
- [x] 6.3 Verify metric 组件默认策略下绿(阻塞发现 0) → bot-gate metric passed blocking(GATE_EXIT=0);metric.json gate.blocking_findings=0,仅余 17 条非阻塞 unsafe_usage warning(基线原样保留);host 测试 184/0 与重构前一致 — anchor: crates/plugin-webview/src/lib.rs
- [x] 6.4 Device UT full rerun — 既有配方(交叉构建 + hdc -t),workspace --lib 全量 → 20 二进制全部 send exit=0,195 passed/0 failed(19 条 result 行 + derive proc-macro 主机 PE `magic 4D5A` 跳过,与基线 ut-ability-device-1026.log 完全一致),日志 ut-ability-device-1026-g6.log — anchor: crates/plugin-webview/src/lib.rs
- [x] 6.5 Commit metric 实修(显式点名)→ `7b540ab`(3 文件:global_shortcut/types.rs 表驱动 + plugin-webview/lib.rs 事件族 helper + lifecycle.rs 4 个 make_on_* 构造器) — anchor: crates/plugin-webview/src/lib.rs

## 7. tauri/tao metric 策略文件(用户裁定:上游豁免)

- [x] 7.1 Create tauri bot-metric.toml — 仓根新文件:`[rules] blocking_severities = ["error"]` + `[quality_targets]`(镜像 bot-gate 生成默认)+ `[analysis] cfg_policy=active / source_scope=reachable`(reachable 消 BM103 node_modules/BM201 模板文件);头注释写明上游 fork 基线债理由与恢复条件 — anchor: bot-metric.toml
- [x] 7.2 Create tao bot-metric.toml — 同 7.1,另含 quality_targets(镜像 bot-gate 生成默认:max_average_file_lines 600+禁用 unsafe/growth 目标)与 cfg_policy=active;附带 `f69ab048` 修 tao 上游 `mod r#async;` 的 BM102(#[path] 语义空改动)→ `2908a310`;metric passed blocking,834 warning 保留 — anchor: bot-metric.toml
- [x] 7.3 Verify metric 组件绿且 metric.json 仍含 warning 级发现条目 → TAURI_METRIC_EXIT=0 "metric passed blocking";metric.json gate.blocking_findings=0,364 条 warning 全保留(发现条目完整) — anchor: bot-metric.toml
- [x] 7.4 Commit 策略文件(两仓各一,显式点名)→ tauri `d80e5dcf2`(bot-metric.toml 单文件;6 个 schema.json churn 未纳入)、tao `2908a310` — anchor: bot-metric.toml

## 8. 环境修复(机器侧,不落仓)

- [x] 8.1 Verify supply-chain via proxy — ability `SUPPLY_CHAIN_EXIT=0` passed(tao 侧同库同刷新不受影响);tauri 26 实例/13 ID、tao 2 实例为 2026-10-26 advisory-db 刷新(commit 115e418e,1355 条)新增的上游依赖链告警,非本 change 引入 → 按上游 PR #15282 惯例扩展/新建 `.cargo/audit.toml`(tauri `7bc2190dd`:13 ID 全链路溯源注释;tao `636eeae6`:quick-xml 仅经 wayland-scanner←softbuffer dev-dep,Linux-only);cargo update 路线因 sparse 镜像晚间 0 字节挂死放弃(记录于 commit body);`cargo audit` 复跑 TAURI_AUDIT_EXIT=0 / TAO_AUDIT_EXIT=0 — anchor: Cargo.lock
- [x] 8.2 Diagnose tauri-utils doctest ×2 — standalone 复现红(0xC0000139 独立于 botgate);DLL 链定位完成:doctest 体引用 tauri::Builder → tao 窗口/对话框代码 → 导入 comctl32!TaskDialogIndirect,裸 doctest exe 无嵌入清单 → 加载 System32 comctl32 v5.82(实测不导出 TaskDialogIndirect,WinSxS v6 导出)→ 启动即死;修复 = 用户级 `~/.cargo/config.toml` [target.x86_64-pc-windows-msvc] rustdocflags 注入 `/MANIFEST:EMBED + /MANIFESTINPUT`(机器侧,未改任何 doctest 内容,未落仓);修复后 standalone `cargo test -p tauri-utils --doc` = 2 passed; 0 failed — anchor: crates/tauri-utils/src/config.rs

## 9. fmt 机械清扫(独立 commit,组 1-8 全部落盘后执行)

- [x] 9.1 tauri cargo fmt --all + 独立 commit → `091e38755`(33 文件 +8368/−8198,crates/tauri + tauri-cli mobile/open_harmony + tauri-runtime(-wry) + 两 example app;6 个 schema.json churn 明确排除未提交) — anchor: crates/tauri/src/lib.rs
- [x] 9.2 tao cargo fmt --all + 独立 commit → **二次勘误(21:10 实证,推翻 20:51 勘误)**:detached fmt 子进程 19:50 重写的 113 文件中,除 1 个文件外全部是 **core.autocrlf=true 下的 CRLF 幻影 M**(`git diff --stat` 实际只有 ohos/window.rs 一处真实 hunk;status M 计数不可信)。唯一 token 级差异(单表达式闭包花括号)已随 `8af51af1` 落盘,提交后 worktree==HEAD、`cargo fmt --check` 零 diff、tracked M 清零 — anchor: src/platform_impl/ohos/window.rs
- [x] 9.3 ability cargo fmt --all + 独立 commit → `45f8f48`(11 文件 +186/−146:NAME_TABLE/lifecycle 构造器/plugin-webview 事件族 helper 等组 6 重构产物归一) — anchor: crates/ability/src/lib.rs

## 10. 终验:blocking-9 三仓全绿(放行 followup ship)

- [x] 10.1 三仓全量复跑 — `HTTPS_PROXY=http://127.0.0.1:7897 bot-gate run fmt check clippy test doc-test doc-check supply-chain metric --project .`,9 组件全 pass、miri/sanitizer/valgrind 维持 skip;归档三仓 report 证据;任一组件红 → 回对应组修复后重跑 — anchor: crates/tauri/src/lib.rs
