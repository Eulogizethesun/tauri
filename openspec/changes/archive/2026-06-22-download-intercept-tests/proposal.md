## Why

The Tauri OHOS WebView download interception feature (`on_download` / `WebDownloadDelegate`) was fully implemented across all 4 layers (Tauri → wry → openharmony-ability → ArkTS) but had **zero test coverage**. The existing Communication page button (`📥 Test Download Intercept`) only triggered a blob download without verifying any results.

Additionally, a **critical NAPI crash bug** was discovered in `DefaultWebview.ets`: the `onDownloadFailed` callback explicitly passed `undefined` as the `tempPath` parameter to the Rust NAPI callback, which expected `String`. This caused an immediate app crash whenever any download failed.

This change adds:
1. **6 automated tests** covering the core download interception flow (Requested event, custom path, file type blocking, audit metadata, cancel, Finished callback)
2. **1 critical bug fix** — `onDownloadFailed` passing `undefined` → `''` to prevent NAPI type conversion crash
3. **Test infrastructure** — `DownloadTestMode` enum + `set_download_test_mode` command for mode-aware handler behavior switching
4. **Enhanced error logging** — `onDownloadFailed` now logs `getLastErrorCode()` and `getState()`

## What Changes

### openharmony-ability (1 file)

- **`native_ability/src/main/ets/webview/DefaultWebview.ets`**:
  - Fix `onDownloadFailed`: change `data.onDownloadEnd!(url, undefined, false)` → `data.onDownloadEnd!(url, '', false)` to prevent NAPI crash (`Failed to convert JavaScript value 'Undefined' into rust type 'String'`)
  - Add `getLastErrorCode()` and `getState()` to `onDownloadFailed` hilog output (upgraded from `info` to `error` level)
  - Add `getTotalBytes()` to `onDownloadFinish` hilog output
  - Add `downloadDelegate?` field to `WebviewNodeData` interface for reference retention

### tauri (7 files)

- **`examples/api/src-tauri/src/cmd.rs`**: Add `DownloadTestMode` enum (8 modes: Default, CustomDir, ConfirmAllow, BlockFileType, ProgressTracking, AuditLog, AutoRename, CancelAll), `DownloadTestState` managed state, and `set_download_test_mode` command
- **`examples/api/src-tauri/src/lib.rs`**: Rewrite `on_download` handler to be mode-aware — reads `DownloadTestState` and executes scenario-specific logic (redirect path, block file types, cancel, emit audit metadata, etc.)
- **`examples/api/src-tauri/build.rs`**: Register `set_download_test_mode` in the app manifest commands list
- **`examples/api/src-tauri/capabilities/run-app.json`**: Add `allow-set-download-test-mode` ACL permission
- **`examples/api/src/lib/test-runner.ts`**: Add optional `timeout` field to `TestCase` interface for per-test timeout override
- **`examples/api/src/lib/tests/core.ts`**: Add 6 `category: 'auto'` download intercept tests after `webview.createPdf`

### Test Design

All tests use blob URLs to trigger downloads (verified to fire `onBeforeDownload` on OHOS). Each test:
1. Sets mode via `invoke('set_download_test_mode', { mode: '...' })`
2. Registers `listen` for `download-requested` / `download-finished` events
3. Creates a blob and triggers download via `<a download>` click
4. Polls for event payload with timeout
5. Asserts expected fields in the payload

| # | Test | Mode | Verifies |
|---|------|------|----------|
| 41 | Requested event fires | Default | `download-requested` event received |
| 42 | Custom directory redirects path | CustomDir | `destination` contains `/downloads/` |
| 43 | Block dangerous file types | BlockFileType | Mode is BlockFileType, handler runs |
| 44 | Audit log contains metadata | AuditLog | `timestamp`, `action` fields present |
| 45 | Cancel download returns false | CancelAll | `cancelled=true`, Finished has `success=false` |
| 46 | Finished event fires | Default | Both Requested and Finished events fire |
