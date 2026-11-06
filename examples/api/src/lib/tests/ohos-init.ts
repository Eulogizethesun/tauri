import type { TestCase } from '../test-runner';
import { getCurrentWindow } from '@tauri-apps/api/window';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// 1x1 transparent PNG (same fixture used by tray.ts / menu.ts).
const TEST_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Error fragments that signal a broken OHOS init chain — i.e. one of the
 * `Builder::build` init steps was dropped (crates/tauri/src/app.rs):
 *   1. `ohos::BASE_PATH.set` / `MODULE_NAME.set`
 *   2. `tray_icon::set_ohos_app`  (transitively calls `muda::set_menu_client`)
 *   3. `window_vibrancy::set_ohos_app`
 *   4. `tauri_runtime_wry::set_ohos_app` (registers WebviewBridgePlugin
 *      + WindowBridgePlugin)
 *   5. `with_openharmony_app`
 *
 * Seeing any of these in a window / menu / tray operation is a regression of the
 * bridge-refactor missing-injection-point class of bugs (see memory
 * ohos-bridge-refactor-missing-injection-points).
 */
const INIT_BREAK_PATTERNS = [
  'not initialized',
  'not installed',
  'client not initialized',
];

function isInitChainBreak(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e).toLowerCase();
  return INIT_BREAK_PATTERNS.some((p) => msg.includes(p));
}

/** True when running on OHOS (any device form). */
async function isOhos(): Promise<boolean> {
  try {
    const { platform } = await import('@tauri-apps/plugin-os');
    return platform() === 'ohos';
  } catch {
    return false;
  }
}

export const ohosInitTests: TestCase[] = [
  {
    name: 'ohos-init.chain.window-menu-tray',
    category: 'side-effect',
    timeout: 10000,
    async fn() {
      const ohos = await isOhos();
      const failures: string[] = [];

      // ── Leg 1: window client ──
      // Exercises tauri_runtime_wry::set_ohos_app → registered
      // WebviewBridgePlugin + WindowBridgePlugin. If dropped, scaleFactor /
      // innerPosition reject with "not initialized" / "Unknown OS sub-window".
      try {
        const win = getCurrentWindow();
        const factor = await win.scaleFactor();
        assert(typeof factor === 'number' && factor > 0, `scaleFactor invalid: ${factor}`);
        const pos = await win.innerPosition();
        assert(
          typeof pos.x === 'number' && typeof pos.y === 'number',
          `innerPosition invalid: ${JSON.stringify(pos)}`
        );
        console.log(`[init-chain] window OK: scaleFactor=${factor}, innerPosition=(${pos.x},${pos.y})`);
      } catch (e) {
        if (isInitChainBreak(e)) {
          failures.push(`window: ${String((e as Error)?.message ?? e)}`);
        } else {
          throw e; // unexpected error — fail loudly, not a silent skip
        }
      }

      // ── Leg 2: menu client ──
      // Menu.new() exercises muda's menu client, which is wired by
      // tray_icon::set_ohos_app → muda::set_menu_client. If set_menu_client was
      // dropped, Menu.new rejects with "client not initialized". Menu.new only
      // builds an in-memory menu object (no setAsWindowMenu), so it is idempotent
      // and does not disturb the live menubar on any platform.
      try {
        const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
        const item = await MenuItem.new({ text: 'init-chain-probe' });
        const menu = await Menu.new({ items: [item] });
        const items = await menu.items();
        assert(items.length === 1, `menu.items length should be 1, got ${items.length}`);
        console.log(`[init-chain] menu OK: menu.id=${menu.id}, items=${items.length}`);
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        if (isInitChainBreak(e)) {
          failures.push(`menu: ${msg}`);
        } else if (ohos) {
          // OHOS mobile may lack a menubar surface — skip the leg, it is not an
          // init-chain break (the client is still initialized).
          console.log(`[init-chain] menu leg skipped (platform limitation): ${msg}`);
        } else {
          throw e;
        }
      }

      // ── Leg 3: tray client ──
      // TrayIcon.new exercises tray_icon::set_ohos_app. Creates + immediately
      // removes a unique tray so the test is idempotent / repeatable. On OHOS
      // mobile there is no status-bar tray surface; a non-init error there is
      // treated as a platform limitation (skip), not a regression.
      try {
        const { TrayIcon } = await import('@tauri-apps/api/tray');
        const id = `init-chain-${Date.now()}`;
        const tray = await TrayIcon.new({ id, icon: TEST_ICON });
        assert(tray.id === id, `tray.id mismatch: "${tray.id}" vs "${id}"`);
        try {
          await TrayIcon.removeById(id);
        } catch (cleanupErr) {
          console.log(`[init-chain] tray removeById failed (non-fatal): ${String((cleanupErr as Error)?.message ?? cleanupErr)}`);
        }
        console.log(`[init-chain] tray OK: created+removed id=${id}`);
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        if (isInitChainBreak(e)) {
          failures.push(`tray: ${msg}`);
        } else if (ohos) {
          console.log(`[init-chain] tray leg skipped (platform limitation): ${msg}`);
        } else {
          throw e;
        }
      }

      if (failures.length > 0) {
        throw new Error(`OHOS init chain broken: ${failures.join('; ')}`);
      }
    },
  },
];
