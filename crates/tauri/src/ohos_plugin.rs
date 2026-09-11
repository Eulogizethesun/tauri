use crate::ohos::{PLUGINS_TO_REGISTER, PLUGIN_MANAGER, RUN_COMMAND_QUEUE, RUN_COMMAND_TSFN};
use crate::plugin::mobile::{CHANNELS, PENDING_PLUGIN_CALLS};
use napi_derive_ohos::napi;
use napi_ohos::bindgen_prelude::{FnArgs, Function, JsObjectValue, ObjectRef};
use napi_ohos::Env;

fn create_run_command_tsfn(env: &Env) -> napi_ohos::Result<()> {
  let callback: Function<'_, (), ()> =
    env.create_function_from_closure("run_command_callback", move |_ctx| {
      let env_rc = crate::ohos::openharmony_ability::get_main_thread_env();
      if let Some(env_ref) = env_rc.borrow().as_ref() {
        let manager_guard = PLUGIN_MANAGER
          .lock()
          .map_err(|e| napi_ohos::Error::from_reason(format!("PLUGIN_MANAGER lock poisoned: {e}")))?;
        if let Some(manager_ref) = manager_guard.as_ref() {
          let manager_obj = manager_ref.get_value(env_ref)?;
          let run_command_fn = manager_obj.get_named_property::<Function<
            '_,
            FnArgs<(i32, String, String, String)>,
            (),
          >>("runCommand")?;

          let mut queue = RUN_COMMAND_QUEUE
            .lock()
            .map_err(|e| napi_ohos::Error::from_reason(format!("RUN_COMMAND_QUEUE lock poisoned: {e}")))?;
          while let Some(args) = queue.pop_front() {
            run_command_fn.call((args.id, args.plugin_name, args.command, args.payload).into())?;
          }
        }
      }
      Ok(())
    })?;

  let tsfn = callback
    .build_threadsafe_function()
    .callee_handled::<false>()
    .build()?;

  RUN_COMMAND_TSFN.set(tsfn).ok();

  log::debug!("[Tauri] run_command TSFN created");
  Ok(())
}

#[napi]
pub fn tauri_init_plugins(env: &Env, manager: ObjectRef) -> napi_ohos::Result<String> {
  let plugins = PLUGINS_TO_REGISTER
    .lock()
    .unwrap_or_else(|e| e.into_inner());
  let count = plugins.len();

  log::debug!(
    "[Tauri] tauri_init_plugins called, {} plugins to register",
    count
  );

  PLUGIN_MANAGER
    .lock()
    .unwrap_or_else(|e| e.into_inner())
    .replace(manager);

  create_run_command_tsfn(env)?;

  let plugins_json = serde_json::to_string(
    &plugins
      .iter()
      .map(|p| {
        serde_json::json!({
          "name": p.name,
          "identifier": p.identifier,
          "className": p.class_name,
          "config": p.config
        })
      })
      .collect::<Vec<_>>(),
  )
  .unwrap_or_else(|e| {
    log::error!("[Tauri] Failed to serialize plugins: {e}");
    "[]".to_string()
  });

  // The full config JSON is returned to ArkTS (and serialized below) — never
  // log it; plugin configs may embed secrets. Log the plugin names only.
  log::debug!(
    "[Tauri] plugins to register: {:?}",
    plugins.iter().map(|p| p.name.as_str()).collect::<Vec<_>>()
  );

  Ok(plugins_json)
}

#[napi]
pub fn tauri_handle_plugin_response(id: i32, success: bool, payload: String) {
  let handler = PENDING_PLUGIN_CALLS
    .get_or_init(Default::default)
    .lock()
    .unwrap_or_else(|e| e.into_inner())
    .remove(&id);

  if let Some(handler) = handler {
    let json: serde_json::Value = serde_json::from_str(&payload).unwrap_or(serde_json::Value::Null);
    handler(if success { Ok(json) } else { Err(json) });
  }
}

/// NAPI bridge for ArkTS Plugin.emit(channelId, payload) → Rust CHANNELS → Channel.send → webview.
/// Mirrors Android `send_channel_data` and iOS `send_channel_data_handler`.
#[napi]
pub fn tauri_send_channel_data(channel_id: u32, data: String) {
  if let Some(channels) = CHANNELS.get() {
    let channel = {
      let guard = channels
        .lock()
        .unwrap_or_else(|e| e.into_inner());
      guard.get(&channel_id).cloned()
    };
    if let Some(channel) = channel {
      let json: serde_json::Value =
        serde_json::from_str(&data).unwrap_or(serde_json::Value::Null);
      let _ = channel.send(json);
    } else {
      log::warn!(
        "[Tauri] tauri_send_channel_data: channel {} not found in CHANNELS registry",
        channel_id
      );
    }
  } else {
    log::warn!(
      "[Tauri] tauri_send_channel_data: CHANNELS registry not yet initialized (channel {})",
      channel_id
    );
  }
}
