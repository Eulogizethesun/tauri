# Spec: Global Shortcut Error Propagation

## Overview

The global shortcut registration on OHOS uses a fire-and-forget pattern that hides bridge-call failures from the frontend. This spec defines the requirements for error visibility and defensive JS Plugin behavior.

## Requirements

### REQ-1: JS Plugin must not silently succeed

The JS Plugin (`Plugin.ets`) handlers for `register`, `unregister`, `unregisterAll`, and `isRegistered` must NOT resolve with a success response. They must reject with a descriptive error message explaining that the Rust bridge plugin should handle these commands.

**Rationale**: The JS Plugin cannot access `inputConsumer.on("hotkeyChange")` and should not be a fallback for global shortcut operations. If it is ever invoked, the failure must be visible.

### REQ-2: Bridge-call failures must be logged at error level

When `client.register()`, `client.unregister()`, or `client.unregister_all()` fails in a worker thread, the error must be logged at `error` level (not `warn`), and must include:
- The shortcut ID
- The shortcut key name (for register/unregister)
- The error message
- A note that `isRegistered()` will return true but the hotkey will not trigger

### REQ-3: Setup-time diagnostics must be logged

The `ohos_setup()` function must log a diagnostic line showing:
- Whether `tauri::ohos::APP` was `Some` or `None`
- Whether `register_plugin(GlobalShortcutBridgePlugin)` succeeded
- Whether `client` was `Some` or `None`

This must be logged at `info` level to help diagnose bridge session readiness issues.

### REQ-4: No impact on desktop platforms

All Rust changes must be gated by `cfg(target_env = "ohos")`. The JS Plugin changes are in an OHOS-only file (`openharmony/src/main/ets/Plugin.ets`). No desktop code paths may be modified.

## Test Cases

### auto (automatable)
- (none — bridge calls require a device)

### side-effect (verifiable on device)
- `global-shortcut.register+isRegistered`: Register a shortcut, verify `isRegistered` returns true. Check hilog for bridge plugin `register ENTER` log.
- `global-shortcut.unregister+isRegistered`: Unregister and verify `isRegistered` returns false.

### manual (requires human confirmation)
- `global-shortcut.triggerCallback`: Register Ctrl+Shift+T, physically press the key combination, verify the callback fires.
- `global-shortcut.setupDiagnostics`: After app launch, check hilog for `[global-shortcut] ohos_setup:` line showing `client=true`.
- `global-shortcut.jsPluginReject`: If JS Plugin is somehow invoked (e.g., by temporarily breaking ACL), verify it rejects with a descriptive error instead of silently succeeding.

## API Mapping

| Tauri API (JS) | Tauri Command (Rust) | OHOS Bridge Action | OHOS System API |
|---|---|---|---|
| `register(shortcuts, handler)` | `plugin:global-shortcut\|register` | `GlobalShortcutBridgePlugin.invokeAsync("register", ...)` | `inputConsumer.on("hotkeyChange", HotkeyOptions, callback)` |
| `unregister(shortcuts)` | `plugin:global-shortcut\|unregister` | `invokeAsync("unregister", ...)` | `inputConsumer.off("hotkeyChange", HotkeyOptions, callback)` |
| `unregisterAll()` | `plugin:global-shortcut\|unregister_all` | `invokeAsync("unregister-all", ...)` | iterate + `inputConsumer.off(...)` |
| `isRegistered(shortcut)` | `plugin:global-shortcut\|is_registered` | (none — local HashMap) | (none) |

## Boundary Cases

1. **API level < 14**: `inputConsumer.on("hotkeyChange")` is not available. `client.register()` silently returns `Ok(())`. This is existing behavior, not changed by this fix. Should be documented in hilog.
2. **Bridge session not ready**: `OpenHarmonyApp::bridge()` returns `Err(...)`. `client` is `None`. All registrations skipped. REQ-3 diagnostics will reveal this.
3. **Hotkey occupied by system**: `inputConsumer.on` throws error code 4200002. Bridge plugin returns `accepted: false`. Worker thread logs error (REQ-2). Frontend sees success but hotkey doesn't work.
4. **`removeUnusedCommands: true`**: If enabled, ACL must include `global-shortcut:allow-register` for `openHarmony` platform. Currently in `ohos-plugins.json`.
