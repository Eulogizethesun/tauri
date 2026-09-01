# cursor-grab Spec

## Purpose

定义 OpenHarmony 平台窗口光标抓取(`set_cursor_grab`)的行为契约:将鼠标光标锁定在窗口区域内(confined 模式,光标跟随移动)、解除锁定、失焦自动解除,以及在系统不支持该 API(API < 22)设备上的安全降级。

## ADDED Requirements

### Requirement: 光标锁定限制在窗口区域内

在获焦窗口上启用光标抓取时,系统 SHALL 将鼠标光标的活动范围限制在该窗口区域内,且光标仍跟随鼠标移动(confined 模式,对应 `isCursorFollowMovement=true`),行为与 Windows 平台 ClipCursor 语义一致。

#### Scenario: 主窗口锁定(手动验证)

- **WHEN** 应用在已获焦的主窗口上调用 `setCursorGrab(true)`(设备 API ≥ 22 且已声明权限)
- **THEN** 鼠标光标无法移出窗口区域,但在窗口内仍正常移动

#### Scenario: 未获焦窗口请求锁定

- **WHEN** 窗口未获焦时请求光标抓取
- **THEN** 不会对未获焦窗口产生光标约束(该 API 仅对获焦窗口生效)

#### Scenario: API 调用冒烟(自动)

- **WHEN** 前端连续调用 `setCursorGrab(true)` 与 `setCursorGrab(false)`
- **THEN** 两次调用均不抛异常,应用保持响应

### Requirement: 解除光标锁定

禁用光标抓取时,系统 SHALL 恢复光标自由移动。

#### Scenario: 锁定后解除(手动验证)

- **WHEN** 锁定成功后应用调用 `setCursorGrab(false)`
- **THEN** 鼠标光标恢复自由移动,可移出窗口区域

### Requirement: 失焦自动解除锁定

窗口失去焦点时,系统 SHALL 自动解除该窗口的光标锁定。此为 OHOS 平台行为,与 Windows(ClipCursor 不随失焦释放)不同,SHALL 在平台差异文档中显式标注。

#### Scenario: 切换焦点解除锁定(手动验证)

- **WHEN** 已锁定的窗口失去焦点(用户点击其他窗口或经任务栏切换)
- **THEN** 光标锁定被自动解除,无需应用侧调用解锁

### Requirement: 不支持设备上的优雅降级

系统未导出光标锁定 C API(API < 22)或设备报告不支持时,`set_cursor_grab` SHALL 返回 not supported 错误,且应用 SHALL NOT 在加载期或调用期崩溃。

#### Scenario: API < 22 设备调用

- **WHEN** 应用运行在 API 低于 22 的设备上并调用 `setCursorGrab(true)`
- **THEN** 调用返回 not supported 错误,应用继续正常运行

#### Scenario: 加载期安全

- **WHEN** 应用启动于窗口管理库未导出锁定符号的设备
- **THEN** 应用正常启动(符号为运行时弱解析,不参与加载期链接)

### Requirement: 错误传播

底层锁定/解锁调用的失败 SHALL 以错误形式传播给调用方,覆盖:权限缺失(201)、设备不支持(801)、窗口状态异常(1300002)、窗口管理服务异常(1300003)、窗口 ID 无效。

#### Scenario: 权限未声明

- **WHEN** 应用未声明 `ohos.permission.LOCK_WINDOW_CURSOR` 时调用 `setCursorGrab(true)`
- **THEN** 调用返回错误(hilog 可见错误码 201),应用继续运行

#### Scenario: 窗口已销毁

- **WHEN** 对已销毁窗口的 ID 请求光标抓取
- **THEN** 调用返回错误,而非静默成功
