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
