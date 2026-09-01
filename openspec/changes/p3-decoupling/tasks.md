# Implementation Tasks: Phase 3 — Channel 再迁移

## 3.1 Menu Channel 迁移到 muda

- [ ] **3.1** muda OHOS 适配层新增 channel 定义
  - 文件: `muda/src/platform_impl/ohos/mod.rs`
  - 新增 `MENU_EVENT_CHANNEL: LazyLock<Sender<MenuEvent>>` 定义
  - 新增 `menu_event_receiver()` / `send_menu_event()` 函数
  - 添加 crossbeam-channel 依赖（若未有）

- [ ] **3.2** plugin-menu 删除 channel API + bridge push 到 muda 侧
  - 文件: `openharmony-ability/crates/plugin-menu/src/lib.rs`
  - 删除 `MENU_EVENT_CHANNEL` 定义 + `menu_event_receiver()`/`send_menu_event()` 公共函数
  - `on_main_thread_event` 的 `menu-click` 解码改为 push 到 muda 侧 `send_menu_event()`
  - 保留 bridge 类型契约 + plugin 声明

- [ ] **3.3** muda 消费方改引用本地 channel
  - 文件: `muda/src/platform_impl/ohos/mod.rs`（或调用方位置）
  - 将 `plugin_menu::menu_event_receiver()` 调用改为本地 `menu_event_receiver()`

## 3.2 Statusbar Channel 迁移到 tray-icon

- [ ] **3.4** tray-icon OHOS 适配层新增 channel 定义
  - 文件: `tray-icon/src/platform_impl/ohos/event.rs`
  - 新增 `ICON_CLICK_CHANNEL`/`MENU_CLICK_CHANNEL` 定义
  - 新增 `icon_click_receiver()`/`menu_click_receiver()` 函数
  - 检查 tray-icon 是否已有部分 channel 定义，合并去重

- [ ] **3.5** plugin-statusbar 删除 channel API + bridge push 到 tray-icon 侧
  - 文件: `openharmony-ability/crates/plugin-statusbar/src/lib.rs`
  - 删除 `ICON_CLICK_CHANNEL`/`MENU_CLICK_CHANNEL` 定义
  - 删除 `icon_click_receiver()`/`menu_click_receiver()` 公共函数
  - bridge 事件解码改为 push 到 tray-icon 侧 channel
  - 保留 bridge 类型契约 + plugin 声明

- [ ] **3.6** tray-icon 消费方改引用本地 channel
  - 文件: `tray-icon/src/platform_impl/ohos/event.rs`（或调用方位置）
  - 将 `plugin_statusbar::icon_click_receiver()`/`menu_click_receiver()` 调用改为本地引用

## 3.3 编译验证 + 设备端验证

- [ ] **3.7** 全链路 cargo check
  - muda: `cargo check --target aarch64-unknown-linux-ohos`
  - tray-icon: `cargo check --target aarch64-unknown-linux-ohos`
  - plugin-menu: `cargo check --target aarch64-unknown-linux-ohos`
  - plugin-statusbar: `cargo check --target aarch64-unknown-linux-ohos`

- [ ] **3.8** 设备端菜单/tray 点击验证
  - 设备端验证菜单点击事件正常分发
  - 设备端验证 statusbar icon click 事件正常分发
  - 确认无事件丢失或重复
