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

  // Phase A v2: per-frame timeline. All diag timestamps are ABSOLUTE
  // Date.now() values — both frames share the device clock, so parent-side
  // and child-side times are directly comparable in the evidence blob.
  function t() { return Date.now(); }

  // Callback ids this frame registered for the probe invokes, plus live
  // pending flags the message diagnostics can read on every relay arrival.
  var registeredIds = [];
  window.__iframeIpcProbeState = { echoPending: false, errorPending: false };

  // A command name that is not registered anywhere: the Rust ACL resolves it
  // to an error response, which exercises the error-callback relay path.
  var MISSING_CMD = '__tauri_iframe_probe_missing_cmd__';

  // ---------------------------------------------------------------------------
  // Phase A origin diagnostics (p1-iframe-ipc-response-routing follow-up).
  //
  // The relay's downlink (parent -> child postMessage) died silently on device
  // while the '*' targetOrigin handshake worked, so the prime suspect is the
  // targetOrigin semantics of the custom-protocol origin. Every frame reports
  // its own origin view, and the parent sends the same payload three times
  // with targetOrigin = [location.origin, '/', '*'] ("matrix"); this page
  // records which copies arrive and with what event.origin/event.source.
  // ---------------------------------------------------------------------------
  var diag = {
    // matrix[mark] = arrival record, null while not seen
    matrix: { origin: null, slash: null, star: null },
    // every __TAURI_FRAME_CALLBACK__ arrival with full decision context
    // (core.js's own listener runs first, so map/pending state is POST-call:
    // a once-callback that executed is already deleted and the pending flag
    // already flipped)
    relayArrivals: [],
    // callback id of any isolation-payload-shaped message (cmd+callback+...)
    isolationCallbackIds: [],
    // compact log of every message event (bounded)
    messageLog: [],
    runReceivedAt: null
  };

  function reportDiag() {
    return {
      registeredIds: registeredIds,
      matrix: diag.matrix,
      relayArrivals: diag.relayArrivals.slice(0, 8),
      isolationCallbackIds: diag.isolationCallbackIds,
      messageLog: diag.messageLog.slice(0, 16),
      runReceivedAt: diag.runReceivedAt
    };
  }

  function probeEnv() {
    var parentAccess = 'ok';
    var parentOrigin = null;
    var parentHref = null;
    var topAccess = 'ok';
    var topOrigin = null;
    try {
      parentOrigin = String(window.parent.location.origin);
      parentHref = String(window.parent.location.href);
    } catch (e) {
      parentAccess = 'ERR:' + (e && e.name ? e.name : String(e));
    }
    try {
      topOrigin = String(window.top.location.origin);
    } catch (e) {
      topAccess = 'ERR:' + (e && e.name ? e.name : String(e));
    }
    var origin = window.location.origin;
    if (origin === undefined || origin === null) {
      origin = 'MISSING:' + window.location.protocol + '//' + window.location.host;
    }
    return {
      href: String(window.location.href),
      protocol: String(window.location.protocol),
      origin: String(origin),
      isTop: window.top === window,
      parentIsTop: window.parent === window.top,
      frames: window.frames.length,
      secureContext: window.isSecureContext === true,
      parentAccess: parentAccess,
      parentOrigin: parentOrigin,
      parentHref: parentHref,
      topAccess: topAccess,
      topOrigin: topOrigin
    };
  }

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
      var sentAt = t();
      var timer = setTimeout(function () {
        if (!done) { done = true; resolve({ settled: false, phase: 'timeout', sentAt: sentAt, settledAt: t() }); }
      }, INVOKE_TIMEOUT_MS);

      function finish(value) {
        // Record the true settle time even when the timeout already fired:
        // a relay execution after the timeout is the late-delivery signature.
        value.settledAt = t();
        if (done) { return; }
        done = true;
        clearTimeout(timer);
        resolve(value);
      }

      try {
        var internals = window.__TAURI_INTERNALS__;
        var cb = internals.transformCallback(function (data) {
          window.__iframeIpcProbeState.echoPending = false;
          finish({ settled: true, result: data });
        }, true);
        var err = internals.transformCallback(function (e) {
          window.__iframeIpcProbeState.errorPending = false;
          finish({ settled: true, error: String(e) });
        }, true);
        registeredIds.push(cb, err);

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
      hasGlobalTauri: typeof window.__TAURI__ !== 'undefined',
      env: probeEnv()
    };
  }

  // Grandchild flow: report a single echo invoke back to the child probe page.
  function startGrandchildProbe() {
    setStatus('iframe-ipc-grandchild: invoking echo...');
    invokeFromIframe('echo', { message: 'from-grandchild' }).then(function (inv) {
      var probe = baseProbe();
      probe.invoke = inv;
      probe.diag = reportDiag();
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
      probe.diag = reportDiag();
      setStatus('iframe-ipc-child: invoke settled=' + probe.invoke.settled);
      send(probe);
    });
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data) { return; }

    // Phase A diagnostics: record every message before any role logic, so
    // guard-rejected deliveries stay observable.
    try {
      diag.messageLog.push({
        t: t(),
        o: String(event.origin),
        src: event.source === window.parent
          ? 'parent'
          : (event.source === window ? 'self' : 'other'),
        d: typeof data === 'object' && data !== null
          ? Object.keys(data).slice(0, 5).join('+')
          : String(data).slice(0, 24)
      });
    } catch (e) { /* diagnostics must never break the probe */ }
    if (typeof data === 'object' && data !== null) {
      if (data.__TAURI_FRAME_CALLBACK__ === true) {
        // core.js's own listener ran first: idInMap is post-call (a once
        // callback that executed is already gone). pending flags + arrival
        // time are the decision evidence.
        var st = window.__iframeIpcProbeState || {};
        diag.relayArrivals.push({
          t: t(),
          eventOrigin: String(event.origin),
          sourceIsParent: event.source === window.parent,
          id: typeof data.id === 'number' || typeof data.id === 'string' ? data.id : String(typeof data.id),
          registeredByProbe: registeredIds.indexOf(data.id) !== -1,
          echoPending: st.echoPending === true,
          errorPending: st.errorPending === true,
          mapSize: (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.callbacks)
            ? window.__TAURI_INTERNALS__.callbacks.size
            : -1
        });
      } else if (
        typeof data.cmd === 'string'
        && typeof data.callback !== 'undefined'
        && data.payload && typeof data.payload.nonce !== 'undefined'
      ) {
        diag.isolationCallbackIds.push({ t: t(), callback: String(data.callback) });
      }
      if (
        data.__iframeIpcParent === true
        && data.phase === 'matrix'
        && !diag.matrix[data.matrix]
      ) {
        diag.matrix[data.matrix] = {
          t: t(),
          eventOrigin: String(event.origin),
          sourceIsParent: event.source === window.parent
        };
      }
      if (data.__iframeIpcParent === true && data.phase === 'run') {
        diag.runReceivedAt = t();
      }
    }

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
