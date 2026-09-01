# Tauri OpenHarmony RunEvent 分析与设计文档

## 第一部分：RunEvent 各变体功能分析

### 1.1 RunEvent 枚举总览

`RunEvent` 定义于 `crates/tauri-runtime/src/lib.rs:197`，是 Tauri 应用事件循环的核心事件类型。用户通过 `app.run(|handle, event| {...})` 回调接收这些事件。

### 1.2 各变体详细分析

#### Ready — 应用就绪

**功能**: 事件循环首次启动时触发，表示应用已就绪。这是应用生命周期中最早的事件。

**触发路径**: `Event::NewEvents(StartCause::Init)` → `RunEvent::Ready` — `lib.rs:4270-4271`

**OHOS 触发时机**: tao OHOS 在 `SurfaceCreate`（界面首次创建）时发送 `Event::NewEvents(StartCause::Init)` — `tao/src/platform_impl/ohos/mod.rs:312`。此时同时发送 `Event::Resumed`，但 Resumed 被丢弃（见下文）。

**OHOS 支持状态**: ✅ 已支持 — `SurfaceCreate` 正常触发 `Ready`

---

#### ExitRequested — 应用即将退出

**功能**: 应用即将退出时触发，允许用户阻止退出。

**字段**:
- `code: Option<i32>` — 退出码，`None` 表示最后一个窗口关闭，`Some(code)` 表示通过 `AppHandle::exit(code)` 主动请求退出
- `api: ExitRequestApi` — 提供 `prevent_exit()` 方法阻止退出（除非是 restart）

**触发时机**:
1. 最后一个窗口被销毁时 (`WindowEvent::Destroyed` → 检查窗口列表为空) — `tauri-runtime-wry/src/lib.rs:4413`
2. 用户调用 `AppHandle::exit(code)` → 发送 `Message::RequestExit(code)` — `lib.rs:4453-4456`

**典型用途**:
```rust
app.run(|handle, event| match event {
  RunEvent::ExitRequested { api, .. } => {
    if unsaved_changes_exist() {
      api.prevent_exit();  // 阻止退出，让用户保存
    }
  }
  _ => {}
});
```

**OHOS 支持状态**: ✅ 已支持 — 三条触发路径：
1. 最后一个窗口被销毁时（`TaoWindowEvent::Destroyed` → 检查窗口列表为空）
2. 用户调用 `AppHandle::exit(code)` → 发送 `Message::RequestExit(code)`
3. **新增 (Phase 1)**: `Event::LoopDestroyed` 时先发送 `ExitRequested { code: None }`，再发送 `Exit`，使用 `ExitState(AtomicBool)` 防止与路径 1 重复触发

**OHOS 已知限制**:
- `prevent_exit()` 在 `LoopDestroyed` 路径上可能无法真正阻止退出（系统已开始销毁 UIAbility），但用户代码至少能执行清理逻辑
- 后续可通过 `onPrepareToTerminate` 增强实现真正可阻止的退出拦截（需验证返回值语义 + 系统参数 `persist.sys.prepare_terminate`）

---

#### Exit — 应用已退出

**功能**: 事件循环已终止，应用正在退出。这是最后的生命周期事件。

**触发时机**: `Event::LoopDestroyed` → `RunEvent::Exit` — `lib.rs:4282-4283`

**在 tauri/app.rs 中的处理**:
```rust
RuntimeRunEvent::Exit => {
  let event = on_event_loop_event(..., RuntimeRunEvent::Exit, &manager);
  callback(&app_handle, event);
  app_handle.cleanup_before_exit();  // 清理插件、窗口等
  if self.manager.restart_on_exit.load(...) {
    crate::process::restart(&self.env());  // 如果是 restart 则重启
  }
}
```

**OHOS 支持状态**: ✅ 已支持 — tao OHOS 在退出时发送 `Event::LoopDestroyed` (line 429)

---

#### WindowEvent — 窗口事件

**功能**: 与特定窗口关联的事件。每个窗口事件都携带窗口 `label` 用于标识。

**字段**:
- `label: String` — 窗口标签
- `event: WindowEvent` — 具体事件类型（Destroyed、CloseRequested、Focused、Resized 等）

**触发时机**: 从 tao 的 `Event::WindowEvent` 映射，以及合成的窗口事件（如 `on_close_requested`）

**OHOS 支持状态**: ✅ 已支持 — 无 cfg 限制

**OHOS 特殊行为**: tao OHOS 事件循环会发送以下 WindowEvent:
- `Resized` (from `WindowResize`)
- `Focused(true/false)` (from `GainedFocus/LostFocus`)
- `ScaleFactorChanged` (from `ConfigChanged`)
- `CloseRequested` (from `WindowDestroy` — 合成)
- `Destroyed` (from `WindowDestroy` — 合成，主窗口)

**Phase 2 修复**: 子窗口 `Destroyed` 事件现在正确触发：
- `WindowMessage::Destroy` 处理器改为调用 `on_close_requested`（先发送 `CloseRequested`，再调用 `on_window_close`）
- `on_window_close` 函数重构为完整清理：移除 `WindowsStore` 条目 + 发送 `Destroyed` 事件 + 检查空 → 触发 `ExitRequested`
- `TaoWindowEvent::Destroyed` 处理器改为调用 `on_window_close`（统一清理路径）

---

#### Resumed / Suspended — 应用后台恢复与挂起（⚠️ 跨平台历史遗留问题，不在本次解决）

**功能**: `Resumed` 表示应用恢复运行（从后台回到前台），`Suspended` 表示应用挂起（进入后台）。

**当前问题**: ⚠️ **这是跨平台的历史遗留问题，不是 OHOS 特有 bug。**

**历史背景**:

tao/winit 的生命周期事件设计经历了两代演进：

1. **旧模型（winit < 0.28）**: 没有 `Event::Resumed`/`Event::Suspended`，只有 `StartCause::Init`/`Poll`/`WaitCancelled` 表示"事件循环为什么被唤醒"。在这个模型下，`StartCause::Poll → RunEvent::Resumed` 是合理的——因为 Poll 是"循环恢复运转"最接近的信号。

2. **新模型（winit 0.28+ / Tao）**: 引入了独立的 `Event::Resumed`/`Event::Suspended` 生命周期事件，明确区分"事件循环调度原因"和"应用生命周期状态"。所有移动平台（Android、iOS、OHOS）都正确生成了这些事件。

3. **Tauri 未适配**: tauri-runtime-wry 仍基于旧模型编写，只处理 `StartCause::Poll → RunEvent::Resumed`，而新模型的 `Event::Resumed`/`Event::Suspended` 落入 `_ => ()` 被丢弃。

**实际影响**:

由于 Tauri 强制 `ControlFlow = Wait`（`lib.rs:4265-4267`），`StartCause::Poll` 永远不会触发（只在 `ControlFlow::Poll` 时才触发）。因此 **`RunEvent::Resumed` 在 Tauri 所有平台（桌面、iOS、Android、OHOS）上都是死代码**，永远不会触发。

| 平台 | `StartCause::Poll` 能否触发 | `RunEvent::Resumed` 实际状态 |
|------|--------------------------|---------------------------|
| 桌面 (Windows/macOS/Linux) | ✗（ControlFlow=Wait） | ❌ 死代码，永远不触发 |
| iOS/Android | ✗（ControlFlow=Wait） | ❌ 死代码，永远不触发 |
| OHOS | ✗（纯回调式事件循环，无 StartCause） | ❌ 死代码，永远不触发 |

**结论**: Resumed/Suspended 问题不是"OHOS 语义错误"，而是 **Tauri 全平台未适配 Tao 生命周期事件演进** 的历史遗留问题。修复需要：
- 在 tauri-runtime-wry 中处理 `Event::Resumed`/`Event::Suspended`（替代 `StartCause::Poll`）
- 新增 `RunEvent::Suspended` 变体
- 评估移除 `StartCause::Poll → Resumed` 映射对桌面平台的影响

**本次决策**: 🚫 **不在本次解决**，标记为历史遗留，后续统一处理。

---

#### Opened — 深链接打开

**功能**: 用户通过深链接/URL 打开应用时触发（例如从浏览器点击链接启动应用）。

**字段**: `urls: Vec<url::Url>` — 要打开的 URL 列表

**Cfg 限制**: `#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android", target_env = "ohos"))]`

**OHOS 支持状态**: ✅ 已支持 — OHOS 通过 `onNewWant` → `Event::NewWant` → `Event::Opened` 链路实现

**触发路径**: `UIAbility::onNewWant(want)` → ArkTS `lifecycle.windowStageEventCallback.onNewWant(uri)` → Rust `Event::NewWant { uri }` → tao `MainEvent::NewWant` → `Event::Opened { urls }` → tauri-runtime-wry `RunEvent::Opened { urls }` → tauri `RunEvent::Opened { urls }`

**关键修改**:
- openharmony-ability: `Event::NewWant { uri: String }` 变体 + lifecycle 闭包 + ArkTS `onNewWant` handler
- tao OHOS: `MainEvent::NewWant { uri }` → `url::Url::parse(&uri)` → `Event::Opened { urls: vec![url] }`
- tauri-runtime: `Opened` cfg 扩展包含 `target_env = "ohos"`
- tauri-runtime-wry: `Event::Opened` handler cfg 扩展包含 `target_env = "ohos"`
- tauri/app.rs: `RunEvent::Opened` cfg 扩展包含 `target_env = "ohos"`

---

#### Reopen — 应用重新激活

**功能**: macOS 上的 Dock 点击重新激活事件，对应 `NSApplicationDelegate.applicationShouldHandleReopen`。

**字段**: `has_visible_windows: bool` — 是否有可见窗口

**Cfg 限制**: `#[cfg(target_os = "macos")]` — macOS 专属

**OHOS 支持状态**: ❌ 不支持 — 这是 macOS 特有概念

**OHOS 对应机制**: OHOS 上类似的概念是应用从后台恢复 (`onForeground`)，更接近 `Resumed` 而非 `Reopen`。

---

### 1.3 RunEvent 在 OHOS 上的状态汇总

| RunEvent 变体 | 功能 | tao 映射来源 | OHOS 触发时机 | OHOS 状态 | 备注 |
|--------------|------|------------|-------------|-----------|------|
| `Ready` | 应用就绪 | `NewEvents(StartCause::Init)` | `SurfaceCreate` | ✅ 正常触发 | |
| `ExitRequested` | 即将退出 | 合成（窗口关闭/`RequestExit`/`LoopDestroyed`） | 最后窗口关闭 / `AppHandle::exit()` / `onDestroy`（含系统关闭，见 2.2 时序修复） | ✅ 正常触发 | |
| `Exit` | 已退出 | `LoopDestroyed` | `MainEvent::Destroy` | ✅ 正常触发 | |
| `WindowEvent` | 窗口事件 | `Event::WindowEvent` | 各种窗口操作 | ✅ 正常触发 | Resized/Focused/ScaleFactorChanged/CloseRequested |
| `WebviewEvent` | Webview 事件 | `Event::UserEvent(WebviewEvent)` | JS→Rust 事件 | ✅ 正常触发 | |
| `MainEventsCleared` | 事件处理完毕 | `Event::MainEventsCleared` | 每轮事件后 | ✅ 正常触发 | tao OHOS 在每个事件回调后发送 |
| `UserEvent(T)` | 用户自定义事件 | `Event::UserEvent` | 用户发送 | ✅ 正常触发 | |
| `Resumed` | 应用恢复 | `StartCause::Poll`（旧模型） | — | 🚫 死代码 | 跨平台遗留：`StartCause::Poll` 在 Tauri `ControlFlow::Wait` 下永远不触发；`Event::Resumed` 被 `_ => ()` 丢弃 |
| `Suspended` | 应用挂起 | — | — | ❌ 不存在 | `RunEvent::Suspended` 变体不存在；`Event::Suspended` 被 `_ => ()` 丢弃 |
| `Opened` | 深链接打开 | `Event::Opened` | `onNewWant` → `NewWant` | ✅ 已支持 | OHOS cfg 已扩展；openharmony-ability 新增 `NewWant` + ArkTS `onNewWant` |
| `Reopen` | macOS Dock 点击 | `Event::Reopen` | — | ❌ macOS 专属 | OHOS 无此概念，不需要 |

---

## 第二部分：OHOS 生命周期与 RunEvent 对照

### 2.1 OpenHarmony Ability 生命周期

| OHOS 回调 | 说明 | 当前 tao 映射 | 当前 RunEvent 映射 |
|-----------|------|--------------|------------------|
| `onCreate` | Ability 创建 | 无 (tao 初始化在 init 函数) | 无 |
| `onStart` (MainEvent::Start) | Ability 可见但未获焦 | `warn!("TODO")` — 未映射 | ❌ 无 |
| `onResume` (MainEvent::Resume) | Ability 获焦可交互 | `Event::Resumed` | 🚫 跨平台遗留：tauri 未适配，`_ => ()` 丢弃（不在本次解决） |
| `onPause` (MainEvent::Pause) | Ability 失焦但仍可见 | `debug!("App Paused")` — 未映射 | 🚫 跨平台遗留（不在本次解决） |
| `onStop` | Ability 不再可见 | 无 | ❌ 无 |
| `onDestroy` (MainEvent::Destroy) | Ability 被销毁 | `MainEvent::Destroy` → `Event::LoopDestroyed`（tao/src/platform_impl/ohos/mod.rs） | ✅ 已映射：`RunEvent::ExitRequested{code:None}` + `RunEvent::Exit`（tauri-runtime-wry OHOS 分支；prevent_exit 在此路径被丢弃，无法阻止退出） |
| `onSaveState` (MainEvent::SaveState) | 状态保存 | `warn!("TODO")` — 未映射 | ❌ 无 |
| `onNewWant` | 深链接/新 Intent | `MainEvent::NewWant` → `Event::Opened` | ✅ 已映射 |
| `SurfaceCreate` | 界面创建 | `Event::NewEvents(Init)` + `Event::Resumed` | `RunEvent::Ready` + `Event::Resumed` 被 `_ => ()` 丢弃（🚫 跨平台遗留） |
| `SurfaceDestroy` | 界面销毁 | `Event::Suspended` | 🚫 跨平台遗留：`_ => ()` 丢弃（不在本次解决） |

### 2.2 关键缺失总结

| 问题 | 严重程度 | 影响 | 本次是否解决 |
|------|----------|------|-------------|
| `Resumed`/`Suspended` 跨平台遗留 — tauri 未适配 Tao 生命周期事件演进，`Event::Resumed`/`Event::Suspended` 被 `_ => ()` 丢弃，`StartCause::Poll → Resumed` 是死代码 | 🔴 高 | 所有平台（含桌面）都无法响应后台恢复/挂起，但目前无人依赖该事件所以静默失效 | 🚫 不在本次解决，标记为历史遗留 |
| `onNewWant` / Opened 深链接缺失 | 🟡 中 | OHOS 应用无法处理深链接跳转 | ✅ 已解决：openharmony-ability 新增 `NewWant` + ArkTS `onNewWant`，tao 映射到 `Event::Opened`，tauri-runtime cfg 扩展 |
| `onDestroy` 退出链时序缺陷 — `onAbilityDestroy()`（触发 Rust `Event::Destroy → LoopDestroyed → RunEvent::ExitRequested/Exit` 的唯一 ArkTS 钩子）曾排在 `onDestroy` 异步队列尾部、位于两个 await 桥接往返之后；系统在 onDestroy 后 ~12ms 即 ClearSession 强杀进程（hilog 实测 onWindowStageDestroy→onDestroy→PROCESS_KILL 仅 12ms），异步链永远跑不完 → 系统关闭（最近任务/任务管理器）场景 RunEvent 退出链零日志，与桌面端语义不一致 | 🔴 高 | app 在 `on_run_event` 里写的退出清理逻辑（保存状态/flush 文件）在系统关闭时不执行 | ✅ 已解决（2026-08-31）：`NativeAbility.onDestroy` 将 `onAbilityDestroy()` 同步前置到入口（`BridgeHostRegistry.beginClosing` 之后、`enqueueLifecycleOperation` 之前），全链同步微秒级完成；审计确认 prevent_exit 在 LoopDestroyed 路径被 tauri-runtime-wry 丢弃（不会挂起）、`RunEvent::Exit → cleanup_before_exit` 只清内存表不发 bridge 调用、不影响接续（onWindowStageRestore）路径。注：窗口关闭按钮路径（CloseRequested→Destroyed→ExitRequested→Exit）修复前即正常；本修复补齐的是系统强杀路径 |
| `onStart/onStop` 生命周期缺失 | 🟢 低 | 大多数应用不需要，但完整性缺失 | 🚫 不解决 |
| `onSaveState` 状态保存缺失 | 🟢 低 | OHOS 特定需求，大多数应用不使用 | 🚫 不解决 |

---

## 第三部分：修改设计

### 3.1 修改目标

1. 🚫 **Resumed/Suspended 适配** — 跨平台历史遗留问题，不在本次解决。Tauri 全平台都存在 `Event::Resumed`/`Event::Suspended` 被 `_ => ()` 丢弃的问题，需要统一评估对桌面平台的影响后再处理。
2. ✅ **新增 `Opened` RunEvent 支持 OHOS** — 映射 OHOS `onNewWant` 深链接

### 3.2 各层修改详情（仅 Opened）

#### 3.2.1 tao 层 (`tao/src/platform_impl/ohos/mod.rs`)

**修改**: 添加 `MainEvent::NewWant` 事件

openharmony-ability 需要新增 `NewWant` 事件类型，传递 `want.uri`:

```rust
MainEvent::NewWant { uri: String } => {
  if let Some(ref mut h) = *self.event_loop.borrow_mut() {
    h(event::Event::Opened(OpenHarmonyUrlEvent { urls: vec![uri] }));
  }
}
```

> 注意: 这需要 openharmony-ability crate 的配合修改，在 ArkTS 层的 `NativeAbility.onNewWant()` 中将 `want.uri` 通过 napi 传递给 Rust。

#### 3.2.2 tauri-runtime 层 (`crates/tauri-runtime/src/lib.rs`)

**修改**: 将 `Opened` 的 cfg 从 `macos/ios/android` 扩展到包含 `ohos`:

```rust
// 旧:
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
Opened { urls: Vec<url::Url> },

// 新:
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android", target_env = "ohos"))]
Opened { urls: Vec<url::Url> },
```

#### 3.2.3 tauri-runtime-wry 层 (`crates/tauri-runtime-wry/src/lib.rs`)

**修改**: 在 `handle_event_loop` 中添加 `Event::Opened` 的处理（OHOS 扩展后）:

```rust
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android", target_env = "ohos"))]
Event::Opened(ref urls) => {
  callback(RunEvent::Opened { urls: urls.clone() });
}
```

> 注意: tao 需要先支持 `Event::Opened` 在 OHOS 上。这取决于 tao 的事件定义是否有 cfg 限制。

#### 3.2.4 openharmony-ability 层

**修改**: 在 ArkTS 的 `NativeAbility.onNewWant()` 中传递深链接 URI:

```typescript
// NativeAbility.ets
onNewWant(want: Want, launchParam: AbilityConstant.LaunchParam): void {
  if (want.uri) {
    this.app.sendMainEvent('NewWant', { uri: want.uri });
  }
}
```

在 Rust 层的 `MainEvent` enum 中添加 `NewWant` 变体:

```rust
pub enum MainEvent {
  // ... existing variants ...
  NewWant { uri: String },
}
```

### 3.3 修改清单（仅 Opened）

| 层级 | 文件 | 修改内容 |
|------|------|----------|
| tao | `src/platform_impl/ohos/mod.rs` | 新增 `MainEvent::NewWant` → `Event::Opened` 映射 |
| tauri-runtime | `src/lib.rs` | 扩展 `Opened` cfg 包含 OHOS |
| tauri-runtime-wry | `src/lib.rs` | 处理 `Event::Opened`（OHOS） |
| openharmony-ability | ArkTS `NativeAbility.ets` | `onNewWant` 传递 URI |
| openharmony-ability | Rust `MainEvent` enum | 新增 `NewWant` 变体 |

### 3.4 Resumed/Suspended 历史遗留备注

**问题本质**: winit 0.28 引入了 `Event::Resumed`/`Event::Suspended` 作为独立的生命周期事件（替代旧的 `StartCause` 体系），Tao 继承了这一设计，但 tauri-runtime-wry 仍基于旧模型：

- `StartCause::Poll → RunEvent::Resumed` 是旧模型的合理映射，但在 Tauri 的 `ControlFlow::Wait` 限制下是死代码
- `Event::Resumed`/`Event::Suspended` 被 `_ => ()` 丢弃，所有平台都受影响
- 修复需统一评估对桌面平台的影响，不宜在 OHOS 移植中单独处理

**后续修复方向**（供参考，不在本次实施）:
1. 在 tauri-runtime-wry 中处理 `Event::Resumed`/`Event::Suspended`
2. 新增 `RunEvent::Suspended` 变体
3. 评估移除 `StartCause::Poll → Resumed` 映射的影响