# Fix: Global Shortcut (Ctrl+Shift+T) No Response on OHOS

## Why

On OHOS, registering a global shortcut via `invoke('plugin:global-shortcut|register')` appears to succeed from the frontend's perspective, but pressing the registered key combination (e.g., Ctrl+Shift+T) produces no response. The hotkey is never actually registered with the OS-level `inputConsumer.on("hotkeyChange")`.

The task hypothesis blamed the JS Plugin (`Plugin.ets`) for short-circuiting `handleRegister` with `invoke.resolve({success:true})`. However, code-level analysis reveals a different root cause: **the fire-and-forget pattern in the Rust `register` command hides bridge-call failures from the frontend**, and the JS Plugin is actually unreachable (never loaded into PluginManager).

## Root Cause (Confirmed via Code Analysis)

### `extend_api` returns `true`, NOT `false`

The dispatch code at `webview/mod.rs:1883`:

```
let mut handled = manager.extend_api(plugin, invoke);  // ← returns true
#[cfg(mobile)]
{
  if !handled { ... mobile::run_command ... }  // ← SKIPPED
}
```

`extend_api` returns `true` because:

1. **Plugin IS registered in PluginStore** — `examples/api/src-tauri/src/lib.rs:163` calls `.plugin(tauri_plugin_global_shortcut::Builder::new().build())`
2. **Commands are NOT stripped by ACL** — `tauri.conf.json` has `"removeUnusedCommands": false`, so the `REMOVE_UNUSED_COMMANDS` env var is never set by `tauri-cli`. The plugin's `build.rs` removes `allowed_commands.json`, causing `read_allowed_commands()` to return `None`, and `filter_unused_commands` returns early (all commands kept).
3. **Command name matches** — `generate_handler![register, ...]` produces a match arm for `stringify!(register)` = `"register"`, which matches the command name parsed from `plugin:global-shortcut|register`.

### JS Plugin (`Plugin.ets`) is unreachable

The JS Plugin is NEVER loaded into `PluginManager` because:

1. `PLUGINS_TO_REGISTER` (a `Mutex<Vec<PluginRegistration>>` in `tauri/src/ohos.rs:33`) is **empty** for external plugins — no code calls `register_ohos_plugin!` or `ohos_plugin_register()` for `tauri-plugin-global-shortcut`.
2. `tauri_init_plugins()` (in `ohos_plugin.rs:56`) returns `"[]"` (empty JSON array).
3. `EntryAbility.initTauriPlugins()` iterates the empty list and loads nothing.
4. Even if `extend_api` returned `false`, `mobile::run_command` would dispatch to `PluginManager.runCommand`, which would reject with "Plugin not found: global-shortcut" (NOT silently succeed).

### Actual root cause: fire-and-forget hides bridge-call failures

The Rust `register` command calls `register_multiple_internal`, which spawns a worker thread and returns `Ok(())` **immediately**:

```rust
// lib.rs:508-516
std::thread::spawn(move || {
    if let Err(e) = futures_executor::block_on(client.register(sid, &modifier_names, &key)) {
        log::warn!("Failed to register shortcut {}: {:?}", sid, e);  // ← error swallowed
    }
});
```

The frontend receives success before the bridge call completes. If the bridge call fails, the error is only logged as a warning. The shortcut is also inserted into the local `shortcuts` map regardless, so `isRegistered()` returns `true` even when OS-level registration failed.

### Potential bridge-call failure points

1. **`client` is `None`** — In `ohos_setup()`, `app.global_shortcut()` calls `OpenHarmonyApp::bridge()` which returns `Err("Bridge runtime is not ready...")` if the bridge session is not active during plugin setup. `client` becomes `None`, and registration is silently skipped.
2. **API version guard** — `GlobalShortcutClient::register()` returns `Ok(())` immediately if `sdk_api_version() < 14`.
3. **`inputConsumer.on("hotkeyChange")` failure** — ArkTS bridge plugin catches errors (code 801 unsupported, 4200002 occupied, 4200003 already subscribed) and returns `accepted: false`, which `ShortcutAcknowledgement::ensure()` turns into an `Err` — but the worker thread only logs it.

## What Changes

### 1. Fix JS Plugin to reject instead of silently succeeding (latent bug fix)

Even though the JS Plugin is currently unreachable, it is a latent bug. If `PLUGINS_TO_REGISTER` is ever populated (e.g., by adding `ohos_plugin_register` calls) or `extend_api` returns `false` due to ACL changes, the JS Plugin would silently succeed without registering anything.

**Change**: All 4 handlers in `Plugin.ets` (`handleRegister`, `handleUnregister`, `handleUnregisterAll`, `handleIsRegistered`) should reject with a descriptive error instead of resolving `{success:true}` / `{value:false}`.

### 2. Add bridge-call error propagation (actual root cause fix)

The fire-and-forget pattern in `register_multiple_internal` should be changed to propagate bridge-call failures back to the frontend, or at minimum log them at `error` level (not `warn`).

**Option A (recommended)**: Change the fire-and-forget worker thread to use the `Channel<ShortcutJsEvent>` to send an error event if registration fails, so the frontend can handle it.

**Option B (simpler)**: Log at `error` level and add a `hilog` trace on the ArkTS bridge plugin side to help diagnose the actual failure point.

### 3. Verify bridge session readiness during `ohos_setup`

Add debug logging in `ohos_setup()` to confirm:
- Whether `tauri::ohos::APP` is `Some` at setup time
- Whether `app.global_shortcut()` (i.e., `app.bridge()`) succeeds or fails
- Whether `register_plugin(GlobalShortcutBridgePlugin)` succeeds

## Capabilities

### New Capabilities
- `global-shortcut-error-propagation`: Propagate bridge-call failures from the global shortcut Rust handler to the frontend, and fix the JS Plugin to reject instead of silently succeeding.

### Modified Capabilities
- (none)

## Impact

### Affected platforms
- **OHOS only** — all changes are gated by `cfg(target_env = "ohos")` or are in OHOS-specific files (`Plugin.ets`). No impact on Windows/macOS/Linux.

### Affected files
1. `plugins-workspace/plugins/global-shortcut/openharmony/src/main/ets/Plugin.ets` — Fix JS Plugin handlers to reject
2. `plugins-workspace/plugins/global-shortcut/src/lib.rs` — Improve error propagation/logging in `register_multiple_internal` and `ohos_setup`
3. `tauri/examples/api/src-tauri/gen/ohos/global-shortcut/src/main/ets/Plugin.ets` — Auto-regenerated from (1) on next build

### Three Iron Rules compliance
- **Iron #1**: `openharmony-ability` is the sole ArkTS bridge — the bridge plugin (`GlobalShortcutPlugin.ets` in `openharmony-ability/plugins/`) is unchanged. The JS Plugin (`Plugin.ets` in `plugins-workspace`) is a Tauri plugin-layer file, not a bridge仓 file.
- **Iron #2**: No impact on other platforms — all Rust changes use `cfg(target_env = "ohos")`. The JS Plugin is OHOS-only.
- **Iron #3**: `OHOS_DEVICE_TYPE` is not affected — global shortcuts work on both mobile and desktop form factors.
