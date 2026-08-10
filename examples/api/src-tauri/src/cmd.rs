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
  // Do NOT clear run_events — Ready fires only once and cannot be re-triggered
  Ok(())
}

// New window request handling for OHOS on_new_window tests
#[derive(Default)]
pub struct NewWindowDenyState {
  pub deny: std::sync::atomic::AtomicBool,
  pub create: std::sync::atomic::AtomicBool,
  pub last_url: Mutex<Option<String>>,
}

#[command]
pub fn set_deny_new_window<R: Runtime>(app: tauri::AppHandle<R>, deny: bool) -> tauri::Result<()> {
  let state = app.state::<NewWindowDenyState>();
  state.deny.store(deny, Ordering::SeqCst);
  log::info!("[set_deny_new_window] deny={}", deny);
  Ok(())
}

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
  for i in 1..=1_000 {
    channel.send(i)?;
  }
  Ok(())
}

#[command]
pub fn write_test_report<R: Runtime>(
  #[allow(unused_variables)] app: tauri::AppHandle<R>,
  report: String,
) -> Result<(), String> {
  #[cfg(target_env = "ohos")]
  let dir = std::path::PathBuf::from("/data/storage/el2/base/cache");
  #[cfg(not(target_env = "ohos"))]
  let dir = {
    use tauri::Manager;
    app.path().app_cache_dir().map_err(|e| e.to_string())?
  };

  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let path = dir.join("test-report.json");
  std::fs::write(&path, &report).map_err(|e| e.to_string())?;
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
    format!(
      "# Test Report\n\n| # | Test | Status | Duration | Error |\n|---|------|--------|----------|-------|\n"
    )
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
  tauri::WebviewWindowBuilder::new(&app, &unique_window_id, webview_url)
    .title(format!("Isolated Window: {}", data_suffix))
    .data_directory(data_dir)
    .inner_size(800.0, 600.0)
    .ohos_window_kind(tauri::ohos::OHOSWindowKind::Float)
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
    "canIUseWindowManager": version::can_i_use("SystemCapability.Window.SessionManager"),
  })
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
      .inner_size(800.0, 600.0)
      .ohos_window_kind(tauri::ohos::OHOSWindowKind::Float);

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

  let _window = tauri::WebviewWindowBuilder::new(&app, window_id, WebviewUrl::default())
    .title("Window with No Background Throttling")
    .background_throttling(BackgroundThrottlingPolicy::Disabled)
    .inner_size(800.0, 600.0)
    .ohos_window_kind(tauri::ohos::OHOSWindowKind::Float)
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
  log::info!("Creating transparent window: {} (effect={:?}, radius={:?})", window_id, effect, radius);

  let close_link = CLOSE_LINK_HTML;
  // Autotest-created windows (label prefix "test-") are created and closed
  // programmatically; on OHOS programmatic close doesn't destroy the Float window
  // (tao OHOS Window::close is unimplemented), so a lingering closed popup would
  // poll is_decorated on an unregistered webview → "failed to acquire webview
  // reference". Skip the live isDecorated badge for autotest windows to avoid that
  // noisy error; manual test windows keep the badge (they stay open and work).
  let status_script = if window_id.starts_with("test-") { "" } else { STATUS_SCRIPT };
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

  let mut builder = tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
    .title("Transparent Window")
    .transparent(true)
    .inner_size(600.0, 400.0)
    .ohos_window_kind(tauri::ohos::OHOSWindowKind::Float)
    .initialization_script(&init_script);

  // Optional build-time effects (WindowBuilder::effects path — applied at window creation via
  // registerController inject, distinct from runtime setEffects which uses AttributeUpdater).
  if let Some(effect_name) = &effect {
    let effect = match effect_name.as_str() {
      "Blur" => tauri::window::Effect::Blur,
      "Acrylic" => tauri::window::Effect::Acrylic,
      "Mica" => tauri::window::Effect::Mica,
      "MicaDark" => tauri::window::Effect::MicaDark,
      "MicaLight" => tauri::window::Effect::MicaLight,
      "Tabbed" => tauri::window::Effect::Tabbed,
      "TabbedDark" => tauri::window::Effect::TabbedDark,
      "TabbedLight" => tauri::window::Effect::TabbedLight,
      other => return Err(tauri::Error::Anyhow(anyhow::anyhow!("unknown effect: {}", other))),
    };
    let effects = tauri::utils::config::WindowEffectsConfig {
      effects: vec![effect],
      radius,
      state: None,
      color: color.map(|c| tauri::utils::config::Color(c[0], c[1], c[2], c[3])),
    };
    builder = builder.effects(effects);
  }

  let _window = builder.build()?;

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
  // programmatically; on OHOS programmatic close doesn't destroy the Float window
  // (tao OHOS Window::close is unimplemented), so a lingering closed popup would
  // poll is_decorated on an unregistered webview → "failed to acquire webview
  // reference". Skip the live isDecorated badge for autotest windows to avoid that
  // noisy error; manual test windows keep the badge (they stay open and work).
  let status_script = if window_id.starts_with("test-") { "" } else { STATUS_SCRIPT };
  let init_script = format!(
    r#"
    document.addEventListener('DOMContentLoaded', function() {{
      document.documentElement.style.background = '#1a1a2e';
      document.body.style.cssText = 'background:#1a1a2e;margin:0;padding:0;'
        + 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
        + 'min-height:100vh;box-sizing:border-box;font-family:system-ui,sans-serif;color:#fff;';
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

  let builder =
    tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
      .title("Borderless Window")
      .decorations(false)
      .inner_size(500.0, 350.0)
      .ohos_window_kind(tauri::ohos::OHOSWindowKind::Float)
      .initialization_script(&init_script);

  let _window = builder.build()?;

  Ok(())
}

/// Test command: create a window in a new UIAbility instance via `startAbility`.
///
/// Requires `launchType: "standard"` in module.json5. The new instance's main
/// window is system-managed (resize/move return 1300002); it loads the app's
/// default page (MainPage), not the WebviewUrl passed here.
#[cfg(target_env = "ohos")]
#[command]
pub fn create_ui_ability_window<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
  transparent: Option<bool>,
) -> tauri::Result<CreateUIAbilityWindowResult> {
  let transparent = transparent.unwrap_or(false);
  log::info!("Creating UIAbility instance window: {} (transparent={})", window_id, transparent);

  use tauri::ohos::OHOSWindowKind;
  use tauri::Manager;

  let mut builder = tauri::WebviewWindowBuilder::new(
    &app,
    &window_id,
    WebviewUrl::App("hello.html".into()),
  )
  .title("UIAbility Instance Window")
  .inner_size(600.0, 400.0)
  .ohos_window_kind(OHOSWindowKind::UIAbility);

  if transparent {
    builder = builder.transparent(true);
  }

  let _window = match builder.build() {
    Ok(w) => w,
    Err(e) => {
      log::error!("create_ui_ability_window build failed: {:?}", e);
      return Err(e);
    }
  };

  // Verify the webview window was registered and is acquirable by label.
  // get_webview_window uses the same manager lookup as IPC's get_webview.
  let webview_acquired = app.get_webview_window(&window_id).is_some();
  let all_labels: Vec<String> = app.webview_windows().keys().cloned().collect();
  let main_exists = app.get_webview_window("main").is_some();
  log::info!(
    "[create_ui_ability_window] webview_acquired={}, label={}, main_exists={}, all_labels={:?}",
    webview_acquired, window_id, main_exists, all_labels
  );

  Ok(CreateUIAbilityWindowResult {
    label: window_id.clone(),
    webview_acquired,
    all_webview_labels: all_labels,
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
}

/// Create a UIAbility instance with a transparent main window (builder.transparent(true))
/// loading the dedicated transparent-test.html page. The page self-drives a test
/// sequence on load (see transparent-test.html runTestSequence).
///
/// label uses `test-` prefix to match ACL run-app.json windows: [test-*], so the
/// new instance's webview can call plugin:window|* commands (setBackgroundColor etc).
/// transparent=true flows: tao → start_ui_ability → want.parameters['tauri_transparent']
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

  let _window = tauri::WebviewWindowBuilder::new(
    &app,
    &label,
    WebviewUrl::App("transparent-test.html".into()),
  )
  .title("Transparent Test (UIAbility)")
  .transparent(true)
  .inner_size(700.0, 500.0)
  .ohos_window_kind(OHOSWindowKind::UIAbility)
  .build()?;

  let acquired = app.get_webview_window(&label).is_some();
  let all_labels: Vec<String> = app.webview_windows().keys().cloned().collect();
  log::info!(
    "[create_transparent_ui_ability_window] launched, label={}, acquired={}",
    label,
    acquired
  );

  Ok(CreateTransparentWindowResult {
    label,
    window_id,
    webview_acquired: acquired,
    all_webview_labels: all_labels,
  })
}

/// Emits a START anchor into hilog for the verification script to delineate a test run.
#[cfg(target_env = "ohos")]
#[command]
pub fn transparent_test_start(window_id: String) -> tauri::Result<()> {
  log::info!("[TRANSP-TEST] START window_id={}", window_id);
  Ok(())
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

  let mut results = Vec::new();
  for i in 1..=3 {
    let window_id = format!("uiability-x3-{}-{}", std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis(), i);
    log::info!("[x3] Creating UIAbility instance #{}: {}", i, window_id);

    let builder = tauri::WebviewWindowBuilder::new(
      &app, &window_id, WebviewUrl::App("hello.html".into()),
    )
    .title("UIAbility Instance Window")
    .inner_size(600.0, 400.0)
    .ohos_window_kind(OHOSWindowKind::UIAbility);

    match builder.build() {
      Ok(w) => {
        let acquired = app.get_webview_window(&window_id).is_some();
        let all_labels: Vec<String> = app.webview_windows().keys().cloned().collect();
        log::info!("[x3] #{} webview_acquired={}, label={}, all_labels={:?}", i, acquired, window_id, all_labels);

        // Trigger an IPC from the new webview to verify its label is registered
        // correctly. Use fetch to tauri://localhost (same as page JS IPC) —
        // if the webview's label isn't in the manager, this hits
        // "failed to acquire webview reference" in the URI scheme handler.
        let ipc_js = r#"fetch('tauri://localhost/', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({cmd:'dummy_command'})}).catch(e=>console.error('IPC fetch failed: '+e))"#;
        if let Err(e) = w.eval(ipc_js) {
          log::error!("[x3] #{} eval (IPC trigger) failed: {:?}", i, e);
        }

        results.push(CreateUIAbilityWindowResult {
          label: window_id,
          webview_acquired: acquired,
          all_webview_labels: all_labels,
        });
      }
      Err(e) => {
        log::error!("[x3] #{} build failed: {:?}", i, e);
        results.push(CreateUIAbilityWindowResult {
          label: window_id,
          webview_acquired: false,
          all_webview_labels: vec![],
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
  // programmatically; on OHOS programmatic close doesn't destroy the Float window
  // (tao OHOS Window::close is unimplemented), so a lingering closed popup would
  // poll is_decorated on an unregistered webview → "failed to acquire webview
  // reference". Skip the live isDecorated badge for autotest windows to avoid that
  // noisy error; manual test windows keep the badge (they stay open and work).
  let status_script = if window_id.starts_with("test-") { "" } else { STATUS_SCRIPT };
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

  let builder =
    tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
      .title("Transparent Borderless")
      .transparent(true)
      .decorations(false)
      .ohos_window_kind(tauri::ohos::OHOSWindowKind::Float)
      .inner_size(500.0, 350.0)
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

/// Close the calling webview window. Used by test windows' close buttons
/// since __TAURI_INTERNALS__.invoke('plugin:window|close') may not work
/// in initialization_script context on OHOS.
#[command]
pub fn close_test_window<R: tauri::Runtime>(window: tauri::WebviewWindow<R>) -> tauri::Result<()> {
  log::info!("close_test_window called for label: {}", window.label());
  window.close()?;
  Ok(())
}

/// Close all webview windows except the main window. Used by the TestRunner
/// "Close All Test Windows" button to clean up windows opened during a test
/// run (Float sub-windows, UIAbility instances, isolated/UA/custom-ua/no-throttle
/// windows, etc.).
///
/// On OHOS, `WebviewWindow::close()` only removes the window from Rust's manager
/// — tao's `Window::close` is a no-op on OHOS and does NOT call ArkTS
/// `destroyWindow()`, so the system window stays visible on screen. To actually
/// destroy the system window, we must explicitly call `destroy_window` (which
/// dispatches to ArkTS `WindowManager.closeWindow`):
/// - Float sub-window: `win.destroyWindow()` (real destroy, removes from screen).
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
      // OS window (tao's close/destroy are no-ops on OHOS). On other platforms,
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

/// Test command for web_page_snapshot on OHOS
#[command]
pub fn test_web_page_snapshot<R: Runtime>(app: tauri::AppHandle<R>) -> tauri::Result<()> {
  log::info!("test_web_page_snapshot called");

  #[cfg(target_env = "ohos")]
  {
    use tauri::Manager;
    if let Some(webview_window) = app.get_webview_window("main") {
      let app_emit = app.clone();
      webview_window.with_webview(move |platform_webview| {
        let handle = platform_webview.inner();
        let app_cb = app_emit.clone();
        if let Err(e) = handle.web_page_snapshot(move |result| match result {
          Ok(data) => {
            log::info!(
              "web_page_snapshot success: {}x{}, rgba len={}",
              data.width,
              data.height,
              data.rgba.len()
            );
            if let Err(e) = app_cb.emit(
              "web-page-snapshot-result",
              serde_json::json!({
                "success": true,
                "width": data.width,
                "height": data.height,
                "rgba_len": data.rgba.len(),
                "rgba": data.rgba,
              }),
            ) {
              log::error!("Failed to emit snapshot result: {}", e);
            }
          }
          Err(e) => {
            log::error!("web_page_snapshot failed: {}", e);
            if let Err(emit_err) = app_cb.emit(
              "web-page-snapshot-result",
              serde_json::json!({
                "success": false,
                "error": e,
              }),
            ) {
              log::error!("Failed to emit snapshot error: {}", emit_err);
            }
          }
        }) {
          log::error!("web_page_snapshot setup failed: {}", e);
          if let Err(emit_err) = app_emit.emit(
            "web-page-snapshot-result",
            serde_json::json!({
              "success": false,
              "error": format!("setup failed: {}", e),
            }),
          ) {
            log::error!("Failed to emit setup error: {}", emit_err);
          }
        }
      })?;
    } else {
      log::error!("test_web_page_snapshot: 'main' webview window not found");
      if let Err(e) = app.emit(
        "web-page-snapshot-result",
        serde_json::json!({
          "success": false,
          "error": "main webview window not found",
        }),
      ) {
        log::error!("Failed to emit window not found error: {}", e);
      }
    }
  }

  #[cfg(not(target_env = "ohos"))]
  {
    if let Err(e) = app.emit(
      "web-page-snapshot-result",
      serde_json::json!({
        "success": false,
        "error": "web_page_snapshot only available on OHOS",
      }),
    ) {
      log::error!("Failed to emit non-OHOS error: {}", e);
    }
  }

  Ok(())
}

/// Test command for webview.create_pdf (OHOS only)
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

#[derive(Debug, Clone, PartialEq, serde::Deserialize)]
pub enum DownloadTestMode {
  Default,
  CustomDir,
  ConfirmAllow,
  BlockFileType,
  ProgressTracking,
  AuditLog,
  AutoRename,
  CancelAll,
}

impl Default for DownloadTestMode {
  fn default() -> Self {
    DownloadTestMode::Default
  }
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
  window: tauri::WebviewWindow<R>,
) -> tauri::Result<serde_json::Value> {
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

  // 1. set_cookie
  match window.set_cookie(cookie.clone()) {
    Ok(_) => report["set_cookie"] = serde_json::json!("ok"),
    Err(e) => report["set_cookie"] = serde_json::json!(format!("error: {}", e)),
  }

  // 2. cookies_for_url — verify the cookie we just set is readable
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

  // 3. cookies() — on OHOS returns cookies for the current URL (best-effort)
  match window.cookies() {
    Ok(cookies) => {
      report["cookies_all"] = serde_json::json!(cookies
        .iter()
        .map(|c| format!("{}={}", c.name(), c.value()))
        .collect::<Vec<_>>())
    }
    Err(e) => report["cookies_all"] = serde_json::json!(format!("error: {}", e)),
  }

  // 4. delete_cookie — no-op on OHOS (platform lacks single-cookie deletion)
  match window.delete_cookie(cookie) {
    Ok(_) => report["delete_cookie"] = serde_json::json!("ok (no-op on OHOS, see log warning)"),
    Err(e) => report["delete_cookie"] = serde_json::json!(format!("error: {}", e)),
  }

  log::info!("[cookie_test] report: {}", report);
  Ok(report)
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
  tauri::WebviewWindowBuilder::new(&app, "cookie-manual-test", tauri::WebviewUrl::External(url))
    .title("Cookie Manual Test")
    .inner_size(480.0, 640.0)
    .ohos_window_kind(tauri::ohos::OHOSWindowKind::Float)
    .build()
    .map_err(|e| e.to_string())?;

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

  // Check click-through returns NotSupported
  let click_through_result = window
    .set_ignore_cursor_events(true)
    .map(|_| "ok".to_string())
    .unwrap_or_else(|e| format!("err: {}", e));

  // Reset click-through
  let _ = window.set_ignore_cursor_events(false);

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
/// Test set_bounds / bounds round-trip for the main webview. Verifies that
/// set_bounds calls ArkTS setBounds without error and bounds() returns
/// consistent values after the round-trip.
#[command]
pub fn set_bounds_test<R: tauri::Runtime>(
  window: tauri::WebviewWindow<R>,
) -> tauri::Result<serde_json::Value> {
  use tauri::webview::Webview;
  let webview = window.as_ref();
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
  let cache_dir = app
    .path()
    .app_cache_dir()
    .map_err(|e| e.to_string())?;
  let test_path = cache_dir.join("test-persisted-scope");
  // allow_directory triggers PathAllowed event → persisted-scope saves to .persisted-scope.
  // The persisted-scope listener runs synchronously via scope.emit() inside allow_directory,
  // so the .persisted-scope file is already written to disk before allow_directory returns.
  scope
    .allow_directory(&test_path, true)
    .map_err(|e| e.to_string())?;
  let app_data_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?;
  let state_file = app_data_dir.join(".persisted-scope");
  let file_exists = state_file.exists();
  let file_size = if file_exists {
    std::fs::metadata(&state_file)
      .map(|m| m.len())
      .unwrap_or(0)
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
  let app_data_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?;
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
    "note": "文件已删除。重启 app 后 scope 不会恢复（无文件可读）。当前内存中的 allowed_patterns 不受影响，重启后清空。"
  }))
}

#[command]
pub fn clear_window_state<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
) -> Result<serde_json::Value, String> {
  let app_config_dir = app
    .path()
    .app_config_dir()
    .map_err(|e| e.to_string())?;
  let state_file = app_config_dir.join(".window-state.json");
  let file_existed = state_file.exists();
  if file_existed {
    std::fs::remove_file(&state_file).map_err(|e| e.to_string())?;
  }
  Ok(serde_json::json!({
    "deleted": file_existed,
    "state_file": state_file.to_string_lossy(),
    "note": "文件已删除。重启 app 后窗口不会恢复到保存的位置（无文件可读），将出现在默认位置（居中）。"
  }))
}

/// Create a test webview window with specific OHOS adapter flags.
/// Used by manual test buttons in TestRunner to verify clipboard/zoom/https flags
/// without needing to modify app config and rebuild.
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

  let mut builder = tauri::WebviewWindowBuilder::new(
    &app,
    &window_id,
    WebviewUrl::App("index.html".into()),
  )
  .title(&label)
  .inner_size(800.0, 600.0);

  if clipboard == Some(true) {
    builder = builder.enable_clipboard_access();
  }
  if let Some(z) = zoom_hotkeys {
    builder = builder.zoom_hotkeys_enabled(z);
  }
  if let Some(h) = https_scheme {
    builder = builder.use_https_scheme(h);
    // Inject a script that logs isSecureContext + crypto.subtle availability
    // to the webview console (visible in hilog as ARKWEB-CONSOLE). This lets
    // us verify the https-scheme rewrite produced a secure context without
    // needing DevTools (release build has no devtools feature).
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

  builder.build()?;
  Ok(())
}
