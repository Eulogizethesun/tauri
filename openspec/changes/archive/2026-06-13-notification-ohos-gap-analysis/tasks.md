## 1. Rust 侧编译打通（notification-ohos-init）

- [x] 1.1 `build.rs`: 添加 `.ohos_path("openharmony")` 到 `tauri_plugin::Builder` 链
- [x] 1.2 `Cargo.toml`: 在 `notify-rust` 依赖的 cfg target 中添加 `not(target_env = "ohos")` 排除
- [x] 1.3 `Cargo.toml`: 新增 `[target.'cfg(target_env = "ohos")'.dependencies]` 段，声明 `tauri = { workspace = true, features = ["wry"] }`
- [x] 1.4 `Cargo.toml`: 在 `[package.metadata.platforms.support]` 中添加 `ohos = { level = "partial", notes = "..." }`
- [x] 1.5 `src/lib.rs`: 将 6 处 `#[cfg(desktop)]` 改为 `#[cfg(all(desktop, not(target_env = "ohos")))]`
- [x] 1.6 `src/lib.rs`: 将 6 处 `#[cfg(mobile)]` 改为 `#[cfg(any(mobile, target_env = "ohos"))]`
- [x] 1.7 `src/mobile.rs`: 添加 `#[cfg(target_env = "ohos")] const PLUGIN_IDENTIFIER: &str = "@tauri/plugin-notification";`
- [x] 1.8 `src/mobile.rs`: 在 `init()` 中添加 `#[cfg(target_env = "ohos")] let handle = api.register_ohos_plugin(PLUGIN_IDENTIFIER, "NotificationPlugin")?;`
- [x] 1.9 `src/mobile.rs`: 将 `create_channel`、`delete_channel`、`list_channels` 的 cfg 从 `target_os = "android"` 扩展为 `any(target_os = "android", target_env = "ohos")`

## 2. ArkTS 侧通知实现（notification-ohos-arkts）

- [x] 2.1 创建 `openharmony/` HAR 模块骨架：`oh-package.json5`（name: `@tauri/plugin-notification`，type: module，依赖 `@tauri/app`）、`build-profile.json5`（stageMode）、`hvigorfile.ts`（harTasks）、`src/main/module.json5`（type: har）、`src/main/ets/index.ets`（`export { NotificationPlugin as default } from './Plugin'`）
- [x] 2.2 创建 `openharmony/src/main/ets/Plugin.ets`，实现 `NotificationPlugin extends Plugin`，`getCommands()` 注册 12 个命令，handler 为同步 `(invoke: Invoke) => void`，async 操作委托给 private async 方法
- [x] 2.3 实现 `show` 命令：`NotificationData` → `notificationManager.NotificationRequest` 映射，调用 `notificationManager.publish()`；处理 `channelId` → `SlotType` 查找、`sound` 格式校验、`large_body` → `LONG_TEXT` 样式切换；成功时 `invoke.resolve(JSON.stringify(id))`
- [x] 2.4 实现 `cancel` / `removeActive` 命令：解析 id 列表，调用 `notificationManager.cancel(id)` 或 `cancelAll()`
- [x] 2.5 实现 `requestPermissions` / `checkPermissions` 命令：先 `isNotificationEnabled()` 检查状态，再 `requestEnableNotification()` 请求权限，处理 1600004 错误码；返回 `invoke.resolve(JSON.stringify({ permissionState: "granted"/"denied" }))`
- [x] 2.6 实现本地渠道映射表 `Map<channelId, ChannelConfig>`（内存，不持久化），以及 `createChannel`（`addSlot` + 本地存储）、`deleteChannel`（`removeSlot` + 本地删除）、`listChannels`（`getSlots` + 本地合并 → `JSON.stringify`）命令
- [x] 2.7 实现 `batch` 命令（循环 publish）和 unsupported 操作的优雅降级（`getActive`/`getPending` 返回 `JSON.stringify([])`，`registerActionTypes` 为 no-op）

## 3. 验证

- [x] 3.1 OHOS Desktop 编译验证 — ✅ 编译通过，无错误无警告
- [x] 3.2 构建 HAP 并安装到 OHOS 设备 — ✅ BUILD SUCCESSFUL，安装启动成功
- [x] 3.3 端到端验证：195 个测试中 194 通过，1 个预存失败（clipboard.writeText）— ✅ 零回归
- [x] 3.4 notification 自动测试（8/8 通过）：
  - isPermissionGranted ✅ — 权限查询返回 boolean
  - requestPermission ✅ — 返回 granted/denied/default
  - sendNotification ✅ — 发送基本文本通知
  - sendWithChannel ✅ — 创建渠道后通过 channelId 发送通知
  - createChannel+channels ✅ — 创建渠道 + 查询渠道列表
  - removeChannel ✅ — 创建后删除渠道
  - cancel+cancelAll ✅ — 取消通知（含不存在通知的容错）
  - pending+active ✅ — 查询待发送/活跃通知（OHOS 返回空数组）
- [x] 3.5 手动测试：用户已在设备上确认通知弹窗和权限请求正常工作 — ✅
