// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use crate::{Runtime, Window};
use crate::utils::config::WindowEffectsConfig;

// TODO: OHOS vibrancy support requires window-vibrancy fork with OHOS-specific APIs.
// Currently stubbed out until the fork is available.

pub fn apply_effects<R: Runtime>(_window: &Window<R>, _effects: WindowEffectsConfig) {
  log::debug!("[vibrancy] OHOS vibrancy effects are currently not supported");
}

pub fn clear_effects<R: Runtime>(_window: &Window<R>) {
  log::debug!("[vibrancy] OHOS vibrancy clear is currently not supported");
}
