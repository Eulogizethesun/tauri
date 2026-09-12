// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use serde::Deserialize;

use cargo_mobile2::{
  config::app::App,
  open_harmony::{
    config::{
      Config as OpenHarmonyConfig, Metadata as OpenHarmonyMetadata, Raw as RawOpenHarmonyConfig,
    },
    device::Device,
    emulator,
    env::Env,
    hdc,
    target::Target,
  },
  opts::{FilterLevel, NoiseLevel},
  os,
  util::prompt,
};
use clap::{Parser, Subcommand};
use std::{
  env::{set_var, var},
  fs::{create_dir_all, write},
  path::PathBuf,
  thread::sleep,
  time::Duration,
};
use sublime_fuzzy::best_match;
use tauri_utils::config::OpenHarmonyDeviceTypes;
use tauri_utils::resources::ResourcePaths;

use super::{
  ensure_init, get_app, init, log_finished, read_options, CliOptions, OptionsHandle,
  Target as MobileTarget, MIN_DEVICE_MATCH_SCORE,
};
use crate::error::Context;
use crate::{
  helpers::config::{BundleResources, Config as TauriConfig},
  ConfigValue, ErrorExt, Result,
};

mod build;
mod dev;
mod dev_eco_studio_script;
pub(crate) mod plugins;
pub(crate) mod project;
mod run;
pub(crate) mod signing;

#[derive(Deserialize)]
pub struct AppConfig {
  pub app: AppConfigObject,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfigObject {
  pub bundle_name: String,
  // TODO: impl versioning
  //pub version_code: u32,
  //pub version_name: String,
}

#[derive(Parser)]
#[clap(
  author,
  version,
  about = "OpenHarmony commands",
  subcommand_required(true),
  arg_required_else_help(true)
)]
pub struct Cli {
  #[clap(subcommand)]
  command: Commands,
}

#[derive(Debug, Parser)]
#[clap(about = "Initialize OpenHarmony target in the project")]
pub struct InitOptions {
  /// Skip prompting for values
  #[clap(long, env = "CI")]
  ci: bool,
  /// Skips installing rust toolchains via rustup
  #[clap(long)]
  skip_targets_install: bool,
  /// JSON strings or paths to JSON, JSON5 or TOML files to merge with the default configuration file
  ///
  /// Configurations are merged in the order they are provided, which means a particular value overwrites previous values when a config key-value pair conflicts.
  ///
  /// Note that a platform-specific file is looked up and merged with the default file by default
  /// (tauri.macos.conf.json, tauri.linux.conf.json, tauri.windows.conf.json, tauri.android.conf.json, tauri.ios.conf.json and tauri.ohos.conf.json)
  /// but you can use this for more specific use cases such as different build flavors.
  #[clap(short, long)]
  pub config: Vec<ConfigValue>,
}

#[derive(Subcommand)]
enum Commands {
  Init(InitOptions),
  Dev(dev::Options),
  Build(build::Options),
  Run(run::Options),
  #[clap(hide(true))]
  DevEcoStudioScript(dev_eco_studio_script::Options),
}

pub fn command(cli: Cli, verbosity: u8) -> Result<()> {
  let noise_level = NoiseLevel::from_occurrences(verbosity as u64);
  match cli.command {
    Commands::Init(options) => {
      crate::helpers::app_paths::resolve_dirs();
      init::command(
        MobileTarget::OpenHarmony,
        options.ci,
        false,
        options.skip_targets_install,
        options.config,
      )?
    }
    Commands::Dev(options) => dev::command(options, noise_level)?,
    Commands::Build(options) => build::command(options, noise_level)?,
    Commands::Run(options) => run::command(options, noise_level)?,
    Commands::DevEcoStudioScript(options) => dev_eco_studio_script::command(options)?,
  }

  Ok(())
}

pub fn get_config(
  app: &App,
  _config: &TauriConfig,
  features: Option<&Vec<String>>,
  cli_options: &CliOptions,
) -> (OpenHarmonyConfig, OpenHarmonyMetadata) {
  let mut open_harmony_options = cli_options.clone();
  if let Some(features) = features {
    open_harmony_options.features.extend_from_slice(features);
  }

  let raw = RawOpenHarmonyConfig {
    features: Some(open_harmony_options.features.clone()),
    logcat_filter_specs: vec![
      "RustStdoutStderr".into(),
      format!(
        "*:{}",
        match cli_options.noise_level {
          NoiseLevel::Polite => FilterLevel::Info,
          NoiseLevel::LoudAndProud => FilterLevel::Debug,
          NoiseLevel::FranklyQuitePedantic => FilterLevel::Verbose,
        }
        .logcat()
      ),
    ],
    ..Default::default()
  };
  let config = OpenHarmonyConfig::from_raw(app.clone(), Some(raw)).unwrap();

  let metadata = OpenHarmonyMetadata {
    supported: true,
    cargo_args: Some(open_harmony_options.args),
    features: Some(open_harmony_options.features),
    ..Default::default()
  };

  set_var(
    "WRY_OHOS_PACKAGE",
    app.android_identifier_escape_kotlin_keyword(),
  );
  set_var("TAURI_OHOS_PACKAGE_UNESCAPED", app.identifier());
  set_var("WRY_OHOS_LIBRARY", app.lib_name());
  set_var("TAURI_OHOS_PROJECT_PATH", config.project_dir());

  // Also set device type from cli_options.vars if present
  if let Some(device_type) = cli_options.vars.get("OHOS_DEVICE_TYPE") {
    set_var("OHOS_DEVICE_TYPE", device_type);
  }

  (config, metadata)
}

fn env() -> Result<Env> {
  let env = super::env().context("failed to setup OpenHarmony environment")?;
  cargo_mobile2::open_harmony::env::Env::from_env(env).context("failed to OpenHarmony load env")
}

fn delete_codegen_vars() {
  for (k, _) in std::env::vars() {
    if k.starts_with("WRY_") && (k.ends_with("CLASS_EXTENSION") || k.ends_with("CLASS_INIT")) {
      std::env::remove_var(k);
    }
  }
}

fn hdc_device_prompt<'a>(env: &'_ Env, target: Option<&str>) -> Result<Device<'a>> {
  let device_list =
    hdc::device_list(env).context("failed to detect connected OpenHarmony devices")?;
  if !device_list.is_empty() {
    let device = if let Some(t) = target {
      let (device, score) = device_list
        .into_iter()
        .rev()
        .map(|d| {
          let score = best_match(t, d.name()).map_or(0, |m| m.score());
          (d, score)
        })
        .max_by_key(|(_, score)| *score)
        // we already checked the list is not empty
        .unwrap();
      if score > MIN_DEVICE_MATCH_SCORE {
        device
      } else {
        crate::error::bail!("Could not find an OpenHarmony device matching {t}")
      }
    } else if device_list.len() > 1 {
      let index = prompt::list(
        concat!("Detected ", "OpenHarmony", " devices"),
        device_list.iter(),
        "device",
        None,
        "Device",
      )
      .context("Failed to prompt for OpenHarmony devices")?;
      device_list.into_iter().nth(index).unwrap()
    } else {
      device_list.into_iter().next().unwrap()
    };

    log::info!(
      "Detected connected device: {} with target {:?}",
      device,
      device.target().triple,
    );
    Ok(device)
  } else {
    Err(crate::Error::GenericError(
      "No connected OpenHarmony devices detected".to_string(),
    ))
  }
}

fn emulator_prompt(_env: &'_ Env, target: Option<&str>) -> Result<emulator::Emulator> {
  let emulator_list = emulator::hvd_list().unwrap_or_default();
  if !emulator_list.is_empty() {
    let emulator = if let Some(t) = target {
      let (device, score) = emulator_list
        .into_iter()
        .rev()
        .map(|d| {
          let score = best_match(t, d.name()).map_or(0, |m| m.score());
          (d, score)
        })
        .max_by_key(|(_, score)| *score)
        // we already checked the list is not empty
        .unwrap();
      if score > MIN_DEVICE_MATCH_SCORE {
        device
      } else {
        crate::error::bail!("Could not find an OpenHarmony Emulator matching {t}")
      }
    } else if emulator_list.len() > 1 {
      let index = prompt::list(
        concat!("Detected ", "OpenHarmony", " emulators"),
        emulator_list.iter(),
        "emulator",
        None,
        "Emulator",
      )
      .context("Failed to prompt for OpenHarmony Emulator device")?;
      emulator_list.into_iter().nth(index).unwrap()
    } else {
      emulator_list.into_iter().next().unwrap()
    };

    Ok(emulator)
  } else {
    Err(crate::Error::GenericError(
      "No available OpenHarmony Emulator detected".to_string(),
    ))
  }
}

fn device_prompt<'a>(env: &'_ Env, target: Option<&str>) -> Result<Device<'a>> {
  if let Ok(device) = hdc_device_prompt(env, target) {
    Ok(device)
  } else {
    let emulator = emulator_prompt(env, target)?;
    log::info!("Starting emulator {}", emulator.name());
    emulator
      .start_detached(env)
      .context("failed to start emulator")?;
    let mut tries = 0;
    loop {
      sleep(Duration::from_secs(2));
      if let Ok(device) = hdc_device_prompt(env, Some(emulator.name())) {
        return Ok(device);
      }
      if tries >= 3 {
        log::info!("Waiting for emulator to start... (maybe the emulator is unauthorized or offline, run `hdc list targets` to check)");
      } else {
        log::info!("Waiting for emulator to start...");
      }
      tries += 1;
    }
  }
}

fn detect_target_ok<'a>(env: &Env) -> Option<&'a Target<'a>> {
  device_prompt(env, None).map(|device| device.target()).ok()
}

fn open_and_wait(config: &OpenHarmonyConfig, env: &Env) -> ! {
  log::info!("Opening DevEco Studio");
  // "DevEco Studio" (with a space) is the actual application name — on macOS
  // `open -a` only accepts the real app name.
  if let Err(e) = os::open_file_with("DevEco Studio", config.project_dir(), &env.base) {
    log::error!("{e}");
  }
  loop {
    sleep(Duration::from_secs(24 * 60 * 60));
  }
}

/// The active entry module name (`entry_mobile` / `entry_desktop`), driven by
/// `OHOS_DEVICE_TYPE` (set by the CLI build/dev commands). Falls back to
/// `entry_mobile` when unset. Used by the build-time injectors (icons, plugin
/// oh-package deps) and build-profile module selection to target the entry
/// being built.
pub fn active_entry_module() -> String {
  let form = var("OHOS_DEVICE_TYPE").unwrap_or_else(|_| "mobile".to_string());
  format!("entry_{form}")
}

/// The conf `deviceTypes` list for the given form. With the per-form config
/// schema (`{ mobile: [...], desktop: [...]] }`), this is a direct lookup — no
/// intersection with a hardcoded device-class set.
pub fn device_types_for_form(device_types: &OpenHarmonyDeviceTypes, form: &str) -> Vec<String> {
  match form {
    "mobile" => device_types.mobile.clone(),
    "desktop" => device_types.desktop.clone(),
    _ => Vec::new(),
  }
}

/// Active device forms: `mobile` if its list is non-empty, `desktop` if its
/// list is non-empty. Used by `build --app` to decide which entry modules to
/// compile and package.
pub fn forms_for_device_types(device_types: &OpenHarmonyDeviceTypes) -> Vec<&'static str> {
  let mut forms = Vec::new();
  if !device_types.mobile.is_empty() {
    forms.push("mobile");
  }
  if !device_types.desktop.is_empty() {
    forms.push("desktop");
  }
  forms
}

/// Copy `tauri.conf.json` and the configured `bundle.resources` into the
/// `entry_{form}` module's `src/main/resources/rawfile/` directory — the only
/// app-writable location besides `AppScope/resources` that the HAP actually
/// packages (a top-level `assets/` dir would be silently dropped). At runtime
/// the files are reachable through the resource manager's rawfile APIs.
fn inject_resources(
  config: &OpenHarmonyConfig,
  tauri_config: &TauriConfig,
  form: &str,
) -> Result<()> {
  let rawfile_dir = config
    .project_dir()
    .join(format!("entry_{form}/src/main/resources/rawfile"));

  create_dir_all(&rawfile_dir)
    .fs_context("failed to create rawfile directory", rawfile_dir.clone())?;

  write(
    rawfile_dir.join("tauri.conf.json"),
    serde_json::to_string(&tauri_config).with_context(|| "failed to serialize tauri config")?,
  )
  .fs_context(
    "failed to write tauri config",
    rawfile_dir.join("tauri.conf.json"),
  )?;

  let resources = match &tauri_config.bundle.resources {
    Some(BundleResources::List(paths)) => Some(ResourcePaths::new(paths.as_slice(), true)),
    Some(BundleResources::Map(map)) => Some(ResourcePaths::from_map(map, true)),
    None => None,
  };
  if let Some(resources) = resources {
    for resource in resources.iter() {
      let resource = resource.context("failed to get resource")?;
      let dest = rawfile_dir.join(resource.target());
      crate::helpers::fs::copy_file(resource.path(), dest)?;
    }
  }

  Ok(())
}

fn inject_icons(
  config: &OpenHarmonyConfig,
  tauri_config: &TauriConfig,
  tauri_dir: &std::path::Path,
) -> Result<()> {
  let icons = &tauri_config.bundle.icon;
  if icons.is_empty() {
    return Ok(());
  }

  let project_dir = config.project_dir();
  let app_media_dir = project_dir.join("AppScope/resources/base/media");
  // `entry_media_dir` targets the *active* entry module (entry_{OHOS_DEVICE_TYPE})
  // via `active_entry_module()`, which reads the env var the CLI set for the
  // requested form. For `--app`, the per-form loop in `command` re-sets the env
  // and calls this once per form so both entries get icons.
  let entry_media_dir = project_dir.join(format!(
    "{}/src/main/resources/base/media",
    active_entry_module()
  ));

  let mut foreground_path: Option<PathBuf> = None;
  let mut background_path: Option<PathBuf> = None;
  let mut starticon_path: Option<PathBuf> = None;

  for icon in icons {
    let path = PathBuf::from(icon);
    let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
      continue;
    };
    let stem_lower = stem.to_lowercase();
    let is_ohos_icon = stem_lower.ends_with("-starticon")
      || stem_lower.ends_with("-foreground")
      || stem_lower.ends_with("-background");
    if !is_ohos_icon {
      continue;
    }
    // DevEco's resource compiler expects real PNG data in .png media files.
    // Reject non-PNG sources instead of misnaming them, which would break HAP packaging.
    let is_png = path
      .extension()
      .and_then(|e| e.to_str())
      .map(|e| e.eq_ignore_ascii_case("png"))
      .unwrap_or(false);
    if !is_png {
      log::warn!(
        "OHOS icon '{}' is not a PNG file; skipping (DevEco requires PNG)",
        path.display()
      );
      continue;
    }
    let full_path = tauri_dir.join(&path);
    if stem_lower.ends_with("-starticon") {
      starticon_path = Some(full_path);
    } else if stem_lower.ends_with("-foreground") {
      foreground_path = Some(full_path);
    } else if stem_lower.ends_with("-background") {
      background_path = Some(full_path);
    }
  }

  let (Some(fg), Some(bg)) = (&foreground_path, &background_path) else {
    log::warn!(
      "OHOS icon injection skipped: foreground ({}) and background ({}) must both be present in bundle.icon with the -foreground / -background suffix",
      foreground_path.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "missing".into()),
      background_path.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "missing".into()),
    );
    return Ok(());
  };

  // Copy to AppScope media
  create_dir_all(&app_media_dir).fs_context(
    "failed to create AppScope media directory",
    app_media_dir.clone(),
  )?;
  crate::helpers::fs::copy_file(fg, app_media_dir.join("foreground.png"))?;
  crate::helpers::fs::copy_file(bg, app_media_dir.join("background.png"))?;

  // Copy to entry media
  create_dir_all(&entry_media_dir).fs_context(
    "failed to create entry media directory",
    entry_media_dir.clone(),
  )?;
  crate::helpers::fs::copy_file(fg, entry_media_dir.join("foreground.png"))?;
  crate::helpers::fs::copy_file(bg, entry_media_dir.join("background.png"))?;

  // startIcon: use dedicated *-starticon file if present, otherwise fall back to foreground
  let starticon_src = starticon_path.as_ref().unwrap_or(fg);
  crate::helpers::fs::copy_file(starticon_src, entry_media_dir.join("startIcon.png"))?;

  log::info!("OHOS icons injected successfully");
  Ok(())
}
