import { skip, type TestCase } from '../test-runner';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

/** True when an error indicates the plugin/command is not available on this
 *  platform (not registered / not implemented). Use to skip — never pass. */
function isMissing(e: unknown): boolean {
  const m = String((e as Error)?.message ?? e);
  return m.includes('not found') || m.includes('not implemented') || m.includes('command not found') || m.includes('not allowed by ACL') || m.includes('not supported');
}

/**
 * OHOS pasteboard reads require the restricted READ_PASTEBOARD permission
 * (user_grant, signing-profile-ACL-gated). Without the grant the pasteboard
 * service rejects even the app's own just-written data and getData() resolves
 * empty, so readImage surfaces "clipboard does not contain an image" right
 * after a successful writeImage. Same degradation contract as the readText
 * round-trip test (empty read ⇒ honest skip, not a failed round-trip); with
 * the grant (and on desktop) the byte-exact assertions still hold.
 */
async function isOhosClipboardReadDenied(e: unknown): Promise<boolean> {
  if (!String((e as Error)?.message ?? e).includes('does not contain an image')) {
    return false;
  }
  const { platform } = await import('@tauri-apps/plugin-os');
  return platform() === 'ohos';
}

/** Unique suffix to avoid cross-test state collision (store/db/snapshot names). */
let _seq = 0;
function uniq(prefix: string): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}

/**
 * Fetch with retry for external endpoints (e.g. httpbin.org).
 * Retries up to 3 times with 1s delay on 503 or network errors.
 */
async function retryFetch(
  url: string,
  init: Parameters<typeof globalThis.fetch>[1],
  maxRetries = 3
): Promise<Response> {
  const { fetch } = await import('@tauri-apps/plugin-http');
  const opts = { ...init, connectTimeout: 3000 };
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, opts);
      if (resp.status !== 503 || attempt === maxRetries) return resp;
      lastError = new Error(`HTTP 503 from ${url}`);
    } catch (e) {
      lastError = e;
    }
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastError;
}

export const pluginTests: TestCase[] = [
  // @tauri-apps/plugin-os
  {
    name: '@tauri-apps/plugin-os.platform',
    category: 'auto',
    async fn() {
      const { platform } = await import('@tauri-apps/plugin-os');
      const p = platform();
      assert(typeof p === 'string' && p.length > 0, `expected non-empty string, got "${p}"`);
    },
  },

  // @tauri-apps/plugin-log
  // NOTE: log writes to Rust stdout (hilog on OHOS). The log plugin exposes no
  // front-end-readable target (only Stdout/Folder/LogDir), and the builder stage
  // has no app handle to resolve a writable OHOS path. So these are smoke-level
  // (callable without error), not content-asserting — honestly, not fake-green.
  {
    name: '@tauri-apps/plugin-log.trace',
    category: 'auto',
    async fn() {
      const { trace } = await import('@tauri-apps/plugin-log');
      await trace('test trace message');
    },
  },
  {
    name: '@tauri-apps/plugin-log.debug',
    category: 'auto',
    async fn() {
      const { debug } = await import('@tauri-apps/plugin-log');
      await debug('test debug message');
    },
  },
  {
    name: '@tauri-apps/plugin-log.info',
    category: 'auto',
    async fn() {
      const { info } = await import('@tauri-apps/plugin-log');
      await info('test info message');
    },
  },
  {
    name: '@tauri-apps/plugin-log.warn',
    category: 'auto',
    async fn() {
      const { warn } = await import('@tauri-apps/plugin-log');
      await warn('test warn message');
    },
  },
  {
    name: '@tauri-apps/plugin-log.error',
    category: 'auto',
    async fn() {
      const { error } = await import('@tauri-apps/plugin-log');
      await error('test error message');
    },
  },

  // @tauri-apps/plugin-http
  //
  // Most HTTP tests use the local echo server (localhost:3003) started in
  // src-tauri/src/lib.rs to avoid flaky failures from external services.
  // Only tests that genuinely need a real remote endpoint (TLS handshake,
  // specific JSON structure) still target httpbin.org with retry logic.
  {
    name: '@tauri-apps/plugin-http.fetch (GET)',
    category: 'auto',
    async fn() {
      const { fetch } = await import('@tauri-apps/plugin-http')
      const resp = await fetch('http://localhost:3003/get', { method: 'GET' })
      assert(resp.status === 200, `expected status 200, got ${resp.status}`)
    }
  },
  {
    name: '@tauri-apps/plugin-http.fetch (POST)',
    category: 'auto',
    async fn() {
      const { fetch } = await import('@tauri-apps/plugin-http')
      const body = JSON.stringify({ test: 'post-data' })
      const resp = await fetch('http://localhost:3003/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      })
      assert(resp.status === 200, `expected status 200, got ${resp.status}`)
      // Echo server returns the request body as-is
      const data = await resp.text()
      assert(
        data === body,
        `body mismatch: ${data}`
      )
    }
  },
  {
    name: '@tauri-apps/plugin-http.fetch (PUT)',
    category: 'auto',
    async fn() {
      const { fetch } = await import('@tauri-apps/plugin-http')
      const body = JSON.stringify({ update: 'put-data' })
      const resp = await fetch('http://localhost:3003/put', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body
      })
      assert(resp.status === 200, `expected status 200, got ${resp.status}`)
      const data = await resp.text()
      assert(
        data === body,
        `body mismatch: ${data}`
      )
    }
  },
  {
    name: '@tauri-apps/plugin-http.fetch (DELETE)',
    category: 'auto',
    async fn() {
      const { fetch } = await import('@tauri-apps/plugin-http')
      const resp = await fetch('http://localhost:3003/delete', {
        method: 'DELETE'
      })
      assert(resp.status === 200, `expected status 200, got ${resp.status}`)
    }
  },
  {
    name: '@tauri-apps/plugin-http.fetch (custom headers)',
    category: 'auto',
    async fn() {
      const { fetch } = await import('@tauri-apps/plugin-http')
      const resp = await fetch('http://localhost:3003/headers', {
        method: 'GET',
        headers: {
          'X-Custom-Header': 'test-value-123',
          'X-Another-Header': 'another-value'
        }
      })
      assert(resp.status === 200, `expected status 200, got ${resp.status}`)
      // Echo server reflects request headers in response headers
      const customHeader = resp.headers.get('X-Custom-Header')
      assert(
        customHeader === 'test-value-123',
        `custom header mismatch: ${customHeader}`
      )
      const anotherHeader = resp.headers.get('X-Another-Header')
      assert(
        anotherHeader === 'another-value',
        `another header mismatch: ${anotherHeader}`
      )
    }
  },
  {
    name: '@tauri-apps/plugin-http.fetch (JSON parse)',
    category: 'auto',
    async fn() {
      // Local echo-server /json fixture (deterministic — the external
      // jsonplaceholder route was flaky from the test network: 50% packet
      // loss blew the 5s test cap). External HTTPS stays covered by the
      // rustls-tls test below.
      const resp = await retryFetch('http://localhost:3003/json', { method: 'GET' })
      assert(resp.status === 200, `expected status 200, got ${resp.status}`)
      const data = await resp.json()
      assert(typeof data === 'object', 'expected JSON object')
      assert(data.title !== undefined, 'expected title property')
    }
  },
  {
    name: '@tauri-apps/plugin-http.fetch (HTTPS/rustls-tls)',
    category: 'auto',
    async fn() {
      // Use example.com — IANA-managed, extremely reliable
      const resp = await retryFetch('https://www.example.com', { method: 'GET' })
      assert(
        resp.status === 200,
        `HTTPS connection failed with status ${resp.status}`
      )
      assert(
        resp.url.startsWith('https://'),
        `expected HTTPS URL, got ${resp.url}`
      )
    }
  },
  {
    name: '@tauri-apps/plugin-http.fetch (error handling)',
    category: 'auto',
    async fn() {
      const { fetch } = await import('@tauri-apps/plugin-http')
      const resp = await fetch('http://localhost:3003/status/404', {
        method: 'GET'
      })
      assert(resp.status === 404, `expected status 404, got ${resp.status}`)
      assert(!resp.ok, 'expected resp.ok to be false for 404')
    }
  },

  // @tauri-apps/plugin-fs
  {
    name: '@tauri-apps/plugin-fs.mkdir+writeFile+stat+readFile+exists+readDir+removeFile+removeDir',
    category: 'side-effect',
    async fn() {
      const { mkdir, writeFile, stat, readFile, exists, readDir, remove } = await import('@tauri-apps/plugin-fs');
      const { appCacheDir } = await import('@tauri-apps/api/path');

      const base = await appCacheDir();
      const testDir = `${base}/tauri-test-${Date.now()}`;
      const testFile = `${testDir}/test.txt`;
      const content = new TextEncoder().encode('hello tauri fs');

      await mkdir(testDir, { recursive: true });
      await writeFile(testFile, content);

      const info = await stat(testFile);
      assert(info.size === content.length, `stat size mismatch: ${info.size} vs ${content.length}`);

      const fileExists = await exists(testFile);
      assert(fileExists === true, 'exists returned false for written file');

      const read = await readFile(testFile);
      const decoded = new TextDecoder().decode(read);
      assert(decoded === 'hello tauri fs', `readFile content mismatch: "${decoded}"`);

      const entries = await readDir(testDir);
      assert(entries.length >= 1, `readDir returned ${entries.length} entries, expected >= 1`);

      await remove(testFile);
      await remove(testDir, { recursive: true });

      const afterRemove = await exists(testFile);
      assert(afterRemove === false, 'file still exists after remove');
    },
  },

  // @tauri-apps/plugin-autostart
  // On OHOS, getAutoStartupStatusForSelf is API 21+ — on lower API levels
  // isEnabled rejects with the unified version error. Both outcomes are the
  // documented contract; assert whichever fires (desktop always returns a
  // boolean).
  {
    name: '@tauri-apps/plugin-autostart.isEnabled',
    category: 'auto',
    async fn() {
      const { isEnabled } = await import('@tauri-apps/plugin-autostart');
      let result: boolean;
      try {
        result = await isEnabled();
      } catch (e) {
        const m = String((e as Error)?.message ?? e);
        assert(/isEnabled requires API level 21\+ on OpenHarmony/.test(m), `isEnabled should return a boolean or the unified version error, got: ${m}`);
        return;
      }
      assert(typeof result === 'boolean', `isEnabled should return boolean, got ${typeof result}`);
    },
  },

  // @tauri-apps/plugin-clipboard-manager
  // category 'auto' (was 'side-effect'). On OHOS the write path works; reads
  // are permission-gated by the restricted READ_PASTEBOARD permission
  // (platform limitation #1) and the bridge resolves with an empty string when the
  // grant is absent — skip honestly on an empty read instead of failing the
  // round-trip. With the grant (and on desktop) the round-trip assertion
  // holds.
  {
    name: '@tauri-apps/plugin-clipboard-manager.writeText+readText',
    category: 'auto',
    async fn() {
      const { writeText, readText } = await import('@tauri-apps/plugin-clipboard-manager');
      const { platform } = await import('@tauri-apps/plugin-os');
      const testStr = `tauri-test-${Date.now()}`;
      await writeText(testStr);
      if (platform() === 'ohos') {
        // OHOS: clipboard reads are permission-gated (READ_PASTEBOARD).
        // Without the grant the bridge resolves with an empty string
        // (known platform limitation #1) — skip honestly; with the grant
        // the round-trip still holds.
        const result = await readText();
        if (result === '') {
          skip('readText resolved empty (READ_PASTEBOARD not granted) — known OHOS platform limitation');
        } else {
          assert(result === testStr, `clipboard mismatch: "${result}" vs "${testStr}"`);
        }
        return;
      }
      const result = await readText();
      assert(result === testStr, `clipboard mismatch: "${result}" vs "${testStr}"`);
    },
  },
  {
    name: '@tauri-apps/plugin-clipboard-manager.writeImage',
    category: 'side-effect',
    async fn() {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      // Valid 1x1 red pixel PNG
      const png = new Uint8Array([
        137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,
        0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,
        222,0,0,0,12,73,68,65,84,120,156,99,248,207,192,0,
        0,3,1,1,0,201,254,146,239,0,0,0,0,73,69,78,
        68,174,66,96,130
      ]);
      await writeImage(png);
    },
  },
  // writeImage with number[] — verifies visit_seq deserialization path
  {
    name: '@tauri-apps/plugin-clipboard-manager.writeImage(number[])',
    category: 'side-effect',
    async fn() {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const png = [
        137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,
        0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,
        222,0,0,0,12,73,68,65,84,120,156,99,248,207,192,0,
        0,3,1,1,0,201,254,146,239,0,0,0,0,73,69,78,
        68,174,66,96,130
      ];
      await writeImage(png);
    },
  },
  // writeImage with Image object — verifies Resource/rid path
  {
    name: '@tauri-apps/plugin-clipboard-manager.writeImage(Image)',
    category: 'side-effect',
    async fn() {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const { Image } = await import('@tauri-apps/api/image');
      const rgba = new Uint8Array([255, 0, 0, 255]);
      const img = await Image.new(rgba, 1, 1);
      await writeImage(img);
    },
  },
  // writeImage with larger RGBA — verifies non-trivial data size through TSFN.
  // readImage readback included since issue Eulogizethesun/tauri#113 (OHOS
  // bridge read-image); previously category 'manual' with an isMissing skip.
  {
    name: '@tauri-apps/plugin-clipboard-manager.writeImage(4x4)+readImage',
    category: 'side-effect',
    async fn() {
      const { writeImage, readImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const rgba = new Uint8Array([
        255,0,0,255,    0,255,0,255,    0,0,255,255,    255,255,0,255,
        128,0,0,128,    0,128,0,128,    0,0,128,128,    128,128,0,128,
        64,0,0,64,      0,64,0,64,      0,0,64,64,      64,64,0,64,
        32,0,0,32,      0,32,0,32,      0,0,32,32,      32,32,0,32,
      ]);
      const { Image } = await import('@tauri-apps/api/image');
      const img = await Image.new(rgba, 4, 4);
      try {
        await writeImage(img);
        // Strong assertion: read back the image. readImage may be unimplemented
        // on OHOS (clipboard is partial) — in that case skip honestly.
        const readBack = await readImage();
        const backRgba = await readBack.rgba();
        assert(backRgba.length > 0, `readback rgba should be non-empty, got length ${backRgba.length}`);
      } catch (e) {
        if (isMissing(e)) skip(`clipboard readImage not available: ${e}`);
        if (await isOhosClipboardReadDenied(e)) {
          skip('readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation');
        }
        throw e;
      }
    },
  },
  // #118 checklist V5, issue #113 (OHOS readImage) — on-device verification:
  // (1) two consecutive readImage calls with no write in between sanity-check
  // that the ArkTS readImageFromClipboard finally { pm?.release() } does not
  // poison the next read (R28 proved at source level that pasteboard getData
  // deep-copies, so release is harmless — this confirms it on a real device);
  // (2) the 4x4 pattern is alpha-diagnostic: row1 (non-trivial rgb + 50%
  // alpha) catches the premul-label defect — straight data mislabeled
  // PREMUL gets unpremultiplied at PNG encode, clamping rgb UP
  // ((200,100,50)@128 → (255,199,100)); row3 (alpha=0) catches alpha
  // dropping (alpha would come back as 255).
  // Explicit 10s timeout: each read is a bridge round-trip plus PNG
  // encode/decode.
  //
  // On-device finding (HAD-W32, API 23, 2026-09-20 run 1, 0/255 rgb
  // pattern): alpha round-tripped byte-exact for all 16 pixels
  // (255/128/64/0), rgb under alpha>0 exact, and rgb under alpha=0 came
  // back ZEROED. Source-attributed root cause: the bridge's
  // writeImageToClipboard created the PixelMap without alphaType, so OHOS
  // labeled straight-alpha data PREMUL and SkPngEncoder unpremultiplied at
  // encode (alpha=0 → rgb zeroed; 0/255 values clamp back identically).
  // Fixed in ClipboardPlugin.ets by passing alphaType: UNPREMUL. rgb under
  // alpha=0 stays don't-care here (robust against other pasteboard
  // sources) — only the alpha byte is asserted there (semanticMismatch).
  // Run 1's hexdump is preserved in
  // faultlogs/v5-readimage-run1-20260920-report.md.
  {
    name: '@tauri-apps/plugin-clipboard-manager.writeImage(4x4 alpha)+readImage x2 [V5 #113]',
    category: 'side-effect',
    timeout: 10000,
    async fn() {
      const { writeImage, readImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const rgba = new Uint8Array([
        255,0,0,255,    0,255,0,255,    0,0,255,255,    255,255,0,255,
        200,100,50,128, 50,200,100,128, 100,50,200,128, 13,77,201,128,
        255,0,0,64,     0,255,0,64,     0,0,255,64,     255,255,0,64,
        255,0,0,0,      0,255,0,0,      0,0,255,0,      255,255,0,0,
      ]);
      const { Image } = await import('@tauri-apps/api/image');
      const img = await Image.new(rgba, 4, 4);
      // Returns '' when byte-identical, else an attributable message: which
      // read, first differing byte index, that pixel's expected vs actual
      // (r,g,b,a), alpha-only vs rgb-also classification, and a hexdump of
      // the first 64 actual bytes (4 bytes = 1 pixel per group).
      const firstMismatch = (label: string, expected: Uint8Array, actual: Uint8Array): string => {
        const groups: string[] = [];
        for (let j = 0; j + 3 < actual.length && j < 64; j += 4) {
          groups.push(
            actual[j].toString(16).padStart(2, '0') +
            actual[j + 1].toString(16).padStart(2, '0') +
            actual[j + 2].toString(16).padStart(2, '0') +
            actual[j + 3].toString(16).padStart(2, '0')
          );
        }
        const hexdump = groups.join(' ');
        if (actual.length !== expected.length) {
          return `${label}: length mismatch — expected ${expected.length} bytes (4x4 rgba), got ${actual.length}; actual first ${groups.length * 4} bytes: ${hexdump}`;
        }
        for (let i = 0; i < expected.length; i++) {
          if (expected[i] !== actual[i]) {
            const px = i - (i % 4); // first byte of the pixel containing byte i
            const e = [expected[px], expected[px + 1], expected[px + 2], expected[px + 3]];
            const a = [actual[px], actual[px + 1], actual[px + 2], actual[px + 3]];
            const alphaOnly = a[3] !== e[3] && a[0] === e[0] && a[1] === e[1] && a[2] === e[2];
            const pixel = px / 4; // 0..15, row = Math.floor(pixel / 4), col = pixel % 4 (width 4)
            return (
              `${label}: first differing byte at index ${i} (pixel ${pixel}: row ${Math.floor(pixel / 4)}, col ${pixel % 4}); ` +
              `expected rgba(${e.join(',')}) but got rgba(${a.join(',')}); ` +
              (alphaOnly
                ? 'alpha only differs (alpha dropped or quantized — e.g. row3 a=0 coming back as 255)'
                : 'rgb also differs (premultiply suspected — e.g. row1 rgb coming back ~128 — or the two reads diverged)') +
              `; actual first ${groups.length * 4} bytes: ${hexdump}`
            );
          }
        }
        return '';
      };
      // V5② semantic comparison against the source pattern: the alpha byte
      // must round-trip exactly for every pixel, and rgb must be exact
      // wherever the source alpha > 0. rgb under source-alpha=0 pixels is
      // don't-care — the OHOS pipeline zeroes it (see header comment).
      const semanticMismatch = (label: string, actual: Uint8Array): string => {
        if (actual.length !== rgba.length) {
          return `read ${label} vs source (semantic): length mismatch — expected ${rgba.length} bytes (4x4 rgba), got ${actual.length}`;
        }
        for (let p = 0; p < actual.length; p += 4) {
          const pixel = p / 4;
          if (actual[p + 3] !== rgba[p + 3]) {
            return (
              `read ${label} vs source (semantic): pixel ${pixel} (row ${Math.floor(pixel / 4)}, col ${pixel % 4}) alpha differs — ` +
              `expected ${rgba[p + 3]}, got ${actual[p + 3]} (V5② alpha round-trip failure)`
            );
          }
          if (
            rgba[p + 3] > 0 &&
            (actual[p] !== rgba[p] || actual[p + 1] !== rgba[p + 1] || actual[p + 2] !== rgba[p + 2])
          ) {
            return (
              `read ${label} vs source (semantic): pixel ${pixel} (row ${Math.floor(pixel / 4)}, col ${pixel % 4}) rgb differs under alpha=${rgba[p + 3]} — ` +
              `expected rgba(${rgba[p]},${rgba[p + 1]},${rgba[p + 2]},${rgba[p + 3]}), ` +
              `got rgba(${actual[p]},${actual[p + 1]},${actual[p + 2]},${actual[p + 3]}) ` +
              `(premultiply round-trip or channel swap suspected)`
            );
          }
        }
        return '';
      };
      try {
        await writeImage(img);
        // Two consecutive reads, NO write in between — if the ArkTS finally
        // { pm?.release() } poisoned the pasteboard entry, read #2 would fail
        // or diverge from read #1.
        const read1 = await readImage();
        const read2 = await readImage();
        // The OHOS bridge can swallow an ArkTS reject into a null resolve —
        // guard so the failure names which read returned nothing.
        if (!read1) throw new Error('read #1: readImage() resolved null/undefined (ArkTS reject swallowed by bridge?)');
        if (!read2) throw new Error('read #2: readImage() resolved null/undefined (ArkTS reject swallowed by bridge?)');
        const rgba1 = await read1.rgba();
        const rgba2 = await read2.rgba();
        // (a) V5① first: the two consecutive reads must be byte-identical
        // (release-poisoning detector). Ordered first so a source-pattern
        // deviation can never mask the consecutive-read verdict.
        const m1 = firstMismatch('read #2 vs read #1', rgba1, rgba2);
        assert(m1 === '', m1);
        // (b) V5②: read #1 vs source, semantically — alpha byte-exact for
        // every pixel, rgb exact wherever source alpha > 0.
        const m2 = semanticMismatch('#1', rgba1);
        assert(m2 === '', m2);
        // (c) read #2 gets the same semantic treatment, so the verdict holds
        // for the second consecutive read too.
        const m3 = semanticMismatch('#2', rgba2);
        assert(m3 === '', m3);
      } catch (e) {
        if (isMissing(e)) skip(`clipboard readImage not available: ${e}`);
        if (await isOhosClipboardReadDenied(e)) {
          skip('readImage observed an empty pasteboard (READ_PASTEBOARD not granted) — known OHOS platform limitation');
        }
        throw e;
      }
    },
  },
  // writeImage with { rgba, width, height } object — verifies visit_map → JsImage::Rgba
  {
    name: '@tauri-apps/plugin-clipboard-manager.writeImage(rgba-object)',
    category: 'side-effect',
    async fn() {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const rgba = new Uint8Array([255, 0, 0, 255]);
      await writeImage({ rgba, width: 1, height: 1 });
    },
  },
  // writeImage with data URI string — verifies visit_str → JsImage::DataUri
  {
    name: '@tauri-apps/plugin-clipboard-manager.writeImage(data-uri)',
    category: 'side-effect',
    async fn() {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      // Valid 1x1 red pixel PNG (color type 2 = RGB) as data URI
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
      await writeImage(dataUri);
    },
  },
  // writeImage with file path string — verifies visit_str → JsImage::Path
  // Uses fs plugin + path API to create the file, no custom Rust command needed.
  {
    name: '@tauri-apps/plugin-clipboard-manager.writeImage(path)',
    category: 'side-effect',
    async fn() {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const { cacheDir, join } = await import('@tauri-apps/api/path');
      const png = new Uint8Array([
        137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,
        0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,
        222,0,0,0,12,73,68,65,84,120,156,99,248,207,192,0,
        0,3,1,1,0,201,254,146,239,0,0,0,0,73,69,78,
        68,174,66,96,130
      ]);
      const dir = await cacheDir();
      const filePath = await join(dir, `test-clipboard-${Date.now()}.png`);
      await writeFile(filePath, png);
      await writeImage(filePath);
      // Clean up temp file after test
      const { remove } = await import('@tauri-apps/plugin-fs');
      await remove(filePath);
    },
  },
  // writeImage with ArrayBuffer — verifies visit_seq → JsImage::Bytes (IPC: buffer → sequence)
  {
    name: '@tauri-apps/plugin-clipboard-manager.writeImage(ArrayBuffer)',
    category: 'side-effect',
    async fn() {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const png = new Uint8Array([
        137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,
        0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,
        222,0,0,0,12,73,68,65,84,120,156,99,248,207,192,0,
        0,3,1,1,0,201,254,146,239,0,0,0,0,73,69,78,
        68,174,66,96,130
      ]);
      await writeImage(png.buffer.slice(0));
    },
  },

  // @tauri-apps/plugin-window-state (must run BEFORE autostart — autostart sends
  // app to background on OHOS, disrupting IPC for subsequent tests)
  {
    name: '@tauri-apps/plugin-window-state.filename+save+restore',
    category: 'side-effect',
    timeout: 25000,
    async fn() {
      const { filename, saveWindowState, restoreStateCurrent, StateFlags } = await import('@tauri-apps/plugin-window-state');
      const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
      try {
        const fname = await filename();
        assert(typeof fname === 'string' && fname.length > 0, `filename should be non-empty, got: ${fname}`);
        let originalSize: LogicalSize | null = null;
        try { originalSize = await getCurrentWindow().innerSize(); } catch { /* ignore */ }
        await getCurrentWindow().setSize(new LogicalSize(400, 300));
        await saveWindowState(StateFlags.SIZE);
        await restoreStateCurrent(StateFlags.SIZE);
        if (originalSize && originalSize.width > 0 && originalSize.height > 0) {
          try {
            await getCurrentWindow().setSize(originalSize);
            // OHOS: saveWindowState reads the plugin's in-memory cache, which is
            // refreshed asynchronously by the Resized event (onAreaChange dispatch).
            // Saving immediately after setSize races that dispatch and persists the
            // shrunken 400x300 — the next app launch then restores it. Poll innerSize
            // until the restore has actually landed before saving back.
            const deadline = Date.now() + 5000;
            while (Date.now() < deadline) {
              const cur = await getCurrentWindow().innerSize();
              if (Math.abs(cur.width - originalSize.width) <= 2 && Math.abs(cur.height - originalSize.height) <= 2) break;
              await new Promise((r) => setTimeout(r, 100));
            }
            // Save with ALL (not SIZE) so the OHOS save-time position refresh
            // (outer_position) writes the real position back — a SIZE-only save
            // leaves the cache's creation-time (0,0) in the file, and the next
            // launch's startup restore (StateFlags::all) yanks the window to
            // the top-left corner.
            await saveWindowState(StateFlags.ALL);
          } catch { /* ignore */ }
        }
      } catch (e) {
        if (isMissing(e)) skip(`window-state plugin not available: ${e}`);
        throw e;
      }
    },
  },

  // @tauri-apps/plugin-autostart (side-effect tests moved to end — on OHOS,
  // enable()/disable() call startAbility which sends app to background;
  // placing them last ensures other side-effect tests run first)
  // ⚠️ IMPORTANT: Do NOT add new side-effect tests after this section.
  // These tests MUST remain at the end of the side-effect list because
  // on OHOS they trigger startAbility() which sends the app to background,
  // disrupting any subsequent automated test execution.
  {
    name: '@tauri-apps/plugin-autostart.enable+disable (no throw)',
    category: 'side-effect',
    async fn() {
      const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart');
      await enable();
      const enabled = await isEnabled();
      assert(typeof enabled === 'boolean', `isEnabled should return boolean after enable, got ${typeof enabled}`);
      await disable();
      const disabled = await isEnabled();
      assert(typeof disabled === 'boolean', `isEnabled should return boolean after disable, got ${typeof disabled}`);
    },
  },
  {
    name: '@tauri-apps/plugin-autostart.enable+isEnabled+disable',
    category: 'side-effect',
    async fn() {
      const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart');
      await enable();
      const afterEnable = await isEnabled();
      assert(typeof afterEnable === 'boolean', `isEnabled should return boolean after enable(), got ${typeof afterEnable}`);
      await disable();
      const afterDisable = await isEnabled();
      assert(typeof afterDisable === 'boolean', `isEnabled should return boolean after disable(), got ${typeof afterDisable}`);
      // On Windows/macOS/Linux: enable/disable actually toggle autostart state
      // On OHOS: enable/disable navigate to system settings page, state is unchanged
    },
  },

  // @tauri-apps/plugin-process (manual — kills the process, can't assert)
  {
    name: '@tauri-apps/plugin-process.relaunch',
    category: 'manual',
    async fn() {},
  },

  // @tauri-apps/plugin-dialog (manual)
{
    name: '@tauri-apps/plugin-dialog.open (single)',
    category: 'manual',
    async fn() {},
  },
  {
    name: '@tauri-apps/plugin-dialog.open (multiple)',
    category: 'manual',
    async fn() {},
  },
  {
    // OHOS (issue Eulogizethesun/tauri#99): 2in1 uses MIXED selectMode,
    // Phone uses FOLDER (API 26+). Verify the picker opens and a folder path
    // comes back (previously: "Folder picker is not implemented on mobile").
    // NOTE: manual-category fn is never executed by runTests (test-runner.ts
    // marks manual as skip without calling fn) — the real verification is the
    // TestRunner button "Dialog.open (directory)" (manualDialogOpenDirectory),
    // which self-asserts null-or-non-empty-string. See manual_tests.md §4.
    name: '@tauri-apps/plugin-dialog.open (directory, OHOS)',
    category: 'manual',
    async fn() {
      console.log('[dialog.open manual] Use the "Dialog.open (directory)" button in the TestRunner Dialog manual section');
    },
  },
  {
    name: '@tauri-apps/plugin-dialog.save',
    category: 'manual',
    async fn() {},
  },
  {
    name: '@tauri-apps/plugin-dialog.confirm',
    category: 'manual',
    async fn() {},
  },
  {
    name: '@tauri-apps/plugin-dialog.message (info)',
    category: 'manual',
    async fn() {},
  },
  {
    name: '@tauri-apps/plugin-dialog.message (warning)',
    category: 'manual',
    async fn() {},
  },
  {
    name: '@tauri-apps/plugin-dialog.message (error)',
    category: 'manual',
    async fn() {},
  },

  // @tauri-apps/plugin-shell (manual)
  {
    name: '@tauri-apps/plugin-shell.open',
    category: 'manual',
    async fn() {},
  },

  // @tauri-apps/plugin-notification
  {
    name: '@tauri-apps/plugin-notification.isPermissionGranted',
    category: 'auto',
    async fn() {
      const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
      try {
        const result = await isPermissionGranted();
        assert(typeof result === 'boolean', `isPermissionGranted should return boolean, got ${typeof result}`);
      } catch (e) {
        if (isMissing(e)) skip(`notification command not available: ${e}`);
        throw e;
      }
    },
  },
  {
    name: '@tauri-apps/plugin-notification.createChannel+channels',
    category: 'side-effect',
    async fn() {
      const { createChannel, channels, Importance } = await import('@tauri-apps/plugin-notification');
      try {
        await createChannel({ id: 'tauri-test-channel', name: 'Tauri Test', importance: Importance.Default });
        const chList = await channels();
        assert(Array.isArray(chList), `channels() should return array, got ${typeof chList}`);
        assert(chList.some((c: any) => c.id === 'tauri-test-channel'), `created channel 'tauri-test-channel' not found in channels() result`);
      } catch (e) {
        if (isMissing(e)) skip(`notification command not available: ${e}`);
        throw e;
      }
    },
  },
  {
    name: '@tauri-apps/plugin-notification.cancel+cancelAll',
    category: 'side-effect',
    async fn() {
      const { cancel, cancelAll } = await import('@tauri-apps/plugin-notification');
      try {
        await cancel([99999]);
        await cancelAll();
      } catch (e) {
        if (isMissing(e)) skip(`notification command not available: ${e}`);
        throw e;
      }
    },
  },
  {
    name: '@tauri-apps/plugin-notification.removeChannel',
    category: 'side-effect',
    async fn() {
      const { createChannel, removeChannel, channels, Importance } = await import('@tauri-apps/plugin-notification');
      try {
        await createChannel({ id: 'tauri-rm-test', name: 'Tauri Remove Test', importance: Importance.Low });
        const before = await channels();
        assert(Array.isArray(before), `channels() should return array`);
        assert(before.some((c: any) => c.id === 'tauri-rm-test'), `channel 'tauri-rm-test' not found after create`);
        await removeChannel('tauri-rm-test');
        const after = await channels();
        assert(Array.isArray(after), `channels() should return array after remove`);
        assert(!after.some((c: any) => c.id === 'tauri-rm-test'), `channel 'tauri-rm-test' still present after removeChannel()`);
      } catch (e) {
        if (isMissing(e)) skip(`notification command not available: ${e}`);
        throw e;
      }
    },
  },
  {
    name: '@tauri-apps/plugin-notification.pending+active',
    category: 'auto',
    async fn() {
      const { pending, active } = await import('@tauri-apps/plugin-notification');
      try {
        const pendingList = await pending();
        assert(Array.isArray(pendingList), `pending() should return array, got ${typeof pendingList}`);
        const activeList = await active();
        assert(Array.isArray(activeList), `active() should return array, got ${typeof activeList}`);
      } catch (e) {
        if (isMissing(e)) skip(`notification command not available: ${e}`);
        throw e;
      }
    },
  },
  // Scheduled notification — OHOS routes through reminderAgentManager
  // (issue Eulogizethesun/tauri#114); since the foreground-timer fallback was
  // removed (review R40) a publishReminder failure rejects instead of
  // resolving. Entitled devices register the notification in pending(); the
  // fired popup is verified visually.
  {
    name: '@tauri-apps/plugin-notification.notify(schedule at)',
    category: 'side-effect',
    // 60s: on devices without the AGC agent-reminder entitlement the
    // publishReminder 1700002 rejection is SLOW — observed 15s (run 1) and
    // >30s (run 2) on the reference PC before the rejection arrives.
    // Breadcrumbs below pinpoint any future hang.
    timeout: 60000,
    async fn() {
      const { isPermissionGranted, sendNotification, pending, cancel } =
        await import('@tauri-apps/plugin-notification');
      console.log('[schedule-test] checking permission');
      const granted = await isPermissionGranted();
      console.log(`[schedule-test] isPermissionGranted=${granted}`);
      // NO requestPermission() here: it pops the interactive enable-notification
      // system dialog, which nothing answers during an automated run — the
      // await hangs until the test timeout (root cause of the 2026-09-11
      // 15s/30s/60s timeout chain; run-tests.sh reinstalls the HAP each run,
      // resetting the grant). Enable notifications for the app manually to
      // exercise the full schedule path.
      if (!granted) skip('notification permission disabled — enable notifications for this app to run this test');
      const id = Math.floor(Math.random() * 2_000_000_000) + 1;
      console.log(`[schedule-test] sending id=${id}`);
      try {
        await sendNotification({
          id,
          title: 'OHOS scheduled notification',
          body: 'fires ~3s after scheduling (reminderAgentManager, #114)',
          schedule: {
            at: { date: new Date(Date.now() + 3000), repeating: false, allowWhileIdle: false },
          },
        });
      } catch (e) {
        // R40: no foreground-timer fallback anymore — devices without the
        // AGC agent-reminder entitlement (1700002) or with notifications
        // disabled mid-run (1700001) reject.
        const msg = String(e);
        if (/170000[12]/.test(msg)) skip(`schedule rejected on this device (entitlement/notification switch): ${msg}`);
        throw e;
      }
      console.log('[schedule-test] sendNotification resolved');
      const pendingList = await pending();
      console.log(`[schedule-test] pending=${JSON.stringify(pendingList.map((p) => p.id))}`);
      assert(
        pendingList.some((p) => p.id === id),
        `scheduled notification ${id} should appear in pending(): ${JSON.stringify(pendingList.map((p) => p.id))}`
      );
      // Brief wait so the reminder fires during the test — an error on fire
      // would surface in the device logs.
      await new Promise((r) => setTimeout(r, 2000));
      console.log('[schedule-test] canceling');
      await cancel(id).catch(() => {});
      console.log('[schedule-test] done');
    },
  },

  // @tauri-apps/plugin-updater (OpenHarmony: AppGallery-backed update APIs)
  // The desktop updater APIs (check/downloadAndInstall) are not registered on
  // OpenHarmony - updates are handled by AppGallery. On non-OHOS platforms the
  // AG commands are rejected by the ACL ("Command not found") and get skipped.
  {
    name: '@tauri-apps/plugin-updater.checkAppGalleryUpdate',
    category: 'auto',
    async fn() {
      const { checkAppGalleryUpdate } = await import('@tauri-apps/plugin-updater');
      try {
        const update = await checkAppGalleryUpdate();
        // null = no update available (typical in dev: the app is not
        // distributed via AppGallery, the ArkTS side degrades to "no update")
        if (update !== null) {
          assert(update.available === true, `expected available=true when non-null, got ${JSON.stringify(update)}`);
          assert(
            typeof update.currentVersion === 'string' && update.currentVersion.length > 0,
            `currentVersion should be a non-empty string, got ${JSON.stringify(update.currentVersion)}`
          );
          assert(
            update.version === null || typeof update.version === 'string',
            `version should be a string or null, got ${JSON.stringify(update.version)}`
          );
        }
      } catch (e) {
        if (isMissing(e)) skip(`updater AppGallery API not available: ${e}`);
        throw e;
      }
    },
  },
  {
    // Opens the AppGallery system update dialog - user-driven, requires human
    // interaction; the promise resolving does not mean the update was installed.
    name: '@tauri-apps/plugin-updater.showAppGalleryUpdateDialog',
    category: 'manual',
    async fn() {},
  },

  // @tauri-apps/plugin-webview User-Agent tests (OHOS)
  // User-Agent is set via WebviewBuilder in Rust, requires manual verification
  // Use the manual test buttons in "WebView User-Agent Manual Tests" section
  {
    name: '@tauri-apps/plugin-webview.userAgent (custom)',
    category: 'manual',
    async fn() {
      // Manual test: Click "userAgent (custom)" button in the WebView User-Agent section
      // This creates a WebviewWindow with custom UA "MyApp/1.0 Tauri/2.0"
      // The loaded page displays navigator.userAgent for visual verification
      console.log('[webview.userAgent] Use the "userAgent (custom)" button in the manual test section');
      console.log('[webview.userAgent] Expected: New window opens with page showing custom UA');
    },
  },
  {
    name: '@tauri-apps/plugin-webview.userAgent (default)',
    category: 'manual',
    async fn() {
      // Manual test: Click "userAgent (default)" button in the WebView User-Agent section
      console.log('[webview.userAgent] Use the "userAgent (default)" button in the manual test section');
      console.log('[webview.userAgent] Expected: New window opens with page showing system default UA');
    },
  },

  // sentry-plugin-sentry
  {
    name: 'tauri-plugin-sentry.breadcrumb',
    category: 'auto',
    async fn() {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('plugin:sentry|breadcrumb', {
          breadcrumb: {
            message: 'auto-test breadcrumb from OHOS',
            category: 'test',
            level: 'info',
            timestamp: Date.now() / 1000,
          }
        });
      } catch (e) {
        if (isMissing(e)) skip(`sentry not registered: ${e}`);
        throw e;
      }
    },
  },
  // @tauri-apps/plugin-global-shortcut
  {
    name: '@tauri-apps/plugin-global-shortcut.register+isRegistered',
    category: 'auto',
    async fn() {
      const { register, isRegistered, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      const shortcut = 'CommandOrControl+Shift+T';
      try {
        await register(shortcut, () => {});
        const result = await isRegistered(shortcut);
        assert(result === true, `isRegistered should return true after register, got ${result}`);
      } finally {
        try { await unregister(shortcut); } catch (_) {}
      }
    },
  },
  {
    name: '@tauri-apps/plugin-global-shortcut.unregister+isRegistered',
    category: 'auto',
    async fn() {
      const { register, isRegistered, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      const shortcut = 'CommandOrControl+Shift+T';
      try {
        await register(shortcut, () => {});
        await unregister(shortcut);
        const result = await isRegistered(shortcut);
        assert(result === false, `isRegistered should return false after unregister, got ${result}`);
      } finally {
        try { await unregister(shortcut); } catch (_) {}
      }
    },
  },
  {
    name: '@tauri-apps/plugin-global-shortcut.unregisterAll',
    category: 'auto',
    async fn() {
      const { register, isRegistered, unregisterAll } = await import('@tauri-apps/plugin-global-shortcut');
      const shortcut = 'CommandOrControl+Shift+T';
      await register(shortcut, () => {});
      await unregisterAll();
      const result = await isRegistered(shortcut);
      assert(result === false, `isRegistered should return false after unregisterAll, got ${result}`);
    },
  },
  {
    name: '@tauri-apps/plugin-global-shortcut.multipleCycles',
    category: 'side-effect',
    async fn() {
      const { register, isRegistered, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      const shortcut = 'CommandOrControl+Shift+T';
      try {
        for (let i = 0; i < 3; i++) {
          await register(shortcut, () => {});
          const reg = await isRegistered(shortcut);
          assert(reg === true, `cycle ${i}: isRegistered should be true after register`);
          await unregister(shortcut);
          const unreg = await isRegistered(shortcut);
          assert(unreg === false, `cycle ${i}: isRegistered should be false after unregister`);
        }
      } finally {
        try { await unregister(shortcut); } catch (_) {}
      }
    },
  },
  {
    name: 'tauri-plugin-sentry.envelope',
    category: 'auto',
    async fn() {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const header = JSON.stringify({ event_id: 'a'.repeat(32), dsn: 'https://test@sentry.io/1' });
        const itemHeader = JSON.stringify({ type: 'event', content_type: 'application/json' });
        const itemPayload = JSON.stringify({
          event_id: 'a'.repeat(32),
          timestamp: Date.now() / 1000,
          platform: 'javascript',
          level: 'error',
          message: { formatted: 'auto-test envelope from OHOS' }
        });
        const envelope = `${header}\n${itemHeader}\n${itemPayload}\n`;
        await invoke('plugin:sentry|envelope', { envelope });
      } catch (e) {
        if (isMissing(e)) skip(`sentry not registered: ${e}`);
        throw e;
      }
    },
  },
  {
    name: '@tauri-apps/plugin-global-shortcut.triggerCallback',
    category: 'manual',
    async fn() {
      // Manual test: Click the "Register Shortcut" button in the Global Shortcut section
      // It registers CommandOrControl+Shift+T and waits for the user to press it
      console.log('[global-shortcut] Use the "Register Shortcut" button in the manual test section');
      console.log('[global-shortcut] Press Ctrl+Shift+T on physical keyboard to trigger callback');
    },
  },
  // ─── Boundary tests for preKeys ───
  {
    name: '@tauri-apps/plugin-global-shortcut.singleModifier',
    category: 'auto',
    async fn() {
      const { register, isRegistered, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      const shortcut = 'CommandOrControl+T';
      try {
        await register(shortcut, () => {});
        const result = await isRegistered(shortcut);
        assert(result === true, `1 modifier: isRegistered should be true, got ${result}`);
      } finally {
        try { await unregister(shortcut); } catch (_) {}
      }
    },
  },
  {
    name: '@tauri-apps/plugin-global-shortcut.twoModifiers',
    category: 'auto',
    async fn() {
      const { register, isRegistered, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      const shortcut = 'CommandOrControl+Shift+T';
      try {
        await register(shortcut, () => {});
        const result = await isRegistered(shortcut);
        assert(result === true, `2 modifiers: isRegistered should be true, got ${result}`);
      } finally {
        try { await unregister(shortcut); } catch (_) {}
      }
    },
  },
  {
    name: '@tauri-apps/plugin-global-shortcut.threeModifiers_fails',
    category: 'auto',
    async fn() {
      const { register, isRegistered, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      const shortcut = 'CommandOrControl+Shift+Alt+T';
      // SDK: max 2 modifiers → 3 must be rejected (register throws OR isRegistered===false).
      let registered = false;
      try {
        await register(shortcut, () => {});
        registered = await isRegistered(shortcut);
      } catch (_) {
        registered = false;
      } finally {
        try { await unregister(shortcut); } catch (_) {}
      }
      assert(registered === false, `3 modifiers should be rejected, isRegistered=${registered}`);
    },
  },
  {
    name: 'tauri-plugin-sentry.rust_breadcrumb',
    category: 'auto',
    async fn() {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('sentry_test_breadcrumb');
      } catch (e) {
        if (isMissing(e)) skip(`sentry not registered: ${e}`);
        throw e;
      }
    },
  },
  {
    name: '@tauri-apps/plugin-global-shortcut.noModifier_fails',
    category: 'auto',
    async fn() {
      const { register, unregister, isRegistered } = await import('@tauri-apps/plugin-global-shortcut');
      // No modifier → preKeys empty → must be rejected (register throws OR isRegistered===false).
      let registered = false;
      try {
        await register('T', () => {});
        registered = await isRegistered('T');
      } catch (_) {
        registered = false;
      } finally {
        try { await unregister('T'); } catch (_) {}
      }
      assert(registered === false, `no-modifier shortcut should be rejected, isRegistered=${registered}`);
    },
  },
  {
    name: '@tauri-apps/plugin-global-shortcut.invalidKey_fails',
    category: 'auto',
    async fn() {
      const { register } = await import('@tauri-apps/plugin-global-shortcut');
      try {
        await register('CommandOrControl+NonExistentKey123', () => {});
        assert(false, 'Should have thrown for invalid key');
      } catch (e) {
        // Expected: invalid key name
        console.log(`[global-shortcut] invalid key: register threw (expected): ${e}`);
      }
    },
  },
  {
    name: '@tauri-apps/plugin-global-shortcut.duplicateModifier',
    category: 'auto',
    async fn() {
      const { register, isRegistered, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      // Duplicate modifier: must either register (isRegistered===true) or throw —
      // silently registering-as-false without throwing is a bug.
      const shortcut = 'CommandOrControl+CommandOrControl+T';
      let registered = false;
      let threw = false;
      try {
        await register(shortcut, () => {});
        registered = await isRegistered(shortcut);
      } catch (_) {
        threw = true;
      } finally {
        try { await unregister(shortcut); } catch (_) {}
      }
      assert(registered === true || threw === true, `duplicate modifier: expected register or throw, got isRegistered=${registered} threw=${threw}`);
    },
  },
  {
    name: '@tauri-apps/plugin-global-shortcut.duplicateRegister',
    category: 'auto',
    async fn() {
      const { register, isRegistered, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      const shortcut = 'CommandOrControl+T';
      try {
        // Register once
        await register(shortcut, () => {});
        assert(await isRegistered(shortcut), 'should be registered after first register');
        // Register same shortcut again - should not throw
        try {
          await register(shortcut, () => {});
          // Still registered after duplicate registration
          assert(await isRegistered(shortcut), 'should still be registered after duplicate register');
        } catch (e) {
          // If it throws, that's also acceptable behavior
          console.log(`[global-shortcut] duplicate register threw: ${e}`);
        }
        await unregister(shortcut);
        assert(!(await isRegistered(shortcut)), 'should not be registered after unregister');
      } finally {
        try { await unregister(shortcut); } catch (_) {}
      }
    },
  },
  {
    name: '@tauri-apps/plugin-global-shortcut.unregisterNotRegistered',
    category: 'auto',
    async fn() {
      const { unregister, isRegistered } = await import('@tauri-apps/plugin-global-shortcut');
      const shortcut = 'CommandOrControl+Shift+Z';
      // Ensure not registered
      assert(!(await isRegistered(shortcut)), 'should not be registered initially');
      // Unregister a shortcut that was never registered - should not throw
      try {
        await unregister(shortcut);
      } catch (e) {
        assert(false, `unregistering non-registered shortcut should not throw, got: ${e}`);
      }
    },
  },
  // @tauri-apps/plugin-deep-link
  {
    name: '@tauri-apps/plugin-deep-link.getCurrent',
    category: 'auto',
    async fn() {
      const { getCurrent } = await import('@tauri-apps/plugin-deep-link');
      const result = await getCurrent();
      console.log('[deep-link auto] getCurrent result:', JSON.stringify(result));
      assert(result === null || Array.isArray(result), `getCurrent should return null or array, got ${result}`);
    },
  },
  {
    name: '@tauri-apps/plugin-deep-link.isRegistered',
    category: 'auto',
    async fn() {
      const { isRegistered } = await import('@tauri-apps/plugin-deep-link');
      const { platform } = await import('@tauri-apps/plugin-os');
      if (platform() === 'ohos') {
        // OHOS: schemes are statically declared in module.json5; the query
        // rejects with the unified platform error instead of returning a
        // constant false.
        let rejected = false;
        try {
          await isRegistered('myapp');
        } catch (e) {
          rejected = true;
          const m = String((e as Error)?.message ?? e);
          assert(
            m.includes('isRegistered is not supported on OpenHarmony'),
            `isRegistered should reject with the unified platform error on OHOS, got: ${m}`,
          );
        }
        assert(rejected, 'isRegistered should reject on OHOS (static scheme declaration)');
        return;
      }
      const result = await isRegistered('myapp');
      assert(typeof result === 'boolean', `isRegistered should return boolean, got ${typeof result}`);
    },
  },
  {
    name: '@tauri-apps/plugin-deep-link.register+unregister',
    category: 'auto',
    async fn() {
      const { register, unregister } = await import('@tauri-apps/plugin-deep-link');
      const { platform } = await import('@tauri-apps/plugin-os');
      if (platform() === 'ohos') {
        // OHOS: runtime registration is unsupported (static module.json5
        // declaration); both calls reject with the unified platform error.
        for (const [op, fn] of [['register', register], ['unregister', unregister]] as const) {
          let rejected = false;
          try {
            await fn('myapp');
          } catch (e) {
            rejected = true;
            const m = String((e as Error)?.message ?? e);
            assert(
              m.includes(`${op} is not supported on OpenHarmony`),
              `${op} should reject with the unified platform error on OHOS, got: ${m}`,
            );
          }
          assert(rejected, `${op} should reject on OHOS (static scheme declaration)`);
        }
        return;
      }
      // Desktop/mobile: runtime registration works, should not throw
      await register('myapp');
      await unregister('myapp');
    },
  },
  {
    name: '@tauri-apps/plugin-deep-link.onOpenUrl register',
    category: 'auto',
    async fn() {
      const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
      const unlisten = await onOpenUrl(() => {});
      assert(typeof unlisten === 'function', `onOpenUrl should return UnlistenFn, got ${typeof unlisten}`);
      unlisten();
    },
  },
  {
    name: '@tauri-apps/plugin-deep-link.onOpenUrl trigger (manual)',
    category: 'manual',
    async fn() {
      const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
      const unlisten = await onOpenUrl((urls) => {
        console.log('[deep-link manual] onOpenUrl received:', urls);
      });
      console.log('[deep-link manual] Run: hdc shell aa start -a ohos.want.action.viewData -d taurideeplink://path');
      console.log('[deep-link manual] Expect onOpenUrl callback with ["taurideeplink://path"]');
      unlisten();
    },
  },
  {
    name: '@tauri-apps/plugin-deep-link.getCurrent cold-start (manual)',
    category: 'manual',
    async fn() {
      const { getCurrent } = await import('@tauri-apps/plugin-deep-link');
      const result = await getCurrent();
      console.log('[deep-link manual] getCurrent result:', JSON.stringify(result));
      console.log('[deep-link manual] Cold-start app via taurideeplink://path, expect getCurrent returns ["taurideeplink://path"]');
    },
  },
  {
    name: '@tauri-apps/plugin-deep-link external launch (manual)',
    category: 'manual',
    async fn() {
      console.log('[deep-link manual] Click taurideeplink://path link from browser/other app');
      console.log('[deep-link manual] Expect app brought to foreground + onOpenUrl fired');
    },
  },

  // ===== Phase 1: previously-untested plugins =====

  // @tauri-apps/plugin-store
  // Previously manual due to plugins-lock timeout + AppFreeze crash on Exit.
  // After extend_api spawn_blocking (OHOS never blocks main thread) + upload IPC
  // fix (postMessage instead of custom protocol), the 5 sibling plugins that
  // timed out (sql/websocket/window-state/persisted-scope/cli) now pass. store
  // invoke path is the same (extend_api → spawn_blocking → store command), and
  // the test only exercises invoke commands — it does not touch the Exit path.
  // The on_event L448 try_read hardening in plugins/store/src/lib.rs remains as
  // defense-in-depth for the AppFreeze-at-Exit scenario, independent of this test.
  {
    name: '@tauri-apps/plugin-store.set+get+has+keys+entries+delete',
    async fn() {
      const { load } = await import('@tauri-apps/plugin-store');
      try {
        const store = await load(`${uniq('store')}.json`);
        await store.set('a', { n: 1 });
        const got = await store.get<{ n: number }>('a');
        assert(got !== undefined && got.n === 1, `get mismatch: ${JSON.stringify(got)}`);
        assert(await store.has('a'), 'has should be true after set');
        const keys = await store.keys();
        assert(keys.includes('a'), `keys should contain 'a': ${JSON.stringify(keys)}`);
        assert((await store.length()) >= 1, 'length should be >= 1 after set');
        const entries = await store.entries();
        assert(entries.some((e: any) => e[0] === 'a'), `entries should contain 'a': ${JSON.stringify(entries)}`);
        assert((await store.delete('a')) === true, 'delete should return true');
        assert((await store.get('a')) === undefined, 'get should be undefined after delete');
        assert(!(await store.has('a')), 'has should be false after delete');
        await store.close();
      } catch (e) {
        if (isMissing(e)) skip(`store plugin not available: ${e}`);
        throw e;
      }
    },
  },

  // @tauri-apps/plugin-sql
  {
    name: '@tauri-apps/plugin-sql.load+execute+select+close',
    category: 'auto',
    async fn() {
      const Database = (await import('@tauri-apps/plugin-sql')).default;
      try {
        const db = await Database.load(`sqlite:${uniq('test')}.db`);
        await db.execute('CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
        const ins = await db.execute('INSERT INTO t (name) VALUES ($1)', ['alice']);
        assert(ins.rowsAffected === 1, `insert rowsAffected should be 1, got ${ins?.rowsAffected}`);
        const res: any = await db.select('SELECT * FROM t WHERE name=$1', ['alice']);
        const rows: any[] = Array.isArray(res) ? res : (res?.rows ?? []);
        assert(rows.length === 1, `select should return 1 row, got ${JSON.stringify(res)}`);
        assert(rows[0].name === 'alice', `name mismatch: ${rows[0]?.name}`);
        assert((await db.close()) === true, 'close should return true');
      } catch (e) {
        if (isMissing(e)) skip(`sql plugin not available: ${e}`);
        throw e;
      }
    },
  },

  // @tauri-apps/plugin-websocket (requires ws echo fixture on port 3004)
  {
    name: '@tauri-apps/plugin-websocket.connect+send+echo+disconnect',
    category: 'auto',
    async fn() {
      const WebSocket = (await import('@tauri-apps/plugin-websocket')).default;
      try {
        const ws = await WebSocket.connect('ws://localhost:3004/');
        const received: any[] = [];
        const unlisten = ws.addListener((msg) => received.push(msg));
        await ws.send('ping');
        await new Promise((r) => setTimeout(r, 600));
        assert(received.some((m) => m?.type === 'Text' && m?.data === 'ping'), `expected Text echo 'ping', got ${JSON.stringify(received)}`);
        await ws.send([1, 2, 3]);
        await new Promise((r) => setTimeout(r, 600));
        assert(received.some((m) => m?.type === 'Binary'), `expected Binary echo, got ${JSON.stringify(received)}`);
        unlisten();
        await ws.disconnect();
      } catch (e) {
        if (isMissing(e) || String(e).includes('Connection refused')) skip(`websocket echo server not available on OHOS: ${e}`);
        throw e;
      }
    },
  },

  // @tauri-apps/plugin-upload (uses 3003 http echo as upload target)
  {
    name: '@tauri-apps/plugin-upload.upload (echo+progress)',
    category: 'side-effect',
    async fn() {
      const { upload } = await import('@tauri-apps/plugin-upload');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const { appCacheDir } = await import('@tauri-apps/api/path');
      try {
        const dir = await appCacheDir();
        const filePath = `${dir}/${uniq('upload')}.txt`;
        const content = new TextEncoder().encode('hello-upload-test-payload');
        await writeFile(filePath, content);
        let lastProgress = 0;
        const resp = await upload('http://localhost:3003/up', filePath, (p) => {
          lastProgress = Math.max(lastProgress, p.progress);
        });
        assert(typeof resp === 'string' && resp.length > 0, `upload should return non-empty body, got: ${resp}`);
      } catch (e) {
        if (isMissing(e)) skip(`upload plugin not available: ${e}`);
        throw e;
      }
    },
  },

  // @tauri-apps/plugin-persisted-scope (via existing helper commands)
  {
    name: '@tauri-apps/plugin-persisted-scope.allow+persist',
    category: 'auto',
    async fn() {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('clear_persisted_scope');
        const res: any = await invoke('test_persisted_scope');
        assert(res?.allow_ok === true, `allow_ok should be true, got: ${JSON.stringify(res)}`);
        assert(res?.state_file_exists === true, `state_file should exist after allow_directory, got: ${JSON.stringify(res)}`);
        assert(res?.state_file_size > 0, `state_file_size should be > 0, got: ${res?.state_file_size}`);
      } catch (e) {
        if (isMissing(e)) skip(`persisted-scope helper not available: ${e}`);
        throw e;
      }
    },
  },

  // @tauri-apps/plugin-localhost (assets served on port 3005)
  {
    name: '@tauri-apps/plugin-localhost.fetch 200',
    async fn() {
      try {
        const resp = await fetch('http://127.0.0.1:3005/index.html');
        assert(resp.status === 200, `expected 200, got ${resp.status}`);
        const body = await resp.text();
        assert(body.length > 0, 'body should be non-empty');
      } catch (e) {
        if (isMissing(e)) skip(`localhost plugin not available: ${e}`);
        throw e;
      }
    },
  },

  // @tauri-apps/plugin-cli
  {
    name: '@tauri-apps/plugin-cli.getMatches',
    category: 'auto',
    async fn() {
      const { getMatches } = await import('@tauri-apps/plugin-cli');
      try {
        const matches: any = await getMatches();
        assert(matches && typeof matches === 'object', `getMatches should return object, got: ${matches}`);
        assert(typeof matches.args === 'object', `matches.args should be object, got: ${typeof matches?.args}`);
        assert(matches.subcommand === null || typeof matches.subcommand === 'object', `subcommand should be null or object, got: ${typeof matches?.subcommand}`);
      } catch (e) {
        if (isMissing(e)) skip(`cli plugin not available: ${e}`);
        throw e;
      }
    },
  },

  // @tauri-apps/plugin-opener: removed from autotest (was category:'manual',
  // always skipped by the runner). opener is now manual-only — see
  // doc/manual_tests.md "Opener" section + "Plugins Manual Tests" buttons in
  // TestRunner (openPath / revealItemInDir / openUrl). Side effects (system
  // file manager / browser actually opening) cannot be asserted automatically.

  // @tauri-apps/plugin-positioner (smoke — OHOS desktop window coords unknown)
  {
    name: '@tauri-apps/plugin-positioner.moveWindow (smoke)',
    category: 'side-effect',
    async fn() {
      const { moveWindow, Position } = await import('@tauri-apps/plugin-positioner');
      try {
        await moveWindow(Position.TopLeft);
        await moveWindow(Position.Center);
      } catch (e) {
        if (isMissing(e)) skip(`positioner plugin not available: ${e}`);
        throw e;
      }
    },
  },

  // @tauri-apps/plugin-accessibility (OHOS-only)
  {
    name: '@tauri-apps/plugin-accessibility.getFontScale',
    category: 'auto',
    async fn() {
      let mod;
      try {
        mod = await import('@tauri-apps/plugin-accessibility');
      } catch (e) {
        skip(`plugin-accessibility not available: ${e}`);
        return;
      }
      const scale = await mod.getFontScale();
      assert(typeof scale === 'number' && Number.isFinite(scale) && scale > 0,
        `getFontScale should return a positive finite number, got ${scale}`);
      console.log(`[accessibility] fontScale = ${scale}`);
    },
  },
  {
    name: '@tauri-apps/plugin-accessibility.screenReader+touchExploreQueries',
    category: 'auto',
    async fn() {
      let mod;
      try {
        mod = await import('@tauri-apps/plugin-accessibility');
      } catch (e) {
        skip(`plugin-accessibility not available: ${e}`);
        return;
      }
      // Both queries need the system-level ohos.permission.ACCESSIBILITY. Contract
      // under test: a boolean on success; a permission denial (BusinessError code=201
      // in the rejection message) passes with a note; anything else — including a
      // non-boolean return — fails the test.
      for (const [label, fn] of [
        ['isScreenReaderEnabled', mod.isScreenReaderEnabled],
        ['isTouchExploreEnabled', mod.isTouchExploreEnabled],
      ] as const) {
        try {
          const value = await fn();
          assert(typeof value === 'boolean', `${label} should return a boolean, got ${typeof value}`);
          console.log(`[accessibility] ${label} = ${value}`);
        } catch (e) {
          if (isMissing(e)) skip(`${label} not available: ${e}`);
          else if (String(e).includes('code=201'))
            console.log(`[accessibility] ${label} rejected (permission denied): ${e}`);
          else throw e;
        }
      }
    },
  },
  {
    name: '@tauri-apps/plugin-accessibility.onAccessibilityStateChange',
    category: 'manual',
    async fn() {
      let mod;
      try {
        mod = await import('@tauri-apps/plugin-accessibility');
      } catch (e) {
        skip(`plugin-accessibility not available: ${e}`);
        return;
      }
      const unlisten = await mod.onAccessibilityStateChange((enabled) => {
        console.log(`[accessibility manual] state change received: ${enabled}`);
      });
      console.log('[accessibility manual] Toggle the system screen reader (Settings > Accessibility)');
      console.log('[accessibility manual] Expect: a "[accessibility manual] state change received" log with the new state');
      // Keep the listener registered for the remainder of the run; the manual session
      // is short-lived so an explicit unlisten is not required.
      void unlisten;
    },
  },

  // @tauri-apps/plugin-single-instance (no front-end API; requires dual-process orchestration)
  {
    name: '@tauri-apps/plugin-single-instance (manual)',
    category: 'manual',
    async fn() {
      console.log('[single-instance manual] Launch a second instance with the same argv');
      console.log('[single-instance manual] Expect: second instance exits; first receives callback with args/cwd');
    },
  },
];
