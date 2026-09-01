## 1. 旧 menu channel API 标记 deprecated

- [ ] 1.1 在 `menu/mod.rs` 中为 `menu_event_receiver()`（:96）、`send_menu_event()`（:103）、`popup_request_receiver()`（:113）、`menu_request_receiver()`（:108）、`start_popup_forwarder()`（:230）、`start_menu_forwarder()`、`popup_context_menu()`、`set_menu_json()` 添加 `#[deprecated(note = "Use plugin-menu facade instead")]`
- [ ] 1.2 在 `menu/mod.rs` 内部使用 deprecated 函数的位置添加 `#[allow(deprecated)]`（如 `emit_menu_event` NAPI 函数内部调用 `MENU_EVENT_CHANNEL`）
- [ ] 1.3 在 `lib.rs:132-141` 的 menu re-export 块添加 `#[allow(deprecated)]`

## 2. 旧 statusbar channel API 标记 deprecated

- [ ] 2.1 在 `statusbar/event.rs` 中为 `icon_click_sender()`（:22）、`menu_click_sender()`（:26）、`icon_click_receiver()`（:30）、`menu_click_receiver()`（:34）、`register_icon_click_handler()`（:38）、`register_menu_click_handler()` 添加 `#[deprecated(note = "Use plugin-statusbar facade instead")]`
- [ ] 2.2 在 `statusbar/event.rs` 内部使用 deprecated 函数的位置添加 `#[allow(deprecated)]`（如 `icon_click_channel()` 和 `menu_click_channel()` 的 lazy init 辅助函数）

## 3. 删除 helper/webview.rs 死代码

- [ ] 3.1 删除 `crates/ability/src/helper/webview.rs` 文件（970 行）
- [ ] 3.2 移除 `helper/mod.rs:13-14` 的 `#[cfg(feature = "webview")] mod webview;` 声明
- [ ] 3.3 移除 `helper/mod.rs:25-26` 的 `#[cfg(feature = "webview")] pub use webview::*;` 声明

## 4. 移除空壳 drag_and_drop feature

- [ ] 4.1 从 `ability/Cargo.toml:10` 移除 `drag_and_drop = []` feature 定义
- [ ] 4.2 从 `wry/Cargo.toml:206` 移除 `features = ["drag_and_drop"]` 启用
- [ ] 4.3 搜索确认 wry 源码中无 `cfg(feature = "drag_and_drop")` gate（若有则一并清理）

## 5. 验证

- [ ] 5.1 运行 `cargo check --target aarch64-unknown-linux-ohos`（openharmony-ability）确认编译通过
- [ ] 5.2 运行 `cargo check`（wry）确认编译通过
- [ ] 5.3 搜索确认 `helper::webview` 引用为零
- [ ] 5.4 搜索确认 deprecated 标注正确应用（`rg '#\[deprecated' crates/ability/src/`）
