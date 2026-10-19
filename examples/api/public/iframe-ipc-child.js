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
//      routed back to the frame that registered the callback
//   3. whether the ERROR callback id is relayed too: a hand-rolled invoke of a
//      command that does not exist must settle via reject (error callback),
//      not time out
//   4. whether the relay chains down to a grandchild iframe (same probe page,
//      ?role=grandchild) — two postMessage hops
//   5. whether the relay listener ignores a forged __TAURI_FRAME_CALLBACK__
//      message whose source is not the direct parent
//
// The invoke below is hand-rolled from transformCallback + postMessage: it is
// the exact non-isolation path @tauri-apps/api's invoke() takes, without
// depending on the isolation layer that only the main document sets up.
(function () {
  var INVOKE_TIMEOUT_MS = 6000;
  var GRANDCHILD_TIMEOUT_MS = 8000;
  var FORGED_WAIT_MS = 500;

  // A command name that is not registered anywhere: the Rust ACL resolves it
  // to an error response, which exercises the error-callback relay path.
  var MISSING_CMD = '__tauri_iframe_probe_missing_cmd__';

  // `?role=grandchild` turns this page into the nested probe: same flow, one
  // level deeper (its "parent" is then the child probe page).
  var isGrandchild = window.location.search.indexOf('role=grandchild') !== -1;

  var grandchildWindow = null;
  var finishGrandchild = null;

  function send(msg) {
    // Tag every message so the receiver can distinguish ours from other
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

  // Nest a same-source grandchild iframe (kept 1px VISIBLE: display:none
  // makes ArkWeb skip script injection) and relay the run handshake down.
  // Resolves the grandchild's invoke report, or a timeout marker.
  function runGrandchildProbe() {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) {
          done = true;
          resolve({ settled: false, phase: 'grandchild-never-reported' });
        }
      }, GRANDCHILD_TIMEOUT_MS);

      finishGrandchild = function (inv) {
        if (done) { return; }
        done = true;
        clearTimeout(timer);
        resolve(inv);
      };

      var frame = document.createElement('iframe');
      frame.src = 'iframe-ipc-child.html?role=grandchild';
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '1px';
      frame.style.height = '1px';
      frame.style.border = '0';
      document.body.appendChild(frame);
      grandchildWindow = frame.contentWindow;
    });
  }

  // Forged-message guard: post a __TAURI_FRAME_CALLBACK__ message from our own
  // window (event.source === window !== window.parent) carrying a REAL,
  // freshly registered callback id. The relay listener must ignore it —
  // delivered but never executed. Resolves true only in that case.
  function runForgedCheck() {
    return new Promise(function (resolve) {
      var internals = window.__TAURI_INTERNALS__;
      var forgedExecuted = false;
      var delivered = false;

      var targetId = internals.transformCallback(function () {
        forgedExecuted = true;
      }, true);

      function onForged(event) {
        var d = event.data;
        if (d && d.__TAURI_FRAME_CALLBACK__ === true && d.forged === true) {
          delivered = true;
          window.removeEventListener('message', onForged);
        }
      }
      window.addEventListener('message', onForged);

      window.postMessage({
        __TAURI_FRAME_CALLBACK__: true,
        id: targetId,
        data: 'forged',
        forged: true
      }, '*');

      setTimeout(function () {
        window.removeEventListener('message', onForged);
        resolve(delivered === true && forgedExecuted === false);
      }, FORGED_WAIT_MS);
    });
  }

  function baseProbe() {
    var internals = window.__TAURI_INTERNALS__;
    return {
      phase: 'result',
      role: isGrandchild ? 'grandchild' : 'child',
      internalsType: typeof window.__TAURI_INTERNALS__,
      hasInternalsPostMessage: !!(internals && typeof internals.postMessage === 'function'),
      hasTransformCallback: !!(internals && typeof internals.transformCallback === 'function'),
      hasIpc: !!(window.ipc && typeof window.ipc.postMessage === 'function'),
      hasGlobalTauri: typeof window.__TAURI__ !== 'undefined'
    };
  }

  // Grandchild flow: report a single echo invoke back to the child probe page.
  function startGrandchildProbe() {
    setStatus('iframe-ipc-grandchild: invoking echo...');
    invokeFromIframe('echo', { message: 'from-grandchild' }).then(function (inv) {
      var probe = baseProbe();
      probe.invoke = inv;
      setStatus('iframe-ipc-grandchild: invoke settled=' + inv.settled);
      send(probe);
    });
  }

  // Child flow: run every sub-probe in parallel, then report once.
  function startChildProbe() {
    var probe = baseProbe();
    setStatus('iframe-ipc-child: probing invoke/error/grandchild/forged...');

    Promise.all([
      invokeFromIframe('echo', { message: 'from-iframe' }),
      invokeFromIframe(MISSING_CMD, {}),
      runGrandchildProbe(),
      runForgedCheck()
    ]).then(function (r) {
      probe.invoke = r[0];
      probe.invokeError = r[1];
      probe.grandchildInvoke = r[2];
      probe.forgedIgnored = r[3];
      setStatus('iframe-ipc-child: invoke settled=' + probe.invoke.settled);
      send(probe);
    });
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data) { return; }

    if (isGrandchild) {
      // The child probe page (our parent) tells us to run.
      if (data.__iframeIpcParent === true && data.phase === 'run') {
        startGrandchildProbe();
      }
      return;
    }

    if (
      data.__iframeIpcParent === true
      && data.phase === 'run'
      && event.source === window.parent
    ) {
      startChildProbe();
    } else if (
      grandchildWindow
      && event.source === grandchildWindow
      && data.__iframeIpcChild === true
    ) {
      if (data.phase === 'ready') {
        grandchildWindow.postMessage({ __iframeIpcParent: true, phase: 'run' }, '*');
      } else if (data.phase === 'result' && finishGrandchild) {
        finishGrandchild(data.invoke);
      }
    }
  });

  if (isGrandchild) {
    setStatus('iframe-ipc-grandchild: ready');
  } else {
    setStatus('iframe-ipc-child: ready');
  }
  send({ phase: 'ready', role: isGrandchild ? 'grandchild' : 'child' });
})();
