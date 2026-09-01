## 1. Facade 覆盖度补齐

- [ ] 1.1 plugin-window: 新增 `WindowTouchableRequest` 类型（`impl_bridge_napi_type!("ohos.window.TouchableRequest")`）+ `WindowClient::set_window_touchable()` 方法
- [ ] 1.2 plugin-window ArkTS 侧: `WindowPlugin.ets` 添加 `set-touchable` action handler 路由到 `setWindowTouchable`
- [ ] 1.3 plugin-menu: 添加 per-window `menubar_visible` + `menu_has_content` 状态缓存（`LazyLock<RwLock<HashMap>>`），`set_menubar_visible` 和 `set_menubar` 调用时更新缓存
- [ ] 1.4 plugin-menu: 新增 `MenuClient::is_menubar_visible(window_id: &str) -> bool` 同步方法（读缓存）
- [ ] 1.5 plugin-menu: 新增 `MenuClient::set_menu_json(json_data: String, window_id: String)` 异步方法（映射到 `set-menubar` action + 更新 `menu_has_content` 缓存）

## 2. 低成本 Consumer 迁移

- [ ] 2.1 deep-link: `plugins-workspace/plugins/deep-link/src/lib.rs:246` — `take_initial_want_uri()` → `DeepLinkClient`
- [ ] 2.2 single-instance: `plugins-workspace/plugins/single-instance/src/platform_impl/ohos.rs:27` — `take_want_parameters()` → `DeepLinkClient`
- [ ] 2.3 autostart: `plugins-workspace/plugins/autostart/src/lib.rs:16` — `AutostartManager` → `AutostartClient`
- [ ] 2.4 clipboard-manager: `plugins-workspace/plugins/clipboard-manager/src/desktop.rs:176` — `clipboard_write_image` → `ClipboardClient`
- [ ] 2.5 opener: `plugins-workspace/plugins/opener/src/open.rs:42,79` + `reveal_item_in_dir.rs:92` — `open_with_system`/`reveal_in_dir` → facade
- [ ] 2.6 window-vibrancy: `window-vibrancy/src/ohos.rs` 7 处 — `set_window_blur`/`set_window_background_color` → `WindowClient`

## 3. 中成本 Consumer 迁移

- [ ] 3.1 tauri-runtime-wry: `src/lib.rs:2527,2555,4839` — `focus_window`/`set_window_focusable`/`destroy_window` → `WindowClient`（N11）
- [ ] 3.2 tao: `src/platform_impl/ohos/mod.rs:11-13` — `create_os_window`/`set_window_touchable` → `WindowClient`（N12，需 1.1 完成）
- [ ] ~~3.3 tauri core window → **延迟到 Phase 4**（需 MenuPlugin.ets ArkTS 插件就位后迁移）~~
- [ ] ~~3.4 tauri core menu → **延迟到 Phase 4**（需 MenuPlugin.ets ArkTS 插件就位后迁移）~~

## 4. Global-shortcut 全套迁移（N14）

- [ ] 4.1 实现 `ShortcutModifier`/`ShortcutKey` enum → `Vec<String>`/`&str` 适配转换函数
- [ ] 4.2 迁移 `init_forwarder()` → 删除（bridge AsyncBridge 已提供执行能力）
- [ ] 4.3 迁移 `register_shortcut()` → `GlobalShortcutClient::register()`（含 enum 转换）
- [ ] 4.4 迁移 `unregister_shortcut()` → `GlobalShortcutClient::unregister()`
- [ ] 4.5 迁移 `unregister_all_shortcuts()` → `GlobalShortcutClient::unregister_all()`
- [ ] 4.6 迁移 `shortcut_event_receiver()` → `GlobalShortcutClient::event_receiver()`
- [ ] 4.7 迁移 `ShortcutState` enum 适配（bridge 返回 `"Pressed"`/`"Released"` 字符串）

## 5. 旧 API 删除

- [ ] 5.1 删除 `app.rs` 中 `take_initial_want_uri()` + `INITIAL_WANT_URI` + `take_want_parameters()`
- [ ] 5.2 删除 `global_shortcut/mod.rs` 中 `init_forwarder()` + `DISPATCHER`
- [ ] 5.3 清理 `lib.rs` 中对应的 re-export（global_shortcut 块中与 forwarder 相关的部分）
- [ ] ~~5.4 menu 旧 API 删除 → **延迟到 Phase 4**~~

## 6. Cargo.toml 依赖更新

- [ ] 6.1 更新各 consumer crate `Cargo.toml` 添加对应 plugin facade crate 依赖
- [ ] 6.2 确认 workspace-level 依赖声明一致性

## 7. 验证

- [ ] 7.1 `cargo check` 全 workspace 通过（OHOS target）
- [ ] 7.2 `cargo check` 全 workspace 通过（Windows target，确认 cfg 隔离）
- [ ] 7.3 搜索确认 workspace 中 `openharmony_ability::` 直调仅剩合法核心 API（OpenHarmonyApp/BridgeRuntime/Event 等）
- [ ] 7.4 搜索确认旧 API 符号无残留引用
