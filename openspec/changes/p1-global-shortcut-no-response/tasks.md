# Tasks: Global Shortcut No Response Fix

## Task 1: Fix JS Plugin to reject instead of silently succeeding

- [ ] 1.1 In `plugins-workspace/plugins/global-shortcut/openharmony/src/main/ets/Plugin.ets`, change `handleRegister` to reject with descriptive error message
- [ ] 1.2 Change `handleUnregister` to reject similarly
- [ ] 1.3 Change `handleUnregisterAll` to reject similarly
- [ ] 1.4 Change `handleIsRegistered` to reject similarly
- [ ] 1.5 Verify `gen/ohos/global-shortcut/src/main/ets/Plugin.ets` is regenerated on next build (or manually sync)

## Task 2: Improve error logging in Rust handler

- [ ] 2.1 In `plugins-workspace/plugins/global-shortcut/src/lib.rs`, change `log::warn!` to `log::error!` in `ohos_setup` when client is None (line ~387-391)
- [ ] 2.2 Change `log::warn!` to `log::error!` in all 3 fire-and-forget worker threads (lines ~380-385, ~470-475, ~508-514), adding shortcut key and id to the message
- [ ] 2.3 Add setup-time diagnostic `log::info!` in `ohos_setup` showing APP/bridge_plugin_registered/client status after initialization

## Task 3: Verify at runtime

- [ ] 3.1 Build and deploy to device (HUAWEI MateBook Pro)
- [ ] 3.2 Check hilog for `[global-shortcut] ohos_setup:` diagnostic line — verify `client=true`
- [ ] 3.3 Register Ctrl+Shift+T via frontend test button — check hilog for `register ENTER` in bridge plugin
- [ ] 3.4 If bridge call fails, check error code (801=unsupported, 4200002=occupied, 4200003=already subscribed)
- [ ] 3.5 If client=false, investigate bridge session readiness during plugin setup

## Task 4: (Optional, future) Synchronous registration error propagation

- [ ] 4.1 Design Channel event protocol for registration success/failure
- [ ] 4.2 Change fire-and-forget to await bridge response and send error event via Channel
- [ ] 4.3 Update frontend to handle registration error events
