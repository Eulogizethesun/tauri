// Copyright 2019-2024 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

;(function () {
  function uid() {
    return window.crypto.getRandomValues(new Uint32Array(1))[0]
  }

  const osName = __TEMPLATE_os_name__
  const protocolScheme = __TEMPLATE_protocol_scheme__

  Object.defineProperty(window.__TAURI_INTERNALS__, 'convertFileSrc', {
    value: function (filePath, protocol = 'asset') {
      const path = encodeURIComponent(filePath)
      return osName === 'windows' || osName === 'android'
        ? `${protocolScheme}://${protocol}.localhost/${path}`
        : `${protocol}://localhost/${path}`
    }
  })

  const callbacks = new Map()

  function registerCallback(callback, once) {
    const identifier = uid()
    callbacks.set(identifier, (data) => {
      if (once) {
        unregisterCallback(identifier)
      }
      return callback && callback(data)
    })
    return identifier
  }

  function unregisterCallback(id) {
    // A miss in the TOP frame may still be a child frame's callback: iframe
    // invoke/listen handlers register in the frame that created them, while
    // the matching unlisten runs against the main document. Forward the
    // unregister down the relay so the child frame reclaims its `callbacks`
    // entry too (issue Eulogizethesun/tauri#241). Deliberately silent — an
    // unknown id is a legitimate no-op here (e.g. a double unlisten), unlike
    // a missed response.
    if (!callbacks.delete(id) && relayEnabled && isTopFrame && window.frames.length > 0) {
      relayUnlistenToChildFrames(id)
    }
  }

  function runCallback(id, data) {
    const callback = callbacks.get(id)
    if (callback) {
      callback(data)
    } else if (relayEnabled && isTopFrame && window.frames.length > 0) {
      // No local hit, but child frames exist: the id belongs to a callback
      // registered inside a child frame (iframe invoke/listen handlers live
      // in the frame that created them, while responses replay in the MAIN
      // document). Forward first and stay quiet — a healthy iframe response
      // missing the top-frame table is the normal path, not an error. The
      // warning below is reserved for ids nothing could claim (e.g. the app
      // reloaded while Rust was running an asynchronous operation).
      relayToChildFrames(id, data)
    } else {
      console.warn(
        `[TAURI] Couldn't find callback id ${id}. This might happen when the app is reloaded while Rust is running an asynchronous operation.`
      )
    }
  }

  // IPC callback relay (OHOS only). On OHOS the IPC runs in postMessage mode
  // (see scripts/ipc-protocol.js: the custom-protocol fetch channel excludes
  // `ohos` just like `android`) and the Rust-side response — invoke results,
  // channel messages and events all funnel into
  // `window.__TAURI_INTERNALS__.runCallback(id, data)` — is replayed through a
  // webview eval that only executes in the MAIN document (ArkWeb has no
  // frame-targeted eval). Init scripts run in every frame, so callbacks
  // registered inside an iframe would never receive their response. When the
  // top frame misses the callback id it relays `{ id, data }` to its direct
  // child frames; each child frame replays it against its own local `Map` and
  // relays further down when nesting deeper. The relay carries the reverse
  // direction too (`__TAURI_FRAME_UNLISTEN__`): an unregister for a callback
  // that lives in a child frame is forwarded down so the iframe's `callbacks`
  // entry is reclaimed instead of leaking (issue Eulogizethesun/tauri#241).
  // Delivery stays same-origin:
  // `postMessage` drops the message when the target origin does not match, so
  // cross-origin frames keep the pre-relay behavior (no delivery, no data
  // leak). Android shares the upstream defect but stays untouched here —
  // extending the activation list is left for an upstream PR.
  const relayEnabled = osName === 'ohos'
  const isTopFrame = window.top === window

  function postToChildFrames(message) {
    // A frame may already be detached by the app; give each `postMessage` its
    // own `try` so one dead frame cannot abort the broadcast to the others.
    for (let i = 0; i < window.frames.length; i++) {
      try {
        window.frames[i].postMessage(message, window.location.origin)
      } catch (e) {
        // frame is gone — keep relaying to the remaining ones
      }
    }
  }

  function relayToChildFrames(id, data) {
    postToChildFrames({ __TAURI_FRAME_CALLBACK__: true, id: id, data: data })
  }

  // Unregister side of the relay (issue Eulogizethesun/tauri#241): reclaims
  // the child frame's `callbacks` entry for callbacks whose unregister ran in
  // the top frame (iframe event listeners register their handler there).
  function relayUnlistenToChildFrames(id) {
    postToChildFrames({ __TAURI_FRAME_UNLISTEN__: true, id: id })
  }

  if (relayEnabled && !isTopFrame) {
    // Child-frame side of the relay: accept only same-origin messages from the
    // DIRECT parent (any other source or origin is ignored, so hand-posted or
    // forged `__TAURI_FRAME_CALLBACK__` messages cannot reach the callback
    // table), then execute the callback against the local `Map` — the exact
    // path an eval response takes, once semantics included. A miss with own
    // child frames relays further down; a miss without them is a dead end
    // (already unregistered or foreign id).
    window.addEventListener('message', function (event) {
      if (
        event.origin !== window.location.origin
        || event.source !== window.parent
      ) {
        return
      }
      const data = event.data
      if (!data) {
        return
      }
      if (data.__TAURI_FRAME_CALLBACK__ === true) {
        const callback = callbacks.get(data.id)
        if (callback) {
          callback(data.data)
        } else if (window.frames.length > 0) {
          relayToChildFrames(data.id, data.data)
        } else {
          console.warn(
            `[TAURI] Couldn't find callback id ${data.id} forwarded from the parent frame. This might happen when the app is reloaded while Rust is running an asynchronous operation.`
          )
        }
      } else if (data.__TAURI_FRAME_UNLISTEN__ === true) {
        // Callback ids are unique: once this frame claims (and deletes) the
        // entry the unregister stops, otherwise it cascades to nested frames.
        if (!callbacks.delete(data.id) && window.frames.length > 0) {
          relayUnlistenToChildFrames(data.id)
        }
      }
    })
  }

  // Maybe let's rename it to `registerCallback`?
  Object.defineProperty(window.__TAURI_INTERNALS__, 'transformCallback', {
    value: registerCallback
  })

  Object.defineProperty(window.__TAURI_INTERNALS__, 'unregisterCallback', {
    value: unregisterCallback
  })

  Object.defineProperty(window.__TAURI_INTERNALS__, 'runCallback', {
    value: runCallback
  })

  // This is just for the debugging purposes
  Object.defineProperty(window.__TAURI_INTERNALS__, 'callbacks', {
    value: callbacks
  })

  const ipcQueue = []
  let isWaitingForIpc = false

  function waitForIpc() {
    if ('ipc' in window.__TAURI_INTERNALS__) {
      for (const action of ipcQueue) {
        action()
      }
    } else {
      setTimeout(waitForIpc, 50)
    }
  }

  Object.defineProperty(window.__TAURI_INTERNALS__, 'invoke', {
    value: function (cmd, payload = {}, options) {
      return new Promise(function (resolve, reject) {
        const callback = registerCallback((r) => {
          resolve(r)
          unregisterCallback(error)
        }, true)
        const error = registerCallback((e) => {
          reject(e)
          unregisterCallback(callback)
        }, true)

        const action = () => {
          window.__TAURI_INTERNALS__.ipc({
            cmd,
            callback,
            error,
            payload,
            options
          })
        }
        if ('ipc' in window.__TAURI_INTERNALS__) {
          action()
        } else {
          ipcQueue.push(action)
          if (!isWaitingForIpc) {
            waitForIpc()
            isWaitingForIpc = true
          }
        }
      })
    }
  })
})();
