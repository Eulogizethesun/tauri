# ohos-continuation-bridge Specification

## ADDED Requirements

### Requirement: NativeAbility 生命周期回调转发接续信号
`NativeAbility.ets` SHALL 在 `onCreate(want, launchParam)` / `onNewWant(want, launchParam)` 中比较 `launchParam.launchReason === AbilityConstant.LaunchReason.CONTINUATION`，并将判定结果以布尔 `isContinuation` 字段传入既有 lifecycle 转发链（不在 wire 上传数值 launchReason）。回调时序与既有注入点 SHALL 保持不变（仅扩展 payload 字段）。

#### Scenario: 冷启动接续恢复
- **WHEN** 目标端经接续冷启动，`onCreate` 收到 `launchReason === CONTINUATION`
- **THEN** `onAbilityCreateWithWant` payload SHALL 为 `{ uri, isContinuation: true, parametersJson: JSON.stringify(want.parameters) }`
- **AND** 非接续冷启动 SHALL 传 `isContinuation: false`（payload 仍含 uri）

#### Scenario: 热启动接续恢复
- **WHEN** 已运行实例经接续触发 `onNewWant`
- **THEN** `NewWantData` SHALL 在既有 `{ uri, parametersJson }` 基础上增加 `isContinuation` 字段

#### Scenario: 字段向后兼容
- **WHEN** Rust 闭包读取 payload 时任一新字段缺失（老 HAR 混跑）
- **THEN** SHALL 回退默认值（false / 空串）且不 panic

### Requirement: wire 类型两处对齐
`onAbilityCreateWithWant` payload 与 `NewWantData` 的新字段 SHALL 在 type.ets 接口与 Rust lifecycle 闭包两处同步声明（可选字段 `isContinuation?: boolean` / `parametersJson?: string`）。napi-generated index.d.ts 将两回调参数声明为宽松 `(arg: object)`（审计已核实），SHALL 无需修改。

#### Scenario: 类型声明一致
- **WHEN** HAR 重建后编译 entry 模块
- **THEN** ArkTS 编译 SHALL 0 error（无"对象字面量多余属性"错误）

#### Scenario: Rust 闭包向后兼容读取
- **WHEN** Rust 闭包读取 payload 且任一新字段缺失或类型不符（老 HAR 混跑）
- **THEN** SHALL 以 `.unwrap_or(default)` 模式回退（false / 空串）且不 panic（同 lifecycle.rs 既有 windowId 先例）

### Requirement: Rust 侧接续存储 Mutex（store/take）
`crates/ability/src/app.rs` SHALL 提供两个专用全局 Mutex（不复用 WANT_PARAMETERS）：
- `CONTINUATION_RESTORE: Mutex<bool>`——`is_continuation_restore()` peek 读取，不 drain，查询幂等
- `CONTINUATION_DATA: Mutex<String>`——`take_continuation_data()` draining 读取（返回后置空；空串 = 非接续启动或已消费）

冷启动与热启动闭包 SHALL 在 `isContinuation === true` 时 store 两者（payload 为 parametersJson 原文透传，不解析）；`isContinuation === false` 时 SHALL 置 `CONTINUATION_RESTORE=false` 并清空 `CONTINUATION_DATA`（防静态 Mutex 跨 Ability 实例残留）。

#### Scenario: 接续数据一次性消费
- **WHEN** `take_continuation_data()` 连续调用两次
- **THEN** 第一次 SHALL 返回 payload JSON，第二次 SHALL 返回空串

#### Scenario: 非接续启动清残留
- **WHEN** 上次会话为接续启动，本次为普通冷启动
- **THEN** `is_continuation_restore()` SHALL 返回 false，`take_continuation_data()` SHALL 返回空串

#### Scenario: 查询幂等
- **WHEN** 多次调用 `is_continuation_restore()`
- **THEN** SHALL 返回一致结果且不消耗接续数据

### Requirement: plugin-continuation facade 纯同步零 bridge
`crates/plugin-continuation/` SHALL 提供 `ContinuationClient`（`is_continuation_restore() -> bool` / `take_continuation_data() -> String`）与 `OpenHarmonyApp` 上的 `ContinuationExt` trait。facade SHALL 为纯同步 Mutex 读取，SHALL NOT 注册 ArkTS bridge plugin、SHALL NOT 定义 bridge action、SHALL NOT 修改 pack-plugins.ps1。

#### Scenario: facade 调用
- **WHEN** 任意 Rust 代码经 `ContinuationExt::continuation()` 取 client 并调用两方法
- **THEN** SHALL 无阻塞、无 bridge 往返、无主线程派发

### Requirement: 设备侧单元测试
`app.rs` SHALL 内嵌 `#[cfg(test)]` 模块（仿 `want_parameters_tests`）覆盖：take draining 语义、非接续启动清空残留、CONTINUATION_RESTORE peek 不 drain，经 run-ut.sh 真机执行。

#### Scenario: UT 执行
- **WHEN** run-ut.sh 执行 openharmony-ability 测试集
- **THEN** 接续存储相关断言 SHALL 全部通过
