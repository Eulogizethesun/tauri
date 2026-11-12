import { skip, skipOnMobile, ohosSdkApiVersion, type TestCase } from '../test-runner';
import { invoke, Channel, Resource } from '@tauri-apps/api/core';
import { emit, listen, once, emitTo } from '@tauri-apps/api/event';
import { getVersion, getName, getTauriVersion, getIdentifier, getBundleType, defaultWindowIcon, supportsMultipleWindows, setDockVisibility, hide as appHide, show as appShow } from '@tauri-apps/api/app';
import { getCurrentWindow, currentMonitor, cursorPosition, availableMonitors, getAllWindows, primaryMonitor, Effect, PhysicalPosition, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWebview, Webview } from '@tauri-apps/api/webview';
import { appCacheDir, basename, dirname, extname, isAbsolute, normalize, resolve, appConfigDir, appLocalDataDir, appLogDir, audioDir, configDir, dataDir, documentDir, downloadDir, pictureDir, tempDir, runtimeDir } from '@tauri-apps/api/path';

// Helper to test custom protocol using iframe
function testCustomProtocol(url: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;

    const timeoutId = setTimeout(() => {
      document.body.removeChild(iframe);
      window.removeEventListener('message', handleMessage);
      resolve({ ok: false, error: 'timeout waiting for protocol response' });
    }, 5000);

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.status === 'ok') {
        clearTimeout(timeoutId);
        document.body.removeChild(iframe);
        window.removeEventListener('message', handleMessage);
        resolve({ ok: true });
      }
    };

    window.addEventListener('message', handleMessage);
    document.body.appendChild(iframe);
  });
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// C1b 目录 API 形态断言（SOW §三 S3-048~S3-058，2026-11-10）：
// 通用腿=非空+绝对路径；OHOS el2 形态腿=严格尾部断言。JS 层（plugin:path 经
// ArkTS Context）返回模块级形态 el2/base/haps/<module>/<tail>——2026-11-10 真机
// 勘误：首版按 crates/tauri/src/path/ohos.rs 的 bundle 级形态写期望，实测 10/10
// 带 haps/entry_desktop 模块段（与 appCacheDir 模块级路径陷阱同源，Rust/物理侧
// 才是 bundle 级）；模块段按可选处理（bundle 级/模块级两形态皆合法），尾部严格。
const OHOS_EL2_BASE = '/data/storage/el2/base/';

async function assertDirPath(dir: string, ohosSuffix: string, apiName: string): Promise<void> {
  assert(typeof dir === 'string' && dir.length > 0, `${apiName}: expected non-empty path, got "${dir}"`);
  assert((await isAbsolute(dir)) === true, `${apiName}: path should be absolute, got "${dir}"`);
  if (dir.startsWith(OHOS_EL2_BASE)) {
    let tail = dir.slice(OHOS_EL2_BASE.length);
    if (tail.startsWith('haps/')) {
      const moduleEnd = tail.indexOf('/', 'haps/'.length);
      assert(moduleEnd > 0, `${apiName}: malformed haps module segment, got "${dir}"`);
      tail = tail.slice(moduleEnd + 1);
    }
    assert(
      tail === ohosSuffix,
      `${apiName}: OHOS el2 form should be base/[haps/<module>/]${ohosSuffix}, got "${dir}"`
    );
  }
}

// Probe IPC response routing into a same-origin iframe child frame.
// The child page (public/iframe-ipc-child.{html,js}) runs invoke('echo')
// through the real __TAURI_INTERNALS__.invoke path (the isolation pattern
// rejects hand-rolled raw postMessage payloads by design — see the probe
// header and the Phase B addendum in the openspec change) and reports back
// over the NATIVE window.postMessage channel — which is NOT the transport
// under test, so the probe stays observable even when Tauri IPC routing is
// broken.
interface IframeIpcInvokeReport {
  settled: boolean;
  result?: unknown;
  error?: string;
  thrown?: string;
  phase?: string;
  sentAt?: number;
  settledAt?: number;
}
// Phase A diagnostics: per-frame origin view reported by the probe page.
interface IframeIpcEnv {
  href: string;
  protocol: string;
  origin: string;
  isTop: boolean;
  parentIsTop: boolean;
  frames: number;
  secureContext: boolean;
  parentAccess: string;
  parentOrigin: string | null;
  parentHref: string | null;
  topAccess: string;
  topOrigin: string | null;
}
interface IframeIpcRelayArrival {
  t: number;
  eventOrigin: string;
  sourceIsParent: boolean;
  id: number | string;
  registeredByProbe: boolean;
  echoPending: boolean;
  errorPending: boolean;
  mapSize: number;
}
interface IframeIpcDiag {
  registeredIds?: Array<number | string>;
  matrix?: Record<string, { t: number; eventOrigin: string; sourceIsParent: boolean } | null>;
  relayArrivals?: IframeIpcRelayArrival[];
  isolationCallbackIds?: Array<{ t: number; callback: string }>;
  messageLog?: Array<{ t: number; o: string; src: string; d: string }>;
  runReceivedAt?: number;
}
interface IframeIpcProbe {
  __iframeIpcChild?: boolean;
  phase?: string;
  role?: string;
  internalsType: string;
  hasInternalsPostMessage: boolean;
  hasTransformCallback: boolean;
  hasIpc: boolean;
  hasGlobalTauri: boolean;
  invoke: IframeIpcInvokeReport;
  invokeError: IframeIpcInvokeReport;
  grandchildInvoke: IframeIpcInvokeReport | null;
  forgedIgnored?: boolean;
  env?: IframeIpcEnv;
  diag?: IframeIpcDiag;
  parentEnv?: Record<string, unknown>;
  matrixThrows?: Record<string, string>;
  matrixTargets?: Record<string, string>;
  runSentAt?: number;
}
/**
 * Platforms where an iframe can drive the Tauri IPC end to end (issue
 * Eulogizethesun/tauri#241). Windows delivers the iframe's `window.ipc`
 * postMessage straight to the bridge; OHOS additionally runs the frame
 * relay in core.js. On macOS and Linux upstream injects the init scripts
 * into the MAIN frame only (assertion 1 fails immediately), and on Android
 * the scripts land but there is no relay, so `invoke` never settles and the
 * case just burns its whole timeout — skip those instead of reporting a
 * platform-inherent failure.
 */
async function iframeIpcSupportedPlatform(): Promise<boolean> {
  try {
    const { platform } = await import('@tauri-apps/plugin-os');
    const p = platform();
    return p === 'ohos' || p === 'windows';
  } catch {
    return false;
  }
}

function runIframeIpcProbe(): Promise<IframeIpcProbe> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.src = '/iframe-ipc-child.html';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '240px';
    iframe.style.height = '140px';
    iframe.style.zIndex = '1';
    iframe.style.border = '1px solid rgba(0,0,0,.25)';
    iframe.setAttribute('data-test', 'iframe-ipc-probe');

    let ready = false;
    const matrixThrows: Record<string, string> = {};
    const matrixTargets: Record<string, string> = {
      origin: window.location.origin ?? 'null',
      slash: '/',
      star: '*'
    };
    let runSentAt = 0;
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`iframe IPC probe timed out: child page never reported (ready=${ready})`));
    }, 15000);

    function cleanup() {
      clearTimeout(timeoutId);
      window.removeEventListener('message', handleMessage);
      iframe.remove();
    }

    function handleMessage(event: MessageEvent) {
      const data = event.data as IframeIpcProbe | null;
      if (!data || data.__iframeIpcChild !== true) return;
      if (data.phase === 'ready' && !ready) {
        ready = true;
        runSentAt = Date.now();
        iframe.contentWindow?.postMessage({ __iframeIpcParent: true, phase: 'run' }, '*');
        // Phase A targetOrigin matrix: same payload shape as the core.js relay
        // broadcast, three targetOrigin variants — which copies the child
        // receives settles the origin semantics of the custom-protocol origin.
        for (const mark of ['origin', 'slash', 'star'] as const) {
          try {
            iframe.contentWindow?.postMessage(
              { __iframeIpcParent: true, phase: 'matrix', matrix: mark },
              matrixTargets[mark]
            );
          } catch (e) {
            matrixThrows[mark] = String(e);
          }
        }
        return;
      }
      if (data.phase === 'result') {
        cleanup();
        resolve({
          ...data,
          runSentAt,
          matrixThrows,
          matrixTargets,
          parentEnv: parentIpcEnv()
        });
      }
    }

    window.addEventListener('message', handleMessage);
    document.body.appendChild(iframe);
  });
}

// Parent-side (test document) view of the same environment facts the probe
// reports, so both ends of the link are in one evidence record.
function parentIpcEnv(): Record<string, unknown> {
  const internals = (window as unknown as {
    __TAURI_INTERNALS__?: {
      __TAURI_PATTERN__?: { pattern?: string };
      callbacks?: { size: number };
    };
  }).__TAURI_INTERNALS__;
  const isolationFrame = document.querySelector('iframe#__tauri_isolation__') as HTMLIFrameElement | null;
  return {
    href: String(window.location.href),
    protocol: String(window.location.protocol),
    origin: String(window.location.origin ?? 'null'),
    isTop: window.top === window,
    frames: window.frames.length,
    secureContext: window.isSecureContext === true,
    tauriPattern: internals?.__TAURI_PATTERN__?.pattern ?? 'missing',
    isolationIframe: isolationFrame ? String(isolationFrame.src) : 'absent',
    mainMapSize: internals?.callbacks?.size ?? -1
  };
}

// One-line evidence blob for report/hilog consumption. `|` is scrubbed so the
// markdown table row cannot be broken by the payload.
function iframeIpcEvidence(
  probe: IframeIpcProbe,
  extra?: { testStart: number; missWarns: Array<{ t: number; id: string }> }
): string {
  const blob = JSON.stringify({
    testStart: extra?.testStart,
    runSentAt: probe.runSentAt,
    missWarns: extra?.missWarns,
    parentEnv: probe.parentEnv,
    matrixTargets: probe.matrixTargets,
    matrixThrows: probe.matrixThrows,
    childEnv: probe.env,
    childInvoke: probe.invoke,
    childDiag: probe.diag
  });
  return blob.replace(/\|/g, '/');
}

// ─── Webview viewport probe (openspec ohos-webview-sizing, case-first) ───
//
// The cases below assert the ArkTS RENDER-layer truth (the webview page's
// window.innerWidth/innerHeight via public/webview-viewport-probe.{html,js}
// → track_webview_viewport_probe), not the Rust bounds cache — the multi-webview
// cache round-trips were exactly the blind spot that let "Rust records correct,
// ArkTS renders full-window" ship (consumer Tab-content-layer defect signature).
//
// Red-light contract (task 1.5): on the pre-fix HEAD, case a and case b must
// FAIL (probe ≈ full-window size instead of the requested geometry) and case c
// must fail on the flip leg only — the natural-follow legs are expected green
// on HEAD (the "always 100%" fallback follows the container) and act as the
// anti-regression guard for the D1 geometry migration.

interface ViewportProbeSample {
  tag: string;
  innerWidth: number;
  innerHeight: number;
  docWidth: number;
  docHeight: number;
}

// Latest sample reported by the webview labeled `tag` (the probe page reports
// its own webview label; resize re-reports supersede the load-time sample).
async function latestViewportProbe(tag: string): Promise<ViewportProbeSample | null> {
  const probes = await invoke<ViewportProbeSample[]>('get_tracked_webview_viewport_probes');
  let latest: ViewportProbeSample | null = null;
  for (const p of probes) {
    if (p.tag === tag) latest = p;
  }
  return latest;
}

function describeProbe(p: ViewportProbeSample | null): string {
  return p
    ? `${p.innerWidth}×${p.innerHeight} (doc ${p.docWidth}×${p.docHeight})`
    : 'no sample';
}

// Polls until the tag's probe reports the expected viewport within a ±tolPx
// measurement tolerance (default ±1). Device-measured (2in1 3QC0124C11000038,
// 2026-10-20 green-run calibration): ArkWeb reports window.innerWidth/
// innerHeight as the component size + 1px on BOTH axes, systematically, for
// every geometry — 300×200→301×201, 400×300→401×301, 320×240→321×241,
// natural 600×450→601×451, main window→1101×657. The +1 is ArkWeb
// viewport-report semantics, not a geometry error — the defect this suite
// pins (full-window inflation) is two orders of magnitude larger (e.g. +800
// wide). Default tolerance must stay ≤1 so the distinct set_bounds legs in
// case b (400×300 vs 250×150) cannot alias. Callers whose expectation is
// RATE-derived (case d's auto-resize legs: expectation = creation rect ×
// actual window size ÷ window size at arm time) pass tolPx=2: the applied
// geometry is fractional and rounds on both sides of the systematic +1, so
// ±1 would be one-sided.
async function pollViewportProbe(
  tag: string,
  expectW: number,
  expectH: number,
  budgetMs: number,
  what: string,
  tolPx = 1
): Promise<ViewportProbeSample> {
  const start = Date.now();
  let last: ViewportProbeSample | null = null;
  while (Date.now() - start < budgetMs) {
    last = await latestViewportProbe(tag);
    if (
      last &&
      Math.abs(last.innerWidth - expectW) <= tolPx &&
      Math.abs(last.innerHeight - expectH) <= tolPx
    ) {
      return last;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `${what}: probe "${tag}" never reported ${expectW}×${expectH} (±1) within ${budgetMs}ms — last sample: ${describeProbe(last)}`
  );
}

// Polls until the tag's probe has produced any sample (page load + IPC uplink
// settled) — used where the acceptance is a transition, not the initial size.
async function pollViewportProbeSettled(
  tag: string,
  budgetMs: number,
  what: string
): Promise<ViewportProbeSample> {
  const start = Date.now();
  while (Date.now() - start < budgetMs) {
    const sample = await latestViewportProbe(tag);
    if (sample) return sample;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `${what}: probe "${tag}" produced no sample within ${budgetMs}ms — probe page load or IPC uplink broken`
  );
}

// Fails fast on child-webview creation errors instead of letting the probe
// poll time out with an indirect symptom.
function waitForWebviewCreated(child: Webview, what: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${what}: webview creation timed out after 5000ms`)),
      5000
    );
    child.once('tauri://created', () => {
      clearTimeout(timer);
      resolve();
    });
    child.once('tauri://error', (e: unknown) => {
      clearTimeout(timer);
      reject(new Error(`${what}: webview creation failed: ${String(e)}`));
    });
  });
}

export const coreTests: TestCase[] = [
  // OHOS version info (prints to console on OHOS, skipped on other platforms)
  {
    name: '@tauri-apps/ohos.versionInfo',
    category: 'auto',
    async fn() {
      try {
        const info = await invoke<{
          sdkApiVersion: number;
          distributionApiVersion: number;
        }>('get_ohos_version_info');
        console.log(`[OHOS Version] sdk_api=${info.sdkApiVersion}, distribution_api=${info.distributionApiVersion}`);
        assert(info.sdkApiVersion >= 12, `sdkApiVersion should be >= 12, got ${info.sdkApiVersion}`);
        assert(info.distributionApiVersion > 0, `distributionApiVersion should be > 0, got ${info.distributionApiVersion}`);
      } catch {
        // Not on OHOS — command doesn't exist, skip silently
      }
    },
  },

  // @tauri-apps/api/app
  {
    name: '@tauri-apps/api/app.getVersion',
    category: 'auto',
    async fn() {
      const version = await getVersion();
      assert(typeof version === 'string' && version.length > 0, `expected non-empty string, got "${version}"`);
    },
  },

  // @tauri-apps/api/app 应用信息（C1b 新断言批，SOW §三 S3-003~S3-008/S3-011/S3-012，2026-11-10）。
  // 契约依据 crates/tauri/src/app/plugin.rs：getBundleType=null（HAP 不在 BundleType 枚举，
  // bundler 二进制补丁不触及 ohos 构建）；app.hide/show 与 setDockVisibility 在非 macOS
  // 全为 no-op 返回 Ok（cfg 门，与 #237 窗口级契约拒绝是不同形态）。
  {
    name: '@tauri-apps/api/app.getName',
    category: 'auto',
    async fn() {
      const name = await getName();
      assert(typeof name === 'string' && name.length > 0, `expected non-empty app name, got "${name}"`);
    },
  },
  {
    name: '@tauri-apps/api/app.getTauriVersion',
    category: 'auto',
    async fn() {
      const v = await getTauriVersion();
      assert(/^\d+\.\d+\.\d+/.test(String(v)), `expected semantic version string, got "${v}"`);
    },
  },
  {
    name: '@tauri-apps/api/app.getIdentifier',
    category: 'auto',
    async fn() {
      const id = await getIdentifier();
      assert(typeof id === 'string' && id.length > 0, `expected non-empty identifier, got "${id}"`);
      assert(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$/.test(id), `identifier should be dotted reverse-domain form, got "${id}"`);
    },
  },
  {
    name: '@tauri-apps/api/app.getBundleType',
    category: 'auto',
    async fn() {
      // d.ts 签名是 Promise<BundleType>，Rust 侧返回 Option——OHOS 未走桌面
      // bundler 补丁，__TAURI_BUNDLE_TYPE 保持 UNK → null 是平台预期值。
      const t = await getBundleType();
      const enumValues = ['nsis', 'msi', 'deb', 'rpm', 'appimage', 'app'];
      assert(
        t === null || enumValues.includes(t as never),
        `expected null (OHOS) or a BundleType enum value, got "${t}"`
      );
    },
  },
  {
    name: '@tauri-apps/api/app.defaultWindowIcon',
    category: 'auto',
    async fn() {
      const icon = await defaultWindowIcon();
      if (icon === null) return; // 合同双臂：无默认图标（icon 未配置）即 null
      assert(typeof icon.rid === 'number' && icon.rid > 0, `expected Image with rid>0 or null, got rid=${icon.rid}`);
      const size = await icon.size();
      assert(size.width > 0 && size.height > 0, `icon size should be positive, got ${size.width}x${size.height}`);
    },
  },
  {
    name: '@tauri-apps/api/app.supportsMultipleWindows',
    category: 'auto',
    async fn() {
      const smw = await supportsMultipleWindows();
      assert(typeof smw === 'boolean', `expected boolean, got "${smw}"`);
      // 本套件的 float 子窗/多窗用例依赖真多窗——false 意味着整个多窗族失真。
      assert(smw === true, `expected true on OHOS (suite depends on sub-windows), got ${smw}`);
    },
  },
  {
    name: '@tauri-apps/api/app.hide+show (app-level, non-macOS no-op contract)',
    category: 'auto',
    timeout: 6000,
    async fn() {
      // S3-011：应用级 app_hide/app_show 被 cfg(target_os = "macos") 门住
      // （plugin.rs:41-47），非 macOS 一律 no-op 返回 Ok。断言=干净 resolve +
      // 主窗可见性不翻（no-op 实证）。窗口级 hide 的 #237 契约拒绝是另一路径。
      const before = await getCurrentWindow().isVisible();
      await appHide();
      await appShow();
      const after = await getCurrentWindow().isVisible();
      assert(before === true, `main window should be visible before, got ${before}`);
      assert(after === true, `main window should stay visible (non-macOS no-op contract), got ${after}`);
    },
  },
  {
    name: '@tauri-apps/api/app.setDockVisibility (non-macOS no-op contract)',
    category: 'auto',
    async fn() {
      // S3-012：set_dock_visibility 在非 macOS 全为 no-op 返回 Ok
      // （plugin.rs:108-110）。计划稿曾列 manual（判据 dock 图标消失/恢复），
      // 按源码实证 OHOS 无 macOS 式 Dock、判据定义性不可验——转 auto 契约
      // 断言（#237 诚实契约先例）：双向调用干净 resolve 即链路验证。
      await setDockVisibility(false);
      await setDockVisibility(true);
    },
  },

  // @tauri-apps/api/core
  {
    name: '@tauri-apps/api/core.invoke',
    category: 'auto',
    async fn() {
      const msg = 'hello from test';
      const result = await invoke('echo', { message: msg });
      assert(result !== undefined, 'invoke echo returned undefined');
    },
  },
  {
    name: '@tauri-apps/api/core.Channel',
    category: 'auto',
    async fn() {
      const received: number[] = [];
      const channel = new Channel<number>();
      channel.onmessage = (msg) => { received.push(msg); };
      await invoke('spam', { channel });

      // Wait for all messages to arrive (poll with timeout)
      const startTime = Date.now();
      const timeout = 5000;
      while (received.length < 1000 && Date.now() - startTime < timeout) {
        await new Promise((r) => setTimeout(r, 50));
      }

      assert(received.length === 1000, `expected 1000 messages, got ${received.length}`);
    },
  },
  {
    // IPC response routing into a child frame: an invoke issued inside a
    // same-origin iframe must settle there. On OHOS the response is routed
    // back via webview eval (runCallback) which targets the MAIN frame only —
    // when the callback was registered inside the iframe the response is lost
    // and the main-frame console shows "[TAURI] Couldn't find callback id".
    name: '@tauri-apps/api/core.invoke (iframe child frame routing)',
    category: 'auto',
    timeout: 25000,
    async fn() {
      if (!(await iframeIpcSupportedPlatform())) {
        skip(
          'iframe IPC routing needs the platform frame relay (OHOS) or direct per-frame ipc bridge (Windows); on macOS/Linux the init scripts never reach the child frame and on Android invoke would never settle, so the case would only burn its timeout'
        );
      }
      // Phase A v2: capture the main frame's runCallback miss warns with
      // absolute timestamps — correlating them with the child's relay-arrival
      // timestamps decomposes the round trip into uplink/Rust vs downlink.
      const missWarns: Array<{ t: number; id: string }> = [];
      const prevWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        try {
          const text = args.map((a) => String(a)).join(' ');
          const m = text.match(/Couldn't find callback id (\d+)/);
          if (m) missWarns.push({ t: Date.now(), id: m[1] });
        } catch { /* diag only */ }
        prevWarn(...args);
      };

      const testStart = Date.now();
      const probe = await runIframeIpcProbe();
      console.warn = prevWarn;
      // Phase A: dump the origin/matrix/timeline evidence once — hilog
      // (ARKWEB-CONSOLE) and the failure message below both carry it.
      const evidence = iframeIpcEvidence(probe, { testStart, missWarns });
      console.log('[iframe-ipc-diag] ' + evidence);

      // 1. Init scripts must reach the iframe document at all.
      assert(probe.internalsType === 'object',
        `init scripts did not reach the iframe: typeof __TAURI_INTERNALS__ is "${probe.internalsType}" | diag: ${evidence}`);
      assert(probe.hasTransformCallback, '__TAURI_INTERNALS__.transformCallback missing in iframe (core.js not injected)');
      assert(probe.hasInternalsPostMessage, '__TAURI_INTERNALS__.postMessage missing in iframe (ipc-protocol.js not injected)');
      assert(probe.hasIpc, 'window.ipc.postMessage missing in iframe (wry ipc bridge not injected)');

      // 2. The invoke itself must settle and roundtrip.
      assert(probe.invoke.settled === true,
        `invoke('echo') from the iframe never settled (${probe.invoke.phase ?? 'no phase'}) — IPC response routing does not reach child frames | diag: ${evidence}`);
      assert(probe.invoke.error === undefined && probe.invoke.thrown === undefined,
        `invoke('echo') from the iframe rejected: ${probe.invoke.error ?? probe.invoke.thrown}`);
      const echoed = probe.invoke.result as { message?: unknown } | undefined;
      assert(echoed !== undefined && echoed.message === 'from-iframe',
        `echo roundtrip mismatch from iframe: ${JSON.stringify(probe.invoke.result)}`);

      // 3. Error path: the error-callback id must be relayed too — invoking a
      //    command that does not exist has to settle via reject (the error
      //    callback receives the response), not time out.
      assert(probe.invokeError.settled === true
        && typeof probe.invokeError.error === 'string'
        && probe.invokeError.error.length > 0,
        `invoke of a missing command from the iframe did not reject through the relay (settled=${probe.invokeError.settled}, report=${JSON.stringify(probe.invokeError)}) | diag: ${evidence}`);

      // 4. Nested frame chain: main -> child -> grandchild, two relay hops.
      const grand = probe.grandchildInvoke;
      assert(grand !== null && grand.settled === true,
        `invoke from the grandchild frame never settled (${JSON.stringify(probe.grandchildInvoke)}) — chained relay does not reach nested frames | diag: ${evidence}`);
      const grandEchoed = probe.grandchildInvoke?.result as { message?: unknown } | undefined;
      assert(grandEchoed !== undefined && grandEchoed.message === 'from-grandchild',
        `echo roundtrip mismatch from grandchild: ${JSON.stringify(probe.grandchildInvoke?.result)}`);

      // 5. Forged-message guard: a __TAURI_FRAME_CALLBACK__ message whose
      //    source is not the direct parent must be delivered but ignored by
      //    the relay listener (the target callback never fires).
      assert(probe.forgedIgnored === true,
        `forged __TAURI_FRAME_CALLBACK__ message (source ≠ parent) was not ignored by the relay listener (forgedIgnored=${probe.forgedIgnored})`);
    },
  },

  // @tauri-apps/api/event
  {
    name: '@tauri-apps/api/event.emit+listen',
    category: 'auto',
    async fn() {
      const payload = { test: 'data', ts: Date.now() };
      let received: any = null;
      const unlisten = await listen('test-event', (event) => {
        received = event.payload;
      });
      await emit('test-event', payload);
      await new Promise((r) => setTimeout(r, 100));
      unlisten();
      assert(received !== null, 'listener did not receive event');
      assert(received.test === 'data', `unexpected payload: ${JSON.stringify(received)}`);
    },
  },
  {
    name: '@tauri-apps/api/event.once',
    category: 'auto',
    async fn() {
      let count = 0;
      const unlisten = await once('test-once-event', () => { count++; });
      await emit('test-once-event', {});
      await new Promise((r) => setTimeout(r, 50));
      await emit('test-once-event', {});
      await new Promise((r) => setTimeout(r, 50));
      unlisten();
      assert(count === 1, `once listener fired ${count} times, expected 1`);
    },
  },
  {
    name: '@tauri-apps/api/event.emitTo',
    category: 'auto',
    async fn() {
      // S2-019「定向发送事件」：emitTo 带 EventTarget 对象（非裸字符串标签），
      // kind='Webview' + 本 webview 标签 → 事件只送目标，本窗 listen 收到且
      // payload 逐字段相符。kind='Any' 的字符串形式已由既有 emit 用例盖。
      const label = getCurrentWebview().label;
      let received: any = null;
      const unlisten = await listen('sow-emitto-evt', (event) => {
        received = event.payload;
      });
      await emitTo({ kind: 'Webview', label }, 'sow-emitto-evt', { v: 42, tag: 'sow' });
      await new Promise((r) => setTimeout(r, 100));
      unlisten();
      assert(received !== null, 'emitTo target listener did not receive event');
      assert(received.v === 42 && received.tag === 'sow',
        `unexpected emitTo payload: ${JSON.stringify(received)}`);
    },
  },

  // @tauri-apps/api/window
  {
    name: '@tauri-apps/api/window.getCurrentWindow',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      assert(win !== null && win !== undefined, 'getCurrentWindow returned null');
      assert(typeof win.label === 'string' && win.label.length > 0, `window.label should be non-empty string, got "${win.label}"`);
    },
  },
  {
    name: '@tauri-apps/api/window.isFocused',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      const focused = await win.isFocused();
      assert(typeof focused === 'boolean', `isFocused returned ${typeof focused}, expected boolean`);
      // Note: on some platforms (e.g. OHOS) the window may not have focus
      // immediately after launch, so we don't assert focused === true.
      // The key verification is that the IPC round-trip works and returns a valid boolean.
    },
  },
  {
    name: '@tauri-apps/api/window.currentMonitor',
    category: 'auto',
    async fn() {
      await skipOnMobile('the currentMonitor window command is upstream cfg(desktop) and absent from the mobile build');
      const monitor = await currentMonitor();
      assert(monitor !== null && monitor !== undefined, 'currentMonitor returned null (device should always have a display)');
      assert(typeof monitor.size.width === 'number' && monitor.size.width > 0, `monitor.size.width should be positive, got ${monitor.size.width}`);
      assert(typeof monitor.size.height === 'number' && monitor.size.height > 0, `monitor.size.height should be positive, got ${monitor.size.height}`);
      assert(typeof monitor.position.x === 'number', `monitor.position.x should be a number, got ${monitor.position.x}`);
      assert(typeof monitor.position.y === 'number', `monitor.position.y should be a number, got ${monitor.position.y}`);
    },
  },
  {
    name: '@tauri-apps/api/window.availableMonitors',
    category: 'auto',
    async fn() {
      await skipOnMobile('the availableMonitors window command is upstream cfg(desktop) and absent from the mobile build');
      // C1a 平移自 cov 层 wox monitors 批（SOW §一 S1-072「获取可用显示器」，2026-11-10）：
      // 数组形态 + 每项字段断言（wox:65/73 原 Array.isArray 收紧为逐项形态）
      const monitors = await availableMonitors();
      assert(Array.isArray(monitors), `availableMonitors should resolve to an array, got: ${monitors}`);
      assert(monitors.length > 0, `availableMonitors array should be non-empty on a device with a display, got ${monitors.length}`);
      for (const m of monitors) {
        assert(typeof m.name === 'string', `monitor.name should be a string, got ${typeof m.name}`);
        assert(typeof m.size.width === 'number' && m.size.width > 0, `monitor.size.width should be positive, got ${m.size.width}`);
        assert(typeof m.scaleFactor === 'number' && m.scaleFactor > 0, `monitor.scaleFactor should be positive, got ${m.scaleFactor}`);
        assert(m.position !== undefined, 'monitor.position should be present');
      }
    },
  },

  // ── C3 批（SOW §一 auto 7 条，2026-11-10）──
  {
    name: '@tauri-apps/api/window.primaryMonitor (null-or-valid contract)',
    category: 'auto',
    async fn() {
      await skipOnMobile('the primaryMonitor window command is upstream cfg(desktop) and absent from the mobile build');
      // S1-073「获取主显示器」：null-or-合法契约（OHOS 可能不报 primary——null 不假失败）
      const monitor = await primaryMonitor();
      if (monitor === null || monitor === undefined) {
        // 契约允许：无主显示器概念时返回 null（不硬失败）
        return;
      }
      assert(typeof monitor.size.width === 'number' && monitor.size.width > 0, `monitor.size.width should be positive, got ${monitor.size.width}`);
      assert(typeof monitor.size.height === 'number' && monitor.size.height > 0, `monitor.size.height should be positive, got ${monitor.size.height}`);
      assert(typeof monitor.scaleFactor === 'number' && monitor.scaleFactor > 0, `monitor.scaleFactor should be positive, got ${monitor.scaleFactor}`);
    },
  },
  {
    name: 'window.setTitle+title round-trip',
    category: 'side-effect',
    async fn() {
      await skipOnMobile('the setTitle window command is upstream cfg(desktop) and absent from the mobile build');
      // S1-029「读取窗口标题」：setTitle 派发（tao set_title→API 15 set_window_title）；
      // fix 批② 实装 title() cache-on-set 读回（tao 桥无同步查询，set_title 写
      // app-owned 缓存镜像，title() 读回；从未 set 过=空串保持前行为）→
      // read===marker 全等断言臂激活；read==='' 仅在缓存未写过时出现（本用例
      // 前 setTitle 已必然写过 → 空串即回归信号）。曾为披露缺口（getter 恒空串）。
      const win = getCurrentWindow();
      const original = await win.title();
      const marker = 'sow-title-' + Date.now();
      try {
        await win.setTitle(marker);
        await new Promise((r) => setTimeout(r, 300));
        const read = await win.title();
        if (read !== '') {
          assert(read === marker, `title() should read back "${marker}" after setTitle, got "${read}"`);
        }
        // read === ''：缓存从未写过——本用例前置 setTitle 已写过，出现即回归
      } finally {
        try { await win.setTitle(original); } catch { /* restore best-effort */ }
      }
    },
  },
  {
    name: '@tauri-apps/api/window.getAllWindows (main + created sub-window)',
    category: 'side-effect',
    timeout: 8000,
    async fn() {
      await skipOnMobile('the create_borderless_window command is cfg(desktop)-only in cmd.rs');
      // S1-052「获取所有窗口」：快照含主窗 + 建子窗后长度增长且含新 label + destroy 后回落（无僵尸注册表项）
      const before = await getAllWindows();
      assert(Array.isArray(before), `getAllWindows should resolve to array, got ${before}`);
      assert(before.some((w) => w.label === 'main'), `getAllWindows should contain the 'main' window, got labels: ${before.map((w) => w.label).join(',')}`);
      const windowId = 'test-float-allwin-' + Date.now();
      await invoke('create_borderless_window', { windowId });
      await new Promise((r) => setTimeout(r, 600));
      const win = await WebviewWindow.getByLabel(windowId);
      assert(win !== null, `float sub-window "${windowId}" not registered within the 600ms handshake window - creation race`);
      try {
        const during = await getAllWindows();
        assert(during.length >= before.length + 1, `getAllWindows length should grow by >=1 after sub-window creation, before=${before.length} during=${during.length}`);
        assert(during.some((w) => w.label === windowId), `getAllWindows should contain "${windowId}", got labels: ${during.map((w) => w.label).join(',')}`);
      } finally {
        try { await win!.destroy(); } catch { /* cleanup best-effort */ }
      }
      let after = await getAllWindows();
      const deadline = Date.now() + 2000;
      while (after.some((w) => w.label === windowId) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
        after = await getAllWindows();
      }
      assert(!after.some((w) => w.label === windowId), `destroyed window "${windowId}" still listed in getAllWindows 2000ms after destroy - zombie registry entry`);
    },
  },
  {
    name: '@tauri-apps/api/window.onThemeChanged + setTheme round-trip',
    category: 'side-effect',
    timeout: 8000,
    async fn() {
      // S1-062「监听主题变化」：onThemeChanged 事件 + setTheme 读回（降级预案：真机红→转 manual）
      const win = getCurrentWindow();
      const original = await win.theme();
      const target = original === 'dark' ? 'light' : 'dark';
      let event: string | null = null;
      const unlisten = await win.onThemeChanged(({ payload }) => { event = payload; });
      try {
        await win.setTheme(target);
        await new Promise((r) => setTimeout(r, 800));
        const read = await win.theme();
        assert(read === target, `theme() should read back "${target}" after setTheme, got "${read}"`);
        assert(event === target, `onThemeChanged should fire with "${target}" within 800ms, got ${String(event)}`);
      } finally {
        unlisten();
        try { await win.setTheme(original); } catch { /* restore best-effort */ }
      }
    },
  },
  {
    name: 'float sub-window toggleMaximize (isMaximized mirror asserted)',
    category: 'side-effect',
    timeout: 10000,
    async fn() {
      await skipOnMobile('the create_borderless_window command is cfg(desktop)-only in cmd.rs');
      // S1-066「切换子窗口最大化」：toggleMaximize → isMaximized 镜像双向
      // （float maximize 1300004/白条修复的回归臂；主窗 maximize 断言另存于 wops 区）
      const windowId = 'test-float-tmax-' + Date.now();
      await invoke('create_borderless_window', { windowId });
      await new Promise((r) => setTimeout(r, 600));
      const win = await WebviewWindow.getByLabel(windowId);
      assert(win !== null, `float sub-window "${windowId}" not registered within the 600ms handshake window - creation race`);
      try {
        await win!.toggleMaximize();
        let max = await win!.isMaximized();
        const deadline = Date.now() + 2000;
        while (!max && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 100));
          max = await win!.isMaximized();
        }
        assert(max === true, `float sub-window isMaximized should become true after toggleMaximize(), got ${max}`);
        await win!.toggleMaximize();
        let max2 = await win!.isMaximized();
        const deadline2 = Date.now() + 2000;
        while (max2 && Date.now() < deadline2) {
          await new Promise((r) => setTimeout(r, 100));
          max2 = await win!.isMaximized();
        }
        assert(max2 === false, `float sub-window isMaximized should return false after second toggleMaximize(), got ${max2}`);
      } finally {
        try { await win!.destroy(); } catch { /* cleanup best-effort */ }
      }
    },
  },
  {
    name: 'float sub-window setEnabled (OHOS rejection contract)',
    category: 'side-effect',
    timeout: 8000,
    async fn() {
      await skipOnMobile('the create_borderless_window command is cfg(desktop)-only in cmd.rs');
      // S1-067「切换启用状态」：OHOS 契约=setEnabled 显式拒绝（#225：dispatcher
      // 提前报错而非静默 no-op）；isEnabled 恒 true（window/mod.rs:40 无系统态可查）。
      // 用子窗不用主窗——万一拒绝未发生也不锁死整个 UI。
      const windowId = 'test-float-enable-' + Date.now();
      await invoke('create_borderless_window', { windowId });
      await new Promise((r) => setTimeout(r, 600));
      const win = await WebviewWindow.getByLabel(windowId);
      assert(win !== null, `float sub-window "${windowId}" not registered within the 600ms handshake window - creation race`);
      try {
        let rejected = false;
        try {
          await win!.setEnabled(false);
        } catch (e) {
          const msg = String(e);
          assert(
            /not supported on OpenHarmony/.test(msg),
            `setEnabled should reject with the documented contract message, got: ${msg}`,
          );
          rejected = true;
        }
        assert(rejected, 'setEnabled should reject on OHOS (contract per #225) — a silent success/no-op here is a regression of the honest-error family');
        assert((await win!.isEnabled()) === true, 'isEnabled should stay true on OHOS (no system enabled/disabled state, window/mod.rs:40)');
      } finally {
        try { await win!.destroy(); } catch { /* cleanup best-effort */ }
      }
    },
  },
  {
    name: '@tauri-apps/api/window.center (float sub-window recenters)',
    category: 'side-effect',
    timeout: 8000,
    async fn() {
      await skipOnMobile('the create_borderless_window command is cfg(desktop)-only in cmd.rs');
      // S1-017「窗口居中」：fix 批① 实装 WindowExt::center ohos 覆写
      // （current_monitor → calculate_window_center_position(work_area 几何)
      // → set_outer_position，与建窗期 #[cfg(desktop)] centering 同一公式）。
      // 曾为披露 no-op 契约（默认空实现：位置 40,40 不动）；实装后本用例
      // 改回几何比对——用 JS Monitor.workArea 复算同一公式，±8 物理px 容差
      // （整型取整+派发异步），currentMonitor null 时 honest skip。
      const windowId = 'test-float-center-' + Date.now();
      await invoke('create_borderless_window', { windowId });
      await new Promise((r) => setTimeout(r, 600));
      const win = await WebviewWindow.getByLabel(windowId);
      assert(win !== null, `float sub-window "${windowId}" not registered within the 600ms handshake window - creation race`);
      try {
        await win!.setPosition(new PhysicalPosition(40, 40));
        await new Promise((r) => setTimeout(r, 300));
        await win!.center();
        // 派发生效窗口（center 经 dispatcher 异步移动子窗）
        await new Promise((r) => setTimeout(r, 800));
        // currentMonitor 是模块级函数（Window 实例无此方法——首跑 #27 即
        // "t.currentMonitor is not a function"）；单显示器设备上模块级
        // currentMonitor 与子窗所在 monitor 同一 workArea。
        const monitor = await currentMonitor();
        if (monitor === null) {
          skip('currentMonitor() returned null on this device — center geometry unjudgeable');
        }
        const pos = await win!.outerPosition();
        const size = await win!.outerSize();
        const wa = monitor!.workArea;
        const expectX = Math.round((wa.size.width - size.width) / 2) + wa.position.x;
        const expectY = Math.round((wa.size.height - size.height) / 2) + wa.position.y;
        assert(
          Math.abs(pos.x - expectX) <= 8 && Math.abs(pos.y - expectY) <= 8,
          `window.center(): position (${pos.x},${pos.y}) ≠ work-area center (${expectX},${expectY}) ±8 physical px — center() not applied or wrong geometry (window ${size.width}×${size.height}, work area ${wa.size.width}×${wa.size.height} @ ${wa.position.x},${wa.position.y})`,
        );
      } finally {
        try { await win!.destroy(); } catch { /* cleanup best-effort */ }
      }
    },
  },

  // ── C3 批（SOW §一 manual 6 条锚点，2026-11-10）──
  // 判据=无 getter 的纯视觉/系统交互形态（SOW §一 S1-018/037/040/042/061/088）。
  // wrapManual 字面量与 name 逐字一致；判据见 manual_tests.md §三十六追加行。
  {
    name: 'window.setZoom (1.5x visual)',
    category: 'manual',
    async fn() {},
  },
  {
    name: 'window.setSkipTaskbar (taskbar icon toggle)',
    category: 'manual',
    async fn() {},
  },
  {
    name: 'window.setShadow (visual toggle)',
    category: 'manual',
    async fn() {},
  },
  {
    name: 'window.setIcon (1x1 PNG)',
    category: 'manual',
    async fn() {},
  },
  {
    name: 'window.onScaleChanged (system display settings)',
    category: 'manual',
    async fn() {},
  },
  {
    name: 'window.startDragging (mouse drag)',
    category: 'manual',
    async fn() {},
  },

  // @tauri-apps/api/webview
  {
    name: '@tauri-apps/api/webview.getCurrentWebview',
    category: 'auto',
    async fn() {
      const webview = getCurrentWebview();
      assert(webview !== null && webview !== undefined, 'getCurrentWebview returned null');
      assert(typeof webview.label === 'string' && webview.label.length > 0, `webview.label should be non-empty string, got "${webview.label}"`);
    },
  },

  // ── C4 批（SOW §二 子 Webview manual 3 条锚点，2026-11-10）──
  // 判据=子 Webview 级形态（S2-032/034/035）——与 §一 window 级同名 API 的差别
  // 在作用对象：本批按钮在子 Webview 上派发。wrapManual 字面量与 name 逐字一致；
  // 判据见 manual_tests.md §四十二追加行。
  {
    name: 'webview.setZoom (child webview 1.5x visual)',
    category: 'manual',
    async fn() {},
  },
  {
    name: 'webview.setFocus (child webview z-order)',
    category: 'manual',
    async fn() {},
  },
  {
    name: 'webview.hide+show (child webview)',
    category: 'manual',
    async fn() {},
  },

  // ── fix 批⑤（S1-018/S2-032 绝对语义复验锚点，2026-11-10）──
  // wry 侧 target/current 换算落地后 setZoom(1.0)=复位 100% 成为修复后契约；
  // 判据见 manual_tests.md §36.12（新复验行——已归一的旧相对语义披露行不动）。
  {
    name: 'webview.setZoom (child abs round-trip 1.5→1.0)',
    category: 'manual',
    async fn() {},
  },

  // @tauri-apps/api/path
  {
    name: '@tauri-apps/api/path.appCacheDir',
    category: 'auto',
    async fn() {
      const dir = await appCacheDir();
      assert(typeof dir === 'string' && dir.length > 0, `expected non-empty path, got "${dir}"`);
      assert(dir.includes('/') || dir.includes('\\'), `path should contain separator, got "${dir}"`);
      assert(dir.toLowerCase().includes('cache'), `path should contain "cache" segment, got "${dir}"`);
    },
  },

  // @tauri-apps/api/path 纯函数（C1a 平移自 api-gap cov 批，断言同源；SOW §三 S3-041~S3-046，2026-11-10）
  {
    name: '@tauri-apps/api/path.basename',
    category: 'auto',
    async fn() {
      const b = await basename('/a/b/c.txt');
      assert(b === 'c.txt', `basename should be c.txt, got ${b}`);
    },
  },
  {
    name: '@tauri-apps/api/path.dirname',
    category: 'auto',
    async fn() {
      const d = await dirname('/a/b/c.txt');
      assert(d === '/a/b', `dirname should be /a/b, got ${d}`);
    },
  },
  {
    name: '@tauri-apps/api/path.extname',
    category: 'auto',
    async fn() {
      // Rust Path::extension 语义：无前导点（"txt"），与 Node path.extname（".txt"）不同
      const e = await extname('/a/b/c.txt');
      assert(e === 'txt', `extname should be txt, got ${e}`);
    },
  },
  {
    name: '@tauri-apps/api/path.isAbsolute',
    category: 'auto',
    async fn() {
      assert((await isAbsolute('/a')) === true, 'isAbsolute(/a) should be true');
      assert((await isAbsolute('a')) === false, 'isAbsolute(a) should be false');
    },
  },
  {
    name: '@tauri-apps/api/path.normalize',
    category: 'auto',
    async fn() {
      const n = await normalize('/a/./b/../c');
      assert(n === '/a/c', `normalize should be /a/c, got ${n}`);
    },
  },
  {
    name: '@tauri-apps/api/path.resolve',
    category: 'auto',
    async fn() {
      const r = await resolve('a', 'b');
      assert((await isAbsolute(r)) === true, `resolve result should be absolute, got ${r}`);
    },
  },

  // @tauri-apps/api/path 目录 API（C1b 新断言批，SOW §三 S3-048/S3-050~S3-058/S3-060，2026-11-10）。
  // 断言形态：assertDirPath（非空+绝对通用腿 + el2 严格尾部，模块段可选见其头注勘误）；
  // files 四兄弟两两交叉（appConfigDir===appLocalDataDir、configDir===dataDir，OHOS 同映射契约）。
  {
    name: '@tauri-apps/api/path.appConfigDir',
    category: 'auto',
    async fn() {
      const dir = await appConfigDir();
      await assertDirPath(dir, 'files', 'appConfigDir');
      // OHOS 同映射交叉：appConfigDir 与 appLocalDataDir 都指向 …/files（模块级 el2 形态）
      const sibling = await appLocalDataDir();
      assert(dir === sibling, `appConfigDir should equal appLocalDataDir on OHOS, got "${dir}" vs "${sibling}"`);
    },
  },
  {
    name: '@tauri-apps/api/path.appLocalDataDir',
    category: 'auto',
    async fn() {
      const dir = await appLocalDataDir();
      await assertDirPath(dir, 'files', 'appLocalDataDir');
    },
  },
  {
    name: '@tauri-apps/api/path.appLogDir',
    category: 'auto',
    async fn() {
      const dir = await appLogDir();
      await assertDirPath(dir, 'log', 'appLogDir');
    },
  },
  {
    name: '@tauri-apps/api/path.audioDir',
    category: 'auto',
    async fn() {
      const dir = await audioDir();
      await assertDirPath(dir, 'files/Audio', 'audioDir');
    },
  },
  {
    name: '@tauri-apps/api/path.configDir',
    category: 'auto',
    async fn() {
      const dir = await configDir();
      await assertDirPath(dir, 'files', 'configDir');
      // OHOS 同映射交叉：configDir 与 dataDir 都指向 …/files（模块级 el2 形态）
      const sibling = await dataDir();
      assert(dir === sibling, `configDir should equal dataDir on OHOS, got "${dir}" vs "${sibling}"`);
    },
  },
  {
    name: '@tauri-apps/api/path.dataDir',
    category: 'auto',
    async fn() {
      const dir = await dataDir();
      await assertDirPath(dir, 'files', 'dataDir');
    },
  },
  {
    name: '@tauri-apps/api/path.documentDir',
    category: 'auto',
    async fn() {
      const dir = await documentDir();
      await assertDirPath(dir, 'files/Documents', 'documentDir');
    },
  },
  {
    name: '@tauri-apps/api/path.downloadDir',
    category: 'auto',
    async fn() {
      const dir = await downloadDir();
      await assertDirPath(dir, 'files/Download', 'downloadDir');
    },
  },
  {
    name: '@tauri-apps/api/path.pictureDir',
    category: 'auto',
    async fn() {
      const dir = await pictureDir();
      await assertDirPath(dir, 'files/Pictures', 'pictureDir');
    },
  },
  {
    name: '@tauri-apps/api/path.tempDir',
    category: 'auto',
    async fn() {
      const dir = await tempDir();
      await assertDirPath(dir, 'temp', 'tempDir');
    },
  },
  {
    name: '@tauri-apps/api/path.runtimeDir (OHOS defined-absent, android-aligned)',
    category: 'auto',
    async fn() {
      // S3-060：BaseDirectory::Runtime 在 Rust 侧被 cfg(not(android),
      // not(ohos)) 摘除（path/mod.rs:175，与上游 Android 同款定义性缺席）——
      // JS 层 invoke 目录号 22 无法反序列化，必然拒绝。断言=干净拒绝（拿到
      // 后端错误）；resolve 或挂起才是失败。cov 层 driver: path.runtimeDir
      // 经 blind() 包装吞掉拒绝，不构成本条证据。
      let rejected = false;
      let msg = '';
      try {
        await runtimeDir();
      } catch (e: any) {
        rejected = true;
        msg = String(e?.message ?? e);
      }
      assert(rejected, 'runtimeDir() should reject on OHOS — BaseDirectory::Runtime is cfg-gated out (android-aligned); a resolve would mean the enum leaked');
      assert(msg.length > 0, 'rejection should carry a backend error message');
    },
  },

  // @tauri-apps/api/core - Resource
  {
    name: '@tauri-apps/api/core.Resource',
    category: 'auto',
    async fn() {
      assert(typeof Resource === 'function', 'Resource is not a constructor');
      assert(typeof Resource.prototype.close === 'function', 'Resource.prototype.close is not a function');

      // Test the Counter resource
      class TestCounter extends Resource {
        static async create(): Promise<TestCounter> {
          const rid: number = await invoke('create_counter');
          return new TestCounter(rid);
        }

        async increment(): Promise<number> {
          return invoke('increment_counter', { rid: this.rid });
        }

        async getValue(): Promise<number> {
          return invoke('get_counter_value', { rid: this.rid });
        }
      }

      const counter = await TestCounter.create();
      const v1 = await counter.increment();
      assert(v1 === 1, `expected 1, got ${v1}`);
      const v2 = await counter.increment();
      assert(v2 === 2, `expected 2, got ${v2}`);
      const current = await counter.getValue();
      assert(current === 2, `expected 2, got ${current}`);
      await counter.close();
    },
  },

  // @tauri-apps/api/window - onFocusChanged
  {
    name: '@tauri-apps/api/window.onFocusChanged',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      // Subscribe and unsubscribe twice to verify both directions work and
      // unlisten is idempotent — a broken event wiring would throw here.
      const unlisten1 = await win.onFocusChanged(() => {});
      assert(typeof unlisten1 === 'function', 'onFocusChanged did not return an unlisten function');
      unlisten1();
      const unlisten2 = await win.onFocusChanged(() => {});
      assert(typeof unlisten2 === 'function', 'second onFocusChanged did not return an unlisten function');
      unlisten2();
    },
  },

  // Section 12: Global objects
  {
    name: 'window.__TAURI_INTERNALS__',
    category: 'auto',
    async fn() {
      const internals = (window as any).__TAURI_INTERNALS__;
      assert(internals !== undefined && internals !== null, '__TAURI_INTERNALS__ is not defined');
      assert(typeof internals === 'object', `__TAURI_INTERNALS__ is ${typeof internals}, expected object`);
    },
  },
  {
    name: 'window.__TAURI__',
    category: 'auto',
    async fn() {
      const tauri = (window as any).__TAURI__;
      assert(tauri !== undefined && tauri !== null, '__TAURI__ is not defined');
      assert(typeof tauri === 'object', `__TAURI__ is ${typeof tauri}, expected object`);
    },
  },

  // @tauri-apps/api URI scheme protocols
  {
    name: 'register_uri_scheme_protocol (sync)',
    category: 'auto',
    async fn() {
      // Test sync custom protocol using iframe + postMessage
      const result = await testCustomProtocol('myapp://localhost/test/path');
      assert(result.ok, `expected ok response, got error: ${result.error}`);
    },
  },
  {
    name: 'register_asynchronous_uri_scheme_protocol (async)',
    category: 'auto',
    async fn() {
      // Test async custom protocol using iframe + postMessage
      const result = await testCustomProtocol('myapp-async://localhost/test/async');
      assert(result.ok, `expected ok response, got error: ${result.error}`);
    },
  },

  // .append_invoke_initialization_script test
  {
    name: 'append_invoke_initialization_script',
    category: 'auto',
    async fn() {
      // Check if the initialization script ran
      const initScriptRan = (window as any).__TAURI_TEST_INIT_SCRIPT_RAN;
      assert(initScriptRan === true, 'Initialization script should have run');

      // Test that append_invoke_initialization_script successfully modified __TAURI_INTERNALS__
      const testProp = (window as any).__TAURI_INTERNALS__?.__TEST_INVOKE_INIT_SCRIPT__;
      assert(testProp === 'executed', `Expected '__TEST_INVOKE_INIT_SCRIPT__' to be 'executed', got ${testProp}`);
    },
  },

  // Web Storage: localStorage
  {
    name: 'localStorage set/get/remove',
    category: 'auto',
    async fn() {
      const key = '__tauri_test_ls__';
      localStorage.setItem(key, 'hello');
      const val = localStorage.getItem(key);
      assert(val === 'hello', `expected 'hello', got '${val}'`);
      localStorage.removeItem(key);
      const after = localStorage.getItem(key);
      assert(after === null, `expected null after remove, got '${after}'`);
    },
  },

  // .on_window_event test
  {
    name: 'on_window_event',
    category: 'auto',
    async fn() {
      // Clear previous events
      await invoke('clear_tracked_events');

      // Trigger some window events
      const window = getCurrentWindow();

      // Set title to trigger event
      await window.setTitle('Test Title');
      await new Promise((r) => setTimeout(r, 100));

      // Get tracked events
      const events = await invoke('get_tracked_window_events') as string[];

      // Verify we got some events (at minimum, we should see Resized or something similar)
      // The exact events may vary by platform
      assert(Array.isArray(events), 'Should receive array of events');
      assert(events.length >= 0, 'Event array should be valid');
    },
  },

  // .on_menu_event test (note: menu events are from tray menu, which we don't trigger programmatically)
  // We'll just verify that the infrastructure is there
  {
    name: 'on_menu_event_infrastructure',
    category: 'auto',
    async fn() {
      // 1. Verify we can call the menu event tracking command
      await invoke('clear_tracked_events');
      const events = await invoke('get_tracked_menu_events') as string[];
      assert(Array.isArray(events), 'Should receive array of events');
      assert(events.length === 0, `Should be empty after clear, got ${events.length}`);
    },
  },

  // Test app_handle.get_webview_window() via test_eval command
  {
    name: 'app_handle.get_webview_window (test_eval)',
    category: 'auto',
    async fn() {
      // Store original title
      const originalTitle = document.title;

      // Invoke the command which uses app.get_webview_window("main") internally
      await invoke('test_eval');

      // Wait a bit for the eval to take effect
      await new Promise((r) => setTimeout(r, 100));

      // Verify the window title was changed by the eval script
      assert(document.title.includes('Eval Success'), `Expected document.title to contain 'Eval Success', got "${document.title}"`);

      // Restore original title
      document.title = originalTitle;
    },
  },

  // Test eval_with_callback: Rust evaluates JS and receives result back
  {
    name: 'webview.eval_with_callback',
    category: 'auto',
    async fn() {
      const resultPromise = new Promise<any>((resolve) => {
        const unlisten = listen('eval-with-callback-result', (event) => {
          unlisten.then((fn) => fn());
          // payload arrives as a JSON string; parse it into an object
          const parsed = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
          resolve(parsed);
        });
      });

      await invoke('test_eval_with_callback');

      const result = await resultPromise;
      assert(result.arithmetic === 3, `Expected arithmetic=3, got ${result.arithmetic}`);
      assert(result.stringLen === 5, `Expected stringLen=5, got ${result.stringLen}`);
      assert(result.bool === true, `Expected bool=true, got ${result.bool}`);
    },
  },

  // Test web_page_snapshot on OHOS: captures WebView content as RGBA bitmap.
  // Timeout 20s: the ArkTS webPageSnapshot() path has a 500ms initial delay +
  // up to 3 retries (500ms apart) + the OHOS WebviewController snapshot call itself,
  // routinely landing near 4.8–5s — too close to the 5s global default (flaky fail).
  {
    name: 'webview.webPageSnapshot',
    category: 'auto',
    timeout: 20000,
    async fn() {
      const resultPromise = new Promise<any>((resolve) => {
        const unlisten = listen('web-page-snapshot-result', (event) => {
          unlisten.then((fn) => fn());
          resolve(event.payload);
        });
        // Timeout: if event never fires, resolve with error after 10s
        setTimeout(() => {
          unlisten.then((fn) => fn());
          resolve({ success: false, error: 'Timeout: no snapshot result within 10s' });
        }, 10000);
      });

      await invoke('test_web_page_snapshot');

      const result = await resultPromise;
      assert(result.success === true, `webPageSnapshot failed: ${result.error || 'unknown error'}`);
      assert(result.width > 0, `Expected width > 0, got ${result.width}`);
      assert(result.height > 0, `Expected height > 0, got ${result.height}`);
      // The backend uses capture_webview (base64 PNG) — web_page_snapshot omits
      // the RGBA buffer for NAPI efficiency, so assert on png_base64 instead.
      assert(typeof result.png_base64 === 'string' && result.png_base64.length > 0,
        `Expected non-empty png_base64, got ${typeof result.png_base64}`);
    },
  },

  // Test app_handle.emit
  {
    name: 'app_handle.emit',
    category: 'auto',
    async fn() {
      let received: any = null;
      console.log('[DBG emit] before listen');
      const unlisten = await listen('test-emit-event', (event) => {
        console.log('[DBG emit] listener fired, payload=', event.payload);
        received = event.payload;
      });
      console.log('[DBG emit] listen resolved, unlisten=', typeof unlisten);
      try {
        console.log('[DBG emit] before invoke emit_test_event');
        await invoke('emit_test_event');
        console.log('[DBG emit] invoke emit_test_event resolved');
        // Wait for event propagation
        await new Promise((r) => setTimeout(r, 100));
        console.log('[DBG emit] after wait, received=', received);
        assert(received === 'hello from rust', `Expected 'hello from rust', got ${received}`);
      } finally {
        unlisten();
      }
    },
  },

  // Test app_handle.listen
  {
    name: 'app_handle.listen',
    category: 'auto',
    async fn() {
      let received: any = null;
      const unlisten = await listen('app-listen-response', (event) => {
        received = event.payload;
      });
      try {
        // Setup the listener on Rust side
        await invoke('setup_app_listener');
        // Emit the event that Rust is listening for
        await emit('app-listen-test');
        // Wait for Rust to process and respond
        await new Promise((r) => setTimeout(r, 100));
        assert(received === 'heard you', `Expected 'heard you', got ${received}`);
      } finally {
        unlisten();
      }
    },
  },

  // Test tauri::async_runtime::spawn
  {
    name: 'tauri::async_runtime::spawn',
    category: 'auto',
    async fn() {
      let received: any = null;
      const unlisten = await listen('spawn-completed', (event) => {
        received = event.payload;
      });
      try {
        await invoke('test_async_spawn');
        // Wait for the spawned task to complete
        await new Promise((r) => setTimeout(r, 200));
        assert(received === 'async done', `Expected 'async done', got ${received}`);
      } finally {
        unlisten();
      }
    },
  },

  // Test on_page_load (on_page_begin / on_page_end)
  {
    name: 'on_page_load events',
    category: 'auto',
    async fn() {
      let startedUrl: string | null = null;
      let finishedUrl: string | null = null;

      const unlistenStart = await listen('page-load-started', (event) => {
        startedUrl = event.payload as string;
      });
      const unlistenFinish = await listen('page-load-finished', (event) => {
        finishedUrl = event.payload as string;
      });

      let actualLabel: string | null = null;
      try {
        // Trigger a page load by creating a new window
        actualLabel = await invoke<string>('create_isolated_window', {
          windowId: 'test-page-load-window',
          dataSuffix: 'test',
          url: '/hello.html'
        });

        // Wait for events to propagate
        await new Promise((r) => setTimeout(r, 1000));

        // Verify events were received
        assert(startedUrl !== null, 'Expected page-load-started event');
        assert(finishedUrl !== null, 'Expected page-load-finished event');

        // Optional: verify URL contains something expected (e.g. index.html)
        assert(startedUrl!.length > 0, 'Started URL should not be empty');
        assert(finishedUrl!.length > 0, 'Finished URL should not be empty');
      } finally {
        unlistenStart();
        unlistenFinish();
        // Intentionally NOT closing the window here — leave it on screen for the
        // user to clean up via the "Close All Test Windows" button. Closing in
        // autotest left ghost windows on OHOS (tao close is no-op) and cluttered
        // the screen mid-run. The button calls close_all_test_windows which goes
        // through the framework on_window_close → destroy_window path.
      }
    },
  },

  // Test on_navigation interceptor
  {
    name: 'on_navigation interceptor',
    category: 'auto',
    async fn() {
      let interceptedUrl: string | null = null;
      const unlisten = await listen('navigation-intercepted', (event) => {
        interceptedUrl = event.payload as string;
      });

      let actualLabel: string | null = null;
      try {
        // Create a new window to trigger on_navigation in that webview
        actualLabel = await invoke<string>('create_isolated_window', {
          windowId: 'test-nav-window',
          dataSuffix: 'nav',
          url: '/hello.html'
        });

        // Wait for the window to load and trigger on_navigation
        await new Promise((r) => setTimeout(r, 1500));

        assert(interceptedUrl !== null, 'Expected navigation-intercepted event to fire when window loads');
        assert(interceptedUrl!.length > 0, 'Intercepted URL should not be empty');
      } finally {
        unlisten();
        // Intentionally NOT closing the window — leave it for manual Close All cleanup.
      }
    },
  },

  // Test on_document_title_changed
  {
    name: 'on_document_title_changed',
    category: 'auto',
    async fn() {
      let changedTitle: string | null = null;
      const unlisten = await listen('document-title-changed', (event) => {
        changedTitle = event.payload as string;
      });

      let actualLabel: string | null = null;
      try {
        // Create a new window with initialization script that sets a title
        actualLabel = await invoke<string>('create_isolated_window', {
          windowId: 'test-title-window',
          dataSuffix: 'title',
          url: '/hello.html'
        });

        // Wait for the window to load and title change event
        await new Promise((r) => setTimeout(r, 1500));

        assert(changedTitle !== null, 'Expected document-title-changed event to fire');
        assert(changedTitle!.length > 0, 'Title should not be empty');
      } finally {
        unlisten();
        // Intentionally NOT closing the window — leave it for manual Close All cleanup.
      }
    },
  },

  // RunEvent lifecycle tracking
  {
    name: 'RunEvent::Ready fires on startup',
    category: 'auto',
    async fn() {
      const events = await invoke('get_tracked_run_events') as string[];
      assert(Array.isArray(events), 'Should receive array of run events');
      assert(events.includes('Ready'), `Ready should be in tracked events, got: ${JSON.stringify(events)}`);
    },
  },
  {
    name: 'RunEvent::MainEventsCleared fires',
    category: 'auto',
    async fn() {
      // Clear previous events first to get a fresh baseline
      await invoke('clear_tracked_events');
      // Trigger a window title change to force event loop iteration
      await getCurrentWindow().setTitle('Test Title for RunEvent');
      await new Promise((r) => setTimeout(r, 100));
      const events = await invoke('get_tracked_run_events') as string[];
      assert(events.includes('MainEventsCleared'), `MainEventsCleared should be in tracked events, got: ${JSON.stringify(events)}`);
    },
  },
  {
    name: 'RunEvent::Resumed fires on startup',
    category: 'auto',
    async fn() {
      const events = await invoke('get_tracked_run_events') as string[];
      assert(events.includes('Resumed'), `Resumed should be in tracked events, got: ${JSON.stringify(events)}`);
    },
  },
  {
    name: 'RunEvent::WindowEvent::CloseRequested fires',
    category: 'auto',
    async fn() {
      // Create a new window, then close it — this triggers CloseRequested
      // Rust returns the actual label (windowId + sequence number) for getByLabel lookup
      const actualLabel = await invoke<string>('create_isolated_window', {
        windowId: 'test-close-req',
        dataSuffix: 'close',
        url: '/hello.html',
      });
      await new Promise((r) => setTimeout(r, 1000));
      // Close the window — triggers WindowEvent::CloseRequested
      const win = await WebviewWindow.getByLabel(actualLabel);
      if (win) {
        await win.close();
      }
      await new Promise((r) => setTimeout(r, 500));
      const events = await invoke('get_tracked_run_events') as string[];
      assert(
        events.includes('WindowEvent::CloseRequested'),
        `WindowEvent::CloseRequested should be in tracked events, got: ${JSON.stringify(events)}`,
      );
    },
  },
  {
    name: 'RunEvent::WindowEvent::Destroyed fires',
    category: 'auto',
    async fn() {
      // Create a new window, then close it — this triggers both CloseRequested and Destroyed
      // After Phase 2 fix: close() → CloseRequested → on_window_close → Destroyed
      const actualLabel = await invoke<string>('create_isolated_window', {
        windowId: 'test-destroyed',
        dataSuffix: 'destroy',
        url: '/hello.html',
      });
      await new Promise((r) => setTimeout(r, 1000));
      // Close the window — triggers WindowEvent::CloseRequested then WindowEvent::Destroyed
      const win = await WebviewWindow.getByLabel(actualLabel);
      if (win) {
        await win.close();
      }
      await new Promise((r) => setTimeout(r, 500));
      const events = await invoke('get_tracked_run_events') as string[];
      assert(
        events.includes('WindowEvent::Destroyed'),
        `WindowEvent::Destroyed should be in tracked events, got: ${JSON.stringify(events)}`,
      );
      // Also verify CloseRequested was fired before Destroyed.
      // run_events 是 app 启动以来不清空的全局账（clear_tracked_events 刻意不动它，
      // Ready 只发一次），而本套件其他用例会 destroy() 子窗——destroy 只发 Destroyed
      // 不发 CloseRequested。indexOf 会拿到别人的 Destroyed → 必须用 lastIndexOf
      // 断言「最近一次关窗链路」：本用例自己的 CloseRequested → Destroyed。
      const closeReqIdx = events.lastIndexOf('WindowEvent::CloseRequested');
      const destroyedIdx = events.lastIndexOf('WindowEvent::Destroyed');
      assert(
        closeReqIdx !== -1 && destroyedIdx !== -1 && closeReqIdx < destroyedIdx,
        `the latest close chain should be WindowEvent::CloseRequested before WindowEvent::Destroyed, got closeReqIdx=${closeReqIdx} destroyedIdx=${destroyedIdx} (of ${events.length} tracked events)`,
      );
    },
  },
  {
    name: 'RunEvent::Opened (manual — requires deep link)',
    category: 'manual',
    async fn() {
      // Opened requires OS-level NewWant (deep link), cannot be triggered programmatically.
      // The event tracking infrastructure is verified by Ready/MainEventsCleared/Resumed tests.
      // To test manually: launch the app via deep link (e.g., hdc shell aa start -a EntryAbility -b com.tauri.api -U myapp://test)
    },
  },

  // ─── Window Decorations (Phase 2) ───
  {
    name: 'window.isDecorated returns boolean',
    category: 'auto',
    async fn() {
      await skipOnMobile('the isDecorated window command is upstream cfg(desktop) and absent from the mobile build');
      const win = getCurrentWindow();
      const decorated = await win.isDecorated();
      assert(typeof decorated === 'boolean', `isDecorated() should return boolean, got ${typeof decorated}`);
    },
  },
  {
    name: 'window.setDecorations toggles decorations state',
    category: 'side-effect',
    async fn() {
      await skipOnMobile('the setDecorations window command is upstream cfg(desktop) and absent from the mobile build');
      const win = getCurrentWindow();
      // Save original state
      const original = await win.isDecorated();
      // Toggle off
      await win.setDecorations(false);
      const afterOff = await win.isDecorated();
      assert(afterOff === false, `After setDecorations(false), isDecorated() should be false, got ${afterOff}`);
      // Toggle back on
      await win.setDecorations(true);
      const afterOn = await win.isDecorated();
      assert(afterOn === true, `After setDecorations(true), isDecorated() should be true, got ${afterOn}`);
      // Restore original
      await win.setDecorations(original);
    },
  },

  // ─── Create Borderless Window (Phase 2 integration) ───
  {
    name: 'create_borderless_window command',
    category: 'side-effect',
    async fn() {
      await skipOnMobile('the create_borderless_window command is cfg(desktop)-only in cmd.rs');
      const windowId = 'test-borderless-' + Date.now();
      await invoke('create_borderless_window', { windowId });
      // Wait for window to be created
      await new Promise((r) => setTimeout(r, 500));
      // Verify window exists
      const win = await WebviewWindow.getByLabel(windowId);
      assert(win !== null, `Borderless window "${windowId}" should exist`);
      // Verify decorations are off
      const decorated = await win!.isDecorated();
      assert(decorated === false, `Borderless window should have decorations=false, got ${decorated}`);
      // Intentionally NOT closing — leave for manual Close All cleanup.
    },
  },

  // ─── Create Transparent Borderless Window (Phase 1+2+3 integration) ───
  {
    name: 'create_transparent_borderless_window command',
    category: 'side-effect',
    async fn() {
      await skipOnMobile('the create_transparent_borderless_window command is cfg(desktop)-only in cmd.rs');
      const windowId = 'test-transparent-borderless-' + Date.now();
      await invoke('create_transparent_borderless_window', { windowId });
      // Wait for window to be created
      await new Promise((r) => setTimeout(r, 500));
      // Verify window exists
      const win = await WebviewWindow.getByLabel(windowId);
      assert(win !== null, `Transparent borderless window "${windowId}" should exist`);
      // Verify decorations are off
      const decorated = await win!.isDecorated();
      assert(decorated === false, `Transparent borderless window should have decorations=false, got ${decorated}`);
      // Intentionally NOT closing — leave for manual Close All cleanup.
    },
  },

  // ─── Float sub-window hide + show + center（C1a 平移自 cov 层 float.hide+show+center
  // smoke，SOW §一 S1-069「隐藏显示居中子窗口」，2026-11-10）───
  // 断言集与 cov 原条目同源：hide() 必 resolve（#237/#241 kind-split——子窗分支，
  // reject=主窗 hide 门泄漏到子窗即 FAIL）+ isVisible 镜像 2s 轮询读 false +
  // show() 复原 + center() 重居中。ArkTS 侧 apply 判别器套件层不可构造（smoke，
  // 详见 driver-generated.ts 原条目内决策注释）。destroy 挂 finally 全路径兜底。
  {
    name: 'float sub-window hide+show+center (visibility mirror asserted)',
    category: 'side-effect',
    timeout: 8000,
    async fn() {
      await skipOnMobile('the create_borderless_window command is cfg(desktop)-only in cmd.rs');
      const windowId = 'test-float-hsc-' + Date.now();
      await invoke('create_borderless_window', { windowId });
      // creation/registration handshake settle（同 cov 原条目 600ms）
      await new Promise((r) => setTimeout(r, 600));
      const win = await WebviewWindow.getByLabel(windowId);
      assert(win !== null, `float sub-window "${windowId}" not registered within the 600ms handshake window - creation race`);
      try {
        // hide() on a FLOAT SUB-WINDOW must resolve（kind-split 子窗分支）；
        // reject = 主窗 hide 门泄漏到子窗（#237/#241 修复回归臂）
        await win!.hide();
        // isVisible() 读 tao Rust 侧可见性镜像；set_visible(false) 在 ArkTS 派发
        // 前急切写镜像，首轮轮询通常已见 false——2s 循环仅为竞态容忍
        let visible = await win!.isVisible();
        const deadline = Date.now() + 2000;
        while (visible && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 100));
          visible = await win!.isVisible();
        }
        assert(visible === false, `float sub-window "${windowId}" still isVisible()=true 2000ms after hide() resolved - visibility mirror never read false（either a gate leak, or a windowStatusChange backfill re-set it）`);
        await win!.show();
        await new Promise((r) => setTimeout(r, 300));
        await win!.center();
      } finally {
        // 全路径销毁探针子窗——失败轮不可向后续用例泄漏（cov 原条目 F6 兜底同源）
        try {
          await win!.destroy();
        } catch (cleanupErr) {
          console.warn(`float hide+show+center: cleanup destroy failed (leftover window "${windowId}"): ${String((cleanupErr as Error)?.message ?? cleanupErr)}`);
        }
      }
    },
  },

  // ─── OHOS Window Operations (ohos-window-ops) ───
  // NOTE: side-effect tests temporarily disabled to diagnose bottom content cutoff issue
  {
    name: 'window.is_maximized returns boolean',
    category: 'auto',
    async fn() {
      await skipOnMobile('the isMaximized window command is upstream cfg(desktop) and absent from the mobile build');
      const win = getCurrentWindow();
      const maximized = await win.isMaximized();
      assert(typeof maximized === 'boolean', `isMaximized() should return boolean, got ${typeof maximized}`);
    },
  },
  {
    name: 'window.is_minimized returns boolean',
    category: 'auto',
    async fn() {
      await skipOnMobile('the isMinimized window command is upstream cfg(desktop) and absent from the mobile build');
      const win = getCurrentWindow();
      const minimized = await win.isMinimized();
      assert(typeof minimized === 'boolean', `isMinimized() should return boolean, got ${typeof minimized}`);
    },
  },
  // --- side-effect tests disabled (diagnosing bottom content cutoff) ---
  {
    name: 'window.maximize then is_maximized reflects state',
    category: 'side-effect',
    async fn() {
      await skipOnMobile('the maximize/unmaximize window commands are upstream cfg(desktop) and absent from the mobile build');
      const win = getCurrentWindow();
      await win.maximize();
      await new Promise((r) => setTimeout(r, 500));
      const maximized = await win.isMaximized();
      assert(maximized === true, `After maximize(), isMaximized() should be true, got ${maximized}`);
    },
  },
  {
    name: 'window.unmaximize (recover) then is_maximized reflects state',
    category: 'side-effect',
    async fn() {
      await skipOnMobile('the maximize/unmaximize window commands are upstream cfg(desktop) and absent from the mobile build');
      const win = getCurrentWindow();
      await win.maximize();
      await new Promise((r) => setTimeout(r, 500));
      await win.unmaximize();
      await new Promise((r) => setTimeout(r, 500));
      const maximized = await win.isMaximized();
      assert(maximized === false, `After unmaximize(), isMaximized() should be false, got ${maximized}`);
    },
  },
  // NOTE: minimize/restore test disabled — when run mid-suite (after
  // new-window/dialog operations) the ArkWeb bottom content goes missing
  // after restore (both API unminimize and manual taskbar restore) and does
  // not recover. Suspected correlation with dialog ops in the suite; under
  // manual investigation (with vs without dialog).
  // Isolated minimize→restore is verified OK (see openspec
  // p1-arkweb-surface-restore/plan.md); the issue only surfaces mid-suite.
  // {
  //   name: 'window.minimize then unminimize (restore) then is_minimized reflects state',
  //   category: 'side-effect',
  //   async fn() {
  //     const win = getCurrentWindow();
  //     await win.minimize();
  //     await new Promise((r) => setTimeout(r, 500));
  //     const minimizedAfter = await win.isMinimized();
  //     assert(minimizedAfter === true, `After minimize(), isMinimized() should be true, got ${minimizedAfter}`);
  //     await win.unminimize();
  //     await new Promise((r) => setTimeout(r, 800));
  //     const minimizedRestored = await win.isMinimized();
  //     assert(minimizedRestored === false, `After unminimize(), isMinimized() should be false, got ${minimizedRestored}`);
  //   },
  // },
  {
    name: 'window.set_position moves window (moveWindowTo)',
    category: 'side-effect',
    async fn() {
      const win = getCurrentWindow();
      // Save original position to restore after test
      let originalPos: PhysicalPosition | null = null;
      try { originalPos = await win.outerPosition(); } catch { /* NotSupported */ }
      await win.setPosition(new PhysicalPosition(100, 100));
      await new Promise((r) => setTimeout(r, 500));
      try {
        const pos = await win.outerPosition();
        assert(Math.abs(pos.x - 100) < 50, `After setPosition(100,100), outerPosition.x ~100, got ${pos.x}`);
      } catch {
        // outerPosition may return NotSupported; setPosition not throwing is sufficient
      }
      // Restore original position
      if (originalPos) {
        try { await win.setPosition(originalPos); } catch { /* ignore */ }
      }
    },
  },
  {
    name: 'window.set_size resizes window (resize)',
    category: 'side-effect',
    async fn() {
      const win = getCurrentWindow();
      // Save original size to restore after test
      let originalSize: LogicalSize | null = null;
      try { originalSize = await win.innerSize(); } catch { /* NotSupported */ }
      await win.setSize(new LogicalSize(400, 300));
      await new Promise((r) => setTimeout(r, 500));
      const size = await win.innerSize();
      assert(size.width > 0 && size.height > 0, `After setSize(400,300), innerSize should be positive, got ${size.width}x${size.height}`);
      // Restore original size
      if (originalSize && originalSize.width > 0 && originalSize.height > 0) {
        try { await win.setSize(originalSize); } catch { /* ignore */ }
      }
    },
  },
  {
    name: 'window.minimize then is_minimized reflects state',
    category: 'manual',
    async fn() {
      // Manual: minimizing the main window hides it, disrupting subsequent auto tests.
      // Run this test in isolation. After verify, manually restore the window.
      const win = getCurrentWindow();
      await win.minimize();
      await new Promise((r) => setTimeout(r, 500));
      const minimized = await win.isMinimized();
      assert(minimized === true, `After minimize(), isMinimized() should be true, got ${minimized}`);
      // Attempt restore (API14+ only; on API12 this is no-op — manually restore via taskbar)
      await win.restore();
    },
  },
  {
    name: 'window-state save_window_state + restore_state round-trip (all flags)',
    category: 'auto',
    async fn() {
      // Auto (promoted from manual 2026-08-26): full-flags round-trip is the
      // p3-restore-state-lock-hygiene regression guard — POSITION flag drives
      // available_monitors() (window_getter! main-thread round-trip) from a
      // tokio worker via cmd.rs, the exact deadlock path fixed in
      // plugins-workspace/plugins/window-state/src/lib.rs. The previous test
      // passed no flags (SIZE only) and left that path as a coverage blind
      // spot. Verified on device: no appfreeze, position restored.
      const win = getCurrentWindow();
      // Save current state
      await invoke('plugin:window-state|save_window_state', { label: win.label });
      // Restore with all flags (63 = SIZE|POSITION|MAXIMIZED|VISIBLE|DECORATIONS|FULLSCREEN)
      await invoke('plugin:window-state|restore_state', { label: win.label, flags: 63 });
      // No assertion — verifying no error thrown and no deadlock/appfreeze is the pass criteria
    },
  },

  // ─── on_new_window (OHOS onWindowNew interception) ───
  {
    name: 'on_new_window: Deny blocks window.open()',
    category: 'auto',
    async fn() {
      await skipOnMobile('the phone ArkWeb native layer returns a null URL for window.open (nweb_handler_delegate native return nullptr), so the event URL is null on mobile — known platform gap');
      // Set handler to Deny mode
      await invoke('set_deny_new_window', { deny: true });
      // Attempt to open a new window
      window.open('https://example.com/deny-test', '_blank');
      // Wait for the event chain to complete
      await new Promise((r) => setTimeout(r, 1500));
      // Verify handler was called with correct URL
      const lastUrl = await invoke<string | null>('get_last_new_window_url');
      assert(
        lastUrl !== null && lastUrl.includes('example.com/deny-test'),
        `Handler should have received URL containing 'example.com/deny-test', got: ${lastUrl}`,
      );
      // Reset to Allow mode
      await invoke('set_deny_new_window', { deny: false });
    },
  },
  {
    name: 'on_new_window: window.open triggers event with correct URL',
    category: 'auto',
    async fn() {
      await skipOnMobile('the phone ArkWeb native layer returns a null URL for window.open (nweb_handler_delegate native return nullptr), so the event URL is null on mobile — known platform gap');
      // The `new-window-requested` event is emitted unconditionally in the
      // OHOS handler (lib.rs) BEFORE the Allow/Create/Deny decision, so it fires
      // regardless of mode. We use Create mode (create=true) here rather than
      // Allow: Allow would open an in-page dialog overlay on the main window
      // whose autoCancel would swallow the first click of a subsequent autotest.
      // Create opens a separate Float OS window that does not overlay the main
      // window, so the test-runner buttons stay clickable.
      await invoke('set_deny_new_window', { deny: false });
      await invoke('set_create_new_window', { create: true });
      // Listen for the new-window-requested event
      let eventUrl: string | null = null;
      const unlisten = await listen<string>('new-window-requested', (event) => {
        eventUrl = event.payload;
      });
      // Attempt to open a new window
      window.open('https://example.com/allow-test', '_blank');
      // Wait for the event chain to complete
      await new Promise((r) => setTimeout(r, 2000));
      unlisten();
      // Reset create flag so subsequent tests default to Allow (no stray windows)
      await invoke('set_create_new_window', { create: false });
      // Verify event was received with correct URL
      assert(
        eventUrl !== null && eventUrl.includes('example.com/allow-test'),
        `Should have received 'new-window-requested' event with URL containing 'example.com/allow-test', got: ${eventUrl}`,
      );
    },
  },
  {
    name: 'on_new_window: Allow dialog has close button (manual)',
    category: 'manual',
    async fn() {
      // Ensure Allow mode
      await invoke('set_deny_new_window', { deny: false });
      // Open a new window — should trigger a dialog with a close button
      window.open('https://example.com/close-test', '_blank');
      // Manual verification:
      // 1. A dialog should appear with the URL displayed in the title bar
      // 2. There should be a ✕ close button in the top-right corner
      // 3. Clicking ✕ should close the dialog
      // 4. Clicking outside the dialog (autoCancel) should also close it
    },
  },
  {
    name: 'on_new_window: Deny prevents dialog (manual)',
    category: 'manual',
    async fn() {
      // Set Deny mode
      await invoke('set_deny_new_window', { deny: true });
      // Attempt to open a new window
      window.open('https://example.com/deny-manual-test', '_blank');
      // Wait briefly
      await new Promise((r) => setTimeout(r, 1000));
      // Manual verification:
      // 1. No dialog should appear
      // 2. The page should remain unchanged
      // Reset
      await invoke('set_deny_new_window', { deny: false });
    },
  },
  // webview.createPdf (OHOS only)
  {
    name: 'webview.createPdf (default A4)',
    category: 'auto',
    async fn() {
      // C5 (round 2): the runtime gate rejects below API 14 with the unified
      // version error — cmd.rs propagates it (`window.create_pdf(...)?`), so
      // the invoke rejects. Previously this tier was a silent skip and the
      // rejection was never positively asserted anywhere; assert it now.
      // At/above API 14 (the verified devices are API 23/26) the normal
      // event round-trip below runs.
      const api = await ohosSdkApiVersion();
      if (api !== null && api < 14) {
        let err: unknown = null;
        try {
          await invoke('test_create_pdf');
        } catch (e) {
          err = e;
        }
        assert(err !== null, 'createPdf must reject below API 14');
        assert(
          /requires API level 14/.test(String(err)),
          `createPdf below API 14 must carry the version error, got: ${String(err)}`
        );
        return;
      }
      let result = '';
      const unlisten = await listen<string>('create-pdf-result', (event) => {
        result = event.payload;
      });

      await invoke('test_create_pdf');

      // Wait for event with 10s timeout
      const start = Date.now();
      while (!result && Date.now() - start < 10000) {
        await new Promise((r) => setTimeout(r, 50));
      }

      unlisten();
      assert(result.startsWith('true:'), `Expected success, got: ${result}`);
      assert(result.includes('.pdf'), `Expected path in result, got: ${result}`);
    },
  },

  // Review C4 companion: Webview.clearAllBrowsingData must carry `label` so a cross-webview
  // call routes to the TARGET webview (plugin.rs get_webview: label → manager lookup,
  // WebviewNotFound on miss; a missing label silently falls back to the CALLING webview,
  // which made `Webview.getByLabel(x).clearAllBrowsingData()` clear the caller instead —
  // the same defect shape as the setBackgroundColor fix in this PR).
  //
  // T166C-N1 attribution — the three legs pin DIFFERENT layers:
  // - frontend-revert leg (the discriminator): the high-level method is called on a
  //   Webview OBJECT carrying a bogus label (constructed with the internal `skip`
  //   option, so no webview is created — pure label carrier). With the label fix in
  //   place the backend lookup misses → WebviewNotFound REJECTION. If the api package
  //   reverted to dropping `label`, the backend would silently fall back to the
  //   CALLING webview and RESOLVE — the rejection below is the only behavioral
  //   difference between the two wires, so this leg fails on a frontend revert.
  // - backend leg (raw invoke, explicit bogus label): pins that the plugin command
  //   consults `label` at all (the pre-fix backend ignored the field and resolved,
  //   clearing the caller). This leg bypasses the frontend, so it cannot see a
  //   frontend revert — that is what the leg above is for.
  // - liveness leg (real float webview): the call resolves on a real non-caller
  //   target. Non-discriminating by design (the pre-fix wire also resolved — on the
  //   caller); it only proves the command path works end-to-end.
  // Why a behavioral oracle instead of a wire spy: every JS seam on the invoke chain
  // is deliberately non-writable (core.js/ipc.js/ipc-protocol.js define `invoke`,
  // `ipc`, and `postMessage` via non-configurable Object.defineProperty, and
  // `window.ipc` on OHOS is a native ArkWeb proxy object), so the payload cannot be
  // intercepted from JS — the fake-label object is the observable equivalent.
  // Data-layer note: WHICH storage got wiped is not observable from JS here
  // (same-origin ArkWeb instances may share DOM storage), so routing is pinned by
  // resolve/reject semantics, not by observing cleared data. The float window is
  // left for the manual Close All cleanup.
  {
    name: 'webview.clearAllBrowsingData routes to the labeled target',
    category: 'auto',
    async fn() {
      await skipOnMobile('the create_borderless_window command is cfg(desktop)-only in cmd.rs');
      const label = 'test-clear-' + Date.now();
      await invoke('create_borderless_window', { windowId: label });
      await new Promise((r) => setTimeout(r, 500));
      const w = await Webview.getByLabel(label);
      assert(w !== null, `Float webview "${label}" should exist`);

      // Liveness leg: resolving on a real non-caller target (see header — not a
      // routing assertion).
      await w!.clearAllBrowsingData();

      // Frontend-revert leg: bogus-label carrier object must REJECT — a dropped
      // label would fall back to the caller and resolve instead.
      const bogus = `no-such-webview-${Date.now()}`;
      const carrier = new Webview(getCurrentWindow(), bogus, { skip: true } as never);
      let rejectedHigh = false;
      try {
        await carrier.clearAllBrowsingData();
      } catch {
        rejectedHigh = true;
      }
      assert(
        rejectedHigh,
        `high-level clearAllBrowsingData must route by its label "${bogus}" (frontend label fix reverted? a dropped label falls back to the caller and resolves)`
      );

      // Backend leg: the raw invoke with the same bogus label must also reject
      // (the command consults `label`; pre-fix it ignored the field).
      let rejected = false;
      try {
        await invoke('plugin:webview|clear_all_browsing_data', { label: bogus });
      } catch {
        rejected = true;
      }
      assert(
        rejected,
        `clearAllBrowsingData on unknown label "${bogus}" must reject (label not consulted — caller-fallback regression?)`
      );
    },
  },

  // #191: clearAllBrowsingData must also wipe the cookie store — the plugin's
  // pre-existing wipes (WebStorage.deleteAllData / HttpAuthCredentials /
  // removeCache / clearHistory) never touched WebCookieManager, so a
  // document.cookie survived a "clear all browsing data". The cookie wipe
  // lives in the plugin (WebviewPlugin.ets clearAllBrowsingData →
  // WebCookieManager.clearAllCookiesSync(false), guarded); this case pins the
  // behavior end-to-end from JS. Degradation: if the cookie lifecycle is not
  // observable on this build (set/read quirks), SKIP with disclosure instead
  // of failing — the wipe itself is not directly asserted from JS otherwise
  // (design R6: no new commands, no ❌ for an environment gap).
  {
    name: 'webview.clearAllBrowsingData clears document.cookie',
    category: 'auto',
    async fn() {
      const marker = `c191_${Date.now()}`;
      document.cookie = `${marker}=to-be-wiped; path=/`;
      const before = document.cookie;
      if (!before.includes(`${marker}=`)) {
        skip(
          `document.cookie set/read not observable on this build (before="${before}") — cookie wipe unverifiable from JS`
        );
      }
      await getCurrentWebview().clearAllBrowsingData();
      const after = document.cookie;
      assert(
        !after.includes(marker),
        `document.cookie must be cleared by clearAllBrowsingData (before="${before}" after="${after}") — cookie store wipe missing (#191 regression?)`
      );
    },
  },

  // ─── Download Intercept Tests (OHOS) ───
  {
    name: 'on_download: Requested event fires',
    category: 'auto',
    timeout: 20000,
    async fn() {
      await invoke('set_download_test_mode', { mode: 'Default' });
      let payload: any = null;
      const unlisten = await listen<any>('download-requested', (event) => { payload = event.payload; });
      const blob = new Blob(['test-data'], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'test.bin';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const start = Date.now();
      while (!payload && Date.now() - start < 10000) { await new Promise((r) => setTimeout(r, 50)); }
      unlisten();
      assert(payload !== null, 'Expected download-requested event');
      await invoke('set_download_test_mode', { mode: 'Default' });
    },
  },
  {
    name: 'on_download: custom directory redirects path',
    category: 'auto',
    timeout: 20000,
    async fn() {
      await invoke('set_download_test_mode', { mode: 'CustomDir' });
      let payload: any = null;
      const unlisten = await listen<any>('download-requested', (event) => { payload = event.payload; });
      const blob = new Blob(['custom-dir-test'], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'custom-dir-test.bin';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const start = Date.now();
      while (!payload && Date.now() - start < 10000) { await new Promise((r) => setTimeout(r, 50)); }
      unlisten();
      assert(payload !== null, 'Expected download-requested event');
      assert(payload.mode === 'CustomDir', `Expected mode CustomDir, got ${payload.mode}`);
      assert(payload.destination.includes('/downloads/'), `Expected destination in /downloads/, got ${payload.destination}`);
      await invoke('set_download_test_mode', { mode: 'Default' });
    },
  },
  {
    name: 'on_download: block dangerous file types',
    category: 'auto',
    timeout: 20000,
    async fn() {
      await invoke('set_download_test_mode', { mode: 'BlockFileType' });
      let payload: any = null;
      const unlisten = await listen<any>('download-requested', (event) => { payload = event.payload; });
      const blob = new Blob(['MZ'], { type: 'application/x-msdownload' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'malware.exe';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const start = Date.now();
      while (!payload && Date.now() - start < 10000) { await new Promise((r) => setTimeout(r, 50)); }
      unlisten();
      assert(payload !== null, 'Expected download-requested event');
      assert(payload.mode === 'BlockFileType', `Expected mode BlockFileType, got ${payload.mode}`);
      await invoke('set_download_test_mode', { mode: 'Default' });
    },
  },
  {
    name: 'on_download: audit log contains metadata',
    category: 'auto',
    timeout: 20000,
    async fn() {
      await invoke('set_download_test_mode', { mode: 'AuditLog' });
      let payload: any = null;
      const unlisten = await listen<any>('download-requested', (event) => { payload = event.payload; });
      const blob = new Blob(['audit-test'], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'audit-test.bin';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const start = Date.now();
      while (!payload && Date.now() - start < 10000) { await new Promise((r) => setTimeout(r, 50)); }
      unlisten();
      assert(payload !== null, 'Expected download-requested event');
      assert(payload.mode === 'AuditLog', `Expected mode AuditLog, got ${payload.mode}`);
      assert(typeof payload.timestamp === 'string', 'Expected timestamp in audit log');
      assert(payload.action === 'download_requested', `Expected action=download_requested, got ${payload.action}`);
      await invoke('set_download_test_mode', { mode: 'Default' });
    },
  },
  {
    name: 'on_download: Finished event fires on successful download',
    category: 'auto',
    timeout: 25000,
    async fn() {
      await invoke('set_download_test_mode', { mode: 'Default' });
      let requestedPayload: any = null;
      let finishedPayload: any = null;
      const unlistenRequested = await listen<any>('download-requested', (event) => { requestedPayload = event.payload; });
      const unlistenFinished = await listen<any>('download-finished', (event) => { finishedPayload = event.payload; });
      const blob = new Blob(['finish-test-data'], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'finish-test.bin';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const start = Date.now();
      while ((!requestedPayload || !finishedPayload) && Date.now() - start < 15000) {
        await new Promise((r) => setTimeout(r, 50));
      }
      unlistenRequested();
      unlistenFinished();
      assert(requestedPayload !== null, 'Expected download-requested event');
      assert(finishedPayload !== null, 'Expected download-finished event');
      assert(typeof finishedPayload.url === 'string', 'Expected url in finished event');
      assert(typeof finishedPayload.success === 'boolean', 'Expected success boolean in finished event');
      await invoke('set_download_test_mode', { mode: 'Default' });
    },
  },

  // ── Phase 2: reparent safety (manual, expects error) ──

  {
    name: 'webview.reparent returns error on OHOS (no deadlock)',
    category: 'manual',
    async fn() {
      const webview = getCurrentWebview();
      const window = getCurrentWindow();
      try {
        await webview.reparent(window);
        assert(false, 'reparent should have thrown an error on OHOS');
      } catch (e) {
        const errMsg = String(e);
        assert(
          errMsg.includes('not supported') || errMsg.includes('FailedToSendMessage') || errMsg.includes('CannotReparent'),
          `Expected reparent error (not supported / FailedToSendMessage / CannotReparent), got: ${errMsg}`
        );
      }
    },
  },
  {
    name: 'webview operations work after failed reparent (no cascade deadlock)',
    category: 'manual',
    async fn() {
      const webview = getCurrentWebview();
      const window = getCurrentWindow();
      try {
        await webview.reparent(window);
      } catch {
        // expected
      }
      const size = await webview.size();
      assert(size.width > 0 && size.height > 0, `webview.size() should work after failed reparent, got (${size.width},${size.height})`);
    },
  },

  // ── Phase 3: multi-webview (manual, creates child webview) ──

  {
    name: 'webview.create_webview (multi-webview via add_child)',
    category: 'manual',
    async fn() {
      const window = getCurrentWindow();
      const label = `test-child-${Date.now()}`;

      const child = new Webview(window, label, {
        url: 'data:text/html,<html><body style="margin:0;padding:50px;font-family:sans-serif;background:lightgray"><h1>Child Webview</h1></body></html>',
        x: 50,
        y: 50,
        width: 300,
        height: 200,
      });

      const createdPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for webview creation'));
        }, 5000);

        child.once('tauri://created', () => {
          clearTimeout(timeout);
          resolve();
        });
        child.once('tauri://error', (e: unknown) => {
          clearTimeout(timeout);
          reject(new Error(`Webview creation failed: ${String(e)}`));
        });
      });

      try {
        await createdPromise;
      } catch (e) {
        try { await child.close(); } catch { /* cleanup on creation failure */ }
        throw e;
      }

      // Verify child webview bounds were applied
      const pos = await child.position();
      const size = await child.size();
      assert(pos.x > 0 || pos.y > 0, `Expected non-zero position, got (${pos.x},${pos.y})`);
      assert(size.width > 0 && size.height > 0, `Expected non-zero size, got (${size.width},${size.height})`);

      await new Promise((r) => setTimeout(r, 1000));

      // Intentionally NOT closing — leave for manual Close All cleanup.
    },
  },
  // ─── Webview viewport probe cases (helpers above; red-light contract in the
  // section header before coreTests) ───

  {
    // Case a (S1/S3/S4/S5/S6): explicit-bounds children render at the requested
    // size, two non-overlapping children each keep their own geometry, and the
    // Rust readback agrees with the rendered truth. Oversized rendering (probe
    // == main-window viewport M) is the defect signature the red-light run pins.
    name: 'webview child created with explicit bounds renders at requested size',
    category: 'auto',
    // 20s: two probe legs (7s each) + two creation waits must fit inside the
    // case budget so a failure reports the leg message, not the outer timeout.
    timeout: 20000,
    async fn() {
      await skipOnMobile('webview sizing commands (create_webview with bounds / position / size) are upstream cfg(desktop) and absent from the mobile build');
      const mainWindow = getCurrentWindow();
      const M = window.innerWidth;
      console.log(`[viewport-probe] main window viewport M=${window.innerWidth}×${window.innerHeight}`);
      const tagA = 'test-sizing-child-a-' + Date.now();
      const tagB = 'test-sizing-child-b-' + Date.now();
      const childA = new Webview(mainWindow, tagA, {
        url: '/webview-viewport-probe.html',
        x: 50,
        y: 50,
        width: 300,
        height: 200,
      });
      const childB = new Webview(mainWindow, tagB, {
        url: '/webview-viewport-probe.html',
        x: 400,
        y: 300,
        width: 250,
        height: 180,
      });
      try {
        await waitForWebviewCreated(childA, 'child A');
        await waitForWebviewCreated(childB, 'child B');
        // Both children: probe must equal the REQUESTED geometry (S1/S4), which
        // on HEAD reports ≈M (full-window inflation) — the failure message
        // carries the actual sample so the red-light evidence is self-describing.
        await pollViewportProbe(tagA, 300, 200, 7000, 'child A (bounds 50,50,300×200) rendered geometry');
        await pollViewportProbe(tagB, 250, 180, 7000, 'child B (bounds 400,300,250×180) rendered geometry');
        // S6 defect-signature discriminator (positive form, post-fix): the
        // rendered viewport must not be the container/full-window size.
        const probeA = await latestViewportProbe(tagA);
        assert(
          probeA !== null && probeA.innerWidth !== M,
          `child A viewport ${describeProbe(probeA)} equals the full-window width M=${M} — oversized rendering (defect signature)`
        );
        // S5: two non-overlapping children keep their own geometry — already
        // asserted above via the two independent polls; the Rust readback is the
        // second truth source (bounds cache must agree with the rendered truth).
        // position()/size() are documented PHYSICAL APIs: creation x/y/width/
        // height are logical (webview plugin create_webview wraps them in
        // LogicalPosition/LogicalSize), and the getters multiply by the window
        // scale factor (device-measured sf=1.9 → 50,50 logical reads back as
        // 95,95 physical). Expected readback is therefore round(logical × sf),
        // not the raw request — the same IEEE product both sides compute.
        const sf = await getCurrentWindow().scaleFactor();
        const handleA = await Webview.getByLabel(tagA);
        const handleB = await Webview.getByLabel(tagB);
        assert(handleA !== null, `child A "${tagA}" not found by label`);
        assert(handleB !== null, `child B "${tagB}" not found by label`);
        const posA = await handleA!.position();
        const sizeA = await handleA!.size();
        const posB = await handleB!.position();
        const sizeB = await handleB!.size();
        assert(
          posA.x === Math.round(50 * sf) && posA.y === Math.round(50 * sf),
          `child A Rust position (${posA.x},${posA.y}) ≠ requested (50,50) logical × sf=${sf} (expected ${Math.round(50 * sf)},${Math.round(50 * sf)} physical)`
        );
        assert(
          sizeA.width === Math.round(300 * sf) && sizeA.height === Math.round(200 * sf),
          `child A Rust size (${sizeA.width},${sizeA.height}) ≠ requested 300×200 logical × sf=${sf} (expected ${Math.round(300 * sf)}×${Math.round(200 * sf)} physical)`
        );
        assert(
          posB.x === Math.round(400 * sf) && posB.y === Math.round(300 * sf),
          `child B Rust position (${posB.x},${posB.y}) ≠ requested (400,300) logical × sf=${sf} (expected ${Math.round(400 * sf)},${Math.round(300 * sf)} physical)`
        );
        assert(
          sizeB.width === Math.round(250 * sf) && sizeB.height === Math.round(180 * sf),
          `child B Rust size (${sizeB.width},${sizeB.height}) ≠ requested 250×180 logical × sf=${sf} (expected ${Math.round(250 * sf)}×${Math.round(180 * sf)} physical)`
        );
      } finally {
        try { await childA.close(); } catch { /* cleanup best-effort */ }
        try { await childB.close(); } catch { /* cleanup best-effort */ }
      }
    },
  },
  {
    // Case b (S7/S8): runtime setSize/setPosition change the RENDERED viewport,
    // and consecutive set_bounds calls — last one wins.
    name: 'webview child setSize/setPosition change rendered geometry (last call wins)',
    category: 'auto',
    // 25s: settled wait + two probe legs (7s each) must fit inside the case
    // budget so a failure reports the leg message, not the outer timeout.
    timeout: 25000,
    async fn() {
      await skipOnMobile('webview setSize/setPosition are upstream cfg(desktop) and absent from the mobile build');
      const tag = 'test-sizing-resize-' + Date.now();
      const child = new Webview(getCurrentWindow(), tag, {
        url: '/webview-viewport-probe.html',
        x: 30,
        y: 40,
        width: 300,
        height: 200,
      });
      try {
        await waitForWebviewCreated(child, 'case b child');
        // Wait for the create to settle at whatever it renders (the create-size
        // acceptance is case a's; this case isolates the runtime transition).
        const initial = await pollViewportProbeSettled(tag, 7000, 'child created');
        console.log(`[viewport-probe] case b initial rendered: ${describeProbe(initial)}`);
        await child.setSize(new LogicalSize(400, 300));
        await child.setPosition(new LogicalPosition(60, 70));
        await pollViewportProbe(tag, 400, 300, 7000, 'setSize(400,300) rendered geometry');
        // Position read-back (issue Eulogizethesun/tauri#241): setPosition(60,70)
        // must land — the physical read-back pins the position component of the
        // applied geometry. Deliberately placed BEFORE the last-wins setSize
        // leg below: under the P2-1 sentinel contract a partial setSize sends
        // an unspecified position component, so AFTER it the cache-backed
        // position() legitimately reads back as the sentinel, not (60,70).
        await new Promise((resolve) => setTimeout(resolve, 300));
        // KNOWN COUPLING (issue Eulogizethesun/tauri#241): this expectation
        // mixes two independent device-ratio sources. The wire side converts
        // the logical bounds to ArkUI vp with wry's OHOS vp
        // (default_display_virtual_pixel_ratio); the expected physical
        // read-back here multiplies the logical input by Window.scaleFactor()
        // (tao app.scale() = default_display_scaled_density). Both read 1.9
        // on the reference device, but they are different NativeDisplayManager
        // C APIs - on a device where the two ratios diverge this +/-2px
        // assert can spuriously fail. Disclosed only: no tolerance change.
        const sfB = await getCurrentWindow().scaleFactor();
        const posB = await child.position();
        assert(
          Math.abs(posB.x - Math.round(60 * sfB)) <= 2 && Math.abs(posB.y - Math.round(70 * sfB)) <= 2,
          `child position (${posB.x},${posB.y}) ≠ setPosition(60,70) logical × sf=${sfB} (expected ${Math.round(60 * sfB)},${Math.round(70 * sfB)} ±2) — the position component was lost`
        );
        // S8: consecutive set_bounds — the final call must win, no merge/drop.
        await child.setSize(new LogicalSize(250, 150));
        await pollViewportProbe(tag, 250, 150, 7000, 'setSize(250,150) after consecutive calls (last-wins)');
      } finally {
        try { await child.close(); } catch { /* cleanup best-effort */ }
      }
    },
  },
  {
    // Case c (S2/S10/S11/S9): a bounds-less (natural-layout) sub-window webview
    // viewport equals its container content area and follows window resize
    // WITHOUT Rust re-issue; the first explicit set_bounds flips it to explicit
    // sizing. The follow legs are the anti-regression guard (green on HEAD —
    // the "always 100%" fallback follows the container); the flip leg is the
    // red-light discriminator.
    name: 'sub-window natural webview follows container then flips explicit via set_bounds',
    category: 'auto',
    // 25s: three probe legs (7s each) + sub-window creation must fit inside the
    // case budget so a failure reports the leg message, not the outer timeout.
    timeout: 25000,
    async fn() {
      await skipOnMobile('the flip leg drives Webview setSize (upstream cfg(desktop), absent from the mobile build)');
      // Float sub-window via the existing demo command — JS `new WebviewWindow`
      // defaults to the OHOS UIAbility kind which conflicts with the main window
      // (see the vibrancy NOTE). Its single webview is the window content:
      // created bounds-less → natural layout. inner_size(800,600) is the
      // creation anchor for the coarse container checks below.
      const actualLabel = await invoke<string>('create_isolated_window', {
        windowId: 'test-sizing-sub',
        dataSuffix: 'sizing',
        url: '/webview-viewport-probe.html',
      });
      let win: WebviewWindow | null = null;
      try {
        const M = window.innerWidth;
        // S2/S10: the natural webview's viewport equals ITS OWN container content
        // area — plausibility band around the creation params (decorations/safe
        // areas may offset the content rect, so no strict innerSize equality) and
        // explicitly NOT the main window's viewport (wrong-container signature).
        const initial = await pollViewportProbeSettled(actualLabel, 7000, 'sub-window webview created');
        console.log(
          `[viewport-probe] case c natural rendered: ${describeProbe(initial)}, sub innerSize≈` +
          `${JSON.stringify(await (await WebviewWindow.getByLabel(actualLabel))?.innerSize())}`
        );
        assert(
          initial.innerWidth >= 480 && initial.innerWidth <= 1120 &&
          initial.innerHeight >= 360 && initial.innerHeight <= 840,
          `natural sub-window viewport ${describeProbe(initial)} outside the 800×600 content plausibility band`
        );
        assert(
          initial.innerWidth !== M,
          `natural sub-window viewport width ${initial.innerWidth} equals the main window width M=${M} — probe page loaded into the wrong container`
        );
        // S11: window resize → the webview follows the new content area via
        // container layout, no Rust bounds re-issue (autoresize is off for this
        // bounds-less webview). Strict ±1 — design Test-Design S11 pins ±0; the
        // measured +1px ArkWeb viewport constant (red-light-evidence.md, green
        // calibration 1) absorbs exactly that, so a partial follow must FAIL here.
        // The loose plausibility band above is only for the creation leg, where
        // decorations/safe areas may offset the content rect.
        win = await WebviewWindow.getByLabel(actualLabel);
        assert(win !== null, `sub-window "${actualLabel}" not found by label`);
        await win!.setSize(new LogicalSize(600, 450));
        await pollViewportProbe(actualLabel, 600, 450, 7000, 'natural sub-window following window resize to 600×450');
        // S9 (flip): the first explicit set_bounds overrides the natural layout —
        // strict equality, the red-light discriminator on HEAD.
        const subWebview = await Webview.getByLabel(actualLabel);
        assert(subWebview !== null, `sub-window webview "${actualLabel}" not found by label`);
        await subWebview!.setSize(new LogicalSize(320, 240));
        await pollViewportProbe(actualLabel, 320, 240, 7000, 'set_bounds(320,240) overriding natural layout');
      } finally {
        if (!win) {
          // Early-exit path (an assertion threw before `win` was assigned): the
          // Float sub-window would otherwise leak into later cases (design test
          // hygiene: finally must clean up regardless of where the case failed).
          try { win = await WebviewWindow.getByLabel(actualLabel); } catch { /* already gone */ }
        }
        if (win) {
          try { await win.destroy(); } catch { /* cleanup best-effort */ }
        }
      }
    },
  },

  // ─── SetAutoResize re-arm (issue Eulogizethesun/tauri#244, case d) ───
  {
    // Case d: a webview created with explicit bounds must keep following
    // window resizes across a setAutoResize(false)→(true) cycle, and a
    // runtime enable on a never-armed explicit-bounds webview must arm it.
    // Pre-#244-fix the OHOS enable leg was a no-op, so both legs fail (the
    // webview keeps its creation geometry at every window resize). All legs
    // drive the RENDER truth via the viewport probe, at the creation ratio.
    name: 'webview setAutoResize disable→enable re-arms tracking (issue #244)',
    category: 'auto',
    // 40s: creation wait + two probe polls (5s each) + two resize legs
    // (0.8s settle + 7s poll each) fit inside the budget so a failure reports
    // the leg message, not the outer timeout.
    timeout: 40000,
    async fn() {
      await skipOnMobile('the case drives main-window resizes, a freeform (PC/2in1) capability; on phone the fullscreen main window is a system-level no-op');
      // Freeform guard (same probe as window-ops' mainWindowResizable): on a
      // fullscreen main window the resizes cannot land, so Guard ① below
      // would fire for the wrong reason — skip instead of false-failing.
      const win0 = getCurrentWindow();
      let mon: Awaited<ReturnType<typeof currentMonitor>> = null;
      try {
        mon = await currentMonitor();
      } catch {
        mon = null;
      }
      if (mon) {
        const outer0 = await win0.outerSize();
        if (outer0.width >= mon.size.width * 0.95 && outer0.height >= mon.size.height * 0.95) {
          skip('main window is fullscreen (not freeform): window resize cannot land — auto-resize tracking is unjudgeable');
        }
      }
      const mainWindow = getCurrentWindow();
      const sf = await mainWindow.scaleFactor();
      const tagD = 'test-autosize-rearm-' + Date.now();
      const origPhysical = await mainWindow.innerSize();
      // Explicit creation bounds: the wry bounds cache is seeded with this
      // rect, so the geometry is fully explicit and (post-#244) derivable on
      // a runtime enable.
      const child = new Webview(mainWindow, tagD, {
        url: '/webview-viewport-probe.html',
        x: 30,
        y: 40,
        width: 300,
        height: 200,
      });
      // Register the created/error listeners SYNCHRONOUSLY (this call runs
      // before the first await below): `tauri://created` is delivered by a
      // synchronous pass over the constructor's local listener table the
      // moment the create invoke resolves, so any await between construction
      // and registration can consume the event and leave this wait timing
      // out with "creation timed out" — the red-run 2026-11-03 failure mode
      // (the await on innerSize sat between the two). Sibling cases a/b
      // register immediately and have never flaked on this.
      const created = waitForWebviewCreated(child, 'case d child');
      try {
        await created;
        await pollViewportProbeSettled(tagD, 5000, 'case d child created');
        await pollViewportProbe(tagD, 300, 200, 5000, 'case d child rendered at creation bounds 300×200');
        // Window inner size BEFORE the first arm — the divisor of the rates
        // the enable leg derives/restores.
        const s0 = (await mainWindow.innerSize()).toLogical(sf);
        const w0 = s0.width;
        const h0 = s0.height;
        // ── Leg 1: runtime enable on fully-explicit geometry. Pre-fix this
        // arm was a no-op → the webview never follows any window resize.
        await child.setAutoResize(true);
        // Resize targets are ADAPTIVE (the demo main window boots at
        // 1000×800 logical but that is not an invariant of the suite run):
        // leg 1 grows ~1.3× (Guard ① requires ≥1.15× growth — a fixed
        // 1000×600 target would SHRINK the boot-size window and fire the
        // guard for the wrong reason), clamped to 85% of the monitor so a
        // large window's growth cannot be swallowed by a WM clamp; leg 2
        // shrinks to ~0.72× (Guard ② requires a >50px move), held above the
        // demo's 600×400 logical min_inner_size so a clamp cannot eat the
        // delta.
        let tw1 = Math.round(w0 * 1.3);
        let th1 = Math.round(h0 * 1.3);
        if (mon) {
          const mLog = mon.size.toLogical(sf);
          tw1 = Math.min(tw1, Math.floor(mLog.width * 0.85));
          th1 = Math.min(th1, Math.floor(mLog.height * 0.85));
        }
        await mainWindow.setSize(new LogicalSize(tw1, th1));
        await new Promise((resolve) => setTimeout(resolve, 800));
        const s1 = (await mainWindow.innerSize()).toLogical(sf);
        // Guard ①: the resize must actually land and GROW — a no-op or
        // clamped-away resize would make the tracking assertion below
        // vacuous.
        assert(
          s1.width >= w0 * 1.15 && s1.height >= h0 * 1.15,
          `window resize had no effect: ${w0}×${h0} → ${s1.width}×${s1.height} (target ${tw1}×${th1}) — cannot judge auto-resize tracking`
        );
        const ew1 = Math.round((300 * s1.width) / w0);
        const eh1 = Math.round((200 * s1.height) / h0);
        await pollViewportProbe(
          tagD,
          ew1,
          eh1,
          7000,
          `runtime enable armed tracking after resize to ${s1.width}×${s1.height} (expect ~${ew1}×${eh1})`,
          2
        );
        // ── Leg 2: disable parks, enable restores → still tracking.
        await child.setAutoResize(false);
        await child.setAutoResize(true);
        const tw2 = Math.max(620, Math.round(s1.width * 0.72));
        const th2 = Math.max(420, Math.round(s1.height * 0.72));
        await mainWindow.setSize(new LogicalSize(tw2, th2));
        await new Promise((resolve) => setTimeout(resolve, 800));
        const s2 = (await mainWindow.innerSize()).toLogical(sf);
        // Guard ②: same no-op-resize guard for the second leg.
        assert(
          Math.abs(s2.width - s1.width) > 50 || Math.abs(s2.height - s1.height) > 50,
          `second window resize had no effect: ${s1.width}×${s1.height} → ${s2.width}×${s2.height} (target ${tw2}×${th2}) — cannot judge auto-resize tracking`
        );
        const ew2 = Math.round((300 * s2.width) / w0);
        const eh2 = Math.round((200 * s2.height) / h0);
        await pollViewportProbe(
          tagD,
          ew2,
          eh2,
          7000,
          `disable→enable re-armed tracking after resize to ${s2.width}×${s2.height} (expect ~${ew2}×${eh2})`,
          2
        );
      } finally {
        try { await child.close(); } catch { /* cleanup best-effort */ }
        // Restore the suite's window size so later window-geometry cases are
        // not affected by this case's resizes.
        try { await mainWindow.setSize(origPhysical); } catch { /* best-effort */ }
      }
    },
  },

  // ─── Webview reload (S2-004: plugin:webview|webview_reload routing) ───
  {
    // The reload command's full chain (JS api → plugin command → runtime-wry →
    // wry PendingOp::Reload → ArkWeb WebviewController.refresh) only becomes
    // observable through a CHILD webview: reloading the MAIN webview would
    // reload this test runner itself. Acceptance = the child's document is
    // re-fetched, which re-executes the probe page's script and appends a
    // fresh viewport sample (no resize is issued in this case, so any new
    // sample is the reload's load-time report — the same probe rig the
    // sizing cases above trust).
    name: 'webview child reload re-runs page script (probe re-reports)',
    category: 'auto',
    // 20s: creation wait (5s) + settled leg (7s) + reload poll (7s) must fit
    // inside the case budget so a failure reports the leg message, not the
    // outer timeout.
    timeout: 20000,
    async fn() {
      await skipOnMobile('webview child creation (create_webview) is upstream cfg(desktop) and absent from the mobile build');
      const tag = 'test-reload-child-' + Date.now();
      const child = new Webview(getCurrentWindow(), tag, {
        url: '/webview-viewport-probe.html',
        x: 50,
        y: 50,
        width: 300,
        height: 200,
      });
      try {
        await waitForWebviewCreated(child, 'reload child');
        // First load must settle before the reload: the probe uplink produces
        // at least one sample for this tag.
        await pollViewportProbeSettled(tag, 7000, 'reload child initial load');
        const before = (await invoke<ViewportProbeSample[]>('get_tracked_webview_viewport_probes'))
          .filter((s) => s.tag === tag).length;
        await child.reload();
        const start = Date.now();
        let after = before;
        while (Date.now() - start < 7000) {
          after = (await invoke<ViewportProbeSample[]>('get_tracked_webview_viewport_probes'))
            .filter((s) => s.tag === tag).length;
          if (after > before) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        assert(
          after > before,
          `webview.reload(): probe sample count for "${tag}" stayed ${after} after reload — no fresh page load within 7000ms (command not routed or ArkWeb refresh failed)`
        );
      } finally {
        try { await child.close(); } catch { /* cleanup best-effort */ }
      }
    },
  },

  // ─── Mouse Event Tests (OHOS desktop / 2in1) ───
  {
    name: 'DOM MouseEvent.dispatch (synthetic)',
    category: 'side-effect',
    async fn() {
      const events: string[] = [];

      const onMouseMove = () => events.push('mousemove');
      const onMouseDown = () => events.push('mousedown');
      const onMouseUp = () => events.push('mouseup');
      const onClick = () => events.push('click');

      document.addEventListener('mousemove', onMouseMove, { once: true });
      document.addEventListener('mousedown', onMouseDown, { once: true });
      document.addEventListener('mouseup', onMouseUp, { once: true });
      document.addEventListener('click', onClick, { once: true });

      // Dispatch synthetic mouse events
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
      document.dispatchEvent(new MouseEvent('click', { button: 0, bubbles: true }));

      assert(events.includes('mousemove'), `mousemove not received, got: ${events.join(', ')}`);
      assert(events.includes('mousedown'), `mousedown not received, got: ${events.join(', ')}`);
      assert(events.includes('mouseup'), `mouseup not received, got: ${events.join(', ')}`);
      assert(events.includes('click'), `click not received, got: ${events.join(', ')}`);
    },
  },
  {
    name: 'DOM MouseEvent.coordinates',
    category: 'auto',
    async fn() {
      let capturedX = -1;
      let capturedY = -1;
      let capturedButton = -1;

      const onMouseMove = (e: globalThis.MouseEvent) => {
        capturedX = e.clientX;
        capturedY = e.clientY;
      };
      const onMouseDown = (e: globalThis.MouseEvent) => {
        capturedButton = e.button;
      };

      document.addEventListener('mousemove', onMouseMove, { once: true });
      document.addEventListener('mousedown', onMouseDown, { once: true });

      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 250, clientY: 150, bubbles: true }));
      document.dispatchEvent(new MouseEvent('mousedown', { button: 2, bubbles: true }));

      assert(capturedX === 250, `clientX expected 250, got ${capturedX}`);
      assert(capturedY === 150, `clientY expected 150, got ${capturedY}`);
      assert(capturedButton === 2, `button expected 2 (right), got ${capturedButton}`);
    },
  },
  {
    name: 'DOM WheelEvent.dispatch (synthetic)',
    category: 'side-effect',
    async fn() {
      let capturedDeltaX = 0;
      let capturedDeltaY = 0;

      const onWheel = (e: WheelEvent) => {
        capturedDeltaX = e.deltaX;
        capturedDeltaY = e.deltaY;
      };

      document.addEventListener('wheel', onWheel, { once: true });
      document.dispatchEvent(new WheelEvent('wheel', { deltaX: 0, deltaY: -3, bubbles: true }));

      assert(capturedDeltaY === -3, `deltaY expected -3, got ${capturedDeltaY}`);
    },
  },
  {
    name: 'DOM WheelEvent.ctrlKey (pinch zoom simulation)',
    category: 'auto',
    async fn() {
      let receivedCtrlWheel = false;
      let capturedDelta = 0;

      const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey) {
          receivedCtrlWheel = true;
          capturedDelta = e.deltaY;
        }
      };

      document.addEventListener('wheel', onWheel, { once: true });
      document.dispatchEvent(new WheelEvent('wheel', {
        deltaY: -1, ctrlKey: true, bubbles: true,
      }));

      assert(receivedCtrlWheel, 'Ctrl+Wheel event not received');
      assert(capturedDelta === -1, `deltaY expected -1, got ${capturedDelta}`);
    },
  },
  {
    name: '@tauri-apps/api/window.cursorPosition',
    category: 'auto',
    async fn() {
      await skipOnMobile('the cursorPosition window command is upstream cfg(desktop) and absent from the mobile build');
      // ohos-cursor-passthrough 4.1 — tolerant dual-branch contract. On OHOS
      // the value is the fed screen-global physical px (design D1) and a
      // never-fed process rejects with the typed untracked error (D3/R5) —
      // the old typeof/>=0 assertions were a red-light blind spot: they
      // passed the (0,0) garbage sentinel AND could not observe the contract.
      // resolve branch → the reading must be a real fed coordinate: finite
      // and inside the current monitor's physical size (+40px tolerance).
      // catch branch → tolerated ONLY as the untracked fail-safe contract,
      // never a required path: the auto suite injects no real mouse
      // interaction, so on OHOS this branch is reached deterministically
      // (device-verified 2026-10-28 — see the catch comment); the
      // authoritative cold-start reject verification lives in the ability
      // device UT (cursor_position_with_untracked_feed_
      // returns_untracked_error).
      let pos: { x: number; y: number };
      try {
        pos = await cursorPosition();
      } catch (e) {
        // Only the untracked fail-safe contract's rejection is tolerated —
        // and only by its known message. Source-verified mapping chain:
        // tao's OHOS cursor_position Err is the untracked fail-safe (the
        // auto suite injects no real mouse interaction, so the reading is
        // untracked here), and tauri-runtime-wry maps it through BOTH arms
        // to Error::FailedToGetCursorPosition (event_loop_window_getter!
        // macro arm lib.rs:3481-3486, direct main-thread arm :3835-3843);
        // tauri-runtime's Display (crates/tauri-runtime/src/lib.rs:162)
        // renders it as "failed to get cursor position" (JS: "runtime
        // error: failed to get cursor position"). FailedToSendMessage
        // has 17 production sites in tauri-runtime-wry's lib.rs, split
        // across two paths. Outer path: send_user_message's proxy send
        // (:361) -- the getter! macro (:305-311) calls send_user_message
        // first, and its `?` (:307) propagates that Err straight out of
        // cursor_position. Inner path: the event-loop CursorPosition
        // handler (production :5068) carries its Err over the response
        // channel and the receiver remaps it into
        // FailedToGetCursorPosition (:3485) before reaching JS -- the
        // remap covers only the inner production, never the outer one.
        // It reaches JS only when the invoke channel itself is dead,
        // which is a real defect and must FAIL, never be tolerated.
        // Device evidence (2026-10-28
        // regression run): this case rejected deterministically in two
        // consecutive rounds with exactly "runtime error: failed to get
        // cursor position" (row65, 110/111ms) — so the previous
        // send-message regex turned the contracted fail-safe into a false
        // red, while the pre-tightening bare catch had turned the same
        // reject into G6's fake green (swallow family, third instance:
        // T28-1 window_client:None blind spot -> 23857d325 blind() -> this
        // bare catch). Any other rejection is a real defect and must fail
        // the case (issue Eulogizethesun/tauri#241: the original bare
        // catch swallowed arbitrary rejects as a fake pass).
        const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
        if (!/failed to get cursor position/.test(msg)) {
          throw e;
        }
        console.warn(`[cursorPosition] rejected — tolerated as the untracked fail-safe contract: ${e}`);
        return;
      }
      // Resolve-branch asserts live OUTSIDE the try so they can actually fail
      // the case: a NaN / out-of-domain reading silently passing would
      // recreate the exact red-light blind spot this upgrade removes
      // (audit round 1 major). monitor-null is covered by the dedicated
      // currentMonitor case's assertions.
      assert(Number.isFinite(pos.x), `pos.x should be a finite number, got ${pos.x}`);
      assert(Number.isFinite(pos.y), `pos.y should be a finite number, got ${pos.y}`);
      const monitor = await currentMonitor();
      assert(
        pos.x >= -40 && pos.x <= monitor.size.width + 40 && pos.y >= -40 && pos.y <= monitor.size.height + 40,
        `pos (${pos.x},${pos.y}) should be within monitor physical size ${monitor.size.width}x${monitor.size.height} (+40px tolerance)`,
      );
    },
  },

  // OHOS WebView cookie management (p1-webview-cookie) — 4.1 set_cookie round-trip
  {
    name: 'webview.set_cookie round-trip (OHOS)',
    category: 'side-effect',
    timeout: 15000,
    async fn() {
      const resultPromise = new Promise<any>((resolve) => {
        const unlisten = listen('cookie-test-result', (event) => {
          unlisten.then((fn) => fn());
          resolve(event.payload);
        });
        setTimeout(() => {
          unlisten.then((fn) => fn());
          resolve({ set_cookie: 'Timeout: no result within 12s', test_cookie_found: false, cookies_for_url: [] });
        }, 12000);
      });
      await invoke('cookie_test');
      const report = await resultPromise;
      assert(report.set_cookie === 'ok', `set_cookie failed: ${report.set_cookie}`);
      assert(
        report.test_cookie_found === true,
        `test cookie not found after set; cookies_for_url=${JSON.stringify(report.cookies_for_url)}`
      );
    },
  },
  // 4.2 cookies() returns an array (OHOS best-effort: current URL only)
  {
    name: 'webview.cookies() returns array (OHOS best-effort)',
    category: 'auto',
    timeout: 15000,
    async fn() {
      const resultPromise = new Promise<any>((resolve) => {
        const unlisten = listen('cookie-test-result', (event) => {
          unlisten.then((fn) => fn());
          resolve(event.payload);
        });
        setTimeout(() => {
          unlisten.then((fn) => fn());
          resolve({ cookies_all: null });
        }, 12000);
      });
      await invoke('cookie_test');
      const report = await resultPromise;
      assert(
        Array.isArray(report.cookies_all),
        `cookies() should return array, got: ${report.cookies_all}`
      );
    },
  },
  // 4.3 delete_cookie is a no-op on OHOS (platform lacks single-cookie deletion)
  {
    name: 'webview.delete_cookie no-op (OHOS platform limit)',
    category: 'side-effect',
    timeout: 15000,
    async fn() {
      const resultPromise = new Promise<any>((resolve) => {
        const unlisten = listen('cookie-test-result', (event) => {
          unlisten.then((fn) => fn());
          resolve(event.payload);
        });
        setTimeout(() => {
          unlisten.then((fn) => fn());
          resolve({ delete_cookie: null });
        }, 12000);
      });
      await invoke('cookie_test');
      const report = await resultPromise;
      assert(
        typeof report.delete_cookie === 'string' && report.delete_cookie.startsWith('ok'),
        `delete_cookie failed: ${report.delete_cookie}`
      );
    },
  },
  // 4.4 cookies_for_url readable (unchanged behavior)
  {
    name: 'webview.cookies_for_url readable (OHOS)',
    category: 'auto',
    timeout: 15000,
    async fn() {
      const resultPromise = new Promise<any>((resolve) => {
        const unlisten = listen('cookie-test-result', (event) => {
          unlisten.then((fn) => fn());
          resolve(event.payload);
        });
        setTimeout(() => {
          unlisten.then((fn) => fn());
          resolve({ cookies_for_url: null });
        }, 12000);
      });
      await invoke('cookie_test');
      const report = await resultPromise;
      assert(
        Array.isArray(report.cookies_for_url),
        `cookies_for_url should return array, got: ${report.cookies_for_url}`
      );
    },
  },

  // 4.5 cookies_for_url on the MAIN thread (issue #110): sync commands execute
  // on the OHOS main thread, so this read goes through the
  // ohos.webview-cookie sync bridge (fetchCookieSync) — the path that used to
  // silently return empty.
  {
    name: 'webview.cookies_for_url main-thread sync bridge (OHOS #110)',
    category: 'side-effect',
    timeout: 15000,
    async fn() {
      await invoke('cookie_test_main_thread_set');
      // set_cookie is fire-and-forget on OHOS — let the async set settle.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const report = await invoke<any>('cookie_test_main_thread_read');
      assert(
        report.test_cookie_found === true,
        `main-thread cookie not found; cookies_for_url=${JSON.stringify(report.cookies_for_url)}`
      );
      assert(
        Array.isArray(report.cookies_all),
        `main-thread cookies() should return array, got: ${report.cookies_all}`
      );
    },
  },

  // set_bounds / bounds round-trip — desktop-only (Webview::bounds/set_bounds are #[cfg(desktop)]).
  // On OHOS mobile the command is not registered; skip silently via try/catch.
  // Round-trips a DEDICATED explicit-bounds child, never the window-content
  // webview: under ohos-webview-sizing D2 a runtime set_bounds flips a natural
  // (bounds-less) webview to explicit sizing, so touching "main" would pin the
  // window content to its stale bounds-cache value (observed 200×200) — the
  // pre-D2 form of this test did exactly that as a silent side effect.
  {
    name: 'webview.set_bounds round-trip (OHOS desktop)',
    category: 'auto',
    timeout: 15000,
    async fn() {
      // Desktop-form only: bounds/set_bounds are #[cfg(desktop)]; skipping here
      // (instead of relying on the invoke rejection below) keeps mobile from
      // creating a throwaway child webview just to skip.
      await skipOnMobile('Webview::bounds/set_bounds are cfg(desktop) and absent from the mobile build');
      const label = 'test-set-bounds-roundtrip-' + Date.now();
      const child = new Webview(getCurrentWindow(), label, {
        url: '/webview-viewport-probe.html',
        x: 40,
        y: 40,
        width: 220,
        height: 160,
      });
      try {
        await waitForWebviewCreated(child, 'set_bounds round-trip child');
        const report = await invoke('set_bounds_test', { label });
        assert(report.set_ok === true, `set_bounds_test failed: ${JSON.stringify(report)}`);
        assert(
          report.matches === true,
          `bounds should match after round-trip, got: ${JSON.stringify(report)}`
        );
        // Real read-back assertions (issue Eulogizethesun/tauri#241): the
        // command already awaited the rendered ack (probe-page viewport) and
        // asserted its own read-back; here the physical read-back is pinned
        // against the CREATION rect (40,40,220×160 logical × sf) so a
        // regression in either the position or the size component — or a
        // never-applied rect surfacing as a rejection — fails the case.
        const sf = await getCurrentWindow().scaleFactor();
        const rb = report.readback;
        assert(
          Math.abs(rb.x - Math.round(40 * sf)) <= 2 && Math.abs(rb.y - Math.round(40 * sf)) <= 2,
          `read-back position (${rb.x},${rb.y}) ≠ requested (40,40) logical × sf=${sf} (expected ${Math.round(40 * sf)},${Math.round(40 * sf)} ±2)`
        );
        assert(
          Math.abs(rb.width - Math.round(220 * sf)) <= 2 && Math.abs(rb.height - Math.round(160 * sf)) <= 2,
          `read-back size ${rb.width}x${rb.height} ≠ requested 220×160 logical × sf=${sf} (expected ${Math.round(220 * sf)}×${Math.round(160 * sf)} ±2)`
        );
      } finally {
        try { await child.close(); } catch { /* cleanup best-effort */ }
      }
    },
  },

  // ─── Desktop features (OHOS) ───

  // PathResolver paths valid (no double files/files)
  {
    name: 'PathResolver app_data_dir valid (OHOS)',
    category: 'auto',
    async fn() {
      const report = await invoke<Record<string, unknown>>('desktop_features_test');
      const dir = report.app_data_dir as string;
      assert(dir && dir.length > 0, `app_data_dir should be non-empty, got: ${dir}`);
      assert(
        !report.path_has_double_files,
        `app_data_dir should not contain 'files/files', got: ${dir}`
      );
    },
  },

  // Click-through is a no-op on OHOS desktop (send_user_message is fire-and-forget,
  // the actual tao NotSupported error is discarded in the event loop).
  // The command itself succeeds (message sent), but the operation does nothing.
  // On OHOS mobile set_ignore_cursor_events is unavailable (desktop-only Window method);
  // the command reports 'mobile_skip' and we treat that as an acceptable skip.
  {
    name: 'set_ignore_cursor_events is no-op (OHOS platform limit)',
    category: 'auto',
    async fn() {
      const report = await invoke<Record<string, unknown>>('desktop_features_test');
      const result = report.click_through_result as string;
      // On OHOS desktop, send_user_message returns Ok (message sent), but tao discards the
      // NotSupported error in the event loop. On OHOS mobile the method is absent → 'mobile_skip'.
      assert(
        result === 'ok' || result === 'mobile_skip',
        `set_ignore_cursor_events should succeed (desktop) or skip (mobile), got: ${result}`
      );
    },
  },

  // Clipboard API exists (ArkWeb default allows, attribute is no-op)
  // Note: actual writeText requires document focus, so we only check API existence.
  {
    name: 'Clipboard API available (OHOS always-on)',
    category: 'auto',
    async fn() {
      assert(
        typeof navigator.clipboard !== 'undefined' || typeof document.execCommand === 'function',
        'Clipboard API (navigator.clipboard or document.execCommand) should be available'
      );
    },
  },

  // ── Vibrancy (window effects) ──
  // NOTE: WebviewWindow.new defaults to OHOS UIAbility (singleton) which conflicts
  // with the main window. Use create_transparent_window (Float sub-window) instead.
  // Labels are timestamped because OHOS does not destroy Float sub-windows on
  // programmatic close (Window::close unimplemented) — a fixed label collides on
  // the 2nd run-all within the same app session, so build() returns the stale
  // window and no new blur window appears visually.
  {
    name: 'window.setEffects (Blur/Acrylic) — no throw',
    category: 'side-effect',
    async fn() {
      await skipOnMobile('the setEffects window command is upstream cfg(desktop) and absent from the mobile build');
      const windowId = 'test-vibrancy-auto-' + Date.now();
      await invoke('create_transparent_window', { windowId });
      const win = await WebviewWindow.getByLabel(windowId);
      if (!win) throw new Error('vibrancy window not created');
      await win.setEffects({ effects: [Effect.Blur], radius: 25 });
      await win.setEffects({ effects: [Effect.Acrylic], radius: 25, color: [0, 0, 0, 128] });
      await win.clearEffects();
      assert(true, 'setEffects + clearEffects did not throw for all effect types');
      // Intentionally NOT closing — leave for manual Close All cleanup.
    },
  },
  {
    name: 'vibrancy: Blur effect visible (manual)',
    category: 'manual',
    async fn() {
      const windowId = 'test-vibrancy-blur-' + Date.now();
      await invoke('create_transparent_window', { windowId });
      const win = await WebviewWindow.getByLabel(windowId);
      if (!win) throw new Error('vibrancy window not created');
      await win.setEffects({ effects: [Effect.Blur], radius: 25 });
      // Manual: window should show frosted/blurry background
    },
  },
  {
    name: 'vibrancy: Acrylic effect visible (manual)',
    category: 'manual',
    async fn() {
      const windowId = 'test-vibrancy-acrylic-' + Date.now();
      await invoke('create_transparent_window', { windowId });
      const win = await WebviewWindow.getByLabel(windowId);
      if (!win) throw new Error('vibrancy window not created');
      await win.setEffects({ effects: [Effect.Acrylic], radius: 25, color: [0, 0, 0, 128] });
      // Manual: window should show blur + semi-transparent tint
    },
  },
  {
    name: 'vibrancy: clearEffects removes blur (manual)',
    category: 'manual',
    async fn() {
      const windowId = 'test-vibrancy-clear-' + Date.now();
      await invoke('create_transparent_window', { windowId });
      const win = await WebviewWindow.getByLabel(windowId);
      if (!win) throw new Error('vibrancy window not created');
      await win.setEffects({ effects: [Effect.Blur], radius: 25 });
      await new Promise((r) => setTimeout(r, 1000));
      await win.clearEffects();
      // Manual: blur should be gone after clearEffects
    },
  },
  // ── Vibrancy build-time effects (WindowBuilder::effects, distinct from runtime setEffects) ──
  {
    name: 'vibrancy build-time effects (WindowBuilder::effects) — no throw',
    category: 'side-effect',
    async fn() {
      // create_transparent_window with effect param applies effects at build time
      // (registerController inject), distinct from runtime setEffects (AttributeUpdater).
      const windowId = 'test-vibrancy-build-' + Date.now();
      await invoke('create_transparent_window', { windowId, effect: 'Blur', radius: 25 });
      const win = await WebviewWindow.getByLabel(windowId);
      if (!win) throw new Error('build-time effects window not created');
      // Intentionally NOT closing — leave for manual Close All cleanup.
      assert(true, 'build-time effects window created without throw');
    },
  },
  // ─── Transparent UIAbility window (instance + builder.transparent(true)) ───
  // Creates a transparent UIAbility instance loading transparent-test.html.
  // Asserts only the communication path (instance created + webview registered);
  // operation semantics are verified manually via hilog.
  {
    name: 'transparent UIAbility window (create + self-driven ops + hilog verifiable)',
    category: 'auto',
    timeout: 30000,
    async fn() {
      const windowId = 'autotest-' + Date.now();
      const diag = await invoke<{
        label: string;
        window_id: string;
        webview_acquired: boolean;
        all_webview_labels: string[];
        mobile_form: boolean;
        mobile_fail_fast: string | null;
      }>('create_transparent_ui_ability_window', { windowId });

      // Mobile form: the desktop-only gate rejects additional UIAbility
      // windows (multi-uiability-windows OQ1 keeps the mobile entry
      // singleton) — the command reports the fail-fast marker and this
      // records a skip. A mobile-form build whose spawn SUCCEEDED (gate
      // regression) or a desktop failure fails loudly below.
      if (diag.mobile_form) {
        if (diag.mobile_fail_fast === null) {
          throw new Error(
            `mobile-form build let the transparent UIAbility spawn through (desktop-only gate regressed): ${JSON.stringify(diag)}`
          );
        }
        skip(`UIAbility spawn fail-fast on mobile form (desktop-only, tao gate): ${diag.mobile_fail_fast}`);
      }

      assert(
        diag.webview_acquired === true,
        `webview not acquired: label=${diag.label}, all_labels=${JSON.stringify(diag.all_webview_labels)}`,
      );
      assert(
        diag.label.includes(windowId),
        `label mismatch: expected to contain "${windowId}", got "${diag.label}"`,
      );
    },
  },

  // ── committer #192: main-thread url() truth through the ohos.webview-url
  // sync bridge. A SPA hash-route navigation inside a DEDICATED webview (no
  // reload), then url() must return the live post-navigation URL — proving
  // the sync bridge reads the controller's live state, not a create-time
  // cache. Desktop: same case exercises the platform url() path.
  {
    name: 'webview.url() main-thread sync read after SPA navigation (#192)',
    category: 'auto',
    timeout: 20000,
    async fn() {
      const label = await invoke<string>('create_isolated_window', {
        windowId: 'urlsync',
        dataSuffix: 'urlsync',
        url: '/hello.html'
      });
      // Let the dedicated webview attach (ArkTS create + controller attach).
      await new Promise((r) => setTimeout(r, 1500));
      const w = await WebviewWindow.getByLabel(label);
      assert(w, `isolated window "${label}" not found after create`);
      // SPA navigation: hash-route change without reload (scoped Rust-side
      // eval — the local @tauri-apps/api build exposes no JS eval API).
      await invoke('navigate_webview_hash', { label, hash: 'spa-route-192' });
      await new Promise((r) => setTimeout(r, 1500));
      const url = await invoke<string>('get_webview_url', { label });
      assert(
        typeof url === 'string' && url.length > 0,
        `url() should return a non-empty string, got "${url}"`
      );
      assert(
        url.includes('spa-route-192'),
        `url() should reflect the SPA route after navigation, got "${url}"`
      );
      // Intentionally NOT closing — same convention as the page-load case
      // above (OHOS autotest close leaves ghost windows); suite cleanup
      // removes it via close_all_test_windows.
    },
  },

  // ── committer #188: incognito webview + per-store cookie isolation.
  // The marker cookie is written THROUGH the incognito webview, the control
  // through the main window's default store; the cross-probe must show no
  // bleed-through. Strict isolation asserted on OHOS (WebOptions.incognitoMode
  // + per-store WebCookieManager calls); on desktop the case still runs the
  // create + write + report path but does not assert store separation
  // (WebView2 incognito profile semantics are outside this change's scope).
  {
    name: 'webview.incognito create + cookie isolation (#188)',
    category: 'auto',
    timeout: 25000,
    async fn() {
      const isOhos = (await ohosSdkApiVersion()) !== null;
      const label = `incognito-probe-${Date.now().toString(36)}`;
      await invoke('create_incognito_webview', { windowId: label });
      await new Promise((r) => setTimeout(r, 1500));
      await invoke('incognito_cookie_set', { label });
      // set_cookie is fire-and-forget on OHOS — let the write settle.
      await new Promise((r) => setTimeout(r, 1200));
      const report = await invoke<any>('incognito_cookie_isolation', { label });
      if (!isOhos) {
        // Desktop smoke: the incognito webview exists and both writes landed
        // somewhere — store separation itself is not asserted here.
        assert(
          Array.isArray(report.incognito_cookies) && Array.isArray(report.main_cookies),
          `cookie probe should return arrays, got ${JSON.stringify(report)}`
        );
        return;
      }
      assert(
        report.marker_in_incognito === true,
        `marker cookie not found in the incognito store: ${JSON.stringify(report.incognito_cookies)}`
      );
      assert(
        report.marker_in_main === false,
        `marker cookie bled into the default store: ${JSON.stringify(report.main_cookies)}`
      );
      assert(
        report.control_in_main === true,
        `control cookie not found in the default store: ${JSON.stringify(report.main_cookies)}`
      );
      assert(
        report.control_in_incognito === false,
        `control cookie bled into the incognito store: ${JSON.stringify(report.incognito_cookies)}`
      );
    },
  },

  // ── committer #219: tracked set-title ack chain. A title set on a REAL
  // window must resolve (ack reflects actual completion); the same command
  // aimed at an illegal window must REJECT — never a fake success ack.
  // (The OHOS autotest destroy path leaves ghost windows, so the destroyed
  // leg is represented by a never-existing label; the reject contract is
  // identical — no fabricated acknowledgement.)
  {
    name: 'window.set_title tracked ack: real window resolves, illegal label rejects (#219)',
    category: 'auto',
    timeout: 15000,
    async fn() {
      // create_borderless_window is a desktop-form command (tao sub-window
      // spawn gate) — the whole probe rides it, so skip on mobile form.
      await skipOnMobile('create_borderless_window is desktop-form only');
      const label = `t219-${Date.now().toString(36)}`;
      await invoke('create_borderless_window', { windowId: label });
      await new Promise((r) => setTimeout(r, 800));
      // Real window: the OHOS arm awaits WindowManager.setWindowTitle — a
      // resolve here IS the completed op, not a fire-and-forget ack.
      await invoke('set_title_on', { label, title: 'ack-chain-ok' });
      // Illegal window: must reject.
      let rejected = false;
      try {
        await invoke('set_title_on', { label: `${label}-bogus`, title: 'nope' });
      } catch (e) {
        rejected = true;
        const msg = String((e as Error)?.message ?? e);
        assert(
          msg.includes('not found'),
          `bogus-label set_title should reject with not-found, got: ${msg}`
        );
      }
      assert(rejected, 'bogus-label set_title must reject, not fake-ack');
    },
  },

  // ── fix-variant M3 (#219): tracked reject reaching invoke Err. The #80
  // illegal-label leg is rejected by get_webview_window at the tauri layer and
  // never reaches ArkTS. This probe resolves a REAL window first, then drives
  // the ArkTS window-command chain into a deterministic failure with a
  // wire-valid but unknown window id — the rejection must come back from the
  // ArkTS tracked op (`set-title failed: …`) as invoke Err, never a fake
  // success ack.
  {
    name: 'window tracked reject reaches invoke Err via ArkTS op (#219 M3)',
    category: 'auto',
    timeout: 15000,
    async fn() {
      const result = await invoke<any>('tracked_reject_probe');
      if (result && result.tracked_reject === false) {
        // Desktop (non-OHOS) build: the probe is a no-op there.
        assert(
          typeof result.skipped === 'string',
          `desktop probe must report its skip reason, got ${JSON.stringify(result)}`
        );
        return;
      }
      assert(
        result && result.tracked_reject === true,
        `tracked reject must reach invoke Err, got: ${JSON.stringify(result)}`
      );
      assert(
        typeof result.error === 'string' && result.error.includes('set-title failed'),
        `rejection must originate at the ArkTS tracked op, got: ${result.error}`
      );
    },
  },

  // ── fix-variant M1 (#186): the intercept response-header write path. The
  // Rust protocol handler sets ACAO + Expose-Headers + an echo header; before
  // the write path those were dropped at the wry→ArkTS seam. The vehicle is a
  // useHttpsScheme sub-window: the main window runs use_https=false, so the
  // https://<scheme>.localhost URL space — and with it the ArkTS
  // setResponseHeader chain — only exists inside a useHttpsScheme webview
  // (device-proven: the same fetch from the main page is a real-DNS failure).
  // The probe page (p3-m1-probe.js) fetches https://myapp.localhost
  // cross-origin, reads the echo header from response.headers, and reports via
  // document.title → the EXISTING document-title-changed emit (no IPC from the
  // probe page needed).
  {
    name: 'https-intercept response headers reach the page (#186 M1)',
    category: 'auto',
    timeout: 25000,
    async fn() {
      const label = await invoke<string>('create_isolated_window', {
        windowId: 'p3-m1-probe',
        dataSuffix: 'm1probe',
        url: '/p3-m1-probe.html',
        useHttps: true,
      });
      let unlisten: (() => void) | null = null;
      try {
        const title = await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(
            () =>
              reject(
                new Error(
                  'M1 probe: no document-title-changed with M1- prefix within 18s ' +
                  '(probe page load, https-intercept chain, or CSP blocked the fetch)'
                )
              ),
            18000
          );
          listen<string>('document-title-changed', (event) => {
            const t = String(event.payload ?? '');
            if (t.startsWith('M1-')) {
              clearTimeout(timer);
              resolve(t);
            }
          }).then((u) => {
            unlisten = u;
          });
        });
        assert(
          title.startsWith('M1-OK:'),
          `M1 probe reported failure: ${title}`
        );
        assert(
          title.includes('echo=p3-m1-response-header'),
          `Rust handler response header must reach the page, probe title: ${title}`
        );
      } finally {
        if (unlisten) unlisten();
        const win = await WebviewWindow.getByLabel(label);
        if (win) await win.destroy();
      }
    },
  },
];
