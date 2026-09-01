# ohos-deep-link-event Specification

## Purpose
TBD - created by archiving change p1-deep-link. Update Purpose after archive.
## Requirements
### Requirement: deep-link crate 在 OHOS target 编译通过且不影响其他平台
`tauri-plugin-deep-link` SHALL 在 OHOS target（`target_env="ohos"`）下编译成功。所有 OHOS 代码 SHALL 通过 `cfg(target_env="ohos")` 隔离。Linux 专属依赖（`rust-ini`）SHALL 加 `not(target_env="ohos")` 排除，不得引入 OHOS。Windows/macOS/Linux/iOS/Android 的现有代码路径 SHALL 保持不变。

#### Scenario: OHOS target 编译成功
- **WHEN** 使用 OHOS target 编译 `tauri-plugin-deep-link` crate
- **THEN** SHALL 编译成功，`init_deep_link` 返回有效的 `DeepLink<R>`，无"函数无返回值"或"Linux 分支误命中"错误

#### Scenario: 非 OHOS target 不受影响
- **WHEN** 使用 Windows/macOS/Linux/iOS/Android target 编译
- **THEN** 现有平台实现 SHALL 不受任何影响，行为与改动前一致

### Requirement: 运行中收到外部链接触发 deep-link 事件
当 app 已在运行，OHOS 通过 `onNewWant` 投递携带有效 `want.uri` 的 Want 时，经 `Event::NewWant` → tao `Event::Opened{urls}` → `RunEvent::Opened{urls}` 链路，deep-link 插件的 `on_event` 闭包 SHALL emit `deep-link://new-url` 事件（payload 为 `Vec<Url>`），并更新内部 `current` 状态。

#### Scenario: OHOS 单 URL 场景
- **WHEN** app 运行中，OHOS 调用 `onNewWant(want)` 且 `want.uri` 为 `"myapp://path"`
- **THEN** tao 将单个 `want.uri` 解析为 `vec!["myapp://path"]`，插件 SHALL emit `deep-link://new-url`，payload 为 `["myapp://path"]`，`current` 更新为该 URL

#### Scenario: 多 URL 场景（仅 macOS/iOS）
- **WHEN** `RunEvent::Opened { urls }` 中 `urls` 含多个有效 URL（macOS/iOS 系统可能传多 URL）
- **THEN** 插件 SHALL 将完整 `Vec<Url>` 作为 payload emit，`current` 更新为该完整列表
- **NOTE** OHOS 的 tao 实现将单个 `want.uri` 解析为单元素 `Vec`（`tao platform_impl/ohos/mod.rs:595-609`），不产生多 URL

### Requirement: 空 URI 的再启动不触发 deep-link 事件
OHOS 的 `onNewWant` 在 singleton 模式下每次"再启动"都触发，即使无 URI 也 emit 空 `Vec`（`tao platform_impl/ohos/mod.rs:596`）。deep-link 插件 SHALL 过滤 `urls.is_empty()`，不得在无链接的再启动时 emit `deep-link://new-url`，避免误触发前端监听器。

#### Scenario: onNewWant 空 URI
- **WHEN** app 运行中，OHOS 调用 `onNewWant(want)` 且 `want.uri` 为空字符串
- **THEN** `RunEvent::Opened { urls: vec![] }` 被投递，但插件 SHALL 不 emit `deep-link://new-url`，`current` SHALL 保持不变

### Requirement: register/unregister 在 OHOS 返回 no-op，is_registered 返回 Ok(false)
OHOS 上运行时动态注册 scheme 不被支持（scheme 声明由 Phase 2 的 module.json5 skills 处理）。`register`/`unregister` SHALL 在 OHOS 独立 `#[cfg(target_env="ohos")]` 分支返回 `Ok(())`（no-op）；`is_registered` SHALL 返回 `Ok(false)`（OHOS 无运行时注册状态）。`register`/`unregister`/`is_registered` 的 `#[cfg(target_os="linux")]` 分支 SHALL 修改为 `#[cfg(all(target_os="linux", not(target_env="ohos")))]` 避免与 ohos 独立分支冲突（E0592）；fallback 分支 `#[cfg(not(any(windows, target_os="linux")))]` 不变（macOS/iOS 仍命中返回 UnsupportedPlatform）。

#### Scenario: 调用 register 返回 no-op
- **WHEN** 在 OHOS 上调用 `deep_link.register("myapp")`
- **THEN** SHALL 返回 `Ok(())`，不执行任何注册操作

#### Scenario: 调用 unregister 返回 no-op
- **WHEN** 在 OHOS 上调用 `deep_link.unregister("myapp")`
- **THEN** SHALL 返回 `Ok(())`

#### Scenario: 调用 is_registered 返回 false
- **WHEN** 在 OHOS 上调用 `deep_link.is_registered("myapp")`
- **THEN** SHALL 返回 `Ok(false)`

#### Scenario: Linux 分支不误命中 OHOS
- **WHEN** 在 OHOS 上调用 `register`/`unregister`/`is_registered`
- **THEN** SHALL 不执行 `xdg-mime`/`update-desktop-database` 等 Linux 桌面命令，不读写 `mimeapps.list`

### Requirement: 首启动 get_current 经 take_initial_want_uri 注入 current
冷启动由链接拉起时，`NativeAbility.onCreate` 提取 `want.uri` 经 `onAbilityCreateWithWant` 闭包存储到 `INITIAL_WANT_URI`（openharmony-ability 新增，复刻 `take_want_parameters` 模式，pull 模型，无新 Event 变体）；deep-link 的 `init_deep_link` OHOS 分支在返回前调 `openharmony_ability::take_initial_want_uri()`，将首启动 uri 解析为 `Url` 存入 `current`。`get_current` SHALL 返回 `current`（首启动值由 init 注入，运行中值由 `on_event` 更新）。

#### Scenario: 冷启动由链接拉起
- **WHEN** app 未运行，由 `"myapp://path"` 链接拉起，`onCreate` 的 `want.uri="myapp://path"`，插件初始化后调用 `get_current`
- **THEN** SHALL 返回 `Ok(Some(vec!["myapp://path"]))`

#### Scenario: 冷启动非链接拉起
- **WHEN** app 冷启动但 `want.uri` 为空，插件初始化后调用 `get_current`
- **THEN** SHALL 返回 `Ok(None)`

#### Scenario: 运行中收到链接后 get_current
- **WHEN** 已通过 `onNewWant` 收到 `"myapp://path"` 并触发 `RunEvent::Opened` 更新 `current`，调用 `get_current`
- **THEN** SHALL 返回 `Ok(Some(vec!["myapp://path"]))`

### Requirement: on_open_url 监听 API 在 OHOS 行为一致
deep-link 插件的 `on_open_url` 方法（`lib.rs:515`）SHALL 在 OHOS 上监听 `deep-link://new-url` 事件，收到时回调 `OpenUrlEvent{urls}`，返回 `EventId` 供 `unlisten` 使用。行为 SHALL 与 macOS/iOS 一致。

#### Scenario: 注册监听后收到链接
- **WHEN** 前端调用 `on_open_url` 注册回调，app 运行中收到 `onNewWant` 携带 `"myapp://path"`
- **THEN** 回调 SHALL 被调用，`OpenUrlEvent.urls` 包含 `["myapp://path"]`，返回有效 `EventId`

#### Scenario: unlisten 取消监听
- **WHEN** 用返回的 `EventId` 调用 `Listener::unlisten`
- **THEN** 后续 `deep-link://new-url` 事件 SHALL 不再触发该回调

### Requirement: want.parameters 不影响 deep-link 事件
OHOS 的 `want.parameters` 通过 `openharmony_ability::take_want_parameters()` 独立读取（`ohos-want-parameters` spec），**不随** `RunEvent::Opened{urls}` 传递。deep-link 插件 SHALL 只消费 `urls`，不读取 `want.parameters`。`take_initial_want_uri` 只存储 `want.uri`，不存储 parameters。

#### Scenario: onNewWant 携带 parameters 不影响 deep-link
- **WHEN** `onNewWant(want)` 携带 `want.uri="myapp://path"` 且 `want.parameters={"source":"widget"}`
- **THEN** deep-link 插件 emit 的 `deep-link://new-url` payload SHALL 仅含 `["myapp://path"]`，不包含 parameters 信息

### Requirement: scheme 匹配由系统 module.json5 skills 决定（Phase 2 范围）
OHOS 上 URI scheme 的匹配过滤由系统 `module.json5` 的 `skills/uris` 声明决定（Phase 2 实现）。Phase 1 范围内，deep-link 插件的 `on_event` SHALL 不对 `urls` 做二次 scheme 过滤——收到的 `urls` 均为系统 skills 匹配后路由到 app 的结果。

#### Scenario: Phase 1 不做 scheme 二次过滤
- **WHEN** `RunEvent::Opened { urls }` 投递到 `on_event`（`urls` 已由系统 skills 匹配）
- **THEN** 插件 SHALL 直接 emit `urls`，不做 scheme 匹配过滤

#### Scenario: 未配置 skills 的 scheme 不唤起（Phase 2 范围）
- **WHEN** `module.json5` 未声明某 scheme 的 skills，外部链接使用该 scheme
- **THEN** 系统 SHALL 不路由到 app，`onNewWant` 不触发（此为 Phase 2 module.json5 skills 声明的职责，Phase 1 不处理）

