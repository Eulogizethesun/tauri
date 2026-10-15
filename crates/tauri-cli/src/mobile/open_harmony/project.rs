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
use toml_edit::{DocumentMut, InlineTable, Item, Table, Value};

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

  // Rust-side counterpart of the sibling HAR above: when the same checkout
  // also carries `crates/ability` (the crate the tauri fork path-depends
  // on), `inject_ohos_cargo_dependencies` patches the app's registry
  // requirement for `openharmony-ability` to it, so the app, the tauri
  // crate and the bridge HAR all resolve to ONE crate instance.
  let ability_crate = ability_har.as_deref().and_then(sibling_ability_crate);

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

  // The `tauri::mobile_entry_point` expansion on OHOS (`#[ability]`-derived
  // `openharmony` entry fn) references `napi_ohos`, `napi_derive_ohos` and
  // `::openharmony_ability` paths directly, so the app crate must depend on
  // them for `cfg(target_env = "ohos")`. Without this the scaffold compiles,
  // but its .so registers the NAPI module under the runtime crate's name
  // (`openharmony_ability`) instead of the app's (`lib<app>.so`), and the
  // ArkTS dynamic import never settles — every window stays blank (caught by
  // the C8 fresh-scaffold smoke).
  inject_ohos_cargo_dependencies(app.root_dir(), ability_crate.as_deref())?;

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

/// The `cfg(target_env = "ohos")` key inside `[target]`, looked up by key
/// VALUE — a manifest that writes it single- or double-quoted parses to the
/// same key and is handled identically.
const OHOS_TARGET_TABLE_KEY: &str = r#"cfg(target_env = "ohos")"#;

/// Entries injected into `[target.'cfg(target_env = "ohos")'.dependencies]`:
/// the `tauri::mobile_entry_point` expansion on OHOS references `napi_ohos`,
/// `napi_derive_ohos`, `::openharmony_ability` and `::log` paths directly, so
/// the app crate must depend on them for the target.
///
/// `openharmony-ability = "1.0.0-beta.0"` is a version REQUIREMENT, not a
/// pin: cargo's pre-release matching resolves a bare pre-release requirement
/// to any HIGHER pre-release of the same `1.0.0` line (e.g. `1.0.0-beta.2`
/// served by the OHOS registry mirror) — that is the intended registry
/// consumption model. The sibling-checkout model does not rely on this
/// version at all: the `[patch.crates-io]` entry injected alongside it
/// replaces the registry source with the local checkout, the same source
/// the tauri crate itself path-depends on. That patch is also what keeps
/// `--tauri-path` builds single-instance: the tauri fork depends on its
/// sibling `openharmony-ability` by path, so an unpatched registry
/// requirement builds a SECOND instance of the crate — the `#[ability]`
/// derive's `::openharmony_ability` absolute paths then resolve to a
/// different crate than the one tauri's own types come from, and the build
/// fails with E0308 mismatched types.
const OHOS_TARGET_DEPENDENCIES: [(&str, &str); 4] = [
  ("napi-ohos", "1"),
  ("napi-derive-ohos", "1"),
  ("openharmony-ability", "1.0.0-beta.0"),
  ("log", "0.4"),
];

/// Derive the `openharmony-ability` Rust crate directory from a discovered
/// sibling `ability.har` (which sits at the repo root, next to
/// `crates/ability` — the same directory the tauri crate path-depends on).
/// `None` when the HAR has no such checkout beside it (e.g. an
/// `OHOS_ABILITY_HAR` pointing at a standalone downloaded artifact).
fn sibling_ability_crate(har: &Path) -> Option<PathBuf> {
  let crate_dir = har.parent()?.join("crates").join("ability");
  crate_dir.join("Cargo.toml").is_file().then_some(crate_dir)
}

/// Nearest ancestor `Cargo.toml` declaring a `[workspace]` table, when the
/// app manifest at `tauri_dir` is not itself a workspace root. Cargo only
/// honors `[patch.crates-io]` in the workspace ROOT manifest (patches in
/// member manifests are ignored with a build warning), so this decides
/// whether the patch can be written into the app manifest or must be left
/// to the user with instructions.
fn find_owning_workspace_manifest(tauri_dir: &Path, doc: &DocumentMut) -> Option<PathBuf> {
  if doc.as_table().contains_key("workspace") {
    // The app manifest IS the workspace root — patches in it are honored.
    return None;
  }
  let mut current = tauri_dir.parent()?;
  loop {
    let candidate = current.join("Cargo.toml");
    if candidate.is_file() {
      if let Ok(text) = std::fs::read_to_string(&candidate) {
        if let Ok(ancestor) = text.parse::<DocumentMut>() {
          if ancestor.as_table().contains_key("workspace") {
            return Some(candidate);
          }
        }
      }
    }
    current = current.parent()?;
  }
}

/// What [`apply_ohos_cargo_dependencies`] changed, for reporting and tests.
struct OhosCargoInjectionReport {
  added_dependencies: Vec<&'static str>,
  added_patch: Option<String>,
}

/// Pure TOML-merge half of [`inject_ohos_cargo_dependencies`] (no I/O), split
/// out so the merge semantics are unit-testable: inject the missing
/// `[target.'cfg(target_env = "ohos")'.dependencies]` keys and, when
/// `ability_patch_path` is given, the `[patch.crates-io]` entry pinning
/// `openharmony-ability` to it. Existing entries are never rewritten.
fn apply_ohos_cargo_dependencies(
  mut doc: DocumentMut,
  ability_patch_path: Option<&str>,
) -> Result<(String, OhosCargoInjectionReport)> {
  let root = doc.as_table_mut();

  // Intermediate tables are created implicit so a fresh `[target]` /
  // `[target.'cfg(...)']` never renders a bare header — only the leaf
  // `dependencies` table (which holds the keys) gets one, with its full
  // dotted path, matching how the table is written by hand.
  let target = implicit_table_entry(root, "target")?;
  let ohos = implicit_table_entry(target, OHOS_TARGET_TABLE_KEY)?;
  let dependencies = explicit_table_entry(ohos, "dependencies")?;

  let mut added_dependencies = Vec::new();
  for (name, requirement) in OHOS_TARGET_DEPENDENCIES {
    let item = dependencies.entry(name).or_insert(Item::None);
    if matches!(item, Item::None) {
      *item = Item::Value(requirement.into());
      added_dependencies.push(name);
    }
  }

  let mut added_patch = None;
  if let Some(patch_path) = ability_patch_path {
    let patch = implicit_table_entry(root, "patch")?;
    let crates_io = explicit_table_entry(patch, "crates-io")?;
    let item = crates_io
      .entry("openharmony-ability")
      .or_insert(Item::None);
    if matches!(item, Item::None) {
      let mut definition = InlineTable::new();
      definition.get_or_insert("path", patch_path.to_string());
      *item = Item::Value(Value::InlineTable(definition));
      added_patch = Some(patch_path.to_string());
    }
  }

  Ok((
    doc.to_string(),
    OhosCargoInjectionReport {
      added_dependencies,
      added_patch,
    },
  ))
}

fn implicit_table() -> Item {
  let mut table = Table::new();
  table.set_implicit(true);
  Item::Table(table)
}

fn explicit_table() -> Item {
  Item::Table(Table::new())
}

/// Insert `key` as an implicit table if absent and return it mutably.
fn implicit_table_entry<'a>(parent: &'a mut Table, key: &str) -> Result<&'a mut Table> {
  parent
    .entry(key)
    .or_insert(implicit_table())
    .as_table_mut()
    .with_context(|| format!("`{key}` in Cargo.toml exists but is not a table"))
}

/// Insert `key` as a regular table if absent and return it mutably.
fn explicit_table_entry<'a>(parent: &'a mut Table, key: &str) -> Result<&'a mut Table> {
  parent
    .entry(key)
    .or_insert(explicit_table())
    .as_table_mut()
    .with_context(|| format!("`{key}` in Cargo.toml exists but is not a table"))
}

/// Ensure the app's Cargo.toml carries the OHOS target dependencies the
/// `tauri::mobile_entry_point` expansion needs, and — when the sibling
/// `openharmony-ability` checkout is discoverable — a `[patch.crates-io]`
/// entry pinning `openharmony-ability` to that checkout.
///
/// Both edits go through `toml_edit` and are idempotent per key: re-running
/// init, or a manifest that already carries a hand-written (or partial)
/// `[target.'cfg(target_env = "ohos")'.dependencies]` table, is merged into
/// instead of duplicated. The previous text append produced a duplicate
/// table (a TOML parse error) whenever the table already existed, and its
/// substring guard both false-positived on unrelated mentions of the crate
/// name and false-negatived on partial tables.
fn inject_ohos_cargo_dependencies(tauri_dir: &Path, ability_crate: Option<&Path>) -> Result<()> {
  let manifest_path = tauri_dir.join("Cargo.toml");
  let manifest = std::fs::read_to_string(&manifest_path)
    .with_context(|| format!("failed to read {}", manifest_path.display()))?;
  let doc = manifest
    .parse::<DocumentMut>()
    .with_context(|| format!("failed to parse {} as TOML", manifest_path.display()))?;

  let mut patch_path = None;
  match ability_crate {
    Some(crate_dir) => {
      if let Some(workspace_root) = find_owning_workspace_manifest(tauri_dir, &doc) {
        log::warn!(
          "the app manifest is a member of the workspace at {} — cargo only honors \
           `[patch.crates-io]` in the workspace root, so the `openharmony-ability` \
           patch was not written into the app manifest. Add \
           `openharmony-ability = {{ path = {:?} }}` under `[patch.crates-io]` in \
           that file yourself, or a `--tauri-path` build will fail with E0308 (two \
           crate instances via the `#[ability]` derive's absolute paths)",
          workspace_root.display(),
          crate_dir.to_string_lossy().replace('\\', "/")
        );
      } else {
        patch_path = Some(
          util::relativize_path(crate_dir, tauri_dir)
            .to_string_lossy()
            .replace('\\', "/"),
        );
      }
    }
    None => log::warn!(
      "no openharmony-ability crate checkout found beside the project — the app's \
       `openharmony-ability` resolves from the registry. That is fine with a \
       registry `tauri` dependency, but with `--tauri-path` the tauri fork \
       path-depends on its sibling checkout, and an unpatched registry \
       requirement then builds a second crate instance and fails with E0308. \
       Clone the repo next to your project (or point OHOS_ABILITY_HAR at its \
       ability.har) and re-run init to get the patch injected"
    ),
  }

  let (updated, report) = apply_ohos_cargo_dependencies(doc, patch_path.as_deref())?;

  if report.added_dependencies.is_empty() && report.added_patch.is_none() {
    return Ok(());
  }
  std::fs::write(&manifest_path, updated)
    .with_context(|| format!("failed to write {}", manifest_path.display()))?;
  if !report.added_dependencies.is_empty() {
    println!(
      "Added OHOS target dependencies to {}: {}",
      manifest_path.display(),
      report.added_dependencies.join(", ")
    );
  }
  if let Some(patch) = &report.added_patch {
    println!(
      "Patched `openharmony-ability` to the sibling checkout ({patch}) in {} so the \
       app, the tauri crate and the bridge HAR all resolve to one source",
      manifest_path.display()
    );
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  const OHOS_TABLE_HEADER: &str = "[target.'cfg(target_env = \"ohos\")'.dependencies]";

  #[test]
  fn injects_all_dependencies_into_a_fresh_manifest() {
    let (updated, report) = apply_ohos_cargo_dependencies(
      "[package]\nname = \"app\"\nversion = \"0.1.0\"\n"
        .parse()
        .unwrap(),
      None,
    )
    .unwrap();

    assert_eq!(
      report.added_dependencies.len(),
      OHOS_TARGET_DEPENDENCIES.len()
    );
    assert!(report.added_patch.is_none());
    assert_eq!(updated.matches(OHOS_TABLE_HEADER).count(), 1);

    // The output must stay valid TOML and carry every entry.
    let doc: DocumentMut = updated.parse().unwrap();
    let deps = doc["target"][OHOS_TARGET_TABLE_KEY]["dependencies"]
      .as_table()
      .unwrap();
    for (name, requirement) in OHOS_TARGET_DEPENDENCIES {
      assert_eq!(deps[name].as_str(), Some(requirement), "`{name}` missing");
    }
  }

  #[test]
  fn re_running_is_a_noop() {
    let (once, report) =
      apply_ohos_cargo_dependencies("[package]\nname = \"app\"\n".parse().unwrap(), None)
        .unwrap();
    assert!(!report.added_dependencies.is_empty());

    let (twice, report) = apply_ohos_cargo_dependencies(once.parse().unwrap(), None).unwrap();
    assert!(report.added_dependencies.is_empty());
    assert!(report.added_patch.is_none());
    assert_eq!(once, twice);
  }

  #[test]
  fn merges_into_an_existing_table_without_duplicating_it() {
    // A manifest that already has the table (hand-written or from an older
    // init) with one of its own entries: the missing keys are merged in, the
    // existing entry is kept, and no second table is produced — the old
    // text append turned exactly this into a duplicate-table TOML parse
    // error.
    let manifest = concat!(
      "[package]\nname = \"app\"\n\n",
      "[target.'cfg(target_env = \"ohos\")'.dependencies]\n",
      "openharmony-ability = { path = \"../../my-fork/crates/ability\" }\n\n",
      "[target.'cfg(windows)'.dependencies]\nwinapi = \"0.3\"\n",
    );
    let (updated, report) =
      apply_ohos_cargo_dependencies(manifest.parse().unwrap(), None).unwrap();

    assert_eq!(report.added_dependencies.len(), 3); // napi-ohos, napi-derive-ohos, log
    assert_eq!(updated.matches(OHOS_TABLE_HEADER).count(), 1);
    assert!(
      updated.contains("openharmony-ability = { path = \"../../my-fork/crates/ability\" }"),
      "user entry must be preserved verbatim"
    );
    assert!(updated.contains("winapi = \"0.3\""));

    let doc: DocumentMut = updated.parse().unwrap();
    let deps = doc["target"][OHOS_TARGET_TABLE_KEY]["dependencies"]
      .as_table()
      .unwrap();
    assert!(deps.contains_key("openharmony-ability"));
    for (name, requirement) in OHOS_TARGET_DEPENDENCIES {
      if name != "openharmony-ability" {
        assert_eq!(deps[name].as_str(), Some(requirement));
      }
    }
  }

  #[test]
  fn a_manifest_that_mentions_the_crate_elsewhere_still_gets_the_keys() {
    // The old substring guard skipped injection entirely whenever the text
    // `openharmony-ability` appeared anywhere (e.g. inside a comment or an
    // unrelated table), leaving `log` / `napi-ohos` missing.
    let manifest = concat!(
      "# openharmony-ability is consumed via the sibling checkout\n",
      "[package]\nname = \"app\"\n\n",
      "[dependencies]\nserde = \"1\"\n",
    );
    let (updated, report) =
      apply_ohos_cargo_dependencies(manifest.parse().unwrap(), None).unwrap();
    assert_eq!(report.added_dependencies.len(), 4);
    assert!(updated.contains("napi-ohos = \"1\""));
    assert!(updated.contains("log = \"0.4\""));
  }

  #[test]
  fn injects_the_sibling_patch_beside_existing_patch_entries() {
    let manifest = concat!(
      "[package]\nname = \"app\"\n\n",
      "[patch.crates-io]\nmy-crate = { path = \"../my-crate\" }\n",
    );
    let (updated, report) = apply_ohos_cargo_dependencies(
      manifest.parse().unwrap(),
      Some("../../openharmony-ability/crates/ability"),
    )
    .unwrap();

    assert_eq!(report.added_dependencies.len(), 4);
    assert_eq!(
      report.added_patch.as_deref(),
      Some("../../openharmony-ability/crates/ability")
    );
    assert!(updated.contains("my-crate = { path = \"../my-crate\" }"));
    assert!(updated.contains(
      "openharmony-ability = { path = \"../../openharmony-ability/crates/ability\" }"
    ));

    let doc: DocumentMut = updated.parse().unwrap();
    assert_eq!(
      doc["patch"]["crates-io"]["openharmony-ability"]["path"].as_str(),
      Some("../../openharmony-ability/crates/ability")
    );
  }

  #[test]
  fn keeps_an_existing_openharmony_ability_patch() {
    let manifest = concat!(
      "[package]\nname = \"app\"\n\n",
      "[patch.crates-io]\nopenharmony-ability = { path = \"../my-fork/crates/ability\" }\n",
    );
    let (updated, report) = apply_ohos_cargo_dependencies(
      manifest.parse().unwrap(),
      Some("../../openharmony-ability/crates/ability"),
    )
    .unwrap();

    assert!(report.added_patch.is_none());
    assert!(updated.contains("../my-fork/crates/ability"));
    assert!(!updated.contains("../../openharmony-ability/crates/ability"));
  }
}
