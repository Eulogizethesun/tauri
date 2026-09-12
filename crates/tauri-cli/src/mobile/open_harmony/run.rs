// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use cargo_mobile2::open_harmony::env::Env;
use clap::{ArgAction, Parser};
use std::path::PathBuf;

use crate::{
  error::Context,
  helpers::config::ConfigMetadata,
  interface::{DevProcess, WatcherOptions},
  mobile::DevChild,
  ConfigValue, Result,
};

#[derive(Debug, Clone, Parser)]
#[clap(
  about = "Run your app in production mode on OpenHarmony",
  long_about = "Build, sign, install and run your app on a connected OpenHarmony device. \
    Signing is controlled via environment variables (OHOS_KEYSTORE_FILE, etc.)."
)]
pub struct Options {
  /// Run the app in release mode
  #[clap(short, long)]
  pub release: bool,
  /// List of cargo features to activate
  #[clap(short, long, action = ArgAction::Append, num_args(0..))]
  pub features: Option<Vec<String>>,
  /// JSON strings or paths to JSON, JSON5 or TOML files to merge with the default configuration file
  ///
  /// Configurations are merged in the order they are provided, which means a particular value overwrites previous values when a config key-value pair conflicts.
  ///
  /// Note that a platform-specific file is looked up and merged with the default file by default
  /// (tauri.macos.conf.json, tauri.linux.conf.json, tauri.windows.conf.json, tauri.android.conf.json, tauri.ios.conf.json and tauri.ohos.conf.json)
  /// but you can use this for more specific use cases such as different build flavors.
  #[clap(short, long)]
  pub config: Vec<ConfigValue>,
  /// Disable the file watcher
  #[clap(long)]
  pub no_watch: bool,
  /// Additional paths to watch for changes.
  #[clap(long)]
  pub additional_watch_folders: Vec<PathBuf>,
  /// Open DevEco Studio instead of running on a connected device
  #[clap(short, long)]
  pub open: bool,
  /// Runs on the given device name
  pub device: Option<String>,
  /// Command line arguments passed to the runner.
  /// Use `--` to explicitly mark the start of the arguments.
  /// e.g. `tauri ohos run -- [runnerArgs]`.
  #[clap(last(true))]
  pub args: Vec<String>,
  /// Do not error out if a version mismatch is detected on a Tauri package.
  #[clap(long)]
  pub ignore_version_mismatches: bool,
  /// Device type to build for (mobile or desktop)
  #[clap(long, env = "OHOS_DEVICE_TYPE", default_value = "mobile", value_parser(["mobile", "desktop"]))]
  pub device_type: String,
}

pub fn command(options: Options, noise_level: cargo_mobile2::opts::NoiseLevel) -> Result<()> {
  // Step 1: Build + sign (delegates to the build command)
  let build_options = super::build::Options {
    debug: !options.release,
    targets: None,
    features: options.features.clone(),
    config: options.config.clone(),
    open: options.open,
    ci: false,
    device_type: options.device_type.clone(),
    app: false,
    args: options.args.clone(),
    ignore_version_mismatches: options.ignore_version_mismatches,
  };

  super::build::command(build_options.clone(), noise_level)?;

  // If --open, build command already opened DevEco Studio
  if options.open {
    return Ok(());
  }

  // Step 2: Install + launch, mirroring the android `run` flow: without
  // --no-watch, keep watching for changes and rebuild + reinstall + relaunch
  // on every change.
  let dirs = crate::helpers::app_paths::resolve_dirs();
  let mut tauri_config = crate::helpers::config::get_config(
    tauri_utils::platform::Target::OpenHarmony,
    &options
      .config
      .iter()
      .map(|conf| &conf.0)
      .collect::<Vec<_>>(),
    dirs.tauri,
  )?;

  // The initial build already ran above; only re-runs triggered by the file
  // watcher need to go through the full build command again.
  let no_watch = options.no_watch;
  let first_run = std::cell::Cell::new(true);
  let watch_options = WatcherOptions {
    config: options.config.clone(),
    additional_watch_folders: options.additional_watch_folders.clone(),
  };
  let runner = move |_tauri_config: &ConfigMetadata| {
    if first_run.get() {
      first_run.set(false);
    } else {
      super::build::command(build_options.clone(), noise_level)?;
    }
    install_launch_and_log(&options)
  };

  if no_watch {
    runner(&tauri_config)?;
  } else {
    let mut interface = crate::interface::AppInterface::new(&tauri_config, None, dirs.tauri)?;
    interface.watch(&mut tauri_config, watch_options, runner, &dirs)?;
  }

  Ok(())
}

/// Detect device, install the signed HAP, launch the app, and start streaming
/// the app's hilog output. The returned process is what the file watcher in
/// `command` kills and replaces between rebuilds (android `run` parity: the
/// runner streams logcat).
fn install_launch_and_log(options: &Options) -> Result<Box<dyn DevProcess + Send>> {
  use super::{device_prompt, env};
  use cargo_mobile2::open_harmony::{hap, hdc};

  let env = env()?;

  // Detect device
  let device = device_prompt(&env, options.device.as_deref())?;
  let device_id = device.id().to_string();

  // Resolve tauri config to get the OpenHarmony project config
  let dirs = crate::helpers::app_paths::resolve_dirs();
  let tauri_config = crate::helpers::config::get_config(
    tauri_utils::platform::Target::OpenHarmony,
    &options
      .config
      .iter()
      .map(|conf| &conf.0)
      .collect::<Vec<_>>(),
    dirs.tauri,
  )?;

  let interface = crate::interface::AppInterface::new(&tauri_config, None, dirs.tauri)?;
  let app = super::get_app(
    super::MobileTarget::OpenHarmony,
    &tauri_config,
    &interface,
    dirs.tauri,
  );
  let (config, _metadata) = super::get_config(
    &app,
    &tauri_config,
    None,
    &crate::mobile::CliOptions::default(),
  );

  let bundle_name = config.app().identifier().to_string();

  // Find a signed HAP that actually exists on disk.
  // `haps_paths` returns *computed* paths (signed + unsigned) — the signed HAP
  // only exists on disk when signing was configured for this build. An unsigned
  // HAP cannot be installed on a device, so we require the signed one AND verify
  // it exists. Without the existence check we would pass a non-existent path to
  // `hdc install`, and hdc returns exit 0 on "file not found" (see
  // `hdc_install_failed`), producing a false "installed successfully".
  let hap_paths = hap::haps_paths(&config);
  let hap_to_install = hap_paths
    .iter()
    .find(|p| {
      p.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .contains("-signed")
    })
    .filter(|p| p.exists())
    .map(|p| p.clone())
    .context(
      "no signed HAP found at the expected output path. Signing is not configured, \
       and an unsigned HAP cannot be installed on a device. Set the OHOS signing \
       environment variables (OHOS_KEYSTORE_FILE, OHOS_KEYSTORE_PASSWORD, \
       OHOS_KEY_ALIAS, OHOS_KEY_PASSWORD, OHOS_APP_CERT_FILE, OHOS_PROFILE_FILE) \
       or configure signingConfigs in build-profile.json5 (DevEco: File → Project \
       Structure → Signing Configs), then rebuild.",
    )?;

  log::info!(
    "Installing {} to device {}",
    hap_to_install.display(),
    device.name()
  );

  // === Install: hdc -t <id> install -r <hap_path> ===
  let hap_str = hap_to_install.to_string_lossy().to_string();
  let install_result = hdc::hdc(
    &env,
    vec![
      "-t".to_string(),
      device_id.clone(),
      "install".to_string(),
      "-r".to_string(),
      hap_str.clone(),
    ],
  )
  .stdout_capture()
  .stderr_capture()
  .run()
  .context("failed to run hdc install")?;

  let install_stdout = String::from_utf8_lossy(&install_result.stdout);
  let install_stderr = String::from_utf8_lossy(&install_result.stderr);
  if !install_result.status.success() || hdc_install_failed(&install_stdout, &install_stderr) {
    // Fallback: uninstall + reinstall
    log::warn!("Install failed, trying uninstall first...");
    if !install_stdout.is_empty() {
      log::warn!("hdc stdout:\n{install_stdout}");
    }
    let _ = hdc::hdc(
      &env,
      [
        "-t",
        &device_id,
        "shell",
        "bm",
        "uninstall",
        "-n",
        &bundle_name,
      ],
    )
    .stdout_capture()
    .stderr_capture()
    .run();

    let retry_result = hdc::hdc(
      &env,
      vec![
        "-t".to_string(),
        device_id.clone(),
        "install".to_string(),
        "-r".to_string(),
        hap_str,
      ],
    )
    .stdout_capture()
    .stderr_capture()
    .run()
    .context("failed to run hdc install (retry)")?;

    let retry_stdout = String::from_utf8_lossy(&retry_result.stdout);
    let retry_stderr = String::from_utf8_lossy(&retry_result.stderr);
    if !retry_result.status.success() || hdc_install_failed(&retry_stdout, &retry_stderr) {
      if !retry_stdout.is_empty() {
        log::error!("hdc stdout:\n{retry_stdout}");
      }
      if !retry_stderr.is_empty() {
        log::error!("hdc stderr:\n{retry_stderr}");
      }
      crate::error::bail!("Failed to install HAP to device");
    }
  }

  log::info!("HAP installed successfully");

  // === Launch: hdc -t <id> shell aa start -b <bundleName> -a EntryAbility ===
  log::info!("Launching app: {bundle_name}");

  let launch_result = hdc::hdc(
    &env,
    [
      "-t",
      &device_id,
      "shell",
      "aa",
      "start",
      "-b",
      &bundle_name,
      "-a",
      "EntryAbility",
    ],
  )
  .stdout_capture()
  .stderr_capture()
  .run()
  .context("failed to run hdc launch")?;

  if !launch_result.status.success() {
    let stdout = String::from_utf8_lossy(&launch_result.stdout);
    let stderr = String::from_utf8_lossy(&launch_result.stderr);
    if !stdout.is_empty() {
      log::error!("hdc stdout:\n{stdout}");
    }
    if !stderr.is_empty() {
      log::error!("hdc stderr:\n{stderr}");
    }
    crate::error::bail!("Failed to launch app on device");
  }

  log::info!("App launched successfully");

  // Stream the app's hilog output so `run` behaves like the dev flow (and the
  // android `run` logcat stream). The watcher kills and restarts this process
  // around each rebuild. A duct expression inherits our stdio by default, so
  // the stream lands on the user's terminal without any capture calls.
  let pid = wait_for_app_pid(&env, &device_id, &bundle_name);
  let mut hilog = hdc::hdc(&env, ["-t", &device_id, "shell", "hilog"]);
  if !pid.is_empty() {
    hilog = hilog.before_spawn(move |cmd| {
      cmd.args(["--pid", &pid]);
      Ok(())
    });
  }
  let hilog = hilog.start().context("failed to start hilog stream")?;
  Ok(Box::new(DevChild::new(hilog)))
}

/// Polls `pidof` for the launched app so the hilog stream can be filtered to
/// this app only. The app may take a moment to register, so retry briefly;
/// returns an empty string (unfiltered stream) if it never shows up.
fn wait_for_app_pid(env: &Env, device_id: &str, bundle_name: &str) -> String {
  use cargo_mobile2::open_harmony::hdc;

  for _ in 0..10 {
    if let Ok(out) = hdc::hdc(env, ["-t", device_id, "shell", "pidof", "-s", bundle_name])
      .stdout_capture()
      .stderr_capture()
      .read()
    {
      let pid = out.trim().to_string();
      if !pid.is_empty() {
        return pid;
      }
    }
    std::thread::sleep(std::time::Duration::from_secs(1));
  }
  String::new()
}

/// Detects whether an `hdc install` actually failed.
///
/// `hdc` returns exit code 0 even on failure (e.g. `[Fail]Error opening file:
/// no such file or directory`, `signature verification failed`), placing the
/// error text in stdout/stderr. Relying on `status.success()` alone therefore
/// produces false "installed successfully" reports. This parses the output for
/// markers that only appear on failure — note `signature verification` is
/// intentionally NOT a marker because success output contains
/// `signature verification succeed`.
fn hdc_install_failed(stdout: &str, stderr: &str) -> bool {
  let out = stdout.to_lowercase();
  let err = stderr.to_lowercase();
  const MARKERS: &[&str] = &["[fail]", "failure", "failed", "error opening file"];
  MARKERS.iter().any(|m| out.contains(m) || err.contains(m))
}
