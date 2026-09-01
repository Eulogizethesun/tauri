---
name: ohos-debug
description: 鸿蒙设备Tauri应用调试工作流
---

# ohos-debug
任务分工

主agent任务安排，分发。监听日志,总进度把控。

子agent可以复用

子agent-apply 负责按照设计文档修改代码，实现时可用D:\xuqiu\tauri-3.0\tauri\.claude\skills\tauri-ohos-apply\SKILL.md。可以修改代码。

子agent-design 负责按照问题，需求进行方案设计，设计时可用D:\xuqiu\tauri-3.0\tauri\.claude\skills\tauri-ohos-design\SKILL.md。不能修改代码。

子agent-audit 根据代码实际情况，负责审计子agent-design的设计方案和子agent-apply的代码实现质量。不能修改代码。

子agent-build 在代码修改完并审计完后，构建部署ohos desktop，按照D:\xuqiu\tauri-3.0\tauri\.claude\skills\ohos-build\SKILL.md 的步骤构建。不能修改代码。

每个子agent在完成任务后，向主agent汇报结果，主agent根据结果进行下一步任务分发。可与user交互，讨论下一步动作，用户可在主agent中查看每个子agent的任务进度和结果。

---

## hilog 抓取方法（派发子agent抓日志时复用）

### 命令
- **清缓冲**：`hdc shell hilog -r`（抓前必须清，避免旧日志干扰）。
- **持续流抓取**：`hdc shell hilog`（**不要加 `-x`**——`-x` 是 dump 缓冲后立即退出，非持续流）。用 timeout 控制时长：
  - Bash 工具：`timeout 240 hdc shell hilog 2>&1 > D:\xuqiu\tauri-3.0\verify-hilog.log`（exit code 124 = timeout 正常终止，证明持续流在工作）。
  - 240 秒通常够用户完成 3 个操作步骤；不够可延长。
- **开 Debug 级 + 关流控**（抓全量，避免漏 Debug 日志）：`hdc shell hilog -b D`、`hdc shell hilog -Q pidoff`、`hdc shell hilog -Q domainoff`。在清缓冲前执行。

### 本项目日志的 domain/tag 映射（必读，否则 grep 不到）
日志分两类，domain 不同，grep 时要分别匹配：

| 来源 | domain | tag 举例 | 说明 |
|------|--------|---------|------|
| **Rust `log` crate**（tauri/wry/muda/tray-icon/global-shortcut 等 crate 的 `log::info!`/`error!`/`warn!`） | `A00000` | `tauritest` | 由 ohos-hilog-binding 后端统一输出，tag 固定 `tauritest`。Rust 侧任何 `log::` 都在这里。 |
| **ArkTS `hilog.info(DOMAIN, ...)`**（NativeAbility/MenuBarComponent/StatusbarPlugin/WindowManager/menu.ets 等） | `A01999` | 类名/模块名（`NativeAbility`/`MenuBar`/`StatusBar`/`StatusbarPlugin`/`Menu`/`WindowManager`） | `DOMAIN = 0x1999` 定义在 `openharmony-ability/native_ability/src/main/ets/helper/constants.ets`，全 ArkTS 共用。 |

- **Rust 日志行格式**：`... I A00000/com.tauri.api/tauritest: <消息>`
- **ArkTS 日志行格式**：`... I A01999/com.tauri.api/<tag>: <消息>`
- **系统框架日志**（WMS/BMS/AceSubWindow 等）domain 形如 `A04200`/`C04203`，tag 含 `com.ohos.sceneboard` 等，**容易和应用日志混淆**——比如系统也用 `NativeAbility` 打 ability lifecycle（onNewWant），别误当成应用代码日志。

### grep 策略
- **抓全量到文件，事后 grep**（不要在抓取时过滤 tag，会漏）。命令：`timeout 240 hdc shell hilog 2>&1 > 文件`。
- 查 Rust 日志：`grep "tauritest"` 文件。
- 查 ArkTS 日志：`grep "A01999/com.tauri.api"` 文件（按 tag 二次过滤：`grep "A01999/com.tauri.api/MenuBar"`）。
- 查特定进程：`grep "com.tauri.api"`（pid 会变，用 bundle name 稳定）。
- **关键坑**：grep 多关键字用 `|` 正则（`grep -E "a|b|c"`），不要用多个单关键字分次 grep 后断言"零命中"——容易漏。判读"某日志没出现"前，先用一个**已知必然出现的日志**（如 app 启动的 `NativeAbility: onNewWant` 或 `WindowManager: WindowManager getInstance`）验证该进程/domain 的日志确实被抓到了，再断言目标日志缺失。

### 抓取时机（决定能否抓到启动期日志）
- **启动期日志**（如 global-shortcut 的 `ohos_setup`、NativeAbility `onCreate`/`onWindowStageCreate`）在 app 冷启动时打印。若在 app **已运行**时清缓冲再抓，会错过启动期日志。
- **要抓启动期日志**：先清缓冲 → 再**重启 app**（`hdc shell aa force-stop com.tauri.api` 后重新启动 EntryAbility）→ 立即开始持续流抓取。这样启动期日志落入窗口。
- **只抓操作期日志**（用户交互触发）：app 保持运行，清缓冲后抓取即可。

### 判读规则
- **"日志没出现" ≠ "代码没执行"**：先排除 grep 错误、domain 过滤、级别过滤、启动期错过。用上文"已知必然出现的日志"做对照。
- 若对照日志在 → 目标日志不在 → 代码路径未执行（真根因）。
- 若对照日志也不在 → 抓取/grep 命令有问题，先修抓取方法。

## 定位策略：优先加日志，而不是反复抓取/猜测

排查问题时，**优先通过加诊断日志来定位**，不要反复抓取+hilog 猜测链路断点。原因：抓取窗口可能漏启动期日志、tag/domain 容易漏匹配、间接路径多轮猜测耗时长且易误判。加日志能直接钉死"代码跑没跑、跑到哪一步停了"。

### 何时加日志
- 现有代码某条链路无日志，或日志稀疏，无法判断执行到哪一步。
- 怀疑 cfg 门控把代码块编译排除（如 `#[cfg(all(desktop, not(test)))]`）——在 cfg 块入口加 `log::info!`，跑一次看日志在不在即可定论，不用拆 hap/.so 反查。
- 怀疑某函数/分支没被调用——在入口加无条件 `log::info!`/`hilog.info`。
- "Rust 返回 ok 但 ArkTS 零日志"类问题——在转发链每一步加埋点，区分是没到、还是到了没转发。

### 加日志的流程（子agent-apply 落地，走 ohos-debug 工作流）
1. 先 grep/read 确认目标位置**是否已有日志**——已有就别重复加（如 `tray.rs:41 [create_tray] enter`、`lib.rs:260 [setup] before create_tray` 已存在），直接抓取验证即可。
2. 在关键节点加无条件日志（cfg 块入口、函数入口、分支判断点、bridge 调用前后）。日志要带可识别前缀（如 `[setup]`、`[create_tray]`、`DIAG-A`）。
3. 加日志算代码改动，走 design→audit→apply→build 流程；但**纯诊断日志风险低**，audit 可快速通过。
4. 构建部署后用正确抓取方法（冷启动抓取看启动期日志、操作期抓取看交互链路），一次钉死断点。
5. 定位后、修复落地前，可保留诊断日志（便于回归验证），或按需要清理。

### 加日志 vs 抓取的取舍
- **已有日志够用** → 直接抓取（别加冗余）。
- **链路零日志、无法判断走到哪** → 加日志（一次定位比三轮抓取快）。
- **怀疑 cfg/编译排除** → 必加日志（cfg 块入口加 `log::info!`，比拆二进制反查快几个量级）。