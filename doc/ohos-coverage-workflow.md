# OHOS 覆盖率测试工作流

> 配套文档：[ohos-test-coverage.md](ohos-test-coverage.md)（S1-S9 各阶段叙事与数据）。
> 本文档整理可复用的**操作流程**：测量链怎么跑、补测怎么迭代、坑在哪、怎么校验。

## 0. 总览

```
┌─ A. UT 侧 ──────────── cov-run.sh（每仓独立）──────────► profraw/merged.profdata
├─ B. hap 侧 ─────────── cov-build.sh ─► 真机跑套件 ─► s9-recover-desktop.sh ─► app.lcov
│                          (插桩构建/部署)   (595 用例)      (profraw 回收+导出)
├─ C. 合并+口径 ───────── merge-app-lcov.py + exec-analysis-merged.py ─► s9-exec.json
├─ D. 报告 ───────────── s9-coverage-report.md / html-incr（增量口径）/ html（整文件口径）
└─ E. 补测迭代环 ──────── 从 D 的红行出发 → 五类手段 → 回到 A/B 重测
```

**口径定义（一切计算的根基）**：
- 分母（增量可执行行）= `fork点..HEAD` git diff 非测试新增行 ∩ lcov DA 记录
- 分子 = 分母中 lcov count>0 的行（任意来源点亮即算）
- demo 排除：tauri `examples/api/`、oha `rust_example/`
- 三源 per-line max 合并：各仓 UT profdata + desktop app lcov + mobile app lcov
- fork 点：tauri `a30dca482` / tao `3ecc2a833` / wry `44e26ef27` / muda `597e1bcb3` / tray-icon `c5d077afb` / window-vibrancy `a3a3ff347` / oha `6c52bb441` / pw `8bbc7a0d1`

## 1. 环境前置

- Windows 11 宿主 + Git Bash；设备通过 `hdc` 连接（API 23 真机）
- Rust stable（llvm-cov/llvm-profdata 取自 `rustc --print sysroot`/lib/rustlib/x86_64-pc-windows-msvc/bin —— **必须用 Rust 自带 LLVM 22**，NDK 的 LLVM 15 写 profraw v8 会被拒收）
- OHOS NDK + hvigorw（env.sh 提供 OHOS_HOME）
- 所有仓在 `D:/xuqiu/tauri-3.0/<repo>`，oha 须在 ohdev 分支

## 2. Phase A — UT 侧（cov-run.sh）

```
用法: cov-run.sh <repo_name> <workdir> [package_args...]
例:   cov-run.sh tauri D:/xuqiu/tauri-3.0/tauri -p tauri -p tauri-runtime-wry
```

步骤：插桩编译 → 推二进制到设备 → 设备执行 cargo test → 回收 profraw → 合并 profdata → 导出 JSON。
产物：`<repo>/profraw/merged.profdata` + `target-cov/.../deps/` 下的测试二进制。

**注意**：
- 二进制名匹配模式（BINPAT）——tauri 仓必须 `tauri*`（下划线二进制 `tauri_runtime_wry-*` 不被 `tauri-*` 匹配）
- 跑前清掉 target-cov deps 里**早于最近源码变更**的旧 hash 二进制（否则 llvm-cov 按旧行表输出 count=0 的 DA，分母虚增）

## 3. Phase B — hap 侧（cov-build.sh + recover）

```
cd D:/xuqiu/tauri-3.0 && bash cov-build.sh     # 必须在 workspace 根执行
```

**两种构建形态**：正常 `bash cov-build.sh` = 覆盖率测量（插桩 + `VITE_AUTOTEST`+`VITE_COVERAGE_TESTS` → 595 例全量套件 + `cov-dump`/`fault-injection` feature）；`NOCOV=1 bash cov-build.sh` = 无覆盖率验证的标准 demo（无插桩、283 例标准套件自动跑、仅 `prod` feature）。门控双变量：`VITE_AUTOTEST`=自动跑测试，`VITE_COVERAGE_TESTS`=注入覆盖率批次（仅插桩形态）。

| 步骤 | 内容 |
|---|---|
| Step 0 | oha HAR 有改动则重建（改 ArkTS 后必删 oh_modules+CompileArkTS 缓存） |
| Step 1-2 | 前置检查；`VITE_AUTOTEST=true pnpm build` |
| Step 3 | **直接 cargo 编译插桩 .so**（绕过 ohrs——它用 CARGO_ENCODED_RUSTFLAGS 覆盖 target rustflags，插桩 flag 会丢）；`-Cinstrument-coverage` 注入，build.rs 链接 `profiler_builtins`（LLVM 22 版） |
| Step 3b | 验证 `__llvm_prf` 段存在 |
| Step 4-5 | .so 拷入 gen/ohos，hvigorw assembleHap（desktop/mobile 形态由 build-profile.json5 modules 交换实现） |
| Step 6-7 | hdc install + aa start |
| Step 8-10 | 等 90s autotest；检查/拉取沙箱 profraw |

**真机跑套件的关键时序**：595 用例已超 90s 窗口，**以套件末尾 `dump_coverage` 命令重写的 profraw 为准**（cmd.rs 的 `__llvm_profile_write_file`，TestRunner runAll 末尾调用）。recover 前核对设备 profraw mtime 晚于套件结束（看 test-report.md footer）。

```
cov-tools/s9-recover-desktop.sh    # profraw 回收 → merge → app.lcov
```

mobile 形态：换 `s8-recover-mobile.sh`（或按 s9-recover 改 OUT 目录）。

## 4. Phase C — 合并与口径计算

```
python cov-tools/merge-app-lcov.py s9-cov/app.lcov s8-cov-mobile/app.lcov s9-cov/merged-app.lcov
python cov-tools/exec-analysis-merged.py s9-cov/merged-app.lcov s9-cov/s9-exec.json
```

exec-analysis 内部：每仓 UT export（本仓 profdata+bins）+ app lcov **逐仓合并**（顺序：UT 先、app 并入，勿全局合并——会把 tauri UT 里编译的 wry 源码覆盖算进 wry，导致口径漂移）→ diff 行 ∩ DA → 汇总 JSON。

## 5. Phase D — 报告产出（三层）

| 报告 | 生成方式 | 口径 |
|---|---|---|
| **汇总 md** `s9-cov/s9-coverage-report.md` | 手写/脚本拼 s9-exec.json | 增量口径（官方） |
| **增量口径 HTML** `s9-cov/html-incr/index.html` | `render-incr-html.py` | 增量口径，**内置逐位校验**（与 s9-exec.json 不一致即退出） |
| 整文件口径 HTML `s9-cov/coverage-index.html` | `llvm-cov show --format=html` | 整文件（含上游代码），仅参考 |

增量口径 HTML 配色：绿=增量行已覆盖(×次数) 红=未覆盖 黄=改动非可执行 蓝=测试行 无色=上游。
入口页 `s9-cov/coverage-index.html` 汇总三层 + 各仓 UT 报告。

## 6. Phase E — 补测迭代环

1. **定位黑行**：`html-incr` 仓目录页按未覆盖行排序 → 文件页看红行
2. **判性质**（决定用哪类手段）：

| 手段 | 适用 | 产出参考 |
|---|---|---|
| driver 盲调用（gen-driver.py） | JS API 面暴露的入口，大面积扫 | S2 +6.3pt |
| 错误路径（坏输入 / fault injection） | 校验/异常分支 | S3/S4 +0.1pt（大多已被盲调用天然失败覆盖——**先测再补**） |
| 纯函数 UT（cargo test） | JS 面未暴露的纯变换（From/映射/枚举） | S6/S7 +4.1pt |
| driver 补批（attempt() 逐调用吞错） | 链式 smoke 会连坐饿死的 op 群 | S9 +2.3pt |
| demo 探针命令（probe_apis.rs） | 仅 Rust 侧可达的 API（AppHandle 方法等） | S9 round 3 |
| 死代码删除 | 审计零调用方的 legacy 代码 | S7（分母直接出） |

3. **补完重测**：改了测试/源码 → 回 Phase A/B 重跑 → 数字对比
4. **不可点亮判定**：上游平台门控（如 `#[cfg(target_os="macos")]` 注册的命令）不硬凑，记入文档

## 7. 陷阱清单（按踩坑频率）

| 陷阱 | 症状 | 规避 |
|---|---|---|
| **ACL 双登记缺失** | invoke 被静默拒，`.catch(()=>null)` 伪装成"返回 null"，整批测试白跑 | 新命令必须同时登记 build.rs AppManifest + capabilities；测前对 capability 清单与 JS API 面 diff |
| **profraw 时序** | Step 9 拿到中途快照，尾部用例全黑 | 以套件末 dump_coverage 重写的文件为准，核对 mtime |
| **旧 hash 测试二进制** | 分母虚增（count=0 DA） | cov-run 前清 target-cov deps 旧二进制 |
| **BINPAT 下划线** | tauri_runtime_wry 二进制不被 `tauri-*` 匹配 | tauri 仓用 `tauri*` |
| **capability windows 匹配** | Float 窗上所有 invoke 被拒 | 测试窗口 label 一律 `test-` 前缀 |
| **hap 侧改动后复用旧 app lcov** | 混编号伪影（分母虚推） | 生产代码一变就重建插桩 hap |
| **diff 纯迁移噪声** | 分母混入上游搬家行（tauri 仓 ~78% 是迁移行） | 官方口径保持 plain 一致可比；`-w` 复算留参考（70.1% vs 72.4%） |
| **menu 命令进 mobile 构建** | `tauri::menu` desktop-only，mobile 编译炸 | demo 探针命令 `#[cfg(desktop)]` 门控 |
| **driver 危险命令** | navigate/reload 卸载主窗口 SPA、close_test_window 自杀 | EXCLUDED 清单（gen-driver.py） |
| **.cargo/config.toml 残留** | NOCOV 对照构建仍被插桩（A/B 失效） | cargo 把 config `[target.<triple>] rustflags` 与 env `CARGO_TARGET_<triple>_RUSTFLAGS` **拼接**（实测非覆盖）；残留的 `src-tauri/.cargo/config.toml` 硬编码 instrument-coverage 已删；插桩与否以 .so 的 `__llvm_prf` 段实测为准 |

## 8. 校验点（每轮必做）

1. **exec-analysis 复算必须复现上一轮未变更部分**（分母不变时 cov 不应变，变化即测量伪影）
2. **增量 HTML 渲染器内置逐位校验**：与 s9-exec.json 不一致即退出
3. **HTML 链接全量检查**（661 链接 0 死链）
4. 真机套件 595 用例全绿（test-report.md footer + probe 结果在 console-log.txt）
