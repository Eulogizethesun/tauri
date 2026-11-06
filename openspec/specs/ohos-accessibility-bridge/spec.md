# ohos-accessibility-bridge Specification

## Purpose
TBD - created by archiving change p1-ohos-accessibility. Update Purpose after archive.
## Requirements
### Requirement: 无障碍 bridge 插件 SHALL 提供字号缩放查询
openharmony-ability SHALL 提供 `accessibility` 桥接插件(id=`ohos.accessibility`),其 `get-font-scale` action SHALL 返回 `context.abilityContext.config.fontScale` 数值。该查询 SHALL 无权限要求,SHALL NOT 在权限/异常时 panic。

#### Scenario: 查询系统字号缩放
- **WHEN** Rust 侧调用 `AccessibilityClient::get_font_scale()`
- **THEN** SHALL 返回当前系统 fontScale(默认 1.0)
- **AND** abilityContext 不可用时 SHALL 返回结构化错误

### Requirement: 读屏与触摸探索状态查询 SHALL 结构化降级
`is-open-accessibility` / `is-touch-explore-enabled` action SHALL 调用 `@kit.AccessibilityKit` accessibility 命名空间的 `isScreenReaderOpenSync()` / `isOpenTouchGuide()`(API 名称以编译通过为准,旧名 `isOpenAccessibility`/`isOpenTouchExploreState` 为废弃口径),结果经 `invokeAsync` 返回。当系统权限拒绝或其他异常时,ArkTS 侧 SHALL 捕获 BusinessError 并 throw 结构化错误信息(含错误码与消息),bridge runtime SHALL 传播为 Rust Err,Rust 侧 SHALL 按错误码映射 `PermissionDenied`/`Unavailable` 错误变体,SHALL NOT panic 或静默吞错。

#### Scenario: 权限可用时查询读屏状态
- **WHEN** 三方应用有权调用且调用 `is_open_accessibility()`
- **THEN** SHALL 返回 `{ enabled: bool }`

#### Scenario: 权限被拒
- **WHEN** 系统 ACCESSIBILITY 权限拒绝该查询
- **THEN** SHALL 返回 `AccessibilityError::PermissionDenied`,携带原始错误码

### Requirement: 无障碍状态变化 SHALL 以 invokeNativeSync 事件推送
`subscribe-state-change` action SHALL 注册 `accessibility.on('screenReaderStateChange')` 回调,变化发生时 SHALL 经 `context.invokeNativeSync("accessibility-state-changed", ...)` 推送事件(载荷含 `{ enabled: boolean }`)到 Rust,由 `BridgePlugin::on_main_thread_event` 接收(WebviewPlugin notifyNative 先例)。`unsubscribe-state-change` 与插件销毁 SHALL `off` 回调。

#### Scenario: 订阅后系统读屏开关切换
- **WHEN** 已订阅且用户在系统设置切换屏幕朗读
- **THEN** Rust 事件流 SHALL 收到 `accessibility-state-changed` 事件

#### Scenario: 重复订阅与退订
- **WHEN** 同一插件实例重复订阅或退订
- **THEN** SHALL 幂等(不重复回调、off 后不再收到事件)

### Requirement: 插件 SHALL 纳入统一注册链路
AccessibilityPlugin SHALL 继承 `AsyncPluginBase`,`requires = ["ability"]`,action 分发与字段命名遵循 bridge 硬规则(camelCase wire)。pack-plugins.ps1 SHALL 收录该插件(16/16),EntryAbility.ets.hbs 模板(desktop+mobile)与 examples/api gen 双份 SHALL 注册 `new LazyPlugin(() => new AccessibilityPlugin())`。

#### Scenario: 构建产物包含新插件
- **WHEN** 重建 HAR 并构建 examples/api
- **THEN** HAR package 内 SHALL 存在 AccessibilityPlugin.ets
- **AND** 启动日志 SHALL 无 "not installed for 'api_lib'" 报错
- **AND** `cargo check -p openharmony-ability-plugin-accessibility` 双侧(host + ohos target)0 error

### Requirement: Rust facade SHALL 以类型化 client 暴露
`crates/plugin-accessibility` SHALL 提供 `AccessibilityClient`(`AccessibilityExt::accessibility(&OpenHarmonyApp) -> Result<Self>` 构造),方法 `get_font_scale()` / `is_open_accessibility()` / `is_touch_explore_enabled()` / `subscribe_state_change(handler)` / `unsubscribe_state_change()`,全部 `cfg(target_env = "ohos")` 隔离,SHALL 经 bridge call_async 异步调用,SHALL NOT 在主线程 block_on。

#### Scenario: facade 编译隔离
- **WHEN** 在非 OHOS target 编译 openharmony-ability workspace
- **THEN** plugin-accessibility 的 OHOS 专属代码 SHALL NOT 参与 Windows/macOS/Linux 构建

