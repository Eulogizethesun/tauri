# ohos-platform-limitations Specification

## Purpose
集中记录 Tauri 在 OHOS 平台上"需鸿蒙原生 API 但当前无 Tauri 插件对应、且短期内不实现"的功能降级判定。覆盖 R195（多进程）、R227（字体）、R228（应用接续）、R229（截图取色）、R230（无障碍）、R223/R224（全局托盘/菜单事件监听桌面特性）。本规范为降级报告，不定义新 API，仅声明契约边界。

## ADDED Requirements

### Requirement: R195 多进程在 OHOS 降级为不支持
OHOS 第三方应用 SHALL NOT 通过 Tauri API 派生任意子进程；OHOS 应用模型以 UIAbility / ExtensionAbility 为基本运行单元，每个 ability 实例可独立进程，但无通用 `spawn` 子进程能力。Tauri 的多进程 API（若存在）在 OHOS 上 SHALL 返回 `UnsupportedPlatform` 错误或通过 cfg 隔离不暴露。

#### Scenario: 应用请求派生子进程
- **WHEN** 应用在 OHOS 调用任何多进程派生 API
- **THEN** SHALL 返回明确的平台不支持错误
- **AND** 不调用 `std::process::Command::spawn` 创建任意子进程
- **AND** 文档 SHALL 引导用户使用 OHOS `ExtensionAbility` 实现后台任务

### Requirement: R227 字体 API 在 OHOS 降级为不支持
Tauri 无独立字体插件；OHOS `@ohos.graphics.font` 提供字体注册 API，但 Tauri 当前不暴露跨平台字体 API。OHOS 适配 SHALL NOT 新增字体插件；应用自有字体 SHALL 通过 `resource_dir()` 静态资源加载（由前端 CSS / ArkUI 处理），不通过 Tauri Rust API。

#### Scenario: 应用加载自有字体
- **WHEN** 应用需要在 OHOS 使用自有字体
- **THEN** 应用 SHALL 将字体文件放入 `resources/` 并通过前端 CSS `@font-face` 加载
- **AND** 不通过 Tauri API 注册系统字体
- **AND** `font_dir()` 在 OHOS 不可用（见 ohos-path-desktop-dirs 规范）

### Requirement: R228 应用接续提供被动恢复与源端保存 API（主动迁移不可用）
应用接续按最小 API 边界提供（由 `tauri-plugin-continuation` 插件实现，契约见 `ohos-continuation-plugin` / `ohos-continuation-source` spec）：被动恢复查询 `isContinuationRestoreLaunch`（peek）与接续数据回传 `getContinuationData`（draining take）——信号来自 ability 生命周期（`launchParam.launchReason === CONTINUATION`，经 NativeAbility 生命周期链转发至 Rust 存储）；源端保存 `setContinuationData`（预注册快照，NativeAbility `onContinue` 同步直读转发 `wantParam.continuationData`，空快照拒绝迁移）与构建期门控（`bundle.openHarmony.continuable` / `continueType` → module.json5），零系统权限。主动发起迁移由系统 UI 独占（用户点任务管理器接续图标），SHALL NOT 通过 Tauri API 暴露。原判定依据（`continuationManager` 独立 API + Tauri 无对应概念）已失效——该 API 已废弃，接续改由 UIAbility 生命周期驱动，三方可用。

#### Scenario: 应用查询接续恢复状态
- **WHEN** 应用在 OHOS 期望被动接续恢复（被另一设备接续拉起）
- **THEN** Tauri SHALL 经 `tauri-plugin-continuation` 提供恢复状态查询与 wantParam 数据回传
- **AND** 应用 SHALL NOT 能主动发起迁移（系统 UI 独占，三方不可做）
- **AND** 文档 SHALL 指引完整迁移流使用系统任务管理器接续入口

#### Scenario: 应用预注册源端接续数据
- **WHEN** 应用在源设备运行时调用 `setContinuationData` 并经系统接续入口迁移
- **THEN** NativeAbility `onContinue` SHALL 同步读快照返回 AGREE 并把 payload 写入 `wantParam.continuationData`
- **AND** 空/未注册快照 SHALL 返回 MISMATCH（显式 opt-in）；快照读取 SHALL 为 peek（取消迁移可重试）

#### Scenario: 非 OHOS 平台
- **WHEN** 在非 OHOS 平台调用接续插件命令
- **THEN** SHALL 返回 `unsupported` 错误

### Requirement: R229 截图取色提供应用内 webview 最小 API（系统级截图不可用）
应用内截图取色按最小 API 边界提供（由 `tauri-plugin-screenshot` 插件实现，契约见 `ohos-screenshot-plugin` spec）：`captureWebview`（ArkWeb `webPageSnapshot` → base64 PNG，零系统权限）与 `pickColorAt(x, y)`（快图像素读取，BGRA→RGBA）。系统级 `@ohos.screenshot` 仅系统应用可用，SHALL NOT 通过 Tauri API 暴露。

#### Scenario: 应用请求截图
- **WHEN** 应用在 OHOS 调用 `captureWebview` / `pickColorAt`
- **THEN** Tauri SHALL 经 `tauri-plugin-screenshot` 返回调用来源 webview 的快照或像素颜色
- **AND** 应用 SHALL NOT 能截取其他应用或整屏内容（`@ohos.screenshot` 仅系统应用）
- **AND** 文档 SHALL 指引整屏/跨应用截图需求走系统截屏等原生路径

### Requirement: R230 无障碍提供最小查询/事件 API（服务提供方不可用）
OHOS 无障碍能力按最小 API 边界提供（由 `tauri-plugin-accessibility` 插件实现，契约见 `ohos-accessibility-plugin` spec）：`fontScale` 字号缩放查询（零权限）、屏幕阅读器/触摸浏览状态查询（`ohos.permission.ACCESSIBILITY` 系统级权限，三方被拒时返回结构化错误）、屏幕阅读器状态变化事件。Web 内容无障碍仍由 ArkWeb 内置 ARIA 处理；`AccessibilityExtensionAbility`（无障碍服务提供方）三方不可注册，SHALL NOT 提供。

#### Scenario: 应用查询无障碍状态
- **WHEN** 应用在 OHOS 调用 `getFontScale` / `isScreenReaderEnabled` / `isTouchExploreEnabled`
- **THEN** Tauri SHALL 经 `tauri-plugin-accessibility` 返回查询结果或结构化错误
- **AND** Web 内容无障碍 SHALL 依赖 ArkWeb 内置 ARIA 实现
- **AND** 原生 UI 无障碍 SHALL 由 OHOS 系统辅助服务处理
- **AND** 应用 SHALL NOT 能注册自定义无障碍服务（ExtensionAbility 三方不可注册）

### Requirement: R223/R224 全局托盘/菜单事件监听仅在 OHOS desktop 形态启用
OHOS 全局托盘与菜单栏仅在 `OHOS_DEVICE_TYPE=desktop` 时通过 `cfg(all(target_env = "ohos", desktop))` 启用，归 `tray-*` / `menu-*` 规范范围（本规范只读引用）。在 mobile 形态下 SHALL 不存在。

#### Scenario: mobile 形态无托盘
- **WHEN** `OHOS_DEVICE_TYPE=mobile`（默认）
- **THEN** 托盘/全局菜单 API SHALL 不编译
- **AND** 应用不引用托盘相关类型

#### Scenario: desktop 形态托盘归 tray 规范
- **WHEN** `OHOS_DEVICE_TYPE=desktop`
- **THEN** 托盘/菜单行为 SHALL 由 `ohos-tray-*` / `ohos-menu-*` 规范定义
- **AND** 本规范不重复定义

## 平台限制汇总
| 行 | 功能 | 判定 | 处置 |
|----|------|------|------|
| R195 | 多进程 | 平台限制降级 | 不支持，返回错误，引导 ExtensionAbility |
| R223/224 | 全局托盘/菜单事件监听 | 桌面形态归 tray/menu 规范 | mobile 降级，desktop 归其他规范 |
| R227 | 字体 | 平台限制降级 | 静态资源加载，无 Tauri API |
| R228 | 应用接续 | 被动恢复 + 源端保存已提供 | 恢复查询/数据回传/源端快照保存归 continuation 插件规范；continuable 构建期门控（tauri-cli）；主动迁移系统 UI 独占不可用 |
| R229 | 截图取色 | 最小 API 已提供 | 应用内 webview 截图/取色归 screenshot 插件规范；系统级 @ohos.screenshot 仅系统应用 |
| R230 | 无障碍 | 最小 API 已提供 | 查询/事件归 accessibility 插件规范；服务提供方不可用，ARIA 归 ArkWeb |

### Requirement: ArkWeb 物理键盘 keydown 退化为 IME 插入管线（已由 key-synthesis 修复主窗口）
ArkWeb 将物理键盘文本录入路由到 IME 插入管线：原生 DOM keydown/keyup 为无身份空壳事件（`key`/`code` 为空、`e.repeat` 恒 false、auto-repeat 以"每周期一对假 keydown/keyup"形式出现、`preventDefault` 无法阻止文字插入）。此为 ArkWeb 系统组件行为，应用层无 API 可直接纠正。主窗口（首实例 id=0）已由 `ohos-webview-key-synthesis`（openharmony-ability，onKeyPreIme 合成注入 + shim 抑制）修复；合成与 shim 注入均**仅限主窗口**——sub-UIAbility 实例窗口（id>0，加载同一 MainPage）与 Float 子窗口 SHALL NOT 注入 shim（无 key-synthesis 接线，注入会丢失全部按键事件），其 DOM key 事件维持原生退化行为，修复为后续增量。

#### Scenario: 主窗口前端读取按键身份与连发
- **WHEN** 物理键盘在主窗口 WebView 长按键
- **THEN** 前端 SHALL 收到带 `key`/`code` 的合成 keydown，第二个起 `repeat=true`
- **AND** ArkWeb 原生空壳 keydown/keyup SHALL 被 shim 在 window 捕获阶段抑制
- **AND** IME 文字插入 SHALL 不受影响（无双重插入）

#### Scenario: Float 子窗口前端读取按键
- **WHEN** 物理键盘在 Float 子窗口 WebView 按键
- **THEN** DOM key 事件 SHALL 维持 ArkWeb 原生行为（空壳、无 repeat）
- **AND** SHALL NOT 出现"事件被抑制但无合成替代"的丢失状态

## 平台限制汇总（增补）
| 行 | 功能 | 判定 | 处置 |
|----|------|------|------|
| R-arkweb-key | ArkWeb keydown 退化（IME 管线） | 系统组件行为，主窗口已合成修复 | 主窗口走 ohos-webview-key-synthesis；sub-UIAbility 实例与 Float 子窗口维持退化（后续增量） |
