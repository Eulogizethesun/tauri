# Tray Predefined 调查进展

## 问题描述

Tray 右键菜单的 predefined action（Minimize/Maximize/Fullscreen/Quit/Close）点击后无效果。Phase 8 实现时曾可正常工作，menubar phase 后失效。

## 已确认的事实

### OHOS StatusBar 菜单点击的两种投递机制

1. **Emitter 机制** (`rightMenuClick`): 当 `menuAction.notifyOnly=true` + `menuCode` 设置时，OHOS sceneboard 通过 IPC (`AppClientNotifier`) 投递 emitter 事件到应用进程，回调收到 `data['menuCode']`
2. **Ability Start 机制** (`onNewWant`): 当 `menuAction.abilityName` 设置时，OHOS 通过 Ability lifecycle `onNewWant` 投递到应用。Want 参数**不含 menuCode**

### 当前行为

- Sceneboard **确实收到了菜单点击事件**: `menuCode: 134, notifyOnly: true` + `AppClientNotifier: Notify client menu clicked start`
- **Emitter 机制失效**: `AppClientNotifier: Register client pid fail: out of range` → IPC 通知无法投递到应用进程 → `_onMenuClick` 回调**从不被调用**
- **Ability Start 机制生效**: `onNewWant` IS 被调用，但 Want 参数不含 menuCode，无法判断点击了哪个菜单项

### OHOS 系统级错误

| 错误 | 说明 | 影响 |
|------|------|------|
| `AppClientNotifier: Register client pid fail: out of range` | OHOS sceneboard 无法为应用注册 PID | rightMenuClick emitter 无法投递 |
| `Multi-instance is not supported` (16000078) | statusBarManager 内部 `getCurrentInstanceKey` 对 singleton 调用方按设计抛出并内部 catch/日志 | **无需处理**——非致命、不导致 401。tray 成功注册时仍出现 |
| `The size of the pixelmap exceeds the limit` (1010710001) | PixelMap 为固定物理像素，未按 24vp × density 校正 | **已修复**——`scaleSync` 做 density 校正（见 spec §7.4） |

## 根因分析

**直接原因**: `AppClientNotifier: Register client pid fail: out of range` 导致 OHOS sceneboard 无法通过 IPC 将 `rightMenuClick` emitter 事件投递到应用进程。

**根因链**:
1. OHOS sceneboard 的 `AppClientNotifier` 在 tray 注册时为应用进程注册 PID
2. PID 注册失败（"out of range"）
3. IPC 通知无法投递 → `rightMenuClick` emitter 事件永远不到达应用
4. `_onMenuClick` NAPI 回调不被调用
5. tray predefined action 无法执行

**为何 Phase 8 可工作**: Phase 8 测试时 PID 注册可能成功（不同的 OHOS 系统状态/进程表状态）。当前测试环境 PID 注册持续失败。

## 已尝试的修复方案

### 方案 1: updateStatusBarMenu 激活 notifyOnly (已尝试 ✗)

OHOS API 文档 line 1107: "当调用updateStatusBarMenu，添加菜单项时，指定menuAction的notifyOnly使能和菜单项menuCode时生效"

在 `addToStatusBar` 后立即调用 `updateStatusBarMenu` 重新提交带 notifyOnly=true 的菜单项。

**结果**: `updateStatusBarMenu` 成功，sceneboard 收到并处理了菜单项，但 PID 注册仍然失败，emitter 仍不工作。

### 方案 2: removeFromStatusBar 清理残留注册 (已尝试 ✗)

在 `addToStatusBar` 前调用 `removeFromStatusBar` 清除可能存在的旧注册。

**结果**: `removeFromStatusBar` 成功，`addToStatusBar` 也成功，但 PID 注册仍然失败。

### 方案 3: 不设置 menuAction.abilityName (已尝试 ✗)

尝试不填充 abilityName，期望 OHOS 只走 emitter 路径不注册 ability PID。

**结果**: OHOS API 文档表明 abilityName 是 menuAction 的必填字段。且用户确认之前设置 abilityName 时 predefined 是可工作的。

### 方案 4: 图标尺寸缩减 (已实施 ✓)

将 tray 图标从 484×484 缩减到 24×24（OHOS 推荐）。

**结果**: 图标创建成功，sceneboard 确认尺寸为 24×24。但 `pixelmap exceeds the limit` 错误仍出现（疑似 OHOS bug 或 false alarm）。

### 方案 5: 代码清理 — 移除 manager.rs 重复 NAPI 闭包 (已实施 ✓)

`init_tray_tsfn()` 在 manager.rs 创建 `_onIconClick`/`_onMenuClick` 闭包，然后 `register_icon_click_handler()`/`register_menu_click_handler()` (event.rs) 用同名闭包覆盖。已统一由 event.rs 管理。

### 方案 6: Ctrl+V 修复 (已实施 ✓)

`AcceleratorMatcher` 增加 `CLIPBOARD_ACCELERATORS` 集合 (ctrl+c/x/v/a)，`matches()` 返回 false，让 webview 原生处理剪贴板操作。

## 根因结论（2026-05-26 更新）

### 代码对比分析

通过 `git diff 1dd56b7..dd6d3fe` 对比 phase 8 完成时的代码与 menubar commits 后的代码：

**menubar commits 对 statusbar 代码的影响：零**

| 文件 | menubar commits 改动 | 影响 statusbar？ |
|------|---------------------|-----------------|
| DefaultXComponent.ets | 仅添加 `setPrimaryWebviewControllerCallback` + webview 回调 | ❌ 不影响 |
| NativeAbility.ets | `onPopupRequest` → `onMenuRequest`，添加 menubar 逻辑 | ❌ 不影响 |
| MainPage.ets | 添加 menubar 渲染 + `onKeyPreIme` + `AcceleratorMatcher` | ❌ 不影响 statusbar（但引入了 Ctrl+V bug） |
| helper/menu.ets | `PredefinedActionExecutor` 添加 menubar visibility 逻辑 | ❌ 不影响 statusbar emitter |
| crates/ability/src/statusbar/ | **无任何改动** | — |

**Phase 8 原始 addToStatusBarWithRgba 代码**（commit `1dd56b7`）：
```typescript
statusBarManager.addToStatusBar(context, opts);
setTimeout(() => {
  statusBarManager.on('rightMenuClick', h._onMenuClick as Callback<emitter.EventData>);
}, 200);
```

**当前代码**（我的调试修改）：
```typescript
statusBarManager.removeFromStatusBar(context);  // 新增
statusBarManager.on('rightMenuClick', ...);     // 移到 addToStatusBar 之前
statusBarManager.addToStatusBar(context, opts);
statusBarManager.updateStatusBarMenu(context, menuForAdd);  // 新增
```

### 结论

**predefined 失效不是代码回归，是 OHOS 设备状态问题。**

1. menubar commits 没有修改任何 statusbar 相关代码
2. `AppClientNotifier: Register client pid fail: out of range` 是 OHOS sceneboard 系统级错误
3. 该错误表示 sceneboard 的进程表（PID 注册表）处于异常状态
4. Phase 8 测试时设备状态正常，PID 注册成功；当前设备状态异常，PID 注册持续失败
5. 我的调试修改（removeFromStatusBar、pre-registration、updateStatusBarMenu）没有解决问题，反而可能引入新问题（removeFromStatusBar 会破坏已有注册）

### 修复方案

**方案 1（推荐）：恢复原始代码 + 设备重启**

1. 将 DefaultXComponent.ets 的 `addToStatusBarWithRgba` 恢复到 phase 8 原始逻辑
2. 重启 OHOS 设备清空 sceneboard 进程表
3. 验证 predefined 是否恢复工作

**方案 2：executePredefinedAction 直接调用（绕过 emitter）**

当前 tray predefined 的执行路径：
```
tray menu click → sceneboard IPC → rightMenuClick emitter → _onMenuClick → Rust event thread → execute_predefined_action TSFN → ArkTS executePredefinedAction
```

如果 emitter 机制持续不可用，可以绕过它：在 `addToStatusBar` 时不使用 `notifyOnly`，让 OHOS 走 `onNewWant` 路径。但 `onNewWant` 不传递 menuCode，需要额外机制传递点击的菜单项 ID。

**方案 3：Ctrl+V 修复已完成**

`AcceleratorMatcher` 已添加 `CLIPBOARD_ACCELERATORS` 集合，`matches()` 对 ctrl+c/x/v/a 返回 false。这是 menubar commits 引入的 bug（`onKeyPreIme` 拦截了所有匹配的快捷键），已修复。

## 下一步

1. **恢复 DefaultXComponent.ets 到 phase 8 原始逻辑**（移除 removeFromStatusBar、pre-registration、updateStatusBarMenu）
2. **请用户重启设备**
3. 重启后部署测试，验证 `AppClientNotifier: Register client pid fail` 是否消失
4. 如果重启后仍然失败，考虑方案 2（绕过 emitter）

## 关键文件

| 文件 | 路径 | 角色 |
|------|------|------|
| DefaultXComponent.ets | `openharmony-ability/native_ability/src/main/ets/components/` | addToStatusBar/emitter 注册/executePredefinedAction |
| NativeAbility.ets | `openharmony-ability/native_ability/src/main/ets/ability/` | onNewWant/onWindowStageCreate/setupMenuPopup |
| event.rs | `openharmony-ability/crates/ability/src/statusbar/` | _onIconClick/_onMenuClick NAPI 闭包 |
| manager.rs | `openharmony-ability/crates/ability/src/statusbar/` | TSFN 管理/add_to_status_bar |
| icon.rs | `tray-icon/src/platform_impl/ohos/` | 图标缩放/PixelMap 创建 |
| event.rs | `tray-icon/src/platform_impl/ohos/` | crossbeam channel 事件转发/predefined action 执行 |
| mod.rs | `tray-icon/src/platform_impl/ohos/` | TrayIcon::new/menu_to_status_bar_items |
| accelerator_matcher.ets | `openharmony-ability/native_ability/src/main/ets/helper/` | Ctrl+V 修复 |

## OHOS StatusBar API 参考

文档位置: `tauri/doc/tray/reference/status_bar_api.md`

关键段落:
- Line 75-78: QuickOperation.abilityName — 空字符串时支持 statusBarIconClick emitter
- Line 169-182: StatusBarMenuAction.notifyOnly — true 时支持 rightMenuClick emitter
- Line 1107: rightMenuClick 说明 — "当调用updateStatusBarMenu，添加菜单项时，指定menuAction的notifyOnly使能和菜单项menuCode时生效"