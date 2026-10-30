// #186 fix-variant M1 probe: proves the intercept response-header write path
// (wry extraction → wire parallel arrays → ArkTS setResponseHeader) on device.
//
// This page is loaded inside a useHttpsScheme sub-window (its own origin is
// https://tauri.localhost), so fetching https://myapp.localhost is a genuine
// CROSS-ORIGIN request: it only succeeds when the Rust protocol handler's
// Access-Control-Allow-Origin survived the wry→ArkTS seam via
// setResponseHeader, and the echo header is only readable in response.headers
// when Access-Control-Expose-Headers listed it. Result is reported through
// document.title (relayed to the main page by the existing
// document-title-changed event) — no invoke() from this page.
(async function () {
  const statusEl = document.getElementById('status');
  const TARGET = 'https://myapp.localhost/p3-m1-header-probe';
  try {
    const resp = await fetch(TARGET);
    const echo = resp.headers.get('x-tauri-scheme-echo');
    const acao = resp.headers.get('access-control-allow-origin');
    document.title =
      'M1-OK:status=' + resp.status + ';echo=' + (echo ?? 'null') +
      ';acao=' + (acao ?? 'null');
  } catch (e) {
    document.title = 'M1-ERR:' + String(e);
  }
  if (statusEl) statusEl.textContent = document.title;
})();
