## 1. Rust 侧 — TSFN + 公开函数

- [x] 1.1 在 `openharmony-ability/crates/ability/src/window/mod.rs` 新增 `type SetWindowTouchableTsfn = ThreadsafeFunction<(i64, bool), (), FnArgs<(i64, bool)>, Status, false>` + `static TSFN_SET_WINDOW_TOUCHABLE: OnceLock<...>`
- [x] 1.2 在 `init_vibrancy_tsfn`（`window/mod.rs:186`）内追加 touchable TSFN 初始化：`helper_obj.get_named_property("setWindowTouchable")` → `build_threadsafe_function::<(i64, bool)>().callee_handled::<false>().build_callback(...)` → `TSFN_SET_WINDOW_TOUCHABLE.set(...)`
- [x] 1.3 新增 `pub fn set_window_touchable(window_id: i64, touchable: bool) -> napi_ohos::Result<()>`，对称 `set_window_blur`（`window/mod.rs:241`）：取 TSFN → `tsfn.call((window_id, touchable), NonBlocking)` → 校验 status
- [x] 1.4 `set_window_touchable` 通过 `lib.rs:115 pub use window::*` 自动 re-export（无需手动加，确认 `set_window_blur` 同样自动导出）
- [x] 1.5 `cargo check -p openharmony-ability`（ohos target）编译通过，无 unused warning
- [x] 1.6 确认 `init_vibrancy_tsfn` 在 `render/xcomponent.rs:37` 已被调用（无需新增调用点，touchable TSFN 在该函数内追加即可）

## 2. ArkTS 侧 — WindowManager 封装 + ArkHelper 转发

- [x] 2.1 在 `openharmony-ability/native_ability/src/main/ets/window/WindowManager.ets` 新增 `setWindowTouchable(windowId: number, touchable: boolean): void`（对称 `setWindowFocusable:201-212`）：`this.getWindow(windowId)` → 若无 `hilog.warn` return → `win.setWindowTouchable(touchable).then(hilog.debug).catch(hilog.error)`
- [x] 2.2 在 `openharmony-ability/native_ability/src/main/ets/ability/ArkHelper.ets` 新增 `setWindowTouchable: (windowId: number, touchable: boolean): void`（位置参照 `setWindowFocusable:558`），转发到 `WindowManager.getInstance().setWindowTouchable(windowId, touchable)`，外层 try/catch 用 `safeLogError`
- [x] 2.3 确认 `WindowManager.getWindow` 方法存在（`setWindowFocusable:202` 用的就是 `this.getWindow(windowId)`）
- [x] 2.4 确认 WindowManager 的 `.catch` 用 `hilog.error`（Promise 异步回调，非 NAPI-reentrant，安全）；ArkHelper 的同步 catch 用 `safeLogError`（NAPI-reentrant 上下文）

## 3. 验证

- [x] 3.1 `cargo check`（ohos target）通过
- [x] 3.2 人工核对：TSFN 类型签名 `(i64, bool)` 与 ArkHelper 方法参数 `(windowId: number, touchable: boolean)` 类型对齐
- [x] 3.3 人工核对：`callee_handled::<false>()`（C2 规范）
- [x] 3.4 人工核对：ArkTS `.catch` 已处理 Promise reject（避免闪退）
- [x] 3.5 确认未触碰 `set_window_blur`/`set_window_background_color` 等现有 TSFN 代码路径

## 4. Phase 2 预留（不在本 Phase 执行）

- [x] 4.1 (Phase 2) 填实 `tao/src/platform_impl/ohos/mod.rs:1215` `set_ignore_cursor_events`：`self.window_id.ok_or(NotSupported)?` 解包 Option<i64> → 调 `openharmony_ability::set_window_touchable(window_id, !ignore)`，错误转 `ExternalError`
- [x] 4.2 (Phase 2) 真机验证 `setWindowTouchable(false)` 穿透语义：触摸点击 + 鼠标 hover 是否落到下层窗口
- [x] 4.3 (Phase 2) 若 hover 不穿透，追加组件级 `hitTestBehavior(HitTestMode.Transparent)`（参考 R72 drag-drop-overlay）—— 真机验证穿透 OK，无需追加 fallback
- [x] 4.4 (Phase 2) 若需错误感知，将 TSFN fire-and-forget 升级为 `call_with_return_value` + oneshot（参考 `clipboard_write_image`）—— deferred：fire-and-forget 满足 setIgnoreCursorEvents「尽量设置」语义，D3 已接受错误不可感知限制，无需升级
- [x] 4.5 (Phase 2) 手动测试用例归档到 `tauri/doc/manual_tests.md` + `ohos-adapter.ts`
