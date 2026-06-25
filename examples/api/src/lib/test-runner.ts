import { invoke } from '@tauri-apps/api/core';

export type TestStatus = 'pass' | 'fail' | 'skip';
export type TestCategory = 'auto' | 'side-effect' | 'manual';

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
 * Fire-and-forget: does not block test execution if the invoke hangs.
 */
function appendResult(result: TestResult, index: number, total: number): void {
  invoke('append_test_result', {
    name: result.name,
    status: result.status,
    duration: result.duration,
    error: result.error || null,
    index,
    total,
  }).catch((e) => { console.error('append_test_result failed:', e, 'name:', result.name); });
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
      result = {
        name: test.name,
        category: test.category,
        status: 'fail',
        duration: Math.round(performance.now() - start),
        error: e?.message || String(e),
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
