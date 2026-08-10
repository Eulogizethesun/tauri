import type { TestCase } from '../test-runner';
import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
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
      const m = await currentMonitor();
      assert(m !== null, 'currentMonitor returned null');
      assert(
        m!.size.width > 0 && m!.size.height > 0,
        `monitor size should be > 0 (DisplayManager physical px), got ${JSON.stringify(m!.size)}`
      );
      assert(m!.scaleFactor > 0, `scaleFactor should be > 0, got ${m!.scaleFactor}`);
      console.log(`[monitor] size=${m!.size.width}x${m!.size.height}, scaleFactor=${m!.scaleFactor}, name=${m!.name}`);
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
    },
  },
];
