# ohos-continuation-source Specification

## ADDED Requirements

### Requirement: NativeAbility onContinue 预注册快照保存
NativeAbility.ets SHALL override `onContinue(wantParam: Record<string, Object>): AbilityConstant.OnContinueResult`：同步经 NAPI `readContinueSnapshot()` 直读 Rust 侧快照（`CONTINUATION_SNAPSHOT: Mutex<String>`，peek 不 drain），非空则写入 `wantParam.continuationData`（reserved key，原文透传）并返回 `AGREE`；空快照 SHALL 返回 `MISMATCH`。onContinue 全链路 SHALL NOT 使用 `block_on`/`recv`/Promise 等待（同步回调死锁禁令）。

#### Scenario: 快照非空时系统发起迁移
- **WHEN** 应用已调用 `setContinuationData("...")` 且系统触发 onContinue
- **THEN** wantParam.continuationData SHALL 等于快照原文
- **AND** 返回值 SHALL 为 `AbilityConstant.OnContinueResult.AGREE`

#### Scenario: 快照为空时系统发起迁移
- **WHEN** 应用从未 set（或已 setContinuationData("") 清空）且系统触发 onContinue
- **THEN** 返回值 SHALL 为 `AbilityConstant.OnContinueResult.MISMATCH`（显式 opt-in 语义）

#### Scenario: NAPI 读取防御
- **WHEN** primary module 未加载或 `readContinueSnapshot` 不存在（非 OHOS ability 库形态）
- **THEN** onContinue SHALL 安全降级返回 MISMATCH 且不抛异常（typeof 守卫 + try/catch）

#### Scenario: 快照 peek 语义
- **WHEN** onContinue 被连续触发两次（迁移取消后重试）
- **THEN** 两次读到的快照 SHALL 相同（不因读取而清空）

### Requirement: openharmony-ability 快照存储与 NAPI 导出
ability crate SHALL 提供 `CONTINUATION_SNAPSHOT: Mutex<String>` 全局静态 + `store_continue_snapshot(&str)`（覆盖写）+ `peek_continue_snapshot() -> String`（非 drain 读），并导出 `#[napi]` 同步函数 `read_continue_snapshot() -> String`（cfg(target_env = "ohos")，紧邻 update_cursor_position 先例）。`crates/plugin-continuation` facade SHALL 提供 `ContinuationClient::set_continuation_data(String)` 委托。

#### Scenario: 设备侧 UT
- **WHEN** run-ut.sh 跑 ability crate 接续测试
- **THEN** 快照 store 后连续 peek 两次 SHALL 均返回原文（非 drain）
- **AND** 二次 store SHALL 覆盖首值
- **AND** store("") 后 peek SHALL 返回空串

### Requirement: tauri.conf.json 构建期 continuable 门控
`bundle.openHarmony` SHALL 新增可选字段 `continuable: boolean` 与 `continueType: string[]`（缺省均不改变现有行为）。tauri-cli build SHALL 在 `write_entry_device_types` 同一注入点调用 `write_entry_continuation`：`continuable: true` 时写 `abilities[0].continuable = true`，`continueType` 取 conf 值或回退 `["<identifier>"]`；非 true 时 SHALL 从 abilities[0] 移除两 key（支持切回关闭）。

#### Scenario: conf 声明 continuable
- **WHEN** tauri.conf.json `bundle.openHarmony.continuable = true` 且 build
- **THEN** 激活 entry 的 module.json5 abilities[0] SHALL 含 `continuable: true`
- **AND** continueType 缺省时 SHALL 为 `["<identifier>"]`，显式配置时 SHALL 为 conf 值

#### Scenario: conf 未声明或为 false
- **WHEN** `continuable` 缺省或 false 且 build
- **THEN** module.json5 SHALL 不含 continuable/continueType key（与现状一致）

#### Scenario: 存量项目生效
- **WHEN** 已有 gen/ohos（不重新 init）的项目开启 continuable 后重新 build
- **THEN** module.json5 SHALL 被 build 时改写生效（不依赖模板重生成）

### Requirement: tauri-plugin-continuation setContinuationData 命令
插件 SHALL 新增命令 `set_continuation_data(data: string)`：OHOS 经 facade 写快照，体积超过 96 * 1024 字节 SHALL 返回 `PayloadTooLarge` 错误；非 OHOS stub SHALL 返回 `Unsupported`（签名一致）。权限 SHALL 追加 allow-set-continuation-data。

#### Scenario: JS 调用 setContinuationData
- **WHEN** 前端调用 `setContinuationData(data)`
- **THEN** SHALL resolve（快照覆盖写）且后续 onContinue 读到该值

#### Scenario: 超限拒绝
- **WHEN** data 长度 > 96 * 1024 字节
- **THEN** SHALL reject `PayloadTooLarge` 且快照不变

### Requirement: examples demo 与测试
examples/api Continuation.svelte SHALL 增加"保存接续数据"输入区（setContinuationData）；ohos-continuation.ts SHALL 增加 auto 用例（set resolve + 空串清空边界）；双设备完整迁移流 SHALL 以 T1 手动用例记录于 manual_tests.md（含往返约定：目标端 getContinuationData → JSON.parse → .continuationData）。

#### Scenario: 单设备 auto 断言
- **WHEN** TestRunner 跑新增用例
- **THEN** `setContinuationData("...")` SHALL resolve
- **AND** 超限字符串 SHALL reject PayloadTooLarge

#### Scenario: 双设备 T1 手动迁移流
- **WHEN** 两台同账号设备均安装 app 且 continuable 生效，源设备 set 数据后经系统迁移入口发起接续
- **THEN** 源端 hilog SHALL 出现 onContinue AGREE 日志
- **AND** 目标端 isContinuationRestoreLaunch SHALL 为 true 且 getContinuationData 解析后 continuationData 等于源端 set 值
