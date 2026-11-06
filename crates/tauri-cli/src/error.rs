// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::{fmt::Display, path::PathBuf};

/// The error type used across the CLI.
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
  /// An error with additional context about what operation failed.
  #[error("{0}: {1}")]
  Context(String, Box<dyn std::error::Error + Send + Sync + 'static>),
  /// A generic error with a free-form message.
  #[error("{0}")]
  GenericError(String),
  /// A bundling error.
  #[error("failed to bundle project {0}")]
  Bundler(#[from] Box<tauri_bundler::Error>),
  /// A filesystem operation failed.
  #[error("{context} {path}: {error}")]
  Fs {
    /// What operation failed.
    context: &'static str,
    /// The path the operation was on.
    path: PathBuf,
    /// The underlying I/O error.
    error: std::io::Error,
  },
  /// A command could not be spawned or exited with an error status.
  #[error("failed to run command {command}: {error}")]
  CommandFailed {
    /// The command that failed.
    command: String,
    /// The underlying I/O error.
    error: std::io::Error,
  },
  /// A macOS signing error.
  #[cfg(target_os = "macos")]
  #[error(transparent)]
  MacosSign(#[from] Box<tauri_macos_sign::Error>),
}

/// Convenient type alias of Result type.
pub type Result<T> = std::result::Result<T, Error>;

pub trait Context<T> {
  // Required methods
  fn context<C>(self, context: C) -> Result<T>
  where
    C: Display + Send + Sync + 'static;
  fn with_context<C, F>(self, f: F) -> Result<T>
  where
    C: Display + Send + Sync + 'static,
    F: FnOnce() -> C;
}

impl<T, E: std::error::Error + Send + Sync + 'static> Context<T> for std::result::Result<T, E> {
  fn context<C>(self, context: C) -> Result<T>
  where
    C: Display + Send + Sync + 'static,
  {
    self.map_err(|e| Error::Context(context.to_string(), Box::new(e)))
  }

  fn with_context<C, F>(self, f: F) -> Result<T>
  where
    C: Display + Send + Sync + 'static,
    F: FnOnce() -> C,
  {
    self.map_err(|e| Error::Context(f().to_string(), Box::new(e)))
  }
}

impl<T> Context<T> for Option<T> {
  fn context<C>(self, context: C) -> Result<T>
  where
    C: Display + Send + Sync + 'static,
  {
    self.ok_or_else(|| Error::GenericError(context.to_string()))
  }

  fn with_context<C, F>(self, f: F) -> Result<T>
  where
    C: Display + Send + Sync + 'static,
    F: FnOnce() -> C,
  {
    self.ok_or_else(|| Error::GenericError(f().to_string()))
  }
}

/// Extension trait adding filesystem-context errors to results.
pub trait ErrorExt<T> {
  /// Wraps an I/O error with the given context and path.
  fn fs_context(self, context: &'static str, path: impl Into<PathBuf>) -> Result<T>;
}

impl<T> ErrorExt<T> for std::result::Result<T, std::io::Error> {
  fn fs_context(self, context: &'static str, path: impl Into<PathBuf>) -> Result<T> {
    self.map_err(|error| Error::Fs {
      context,
      path: path.into(),
      error,
    })
  }
}

macro_rules! bail {
   ($msg:literal $(,)?) => {
      return Err(crate::Error::GenericError($msg.into()))
   };
    ($err:expr $(,)?) => {
       return Err(crate::Error::GenericError($err))
    };
   ($fmt:expr, $($arg:tt)*) => {
     return Err(crate::Error::GenericError(format!($fmt, $($arg)*)))
   };
}

pub(crate) use bail;
