# OHOS WebView 文件拖拽 Overlay 降级 (ohos-webview-drag-drop-overlay) 计划

**创建时间**：2026-07-20
**功能描述**：当 ArkWeb `Web` 组件不向 ArkUI 冒泡 OS 级文件拖拽事件时，在 `Web` 组件外层 `Stack` 中叠一层透明 `Stack` overlay 接收 ArkUI 通用组件级拖拽事件并转发给 wry `drag_drop_handler`，作为 `ohos-webview-drag-drop` 主路径的降级方案。
**目标设备形态**：OHOS desktop（HarmonyPC / 大屏）；mobile 标注不适用。
**判断依据**：主路径已实现但 ArkWeb 冒泡行为未验证；overlay 方案需新增 ArkTS 节点 + wry 开关 + ability NAPI 字段，涉及 3 个代码层、约 5 个文件 → 单 Phase 可完成。
**目标级别**：完整实现 overlay 降级，使其在主路径失效时仍能端到端交付 DragDropEvent。

## 与主路径 (ohos-webview-drag-drop) 的关系
- **主路径**：`Web` 组件自身挂 `.onDragEnter/.onDragMove/.onDrop/.onDragLeave`，依赖 ArkWeb 冒泡。已实现（`DefaultWebview.ets` WebBuilder + EmbeddedWebBuilder）。
- **本 overlay 降级**：仅当设备探测确认 ArkWeb 不冒泡时启用。启用时 overlay 是唯一事件源，Web 级回调被抑制以避免双发。
- **触发条件**：`WebviewInitData.dragDropOverlay === true`。默认 `false`。
- **共存**：两条路径不会同时产生事件（ArkWeb 平台行为固定：要么冒泡要么不冒泡）。开关由 wry 侧根据设备探测结果设置。

## OHOS API 关键点（已确认 / 待验证）
1. **ArkUI `CommonAttribute` 通用拖拽回调**：`.onDragEnter/.onDragMove/.onDragLeave/.onDrop` 是所有 ArkUI 组件通用的拖拽接口，不依赖 ArkWeb。挂在透明 `Stack` 上即可接收 OS 文件拖拽。**待设备验证**：OHOS 桌面态是否向应用下发 ArkUI 拖拽事件（若连 overlay 也不触发，则整体为平台限制）。
2. **`HitTestMode.Transparent`**：本节点响应触摸/拖拽事件，同时事件向兄弟/下层节点透传。overlay 用此模式可接收 drag 事件，同时让鼠标/触摸/HTML5 DnD 穿透到下层 Web。
3. **`DragEvent` 文件 URI 提取**：`dragEvent.getData()` 返回 primtive 数据；`dragEvent.primitive` / `dragEvent.summary` 可能含文件 URI 列表。预期 `file://`/`datashare://` URI。需去除 scheme 后转绝对路径。**待设备验证**返回格式。
4. **坐标语义**：`DragEvent.getX()/getY()` 返回窗口坐标。需减去 `data.style.x/y`（Web 在 Stack 中的偏移）换算为 Web 内容区坐标，与主路径 Web 级 `.onDrop` 一致。
5. **线程模型**：ArkUI 拖拽回调在 JS 线程；`data.onDragAndDrop` 是 NAPI `Function<String, ()>`，在 JS 线程直接调用即可（与主路径相同，无需额外同步）。
6. **ArkTS 约束**：`@Builder` 内 pre-build 注册事件回调（ohos-constraints §4.1）；overlay 节点必须在 `@Builder` 内静态声明，不能动态挂接。

## Phase 列表

| Phase | 名称 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|--------|---------|---------|
| 1 | overlay 降级端到端实现 | openharmony-ability Rust + ArkTS + wry | 5 | 设备端拖文件入 webview，wry 收到 Drop 事件 |

单 Phase：改动集中、文件数 ≤ 5、无独立可验证底层切片，强行拆分反而割裂 ArkTS 与 wry 的字段透传链。

## Phase 1: Overlay 降级端到端实现

### 目标
1. 在 `openharmony-ability` Rust 侧新增 `WebViewBuilder::drag_drop_overlay(bool)` + `WebViewInitData.drag_drop_overlay: bool` NAPI 字段（受 `feature = "drag_and_drop"` 门控）。
2. 在 `wry` 侧 `PlatformSpecificWebViewAttributes`（OHOS 专属，与 `use_https` 同结构，铁律 #2）暴露 `drag_drop_overlay` 开关 + `WebViewBuilderExtOhos::with_drag_drop_overlay(bool)`，`new_inner` 透传到 ability builder。非 OHOS 平台无此字段。
3. 在 `DefaultWebview.ets` 的 `WebBuilder`/`EmbeddedWebBuilder` 中，当 `data.dragDropOverlay === true` 时：
   - 抑制 Web 级 `.onDragEnter/.onDragMove/.onDrop/.onDragLeave` 挂接（避免双发）
   - 在 `Stack` 中 Web 之后追加透明 `Stack` overlay（`HitTestMode.Transparent`）
   - overlay 挂 `.onDragEnter/.onDragMove/.onDragLeave/.onDrop`，提取 URI + 坐标，构造管道串调 `data.onDragAndDrop`
4. 设备端验证：拖文件入 webview，wry `drag_drop_handler` 收到 `DragDropEvent::{Enter, Over, Drop, Leave}`。

### 文件列表
- `openharmony-ability/crates/ability/src/webview/mod.rs` — `WebViewBuilder` 新增 `drag_drop_overlay` 字段 + 链式方法；`WebViewInitData` 新增 `pub drag_drop_overlay: bool`
- `openharmony-ability/crates/ability/helper/webview.rs` — NAPI object 序列化新增 `dragDropOverlay` camelCase 键
- `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets` — `WebviewInitData` interface 加 `dragDropOverlay?: boolean`；WebBuilder/EmbeddedWebBuilder 条件渲染 overlay + 条件挂接/抑制 Web 级回调
- `wry/src/ohos/mod.rs` — `new_inner` 读取 `attributes.drag_drop_overlay`，调 `webview_builder.drag_drop_overlay(...)`
- `wry/src/lib.rs`（`PlatformSpecificWebViewAttributes` 定义处，与 `use_https` 同结构） — 新增 `pub drag_drop_overlay: bool` 字段 + 默认 `false` + `WebViewBuilderExtOhos::with_drag_drop_overlay` builder 方法（`cfg(target_env = "ohos")` 门控）
- `tauri/examples/api/src-tauri/gen/ohos/...`（可选） — 探测脚本/手动用例

### 依赖
- `ohos-webview-drag-drop` 主路径已实现（drag.rs / wry 闭包 / ETS Web 级挂接就位）

### 验证方式
- **编译**：`cargo build --target aarch64-linux-ohos --features drag_and_drop` 通过；非 ohos 平台 `cargo build` 不受影响（cfg 隔离）。
- **设备端 manual**：
  1. 在 `examples/api` 中开启 `drag_drop_overlay = true`，注册 `drag_drop_handler` 打印事件
  2. 从 OHOS 文件管理器拖文件入 webview
  3. 观察 hilog + Rust 日志：应看到 `enter → over → drop` 序列，`drop` 携带正确文件路径
  4. 拖拽过程中点击 webview 内按钮、滚动、文本选择 → 应正常工作（overlay 透传）
  5. 页内 HTML5 DnD（如拖 DOM 元素）→ 应正常工作，不产生 `DragDropEvent`
- **去重验证**：单次物理 drop 只产生一个 `DragDropEvent::Drop`（overlay 启用时 Web 级回调被抑制）。

### 未知项 / 风险
1. **ArkUI 是否向应用下发 OS 文件拖拽事件**：若连 overlay 也不触发，回退为「平台限制」，更新 spec MODIFIED Requirement，建议应用层用 HTML5 `<input type="file">` 兜底。
2. **`DragEvent` 文件 URI 格式**：`getData()` / `primitive` / `summary` 字段实际返回值需设备确认。若返回 `datashare://` URI 需额外解析（可能需 `fileIo` 或 `dataShareHelper` 转换为绝对路径）。
3. **坐标换算**：`DragEvent.getX()` 语义（窗口坐标 vs 组件坐标）需确认；若已是组件坐标则无需减 `style.x/y`。
4. **overlay 与 Web 同层 Stack 的渲染顺序**：ArkUI `Stack` 后声明者在上层；overlay 必须在 Web 之后声明。`BuilderNode.update` 不重建子节点结构（ohos-constraints §4.1），故 overlay 的渲染条件必须在 build 时确定（`data.dragDropOverlay` 不能运行时切换；若需切换只能重建 webview）。
5. **`hitTestBehavior(HitTestMode.Transparent)` 对拖拽事件的影响**：需验证 Transparent 模式下 overlay 是否仍接收 `.onDragEnter` 等（Transparent 主要影响触摸 hit-test，拖拽事件分发机制可能不同）。若不接收，改用 `HitTestMode.Default` + overlay 仅在拖拽期间 `visibility(Visible)`、平时 `Hidden`，但这需要外部信号触发显隐——若无信号则不可行，需依赖 Transparent 透传。

## 状态
- ○ 待开始

## 实现期发现（2026-08-06 验证时，2026-08-06 核实修正）

> ⚠️ **原"tauri 层 API 断裂"诊断经代码核实为误判，已撤销。** 见下方修正。

**原诊断（已撤销）**：曾认为 tauri `WebviewWindowBuilder` 无 `drag_drop_handler` setter → wry 收不到 handler → `data.onDragAndDrop` 恒 undefined → 需独立 change `ohos-tauri-drag-drop-handler-api` 补 setter。

**核实真相**：`tauri-runtime-wry/src/lib.rs:5268` 在 `drag_drop_handler_enabled`（默认 true）时**自动装入内部 handler**，把 wry `DragDropEvent` 转 tauri 事件转发到前端 `onDragDropEvent`——这是跨平台惯例（Windows/macOS/Linux 同模式），OHOS 也走。因此：

| 层 | 状态 | 说明 |
|----|------|------|
| ArkTS（ability DefaultWebview.ets） | ✅ `.onDragEnter/.onDrop` 已挂 | 调 `data.onDragAndDrop(...)` |
| wry（ohos/mod.rs） | ✅ `on_drag_and_drop` 管道已接 | 闭包调 `DragDropEvent::from_arkts_pipe` 解析管道串 |
| tauri-runtime-wry | ✅ **自动装 handler** | `lib.rs:5268` 内部 handler 转 tauri 事件，`data.onDragAndDrop` **不会**恒 undefined |
| tauri builder | ✅ 无需 setter | 跨平台设计惯例，用户经 tauri 事件系统监听 `DragDropEvent` |

**结论**：Rust 管道端到端通（ArkTS → wry 闭包 → `DragDropEvent` → tauri-runtime-wry → tauri 事件 → 前端 `onDragDropEvent`）。**`ohos-tauri-drag-drop-handler-api` 独立 change 不需要，取消。**

**真实剩余工作**：①ArkTS 路径简化（未剥 scheme、坐标恒 0,0、单文件不 join）②drag.rs 曾是死代码（已重构为真实 `DragDropEvent` + `from_arkts_pipe`/`to_arkts_pipe`）③`drag_drop_overlay` 在 tauri/tauri-runtime 层缺 cfg 隔离（API 卫生）④设备验证未做（ArkWeb 是否冒泡、getData 格式、overlay 是否仍 appfreeze）。

**真机拖拽支持确认**（arkts-helper）：API 23（2in1 桌面）支持文件拖拽到 Web/ArkUI 组件，`onDragEnter/onDragMove/onDrop/onDragLeave` 会触发。R72"真 gap"风险低，问题在 ArkTS 路径正确性 + 设备验证，而非 tauri API。

### tauri API 已补 + overlay 渲染 appfreeze（2026-08-06）

**tauri API 已补**（已 commit）：
- `tauri-runtime/src/webview.rs`：`WebviewAttributes` 加 `drag_drop_overlay: bool` 字段 + builder 方法
- `tauri/src/webview/mod.rs` + `webview_window.rs`：`WebviewBuilder`/`WebviewWindowBuilder` 加 `drag_drop_overlay` 透传
- `tauri-runtime-wry/src/lib.rs`：OHOS 分支加 `with_drag_drop_overlay(webview_attributes.drag_drop_overlay)`
- `examples/api/src-tauri/src/cmd.rs`：`create_ohos_test_webview` 加 `drag_drop_overlay` 参数

**overlay 渲染导致 appfreeze（FAIL）**：`create_ohos_test_webview(dragDropOverlay: true)` 创建测试窗口时，overlay Stack 渲染 + `OnSizeChange` 事件导致主线程阻塞 6 秒 → `THREAD_BLOCK_6S` appfreeze。ArkTS 侧 `DefaultWebview.ets` 的 overlay Stack（line 378+）在 build 时和 Web 组件渲染冲突。
- **已回退**：TestRunner 的 Drag Overlay 按钮已删除（`manualOhosTestDragOverlay` 函数 + 按钮移除），避免触发 appfreeze。tauri API 改动保留（无害，默认 false 不触发 overlay）。
- **待排查**：overlay Stack 渲染死锁根因——可能 `dragDropOverlay` 条件下 Stack 和 Web 组件的 build 顺序/线程问题。需 ArkTS 侧排查（`BuilderNode.update` 不刷新组件属性约束 §4.1，overlay 渲染条件需 build 时确定）。
- **主窗口拖拽**：Web 组件级 `.onDragEnter` 等已挂（主窗口拖文件有 `+` 号图标）。`data.onDragAndDrop` **已由 tauri-runtime-wry 自动装入的 handler 接通**（`lib.rs:5268` 内部 handler → wry `new_inner` `on_drag_and_drop` 管道 → ArkTS `onDragAndDrop`），前端经 `appWindow.onDragDropEvent` 收事件。若主窗口拖文件未触发 `DragDropEvent`，根因待设备验证（ArkWeb 是否冒泡 OS 文件拖拽到 `.onDrop`），非 `onDragAndDrop` 未设。

## 备注
- **铁律遵守**：ArkTS 调用经 `openharmony-ability`；wry 不直接调 ArkTS；所有改动 `cfg(target_env = "ohos")` 或 `feature = "drag_and_drop"` 门控；不影响 Windows/macOS/Linux。
- **版本守卫**：`HitTestMode.Transparent`、ArkUI 通用拖拽回调均为 API 12 基线能力，无需版本守卫。若 `DragEvent.primitive`/`summary` 为高版本 API，需加 `deviceInfo.sdkApiVersion` 守卫并回退 `getData()`。
- **降级链**：ArkWeb 冒泡（主路径）→ ArkUI overlay（本降级）→ HTML5 页内 DnD（最终降级）。三层降级在 spec 中显式标注。
- **mobile 形态**：mobile 形态下 `drag_and_drop` feature 默认关闭（无文件管理器拖拽场景），overlay 不激活；仅 desktop 形态启用 `drag_and_drop` feature 时 overlay 链路才编译/生效。
