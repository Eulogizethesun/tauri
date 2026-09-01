---
name: ohos-coverage
description: Tauri OHOS 增量测试覆盖率的完整测量链（UT 插桩 + hap 插桩 + 三源合并 + 增量口径计算 + HTML 报告）。覆盖率测试直接调本 skill。使用场景：(1) 测量 fork..HEAD 增量行覆盖率（595 例全量套件，bash cov-build.sh 插桩构建），(2) 出官方口径/增量口径 HTML 报告，(3) 定位未覆盖行并补测试（driver 盲调用/纯函数 UT/probe 探针），(4) 复核覆盖率数字或排查测量伪影（profraw 时序、旧二进制、口径漂移），(5) 构建无覆盖率验证的标准 demo（283 例，NOCOV=1）。
---

# ohos-coverage

Tauri OHOS 增量测试覆盖率测量链。覆盖五个阶段：**A** UT 侧插桩 → **B** hap 侧插桩真机跑 → **C** 三源合并口径计算 → **D** 报告产出 → **E** 补测迭代。

> 叙事与历史数据见 `tauri/doc/ohos-test-coverage.md`（S1-S9 各阶段演进），操作细节的完整版见 `tauri/doc/ohos-coverage-workflow.md`。本 SKILL 是可执行的操作入口。

## 0. 口径（一切计算的根基）

- **分母（增量可执行行）** = `fork点..HEAD` git diff 非测试新增行 ∩ lcov DA 记录
- **分子** = 分母中 count>0 的行（任意来源点亮即算）
- **三源 per-line max 合并**：各仓 UT profdata + desktop app lcov + mobile app lcov
- **demo 排除**：tauri `examples/api/`、openharmony-ability `rust_example/`
- **fork 点**：tauri `a30dca482` / tao `3ecc2a833` / wry `44e26ef27` / muda `597e1bcb3` / tray-icon `c5d077afb` / window-vibrancy `a3a3ff347` / oha `6c52bb441` / pw `8bbc7a0d1`

当前定版数字（S10, 2026-08-24）：**TEAM 10123/14377 = 70.4%**；API 面 256/264 = 97.0%；新增接口 35/41 = 85.4%（可测 100%）。重算时未变更部分的数字必须逐位复现，否则是测量伪影。

## 1. 环境前置

- Windows 11 宿主 + Git Bash；设备经 `hdc` 连接（API 23）
- **llvm-cov/llvm-profdata 必须用 Rust 自带 LLVM 22**（`rustc --print sysroot`/lib/rustlib/x86_64-pc-windows-msvc/bin）——NDK 的 LLVM 15 写 profraw v8 会被拒收
- OHOS NDK + hvigorw（env.sh 提供 OHOS_HOME）
- 所有仓在 `D:/xuqiu/tauri-3.0/<repo>`，**oha 必须在 ohdev 分支**
- 脚本位置：workspace 根 `cov-build.sh` + `cov-tools/`（cov-run.sh、s9-recover-desktop.sh、s8-recover-mobile.sh、exec-analysis-merged.py、merge-app-lcov.py、render-incr-html.py、incr-cov2.py、gen-driver.py、api-coverage.py（API 面）、api-coverage-incr.py（新增接口））

## 2. Phase A — UT 侧

```bash
bash cov-tools/cov-run.sh <repo_name> <workdir> [package_args...]
# 例: bash cov-tools/cov-run.sh tauri D:/xuqiu/tauri-3.0/tauri -p tauri -p tauri-runtime-wry
#     bash cov-tools/cov-run.sh muda D:/xuqiu/tauri-3.0/muda -p muda
```

流程：插桩编译（追加 `CARGO_TARGET_AARCH64_UNKNOWN_LINUX_OHOS_RUSTFLAGS`，**不能用 RUSTFLAGS**——会覆盖链接器参数）→ 推二进制到设备 → **设备上直接执行测试二进制**（`cargo test --no-run` 只编译，二进制经 hdc 推送后在设备跑，设备上没有 cargo）→ 回收 profraw → 合并 profdata。产物：`<repo>/profraw/merged.profdata` + `<repo>/target-cov/.../deps/` 测试二进制。

**跑前必做**：
- 清 target-cov deps 里**早于最近源码变更**的旧 hash 二进制（否则 llvm-cov 按旧行表输出 count=0 DA，分母虚增）
- tauri 仓 BINPAT 必须 `tauri*`（下划线二进制 `tauri_runtime_wry-*` 不被 `tauri-*` 匹配）

## 3. Phase B — hap 侧

```bash
cd D:/xuqiu/tauri-3.0 && bash cov-build.sh    # 必须在 workspace 根执行
```

**两种构建形态（按目的选）**：

| 目的 | 命令 | 套件 | 特征 |
|---|---|---|---|
| **覆盖率测量**（需要 595 例全量套件） | `bash cov-build.sh` | 595 例（283 标准 + 304 覆盖率批次 + 8 window-ops-extra） | 插桩 + `VITE_AUTOTEST`+`VITE_COVERAGE_TESTS` + `cov-dump`/`fault-injection` feature |
| **无覆盖率验证的标准 demo** | `NOCOV=1 bash cov-build.sh` | 283 例（标准集，自动跑） | 无插桩、仅 `VITE_AUTOTEST`（无 `VITE_COVERAGE_TESTS`）、仅 `prod` feature |

**前端门控双变量**（`views/TestRunner.svelte`）：`VITE_AUTOTEST` = 自动跑测试（主窗口 mount 即跑，283 标准集）；`VITE_COVERAGE_TESTS` = 注入覆盖率批次（driver/side-replay/bad-input/fault/window-ops-extra，共 312 例，仅 cov-build.sh 插桩形态设置）。普通 demo（`cargo tauri ohos run`，两变量都不设）不自动跑，手动点 Run All 也是 283。

关键步骤（详见脚本 Step 0-10）：oha HAR 有改动则重建（**Step 0 不自动清缓存**——改 ArkTS 后须手动删 oh_modules + CompileArkTS 缓存，否则 hvigor 命中旧 hash 假成功）→ `pnpm build`（插桩形态加 `VITE_AUTOTEST=true`）→ **直接 cargo 编译插桩 .so**（绕过 ohrs——它用 CARGO_ENCODED_RUSTFLAGS 覆盖 target rustflags，插桩 flag 会丢）→ 验证 `__llvm_prf` 段 → hvigorw assembleHap → hdc install + aa start → 等 90s。

NOCOV 形态用于验证插桩对行为无影响的 A/B 实验。**判插桩与否一律以 .so 的 `__llvm_prf` 段实测为准**——cargo 会把 `.cargo/config.toml` 的 `[target.<triple>] rustflags` 与 `CARGO_TARGET_<triple>_RUSTFLAGS` 环境变量**拼接**（非覆盖，实测验证），任何残留的 config.toml 硬编码 flag 都会静默生效。2026-08-24 A/B 终版结论：595 例套件插桩/非插桩两轮均 570✅/5❌/20⏭️（唯一一轮差异 store.lifecycle 为 ENOENT flaky，重跑即过）；283 例标准 demo 281✅/1❌(clipboard 平台限制)/1⏭️(haptics 无马达)，与插桩基线标准子集逐项一致。

**595 用例已超 90s 窗口：以套件末尾 `dump_coverage` 命令重写的 profraw 为准**（cmd.rs 的 `__llvm_profile_write_file`）。回收前核对设备 profraw mtime 晚于套件结束时间。

```bash
bash cov-tools/s9-recover-desktop.sh    # profraw 回收 → merge → app.lcov
```

mobile 形态须从头切：`OHOS_DEVICE_TYPE=mobile bash cov-build.sh`（默认 desktop——不切的话 mobile profraw 仍来自 desktop hap）→ 跑套件 → `bash cov-tools/s8-recover-mobile.sh`。

**hap 侧代码一变就必须重建插桩 hap，不可复用旧 app lcov**（混编号伪影，分母虚推）。

## 4. Phase C — 合并与口径计算

```bash
python cov-tools/merge-app-lcov.py s9-cov/app.lcov s8-cov-mobile/app.lcov s9-cov/merged-app.lcov
python cov-tools/exec-analysis-merged.py s9-cov/merged-app.lcov s9-cov/s9-exec.json
```

**"三源"是两步合并**：先把 desktop + mobile 两个 app lcov 合成 `merged-app.lcov`（一步），exec-analysis 再每仓"本仓 UT export 先、app lcov 后并入"（二步）。数学上等价于三源 per-line max（max 可结合），但实现上是两步——新人别去找"第三个 merge 调用"。

**mobile app.lcov 是 S8 遗留产物**（S9 只重测了 desktop）。mobile 生产代码自 S8 后有变的话，须先 `OHOS_DEVICE_TYPE=mobile bash cov-build.sh` + `s8-recover-mobile.sh` 重测，否则 S9 数字不可复现。

**合并顺序铁律**：每仓**本仓 UT export 先、app lcov 后并入**（逐仓合并）。绝不能全局合并——tauri UT 二进制里编译了 wry/tao 源码（path deps），全局合并会把它们错算进 wry/tao 口径，导致数字漂移（wry 847 vs 773 的真实教训）。

## 5. Phase D — 报告产出（三层）

| 报告 | 生成方式 | 口径 |
|---|---|---|
| 汇总 md `s9-cov/s9-coverage-report.md` | 手写/拼 s9-exec.json | 增量（官方） |
| **增量口径 HTML** `s9-cov/html-incr/` | `python cov-tools/render-incr-html.py` | 增量，**内置逐位校验** |
| 整文件口径 HTML `s9-cov/html/` | `llvm-cov show --format=html` | 整文件（含上游代码），仅参考 |

增量 HTML 配色：绿=增量行已覆盖(×次数) 红=未覆盖 黄=改动非可执行 蓝=测试行 无色=上游。入口页 `s9-cov/coverage-index.html`。

**render-incr-html.py 前置依赖**（缺了会静默算 0，不报错）：`s9-cov/merged-app.lcov`（merge 产出）+ `s9-cov/s9-exec.json`（exec-analysis 产出）+ 每仓 `profraw/merged.profdata` + `target-cov/.../deps/<BINPAT>`（cov-run 产出）。跑它之前 Phase A 各仓必须先跑完。

整文件口径 HTML 命令（无脚本，手敲；源文件路径必须是绝对路径，相对路径匹配不到 SF 记录）：
```bash
LLVM=$(rustc --print sysroot)/lib/rustlib/x86_64-pc-windows-msvc/bin
"$LLVM/llvm-cov.exe" show --format=html --output-dir s9-cov/html \
  --instr-profile s9-cov/app.profdata \
  tauri/target/aarch64-unknown-linux-ohos/release/libapi_lib.so \
  D:/xuqiu/tauri-3.0/tauri/crates/tauri/src/app.rs  # 其余源文件依次列出
```

## 6. Phase E — 补测迭代环

1. **定位黑行**：`html-incr/<repo>/index.html` 按未覆盖行排序 → 文件页看红行
2. **判性质选手段**：

| 手段 | 适用 | 历史产出 |
|---|---|---|
| driver 盲调用（`cov-tools/gen-driver.py`） | JS API 面暴露的入口，大面积扫。产物：`examples/api/src/lib/tests/driver-generated.ts`（需手动接进 test-runner）+ `s1-cov/driver-candidates.md` | S2 +6.3pt |
| 错误路径（坏输入/故障注入） | 校验/异常分支 | S3/S4 +0.1pt（多已被盲调用天然覆盖——**先测再补**） |
| 纯函数 UT（cargo test） | JS 面未暴露的纯变换（From/映射/枚举） | S6/S7 +4.1pt |
| driver 补批（attempt() 逐调用吞错） | 链式 smoke 会连坐饿死的 op 群 | S9 +2.3pt |
| demo 探针命令（probe_apis.rs） | 仅 Rust 侧可达的 API（AppHandle 方法等） | S9 round 3 |
| 死代码删除 | 审计零调用方的 legacy 代码 | S7（分母直接出） |

3. **补完重测**：改了测试/源码 → 回 Phase A/B 重跑 → 数字对比
4. **不可点亮判定**：上游平台门控（如 `#[cfg(target_os="macos")]` 注册的命令，~45 行）不硬凑，记入文档

## 7. 陷阱清单（按踩坑频率）

| 陷阱 | 症状 | 规避 |
|---|---|---|
| **ACL 双登记缺失** | invoke 被静默拒，`.catch(()=>null)` 伪装成"返回 null"，整批测试白跑 | 新命令必须同时登记 build.rs AppManifest + capabilities；测前对 capability 清单与 JS API 面 diff |
| **profraw 时序** | Step 9 拿到中途快照，尾部用例全黑 | 以套件末 dump_coverage 重写的文件为准，核对 mtime |
| **旧 hash 测试二进制** | 分母虚增（count=0 DA） | cov-run 前清 target-cov deps 旧二进制 |
| **BINPAT 下划线** | tauri_runtime_wry 二进制不被匹配 | tauri 仓用 `tauri*` |
| **capability windows 匹配** | Float 窗上所有 invoke 被拒 | 测试窗口 label 一律 `test-` 前缀 |
| **hap 侧改动后复用旧 app lcov** | 混编号伪影（分母虚推） | 生产代码一变就重建插桩 hap |
| **diff 纯迁移噪声** | 分母混入上游搬家行（tauri 仓 ~78% 是迁移行） | 官方口径保持 plain 一致可比；`-w` 复算留参考（70.1% vs 72.4%） |
| **menu 命令进 mobile 构建** | `tauri::menu` desktop-only，mobile 编译炸 | demo 探针命令 `#[cfg(desktop)]` 门控 |
| **driver 危险命令** | navigate/reload 卸载主窗口 SPA、close_test_window 自杀 | EXCLUDED 清单（gen-driver.py） |
| **全局 lcov 合并** | wry/tao 口径虚涨（tauri UT 含其源码） | 逐仓合并：本仓 UT 先、app 并入 |
| **.cargo/config.toml 残留** | NOCOV 对照构建仍被插桩（A/B 实验失效）；来源是 08-22 path-A 实验残留的 `src-tauri/.cargo/config.toml` 硬编码 `-C instrument-coverage` | cargo 对 `[target.<triple>] rustflags`（config）与 `CARGO_TARGET_<triple>_RUSTFLAGS`（env）是**拼接**而非覆盖（已实测验证）；该残留已删除；判插桩与否一律以 .so 的 `__llvm_prf` 段实测为准，不信构建日志 |

## 8. 每轮必做校验

1. exec-analysis 复算必须**逐位复现**上一轮未变更部分（分母不变时 cov 不应变）
2. 增量 HTML 渲染器内置逐位校验：与 s9-exec.json 不一致即 `SystemExit(1)`
3. HTML 链接全量检查（历史 661 链接 0 死链）
4. 真机套件全绿（test-report.md footer + probe 结果在 console-log.txt）

## 9. 复现链（S9 终版）

```bash
bash cov-tools/cov-run.sh <repo> <wd> [-p ...]     # 每仓 UT 插桩（7 仓）
cd D:/xuqiu/tauri-3.0 && bash cov-build.sh         # desktop 插桩 hap + 部署
# 真机跑完 595 用例（以套件末 dump_coverage 重写的 profraw 为准）
bash cov-tools/s9-recover-desktop.sh               # → s9-cov/app.lcov
# mobile 复用 S8 产物 s8-cov-mobile/app.lcov（mobile 代码有变须重测，见 §3）
python cov-tools/merge-app-lcov.py s9-cov/app.lcov s8-cov-mobile/app.lcov s9-cov/merged-app.lcov
python cov-tools/exec-analysis-merged.py s9-cov/merged-app.lcov s9-cov/s9-exec.json
python cov-tools/render-incr-html.py               # → s9-cov/html-incr/（自校验）
```
