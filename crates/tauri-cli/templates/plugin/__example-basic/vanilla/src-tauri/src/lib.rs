// Two-line entry-point form (issue Eulogizethesun/tauri#242): the OHOS
// Ability/NAPI entry is required on the 2in1 desktop form too, where
// cfg(mobile) is false -- a lone cfg_attr(mobile, mobile_entry_point) would
// silently produce no entry there.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg_attr(target_env = "ohos", tauri::ohos::entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_{{ plugin_name_snake_case }}::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
