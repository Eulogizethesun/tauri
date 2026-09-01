# Spec: Tray 预定义菜单项目标窗口

## 行为需求

### REQ-1: launchType 为 singleton
主 entry ability（entry_desktop / entry_mobile）的 `module.json5` 中 `launchType` 必须为 `"singleton"`，使得任何 `startAbility(EntryAbility)` 复用已有 UIAbility 实例并回调 `onNewWant`，而非创建新实例 + 新窗口。

**验收**：
- `tauri ohos init` 生成的 module.json5 包含 `"launchType": "singleton"`。
- 左键托盘图标（触发 `iconClickHandler` 的 `startAbility`）不弹出第二个主窗口，已有窗口被还原到前台。
- examples/api 已生成的 `gen/ohos/entry_*/src/main/module.json5` 值为 `singleton`（跨 build 存活）。

### REQ-2: tray 右键菜单预定义项即时作用于目标窗口
状态栏托盘右键菜单点击预定义项（Minimize/Maximize/Fullscreen/Hide/CloseWindow）时，操作立即作用于主窗口（或最后触摸窗口），不得：
- 弹出新窗口；
- 延迟执行（依赖系统前台切换事件消费）；
- 操作落到非目标窗口。

**验收**（对应 manual_tests.md #20）：
- Minimize：主窗口最小化到任务栏，点击任务栏图标恢复，无新窗口出现。
- Maximize：主窗口铺满全屏。
- Fullscreen：进入沉浸式全屏，Esc 退出。
- Hide：主窗口隐藏，从任务栏点击恢复。
- CloseWindow：主窗口关闭（hideAbility 语义）。

### REQ-3: menubar 路径不受影响
`MenuPlugin.execute-predefined`（menubar 路径）的 `setPendingAction` 延迟行为保持不变。menubar 预定义项用例（#43 Copy / #45 Fullscreen / #55 Hide）行为不回归。

## API 映射

| Tauri API | OHOS 实现 | 说明 |
|-----------|-----------|------|
| `PredefinedMenuItem::minimize/maximize/fullscreen/hide/close_window` | `executor.execute(actionType)` via `ohos.statusbar/execute-predefined`（tray 路径，即时执行） | tray 右键菜单项点击 |
| `startAbility(EntryAbility)` | `launchType: singleton` → `onNewWant` 复用实例 | 不再 spawn 新实例 |

## 边界情况

- **app 已后台**：tray 右键 Minimize → `executor.execute('minimize')` 立即执行，minimize 已后台窗口为 no-op，不报错。
- **多窗口**：tray 预定义项依赖 `getTargetWindow(undefined)` Strategy 2（`getUserInteractedWindow`，onTouch 最后触摸窗口）；多窗口场景非本修复范围，保持现状。
- **notify_only 失效（假设性）**：若某 OHOS 版本不 honors `notifyOnly`，菜单点击会 `startAbility` —— singleton 模式下走 `onNewWant` 复用实例，不 spawn 新窗口，安全降级。

## 测试用例设计

### auto（自动断言）
- 模板/生成文件断言：`entry_desktop/module.json5` 与 `entry_mobile/module.json5` 的 `launchType` 字段值为 `"singleton"`（单元测试解析 JSON）。

### side-effect
- tray 右键 Minimize 后 `window.is_minimized()` 返回 true（主窗口）。
- tray 右键 Minimize 期间窗口列表长度不变（无新窗口创建）。

### manual（人工确认）
- manual_tests.md #20 全预定义项视觉行为（最小化/最大化/全屏/隐藏/关闭主窗口）。
- 左键托盘图标不弹出第二个窗口。
- menubar 预定义项 #43/#45/#55 不回归。
