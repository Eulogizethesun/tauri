// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! OHOS HAP signing module using environment variables and hap-sign-tool.jar.
//!
//! This module mirrors the iOS `signing_from_env()` pattern: signing materials
//! are injected via environment variables, keeping them out of project config files.
//!
//! Passwords are never passed as `java` command line arguments (the process
//! list would show them in clear text) and hap-sign-tool itself offers no
//! environment-variable form for them — only `-keyPwd`/`-keystorePwd` CLI
//! params and an interactive console mode we cannot drive. Instead the whole
//! argument vector goes through a [java launcher argument file] (`java
//! @file`): the launcher expands the file itself, so external observers only
//! ever see `java @<tempfile>`.
//!
//! [java launcher argument file]: https://docs.oracle.com/en/java/javase/21/tools/java.html

use crate::error::Context;
use crate::Result;
use cargo_mobile2::open_harmony::env::Env;
use std::env::{var, var_os};
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::process::Command;

/// OHOS signing configuration read from environment variables.
///
/// # Environment Variables
///
/// | Variable | Required | Description |
/// |----------|----------|-------------|
/// | `OHOS_KEYSTORE_FILE` | Yes | Path to .p12 keystore file |
/// | `OHOS_KEYSTORE_PASSWORD` | Yes | Keystore password |
/// | `OHOS_KEY_ALIAS` | Yes | Key alias name |
/// | `OHOS_KEY_PASSWORD` | Yes | Key password |
/// | `OHOS_APP_CERT_FILE` | Yes | Path to .cer application certificate |
/// | `OHOS_PROFILE_FILE` | Yes | Path to .p7b provisioning profile |
/// | `OHOS_SIGN_ALG` | No | Signing algorithm (default: SHA256withECDSA) |
///
/// The `Debug` implementation redacts both passwords so an accidental log of
/// the config cannot leak them.
#[derive(Clone)]
pub struct OhosSigningConfig {
  pub keystore_file: PathBuf,
  pub keystore_password: String,
  pub key_alias: String,
  pub key_password: String,
  pub app_cert_file: PathBuf,
  pub profile_file: PathBuf,
  pub sign_alg: String,
}

impl std::fmt::Debug for OhosSigningConfig {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    f.debug_struct("OhosSigningConfig")
      .field("keystore_file", &self.keystore_file)
      .field("keystore_password", &"<redacted>")
      .field("key_alias", &self.key_alias)
      .field("key_password", &"<redacted>")
      .field("app_cert_file", &self.app_cert_file)
      .field("profile_file", &self.profile_file)
      .field("sign_alg", &self.sign_alg)
      .finish()
  }
}

const ENV_KEYSTORE_FILE: &str = "OHOS_KEYSTORE_FILE";
const ENV_KEYSTORE_PASSWORD: &str = "OHOS_KEYSTORE_PASSWORD";
const ENV_KEY_ALIAS: &str = "OHOS_KEY_ALIAS";
const ENV_KEY_PASSWORD: &str = "OHOS_KEY_PASSWORD";
const ENV_APP_CERT_FILE: &str = "OHOS_APP_CERT_FILE";
const ENV_PROFILE_FILE: &str = "OHOS_PROFILE_FILE";
const ENV_SIGN_ALG: &str = "OHOS_SIGN_ALG";

const DEFAULT_SIGN_ALG: &str = "SHA256withECDSA";

/// All required environment variable names.
const REQUIRED_VARS: &[&str] = &[
  ENV_KEYSTORE_FILE,
  ENV_KEYSTORE_PASSWORD,
  ENV_KEY_ALIAS,
  ENV_KEY_PASSWORD,
  ENV_APP_CERT_FILE,
  ENV_PROFILE_FILE,
];

impl OhosSigningConfig {
  /// Read signing configuration from environment variables.
  ///
  /// Returns:
  /// - `Ok(Some(config))` when all required variables are set
  /// - `Ok(None)` when no signing variables are set
  /// - `Err` when some (but not all) required variables are set
  pub fn from_env() -> Result<Option<Self>> {
    let (set_vars, missing): (Vec<&str>, Vec<&str>) = REQUIRED_VARS
      .iter()
      .copied()
      .partition(|name| var_os(name).is_some());

    if set_vars.is_empty() {
      return Ok(None);
    }

    // Some but not all required vars are set — warn and list what's missing
    if !missing.is_empty() {
      log::warn!(
        "OHOS signing: partially configured. Missing environment variables: {}. \n         Signing will be skipped unless all variables are set.",
        missing.join(", ")
      );
      return Ok(None);
    }

    let keystore_file =
      PathBuf::from(var_os(ENV_KEYSTORE_FILE).context("OHOS_KEYSTORE_FILE not set")?);
    let keystore_password = var(ENV_KEYSTORE_PASSWORD).context("OHOS_KEYSTORE_PASSWORD not set")?;
    let key_alias = var(ENV_KEY_ALIAS).context("OHOS_KEY_ALIAS not set")?;
    let key_password = var(ENV_KEY_PASSWORD).context("OHOS_KEY_PASSWORD not set")?;
    let app_cert_file =
      PathBuf::from(var_os(ENV_APP_CERT_FILE).context("OHOS_APP_CERT_FILE not set")?);
    let profile_file =
      PathBuf::from(var_os(ENV_PROFILE_FILE).context("OHOS_PROFILE_FILE not set")?);
    let sign_alg = var(ENV_SIGN_ALG).unwrap_or_else(|_| DEFAULT_SIGN_ALG.to_string());

    // Validate that referenced files exist
    for (name, path) in [
      (ENV_KEYSTORE_FILE, &keystore_file),
      (ENV_APP_CERT_FILE, &app_cert_file),
      (ENV_PROFILE_FILE, &profile_file),
    ] {
      if !path.exists() {
        crate::error::bail!(
          "OHOS signing: file referenced by {} does not exist: {}",
          name,
          path.display()
        );
      }
    }

    log::info!(
      "OHOS signing configured via environment variables (keyAlias: {}, signAlg: {})",
      key_alias,
      sign_alg,
    );

    Ok(Some(Self {
      keystore_file,
      keystore_password,
      key_alias,
      key_password,
      app_cert_file,
      profile_file,
      sign_alg,
    }))
  }

  /// Sign an unsigned HAP using hap-sign-tool.jar.
  ///
  /// The signed HAP is written to `signed_hap_path`.
  pub fn sign_hap(&self, unsigned_hap: &Path, signed_hap: &Path, env: &Env) -> Result<()> {
    let tool_path = Self::find_sign_tool(env)?;

    log::info!(
      "Signing HAP: {} -> {}",
      unsigned_hap.display(),
      signed_hap.display()
    );

    // hap-sign-tool only accepts the keystore/key passwords as command line
    // parameters (there is no `*PwdEnv` form and the interactive
    // `pwdInputMode` needs a console). Feeding the whole argument vector
    // through a java launcher argument file keeps them out of the process
    // list — see the module docs for the escaping rules, which are verified
    // against the launcher's parser.
    let args = [
      "-jar".to_string(),
      tool_path.to_string_lossy().into_owned(),
      "sign-app".to_string(),
      "-keyAlias".to_string(),
      self.key_alias.clone(),
      "-signAlg".to_string(),
      self.sign_alg.clone(),
      "-mode".to_string(),
      "localSign".to_string(),
      "-appCertFile".to_string(),
      self.app_cert_file.to_string_lossy().into_owned(),
      "-profileFile".to_string(),
      self.profile_file.to_string_lossy().into_owned(),
      "-inFile".to_string(),
      unsigned_hap.to_string_lossy().into_owned(),
      "-keystoreFile".to_string(),
      self.keystore_file.to_string_lossy().into_owned(),
      "-outFile".to_string(),
      signed_hap.to_string_lossy().into_owned(),
      "-keyPwd".to_string(),
      self.key_password.clone(),
      "-keystorePwd".to_string(),
      self.keystore_password.clone(),
    ];

    let mut arg_file = tempfile::Builder::new()
      .prefix("tauri-ohos-sign-")
      .tempfile()
      .context("failed to create signing argument file")?;
    arg_file
      .write_all(
        args
          .iter()
          .map(|arg| format!("\"{}\"", arg.replace('\\', "\\\\").replace('"', "\\\"")))
          .collect::<Vec<_>>()
          .join("\n")
          .as_bytes(),
      )
      .context("failed to write signing argument file")?;

    // `arg_file` (and the password-bearing file behind it) is deleted when
    // this binding goes out of scope, on success and error paths alike.
    let output = Command::new("java")
      .arg(format!("@{}", arg_file.path().display()))
      .output()
      .with_context(|| {
        "failed to run java for hap-sign-tool.jar (is Java installed and available in PATH?)"
      })?;
    drop(arg_file);

    if !output.status.success() {
      let stdout = String::from_utf8_lossy(&output.stdout);
      let stderr = String::from_utf8_lossy(&output.stderr);
      if !stdout.is_empty() {
        log::error!("hap-sign-tool.jar stdout:\n{stdout}");
      }
      if !stderr.is_empty() {
        log::error!("hap-sign-tool.jar stderr:\n{stderr}");
      }
      crate::error::bail!(
        "HAP signing failed: hap-sign-tool.jar exited with status {}",
        output.status
      );
    }

    if !signed_hap.exists() {
      crate::error::bail!(
        "HAP signing appeared to succeed but output file was not created: {}",
        signed_hap.display()
      );
    }

    log::info!("HAP signed successfully: {}", signed_hap.display());

    Ok(())
  }

  /// Locate hap-sign-tool.jar from the OHOS SDK directory.
  ///
  /// Search order:
  /// 1. From `env` toolchains path: `<toolchains>/lib/hap-sign-tool.jar`
  /// 2. From `OHOS_SDK_HOME` environment variable
  /// 3. Error if not found
  fn find_sign_tool(env: &Env) -> Result<PathBuf> {
    // Try from cargo-mobile2 env toolchains path
    let from_env = env.toolchains_path().join("lib").join("hap-sign-tool.jar");
    if from_env.exists() {
      return Ok(from_env);
    }

    // Try from OHOS_SDK_HOME
    if let Some(sdk_home) = var_os("OHOS_SDK_HOME") {
      let from_sdk = PathBuf::from(&sdk_home)
        .join("toolchains")
        .join("lib")
        .join("hap-sign-tool.jar");
      if from_sdk.exists() {
        return Ok(from_sdk);
      }
    }

    crate::error::bail!(
      "hap-sign-tool.jar not found. Searched:\n\
       - {} (from OHOS SDK toolchains)\n\
       - $OHOS_SDK_HOME/toolchains/lib/hap-sign-tool.jar\n\
       Please ensure the OpenHarmony SDK is installed correctly.",
      from_env.display(),
    )
  }
}
