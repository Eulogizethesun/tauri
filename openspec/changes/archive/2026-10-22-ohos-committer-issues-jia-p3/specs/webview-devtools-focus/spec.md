# webview-devtools-focus Specification

## ADDED Requirements

### Requirement: open_devtools SHALL queue before controller ready

wry OHOS 的 `open_devtools` 在 webview controller 尚未绑定(try_handle 失败)时 SHALL 不再静默丢弃:以 `PendingOp::SetDevtools` 入 pending 队列,握手完成后由既有 drain 重放。devtools 开启状态 SHALL 以进程级布尔记录(setWebDebuggingAccess 为进程级静态 API 语义),与 ArkTS 侧既有 module-level tracked state(「Report tracked debugging-access state」requirement)语义一致;重复 open SHALL 幂等。

#### Scenario: open_devtools before ready queues

- **WHEN** 创建后立即调用 `open_devtools()` 且 controller 未就绪
- **THEN** PendingOp::SetDevtools SHALL 入队
- **AND** 握手完成后重放,Web 调试最终生效

#### Scenario: open_devtools when ready applies immediately

- **WHEN** controller 已绑定后调用 `open_devtools()`
- **THEN** SHALL 立即下发(set_web_debugging_access 运行时通道,零排队)

#### Scenario: is_devtools_open stays tracked

- **WHEN** open_devtools 在排队态被调用后查询 `is_devtools_open()`
- **THEN** SHALL 返回 true(进程级布尔在调用点即置位,不等待重放)

#### Scenario: Repeat open is idempotent

- **WHEN** open_devtools 被连续调用两次
- **THEN** 第二次 SHALL 幂等(状态已 true,不重复入队或下发后无副作用)

#### Scenario: cfg gate preserved

- **WHEN** 非 OHOS 平台编译
- **THEN** devtools 相关新增代码 SHALL 维持既有 cfg 门(与「DevTools methods keep cfg gate」requirement 一致)
