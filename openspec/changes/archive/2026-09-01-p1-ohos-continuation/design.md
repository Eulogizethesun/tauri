# Design: p1-ohos-continuation

## Context

- 调研结论（2026-08-27，华为官方文档核实）：接续由 UIAbility 生命周期驱动——目标端在 `onCreate(want, launchParam)` / `onNewWant(want, launchParam)` 中以 `launchParam.launchReason === AbilityConstant.LaunchReason.CONTINUATION` 判定，接续 payload 在 `want.parameters`（源端 `onContinue(wantParam)` 写入的键值对，上限 100KB）。
- 现有链路（已核实，路径在 native_ability/src/main/ets/**ability**/ 下）：
  - 冷启动：`NativeAbility.ets:169` 调 `onAbilityCreateWithWant({ uri })`（仅 uri，**launchReason/parameters 未转发**）→ `lifecycle.rs:342-348` 闭包读 `uri` → `app.rs` `store_initial_want_uri` → `INITIAL_WANT_URI` Mutex。
  - 热启动：`NativeAbility.ets:600` 调 `onNewWant({ uri, parametersJson })` → `lifecycle.rs:331-340` 闭包读两字段 → `store_want_parameters` → `WANT_PARAMETERS` Mutex。
  - wire 类型镜像：`type.ets:33-42`（`NewWantData` / `onAbilityCreateWithWant: (data: { uri: string })`）。
  - napi-generated `crates/ability/dist/index.d.ts:97-110` 将两回调参数声明为宽松 `(arg: object)`，无结构化内联类型、无 NewWantData interface（审计已核实）。
- 关键简化：**本 Phase 无需 ArkTS bridge 插件**——接续信号全部经 lifecycle 闭包链流入 Rust 全局 Mutex（同 deep-link 冷启动模式），facade 是纯同步读取，不走 AsyncPluginBase/bridge action/pack-plugins。

## Goals / Non-Goals

- **Goals**: 打通目标端恢复信号链——`launchReason` 判定 + 接续 payload 从 NativeAbility 生命周期回调流到 Rust 可消费的 Mutex；提供 `plugin-continuation` facade；设备侧 UT。
- **Non-Goals**: plugins-workspace 插件（Phase 2c）；源端 `onContinue` 保存（Phase 3c，预注册快照方案）；module.json5 `continuable` 模板门控（Phase 3c）；双设备端到端验证（Phase 3c）；主动迁移（平台不可做，永久排除）。

## Decisions

### D1: ArkTS 侧传布尔 `isContinuation` 而非数值 launchReason

`AbilityConstant.LaunchReason.CONTINUATION` 的数值是 SDK 内部枚举，跨 bridge 传魔法数有版本漂移风险。ArkTS 侧直接比较 `launchParam.launchReason === AbilityConstant.LaunchReason.CONTINUATION`，wire 上只传 `isContinuation: boolean`。这也让 Rust 侧无需 import 枚举语义。

### D2: wire payload 向后兼容扩展（两处对齐）

- `onAbilityCreateWithWant` payload：`{ uri }` → `{ uri, isContinuation?: boolean, parametersJson?: string }`
- `NewWantData`：加 `isContinuation?: boolean`（uri/parametersJson 保持）
- Rust 闭包用 `.unwrap_or(default)` 模式可选读取（同文件 `:179` / `:205-207` 既有 house style——`get_named_property::<bool>("isContinuation").unwrap_or(false)`、`get_named_property::<String>("parametersJson").unwrap_or(String::new())`），字段缺失或类型不符时回退默认值（老 HAR/新 Rust 混跑不炸）。
- **约束（审计修正）**：实际只需**两处对齐**——type.ets 接口 + Rust 闭包。napi-generated index.d.ts 把两回调参数声明为宽松 `(arg: object)`（任何对象字面量都通过），无需也无法手改（auto-generated）；type.ets:32 注释"Must match napi-generated index.d.ts"是误导性表述，两者早已不同构（d.ts 还有 onAbilityRestoreState，type.ets 没有——既有 drift）。

### D3: 存储用两个专用 Mutex（不与 deep-link 的复用）

- `CONTINUATION_RESTORE: Mutex<bool>` —— `isContinuationRestore` 语义，**peek 不 drain**（查询幂等，可多次调用）。
- `CONTINUATION_DATA: Mutex<String>` —— 接续 payload JSON，**draining take**（一次性消费，同 `take_initial_want_uri` 语义；空串 = 非接续启动或已消费）。
- 冷启动（onCreate）与热启动（onNewWant）都写入：`isContinuation === true` 时 store 两者（payload 为 `JSON.stringify(want.parameters)`）；非接续启动 store `CONTINUATION_RESTORE=false` 且**清空** CONTINUATION_DATA（防上次会话残留泄漏到本次冷启动——static Mutex 跨 Ability 实例存活）。
- 不复用 `WANT_PARAMETERS`：该 Mutex 服务 single-instance 插件且每次 onNewWant 无条件覆写，语义混用会让接续数据被普通 want 启动冲掉。

### D4: facade 纯同步、零 bridge 依赖

`crates/plugin-continuation/`：
- `ContinuationClient::is_continuation_restore() -> bool`（读 CONTINUATION_RESTORE peek）
- `ContinuationClient::take_continuation_data() -> String`（drain CONTINUATION_DATA；空串=无/已消费）
- `ContinuationExt` trait on `OpenHarmonyApp`（同 ScreenshotExt 形态，但无 bridge 依赖，仅依赖 openharmony-ability 本体）
- 无 ArkTS 插件、无 bridge action、无 pack-plugins 变更（NativeAbility.ets 改动仍需 HAR 重建）。

### D5: payload 透传不解析

wantParam 内容（源端写的键值对）是应用层契约，facade 只透传 JSON 字符串，不解析、不校验 key（同 deep-link 透传 URI 的哲学）。解析责任在 Phase 2c 的 JS API 消费侧。

### D6: NativeAbility 回调扩展的时序安全

- onCreate：`onAbilityCreateWithWant` 调用点在 per-module 循环内（`:169`），扩展字段后仍是幂等 store（多模块重复写同值无害——与现有 uri store 一致）。
- onNewWant：`forEachLifecycle` 派发（`:600`），同样幂等。
- **不新增回调注入点、不改既有回调顺序**（历史教训：pluginize 重构系统性丢注入点，MEMORY ohos-bridge-refactor-missing-injection-points）；只在既有调用的 payload 里加字段。

### D7: 设备侧 UT（run-ut.sh）

app.rs 内嵌 `#[cfg(test)]` 模块（仿 `want_parameters_tests`）：store/take draining 语义、非接续启动清空残留、CONTINUATION_RESTORE peek 不 drain 三组断言。ArkTS 侧 isContinuation 判定逻辑无法单设备注入（需系统接续触发），真机链路验证留 Phase 2c/3c。

## Risks / Trade-offs

- ~~napi-generated index.d.ts 对齐~~（审计已核实：d.ts 为 `(arg: object)` 宽松类型，无需改；两处对齐即可）。
- **静态 Mutex 跨实例残留**：D3 已用"非接续启动清空"兜底；但仍需 UT 覆盖"两次启动第二次非接续"场景。
- **单设备无法触发真实接续**：本 Phase 只能 UT + hilog 验证链路代码被编译进 HAR；真机端到端留 Phase 2c（fake want 不可行——launchParam 是系统传入；改为 Phase 3c 双设备）。
- **want.parameters 含非序列化值**：`JSON.stringify` 对 undefined/函数会丢 key——透传语义下可接受（源端 onContinue 只写键值对）。

## Resolved Questions

- （已核实，2026-08-27 审计）napi-generated d.ts 不声明闭包参数内联类型——两回调均为 `(arg: object)`；对齐清单 = type.ets + Rust 闭包两处。
- （已核实）`NativeAbility.ets:62` onCreate 签名已含 `launchParam: AbilityConstant.LaunchParam`，`:576` onNewWant 同；AbilityConstant 已 import（`:1`）——无需改签名/加 import。
- （已核实）`get_named_property::<Option<T>>` 全 crates 零先例，须用 `.unwrap_or(default)` house style（lifecycle.rs:179/:205-207）。
