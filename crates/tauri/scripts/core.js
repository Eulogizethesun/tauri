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
    callbacks.delete(id)
  }

  function runCallback(id, data) {
    const callback = callbacks.get(id)
    if (callback) {
      callback(data)
    } else {
      console.warn(
        `[TAURI] Couldn't find callback id ${id}. This might happen when the app is reloaded while Rust is running an asynchronous operation.`
      )
      if (relayEnabled && isTopFrame) {
        // The id belongs to a callback registered inside a child frame —
        // relay the response down to the direct child frames.
        relayToChildFrames(id, data)
      }
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
  // relays further down when nesting deeper. Delivery stays same-origin:
  // `postMessage` drops the message when the target origin does not match, so
  // cross-origin frames keep the pre-relay behavior (no delivery, no data
  // leak). Android shares the upstream defect but stays untouched here —
  // extending the activation list is left for an upstream PR.
  const relayEnabled = osName === 'ohos'
  const isTopFrame = window.top === window

  function relayToChildFrames(id, data) {
    const message = { __TAURI_FRAME_CALLBACK__: true, id: id, data: data }
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
      if (!data || data.__TAURI_FRAME_CALLBACK__ !== true) {
        return
      }
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
