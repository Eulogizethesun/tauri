## Why

wry 的 `with_zoom_hotkeys_enabled(bool)` / `with_hotkeys_zoom` 在 OHOS 后端被静默丢弃——`InnerWebView::new_inner` 解构时 `zoom_hotkeys_enabled` 落入 `..`，开发者设 `false` 无法禁用。ArkWeb 原生响应 Ctrl+=/-/0 缩放，功能"默认能用"但"关不掉"，跨平台契约缺口。取代 `webview-desktop-features` R91 旧决策。

## What Changes

- **wry**：`new_inner` 解构 `zoom_hotkeys_enabled`，调用 `WebViewBuilder::zoom_hotkeys_enabled(...)`
- **openharmony-ability (Rust)**：`WebViewBuilder` 加 `zoom_hotkeys_enabled` 字段 + setter；`WebViewInitData` 加字段；`build()` 透传
- **openharmony-ability (ArkTS)**：`WebviewInitData` 加 `zoomHotkeysEnabled`；`accelerator_matcher.ets` 加 `matchesZoomShortcut` + per-window flag 存储；`ArkHelper.createWebview` 注册；`MainPage`/`FloatPage` `onKeyPreIme` 在 flag=false 且匹配 zoom 组合键时消费事件

## Capabilities

### Modified Capabilities
- `ohos-webview-flag-zoom-hotkeys`: wry zoom hotkeys flag 在 OHOS 生效。取代 `webview-desktop-features` R91。

## Impact

- 跨平台契约对齐：flag=false 禁用缩放热键
- 默认行为不变（flag=true = ArkWeb 原生 Ctrl+=/-/0）
- 程序化 `controller.zoom()` 不受影响
- 方案A（短路 zoom-hotkey.js 注入）：经核查 OHOS 无 JS 注入路径，无需处理
