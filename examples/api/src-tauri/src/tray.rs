// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

#![cfg(all(desktop, not(test)))]

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
  include_image,
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, QuickOperationConfig, TrayIconBuilder, TrayIconEvent},
  Emitter, EventTarget, Manager, Runtime, WebviewUrl,
};

#[cfg(target_env = "ohos")]
#[tauri::command]
pub fn simulate_tray_click<R: Runtime>(
  _app: tauri::AppHandle<R>,
  button: String,
) -> Result<(), String> {
  let click_type = match button.as_str() {
    "Right" => "rightClick",
    _ => "leftClick",
  };
  tauri::ohos::openharmony_ability::statusbar::icon_click_sender()
    .send(tauri::ohos::openharmony_ability::statusbar::StatusBarClickEvent::IconClick {
      click_type: click_type.to_string(),
    })
    .map_err(|e| format!("Failed to send tray click event: {}", e))?;
  Ok(())
}

#[cfg(not(target_env = "ohos"))]
#[tauri::command]
pub fn simulate_tray_click<R: Runtime>(
  _app: tauri::AppHandle<R>,
  _button: String,
) -> Result<(), String> {
  Err("simulate_tray_click is only available on OHOS".to_string())
}

pub fn create_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
  let toggle_i = MenuItem::with_id(app, "toggle", "Toggle", true, None::<&str>)?;
  let new_window_i = MenuItem::with_id(app, "new-window", "New window", true, None::<&str>)?;
  let icon_i_1 = MenuItem::with_id(app, "icon-1", "Icon 1", true, None::<&str>)?;
  let icon_i_2 = MenuItem::with_id(app, "icon-2", "Icon 2", true, None::<&str>)?;
  #[cfg(target_os = "macos")]
  let set_title_i = MenuItem::with_id(app, "set-title", "Set Title", true, None::<&str>)?;
  let switch_i = MenuItem::with_id(app, "switch-menu", "Switch Menu", true, None::<&str>)?;
  let toggle_qo_i = MenuItem::with_id(app, "toggle-qo", "Toggle QuickOp", true, None::<&str>)?;
  let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
  let remove_tray_i =
    MenuItem::with_id(app, "remove-tray", "Remove Tray icon", true, None::<&str>)?;
  let menu1 = Menu::with_items(
    app,
    &[
      &toggle_i,
      &new_window_i,
      &icon_i_1,
      &icon_i_2,
      #[cfg(target_os = "macos")]
      &set_title_i,
      &switch_i,
      &toggle_qo_i,
      &quit_i,
      &remove_tray_i,
    ],
  )?;
  let menu2 = Menu::with_items(
    app,
    &[&toggle_i, &new_window_i, &switch_i, &toggle_qo_i, &quit_i, &remove_tray_i],
  )?;

  let is_menu1 = AtomicBool::new(true);

  let _ = TrayIconBuilder::with_id("tray-1")
    .tooltip("Tauri")
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu1)
    .show_menu_on_left_click(false)
    // OHOS: enable QuickOperation left-click popup (no-op on other platforms)
    .quick_operation(QuickOperationConfig {
      title: "Tauri API".into(),
      height: 300,
      ability_name: "TestTrayAbility".into(),
      module_name: Some("entry".into()),
      loading_status: None,
    })
    .on_menu_event(move |app, event| {
      let id = event.id().as_ref();
      // Tray's on_menu_event fires for ALL menu events (by tauri design).
      // Only execute actions for tray-specific item IDs.
      const TRAY_IDS: &[&str] = &[
        "toggle", "new-window", "icon-1", "icon-2", "set-title",
        "switch-menu", "toggle-qo", "quit", "remove-tray",
      ];
      if !TRAY_IDS.contains(&id) {
        return;
      }
      log::info!("[Tray on_menu_event] id={}", id);
      let _ = app.emit_to(
        EventTarget::webview_window("main"),
        "menu-event",
        format!("tray:{}", id),
      );
      match event.id.as_ref() {
      "quit" => {
        app.exit(0);
      }
      "remove-tray" => {
        app.remove_tray_by_id("tray-1");
      }
      "toggle" => {
        if let Some(window) = app.get_webview_window("main") {
          let new_title = if window.is_visible().unwrap_or_default() {
            let _ = window.hide();
            "Show"
          } else {
            let _ = window.show();
            let _ = window.set_focus();
            "Hide"
          };
          toggle_i.set_text(new_title).unwrap();
        }
      }
      "new-window" => {
        let _webview =
          tauri::WebviewWindowBuilder::new(app, "new", WebviewUrl::App("index.html".into()))
            .title("Tauri")
            .build()
            .unwrap();
      }
      #[cfg(target_os = "macos")]
      "set-title" => {
        if let Some(tray) = app.tray_by_id("tray-1") {
          let _ = tray.set_title(Some("Tauri"));
        }
      }
      i @ "icon-1" | i @ "icon-2" => {
        if let Some(tray) = app.tray_by_id("tray-1") {
          let icon = if i == "icon-1" {
            include_image!("../../.icons/icon.ico")
          } else {
            include_image!("../../.icons/tray_icon_with_transparency.png")
          };
          let _ = tray.set_icon(Some(icon));
        }
      }
      "switch-menu" => {
        let flag = is_menu1.load(Ordering::Relaxed);
        let (menu, tooltip) = if flag {
          (menu2.clone(), "Menu 2")
        } else {
          (menu1.clone(), "Tauri")
        };
        if let Some(tray) = app.tray_by_id("tray-1") {
          let _ = tray.set_menu(Some(menu));
          let _ = tray.set_tooltip(Some(tooltip));
        }
        is_menu1.store(!flag, Ordering::Relaxed);
      }
      "toggle-qo" => {
        if let Some(tray) = app.tray_by_id("tray-1") {
          // Toggle QuickOperation off (demonstrates runtime update)
          let _ = tray.set_quick_operation(None);
        }
      }

      _ => {}
    }})
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.unminimize();
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
    })
    .build(app);

  Ok(())
}
