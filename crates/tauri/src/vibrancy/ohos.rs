// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use crate::utils::config::{Color, WindowEffectsConfig};
use crate::window::Effect;
use crate::{Runtime, Window};
use tauri_runtime::WindowDispatch;

pub fn apply_effects<R: Runtime>(window: &Window<R>, effects: WindowEffectsConfig) {
  let WindowEffectsConfig {
    effects,
    radius,
    color,
    ..
  } = effects;

  let window_id = match window.window.dispatcher.ohos_window_id() {
    Ok(Some(id)) => id,
    Ok(None) => {
      log::warn!("[vibrancy] ohos_window_id returned None — tao window_id not set; skipping effects");
      return;
    }
    Err(e) => {
      log::error!("[vibrancy] ohos_window_id failed: {:?}", e);
      return;
    }
  };

  let blur_radius = radius.unwrap_or(20.0);

  // Pick the first effect; OHOS approximates Blur/Acrylic via blur + tint.
  // Mica/Tabbed series is unsupported (skipped); macOS-specific effects fall back to blur.
  let Some(effect) = effects.into_iter().next() else {
    return;
  };

  let result = match effect {
    Effect::Blur => window_vibrancy::apply_ohos_blur(window_id, blur_radius),
    Effect::Acrylic => {
      let c = color.map(|Color(r, g, b, a)| (r, g, b, a));
      window_vibrancy::apply_ohos_acrylic(window_id, blur_radius, c)
    }
    // Mica/Tabbed series intentionally unsupported on OHOS — no blur/tint applied.
    Effect::Mica
    | Effect::MicaDark
    | Effect::MicaLight
    | Effect::Tabbed
    | Effect::TabbedDark
    | Effect::TabbedLight => {
      log::info!("[vibrancy] Mica/Tabbed effects are not supported on OHOS; skipping");
      Ok(())
    }
    // macOS-specific effects: best-effort approximation with basic blur
    _ => window_vibrancy::apply_ohos_blur(window_id, blur_radius),
  };
  match result {
    Ok(_) => log::info!("[vibrancy] applied effect {:?} to window_id {}", effect, window_id),
    Err(e) => log::error!("[vibrancy] apply effect {:?} to window_id {} failed: {}", effect, window_id, e),
  }
}

pub fn clear_effects<R: Runtime>(window: &Window<R>) {
  if let Ok(Some(window_id)) = window.window.dispatcher.ohos_window_id() {
    let _ = window_vibrancy::clear_ohos_blur(window_id);
  }
}
