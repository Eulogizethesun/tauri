# Design: Tray 预定义菜单项目标窗口错误修复

## 1. Context

manual_tests.md 用例 #20（T0）失败：状态栏托盘右键菜单点击预定义项（Minimize/Maximize/Fullscreen/Hide/Close）会弹出一个新窗口，操作只作用于弹窗而非主窗口。

涉及两条独立缺陷链，叠加产生现象：
- `launchType: "standard"` 让任何 `startAbility(EntryAbility)` spawn 新实例 + 新窗口。
- tray 路径 `execute-predefined` 的延迟执行前提不成立，导致 action 落到杂散实例或被丢弃。

## 2. 调用链（tray 右键菜单预定义项点击）

```
用户右键托盘图标 → 系统 statusBarManager 显示上下文菜单（菜单项 notify_only:true + menuCode）
  → 用户点击 Minimize
  → 系统触发 'rightMenuClick'（NOT startAbility，因 notify_only:true）
  → StatusBarUtils.menuClickHandler (package/.../helper/StatusBarUtils.ets:50)
    → BridgeHostRegistry.invokeNativeSyncProcessWide('ohos.statusbar','menu-click', ..., {menuCode})
  → plugin-statusbar StatusBarBridgePlugin::on_main_thread_event('menu-click')
    → MENU_CLICK_CHANNEL.send(MenuClick { menu_code })
  → tray-icon event.rs start_event_forward_thread (event.rs:88)
    → translate_menu_code(raw_code)  // 数字索引 → 原始字符串 id（flat_ids 映射）
    → MENU_METADATA.predefined_map.get(menu_code) → Some("minimize")
    → execute_predefined_action("minimize")  (event.rs:136)
      → client.execute_predefined(StatusBarPredefinedRequest{action:"minimize"})
        // bridge call ohos.statusbar/execute-predefined
  → StatusbarPlugin.invokeAsync('execute-predefined')  (StatusbarPlugin.ets:291)
    → executor = getPredefinedActionExecutor()  // 全局 globalExecutor
    → WINDOW_OPERATIONS.includes("minimize") → setPendingAction(() => executor.execute("minimize"))
    → 立即返回 ack（不等 minimize 真正执行）
  ... 等待 WINDOW_ACTIVE/WINDOW_SHOWN 触发 consumePendingAction ...
  → [Bug] 前提不成立：notify_only 不产生前台切换，WINDOW_ACTIVE 不来
    → 退路 A：2s 计时器丢弃 action（minimize 不执行）
    → 退路 B：杂散 WINDOW_ACTIVE 来自 standard 模式 spawn 的新实例 → 操作落到新窗口
```

### PredefinedActionExecutor.execute('minimize') 目标窗口解析

```
executor.execute('minimize')  // tray 路径：targetWindowId = undefined
  → getTargetWindow(undefined)  (helper/menu.ets:119)
    → Strategy 1: targetWindowId undefined → 跳过
    → Strategy 2: getUserInteractedWindow()  // onTouch 记录的最后触摸窗口
    → Strategy 3 (fallback): this.win  // NativeAbility.onWindowStageCreated 设置的 mainWindow
  → minimizeWindow(windowId) → WindowManager.getWindow(id).minimize()
```

tray 路径不传 `targetWindowId`，依赖 Strategy 2/3。`this.win` 在 `NativeAbility.ets:276-277` 由 `windowStage.getMainWindowSync()` 设置。**关键**：当 `launchType: "standard"` 导致新实例 spawn 时，新实例的 `onWindowStageCreated` 会 `setPredefinedActionExecutor(new executor)` 覆盖全局 `globalExecutor`（`helper/menu.ets:16`），新 executor 的 `this.win` 是新实例的主窗口。tray 路径随后通过 `getPredefinedActionExecutor()` 拿到这个新 executor，操作目标变为新窗口。

## 3. 根因分析

### RC1: `launchType: "standard"`（"弹出新窗口"根因）

**证据**：
- `tauri/crates/tauri-cli/templates/mobile/open-harmony/entry_desktop/src/main/module.json5:21` → `"launchType": "standard"`
- `tauri/examples/api/src-tauri/gen/ohos/entry_desktop/src/main/module.json5:23` → `"launchType": "standard"`
- `entry_mobile` 模板与生成文件同为 `standard`。
- 已归档 `p1-single-instance` design.md 第 1 行假定 "OHOS 默认 launchType: singleton"，与模板实际产出矛盾。
- `StatusBarUtils.iconClickHandler`（左键还原应用）调用 `abilityContext.startAbility(want)`；`startAbility` 在 `standard` 模式下每次创建新 UIAbility 实例 + 新主窗口。

**机制**：OHOS `launchType` 三种取值——`singleton`（复用现有实例，回调 `onNewWant`）、`standard`（每次新实例）、`specified`（自定义）。Tauri 应用是单进程单实例语义，主 entry ability 必须为 `singleton`。`standard` 使得：① 左键托盘图标 spawn 新窗口；② 任何系统前台切换 spawn 新实例 → 新实例覆盖全局 executor。

### RC2: tray 路径 `execute-predefined` 的延迟执行前提不成立（"目标窗口错误/不执行"根因）

**证据**：
- `StatusbarPlugin.ets:302-310` 对 minimize/hide/close 调 `wm.setPendingAction(() => executor.execute(actionType))`。
- 注释明示"matches MenuPlugin behavior"——即从 menubar 路径照搬，而非基于 tray 路径实际行为。
- `WindowManager.ets:680-690` 注释描述延迟模型："1. Tray menu click → setPendingAction 2. System triggers onNewWant → cancelCleanupTimer 3. RESUMED/WINDOW_ACTIVE fires → consumePendingAction"。
- 但 tray 菜单项在 `tray-icon/.../mod.rs:646-650` 构造为 `notify_only: Some(true)` + `menu_code: Some(id)`，且 `StatusBarMenuItem` 经 `#[serde(rename_all="camelCase")]` 序列化为 `notifyOnly:true`（`plugin-statusbar/src/lib.rs:99,111,118`），系统据此触发 `rightMenuClick` 而非 `startAbility`。即 tray 菜单点击**不产生 onNewWant / 前台切换**。

**后果**：
- 退路 A（app 已前台，无杂散实例）：WINDOW_ACTIVE 不触发 → 2s 计时器丢弃 → minimize 不执行（用例失败：点了没反应）。
- 退路 B（RC1 在场，standard 模式 spawn 新实例）：新实例 WINDOW_ACTIVE 触发 `consumePendingAction` → `executor.execute('minimize')` → 此时全局 executor 已被新实例覆盖 → `getTargetWindow` 解析到新窗口 → minimize 新窗口（用例失败：弹窗被最小化）。

> 注：MenuPlugin（menubar 路径）保留延迟不在本修复范围。menubar 是应用内 ArkUI 组件，点击不涉及 notify_only/系统菜单，其延迟行为已通过 manual_tests menubar 用例验证，不改动。

## 4. 修改点

### Fix A: `launchType: "standard"` → `"singleton"`

| 文件 | 行号 | 改法 |
|------|------|------|
| `tauri/crates/tauri-cli/templates/mobile/open-harmony/entry_desktop/src/main/module.json5` | 21 | `"launchType": "standard"` → `"launchType": "singleton"` |
| `tauri/crates/tauri-cli/templates/mobile/open-harmony/entry_mobile/src/main/module.json5` | 21 | 同上 |
| `tauri/examples/api/src-tauri/gen/ohos/entry_desktop/src/main/module.json5` | 23 | 同上（gen/ohos 不从模板重生成，必须手改；手改可跨 build 存活） |
| `tauri/examples/api/src-tauri/gen/ohos/entry_mobile/src/main/module.json5` | 9 | 同上 |

**模板改后必须重装 tauri-cli**（参考 memory `ohos-tauri-cli-2.0-3.0-wrong-install`）：在 tauri 仓库根执行 `cargo install --path crates/tauri-cli --force`（或项目既定安装方式），并 `cargo install --list` 校验 `cargo-tauri.exe` 路径指向 3.0 仓。

**为何 entry_mobile 也改**：mobile 主 entry 同样是单实例语义应用入口；`standard` 会让 deep-link/通知等 startAbility 路径 spawn 多实例。统一为 singleton 与桌面一致，避免未来 mobile 侧同类缺陷。

### Fix B: StatusbarPlugin tray 路径移除延迟，立即执行

**文件**：`openharmony-ability/plugins/statusbar/src/main/ets/StatusbarPlugin.ets`（源；pack 时同步到 `package/src/main/ets/plugins/statusbar/StatusbarPlugin.ets`）

**当前**（约 291-316 行）：
```ts
if (action === "execute-predefined") {
  const request = expectRequestType(payload, action, PREDEFINED_REQUEST_TYPE) as PredefinedRequest;
  ...
  const actionType = request.action as PredefinedType;
  const WINDOW_OPERATIONS: PredefinedType[] = ["minimize", "hide", "close"];
  if (WINDOW_OPERATIONS.includes(actionType)) {
    hilog.info(...);
    const wm = WindowManager.getInstance();
    wm.setPendingAction(() => {
      executor.execute(actionType);
    });
  } else {
    executor.execute(actionType);
  }
  return { typeName: ACKNOWLEDGEMENT_TYPE, value: new StatusbarAcknowledgement(true) };
}
```

**改后**：
```ts
if (action === "execute-predefined") {
  const request = expectRequestType(payload, action, PREDEFINED_REQUEST_TYPE) as PredefinedRequest;
  if (typeof request.action !== "string" || !request.action) {
    throw new Error("execute-predefined.action must be a non-empty string");
  }
  const executor = getPredefinedActionExecutor();
  if (!executor) {
    hilog.warn(DOMAIN, "StatusbarPlugin", "execute-predefined: PredefinedActionExecutor not initialized, action: %{public}s", request.action);
    throw new Error("PredefinedActionExecutor not initialized");
  }
  const actionType = request.action as PredefinedType;
  // Tray 右键菜单项为 notify_only:true，系统触发 rightMenuClick 而非 startAbility，
  // 不产生系统前台切换（onNewWant/WINDOW_ACTIVE）。MenuPlugin 的 setPendingAction 延迟
  // 模型前提对 tray 路径不成立——延迟会等不到 WINDOW_ACTIVE 被 2s 计时器丢弃，
  // 或被杂散 WINDOW_ACTIVE 消费导致目标窗口错误。tray 路径无前台切换竞态，立即执行。
  hilog.info(DOMAIN, "StatusbarPlugin", "execute-predefined '%{public}s'", request.action);
  executor.execute(actionType);
  return { typeName: ACKNOWLEDGEMENT_TYPE, value: new StatusbarAcknowledgement(true) };
}
```

**线程安全**：`invokeAsync` 在 bridge worker 线程执行（非 ArkTS/NAPI 主线程），`executor.execute` 内部 `minimizeWindow`/`hideAbility`/`closeWindow` 均为 fire-and-forget（`win.minimize().then(...)` 不 await，`hideAbility` 的 `startAbility` 在 singleton 模式下走 `onNewWant` 复用实例），不阻塞 worker，无死锁风险。满足 OHOS 约束"禁 recv_timeout / 主线程禁 block_on"。

**pack 同步**：修改源文件后，按 `ohos-pack-plugins-single-file-gap` memory 的教训，必须重跑 pack 步骤将 `plugins/statusbar/` 同步到 `package/`，并删除 `oh_modules` + `CompileArkTS` 缓存（避免 `ohos-ohpm-ability-har-stale-cache` 的陈旧 HAR 命中）。

## 5. 目标窗口解析（无需额外修改）

Fix A 后，executor 的 `this.win` 指向唯一主窗口（singleton 不再 spawn 新实例覆盖全局 executor）。tray 路径 `executor.execute(actionType)` 不传 `targetWindowId`，`getTargetWindow(undefined)` 走 Strategy 2（`getUserInteractedWindow`，onTouch 记录的最后触摸窗口）或 Strategy 3（`this.win` = 主窗口）——单窗口场景下稳定指向主窗口。多窗口场景由 Strategy 2 的 onTouch 跟踪覆盖，不在本修复范围。

## 6. 调用链图（修复后）

```
tray 右键 Minimize
  → rightMenuClick → menuClickHandler → menu-click bridge event
  → tray-icon event.rs execute_predefined_action
  → ohos.statusbar/execute-predefined
  → StatusbarPlugin.invokeAsync  [Fix B: 立即执行，不再 setPendingAction]
  → executor.execute('minimize')
  → getTargetWindow(undefined) → this.win (主窗口, singleton 不被覆盖)  [Fix A]
  → minimizeWindow(0) → WindowManager.getWindow(0).minimize()
  → 主窗口最小化 ✓
```

## 7. 风险与回退

### 7.1 launchType 改动影响面
`singleton` 让所有 `startAbility(EntryAbility)` 复用现有实例并回调 `onNewWant`。影响路径：
- 左键托盘图标 `iconClickHandler`：不再 spawn 新窗口，改为 `onNewWant` 还原已有实例（正确行为）。
- deep-link / 通知拉起应用：复用实例，`onNewWant` 携带 want（已由 `p1-single-instance` 打通）。
- 不影响 `TestTrayAbility`（`statusBarView` extension，非 entry ability，无 launchType 字段）。

### 7.2 StatusbarPlugin 即时执行的前台切换竞态
若某些 OHOS 版本在 tray 右键菜单关闭时仍会向主窗口投递 WINDOW_ACTIVE（focus 抖动），立即 minimize 不受影响（minimize 已完成，后续 WINDOW_ACTIVE 是 no-op 还原？）。经验上 OHOS `minimize` 后系统不自动 restore。若实测发现 minimize 后窗口被立即 restore，回退为：保留延迟但把 `consumePendingAction` 的触发条件加上"定时器兜底立即执行"——即 setPendingAction 后同时 `setTimeout(0)` 直接执行（去掉对 WINDOW_ACTIVE 的依赖）。此回退仅作备选，首选即时执行。

### 7.3 其他平台影响
- module.json5：OHOS 专属，Windows/macOS/Linux 无对应文件。铁律#2 ✓。
- StatusbarPlugin.ets：openharmony-ability 仓内 ArkTS（铁律#1 唯一桥接仓），不触及 Rust 跨平台代码。铁律#1 ✓。
- desktop/mobile：entry_desktop 模板限 desktop 设备类型，entry_mobile 限 mobile；launchType 改动对两者均为正确单实例语义。铁律#3 ✓（tray/menu 仅 desktop 编译，StatusbarPlugin 走 tray 路径仅 desktop 触发）。

## 8. 验证

- 设备端重跑 manual_tests.md 用例 #20 全部预定义项（Minimize/Maximize/Fullscreen/Hide/CloseWindow），确认无新窗口弹出、操作作用于主窗口。
- 回归 manual_tests.md 用例 #17-19（tray 创建/右键菜单结构/自定义项点击），确认 launchType 改动未破坏托盘基础功能。
- 回归 menubar 预定义项用例（#43/#45/#55），确认 MenuPlugin 路径未受影响（本修复不动 MenuPlugin）。
- 验证左键托盘图标不再 spawn 新窗口（`iconClickHandler` startAbility 走 onNewWant）。
