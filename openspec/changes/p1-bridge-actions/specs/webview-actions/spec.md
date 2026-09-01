# webview-actions spec

## plugin: ohos.webview

Plugin ID: `ohos.webview`
Execution: `async`
Context requirement: `ui-context`

## 新增 outbound actions

### create-pdf

| 字段 | 值 |
|------|-----|
| action | `create-pdf` |
| reqType | `ohos.webview.PrintRequest` |
| respType | `ohos.webview.PrintResponse` |

**PrintRequest**:
```
{ id: String, path: String }
```

**PrintResponse**:
```
{ success: bool }
```

**ArkTS**：`controller.createPdf(DEFAULT_PDF_CONFIG)` → `pdfArrayBuffer()` → `fileIo.write(path)`。固定 A4 配置（8.27×11.69in, 零边距, shouldPrintBackground=true）。API 14+ 守卫：`typeof controller.createPdf !== 'function'` 时返回 `success: false`。

### set-user-agent

| 字段 | 值 |
|------|-----|
| action | `set-user-agent` |
| reqType | `ohos.webview.UserAgentRequest` |
| respType | `ohos.webview.Acknowledgement` |

**UserAgentRequest**:
```
{ id: String, user_agent: String }
```

**ArkTS**：`controller.setCustomUserAgent(userAgent)`，try-catch 捕获失败。

## 新增 reverse events

所有 reverse event 通过 `context.invokeNativeSync(event, reqType, respType, value)` 分发，response 为 `ohos.webview.EventAcknowledgement`（`{ accepted: bool }`），navigation/new-window 除外。

### drag-enter / drag-over / drag-leave

| 字段 | 值 |
|------|-----|
| events | `drag-enter`, `drag-over`, `drag-leave` |
| reqType | `ohos.webview.DragEvent` |
| respType | `ohos.webview.EventAcknowledgement` |

**DragEvent**:
```
{ id: String, native_tag: String, x: f64, y: f64 }
```

**ArkTS**：Web 组件 `.onDragEnter` / `.onDragMove` / `.onDragLeave` 回调。`dragEvent.getX()/getY()` 提取坐标。不提取 paths（`getData()` 仅在 onDrop 有效）。

### drag-drop

| 字段 | 值 |
|------|-----|
| event | `drag-drop` |
| reqType | `ohos.webview.DropEvent` |
| respType | `ohos.webview.EventAcknowledgement` |

**DropEvent**:
```
{ id: String, native_tag: String, x: f64, y: f64, paths: Vec<String> }
```

**ArkTS**：Web 组件 `.onDrop` 回调。`dragEvent.getData()` 返回 UDMF `UnifiedData`；遍历 `getRecords()`，每个 record 通过 `getTypes()` / `getEntry(UniformDataType.FILE_URI)` 提取 `FileUri.oriUri`，回退到 `Image.imageUri`。`file://` / `datashare://` scheme 被 strip。

**file:// 拦截路径**：ArkWeb 消费 OS 文件 drop 时导航到 `file://<dropped file>`，抢先 `.onDrop`。可靠拦截点在 `onLoadIntercept` 的 `file://` 分支：提取路径后通过 `drag-drop` 反向事件发送（paths 仅含被拦截的文件路径），返回 `intercept: true` 阻止导航。

### new-window-request

| 字段 | 值 |
|------|-----|
| event | `new-window-request` |
| reqType | `ohos.webview.NewWindowRequest` |
| respType | `ohos.webview.NewWindowResponse` |

**NewWindowRequest**:
```
{ id: String, native_tag: String, target_url: String, is_alert: bool, is_user_trigger: bool }
```

**NewWindowResponse**:
```
{ allow: bool }
```

**ArkTS**：Web 组件 `.onWindowNew` 回调。需先绑定 `.multiWindowAccess(true).allowWindowOpenMethod(true)`。
- `allow = false` 或无 handler：`event.handler.setWebController(null)`（阻止，**必须调用否则渲染进程阻塞**）。
- `allow = true`：创建新 `WebviewController`，`event.handler.setWebController(newCtrl)`，通过 `promptAction.openCustomDialog()` 展示内嵌 Web 的弹窗。
- `NewWindowResponse::Create` 降级为 `Allow`（OHOS 无 OS 级窗口创建基础设施，与 mobile 行为一致）。

### page-begin / page-end

| 字段 | 值 |
|------|-----|
| events | `page-begin`, `page-end` |
| reqType | `ohos.webview.PageEvent` |
| respType | `ohos.webview.EventAcknowledgement` |

**PageEvent**:
```
{ id: String, native_tag: String, url: String }
```

**ArkTS**：Web 组件 `.onPageBegin((e) => ...)` / `.onPageEnd((e) => ...)` 回调，`e.url` 提取 URL。

## create 入参扩展

`WebviewCreateRequest` 新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `clipboard` | `Option<bool>` | 启用 ArkWeb 原生剪贴板（Ctrl+C/V/X/A/Z/Y）。默认 true。false 时 onKeyPreIme 拦截器不拦截剪贴板快捷键。 |
| `zoom_hotkeys` | `Option<bool>` | 启用缩放快捷键（Ctrl+/-/0）。默认 false。 |
| `drag_drop_overlay` | `Option<bool>` | true 时在 Web 上叠加透明 Stack 接收 drag 事件（Web 不接收）。默认 false。 |

`WebviewCallbackOptions` 新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `drag_drop` | `bool` | 任一 drag 回调注册时为 true |
| `new_window` | `bool` | new-window 回调注册时为 true |
| `page_begin` | `bool` | page-begin 回调注册时为 true |
| `page_end` | `bool` | page-end 回调注册时为 true |

ArkTS `WebviewCreatePayload` / `WebviewEventOptions` 对应扩展（camelCase）。

## close-window 路由

无新 action。在 `navigation-request` 反向事件的 Rust handler 内部路由：
- URL 匹配 `close-window.invalid` 前缀（或 `http://close-window.invalid`）：调用注册的 `on_close_window` Rust 回调，返回 `intercept: true`。
- 否则：走正常 navigation 回调。

`WebviewCallbacksBuilder` 新增 `.on_close_window(callback: F)` 方法，`callback: Fn() + Send + Sync + 'static`（与现有 bridge callback 模式一致，在 `navigation_decision()` 中同步调用）。

## Rust callback builder 扩展

`WebviewCallbacksBuilder` 新增方法：

| 方法 | 回调签名 |
|------|---------|
| `.on_drag_enter(F)` | `Fn(WebviewDragEvent) + Send + Sync + 'static` |
| `.on_drag_over(F)` | `Fn(WebviewDragEvent) + Send + Sync + 'static` |
| `.on_drag_drop(F)` | `Fn(WebviewDropEvent) + Send + Sync + 'static` |
| `.on_drag_leave(F)` | `Fn(WebviewDragEvent) + Send + Sync + 'static` |
| `.on_new_window_request(F)` | `Fn(WebviewNewWindowRequest) -> bool + Send + Sync + 'static` |
| `.on_page_begin(F)` | `Fn(WebviewPageEvent) + Send + Sync + 'static` |
| `.on_page_end(F)` | `Fn(WebviewPageEvent) + Send + Sync + 'static` |
| `.on_close_window(F)` | `Fn() + Send + Sync + 'static` |
