import type { TestCase } from '../test-runner';
import {
  getCurrentWindow,
  currentMonitor,
  primaryMonitor,
  availableMonitors,
  monitorFromPoint,
  cursorPosition,
  Window,
} from '@tauri-apps/api/window';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { invoke } from '@tauri-apps/api/core';
import { Effect } from '@tauri-apps/api/window';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/// S9 覆盖率批：与 window-ops.ts 的 smoke() 不同，这里**逐调用吞错**——
/// window-ops.ts 里 setFocusable 排在 setClosable 之后，前者一抛错后者就饿死，
/// 整条链从未到达主线程（S8 数据：runtime-wry set_focusable/set_focus 全 dormant）。
/// 本批语义与 driver-generated 盲调用一致：执行即覆盖，成功/错误分支都点亮；
/// 错误被记录但不抛，单个 op 失败不连坐。
const results: string[] = [];
async function attempt(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    results.push(`${label}:ok`);
  } catch (e) {
    // console-capture 全局挂钩（App.svelte），结果经 flush_console_log 落设备文件
    results.push(`${label}:err(${String(e).slice(0, 120)})`);
  } finally {
    console.log(`[ops2] ${results[results.length - 1]}`);
  }
}

/// 把本批 attempt 结果落盘（Rust 侧 console buffer → cache/console-log.txt）
async function flushOps2Log(): Promise<void> {
  console.log('[ops2] summary:', results.join(' | '));
  try {
    await invoke('flush_console_log');
  } catch {
    /* flush 本身失败不连坐 */
  }
}

async function createFloatWindow(label: string): Promise<Window> {
  await invoke('create_borderless_window', { windowId: label });
  await delay(600);
  const w = await Window.getByLabel(label);
  assert(w, `Float window "${label}" not found after create`);
  return w;
}

export const windowOpsExtraTests: TestCase[] = [
  {
    name: 'monitors: current/primary/available/fromPoint/cursorPosition',
    category: 'auto',
    async fn() {
      // runtime-wry: primary_monitor ×3 impl + available_monitors ×3 + monitor_from_point ×2 + cursor_position
      await attempt('currentMonitor', () => currentMonitor());
      await attempt('primaryMonitor', () => primaryMonitor());
      await attempt('availableMonitors', () => availableMonitors());
      await attempt('monitorFromPoint', () => monitorFromPoint(100, 200));
      await attempt('cursorPosition', () => cursorPosition());

      const monitors = await availableMonitors().catch((e) => {
        console.log(`[ops2] availableMonitors rejected: ${String(e).slice(0, 120)}`);
        return null;
      });
      assert(Array.isArray(monitors), `availableMonitors should resolve to an array, got: ${monitors}`);
      console.log(`[ops2] availableMonitors count=${(monitors as unknown[]).length}`);
      const cur = await currentMonitor().catch((e) => {
        console.log(`[ops2] currentMonitor rejected: ${String(e).slice(0, 120)}`);
        return null;
      });
      if (cur) {
        assert(typeof cur.name === 'string', 'monitor.name should be a string');
        assert(cur.size.width > 0, 'monitor.size.width should be positive');
        assert(cur.scaleFactor > 0, 'monitor.scaleFactor should be positive');
        assert(cur.position !== undefined, 'monitor.position should be present');
        console.log(`[ops2] currentMonitor name=${cur.name} size=${cur.size.width}x${cur.size.height} scale=${cur.scaleFactor}`);
      } else {
        console.log('[ops2] currentMonitor resolved null or rejected');
      }
      const pos = await cursorPosition().catch(() => null);
      if (pos) {
        assert(typeof pos.x === 'number' && typeof pos.y === 'number', 'cursorPosition should have numeric x/y');
      }
    },
  },
  {
    name: 'window badge/progress/overlay/titleBarStyle (desktop-only ops, error-swallowed)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      // runtime-wry handle_user_message::SetBadgeLabel arm (~39 行) + dispatcher fns
      await attempt('setBadgeLabel', () => win.setBadgeLabel('coverage'));
      await attempt('setBadgeLabel(null)', () => win.setBadgeLabel());
      await attempt('setProgressBar normal', () =>
        win.setProgressBar({ status: 'normal', progress: 50 }));
      await attempt('setProgressBar none', () => win.setProgressBar({ status: 'none' }));
      await attempt('setProgressBar indeterminate', () =>
        win.setProgressBar({ status: 'indeterminate' }));
      await attempt('setProgressBar paused', () =>
        win.setProgressBar({ status: 'paused', progress: 30 }));
      await attempt('setProgressBar error', () =>
        win.setProgressBar({ status: 'error', progress: 10 }));
      await attempt('setOverlayIcon(none)', () => win.setOverlayIcon());
      await attempt('setTitleBarStyle', () => win.setTitleBarStyle('visible'));
    },
  },
  {
    name: 'window setTheme/visibleOnAllWorkspaces/focus/cursor ops (per-call swallowed)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      // S8 dormant: runtime-wry set_focusable L2615 / set_cursor_position L2681 / set_theme L3435
      // / set_visible_on_all_workspaces L2506 + 各主线程 arm
      await attempt('setTheme light', () => win.setTheme('light'));
      await attempt('setTheme dark', () => win.setTheme('dark'));
      await attempt('setTheme null', () => win.setTheme(null));
      await attempt('setVisibleOnAllWorkspaces(false)', () => win.setVisibleOnAllWorkspaces(false));
      await attempt('setFocus', () => win.setFocus());
      await attempt('setFocusable(true)', () => win.setFocusable(true));
      await attempt('setCursorIcon default', () => win.setCursorIcon('default'));
      await attempt('setCursorIcon crosshair', () => win.setCursorIcon('crosshair'));
      await attempt('setCursorPosition', () =>
        win.setCursorPosition(new PhysicalPosition(200, 200)));
      await attempt('requestUserAttention', () => win.requestUserAttention(null));
    },
  },
  {
    name: 'window setIcon with raw bytes (error path acceptable)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      // dispatcher set_icon L2643 + arm；非法 icon 数据走错误分支也算覆盖
      await attempt('setIcon(bytes)', () =>
        win.setIcon(new Uint8Array([0, 0, 0, 0])));
      await attempt('setIcon(empty bytes)', () => win.setIcon(new Uint8Array(0)));
    },
  },
  {
    name: 'float window dragging (startDragging/startResizeDragging)',
    category: 'auto',
    async fn() {
      // label 用 test- 前缀：capability windows 只匹配 main/main-*/test-*，
      // 其他前缀的窗口上所有 invoke 都会被 ACL 拒绝
      const label = `test-ops2-drag-${Date.now()}`;
      const w = await createFloatWindow(label);
      try {
        // 无鼠标按住时 OHOS 大概率拒绝 → 错误分支点亮即达标
        await attempt('startDragging', () => w.startDragging());
        await attempt('startResizeDragging', () => w.startResizeDragging('East'));
        await delay(300);
        await attempt('float setFocus', () => w.setFocus());
        await attempt('float setFocusable', () => w.setFocusable(true));
        await attempt('float setProgressBar', () =>
          w.setProgressBar({ status: 'normal', progress: 10 }));
      } finally {
        await w.close().catch(() => {});
      }
    },
  },
  {
    name: 'window setEffects/clearEffects retry (Effect enum in scope)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      // effects 相关 dispatcher 路径（若 JS 版本支持）
      await attempt('setEffects(empty)', () =>
        win.setEffects({ effects: [] }));
      await attempt('clearEffects', () => win.clearEffects());
      assert(Effect !== undefined, 'Effect enum should be importable');
      // 本批最后一次 attempt 结束，把结果刷进设备 console-log.txt
      await flushOps2Log();
    },
  },
  {
    name: 'probe: Rust-only app APIs (monitors/menu/reparent via demo commands)',
    category: 'auto',
    async fn() {
      // JS API 面未暴露、仅 Rust 侧可达的方法，经 demo 探针命令点亮：
      // AppHandle monitor 四连 / app.rs+window/mod.rs set_menu+remove_menu /
      // Webview::reparent 的 OHOS "not supported" 警告分支
      await attempt('probe_app_monitors', () =>
        invoke('probe_app_monitors').then((r) => console.log('[ops2] probe_app_monitors:', r)));
      await attempt('probe_app_menu_set_remove', () =>
        invoke('probe_app_menu_set_remove').then((r) => console.log('[ops2] probe_app_menu:', r)));
      await attempt('probe_window_menu_set_remove', () =>
        invoke('probe_window_menu_set_remove').then((r) => console.log('[ops2] probe_window_menu:', r)));
      await attempt('probe_webview_reparent', () =>
        invoke('probe_webview_reparent').then((r) => console.log('[ops2] probe_reparent:', r)));
    },
  },
  {
    name: 'setIcon with valid 1x1 PNG (dispatcher + arm)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      // 合法 1x1 PNG（此前 4 字节/空数据均败于 "failed to process image"）
      const b64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await attempt('setIcon(valid png)', () => win.setIcon(bytes));
      await flushOps2Log();
    },
  },
];
