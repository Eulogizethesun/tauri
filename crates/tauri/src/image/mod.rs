// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! Image types used by this crate and also referenced by the JavaScript API layer.

pub(crate) mod plugin;

use std::borrow::Cow;
use std::sync::Arc;

use crate::{Resource, ResourceId, ResourceTable};

/// An RGBA Image in row-major order from top to bottom.
#[derive(Clone)]
pub struct Image<'a> {
  rgba: Cow<'a, [u8]>,
  width: u32,
  height: u32,
}

impl std::fmt::Debug for Image<'_> {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    f.debug_struct("Image")
      .field(
        "rgba",
        // Reduces the debug size compared to the derived default, as the default
        // would format the raw bytes as numbers `[0, 0, 0, 0]` for 1 pixel.
        // The custom format doesn't grow as much with larger images:
        // `Image { rgba: Cow::Borrowed([u8; 4096]), width: 32, height: 32 }`
        &format_args!(
          "Cow::{}([u8; {}])",
          match &self.rgba {
            Cow::Borrowed(_) => "Borrowed",
            Cow::Owned(_) => "Owned",
          },
          self.rgba.len()
        ),
      )
      .field("width", &self.width)
      .field("height", &self.height)
      .finish()
  }
}

impl Resource for Image<'static> {}

impl Image<'static> {
  /// Creates a new Image using RGBA data, in row-major order from top to bottom, and with specified width and height.
  ///
  /// Similar to [`Self::new`] but avoids cloning the rgba data to get an owned Image.
  pub const fn new_owned(rgba: Vec<u8>, width: u32, height: u32) -> Self {
    Self {
      rgba: Cow::Owned(rgba),
      width,
      height,
    }
  }
}

impl<'a> Image<'a> {
  /// Creates a new Image using RGBA data, in row-major order from top to bottom, and with specified width and height.
  pub const fn new(rgba: &'a [u8], width: u32, height: u32) -> Self {
    Self {
      rgba: Cow::Borrowed(rgba),
      width,
      height,
    }
  }

  /// Creates a new image using the provided bytes.
  ///
  /// Only `ico` and `png` are supported (based on activated feature flag).
  #[cfg(any(feature = "image-ico", feature = "image-png"))]
  #[cfg_attr(docsrs, doc(cfg(any(feature = "image-ico", feature = "image-png"))))]
  pub fn from_bytes(bytes: &[u8]) -> crate::Result<Self> {
    use image::GenericImageView;

    let img = image::load_from_memory(bytes)?;
    let pixels = img
      .pixels()
      .flat_map(|(_, _, pixel)| pixel.0)
      .collect::<Vec<_>>();
    Ok(Self {
      rgba: Cow::Owned(pixels),
      width: img.width(),
      height: img.height(),
    })
  }

  /// Creates a new image using the provided path.
  ///
  /// Only `ico` and `png` are supported (based on activated feature flag).
  #[cfg(any(feature = "image-ico", feature = "image-png"))]
  #[cfg_attr(docsrs, doc(cfg(any(feature = "image-ico", feature = "image-png"))))]
  pub fn from_path<P: AsRef<std::path::Path>>(path: P) -> crate::Result<Self> {
    let bytes = std::fs::read(path)?;
    Self::from_bytes(&bytes)
  }

  /// Returns the RGBA data for this image, in row-major order from top to bottom.
  pub fn rgba(&'a self) -> &'a [u8] {
    &self.rgba
  }

  /// Returns the width of this image.
  pub fn width(&self) -> u32 {
    self.width
  }

  /// Returns the height of this image.
  pub fn height(&self) -> u32 {
    self.height
  }

  /// Convert into a 'static owned [`Image`].
  /// This will allocate.
  pub fn to_owned(self) -> Image<'static> {
    Image {
      rgba: match self.rgba {
        Cow::Owned(v) => Cow::Owned(v),
        Cow::Borrowed(v) => Cow::Owned(v.to_vec()),
      },
      height: self.height,
      width: self.width,
    }
  }
}

impl<'a> From<Image<'a>> for crate::runtime::Icon<'a> {
  fn from(img: Image<'a>) -> Self {
    Self {
      rgba: img.rgba,
      width: img.width,
      height: img.height,
    }
  }
}

#[cfg(desktop)]
impl TryFrom<Image<'_>> for muda::Icon {
  type Error = crate::Error;

  fn try_from(img: Image<'_>) -> Result<Self, Self::Error> {
    muda::Icon::from_rgba(img.rgba.to_vec(), img.width, img.height).map_err(Into::into)
  }
}

#[cfg(all(desktop, feature = "tray-icon"))]
impl TryFrom<Image<'_>> for tray_icon::Icon {
  type Error = crate::Error;

  fn try_from(img: Image<'_>) -> Result<Self, Self::Error> {
    tray_icon::Icon::from_rgba(img.rgba.to_vec(), img.width, img.height).map_err(Into::into)
  }
}

/// An image type that accepts file paths, raw bytes, previously loaded images and image objects.
///
/// This type is meant to be used along the [transformImage](https://v2.tauri.app/reference/javascript/api/namespaceimage/#transformimage) API.
///
/// # Stability
///
/// The stability of the variants are not guaranteed, and matching against them is not recommended.
/// Use [`JsImage::into_img`] instead.
/// Upstream `JsImage` verbatim on non-OHOS (untagged deserialization).
#[cfg(not(target_env = "ohos"))]
#[derive(Clone, serde::Deserialize)]
#[serde(untagged)]
#[non_exhaustive]
pub enum JsImage {
  /// A reference to a image in the filesystem.
  #[non_exhaustive]
  Path(std::path::PathBuf),
  /// Image from raw bytes.
  #[non_exhaustive]
  Bytes(Vec<u8>),
  /// An image that was previously loaded with the API and is stored in the resource table.
  #[non_exhaustive]
  Resource(ResourceId),
  /// Raw RGBA definition of an image.
  #[non_exhaustive]
  Rgba {
    /// Image bytes.
    rgba: Vec<u8>,
    /// Image width.
    width: u32,
    /// Image height.
    height: u32,
  },
}

/// OHOS: adds a `DataUri` variant — the ArkTS icon flows deliver icons as
/// base64 data URIs — plus a hand-written `Deserialize` that recovers
/// `Resource` references from serialized Image maps (duck-typing fallback).
///
/// MAINTENANCE CONTRACT: this enum duplicates upstream's `JsImage` variant
/// set plus `DataUri`. When upstream adds, removes or renames a variant, this
/// copy AND its `Deserialize` impl must be re-synced — the CI job
/// "JsImage Variant Sync" (.github/workflows/ohos-pr-review.yml) greps both
/// enums and fails the build on drift.
#[cfg(target_env = "ohos")]
#[derive(Clone)]
#[non_exhaustive]
pub enum JsImage {
  /// A data URI containing base64-encoded image data (e.g., "data:image/png;base64,...").
  #[non_exhaustive]
  DataUri(String),
  /// A reference to a image in the filesystem.
  #[non_exhaustive]
  Path(std::path::PathBuf),
  /// Image from raw bytes.
  #[non_exhaustive]
  Bytes(Vec<u8>),
  /// An image that was previously loaded with the API and is stored in the resource table.
  #[non_exhaustive]
  Resource(ResourceId),
  /// Raw RGBA definition of an image.
  #[non_exhaustive]
  Rgba {
    /// Image bytes.
    rgba: Vec<u8>,
    /// Image width.
    width: u32,
    /// Image height.
    height: u32,
  },
}

#[cfg(target_env = "ohos")]
impl<'de> serde::Deserialize<'de> for JsImage {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: serde::Deserializer<'de>,
  {
    use serde::de::{self, Unexpected, Visitor};

    struct JsImageVisitor;

    impl<'de> Visitor<'de> for JsImageVisitor {
      type Value = JsImage;

      fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("a file path, data URI, raw bytes, resource id, or rgba object")
      }

      fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
      where
        E: de::Error,
      {
        if value.starts_with("data:") {
          Ok(JsImage::DataUri(value.to_owned()))
        } else {
          Ok(JsImage::Path(value.into()))
        }
      }

      fn visit_string<E>(self, value: String) -> Result<Self::Value, E>
      where
        E: de::Error,
      {
        if value.starts_with("data:") {
          Ok(JsImage::DataUri(value))
        } else {
          Ok(JsImage::Path(value.into()))
        }
      }

      fn visit_bytes<E>(self, value: &[u8]) -> Result<Self::Value, E>
      where
        E: de::Error,
      {
        Ok(JsImage::Bytes(value.to_vec()))
      }

      fn visit_byte_buf<E>(self, value: Vec<u8>) -> Result<Self::Value, E>
      where
        E: de::Error,
      {
        Ok(JsImage::Bytes(value))
      }

      fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
      where
        A: de::SeqAccess<'de>,
      {
        let mut bytes = Vec::with_capacity(seq.size_hint().unwrap_or(0));
        while let Some(byte) = seq.next_element::<u8>()? {
          bytes.push(byte);
        }
        Ok(JsImage::Bytes(bytes))
      }

      fn visit_u64<E>(self, value: u64) -> Result<Self::Value, E>
      where
        E: de::Error,
      {
        Ok(JsImage::Resource(value as ResourceId))
      }

      fn visit_map<A>(self, mut map: A) -> Result<Self::Value, A::Error>
      where
        A: de::MapAccess<'de>,
      {
        let mut rgba: Option<Vec<u8>> = None;
        let mut width: Option<u32> = None;
        let mut height: Option<u32> = None;
        // Defense in depth: when JS transformImage uses duck-typing to extract
        // image.rid, the IPC sends the rid as a number (handled by visit_u64).
        // But if duck-typing fails (e.g. old bundled code still uses instanceof),
        // the entire Image object may be serialized as a JSON map. If that map
        // contains a "rid" key, we can still recover by treating it as a
        // JsImage::Resource, avoiding the "missing field rgba" error.
        let mut rid: Option<ResourceId> = None;

        while let Some(key) = map.next_key::<String>()? {
          match key.as_str() {
            "rgba" => rgba = Some(map.next_value()?),
            "width" => width = Some(map.next_value()?),
            "height" => height = Some(map.next_value()?),
            "rid" => rid = Some(map.next_value()?),
            _ => {
              let _: serde::de::IgnoredAny = map.next_value()?;
            }
          }
        }

        // If a rid was found in the map, treat this as a Resource reference.
        // This handles the case where an Image object was serialized as a map
        // (instead of just its rid number) due to transformImage failing to
        // extract the rid on the JS side.
        if let Some(rid) = rid {
          if rgba.is_some() {
            log::debug!("JsImage::visit_map: both rid and rgba present, using rid={}", rid);
          }
          return Ok(JsImage::Resource(rid));
        }

        let rgba = rgba.ok_or_else(|| de::Error::missing_field("rgba"))?;
        let width = width.ok_or_else(|| de::Error::missing_field("width"))?;
        let height = height.ok_or_else(|| de::Error::missing_field("height"))?;

        Ok(JsImage::Rgba {
          rgba,
          width,
          height,
        })
      }

      fn visit_i64<E>(self, value: i64) -> Result<Self::Value, E>
      where
        E: de::Error,
      {
        if value < 0 {
          Err(de::Error::invalid_value(Unexpected::Signed(value), &self))
        } else {
          Ok(JsImage::Resource(value as ResourceId))
        }
      }
    }

    deserializer.deserialize_any(JsImageVisitor)
  }
}

/// Decodes a base64 string into bytes (strict mode: invalid characters,
/// misplaced padding and truncated trailing groups are rejected).
#[cfg(all(
  target_env = "ohos",
  any(feature = "image-ico", feature = "image-png")
))]
fn decode_base64(input: &str) -> Option<Vec<u8>> {
  use base64::engine::general_purpose::STANDARD;
  use base64::Engine;
  STANDARD.decode(input).ok()
}

impl JsImage {
  /// Converts this intermediate image format into an actual [`Image`].
  ///
  /// This will retrieve the image from the passed [`ResourceTable`] if it is [`JsImage::Resource`]
  /// and will return an error if it doesn't exist in the passed [`ResourceTable`] so make sure
  /// the passed [`ResourceTable`] is the same one used to store the image, usually this should be
  /// the webview [resources table](crate::webview::Webview::resources_table).
  pub fn into_img(self, resources_table: &ResourceTable) -> crate::Result<Arc<Image<'_>>> {
    match self {
      #[cfg(target_env = "ohos")]
      Self::DataUri(uri) => {
        #[cfg(any(feature = "image-ico", feature = "image-png"))]
        {
          let base64_data = uri
            .find(',')
            .map(|pos| &uri[pos + 1..])
            .unwrap_or(&uri);
          let bytes = decode_base64(base64_data)
            .ok_or_else(|| {
              std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "invalid base64 data in data URI",
              )
            })?;
          Image::from_bytes(&bytes).map(Arc::new)
        }
        #[cfg(not(any(feature = "image-ico", feature = "image-png")))]
        {
          let _ = uri;
          Err(
            std::io::Error::new(
              std::io::ErrorKind::InvalidInput,
              "data URI image not supported without image-png or image-ico feature",
            )
            .into(),
          )
        }
      }
      Self::Resource(rid) => resources_table.get::<Image<'static>>(rid),
      #[cfg(any(feature = "image-ico", feature = "image-png"))]
      Self::Path(path) => Image::from_path(path).map(Arc::new),

      #[cfg(any(feature = "image-ico", feature = "image-png"))]
      Self::Bytes(bytes) => Image::from_bytes(&bytes).map(Arc::new),

      Self::Rgba {
        rgba,
        width,
        height,
      } => Ok(Arc::new(Image::new_owned(rgba, width, height))),

      #[cfg(not(any(feature = "image-ico", feature = "image-png")))]
      Self::Path(_) | Self::Bytes(_) => Err(
        std::io::Error::new(
          std::io::ErrorKind::InvalidInput,
          format!(
            "expected RGBA image data, found {}",
            match self {
              JsImage::Path(_) => "a file path",
              JsImage::Bytes(_) => "raw bytes",
              _ => unreachable!(),
            }
          ),
        )
        .into(),
      ),
    }
  }
}

/// Strict-mode tests pinning the base64 crate contract that replaced the old
/// hand-written lenient decoder (whitespace / truncated groups are now
/// rejected instead of being skipped).
#[cfg(all(
  test,
  target_env = "ohos",
  any(feature = "image-ico", feature = "image-png")
))]
mod decode_base64_tests {
  use super::decode_base64;

  #[test]
  fn decodes_standard_base64() {
    assert_eq!(decode_base64("TWFu").unwrap(), b"Man".to_vec());
    assert_eq!(decode_base64("MDIy").unwrap(), b"022".to_vec());
  }

  #[test]
  fn decodes_plus_and_slash_alphabet() {
    assert_eq!(decode_base64("++++").unwrap(), vec![0xFB, 0xEF, 0xBE]);
    assert_eq!(decode_base64("////").unwrap(), vec![0xFF, 0xFF, 0xFF]);
  }

  #[test]
  fn decodes_padding() {
    assert_eq!(decode_base64("TWE=").unwrap(), b"Ma".to_vec());
    assert_eq!(decode_base64("TW==").unwrap(), b"M".to_vec());
  }

  #[test]
  fn empty_input_yields_empty_output() {
    assert_eq!(decode_base64("").unwrap(), Vec::<u8>::new());
  }

  #[test]
  fn invalid_input_is_rejected() {
    // invalid characters (including the base64url alphabet)
    assert!(decode_base64("TW!u").is_none());
    assert!(decode_base64("TW-u").is_none());
    // embedded whitespace is rejected in strict mode
    assert!(decode_base64("TW E= ").is_none());
    // truncated trailing group: rejected instead of dropping the bits
    assert!(decode_base64("+").is_none());
    assert!(decode_base64("TW").is_none());
  }
}
