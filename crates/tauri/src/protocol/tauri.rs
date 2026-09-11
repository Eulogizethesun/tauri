// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

use std::{borrow::Cow, sync::Arc};

use http::{header::CONTENT_TYPE, Request, Response as HttpResponse, StatusCode};
use tauri_utils::config::HeaderAddition;

use crate::{
  manager::{webview::PROXY_DEV_SERVER, AppManager},
  webview::{UriSchemeProtocolHandler, WebResourceRequestHandler},
  Runtime,
};

#[cfg(all(dev, mobile))]
use std::{collections::HashMap, sync::Mutex};

#[cfg(all(dev, mobile))]
#[derive(Clone)]
struct CachedResponse {
  status: http::StatusCode,
  headers: http::HeaderMap,
  body: bytes::Bytes,
}

pub fn get<R: Runtime>(
  #[allow(unused_variables)] manager: Arc<AppManager<R>>,
  window_origin: &str,
  web_resource_request_handler: Option<Box<WebResourceRequestHandler>>,
) -> UriSchemeProtocolHandler {
  #[cfg(all(dev, mobile))]
  let url = {
    let mut url = manager
      .get_app_url(window_origin.starts_with("https"))
      .as_str()
      .to_string();
    if url.ends_with('/') {
      url.pop();
    }
    url
  };

  let window_origin = window_origin.to_string();

  #[cfg(all(dev, mobile))]
  let response_cache = Arc::new(Mutex::new(HashMap::new()));

  Box::new(move |_, request, responder| {
    match get_response(
      request,
      &manager,
      &window_origin,
      web_resource_request_handler.as_deref(),
      #[cfg(all(dev, mobile))]
      (&url, &response_cache),
    ) {
      Ok(response) => responder.respond(response),
      Err(e) => responder.respond(
        HttpResponse::builder()
          .status(StatusCode::INTERNAL_SERVER_ERROR)
          .header(CONTENT_TYPE, mime::TEXT_PLAIN.essence_str())
          .header("Access-Control-Allow-Origin", &window_origin)
          .body(e.to_string().into_bytes())
          .unwrap(),
      ),
    }
  })
}

/// Reads a proxied network response into a [`CachedResponse`] — the shared
/// body of the OHOS / non-OHOS lock-hygiene variants in `get_response`.
#[cfg(all(dev, mobile))]
fn read_cached_response(r: reqwest::Response) -> Result<CachedResponse, Box<dyn std::error::Error>> {
  let status = r.status();
  let headers = r.headers().clone();
  let body = crate::async_runtime::safe_block_on(r.bytes())?;
  Ok(CachedResponse {
    status,
    headers,
    body,
  })
}

fn get_response<R: Runtime>(
  #[allow(unused_mut)] mut request: Request<Vec<u8>>,
  #[allow(unused_variables)] manager: &AppManager<R>,
  window_origin: &str,
  web_resource_request_handler: Option<&WebResourceRequestHandler>,
  #[cfg(all(dev, mobile))] (url, response_cache): (
    &str,
    &Arc<Mutex<HashMap<String, CachedResponse>>>,
  ),
) -> Result<HttpResponse<Cow<'static, [u8]>>, Box<dyn std::error::Error>> {
  // use the entire URI as we are going to proxy the request
  let path = if PROXY_DEV_SERVER {
    request.uri().to_string()
  } else {
    // ignore query string and fragment
    request
      .uri()
      .to_string()
      .split(&['?', '#'][..])
      .next()
      .unwrap()
      .into()
  };

  let path = path
    .strip_prefix("tauri://localhost")
    .map(|p| p.to_string())
    // the `strip_prefix` only returns None when a request is made to `https://tauri.$P` on Windows and Android
    // where `$P` is not `localhost/*`
    .unwrap_or_default();

  let mut builder = HttpResponse::builder()
    .add_configured_headers(manager.config.app.security.headers.as_ref())
    .header("Access-Control-Allow-Origin", window_origin);

  #[cfg(all(dev, mobile))]
  let mut response = {
    let decoded_path = percent_encoding::percent_decode(path.as_bytes())
      .decode_utf8_lossy()
      .to_string();
    let url = format!(
      "{}/{}",
      url.trim_end_matches('/'),
      decoded_path.trim_start_matches('/')
    );

    #[cfg(feature = "rustls-tls")]
    if rustls::crypto::CryptoProvider::get_default().is_none() {
      let _ = rustls::crypto::ring::default_provider().install_default();
    }

    // `client` is only mutated when a TLS feature is enabled; this block is
    // also compiled on OHOS mobile dev builds, which may lack all of them.
    #[cfg_attr(
      not(any(
        feature = "native-tls",
        feature = "native-tls-vendored",
        feature = "rustls-tls"
      )),
      allow(unused_mut)
    )]
    let mut client = reqwest::ClientBuilder::new();

    if url.starts_with("https://") {
      // we can't load env vars at runtime, gotta embed them in the lib
      // (`cert_pem` is only read when a TLS feature is enabled — see above)
      #[cfg_attr(
        not(any(
          feature = "native-tls",
          feature = "native-tls-vendored",
          feature = "rustls-tls"
        )),
        allow(unused_variables)
      )]
      if let Some(cert_pem) = option_env!("TAURI_DEV_ROOT_CERTIFICATE") {
        #[cfg(any(
          feature = "native-tls",
          feature = "native-tls-vendored",
          feature = "rustls-tls"
        ))]
        {
          log::info!("adding dev server root certificate");
          let certificate = reqwest::Certificate::from_pem(cert_pem.as_bytes())
            .expect("failed to parse TAURI_DEV_ROOT_CERTIFICATE");
          client = client.tls_certs_merge([certificate]);
        }

        #[cfg(not(any(
          feature = "native-tls",
          feature = "native-tls-vendored",
          feature = "rustls-tls"
        )))]
        {
          log::warn!(
            "the dev root-certificate-path option was provided, but you must enable one of the following Tauri features in Cargo.toml: native-tls, native-tls-vendored, rustls-tls"
          );
        }
      } else {
        log::warn!(
          "loading HTTPS URL; you might need to provide a certificate via the `dev --root-certificate-path` option. You must enable one of the following Tauri features in Cargo.toml: native-tls, native-tls-vendored, rustls-tls"
        );
      }
    }

    let mut proxy_builder = client
      .build()
      .unwrap()
      .request(request.method().clone(), &url);
    proxy_builder = proxy_builder.body(std::mem::take(request.body_mut()));
    for (name, value) in request.headers() {
      proxy_builder = proxy_builder.header(name, value);
    }
    proxy_builder = proxy_builder.body(request.body().clone());
    match crate::async_runtime::safe_block_on(proxy_builder.send()) {
      Ok(r) => {
        // Lock hygiene (design.md D1 fix-2, OHOS only): NOT_MODIFIED cache lookup
        // stays in the first lock scope; the network read (safe_block_on(r.bytes()))
        // is moved outside the lock to avoid holding the Mutex across potentially
        // slow I/O. On OHOS the request handler can run on the NAPI main thread,
        // where holding a lock across network I/O stalls TSFN callbacks. Other
        // platforms keep the upstream single-flight semantics: lookup and insert
        // stay under one lock; the guard is released once the response is cloned
        // (just before the header-copy loop) rather than at the end of the
        // function as upstream does — the loop and builder calls below never
        // touch the cache, so this is equivalent.
        #[cfg(target_env = "ohos")]
        let response = {
          let cached = if r.status() == http::StatusCode::NOT_MODIFIED {
            response_cache.lock().unwrap().get(&url).cloned()
          } else {
            None
          };
          match cached {
            Some(cached) => cached,
            None => {
              let new_response = read_cached_response(r)?;
              response_cache
                .lock()
                .unwrap()
                .insert(url.clone(), new_response.clone());
              new_response
            }
          }
        };
        #[cfg(not(target_env = "ohos"))]
        let response = {
          let mut response_cache_ = response_cache.lock().unwrap();
          let cached = if r.status() == http::StatusCode::NOT_MODIFIED {
            response_cache_.get(&url).cloned()
          } else {
            None
          };
          match cached {
            Some(cached) => cached,
            None => {
              let new_response = read_cached_response(r)?;
              response_cache_.insert(url.clone(), new_response.clone());
              new_response
            }
          }
        };
        for (name, value) in &response.headers {
          builder = builder.header(name, value);
        }
        builder
          .status(response.status)
          .body(response.body.to_vec().into())?
      }
      Err(e) => {
        let error_message = format!(
          "Failed to request {}: {}{}",
          url.as_str(),
          e,
          if let Some(s) = e.status() {
            format!("status code: {}", s.as_u16())
          } else if cfg!(target_os = "ios") {
            ", did you grant local network permissions? That is required to reach the development server. Please grant the permission via the prompt or in `Settings > Privacy & Security > Local Network` and restart the app. See https://support.apple.com/en-us/102229 for more information.".to_string()
          } else {
            "".to_string()
          }
        );
        log::error!("{error_message}");
        return Err(error_message.into());
      }
    }
  };

  #[cfg(not(all(dev, mobile)))]
  let mut response = {
    let use_https_scheme = request.uri().scheme() == Some(&http::uri::Scheme::HTTPS);
    let asset = manager.get_asset(path, use_https_scheme)?;
    builder = builder.header(CONTENT_TYPE, &asset.mime_type);
    if let Some(csp) = &asset.csp_header {
      builder = builder.header("Content-Security-Policy", csp);
    }
    builder.body(asset.bytes.into())?
  };
  if let Some(handler) = &web_resource_request_handler {
    handler(request, &mut response);
  }

  Ok(response)
}
