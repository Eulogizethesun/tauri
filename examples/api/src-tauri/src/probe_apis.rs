//! S9 gap-filler probe commands: light up App/Window methods reachable only
//! from Rust (not exposed on the JS API surface) — the AppHandle monitor
//! quartet, app.rs + window/mod.rs set_menu/remove_menu, and the
//! Webview::reparent "not supported on OHOS" warning branch.
//! Coverage-instrumented builds only; semantics match the driver's blind
//! calls — execution is the coverage, errors are aggregated into the
//! returned string.

use tauri::Manager;

/// AppHandle monitor/cursor quartet + a return summary per API.
#[tauri::command]
pub fn probe_app_monitors<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
) -> Result<String, String> {
  let mut out = Vec::new();

  match app.primary_monitor() {
    Ok(Some(m)) => out.push(format!("primary={:?}", m.name())),
    Ok(None) => out.push("primary=None".to_string()),
    Err(e) => out.push(format!("primary=err({e})")),
  }

  match app.monitor_from_point(100.0, 200.0) {
    Ok(Some(m)) => out.push(format!("from_point={:?}", m.name())),
    Ok(None) => out.push("from_point=None".to_string()),
    Err(e) => out.push(format!("from_point=err({e})")),
  }

  match app.available_monitors() {
    Ok(monitors) => out.push(format!("available={}", monitors.len())),
    Err(e) => out.push(format!("available=err({e})")),
  }

  match app.cursor_position() {
    Ok(p) => out.push(format!("cursor={},{}", p.x, p.y)),
    Err(e) => out.push(format!("cursor=err({e})")),
  }

  Ok(out.join(" | "))
}

/// app.rs AppHandle::set_menu + remove_menu (app-wide menu install/remove).
#[cfg(desktop)]
#[tauri::command]
pub fn probe_app_menu_set_remove<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
) -> Result<String, String> {
  let mut out = Vec::new();

  let menu = tauri::menu::Menu::new(&app).map_err(|e| e.to_string())?;
  match app.set_menu(menu) {
    Ok(prev) => out.push(format!("set_menu prev={:?}", prev.is_some())),
    Err(e) => out.push(format!("set_menu err({e})")),
  }

  match app.remove_menu() {
    Ok(prev) => out.push(format!("remove_menu prev={:?}", prev.is_some())),
    Err(e) => out.push(format!("remove_menu err({e})")),
  }

  Ok(out.join(" | "))
}

/// window/mod.rs Window::set_menu + remove_menu (per-window menu install/
/// remove, including the OHOS menubar branch).
#[cfg(desktop)]
#[tauri::command]
pub fn probe_window_menu_set_remove<R: tauri::Runtime>(
  window: tauri::Window<R>,
) -> Result<String, String> {
  let mut out = Vec::new();

  let menu = tauri::menu::Menu::new(&window).map_err(|e| e.to_string())?;
  match window.set_menu(menu) {
    Ok(prev) => out.push(format!("set_menu prev={:?}", prev.is_some())),
    Err(e) => out.push(format!("set_menu err({e})")),
  }

  match window.remove_menu() {
    Ok(prev) => out.push(format!("remove_menu prev={:?}", prev.is_some())),
    Err(e) => out.push(format!("remove_menu err({e})")),
  }

  Ok(out.join(" | "))
}

/// OHOS: default display refresh rate (Hz). NDK-direct
/// (OH_NativeDisplayManager_GetDefaultDisplayRefreshRate via
/// ohos-display-binding), not a bridge plugin — under the core-privilege
/// mode it reads OpenHarmonyApp::refresh_rate() from tauri::ohos::APP,
/// the same source as tao video_modes()'s refresh_rate. tauri::Monitor
/// does not carry a refresh rate (upstream semantics on all platforms)
/// and the JS Monitor API cannot reach it, so this probe provides the
/// on-device verification entry point. The MutexGuard is dropped
/// explicitly at scope end (ohos-bridge-arch hard rule).
#[cfg(target_env = "ohos")]
#[tauri::command]
pub fn probe_display_refresh_rate() -> Result<String, String> {
  let rate = {
    let app = tauri::ohos::APP
      .lock()
      .unwrap_or_else(|e| e.into_inner());
    let app = app
      .as_ref()
      .ok_or_else(|| "ohos APP not initialized".to_string())?;
    app.refresh_rate()
  };
  Ok(format!("refresh_rate={rate} Hz"))
}

/// Webview::reparent — on OHOS expected to take the "not supported" warning
/// branch (which is exactly the coverage target).
/// `Webview::reparent` lives in the `#[cfg(desktop)]` impl block upstream, so it is
/// only available on desktop targets. Mobile (phone/tablet) compiles without it;
/// surface a not-supported result instead of a compile error.
#[tauri::command]
pub fn probe_webview_reparent<R: tauri::Runtime>(
  window: tauri::Window<R>,
) -> Result<String, String> {
  #[cfg(desktop)]
  {
    let webview = window
      .webviews()
      .into_iter()
      .next()
      .ok_or_else(|| "no webview on window".to_string())?;
    match webview.reparent(&window) {
      Ok(()) => Ok("reparent=ok".to_string()),
      Err(e) => Ok(format!("reparent=err({e})")),
    }
  }
  #[cfg(not(desktop))]
  {
    let _ = window;
    Ok("reparent=err(not supported on mobile)".to_string())
  }
}
