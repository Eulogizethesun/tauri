# ohos-platform-limitations Specification

## Purpose
集中记录 Tauri 在 OHOS 平台上"需鸿蒙原生 API 但当前无 Tauri 插件对应、且短期内不实现"的功能降级判定。覆盖 R195（多进程）、R227（字体）、R228（应用接续）、R229（截图取色）、R230（无障碍）、R223/R224（全局托盘/菜单事件监听桌面特性）。本规范为降级报告，不定义新 API，仅声明契约边界。

## Requirements

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

### Requirement: 多 UIAbility 架构下 cursor 全局单值与第二窗口 raw_window_handle 为已知限制
多 UIAbility 窗口支持（`multi-uiability-windows` change）落地后，两项单例残留因语义/优先级原因维持现状并标注为已知限制：① `CURSOR_POSITION_X/Y` 为进程级全局单值（app.rs），多窗口下不区分来源窗口——OHOS 鼠标位置语义为 MainPage-relative，per-window cursor 追踪另行立项；② `content_rect` 单 Rect / `native_window` 单句柄——第二 UIAbility 实例窗口（id>0）的 `raw_window_handle` 暂缺，依赖 raw window handle 的 API 在该类窗口上不可用。多实例事件路由（input/IME/axis/focus/destroy 按 windowId）不受影响。

#### Scenario: 多窗口并存时读取鼠标位置
- **WHEN** 主窗口与第二 UIAbility 实例窗并存，应用读取 cursor 位置
- **THEN** 返回值 SHALL 为进程级单值（不区分来源窗口），语义维持 MainPage-relative
- **AND** SHALL NOT 因多窗口并存产生崩溃或错误（只是不区分来源）

#### Scenario: 在第二 UIAbility 实例窗上请求 raw window handle
- **WHEN** 第二 UIAbility 实例窗口（windowId>0）调用依赖 raw_window_handle 的 API
- **THEN** 该窗口 SHALL 无 native_window 句柄可返回（已知限制，返回缺省/错误按各 API 既有降级路径）
- **AND** 主窗口（windowId=0）与 Float 子窗口的 raw_window_handle SHALL 不受影响

### Requirement: 窗口空实现与意图位 API 的 OHOS 语义须在公开 facade 文档披露

tao 公开 facade(`tao/src/window.rs`)的 `set_always_on_bottom`、`set_progress_bar`、`set_visible_on_all_workspaces`、`set_always_on_top`/`is_always_on_top`、`set_fullscreen` SHALL 在各自 Platform-specific 段包含 OHOS 行,使调用者从文档得知平台语义而非从静默无效果中自行发现(各 API 的具体语义见 Scenario)。

#### Scenario: setAlwaysOnBottom 披露

- **WHEN** 阅读 `Window::set_always_on_bottom` 的 facade 文档
- **THEN** 存在 OHOS 行声明:Unsupported,调用为 no-op 并输出一条 warn 日志(签名保持 `()` 不返回 Err);且 OHOS 平台实现确有该 `log::warn!`

#### Scenario: setProgressBar 与 setVisibleOnAllWorkspaces no-op 披露

- **WHEN** 阅读 `set_progress_bar` 与 `set_visible_on_all_workspaces` 的 facade 文档
- **THEN** 各存在 OHOS 行声明 Unsupported 静默 no-op(OHOS 无任务栏进度/多工作区概念,与上游 iOS/Android 一致)

#### Scenario: setAlwaysOnTop 意图位语义披露

- **WHEN** 阅读 `set_always_on_top` 与 `is_always_on_top` 的 facade 文档
- **THEN** 各存在 OHOS 行声明:setter 记录 intent 位并派发 `setWindowTopmost`(API 14+,需 `ohos.permission.WINDOW_TOPMOST`),仅 freeform 形态生效、Float 子窗报错非致命;getter 返回 intent 位而非系统真值

#### Scenario: setFullscreen 折叠披露

- **WHEN** 阅读 `set_fullscreen` 的 facade 文档
- **THEN** 存在 OHOS 行声明:两种 `Fullscreen` 变体折叠为同一沉浸式布尔开关,`fullscreen()` 恒回 `Borderless(None)`

### Requirement: 光标 API 的 OHOS 支持面须在公开 facade 文档披露

tao facade 的 `set_cursor_position` 与 `set_cursor_grab` SHALL 在 Platform-specific 段包含 OHOS 行(语义见 Scenario)。

#### Scenario: setCursorPosition 披露

- **WHEN** 阅读 `set_cursor_position` 的 facade 文档
- **THEN** 存在 OHOS 行声明恒返回 `Err(NotSupported)`,与 iOS/Android 行同型

#### Scenario: setCursorGrab 披露

- **WHEN** 阅读 `set_cursor_grab` 的 facade 文档
- **THEN** 存在 OHOS 行声明:API 22+ 经 dlopen 窗口光标锁支持,confined-follow 语义,仅获焦窗口生效、失焦自动解锁(持续锁定须应用监听 Focused 自行 re-grab)

### Requirement: 显示模式信息降级须披露

tao OHOS `MonitorHandle::video_modes` SHALL 披露:返回单一「当前模式」项——OHOS SDK 无 per-display 视频模式列表与色深 API(bit_depth 恒 32);多屏枚举/尺寸/刷新率真值已接通。

#### Scenario: video_modes 单一模式披露

- **WHEN** 阅读 OHOS `video_modes` 实现处的披露注释
- **THEN** 存在「单一模式 + SDK 无模式列表/色深 API」语义的说明行

### Requirement: 窗口几何注释与实现一致

tao facade 的 `set_outer_position` / `set_inner_size` OHOS 行与 openharmony-ability `WindowManager.ets` 相关注释 SHALL 与实现一致:主窗与 Float 子窗的 resize/move 派发链无条件执行;error 1300002 仅窗口状态异常时瞬时出现,而非「主窗调用必然静默 no-op」。

#### Scenario: 主窗 move/resize 注释不失实

- **WHEN** 阅读 tao facade 两处几何 setter 的 OHOS 行与 ability `isUIAbilityMainWindow` 相关注释
- **THEN** 不存在「返回 1300002 / 静默 no-op / 仅 Float 子窗口可移动或 resize」的绝对化失实表述;注释声明 resize 受系统约束钳制且有 decor 补偿、move 派发成功但几何效果从 JS 不可靠读回,与 `doc/ohos-window-test-mapping.md` 实测记录一致

### Requirement: use_https 自定义协议同步通道上限须披露

wry 公开文档(`with_https_scheme`、`with_asynchronous_custom_protocol`)SHALL 披露:OHOS use_https 拦截通道仅支持同步 respond,异步 handler 的结果被丢弃并 passthrough 放行;异步 handler 须走原生 scheme 路径。

#### Scenario: 异步 handler 丢弃披露

- **WHEN** 阅读 `with_https_scheme` 与 `with_asynchronous_custom_protocol` 的文档
- **THEN** 存在 OHOS 行,声明同步-only 契约、异步结果丢弃 + passthrough 行为、原生 scheme 替代路径

### Requirement: 拖放事件 OHOS 语义须披露(含纠偏)

wry `with_drag_drop_handler` 文档 SHALL 披露三点纠偏后语义(见 Scenario)。

#### Scenario: bool 忽略与默认行为兜底披露

- **WHEN** 阅读 `with_drag_drop_handler` 的 Platform-specific 段
- **THEN** 存在 OHOS 行同时声明:①四类 handler 的 bool 返回被忽略,但默认 drop 行为已被 ArkTS `onLoadIntercept` 对 file:// 的恒拦截兜底阻止(并非"阻止不了");②`Enter` 事件 paths 恒空,仅 `Drop` 携带 paths;③不支持经 bool 返回值放行默认行为

### Requirement: initialization script 的 frame 维度丢失须披露

wry `with_initialization_script_for_main_only` 文档 SHALL 披露:OHOS 上 scripts 经 ArkWeb ScriptItem 注入所有匹配 scriptRules 的框架,`for_main_frame_only` 被忽略;file:// 是否被 `"*"` 规则覆盖未验证(真机探针前不作断言)。

#### Scenario: for_main_frame_only 忽略披露

- **WHEN** 阅读 `with_initialization_script_for_main_only` 的 Platform-specific 段
- **THEN** 存在 OHOS 行,声明全框架注入与 `for_main_frame_only` 被忽略,并标注 file:// 覆盖面未验证

### Requirement: window.open 无 features 通道须披露

wry `with_new_window_req_handler` 文档 SHALL 披露:OHOS 上 `NewWindowFeatures::size/position` 恒 `None`(ArkWeb `OnWindowNewEvent` 无 features 字段),`NewWindowResponse::Create` 对 ArkWeb 弹窗按 `Deny` 处理。

#### Scenario: features 丢失披露保持

- **WHEN** 阅读 `with_new_window_req_handler` 的文档
- **THEN** 存在 OHOS 行声明 size/position 恒 None 与 Create→Deny 语义(该披露已于 HEAD 存在,本需求固化其为不可回归契约)

### Requirement: 窗口特效 OHOS 支持范围须披露

tauri `set_effects` 的两处公开文档(`Window`、`WebviewWindow`)Platform-specific 段 SHALL 包含 OHOS 行(语义见 Scenario)。

#### Scenario: set_effects 范围披露

- **WHEN** 阅读 `Window::set_effects` 与 `WebviewWindow::set_effects` 的 Platform-specific 段
- **THEN** 各存在 OHOS 行声明:仅 `Effect::Blur` 与 `Effect::Acrylic` 生效;`Mica`/`Tabbed` 静默跳过(info 日志);macOS 专有效果按基础 blur 近似;需窗口 transparent

### Requirement: Creation-time visual attributes SHALL be disclosed as not applied

创建期 attrs 中 `visible`、`window_icon`、`preferred_theme` 三项在 OHOS 后端 SHALL 维持不生效现状并落披露:OHOS 侧窗口初始可见性由创建通道与 ArkTS 布局决定(无独立等价 setter 语义)、图标无窗口级 API、主题经既有 onConfigurationUpdate 链运行期生效。facade 文档 SHALL 携带 OHOS 平台专属行;`always_on_top`/`decoration_flags`(播种)与 `fullscreen`/`maximized`/`focused`(补发)已由 pending-ops 机制覆盖,不在披露范围。

#### Scenario: Facade documents unapplied attributes

- **WHEN** 开发者以 `with_visible(false)`/`with_window_icon(...)`/`with_theme(...)` 在 OHOS 创建窗口
- **THEN** 行为 SHALL 维持现状(参数不生效),文档披露该限制
- **AND** 不产生 panic 或错误返回

### Requirement: Response headers SHALL reach the page via setResponseHeader

自定义协议 handler 在 `http::Response` 上设置的响应头 SHALL 经 wry 提取、wire 并行数组（headerNames/headerValues）与 ArkTS `setResponseHeader` 送达页面（SDK 事实：`setResponseHeader` @since 12 PRESENT）；无头响应 SHALL 保持 M1 之前的 wire 形状。

#### Scenario: Response header write reaches the page

- **WHEN** 自定义协议 handler 在 `http::Response` 上设置响应头(如 `Access-Control-Allow-Origin`、`X-Tauri-Scheme-Echo`)
- **THEN** wry SHALL 提取头并经 wire 并行数组送达 ArkTS,`setResponseHeader` 应用到 `WebResourceResponse`
- **AND** 跨源 fetch 依 ACAO 通过,handler 设置的头在 JS `response.headers` 可读
- **AND** fetch() 形态的消费者 SHALL 在应用 CSP `connect-src` 允许 https 重写主机 `https://<scheme>.localhost`（OHOS use_https 将 `<scheme>://localhost` 重写为该主机形态；裸 `<scheme>:` 条目只覆盖 iframe/导航流。设备实证：connect-src 缺该条目时 fetch 在 8ms 内被 CSP 拒绝 "Refused to connect"，拦截器不可达）
- **AND** 既有 CORS 4 例行为零回归

#### Scenario: Headerless response keeps the old wire shape

- **WHEN** 协议 handler 仅设置 Content-Type(或未设头)
- **THEN** wire 载荷的 header 数组 SHALL 为缺省(None/absent),行为与 M1 之前逐字节一致

### Requirement: Intercepted request body SHALL be disclosed as inaccessible

拦截请求 body 在 OHOS 平台无公开访问器——wry 构造的 Request SHALL 仅穿透 method/headers,body 不转发,披露 SHALL 记录该平台边界。

#### Scenario: Request body is not forwarded

- **WHEN** 拦截命中携带 body 的请求(如 POST)
- **THEN** wry 构造的 Request SHALL 仅携带穿透的 method/headers(body 为空),披露条目说明该平台边界

## 平台限制汇总
| 行 | 功能 | 判定 | 处置 |
|----|------|------|------|
| R195 | 多进程 | 平台限制降级 | 不支持，返回错误，引导 ExtensionAbility |
| R223/224 | 全局托盘/菜单事件监听 | 桌面形态归 tray/menu 规范 | mobile 降级，desktop 归其他规范 |
| R227 | 字体 | 平台限制降级 | 静态资源加载，无 Tauri API |
| R228 | 应用接续 | 被动恢复 + 源端保存已提供 | 恢复查询/数据回传/源端快照保存归 continuation 插件规范；continuable 构建期门控（tauri-cli）；主动迁移系统 UI 独占不可用 |
| R229 | 截图取色 | 最小 API 已提供 | 应用内 webview 截图/取色归 screenshot 插件规范；系统级 @ohos.screenshot 仅系统应用 |
| R230 | 无障碍 | 最小 API 已提供 | 查询/事件归 accessibility 插件规范；服务提供方不可用，ARIA 归 ArkWeb |

## 平台限制汇总（增补）
| 行 | 功能 | 判定 | 处置 |
|----|------|------|------|
| R-arkweb-key | ArkWeb keydown 退化（IME 管线） | 系统组件行为，主窗口已合成修复 | 主窗口走 ohos-webview-key-synthesis；sub-UIAbility 实例与 Float 子窗口维持退化（后续增量） |
| R-multiuiab-singleton | 多 UIAbility 下 cursor 全局单值 + 第二实例窗 raw_window_handle 缺失 | 已知限制，多实例事件路由不受影响 | cursor 维持 MainPage-relative 单值（per-window 追踪另行立项）；native_window 单句柄限主窗/Float，第二 UIAbility 窗 handle 暂缺（multi-uiability-windows NG2/NG7） |
