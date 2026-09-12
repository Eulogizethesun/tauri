// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use super::{
  active_entry_module, delete_codegen_vars, ensure_init, env, get_app, get_config,
  inject_resources, log_finished, open_and_wait, plugins, signing::OhosSigningConfig, MobileTarget,
  OptionsHandle,
};
use crate::{
  build::Options as BuildOptions,
  helpers::{
    app_paths::Dirs,
    config::{get_config as get_tauri_config, ConfigMetadata},
    flock,
  },
  interface::{AppInterface, Options as InterfaceOptions},
  mobile::{write_options, CliOptions},
  ConfigValue, Result,
};
use clap::{ArgAction, Parser};

use crate::error::Context;
use cargo_mobile2::{
  open_harmony::{app, config::Config as OpenHarmonyConfig, env::Env, hap, target::Target},
  opts::{NoiseLevel, Profile},
  target::TargetTrait,
};

use std::collections::HashMap;
use std::env::{set_current_dir, set_var};
use std::ffi::OsString;

#[derive(Debug, Clone, Parser)]
#[clap(
  about = "Build your app in release mode for OpenHarmony and generate HAPs",
  long_about = "Build your app in release mode for OpenHarmony and generate HAPs. It makes use of the `build.frontendDist` property from your `tauri.conf.json` file. It also runs your `build.beforeBuildCommand` which usually builds your frontend into `build.frontendDist`."
)]
pub struct Options {
  /// Builds with the debug flag
  #[clap(short, long)]
  pub debug: bool,
  /// Which targets to build (all by default).
  #[clap(
    short,
    long = "target",
    action = ArgAction::Append,
    num_args(0..),
    value_parser(clap::builder::PossibleValuesParser::new(Target::name_list()))
  )]
  pub targets: Option<Vec<String>>,
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
  /// Open DevEco Studio
  #[clap(short, long)]
  pub open: bool,
  /// Skip prompting for values
  #[clap(long, env = "CI")]
  pub ci: bool,
  /// Device type to build for (mobile or desktop)
  #[clap(long, env = "OHOS_DEVICE_TYPE", default_value = "mobile", value_parser(["mobile", "desktop"]))]
  pub device_type: String,
  /// Build the multi-entry `.app` (AppGallery unified package) for every device
  /// form in `bundle.openHarmony.deviceTypes`, instead of a single-form HAP.
  /// Device forms are derived from config; conflicts with `--device-type` and
  /// `--open` (packaging vs. opening DevEco are mutually exclusive).
  #[clap(long, conflicts_with_all = ["device_type", "open"])]
  pub app: bool,
  /// Command line arguments passed to the runner.
  /// Use `--` to explicitly mark the start of the arguments.
  /// e.g. `tauri ohos build -- [runnerArgs]`.
  #[clap(last(true))]
  pub args: Vec<String>,
  /// Do not error out if a version mismatch is detected on a Tauri package.
  ///
  /// Only use this when you are sure the mismatch is incorrectly detected as version mismatched Tauri packages can lead to unknown behavior.
  #[clap(long)]
  pub ignore_version_mismatches: bool,
}

impl From<Options> for BuildOptions {
  fn from(options: Options) -> Self {
    Self {
      runner: None,
      debug: options.debug,
      target: None,
      features: options.features.unwrap_or_default(),
      bundles: None,
      no_bundle: false,
      config: options.config,
      args: options.args,
      ci: options.ci,
      skip_stapling: false,
      ignore_version_mismatches: options.ignore_version_mismatches,
      no_sign: false,
    }
  }
}

pub fn command(options: Options, noise_level: NoiseLevel) -> Result<()> {
  let dirs = crate::helpers::app_paths::resolve_dirs();

  // Set device type environment variable
  set_var("OHOS_DEVICE_TYPE", &options.device_type);

  delete_codegen_vars();

  let mut build_options: BuildOptions = options.clone().into();

  let first_target = Target::all()
    .get(
      options
        .targets
        .as_ref()
        .and_then(|l| l.first().map(|t| t.as_str()))
        .unwrap_or(Target::DEFAULT_KEY),
    )
    .unwrap();
  build_options.target = Some(first_target.triple.into());

  let tauri_config = get_tauri_config(
    tauri_utils::platform::Target::OpenHarmony,
    &options
      .config
      .iter()
      .map(|conf| &conf.0)
      .collect::<Vec<_>>(),
    dirs.tauri,
  )?;
  let (interface, config, metadata) = {
    let interface = AppInterface::new(&tauri_config, build_options.target.clone(), dirs.tauri)?;
    // Explicit form of the android flow's
    // `interface.build_options(&mut args, &mut features, true)`: only the
    // `tauri/custom-protocol` feature applies here — the `--lib` cargo arg is
    // not used because `Target::compile_lib` builds through `ohrs`, not a raw
    // cargo invocation.
    build_options.features.push("tauri/custom-protocol".into());

    let app = get_app(
      MobileTarget::OpenHarmony,
      &tauri_config,
      &interface,
      dirs.tauri,
    );

    let mut vars = HashMap::new();
    vars.insert(
      "OHOS_DEVICE_TYPE".into(),
      OsString::from(&options.device_type),
    );
    let cli_options = CliOptions {
      vars,
      ..Default::default()
    };

    let (config, metadata) = get_config(
      &app,
      &tauri_config,
      Some(&build_options.features),
      &cli_options,
    );
    (interface, config, metadata)
  };

  let profile = if options.debug {
    Profile::Debug
  } else {
    Profile::Release
  };

  set_current_dir(dirs.tauri).with_context(|| "failed to change current working directory")?;

  ensure_init(
    &tauri_config,
    config.app(),
    config.project_dir(),
    MobileTarget::OpenHarmony,
    options.ci,
  )?;

  let plugin_metadata = plugins::inject_plugins(&dirs.tauri, &config.project_dir())?;

  let mut env = env()?;

  crate::build::setup(&interface, &mut build_options, &tauri_config, &dirs, true)?;

  if options.app {
    let active_forms =
      super::forms_for_device_types(&tauri_config.bundle.open_harmony.device_types);
    if active_forms.is_empty() {
      crate::error::bail!(
        "build --app: no device forms derived from bundle.openHarmony.deviceTypes (got {:?}); \
         expected at least one of phone/tablet/car/wearable/tv/2in1",
        tauri_config.bundle.open_harmony.device_types
      );
    }
    // Compile the `.so` for each active form (sets cfg(mobile)/cfg(desktop)),
    // inject icons + resources + plugin deps into each entry module.
    // OHOS_DEVICE_TYPE drives compile_lib's `--dist` (entry_{form}/libs) and
    // the injectors' target entry.
    for form in &active_forms {
      set_var("OHOS_DEVICE_TYPE", form);
      first_target
        .build(&config, &metadata, &env, noise_level, true, profile)
        .context("failed to build OpenHarmony app")?;
      super::inject_icons(&config, &tauri_config, dirs.tauri)?;
      inject_resources(&config, &tauri_config, form)?;
      if !plugin_metadata.is_empty() {
        plugins::update_entry_package(&config.project_dir(), &plugin_metadata)?;
      }
      // Align this entry's module.json5 deviceTypes to the current conf subset
      // so conf `deviceTypes` changes apply on rebuild without re-init.
      plugins::write_entry_device_types(
        &config.project_dir(),
        form,
        &super::device_types_for_form(&tauri_config.bundle.open_harmony.device_types, form),
      )
      .context("failed to align entry deviceTypes")?;
      // Same injection point: gate app continuation (continuable/continueType)
      // per conf `bundle.openHarmony` so it also applies on rebuild.
      plugins::write_entry_continuation(
        &config.project_dir(),
        form,
        tauri_config.bundle.open_harmony.continuable,
        tauri_config.bundle.open_harmony.continue_type.as_deref(),
        &tauri_config.identifier,
      )
      .context("failed to align entry continuation gating")?;
    }
    run_app(&config, &mut env, noise_level, profile, &active_forms)?;
  } else {
    // run an initial build to initialize plugins
    first_target
      .build(&config, &metadata, &env, noise_level, true, profile)
      .context("failed to build OpenHarmony app")?;

    let open = options.open;
    let _handle = run_build(
      interface,
      options,
      build_options,
      tauri_config,
      profile,
      &config,
      &mut env,
      noise_level,
      dirs,
    )?;

    if open {
      open_and_wait(&config, &env);
    }
  }

  Ok(())
}

/// Package the multi-entry `.app` via `hvigorw assembleApp`. Assumes `command`
/// has already done the per-form setup for every active form: compiled the
/// `.so` into `entry_{form}/libs`, injected icons + resources + plugin deps,
/// and rewritten each entry's `module.json5` deviceTypes. This fn only
/// activates all entry modules in build-profile, skips the tauriPlugin, then
/// signs + logs.
fn run_app(
  config: &OpenHarmonyConfig,
  env: &mut Env,
  noise_level: NoiseLevel,
  profile: Profile,
  active_forms: &[&str],
) -> Result<()> {
  let entries: Vec<String> = active_forms.iter().map(|f| format!("entry_{f}")).collect();
  let entries_ref: Vec<&str> = entries.iter().map(|s| s.as_str()).collect();
  plugins::write_build_profile_modules(&config.project_dir(), &entries_ref)
    .context("failed to select entry modules for app")?;

  set_var("TAURI_OHOS_SKIP_DEVECO_SCRIPT", "1");

  let app_output = app::build(config, env, noise_level, profile).context("failed to build app")?;
  let app_outputs = sign_if_configured(vec![app_output], env)?;
  log_finished(app_outputs, "App");
  Ok(())
}

#[allow(clippy::too_many_arguments)]
fn run_build(
  interface: AppInterface,
  options: Options,
  build_options: BuildOptions,
  tauri_config: ConfigMetadata,
  profile: Profile,
  config: &OpenHarmonyConfig,
  env: &mut Env,
  noise_level: NoiseLevel,
  dirs: Dirs,
) -> Result<OptionsHandle> {
  let interface_options = InterfaceOptions {
    debug: build_options.debug,
    target: build_options.target.clone(),
    args: build_options.args.clone(),
    ..Default::default()
  };

  let app_settings = interface.app_settings();
  let out_dir = app_settings.out_dir(&interface_options, dirs.tauri)?;
  let _lock = flock::open_rw(out_dir.join("lock").with_extension("ohos"), "OpenHarmony")?;

  let mut vars = HashMap::new();
  vars.insert(
    "OHOS_DEVICE_TYPE".into(),
    OsString::from(&options.device_type),
  );

  let cli_options = CliOptions {
    dev: false,
    features: build_options.features.clone(),
    args: build_options.args.clone(),
    noise_level,
    vars,
    config: build_options.config,
    target_device: None,
  };
  let handle = write_options(&tauri_config, cli_options)?;

  inject_resources(config, &tauri_config, &options.device_type)?;
  super::inject_icons(config, &tauri_config, dirs.tauri)?;

  // Activate only the entry module for the requested device form so hvigor
  // builds a single HAP (`entry_{form}-default-*.hap`). Preserves shared
  // non-entry modules (`tauri`, `dialog`, ...).
  let active_entry = active_entry_module();
  plugins::write_build_profile_modules(&config.project_dir(), &[&active_entry])
    .context("failed to select active entry module")?;
  // Align the active entry's module.json5 deviceTypes to the current conf
  // subset so conf `deviceTypes` changes apply on rebuild without re-init.
  // An empty subset is a config error (the requested form has no devices in
  // conf `deviceTypes`) — producing a HAP with `deviceTypes: []` would be
  // invalid, so bail instead of silently writing an empty array.
  let form_device_types = super::device_types_for_form(
    &tauri_config.bundle.open_harmony.device_types,
    &options.device_type,
  );
  if form_device_types.is_empty() {
    let expected = match options.device_type.as_str() {
      "mobile" => "phone/tablet/car/wearable/tv",
      "desktop" => "2in1",
      _ => "the form's device classes",
    };
    crate::error::bail!(
      "build --device-type {}: `bundle.openHarmony.deviceTypes` has no {}-class devices (got {:?}); \
       add one of {} to the config or build a form your config covers",
      options.device_type,
      options.device_type,
      tauri_config.bundle.open_harmony.device_types,
      expected,
    );
  }
  plugins::write_entry_device_types(
    &config.project_dir(),
    &options.device_type,
    &form_device_types,
  )
  .context("failed to align entry deviceTypes")?;
  // Same injection point: gate app continuation (continuable/continueType)
  // per conf `bundle.openHarmony` so it also applies on rebuild.
  plugins::write_entry_continuation(
    &config.project_dir(),
    &options.device_type,
    tauri_config.bundle.open_harmony.continuable,
    tauri_config.bundle.open_harmony.continue_type.as_deref(),
    &tauri_config.identifier,
  )
  .context("failed to align entry continuation gating")?;

  // The CLI has already compiled the Rust `.so` via `first_target.build` in
  // `command`. In the non-`--open` path, tell the hvigor `tauriPlugin` to
  // skip re-running `dev-eco-studio-script` so we don't double-build the
  // `.so` nor re-enter the CLI's WebSocket `read_options` (which can hit a
  // stale server-addr file and panic). `--open` leaves the plugin active so
  // building inside DevEco Studio still compiles the `.so`.
  if !options.open {
    set_var("TAURI_OHOS_SKIP_DEVECO_SCRIPT", "1");
  }

  let hap_outputs = hap::build(config, env, noise_level, profile).context("failed to build hap")?;

  // Sign the HAP using hap-sign-tool.jar if environment variables are set
  let hap_outputs = sign_if_configured(hap_outputs, env)?;

  log_finished(hap_outputs, "HAP");

  Ok(handle)
}

/// Sign HAP / `.app` artifacts if OHOS signing environment variables are
/// configured. `hap-sign-tool.jar sign-app` signs both `.hap` and `.app` with
/// the same parameters, so this is extension-agnostic.
///
/// Idempotent: a path already ending in `-signed` is returned unchanged; an
/// `-unsigned` path is signed to its `-signed` counterpart (e.g.
/// `entry_mobile-default-unsigned.hap` -> `entry_mobile-default-signed.hap`,
/// same for `.app`). Selection of which artifact to feed in is by name (prefer
/// `-unsigned`), not by mtime, so stale signed files can't be picked by accident.
fn sign_if_configured(
  outputs: Vec<std::path::PathBuf>,
  env: &Env,
) -> Result<Vec<std::path::PathBuf>> {
  let signing_config = match OhosSigningConfig::from_env()? {
    Some(cfg) => cfg,
    None => {
      // No env vars set — check if any signed artifact already exists
      let has_signed = outputs.iter().any(|p| {
        let name = p.file_name().unwrap_or_default().to_string_lossy();
        name.contains("-signed")
      });
      if !has_signed {
        log::warn!(
          "No signed artifact found and OHOS signing environment variables are not set. \
           The HAP/App will not be installable on a device. \
           Set OHOS_KEYSTORE_FILE, OHOS_KEYSTORE_PASSWORD, OHOS_KEY_ALIAS, \
           OHOS_KEY_PASSWORD, OHOS_APP_CERT_FILE, and OHOS_PROFILE_FILE to enable signing."
        );
      }
      return Ok(outputs);
    }
  };

  let mut signed_outputs = Vec::new();
  for path in &outputs {
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    // Already signed — skip re-signing so the step is idempotent and never
    // tries to sign a file onto itself (inFile == outFile).
    if name.contains("-signed") {
      signed_outputs.push(path.clone());
      continue;
    }
    // Derive signed output path: entry-default-unsigned.hap -> entry-default-signed.hap
    // (same for .app: xxx-unsigned.app -> xxx-signed.app)
    let signed_path = path.with_file_name(name.replace("unsigned", "signed"));

    signing_config
      .sign_hap(path, &signed_path, env)
      .context("failed to sign artifact")?;

    signed_outputs.push(signed_path);
  }

  Ok(signed_outputs)
}
