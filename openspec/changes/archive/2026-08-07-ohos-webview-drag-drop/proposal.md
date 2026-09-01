## Why
wry OHOS 未接 `drag_drop_handler`（解构时落入 `..`）；ability `drag.rs` 仅 stub；ETS Web 组件未挂拖拽事件。文件拖入窗口无响应。基础设施（feature flag + NAPI 闘包 + ETS onDragAndDrop 字段）已存在，缺接通。

## What Changes
- **ability drag.rs**：从 stub 扩展为 `DragDropEvent` enum（`Enter{paths,position}`/`Over{position}`/`Drop{paths,position}`/`Leave`，镜像 wry），`from_arkts_pipe(&str)`/`to_arkts_pipe(&self)` 解析管道串 `<type>|<paths_nul>|<x>,<y>`（路径 `\0` 分隔以兼容含逗号路径）+ round-trip 单测
- **wry Cargo.toml**：openharmony-ability dep 启用 `drag_and_drop` feature（经 `target.'cfg(target_env = "ohos")'` 隔离，非 ohos 不编译）
- **wry mod.rs**：`new_inner` 解构 `drag_drop_handler`，包装为 `on_drag_and_drop` 闭包（管道串 → `DragDropEvent::from_arkts_pipe` → 1:1 映射 wry `DragDropEvent` → handler）
- **DefaultWebview.ets**：WebBuilder + EmbeddedWebBuilder 的 Web 组件挂 `.onDragEnter/.onDragMove/.onDrop/.onDragLeave`，经模块级 `buildDragPipe` helper（纯函数，符合 ohos-constraints §4.1）发管道串；`extractDragPaths` 用 UDMF `getData().getRecords()` → `getTypes()/getEntry()` 分派（`FILE_URI`→`FileUri.oriUri` 主路径 + `Image.imageUri` 兜底）→ 剥 `file://`/`datashare://` scheme → `\0` join 多文件
- **onLoadIntercept file:// 拦截**（ArkWeb drop 消费降级，核心）：WebBuilder + EmbeddedWebBuilder 两处 `onLoadIntercept` 加 `file://` 分支——ArkWeb 消费 OS 文件 drop 时会导航到 `file://<拖入文件>` 致白屏，`onLoadIntercept` 在导航前触发，return true 取消导航（阻止白屏）+ `decodeURIComponent`+`stripDragScheme` 取路径 + 转发 `drop|path|0,0`。整面 webview 成释放区、不挡触摸、不依赖时灵时不灵的 onDrop。安全：Tauri OHOS 初始加载走自定义协议（`tauri://`/`https://<proto>.localhost`）或 inline html，从不 `file://`（`wry/src/ohos/mod.rs:198/209`），故拦 `file://` 不影响正常加载
- **tauri/tauri-runtime cfg 卫生**：`drag_drop_overlay` 字段/方法 6 处补 `#[cfg(target_env = "ohos")]`（API 卫生，对齐 spec「非 OHOS 平台无此字段」）

## Impact
- 文件拖入 webview 时 drag_drop_handler 收到 `DragDropEvent`，前端 `onDragDropEvent` 收到文件路径
- 不影响其他平台（所有改动经 `cfg(target_env = "ohos")` 或 `feature = "drag_and_drop"` 门控）
- ArkWeb drop 消费白屏问题解决（onLoadIntercept 拦截）

## tauri 层 handler 接通说明（核实修正）
tauri `WebviewWindowBuilder`/`WebviewBuilder` 无用户态 `drag_drop_handler(F)` setter 是 **跨平台设计惯例，非阻塞**：`tauri-runtime-wry/src/lib.rs:5268` 在 `drag_drop_handler_enabled`（默认 true）时自动装入内部 handler，把 wry `DragDropEvent` 转 tauri 事件转发到前端 `onDragDropEvent`。因此 wry `attributes.drag_drop_handler` 在 OHOS 上为 `Some`，`new_inner`（`wry/src/ohos/mod.rs`）接通 `openharmony_ability::WebViewBuilder::on_drag_and_drop`，ArkTS `data.onDragAndDrop` 不会恒 undefined。**无需** 独立 change `ohos-tauri-drag-drop-handler-api`。

## 设备验证结果（2026-08-07，API 23 desktop）
- ✅ 拖文件入 webview **不再白屏**（onLoadIntercept file:// 拦截 ArkWeb drop 消费导航成功；旧版每次必 `ERR_ACCESS_DENIED` 白屏）
- ✅ Web 级 onDrop 触发拿路径（hilog `drag drop: 1 record(s) received`，UDMF `FILE_URI`→`FileUri.oriUri` 提取链工作）
- ✅ 前端 `onDragDropEvent` 收到并显示路径（端到端打通）
- 关键根因：ArkWeb 对 OS 文件 drop 有**桌面 Tauri 没有的内核行为**——抢先消费 drop 导航到 `file://` 致白屏。`setResult(DRAG_SUCCESSFUL)` 对 Web 组件无效（Web 组件不走 ArkUI 通用拖拽协议）；`HitTestMode.Block` 释放区可行但挡触摸、区外仍白屏。`onLoadIntercept` 拦 `file://` 是最优解。详见 `openspec/ohos-webview-drag-drop-plan.md` Phase 4。

## 风险
- ~~ArkWeb 是否冒泡 OS 文件拖拽到 ArkUI .onDrop~~ 已验证：会冒泡但 ArkWeb 同时内部消费 drop 致白屏（onLoadIntercept 解决）
- ~~`dragEvent.getData()` 文件 URI 格式~~ 已验证：`file://` URI，`FILE_URI`→`FileUri.oriUri` 提取 + `stripDragScheme` 剥 scheme 工作；`datashare://` 本次未触发（文件管理器走 file://），其他来源待验证
- ~~ability `drag_and_drop` feature 对非 ohos 构建的影响~~ 已验证：feature 经 wry `Cargo.toml` 的 `target.'cfg(target_env = "ohos")'` 隔离，非 ohos 不编译，无影响
- 次要待办：双发去重（onDrop + onLoadIntercept 可能都触发 drop）、HTML5 页内 DnD 不受影响确认

## 状态
本 change 已归档（2026-08-07），核心功能端到端打通并经设备验证。逐 task 状态见 `tasks.md`：
- task 1–10：✅ 完成（drag.rs 实体 + wry/ArkTS 接通 + cfg 卫生 + 设备验证核心达成）
- task 11：⏸ Deferred（见下「遗留项」）

最终采用方案：**onLoadIntercept 拦截 file:// 导航**（overlay 释放区因 appfreeze 已回退为非默认路径；onLoadIntercept 为默认且更优——整面 webview 成释放区、不挡触摸）。

## 遗留项 (Deferred)
以下项不阻塞归档，列为后续跟进：
- **task 11 — drag.rs 单测设备执行**：`from_arkts_pipe`/`to_arkts_pipe` round-trip 单测已编写并在宿主编译通过；OHOS 交叉链接器缺失，未在设备经 `ohos-rust-ut` 执行。待设备环境就绪后补跑。
- **双发去重**：onDrop（Web 级，带真实坐标）与 onLoadIntercept file:// 分支（带 `0,0` 坐标）可能对同一次物理 drop 各转发一次 `drop|...`，导致 wry 收到两个 `DragDropEvent::Drop`。需在 ArkTS 侧加去重状态（onLoadIntercept 拦截后抑制同次 onDrop 的 drop 转发，或反之）。
- **HTML5 页内 DnD 不受影响**：页内 DOM 拖拽不应产生 `DragDropEvent`、不被 onLoadIntercept file:// 分支误拦——待设备确认。
- **datashare:// 来源**：本次设备验证仅触发 `file://`（文件管理器）；`datashare://` URI 是否需 `fileIo`/`DataShareHelper` 解析为绝对路径，待其他拖拽来源验证。
