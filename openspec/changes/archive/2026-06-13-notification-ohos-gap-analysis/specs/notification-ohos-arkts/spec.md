## ADDED Requirements

### Requirement: NotificationPlugin SHALL be a complete HAR module
The notification plugin's ArkTS implementation SHALL be a complete HarmonyOS Archive (HAR) module at `openharmony/`, following the exact pattern established by the dialog plugin. The module SHALL contain these files:

| File | Purpose |
|------|---------|
| `oh-package.json5` | Package metadata: `"name": "@tauri/plugin-notification"`, `"type": "module"`, depends on `"@tauri/app": "file:../tauri"` |
| `build-profile.json5` | Build config with `apiType: "stageMode"`, obfuscation disabled |
| `hvigorfile.ts` | Build script: `import { harTasks } from '@ohos/hvigor-ohos-plugin'; export default { system: harTasks, plugins: [] }` |
| `src/main/module.json5` | Module declaration: `"name": "notification"`, `"type": "har"`, `"deviceTypes": ["default", "tablet", "2in1"]` |
| `src/main/ets/index.ets` | Re-export: `export { NotificationPlugin as default } from './Plugin';` |
| `src/main/ets/Plugin.ets` | Full `NotificationPlugin` class implementation |

**⚠️ Naming**: The plugin implementation file MUST be named `Plugin.ets` (matching the dialog convention). The class inside is named `NotificationPlugin`.

**Import pattern**: `Plugin` and `Invoke` SHALL be imported from `@tauri/app` (the tauri core HAR package), NOT from a relative `.tauri/tauri-api/` path:
```typescript
import { Plugin, Invoke } from '@tauri/app';
```

The `NotificationPlugin` class SHALL extend `Plugin` and implement `getCommands()` returning `Map<string, (invoke: Invoke) => void>`. Handler functions are synchronous (`void` return) — async operations SHALL be delegated to private async methods in a fire-and-forget pattern (matching the dialog plugin pattern).

#### Scenario: Plugin class registered by PluginManager
- **WHEN** the ArkTS PluginManager loads the notification plugin
- **THEN** `NotificationPlugin.getCommands()` SHALL return handlers for: `show`, `batch`, `cancel`, `removeActive`, `getActive`, `getPending`, `requestPermissions`, `checkPermissions`, `createChannel`, `deleteChannel`, `listChannels`, `registerActionTypes`

**Note on `permissionState`**: This is NOT a separate native command. The Rust `permission_state()` method internally calls `run_mobile_plugin("checkPermissions", ())` — the same command as `checkPermissions`. No separate handler is needed.

### Requirement: show command SHALL publish notification via notificationManager
The `show` command handler SHALL construct an OHOS `notificationManager.NotificationRequest` from the `NotificationData` payload and call `notificationManager.publish(request)`.

Core field mapping:
- `id` → `request.id`
- `title` → `content.normal.title`
- `body` → `content.normal.text`
- `summary` → `content.normal.additionalText`
- `auto_cancel` → `request.tapDismissed` (inverted)
- `channel_id` → looked up from local mapping table → `request.notificationSlotType`
- `sound` → `request.sound` (must be a file name in `resources/rawfile` or sandbox URI `uri::{fileUri}`; log `console.warn` if format is unsupported)

#### Scenario: Basic text notification published
- **WHEN** `show` is called with `{ title: "Hello", body: "World" }`
- **THEN** a notification SHALL be published via `notificationManager.publish()` with `ContentType.NOTIFICATION_CONTENT_BASIC_TEXT` and the given title and body

#### Scenario: Long text notification when large_body present
- **WHEN** `show` is called with `{ title: "Hello", body: "World", large_body: "Extended text..." }`
- **THEN** a notification SHALL be published with `ContentType.NOTIFICATION_CONTENT_LONG_TEXT`

#### Scenario: Notification with channel_id uses mapped SlotType
- **WHEN** `show` is called with `{ title: "Hello", channelId: "my_channel" }` and "my_channel" exists in the local mapping table
- **THEN** the `NotificationRequest.notificationSlotType` SHALL be set to the mapped `SlotType` from the local table

#### Scenario: Show command returns notification id
- **WHEN** `show` succeeds
- **THEN** the handler SHALL call `invoke.resolve(JSON.stringify(id))` with the notification id

#### Scenario: Show command rejects on publish failure
- **WHEN** `notificationManager.publish()` throws (e.g., rate limit exceeded, error code `1600009`)
- **THEN** the handler SHALL reject with the error message

### Requirement: cancel command SHALL cancel notification by id
The `cancel` command handler SHALL call `notificationManager.cancel(id)` for each notification id in the payload.

#### Scenario: Cancel specific notifications
- **WHEN** `cancel` is called with `{ notifications: [1, 2, 3] }`
- **THEN** `notificationManager.cancel()` SHALL be called for each id

#### Scenario: Cancel all notifications
- **WHEN** `cancel` is called with no arguments
- **THEN** `notificationManager.cancelAll()` SHALL be called

### Requirement: removeActive command SHALL cancel active notifications
The `removeActive` command handler SHALL call `notificationManager.cancel(id)` for each notification id, same as `cancel`.

#### Scenario: Remove specific active notifications
- **WHEN** `removeActive` is called with `{ notifications: [{ id: 1 }] }`
- **THEN** `notificationManager.cancel(1)` SHALL be called

### Requirement: requestPermissions command SHALL prompt user with context
The `requestPermissions` command handler SHALL:
1. First call `notificationManager.isNotificationEnabled()` to check current state
2. If already enabled, return `{ permissionState: "granted" }` immediately
3. If not enabled, call `notificationManager.requestEnableNotification(context)` with a valid `UIAbilityContext`
4. Handle error code `1600004` (user already denied) by returning `{ permissionState: "denied" }` and logging a warning via `console.warn`

⚠️ **OHOS behavior note**: `requestEnableNotification` only shows the system dialog on the **first call**. Subsequent calls after user denial return error code `1600004` without showing the dialog. The handler MUST NOT assume the dialog will appear every time.

#### Scenario: Notifications already enabled
- **WHEN** `requestPermissions` is called and `isNotificationEnabled()` returns `true`
- **THEN** the handler SHALL call `invoke.resolve(JSON.stringify({ permissionState: "granted" }))` without showing any dialog

#### Scenario: User grants notification permission on first prompt
- **WHEN** `requestPermissions` is called, notifications are not yet enabled, and user taps "Allow"
- **THEN** the handler SHALL call `invoke.resolve(JSON.stringify({ permissionState: "granted" }))`

#### Scenario: User denies notification permission
- **WHEN** `requestPermissions` is called and user taps "Deny"
- **THEN** the handler SHALL call `invoke.resolve(JSON.stringify({ permissionState: "denied" }))`

#### Scenario: Permission already denied (error 1600004)
- **WHEN** `requestPermissions` is called, user previously denied, and `requestEnableNotification` returns error `1600004`
- **THEN** the handler SHALL call `invoke.resolve(JSON.stringify({ permissionState: "denied" }))` and output a `console.warn` suggesting the user enable notifications in system settings

### Requirement: checkPermissions command SHALL query permission state
The `checkPermissions` command handler SHALL call `notificationManager.isNotificationEnabled(): Promise<boolean>` and return the result as a `PermissionState`.

#### Scenario: Notifications are enabled
- **WHEN** `checkPermissions` is called and `isNotificationEnabled()` returns `true`
- **THEN** the handler SHALL call `invoke.resolve(JSON.stringify({ permissionState: "granted" }))`

#### Scenario: Notifications are disabled
- **WHEN** `checkPermissions` is called and `isNotificationEnabled()` returns `false`
- **THEN** the handler SHALL call `invoke.resolve(JSON.stringify({ permissionState: "denied" }))`

### Requirement: createChannel command SHALL create notification slot with local mapping
The `createChannel` command handler SHALL maintain a local `Map<channelId, ChannelConfig>` to store Tauri `Channel` configuration, and create the corresponding OHOS notification slot via `notificationManager.addSlot(slotType)`.

**⚠️ OHOS channel model difference**: OHOS channels are identified by `SlotType` enum (e.g., `SOCIAL_COMMUNICATION`, `SERVICE_INFORMATION`, `OTHER_TYPES`), NOT by custom string IDs. The `addSlot(SlotType)` API does NOT accept custom names, descriptions, or importance levels. The local mapping table bridges this gap.

**Importance → SlotType mapping** (default mapping, configurable in future):
- `Importance.High` (4) → `SlotType.SOCIAL_COMMUNICATION`
- `Importance.Default` (3) → `SlotType.SERVICE_INFORMATION`
- `Importance.Low` (2) → `SlotType.CONTENT_INFORMATION`
- `Importance.Min` (1) → `SlotType.OTHER_TYPES`
- `Importance.None` (0) → `SlotType.OTHER_TYPES`

**Note**: `visibility` → `lockScreenVisibility` is a reserved capability in OHOS and **not yet supported**, so this mapping is deferred.

#### Scenario: Create notification channel
- **WHEN** `createChannel` is called with a valid Channel payload (id, name, importance, etc.)
- **THEN** the handler SHALL map `importance` to `SlotType`, call `notificationManager.addSlot(mappedSlotType)`, and store the full `Channel` config in the local mapping table keyed by `channelId`

#### Scenario: Create duplicate channel
- **WHEN** `createChannel` is called with a `channelId` that already exists in the local mapping
- **THEN** the handler SHALL update the local mapping and call `addSlot` again (OHOS silently ignores duplicate slot types)

### Requirement: deleteChannel command SHALL remove notification slot
The `deleteChannel` command handler SHALL look up the `channelId` in the local mapping table, call `notificationManager.removeSlot(mappedSlotType)`, and remove the entry from the local table.

#### Scenario: Delete existing channel
- **WHEN** `deleteChannel` is called with `{ id: "my_channel" }` and "my_channel" exists in the local mapping
- **THEN** the handler SHALL call `notificationManager.removeSlot(mappedSlotType)` and remove the entry from the local mapping table

#### Scenario: Delete non-existent channel
- **WHEN** `deleteChannel` is called with a `channelId` not in the local mapping
- **THEN** the handler SHALL resolve without error (idempotent)

### Requirement: listChannels command SHALL return merged channel list
The `listChannels` command handler SHALL call `notificationManager.getSlots()` and merge the results with the local mapping table to produce Tauri `Channel[]` format.

#### Scenario: List all notification channels
- **WHEN** `listChannels` is called
- **THEN** the handler SHALL call `notificationManager.getSlots()`, merge with the local mapping table (to include `id`, `name`, `description`), and call `invoke.resolve(JSON.stringify(channels))` with the result in Tauri `Channel[]` format

### Requirement: Unsupported operations SHALL degrade gracefully
Operations that have no OHOS equivalent (`getActive`, `getPending`, `registerActionTypes`) SHALL return sensible defaults rather than throw errors. The `batch` command SHALL iterate over each `NotificationData` and call `publish()` for each.

#### Scenario: getActive returns empty array
- **WHEN** `getActive` is called
- **THEN** the handler SHALL resolve with `[]` (empty array)

#### Scenario: getPending returns empty array
- **WHEN** `getPending` is called
- **THEN** the handler SHALL resolve with `[]` (empty array)

#### Scenario: registerActionTypes is a no-op
- **WHEN** `registerActionTypes` is called
- **THEN** the handler SHALL resolve without error (no-op)

#### Scenario: batch publishes multiple notifications
- **WHEN** `batch` is called with an array of `NotificationData`
- **THEN** the handler SHALL iterate and call `notificationManager.publish()` for each entry, same as `show` but in a loop
