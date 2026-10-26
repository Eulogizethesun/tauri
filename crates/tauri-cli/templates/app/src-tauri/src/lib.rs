// OHOS builds don't set `cfg(mobile)` for every device form (a 2in1/desktop
// build sets `cfg(desktop)` instead), so the entry point must be gated on the
// target env itself — otherwise `mobile_entry_point` never expands on OHOS
// desktop and the NAPI module registers under the runtime crate's name, which
// leaves the ArkTS dynamic import `lib<app>.so` permanently unsettled (blank
// windows). `tauri ohos init` adds the target deps this expansion needs.
// Two-line entry-point form (issue Eulogizethesun/tauri#242): the OHOS
// Ability/NAPI entry is required on the 2in1 desktop form too, where
// cfg(mobile) is false — a lone cfg_attr(mobile, mobile_entry_point) would
// silently produce no entry there.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg_attr(target_env = "ohos", tauri::ohos::entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
