# Proposal: ohos-gate-debt-cleanup

## Why

rb-verifier 对 `ohos-committer-issues-followup`(13 commit,43/43 完成)独立复跑三仓 blocking-9 门禁全部 failed,经 blame + botgate 历史 + commit 触达三重归因,**全部失败为既有/环境类,本 change 前零新增**。门禁全红阻塞 followup 的 ship(用户已裁定:先清偿门禁债、blocking-9 复跑全绿,再 ship)。

既有失败构成(证据 = 三仓 `.botgate/logs/` 2026-10-26 14:55-15:09 全量运行 + `metric.json`):

- **机械类**:tauri fmt 105 处 / tao fmt 8 处 / ability fmt 28 处(rustfmt 工具链漂移,blame 05-22~10-21)
- **小型代码修复类**:tauri tray 测试 4 错(E0425/E0433,05-23 引入)、tauri-utils `OpenHarmonyConfig` 手写 Default(clippy derivable_impls)、tauri/tao doc-check E0453 ×2(代码级 warn/allow 与 botgate CLI `-F` forbid 冲突)、tao collapsible_match ×2、ability clippy 3 项(nul-string ×3 / doc_lazy ×2 / type_complexity ×1)、ability version.rs doctest ×2(E0433 路径错)
- **文档清偿类**:ability doc-check **399 条 missing_docs**(ability crate 266 + 插件 crate 133;botgate CLI forbid 压倒一切代码级 allow,唯一绿掉路径 = 补写文档)
- **结构性接线类**:ability host `cargo test --all-targets` LNK1181 `ohinputmethod.lib` —— OHOS 桥接仓 host 链接既有缺口;`target/host-stub-libs/`(25 个 .lib 桩 + stubs.rs,symbols_round1/2)已存在但**未提交、未接线**到 host 链接路径
- **政策类(用户已裁定)**:metric 组件阻塞发现 43 条 —— tauri 22 条 / tao 18 条几乎全在上游既有文件(winit keyboard/keycode、tauri bundler/cli/codegen 等)→ 落仓根 `bot-metric.toml` 降为报告级;ability 3 条全在我方桥接代码(global_shortcut/types.rs `from_name`、plugin-webview/lib.rs `on_main_thread_event`、lifecycle.rs `create_lifecycle_handle`)→ 实修清偿
- **环境类**:supply-chain advisory-db fetch 三仓一致失败(git 直连超时,本地代理 127.0.0.1:7897 可解);tauri-utils doctest ×2 STATUS_ENTRYPOINT_NOT_FOUND(Windows DLL 环境类)

## What Changes

三仓(分支均 ohdev;不改 wry)门禁债清偿,分七组:

1. **tauri 手写修复**(3 文件):tray/mod.rs 测试模块补 import(解 check+test 编译)、tauri-utils config.rs `impl Default for OpenHarmonyConfig` 改 `#[derive(Default)]`、tauri lib.rs 去掉与 CLI forbid 冲突的 `#![warn(missing_docs, ...)]` 中 missing_docs 项
2. **tao 手写修复**(2 文件):examples/handling_close.rs collapsible_match ×2、src/window.rs:574 删 `#[allow(rustdoc::broken_intra_doc_links)]` 并把 `EventLoopBuilderExtWindows::with_theme` intra-doc 链接改为普通代码串(任意平台不再可能断链)
3. **ability 手写修复**(4 文件):display.rs 手写 nul 结尾字符串 ×3、event.rs doc_lazy_continuation ×2、waker.rs type_complexity(引入 type alias)、version.rs 两个 doctest 路径修正
4. **ability missing_docs 清偿**:399 条英文 ASCII 文档注释,按 crate 分批(ability 266 / plugin-menu 41 / plugin-clipboard 31 / plugin-files 18 / plugin-permission 13 / plugin-screenshot 8 / plugin-resource 7 / plugin-url 6 / demo_native 5 / demo_sub_native 2 / derive 1 / continuation 1)
5. **ability host 链接桩接线**:把 `target/host-stub-libs/` 的桩源(stubs.rs / stub-web.rs / symbols_round1/2.txt)迁入已提交目录 + 生成脚本 + 仓级 `.cargo/config.toml`(仅 `[target.x86_64-pc-windows-msvc]` rustflags 指向桩目录);host `cargo test --all-targets` 链接通过;运行期失败按"设备专属测试 cfg(target_env="ohos") 门控"处置,超阈值升级
6. **metric 清偿(用户裁定)**:tauri/tao 落仓根 `bot-metric.toml`(阻塞发现全为 warning 级,策略 = warning 报告不阻塞,注释说明上游 fork 基线债理由);ability 3 条实修(global_shortcut `from_name` 复杂度 76 / plugin-webview `on_main_thread_event` 复杂度 67 / lifecycle `create_lifecycle_handle` 330 行)至默认策略下全绿
7. **环境修复(机器侧,不落仓)**:gate 运行时 `HTTPS_PROXY=http://127.0.0.1:7897` 解 supply-chain;tauri-utils doctest ×2 独立复现诊断(standalone vs botgate 环境差异)

fmt 机械清扫(三仓 `cargo fmt --all`)作为独立组,**与手写修复分开 commit**(用户约束);tauri commit 过滤 schema.json churn 5 文件。

## Capabilities

### New Capabilities

- **ohos-gate-hygiene**:三仓 blocking-9 门禁可复现全绿 —— 含 ability host 测试链接桩机制(新增已提交基础设施)、ability 公开面文档完备、metric 项目级策略文件(tauri/tao)、supply-chain 代理运行手册。

### Modified Capabilities

无。本 change 不修改任何 spec 已定义的运行时行为(全部为测试/文档/工具链/接线);ability metric 实修为行为保持重构,以设备 UT 套件(195/0 基线)复验。

## Impact

- **四条已开 PR 增量披露(重要)**:本 change 全部 commit 落 ohdev 分支,将进入 tauri#241 / tao#28 / ability#55 等已开 PR —— fmt 大 diff(tauri ~105 处/tao 8 处/ability 28 处)、bot-metric.toml ×2、host-stubs 基础设施 + `.cargo/config.toml`、ability 399 条文档注释、3 处重构。上游可见但均有明确理由(rustfmt 归位/门禁策略/桥接仓 host 可测性),PR 描述须追加说明。
- **对 ohos-committer-issues-followup 的叠加关系**:清扫 commit 落在其 13 commit 之上(同分支线性叠加);ship 顺序 = 清扫 blocking-9 全绿 → followup ship。
- **第 4 仓 cargo-mobile2(实现期范围补记)**:tauri 对本地 `../cargo-mobile2` 既有 path 依赖;clippy 清偿需配套修复其 `util` 模块 glob re-export 的 feature 门控(`7bff87e`,cfg-gated behind `cli` feature)并同步 tauri 侧 `Cargo.toml` 去掉 `default-features = false`(`bdfe57c0d`)——超出设计期"三仓+不改 wry"声明,属 lint 清偿的必要配套,单 commit 独立可审。
- **实现期增量披露**:tauri `.cargo/audit.toml` 豁免由 13 条增至 24 条(2026-10-26 advisory-db 第二次刷新新增 4 条 zstd:RUSTSEC-2026-0391/0398/0403/0410,链 zstd←zstd-safe←zstd-sys←rpm←tauri-bundler 仅 Linux RPM 路径;镜像晚间 0 字节挂死无法 cargo update,已载 retry 义务);clippy 清偿面含 default_numeric_fallback warn 级全仓 suffix 补齐(tauri 35 文件,examples/bench 在 `-p` 全列表内)与 multiwebview 浮点字面量补丁损坏修复(`800i32.`→`800f64`,10 处)。
- **运行时行为**:零变化(测试/文档/工具链);ability 重构与 host 桩仅影响 host 测试链接性,设备链路(aarch64-unknown-linux-ohos)不受 `.cargo/config.toml` host 段影响。
- **机器侧依赖**:supply-chain 绿依赖本地代理 127.0.0.1:7897 在跑(不可用时直连,已实证可用性交替);此为运行手册项,不落仓。
- **升级路径(结构性裁决)**:若 ability host 测试在桩链接通过后出现**运行期**原生调用失败且需门控测试 >20 条或门控掩盖真实逻辑 → 停手上报 PM/用户裁决(候选处置:gate 层 test 组件设备侧运行/文档化豁免),不得静默继续。
