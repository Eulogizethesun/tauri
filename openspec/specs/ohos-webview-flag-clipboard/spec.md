# ohos-webview-flag-clipboard Specification

> ✅ **验证状态：真机验证通过（2026-08-29，HUAWEI MateBook Pro / API 23）。** 代码见 `44e9bcc`（openharmony-ability）+ `9e3f8aa`（wry）。§27 Clipboard OFF/ON 用例 PASS（OFF 拦截生效、ON 原生正常），默认值翻转后主窗口（未显式配置）`setWebviewFlags clipboard=true` 且真实键盘 Ctrl+C 正常，manual_tests T1「MenuBar Accelerator Ctrl+C」回归修复确认。openspec change `ohos-webview-flag-clipboard` 的设备验证 task 逐项核对结果见 manual_tests.md §27。
>
> **2026-08-28 修订（默认值翻转）**：初版实现把 wry `clipboard` 属性（跨平台语义为「页面 JS 剪贴板访问」，Windows/Linux 上键盘 Ctrl+C 永远原生可用）映射为「键盘组合键拦截」，且沿用 wry 默认值 `false`——导致**所有默认配置的 OHOS 窗口**（含 tauri.conf.json 主窗口，tauri 未暴露该配置项）的 Ctrl+C/X/V/A/Z/Y 被吞，与 Windows/macOS 行不符（回归：manual_tests T1「MenuBar Accelerator Ctrl+C」）。修订：wry 的 `WebViewAttributes::default().clipboard` 与 tauri-runtime 的 `WebviewAttributes::new().clipboard` 在 OHOS 下均为 `true`（对齐 macOS「默认启用」）；显式 `disable_clipboard_access()`/`with_clipboard(false)` 仍触发拦截。tauri 新增 `disable_clipboard_access()` builder 方法。

## Purpose
让 wry 的 `with_clipboard(bool)` 开关在 OHOS 后端真正生效。ArkWeb 默认允许页面剪贴板访问（`document.execCommand('copy'/'cut'/'paste')`、Clipboard API、Ctrl+C/X/V 组合键），既存实现把 `clipboard` 字段在 `InnerWebView::new_inner` 解构时通过 `..` catch-all 丢弃，导致开发者即便调用 `.with_clipboard(false)` 也无法禁用剪贴板。本 spec 通过「flag 转发 + ArkUI onKeyPreIme 拦截」使 `false` 真正禁用剪贴板组合键，`true` 维持 ArkWeb 原生行为。

**默认值语义（2026-08-28 修订后）**：OHOS 默认 `true`（不拦截，ArkWeb 原生处理，与 macOS 默认启用、Windows 键盘原生一致）；仅显式 `false` 拦截。wry `clipboard` 属性在 Linux/Windows 上只控制页面 JS 剪贴板访问、不控制键盘——OHOS 的键盘拦截是超出 wry 原语义的 OHOS 专属扩展，因此默认值必须取「不拦截」才与其他平台键盘行为对齐。

本 spec 取代 `webview-desktop-features` spec 中 "R82 Clipboard attribute is always-on (platform limitation)" 的旧决策——该决策将 OHOS 与 macOS 对齐为「始终启用」，但 macOS 是 WebKit 引擎级限制无 toggle，OHOS 则可通过组合键拦截实现禁用，二者不应等同。

## ADDED Requirements

### Requirement: wry OHOS SHALL forward clipboard flag to WebviewInitData
`InnerWebView::new_inner` SHALL 在解构 `WebViewAttributes` 时显式保留 `clipboard` 字段（不再落入 `..` catch-all），并通过 `WebViewBuilder::clipboard(bool)`（新增）转发给 `openharmony-ability`，最终写入 `WebviewInitData.clipboard` 字段供 ArkTS 读取。默认值 `true`（OHOS）与 `WebViewAttributes::default()` 一致（2026-08-28 修订：原为 `false`）。tauri 应用的实际默认值来源是 `tauri-runtime` 的 `WebviewAttributes::new().clipboard`（该结构体无 `Default` impl，构造函数为 `new()`），同样在 OHOS 下为 `true`。

#### Scenario: with_clipboard(false) reaches ArkTS
- **WHEN** 开发者调用 `.with_clipboard(false)` 创建 OHOS webview
- **THEN** `WebviewInitData.clipboard` SHALL 为 `false`
- **AND** Rust 端 SHALL 不再静默丢弃该字段

#### Scenario: with_clipboard(true) reaches ArkTS
- **WHEN** 开发者调用 `.with_clipboard(true)` 创建 OHOS webview
- **THEN** `WebviewInitData.clipboard` SHALL 为 `true`

#### Scenario: default true on OHOS when not set
- **WHEN** 开发者未调用 `with_clipboard`
- **THEN** `WebviewInitData.clipboard` SHALL 为 `true`（OHOS 下 `WebViewAttributes::default().clipboard == true`，2026-08-28 修订）
- **AND** onKeyPreIme 拦截器 SHALL 不拦截剪贴板组合键（ArkWeb 原生处理）

### Requirement: WebviewInitData SHALL add clipboard field
`DefaultWebview.ets` 的 `WebviewInitData` 接口 SHALL 新增 `clipboard?: boolean` 字段。该字段在 `addWebview`/`createWebview` 路径下被保留进 `WebviewNodeData`，供 `onKeyPreIme` 拦截器读取。Rust 侧（wry）总是显式传值（`Some(bool)`），因此拦截表的运行时默认值（`isClipboardEnabled` 的 `?? true`，即未设置时不拦截）仅在非 wry 驱动路径下生效。

#### Scenario: clipboard field optional
- **WHEN** `WebviewInitData` 未提供 `clipboard`
- **THEN** 拦截器 SHALL 视为 `true`（即不拦截，保持 ArkWeb 原生行为；2026-08-28 修订，原为视为 `false` 拦截）

### Requirement: onKeyPreIme SHALL block clipboard combos when clipboard=false
ArkUI 容器（`MainPage.ets` 主窗口、`FloatPage.ets` 浮窗）的 `onKeyPreIme` 处理器 SHALL 在 `data.clipboard !== true` 且按下组合键属于 `CLIPBOARD_ACCELERATORS`（`ctrl+c`/`ctrl+x`/`ctrl+v`/`ctrl+a`/`ctrl+z`/`ctrl+y`）时返回 `true` 消费事件，阻止其下发到 ArkWeb，从而禁用剪贴板操作。当 `data.clipboard === true` 时 SHALL 不拦截，让 ArkWeb 原生处理。

#### Scenario: clipboard=false blocks Ctrl+C
- **WHEN** `data.clipboard === false` 且用户按下 Ctrl+C
- **THEN** `onKeyPreIme` SHALL 返回 `true`
- **AND** ArkWeb SHALL NOT 收到该按键事件
- **AND** 页面选中文本 SHALL NOT 被复制到系统剪贴板

#### Scenario: clipboard=false blocks Ctrl+V
- **WHEN** `data.clipboard === false` 且用户按下 Ctrl+V
- **THEN** `onKeyPreIme` SHALL 返回 `true`
- **AND** 系统剪贴板内容 SHALL NOT 被粘贴到页面

#### Scenario: clipboard=false blocks Ctrl+A/X/Z/Y
- **WHEN** `data.clipboard === false` 且用户按下 Ctrl+A / Ctrl+X / Ctrl+Z / Ctrl+Y 之一
- **THEN** `onKeyPreIme` SHALL 返回 `true`
- **AND** 对应的全选/剪切/撤销/重做 SHALL NOT 在页面生效

#### Scenario: clipboard=true preserves native behavior
- **WHEN** `data.clipboard === true` 且用户按下 Ctrl+C/X/V/A/Z/Y
- **THEN** `onKeyPreIme` SHALL 返回 `false`（不拦截）
- **AND** ArkWeb SHALL 原生处理剪贴板组合键

#### Scenario: non-clipboard combos unaffected
- **WHEN** `data.clipboard === false` 且用户按下任意非 CLIPBOARD_ACCELERATORS 组合键（如 Ctrl+F、Ctrl+S）
- **THEN** `onKeyPreIme` SHALL 不因本规则拦截（其他加速器匹配逻辑照常）

### Requirement: Clipboard interception SHALL coordinate with AcceleratorMatcher
`accelerator_matcher.ets` 的 `CLIPBOARD_ACCELERATORS` 常量 SHALL 作为拦截判定的唯一来源，避免重复维护组合键列表。`AcceleratorMatcher.matches` 既有的「剪贴板组合键跳过加速器匹配」逻辑（返回 `false` 不拦截）SHALL 保持不变——该逻辑用于「菜单加速器不抢占剪贴板键」，与本 spec 的「clipboard flag 拦截」正交：前者总是放行到 webview，后者仅在 flag=false 时拦截。二者组合行为：
- `clipboard=true`：AcceleratorMatcher 跳过剪贴板键 → onKeyPreIme 不拦截 → ArkWeb 原生处理
- `clipboard=false`：AcceleratorMatcher 跳过剪贴板键 → onKeyPreIme 拦截器消费 → ArkWeb 收不到

#### Scenario: clipboard flag false takes precedence over menu accelerator skip
- **WHEN** `data.clipboard === false` 且菜单含 `Ctrl+C` 加速器，用户按下 Ctrl+C
- **THEN** `AcceleratorMatcher.matches` SHALL 返回 `false`（既有跳过逻辑）
- **AND** onKeyPreIme 剪贴板拦截器 SHALL 仍消费该事件（`clipboard=false` 优先）
- **AND** 菜单加速器 SHALL NOT 触发，ArkWeb SHALL NOT 复制

### Requirement: clipboard flag SHALL NOT affect programmatic pasteboard API
本 spec 仅拦截键盘组合键。Rust/ArkTS 通过 `@ohos.pasteboard` API 的程序化剪贴板读写 SHALL 不受 `clipboard` flag 影响（与 wry Linux/Windows 语义一致——该 flag 控制页面侧剪贴板访问，不控制宿主程序化访问）。

#### Scenario: programmatic pasteboard unaffected
- **WHEN** `data.clipboard === false` 且宿主代码调用 `@ohos.pasteboard` 读写剪贴板
- **THEN** 程序化读写 SHALL 正常工作
- **AND** SHALL NOT 受 onKeyPreIme 拦截影响

### Requirement: clipboard flag applies to all device form factors
`clipboard` flag 拦截 SHALL 在 mobile 与 desktop 形态下均生效。mobile 形态下软键盘通常无 Ctrl 组合键，但外接蓝牙键盘场景下拦截仍有意义；desktop 形态下为常见场景。

#### Scenario: mobile with bluetooth keyboard
- **WHEN** `OHOS_DEVICE_TYPE=mobile`、`data.clipboard === false` 且外接键盘按下 Ctrl+C
- **THEN** onKeyPreIme SHALL 拦截（与 desktop 一致）
