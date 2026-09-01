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
 * Screenshot/pick-color tests for @tauri-apps/plugin-screenshot (OHOS-only).
 *
 * The color blocks used as pick-color references are injected into document.body
 * by the tests themselves (position: fixed, high z-index) — the TestRunner view is
 * what's on screen during the autotest run, so referencing a dedicated demo view's
 * blocks would require view switching. Injection keeps the tests self-contained.
 *
 * Coordinate mapping: pick_color takes snapshot-pixel coordinates. The snapshot is
 * captured at physical resolution, so CSS px → snapshot px via the ratio
 * captureWidth / window.innerWidth (more robust than guessing devicePixelRatio).
 */

interface InjectedBlock {
  el: HTMLDivElement;
  centerCssX: number;
  centerCssY: number;
}

function injectSolidBlock(color: string, left: number, top: number, size: number): InjectedBlock {
  const el = document.createElement('div');
  el.style.cssText = [
    'position: fixed',
    `left: ${left}px`,
    `top: ${top}px`,
    `width: ${size}px`,
    `height: ${size}px`,
    `background: ${color} !important`,
    'z-index: 2147483647',
    'pointer-events: none',
  ].join('; ');
  document.body.appendChild(el);
  return { el, centerCssX: left + size / 2, centerCssY: top + size / 2 };
}

export const ohosScreenshotTests: TestCase[] = [
  {
    name: '@tauri-apps/plugin-screenshot.captureWebview',
    category: 'auto',
    timeout: 20000,
    async fn() {
      let mod;
      try {
        mod = await import('@tauri-apps/plugin-screenshot');
      } catch (e) {
        skip(`plugin-screenshot not available: ${e}`);
        return;
      }
      let image;
      try {
        image = await mod.captureWebview();
      } catch (e) {
        if (isMissing(e)) skip(`plugin-screenshot command not available: ${e}`);
        throw e;
      }
      assert(
        typeof image.pngBase64 === 'string' && image.pngBase64.startsWith('iVBOR'),
        `pngBase64 should be a base64 PNG (iVBOR… prefix), got "${String(image.pngBase64).slice(0, 16)}…"`,
      );
      assert(
        Number.isFinite(image.width) && image.width > 0,
        `width should be a positive number, got ${image.width}`,
      );
      assert(
        Number.isFinite(image.height) && image.height > 0,
        `height should be a positive number, got ${image.height}`,
      );
      // The snapshot is at physical resolution: it must be at least the CSS viewport.
      assert(
        image.width >= window.innerWidth,
        `snapshot width ${image.width} should be >= viewport CSS width ${window.innerWidth}`,
      );
      console.log(
        `[screenshot] captured ${image.width}x${image.height}, pngBase64 length ${image.pngBase64.length}`,
      );
    },
  },
  {
    name: '@tauri-apps/plugin-screenshot.pickColorAt (red block)',
    category: 'side-effect',
    timeout: 20000,
    async fn() {
      let mod;
      try {
        mod = await import('@tauri-apps/plugin-screenshot');
      } catch (e) {
        skip(`plugin-screenshot not available: ${e}`);
        return;
      }

      // Reference block: pure red, fixed in the viewport so scroll offset doesn't matter.
      const block = injectSolidBlock('#ff0000', 20, 20, 80);
      try {
        // First capture to learn the physical/CSS scale and confirm a fresh snapshot
        // contains the block.
        const image = await mod.captureWebview();
        const scale = image.width / window.innerWidth;
        const x = Math.round(block.centerCssX * scale);
        const y = Math.round(block.centerCssY * scale);
        const color = await mod.pickColorAt(x, y);
        console.log(
          `[screenshot] red block at css(${block.centerCssX},${block.centerCssY}) → snapshot(${x},${y}) scale=${scale.toFixed(3)} → rgba(${color.r},${color.g},${color.b},${color.a})`,
        );
        // Tolerant thresholds: compositing/rounding may shift channels slightly,
        // but a red block must stay dominantly red.
        assert(
          color.r > 200 && color.g < 60 && color.b < 60,
          `red block should read r>200,g<60,b<60, got rgba(${color.r},${color.g},${color.b},${color.a})`,
        );
      } finally {
        block.el.remove();
      }
    },
  },
  {
    name: '@tauri-apps/plugin-screenshot.pickColorAt (out of bounds)',
    category: 'auto',
    timeout: 20000,
    async fn() {
      let mod;
      try {
        mod = await import('@tauri-apps/plugin-screenshot');
      } catch (e) {
        skip(`plugin-screenshot not available: ${e}`);
        return;
      }
      // A capture is needed to know the snapshot bounds; then pick beyond them and
      // expect a structured error (never a hang or a made-up color).
      const image = await mod.captureWebview();
      let rejected = false;
      try {
        await mod.pickColorAt(image.width + 10, image.height + 10);
      } catch (e) {
        rejected = true;
        const m = String((e as Error)?.message ?? e);
        console.log(`[screenshot] out-of-bounds rejected as expected: ${m}`);
        assert(
          m.toLowerCase().includes('bounds') || m.toLowerCase().includes('out of'),
          `out-of-bounds error should mention bounds, got "${m}"`,
        );
      }
      assert(rejected, 'pickColorAt beyond snapshot bounds should reject');
    },
  },
  {
    name: '@tauri-apps/plugin-screenshot.demo preview (manual)',
    category: 'manual',
    async fn() {
      console.log('[screenshot manual] Open the "Screenshot" view and press 截图预览');
      console.log('[screenshot manual] Expect: the preview <img> shows the five color blocks as rendered');
      console.log('[screenshot manual] Also try 取色 on each block and check the shown rgba matches the block color');
    },
  },
];
