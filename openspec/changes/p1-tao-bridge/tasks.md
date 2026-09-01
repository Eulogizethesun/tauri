## 1. 依赖调整

- [x] 1.1 在 `tao/Cargo.toml` 的 `[target."cfg(target_env = \"ohos\")".dependencies]` 段添加 `openharmony-ability-plugin-window` 依赖
- [x] 1.2 在 `tao/Cargo.toml` 的 `[target."cfg(target_env = \"ohos\")".dependencies]` 段添加 `openharmony-ability-plugin-app-control` 依赖
- [x] 1.3 在 `tao/Cargo.toml` 的 `[target."cfg(target_env = \"ohos\")".dependencies]` 段添加 `tokio` 依赖 (features = ["rt", "sync"])
- [x] 1.4 移除 `tao/src/platform_impl/ohos/mod.rs` 中 `use openharmony_ability::window::{...}` 的散函数导入（保留 `create_os_window` 和 `set_window_touchable` 导入）

## 2. BridgeExecutor 基础设施

- [x] 2.1 在 `tao/src/platform_impl/ohos/mod.rs` 中定义 `BridgeExecutor` struct（持有 `tokio::runtime::Handle`）
- [x] 2.2 实现 `BridgeExecutor::new()` — 创建 current-thread runtime + 后台线程驱动
- [x] 2.3 实现 `BridgeExecutor::spawn()` — spawn fire-and-forget future
- [x] 2.4 在 `EventLoop` struct 中添加 `bridge_executor: BridgeExecutor` 字段
- [x] 2.5 在 `EventLoop::new()` 中初始化 `BridgeExecutor`
- [x] 2.6 在 `EventLoopWindowTarget` 中添加 `bridge_executor` 引用（供 `Window::new()` clone 给 Window struct，非 set_theme 使用 — set_theme 用 MainThreadSync）
- [x] 2.7 在 `Window` struct 中添加 `window_client: Option<WindowClient>` 和 `runtime: BridgeExecutor` 字段
- [x] 2.8 在 `Window::new()` 中通过 `app.window()` 创建 `WindowClient`

## 3. Window 操作迁移（fire-and-forget）

- [x] 3.1 迁移 `set_inner_size` → `WindowClient::resize_window` (action: `resize`)
- [x] 3.2 迁移 `set_outer_position` → `WindowClient::move_window_to` (action: `move-to`)
- [x] 3.3 迁移 `set_minimized` → `minimize_window` / `restore_window` (含 AtomicBool 缓存更新)
- [x] 3.4 迁移 `set_maximized` → `maximize_window` / `recover_window` (含 AtomicBool 缓存更新)
- [x] 3.5 迁移 `set_visible` → `restore_window` + `show_window` / `minimize_window` (A1 stub, 留 TODO 标记)
- [x] 3.6 迁移 `set_focus` → `WindowClient::focus_window` (保留 window_id > 0 guard)
- [x] 3.7 迁移 `set_focusable` → `WindowClient::set_window_focusable` (保留 window_id > 0 guard)
- [x] 3.8 迁移 `set_decorations` → `WindowClient::set_window_decorations`
- [x] 3.9 迁移 `set_background_color` → `WindowClient::set_window_background_color`

## 4. 状态缓存

- [x] 4.1 在 `Window` struct 中添加 `maximized: AtomicBool` 和 `minimized: AtomicBool` 字段
- [x] 4.2 在 `Window::new()` 中初始化为 `false`
- [x] 4.3 修改 `is_maximized()` 读 `maximized.load(Acquire)`
- [x] 4.4 修改 `is_minimized()` 读 `minimized.load(Acquire)`
- [x] 4.5 在 `set_maximized()` 中 `maximized.store(b, Release)` + spawn async call
- [x] 4.6 在 `set_minimized()` 中 `minimized.store(b, Release)` + spawn async call

## 5. App 控制迁移

- [x] 5.1 在 `plugin-app-control/src/lib.rs` 中新增 `SetColorModeRequest` / `SetColorModeResponse` NAPI 类型
- [x] 5.2 在 `plugin-app-control/src/lib.rs` 中新增 `ColorModeExt` trait + `OpenHarmonyApp` impl
- [x] 5.3 在 ArkTS `AppControlPlugin.ets` 中实现 `set-color-mode` action (`setTimeout` 延迟 setColorMode)
- [x] 5.4 迁移 `EventLoop::run_return()` 中 `exit(0)` → `AppControlExt::terminate(env, 0)`
- [x] 5.5 迁移 `EventLoopWindowTarget::set_theme()` 中 `set_color_mode` → `ColorModeExt::set_color_mode(env, mode)`
- [x] 5.6 迁移 `Window::set_theme()` 中 `set_color_mode` → `ColorModeExt::set_color_mode(env, mode)`

## 6. 保留 core 的调用确认

- [x] 6.1 确认 `create_os_window` 保留 `openharmony_ability::window::create_os_window` 调用不变
- [x] 6.2 确认 `set_ignore_cursor_events` 保留 `openharmony_ability::window::set_window_touchable` 调用不变
- [x] 6.3 确认 display/monitor/scale/content_rect/window_rect/native_window/config/run_loop/create_waker/cursor_position 调用不变

## 7. 导入清理

- [x] 7.1 添加 `use openharmony_ability_plugin_window::{WindowExt}` 导入（WindowClient 通过 `el.app.window()` 获取）
- [x] 7.2 添加 `use openharmony_ability_plugin_app_control::{AppControlExt, ColorModeExt}` 导入
- [x] 7.3 移除不再使用的 `use openharmony_ability::window::{focus_window, set_window_background_color, ...}` 散函数导入
- [x] 7.4 保留 `use openharmony_ability::window::{create_os_window, set_window_touchable, WindowCreateParams}` 导入（core 保留项）

## 8. 验证

- [x] 8.1 `cargo check --target aarch64-unknown-linux-ohos` 编译通过
- [x] 8.2 `cargo check` (Windows host) 编译通过 — 确认不影响其他平台
- [ ] 8.3 设备端窗口操作功能验证（resize/move/minimize/maximize/restore/close）
- [ ] 8.4 设备端 set_theme 功能验证（Dark/Light/NoSet 三种模式）
- [ ] 8.5 设备端 exit(0) 功能验证（应用正常退出）
- [ ] 8.6 设备端 is_maximized / is_minimized 缓存一致性验证
