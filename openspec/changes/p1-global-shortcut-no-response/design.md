# Design: Global Shortcut No Response Fix

## Context

See [proposal.md](./proposal.md) for the root cause analysis. Summary: `extend_api` returns `true` (JS Plugin is NOT the current root cause). The actual issue is the fire-and-forget pattern hiding bridge-call failures. The JS Plugin is a latent bug that should be fixed defensively.

## Call Chain Diagram

```
Frontend: invoke('plugin:global-shortcut|register', { shortcuts, handler })
  │
  ▼
webview/mod.rs:1834  parse "plugin:global-shortcut|register"
                     → plugin="global-shortcut", command="register"
  │
  ▼
webview/mod.rs:1843  ACL check (passed: ohos-plugins.json grants allow-register)
  │
  ▼
webview/mod.rs:1883  handled = manager.extend_api("global-shortcut", invoke)
  │                   │
  │                   ▼
  │             plugin.rs:975  PluginStore::extend_api()
  │                   │   finds plugin "global-shortcut" in store
  │                   ▼
  │             plugin.rs:850  TauriPlugin::extend_api(invoke)
  │                   │   calls (self.invoke_handler)(invoke)
  │                   ▼
  │             generate_handler! closure:
  │                   match invoke.message.command() {
  │                     "register" => register_wrapper!(register, invoke),
  │                     ...
  │                   }
  │                   │
  │                   ▼
  │             lib.rs:749  #[tauri::command] fn register(...)
  │                   │   parses shortcuts from Vec<String>
  │                   │   creates Channel<ShortcutJsEvent> handler
  │                   ▼
  │             lib.rs:764  global_shortcut.register_multiple_internal(hotkeys, handler)
  │                   │
  │                   ▼
  │             lib.rs:501-516  #[cfg(target_env="ohos")]
  │                   if let Some(ref client) = self.client {
  │                     std::thread::spawn(move || {
  │                       block_on(client.register(sid, &mods, &key))  ← ASYNC, fire-and-forget
  │                         │
  │                         ▼
  │                       GlobalShortcutClient::register() [openharmony-ability]
  │                         if sdk_api_version() < 14 { return Ok(()) }  ← SILENT SKIP
  │                         self.bridge.call_async("register", request)
  │                           │
  │                           ▼
  │                         BridgeRuntime → TSFN → ArkTS main thread
  │                           │
  │                           ▼
  │                         GlobalShortcutPlugin.ets:150  invokeAsync("register", ...)
  │                           │
  │                           ▼
  │                         registerHotkey(): inputConsumer.on("hotkeyChange", ...)
  │                           │
  │                           ▼  (on success: returns true → ack(true))
  │                           ▼  (on failure: catches error, returns false → ack(false))
  │                     });
  │                   } else {
  │                     // client is None → SILENTLY SKIPPED
  │                   }
  │                   │
  │                   ▼
  │             shortcuts.insert(id, RegisteredShortcut{...})  ← added to local map regardless
  │             return Ok(())  ← FRONTEND RECEIVES SUCCESS
  │
  ▼  (handled = true)
webview/mod.rs:1885  #[cfg(mobile)] { if !handled { ... } }  ← SKIPPED (handled is true)
  │
  ▼
Frontend receives: success (but hotkey may not be registered)
```

### Why the JS Plugin is NOT called

```
EntryAbility.ets:104  tauri_init_plugins(pluginManager)
  │
  ▼
ohos_plugin.rs:56  tauri_init_plugins(env, manager)
  │   reads PLUGINS_TO_REGISTER → EMPTY (no register_ohos_plugin! calls)
  │   returns "[]"
  │
  ▼
EntryAbility.ets:113  for (const plugin of []) { ... }  ← NO PLUGINS LOADED
  │
  ▼
PluginManager.globalPlugins: empty Map
  │
  ▼
If mobile::run_command were called (it isn't):
  PluginManager.runCommand(id, "global-shortcut", "register", payload)
  → globalPlugins.get("global-shortcut") → undefined
  → reject("Plugin not found: global-shortcut")
```

## Solution Design

### Part 1: Fix JS Plugin (latent bug)

**File**: `plugins-workspace/plugins/global-shortcut/openharmony/src/main/ets/Plugin.ets`

**Current code** (line 26-37):
```typescript
private handleRegister(invoke: Invoke): void {
  try {
    const argsStr = invoke.parseArgs();
    hilog.debug(DOMAIN, 'GlobalShortcutPlugin', 'register args: %{public}s', argsStr);
    invoke.resolve(JSON.stringify({ success: true }));  // ← SILENT SUCCESS
  } catch (e) {
    invoke.reject('Register failed: ' + (e as Error).message);
  }
}
```

**Changed code**:
```typescript
private handleRegister(invoke: Invoke): void {
  invoke.reject('Global shortcut register is handled by the Rust-side bridge plugin. ' +
    'If you see this error, the JS Plugin fallback was incorrectly invoked. ' +
    'Check that generate_handler! includes the register command and removeUnusedCommands is false.');
}
```

Apply the same pattern to `handleUnregister`, `handleUnregisterAll`, `handleIsRegistered`.

**Rationale**: The JS Plugin cannot and should not handle global shortcut commands. The actual registration is done by the Rust handler via the bridge plugin (`GlobalShortcutBridgePlugin` in `openharmony-ability`). If the JS Plugin is ever invoked, it should fail loudly to aid debugging.

### Part 2: Improve error propagation in Rust handler (actual root cause)

**File**: `plugins-workspace/plugins/global-shortcut/src/lib.rs`

#### 2a. Log at error level in `ohos_setup` when client is None

**Current** (line 387-391):
```rust
} else {
    log::warn!(
        "GlobalShortcutClient not initialized; skipping shortcut registration"
    );
}
```

**Changed**:
```rust
} else {
    log::error!(
        "[global-shortcut] GlobalShortcutClient not initialized — bridge session may not be ready. \
         All shortcut registrations will be silently skipped. \
         Check that OpenHarmonyApp::bridge() succeeds during plugin setup."
    );
}
```

#### 2b. Log at error level when bridge call fails in worker thread

**Current** (line 470-475, also 380-385, 508-514):
```rust
std::thread::spawn(move || {
    if let Err(e) = futures_executor::block_on(client.register(sid, &modifier_names, &key)) {
        log::warn!("Failed to register shortcut {}: {:?}", sid, e);
    }
});
```

**Changed**:
```rust
std::thread::spawn(move || {
    if let Err(e) = futures_executor::block_on(client.register(sid, &modifier_names, &key)) {
        log::error!(
            "[global-shortcut] Bridge call failed for shortcut id={} (key={}): {:?}. \
             The shortcut was added to the local registry but is NOT registered with the OS. \
             isRegistered() will return true but the hotkey will not trigger.",
            sid, key, e
        );
    }
});
```

Apply to all 3 fire-and-forget sites: `ohos_setup` (line 380), `register_internal` (line 470), `register_multiple_internal` (line 508).

#### 2c. Add setup-time diagnostics in `ohos_setup`

After the `register_plugin` call and the `client` acquisition, add diagnostic logging:

```rust
log::info!(
    "[global-shortcut] ohos_setup: APP={}, bridge_plugin_registered={}, client={}",
    guard.is_some(),
    register_result.is_ok(),
    client.is_some()
);
```

This will immediately reveal whether the bridge session is ready at setup time.

### Part 3: (Future, optional) Synchronous registration with timeout

The fire-and-forget pattern is inherently problematic for global shortcuts because the frontend cannot know if registration succeeded. A future improvement would be to use the bridge's async response (not fire-and-forget) and propagate the result through the `Channel<ShortcutJsEvent>` as an error event. This is deferred because it requires changes to the `Channel` event protocol and frontend handling.

## API Mapping

| Tauri API | OHOS API | Notes |
|-----------|----------|-------|
| `register(shortcut, handler)` | `inputConsumer.on("hotkeyChange", HotkeyOptions, callback)` | Via bridge plugin `GlobalShortcutBridgePlugin.invokeAsync("register", ...)` |
| `unregister(shortcut)` | `inputConsumer.off("hotkeyChange", HotkeyOptions, callback)` | Via bridge plugin `invokeAsync("unregister", ...)` |
| `unregisterAll()` | Iterate + `inputConsumer.off(...)` for each | Via bridge plugin `invokeAsync("unregister-all", ...)` |
| `isRegistered(shortcut)` | Local HashMap lookup | Does NOT query OS state (documented limitation) |

## Edge Cases

1. **API version < 14**: `inputConsumer.on("hotkeyChange")` requires API 14+. On lower versions, `client.register()` silently returns `Ok(())`. The `ohos_setup` diagnostics (Part 2c) will show `client=Some` but the bridge call will return success without doing anything. Consider adding a version check log.

2. **Bridge session not ready**: If `OpenHarmonyApp::bridge()` fails during `ohos_setup`, `client` is `None`. All registrations are silently skipped. The `ohos_setup` diagnostics (Part 2c) will show `client=None`.

3. **Stale HAR cache**: Per MEMORY note [OHOS ohpm ability.har 缓存陷阱], after changing ArkTS code (Plugin.ets), must delete `oh_modules` + `CompileArkTS` cache to ensure the new code is compiled.

4. **`removeUnusedCommands: true`**: If the build config changes to `removeUnusedCommands: true`, the ACL must include `global-shortcut:allow-register` for the `openHarmony` platform. Currently `ohos-plugins.json` has this, so it should be fine. But if the capability file is removed, `extend_api` would return `false` and the mobile fallback would reject with "Plugin not found" (since `PLUGINS_TO_REGISTER` is empty).

## Cross-Platform Impact Assessment

| Platform | Impact | Reason |
|----------|--------|--------|
| Windows | None | All Rust changes gated by `cfg(target_env = "ohos")` |
| macOS | None | Same |
| Linux | None | Same |
| OHOS mobile | Fixed | Error logging reveals bridge-call failures |
| OHOS desktop | Fixed | Same (global shortcuts work on both form factors) |

### Iron Rule Compliance

- **Iron #1**: `openharmony-ability` is the sole ArkTS bridge — no ArkTS API calls added outside `openharmony-ability`. The JS Plugin fix is in the Tauri plugin layer, not the bridge仓.
- **Iron #2**: All Rust changes use `cfg(target_env = "ohos")` or are in OHOS-only files. No desktop code paths modified.
- **Iron #3**: `OHOS_DEVICE_TYPE` is not referenced or affected. Global shortcuts work on both mobile and desktop.
