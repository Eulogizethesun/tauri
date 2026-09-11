// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, Manager};

#[tauri::command]
fn close_splashscreen(app: AppHandle) {
  // Close splashscreen
  app
    .get_webview_window("splashscreen")
    .unwrap()
    .close()
    .unwrap();
  // Show main window
  app.get_webview_window("main").unwrap().show().unwrap();
}

fn main() {
  let builder = tauri::Builder::default();
  // The app-wide menu is desktop-only (mobile form factors have no menubar).
  #[cfg(desktop)]
  let builder = builder.menu(tauri::menu::Menu::default);
  builder
    .invoke_handler(tauri::generate_handler![close_splashscreen])
    .run(tauri::generate_context!(
      "../../examples/splashscreen/tauri.conf.json"
    ))
    .expect("error while running tauri application");
}
