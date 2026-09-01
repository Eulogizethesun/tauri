## Why

tao 的 OHOS Window 后端有 7 个窗口操作方法是 no-op/stub(`set_inner_size`、`set_outer_position`、`set_maximized`、`set_minimized`、`is_maximized`、`is_minimized`、`set_visible`),导致 `tauri-plugin-window-state`(持久化/恢复窗口 position/size/maximized/minimized/visible/decorated)及其它依赖窗口操作的插件在 OHOS desktop 上恢复功能全部静默失效(只有 `set_decorations` 已实现)。`@kit.ArkUI/window` 在 desktop 2in1 提供 moveWindowTo/resize(API9)、maximize(API12)、minimize(API11)、`getWindowStatus()`/`WindowStatusType`(API12,含 MAXIMIZE/MINIMIZE)、showWindow(API9);**`restore()` 是 API14**(项目 API12 不可用);**`setWindowMode`/`WindowMode` 是系统接口**(第三方不可用,且无 MAXIMIZE/MINIMIZE 成员)→ 缺口在 tao 层未接线 + restore 需版本守卫。

## What Changes

- 在 `openharmony-ability` 新增 Rust NAPI 桥接函数 + ArkTS 方法,用公共 API:`move_window_to` / `resize_window`(moveWindowTo/resize, API9)、`maximize_window`(maximize, API12)、`minimize_window`(minimize, API11)、`restore_window`(restore, **API14 版本守卫**)、`show_window`(showWindow, API9)、`is_window_maximized` / `is_window_minimized`(返回 bool,读 `getWindowStatus()`)。**不用** 系统接口 `setWindowMode`/`WindowMode`(错误 202 + 无 MAXIMIZE/MINIMIZE 枚举);`maximize()`/`minimize()` 是公共未废弃 API(使用)。
- 在 `tao` OHOS Window 实现 7 个 no-op/stub 方法:`set_inner_size`→resize、`set_outer_position`→moveWindowTo、`set_maximized(true)`→maximize(EXIT_IMMERSIVE) / `set_maximized(false)`→**recover_window()**(API7+ 公共,MAXIMIZE→FLOATING)、`set_minimized(true)`→minimize / `set_minimized(false)`→restore(API14 守卫)、`is_maximized`/`is_minimized`→getWindowStatus()===MAXIMIZE/MINIMIZE、`set_visible(true)`→restore+showWindow(API14 守卫) / `set_visible(false)`→minimize(hide 变通)。
- 启用 `tauri-plugin-window-state` + 在 `examples/api` 增加测试用例(restore position/size/maximized/decorated;is_maximized/is_minimized 真实值;visible/hide 变通;API12 降级)。
- **已知限制(显式标注)**:(1) `set_minimized(false)`/`set_visible(true)` 在 API12 无 restore(API14,版本守卫降级 no-op+warn),API14+ 用 restore() 正常(restore 仅最小化恢复);(2) `restore()` 需 UIAbility onForeground + 窗口最小化状态。is_maximized/is_minimized 查询 + maximize/minimize/set_position/set_size/unmaximize(recover API7+) 在 API12 可用。maximize 用 `MaximizePresentation.EXIT_IMMERSIVE` 确保真正 MAXIMIZE 状态(默认 ENTER_IMMERSIVE 变 FULL_SCREEN)。unmaximize 用 `recover()`(API7+ 公共,MAXIMIZE→FLOATING)。
- 所有新增 OHOS 代码 `cfg(target_env = "ohos")` 隔离,不影响 Windows/macOS/Linux;openharmony-ability 为唯一 ArkTS 桥接仓。

## Capabilities

### New Capabilities
- `ohos-window-ops`: OHOS desktop 窗口操作能力 —— 移动(moveWindowTo)、缩放(resize)、最大化/最小化(maximize/minimize 公共 API)、还原(restore API14 版本守卫)、可见性(showWindow + minimize hide 变通)、状态查询(is_maximized/is_minimized via `getWindowStatus()`),作为 tao OHOS Window 与 `@kit.ArkUI/window` 之间的桥接契约。

### Modified Capabilities
<!-- 无既有 spec 的需求变更;window-state 插件本身平台无关无需改,仅启用+测试。 -->

## Impact

- **openharmony-ability**:`crates/ability/src/window/mod.rs`(新增 ~8 NAPI fn,复用 focus_window 模式;restore_window 含 API14 版本守卫)、`native_ability/.../window/WindowManager.ets`(补 standalone moveWindowTo/resizeWindow + maximizeWindow/minimizeWindow/restoreWindow/showWindowMethod + isMaximized/isMinimized;仅 minimizeWindow 已有 standalone)、`ability/ArkHelper.ets` + `ability/type.ets`(注册/接口)。
- **tao**:`src/platform_impl/ohos/mod.rs`(实现 7 个 Window 方法,替换 no-op/stub)。
- **examples/api**:`src-tauri/Cargo.toml`(启用 tauri-plugin-window-state)、`src/lib/tests/`(window-state 测试用例)。
- **API 版本**:`maximize()`=API12(公共,未废弃;用 `MaximizePresentation.EXIT_IMMERSIVE` 参数获得真正 MAXIMIZE)、`minimize()`=API11(公共,未废弃)、`restore()`=API14(**仅从 MINIMIZE 恢复,不取消最大化**;版本守卫 `sdk_api_version()>=14`,用于 set_minimized(false)/set_visible(true);set_maximized(false) 无公共 API 所有版本 no-op)、`showWindow()`=API9(公共,主窗口最小化恢复有限)、`getWindowStatus()`/`WindowStatusType`(MAXIMIZE/MINIMIZE)=API12、moveWindowTo/resize=API9。**不用** `setWindowMode`/`WindowMode`(系统接口,错误 202)。无需提升 SDK。
- **依赖**:无新增 crate 依赖(复用既有 openharmony-ability NAPI + tao)。
