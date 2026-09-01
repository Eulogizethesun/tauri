## Context

`window-state` 插件在 OHOS 真机上的持久化存在三处叠加缺陷，导致 `examples/api` demo 重启后
主窗口缩小到 760×570 且贴 (0,0)。已核实的代码事实（行号经审计复核）：

- **事实1（save 侧查询非阻塞）**：tao OHOS `inner_size()`（`tao/src/platform_impl/ohos/mod.rs:1160`）
  和 `outer_position()`（`:1195`）是纯读 `self.app.window_rect()` 缓存，非阻塞、worker 线程安全。
  真正阻塞主线程的只有 `is_maximized`/`is_minimized`（同步 NAPI）。故 save 侧可安全做 size+position
  活刷新。`WebviewWindow::inner_size()` 返回 `Result<PhysicalSize<u32>>`（`webview_window.rs:1756`），
  `outer_position()` 返回 `Result<PhysicalPosition<i32>>`（`:1749`）——均 `Result` 包装。
- **事实2（单字段，当前仅主窗口写入）**：`AppInner.window_rect`（`openharmony-ability/crates/ability/
  src/app.rs:74`）是 AppInner 级**单字段**。`lifecycle.rs:184-197` 的 `window_rect_change` 闭包对
  任意 RectChangeReason（MOVE/RESIZE/DRAG/RECOVER）无条件写它。
  **审计修正**：Float 子窗口**当前没有任何 windowRectChange 回调注册**——`DefaultXComponent.ets:92-97`
  子窗口分支在 `registerComponentRoot` 后 `return`，永不到达 `:139` 的 `attachComponent`，而
  `BridgeHost.ets:631` 的 windowRectChange 注册实际是主窗口 component window 的第二处注册（与
  `NativeAbility.ets:411` 双重注册同一窗口，数据相同无害）。故 `window_rect` 单字段当前**只有主窗口
  在写**，"多窗口 last-writer-wins clobbering"是 per-window 化后的**潜在缺陷而非现行 bug**。但单字段
  语义无法支撑 per-window rect，仍是架构缺陷。
- **事实3（事件路由 ZST）**：tao 事件派发用写死的主窗口 WindowId（`mod.rs:567`/`:587` 用常量
  `WindowId`）。`WindowId` 是 ZST（`:906`，`From<WindowId> for u64 = 0`）→ 所有窗口哈希到同一 key，
  子窗口 resize 事件全部记在主窗口头上。`mod.rs:667-668` 注释明确标注此已知缺陷。
- **事实4（插件现状）**：`plugins-workspace/plugins/window-state/src/lib.rs`
  - L132-156：OHOS save 分支跳过 `update_state()`（基于"inner_size/outer_position 阻塞"的**过时**
    假设——事实1已证伪）。
  - L167-185：OHOS save 分支只在 `flags.contains(POSITION)` 时用 `outer_position()` 刷新位置。size
    不刷新（依赖事件缓存）。
  - L346 `update_state`：OHOS 跳过 `is_maximized`/`is_minimized`（保留，正确）。
  - L543 Moved / L571 Resized：OHOS 特殊处理已存在。
  - L612 RunEvent::Ready：OHOS 启动 restore（`state_flags` = Builder 默认 = all）。
  - L644-651：OHOS 跳过 Exit 自动保存（保持不变）。
  - `WindowState` serde **无** `skip_serializing_if`——序列化整个 struct，SIZE-only save 也会把陈旧
    x/y 写盘。

**审计确认的隔离事实**：`WindowId` 定义在 `#[cfg(target_env="ohos")]` 模块内（`platform_impl/mod.rs:29`），
其他平台独立定义 → ZST→u64 可完整 cfg 隔离。tao OHOS 有 16 处 `window::WindowId(WindowId)` 派发点
（L190/261/286/296/320/344/375/452/567/576/587/600/610/620/677/683）。

约束：三条铁律（oha 唯一 ArkTS 桥接仓、cfg 隔离不影响其他平台、OHOS_DEVICE_TYPE 决定形态）。
所有改动 `cfg(target_env="ohos")` 隔离，Linux 依赖加 `not(target_env="ohos")` 排除。

## Goals / Non-Goals

**Goals:**
- oha：`windowRectChange` 回调携带窗口标识；`AppInner` per-window rect 存储（HashMap）；按 key 查询接口。
- tao：`inner_size()/outer_position()` 按窗口自身 key 读 per-window rect；事件按窗口路由正确 window_id。
- window-state 插件：OHOS save 无条件刷新 size+position（主窗口 gate 见 D7）；maximized/minimized 维持跳过。
- 单窗口与多窗口场景下，重启后窗口尺寸/位置均正确恢复。

**Non-Goals:**
- 不改变 `window-state` 插件的非 OHOS 平台行为。
- 不修复 `is_maximized`/`is_minimized` 同步 NAPI 阻塞（保留跳过；独立缺陷）。
- 不实现 OHOS `Moved` 事件（保持 ContentRectChange→Resized 派发；通过 save 侧活刷新替代）。
- 不改变 wry 的 `set_bounds` 逻辑——wry 不调用 tao 的 `inner_size`/`outer_position`（grep 零匹配），
  `set_bounds` 只读传入参数，本变更对其无影响。
- **WindowPlugin.ets "create-os-window" 路径（第二子窗口路径）**：`WindowPlugin.ets:349-394` 的
  `create-os-window` action 直接 `context.getWindowStage().createSubWindow(name)`，返回 OHOS 分配的
  `getWindowProperties().id`（与 `NEXT_WINDOW_ID` 体系脱节），不走 LocalStorage/FloatPage 链路。
  此路径的 per-window rect 注册不在本变更范围内（Non-Goal / 已知限制）——它不经过 tao 的
  `create_os_window` → `NEXT_WINDOW_ID` 体系，windowId 映射无对应关系。

## Decisions

### D1. 窗口标识 Key = `i64` windowId（主窗口=0，Float 子窗口=NEXT_WINDOW_ID 递增）

**选择**：用 `i64` windowId 作为 per-window rect HashMap 的 key。
- 主窗口：`0`（tao `Window::new` 在 `mod.rs:1029` 硬编码 `Some(0)`）。
- Float 子窗口：`NEXT_WINDOW_ID`（`oha/crates/ability/src/window/mod.rs:16`，起始 1）分配的 id。
  `NEXT_WINDOW_ID` 有 3 个 `fetch_add` 点：L85 `create_os_window`（tao 主路径）、L71 `generate_window_id`
  （死代码）、L224 `next_window_id`（公共 API）。三者共享同一 `AtomicI64`，保证全局唯一。

**理由**：与 tao 现有 `window_id: Option<i64>`（`mod.rs:956`）和 oha 现有 `NEXT_WINDOW_ID` 完全对齐，
零新 id 体系。主窗口 0 是已建立约定（`mod.rs:1026-1029` 注释、wry Path 1/Path 2 分流均依赖）。

**备选**：用 tao `WindowId`（ZST）作 key——否决，ZST 无法区分窗口。用 ArkTS window.Window 实例
句柄——否决，跨 NAPI 边界不稳定且与 Rust window_id 体系脱节。

### D2. windowId 透传路径：ArkTS 包装 options，Rust 闭包读取

**选择**：在 ArkTS 侧将原生 `window.RectChangeOptions`（仅含 `rect`/`reason`，经华为官方确认**不含**
windowId）包装为 `{ windowId: <id>, reason: options.reason, rect: options.rect }`，再传给 Rust NAPI
闭包 `on_window_rect_change`。Rust 侧 `window_rect_change` 闭包（`lifecycle.rs:184`）新增读取
`options.get_named_property::<i64>("windowId")`。

`on_window_rect_change` 是 `WindowStageEventCallback` 上的单 `Function`（`lifecycle.rs:30`），主窗口与
所有子窗口共用同一回调。窗口身份必须在调用时随 options 携带（无法靠注册多个回调实现——lifecycle
struct 是单实例）。包装对象是最小侵入的 ABI 变更。

**备选**：注册 per-window 独立回调（每个窗口一个 `Function` 闭包捕获 windowId）——否决，
`WindowStageEventCallback` 是单实例结构，改造成本大且破坏现有 lifecycle 注入模型。

### D3. 子窗口 windowRectChange 注册点：WindowManager.createSubWindow

**审计修正（原 D3 attachComponent 透传已被证伪）**：Float 子窗口不经过 `attachComponent`
（`DefaultXComponent.ets:92-97` 子窗口分支 `return` 在前）。`BridgeHost.ets:631` 的 windowRectChange
注册是主窗口 component window 的第二处注册（与 `NativeAbility.ets:411` 同一窗口），**不是**子窗口的
注册点。故 attachComponent windowId 透传对子窗口不可达。

**重新设计的注册点**：

| 注册点 | 窗口 | windowId 来源 | window 实例来源 |
|--------|------|-------------|---------------|
| `NativeAbility.ets:411` | 主窗口 | 硬编码 `0` | `windowStage.getMainWindow()` 的 `win` |
| `WindowManager.createSubWindow`（L831 后新增）| Float 子窗口 | `opts.windowId`（参数）| `win`（`createSubWindow` 返回值）|
| `BridgeHost.ets:596-602`（主窗口 component window 第二注册）| 主窗口 | 硬编码 `0` | `componentWindow`（= 主窗口）|

- **主窗口**（`NativeAbility.ets:411-418`）：`win.on("windowRectChange", ...)` 回调内包装
  `windowId: 0`。
- **子窗口**（`WindowManager.ets`，`createSubWindow` 方法 L831-842 区域）：在 `win` 获取后
  （`this.windows.set(windowId, {window: win, storage})` 之后），新增
  `win.on("windowRectChange", (options) => { ... 包装 windowId ... })` 注册。此处同时持有 `win`
  实例和 `windowId` 参数，是唯一的干净注册点。
  - **清理**：`WindowManager.ets:1318` `destroyWindow` / 子窗口销毁路径须
    `win.off("windowRectChange", handler)`。handler 须存入 `windows` map 的 entry 以便 off。
- **BridgeHost.ets:596-602**（主窗口 component window 第二注册）：onRectChange 包装 `windowId: 0`
  （硬编码，因为此路径始终是主窗口）。**不需要** attachComponent 签名变更、不需要 HostComponentState
  新增 windowId 字段——此路径恒为主窗口。

**理由**：`createSubWindow` 是 tao `create_os_window` → TSFN → ArkTS 的唯一子窗口创建点，此处已持有
`win` 和 `windowId`，注册零额外查询。`DefaultXComponent.ets:92-97` 子窗口分支也可经
`WindowManager.getWindow(this.windowId)` 取 win 注册，但 `createSubWindow` 更早、更集中，避免在组件
生命周期回调中做窗口查询。

**回调注入（复审补充——WindowManager 无 lifecycle 引用）**：`WindowManager` 是纯工具单例
（`private context` / `uiAbilityStages` / `windows`），**不持有** `applicationLifecycle` /
`windowStageEventCallback` 引用——createSubWindow 的 handler 无法直接调
`windowStageEventCallback.onWindowRectChange(wrappedOptions)` 把数据传给 Rust 闭包。注入步骤：

1. `WindowManager` 新增 `private rectChangeCallback?: (options: ESObject) => void` 字段 +
   `registerRectChangeCallback(cb)` / `unregisterRectChangeCallback()` 方法（仿既有
   `registerBlurRefreshCallback` / `unregisterBlurRefreshCallback`（L1170-1175）注入模式）。
2. `NativeAbility.ets` `onWindowStageCreate`（L359-361，已有
   `WindowManager.getInstance().registerUIAbilityStage(0, windowStage, ...)` 调用处附近）注入：
   `WindowManager.getInstance().registerRectChangeCallback((wrapped) => this.forEachLifecycle(l => l.windowStageEventCallback.onWindowRectChange(wrapped)))`。
3. `createSubWindow` 的 windowRectChange handler 内包装 `{windowId, reason, rect}` 后调用
   `this.rectChangeCallback?.(wrapped)`。
4. `WindowEntry` 接口（`WindowManager.ets:17-20`，当前仅 `window` + `storage`）扩展
   `rectChangeHandler?: (options: window.RectChangeOptions) => void` 字段，handler 引用存入
   entry，`destroyWindow`（L667）→ `removeWindow`（L1311-1318）路径 `win.off("windowRectChange",
   handler)` 清理。

此注入是纯 ArkTS 内部变更（铁律 1 合规），不涉及 Rust napi ABI。

**备选**：在 `DefaultXComponent.ets:92-97` 子窗口分支注册——可行但需 `WindowManager.getWindow()` 查询，
且 aboutToAppear 时机晚于 createSubWindow（FloatPage 内容加载后），可能遗漏早期 rect 变化。否决。

### D4. oha AppInner per-window rect 存储：HashMap<i64, Rect>

**选择**：
- `OpenHarmonyAppInner.window_rect: Rect`（`app.rs:74`）→ `window_rects: HashMap<i64, Rect>`。
- 新增 `window_rect_for(window_id: i64) -> Rect`（`inner.read()`，未命中返回 `Rect::default()`）。
- 新增 `set_window_rect(window_id: i64, rect: Rect)`（`inner.write()`）。
- `release_render_owner`（`app.rs:223-236`，原设计误称 `clear_surface`）：清 key 0（主窗口 surface
  销毁），`window_rects.remove(&0)` + `rect = Rect::default()`。**注意**：`deactivate_surface`
  （`app.rs:213-221`）**不**重置 `window_rect`——保持此不对称语义不动（只清 `rect`/`raw_window`/
  `surface_active`，不动 `window_rect`）。
- **删除 `window_rect()` 兼容 shim**：4 个生产调用方全在 `tao/mod.rs` 且 D5 全部迁移后，shim 变死代码。
  迁移完成后直接删除 `window_rect()`（或 `#[deprecated]`），只留 `window_rect_for`，消除双数据源。

**理由**：HashMap 是 per-window 存储的自然表示；key = windowId 与 D1 对齐。未注册窗口兜底 (0,0,0,0)
保持现有语义（`mod.rs:1219` 注释："window_rect is set by ArkTS callback, may be (0,0,0,0) initially"）。

**线程安全**：`window_rects` 与现有 `window_rect` 同样位于 `OpenHarmonyAppInner`，经
`inner.write().unwrap()`（`RwLock`）访问，与现有 `window_rect` 写法（`lifecycle.rs:188`）一致。
读路径 `window_rect_for` 经 `inner.read()`。无新锁、无新阻塞模式（铁律：禁止 run_on_main_thread+recv）。

### D5. tao inner_size/outer_position 走 per-key 读取

**选择**：
- `Window` 已持有 `window_id: Option<i64>`（`mod.rs:956`）。主窗口 `Some(0)`，Float `Some(id>0)`。
- `inner_size()`（`:1160`）：`self.app.window_rect()` → `self.app.window_rect_for(self.window_id.unwrap_or(0))`。
- `outer_position()`（`:1195`）：同上。
- `inner_position()`（`:1147`）：同上。
- `outer_size()`（`:1217`）：同上（保留 content_rect 兜底）。

**理由**：tao `Window` 已有 window_id，只需把读路径从共享字段切到 per-key 查询。主窗口 key 0 读
到自身 rect，子窗口 key N 读到自身 rect——预防事实2 的潜在 clobbering（per-window 化后若子窗口有
注册，多窗口互不干扰）。

### D6. tao 事件按窗口路由（修复事实3）

**选择**：
- oha `MainEvent::ContentRectChange`（`event.rs:26`）携带 `window_id: i64`（`ContentRect` struct
  `area/mod.rs:12` 新增 `window_id` 字段）。`window_rect_change` 闭包从 options 读 windowId（D2）后
  填入 MainEvent。
- oha `MainEvent::WindowResize` 同理携带 window_id。**三个构造点**：
  1. `lifecycle.rs:170` `window_resize` 闭包（`onWindowSizeChange`）。
  2. `lifecycle.rs:184` `window_rect_change` 闭包（`onWindowRectChange`）→ 实际发 ContentRectChange。
  3. `crates/ability/src/render/xcomponent.rs:139` XComponent `on_surface_changed`（主窗口，windowId=0）。
- tao `WindowId` 由 ZST 改为 `pub(crate) struct WindowId(i64)`（`:906`），`From<WindowId> for u64`
  返回内值。`Window::id()`（`:1133`）返回 `WindowId(self.window_id.unwrap_or(0))`。
- tao run_loop（`:551`）：`MainEvent::ContentRectChange`/`WindowResize` 用其 window_id 构造
  `window::WindowId(event_window_id)` 而非常量 `WindowId`。其他 MainEvent（SurfaceCreate 等）保持
  `WindowId(0)`（主窗口）。
- tauri-runtime-wry `window_id_map`（`lib.rs:2942`）：window 创建时注入
  `window_id_map.insert(TaoWindowId(ohos_id), tauri_window_id)`，使事件按真实 ohos_id 路由到对应
  WindowWrapper。

**理由**：ZST→u64 是事实3 的根治。`mod.rs:667-668` 注释已标注 ZST 导致"所有窗口哈希到同一 key"是
已知缺陷，本设计正是其修复。`WindowId` 在 `cfg(target_env="ohos")` 模块内（`platform_impl/mod.rs:29`），
其他平台独立定义，可完整 cfg 隔离。

**风险**：这是本变更最高风险点。`WindowId` 改动波及 tao 所有 OHOS 事件派发（`mod.rs` 中 16 处
`window::WindowId(WindowId)` 调用点：L190/261/286/296/320/344/375/452/567/576/587/600/610/620/677/683）
+ runtime-wry `window_id_map` 注入逻辑。详见 Risks 节。

**备选**：保持 ZST，仅靠插件 save 侧活刷新（Phase 1）修复主窗口 bug——可接受为分阶段交付的
Phase 1，但子窗口事件路由缺陷（事实3）留存。本设计将事件路由列为 Phase 3，独立验证。

### D7. window-state 插件 save 无条件刷新 size+position（含分阶段 gate）

**选择**：OHOS `save_window_state` 分支（`lib.rs:167-185`）重构为：对每个 tracked window 调
`inner_size()` + `outer_position()` 刷新 state.width/height/x/y，不再门控于
`flags.contains(POSITION)`。`maximized/minimized` 维持跳过（不调 `update_state` 全量；事实1 证明
size+position 查询非阻塞，但 is_maximized/is_minimized 仍阻塞——保留跳过）。

**分阶段 gate（审计补充）**：
- **Phase 1**（per-window rect 尚未生效）：`window_rect` 仍是共享单字段，无条件刷新会把主窗口 rect
  写进每个子窗口的 state（比现状更糟）。Phase 1 必须临时 gate `window.label() == "main"`（tauri 主窗口
  label 惯例），只刷新主窗口。
- **Phase 2**（per-window rect 生效后）：删除 gate，无条件刷新所有 tracked window。

**理由**：
- 去掉 `flags.contains(POSITION)` 门控：serde 序列化**整个** `WindowState` struct（无
  `skip_serializing_if`），即使 SIZE-only save 也会把陈旧 x/y 写盘 → restore 时 `state_flags=all`
  应用 (0,0)。故 size 和 position 必须**都**在 save 时刷新，无论 flags。
- 用 `inner_size()`/`outer_position()`（per-key 缓存读取，D5 后正确）替代依赖 Moved/Resized 事件
  缓存：修复事实1（竞态落盘旧值）+ 事实2（Moved 不触发）。

**实现**：替换 L167-185 的 OHOS 分支为同时刷新 size+position 的循环。`WebviewWindow::inner_size()`
返回 `Result<PhysicalSize<u32>>`，`outer_position()` 返回 `Result<PhysicalPosition<i32>>`——均用
`if let Ok(...)` 处理。Phase 1 加 `#[cfg(target_env="ohos")] if window.label() != "main" { continue; }`，
Phase 2 删除。

### D8. 分阶段交付（Phase 拆分）

| Phase | 内容 | 涉及层 | ArkTS 改动 | 风险 | 独立验证 |
|-------|------|--------|-----------|------|---------|
| 1 | 插件 save 无条件刷新 size+position（D7，含 main gate）| window-state 插件 | 无 | 低 | 主窗口重启恢复正确 |
| 2 | oha per-window rect 存储 + 子窗口 windowRectChange 注册 + tao per-key 读取（D2-D5）| oha + tao + ArkTS | 有 | 中 | 多窗口 inner_size 互不干扰 |
| 3 | tao 事件按窗口路由（D6）| tao + runtime-wry | 无 | 高 | 子窗口 resize 事件路由正确 |

Phase 1 零 ArkTS、零 HAR 重建，先修复主窗口 bug（760×570 at 0,0）。Phase 2 建立 per-window rect
架构 + 主窗口 windowId 包装 + 子窗口新增 windowRectChange 注册。Phase 3 修复事件路由。每 Phase 独立
cargo check + 真机验证。

## Risks / Trade-offs

- **[高] WindowId ZST→u64 波及面广** → D6 影响 tao 所有 OHOS 事件派发点（16 处）+ runtime-wry
  window_id_map 注入。**缓解**：列为 Phase 3，独立于 Phase 1/2 验证；Phase 1+2 不依赖事件路由
  即可修复主窗口 bug；Phase 3 失败可回滚而不影响 Phase 1/2 收益。改动全部 `cfg(target_env="ohos")`
  隔离，其他平台零影响。
- **[中] 子窗口 windowRectChange 注册时机** → `WindowManager.createSubWindow` 中 `win.on(...)` 注册
  在 `this.windows.set` 之后、`loadContentByName` 之前/之后。若注册在 loadContent 前，早期 rect
  变化（resize 到目标尺寸）可被捕获。**缓解**：注册紧跟 `this.windows.set`（L842 后），先于
  `loadContentByName`（L849）；handler 存入 map entry 供 destroyWindow off。
- **[中] HAR 缓存陷阱** → oha ArkTS 改动后 ohpm/hvigor 可能命中旧 har hash（已知坑：
  ohos-ohpm-ability-har-stale-cache）。**缓解**：构建顺序明确写明删 oh_modules + CompileArkTS
  缓存 + pack.bat（cmd.exe 调用，已知 pack-bat-cmd-mangling 坑）。
- **[低] save_window_state 旧注释过时** → L132-156 注释声称 inner_size/outer_position 阻塞（事实1
  证伪）。**缓解**：Phase 1 更新注释，避免误导后续维护。
- **[低] 未注册窗口兜底 (0,0,0,0)** → 新建窗口 rect 尚无回调时 window_rect_for 返回默认值。
  **缓解**：与现有 `outer_size`（`:1219-1226`）兜底语义一致；不恶化现状。
- **[低] 第二子窗口路径（WindowPlugin create-os-window）无 per-window rect** → 该路径用
  OHOS-assigned id，与 NEXT_WINDOW_ID 脱节。**缓解**：记为 Non-Goal；该路径不经 tao create_os_window，
  无 tao window_id 映射，per-window rect 对其无意义。

## Migration Plan

**构建顺序（Phase 2/3 含 ArkTS 改动后）**：
1. 改 oha Rust 源 → `cargo check`（oha crate）。
2. 改 oha ArkTS（NativeAbility.ets / WindowManager.ets / BridgeHost.ets onRectChange 包装）→
   `ohrs build --arch arm64` + `pack.bat`（**必须 cmd.exe 调用**，Git Bash/PowerShell 会吃字符——
   已知坑 ohos-pack-bat-cmd-mangling）。
3. 删 `examples/api/src-tauri/oh_modules` + 清 CompileArkTS 缓存（ohos-ohpm-ability-har-stale-cache）。
4. 改 tao / window-state 插件 → `cargo tauri ohos build --features prod`。
5. HAP 重建 + 签名 + 卸载旧版 + 安装。

**回滚方案**：
- Phase 1 回滚：revert 插件 `lib.rs` L167-185 改动，恢复 flags 门控的 position-only 刷新 + 删 main gate。
  零跨仓影响。
- Phase 2 回滚：revert oha `window_rects` HashMap 改动（恢复单字段 `window_rect`）+ tao 读路径
  恢复 `self.app.window_rect()` + ArkTS 移除 windowId 包装 + 删子窗口 windowRectChange 注册。HAR 重建。
- Phase 3 回滚：revert tao `WindowId` ZST 改动 + runtime-wry window_id_map 注入。不影响 Phase 1/2。

## Open Questions

- **Q1（已解答，实现期验证）**：`MainEvent::WindowResize`（`onWindowSizeChange`）与
  `MainEvent::ContentRectChange`（`onWindowRectChange`）确实会双触发 Resized——但这是**预存行为**
  （Phase 3 前两路都派发到主窗口），且下游幂等：tao `set_bounds` 同值写入为 no-op，
  window_rect 缓存同值覆写无害。两者触发场景不同（前者系统窗口尺寸变化、后者 MOVE/DRAG/RECOVER
  rect 变化），重复风险低。Phase 3 已一并 per-window 化（三个构造点全部携带 window_id，
  window_rect_change 闭包实际构造 ContentRectChange 而非 WindowResize，其 window_id 经
  ContentRect 携带）。结论：无需去重，维持统一走 Resized（Non-Goal：不实现 Moved）。
- **Q2（已解答，实现期验证）**：`window_id_map` 注入点在 runtime-wry `create_window`
  （lib.rs:5129）的 `context.window_id_map.insert(window.id(), window_id)`——此 hook **平台无关**，
  OHOS 窗口创建路径（L5102-5112 `#[cfg(target_env="ohos")]` 分支 → `window_builder.inner.build()`
  → L5129）自动覆盖，**runtime-wry 生产代码零改动**。时序安全：oha `create_os_window`
  （window/mod.rs:84-86）同步返回 NEXT_WINDOW_ID 预分配 id（TSFN fire-and-forget 发 ArkTS 侧
  创建，不等结果），tao `Window::new` 同步拿到 id → runtime-wry 在 build() 返回后立即 insert →
  早于 run_loop 任何事件派发。即使有早到事件，runtime-wry L4689 `get` 返回 None → 静默丢弃
  不 panic。key 无冲突：主窗口 0 经 `or_insert` 注册（WindowIdStore L268-275 OHOS 分支），
  子窗口 id ≥1（NEXT_WINDOW_ID 起始 1），全局唯一。
