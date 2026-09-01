# tao-bridge-migration spec

## Purpose

将 tao 的 OHOS 后端从旧的 `openharmony_ability::window::{散函数}` 直接 NAPI 调用模型迁移到 A0 引入的 pluginized bridge 架构（`WindowClient` / `AppControlExt` facade + `bridgeInvoke` 具名契约）。

## Requirements

### REQ-001: 依赖调整

tao 的 OHOS target 依赖必须包含 bridge plugin facades：

```toml
[target."cfg(target_env = \"ohos\")".dependencies]
openharmony-ability-plugin-window = { path = "../openharmony-ability/crates/plugin-window" }
openharmony-ability-plugin-app-control = { path = "../openharmony-ability/crates/plugin-app-control" }
# tao 是独立 workspace，不能用 workspace = true；直接指定版本与 openharmony-ability 一致
tokio = { version = "1", features = ["rt", "sync"] }
```

`openharmony-ability` 和 `openharmony-ability-derive` 依赖保留。

### REQ-002: 异步 bridge 执行器

tao 必须在 `EventLoop::new()` 中创建一个后台 tokio current-thread runtime（`BridgeExecutor`），用于 spawn async bridge calls。

- `BridgeExecutor` 存储在 `EventLoop` 中
- `Window` 通过 clone 获取 `BridgeExecutor` 和 `WindowClient`
- `tokio::runtime::Handle` 是 `Clone + Send + Sync`，可安全共享
- 后台线程名：`ohos-bridge-rt`
- spawn 的 future 在后台线程 poll，TSFN callback 在 ArkTS 主线程执行 → 无死锁

### REQ-003: fire-and-forget window ops 迁移

以下 tao 方法必须从旧 `openharmony_ability::window::{散函数}` 迁移到 `WindowClient` async 方法，通过 `BridgeExecutor::spawn()` fire-and-forget 调用：

| tao 方法 | WindowClient 方法 | action |
|----------|-------------------|--------|
| `set_inner_size` | `resize_window` | `resize` |
| `set_outer_position` | `move_window_to` | `move-to` |
| `set_minimized(true)` | `minimize_window` | `minimize` |
| `set_minimized(false)` | `restore_window` | `restore` |
| `set_maximized(true)` | `maximize_window` | `maximize` |
| `set_maximized(false)` | `recover_window` | `recover` |
| `set_visible(true)` | `restore_window` + `show_window` | `restore` + `show` |
| `set_visible(false)` | `minimize_window` | `minimize` (stub, A1 后替换) |
| `set_focus` | `focus_window` | `focus` |
| `set_focusable` | `set_window_focusable` | `set-focusable` |
| `set_decorations` | `set_window_decorations` | `set-decorations` |
| `set_background_color` | `set_window_background_color` | `set-background-color` |

**约束**：
- `window_id > 0` guard 在 `set_focus` / `set_focusable` 上保留（主窗口 window_id=0 的 focus/focusable 是 OS 管理的）
- 错误处理：`warn!` 记录错误详情 + 不影响 tao API 返回值
- `WindowClient` 在 `Window::new()` 中通过 `app.window()` 创建，缓存在 `Window` struct 中

### REQ-004: 状态缓存 — is_maximized / is_minimized

`is_maximized()` 和 `is_minimized()` 必须返回同步 `bool`，不使用 async bridge 调用。

**方案**：AtomicBool 状态缓存。

- `Window` struct 新增 `maximized: AtomicBool` 和 `minimized: AtomicBool`
- `set_maximized(b)` / `set_minimized(b)` 在 spawn async bridge call 之前立即更新缓存
- `is_maximized()` / `is_minimized()` 读缓存 `load(Acquire)`
- 初始值：`false`

**理由**：
1. tao 的 `is_maximized()` / `is_minimized()` 是同步 API（返回 `bool`）
2. bridge 的 `WindowClient::is_window_maximized` 是 async，从主线程 block_on 会导致 TSFN callback 死锁
3. Windows 平台也使用缓存模式（`WindowFlags::MAXIMIZED`）

### REQ-005: create_os_window 保留 core

`Window::new()` 中的 `create_os_window(params)` 必须保留为 core 同步 NAPI 调用（`openharmony_ability::window::create_os_window`）。

**理由**：
1. `Window::new()` 是同步 API，需要 window_id 结果构造 Window struct
2. window_id 在 Rust 侧预分配（`NEXT_WINDOW_ID`），不需要从 ArkTS 返回
3. 从主线程 block_on async 会导致 TSFN callback 死锁

### REQ-005a: window id '0' 注册表 gap 修复（WindowPlugin 侧）

REQ-003 把 window *操作* 迁到 `WindowBridgePlugin`（ArkTS `WindowPlugin`，`windows: Map<number, window.Window>`），REQ-005 把 window *创建* 保留在 core NAPI（`create_os_window` → `WindowManager`）。两者各自维护一份非互通的窗口注册表：

- `WindowPlugin.windows` Map 仅由 `create-os-window` action 填充（子窗口，platform id 非零）。
- 主窗口（逻辑 id `0`）与 core `create_os_window` 创建的 Float 子窗口只在进程级 `WindowManager` 注册表（`uiAbilityStages` / `windows`），从不进 `WindowPlugin.windows`。

结果：tao 经 `WindowClient` 传 `window_id=0` 调用任何迁移后的 op，ArkTS `WindowPlugin.requireWindow(0)` 命中空 Map → `Unknown OS sub-window '0' for this plugin instance`。装饰/位置/背景色/最大化等全部失败（非白屏，但窗口属性不生效）。

**修复（ArkTS `WindowPlugin.requireWindow`）**：签名改为 `requireWindow(windowId, context: BridgeCallContext)`，解析顺序：
1. `this.windows.get(windowId)`（plugin 自建子窗口，快路径）
2. id `0` 时 `context.getWindow()`（宿主组件自身主窗口，最快，与 `get-avoid-area` 一致）
3. `WindowManager.getInstance().getWindow(id)` 兜底（覆盖后续 UIAbility 主窗口 + Float 子窗口，已含 BigInt 归一化）
4. 仍 `undefined` → 抛原错误

`destroy-window` 加 id=0 守卫（主窗口属 Ability 生命周期，插件不可销毁）。其余 op 全部经 `context` 透传 `requireWindow`。

**约束**：
- `window_id > 0` guard（REQ-003）针对 `set_focus`/`set_focusable` 的 OS 语义限制不变；本条修复的是"找不到窗口"的注册表 gap，是另一回事。
- 兜底用 `WindowManager` 单例，不引入新桥接通道，符合铁律#1（所有系统调用经 openharmony-ability）。

### REQ-006: exit(0) 迁移到 AppControlExt::terminate

`EventLoop::run_return()` 中 `self.openharmony_app.exit(0)` 必须替换为 `AppControlExt::terminate(env, 0)`。

**实现**：
1. 通过 `openharmony_ability::get_main_thread_env()` 获取当前线程的 `Env`
2. 调用 `self.openharmony_app.terminate(&env, 0)`
3. 错误处理：`warn!` 记录，不 panic
4. Env 不可用时降级：`warn!` 记录，跳过

### REQ-007: set_color_mode 迁移到 AppControlExt

`EventLoopWindowTarget::set_theme()` 和 `Window::set_theme()` 中的 `self.app.set_color_mode(color_mode)` 必须替换为 `ColorModeExt::set_color_mode(env, mode_i32)`。

**跨仓改动**：在 `plugin-app-control` 中新增 `set-color-mode` action：
- `SetColorModeRequest { color_mode: i32 }` / `SetColorModeResponse { accepted: bool }`
- `ColorModeExt` trait，`OpenHarmonyApp` impl
- ArkTS 侧 `setAppColorMode(code: i32)`，必须使用 switch/default 映射到 `ConfigurationConstant.ColorMode`（0→DARK, 1→LIGHT, default→NOT_SET），并用 `setTimeout(() => setColorMode(), 0)` 延迟（参照现有 `ArkHelper.ets` L893-927 的实现模式）

**ColorMode 映射**：`Dark=0, Light=1, NoSet=2`

### REQ-008: set_ignore_cursor_events 保留 core

`Window::set_ignore_cursor_events()` 保留调用 `openharmony_ability::window::set_window_touchable`。

**理由**：`WindowClient` 当前没有 `set_window_touchable` 方法（plugin-window 缺少 `set-touchable` action）。在 A1 补充此 action 后，可后续替换。

**错误处理**：保持现有逻辑 — `warn!` + `ExternalError::NotSupported`（ohos-constraints.md 1.5）

### REQ-009: set_visible A1 stub

`Window::set_visible()` 使用 minimize/restore workaround 作为 A1 stub。

- `set_visible(true)` → `restore_window` + `show_window` (async, fire-and-forget)
- `set_visible(false)` → `minimize_window` (async, fire-and-forget)
- 代码中留 `// TODO(A1)` 标记，A1 完成后替换为 `AppControlExt::hide_ability(env)` / `show_ability(env)`

### REQ-010: cfg 隔离

所有改动必须在 `#[cfg(target_env = "ohos")]` 内：
- `tao/Cargo.toml` 依赖在 OHOS target 段
- `tao/src/platform_impl/ohos/mod.rs` 仅在 OHOS 编译时包含
- 不影响 Windows / macOS / Linux / iOS / Android 平台

### REQ-011: 不修改 tao 公共 API

tao 的公共 API 签名不变：
- `set_inner_size(&self, size: Size)` 仍返回 `()`
- `is_maximized(&self) -> bool` 仍返回 `bool`
- `set_maximized(&self, maximized: bool)` 仍返回 `()`
- 所有 Window / EventLoop / EventLoopWindowTarget 的 public 方法签名保持不变

### REQ-012: 纯 Rust binding 保留 core

以下调用不迁移，保留在 core（纯 Rust FFI / 内存缓存）：
- `display_width()` / `display_height()` / `refresh_rate()` / `scale()` — `ohos_display_binding`
- `content_rect()` / `window_rect()` — `OpenHarmonyAppInner` 缓存
- `native_window()` — `RawWindow` handle
- `config()` — `OpenHarmonyAppInner` 缓存
- `run_loop()` — 事件循环入口
- `create_waker()` — `OpenHarmonyWaker`
- `cursor_position()` — `CURSOR_POSITION_X/Y` AtomicU64
- 输入事件类型 (`Action`, `MouseButton`, `TouchEvent`, `AxisEventData`, etc.) — 类型定义
