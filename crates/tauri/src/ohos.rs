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
  pub use ::openharmony_ability::menu;
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
