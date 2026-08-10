# ohos-webview-drag-drop-overlay Specification

> ⚠️ **验证状态：tauri API 已补，但 overlay 渲染导致 appfreeze（FAIL）。** tauri `drag_drop_overlay` API 已补全（tauri-runtime 字段 + tauri builder + tauri-runtime-wry OHOS 分支传递）。但 `create_ohos_test_webview(dragDropOverlay: true)` 创建窗口时 overlay Stack 渲染 + OnSizeChange 导致主线程阻塞 6s → appfreeze。Drag Overlay 按钮已回退删除。tauri API 改动保留（默认 false 无害）。overlay Stack 渲染死锁根因待排查（ArkTS 侧 build 顺序/线程问题）。

## Purpose
当 OHOS ArkWeb `Web` 组件在内部消费 OS 级文件拖拽事件、不向 ArkUI 冒泡 `.onDragEnter/.onDragMove/.onDrop/.onDragLeave` 时，主路径（`ohos-webview-drag-drop` spec）的 Web 级事件挂接不会触发。本规范定义 overlay 降级方案：在 `Web` 组件外层 `Stack` 中叠一层透明 `Stack` overlay，由 overlay 接收 ArkUI 通用组件级拖拽事件并转发为管道串给 `data.onDragAndDrop`，使 wry `drag_drop_handler` 仍能收到 `DragDropEvent::{Enter, Over, Drop, Leave}`。overlay 通过 `HitTestMode.Transparent` 透传鼠标/触摸给下层 Web，不影响页面正常交互与 HTML5 页内 DnD。

## Relationship to ohos-webview-drag-drop (主路径)
- **主路径**（`ohos-webview-drag-drop` spec）：在 `Web` 组件自身挂 `.onDragEnter/.onDragMove/.onDrop/.onDragLeave`，依赖 ArkWeb 把外部文件拖拽冒泡到 ArkUI。已实现。
- **本 overlay 降级**：仅当设备探测确认 ArkWeb 不冒泡 OS 文件拖拽时启用。启用时 overlay 是事件源，Web 级挂接保留但不会重复触发（因为 ArkWeb 不冒泡），从而避免双发。
- **共存策略**：overlay 通过 `WebviewInitData.dragDropOverlay: boolean`（由 wry 侧决定）显式开启。默认 `false`，主路径生效；探测失败后 wry 设为 `true`，overlay 生效。两者不会同时产生事件（ArkWeb 要么冒泡要么不冒泡，平台行为固定）。

## ADDED Requirements

### Requirement: ArkTS SHALL render a transparent drag overlay above the Web component
`DefaultWebview.ets` 的 `WebBuilder` 与 `EmbeddedWebBuilder` SHALL 在外层 `Stack` 中、`Web` 组件之后追加一个透明 `Stack` overlay 子节点（叠在 Web 之上），仅当 `data.dragDropOverlay === true` 时渲染。overlay SHALL 覆盖整个 Web 区域（`width("100%").height("100%")`）、`backgroundColor(Color.Transparent)`、`hitTestBehavior(HitTestMode.Transparent)`，使其自身能接收 ArkUI 拖拽事件同时把鼠标/触摸事件透传给下层 `Web`。

#### Scenario: overlay rendered when dragDropOverlay flag is true
- **WHEN** `WebviewInitData.dragDropOverlay === true` 且 `data.onDragAndDrop` 是函数
- **THEN** `WebBuilder`/`EmbeddedWebBuilder` SHALL 在 `Stack` 中 `Web` 组件之后渲染一个透明 `Stack` overlay
- **AND** overlay SHALL 设置 `hitTestBehavior(HitTestMode.Transparent)` 以透传指针事件给下层 Web
- **AND** overlay SHALL 设置 `visibility` 跟随 `data.style.visible`（与 Web 一致，隐藏时 overlay 也隐藏）

#### Scenario: overlay omitted when flag is false
- **WHEN** `data.dragDropOverlay` 为 `false`/`undefined` 或 `data.onDragAndDrop` 不是函数
- **THEN** `WebBuilder`/`EmbeddedWebBuilder` SHALL NOT 渲染 overlay 节点
- **AND** 主路径 Web 级 `.onDragEnter/.onDragMove/.onDrop/.onDragLeave` 挂接保持不变

#### Scenario: pointer interaction pass-through
- **WHEN** overlay 已渲染且用户在 Web 区域内进行鼠标点击/滚动/触摸/文本选择
- **THEN** overlay SHALL NOT 拦截或消费这些指针事件
- **AND** Web 组件 SHALL 正常接收并响应（与无 overlay 时行为一致）
- **AND** HTML5 页内拖拽（DOM 元素之间的 DnD）SHALL 不被 overlay 干扰

### Requirement: Overlay SHALL attach ArkUI drag handlers and forward pipe-string payloads
overlay `Stack` SHALL 挂接 ArkUI 通用组件级 `.onDragEnter/.onDragMove/.onDragLeave/.onDrop` 回调（这些是 `CommonAttribute` 上的通用方法，不依赖 ArkWeb 冒泡）。回调 SHALL 从 `DragEvent` 提取文件 URI，按主路径相同的管道串协议 `<type>|<paths_nul>|<x>,<y>` 构造负载并调用 `data.onDragAndDrop(payload)`，使 wry 侧 `drag_drop_handler` 收到与主路径一致的 `DragDropEvent`。

#### Scenario: file dropped onto overlay
- **WHEN** 用户从 OHOS 文件管理器拖拽文件并释放在 webview 区域（overlay 上）
- **THEN** overlay 的 `.onDrop` 回调 SHALL 从 `dragEvent.getData()`（或 `dragEvent.primitive`/`summary`）读取被拖文件的 URI
- **AND** SHALL 去除 `file://`/`datashare://` scheme，以 `\0`（null byte）拼接为 `paths_nul`（兼容含逗号的路径）
- **AND** SHALL 从 `dragEvent.getX()`/`getY()`（或 `dragEvent.getArea()`/窗口坐标换算）得到 drop 点 `(x, y)`
- **AND** SHALL 调用 `data.onDragAndDrop('drop|' + paths_nul + '|' + x + ',' + y)`
- **AND** wry `drag_drop_handler` SHALL 收到 `DragDropEvent::Drop { paths, position }`

#### Scenario: drag enter/over/leave forwarded
- **WHEN** 拖拽指针进入/在 overlay 上移动/离开 overlay
- **THEN** `.onDragEnter` SHALL 调用 `data.onDragAndDrop('enter|<paths_nul>|<x>,<y>')`（如能从 `DragEvent` 提取预览路径则填入，否则 `paths_nul` 为空）
- **AND** `.onDragMove` SHALL 调用 `data.onDragAndDrop('over||<x>,<y>')`
- **AND** `.onDragLeave` SHALL 调用 `data.onDragAndDrop('leave||0,0')`
- **AND** wry SHALL 映射为 `DragDropEvent::{Enter, Over, Leave}`

#### Scenario: position coordinates
- **WHEN** overlay 收到拖拽事件
- **THEN** 位置 `(x, y)` SHALL 以 Web 组件内容区左上角为原点（与主路径 Web 级 `.onDrop` 的坐标语义一致）
- **AND** 若 ArkUI `DragEvent` 仅提供窗口坐标，overlay SHALL 减去 `data.style.x`/`data.style.y`（Web 在 Stack 中的偏移）换算为 Web 内容区坐标
- **AND** 若无法取得坐标，SHALL 回退为 `(0, 0)`（与主路径一致），不阻断事件转发

### Requirement: wry SHALL expose a dragDropOverlay switch
`wry::PlatformSpecificWebViewAttributes`（OHOS 专属，与 `use_https` 同结构，见铁律 #2）SHALL 提供一个 `drag_drop_overlay: bool` 字段（或等价 builder 方法 `WebViewBuilderExtOhos::with_drag_drop_overlay(bool)`），默认 `false`。该字段受 `cfg(target_env = "ohos")` 隔离，非 OHOS 平台无此字段、无副作用。`wry/src/ohos/mod.rs::new_inner` SHALL 把该值透传到 `openharmony_ability::WebViewBuilder`，最终作为 `WebviewInitData.dragDropOverlay` 字段抵达 ArkTS。当设备探测确认 ArkWeb 不冒泡 OS 文件拖拽时，应用层（或 tauri 默认配置）SHALL 把该开关设为 `true` 启用 overlay 降级。

#### Scenario: overlay flag propagated to ArkTS
- **WHEN** wry `PlatformSpecificWebViewAttributes.drag_drop_overlay` 设为 `true`
- **THEN** `openharmony_ability::WebViewInitData.dragDropOverlay` SHALL 为 `true`
- **AND** `DefaultWebview.ets` 的 `data.dragDropOverlay` SHALL 为 `true`，从而渲染 overlay 节点

#### Scenario: default off
- **WHEN** 应用未设置 `drag_drop_overlay`
- **THEN** 字段 SHALL 默认为 `false`
- **AND** ArkTS SHALL 不渲染 overlay（主路径生效）
- **AND** 非 OHOS 平台 SHALL 无该字段（`cfg(target_env = "ohos")` 隔离，无副作用）

### Requirement: Overlay SHALL NOT produce duplicate events with the main path
当 overlay 启用时，Web 级 `.onDragEnter/.onDragMove/.onDrop/.onDragLeave`（主路径）可能依然挂在 `Web` 组件上。为避免 ArkWeb 在某些版本下既冒泡又触发 overlay 导致双发，overlay 启用时 ArkTS SHALL 显式跳过 Web 级拖拽回调的转发（或根本不挂接 Web 级回调）。事件源 SHALL 唯一为 overlay。

#### Scenario: overlay enabled suppresses Web-level handlers
- **WHEN** `data.dragDropOverlay === true`
- **THEN** `WebBuilder`/`EmbeddedWebBuilder` SHALL NOT 给 `Web` 组件挂接 `.onDragEnter/.onDragMove/.onDrop/.onDragLeave`（或挂接但回调内直接 return）
- **AND** 拖拽事件 SHALL 仅由 overlay 处理并转发一次
- **AND** wry `drag_drop_handler` 对单次物理 drop SHALL 只收到一个 `DragDropEvent::Drop`

### Requirement: openharmony-ability SHALL plumb dragDropOverlay through NAPI
`openharmony-ability` Rust crate SHALL 在 `WebViewBuilder` 上新增 `drag_drop_overlay(self, enabled: bool)` 链式方法（或等价字段），并在 `WebViewInitData` NAPI object 中新增 `drag_drop_overlay: bool` 字段，由 `helper/webview.rs` 序列化到 ArkTS。该字段 SHALL 受 `feature = "drag_and_drop"` 门控（与 `on_drag_and_drop` 一致），关闭 feature 时不编译。

#### Scenario: drag_drop_overlay field on WebViewInitData
- **WHEN** `cargo build --features drag_and_drop` 在 OHOS 上执行
- **THEN** `crates/ability/src/webview/mod.rs` 的 `WebViewInitData` struct SHALL 包含 `pub drag_drop_overlay: bool` 字段
- **AND** `helper/webview.rs` 的 NAPI object 构建 SHALL 写入 `dragDropOverlay` camelCase 键
- **AND** `DefaultWebview.ets` 的 `WebviewInitData` interface SHALL 声明 `dragDropOverlay?: boolean`

#### Scenario: feature-gated
- **WHEN** 未启用 `drag_and_drop` feature
- **THEN** `drag_drop_overlay` 字段与方法 SHALL 不编译（与 `on_drag_and_drop` 同样的 cfg 门控）
- **AND** 非拖拽功能场景下 SHALL 无任何开销

### Requirement: Platform limitation SHALL be documented when overlay is also unavailable
若设备探测确认 overlay 方案也无法接收外部文件拖拽（例如 OHOS 桌面态整体不向应用下发 ArkUI 拖拽事件），SHALL 在 `ohos-webview-drag-drop-overlay-plan.md` 中显式记录该平台限制，并将 spec 对应 Requirement 标记为 MODIFIED，回退为「平台限制：文件拖拽不支持」。

#### Scenario: overlay also cannot receive drag events
- **WHEN** 设备探测显示 overlay `Stack` 的 `.onDragEnter/.onDrop` 在外部文件拖入时也不触发
- **THEN** plan 文件 SHALL 记录「ArkUI 通用组件级拖拽也不下发」结论
- **AND** wry `drag_drop_handler` 在 OHOS 上 SHALL 文档化为「永远收不到 Drop 事件」
- **AND** 应用层 SHALL 通过 HTML5 页内 DnD（`<input type="file">` 或 JS DnD API）作为最终降级

## Scenarios summary
| 场景 | 主路径状态 | overlay 状态 | wry 收到 |
|------|-----------|-------------|---------|
| ArkWeb 冒泡 OS 拖拽（默认假设） | 生效 | 不渲染 | DragDropEvent |
| ArkWeb 不冒泡，overlay 启用 | Web 级回调被抑制 | 渲染并接收事件 | DragDropEvent |
| ArkWeb 不冒泡且 ArkUI 也不下发 | N/A | 不触发 | 平台限制，无事件 |
| 页内 HTML5 DnD | 不影响 | 不影响 | 不产生 DragDropEvent |

## Non-goals
- 不解决 OHOS mobile 形态的拖拽（mobile 通常无文件管理器拖拽场景，标注不适用）
- 不实现 drag-out（webview 内元素拖出到系统），仅 drag-in
- 不定义坐标系的像素级精度保证（与主路径一致，必要时回退 `(0,0)`）
