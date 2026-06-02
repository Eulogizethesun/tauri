// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT
#![cfg(all(desktop, not(test)))]

use tauri::{
  command,
  plugin::{Builder, TauriPlugin},
  Runtime,
};

#[cfg(not(target_os = "macos"))]
#[command]
pub fn toggle<R: tauri::Runtime>(window: tauri::Window<R>) {
  if window.is_menu_visible().unwrap_or_default() {
    let _ = window.hide_menu();
  } else {
    let _ = window.show_menu();
  }
}

#[cfg(target_os = "macos")]
#[command]
pub fn toggle<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  app_menu: tauri::State<'_, crate::AppMenu<R>>,
) {
  if let Some(menu) = app.remove_menu().unwrap() {
    app_menu.0.lock().unwrap().replace(menu);
  } else {
    app
      .set_menu(app_menu.0.lock().unwrap().clone().expect("no app menu"))
      .unwrap();
  }
}

#[command]
pub fn popup<R: tauri::Runtime>(
  window: tauri::Window<R>,
  popup_menu: tauri::State<'_, crate::PopupMenu<R>>,
) {
  window.popup_menu(&popup_menu.0).unwrap();
}

#[cfg(not(target_os = "macos"))]
#[command]
pub fn hide_menu<R: tauri::Runtime>(window: tauri::Window<R>) -> tauri::Result<()> {
  window.hide_menu()
}

#[cfg(target_os = "macos")]
#[command]
pub fn hide_menu<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<()> {
  app.hide_menu()
}

#[cfg(not(target_os = "macos"))]
#[command]
pub fn show_menu<R: tauri::Runtime>(window: tauri::Window<R>) -> tauri::Result<()> {
  window.show_menu()
}

#[cfg(target_os = "macos")]
#[command]
pub fn show_menu<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<()> {
  app.show_menu()
}

#[cfg(not(target_os = "macos"))]
#[command]
pub fn is_menu_visible<R: tauri::Runtime>(window: tauri::Window<R>) -> bool {
  window.is_menu_visible().unwrap_or(true)
}

#[cfg(target_os = "macos")]
#[command]
pub fn is_menu_visible<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> bool {
  app.is_menu_visible().unwrap_or(true)
}

#[cfg(target_env = "ohos")]
#[command]
pub fn simulate_menu_click<R: tauri::Runtime>(
  _app: tauri::AppHandle<R>,
  item_id: String,
) -> Result<(), String> {
  tauri::ohos::openharmony_ability::menu::send_menu_event(item_id);
  Ok(())
}

#[cfg(not(target_env = "ohos"))]
#[command]
pub fn simulate_menu_click<R: tauri::Runtime>(
  _app: tauri::AppHandle<R>,
  _item_id: String,
) -> Result<(), String> {
  Err("simulate_menu_click is only available on OHOS".to_string())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("app-menu")
    .invoke_handler(tauri::generate_handler![
      #![plugin(app_menu)]
      popup,
      toggle,
      hide_menu,
      show_menu,
      is_menu_visible,
      simulate_menu_click
    ])
    .build()
}
