## ADDED Requirements

### Requirement: plugin-window 支持 set-touchable action
`plugin-window` facade SHALL 提供 `WindowClient::set_window_touchable(window_id: i64, touchable: bool)` 异步方法，通过 `set-touchable` bridge action 将窗口触摸穿透设置推送到 ArkTS 侧。请求类型 SHALL 为 `WindowTouchableRequest`，TYPE_NAME 为 `ohos.window.TouchableRequest`。

#### Scenario: 设置窗口不可触摸
- **WHEN** consumer 调用 `window_client.set_window_touchable(1, false).await`
- **THEN** bridge 发送 `set-touchable` action 携带 `{ window_id: 1, touchable: false }` 到 ArkTS 侧
- **THEN** ArkTS 侧调用 `setWindowTouchable(1, false)` 并返回 acknowledgement

#### Scenario: 设置窗口可触摸
- **WHEN** consumer 调用 `window_client.set_window_touchable(1, true).await`
- **THEN** bridge 发送 `set-touchable` action 携带 `{ window_id: 1, touchable: true }`

#### Scenario: 无效 window_id 被拒绝
- **WHEN** consumer 调用 `window_client.set_window_touchable(-1, true).await`
- **THEN** facade 在发送前验证 window_id 并返回 Error

### Requirement: plugin-menu 支持同步 is_menubar_visible 查询
`plugin-menu` facade SHALL 提供 `MenuClient::is_menubar_visible(window_id: &str) -> bool` 同步方法，从 Rust 本地缓存读取 per-window menubar 可见性状态。可见性 = menubar_visible 缓存 AND menu_has_content 缓存。默认值为 true。

#### Scenario: 默认窗口 menubar 可见
- **WHEN** 从未调用过 `set_menubar_visible` 的窗口查询 `is_menubar_visible("main")`
- **THEN** 返回 `true`（默认值）

#### Scenario: 隐藏后查询返回 false
- **WHEN** 调用 `set_menubar_visible(MenuSetVisibleRequest { visible: false, window_id: "main" })` 后查询
- **THEN** 返回 `false`

#### Scenario: 空菜单 JSON 导致不可见
- **WHEN** 调用 `set_menu_json("[]", "main")` 后（即使 visible=true）查询 `is_menubar_visible("main")`
- **THEN** 返回 `false`（menu has content = false）

### Requirement: plugin-menu 支持 set_menu_json 方法
`plugin-menu` facade SHALL 提供 `MenuClient::set_menu_json(json_data: String, window_id: String)` 异步方法，内部映射到现有 `set-menubar` bridge action。调用时同步更新 `menu_has_content` 缓存。

#### Scenario: 设置非空菜单 JSON
- **WHEN** consumer 调用 `menu_client.set_menu_json("[{\"id\":\"open\"}]", "main").await`
- **THEN** bridge 发送 `set-menubar` action 携带 `MenuSetMenubarRequest { json_data, window_id }`
- **THEN** `menu_has_content` 缓存更新为 `true`

#### Scenario: 设置空菜单 JSON
- **WHEN** consumer 调用 `menu_client.set_menu_json("[]", "main").await`
- **THEN** bridge 发送 `set-menubar` action
- **THEN** `menu_has_content` 缓存更新为 `false`
