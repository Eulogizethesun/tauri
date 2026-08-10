# ohos-webview-flag-zoom-hotkeys Specification

> ⚠️ **验证状态：代码已实现，真机验证未完成。** 代码见 `44e9bcc`（openharmony-ability）+ `9e3f8aa`（wry），TestRunner 有 Zoom OFF/ON 按钮。但 openspec change `ohos-webview-flag-zoom-hotkeys` 仍 ACTIVE（11/16，5 个设备验证 task TODO），spec 被提前合并到 `specs/`。待真机验证通过 + change archive 后去掉本标注。

## Purpose
让 wry 的 `zoom_hotkeys_enabled` 开关在 OHOS 后端真正禁用缩放热键。当前 OHOS 桌面端有两路缩放：
1. Tauri 注入的 `zoom-hotkey.js`（`crates/tauri/src/manager/webview.rs:562-581`，`cfg(all(desktop, not(target_os = "windows")))`）——该路径**已正确**尊重 `zoom_hotkeys_enabled`：`false` 时不注入 JS。
2. ArkWeb 引擎原生支持 Ctrl+= / Ctrl+- / Ctrl+0 缩放——该路径**不受 flag 控制**，即便 `zoom_hotkeys_enabled=false`，ArkWeb 仍会响应这些组合键。

契约差距 = 第 2 路无法禁用。本 spec 通过「flag 转发 + ArkUI onKeyPreIme 拦截 Ctrl+=/-/0」使 `false` 真正禁用原生缩放热键，`true` 维持 ArkWeb 原生行为（JS 路径由 Tauri 自行注入）。

本 spec 取代 `webview-desktop-features` spec 中 "R91 Hotkey zoom works on OHOS desktop" 的旧结论——该结论称「已实现」仅覆盖 JS 路径，未覆盖 flag=false 时 ArkWeb 原生热键仍生效的缺口。

## ADDED Requirements

### Requirement: wry OHOS SHALL forward zoom_hotkeys_enabled flag to WebviewInitData
`InnerWebView::new_inner` SHALL 在解构 `WebViewAttributes` 时显式保留 `zoom_hotkeys_enabled` 字段（不再落入 `..` catch-all），并通过 `WebViewBuilder::zoom_hotkeys_enabled(bool)`（新增）转发给 `openharmony-ability`，最终写入 `WebviewInitData.zoomHotkeys` 字段供 ArkTS 读取。默认值 `false` 与 `WebViewAttributes::default()` 一致。

#### Scenario: zoom_hotkeys_enabled(false) reaches ArkTS
- **WHEN** 开发者创建 OHOS webview 且 `zoom_hotkeys_enabled = false`
- **THEN** `WebviewInitData.zoomHotkeys` SHALL 为 `false`
- **AND** Rust 端 SHALL 不再静默丢弃该字段

#### Scenario: zoom_hotkeys_enabled(true) reaches ArkTS
- **WHEN** 开发者调用 `.with_zoom_hotkeys(true)` 创建 OHOS webview
- **THEN** `WebviewInitData.zoomHotkeys` SHALL 为 `true`

### Requirement: WebviewInitData SHALL add zoomHotkeys field
`DefaultWebview.ets` 的 `WebviewInitData` 接口 SHALL 新增 `zoomHotkeys?: boolean` 字段（默认 `false`）。该字段在 `addWebview`/`createWebview` 路径下被保留进 `WebviewNodeData`，供 `onKeyPreIme` 拦截器读取。

#### Scenario: zoomHotkeys field optional
- **WHEN** `WebviewInitData` 未提供 `zoomHotkeys`
- **THEN** 拦截器 SHALL 视为 `false`（即拦截原生缩放组合键）

### Requirement: onKeyPreIme SHALL block zoom combos when zoomHotkeys=false
ArkUI 容器（`MainPage.ets` 主窗口、`FloatPage.ets` 浮窗）的 `onKeyPreIme` 处理器 SHALL 在 `data.zoomHotkeys !== true` 且按下组合键属于 `ZOOM_HOTKEY_ACCELERATORS`（`ctrl+=`、`ctrl+-`、`ctrl+0`）时返回 `true` 消费事件，阻止其下发到 ArkWeb。当 `data.zoomHotkeys === true` 时 SHALL 不拦截，让 ArkWeb 原生处理（同时 Tauri 注入的 `zoom-hotkey.js` 也会响应，二者协同——JS 路径调用 `set_webview_zoom` IPC，原生路径由 ArkWeb 直接缩放；为避免双重缩放，详见下方协调 Requirement）。

#### Scenario: zoomHotkeys=false blocks Ctrl+=
- **WHEN** `data.zoomHotkeys === false` 且用户按下 Ctrl+=（放大）
- **THEN** `onKeyPreIme` SHALL 返回 `true`
- **AND** ArkWeb SHALL NOT 收到该按键事件
- **AND** webview 缩放级别 SHALL NOT 改变

#### Scenario: zoomHotkeys=false blocks Ctrl+-
- **WHEN** `data.zoomHotkeys === false` 且用户按下 Ctrl+-（缩小）
- **THEN** `onKeyPreIme` SHALL 返回 `true`
- **AND** webview 缩放级别 SHALL NOT 改变

#### Scenario: zoomHotkeys=false blocks Ctrl+0
- **WHEN** `data.zoomHotkeys === false` 且用户按下 Ctrl+0（重置）
- **THEN** `onKeyPreIme` SHALL 返回 `true`
- **AND** webview 缩放级别 SHALL NOT 重置

#### Scenario: zoomHotkeys=true preserves native behavior
- **WHEN** `data.zoomHotkeys === true` 且用户按下 Ctrl+=/-/0
- **THEN** `onKeyPreIme` SHALL 返回 `false`（不拦截）
- **AND** ArkWeb SHALL 原生响应缩放

#### Scenario: non-zoom combos unaffected
- **WHEN** `data.zoomHotkeys === false` 且用户按下任意非 ZOOM_HOTKEY_ACCELERATORS 组合键（如 Ctrl+C、Ctrl+F）
- **THEN** `onKeyPreIme` SHALL 不因本规则拦截

### Requirement: ZOOM_HOTKEY_ACCELERATORS SHALL be defined alongside CLIPBOARD_ACCELERATORS
`accelerator_matcher.ets` SHALL 新增 `ZOOM_HOTKEY_ACCELERATORS: Set<string>` 常量，包含 `'ctrl+=`、`'ctrl+-'`、`'ctrl+0'`。该常量供 onKeyPreIme 拦截器读取。`AcceleratorMatcher.matches` SHALL 也跳过这些组合键的菜单加速器匹配（与剪贴板键同处理），避免菜单 Ctrl+= 抢占。

#### Scenario: zoom combos skipped by menu accelerator matching
- **WHEN** 菜单含 `Ctrl+=` 加速器且 `data.zoomHotkeys === true`，用户按下 Ctrl+=
- **THEN** `AcceleratorMatcher.matches` SHALL 返回 `false`（跳过）
- **AND** onKeyPreIme 拦截器 SHALL 不拦截（zoomHotkeys=true）
- **AND** ArkWeb SHALL 原生放大

### Requirement: zoomHotkeys flag SHALL coordinate with Tauri JS injection
当 `zoom_hotkeys_enabled=true` 时，Tauri (`crates/tauri/src/manager/webview.rs`) 注入 `zoom-hotkey.js` 并注册 `set_webview_zoom` IPC，ArkWeb 原生也响应 Ctrl+=/-/0。为避免 JS 路径与原生路径双重缩放（每次按键放大两次），SHALL 采取以下协调之一（实现时择一）：
- 方案 A（推荐）：OHOS 桌面端在 `manager/webview.rs` 的注入条件追加 `&& false` 短路，完全依赖 ArkWeb 原生缩放（flag=true 时 onKeyPreIme 放行 → ArkWeb 处理）
- 方案 B：保留 JS 注入，但 `zoom-hotkey.js` 在 OHOS 上 no-op（`os_name === "ohos"` 时早退）
两种方案下，flag=false 时 JS 不注入 + onKeyPreIme 拦截，彻底禁用缩放。

#### Scenario: no double zoom on OHOS desktop
- **WHEN** `zoom_hotkeys_enabled=true` 且 OHOS desktop 用户按下 Ctrl+=
- **THEN** webview SHALL 仅放大一档（不翻倍）
- **AND** `controller.zoom()` 与 ArkWeb 原生缩放 SHALL 不同时触发

### Requirement: Programmatic zoom SHALL NOT be affected
`InnerWebView::zoom(scale_factor)` 通过 `Webview::set_zoom` → `controller.zoom()` 程序化缩放 SHALL 不受 `zoomHotkeys` flag 影响。flag 仅控制键盘热键，不控制程序化 API。

#### Scenario: programmatic zoom works when flag false
- **WHEN** `zoom_hotkeys_enabled=false` 且 Rust 调用 `webview.zoom(1.5)`
- **THEN** webview SHALL 缩放到 1.5 倍
- **AND** SHALL NOT 被拦截

### Requirement: zoomHotkeys interception SHALL be desktop-only
ArkWeb 原生 Ctrl+=/-/0 缩放仅在桌面形态（外接键盘）下有意义。mobile 形态下软键盘无 Ctrl 组合键，拦截无副作用但无必要。为与 Tauri JS 注入的 `cfg(desktop)` 门控对齐，onKeyPreIme 的 zoom 拦截 SHALL 仅在 `__openharmony_ability_is_desktop__` AppStorage 为 `true` 时生效；mobile 形态下 SHALL 不拦截（即便 `zoomHotkeys=false`，移动端本就无键盘热键触发场景）。

#### Scenario: mobile does not intercept zoom combos
- **WHEN** `OHOS_DEVICE_TYPE=mobile`、`data.zoomHotkeys === false` 且外接键盘按下 Ctrl+=
- **THEN** onKeyPreIme SHALL 不因 zoom 规则拦截（与 Tauri JS 不注入对齐）
- **AND** ArkWeb SHALL 原生响应（mobile 端原生缩放通常也禁用，由 ArkWeb 自身决定）

#### Scenario: desktop intercepts when flag false
- **WHEN** `OHOS_DEVICE_TYPE=desktop`、`data.zoomHotkeys === false` 且用户按下 Ctrl+=
- **THEN** onKeyPreIme SHALL 拦截
