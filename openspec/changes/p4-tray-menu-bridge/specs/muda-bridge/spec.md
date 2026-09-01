# muda OHOS bridge 迁移规格

## 规格范围

本规格覆盖 `muda/src/platform_impl/ohos/` 目录下所有文件的 bridge 迁移。涉及 2 个文件：`mod.rs`、`icon.rs`。

## 1. 依赖变更

### 1.1 Cargo.toml

```toml
[target.'cfg(target_env = "ohos")'.dependencies]
# 保留：核心类型
openharmony-ability = { path = "../openharmony-ability/crates/ability" }
# 新增：plugin-menu facade
openharmony-ability-plugin-menu = { path = "../openharmony-ability/crates/plugin-menu" }
# 保留不变
serde = { version = "1", features = ["derive"] }
serde_json = "1"
base64 = "0.22"
png = "0.18"
```

移除 `features = ["menu"]`，menu 功能由独立 plugin crate 提供。

### 1.2 模块引用变更

| 旧引用 | 新引用 | 文件 |
|--------|--------|------|
| `openharmony_ability::menu::MenuItemData` | `openharmony_ability_plugin_menu::MenuItemData` | mod.rs |
| `openharmony_ability::menu::AboutMetadataData` | `openharmony_ability_plugin_menu::AboutMetadataData` | mod.rs |
| `openharmony_ability::menu::popup_context_menu` | `MenuClient::popup(request)` | mod.rs |
| `openharmony_ability::menu::set_menu_json` | `MenuClient::set_menubar(request)` | mod.rs |
| `openharmony_ability::menu::menu_event_receiver` | plugin `on_main_thread_event("menu-click")` → crossbeam 中转 | mod.rs |

## 2. MenuClient 初始化

### 2.1 全局 client 存储

muda 当前不持有 `OpenHarmonyApp` 引用（菜单操作通过全局 channel + TSFN 转发）。迁移后需要获取 `MenuClient`。

**注意**：muda 当前没有 `set_ohos_app` 函数，也不持有 `OpenHarmonyApp`。采用**方案 A**（推荐）：muda 新增 `set_menu_client(client: MenuClient)` 全局初始化函数，由 tray-icon 或 tauri 在启动时调用。tray-icon 的 `set_ohos_app` 创建 `StatusBarClient` 后，同时创建 `MenuClient` 并调用 `muda::platform_impl::ohos::set_menu_client(client)`。

```rust
static MENU_CLIENT: once_cell::sync::OnceCell<openharmony_ability_plugin_menu::MenuClient> =
    once_cell::sync::OnceCell::new();

/// 由 tray-icon 或 tauri 在启动时调用，注入已创建的 MenuClient。
/// muda 不自行创建 MenuClient（不持有 OpenHarmonyApp 引用）。
pub fn set_menu_client(client: openharmony_ability_plugin_menu::MenuClient) {
    MENU_CLIENT.set(client).expect("MENU_CLIENT already set");
}

pub(crate) fn get_menu_client() -> &'static openharmony_ability_plugin_menu::MenuClient {
    MENU_CLIENT.get().expect("MENU_CLIENT not initialized")
}
```

**tray-icon 侧初始化代码**（在 `set_ohos_app` 中同时初始化 muda 的 client）：

```rust
// tray-icon/src/platform_impl/ohos/mod.rs
pub fn set_ohos_app(app: openharmony_ability::OpenHarmonyApp) {
    let statusbar_client = openharmony_ability_plugin_statusbar::StatusBarClient::new(&app)
        .expect("Failed to create StatusBarClient");
    let menu_client = openharmony_ability_plugin_menu::MenuClient::new(&app)
        .expect("Failed to create MenuClient");
    OHOS_APP.set(app).expect("OHOS_APP already set");
    STATUSBAR_CLIENT.set(statusbar_client).expect("STATUSBAR_CLIENT already set");
    // 注入 muda 的 MenuClient
    muda::platform_impl::ohos::set_menu_client(menu_client);
}
```

**备选方案**（如果 muda 需要独立于 tray-icon 初始化）：
- 方案 B：`MenuClient` 从全局 `OpenHarmonyApp` 静态引用创建（如果 `OpenHarmonyApp` 有全局访问点）
- 方案 C：plugin-menu crate 提供全局 `menu_client()` 函数，内部从 bridge registry 获取

## 3. Menu 方法迁移

### 3.1 Menu::popup()

```rust
// 旧 (line 125)
openharmony_ability::menu::popup_context_menu(json, x, y, window_id.to_string())
    .map_err(|e| crate::Error::CustomError(e.to_string()))?;

// 新
let client = get_menu_client();
let request = MenuPopupRequest {
    json_data: json,
    x,
    y,
    window_id: window_id.to_string(),
};
futures::executor::block_on(client.popup(request))
    .map_err(|e| crate::Error::CustomError(e.to_string()))?;
```

### 3.2 Menu::refresh_menubar()

```rust
// 旧 (line 133)
openharmony_ability::menu::set_menu_json(json, window_id.to_string())
    .map_err(|e| crate::Error::CustomError(e.to_string()))?;

// 新
let client = get_menu_client();
let request = MenuSetMenubarRequest {
    json_data: json,
    window_id: window_id.to_string(),
};
futures::executor::block_on(client.set_menubar(request))
    .map_err(|e| crate::Error::CustomError(e.to_string()))?;
```

### 3.3 MenuChild::popup()

```rust
// 旧 (line 475)
openharmony_ability::menu::popup_context_menu(json, x, y, window_id.to_string())
    .map_err(|e| crate::Error::CustomError(e.to_string()))?;

// 新（同 3.1）
```

### 3.4 set_menubar_visible()

muda 当前不直接调用 `set_menubar_visible`（该功能在 `openharmony-ability` 的 menu 模块中暴露但 muda 未使用）。如果 tauri 上层需要该功能，通过 `MenuClient::set_menubar_visible(request)` 调用。

### 3.5 is_menubar_visible()

muda 当前不直接调用 `is_menubar_visible`。该函数保留在 plugin-menu crate 中作为 Rust API。

## 4. 事件监听迁移

### 4.1 start_event_listener()

```rust
// 旧 (line 522)
let receiver = openharmony_ability::menu::menu_event_receiver();
while let Ok(menu_id) = receiver.recv() {
    // check toggle + MenuEvent::send
}

// 新
// 如果 plugin-menu 保留 menu_event_receiver() 公共 API：
let receiver = openharmony_ability_plugin_menu::menu_event_receiver();
while let Ok(menu_id) = receiver.recv() {
    // 逻辑不变
}
```

**设计决策：plugin-menu 保留 `menu_event_receiver()` 公共 API**。`on_main_thread_event("menu-click")` 在 plugin-menu 内部将 `menu_id` 发送到 crossbeam channel，muda 通过 `menu_event_receiver()` 消费。muda 的事件转发线程逻辑不变，仅 import 路径变更。

### 4.2 init_menu_event_listener()

无变化。`init_menu_event_listener()` 调用 `start_event_listener()`，后者检查 `EVENT_LISTENER_STARTED` 原子标志。

### 4.3 collect_check_items()

无变化。`CHECK_ITEMS` 全局 `Mutex<HashMap<String, Arc<AtomicBool>>>` 和 `collect_check_items` / `collect_check_item_recursive` 逻辑不变。

## 5. MenuItemData 类型迁移

### 5.1 类型路径变更

```rust
// 旧
use openharmony_ability::menu::MenuItemData;
use openharmony_ability::menu::AboutMetadataData;

// 新
use openharmony_ability_plugin_menu::MenuItemData;
use openharmony_ability_plugin_menu::AboutMetadataData;
```

### 5.2 MenuChild::to_menu_item_data()

该方法构造 `MenuItemData`，字段和逻辑完全不变。仅类型路径变更。

### 5.3 Menu::to_json()

```rust
pub fn to_json(&self) -> String {
    serde_json::to_string(&self.to_menu_items()).unwrap_or_default()
}
```

无变化。`to_menu_items()` 返回 `Vec<MenuItemData>`，JSON 序列化格式不变。

## 6. 不变项

| 项目 | 说明 |
|------|------|
| `icon.rs` 全部 | 纯 Rust `PlatformIcon` 结构，不涉及桥接 |
| `Menu` / `MenuChild` 结构定义 | 纯 Rust 菜单树结构 |
| `KeyAccelerator` | 键盘快捷键格式化 |
| `CHECK_ITEMS` | check item 状态全局 Mutex |
| `EVENT_LISTENER_STARTED` | 事件监听线程原子标志 |
| `COUNTER` | 菜单项 ID 计数器 |
| `encode_rgba_to_png` | 图标 PNG 编码 |
| `native_icon_to_ohos` | NativeIcon → OHOS 系统符号映射 |
| 所有单元测试 | 纯逻辑测试，不涉及桥接 |

## 7. 验证

| 验证项 | 方式 |
|--------|------|
| cargo check OHOS target | `cargo check --target aarch64-unknown-linux-ohos` |
| cargo check Windows | 确认非 OHOS 平台不受影响 |
| 设备端 menubar 显示 | 桌面设备运行 demo，确认菜单栏出现 |
| 设备端 menu click | 点击菜单项，确认 MenuEvent 正确传递 |
| 设备端 popup menu | 调用 `menu.popup()`，确认弹出菜单 |
| 设备端 check toggle | 点击 check 菜单项，确认选中状态切换 |
| 设备端 submenu | 展开子菜单，确认子菜单项可点击 |
| 设备端 accelerator | 菜单项 accelerator 文本正确显示 |
| 设备端 predefined action | 预定义菜单项（copy/cut/paste）功能正常 |
| 设备端 icon in menu | 图标菜单项正确显示图标 |

## 8. ArkTS 字段命名约束（与 Rust NAPI wire 对齐）

`MenuPlugin.ets` 的 request interface 字段名**必须**取 NAPI 自动生成的 camelCase（Rust `#[napi(object)]` snake_case → ArkTS camelCase，见 `openharmony-ability/.agents/skills/named-napi-contracts/references/contract-table.md:9`），与 `plugin-menu/src/lib.rs` wire 结构体一字不差：

| Rust wire 结构体 | Rust 字段 | ArkTS 读取属性 |
|---|---|---|
| `MenuSetMenubarRequest` | `json_data` / `window_id` | `jsonData` / `windowId` |
| `MenuPopupRequest` | `json_data` / `x` / `y` / `window_id` | `jsonData` / `x` / `y` / `windowId` |
| `MenuSetVisibleRequest` | `visible` / `window_id` | `visible` / `windowId` |
| `MenuPredefinedRequest` | `action` / `window_id` | `action` / `windowId` |

`json_data` 是 `serde_json::to_string` 的真实 JSON 字符串（muda `Menu::to_json()` 序列化），ArkTS 侧直接透传给 `onMenubarJson`/`onMenuPopup` callback，**不在 plugin 内 parse**。单词字段（`x`/`y`/`visible`/`action`）不变。

**历史偏差（已修复 2026-08-13）**：ArkTS `MenuPlugin.ets` 4 个 interface 曾用 snake_case（`json_data`/`window_id`）读取，与 NAPI wire 的 camelCase 不符 → `set-menubar.json_data must be a string`、`popup`/`set-menubar-visible` 同类失败。修法：ArkTS 侧 interface + handler 全部对齐 camelCase。**Rust 侧不变**（与 design.md §2.2 一致），`bridge/mod.rs` 框架不变。
