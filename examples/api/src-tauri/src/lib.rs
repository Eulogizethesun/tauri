// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

mod cmd;
#[cfg(desktop)]
mod menu_plugin;
#[cfg(desktop)]
mod tray;

use cmd::EventTracker;

#[cfg(target_env = "ohos")]
mod ohos_log {
  pub fn init() {
    // 直接使用 hilog crate 初始化
    hilog::Builder::new()
      .set_tag("tauritest")
      .filter_level(log::LevelFilter::Trace)
      .init();
  }
}

use serde::Serialize;
#[cfg(not(target_env = "ohos"))]
use tauri::ipc::Channel;
#[allow(unused)]
use tauri::RunEvent;
use tauri::{
  webview::{PageLoadEvent, WebviewWindowBuilder},
  App, Emitter, EventTarget, Listener, Manager, Runtime, WebviewUrl,
};
#[cfg(not(target_env = "ohos"))]
use tauri_plugin_sample::{PingRequest, SampleExt};

#[derive(Clone, Serialize)]
struct Reply {
  data: String,
}

#[cfg(target_os = "macos")]
pub struct AppMenu<R: Runtime>(pub std::sync::Mutex<Option<tauri::menu::Menu<R>>>);

#[cfg(all(desktop, not(test)))]
pub struct PopupMenu<R: Runtime>(tauri::menu::Menu<R>);

#[cfg_attr(any(mobile, target_env = "ohos"), tauri::mobile_entry_point)]
pub fn run() {
  #[cfg(target_env = "ohos")]
  std::panic::set_hook(Box::new(|info| {
    let msg = format!("PANIC: {info}\n");
    let _ = std::fs::write("/data/storage/el2/base/cache/panic.log", &msg);
    eprintln!("{msg}");
  }));

  run_app(tauri::Builder::default(), |_app| {})
}

pub fn run_app<R: Runtime, F: FnOnce(&App<R>) + Send + 'static>(
  builder: tauri::Builder<R>,
  setup: F,
) {
  #[cfg(not(target_env = "ohos"))]
  let builder = builder
    .plugin(tauri_plugin_sample::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      None,
    ));

  // Register single-instance FIRST for early callback availability
  #[cfg(target_env = "ohos")]
  let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
    log::info!("[single-instance] callback fired! args={:?}, cwd={:?}", args, cwd);
    if let Some(window) = app.get_webview_window("main") {
      let _ = window.set_focus();
    }
  }));

  #[cfg(target_env = "ohos")]
  let builder = builder
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Trace)
        .clear_targets()
        .target(tauri_plugin_log::Target::new(
          tauri_plugin_log::TargetKind::Stdout,
        ))
        .skip_logger()
        .build(),
    )
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    // MacosLauncher::LaunchAgent is ignored on OHOS (macOS-specific parameter)
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      None,
    ));

  #[cfg(target_env = "ohos")]
  {
    ohos_log::init();
    log::info!("OHOS log initialized via hilog + tauri_plugin_log(skip_logger)");
  };

  #[allow(unused_mut)]
  let mut builder = builder
    // Test append_invoke_initialization_script
    .append_invoke_initialization_script(r#"
      window.__TAURI_TEST_INIT_SCRIPT_RAN = true;
      window.__TAURI_INTERNALS__.__TEST_INVOKE_INIT_SCRIPT__ = 'executed';
    "#)
    // 1. Test custom URI scheme protocol (sync)
    .register_uri_scheme_protocol("myapp", |_ctx, request| {
      log::info!("Custom scheme request: {:?}", request.uri());

      // Return HTML that posts message to parent
      let path = request.uri().path().to_string();
      let body = format!(r#"
        <!DOCTYPE html>
        <html>
        <body>
          <script>
            window.parent.postMessage({{
              status: 'ok',
              path: '{}',
              protocol: 'myapp'
            }}, '*');
          </script>
        </body>
        </html>
      "#, path).into_bytes();

      tauri::http::Response::builder()
        .header("Content-Type", "text/html")
        .status(200)
        .body(body)
        .unwrap()
    })
    // 2. Test custom URI scheme protocol (async)
    .register_asynchronous_uri_scheme_protocol("myapp-async", |_ctx, request, responder| {
      log::info!("Async scheme request: {:?}", request.uri());

      // Spawn a thread to simulate async work
      std::thread::spawn(move || {
        // Simulate some async work
        std::thread::sleep(std::time::Duration::from_millis(50));

        // Return HTML that posts message to parent
        let path = request.uri().path().to_string();
        let body = format!(r#"
          <!DOCTYPE html>
          <html>
          <body>
            <script>
              window.parent.postMessage({{
                status: 'ok',
                path: '{}',
                protocol: 'myapp-async',
                async: true
              }}, '*');
            </script>
          </body>
          </html>
        "#, path).into_bytes();

        responder.respond(
          tauri::http::Response::builder()
            .header("Content-Type", "text/html")
            .status(200)
            .body(body)
            .unwrap()
        );
      });
    })
    .setup(move |app| {
      #[cfg(all(desktop, not(test)))]
      {
        let handle = app.handle();
        tray::create_tray(handle)?;
        handle.plugin(menu_plugin::init())?;
      }

      #[cfg(target_os = "macos")]
      app.manage(AppMenu::<R>(Default::default()));

      // Manage event tracker for testing
      app.manage(EventTracker::default());
      app.manage(cmd::NewWindowDenyState::default());

      #[cfg(all(desktop, not(test)))]
      {
        app.on_menu_event(|app, event| {
          let id = event.id().as_ref();
          log::info!("[on_menu_event global] id={}", id);
          let _ = app.emit_to(
            EventTarget::webview_window("main"),
            "menu-event",
            format!("global:{}", id),
          );
          let tracker = app.state::<EventTracker>();
          tracker.menu_events.lock().unwrap().push(id.to_string());
        });
      }

      #[cfg(all(desktop, not(test)))]
      app.manage(PopupMenu(
        tauri::menu::MenuBuilder::new(app)
          .check("check", "Tauri is awesome!")
          .text("text", "Do something")
          .copy()
          .build()?,
      ));

      let app_handle_nav = app.handle().clone();
      let app_handle_title = app.handle().clone();
      let app_handle_download = app.handle().clone();

      let mut window_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .initialization_script("document.addEventListener('DOMContentLoaded', () => { document.title = '✅ INIT SCRIPT WORKED!'; });")
        .on_document_title_changed(move |_window, title| {
          log::info!("document title changed: {title}");
          let _ = app_handle_title.emit("document-title-changed", &title);
        })
        // 2. Test navigation intercept (shouldOverrideUrlLoading)
        .on_navigation(move |url| {
          log::info!("Navigation intercepted: {url}");
          let _ = app_handle_nav.emit("navigation-intercepted", url.to_string());
          true
        })
        // 3. Test web resource request intercept (onLoadIntercept)
        .on_web_resource_request(|request, response| {
          log::info!("Resource request: {:?}", request.uri());
          // Add a custom header to test
          response.headers_mut().insert("X-Tauri-Test", tauri::http::HeaderValue::from_static("intercepted"));
        })
        // 4. Test download intercept
        .on_download(move |_webview, event| {
          log::info!("on_download event received");
          match event {
            tauri::webview::DownloadEvent::Requested { url, destination } => {
              log::info!("Download requested: {}", url);
              log::info!("Default destination: {:?}", destination);
              let _ = app_handle_download.emit("download-requested", url.to_string());
            }
            tauri::webview::DownloadEvent::Finished { url, path, success } => {
              log::info!("Download finished: {}, success: {}, path: {:?}", url, success, path);
              let _ = app_handle_download.emit("download-finished", (url.to_string(), success));
            }
            _ => {
              log::info!("Other download event");
            }
          }
          true // allow download
        });

      #[cfg(all(desktop, not(test)))]
      {
        let app_ = app.handle().clone();
        let mut created_window_count = std::sync::atomic::AtomicUsize::new(0);

        window_builder = window_builder
          .title("Tauri API Validation")
          .inner_size(1000., 800.)
          .min_inner_size(600., 400.)
          .menu(tauri::menu::Menu::default(app.handle())?)
          .on_new_window(move |url, features| {
            log::info!("new window requested: {url:?} {features:?}");

            let number = created_window_count.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

            #[cfg(not(target_env = "ohos"))]
            {
              let builder = WebviewWindowBuilder::new(
                &app_,
                format!("new-{number}"),
                tauri::WebviewUrl::External("about:blank".parse().unwrap()),
              )
              .window_features(features)
              .on_document_title_changed(|window, title| {
                window.set_title(&title).unwrap();
              })
              .title(url.as_str());

              let window = builder.build().unwrap();
              tauri::webview::NewWindowResponse::Create { window }
            }

            #[cfg(target_env = "ohos")]
            {
              use tauri::Emitter;
              // Record the URL for test verification
              let deny_state = app_.state::<cmd::NewWindowDenyState>();
              *deny_state.last_url.lock().unwrap() = Some(url.to_string());
              let should_deny = deny_state.deny.load(std::sync::atomic::Ordering::SeqCst);

              // Emit event for frontend test verification
              let _ = app_.emit("new-window-requested", url.to_string());

              if should_deny {
                log::info!("[OHOS] on_new_window: DENY for URL: {}", url);
                tauri::webview::NewWindowResponse::Deny
              } else {
                log::info!("[OHOS] on_new_window: ALLOW dialog for URL: {}", url);
                tauri::webview::NewWindowResponse::Allow(std::marker::PhantomData)
              }
            }
          });
      }

      let webview = window_builder.build()?;

      // Set window background to white to avoid black top bar on OHOS
      // (OHOS default window background is black when transparent=false)
      let _ = webview.set_background_color(Some(tauri::window::Color(255, 255, 255, 255)));

      // Setup window event tracking
      let app_handle = app.handle().clone();
      webview.on_window_event(move |event| {
        log::info!("on_window_event");
        let tracker = app_handle.state::<EventTracker>();
        tracker.window_events.lock().unwrap().push(format!("{:?}", event));
      });

      #[cfg(debug_assertions)]
      webview.open_devtools();

      // Test eval functionality
      log::info!("Testing eval functionality...");
      webview.eval("document.title = '✅ Rust eval works!'")?;
      webview.eval_with_callback("document.title", |title| {
        log::info!("Window title from JS: {}", title);
      })?;
      webview.eval(r#"
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:20px;left:20px;background:green;color:white;padding:20px;font-size:24px;z-index:9999;';
        div.textContent = '✅ Rust eval is working!';
        document.body.appendChild(div);
      "#)?;

      #[cfg(not(target_env = "ohos"))]
      {
        let value = Some("test".to_string());
        let response = app.sample().ping(PingRequest {
          value: value.clone(),
          on_event: Channel::new(|event| {
            log::info!("got channel event: {event:?}");
            Ok(())
          }),
        });
        log::info!("got response: {:?}", response);
        // when #[cfg(desktop)], Rust will detect pattern as irrefutable
        #[allow(irrefutable_let_patterns)]
        if let Ok(res) = response {
          assert_eq!(res.value, value);
        }
      }

      #[cfg(target_env = "ohos")]
      {
        log::info!("OHOS platform initialized successfully"); // No logger initialized on OHOS yet
      }

      #[cfg(desktop)]
      std::thread::spawn(|| {
        let server = match tiny_http::Server::http("localhost:3003") {
          Ok(s) => s,
          Err(e) => {
            log::error!("Failed to bind echo server on port 3003: {e}");
            return;
          }
        };
        loop {
          if let Ok(mut request) = server.recv() {
            let mut body = Vec::new();
            let _ = request.as_reader().read_to_end(&mut body);

            // Parse path for /status/{code} pattern
            let path = request.url().to_string();
            let status = if let Some(code_str) = path.strip_prefix("/status/") {
              code_str.parse::<u16>().unwrap_or(200)
            } else {
              200
            };

            let response = tiny_http::Response::new(
              tiny_http::StatusCode(status),
              request.headers().to_vec(),
              std::io::Cursor::new(body),
              request.body_length(),
              None,
            );
            let _ = request.respond(response);
          }
        }
      });

      setup(app);

      Ok(())
    })
    .on_page_load(|webview, payload| {
      let app_handle = webview.app_handle().clone();
      let url = payload.url().to_string();
      match payload.event() {
        PageLoadEvent::Started => {
          log::info!("Page Begin: {}", url);
          let _ = app_handle.emit("page-load-started", &url);
        }
        PageLoadEvent::Finished => {
          log::info!("Page End: {}", url);
          let _ = app_handle.emit("page-load-finished", &url);
        }
      }

      if payload.event() == PageLoadEvent::Finished {
        let webview_ = webview.clone();
        webview.listen("js-event", move |event| {
          log::info!("got js-event with message '{:?}'", event.payload());
          let reply = Reply {
            data: "something else".to_string(),
          };

          webview_
            .emit("rust-event", Some(reply))
            .expect("failed to emit");
        });
      }
    });

  #[allow(unused_mut)]
  let mut app = builder
    .invoke_handler(tauri::generate_handler![
      cmd::log_operation,
      cmd::perform_request,
      cmd::echo,
      cmd::spam,
      cmd::write_test_report,
      cmd::clear_test_report,
      cmd::append_test_result,
      cmd::console_log,
      cmd::flush_console_log,
      cmd::clear_console_log,
      cmd::test_eval,
      cmd::test_local_storage,
      cmd::test_eval_with_callback,
      cmd::test_navigate,
      cmd::test_reload,
      cmd::create_isolated_window,
      cmd::dummy_command,
      cmd::create_window_with_custom_ua,
      cmd::create_window_no_throttle,
      cmd::create_transparent_window,
      #[cfg(desktop)]
      cmd::create_borderless_window,
      #[cfg(desktop)]
      cmd::create_transparent_borderless_window,
      cmd::close_test_window,
      cmd::create_counter,
      cmd::increment_counter,
      cmd::get_counter_value,
      cmd::emit_test_event,
      cmd::setup_app_listener,
      cmd::test_async_spawn,
      cmd::get_tracked_window_events,
      cmd::get_tracked_menu_events,
      cmd::get_tracked_run_events,
      cmd::clear_tracked_events,
      #[cfg(target_env = "ohos")]
      cmd::set_deny_new_window,
      #[cfg(target_env = "ohos")]
      cmd::get_last_new_window_url,
      #[cfg(target_env = "ohos")]
      cmd::get_ohos_version_info,
      cmd::test_create_pdf,
      #[cfg(desktop)]
      tray::simulate_tray_click,
    ])
    .build(tauri::tauri_build_context!())
    .expect("error while building tauri application");

  #[cfg(target_os = "macos")]
  app.set_activation_policy(tauri::ActivationPolicy::Regular);

  #[cfg(target_os = "ios")]
  let mut counter = 0;
  app.run(move |_app_handle, event| {
    // Track all RunEvent variants for testing (tracker may not be ready on early events)
    if let Some(tracker) = _app_handle.try_state::<EventTracker>() {
      let event_name = match &event {
        RunEvent::Ready => {
          log::info!("[RunEvent] Ready");
          "Ready"
        }
        RunEvent::Resumed => {
          log::info!("[RunEvent] Resumed");
          "Resumed"
        }
        RunEvent::MainEventsCleared => {
          use std::sync::atomic::{AtomicBool, Ordering};
          static LOGGED: AtomicBool = AtomicBool::new(false);
          if !LOGGED.swap(true, Ordering::Relaxed) {
            log::info!("[RunEvent] MainEventsCleared");
          }
          "MainEventsCleared"
        }
        RunEvent::ExitRequested { code, api: _api, .. } => {
          log::info!("[RunEvent] ExitRequested, code={:?}", code);
          // 测试 prevent_exit 是否生效
          // NOTE: This is test-only code. On OHOS LoopDestroyed path, prevent_exit()
          // cannot actually prevent exit (system is already tearing down), but it gives
          // user code a chance to run cleanup logic before RunEvent::Exit fires.
          #[cfg(target_env = "ohos")]
          {
            log::info!("[RunEvent] ExitRequested: calling prevent_exit() to test");
            _api.prevent_exit();
            log::info!("[RunEvent] ExitRequested: prevent_exit() called (may not prevent on LoopDestroyed path)");
          }
          if code.is_some() { "ExitRequested(code)" } else { "ExitRequested" }
        }
        RunEvent::Exit => {
          log::info!("[RunEvent] Exit");
          "Exit"
        }
        RunEvent::WindowEvent { label, event, .. } => {
          match event {
            tauri::WindowEvent::CloseRequested { .. } => {
              log::info!("[RunEvent] WindowEvent::CloseRequested, label={}", label);
              "WindowEvent::CloseRequested"
            }
            tauri::WindowEvent::Destroyed => {
              log::info!("[RunEvent] WindowEvent::Destroyed, label={}", label);
              "WindowEvent::Destroyed"
            }
            _ => "",
          }
        }
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android", target_env = "ohos"))]
        RunEvent::Opened { urls } => {
          log::info!("[RunEvent] Opened, urls={:?}", urls);
          "Opened"
        }
        #[cfg(target_os = "macos")]
        RunEvent::Reopen { .. } => "Reopen",
        _ => "",
      };
      if !event_name.is_empty() {
        tracker.run_events.lock().unwrap().push(event_name.to_string());
      }
    }

    #[cfg(not(test))]
    match &event {
      // Keep the event loop running even if all windows are closed
      // This allow us to catch tray icon events when there is no window
      // if we manually requested an exit (code is Some(_)) we will let it go through
      #[cfg(desktop)]
      RunEvent::ExitRequested { api, code, .. } if code.is_none() => {
        api.prevent_exit();
      }
      #[cfg(desktop)]
      RunEvent::WindowEvent {
        event: tauri::WindowEvent::CloseRequested { api, .. },
        label,
        ..
      } => {
        log::info!("CloseRequested for window: {}", label);
        #[cfg(target_env = "ohos")]
        {
          // OHOS: 只对特定测试窗口调用 prevent_close() 并保持窗口打开
          if label.starts_with("test-prevent-close") {
            log::info!("[OHOS] calling prevent_close() for test window: {}", label);
            api.prevent_close();
            // 不调用 destroy() - 这是测试窗口，应该保持打开
          } else {
            // 其他窗口：阻止默认关闭行为，然后显式销毁窗口
            log::info!("[OHOS] closing window: {}", label);
            api.prevent_close();
            _app_handle
              .get_webview_window(label)
              .unwrap()
              .destroy()
              .unwrap();
          }
        }
        #[cfg(not(target_env = "ohos"))]
        {
          log::info!("closing window...");
          api.prevent_close();
          _app_handle
            .get_webview_window(label)
            .unwrap()
            .destroy()
            .unwrap();
        }
      }
      #[cfg(target_os = "ios")]
      RunEvent::SceneRequested { .. } => {
        counter += 1;
        WebviewWindowBuilder::new(
          _app_handle,
          format!("main-from-scene-{counter}"),
          WebviewUrl::default(),
        )
        .build()
        .unwrap();
      }
      #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android", target_env = "ohos"))]
      RunEvent::Opened { urls } => {
        log::info!("opened urls: {:?}", urls);
      }
      _ => (),
    }
  });
}

#[cfg(test)]
mod tests {
  use tauri::Manager;

  #[test]
  fn run_app() {
    super::run_app(tauri::test::mock_builder(), |app| {
      let window = app.get_webview_window("main").unwrap();
      std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(1));
        window.close().unwrap();
      });
    })
  }
}
