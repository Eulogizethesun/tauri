import type { TestCase } from '../test-runner';
import { skipOnMobile } from '../test-runner';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { platform } from '@tauri-apps/plugin-os';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// ─── OHOS close/destroy confirmation contract (openspec ohos-main-window-close-zombie) ───
//
// The reported bug: a single-main-window app closes via JS getCurrent().close() —
// the old runtime removed the store entry BEFORE the fire-and-forget bridge
// destroy_window(0), ArkTS rejected id 0 (by design), and the app was left in a
// zombie state: window alive, accounting gone, every window command silently
// dead, ~4/s persist-error loop. The fix (design D1/D2) splits the two arms:
//   main window (UIAbility root, OS id 0) → ExitRequested veto gate + #100
//     terminate chain; the bridge destroy-window is NEVER called for the root.
//   sub-window → confirmation-driven accounting: the initiator only dispatches
//     inner.close() and registers an in-flight guard; the store/registry removal
//     and the Destroyed event move to the confirmation executor, fed by (b) the
//     ArkTS destruction loopback arriving as an in-flight CloseRequested and
//     (a) tao's Ok-resolve Destroyed re-emission.
// These cases pin that contract on the device. Naming follows the openspec task
// list (ut_* names are referenced from tasks.md / the bug report §3).
//
// Runs on OHOS only (skipped elsewhere — the veto/termination contract and
// create_borderless_window are OHOS/desktop-form specific). The failure-injection
// case additionally requires the fault-injection feature (cov builds); on plain
// autotest builds it skips via the withFault NOT_IMPLEMENTED convention.

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function requireOhos() {
  const p = await platform();
  if (p !== 'ohos') throw new Error(`skip: OHOS 关窗确认契约用例（当前平台 ${p}）`);
}

/** Occurrences of a tracked RunEvent name since process start. */
async function countName(name: string): Promise<number> {
  const events = (await invoke('get_tracked_run_events')) as string[];
  return events.filter((e) => e === name).length;
}

/** Poll until the tracked count of `name` reaches `minCount`; returns the final count. */
async function waitForCount(name: string, minCount: number, ms: number): Promise<number> {
  const deadline = Date.now() + ms;
  let n = await countName(name);
  while (n < minCount && Date.now() < deadline) {
    await delay(150);
    n = await countName(name);
  }
  return n;
}

/**
 * Creates a SubWindow-kind test window (create_borderless_window keeps the
 * label verbatim) and resolves its handle. Unique label per call so repeated
 * suite runs never collide with leftovers.
 */
async function createSubWindow(label: string): Promise<WebviewWindow> {
  await invoke('create_borderless_window', { windowId: label });
  // the OS sub-window registration is async (bridge create-os-window roundtrip)
  const deadline = Date.now() + 8000;
  let win: WebviewWindow | null = null;
  while (!win && Date.now() < deadline) {
    await delay(200);
    win = await WebviewWindow.getByLabel(label);
  }
  assert(win, `sub-window "${label}" not found after create_borderless_window`);
  return win;
}

/** Creates a SubWindow with the special lib.rs veto label (api.prevent_close arm). */
async function createVetoedSubWindow(label: string): Promise<WebviewWindow> {
  return createSubWindow(label);
}

export const zombieCloseTests: TestCase[] = [
  {
    // 3.1 arm B — main-window close VETOED keeps accounting (design D1 Cancel arm).
    // set_exit_confirmation(true) arms the app-level confirm mode: the gate's
    // RunEvent::ExitRequested gets prevented by lib.rs (prevent_exit +
    // 'confirm-exit-requested' emit), so the close must end in the Cancel arm:
    // store/registry untouched, window commands keep working, no Destroyed.
    // This is the exact state the bug report turned into a zombie — here the
    // accounting must survive the vetoed close.
    name: 'ut_main_window_close_prevented_keeps_accounting',
    category: 'auto',
    timeout: 20000,
    fn: async () => {
      await requireOhos();
      await invoke('set_exit_confirmation', { enabled: true });
      let confirmEvents = 0;
      const unlisten = await listen('confirm-exit-requested', () => {
        confirmEvents++;
      });
      try {
        const beforeD = await countName('WindowEvent::Destroyed');
        await getCurrentWindow().close();
        // the veto round-trip (close → ExitRequested → prevent_exit → emit) is
        // fast, but give it a real window before declaring the event missing
        const gotEvent = await (async () => {
          const deadline = Date.now() + 5000;
          while (confirmEvents === 0 && Date.now() < deadline) {
            await delay(150);
          }
          return confirmEvents > 0;
        })();
        assert(
          gotEvent,
          'confirm-exit-requested not received after main-window close in confirm mode — ' +
            'the main-window arm did not route through the ExitRequested gate (bug-report routing regressed)',
        );
        await delay(800); // settle: a wrongly torn-down window would show by now
        const afterD = await countName('WindowEvent::Destroyed');
        assert(
          afterD === beforeD,
          `main window was torn down despite prevention (Destroyed delta ${afterD - beforeD})`,
        );
        const main = await WebviewWindow.getByLabel('main');
        assert(main, 'main window vanished from accounting after a PREVENTED close (zombie state)');
        const visible = await getCurrentWindow().isVisible();
        assert(visible, `main window isVisible=${visible} after prevented close`);
      } finally {
        // never leak confirm mode into the rest of the suite (it would block
        // every later implicit close behind a dialog)
        try {
          unlisten?.();
        } catch {
          /* already gone */
        }
        await invoke('set_exit_confirmation', { enabled: false });
      }
    },
  },
  {
    // 4.1 — close() roundtrip dispatches CloseRequested EXACTLY once. The
    // ArkTS destruction loopback (aboutToDisappear → notifyWindowClose) arrives
    // as an in-flight CloseRequested and must be consumed by the confirmation
    // executor, not re-dispatched to the app.
    name: 'ut_subwindow_close_roundtrip_single_closerequested',
    category: 'auto',
    timeout: 20000,
    fn: async () => {
      await requireOhos();
      await skipOnMobile('create_borderless_window is a desktop-form command');
      const label = `test-zombie-roundtrip-${Date.now().toString(36)}`;
      const win = await createSubWindow(label);
      const beforeCR = await countName('WindowEvent::CloseRequested');
      const beforeD = await countName('WindowEvent::Destroyed');
      await win.close();
      const destroyed = await waitForCount('WindowEvent::Destroyed', beforeD + 1, 10000);
      assert(
        destroyed === beforeD + 1,
        `sub-window close did not confirm destruction (Destroyed delta ${destroyed - beforeD})`,
      );
      const afterCR = await countName('WindowEvent::CloseRequested');
      assert(
        afterCR === beforeCR + 1,
        `CloseRequested delta expected 1, got ${afterCR - beforeCR} — the destruction loopback re-dispatched to the app (in-flight guard regressed)`,
      );
      const gone = await WebviewWindow.getByLabel(label);
      assert(!gone, 'sub-window still in accounting after confirmed destroy (zombie)');
    },
  },
  {
    // 4.1 — success path: the confirmation (b) loopback or (a) tao Ok-resolve
    // removes the accounting and fires Destroyed exactly once; duplicates
    // (second channel + repeated loopback) early-exit on the removed entry.
    name: 'ut_subwindow_destroy_success_confirmed_removal',
    category: 'auto',
    timeout: 20000,
    fn: async () => {
      await requireOhos();
      await skipOnMobile('create_borderless_window is a desktop-form command');
      const label = `test-zombie-success-${Date.now().toString(36)}`;
      const win = await createSubWindow(label);
      const beforeD = await countName('WindowEvent::Destroyed');
      await win.close();
      const destroyed = await waitForCount('WindowEvent::Destroyed', beforeD + 1, 10000);
      assert(
        destroyed === beforeD + 1,
        `confirmed destroy did not fire Destroyed (delta ${destroyed - beforeD})`,
      );
      const gone = await WebviewWindow.getByLabel(label);
      assert(!gone, 'sub-window still in accounting after confirmed destroy (zombie)');
      await delay(1200); // settle: a duplicate confirmation would land by now
      const afterD = await countName('WindowEvent::Destroyed');
      assert(
        afterD === beforeD + 1,
        `duplicate Destroyed after double-channel confirmation (delta ${afterD - beforeD})`,
      );
    },
  },
  {
    // 4.1 — destroy() (Message::Destroy) skips the veto event entirely but still
    // routes through the confirmation executor (design D4 divergence from
    // upstream's unconditional removal): Destroyed yes, CloseRequested never.
    name: 'ut_window_destroy_message_confirmed_removal',
    category: 'auto',
    timeout: 20000,
    fn: async () => {
      await requireOhos();
      await skipOnMobile('create_borderless_window is a desktop-form command');
      const label = `test-zombie-destroy-${Date.now().toString(36)}`;
      const win = await createSubWindow(label);
      const beforeCR = await countName('WindowEvent::CloseRequested');
      const beforeD = await countName('WindowEvent::Destroyed');
      await win.destroy();
      const destroyed = await waitForCount('WindowEvent::Destroyed', beforeD + 1, 10000);
      assert(
        destroyed === beforeD + 1,
        `destroy() did not confirm destruction (Destroyed delta ${destroyed - beforeD})`,
      );
      const afterCR = await countName('WindowEvent::CloseRequested');
      assert(
        afterCR === beforeCR,
        `destroy() must not dispatch CloseRequested (delta ${afterCR - beforeCR})`,
      );
      const gone = await WebviewWindow.getByLabel(label);
      assert(!gone, 'sub-window still in accounting after destroy() (zombie)');
    },
  },
  {
    // 4.1 — double destroy: the second request lands while the first is still
    // in flight (store not yet confirmed) → a second bridge destroy_window on
    // the already-destroying window resolves as the ArkTS idempotent ack; both
    // confirmations hit the executor but only the first removal dispatches.
    name: 'ut_already_destroyed_idempotent_ack',
    category: 'auto',
    timeout: 20000,
    fn: async () => {
      await requireOhos();
      await skipOnMobile('create_borderless_window is a desktop-form command');
      const label = `test-zombie-idem-${Date.now().toString(36)}`;
      const win = await createSubWindow(label);
      const beforeD = await countName('WindowEvent::Destroyed');
      // dispatch both without awaiting in between so the second Message::Destroy
      // is processed while the first destroy is still unconfirmed
      const p1 = win.destroy().catch(() => undefined);
      const p2 = win.destroy().catch(() => undefined);
      await Promise.all([p1, p2]);
      const destroyed = await waitForCount('WindowEvent::Destroyed', beforeD + 1, 10000);
      assert(
        destroyed === beforeD + 1,
        `double destroy did not produce exactly one Destroyed (delta ${destroyed - beforeD})`,
      );
      await delay(1200); // settle: a duplicate confirmation would land by now
      const afterD = await countName('WindowEvent::Destroyed');
      assert(
        afterD === beforeD + 1,
        `duplicate Destroyed after idempotent ack (delta ${afterD - beforeD})`,
      );
      const gone = await WebviewWindow.getByLabel(label);
      assert(!gone, 'sub-window still in accounting after double destroy (zombie)');
    },
  },
  {
    // 4.1 — vetoed close: lib.rs prevent_close() on the special label vetoes at
    // the first level → no destroy request, no accounting change, window alive.
    name: 'ut_subwindow_prevent_close_no_dispatch',
    category: 'auto',
    timeout: 20000,
    fn: async () => {
      await requireOhos();
      await skipOnMobile('create_borderless_window is a desktop-form command');
      // the "test-prevent-close" prefix arms the OHOS prevent_close() arm in
      // examples/api lib.rs (first veto level)
      const label = `test-prevent-close-zombie-${Date.now().toString(36)}`;
      const win = await createVetoedSubWindow(label);
      const beforeCR = await countName('WindowEvent::CloseRequested');
      const beforeD = await countName('WindowEvent::Destroyed');
      await win.close();
      await delay(2500); // no positive event to await — settle window for the negative asserts
      const afterD = await countName('WindowEvent::Destroyed');
      assert(
        afterD === beforeD,
        `vetoed close still destroyed the window (Destroyed delta ${afterD - beforeD})`,
      );
      const afterCR = await countName('WindowEvent::CloseRequested');
      assert(
        afterCR === beforeCR + 1,
        `CloseRequested must fire once even when vetoed (delta ${afterCR - beforeCR})`,
      );
      const still = await WebviewWindow.getByLabel(label);
      assert(still, 'vetoed window vanished from accounting (accounting must stay intact)');
      const visible = await still.isVisible();
      assert(visible, `vetoed window isVisible=${visible} — window must stay alive`);
      // cleanup: destroy() bypasses the CloseRequested veto entirely
      await still.destroy();
      const cleaned = await waitForCount('WindowEvent::Destroyed', beforeD + 1, 10000);
      assert(
        cleaned === beforeD + 1,
        `cleanup destroy() did not confirm (Destroyed delta ${cleaned - beforeD})`,
      );
    },
  },
  {
    // 4.1 — FAILURE path (design D3): the bridge destroy_window is injected to
    // fail → nothing confirms → the executor never runs → Destroyed must NOT
    // fire and the accounting must stay (window alive ↔ accounting present).
    // This is the anti-zombie invariant the old code violated for the main
    // window; here pinned for the sub-window arm via fault injection.
    // Requires the fault-injection feature (cov builds); skips elsewhere via
    // the shared withFault NOT_IMPLEMENTED convention.
    name: 'ut_subwindow_destroy_failure_keeps_accounting',
    category: 'auto',
    timeout: 20000,
    fn: async () => {
      await requireOhos();
      await skipOnMobile('create_borderless_window is a desktop-form command');
      const label = `test-zombie-fail-${Date.now().toString(36)}`;
      const win = await createSubWindow(label);
      const beforeD = await countName('WindowEvent::Destroyed');
      try {
        await invoke('fault_injection_set_rule', {
          rule: {
            pluginId: 'ohos.window',
            action: 'destroy-window',
            outcome: { kind: 'error', code: 1300004, message: 'injected' },
            hits: 1,
          },
        });
      } catch (e) {
        const m = String((e as Error)?.message ?? e);
        if (/not (registered|found|implemented|supported|installed|allowed by acl)|command not found|no such|unknown command|unavailable|plugin .*not/i.test(m)) {
          throw new Error('skip: fault-injection feature not enabled in this build — ' + m);
        }
        throw e;
      }
      try {
        await win.close();
      } catch {
        // the close dispatch itself still resolves (fire-and-forget initiator)
      } finally {
        try {
          await invoke('fault_injection_clear');
        } catch {
          /* cleanup failure is non-fatal */
        }
      }
      await delay(3000); // failure is silent by design (no timeout/polling) — settle window
      const afterD = await countName('WindowEvent::Destroyed');
      assert(
        afterD === beforeD,
        `destroy FAILED but accounting was torn down (Destroyed delta ${afterD - beforeD}) — confirmation-driven accounting regressed`,
      );
      const still = await WebviewWindow.getByLabel(label);
      assert(still, 'destroy failed but the window vanished from accounting (zombie state)');
      const visible = await still.isVisible();
      assert(visible, `window isVisible=${visible} after failed destroy — window must stay alive`);
      // cleanup: rules cleared above; a real destroy must now confirm
      await still.destroy();
      const cleaned = await waitForCount('WindowEvent::Destroyed', beforeD + 1, 10000);
      assert(
        cleaned === beforeD + 1,
        `cleanup destroy() did not confirm after fault cleared (Destroyed delta ${cleaned - beforeD})`,
      );
    },
  },
  {
    // 4.1 — ArkTS-initiated close (SubWindowPage ✕): the drain path's entry
    // point is a UI interaction on the sub-window's own title bar, which the
    // JS suite cannot drive; kept manual (the runner reports it as a skip) and
    // verified on-device with uinput during the change verification. The
    // in-suite loopback case above covers the drain path's EXECUTOR side: the
    // (b) loopback CloseRequested arrives through the very same
    // drain_pending_window_closes pump.
    //
    // Steps (2in1 desktop form, device 3QC0124C11000038):
    //   1. Window page → "Create Decorated Window" (decorations=true →
    //      SubWindowPage title bar with ✕).
    //   2. Tap the sub-window's ✕.
    //   3. hilog (grep "[wry] CloseRequested for in-flight\|dispatching destroy_window\|ExitRequested") :
    //      - exactly one app-facing CloseRequested for that label (veto chance),
    //      - one "dispatching destroy_window ohos_id=<n>",
    //      - Destroyed fires once, accounting removed (window page list drops it),
    //      - a second tap on the same ✕ (or a double-fire aboutToDisappear)
    //        produces NO second CloseRequested/Destroyed (in-flight take).
    name: 'ut_pending_close_drain_confirms_removal',
    category: 'manual',
    fn: async () => {
      // manual — driven on-device with uinput (see steps above)
    },
  },
];
