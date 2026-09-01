# ohos-window-blur Specification

## Purpose
TBD - created by archiving change p1-window-vibrancy. Update Purpose after archive.
## Requirements
### Requirement: window-vibrancy OHOS 平台支持

`window-vibrancy` crate SHALL 新增 OHOS 平台支持。在 `cfg(target_env = "ohos")` 下依赖 `openharmony-ability`（与 Windows 依赖 `windows-sys`、macOS 依赖 `objc2-app-kit` 模式一致），提供 OHOS 专用 API。

#### Scenario: apply_ohos_blur 设置模糊
- **WHEN** 调用 `window_vibrancy::apply_ohos_blur(window_id, radius)`
- **THEN** SHALL 调用 `openharmony_ability::set_window_blur(window_id, radius)` 将模糊效果应用到指定窗口的 WebView 容器组件
- **测试分类**: `manual`（需人工确认模糊效果可见）

#### Scenario: clear_ohos_blur 清除模糊
- **WHEN** 调用 `window_vibrancy::clear_ohos_blur(window_id)`
- **THEN** SHALL 调用 `openharmony_ability::set_window_blur(window_id, 0.0)` 关闭模糊
- **测试分类**: `side-effect`（验证模糊效果被移除）

#### Scenario: apply_ohos_acrylic 设置亚克力效果
- **WHEN** 调用 `window_vibrancy::apply_ohos_acrylic(window_id, radius, color)`
- **THEN** SHALL 调用 `openharmony_ability::set_window_blur(window_id, radius)` 并设置半透明背景色
- **测试分类**: `manual`

#### Scenario: Mica 系列不支持（2026-08-26 移除云母近似）
- **WHEN** 传入 Mica/Tabbed 系列 Effect
- **THEN** SHALL 不应用任何效果（no-op 跳过并记录 info 日志），`apply_ohos_mica` API 已删除
- **测试分类**: `auto`

#### Scenario: 设备不支持时静默跳过
- **WHEN** 调用 OHOS 模糊 API 但设备不支持
- **THEN** SHALL 返回 `Ok(())`，不中断执行
- **测试分类**: `auto`

### Requirement: openharmony-ability 窗口模糊 NAPI 桥接

`openharmony-ability` SHALL 提供 `set_window_blur(window_id: i64, radius: f64) -> napi_ohos::Result<()>` NAPI 函数。该函数 SHALL 遵循 `set_window_background_color` 相同的桥接模式（`get_helper()` + `get_main_thread_env()` + ArkTS 函数调用）。

#### Scenario: 设置主窗口模糊
- **WHEN** 调用 `set_window_blur(0, 20.0)`，windowId=0 表示主窗口
- **THEN** ArkTS WindowManager SHALL 将 `backdropBlur(20)` 应用到主窗口的 WebView 容器组件
- **测试分类**: `manual`

#### Scenario: 设置子窗口模糊
- **WHEN** 调用 `set_window_blur(id, 30.0)`，id 为已创建的子窗口 ID
- **THEN** ArkTS WindowManager SHALL 将 `backdropBlur(30)` 应用到对应子窗口的 WebView 容器组件
- **测试分类**: `manual`

#### Scenario: 模糊半径为 0 关闭模糊
- **WHEN** 调用 `set_window_blur(window_id, 0.0)`
- **THEN** ArkTS WindowManager SHALL 将 `backdropBlur(0)` 应用到组件，关闭模糊效果
- **测试分类**: `side-effect`

### Requirement: ArkTS WindowManager setWindowBlur 方法

ArkTS `WindowManager` SHALL 新增 `setWindowBlur(windowId: number, radius: number): void` 方法。该方法 SHALL 将 `backdropBlur(radius)` 组件属性应用到指定窗口的 WebView 容器组件（`DefaultXComponent` 的外层 Stack）。

#### Scenario: 主窗口模糊（windowId=0）
- **WHEN** `windowId` 为 0 且 `windowStage` 已初始化
- **THEN** SHALL 更新主窗口 WebView 容器的 blur 状态，使 `backdropBlur(radius)` 生效
- **测试分类**: `manual`

#### Scenario: 子窗口模糊
- **WHEN** `windowId` 不为 0 且存在于 `windows` Map 中
- **THEN** SHALL 更新对应子窗口 WebView 容器的 blur 状态
- **测试分类**: `manual`

#### Scenario: 窗口不存在时静默忽略
- **WHEN** `windowId` 不在管理范围内
- **THEN** SHALL 记录 warn 日志并返回，不抛异常
- **测试分类**: `auto`

### Requirement: Tauri vibrancy OHOS 平台实现

`tauri` crate SHALL 在 `vibrancy` 模块中新增 OHOS 平台实现，当 `cfg(target_env = "ohos")` 时调用 `window_vibrancy` 的 OHOS API。映射 SHALL 通过 dispatcher 消息链传递（`WindowDispatch::set_window_effects` → `WindowMessage::SetEffects` → event loop → tao `Window::set_window_effects`），与 `set_background_color` 的架构模式一致。

#### Scenario: Blur 效果映射
- **WHEN** `WindowEffectsConfig.effects` 包含 `Effect::Blur`
- **THEN** SHALL 调用 `window_vibrancy::apply_ohos_blur(window_id, radius)`
- **THEN** radius SHALL 取 `WindowEffectsConfig.radius` 的值，若未指定则默认 20.0
- **测试分类**: `manual`

#### Scenario: Acrylic 效果映射
- **WHEN** `WindowEffectsConfig.effects` 包含 `Effect::Acrylic`
- **THEN** SHALL 调用 `window_vibrancy::apply_ohos_acrylic(window_id, 25.0, color)`
- **测试分类**: `manual`

#### Scenario: Mica/Tabbed 系列效果不支持
- **WHEN** `WindowEffectsConfig.effects` 包含 `Effect::Mica` / `MicaDark` / `MicaLight` / `Effect::Tabbed` / `TabbedDark` / `TabbedLight`
- **THEN** SHALL 不应用任何效果（no-op 跳过并记录 info 日志），不返回错误
- **测试分类**: `auto`

#### Scenario: 清除效果
- **WHEN** `set_window_effects` 传入 `effects: None`
- **THEN** SHALL 调用 `window_vibrancy::clear_ohos_blur(window_id)` 关闭模糊
- **测试分类**: `side-effect`

#### Scenario: 窗口创建时自动应用效果
- **WHEN** `WindowAttributes.window_effects` 已配置
- **THEN** 窗口创建完成后 SHALL 自动调用 `set_window_effects` 应用效果（已有代码路径）
- **测试分类**: `manual`

### Requirement: Effect 类型优先级

当 `WindowEffectsConfig.effects` 包含多个 Effect 时，SHALL 取第一个可映射的 Effect 并忽略其余，与 Windows/macOS 行为一致。

#### Scenario: 多 Effect 取首个
- **WHEN** `effects` 为 `[Effect::Acrylic, Effect::Blur]`
- **THEN** SHALL 仅应用 Acrylic 效果，忽略 Blur
- **测试分类**: `auto`

#### Scenario: 无可映射 Effect 时静默跳过
- **WHEN** `effects` 列表为空或全部为 macOS 专属材质
- **THEN** SHALL 不调用任何 OHOS API，不返回错误
- **测试分类**: `auto`

### Requirement: Dispatcher 消息链支持窗口效果

`WindowDispatch` trait SHALL 新增 `set_window_effects(effects: Option<WindowEffectsConfig>)` 方法，通过 `WindowMessage::SetEffects` 转发到 event loop handler，handler 调用 tao `Window::set_window_effects`。此模式与 `set_background_color` 一致。

#### Scenario: set_window_effects 消息传递
- **WHEN** tauri `Window::set_effects()` 被调用
- **THEN** SHALL 通过 dispatcher 发送 `WindowMessage::SetEffects(effects)` 消息
- **THEN** event loop handler SHALL 调用 `tao_window.set_window_effects(effects)`
- **测试分类**: `auto`

#### Scenario: tao OHOS Window 处理窗口效果
- **WHEN** tao `Window::set_window_effects` 被调用且 `self.window_id` 不为 None
- **THEN** SHALL 根据 Effect 类型调用 `window_vibrancy::apply_ohos_blur` / `apply_ohos_acrylic`（Mica/Tabbed 系列跳过）
- **测试分类**: `manual`

### Requirement: 运行时 backdropBlur/backgroundColor 刷新（AttributeUpdater）

`openharmony-ability` SHALL 用 `AttributeUpdater`（BlurModifier）运行时刷新 `backdropBlur`/`backgroundColor`，因为 `BuilderNode.update` 不刷新组件属性。`@Builder` 函数内不能用 `@State`，`AttributeUpdater` 的 `attribute?.backdropBlur(radius)` 不需 @State 即可立即触发组件更新。

#### Scenario: 运行时 setEffects 刷新 backdropBlur
- **WHEN** `Window::set_effects` 调用（runtime）
- **THEN** SHALL 通过 `run_on_main_thread` 在 main thread 执行 `set_window_blur`（thread_local `MAIN_THREAD_ENV` 可用）
- **AND** SHALL 通过 `BlurModifier.attribute?.backdropBlur(radius)` 立即刷新组件 backdropBlur
- **测试分类**: `manual`（需人工确认模糊效果可见）

#### Scenario: 运行时 setEffects 刷新 backgroundColor（Acrylic tint）
- **WHEN** `set_window_background_color` 调用（Acrylic tint）
- **THEN** SHALL 通过 `BlurModifier.attribute?.backgroundColor(color)` 立即刷新组件 backgroundColor
- **AND** SHALL 用 `FnArgs<(i64, u32)>` 调用 NAPI（裸 tuple 只传 1 个参数，7bd67be 修了 set_window_blur 但漏了 set_window_background_color）
- **测试分类**: `manual`（需人工确认 tint 可见）

#### Scenario: build-time effects 在窗口创建时应用
- **WHEN** `WindowBuilder::effects` 配置 effects
- **THEN** SHALL 在 `WindowBuilder::build` 时通过 `run_on_main_thread` apply effects
- **AND** SHALL 通过 `registerController` inject blurRadius 到 build data（pendingBlurs），`backdropBlur` 在 Stack build 时设置
- **测试分类**: `manual`（窗口出现时即模糊）

#### Scenario: BlurModifier initializeModifier 不覆盖 build-time backdropBlur
- **WHEN** BlurModifier 绑定到 Stack
- **THEN** `initializeModifier` SHALL 不设置 backdropBlur（让 build 时 `Stack.backdropBlur(data.style.blurRadius)` 生效）
- **AND** 运行时 `attribute?.backdropBlur(radius)` SHALL 覆盖 build 时值
- **测试分类**: `side-effect`（build-time effects 用例验证不抛错）

