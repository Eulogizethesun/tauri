# Tray 预定义菜单项目标窗口错误 适配计划

**创建时间**：2026-08-18
**功能描述**：修复状态栏托盘右键菜单预定义项（Minimize/Maximize/Fullscreen/Hide/Close）点击后弹出新窗口、且操作目标窗口错误的缺陷（manual_tests.md 用例 #20）。
**判断依据**：涉及 2 个代码层（tauri-cli 模板 + openharmony-ability ArkTS），预估 5 个文件，单层修复可独立验证。

## 问题根因摘要

1. **"弹出新窗口"根因**：`entry_desktop/module.json5` 的 `launchType: "standard"`。OHOS `standard` 启动模式每次 `startAbility(EntryAbility)` 都创建新 UIAbility 实例 + 新主窗口。托盘交互路径中的 `startAbility`（`iconClickHandler` 左键还原 / 系统前台切换）因此 spawn 出一个新实例，新实例在 `onWindowStageCreated` 中 `setPredefinedActionExecutor(new executor)` 覆盖全局 executor，其 `this.win` 指向新窗口。
2. **"目标窗口错误 / 不执行"根因**：`StatusbarPlugin.execute-predefined`（tray 专用路径）对 minimize/hide/close 做了 `setPendingAction` 延迟执行，照搬自 `MenuPlugin`（menubar 路径）。但延迟的前提是"托盘菜单点击触发系统前台切换 onNewWant → WINDOW_ACTIVE"。托盘菜单项用 `notify_only: true` + `menuCode`，系统触发 `rightMenuClick` 而非启动 ability，**不产生前台切换**。因此：① 延迟的 action 要么等不到 WINDOW_ACTIVE 被 2s 计时器丢弃（minimize 不执行）；② 要么被杂散的 WINDOW_ACTIVE（来自 standard 模式 spawn 的新实例）消费，操作落到新窗口上。

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | launchType singleton + tray 预定义项即时执行 | p1-tray-predefined-target-window | ✓ 设计完成 | tauri-cli 模板 + openharmony-ability ArkTS | 5 | 设备端手动测试 #20 |

## Phase 详细说明

### Phase 1: launchType singleton + tray 预定义项即时执行
- **目标**：
  - 将主 entry ability 的 `launchType` 从 `standard` 改为 `singleton`（模板 + 已生成文件 + 重装 tauri-cli）。
  - 移除 `StatusbarPlugin.execute-predefined`（tray 路径）对 minimize/hide/close 的 `setPendingAction` 延迟，改为立即执行。
- **文件列表**：
  1. `tauri/crates/tauri-cli/templates/mobile/open-harmony/entry_desktop/src/main/module.json5`（模板）
  2. `tauri/crates/tauri-cli/templates/mobile/open-harmony/entry_mobile/src/main/module.json5`（模板）
  3. `tauri/examples/api/src-tauri/gen/ohos/entry_desktop/src/main/module.json5`（已生成，gen 不重生成）
  4. `tauri/examples/api/src-tauri/gen/ohos/entry_mobile/src/main/module.json5`（已生成）
  5. `openharmony-ability/plugins/statusbar/src/main/ets/StatusbarPlugin.ets`（ArkTS 源，pack 时同步到 package/）
- **依赖**：无
- **验证方式**：设备端重跑 manual_tests.md 用例 #20（Tray 预定义菜单项操作验证），确认 Minimize/Maximize/Fullscreen/Hide/CloseWindow 均作用于主窗口、无新窗口弹出。
