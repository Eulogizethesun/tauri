// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Types and functions related to child processes management.

use crate::Env;

use std::path::PathBuf;

/// Finds the current running binary's path.
///
/// With exception to any following platform-specific behavior, the path is cached as soon as
/// possible, and then used repeatedly instead of querying for a new path every time this function
/// is called.
///
/// # Platform-specific behavior
///
/// ## Linux
///
/// On Linux, this function will **attempt** to detect if it's currently running from a
/// valid [AppImage] and use that path instead.
///
/// ## macOS
///
/// On `macOS`, this function will return an error if the original path contained any symlinks
/// due to less protection on macOS regarding symlinks. This behavior can be disabled by setting the
/// `process-relaunch-dangerous-allow-symlink-macos` feature, although it is *highly discouraged*.
///
/// # Security
///
/// See [`tauri_utils::platform::current_exe`] for possible security implications.
///
/// # Examples
///
/// ```rust,no_run
/// use tauri::{process::current_binary, Env, Manager};
/// let current_binary_path = current_binary(&Env::default()).unwrap();
///
/// tauri::Builder::default()
///   .setup(|app| {
///     let current_binary_path = current_binary(&app.env())?;
///     Ok(())
///   });
/// ```
///
/// [AppImage]: https://appimage.org/
pub fn current_binary(_env: &Env) -> std::io::Result<PathBuf> {
  // if we are running from an AppImage, we ONLY want the set AppImage path
  #[cfg(all(target_os = "linux", not(target_env = "ohos")))]
  if let Some(app_image_path) = &_env.appimage {
    return Ok(PathBuf::from(app_image_path));
  }

  tauri_utils::platform::current_exe()
}

/// Restarts the currently running binary.
///
/// See [`current_binary`] for platform specific behavior, and
/// [`tauri_utils::platform::current_exe`] for possible security implications.
///
/// # Platform-specific behavior
///
/// ## OpenHarmony
///
/// Restarts via the official `ApplicationContext.restartApp` (API 12+) through
/// the app-control MainThreadSync bridge, which kills all of the app's
/// processes and relaunches the current UIAbility. A bare process exit does
/// NOT relaunch the app on OHOS (verified on device), so `exit(0)` is only the
/// fallback used when the bridge call fails.
///
/// The bridge call needs the N-API `Env` of the app's main thread, so this
/// function **must be called from the main thread** — the `Env` is retrieved
/// from a thread-local and is unavailable on worker threads. When called from
/// a worker thread the bridge call fails and the `exit(0)` fallback runs: the
/// app exits and is NOT restarted. Prefer [`crate::AppHandle::restart`] or
/// [`crate::AppHandle::request_restart`], which route the actual restart
/// through the main-thread event loop regardless of the calling thread.
///
/// After `restartApp` is accepted this function never returns: it parks the
/// calling thread waiting for the ability runtime to kill the process — there
/// is no timeout fallback, because a racing local exit could interfere with
/// the restart handshake. `restartApp` also requires the app to be focused:
/// called from the background it fails with error 16000053 ("The ability is
/// not on the top of the UI"; retrying within 3s fails with 16000064), which
/// surfaces here as a bridge error and ends as exit-without-restart.
///
/// Two triage notes for the background-failure path (both verified on
/// device): the `exit(0)` fallback leaves a `cppcrash` SIGABRT record in the
/// system faultlogger — appspawn redirects a main-thread `exit` to `abort`,
/// so the designed degradation looks like a crash to anyone triaging
/// faultlogs — and the numeric error code never appears in device logs: AMS
/// logs `restartApp, is not foreground` and the bridge error carries the
/// message "Not top ability" instead.
///
/// # Examples
///
/// ```rust,no_run
/// use tauri::{process::restart, Env, Manager};
///
/// tauri::Builder::default()
///   .setup(|app| {
///     restart(&app.env());
///     Ok(())
///   });
/// ```
pub fn restart(env: &Env) -> ! {
  #[cfg(target_env = "ohos")]
  {
    use openharmony_ability_plugin_app_control::AppControlExt;

    let _ = env;
    // OHOS restart uses the official `ApplicationContext.restartApp` (API 12+)
    // through the app-control MainThreadSync bridge: it kills all of the app's
    // processes and relaunches the current UIAbility. A bare
    // `std::process::exit` does NOT relaunch — verified on device, the OS keeps
    // the process dead — so it is only the failure fallback.
    let restart_error: Option<String> = (|| -> Result<(), String> {
      let app_guard = crate::ohos::APP
        .lock()
        .unwrap_or_else(|e| e.into_inner());
      let app = app_guard
        .as_ref()
        .ok_or_else(|| "OpenHarmonyApp not initialized".to_string())?;
      let env_cell = crate::ohos::openharmony_ability::get_main_thread_env();
      let env_ref = env_cell.borrow();
      let env = env_ref
        .as_ref()
        .ok_or_else(|| "main thread N-API Env not available".to_string())?;
      app
        .restart(env)
        .map_err(|e| format!("restartApp bridge call failed: {e}"))
    })()
    .err();

    if let Some(e) = restart_error {
      log::error!("[tauri] OHOS restartApp failed: {e} — falling back to process exit");
      std::process::exit(0);
    }

    // restartApp accepted: the ability runtime is killing and relaunching this
    // process. Never return — let the runtime perform the teardown (a racing
    // local exit could interfere with the restart handshake).
    loop {
      std::thread::sleep(std::time::Duration::MAX);
    }
  }

  #[cfg(not(target_env = "ohos"))]
  {
    use std::process::{exit, Command};

    if let Ok(path) = current_binary(env) {
      // on macOS on updates the binary name might have changed
      // so we'll read the Contents/Info.plist file to determine the binary path
      #[cfg(target_os = "macos")]
      restart_macos_app(&path, env);

      if let Err(e) = Command::new(path).args(env.args_os.iter().skip(1)).spawn() {
        log::error!("failed to restart app: {e}");
      }
    }

    exit(0);
  }
}

#[cfg(target_os = "macos")]
fn restart_macos_app(current_binary: &std::path::Path, env: &Env) {
  use std::process::{exit, Command};

  if let Some(macos_directory) = current_binary.parent() {
    if macos_directory.components().next_back()
      != Some(std::path::Component::Normal(std::ffi::OsStr::new("MacOS")))
    {
      return;
    }

    if let Some(contents_directory) = macos_directory.parent() {
      if contents_directory.components().next_back()
        != Some(std::path::Component::Normal(std::ffi::OsStr::new(
          "Contents",
        )))
      {
        return;
      }

      if let Ok(info_plist) =
        plist::from_file::<_, plist::Dictionary>(contents_directory.join("Info.plist"))
      {
        if let Some(binary_name) = info_plist
          .get("CFBundleExecutable")
          .and_then(|v| v.as_string())
        {
          if let Err(e) = Command::new(macos_directory.join(binary_name))
            .args(env.args_os.iter().skip(1))
            .spawn()
          {
            log::error!("failed to restart app: {e}");
          }

          exit(0);
        }
      }
    }
  }
}
