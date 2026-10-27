// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{
  command,
  ipc::{Channel, CommandScope},
  webview::PageLoadEvent,
  Emitter, Listener, Manager, Resource, ResourceId, Runtime, WebviewUrl,
};

// A simple Counter resource that lives in Rust
struct Counter {
  value: AtomicU32,
}

impl Resource for Counter {
  fn name(&self) -> std::borrow::Cow<'_, str> {
    "Counter".into()
  }
}

#[command]
pub fn create_counter<R: Runtime>(app: tauri::AppHandle<R>) -> ResourceId {
  let counter = Counter {
    value: AtomicU32::new(0),
  };
  app.resources_table().add(counter)
}

#[command]
pub fn increment_counter<R: Runtime>(
  app: tauri::AppHandle<R>,
  rid: ResourceId,
) -> tauri::Result<u32> {
  let counter = app.resources_table().get::<Counter>(rid)?;
  let new_value = counter.value.fetch_add(1, Ordering::SeqCst) + 1;
  Ok(new_value)
}

#[command]
pub fn get_counter_value<R: Runtime>(
  app: tauri::AppHandle<R>,
  rid: ResourceId,
) -> tauri::Result<u32> {
  let counter = app.resources_table().get::<Counter>(rid)?;
  Ok(counter.value.load(Ordering::SeqCst))
}

// Event tracking for testing
#[derive(Default)]
pub struct EventTracker {
  pub window_events: Mutex<Vec<String>>,
  pub menu_events: Mutex<Vec<String>>,
  pub run_events: Mutex<Vec<String>>,
  /// Webview viewport probe samples (public/webview-viewport-probe.{html,js},
  /// openspec ohos-webview-sizing): the RENDERED ArkWeb viewport of whichever
  /// webview loaded the probe page, reported through the real invoke path.
  /// Samples accumulate between `clear_tracked_events` calls — pollers take the
  /// latest entry per tag, so resize re-reports supersede the load-time one;
  /// cases create their webviews and poll within one test step, and the suite
  /// runs steps sequentially, so a mid-run clear never races a live poller.
  pub viewport_probes: Mutex<Vec<ViewportProbeSample>>,
}

/// One viewport probe report from a webview page.
///
/// Field names are camelCase to match the wire the probe page speaks: the JS
/// side sends camelCase invoke args (tauri auto-maps them to these snake_case
/// params on `track_webview_viewport_probe`) and core.ts reads the returned
/// samples as `.innerWidth` etc. — hence `rename_all` for the Serialize side.
/// Without the rename, the return JSON is snake_case and the poller reads
/// `undefined` — the red-light run of 2026-10-19 failed exactly that way
/// (every assertion saw `undefined×undefined`, a broken rig, not the designed
/// red light).
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewportProbeSample {
  /// Probe key — the reporting webview's label (frozen into
  /// `__TAURI_INTERNALS__.metadata` by the init scripts).
  pub tag: String,
  pub inner_width: f64,
  pub inner_height: f64,
  pub doc_width: f64,
  pub doc_height: f64,
  pub reported_at_ms: u64,
}

#[command]
pub fn track_webview_viewport_probe<R: Runtime>(
  app: tauri::AppHandle<R>,
  tag: String,
  inner_width: f64,
  inner_height: f64,
  doc_width: f64,
  doc_height: f64,
) -> tauri::Result<()> {
  let tracker = app.state::<EventTracker>();
  tracker
    .viewport_probes
    .lock()
    .unwrap()
    .push(ViewportProbeSample {
      tag,
      inner_width,
      inner_height,
      doc_width,
      doc_height,
      reported_at_ms: std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0),
    });
  Ok(())
}

#[command]
pub fn get_tracked_webview_viewport_probes<R: Runtime>(
  app: tauri::AppHandle<R>,
) -> tauri::Result<Vec<ViewportProbeSample>> {
  let tracker = app.state::<EventTracker>();
  let probes = tracker.viewport_probes.lock().unwrap().clone();
  Ok(probes)
}

#[command]
pub fn get_tracked_window_events<R: Runtime>(
  app: tauri::AppHandle<R>,
) -> tauri::Result<Vec<String>> {
  let tracker = app.state::<EventTracker>();
  let events = tracker.window_events.lock().unwrap().clone();
  Ok(events)
}

#[command]
pub fn get_tracked_menu_events<R: Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<Vec<String>> {
  let tracker = app.state::<EventTracker>();
  let events = tracker.menu_events.lock().unwrap().clone();
  Ok(events)
}

#[command]
pub fn get_tracked_run_events<R: Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<Vec<String>> {
  let tracker = app.state::<EventTracker>();
  let events = tracker.run_events.lock().unwrap().clone();
  Ok(events)
}

#[command]
pub fn clear_tracked_events<R: Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<()> {
  let tracker = app.state::<EventTracker>();
  tracker.window_events.lock().unwrap().clear();
  tracker.menu_events.lock().unwrap().clear();
  tracker.viewport_probes.lock().unwrap().clear();
  // Do NOT clear run_events — Ready fires only once and cannot be re-triggered
  Ok(())
}

// New window request handling for OHOS on_new_window tests.
// Only referenced from OHOS-gated code paths (command registration and the
// on_new_window handler below), so the whole group is gated to match.
#[cfg(target_env = "ohos")]
#[derive(Default)]
pub struct NewWindowDenyState {
  pub deny: std::sync::atomic::AtomicBool,
  pub create: std::sync::atomic::AtomicBool,
  pub last_url: Mutex<Option<String>>,
}

#[cfg(target_env = "ohos")]
#[command]
pub fn set_deny_new_window<R: Runtime>(app: tauri::AppHandle<R>, deny: bool) -> tauri::Result<()> {
  let state = app.state::<NewWindowDenyState>();
  state.deny.store(deny, Ordering::SeqCst);
  log::info!("[set_deny_new_window] deny={}", deny);
  Ok(())
}

#[cfg(target_env = "ohos")]
#[command]
pub fn set_create_new_window<R: Runtime>(
  app: tauri::AppHandle<R>,
  create: bool,
) -> tauri::Result<()> {
  let state = app.state::<NewWindowDenyState>();
  state.create.store(create, Ordering::SeqCst);
  log::debug!("[set_create_new_window] create={}", create);
  Ok(())
}

#[cfg(target_env = "ohos")]
#[command]
pub fn get_last_new_window_url<R: Runtime>(
  app: tauri::AppHandle<R>,
) -> tauri::Result<Option<String>> {
  let state = app.state::<NewWindowDenyState>();
  let url = state.last_url.lock().unwrap().clone();
  Ok(url)
}

#[derive(Debug, Deserialize)]
#[allow(unused)]
pub struct RequestBody {
  id: i32,
  name: String,
}

#[derive(Debug, Deserialize)]
pub struct LogScope {
  event: String,
}

#[command]
pub fn log_operation(
  event: String,
  payload: Option<String>,
  command_scope: CommandScope<LogScope>,
) -> Result<(), &'static str> {
  if command_scope.denies().iter().any(|s| s.event == event) {
    Err("denied")
  } else if !command_scope.allows().iter().any(|s| s.event == event) {
    Err("not allowed")
  } else {
    log::info!("{event} {payload:?}");
    Ok(())
  }
}

#[derive(Serialize)]
pub struct ApiResponse {
  message: String,
}

#[command]
pub fn perform_request(endpoint: String, body: RequestBody) -> ApiResponse {
  println!("{endpoint} {body:?}");
  ApiResponse {
    message: "message response".into(),
  }
}

#[command]
pub fn echo(request: tauri::ipc::Request<'_>) -> tauri::ipc::Response {
  tauri::ipc::Response::new(request.body().clone())
}

#[command]
pub fn spam(channel: Channel<i32>) -> tauri::Result<()> {
  for i in 1i32..=1_000i32 {
    channel.send(i)?;
  }
  Ok(())
}

/// Clear the test report file before starting a new test run.
#[command]
pub fn clear_test_report<R: Runtime>(
  #[allow(unused_variables)] app: tauri::AppHandle<R>,
) -> Result<(), String> {
  #[cfg(target_env = "ohos")]
  let dir = std::path::PathBuf::from("/data/storage/el2/base/cache");
  #[cfg(not(target_env = "ohos"))]
  let dir = {
    use tauri::Manager;
    app.path().app_cache_dir().map_err(|e| e.to_string())?
  };

  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let path = dir.join("test-report.md");

  // Write report header with timestamp
  let timestamp = chrono::Utc::now().to_rfc3339();
  let header = format!(
    "# Test Report\n\n*Generated: {}*\n\n| # | Test | Status | Duration | Error |\n|---|------|--------|----------|-------|\n",
    timestamp
  );
  std::fs::write(&path, header).map_err(|e| e.to_string())?;

  Ok(())
}

/// Append a single test result directly to the test-report.md file.
/// Each call reads the existing markdown, appends the result as a table row, and writes back.
/// This ensures the report is always up-to-date even if the app freezes later.
#[command]
pub fn append_test_result<R: Runtime>(
  #[allow(unused_variables)] app: tauri::AppHandle<R>,
  name: String,
  status: String,
  duration: u64,
  error: Option<String>,
  index: usize,
  total: usize,
) -> Result<(), String> {
  #[cfg(target_env = "ohos")]
  let dir = std::path::PathBuf::from("/data/storage/el2/base/cache");
  #[cfg(not(target_env = "ohos"))]
  let dir = {
    use tauri::Manager;
    app.path().app_cache_dir().map_err(|e| e.to_string())?
  };

  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let path = dir.join("test-report.md");

  // Read existing report
  let content = std::fs::read_to_string(&path).unwrap_or_default();

  // If this is the first result, write header + table header
  let mut output = if content.is_empty() || content.contains("_No tests run yet._") {
    "# Test Report\n\n| # | Test | Status | Duration | Error |\n|---|------|--------|----------|-------|\n".to_string()
  } else {
    content
  };

  // Format status emoji
  let status_icon = match status.as_str() {
    "pass" => "✅",
    "fail" => "❌",
    "skip" => "⏭️",
    _ => "❓",
  };

  // Format error column
  let error_col = error.unwrap_or_default();

  // Append row
  output.push_str(&format!(
    "| {} | {} | {} | {}ms | {} |\n",
    index + 1,
    name,
    status_icon,
    duration,
    error_col
  ));

  // If this is the last result, append summary
  if index + 1 == total {
    output.push_str("\n---\n\n*Report generated at end of test run.*\n");
  }

  std::fs::write(&path, &output).map_err(|e| e.to_string())?;

  Ok(())
}

static WINDOW_SEQ: AtomicU32 = AtomicU32::new(1);
static CONSOLE_LOG_BUFFER: std::sync::Mutex<Vec<String>> = std::sync::Mutex::new(Vec::new());

#[command]
pub fn console_log<R: Runtime>(
  #[allow(unused_variables)] app: tauri::AppHandle<R>,
  level: String,
  message: String,
) -> Result<(), String> {
  let ts = chrono::Local::now().format("%H:%M:%S%.3f");
  let entry = format!("[{}] {} {}", ts, level, message);

  let mut buffer = CONSOLE_LOG_BUFFER.lock().map_err(|e| e.to_string())?;
  buffer.push(entry);

  if buffer.len() > 1000 {
    buffer.remove(0);
  }
  Ok(())
}

#[command]
pub fn flush_console_log<R: Runtime>(
  #[allow(unused_variables)] app: tauri::AppHandle<R>,
) -> Result<String, String> {
  #[cfg(target_env = "ohos")]
  let dir = std::path::PathBuf::from("/data/storage/el2/base/cache");
  #[cfg(not(target_env = "ohos"))]
  let dir = {
    use tauri::Manager;
    app.path().app_cache_dir().map_err(|e| e.to_string())?
  };

  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let path = dir.join("console-log.txt");

  let mut buffer = CONSOLE_LOG_BUFFER.lock().map_err(|e| e.to_string())?;
  if buffer.is_empty() {
    return Ok(path.to_string_lossy().to_string());
  }
  let new_content = buffer.join("\n");
  buffer.clear();

  let existing = if path.exists() {
    std::fs::read_to_string(&path).unwrap_or_default()
  } else {
    String::new()
  };

  let full_content = if existing.is_empty() {
    new_content
  } else {
    format!("{}\n{}", existing, new_content)
  };

  std::fs::write(&path, &full_content).map_err(|e| e.to_string())?;

  Ok(path.to_string_lossy().to_string())
}

#[command]
pub fn clear_console_log<R: Runtime>(
  #[allow(unused_variables)] app: tauri::AppHandle<R>,
) -> Result<String, String> {
  #[cfg(target_env = "ohos")]
  let dir = std::path::PathBuf::from("/data/storage/el2/base/cache");
  #[cfg(not(target_env = "ohos"))]
  let dir = {
    use tauri::Manager;
    app.path().app_cache_dir().map_err(|e| e.to_string())?
  };

  let mut buffer = CONSOLE_LOG_BUFFER.lock().map_err(|e| e.to_string())?;
  buffer.clear();

  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let path = dir.join("console-log.txt");
  std::fs::write(&path, "").map_err(|e| e.to_string())?;

  Ok(path.to_string_lossy().to_string())
}

#[command]
pub fn test_eval<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<()> {
  log::info!("test_eval called");

  if let Some(window) = app.get_webview_window("main") {
    window.eval(r#"document.title = "✅ Eval Success! (From Rust)""#)?;
    window.eval_with_callback(r#"new Date().toLocaleString()"#, move |time_str| {
      log::info!("Current time from JS: {}", time_str);
    })?;
    window.eval(r#"
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;top:50px;right:20px;background:green;color:white;padding:15px;border-radius:5px;z-index:9999;';
      div.textContent = '✅ Eval from Rust!';
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 3000);
    "#)?;
  }

  Ok(())
}

#[command]
pub fn test_local_storage<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<()> {
  log::info!("test_local_storage called");

  if let Some(window) = app.get_webview_window("main") {
    // Test localStorage.setItem
    window.eval_with_callback(
      r#"(function() { try { localStorage.setItem('tauri_test_key', 'hello_from_rust'); return localStorage.getItem('tauri_test_key'); } catch(e) { return 'ERROR:' + e.message; } })()"#,
      move |result| {
        log::info!("localStorage test result from JS: {}", result);
      },
    )?;
  }

  Ok(())
}

/// Test eval_with_callback: evaluates JS and emits result as event for JS test verification
#[command]
pub fn test_eval_with_callback<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<()> {
  log::info!("test_eval_with_callback called");

  if let Some(window) = app.get_webview_window("main") {
    let app_clone = app.clone();
    window.eval_with_callback(
      r#"(function() { return JSON.stringify({arithmetic: 1+2, stringLen: "hello".length, bool: true}); })()"#,
      move |result| {
        log::info!("eval_with_callback result from JS: {}", result);
        let _ = app_clone.emit_str("eval-with-callback-result", result);
      },
    )?;
  }

  Ok(())
}

#[command]
pub fn test_navigate<R: tauri::Runtime>(
  window: tauri::WebviewWindow<R>,
  url: String,
) -> tauri::Result<()> {
  log::info!("test_navigate called with url: {}", url);
  match url.parse() {
    Ok(parsed_url) => {
      window.navigate(parsed_url)?;
    }
    Err(e) => {
      log::error!("Failed to parse URL: {}", e);
    }
  }
  Ok(())
}

#[command]
pub fn test_reload<R: tauri::Runtime>(window: tauri::WebviewWindow<R>) -> tauri::Result<()> {
  log::info!("test_reload called");
  window.reload()?;
  Ok(())
}

#[command]
pub fn create_isolated_window<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
  data_suffix: String,
  url: String,
  // fix-variant M1: optional useHttpsScheme opt-in — the https://<scheme>.localhost
  // intercept URL space only exists inside a use_https webview. Option so the
  // pre-existing callers (which omit it) keep deserializing.
  use_https: Option<bool>,
) -> tauri::Result<String> {
  // Append a unique sequence number to ensure window name is always unique
  let seq = WINDOW_SEQ.fetch_add(1, Ordering::SeqCst);
  let unique_window_id = format!("{}_{}", window_id, seq);
  log::info!(
    "[Rust] create_isolated_window called. window_id={} (unique={}), url={}",
    window_id,
    unique_window_id,
    url
  );

  let mut data_dir = app.path().app_data_dir()?;
  data_dir.push(format!("webview_data_{}_{}", data_suffix, seq));

  // Try to parse as external URL (supports http, https, data, etc.)
  let webview_url = match url::Url::parse(&url) {
    Ok(parsed) => {
      log::info!("[Rust] Parsed as External URL: {}", parsed);
      WebviewUrl::External(parsed)
    }
    Err(e) => {
      log::info!(
        "[Rust] Failed to parse as External, using App URL: {}. Error: {}",
        url,
        e
      );
      WebviewUrl::App(url.into())
    }
  };

  let app_nav = app.clone();
  let app_title = app.clone();
  let app_page = app.clone();

  let init_script = format!(
    "document.addEventListener('DOMContentLoaded', () => {{ \
        let num = {seq}; \
        document.title = num <= 1 ? 'Hello World' : 'Hello World' + num; \
        let h1 = document.querySelector('h1'); \
        if (h1) {{ h1.textContent = num <= 1 ? 'Hello World' : 'Hello World' + num; }} \
      }});"
  );
  // `mut` is consumed by the OHOS-only re-assignment below; on other
  // targets that block is compiled out and the mut would be unused.
  #[allow(unused_mut)]
  let mut builder = tauri::WebviewWindowBuilder::new(&app, &unique_window_id, webview_url)
    .title(format!("Isolated Window: {}", data_suffix))
    .data_directory(data_dir)
    .inner_size(800.0, 600.0)
    .use_https_scheme(use_https.unwrap_or(false));
  #[cfg(target_env = "ohos")]
  {
    builder = builder.ohos_window_kind(tauri::ohos::OHOSWindowKind::SubWindow);
  }
  builder
    .initialization_script(&init_script)
    .on_navigation(move |nav_url| {
      log::info!("Isolated window navigation intercepted: {}", nav_url);
      let _ = app_nav.emit("navigation-intercepted", nav_url.to_string());
      true
    })
    .on_document_title_changed(move |_window, title| {
      log::info!("Isolated window title changed: {}", title);
      let _ = app_title.emit("document-title-changed", &title);
    })
    .on_page_load(move |_webview, payload| {
      log::info!("Isolated window on_page_load");
      let url = payload.url().to_string();
      match payload.event() {
        PageLoadEvent::Started => {
          let _ = app_page.emit("page-load-started", &url);
        }
        PageLoadEvent::Finished => {
          let _ = app_page.emit("page-load-finished", &url);
        }
      }
    })
    .build()?;

  Ok(unique_window_id)
}

#[command]
pub fn dummy_command() -> tauri::Result<()> {
  Ok(())
}

#[cfg(target_env = "ohos")]
#[command]
pub fn get_ohos_version_info() -> serde_json::Value {
  use tauri::ohos::openharmony_ability::version;
  serde_json::json!({
    "sdkApiVersion": version::sdk_api_version(),
    "distributionApiVersion": version::distribution_api_version(),
  })
}

/// Toggles window content protection (issue Eulogizethesun/tauri#115 smoke
/// test). Exposed as a demo command because @tauri-apps/api/window has no
/// `setContentProtection` — on OHOS this reaches
/// `OH_WindowManager_SetWindowPrivacyMode` (window excluded from screenshot/
/// recording/casting); the visual effect is verified manually.
#[command]
pub fn set_content_protection<R: tauri::Runtime>(
  window: tauri::WebviewWindow<R>,
  enabled: bool,
) -> Result<(), String> {
  window
    .set_content_protected(enabled)
    .map_err(|e| e.to_string())
}

static UA_WINDOW_COUNTER: AtomicU32 = AtomicU32::new(0);

#[command]
pub fn create_window_with_custom_ua<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
  user_agent: String,
) -> tauri::Result<()> {
  // Use unique label to avoid conflict when called multiple times
  let counter = UA_WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
  let unique_id = format!("{}-{}", window_id, counter);
  log::info!(
    "Creating window '{}' with custom User-Agent: '{}'",
    unique_id,
    user_agent
  );

  let title = if user_agent.is_empty() {
    "UA Test: Default".to_string()
  } else {
    format!("UA Test: {}", user_agent)
  };

  // Pass expected UA as URL query param so the test page can display it
  let url_path = if user_agent.is_empty() {
    "/useragent-test.html".to_string()
  } else {
    let mut encoded = String::new();
    for byte in user_agent.as_bytes() {
      if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
        encoded.push(*byte as char);
      } else {
        encoded.push_str(&format!("%{:02X}", byte));
      }
    }
    format!("/useragent-test.html?expected={}", encoded)
  };

  let mut builder =
    tauri::WebviewWindowBuilder::new(&app, &unique_id, tauri::WebviewUrl::App(url_path.into()))
      .title(title)
      .inner_size(800.0, 600.0);
  #[cfg(target_env = "ohos")]
  {
    builder = builder.ohos_window_kind(tauri::ohos::OHOSWindowKind::SubWindow);
  }

  if !user_agent.is_empty() {
    builder = builder.user_agent(&user_agent);
  }

  let window = builder.build()?;

  // Emit UA result to frontend so TestRunner UI can display it
  let app_handle = app.clone();
  let wid = unique_id.clone();
  window.eval_with_callback("navigator.userAgent", move |ua| {
    log::info!("[UA-TEST] Window '{}': navigator.userAgent = {}", wid, ua);
    let _ = app_handle.emit(
      "ua-test-result",
      serde_json::json!({ "windowId": wid, "userAgent": ua }),
    );
  })?;

  Ok(())
}

#[command]
pub fn create_window_no_throttle<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
) -> tauri::Result<()> {
  log::info!("Creating window with background throttling disabled");

  use tauri::utils::config::BackgroundThrottlingPolicy;

  #[allow(unused_mut)]
  let mut builder = tauri::WebviewWindowBuilder::new(&app, window_id, WebviewUrl::default())
    .title("Window with No Background Throttling")
    .background_throttling(BackgroundThrottlingPolicy::Disabled)
    .inner_size(800.0, 600.0);
  #[cfg(target_env = "ohos")]
  {
    builder = builder.ohos_window_kind(tauri::ohos::OHOSWindowKind::SubWindow);
  }
  let _window = builder
    .initialization_script(
      r#"
        document.addEventListener('DOMContentLoaded', () => {
          const div = document.createElement('div');
          div.style.padding = '20px';
          div.innerHTML = '<h2>No Background Throttling Test</h2><p>Background timers should continue running even when window is hidden/minimized.</p><p><strong>Note:</strong> Only supported on macOS 14.0+ and iOS 17.0+</p>';
          document.body.appendChild(div);

          let count = 0;
          const counterDiv = document.createElement('div');
          counterDiv.style.padding = '20px';
          counterDiv.style.background = '#f0f0f0';
          counterDiv.style.marginTop = '20px';
          counterDiv.innerHTML = '<p>Timer (updates every second): <strong id="counter">0</strong></p>';
          document.body.appendChild(counterDiv);

          setInterval(() => {
            count++;
            document.getElementById('counter').textContent = count;
          }, 1000);
        });
      "#
    )
    .build()?;

  Ok(())
}

/// Shared close link HTML for test windows.
/// Uses <a href="#close-window"> instead of <button> with onclick handler,
/// because OHOS Web component initialization_script cannot attach JS event listeners.
/// The #close-window URL is intercepted by DefaultWebview.ets onLoadIntercept handler,
/// which destroys the window via WindowManager.destroyWindow().
const CLOSE_LINK_HTML: &str = r##"<a href="http://close-window.invalid/" style="display:inline-block;margin-top:20px;padding:8px 20px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.15);color:#fff;border-radius:8px;text-decoration:none;font-size:14px;cursor:pointer;">✕ Close</a>"##;

/// Shared status display script for child test windows (T3 multi-window isolation).
/// Polls isDecorated() every 500ms and shows live state in a status badge,
/// so testers can visually verify that toggling decorations on the main window
/// does NOT affect child windows.
const STATUS_SCRIPT: &str = r##"
      var statusDiv = document.createElement('div');
      statusDiv.id = 'state-status';
      statusDiv.style.cssText = 'position:fixed;bottom:10px;left:10px;background:rgba(0,0,0,0.8);color:#0f0;padding:8px 14px;border-radius:8px;font-size:13px;font-family:monospace;z-index:9999;';
      statusDiv.textContent = 'isDecorated: checking...';
      document.body.appendChild(statusDiv);
      // Tauri v2 exposes the public invoke at `window.__TAURI__.core.invoke` (not the
      // v1 top-level `window.__TAURI__.invoke`). The low-level bridge
      // `window.__TAURI_INTERNALS__.invoke` is always present and is what the bundled
      // @tauri-apps/api uses (proven to work on OHOS). Resolve whichever is available,
      // and degrade gracefully instead of leaving the badge stuck on "checking...".
      function resolveInvoke() {
        var i = window.__TAURI_INTERNALS__;
        if (i && typeof i.invoke === 'function') return i.invoke.bind(i);
        var t = window.__TAURI__;
        if (t && t.core && typeof t.core.invoke === 'function') return t.core.invoke.bind(t.core);
        return null;
      }
      function setStatus(text, color) {
        var el = document.getElementById('state-status');
        if (el) { el.textContent = text; el.style.color = color; }
      }
      setInterval(function() {
        var inv = resolveInvoke();
        if (!inv) { setStatus('isDecorated: (n/a)', '#888'); return; }
        try {
          // No label arg: get_window() resolves to the current (this child) window.
          inv('plugin:window|is_decorated').then(function(v) {
            setStatus('isDecorated: ' + v, v ? '#0f0' : '#f80');
          }).catch(function() {
            setStatus('isDecorated: (err)', '#f00');
          });
        } catch (e) {
          setStatus('isDecorated: (err)', '#f00');
        }
      }, 500);
"##;

#[command]
pub fn create_transparent_window<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
  effect: Option<String>,
  radius: Option<f64>,
  color: Option<[u8; 4]>,
) -> tauri::Result<()> {
  log::info!(
    "Creating transparent window: {} (effect={:?}, radius={:?})",
    window_id,
    effect,
    radius
  );

  let close_link = CLOSE_LINK_HTML;
  // Autotest-created windows (label prefix "test-") are created and closed
  // programmatically; on OHOS programmatic close doesn't destroy the sub-window
  // (the windowing backend's OHOS Window::close is unimplemented), so a lingering closed popup would
  // poll is_decorated on an unregistered webview → "failed to acquire webview
  // reference". Skip the live isDecorated badge for autotest windows to avoid that
  // noisy error; manual test windows keep the badge (they stay open and work).
  let status_script = if window_id.starts_with("test-") {
    ""
  } else {
    STATUS_SCRIPT
  };
  let init_script = format!(
    r#"
    document.addEventListener('DOMContentLoaded', function() {{
      document.documentElement.style.background = 'transparent';
      document.body.style.cssText = 'background:transparent;margin:0;padding:0;'
        + 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
        + 'min-height:100vh;box-sizing:border-box;font-family:system-ui,sans-serif;';
      document.body.innerHTML = '';
      var div = document.createElement('div');
      div.style.cssText = 'background:rgba(0,0,0,0.6);color:#fff;padding:30px;'
        + 'border-radius:15px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);'
        + 'text-align:center;max-width:80%;';
      div.innerHTML = '<h2>\u{{1FA9F}} Transparent Window</h2>'
        + '<p>This window has transparent background.</p>'
        + '{close_link}';
      document.body.appendChild(div);
      {status_script}
    }});
  "#
  );

  // `mut` is only needed for the desktop effects reassignment below; on mobile the
  // effects block is cfg-gated out so `mut` would be unused. Suppress per-platform.
  #[allow(unused_mut)]
  let mut builder =
    tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
      .title("Transparent Window")
      .transparent(true)
      .inner_size(800.0, 600.0);
  #[cfg(target_env = "ohos")]
  {
    builder = builder.ohos_window_kind(tauri::ohos::OHOSWindowKind::SubWindow);
  }
  builder = builder.initialization_script(&init_script);

  // Optional build-time effects (WindowBuilder::effects path — desktop-only, applied at
  // window creation via registerController inject, distinct from runtime setEffects which
  // uses AttributeUpdater). On non-desktop (OHOS mobile) window effects don't apply; the
  // effect/radius/color params are consumed to avoid unused-variable warnings.
  #[cfg(desktop)]
  {
    if let Some(effect_name) = &effect {
      let effect = match effect_name.as_str() {
        "Blur" => tauri::window::Effect::Blur,
        "Acrylic" => tauri::window::Effect::Acrylic,
        other => {
          return Err(tauri::Error::Anyhow(anyhow::anyhow!(
            "unknown effect: {}",
            other
          )))
        }
      };
      let effects = tauri::utils::config::WindowEffectsConfig {
        effects: vec![effect],
        radius,
        state: None,
        color: color.map(|c| tauri::utils::config::Color(c[0], c[1], c[2], c[3])),
      };
      builder = builder.effects(effects);
    }
  }
  #[cfg(not(desktop))]
  {
    let _ = (&effect, &radius, &color);
  }

  eprintln!(
    "[create_transparent_window] building window: {} effect={:?}",
    window_id, effect
  );
  let _window = builder.build()?;
  eprintln!(
    "[create_transparent_window] build() returned OK for: {}",
    window_id
  );

  Ok(())
}

/// Test command: create a borderless window (decorations=false) to verify
/// Phase 2 implementation. The window should have no title bar, no drag area,
/// and no close button on OHOS.
#[cfg(desktop)]
#[command]
pub fn create_borderless_window<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
) -> tauri::Result<()> {
  log::info!("Creating borderless window: {}", window_id);

  let close_link = CLOSE_LINK_HTML;
  // Autotest-created windows (label prefix "test-") are created and closed
  // programmatically; on OHOS programmatic close doesn't destroy the sub-window
  // (the windowing backend's OHOS Window::close is unimplemented), so a lingering closed popup would
  // poll is_decorated on an unregistered webview → "failed to acquire webview
  // reference". Skip the live isDecorated badge for autotest windows to avoid that
  // noisy error; manual test windows keep the badge (they stay open and work).
  let status_script = if window_id.starts_with("test-") {
    ""
  } else {
    STATUS_SCRIPT
  };
  let init_script = format!(
    r#"
    document.addEventListener('DOMContentLoaded', function() {{
      // Transparent page background: the Set BG color buttons set BOTH the window
      // background (setWindowBackgroundColor) and the webview background (ArkWeb
      // component backgroundColor) — the color is only visible if the page itself
      // doesn't paint an opaque layer on top.
      document.documentElement.style.background = 'transparent';
      document.body.style.cssText = 'background:transparent;margin:0;padding:0;'
        + 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
        + 'min-height:100vh;box-sizing:border-box;font-family:system-ui,sans-serif;color:#fff;'
        + 'text-shadow:0 1px 3px rgba(0,0,0,0.8);';
      document.body.innerHTML = '';
      var div = document.createElement('div');
      div.style.cssText = 'text-align:center;padding:30px;';
      div.innerHTML = '<h2>\u{{1F5BC}}️ Borderless Window</h2>'
        + '<p>This window has <code>decorations: false</code>.</p>'
        + '<p>No title bar, drag area, or close button from the OS.</p>'
        + '{close_link}';
      document.body.appendChild(div);
      {status_script}
    }});
  "#
  );

  let mut builder =
    tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
      .title("Borderless Window")
      .decorations(false)
      .inner_size(800.0, 600.0);
  #[cfg(target_env = "ohos")]
  {
    builder = builder.ohos_window_kind(tauri::ohos::OHOSWindowKind::SubWindow);
  }
  builder = builder.initialization_script(&init_script);

  let _window = builder.build()?;

  Ok(())
}

/// Test command: create a sub-window (`OHOSWindowKind::SubWindow`) WITH decorations (title bar + close button).
/// Used to test setClosable/Maximizable/Minimizable decoration flags (SubWindowPage reads
/// LocalStorage to control button visibility — only visible when decorations=true).
#[cfg(desktop)]
#[command]
pub fn create_decorated_window<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
) -> tauri::Result<()> {
  log::info!("Creating decorated window: {}", window_id);

  let close_link = CLOSE_LINK_HTML;
  let status_script = if window_id.starts_with("test-") {
    ""
  } else {
    STATUS_SCRIPT
  };
  let init_script = format!(
    r#"
    document.addEventListener('DOMContentLoaded', function() {{
      // Transparent page background — see create_borderless_window for rationale.
      document.documentElement.style.background = 'transparent';
      document.body.style.cssText = 'background:transparent;margin:0;padding:0;'
        + 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
        + 'min-height:100vh;box-sizing:border-box;font-family:system-ui,sans-serif;color:#333;';
      document.body.innerHTML = '';
      var div = document.createElement('div');
      div.style.cssText = 'text-align:center;padding:30px;';
      div.innerHTML = '<h2>\u{{1F5BC}}️ Decorated Window</h2>'
        + '<p>This window has <code>decorations: true</code>.</p>'
        + '<p>Title bar + close button visible (SubWindowPage decoration buttons).</p>'
        + '<p>Test setClosable/Maximizable below — close button visibility changes.</p>'
        + '{close_link}';
      document.body.appendChild(div);
      {status_script}
    }});
  "#
  );

  #[allow(unused_mut)]
  let mut builder =
    tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
      .title("Decorated Window")
      .decorations(true)
      .inner_size(600.0, 400.0)
      .initialization_script(&init_script);
  // OHOS-only: force the SubWindow kind so this stays a sub-window (multi-UIAbility is not
  // supported locally — the second UIAbility request is rejected by tao).
  #[cfg(target_env = "ohos")]
  {
    builder = builder.ohos_window_kind(tauri::ohos::OHOSWindowKind::SubWindow);
  }

  let _window = builder.build()?;

  Ok(())
}

/// Test command: create a window in a new UIAbility instance via `startAbility`.
///
/// Requires `launchType: "specified"` + EntryAbilityStage onAcceptWant routing
/// (tauri-window-N keys) in module.json5. The new instance's main window is
/// system-managed (resize/move return 1300002); it loads the WebviewUrl passed
/// here via wry's pending_ops queue once the instance registers its stage
/// (openspec multi-uiability-windows OQ5 — not via want.parameters.url).
#[cfg(target_env = "ohos")]
#[command]
pub fn create_ui_ability_window<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
  transparent: Option<bool>,
) -> tauri::Result<CreateUIAbilityWindowResult> {
  let transparent = transparent.unwrap_or(false);
  log::info!(
    "Creating UIAbility instance window: {} (transparent={})",
    window_id,
    transparent
  );

  use tauri::ohos::OHOSWindowKind;
  use tauri::Manager;

  // Same runtime predicate tao's spawn gate uses (window.rs): on a
  // mobile-form build the gate below rejects the spawn before any pending
  // state is armed. Reported so autotest can distinguish the by-design
  // mobile rejection from a real failure.
  let mobile_form = !openharmony_ability::is_desktop_form();

  let mut builder =
    tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
      .title("UIAbility Instance Window")
      .inner_size(800.0, 600.0)
      .ohos_window_kind(OHOSWindowKind::UIAbility);

  if transparent {
    builder = builder.transparent(true);
  }

  let _window = match builder.build() {
    Ok(w) => w,
    Err(e) => {
      log::error!("create_ui_ability_window build failed: {:?}", e);
      // Mobile form: this is the desktop-only gate rejecting the spawn
      // (fail-fast, zero residue). Return a structured marker instead of Err
      // so autotest records a skip on mobile, while a DESKTOP build failure
      // still surfaces (webview_acquired=false + mobile_form=false fails the
      // test's assertion).
      let mobile_fail_fast = if mobile_form {
        Some(e.to_string())
      } else {
        None
      };
      return Ok(CreateUIAbilityWindowResult {
        label: window_id.clone(),
        webview_acquired: false,
        all_webview_labels: vec![],
        mobile_form,
        mobile_fail_fast,
      });
    }
  };

  // Verify the webview window was registered and is acquirable by label.
  // get_webview_window uses the same manager lookup as IPC's get_webview.
  let webview_acquired = app.get_webview_window(&window_id).is_some();
  let all_labels: Vec<String> = app.webview_windows().keys().cloned().collect();
  let main_exists = app.get_webview_window("main").is_some();
  log::info!(
    "[create_ui_ability_window] webview_acquired={}, label={}, main_exists={}, all_labels={:?}",
    webview_acquired,
    window_id,
    main_exists,
    all_labels
  );

  // 3.7 evidence (openspec multi-uiability-windows): fire deep-link get_current +
  // get_current_window_id from the spawned instance's webview once it settles.
  // commands inject the CALLING window, so these must resolve this window's
  // pre-allocated UIAbility id (>0) and lazy-take ITS OWN INITIAL_WANT_URI
  // partition (design.md D9), visible as "[deep-link] get_current_for_window(label=...,
  // id=N)" in hilog. Must go through __TAURI_INTERNALS__.invoke — a raw fetch to
  // tauri://localhost/ is served the index.html asset, not routed through the IPC
  // handler (verified on device 2026-09-14). Retried on a detached thread because
  // the spawned webview finishes loading asynchronously (build() is non-blocking
  // on OHOS).
  let probe_window = _window.clone();
  // 4.3 evidence (openspec multi-uiability-windows, design.md D5): tao now keys
  // GainedFocus/LostFocus by the originating UIAbility window id, and tauri
  // emits tauri://focus / tauri://blur through emit_to_window — which delivers
  // ONLY to EventTarget::Window{label}/WebviewWindow{label} (kind "Any" would
  // NOT receive them). The focus probe installs listeners in BOTH the spawned
  // window and the main window: switching focus must fire blur on the window
  // losing focus and focus on the window gaining it, and the pre-Phase-4
  // phantom shape (main logging blur-then-focus while the spawned window takes
  // focus, because both events were hardcoded to window 0) must be gone.
  let main_probe_window = app.get_webview_window("main");
  std::thread::spawn(move || {
    const PROBE_DELAYS_MS: [u64; 3] = [1500, 3000, 5000];
    let js = r#"(function(){
      function log(m){ console.log('[deep-link-probe] ' + m) }
      try {
        window.__TAURI_INTERNALS__.invoke('get_current_window_id')
          .then(function(r){ log('window_id=' + JSON.stringify(r)) })
          .catch(function(e){ log('wid-err: ' + e) });
        window.__TAURI_INTERNALS__.invoke('plugin:deep-link|get_current')
          .then(function(r){ log('deep_link=' + JSON.stringify(r)) })
          .catch(function(e){ log('dl-err: ' + e) });
      } catch (e) { log('no-internals: ' + e) }
    })()"#;
    let focus_js = r#"(function(){
      function log(m){ console.log('[focus-probe] ' + m) }
      if (window.__FOCUS_PROBE_INSTALLED__) { return; }
      window.__FOCUS_PROBE_INSTALLED__ = true;
      try {
        var label = window.__TAURI_INTERNALS__.metadata.currentWindow.label;
        log('installing focus listeners for label=' + label);
        ['tauri://focus','tauri://blur'].forEach(function(ev){
          window.__TAURI_INTERNALS__.invoke('plugin:event|listen', {
            event: ev,
            target: { kind: 'Window', label: label },
            handler: window.__TAURI_INTERNALS__.transformCallback(function(){
              log((ev === 'tauri://focus' ? 'FOCUS' : 'BLUR') + ' label=' + label);
            })
          }).then(function(id){ log('listener installed: ' + ev + ' id=' + id) })
            .catch(function(e){ log('listen-err ' + ev + ': ' + e) });
        });
      } catch (e) { log('no-internals: ' + e) }
    })()"#;
    for delay in PROBE_DELAYS_MS {
      std::thread::sleep(std::time::Duration::from_millis(delay));
      // A failed eval (webview not yet loaded, or window already closed by the
      // time a later round fires) must not abort the remaining retries.
      if let Err(e) = probe_window.eval(js) {
        log::warn!(
          "[create_ui_ability_window] deep-link probe eval failed: {:?}",
          e
        );
      }
      if let Err(e) = probe_window.eval(focus_js) {
        log::warn!(
          "[create_ui_ability_window] spawned focus probe eval failed: {:?}",
          e
        );
      }
      if let Some(main) = &main_probe_window {
        if let Err(e) = main.eval(focus_js) {
          log::warn!(
            "[create_ui_ability_window] main focus probe eval failed: {:?}",
            e
          );
        }
      }
    }
  });

  // tao's desktop-only spawn gate records its rejection under the window
  // label before returning Err — runtime-wry's `Message::CreateWindow`
  // dispatch has no reply channel (upstream design: the Err is logged then
  // dropped), so on mobile `builder.build()` resolves Ok and the manager
  // registers a label-only zombie window (webview_acquired=true, no OS
  // window). Consuming the trace here is the only way the API layer sees
  // the mobile fail-fast; a None on desktop is the normal no-trace path.
  let mobile_fail_fast = if mobile_form {
    openharmony_ability::take_ui_ability_spawn_rejection(&window_id)
  } else {
    None
  };

  Ok(CreateUIAbilityWindowResult {
    label: window_id.clone(),
    webview_acquired,
    all_webview_labels: all_labels,
    mobile_form,
    mobile_fail_fast,
  })
}

/// Result of create_ui_ability_window_racy_attrs (issue-7 repro command).
#[cfg(target_env = "ohos")]
#[derive(serde::Serialize)]
pub struct CreateUIAbilityWindowRacyAttrsResult {
  /// The window label passed to the command.
  pub label: String,
  /// Whether manager.get_webview_window(label) succeeded after build.
  pub webview_acquired: bool,
  /// The pre-allocated OHOS window id for this spawned instance, for hilog
  /// correlation (0 when the label registry has no entry yet).
  pub ohos_window_id: i64,
  /// Runtime device-form query — see CreateUIAbilityWindowResult::mobile_form.
  /// On a mobile-form build the spawn fails fast (desktop-only gate) and
  /// autotest records a skip instead of running the issue-7 assertions.
  pub mobile_form: bool,
  /// Error text when the desktop-only gate rejected the spawn on a
  /// mobile-form build; None otherwise.
  pub mobile_fail_fast: Option<String>,
}

/// Issue-7 reproduction (doc/OHOS窗口遗留问题.md issue 7): creation-time window
/// attributes on a spawned UIAbility window race the new instance's stage
/// registration. `start_ui_ability` is fire-and-forget, and the builder's
/// decorations / min-size plus an immediate post-build setter are dispatched
/// right away — they reach ArkTS before `registerUIAbilityStage`, so
/// `requireWindow` throws "Unknown OS sub-window '<id>'" and tao drops them
/// with a warn. Fix verification (doc issue-7 checklist): the warns disappear
/// and the window renders borderless with a 400×300 resize floor.
#[cfg(target_env = "ohos")]
#[command]
pub fn create_ui_ability_window_racy_attrs<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
) -> tauri::Result<CreateUIAbilityWindowRacyAttrsResult> {
  use tauri::ohos::OHOSWindowKind;

  log::info!(
    "Creating UIAbility instance window with racy attrs: {}",
    window_id
  );

  // Same runtime predicate tao's spawn gate uses — see the comment in
  // create_ui_ability_window.
  let mobile_form = !openharmony_ability::is_desktop_form();

  #[allow(unused_mut)] // `.decorations()` below is cfg(desktop)-only
  let mut builder =
    tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
      .title("UIAbility Racy Attrs Window")
      // Creation-time geometry: consumed by the spawned-UIAbility path via
      // startAbility StartOptions (tao#26 review follow-up F5) — asserted by the
      // window-ops racy-attrs case (outer size/position readback after settle).
      .inner_size(700.0, 500.0)
      .position(90.0, 70.0)
      .min_inner_size(400.0, 300.0)
      .ohos_window_kind(OHOSWindowKind::UIAbility);
  // `.decorations()` on the builder is a desktop-only API (cfg(desktop) impl
  // block in tauri — the first mobile-form build surfaced it). On a mobile
  // form the spawn is rejected by the desktop-only gate anyway, so the
  // attribute only matters where it compiles.
  #[cfg(desktop)]
  {
    builder = builder.decorations(false);
  }

  let window = match builder.build() {
    Ok(w) => w,
    Err(e) => {
      log::error!("create_ui_ability_window_racy_attrs build failed: {:?}", e);
      // Mobile form: the desktop-only gate rejected the spawn (fail-fast).
      // Structured marker → autotest skip; desktop failure still fails.
      let mobile_fail_fast = if mobile_form {
        Some(e.to_string())
      } else {
        None
      };
      return Ok(CreateUIAbilityWindowRacyAttrsResult {
        label: window_id,
        webview_acquired: false,
        ohos_window_id: 0,
        mobile_form,
        mobile_fail_fast,
      });
    }
  };

  // The generalized form of the race (doc issue 7): a setter fired immediately
  // after build() hits the same pre-registration window. `set_decorations` is
  // a desktop-only API (cfg(desktop) impl block in tauri); on a mobile form
  // the Err arm above already returned (desktop-only gate), so the setter
  // only runs where it exists.
  #[cfg(desktop)]
  window.set_decorations(false)?;
  #[cfg(not(desktop))]
  let _ = window;

  let webview_acquired = app.get_webview_window(&window_id).is_some();
  let ohos_window_id = openharmony_ability::window_id_for_label(&window_id);
  log::info!(
    "[create_ui_ability_window_racy_attrs] label={} acquired={} ohos_id={} — verify no \
     'Unknown OS sub-window' warn in hilog and a borderless window with a 400x300 floor",
    window_id,
    webview_acquired,
    ohos_window_id
  );

  // Consume tao's mobile gate trace — see the comment in
  // create_ui_ability_window (runtime-wry swallows the gate's Err, so an Ok
  // build on mobile may still be a rejected spawn: label-only zombie).
  let mobile_fail_fast = if mobile_form {
    openharmony_ability::take_ui_ability_spawn_rejection(&window_id)
  } else {
    None
  };

  Ok(CreateUIAbilityWindowRacyAttrsResult {
    label: window_id,
    webview_acquired,
    ohos_window_id,
    mobile_form,
    mobile_fail_fast,
  })
}

/// Result of create_float_window_racy_attrs (sub-window creation-race repro command).
#[cfg(target_env = "ohos")]
#[derive(serde::Serialize)]
pub struct CreateFloatWindowRacyAttrsResult {
  /// The window label passed to the command.
  pub label: String,
  /// Whether manager.get_webview_window(label) succeeded after build.
  pub webview_acquired: bool,
  /// The pre-allocated OHOS window id for this sub-window, for hilog
  /// correlation (0 when the label registry has no entry yet).
  pub ohos_window_id: i64,
}

/// SubWindow creation-race reproduction (doc/OHOS窗口遗留问题.md issue-7 addendum):
/// `create_os_window` pre-allocates the window id Rust-side and fire-and-forgets
/// the ArkTS `WindowManager.createSubWindow` chain (createSubWindowWithOptions
/// → loadContentByName → SubWindowPage load), so any window op dispatched right
/// after `build()` — here an immediate `set_size` — reaches ArkTS before the
/// window is registered in `WindowManager.windows`, `requireWindow` throws
/// "Unknown OS sub-window '<id>'" and the op is silently lost (the 22-warn
/// family). Fix verification: the pending-float handshake queues the op and
/// replays it after `notifyFloatWindowRegistered`, so the 260×180 logical
/// resize must stick (read back ≠ the 500×400 builder size).
#[cfg(target_env = "ohos")]
#[command]
pub fn create_float_window_racy_attrs<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
) -> tauri::Result<CreateFloatWindowRacyAttrsResult> {
  use tauri::ohos::OHOSWindowKind;

  log::info!("Creating sub-window with racy attrs: {}", window_id);

  #[allow(unused_mut)] // `.decorations()` below is cfg(desktop)-only
  let mut builder =
    tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
      .title("SubWindow Racy Attrs Window")
      .inner_size(500.0, 400.0)
      .ohos_window_kind(OHOSWindowKind::SubWindow);
  // `.decorations()` on the builder is a desktop-only API (see the UIAbility
  // racy command above); SubWindowPage renders its own chrome either way.
  #[cfg(desktop)]
  {
    builder = builder.decorations(false);
  }

  let window = builder.build()?;

  // The generalized form of the race: a setter fired immediately after
  // build() hits the same pre-registration window. Dispatched from the Rust
  // side on purpose — a JS-side setSize would race the tauri IPC layer
  // (window-not-found) instead of the ArkTS registration.
  window.set_size(tauri::LogicalSize::new(260.0, 180.0))?;

  let webview_acquired = app.get_webview_window(&window_id).is_some();
  let ohos_window_id = openharmony_ability::window_id_for_label(&window_id);
  log::info!(
    "[create_float_window_racy_attrs] label={} acquired={} ohos_id={} — verify no \
     'Unknown OS sub-window' warn in hilog and outer size 260x180 logical after settle",
    window_id,
    webview_acquired,
    ohos_window_id
  );

  Ok(CreateFloatWindowRacyAttrsResult {
    label: window_id,
    webview_acquired,
    ohos_window_id,
  })
}

/// Diagnostic result returned by create_transparent_ui_ability_window for automated tests.
#[cfg(target_env = "ohos")]
#[derive(serde::Serialize)]
pub struct CreateTransparentWindowResult {
  /// The window label actually used (test-transparent-<window_id> unless prefixed).
  pub label: String,
  /// The window_id passed to the command.
  pub window_id: String,
  /// Whether manager.get_webview_window(label) succeeded after build.
  pub webview_acquired: bool,
  /// All webview labels currently registered in the manager.
  pub all_webview_labels: Vec<String>,
  /// Runtime device-form query — see CreateUIAbilityWindowResult::mobile_form.
  /// On a mobile-form build the spawn fails fast (desktop-only gate) and
  /// autotest records a skip instead of the acquired assertion.
  pub mobile_form: bool,
  /// Error text when the desktop-only gate rejected the spawn on a
  /// mobile-form build; None otherwise.
  pub mobile_fail_fast: Option<String>,
}

/// Create a UIAbility instance with a transparent main window (builder.transparent(true))
/// loading the dedicated transparent-test.html page. The page self-drives a test
/// sequence on load (see transparent-test.html runTestSequence).
///
/// label uses `test-` prefix to match ACL run-app.json windows: [test-*], so the
/// new instance's webview can call plugin:window|* commands (setBackgroundColor etc).
/// transparent=true flows: windowing backend → start_ui_ability → want.parameters['ohos_transparent']
/// → new instance onWindowStageCreate → registerUIAbilityStage(transparent=true)
/// → setWindowContainerColor('#00000000','#FFFFFFFF') (active=transparent, inactive=white).
///
/// Returns diagnostics (webview_acquired, all_webview_labels) so autotest can assert
/// the communication path without listening to cross-window events.
#[cfg(target_env = "ohos")]
#[command]
pub fn create_transparent_ui_ability_window<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
) -> tauri::Result<CreateTransparentWindowResult> {
  let label = if window_id.starts_with("test-") {
    window_id.clone()
  } else {
    format!("test-transparent-{}", window_id)
  };
  log::info!("Creating transparent UIAbility: {}", label);

  use tauri::ohos::OHOSWindowKind;
  use tauri::Manager;

  // Same runtime predicate tao's spawn gate uses — see the comment in
  // create_ui_ability_window.
  let mobile_form = !openharmony_ability::is_desktop_form();

  let _window = match tauri::WebviewWindowBuilder::new(
    &app,
    &label,
    WebviewUrl::App("transparent-test.html".into()),
  )
  .title("Transparent Test (UIAbility)")
  .transparent(true)
  .inner_size(800.0, 600.0)
  .ohos_window_kind(OHOSWindowKind::UIAbility)
  .build()
  {
    Ok(w) => w,
    Err(e) => {
      log::error!("create_transparent_ui_ability_window build failed: {:?}", e);
      // Mobile form: the desktop-only gate rejected the spawn (fail-fast).
      // Structured marker → autotest skip; desktop failure still fails.
      let mobile_fail_fast = if mobile_form {
        Some(e.to_string())
      } else {
        None
      };
      return Ok(CreateTransparentWindowResult {
        label,
        window_id,
        webview_acquired: false,
        all_webview_labels: vec![],
        mobile_form,
        mobile_fail_fast,
      });
    }
  };

  let acquired = app.get_webview_window(&label).is_some();
  let all_labels: Vec<String> = app.webview_windows().keys().cloned().collect();
  log::info!(
    "[create_transparent_ui_ability_window] launched, label={}, acquired={}",
    label,
    acquired
  );

  // Consume tao's mobile gate trace — see the comment in
  // create_ui_ability_window (runtime-wry swallows the gate's Err, so an Ok
  // build on mobile may still be a rejected spawn: label-only zombie).
  let mobile_fail_fast = if mobile_form {
    openharmony_ability::take_ui_ability_spawn_rejection(&label)
  } else {
    None
  };

  Ok(CreateTransparentWindowResult {
    label,
    window_id,
    webview_acquired: acquired,
    all_webview_labels: all_labels,
    mobile_form,
    mobile_fail_fast,
  })
}

/// Emits a START anchor into hilog for the verification script to delineate a test run.
#[cfg(target_env = "ohos")]
#[command]
pub fn transparent_test_start(window_id: String) -> tauri::Result<()> {
  log::info!("[TRANSP-TEST] START window_id={}", window_id);
  Ok(())
}

/// Runtime device-form query — the same predicate tao's UIAbility spawn gate
/// and the cmd.rs mobile_fail_fast markers use
/// (`openharmony_ability::is_desktop_form`, compiled per OHOS_DEVICE_TYPE).
/// Autotest calls this once at suite start to skip desktop-only cases on a
/// mobile-form build (menu/tray are desktop-form features — lib.rs only
/// initialises them under cfg(desktop); many core window commands are
/// upstream cfg(desktop) and absent from the mobile .so, where each invoke
/// would fail with "Plugin not found: window") instead of letting them
/// surface as false failures on the mobile baseline.
#[cfg(target_env = "ohos")]
#[derive(serde::Serialize)]
pub struct DeviceFormResult {
  pub mobile_form: bool,
}

#[cfg(target_env = "ohos")]
#[command]
pub fn get_device_form() -> tauri::Result<DeviceFormResult> {
  let mobile_form = !openharmony_ability::is_desktop_form();
  log::info!("[get_device_form] mobile_form={}", mobile_form);
  Ok(DeviceFormResult { mobile_form })
}

/// Test hook (openspec multi-uiability-windows test-plan §3): returns the calling
/// window's pre-allocated UIAbility window id. Resolves the webview label through
/// the same registry deep-link uses (design.md D9), so a page can read back its
/// own instance id — the primary window and never-spawned labels resolve to 0.
#[cfg(target_env = "ohos")]
#[derive(serde::Serialize)]
pub struct CurrentWindowIdResult {
  pub label: String,
  pub window_id: i64,
}

#[cfg(target_env = "ohos")]
#[command]
pub fn get_current_window_id<R: tauri::Runtime>(
  window: tauri::Window<R>,
) -> tauri::Result<CurrentWindowIdResult> {
  let label = window.label().to_string();
  let window_id = openharmony_ability::window_id_for_label(&label);
  log::info!(
    "[get_current_window_id] label={} -> id={}",
    label,
    window_id
  );
  Ok(CurrentWindowIdResult { label, window_id })
}

/// Diagnostic result returned by create_ui_ability_window for automated tests.
#[cfg(target_env = "ohos")]
#[derive(serde::Serialize)]
pub struct CreateUIAbilityWindowResult {
  /// The window label passed to the command.
  pub label: String,
  /// Whether manager.get_webview(label) succeeded after build.
  pub webview_acquired: bool,
  /// All webview labels currently registered in the manager.
  pub all_webview_labels: Vec<String>,
  /// Runtime device-form query (`openharmony_ability::is_desktop_form`):
  /// true on a mobile-form build, where spawning additional UIAbility windows
  /// is desktop-only by design (multi-uiability-windows OQ1) and tao rejects
  /// the creation up front (fail-fast) instead of leaving a forever-pending
  /// instance. Lets tests tell the expected mobile rejection (skip) apart
  /// from a desktop failure or a mobile gate regression (both fail loudly).
  pub mobile_form: bool,
  /// Error text when tao rejected the spawn on a mobile-form build (the
  /// desktop-only gate). None on desktop, and None on a mobile-form build
  /// whose spawn unexpectedly SUCCEEDED (gate regression — test must fail).
  pub mobile_fail_fast: Option<String>,
}

/// Test command: create 3 UIAbility instance windows in sequence, returning
/// the webview_acquired result for each. Reproduces "multiple creates →
/// failed to acquire webview reference" in a single invoke (no dependency on
/// the test runner reaching windowOpsTests).
#[cfg(target_env = "ohos")]
#[command]
pub fn create_ui_ability_windows_x3<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
) -> tauri::Result<Vec<CreateUIAbilityWindowResult>> {
  use tauri::ohos::OHOSWindowKind;
  use tauri::Manager;

  // Same runtime predicate tao's spawn gate uses — see the comment in
  // create_ui_ability_window.
  let mobile_form = !openharmony_ability::is_desktop_form();

  let mut results = Vec::new();
  for i in 1..=3 {
    // "test-" prefix matches the run-app capability window patterns ([test-*]) so
    // the spawned instance's webview is allowed to invoke commands (the x3 IPC
    // trigger below depends on it).
    let window_id = format!(
      "test-x3-{}-{}",
      std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis(),
      i
    );
    log::info!("[x3] Creating UIAbility instance #{}: {}", i, window_id);

    let builder =
      tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
        .title("UIAbility Instance Window")
        .inner_size(800.0, 600.0)
        .ohos_window_kind(OHOSWindowKind::UIAbility);

    match builder.build() {
      Ok(w) => {
        let acquired = app.get_webview_window(&window_id).is_some();
        let all_labels: Vec<String> = app.webview_windows().keys().cloned().collect();
        log::info!(
          "[x3] #{} webview_acquired={}, label={}, all_labels={:?}",
          i,
          acquired,
          window_id,
          all_labels
        );

        // Trigger an IPC from the new webview to verify its label is registered
        // correctly — via the page's own invoke channel, NOT a raw fetch to
        // tauri://localhost/ (the URI scheme handler serves that URL as the
        // index.html asset, so a fetch never exercises the IPC path). The init
        // script that defines __TAURI_INTERNALS__ rides in the webview
        // creation options, so it is present in spawned-instance webviews
        // too. If the webview's label isn't in the manager, this invoke
        // fails with "failed to acquire webview reference"; dummy_command is
        // a registered no-op, so a clean resolve means the label resolved.
        let ipc_js = r#"window.__TAURI_INTERNALS__.invoke('dummy_command').catch(e=>console.error('IPC invoke failed: '+e))"#;
        if let Err(e) = w.eval(ipc_js) {
          log::error!("[x3] #{} eval (IPC trigger) failed: {:?}", i, e);
        }

        // Consume tao's mobile gate trace — see the comment in
        // create_ui_ability_window (runtime-wry swallows the gate's Err, so
        // an Ok build on mobile may still be a rejected spawn).
        let mobile_fail_fast = if mobile_form {
          openharmony_ability::take_ui_ability_spawn_rejection(&window_id)
        } else {
          None
        };

        results.push(CreateUIAbilityWindowResult {
          label: window_id,
          webview_acquired: acquired,
          all_webview_labels: all_labels,
          mobile_form,
          mobile_fail_fast,
        });
      }
      Err(e) => {
        log::error!("[x3] #{} build failed: {:?}", i, e);
        // Same structured-marker contract as create_ui_ability_window: a
        // mobile-form build fails fast at the desktop-only gate (skip in
        // autotest); desktop failures surface as webview_acquired=false.
        let mobile_fail_fast = if mobile_form {
          Some(e.to_string())
        } else {
          None
        };
        results.push(CreateUIAbilityWindowResult {
          label: window_id,
          webview_acquired: false,
          all_webview_labels: vec![],
          mobile_form,
          mobile_fail_fast,
        });
      }
    }
    std::thread::sleep(std::time::Duration::from_millis(500));
  }
  Ok(results)
}

/// Test command: create a transparent + borderless window (decorations=false + transparent=true)
/// to verify Phase 1 + Phase 2 + Phase 3 combined implementation.
#[cfg(desktop)]
#[command]
pub fn create_transparent_borderless_window<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
) -> tauri::Result<()> {
  log::info!("Creating transparent borderless window: {}", window_id);

  let close_link = CLOSE_LINK_HTML;
  // Autotest-created windows (label prefix "test-") are created and closed
  // programmatically; on OHOS programmatic close doesn't destroy the sub-window
  // (the windowing backend's OHOS Window::close is unimplemented), so a lingering closed popup would
  // poll is_decorated on an unregistered webview → "failed to acquire webview
  // reference". Skip the live isDecorated badge for autotest windows to avoid that
  // noisy error; manual test windows keep the badge (they stay open and work).
  let status_script = if window_id.starts_with("test-") {
    ""
  } else {
    STATUS_SCRIPT
  };
  let init_script = format!(
    r#"
    document.addEventListener('DOMContentLoaded', function() {{
      document.documentElement.style.background = 'transparent';
      document.body.style.cssText = 'background:transparent;margin:0;padding:0;'
        + 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
        + 'min-height:100vh;box-sizing:border-box;font-family:system-ui,sans-serif;';
      document.body.innerHTML = '';
      var div = document.createElement('div');
      div.style.cssText = 'background:rgba(0,0,0,0.5);color:#fff;padding:30px;'
        + 'border-radius:15px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);'
        + 'text-align:center;max-width:80%;';
      div.innerHTML = '<h2>\u{{2728}} Transparent + Borderless</h2>'
        + '<p><code>decorations: false</code> + <code>transparent: true</code></p>'
        + '<p>Background should be see-through AND no title bar.</p>'
        + '{close_link}';
      document.body.appendChild(div);
      {status_script}
    }});
  "#
  );

  let mut builder =
    tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
      .title("Transparent Borderless")
      .transparent(true)
      .decorations(false);
  #[cfg(target_env = "ohos")]
  {
    builder = builder.ohos_window_kind(tauri::ohos::OHOSWindowKind::SubWindow);
  }
  builder = builder
    .inner_size(800.0, 600.0)
    .initialization_script(&init_script);

  let _window = builder.build()?;

  Ok(())
}

/// Returns the total count of webview windows currently registered (including main).
/// Used by the close_all_test_windows diagnostic test to verify cleanup.
#[command]
pub fn count_webview_windows<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<usize> {
  Ok(app.webview_windows().len())
}

/// Close all webview windows except the main window. Used by the TestRunner
/// "Close All Test Windows" button to clean up windows opened during a test
/// run (SubWindow sub-windows, UIAbility instances, isolated/UA/custom-ua/no-throttle
/// windows, etc.).
///
/// On OHOS, `WebviewWindow::close()` only removes the window from Rust's manager
/// — the windowing backend's `Window::close` is a no-op on OHOS and does NOT call ArkTS
/// `destroyWindow()`, so the system window stays visible on screen. To actually
/// destroy the system window, we must explicitly call `destroy_window` (which
/// dispatches to ArkTS `WindowManager.closeWindow`):
/// - SubWindow sub-window: `win.destroyWindow()` (real destroy, removes from screen).
/// - UIAbility main window: `hideAbility()` (background — OHOS doesn't allow
///   programmatic Ability kill; instance stays in recent tasks but invisible).
///
/// Returns the list of labels that were attempted to close (for UI feedback).
#[command]
pub fn close_all_test_windows<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
) -> tauri::Result<Vec<String>> {
  let labels: Vec<String> = app
    .webview_windows()
    .keys()
    .filter(|k| k.as_str() != "main")
    .cloned()
    .collect();
  let mut closed: Vec<String> = Vec::new();
  for label in &labels {
    if let Some(w) = app.get_webview_window(label) {
      log::info!("[close_all_test_windows] closing {}", label);

      // w.close() → on_close_requested → on_window_close. On OHOS, on_window_close
      // calls destroy_window (NAPI→ArkHelper.closeWindow) to actually destroy the
      // OS window (the windowing backend's close/destroy are no-ops on OHOS). On other platforms,
      // close() handles real destruction directly.
      match w.close() {
        Ok(_) => closed.push(label.clone()),
        Err(e) => log::warn!("[close_all_test_windows] close {} failed: {:?}", label, e),
      }
    }
  }
  log::info!(
    "[close_all_test_windows] attempted {} windows, closed {}",
    labels.len(),
    closed.len()
  );
  Ok(closed)
}

/// Test command for app_handle.emit
#[command]
pub fn emit_test_event<R: Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<()> {
  app.emit("test-emit-event", "hello from rust")
}

/// Test command for app_handle.listen
#[command]
pub fn setup_app_listener<R: Runtime + 'static>(app: tauri::AppHandle<R>) -> tauri::Result<()> {
  let app_clone = app.clone();
  app.listen("app-listen-test", move |_event| {
    log::info!("Received app-listen-test via app.listen");
    let _ = app_clone.emit("app-listen-response", "heard you");
  });
  Ok(())
}

/// Test command for tauri::async_runtime::spawn
#[command]
pub fn test_async_spawn<R: Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<()> {
  tauri::async_runtime::spawn(async move {
    // Simulate some async work
    let _ = app.emit("spawn-completed", "async done");
  });
  Ok(())
}

/// Test command for web_page_snapshot on OHOS.
///
/// Emits `web-page-snapshot-result` with a base64 PNG + dimensions so the
/// frontend can render the snapshot onto a canvas (Image + drawImage). Uses
/// `capture_webview` rather than `web_page_snapshot` because the latter omits
/// the pixel buffer for NAPI efficiency and cannot drive putImageData.
#[command]
pub fn test_web_page_snapshot<R: Runtime>(
  app: tauri::AppHandle<R>,
  window: tauri::WebviewWindow<R>,
) -> tauri::Result<()> {
  log::info!("test_web_page_snapshot called");

  #[cfg(target_env = "ohos")]
  {
    let app_clone = app.clone();
    window.with_webview(move |w| {
      let handle = w.inner();
      tauri::async_runtime::spawn(async move {
        // Use capture_webview (base64 PNG) rather than web_page_snapshot (RGBA bytes):
        // the latter deliberately omits the pixel buffer for NAPI efficiency, so the
        // frontend cannot putImageData from it. capture_webview returns a ready-to-render
        // PNG that the frontend draws onto the canvas via Image + drawImage.
        match handle.capture_webview().await {
          Ok(resp) => {
            log::info!(
              "capture_webview success: {}x{} ({} base64 chars)",
              resp.width,
              resp.height,
              resp.png_base64.len()
            );
            let _ = app_clone.emit(
              "web-page-snapshot-result",
              serde_json::json!({
                "success": true,
                "width": resp.width,
                "height": resp.height,
                "png_base64": resp.png_base64,
              }),
            );
          }
          Err(e) => {
            log::error!("capture_webview failed: {}", e);
            let _ = app_clone.emit(
              "web-page-snapshot-result",
              serde_json::json!({
                "success": false,
                "error": e.to_string(),
              }),
            );
          }
        }
      });
    })?;
  }

  #[cfg(not(target_env = "ohos"))]
  {
    let _ = window;
    let _ = app.emit(
      "web-page-snapshot-result",
      serde_json::json!({
        "success": false,
        "error": "web_page_snapshot only available on OHOS",
      }),
    );
  }

  Ok(())
}

/// Test command for webview.create_pdf (OHOS only)
#[cfg(target_env = "ohos")]
#[command]
pub fn test_create_pdf<R: Runtime>(
  app: tauri::AppHandle<R>,
  path: Option<String>,
  config: Option<tauri::PdfConfig>,
) -> tauri::Result<()> {
  let path = path.unwrap_or_else(|| "/data/storage/el2/base/cache/test.pdf".to_string());
  log::info!("test_create_pdf called, path={}", path);

  #[cfg(target_env = "ohos")]
  {
    if let Some(window) = app.get_webview_window("main") {
      let app_clone = app.clone();

      let path_for_cb = path.clone();
      window.create_pdf(&path, config, move |success| {
        log::info!(
          "create_pdf callback: success={}, path={}",
          success,
          path_for_cb
        );
        let _ = app_clone.emit("create-pdf-result", format!("{}:{}", success, path_for_cb));
      })?;
    } else {
      let _ = app.emit("create-pdf-result", "false:window not found");
    }
  }

  #[cfg(not(target_env = "ohos"))]
  {
    let _ = (config);
    let _ = app.emit(
      "create-pdf-result",
      "false:createPdf only supported on OHOS",
    );
  }

  Ok(())
}

/// Sentry: trigger a Rust panic to test sentry panic capture
#[cfg(debug_assertions)]
#[command]
pub fn sentry_test_panic() {
  panic!("sentry test panic from examples/api");
}

/// Sentry: add a breadcrumb from Rust to test breadcrumb sync
#[command]
pub fn sentry_test_breadcrumb() {
  sentry::add_breadcrumb(sentry::Breadcrumb {
    message: Some("test breadcrumb from examples/api".to_owned()),
    category: Some("test".to_owned()),
    level: sentry::Level::Info,
    ..Default::default()
  });
  log::info!("[sentry] breadcrumb added from Rust");
}

// ─── Download Test Mode ───
// Controls the behavior of the on_download handler for manual testing scenarios.

#[derive(Debug, Clone, PartialEq, serde::Deserialize, Default)]
pub enum DownloadTestMode {
  #[default]
  Default,
  CustomDir,
  ConfirmAllow,
  BlockFileType,
  ProgressTracking,
  AuditLog,
  AutoRename,
  CancelAll,
}

pub struct DownloadTestState {
  pub mode: Mutex<DownloadTestMode>,
}

impl DownloadTestState {
  pub fn new() -> Self {
    Self {
      mode: Mutex::new(DownloadTestMode::Default),
    }
  }
}

#[command]
pub fn set_download_test_mode<R: Runtime>(
  app: tauri::AppHandle<R>,
  mode: DownloadTestMode,
) -> tauri::Result<()> {
  let state = app.state::<DownloadTestState>();
  let mut current = state.mode.lock().unwrap();
  log::info!("[DownloadTest] Mode set to: {:?}", mode);
  *current = mode;
  Ok(())
}

/// Exercise the webview cookie APIs (set / get-for-url / get-all / delete)
/// to verify OHOS cookie management end-to-end. Returns a JSON report.
///
/// Covers Phase 1 (p1-webview-cookie) device verification scenarios:
/// - set_cookie round-trip via `WebCookieManager.configCookieSync`
/// - cookies_for_url reads the cookie back
/// - cookies() best-effort (current URL on OHOS)
/// - delete_cookie no-op (platform lacks single-cookie deletion)
#[command]
pub fn cookie_test<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window: tauri::WebviewWindow<R>,
) -> tauri::Result<()> {
  #[cfg(target_env = "ohos")]
  {
    let app_clone = app.clone();
    window.with_webview(move |w| {
      let handle = w.inner();
      tauri::async_runtime::spawn(async move {
        let cookie_url = "https://example.com".to_string();
        let cookie_value = "tauri_test_cookie=value123; Domain=example.com; Path=/".to_string();

        let mut r = serde_json::json!({
          "set_cookie": null,
          "cookies_for_url": null,
          "test_cookie_found": false,
          "cookies_all": null,
          "delete_cookie": "ok (no-op on OHOS, see log warning)",
        });

        // 1. set_cookie via facade
        match handle.set_cookie(&cookie_url, &cookie_value).await {
          Ok(()) => r["set_cookie"] = serde_json::json!("ok"),
          Err(e) => r["set_cookie"] = serde_json::json!(format!("error: {}", e)),
        }

        // 2. cookies_for_url via facade
        match handle.cookies_with_url(&cookie_url).await {
          Ok(cookie_str) => {
            let cookies: Vec<String> = cookie_str
              .split(';')
              .map(|s| s.trim().to_string())
              .filter(|s| !s.is_empty())
              .collect();
            let found = cookies.iter().any(|c| c.starts_with("tauri_test_cookie="));
            r["test_cookie_found"] = serde_json::json!(found);
            r["cookies_for_url"] = serde_json::json!(cookies);
          }
          Err(e) => r["cookies_for_url"] = serde_json::json!(format!("error: {}", e)),
        }

        // 3. cookies for current URL (best-effort)
        match handle.cookies_with_url(&cookie_url).await {
          Ok(cookie_str) => {
            let cookies: Vec<String> = cookie_str
              .split(';')
              .map(|s| s.trim().to_string())
              .filter(|s| !s.is_empty())
              .collect();
            r["cookies_all"] = serde_json::json!(cookies);
          }
          Err(e) => r["cookies_all"] = serde_json::json!(format!("error: {}", e)),
        }

        let _ = app_clone.emit("cookie-test-result", r);
      });
    })?;
  }

  #[cfg(not(target_env = "ohos"))]
  {
    use tauri::webview::Cookie;

    let cookie = Cookie::build(("tauri_test_cookie", "value123"))
      .domain("example.com")
      .path("/")
      .build();

    let mut report = serde_json::json!({
      "set_cookie": null,
      "cookies_for_url": null,
      "test_cookie_found": false,
      "cookies_all": null,
      "delete_cookie": null,
    });

    match window.set_cookie(cookie.clone()) {
      Ok(_) => report["set_cookie"] = serde_json::json!("ok"),
      Err(e) => report["set_cookie"] = serde_json::json!(format!("error: {}", e)),
    }

    match url::Url::parse("https://example.com") {
      Ok(url) => match window.cookies_for_url(url) {
        Ok(cookies) => {
          let found = cookies.iter().any(|c| c.name() == "tauri_test_cookie");
          report["test_cookie_found"] = serde_json::json!(found);
          report["cookies_for_url"] = serde_json::json!(cookies
            .iter()
            .map(|c| format!("{}={}", c.name(), c.value()))
            .collect::<Vec<_>>());
        }
        Err(e) => report["cookies_for_url"] = serde_json::json!(format!("error: {}", e)),
      },
      Err(e) => report["cookies_for_url"] = serde_json::json!(format!("url parse error: {}", e)),
    }

    match window.cookies() {
      Ok(cookies) => {
        report["cookies_all"] = serde_json::json!(cookies
          .iter()
          .map(|c| format!("{}={}", c.name(), c.value()))
          .collect::<Vec<_>>())
      }
      Err(e) => report["cookies_all"] = serde_json::json!(format!("error: {}", e)),
    }

    match window.delete_cookie(cookie) {
      Ok(_) => report["delete_cookie"] = serde_json::json!("ok"),
      Err(e) => report["delete_cookie"] = serde_json::json!(format!("error: {}", e)),
    }

    let _ = app.emit("cookie-test-result", report);
  }

  Ok(())
}

/// Main-thread cookie round-trip for issue #110 device verification.
///
/// Sync (non-`async fn`) commands execute on the OHOS main thread, so calling
/// the synchronous `cookies_for_url`/`cookies` APIs here exercises the
/// `ohos.webview-cookie` sync bridge (ArkTS `fetchCookieSync`) — the path that
/// used to silently return empty. `set_cookie` on OHOS is fire-and-forget, so
/// the read is a separate command and the JS test waits in between.
#[command]
pub fn cookie_test_main_thread_set<R: tauri::Runtime>(
  window: tauri::WebviewWindow<R>,
) -> tauri::Result<()> {
  use tauri::webview::Cookie;

  let cookie = Cookie::build(("tauri_test_cookie_mt", "value456"))
    .domain("example.com")
    .path("/")
    .build();
  window.set_cookie(cookie)
}

#[command]
pub fn cookie_test_main_thread_read<R: tauri::Runtime>(
  window: tauri::WebviewWindow<R>,
) -> Result<serde_json::Value, String> {
  let url = url::Url::parse("https://example.com").map_err(|e| e.to_string())?;

  let cookies_for_url = window
    .cookies_for_url(url)
    .map_err(|e| e.to_string())?
    .iter()
    .map(|c| format!("{}={}", c.name(), c.value()))
    .collect::<Vec<_>>();
  let cookies_all = window
    .cookies()
    .map_err(|e| e.to_string())?
    .iter()
    .map(|c| format!("{}={}", c.name(), c.value()))
    .collect::<Vec<_>>();
  let found = cookies_for_url
    .iter()
    .any(|c| c.starts_with("tauri_test_cookie_mt="));

  Ok(serde_json::json!({
    "test_cookie_found": found,
    "cookies_for_url": cookies_for_url,
    "cookies_all": cookies_all,
  }))
}

/// #192: main-thread url() truth through the `ohos.webview-url` sync bridge.
///
/// Sync (non-`async fn`) commands execute on the OHOS main thread, so
/// `Webview::url()` here exercises wry's `url_with_main_thread_refresh` →
/// `webview_url_on_main_thread` (ArkTS `WebviewUrlPlugin` action `get-url`)
/// — the synchronous ArkTS `WebviewController.getUrl()` read that used to be
/// unreachable from the main thread without deadlocking. Returns the live
/// URL string; a missing webview or a bridge failure rejects (Err), which is
/// exactly the behavior the suite asserts on.
#[command]
pub fn get_webview_url<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  label: String,
) -> Result<String, String> {
  let webview = app
    .get_webview(&label)
    .ok_or_else(|| format!("webview '{label}' not found"))?;
  let url = webview.url().map_err(|e| e.to_string())?;
  Ok(url.to_string())
}

/// #192 helper: SPA hash-route navigation inside a dedicated webview — no
/// reload, the pushState-style routing the sync url() read must observe
/// (a full-reload navigation would also refresh any stale cache; the
/// in-page route change is what distinguishes a live controller read).
/// Scoped eval with a sanitized fragment, not arbitrary script.
#[command]
pub fn navigate_webview_hash<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  label: String,
  hash: String,
) -> Result<(), String> {
  let webview = app
    .get_webview(&label)
    .ok_or_else(|| format!("webview '{label}' not found"))?;
  let safe: String = hash
    .chars()
    .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
    .collect();
  webview
    .eval(format!("location.hash = '#{safe}';"))
    .map_err(|e| e.to_string())
}

/// #188: creates a dedicated incognito WebviewWindow for the cookie-isolation
/// probe. `WebviewWindowBuilder::incognito(true)` rides the create request as
/// `WebviewStyle.incognito` → ArkTS `WebOptions.incognitoMode(true)` — the
/// incognito cookie store that keeps writes out of persistent storage.
#[command]
pub fn create_incognito_webview<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
) -> Result<(), String> {
  log::info!(
    "[Rust] create_incognito_webview called. window_id={}",
    window_id
  );
  tauri::WebviewWindowBuilder::new(
    &app,
    &window_id,
    tauri::WebviewUrl::App("index.html".into()),
  )
  .incognito(true)
  .inner_size(480.0, 360.0)
  .build()
  .map_err(|e| e.to_string())?;
  Ok(())
}

/// #188: writes the per-store probe cookies — a marker THROUGH the incognito
/// webview (its `WebviewStyle.incognito` routes the ArkTS `configCookieSync`
/// call to the incognito store) and a control through the main window's
/// default store. Split from the read half because `set_cookie` is
/// fire-and-forget on OHOS: the JS case waits in between (issue #110
/// precedent), and a sync command must not sleep on the main thread.
#[command]
pub fn incognito_cookie_set<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  label: String,
) -> Result<(), String> {
  use tauri::webview::Cookie;

  let incognito_win = app
    .get_webview_window(&label)
    .ok_or_else(|| format!("incognito window '{label}' not found"))?;
  let main = app
    .get_webview_window("main")
    .ok_or_else(|| "main window not found".to_string())?;

  incognito_win
    .set_cookie(
      Cookie::build(("tauri_incognito_marker", "secret_value"))
        .domain("example.com")
        .path("/")
        .build(),
    )
    .map_err(|e| format!("incognito set_cookie failed: {e}"))?;
  main
    .set_cookie(
      Cookie::build(("tauri_incognito_control", "main_value"))
        .domain("example.com")
        .path("/")
        .build(),
    )
    .map_err(|e| format!("main set_cookie failed: {e}"))?;
  Ok(())
}

/// #188: read-only cross-probe of the two cookie stores. The incognito store
/// must see only the marker, the default store only the control — any
/// bleed-through (or a shared store) fails the JS-side assertions via the
/// returned report.
#[command]
pub fn incognito_cookie_isolation<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  label: String,
) -> Result<serde_json::Value, String> {
  let incognito_win = app
    .get_webview_window(&label)
    .ok_or_else(|| format!("incognito window '{label}' not found"))?;
  let main = app
    .get_webview_window("main")
    .ok_or_else(|| "main window not found".to_string())?;

  let probe_url = url::Url::parse("https://example.com/").map_err(|e| e.to_string())?;
  let incognito_cookies = incognito_win
    .cookies_for_url(probe_url.clone())
    .map_err(|e| format!("incognito cookies_for_url failed: {e}"))?
    .iter()
    .map(|c| format!("{}={}", c.name(), c.value()))
    .collect::<Vec<_>>();
  let main_cookies = main
    .cookies_for_url(probe_url)
    .map_err(|e| format!("main cookies_for_url failed: {e}"))?
    .iter()
    .map(|c| format!("{}={}", c.name(), c.value()))
    .collect::<Vec<_>>();

  Ok(serde_json::json!({
    "incognito_cookies": incognito_cookies,
    "main_cookies": main_cookies,
    "marker_in_incognito": incognito_cookies.iter().any(|c| c.starts_with("tauri_incognito_marker=")),
    "marker_in_main": main_cookies.iter().any(|c| c.starts_with("tauri_incognito_marker=")),
    "control_in_main": main_cookies.iter().any(|c| c.starts_with("tauri_incognito_control=")),
    "control_in_incognito": incognito_cookies.iter().any(|c| c.starts_with("tauri_incognito_control=")),
  }))
}

/// #219: set_title ack-chain probe. Resolves the window by label and calls
/// `set_title` — on OHOS this dispatches the `ohos.window` set-title command
/// whose ArkTS arm now awaits `WindowManager.setWindowTitle` (#219 tracked
/// ack), so an unknown/destroyed window REJECTS here instead of returning a
/// fake success ack. A bogus label is resolved at the tao layer (not found);
/// a freshly destroyed window surfaces as either that or the ArkTS-side
/// tracked failure — both reject, which is the asserted contract.
#[command]
pub fn set_title_on<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  label: String,
  title: String,
) -> Result<(), String> {
  let win = app
    .get_webview_window(&label)
    .ok_or_else(|| format!("window '{label}' not found"))?;
  win.set_title(&title).map_err(|e| e.to_string())
}

/// #219 (fix-variant M3): tracked-reject probe. The tauri layer must resolve a
/// REAL window first (the tauri-layer window-existence precondition — the #80
/// illegal-label leg is rejected by `get_webview_window` before any ArkTS
/// dispatch and cannot cover this), then drives the ArkTS window-command chain
/// into a
/// DETERMINISTIC failure with a wire-valid but unknown window id:
/// `WindowClient.set_window_title` → WindowPlugin set-title arm →
/// `await WindowManager.setWindowTitle` → `getWindow` lookup throws → the arm
/// rethrows (`set-title failed: …`) → NAPI reject → `WindowAcknowledgement::
/// ensure()` turns the rejection into a Rust Err. The asserted error message
/// proves the rejection ORIGINATED at the ArkTS tracked op instead of a
/// tauri-layer guard.
#[command]
pub async fn tracked_reject_probe<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
) -> Result<serde_json::Value, String> {
  #[cfg(target_env = "ohos")]
  {
    let _main = app
      .get_webview_window("main")
      .ok_or_else(|| "main window not found".to_string())?;
    let ohos_app = tauri::ohos::APP
      .lock()
      .unwrap()
      .clone()
      .ok_or_else(|| "ohos app instance not initialized".to_string())?;
    let client = openharmony_ability_plugin_window::WindowClient::new(&ohos_app)
      .map_err(|e| format!("WindowClient::new failed: {e}"))?;
    // JS-safe (<< 2^53), format-valid (>= 0), never allocated by the runtime.
    const UNKNOWN_WINDOW_ID: i64 = 987_654_321_098;
    match client
      .set_window_title(UNKNOWN_WINDOW_ID, "p3-m3-tracked-reject".to_string())
      .await
    {
      Ok(()) => Err(
        "tracked-reject probe FAILED: unknown-window set-title returned a success ack (fake-ack regression)".to_string(),
      ),
      Err(e) => {
        let msg = e.to_string();
        if msg.contains("set-title failed") {
          Ok(serde_json::json!({
            "tracked_reject": true,
            "origin": "arkts-tracked-op",
            "error": msg,
          }))
        } else {
          Err(format!(
            "tracked-reject probe: rejection did not originate at the ArkTS tracked op: {msg}"
          ))
        }
      }
    }
  }
  #[cfg(not(target_env = "ohos"))]
  {
    let _ = app;
    Ok(serde_json::json!({
      "tracked_reject": false,
      "skipped": "non-OHOS platform (tracked reject is OHOS-only)",
    }))
  }
}

/// Manual test: set a cookie for httpbin.org on the main webview cookie store
/// and open a child window to https://httpbin.org/cookies so the user can
/// visually verify the cookie is sent to the server and persists on reload.
#[command]
pub fn cookie_manual_test<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
  use tauri::webview::Cookie;

  let main = app
    .get_webview_window("main")
    .ok_or_else(|| "main window not found".to_string())?;

  let cookie = Cookie::build(("tauri_test_cookie", "ManualTest123"))
    .domain("httpbin.org")
    .path("/")
    .build();
  main.set_cookie(cookie).map_err(|e| e.to_string())?;

  let url = "https://httpbin.org/cookies"
    .parse()
    .map_err(|e| format!("invalid url: {}", e))?;
  #[allow(unused_mut)]
  let mut builder =
    tauri::WebviewWindowBuilder::new(&app, "cookie-manual-test", tauri::WebviewUrl::External(url))
      .title("Cookie Manual Test")
      .inner_size(480.0, 640.0);
  #[cfg(target_env = "ohos")]
  {
    builder = builder.ohos_window_kind(tauri::ohos::OHOSWindowKind::SubWindow);
  }
  builder.build().map_err(|e| e.to_string())?;

  Ok(())
}

/// Test OHOS WebView DevTools (open/close/is_devtools_open). Only compiled when
/// the `devtools` feature (or debug_assertions) is enabled; dormant otherwise.
#[cfg(any(debug_assertions, feature = "devtools"))]
#[command]
pub fn devtools_test<R: tauri::Runtime>(
  window: tauri::WebviewWindow<R>,
) -> tauri::Result<serde_json::Value> {
  let initial = window.is_devtools_open();
  window.open_devtools();
  let after_open = window.is_devtools_open();
  window.close_devtools();
  let after_close = window.is_devtools_open();
  Ok(serde_json::json!({
    "enabled": true,
    "initial": initial,
    "after_open": after_open,
    "after_close": after_close,
  }))
}

/// Desktop features test: checks PathResolver paths, click-through, clipboard.
#[cfg(target_env = "ohos")]
#[command]
pub fn desktop_features_test<R: Runtime>(
  app: tauri::AppHandle<R>,
  window: tauri::WebviewWindow<R>,
) -> Result<serde_json::Value, String> {
  // Check PathResolver paths
  let app_data_dir = app
    .path()
    .app_data_dir()
    .map(|p| p.to_string_lossy().to_string())
    .unwrap_or_else(|_| "(error)".to_string());
  let path_has_double_files = app_data_dir.contains("files/files");

  // Check click-through — set_ignore_cursor_events delegates to Window::set_ignore_cursor_events
  // which is in tauri's #[cfg(desktop)] impl block. On OHOS desktop (2in1) the method exists and
  // the fire-and-forget no-op behavior is verified (command succeeds, the windowing backend discards NotSupported).
  // On OHOS mobile the method is unavailable; report a sentinel so the frontend can skip.
  #[cfg(desktop)]
  let click_through_result = window
    .set_ignore_cursor_events(true)
    .map(|_| "ok".to_string())
    .unwrap_or_else(|e| format!("err: {}", e));
  #[cfg(desktop)]
  let _ = window.set_ignore_cursor_events(false);
  #[cfg(not(desktop))]
  let click_through_result = {
    let _ = &window;
    "mobile_skip".to_string()
  };

  Ok(serde_json::json!({
    "app_data_dir": app_data_dir,
    "path_has_double_files": path_has_double_files,
    "click_through_result": click_through_result,
  }))
}

/// Only call open_devtools() without close. Opens the debugging session.
#[cfg(any(debug_assertions, feature = "devtools"))]
#[command]
pub fn devtools_open_only<R: tauri::Runtime>(
  window: tauri::WebviewWindow<R>,
) -> Result<(), String> {
  window.open_devtools();
  Ok(())
}

/// Only call close_devtools() without open. Closes the debugging session,
/// destroying the domain socket and disconnecting Chrome DevTools.
#[cfg(any(debug_assertions, feature = "devtools"))]
#[command]
pub fn devtools_close_only<R: tauri::Runtime>(
  window: tauri::WebviewWindow<R>,
) -> Result<(), String> {
  window.close_devtools();
  Ok(())
}
/// Test set_bounds / bounds round-trip on the webview named by `label`.
/// Verifies that set_bounds calls ArkTS setBounds without error and bounds()
/// returns consistent values after the round-trip.
///
/// The caller must pass a DEDICATED (explicit-bounds child) webview label, not
/// the window-content webview: under the ohos-webview-sizing D2 semantics a
/// runtime set_bounds flips a natural-layout (bounds-less) webview to explicit
/// sizing — round-tripping "main" used to pin the window content to its stale
/// bounds-cache value (observed 200×200) and opt it out of container-following.
/// Re-asserting an explicit-bounds child's own geometry is side-effect-free.
///
/// Desktop-only: `Webview::bounds`/`set_bounds` are in tauri's `#[cfg(desktop)]`
/// impl block. On OHOS mobile the methods don't exist, so the command is not
/// registered; the frontend test wraps the invoke in try/catch to skip silently.
#[cfg(desktop)]
#[command]
pub fn set_bounds_test<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  label: String,
) -> tauri::Result<serde_json::Value> {
  use tauri::Manager;
  let webview = app
    .get_webview(&label)
    .ok_or(tauri::Error::WebviewNotFound)?;
  let original = webview.bounds()?;
  // Round-trip: set_bounds with original → should not error
  webview.set_bounds(original)?;
  let after_set = webview.bounds()?;
  let original_str = format!("{:?}", original);
  let after_set_str = format!("{:?}", after_set);
  Ok(serde_json::json!({
    "set_ok": true,
    "original": original_str,
    "after_set": after_set_str,
    "matches": original_str == after_set_str,
  }))
}

#[command]
pub fn test_persisted_scope<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
) -> Result<serde_json::Value, String> {
  use tauri_plugin_fs::FsExt;
  let scope = app.try_fs_scope().ok_or("fs scope not available")?;
  let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
  let test_path = cache_dir.join("test-persisted-scope");
  // allow_directory triggers PathAllowed event → persisted-scope saves to .persisted-scope.
  // The persisted-scope listener runs synchronously via scope.emit() inside allow_directory,
  // so the .persisted-scope file is already written to disk before allow_directory returns.
  scope
    .allow_directory(&test_path, true)
    .map_err(|e| e.to_string())?;
  let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let state_file = app_data_dir.join(".persisted-scope");
  let file_exists = state_file.exists();
  let file_size = if file_exists {
    std::fs::metadata(&state_file).map(|m| m.len()).unwrap_or(0)
  } else {
    0
  };
  Ok(serde_json::json!({
    "allow_ok": true,
    "test_path": test_path.to_string_lossy(),
    "state_file": state_file.to_string_lossy(),
    "state_file_exists": file_exists,
    "state_file_size": file_size,
  }))
}

#[command]
pub fn clear_persisted_scope<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
) -> Result<serde_json::Value, String> {
  use tauri_plugin_fs::FsExt;
  let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let state_file = app_data_dir.join(".persisted-scope");
  let file_existed = state_file.exists();
  if file_existed {
    std::fs::remove_file(&state_file).map_err(|e| e.to_string())?;
  }
  let scope = app.try_fs_scope().ok_or("fs scope not available")?;
  let remaining: Vec<String> = scope
    .allowed_patterns()
    .iter()
    .map(|p| p.to_string())
    .collect();
  Ok(serde_json::json!({
    "deleted": file_existed,
    "state_file": state_file.to_string_lossy(),
    "remaining_patterns_count": remaining.len(),
    "note": "File deleted. After an app restart the scope is not restored (no file left to read). The in-memory allowed_patterns are unaffected and cleared on restart."
  }))
}

#[command]
pub fn clear_window_state<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
) -> Result<serde_json::Value, String> {
  let app_config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
  let state_file = app_config_dir.join(".window-state.json");
  let file_existed = state_file.exists();
  if file_existed {
    std::fs::remove_file(&state_file).map_err(|e| e.to_string())?;
  }
  Ok(serde_json::json!({
    "deleted": file_existed,
    "state_file": state_file.to_string_lossy(),
    "note": "File deleted. After an app restart the window is not restored to its saved position (no file left to read) and appears at the default (centered) position."
  }))
}

/// Last updateCursor result recorded by `set_ime_position_test` (D3.8: the
/// facade awaits the promise directly — no ArkTS-side poll storage — so Rust
/// caches the response here for the frontend's readback command).
#[cfg(target_env = "ohos")]
static LAST_IME_POSITION_RESULT: std::sync::Mutex<Option<String>> = std::sync::Mutex::new(None);

/// Test command: set IME (input method) cursor position on a window.
/// On OHOS this calls inputMethod.getController().updateCursor(CursorInfo) via
/// the plugin-window bridge facade (same path tao uses), awaiting the result
/// directly (D3.8 — replaces the old ArkHelper fire-and-forget + poll scheme).
/// Requires a focused edit box in the webview (HTML input works), else
/// ArkTS returns 12800009 (input method client detached).
#[cfg(target_env = "ohos")]
#[command]
pub async fn set_ime_position_test(x: i32, y: i32) -> tauri::Result<()> {
  use openharmony_ability_plugin_window::WindowClient;
  // Main window id = 0 (matches tao's placeholder for the primary window).
  log::info!("[cmd] set_ime_position_test x={} y={} (window_id=0)", x, y);
  let ohos_app = tauri::ohos::APP.lock().unwrap().clone();
  let result = match ohos_app {
    Some(app) => match WindowClient::new(&app) {
      Ok(client) => match client.set_ime_position(0, x as i64, y as i64).await {
        Ok(r) => serde_json::json!({
          "ok": r.ok, "code": r.code, "message": r.message,
          "x": x, "y": y,
          "ts": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0),
        })
        .to_string(),
        Err(e) => {
          log::warn!("[cmd] set_ime_position bridge failed: {}", e);
          serde_json::json!({"ok": false, "code": -1, "message": e.to_string(), "x": x, "y": y, "ts": 0}).to_string()
        }
      },
      Err(e) => serde_json::json!({"ok": false, "code": -1, "message": e.to_string(), "x": x, "y": y, "ts": 0}).to_string(),
    },
    None => serde_json::json!({"ok": false, "code": -1, "message": "OpenHarmonyApp not initialized", "x": x, "y": y, "ts": 0}).to_string(),
  };
  log::info!("[cmd] set_ime_position_test result: {}", result);
  *LAST_IME_POSITION_RESULT.lock().unwrap() = Some(result);
  Ok(())
}

/// Test command: read back the updateCursor result recorded by the last
/// `set_ime_position_test`. Returns JSON:
/// {"ok":bool,"code":number,"message":string,"x":number,"y":number,"ts":number}
#[cfg(target_env = "ohos")]
#[command]
pub fn get_ime_position_result() -> Result<String, String> {
  Ok(
    LAST_IME_POSITION_RESULT
      .lock()
      .unwrap()
      .clone()
      .unwrap_or_else(|| {
        r#"{"ok":false,"code":-1,"message":"no result recorded yet","x":0,"y":0,"ts":0}"#.into()
      }),
  )
}

/// Non-ohos stub.
#[cfg(not(target_env = "ohos"))]
#[command]
pub fn set_ime_position_test(_x: i32, _y: i32) -> tauri::Result<()> {
  Ok(())
}

#[cfg(not(target_env = "ohos"))]
#[command]
pub fn get_ime_position_result() -> Result<String, String> {
  Ok(
    r#"{"ok":false,"code":-1,"message":"not supported on this platform","x":0,"y":0,"ts":0}"#
      .into(),
  )
}

/// Create a test webview window with specific OHOS adapter flags.
/// Used by manual test buttons in TestRunner to verify clipboard/zoom/https flags
/// without needing to modify app config and rebuild.
// OHOS-only: calls WebviewWindowBuilder::disable_clipboard_access, which exists
// only under cfg(target_env = "ohos") — without this gate the host
// `cargo test --all-targets` workspace build fails with E0599.
#[cfg(target_env = "ohos")]
#[command]
pub fn create_ohos_test_webview<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
  label: String,
  clipboard: Option<bool>,
  zoom_hotkeys: Option<bool>,
  https_scheme: Option<bool>,
  drag_drop_overlay: Option<bool>,
) -> tauri::Result<()> {
  log::info!(
    "[OHOS-TEST] Creating test webview '{}' (clipboard={:?}, zoom_hotkeys={:?}, https_scheme={:?}, drag_drop_overlay={:?})",
    window_id, clipboard, zoom_hotkeys, https_scheme, drag_drop_overlay
  );

  let mut builder =
    tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("index.html".into()))
      .title(&label)
      .inner_size(400.0, 300.0);

  if clipboard == Some(true) {
    builder = builder.enable_clipboard_access();
  } else if clipboard == Some(false) {
    // Explicit opt-out: on OHOS the default is enabled (ArkWeb native
    // clipboard shortcuts), so the OFF test must call disable explicitly.
    builder = builder.disable_clipboard_access();
  }
  if let Some(z) = zoom_hotkeys {
    builder = builder.zoom_hotkeys_enabled(z);
  }
  if let Some(h) = https_scheme {
    builder = builder.use_https_scheme(h);
    // Inject a script that logs isSecureContext + crypto.subtle availability
    // plus the two fetch probes (external https / intercepted subresource)
    // to the webview console (visible in hilog as ARKWEB-CONSOLE). This lets
    // us verify the https-scheme rewrite without DevTools (release build has
    // no devtools feature). Covers manual_tests.md §26 cases:
    // page-load / secure-context / external-https / subresource.
    builder = builder.initialization_script(
      r#"window.addEventListener('DOMContentLoaded', () => {
        console.log('[https-scheme] isSecureContext=' + window.isSecureContext);
        console.log('[https-scheme] location.href=' + window.location.href);
        try {
          crypto.subtle.digest('SHA-256', new TextEncoder().encode('hello')).then(buf => {
            console.log('[https-scheme] crypto.subtle OK, bytes=' + buf.byteLength);
          }).catch(e => {
            console.log('[https-scheme] crypto.subtle FAIL: ' + e);
          });
        } catch(e) {
          console.log('[https-scheme] crypto.subtle unavailable: ' + e);
        }
        // Probe 1 (§26 external-https): external https must NOT be intercepted.
        // no-cors: a normal network fetch resolves with an opaque response;
        // rejection means the request never completed through the default stack.
        fetch('https://example.com', { mode: 'no-cors' })
          .then(r => console.log('[https-scheme] external fetch resolved: type=' + r.type + ' status=' + r.status))
          .catch(e => console.log('[https-scheme] external fetch REJECTED: ' + e));
        // Probe 2 (§26 subresource): same-origin fetch under the rewritten
        // https://tauri.localhost origin — must be served by onInterceptRequest
        // + custom_protocol, not the network stack.
        fetch('https://tauri.localhost/index.html')
          .then(r => r.text().then(t => console.log('[https-scheme] subresource fetch OK: status=' + r.status + ' bytes=' + t.length)))
          .catch(e => console.log('[https-scheme] subresource fetch REJECTED: ' + e));
      });"#,
    );
  }

  #[cfg(target_env = "ohos")]
  {
    if let Some(d) = drag_drop_overlay {
      builder = builder.drag_drop_overlay(d);
    }
  }
  #[cfg(not(target_env = "ohos"))]
  {
    let _ = drag_drop_overlay;
  }

  let webview_window = builder.build()?;
  #[cfg(not(target_env = "ohos"))]
  let _ = &webview_window;

  // §26 drag-overlay: log DragDrop events to hilog so the Enter→Over→Drop→Leave
  // sequence (and dropped paths) is verifiable without DevTools. drag_drop_handler
  // is wired by default (drag_drop_handler_enabled=true), events surface as
  // WindowEvent::DragDrop on this window.
  #[cfg(target_env = "ohos")]
  if drag_drop_overlay == Some(true) {
    let label_for_log = label.clone();
    webview_window.on_window_event(move |event| {
      if let tauri::WindowEvent::DragDrop(d) = event {
        use tauri::DragDropEvent;
        let desc = match d {
          DragDropEvent::Enter { paths, position } => {
            format!(
              "Enter paths={:?} pos=({:.0},{:.0})",
              paths, position.x, position.y
            )
          }
          DragDropEvent::Over { position } => {
            format!("Over pos=({:.0},{:.0})", position.x, position.y)
          }
          DragDropEvent::Drop { paths, position } => {
            format!(
              "Drop paths={:?} pos=({:.0},{:.0})",
              paths, position.x, position.y
            )
          }
          DragDropEvent::Leave => "Leave".to_string(),
          _ => format!("{:?}", d),
        };
        log::info!("[DRAG-TEST] window '{}' event: {}", label_for_log, desc);
      }
    });
  }

  Ok(())
}

/// Dump LLVM profiling data (.profraw) to the app sandbox cache dir.
///
/// Instrumented builds (`-Cinstrument-coverage`) collect coverage counters in
/// memory; this command flushes them to disk via `__llvm_profile_write_file`.
/// The output path is set early at app startup (see `lib.rs`) to
/// `/data/storage/el2/base/cache/cov-app-%m-%p.profraw`.
///
/// Gated behind `feature = "cov-dump"` + `target_env = "ohos"` so it is inert
/// on every other platform / build config.
#[cfg(all(target_env = "ohos", feature = "cov-dump"))]
#[command]
pub fn dump_coverage() {
  extern "C" {
    fn __llvm_profile_write_file() -> std::os::raw::c_int;
  }
  let rc = unsafe { __llvm_profile_write_file() };
  log::info!("[cov-dump] __llvm_profile_write_file() returned {}", rc);
}

/// Set a fault injection rule on the OHOS bridge.
///
/// Injects a failure (error / exception / delay / timeout) into the next
/// matching ArkTS bridge call. Auto-enables the registry on first call.
///
/// Gated behind `feature = "fault-injection"` + `target_env = "ohos"`.
#[cfg(all(target_env = "ohos", feature = "fault-injection"))]
#[command]
pub async fn fault_injection_set_rule(rule: serde_json::Value) -> tauri::Result<()> {
  let oha_app = tauri::ohos::APP
    .lock()
    .map_err(|e| anyhow::anyhow!("APP mutex poisoned: {e}"))?
    .as_ref()
    .ok_or_else(|| anyhow::anyhow!("OpenHarmonyApp not initialized"))?
    .clone();
  let wire: openharmony_ability::FaultRuleWire = serde_json::from_value(rule)?;
  oha_app
    .set_fault_rule(wire)
    .await
    .map_err(|e| anyhow::anyhow!("set_fault_rule: {e}"))?;
  Ok(())
}

/// Clear all fault injection rules on the OHOS bridge.
///
/// Gated behind `feature = "fault-injection"` + `target_env = "ohos"`.
#[cfg(all(target_env = "ohos", feature = "fault-injection"))]
#[command]
pub async fn fault_injection_clear() -> tauri::Result<()> {
  let oha_app = tauri::ohos::APP
    .lock()
    .map_err(|e| anyhow::anyhow!("APP mutex poisoned: {e}"))?
    .as_ref()
    .ok_or_else(|| anyhow::anyhow!("OpenHarmonyApp not initialized"))?
    .clone();
  oha_app
    .clear_fault_rules()
    .await
    .map_err(|e| anyhow::anyhow!("clear_fault_rules: {e}"))?;
  Ok(())
}

/// Toggles the app-level "confirm before exit" behavior (product feature
/// layered on the #103 pre-close interception, distinct from the raw
/// prevention test above): implicit closes are prevented and the page gets
/// a `confirm-exit-requested` event to show its confirmation dialog.
/// Explicit exits (process.exit / app.exit) are unaffected — the confirmed
/// path simply exits explicitly.
#[cfg(target_env = "ohos")]
#[command]
pub fn set_exit_confirmation(enabled: bool) {
  crate::EXIT_CONFIRM_MODE.store(enabled, std::sync::atomic::Ordering::SeqCst);
  log::info!("[cmd] set_exit_confirmation: enabled={}", enabled);
}
