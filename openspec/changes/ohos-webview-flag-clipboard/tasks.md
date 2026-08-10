# ohos-webview-flag-clipboard Tasks

## 1. Rust flag 转发 + NAPI 桥接

- [x] 1.1 `openharmony-ability/crates/ability/src/webview/mod.rs`：`WebViewBuilder` 新增 `pub clipboard: Option<bool>` 字段
- [x] 1.2 `openharmony-ability/crates/ability/src/webview/mod.rs`：新增 `pub fn clipboard(self, clipboard: bool)` setter
- [x] 1.3 `openharmony-ability/crates/ability/src/helper/webview.rs`：`WebViewInitData` 新增 `pub clipboard: Option<bool>` 字段
- [x] 1.4 `openharmony-ability/crates/ability/src/webview/mod.rs`：`build()` 构造 `WebViewInitData` 时透传 `clipboard: self.clipboard`
- [x] 1.5 `wry/src/ohos/mod.rs`：`new_inner` 解构 `clipboard`（移出 `..`），builder 链加 `.clipboard(clipboard)`

## 2. ETS onKeyPreIme 拦截

- [x] 2.1 `openharmony-ability/.../ets/webview/DefaultWebview.ets`：`WebviewInitData` 接口加 `clipboard?: boolean`
- [x] 2.2 `openharmony-ability/.../ets/helper/accelerator_matcher.ets`：新增 per-window flag 存储 `setClipboardEnabled`/`isClipboardEnabled`/`clearClipboardEnabled`
- [x] 2.3 `openharmony-ability/.../ets/helper/accelerator_matcher.ets`：`AcceleratorMatcher` 新增 `matchesClipboardShortcut(event)` 方法（复用 getKeyText/isModifierPressed + CLIPBOARD_ACCELERATORS）
- [x] 2.4 `openharmony-ability/.../ets/ability/ArkHelper.ets`：`createWebview` 调 `setClipboardEnabled(windowId, data?.clipboard ?? true)`；init 透传 `clipboard`
- [x] 2.5 `openharmony-ability/.../ets/components/MainPage.ets`：`onKeyPreIme` 加拦截分支（flag=false 且 matchesClipboardShortcut → return true）
- [x] 2.6 `openharmony-ability/.../ets/components/FloatPage.ets`：同上（用 `this.windowId`）

## 3. 验证与协调（待设备验证）

- [ ] 3.1 `with_clipboard(false)` + 选中文本 + Ctrl+C → 剪贴板不变
- [ ] 3.2 `with_clipboard(true)` + Ctrl+C → 正常复制
- [ ] 3.3 `with_clipboard(false)` + 菜单含 Ctrl+C 加速器 + Ctrl+C → 既不复制也不触发菜单
- [ ] 3.4 `with_clipboard(false)` + Ctrl+F → 正常（不拦截非剪贴板键）
- [ ] 3.5 程序化 `@ohos.pasteboard` 读写不受影响
