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
  pub last_url: Mutex<Option<String>>,
}

#[command]
pub fn set_deny_new_window<R: Runtime>(
  app: tauri::AppHandle<R>,
  deny: bool,
) -> tauri::Result<()> {
  let state = app.state::<NewWindowDenyState>();
  state.deny.store(deny, Ordering::SeqCst);
  log::info!("[set_deny_new_window] deny={}", deny);
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
  log::info!("Creating window '{}' with custom User-Agent: '{}'", unique_id, user_agent);

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

  let mut builder = tauri::WebviewWindowBuilder::new(&app, &unique_id, tauri::WebviewUrl::App(url_path.into()))
    .title(title)
    .inner_size(800.0, 600.0);

  if !user_agent.is_empty() {
    builder = builder.user_agent(&user_agent);
  }

  let window = builder.build()?;

  // Emit UA result to frontend so TestRunner UI can display it
  let app_handle = app.clone();
  let wid = unique_id.clone();
  window.eval_with_callback("navigator.userAgent", move |ua| {
    log::info!("[UA-TEST] Window '{}': navigator.userAgent = {}", wid, ua);
    let _ = app_handle.emit("ua-test-result", serde_json::json!({ "windowId": wid, "userAgent": ua }));
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
      setInterval(function() {
        window.__TAURI__.invoke('plugin:window|is_decorated').then(function(v) {
          var el = document.getElementById('state-status');
          if (el) {
            el.textContent = 'isDecorated: ' + v;
            el.style.color = v ? '#0f0' : '#f80';
          }
        }).catch(function() {});
      }, 500);
"##;

#[command]
pub fn create_transparent_window<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  window_id: String,
) -> tauri::Result<()> {
  log::info!("Creating transparent window: {}", window_id);

  let close_link = CLOSE_LINK_HTML;
  let status_script = STATUS_SCRIPT;
  let init_script = format!(r#"
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
  "#);

  let _window = tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
    .title("Transparent Window")
    .transparent(true)
    .inner_size(600.0, 400.0)
    .initialization_script(&init_script)
    .build()?;

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
  let status_script = STATUS_SCRIPT;
  let init_script = format!(r#"
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
  "#);

  let builder = tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
    .title("Borderless Window")
    .decorations(false)
    .inner_size(500.0, 350.0)
    .initialization_script(&init_script);

  let _window = builder.build()?;

  Ok(())
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
  let status_script = STATUS_SCRIPT;
  let init_script = format!(r#"
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
  "#);

  let builder = tauri::WebviewWindowBuilder::new(&app, &window_id, WebviewUrl::App("hello.html".into()))
    .title("Transparent Borderless")
    .transparent(true)
    .decorations(false)
    .inner_size(500.0, 350.0)
    .initialization_script(&init_script);

  let _window = builder.build()?;

  Ok(())
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
        if let Err(e) = handle.web_page_snapshot(move |result| {
          match result {
            Ok(data) => {
              log::info!("web_page_snapshot success: {}x{}, rgba len={}", data.width, data.height, data.rgba.len());
              if let Err(e) = app_cb.emit("web-page-snapshot-result", serde_json::json!({
                "success": true,
                "width": data.width,
                "height": data.height,
                "rgba_len": data.rgba.len(),
                "rgba": data.rgba,
              })) {
                log::error!("Failed to emit snapshot result: {}", e);
              }
            }
            Err(e) => {
              log::error!("web_page_snapshot failed: {}", e);
              if let Err(emit_err) = app_cb.emit("web-page-snapshot-result", serde_json::json!({
                "success": false,
                "error": e,
              })) {
                log::error!("Failed to emit snapshot error: {}", emit_err);
              }
            }
          }
        }) {
          log::error!("web_page_snapshot setup failed: {}", e);
          if let Err(emit_err) = app_emit.emit("web-page-snapshot-result", serde_json::json!({
            "success": false,
            "error": format!("setup failed: {}", e),
          })) {
            log::error!("Failed to emit setup error: {}", emit_err);
          }
        }
      })?;
    } else {
      log::error!("test_web_page_snapshot: 'main' webview window not found");
      if let Err(e) = app.emit("web-page-snapshot-result", serde_json::json!({
        "success": false,
        "error": "main webview window not found",
      })) {
        log::error!("Failed to emit window not found error: {}", e);
      }
    }
  }

  #[cfg(not(target_env = "ohos"))]
  {
    if let Err(e) = app.emit("web-page-snapshot-result", serde_json::json!({
      "success": false,
      "error": "web_page_snapshot only available on OHOS",
    })) {
      log::error!("Failed to emit non-OHOS error: {}", e);
    }
  }

  Ok(())
}

/// Test command for webview.create_pdf (OHOS only)
#[command]
pub fn test_create_pdf<R: Runtime>(app: tauri::AppHandle<R>, path: Option<String>, config: Option<tauri::PdfConfig>) -> tauri::Result<()> {
  let path = path.unwrap_or_else(|| "/data/storage/el2/base/cache/test.pdf".to_string());
  log::info!("test_create_pdf called, path={}", path);

  #[cfg(target_env = "ohos")]
  {
    if let Some(window) = app.get_webview_window("main") {
      let app_clone = app.clone();

      let path_for_cb = path.clone();
      window.create_pdf(&path, config, move |success| {
        log::info!("create_pdf callback: success={}, path={}", success, path_for_cb);
        let _ = app_clone.emit("create-pdf-result", format!("{}:{}", success, path_for_cb));
      })?;
    } else {
      let _ = app.emit("create-pdf-result", "false:window not found");
    }
  }

  #[cfg(not(target_env = "ohos"))]
  {
    let _ = (config);
    let _ = app.emit("create-pdf-result", "false:createPdf only supported on OHOS");
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
