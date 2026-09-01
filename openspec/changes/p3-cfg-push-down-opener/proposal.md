## Why

`opener`'s three commands (`commands.rs::open_url`, `open_path`, `reveal_item_in_dir`) each carry an inline `#[cfg(target_env = "ohos")]` branch calling `openharmony_ability::open_with_system` / `reveal_in_dir` directly, bypassing the backend layer entirely. The non-OHOS branch calls `app.opener().open_url(...)` or `crate::reveal_items_in_dir(&paths)`. This is a `1.6` violation (reference §1.6): OHOS differential logic scattered in shared commands.

Root cause the bypass exists: the `Opener` inherent methods `open_url`/`open_path` (`lib.rs:62`/`116`) are gated `#[cfg(desktop)]` and `#[cfg(all(mobile, not(target_env = "ohos")))]` — on OHOS neither matches, so the methods don't exist; the command must call `openharmony_ability` directly. The free fns `open_url`/`open_path` (`open.rs:33`/`54`) and `reveal_items_in_dir` (`reveal_item_in_dir.rs:43`) have no OHOS branch — they route to the `open` crate or return `UnsupportedPlatform`.

## What Changes

- **`open.rs` free fns → async + OHOS branch**: `pub async fn open_url` / `pub async fn open_path` gain a `#[cfg(target_env = "ohos")]` arm calling `openharmony_ability::open_with_system(url_or_uri).await` (and canonicalize-to-`file://` for `open_path`, matching current command behavior). Non-OHOS arm = current `open`-crate logic, `async`-wrapped. The `pub(crate) fn open` helper stays sync (internal to the non-OHOS arm).
- **`reveal_item_in_dir.rs` → async + OHOS `mod imp`**: the free `reveal_items_in_dir` becomes `pub async fn`; a new `#[cfg(target_env = "ohos")] mod imp` provides `pub async fn reveal_items_in_dir` doing the canonicalize → parent → `file://` URI → `openharmony_ability::reveal_in_dir(uri).await` (verbatim from the current command branch). The top-level fn dispatches `imp::reveal_items_in_dir(&paths).await` on OHOS, existing platform `imp` on others. `reveal_item_in_dir` (singular) stays a sync wrapper (canonicalize + delegate) or also becomes async — see design.
- **`lib.rs` inherent methods → async + OHOS cfg**: `Opener::open_url`/`open_path` become `pub async fn` and `.await` the free fns; their `cfg` extends to include `target_env = "ohos"` so the methods exist on OHOS. `reveal_item_in_dir`/`reveal_items_in_dir` inherent methods become async + `.await`.
- **`commands.rs` → pure dispatcher**: delete all three OHOS branches; `open_url` → `app.opener().open_url(url, with).await`; `open_path` → `app.opener().open_path(path, with).await`; `reveal_item_in_dir` → `crate::reveal_items_in_dir(&paths).await`. No `cfg(target_env = "ohos")` in commands.rs.
- No `OpenerExt` trait change (only the `opener()` accessor).

## Capabilities

### New Capabilities
- `opener-async-platform-backend`: the opener free fns and `Opener` inherent methods are `async`, and each platform backend (OHOS `openharmony_ability`, desktop `open`-crate, macOS/Windows/Linux reveal) owns its platform logic behind whole-module/branch `cfg`; `commands.rs` is a pure async dispatcher with no platform branches.

### Modified Capabilities
- `opener-ohos-platform`: the OHOS platform behavior (canonicalize, `file://` URI, `open_with_system`/`reveal_in_dir` via `openharmony_ability`) moves from `commands.rs` into the backend free fns. Behavior is preserved bit-for-bit; only the code location changes.

## Impact

- **Code**: `plugins/opener/src/commands.rs` (delete 3 OHOS branches, add `.await`), `plugins/opener/src/open.rs` (free fns async + OHOS arm), `plugins/opener/src/reveal_item_in_dir.rs` (free fn async + OHOS `mod imp`), `plugins/opener/src/lib.rs` (4 inherent methods async + cfg extension).
- **APIs**: **pub API breaking** — free fns `open_url`/`open_path`/`reveal_items_in_dir` (re-exported at `lib.rs:29-30`) sync→async, and 4 `Opener` inherent methods sync→async. Tagged `breaking-change`, scheduled with next plugin major. `commands.rs:104` TODO already anticipated this. ~7 internal call sites updated to `.await`. No JS IPC change (commands stay async).
- **Dependencies**: none new.
- **Platform isolation**: compliant — OHOS logic moves from command-level `cfg` branches into `#[cfg(target_env = "ohos")]` backend modules/arms; commands.rs becomes platform-neutral.
- **Risk**: largest breaking surface of the three phases (3 pub free fns + 4 inherent methods). The OHOS `mod imp` for reveal is new code (port of the command branch). Device-verify open/reveal on OHOS desktop. The `async` on the desktop `open`-crate path is call-convention only (sync body), mirroring Phase 2's arboard decision.
