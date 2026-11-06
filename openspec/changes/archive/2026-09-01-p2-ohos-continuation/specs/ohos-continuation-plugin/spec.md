# ohos-continuation-plugin Specification

## ADDED Requirements

### Requirement: tauri-plugin-continuation 提供 OHOS 应用接续恢复查询插件
`plugins-workspace/plugins/continuation/` SHALL 提供 OHOS 专属插件 `tauri-plugin-continuation`：命令 `is_continuation_restore` / `get_continuation_data` 经 Phase 1c 交付的 `openharmony-ability-plugin-continuation` facade（`ContinuationClient`）读取 Rust 侧接续存储。所有 OHOS 代码 SHALL 通过 `cfg(target_env = "ohos")` 隔离；非 OHOS 平台命令 SHALL 返回 `Unsupported` 错误。

#### Scenario: JS 调用 isContinuationRestoreLaunch
- **WHEN** 前端调用 `isContinuationRestoreLaunch()`（invoke `plugin:continuation|is_continuation_restore`）
- **THEN** SHALL 返回布尔值（peek 语义，幂等可重复调用）
- **AND** 普通启动（非接续）SHALL 返回 false

#### Scenario: JS 调用 getContinuationData
- **WHEN** 前端调用 `getContinuationData()`（invoke `plugin:continuation|get_continuation_data`）
- **THEN** SHALL 返回 `string | null`（draining take 语义：一次消费）
- **AND** 接续 payload SHALL 原文透传（JSON 字符串，key 契约由应用层定义）
- **AND** 非接续启动或已消费 SHALL 返回 null（空串归一化，非 ""）

#### Scenario: 非 OHOS 平台调用
- **WHEN** 在 Windows/macOS/Linux/mobile 非 OHOS 平台调用任一命令
- **THEN** SHALL 返回 `Unsupported` 错误且不触碰任何 OHOS API

### Requirement: 插件无需 ArkTS 注册与系统权限
插件 setup SHALL NOT 注册 ArkTS bridge plugin（Phase 1c 纯 Mutex 链无 bridge）；接续查询 SHALL NOT 需要任何 module.json5 权限声明。

#### Scenario: 权限配置
- **WHEN** 应用接入 `continuation:default` capability
- **THEN** SHALL 仅授权 allow-is-continuation-restore / allow-get-continuation-data 两个命令
- **AND** module.json5 SHALL NOT 需要新增 requestPermissions 条目

### Requirement: examples/api 提供恢复状态 demo 与自动化断言
examples/api SHALL 提供 `Continuation.svelte` demo 页（恢复状态查询 + 数据展示 + 消费型语义标注）+ `ohos-continuation.ts` 测试套件：auto 用例断言普通启动下两 API 的 false/null 语义与 take 幂等空。

#### Scenario: 自动化断言
- **WHEN** TestRunner 跑 ohos-continuation 套件
- **THEN** `isContinuationRestoreLaunch()` SHALL 断言为 false
- **AND** `getContinuationData()` SHALL 断言为 null，连续两次调用均 null

### Requirement: R228 修订为分阶段边界声明
ohos-platform-limitations R228 SHALL 从"暂不实现"修订为：被动恢复查询/数据回传经 `tauri-plugin-continuation` 提供（源端保存与完整迁移流见后续阶段）；主动发起迁移由系统 UI 独占，SHALL NOT 提供。

#### Scenario: 应用期望跨设备接续
- **WHEN** 应用在 OHOS 期望被动接续恢复
- **THEN** SHALL 使用 `tauri-plugin-continuation` 查询恢复状态与数据
- **AND** 主动迁移（源端发起）SHALL 保持不可用并指引系统 UI 接续入口
