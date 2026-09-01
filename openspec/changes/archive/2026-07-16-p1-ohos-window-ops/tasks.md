## 1. openharmony-ability Rust NAPI 桥接

- [x] 1.1 在 `openharmony-ability/crates/ability/src/window/mod.rs` 新增 `move_window_to(window_id: i64, x: i32, y: i32)`(fire-and-forget,镜像 `focus_window` 模式:helper.get_named_property → func.call)
- [x] 1.2 新增 `resize_window(window_id: i64, width: u32, height: u32)`(fire-and-forget,`win.resize()` API9 公共)
- [x] 1.3 新增 `minimize_window(window_id: i64)`(fire-and-forget,`win.minimize()` API11 公共,未废弃)
- [x] 1.4 新增 `maximize_window(window_id: i64)`(fire-and-forget,`win.maximize(window.MaximizePresentation.EXIT_IMMERSIVE)` API12 公共;**EXIT_IMMERSIVE 获得真正 MAXIMIZE 状态**,默认 ENTER_IMMERSIVE 会变 FULL_SCREEN)和 `restore_window(window_id: i64)`(fire-and-forget,`win.restore()` **API14**,`openharmony_ability::version::sdk_api_version() >= 14` 守卫;restore **仅从 MINIMIZE 恢复**,用于 set_minimized(false)/set_visible(true);**不用于 set_maximized(false)**)
- [x] 1.5 新增 `show_window(window_id: i64)`(fire-and-forget,`win.showWindow()` API9 公共;仅子窗口恢复有效,主窗口恢复需 restore)
- [x] 1.6 新增 `is_window_maximized(window_id: i64) -> napi_ohos::Result<bool>`(同步;ArkTS `isMaximized` → `win.getWindowStatus() === window.WindowStatusType.MAXIMIZE`;NAPI bool 返回参考 `create_os_window` 值返回模式)
- [x] 1.7 新增 `is_window_minimized(window_id: i64) -> napi_ohos::Result<bool>`(同步;ArkTS `isMinimized` → `win.getWindowStatus() === window.WindowStatusType.MINIMIZE`)

## 2. openharmony-ability ArkTS 侧

- [x] 2.1 在 `WindowManager.ets` 新增 standalone `moveWindowTo(windowId, x, y)` → `win.moveWindowTo(x, y)` 和 `resizeWindow(windowId, w, h)` → `win.resize(w, h)`(现有 resize/moveWindowTo 仅 inline 于某个 bundled 方法,无 standalone windowId 版,需新增供 Rust 调用)
- [x] 2.2 新增 `maximizeWindow`→`win.maximize(window.MaximizePresentation.EXIT_IMMERSIVE)`(API12,公共;**EXIT_IMMERSIVE 获得真正 MAXIMIZE 状态**)、`minimizeWindow`→`win.minimize()`(API11)、`restoreWindow`→`win.restore()`(API14)、`showWindowMethod`→`win.showWindow()`(API9)(均公共 API,未废弃;**不用系统接口 setWindowMode**)
- [x] 2.3 新增 `isMaximized(windowId)` → `win.getWindowStatus() === window.WindowStatusType.MAXIMIZE`;新增 `isMinimized(windowId)` → `win.getWindowStatus() === window.WindowStatusType.MINIMIZE`(均同步返回 boolean,API12)
- [x] 2.4 在 `ArkHelper.ets` 将新方法(moveWindowTo/resizeWindow/maximizeWindow/minimizeWindow/restoreWindow/showWindowMethod/isMaximized/isMinimized)挂到 helper 对象
- [x] 2.5 在 `type.ets` 同步接口声明(上述 8 个方法)

## 3. tao OHOS Window 实现

- [x] 3.1 `set_outer_position` → 调 `openharmony_ability::window::move_window_to(window_id, x, y)`(替换 no-op)
- [x] 3.2 `set_inner_size` → 调 `resize_window(window_id, width, height)`(替换 warn no-op)
- [x] 3.3 `set_maximized(true)` → `maximize_window`(EXIT_IMMERSIVE);`set_maximized(false)` → `recover_window`(`win.recover()` API7+ 公共,MAXIMIZE/FULL_SCREEN → FLOATING;对齐 design D4 / spec,restore 仅最小化恢复不取消最大化故不用)(替换 no-op)
- [x] 3.4 `set_minimized(true)` → `minimize_window`;`set_minimized(false)` → `restore_window`(API14 版本守卫;API12 no-op+warn)(替换 no-op)
- [x] 3.5 `is_maximized` → `is_window_maximized(window_id)`(替换恒 false)
- [x] 3.6 `is_minimized` → `is_window_minimized(window_id)`(替换恒 false)
- [x] 3.7 `set_visible(true)` → `restore_window` + `show_window`(API14 版本守卫;API12 showWindow best-effort+warn);`set_visible(false)` → `minimize_window`(hide 变通)(替换 no-op)
- [x] 3.8 更新 `use openharmony_ability::window::{...}` import 引入新 fn
- [x] 3.9 对 window_id=None(主窗口 id=0)的情况按既有约定处理(focus_window 已有 main window 约定)

## 4. examples/api 集成 + 测试

- [x] 4.1 在 `examples/api/src-tauri/Cargo.toml` 启用 `tauri-plugin-window-state`
- [x] 4.2 在 `examples/api/src-tauri/src/lib.rs` 注册 window-state 插件
- [x] 4.3 在 `examples/api/src/lib/tests/` 增加 window-state 测试用例:
  - auto: `is_maximized()`/`is_minimized()` 返回布尔(非恒 false)
  - side-effect: `set_position`/`set_size`/`set_maximized(true)` 后 `is_maximized` 反映新状态(允许 eventual consistency,重试/短延时)
  - side-effect: window-state `save_window_state` + `restore_state` 往返
  - manual: 跨重启恢复 position/size/maximized(手动验证);set_maximized(false) 全版本 no-op(无公共 unmaximize API)、set_minimized(false) API12 no-op(API14 restore)的降级行为验证

## 5. 验证

- [x] 5.1 `cargo check` openharmony-ability + tao(OHOS target)编译通过
- [x] 5.2 ohos-build 构建部署 examples/api 到 desktop 设备(MateBook Pro HAD-W32,2026-07-14)
- [x] 5.3 设备端:set_maximized(true)/set_minimized(true)/is_maximized/is_minimized/set_position/set_size 生效;hide 变通(minimize)有效;set_maximized(false) → recover_window 取消最大化(API7+ 公共,对齐 design D4)、set_minimized(false) API12 no-op(API14 restore 生效)。验证见 `doc/manual_tests.md`「Window Operations」+ examples/api core.ts side-effect 用例
- [x] 5.4 确认非 OHOS 平台不受影响(cargo check Windows/Linux 路径无 OHOS 代码编译)
