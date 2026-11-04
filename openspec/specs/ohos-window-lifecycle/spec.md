# ohos-window-lifecycle Specification

## Purpose
TBD - created by archiving change p2-runevent-window-lifecycle. Update Purpose after archive.

## Requirements

### Requirement: 子窗口 Destroyed 事件正确触发

当子窗口关闭时,`WindowEvent::Destroyed` SHALL 仅在真实销毁确认(OS 窗实际销毁的确认事件)之后由记账摘除路径派发;发起侧 close/destroy 仅派发销毁指令,不预先摘除 store/registry 记账。destroy 失败(子窗真失败)时记账 SHALL 保留,后续窗口命令继续应答。

#### Scenario: 用户代码调用 window.close() 关闭子窗口

- **WHEN** 用户代码调用 `window.close()` 关闭子窗口
- **THEN** 系统发送 `WindowMessage::Close` 消息
- **THEN** 处理器调用 `on_close_requested_ohos` 发送 `WindowEvent::CloseRequested` 事件
- **THEN** 如果用户未调用 `api.prevent_close()`,发起侧仅派发销毁指令(不摘账、不派发 Destroyed)
- **THEN** OS 窗真实销毁后,销毁确认驱动 `on_window_close_ohos` 摘除 store/registry 并发送 `WindowEvent::Destroyed` 事件

#### Scenario: OHOS pending close drain 关闭子窗口

- **WHEN** ArkTS 拦截 close-window URL 并通过 `notifyWindowClose()` NAPI 通知 Rust
- **THEN** Rust event loop drain 调用 `on_close_requested_ohos` 发送 `WindowEvent::CloseRequested` 事件
- **THEN** 如果用户未调用 `api.prevent_close()`,销毁确认(该窗 OS 侧已销毁)驱动摘除 store/registry 并发送 `WindowEvent::Destroyed` 事件

#### Scenario: 系统直接发送 WindowMessage::Destroy（不触发 CloseRequested）

- **WHEN** 系统发送 `WindowMessage::Destroy` 消息(如 tao 内部销毁路径)
- **THEN** 处理器直接派发销毁指令,**不**触发 `WindowEvent::CloseRequested` 事件(避免循环调用)
- **THEN** 销毁确认到达后驱动摘账并发送 `WindowEvent::Destroyed` 事件

#### Scenario: 用户代码在 CloseRequested 事件中阻止关闭

- **WHEN** 子窗口收到 `WindowEvent::CloseRequested` 事件(通过 `window.close()` 或 pending close drain)
- **WHEN** 用户代码在 `CloseRequested` 事件中调用 `api.prevent_close()`
- **THEN** 销毁指令不派发,记账保持,`WindowEvent::Destroyed` 不派发

#### Scenario: 子窗 destroy 失败记账保留

- **WHEN** 子窗 destroy 桥调用失败(真失败,非已销毁幂等路径)
- **THEN** store/registry 记账保留,后续窗口命令继续应答,`WindowEvent::Destroyed` 不派发

#### Scenario: Rust 发起 close 的在途回环不重复派发 CloseRequested

- **WHEN** Rust 发起侧已派发销毁指令(该窗处于 close 在途),ArkTS aboutToDisappear→notifyWindowClose 回环的 CloseRequested 到达
- **THEN** 该回环 CloseRequested 被识别为销毁确认:不再向 app 重复派发 `WindowEvent::CloseRequested`(app 每次用户 close 恰收一次),直接驱动确认摘账与 `WindowEvent::Destroyed` 派发(恰一次)

### Requirement: WindowsStore 条目正确移除
当窗口被销毁时,系统 SHALL 从 `WindowsStore` 中移除对应的窗口条目。确认驱动拓扑下,移除由销毁确认路径(而非发起路径)执行;发起侧仅登记在途状态。

#### Scenario: 子窗口销毁后 WindowsStore 条目被移除

- **WHEN** 子窗口被销毁(通过 `WindowMessage::Close` + `on_close_requested_ohos` 发起、`WindowMessage::Destroy` 发起或 `TaoWindowEvent::Destroyed` 确认)
- **THEN** 确认执行器调用 `windows.0.borrow_mut().remove(&window_id)`
- **THEN** `WindowsStore` 中不再包含该窗口的条目
- **THEN** 后续调用 `windows.0.borrow().is_empty()` 能正确反映剩余窗口数量

#### Scenario: 主窗口销毁后 WindowsStore 条目被移除

- **WHEN** 主窗口关闭走 ExitRequested 门(未 prevent)
- **THEN** 主窗臂摘除 store 与 registry 条目后设置退出控制流
- **THEN** `WindowsStore` 中不再包含该窗口的条目

#### Scenario: 多次调用 on_window_close 是幂等的

- **WHEN** 确认执行器被多次触发(例如回环 CloseRequested 确认与 `TaoWindowEvent::Destroyed` 安全网都到达)
- **THEN** 第一次触发移除条目并发送 `Destroyed` 事件
- **THEN** 后续触发检查 `remove` 返回值,如果窗口已被移除则直接返回
- **THEN** 不会重复发送 `Destroyed` 事件

#### Scenario: 已被 ArkTS 先行销毁的幂等路径

- **WHEN** destroy 桥调用对已销毁窗返回幂等成功确认(ability destroy-window 幂等 ack)
- **THEN** 该确认同样驱动记账摘除与 `WindowEvent::Destroyed` 派发(恰一次,后续确认因记账已摘而早退)

### Requirement: 所有窗口关闭时触发 ExitRequested
当 `WindowsStore` 中所有窗口都被销毁后，系统 SHALL 触发 `ExitRequested` 事件。

#### Scenario: 最后一个窗口关闭时触发 ExitRequested
- **WHEN** 最后一个窗口被销毁
- **THEN** `on_window_close` 检查 `windows.0.borrow().is_empty()` 返回 `true`
- **THEN** 系统发送 `RunEvent::ExitRequested { code: None, tx }` 事件
- **THEN** 系统设置 `exit_state.0.store(true, Ordering::SeqCst)` 标志
- **THEN** 如果用户代码未调用 `api.prevent_exit()`，系统设置 `ControlFlow::Exit`

#### Scenario: ExitRequested 与 LoopDestroyed 路径不重复触发
- **WHEN** 所有窗口通过 `on_window_close` 关闭（无论触发路径），触发 `ExitRequested`
- **THEN** `exit_state` 标志被设置为 `true`
- **WHEN** 随后 `LoopDestroyed` 事件触发
- **THEN** `LoopDestroyed` 处理器检查 `exit_state` 标志为 `true`
- **THEN** `LoopDestroyed` 处理器跳过 `ExitRequested`，直接发送 `RunEvent::Exit`

### Requirement: on_window_close 函数签名重构
`on_window_close` 函数 SHALL 接受 `callback` 和 `exit_state` 参数，以支持发送事件和检查标志。

#### Scenario: on_window_close 函数签名
- **WHEN** `on_window_close` 被调用
- **THEN** 函数签名为 `fn on_window_close<'a, T: UserEvent>(callback: &'a mut (dyn FnMut(RunEvent<T>) + 'static), window_id: WindowId, windows: Arc<WindowsStore>, exit_state: Arc<ExitState>)`
- **THEN** 函数在 Windows 平台上先调用 `surface.take()` 释放 softbuffer surface（必须在 window 之前 drop，否则 surface 释放时可能访问已释放的窗口资源）
- **THEN** 函数能够发送 `WindowEvent::Destroyed` 事件
- **THEN** 函数能够检查和设置 `exit_state` 标志

#### Scenario: 所有调用方传递新参数
- **WHEN** `WindowMessage::Close` 处理器调用 `on_close_requested`
- **THEN** `on_close_requested` 内部调用 `on_window_close` 时传递 `callback` 和 `exit_state`
- **WHEN** `WindowMessage::Destroy` 处理器直接调用 `on_window_close`（不经过 `on_close_requested`，避免循环）
- **THEN** 传递 `callback` 和 `exit_state` 参数
- **WHEN** `TaoWindowEvent::Destroyed` 处理器直接调用 `on_window_close`
- **THEN** 传递 `callback` 和 `exit_state` 参数

### Requirement: cfg 隔离
OHOS 平台的窗口生命周期修复 SHALL 仅在 `cfg(target_env = "ohos")` 条件下生效，不影响 Windows/macOS 行为。

#### Scenario: Windows/macOS 不受影响
- **WHEN** 应用在 Windows 或 macOS 上运行
- **THEN** `on_window_close` 保持原有行为（如果有的话）
- **THEN** `WindowEvent::Destroyed` 仍通过 `TaoWindowEvent::Destroyed` 路径触发
- **THEN** `ExitRequested` 仍通过原有路径触发

#### Scenario: OHOS 使用新行为
- **WHEN** 应用在 OHOS 上运行
- **THEN** `on_window_close` 执行完整清理逻辑（包含 `surface.take()` 保持 drop 顺序）
- **THEN** `WindowMessage::Close` 调用 `on_close_requested`（触发 `CloseRequested`）
- **THEN** `WindowMessage::Destroy` 直接调用 `on_window_close`（不触发 `CloseRequested`）
- **THEN** `TaoWindowEvent::Destroyed` 调用重构后的 `on_window_close`
