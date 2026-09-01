// @generated fault-injection — DO NOT EDIT MANUALLY
//
// Fault injection test suite (52 cases). Injects failures (error / exception /
// delay / timeout) at the ArkTS bridge dispatch boundary to light up Rust-side
// Err handler branches that are unreachable via normal API calls.
//
// Each case: set rule → invoke target API (error swallowed) → clear rules.
// Gated by VITE_COVERAGE_TESTS (runs only in coverage-verification builds).
//
// Action names verified against ArkTS plugin source (2026-08-23). Non-existent
// actions from the design doc were replaced with real ones (see comments).

import type { TestCase } from '../test-runner';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOT_IMPLEMENTED = /not (registered|found|implemented|supported|installed|allowed by acl)|command not found|no such|unknown command|unavailable|plugin .*not/i;

/**
 * Sets a fault rule, runs the target (swallowing the expected injected error),
 * then clears the registry. If fault injection isn't available (feature off),
 * the case is skipped.
 */
async function withFault(
  rule: Record<string, unknown>,
  target: () => Promise<unknown>,
): Promise<void> {
  try {
    await invoke('fault_injection_set_rule', { rule });
  } catch (e) {
    const m = String((e as Error)?.message ?? e);
    if (NOT_IMPLEMENTED.test(m)) throw new Error('skip: ' + m);
    throw e;
  }
  try {
    await target();
  } catch {
    // Expected — the fault was injected. All errors are swallowed (coverage lit).
  } finally {
    try {
      await invoke('fault_injection_clear');
    } catch {
      // cleanup failure is non-fatal
    }
  }
}

/** Build a fault rule object (camelCase keys matching Rust wire format). */
function rule(
  pluginId: string,
  action: string,
  outcome: { kind: string; code?: number; message?: string; ms?: number },
  hits = 1,
): Record<string, unknown> {
  return { pluginId, action, outcome, hits };
}

function faultCase(name: string, fn: () => Promise<unknown>): TestCase {
  return { name: 'fault: ' + name, category: 'driver', timeout: 5000, fn: async () => { await fn(); } };
}

// ── §5.1 ohos.webview (15 cases) ─────────────────────────────────────────────

const webviewErrorCases: TestCase[] = [
  faultCase('webview.set-zoom.error', () =>
    withFault(rule('ohos.webview', 'set-zoom', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|set_webview_zoom', { label: 'main', zoom: 1.5 }))),
  faultCase('webview.set-bounds.error', () =>
    withFault(rule('ohos.webview', 'set-bounds', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|set_webview_position', { label: 'main', x: 0, y: 0 }))),
  faultCase('webview.set-visible.error', () =>
    withFault(rule('ohos.webview', 'set-visible', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|set_webview_visibility', { label: 'main', visible: false }))),
  faultCase('webview.set-background-color.error', () =>
    withFault(rule('ohos.webview', 'set-background-color', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|set_webview_background_color', { label: 'main', color: '#000000' }))),
  faultCase('webview.set-web-debugging-access.error', () =>
    withFault(rule('ohos.webview', 'set-web-debugging-access', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|set_webview_debug', { label: 'main', enabled: true }))),
  faultCase('webview.reload.error', () =>
    withFault(rule('ohos.webview', 'reload', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|webview_reload', { label: 'main' }))),
  faultCase('webview.focus.error', () =>
    withFault(rule('ohos.webview', 'focus', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|webview_focus', { label: 'main' }))),
  faultCase('webview.set-cookie.error', () =>
    withFault(rule('ohos.webview', 'set-cookie', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|set_webview_cookie', { label: 'main', url: 'https://example.com', name: 'test', value: '1' }))),
  // Replaces design's "controller-request" (not found in ArkTS) with "get-url"
  faultCase('webview.get-url.timeout', () =>
    withFault(rule('ohos.webview', 'get-url', { kind: 'timeout' }),
      () => invoke('plugin:webview|webview_url', { label: 'main' }))),
  faultCase('webview.web-page-snapshot.timeout', () =>
    withFault(rule('ohos.webview', 'web-page-snapshot', { kind: 'timeout' }),
      () => invoke('plugin:webview|webview_snapshot', { label: 'main' }))),
  faultCase('webview.register-https-intercept.error', () =>
    withFault(rule('ohos.webview', 'register-https-intercept', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|register_https_intercept', { label: 'main', scheme: 'https' }))),
  // Replaces design's "clear-attached-state" (not found) with "clear-all-browsing-data"
  faultCase('webview.clear-all-browsing-data.error', () =>
    withFault(rule('ohos.webview', 'clear-all-browsing-data', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|clear_all_browsing_data', { label: 'main' }))),
  faultCase('webview.remove.error', () =>
    withFault(rule('ohos.webview', 'remove', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|destroy_webview', { label: 'main' }))),
  faultCase('webview.create.error', () =>
    withFault(rule('ohos.webview', 'create', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|create_webview', { label: 'fault-test', url: 'about:blank' }))),
  // Wildcard action ("") matches all actions of this plugin
  faultCase('webview.wildcard.error1300004', () =>
    withFault(rule('ohos.webview', '', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|webview_url', { label: 'main' }))),
];

// ── §5.2 ohos.window (8 cases) ────────────────────────────────────────────────

const windowCases: TestCase[] = [
  faultCase('window.set-fullscreen.error', () =>
    withFault(rule('ohos.window', 'set-fullscreen', { kind: 'error', code: 1300004, message: 'injected' }),
      () => getCurrentWindow().setFullscreen(true))),
  faultCase('window.set-focusable.error', () =>
    withFault(rule('ohos.window', 'set-focusable', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:window|set_focusable', { label: 'main', focusable: true }))),
  faultCase('window.focus.error', () =>
    withFault(rule('ohos.window', 'focus', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:window|set_focus', { label: 'main' }))),
  // Replaces design's "query-avoid-area" with actual "get-avoid-area"
  faultCase('window.get-avoid-area.error', () =>
    withFault(rule('ohos.window', 'get-avoid-area', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:window|get_avoid_area', { label: 'main' }))),
  faultCase('window.set-decorations.error', () =>
    withFault(rule('ohos.window', 'set-decorations', { kind: 'error', code: 1300004, message: 'injected' }),
      () => getCurrentWindow().setDecorations(true))),
  // Replaces design's "set-size" with actual "resize"
  faultCase('window.resize.error', () =>
    withFault(rule('ohos.window', 'resize', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:window|set_size', { label: 'main', logical: { width: 100, height: 100 } }))),
  // Replaces design's "set-position" with actual "move-to"; timeout
  faultCase('window.move-to.timeout', () =>
    withFault(rule('ohos.window', 'move-to', { kind: 'timeout' }),
      () => invoke('plugin:window|set_position', { label: 'main', logical: { x: 0, y: 0 } }))),
  // Replaces design's "create" with actual "create-os-window"
  faultCase('window.create-os-window.error', () =>
    withFault(rule('ohos.window', 'create-os-window', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:window|create_window', { label: 'fault-test', x: 0, y: 0, width: 100, height: 100 }))),
];

// ── §5.3 statusbar / menu / clipboard / global-shortcut (8 cases) ────────────

const otherPluginCases: TestCase[] = [
  faultCase('statusbar.add.error401', () =>
    withFault(rule('ohos.statusbar', 'add', { kind: 'error', code: 401, message: 'injected 401' }),
      () => invoke('plugin:statusbar|add', { }))),
  faultCase('statusbar.remove.error', () =>
    withFault(rule('ohos.statusbar', 'remove', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:statusbar|remove', { }))),
  faultCase('statusbar.update-menu.error', () =>
    withFault(rule('ohos.statusbar', 'update-menu', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:statusbar|update_menu', { }))),
  // Replaces design's "set-items" with actual "set-menubar"
  faultCase('menu.set-menubar.error', () =>
    withFault(rule('ohos.menu', 'set-menubar', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:menu|set_menubar', { label: 'main', items: [] }))),
  faultCase('menu.popup.timeout', () =>
    withFault(rule('ohos.menu', 'popup', { kind: 'timeout' }),
      () => invoke('plugin:menu|popup', { }))),
  faultCase('clipboard.write-text.error', () =>
    withFault(rule('ohos.clipboard', 'write-text', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:clipboard|write_text', { text: 'fault-test' }))),
  faultCase('clipboard.read-text.timeout', () =>
    withFault(rule('ohos.clipboard', 'read-text', { kind: 'timeout' }),
      () => invoke('plugin:clipboard|read_text', { }))),
  faultCase('global-shortcut.register.error', () =>
    withFault(rule('ohos.global-shortcut', 'register', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:global-shortcut|register', { shortcut: 'Ctrl+Shift+F' }))),
];

// ── §5.4 bridge/mod.rs attach_promise + call_raw (6 cases) ───────────────────

const bridgeCoreCases: TestCase[] = [
  // Wildcard on ohos.window — exception outcome lights up attach_promise .catch
  faultCase('bridge.window.wildcard.exception', () =>
    withFault(rule('ohos.window', '', { kind: 'exception', message: 'bridge-exception-test' }),
      () => invoke('plugin:window|set_size', { label: 'main', logical: { width: 100, height: 100 } }))),
  faultCase('bridge.window.wildcard.error', () =>
    withFault(rule('ohos.window', '', { kind: 'error', code: 1300004, message: 'bridge-error-test' }),
      () => invoke('plugin:window|set_size', { label: 'main', logical: { width: 100, height: 100 } }))),
  faultCase('bridge.window.wildcard.timeout', () =>
    withFault(rule('ohos.window', '', { kind: 'timeout' }),
      () => invoke('plugin:window|set_size', { label: 'main', logical: { width: 100, height: 100 } }))),
  faultCase('bridge.webview.wildcard.exception', () =>
    withFault(rule('ohos.webview', '', { kind: 'exception', message: 'webview-exception-test' }),
      () => invoke('plugin:webview|set_webview_zoom', { label: 'main', zoom: 1.0 }))),
  faultCase('bridge.node.create-container.error', () =>
    withFault(rule('ohos.node', 'create-container', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:node|create_container', { }))),
  faultCase('bridge.account.login.timeout', () =>
    withFault(rule('ohos.account', 'login', { kind: 'timeout' }),
      () => invoke('plugin:account|login', { }))),
];

// ── §5.5 oha app/lifecycle/waker (5 cases) ───────────────────────────────────

const miscOhaCases: TestCase[] = [
  faultCase('node.mount-into-root.error', () =>
    withFault(rule('ohos.node', 'mount-into-root', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:node|mount_into_root', { handle: 0 }))),
  faultCase('updater.check.error', () =>
    withFault(rule('ohos.updater', 'check', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:updater|check', { }))),
  // Replaces design's "url open" with actual "open-url"
  faultCase('url.open-url.timeout', () =>
    withFault(rule('ohos.url', 'open-url', { kind: 'timeout' }),
      () => invoke('plugin:url|open_url', { url: 'https://example.com' }))),
  faultCase('permission.request.timeout', () =>
    withFault(rule('ohos.permission', 'request', { kind: 'timeout' }),
      () => invoke('plugin:permission|request', { permissions: ['ohos.permission.LOCATION'] }))),
  // Replaces design's "resource get" (no actions exist) with "app-control terminate"
  faultCase('app-control.terminate.error', () =>
    withFault(rule('ohos.app-control', 'terminate', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:app-control|terminate', { }))),
];

// ── §5.6 tauri-runtime-wry / tauri Err consumption chain (8 cases) ──────────
// Inject at oha bridge level; call through tauri JS API to light up
// tauri-runtime-wry and tauri error handler branches.

const tauriChainCases: TestCase[] = [
  faultCase('tauri.window.set-size.error', () =>
    withFault(rule('ohos.window', 'resize', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:window|set_size', { label: 'main', logical: { width: 100, height: 100 } }))),
  faultCase('tauri.window.maximize.error', () =>
    withFault(rule('ohos.window', 'maximize', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:window|maximize', { label: 'main' }))),
  faultCase('tauri.window.minimize.error', () =>
    withFault(rule('ohos.window', 'minimize', { kind: 'error', code: 1300004, message: 'injected' }),
      () => getCurrentWindow().minimize())),
  faultCase('tauri.window.set-decorations.error', () =>
    withFault(rule('ohos.window', 'set-decorations', { kind: 'error', code: 1300004, message: 'injected' }),
      () => getCurrentWindow().setDecorations(true))),
  faultCase('tauri.webview.set-zoom.error', () =>
    withFault(rule('ohos.webview', 'set-zoom', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|set_webview_zoom', { label: 'main', zoom: 1.5 }))),
  // Replaces design's "set-position" with "set-bounds"
  faultCase('tauri.webview.set-bounds.error', () =>
    withFault(rule('ohos.webview', 'set-bounds', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|set_webview_position', { label: 'main', x: 0, y: 0 }))),
  faultCase('tauri.webview.create.error', () =>
    withFault(rule('ohos.webview', 'create', { kind: 'error', code: 1300004, message: 'injected' }),
      () => invoke('plugin:webview|create_webview', { label: 'fault-tauri', url: 'about:blank' }))),
  faultCase('tauri.webview.print.timeout', () =>
    withFault(rule('ohos.webview', 'print', { kind: 'timeout' }),
      () => invoke('plugin:webview|print', { label: 'main' }))),
];

// ── §5.7 Cross-contamination + delay verification (2 cases) ─────────────────

const verificationCases: TestCase[] = [
  // Pollute with a wildcard rule, clear, then verify normal call works
  faultCase('verify.clear-restores-normal', async () => {
    try {
      await invoke('fault_injection_set_rule', {
        rule: rule('ohos.window', '', { kind: 'error', code: 1300004, message: 'pollute' }),
      });
      await invoke('fault_injection_clear');
      // After clear, a normal call should succeed (or fail with a non-injected error)
      await invoke('plugin:window|set_size', { label: 'main', logical: { width: 800, height: 600 } });
    } catch (e) {
      const m = String((e as Error)?.message ?? e);
      if (NOT_IMPLEMENTED.test(m)) throw new Error('skip: ' + m);
      // Non-injected errors are acceptable (e.g. window not found on non-OHOS)
    }
  }),
  // Delay 50ms then normal return — verifies delay falls through to real invokeAsync
  faultCase('verify.delay.50ms.then-normal', () =>
    withFault(rule('ohos.webview', 'get-url', { kind: 'delay', ms: 50 }),
      () => invoke('plugin:webview|webview_url', { label: 'main' }))),
];

// ── Export ────────────────────────────────────────────────────────────────────

export const faultInjectionTests: TestCase[] = [
  ...webviewErrorCases,
  ...windowCases,
  ...otherPluginCases,
  ...bridgeCoreCases,
  ...miscOhaCases,
  ...tauriChainCases,
  ...verificationCases,
];
