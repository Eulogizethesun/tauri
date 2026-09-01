# Phase A1 实现任务清单

## 1. webview 域

### 1.1 Rust facade 类型（plugin-webview/src/lib.rs）
- [x] 1.1.1 新增 `WebviewPrintRequest` / `WebviewPrintResponse` 类型 + `impl_bridge_napi_type!`
- [x] 1.1.2 新增 `WebviewUserAgentRequest` 类型（resp 复用 `WebviewAcknowledgement`）
- [x] 1.1.3 新增 `WebviewDragEvent` / `WebviewDropEvent` 类型 + `impl_bridge_napi_type!`
- [x] 1.1.4 新增 `WebviewNewWindowRequest` / `WebviewNewWindowResponse` 类型 + `impl_bridge_napi_type!`
- [x] 1.1.5 新增 `WebviewPageEvent` 类型（resp 复用 `WebviewEventAcknowledgement`）
- [x] 1.1.6 `WebviewCreateRequest` 新增 `clipboard` / `zoom_hotkeys` / `drag_drop_overlay` 字段
- [x] 1.1.7 `WebviewCallbackOptions` 新增 `drag_drop` / `new_window` / `page_begin` / `page_end` 字段

### 1.2 Rust callbacks registry（plugin-webview/src/callbacks.rs）
- [x] 1.2.1 新增 `DragEnterCallback` / `DragOverCallback` / `DragDropCallback` / `DragLeaveCallback` 类型
- [x] 1.2.2 `WebviewCallbacks` 结构体新增 4 个 drag callback 字段
- [x] 1.2.3 `WebviewCallbacksBuilder` 新增 `.on_drag_enter()` / `.on_drag_over()` / `.on_drag_drop()` / `.on_drag_leave()` 方法
- [x] 1.2.4 新增 `NewWindowCallback` 类型 + `WebviewCallbacksBuilder::on_new_window_request()` 方法
- [x] 1.2.5 新增 `PageBeginCallback` / `PageEndCallback` 类型 + builder 方法
- [x] 1.2.6 新增 `on_close_window` callback + builder 方法
- [x] 1.2.7 `WebviewCallbacks::options()` 扩展输出新字段
- [x] 1.2.8 新增 `dispatch_drag_enter/over/drop/leave` / `dispatch_new_window` / `dispatch_page_begin/end` / `dispatch_close_window` 分发函数

### 1.3 Rust bridge plugin（plugin-webview/src/lib.rs）
- [x] 1.3.1 `WebviewBridgePlugin::on_main_thread_event` 新增 `drag-enter` / `drag-over` / `drag-drop` / `drag-leave` match 分支
- [x] 1.3.2 新增 `new-window-request` match 分支（调用 `callbacks::new_window_decision`）
- [x] 1.3.3 新增 `page-begin` / `page-end` match 分支
- [x] 1.3.4 `navigation_decision()` 增加 `close-window.invalid` URL 前缀检查 + `dispatch_close_window` 调用
- [x] 1.3.5 `required_contexts_for_main_thread_event` 确认新事件使用默认 `UiContext` 约束
- [x] 1.3.6 将现有 `WebviewHandle::on_page_begin` / `on_page_end`（C-API 路径）标记 `#[deprecated]`，避免与 bridge 回调双触发

### 1.4 Rust WebviewHandle facade（plugin-webview/src/lib.rs）
- [x] 1.4.1 新增 `WebviewHandle::create_pdf(path)` async 方法
- [x] 1.4.2 新增 `WebviewHandle::set_user_agent(ua)` async 方法

### 1.5 ArkTS WebviewPlugin.ets
- [x] 1.5.1 新增 `PRINT_REQUEST_TYPE` / `PRINT_RESPONSE_TYPE` / `USER_AGENT_REQUEST_TYPE` 常量
- [x] 1.5.2 `WebviewCreatePayload` 接口新增 `clipboard` / `zoomHotkeys` / `dragDropOverlay` 字段
- [x] 1.5.3 `WebviewEventOptions` 接口新增 `dragDrop` / `newWindow` / `pageBegin` / `pageEnd` 字段
- [x] 1.5.4 `normalizeEventOptions()` 扩展处理新字段
- [x] 1.5.5 `ManagedWebview` 接口新增 drag/new-window/page/close-window 回调字段
- [x] 1.5.6 `BuildWebview` @Builder 绑定 `.onPageBegin` / `.onPageEnd`（条件绑定）
- [x] 1.5.7 `BuildWebview` @Builder 绑定 `.onDragEnter` / `.onDragMove` / `.onDrop` / `.onDragLeave`（根据 `dragDropOverlay` 选择直接绑定或 overlay Stack）
- [x] 1.5.8 `BuildWebview` @Builder 绑定 `.multiWindowAccess(true).allowWindowOpenMethod(true).onWindowNew(handler)`（条件绑定）
- [x] 1.5.9 实现 `handleWindowNew`：`invokeNativeSync("new-window-request")` → allow/deny → `setWebController`
- [x] 1.5.10 实现 `onLoadIntercept` `file://` 分支：提取路径 → `drag-drop` 反向事件 → `return true`
- [x] 1.5.11 新增 `create-pdf` action 处理（`controller.createPdf` + `fileIo.write`，含 API 14+ 守卫 `typeof controller.createPdf !== 'function'` 时返回 `success: false`）
- [x] 1.5.12 新增 `set-user-agent` action 处理（`controller.setCustomUserAgent`）
- [x] 1.5.13 新增 drag event helper 函数（`buildDragEvent` / `extractDragPaths` / `stripDragScheme`，从 legacy DefaultWebview.ets 移植）
- [x] 1.5.14 新增 `NewWindowDialog` 弹窗（从 `native_ability/.../webview/NewWindowDialog.ets` 移植到 plugins/webview/）— 移植 `NewWindowDialog.ets` 到 `plugins/webview/src/main/ets/`；`ManagedWebview` 加 `onAllowNewWindow` 回调（`create()` 捕获 `this.pluginContext.getUIContext()`，因 `@Builder function BuildWebview` 无 `this`）；overlay/direct 两 Allow 分支在同步 `setWebController(newController)` 后调 `data.onAllowNewWindow?.(newController, url)` → 回调内 `setTimeout(0) openNewWindowDialog`。修复 Allow 分支裸 controller 无 Web 宿主致 ArkWeb 新窗口渲染永久阻塞（主线程死锁，#85）。审计子agent复核：legacy `DefaultWebview.ets:59-71` 同模式，ArkWeb 契约 `setWebController` 须 onWindowNew 内同步，setTimeout(0) 合规；三铁律合规（纯 openharmony-ability ArkTS，不碰跨平台 Rust）

### 1.6 测试
- [x] 1.6.1 Rust 单元测试：新增类型的 `TYPE_NAME` 断言
- [x] 1.6.2 Rust 单元测试：`navigation_decision` close-window URL 路由
- [ ] 1.6.3 Rust 单元测试：callbacks builder 新方法注册 + stale controller 拒绝
- [ ] 1.6.4 设备冒烟：create-pdf 生成 PDF 文件
- [ ] 1.6.5 设备冒烟：set-user-agent 生效
- [ ] 1.6.6 设备冒烟：drag-drop 文件拖入
- [ ] 1.6.7 设备冒烟：new-window allow/deny
- [ ] 1.6.8 设备冒烟：page-begin/page-end 事件触发

## 2. app-control 域

### 2.1 Rust facade（plugin-app-control/src/lib.rs）
- [x] 2.1.1 新增 `HideAbilityRequest` / `HideAbilityResponse` 类型 + `impl_bridge_napi_type!`
- [x] 2.1.2 新增 `ShowAbilityRequest` / `ShowAbilityResponse` 类型 + `impl_bridge_napi_type!`
- [x] 2.1.3 `AppControlExt` trait 新增 `hide_ability` / `show_ability` 方法
- [x] 2.1.4 实现 `hide_ability` / `show_ability`（`with_main_thread_bridge` + `call_sync`）
- [x] 2.1.5 单元测试：新增类型的 `TYPE_NAME` 断言

### 2.2 ArkTS AppControlPlugin.ets
- [x] 2.2.1 新增 `HIDE_ABILITY_REQUEST_TYPE` / `HIDE_ABILITY_RESPONSE_TYPE` / `SHOW_ABILITY_REQUEST_TYPE` / `SHOW_ABILITY_RESPONSE_TYPE` 常量
- [x] 2.2.2 `invokeSync` 新增 `hide-ability` action：`context.abilityContext.hideAbility(callback)` fire-and-forget（注意：hideAbility 仅支持 callback，不支持 Promise）
- [x] 2.2.3 `invokeSync` 新增 `show-ability` action：`context.abilityContext.startAbility(want)` fire-and-forget（startAbility 支持 Promise，可用 `.catch()`）
- [x] 2.2.4 导入 `Want` from `@kit.AbilityKit`

### 2.3 WindowPlugin BlurModifier 迁移
- [ ] 2.3.1 从 `_legacy/DefaultWebview.ets` 提取 `BlurModifier` 类到 `plugins/window/src/main/ets/BlurModifier.ets`
- [ ] 2.3.2 WindowPlugin.ets 的 `set-blur` action 增加通过 `AttributeUpdater` 刷新 `backdropBlur` 的逻辑
- [ ] 2.3.3 设备冒烟：set-blur 动态刷新 backdropBlur

### 2.4 测试
- [ ] 2.4.1 设备冒烟：hide-ability 应用隐藏
- [ ] 2.4.2 设备冒烟：show-ability 应用恢复

## 3. clipboard 域

### 3.1 Rust crate 新建（crates/plugin-clipboard/）
- [x] 3.1.1 新建 `crates/plugin-clipboard/Cargo.toml`（依赖 openharmony-ability, napi-ohos）
- [x] 3.1.2 新建 `crates/plugin-clipboard/src/lib.rs`
- [x] 3.1.3 定义 `ClipboardBridgePlugin`（AsyncBridge, ID="ohos.clipboard", REQUIRED_CONTEXTS=[Ability]）
- [x] 3.1.4 新增 `ClipboardReadTextRequest` / `ClipboardReadTextResponse` 类型 + `impl_bridge_napi_type!`
- [x] 3.1.5 新增 `ClipboardWriteTextRequest` / `ClipboardWriteTextResponse` 类型 + `impl_bridge_napi_type!`
- [x] 3.1.6 新增 `ClipboardWriteImageRequest` / `ClipboardWriteImageResponse` 类型 + `impl_bridge_napi_type!`
- [x] 3.1.7 实现 `ClipboardClient`（`read_text` / `write_text` / `write_image`）
- [x] 3.1.8 实现 `ClipboardExt` trait for `OpenHarmonyApp`
- [x] 3.1.9 `write_image` 的 rgba 维度校验（`len == width * height * 4`）
- [x] 3.1.10 单元测试：TYPE_NAME 断言 + 维度校验

### 3.2 ArkTS 插件新建（plugins/clipboard/）
- [x] 3.2.1 新建 `plugins/clipboard/BuildProfile.ets`
- [x] 3.2.2 新建 `plugins/clipboard/index.ets`（导出 ClipboardPlugin + factory）
- [x] 3.2.3 新建 `plugins/clipboard/src/main/ets/ClipboardPlugin.ets`
- [x] 3.2.4 新建 `plugins/clipboard/oh-package.json5` / `build-profile.json5` / `hvigorfile.ts`（参考 plugins/app-control/ 同名文件）
- [x] 3.2.5 `ClipboardPlugin` 继承 `AsyncPluginBase`，id `"ohos.clipboard"`，requires `["ability"]`
- [x] 3.2.6 实现 `read-text` action：`pasteboard.getSystemPasteboard().getData()` → `getPrimaryText()`
- [x] 3.2.7 实现 `write-text` action：`pasteboard.createData(MIMETYPE_TEXT_PLAIN, text)` → `setData()`
- [x] 3.2.8 实现 `write-image` action：复用 `ClipboardHelper.ets` 的 `writeImageToClipboard` 逻辑
- [x] 3.2.9 BridgeHost 注册 ClipboardPlugin factory

### 3.3 遗留代码标记
- [x] 3.3.1 `crates/ability/src/clipboard/mod.rs` 的 `clipboard_write_image` 标记 `#[deprecated]`
- [x] 3.3.2 `native_ability/.../helper/ClipboardHelper.ets` 保持不变（被新 ClipboardPlugin 内部调用）

### 3.4 测试
- [ ] 3.4.1 设备冒烟：write-text → read-text 往返
- [ ] 3.4.2 设备冒烟：write-image 写入剪贴板
- [x] 3.4.3 Rust 单元测试：ClipboardExt 可从 OpenHarmonyApp 获取 ClipboardClient

## 4. 构建集成
- [x] 4.1 workspace Cargo.toml 新增 `plugin-clipboard` 成员
- [ ] 4.2 `cargo check --target aarch64-unknown-linux-ohos` 编译通过
- [ ] 4.3 HAR 重建（ArkTS 改动）+ HAP 重建
- [ ] 4.4 demo 触发所有新 action 冒烟通过
