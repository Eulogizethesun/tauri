import { skip, type TestCase } from '../test-runner';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

/** True when an error indicates the plugin/command is not available on this
 *  platform (not registered / not implemented). Use to skip — never pass. */
function isMissing(e: unknown): boolean {
  const m = String((e as Error)?.message ?? e);
  return (
    m.includes('not found') ||
    m.includes('not implemented') ||
    m.includes('command not found') ||
    m.includes('not allowed by ACL') ||
    m.includes('not supported') ||
    m.includes('unsupported')
  );
}

/**
 * Continuation restore query + source-side save tests for
 * @tauri-apps/plugin-continuation (OHOS-only).
 *
 * Single-device scope: the autotest launch is never a continuation restore
 * (launchReason is START_ABILITY, not CONTINUATION), so the assertable restore
 * contract is the "normal launch" semantics — false / null / consuming-API
 * idempotent-empty. Source-side save (setContinuationData) is fully assertable
 * on a single device (resolve / clear / size-budget rejection); the `onContinue`
 * AGREE/MISMATCH branch cannot be triggered without the system migration UI and
 * is covered by the dual-device manual test cases (manual_tests.md §三十四).
 */

async function loadPlugin() {
  try {
    return await import('@tauri-apps/plugin-continuation');
  } catch (e) {
    skip(`plugin-continuation not available: ${e}`);
    return null;
  }
}

export const ohosContinuationTests: TestCase[] = [
  {
    name: '@tauri-apps/plugin-continuation.isContinuationRestoreLaunch (normal launch)',
    category: 'auto',
    timeout: 10000,
    async fn() {
      const mod = await loadPlugin();
      if (!mod) return;
      let isRestore: boolean;
      try {
        isRestore = await mod.isContinuationRestoreLaunch();
      } catch (e) {
        if (isMissing(e)) skip(`plugin-continuation command not available: ${e}`);
        throw e;
      }
      assert(
        typeof isRestore === 'boolean',
        `isContinuationRestoreLaunch should return a boolean, got ${typeof isRestore}`,
      );
      assert(
        isRestore === false,
        `normal (non-continuation) launch should report false, got ${isRestore}`,
      );
      // Peek semantics: repeated calls must agree.
      const again = await mod.isContinuationRestoreLaunch();
      assert(again === isRestore, `peek should be idempotent, got ${isRestore} then ${again}`);
      console.log(`[continuation] isContinuationRestoreLaunch=${isRestore} (peek idempotent)`);
    },
  },
  {
    name: '@tauri-apps/plugin-continuation.getContinuationData (normal launch)',
    category: 'auto',
    timeout: 10000,
    async fn() {
      const mod = await loadPlugin();
      if (!mod) return;
      let data: string | null;
      try {
        data = await mod.getContinuationData();
      } catch (e) {
        if (isMissing(e)) skip(`plugin-continuation command not available: ${e}`);
        throw e;
      }
      assert(
        data === null,
        `normal (non-continuation) launch should return null, got ${JSON.stringify(data)}`,
      );
      // Consuming API with no data: repeated takes stay null (idempotent empty).
      const second = await mod.getContinuationData();
      assert(second === null, `second take should also be null, got ${JSON.stringify(second)}`);
      console.log('[continuation] getContinuationData=null (normal launch, take idempotent empty)');
    },
  },
  {
    name: '@tauri-apps/plugin-continuation.setContinuationData (save + clear + size budget)',
    category: 'auto',
    timeout: 10000,
    async fn() {
      const mod = await loadPlugin();
      if (!mod) return;
      // Save must resolve (overwrite semantics, peek-on-read).
      try {
        await mod.setContinuationData('{"autotest":"p3c"}');
      } catch (e) {
        if (isMissing(e)) skip(`plugin-continuation command not available: ${e}`);
        throw e;
      }
      // Clear via empty string must also resolve.
      await mod.setContinuationData('');
      // 96 KiB + 1 must reject with the payload-too-large error.
      let rejected = false;
      try {
        await mod.setContinuationData('x'.repeat(96 * 1024 + 1));
      } catch (e) {
        rejected = true;
        const m = String((e as Error)?.message ?? e);
        assert(
          m.toLowerCase().includes('too large'),
          `oversized payload should reject with payload-too-large, got: ${m}`,
        );
      }
      assert(rejected, 'oversized payload (96 KiB + 1) should reject, but resolved');
      // Leave a clean snapshot behind for other tests / manual flows.
      await mod.setContinuationData('');
      console.log('[continuation] setContinuationData save/clear/oversized-reject OK');
    },
  },
  {
    name: '@tauri-apps/plugin-continuation.demo (manual)',
    category: 'manual',
    async fn() {
      console.log('[continuation manual] Open the "Continuation" view and press 查询恢复状态+数据');
      console.log('[continuation manual] Expect: isContinuationRestoreLaunch=普通启动, getContinuationData=null');
      console.log('[continuation manual] Source-side save: type a payload, press 保存快照 then 清空快照 then 超限测试');
      console.log('[continuation manual] Dual-device continuation flow: see manual_tests.md §三十四 (Phase 3c)');
    },
  },
];
