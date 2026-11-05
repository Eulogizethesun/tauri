# ohos-committer-issues-r2 — Design

## Context

### Event background

2026-11-03 08:56–08:58Z: committer Eulogizethesun merged our four PRs and opened 10 post-merge issues in one burst.

| Repo | PR | Our head (PR head) | Merge commit | Local branch |
|---|---|---|---|---|
| tauri | #241 | `947310a3a8` | `380ab48a0d` | ohdev |
| tao | #28 | `c7a3617639` | `642fa64b` | ohdev |
| wry | #26 | `62b9c43f94` | `a6809a05` | ohdev |
| openharmony-ability | #55 | `536dff5f74` | `c2463f94` | ohdev |

Our heads are ancestors of the merge commits → local alignment is a fast-forward. Local repo paths: `D:/xuqiu/tauri-3.0/{tauri,tao,wry,openharmony-ability}`. The committer's remote (PR base, `Eulogizethesun/<repo>`) is fetched per repo; the branch carrying the merge commit is discovered via `git branch -r --contains <merge>` at apply time.

### Issue inventory (labels, source, local archive)

All 10 issues live on `Eulogizethesun/tauri`, authored by Eulogizethesun 2026-11-03, sourced from the 2026-10-31 silent re-review. Full bodies archived at `D:/xuqiu/tauri-3.0/.tmp/issue-{244..253}-1103.md`; the GitHub body (re-pulled via `gh api repos/Eulogizethesun/tauri/issues/<n> --jq .body`) is the authoritative acceptance source at verification time.

- `bug`: **#244** (SetAutoResize enable no-op), **#246** (unhandled main-window rejections in examples), **#247** (registry residue on create failure) — priority 1 per user.
- `documentation`: **#245** (bounds() read-back doc + vp 口径), **#248** (report/counts/paths), **#249** (tao description + setter comment), **#250** (ability description, breaking-change marking), **#251** (Float sweep, UT strength, @since, round-trip UT), **#252** (wry body), **#253** (wry public docs + devtools flag) — priority 2.

### Verified mechanism facts (design exploration, current merged code)

**#244 — SetAutoResize machinery (`crates/tauri-runtime-wry/src/lib.rs`)**

- Handle field `bounds: Arc<Mutex<Option<WebviewBounds>>>` (lib.rs:3206); `WebviewBounds { x_rate, y_rate, width_rate, height_rate }` (struct at lib.rs:5938) — rates = webview rect ÷ window inner_size.
- `WebviewMessage::SetAutoResize` handler (lib.rs:4840-4869): OHOS disable arm writes `*webview.bounds.lock() = None` (de-arms the Resized re-fire); OHOS enable arm is a comment-only no-op whose `KNOWN LIMITATION ... permanently de-arms` text cites tauri#241; lib.rs:4851-4855 additionally claims "the auto-resize base ... is read from the actual layout by the ArkTS render layer" — **false** (openharmony-ability has no such recompute path; `WebviewPlugin.ets:99-110` and `:3078-3090` both document that the enable arm does not re-arm).
- Desktop arm (lib.rs:4870-4895): re-derives rates live from `webview.bounds()` + `window.inner_size()` — the pattern the OHOS enable arm lacks.
- `Resized` handler (lib.rs:~5349-5383): for each webview, only when rates are `Some` re-fires `set_bounds(rates × new size)`; comment self-describes "Irreversible de-arm".
- Creation seeding (lib.rs:6235-6280): explicit bounds + auto_resize → rates from requested rect; natural layout → `None` (follows the ArkTS container). Creation init at lib.rs:6672.
- wry `merge_bounds_into_cache` (`wry/src/ohos/mod.rs:209-268`): sentinel components (`i32::MIN`, not -1) never enter the cache; same-variant (Logical-vs-Physical) partial ops merge per component; cross-variant partial ops replace whole axes (already-set components included); natural webviews default to a 200×200 placeholder. `WebView::bounds()` (wry/src/ohos/mod.rs:1953-1955) returns the cache — i.e., the last cached real values, never sentinels.
- API chain: `Webview::set_auto_resize` (tauri/src/webview/mod.rs:1607) → runtime trait (tauri-runtime/src/lib.rs:707) → wry impl (lib.rs:2226) → `WebviewMessage::SetAutoResize` via the user message channel. The dispatch is **fire-and-forget**: the `Result` carries channel-send errors only; the handler cannot report a decision failure to the caller, and the desktop branch itself reports handler-side wry errors with `log::error!`.

**#247 — registry facts**: `ohos_main_window_registry: Arc<Mutex<HashMap<WindowId, bool>>>` (lib.rs:394, accessor :4052); `ohos_record_main_window` (lib.rs:433-446, cfg-ohos) whose own comment states it is called "before any creation reply is sent, so the user-thread dispatcher constructor (the registry's only reader) reads a populated entry" — the read happens **during** creation. Single record site: lib.rs:5819, before `create_webview(...)?` at lib.rs:~5893; `on_window_close_ohos` (lib.rs:5584-5600) only runs for windows that entered the store, so the failure path leaks.

**#246 — defect sites** (`examples/api/src/views/Window.svelte`): page default target is the main window (:16-19); `await webviewMap[selectedWebview].hide()` unwrapped (:151-154); four `$effect(() => { ...setResizable/setMaximizable/setMinimizable/setClosable(...) })` fire-and-forget (:313-322). The repo's own pattern for handled rejections is TestRunner.svelte's `try { await invoke(...) } catch (e) { onMessage(\`...\`) }` (:112-125). `onMessage` is available in Window.svelte.

**#253 — wry devtools**: `open_devtools` sets the per-webview `devtools_open=true` first (src/ohos/mod.rs:~1633-1634); the failure-release path only clears the process-level `DEVTOOLS_ENABLED` (~:673-676); `is_devtools_open()` (~:1705-1707) therefore still returns true after a failed open — inconsistent with the public doc's "current visibility" wording. Public `set_bounds`/bounds doc at wry/src/lib.rs:2372-2377 documents per-component sentinel semantics but not the cross-dpi-variant whole-axis rule (which internal comment src/ohos/mod.rs:200-204 does document).

**#251 — ability facts**: #238 host UT (`crates/plugin-window/src/lib.rs:1156-1215`) asserts the facade body contains none of seven Rust-side dispatch markers — a text scan that a `window_id == 0`-equivalent gate written as a helper or `matches!` elsewhere would silently pass. The UT's own comment (lib.rs:1162-1167) **records that a live behavioral probe is not executable on the host** — `BridgeRuntime` is only constructible from a real N-API Env — so the behavioral discrimination (a Rust-side pre-gate rejects before touching napi; an ungated facade reaches the napi host stub and returns the stub's documented error — different error identities) is an *idea to verify at apply time*, expected to fall to the fallback arm; both arms are stated in D10 and whichever runs is disclosed in the issue reply. The ability workspace's host tests (191/0 on the PR chain) run over host-stub napi, which is what made the idea plausible. `Key::from_name` (`crates/ability/src/global_shortcut/types.rs:204-218`) maps 75 NAME_TABLE rows with no round-trip UT. Two `@since 20` claims (`crates/ability/src/app.rs:1514-1517` windowEvent, `crates/plugin-webview/src/lib.rs:347` incognitoMode) contradict the SDK (10/11 and 11/18 respectively per the issue; final values re-derived from the SDK d.ts at apply time, the same spot-check method as the 2026-10-27 wave) — and the windowEvent value is not a stray typo: app.rs:1512-1517 carries an in-code justification sentence that must be rewritten together with the value (D10).

## Goals / Non-Goals

**Goals**

1. Remediate all 10 issues, bug-label first (#244 → #246 → #247, then #245/#248–#253), each within the file scope that issue names.
2. Verify each issue strictly against its own acceptance criteria (issue body re-pulled fresh at verification time).
3. New chains on the merged heads; host tests + device suite green; per-pair 修后必挂 (mutation) proof for every fix+test pair added by this change, per the submit-gate discipline.
4. Prepare (but do not execute without user confirmation) the push, the four PR-body corrections, and the 10 issue replies.

**Non-Goals**

- No new features beyond the issues' 建议 items; no refactor of the message dispatch architecture (e.g., adding a synchronous reply channel to set_auto_resize).
- No behavior change on any non-OHOS platform; the desktop SetAutoResize arm stays byte-identical.
- No rebase or rewrite of merged history or of archived openspec artifacts — corrections to archived changes are appended errata.
- No PR-body PUT, no push, no issue reply before user confirmation.
- The paused local submit-gate round (R22, findings F-1/F-2/F-3 on the pre-merge PRs) stays parked — this change is a new wave on top of merged heads, and its own gate runs at ship time.

## Decisions

### D0 — Baseline alignment (Task group 0)

Per repo: `git fetch <committer-remote>` (PR base repo; discover via `git remote -v` / `gh pr view --json baseRepository`), `git branch -r --contains <merge-commit>` to find the carrying branch, verify ancestry (`git merge-base --is-ancestor <our-head> <merge-commit>` must succeed), then align local ohdev with `git merge --ff-only <merge-commit>` (fallback `git reset --hard <merge-commit>` only if ff-only is impossible and the reason is recorded). Rationale: our heads are ancestors (E used merge commits, not squashes), so alignment is a pure fast-forward and the new wave stacks cleanly on the merged truth.

### D1 — #244: park-and-restore + conditional derive (the real re-arm)

Replace the single-slot `Option<WebviewBounds>` with a three-field state on the webview handle (tauri-runtime-wry lib.rs, field site :3206):

```rust
#[derive(Default)]
struct WebviewAutoResizeState {
    /// Armed rates — Some ⇒ the Resized handler re-fires set_bounds.
    rates: Option<WebviewBounds>,
    /// Rates parked at the last disable; restored by a later enable.
    parked: Option<WebviewBounds>,
    /// Whether the wry bounds cache for this webview is fully real.
    explicit: BoundsExplicitness,
}
#[derive(Default, Clone, Copy, PartialEq, Eq)]
enum BoundsExplicitness { #[default] Natural, Partial, Full }
```

Ripple sites (all in lib.rs): field :3206, SetAutoResize OHOS arm :4840-4869, desktop arm :4870-4895 (writes `rates` only — desktop stays behavior-identical; it never reads `parked`/`explicit`), Resized read :~5350, creation seeding :6235-6280 (explicit bounds → `explicit = Full` + rates if auto_resize; natural → `Natural`), creation init :6672, and the SetBounds/SetSize/SetPosition handlers (they already maintain live rates for armed webviews; they additionally maintain `explicit` and mirror-into-`parked` while disarmed).

`explicit` mirrors the wry cache's realness (D-fact: sentinel components never enter the cache, so a sentinel write preserves the previous real value): full `SetBounds` (all-real) → `Full`; `SetSize(real)` keeps the position axis' previous realness (`Full` stays `Full`; `Natural`→`Partial`); `SetPosition(real)` symmetric; creation-with-bounds → `Full`; natural creation → `Natural`.

OHOS enable-arm decision table (the core fix):

| State at enable | Action | Result |
|---|---|---|
| `parked` is Some | `rates = parked` (restore) | re-armed — E's device case (explicit bounds → disable → enable → resize ⇒ follows) |
| `parked` None, `explicit == Full` | derive `rates` from wry cache `webview.bounds()` (real values, normalized — the cache may hold a `Physical` variant, so `to_logical(scale_factor)` first, exactly as the desktop arm :4874-4878 and creation seeding :6240-6246 do) ÷ `window.inner_size()` | re-armed — covers "created with explicit bounds, auto_resize enabled later" |
| `parked` None, `explicit == Natural` | rates stay `None` | follows the ArkTS container — genuinely correct (natural webviews auto-follow the container), not a dodge |
| `parked` None, `explicit == Partial` | `log::error!` naming the webview label + remedy (issue a full `set_bounds` first) | loud, non-silent — see D2 |

Disable arm (OHOS and desktop): `rates → parked` (move out), `rates = None`. Desktop enable keeps its live re-derivation writing `rates` (byte-identical behavior; `parked` is desktop-write-only, never desktop-read).

### D2 — #244: the partial corner reports via log, not Err — disclosed

E's acceptance offers two routes: real follow-through, or an explicit Err. We implement the real follow-through (D1 rows 1–2, plus row 3 being correct-by-construction). The one non-derivable corner (row 4) cannot return a synchronous Err: the dispatch chain is fire-and-forget (Context facts) — the trait's `Result` only carries channel-send errors, and the desktop branch already reports handler-side failures with `log::error!`. Fabricating an Err would require a synchronous reply channel that does not exist (Non-Goal). Row 4 therefore logs a specific, greppable error (visible in hilog on device), and the issue reply states this explicitly: enable now re-arms in every derivable case; the non-derivable partial-bounds case is loud, not silent.

### D3 — #244: comment corrections on both bridge sides

- lib.rs:4851-4855's false "ArkTS render layer reads the actual layout" claim is replaced by the D1 contract (park/derive semantics; the ArkTS render layer honors the last explicit set_bounds and container-follows natural webviews).
- openharmony-ability `WebviewPlugin.ets:99-110` and `:3078-3090` comments ("enable arm does not re-arm") are updated to the new contract: re-arming is Rust-side (park-restore / cache-derive); the ArkTS side remains render-truth only. Both files are named by the issue (evidence section), so this is in-scope; the ArkTS edit is comment-only → device-suite outcome line-identical, but the HAR is repacked for the chain per the standing rule.

### D4 — #246: catch-and-report with the page's own pattern

`hide()` (:151-154) becomes TestRunner-style `try { await ...hide() } catch (e) { onMessage(\`hide failed: ${e}\`) }`; each of the four `$effect` setter calls (:313-322) gains `.catch(e => onMessage(\`<setter> failed: ${e}\`))` (fire-and-forget context, cannot await). E's alternative suggestion (assert the #238 reject text) would turn a demo page into a test harness — rejected; the issue's primary suggestion is the catch pattern, and the acceptance criterion (console zero unhandled rejections) is met by it.

### D5 — #247: Err-path removal, write stays early

`create_webview(...)?` becomes a match: on `Err(e)`, remove the registry entry (`context.ohos_remove_main_window(&window_id)` — a new cfg-ohos helper symmetric to `ohos_record_main_window`, or an inline `lock().remove()`), then `return Err(e)`. Not moving the write after `create_webview`: the record fn's own comment documents that the registry's only reader — the user-thread dispatcher constructor — reads the entry during creation, so a late write would race it. Err-path removal is E's own first alternative and is race-free (the entry existed for the constructor's read; on failure it is removed before the error escapes `create_window`). Files: lib.rs only (the issue's named file — a UT would also live there, see Test Design).

### D6 — #245: docs move to the implementation's truth; archived artifacts get appended errata

- `crates/tauri/src/webview/mod.rs:1624-1626` and `packages/api/src/webview.ts:430-432`: read-back semantics corrected to "the last cached value for that component; the unspecified-sentinel values sent by partial writes are screened by the wry-side cache merge and are never observable through `bounds()`" — aligned with `merge_bounds_into_cache` + `WebView::bounds()` (Context facts). No implementation change (the implementation is the reference point per the issue).
- `openspec/changes/archive/2026-10-20-ohos-webview-sizing/design.md:189` ("2in1 PC density 1.0, vp==px") and `red-light-evidence.md:28,52`: **appended** correction notes (erratum blocks at the end of each file), never in-place rewrites — the standing no-history-rewrite policy. `red-light-evidence.md` already carries two layers of P2-3 errata; the new erratum block explicitly points at the P2-3 text it corrects so the stacked errata stay readable. The erratum states: Physical→vp conversion executes (cmd.rs `set_bounds_test` sends `Size::Physical` probe rects) but was never separately asserted; the density claim is reconciled per D6b.
- The `85617fbd3` comment mislabeling the Physical probe as "logical bounds" is corrected in its actual file (located via `git show 85617fbd3 --stat`; the commit touched `examples/api/src-tauri/src/cmd.rs` and/or `core.ts` — both are checked).
- **D6b — vp 口径依据**: derive the density number from existing in-tree device evidence (test reports recording display density / dpi on the 2in1 device) if present; otherwise run the one-line device probe and record the measurement command + value. The chosen number and its 依据 are written into the doc comment so the claim is reproducible — the issue explicitly demands "写明依据".

### D7 — #248: report decision gate + honest counts + the one tree-level strengthening

- **Report file**: the complete local copy exists — `examples/api/device-report-1030-finalchain-desktop.md` (340 lines, untracked, footer + provenance pinning head `947310a3a`, device 3QC0124C11000038, 327 cases). Take the issue's first option: commit it **under its on-disk name** (provenance intact, no rename, no fabrication) and correct the PR#241 body to reference the actual path — the body's `test-report-1030-finalchain-desktop.md` name was itself the defect, so renaming the file to match the wrong body reference would launder it. The corrected body's reference must then pass the DOCA-3 `test -f` check.
- **TR-5 strengthening** (`examples/api/src/lib/tests/driver-generated.ts`): the `float.hide+show+center` case passes even when `hide()` silently no-ops (tao writes the mirror eagerly before dispatch; ArkTS no-ops) — the case gains an assertion that actually discriminates "dispatched and applied" from "dispatched only" if one is constructible at that layer; otherwise it is relabeled smoke. Apply-time decision with the chosen arm recorded in the issue reply.
- All other items (7897/7872/7916 line counts with the derivation command; tray path `crates/tauri/src/tray/mod.rs`; `99a43d928` "docs" title vs `Webview::unlisten_js` behavior change and `67a331549` stat; P2-1 "sentinel gates the back-fill in all three write paths" (two paths unconditional, SetAutoResize sends none) and P2-2 "return the real geometry" (doc-only); shifted line refs 4618/4694/4795; stale "audit 13→24"/"35 files"; the Window.svelte caller addition) are **PR#241-body corrections** (PUT, user-gated) — counts re-derived live from `git diff a69ab772c5..947310a3a8 --stat` at writing time, never copied from older waves (the submit-gate 口径 rule).

### D8 — #249: tao comment narrowed + description corrected

- Tree: `src/platform_impl/ohos/window.rs:754-755` comment changes from "Runtime setters on UIAbility-kind windows error out" to the three decoration-button setters only (`set_resizable` does not error on UIAbility, `:1924-1968`).
- Body (tao#28, user-gated PUT): main-window creation seed wording aligned to code (main-window id 0 is always ready, deferred ops inline, unresolvable client = warn+drop; only pending-handshake windows survive); T28-1 "injects a real window client" corrected to the UT's actual observable (`window_client: None` + `PENDING_WINDOW_OPS`); hash/count corrected to `f01c81b5..c7a36176` = 19 commits.

### D9 — #250: ability description corrections + breaking-change marking

Body (ability#55, user-gated PUT): A55-3's two sentences corrected (beta.1's main window feeds **component-relative** `event.x/event.y` — `b1f0ac9ea3:native_ability/src/main/ets/components/MainPage.ets:228-237`; sub-windows feed nothing; screen-global vp feed via `cursor_feed.ets` is this PR's addition); the 2026-10-21/22 seven behavior commits (theme injection, url sync, intercept/response header, `Header[]`, StageEventType, tracked window ops) listed; count corrected 68→66; head corrected to `536dff5f74`. Breaking change: `WindowCreateParams.window_type` public field removal gets an explicit breaking-change marker in the body, and in the repo's CHANGELOG if one exists (apply-time check; if none, body-only — the issue says "正文/CHANGELOG", either satisfies).

### D10 — #251: zero-residue sweep + behavioral UT + @since from d.ts + round-trip UT

- **Float sweep**: wide grep first (case-sensitive `Float`), manual triage (wire identifiers `RouteName "FloatWindow"` / `notify_float_window_registered` are intentionally kept and already comment-pinned; WMS API names and lowercase behavioral prose are legal), then the discriminative pattern must hit **zero** across the named trees — the submit-gate F-section rule (zero-hit is the only closure). Named sites: `crates/ability/src/window/mod.rs:98,521,547,551,594,600,673,681` (:681 is an info log), `crates/plugin-app-control/src/lib.rs:157`, `native_ability .../WindowManager.ets:2031`, plus grep-discovered remainder (~13 total per the issue). The PR body's "65→21" claim is corrected in the same body PUT as D9.
- **#238 UT strengthening** (`crates/plugin-window/src/lib.rs:1157-1205`): the primary arm — invoke the facade for the main-window id on host and assert the returned error is the **napi host-stub pathway error** rather than any pre-gate rejection — is **apply-time-verify**: the UT's own comment (lib.rs:1162-1167) records that a live behavioral probe is not executable on the host (`BridgeRuntime` is only constructible from a real N-API Env), so this arm is expected to fall to the fallback. The fallback widens the source-structure assertion beyond text markers to catch helper/`matches!`-form gates (e.g. asserting no conditional construct on any path from the facade entry to the dispatch call, including called helpers in the same file). Whichever arm runs, and the fallback's residual limitation if it is the one, are recorded and disclosed in the issue reply — no silent downgrade.
- **@since**: `app.rs:1514-1517` (windowEvent) and `plugin-webview/src/lib.rs:347` (incognitoMode) re-derived from the SDK d.ts on the dev machine (the 2026-10-27 spot-check method), values written with the d.ts path as source. The windowEvent value is not a stray typo — app.rs:1512-1517 carries an in-code justification sentence ("windowFocusChange absent from the local SDK20 d.ts, `@since 20 windowEvent` used as the equivalent signal"); the value change must rewrite that justification (and the plugin-webview :347 parenthetical) in the same commit, else the note contradicts the new value.
- **Round-trip UT** (`crates/ability/src/global_shortcut/types.rs`, in-crate `#[cfg(test)]`): for every `Key` variant, `Key::from_name(k.as_str()) == Some(k)`; plus `as_str()` round-trips; plus one negative (`from_name("NoSuchKey") == None`); count pinned (75 rows). Mutation-proofable: any table edit breaks it.

### D11 — #252: wry#26 body rewritten from the actual chain

Delete the stale "Documentation only; no behavior change in this repo" (:11) and "checks green" (:15) claims; correct the `examples/gtk_opengl.rs` claim (:38 — commit `0d73538` modified it, so it is not "identical to the merge base"); list the behavior changes among the 12 commits; derive the non-comment line count live (`~444` per the issue, re-derived at writing). Pure body PUT, zero tree changes.

### D12 — #253: public doc paragraph + set-on-success devtools flag

- Doc (wry/src/lib.rs:2372-2377): extend the sentinel/bounds doc with the cross-dpi-variant rule — within the same variant, partial writes merge per component; **across variants** (Logical ↔ Physical) a partial write preserves the whole axis including components already set in the write. Sourced from `merge_bounds_into_cache` (src/ohos/mod.rs:233-240, 263-267) and mirrored from the internal comment (:200-204).
- Flag (wry/src/ohos/mod.rs): the flag currently records **request intent** — set before the call at ~:1633-1634, and the code comment at :1628-1630 explicitly documents that contract (this is W26-4's finding, in-code). Moving to set-on-success requires covering **every** success-shaped path, not one: (a) the ready-branch dispatch success (:1641-1647); (b) the pre-handshake queue-replay path; (c) the create-drain path; and (d) the **idempotent early-return arm** (:1635-1638, `needs_dispatch=false` return when the process-level devtools is already applied) — there the flag must be set without a new dispatch, otherwise a second webview's `is_devtools_open()` stays false while devtools is actually open (a reverse inconsistency). Failure paths leave the flag unset → `is_devtools_open() == false` — the issue's preferred route ("失败后返回 false" first, "或文档写明语义" fallback). The :1628-1630 contract comment is rewritten in the same commit (semantics change: request-intent → open-state — precisely the comment/code truth discipline this change exists to enforce), and the devtools UT cluster is checked for any assertion depending on the old intent semantics.

### D13 — Cross-cutting discipline (encoded in every task group)

- **Per-issue scope**: each task group's edits are limited to the files that issue names (plus files the issue's 建议 explicitly requests, e.g. #244's device case). Cross-issue coupling is called out explicitly (the only ones: #246 fixes the Window.svelte caller that #248 item 7 says was missed — no coupling in code, only a cross-reference in replies; #244's ability comment and #251's ability sweep are separate groups, separate commits).
- **Per-issue acceptance**: each group ends with an acceptance task that re-pulls the issue body (`gh api .../issues/<n> --jq .body`) and checks every 验收 bullet against live evidence (device run / UT output / grep-zero / body diff), not against this design's paraphrase.
- **Commits**: one commit per issue per repo, message referencing the issue number; files named explicitly in `git add`; known churn traps excluded (tauri: schema.json churn, untracked scratch; wry: CRLF phantom-M — verify with `git diff --ignore-cr-at-eol` before staging; ability: untracked root dirs `\.botbrain|\.botgate|\.rebase-audit|\.tmp|target*` never added; skill dirs never committed).
- **Mutation proof** (submit-gate Step 4): every fix+test pair added by this change gets a 修后必挂 run — checkout the pre-fix file, run the test, expect FAIL, restore. Device-side pairs that cannot cheaply roll back get the L7 discrimination question answered in writing + "mutation 未跑 + 理由" recorded.

## Risks / Trade-offs

- **#244 partial corner is log-not-Err** (D2): accepted because the channel is fire-and-forget and inventing a sync reply path is a Non-Goal; mitigated by a specific greppable error + explicit disclosure in the issue reply. Risk: E wanted "明确返回不支持" as the alternative — the reply must lead with the real re-arm (route 1 of the acceptance, fully implemented) so the corner never reads as a dodge.
- **#247 device-UT runnability unproven** for tauri-runtime-wry (tao has a device-UT harness; this crate does not — first attempt). Mitigation: the UT lives in lib.rs (scope-legal), the attempt is a bounded task; fallback = code-path verification + disclosure of what was and wasn't run, per the gate's honest-reporting rule.
- **Post-merge body PUTs and replies are user-gated** — nothing outward-facing executes without confirmation; the replies are drafted from live diff evidence only (the "回复文本必须从 diff 现场 derive" rule).
- **Archived-artifact edits**: errata are appended, not rewritten (D6); a reviewer may prefer rewrites — the no-rebase-errata policy is standing user guidance, disclosed in the reply.
- **ArkTS comment edit (#244) forces HAR repack** — suite re-run cost; comment-only so outcomes must be line-identical to baseline (a check, not an assumption).
- **Ability Float sweep zero-hit** is pattern-dependent — the wide-grep→triage→discriminative-pattern-zero closure procedure (submit-gate F) is mandatory, with the wide-grep numbers and triage reasons archived in `.tmp` for the reply.
- **Scope discipline vs. grep-discovered residue** (#251 "等" sites beyond the named list): the issue itself says "等仍有" with an approximate count, so sweep-discovered non-wire Float sites within the same named trees are in-scope; anything outside those trees is reported, not edited.

## Test Design

Spec → test mapping (specs live under `specs/webview-runtime-behavior/` and `specs/documentation-alignment/`; every requirement below has a scenario in the spec files):

| Spec requirement | Test (layer) | Mutation obligation |
|---|---|---|
| WEBV-1 disable→enable re-arms (#244) | examples/api device suite case: explicit-bounds webview → `set_auto_resize(false)` → `set_auto_resize(true)` → window resize → assert webview rect tracks (device) | checkout pre-fix lib.rs → case must FAIL (webview stops following) |
| WEBV-2 runtime enable on full-explicit (#244) | device case variant: create with explicit bounds, auto_resize off, enable at runtime, resize, assert tracking | same checkout arm (pre-fix: no derivation exists) |
| WEBV-3 natural enable follows container (#244) | device case: natural webview, enable, resize, assert container-following (no error) | own mutation arm: pure-fn UT inverts the natural arm to expect an error → fails (cost ~one assertion) |
| WEBV-4 partial corner is loud (#244) | host UT on the decision function (the table in D1 is a pure decision over state — extract as a testable pure fn) + hilog grep on device for the error tag | UT: invert the log arm → UT fails |
| WEBV-5 create failure leaves no residue (#247) | `#[cfg(all(test, target_env = "ohos"))]` UT in lib.rs (registry-level); device-UT runnability gate with fallback disclosure | UT: remove the Err-path removal → UT fails (pre-fix code = the mutation itself) |
| WEBV-6 zero unhandled rejections (#246) | device run: OHOS desktop form, open Window page, click hide + toggle four switches, capture webview console/hilog — zero `UnhandledPromiseRejection` | remove the catches → rejections reappear (device-side red/green or L7 written) |
| WEBV-7 devtools flag after failure (#253) | device suite existing devtools cases + code review of set-on-success; UT if a host-visible seam exists (likely not — record) | L7 written answer |
| WEBV-8 #238 facade behavioral UT (#251) | primary arm apply-time-verify (host probe; lib.rs:1162-1167 records BridgeRuntime needs a real N-API Env, so fallback expected): fallback = source-structure assertion widened to catch helper/`matches!` gates; whichever arm runs is disclosed | fallback arm mutation: introduce a helper-form pre-gate → UT fails; primary arm mutation: fake pre-gate changes error identity → UT fails |
| WEBV-9 Key round-trip (#251) | host `cargo test -p ability`: 75/75 `from_name(as_str()) == Some(k)` + negative | edit one NAME_TABLE row → UT fails |
| DOCA-1 bounds() read-back doc truth (#245) | doc-diff review vs `merge_bounds_into_cache` source (human + grep for removed sentinel-read-back claim) | n/a (doc) — verified by text-vs-code consistency check |
| DOCA-2 vp 口径 reproducible (#245) | the chosen density value carries its derivation (report/probe command) in the erratum | n/a — 依据 recorded |
| DOCA-3 referenced files exist (#248) | `test -f` for every file the corrected bodies reference (machine check, submit-gate Step 2) | n/a |
| DOCA-4 counts re-derivable (#248/#249/#250/#252) | every count in body corrections re-derived live via `git diff --stat` / commit-list commands at writing time; commands quoted in the reply | n/a |
| DOCA-5 Float residue zero (#251) | F-section wide grep + discriminative pattern zero-hit across named trees, output archived | pattern regression = nonzero hits by construction |
| DOCA-6 @since matches SDK (#251) | d.ts spot-check at apply time; values + d.ts path recorded | n/a |
| DOCA-7 cross-dpi semantics documented (#253) | doc-diff review vs `merge_bounds_into_cache` | n/a |
| DOCA-8 breaking change discoverable (#250) | corrected body/CHANGELOG grep for the window_type breaking entry + readability review | n/a |
| DOCA-9 wry#26 body claims match the diff (#252) | every body claim checked against the PR commit list/diffs: no "documentation only", gtk_opengl.rs correctly in-scope, behavior list complete | n/a |
| DOCA-10 tao setter comment scope (#249) | comment text vs `set_resizable` behavior at window.rs:1924-1968 (does not error on UIAbility) | n/a |
| DOCA-11 TR-5 case discriminates or is labeled smoke (#248) | the float.hide+show+center case either asserts an applied-outcome discriminator (fails when hide() silently no-ops) or carries an explicit smoke label; chosen arm recorded | if discriminator arm: revert to pre-fix semantics → case must fail |

Cross-cutting: full workspace host tests per repo after all groups (tauri `cargo test -p tauri-runtime-wry` 15/0 baseline + suite; ability workspace 191/0 baseline; wry/tao check+test baselines), one full examples/api device suite run on the final four-repo chain, and the submit-gate machine pre-scan (A/C/E/F sections) per repo on the new wave's base..HEAD.

## Task Signals

```yaml
tags: [ohos]
routed_skills: [rust-ohos]
```

Knowledge routing consumed during design: `by_tag[ohos] → rust-ohos` (routing.yaml). The rust-ohos domain is checklist-style; its only reference (BUILD.gn gn-guide) is not applicable to this change (no GN build files touched — all repos use cargo/DevEco toolchains) — recorded as consumed-not-applicable. FFI-adjacent work (napi host-stub error identity in WEBV-8) stays within the existing host-stub mechanism, no new FFI surface. Async signals are JS promise handling in the examples layer, not Rust async — no rust-async routing.
