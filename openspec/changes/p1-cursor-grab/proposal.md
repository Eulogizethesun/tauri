# Proposal: p1-cursor-grab

## Why

tao OHOS 平台的 `Window::set_cursor_grab` 目前返回 `NotSupportedError`,光标抓取是光标能力族(位置/可见性/图标/穿透)中唯一未实现的项。此前判定「OHOS 无指针锁定 API」系只 grep 了 ArkTS `.d.ts` 所致——实际上 OHOS 自 API 22 起在公开 NDK 中提供了 `OH_WindowManager_LockCursor`/`OH_WindowManager_UnlockCursor` C API(`libnative_window_manager.so` 公开导出,配套权限 `ohos.permission.LOCK_WINDOW_CURSOR` 为 normal 级 system_grant 开放权限)。Pointer-lock 类应用(游戏、画布交互)在 OHOS 桌面端(MateBook 等 2in1/PC 设备)需要该能力。

## What Changes

- **openharmony-ability(Rust)**:`crates/ability/src/window/mod.rs` 新增 `set_cursor_grab(window_id, grab)` —— 运行时 dlopen `libnative_window_manager.so` + dlsym 解析 `OH_WindowManager_LockCursor`/`UnlockCursor`(弱加载,API < 22 设备上 dlsym 为 null 时降级),先经 NAPI 同步查询 tao 窗口 ID → 真实 OHOS windowId,再 FFI 直调;错误码(201/801/1300002/1300003)映射为 napi Error。
- **openharmony-ability(ArkTS)**:`WindowManager.ets` 新增 `getRealWindowId(windowId): number`(复用 `getWindow()` + `getWindowProperties().id`),`ArkHelper.ets`/`type.ets` 同步注册 helper 属性。
- **tao**:`src/platform_impl/ohos/mod.rs` 的 `set_cursor_grab` 由 `Err(NotSupported)` 改为调用 openharmony-ability 封装,错误映射为 `ExternalError`;`isCursorFollowMovement` 固定传 `true`(光标限制在窗口内仍可移动,与 Windows ClipCursor 语义一致)。
- 不改 tauri / tauri-runtime-wry / wry:OHOS 构建下 `desktop` cfg 为 true,`set_cursor_grab` 插件命令链路已通,断点仅在 tao。
- 权限声明(module.json5)、真机测试与文档更新归 **Phase 2**(`p2-cursor-grab`),本 change 不涉及。

## Capabilities

### New Capabilities

- `cursor-grab`:OHOS 平台窗口光标抓取行为规范——锁定(confined 模式,跟随移动)、解锁、失焦自动解锁、API < 22 设备降级(NotSupported)、错误码映射。

### Modified Capabilities

(无——现有 specs 中无 cursor 相关 capability)

## Impact

- **tao**(`src/platform_impl/ohos/mod.rs`):1 个函数体改写;其他平台零影响。
- **openharmony-ability**:Rust `crates/ability/src/window/mod.rs` 新增函数与 FFI 声明;ArkTS 三文件(`WindowManager.ets` / `ArkHelper.ets` / `type.ets`)各加一个小方法/属性。修改 ArkTS 后需全链重建 HAR。
- **运行时依赖**:首次引入对 `libnative_window_manager.so` 的动态加载(不静态链接,规避 API < 22 设备加载期符号解析失败)。
- **上游同步**:tao / openharmony-ability 为独立仓库,改动需随各自 PR 流程同步。
- **验证**:`cargo check`(host + ohos target)+ 真机 hilog 冒烟(权限声明就位前,预期返回 NO_PERMISSION 201,可证明 FFI 链路通)。
