# ohos-platform-limitations 规格(delta)

> 本 delta 固化 ohos-committer-issues-jia-p1 第 0 波披露批(零行为变更)写入公开 facade 文档的平台限制语义。全部 Scenario 的验证方式 = 代码走查/grep(对应落点存在含指定语义的 OHOS 披露行),无设备用例;落点行号以 design.md D5 为设计锚。

## ADDED Requirements

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
