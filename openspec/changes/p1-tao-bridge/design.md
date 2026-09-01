# Phase B1 技术设计

## 1. 调用点分析

### 1.1 当前调用清单

下表列出 `tao/src/platform_impl/ohos/mod.rs` 中所有调用 `openharmony_ability::` 的位置（按文件行号），以及迁移目标。

| # | 调用位置 (行) | 旧 API | 迁移目标 | 返回值需求 | 类别 |
|---|-------------|--------|---------|-----------|------|
| 1 | L654 `self.openharmony_app.exit(0)` | `OpenHarmonyApp::exit(i32)` (已移除) | `AppControlExt::terminate(env, 0)` | 无（fire-and-forget） | app-control (MainThreadSync) |
| 2 | L758 `self.app.set_color_mode(color_mode)` | `OpenHarmonyApp::set_color_mode(ColorMode)` (已移除) | `AppControlExt::set_color_mode(env, mode)` (需新增 action) | 无（fire-and-forget） | app-control (MainThreadSync) |
| 3 | L1300 `self.app.set_color_mode(color_mode)` | 同上 | 同上 | 无 | 同上 |
| 4 | L902 `create_os_window(params)` | `window::create_os_window(WindowCreateParams) -> Result<i64>` | 保留为 core（同步 NAPI） | **需要同步结果** (window_id) | 留 core |
| 5 | L918 `set_window_decorations(0, false)` | `window::set_window_decorations(i64, bool)` | `WindowClient::set_window_decorations(wid, dec)` | 无 | plugin-window (async) |
| 6 | L988 `resize_window(window_id, w, h)` | `window::resize_window(i64, i64, i64)` | `WindowClient::resize_window(wid, w, h)` | 无 | plugin-window (async) |
| 7 | L1003 `move_window_to(window_id, x, y)` | `window::move_window_to(i64, i64, i64)` | `WindowClient::move_window_to(wid, x, y)` | 无 | plugin-window (async) |
| 8 | L1041 `restore_window(window_id)` | `window::restore_window(i64)` | `WindowClient::restore_window(wid)` | 无 | plugin-window (async) |
| 9 | L1042 `show_window(window_id)` | `window::show_window(i64)` | `WindowClient::show_window(wid)` | 无 | plugin-window (async) |
| 10 | L1044 `minimize_window(window_id)` | `window::minimize_window(i64)` | `WindowClient::minimize_window(wid)` | 无 | plugin-window (async) |
| 11 | L1052 `focus_window(window_id)` | `window::focus_window(i64)` | `WindowClient::focus_window(wid)` | 无 | plugin-window (async) |
| 12 | L1066 `set_window_focusable(window_id, focusable)` | `window::set_window_focusable(i64, bool)` | `WindowClient::set_window_focusable(wid, f)` | 无 | plugin-window (async) |
| 13 | L1105 `minimize_window(window_id)` | 同 #10 | 同 #10 | 无 | plugin-window (async) |
| 14 | L1107 `restore_window(window_id)` | 同 #8 | 同 #8 | 无 | plugin-window (async) |
| 15 | L1126 `maximize_window(window_id)` | `window::maximize_window(i64)` | `WindowClient::maximize_window(wid)` | 无 | plugin-window (async) |
| 16 | L1129 `recover_window(window_id)` | `window::recover_window(i64)` | `WindowClient::recover_window(wid)` | 无 | plugin-window (async) |
| 17 | L1114 `is_window_minimized(window_id)` | `window::is_window_minimized(i64) -> Result<bool>` | **状态缓存** (AtomicBool) | **需要同步结果** (bool) | 留 core / 缓存 |
| 18 | L1136 `is_window_maximized(window_id)` | `window::is_window_maximized(i64) -> Result<bool>` | **状态缓存** (AtomicBool) | **需要同步结果** (bool) | 留 core / 缓存 |
| 19 | L1156 `set_window_decorations(window_id, dec)` | 同 #5 | 同 #5 | 无 | plugin-window (async) |
| 20 | L1227 `set_window_touchable(window_id, !ignore)` | `window::set_window_touchable(i64, bool)` | `WindowClient::set_window_touchable(wid, t)` (需确认 action) | 无 | plugin-window (async) |
| 21 | L1269 `set_window_background_color(window_id, color)` | `window::set_window_background_color(i64, u32)` | `WindowClient::set_window_background_color(wid, c)` | 无 | plugin-window (async) |

**保留为 core 的调用**（不受 bridge 迁移影响）：

| # | 调用 | 来源 | 原因 |
|---|------|------|------|
| C1 | `self.app.display_width()` / `display_height()` | `ohos_display_binding` (纯 Rust FFI) | 纯 Rust binding，不走 ArkTS |
| C2 | `self.app.refresh_rate()` | `ohos_display_binding` | 同上 |
| C3 | `self.app.scale()` | `ohos_display_binding` | 同上 |
| C4 | `self.app.content_rect()` / `window_rect()` | `OpenHarmonyAppInner` 缓存 | Rust 内存缓存 |
| C5 | `self.app.native_window()` | `RawWindow` handle | Rust 句柄 |
| C6 | `self.app.config()` | `OpenHarmonyAppInner` 缓存 | Rust 内存缓存 |
| C7 | `self.app.run_loop(\|event\| ...)` | 事件循环入口 | 非 bridge 范畴 |
| C8 | `self.app.create_waker()` | `OpenHarmonyWaker` | 非 bridge 范畴 |
| C9 | `CURSOR_POSITION_X/Y` (AtomicU64) | 全局静态 | 纯 Rust 原子读取 |
| C10 | `xcomponent::{Action, MouseButton, TouchEvent}` | 输入事件类型 | 类型定义，非函数调用 |
| C11 | `{AxisEventData, InputSourceType, ...}` | 输入事件类型 | 同上 |

### 1.2 映射策略

#### 1.2.1 plugin-window action 映射（fire-and-forget，共 12 处）

tao 的 window 操作 API 全部是同步无返回值 (`pub fn set_xxx(&self, ...)`)。旧实现使用 TSFN NonBlocking fire-and-forget，新 bridge 的 `WindowClient` 方法是 async。

**适配策略**：在后台 tokio runtime 上 spawn async future，不等待结果。

| tao 方法 | WindowClient 方法 | action | 备注 |
|----------|-------------------|--------|------|
| `set_inner_size` | `resize_window` | `resize` | |
| `set_outer_position` | `move_window_to` | `move-to` | |
| `set_minimized(true)` | `minimize_window` | `minimize` | |
| `set_minimized(false)` | `restore_window` | `restore` | |
| `set_maximized(true)` | `maximize_window` | `maximize` | |
| `set_maximized(false)` | `recover_window` | `recover` | |
| `set_visible(true)` | `restore_window` + `show_window` | `restore` + `show` | 两个调用 |
| `set_visible(false)` | `minimize_window` | `minimize` | **stub** — A1 后改为 `hide-ability` |
| `set_focus` | `focus_window` | `focus` | window_id > 0 guard 保留 |
| `set_focusable` | `set_window_focusable` | `set-focusable` | window_id > 0 guard 保留 |
| `set_decorations` | `set_window_decorations` | `set-decorations` | |
| `set_background_color` | `set_window_background_color` | `set-background-color` | |

> **`set_ignore_cursor_events` 不在迁移范围内**（详见 3.7 节）：`WindowClient` 当前没有 `set_window_touchable` 方法，plugin-window 也缺少 `set-touchable` action。B1 保留调用旧 core 函数 `openharmony_ability::window::set_window_touchable`（该函数在 `window/mod.rs` 中使用 TSFN fire-and-forget，仍可用）。A1 补充此 action 后可后续替换。

#### 1.2.2 plugin-app-control action 映射（MainThreadSync，共 3 处）

| tao 方法 | AppControlExt 方法 | action | 执行模式 | 备注 |
|----------|-------------------|--------|---------|------|
| `EventLoop::exit(0)` | `terminate(env, 0)` | `terminate` | MainThreadSync | 需要 `Env`，从 `get_main_thread_env()` 获取 |
| `set_theme (Window)` | `set_color_mode(env, mode)` | `set-color-mode` | MainThreadSync | **需新增 action**（~30 行） |
| `set_theme (EventLoopWindowTarget)` | `set_color_mode(env, mode)` | `set-color-mode` | MainThreadSync | 同上 |

> **set-color-mode action 设计**：与 `terminate` 同模式，`ColorMode` 映射为 i32 (0=Dark, 1=Light, 2=NoSet)。ArkTS 侧 `setAppColorMode(code: i32)` → `context.getApplicationContext().setColorMode(code)`，需 `setTimeout(() => ..., 0)` 延迟避免 onConfigurationUpdate 死锁（见 ohos-constraints.md 4.3）。

#### 1.2.3 留 core 的调用（同步结果需求，共 3 处）

| tao 方法 | 旧 API | 留 core 原因 | 替代方案 |
|----------|--------|-------------|---------|
| `is_maximized()` | `is_window_maximized(wid) -> Result<bool>` | bridge async 返回 bool 无法同步获取 | **AtomicBool 缓存** |
| `is_minimized()` | `is_window_minimized(wid) -> Result<bool>` | 同上 | **AtomicBool 缓存** |
| `Window::new()` 中 `create_os_window` | `create_os_window(params) -> Result<i64>` | bridge async 返回 window_id 无法同步获取 | **保留 core 同步 NAPI** |

**AtomicBool 状态缓存方案**（参照 Windows 平台 `WindowFlags::MAXIMIZED`）：

```
Window struct 新增:
  maximized: AtomicBool  // 初始 false
  minimized: AtomicBool  // 初始 false

set_maximized(true)  → maximized.store(true)  + spawn(maximize_window(wid))
set_maximized(false) → maximized.store(false) + spawn(recover_window(wid))
set_minimized(true)  → minimized.store(true)  + spawn(minimize_window(wid))
set_minimized(false) → minimized.store(false) + spawn(restore_window(wid))
is_maximized()       → maximized.load()
is_minimized()       → minimized.load()
```

**已知局限**：当用户通过 OS 手势改变窗口状态时（如点击标题栏最大化按钮），缓存不会自动更新。这在实践中影响有限：
- OHOS Float 窗口在 `decorations=false` 时没有标题栏按钮
- 旧实现通过 `getWindowStatus()` 同步查询也有类似的时序问题
- 如需精确状态，可在 `MainEvent::WindowResize` 等事件中追加一次异步查询更新缓存（后续优化）

#### 1.2.4 A1 stub 处理（hide/show ability，1 处）

`set_visible(false)` 当前使用 `minimize_window` 作为 hide 的 workaround。A1 将在 plugin-app-control 中补充 `hide-ability` / `show-ability` action。

**B1 处理**：`set_visible` 暂保持 minimize/restore workaround（通过 plugin-window async 调用）。在 `tasks.md` 中留 TODO 标记，A1 完成后替换为 `AppControlExt::hide_ability(env)` / `show_ability(env)`。

#### 1.2.5 留 core 的纯 Rust binding（不迁移）

display_width/height、refresh_rate、scale、content_rect、window_rect、native_window、config、run_loop、create_waker、cursor_position — 这些都是纯 Rust FFI 或内存缓存，不走 ArkTS bridge，无需迁移。

## 2. Cargo.toml 依赖调整

### 2.1 新增依赖

```toml
[target."cfg(target_env = \"ohos\")".dependencies]
openharmony-ability = { path = "../openharmony-ability/crates/ability" }
openharmony-ability-derive = { path = "../openharmony-ability/crates/derive" }
# 新增：bridge plugin facades
openharmony-ability-plugin-window = { path = "../openharmony-ability/crates/plugin-window" }
openharmony-ability-plugin-app-control = { path = "../openharmony-ability/crates/plugin-app-control" }
# 新增：异步 bridge 调用的执行器
# 注意：tao 是独立 workspace（members = ["tao-macros"]），没有 [workspace.dependencies] 段，
# 不能用 workspace = true。直接指定版本，与 openharmony-ability 的 tokio 版本保持一致。
tokio = { version = "1", features = ["rt", "sync"] }
```

### 2.2 依赖说明

| 依赖 | 用途 | features |
|------|------|----------|
| `openharmony-ability-plugin-window` | `WindowClient` facade | 无需额外 feature |
| `openharmony-ability-plugin-app-control` | `AppControlExt` facade | 无需额外 feature |
| `tokio` | 后台 current-thread runtime，spawn async bridge calls | `rt` (runtime), `sync` (oneshot 等) |

> **tokio 依赖说明**：tao 是独立 workspace（`[workspace] members = ["tao-macros"]`，无 `[workspace.dependencies]` 段），不能用 `workspace = true`。直接指定 `version = "1"`，与 openharmony-ability 的 tokio 版本一致，避免版本冲突。tao 新增 tokio 仅用于 OHOS target，不影响其他平台。

### 2.3 移除依赖

旧 `use openharmony_ability::window::{...}` 导入的散函数将被移除。但 `openharmony-ability` 依赖保留（仍需 `OpenHarmonyApp`、`Event`、`Rect`、`ColorMode`、输入事件类型等 core 类型）。

## 3. 迁移方案（按函数/模块分组）

### 3.1 Window::new() — create_os_window

**现状**：`create_os_window(params)` 是同步 NAPI 调用，返回 `Result<i64>`（window_id）。tao 在 `Window::new()` 中同步使用返回的 window_id 构造 `Window` struct。

**设计决策**：保留 `create_os_window` 为 core 同步调用。

**理由**：
1. window_id 在 Rust 侧预分配（`NEXT_WINDOW_ID.fetch_add`），ArkTS 侧使用此 ID
2. `WindowClient::create_os_window` 是 async，返回 `WindowCreateResponse { window_id }` — 但 window_id 是 ArkTS 生成的，而旧实现是 Rust 预分配的
3. `Window::new()` 是同步 API（tao 跨平台契约），无法改为 async
4. 从主线程 block_on async future 会导致 TSFN callback 死锁（ohos-constraints.md 1.2）

**实现**：`create_os_window` 继续从 `openharmony_ability::window::create_os_window` 导入，调用方式不变。此函数在 A0 后仍保留在 ability crate 中（作为 core 同步函数）。

> **后续优化路径**（不在 B1 范围）：在 plugin-window 的 `WindowCreateRequest` 中添加 `window_id: i64` 字段（Rust 预分配），使 `create_os_window` 可以 fire-and-forget。这需要 A1 对 plugin-window 的修改。

### 3.2 异步 bridge 执行器（BridgeExecutor）

**设计**：在 `EventLoop::new()` 中创建一个后台 tokio current-thread runtime，用于 spawn async bridge calls。

```rust
struct BridgeExecutor {
    handle: tokio::runtime::Handle,
}

impl BridgeExecutor {
    fn new() -> Self {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("Failed to create OHOS bridge runtime");
        let handle = runtime.handle().clone();
        // 后台线程驱动 runtime
        std::thread::Builder::new()
            .name("ohos-bridge-rt".into())
            .spawn(move || runtime.block_on(std::future::pending::<()>()))
            .expect("Failed to spawn bridge runtime thread");
        Self { handle }
    }

    /// Spawn a fire-and-forget bridge call. Result is ignored.
    fn spawn<F>(&self, future: F)
    where
        F: std::future::Future<Output = ()> + Send + 'static,
    {
        self.handle.spawn(future);
    }
}
```

**线程安全分析**：
- BridgeExecutor 存储在 `EventLoop` 中，通过 `Window` 的 `runtime: BridgeExecutor` 字段共享
- `tokio::runtime::Handle` 是 `Clone + Send + Sync`
- spawn 的 future 在后台线程上 poll，TSFN NonBlocking 调用立即返回，TSFN callback 在 ArkTS 主线程执行 → 无死锁
- oneshot channel 的结果在后台线程接收，fire-and-forget 时 sender 被 drop → 结果静默丢弃

### 3.3 Window 操作迁移（fire-and-forget）

以 `set_inner_size` 为例：

```rust
// 旧
pub fn set_inner_size(&self, size: Size) {
    if let Some(window_id) = self.window_id {
        let physical = size.to_physical::<i32>(self.scale_factor());
        if let Err(e) = resize_window(window_id, physical.width as i64, physical.height as i64) {
            log::warn!("[tao-ohos] resize_window failed for window {}: {}", window_id, e);
        }
    }
}

// 新
pub fn set_inner_size(&self, size: Size) {
    if let Some(window_id) = self.window_id {
        let physical = size.to_physical::<i32>(self.scale_factor());
        let client = match &self.window_client {
            Some(c) => c.clone(),
            None => return,
        };
        self.runtime.spawn(async move {
            if let Err(e) = client.resize_window(window_id, physical.width as i64, physical.height as i64).await {
                log::warn!("[tao-ohos] resize_window failed for window {}: {:?}", window_id, e);
            }
        });
    }
}
```

**WindowClient 缓存**：`Window` struct 新增 `window_client: Option<WindowClient>` 字段，在 `Window::new()` 中从 `app.window()` 创建。`WindowClient` 是 `Clone`（内部仅持有 `BridgeRuntime` clone），每次操作时 clone 一份。

所有 fire-and-forget 操作按同一模式迁移。错误处理遵循 ohos-constraints.md 1.5：`warn!` 记录错误详情，不影响 tao API 返回值（这些方法本就返回 `()`）。

### 3.4 is_maximized / is_minimized 迁移（状态缓存）

```rust
// Window struct 新增字段
maximized: AtomicBool,
minimized: AtomicBool,

// set_maximized
pub fn set_maximized(&self, maximized: bool) {
    self.maximized.store(maximized, Ordering::Release);
    if let Some(window_id) = self.window_id {
        let client = match &self.window_client { Some(c) => c.clone(), None => return };
        if maximized {
            self.runtime.spawn(async move {
                if let Err(e) = client.maximize_window(window_id).await {
                    log::warn!("[tao-ohos] maximize_window failed for window {}: {:?}", window_id, e);
                }
            });
        } else {
            self.runtime.spawn(async move {
                if let Err(e) = client.recover_window(window_id).await {
                    log::warn!("[tao-ohos] recover_window failed for window {}: {:?}", window_id, e);
                }
            });
        }
    }
}

// is_maximized — 读缓存
pub fn is_maximized(&self) -> bool {
    self.maximized.load(Ordering::Acquire)
}
```

### 3.5 exit(0) 迁移（MainThreadSync）

```rust
// 旧 (L654): self.openharmony_app.exit(0);
// 新:
fn terminate_app(app: &OpenHarmonyApp) {
    use openharmony_ability_plugin_app_control::AppControlExt;
    let env_rc = openharmony_ability::get_main_thread_env().borrow().clone();
    if let Some(env) = env_rc {
        if let Err(e) = app.terminate(&env, 0) {
            log::warn!("[tao-ohos] terminate failed: {:?}", e);
        }
    } else {
        log::warn!("[tao-ohos] terminate failed: main thread Env not available");
    }
}
```

**调用时机**：`run_loop` 回调在 ArkTS/N-API 主线程执行。`get_main_thread_env()` 返回 `Some(env)`。`with_main_thread_bridge` 校验 `env.raw() == endpoint.owner_env`，应通过。

**fallback**：如果 Env 不可用（非主线程回调路径），降级为 `log::warn!`，不 panic。此路径在实际中不应出现（`run_loop` 回调始终在主线程），但防御性处理。

### 3.6 set_color_mode 迁移（MainThreadSync，需新增 action）

**跨仓改动**：在 `openharmony-ability/crates/plugin-app-control/src/lib.rs` 中新增 `set-color-mode` action：

```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct SetColorModeRequest {
    pub color_mode: i32,  // 0=Dark, 1=Light, 2=NoSet
}
impl_bridge_napi_type!(SetColorModeRequest, "ohos.app_control.SetColorModeRequest");

#[napi(object)]
#[derive(Clone, Debug)]
pub struct SetColorModeResponse {
    pub accepted: bool,
}
impl_bridge_napi_type!(SetColorModeResponse, "ohos.app_control.SetColorModeResponse");

// AppControlExt 扩展
pub trait ColorModeExt {
    fn set_color_mode(&self, env: &Env, color_mode: i32) -> Result<()>;
}

impl ColorModeExt for OpenHarmonyApp {
    fn set_color_mode(&self, env: &Env, color_mode: i32) -> Result<()> {
        self.with_main_thread_bridge(env, |bridge| {
            let response = bridge
                .call_sync::<AppControlBridgePlugin, SetColorModeRequest, SetColorModeResponse>(
                    "set-color-mode",
                    SetColorModeRequest { color_mode },
                )?;
            if !response.accepted {
                return Err(Error::from_reason("App-control plugin rejected color mode change"));
            }
            Ok(())
        })
    }
}
```

**tao 侧调用**：

```rust
// 旧 (L758, L1300): self.app.set_color_mode(color_mode);
// 新:
use openharmony_ability_plugin_app_control::ColorModeExt;
let env_rc = openharmony_ability::get_main_thread_env().borrow().clone();
if let Some(env) = env_rc {
    let mode_i32 = match color_mode {
        ColorMode::Dark => 0,
        ColorMode::Light => 1,
        ColorMode::NoSet => 2,
    };
    if let Err(e) = self.app.set_color_mode(&env, mode_i32) {
        log::warn!("[tao-ohos] set_color_mode failed: {:?}", e);
    }
} else {
    log::warn!("[tao-ohos] set_color_mode failed: main thread Env not available");
}
```

> **ArkTS 侧**：`setAppColorMode(code: i32)` 需在 AppControlPlugin.ets 中实现。**必须使用 switch/default 模式映射到 `ConfigurationConstant.ColorMode` 枚举值**（0→COLOR_MODE_DARK, 1→COLOR_MODE_LIGHT, default→COLOR_MODE_NOT_SET），不能直接将 `code` 传给 `setColorMode`（OHOS `setColorMode` 期望枚举值，`2` 不是合法的 NOT_SET 值）。可参照现有 `ArkHelper.ets` 中 `setColorMode` 的实现（L893-927）。必须用 `setTimeout(() => ..., 0)` 延迟调用 `setColorMode`，避免同步触发 `onConfigurationUpdate` → 回调 Rust → 主线程死锁（ohos-constraints.md 4.3）。

### 3.7 set_ignore_cursor_events（需确认 action）

`WindowClient` 当前没有 `set_window_touchable` 方法。plugin-window 的 action 列表中也没有 `set-touchable`。

**B1 处理**：保留调用旧 core 函数 `openharmony_ability::window::set_window_touchable`（该函数在 ability crate 中仍存在，使用 TSFN fire-and-forget）。

> **后续**：在 A1 中为 plugin-window 补充 `set-touchable` action 和 `WindowClient::set_window_touchable` 方法后，B1 可后续替换。

### 3.8 set_visible（A1 stub）

```rust
pub fn set_visible(&self, visibility: bool) {
    if let Some(window_id) = self.window_id {
        let client = match &self.window_client { Some(c) => c.clone(), None => return };
        if visibility {
            // TODO(A1): 替换为 AppControlExt::show_ability(env) 当 A1 完成后
            self.runtime.spawn(async move {
                if let Err(e) = client.restore_window(window_id).await {
                    log::warn!("[tao-ohos] restore_window failed: {:?}", e);
                }
                if let Err(e) = client.show_window(window_id).await {
                    log::warn!("[tao-ohos] show_window failed: {:?}", e);
                }
            });
        } else {
            // TODO(A1): 替换为 AppControlExt::hide_ability(env) 当 A1 完成后
            self.runtime.spawn(async move {
                if let Err(e) = client.minimize_window(window_id).await {
                    log::warn!("[tao-ohos] minimize_window failed: {:?}", e);
                }
            });
        }
    }
}
```

## 4. 约束遵守

### 4.1 cfg 隔离策略

所有改动在 `#[cfg(target_env = "ohos")]` 内：

- `tao/Cargo.toml` 的依赖在 `[target."cfg(target_env = \"ohos\")".dependencies]` 段
- `tao/src/platform_impl/ohos/mod.rs` 整个文件仅在 OHOS 编译时包含
- `BridgeExecutor` 结构仅在 OHOS 编译时定义
- Windows / macOS / Linux / iOS / Android 平台不受影响（铁律 #2）

### 4.2 ExternalError 转换（参考 ohos-constraints.md 1.5）

tao 的 `ExternalError` 仅 `NotSupported(NotSupportedError)` / `Os(OsError)` 两变体，OHOS `OsError` 是 unit struct。

**受影响的返回 `ExternalError` 的方法**：

| 方法 | 旧实现 | 新实现 |
|------|--------|--------|
| `set_cursor_grab` | 返回 `NotSupported` | 不变 |
| `set_cursor_position` | 返回 `NotSupported` | 不变 |
| `drag_window` | 返回 `NotSupported` | 不变 |
| `drag_resize_window` | 返回 `NotSupported` | 不变 |
| `set_ignore_cursor_events` | 调 `set_window_touchable` 失败 → `warn!` + `NotSupported` | **保留 core 调用**，逻辑不变 |

`set_ignore_cursor_events` 是唯一返回 `ExternalError` 且调用 ability 函数的方法。B1 保留其对 `set_window_touchable` core 函数的调用，错误处理不变。

### 4.3 线程模型遵守（参考 ohos-constraints.md 1.2）

| 规则 | B1 遵守方式 |
|------|------------|
| 禁止 `run_on_main_thread + rx.recv()` 阻塞 | fire-and-forget ops 使用 `runtime.spawn()`，不阻塞 |
| 所有跨线程 NAPI 操作用 TSFN NonBlocking | bridge 内部使用 TSFN NonBlocking，tao 层不直接调用 NAPI |
| Mutex 不得跨越阻塞 I/O | tao 层无新增 Mutex |

### 4.4 setColorMode 异步要求（参考 ohos-constraints.md 4.3）

`setColorMode` 同步触发 `onConfigurationUpdate` 回调 → 回调 Rust → 主线程死锁。ArkTS 侧的 `setAppColorMode` 实现必须使用 `setTimeout(() => setColorMode(), 0)` 延迟到下一事件循环。此约束在 ArkTS 实现中遵守，tao 侧无需特殊处理（tao 调用 `set_color_mode` 本身是同步的 MainThreadSync bridge call，ArkTS 侧负责延迟）。

## 5. Window struct 变更摘要

```rust
pub(crate) struct Window {
    app: OpenHarmonyApp,
    window_id: Option<i64>,
    // 新增：bridge facade（None = bridge 不可用时降级）
    window_client: Option<WindowClient>,
    // 新增：异步执行器 handle
    runtime: BridgeExecutor,
    // 新增：状态缓存
    maximized: AtomicBool,
    minimized: AtomicBool,
    // 保留
    theme: AtomicU8,
    decorations: AtomicBool,
    transparent: bool,
}
```

## 6. EventLoop struct 变更摘要

```rust
pub struct EventLoop<T: 'static> {
    pub(crate) openharmony_app: OpenHarmonyApp,
    // 新增：bridge 执行器（创建于 EventLoop::new()，传给 Window）
    bridge_executor: BridgeExecutor,
    window_target: event_loop::EventLoopWindowTarget<T>,
    // ... 其余不变
}
```

`EventLoopWindowTarget` 也需持有 `BridgeExecutor` 的引用。**注意**：这不是为 `set_theme`（`set_theme` 用 MainThreadSync bridge call，需要 `Env`，从 `get_main_thread_env()` 获取，不走 async runtime），而是因为 `Window::new()` 接收 `&EventLoopWindowTarget<T>` 作为参数 — Window 需要从 EventLoopWindowTarget 获取 `BridgeExecutor` clone 用于 async fire-and-forget 调用。
