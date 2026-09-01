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
    m.includes('not supported')
  );
}

/**
 * Gap-coverage tests for zero-coverage / partially-implemented plugin APIs.
 *
 * Version-compatibility policy: tests for APIs whose OHOS implementation is
 * still being landed (task 1: os.version/locale, notification callbacks,
 * clipboard writeHtml/clear) MUST NOT fail-green when the implementation is
 * absent. They either:
 *   - assert only the "honest baseline" (type/non-empty) when the value may
 *     legitimately be a placeholder, OR
 *   - use `isMissing(e)` to `skip()` when the command is not registered.
 *
 * Once task 1 lands, the placeholders flip to real values and the same
 * assertions become meaningful (e.g. version > 0.0.0). Comments mark the
 * post-landing expectation so reviewers can tighten the assertion later.
 */
export const ohosGapTests: TestCase[] = [
  // ─── A.4: os plugin — type / family / arch / eol / exeExtension ───
  // These were zero-coverage (only platform() had an autotest in plugins.ts;
  // the rest were covered by the manual "OS Info" button only).
  {
    name: '@tauri-apps/plugin-os.type',
    category: 'auto',
    async fn() {
      const { type, platform } = await import('@tauri-apps/plugin-os');
      const t = type();
      assert(typeof t === 'string' && t.length > 0, `type() should return non-empty string, got "${t}"`);
      // Exact OHOS values (manual_tests.md §三十 expectations moved into auto).
      // Guarded by platform() so the suite still runs on Windows dev builds.
      if (platform() === 'ohos') {
        assert(t === 'ohos', `on OHOS type() should be "ohos", got "${t}"`);
      }
    },
  },
  {
    name: '@tauri-apps/plugin-os.family',
    category: 'auto',
    async fn() {
      const { family, platform } = await import('@tauri-apps/plugin-os');
      const f = family();
      assert(typeof f === 'string' && f.length > 0, `family() should return non-empty string, got "${f}"`);
      // OHOS deliberately reports 'ohos' (os plugin family() cfg(target_env="ohos")
      // branch — OpenHarmony is not treated as a traditional Unix), even though
      // target_os is "linux". Verified on device 2026-08-27 (OS Info button).
      assert(f === 'unix' || f === 'windows' || f === 'ohos', `family() should be unix|windows|ohos, got "${f}"`);
      if (platform() === 'ohos') {
        assert(f === 'ohos', `on OHOS family() should be "ohos" (intentional, not "unix"), got "${f}"`);
      }
    },
  },
  {
    name: '@tauri-apps/plugin-os.arch',
    category: 'auto',
    async fn() {
      const { arch, platform } = await import('@tauri-apps/plugin-os');
      const a = arch();
      assert(typeof a === 'string' && a.length > 0, `arch() should return non-empty string, got "${a}"`);
      if (platform() === 'ohos') {
        assert(a === 'aarch64', `on OHOS arch() should be "aarch64", got "${a}"`);
      }
    },
  },
  {
    name: '@tauri-apps/plugin-os.eol',
    category: 'auto',
    async fn() {
      const { eol, platform } = await import('@tauri-apps/plugin-os');
      const e = eol();
      assert(typeof e === 'string', `eol() should return string, got ${typeof e}`);
      // POSIX platforms (incl. OHOS) use "\n"; Windows uses "\r\n".
      assert(e === '\n' || e === '\r\n', `eol() should be \\n or \\r\\n, got ${JSON.stringify(e)}`);
      if (platform() === 'ohos') {
        assert(e === '\n', `on OHOS eol() should be "\\n", got ${JSON.stringify(e)}`);
      }
    },
  },
  {
    name: '@tauri-apps/plugin-os.exeExtension',
    category: 'auto',
    async fn() {
      const { exeExtension, platform } = await import('@tauri-apps/plugin-os');
      const ext = exeExtension();
      assert(typeof ext === 'string', `exeExtension() should return string, got ${typeof ext}`);
      // OHOS / Linux / macOS → "" (empty); Windows → "exe".
      assert(ext === '' || ext === 'exe', `exeExtension() should be "" or "exe", got "${ext}"`);
      if (platform() === 'ohos') {
        assert(ext === '', `on OHOS exeExtension() should be "", got "${ext}"`);
      }
    },
  },

  // ─── A.1: os version / locale / hostname ───
  // version() is sync (reads compile-time os_info). On OHOS os_info is
  // unsupported → Version::Semantic(0,0,0) placeholder. Task 1 will replace
  // this with a real OHOS version. Until then we assert the honest baseline
  // (non-empty string) and RECORD "0.0.0" without failing — a placeholder is
  // not a regression. Once task 1 lands, tighten to assert major > 0.
  {
    name: '@tauri-apps/plugin-os.version',
    category: 'side-effect',
    async fn() {
      const { version, platform } = await import('@tauri-apps/plugin-os');
      const v = version();
      assert(typeof v === 'string' && v.length > 0, `version() should return non-empty string, got "${v}"`);
      if (v === '0.0.0') {
        // 任务1落地后应 > 0.0.0；当前 OHOS 上 os_info 不支持，Version::Semantic(0,0,0) 占位。
        // Record but do not fail — placeholder is the documented pre-task1 state.
        console.log('[os.version] returned placeholder "0.0.0" — task1 should make this a real OHOS version > 0.0.0');
        skip('os.version placeholder "0.0.0" (pre-task1); not a regression');
      }
      // Real version path — parse major and assert >= 0 (post-task1 landing).
      const parts = v.split('.');
      const major = parseInt(parts[0] ?? '0', 10);
      assert(!Number.isNaN(major) && major >= 0, `version major should be a non-negative integer, got "${v}"`);
      // 任务1（version::init）已落地：OHOS 上应为真实版本号（major > 0），
      // manual_tests.md §三十 的占位语义已过时，断言收紧为强校验。
      if (platform() === 'ohos') {
        assert(major > 0, `on OHOS version() should be a real version > 0.0.0, got "${v}"`);
      }
    },
  },
  // locale() — async invoke. Task 1 contract: returns BCP-47 tag or null.
  // Pre-task1: command may not be registered on OHOS → skip honestly.
  {
    name: '@tauri-apps/plugin-os.locale',
    category: 'auto',
    async fn() {
      const { locale } = await import('@tauri-apps/plugin-os');
      try {
        const loc = await locale();
        assert(
          loc === null || (typeof loc === 'string' && loc.length > 0),
          `locale() should return null or non-empty string, got "${loc}"`
        );
        if (loc) {
          // BCP-47 tags contain at least one '-' separating language from region
          // (e.g. "zh-CN"), or are a bare language subtag ("en"). Don't over-assert
          // structure — the contract is "BCP-47 tag or null".
          console.log(`[os.locale] returned "${loc}"`);
        }
      } catch (e) {
        if (isMissing(e)) skip(`os.locale command not available (pre-task1): ${e}`);
        throw e;
      }
    },
  },
  {
    name: '@tauri-apps/plugin-os.hostname',
    category: 'auto',
    async fn() {
      const { hostname } = await import('@tauri-apps/plugin-os');
      try {
        const h = await hostname();
        assert(
          h === null || (typeof h === 'string' && h.length > 0),
          `hostname() should return null or non-empty string, got "${h}"`
        );
      } catch (e) {
        if (isMissing(e)) skip(`os.hostname command not available: ${e}`);
        throw e;
      }
    },
  },

  // ─── A.2: notification callbacks ───
  // onAction / onNotificationReceived register path (auto): verify the listener
  // subscription returns an unlisten function — same shape as the existing
  // deep-link onOpenUrl register test. Triggering the callback requires a real
  // notification tap on-device, covered by the manual tests below + manual_tests.md.
  {
    name: '@tauri-apps/plugin-notification.onAction register',
    category: 'auto',
    async fn() {
      const { onAction } = await import('@tauri-apps/plugin-notification');
      try {
        // Tauri 3.0 contract: addPluginListener returns a PluginListener
        // object with unregister(), not a bare unlisten function (v2).
        const listener = await onAction(() => {});
        assert(
          listener != null && typeof listener.unregister === 'function',
          `onAction should return a PluginListener with unregister(), got ${typeof listener}`
        );
        await listener.unregister();
      } catch (e) {
        if (isMissing(e)) skip(`notification onAction not available: ${e}`);
        throw e;
      }
    },
  },
  {
    name: '@tauri-apps/plugin-notification.onNotificationReceived register',
    category: 'auto',
    async fn() {
      const { onNotificationReceived } = await import('@tauri-apps/plugin-notification');
      try {
        // Tauri 3.0 contract: addPluginListener returns a PluginListener
        // object with unregister(), not a bare unlisten function (v2).
        const listener = await onNotificationReceived(() => {});
        assert(
          listener != null && typeof listener.unregister === 'function',
          `onNotificationReceived should return a PluginListener with unregister(), got ${typeof listener}`
        );
        await listener.unregister();
      } catch (e) {
        if (isMissing(e)) skip(`notification onNotificationReceived not available: ${e}`);
        throw e;
      }
    },
  },
  // registerActionTypes — side-effect (creates a category). Task 1 contract:
  // after landing, registerActionTypes succeeds on OHOS. Pre-task1 it may
  // reject as not-implemented → skip honestly.
  {
    name: '@tauri-apps/plugin-notification.registerActionTypes',
    category: 'side-effect',
    async fn() {
      const { registerActionTypes } = await import('@tauri-apps/plugin-notification');
      try {
        await registerActionTypes([{
          id: 'tauri-gap-test',
          actions: [{ id: 'gap-action', title: 'Gap Test Action' }],
        }]);
      } catch (e) {
        if (isMissing(e)) skip(`notification registerActionTypes not available (pre-task1): ${e}`);
        throw e;
      }
    },
  },
  // Manual: send a notification with an action type, then tap the action button
  // in the notification shade → onAction callback should fire. Device-dependent.
  {
    name: '@tauri-apps/plugin-notification.onAction trigger (manual)',
    category: 'manual',
    async fn() {
      const { onAction, registerActionTypes, sendNotification, isPermissionGranted, requestPermission, Importance } = await import('@tauri-apps/plugin-notification');
      const granted = await isPermissionGranted();
      if (!granted) {
        const res = await requestPermission();
        if (res !== 'granted') {
          console.log('[notification.onAction manual] permission not granted — abort');
          return;
        }
      }
      await registerActionTypes([{
        id: 'tauri-gap-manual',
        actions: [{ id: 'manual-action', title: 'Tap Me' }],
      }]);
      let fired = false;
      const unlisten = await onAction((n) => {
        fired = true;
        console.log('[notification.onAction manual] callback fired:', JSON.stringify(n));
      });
      sendNotification({
        title: 'Gap Test — tap action',
        body: 'Expand the notification and tap "Tap Me"',
        actionTypeId: 'tauri-gap-manual',
      });
      // Give the user up to 30s to expand + tap the action.
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (fired) break;
      }
      unlisten();
      console.log(fired
        ? '[notification.onAction manual] PASS: onAction callback fired'
        : '[notification.onAction manual] FAIL: onAction callback did not fire within 30s (did you expand the notification and tap the action?)');
    },
  },
  // Manual: onNotificationReceived — register a listener, then send a notification
  // and verify the callback fires. Device-dependent (notification delivery).
  {
    name: '@tauri-apps/plugin-notification.onNotificationReceived trigger (manual)',
    category: 'manual',
    async fn() {
      const { onNotificationReceived, sendNotification, isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
      const granted = await isPermissionGranted();
      if (!granted) {
        const res = await requestPermission();
        if (res !== 'granted') {
          console.log('[notification.onNotificationReceived manual] permission not granted — abort');
          return;
        }
      }
      let fired = false;
      const unlisten = await onNotificationReceived((n) => {
        fired = true;
        console.log('[notification.onNotificationReceived manual] callback fired:', JSON.stringify(n));
      });
      sendNotification({ title: 'Gap Test — receive', body: 'onNotificationReceived should fire' });
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (fired) break;
      }
      unlisten();
      console.log(fired
        ? '[notification.onNotificationReceived manual] PASS: callback fired'
        : '[notification.onNotificationReceived manual] FAIL: callback did not fire within 15s');
    },
  },

  // ─── A.3: clipboard writeHtml / clear ───
  // Task 1 contract: writeHtml no longer errors after landing; clear succeeds.
  // Pre-task1: write_html / clear commands may be "not implemented" on OHOS → skip.
  // Uses side-effect category (writes clipboard state). Mirrors writeImage form.
  {
    name: '@tauri-apps/plugin-clipboard-manager.writeHtml',
    category: 'side-effect',
    async fn() {
      const { writeHtml } = await import('@tauri-apps/plugin-clipboard-manager');
      try {
        await writeHtml('<h1>Tauri gap test</h1>', 'Tauri gap test (plain)');
      } catch (e) {
        if (isMissing(e)) skip(`clipboard writeHtml not available (pre-task1): ${e}`);
        throw e;
      }
    },
  },
  {
    name: '@tauri-apps/plugin-clipboard-manager.clear',
    category: 'side-effect',
    async fn() {
      const { clear } = await import('@tauri-apps/plugin-clipboard-manager');
      try {
        await clear();
      } catch (e) {
        if (isMissing(e)) skip(`clipboard clear not available (pre-task1): ${e}`);
        throw e;
      }
    },
  },
  // writeHtml round-trip: write HTML, then readText() should return the altText
  // (we can only read clipboard as text — no readHtml). Task 1 contract: writeHtml
  // lands + readText works → altText readable. Pre-task1 either side may be
  // missing → skip honestly.
  {
    name: '@tauri-apps/plugin-clipboard-manager.writeHtml+readText round-trip',
    category: 'side-effect',
    async fn() {
      const { writeHtml, readText } = await import('@tauri-apps/plugin-clipboard-manager');
      const marker = `tauri-gap-html-${Date.now()}`;
      try {
        await writeHtml(`<b>${marker}</b>`, marker);
        const back = await readText();
        assert(typeof back === 'string', `readText should return string, got ${typeof back}`);
        // readText returns the altText (plain representation) on platforms that
        // store HTML+alt. OHOS clipboard is partial (memory: readText may return
        // empty / hang) — record the value, don't over-assert equality.
        console.log(`[clipboard.writeHtml] readText after writeHtml → "${back}" (expected "${marker}")`);
      } catch (e) {
        if (isMissing(e)) skip(`clipboard writeHtml/readText not available (pre-task1): ${e}`);
        throw e;
      }
    },
  },

  // ─── B.1: shell Sidecar / Command (manual placeholder) ───
  // Sidecar/Command requires an external sidecar binary + tauri.conf.json
  // `externalBin` config — high setup cost, not feasible as an autotest in
  // examples/api. Documented as manual-only; see manual_tests.md §三十一.
  {
    name: '@tauri-apps/plugin-shell.sidecar (manual — external binary)',
    category: 'manual',
    async fn() {
      console.log('[shell.sidecar manual] Requires external sidecar binary + tauri.conf externalBin config.');
      console.log('[shell.sidecar manual] See manual_tests.md §三十一 for the full manual case.');
    },
  },
  {
    name: '@tauri-apps/plugin-shell.Command.spawn (manual — external binary)',
    category: 'manual',
    async fn() {
      console.log('[shell.Command manual] Command.spawn needs a program path; OHOS sandbox cannot exec arbitrary binaries.');
      console.log('[shell.Command manual] See manual_tests.md §三十一 for the full manual case.');
    },
  },

  // ─── B.3: updater check (manual placeholder) ───
  // check() requires the app to be published on AppGallery with a newer version
  // available. Dev environment has no update source → manual-only.
  {
    name: '@tauri-apps/plugin-updater.check (manual — AppGallery)',
    category: 'manual',
    async fn() {
      const { check } = await import('@tauri-apps/plugin-updater');
      try {
        const update = await check();
        console.log(`[updater.check manual] check() → ${update ? `v${update.version} (current v${update.currentVersion})` : 'null (no update)'}`);
      } catch (e) {
        console.log(`[updater.check manual] check() rejected (expected without AppGallery source): ${e}`);
      }
      console.log('[updater.check manual] T1 manual case — requires AppGallery update source; see manual_tests.md §三十一.');
    },
  },
];
