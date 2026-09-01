# OHOS WebView 文件拖拽 (ohos-webview-drag-drop) 计划

**创建时间**：2026-07-20
**功能描述**：激活 wry OHOS 的 `drag_and_drop` feature，接通 `drag_drop_handler`，补全 openharmony-ability `drag.rs` 与 ArkTS `onDragAndDrop` 事件挂接，使外部文件拖入 webview 时以 `DragDropEvent` 回传给 wry 用户回调。
**目标设备形态**：含 OHOS 桌面/大屏（desktop 形态为主；mobile 形态标注不适用）
**判断依据**：feature flag + Rust 闭包 + ArkTS 字段已存在但未端到端接通 → 重新评估旧 plan Phase 4 "平台限制" 结论
**目标级别**：完整实现（若 ArkWeb 不暴露 OS 文件拖拽事件则降级为 overlay 方案并显式标注）

## 与旧 plan 的关系
`openspec/webview-gap-completion-plan.md` Phase 4 标注 `✗ 平台限制`。复核发现：
- `crates/ability/src/webview/mod.rs` 已有 `#[cfg(feature = "drag_and_drop")] on_drag_and_drop` 字段与 NAPI 闭包桥接（line 284-296、439-443）
- `WebViewInitData.on_drag_and_drop` 已在 NAPI object 中声明（`helper/webview.rs:123`）
- `DefaultWebview.ets` `WebviewInitData.onDragAndDrop` 字段已声明（line 120）但 **WebBuilder/EmbeddedWebBuilder 从未挂接到 Web 组件**
- `drag.rs` 仅 stub `pub enum DragEvent { Enter {} }`，无序列化/反序列化

结论：旧 plan "平台限制" 结论 **过时/不准确** —— 基础设施 90% 就位，缺的是 ArkTS 事件挂接 + drag.rs 实体 + wry 层 handler 接通。Phase 4 应改为"可激活"，本计划取代旧 Phase 4。

## OHOS API 关键未知项
1. **ArkWeb Web 组件是否冒泡 OS 文件拖拽事件到 ArkUI `onDrop`**：华为文档未明确。ArkWeb 内部消费 HTML5 DnD，外部文件拖入时是否触发 ArkUI `onDragEnter`/`onDrop` 需设备验证。
   - 验证方法：在 WebBuilder 的 Web 组件上加 `.onDrop((event) => hilog.info(...))`，从文件管理器拖文件进去看是否触发。
   - 若不触发 → 采用 overlay 方案：在 `Stack` 中 Web 组件上方叠一层透明 `Column`/`Stack` 接收 ArkUI 拖拽事件，drop 时把焦点/可见性切换让 Web 响应，或直接由 overlay 消费并转发管道串 `<type>|<paths_csv>|<x>,<y>`。
2. **`DragEvent` 中文件 URI 格式**：OHOS 拖拽事件 `event.dragBehavior` / `primitive` / `summary` 字段如何提取文件路径。预期为 `file://` 或 `datashare://` URI，需去除 scheme 后转绝对路径。
3. **wry `DragDropEvent` 与 OHOS 事件类型映射**：
   - `Enter` ↔ ArkUI `onDragEnter`
   - `Over` ↔ ArkUI `onDragMove`
   - `Drop` ↔ ArkUI `onDrop`
   - `Leave` ↔ ArkUI `onDragLeave`
4. **线程模型**：ArkUI 拖拽回调在 JS 线程；wry `drag_drop_handler` 期望在事件循环线程。需通过 NAPI TSFN 或 `get_main_thread_env` 同步入队（参考 `on_page_begin` 等已有模式）。

## Phase 列表

| Phase | 名称 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|--------|---------|---------|
| 1 | 底层 NAPI + drag.rs 实体 | openharmony-ability Rust | 2 | drag.rs 编译 + 管道串解析单测（`from_arkts_pipe`/`to_arkts_pipe` 往返） |
| 2 | wry 接通 drag_drop_handler | wry | 1 | wry builder 设置 handler 后 NAPI 闭包非空 |
| 3 | ArkTS Web 组件事件挂接 | ArkTS | 2 | 设备端拖文件入 webview，wry 收到 Drop 事件 |
| 4 | 验证与降级 | 全层 | 1 | 若 ArkWeb 不冒泡则实现 overlay 方案 |

## Phase 详细说明

### Phase 1: 底层 NAPI + drag.rs 实体
- **目标**：把 `drag.rs` 从 stub 扩展为完整 `DragDropEvent` enum（`Enter { paths, position }`/`Over { position }`/`Drop { paths, position }`/`Leave`，与 `wry::DragDropEvent` 对齐），提供 `from_arkts_pipe(&str)` 方法（`splitn(3, '|')` + `,`-split 解析管道串 `<type>|<paths_csv>|<x>,<y>`）；提供 `to_arkts_pipe(&self)` 反向构造管道串供测试/调试使用。确认 NAPI 闭包签名 `Function<String, ()>` 与 wry 侧 `splitn(3, '|')` 解析匹配。
- **文件**：
  - `openharmony-ability/crates/ability/src/webview/drag.rs`（替换 stub）
  - `openharmony-ability/crates/ability/src/webview/mod.rs`（如需调整 on_drag_and_drop 闭包签名）
- **未知项**：无

### Phase 2: wry 接通 drag_drop_handler
- **目标**：在 `wry/src/ohos/mod.rs` `new_inner` 中读取 `attributes.drag_drop_handler`，转换为 `openharmony_ability::WebViewBuilder::on_drag_and_drop` 闭包；闭包内对管道串 `<type>|<paths_csv>|<x>,<y>` 执行 `raw.splitn(3, '|')`，第二段按 `,` split 过滤空串得 `paths: Vec<PathBuf>`，第三段按 `,` split 解析为 `position: (i32, i32)`（失败回退 `(0,0)`），按 `type` 映射到 `DragDropEvent::{Enter, Over, Drop, Leave}` 并调用用户 handler。
- **文件**：
  - `wry/src/ohos/mod.rs`（new_inner 增加 drag_drop_handler 分支，见 line 148-178 实现已落地）
- **依赖**：Phase 1
- **未知项**：wry `WebViewAttributes.drag_drop_handler` 字段类型（`Option<Rc<dyn Fn(DragDropEvent)>>`）—— 需确认跨平台签名一致

### Phase 3: ArkTS Web 组件事件挂接
- **目标**：在 `DefaultWebview.ets` `WebBuilder`/`EmbeddedWebBuilder` 中，当 `data.onDragAndDrop` 为函数时，给 Web 组件（或外层 Stack）挂 `.onDragStart`/`.onDragEnter`/`.onDragMove`/`.onDragLeave`/`.onDrop`，从 `DragEvent` 提取文件 URI，去除 `file://`/`datashare://` scheme，按管道串协议 `<type>|<paths_csv>|<x>,<y>` 拼接，调 `data.onDragAndDrop('drop|' + paths_csv + '|' + x + ',' + y)` 等。
- **文件**：
  - `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets`（WebBuilder + EmbeddedWebBuilder）
  - `openharmony-ability/native_ability/src/main/ets/webview/Utils.ets`（如需提取 URI 的工具函数）
- **依赖**：Phase 1
- **未知项**：ArkWeb Web 组件是否冒泡 OS 文件拖拽事件（见上「关键未知项 1」）

### Phase 4: 验证与降级
- **目标**：设备端验证拖文件入 webview 是否触发 wry `DragDropEvent::Drop`。若 ArkWeb 不冒泡，实现 overlay 方案：在 Web 组件上方叠透明 `Stack` 接收 ArkUI 拖拽事件并转发。验证 HTML5 页内 DnD 不受影响。
- **文件**：
  - `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets`（overlay Stack，按需）
  - `tauri/examples/api`（新增 drag_drop 测试命令 + 手动用例）
- **依赖**：Phase 1-3
- **未知项**：overlay 方案是否会阻挡 Web 组件的鼠标/触摸输入（需 `hitTestBehavior` 透传）

## 状态
- **Phase 1（drag.rs）**：✅ 完成。`DragDropEvent` enum（镜像 wry）+ `from_arkts_pipe`/`to_arkts_pipe`（`\0`-split）+ round-trip 单测；wry `new_inner` 闭包改为调 `from_arkts_pipe` + 1:1 映射。tauri crate ohos target 编译通过。
- **Phase 2（wry 接通）**：✅ 已落地（`9e3f8aa`）。`drag_drop_handler` → `on_drag_and_drop` 闭包接通，解析管道串。
- **Phase 3（ArkTS Web 级挂接）**：✅ 完成。`DefaultWebview.ets` WebBuilder + EmbeddedWebBuilder 4 组回调（Web 级 + overlay）全部改用模块级 `buildDragPipe` helper（纯函数，无 `this`，符合 ohos-constraints §4.1）。核心修正：`getData()` 返 `UnifiedData`（旧码 `typeof d === 'string'` 误判 → path 恒 `''`，已修）→ `getRecords()` → `getTypes()/getEntry()` 分派（`UniformDataType.FILE_URI`→`uniformDataStruct.FileUri.oriUri` 主路径，arkts-helper 确认 + 本地 `unified-data-channels.md:150-158` 验证 getTypes/getEntry API 与 PLAIN_TEXT→PlainText 约定；`Image.imageUri` 兜底 Photos-app 拖拽）→ 剥 `file://`/`datashare://` scheme → `\0` join 多文件（与 wry `from_arkts_pipe` 对齐）；`getX()/getY()` 读坐标（`0,0` 兜底，四事件均可读）；hilog 记录数 + 未知类型诊断助 Phase 5。ArkTS 无 Windows 宿主工具链，编译复核 deferred 到设备。
- **Phase 0（arkts-helper 查证）**：✅ 完成（降级路径）。`refresh_ai_auth` 失败（30 天会话过期，secureCookie blank），改用 `ask_ai` 匿名态 + 本地文档查证：getData() 返 UnifiedData、getX/getY 四事件可读、FILE_URI→FileUri.oriUri（getTypes/getEntry 经本地文档验证）。剩余 3 项（ArkWeb 冒泡 / hitTestBehavior Transparent 拖拽 / getX 窗口 vs 组件坐标）为设备依赖，归 Phase 5。
- **Phase 4（验证与降级）**：✅ 设备验证完成（2026-08-07）。5 次拖拽铁证：ArkWeb **会**冒泡 OS 文件拖拽到 `.onDrop`（前 3 次触发了 `drag drop: N record(s)`），但 **ArkWeb 内部消费 drop 是浏览器内核行为，优先于 ArkUI onDrop**——导航到 `file://<拖入文件>`（.txt/.html 均触发，普遍）→ `ERR_ACCESS_DENIED`/`httpStatus:0` → 白屏/错误页。**setResult(DRAG_SUCCESSFUL) 无效**：Web 组件 onDrop 不走 ArkUI 通用拖拽协议（拖拽指南完全未提 Web 组件，setResult/优先 onDrop 只对通用 ArkUI 组件生效）；且 Web 组件 onDrop 时灵时不灵（后 2-3 次完全不触发，因 ArkWeb 抢先消费后 ArkUI 不再派发 onDrop）。**结论：Main 路径（Web 级 .onDrop）+ setResult 在鸿蒙不可行**——ArkWeb 内核消费不可控、setResult 无效、handler 不可靠。**降级方案验证（2026-08-07，本地文档）**：拖拽是指向性事件，走命中测试（`arkts-interaction-basic-principles` 明确"拖拽"与触摸/鼠标同经 hit-test）；后渲染 overlay（右子树优先）若 `HitTestMode.Block` 命中则阻塞兄弟节点 Web 进入响应链 → Web 收不到 drop → ArkWeb 无从消费。故 `dragDropOverlay` 释放区**技术可行**，但有内在缺陷：Block overlay 拦 drop 同时也挡触摸，故只能覆盖小区域（释放区）；释放区外无 overlay → drop 落到 Web → ArkWeb 消费 → 白屏。全屏 Block overlay 会令 webview 不可交互。残余风险：ArkWeb 是否绕过命中测试在内核层直接消费（Hypothesis B），只能设备证伪。
**选定方案：onLoadIntercept 拦截 file:// 导航（更优，已实现 + 设备验证成功 2026-08-07）**。ArkWeb 消费 drop 的表现即"导航到 `file://<拖入文件>`"——而 `onLoadIntercept`（Web 组件事件，API 10+，`DefaultWebview.ets` 已有挂接 line 395/574）在导航前触发，`event.data.getRequestUrl()` 取 URL，返回 true 取消导航。在两处 onLoadIntercept 加 `file://` 分支：拦掉导航（阻止白屏）+ `decodeURIComponent`+`stripDragScheme` 取路径 + 转发 `drop|path|0,0`。**整面 webview 都是释放区、不挡触摸、不依赖时灵时不灵的 onDrop**。安全：Tauri OHOS 初始加载走 `ctrl.loadUrl(data.url)`（自定义协议 `tauri://`/`https://<proto>.localhost`）或 `loadData(html)`，从不 `file://`（`wry/src/ohos/mod.rs:198/209` 确认），故拦 file:// 不影响正常加载。Web 级 onDrop（enter/over/leave 悬停反馈）保留；`buildDragPipe` 的 setResult 保留为无害 no-op（对通用组件仍正确）。**设备验证结果**：装机后拖文件，**白屏消失**（旧版每次必白屏/ERR_ACCESS_DENIED，现在不会）+ Web 级 onDrop 触发（hilog `drag drop: 1 record(s) received`，UDMF 路径提取链工作）。onLoadIntercept file:// 拦截方案确认成功——OHOS 文件拖拽端到端打通。setResult 改动保留在 buildDragPipe（对通用组件 onDrop 仍正确，无害），但 Web 组件上无效。setResult 改动保留在 buildDragPipe（对通用组件 onDrop 仍正确，无害），但 Web 组件上无效。启动期另有 `THREAD_BLOCK_6S` appfreeze（store 插件锁竞争，与拖拽无关，进程未死）。
- **tauri setter 阻塞点**：✅ 不存在。`tauri-runtime-wry/src/lib.rs:5268` 自动装内部 handler，Rust 管道端到端通（详见 overlay plan「实现期发现」修正段）。`ohos-tauri-drag-drop-handler-api` 独立 change 取消。
- **cfg 卫生（task 9）**：✅ 完成。`drag_drop_overlay` 在 tauri/tauri-runtime 层 6 处补 `#[cfg(target_env = "ohos")]`（字段/new()/方法 ×3 + cmd.rs 调用点）。Windows host `cargo check` 通过，tauri-runtime + tauri + tauri-runtime-wry 编译干净、无 fallout；ohos 由构造不变。对齐 spec「非 OHOS 平台无此字段」。

## 备注
- 不影响其它平台：所有改动限于 `cfg(target_env = "ohos")` 路径或 `feature = "drag_and_drop"` 门控
- 铁律遵守：ArkTS 调用经 openharmony-ability，不在 wry 直接调 ArkTS
- 若 Phase 4 验证后确认 ArkWeb 完全不支持外部文件拖拽且 overlay 方案不可行，则回退为"平台限制"并更新 spec 的 MODIFIED Requirement
