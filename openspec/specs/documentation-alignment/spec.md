# documentation-alignment Specification

## Purpose
TBD - created by archiving change ohos-committer-issues-r2. Update Purpose after archive.

## Requirements

### Requirement: bounds() read-back documentation matches implementation

The tauri-side documentation for webview `bounds()` read-back SHALL state that a component left unspecified by a partial `set_size`/`set_position` reads back as its last cached value (the sentinel values sent by partial writes are screened by the wry-side cache merge and are never observable), and SHALL NOT claim that sentinels are read back.

#### Scenario: doc claim agrees with the cache merge

- **WHEN** the corrected doc comments (crates/tauri/src/webview/mod.rs, packages/api/src/webview.ts) are compared against wry's `merge_bounds_into_cache` and `WebView::bounds()`
- **THEN** the documented read-back semantics equal the implemented semantics (last cached value, sentinels never read back)

### Requirement: vp density claim is reproducible

The corrected vp/density claim in the ohos-webview-sizing archived change (appended erratum, no in-place rewrite) SHALL state the measured density value and its derivation (source report or probe command), and the Physical-probe comment in examples/api SHALL describe the probe as physical units.

#### Scenario: the claim carries its derivation

- **WHEN** a reader checks the density statement
- **THEN** the value's source (existing device report reference or the recorded probe command) is stated alongside it

### Requirement: Corrected prose references exist and counts re-derive

Every file path referenced by the corrected PR bodies (tauri#241, tao#28, openharmony-ability#55, wry#26) SHALL exist in the referenced tree at the referenced head, and every count (line counts, commit counts, case counts) stated in the corrections SHALL re-derive live from git/diff commands quoted alongside it.

#### Scenario: referenced files resolve

- **WHEN** each corrected body's referenced file path is checked with `test -f` against the repo at the stated head
- **THEN** every path exists

#### Scenario: counts reproduce

- **WHEN** each corrected count is recomputed with its quoted derivation command
- **THEN** the recomputed number equals the stated number

### Requirement: Breaking public API change is marked

The openharmony-ability#55 corrected body (and CHANGELOG, if the repo maintains one) SHALL explicitly mark the `WindowCreateParams.window_type` public field removal as a breaking public API change.

#### Scenario: breaking change is discoverable

- **WHEN** a reader scans the corrected body (or CHANGELOG) for breaking changes
- **THEN** the window_type field removal is explicitly listed as breaking

### Requirement: Float prose residue zero in the named trees

Non-wire Float wording (prose, logs, comments that name the old Float terminology rather than the sub-window terminology) SHALL be zero across the trees named by issue #251, with wire identifiers (`RouteName "FloatWindow"`, `notify_float_window_registered`) remaining intentionally and their retention pinned.

#### Scenario: discriminative sweep hits zero

- **WHEN** the discriminative Float pattern is grepped across the named trees (crates/ability, crates/plugin-app-control, native_ability) on the fixed head
- **THEN** zero non-wire hits remain, and the wide-grep numbers and triage reasons are archived

### Requirement: @since claims match the SDK

The corrected `@since` claims (windowEvent in crates/ability/src/app.rs, incognitoMode in crates/plugin-webview/src/lib.rs) SHALL equal the SDK versions from the d.ts definitions they describe.

#### Scenario: version agrees with d.ts

- **WHEN** the corrected @since value is compared against the d.ts declaration of the same API in the SDK on the dev machine
- **THEN** the values match and the d.ts path is recorded

### Requirement: tao setter comment scope accuracy

The tao comment on UIAbility-kind window setters SHALL name only the three decoration-button setters as erroring, and SHALL NOT claim that runtime setters in general error out on UIAbility-kind windows.

#### Scenario: comment agrees with set_resizable behavior

- **WHEN** the corrected comment (src/platform_impl/ohos/window.rs:754-755) is compared against the setter implementations (set_resizable at :1924-1968 does not error on UIAbility-kind windows)
- **THEN** the comment's error claim covers exactly the three button setters

### Requirement: TR-5 case discriminates or is labeled smoke

The examples/api driver case exercising float sub-window hide+show+center SHALL either assert an outcome that fails when the hide dispatch succeeds but is not applied, or carry an explicit smoke label stating that a silently-successful hide passes.

#### Scenario: silent no-op hide is not masqueraded as verified

- **WHEN** the hide() call silently no-ops (tao writes the mirror before dispatch; ArkTS does nothing)
- **THEN** the case either fails (discriminator arm) or is explicitly labeled smoke (label arm); it never reads as a verified behavior

### Requirement: wry public docs cover cross-dpi sentinel merge semantics

wry's public documentation for partial bounds writes SHALL document both merge rules: same-variant partial writes merge per component; cross-variant partial writes preserve the whole axis, including components explicitly set in the same write.

#### Scenario: doc covers the cross-variant rule

- **WHEN** a reader reads the public set_bounds/bounds documentation
- **THEN** the cross-dpi-variant whole-axis rule is stated alongside the per-component rule, matching `merge_bounds_into_cache`

### Requirement: wry#26 body reflects the actual chain

The corrected wry#26 body SHALL contain no "documentation only / no behavior change" claim, SHALL not claim `examples/gtk_opengl.rs` is outside the change, and SHALL list the behavior changes among the actual commits with line counts derived from the chain.

#### Scenario: body claims match the diff

- **WHEN** the corrected body's claims are compared against the PR's actual commit list and diffs
- **THEN** the behavior-change list is complete and the counts match live-derived numbers
