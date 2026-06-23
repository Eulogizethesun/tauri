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

  let search_paths: Vec<PathBuf> = vec![
    canonical_project
      .join("plugins")
      .join(plugin_name)
      .join("openharmony"),
    canonical_project
      .parent()
      .and_then(|p| p.parent())
      .map(|p| {
        p.join("plugins-workspace")
          .join("plugins")
          .join(plugin_name)
          .join("openharmony")
      })
      .unwrap_or_default(),
    get_tauri_workspace_root()
      .join("plugins-workspace")
      .join("plugins")
      .join(plugin_name)
      .join("openharmony"),
  ];

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

const BUILTIN_PLUGINS: &[(&str, &str, &str)] = &[
  ("dialog", "@tauri/plugin-dialog", "DialogPlugin"),
  (
    "notification",
    "@tauri/plugin-notification",
    "NotificationPlugin",
  ),
];

pub fn detect_all_plugins(project_dir: &Path) -> Result<Vec<DetectedPlugin>> {
  let cargo_manifest = project_dir.join("Cargo.toml");

  if !cargo_manifest.exists() {
    bail!("Cargo.toml not found at {}", cargo_manifest.display())
  }

  let plugin_names = detect_plugins(&cargo_manifest)?;

  let mut detected: Vec<DetectedPlugin> = Vec::new();

  for name in &plugin_names {
    let builtin = BUILTIN_PLUGINS.iter().find(|(n, _, _)| *n == name.as_str());

    if let Some((_, identifier, class_name)) = builtin {
      log::info!(
        "Plugin '{}' uses built-in template (identifier={}, className={})",
        name,
        identifier,
        class_name
      );
      detected.push(DetectedPlugin {
        name: name.clone(),
        har_path: PathBuf::from(format!("__builtin__{}", name)),
      });
      continue;
    }

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
  if let Ok(root) = std::env::var("TAURI_WORKSPACE_ROOT") {
    return PathBuf::from(root);
  }

  let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
    .map(PathBuf::from)
    .unwrap_or_default();

  manifest_dir
    .parent()
    .and_then(|p| p.parent())
    .map(|p| p.to_path_buf())
    .unwrap_or_default()
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
  let builtin = BUILTIN_PLUGINS.iter().find(|(n, _, _)| *n == plugin_name);

  if let Some((_, identifier, class_name)) = builtin {
    return Ok(PluginMeta {
      name: plugin_name.to_string(),
      identifier: identifier.to_string(),
      class_name: class_name.to_string(),
      har_path: har_path.to_path_buf(),
    });
  }

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

  let patterns = [
    r"export\s+\{\s*\w+\s+as\s+(\w+Plugin)\s*\}",
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

fn validate_identifier(identifier: &str) -> Result<()> {
  if !identifier.starts_with("@tauri/plugin-") {
    bail!("Identifier must start with @tauri/plugin-")
  }
  let name_part = identifier.trim_start_matches("@tauri/plugin-");
  validate_plugin_name(name_part)?;
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

  if meta.har_path.to_string_lossy().starts_with("__builtin__") {
    log::info!(
      "Plugin '{}' uses built-in template, skipping HAR copy (rendered by populate_template)",
      meta.name
    );
    return Ok(dest_dir.join(&meta.name));
  }

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
    if !modules
      .iter()
      .any(|m| m.get("name").and_then(|v| v.as_str()) == Some(&plugin.name))
    {
      log::info!("Adding module for plugin '{}'", plugin.name);

      let module = serde_json::json!({
        "name": plugin.name,
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

pub fn update_entry_package(project_dir: &Path, plugins: &[PluginMeta]) -> Result<()> {
  let oh_package_path = project_dir.join("entry/oh-package.json5");

  log::info!(
    "Updating entry/oh-package.json5 with {} plugins",
    plugins.len()
  );

  let content = fs::read_to_string(&oh_package_path)
    .with_context(|| "failed to read entry/oh-package.json5")?;

  let mut package: Value =
    parse_json5(&content).context("failed to parse entry/oh-package.json5")?;

  let dependencies = package
    .get_mut("dependencies")
    .and_then(|v| v.as_object_mut())
    .with_context(|| "entry/oh-package.json5 has no 'dependencies' object")?;

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
  fs::write(&oh_package_path, updated).with_context(|| "failed to write entry/oh-package.json5")?;

  log::info!("Successfully updated entry/oh-package.json5");
  Ok(())
}

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
  if plugin.har_path.to_string_lossy().starts_with("__builtin__") {
    log::info!(
      "Plugin '{}' is built-in, skipping verification",
      plugin.name
    );
    return Ok(());
  }

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
    if !content.contains(&format!("\"name\": \"{}\"", plugin.name)) {
      bail!(
        "Plugin '{}' not found in build-profile.json5 modules",
        plugin.name
      )
    }
  }

  let oh_package_path = project_dir.join("entry/oh-package.json5");
  let content = fs::read_to_string(&oh_package_path)
    .with_context(|| "failed to read entry/oh-package.json5 for validation")?;
  for plugin in plugins {
    if !content.contains(&plugin.identifier) {
      bail!(
        "Plugin '{}' not found in entry/oh-package.json5 dependencies",
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
