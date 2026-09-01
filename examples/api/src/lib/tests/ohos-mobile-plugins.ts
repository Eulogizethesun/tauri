import { skip, type TestCase } from '../test-runner';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

/** Plugin/command not available on this platform/build — skip, never pass. */
function isMissing(e: unknown): boolean {
  const m = String((e as Error)?.message ?? e);
  return (
    m.includes('not found') ||
    m.includes('not implemented') ||
    m.includes('command not found') ||
    m.includes('not allowed by ACL') ||
    m.includes('not supported')
  );
}

/**
 * Autotests for the 5 mobile-native plugins adapted to OHOS
 * (barcode-scanner / biometric / geolocation / haptics / nfc).
 *
 * Only the non-UI safe subset is automated:
 *   - biometric `status` (availability query, no dialog)
 *   - nfc `is_available` (controller state query)
 *   - barcode-scanner `check_permissions` (permission state query)
 *   - geolocation `check_permissions` (permission state query)
 *   - haptics `selection_feedback` (PC may lack a vibrator → tolerant)
 *
 * UI-bound flows are manual tests (doc/manual_tests.md §三十一):
 *   barcode scan (camera), biometric authenticate (system dialog),
 *   geolocation get_current_position / request_permissions (permission
 *   dialog), nfc scan/write (needs an NFC tag), haptics on devices
 *   with a real vibrator.
 *
 * Routing note: biometric/nfc/barcode-scanner have no Rust
 * invoke_handler — their `plugin:NAME|command` calls take the
 * mobile-plugin fallback path (webview/mod.rs), which heck-converts
 * the command to lowerCamelCase for the ArkTS handler. haptics and
 * geolocation register native Rust commands (snake_case as sent).
 */
export const ohosMobilePluginTests: TestCase[] = [
  {
    name: 'plugin-biometric.status',
    category: 'auto',
    async fn() {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const r = await invoke<{ isAvailable: boolean; biometryType: number }>('plugin:biometric|status');
        assert(typeof r?.isAvailable === 'boolean', `status should return { isAvailable: boolean }, got ${JSON.stringify(r)}`);
      } catch (e) {
        if (isMissing(e)) skip(`biometric.status not available: ${String((e as Error).message)}`);
        throw e;
      }
    },
  },
  {
    name: 'plugin-nfc.is_available',
    category: 'auto',
    async fn() {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const r = await invoke<{ available: boolean }>('plugin:nfc|is_available');
        assert(typeof r?.available === 'boolean', `is_available should return { available: boolean }, got ${JSON.stringify(r)}`);
      } catch (e) {
        if (isMissing(e)) skip(`nfc.is_available not available: ${String((e as Error).message)}`);
        throw e;
      }
    },
  },
  {
    name: 'plugin-barcode-scanner.check_permissions',
    category: 'auto',
    async fn() {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const r = await invoke<{ camera: string }>('plugin:barcode-scanner|check_permissions');
        assert(typeof r?.camera === 'string', `check_permissions should return { camera: string }, got ${JSON.stringify(r)}`);
        assert(['granted', 'denied', 'prompt', 'unknown'].includes(r.camera), `camera state unexpected: "${r.camera}"`);
      } catch (e) {
        if (isMissing(e)) skip(`barcode-scanner.check_permissions not available: ${String((e as Error).message)}`);
        throw e;
      }
    },
  },
  {
    name: 'plugin-geolocation.check_permissions',
    category: 'auto',
    async fn() {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const r = await invoke<{ location: string; coarseLocation: string }>('plugin:geolocation|check_permissions');
        assert(typeof r?.location === 'string' && typeof r?.coarseLocation === 'string', `check_permissions should return { location, coarseLocation }, got ${JSON.stringify(r)}`);
      } catch (e) {
        if (isMissing(e)) skip(`geolocation.check_permissions not available: ${String((e as Error).message)}`);
        throw e;
      }
    },
  },
  {
    // PC-class OHOS devices (MateBook Pro) usually have no vibrator;
    // the ArkTS side rejects with a BusinessError (801/not supported).
    // A clean resolve OR a "not supported" rejection both prove the
    // routing chain (webview fallback → run_command → ArkTS) works.
    name: 'plugin-haptics.selection_feedback (routing smoke)',
    category: 'side-effect',
    async fn() {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('plugin:haptics|selection_feedback');
      } catch (e) {
        const m = String((e as Error)?.message ?? e);
        if (isMissing(e) || /801|device|vibrat/i.test(m)) {
          skip(`haptics device lacks vibrator or command rejected: ${m}`);
        } else {
          throw e;
        }
      }
    },
  },
  {
    // registerListener (register_listener command) registers a Channel for
    // "actionPerformed" events. unregister (remove_listener) tears it down.
    // Both going through without error proves the listener registration
    // chain + ACL permission is wired correctly.
    //
    // Note: watchPosition channel-emit coverage lives in the manual tests
    // (TestRunner "Geolocation Manual Tests") — it needs the device location
    // master switch on and produces a live event stream, which doesn't fit
    // the auto runner (env-dependent: BusinessError 3301100 when off, and
    // event arrival depends on the device producing a location fix).
    name: 'plugin-notification.registerListener',
    category: 'auto',
    async fn() {
      const { onAction } = await import('@tauri-apps/plugin-notification');
      try {
        const listener = await onAction((_notification) => {
          // Action button click callback; not triggered in this test.
        });
        assert(listener != null, 'onAction should return a non-null PluginListener');
        await listener.unregister();
        // Registration + unregistration didn't error = pass.
      } catch (e) {
        if (isMissing(e)) skip(`notification.registerListener not available: ${String((e as Error).message)}`);
        throw e;
      }
    },
  },
];
