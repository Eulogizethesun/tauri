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
        "probe_app_monitors",
        // cfg-gated to ohos in probe_apis.rs; registered unconditionally here —
        // the permission list is host-compiled so cfg attrs can't gate entries
        // (same as fault_injection_* above; inert on other targets).
        "probe_display_refresh_rate",
        "probe_app_menu_set_remove",
        "probe_window_menu_set_remove",
        "probe_webview_reparent",
        "echo",
        "spam",
        "console_log",
        "flush_console_log",
        "clear_console_log",
        "test_eval",
        "test_local_storage",
        "test_eval_with_callback",
        "test_navigate",
        "test_reload",
        "cookie_test",
        "cookie_manual_test",
        "devtools_test",
        "devtools_open_only",
        "devtools_close_only",
        "set_bounds_test",
        "set_ime_position_test",
        "get_ime_position_result",
        "test_persisted_scope",
        "clear_persisted_scope",
        "clear_window_state",
        "create_isolated_window",
        "create_window_with_custom_ua",
        "create_window_no_throttle",
        "create_transparent_window",
        "create_borderless_window",
        "create_decorated_window",
        "create_transparent_borderless_window",
        "create_ui_ability_window",
        "create_ui_ability_windows_x3",
        "create_transparent_ui_ability_window",
        "transparent_test_start",
        "create_ohos_test_webview",
        "dummy_command",
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
        "set_create_new_window",
        "desktop_features_test",
        "get_last_new_window_url",
        "test_web_page_snapshot",
        "test_create_pdf",
        "set_download_test_mode",
        "create_ui_ability_window",
        "create_transparent_ui_ability_window",
        "transparent_test_start",
        "create_ui_ability_windows_x3",
        "count_webview_windows",
        "close_all_test_windows",
        // sentry_test_panic is cfg-gated to debug_assertions in cmd.rs, but
        // run-app.json references allow-sentry-test-panic unconditionally, so
        // the permission must be registered in release builds too (the entry
        // is inert when the command doesn't exist).
        "sentry_test_panic",
        "sentry_test_breadcrumb",
        // Fault-injection commands are cfg-gated to ohos+fault-injection in
        // cmd.rs, but the permission list is host-compiled so cfg attrs can't
        // gate entries (build script builds for the host target). Registering
        // them unconditionally is harmless: on other builds the commands
        // simply don't exist and the capability entries are inert.
        "fault_injection_set_rule",
        "fault_injection_clear",
      ])),
  )
  .expect("failed to run tauri-build");

  // Link LLVM profile runtime (libclang_rt.profile.a) for OHOS coverage builds.
  // ohrs generates CARGO_ENCODED_RUSTFLAGS that overrides .cargo/config.toml
  // target rustflags, so -Clink-arg=-lclang_rt.profile can't be injected via
  // config. build.rs `cargo:rustc-link-lib` is processed independently and
  // reaches the linker regardless of CARGO_ENCODED_RUSTFLAGS.
  link_llvm_profile_runtime();

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

/// Emit `cargo:rustc-link-lib` for the LLVM profile runtime when building
/// for OHOS with the `cov-dump` feature. This resolves
/// `__llvm_profile_set_filename` / `__llvm_profile_write_file` symbols
/// referenced by the coverage dump code in `lib.rs` / `cmd.rs`.
///
/// **Critical:** Must use Rust's own `libprofiler_builtins` (LLVM 22) rather
/// than the OHOS NDK's `libclang_rt.profile.a` (LLVM 15). Rust's LLVM 22
/// writes profraw version 10; the OHOS NDK's LLVM 15 writes version 8.
/// If the runtime version doesn't match the instrumentation version,
/// llvm-profdata rejects the profraw with "raw profile version mismatch".
///
/// The .rlib is extracted to a .a in the workspace's `profiler-rt/` dir
/// (see cov-build.sh step 0a) so it can be linked as a native static library.
fn link_llvm_profile_runtime() {
  let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
  let has_cov_dump = std::env::var("CARGO_FEATURE_COV_DUMP").is_ok();
  if target_env != "ohos" || !has_cov_dump {
    return;
  }
  // The profiler-rt directory is at the workspace root, two levels up from
  // src-tauri (examples/api/src-tauri → examples/api → tauri).
  // It contains libprofiler_builtins.a extracted from Rust's .rlib.
  let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
  let profiler_rt_dir = std::path::Path::new(&manifest_dir)
    .join("../../../profiler-rt");
  if !profiler_rt_dir.join("libprofiler_builtins.a").exists() {
    println!(
      "cargo:warning=[cov-dump] libprofiler_builtins.a not found in {}",
      profiler_rt_dir.display()
    );
    return;
  }
  println!(
    "cargo:rustc-link-search=native={}",
    profiler_rt_dir.display()
  );
  println!("cargo:rustc-link-lib=static=profiler_builtins");
}
