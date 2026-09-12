// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Mobile-specific build utilities.

use std::{
  fs::{copy, create_dir, create_dir_all, remove_dir_all},
  path::{Path, PathBuf},
};

use anyhow::{Context, Result};

use super::build_var;

#[cfg(target_os = "macos")]
pub fn update_entitlements<F: FnOnce(&mut plist::Dictionary)>(f: F) -> Result<()> {
  if let (Some(project_path), Ok(app_name)) = (
    std::env::var_os("TAURI_IOS_PROJECT_PATH").map(PathBuf::from),
    std::env::var("TAURI_IOS_APP_NAME"),
  ) {
    update_plist_file(
      project_path
        .join(format!("{app_name}_iOS"))
        .join(format!("{app_name}_iOS.entitlements")),
      f,
    )?;
  }

  Ok(())
}

#[cfg(target_os = "macos")]
pub fn update_info_plist<F: FnOnce(&mut plist::Dictionary)>(f: F) -> Result<()> {
  if let (Some(project_path), Ok(app_name)) = (
    std::env::var_os("TAURI_IOS_PROJECT_PATH").map(PathBuf::from),
    std::env::var("TAURI_IOS_APP_NAME"),
  ) {
    update_plist_file(
      project_path
        .join(format!("{app_name}_iOS"))
        .join("Info.plist"),
      f,
    )?;
  }

  Ok(())
}

/// Updates the Android manifest by inserting XML content into a specified parent tag.
pub fn update_android_manifest(block_identifier: &str, parent: &str, insert: String) -> Result<()> {
  tauri_utils::build::update_android_manifest(block_identifier, parent, insert)
}

/// Updates the OHOS module.json5 by appending deep-link skill objects to abilities[0].skills.
///
/// Reads `TAURI_OHOS_PROJECT_PATH` to locate the OHOS project directory (set by tauri-cli).
/// Self-gating is via `CARGO_CFG_TARGET_ENV == "ohos"` (cross-compilation safe).
/// Locates `entry_{OHOS_DEVICE_TYPE}/src/main/module.json5`. Uses json5 parse/serialize.
/// Idempotent: removes existing deep-link skills (by `ohos.want.action.viewData` signature)
/// before re-injecting, so repeated builds don't accumulate. Home entry skill is preserved.
///
/// Limitations:
/// - Only `abilities[0]` is injected (single-ability Tauri OHOS apps; multi-ability projects
///   would need to target the entry ability by name).
/// - Output is serialized as strict JSON (`serde_json::to_string_pretty`); JSON5-only features
///   in the template (comments, trailing commas, unquoted keys) are lost on round-trip.
pub fn update_ohos_module_json(skills: serde_json::Value) -> Result<()> {
  // Gate 1: only run on OHOS builds. CARGO_CFG_TARGET_ENV is set by Cargo for build scripts,
  // reflecting the cross-compilation target (not the host).
  if std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default() != "ohos" {
    return Ok(());
  }
  // Gate 2: TAURI_OHOS_PROJECT_PATH is set by tauri-cli (mod.rs:191) for OHOS builds.
  // If unset (e.g. build-ohos.sh without tauri-cli), no-op gracefully.
  let Some(project_path) = std::env::var_os("TAURI_OHOS_PROJECT_PATH") else {
    return Ok(());
  };
  println!("cargo:rerun-if-env-changed=TAURI_OHOS_PROJECT_PATH");
  let device_type = std::env::var("OHOS_DEVICE_TYPE").unwrap_or_else(|_| "mobile".to_string());
  let module_json = PathBuf::from(project_path)
    .join(format!("entry_{device_type}"))
    .join("src/main/module.json5");
  if !module_json.exists() {
    return Ok(());
  }
  let content = std::fs::read_to_string(&module_json)?;
  let mut json: serde_json::Value = json5::from_str(&content)?;
  if let Some(abilities) = json
    .get_mut("module")
    .and_then(|m| m.get_mut("abilities"))
    .and_then(|a| a.as_array_mut())
  {
    if let Some(first_ability) = abilities.get_mut(0) {
      // ensure the ability has a `skills` array; initialize an empty one if missing
      // so deep-link skills are always injected (avoid silent skip on custom templates)
      if let Some(obj) = first_ability.as_object_mut() {
        let skills_arr = obj
          .entry("skills")
          .or_insert_with(|| serde_json::Value::Array(Vec::new()));
        if let Some(skills_arr) = skills_arr.as_array_mut() {
          // idempotent: remove existing deep-link skills (actions contains ohos.want.action.viewData)
          skills_arr.retain(|s| {
            !s.get("actions")
              .and_then(|a| a.as_array())
              .map(|a| a.iter().any(|v| v == "ohos.want.action.viewData"))
              .unwrap_or(false)
          });
          // append new skills
          if let Some(new_skills) = skills.as_array() {
            skills_arr.extend(new_skills.iter().cloned());
          }
        }
      }
    }
  }
  let serialized = serde_json::to_string_pretty(&json)?;
  std::fs::write(&module_json, serialized)?;
  Ok(())
}

pub(crate) fn setup(
  android_path: Option<PathBuf>,
  #[allow(unused_variables)] ios_path: Option<PathBuf>,
  #[allow(unused_variables)] ohos_path: Option<PathBuf>,
) -> Result<()> {
  let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap();
  super::cfg_aliases();

  match target_os.as_str() {
    "android" => {
      if let Some(path) = android_path {
        let manifest_dir = build_var("CARGO_MANIFEST_DIR").map(PathBuf::from)?;
        let source = manifest_dir.join(path);

        let tauri_library_path = std::env::var("DEP_TAURI_ANDROID_LIBRARY_PATH")
            .expect("missing `DEP_TAURI_ANDROID_LIBRARY_PATH` environment variable. Make sure `tauri` is a dependency of the plugin.");
        println!("cargo:rerun-if-env-changed=DEP_TAURI_ANDROID_LIBRARY_PATH");

        create_dir_all(source.join(".tauri")).context("failed to create .tauri directory")?;
        copy_folder(
          Path::new(&tauri_library_path),
          &source.join(".tauri").join("tauri-api"),
          &[],
        )
        .context("failed to copy tauri-api to the plugin project")?;

        println!("cargo:android_library_path={}", source.display());
      }
    }
    #[cfg(target_os = "macos")]
    "ios" => {
      if let Some(path) = ios_path {
        let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
          .map(PathBuf::from)
          .unwrap();
        let tauri_library_path = std::env::var("DEP_TAURI_IOS_LIBRARY_PATH")
            .expect("missing `DEP_TAURI_IOS_LIBRARY_PATH` environment variable. Make sure `tauri` is a dependency of the plugin.");

        let tauri_dep_path = path.parent().unwrap().join(".tauri");
        create_dir_all(&tauri_dep_path).context("failed to create .tauri directory")?;
        copy_folder(
          Path::new(&tauri_library_path),
          &tauri_dep_path.join("tauri-api"),
          &[".build", "Package.resolved", "Tests"],
        )
        .context("failed to copy tauri-api to the plugin project")?;
        tauri_utils::build::link_apple_library(
          &std::env::var("CARGO_PKG_NAME").unwrap(),
          manifest_dir.join(path),
        );
      }
    }
    _ => {
      if std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default() == "ohos" {
        if let Some(path) = ohos_path {
          let manifest_dir = build_var("CARGO_MANIFEST_DIR").map(PathBuf::from)?;
          let source = manifest_dir.join(path);

          let tauri_library_path = std::env::var("DEP_TAURI_OHOS_LIBRARY_PATH")
            .expect("missing `DEP_TAURI_OHOS_LIBRARY_PATH` environment variable. Make sure `tauri` is a dependency of the plugin.");
          println!("cargo:rerun-if-env-changed=DEP_TAURI_OHOS_LIBRARY_PATH");

          create_dir_all(source.join(".tauri")).context("failed to create .tauri directory")?;
          copy_folder(
            Path::new(&tauri_library_path),
            &source.join(".tauri").join("tauri-api"),
            &[],
          )
          .context("failed to copy tauri-api to the plugin project")?;

          println!("cargo:ohos_library_path={}", source.display());
        }
      }
    }
  }

  Ok(())
}

fn copy_folder(source: &Path, target: &Path, ignore_paths: &[&str]) -> Result<()> {
  let _ = remove_dir_all(target);

  for entry in walkdir::WalkDir::new(source) {
    let entry = entry?;
    let rel_path = entry.path().strip_prefix(source)?;
    let rel_path_str = rel_path.to_string_lossy();
    if ignore_paths
      .iter()
      .any(|path| rel_path_str.starts_with(path))
    {
      continue;
    }
    let dest_path = target.join(rel_path);

    if entry.file_type().is_dir() {
      create_dir(&dest_path)
        .with_context(|| format!("failed to create directory {}", dest_path.display()))?;
    } else {
      copy(entry.path(), &dest_path).with_context(|| {
        format!(
          "failed to copy {} to {}",
          entry.path().display(),
          dest_path.display()
        )
      })?;
      println!("cargo:rerun-if-changed={}", entry.path().display());
    }
  }

  Ok(())
}

#[cfg(target_os = "macos")]
fn update_plist_file<P: AsRef<Path>, F: FnOnce(&mut plist::Dictionary)>(
  path: P,
  f: F,
) -> Result<()> {
  use std::io::Cursor;

  let path = path.as_ref();
  if path.exists() {
    let plist_str = std::fs::read_to_string(path)?;
    let mut plist = plist::Value::from_reader(Cursor::new(&plist_str))?;
    if let Some(dict) = plist.as_dictionary_mut() {
      f(dict);
      let mut plist_buf = Vec::new();
      let writer = Cursor::new(&mut plist_buf);
      plist::to_writer_xml(writer, &plist)?;
      let new_plist_str = String::from_utf8(plist_buf)?;
      if new_plist_str != plist_str {
        std::fs::write(path, new_plist_str)?;
      }
    }
  }

  Ok(())
}

#[cfg(test)]
mod tests {
  #[test]
  fn update_android_manifest() {
    use tauri_utils::build::update_android_manifest;

    // This test would require setting up the environment, so we just verify it compiles
    // The actual implementation is tested in tauri-utils
    let _result = update_android_manifest("test", "activity", "<test></test>".to_string());
  }
}
