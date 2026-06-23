<script>
  import { onMount } from 'svelte';
  import { runTests } from '../lib/test-runner';
  import { coreTests } from '../lib/tests/core';
  import { pluginTests } from '../lib/tests/plugins';
  import { dpiTests } from '../lib/tests/dpi';
  import { windowDpiTests } from '../lib/tests/window-dpi';
  import { imageTests } from '../lib/tests/image';
  import { menuTests } from '../lib/tests/menu';
  import { trayTests } from '../lib/tests/tray';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow, currentMonitor } from '@tauri-apps/api/window';
  import { getCurrentWebview } from '@tauri-apps/api/webview';
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

  const allTests = [...coreTests, ...pluginTests, ...dpiTests, ...windowDpiTests, ...imageTests, ...menuTests, ...trayTests];
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
      <button class="btn" onclick={manualAppCacheDir}>appCacheDir</button>
      <button class="btn" onclick={manualWindowDpi}>Window DPI (resize/drag to verify)</button>
      <button class="btn" onclick={manualOsInfo}>OS Info (platform/type/version)</button>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Window Decorations & Transparency (Phase 1+2+3)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualCreateBorderlessWindow}>Create Borderless Window (decorations=false)</button>
        <button class="btn" onclick={manualCreateTransparentBorderlessWindow}>Create Transparent+Borderless</button>
        <button class="btn" onclick={manualToggleDecorations}>Toggle Decorations (current window)</button>
      </div>
      <div class="flex gap-2 flex-wrap mt-2">
        <button class="btn" onclick={() => manualSetBackgroundColor([255, 0, 0, 128], 'semi-transparent red')}>BG: Semi-Red</button>
        <button class="btn" onclick={() => manualSetBackgroundColor([0, 255, 0, 128], 'semi-transparent green')}>BG: Semi-Green</button>
        <button class="btn" onclick={() => manualSetBackgroundColor([0, 0, 255, 255], 'opaque blue')}>BG: Opaque Blue</button>
        <button class="btn" onclick={() => manualSetBackgroundColor([0, 0, 0, 0], 'fully transparent')}>BG: Transparent</button>
        <button class="btn" onclick={() => manualSetBackgroundColor(null, 'null (reset)')}>BG: Reset</button>
      </div>
      {#if decorationsState !== 'unknown'}
        <div class="mt-1 text-xs font-mono text-gray-600 dark:text-gray-400">{decorationsState}</div>
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
      <h5 class="my-1 text-xs text-gray-500">Autostart Manual Tests</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualAutostartIsEnabled}>isEnabled()</button>
        <button class="btn" onclick={manualAutostartEnable}>enable() (opens settings)</button>
        <button class="btn" onclick={manualAutostartDisable}>disable() (opens settings)</button>
      </div>
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
  </div>
</div>
