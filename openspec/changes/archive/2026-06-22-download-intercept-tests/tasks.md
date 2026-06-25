## 1. Bug Fix (openharmony-ability)

- [x] 1.1 Fix `onDownloadFailed` in `DefaultWebview.ets`: change `undefined` → `''` for `tempPath` parameter to prevent NAPI `StringExpected` crash
- [x] 1.2 Upgrade `onDownloadFailed` log level from `hilog.info` to `hilog.error`, add `getLastErrorCode()` and `getState()`
- [x] 1.3 Add `getTotalBytes()` to `onDownloadFinish` log output
- [x] 1.4 Add `downloadDelegate?` field to `WebviewNodeData` interface

## 2. Test Infrastructure (tauri)

- [x] 2.1 Add `DownloadTestMode` enum with 8 variants in `cmd.rs`
- [x] 2.2 Add `DownloadTestState` managed state with `Mutex<DownloadTestMode>` in `cmd.rs`
- [x] 2.3 Add `set_download_test_mode` command in `cmd.rs`
- [x] 2.4 Register `DownloadTestState` via `app.manage()` in `lib.rs`
- [x] 2.5 Register `set_download_test_mode` in `build.rs` app manifest commands list
- [x] 2.6 Add `allow-set-download-test-mode` to `capabilities/run-app.json`
- [x] 2.7 Rewrite `on_download` handler in `lib.rs` to read `DownloadTestState` and execute mode-specific logic
- [x] 2.8 Add `timeout?` field to `TestCase` interface in `test-runner.ts` for per-test timeout override

## 3. Automated Tests (tauri)

- [x] 3.1 Add `on_download: Requested event fires` test — Default mode, verify event received
- [x] 3.2 Add `on_download: custom directory redirects path` test — CustomDir mode, verify destination contains `/downloads/`
- [x] 3.3 Add `on_download: block dangerous file types` test — BlockFileType mode, verify mode and handler execution
- [x] 3.4 Add `on_download: audit log contains metadata` test — AuditLog mode, verify timestamp and action fields
- [x] 3.5 Add `on_download: cancel download returns false` test — CancelAll mode, verify cancelled=true and Finished success=false
- [x] 3.6 Add `on_download: Finished event fires on successful download` test — Default mode, verify both Requested and Finished events

## 4. Verification

- [x] 4.1 Build and deploy to OHOS device (desktop mode)
- [x] 4.2 Verify all 6 download tests pass (196 total, 194 pass, 2 pre-existing failures)
- [x] 4.3 Verify no app crash on download cancellation (CancelAll mode)
- [x] 4.4 Verify defensive measures (GC fix, getFullPath fallback) are unnecessary by reverting and re-testing

## 5. Commits

- [x] 5.1 openharmony-ability: `fcc33e0` fix(webview): fix NAPI crash in onDownloadFailed and add error logging
- [x] 5.2 tauri: `6c019fdb7` feat(ohos): add download intercept auto tests and fix build env

## 6. Code Review

- [x] 6.1 Review findings: tauri#48 has 2 Blocker (auto-generated files + signing cert leak), 2 Major, 1 Minor
- [x] 6.2 Review findings: openharmony-ability#31 has 1 Minor (misleading GC comment)
