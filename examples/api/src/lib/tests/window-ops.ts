import type { TestCase } from '../test-runner';
import { getCurrentWindow, currentMonitor, Window } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

/// Only checks that the call does not throw. Used for capabilities with no getter to read back (cursor/focus, etc.):
/// it does **not** prove the effect actually applies on OHOS — that requires manual button verification.
async function smoke(fn: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await fn();
  } catch (e) {
    throw new Error(`${label} should not throw (smoke), got: ${e}`);
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/// Creates a Float sub-window for testing resize/move.
/// The main UIAbility window is managed by the system; win.resize()/moveWindowTo() are rejected (no-op);
/// Float sub-windows can be resized/moved freely (also proven by the FloatPage resize handle).
async function createFloatWindow(label: string): Promise<Window> {
  await invoke('create_borderless_window', { windowId: label });
  await delay(600);
  const w = await Window.getByLabel(label);
  assert(w, `Float window "${label}" not found after create`);
  return w;
}

/// issue#97's acceptance criterion is "exact equality, zero tolerance". Polling only removes the timing jitter of the resize-inner async bridge
/// round trip (a single fixed delay can read a stale value on the slow path); it does not loosen the assertion:
/// timeout means fail, and the error carries the series of observed values.
async function readBackEquals(
  read: () => Promise<{ width: number; height: number }>,
  w: number,
  h: number,
  label: string,
  timeoutMs = 5000,
): Promise<void> {
  const seen: string[] = [];
  const start = Date.now();
  for (;;) {
    const cur = await read();
    if (cur.width === w && cur.height === h) return;
    seen.push(`${cur.width}×${cur.height}`);
    if (Date.now() - start > timeoutMs) {
      throw new Error(`${label}: 期望 ${w}×${h}，${timeoutMs}ms 内读回 ${seen.join(' → ')}`);
    }
    await delay(200);
  }
}

/// Main-window resize only takes effect in the free-floating form factor (PC/2in1); on phone the fullscreen main window is a system-level
/// no-op (see the window-resize row in doc/ohos-window-test-mapping.md). outerSize ≈
/// display counts as the fullscreen form factor, so skip the main-window size case (same policy as the maximize case's alreadyMax
/// early exit; the tradeoff is it also skips when the PC window is maximized).
async function mainWindowResizable(): Promise<boolean> {
  const win = getCurrentWindow();
  const mon = await currentMonitor();
  if (!mon) return true; // no monitor info: optimistically assume resizable
  const outer = await win.outerSize();
  return !(outer.width >= mon.size.width * 0.95 && outer.height >= mon.size.height * 0.95);
}

/// Honest testing: only assert effects that can genuinely be observed from JS.
/// - setInnerSize: strict read-back on the main window (resize fires the size callback, so read-back is reliable).
/// - setOuterPosition: smoke (no throw). moveWindowTo only changes position and does not fire the rect callback we listen to,
///   so outer_position() always reads back the old value and the move effect cannot be verified from JS (see the #143 comment).
/// - maximize: main-window innerSize approaches the display size.
/// - cursor / focus / focusable / ignoreCursor / decoration flags: no getter, or no-op on the main window,
///   so smoke only (no throw); effects are verified via manual buttons.
export const windowOpsTests: TestCase[] = [
  // ─── Diagnosis: setFullscreen real behavior on the main window (run first so it always executes) ───
  {
    name: 'window.setFullscreen diag (main window)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      const diag: string[] = [];
      const log = (s: string) => { diag.push(s); console.log('[diag-fs]', s); };
      const before = await win.isFullscreen();
      const beforeInner = await win.innerSize();
      const beforeOuter = await win.outerSize();
      log(`before: isFullscreen=${before} inner=${beforeInner.width}×${beforeInner.height} outer=${beforeOuter.width}×${beforeOuter.height}`);
      await win.setFullscreen(true);
      await delay(1000);
      const afterOn = await win.isFullscreen();
      const onInner = await win.innerSize();
      const onOuter = await win.outerSize();
      log(`after on: isFullscreen=${afterOn} inner=${onInner.width}×${onInner.height} outer=${onOuter.width}×${onOuter.height}`);
      await win.setFullscreen(false);
      await delay(800);
      const afterOff = await win.isFullscreen();
      log(`after off: isFullscreen=${afterOff}`);
      // Diagnostic only — no hard assertion. The diag lines above are logged to
      // console for manual inspection (fullscreen on OHOS main window is often a
      // no-op or resolve-but-noop; verify via the printed values, not an assert).
    },
  },
  // ─── Multi-UIAbility instances (startAbility path) — placed first to make sure they actually run ───
  // Create a single UIAbility instance, wait 3s for the new instance to load hello.html and send IPC.
  // Verifies webview registration succeeded + the main instance is alive. IPC label diagnostics are covered by protocol.rs logging.
  {
    name: 'window.createUIAbilityWindow (webview registered + new instance IPC)',
    category: 'auto',
    // UIAbility spawn (startAbility handshake + instance load) varies 1-2.5s
    // (slower on a fresh install); with the 3s settle delay below the total
    // walks past the runner's 5s default. Same for the racy-attrs repro below.
    timeout: 10000,
    async fn() {
      // "test-" prefix matches the run-app capability window patterns ([test-*])
      // so the spawned instance's webview is allowed to invoke commands.
      const label = 'test-uiability-' + Date.now();
      const result = await invoke<{
        label: string;
        webview_acquired: boolean;
        all_webview_labels: string[];
      }>('create_ui_ability_window', { windowId: label });

      assert(
        result.webview_acquired === true,
        `webview not acquired: label=${result.label}, all_labels=${JSON.stringify(result.all_webview_labels)}`
      );

      // Wait 3s for the new instance to load hello.html and for page JS to send IPC (sentry, etc.)
      // If the new instance's WebView IPC label does not match, hilog reports
      // "failed to acquire webview reference" + protocol.rs prints the label
      await delay(3000);

      // main instance still alive
      await smoke(() => invoke('dummy_command'), 'dummy_command (post-create alive check)');
    },
  },
  // ─── issue-7 repro (doc/OHOS窗口遗留问题.md issue 7): creation-time property race on spawned-UIAbility windows ───
  // decorations(false) + min_inner_size(400,300) + set_decorations(false) right after build —
  // all three set-downs reach ArkTS before the startAbility handshake completes. Bug evidence: hilog's
  // 'Unknown OS sub-window' warn + the window having a system title bar / no size floor (check via hilog/screenshots);
  // this case pins the trigger path and diagnoses whether the min-size floor takes effect (setSize below the floor, then read back).
  {
    name: 'window.createUIAbilityWindowRacyAttrs (issue-7 repro)',
    category: 'auto',
    // 3s replay settle + 0.8s resize settle + spawn: 4.9s-5.9s observed —
    // the 5s runner default left a 33ms margin on 2026-09-28 run h and tipped
    // over on the fresh-install run i. 15s keeps the assertions intact while
    // absorbing spawn variance.
    timeout: 15000,
    async fn() {
      const label = 'test-uia-racy-' + Date.now();
      const result = await invoke<{
        label: string;
        webview_acquired: boolean;
        ohos_window_id: number;
      }>('create_ui_ability_window_racy_attrs', { windowId: label });
      assert(
        result.webview_acquired === true,
        `webview not acquired: ${JSON.stringify(result)}`
      );
      // Wait 3s so the queued tao-side properties replay after the new instance's stage registers (issue-7 fix) and the webview settles.
      await delay(3000);
      // Hard assertion (2026-09-17 on-device verdict: setWindowLimits clamps programmatic resizes;
      // after the fix the floor is ENFORCED and outer==inner with no title bar — doc/OHOS窗口遗留问题.md issue 7).
      // Size semantics (D2): setWindowLimits clamps the outer rect (the win.resize target),
      // innerSize = outer − title bar; the criterion converts outerSize × scaleFactor into physical pixels
      // and compares them against the 400×300 logical floor (the first probe round compared physical innerSize directly against the logical floor,
      // which would misjudge 300×200@1.9x as ENFORCED — fixed).
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      const win = await Window.getByLabel(label);
      assert(win, `window not found by label after settle: ${label}`);
      const before = await win.outerSize();
      await win.setSize(new LogicalSize(300, 200));
      await delay(800);
      const after = await win.outerSize();
      const inner = await win.innerSize();
      const scale = await win.scaleFactor();
      const floorW = Math.floor(400 * scale);
      const floorH = Math.floor(300 * scale);
      // ① setSize must have an effect (guards the floor assertion against false green: if resize is entirely broken and the window stays at
      //    its original size (>= the floor), ② would pass spuriously)
      assert(
        after.width !== before.width || after.height !== before.height,
        `setSize(300×200) had no effect: outer ${before.width}×${before.height} → ${after.width}×${after.height}`
      );
      // ② 400×300 logical floor clamping (issue-7 regression guard: min_inner_size set at creation time is no longer lost)
      assert(
        after.width >= floorW - 2 && after.height >= floorH - 2,
        `min_inner_size(400×300) floor not enforced: outer ${after.width}×${after.height} physical ` +
          `< ${floorW}×${floorH} (scale ${scale}) — creation-time attributes lost to the ` +
          `stage-registration race (issue 7)`
      );
      // ③ no title bar (issue-7 regression guard: decorations(false) set at creation time is no longer lost) —
      //    a decorated window has inner = outer − title bar; borderless makes the two equal
      assert(
        Math.abs(after.width - inner.width) <= 2 && Math.abs(after.height - inner.height) <= 2,
        `decorations(false) not applied: outer ${after.width}×${after.height} vs inner ` +
          `${inner.width}×${inner.height} (title bar present — issue 7 race)`
      );
      console.log(
        '[issue7-diag]',
        `ohos_id=${result.ohos_window_id} scale=${scale} setSize(300×200 logical) → ` +
          `outer ${after.width}×${after.height} / inner ${inner.width}×${inner.height} ` +
          `(floor ${floorW}×${floorH} ENFORCED, borderless OK)`
      );
    },
  },
  // ─── Float window creation-time race (doc/OHOS窗口遗留问题.md issue-7 addendum) ───
  // create_os_window is fire-and-forget: the Rust side pre-allocates an id and returns, while the ArkTS
  // WindowManager.createSubWindow chain (createSubWindowWithOptions →
  // loadContentByName → FloatPage load) is still in progress. A set_size(260×180) issued immediately after build()
  // raced with the creation chain; pre-fix it arrived before the window was registered in WindowManager.windows
  // → requireWindow threw "Unknown OS sub-window" → the op was silently dropped
  // (the family behind the 22 warns per round). Fix criterion: PENDING_FLOAT_WINDOWS queues during the handshake,
  // and replays after notifyFloatWindowRegistered (at createSubWindow promise END).
  // setSize is issued immediately by a Rust-side command — the JS-side setSize races the tauri IPC
  // (window-not-found), not the ArkTS registration, so it cannot reproduce this race (issue-7 lesson).
  {
    name: 'window.createFloatWindowRacyAttrs (float creation race)',
    category: 'auto',
    async fn() {
      const label = 'test-float-racy-' + Date.now();
      const result = await invoke<{
        label: string;
        webview_acquired: boolean;
        ohos_window_id: number;
      }>('create_float_window_racy_attrs', { windowId: label });
      assert(
        result.webview_acquired === true,
        `webview not acquired: ${JSON.stringify(result)}`
      );
      // Wait 2s: notify is only sent at ArkTS createSubWindow promise END (including the FloatPage load),
      // and the queued set_size replay needs time.
      await delay(2000);
      const win = await Window.getByLabel(label);
      assert(win, `window not found by label after settle: ${label}`);
      const outer = await win.outerSize();
      const scale = await win.scaleFactor();
      const targetW = Math.round(260 * scale);
      const targetH = Math.round(180 * scale);
      const buildW = Math.round(500 * scale);
      const buildH = Math.round(400 * scale);
      // ① must leave the constructed size (guards against false green: if Float resize is entirely broken and the window stays at
      //    500×400, ② fails on the "close to target" criterion, but ① gives the more accurate
      //    failure semantics — resize never took effect, rather than a race loss)
      assert(
        Math.abs(outer.width - buildW) > 8 || Math.abs(outer.height - buildH) > 8,
        `window stuck at builder size: outer ${outer.width}×${outer.height} ≈ ` +
          `${buildW}×${buildH} physical — the racing setSize never took effect at all`
      );
      // ② the immediately-issued set_size (260×180 logical) is queued and replayed even when it arrives before registration
      //    (float race fix regression guard; a ±8 physical-pixel tolerance absorbs rounding differences)
      assert(
        Math.abs(outer.width - targetW) <= 8 && Math.abs(outer.height - targetH) <= 8,
        `immediate set_size(260×180 logical) lost to float creation race: outer ` +
          `${outer.width}×${outer.height} physical ≠ ${targetW}×${targetH} ` +
          `(scale ${scale}) — op dropped pre-registration (问题七附注)`
      );
      console.log(
        '[float-race-diag]',
        `ohos_id=${result.ohos_window_id} scale=${scale} outer ` +
          `${outer.width}×${outer.height} physical = 260×180 logical REPLAYED, ` +
          `builder 500×400 overridden`
      );
      // Cleanup: destroy goes through Window::drop → unregister_pending_float (a late notify is
      // made harmless), which also covers the V5 observation path
      await win.destroy();
      await delay(400);
    },
  },
  // ─── Real read-back verification (Float sub-window) ───
  {
    name: 'window.setInnerSize actually resizes (main window)',
    category: 'auto',
    async fn() {
      if (!(await mainWindowResizable())) return;
      const { PhysicalSize, LogicalSize } = await import('@tauri-apps/api/dpi');
      const win = getCurrentWindow();
      const orig = await win.innerSize();
      const sf = await win.scaleFactor();
      // The demo main window carries min_inner_size(600,400) under desktop cfg (src-tauri lib.rs);
      // tao converts it to physical pixels and issues setWindowLimits at window creation; if not cleared, small targets get
      // clamped (PC density 1.9 → a minimum of 1140×760). Restored after the test.
      await win.setMinSize(null);
      // set-limits is a fire-and-forget bridge call (the system call completing no earlier than the ack is guaranteed),
      // so wait 600ms for the removal to land before resizing — otherwise the small target may be clamped first by the old min
      // (the system gives no ordering guarantee between setWindowLimits completion and resize).
      await delay(600);
      try {
        // the target is half the original value; the floor uses issue#97's manual verification baseline of 1000×700
        const targetW = Math.max(1000, Math.floor(orig.width / 2));
        const targetH = Math.max(700, Math.floor(orig.height / 2));
        // issue#97 acceptance criterion: exact equality, zero tolerance. The read-back source is the system drawableRect
        // snapshot (inner_size → inner_rect_for), not a value tao computes itself.
        await win.setSize(new PhysicalSize(targetW, targetH));
        await readBackEquals(
          () => win.innerSize(),
          targetW,
          targetH,
          `setSize(${targetW}×${targetH}) 精确读回 (scaleFactor=${sf})`,
        );
        // issue#97 scenario "two consecutive sets": set a different value in between and confirm it lands; the final
        // read-back must be the second value (guards against consecutive sets being merged or dropped).
        const midW = targetW + 100;
        const midH = targetH + 80;
        await win.setSize(new PhysicalSize(midW, midH));
        await readBackEquals(() => win.innerSize(), midW, midH, `setSize(${midW}×${midH}) 精确读回`);
        await win.setSize(new PhysicalSize(targetW, targetH));
        await readBackEquals(
          () => win.innerSize(),
          targetW,
          targetH,
          `连续两次 setSize 后读回 (期望 ${targetW}×${targetH}, scaleFactor=${sf})`,
        );
      } finally {
        // Restore the size and the demo's minimum-size constraint (lib.rs: min_inner_size(600,400) in logical pixels;
        // restore the size first, then the constraint — orig already satisfies it, so no re-clamping is triggered)
        await win.setSize(new PhysicalSize(orig.width, orig.height));
        await delay(400);
        await win.setMinSize(new LogicalSize(600, 400));
      }
    },
  },
  {
    // issue#97 acceptance 3: save/restore zero drift (permanent regression protection for shrinking-main-window).
    // In-session proxy: read inner → write back the same value → read again; all 5 rounds must be exactly equal. The across-restart
    // window-state loop cannot restart the UIAbility from JS, so it stays manual per issue97-verify-plan.md §F;
    // this case protects the same drift mechanism (read side drawableRect ↔ write side resize-inner).
    name: 'window.setInnerSize save/restore zero drift (5 rounds)',
    category: 'auto',
    async fn() {
      if (!(await mainWindowResizable())) return;
      const { PhysicalSize, LogicalSize } = await import('@tauri-apps/api/dpi');
      const win = getCurrentWindow();
      const orig = await win.innerSize();
      // Same as case one: clear the 600×400 logical minimum constraint, otherwise 1000×700 gets clamped
      await win.setMinSize(null);
      await delay(600); // same as case one: wait for the fire-and-forget removal to land first
      try {
        const targetW = 1000, targetH = 700; // issue#97 manual verification baseline
        await win.setSize(new PhysicalSize(targetW, targetH));
        await readBackEquals(
          () => win.innerSize(),
          targetW,
          targetH,
          `setSize(${targetW}×${targetH}) 精确读回 (scaleFactor=${await win.scaleFactor()})`,
        );
        for (let i = 1; i <= 5; i++) {
          const cur = await win.innerSize(); // save
          await win.setSize(new PhysicalSize(cur.width, cur.height)); // restore
          await readBackEquals(
            () => win.innerSize(),
            targetW,
            targetH,
            `第 ${i} 轮 save/restore 漂移: ${cur.width}×${cur.height} 写回后期望恒为 ${targetW}×${targetH}`,
          );
        }
      } finally {
        // Restore (not restoring would poison later rounds via the window-state plugin: the next round's orig becomes 1000×700,
        // and case one's half-of-original target would fall below the minimum constraint)
        await win.setSize(new PhysicalSize(orig.width, orig.height));
        await delay(400);
        await win.setMinSize(new LogicalSize(600, 400));
      }
    },
  },
  {
    // issue#97 scenario 2: exact read-back on a Float sub-window (decor=0, constructively zero chrome).
    // Follows core.ts's float-window convention: do not destroy it here; leave cleanup to the manual Close All;
    // the label uses the test- prefix (cmd.rs convention: a non-test- prefix gets STATUS_SCRIPT polling injected).
    name: 'float window setInnerSize exact readback (decor=0)',
    category: 'auto',
    async fn() {
      const { PhysicalSize } = await import('@tauri-apps/api/dpi');
      const w = await createFloatWindow('test-size-' + Date.now());
      await w.setSize(new PhysicalSize(760, 1100));
      await readBackEquals(
        () => w.innerSize(),
        760,
        1100,
        `float setSize(760×1100) 精确读回 (scaleFactor=${await w.scaleFactor()})`,
      );
    },
  },
  {
    // On OHOS, setOuterPosition's "actual move" effect **cannot be reliably verified from JS read-back**:
    // outerPosition() reads from window_rect, which is filled by the ArkTS window_rect_change callback
    // (lifecycle.rs:175-179). resize fires the size callback → #142's setInnerSize read-back is reliable;
    // but a pure moveWindowTo only changes position and does not fire the rect callback we listen to, so read-back stays at the old value
    // (measured: a Float sub-window stayed orig(515,343)→after(515,343), completely unchanged). On the main window the system's
    // free-window WM relocates non-deterministically (e.g. (699,651)), so read-back passes and fails sporadically. Neither window type
    // can satisfy the "after is closer to target than orig" assertion. On-device hilog shows moveWindowTo resolves successfully with
    // no 1300002 reject (ArkTS only warns in .catch; zero failure logs throughout) — the call itself does not throw.
    // So this is downgraded to smoke: just verify setPosition does not throw; the move effect is verified via manual buttons.
    // (same policy as main-window capabilities that cannot be verified: #137 fullscreen / #138 minimize / #139 alwaysOnTop, etc.)
    name: 'window.setOuterPosition smoke (move unverifiable from JS)',
    category: 'auto',
    async fn() {
      const { PhysicalPosition } = await import('@tauri-apps/api/dpi');
      const win = getCurrentWindow();
      const orig = await win.outerPosition();
      const targetX = orig.x < 200 ? 400 : 100;
      const targetY = orig.y < 200 ? 400 : 100;
      await smoke(() => win.setPosition(new PhysicalPosition(targetX, targetY)), 'setPosition(target)');
      await delay(400);
      // Restore (attempt the reset even if read-back does not reflect it)
      await smoke(() => win.setPosition(new PhysicalPosition(orig.x, orig.y)), 'setPosition(orig)');
      await delay(200);
    },
  },
  {
    name: 'window.maximize fills monitor',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      const mon = await currentMonitor();
      const before = await win.innerSize();
      await win.maximize();
      await delay(600);
      const after = await win.innerSize();
      const afterOuter = await win.outerSize();
      await win.unmaximize();
      await delay(400);
      if (!mon) {
        // no monitor info: only verify maximize does not throw
        return;
      }
      // After maximize, innerSize should approach the display size (if it was not already fullscreen).
      // If it was already fullscreen (before ≈ monitor), maximize is a no-op and the strict check is skipped.
      const alreadyMax = before.width >= mon.size.width * 0.95 && before.height >= mon.size.height * 0.95;
      if (alreadyMax) return;
      // D2 semantics (OHOS): innerSize = outer − decorations (title bar). "Fills the display" is asserted via outerSize;
      // innerSize checks the content width is full and the height still dominates after subtracting decorations (>= 80%).
      assert(
        afterOuter.width >= mon.size.width * 0.9 && afterOuter.height >= mon.size.height * 0.9,
        `maximize 后 outerSize ${afterOuter.width}×${afterOuter.height} 未接近显示器 ${mon.size.width}×${mon.size.height}`
      );
      assert(
        after.width >= mon.size.width * 0.9 && after.height >= mon.size.height * 0.8,
        `maximize 后 innerSize ${after.width}×${after.height} 未接近显示器 ${mon.size.width}×${mon.size.height}`
      );
    },
  },

  // ─── smoke: no getters; only verify no throw. Effects are verified via manual buttons. ───
  {
    name: 'window.setFullscreen smoke (effect unverifiable from JS)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      await smoke(() => win.setFullscreen(true), 'setFullscreen(true)');
      await delay(400);
      await smoke(() => win.setFullscreen(false), 'setFullscreen(false)');
      await delay(400);
    },
  },
  {
    name: 'window.minimize smoke (effect unverifiable from JS)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      await smoke(() => win.minimize(), 'minimize');
      await delay(400);
      await smoke(() => win.unminimize(), 'unminimize');
      await delay(400);
    },
  },
  {
    name: 'window.setAlwaysOnTop smoke (OHOS partial: flag only, no z-order API)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      // isAlwaysOnTop only reads tao's AtomicBool, so the round-trip is self-proving and not asserted.
      await smoke(() => win.setAlwaysOnTop(true), 'setAlwaysOnTop(true)');
      await smoke(() => win.setAlwaysOnTop(false), 'setAlwaysOnTop(false)');
    },
  },
  {
    name: 'window.setIgnoreCursorEvents smoke',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      await smoke(() => win.setIgnoreCursorEvents(true), 'setIgnoreCursorEvents(true)');
      await smoke(() => win.setIgnoreCursorEvents(false), 'setIgnoreCursorEvents(false)');
    },
  },
  {
    name: 'window decoration flags smoke (D group, main window no-op)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      // setDecorationFlags is a no-op on the main window; is*() only reads tao's bitfield, so the round-trip is self-proving.
      // Only verify the call does not throw. Effects are verified manually on a Float sub-window.
      await smoke(() => win.setClosable(false), 'setClosable(false)');
      await smoke(() => win.setClosable(true), 'setClosable(true)');
      await smoke(() => win.setMaximizable(false), 'setMaximizable(false)');
      await smoke(() => win.setMaximizable(true), 'setMaximizable(true)');
      await smoke(() => win.setMinimizable(false), 'setMinimizable(false)');
      await smoke(() => win.setMinimizable(true), 'setMinimizable(true)');
      await smoke(() => win.setResizable(false), 'setResizable(false)');
      await smoke(() => win.setResizable(true), 'setResizable(true)');
      await smoke(() => win.setFocusable(false), 'setFocusable(false)');
      await smoke(() => win.setFocusable(true), 'setFocusable(true)');
    },
  },
  // ─── 6.3 Float-specific: behavior of D11's windowKinds-branched methods on Float sub-windows ───
  // Production entry audit (2026-09-16): show→showWindowMethod (Float branch win.showWindow);
  // set-decoration-flags→setDecorationFlags (the Float branch writes 4 LocalStorage keys that drive
  // FloatPage button visibility); set-decorations→setDecorations (the Float branch writes LocalStorage
  // 'decorations' to drive the custom-drawn title bar visibility — during the pluginize migration it briefly bypassed this and called setWindowDecorVisible directly,
  // making Float a no-op; fixed on 2026-09-16 to delegate to WindowManager); set-background-color→calls the sub-window
  // handle directly (same API for both kinds, no branch semantics); closeWindow→reachable only via the menu path (Float has no menu;
  // the branch is defensive code; code-audit verdict: not automated).
  {
    name: 'window Float kind-branch ops (D11: decorations/flags/minimize/show)',
    category: 'auto',
    async fn() {
      const label = 'test-float-' + Date.now();
      await invoke('create_decorated_window', { windowId: label });
      await delay(600);
      const w = await Window.getByLabel(label);
      assert(w, `Float window "${label}" not found after create`);

      // ① setDecorations (starting point: a decorated Float with decorations=true).
      //    isDecorated only reads tao's mirror (round-trip self-proving); Float's real semantics =
      //    FloatPage's custom-drawn title bar visibility (LocalStorage 'decorations'); visual/hilog evidence belongs to the manual chapter.
      assert((await w.isDecorated()) === true, 'decorated Float should start decorated');
      await w.setDecorations(false);
      assert((await w.isDecorated()) === false, 'setDecorations(false) mirror readback');
      await w.setDecorations(true);
      assert((await w.isDecorated()) === true, 'setDecorations(true) mirror readback');

      // ② decoration flags: the Float branch writes 4 LocalStorage keys. is*() reads tao's bitfield (self-proving);
      //    the real effect = FloatPage button visibility, covered by hilog/the manual chapter; for the main-window no-op contrast see the case above.
      await w.setClosable(false);
      assert((await w.isClosable()) === false, 'setClosable(false) readback');
      await w.setMaximizable(false);
      assert((await w.isMaximizable()) === false, 'setMaximizable(false) readback');
      await w.setMinimizable(false);
      assert((await w.isMinimizable()) === false, 'setMinimizable(false) readback');
      await w.setResizable(false);
      assert((await w.isResizable()) === false, 'setResizable(false) readback');
      await w.setClosable(true);
      assert((await w.isClosable()) === true, 'setClosable(true) readback');
      await w.setMaximizable(true);
      assert((await w.isMaximizable()) === true, 'setMaximizable(true) readback');
      await w.setMinimizable(true);
      assert((await w.isMinimizable()) === true, 'setMinimizable(true) readback');
      await w.setResizable(true);
      assert((await w.isResizable()) === true, 'setResizable(true) readback');

      // ③ minimize → show: isMinimized reads ArkTS getWindowStatus() live state (not tao's mirror),
      //    a real assertion. show goes through showWindowMethod's Float branch (win.showWindow()).
      await w.minimize();
      await delay(500);
      assert((await w.isMinimized()) === true, 'Float minimize should reflect in live window status');
      await w.show();
      await delay(500);
      assert((await w.isMinimized()) === false, 'Float show (showWindowMethod Float branch) should restore from minimized');

      // ④ setBackgroundColor: Float = direct call on the sub-window handle (same API as the UIAbility branch); smoke only.
      await smoke(() => w.setBackgroundColor([255, 0, 0, 255]), 'Float setBackgroundColor');

      // Wrap-up: flags are restored to true; close goes through the destroy-window idempotent path (best-effort;
      // leaving a leftover window matches the suite's existing behavior — core.ts's timestamped label likewise guards against rerun collisions).
      await w.close().catch(() => {});
    },
  },
  {
    name: 'window cursor smoke (E group, no getter)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      await smoke(() => win.setCursorVisible(false), 'setCursorVisible(false)');
      await smoke(() => win.setCursorVisible(true), 'setCursorVisible(true)');
      for (const icon of ['hand', 'crosshair', 'text', 'wait', 'copy', 'not-allowed', 'grab', 'zoom-in', 'default']) {
        await smoke(() => win.setCursorIcon(icon), `setCursorIcon(${icon})`);
      }
      await smoke(() => win.setFocus(), 'setFocus');
    },
  },
  // Content protection (issue Eulogizethesun/tauri#115): on OHOS this reaches
  // OH_WindowManager_SetWindowPrivacyMode — the window is excluded from
  // screenshot/recording/casting. Invoked via a demo command because
  // @tauri-apps/api/window has no setContentProtection. The visual effect
  // (screenshot of the window turns black) is verified manually.
  {
    name: 'window.setContentProtection (demo cmd)',
    category: 'auto',
    async fn() {
      await invoke('set_content_protection', { enabled: true });
      await new Promise((r) => setTimeout(r, 300));
      await invoke('set_content_protection', { enabled: false });
    },
  },
];
