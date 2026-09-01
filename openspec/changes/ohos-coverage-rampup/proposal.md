# Proposal: OHOS 增量覆盖率提升（S1-S5 阶段计划）

## Why

llvm-cov 双链路已跑通：UT 侧设备测试真机全绿（可执行口径 12.2%，1591/13075），hap 内嵌插桩闸门已通过（2026-08-22，cov-build.sh）。但团队增量 diff 的可执行代码覆盖仍有 11284 行未覆盖。

函数级+行级内容分析（`uncovered-fns.json` / `uncovered-composition.json`）表明未覆盖行的构成：

- **~75% 是未被任何测试调用的 API 的调用续行**（与所属调用同生共死，调用即覆盖）
- **~13% 分支行 + ~6% 显式错误构造**（错误分支需故障注入或坏输入触发）
- 其余为一次性 init 兜底、多实例路径

用户目标：增量覆盖率接近 95%。实测推演结论：**可执行口径可达 85-90%，95% 存在 ~8-12% 结构性死角**（一次性 init 失败分支、版本/形态门控另一侧、防御性 unreachable、真环境前置）。本方案以 **85-90% 为工程目标，95% 通过 documented-exclusions 口径达成**（把结构性死角列成排除清单后计算——业界标准做法）。

## What Changes

五个阶段（详细设计见 design.md，任务分解见 tasks.md）：

| 阶段 | 内容 | 预期（可执行口径） | 工作量 |
|---|---|---|---|
| S1 | 路径 A 全量覆盖跑 + windowOpsTests 一行修复 | 12.2% → ~60% | 0.5 天 |
| S2 | driver 盲调用套件（从 uncovered-fns.json 生成）+ 手动按钮插桩期自动化 | ~60% → 72-75% | 2-3 天 |
| S3 | 坏输入错误用例（非法 JSON/无效 id/越界参数/不可达 URL） | → 78-80% | 2 天 |
| S4 | openharmony-ability 故障注入 feature（ArkTS bridge 边界 mock 错误/延迟/异常） | → 83-86% | 4-5 天 |
| S5 | mobile 形态插桩构建 + 按 per-line max 合并 desktop/mobile lcov | → 87-90% | 3 天 |

配套：排除清单（documented exclusions）+ 基线更新流程（每阶段跑完更新 `doc/ohos-test-coverage.md` 第〇节基线表）。

## Capabilities

### New Capabilities
- `ohos-coverage-driver`: examples/api 新增 category: 'driver' 测试类——从覆盖数据反向生成的盲调用用例（只执行不校验），专用于点亮未被调用的 API 路径。
- `ohos-fault-injection`: openharmony-ability 新增 feature-gated 故障注入机制——测试构建下可指定 (plugin, method) 返回错误码/延迟/异常，点亮 Rust 侧错误处理分支。

## Impact

- **examples/api**：TestRunner.svelte（windowOpsTests 挂载 + driver 套件注册）、src/lib/tests/ 新增 driver-*.ts 与 bad-input-*.ts、src-tauri 已有 cov-dump feature 复用。纯测试基建改动，不影响 app 产线功能。
- **openharmony-ability**（仅 S4）：新增 `fault-injection` feature，ArkTS bridge 分发层加注入检查点 + Rust 侧配置命令。feature 门控，产线构建零影响。需走 design→audit→apply→build 流程。
- **其他平台**：无影响。全部改动 feature-gated / 测试文件，铁律#1/#2/#3 合规（ArkTS 改动集中在 oha，cfg/feature 门控隔离）。
- **工具链**：`tauri/cov-build.sh` 扩展支持 mobile 形态；incr-cov2.py 扩展合并 app .so 的 lcov。
