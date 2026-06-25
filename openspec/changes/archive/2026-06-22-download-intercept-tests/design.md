## Architecture

### Download Interception Flow (4 layers)

```
User clicks download link
    ↓
OHOS WebView (chromium engine)
    ↓
WebDownloadDelegate.onBeforeDownload(e)     ← ArkTS (DefaultWebview.ets)
    ↓
onDownloadStart NAPI callback               ← Rust NAPI bridge (openharmony-ability)
    ↓
on_download handler                         ← User code (tauri lib.rs)
    ↓
Return DownloadStartResult {allow, tempPath}
    ↓
e.start(path) / e.cancel()                  ← ArkTS executes
    ↓
Download executes / cancelled
    ↓
onDownloadFinish / onDownloadFailed         ← ArkTS callback
    ↓
onDownloadEnd NAPI callback                 ← Rust NAPI bridge
    ↓
on_download handler (Finished event)        ← User code
```

### Test Infrastructure Design

The `on_download` handler in `lib.rs` is a single closure registered at webview build time. To test different scenarios without rebuilding the webview, a **mode-switching pattern** was implemented:

```
Frontend (core.ts)                    Rust (lib.rs)
┌──────────────────────┐              ┌──────────────────────────┐
│ invoke(              │              │ DownloadTestState        │
│   'set_download_     │──NAPI──────→│   mode: Mutex<Mode>      │
│   test_mode',        │              │                          │
│   { mode: 'X' }      │              │ on_download handler:     │
│ )                    │              │   read state.mode        │
│                      │              │   match mode {           │
│ listen(              │              │     CustomDir => ...     │
│   'download-         │←─emit───────│     CancelAll => false   │
│   requested'         │              │     AuditLog => json     │
│ )                    │              │     ...                  │
│                      │              │   }                      │
│ trigger blob download│              │                          │
│ poll for event       │              │                          │
│ assert payload       │              │                          │
└──────────────────────┘              └──────────────────────────┘
```

### Mode Enum

```rust
pub enum DownloadTestMode {
    Default,           // Allow all, emit basic events
    CustomDir,         // Redirect to /data/storage/el2/base/cache/downloads/
    ConfirmAllow,      // Simulate user confirmation
    BlockFileType,     // Block dangerous extensions (exe, bat, cmd, sh, apk)
    ProgressTracking,  // Emit startedAt timestamp
    AuditLog,          // Emit full metadata (timestamp, url, destination, action)
    AutoRename,        // Auto-rename if file exists (append counter)
    CancelAll,         // Return false to cancel all downloads
}
```

### Bug Fix: NAPI Undefined Crash

**Root cause**: `DefaultWebview.ets` line 422 explicitly passed `undefined` as the second argument to `data.onDownloadEnd!()`:

```typescript
// BEFORE (crash)
download.onDownloadFailed((e) => {
    data.onDownloadEnd!(url, undefined, false);  // undefined → NAPI String conversion fails
});

// AFTER (fixed)
download.onDownloadFailed((e) => {
    data.onDownloadEnd!(url, '', false);  // empty string matches Rust String type
});
```

The Rust NAPI callback uses `ctx.try_get::<String>(1)` which fails with `StringExpected` error when receiving JavaScript `Undefined`. This crash was **100% reproducible** — any download failure would trigger it.

**Verification**: The fix was confirmed by the `cancel download returns false` test (test #45), which triggers `e.cancel()` → OHOS fires `onDownloadFailed` → the fixed callback passes `''` instead of `undefined` → no crash.

### Defensive Measures Evaluated and Reverted

Two defensive measures were initially added but **verified as unnecessary** through testing:

1. **`data.downloadDelegate = download`** (GC prevention) — Reverted. OHOS SDK's `setDownloadDelegate` holds a strong reference internally. All 6 tests pass without it.
2. **`e.getFullPath() || ''`** (undefined fallback) — Reverted. `getFullPath()` returns a valid string for blob URLs on OHOS. All 6 tests pass without it.

### Platform-Specific Notes

- **OHOS**: `onDownloadFailed` fires after `e.cancel()` with `success=false`. This is expected OHOS behavior — cancellation is treated as a type of failure.
- **Blob URLs**: Verified to trigger `onBeforeDownload` on OHOS WebView. `getFullPath()` returns a valid cache path.
- **cfg isolation**: All test infrastructure is in `examples/api/` which is not subject to `cfg(target_env = "ohos")` requirements (it's an example app, not library code).
