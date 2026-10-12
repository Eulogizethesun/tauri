// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use crate::error::Context;
use crate::{helpers::template, Result};
use cargo_mobile2::{
  config::app::App,
  open_harmony::{config::Config, target::Target},
  os,
  target::TargetTrait,
  util,
};
use handlebars::Handlebars;
use include_dir::{include_dir, Dir};

use std::path::{Path, PathBuf};

use super::plugins::PluginMeta;

const TEMPLATE_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/templates/mobile/open-harmony");

pub fn gen(
  app: &App,
  config: &Config,
  (handlebars, mut map): (Handlebars, template::JsonMap),
  skip_targets_install: bool,
  mobile_device_types: &str,
  desktop_device_types: &str,
) -> Result<()> {
  if !skip_targets_install {
    let installed_targets =
      crate::interface::rust::installation::installed_targets().unwrap_or_default();
    let missing_targets = Target::all()
      .values()
      .filter(|t| !installed_targets.contains(&t.triple().into()))
      .collect::<Vec<&Target>>();

    if !missing_targets.is_empty() {
      println!("Installing OpenHarmony Rust toolchains...");
      for target in missing_targets {
        target
          .install()
          .context("failed to install target with rustup")?;
      }
    }
  }

  println!("Generating DevEco Studio project...");
  let dest = config.project_dir();

  // `root-dir-rel` is consumed by every entry's `hvigorfile.ts`. Both
  // `entry_mobile` and `entry_desktop` sit at the same depth under the project
  // dir as the old `entry` did, so the relative path back to the tauri root is
  // identical — compute it from `entry_mobile`.
  map.insert(
    "root-dir-rel",
    Path::new(&os::replace_path_separator(
      util::relativize_path(app.root_dir(), dest.join("entry_mobile")).into_os_string(),
    )),
  );
  map.insert("root-dir", app.root_dir());
  map.insert("windows", cfg!(windows));

  // `@ohos-rs/ability` in each entry's oh-package.json5 consumes the sibling
  // openharmony-ability checkout's prebuilt bridge HAR. Compute the relative
  // path from the entry module instead of the template's fixed
  // `../../../../../../../` hop count — that constant only matches the
  // in-repo `examples/api/src-tauri` depth and silently breaks every other
  // scaffold location (caught by the C8 fresh-scaffold smoke). Both entry
  // modules sit at the same depth under the project dir, so one value serves
  // both. `OHOS_ABILITY_HAR` (absolute) overrides discovery for layouts where
  // the checkout is not an ancestor of the app — e.g. on another drive —
  // mirroring `TAURI_WORKSPACE_ROOT` for plugin HAR discovery. Falls back to
  // the in-repo depth when no HAR is found; the build then fails at ohpm
  // resolution, where `prerequisites.sh` explains the sibling checkouts.
  let ability_har = match std::env::var_os("OHOS_ABILITY_HAR") {
    Some(path) if Path::new(&path).is_absolute() => Some(PathBuf::from(path)),
    Some(path) => {
      log::warn!(
        "ignoring OHOS_ABILITY_HAR={}: must be an absolute path",
        path.to_string_lossy()
      );
      find_sibling_ability_har(&dest)
    }
    None => find_sibling_ability_har(&dest),
  };
  let ability_har_rel = ability_har
    .map(|har| {
      os::replace_path_separator(
        util::relativize_path(har, dest.join("entry_desktop")).into_os_string(),
      )
      .to_string_lossy()
      .into_owned()
    })
    .unwrap_or_else(|| {
      log::warn!(
        "no openharmony-ability sibling checkout found; entry oh-package.json5 keeps \
         the in-repo relative HAR path — clone the repo next to your project or set \
         OHOS_ABILITY_HAR and re-run init"
      );
      "../../../../../../../openharmony-ability/ability.har".to_string()
    });
  map.insert("ability-har-rel", ability_har_rel.as_str());

  // Render the shared (non-entry) parts of the tree with the global map. The
  // two entry modules are rendered separately below with per-form data (their
  // `hvigorfile.ts` / `module.json5` carry `{{form}}` / `{{{form-device-types}}}`
  // that differ between entry_mobile and entry_desktop), so skip those subtrees
  // here to write every file exactly once.
  let mut skip_entries = |file_path: std::path::PathBuf| -> std::io::Result<Option<std::fs::File>> {
    let s = file_path.to_string_lossy();
    if s.starts_with("entry_mobile/") || s.starts_with("entry_desktop/") {
      return Ok(None);
    }
    let path = dest.join(&file_path);
    if let Some(parent) = path.parent() {
      std::fs::create_dir_all(parent)?;
    }
    std::fs::File::create(path).map(Some)
  };
  template::render_with_generator(
    &handlebars,
    map.inner(),
    &TEMPLATE_DIR,
    &dest,
    &mut skip_entries,
  )
  .with_context(|| "failed to process template")?;

  // Render each entry module subtree with its form-specific data so hvigorfile.ts
  // bakes the right `OHOS_DEVICE_TYPE` and module.json5 gets the right deviceTypes
  // subset (conf `deviceTypes` ∩ that form's device classes).
  for (form, device_types) in [
    ("mobile", mobile_device_types),
    ("desktop", desktop_device_types),
  ] {
    let module = format!("entry_{form}");
    let mut entry_data = map.inner().clone();
    entry_data.insert("form".into(), serde_json::Value::String(form.into()));
    entry_data.insert(
      "form-device-types".into(),
      serde_json::Value::String(device_types.into()),
    );
    let entry_dir = TEMPLATE_DIR
      .get_dir(&module)
      .with_context(|| format!("template dir {module} not found"))?;
    // `out_dir` is the project root: `include_dir` file paths are relative to
    // the template root (e.g. `entry_mobile/hvigorfile.ts`), so joining the
    // module name again would double-nest. `entry_dir` scopes the walk to this
    // entry's subtree only.
    template::render(&handlebars, &entry_data, entry_dir, &dest)
      .with_context(|| format!("failed to render {module}"))?;
  }

  Ok(())
}

pub fn gen_with_plugins(
  app: &App,
  config: &Config,
  (handlebars, mut map): (Handlebars, template::JsonMap),
  skip_targets_install: bool,
  plugin_metadata: Vec<PluginMeta>,
  mobile_device_types: &str,
  desktop_device_types: &str,
) -> Result<()> {
  if !plugin_metadata.is_empty() {
    let plugin_list: Vec<serde_json::Value> = plugin_metadata
      .iter()
      .map(|p| {
        serde_json::json!({
          "name": p.name,
          "identifier": p.identifier,
          "className": p.class_name,
        })
      })
      .collect();
    map.insert("plugins", &plugin_list);
  }

  gen(
    app,
    config,
    (handlebars, map),
    skip_targets_install,
    mobile_device_types,
    desktop_device_types,
  )
}

/// Walk up from `start` to the nearest ancestor directory that contains an
/// `openharmony-ability/ability.har` sibling checkout, and return that HAR's
/// path. Mirrors the plugins-workspace ancestor walk in `plugins.rs` so
/// scaffolded projects resolve the bridge HAR at any directory depth instead
/// of assuming the in-repo examples layout. Returns `None` if no ancestor has
/// the checkout (e.g. the app lives outside the monorepo entirely).
fn find_sibling_ability_har(start: &Path) -> Option<PathBuf> {
  let mut current = start;
  loop {
    let har = current.join("openharmony-ability").join("ability.har");
    if har.is_file() {
      return Some(har);
    }
    match current.parent() {
      Some(parent) => current = parent,
      None => return None,
    }
  }
}
