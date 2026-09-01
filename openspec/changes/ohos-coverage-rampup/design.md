# Design: OHOS 增量覆盖率提升 S1-S5

## 〇、口径与目标定义

**主口径（可执行行口径）**：团队全量 diff（8 个 fork 点...HEAD）的非测试新增行 ∩ llvm-cov DA 记录（即可执行行），排除 demo（examples/api、oha rust_example）。当前 12.2%（1591/13075）。

**95% 口径（documented exclusions）**：主口径分子/分母均剔除排除清单（见 §六）后计算。用于对外汇报"接近 95%"时的诚实表述：*"可执行行覆盖率 X%，剔除结构性不可达行（清单见附录）后 Y%"*。

**合并规则**：多个覆盖来源（UT 二进制、desktop app .so、mobile app .so）各自导出 lcov，**按 SF 文件 + DA 行号取 max** 合并后再与 diff 求交。禁止跨来源合并 profdata（function hash 不匹配）。

## 一、S1：路径 A 全量覆盖跑（0.5 天）

**内容**：
1. 修复 `TestRunner.svelte:70`：`allTests` 数组补 `...windowOpsTests`（11 个真实窗口操作测试三周来从未执行，这是 bug 修复不是新增）
2. `cov-build.sh` 重打插桩 hap → 签名 → `bm install -r`
3. 冷启动 app → 283 用例自动跑（~90 秒）→ 周期 flush 线程持续落盘
4. 回收：`hdc file recv /data/app/el2/100/base/com.tauri.api/cache/cov-app-*.profraw`
5. `llvm-profdata merge -sparse` → `llvm-cov export --format=lcov --object <app .so> --instr-profile <profdata>`
6. incr-cov2.py 扩展：`--app-lcov <path>` 参数，把 app lcov 并入 per-line max 合并

**验收**：产出新的团队口径数字；windowOpsTests 11 个用例出现在 test-report.md；预估校准点——若实测 < 50%，后续阶段预估整体下调 5-8pt；若 ≥ 65%，上调。

**风险**：插桩 release 构建的 .so 与 UT 二进制 function hash 不同——已通过 lcov 行级合并规避，无风险。

## 二、S2：driver 盲调用套件（2-3 天）

**原理**：未覆盖行 75% 是"没人调用的 API"的续行。不需要断言，执行即覆盖。

**架构**：
1. **生成器**（脚本，一次性）：读 `uncovered-fns.json` + 各仓 tauri 命令注册表，把未覆盖函数映射为 `@tauri-apps/api` 调用序列，产出 `src/lib/tests/driver-generated.ts`（模板生成，带 `// @generated` 头，人工审后入库）
2. **运行时**：`TestCase { category: 'driver', fn }`——每个用例 invoke 对应命令并 catch 所有错误（错误本身也是覆盖——错误分支被点亮）；单用例 timeout 3s；失败不阻塞后续
3. **注册**：TestRunner allTests 追加 `...driverTests`；报告单列 driver 类别统计（pass = 未抛非预期 panic，skip = 命令不存在）

**driver 用例的安全约束**：
- 白名单制：只生成参数安全的调用（只读 getter、幂等 setter、显式传无效参数的错误路径用例归 S3）
- 破坏性操作排除（relaunch、process exit、窗口销毁后不再创建）
- 需要真实环境的调用（dialog 打开、权限弹窗）归入手动按钮清单，不在 driver 盲调用

**手动按钮插桩期自动化**：vibrancy setEffects、openUrl、print、setFocus 等"难断言不难执行"的用例，在 test-runner 末尾追加"side-effect 复放"段（无断言调用），~30 个。

**验收**：driver 套件 ≥ 150 用例；S1+S2 实测 ≥ 70%；`uncovered-fns.json` 中 diff_exec≥5 的函数减半。

## 三、S3：坏输入错误用例（2 天）

**原理**：~6% 显式错误分支中约半数可由坏输入直接触发，无需 mock。

**用例矩阵**（每类 3-5 个代表用例，不追求穷举）：
| 输入类别 | 触发的路径 | 示例 |
|---|---|---|
| 非法 JSON 参数 | serde 反序列化 Err 分支 | `invoke('set_size', {logical: "not-a-number"})` |
| 不存在的资源 id | lookup Err 分支 | `invoke` 带已销毁 window/webview id 的操作 |
| 越界/非法值 | 参数校验分支 | 负 radius、空 label、超长字符串 |
| 不可达 URL/路径 | 网络/文件 Err 分支 | `http://192.0.2.1:1`（RFC5737 不可达）、不存在路径 |
| 权限拒绝 | 权限检查 Err 分支 | `atm` 先吊销 clipboard/位置权限再调（用例前置 hdc 命令，或纯靠 bad path） |

**验收**：serde/lookup 类错误分支覆盖可见增长（fn-analysis 复跑对比）；不引入测试间串扰（错误用例放 driver 套件尾部，且不依赖执行顺序）。

## 四、S4：故障注入（4-5 天，需 design→audit→apply→build 全流程）

**原理**：bridge 失败类错误分支（ArkTS 返回错误码/异常/超时）无法用坏输入触发——错误发生在 ArkTS 侧。mock 点必须在 **ArkTS bridge 分发边界**（llvm-cov 只测 Rust，Rust 的 `if let Err` handler 体需要对端真实返回错误）。

**设计**（openharmony-ability，feature `fault-injection`）：

```
配置（Rust 侧测试命令）:
  invoke('plugin_fault_injection|set_rule', { plugin: "window", method: "set_fullscreen", outcome: {type: "error", code: 1300004} })
    → 经现有 bridge 通道下发到 ArkTS FaultInjectionRegistry

注入点（ArkTS 侧）:
  bridge dispatch 层（plugin 方法查找后、真实调用前）:
    if (FaultInjectionRegistry.match(plugin, method)) → 按 outcome 返回
    outcome 类型: error(code) | exception(msg) | delay(ms) 后正常返回 | timeout(永不返回)

清理:
  invoke('plugin_fault_injection|clear') → 清空注册表（每用例 teardown 调用）
```

**关键约束**：
- 整个注册表+检查点包在 `feature = "fault-injection"` 下，产线构建零开销零代码（cfg 门控 Rust 侧 + ArkTS 条件编译/运行时开关由 Rust 侧 set 时才初始化——倾向后者：ArkTS 无条件编译 feature，由一个运行时 flag 控制，flag 只在 Rust 侧 cov-dump+fault-injection 构建里置 true）
- 铁律#1 合规：注入点在 oha 内部 dispatch 层，不新增跨仓 ArkTS 调用
- 超时注入用于点亮 Rust 侧超时/兜底分支（先例：requestPermissionsFromUser 四路兜底）

**用例**：对 `uncovered-fns.json` 中错误分支密集的函数（webview_getter/window_getter 的 Err 传播、bridge call 超时、OnceLock 已初始化路径）逐个注入；~40-60 个用例。

**验收**：显式错误构造行覆盖从 ~0 提升至 ≥ 60%；audit 复核 feature 门控完整性（产线 cargo check 无 fault-injection 代码）。

## 五、S5：mobile 形态插桩合并（3 天）

**原理**：cfg(mobile) 代码不编译进 desktop 二进制，desktop 口径里这些行"不在分母"——但团队 diff 的 mobile 行在 raw 口径里是未覆盖。补 mobile 插桩构建才能盖到。

**内容**：
1. `cov-build.sh` 加 `--device-type mobile` 分支（复用 ohrs 绕过 + cov-dump 链路；mobile 模板 entry_mobile 的 build-profile.json5 同样 strip:false）
2. mobile hap 安装 → 跑同一套 driver/auto 用例（mobile 适用的子集——plugins-workspace mobile 插件 + window ops 的 mobile 行为）
3. incr-cov2.py：desktop lcov + mobile lcov + UT lcov 三方 per-line max 合并

**风险**：mobile 构建 plugins-workspace 有已知缺口（opener/window-state 已修，见 mobile-build-fix 记忆）；mobile autotest 子集需挑选（部分用例依赖 desktop 才有的窗口形态）。

**验收**：mobile 专属行（如 mobile.rs、mobile 插件路由）覆盖非零；总口径达到 87-90% 区间。

## 六、排除清单（documented exclusions，随每阶段更新）

| 类别 | 估行数 | 说明 |
|---|---|---|
| 一次性 init 失败分支 | ~300-400 | `set_ohos_app` 二次 set、OnceLock 已初始化、`ArkHelper not initialized` 兜底——进程生命周期内不可重放 |
| 版本/形态门控另一侧 | ~400-600 | `sdk_api_version` 阈值两侧只能盖一侧；desktop/mobile 互斥分支各盖一侧（S5 后大幅缩小） |
| 防御性 unreachable | ~100-200 | `unreachable!`、不可能的 match 臂、纯防御断言 |
| 真环境前置 | ~200-300 | AppGallery 真实更新源、系统打印对话框取消路径、系统级拖拽事件 |
| **合计** | **~1000-1500（8-11%）** | 主口径 87-90% ⇒ exclusions 口径 ≈ 95-98% |

## 七、基线与汇报流程

每阶段完成：
1. incr-cov2.py 跑三来源合并 → 新数字
2. `doc/ohos-test-coverage.md` 第〇节基线表加一行（阶段、日期、口径、数字）
3. fn-analysis 复跑，更新未覆盖函数清单 → 下一阶段生成器的输入
4. 阶段实测与预估偏差 > 5pt 时，重排后续阶段优先级

## 八、风险汇总

| 风险 | 缓解 |
|---|---|
| driver 盲调用引发真机不稳定（窗口堆积/状态污染） | 白名单 + 用例间清理钩子 + 单用例超时；参照 vibrancy rerun label 撞残留窗口的先例（时间戳化 label） |
| 故障注入改动 oha 分发层引入产线回归 | feature 完全门控 + audit 复核 + 产线构建 cargo check/ArkTS 编译双验证 |
| mobile 构建链路新坑 | 已有 desktop 链路全部踩平；mobile 复用同一 cov-build.sh 参数化 |
| 覆盖率数字再度失真 | 一律 lcov DA 行级数据为准；新增来源先小样本人工抽查 3 个文件的行覆盖 |
