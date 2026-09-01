## Context

tao 的 OHOS Window 后端(`tao/src/platform_impl/ohos/mod.rs`)有 7 个窗口操作方法是 no-op/stub:`set_inner_size`(warn no-op)、`set_outer_position`(no-op)、`set_maximized`(no-op)、`set_minimized`(no-op)、`is_maximized`(恒 false)、`is_minimized`(恒 false)、`set_visible`(no-op)。仅 `set_decorations` 已实现(经 `openharmony-ability::set_window_decorations` → `@kit.ArkUI/window`)。

后果:`tauri-plugin-window-state`(持久化/恢复窗口 position/size/maximized/minimized/visible/decorated)在 OHOS desktop 恢复功能全部静默失效。`@kit.ArkUI/window` 在 desktop 2in1 提供 moveWindowTo/resize(API9 公共)、maximize(API12 公共)、minimize(API11 公共)、`getWindowStatus()`/`WindowStatusType`(API12 公共,含 MAXIMIZE/MINIMIZE)、showWindow(API9,仅子窗口恢复);**`restore()` 是 API14**(项目 API12 不可用);**`setWindowMode`/`WindowMode` 是系统接口**(第三方不可用,且无 MAXIMIZE/MINIMIZE 成员)→ 缺口在 tao 层未接线 + restore 需版本守卫。

既有桥接模式:`openharmony-ability::window::{focus_window, set_window_decorations, set_window_focusable}` —— Rust fn 经 `helper.get_named_property::<Function>(<arktsMethod>)` + `func.call(args)` 调 ArkTS 方法,ArkTS 侧 `WindowManager.ets` 调 `@kit.ArkUI/window`(已有 `minimizeWindow`→`win.minimize()`、`focusWindow`→`raiseToAppTop`、以及 `win.resize/moveWindowTo/showWindow` 用法)。`create_os_window` 演示了 NAPI 返回值模式(返回 `i64` window_id)。

约束:openharmony-ability 是唯一 ArkTS 桥接仓;`cfg(target_env = "ohos")` 隔离;OHOS `target_os="linux"` 需 `not(target_env="ohos")` 排除;API 12 默认(restore API14 需版本守卫降级;不用系统接口 setWindowMode)。

## Goals / Non-Goals

**Goals:**
- 实现 tao OHOS Window 的 7 个方法,经 openharmony-ability 桥接 `@kit.ArkUI/window`,行为对齐 Windows/macOS(可观察一致)。
- 让 `tauri-plugin-window-state` 在 OHOS desktop 真正生效(restore position/size/maximized/minimized/visible/decorated)。
- 复用既有 NAPI 桥接模式,不引入新依赖。

**Non-Goals:**
- 不改 window-state 插件本身(平台无关,仅启用 + 测试)。
- 不实现 OHOS 直接 hide API(不存在,用变通)。
- 不处理多显示器/分屏下的复杂布局语义(best-effort)。

## Decisions

### D1: 经 openharmony-ability NAPI 桥接(复用 focus_window 模式)
新增 Rust NAPI fn 在 `openharmony-ability/crates/ability/src/window/mod.rs`,经 `helper.get_named_property::<Function>` + `func.call` 调 ArkTS 方法,ArkTS 侧 `WindowManager.ets` 调 `@kit.ArkUI/window`。
**理由**:三条铁律(openharmony-ability 是唯一 ArkTS 桥);复用已验证模式(focus_window/set_window_decorations)。
**备选**:tao 直接 NAPI 调 ArkTS —— 拒绝(违反桥接唯一性铁律)。

### D2: is_maximized/is_minimized 经两个 bool 返回 fn(同步 getWindowStatus)
OHOS 提供**同步**方法 `win.getWindowStatus(): WindowStatusType`(API 12+,项目可用),`WindowStatusType` 枚举(API 11+)含 `MAXIMIZE=2`/`MINIMIZE=3`(以及 UNDEFINED/FULL_SCREEN/FLOATING/SPLIT_SCREEN)。故两个 bool fn 直接同步查询:
- `is_window_maximized(id) -> bool`:ArkTS `isMaximized(windowId)` → `win.getWindowStatus() === window.WindowStatusType.MAXIMIZE`。
- `is_window_minimized(id) -> bool`:ArkTS `isMinimized(windowId)` → `win.getWindowStatus() === window.WindowStatusType.MINIMIZE`。
NAPI 返回 bool(参考 `create_os_window` 返回 i64 的值返回模式)。
**理由**:`getWindowStatus()` 是同步 getter,直接返回最大化/最小化状态,无需 rect 比对或事件跟踪。两 bool fn 比 struct 简单。避免 Rust 侧自行跟踪(易 desync)。
**备选**:windowRect vs display 比对 —— 拒绝(多显示器/任务栏/手动铺满误判,且 getAvailableArea 异步);事件跟踪+缓存 —— 拒绝(初始竞态 + 清除条件复杂);Rust 侧维护状态 —— 拒绝(desync)。
**勘误**:早期版本误用 `getWindowProperties().windowStatus` + `WindowStatus.MAXIMIZED`(均不存在)及 rect 比对/事件缓存变通,经官方文档核实后改为 `getWindowStatus()` + `WindowStatusType.MAXIMIZE/MINIMIZE`。

### D3: 窗口操作 fire-and-forget;状态查询同步
`move_window_to`/`resize_window`/`maximize_window`(maximize API12)/`minimize_window`(minimize API11)/`restore_window`(restore API14 版本守卫)/`show_window`(showWindow API9) 采用 fire-and-forget(分发 async Promise, Rust 同步返回 `Ok(())`),镜像 `focus_window`。`is_window_maximized`/`is_window_minimized` 同步返回 bool(读 `getWindowStatus()`)。
**理由**:匹配既有模式;window-state 的使用模式(save 在窗口稳定后 / restore 分发操作)容忍 fire-and-forget。
**权衡**:set_maximized 后立即查 is_maximized 可能滞后(eventual consistency)—— window-state save 发生在窗口稳定态(close/event),不紧接 set,可接受。

### D4: set_maximized / set_minimized 语义映射(maximize/minimize 公共 API;restore 仅最小化恢复)
经仓内官方文档核实:`maximize()`(API12)/`minimize()`(API11)公共未废弃;`restore()`(API14)**仅从 MINIMIZE 状态恢复主窗口**(文档:"从最小化状态恢复到前台",**不取消最大化**);`recover()`(API7+,公共)**取消最大化**(MAXIMIZE/FULL_SCREEN → FLOATING);`setWindowMode` 系统接口(放弃)。**unmaximize 用 `recover()`**(API7+ 公共,所有目标版本可用)。
- `set_maximized(true)`→`maximize_window`(`win.maximize(window.MaximizePresentation.EXIT_IMMERSIVE)`, API12;**指定 EXIT_IMMERSIVE 以获得真正 MAXIMIZE 状态**——默认 ENTER_IMMERSIVE 会进入 FULL_SCREEN,导致 getWindowStatus 返回 FULL_SCREEN 而非 MAXIMIZE,破坏 is_maximized;需设备实测确认)。
- `set_maximized(false)`→`recover_window`(`win.recover()`, API7+ 公共;MAXIMIZE/FULL_SCREEN → FLOATING;经 openharmony-ability `recover_window` NAPI 桥接)。
- `set_minimized(true)`→`minimize_window`(`win.minimize()`, API11)。
- `set_minimized(false)`→`restore_window`(`win.restore()`, API14;用 `openharmony_ability::version::sdk_api_version() >= 14` 版本守卫(项目已有,见 autostart.rs/global_shortcut);API12 no-op+warn;restore 仅最小化恢复,此处语义正确)。
**已知限制(显式标注)**:(1) `set_minimized(false)`/`set_visible(true)` 在 API12 无 restore(API14,no-op+warn);(2) `restore()` 需 UIAbility onForeground + 窗口处于最小化状态(否则 no-op)。is_maximized/is_minimized 查询(getWindowStatus API12)+ maximize/minimize/set_position/set_size/unmaximize(recover API7+) 在 API12 可用。
**理由**:用公共 API;restore 仅用于 unminimize(语义正确);unmaximize 用 recover(API7+ 公共);maximize 指定 EXIT_IMMERSIVE 确保 is_maximized 一致。

### D5: hide 变通(minimize)+ show(restore+showWindow 版本守卫)+ 副作用标注
`set_visible(false)`→`minimize_window`(`win.minimize()`, API11 公共;hide 变通,OHOS 无直接 hide API)。`set_visible(true)`→`restore_window` + `show_window`(`win.restore()` API14 版本守卫 + `win.showWindow()` API9;从 MINIMIZE 恢复主窗口需 restore,API12 下 restore 不可用 → showWindow best-effort(主窗口可能无效,见 D4 限制)+ warn)。
**副作用(显式标注,平台差异)**:
1. `set_visible(false)`→minimize 使 `getWindowStatus()` 返回 `MINIMIZE` → `is_window_minimized()` 返回 `true`(Windows/macOS hide 不改变 minimized 状态;window-state 会把 hidden 记为 minimized)。
2. `set_visible(true)` 在 API12 对最小化主窗口可能无效(restore 不可用,showWindow 仅子窗口)→ API12 限制,no-op+warn;API14 用 restore+showWindow 正常。
**理由**:OHOS 无 setWindowVisibility;minimize 是最接近的"隐藏";恢复用 restore(API14 守卫)+ showWindow。
**备选**:destroy/recreate —— 拒绝(重,丢失窗口状态);纯透明度 —— 拒绝(仍占交互区)。

### D6: cfg(target_env = "ohos") 隔离
openharmony-ability 新 fn 在 `window/mod.rs`(模块整体已是 OHOS);tao 方法体替换 no-op(仅在 OHOS 编译路径生效,其它平台走各自实现)。无 Linux 依赖新增(无需 not(ohos) 排除)。
**理由**:三条铁律;不影响 Windows/macOS/Linux。

### D7: window-state 插件不改,仅启用 + 测试
插件平台无关(用 tauri Window API)。`examples/api` 启用 `tauri-plugin-window-state` + 加测试用例(auto: is_maximized/is_minimized 返回值;side-effect: set_position/set_size/maximize 后状态生效;manual: restore 跨重启)。
**理由**:缺口在 tao 层,非插件层。

## Risks / Trade-offs

- **[restore API14 版本守卫]** `win.restore()` 是 API14,项目 API12 不可用 → 缓解:ohos-version-isolation 版本守卫(API≥14 调 restore,API12 no-op+warn);API12 下 unmaximize/unminimize 主窗口为已知限制(无公共 API),is_maximized/is_minimized 查询仍可用。
- **[setWindowMode 系统接口]** `setWindowMode`/`WindowMode` 是系统接口(错误 202),第三方应用不可用,且 WindowMode 无 MAXIMIZE/MINIMIZE → 已放弃 setWindowMode,改用公共 maximize()/minimize()/restore()。
- **[fire-and-forget 时序]** set_maximized 后立即 is_maximized 可能返回旧值(getWindowStatus 滞后)→ 缓解:window-state save 在窗口稳定后(不紧接 set);doc 标注 eventual consistency。
- **[moveWindowTo/resize 分屏/全屏受限]** 系统在分屏/全屏下可能拒绝 → 缓解:调用失败 `log::warn` 不阻塞。
- **[子窗口 minimize/maximize 受限]** OHOS 子窗口可能不支持 minimize/maximize → 缓解:仅主窗口保证;子窗口 best-effort + warn。
- **[hide 变通非真隐藏]** minimize 仍占任务栏,且使 is_minimized=true(平台差异)→ 缓解:design D5 + spec 显式标注。
- **[getWindowStatus 枚举未覆盖态]** WindowStatusType 有 UNDEFINED/FULL_SCREEN/FLOATING/SPLIT_SCREEN 等非 max/min 态 → 缓解:is_maximized 仅对 MAXIMIZE 返回 true,其余 false;is_minimized 仅对 MINIMIZE 返回 true;语义安全。

## Migration Plan

- 纯新增能力,无破坏性变更(替换 no-op 为真实实现,行为从"静默失效"变"生效",对依赖窗口操作的插件是修复)。
- 回滚:tao 方法恢复 no-op(单 commit 可回退)。

## Open Questions

- **API12 restore 缺口的最终处理**:D4/D5 用 restore() API14 版本守卫(API12 no-op+warn)。是否改为提升 compatibleSdkVersion 到 14(使 restore 全可用)还是保持 API12 + 降级 —— 待确认设备/目标 SDK 版本后定。
- 设备实测:`maximize()`/`minimize()` 在 desktop 2in1 主窗口的实际行为;`getWindowStatus()` 在各态(MAXIMIZE/MINIMIZE/FLOATING/UNDEFINED)的返回;restore() 在 API14 设备上的恢复效果。
- hide 变通默认用 minimize 还是 offscreen —— 倾向 minimize(任务栏可见,用户可恢复);offscreen 作为可选。
