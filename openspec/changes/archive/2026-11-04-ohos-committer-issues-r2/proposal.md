# ohos-committer-issues-r2 — Proposal

## Why

Committer Eulogizethesun merged the four OHOS adaptation PRs (tauri#241, tao#28, wry#26, openharmony-ability#55) on 2026-11-03 08:56–08:58Z (merge commits tauri `380ab48a0d`, tao `642fa64b`, wry `a6809a05`, ability `c2463f94`; our PR heads are their ancestors) and in the same minute opened 10 post-merge tracking issues on Eulogizethesun/tauri (#244–#253), sourced from the silent 2026-10-31 re-review. Three are labeled `bug` (#244/#246/#247 — all in code merged via tauri#241), seven are labeled `documentation` (#245/#248–#253 — prose/comments/PR-body/report truth defects across the four repos).

The defects are real and machine-verified during design exploration:

- **#244 (bug)**: `WebviewMessage::SetAutoResize`'s OHOS enable arm is a self-documented no-op (`crates/tauri-runtime-wry/src/lib.rs:4840-4869`); the disable arm clears the derived rates and nothing ever re-derives them — an explicit-bounds webview permanently stops following window resizes after `disable → enable`, and `set_auto_resize(true)` still returns `Ok`.
- **#246 (bug)**: `examples/api/src/views/Window.svelte` defaults its target to the main window; `hide()` (:151-154) and the four setter `$effect`s (:313-322) have no rejection handling — on OHOS the main-window path rejects per the #238 contract, producing unhandled promise rejections.
- **#247 (bug)**: `create_window` writes `ohos_main_window_registry` (lib.rs:5819) before `create_webview(...)?` (lib.rs:5893) can fail and propagate early — the store entry never happens and `on_window_close_ohos` never runs, so the registry keeps a dead id.
- **#245–#253 (documentation)**: shipped prose contradicts shipped code — wrong read-back semantics for `bounds()` (#245), a referenced report file that is not in the tree plus stale counts/paths (#248), PR-description/code mismatches in tao#28 (#249) and ability#55 (#250), Float prose residue + weak UT + stale `@since` + missing round-trip UT in openharmony-ability (#251), stale "Documentation only" claims in wry#26's body (#252), missing cross-dpi sentinel semantics in wry's public docs plus an inconsistent devtools flag (#253).

User directive driving this change: process the 3 `bug` issues first, then the 7 `documentation` issues; per-issue strict file scope (only files named by that issue); per-issue acceptance strictly against that issue's acceptance criteria (authoritative source: the issue body on GitHub, re-pulled at verification time; local archive `D:/xuqiu/tauri-3.0/.tmp/issue-{244..253}-1103.md`).

## What Changes

Per-issue remediation, grouped by the user's priority order. Tree changes form new commits on top of the merged heads; PR-body edits and issue replies are separate post-merge actions held for user confirmation.

### Bug issues (priority 1)

- **#244** — tauri-runtime-wry `SetAutoResize` OHOS enable arm: real re-arm via a park-and-restore state (disable parks the derived rates; enable restores them), plus conditional derive from the wry bounds cache for fully-explicit-bounds webviews; natural webviews keep following the ArkTS container; the non-derivable partial-bounds corner gets a loud `log::error!` (the dispatch channel is fire-and-forget — no honest synchronous Err exists there; disclosed in the issue reply). Stale comments corrected on both sides of the bridge: lib.rs:4851-4855's false "ArkTS render layer reads actual layout" claim, and openharmony-ability `WebviewPlugin.ets:99-110, 3078-3090`'s "enable arm does not re-arm" comments. Plus the device case the issue requests: explicit bounds → disable → enable → window resize, assert the webview follows.
  - Files: `crates/tauri-runtime-wry/src/lib.rs`; openharmony-ability `plugins/webview/src/main/ets/WebviewPlugin.ets`; examples/api webview-autosize test case file (located at apply time; requested by the issue's 建议).
- **#246** — Window.svelte: wrap the main-window `hide()` in try/catch and the four setter `$effect`s in `.catch`, reporting through the page's `onMessage` (the TestRunner OHOS-branch pattern).
  - Files: `examples/api/src/views/Window.svelte`.
- **#247** — `create_window` error path: on `create_webview` failure, remove the registry entry before propagating the error (Err-path removal, not moving the write — the registry's only reader, the user-thread dispatcher constructor, reads the entry during creation, so a moved write would race it).
  - Files: `crates/tauri-runtime-wry/src/lib.rs`.

### Documentation issues (priority 2)

- **#245** — `bounds()` read-back doc + vp 口径: correct `crates/tauri/src/webview/mod.rs:1624-1626` and `packages/api/src/webview.ts:430-432` (partial set_size/set_position reads back the last cached value — sentinels never enter the wry cache, so they are never read back); append an erratum (no history rewrite) to `openspec/changes/archive/2026-10-20-ohos-webview-sizing/design.md:189` and `red-light-evidence.md:28,52`; fix the `85617fbd3` comment that calls the Physical probe "logical bounds" (located via `git show 85617fbd3 --stat`, expected `examples/api/src-tauri/src/cmd.rs`); unify the vp claim with measured evidence and write the 依据.
  - Files: the five named above (within tauri repo).
- **#248** — evidence/report alignment: the 1030 report — a complete local copy exists on disk as `examples/api/device-report-1030-finalchain-desktop.md` (untracked; footer + provenance pinning head `947310a3a8`), so the commit arm is taken: commit it under its on-disk name and correct the PR body to reference that actual path (the issue's first option, "补提交报告"); strengthen the TR-5 smoke case in `examples/api/src/lib/tests/driver-generated.ts` so a silently-successful `hide()` cannot pass, or label it smoke; the remaining items (7897/7872/7916 line counts with the derivation command, tray path `crates/tauri/src/tray/mod.rs`, `99a43d928`/`67a331549` classification, P2-1/P2-2 wording, shifted line refs, stale "audit 13→24"/"35 files", the Window.svelte caller list) are PR#241-body corrections.
  - Files: `examples/api/device-report-1030-finalchain-desktop.md`, `examples/api/src/lib/tests/driver-generated.ts`; PR body via PUT (user-gated).
- **#249** — tao: fix the over-broad setter comment at `src/platform_impl/ohos/window.rs:754-755` (only the three decoration-button setters error on UIAbility-kind windows; `set_resizable` does not, `:1924-1968`); correct the tao#28 description (main-window creation seed wording, T28-1 "injects a real window client", hash/count `f01c81b5..c7a36176` = 19 commits).
  - Files: tao `src/platform_impl/ohos/window.rs`; PR body via PUT (user-gated).
- **#250** — ability: PR description corrections (A55-3 two sentences — beta.1's main window feeds component-relative `event.x/event.y`, sub-windows feed nothing, screen-global vp feed is this PR's addition; the 7 behavior commits of 2026-10-21/22; commit count 66 not 68; head `536dff5f74`); mark `WindowCreateParams.window_type` removal as a breaking public API change in the body and/or CHANGELOG (apply-time check for an existing CHANGELOG file).
  - Files: PR body via PUT (user-gated); CHANGELOG only if the repo has one.
- **#251** — ability tree: sweep the ~13 non-wire Float prose/log sites to zero (`crates/ability/src/window/mod.rs:98,521,547,551,594,600,673,681`, `crates/plugin-app-control/src/lib.rs:157`, `native_ability .../WindowManager.ets:2031`, plus grep-discovered remainder); strengthen the #238 host UT at `crates/plugin-window/src/lib.rs:1157-1205` from text-marker scanning to a behavioral assertion (call the facade on host with the main-window id and assert the rejection comes from the napi-stub path, not from a Rust-side pre-gate — kills helper/`matches!`-variant regressions); correct the two stale `@since 20` claims (`crates/ability/src/app.rs:1514-1517`, `crates/plugin-webview/src/lib.rs:347`) to the SDK versions verified from the d.ts; add the `Key::from_name` round-trip UT for all 75 NAME_TABLE rows at `crates/ability/src/global_shortcut/types.rs:204-218`.
  - Files: the four named ability files + grep-discovered Float residue sites.
- **#252** — wry#26 body rewrite: delete the stale "Documentation only; no behavior change in this repo" and "checks green" claims, correct the `examples/gtk_opengl.rs` claim (commit `0d73538` modified it), give accurate non-comment line counts (~444) derived live from the 12-commit chain.
  - Files: PR body via PUT (user-gated). Zero tree changes.
- **#253** — wry: document the cross-dpi-variant merge semantics in the public docs at `src/lib.rs:2372-2377` (same-variant merges per component; cross-variant partial sets preserve the whole axis — including already-set components); fix the devtools flag so `open_devtools` sets the per-webview flag only on success (currently set first at `:1633-1634`, failure release only clears the process-level `DEVTOOLS_ENABLED` at `:673-676`, leaving `is_devtools_open()` true at `:1705-1707`).
  - Files: wry `src/lib.rs` (doc), wry `src/ohos/mod.rs` (flag).

## Capabilities

- `webview-runtime-behavior` — externally observable runtime behavior added by this change: SetAutoResize re-arm (#244), registry no-residue on create failure (#247), handled main-window rejections in examples (#246), honest devtools flag (#253), and the two ability-side UT properties (#251).
- `documentation-alignment` — prose/comment/report truth alignment: #245, #248 (tree slice), #249, #250, #251 (sweep + @since), #252, #253 (doc slice).

## Impact

- Four repos, all changes OHOS-scoped: Rust code changes live inside existing `cfg(target_env = "ohos")` regions (tauri-runtime-wry, wry/ohos) or in the examples/api demo layer (JS) — zero non-OHOS platform behavior change; the desktop `SetAutoResize` arm stays behavior-identical (its disable also parks rates now — `parked` is desktop-write-only and never desktop-read; the enable arm's live re-derivation is untouched).
- openharmony-ability ArkTS comment edits (WebviewPlugin.ets) require a HAR repack for the device-suite chain, per the standing repack-on-ArkTS-change rule.
- New commit chains stack on the merged heads (tauri `380ab48a0d`, tao `642fa64b`, wry `a6809a05`, ability `c2463f94`) — no rebase or rewrite of merged history; archived-change corrections are appended errata, never rewrites.
- Git discipline: push only via origin (fork ljy9812), never origin-tauri; commits name files explicitly (no `git add -A`); known churn traps (schema.json, wry CRLF phantom-M, tauri untracked scratch, ability untracked root dirs) stay untouched.
- All outward-facing actions (push, PR-body PUT, the 10 issue replies) wait for user confirmation.
