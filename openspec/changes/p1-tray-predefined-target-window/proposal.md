# Proposal: Tray 预定义菜单项目标窗口错误修复

## Why

manual_tests.md 用例 #20（Tray 预定义菜单项操作验证，T0）失败：在状态栏托盘右键菜单中点击 Minimize（或 Maximize/Fullscreen/Hide/Close）会弹出一个新窗口，且 minimize 只作用于那个弹窗，而非主窗口。预期是直接最小化/最大化/全屏/隐藏/关闭主窗口。

根因有二（详见 design.md）：

1. **`launchType: "standard"`**：主 entry ability 的启动模式为 `standard`，导致每次 `startAbility(EntryAbility)` 都创建新 UIAbility 实例 + 新主窗口。托盘交互路径中的 `startAbility`（左键 `iconClickHandler` 还原应用 / 系统前台切换）因此 spawn 出杂散实例，该实例在 `onWindowStageCreated` 中 `setPredefinedActionExecutor(new executor)` 覆盖全局 executor，`this.win` 指向新窗口。已归档的 `p1-single-instance` 设计曾假定 "OHOS 默认 launchType: singleton"，但 tauri-cli 模板实际生成了 `standard`，二者不一致。
2. **tray 路径错误的延迟执行**：`StatusbarPlugin.execute-predefined`（仅 tray 路径走此 action）对 minimize/hide/close 做了 `setPendingAction` 延迟，照搬自 `MenuPlugin`（menubar 路径）。延迟前提"托盘菜单点击触发系统前台切换 onNewWant → WINDOW_ACTIVE"对 tray 路径不成立——托盘菜单项用 `notify_only: true` + `menuCode`，系统触发 `rightMenuClick` 而非启动 ability，不产生前台切换。延迟的 action 要么等不到 WINDOW_ACTIVE 被 2s 计时器丢弃（不执行），要么被杂散 WINDOW_ACTIVE（standard 模式 spawn 的新实例）消费，操作落到新窗口。

## What Changes

- 将主 entry ability 的 `launchType` 从 `standard` 改为 `singleton`（tauri-cli 模板 + examples/api 已生成 gen/ohos 文件 + 重装 tauri-cli）。
- 在 `StatusbarPlugin.execute-predefined`（tray 路径）中移除 minimize/hide/close 的 `setPendingAction` 延迟，改为立即 `executor.execute(actionType)`。

## Capabilities

### Modified Capabilities
- `ohos-tray-predefined-action`: tray 预定义菜单项的窗口操作改为即时执行，不再依赖系统前台切换事件消费。

## Impact

- **tauri-cli**：模板文件修改（module.json5 launchType）。需重装 tauri-cli 才能让后续 `tauri ohos init` 产出 singleton。
- **openharmony-ability**：`StatusbarPlugin.ets` 修改（仅 tray 路径的 execute-predefined 分支）。
- **examples/api**：已生成的 gen/ohos module.json5 需手动改（gen/ohos 不从模板重生成，手改可跨 build 存活）。
- **其他平台**：无影响。module.json5 为 OHOS 专属配置文件；StatusbarPlugin 修改在 `cfg` 概念外的 ArkTS 层（仅 tray 路径），不触及 Windows/macOS/Linux Rust 代码。满足铁律#1（ArkTS 桥接集中在 openharmony-ability）、铁律#2（无其他平台影响）、铁律#3（tray/menu 仅 desktop，entry_desktop 模板已限 desktop）。
