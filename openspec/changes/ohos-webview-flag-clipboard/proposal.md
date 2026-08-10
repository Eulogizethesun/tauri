## Why

wry 的 `with_clipboard(bool)` 在 OHOS 后端被静默丢弃——`InnerWebView::new_inner` 解构 `WebViewAttributes` 时 `clipboard` 落入 `..` catch-all，导致开发者设 `false` 无法禁用剪贴板。ArkWeb 默认允许页面剪贴板访问并原生响应 Ctrl+C/X/V/A/Z/Y，因此功能"默认能用"但"关不掉"，与 Windows/macOS/Linux 的 flag 语义不一致（跨平台 API 契约缺口）。

旧 `webview-desktop-features` spec 的 R82 决策"clipboard always-on (platform limitation)"将 OHOS 与 macOS 等同，但 macOS 是 WebKit 引擎级限制无 toggle，OHOS 可通过组合键拦截实现禁用，二者不应等同。本 change 取代该决策。

## What Changes

- **wry**：`src/ohos/mod.rs` `new_inner` 显式解构 `clipboard`，调用 `WebViewBuilder::clipboard(clipboard)`
- **openharmony-ability (Rust)**：`WebViewBuilder` 新增 `clipboard: Option<bool>` 字段 + setter；`WebViewInitData` 新增 `clipboard` 字段；`build()` 透传
- **openharmony-ability (ArkTS)**：`WebviewInitData` 接口加 `clipboard?: boolean`；`accelerator_matcher.ets` 新增 per-window flag 存储（`setClipboardEnabled`/`isClipboardEnabled`/`clearClipboardEnabled`）+ `AcceleratorMatcher.matchesClipboardShortcut(event)`；`ArkHelper.createWebview` 注册 flag；`MainPage`/`FloatPage` `onKeyPreIme` 在 flag=false 且匹配 CLIPBOARD_ACCELERATORS 时 `return true` 消费事件

## Capabilities

### Modified Capabilities
- `ohos-webview-flag-clipboard`: wry `with_clipboard` flag 在 OHOS 生效——`false` 拦截剪贴板组合键，`true` 维持 ArkWeb 原生行为。取代 `webview-desktop-features` R82。

## Impact

- 跨平台契约对齐：OHOS 行为与 Windows/Linux 一致（flag=false 禁用剪贴板快捷键）
- 不影响其他平台：所有改动在 `cfg(target_env = "ohos")` 或 OHOS 专属 ETS 文件内
- 不影响程序化 `@ohos.pasteboard` 读写（仅拦截键盘组合键）
- 默认行为不变（flag 默认 true = ArkWeb 原生）
