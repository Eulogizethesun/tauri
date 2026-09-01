# OHOS Window Ops 适配计划

**创建时间**: 2026-07-10
**功能描述**: tao OHOS Window 窗口操作补全 —— 实现 7 个 no-op/stub 方法(set_inner_size / set_outer_position / set_maximized / set_minimized / is_maximized / is_minimized / set_visible),经 openharmony-ability NAPI 桥调 `@kit.ArkUI/window`(moveWindowTo / resize / minimize / maximize / restore / getWindowProperties / showWindow);窗口隐藏无直接 API 用变通(minimize/offscreen)。从而支撑 window-state 插件(持久化/恢复窗口 position/size/maximized/minimized/visible/decorated)及其它依赖窗口操作的插件。
**判断依据**: 涉及 3 个代码层(openharmony-ability 底层 + tao 上层 + examples 测试),预估 ~7 文件;用户选择单 Phase 不拆分。

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | OHOS Window 窗口操作补全 | p1_ohos-window-ops | ✓ 设计完成 | openharmony-ability + tao + examples/api | 7 | 设备端:window-state restore position/size/maximized 生效;is_maximized/is_minimized 返回真实值;hide 变通有效 |

## Phase 详细说明

### Phase 1: OHOS Window 窗口操作补全

- **目标**:
  1. openharmony-ability 新增 Rust NAPI 桥接函数 + ArkTS 方法,覆盖 `@kit.ArkUI/window` 的 move/resize/minimize/maximize/restore/getWindowProperties/showWindow(hide 用变通)。
  2. tao OHOS Window 实现 7 个 no-op/stub 方法,调用上述桥接。
  3. 启用 window-state 插件 + examples/api 测试用例(restore position/size/maximized/decorated;is_maximized/is_minimized 真实值;visible/hide 变通)。
- **文件列表**:
  - `openharmony-ability/crates/ability/src/window/mod.rs` — 新增 NAPI fn:`move_window_to` / `resize_window` / `minimize_window` / `maximize_window` / `restore_window` / `is_window_maximized` / `is_window_minimized`(返回 bool)/ `show_window` / `hide_window`(变通)
  - `openharmony-ability/native_ability/src/main/ets/window/WindowManager.ets` — 补 `maximizeWindow` / `restoreWindow` / `getWindowProperties`(或 `isMaximized`/`isMinimized`)/ `showWindow` / `hideWindow` 方法(minimize/resize/moveWindowTo 已有)
  - `openharmony-ability/native_ability/src/main/ets/ability/ArkHelper.ets` — 注册新方法到 helper 对象
  - `openharmony-ability/native_ability/src/main/ets/ability/type.ets` — 接口同步
  - `tao/src/platform_impl/ohos/mod.rs` — 实现 `set_inner_size` / `set_outer_position` / `set_maximized` / `set_minimized` / `is_maximized` / `is_minimized` / `set_visible`
  - `examples/api/src-tauri/Cargo.toml` — 启用 `tauri-plugin-window-state`
  - `examples/api/src/lib/tests/` — window-state 测试用例(auto/side-effect/manual)
- **API 映射**(Tauri/tao → openharmony-ability → @kit.ArkUI/window):
  - `set_outer_position` → `move_window_to(id,x,y)` → `win.moveWindowTo(x,y)`
  - `set_inner_size` → `resize_window(id,w,h)` → `win.resize(w,h)`
  - `set_maximized(true/false)` → `maximize_window`/`restore_window` → `win.maximize()`/`win.restore()`
  - `set_minimized(true)` → `minimize_window` → `win.minimize()`(false 无对应 → no-op 或 restore)
  - `is_maximized`/`is_minimized` → `is_window_maximized`/`is_window_minimized` → `win.getWindowProperties().windowStatus`(MAXIMIZED/MINIMIZED,返回 bool)
  - `set_visible(true)` → `show_window` → `win.showWindow()`;`set_visible(false)` → `hide_window` 变通(minimize 或 moveWindowTo offscreen,无直接 hide API)
- **边界/降级**:
  - hide 无直接 API → 变通(minimize 优先;或 moveWindowTo(-10000,-10000) offscreen);doc 标注。
  - moveWindowTo/resize 在分屏/全屏下系统可能限制 → 调用前/后查 getWindowProperties,失败 log::warn 不阻塞。
  - 子窗口 minimize/maximize 可能受限 → 仅主窗口保证。
  - cfg(target_env = "ohos") 隔离,不影响其它平台;Linux 依赖加 not(ohos) 排除(若有)。
- **依赖**: 无
