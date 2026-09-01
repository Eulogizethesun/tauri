# Tasks: P3 — opener reveal/open async push-down

## 1. open.rs — free fns async + OHOS arm

- [x] 1.1 In `plugins/opener/src/open.rs`, change `pub fn open_url` → `pub async fn open_url`; add `#[cfg(target_env = "ohos")]` arm porting `commands.rs:42-49` (`openharmony_ability::open_with_system(url).await` + `Error::OpenharmonyAbility` map); non-OHOS arm `async`-wraps the existing `open(url, with)` call
- [x] 1.2 Change `pub fn open_path` → `pub async fn open_path`; add `#[cfg(target_env = "ohos")]` arm porting `commands.rs:84-97` (canonicalize → `url::Url::from_file_path` → `open_with_system(uri).await`); non-OHOS arm keeps the metadata check + `open` call, `async`-wrapped
- [x] 1.3 Keep `pub(crate) fn open` sync (internal to non-OHOS arm)

## 2. reveal_item_in_dir.rs — async + OHOS mod imp

- [x] 2.1 Add `#[cfg(target_env = "ohos")] mod imp` with `pub async fn reveal_items_in_dir(paths: &[PathBuf])` porting `commands.rs:107-126` (canonicalize → parent → `file://` → `openharmony_ability::reveal_in_dir(uri).await`); preserve the first-path-only limitation comment
- [x] 2.2 Change top-level `pub fn reveal_items_in_dir` → `pub async fn`; dispatch `imp::reveal_items_in_dir(&canonicalized).await` on OHOS, existing platform `imp` on others (existing `imp`s stay sync, `.await`ed by the async wrapper)
- [x] 2.2b **Revise the dispatch `any(...)` cfg** in both `reveal_item_in_dir` and `reveal_items_in_dir` to add `target_env = "ohos"`, so OHOS matches the new OHOS `mod imp` instead of the `#[cfg(not(any(...)))]` `UnsupportedPlatform` fallback (audit item D — without this the new mod imp is dead code)
- [x] 2.3 Change `pub fn reveal_item_in_dir` (singular) → `pub async fn`; delegate to `reveal_items_in_dir(&[path]).await`

## 3. lib.rs — inherent methods async + OHOS cfg

- [x] 3.1 `Opener::open_url` desktop arm (`lib.rs:62`): change cfg to `#[cfg(any(desktop, target_env = "ohos"))]`; body → `crate::open::open_url(...).await` (or the free fn); make `pub async fn`
- [x] 3.2 `Opener::open_url` mobile arm (`lib.rs:88`): keep `#[cfg(all(mobile, not(target_env = "ohos")))]` (Android/iOS only); make `pub async fn` (mobile-plugin call stays sync, `async`-wrapped)
- [x] 3.3 `Opener::open_path` desktop arm (`lib.rs:116`): same as 3.1
- [x] 3.4 `Opener::open_path` mobile arm (`lib.rs:146`): same as 3.2
- [x] 3.5 `Opener::reveal_item_in_dir` (`lib.rs:156`) + `reveal_items_in_dir` (`160`): make `pub async fn` + `.await` the free fns

## 4. commands.rs — pure async dispatcher

- [x] 4.1 `open_url`: delete `#[cfg(target_env = "ohos")]` block (L42-49) + `#[cfg(not(...))]` wrapper; body after scope check = `app.opener().open_url(url, with).await`
- [x] 4.2 `open_path`: delete OHOS block (L84-97) + wrapper; body = `app.opener().open_path(path, with).await`
- [x] 4.3 `reveal_item_in_dir`: delete OHOS block (L107-126) + wrapper; body = `crate::reveal_items_in_dir(&paths).await`
- [x] 4.4 Remove now-stale `let _ = with;` comments and the `openharmony_ability` import if no longer referenced

## 5. Verify — non-OHOS untouched behavior

- [x] 5.1 `cargo check` (Windows host) on `opener` — 0 errors
- [x] 5.2 Grep `commands.rs`: no `#[cfg(target_env = "ohos")]`, no `openharmony_ability` reference
- [x] 5.3 Grep `commands.rs`: no `url::Url::from_file_path` (moved to open.rs / reveal_item_in_dir.rs)
- [x] 5.4 Grep `open.rs` + `reveal_item_in_dir.rs`: confirm OHOS `cfg` arms contain the `url::` + `openharmony_ability` references

## 6. Verify — OHOS build + device (ohos-build skill)

- [x] 6.1 `cargo check --target aarch64-linux-ohos -p tauri-plugin-opener` — 0 errors; `cargo tree` shows no `zbus`
- [ ] 6.2 OHOS desktop build — HAP produced, EXIT=0
- [ ] 6.3 OHOS mobile build — HAP produced, EXIT=0
- [ ] 6.4 Device (desktop): `open_url('https://...')` opens system browser; `open_path('/path/file')` opens default app; `reveal_item_in_dir(['/path/file'])` opens file manager at parent dir
- [ ] 6.5 Device (mobile): `open_url`/`open_path` route through `openharmony_ability` (not the mobile plugin), verify a URL opens
