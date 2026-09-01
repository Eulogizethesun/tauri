# tray-icon OHOS bridge 迁移规格

## 规格范围

本规格覆盖 `tray-icon/src/platform_impl/ohos/` 目录下所有文件的 bridge 迁移。涉及 3 个文件：`mod.rs`、`event.rs`、`icon.rs`。

## 1. 依赖变更

### 1.1 Cargo.toml

```toml
[target."cfg(target_env = \"ohos\")".dependencies]
# 保留：核心类型（OpenHarmonyApp、BridgeRuntime 等）
openharmony-ability = { path = "../openharmony-ability/crates/ability" }
# 新增：plugin-statusbar facade
openharmony-ability-plugin-statusbar = { path = "../openharmony-ability/crates/plugin-statusbar" }
# 保留不变
png = "0.18"
base64 = "0.22"
log = "0.4"
serde = "1"
serde_json = "1"
```

移除 `features = ["menu", "statusbar"]`，statusbar 功能由独立 plugin crate 提供。

### 1.2 模块引用变更

| 旧引用 | 新引用 | 文件 |
|--------|--------|------|
| `openharmony_ability::statusbar::add_to_status_bar` | `openharmony_ability_plugin_statusbar::StatusBarClient::add` | mod.rs |
| `openharmony_ability::statusbar::remove_from_status_bar` | `StatusBarClient::remove` | mod.rs |
| `openharmony_ability::statusbar::update_status_bar_icon` | `StatusBarClient::update_icon` | mod.rs |
| `openharmony_ability::statusbar::update_status_bar_menu` | `StatusBarClient::update_menu` | mod.rs |
| `openharmony_ability::statusbar::update_hover_tips` | `StatusBarClient::update_tips` | mod.rs |
| `openharmony_ability::statusbar::execute_predefined_action` | `StatusBarClient::execute_predefined` | event.rs |
| `openharmony_ability::statusbar::icon_click_receiver` | plugin `on_main_thread_event("icon-click")` → crossbeam 中转 | event.rs |
| `openharmony_ability::statusbar::menu_click_receiver` | plugin `on_main_thread_event("menu-click")` → crossbeam 中转 | event.rs |
| `openharmony_ability::statusbar::unregister_icon_click_handler` | 删除（plugin 生命周期管理） | mod.rs |
| `openharmony_ability::statusbar::unregister_menu_click_handler` | 删除（plugin 生命周期管理） | mod.rs |
| `openharmony_ability::statusbar::StatusBarIcon` | 迁移到 `openharmony_ability_plugin_statusbar::StatusBarIcon` | mod.rs, icon.rs |
| `openharmony_ability::statusbar::StatusBarItem` | 迁移到 `openharmony_ability_plugin_statusbar::StatusBarItem` | mod.rs |
| `openharmony_ability::statusbar::StatusBarMenuItem` | 迁移到 `openharmony_ability_plugin_statusbar::StatusBarMenuItem` | mod.rs |
| `openharmony_ability::statusbar::StatusBarSubMenuItem` | 迁移到 `openharmony_ability_plugin_statusbar::StatusBarSubMenuItem` | mod.rs |
| `openharmony_ability::statusbar::StatusBarMenuAction` | 迁移到 `openharmony_ability_plugin_statusbar::StatusBarMenuAction` | mod.rs |
| `openharmony_ability::statusbar::StatusBarMenuItemOptions` | 迁移到 `openharmony_ability_plugin_statusbar::StatusBarMenuItemOptions` | mod.rs |
| `openharmony_ability::statusbar::StatusBarClickEvent` | 迁移到 `openharmony_ability_plugin_statusbar::StatusBarClickEvent` | event.rs |
| `openharmony_ability::statusbar::QuickOperation` | 迁移到 `openharmony_ability_plugin_statusbar::QuickOperation` | mod.rs |
| `openharmony_ability::send_menu_event` | `openharmony_ability_plugin_menu::send_menu_event` | event.rs |

## 2. StatusBarClient 初始化

### 2.1 全局 client 存储

```rust
static OHOS_APP: OnceCell<openharmony_ability::OpenHarmonyApp> = OnceCell::new();
static STATUSBAR_CLIENT: OnceCell<openharmony_ability_plugin_statusbar::StatusBarClient> = OnceCell::new();

pub fn set_ohos_app(app: openharmony_ability::OpenHarmonyApp) {
    let client = openharmony_ability_plugin_statusbar::StatusBarClient::new(&app)
        .expect("Failed to create StatusBarClient");
    OHOS_APP.set(app).expect("OHOS_APP already set");
    STATUSBAR_CLIENT.set(client).expect("STATUSBAR_CLIENT already set");
}

pub(crate) fn get_statusbar_client() -> &'static openharmony_ability_plugin_statusbar::StatusBarClient {
    STATUSBAR_CLIENT.get().expect("STATUSBAR_CLIENT not initialized")
}
```

### 2.2 get_ohos_app 保留

`get_ohos_app()` 保留用于 `app.exit(0)`（event.rs 中 predefined "quit" action），但所有 statusbar 操作改用 `get_statusbar_client()`。

## 3. TrayIcon 方法迁移

### 3.1 new()

```rust
pub fn new(id: TrayIconId, attrs: TrayIconAttributes) -> crate::Result<Self> {
    let client = get_statusbar_client();

    let (predefined_map, check_state, menu_json) = extract_menu_metadata(&attrs.menu);
    {
        let mut metadata = MENU_METADATA.lock().unwrap();
        metadata.predefined_map = predefined_map;
        metadata.check_state = check_state;
        metadata.menu_json = menu_json;
    }

    let mut item = build_item_from_attrs(&attrs)?;

    if let Some(ref mut groups) = item.status_bar_group_menu {
        let flat_ids = remap_menu_codes_to_indices(groups);
        MENU_METADATA.lock().unwrap().flat_ids = flat_ids;
    }

    // 旧: openharmony_ability::statusbar::add_to_status_bar(app, &item)
    // 新:
    let request = build_add_request(&item);
    futures::executor::block_on(client.add(request))
        .map_err(|e| crate::Error::OhosError(e.to_string()))?;

    event::register_tray_id(id);
    event::start_event_forward_thread();

    Ok(Self {
        attrs: RefCell::new(attrs),
        is_visible: RefCell::new(true),
    })
}
```

### 3.2 set_icon()

```rust
pub fn set_icon(&mut self, icon: Option<crate::Icon>) -> crate::Result<()> {
    let client = get_statusbar_client();
    let is_template = self.attrs.borrow().icon_is_template;
    if let Some(i) = &icon {
        let status_bar_icon = icon::icon_to_status_bar_icon(&i.inner, is_template)?;
        // 旧: openharmony_ability::statusbar::update_status_bar_icon(app, &status_bar_icon)
        // 新:
        let request = StatusBarUpdateIconRequest::from(status_bar_icon);
        futures::executor::block_on(client.update_icon(request))
            .map_err(|e| crate::Error::OhosError(e.to_string()))?;
    } else {
        let empty_icon = StatusBarIcon::default();
        let request = StatusBarUpdateIconRequest::from(empty_icon);
        futures::executor::block_on(client.update_icon(request))
            .map_err(|e| crate::Error::OhosError(e.to_string()))?;
    }
    self.attrs.borrow_mut().icon = icon;
    Ok(())
}
```

### 3.3 set_menu()

```rust
pub fn set_menu(&mut self, menu: Option<Box<dyn crate::menu::ContextMenu>>) {
    let client = get_statusbar_client();
    let (menus, predefined_map, check_state, menu_json) =
        menu_to_status_bar_items_with_metadata(&menu);
    {
        let mut metadata = MENU_METADATA.lock().unwrap();
        metadata.predefined_map = predefined_map;
        metadata.check_state = check_state;
        metadata.menu_json = menu_json;
    }
    if let Some(mut m) = menus {
        let flat_ids = remap_menu_codes_to_indices(&mut m);
        MENU_METADATA.lock().unwrap().flat_ids = flat_ids;
        // 旧: openharmony_ability::statusbar::update_status_bar_menu(app, &m)
        // 新:
        let request = StatusBarUpdateMenuRequest::from(&m);
        futures::executor::block_on(client.update_menu(request))
            .map_err(|e| crate::Error::OhosError(e.to_string()))
            .ok();
    } else if menu.is_none() {
        let request = StatusBarUpdateMenuRequest::from(&vec![]);
        futures::executor::block_on(client.update_menu(request))
            .map_err(|e| crate::Error::OhosError(e.to_string()))
            .ok();
    }
    self.attrs.borrow_mut().menu = menu;
}
```

### 3.4 set_tooltip()

```rust
pub fn set_tooltip<S: AsRef<str>>(&mut self, tooltip: Option<S>) -> crate::Result<()> {
    let client = get_statusbar_client();
    let tips = tooltip.and_then(|s| {
        let s = s.as_ref().to_string();
        if s.is_empty() { None } else { Some(s) }
    });
    if let Some(ref t) = tips {
        if t.len() <= 128 {
            // 旧: openharmony_ability::statusbar::update_hover_tips(app, t)
            // 新:
            let request = StatusBarUpdateTipsRequest { tips: t.clone() };
            futures::executor::block_on(client.update_tips(request))
                .map_err(|e| crate::Error::OhosError(e.to_string()))?;
        }
    }
    self.attrs.borrow_mut().tooltip = tips;
    Ok(())
}
```

### 3.5 set_title() / set_quick_operation() / set_icon_as_template()

这三个方法都使用 "remove + re-add" 模式。迁移后：
- `remove_from_status_bar(app)` → `futures::executor::block_on(client.remove(request))`
- `add_to_status_bar(app, &item)` → `futures::executor::block_on(client.add(request))`

### 3.6 set_visible()

```rust
pub fn set_visible(&mut self, visible: bool) -> crate::Result<()> {
    let client = get_statusbar_client();
    if visible && !*self.is_visible.borrow() {
        let item = build_item_from_attrs(&self.attrs.borrow())?;
        let request = build_add_request(&item);
        futures::executor::block_on(client.add(request))
            .map_err(|e| crate::Error::OhosError(e.to_string()))?;
        *self.is_visible.borrow_mut() = true;
    } else if !visible && *self.is_visible.borrow() {
        futures::executor::block_on(client.remove(StatusBarRemoveRequest {}))
            .map_err(|e| crate::Error::OhosError(e.to_string()))
            .ok();
        *self.is_visible.borrow_mut() = false;
    }
    Ok(())
}
```

### 3.7 rect()

**无变化**。`rect()` 始终返回 `None`。StatusBar API 不提供图标位置/尺寸。

### 3.8 Drop

```rust
impl Drop for TrayIcon {
    fn drop(&mut self) {
        if *self.is_visible.borrow() {
            let client = get_statusbar_client();
            // 旧: openharmony_ability::statusbar::remove_from_status_bar(app)
            // 新:
            futures::executor::block_on(client.remove(StatusBarRemoveRequest {}))
                .map_err(|e| log::warn!("[TrayIcon] remove error: {}", e))
                .ok();
            // 旧: unregister_icon_click_handler() + unregister_menu_click_handler()
            // 新: 删除（plugin 生命周期管理事件注册）
        }
    }
}
```

## 4. 事件转发迁移

### 4.1 event.rs 中转层保持

`event.rs` 中的 `start_event_forward_thread()` 和 `crossbeam_channel::select!` 循环保持不变。变化的只是事件来源：

- 旧：`openharmony_ability::statusbar::icon_click_receiver()` / `menu_click_receiver()`（plugin-statusbar 内部 channel）
- 新：plugin-statusbar 的 `on_main_thread_event` → plugin-statusbar 内部 crossbeam channel → `icon_click_receiver()` / `menu_click_receiver()`

**如果 plugin-statusbar 保留相同的 `icon_click_receiver()` / `menu_click_receiver()` 公共 API**，则 event.rs 的改动仅为更新 import 路径，无需改逻辑。

### 4.2 execute_predefined_action

```rust
// 旧
openharmony_ability::statusbar::execute_predefined_action(predefined_type).ok();

// 新
let client = get_statusbar_client();
let request = StatusBarPredefinedRequest { action: predefined_type.to_string() };
futures::executor::block_on(client.execute_predefined(request))
    .map_err(|e| log::warn!("[TrayIcon] predefined action error: {}", e))
    .ok();
```

### 4.3 rebuild_and_update_menu (check toggle)

```rust
// 旧
openharmony_ability::statusbar::update_status_bar_menu(app, &groups).ok();

// 新
let client = get_statusbar_client();
let request = StatusBarUpdateMenuRequest::from(&groups);
futures::executor::block_on(client.update_menu(request)).ok();
```

### 4.4 send_menu_event

```rust
// 旧
openharmony_ability::send_menu_event(code);

// 新
openharmony_ability_plugin_menu::send_menu_event(code);
```

## 5. 不变项

| 项目 | 说明 |
|------|------|
| `icon.rs` 全部 | 纯 Rust PNG/RGBA 处理，不涉及桥接 |
| `MENU_METADATA` | 菜单元数据 Mutex<HashMap>，纯 Rust 状态 |
| `MenuJsonItem` / `AboutMetadataJson` | JSON 反序列化结构体 |
| `split_items_into_groups` / `remap_menu_codes_to_indices` | 菜单分组和 code 重映射逻辑 |
| `decode_png_to_rgba` / `decode_icon_from_base64` | 图标解码 |
| `strip_mnemonics` | `&` 移除 |
| `to_monochrome` | 模板图标单色化 |
| `scale_rgba` | 图标缩放 |
| 所有单元测试 | 纯逻辑测试，不涉及桥接 |

## 6. 验证

| 验证项 | 方式 |
|--------|------|
| cargo check OHOS target | `cargo check --target aarch64-unknown-linux-ohos` |
| cargo check Windows | 确认非 OHOS 平台不受影响 |
| 设备端 tray 图标显示 | 桌面设备运行 demo，确认托盘图标出现 |
| 设备端 tray 菜单点击 | 点击菜单项，确认事件正确传递到 Rust |
| 设备端 predefined action | 点击 "quit" 菜单项，确认应用退出 |
| 设备端 check toggle | 点击 check 菜单项，确认选中状态切换 |
| 设备端 icon click | 左键/右键点击托盘图标，确认 TrayIconEvent 传递 |
| rect() 返回 None | 调用 `tray.rect()`，确认返回 None |

## 7. ArkTS 字段命名约束（与 Rust NAPI wire 对齐）

`StatusbarPlugin.ets` 的 request interface 字段名**必须**取 NAPI 自动生成的 camelCase（Rust `#[napi(object)]` snake_case → ArkTS camelCase，见 `openharmony-ability/.agents/skills/named-napi-contracts/references/contract-table.md:9`），且**结构**必须匹配 Rust 侧 wire 结构体的扁平/序列化形态：

| Rust wire 结构体 (`plugin-statusbar/src/lib.rs`) | Rust 字段 | ArkTS 读取属性 | 备注 |
|---|---|---|---|
| `StatusBarAddRequest` | `white_icon` / `black_icon` | `whiteIcon` / `blackIcon` | `Option<Vec<u8>>` → `Uint8Array \| undefined` |
| | `icon_size` | `iconSize` | |
| | `ability_name` / `title` / `height` / `module_name` / `loading_status` | `abilityName` / `title` / `height` / `moduleName` / `loadingStatus` | **扁平字段**——ArkTS `add` handler 须从此重建 `quickOperation` 嵌套对象（`statusBarManager.addToStatusBar` 期望） |
| | `menu_json` | `menuJson` | **JSON 字符串**——ArkTS 须 `JSON.parse` 重建 `statusBarGroupMenu: ESObject[][]` |
| | `hover_tips` | `hoverTips` | |
| `StatusBarUpdateIconRequest` | `white_icon` / `black_icon` / `icon_size` | `whiteIcon` / `blackIcon` / `iconSize` | |
| `StatusBarUpdateMenuRequest` | `menu_json` | `menuJson` | JSON 字符串，ArkTS `JSON.parse` → `ESObject[][]` |
| `StatusBarUpdateTipsRequest` | `tips` | `tips` | 单词不变；**注意不是 `hoverTips`**（与 `AddRequest.hover_tips` 区分） |

**历史偏差（已修复 2026-08-13）**：ArkTS `StatusbarPlugin.ets` 曾用 `white`/`black`/`quickOperation`(嵌套对象)/`statusBarGroupMenu`(原生数组)/`hoverTips`(update-tips) 读取，与 NAPI wire 属性名不符 → `add` 报 `no valid icon data provided`、`update-menu`/`update-tips` 同类失败。修法：ArkTS 侧 interface + handler 全部对齐上表 camelCase + 从扁平字段重建嵌套结构。**Rust 侧不变**（与 design.md §1.2 一致），`bridge/mod.rs` 框架不变。

> 注：`menu_json` 用 JSON 字符串而非原生 `#[napi(object)]` 嵌套数组，与新 `named-napi-contracts` 的 no-JSON 规则有张力，但当前与 design.md §1.2 及 Rust 实现一致，本次仅对齐字段命名；后续若做 no-JSON 重构（`StatusBarMenuItem`/`StatusBarSubMenuItem` 改 `#[napi(object)]` 传原生嵌套数组）属独立 follow-up，需同步改两侧 + 本 spec。

### 7.1 napi Uint8Array 字节传输约束（`createPixelMapFromRgba`）

`white_icon`/`black_icon` 是 `Option<Vec<u8>>`，经桥接 `std.bytes`（`bridge/mod.rs:125-136`）传到 ArkTS 成 `Uint8Array`。**该 napi 外部缓冲的 `.buffer` 是 undefined / detached**，ArkTS 侧不可直接 `rgbaData.buffer.slice(...)`，否则抛 `Cannot read property slice of undefined`。

`native_ability/src/main/ets/helper/StatusBarUtils.ets` 的 `createPixelMapFromRgba` / `createPixelMapFromRgbaWH` 必须先拷进 JS 托管缓冲（与 `ClipboardPlugin.ets:145-147` 黄金先例一致）：
```ts
const jsArr = new Uint8Array(rgbaData.length);
jsArr.set(rgbaData);
// ...
pm.writeBufferToPixelsSync(jsArr.buffer);
```
历史偏差（已修复 2026-08-13）：原实现直接 `rgbaData.buffer.slice(...)`，旧 core NAPI 路径（`ArkHelper.ets` 直接传 iconsRgba）没踩到，迁到桥接 plugin 后暴露。

### 7.2 abilityContext 获取约束（bridge 路径唯一来源）

`StatusbarPlugin.ets` 所有 `statusBarManager.*` 调用都需要 `common.UIAbilityContext`。**桥接路径下，`abilityContext` 的唯一正确来源是 `BridgeCallContext.abilityContext`**（`BridgePluginContext` 字段，`type.ets:366`；`BridgeHost.ets:1228/1278/1322` 构造 `BridgeCallContext` 时填入 `this.abilityContext`）。

| 来源 | 路径 | 状态 |
|------|------|------|
| `context.abilityContext` | 桥接 `invokeAsync` 的 `context` 参数 | ✅ 唯一正确 |
| `getAbilityContext()` / `setAbilityContext()` | `StatusBarUtils.ets` 模块级 global（line 10/17/100） | ❌ 桥接路径下恒 null |

`requires: ["ability"]`（`StatusbarPlugin.ets:90`）的存在**正是为此**：声明该 plugin 需要 ability context，桥接框架据此在 `BridgeCallContext` 上注入 `abilityContext`。plugin 在 `invokeAsync(action, payload, context)` 内取 `const abilityContext = context.abilityContext;`。

**历史偏差（已修复 2026-08-13）**：`StatusbarPlugin.ets` 的 5 个 action（add/remove/update-icon/update-menu/update-tips）曾用 `const abilityContext = getAbilityContext();`（`StatusBarUtils.ets:100` 的 module-level global）。但 `setAbilityContext`（line 17）在全仓**零调用方**——桥接路径从不调它，global 恒为 null → `add` 报 `[TrayIcon] add error in new: TypeError: Cannot read property abilityInfo of null`。这是 [[ohos-tray-menu-fieldname-camelcase]]（字段名对齐）+ [[ohos-napi-uint8array-buffer-undefined]]（PixelMap 字节拷贝）修完、`addToStatusBar` 真正被调用后才暴露的第三层。

**修法（ArkTS 侧，Rust + 桥框架不动）**：5 处 `getAbilityContext()` 全替换为 `context.abilityContext`，并从 import 块移除 `getAbilityContext`（保留 `setAbilityContext` 不动——`StatusBarUtils.ets` 的 `iconClickHandler` line 33 仍引用该 global 做 `startAbility` 恢复前台，属独立功能路径，见下方注）。

> 注：`StatusBarUtils.ets:33` 的 `iconClickHandler`（托盘图标点击 → `startAbility` 恢复 app 前台）也读 module-level `abilityContext` global，桥接路径下同样恒 null → 点击恢复前台失效。这是独立功能缺口（非 `add` 路径），需另行注入 abilityContext 到该 module-level handler（其无 `BridgeCallContext` 参数），留作 follow-up。

**验证（2026-08-13 20:57，设备 HUAWEI MateBook Pro）**：hilog `abilityInfo of null` 计数=0，`add: white/black PixelMap OK`，`[StatusbarManager] addToStatusBar start`（真正进入 OHOS API），主线程无 freeze。tray `add` 推进到下一层（`addToStatusBar` 业务校验：menu item 缺 submenu/menuAction + pixelmap 超限，见下一坎）。

**要点**：桥接 plugin 获取 `UIAbilityContext` 一律用 `context.abilityContext`（配合 `requires: ["ability"]`），禁止用 module-level global getter——桥接路径从不初始化那些 global，是 ArkHelper 旧 core 路径遗留脚手架。

### 7.3 内层 `menu_json` 序列化键命名约束（camelCase）

§7 约束的是**外层** `StatusBarAddRequest` 的字段（经 `#[napi(object)]` 自动 snake→camel）。本节约束 `menu_json` 字符串的**内层**键——它是 `serde_json::to_string` 产物，**不走 `#[napi(object)]`，不会自动 camelCase**。

`StatusbarPlugin.ets:add` handler 对 `request.menuJson` 做 `JSON.parse` 得到普通 JS 对象，其键名**必须**是 camelCase，以匹配：
- ArkTS helper `fillMenuItemAbilityName`（`StatusBarUtils.ets:161`）读 `item.menuAction` / `item.subMenu` / `sub.menuAction`
- ArkTS helper `processMenuItemIcons`（`StatusBarUtils.ets:182-185`）读 `item.options.iconRgba` / `.iconWidth` / `.iconHeight`
- OHOS `statusBarManager.addToStatusBar` 原生读每个 `statusBarGroupMenu` 项的 `menuAction` / `subMenu`

| Rust wire 结构体 (`plugin-statusbar/src/lib.rs`) | Rust 字段 | `menu_json` 序列化键（须 camelCase） |
|---|---|---|
| `StatusBarMenuItem` | `menu_code` / `sub_menu` / `menu_action` / `options` | `menuCode` / `subMenu` / `menuAction` / `options` |
| `StatusBarSubMenuItem` | `sub_title` / `menu_code` / `menu_action` | `subTitle` / `menuCode` / `menuAction` |
| `StatusBarMenuAction` | `ability_name` / `module_name` / `menu_code` / `notify_only` | `abilityName` / `moduleName` / `menuCode` / `notifyOnly` |
| `StatusBarMenuItemOptions` | `icon_rgba` / `icon_width` / `icon_height` / `selected` | `iconRgba` / `iconWidth` / `iconHeight` / `selected` |

**实现约束**：上述 4 个结构体**必须**带 `#[serde(rename_all = "camelCase")]`，否则 `serde_json::to_string` 产 snake_case 键 → ArkTS `JSON.parse` 后 `menuAction`/`subMenu`/`iconRgba` 全 `undefined`。

> 注：Rust builder `menu_json_item_to_status_bar_item`（`tray-icon/.../mod.rs:597-645`）对每个 item **保证** `menu_action` XOR `sub_menu` 为 `Some`（非 submenu 项设 `menu_action: Some`，submenu 项设 `sub_menu: Some`）。故键名对齐后，OHOS「每个顶层 item 须有 menuAction 或 subMenu」校验（错误码 `1010720001`）即可通过——数据本身不缺，缺的只是键名翻译。

**实现约束（null vs absent — 401 根因，device 验证 2026-08-13）**：上述 4 个结构体的**所有 `Option<T>` 字段必须带 `#[serde(skip_serializing_if = "Option::is_none")]`**。`serde_json` 默认把 `Option::None` 序列化为 JSON `null`（属性存在但值为 null），而 OHOS `statusBarManager` 合约把 `subMenu?: StatusBarSubMenuItem[]` 等可选字段定义为 **absent-or-value（undefined 或有效值），NOT null**。`JSON.parse("...\"subMenu\": null...")` 产生一个值为 `null` 的**已存在**属性——既非 absent 亦非有效数组。statusBarManager 遍历每个顶层 item 时，发现 `subMenu` 存在但非数组，逐项打 `E` 级 `not have subMenuItems`，随后整个 `addToStatusBar` 抛 `401 "parameter check failed"`。

> `not have subMenuItems` 在修复后**仍会出现**（每个无子菜单的叶子项一条）——它是 statusBarManager 的**良性信息日志**（E 级但非致命），不是错误。修复前它伴随 401 出现，修复后 401 消失而该日志保留。

**关键**：`StatusBarMenuItemOptions` 此前已对 `iconRgba`/`iconWidth`/`iconHeight` 加了 `skip_serializing_if`（`lib.rs` 该结构体），但**漏了对父级 3 个结构体**（`StatusBarMenuItem`/`StatusBarSubMenuItem`/`StatusBarMenuAction`）及 `Options.selected` 加该属性——这正是 camelCase 修复（§7.3 历史）后 401 浮现的原因：camelCase 让 statusBarManager **认出** `subMenu` 键，随即发现它是 `null`（非数组）而非 absent。camelCase 之前 `subMenu` 因 snake_case 不可见等同于 absent，故 1010720001（既无 menuAction 又无 subMenu）优先命中；camelCase 后该 1010720001 消失，`subMenu: null` 的 401 取而代之。

**历史偏差（已修复 2026-08-13）**：§7.2 修完（`abilityContext` 不再 null）后 `addToStatusBar` 真正被调用，暴露 `code=1010720001 "A menu item contains neither submenu nor menuAction"`。根因：旧 core TSFN 路径 `crates/ability/src/statusbar/manager.rs::build_menu_item_object_static`（line 245-348）用 NAPI `Object::set` **手写 camelCase 键**（`obj.set("menuAction",…)` line 261、`obj.set("subMenu",…)` line 314、`obj.set("iconRgba",…)` line 301 等）；桥接迁移改用 `serde_json::to_string` 原始 JSON 透传，**丢掉了这步 camelCase 翻译**。修法：4 个结构体加 `#[serde(rename_all = "camelCase")]`（Rust serde 配置，不动 ArkTS、不动桥框架）。同时修 `add` 与 `update-menu` 两条路径。

> 注：`menu_json` 用 JSON 字符串而非原生 `#[napi(object)]` 嵌套数组，与 `named-napi-contracts` 的 no-JSON 规则有张力（§7 已述），当前与 design.md §1.2/§3.4 及 Rust 实现一致；本次仅补键名翻译，no-JSON 重构属独立 follow-up。

### 7.4 状态栏图标尺寸约束（density-corrected PixelMap，已修复 2026-08-13）

`statusBarManager.addToStatusBar` 对 icon PixelMap 曾报 `JsStatusbarManager: The size of the pixelmap exceeds the limit.`（hilog `E` 级，错误码 `1010710001`）。**实测（MateBook Pro 2026-08-13）**：固定物理像素的 PixelMap（32×32 / 24×24）均被拒。

**根因**：状态栏图标槽位按 **24vp**（virtual pixel）度量，statusBarManager 要求 PixelMap 的物理像素 = `24 × display.densityPixels`。固定像素 PixelMap 不带密度信息，被判定超限。OHOS 参考实现以 24vp 创作图标、用 `image.createImageSource().createPixelMap()` 解码（该路径产 density-corrected 像素）。

**修法（ArkTS 侧）**：`StatusBarUtils.ets::createPixelMapFromRgba` 创建 PixelMap 后按显示密度 `scaleSync`：
```ts
let density = display.getDefaultDisplaySync().densityPixels;  // e.g. 1.9
let target = Math.round(24 * density);                         // e.g. 46
if (target > 0 && target !== size) {
  const ratio = target / size;                                 // e.g. 1.4375
  pm.scaleSync(ratio, ratio);
}
```
device 验证：`src=32 density=1.9 target=46 scaled=true (ratio=1.4375)`，`exceeds the limit` 计数=0。

**Rust 侧配套**：`tray-icon/src/platform_impl/ohos/icon.rs::icon_to_status_bar_icon` 的尺寸钳制从 24 放宽至 256（仅作内存安全上限，不再做业务级尺寸约束）——源像素流过原生尺寸（如 32×32），由 ArkTS 侧做密度校正：
```rust
const MAX_STATUS_BAR_ICON_EDGE: u32 = 256;
let size = width.min(height).min(MAX_STATUS_BAR_ICON_EDGE);
```

**定性**：pixelmap 密度警告**非致命**——即便出现 `exceeds the limit`，`addToStatusBar` 仍继续处理 menu 并返回（图标只是不渲染）。density 修复后该警告消失、图标正常渲染。401 与本节无关（401 根因见 §7.3 null-vs-absent）。

### 7.5 `quickOperation.abilityName` 空串语义约束（`??` 非 `||`，防御性正确）

`StatusbarPlugin.ets:add` 重建 `quickOperation` 时，`abilityName` **必须用空合并 `??`，禁止逻辑或 `||`**：
```ts
// ✅ 正确（保留空串 ""）
abilityName: request.abilityName ?? abilityContext.abilityInfo.name,
// ❌ 错误（|| 把 "" 当 falsy，回退到主 UIAbility 名）
abilityName: request.abilityName || abilityContext.abilityInfo.name,
```

**空串的语义（legacy 契约）**：`ArkHelper.ets::addToStatusBarWithRgba`（line 759-764）有显式注释契约——`abilityName=""` 表示「**无 QuickOperation 面板，改触发 `statusBarIconClick` 事件**」；仅当 `abilityName == null`（非 falsy 判定）才填 `context.abilityInfo.name`。`??` 与 `== null` 语义一致（仅在 null/undefined 触发，保留 `""`），故 `??` 是 legacy 契约的等价实现。`||` 把空串当 falsy 会错误回退到主 singleton UIAbility 名。

**实现约束**：`plugins/statusbar/src/main/ets/StatusbarPlugin.ets`（源）与 `package/src/main/ets/plugins/statusbar/StatusbarPlugin.ets`（pack 产物，由 `pack-plugins.ps1` 从前者拷贝 + import 改写）**两处**均须用 `??`。`request.abilityName` 是 Rust `String` 跨桥为 JS 字符串，永不为 null/undefined，故 `??` 右侧回退实际不触发——它纯粹是防御性兜底，语义正确性靠「不把 `""` 当 falsy」。

**配套（清除残留实例）**：`tray-icon/.../mod.rs::TrayIcon::new` 的 worker 闭包在 `client.add` 前**先** best-effort `client.remove(StatusBarRemoveRequest {})`——清除前次/被杀进程残留的状态栏注册。兄弟 mutator（`set_title`/`set_visible`/`Drop`）本就 remove 先行。`removeFromStatusBar` 在无注册时是 no-op，fresh launch 安全。

> **401 根因更正（device 验证 2026-08-13）**：本节先前版本断言 `||`→`??` 是 `code=401 check param error` 的根因——**已证伪**。设备验证：example app 的 `quick_operation.ability_name` = `"TestTrayAbility"`（truthy 非空），故 `??` 与 `||` 行为一致，均不会回退到 `"EntryAbility"`；部署 `??` 后 401 依旧。真正的 401 根因是 §7.3 的 **`subMenu: null`（present-but-null 而非 absent）**。`??` 修复保留（语义正确，防御性），但**非** 401 原因。
>
> 同样证伪：`fillMenuItemAbilityName`（`StatusBarUtils.ets`）把运行中 singleton `"EntryAbility"` 注入所有 8 个 `menuAction.abilityName` 这一现象**未**导致 401——`skip_serializing_if` 修复 `subMenu:null` 后，tray 成功注册（`worker: add Ok`），尽管 `menuAction.abilityName` 仍被注入 `"EntryAbility"`。`getCurrentInstanceKey code=16000078` 日志在修复前后均出现且 statusBarManager 返回成功——它是多实例 API 对 singleton 调用方的**按设计抛出并被内部 catch/日志**，不致命、不导致 401。
