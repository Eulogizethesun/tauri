# ohos-gate-hygiene Specification

## Purpose
TBD - created by archiving change ohos-gate-debt-cleanup. Update Purpose after archive.

## Requirements

### Requirement: 三仓 blocking-9 门禁全绿

三仓(tauri/tao/openharmony-ability,ohdev 分支)SHALL 在代理环境可用的前提下,使 blocking-9 门禁组件(fmt/check/clippy/test/doc-test/doc-check/supply-chain/metric)复跑全部通过;miri/sanitizer/valgrind 维持既有 skip 口径。

#### Scenario: 带代理全量复跑
- **WHEN** 在任一仓根执行 `HTTPS_PROXY=http://127.0.0.1:7897 bot-gate run fmt check clippy test doc-test doc-check supply-chain metric --project .`
- **THEN** 报告中上述 9 组件全部 pass,总 status=passed

#### Scenario: fmt 归位后保持
- **WHEN** 三仓各自执行 `cargo fmt --all` 提交后再次运行 fmt 组件
- **THEN** `cargo fmt --check` 零 Diff,组件 pass

### Requirement: tauri 既有编译/lint 失败清偿

tauri 仓 SHALL 以最小 diff 清偿 check/test/clippy/doc-check 四组件的既有失败(测试模块 E0425/E0433、derivable_impls、E0453 lint 冲突),且 SHALL NOT 改变产品运行时行为。

#### Scenario: tray fallback 测试恢复
- **WHEN** 运行 `cargo test -p tauri --lib tray_icon_event_from_fallback_no_panic`
- **THEN** 测试编译通过并 PASS(原 E0425/E0433 ×4 消除)

#### Scenario: doc-check lint 冲突消除
- **WHEN** 运行 doc-check 组件
- **THEN** crates/tauri/src/lib.rs 不再产生 E0453(代码级 warn 与 CLI forbid 冲突消除)

### Requirement: tao 既有 lint/doc 失败清偿

tao 仓 SHALL 清偿 clippy(collapsible_match)与 doc-check(E0453 + 断链根因)既有失败;doc 注释修改后任意平台 SHALL NOT 产生 broken intra-doc link。

#### Scenario: with_theme 文档链接跨平台安全
- **WHEN** window.rs with_theme doc 注释中三处 `EventLoopBuilderExtWindows::with_theme` intra-doc 链接已改为普通代码串、链接定义行已删(结构性判据;辅证:Windows host doc-check 组件绿)
- **THEN** intra-doc 链接不存在,任意平台结构性不可能触发 broken intra-doc link(验证环境仅 Windows host,跨平台断言由结构性判据承载)

### Requirement: ability 既有 clippy/doctest 失败清偿

openharmony-ability SHALL 清偿 clippy 既有诊断(手写 nul 结尾字符串 ×3、doc_lazy_continuation ×2、type_complexity ×1)与 doc-test 既有失败(version.rs 两 doctest E0433),且 SHALL NOT 改变运行时行为。

#### Scenario: clippy 清零
- **WHEN** 运行 ability clippy 组件
- **THEN** 零诊断(基线:display.rs:109/:121/:125、event.rs:75/:76、waker.rs:58)

#### Scenario: version doctest 恢复
- **WHEN** 运行 doc-test 组件
- **THEN** version.rs 两 doctest(`sdk_api_version` line 66 / `distribution_api_version` line 93)编译通过并断言通过(E0433 消除)

### Requirement: ability 公开面文档完备

openharmony-ability 工作区全部 crate 的公开项(crate/struct/enum/variant/field/method/assoc fn)SHALL 有文档注释,doc-check 的 missing_docs 诊断 SHALL 清零;文档 SHALL 为英文 ASCII 且语义真实。

#### Scenario: doc-check 清零
- **WHEN** 运行 ability doc-check 组件
- **THEN** missing_docs 诊断 = 0(基线 399 条:ability crate 266 + 插件 crate 133)

### Requirement: ability host 测试可链接执行

openharmony-ability SHALL 在 Windows host 上经已提交的 host 桩机制(host-stubs/ 目录 + 生成脚本 + 仓级 .cargo/config.toml host 段)完成 `cargo test --all-targets` 链接(LNK1181 消除);设备链路(交叉构建与真机运行)SHALL NOT 受该接线影响。

#### Scenario: host 链接通过
- **WHEN** 在 ability 仓根执行 host-stubs/generate.ps1 后运行 `cargo test --all-targets`
- **THEN** 测试二进制全部链接成功(无 LNK1181/未解析外部符号);执行结果中每个失败测试均有归因分类(设备专属门控 / 真实缺陷)

#### Scenario: 交叉构建不受接线影响
- **WHEN** 以 aarch64-unknown-linux-ohos 目标交叉构建(source env.sh 后)
- **THEN** 链接行为与接线前一致(host-only rustflags 不参与目标构建)

### Requirement: ability 行为保持(设备回归)

ability 仓本 change 内全部源码改动(clippy 修复/doctest 修正/3 条 metric 重构)SHALL 保持行为;设备 UT 套件结果 SHALL 与基线一致。

#### Scenario: 设备 UT 全量复验
- **WHEN** 按既有配方(交叉构建 + hdc -t 定向推送)运行 ability 工作区 --lib 设备 UT
- **THEN** 195 passed / 0 failed(基线 2026-10-26,ut-ability-device-1026.log)

### Requirement: metric 混合清偿(用户裁定)

tauri/tao SHALL 以仓根 bot-metric.toml 将 warning 级发现降为报告(error 级仍阻塞,发现条目完整保留);ability SHALL NOT 落策略文件,13 条阻塞发现 SHALL 在默认策略下实修清零。

#### Scenario: tauri/tao metric 绿且发现可追溯
- **WHEN** tauri/tao 运行 metric 组件(仓根 bot-metric.toml 生效)
- **THEN** 组件 pass;metric.json 仍含全部 warning 级发现条目(不静默丢弃)

#### Scenario: ability metric 默认策略下绿
- **WHEN** ability 运行 metric 组件(默认策略)
- **THEN** 阻塞发现 = 0(基线 3 条),组件 pass
