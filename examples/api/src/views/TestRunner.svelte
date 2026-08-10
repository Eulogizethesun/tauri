<script>
  import { onMount } from 'svelte';
  import { runTests } from '../lib/test-runner';
  import { coreTests } from '../lib/tests/core';
  import { pluginTests } from '../lib/tests/plugins';
  import { dpiTests } from '../lib/tests/dpi';
  import { windowDpiTests } from '../lib/tests/window-dpi';
  import { windowOpsTests } from '../lib/tests/window-ops';
  import { imageTests } from '../lib/tests/image';
  import { menuTests } from '../lib/tests/menu';
  import { trayTests } from '../lib/tests/tray';
  import { ohosAdapterTests } from '../lib/tests/ohos-adapter';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow, currentMonitor, cursorPosition, Effect, PhysicalPosition, PhysicalSize } from '@tauri-apps/api/window';
  import { getCurrentWebview, Webview } from '@tauri-apps/api/webview';
  import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { appCacheDir, join } from '@tauri-apps/api/path';
  import { flushConsoleLog, clearConsoleLog } from '../lib/console-capture';

  let { onMessage } = $props();

  let results = $state([]);
  let running = $state(false);
  let report = $state(null);

  // Manual test state
  let manualResult = $state('');
  let focusWatchActive = $state(false);
  let focusWatchUnlisten = null;
  let focusEvents = $state([]);
  let menuEvents = $state([]);
  let snapshotCanvas = $state(null);
  let snapshotContainer = $state(null);
  let canvasEl = $state(null);
  let snapshotWidth = $state(0);
  let snapshotHeight = $state(0);
  let hasSnapshot = $state(false);

  // Key repeat test state
  let keyTestActive = $state(false);
  let keyTestLog = $state([]);
  let pressedKeys = new Set();

  function onKeyTestKeydown(e) {
    if (!keyTestActive) return;
    e.preventDefault();
    const isRepeat = pressedKeys.has(e.code);
    if (!isRepeat) pressedKeys.add(e.code);
    const entry = `D key="${e.key}" code=${e.code} repeat=${e.repeat} SetR=${isRepeat} pressed=[${[...pressedKeys].join(',')}]`;
    keyTestLog = [...keyTestLog.slice(-49), { text: entry, highlight: e.repeat || isRepeat }];
  }

  function onKeyTestKeyup(e) {
    if (!keyTestActive) return;
    e.preventDefault();
    pressedKeys.delete(e.code);
    const entry = `U key="${e.key}" code=${e.code} repeat=${e.repeat} SetR=false`;
    keyTestLog = [...keyTestLog.slice(-49), { text: entry, highlight: false }];
  }

  function clearKeyTestLog() {
    keyTestLog = [];
    pressedKeys.clear();
  }

  const allTests = [...coreTests, ...pluginTests, ...dpiTests, ...windowDpiTests, ...windowOpsTests, ...imageTests, ...menuTests, ...trayTests, ...ohosAdapterTests];
  const webview = getCurrentWebview();

  async function runAll() {
    running = true;
    results = [];
    report = null;
    onMessage('--- Test Run Started ---');

    // Clear previous test report before starting
    try {
      await invoke('clear_test_report');
    } catch (e) {
      onMessage(`Failed to clear report: ${e}`);
    }

    // Skip manual tests - they require user interaction
    const filtered = allTests.filter((t) => t.category !== 'manual');

    const r = await runTests(filtered, (result, index, total) => {
      results = [...results, result];
      const icon = result.status === 'pass' ? '[PASS]' : result.status === 'fail' ? '[FAIL]' : '[SKIP]';
      const msg = `${icon} ${result.name}${result.error ? ' - ' + result.error : ''} (${result.duration}ms)`;
      onMessage(msg);
    });

    report = r;
    onMessage(`--- Done: ${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped ---`);
    running = false;
  }

  // Auto-run on first mount
  let listenId = 0;
  onMount(async () => {
    runAll();
    // Listen for menu events from Rust (tray + global on_menu_event)
    const myListenId = ++listenId;
    let fireCount = 0;
    console.log(`[listen-register] listenId=${myListenId} registered at ${new Date().toLocaleTimeString()}`);
    const unlisten = await listen('menu-event', (event) => {
      fireCount++;
      const payload = event.payload;
      const ts = new Date().toLocaleTimeString();
      const msg = `[menu-event #${fireCount} lid=${myListenId}] ${payload} at ${ts}`;
      console.log(msg);
      onMessage(msg);
      menuEvents = [...menuEvents, { payload, ts }];
    });
    return () => {
      console.log(`[listen-cleanup] listenId=${myListenId} cleaned up`);
      unlisten();
    };
  });

  async function runCategory(category) {
    running = true;
    results = [];
    report = null;
    const filtered = allTests.filter((t) => t.category === category);
    onMessage(`--- Running ${category} tests (${filtered.length}) ---`);

    const r = await runTests(filtered, (result) => {
      results = [...results, result];
      const icon = result.status === 'pass' ? '[PASS]' : result.status === 'fail' ? '[FAIL]' : '[SKIP]';
      onMessage(`${icon} ${result.name}${result.error ? ' - ' + result.error : ''}`);
    });

    report = r;
    onMessage(`--- Done: ${r.passed} passed, ${r.failed} failed, ${r.skipped} skipped ---`);
    running = false;
  }

  async function wrapManual(name, fn) {
    const start = Date.now();
    console.log('[ManualTest] Starting:', name);
    try {
      await fn();
      if (manualResult) {
        console.log('[ManualTest]', manualResult);
      }
      console.log('[ManualTest] Completed:', name, 'in', Date.now() - start, 'ms');
    } catch (e) {
      console.error('[ManualTest] Failed:', name, e);
    }
    try {
      const path = await flushConsoleLog();
      onMessage(`Console log saved: ${path}`);
    } catch (e) {
      onMessage(`Failed to save console log: ${e}`);
    }
  }

  // ─── Manual Tests ───
  async function manualIsFocused() {
    await wrapManual('isFocused', async () => {
      const focused = await getCurrentWindow().isFocused();
      const ok = focused === true;
      manualResult = `isFocused() → ${focused} ${ok ? '[OK: app in foreground]' : '[UNEXPECTED: should be true since you clicked the button]'}`;
      onMessage(manualResult);
    });
  }

  async function toggleFocusWatch() {
    if (focusWatchActive) {
      focusWatchUnlisten?.();
      focusWatchUnlisten = null;
      focusWatchActive = false;
      manualResult = `Stopped watching focus changes. Total events: ${focusEvents.length}`;
      onMessage(manualResult);
    } else {
      focusEvents = [];
      focusWatchUnlisten = await getCurrentWindow().onFocusChanged(({ payload }) => {
        const ts = new Date().toLocaleTimeString();
        focusEvents = [...focusEvents, `${ts}: focused=${payload}`];
        onMessage(`[onFocusChanged] focused=${payload}`);
      });
      focusWatchActive = true;
      manualResult = 'Watching focus changes. Send the app to background and back to trigger events.';
      onMessage(manualResult);
    }
    try {
      const path = await flushConsoleLog();
      onMessage(`Console log saved: ${path}`);
    } catch (e) {}
  }

  async function manualMonitor() {
    await wrapManual('currentMonitor', async () => {
      const m = await currentMonitor();
      if (!m) {
        manualResult = 'currentMonitor() → null';
      } else {
        manualResult = `Monitor: ${m.size.width}×${m.size.height} @ scale ${m.scaleFactor} | position (${m.position.x}, ${m.position.y}) | name "${m.name ?? ''}"`;
      }
      onMessage(manualResult);
    });
  }

  // setIgnoreCursorEvents smoke test (ohos-window-ignore-cursor-events).
  // Toggle true → false on the current window: fire-and-forget TSFN bridge
  // (tao set_ignore_cursor_events → openharmony_ability set_window_touchable →
  // ArkHelper → WindowManager → win.setWindowTouchable). Rust always returns Ok;
  // real proof is hilog `grep setWindowTouchable` + visual pass-through. Briefly
  // setting true lets the user observe the window stop consuming events; false
  // restores. For full pass-through verification create a Float overlay window.
  async function manualIgnoreCursorEvents() {
    await wrapManual('setIgnoreCursorEvents', async () => {
      const win = getCurrentWindow();
      // 1. Safe restore first — verifies the TSFN bridge is wired (no throw).
      await win.setIgnoreCursorEvents(false);
      manualResult = 'setIgnoreCursorEvents(false) → OK (TSFN bridge wired, events consumed normally)';
      onMessage(manualResult);
      // 2. Briefly enable ignore=true (events pass through) so the user can observe.
      await win.setIgnoreCursorEvents(true);
      onMessage('setIgnoreCursorEvents(true) → dispatched. For ~3s the window ignores events (pass-through). Click to test, then auto-restore.');
      await new Promise((r) => setTimeout(r, 3000));
      // 3. Auto-restore so the window doesn't get stuck non-interactive.
      await win.setIgnoreCursorEvents(false);
      manualResult = 'Restored: setIgnoreCursorEvents(false). Check hilog `grep setWindowTouchable` for debug logs.';
      onMessage(manualResult);
    });
  }

  // RunEvent::Resumed manual test (ohos-event-lifecycle-forward).
  // Listens for the 'tauri://resumed' event, then prompts the user to background
  // and foreground the app. On OHOS, MainEvent::Start (SHOWN) is forwarded as
  // Event::Resumed. Returns whether the event fired within the wait window.
  async function manualEventResumed() {
    await wrapManual('RunEvent::Resumed', async () => {
      let fired = false;
      const unlisten = await listen('tauri://resumed', () => {
        fired = true;
      });
      manualResult = 'Listening for tauri://resumed.\nBackground the app (Home/最小化) then bring it back to foreground.\nWaiting up to 30s...';
      onMessage(manualResult);
      // Give the user up to 30s to background/foreground.
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        if (fired) break;
      }
      unlisten();
      manualResult = fired
        ? 'PASS: RunEvent::Resumed fired after background→foreground.'
        : 'FAIL: RunEvent::Resumed did not fire within 30s. (background the app and return to trigger SHOWN→Resumed)';
      onMessage(manualResult);
    });
  }

  async function manualAppCacheDir() {
    await wrapManual('appCacheDir', async () => {
      const dir = await appCacheDir();
      manualResult = `appCacheDir() → ${dir}`;
      onMessage(manualResult);
    });
  }

  async function manualWindowDpi() {
    await wrapManual('windowDpi', async () => {
      const win = getCurrentWindow();
      const inner = await win.innerSize();
      const outer = await win.outerSize();
      const innerPos = await win.innerPosition();
      const outerPos = await win.outerPosition();
      const scale = await win.scaleFactor();

      manualResult = `innerSize: ${inner.width}×${inner.height}
outerSize: ${outer.width}×${outer.height}
innerPosition: (${innerPos.x}, ${innerPos.y})
outerPosition: (${outerPos.x}, ${outerPos.y})
scaleFactor: ${scale}

Expected behavior:
• Resize window → innerSize/outerSize should change
• Drag window → positions should change
• outerSize >= innerSize (includes window decorations)
• scaleFactor typically 1.0-3.0 (depends on display DPI)`;
      onMessage(manualResult);
    });
  }

  // ─── OS Info Manual Test ───
  async function manualOsInfo() {
    await wrapManual('osInfo', async () => {
      const { platform, type, version, family, arch, eol, exeExtension } = await import('@tauri-apps/plugin-os');
      const p = platform();
      const t = type();
      const v = version();
      const f = family();
      const a = arch();
      const e = eol();
      const ext = exeExtension();
      const internals = window.__TAURI_OS_PLUGIN_INTERNALS__;
      const isOhos = p === 'ohos' && t === 'ohos';
      manualResult =
        `OS Plugin Info:\n` +
        `  platform()  = "${p}" ${p === 'ohos' ? '✅' : p === 'linux' ? '⚠️ (should be ohos on OHOS)' : ''}\n` +
        `  type()      = "${t}" ${t === 'ohos' ? '✅' : ''}\n` +
        `  version()   = "${v}"\n` +
        `  family()    = "${f}"\n` +
        `  arch()      = "${a}"\n` +
        `  eol()       = ${JSON.stringify(e)}\n` +
        `  exeExtension() = "${ext}"\n\n` +
        `__TAURI_OS_PLUGIN_INTERNALS__:\n` +
        `  platform = "${internals?.platform}"\n` +
        `  os_type  = "${internals?.os_type}"\n\n` +
        (isOhos ? '✅ OHOS detected correctly!' : '');
      onMessage(manualResult);
    });
  }

  // ─── Menu Bar Manual Tests ───
  const MB_TEST_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  async function manualMenuBarRestore() {
    await wrapManual('menuBarRestore', async () => {
      const { Menu, Submenu, PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const fileSub = await Submenu.new({ text: 'File', items: [
        await PredefinedMenuItem.new({ item: 'CloseWindow' }),
        await PredefinedMenuItem.new({ item: 'Quit' }),
      ]});
      const editSub = await Submenu.new({ text: 'Edit', items: [
        await PredefinedMenuItem.new({ item: 'Undo' }),
        await PredefinedMenuItem.new({ item: 'Redo' }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await PredefinedMenuItem.new({ item: 'Cut' }),
        await PredefinedMenuItem.new({ item: 'Copy' }),
        await PredefinedMenuItem.new({ item: 'Paste' }),
        await PredefinedMenuItem.new({ item: 'SelectAll' }),
      ]});
      const windowSub = await Submenu.new({ text: 'Window', items: [
        await PredefinedMenuItem.new({ item: 'Minimize' }),
        await PredefinedMenuItem.new({ item: 'Maximize' }),
        await PredefinedMenuItem.new({ item: 'CloseWindow' }),
      ]});
      const helpSub = await Submenu.new({ text: 'Help', items: [
        await PredefinedMenuItem.new({ item: { About: { name: 'Tauri API Validation' } } }),
      ]});
      const menu = await Menu.new({ items: [fileSub, editSub, windowSub, helpSub] });
      await menu.setAsWindowMenu();
      manualResult = 'Default menu restored: File | Edit | Window | Help';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarVisible() {
    await wrapManual('menuBarVisible', async () => {
      const visible = await invoke('plugin:app-menu|is_menu_visible');
      manualResult = `is_menu_visible() = ${visible}\nCheck: Top of window should show a menu bar with submenu labels.\nIf visible and ${visible} === true → PASS.\nTip: Click "Restore Default Menu" first if menu bar is missing.`;
      onMessage(manualResult);
    });
  }

  async function manualMenuBarDropdown() {
    await wrapManual('menuBarDropdown', async () => {
      const { Menu, Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const sub = await Submenu.new({ text: 'Click Me', items: [
        await MenuItem.new({ text: 'Item A' }),
        await MenuItem.new({ text: 'Item B' }),
      ]});
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      manualResult = 'Menu bar: "Click Me" submenu.\nClick "Click Me" → dropdown should appear with "Item A" and "Item B".\nIf dropdown appears → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarNested() {
    await wrapManual('menuBarNested', async () => {
      const { Menu, Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const inner = await Submenu.new({ text: 'Inner', items: [
        await MenuItem.new({ text: 'Deep Item' }),
      ]});
      const outer = await Submenu.new({ text: 'Outer', items: [
        await MenuItem.new({ text: 'Top Item' }),
        inner,
      ]});
      const menu = await Menu.new({ items: [outer] });
      await menu.setAsWindowMenu();
      manualResult = 'Menu bar: "Outer → Top Item + Inner → Deep Item".\nClick Outer → hover Inner → should show nested dropdown with "Deep Item".\nIf nested submenu works → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarHover() {
    await wrapManual('menuBarHover', async () => {
      const { Menu, Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const sub = await Submenu.new({ text: 'HoverTest', items: [
        await MenuItem.new({ text: 'Item' }),
      ]});
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      manualResult = 'Menu bar: "HoverTest".\nHover mouse over "HoverTest" → background should change color.\nMove away → background returns to normal.\nIf hover effect visible → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarBarIcon() {
    await wrapManual('menuBarBarIcon', async () => {
      const { Menu, Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const sub = await Submenu.new({ text: 'IconMenu', icon: MB_TEST_ICON, items: [
        await MenuItem.new({ text: 'Item' }),
      ]});
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      manualResult = 'Menu bar: "IconMenu" submenu WITH icon.\nBar-level "IconMenu" should show a small icon next to the text.\nIf icon visible at bar level → PASS. If only text → FAIL.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarDisabledItem() {
    await wrapManual('menuBarDisabledItem', async () => {
      const { Menu, Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const sub = await Submenu.new({ text: 'DisTest', items: [
        await MenuItem.new({ text: 'Disabled', enabled: false }),
        await MenuItem.new({ text: 'Normal', enabled: true }),
      ]});
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      manualResult = 'Menu bar: "DisTest → Disabled + Normal".\nClick DisTest → "Disabled" should appear grayed out + semi-transparent.\n"Normal" should appear with full color.\nIf disabled visual correct → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarHide() {
    await wrapManual('menuBarHide', async () => {
      await invoke('plugin:app-menu|hide_menu');
      const visible = await invoke('plugin:app-menu|is_menu_visible');
      manualResult = `hide_menu() called. is_menu_visible() = ${visible}\nCheck: Menu bar should disappear from top of window.\nIf disappeared and ${visible} === false → PASS.\nClick "Show" button to restore.`;
      onMessage(manualResult);
    });
  }

  async function manualMenuBarShow() {
    await wrapManual('menuBarShow', async () => {
      await manualMenuBarRestore();
      await invoke('plugin:app-menu|show_menu');
      const visible = await invoke('plugin:app-menu|is_menu_visible');
      manualResult = `show_menu() called (default menu restored). is_menu_visible() = ${visible}\nCheck: Menu bar should reappear at top of window.\nIf visible and ${visible} === true → PASS.`;
      onMessage(manualResult);
    });
  }

  async function manualMenuBarIsMenuVisible() {
    await wrapManual('menuBarIsMenuVisible', async () => {
      const visible = await invoke('plugin:app-menu|is_menu_visible');
      manualResult = `is_menu_visible() = ${visible}\nExpected: true (menu bar visible by default).\nIf true → PASS.\nTip: Click "Hide" first, then click this button → should return false.`;
      onMessage(manualResult);
    });
  }

  async function manualMenuBarRemove() {
    await wrapManual('menuBarRemove', async () => {
      const { Menu } = await import('@tauri-apps/api/menu');
      const emptyMenu = await Menu.new({ items: [] });
      await emptyMenu.setAsWindowMenu();
      manualResult = 'Empty menu set as window menu (remove_menu equivalent).\nCheck: Menu bar should disappear (no items to show).\nIf disappeared → PASS.\nClick "Restore Default Menu" to restore.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarAutoRefreshText() {
    await wrapManual('menuBarAutoRefreshText', async () => {
      const { Menu, Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ text: 'Original' });
      const sub = await Submenu.new({ text: 'Refresh', items: [item] });
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      await new Promise(r => setTimeout(r, 500));
      await item.setText('Updated!');
      manualResult = 'Menu bar: "Refresh → Original".\nsetText("Updated!") called → auto_refresh should push update.\nClick "Refresh" dropdown → should show "Updated!" (not "Original").\nIf text updated → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarAutoRefreshChecked() {
    await wrapManual('menuBarAutoRefreshChecked', async () => {
      const { Menu, Submenu, CheckMenuItem } = await import('@tauri-apps/api/menu');
      const check = await CheckMenuItem.new({ text: 'Check Me', checked: false });
      const sub = await Submenu.new({ text: 'Refresh', items: [check] });
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      await new Promise(r => setTimeout(r, 500));
      await check.setChecked(true);
      manualResult = 'Menu bar: "Refresh → Check Me" (unchecked).\nsetChecked(true) called → auto_refresh should update.\nClick "Refresh" dropdown → "Check Me" should show a checkmark.\nIf checked state updated → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarAccelerator() {
    await wrapManual('menuBarAccelerator', async () => {
      const { Menu, Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({
        text: 'Accel Test',
        action: (id) => {
          console.log('[MenuBarTest] Accelerator fired! id:', id);
          manualResult = `Accelerator Ctrl+O FIRED! id=${id}`;
          onMessage(manualResult);
        }
      });
      await item.setAccelerator('Ctrl+O');
      const sub = await Submenu.new({ text: 'Accel', items: [item] });
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      manualResult = 'Menu bar: "Accel → Accel Test" (Ctrl+O).\nPress Ctrl+O → should trigger action callback → show "FIRED" message.\nAlso try clicking "Accel Test" in dropdown → should also fire.\nIf Ctrl+O triggers → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarAcceleratorCopy() {
    await wrapManual('menuBarAcceleratorCopy', async () => {
      const { Menu, Submenu, PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const copyItem = await PredefinedMenuItem.new({ item: 'Copy' });
      const sub = await Submenu.new({ text: 'Edit', items: [copyItem] });
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      manualResult = 'Menu bar: "Edit → Copy" (Ctrl+C built-in).\nType some text → select it → press Ctrl+C.\nThen try pasting → should paste the copied text.\nIf Ctrl+C copies → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarFullscreen() {
    await wrapManual('menuBarFullscreen', async () => {
      const { Menu, Submenu, PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const fsItem = await PredefinedMenuItem.new({ item: 'Fullscreen' });
      const sub = await Submenu.new({ text: 'View', items: [fsItem] });
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      manualResult = 'Menu bar: "View → Fullscreen".\nClick "View → Fullscreen" → window enters fullscreen, menu bar should disappear.\nPress Esc or click again → exit fullscreen, menu bar should recover.\nIf menu bar hides/recover → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarPredefinedHide() {
    await wrapManual('menuBarPredefinedHide', async () => {
      const { Menu, Submenu, PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const hideItem = await PredefinedMenuItem.new({ item: 'Hide' });
      const sub = await Submenu.new({ text: 'Window', items: [hideItem] });
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      manualResult = 'Menu bar: "Window → Hide".\nClick "Window → Hide" → window should minimize.\nRestore window from taskbar → confirm it reappears.\nIf window minimizes on Hide → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarPopupRegression() {
    await wrapManual('menuBarPopupRegression', async () => {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ text: 'Popup Test' });
      const menu = await Menu.new({ items: [item] });
      await menu.popup();
      manualResult = 'Popup menu triggered at cursor position.\nCheck: Context menu should appear with "Popup Test".\nThis verifies AppStorage key renaming did not break popup.\nIf popup appears → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarActionEvent() {
    await wrapManual('menuBarActionEvent', async () => {
      const { Menu, Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({
        id: 'menu-event-test',
        text: 'Click Me',
        action: (id) => {
          console.log(`[MenuBar action] id=${id}`);
          const msg = `action callback fired! id=${id}`;
          manualResult = msg;
          onMessage(msg);
        }
      });
      const sub = await Submenu.new({ text: 'EventTest', items: [item] });
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      manualResult = 'MenuBar: "EventTest → Click Me".\nClick it → action callback should fire.\nVerify: result area updates + hilog shows [on_menu_event global] id=menu-event-test';
      onMessage(manualResult);
    });
  }

  // ─── Phase 13: Predefined Item Manual Tests ───
  async function manualMenuPredefinedCopy() {
    await wrapManual('menuPredefinedCopy', async () => {
      const { Menu, Submenu, PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const copyItem = await PredefinedMenuItem.new({ item: 'Copy' });
      const sub = await Submenu.new({ text: 'Edit', items: [copyItem] });
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      manualResult = 'Menu bar: "Edit → Copy".\nSelect some text in the input below → click Edit → Copy → paste elsewhere.\nIf text appears in clipboard → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuPredefinedPaste() {
    await wrapManual('menuPredefinedPaste', async () => {
      const { Menu, Submenu, PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const pasteItem = await PredefinedMenuItem.new({ item: 'Paste' });
      const sub = await Submenu.new({ text: 'Edit', items: [pasteItem] });
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      manualResult = 'Menu bar: "Edit → Paste".\nCopy some text from outside the app → focus input field → click Edit → Paste.\nIf text is inserted into input → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuPredefinedCut() {
    await wrapManual('menuPredefinedCut', async () => {
      const { Menu, Submenu, PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const cutItem = await PredefinedMenuItem.new({ item: 'Cut' });
      const sub = await Submenu.new({ text: 'Edit', items: [cutItem] });
      const menu = await Menu.new({ items: [sub] });
      await menu.setAsWindowMenu();
      manualResult = 'Menu bar: "Edit → Cut".\nSelect some text → click Edit → Cut → paste elsewhere.\nIf text disappears from selection AND appears in clipboard → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualMenuBarNativeIcons() {
    await wrapManual('menuBarNativeIcons', async () => {
      const { Menu, Submenu, IconMenuItem } = await import('@tauri-apps/api/menu');
      const { NativeIcon } = await import('@tauri-apps/api/menu/iconMenuItem');

      // 3 mapped variants (should show icons)
      const mapped = [
        { variant: NativeIcon.Add, label: 'Add (mapped: ohos_star)' },
        { variant: NativeIcon.LockLocked, label: 'LockLocked (mapped: ohos_lock)' },
        { variant: NativeIcon.Network, label: 'Network (mapped: ohos_wifi)' },
      ];

      // unmapped variants (should show no icon)
      const unmapped = [
        { variant: NativeIcon.Home, label: 'Home (unmapped)' },
        { variant: NativeIcon.Folder, label: 'Folder (unmapped)' },
        { variant: NativeIcon.Share, label: 'Share (unmapped)' },
        { variant: NativeIcon.User, label: 'User (unmapped)' },
        { variant: NativeIcon.Refresh, label: 'Refresh (unmapped)' },
        { variant: NativeIcon.GoLeft, label: 'GoLeft (unmapped)' },
        { variant: NativeIcon.GoRight, label: 'GoRight (unmapped)' },
        { variant: NativeIcon.Bluetooth, label: 'Bluetooth (unmapped)' },
        { variant: NativeIcon.Computer, label: 'Computer (unmapped)' },
        { variant: NativeIcon.TrashEmpty, label: 'TrashEmpty (unmapped)' },
      ];

      const mappedItems = await Promise.all(
        mapped.map(({ variant, label }) =>
          IconMenuItem.new({ text: label, icon: variant })
        )
      );
      const unmappedItems = await Promise.all(
        unmapped.map(({ variant, label }) =>
          IconMenuItem.new({ text: label, icon: variant })
        )
      );

      const mappedSub = await Submenu.new({ text: 'Mapped (should have icons)', items: mappedItems });
      const unmappedSub = await Submenu.new({ text: 'Unmapped (no icons expected)', items: unmappedItems });
      const menu = await Menu.new({ items: [mappedSub, unmappedSub] });
      await menu.setAsWindowMenu();

      manualResult =
        'Menu bar: "Mapped" and "Unmapped" submenus.\n\n' +
        'Mapped → should show icons for:\n' +
        '  • Add → ★ (ohos_star)\n' +
        '  • LockLocked → 🔒 (ohos_lock)\n' +
        '  • Network → 📶 (ohos_wifi)\n\n' +
        'Unmapped → no icons (Home, Folder, Share, etc.)\n\n' +
        'If mapped items show system icons and unmapped show text only → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualTrayPredefined() {
    await wrapManual('trayPredefined', async () => {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const { Menu, PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const TEST_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAJUlEQVR4nGNImfb/Py0xw6gFoxaMWjBqwagFoxaMWjBqwdCwAAB3Wq5b2Gx59gAAAABJRU5ErkJggg==';
      const menu = await Menu.new({ items: [
        await PredefinedMenuItem.new({ item: 'Copy' }),
        await PredefinedMenuItem.new({ item: 'Minimize' }),
        await PredefinedMenuItem.new({ item: 'About' }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await PredefinedMenuItem.new({ item: 'Fullscreen' }),
        await PredefinedMenuItem.new({ item: 'Quit' }),
      ]});
      await TrayIcon.new({ id: 'phase13-test', menu, icon: TEST_ICON, tooltip: 'Phase 13 Test' });
      manualResult = 'Tray icon created with predefined items.\nRight-click → Copy: should copy selected text.\nRight-click → Minimize: should minimize main window.\nRight-click → About: should show AlertDialog.\nRight-click → Fullscreen: should enter fullscreen.\nVerify each action works.';
      onMessage(manualResult);
    });
  }

  // ─── Tray Icon as Template Manual Tests ───
  async function manualIconAsTemplate() {
    await wrapManual('iconAsTemplate', async () => {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const TEST_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAJUlEQVR4nGNImfb/Py0xw6gFoxaMWjBqwagFoxaMWjBqwdCwAAB3Wq5b2Gx59gAAAABJRU5ErkJggg==';
      const tray = await TrayIcon.new({ id: 'template-tray', icon: TEST_ICON, iconAsTemplate: true });
      manualResult = 'Tray icon created with iconAsTemplate=true.\nSwitch system wallpaper between dark and light.\nThe status bar icon should automatically change between white (dark wallpaper) and black (light wallpaper) to remain visible.';
      onMessage(manualResult);
    });
  }

  async function manualWhiteIconNoTemplate() {
    await wrapManual('whiteIconNoTemplate', async () => {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      // 32x32 pure white PNG (valid CRC)
      const WHITE_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAKUlEQVR4nO3OIQEAAAACIP+f1hkWWEB6FgEBAQEBAQEBAQEBAQEBgXdgl/rw4unIZ5cAAAAASUVORK5CYII=';
      const tray = await TrayIcon.new({ id: 'white-no-template', icon: WHITE_ICON, iconAsTemplate: false });
      manualResult = 'Tray icon created: pure white 32x32, iconAsTemplate=false.\nSwitch between dark/light wallpaper.\nCompare with "Icon as Template" button to see if OHOS does its own color adaptation.';
      onMessage(manualResult);
    });
  }

  // ─── Clipboard writeImage Manual Tests ───
  // Valid 1×1 red pixel PNG (same bytes as automated test)
  const CLIPBOARD_TEST_PNG = new Uint8Array([
    137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,
    0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,
    222,0,0,0,12,73,68,65,84,120,156,99,248,207,192,0,
    0,3,1,1,0,201,254,146,239,0,0,0,0,73,69,78,
    68,174,66,96,130
  ]);

  async function manualClipboardWriteImageRgba() {
    await wrapManual('clipboardWriteImageRgba', async () => {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const rgba = new Uint8Array([255, 0, 0, 255]); // 1×1 red pixel
      await writeImage({ rgba, width: 1, height: 1 });
      manualResult = 'writeImage({ rgba: [255,0,0,255], width:1, height:1 }) OK.\nSwitch to another app → paste → should see a tiny red image.\nIf image appears → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualClipboardWriteImageDataUri() {
    await wrapManual('clipboardWriteImageDataUri', async () => {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
      await writeImage(dataUri);
      manualResult = `writeImage(dataUri) OK (data URI, ${dataUri.length} chars).\nSwitch to another app → paste → should see a 1×1 image.\nIf image appears → PASS.`;
      onMessage(manualResult);
    });
  }

  async function manualClipboardWriteImageRid() {
    await wrapManual('clipboardWriteImageRid', async () => {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const { Image } = await import('@tauri-apps/api/image');
      const rgba = new Uint8Array([255, 0, 0, 255]);
      const img = await Image.new(rgba, 1, 1);
      await writeImage(img);
      manualResult = `writeImage(Image rid=${img.rid}) OK.\nSwitch to another app → paste → should see a 1×1 red image.\nIf image appears → PASS.`;
      onMessage(manualResult);
    });
  }

  async function manualClipboardWriteImageBytes() {
    await wrapManual('clipboardWriteImageBytes', async () => {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeImage(CLIPBOARD_TEST_PNG);
      manualResult = `writeImage(Uint8Array) OK (${CLIPBOARD_TEST_PNG.length} bytes PNG).\nSwitch to another app → paste → should see a 1×1 red image.\nIf image appears → PASS.`;
      onMessage(manualResult);
    });
  }

  async function manualClipboardWriteImagePath() {
    await wrapManual('clipboardWriteImagePath', async () => {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const dir = await appCacheDir();
      const filePath = await join(dir, `manual-clipboard-${Date.now()}.png`);
      await writeFile(filePath, CLIPBOARD_TEST_PNG);
      await writeImage(filePath);
      manualResult = `writeImage(filePath) OK.\nPath: ${filePath}\nSwitch to another app → paste → should see a 1×1 red image.\nIf image appears → PASS.`;
      onMessage(manualResult);
    });
  }

  async function manualClipboardWriteImageNumberArray() {
    await wrapManual('clipboardWriteImageNumberArray', async () => {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      const arr = Array.from(CLIPBOARD_TEST_PNG);
      await writeImage(arr);
      manualResult = `writeImage(number[]) OK (${arr.length} elements).\nSwitch to another app → paste → should see a 1×1 red image.\nIf image appears → PASS.`;
      onMessage(manualResult);
    });
  }

  async function manualClipboardWriteImageArrayBuffer() {
    await wrapManual('clipboardWriteImageArrayBuffer', async () => {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeImage(CLIPBOARD_TEST_PNG.buffer.slice(0));
      manualResult = `writeImage(ArrayBuffer) OK (${CLIPBOARD_TEST_PNG.buffer.byteLength} bytes).\nSwitch to another app → paste → should see a 1×1 red image.\nIf image appears → PASS.`;
      onMessage(manualResult);
    });
  }

  // ─── Tray Manual Tests ───
  async function manualTrayIconShow() {
    await wrapManual('trayIconShow', async () => {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const TEST_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAJUlEQVR4nGNImfb/Py0xw6gFoxaMWjBqwagFoxaMWjBqwdCwAAB3Wq5b2Gx59gAAAABJRU5ErkJggg==';
      console.log('[Manual Tray] Creating tray icon...');
      const tray = await TrayIcon.new({ icon: TEST_ICON, tooltip: 'Test Tray Icon' });
      console.log(`[Manual Tray] Tray created with id: ${tray.id}`);
      manualResult = `Tray icon created with id: "${tray.id}".\nCheck the status bar (bottom of screen) for a blue square icon.`;
      onMessage(manualResult);
    });
  }

  async function manualTrayEvent() {
    await wrapManual('trayEvent', async () => {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const TEST_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAJUlEQVR4nGNImfb/Py0xw6gFoxaMWjBqwagFoxaMWjBqwdCwAAB3Wq5b2Gx59gAAAABJRU5ErkJggg==';

      // OHOS is single-tray: remove the default "tray-1" (created by tray.rs with
      // quickOperation.abilityName="TestTrayAbility") to avoid singleton conflict.
      // Without removal, the new tray may not replace it cleanly.
      try {
        const existing = await TrayIcon.getById('tray-1');
        if (existing) {
          await TrayIcon.removeById('tray-1');
          console.log('[Manual Tray] Removed existing tray-1');
        }
      } catch (e) {
        console.log('[Manual Tray] No existing tray-1 to remove:', e);
      }

      console.log('[Manual Tray] Creating tray with event listener...');
      const tray = await TrayIcon.new({
        icon: TEST_ICON,
        tooltip: 'Click me! (no QuickOp)',
        action: (event) => {
          const data = JSON.stringify(event);
          const ts = new Date().toLocaleTimeString();
          console.log(`[Manual Tray] Event received at ${ts}: ${data}`);
          manualResult = `TrayIconEvent received!\n${data}`;
          onMessage(manualResult);
        }
      });
      console.log(`[Manual Tray] Tray created with id: ${tray.id}`);
      manualResult = `Tray created (id: "${tray.id}") WITHOUT QuickOperation.\n` +
        `On OHOS: abilityName="" → statusBarIconClick should fire.\n` +
        `Click the status bar icon — event should appear below.\n\n` +
        `If no event after clicking:\n` +
        `• Check hilog for "[StatusBar] ICON CLICK NAPI CLOSURE INVOKED"\n` +
        `• Check hilog for "[StatusBar] icon click: clickType="\n` +
        `• If neither appears → statusBarManager.on() not working\n` +
        `• If they appear → Rust→JS event channel broken`;
      onMessage(manualResult);
    });
  }

  async function manualTrayMenu() {
    await wrapManual('trayMenu', async () => {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const TEST_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAJUlEQVR4nGNImfb/Py0xw6gFoxaMWjBqwagFoxaMWjBqwdCwAAB3Wq5b2Gx59gAAAABJRU5ErkJggg==';
      console.log('[Manual Tray] Creating tray with menu...');
      const item = await MenuItem.new({ text: 'Test Menu Item' });
      console.log('[Manual Tray] Menu item created');
      const menu = await Menu.new({ items: [item] });
      console.log('[Manual Tray] Menu created');
      const tray = await TrayIcon.new({ icon: TEST_ICON, menu, tooltip: 'Right-click me' });
      console.log(`[Manual Tray] Tray created with id: ${tray.id}`);
      manualResult = `Tray created with menu.\nRight-click the status bar icon to see the context menu.\nClick the menu item to verify event trigger.`;
      onMessage(manualResult);
    });
  }

  // ─── Window Decorations & Transparency Manual Tests (Phase 1+2+3) ───
  let decorationsState = $state('unknown');

  async function manualCreateBorderlessWindow() {
    await wrapManual('createBorderlessWindow', async () => {
      const windowId = 'borderless-test-' + Date.now();
      await invoke('create_borderless_window', { windowId });
      manualResult = `Borderless window created (id: "${windowId}").\n\n` +
        `Expected: Window should appear WITHOUT title bar, drag area, or close button.\n` +
        `Only the dark content area with "🖼️ Borderless Window" text should be visible.\n\n` +
        `If no title bar visible → PASS.\n` +
        `If title bar still visible → FAIL (decorations=false not working).\n\n` +
        `Close with Ctrl+W or Cmd+W.`;
      onMessage(manualResult);
    });
  }

  async function manualCreateTransparentBorderlessWindow() {
    await wrapManual('createTransparentBorderlessWindow', async () => {
      const windowId = 'transparent-borderless-' + Date.now();
      await invoke('create_transparent_borderless_window', { windowId });
      manualResult = `Transparent + borderless window created (id: "${windowId}").\n\n` +
        `Expected: Window should appear WITHOUT title bar AND with transparent background.\n` +
        `You should see the desktop/apps behind the window through the transparent areas.\n` +
        `Only the floating card with "✨ Transparent + Borderless" should be opaque.\n\n` +
        `If transparent AND no title bar → PASS.\n` +
        `If opaque background → transparent=true not working.\n` +
        `If title bar visible → decorations=false not working.\n\n` +
        `Close with Ctrl+W or Cmd+W.`;
      onMessage(manualResult);
    });
  }

  async function manualCreateUIAbilityWindow() {
    await wrapManual('createUIAbilityWindow', async () => {
      const windowId = 'uiability-instance-' + Date.now();
      await invoke('create_ui_ability_window', { windowId });
      manualResult = `UIAbility instance window requested (label: "${windowId}").\n\n` +
        `Expected: A new EntryAbility instance starts via context.startAbility,\n` +
        `opening a separate main window with its own lifecycle + recent-task card.\n` +
        `Requires launchType: "standard" in module.json5.\n\n` +
        `If a new independent window appears (separate from the Float sub-windows) → PASS.\n` +
        `If no new window or only onNewWant fires (singleton) → FAIL: launchType not standard.\n\n` +
        `Note: the new instance loads the app default page (MainPage), not hello.html.\n` +
        `The new window is system-managed: resize/move return 1300002 (no-op).`;
      onMessage(manualResult);
    });
  }

  async function manualCreateTransparentUIAbility() {
    await wrapManual('createTransparentUIAbility', async () => {
      const windowId = 'transparent-' + Date.now();
      await invoke('create_transparent_ui_ability_window', { windowId });
      manualResult = `Transparent UIAbility instance requested (label: "test-transparent-${windowId}").\n\n` +
        `Expected: A new EntryAbility instance opens with a TRANSPARENT main window,\n` +
        `loading transparent-test.html with test buttons.\n` +
        `You should see the desktop / windows behind it through the window.\n\n` +
        `The test page has 3 groups of buttons (distinct concepts):\n` +
        `  ① setBackgroundColor — system window layer (setWindowBackgroundColor)\n` +
        `  ② CSS body background — ArkUI content layer (document.body.style.background)\n` +
        `  ③ CSS opacity — whole content (document.body.style.opacity)\n\n` +
        `How transparency flows:\n` +
        `  builder.transparent(true) → tao → start_ui_ability(transparent=true)\n` +
        `  → want.parameters['tauri_transparent'] → new instance onWindowStageCreate\n` +
        `  → registerUIAbilityStage(transparent=true)\n` +
        `  → setWindowContainerColor('#00000000','#FFFFFFFF') (active=transparent, inactive=white)\n\n` +
        `If the new window is see-through (desktop visible) → PASS.\n` +
        `If opaque → FAIL: container color not applied.\n` +
        `Lose focus → window becomes opaque white (inactive, expected).`;
      onMessage(manualResult);
    });
  }


  async function manualToggleDecorations() {
    await wrapManual('toggleDecorations', async () => {
      const win = getCurrentWindow();
      const before = await win.isDecorated();
      const newState = !before;
      await win.setDecorations(newState);
      const after = await win.isDecorated();
      decorationsState = `isDecorated: ${before} → ${after}`;
      manualResult = `Decorations toggled: ${before} → ${after}\n\n` +
        `Expected: Window title bar should ${newState ? 'APPEAR' : 'DISAPPEAR'}.\n` +
        `After toggle, isDecorated() returned ${after}.\n\n` +
        `If visual matches ${after} → PASS.\n` +
        `If title bar state didn't change → FAIL.`;
      onMessage(manualResult);
    });
  }

  async function manualSetBackgroundColor(color, label) {
    await wrapManual(`setBackgroundColor(${label})`, async () => {
      const win = getCurrentWindow();
      if (color === null) {
        // Use webview-level API which supports null to truly reset to default
        await webview.setBackgroundColor(null);
        manualResult = `Background color reset to default (null via Webview API).\n\nExpected: Window background returns to its original default color.`;
      } else {
        await win.setBackgroundColor(color);
        const [r, g, b, a] = color;
        manualResult = `Background color set to [${r},${g},${b},${a}] (${label}).\n\n` +
          `Expected: Window background should change to ${label}.\n` +
          `Alpha=${a} (${a === 255 ? 'fully opaque' : a === 0 ? 'fully transparent' : 'semi-transparent'}).\n\n` +
          `If visual matches → PASS.`;
      }
      onMessage(manualResult);
    });
  }

  // ─── Vibrancy (Window Effects) Manual Tests (OHOS only) ───
  // NOTE: WebviewWindow.new defaults to OHOS UIAbility (singleton) which conflicts with the
  // main window. Use create_transparent_window (Float sub-window) instead so the window
  // creates successfully and setEffects can apply backdropBlur.
  async function manualVibrancyEffect(effectName, effect, opts, expect) {
    await wrapManual(`vibrancy:${effectName}`, async () => {
      const windowId = `manual-vibrancy-${effectName}`;
      // Reuse label so repeated clicks refresh the same window (avoid leftover windows)
      try { await WebviewWindow.getByLabel(windowId)?.then(w => w?.close()); } catch {}
      await invoke('create_transparent_window', { windowId });
      const win = await WebviewWindow.getByLabel(windowId);
      if (!win) throw new Error('vibrancy window not created');
      await win.setEffects({ effects: [effect], ...opts });
      manualResult = `Vibrancy ${effectName} window created (id: "${windowId}").\n\n` +
        `Expected: ${expect}\n\n` +
        `If matches → PASS.\nIf no blur/effect visible → FAIL.\n\n` +
        `Close with Ctrl+W or Cmd+W.`;
      onMessage(manualResult);
    });
  }

  async function manualVibrancyBlur() {
    await manualVibrancyEffect('Blur', Effect.Blur, { radius: 25 },
      'Window background FROSTED/BLURRY (backdropBlur 25) — content behind is visible but blurred.');
  }
  async function manualVibrancyAcrylic() {
    await manualVibrancyEffect('Acrylic', Effect.Acrylic, { radius: 25, color: [0, 0, 0, 128] },
      'Window background BLURRY + semi-transparent DARK tint (blur + color overlay).');
  }
  async function manualVibrancyTabbedDark() {
    await manualVibrancyEffect('TabbedDark', Effect.TabbedDark, { radius: 20 },
      'Window background BLURRY + DARK tint (OHOS approximates MicaDark via blur + dark tint).');
  }

  async function manualVibrancyClearEffects() {
    await wrapManual('vibrancy:clearEffects', async () => {
      const windowId = 'manual-vibrancy-clear';
      try { await WebviewWindow.getByLabel(windowId)?.then(w => w?.close()); } catch {}
      await invoke('create_transparent_window', { windowId });
      const win = await WebviewWindow.getByLabel(windowId);
      if (!win) throw new Error('vibrancy window not created');
      await win.setEffects({ effects: [Effect.Blur], radius: 25 });
      await new Promise((r) => setTimeout(r, 1000));
      await win.clearEffects();
      manualResult = `Vibrancy clearEffects window created (id: "${windowId}").\n\n` +
        `Expected: Window background was BLURRY for 1 second, then became CLEAR/TRANSPARENT after clearEffects.\n\n` +
        `If blur disappeared after ~1s → PASS.\nIf blur remained → FAIL (clearEffects not working).\n\n` +
        `Close with Ctrl+W or Cmd+W.`;
      onMessage(manualResult);
    });
  }

  async function manualVibrancyBuildTimeBlur() {
    await wrapManual('vibrancy:build-time Blur', async () => {
      const windowId = 'manual-vibrancy-build-blur';
      try { await WebviewWindow.getByLabel(windowId)?.then(w => w?.close()); } catch {}
      // create_transparent_window with effect param applies effects at BUILD time
      // (WindowBuilder::effects → registerController inject), distinct from runtime setEffects.
      await invoke('create_transparent_window', { windowId, effect: 'Blur', radius: 25 });
      manualResult = `Build-time Blur window created (id: "${windowId}").\n\n` +
        `Expected: Window appears with FROSTED/BLURRY background IMMEDIATELY on creation\n` +
        `(build-time effect via WindowBuilder::effects, not runtime setEffects).\n\n` +
        `If frosted on appear → PASS.\nIf clear on appear (needs runtime setEffects) → FAIL.\n\n` +
        `Close with Ctrl+W or Cmd+W.`;
      onMessage(manualResult);
    });
  }

  // ─── OHOS Window Operations Manual Tests ───
  // 窗口位置/大小/最大化/最小化/全屏/可见性/聚焦/置顶/装饰按钮/光标
  // 主窗口上 D 组 setDecorationFlags 为 no-op，但 is*() 状态仍翻转。
  let ohosWinState = $state('');
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  async function manualSetOuterPosition() {
    await wrapManual('setOuterPosition', async () => {
      const win = getCurrentWindow();
      const orig = await win.outerPosition();
      const tx = orig.x < 200 ? 400 : 100, ty = orig.y < 200 ? 400 : 100;
      await win.setPosition(new PhysicalPosition(tx, ty));
      await delay(600);
      const after = await win.outerPosition();
      ohosWinState = `outerPosition (${orig.x},${orig.y}) → (${after.x},${after.y}) target (${tx},${ty})`;
      manualResult = `setOuterPosition(${tx},${ty}) dispatched.\n\nExpected: 窗口左上角移动到 (${tx},${ty})。\n实际: (${after.x},${after.y})。\n若位置变化 → PASS。`;
      onMessage(manualResult);
    });
  }

  async function manualSetInnerSize() {
    await wrapManual('setInnerSize', async () => {
      const win = getCurrentWindow();
      const orig = await win.innerSize();
      const tw = Math.max(400, Math.floor(orig.width / 2));
      const th = Math.max(300, Math.floor(orig.height / 2));
      await win.setSize(new PhysicalSize(tw, th));
      await delay(700);
      const after = await win.innerSize();
      ohosWinState = `innerSize ${orig.width}×${orig.height} → ${after.width}×${after.height} target ${tw}×${th}`;
      manualResult = `setInnerSize(${tw}×${th}) dispatched.\n\nExpected: 窗口内容区变为 ${tw}×${th}。\n实际: ${after.width}×${after.height}。\n若尺寸变化 → PASS。`;
      onMessage(manualResult);
      await win.setSize(new PhysicalSize(orig.width, orig.height)); // 还原
      await delay(400);
    });
  }

  async function manualMaximize() {
    await wrapManual('maximize', async () => {
      const win = getCurrentWindow();
      const before = await win.isMaximized();
      if (before) { await win.unmaximize(); } else { await win.maximize(); }
      const after = await win.isMaximized();
      ohosWinState = `isMaximized: ${before} → ${after}`;
      manualResult = `maximize toggled: ${before} → ${after}.\n\nExpected: 窗口最大化填满屏幕 / 再次点击还原。\n若状态翻转且视觉变化 → PASS。`;
      onMessage(manualResult);
    });
  }

  async function manualMinimize() {
    await wrapManual('minimize', async () => {
      const win = getCurrentWindow();
      await win.minimize();
      ohosWinState = `minimize dispatched; 2s 后 unminimize`;
      manualResult = `minimize() dispatched.\n\nExpected: 窗口最小化到任务栏。2 秒后自动恢复。\n若先消失再恢复 → PASS。`;
      onMessage(manualResult);
      setTimeout(() => getCurrentWindow().unminimize(), 2000);
    });
  }

  async function manualFullscreen() {
    await wrapManual('setFullscreen', async () => {
      const win = getCurrentWindow();
      const before = await win.isFullscreen();
      await win.setFullscreen(!before);
      const after = await win.isFullscreen();
      ohosWinState = `isFullscreen: ${before} → ${after}`;
      manualResult = `setFullscreen(${!before}) dispatched.\n\nExpected: 全屏时进入沉浸布局（隐藏状态栏/导航条），再次点击还原。\n若系统栏隐藏/恢复 → PASS。`;
      onMessage(manualResult);
    });
  }

  async function manualShowHide() {
    await wrapManual('showHide', async () => {
      const win = getCurrentWindow();
      await win.hide();
      ohosWinState = `hide dispatched; 2s 后 show`;
      manualResult = `hide() dispatched。\n\nExpected: 窗口隐藏（主窗口 hideAbility 后台，子窗口 minimize）。2 秒后 show() 恢复。\n若先消失再恢复 → PASS。`;
      onMessage(manualResult);
      setTimeout(() => getCurrentWindow().show(), 2000);
    });
  }

  async function manualSetFocus() {
    await wrapManual('setFocus', async () => {
      const win = getCurrentWindow();
      await win.setFocus();
      const focused = await win.isFocused();
      ohosWinState = `isFocused → ${focused}`;
      manualResult = `setFocus() dispatched。\n\nExpected: 窗口置前获取焦点（子窗口 raiseToAppTop，主窗口系统管理）。\nisFocused() = ${focused}。\n若窗口来到最前 → PASS。`;
      onMessage(manualResult);
    });
  }

  async function manualAlwaysOnTop() {
    await wrapManual('setAlwaysOnTop', async () => {
      const win = getCurrentWindow();
      const before = await win.isAlwaysOnTop();
      await win.setAlwaysOnTop(!before);
      const after = await win.isAlwaysOnTop();
      ohosWinState = `isAlwaysOnTop: ${before} → ${after}`;
      manualResult = `setAlwaysOnTop(${!before}) dispatched。\n\nOHOS 无 z-order API：仅记录意图标志，isAlwaysOnTop()=${after}。\nFloat 子窗口天然浮于主窗口；主窗口置顶不强制生效。属 partial 实现。`;
      onMessage(manualResult);
    });
  }

  async function manualSetClosable() {
    await wrapManual('setClosable', async () => {
      const win = getCurrentWindow();
      const before = await win.isClosable();
      await win.setClosable(!before);
      const after = await win.isClosable();
      ohosWinState = `isClosable: ${before} → ${after}`;
      manualResult = `setClosable(${!before}) dispatched。\n\nExpected: 仅 Float 子窗口生效（控制 FloatPage 关闭按钮显隐）。\n主窗口装饰由系统管理，no-op，但 isClosable()=${after} 已翻转。\n在「Create Borderless Window」创建的子窗口上测试可见效果。`;
      onMessage(manualResult);
    });
  }

  async function manualSetMaximizable() {
    await wrapManual('setMaximizable', async () => {
      const win = getCurrentWindow();
      const before = await win.isMaximizable();
      await win.setMaximizable(!before);
      const after = await win.isMaximizable();
      ohosWinState = `isMaximizable: ${before} → ${after}`;
      manualResult = `setMaximizable(${!before}) dispatched。\n\nExpected: 仅 Float 子窗口生效（控制 maximize 按钮显隐）。\n主窗口 no-op，isMaximizable()=${after} 已翻转。`;
      onMessage(manualResult);
    });
  }

  async function manualSetMinimizable() {
    await wrapManual('setMinimizable', async () => {
      const win = getCurrentWindow();
      const before = await win.isMinimizable();
      await win.setMinimizable(!before);
      const after = await win.isMinimizable();
      ohosWinState = `isMinimizable: ${before} → ${after}`;
      manualResult = `setMinimizable(${!before}) dispatched。\n\nExpected: 仅 Float 子窗口生效（控制 minimize 按钮显隐）。\n主窗口 no-op，isMinimizable()=${after} 已翻转。`;
      onMessage(manualResult);
    });
  }

  async function manualSetResizable() {
    await wrapManual('setResizable', async () => {
      const win = getCurrentWindow();
      const before = await win.isResizable();
      await win.setResizable(!before);
      const after = await win.isResizable();
      ohosWinState = `isResizable: ${before} → ${after}`;
      manualResult = `setResizable(${!before}) dispatched。\n\nExpected: 仅 Float 子窗口生效（控制 resize 手柄显隐）。\n主窗口 no-op，isResizable()=${after} 已翻转。`;
      onMessage(manualResult);
    });
  }

  async function manualSetFocusable() {
    await wrapManual('setFocusable', async () => {
      const win = getCurrentWindow();
      await win.setFocusable(false);
      ohosWinState = `setFocusable(false) → 3s 后恢复`;
      manualResult = `setFocusable(false) dispatched。\n\nExpected: 窗口 3s 内不可聚焦（setWindowFocusable），点击不获取焦点。\n3 秒后自动恢复可聚焦。`;
      onMessage(manualResult);
      setTimeout(() => getCurrentWindow().setFocusable(true), 3000);
    });
  }

  async function manualCursorVisible() {
    await wrapManual('setCursorVisible', async () => {
      const win = getCurrentWindow();
      await win.setCursorVisible(false);
      ohosWinState = `cursorVisible=false; 3s 后恢复`;
      manualResult = `setCursorVisible(false) dispatched。\n\nExpected: 鼠标光标隐藏（pointer.setPointerVisible，全局）。\n移动鼠标验证光标隐藏。3 秒后自动恢复可见。`;
      onMessage(manualResult);
      setTimeout(() => getCurrentWindow().setCursorVisible(true), 3000);
    });
  }

  const cursorIcons = ['default', 'hand', 'crosshair', 'text', 'wait', 'copy', 'not-allowed', 'grab', 'zoom-in'];
  let cursorIconIdx = $state(0);
  async function manualCursorIcon() {
    await wrapManual('setCursorIcon', async () => {
      const win = getCurrentWindow();
      cursorIconIdx = (cursorIconIdx + 1) % cursorIcons.length;
      const icon = cursorIcons[cursorIconIdx];
      await win.setCursorIcon(icon);
      ohosWinState = `cursorIcon = ${icon}`;
      manualResult = `setCursorIcon("${icon}") dispatched。\n\nExpected: 鼠标光标变为 ${icon} 形状（pointer.setPointerStyleSync）。\n移动鼠标到窗口内查看光标样式。循环：${cursorIcons.join(' → ')}。`;
      onMessage(manualResult);
    });
  }

  let ignoreCursorState = $state(false);
  async function manualIgnoreCursor() {
    await wrapManual('setIgnoreCursorEvents', async () => {
      const win = getCurrentWindow();
      ignoreCursorState = !ignoreCursorState;
      await win.setIgnoreCursorEvents(ignoreCursorState);
      ohosWinState = `ignoreCursor = ${ignoreCursorState}`;
      manualResult = `setIgnoreCursorEvents(${ignoreCursorState}) dispatched。\n\nExpected: ignore=true 时窗口点击穿透（setWindowTouchable=false），可点到后面窗口/桌面。3 秒后自动恢复可触摸。`;
      onMessage(manualResult);
      if (ignoreCursorState) {
        setTimeout(() => { getCurrentWindow().setIgnoreCursorEvents(false); ignoreCursorState = false; }, 3000);
      }
    });
  }

  // ─── Process & Updater Manual Tests ───
  async function manualRelaunch() {
    await wrapManual('relaunch', async () => {
      const { relaunch } = await import('@tauri-apps/plugin-process');
      manualResult = 'relaunch() called. The app will restart now (process hard-kill, no onDestroy).\nOn OHOS: restartApp(want) triggers a cold restart.\nThe JS promise will NOT resolve — the process is killed before IPC response.\nVerify: app disappears and reappears within ~2 seconds.';
      onMessage(manualResult);
      // Small delay so the user can read the message before the process dies
      await new Promise(r => setTimeout(r, 1500));
      await relaunch();
    });
  }

  async function manualDownloadAndInstall() {
    await wrapManual('downloadAndInstall', async () => {
      const { check } = await import('@tauri-apps/plugin-updater');
      let update;
      try {
        update = await check();
      } catch (e) {
        manualResult = `check() rejected: ${e}\n\nThis is expected if the app is not published on AppGallery.\nOn OHOS, check() requires the app to be listed in the AppGallery store.`;
        onMessage(manualResult);
        return;
      }
      if (!update) {
        manualResult = 'check() returned null — no update available.\nCannot test downloadAndInstall without a pending update.\nOn OHOS: this requires the app to be published on AppGallery with a newer version available.';
        onMessage(manualResult);
        return;
      }
      manualResult = `Update found: ${update.currentVersion} → ${update.version}.\nCalling downloadAndInstall() — system dialog should appear.\nOn OHOS: AppGallery shows its native update dialog.\nVerify: dialog appears with update/download options.`;
      onMessage(manualResult);
      try {
        await update.downloadAndInstall();
        manualResult += '\ndownloadAndInstall() resolved — update downloaded and installed.';
      } catch (e) {
        manualResult += `\ndownloadAndInstall() rejected: ${e}`;
      }
      onMessage(manualResult);
    });
  }

  // ─── Create PDF Manual Test (OHOS only) ───
  async function manualCreatePdf() {
    await wrapManual('createPdf', async () => {
      let resolvePromise;
      const resultPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const unlisten = await listen('create-pdf-result', (event) => {
        unlisten();
        resolvePromise(event.payload);
      });

      setTimeout(() => {
        unlisten();
        resolvePromise('Timeout: no result within 15s');
      }, 15000);

      // App sandbox path — only writable location from ArkTS context
      const desktopPath = '/data/storage/el2/base/cache/test.pdf';
      await invoke('test_create_pdf', { path: desktopPath });
      const result = await resultPromise;

      const success = result.startsWith('true:');
      const path = result.split(':')[1];

      manualResult = `createPdf result: ${success ? 'SUCCESS ✅' : 'FAILED ❌'}\nPath: ${path}\n\n` +
        `To verify file exists on device:\n` +
        `hdc shell "ls -la /data/app/el2/100/base/com.tauri.api/cache/test.pdf"\n\n` +
        `To pull file to local:\n` +
        `hdc file recv /data/app/el2/100/base/com.tauri.api/cache/test.pdf ./test.pdf`;
      onMessage(manualResult);
    });
  }

  async function manualCreatePdfSquare() {
    await wrapManual('createPdfSquare', async () => {
      let resolvePromise;
      const resultPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      const unlisten = await listen('create-pdf-result', (event) => {
        unlisten();
        resolvePromise(event.payload);
      });

      setTimeout(() => {
        unlisten();
        resolvePromise('Timeout: no result within 15s');
      }, 15000);

      const path = '/data/storage/el2/base/cache/test-square.pdf';
      await invoke('test_create_pdf', {
        path,
        config: {
          width: 8.27,
          height: 8.27,
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
          shouldPrintBackground: true,
        },
      });
      const result = await resultPromise;

      const success = result.startsWith('true:');

      manualResult = `createPdf (Square 8.27×8.27in) result: ${success ? 'SUCCESS ✅' : 'FAILED ❌'}\nPath: ${path}\n\n` +
        `Config: width=8.27, height=8.27 (square), no margins, with background\n\n` +
        `To pull file to local:\n` +
        `hdc file recv /data/app/el2/100/base/com.tauri.api/cache/test-square.pdf ./test-square.pdf`;
      onMessage(manualResult);
    });
  }

  // ─── Cookie Live Manual Test (OHOS only) ───
  async function manualCookieLiveTest() {
    await wrapManual('cookieLive', async () => {
      await invoke('cookie_manual_test');
      manualResult = `Set cookie tauri_test_cookie=ManualTest123 for httpbin.org and opened a child window to https://httpbin.org/cookies.

Verify the JSON response contains "tauri_test_cookie": "ManualTest123" (cookie is actually sent to the server).
Reload the child window to verify the cookie persists.`;
      onMessage(manualResult);
    });
  }

  // ─── DevTools Manual Test (OHOS only, requires devtools feature build) ───
  async function manualDevtoolsTest() {
    await wrapManual('devtools', async () => {
      try {
        const report = await invoke('devtools_test');
        if (report.enabled) {
          const pass = report.after_open === true && report.after_close === false;
          manualResult = `devtools_test: ${pass ? 'PASS ✅' : 'FAIL ❌'}
initial=${report.initial}, after_open=${report.after_open}, after_close=${report.after_close}
(open_devtools → true, close_devtools → false; initial is stateful, see manual_tests 7.3)`;
        } else {
          manualResult = `devtools_test: devtools feature not enabled in this build.`;
        }
      } catch (e) {
        manualResult = `devtools_test: devtools feature not enabled in this build (command not available in standard release).`;
      }
      onMessage(manualResult);
    });
  }

  // ─── DevTools Open (only opens, does not close) ───
  async function manualDevtoolsOpen() {
    await wrapManual('devtools_open', async () => {
      try {
        await invoke('devtools_open_only');
        manualResult = `devtools_open: setWebDebuggingAccess(true) called. Domain socket created.\nNow run devtools.bat + open chrome://inspect to connect.`;
      } catch (e) {
        manualResult = `devtools_open: devtools feature not enabled in this build.`;
      }
      onMessage(manualResult);
    });
  }

  // ─── DevTools Close (only closes, disconnects Chrome) ───
  async function manualDevtoolsClose() {
    await wrapManual('devtools_close', async () => {
      try {
        await invoke('devtools_close_only');
        manualResult = `devtools_close: setWebDebuggingAccess(false) called. Domain socket destroyed.\nChrome DevTools should be disconnected.`;
      } catch (e) {
        manualResult = `devtools_close: devtools feature not enabled in this build.`;
      }
      onMessage(manualResult);
    });
  }

  // ─── QuickOperation Manual Tests (OHOS only) ───
  async function manualQuickOperationEnable() {
    await wrapManual('quickOperationEnable', async () => {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const tray = await TrayIcon.getById('tray-1');
      if (!tray) { manualResult = 'tray-1 not found'; onMessage(manualResult); return; }
      await tray.setQuickOperation({
        title: 'Test Panel',
        height: 250,
        abilityName: 'TestTrayAbility',
        moduleName: 'entry',
      });
      manualResult = 'QuickOperation enabled.\nLeft-click tray icon → system popup should appear with title "Test Panel" and height 250vp.\nRequires TestTrayAbility registered in module.json5.';
      onMessage(manualResult);
    });
  }

  async function manualQuickOperationDisable() {
    await wrapManual('quickOperationDisable', async () => {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const tray = await TrayIcon.getById('tray-1');
      if (!tray) { manualResult = 'tray-1 not found'; onMessage(manualResult); return; }
      await tray.setQuickOperation(null);
      manualResult = 'QuickOperation disabled.\nLeft-click tray icon → should only fire event, no popup.';
      onMessage(manualResult);
    });
  }

  async function manualQuickOperationUpdate() {
    await wrapManual('quickOperationUpdate', async () => {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const tray = await TrayIcon.getById('tray-1');
      if (!tray) { manualResult = 'tray-1 not found'; onMessage(manualResult); return; }
      await tray.setQuickOperation({
        title: 'Updated Title',
        height: 400,
        abilityName: 'TestTrayAbility',
      });
      manualResult = 'QuickOperation updated: title="Updated Title", height=400.\nLeft-click tray icon → popup title and height should reflect new values.';
      onMessage(manualResult);
    });
  }

  async function manualDialogOpen() {
    await wrapManual('dialog.open', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const file = await open({ multiple: false });
      manualResult = `open() result: ${file ? (typeof file === 'string' ? file : file.path) : 'cancelled'}`;
      onMessage(manualResult);
    });
  }

  async function manualDialogSave() {
    await wrapManual('dialog.save', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const file = await save({ defaultPath: 'test.txt' });
      manualResult = `save() result: ${file ? (typeof file === 'string' ? file : file.path) : 'cancelled'}`;
      onMessage(manualResult);
    });
  }

  async function manualDialogConfirm() {
    await wrapManual('dialog.confirm', async () => {
      const { confirm } = await import('@tauri-apps/plugin-dialog');
      const result = await confirm('Are you sure you want to proceed?', { title: 'Confirm Action', kind: 'warning' });
      manualResult = `confirm() result: ${result} [${result ? 'OK: user clicked Yes' : 'user clicked No or cancelled'}]`;
      onMessage(manualResult);
    });
  }

  async function manualDialogMessageInfo() {
    await wrapManual('dialog.message (info)', async () => {
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message('This is an INFO message dialog.', { title: 'Info Dialog', kind: 'info' });
      manualResult = 'message(kind: info) shown - verify info icon appeared';
      onMessage(manualResult);
    });
  }

  async function manualDialogMessageWarning() {
    await wrapManual('dialog.message (warning)', async () => {
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message('This is a WARNING message dialog!', { title: 'Warning Dialog', kind: 'warning' });
      manualResult = 'message(kind: warning) shown - verify warning icon appeared';
      onMessage(manualResult);
    });
  }

  async function manualDialogMessageError() {
    await wrapManual('dialog.message (error)', async () => {
      const { message } = await import('@tauri-apps/plugin-dialog');
      await message('This is an ERROR message dialog!', { title: 'Error Dialog', kind: 'error' });
      manualResult = 'message(kind: error) shown - verify error icon appeared';
      onMessage(manualResult);
    });
  }

  async function manualDialogOpenMultiple() {
    await wrapManual('dialog.open (multiple)', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const files = await open({ multiple: true });
      if (files === null) {
        manualResult = 'open(multiple: true) cancelled';
      } else if (Array.isArray(files)) {
        manualResult = `open(multiple: true) selected ${files.length} files:\n${files.map(f => typeof f === 'string' ? f : f.path).join('\n')}`;
      } else {
        manualResult = `open(multiple: true) single file: ${typeof files === 'string' ? files : files.path}`;
      }
      onMessage(manualResult);
    });
  }

  // ─── OHOS Adapter Manual Tests ───
  async function manualOhosPrint() {
    await wrapManual('webview.print', async () => {
      // window.print() is injected by tauri's print.js init script (plugin:webview|print
      // → wry OHOS print → createPdf → @ohos.print). Webview class has no print method;
      // the global window.print shim is the correct entry point on macOS/iOS/OHOS.
      try {
        await window.print();
        manualResult = 'window.print() called — check system print dialog (may take a few seconds for createPdf)';
      } catch (e) {
        manualResult = `print() error: ${e}`;
      }
      onMessage(manualResult);
    });
  }

  async function manualOhosMonitorFromPoint() {
    await wrapManual('monitor_from_point', async () => {
      const { currentMonitor } = await import('@tauri-apps/api/window');
      const m = await currentMonitor();
      if (!m) { manualResult = 'No monitor'; onMessage(manualResult); return; }
      const cx = Math.floor(m.size.width / 2);
      const cy = Math.floor(m.size.height / 2);
      manualResult = `monitor size: ${m.size.width}x${m.size.height}\n` +
        `test point (cx,cy)=(${cx},${cy}) should be Some(primary)\n` +
        `test point (-1,0) should be None\n` +
        `Note: monitor_from_point is tao-level, not exposed in JS API.\n` +
        `Verify via hilog or Rust test.`;
      onMessage(manualResult);
    });
  }

  async function manualOhosDialogError() {
    await wrapManual('dialog.error degrade', async () => {
      manualResult = 'dialog::error() is an internal runtime function.\n' +
        'On OHOS it degrades to log::error! (no panic).\n' +
        'The function is only called under cfg(windows) in practice.\n' +
        'To verify: check hilog for "[dialog::error]" entries after\n' +
        'triggering a runtime error path. App should NOT crash.';
      onMessage(manualResult);
    });
  }

  // OHOS adapter: create test webviews with specific flags
  async function manualOhosTestClipboardOff() {
    await wrapManual('clipboard=false', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('create_ohos_test_webview', {
        windowId: 'test-cb-off-' + Date.now(),
        label: 'Clipboard OFF test',
        clipboard: false,
      });
      manualResult = 'Test webview created with clipboard=false.\nSelect text + Ctrl+C → clipboard should NOT change.';
      onMessage(manualResult);
    });
  }

  async function manualOhosTestClipboardOn() {
    await wrapManual('clipboard=true', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('create_ohos_test_webview', {
        windowId: 'test-cb-on-' + Date.now(),
        label: 'Clipboard ON test',
        clipboard: true,
      });
      manualResult = 'Test webview created with clipboard=true.\nSelect text + Ctrl+C → clipboard should change.';
      onMessage(manualResult);
    });
  }

  async function manualOhosTestZoomOff() {
    await wrapManual('zoom_hotkeys=false', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('create_ohos_test_webview', {
        windowId: 'test-zoom-off-' + Date.now(),
        label: 'Zoom OFF test',
        zoomHotkeys: false,
      });
      manualResult = 'Test webview created with zoom_hotkeys=false.\nCtrl+= / Ctrl+- / Ctrl+0 → page zoom should NOT change.';
      onMessage(manualResult);
    });
  }

  async function manualOhosTestZoomOn() {
    await wrapManual('zoom_hotkeys=true', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('create_ohos_test_webview', {
        windowId: 'test-zoom-on-' + Date.now(),
        label: 'Zoom ON test',
        zoomHotkeys: true,
      });
      manualResult = 'Test webview created with zoom_hotkeys=true.\nCtrl+= / Ctrl+- / Ctrl+0 → page zoom should change.';
      onMessage(manualResult);
    });
  }

  async function manualOhosTestHttpsScheme() {
    await wrapManual('https_scheme=true', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('create_ohos_test_webview', {
        windowId: 'test-https-' + Date.now(),
        label: 'HTTPS Scheme test',
        httpsScheme: true,
      });
      manualResult = 'Test webview created with use_https_scheme=true.\nCheck hilog for onInterceptRequest + URL rewrite.\nVerify window.isSecureContext in DevTools.';
      onMessage(manualResult);
    });
  }

  // ─── Autostart Manual Tests ───
  async function manualAutostartIsEnabled() {
    await wrapManual('autostart.isEnabled', async () => {
      const { isEnabled } = await import('@tauri-apps/plugin-autostart');
      const result = await isEnabled();
      manualResult = `isEnabled() → ${result}\nVerify: Go to Settings → App launch management → check this app's toggle.\nIf ${result} matches the actual switch state → PASS.`;
      onMessage(manualResult);
    });
  }

  async function manualAutostartEnable() {
    await wrapManual('autostart.enable', async () => {
      const { enable } = await import('@tauri-apps/plugin-autostart');
      await enable();
      manualResult = 'enable() called.\nOn OHOS: System "App launch management" settings page should open now.\nFind this app and toggle the autostart switch ON.\nReturn to this app and click "isEnabled" to verify → should return true.';
      onMessage(manualResult);
    });
  }

  async function manualAutostartDisable() {
    await wrapManual('autostart.disable', async () => {
      const { disable } = await import('@tauri-apps/plugin-autostart');
      await disable();
      manualResult = 'disable() called.\nOn OHOS: System "App launch management" settings page should open now.\nFind this app and toggle the autostart switch OFF.\nReturn to this app and click "isEnabled" to verify → should return false.';
      onMessage(manualResult);
    });
  }

  // ─── Global Shortcut Manual Tests ───
  let globalShortcutStatus = $state('');

  async function manualGlobalShortcutRegister() {
    await wrapManual('globalShortcut.register', async () => {
      const { register, unregister } = await import('@tauri-apps/plugin-global-shortcut');
      const shortcut = 'CommandOrControl+Shift+T';
      // Unregister first in case it was left over
      try { await unregister(shortcut); } catch (_) { /* ignore */ }
      await register(shortcut, (event) => {
        globalShortcutStatus = `Triggered! id=${event.id}, state=${event.state}`;
        console.log(`[global-shortcut] Shortcut triggered: id=${event.id}, state=${event.state}`);
      });
      globalShortcutStatus = `Registered: ${shortcut}. Press it on physical keyboard.`;
      console.log(`[global-shortcut] Registered ${shortcut}. Waiting for key press...`);
    });
  }

  async function manualGlobalShortcutUnregister() {
    await wrapManual('globalShortcut.unregister', async () => {
      const { unregisterAll } = await import('@tauri-apps/plugin-global-shortcut');
      await unregisterAll();
      globalShortcutStatus = 'All shortcuts unregistered.';
      console.log('[global-shortcut] All shortcuts unregistered');
    });
  }

  // ─── WebView User-Agent Manual Tests ───

  // Listen for UA test results emitted from Rust
  onMount(async () => {
    const unlisten = await listen('ua-test-result', (event) => {
      const { windowId, userAgent } = event.payload;
      const msg = `[UA-TEST] ${windowId}: ${userAgent}`;
      console.log(msg);
      onMessage(msg);
    });
    return unlisten;
  });

  async function manualUserAgentCustom() {
    await wrapManual('webview.userAgent (custom)', async () => {
      try {
        await invoke('create_window_with_custom_ua', {
          windowId: 'ua-test-custom',
          userAgent: 'MyApp/1.0 Tauri/2.0',
        });
        manualResult = '✓ Opened new window (custom UA: "MyApp/1.0 Tauri/2.0").\n' +
          'Check the new window for test results.\n\n' +
          'Expected: page shows green "✓ PASS: Expected UA detected"';
        onMessage('UA custom test window opened');
      } catch (e) {
        manualResult = '✗ Failed to create window: ' + e;
        onMessage('UA custom test FAILED: ' + e);
      }
    });
  }

  async function manualUserAgentDefault() {
    await wrapManual('webview.userAgent (default)', async () => {
      try {
        await invoke('create_window_with_custom_ua', {
          windowId: 'ua-test-default',
          userAgent: '',
        });
        manualResult = '✓ Opened new window (system default UA).\n' +
          'Check the new window for test results.\n\n' +
          'Expected: page shows blue "ℹ System default UA (no custom UA set)"';
        onMessage('UA default test window opened');
      } catch (e) {
        manualResult = '✗ Failed to create window: ' + e;
        onMessage('UA default test FAILED: ' + e);
      }
    });
  }

  async function manualUserAgentMultiWindow() {
    await wrapManual('webview.userAgent (multi-window isolation)', async () => {
      let resultA = '';
      let resultB = '';

      try {
        await invoke('create_window_with_custom_ua', {
          windowId: 'ua-test-a',
          userAgent: 'App-A/1.0',
        });
        resultA = '✓ Window A (App-A/1.0) opened';
      } catch (e) {
        resultA = '✗ Window A creation failed: ' + e;
      }

      try {
        await invoke('create_window_with_custom_ua', {
          windowId: 'ua-test-b',
          userAgent: 'App-B/2.0',
        });
        resultB = '✓ Window B (App-B/2.0) opened';
      } catch (e) {
        resultB = '✗ Window B creation failed: ' + e;
      }

      manualResult = resultA + '\n' + resultB + '\n\n' +
        'Check test results in the opened windows.\n' +
        'Verify via hilog: hdc shell "hilog | grep UA-TEST"';
      onMessage('UA multi-window: ' + resultA + ' | ' + resultB);
    });
  }

  // ─── webPageSnapshot Manual Test ───
  async function manualWebPageSnapshot() {
    await wrapManual('webPageSnapshot', async () => {
      snapshotCanvas = null;
      const resultPromise = new Promise((resolve) => {
        const unlisten = listen('web-page-snapshot-result', (event) => {
          unlisten.then((fn) => fn());
          resolve(event.payload);
        });
        setTimeout(() => {
          unlisten.then((fn) => fn());
          resolve({ success: false, error: 'Timeout: no snapshot result within 10s' });
        }, 10000);
      });
      await invoke('test_web_page_snapshot');
      const result = await resultPromise;

      if (!result.success) {
        manualResult = `webPageSnapshot failed: ${result.error}`;
        onMessage(manualResult);
        return;
      }

      // Render snapshot to canvas for visual verification
      snapshotWidth = result.width;
      snapshotHeight = result.height;
      hasSnapshot = true;

      // Wait for canvas element to be mounted
      await new Promise(r => setTimeout(r, 50));

      if (canvasEl) {
        const ctx = canvasEl.getContext('2d');
        const imageData = new ImageData(new Uint8ClampedArray(result.rgba), result.width, result.height);
        ctx.putImageData(imageData, 0, 0);
      }

      manualResult = `Snapshot captured: ${result.width}×${result.height}, rgba_len=${result.rgba_len}\n` +
        `Check: canvas below should match the current WebView content.\n` +
        `If visual matches → PASS.`;
      onMessage(manualResult);
    });
  }

  // ─── on_new_window Manual Tests ───
  async function manualNewWindowAllow() {
    await wrapManual('newWindowAllow', async () => {
      await invoke('set_deny_new_window', { deny: false });
      window.open('https://example.com/manual-allow-test', '_blank');
      manualResult = 'Allow mode: dialog should appear with ✕ close button in title bar.\n' +
        'Verify:\n' +
        '  1. Dialog title bar shows URL\n' +
        '  2. Click ✕ to close\n' +
        '  3. Click outside dialog to close (autoCancel)\n' +
        '  4. Dialog embeds Web component loading the page';
      onMessage('on_new_window Allow: dialog should appear');
    });
  }

  async function manualNewWindowDeny() {
    await wrapManual('newWindowDeny', async () => {
      await invoke('set_deny_new_window', { deny: true });
      window.open('https://example.com/manual-deny-test', '_blank');
      await new Promise((r) => setTimeout(r, 1000));
      const lastUrl = await invoke('get_last_new_window_url');
      manualResult = 'Deny mode: no dialog should appear.\n' +
        `Handler received URL: ${lastUrl || '(null)'}\n` +
        `Verify:\n` +
        `  1. No dialog appears\n` +
        `  2. Page remains unchanged\n` +
        `  3. Handler received URL containing 'example.com/manual-deny-test'`;
      await invoke('set_deny_new_window', { deny: false });
      onMessage('on_new_window Deny: no dialog should appear');
    });
  }

  async function manualNewWindowCreate() {
    await wrapManual('newWindowCreate', async () => {
      await invoke('set_deny_new_window', { deny: false });
      await invoke('set_create_new_window', { create: true });
      window.open('https://example.com/manual-create-test', '_blank');
      await new Promise((r) => setTimeout(r, 2000));
      const lastUrl = await invoke('get_last_new_window_url');
      manualResult = 'Create mode: a real OS window should appear (not a dialog).\n' +
        `Handler received URL: ${lastUrl || '(null)'}\n` +
        `Verify:\n` +
        `  1. A separate OS window appears (not in-page dialog)\n` +
        `  2. Window has title bar with decorations\n` +
        `  3. Window loads the target URL\n` +
        `  4. Window can be moved/resized independently\n` +
        `  5. Closing the window does not close the main app`;
      await invoke('set_create_new_window', { create: false });
      onMessage('on_new_window Create: real OS window should appear');
    });
  }

  // ─── Window Focus + Hotkey Zoom Manual Tests ───
  async function manualWindowFocus() {
    await wrapManual('windowFocus', async () => {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const testWindow = await WebviewWindow.getByLabel('focus-test-window');
      if (testWindow) {
        await testWindow.setFocus();
        manualResult = 'Called setFocus() on existing focus-test-window.\nVerify: window should come to front.';
      } else {
        const w = new WebviewWindow('focus-test-window', {
          url: 'https://example.com/focus-test',
          title: 'Focus Test Window',
          width: 600,
          height: 400,
        });
        await new Promise((r) => setTimeout(r, 2000));
        await w.setFocus();
        manualResult = 'Created focus-test-window and called setFocus().\nVerify:\n  1. Sub-window appeared\n  2. After setFocus(), sub-window came to front';
      }
      onMessage('window focus: sub-window should be focused');
    });
  }

  async function manualHotkeyZoom() {
    await wrapManual('hotkeyZoom', async () => {
      manualResult = 'Hotkey Zoom Test (OHOS desktop only):\n\n' +
        '1. Click this test button\n' +
        '2. Focus the webview area\n' +
        '3. Press Ctrl + = to zoom in\n' +
        '4. Press Ctrl + - to zoom out\n\n' +
        'Verify: page content scales up/down.\n' +
        'If nothing happens, ArkWeb may not dispatch keydown with ctrlKey.';
      onMessage('hotkey zoom: follow instructions in result');
    });
  }

  // ─── Notification Manual Tests ───
  async function manualNotificationSend() {
    await wrapManual('notificationSend', async () => {
      const { sendNotification, isPermissionGranted } = await import('@tauri-apps/plugin-notification');
      const granted = await isPermissionGranted();
      if (!granted) {
        manualResult = '⚠️ 通知权限未授予。请先点击 "Request Permission" 按钮请求权限。';
        onMessage(manualResult);
        return;
      }
      sendNotification({ title: 'Tauri 手动测试', body: '如果你在通知中心看到这条消息，测试通过！' });
      manualResult = '✅ sendNotification() 调用成功。\n' +
        '验证步骤：\n' +
        '  1. 点击屏幕右上角系统通知图标\n' +
        '  2. 确认出现标题为 "Tauri 手动测试" 的通知\n' +
        '  3. 点击通知，确认通知消失（tapDismissed=true）';
      onMessage('Notification sent: check notification center');
    });
  }

  async function manualNotificationChannel() {
    await wrapManual('notificationChannel', async () => {
      const { createChannel, sendNotification, isPermissionGranted, Importance } = await import('@tauri-apps/plugin-notification');
      const granted = await isPermissionGranted();
      if (!granted) {
        manualResult = '⚠️ 通知权限未授予。请先点击 "Request Permission" 按钮。';
        onMessage(manualResult);
        return;
      }
      await createChannel({ id: 'manual-test-ch', name: '手动测试渠道', importance: Importance.Default });
      sendNotification({ title: '渠道通知测试', body: '通过 manual-test-ch 渠道发送', channelId: 'manual-test-ch' });
      manualResult = '✅ createChannel() + sendNotification(channelId) 调用成功。\n' +
        '验证步骤：\n' +
        '  1. 打开系统通知中心\n' +
        '  2. 确认出现标题为 "渠道通知测试" 的通知\n' +
        '  3. 通知应归属于 SERVICE_INFORMATION 渠道类型（importance=Default）';
      onMessage('Channel notification sent: check notification center');
    });
  }

  async function manualNotificationPermission() {
    await wrapManual('notificationPermission', async () => {
      const { requestPermission } = await import('@tauri-apps/plugin-notification');
      const result = await requestPermission();
      manualResult = `requestPermission() → "${result}"\n` +
        '验证步骤：\n' +
        `  1. ${result === 'granted' ? '✅ 权限已授予，后续调用不再弹窗' : result === 'denied' ? '⚠️ 权限被拒绝，需卸载重装应用才能重新弹窗' : 'ℹ️ 首次请求，系统应弹出权限对话框'}\n` +
        '  2. 如需重新测试弹窗，执行: hdc shell bm uninstall -n com.tauri.api 后重装';
      onMessage(`requestPermission → ${result}`);
    });
  }

  // ─── Sentry Manual Tests ───
  async function manualSentryJsError() {
    await wrapManual('sentryJsError', async () => {
      try {
        throw new Error('OHOS test error from examples/api');
      } catch (e) {
        console.error('[Sentry Test] Caught error:', e);
      }
      manualResult = '✅ JS Error thrown and caught.\n' +
        'If @sentry/browser is injected, the error should appear in Sentry dashboard.\n' +
        'Verify:\n' +
        '  1. Sentry dashboard shows new event with platform=javascript\n' +
        '  2. Event message contains "OHOS test error from examples/api"\n' +
        '  3. User-Agent does NOT contain OHOS WebView info\n\n' +
        'Note: If no event appears, check hilog for sentry debug logs.';
      onMessage(manualResult);
    });
  }

  async function manualSentryRustPanic() {
    await wrapManual('sentryRustPanic', async () => {
      manualResult = '⚠️  About to trigger Rust panic!\n' +
        'The panic handler will catch it and sentry should report it.\n' +
        'The app may crash after this.\n' +
        'Verify Sentry dashboard shows a panic event with:\n' +
        '  message: "sentry test panic from examples/api"\n' +
        '  Rust backtrace included';
      onMessage(manualResult);
      // Small delay so user can read the message
      await new Promise(r => setTimeout(r, 2000));
      try {
        await invoke('sentry_test_panic');
      } catch (e) {
        const msg = String(e);
        if (msg.includes('not found') || msg.includes('command')) {
          // Release build: sentry_test_panic is gated with #[cfg(debug_assertions)]
          manualResult += '\n\n⚠️ sentry_test_panic not available — only compiled in debug builds.';
        } else {
          // Expected: IPC will fail because the thread panicked
          manualResult += `\n\nPanic triggered. IPC error (expected): ${e}`;
        }
        onMessage(manualResult);
      }
    });
  }

  // ─── Unstable Feature Manual Tests ───
  async function manualReparentError() {
    await wrapManual('webview.reparent', async () => {
      const webview = getCurrentWebview();
      const window = getCurrentWindow();
      try {
        await webview.reparent(window);
        manualResult = 'reparent() returned success — UNEXPECTED ❌ (should error on OHOS)';
      } catch (e) {
        manualResult = `reparent() returned error (expected): ${e}\nNo deadlock: PASS ✅`;
      }
      onMessage(manualResult);
    });
  }

  async function manualReparentCascade() {
    await wrapManual('reparent cascade check', async () => {
      const webview = getCurrentWebview();
      const window = getCurrentWindow();
      try { await webview.reparent(window); } catch { /* expected */ }
      const size = await webview.size();
      const ok = size.width > 0 && size.height > 0;
      manualResult = `After failed reparent, webview.size() = (${size.width},${size.height})
Mutex released, no cascade deadlock: ${ok ? 'PASS ✅' : 'FAIL ❌'}`;
      onMessage(manualResult);
    });
  }

  async function manualCreateChildWebview() {
    await wrapManual('create_webview (multi-webview)', async () => {
      const window = getCurrentWindow();
      const label = `test-child-${Date.now()}`;
      manualResult = 'Creating child webview (300×200 at 50,50)...';
      onMessage(manualResult);

      const child = new Webview(window, label, {
        url: 'data:text/html,<html><body style="margin:0;padding:50px;font-family:sans-serif;background:lightgray"><h1>Child Webview</h1></body></html>',
        x: 50,
        y: 50,
        width: 300,
        height: 200,
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        child.once('tauri://created', () => { clearTimeout(timeout); resolve(); });
        child.once('tauri://error', (e) => { clearTimeout(timeout); reject(new Error(String(e))); });
      });

      manualResult = 'Child webview created ✅. Waiting 1s before close...';
      onMessage(manualResult);
      await new Promise((r) => setTimeout(r, 1000));

      try {
        await child.close();
        manualResult = 'Child webview closed. Check screen: child should be removed.';
      } catch (e) {
        manualResult = `Child webview close FAILED: ${e}`;
      }
      onMessage(manualResult);
    });
  }

  // ─── Window Operations & Persisted-Scope Manual Tests ───
  async function manualMinimizeThenIsMinimized() {
    await wrapManual('minimize then is_minimized', async () => {
      const win = getCurrentWindow();
      await win.minimize();
      await new Promise((r) => setTimeout(r, 500));
      const minimized = await win.isMinimized();
      manualResult = `minimize() -> isMinimized() = ${minimized}\n\n窗口已最小化到任务栏。\n如 isMinimized() = true -> PASS。\n\n请手动从任务栏点击恢复窗口。`;
      onMessage(manualResult);
    });
  }

  async function manualWindowStateSaveRestore() {
    await wrapManual('window-state save/restore', async () => {
      const win = getCurrentWindow();
      // Save current state
      await invoke('plugin:window-state|save_window_state', { label: win.label });
      // Read back current window info
      const pos = await win.outerPosition();
      const size = await win.innerSize();
      const maximized = await win.isMaximized();
      // Restore from saved state
      await invoke('plugin:window-state|restore_state', { label: win.label });
      await new Promise((r) => setTimeout(r, 300));
      const posAfter = await win.outerPosition();
      const sizeAfter = await win.innerSize();
      manualResult = `window-state save/restore 完成:\n\n保存时: pos=(${pos.x},${pos.y}) size=${size.width}×${size.height} maximized=${maximized}\n恢复后: pos=(${posAfter.x},${posAfter.y}) size=${sizeAfter.width}×${sizeAfter.height}\n\n如保存/恢复值一致 → PASS。\n命令执行无异常即说明插件 API 正常。`;
      onMessage(manualResult);
    });
  }

  async function manualWindowStateRestoreOnly() {
    await wrapManual('window-state restore only', async () => {
      const win = getCurrentWindow();
      const posBefore = await win.outerPosition();
      await invoke('plugin:window-state|restore_state', { label: win.label });
      await new Promise((r) => setTimeout(r, 500));
      const posAfter = await win.outerPosition();
      manualResult = `window-state restore only:\n\n恢复前: pos=(${posBefore.x},${posBefore.y})\n恢复后: pos=(${posAfter.x},${posAfter.y})\n\n如位置变化 → restore 生效(set_position 工作)。`;
      onMessage(manualResult);
    });
  }

  async function manualWindowStateClear() {
    await wrapManual('window-state clear', async () => {
      const result = await invoke('clear_window_state');
      manualResult = `window-state 清理:\n\n文件删除: ${result.deleted ? '✅ 已删除' : '⚠️ 文件不存在'}\n路径: ${result.state_file}\n\n${result.note}`;
      onMessage(manualResult);
    });
  }


  async function manualPersistedScopeTest() {
    await wrapManual('persisted-scope test', async () => {
      const result = await invoke('test_persisted_scope');
      manualResult = `persisted-scope 测试:\n\nallow_directory: ${result.allow_ok ? '✅ 成功' : '❌ 失败'}\n.persisted-scope 文件: ${result.state_file_exists ? '✅ 已生成 (' + result.state_file_size + ' bytes)' : '❌ 未生成'}\n路径: ${result.state_file}\n\n验证流程:\n1. 点 Clear → 重启 → 点 Test → 文件应不存在（Clear 生效）\n2. 点 Test → 文件生成（Save 生效）\n3. 重启 → 文件仍在（Restore 生效）`;
      onMessage(manualResult);
    });
  }

  async function manualPersistedScopeClear() {
    await wrapManual('persisted-scope clear', async () => {
      const result = await invoke('clear_persisted_scope');
      manualResult = `persisted-scope 清理:\n\n文件删除: ${result.deleted ? '✅ 已删除' : '⚠️ 文件不存在（无需删除）'}\n路径: ${result.state_file}\n内存中剩余 patterns: ${result.remaining_patterns_count} 个\n\n${result.note}`;
      onMessage(manualResult);
    });
  }

  // ─── Mouse Event Manual Tests (OHOS desktop / 2in1) ───
  let mouseTracking = $state(false);
  let mouseEvents = $state([]);
  let mouseTrackArea = $state(null);
  let mouseUnlisteners = [];
  let cursorPos = $state('');

  async function manualCursorPosition() {
    await wrapManual('cursorPosition', async () => {
      try {
        const pos = await cursorPosition();
        cursorPos = `cursorPosition() → (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)})`;
        manualResult = cursorPos;
      } catch (e) {
        cursorPos = `cursorPosition() → ERROR: ${e}`;
        manualResult = cursorPos;
      }
      onMessage(manualResult);
    });
  }

  // Deep-Link manual tests
  let deepLinkUnlisten = null;
  let deepLinkListening = $state(false);

  async function manualDeepLinkOnOpenUrl() {
    if (deepLinkListening) {
      deepLinkUnlisten?.();
      deepLinkListening = false;
      onMessage('[deep-link] Stopped listening for onOpenUrl events');
      return;
    }
    const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
    deepLinkUnlisten = await onOpenUrl((urls) => {
      onMessage(`[deep-link] onOpenUrl received: ${JSON.stringify(urls)}`);
    });
    deepLinkListening = true;
    onMessage('[deep-link] Listening for onOpenUrl. Trigger: hdc shell "aa start -U taurideeplink://test"');
  }

  async function manualDeepLinkGetCurrent() {
    const { getCurrent } = await import('@tauri-apps/plugin-deep-link');
    const result = await getCurrent();
    onMessage(`[deep-link] getCurrent → ${JSON.stringify(result)}`);
  }

  function manualDeepLinkExternalLaunch() {
    onMessage('[deep-link] Click taurideeplink://path link from browser/other app. App should come to foreground.');
  }

  async function toggleMouseTracking() {
    if (mouseTracking) {
      mouseUnlisteners.forEach((fn) => fn());
      mouseUnlisteners = [];
      mouseTracking = false;
      const summary = mouseEvents.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
      }, {});
      manualResult = `Mouse tracking stopped. Events: ${JSON.stringify(summary)}`;
      onMessage(manualResult);
    } else {
      mouseEvents = [];
      mouseTracking = true;

      const target = mouseTrackArea;
      if (!target) { manualResult = 'Track area not found'; return; }

      // Remove old listeners first
      mouseUnlisteners.forEach((fn) => fn());
      mouseUnlisteners = [];

      const types = ['mousemove', 'mousedown', 'mouseup', 'click', 'contextmenu', 'mouseenter', 'mouseleave', 'wheel'];
      types.forEach((type) => {
        const handler = (e) => {
          let entry;
          let label;
          if (type === 'wheel') {
            const isPinch = e.ctrlKey;
            entry = {
              type: isPinch ? 'pinch-zoom' : 'scroll',
              x: Math.round(e.deltaX),
              y: Math.round(e.deltaY),
              button: isPinch ? 'ctrl' : '',
              ts: Date.now(),
            };
            label = isPinch
              ? `pinch-zoom Δy=${entry.y} (${entry.y < 0 ? 'zoom in' : 'zoom out'})`
              : `scroll Δx=${entry.x} Δy=${entry.y}`;
          } else {
            entry = { type, x: Math.round(e.clientX), y: Math.round(e.clientY), button: e.button, ts: Date.now() };
            label = `${type} (${entry.x},${entry.y}) btn=${entry.button}`;
          }
          mouseEvents = [...mouseEvents.slice(-49), entry];
          onMessage(`[mouse] ${label}`);
        };
        target.addEventListener(type, handler, { passive: true });
        mouseUnlisteners.push(() => target.removeEventListener(type, handler));
      });

      manualResult = 'Mouse tracking started. Move mouse over the green area below, click left/right buttons.';
      onMessage(manualResult);
    }
    try {
      const path = await flushConsoleLog();
      onMessage(`Console log saved: ${path}`);
    } catch (e) {}
  }

  // ─── Plugins Manual Tests (opener/store/upload/localhost) ───
  // Autotest covers in-memory CRUD; these cover side-effects autotest can't
  // assert: opener system intents, cross-restart persistence, upload progress,
  // and localhost CORS headers.
  async function manualOpenerOpenPath() {
    await wrapManual('opener.openPath', async () => {
      const { openPath } = await import('@tauri-apps/plugin-opener');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const dir = await appCacheDir();
      const filePath = await join(dir, `opener-${Date.now()}.txt`);
      await writeFile(filePath, new TextEncoder().encode('opener manual test'));
      await openPath(filePath);
      manualResult = `openPath(${filePath}) called.\nCheck: system opens the file (text viewer/editor or file manager).\nFile left at: ${filePath}`;
      onMessage(manualResult);
    });
  }

  async function manualOpenerReveal() {
    await wrapManual('opener.revealItemInDir', async () => {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const dir = await appCacheDir();
      const filePath = await join(dir, `opener-reveal-${Date.now()}.txt`);
      await writeFile(filePath, new TextEncoder().encode('opener reveal test'));
      await revealItemInDir(filePath);
      manualResult = `revealItemInDir(${filePath}) called.\nCheck: file manager opens and highlights the file.\nFile left at: ${filePath}`;
      onMessage(manualResult);
    });
  }

  async function manualOpenerOpenUrl() {
    await wrapManual('opener.openUrl', async () => {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl('https://tauri.app');
      manualResult = `openUrl('https://tauri.app') called.\nCheck: system browser opens the URL.`;
      onMessage(manualResult);
    });
  }

  async function manualStorePersist() {
    await wrapManual('store.persist', async () => {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load('manual-store.json');
      const sentinel = `persisted-${Date.now()}`;
      await store.set('manual-sentinel', { value: sentinel });
      await store.save();
      await store.close();
      manualResult = `store.save() done. key='manual-sentinel' value='${sentinel}' → manual-store.json.\nNext: force-stop app and restart, then click "Store Verify (after restart)".`;
      onMessage(manualResult);
    });
  }

  async function manualStoreVerify() {
    await wrapManual('store.verify', async () => {
      const { load } = await import('@tauri-apps/plugin-store');
      const store = await load('manual-store.json');
      const got = await store.get('manual-sentinel');
      await store.close();
      const ok = !!got && typeof got.value === 'string' && got.value.startsWith('persisted-');
      manualResult = `store.get('manual-sentinel') → ${JSON.stringify(got)}\n${ok ? 'PASS: value persisted across restart.' : 'FAIL: value missing — persistence not working.'}`;
      onMessage(manualResult);
    });
  }

  async function manualUploadProgress() {
    await wrapManual('upload.progress', async () => {
      const { upload } = await import('@tauri-apps/plugin-upload');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const dir = await appCacheDir();
      const filePath = await join(dir, `upload-${Date.now()}.txt`);
      await writeFile(filePath, new TextEncoder().encode('x'.repeat(64 * 1024)));
      const events = [];
      const resp = await upload('http://localhost:3003/up', filePath, (p) => {
        events.push(`progress=${p.progress} total=${p.progressTotal}`);
      });
      const respStr = typeof resp === 'string' ? resp : String(resp);
      // Truncate the (potentially large) echo body so the progress/PASS verdict
      // stays visible — the localhost echo server returns the full payload.
      const respPreview = respStr.length > 50
        ? respStr.slice(0, 50) + `... (${respStr.length} bytes)`
        : respStr;
      const uploadOk = respStr.length > 0;
      manualResult = `upload response: ${respPreview}\nprogress events: ${events.length}\n${events.slice(-5).join('\n')}\n${uploadOk ? 'PASS: upload succeeded (response received).' : 'FAIL: empty response.'}${events.length > 0 ? '' : ' (note: progress may not fire for fast small uploads over localhost)'}`;
      onMessage(manualResult);
    });
  }

  async function manualLocalhostFetch() {
    await wrapManual('localhost.fetch', async () => {
      const resp = await fetch('http://127.0.0.1:3005/index.html');
      const body = await resp.text();
      const cors = resp.headers.get('access-control-allow-origin');
      const ok = resp.status === 200 && body.length > 0;
      manualResult = `fetch 127.0.0.1:3005/index.html → status=${resp.status} bodyLen=${body.length} ACAO=${cors}\n${ok ? 'PASS: localhost serve OK.' : 'FAIL.'}${cors ? '' : ' (warning: no Access-Control-Allow-Origin header)'}`;
      onMessage(manualResult);
    });
  }

</script>

<div class="flex flex-col gap-2">
  <div class="flex gap-2 flex-wrap">
    <button class="btn" onclick={runAll} disabled={running}>
      {running ? 'Running...' : 'Run All'}
    </button>
    <button class="btn" onclick={() => runCategory('auto')} disabled={running}>
      Run Auto
    </button>
    <button class="btn" onclick={() => runCategory('side-effect')} disabled={running}>
      Run Side-Effect
    </button>
    <button class="btn" onclick={async () => {
      try {
        await clearConsoleLog();
        onMessage('Console log cleared');
      } catch (e) {
        onMessage(`Failed to clear: ${e}`);
      }
    }}>
      Clear Console
    </button>
    <button class="btn" onclick={async () => {
      try {
        const closed = await invoke('close_all_test_windows');
        const list = Array.isArray(closed) ? closed : [];
        onMessage(list.length > 0
          ? `Closed ${list.length} test window(s): ${list.join(', ')}`
          : 'No test windows to close (only main remains)');
      } catch (e) {
        onMessage(`Failed to close test windows: ${e}`);
      }
    }}>
      Close All Test Windows
    </button>
  </div>

  {#if report}
    <div class="text-sm mt-2 p-2 rd-1 bg-black/10 dark:bg-white/10">
      Total: {report.total} | Passed: {report.passed} | Failed: {report.failed} | Skipped: {report.skipped}
    </div>
  {/if}

  {#if results.length > 0}
    <div class="flex flex-col gap-1 mt-2 text-xs max-h-60 overflow-y-auto">
      {#each results as r}
        <div class="flex items-center gap-2 p-1 rd-1 {r.status === 'pass' ? 'bg-green-500/10' : r.status === 'fail' ? 'bg-red-500/10' : 'bg-gray-500/10'}">
          <span class="font-mono w-12 shrink-0">
            {r.status === 'pass' ? 'PASS' : r.status === 'fail' ? 'FAIL' : 'SKIP'}
          </span>
          <span class="flex-1 truncate">{r.name}</span>
          <span class="text-gray-500 shrink-0">{r.duration}ms</span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="mt-4 pt-3 border-t-1 border-solid border-code">
    <h4 class="my-2">Manual Tests</h4>
    <p class="text-xs text-gray-500 mb-2">
      Verifies behavior that autotest can't cover (e.g., focus state must be true when user is interacting).
    </p>
    <div class="flex gap-2 flex-wrap">
      <button class="btn" onclick={manualIsFocused}>isFocused (should be true)</button>
      <button class="btn" onclick={toggleFocusWatch}>
        {focusWatchActive ? 'Stop watching focus' : 'Watch onFocusChanged'}
      </button>
      <button class="btn" onclick={manualMonitor}>currentMonitor</button>
      <button class="btn" onclick={manualIgnoreCursorEvents}>setIgnoreCursorEvents (3s toggle)</button>
      <button class="btn" onclick={manualAppCacheDir}>appCacheDir</button>
      <button class="btn" onclick={manualWindowDpi}>Window DPI (resize/drag to verify)</button>
      <button class="btn" onclick={manualOsInfo}>OS Info (platform/type/version)</button>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Deep-Link</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualDeepLinkOnOpenUrl}>
          {deepLinkListening ? 'Stop onOpenUrl' : 'onOpenUrl (trigger with hdc)'}
        </button>
        <button class="btn" onclick={manualDeepLinkGetCurrent}>getCurrent</button>
        <button class="btn" onclick={manualDeepLinkExternalLaunch}>External launch (browser)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Mouse Events (OHOS desktop / 2in1)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={toggleMouseTracking}>
          {mouseTracking ? 'Stop Mouse Tracking' : 'Start Mouse Tracking'}
        </button>
        <button class="btn" onclick={manualCursorPosition}>Get Cursor Position</button>
      </div>
      {#if cursorPos}
        <div class="mt-1 text-xs font-mono text-blue-600">{cursorPos}</div>
      {/if}
      <div
        bind:this={mouseTrackArea}
        style="width:100%;height:80px;margin-top:8px;background:{mouseTracking ? '#22c55e33' : '#6b728020'};border:2px dashed {mouseTracking ? '#22c55e' : '#6b7280'};border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:{mouseTracking ? 'crosshair' : 'default'};user-select:none;"
      >
        <span class="text-xs text-gray-600">
          {mouseTracking ? '🖱️ Tracking — move / click / scroll / pinch-zoom here' : 'Click "Start Mouse Tracking" then interact here'}
        </span>
      </div>
      {#if mouseEvents.length > 0}
        <div class="mt-1 text-xs font-mono text-gray-600 dark:text-gray-400 max-h-24 overflow-y-auto">
          {#each mouseEvents.slice(-10) as e}
            <div class={e.type === 'pinch-zoom' ? 'text-purple-600 font-bold' : ''}>
              {e.type} ({e.x},{e.y}) {e.button ? `btn=${e.button}` : ''}
            </div>
          {/each}
        </div>
      {/if}
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Window Decorations & Transparency (Phase 1+2+3)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualToggleDecorations}>Toggle Decorations (main window)</button>
        <button class="btn" onclick={manualCreateBorderlessWindow}>Create Borderless Window (decorations=false)</button>
        <button class="btn" onclick={manualCreateTransparentBorderlessWindow}>Create Transparent+Borderless</button>
      </div>
      <h5 class="my-1 mt-2 text-xs text-gray-500">Window Background Color (Phase 3)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={() => manualSetBackgroundColor([255, 0, 0, 255], 'Red opaque')}>Set BG Red (opaque)</button>
        <button class="btn" onclick={() => manualSetBackgroundColor([0, 0, 255, 128], 'Blue semi-transparent')}>Set BG Blue (alpha=128)</button>
        <button class="btn" onclick={() => manualSetBackgroundColor([0, 255, 0, 0], 'Green fully transparent')}>Set BG Green (alpha=0)</button>
        <button class="btn" onclick={() => manualSetBackgroundColor(null, 'reset')}>Reset BG (null)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Vibrancy (Window Effects) — OHOS</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualVibrancyBlur}>vibrancy: Blur effect visible</button>
        <button class="btn" onclick={manualVibrancyAcrylic}>vibrancy: Acrylic effect visible</button>
        <button class="btn" onclick={manualVibrancyTabbedDark}>vibrancy: TabbedDark effect visible</button>
        <button class="btn" onclick={manualVibrancyClearEffects}>vibrancy: clearEffects removes blur</button>
        <button class="btn" onclick={manualVibrancyBuildTimeBlur}>vibrancy: build-time Blur (WindowBuilder::effects)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">OHOS Window Ops — 几何/状态</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualSetOuterPosition}>setOuterPosition (toggle 100/400)</button>
        <button class="btn" onclick={manualSetInnerSize}>setInnerSize (half size, restore)</button>
        <button class="btn" onclick={manualMaximize}>Toggle Maximize</button>
        <button class="btn" onclick={manualMinimize}>Minimize (2s restore)</button>
        <button class="btn" onclick={manualFullscreen}>Toggle Fullscreen</button>
        <button class="btn" onclick={manualShowHide}>Hide/Show (2s restore)</button>
        <button class="btn" onclick={manualSetFocus}>setFocus</button>
        <button class="btn" onclick={manualAlwaysOnTop}>Toggle AlwaysOnTop (partial)</button>
      </div>
      <h5 class="my-1 mt-2 text-xs text-gray-500">OHOS Window Ops — 多 UIAbility 实例 (startAbility)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualCreateUIAbilityWindow}>Create UIAbility Instance Window</button>
        <button class="btn" onclick={manualCreateTransparentUIAbility}>Create Transparent UIAbility (主窗口透明)</button>
      </div>
      <h5 class="my-1 mt-2 text-xs text-gray-500">OHOS Window Ops — 装饰按钮 (Float 子窗口生效)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualSetClosable}>Toggle Closable</button>
        <button class="btn" onclick={manualSetMaximizable}>Toggle Maximizable</button>
        <button class="btn" onclick={manualSetMinimizable}>Toggle Minimizable</button>
        <button class="btn" onclick={manualSetResizable}>Toggle Resizable</button>
        <button class="btn" onclick={manualSetFocusable}>setFocusable(false) (3s)</button>
      </div>
      <h5 class="my-1 mt-2 text-xs text-gray-500">OHOS Window Ops — 光标</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualCursorVisible}>setCursorVisible(false) (3s)</button>
        <button class="btn" onclick={manualCursorIcon}>Cycle CursorIcon</button>
        <button class="btn" onclick={manualIgnoreCursor}>Toggle IgnoreCursor (3s)</button>
      </div>
      {#if ohosWinState}
        <div class="mt-1 text-xs font-mono text-gray-600 dark:text-gray-400">{ohosWinState}</div>
      {/if}
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Process & Updater Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualRelaunch}>relaunch() (app will restart)</button>
        <button class="btn" onclick={manualDownloadAndInstall}>downloadAndInstall() (system dialog)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Clipboard writeImage Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualClipboardWriteImageRgba}>writeImage(rgba)</button>
        <button class="btn" onclick={manualClipboardWriteImageDataUri}>writeImage(data-uri)</button>
        <button class="btn" onclick={manualClipboardWriteImageRid}>writeImage(Image rid)</button>
        <button class="btn" onclick={manualClipboardWriteImageBytes}>writeImage(Uint8Array)</button>
        <button class="btn" onclick={manualClipboardWriteImagePath}>writeImage(filePath)</button>
        <button class="btn" onclick={manualClipboardWriteImageNumberArray}>writeImage(number[])</button>
        <button class="btn" onclick={manualClipboardWriteImageArrayBuffer}>writeImage(ArrayBuffer)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">webview.createPdf Manual Tests (OHOS only)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualCreatePdf}>Create PDF A4 (default)</button>
        <button class="btn" onclick={manualCreatePdfSquare}>Create PDF Square (8.27×8.27)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">webview.cookie Manual Tests (OHOS only)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualCookieLiveTest}>Cookie Live (httpbin echo)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">webview.devtools Manual Test (OHOS only, needs devtools build)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualDevtoolsTest}>DevTools (toggle test)</button>
        <button class="btn" onclick={manualDevtoolsOpen}>DevTools Open</button>
        <button class="btn" onclick={manualDevtoolsClose}>DevTools Close</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Tray Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualTrayIconShow}>Tray Icon Show (check system tray)</button>
        <button class="btn" onclick={manualTrayEvent}>Tray Event (click icon to trigger)</button>
        <button class="btn" onclick={manualTrayMenu}>Tray Menu (right-click to see menu)</button>
        <button class="btn" onclick={manualTrayPredefined}>Tray Predefined Actions</button>
        <button class="btn" onclick={manualIconAsTemplate}>Icon as Template (check wallpaper)</button>
        <button class="btn" onclick={manualWhiteIconNoTemplate}>White Icon NO Template (compare)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">QuickOperation Manual Tests (OHOS only)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualQuickOperationEnable}>Enable QuickOp (click tray icon)</button>
        <button class="btn" onclick={manualQuickOperationUpdate}>Update QuickOp (title/height)</button>
        <button class="btn" onclick={manualQuickOperationDisable}>Disable QuickOp (event only)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Menu Bar Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualMenuBarRestore}>Restore Default Menu</button>
        <button class="btn" onclick={manualMenuBarVisible}>MenuBar Visible</button>
        <button class="btn" onclick={manualMenuBarDropdown}>MenuBar Dropdown</button>
        <button class="btn" onclick={manualMenuBarNested}>MenuBar Nested Submenu</button>
        <button class="btn" onclick={manualMenuBarHover}>MenuBar Hover</button>
        <button class="btn" onclick={manualMenuBarBarIcon}>MenuBar Bar-Level Icon</button>
        <button class="btn" onclick={manualMenuBarDisabledItem}>MenuBar Disabled Item</button>
        <button class="btn" onclick={manualMenuBarHide}>MenuBar Hide</button>
        <button class="btn" onclick={manualMenuBarShow}>MenuBar Show</button>
        <button class="btn" onclick={manualMenuBarIsMenuVisible}>MenuBar is_menu_visible</button>
        <button class="btn" onclick={manualMenuBarRemove}>MenuBar Remove Menu</button>
        <button class="btn" onclick={manualMenuBarAutoRefreshText}>MenuBar Auto Refresh Text</button>
        <button class="btn" onclick={manualMenuBarAutoRefreshChecked}>MenuBar Auto Refresh Checked</button>
        <button class="btn" onclick={manualMenuBarAccelerator}>MenuBar Accelerator Ctrl+O</button>
        <button class="btn" onclick={manualMenuBarAcceleratorCopy}>MenuBar Accelerator Ctrl+C</button>
        <button class="btn" onclick={manualMenuBarFullscreen}>MenuBar Fullscreen</button>
        <button class="btn" onclick={manualMenuBarPredefinedHide}>MenuBar Predefined Hide</button>
        <button class="btn" onclick={manualMenuBarPopupRegression}>MenuBar Popup Regression</button>
        <button class="btn" onclick={manualMenuBarActionEvent}>MenuBar Action Event</button>
        <button class="btn" onclick={manualMenuPredefinedCopy}>Menu Edit → Copy (predefined)</button>
        <button class="btn" onclick={manualMenuPredefinedPaste}>Menu Edit → Paste (predefined)</button>
        <button class="btn" onclick={manualMenuPredefinedCut}>Menu Edit → Cut (predefined)</button>
        <button class="btn" onclick={manualMenuBarNativeIcons}>MenuBar NativeIcon Symbols</button>
      </div>
    </div>
    <div class="flex gap-2 flex-wrap mt-2">
      <button class="btn" onclick={manualDialogOpen}>Dialog.open (single)</button>
      <button class="btn" onclick={manualDialogOpenMultiple}>Dialog.open (multiple)</button>
      <button class="btn" onclick={manualDialogSave}>Dialog.save</button>
    </div>
    <div class="flex gap-2 flex-wrap mt-2">
      <button class="btn" onclick={manualDialogConfirm}>Dialog.confirm</button>
    </div>
    <div class="flex gap-2 flex-wrap mt-2">
      <button class="btn" onclick={manualDialogMessageInfo}>Dialog.message (info)</button>
      <button class="btn" onclick={manualDialogMessageWarning}>Dialog.message (warning)</button>
      <button class="btn" onclick={manualDialogMessageError}>Dialog.message (error)</button>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">OHOS Adapter Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualOhosPrint}>WebView Print</button>
        <button class="btn" onclick={manualOhosMonitorFromPoint}>Monitor Info</button>
        <button class="btn" onclick={manualOhosDialogError}>Dialog Error (degrade)</button>
        <button class="btn" onclick={manualEventResumed}>RunEvent::Resumed (background→foreground)</button>
      </div>
      <div class="flex gap-2 flex-wrap mt-2">
        <button class="btn" onclick={manualOhosTestClipboardOff}>Clipboard OFF</button>
        <button class="btn" onclick={manualOhosTestClipboardOn}>Clipboard ON</button>
      </div>
      <div class="flex gap-2 flex-wrap mt-2">
        <button class="btn" onclick={manualOhosTestZoomOff}>Zoom OFF</button>
        <button class="btn" onclick={manualOhosTestZoomOn}>Zoom ON</button>
        <button class="btn" onclick={manualOhosTestHttpsScheme}>HTTPS Scheme</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Autostart Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualAutostartIsEnabled}>isEnabled()</button>
        <button class="btn" onclick={manualAutostartEnable}>enable() (opens settings)</button>
        <button class="btn" onclick={manualAutostartDisable}>disable() (opens settings)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Global Shortcut Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualGlobalShortcutRegister}>Register Ctrl+Shift+T</button>
        <button class="btn" onclick={manualGlobalShortcutUnregister}>Unregister All</button>
      </div>
      {#if globalShortcutStatus}
        <p class="text-xs mt-1 text-blue-600">{globalShortcutStatus}</p>
      {/if}
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">WebView User-Agent Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualUserAgentCustom}>userAgent (custom)</button>
        <button class="btn" onclick={manualUserAgentDefault}>userAgent (default)</button>
        <button class="btn" onclick={manualUserAgentMultiWindow}>userAgent (multi-window)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">on_new_window Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualNewWindowAllow}>Allow (dialog with ✕ close)</button>
        <button class="btn" onclick={manualNewWindowDeny}>Deny (no dialog)</button>
        <button class="btn" onclick={manualNewWindowCreate}>Create (real OS window)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Window Focus + Hotkey Zoom Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualWindowFocus}>Window Focus (create + focus sub-window)</button>
        <button class="btn" onclick={manualHotkeyZoom}>Hotkey Zoom (Ctrl+/-)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">WebView webPageSnapshot Manual Test</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualWebPageSnapshot}>Take Snapshot (verify canvas matches page)</button>
      </div>
      {#if hasSnapshot}
        <div class="mt-2 max-h-60 overflow-auto border-1 border-solid border-code rd-1">
          <canvas bind:this={canvasEl} width={snapshotWidth} height={snapshotHeight}></canvas>
        </div>
      {/if}
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Notification Manual Tests (视觉确认)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualNotificationSend}>Send Notification</button>
        <button class="btn" onclick={manualNotificationChannel}>Send With Channel</button>
        <button class="btn" onclick={manualNotificationPermission}>Request Permission</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Sentry (错误追踪) Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualSentryJsError}>JS Error Capture</button>
        <button class="btn" onclick={manualSentryRustPanic}>Rust Panic (may crash)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Unstable Feature (窗口与 Webview 解耦) Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualReparentError}>reparent returns error (no deadlock)</button>
        <button class="btn" onclick={manualReparentCascade}>reparent cascade check</button>
        <button class="btn" onclick={manualCreateChildWebview}>create_webview (multi-webview)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Window Operations & Persisted-Scope Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualMinimizeThenIsMinimized}>Minimize then is_minimized</button>
        <button class="btn" onclick={manualWindowStateSaveRestore}>Window-State Save</button>
        <button class="btn" onclick={manualWindowStateRestoreOnly}>Window-State Restore</button>
        <button class="btn" onclick={manualWindowStateClear}>Window-State Clear</button>
        <button class="btn" onclick={manualPersistedScopeTest}>Persisted-Scope Test</button>
        <button class="btn" onclick={manualPersistedScopeClear}>Persisted-Scope Clear</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Plugins Manual Tests (opener/store/upload/localhost)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualOpenerOpenPath}>Opener openPath (open file)</button>
        <button class="btn" onclick={manualOpenerReveal}>Opener revealItemInDir</button>
        <button class="btn" onclick={manualOpenerOpenUrl}>Opener openUrl (open browser)</button>
        <button class="btn" onclick={manualStorePersist}>Store Persist (set+save)</button>
        <button class="btn" onclick={manualStoreVerify}>Store Verify (after restart)</button>
        <button class="btn" onclick={manualUploadProgress}>Upload (echo+progress)</button>
        <button class="btn" onclick={manualLocalhostFetch}>Localhost fetch (CORS)</button>
      </div>
    </div>
    {#if manualResult}
      <div class="mt-2 p-2 rd-1 bg-black/10 dark:bg-white/10 text-xs font-mono break-all">
        {manualResult}
      </div>
    {/if}
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-bold">Menu Event Log</span>
        <span class="text-xs text-gray-500">({menuEvents.length})</span>
        {#if menuEvents.length > 0}
          <button class="text-xs text-blue-500 underline" onclick={() => menuEvents = []}>Clear</button>
        {/if}
      </div>
      {#if menuEvents.length > 0}
        <div class="max-h-40 overflow-y-auto flex flex-col gap-1">
          {#each menuEvents as ev}
            <div class="text-xs font-mono p-1 rd-1 bg-green-500/10 dark:bg-green-500/20">{ev.ts} — {ev.payload}</div>
          {/each}
        </div>
      {:else}
        <div class="text-xs text-gray-500 italic">No events yet. Click a tray menu item or menubar item to see events here.</div>
      {/if}
    </div>
    {#if focusWatchActive || focusEvents.length > 0}
      <div class="mt-2 text-xs">
        <div class="font-bold mb-1">Focus events ({focusEvents.length}):</div>
        <div class="max-h-32 overflow-y-auto flex flex-col gap-1">
          {#each focusEvents as ev}
            <div class="font-mono p-1 rd-1 bg-black/5 dark:bg-white/5">{ev}</div>
          {/each}
          {#if focusEvents.length === 0 && focusWatchActive}
            <div class="text-gray-500 italic">Waiting... send app to background and bring it back.</div>
          {/if}
        </div>
      </div>
    {/if}
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <div class="flex items-center gap-2 mb-1">
        <h5 class="text-xs font-bold">⌨ Key Repeat Detection (OHOS desktop / 2in1)</h5>
        <button class="btn" onclick={() => { keyTestActive = !keyTestActive; if (!keyTestActive) clearKeyTestLog(); }}>
          {keyTestActive ? '⏹ Stop' : '▶ Start'}
        </button>
        {#if keyTestLog.length > 0}
          <button class="text-xs text-blue-500 underline" onclick={clearKeyTestLog}>Clear</button>
        {/if}
      </div>
      {#if keyTestActive}
        <input
          type="text"
          class="w-full p-2 mb-1 rd-1 border border-solid border-blue-400 bg-blue-500/5 text-sm outline-none"
          placeholder="Click here and hold a key to test repeat detection..."
          onkeydown={onKeyTestKeydown}
          onkeyup={onKeyTestKeyup}
          autofocus
        />
        <div class="text-xs text-gray-500 mb-1">
          <code>event.repeat</code> = browser native repeat flag &nbsp;|&nbsp; <code>Set repeat</code> = HashSet-based detection (tao)
        </div>
      {/if}
      {#if keyTestLog.length > 0}
        <div class="max-h-48 overflow-y-auto flex flex-col gap-0.5">
          {#each keyTestLog as entry}
            <div class="text-xs font-mono p-1 rd-1"
              style="background:{entry.highlight ? 'rgba(34,197,94,0.2)' : 'rgba(0,0,0,0.05)'};{entry.highlight ? 'font-weight:bold;color:#16a34a' : ''}">
              {entry.text}
            </div>
          {/each}
        </div>
      {:else if keyTestActive}
        <div class="text-xs text-gray-500 italic">Waiting for key events...</div>
      {:else}
        <div class="text-xs text-gray-500">Press <b>Start</b> to capture keyboard events. Hold a key to test repeat detection.</div>
      {/if}
    </div>
  </div>
</div>
