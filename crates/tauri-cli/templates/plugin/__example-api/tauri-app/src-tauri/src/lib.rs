// Learn more about Tauri commands at https://v2.tauri.app/develop/calling-rust/#commands
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Two-line entry-point form (issue Eulogizethesun/tauri#242): the OHOS
// Ability/NAPI entry is required on the 2in1 desktop form too, where
// cfg(mobile) is false — a lone cfg_attr(mobile, mobile_entry_point) would
// silently produce no entry there.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg_attr(target_env = "ohos", tauri::ohos::entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .plugin(tauri_plugin_{{ plugin_name_snake_case }}::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
