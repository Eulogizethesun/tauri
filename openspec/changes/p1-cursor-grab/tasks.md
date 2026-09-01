# Tasks: p1-cursor-grab

## 1. ArkTS helper(openharmony-ability)

- [x] 1.1 `native_ability/src/main/ets/window/WindowManager.ets` 新增 `getRealWindowId(windowId: number): number`:复用 `getWindow()` + `getWindowProperties().id`;窗口未找到返回 `-1`;函数体内禁用 hilog(NAPI func.call 调用链 Argc mismatch 约束)
- [x] 1.2 `native_ability/src/main/ets/ability/ArkHelper.ets` 新增 `getRealWindowId` helper 属性(try/catch 吞错返回 -1,`safeLogError` 仅在 catch 使用) + `native_ability/src/main/ets/ability/type.ets` 接口声明 `getRealWindowId: (windowId: number) => number;`

## 2. Rust FFI 封装(openharmony-ability)

- [x] 2.1 `crates/ability/src/window/mod.rs` 新增光标锁定 FFI 模块:`dlopen("libnative_window_manager.so")` + `dlsym` 解析 `OH_WindowManager_LockCursor`/`OH_WindowManager_UnlockCursor`,函数指针缓存于 `OnceLock`;dlopen/dlsym 失败返回 `None`(不 panic,不静态链接)
- [x] 2.2 `crates/ability/src/window/mod.rs` 新增类型化错误 `pub enum CursorGrabError { NotSupported, OsCode(i32), Bridge(String) }` 与 `pub fn set_cursor_grab(window_id: i64, grab: bool) -> Result<(), CursorGrabError>`:NAPI 同步调 `getRealWindowId`(模式对齐 `is_window_maximized` 的 `Function<'_, i64, bool>` 单参直调);real_id ≤ 0 → `Err(Bridge)`;dlsym null / FFI 801 → `Err(NotSupported)`;FFI 201/1300003 → `Err(OsCode(code))`;锁定时 `isCursorFollowMovement=true`。**(2026-08-19 真机实测后修订)** unlock + 1300002 幂等化为 `Ok(())`(失焦自动解锁后重复解锁返回状态异常,对齐 Windows 语义;见 design.md D3 幂等解锁补充)

## 3. tao 接入

- [x] 3.1 `tao/src/platform_impl/ohos/mod.rs` 的 `set_cursor_grab(&self, grab: bool)` 由 `Err(NotSupported)` 改为调用 `openharmony_ability::window::set_cursor_grab(self.ohos_win_id(), grab)`:`Ok(())` → `Ok(())`;`Err(CursorGrabError::NotSupported)` → `Err(ExternalError::NotSupported(...))`(与旧行为一致);`Err(OsCode/Bridge)` → `Err(ExternalError::Os(os_error!(OsError)))` 并 log 具体错误码

## 4. 编译与冒烟验证

- [x] 4.1 `cargo check` 双目标验证:openharmony-ability 与 tao 在 host + `aarch64-unknown-linux-ohos` 下零 error(实测:tao host ✅ + tao ohos ✅ + ability ohos ✅;ability crate host 编译为既有失败项——lifecycle.rs 的 ohos-gated 函数,该 crate 本就仅支持 ohos 目标,非本次改动引入)
- [x] 4.2 ArkTS 有变更,全链重建:openharmony-ability `ohrs build --arch arm64` + pack 打 HAR,再 `cargo tauri ohos build` 重建 HAP
- [x] 4.3 真机 hilog 冒烟:设备安装后触发一次 setCursorGrab(经现有 TestRunner 按钮或 Window.svelte checkbox),hilog 预期出现错误码 201(NO_PERMISSION)——证明 dlsym 解析与 FFI 调用链路已通(权限 Phase 2 才声明);应用不崩溃、可继续操作(实测 2026-08-19 13:04 hilog:`[tao-ohos] set_cursor_grab(true) failed for window 0: window manager error code 201`,应用持续响应)
