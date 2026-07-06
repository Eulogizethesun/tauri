## 1. 插件 Crate 骨架

- [x] 1.1 创建 `plugins-workspace/plugins/ohos-permissions/Cargo.toml`（name=`tauri-plugin-ohos-permissions`, links, dependencies: tauri v2 + serde + thiserror, build-dependencies: tauri-plugin v2 with `build` feature）
- [x] 1.2 创建 `plugins-workspace/plugins/ohos-permissions/build.rs`（注册 4 个 commands: check/request_camera/microphone_permission, ohos_path="openharmony"）
- [x] 1.3 创建 `plugins-workspace/plugins/ohos-permissions/src/lib.rs`（`init()` 函数，Builder::new("ohos-permissions"), generate_handler! 注册 commands, setup 中初始化 PluginHandle）
- [x] 1.4 创建 `plugins-workspace/plugins/ohos-permissions/src/commands/mod.rs`（聚合 camera 和 microphone 模块）

## 2. Rust Commands 实现

- [x] 2.1 创建 `plugins-workspace/plugins/ohos-permissions/src/commands/camera.rs`（`check_camera_permission` 通过 PluginHandle.run_mobile_plugin → bool, `request_camera_permission` → Result<(), String>; 非 OHOS 降级 true/Ok(())）
- [x] 2.2 创建 `plugins-workspace/plugins/ohos-permissions/src/commands/microphone.rs`（对称于 camera.rs, 使用 `ohos.permission.MICROPHONE`）

## 3. ArkTS Plugin.ets 模板

- [x] 3.1 创建 `tauri/crates/tauri-cli/templates/mobile/open-harmony/ohos-permissions/src/main/ets/Plugin.ets`（`OhosPermissionsPlugin extends Plugin`, `getCommands()` 注册 4 个 handler, 使用 `abilityAccessCtrl.createAtManager()` + `checkAccessToken` + `requestPermissionsFromUser`）
- [x] 3.2 Plugin.ets 中实现 `getAccessTokenId(): Promise<number>` 方法：通过 `bundleManager.getBundleInfoForSelf(bundleManager.BundleFlag.GET_BUNDLE_INFO_WITH_APPLICATION)` 获取 `bundleInfo.appInfo.accessTokenId`
- [x] 3.3 Plugin.ets 中实现 `checkPermission(permissionName)` 通用方法：调用 `getAccessTokenId()` → `atManager.checkAccessToken(tokenId, permissionName)` → 比较 `GrantStatus.PERMISSION_GRANTED` → 返回 boolean
- [x] 3.4 Plugin.ets 中实现 `requestPermission(invoke, permissionName)` 通用方法（三步流程）：① 先调 `checkPermission` 如果已授权直接 resolve；② 未授权则调 `atManager.requestPermissionsFromUser(this.context, [permissionName])`，检查 `authResults[0]`；③ 如果 denied 则调 `atManager.requestPermissionOnSetting(this.context, [permissionName])` 引导用户到设置页面
- [x] 3.5 在 tauri-cli 模板中添加 `module.json5` 权限声明：在 `tauri/crates/tauri-cli/templates/mobile/open-harmony/ohos-permissions/src/main/module.json5` 的 `requestPermissions` 中预置 `ohos.permission.CAMERA`（reason + usedScene）和 `ohos.permission.MICROPHONE`（reason + usedScene），确保 `tauri ohos init` 后自动生成

## 4. Guest JS 绑定

- [x] 4.1 创建 `plugins-workspace/plugins/ohos-permissions/guest-js/index.ts`（导出 4 个函数: checkCameraPermission, requestCameraPermission, checkMicrophonePermission, requestMicrophonePermission, 通过 invoke 调用对应 Rust commands）
- [x] 4.2 创建 `plugins-workspace/plugins/ohos-permissions/package.json`（name=`@tauri-apps/plugin-ohos-permissions`, main=`dist-js/index.js`）
- [x] 4.3 创建 `plugins-workspace/plugins/ohos-permissions/rollup.config.js`（打包 guest-js 为 dist-js）
- [x] 4.4 创建 `plugins-workspace/plugins/ohos-permissions/tsconfig.json`

## 5. ACL 权限声明

- [x] 5.1 创建 `plugins-workspace/plugins/ohos-permissions/permissions/default.toml`（allow 4 个 command 权限: allow-check-camera-permission, allow-request-camera-permission, allow-check-microphone-permission, allow-request-microphone-permission）

## 6. 集成到 examples/api

- [x] 6.1 修改 `tauri/examples/api/src-tauri/Cargo.toml`：添加 `tauri-plugin-ohos-permissions` 依赖（path 指向 plugins-workspace）
- [x] 6.2 修改 `tauri/examples/api/package.json`：添加 `@tauri-apps/plugin-ohos-permissions` 依赖（file: 指向 plugins-workspace/plugins/ohos-permissions）
- [x] 6.3 修改 `tauri/examples/api/src-tauri/src/lib.rs`：注册 `.plugin(tauri_plugin_ohos_permissions::init())`
- [x] 6.4 构建 plugins-workspace（`pnpm build`）确保 JS dist 生成

## 7. 验证

- [x] 7.1 在 OHOS 设备上构建部署（ohos-build skill），确认编译通过
- [x] 7.2 手动测试 check_camera_permission 返回 false（首次未授权）
- [x] 7.3 手动测试 request_camera_permission 弹出系统授权弹窗
- [x] 7.4 授权后 check_camera_permission 返回 true
- [x] 7.5 对 microphone 重复 7.2-7.4 验证
- [x] 7.6 验证非 OHOS 平台（Windows）check 返回 true, request 为空操作

## 8. 辅助功能 stub（D9）

- [x] 8.1 创建 `plugins-workspace/plugins/ohos-permissions/src/commands/accessibility.rs`（check → false, request → Ok(())）
- [x] 8.2 更新 `src/commands/mod.rs` 添加 `mod accessibility` + `pub use`
- [x] 8.3 更新 `build.rs` 注册 `check_accessibility_permission` + `request_accessibility_permission`
- [x] 8.4 更新 `src/lib.rs` generate_handler 注册
- [x] 8.5 更新 `guest-js/index.ts` 添加 `checkAccessibilityPermission` + `requestAccessibilityPermission`
- [x] 8.6 更新 `permissions/default.toml` 添加 `allow-check-accessibility-permission` + `allow-request-accessibility-permission`
- [x] 8.7 在 `plugins.ts` 添加 auto 测试用例（check→false, request→noop）
- [x] 8.8 构建部署并验证测试通过
