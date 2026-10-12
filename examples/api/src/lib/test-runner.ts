import { invoke } from '@tauri-apps/api/core';

export type TestStatus = 'pass' | 'fail' | 'skip';
export type TestCategory = 'auto' | 'side-effect' | 'manual' | 'driver';

export interface TestCase {
  name: string;
  category: TestCategory;
  fn: () => Promise<void>;
  timeout?: number;
}

export interface TestResult {
  name: string;
  category: TestCategory;
  status: TestStatus;
  duration: number;
  error?: string;
}

export interface TestReport {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TestResult[];
}

/**
 * Throw to mark a test as skipped at runtime — e.g. a command is not
 * implemented on this platform, a permission is missing, or an optional
 * plugin is not registered. runTests recognises the `skip:` prefix and
 * records status='skip' (with the reason) instead of 'fail'.
 *
 * This is the honest alternative to silently catching an error and
 * returning (which would falsely report 'pass').
 */
export function skip(reason: string): never {
  throw new Error(`skip: ${reason}`);
}

// ─── OHOS device-form gating (mobile baseline) ──────────────────────────────
//
// The suite is authored against the desktop (PC/2in1) form. On an OHOS
// mobile-form build whole feature domains are absent BY DESIGN:
//   - menu/tray: lib.rs initialises them only under cfg(desktop) → every
//     plugin:menu| / plugin:tray| invoke fails ("plugin menu not found");
//   - many core window commands (maximize, setFullscreen, currentMonitor,
//     decorations, cursor, effects...) are upstream cfg(desktop) and are
//     not compiled into the mobile .so — each invoke fails with
//     "Plugin not found: window" after the ArkTS fallback also misses.
// Instead of surfacing these as failures on the mobile baseline, cases
// declare themselves desktop-only and are skipped with a reason.

let cachedMobileForm: boolean | null = null;

/**
 * Whether this app runs as the OHOS mobile form (phone/tablet). Asks the
 * Rust side once (`get_device_form` — the same predicate tao's UIAbility
 * spawn gate uses) and caches it. Non-OHOS platforms (no command) default
 * to false (desktop semantics), matching how the suite ran before this
 * gate existed.
 */
export async function isMobileForm(): Promise<boolean> {
  if (cachedMobileForm === null) {
    try {
      cachedMobileForm = (
        await invoke<{ mobile_form: boolean }>('get_device_form')
      ).mobile_form;
    } catch {
      cachedMobileForm = false;
    }
  }
  return cachedMobileForm;
}

/**
 * Skip the current test when running on an OHOS mobile-form build.
 * Use at the top of a desktop-only test's fn().
 */
export async function skipOnMobile(reason: string): Promise<void> {
  if (await isMobileForm()) {
    skip(`desktop-only on OHOS mobile form — ${reason}`);
  }
}

/**
 * Wrap a whole desktop-only suite: every case is skipped on an OHOS
 * mobile-form build. Use for feature domains that are desktop-form by
 * design (menu, tray) so future cases inherit the skip automatically.
 */
export function desktopOnlySuite(tests: TestCase[], feature: string): TestCase[] {
  return tests.map((t) => ({
    ...t,
    async fn() {
      await skipOnMobile(`${feature} is a desktop-form feature (not initialised on mobile builds)`);
      return t.fn();
    },
  }));
}

// ─── OHOS API-level gating (version tiering) ────────────────────────────────
//
// Several OHOS window/webview operations are version-gated in
// tauri-runtime-wry (`ohos_requires_api`): print/createPdf/setAlwaysOnTop
// need SDK API 14+, startResizeDragging 20+, setCursorGrab 22+ — below the
// threshold the facade returns Err BY DESIGN because the underlying
// ArkTS/NDK API does not exist there. The suite's verified devices are API
// 23 (2in1) and API 26 (phone), where every gate passes; this helper keeps
// the suite honest on lower-API devices by recording a skip with the
// threshold in the reason instead of a red "not supported" failure.

let cachedSdkApiVersion: number | null = null;

/**
 * The device's OHOS SDK API level (`get_ohos_version_info`), or null on
 * non-OHOS platforms (no command → no tiering applies).
 */
export async function ohosSdkApiVersion(): Promise<number | null> {
  if (cachedSdkApiVersion === null) {
    try {
      cachedSdkApiVersion = (
        await invoke<{ sdkApiVersion: number }>('get_ohos_version_info')
      ).sdkApiVersion;
    } catch {
      cachedSdkApiVersion = -1;
    }
  }
  return cachedSdkApiVersion < 0 ? null : cachedSdkApiVersion;
}

/**
 * Skip the current test when the device's OHOS SDK API level is below
 * `minApi`. Use at the top of a case whose Rust facade gate returns a
 * version error below that level.
 */
export async function skipBelowOhosApi(minApi: number, reason: string): Promise<void> {
  const v = await ohosSdkApiVersion();
  if (v !== null && v < minApi) {
    skip(`OHOS API ${v} < ${minApi} (facade returns a version error there) — ${reason}`);
  }
}

const TEST_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

/**
 * Append a test result to the report file on the device.
 * Called automatically by runTests after each test completes.
 * Timeouts after 5s so a hung IPC cannot stall the whole suite
 * (2026-08-27: a killed app left the runner awaiting forever with
 * a partial report and no footer — indistinguishable from a hang).
 */
function appendResult(result: TestResult, index: number, total: number): void {
  withTimeout(
    invoke('append_test_result', {
      name: result.name,
      status: result.status,
      duration: result.duration,
      error: result.error || null,
      index,
      total,
    }),
    5000
  ).catch((e: unknown) => { console.error('append_test_result failed:', e, 'name:', result.name); });
}

export async function runTests(
  tests: TestCase[],
  onProgress?: (result: TestResult, index: number, total: number) => void
): Promise<TestReport> {
  const results: TestResult[] = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];

    if (test.category === 'manual') {
      const result: TestResult = {
        name: test.name,
        category: test.category,
        status: 'skip',
        duration: 0,
      };
      results.push(result);
      onProgress?.(result, i, tests.length);
      await appendResult(result, i, tests.length);
      continue;
    }

    const start = performance.now();
    let result: TestResult;

    try {
      await withTimeout(test.fn(), test.timeout || TEST_TIMEOUT_MS);
      result = {
        name: test.name,
        category: test.category,
        status: 'pass',
        duration: Math.round(performance.now() - start),
      };
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      const isSkip = typeof msg === 'string' && msg.startsWith('skip:');
      result = {
        name: test.name,
        category: test.category,
        status: isSkip ? 'skip' : 'fail',
        duration: Math.round(performance.now() - start),
        error: isSkip ? msg.slice('skip:'.length).trim() : msg,
      };
    }

    results.push(result);
    onProgress?.(result, i, tests.length);
    console.log(`TEST ${result.status}: ${result.name} (${result.duration}ms)${result.error ? ' - ' + result.error : ''}`);
    await appendResult(result, i, tests.length);
  }

  return {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    skipped: results.filter((r) => r.status === 'skip').length,
    results,
  };
}
