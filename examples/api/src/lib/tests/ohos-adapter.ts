import { skipOnMobile, type TestCase } from '../test-runner';
import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

/** True when running on OHOS (any device form). Same gate as ohos-init.ts. */
async function isOhos(): Promise<boolean> {
  try {
    const { platform } = await import('@tauri-apps/plugin-os');
    return platform() === 'ohos';
  } catch {
    return false;
  }
}

/**
 * Tests for the OHOS adapter features implemented via openspec changes
 * ohos-webview-flag-clipboard / flag-zoom-hotkeys / dialog-error /
 * event-lifecycle-forward / monitor-real-values / dialog-folder-picker /
 * webview-print / webview-drag-drop.
 *
 * Most of these features need device interaction (keyboard, drag, system
 * dialogs) and are classified 'manual' or 'side-effect'. Only monitor real
 * values are fully 'auto'.
 */
export const ohosAdapterTests: TestCase[] = [
  // #5 ohos-monitor-real-values: size() now returns DisplayManager physical
  // pixels (was content_rect). Assert non-zero display size.
  {
    name: 'ohos-adapter.monitor.real-size',
    category: 'auto',
    async fn() {
      await skipOnMobile('currentMonitor is upstream cfg(desktop) and absent from the mobile build');
      const m = await currentMonitor();
      assert(m !== null, 'currentMonitor returned null');
      assert(
        m!.size.width > 0 && m!.size.height > 0,
        `monitor size should be > 0 (DisplayManager physical px), got ${JSON.stringify(m!.size)}`
      );
      assert(m!.scaleFactor > 0, `scaleFactor should be > 0, got ${m!.scaleFactor}`);
      // Manual §二十七 (removed 2026-08-27): "值不随窗口最小化/恢复变化" —
      // DisplayManager physical pixels are window-independent by construction;
      // assert two consecutive calls return identical size as a stability proxy.
      const m2 = await currentMonitor();
      assert(
        m2 !== null && m2.size.width === m!.size.width && m2.size.height === m!.size.height,
        `monitor size should be stable across calls (DisplayManager physical px), got ${JSON.stringify(m!.size)} then ${JSON.stringify(m2?.size)}`
      );
      console.log(`[monitor] size=${m!.size.width}x${m!.size.height}, scaleFactor=${m!.scaleFactor}, name=${m!.name}`);
    },
  },

  // refreshRate is a Rust-only value (tao video_modes field; tauri::Monitor
  // doesn't carry it, JS Monitor API has no refreshRate on any platform).
  // probe_display_refresh_rate reads DisplayManager via NDK (same source as
  // video_modes) — this auto test is its device verification entry.
  {
    name: 'ohos-adapter.monitor.refresh-rate',
    category: 'auto',
    async fn() {
      if (!(await isOhos())) {
        console.log('[monitor.refresh-rate] skipped: not OHOS');
        return;
      }
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<string>('probe_display_refresh_rate');
      const m = result.match(/refresh_rate=(\d+) Hz/);
      assert(m !== null, `unexpected probe result: ${result}`);
      const hz = Number(m![1]);
      assert(hz > 0, `refresh rate should be > 0, got ${result}`);
      console.log(`[monitor] ${result}`);
    },
  },

  // #6 ohos-dialog-folder-picker: covered by doc/manual_tests.md dialog open/directory
  // (directory variant of dialog.open — interactive picker, manual category like
  // the other dialog.open tests in plugins.ts).

  // #4 ohos-event-lifecycle-forward: MainEvent::Start → Event::Resumed.
  // Manual: background then foreground the app to trigger SHOWN → Resumed.
  {
    name: 'ohos-adapter.event.resumed',
    category: 'manual',
    async fn() {
      let fired = false;
      const unlisten = await listen('tauri://resumed', () => {
        fired = true;
      });
      console.log('[resumed] listener registered — background then foreground the app to trigger');
      // Give a brief window; full verification requires manual background/foreground.
      await new Promise((r) => setTimeout(r, 1000));
      unlisten();
      console.log('[resumed] fired within 1s:', fired, '(manual: background/foreground app to verify)');
    },
  },

  // #7 ohos-webview-print: print() invokes @ohos.print (desktop) / no-op if
  // page not loaded. Manual: verify system print dialog appears.
  {
    name: 'ohos-adapter.webview.print',
    category: 'manual',
    async fn() {
      console.log('[manual] print: call webview print (e.g. via window.print() or a print button)');
      console.log('[manual] expected: system print dialog on desktop; temp PDF cleaned up after job');
      console.log('[manual] if PrintKit unavailable, falls back to createPdf + warn log');
    },
  },

  // #1 ohos-webview-flag-clipboard + #2 ohos-webview-flag-zoom-hotkeys:
  // flags are set per-webview at creation; verify via a test webview config.
  {
    name: 'ohos-adapter.flags.clipboard-zoom',
    category: 'manual',
    async fn() {
      console.log('[manual] with_clipboard(false): select text + Ctrl+C → clipboard unchanged');
      console.log('[manual] with_clipboard(true):  Ctrl+C → copies normally');
      console.log('[manual] with_zoom_hotkeys(false): Ctrl+= / Ctrl+- → no zoom');
      console.log('[manual] with_zoom_hotkeys(true):  Ctrl+= / Ctrl+- → ArkWeb native zoom');
      console.log('[manual] programmatic pasteboard read/write unaffected by flag');
    },
  },

  // #8 ohos-webview-drag-drop: drag a file onto the webview window.
  {
    name: 'ohos-adapter.webview.drag-drop',
    category: 'manual',
    async fn() {
      console.log('[manual] drag a file onto the webview window → drag_drop_handler fires');
      console.log('[manual] expected events: Enter → Over → Drop(paths) → Leave');
      console.log('[manual] if no event fires, ArkWeb does not bubble OS drag → overlay fallback (see spec)');
    },
  },

  // R80 ohos-webview-proxy-config: REVERTED — tauri doesn't expose proxy_config on any platform.
  // wry-level implementation removed. See openspec/specs/ohos-webview-proxy-config/ for design reference.

  // R72 ohos-webview-drag-drop-overlay: overlay fallback when ArkWeb doesn't bubble.
  // Requires with_drag_drop_overlay(true) + file drag.
  {
    name: 'ohos-adapter.webview.drag-drop-overlay',
    category: 'manual',
    async fn() {
      console.log('[manual] overlay: set with_drag_drop_overlay(true) on a test webview');
      console.log('[manual] drag a file onto the webview → overlay Stack receives ArkUI drag events');
      console.log('[manual] expected: Enter → Over → Drop(paths) → Leave via overlay (not Web-level handlers)');
      console.log('[manual] verify: pointer interaction (click/scroll/touch) still passes through to Web');
      console.log('[manual] if overlay also doesn\'t fire → platform limitation (ArkUI doesn\'t deliver drag)');
    },
  },

  // R75 ohos-webview-https-scheme: secure-context via onInterceptRequest.
  // Requires with_https_scheme(true) + custom protocol registered.
  {
    name: 'ohos-webview.https-scheme',
    category: 'manual',
    async fn() {
      console.log('[manual] https-scheme: set with_https_scheme(true) + register "tauri://" custom protocol');
      console.log('[manual] load tauri://localhost/index.html → URL rewritten to https://tauri.localhost/index.html');
      console.log('[manual] verify: page renders (onInterceptRequest intercepts + custom_protocol returns HTML)');
      console.log('[manual] verify: window.isSecureContext === true (hilog)');
      console.log('[manual] verify: typeof crypto?.subtle === "object" (secure-context API available)');
      console.log('[manual] verify: external https (https://example.com) loads normally (not intercepted)');
      console.log('[manual] verify: fetch("tauri://localhost/api") → intercepted by onInterceptRequest');
      console.log('[manual] if isSecureContext === false → ArkWeb doesn\'t recognize custom https origin (degradation)');
    },
  },

  // ohos-window-ignore-cursor-events: Window::set_ignore_cursor_events maps to
  // ohos.window.setWindowTouchable(!ignore) via TSFN fire-and-forget (mirrors
  // set_window_blur). ignore=true (pass through) ↔ touchable=false (don't consume).
  // Manual: overlay sub-window over the main window, set ignore=true, verify
  // touch+hover reach the window below. API version: setWindowTouchable requires
  // API 15+ per official Q&A (local docs say 9+/12+) — real device is the arbiter.
  {
    name: 'ohos-adapter.window.ignore-cursor-events',
    category: 'manual',
    async fn() {
      // Safe smoke call: setIgnoreCursorEvents(false) exercises the full TSFN bridge
      // (tao → openharmony_ability → ArkHelper → WindowManager → win.setWindowTouchable(true))
      // without making the test window non-touchable. fire-and-forget: always resolves
      // Ok from Rust; real proof is hilog + visual pass-through, not this call's return.
      try {
        const win = getCurrentWindow();
        await win.setIgnoreCursorEvents(false);
        console.log('[ignore-cursor-events] setIgnoreCursorEvents(false) returned OK (TSFN bridge wired)');
      } catch (e) {
        console.log('[ignore-cursor-events] setIgnoreCursorEvents(false) rejected:', e);
      }
      console.log('[manual] setup: create a Float sub-window overlapping the main window (transparent overlay)');
      console.log('[manual] on the overlay call setIgnoreCursorEvents(true) → maps to setWindowTouchable(false)');
      console.log('[manual] verify: touch/click the overlay area → event reaches the main window below (pass-through)');
      console.log('[manual] verify: mouse hover over overlay → cursor interacts with content below');
      console.log('[manual] hilog: grep "setWindowTouchable" → debug log = API called; "failed" log = API<15 or window not found');
      console.log('[manual] API version: setWindowTouchable requires API 15+ (HarmonyOS 5.0.0+); demo targets API 12 → verify device API first');
      console.log('[manual] if touch passes but hover does not → add hitTestBehavior(HitTestMode.Transparent) fallback (design R1)');
      console.log('[manual] restore: setIgnoreCursorEvents(false) on the overlay to re-enable event consumption');
      console.log('[manual] fail-safe discipline (ohos-cursor-passthrough 4.2): a cursorPosition() reject/untracked → MUST keep ignore=true (default pass-through); only a hit-test match on a trusted reading may set touchable=false');
      console.log('[manual] fail-safe scope: cursor_position Err means "untracked" ONLY — it is independent of this chain\'s fire-and-forget error channel (a setIgnoreCursorEvents failure never rejects the cursor read, and vice versa; R3: pass-through rejects do not notify Rust)');
    },
  },

  // ohos-cursor-passthrough: injection-style cursor-position freshness truth
  // test (manual / semi-automatic — the stimulus is host-side mouse
  // injection, so it cannot be an auto case; the runner never executes
  // manual fns, this body is the archived protocol). Segments map 1:1 to
  // openspec task 1.2; the HEAD red-light record (2026-10-19), the uinput -M
  // probe recipe, the graded fidelity-arbitration steps and the trace-gated
  // re-run protocol are archived in doc/manual_tests.md
  // ("OHOS cursor_position 契约与 app 侧 fail-safe 纪律" section).
  {
    name: 'ohos-adapter.window.cursor-position-freshness',
    category: 'manual',
    timeout: 20000,
    async fn() {
      // Step 0 (host, before anything): probe `hdc shell uinput` MOUSE mode
      // (-M family — no project precedent, verify the syntax from the tool's
      // own help). ArkUI onMouse is mouse-pointer semantics; touch injection
      // synthesizing onMouse is unproven, so touch templates are retired.
      // Degrade to the physical-mouse manual protocol ONLY on "-M
      // unavailable / syntax mismatch" — never on "no onMouse trace" (at the
      // red-light HEAD there is no feed instrumentation to trace).
      // Ground truth sources: `hidumper -s WindowManagerService -a '-a'`
      // (window rects) + outerPosition() readiness poll (the window_rect
      // snapshot is seeded by windowRectChange only after content load —
      // reading it right after creation can yield (0,0)).
      console.log('[cursor-freshness] seg0 main-window feed path (before any Float sub-window exists): inject two known points >=100px apart inside the main window content area (below the menubar)');
      console.log('[cursor-freshness]   red phase: cursorPosition() readings move with the injections (response increment = stimulus reached) BUT differ from the injected screen points by more than the +/-40px domain (component-relative vp feed — root cause 2)');
      console.log('[cursor-freshness]   re-run phase (after the helper switch): readings ~= injected points (+/-40px) AND hilog shows cursor_feed lines (MainPage actually feeds through the shared helper)');
      console.log('[cursor-freshness]   geometry guard: |main-window origin| + MainPage component offset must exceed 40px for the red discriminant to be meaningful, else record "red-light weakened" explicitly');
      console.log('[cursor-freshness] seg1 sub-window freshness + origin-offset discriminant: create a Float sub-window, poll outerPosition() until non-zero, cross-check the rect with hidumper, inject at the window center');
      console.log('[cursor-freshness]   assert cursorPosition() ~= injected point (+/-40px) AND the discriminant: |reading - in-window-offset hypothesis| >= |window origin| - 80px (weakened-result must be recorded, never silently passed, when the origin norm <= 80px)');
      console.log('[cursor-freshness]   HEAD red: the snapshot stays at the last main-window coordinate (root cause 1: FloatPage had no onMouse at all)');
      console.log('[cursor-freshness] seg2 press feed: move then mouse down (-M family) on the sub-window; assert reading ~= press point and stable after release (Move/Press feed, Release never feeds)');
      console.log('[cursor-freshness] seg3 global-frame discriminant (window-move-free): inject a second known in-window point (e.g. the 1/4 point); assert reading ~= that point\'s global coords and the seg1 discriminant re-holds (reading follows the physical injection point, not the in-window offset)');
      console.log('[cursor-freshness] seg4 finite-value guard (NOT device-executable): displayX is a declared-required field and NaN/undefined is unreachable per D2 — verify via the implementation-time debug variant (synthetic non-finite event straight into feedCursorFromMouse → skip + no cursor_feed trace) or code walkthrough');
      console.log('[cursor-freshness] seg5 API20+ field source: helper hilog.debug (tag cursor_feed) names the adopted field — API 23 device asserts globalDisplayX; API<20 asserts displayX');
      console.log('[cursor-freshness] fail-safe demo: cursorPosition() reject (untracked) → keep setIgnoreCursorEvents(true) (default pass-through); only a hit-test match may set touchable — and Err means untracked ONLY, independent of the pass-through chain\'s fire-and-forget error channel');
    },
  },
];
