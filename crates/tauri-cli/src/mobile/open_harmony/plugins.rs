// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use crate::error::{bail, Context as ErrorContext};
use crate::Result;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub struct DetectedPlugin {
  pub name: String,
  pub har_path: PathBuf,
}

#[derive(Debug, Deserialize)]
pub struct OhPackage {
  pub name: String,
  pub version: String,
  pub main: Option<String>,
  #[serde(default)]
  pub dependencies: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct PluginMeta {
  pub name: String,
  pub identifier: String,
  pub class_name: String,
  pub har_path: PathBuf,
}

pub fn detect_plugins(cargo_manifest_path: &Path) -> Result<Vec<String>> {
  let content = fs::read_to_string(cargo_manifest_path)
    .with_context(|| format!("failed to read {}", cargo_manifest_path.display()))?;

  let manifest: toml_edit::DocumentMut = content
    .parse::<toml_edit::DocumentMut>()
    .context("failed to parse Cargo.toml")?;

  let mut plugins = Vec::new();

  if let Some(deps) = manifest.get("dependencies").and_then(|d| d.as_table()) {
    collect_plugins_from_table(deps, &mut plugins);
  }

  if let Some(target_deps) = manifest.get("target").and_then(|t| t.as_table()) {
    for (_, target_val) in target_deps.iter() {
      if let Some(target_table) = target_val.as_table() {
        if let Some(deps) = target_table.get("dependencies").and_then(|d| d.as_table()) {
          collect_plugins_from_table(deps, &mut plugins);
        }
      }
    }
  }

  plugins.sort();
  plugins.dedup();

  log::info!("Detected {} plugins: {:?}", plugins.len(), plugins);

  Ok(plugins)
}

fn collect_plugins_from_table(table: &toml_edit::Table, plugins: &mut Vec<String>) {
  for (name, _) in table.iter() {
    if name.starts_with("tauri-plugin-") {
      plugins.push(name.replace("tauri-plugin-", ""));
    }
  }
}

pub fn find_plugin_har(plugin_name: &str, project_dir: &Path) -> Result<PathBuf> {
  validate_plugin_name(plugin_name)?;

  let canonical_project = project_dir
    .canonicalize()
    .context("failed to canonicalize project directory")?;

  // Build the candidate search paths. Order matters: the first existing path
  // wins, so more-specific (in-tree) candidates come first.
  let mut search_paths: Vec<PathBuf> = Vec::new();

  // 1. App in-tree plugins: `<app>/plugins/<name>/openharmony`.
  search_paths.push(
    canonical_project
      .join("plugins")
      .join(plugin_name)
      .join("openharmony"),
  );

  // 2. Walk up from the app's src-tauri dir to find a `plugins-workspace`
  //    sibling (or the app living inside one). Covers both the monorepo
  //    sibling layout (`<root>/<app>/src-tauri`) and the demo layout
  //    (`plugins-workspace/examples/<app>/src-tauri`, arbitrary depth) without
  //    hard-coding a fixed number of `parent()` hops.
  if let Some(root) = find_ancestor_with_plugins_workspace(&canonical_project) {
    search_paths.push(
      root
        .join("plugins-workspace")
        .join("plugins")
        .join(plugin_name)
        .join("openharmony"),
    );
  }

  // 3. Workspace root resolved from CARGO_MANIFEST_DIR (source dev run) or
  //    TAURI_WORKSPACE_ROOT env (installed binary). Same ancestor walk as #2
  //    but anchored at the cli crate dir, so the two are independent: when
  //    running from source, #2 (anchored at the app) usually wins; for an
  //    installed binary whose CARGO_MANIFEST_DIR points at the build machine,
  //    only the env override yields a real path.
  let workspace_root = get_tauri_workspace_root();
  if !workspace_root.as_os_str().is_empty() {
    search_paths.push(
      workspace_root
        .join("plugins-workspace")
        .join("plugins")
        .join(plugin_name)
        .join("openharmony"),
    );
  }

  for path in &search_paths {
    if path.exists() {
      log::info!("Found plugin '{}' at: {}", plugin_name, path.display());
      return Ok(path.clone());
    }
  }

  log::warn!(
    "Plugin '{}' not found in any search path, may not support OpenHarmony",
    plugin_name
  );

  bail!(
    "Plugin '{}' OpenHarmony HAR not found. Searched paths:\n{}",
    plugin_name,
    search_paths
      .iter()
      .map(|p| p.display().to_string())
      .collect::<Vec<_>>()
      .join("\n")
  )
}

/// Walk up from `start` to the nearest ancestor directory that contains a
/// `plugins-workspace` child (or is itself named `plugins-workspace`), and
/// return that ancestor's parent (the monorepo root). Returns `None` if no
/// such ancestor exists. This makes plugin HAR discovery robust to the app
/// sitting at arbitrary depth inside a monorepo, instead of assuming a fixed
/// `parent().parent()` depth.
fn find_ancestor_with_plugins_workspace(start: &Path) -> Option<PathBuf> {
  let mut current = start;
  loop {
    if current.join("plugins-workspace").is_dir() {
      return Some(current.to_path_buf());
    }
    match current.parent() {
      Some(parent) => current = parent,
      None => return None,
    }
  }
}

pub fn detect_all_plugins(project_dir: &Path) -> Result<Vec<DetectedPlugin>> {
  let cargo_manifest = project_dir.join("Cargo.toml");

  if !cargo_manifest.exists() {
    bail!("Cargo.toml not found at {}", cargo_manifest.display())
  }

  let plugin_names = detect_plugins(&cargo_manifest)?;

  let mut detected: Vec<DetectedPlugin> = Vec::new();

  for name in &plugin_names {
    match find_plugin_har(name, project_dir) {
      Ok(har_path) => {
        detected.push(DetectedPlugin {
          name: name.clone(),
          har_path,
        });
      }
      Err(e) => {
        log::warn!("Skipping plugin '{}': {}", name, e);
      }
    }
  }

  log::info!("Successfully located {} plugin HARs", detected.len());

  Ok(detected)
}

fn get_tauri_workspace_root() -> PathBuf {
  // Explicit override wins: used by an installed tauri-cli binary whose
  // CARGO_MANIFEST_DIR points at the build machine and thus cannot locate the
  // workspace by walking ancestors.
  if let Ok(root) = std::env::var("TAURI_WORKSPACE_ROOT") {
    return PathBuf::from(root);
  }

  // Running from source: CARGO_MANIFEST_DIR points at the dev machine's
  // `tauri/crates/tauri-cli`. Walk up to the nearest ancestor containing a
  // `plugins-workspace` sibling (the monorepo root).
  let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
    .map(PathBuf::from)
    .unwrap_or_default();

  find_ancestor_with_plugins_workspace(&manifest_dir).unwrap_or_default()
}

pub fn parse_oh_package(har_path: &Path) -> Result<OhPackage> {
  let oh_package_path = har_path.join("oh-package.json5");

  if !oh_package_path.exists() {
    bail!(
      "oh-package.json5 not found at {}",
      oh_package_path.display()
    )
  }

  let content = fs::read_to_string(&oh_package_path)
    .with_context(|| format!("failed to read {}", oh_package_path.display()))?;

  let oh_package: OhPackage = parse_json5(&content)
    .with_context(|| format!("failed to parse {}", oh_package_path.display()))?;

  log::info!(
    "Parsed oh-package: name={}, version={}",
    oh_package.name,
    oh_package.version
  );

  Ok(oh_package)
}

pub fn infer_class_name(plugin_name: &str) -> String {
  let pascal = plugin_name
    .split('-')
    .map(|part| {
      let mut chars = part.chars();
      match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
      }
    })
    .collect::<String>();

  format!("{}Plugin", pascal)
}

pub fn parse_plugin_meta(har_path: &Path, plugin_name: &str) -> Result<PluginMeta> {
  let oh_package = parse_oh_package(har_path)?;

  let identifier = oh_package.name;

  let class_name =
    try_parse_class_name_from_index(har_path).unwrap_or_else(|| infer_class_name(plugin_name));

  Ok(PluginMeta {
    name: plugin_name.to_string(),
    identifier,
    class_name,
    har_path: har_path.to_path_buf(),
  })
}

fn try_parse_class_name_from_index(har_path: &Path) -> Option<String> {
  let index_path = har_path.join("src/main/ets/index.ets");

  if !index_path.exists() {
    return None;
  }

  let content = match fs::read_to_string(&index_path) {
    Ok(c) => c,
    Err(e) => {
      log::warn!("Failed to read index.ets: {}", e);
      return None;
    }
  };

  // Patterns cover the export forms plugins use to surface their ArkTS class:
  //  - `export { default as <Class>Plugin }`   (default-as-Class re-export)
  //  - `export { <Class>Plugin as default }`   (Class-as-default, used by the
  //    dialog/notification/global-shortcut built-ins after relocation)
  //  - `export default class <Class>Plugin`
  //  - `export class <Class>Plugin extends Plugin`
  let patterns = [
    r"export\s+\{\s*\w+\s+as\s+(\w+Plugin)\s*\}",
    r"export\s+\{\s*(\w+Plugin)\s+as\s+\w+\s*\}",
    r"export\s+default\s+class\s+(\w+Plugin)",
    r"export\s+class\s+(\w+Plugin)\s+extends\s+Plugin",
  ];

  for pattern in &patterns {
    let re = regex::Regex::new(pattern).ok()?;
    for caps in re.captures_iter(&content) {
      if let Some(m) = caps.get(1) {
        let class_name = m.as_str();
        if validate_class_name_pattern(class_name) {
          return Some(class_name.to_string());
        }
      }
    }
  }

  None
}

fn validate_class_name_pattern(name: &str) -> bool {
  name.ends_with("Plugin")
    && name.len() > 6
    && name.chars().all(|c| c.is_ascii_alphabetic())
    && name
      .chars()
      .next()
      .map(|c| c.is_uppercase())
      .unwrap_or(false)
}

fn parse_json5<T: DeserializeOwned>(content: &str) -> Result<T> {
  json5::from_str(content).context("failed to parse JSON5 content")
}

pub fn validate_plugin_name(name: &str) -> Result<()> {
  if name.is_empty() || name.len() > 64 {
    bail!("Plugin name must be 1-64 characters")
  }
  if !name
    .chars()
    .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
  {
    bail!("Plugin name must only contain alphanumeric, hyphen, or underscore")
  }
  if name.starts_with('-') || name.starts_with('_') {
    bail!("Plugin name cannot start with hyphen or underscore")
  }
  Ok(())
}

/// Validates an ohpm package name — the `name` field of a plugin HAR's
/// oh-package.json5. Accepts both plain (`plugin-dialog`) and scoped
/// (`@tauri/plugin-dialog`) names: each part may only contain ASCII letters,
/// digits, `-`, `_` and `.`, and must neither be empty nor start/end with `.`
/// or `_` (the directory and import path constraints ohpm itself enforces).
///
/// Deliberately not restricted to the official `@tauri/plugin-` prefix: the
/// app-local plugin layout (`<src-tauri>/plugins/<name>/openharmony`, see
/// [`find_plugin_har`]) ships HARs under their own package names.
fn validate_identifier(identifier: &str) -> Result<()> {
  let parts: Vec<&str> = if let Some(scoped) = identifier.strip_prefix('@') {
    let Some((scope, name)) = scoped.split_once('/') else {
      bail!("Scoped ohpm package name '{identifier}' is missing a '/' after the scope");
    };
    vec![scope, name]
  } else {
    vec![identifier]
  };

  for part in parts {
    if part.is_empty() {
      bail!("ohpm package name '{identifier}' has an empty part");
    }
    if !part
      .chars()
      .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
      bail!("ohpm package name '{identifier}' may only contain letters, digits, '-', '_' and '.'");
    }
    if part.starts_with(['.', '_']) || part.ends_with(['.', '_']) {
      bail!("ohpm package name '{identifier}' has a part starting or ending with '.' or '_'");
    }
  }

  Ok(())
}

fn validate_class_name(class_name: &str) -> Result<()> {
  if !class_name.ends_with("Plugin") {
    bail!("Class name must end with 'Plugin'")
  }
  let base = class_name.trim_end_matches("Plugin");
  if base.is_empty() {
    bail!("Class name base cannot be empty")
  }
  if !base.chars().all(|c| c.is_ascii_alphabetic()) {
    bail!("Class name base must only contain alphabetic characters")
  }
  if !base
    .chars()
    .next()
    .map(|c| c.is_uppercase())
    .unwrap_or(false)
  {
    bail!("Class name must start with uppercase letter")
  }
  Ok(())
}

pub fn validate_plugin_meta(meta: &PluginMeta) -> Result<()> {
  validate_plugin_name(&meta.name)?;
  validate_identifier(&meta.identifier)?;
  validate_class_name(&meta.class_name)?;
  Ok(())
}

pub fn copy_plugin_har(meta: &PluginMeta, dest_dir: &Path) -> Result<PathBuf> {
  validate_plugin_name(&meta.name)?;

  let canonical_dest = dest_dir
    .canonicalize()
    .context("failed to canonicalize destination directory")?;

  let canonical_har = meta
    .har_path
    .canonicalize()
    .context("failed to canonicalize plugin HAR path")?;

  let plugin_dest = canonical_dest.join(&meta.name);

  log::info!(
    "Copying plugin '{}' from {} to {}",
    meta.name,
    canonical_har.display(),
    plugin_dest.display()
  );

  if plugin_dest.exists() {
    fs::remove_dir_all(&plugin_dest).with_context(|| {
      format!(
        "failed to remove existing plugin directory at {}",
        plugin_dest.display()
      )
    })?;
  }

  fs::create_dir_all(&plugin_dest).with_context(|| {
    format!(
      "failed to create plugin directory at {}",
      plugin_dest.display()
    )
  })?;

  for entry in WalkDir::new(&canonical_har)
    .into_iter()
    .filter_map(|e| e.ok())
  {
    let src_path = entry.path();
    let relative = src_path
      .strip_prefix(&canonical_har)
      .context("failed to strip prefix from source path")?;

    // Skip build artifacts: `.tauri/` is the generated `@tauri/app` runtime HAR
    // (produced by `tauri_plugin::Builder::ohos_path`), `target/` is Rust build
    // output. Copying either into the generated project would duplicate the
    // runtime already provided by the `tauri/` module and pollute `oh-package`.
    if relative.starts_with(".tauri") || relative.starts_with("target") {
      continue;
    }

    verify_relative_path_safe(relative)?;

    let dest_path = plugin_dest.join(relative);

    if entry.file_type().is_dir() {
      fs::create_dir_all(&dest_path)
        .with_context(|| format!("failed to create directory {}", dest_path.display()))?;
    } else {
      verify_path_within_destination(&dest_path, &plugin_dest)?;
      fs::copy(src_path, &dest_path).with_context(|| {
        format!(
          "failed to copy {} to {}",
          src_path.display(),
          dest_path.display()
        )
      })?;

      if relative.ends_with("oh-package.json5") || relative.ends_with("build-profile.json5") {
        adjust_paths_in_file(&dest_path)?;
      }
    }
  }

  log::info!("Successfully copied plugin '{}' HAR", meta.name);
  Ok(plugin_dest)
}

fn verify_relative_path_safe(relative: &Path) -> Result<()> {
  for component in relative.components() {
    match component {
      std::path::Component::Prefix(_) | std::path::Component::RootDir => {
        bail!("Absolute path component in relative path")
      }
      std::path::Component::ParentDir => {
        bail!("Parent directory traversal in path")
      }
      std::path::Component::Normal(name) => {
        let name_str = name.to_string_lossy();
        if name_str.contains("..") || name_str.contains('\\') {
          bail!("Unsafe path component: {}", name_str)
        }
      }
      std::path::Component::CurDir => {}
    }
  }
  Ok(())
}

fn verify_path_within_destination(dest_path: &Path, dest_root: &Path) -> Result<()> {
  let dest_path_str = dest_path.to_string_lossy();
  let dest_root_str = dest_root.to_string_lossy();

  if !dest_path_str.starts_with(&*dest_root_str) {
    bail!(
      "Destination path '{}' is outside plugin directory '{}'",
      dest_path.display(),
      dest_root.display()
    )
  }

  Ok(())
}

fn adjust_paths_in_file(file_path: &Path) -> Result<()> {
  let content = fs::read_to_string(file_path)
    .with_context(|| format!("failed to read {}", file_path.display()))?;

  let adjusted = content
    .replace(
      "\"@tauri/app\": \"file:../../../tauri\"",
      "\"@tauri/app\": \"file:../tauri\"",
    )
    .replace(
      "\"@tauri/app\": \"file:../../tauri\"",
      "\"@tauri/app\": \"file:../tauri\"",
    )
    .replace("../../../tauri", "../tauri")
    .replace("../../tauri", "../tauri");

  fs::write(file_path, adjusted)
    .with_context(|| format!("failed to write {}", file_path.display()))?;
  Ok(())
}

pub fn copy_all_plugin_hars(plugins: &[PluginMeta], dest_dir: &Path) -> Result<Vec<PathBuf>> {
  let copied: Vec<PathBuf> = plugins
    .iter()
    .map(|meta| copy_plugin_har(meta, dest_dir))
    .collect::<Result<Vec<_>>>()?;

  log::info!(
    "Copied {} plugin HARs to {}",
    copied.len(),
    dest_dir.display()
  );
  Ok(copied)
}

pub fn update_build_profile(project_dir: &Path, plugins: &[PluginMeta]) -> Result<()> {
  let build_profile_path = project_dir.join("build-profile.json5");

  log::info!(
    "Updating build-profile.json5 with {} plugins",
    plugins.len()
  );

  let content = fs::read_to_string(&build_profile_path)
    .with_context(|| "failed to read build-profile.json5")?;

  let mut profile: Value = parse_json5(&content).context("failed to parse build-profile.json5")?;

  let modules = profile
    .get_mut("modules")
    .and_then(|v| v.as_array_mut())
    .with_context(|| "build-profile.json5 has no 'modules' array")?;

  for plugin in plugins {
    // OHOS module names must match ^[a-zA-Z][0-9a-zA-Z_.]*$ (no hyphens)
    let module_name = plugin.name.replace('-', "");
    if !modules
      .iter()
      .any(|m| m.get("name").and_then(|v| v.as_str()) == Some(&module_name))
    {
      log::info!("Adding module for plugin '{}'", plugin.name);

      let module = serde_json::json!({
        "name": module_name,
        "srcPath": format!("./{}", plugin.name),
        "targets": [{
          "name": "default",
          "applyToProducts": ["default"]
        }]
      });

      modules.push(module);
    } else {
      log::info!("Module '{}' already exists, skipping", plugin.name);
    }
  }

  let updated = serialize_json5(&profile)?;
  fs::write(&build_profile_path, updated).with_context(|| "failed to write build-profile.json5")?;

  log::info!("Successfully updated build-profile.json5");
  Ok(())
}

/// Rewrite `build-profile.json5`'s `modules` array to activate exactly the
/// given entry modules — `["entry_mobile"]` for a single-form build,
/// `["entry_mobile", "entry_desktop"]` for `--app` — preserving the shared
/// non-entry modules already present (`tauri`, `dialog`, ...). This selects
/// which entry HAP(s) hvigor builds.
///
/// Note: entry modules are rebuilt from scratch (only `name`/`srcPath`/`targets`
/// are written). User customizations on an entry's build-profile module object
/// (e.g. an added `buildOption`) would be dropped — the template-generated
/// entries don't carry any, so this is acceptable. Non-entry modules are
/// preserved verbatim.
pub fn write_build_profile_modules(project_dir: &Path, active_entries: &[&str]) -> Result<()> {
  let build_profile_path = project_dir.join("build-profile.json5");
  let content = fs::read_to_string(&build_profile_path)
    .with_context(|| "failed to read build-profile.json5")?;
  let mut profile: Value = parse_json5(&content).context("failed to parse build-profile.json5")?;

  // Keep non-entry modules (tauri, dialog, ...); drop any entry-* module so we
  // can re-insert only the active ones.
  let kept: Vec<Value> = {
    let modules = profile
      .get_mut("modules")
      .and_then(|m| m.as_array_mut())
      .with_context(|| "build-profile.json5 has no 'modules' array")?;
    let mut kept = Vec::new();
    for m in modules.iter() {
      let is_entry = m
        .get("name")
        .and_then(|n| n.as_str())
        .map(|n| n.starts_with("entry"))
        .unwrap_or(false);
      if !is_entry {
        kept.push(m.clone());
      }
    }
    kept
  };

  let mut new_modules: Vec<Value> = active_entries
    .iter()
    .map(|name| {
      serde_json::json!({
        "name": name,
        "srcPath": format!("./{name}"),
        "targets": [{ "name": "default", "applyToProducts": ["default"] }]
      })
    })
    .collect();
  new_modules.extend(kept);

  {
    let modules = profile
      .get_mut("modules")
      .and_then(|m| m.as_array_mut())
      .with_context(|| "build-profile.json5 has no 'modules' array")?;
    *modules = new_modules;
  }

  let updated = serialize_json5(&profile)?;
  fs::write(&build_profile_path, updated).with_context(|| "failed to write build-profile.json5")?;
  log::info!("Activated entry modules: {:?}", active_entries);
  Ok(())
}

/// Rewrite `entry_{form}/src/main/module.json5`'s `deviceTypes` to the given
/// subset, so conf `deviceTypes` changes take effect on rebuild without
/// re-running `ohos init`. `form` selects the entry module (`entry_{form}`).
pub fn write_entry_device_types(
  project_dir: &Path,
  form: &str,
  device_types: &[String],
) -> Result<()> {
  let module = format!("entry_{form}");
  let module_json = project_dir.join(format!("{module}/src/main/module.json5"));
  let content = fs::read_to_string(&module_json)
    .with_context(|| format!("failed to read {module}/src/main/module.json5"))?;
  let mut doc: Value =
    parse_json5(&content).with_context(|| format!("failed to parse {module} module.json5"))?;
  let module_obj = doc
    .get_mut("module")
    .and_then(|m| m.as_object_mut())
    .with_context(|| format!("{module}/src/main/module.json5 has no 'module' object"))?;
  module_obj.insert(
    "deviceTypes".to_string(),
    Value::Array(
      device_types
        .iter()
        .map(|d| Value::String(d.clone()))
        .collect(),
    ),
  );
  let updated = serialize_json5(&doc)?;
  fs::write(&module_json, updated)
    .with_context(|| format!("failed to write {module}/src/main/module.json5"))?;
  Ok(())
}

/// Rewrite `entry_{form}/src/main/module.json5`'s `continuable`/`continueType`
/// (app continuation gating) per the conf's `bundle.openHarmony` settings, so
/// conf changes take effect on rebuild without re-running `ohos init` (same
/// injection point as [`write_entry_device_types`]).
///
/// `continuable == Some(true)` writes `continuable: true` plus `continueType`
/// (`continue_type` when provided, else falling back to `[identifier]` — the
/// same app installed on both devices then matches automatically). Any other
/// `continuable` value **removes** both keys, so toggling back to disabled also
/// takes effect on rebuild.
pub fn write_entry_continuation(
  project_dir: &Path,
  form: &str,
  continuable: Option<bool>,
  continue_type: Option<&[String]>,
  identifier: &str,
) -> Result<()> {
  let module = format!("entry_{form}");
  let module_json = project_dir.join(format!("{module}/src/main/module.json5"));
  let content = fs::read_to_string(&module_json)
    .with_context(|| format!("failed to read {module}/src/main/module.json5"))?;
  let mut doc: Value =
    parse_json5(&content).with_context(|| format!("failed to parse {module} module.json5"))?;
  let ability = doc
    .get_mut("module")
    .and_then(|m| m.get_mut("abilities"))
    .and_then(|a| a.as_array_mut())
    .and_then(|a| a.get_mut(0))
    .and_then(|a| a.as_object_mut())
    .with_context(|| format!("{module}/src/main/module.json5 has no abilities[0] object"))?;

  if continuable == Some(true) {
    let types: Vec<String> = match continue_type {
      Some(types) if !types.is_empty() => types.to_vec(),
      // Same app on both devices matches automatically via the shared identifier.
      _ => vec![identifier.to_string()],
    };
    ability.insert("continuable".to_string(), Value::Bool(true));
    ability.insert(
      "continueType".to_string(),
      Value::Array(types.into_iter().map(Value::String).collect()),
    );
  } else {
    // Removing a missing key is a no-op — safe toggle-back to disabled.
    ability.remove("continuable");
    ability.remove("continueType");
  }

  let updated = serialize_json5(&doc)?;
  fs::write(&module_json, updated)
    .with_context(|| format!("failed to write {module}/src/main/module.json5"))?;
  Ok(())
}

pub fn update_entry_package(project_dir: &Path, plugins: &[PluginMeta]) -> Result<()> {
  let entry_module = super::active_entry_module();
  let oh_package_path = project_dir.join(format!("{entry_module}/oh-package.json5"));

  log::info!(
    "Updating {entry_module}/oh-package.json5 with {} plugins",
    plugins.len()
  );

  let content = fs::read_to_string(&oh_package_path)
    .with_context(|| format!("failed to read {entry_module}/oh-package.json5"))?;

  let mut package: Value =
    parse_json5(&content).context("failed to parse entry oh-package.json5")?;

  let dependencies = package
    .get_mut("dependencies")
    .and_then(|v| v.as_object_mut())
    .with_context(|| format!("{entry_module}/oh-package.json5 has no 'dependencies' object"))?;

  for plugin in plugins {
    if !dependencies.contains_key(&plugin.identifier) {
      log::info!(
        "Adding dependency '{}' -> '{}'",
        plugin.identifier,
        format!("file:../{}", plugin.name)
      );

      dependencies.insert(
        plugin.identifier.clone(),
        Value::String(format!("file:../{}", plugin.name)),
      );
    } else {
      log::info!("Dependency '{}' already exists", plugin.identifier);
    }
  }

  let updated = serialize_json5(&package)?;
  fs::write(&oh_package_path, updated)
    .with_context(|| format!("failed to write {entry_module}/oh-package.json5"))?;

  log::info!("Successfully updated {entry_module}/oh-package.json5");

  update_entry_ability(project_dir, &entry_module, plugins)?;

  Ok(())
}

/// Idempotently sync the plugin imports and `STATIC_PLUGINS` registrations in
/// an entry module's `EntryAbility.ets` with the detected plugin set, and the
/// `@ohos-rs/ability` bridge plugin factories with the canonical list.
///
/// That file is generated once at `ohos init` from the handlebars template
/// (`{{#each plugins}}` loops) and, like the rest of `gen/`, is never
/// regenerated on subsequent builds — so plugins added to the app's
/// `Cargo.toml` after init would get their HAR copied and wired into
/// build-profile/oh-package, but never reach the ArkTS plugin registry and
/// fail at runtime with "Plugin not found: <name>". This backfills the two
/// generated blocks the same way the template would have.
///
/// Bridge-backed plugins fail harder: a Rust-side bridge declaration without
/// the matching ArkTS factory in `bridgePlugins` aborts bridge session setup,
/// freezing the whole app — not just the missing plugin — so the canonical
/// factory list is backfilled the same additive way (see
/// [`sync_bridge_plugin_factories`]).
///
/// Additive-only: existing lines (including hand edits) are never rewritten or
/// removed; entries for plugins that are no longer detected are left in place.
pub fn update_entry_ability(
  project_dir: &Path,
  entry_module: &str,
  plugins: &[PluginMeta],
) -> Result<()> {
  let ability_path = project_dir
    .join(entry_module)
    .join("src/main/ets/entryability/EntryAbility.ets");

  let content = fs::read_to_string(&ability_path)
    .with_context(|| format!("failed to read {}", ability_path.display()))?;

  let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();

  // Anchors: the `@tauri/app` import for new plugin imports, and the
  // STATIC_PLUGINS declaration (or its last `.set(` line) for new
  // registrations. If the file was not generated from the standard template
  // (no import anchor), skip — nothing to backfill into.
  let Some(import_anchor) = lines
    .iter()
    .position(|l| l.trim_start().starts_with("import") && l.contains("from '@tauri/app'"))
  else {
    log::warn!(
      "{entry_module}/EntryAbility.ets has no '@tauri/app' import anchor; skipping plugin registry sync"
    );
    return Ok(());
  };

  let mut reg_anchor = lines
    .iter()
    .rposition(|l| l.contains("STATIC_PLUGINS.set("))
    .or_else(|| {
      lines
        .iter()
        .position(|l| l.contains("const STATIC_PLUGINS"))
    });

  for plugin in plugins {
    let import_line = format!("import {} from '{}';", plugin.class_name, plugin.identifier);
    let reg_line = format!(
      "STATIC_PLUGINS.set('{}', new {}());",
      plugin.name, plugin.class_name
    );

    if !lines
      .iter()
      .any(|l| l.contains(&format!("from '{}'", plugin.identifier)))
    {
      log::info!(
        "Adding EntryAbility import for plugin '{}': {}",
        plugin.name,
        import_line
      );
      lines.insert(import_anchor + 1, import_line);
      // The registration anchor shifted by one line.
      if let Some(anchor) = reg_anchor.as_mut() {
        *anchor += 1;
      }
    }

    let has_reg = lines
      .iter()
      .any(|l| l.contains(&format!("STATIC_PLUGINS.set('{}'", plugin.name)));
    if !has_reg {
      if let Some(anchor) = reg_anchor {
        log::info!(
          "Adding STATIC_PLUGINS entry for plugin '{}': {}",
          plugin.name,
          reg_line
        );
        lines.insert(anchor + 1, reg_line);
        // Anchor still points at a valid `.set(` line for the next plugin.
        if let Some(a) = reg_anchor.as_mut() {
          *a += 1;
        }
      } else {
        log::warn!(
          "{entry_module}/EntryAbility.ets has no STATIC_PLUGINS anchor; cannot register plugin '{}'",
          plugin.name
        );
      }
    }
  }

  sync_bridge_plugin_factories(&mut lines, entry_module);

  let mut updated = lines.join("\n");
  if !updated.ends_with('\n') {
    updated.push('\n');
  }
  fs::write(&ability_path, updated)
    .with_context(|| format!("failed to write {}", ability_path.display()))?;

  Ok(())
}

/// ArkTS bridge plugin factories shipped by `@ohos-rs/ability` and registered
/// in the generated EntryAbility's `bridgePlugins` array. Mirrors the
/// `entry_{desktop,mobile}` EntryAbility.ets.hbs templates — keep both in
/// sync. Unused factories stay lazy and never instantiate, so backfilling the
/// full list is safe even for apps that use none of them.
///
/// Each entry is `(import binding, factory name)`; the two differ only for the
/// aliased global-shortcut plugin (its plain name collides with the JS-layer
/// plugin import).
const BRIDGE_PLUGIN_FACTORIES: &[(&str, &str)] = &[
  ("AccessibilityPlugin", "AccessibilityPlugin"),
  ("PermissionPlugin", "PermissionPlugin"),
  ("AppControlPlugin", "AppControlPlugin"),
  ("FilesPlugin", "FilesPlugin"),
  ("ResourcePlugin", "ResourcePlugin"),
  ("WindowPlugin", "WindowPlugin"),
  ("WebviewPlugin", "WebviewPlugin"),
  ("UrlPlugin", "UrlPlugin"),
  ("ClipboardPlugin", "ClipboardPlugin"),
  (
    "GlobalShortcutPlugin as GlobalShortcutBridgePlugin",
    "GlobalShortcutBridgePlugin",
  ),
  ("DeepLinkPlugin", "DeepLinkPlugin"),
  ("AutostartPlugin", "AutostartPlugin"),
  ("MenuPlugin", "MenuPlugin"),
  ("StatusbarPlugin", "StatusbarPlugin"),
  ("AccountPlugin", "AccountPlugin"),
  ("UpdaterPlugin", "UpdaterPlugin"),
];

/// Backfills the `@ohos-rs/ability` import block and the `bridgePlugins` array
/// of a generated EntryAbility.ets with the canonical bridge plugin factory
/// list — additive-only, mirroring the JS-layer sync in
/// [`update_entry_ability`].
///
/// A generated file predating the bridge plugin architecture (no
/// `@ohos-rs/ability` import, or no `bridgePlugins` array) cannot be patched
/// line-wise; the caller is pointed at `ohos init` to regenerate instead.
fn sync_bridge_plugin_factories(lines: &mut Vec<String>, entry_module: &str) {
  let Some(import_close) = lines
    .iter()
    .position(|l| l.trim_start().starts_with('}') && l.contains("from '@ohos-rs/ability'"))
  else {
    log::warn!(
      "{entry_module}/EntryAbility.ets has no '@ohos-rs/ability' import; it predates the bridge plugin architecture — re-run `tauri ohos init` to regenerate"
    );
    return;
  };

  let Some(array_open) = lines.iter().position(|l| l.contains("bridgePlugins = [")) else {
    log::warn!(
      "{entry_module}/EntryAbility.ets has no `bridgePlugins` array; it predates the bridge plugin architecture — re-run `tauri ohos init` to regenerate"
    );
    return;
  };
  let Some(array_close) = (array_open + 1..lines.len()).find(|&i| lines[i].trim() == "]") else {
    log::warn!(
      "{entry_module}/EntryAbility.ets has a malformed `bridgePlugins` array; skipping bridge plugin sync"
    );
    return;
  };

  let mut missing = Vec::new();
  for (binding, factory) in BRIDGE_PLUGIN_FACTORIES {
    if lines
      .iter()
      .any(|l| l.contains(&format!("new {factory}()")))
    {
      continue;
    }
    // Skip the import when the local name is already present somewhere (e.g.
    // an orphaned import whose factory line was hand-removed) — a duplicate
    // binding would fail the ArkTS compile.
    let needs_import = !lines.iter().any(|l| l.contains(factory));
    missing.push((*binding, *factory, needs_import));
  }
  if missing.is_empty() {
    return;
  }

  // Insert factory lines (higher index) before import lines (lower index) so
  // neither insertion point shifts while the other is still in use.
  let mut factory_at = array_close;
  for (_, factory, _) in &missing {
    log::info!("Adding EntryAbility bridgePlugins entry for '{factory}'");
    lines.insert(
      factory_at,
      format!("    new LazyPlugin(() => new {factory}()),"),
    );
    factory_at += 1;
  }

  let mut import_at = import_close;
  for (binding, factory, needs_import) in &missing {
    if *needs_import {
      log::info!("Adding EntryAbility '@ohos-rs/ability' import for bridge plugin '{factory}'");
      lines.insert(import_at, format!("  {binding},"));
      import_at += 1;
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn validate_identifier_accepts_official_and_local_ohpm_names() {
    assert!(validate_identifier("@tauri/plugin-dialog").is_ok());
    assert!(validate_identifier("my-local-plugin").is_ok());
    assert!(validate_identifier("@my-scope/plugin").is_ok());
    assert!(validate_identifier("plugin.name.2").is_ok());
  }

  #[test]
  fn validate_identifier_rejects_malformed_names() {
    // empty / empty parts
    assert!(validate_identifier("").is_err());
    assert!(validate_identifier("@scope").is_err());
    assert!(validate_identifier("@scope/").is_err());
    // characters that cannot appear in a package name or import path
    assert!(validate_identifier("has space").is_err());
    assert!(validate_identifier("../escape").is_err());
    assert!(validate_identifier("a'b").is_err());
    // ohpm forbids parts starting/ending with '.' or '_'
    assert!(validate_identifier(".leading").is_err());
    assert!(validate_identifier("trailing.").is_err());
    assert!(validate_identifier("_under").is_err());
    assert!(validate_identifier("under_").is_err());
  }

  /// Bridge-era EntryAbility.ets skeleton around the two anchors
  /// [`sync_bridge_plugin_factories`] patches: the multi-line
  /// `@ohos-rs/ability` import block and the `bridgePlugins` array.
  fn entry_ability(import_names: &[&str], factories: &[&str]) -> Vec<String> {
    let mut lines = vec![
      "import {".to_string(),
      "  NativeAbility,".to_string(),
      "  LazyPlugin,".to_string(),
    ];
    lines.extend(import_names.iter().map(|n| format!("  {n},")));
    lines.extend([
      "} from '@ohos-rs/ability'".to_string(),
      String::new(),
      "export default class EntryAbility extends NativeAbility {".to_string(),
      "  public bridgePlugins = [".to_string(),
    ]);
    lines.extend(
      factories
        .iter()
        .map(|n| format!("    new LazyPlugin(() => new {n}()),")),
    );
    lines.extend(["  ]".to_string(), "}".to_string()]);
    lines
  }

  #[test]
  fn backfills_missing_bridge_factories_and_imports() {
    // An older generated file that only knows PermissionPlugin.
    let mut lines = entry_ability(&["PermissionPlugin"], &["PermissionPlugin"]);
    sync_bridge_plugin_factories(&mut lines, "entry_mobile");

    let content = lines.join("\n");
    assert!(content.contains("  AccessibilityPlugin,\n"));
    assert!(content.contains("    new LazyPlugin(() => new AccessibilityPlugin()),"));
    // The aliased global-shortcut binding round-trips both halves.
    assert!(content.contains("  GlobalShortcutPlugin as GlobalShortcutBridgePlugin,\n"));
    assert!(content.contains("    new LazyPlugin(() => new GlobalShortcutBridgePlugin()),"));
    // Existing entries are left untouched.
    assert_eq!(
      content
        .matches("new LazyPlugin(() => new PermissionPlugin()),")
        .count(),
      1
    );
  }

  #[test]
  fn backfill_is_idempotent() {
    let mut lines = entry_ability(&["PermissionPlugin"], &["PermissionPlugin"]);
    sync_bridge_plugin_factories(&mut lines, "entry_mobile");
    let once = lines.clone();
    sync_bridge_plugin_factories(&mut lines, "entry_mobile");
    assert_eq!(once, lines);
  }

  #[test]
  fn orphaned_import_is_not_duplicated() {
    // MenuPlugin is still imported but its factory line was hand-removed —
    // backfilling must add the factory without duplicating the import binding.
    let mut lines = entry_ability(&["MenuPlugin"], &[]);
    sync_bridge_plugin_factories(&mut lines, "entry_mobile");

    let content = lines.join("\n");
    assert_eq!(content.matches("  MenuPlugin,").count(), 1);
    assert!(content.contains("new LazyPlugin(() => new MenuPlugin()),"));
  }

  #[test]
  fn pre_bridge_file_is_left_untouched() {
    let mut lines: Vec<String> = "export default class EntryAbility extends NativeAbility {"
      .lines()
      .map(String::from)
      .collect();
    let before = lines.clone();
    sync_bridge_plugin_factories(&mut lines, "entry_mobile");
    assert_eq!(before, lines);
  }
}

/// Serializes `value` into JSON5-ish text.
///
/// Lossy round-trip: this pretty-prints with serde_json and re-adds trailing
/// commas line by line — any comments in the original file are already gone
/// (the file was parsed into a `serde_json::Value` beforehand), and key order
/// follows serde_json's map ordering, not the source file's.
fn serialize_json5(value: &Value) -> Result<String> {
  let json = serde_json::to_string_pretty(value).context("failed to serialize JSON5")?;

  let lines: Vec<&str> = json.lines().collect();

  let formatted = lines
    .iter()
    .enumerate()
    .map(|(idx, line)| {
      let trimmed = line.trim();
      let next_trimmed = lines.get(idx + 1).map(|l| l.trim()).unwrap_or("");

      if trimmed.is_empty() || trimmed.starts_with("//") {
        line.to_string()
      } else if next_trimmed.starts_with("}") || next_trimmed.starts_with("]") {
        line.to_string()
      } else if trimmed.ends_with("{") || trimmed.ends_with("[") || trimmed.ends_with(",") {
        line.to_string()
      } else if trimmed.ends_with("}") || trimmed.ends_with("]") {
        line.to_string()
      } else {
        format!("{}{}", line, ",")
      }
    })
    .collect::<Vec<_>>()
    .join("\n");

  Ok(formatted)
}

pub fn verify_plugin_before_update(plugin: &PluginMeta, project_dir: &Path) -> Result<()> {
  let plugin_dir = project_dir.join(&plugin.name);

  if !plugin_dir.exists() {
    bail!(
      "Plugin HAR directory '{}' does not exist at {}",
      plugin.name,
      plugin_dir.display()
    )
  }

  let oh_package_path = plugin_dir.join("oh-package.json5");
  if !oh_package_path.exists() {
    bail!(
      "Required oh-package.json5 missing in plugin '{}'",
      plugin.name
    )
  }

  let oh_package = parse_oh_package(&plugin_dir)?;
  if oh_package.name != plugin.identifier {
    bail!(
      "Plugin identifier mismatch: expected '{}', found '{}' in oh-package.json5",
      plugin.identifier,
      oh_package.name
    )
  }

  Ok(())
}

pub fn verify_all_plugins_before_update(plugins: &[PluginMeta], project_dir: &Path) -> Result<()> {
  for plugin in plugins {
    verify_plugin_before_update(plugin, project_dir)
      .with_context(|| format!("Plugin '{}' verification failed", plugin.name))?;
  }
  Ok(())
}

pub fn update_plugin_configs(project_dir: &Path, plugins: &[PluginMeta]) -> Result<()> {
  log::info!("Updating configurations for {} plugins", plugins.len());

  verify_all_plugins_before_update(plugins, project_dir)?;

  update_build_profile(project_dir, plugins)?;

  update_entry_package(project_dir, plugins)?;

  log::info!("All plugin configurations updated successfully");
  Ok(())
}

pub fn validate_plugin_configs(project_dir: &Path, plugins: &[PluginMeta]) -> Result<()> {
  let build_profile_path = project_dir.join("build-profile.json5");
  let content = fs::read_to_string(&build_profile_path)
    .with_context(|| "failed to read build-profile.json5 for validation")?;
  for plugin in plugins {
    let module_name = plugin.name.replace('-', "");
    if !content.contains(&format!("\"name\": \"{}\"", module_name)) {
      bail!(
        "Plugin '{}' (module '{}') not found in build-profile.json5 modules",
        plugin.name,
        module_name
      )
    }
  }

  let oh_package_path =
    project_dir.join(format!("{}/oh-package.json5", super::active_entry_module()));
  let content = fs::read_to_string(&oh_package_path)
    .with_context(|| "failed to read entry oh-package.json5 for validation")?;
  for plugin in plugins {
    if !content.contains(&plugin.identifier) {
      bail!(
        "Plugin '{}' not found in entry oh-package.json5 dependencies",
        plugin.identifier
      )
    }
  }

  Ok(())
}

pub fn get_all_plugin_metadata(project_dir: &Path) -> Result<Vec<PluginMeta>> {
  let detected = detect_all_plugins(project_dir)?;

  let metadata: Vec<PluginMeta> = detected
    .iter()
    .map(|p| parse_plugin_meta(&p.har_path, &p.name))
    .collect::<Result<Vec<_>>>()?;

  log::info!(
    "Parsed {} plugin metadata entries: {:?}",
    metadata.len(),
    metadata.iter().map(|m| &m.name).collect::<Vec<_>>()
  );

  Ok(metadata)
}

/// Full plugin injection pipeline shared by `ohos build` and `ohos dev`:
/// detect the app's Tauri plugins, parse and validate their HAR metadata,
/// copy each HAR into the generated project, and wire the build-profile /
/// oh-package / EntryAbility registrations.
///
/// Returns the plugin metadata so callers can re-run the per-rebuild steps
/// (`copy_plugin_har` + `update_plugin_configs`) in dev's watch loop.
pub fn inject_plugins(tauri_dir: &Path, project_dir: &Path) -> Result<Vec<PluginMeta>> {
  log::info!("Starting OpenHarmony dynamic plugin injection");

  let detected_plugins = detect_all_plugins(tauri_dir).context("Plugin detection failed")?;

  if detected_plugins.is_empty() {
    log::info!("No OpenHarmony-compatible plugins detected, continuing");
    return Ok(vec![]);
  }

  log::info!(
    "Detected {} OpenHarmony plugins: {:?}",
    detected_plugins.len(),
    detected_plugins.iter().map(|p| &p.name).collect::<Vec<_>>()
  );

  let metadata: Vec<PluginMeta> = detected_plugins
    .iter()
    .map(|d| parse_plugin_meta(&d.har_path, &d.name))
    .collect::<Result<Vec<_>>>()
    .context("Plugin metadata parsing failed")?;

  for plugin in &metadata {
    validate_plugin_meta(plugin)
      .context(format!("Invalid metadata for plugin '{}'", plugin.name))?;
  }

  for plugin in &metadata {
    copy_plugin_har(plugin, project_dir)
      .context(format!("Failed to copy plugin '{}' HAR", plugin.name))?;
  }

  update_plugin_configs(project_dir, &metadata)
    .context("Failed to update plugin configurations")?;

  validate_plugin_configs(project_dir, &metadata)
    .context("Plugin configuration validation failed")?;

  log::info!("Plugin injection completed with {} plugins", metadata.len());
  Ok(metadata)
}
