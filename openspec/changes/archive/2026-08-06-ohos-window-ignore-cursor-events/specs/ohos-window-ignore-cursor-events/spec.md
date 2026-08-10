## ADDED Requirements

### Requirement: set_window_touchable TSFN 函数
`openharmony-ability` SHALL provide `set_window_touchable(window_id: i64, touchable: bool) -> Result<()>`，通过全局 TSFN（`TSFN_SET_WINDOW_TOUCHABLE`）fire-and-forget 调用 ArkHelper 的 `setWindowTouchable` 方法，任意线程可调。

#### Scenario: 正常调用
- **WHEN** 任意线程调 `set_window_touchable(window_id, false)` 且 TSFN 已初始化
- **THEN** TSFN 将 `(window_id, false)` 路由到 ArkTS，Rust 返回 `Ok(())`（fire-and-forget，不等待 ArkTS 结果）

#### Scenario: TSFN 未初始化
- **WHEN** 调 `set_window_touchable` 但 `init_vibrancy_tsfn` 未执行
- **THEN** 返回 `Err("set_window_touchable TSFN not initialized")`

#### Scenario: TSFN call 失败
- **WHEN** `tsfn.call(...)` 返回非 Ok status
- **THEN** 返回 `Err("TSFN call failed: {:?}")`

### Requirement: TSFN 初始化
`TSFN_SET_WINDOW_TOUCHABLE` SHALL 在 ArkHelper setup 阶段（主线程，`init_vibrancy_tsfn` 内或等价点）从 ArkHelper 取 `setWindowTouchable` 方法建 TSFN，`callee_handled::<false>()`。

#### Scenario: init 幂等
- **WHEN** `init_vibrancy_tsfn` 被多次调用
- **THEN** touchable TSFN 只建一次（`OnceLock::set` 已有值时跳过）

#### Scenario: ArkHelper 缺方法
- **WHEN** ArkHelper 对象无 `setWindowTouchable` 属性
- **THEN** `get_named_property` 返回 Err，init 失败（与 `setWindowBlur` 缺失时行为一致）

### Requirement: ArkHelper setWindowTouchable 转发 + WindowManager 封装
`ArkHelper.ets` SHALL 暴露 `setWindowTouchable(windowId, touchable): void`，转发到 `WindowManager.setWindowTouchable`。`WindowManager.ets` SHALL 用 `getWindow(windowId)` 取窗口实例（非 `getWindowById`），调 `win.setWindowTouchable(touchable).then().catch()`（对称 `setWindowFocusable:201-212`）。

#### Scenario: 成功设置
- **WHEN** ArkHelper 转发 `setWindowTouchable(id, false)` 到 WindowManager，窗口存在
- **THEN** `win.setWindowTouchable(false)` Promise resolve，`hilog.debug` 记录

#### Scenario: Promise reject (1300002/1300003)
- **WHEN** 窗口状态异常或 UI 未加载，`setWindowTouchable` Promise reject
- **THEN** WindowManager 的 `.catch` 捕获，`hilog.error` 记录（Promise 异步回调上下文，hilog 安全），**不闪退**；Rust 不感知（fire-and-forget）

#### Scenario: 窗口不存在（同步）
- **WHEN** `getWindow(id)` 返回 undefined
- **THEN** WindowManager `hilog.warn` 记录并 return，不抛出

#### Scenario: ArkHelper 同步异常
- **WHEN** ArkHelper 转发时同步抛出
- **THEN** ArkHelper 的 try/catch 用 `safeLogError` 记录（NAPI-reentrant 上下文，hilog 可能 Argc mismatch）

### Requirement: 逻辑取反在 tao 层（Phase 2 预留）
ability `set_window_touchable(touchable)` SHALL 直传 bool；tao `set_ignore_cursor_events(ignore)` SHALL 调 `set_window_touchable(window_id, !ignore)`。

#### Scenario: ignore=true 映射 touchable=false
- **WHEN** tauri 调 `set_ignore_cursor_events(true)`（穿透）
- **THEN** tao 调 `set_window_touchable(id, false)`（不可触=穿透）

#### Scenario: ignore=false 恢复
- **WHEN** tauri 调 `set_ignore_cursor_events(false)`
- **THEN** tao 调 `set_window_touchable(id, true)`

### Requirement: 不影响其他平台
OHOS `set_ignore_cursor_events` 填实 SHALL 使用 `cfg(target_env = "ohos")` 隔离，其他平台实现不动。

#### Scenario: 非 OHOS 编译
- **WHEN** 为 Windows/macOS/Linux 编译 tao
- **THEN** `set_ignore_cursor_events` 走各平台原有实现，不引用 `set_window_touchable`
