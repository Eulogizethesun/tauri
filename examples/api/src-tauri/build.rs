// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use tauri_build::WindowsAttributes;

fn main() {
  tauri_build::try_build(
    tauri_build::Attributes::new()
      .codegen(tauri_build::CodegenContext::new())
      .windows_attributes(WindowsAttributes::new_without_app_manifest())
      .plugin(
        "app-menu",
        tauri_build::InlinedPlugin::new().commands(&["toggle", "popup"]),
      )
      .app_manifest(tauri_build::AppManifest::new().commands(&[
        "log_operation",
        "perform_request",
        "echo",
        "spam",
        "write_test_report",
        "console_log",
        "flush_console_log",
        "clear_console_log",
        "test_eval",
        "test_local_storage",
        "test_eval_with_callback",
        "test_navigate",
        "test_reload",
        "create_isolated_window",
        "create_window_with_custom_ua",
        "create_window_no_throttle",
        "create_transparent_window",
        "create_borderless_window",
        "create_transparent_borderless_window",
        "dummy_command", 
        "close_test_window",
        "create_counter",
        "increment_counter",
        "get_counter_value",
        "get_tracked_window_events",
        "get_tracked_menu_events",
        "get_tracked_run_events",
        "clear_tracked_events",
        "emit_test_event",
        "setup_app_listener",
        "test_async_spawn",
        "simulate_tray_click",
        "clear_test_report",
        "append_test_result",
        "get_ohos_version_info",
        "set_deny_new_window",
        "get_last_new_window_url",
        "test_web_page_snapshot",
        "test_create_pdf",
        "set_download_test_mode",
        #[cfg(debug_assertions)]
        "sentry_test_panic",
        "sentry_test_breadcrumb"
      ])),
  )
  .expect("failed to run tauri-build");

  #[cfg(windows)]
  {
    // workaround needed to prevent `STATUS_ENTRYPOINT_NOT_FOUND` error in tests
    // see https://github.com/tauri-apps/tauri/pull/4383#issuecomment-1212221864
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV");
    let is_tauri_workspace = std::env::var("__TAURI_WORKSPACE__").is_ok_and(|v| v == "true");
    if is_tauri_workspace && target_os == "windows" && Ok("msvc") == target_env.as_deref() {
      embed_manifest_for_tests();
    }
  }
}

#[cfg(windows)]
fn embed_manifest_for_tests() {
  static WINDOWS_MANIFEST_FILE: &str = "windows-app-manifest.xml";

  let manifest = std::env::current_dir()
    .unwrap()
    .join("../../../crates/tauri-build/src")
    .join(WINDOWS_MANIFEST_FILE);

  println!("cargo:rerun-if-changed={}", manifest.display());
  // Embed the Windows application manifest file.
  println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
  println!(
    "cargo:rustc-link-arg=/MANIFESTINPUT:{}",
    manifest.to_str().unwrap()
  );
  // Turn linker warnings into errors.
  println!("cargo:rustc-link-arg=/WX");
}
