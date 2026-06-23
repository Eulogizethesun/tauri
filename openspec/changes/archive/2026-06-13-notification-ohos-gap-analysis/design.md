## Context

### 当前状态

`tauri-plugin-notification` v2.3.3 支持 Windows/macOS/Linux/Android/iOS 五个平台，架构为双路径：
- **desktop.rs**：使用 `notify-rust` crate 发送桌面通知，`Notification` 结构体持有 `AppHandle<R>`
- **mobile.rs**：使用 `PluginHandle` + `run_mobile_plugin` 桥接原生插件（Android Kotlin / iOS Swift），`Notification` 结构体持有 `PluginHandle<R>`

OHOS 完全未被考虑——没有 `target_env = "ohos"` 的 cfg 门控、没有 OHOS 依赖、没有 ArkTS 模块。

### 已适配插件的两种模式

通过对 6 个已适配插件的分析，OHOS 适配存在两种根本不同的模式：

| 维度 | 模式 A：Desktop 内联 | 模式 B：插件注册（Mobile 路由） |
|------|---------------------|-------------------------------|
| 代表插件 | clipboard, process, autostart | dialog |
| 核心思路 | OHOS 路由到 `desktop.rs`，内部 cfg 隔离 | OHOS 路由到 `mobile.rs`，通过 `register_ohos_plugin` 桥接 ArkTS |
| 适用场景 | Rust 侧可通过 TSFN 直接调用系统能力 | 必须在 ArkTS 侧实现完整逻辑 |
| build.rs | 无 `.ohos_path()` | 有 `.ohos_path("openharmony")` |
| cfg 门控 | `#[cfg(any(desktop, target_env = "ohos"))]` | `#[cfg(any(mobile, target_env = "ohos"))]` |
| 依赖 | `openharmony-ability`（直接 TSFN） | `tauri` with `wry`（PluginHandle 基础设施） |
| ArkTS 模块 | 不需要（TSFN 在 openharmony-ability 中） | 需要 `openharmony/` 完整 HAR 模块（oh-package.json5 + module.json5 + Plugin.ets + index.ets） |

### OHOS 通知 API

OHOS 使用 `notificationManager` from `@kit.NotificationKit`：
- `notificationManager.publish(request)` — 发布通知
- `notificationManager.cancel(id)` / `cancelAll()` — 取消通知
- `notificationManager.requestEnableNotification(context: UIAbilityContext)` — 请求权限（⚠️ 需要 `UIAbilityContext` 参数，且**仅首次调用弹窗**，用户拒绝后再调用返回错误码 1600004，需引导用户去设置页）
- `notificationManager.isNotificationEnabled(): Promise<boolean>` — 查询权限状态
- `notificationManager.addSlot(slotType: SlotType)` — 按类型创建渠道（系统默认配置）
- `notificationManager.removeSlot(slotType: SlotType)` — 按类型删除渠道
- `notificationManager.getSlots(): Promise<Array<NotificationSlot>>` — 查询所有渠道

**⚠️ 关键差异：OHOS 渠道模型与 Android 根本不同**
- OHOS 渠道按 `SlotType` 枚举标识（`SOCIAL_COMMUNICATION` / `SERVICE_INFORMATION` / `OTHER_TYPES` 等），**不是**自定义字符串 ID
- `addSlot` 只接受 `SlotType` 枚举，不支持设置名称、描述等自定义配置
- Tauri `Channel` 模型的 `id`/`name`/`description` 无法直接映射到 OHOS 系统层
- 需要在 ArkTS 侧维护一个本地映射表（channelId → SlotType），在 `publish` 时通过 `notificationSlotType` 字段指定渠道类型
- `NotificationSlot` 的 `lockscreenVisibility` 是预留能力，**暂不支持**
- 权限：`ohos.permission.PUBLISH_NOTIFICATION`（系统自动授予）
- 限制：每应用最多 24 条通知，发布速率 ≤ 10/秒

### 约束

- OHOS 的 `target_os` 是 `"linux"`，必须用 `not(target_env = "ohos")` 排除 Linux 专有依赖
- `notify-rust` 依赖 D-Bus 等 Linux 系统库，在 OHOS 上不可用
- OHOS Device Type（`OHOS_DEVICE_TYPE=mobile|desktop`）影响 `cfg(mobile)`/`cfg(desktop)` 的设置

## Goals / Non-Goals

**Goals:**
- `tauri-plugin-notification::init()` 在 OHOS Desktop 上能够顺利编译和调用
- 基本通知功能可用：title + body 的文本通知能正常弹出
- 权限管理可用：`request_permission` / `is_permission_granted` 正常工作
- 通知渠道管理可用：`create_channel` / `delete_channel` / `list_channels`
- 与 Windows/macOS 的 Rust 接口保持一致（`NotificationExt` trait、`NotificationBuilder`）
- 遵循已验证的 dialog 插件注册模式，保持架构一致性

**Non-Goals:**
- 定时通知（Schedule）— OHOS 的代理提醒 API（`reminderAgentManager`）需要额外权限和 AGC 审批，复杂度高
- 操作按钮（ActionType）— OHOS 的 `actionButtons` 支持有限（最多 2 个），且需要 WantAgent 配合
- 通知附件（Attachment）— OHOS 的图片通知使用 `NOTIFICATION_CONTENT_PICTURE` 类型，映射复杂
- Inbox lines 样式 — OHOS 无直接对应类型
- `getActive` / `getPending` — OHOS `notificationManager` 无直接查询 API，返回空数组即可
- 前端 JavaScript API 修改 — `init-iife.js` 的 polyfill 机制无需改动

## Decisions

### Decision 1：采用插件注册模式（模式 B），与 dialog 一致

**选择**：OHOS 路由到 `mobile.rs`，使用 `register_ohos_plugin` + ArkTS `NotificationPlugin`。

**理由**：
1. notification 的 `mobile.rs` 已使用 `PluginHandle` 模式，所有方法（`show`、`request_permission`、`cancel` 等）都通过 `run_mobile_plugin()` 调用。OHOS 只需加一个 `register_ohos_plugin` 注册即可复用全部方法，无需重写 Rust 侧代码。
2. `desktop.rs` 只有 3 个方法（`builder()`、`request_permission()`、`permission_state()`），而 `mobile.rs` 有 12+ 个方法（含 `cancel()`、`active()`、`pending()`、`register_action_types()`、`create_channel()` 等）。如果走 desktop 路径，所有 mobile-only 方法都得在 desktop.rs 里写 stub，工作量大且不合理。
3. OHOS 通知 API（`notificationManager.publish()`）是纯 ArkTS API，不像 clipboard 那样有简单的 TSFN 单函数调用，需要一个完整的 ArkTS HAR 模块（Plugin.ets 实现 NotificationPlugin 类）来处理命令分发。

**替代方案（被排除）**：
- **Desktop 内联模式**（如 clipboard）：在 `desktop.rs` 里加 OHOS cfg 分支 + `openharmony-ability` TSFN。但 notification 的命令数量多、接口差异大，会导致 `desktop.rs` 膨胀且难以维护。
- **独立 ohos.rs 模块**（如 process/updater）：notification 的 `init()` 走 setup 闭包注册 `PluginHandle`，不适合拆出独立模块。

### Decision 2：cfg 门控使用 dialog 的精确模式

**选择**：
```rust
#[cfg(all(desktop, not(target_env = "ohos")))]  // 真桌面
#[cfg(any(mobile, target_env = "ohos"))]          // 移动 + OHOS
```

**理由**：无论 `OHOS_DEVICE_TYPE` 是 `mobile` 还是 `desktop`，`target_env = "ohos"` 始终成立。使用 `any(mobile, target_env = "ohos")` 确保 OHOS 无论何种设备类型都走 mobile 路径。

### Decision 3：build.rs 使用 `tauri_plugin::Builder::ohos_path()`，不写自定义 alias

**选择**：直接调用 `.ohos_path("openharmony")`，不添加 updater/shell 那样的自定义 desktop/mobile alias 逻辑。

**理由**：`tauri_plugin::Builder::ohos_path()` 内部已处理 `OHOS_DEVICE_TYPE` 检测。配合 Decision 2 的 cfg 门控，不需要额外的 alias 逻辑。updater/shell 使用自定义 alias 是因为它们没有 `.ohos_path()`（它们不需要 ArkTS 模块）。

### Decision 4：Channel 方法从 Android-only 扩展到 OHOS（降级模式）

**选择**：`create_channel`、`delete_channel`、`list_channels` 的 cfg 从 `#[cfg(target_os = "android")]` 改为 `#[cfg(any(target_os = "android", target_env = "ohos"))]`。

**理由**：OHOS 通知需要指定渠道类型（`SlotType`），但 OHOS 的渠道模型与 Android 根本不同：
- **Android**：`createNotificationChannel(channel)` 接受自定义 ID、名称、描述、重要性等完整配置
- **OHOS**：`addSlot(slotType)` 只接受 `SlotType` 枚举（如 `SOCIAL_COMMUNICATION`），不支持自定义 ID/名称

**OHOS 降级策略**：
- `createChannel`：维护本地映射表 `{ channelId → SlotType }`，调用 `addSlot(mappedSlotType)`。`name`/`description` 仅存在本地映射表中
- `deleteChannel`：调用 `removeSlot(mappedSlotType)`
- `listChannels`：调用 `getSlots()` 获取系统渠道列表，与本地映射表合并返回
- `show` 时：通过 `NotificationRequest.notificationSlotType` 指定渠道类型

### Decision 5：Unsupported 操作返回空数组而非错误

**选择**：`getActive` 和 `getPending` 在 ArkTS 侧返回空数组 `[]`，而不是抛错。

**理由**：OHOS `notificationManager` 没有查询已发布通知或待发布通知的 API。返回空数组使前端代码不会因 `undefined`/`null` 报错，保持与 Android/iOS 的接口兼容性。参考 clipboard 插件对不支持操作的错误返回模式，但 notification 场景下空数组是更友好的降级。

## Risks / Trade-offs

### Risk 1：NotificationData 与 NotificationRequest 字段映射不完整
`NotificationData` 有 20 个字段（large_body、inbox_lines、action_type_id、attachments 等），OHOS `NotificationRequest` 的结构不同。部分字段可能无法映射。
→ **缓解**：MVP 阶段只映射 core 字段（id、title、body、summary），其他字段在 ArkTS 侧忽略并用 `console.warn` 输出。后续按需扩展。`sound` 字段在 OHOS 上需要是 `resources/rawfile` 下的文件名或沙箱 URI 格式，不支持任意路径字符串。

### Risk 2：Channel 结构体与 OHOS 渠道模型的根本差异
Tauri 的 `Channel` 结构体使用 Android 概念（自定义 `id`、`name`、`description`、`Importance` 枚举、`Visibility` 枚举），OHOS 的渠道模型完全不同：
- OHOS 渠道按 `SlotType` 枚举标识，**没有自定义 ID/名称**
- `addSlot(SlotType)` 不支持设置名称/描述
- `NotificationSlot.lockscreenVisibility` 是预留能力，暂不支持
- `NotificationSlot` 的 `type` 字段已从 API 11 废弃，应使用 `notificationType`

→ **缓解**：在 ArkTS 侧维护本地 `Map<channelId, { slotType, name, description, importance }>` 映射表。`createChannel` 调用 `addSlot` 创建系统渠道并存储完整配置到本地。`show` 时从本地表查找对应的 `SlotType` 设置到 `NotificationRequest.notificationSlotType`。`listChannels` 将系统返回的 `NotificationSlot[]` 与本地表合并返回。

⚠️ **限制**：本地映射表仅存内存（`Map` 对象），app 重启后丢失。这意味着 `createChannel` 创建的渠道名称/描述在重启后不可恢复（但 OHOS 系统侧的 SlotType 仍然存在）。如果需要持久化，可使用 `Preferences`（轻量级键值对存储）序列化映射表，但 MVP 阶段暂不实现。

### Risk 3：通知权限模型差异
Desktop（Win/Mac/Linux）的 `request_permission` 始终返回 `Granted`。OHOS 需要调用 `requestEnableNotification(context)` 弹出系统对话框。

⚠️ **关键行为差异**：
- `requestEnableNotification` 需要传入 `UIAbilityContext`（从 `NativeAbility.ets` 获取）
- **仅首次调用弹窗**：用户拒绝后再次调用不会弹窗，直接返回错误码 `1600004`
- 用户拒绝后需引导去设置页：可调用 `openNotificationSettingsWithResult(context)` 打开通知管理半模态页面

→ **缓解**：ArkTS 侧实现中，先调用 `isNotificationEnabled()` 检查状态。如果已授权返回 `granted`；如果未授权调用 `requestEnableNotification(context)`；如果返回 1600004 错误码则返回 `denied` 并 `console.warn` 提示用户去设置页开启。

### Risk 4：init-iife.js 的 window.Notification polyfill
polyfill 会根据平台判断是否检查 permission 状态。OHOS 不是 Windows，替换结果为 `"false"`，逻辑正确但需验证。
→ **缓解**：polyfill 的 permission 检查逻辑在 mobile 模式下会通过 IPC 查询，与 Android 一致。构建后在 OHOS 设备上验证。
