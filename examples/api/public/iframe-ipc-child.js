// iframe IPC probe — child side.
//
// Loaded inside a same-origin <iframe> by the core.ts test
// "@tauri-apps/api/core.invoke (iframe child frame routing)". Reports, via the
// NATIVE window.postMessage handshake (never the Tauri IPC under test):
//
//   1. whether the Tauri init scripts reached this iframe document at all
//      (window.__TAURI_INTERNALS__, ipc-protocol.js, window.ipc)
//   2. whether an invoke('echo') issued FROM this iframe settles — i.e.
//      whether the Rust-side response (runCallback via webview eval) is
//      routed back to the frame that registered the callback.
//
// The invoke below is hand-rolled from transformCallback + postMessage: it is
// the exact non-isolation path @tauri-apps/api's invoke() takes, without
// depending on the isolation layer that only the main document sets up.
(function () {
  var INVOKE_TIMEOUT_MS = 6000;

  function send(msg) {
    // Tag every message so the parent can distinguish ours from other
    // window.postMessage traffic (e.g. tauri isolation frames).
    msg.__iframeIpcChild = true;
    window.parent.postMessage(msg, '*');
  }

  function setStatus(text) {
    var el = document.getElementById('status');
    if (el) { el.textContent = text; }
  }

  // Minimal invoke(): register resolve/reject callbacks, then hand the message
  // to __TAURI_INTERNALS__.postMessage (ipc-protocol.js's sendIpcMessage —
  // on OHOS it always routes through window.ipc.postMessage).
  // Resolves { settled: true, result } / { settled: true, error } /
  // { settled: false, phase: 'timeout' }.
  function invokeFromIframe(cmd, args) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; resolve({ settled: false, phase: 'timeout' }); }
      }, INVOKE_TIMEOUT_MS);

      function finish(value) {
        if (done) { return; }
        done = true;
        clearTimeout(timer);
        resolve(value);
      }

      try {
        var internals = window.__TAURI_INTERNALS__;
        var cb = internals.transformCallback(function (data) {
          finish({ settled: true, result: data });
        }, true);
        var err = internals.transformCallback(function (e) {
          finish({ settled: true, error: String(e) });
        }, true);

        internals.postMessage({
          cmd: cmd,
          callback: cb,
          error: err,
          payload: args,
          options: {}
        });
      } catch (e) {
        finish({ settled: true, thrown: String(e) });
      }
    });
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.__iframeIpcParent !== true || data.phase !== 'run') { return; }

    var internals = window.__TAURI_INTERNALS__;
    var probe = {
      phase: 'result',
      internalsType: typeof window.__TAURI_INTERNALS__,
      hasInternalsPostMessage: !!(internals && typeof internals.postMessage === 'function'),
      hasTransformCallback: !!(internals && typeof internals.transformCallback === 'function'),
      hasIpc: !!(window.ipc && typeof window.ipc.postMessage === 'function'),
      hasGlobalTauri: typeof window.__TAURI__ !== 'undefined'
    };

    setStatus('iframe-ipc-child: invoking echo...');

    invokeFromIframe('echo', { message: 'from-iframe' }).then(function (inv) {
      probe.invoke = inv;
      setStatus('iframe-ipc-child: invoke settled=' + inv.settled);
      send(probe);
    });
  });

  setStatus('iframe-ipc-child: ready');
  send({ phase: 'ready' });
})();
