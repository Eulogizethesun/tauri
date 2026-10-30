// webview viewport probe — device-test fixture (openspec ohos-webview-sizing).
//
// Loaded as the page of a child webview (explicit bounds) or a sub-window
// webview (natural layout). Reports the RENDERED ArkWeb viewport —
// window.innerWidth/innerHeight plus documentElement.clientWidth/clientHeight —
// back to the Rust test tracker through the bare
// `window.__TAURI_INTERNALS__.invoke` seam (no @tauri-apps/api dependency,
// same real invoke path the iframe-ipc probe validated for child frames).
//
// Why the viewport is the render truth: the Web component size determines the
// ArkWeb viewport; when the ArkTS render layer inflates an explicitly-bounded
// child webview to the full window, the viewport inflates with it (the defect
// signature under test). The viewport also bounds content layout and this
// webview's content hit area, so it is the terminal observable of the sizing
// defect.
//
// Reports fire on script eval (init scripts have already installed
// __TAURI_INTERNALS__ by document-start) and on every window resize — the
// resize leg lets the setBounds/setSize cases observe the runtime geometry
// change. The Rust tracker keeps every sample; pollers take the latest per tag.
(function () {
  var statusEl = document.getElementById('status');
  function describeState(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function resolveTag() {
    // Init scripts freeze per-webview metadata into __TAURI_INTERNALS__ —
    // the webview label is a unique, query-string-free probe key.
    try {
      var label = window.__TAURI_INTERNALS__ &&
        window.__TAURI_INTERNALS__.metadata &&
        window.__TAURI_INTERNALS__.metadata.currentWebview &&
        window.__TAURI_INTERNALS__.metadata.currentWebview.label;
      if (typeof label === 'string' && label.length > 0) {
        return label;
      }
    } catch (_e) { /* fall through to the query param */ }
    try {
      var q = new URLSearchParams(window.location.search).get('tag');
      if (q) return q;
    } catch (_e) { /* no query — generic tag */ }
    return 'viewport-probe-unknown';
  }

  function report(reason) {
    var tag = resolveTag();
    var sample = {
      tag: tag,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      docWidth: document.documentElement ? document.documentElement.clientWidth : 0,
      docHeight: document.documentElement ? document.documentElement.clientHeight : 0
    };
    describeState('probe[' + tag + '] ' + reason + ': ' +
      sample.innerWidth + 'x' + sample.innerHeight +
      ' (doc ' + sample.docWidth + 'x' + sample.docHeight + ')');
    try {
      var internals = window.__TAURI_INTERNALS__;
      if (!internals || typeof internals.invoke !== 'function') {
        describeState('probe[' + tag + '] ' + reason + ': __TAURI_INTERNALS__.invoke missing');
        return;
      }
      // Fire-and-forget: the tracker is the durable record; a rejected invoke
      // would leave the poller timing out with the on-page state above as the
      // diagnostic.
      internals.invoke('track_webview_viewport_probe', sample);
    } catch (err) {
      describeState('probe[' + tag + '] ' + reason + ' invoke failed: ' + String(err));
    }
  }

  report('eval');
  window.addEventListener('load', function () { report('load'); });
  window.addEventListener('resize', function () { report('resize'); });
})();
