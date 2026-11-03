// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

/// An event delivered to the page through the sample plugin channel.
#[derive(Serialize)]
pub struct Event {
  /// The event kind.
  pub kind: String,
  /// The optional event payload.
  pub value: Option<String>,
}

/// The payload of the sample plugin ping command.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PingRequest {
  /// The optional value echoed back by the plugin.
  pub value: Option<String>,
  /// The channel the plugin sends events on.
  pub on_event: Channel<Event>,
}

/// The response of the sample plugin ping command.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct PingResponse {
  /// The value echoed back by the plugin.
  pub value: Option<String>,
}
