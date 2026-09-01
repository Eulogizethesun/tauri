# Implementation Tasks — p1-window-state-per-window-rect

按 design.md 的三阶段交付。Phase 1 零 ArkTS（含 main gate），先修复主窗口 bug；Phase 2 建立
per-window rect 架构 + 子窗口 windowRectChange 注册 + tao per-key 读取；Phase 3 修复事件路由。
每 Phase 独立验证。

## 1. Phase 1: window-state 插件 save 无条件刷新（零 ArkTS，含 main gate）

- [x] 1.1 更新 `plugins-workspace/plugins/window-state/src/lib.rs` L132-156 注释：移除"inner_size/
  outer_position 阻塞"的过时声明（事实1 证伪），改为说明 size+position 是非阻塞缓存读取。
- [x] 1.2 重构 `lib.rs` L167-185 OHOS save 分支：去掉 `if !flags.contains(StateFlags::POSITION)
  { continue; }` 门控，对每个 tracked window 同时调用 `inner_size()`（刷新 width/height）和
  `outer_position()`（刷新 x/y）。`WebviewWindow::inner_size()` 返回 `Result<PhysicalSize<u32>>`
  （webview_window.rs:1756），`outer_position()` 返回 `Result<PhysicalPosition<i32>>`（:1749）——
  均用 `if let Ok(...)` 处理。
- [x] 1.3 **Phase 1 临时 gate**（per-window rect 尚未生效前必须）：在 OHOS save 分支循环内加
  `if window.label() != "main" { continue; }`，只刷新主窗口。注释说明 Phase 2 per-window rect
  生效后删除此 gate。
- [x] 1.4 保留 `is_maximized`/`is_minimized` 跳过（不调 `update_state` 全量）；maximized/minimized
  字段维持事件驱动缓存值。
- [x] 1.5 cargo check（plugins-workspace，OHOS target）+ Windows 原生 cargo check 双平台 0 error。
- [x] 1.6 真机验证：demo 主窗口 resize + drag → Save → 重启 → 恢复正确尺寸和位置（非 760×570 at 0,0）。
  （验证通过：重启恢复 2090×1394@(515,281)，正确。）
- [x] 1.7 真机方式二套件回归（283 例基线 281✅/1❌/1⏭️），确认无回归。

## 2. Phase 2: oha per-window rect 存储 + 子窗口 windowRectChange 注册 + tao per-key 读取

- [x] 2.1 `openharmony-ability/crates/ability/src/app.rs`：`OpenHarmonyAppInner.window_rect: Rect`
  → `window_rects: HashMap<i64, Rect>`。
- [x] 2.2 `app.rs` 新增 `window_rect_for(window_id: i64) -> Rect`（`inner.read()`，未命中返回
  `Rect::default()`）和 `set_window_rect(window_id: i64, rect: Rect)`（`inner.write()`）。
- [x] 2.3 `app.rs` `release_render_owner`（L223-236，**非** `clear_surface`/`deactivate_surface`）：
  清 key 0（`window_rects.remove(&0)` + `rect = Rect::default()`）。**注意**：`deactivate_surface`
  （L213-221）不重置 window_rect——保持此不对称语义不动。
- [x] 2.4 **删除 `window_rect()` 兼容 shim**：4 个生产调用方全在 tao/mod.rs，D5（task 2.11）全部迁移
  后 shim 变死代码。迁移完成后删除 `window_rect()`，只留 `window_rect_for`，消除双数据源。
- [x] 2.5 `openharmony-ability/crates/ability/src/lifecycle.rs` L184-197 `window_rect_change` 闭包：
  从 options 读 `windowId`（`options.get_named_property::<i64>("windowId")`），调
  `set_window_rect(window_id, rect)`。
- [x] 2.6 `openharmony-ability/crates/ability/src/event.rs` + `area/mod.rs`：`ContentRect` struct
  新增 `window_id: i64` 字段；`MainEvent::ContentRectChange` 携带之。（为 Phase 3 路由做准备，
  Phase 2 暂不消费。）
- [x] 2.7 **ArkTS 主窗口**：`NativeAbility.ets` L411-418 `win.on("windowRectChange", ...)` 回调内将
  options 包装为 `{ windowId: 0, reason: options.reason, rect: options.rect }` 传给
  `onWindowRectChange`。同步包装 `onWindowSizeChange`（L406-409）附 windowId 0。
- [x] 2.8 **ArkTS 子窗口注册**：`WindowManager.ets` `createSubWindow` 方法（L810+），在
  `this.windows.set(windowId, {window: win, storage})`（L842）之后，新增
  `win.on("windowRectChange", handler)` 注册，handler 包装 `windowId`。handler 引用存入
  `windows` map entry——**`WindowEntry` 接口（L17-20）需扩展 `rectChangeHandler?` 字段**——供
  destroyWindow 路径 `off()`。
  **回调注入前置（复审补充）**：WindowManager 不持有 lifecycle 引用，须先加
  `rectChangeCallback?: (options: ESObject) => void` 字段 + `registerRectChangeCallback` /
  `unregisterRectChangeCallback` 方法（仿 registerBlurRefreshCallback L1170-1175 模式）；
  `NativeAbility.ets` onWindowStageCreate（L359-361 附近）注入
  `(wrapped) => this.forEachLifecycle(l => l.windowStageEventCallback.onWindowRectChange(wrapped))`；
  createSubWindow handler 包装后调 `this.rectChangeCallback?.(wrapped)`（详见 design.md D3 注入小节）。
  同步在 `onWindowSizeChange` 注册时附 windowId。
- [x] 2.9 **ArkTS 子窗口清理**：`WindowManager.ets` destroyWindow / 子窗口销毁路径（L1318 附近）
  加 `win.off("windowRectChange", handler)`。
- [x] 2.10 **ArkTS BridgeHost 主窗口第二注册**：`BridgeHost.ets` L596-602 `onRectChange` 包装
  `windowId: 0`（硬编码——此路径恒为主窗口，不需 attachComponent 签名变更/HostComponentState
  新增字段）。同步 `onSizeChange`。
- [x] 2.11 oha cargo check（oha crate，OHOS target）。主 agent 复跑验证：host + OHOS target 均 Finished（0.16-0.9s 增量命中，全量由 apply 首跑）。
- [x] 2.12 **UT 修改**：`app.rs:1025-1039` `releasing_a_component_clears_its_window_scoped_cache`
  直接访问 `inner.window_rect` 字段，改 HashMap 后必须改写：`inner.window_rects.insert(0, Rect{...})`
  + 断言 `release_render_owner` 后 `window_rects.get(&0)` 为 None / Rect::default()。
- [x] 2.13 HAR 重建：`ohrs build --arch arm64` + `pack.bat`（**cmd.exe 调用**，非 Git Bash/PowerShell
  ——ohos-pack-bat-cmd-mangling 坑）。删 `examples/api/src-tauri/oh_modules` + 清 CompileArkTS 缓存
  （ohos-ohpm-ability-har-stale-cache 坑）。
- [x] 2.14 tao `mod.rs`：`inner_size()`（L1160）、`outer_position()`（L1195）、`inner_position()`
  （L1147）、`outer_size()`（L1217）改读 `self.app.window_rect_for(self.window_id.unwrap_or(0))`。
  迁移完成后删除 `window_rect()` shim（task 2.4）。
- [x] 2.15 **删除 Phase 1 main gate**：`lib.rs` Phase 1 的 `if window.label() != "main" { continue; }`
  删除，改为无条件刷新所有 tracked window。
- [x] 2.16 tao cargo check（OHOS target）+ Windows cargo check 双平台 0 error。主 agent 复跑验证：tao/插件 host+OHOS 四组合均 Finished，warning 均预存（tao 6 / 插件 2）。
- [x] 2.17 真机验证：多窗口场景下，拖动子窗口不影响主窗口 `inner_size()` 读值（用 demo test-
  前缀窗口）；save 后状态文件逐窗口核对（main 与 test 窗口的 width/height/x/y 各自正确）。

## 3. Phase 3: tao 事件按窗口路由（修复事实3，高风险）

- [x] 3.1 `tao/src/platform_impl/ohos/mod.rs` L906：`WindowId` ZST → `pub(crate) struct WindowId(i64)`；
  更新 `From<WindowId> for u64`（L914）返回内值；`From<u64>`（L920）保留。WindowId 在
  `#[cfg(target_env="ohos")]` 模块内（platform_impl/mod.rs:29），其他平台独立定义，完整 cfg 隔离。
- [x] 3.2 `mod.rs` `Window::id()`（L1133）返回 `WindowId(self.window_id.unwrap_or(0))`。
- [x] 3.3 `mod.rs` run_loop（L551）：`MainEvent::ContentRectChange`（L582）用
  `content_rect.window_id` 构造 `window::WindowId(event_window_id)`；`MainEvent::WindowResize`
  （L564）同理。其他 MainEvent（SurfaceCreate/GainedFocus 等）保持 `WindowId(0)`。
- [x] 3.4 `mod.rs` 全部 16 处 `window::WindowId(WindowId)` 常量调用点
  （L190/261/286/296/320/344/375/452/567/576/587/600/610/620/677/683）：区分"主窗口事件"（保持
  `WindowId(0)`）与"按 window_id 路由的事件"（用 event 携带的 id）。grep 复核每处。
  **审计逐处复核通过**（2026-08-25）：仅 WindowResize + ContentRectChange 按事件 id 路由；
  输入/IME/滚轮保持 0（子窗口输入由 ArkWeb 内部消费，不经 tao handle_input_event——
  wry/src/ohos grep XComponent/onTouch 零匹配佐证）；WindowDestroy 保持 0（Float 子窗口
  close 走 runtime-wry drain_pending_window_closes 旁路，真实存在已核实）。
- [x] 3.5 **oha 三个 WindowResize 构造点**：`lifecycle.rs:170` window_resize 闭包、`lifecycle.rs:184`
  window_rect_change 闭包、`crates/ability/src/render/xcomponent.rs:139` on_surface_changed（主窗口，
  windowId=0）——均须携带/填充 window_id 进 MainEvent。（实现期确认：window_rect_change 闭包
  构造的是 ContentRectChange 而非 WindowResize，其 window_id 经 ContentRect 携带。）
- [x] 3.6 `tauri-runtime-wry/src/lib.rs`：window 创建路径注入 `window_id_map.insert(
  TaoWindowId(ohos_window_id), tauri_window_id)`。复核 `WindowIdStore` insert 调用点（L2942 附近）
  确认 OHOS 路径覆盖。（实现期确认：L5129 create_window 的 insert 本就平台无关，OHOS 路径
  自动覆盖，runtime-wry 生产代码零改动；审计复核 L5102-5112 OHOS 分支确实到达 L5129。）
- [x] 3.7 runtime-wry `WindowEventWrapper::parse`（L630/L680）：确认 Resized 事件按 window_id 路由
  到正确 WindowWrapper 后，`window.inner` / `window.webviews` 取的是对应窗口的。
- [x] 3.8 验证 wry `set_bounds` 不受影响：wry 不调用 tao 的 inner_size/outer_position（grep 零匹配），
  set_bounds 只读传入参数。
- [x] 3.9 tao + runtime-wry cargo check 双平台 0 error。（审计复跑 8 组合全绿；审计后主 agent
  更新 runtime-wry 两处过时 ZST 注释，注释级改动。）
- [x] 3.10 真机验证：demo test- 前缀子窗口 resize 后，事件路由到子窗口（非主窗口）；子窗口 resize
  后 save 的状态文件中 test 窗口尺寸正确（非 0×0 或撞主窗口尺寸）。
  （2026-08-25 验证通过：状态文件 main 2091×1394@(201,335)，全部 test 子窗口各自 1520×1140，
  零串值；重启后 main rect 逐字节一致；hilog 佐证重启后窗口 id 0-10 各自独立注册。）
- [x] 3.11 真机方式二套件全量回归（283 例），确认事件路由改动无回归。
  （2026-08-25 验证通过：281✅/1❌(clipboard 平台限制)/1⏭️(haptics 无振动器)，与基线零差异；
  窗口操作用例 #273-#283 全绿；无 panic；唯一 appfreeze 为测试间瞬态主线程阻塞（ArkUI 层
  OnSizeChange，既有缺陷性质，未复发），非 Phase 3 回归。）

## 4. 审计与文档同步

- [x] 4.1 对照 design.md D2-D7 逐项复核实现，确认 cfg 隔离正确（铁律2）、无其他平台影响。
  （分阶段完成：Phase 1 审计复核 D7+插件注释；Phase 2 审计复核 D2-D5 含 D3 注入小节；
  Phase 3 审计复核 D6 全部 16 派发点 + runtime-wry 零改动论断。三阶段均确认
  `cfg(target_env="ohos")` 隔离完整、Windows/macOS/Linux 零影响、cargo check 8 组合全绿。）
- [x] 4.2 确认 oha 是唯一 ArkTS 桥接仓（铁律1）：tao/tauri/wry 不直接调 ArkTS API。
  （Phase 2/3 审计确认：全部 ArkTS 改动在 oha 的 NativeAbility.ets/WindowManager.ets/
  BridgeHost.ets；tao/wry/tauri/runtime-wry 均无直接 ArkTS/NAPI-ohos 调用。）
- [x] 4.3 同步设计文档：实现期若发现 Q1（WindowResize 时序，含 xcomponent.rs:139 第三构造点）/
  Q2（window_id_map 注入时机）的答案，回填 design.md Open Questions。
  （2026-08-25 已回填：Q1 双触发为预存行为且下游幂等、无需去重；Q2 注入点平台无关零改动 +
  create_os_window 同步返回预分配 id 的时序证据 + or_insert 无 key 冲突。）
- [x] 4.4 最终 `openspec status --change "p1-window-state-per-window-rect"` 确认所有 artifact done。
  （2026-08-25 终检：4/4 artifacts complete——proposal/design/specs/tasks 全部 done，tasks.md
  全项勾完。）
