// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

#[cfg(target_env = "ohos")]
mod ohos_log {
  pub fn init() {
    hilog::Builder::new()
      .set_tag("huawei-account")
      .filter_level(log::LevelFilter::Trace)
      .init();
  }
}

// WebviewUrl/WebviewWindowBuilder not needed: the OHOS EntryAbility template
// creates the `main` window via onWindowStageCreate.

#[cfg_attr(any(mobile, target_env = "ohos"), tauri::mobile_entry_point)]
pub fn run() {
  #[cfg(target_env = "ohos")]
  {
    let prev_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
      let msg = format!("PANIC: {info}\n");
      let _ = std::fs::write("/data/storage/el2/base/cache/panic.log", &msg);
      eprintln!("{msg}");
      prev_hook(info);
    }));
  }

  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_huawei_account::init());

  #[cfg(target_env = "ohos")]
  {
    ohos_log::init();
    log::info!("Huawei Account test app initialized");
  }

  builder
    .setup(|_app| {
      // The OHOS EntryAbility template already creates the `main` window via
      // onWindowStageCreate (super calls loadContentByName); do NOT create it
      // again here or setup will panic with "a webview with label `main` already exists".
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|_app_handle, _event| {});
}
