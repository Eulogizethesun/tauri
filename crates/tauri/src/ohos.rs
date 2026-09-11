use std::collections::VecDeque;
use std::sync::{Mutex, OnceLock};

pub use openharmony_ability_derive;
pub use tauri_runtime::OHOSWindowKind;

/// Explicit re-export of the `openharmony-ability` types used by tauri and its macros.
///
/// Converged from a blanket `pub use openharmony_ability;` to an explicit list
/// so the coupling surface is visible and auditable.
pub mod openharmony_ability {
  pub use ::openharmony_ability::OpenHarmonyApp;
  pub use ::openharmony_ability::get_main_thread_env;
  pub use ::openharmony_ability::version;
}

pub static APP: Mutex<Option<openharmony_ability::OpenHarmonyApp>> = Mutex::new(None);

pub static BASE_PATH: OnceLock<Option<String>> = OnceLock::new();

pub static MODULE_NAME: OnceLock<Option<String>> = OnceLock::new();

pub static PLUGIN_MANAGER: Mutex<Option<napi_ohos::bindgen_prelude::ObjectRef>> = Mutex::new(None);

pub struct PluginRegistration {
  pub name: String,
  pub identifier: String,
  pub class_name: String,
  pub config: serde_json::Value,
}

pub static PLUGINS_TO_REGISTER: Mutex<Vec<PluginRegistration>> = Mutex::new(Vec::new());

#[derive(Debug, Clone)]
pub struct RunCommandArgs {
  pub id: i32,
  pub plugin_name: String,
  pub command: String,
  pub payload: String,
}

pub type RunCommandTsfn =
  napi_ohos::threadsafe_function::ThreadsafeFunction<(), (), (), napi_ohos::Status, false>;

pub static RUN_COMMAND_TSFN: OnceLock<RunCommandTsfn> = OnceLock::new();

pub static RUN_COMMAND_QUEUE: Mutex<VecDeque<RunCommandArgs>> = Mutex::new(VecDeque::new());

/// Initializes the OHOS runtime singletons from the global [`APP`] instance
/// and returns the app handle.
///
/// Called once by `Builder::build` before the runtime is created. Panics when
/// the app instance is missing — `mobile_entry_point!` must run first to
/// install it.
pub fn init() -> openharmony_ability::OpenHarmonyApp {
  let ohos_app = APP
    .lock()
    .unwrap()
    .clone()
    .expect("OpenHarmony app instance not initialized — mobile_entry_point! must run before Builder::build");
  BASE_PATH.set(ohos_app.base_path()).ok();
  MODULE_NAME.set(ohos_app.module_name()).ok();
  #[cfg(feature = "tray-icon")]
  {
    tray_icon::set_ohos_app(ohos_app.clone());
  }
  // Initialize vibrancy WindowClient (no feature gate — window-vibrancy is always a dep).
  window_vibrancy::set_ohos_app(&ohos_app);
  // Initialize runtime-wry's OHOS bridge plugins for window/webview/url
  // operations (gated like tray-icon above: tauri-runtime-wry is an optional
  // dep behind the `wry` feature; consumers building tauri with
  // default-features=false and no `wry` feature must still compile on OHOS).
  #[cfg(feature = "wry")]
  tauri_runtime_wry::set_ohos_app(&ohos_app);
  ohos_app
}

pub fn dispatch_run_command(args: RunCommandArgs) {
  RUN_COMMAND_QUEUE
    .lock()
    .unwrap_or_else(|e| e.into_inner())
    .push_back(args);

  if let Some(tsfn) = RUN_COMMAND_TSFN.get() {
    tsfn.call(
      (),
      napi_ohos::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking,
    );
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn base_path_and_module_name_accessors() {
    let _ = BASE_PATH.get();
    let _ = MODULE_NAME.get();
  }
}
