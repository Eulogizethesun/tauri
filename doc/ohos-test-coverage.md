# OHOS 适配测试覆盖率报告（2026-08-24）

> 操作流程（测量链怎么跑/补测怎么迭代/陷阱清单）见 [ohos-coverage-workflow.md](ohos-coverage-workflow.md)。

> 用途：验证当前测试是否符合预期、规划补测。数据来源：静态分析 + `tauri/examples/api` 自动测试（`src/lib/tests/*.ts`，12 个文件）+ 手动测试（`tauri/doc/manual_tests.md`，33 章 173 用例；`examples/huawei-account/doc/manual_tests.md`，6 用例）。

---

## 〇、基线定义（两套口径）

覆盖率的"新增代码"取决于 diff 基线，本项目有两套口径：

| 口径 | diff 范围 | 测的是什么 | 状态 |
|---|---|---|---|
| **本批增量** | `upstream/ohdev...HEAD` | 我们最后一笔 squash commit（emit/Channel、bridge facade 迁移等） | ✅ 已测（本文一节，修正后 6.8%） |
| **团队全量** | `fork点...HEAD`（下表） | 团队自 fork 官方仓以来的全部 OHOS 适配累积 | ✅ 已测（本文一节，4.4%；in-binary 6.3%） |

### 团队基线（fork 点）定位方法与结果

定位方法（三层验证）：
1. **fork 链事实**：GitHub API `repos/Eulogizethesun/<repo>` 的 `parent` 字段——7 仓直连 `tauri-apps/<repo>`；**openharmony-ability 特殊：fork 自 `harmony-contrib/openharmony-ability`**（其 2024-11 的原始 bridge 基建不算团队工作）
2. **fork 点计算**：compare API `repos/<官方仓>/compare/<default>...Eulogizethesun:ohdev` 的 `merge_base_commit`
3. **反证**：每个 fork 点 `git grep -i ohos` 零命中，确认纯官方代码

| 仓 | fork 点 | fork 自 | 日期 | 总 commit | 普通/merge |
|---|---|---|---|---:|---:|
| window-vibrancy | `a3a3ff347` | tauri-apps | 2026-03-08 | 2 | 1/1 |
| tao | `3ecc2a833` | tauri-apps | 2026-03-23 | 43 | 28/15 |
| wry | `44e26ef27` | tauri-apps | 2026-04-10 | 37 | 25/12 |
| tauri | `a30dca482` | tauri-apps | 2026-04-23 | 185 | 123/62 |
| openharmony-ability | `6c52bb441` | harmony-contrib | 2026-04-27 | 45 | 25/20 |
| plugins-workspace | `8bbc7a0d1` | tauri-apps | 2026-05-06 | 41 | 23/18 |
| tray-icon | `c5d077afb` | tauri-apps | 2026-05-07 | 14 | 7/7 |
| muda | `597e1bcb3` | tauri-apps | 2026-05-09 | 6 | 3/3 |

**注意**：ohdev 历史上 2025-08 日期的"第一笔 OHOS 提交"（tao `cc9667d6`、wry `3e78e2c`、tauri `afbcd4e`、oha init `f00ce2f`）是 fork 之后 merge 进来的外部移植成果（保留原始作者日期），**不是**团队与官方的分界点——分界点以上表 fork 点为准。

**团队全量口径的特点**：分母显著变大（各仓 ohos 模块的全部历史存量，不只本批重构）；未覆盖热点会转移到历史遗留代码；openharmony-ability 的分母比"整仓"口径小（排除 harmony-contrib 原始部分）。

---

## 一、UT 对新增代码的增量覆盖率（llvm-cov 设备侧插桩实测，2026-08-22）

### ⚠️ 勘误（2026-08-22 晚）：初版 75.4% 及各仓数字全部作废

初版报告的 75.4% 基线是增量计算脚本 `incr-cov.py` 的 **两个 bug 产生的假数据**：

1. **键名 bug**：脚本读 llvm-cov JSON 导出的 `name` 键，但实际导出**只有 `filename` 键**（已实测确认：2024 个文件条目均无 `name`）。所有文件的覆盖数据归并到空字符串键下，被最后一个文件的数据覆盖 → 每个文件的查询都返回错误文件的覆盖 → 汇总数完全随机。
2. **测试模块识别 bug**：`find_test_lines` 只遍历 diff 中新增的行来检测 `#[cfg(test)]` 模块边界，但 `#[cfg(test)]` 行本身几乎从不在 diff 中 → 测试模块从未被识别 → 测试代码行全部计入非测试分母。

另有**第三处缺陷**（修复版脚本仍存在，最终弃用该算法）：按 segment 起始行统计覆盖，函数体内非 region 起点的行（绝大多数执行行）被漏计 → 覆盖率系统性低估 10-30%（例：tray-icon 实际 38 行被算成 28 行）。**最终以 `llvm-cov export --format=lcov` 的逐行 DA 记录为准**（lcov 格式直接给出每行计数，无 segment 推导问题），脚本 `jobs/97f58082/tmp/incr-cov2.py`。

### 修正后真实数字

测量链路不变（插桩编译 → 设备执行 → profraw 回收 → merge → 导出），设备侧 390 个测试全绿的数据有效，仅增量计算修正。

**本批口径（`upstream/ohdev...HEAD`，最后一笔 squash commit：emit/Channel、bridge facade 迁移等）**：

| 仓库 | 新增行 | 测试行 | 非测试新增行 | 覆盖行 | 覆盖率% |
|---|---:|---:|---:|---:|---:|
| openharmony-ability | 11059 | 1603 | 9456 | 884 | 9.3% |
| tauri | 1184 | 0 | 1184 | 0 | 0.0% |
| wry | 1179 | 237 | 942 | 17 | 1.8% |
| plugins-workspace | 937 | 0 | 937 | 0 | 0.0%（无 OHOS 测试运行） |
| tao | 1027 | 353 | 674 | 1 | 0.1% |
| tray-icon | 835 | 514 | 321 | 38 | 11.8% |
| window-vibrancy | 190 | 58 | 132 | 2 | 1.5% |
| muda | 654 | 484 | 170 | 1 | 0.6% |
| **合计** | **16065** | **3249** | **13816** | **943** | **6.8%** |

**团队全量口径（fork 点...HEAD，团队自 fork 以来的全部 OHOS 适配累积）**：

| 仓库 | 新增行 | 测试行 | 非测试新增行 | 覆盖行 | 覆盖率% | in-binary 覆盖率% |
|---|---:|---:|---:|---:|---:|---:|
| tauri | 21822 | 227 | 21595 | 24 | 0.1% | 0.2%（13273 行） |
| openharmony-ability | 12674 | 1915 | 10759 | 907 | 8.4% | 9.9%（9202 行） |
| plugins-workspace | 2753 | 39 | 2714 | 0 | 0.0% | —（无测试二进制） |
| tao | 2753 | 353 | 2400 | 168 | 7.0% | 7.1% |
| wry | 1628 | 264 | 1364 | 39 | 2.9% | 2.9% |
| tray-icon | 2284 | 959 | 1325 | 350 | 26.4% | 26.4% |
| muda | 1579 | 765 | 814 | 293 | 36.0% | 36.0% |
| window-vibrancy | 255 | 58 | 197 | 10 | 5.1% | 5.1% |
| **合计** | **44648** | **4580** | **41168** | **1791** | **4.4%** | **6.3%**（排除 pw） |

说明：
- **in-binary** 口径把分母限定为"编译进测试二进制的文件"（排除 tauri-cli、examples/api 等不可能被 UT 触达的行，团队口径共排除 ~9000 行）。
- 数字低是**真实情况**，不是测量失败：设备侧 390 个测试几乎全是纯逻辑单测，而 diff 主体是 NAPI 桥接/窗口系统/线程基建，裸测试二进制（无 ArkTS runtime）下不可执行。muda 36%、tray-icon 26.4% 证明测量本身有效——这两个仓的 OHOS 历史代码纯逻辑占比高、测试密度大。
- tauri 自身 52 个测试集中在 ipc/authority（434 行覆盖）、format_callback、scope/fs、state、path/ohos（81 行覆盖）等纯逻辑模块，而本批 diff 恰好落在 menu/window/runtime-wry 等无 OHOS 单测的模块 → 本批口径 0%。

### 未覆盖行定性分类（本批口径 13400 行中）

| 类别 | 预估行数 | 描述 |
|---|---:|---|
| NAPI/env 桥接调用 | ~5000 | `into_bridge_value`/`from_bridge_value`/`decode`/`respond`，需 NAPI Env |
| 窗口/webview 运行时 | ~3500 | `Window::new`/`create_os_window`/webview 创建/controller attach，需 ArkTS runtime |
| bridge worker/线程 | ~2500 | `dispatch_bridge_call`/`block_bridge`/`BridgeExecutor::spawn`/事件监听 |
| 静态初始化/OnceLock | ~800 | `set_ohos_app`/`set_menu_client` 等全局单例 |
| 注释/文档/日志 | ~1200 | diff 中的 doc comment 与 `log::info!`/`eprintln!` |
| serde/配置胶水 | ~400 | `#[napi(object)]` 生成代码、derive 实现 |
| 纯逻辑（理论可测） | ~0 | 可达纯函数已被现有测试或本轮新增测试覆盖 |

### 95% 目标结论

- 纯单测口径下 **95% 不可达**：结构性不可测（NAPI 桥接+窗口系统+线程基建）占 diff 绝对主体，且历史纯函数在 fork 基线中已被测试覆盖、不在增量 diff 内。
- 突破路径不变：bridge 层 trait 抽象 + mock（架构改动），或 hap 内嵌集成测试（ArkTS runtime 下跑 bridge 路径）。
- 应用层接口覆盖（见第二节 98.3%）与 UT 行覆盖率是互补口径：前者回答"用户用到的接口是否被测过"，后者回答"新增代码有多少行被 UT 执行"。

### 可执行行口径（2026-08-22 补充，用户定义：只统计代码行，注释/空行不算；examples/ 等 demo 不计入）

llvm-cov 只对可执行行（有 DA 计数器的行）产出数据，diff 里的注释/空行/大括号永远不可能"被覆盖"。按"diff 非测试行 ∩ 可执行行"重算团队口径。**另按用户确认：`tauri/examples/api` 与 oha `rust_example` 属测试 demo，从一切口径的分母中剔除**（可执行行口径天然满足——demo 未编译进 UT 二进制无 DA 记录；raw 口径的 tauri 分母应减 ~2511 行 examples/api）。

| 仓库 | 可执行非测试行 | 覆盖行 | 覆盖率% |
|---|---:|---:|---:|
| muda | 503 | 293 | 58.3% |
| tray-icon | 791 | 350 | 44.2% |
| openharmony-ability | 4353 | 907 | 20.8% |
| tao | 1305 | 168 | 12.9% |
| window-vibrancy | 101 | 10 | 9.9% |
| wry | 773 | 39 | 5.0% |
| tauri | 5249 | 24 | 0.5% |
| plugins-workspace | —（无测试二进制，DA 无数据） | 0 | — |
| **合计** | **13075** | **1591** | **12.2%** |

注：raw 非测试行 41168 → 可执行行 13075（排除注释/空行/括号 ~16000、not-in-binary ~12100）。tauri 仓 in-binary 的 13273 行里只有 5249 可执行——旧 raw 口径被注释严重稀释。数据 `jobs/97f58082/tmp/exec-analysis.json`、`uncovered-fns.json`（函数级）。

### S1 基线：hap 插桩全量跑（2026-08-23，路径 A 落地）

UT lcov + app .so lcov（插桩 hap 跑 283 用例自动测试）按 per-line max 合并后，同一可执行行口径重算：

| 仓库 | 可执行非测试行 | 覆盖行 | 覆盖率% | 较 UT-only |
|---|---:|---:|---:|---:|
| muda | 503 | 478 | 95.0% | +36.7pt |
| window-vibrancy | 101 | 82 | 81.2% | +71.3pt |
| tray-icon | 791 | 639 | 80.8% | +36.6pt |
| openharmony-ability | 4425 | 2624 | 59.3% | +38.5pt |
| wry | 773 | 437 | 56.5% | +51.5pt |
| tauri | 5502 | 2756 | 50.1% | +49.6pt |
| tao | 1305 | 635 | 48.7% | +35.8pt |
| plugins-workspace | 1062 | 517 | 48.7% | —（纯 app 来源） |
| **合计** | **14462** | **8168** | **56.5%** | **+44.3pt** |

- **12.2% → 56.5%**（分母 13075 → 14462：app .so 使原 not-in-binary 行获得 DA 记录，其中 pw 1062 行首次进入口径）。
- 附带修复：TestRunner.svelte `allTests` 漏挂 `windowOpsTests`（11 个用例三周未执行）——已挂载，283 用例 281✅/1❌（#86 剪贴板读权限，已知）/1⏭️（#271 haptics 无振动器），windowOpsTests 11/11 全过（含预估可能失败的 #144 inner_size）。
- 复现链路：`cov-build.sh`（插桩构建+签名+安装+90s 自动测试）→ `jobs/97f58082/tmp/s1-recover.sh`（回收 profraw→profdata→app.lcov）→ `s1-exec.py`（八仓合并计算）。数据 `s1-cov/s1-exec.json`、函数级 `s1-cov/uncovered-fns-s1.json`。
- 预估校准（design.md §一）：实测 56.5% vs 预估 ~60%，偏差 <5pt → **S2-S5 预估维持不变**（S2 后 72-75%、S5 终态 87-90%）。

### S2 基线：driver 盲调用套件（2026-08-23）

在 S1 的 283 用例外追加 driver 盲调用套件（209 SAFE + 17 SIDE side-replay，由 `jobs/97f58082/tmp/gen-driver.py` 生成 → `src/lib/tests/driver-generated.ts`），盲调用语义：执行即覆盖，错误被吞但错误分支被点亮；NOT_IMPLEMENTED 正则 → skip。门控 `VITE_AUTOTEST`（仅覆盖率插桩构建包含，普通 demo 构建保持原 283 用例行为）。完整跑通 519 行报告（491✅/3❌/15⏭️；3 失败均已知：#86 剪贴板平台限制、geolocation requestPermissions 挂起专项、dialog 需人工交互）。

| 仓库 | S1 覆盖率 | S2 覆盖率 | Δ |
|---|---:|---:|---:|
| muda | 95.0% | 95.4% | +0.4pt |
| tray-icon | 80.8% | 81.0% | +0.2pt |
| window-vibrancy | 81.2% | 81.2% | 0 |
| plugins-workspace | 48.7% | 63.9% | **+15.2pt** |
| openharmony-ability | 59.3% | 63.5% | +4.2pt |
| wry | 56.5% | 60.0% | +3.5pt |
| tauri | 50.1% | 57.9% | +7.8pt |
| tao | 48.7% | 56.0% | +7.3pt |
| **合计** | **56.5%** | **62.8%**（9076/14462） | **+6.3pt** |

- **盲调用快速饱和**：S2 实得 +6.3pt vs 预估 +16-19pt。表面调用路径一轮即点亮，深层分支（错误处理/查找失败/参数校验）需坏输入（S3）与故障注入（S4）触发。**S3-S5 预估重定基线**：S3 +5-8pt、S4 +3-5pt、S5 +2-4pt，终态 73-80%。
- diff_exec≥5 未覆盖函数 799 → 759（-5.0%，原目标减半未达成）。
- **两轮踩坑（已入 gen-driver.py EXCLUDED，共 10 项）**：① `test_navigate`/`test_reload` 导航/重载主窗口 SPA，runner 卸载静默死；② `close_test_window` 签名注入 `window=调用者窗口`（无 windowId 参数），从主窗口调=关闭主窗口自己——报告冻结在套件首个调用处即此症状。子窗口清理改用 JS `Window.destroy()`。
- **ACL 权限修复**：run-app.json 补 12 项权限（core:window destroy/badge/size-constraints、core:webview zoom/focus/auto-resize/clear-browsing-data、fs 读写文本、shell spawn、sentry panic）——盲调点位此前在 IPC 边界被 ACL 拒（14 处），Rust 命令体未执行；修复后 ACL 拒绝清零。
- 复现链路：`cov-build.sh`（VITE_AUTOTEST=true）→ 设备自动跑 226 用例 → `jobs/97f58082/tmp/s2-recover.sh` → `exec-analysis-merged.py`/`fn-analysis-merged.py`。数据 `s2-cov/s2-exec.json`、`s2-cov/uncovered-fns-s2.json`，报告 `s2-test-report.md`。

### S3 基线：坏输入错误用例（2026-08-23，增益 ~0，重要负结论）

按 design.md §三矩阵生成 26 个坏输入用例（serde 类型错 7 / 幽灵 label lookup 6 / 越界值 6 / 不可达 URL 路径 5 / 权限拒绝 2），全套 535 用例完整跑通（513✅/2❌/20⏭️）。

**结果：62.7%（9071/14462），与 S2 62.8% 持平**。文件级 diff 显示跑间方差 ±5 行（geolocation mobile.rs 7→1：S2 轮权限弹窗挂起 5s 点亮了更多行，S3 轮权限已授权快速成功），坏输入用例真实增益仅 +3-4 行。

**根因（设计前提修正）**：driver 盲调用的 `blind()` 语义是"吞掉错误但执行"——幽灵 label、不存在路径、非法值本就是盲调常态。**JS 可达的错误分支在 S2 已全部点亮**，无需专门坏输入用例。剩余未覆盖错误分支为 **bridge 失败类**（ArkTS 侧返回错误码/异常/超时，Rust 的 `if let Err` handler 体需要对端真实返回错误）——只能靠 S4 故障注入触发。

**终态预估再修正**：62.8% + S4（量级待设计评估，原估 +3-5pt）+ S5（形态专属分支 +2-4pt）≈ **65-72%**（S2 时预估 73-80% 再下调）。

复现链路同 S2（`s3-recover.sh`/`s3-cov/s3-exec.json`/`s3-test-report.md`）。

### S4 基线：fault-injection 故障注入（2026-08-23，+0.1pt，预估再度大幅虚高）

走 design→audit→apply→build 全流程（设计文档 `openspec/changes/ohos-coverage-rampup/s4-fault-injection-design.md`，52 用例 7 组）。机制：ArkTS `FaultInjectionRegistry`（BridgeHost dispatch 层注入 error/exception/delay/timeout）+ Rust `set_fault_rule`/`clear` 命令（feature `fault-injection` 全门控，产线零代码）。52 用例 **50✅/2❌**（2 失败为通配规则用例 5s 超时），全套 587 用例 562✅/5❌/20⏭️（5 失败 = 3 已知 + 2 通配超时）。

**结果：62.9%（9190/14616），vs S2 62.8% 仅 +0.1pt**（设计预估 +2.7pt，虚高 3.4 倍）。真实增益拆解（文件级 + per-line diff）：

- 旧代码增益 +53 行（wry ohos/mod.rs +19、tauri-runtime-wry +13、oha plugin-webview +11、tao +4、tauri +5），其中**显式错误构造行仅 7 条 0→1**（bridge attach_promise catch、wry ×4、tauri-runtime-wry、tauri webview/plugin）
- 另 +63 行为 S4 自身新代码被执行（oha bridge/mod.rs/app.rs 的 facade/wire 体）；分母 +154（新 Rust 代码入 diff 口径，fault_injection.rs 未跟踪文件不计）

**预估虚高根因**：① 错误 handler 体仅 1-3 行（`map_err` 闭包单行已覆盖、`?` 传播不增行），非设计设想的多帧级联；② uncovered-fns 剩余错误分支多在 52 个注入点可达路径之外；③ 每用例 ~7 exec 的行数估算无实证依据。

**显式错误构造行覆盖**（`err-analysis.py`，行匹配 `Err(|map_err|ok_or|bail!|anyhow!|panic!|.expect(|.unwrap()` 的 diff 可执行行）：**62.1%（502/809）**，达 ≥60% 验收线——但需诚实标注：S2 已 61.8%（设计"从 ~0 起"前提有误，"~0"只对 uncovered-fns 深层函数成立）。

**产线验证**（`prod-verify-s4.sh`，feature=prod 独立 target-prod 构建）：nm 查 `fault_injection|FaultRule` 符号 = 0、`__llvm_prf` = 0；对照插桩 .so fault 符号 = 48。注意 `src-tauri/.cargo/config.toml` 无条件带 `-Cinstrument-coverage`（覆盖率基建产物，真实产线 cargo tauri build 由 ohrs 的 CARGO_ENCODED_RUSTFLAGS 接管不受影响），验证时须移开该文件。ArkTS 侧 FaultInjection.ets 按设计恒编译，产线运行时 `enabled=false` 首行短路。

**S4 踩坑（新 ACL 陷阱）**：app 自定义命令的 ACL 权限需手工登记在 `examples/api/src-tauri/build.rs` 的 `AppManifest::commands` 列表（cfg 门控命令不会自动生成权限）——漏登记 = 运行时 `not allowed by ACL`、整段用例静默 skip（52 用例首轮全 skip）。需 build.rs 登记与 `run-app.json` 授权两处同步。另修复 cov-build.sh `cargo|tee` 无 pipefail 吞退出码（cargo 失败后仍继续装旧 .so）。

**终态预估**（S4 后再修正）：62.9% + S5（mobile 形态合并，原估 +2-4pt 按递减规律实际或 +1-2pt）≈ **64-67%**（S3 时预估 65-72% 再收窄）。

复现链路：`cov-build.sh` → `s4-recover.sh` → `exec-analysis-merged.py`/`err-analysis.py`；数据 `s4-cov/`（s4-exec.json/s4-err.json/s4-test-report.md）。

### S5 基线：mobile 形态插桩合并（2026-08-23，+0 行，形态增量结论闭环）

mobile hap 构建链路补 3 个缺口后打通（cov-build.sh `OHOS_DEVICE_TYPE=mobile`）：① 根 `gen/ohos/build-profile.json5` modules 数组无 entry_mobile——正常由 tauri-cli `write_build_profile_modules` 重写，cov-build.sh 绕过 tauri-cli 需自做 module swap（已内置）；② entry_mobile/oh_modules 从未安装 → CompileArkTS 24 个 arkts-no-any-unknown 错，`ohpm install` 解决；③ `entry_mobile/build-profile.json5` strip:true→false（剥符号破坏 llvm-cov 映射）。同套 587 用例在 mobile 上 351✅/138❌/98⏭️（❌ 大头是 "Plugin not found: window"——window/tray 等 desktop 形态专属 bridge 在 mobile 上不存在，预期非回归）。

**结果：62.9%（9190/14619），与 S4 完全持平——mobile 形态新增覆盖 0 行**（错误行口径同 62.1%，502/809）。根因已闭环验证：**全八仓 Rust diff 中 cfg(mobile) 专属行 = 0**——所有形态门控均写作 `cfg(any(mobile, target_env = "ohos"))`，desktop 形态编译时同样包含这些行；形态差异只存在于 ArkTS entry 模板（entry_mobile vs entry_desktop）与 bridge 注册面，均在 Rust lcov 口径之外。mobile 独有覆盖行 143 行全部位于 reqwest/tokio 等上游依赖（diff 口径外）。

**S5 踩坑（merge 语义）**：三来源合并（UT + desktop app + mobile app）用 per-file per-line max，**必须保留 count-0 的 DA 行**——首版 `if cnt > old` 把 0 计数行丢掉（0 > 0 = false），分母缩 566 行，假涨到 65.4%（plugins-workspace 甚至显示 100%）。修正为 `if ln not in m or cnt > m[ln]`。0 计数行是 exec 分母的一部分。

复现链路：`OHOS_DEVICE_TYPE=mobile bash cov-build.sh` → `s5-recover.sh` → `merge-app-lcov.py`（desktop+mobile app.lcov）→ `exec-analysis-merged.py`；数据 `s5-cov/`（app.lcov=mobile、merged-app.lcov、s5-exec.json、s5-test-report.md）。

### S6 基线：休眠纯函数直补 UT（2026-08-24，+458 行 / +3.1pt）

S5 收官后对剩余 5429 未覆盖行做函数级休眠分析（uncovered-fnlevel3.py，**三来源合并口径**——教训：仅用 app lcov 会把 UT 已覆盖行误判为休眠，keycodes to_logical 曾被误报休眠 198 行，实际 UT 已覆盖 163 行）。休眠构成：55% 整函数零覆盖（2949 行）、45% 部分覆盖（2480 行）。其中「纯函数/纯变换逻辑 + 无 NAPI 依赖」桶约 ~250-350 行可用普通 Rust UT 直补，不依赖 driver/注入。

**新增 34 用例（4 crate，设备侧全绿）**：

| crate | 用例 | 目标休眠函数 | 增量 |
|---|---|---|---|
| tao | 20（input_tests） | handle_input_event(148) / handle_mouse_event(62) / handle_axis_event(38) | tao +246 行 |
| tauri-runtime-wry | 4（with_config_tests） | with_config(63) | tauri +159 行（含该 crate 测试二进制首次纳入 UT 口径） |
| openharmony-ability | 9（mouse_event） | From/impl 纯变换 + callback setter | oha +53 行 |
| tauri | 1（debug_app_icon） | DebugAppIcon(2) | （计入上行的 tauri +159） |

**结果：66.0%（9648/14619）**。方法：cov-run.sh 重跑三仓插桩 UT（tao 69✅ / oha 65✅ / tauri 53✅ / runtime-wry 4✅）→ exec-analysis-merged.py 复算。**踩坑**：tauri-runtime-wry 的测试二进制名是 `tauri_runtime_wry-<hash>`（下划线），原 BINPAT `tauri-*`（连字符）匹配不到，该 crate 的 UT 覆盖此前从未进过口径——已改为 `tauri*`。tao +246 与目标函数休眠行数（248）几乎完全吻合，验证直补的精确性。

**S6 校准**：调研期 +6-8pt 预估基于单源分析（虚高），三源合并后真实可直补空间 ~1200 行中的低成本首桶即此 +458 行；剩余直补空间（driver 套件补 window ops ~100 行、doc A 桶 ~494 行）仍可再做但边际递减。

### S10 基线：api-gap 接口面补测批 29 例（2026-08-24，**70.4% = 10123/14377**，+0.3pt）

**终态结果：70.4%（10123/14377），较 S9 +42 行**。与 S1-S9 的"行覆盖"主线不同，S10 以**接口（handler）覆盖**为目标组织补测：先建 API 面覆盖率测量（`cov-tools/api-coverage.py`，capability 授权命令 × handler FNDA，与行覆盖共用同一条 cov-build.sh 插桩链），83.7% 起四轮补测到 97.0%，行覆盖随之 +42 行。报告：`s9-cov/s10-coverage-report.md`。

**API 面（S10 新口径，s9-api-coverage.md）**：分母 = capability 授权命令 ∩ 编译进 libapi_lib.so 的 handler 函数 = 264；分子 = desktop 套件运行期 handler FNDA>0（JS invoke 与 demo 探针命令同计）。S9 时点 221/264 = 83.7% → api-gap 批 29 例四轮递进（R1 94.7% → R2 95.5% → R3 95.8% → R4 97.0%）→ **256/264 = 97.0%**。剩余 8 条全部设计豁免：dialog open/save（系统对话框）、huawei-account login（账号 UI）、process exit/restart（执行即杀测试进程）、updater download/download_and_install/install（需服务端）。

**新增接口口径（S10 新建，`cov-tools/api-coverage-incr.py` → s10-api-incr-coverage.md）**：分母收窄为 handler 函数定义行落在 `fork..HEAD` diff 新增行集合内的命令（即 OHOS 适配 diff 引入/改写的命令面）= 41，分子 35 → **85.4%**；未执行 6 条与 API 面同一批豁免——**可测新增接口 35/35 = 100%**。

**+42 行归属**（R4 desktop app lcov 换入；分母 14377 与 S9 逐位一致，UT/mobile 复用 S9 产物——S9 后生产代码零变更，源文件 mtime 逐仓核对早于 UT 跑测时间）：tauri +30（core:path 纯函数 extname/normalize/resolve、core:webview set_webview_auto_resize/reparent/create_webview*、core:window internal_toggle_maximize/set_simple_fullscreen、core:menu set_as_*、core:app hide/show/set_dock_visibility、event emit_to）、plugins-workspace +12（fs write/read_text_file_lines(_next)、geolocation watch_position/open_location_settings、notification request_permission/remove_active、http fetch_cancel×2）。

**三坑实录**（R2 fs 三连 FNDA=0 拖两轮才定位的根因，均已实证）：

1. **appCacheDir() 返回值无尾斜杠**：模板串 `${await path.appCacheDir()}api-gap.bin` 拼出 `.../cacheapi-gap.bin`——逃出 `$APPCACHE/**` scope，fs 命令报 forbidden path。scope 拒绝发生在 handler 之前，FNDA=0 连错误分支都不亮。必须显式加 `/`
2. **PositionOptions 三字段必填**：enable_high_accuracy/timeout/maximum_age 无 `#[serde(default)]`，JS 传 `{}` 反序列化失败 → handler 不执行。补测前先查 Rust 侧 Option 结构体有无 serde default
3. **批末必须 flush_console_log**：console-capture 全局 patch → Rust 环形缓冲（1000 条），最后一次 flush 在 ops2 批——api-gap 批排其后，错误日志滞留内存两轮不可见。每个新批末尾补 flush gapCase

**方法论沉淀**：盲调用"执行即覆盖"语义 ≠ 错误不可见——用例 err 必须落 console（步级日志更佳）+ 批末 flush，否则 FNDA=0 的排查全靠猜。另须区分两类失败：handler 内部错误（FNDA>0，错误分支亮）vs pre-handler 失败（ACL 拒绝/参数反序列化失败，FNDA=0）。

**分仓（S10 终态）**：tauri 67.2（+30 行）/ tao 79.0 / wry 68.3 / muda 95.4 / tray-icon 80.8 / window-vibrancy 81.2 / openharmony-ability 68.6 / plugins-workspace 64.9（+12 行）——除 tauri/plugins 外六仓与 S9 逐位一致。

### S9 基线：driver window ops + Debug fmt 两批 + probe 补漏（2026-08-24，**70.1% = 10081/14377**，+2.3pt）

**终态结果：70.1%（10081/14377），较 S8 +328 行，跨过 70% 目标线**（需 10064 行）。分三轮递进：round 1 driver 批被 ACL 拦（+8）→ round 2 ACL 修复后 +195（69.2%）→ round 3 probe 补漏批 +133（70.1%）。

**三批增量**：

1. **driver 批（window-ops-extra.ts，8 用例逐调用吞错）**：monitors 五连（currentMonitor/primaryMonitor/availableMonitors/monitorFromPoint/cursorPosition）、setProgressBar 全 5 状态、setTheme×3、setVisibleOnAllWorkspaces、setTitleBarStyle、setFocus/setFocusable（主窗+Float 窗）、setCursorIcon/setCursorPosition、startDragging/startResizeDragging、setEffects/clearEffects。与 window-ops.ts 的 smoke() fail-fast 不同，逐调用吞错避免一个 op 失败连坐其余
2. **fmt 批（UT，2 处）**：runtime-wry WindowBuilderWrapper Debug（+7 行，宿主可构造 via with_config）、tao OsError Display（+3 行）。Context/Wry/WindowWrapper 三个 fmt 需活运行时，不做
3. **probe 补漏批（round 3，+133 行）**：JS API 面未暴露、仅 Rust 侧可达的方法，经 4 个 demo 探针命令（src-tauri/src/probe_apis.rs，双登记 build.rs+capabilities）点亮——`probe_app_monitors`（AppHandle monitor 四连，app.rs 860-1035 区点亮 60/72=83%）、`probe_app_menu_set_remove`（app.rs set_menu/remove_menu 完整往返：set prev=false → remove prev=true）、`probe_window_menu_set_remove`（window/mod.rs 1380-1476 菜单区点亮 34/35=97%，含 OHOS menubar 分支）、`probe_webview_reparent`（wry Webview::reparent 错误分支——OHOS 预期行为即报错，覆盖目的即在此）。另补 `setIcon(合法 1x1 PNG)`：此前 4 字节/空数据均败于 "failed to process image"，合法 PNG 走通派发函数（setIcon(valid png):ok）

**过程中修掉的一个真实配置缺陷（demo 侧）**：`capabilities/run-app.json` 漏登记 8 项 core:window 权限（current-monitor/primary-monitor/available-monitors/monitor-from-point/cursor-position/set-visible-on-all-workspaces/set-title-bar-style/start-resize-dragging）→ 第一轮全部被 ACL 静默拒绝（配合测试的 .catch(()=>null) 伪装成"成功返回 null"）。补登记后 currentMonitor 返回真数据（OpenHarmony Device 3120x2080@1.9x）、availableMonitors count=1。教训复刻 [[ohos-coverage-s1-baseline]] 的 ACL 双登记陷阱：**测前先对 capability 清单与 JS API 面做 diff，漏登记的表现是静默跳过不是报错**

**两疑点定论**（S8 覆盖数据反推，本轮设备数据验证）：

- 疑点 1"currentMonitor 静默返回 null"——**属实，根因 = ACL 漏登记**（如上），非 manager 层短路。已修复验证
- 疑点 2"decoration smoke 连坐饿死"——**推翻**。S8 里 setFocusable 派发入口本就覆盖（2615-2623 亮），黑的是主窗口 ohos_window_id≤0 的设计内早退分支（return Ok(()) no-op）+ send_user_message fallback。本轮 Float 子窗口（label 需 test- 前缀才过 ACL）上调用点亮了真实 OHOS bridge 路径（ohos_window_spawn set_window_focusable）

**无法点亮的 OHOS 命令注册面（属上游设计，不改）**：setBadgeLabel（#[cfg(target_os="macos")] 注册）、setOverlayIcon（#[cfg(target_os="windows")]）——OHOS 上命令不注册，JS 调用报错，对应 ~45 行 Rust 永远黑。setIcon 已由合法 PNG 用例点亮（round 3）。

**测量细节**：本轮 595 用例超过 90s autotest 窗口，profraw 由套件末尾 dump_coverage 重写（mtime 晚于 cov-build 检查点），需以设备上最终文件为准重拉。分仓增量（S8→S9 终态）：tauri 62.5→66.6（+228，driver 批+probe 批主体）、tao 74.9→79.0（+54）、wry 66.1→68.3（+17）、oha 67.9→68.6（+31）、tray-icon -2（噪声）。

**分仓（S9 终态）**：tauri 66.6 / tao 79.0 / wry 68.3 / muda 95.4 / tray-icon 80.8 / window-vibrancy 81.2 / openharmony-ability 68.6 / plugins-workspace 63.8。

**口径校准注记（S9 后发现，不改官方数字）**：`git diff -U0`（S1-S9 全程口径）在 tauri 仓含大量**纯迁移噪声**——OHOS 改动把 runtime-wry lib.rs / app.rs / tauri lib.rs 等大文件里的代码块挪了位置，git diff 把"搬家"表示成"删除+重加"，这些逐字节未变的上游行被计入我们的分母。量化：tauri 分母 5474 中 ~4272 行（78%）是迁移行（app.rs diff 2722 新增行里 2414 行与删除行内容完全一致，真实新代码仅 ~94 行）；这些迁移行大多被覆盖（-2769 cov），故噪声实际**压低**了报告值。`git diff -U0 -w` 口径复算（脚本 exec-analysis-merged-w.py，数据 s9-cov/s9-exec-w.json）：tauri 73.0%（+6.4pt）、TEAM **72.4%**（10046 分母中 7269 覆盖），其余七仓差异 ≤0.2pt（其 OHOS diff 是干净的增量式改动，零迁移噪声——铁律#2 纪律的旁证）。setBadgeLabel/setOverlayIcon 的 ~45 行永黑即属此噪声（-w 下自然出分母）。**决定保持 plain 口径为官方值**：S1-S9 全程一致可比、且偏保守（70.1% ≤ 真实 72.4%）；-w 数字留作参考。

### S8 基线：全量重测（UT 7 仓 + desktop/mobile hap 重建，2026-08-24，67.8% 定稿）

**结果：67.8%（9753/14377）**——迄今最干净的一次测量：三源（UT profdata / desktop app lcov / mobile app lcov）全部由**同一工作树状态**构建，旧 hash 二进制已清理，无任何跨状态伪影。

- **UT 侧**：7 仓 cov-run 全量重跑，全绿 0 失败（tauri 60 / runtime-wry 14 / tao 69 / wry 39 / muda 88 / tray-icon 66 / window-vibrancy 17 / oha workspace 全过）
- **hap 侧**：desktop + mobile 两种形态各重建插桩 hap（含死代码删除后的工作树）、部署、真机跑全量 587 自动测试、profraw 回收（desktop 45MB）→ app.lcov（desktop 3600 SF / mobile 3522 SF）→ merge-app-lcov 合并
- **死代码删除的分母收益本次兑现**：oha -93 行（mouse_event.rs）、tauri app.rs 分母修正。tauri 总体 57.8%→62.5% 的跳升中约 4.5pt 是 S7 混编号伪影的消除（见下），非真实增量
- **S7 的 65.6% 含"混编号"伪影**：S7 复用了 S5 时代 app lcov（按删除前行号出 DA）+ 当日 UT 二进制（按删除后行号出 DA），两套错位行号的并集把 app.rs 分母虚推到 1294（真实 840）。S8 重建 app 后三源编号一致，伪影消失
- **run-to-run 噪声**：wry -17 / tao -4 / oha -12 / tray-icon +2 覆盖行的小幅波动，来自 587 用例中时敏用例的通过差异，属正常

**分仓（S8 终态）**：tauri 62.5 / tao 74.9 / wry 66.1 / muda 95.4 / tray-icon 81.0 / window-vibrancy 81.2 / openharmony-ability 67.9 / plugins-workspace 63.8。

### S7 基线：适配层映射 UT + NAPI 死代码删除 + 口径再校准（2026-08-24，+144 行 / +1.0pt）

**结果：65.6%（9792/14924）**。三部分工作：

1. **纯变换 UT 22 例**（全绿）：runtime-wry `mod mapping_tests` 10 例（CursorIcon 34 变体、Theme/ProgressBar/DeviceEventFilter/DPI/Rect 包装映射，+53 行）；tauri image `decode_base64_tests` 6 例（全字符类，+1 行——大部分已被 app lcov 点亮，UT 主要贡献回归保护）；tauri app.rs `runtime_window_event_maps_all_variants` 1 例（8 个 From 臂 + DragDrop，+8 行）；wry ohos `https_intercept` 5 例（协议 passthrough/内联响应/responder-drop 快速返回，+45 行）；oha plugin-webview callbacks 5 例（options 派生 + 三个 decision 函数全分支，+30 行）。
2. **NAPI 死代码删除（审计定论：3 DEAD / 12 LIVE-BUT-UNTESTED / 0 HALF-WIRED）**：删 `send_tao_window_event`、`ohos_plugin_register`（tauri app.rs）及 oha mouse_event.rs 的 legacy NDK 回调全套（extern FFI 声明、thread-local dispatcher、register_mouse_callbacks 等 ~230 行）。保留 MouseEventData/AxisEventData 类型与 InputEvent::AxisEvent 变体（经 ArkTS 未来接线回归保护）。LIVE-BUT-UNTESTED 的 12 个（bridge dispatch/run、node new、on_main_thread_event 等）因 ArkTS ABI 必须保留。删除的分母收益需 commit + app 侧重编后才完全体现（app lcov 仍按行号并集提供旧 DA）。
3. **口径再校准（重要）**：S6 的 66.0% 含两处测量缺陷——(a) tauri UT 二进制早于 08-22 14:33 emit/Channel commit，app.rs 行表缺 426 行 → 分母少算；(b) oha target-cov deps 残留 08-22 旧 hash 二进制，llvm-cov 按旧行表输出 count=0 的 DA → 分母虚增 ~119 行。修正后 S6 真实基线为 **64.6%**（9648/14926），S7 = 65.6%（9792/14924）= **真实 +1.0pt**。教训：**cov-run 后必须清理 target-cov deps 中旧 hash 测试二进制**（BINPAT glob 会同时命中新旧两份）。

**分仓（S7 后）**：tauri 57.8（分母修正所致，cov 实际 +62）/ tao 75.2 / wry 68.3（+5.8）/ muda 95.4 / tray-icon 80.8 / window-vibrancy 81.2 / openharmony-ability 66.8（+2.6）/ plugins-workspace 63.8。

### 终态总结（S1-S10 最终基线，2026-08-24 定稿）


| 阶段 | 手段 | 覆盖率 | 增量 | 原预估 |
|---|---|---:|---:|---:|
| UT 基线 | 设备侧 cargo test（337 用例 9 crate） | 12.2% | — | — |
| S1 | hap 插桩全量跑（路径 A） | 56.5% | +44.3pt | — |
| S2 | driver 盲调用 209+17 用例 | 62.8% | +6.3pt | +16-19pt |
| S3 | 坏输入错误用例 26 个 | 62.7% | −0.1pt | +5-8pt |
| S4 | 故障注入 52 用例（ArkTS registry + feature 门控） | 62.9% | +0.1pt | +2.7pt |
| S5 | mobile 形态合并 | 62.9% | 0 | +2-3pt（S3 时）/ +1-2pt（S4 时） |
| S6 | 休眠纯函数直补 UT（34 用例 4 crate） | 66.0%* | +3.1pt | +6-8pt（调研时未做 3 源合并的虚高估算） |
| S7 | 适配层映射 UT 22 例 + 死代码删除 | 65.6%* | +1.0pt（S6 修正基线 64.6% 起算） | — |
| S8 | 全量重测（UT 7 仓 + 双形态 hap 重建） | **67.8%** | 定稿 | — |
| S9 | driver window ops + Debug fmt + probe 补漏三批（+328 行） | **70.1%** | +2.3pt | ACL 漏登记 8 项修复 + probe 双登记 |
| S10 | api-gap 接口面补测批 29 例（+42 行） | **70.4%** | +0.3pt | API 面 83.7%→97.0% 四轮；可测新增接口 35/35 |

*S6/S7 数字各含测量缺陷（S6 旧二进制缺陷、S7 混编号伪影），S8 三源同状态重建后为可信定稿。

**分仓终态（S10 后）**：tauri 67.2 / tao 79.0 / wry 68.3 / muda 95.4 / tray-icon 80.8 / window-vibrancy 81.2 / openharmony-ability 68.6 / plugins-workspace 64.9。错误构造行口径 62.1%（502/809，S5 时点）。

**原 87-90% 目标失效的根因链**（逐阶段归档）：

1. **S1**：路径 A 从 12.2% 直跳 56.5%——hap 插桩把 UT 触不到的运行时链路（bridge/webview/window 全链）一次点亮，但也把"表面路径"吃完了。
2. **S2**：盲调用快速饱和——JS 可达表面一轮点亮后，深层分支需要坏输入/故障注入才能触达（+6.3pt vs 预估 +16-19pt）。
3. **S3**：坏输入零增益——blind() 语义=吞错但执行，幽灵 label/非法值本就是盲调常态，JS 可达错误分支 S2 已全亮；剩余错误分支是 bridge 失败类，JS 侧构造不出来。
4. **S4**：故障注入 +0.1pt——错误 handler 体仅 1-3 行、`?` 传播不增行；注入点之外的错误分支仍不可达。
5. **S5**：形态零增量——Rust diff 无 cfg(mobile) 专属行，两形态编译产物在 diff 口径内等价。
6. **S6**：直补 UT +3.1pt——休眠纯函数（无 NAPI 依赖的纯变换）直补是 driver/注入/形态之外唯一仍高 yield 的手段；前提是**三源合并的休眠分析**（单源分析会把 UT 已覆盖行误判为休眠，keycodes 教训）。

**诚实结论**：本口径（fork 点..HEAD 非测试 diff 可执行行 ∩ 三来源 lcov）经阶段式爬坡后，driver/注入/形态三类手段的可达上限是 **~63%**（S5 时点）；S6 证明第四类手段——休眠纯函数直补 UT——仍能再拿 +3.1pt，当前 66.0%。剩余 ~34% 未覆盖行的构成为：错误/失败分支深水区（bridge 失败、平台错误码，注入点外）、一次性 init 生命周期分支、版本门控另一侧、防御性 unreachable、真环境前置（AppGallery 更新源/系统打印对话框等）、NAPI 绑定面（node.rs/bridge dispatch 等需 ArkTS 运行时）。按 design.md §六排除清单估算（~1000-1500 行）剔除后约 **69-70%**——与原 95-98% 预估差距的本质是**该预估基于"错误分支可用测试点亮"的假设，而实际错误分支在运行时桥接架构下大多只能靠注入且注入 yield 极低**。

### 附录：排除清单口径（design.md §六，S5 后定稿）

| 类别 | 估行数 | S5 后状态 |
|---|---|---|
| 一次性 init 失败分支 | ~300-400 | 成立（set_ohos_app 二次 set、OnceLock 已初始化等进程生命周期内不可重放） |
| 版本/形态门控另一侧 | ~400-600 | **形态侧已消失**（S5 证明无 cfg(mobile) 专属行）；仅剩 sdk_api_version 门控另一侧 |
| 防御性 unreachable | ~100-200 | 成立 |
| 真环境前置 | ~200-300 | 成立（AppGallery 真实更新源、系统打印对话框取消路径、系统级拖拽） |
| 合计 | ~1000-1500 | 62.9% → 剔除后 ~66-67% |

### 附录：S1-S5 复现命令汇总

```bash
# 插桩构建 + 装 + 跑（desktop；mobile 加 OHOS_DEVICE_TYPE=mobile）
bash cov-build.sh [device_sn]

# profraw 回收 → profdata → lcov（每阶段一份 recover 脚本，见 jobs tmp）
bash s5-recover.sh          # 输出 s5-cov/app.lcov

# 三来源合并（UT 各仓 profraw 已由 cov-run.sh 产出）
python merge-app-lcov.py s4-cov/app.lcov s5-cov/app.lcov s5-cov/merged-app.lcov

# 官方口径分析
python exec-analysis-merged.py s5-cov/merged-app.lcov   # 总口径
python err-analysis.py s5-cov/merged-app.lcov           # 错误构造行口径

# 产线零影响验证（feature=prod 独立 target + nm 查符号）
bash prod-verify-s4.sh
```



### UT 可补覆盖文件清单（可执行行口径，2026-08-22 函数级分析）

**A. UT 直接可补（纯逻辑，设备侧 target 可跑，共 ~494 可执行行 → 补完合计约 16.0%）**：

| 仓 | 文件 | 可补内容 | 行数 |
|---|---|---|---:|
| oha | `crates/plugin-webview/src/callbacks.rs` | 4 个 decision 纯函数（navigation/download_start/https_intercept/new_window）+ WebviewCallbacksBuilder 全套 setter/build + options/is_empty/options_for | ~140 |
| oha | `crates/ability/src/input/mouse_event.rs` | From/Default/hover 纯转换（dispatch_*/register_* 需 bridge 不算） | ~66 |
| oha | `crates/plugin-webview/src/protocol.rs` | scheme_registration_needed（ProtocolState 纯状态机）+ 部分 install/registry 逻辑 | ~80 |
| oha | `crates/plugin-statusbar/src/lib.rs` | serde round-trip + Default/Clone | ~50 |
| oha | `crates/plugin-menu/src/lib.rs` | 剩余 serde 分支 | ~30 |
| tao | `src/platform_impl/ohos/keycodes.rs` | 剩余 match 臂 | ~35 |
| tao | `src/platform_impl/ohos/mod.rs` | ohos_mouse_button_to_tao 纯映射 | ~10 |
| tray-icon | `src/platform_impl/ohos/mod.rs` | menu_to_status_bar_items_with_metadata（复用 MockContextMenu 模式） | ~25 |
| tray-icon | `src/platform_impl/ohos/event.rs` | translate_menu_code 纯映射 | ~12 |
| wry | `src/ohos/mod.rs` | extract_protocol_from_https_url 等 URL helper | ~30 |
| muda | `src/platform_impl/ohos/icon.rs` | PlatformIcon::from_rgba 维度校验 | ~16 |

**B. 仅宿主机可测（不在设备侧分母，需引入宿主机口径，共 ~2470 行）**：
- tauri `crates/tauri-cli/src/mobile/open_harmony/plugins.rs` 等：24 个纯函数（infer_class_name/validate_plugin_name/serialize_json5），零 cfg 门控，host cargo test 直接跑，~2130 行
- pw `plugins/global-shortcut/src/lib.rs` ohos_types mod（Shortcut/Modifiers/Code 解析器）+ notification serde：cfg 放宽到 `any(target_env="ohos", test)` 后 host 可测，~340 行

**C. 不可纯 UT（需 ArkTS runtime / 事件线程 / 窗口系统，函数级实锤）**：
- tauri：runtime-wry handle_user_message（142 行）/create_webview（79）、app.rs Builder::build（76）等 364 个未覆盖函数——事件循环与窗口编排
- tao：Window::set_theme（25）、handle_input_event（38）及全部 Window::set_*（各 7-9 行 bridge 调用）
- wry：InnerWebView::new_*（14-38）、PendingOp::execute（66）、create_pdf/set_cookie 等——webview 运行时
- oha：create_os_window（32）、BridgePlugin::on_main_thread_event（88）、BridgePluginRegistry 大部、StatusBarClient/MenuClient 方法（各 5-11 行 bridge 调用）
- tray-icon：start_event_forward_thread（34）、TrayIcon::new/set_* —— bridge 依赖
- vibrancy：apply_ohos_blur/acrylic/clear_ohos_blur——bridge 依赖（apply_ohos_mica 等三个零调用导出已于 #90 删除）

### 本轮新增测试（2026-08-22，4 仓 43 个，设备侧全通过）

| 仓 | 文件 | 新增测试数 | 内容 |
|---|---|---:|---|
| openharmony-ability | crates/ability/src/bridge/mod.rs | 20 | BridgeExecution/ContextRequirement/LifecycleEvent/Readiness 枚举逻辑 |
| openharmony-ability | crates/plugin-webview/src/lib.rs | 4 | expect_engine_phase、engine_scheme_pairs |
| tray-icon | src/platform_impl/ohos/event.rs + mod.rs | 7 | convert_icon_click 分支、menu_to_status_bar_items serde 分支（MockContextMenu）、extract_menu_metadata |
| window-vibrancy | src/ohos.rs | 7 | to_argb/acrylic_argb/mica_tint_argb（含 2 个保持行为的纯函数提取） |
| tao | src/platform_impl/ohos/mod.rs | 5 | rgba_to_ohos_color |

设备侧测试执行：**390 passed / 0 failed**（含 openharmony-ability 全部 12 个子 plugin crate：ability 37、plugin-webview 17、plugin-statusbar 8、plugin-global-shortcut 7、plugin-menu 6、plugin-app-control 4、plugin-autostart 4、plugin-clipboard 4、plugin-window 4、plugin-deep-link 3、plugin-files 3、plugin-permission 2、plugin-resource 2、plugin-url 2；muda 88、tray-icon 59、tao 44、wry 34、tauri 52、vibrancy 10）。

### llvm-cov OHOS target 技术坑（复现时注意）

1. `-Cinstrument-coverage` 不能放 `RUSTFLAGS`（会覆盖 env.sh 的 target-specific link-arg，链接报 `unrecognised emulation mode: i386pep`）——必须追加到 `CARGO_TARGET_AARCH64_UNKNOWN_LINUX_OHOS_RUSTFLAGS`
2. `hdc file recv` 本地路径必须 Windows 反斜杠格式
3. openharmony-ability workspace 编译用显式 `-p` 列表（`--workspace` 会把 proc-macro/example 编成 host .exe）
4. tauri 插桩二进制 174MB，推送 7s 执行 26s，设备端无限制
5. `CARGO_TARGET_DIR=target-cov` 隔离缓存有效
6. **llvm-cov JSON 导出的文件条目只有 `filename` 键，没有 `name`**——增量脚本读错键会静默产生随机数字（本次 75.4% 假基线的根因）。推荐直接用 `--format=lcov` 导出（逐行 DA 记录），跳过 JSON 的 segments 推导
7. **不能用 segment 起始行近似行覆盖**——函数体内非 region 起点的行会全部漏计（低估 10-30%）
8. 增量计算脚本 `jobs/97f58082/tmp/incr-cov2.py`（lcov 版，双口径+in-binary 口径）；各仓结果 `profraw/incr2-<repo>.json`

### 95% 目标可达路径（优先级）

1. **[P0] ✅ 已完成（2026-08-22）**：修复 `run-ut.sh`（cmd.exe 转发 → 直接 hdc + MSYS_NO_PATHCONV=1；另补 workspace 根包识别）并在真机（3QC0124C11000038）跑通 9 个 crate、**337 个测试全部通过、0 失败 0 挂起**。明细：

   | 仓 / crate | 设备执行 | 通过/失败 | 耗时 |
   |---|---|---|---|
   | muda | OK (26 MB) | 88/0 | 0.05s |
   | tray-icon | OK (28 MB) | 59/0 | 0.05s |
   | window-vibrancy | OK (18 MB) | 10/0 | 0.00s |
   | tao | OK (22 MB) | 44/0 | 0.03s |
   | wry | OK (37 MB) | 34/0 | 0.02s |
   | tauri | OK (131 MB) | 52/0 | 10.71s |
   | openharmony-ability（crates/ability, FEATURES=menu） | OK (18 MB) | 40/0 | 0.02s |
   | openharmony-ability-plugin-menu | OK (20 MB) | 6/0 | 0.00s |
   | openharmony-ability-plugin-clipboard | OK (17 MB) | 4/0 | 0.00s |

   - NAPI 挂起风险确认为零：全工作区仅 4 个测试（`version.rs::test_can_i_use_*`）进入真实 NAPI env 路径，设计为无上下文时优雅短路返回 `false`；其余全为纯 Rust 逻辑。
   - 遗留：openharmony-ability 其余 ~10 个子 plugin crate（plugin-url/window/statusbar/resource/permission/files/app-control/global-shortcut/deep-link/autostart）未逐个跑，按 `PACKAGE=openharmony-ability-plugin-<name>` 同模式触发即可（注意 `menu` feature 属父 crate，子 crate 不加 FEATURES）。
   - 下一步（覆盖率数字）：`cargo-llvm-cov --target aarch64-unknown-linux-ohos` 插桩编译，设备跑完拉回 `.profraw` merge，把"测试通过数"变成精确行覆盖率。

2. **[P1] 纯函数提取到跨平台模块**（备选，P0 落地后优先级降低）：~147 个纯逻辑测试解除 cfg 误锁，宿主机立即可跑，释放后宿主机子集覆盖可达 20-35%。
3. **[P2] plugins-workspace 补宿主机测试**：store 退出保存（纯逻辑）、notification serde round-trip、opener 路径规范化（可复用 windows_shell_path.rs 既有测试模式）。
4. **[P3] tauri 仓补跨平台分支测试**：RuntimeInitArgs::default、run_main_thread 宏非 ohos 分支等 ~141 行。
5. **[覆盖率数字] ✅ 已完成（2026-08-22）**：llvm-cov 设备侧插桩产出精确行覆盖率（见上文双口径表）。勘误：初版 75.4% 是脚本 bug 产生的假数据，真实本批口径 6.8%、团队全量口径 4.4%（in-binary 6.3%）。

### 预判风险

- openharmony-ability 中直接调用 NAPI 函数的测试（需要 ArkTS runtime）在裸二进制下会挂；其 91 个测试多数为数据契约/纯逻辑，应能跑。真需要 ArkTS runtime 的用例需二期方案（嵌在 hap 里跑）。

---

## 二、应用层接口在 examples/api 的覆盖

### 结论：并集覆盖 116/118 = **98.3%**（自动 91.5%，手动 68.6%），超过 95% 目标

| 覆盖类型 | 数量 | 占比 |
|---|---:|---:|
| 自动 + 手动都有 | 73 | 61.9% |
| 仅自动测试 | 35 | 29.7% |
| 仅手动测试 | 8 | 6.8% |
| 完全无覆盖 | 2 | 1.7% |
| **自动测试覆盖（合计）** | **108** | **91.5%** |
| **手动测试覆盖（合计）** | **81** | **68.6%** |
| **并集覆盖** | **116** | **98.3%** |

**完全无覆盖（2 个，均为内部 API，无应用层入口）**：
1. tao `WindowExtOpenHarmony::bridge_runtime()` — 仅被 tauri/wry 内部消费，ohos-init.ts 已间接覆盖其注册链
2. tao `drain_pending_window_closes` — 内部 drain 逻辑

**已知平台限制（非测试缺口）**：`clipboard-manager.read_image`（OHOS 剪贴板读权限限制，manual_tests.md 已记录）。

### 2.0 handler 执行口径（S10 补充，2026-08-24）：API 面 256/264 = 97.0%，新增接口 35/41 = 85.4%

上面的 116/118 是**静态盘点**（接口有没有对应测试代码，按接口组计）。S10 引入**动态执行口径**——用 llvm-cov 函数级数据（FNDA）直接量测 `#[tauri::command]` handler 是否真的被执行，数据源与行覆盖共用同一条 cov-build.sh 插桩链（`s9-cov/app-fn.lcov`，R4 desktop 624 例套件）。产出两份报告：

| 报告 | 分母 | 分子 | 结果 | 回答的问题 |
|---|---|---|---|---|
| **API 面** `s9-api-coverage.md` | capability 授权命令 ∩ 二进制内 handler = **264**（含上游既有命令，如 core:window 73 条） | handler FNDA>0 | **256/264 = 97.0%** | 整个授权命令面是否被测过 |
| **新增接口** `s10-api-incr-coverage.md` | 其中 handler 定义行落在 `fork..HEAD` diff 新增行内的命令 = **41** | 同上 | **35/41 = 85.4%**（未执行 6 条全豁免，可测 **35/35 = 100%**） | 我们 OHOS 适配自己引入/改写的命令面是否被测过 |

**两份报告的关系**：同一数据源、同一 FNDA 方法学、同一 demo 排除（__app-acl__/app-menu/sample），新增接口是 API 面按"handler 是否落在 diff 新增行"切出的**子集视图**（41 ⊂ 264，一个 API 严格对应一个命令/接口）。**"新增"的定义不是"命令名是新的"，而是"handler 定义行落在我们 `fork..HEAD` 的 diff 新增行内"**——既包括 OHOS 适配新引入的命令，也包括被我们改写过 handler 的上游命令。264 的构成：

```
264（API 面全量）= 41 新增接口（handler 行在 OHOS diff 内）+ 223 上游既有命令（handler 原封未动）
```

分插件看两半的分布最直观（二进制内命令数）：

| 插件 | 命令总数 | 其中新增 | 其中上游既有 | 说明 |
|---|---:|---:|---:|---|
| clipboard-manager | 6 | **6** | 0 | OHOS 实现整个是 diff 里的，全部算新增 |
| global-shortcut | 4 | **4** | 0 | 同上 |
| notification | 12 | **8** | 4 | 混合：OHOS 专属 handler + 上游既有命令 |
| core:window | 73 | **1** | 72 | maximize/minimize 等是上游命令，仅 internal_toggle_maximize 为新增 |
| core:menu | 22 | **2** | 20 | 同上形态 |

即：core:window 的 72 条上游命令在 API 面里要测（保证它们在 OHOS 上工作），但不算"我们的新增工作量"；新增接口报告只审我们亲手写/改的那 41 条。API 面看整体水位，新增接口看自有适配面——后者未执行的 6 条（updater×3、huawei-account login、process exit/restart）与 API 面的 8 条豁免是同一批，故**可测新增接口已 100%**。

**与静态盘点的口径差异**：静态口径计"有测试代码"（接口组粒度），执行口径计"handler 真跑过"（命令粒度）。S9 时点 API 面仅 83.7%——即相当一部分命令虽有测试用例，但 handler 从未执行（用例自身失败，或被 scope/ACL/参数反序列化拒在 handler 之前）；S10 四轮 api-gap 补测（29 例）把这些全部补齐到 97.0%，剩余 8 条均为设计豁免。详见 §一 S10 基线与 `s9-cov/s10-coverage-report.md`。

### 2.1 Core — tauri 仓（55 个）

| 接口 | 自动测试 | 手动测试 |
|---|---|---|
| window.maximize / is_maximized | window-ops.ts, core.ts | §十四 |
| window.minimize / is_minimized | window-ops.ts, core.ts | §十四/§二十一 |
| window.set_position / set_size | window-ops.ts | §二十一 |
| window.set_fullscreen | window-ops.ts | §十四 |
| window.set_always_on_top | window-ops.ts | — |
| window.set_decorations / is_decorated | core.ts | — |
| window.set_focus | — | §十八 |
| window.cursor_position | core.ts | — |
| window.inner/outer_size、inner/outer_position、scale_factor | window-dpi.ts, ohos-init.ts | — |
| window.current_monitor / monitor_from_point | ohos-adapter.ts | §二十七 |
| window.set_ignore_cursor_events | window-ops.ts, ohos-adapter.ts | §二十八 |
| window.createUIAbilityWindow | window-ops.ts | §十一 |
| create_borderless_window / transparent | core.ts | §十 |
| window.set_effects（Blur/Acrylic/Mica/Tabbed） | core.ts | §十九 |
| vibrancy clearEffects | core.ts | §十九 |
| webview.print | ohos-adapter.ts | §二十七 |
| webview.createPdf | core.ts | §七.1 |
| webview.set_cookie / cookies / delete_cookie / cookies_for_url | core.ts | §七.2 |
| webview.set_bounds | window-ops.ts | §七.4 |
| webview.webPageSnapshot | core.ts | §三十三 |
| webview.eval_with_callback | core.ts | — |
| webview.userAgent | plugins.ts | §八 |
| webview devtools open/close/is_open | — | §七.3 |
| webview with_clipboard flag | ohos-adapter.ts | §二十七 |
| webview with_zoom_hotkeys flag | ohos-adapter.ts | §二十七 |
| webview drag_drop_overlay | ohos-adapter.ts | §二十六 |
| webview drag-drop（web 层） | ohos-adapter.ts | §二十六 |
| webview https_scheme / secure-context | ohos-adapter.ts | §二十六 |
| webview.reparent（OHOS 返回 error） | core.ts | §十六 |
| webview.create_webview / add_child / dispose_child | core.ts | §十六 |
| on_new_window Allow/Deny/Create | core.ts | §十一 |
| on_download（5 子用例） | core.ts | — |
| on_page_load / on_navigation / on_document_title_changed | core.ts | — |
| on_menu_event / on_window_event | core.ts | — |
| core.invoke / Channel | core.ts | — |
| event.emit / listen / once | core.ts | — |
| app.getVersion / ohos versionInfo | core.ts | — |
| path.appCacheDir / PathResolver | core.ts | — |
| core.Resource | core.ts | — |
| register_uri_scheme_protocol（sync/async） | core.ts | — |
| append_invoke_initialization_script | core.ts | — |
| app_handle.emit / listen / get_webview_window | core.ts | — |
| async_runtime::spawn | core.ts | — |
| localStorage set/get/remove | core.ts | — |
| DOM MouseEvent/WheelEvent dispatch | core.ts | — |
| RunEvent::Ready / MainEventsCleared | core.ts | — |
| RunEvent::Resumed | core.ts, ohos-adapter.ts | §九/§二十七 |
| RunEvent::CloseRequested / Destroyed | core.ts | §九 |
| RunEvent::Opened（deep-link） | core.ts | §九/§二十 |
| RunEvent::ExitRequested / Exit | — | §九 |
| RunEvent::SaveState 降级 | — | §二十七 |
| Init Chain（window/menu/tray client 注册） | ohos-init.ts | §二十九 |
| Channel（mobile/OHOS 注册 + NAPI） | core.ts, ohos-mobile-plugins.ts | §三十二 |

### 2.2 Tray — tray-icon 仓（15 个）

| 接口 | 自动测试 | 手动测试 |
|---|---|---|
| TrayIcon.new / new_with_id / new_with_full_options | tray.ts | §一 |
| TrayIcon.getById（含 not_found / after_visible） | tray.ts | — |
| TrayIcon.removeById / then_recreate | tray.ts | §一 |
| TrayIcon.setIcon / setIcon_null | tray.ts | — |
| TrayIcon.setMenu / setMenu_null / setMenu_replace | tray.ts | §一 |
| TrayIcon.setTooltip / setTitle / setVisible | tray.ts | §一 |
| TrayIcon.setTempDirPath | tray.ts | — |
| TrayIcon.setIconAsTemplate（true/false/toggle） | tray.ts | §一 |
| TrayIcon.setShowMenuOnLeftClick | tray.ts | — |
| TrayIcon.setQuickOperation（null/update） | tray.ts | §一 |
| TrayIcon.event_handler_register / tray_event_chain | tray.ts | §十四 |
| TrayIcon.full_test_tray | tray.ts | §一 |
| tray_menu_item_click / tray_multi_item_menu | tray.ts | §一 |
| TrayIcon.cleanup | tray.ts | — |
| send_icon_click（测试钩子） | 隐式 | — |

### 2.3 Menu — muda 仓（15 个）

| 接口 | 自动测试 | 手动测试 |
|---|---|---|
| Menu.new / with_id / with_items / with_id_and_items | menu.ts | §二 |
| Menu.append / append_items / prepend / prepend_items / insert / insert_items | menu.ts | — |
| Menu.remove / removeAt / get / items | menu.ts | — |
| Menu.popup / popup_at / popup_at_position / popup_auto | menu.ts | §二/§二.1 |
| MenuItem.new / with_id / text / setText / isEnabled / setEnabled / setAccelerator | menu.ts | §二 |
| Submenu（全 CRUD + 嵌套） | menu.ts | §二 |
| PredefinedMenuItem（全部 13 种） | menu.ts | §二/§十四 |
| CheckMenuItem（全 CRUD） | menu.ts | §二 |
| IconMenuItem（全 CRUD） | menu.ts | §二 |
| MenuItem.action / kind | menu.ts | §二 |
| Menu.full_workflow / with_submenu / mixed_items | menu.ts | — |
| is_menu_visible / hide_menu / show_menu | — | §二.1 |
| NativeIcon 映射 | — | §二.1 |
| set_menu_client / send_menu_event / dispatch（内部） | 隐式 | — |
| muda OHOS platform_impl（内部 API） | 隐式 | — |

### 2.4 Plugins — plugins-workspace（30 个接口组）

| 接口 | 自动测试 | 手动测试 |
|---|---|---|
| os.platform / type / family / arch / eol / exeExtension | plugins.ts, ohos-gap.ts | §五/§三十 |
| os.version / locale / hostname | plugins.ts | §五/§三十 |
| log.trace..error | plugins.ts | — |
| http.fetch（全方法） | plugins.ts | — |
| fs.mkdir/writeFile/stat/readFile/exists/readDir/remove | plugins.ts | — |
| dialog.open / save / confirm / message | plugins.ts | §四 |
| clipboard-manager.writeText / readText | plugins.ts | — |
| clipboard-manager.writeImage（全格式） | plugins.ts | §三 |
| clipboard-manager.writeHtml / clear | plugins.ts | §三十 |
| clipboard-manager.read_image | — | —（平台限制） |
| autostart.enable / disable / isEnabled | plugins.ts | §六 |
| window-state.save / restore / filename | plugins.ts | §二十一 |
| process.relaunch / do_restart | plugins.ts | — |
| shell.open | plugins.ts | — |
| shell.sidecar / Command.spawn | 占位 | §三十 |
| notification（权限/channel/send/cancel/listener/action） | plugins.ts | §十二/§三十/§三十二 |
| updater.downloadAndInstall | plugins.ts | — |
| updater.check | 占位 | §三十 |
| global-shortcut（register/unregister/trigger/组合） | plugins.ts | §十七 |
| deep-link（getCurrent/isRegistered/register/onOpenUrl/冷启动） | plugins.ts | §二十 |
| store.set/get/has/keys/entries/delete | plugins.ts | §二十三 |
| store.save（落盘/Exit 不阻塞） | — | §二十三 |
| sql.load / execute / select / close | plugins.ts | — |
| websocket.connect / send / echo / disconnect | plugins.ts | — |
| upload.upload（echo+progress） | plugins.ts | §二十四 |
| localhost.fetch 200/CORS | plugins.ts | §二十五 |
| cli.getMatches | plugins.ts | — |
| positioner.moveWindow | plugins.ts | — |
| single-instance（callback/onNewWant） | 占位 | §十三 |
| persisted-scope（allow+persist/test/clear） | plugins.ts | §二十一 |
| biometric.status | plugins.ts | §三十一 |
| biometric.authenticate | — | §三十一 |
| nfc.is_available | plugins.ts | §三十一 |
| nfc.scan / write | — | §三十一 |
| barcode-scanner.check_permissions | plugins.ts | §三十一 |
| barcode-scanner.request_permissions / scan / vibrate | — | §三十一 |
| geolocation.check_permissions | plugins.ts | §三十一 |
| geolocation.request_permissions / get_current_position | — | §三十一/§三十二 |
| geolocation.watchPosition(emit) / open_location_settings | — | §三十二 |
| haptics.selection_feedback | plugins.ts | §三十一 |
| haptics.vibrate / impact / notification_feedback | — | §三十一 |
| huawei-account.login / silent_login / logout | — | §三十一 + MT-01..06 |
| opener.open_path / open_url | — | §二十二 |
| opener.reveal_item_in_dir / reveal_items_in_dir | — | §二十二 |
| sentry.breadcrumb / envelope / rust_breadcrumb | plugins.ts | §十五 |
| sentry JS Error / Rust Panic 捕获 | — | §十五 |

### 2.5 平台仓内部 API（5 个）

| 接口 | 自动测试 | 手动测试 | 覆盖状态 |
|---|---|---|---|
| tao WindowExtOpenHarmony::bridge_runtime | 无 | 无 | 无覆盖（内部 API） |
| tao drain_pending_window_closes | 无 | 无 | 无覆盖（内部 API） |
| wry with_drag_drop_overlay | ohos-adapter.ts | §二十六 | 两者 |
| wry with_https_scheme | ohos-adapter.ts | §二十六 | 两者 |
| openharmony-ability BridgeRuntime/*Client | 隐式 | — | 自动（隐式） |

---

## 三、覆盖率提升路径（2026-08-22 调研结论）

> **正式分阶段方案**：见 `openspec/changes/ohos-coverage-rampup/`（proposal/design/tasks）。五阶段推进：S1 路径 A 全量跑（+windowOpsTests 修复）→ S2 driver 盲调用套件 → S3 坏输入错误用例 → S4 oha 故障注入 feature → S5 mobile 形态合并。工程目标 85-90%（可执行口径），95% 以 documented-exclusions 口径达成。路径 A 闸门已于 2026-08-22 通过，S1 可执行。

### 分母解构（团队口径 41168 非测试新增行）

- **not-in-binary ~12619 行**：tauri 8322（examples/api ~2511 + tauri-cli ~2130 + 其他）、oha 1557、pw 2714——当前 UT 口径下永远无法覆盖，但其中 examples/api + pw + oha misc 的 ~6782 行在 app .so 里，hap 插桩（路径 A）可回收；tauri-cli ~2130 行是宿主机纯逻辑（路径 B 可测）
- **in-binary 未执行 ~26758 行**：窗口/webview 运行时、NAPI 桥接、静态初始化——主要靠路径 A 回收

### 路径优先级

| 优先级 | 路径 | 内容 | 预估增益 | 工作量 |
|---|---|---|---|---|
| **P0** | A. hap 插桩端到端 | examples/api app `libapi_lib.so` 插桩 + 282 个自动测试跑真实 bridge 链 + profraw 回收合并 | **+43.7pt**（~18000 行） | 6 人日 |
| P1 | B. tauri-cli 宿主机 UT | `mobile/open_harmony/plugins.rs` 等 24 个纯函数（`infer_class_name`/`validate_plugin_name`/`serialize_json5`），零 cfg 门控可直接 host cargo test | +5.2pt（需引入宿主机口径） | 2 人日 |
| P1 | C. 设备侧补纯逻辑 UT | oha mouse_event.rs（~190 行 From/Default/hover 零测试）、callbacks.rs 决策函数、tao keycodes.rs 映射臂、plugin-menu 去掉 test cfg 门控 | +1.5pt | 2 人日 |
| P2 | D. mobile 形态 + 异常分支 | 自动测试目前只跑 desktop；`--device-type mobile` + Err 路径用例 + 补 plugin 测试 | +7-12pt | 5 人日 |
| P2 | E. pw 宿主机 UT | global-shortcut `ohos_types` mod（~196 行解析器，零 NAPI 依赖）cfg 放宽 + 测试；notification serde 等 | +0.8pt | 1 人日 |
| P3 | F. 纯函数提取跨平台模块 | mouse_event/callbacks/keycodes 提到无 cfg 模块，host 可测（补充指标） | +1.2pt（host 口径） | 3 人日 |
| P4 | G. bridge trait mock | ROI 低：bridge/mod.rs 未覆盖行 ~50% 是 NAPI 胶水（mock 不可替代）、~35% dispatch 已有测试覆盖；改动面仅 oha 内部（铁律合规） | +1.9pt | 8 人日 |

### 路径 A（hap 插桩）技术要点与风险

> **口径修正（2026-08-22 用户确认）**：examples/api、oha rust_example 等 demo 代码不计入分母，路径 A 收益按可执行行口径重估：in-binary 可执行未覆盖 11284 行 × 50-60% 回收率 ≈ **+5600~6770 行**；叠加 pw 经 app 覆盖（可执行 ~800 × 45-50%）≈ +350~400。加上 A 桶补测 ~494 行后，**可执行口径预期 12.2% → ~62%（±5）**。
>
> **残余构成实测（2026-08-22，对 11284 行未覆盖行做内容分类 + 随机抽样）**：显式错误构造（`Err(`/`unwrap_or`/`expect`/handler 体）仅占 **~6%**（约 700 行）；分支行 ~13%；其余 **~75% 是多行调用的续行**（`)`/`};`/字段参数行），与所属 API 调用同生共死——自动测试调了该 API 整块盖住，没调整块留空。因此路径 A 剩余未覆盖的大头**不是错误分支，而是未纳入 282 个自动测试的 API**（SetFullscreen、drag-drop Over、cookies、AvailableMonitors、cursor、print cancel 等），**可通过补自动测试持续回收**。真正结构性死角（错误分支 ~6% + 未初始化兜底 + 多实例路径）合计约 15-20% → **路径 A + 补齐自动测试的天花板约 75-80%**，高于此前 ~62% 的保守估计。脚本 `jobs/97f58082/tmp/unc-comp.py`，原始分布 `uncovered-composition.json`。
>
> **手动测试与自动测试的衔接（2026-08-22 实测）**：examples/api 注册 338 用例 = auto 236 + manual 56 + side-effect 45。未自动化的 API 集中在 `doc/manual_tests.md` 33 章手动用例，成因四类：视觉断言（vibrancy/全屏无黑边，断言需人眼）、系统 UI 交互（打印对话框/权限弹窗/文件拖拽）、环境前置（sidecar 二进制/AppGallery/位置 fix）、真实副作用（openUrl/cookie 真实发送）。**手动按钮与自动测试走同一 invoke→cmd.rs→facade→bridge 链路、同一插桩进程**——① 路径 A 插桩跑 app 时点一遍手动按钮即可让手动用例代码进 profraw；② "难断言不难执行"的用例可降级为只执行不断言的冒烟用例搬进 test-runner（vibrancy setEffects/openUrl/print/setFocus 均属此类）；③ 前后台切换可用 hdc 模拟。真死区仅环境前置类（sidecar/AppGallery/外部服务端）。

- 插桩点：`CARGO_TARGET_AARCH64_UNKNOWN_LINUX_OHOS_RUSTFLAGS` 追加 `-Cinstrument-coverage`（同 UT 链路；⚠️ 不能用 `CARGO_TARGET_DIR=target-cov` 隔离——app 构建管线从默认 target/ 拷 .so）
- **ohrs 管线坑**：ohrs v1.3.1 生成 `CARGO_ENCODED_RUSTFLAGS` 会**覆盖** `CARGO_TARGET_*_RUSTFLAGS` 与 config.toml rustflags → 插桩标志注不进去。**必须绕过 ohrs**：直接 `cargo build --lib --target aarch64-unknown-linux-ohos --release --features prod,cov-dump`，再手动 `hvigorw assembleHap` 打包
- **LLVM 版本坑**：OHOS NDK 的 `libclang_rt.profile.a` 是 LLVM 15（写 profraw v8），Rust 工具链是 LLVM 22（要 v10）→ llvm-profdata 报 "file header is corrupt"。**必须链 Rust 自带的 libprofiler_builtins**（从 .rlib 提取 .a，build.rs `cargo:rustc-link-lib=static=profiler_builtins`；提取物在 `tauri/profiler-rt/`）
- **.so 热替换不可行**：`/data/storage/el1/bundle/...`（shell 视角）不是 app 真实 bundle；真实物理路径 `/data/app/el1/bundle/public/<bundle>/libs/arm64/` 有 hmfs MAC，root 也报 Operation not permitted → **每次改 .so 必须重打 hap + 签名 + `bm install -r`**
- **strip 陷阱**：`gen/ohos/entry_desktop/build-profile.json5` `"strip": true` 会移除 `.__llvm_prf_*` 段 → 必须设 `strip: false`
- **环境变量不可注入**：`aa start` 拉起的 app 进程不继承 hdc shell 的 env → 必须用 `__llvm_profile_set_filename()` 从 Rust 显式设置 profraw 路径
- **常驻进程不触发 atexit**（且 `aa force-stop` 是 SIGKILL）→ 必须**周期 flush 线程**（lib.rs cov-dump 块：启动 +3s 写 marker + set_filename + 首次 flush，此后每 20s flush）+ test-runner 结束时 `invoke('dump_coverage')`
- profraw 落盘：app 沙箱 cache（hdc 可见路径 `/data/app/el2/100/base/<bundle>/cache/`，或经 `/proc/<app_pid>/root/data/storage/el2/base/cache/` 穿透命名空间）
- 合并：用 **Rust 工具链的** llvm-profdata/llvm-cov（LLVM 22），勿用 OHOS NDK 的（LLVM 15）；app .so 与 UT 二进制的 profraw 分开导出 lcov 再按行取 max（避免跨构建 function hash 不匹配）
- ✅ **可行性闸门已通过（2026-08-22 19:58）**：插桩 app 真机产出 37.7MB profraw → llvm-profdata 合并 19.7MB profdata → llvm-cov report 全文件级数据可用。改动全部 `cfg(all(target_env="ohos", feature="cov-dump"))` 门控（build.rs/lib.rs/cmd.rs/Cargo.toml/TestRunner.svelte + cov-build.sh），不影响其他平台与正常构建。完整命令序列见 `tauri/cov-build.sh` 头注

### 95% 可达性结论

**设备侧行覆盖口径下 95% 不可达**。乐观组合上限 ~68-75%（A+B+C+D+E 全落地）。不可约减缺口 ~20-25%（2026-08-22 按行内容实测修正，原估 ~25-30%）：真错误分支仅 ~700 行（需故障注入）、未初始化兜底分支、NAPI 序列化胶水未用类型子集（~5000 行中 happy-path 可被自动测试触发的部分已被计入可回收）、形态专属分支（~1500）、一次性静态初始化（~800）、注释/日志（~1200）。

**建议目标修订**：70%（设备侧）+ 80%（含宿主机口径），辅以接口覆盖率 98.3% 作为应用层补充指标。

## 四、关键文件索引

- 自动测试目录：`tauri/examples/api/src/lib/tests/`（16 个 .ts：core.ts / plugins.ts / tray.ts / menu.ts / window-ops.ts / window-dpi.ts / ohos-init.ts / ohos-adapter.ts / ohos-gap.ts / ohos-mobile-plugins.ts / api-gap.ts / driver-generated.ts / fault-injection-generated.ts 等）
- S10 覆盖率报告：`s9-cov/s10-coverage-report.md`（增量行覆盖）、`s9-cov/s9-api-coverage.md`（API 面 97.0%）、`s9-cov/s10-api-incr-coverage.md`（新增接口 85.4%）、`s9-cov/html-incr/`（增量口径逐行 HTML）；脚本 `cov-tools/api-coverage.py` / `api-coverage-incr.py` / `render-incr-html.py`
- 测试运行器：`tauri/examples/api/src/lib/test-runner.ts`
- 手动测试主文档：`tauri/doc/manual_tests.md`（638 行）
- 手动测试副文档：`tauri/examples/huawei-account/doc/manual_tests.md`
- 设备侧 UT 脚本：`tauri/.claude/skills/ohos-rust-ut/scripts/run-ut.sh`（已修复：直接 hdc + MSYS_NO_PATHCONV=1）
- 增量覆盖率脚本（lcov ground-truth 版）：`jobs/97f58082/tmp/incr-cov2.py`；各仓结果 `profraw/incr2-<repo>.json`
- 本轮补测文件：oha `bridge/mod.rs`+`plugin-webview/lib.rs`、tray-icon `ohos/event.rs`+`ohos/mod.rs`、vibrancy `src/ohos.rs`、tao `ohos/mod.rs`（均工作区未提交，待检视）
- 提升路径关键文件：tauri-cli 纯函数 `tauri/crates/tauri-cli/src/mobile/open_harmony/plugins.rs`（24 个）；oha 未测纯逻辑 `openharmony-ability/crates/ability/src/input/mouse_event.rs`、`plugin-webview/src/callbacks.rs`；tao 映射表 `tao/src/platform_impl/ohos/keycodes.rs`；pw 解析器 `plugins-workspace/plugins/global-shortcut/src/lib.rs`（ohos_types mod）；strip 配置 `examples/api/src-tauri/gen/ohos/entry_desktop/build-profile.json5`
- UT 最大新增无独立宿主机验证文件：`openharmony-ability/crates/ability/src/bridge/mod.rs`（1751 行，14 个 ohos-gated 测试）
- plugins-workspace 最大无测试文件：`plugins/global-shortcut/src/lib.rs`（216 行，全 ohos-gated）
