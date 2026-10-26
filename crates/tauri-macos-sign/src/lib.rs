// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::{
  ffi::{OsStr, OsString},
  path::{Path, PathBuf},
  process::{Command, ExitStatus},
};

use serde::Deserialize;

/// Certificate utilities for creating and parsing Apple signing certificates.
pub mod certificate;
mod keychain;
mod provisioning_profile;

pub use keychain::{Keychain, Team};
pub use provisioning_profile::ProvisioningProfile;

/// The error type used by this crate.
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
  /// Failed to create a temporary directory.
  #[error("failed to create temp directory: {0}")]
  TempDir(std::io::Error),
  /// Failed to resolve the current user home directory.
  #[error("failed to resolve home dir")]
  ResolveHomeDir,
  /// Failed to resolve a valid codesigning identity.
  #[error("failed to resolve signing identity")]
  ResolveSigningIdentity,
  /// Failed to decode a provisioning profile.
  #[error("failed to decode provisioning profile")]
  FailedToDecodeProvisioningProfile,
  /// The provisioning profile has no UUID.
  #[error("could not find provisioning profile UUID")]
  FailedToFindProvisioningProfileUuid,
  /// Failed to read or write a plist file.
  #[error("{context} {path}: {error}")]
  Plist {
    /// What operation failed.
    context: &'static str,
    /// The plist file path.
    path: PathBuf,
    /// The underlying plist error.
    error: plist::Error,
  },
  /// Failed to upload the app bundle to Apple's notarization servers.
  #[error("failed to upload app to Apple's notarization servers: {error}")]
  FailedToUploadApp {
    /// The underlying I/O error.
    error: std::io::Error,
  },
  /// The app could not be notarized.
  #[error("failed to notarize app: {0}")]
  Notarize(String),
  /// The `notarytool` output could not be parsed as JSON.
  #[error("failed to parse notarytool output as JSON: {output}")]
  ParseNotarytoolOutput {
    /// The raw output of the `notarytool` command.
    output: String,
  },
  /// A command could not be spawned or exited with an error status.
  #[error("failed to run command {command}: {error}")]
  CommandFailed {
    /// The command that failed.
    command: String,
    /// The underlying I/O error.
    error: std::io::Error,
  },
  /// A filesystem operation failed.
  #[error("{context} {path}: {error}")]
  Fs {
    /// What operation failed.
    context: &'static str,
    /// The path of the file the operation was on.
    path: PathBuf,
    /// The underlying I/O error.
    error: std::io::Error,
  },
  /// Failed to parse an X509 certificate.
  #[error("failed to parse X509 certificate: {error}")]
  X509Certificate {
    /// The underlying certificate parsing error.
    error: x509_certificate::X509CertificateError,
  },
  /// Failed to create a PFX bundle from a self signed certificate.
  #[error("failed to create PFX from self signed certificate")]
  FailedToCreatePFX,
  /// Failed to create a self signed certificate.
  #[error("failed to create self signed certificate: {error}")]
  FailedToCreateSelfSignedCertificate {
    /// The underlying apple-codesign error.
    error: Box<apple_codesign::AppleCodesignError>,
  },
  /// Failed to encode a DER structure.
  #[error("failed to encode DER: {error}")]
  FailedToEncodeDER {
    /// The underlying I/O error.
    error: std::io::Error,
  },
  /// Failed to decode a base64-encoded certificate.
  #[error("failed to decode base64 certificate: {0}")]
  Base64Decode(base64::DecodeError),
  /// The certificate has no common name.
  #[error("certificate missing common name")]
  CertificateMissingCommonName,
  /// The certificate has no organization unit for the given common name.
  #[error("certificate missing organization unit for common name {common_name}")]
  CertificateMissingOrganizationUnit {
    /// The common name that lacks an organization unit.
    common_name: String,
  },
}

/// A result type with the crate's [`Error`] error type.
pub type Result<T> = std::result::Result<T, Error>;

trait CommandExt {
  // The `pipe` function sets the stdout and stderr to properly
  // show the command output in the Node.js wrapper.
  fn piped(&mut self) -> std::io::Result<ExitStatus>;
}

impl CommandExt for Command {
  fn piped(&mut self) -> std::io::Result<ExitStatus> {
    self.stdin(os_pipe::dup_stdin()?);
    self.stdout(os_pipe::dup_stdout()?);
    self.stderr(os_pipe::dup_stderr()?);
    let program = self.get_program().to_string_lossy().into_owned();
    log::debug!(action = "Running"; "Command `{} {}`", program, self.get_args().map(|arg| arg.to_string_lossy()).fold(String::new(), |acc, arg| format!("{acc} {arg}")));

    self.status()
  }
}

/// A reference to an App Store Connect API key, either a path to the key file
/// or its raw content.
#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum ApiKey {
  /// The path to the `.p8` API key file.
  Path(PathBuf),
  /// The raw content of the `.p8` API key file.
  Raw(Vec<u8>),
}

/// The credentials used to authenticate with Apple's notarization service.
#[derive(Debug, Clone)]
#[non_exhaustive]
pub enum AppleNotarizationCredentials {
  /// Authenticate with an Apple ID account and an app-specific password.
  AppleId {
    /// The Apple ID email address.
    apple_id: OsString,
    /// The app-specific password for the Apple ID.
    password: OsString,
    /// The team the notarization is performed for.
    team_id: OsString,
  },
  /// Authenticate with an App Store Connect API key.
  ApiKey {
    /// The issuer id of the API key.
    issuer: OsString,
    /// The key id of the API key.
    key_id: OsString,
    /// The API key itself.
    key: ApiKey,
  },
}

#[derive(Deserialize)]
struct NotarytoolSubmitOutput {
  id: String,
  #[serde(default)]
  status: Option<String>,
  message: String,
}

/// Notarizes the given app bundle on Apple's notarization servers and staples
/// the notarization ticket to it.
pub fn notarize(
  keychain: &Keychain,
  app_bundle_path: &Path,
  auth: &AppleNotarizationCredentials,
) -> Result<()> {
  notarize_inner(keychain, app_bundle_path, auth, true)
}

/// Notarizes the given app bundle on Apple's notarization servers without
/// stapling the notarization ticket to it.
pub fn notarize_without_stapling(
  keychain: &Keychain,
  app_bundle_path: &Path,
  auth: &AppleNotarizationCredentials,
) -> Result<()> {
  notarize_inner(keychain, app_bundle_path, auth, false)
}

fn notarize_inner(
  keychain: &Keychain,
  app_bundle_path: &Path,
  auth: &AppleNotarizationCredentials,
  wait: bool,
) -> Result<()> {
  let bundle_stem = app_bundle_path
    .file_stem()
    .expect("failed to get bundle filename");

  let tmp_dir = tempfile::tempdir().map_err(Error::TempDir)?;
  let zip_path = tmp_dir
    .path()
    .join(format!("{}.zip", bundle_stem.to_string_lossy()));
  let zip_args = vec![
    "-c",
    "-k",
    "--keepParent",
    "--sequesterRsrc",
    app_bundle_path
      .to_str()
      .expect("failed to convert bundle_path to string"),
    zip_path
      .to_str()
      .expect("failed to convert zip_path to string"),
  ];

  // use ditto to create a PKZip almost identical to Finder
  // this remove almost 99% of false alarm in notarization
  assert_command(
    Command::new("ditto").args(zip_args).piped(),
    "failed to zip app with ditto",
  )
  .map_err(|error| Error::CommandFailed {
    command: "ditto".to_string(),
    error,
  })?;

  // sign the zip file
  keychain.sign(&zip_path, None, false)?;

  let mut notarize_args = vec![
    "notarytool",
    "submit",
    zip_path
      .to_str()
      .expect("failed to convert zip_path to string"),
    "--output-format",
    "json",
  ];
  if wait {
    notarize_args.push("--wait");
  }
  let notarize_args = notarize_args;

  println!("Notarizing {}", app_bundle_path.display());

  let output = Command::new("xcrun")
    .args(notarize_args)
    .notarytool_args(auth, tmp_dir.path())?
    .output()
    .map_err(|error| Error::FailedToUploadApp { error })?;

  if !output.status.success() {
    return Err(Error::Notarize(
      String::from_utf8_lossy(&output.stderr).into_owned(),
    ));
  }

  let output_str = String::from_utf8_lossy(&output.stdout);
  if let Ok(submit_output) = serde_json::from_str::<NotarytoolSubmitOutput>(&output_str) {
    let log_message = format!(
      "{} with status {} for id {} ({})",
      if wait { "Finished" } else { "Submitted" },
      submit_output.status.as_deref().unwrap_or("Pending"),
      submit_output.id,
      submit_output.message
    );
    // status is empty when not waiting for the notarization to finish
    if submit_output.status.map_or(!wait, |s| s == "Accepted") {
      println!("Notarizing {log_message}");

      if wait {
        println!("Stapling app...");
        staple_app(app_bundle_path.to_path_buf())?;
      } else {
        println!("Not waiting for notarization to finish.");
        println!("You can use `xcrun notarytool log` to check the notarization progress.");
        println!(
          "When it's done you can optionally staple your app via `xcrun stapler staple {}`",
          app_bundle_path.display()
        );
      }

      Ok(())
    } else if let Ok(output) = Command::new("xcrun")
      .args(["notarytool", "log"])
      .arg(&submit_output.id)
      .notarytool_args(auth, tmp_dir.path())?
      .output()
    {
      Err(Error::Notarize(format!(
        "{log_message}\nLog:\n{}",
        String::from_utf8_lossy(&output.stdout)
      )))
    } else {
      Err(Error::Notarize(log_message))
    }
  } else {
    Err(Error::ParseNotarytoolOutput {
      output: output_str.into_owned(),
    })
  }
}

fn staple_app(mut app_bundle_path: PathBuf) -> Result<()> {
  let app_bundle_path_clone = app_bundle_path.clone();
  let filename = app_bundle_path_clone
    .file_name()
    .expect("failed to get bundle filename")
    .to_str()
    .expect("failed to convert bundle filename to string");

  app_bundle_path.pop();

  Command::new("xcrun")
    .args(vec!["stapler", "staple", "-v", filename])
    .current_dir(app_bundle_path)
    .output()
    .map_err(|error| Error::CommandFailed {
      command: "xcrun stapler staple".to_string(),
      error,
    })?;

  Ok(())
}

/// Extension trait adding `notarytool` authentication arguments to a `Command`.
pub trait NotarytoolCmdExt {
  /// Appends the `notarytool` authentication arguments for the given credentials.
  fn notarytool_args(
    &mut self,
    auth: &AppleNotarizationCredentials,
    temp_dir: &Path,
  ) -> Result<&mut Self>;
}

impl NotarytoolCmdExt for Command {
  fn notarytool_args(
    &mut self,
    auth: &AppleNotarizationCredentials,
    temp_dir: &Path,
  ) -> Result<&mut Self> {
    match auth {
      AppleNotarizationCredentials::AppleId {
        apple_id,
        password,
        team_id,
      } => Ok(
        self
          .arg("--apple-id")
          .arg(apple_id)
          .arg("--password")
          .arg(password)
          .arg("--team-id")
          .arg(team_id),
      ),
      AppleNotarizationCredentials::ApiKey {
        key,
        key_id,
        issuer,
      } => {
        let key_path = match key {
          ApiKey::Raw(k) => {
            let key_path = temp_dir.join("AuthKey.p8");
            std::fs::write(&key_path, k).map_err(|error| Error::Fs {
              context: "failed to write notarization API key to temp file",
              path: key_path.clone(),
              error,
            })?;
            key_path
          }
          ApiKey::Path(p) => p.to_owned(),
        };

        Ok(
          self
            .arg("--key-id")
            .arg(key_id)
            .arg("--key")
            .arg(key_path)
            .arg("--issuer")
            .arg(issuer),
        )
      }
    }
  }
}

fn decode_base64(base64_input: &OsStr, out_path: &Path) -> Result<()> {
  use base64::Engine;

  let input = base64_input
    .to_str()
    .expect("failed to convert base64 to string");

  // strip whitespace before decoding
  let cleaned: String = input.chars().filter(|c| !c.is_ascii_whitespace()).collect();

  let decoded = base64::engine::general_purpose::STANDARD
    .decode(&cleaned)
    .map_err(Error::Base64Decode)?;

  std::fs::write(out_path, &decoded).map_err(|error| Error::Fs {
    context: "failed to write decoded certificate",
    path: out_path.to_path_buf(),
    error,
  })?;

  Ok(())
}

fn assert_command(
  response: std::result::Result<std::process::ExitStatus, std::io::Error>,
  error_message: &str,
) -> std::io::Result<()> {
  let status =
    response.map_err(|e| std::io::Error::new(e.kind(), format!("{error_message}: {e}")))?;
  if !status.success() {
    Err(std::io::Error::other(error_message))
  } else {
    Ok(())
  }
}
