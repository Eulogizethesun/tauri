## Context

Tauri `unstable` feature 在 OHOS desktop 上的阻塞链路：

```
Window::add_child (window/mod.rs:1174)
  └─ #[cfg(all(any(test, all(desktop, feature="unstable")), not(target_env="ohos")))]
     └─ not(target_env="ohos") ← 唯一排除点
```

移除此排除后，完整编译链路自动打通：

| 组件 | 位置 | cfg gate | OHOS 可用？ |
|------|------|----------|:-----------:|
| `Window::add_child` | `window/mod.rs:1174` | `all(any(test, all(desktop, unstable)), not(ohos))` | ❌ → ✅（移除 not(ohos)） |
| `WebviewBuilder::build` | `webview/mod.rs:803` | `cfg(desktop)` | ✅ |
| `Context::create_webview` | `tauri-runtime-wry:376` | 无 | ✅ |
| `create_webview` 命令 | `plugin.rs:163` | `feature="unstable"` | ✅（调用 add_child） |
| `desktop_commands` 模块 | `plugin.rs:75` | `cfg(desktop)` | ✅ |
| Manager getter | `lib.rs:553-585` | `feature="unstable"` | ✅ |
| `Window::builder` | `window/mod.rs:1167` | `feature="unstable"` | ✅ |
| `Webview::reparent` | `webview/mod.rs:1574` | 无（unstable 时跳过检查） | ✅（Phase 2 防死锁） |

**线程安全分析**：

`add_child` 使用 `run_on_main_thread + rx.recv()` 模式（line 1190-1194），OHOS 约束明确禁止此模式。但分析 `send_user_message`（`tauri-runtime-wry:246-258`）实现：

```rust
if current_thread().id() == context.main_thread_id {
    handle_user_message(...);  // 主线程：同步执行
    Ok(())
} else {
    // 非主线程：发送到事件循环队列
}
```

- **从 `setup` 调用（主线程）**：`run_on_main_thread` → `send_user_message` 检测主线程 → 同步执行 task → task 内 `build` → `create_webview` → `send_user_message` 再次检测主线程 → 同步创建 webview → `tx.send(res)` → `rx.recv()` 立即返回。**无死锁**。
- **从 async 命令调用（非主线程）**：`run_on_main_thread` → `send_user_message` 发送到队列 → `rx.recv()` 阻塞调用线程 → 事件循环在主线程处理 task → `tx.send(res)` → `rx.recv()` 解除阻塞。**无死锁**。

OHOS 约束禁止的 `run_on_main_thread + rx.recv()` 模式适用于 **task 内部使用 `rx.recv()` 等待事件循环响应** 的场景（如旧 Reparent handler）。`add_child` 的 task 内部不使用 `rx.recv()`（`Context::create_webview` 是 fire-and-forget），因此不违反约束。

## Goals / Non-Goals

**Goals:**
- 移除 `add_child` 的 `not(target_env = "ohos")` 排除
- 使 `unstable` feature 在 OHOS desktop 上完整编译
- 使 `create_webview` JS 命令、`reparent` JS 命令在 OHOS desktop 上可用
- 不影响其他平台

**Non-Goals:**
- 不修改 `add_child` 的实现逻辑（`run_on_main_thread + rx.recv()` 模式保持不变，已验证安全）
- 不修改 `WebviewWindow` 的 OHOS 排除（`webview_window.rs` 中的排除是独立 API surface，非 multi-webview 所需）
- 不实现前端测试（Phase 4 范围）
- 不修改 demo 应用（后续验证时再添加）

## Decisions

### Decision 1: 仅移除 `not(target_env = "ohos")`，不重构 `add_child`

**选择**：将 `window/mod.rs:1174-1177` 的 cfg 从 `all(any(test, all(desktop, feature = "unstable")), not(target_env = "ohos"))` 改为 `all(any(test, all(desktop, feature = "unstable")))`。

**理由**：
- `send_user_message` 的主线程同步执行机制（line 250-258）确保 `run_on_main_thread + rx.recv()` 不死锁
- `add_child` 的 task 内部不使用 `rx.recv()`（`Context::create_webview` 是 fire-and-forget）
- 其他平台（macOS/Windows/Linux）使用相同模式且工作正常
- 最小变更原则：1 行修改 vs 重构整个 `add_child`

**替代方案**：在 OHOS 上绕过 `run_on_main_thread`，直接调用 `build` → 需要额外 `#[cfg(target_env = "ohos")]` 分支，增加代码复杂度，且无必要（已验证安全）。

### Decision 2: 不修改 `WebviewWindow` 的 OHOS 排除

**选择**：`webview_window.rs` 中的 7 处 `not(target_env = "ohos")` 排除（line 695, 713, 1332, 1364, 1398, 1870, 1887）不在本 Phase 修改。

**理由**：
- 这些排除是 `WebviewWindow` API surface 的独立问题（如 `set_effects`、`set_decorations` 等），非 multi-webview 所需
- `add_child` 使用的是 `Window` + `WebviewBuilder`，不是 `WebviewWindow`
- multiwebview example 使用 `tauri::window::WindowBuilder`（独立窗口）+ `window.add_child`（子 webview），不涉及 `WebviewWindow`
- 这些排除应在各自的 feature 适配中处理

### Decision 3: `create_webview` JS 命令自动可用，无需额外修改

**选择**：不修改 `webview/plugin.rs` 中的 `create_webview` 命令。

**理由**：
- `create_webview` 命令在 `#[cfg(feature = "unstable")]` 下调用 `window.add_child()`（line 184）
- 移除 `add_child` 的 OHOS 排除后，`add_child` 编译可用 → `create_webview` 自动编译通过
- 命令注册在 `#[cfg(desktop)]` 下（line 262），OHOS desktop 上 `cfg(desktop)` 为 true → 自动注册
- 无需额外 cfg 修改

## Risks / Trade-offs

- **[主线程同步执行性能]** `send_user_message` 在主线程上同步执行，如果 webview 创建耗时长，会阻塞事件循环 → 与其他平台行为一致（macOS/Windows 也是同步执行），且 webview 创建通常 < 100ms，可接受。
- **[WebviewWindow 排除未处理]** `WebviewWindow` 的 7 处 OHOS 排除未修改 → 不影响 `add_child`/multi-webview 功能。`WebviewWindow` 是窗口和 webview 合为一体的 API，与 `Window` + `WebviewBuilder` 的解耦 API 是不同的使用路径。
- **[设备端验证待做]** `BuilderNode.update()` 是否正确重渲染 width/height、scale factor 精度、ProxyJsHelper 回放等需在 Phase 1 设备验证中确认。若 Phase 1 验证失败，Phase 3 的 `add_child` 虽能编译但运行时可能不正确。
