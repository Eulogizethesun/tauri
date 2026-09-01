# S1-S5 覆盖率战役待审清单（2026-08-23）

全部改动**未提交**、留在工作树等用户审阅。分三类：① 需评审的源码/测试改动（可能拆 PR）；② 覆盖率基建脚本与数据；③ 可丢弃的临时产物。**严禁直接 push upstream（Eulogizethesun）。**

## 一、需评审的源码/测试改动（按仓）

### openharmony-ability（S4 故障注入主体，360+ 行）

| 文件 | 性质 | 内容 |
|---|---|---|
| `crates/ability/src/fault_injection.rs` | 新增（未跟踪） | Rust 侧 set_rule/clear 命令 + FaultRule 类型 |
| `crates/ability/src/bridge/mod.rs` (+221) | 修改 | dispatch 层故障注入检查点（error/exception/delay/timeout） |
| `crates/ability/src/app.rs` (+36) | 修改 | app 级接线 |
| `crates/ability/src/lib.rs` (+6) | 修改 | 模块声明 |
| `crates/ability/Cargo.toml` (+1) | 修改 | feature `fault-injection` 门控 |
| `native_ability/src/main/ets/bridge/FaultInjection.ets` | 新增（未跟踪） | ArkTS FaultInjectionRegistry（恒编译、运行时 enabled=false 短路） |
| `native_ability/src/main/ets/bridge/BridgeHost.ets` (+53) | 修改 | dispatch 前检查注入规则 |
| `crates/plugin-webview/src/lib.rs` (+46) | 修改 | S4 联动（webview 错误路径） |

> 产线零影响已验证（prod-verify-s4.sh：feature=prod 构建 nm 查 fault 符号=0、`__llvm_prf`=0）。合入前注意：Rust 侧 feature 门控完整；ArkTS 侧靠运行时短路（模板恒编译）。

### tauri（examples/api 驱动侧 + 文档，226 行）

| 文件 | 性质 | 内容 |
|---|---|---|
| `examples/api/src-tauri/src/cmd.rs` (+63) | 修改 | fault_injection_set_rule/clear 命令 + cov-dump 相关 |
| `examples/api/src-tauri/src/lib.rs` (+54) | 修改 | 命令注册 |
| `examples/api/src-tauri/build.rs` (+53) | 修改 | **ACL 权限登记**（fault-injection 两命令 + cov 相关；cfg 门控命令必须手工登记） |
| `examples/api/src-tauri/capabilities/run-app.json` (+16) | 修改 | allow-fault-injection-* 等权限 + S2 补的 12 项 window/webview/fs/shell 权限 |
| `examples/api/src-tauri/Cargo.toml` (+6) | 修改 | feature 声明 |
| `examples/api/src/lib/tests/driver-generated.ts` | 新增（未跟踪） | S2/S3 driver 盲调用 230 用例（@generated 头，VITE_AUTOTEST 门控，不污染 demo） |
| `examples/api/src/lib/tests/fault-injection-generated.ts` | 新增（未跟踪） | S4 注入 52 用例（同上门控） |
| `examples/api/src/lib/test-runner.ts` / `views/TestRunner.svelte` | 修改 | TestCategory 加 'driver'、badInput/sideReplay/fault 段挂载（全部 VITE_AUTOTEST 门控） |
| `.claude/skills/ohos-rust-ut/scripts/run-ut.sh` | 修改 | UT 脚本修复（cmd.exe 转发+根包识别） |
| `doc/ohos-test-coverage.md` | 新增（未跟踪） | 覆盖率完整报告（S1-S5 终态+排除清单附录+复现命令） |
| `openspec/changes/ohos-coverage-rampup/` | 新增（未跟踪） | 本 change 全套（design/tasks/s4 设计/本清单） |

### UT 测试补充（2026-08-22 批，43 用例 4 仓）

| 仓 | 文件 | 内容 |
|---|---|---|
| tao | `src/platform_impl/ohos/mod.rs` (+31) | 尾部 `#[cfg(test)]` 模块（rgba_to_ohos_color 等） |
| tray-icon | `src/platform_impl/ohos/{event,mod}.rs` (+89) | 尾部测试模块 |
| window-vibrancy | `src/ohos.rs` (+56/-5) | 提取 `acrylic_argb` 纯函数（可测性重构）+ 测试 |

### UT 测试补充（2026-08-24 批 / S6，34 用例 4 crate，休眠纯函数直补）

| 仓 | 文件 | 内容 |
|---|---|---|
| tao | `src/platform_impl/ohos/mod.rs` (+~400) | `input_tests` 模块 20 用例：handle_input_event/handle_mouse_event/handle_axis_event 全变换路径（run_collected 闭包收集器断言 WindowEvent 字符串） |
| tauri | `crates/tauri-runtime-wry/src/lib.rs` (+~120) | `with_config_tests` 模块 4 用例：WindowConfig→WryWindowBuilder 字段断言 |
| tauri | `crates/tauri/src/lib.rs` (+~15) | `debug_app_icon_tests` 1 用例 |
| openharmony-ability | `crates/ability/src/input/mouse_event.rs` (+~105) | 尾部测试模块 9 用例（From/Default/hover/callback setter） |
| （基建） | `cov-tools/exec-analysis-merged.py` | BINPAT tauri `tauri-*`→`tauri*`（下划线二进制名 tauri_runtime_wry-<hash> 此前匹配不到） |

### 其余仓

- **wry / muda / plugins-workspace**：无源码改动（仅 profraw/target-cov 数据目录）。

## 二、覆盖率基建（工作区根，非 git 仓）

- `cov-build.sh` —— 插桩构建+签名+安装+跑测主脚本（desktop/mobile 双形态、module swap、pipefail）
- `prod-verify-s4.sh` —— 产线零影响验证
- `cov-tools/` —— 分析/生成脚本已收编：`gen-driver.py`、`exec-analysis-merged.py`、`err-analysis.py`、`merge-app-lcov.py`、`incr-cov2.py`、`s2~s5-recover.sh`（注：incr-cov2.py 被其余脚本 import，路径写死 jobs tmp，入库前需改为同目录加载）
- `s1-cov/`…`s5-cov/` —— 各阶段 profdata/lcov/exec.json/test-report 数据（建议保留）

## 三、可丢弃

- 工作区根的 `cov-build*.log`（10 个）、`prod-verify-s4*.log`、`verify-*.log`、`hilog-*.txt`、`ut-*.log` 等历史日志；`cov-app*.profraw`（已合并进 profdata）
- 各仓 `target-cov/`（可随时重建）、`tauri/target-prod/`、`profraw*/`（已 merge）

## 建议提交拆分

1. UT 测试批（tao/tray-icon/window-vibrancy 尾部测试）——纯新增测试，风险最低
2. openharmony-ability 故障注入（feature 门控 + ArkTS registry）——一个逻辑单元
3. tauri examples/api 驱动侧（driver/fault 用例 + ACL 登记）——依赖 2
4. 文档 + openspec change 收尾（doc/ohos-test-coverage.md、tasks.md 6.1/6.2、本清单）
5. 基建脚本（cov-build.sh / prod-verify-s4.sh / 分析脚本收编）——或留工作区不入库

## S7 批新增（2026-08-24）

**纯新增测试（4 文件 22 用例，风险最低）**：
- tauri/crates/tauri-runtime-wry/src/lib.rs — `mod mapping_tests`（尾部追加，10 用例）
- tauri/crates/tauri/src/image/mod.rs — `mod decode_base64_tests`（尾部追加，6 用例）
- tauri/crates/tauri/src/app.rs — `mod tests` 内追加 `runtime_window_event_maps_all_variants`（1 用例）
- wry/src/ohos/mod.rs — `mod tests` 尾部追加 https_intercept 5 用例（含 `https_test_handler` 辅助函数）
- openharmony-ability/crates/plugin-webview/src/callbacks.rs — `mod tests` 尾部追加 5 用例（options 派生 + 三 decision 函数）

**死代码删除（生产代码改动，需重点审）**：
- tauri/crates/tauri/src/app.rs — 删 `send_tao_window_event`（~14 行）+ `ohos_plugin_register` 及其 cfg 块（~18 行）
- openharmony-ability/crates/ability/src/input/mouse_event.rs — 删 legacy NDK 回调全套（extern FFI 声明/两个 thread-local/set_mouse_event_callback/set_axis_event_callback/dispatch_mouse_event/dispatch_hover_event/dispatch_axis_event/register_mouse_callbacks/ARKUI_UIINPUTEVENT_TYPE_AXIS/OnMouseEvent/OnAxisEvent 别名 + 对应测试，458→~180 行）；保留 MouseEventData/AxisEventData/InputSourceType/MouseAction 及全部 From/Default（InputEvent 链仍活）。审计依据：主树 mouse/axis 事件已走 ohos-arkui-binding crate（xcomponent.rs），本路径全库零调用方；删除收益 ~110 分母行待 commit 后体现

**S9 批（driver window ops + Debug fmt + probe 补漏，三轮递进至 70.1%）**：

测试新增（无生产 Rust 代码改动）：
- tauri/examples/api/src/lib/tests/window-ops-extra.ts — 新文件 8 用例（逐调用吞错模式；monitors 五连/badge+progress+overlay+titleBar/setTheme+focus+cursor/setIcon bytes/Float 窗 dragging/setEffects+clearEffects/probe 探针 4 命令/setIcon 合法 PNG；含 [ops2] console 诊断日志 + flushOps2Log 落盘）
- tauri/examples/api/src/views/TestRunner.svelte — coverageTests（VITE_AUTOTEST 门控组）挂载 windowOpsExtraTests
- tauri/crates/tauri-runtime-wry/src/lib.rs — with_config_tests 尾部追加 window_builder_wrapper_debug_formats_fields（+1 测试）
- tao/src/platform_impl/ohos/mod.rs — 文件尾新增 mod fmt_tests（OsError Display，+1 测试）

demo 探针命令（新增 Rust 模块，点亮 JS 面未暴露的 Rust-only API；语义与 driver 盲调用一致，错误聚合返回）：
- tauri/examples/api/src-tauri/src/probe_apis.rs — 新文件 4 命令：probe_app_monitors / probe_app_menu_set_remove（#[cfg(desktop)]）/ probe_window_menu_set_remove（#[cfg(desktop)]）/ probe_webview_reparent
- tauri/examples/api/src-tauri/src/lib.rs — mod probe_apis + generate_handler 4 项（menu 两项 cfg(desktop) 门控，防 mobile 构建炸）
- tauri/examples/api/src-tauri/build.rs — AppManifest commands 补 4 探针名
- tauri/examples/api/src-tauri/capabilities/run-app.json — 补 4 项 allow-probe-* 权限（menu 两项在 mobile 形态为惰性条目，无害）

配置修复（demo 侧，需审）：
- tauri/examples/api/src-tauri/capabilities/run-app.json — 补 8 项 core:window 权限（current-monitor/primary-monitor/available-monitors/monitor-from-point/cursor-position/set-visible-on-all-workspaces/set-title-bar-style/start-resize-dragging）；此前这些 API 全部被 ACL 静默拒绝

基建：
- cov-tools/s9-recover-desktop.sh — s8-recover-desktop.sh 的 OUT 改 s9-cov
- 数据：s9-cov/（app.lcov/merged-app.lcov/s9-exec.json）
