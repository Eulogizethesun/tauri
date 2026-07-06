## Why

OHOS 平台缺少权限管理插件，无法在 Tauri 应用中检查和请求系统权限（Camera、Microphone 等）。macOS 平台已有 `tauri-plugin-macos-permissions` 提供 6 类权限的 check/request 接口，OHOS 需要对等的实现以保持跨平台 API 一致性。本 Phase 聚焦 `user_grant` 类权限（Camera/Microphone），搭建完整插件骨架。

## What Changes

- **新建 `tauri-plugin-ohos-permissions` crate**：在 `plugins-workspace/plugins/ohos-permissions/` 下创建完整的 Tauri 插件
- **注册 4 个 IPC commands**：`check_camera_permission`、`request_camera_permission`、`check_microphone_permission`、`request_microphone_permission`
- **ArkTS 原生实现**：在 `tauri-cli/templates/mobile/open-harmony/ohos-permissions/` 下创建 `Plugin.ets`，使用 `abilityAccessCtrl` API 实现权限检查和申请
- **Guest JS 绑定**：`guest-js/index.ts` 提供 4 个 TypeScript API 函数
- **ACL 权限声明**：`permissions/default.toml` 声明 4 个 allow-* 权限
- **集成到 examples/api**：Cargo.toml + package.json 添加依赖，前端测试覆盖

## Capabilities

### New Capabilities

- `ohos-permissions-camera`: Camera 权限的 check/request 实现，包括 Rust commands、ArkTS Plugin.ets handler、guest-js API
- `ohos-permissions-microphone`: Microphone 权限的 check/request 实现，架构与 Camera 对称

### Modified Capabilities

（无修改现有 spec）

## Impact

- **新增 crate**：`tauri-plugin-ohos-permissions`（plugins-workspace）
- **新增模板**：`tauri/crates/tauri-cli/templates/mobile/open-harmony/ohos-permissions/`（ArkTS Plugin.ets）
- **修改文件**：`examples/api/src-tauri/Cargo.toml`（添加依赖）、`examples/api/package.json`（添加 JS 依赖）
- **依赖**：`tauri` v2、`tauri-plugin` v2（build）、`@tauri-apps/api`（JS）
- **OHOS API**：`abilityAccessCtrl.createAtManager()` / `checkAccessToken()` / `requestPermissionsFromUser()`（`@kit.AbilityKit`，API 12+）
- **权限声明**：`ohos.permission.CAMERA`、`ohos.permission.MICROPHONE`（需写入 `module.json5` 的 `requestPermissions`）
