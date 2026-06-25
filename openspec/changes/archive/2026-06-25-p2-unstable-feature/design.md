## Context

tauri-runtime-wry 的 `Message::Webview` 处理中，`WebviewMessage::Reparent` 是**唯一**在 OHOS 上被排除的 webview 消息 handler。其他 34 个 `WebviewMessage` 变体（EvaluateScript、SetBounds、WithWebview 等）均有 OHOS 兼容的处理路径或已有 OHOS 分支。

**死锁机制**：

```
WryWebviewDispatcher::reparent()          Message::Webview handler
┌─────────────────────────┐              ┌──────────────────────────┐
│ lock current_window_id  │              │ #[cfg(not(target_env=    │
│   = Mutex lock acquired │              │   "ohos"))]               │
│                         │              │ if Reparent { ... return }│ ← 编译期移除
│ send Reparent(tx)       │ ──────────> │                          │
│                         │              │                          │
│ rx.recv().unwrap()      │              │ match webview_message {  │
│   = BLOCKS FOREVER ←──────────────────│   Reparent(_, _tx) =>    │
│                         │              │     { /* already handled */ } │ ← tx 永不被调用
│ current_window_id lock  │              │ }                        │
│   = NEVER RELEASED      │              │                          │
└─────────────────────────┘              └──────────────────────────┘
```

**影响范围**：
- 调用 `reparent()` 的线程永久阻塞
- `current_window_id` Mutex 锁永不释放 → 后续所有 webview 操作（set_bounds、set_position、set_focus 等）需要该锁时级联死锁
- 触发条件：`unstable` feature 开启 + OHOS desktop + 调用 `Webview::reparent()` 或 JS `__reparent__` 命令

**已确认不需修改的领域**：
- ✅ `WithWebview`：已有 OHOS 分支（`lib.rs:4201-4205`），使用 `WebViewExtOhos::webview_handle()`
- ✅ `WebviewBounds` resize handler：未排除 OHOS（`lib.rs:4537-4558`），调用 `webview.set_bounds()`
- ✅ `Message::CreateWebview` handler：平台无关（`lib.rs:4222-4243`）
- ✅ `create_webview` 的 `WindowChild` 路径：OHOS 使用 `build_as_child(&window)`（`lib.rs:5496-5503`）

## Goals / Non-Goals

**Goals:**
- OHOS 上 `WebviewMessage::Reparent` 的 `tx` 被正确信号化，`rx.recv()` 不阻塞
- 返回明确错误（`Error::FailedToSendMessage`），调用方可传播处理
- 不影响其他平台的 Reparent handler
- 不引入 wry 层的 reparent 实现（OHOS 不支持 true reparent）

**Non-Goals:**
- 不实现 true reparent（跨窗口迁移 Web 组件）— OHOS ArkUI `BuilderNode` 绑定 `UIContext`，不支持
- 不实现模拟 reparent（新建 webview + 迁移状态 + 销毁旧）— 复杂且有状态丢失风险，不在本 Phase
- 不修改 tauri crate 层的 `reparent()` 行为（Phase 3 范围）
- 不修改 wry OHOS 后端（Phase 1 已处理 set_bounds/set_visible，reparent 不在 wry 层实现）

## Decisions

### Decision 1: 在通用 match 之前添加 OHOS 专属 Reparent 拦截

**选择**：在 `Message::Webview` 处理区域（约 line 3805），在现有 `#[cfg(all(any(...), not(target_env = "ohos")))]` Reparent block 之后、通用 match 前的 prep 代码（约 line 3878 `let webview_handle = ...`）之前，新增 `#[cfg(target_env = "ohos")]` 拦截块。实际 `match webview_message {` 在 line 3885。

```rust
#[cfg(target_env = "ohos")]
if let WebviewMessage::Reparent(_new_parent_window_id, tx) = webview_message {
  log::warn!("Webview reparent is not supported on OHOS (BuilderNode is bound to UIContext)");
  tx.send(Err(Error::FailedToSendMessage)).unwrap();
  return;
}
```

**理由**：
- 与现有平台分支模式一致：macOS/Windows/Linux 的 Reparent 在 `#[cfg(all(any(...), not(target_env = "ohos")))]` 块中提前 `return`，OHOS 也应提前 `return`
- 放在通用 match 之前，确保 `tx` 被信号化，不落入 `/* already handled */` 空分支
- `return` 后不执行后续代码，行为清晰

**替代方案**：
- 修改通用 match 的 `Reparent` arm → 需要在 `#[cfg]` 中区分平台，代码不够清晰
- 重构现有 block 移除 `not(target_env = "ohos")` → 需要在同一 block 内区分平台代码路径，增加复杂度

### Decision 2: 使用 Error::FailedToSendMessage 作为错误类型

**选择**：`tx.send(Err(Error::FailedToSendMessage))`。

**理由**：
- `Error::FailedToSendMessage` 是 tauri-runtime-wry 中已有的错误变体，表示操作无法完成
- 避免新增 error variant（减少跨 crate 影响）
- 调用方（`reparent()` → `rx.recv().unwrap()?`）会传播该错误，用户看到 `FailedToSendMessage` 错误

**替代方案**：
- 新增 `Error::ReparentNotSupported` → 更描述性，但需修改 `tauri-runtime` 的 Error trait，跨 crate 变更
- 返回 `Ok(())` 静默成功 → 误导调用方，webview 实际未迁移

### Decision 3: 不在 wry OHOS 层添加 reparent 方法

**选择**：不在 `wry/src/ohos/mod.rs` 中添加 `reparent` 方法。

**理由**：
- OHOS ArkUI `BuilderNode` 绑定到创建时的 `UIContext`，无法跨窗口迁移
- `openharmony-ability` 的 `Webview` 结构体无 reparent 相关方法
- 即使添加 wry 层方法，底层也无法实现，最终仍返回错误
- 在 tauri-runtime-wry 层直接返回错误更简洁，避免无意义的 wry 层空方法

### Decision 4: 日志级别使用 warn 而非 error

**选择**：`log::warn!("Webview reparent is not supported on OHOS...")`。

**理由**：
- Reparent 不支持是已知的平台限制，非意外错误
- `error` 级别会触发监控告警（如 Sentry），不适合已知降级场景
- `warn` 级别提示开发者此操作不支持，同时不触发告警

## Risks / Trade-offs

- **[用户感知]** 调用 `reparent()` 返回错误，用户需处理 → 与 Windows/macOS 行为不一致（那边成功）。但 OHOS 的平台限制无法绕过，返回错误比死锁好。
- **[Error::FailedToSendMessage 语义不精确]** 该错误名暗示"消息发送失败"而非"操作不支持" → 可接受，避免跨 crate 新增 error variant 的复杂度。未来可在 `tauri-runtime` Error trait 新增 `ReparentNotSupported` 变体优化。
- **[tx.send().unwrap()]** 若 `rx` 端已 drop（调用方超时或取消），`tx.send()` 会 panic → 与现有 Reparent handler 中的 `tx.send().unwrap()` 模式一致（line 3863、3867、3872），非新增风险。
- **[非 OHOS 既有 bug（不在本 Phase 修复）]** 现有非 OHOS Reparent handler（`lib.rs:3827-3870`）中，当 webview 存在（`webview_handle` is `Some`）但新父窗口查找失败（内层 `if let` at line 3828 为 `None`）时，`tx` 不被信号化 → 同样死锁。`else` at line 3871 仅覆盖外层 `if let` 为 `None` 的情况。这是既有 bug，非本 Phase 引入，不在本 Phase 修复范围。
