# ohos-webview-flag-zoom-hotkeys Tasks

## 1. Rust flag 转发
- [x] 1.1 `WebViewBuilder` 加 `pub zoom_hotkeys_enabled: Option<bool>`
- [x] 1.2 新增 `pub fn zoom_hotkeys_enabled(self, ..)` setter
- [x] 1.3 `WebViewInitData` 加 `pub zoom_hotkeys_enabled: Option<bool>`
- [x] 1.4 `build()` 透传 `zoom_hotkeys_enabled: self.zoom_hotkeys_enabled`
- [x] 1.5 `wry/src/ohos/mod.rs` `new_inner` 解构 `zoom_hotkeys_enabled` + `.zoom_hotkeys_enabled(zoom_hotkeys_enabled)`

## 2. ETS onKeyPreIme 拦截
- [x] 2.1 `DefaultWebview.ets` `WebviewInitData` 加 `zoomHotkeysEnabled?: boolean`
- [x] 2.2 `accelerator_matcher.ets` 加 per-window flag 存储 `setZoomHotkeysEnabled`/`isZoomHotkeysEnabled`/`clearZoomHotkeysEnabled`
- [x] 2.3 `accelerator_matcher.ets` 加 `matchesZoomShortcut(event)`（Ctrl + =/-/0/equals/minus）
- [x] 2.4 `ArkHelper.createWebview` 调 `setZoomHotkeysEnabled(windowId, data?.zoomHotkeysEnabled ?? true)` + init 透传
- [x] 2.5 `MainPage.ets` onKeyPreIme 加 zoom 拦截分支
- [x] 2.6 `FloatPage.ets` onKeyPreIme 加 zoom 拦截分支

## 3. 验证（待设备）
- [ ] 3.1 `with_zoom_hotkeys(false)` + Ctrl+= → 不缩放
- [ ] 3.2 `with_zoom_hotkeys(true)` + Ctrl+= → ArkWeb 原生缩放
- [ ] 3.3 `with_zoom_hotkeys(false)` + Ctrl+0 → 不重置
- [ ] 3.4 程序化 `controller.zoom()` 不受影响
- [ ] 3.5 keyCode/keyText 映射（= / - / 0 的 KEYCODE_* 形式）设备确认
