# ohos-ipc-frame-routing Specification

## Purpose
OHOS 平台 postMessage IPC 模式下,Tauri 回调(invoke 响应、事件、Channel 数据)从主 frame 中继至注册该回调的子 frame,使 iframe 内的异步 IPC 可用;非 OHOS 平台行为不变。

## Requirements

### Requirement: 子 frame 内的 invoke 回调收到响应

OHOS 平台,同源 iframe 子 frame 内通过 `__TAURI_INTERNALS__` 注册的 invoke 成功/失败回调 SHALL 收到对应响应数据,Promise SHALL settle。

#### Scenario: iframe 内 invoke 成功往返
- **WHEN** 同源 iframe 内调用 `invoke('echo', { message: 'from-iframe' })`
- **THEN** Promise 以 echo 命令回传的 payload resolve,`message === 'from-iframe'`

#### Scenario: iframe 内 invoke 错误回调到达
- **WHEN** 同源 iframe 内调用的命令在 Rust 侧返回 Err
- **THEN** Promise 以该错误 reject(错误回调 id 收到响应,非超时丢弃)

### Requirement: 子 frame 内的事件监听收到事件

OHOS 平台,同源 iframe 内注册的事件 listener SHALL 收到对应 `emit` 的事件数据。

#### Scenario: iframe 内 listen 收到 emit
- **WHEN** 同源 iframe 内 `listen('evt', handler)` 注册后,Rust 侧 `emit('evt', payload)`
- **THEN** 该 handler 以 payload 被调用

### Requirement: 子 frame 内的 Channel 收到投递

OHOS 平台,同源 iframe 内创建的 Channel 的 onmessage 回调 SHALL 收到 Rust 侧投递的数据。

#### Scenario: iframe 内 Channel 收到消息
- **WHEN** 同源 iframe 内创建 Channel 并绑定 onmessage,Rust 侧向该 Channel `send`
- **THEN** onmessage 以投递的数据被调用

### Requirement: 嵌套 frame 链式中继

响应中继 SHALL 支持嵌套 iframe:某层 frame 未命中回调 id 且自身含子 frame 时,继续向其子 frame 中继。

#### Scenario: 孙 frame 内 invoke settle
- **WHEN** iframe 内再嵌一层同源 iframe(孙 frame),孙 frame 内调用 invoke
- **THEN** 孙 frame 的 Promise settle(响应经主 frame → 子 frame → 孙 frame 链式到达)

### Requirement: 主 frame 回调优先且行为不变

回调 id 在主 frame 命中时 SHALL 按现状直接执行、不向子 frame 转发;主 frame 自身发起的 invoke/事件/Channel 行为 SHALL 与修复前一致。

#### Scenario: 主 frame 回调直接执行
- **WHEN** 主 frame 注册的回调 id 收到响应
- **THEN** 主 frame 执行该回调,子 frame 不收到任何转发消息

### Requirement: 跨源 frame 不投递且不泄漏

响应中继 SHALL 仅投递至与主 frame 同源的子 frame;跨源 iframe SHALL 保持修复前行为(回调不送达),响应数据 SHALL NOT 投递至跨源 frame。

#### Scenario: 跨源 iframe 回调仍超时
- **WHEN** 跨源 iframe 内调用 invoke
- **THEN** 该 Promise 不因中继而 settle(保持修复前超时行为),响应数据未投递至该跨源 frame

### Requirement: 非 OHOS 平台行为不变

中继逻辑 SHALL 仅在 OHOS 平台激活;Windows/macOS/Linux(fetch 通道)与 Android 的 init script 可观察行为 SHALL 与修复前一致。

#### Scenario: 桌面平台 iframe 走 fetch 通道不受影响
- **WHEN** 桌面平台运行任意既有测试(含主 frame 与 iframe)
- **THEN** 全部结果与修复前基线一致
