# Phase B4 技术设计

## 1. tray-icon 迁移

### 1.1 当前调用清单

tray-icon 的 OHOS 后端位于 `tray-icon/src/platform_impl/ohos/`，包含 3 个文件。所有 ArkTS 桥接调用集中在 `mod.rs` 和 `event.rs`。

| # | 文件 | 行号 | 旧 API | 用途 | 新 API |
|---|------|------|--------|------|--------|
| T1 | mod.rs | 61 | `statusbar::add_to_status_bar(app, &item)` | 创建托盘图标 | `StatusBarClient::add(request)` → bridge call `ohos.statusbar/add` |
| T2 | mod.rs | 78 | `statusbar::update_status_bar_icon(app, &icon)` | 更新图标 | `StatusBarClient::update_icon(request)` → bridge call `ohos.statusbar/update-icon` |
| T3 | mod.rs | 83 | `statusbar::update_status_bar_icon(app, &empty_icon)` | 清除图标 | 同 T2，传空 icon |
| T4 | mod.rs | 105 | `statusbar::update_status_bar_menu(app, &m)` | 更新菜单 | `StatusBarClient::update_menu(request)` → bridge call `ohos.statusbar/update-menu` |
| T5 | mod.rs | 109 | `statusbar::update_status_bar_menu(app, &vec![])` | 清空菜单 | 同 T4，传空 vec |
| T6 | mod.rs | 124 | `statusbar::update_hover_tips(app, t)` | 更新提示文本 | `StatusBarClient::update_tips(request)` → bridge call `ohos.statusbar/update-tips` |
| T7 | mod.rs | 140-147 | `remove_from_status_bar` + `add_to_status_bar` | set_title 重建 | `StatusBarClient::remove()` + `add()` |
| T8 | mod.rs | 157-161 | `add_to_status_bar` / `remove_from_status_bar` | set_visible | `StatusBarClient::add()` / `remove()` |
| T9 | mod.rs | 173-179 | `remove_from_status_bar` + `add_to_status_bar` | set_quick_operation 重建 | 同 T7 |
| T10 | mod.rs | 195-200 | `remove_from_status_bar` + `add_to_status_bar` | set_icon_as_template 重建 | 同 T7 |
| T11 | mod.rs | 229 | `statusbar::remove_from_status_bar(app)` | Drop 析构 | `StatusBarClient::remove()` |
| T12 | mod.rs | 232 | `statusbar::unregister_icon_click_handler()` | Drop 注销点击 | bridge 模型下由 plugin 生命周期管理，无需显式注销 |
| T13 | mod.rs | 235 | `statusbar::unregister_menu_click_handler()` | Drop 注销菜单点击 | 同 T12 |
| T14 | event.rs | 46 | `statusbar::icon_click_receiver()` | 接收图标点击事件 | `on_main_thread_event("icon-click")` |
| T15 | event.rs | 47 | `statusbar::menu_click_receiver()` | 接收菜单点击事件 | `on_main_thread_event("menu-click")` |
| T16 | event.rs | 115 | `statusbar::execute_predefined_action(predefined_type)` | 执行预定义操作 | `StatusBarClient::execute_predefined(request)` → bridge call `ohos.statusbar/execute-predefined` |
| T17 | event.rs | 184 | `statusbar::update_status_bar_menu(app, &groups)` | toggle check 后重建菜单 | `StatusBarClient::update_menu(request)` |

### 1.2 plugin-statusbar action 映射

A0 应产出 `plugin-statusbar` crate，定义 `StatusBarBridgePlugin`（ID = `"ohos.statusbar"`，Mode = `AsyncBridge`，REQUIRED_CONTEXTS = `[UiContext]`）。

| Action | 请求类型 | 响应类型 | 说明 |
|--------|---------|---------|------|
| `add` | `StatusBarAddRequest` | `StatusBarAcknowledgement` | 创建托盘图标（icon RGBA + quick_operation + menu_json + hover_tips） |
| `remove` | `StatusBarRemoveRequest` | `StatusBarAcknowledgement` | 移除托盘图标 |
| `update-icon` | `StatusBarUpdateIconRequest` | `StatusBarAcknowledgement` | 更新图标 RGBA |
| `update-menu` | `StatusBarUpdateMenuRequest` | `StatusBarAcknowledgement` | 更新菜单 JSON |
| `update-tips` | `StatusBarUpdateTipsRequest` | `StatusBarAcknowledgement` | 更新提示文本 |
| `execute-predefined` | `StatusBarPredefinedRequest` | `StatusBarAcknowledgement` | 执行预定义操作（copy/cut/paste/...） |

#### 请求类型定义（示例）

```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct StatusBarAddRequest {
    pub white_icon: Option<Vec<u8>>,    // RGBA pixels (None = no white icon)
    pub black_icon: Option<Vec<u8>>,    // RGBA pixels (template mode, None = no black icon)
    pub icon_size: u32,
    pub ability_name: String,
    pub title: String,
    pub height: u32,
    pub module_name: Option<String>,
    pub loading_status: Option<bool>,
    pub menu_json: Option<String>,
    pub hover_tips: Option<String>,
}
impl_bridge_napi_type!(StatusBarAddRequest, "ohos.statusbar.AddRequest");
```

**注意**：`white_icon` / `black_icon` 使用 `Option<Vec<u8>>` 而非 `Vec<u8>`，与旧 `StatusBarIcon.white: RefCell<Option<Vec<u8>>>` 语义一致。清除图标时传 `None`。

其他请求类型类似，字段对应旧 `AddStatusBarData` / `UpdateIconData` / `UpdateMenuData` / `UpdateTipsData` / `PredefinedActionData`。

### 1.3 反向事件

旧模型通过 `crossbeam_channel` + 全局 `OnceLock<(Sender, Receiver)>` 传递事件。新模型改为 `BridgePlugin::on_main_thread_event`。

| 事件 | 旧通道 | 新事件名 | 请求类型 | 响应类型 |
|------|--------|---------|---------|---------|
| icon-click | `icon_click_receiver()` → `StatusBarClickEvent::IconClick` | `icon-click` | `StatusBarIconClickEvent` | `std.bool` (true=已处理) |
| menu-click | `menu_click_receiver()` → `StatusBarClickEvent::MenuClick` | `menu-click` | `StatusBarMenuClickEvent` | `std.bool` (true=已处理) |

```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct StatusBarIconClickEvent {
    pub click_type: String,  // "leftClick" / "rightClick"
}
impl_bridge_napi_type!(StatusBarIconClickEvent, "ohos.statusbar.IconClickEvent");

#[napi(object)]
#[derive(Clone, Debug)]
pub struct StatusBarMenuClickEvent {
    pub menu_code: String,
}
impl_bridge_napi_type!(StatusBarMenuClickEvent, "ohos.statusbar.MenuClickEvent");
```

#### 事件接收方式

`StatusBarBridgePlugin` 实现 `on_main_thread_event`：

```rust
impl BridgePlugin for StatusBarBridgePlugin {
    fn on_main_thread_event<'env>(
        &self,
        event: BridgeMainThreadEvent<'env>,
    ) -> Result<Unknown<'env>> {
        match event.name() {
            "icon-click" => {
                let click: StatusBarIconClickEvent = event.decode()?;
                // 转发到 tray-icon 的 crossbeam channel（保持 tray-icon 内部消费不变）
                let _ = ICON_CLICK_SENDER.send(StatusBarClickEvent::IconClick {
                    click_type: click.click_type,
                });
                event.respond(true)
            }
            "menu-click" => {
                let click: StatusBarMenuClickEvent = event.decode()?;
                let _ = MENU_CLICK_SENDER.send(StatusBarClickEvent::MenuClick {
                    menu_code: click.menu_code,
                });
                event.respond(true)
            }
            _ => Err(Error::from_reason(format!(
                "Unknown event: {}", event.name()
            ))),
        }
    }
}
```

**设计决策：保留 crossbeam 中转层**。tray-icon 的 `event.rs` 中的事件转发线程（`start_event_forward_thread`）逻辑复杂（menu code 翻译、predefined action 分发、check toggle），直接在 `on_main_thread_event` 中执行会阻塞 NAPI 主线程。保留 crossbeam channel 作为 plugin → tray-icon 内部逻辑的中转，`on_main_thread_event` 仅做 decode + send，立即返回。

### 1.4 menuCode 翻译机制保留

当前 `event.rs` 中的 `translate_menu_code` 和 `remap_menu_codes_to_indices` 机制不变。该机制将系统返回的数字索引翻译回原始字符串 ID。迁移后系统侧行为不变（ArkTS 仍返回数字 menuCode），翻译逻辑在 tray-icon 侧保持。

## 2. muda 迁移

### 2.1 当前调用清单

muda 的 OHOS 后端位于 `muda/src/platform_impl/ohos/mod.rs`。

| # | 行号 | 旧 API | 用途 | 新 API |
|---|------|--------|------|--------|
| M1 | 66 | `openharmony_ability::menu::MenuItemData` | 类型引用 | `openharmony_ability_plugin_menu::MenuItemData` 或保留原路径 |
| M2 | 125 | `menu::popup_context_menu(json, x, y, window_id)` | 弹出上下文菜单 | `MenuClient::popup(request)` → bridge call `ohos.menu/popup` |
| M3 | 133 | `menu::set_menu_json(json, window_id)` | 设置菜单栏 JSON | `MenuClient::set_menubar(request)` → bridge call `ohos.menu/set-menubar` |
| M4 | 354 | `openharmony_ability::menu::AboutMetadataData` | About 元数据类型 | `openharmony_ability_plugin_menu::AboutMetadataData` |
| M5 | 475 | `menu::popup_context_menu(json, x, y, window_id)` | MenuChild popup | 同 M2 |
| M6 | 522 | `menu::menu_event_receiver()` | 接收菜单点击事件 | `on_main_thread_event("menu-click")` |

### 2.2 plugin-menu action 映射

A0 应产出 `plugin-menu` crate，定义 `MenuBridgePlugin`（ID = `"ohos.menu"`，Mode = `AsyncBridge`，REQUIRED_CONTEXTS = `[UiContext]`）。

| Action | 请求类型 | 响应类型 | 说明 |
|--------|---------|---------|------|
| `set-menubar` | `MenuSetMenubarRequest` | `MenuAcknowledgement` | 设置菜单栏 JSON + 可选 visibility |
| `popup` | `MenuPopupRequest` | `MenuAcknowledgement` | 弹出上下文菜单 |
| `set-menubar-visible` | `MenuSetVisibleRequest` | `MenuAcknowledgement` | 设置菜单栏可见性 |
| `execute-predefined` | `MenuPredefinedRequest` | `MenuAcknowledgement` | 执行预定义操作 |

#### 请求类型定义

```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct MenuSetMenubarRequest {
    pub json_data: String,
    pub window_id: String,
}
impl_bridge_napi_type!(MenuSetMenubarRequest, "ohos.menu.SetMenubarRequest");

#[napi(object)]
#[derive(Clone, Debug)]
pub struct MenuPopupRequest {
    pub json_data: String,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub window_id: String,
}
impl_bridge_napi_type!(MenuPopupRequest, "ohos.menu.PopupRequest");

#[napi(object)]
#[derive(Clone, Debug)]
pub struct MenuSetVisibleRequest {
    pub visible: bool,
    pub window_id: String,
}
impl_bridge_napi_type!(MenuSetVisibleRequest, "ohos.menu.SetVisibleRequest");
```

### 2.3 反向事件

| 事件 | 旧通道 | 新事件名 | 请求类型 | 响应类型 |
|------|--------|---------|---------|---------|
| menu-click | `menu::menu_event_receiver()` → `String` (menu_id) | `menu-click` | `MenuClickEvent` | `std.bool` |

```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct MenuClickEvent {
    pub menu_id: String,
    pub window_id: Option<String>,
}
impl_bridge_napi_type!(MenuClickEvent, "ohos.menu.MenuClickEvent");
```

#### 事件接收方式

`MenuBridgePlugin` 实现 `on_main_thread_event`，将 `menu_id` 转发到 muda 的 `menu_event_receiver()` channel：

```rust
fn on_main_thread_event<'env>(&self, event: BridgeMainThreadEvent<'env>) -> Result<Unknown<'env>> {
    match event.name() {
        "menu-click" => {
            let click: MenuClickEvent = event.decode()?;
            // 转发到 muda 的 crossbeam channel
            let _ = MENU_EVENT_SENDER.send(click.menu_id);
            event.respond(true)
        }
        _ => Err(...),
    }
}
```

**设计决策：保留 crossbeam 中转层**。muda 的 `start_event_listener` 线程逻辑包含 check item toggle 和 `MenuEvent::send` 分发，不在 `on_main_thread_event` 中执行。

### 2.4 tray-icon 与 muda 的事件桥接

当前 tray-icon 的 `event.rs` 第 89 行调用 `openharmony_ability::send_menu_event(code)` 将 tray 菜单点击注入 muda 的事件通道。迁移后该调用改为 `openharmony_ability_plugin_menu::send_menu_event(code)`，语义不变。

## 3. Menu JSON 序列化兼容

### 3.1 Menu 数据模型不变

Menu 系统的 JSON 序列化机制完全不变。`MenuItemData` 结构和 `to_json()` 方法保持原样。迁移仅改变传输层（散函数 → bridge call），不改数据格式。

### 3.2 图标处理

| 项目 | 旧方式 | 新方式 | 说明 |
|------|--------|--------|------|
| Menu item icon | base64 PNG 编码在 JSON `icon` 字段 | 不变 | ArkTS 侧解码为 PixelMap |
| Tray icon | RGBA bytes 通过 TSFN 传递 | RGBA bytes 通过 `StatusBarAddRequest.white_icon` / `black_icon` 传递 | 数据内容不变 |
| PixelMap 生命周期 | ArkTS 侧 `cleanupStaleIcons` | 不变 | ArkTS 侧实现不变 |

### 3.3 Mnemonic 处理

`&` 字符静默移除逻辑（`strip_mnemonics` in tray-icon, `text.replace("&", "")` in muda）不变。这是 Rust 侧的字符串处理，与桥接层无关。

### 3.4 StatusBarMenuItem → JSON 序列化

旧模型中 `StatusBarMenuItem` 包含 `RefCell<Option<Vec<u8>>>` 等 `#[serde(skip)]` 字段，序列化时跳过。新模型将 icon RGBA 作为 `Vec<u8>` 直接放在 `StatusBarAddRequest` 中通过 N-API 传递，不再需要 `serde(skip)` hack。

### 3.5 OHOS StatusBar API 版本要求（审计补充）

经 OHOS 官方文档核对，StatusBar 部分 API 的 `since` 版本高于应用默认 API 12：

| ArkTS API | since 版本 | 说明 |
|-----------|-----------|------|
| `addToStatusBar` | 5.0.0(12) | API 12 ✓ |
| `updateStatusBarIcon` | 5.0.0(12) | API 12 ✓ |
| `updateStatusBarMenu` | 5.0.0(12) | API 12 ✓ |
| `removeFromStatusBar` | 5.0.2(14) | **API 14**，需版本守卫 |
| `updateStatusBarHoverTips` | 6.0.2(22) | **API 22**，需版本守卫 |
| `on('statusBarIconClick')` | 5.0.0(12) | API 12 ✓ |
| `on('rightMenuClick')` | 5.0.2(14) | **API 14**，需版本守卫 |
| `executePredefinedAction` | 非官方 API | 自定义 helper 方法，非 `statusBarManager` 官方接口 |

**注意**：这些版本要求是**预先存在的**（当前代码已调用这些 API），B4 迁移不改变调用的 ArkTS API，仅改变 Rust→ArkTS 传输层。版本守卫是 A0（ArkTS 侧 plugin 实现）的职责，B4 不涉及。

## 4. Cargo.toml 依赖调整

### 4.1 tray-icon/Cargo.toml

```toml
# 旧
[target."cfg(target_env = \"ohos\")".dependencies]
openharmony-ability = { path = "../openharmony-ability/crates/ability", features = ["menu", "statusbar"] }

# 新
[target."cfg(target_env = \"ohos\")".dependencies]
openharmony-ability = { path = "../openharmony-ability/crates/ability" }
openharmony-ability-plugin-statusbar = { path = "../openharmony-ability/crates/plugin-statusbar" }
```

保留 `openharmony-ability` 依赖（用于 `OpenHarmonyApp`、`BridgeRuntime` 等核心类型），但移除 `features = ["menu", "statusbar"]`。

`png`、`base64`、`log`、`serde`、`serde_json` 依赖不变。

### 4.2 muda/Cargo.toml

```toml
# 旧
[target.'cfg(target_env = "ohos")'.dependencies]
openharmony-ability = { path = "../openharmony-ability/crates/ability", features = ["menu"] }

# 新
[target.'cfg(target_env = "ohos")'.dependencies]
openharmony-ability = { path = "../openharmony-ability/crates/ability" }
openharmony-ability-plugin-menu = { path = "../openharmony-ability/crates/plugin-menu" }
```

`serde`、`serde_json`、`base64`、`png` 依赖不变。

### 4.3 MenuItemData / AboutMetadataData 类型归属

`MenuItemData` 和 `AboutMetadataData` 当前在 `openharmony-ability` 的 `menu` 模块中。A0 后这些类型应迁移到 `plugin-menu` crate。muda 的引用路径更新：

```rust
// 旧
use openharmony_ability::menu::MenuItemData;
use openharmony_ability::menu::AboutMetadataData;

// 新
use openharmony_ability_plugin_menu::MenuItemData;
use openharmony_ability_plugin_menu::AboutMetadataData;
```

tray-icon 不直接引用 `MenuItemData`（它用自己的 `MenuJsonItem` 反序列化 muda 产出的 JSON），不受影响。

## 5. 约束遵守

### 5.1 cfg 隔离策略

所有改动在 `cfg(target_env = "ohos")` 下。tray-icon 的 OHOS 代码本身已在 `cfg(target_env = "ohos")` 的 `mod ohos` 中编译，无需额外 cfg。

**Tray 仅 desktop 模式**：tray-icon 的 OHOS 模块本身不使用 `cfg(desktop)` 限制（因为 `platform_impl/mod.rs` 已经通过 `cfg(target_env = "ohos")` 选择了 `ohos` 模块）。desktop/mobile 设备形态由应用构建时的 `OHOS_DEVICE_TYPE` 控制。如果需要显式限制 tray 仅 desktop：

```rust
// platform_impl/mod.rs 中已有
#[cfg(target_env = "ohos")]
mod ohos;
```

不需要在 tray-icon 内部加 `cfg(all(target_env = "ohos", desktop))`，因为 mobile 构建不会选择 tray-icon 的 OHOS 模块（tray-icon 在 mobile 平台编译为 stub）。

### 5.2 ExternalError 转换

tray-icon 使用 `crate::Error::OhosError(String)` 包装 OHOS 错误，muda 使用 `crate::Error::CustomError(String)`。迁移后 bridge call 返回 `napi_ohos::Error`，转换方式不变：

```rust
// tray-icon
.map_err(|e| crate::Error::OhosError(e.to_string()))?;

// muda
.map_err(|e| crate::Error::CustomError(e.to_string()))?;
```

**注意**：tao 的 `ExternalError` 限制（无 `From<String>`）不影响 tray-icon 和 muda，因为它们有自己的 Error 枚举，可以携带字符串消息。

### 5.3 线程模型

tray-icon 的 `TrayIcon` 是 `Sync + Send`，通过 TSFN 内部处理线程安全。迁移后 bridge call 是 async（返回 `Future`），但 tray-icon 的公共 API 是同步的（`TrayIcon::new` 返回 `crate::Result<Self>`，不是 `async`）。

**设计决策：block_on 包装**。tray-icon 和 muda 的公共 API 保持同步签名。在 OHOS 后端内部使用 `block_on` 执行 async bridge call：

```rust
pub fn new(id: TrayIconId, attrs: TrayIconAttributes) -> crate::Result<Self> {
    let client = get_statusbar_client()?;
    let request = build_add_request(&attrs)?;
    futures::executor::block_on(client.add(request))
        .map_err(|e| crate::Error::OhosError(e.to_string()))?;
    // ...
}
```

**替代方案：保留 fire-and-forget 语义**。旧模型的 TSFN 调用是 `NonBlocking` fire-and-forget，不等待 ArkTS 执行完成。如果新模型也使用 fire-and-forget（`BridgeClient::call_async` + `.await` 但不阻塞），则可以直接用 `tokio::spawn` 或 `waker` 机制。但 bridge call 的 `call_async` 返回 `Future`，必须被驱动才能完成。

**推荐方案**：使用 `futures::executor::block_on` 同步等待 bridge call 完成。这比旧模型更可靠（旧模型 fire-and-forget 无法感知失败）。

**线程安全分析**：
- **Chrome_IOThread 调用（安全）**：tray-icon/muda 的同步 API 通常在 Chrome_IOThread（tauri EventLoop 线程）或应用业务线程上调用。`block_on` 会临时阻塞该线程的事件处理，但 TSFN 回调在 ArkTS 主线程（独立线程）执行，可正常 resolve oneshot channel 并唤醒阻塞线程。不是死锁，仅是临时阻塞。tray 操作低频，可接受。
- **ArkTS 主线程调用（死锁）**：如果 `block_on` 在 ArkTS/NAPI 主线程上调用，TSFN 回调需要同一线程执行但已被阻塞 → 死锁。`BridgeClient::call_async` 不像 `call_sync_from_worker` 那样有 `main_thread_id` 守卫。因此 **严禁** 在 NAPI 回调上下文中调用 tray-icon/muda 的同步 API。tauri 集成时需确保 `TrayIcon::new()` 等调用不在 `on_main_thread_event` 回调链中。
- **旧模型对比**：旧模型使用 TSFN `NonBlocking` fire-and-forget，不阻塞调用线程但也无法感知失败。新模型 `block_on` 牺牲非阻塞性换取错误感知能力。

### 5.4 StatusBarClient 初始化

`StatusBarClient` 需要在 `OpenHarmonyApp` 初始化后创建。tray-icon 当前使用 `OHOS_APP: OnceCell<OpenHarmonyApp>` 存储全局 app 引用。迁移后新增 `STATUSBAR_CLIENT: OnceCell<StatusBarClient>`：

```rust
static OHOS_APP: OnceCell<openharmony_ability::OpenHarmonyApp> = OnceCell::new();
static STATUSBAR_CLIENT: OnceCell<StatusBarClient> = OnceCell::new();

pub fn set_ohos_app(app: openharmony_ability::OpenHarmonyApp) {
    let statusbar_client = StatusBarClient::new(&app)
        .expect("Failed to create StatusBarClient");
    let menu_client = openharmony_ability_plugin_menu::MenuClient::new(&app)
        .expect("Failed to create MenuClient");
    OHOS_APP.set(app).expect("OHOS_APP already set");
    STATUSBAR_CLIENT.set(statusbar_client).expect("STATUSBAR_CLIENT already set");
    // 注入 muda 的 MenuClient（muda 不持有 OpenHarmonyApp，由 tray-icon 统一初始化）
    muda::platform_impl::ohos::set_menu_client(menu_client);
}
```

muda 不自行创建 `MENU_CLIENT`，而是通过 `set_menu_client(client)` 接收 tray-icon 注入的 `MenuClient`（详见 muda spec 2.1）。

### 5.5 Drop 行为

旧模型在 `Drop` 中调用 `unregister_icon_click_handler()` 和 `unregister_menu_click_handler()`。新模型下，事件处理通过 `on_main_thread_event` 由 `BridgePluginRegistry` 管理，无需显式注销。`Drop` 仅需调用 `StatusBarClient::remove()`。

但 `on_main_thread_event` 仍会收到事件（plugin 是全局注册的）。tray-icon 需要通过 `is_visible` 标志或 `TRAY_ID` 为 `None` 来忽略 drop 后的事件。当前 `event.rs` 已有 `TRAY_ID: RwLock<Option<TrayIconId>>` 机制，迁移后保持。

## 6. 风险与回退

### 6.1 block_on 死锁风险

`block_on` 的死锁风险取决于调用线程：

| 调用线程 | 是否死锁 | 说明 |
|---------|---------|------|
| Chrome_IOThread / 应用业务线程 / Rust worker | 否（临时阻塞） | TSFN 回调在 ArkTS 主线程独立执行，resolve oneshot 后唤醒阻塞线程 |
| ArkTS/NAPI 主线程 | **是（死锁）** | TSFN 回调需同一线程但已被 block_on 阻塞 |

风险评估：
- tray-icon API 调用方通常是 Chrome_IOThread（tauri EventLoop）或应用业务线程，不是 ArkTS 主线程 → **安全**
- 旧模型使用 TSFN `NonBlocking` fire-and-forget，不阻塞调用线程
- **缓解措施**：`StatusBarClient` / `MenuClient` 应在文档中标注"禁止在 NAPI 回调上下文调用"。如果 tauri 集成时发现 tray API 在 ArkTS 主线程被调用，回退为 fire-and-forget：`tokio::spawn(async { client.add(req).await })` 不等待结果

### 6.2 A0 前置 crate 不存在

如果 A0 未创建 `plugin-statusbar` 和 `plugin-menu` crate，B4 需要自行创建。工作量 +2-3 天。创建时参考 `plugin-window` 的模式。

### 6.3 事件 ordering

旧模型使用 crossbeam unbounded channel 保证 FIFO。`on_main_thread_event` 在 ArkTS 主线程同步调用，事件顺序与 ArkTS 回调顺序一致。保持 FIFO 语义。
