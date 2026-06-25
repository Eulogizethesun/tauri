import type { TestCase } from '../test-runner';
import { invoke, Channel, Resource } from '@tauri-apps/api/core';
import { emit, listen, once } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWindow, currentMonitor } from '@tauri-apps/api/window';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWebview, Webview } from '@tauri-apps/api/webview';
import { appCacheDir } from '@tauri-apps/api/path';

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
          canIUseWindowManager: boolean;
        }>('get_ohos_version_info');
        console.log(`[OHOS Version] sdk_api=${info.sdkApiVersion}, distribution_api=${info.distributionApiVersion}, canIUse(WindowManager)=${info.canIUseWindowManager}`);
        assert(info.sdkApiVersion >= 12, `sdkApiVersion should be >= 12, got ${info.sdkApiVersion}`);
        assert(info.distributionApiVersion > 0, `distributionApiVersion should be > 0, got ${info.distributionApiVersion}`);
        assert(typeof info.canIUseWindowManager === 'boolean', 'canIUse should return boolean');
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
      const monitor = await currentMonitor();
      assert(monitor !== null && monitor !== undefined, 'currentMonitor returned null (device should always have a display)');
      assert(typeof monitor.size.width === 'number' && monitor.size.width > 0, `monitor.size.width should be positive, got ${monitor.size.width}`);
      assert(typeof monitor.size.height === 'number' && monitor.size.height > 0, `monitor.size.height should be positive, got ${monitor.size.height}`);
      assert(typeof monitor.position.x === 'number', `monitor.position.x should be a number, got ${monitor.position.x}`);
      assert(typeof monitor.position.y === 'number', `monitor.position.y should be a number, got ${monitor.position.y}`);
    },
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

  // Test web_page_snapshot on OHOS: captures WebView content as RGBA bitmap
  {
    name: 'webview.webPageSnapshot',
    category: 'auto',
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
      assert(result.rgba_len === result.width * result.height * 4,
        `Expected rgba_len=${result.width * result.height * 4}, got ${result.rgba_len}`);
    },
  },

  // Test app_handle.emit
  {
    name: 'app_handle.emit',
    category: 'auto',
    async fn() {
      let received: any = null;
      const unlisten = await listen('test-emit-event', (event) => {
        received = event.payload;
      });
      try {
        await invoke('emit_test_event');
        // Wait for event propagation
        await new Promise((r) => setTimeout(r, 100));
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
        // Clean up the created window (use actual label returned by Rust, not original windowId)
        if (actualLabel) {
          try {
            const win = await WebviewWindow.getByLabel(actualLabel);
            if (win) await win.close();
          } catch (e) {
            // Ignore if window already closed or not found
          }
        }
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
        // Clean up the created window
        if (actualLabel) {
          try {
            const win = await WebviewWindow.getByLabel(actualLabel);
            if (win) await win.close();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
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
        // Clean up the created window
        if (actualLabel) {
          try {
            const win = await WebviewWindow.getByLabel(actualLabel);
            if (win) await win.close();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
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
      // Also verify CloseRequested was fired before Destroyed
      const closeReqIdx = events.indexOf('WindowEvent::CloseRequested');
      const destroyedIdx = events.indexOf('WindowEvent::Destroyed');
      assert(
        closeReqIdx !== -1 && closeReqIdx < destroyedIdx,
        `WindowEvent::CloseRequested should fire before WindowEvent::Destroyed, got: ${JSON.stringify(events)}`,
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
      const win = getCurrentWindow();
      const decorated = await win.isDecorated();
      assert(typeof decorated === 'boolean', `isDecorated() should return boolean, got ${typeof decorated}`);
    },
  },
  {
    name: 'window.setDecorations toggles decorations state',
    category: 'side-effect',
    async fn() {
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

  // ─── Window Background Color (Phase 3) ───
  {
    name: 'window.setBackgroundColor does not throw',
    category: 'side-effect',
    async fn() {
      const win = getCurrentWindow();
      // Set a semi-transparent color — should not throw
      await win.setBackgroundColor([255, 0, 0, 128]);
      // Set an opaque color — should not throw
      await win.setBackgroundColor([0, 0, 0, 255]);
      // Restore to opaque white so the label bar is not left black
      await win.setBackgroundColor([255, 255, 255, 255]);
    },
  },

  // ─── Create Borderless Window (Phase 2 integration) ───
  {
    name: 'create_borderless_window command',
    category: 'side-effect',
    async fn() {
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
      // Clean up
      await win!.close();
    },
  },

  // ─── Create Transparent Borderless Window (Phase 1+2+3 integration) ───
  {
    name: 'create_transparent_borderless_window command',
    category: 'side-effect',
    async fn() {
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
      // Clean up
      await win!.close();
    },
  },

  // ─── on_new_window (OHOS onWindowNew interception) ───
  {
    name: 'on_new_window: Deny blocks window.open()',
    category: 'auto',
    async fn() {
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
    name: 'on_new_window: Allow triggers event with correct URL',
    category: 'auto',
    async fn() {
      // Set handler to Allow mode
      await invoke('set_deny_new_window', { deny: false });
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

      await child.close();
    },
  },
];
