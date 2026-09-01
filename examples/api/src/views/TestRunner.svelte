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
  import { ohosAdapterTests } from '../lib/tests/ohos-adapter';
  import { ohosInitTests } from '../lib/tests/ohos-init';
  import { ohosGapTests } from '../lib/tests/ohos-gap';
  import { ohosMobilePluginTests } from '../lib/tests/ohos-mobile-plugins';
  import { ohosScreenshotTests } from '../lib/tests/ohos-screenshot';
  import { ohosContinuationTests } from '../lib/tests/ohos-continuation';
  import { windowOpsTests } from '../lib/tests/window-ops';
  import { windowOpsExtraTests } from '../lib/tests/window-ops-extra';
  import { driverTests, sideReplayTests, badInputTests } from '../lib/tests/driver-generated';
  import { faultInjectionTests } from '../lib/tests/fault-injection-generated';
  import { apiGapTests } from '../lib/tests/api-gap';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow, currentMonitor, cursorPosition, Effect, LogicalSize, PhysicalPosition, PhysicalSize, UserAttentionType } from '@tauri-apps/api/window';
  import { getCurrentWebview, Webview } from '@tauri-apps/api/webview';
  import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
  import { saveWindowState, restoreStateCurrent, filename as windowStateFilename, StateFlags } from '@tauri-apps/plugin-window-state';
  import { appCacheDir, join } from '@tauri-apps/api/path';
  import { flushConsoleLog, clearConsoleLog } from '../lib/console-capture';

  let { onMessage } = $props();

  let results = $state([]);
  let running = $state(false);
  let report = $state(null);

  // Manual test state
  let manualResult = $state('');
  let revealPublicPath = $state('/storage/media/100/local/files/Docs/IDEProjects');
  let focusWatchActive = $state(false);
  let focusWatchUnlisten = null;
  let focusEvents = $state([]);
  // Window-event watch state (Resized/Moved/FocusChanged) for the toggle button
  let winEventWatchActive = $state(false);
  let winEventUnlistens = null;
  let winEventCount = $state(0);
  let winEventTypes = $state([]);
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

  // driver 盲调用 + side-effect 复放按 design 放最后（S2 覆盖率套件）。
  // 门控：仅覆盖率验证构建（cov-build.sh VITE_COVERAGE_TESTS=true）注入覆盖率批次；
  // VITE_AUTOTEST（自动跑测试）不注入，普通 demo 保持 283 用例标准集。
  // api-gap 批（S10）压轴：含 app 隐显 / 设置页跳转等破坏性操作，必须在所有批次之后。
  const coverageTests = import.meta.env.VITE_COVERAGE_TESTS ? [...driverTests, ...sideReplayTests, ...badInputTests, ...faultInjectionTests, ...windowOpsExtraTests, ...apiGapTests] : [];
  const allTests = [...coreTests, ...pluginTests, ...dpiTests, ...windowDpiTests, ...imageTests, ...menuTests, ...trayTests, ...ohosAdapterTests, ...ohosInitTests, ...ohosGapTests, ...ohosMobilePluginTests, ...ohosScreenshotTests, ...ohosContinuationTests, ...windowOpsTests, ...coverageTests];
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

    // Flush LLVM coverage data on OHOS instrumented builds. No-op / rejected
    // silently on non-cov-dump builds (command not registered).
    try {
      await invoke('dump_coverage');
      onMessage('[cov-dump] coverage flushed');
    } catch (e) {
      // command absent on non-cov-dump builds — ignore
    }
  }

  // Auto-run on first mount — ONLY in the main window, and only in autotest
  // builds (VITE_AUTOTEST / VITE_COVERAGE_TESTS，由 run-tests.sh / cov-build.sh
  // 设置)。普通 demo 构建（cargo tauri ohos run）不自动跑，手动点 Run All。
  // Test sub-windows (clipboard/zoom/https-scheme tests created via
  // create_ohos_test_webview) load the same index.html, so their onMount
  // would also fire runAll() and spawn a flood of auto-test sub-windows,
  // polluting keyboard-interaction verification (Ctrl+C / Ctrl+= intercept).
  // Gate on the main window label so sub-windows stay static.
  let listenId = 0;
  onMount(async () => {
    const isMainWindow = getCurrentWindow().label === 'main';
    const isAutotest = Boolean(import.meta.env.VITE_AUTOTEST || import.meta.env.VITE_COVERAGE_TESTS);
    if (isMainWindow && isAutotest) {
      runAll();
    } else if (isMainWindow) {
      onMessage('[TestRunner] autotest disabled (no VITE_AUTOTEST/VITE_COVERAGE_TESTS) — click Run All to test');
    } else {
      onMessage(`[TestRunner] sub-window "${getCurrentWindow().label}" — auto-test skipped (static test window)`);
    }
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

  // Full pass-through test on a Float overlay sub-window (manual_tests.md §二十八).
  // The 3s-toggle smoke above only exercises the TSFN bridge on the main window;
  // T0/T1 require an overlay ABOVE the main window so click/hover pass-through is
  // observable. setIgnoreCursorEvents DOES pass label (unlike setBackgroundColor),
  // so targeting the sub-window via getByLabel works.
  let overlayIgnoreCursorWin = null;
  async function manualOverlayIgnoreCursor() {
    await wrapManual('overlayIgnoreCursor', async () => {
      const label = 'manual-ignore-cursor-overlay';
      // Reuse if still open; otherwise create a fresh transparent Float overlay.
      let win = await WebviewWindow.getByLabel(label);
      if (!win) {
        await invoke('create_transparent_window', { windowId: label });
        win = await WebviewWindow.getByLabel(label);
      }
      if (!win) throw new Error('overlay window not created');
      overlayIgnoreCursorWin = win;
      await win.setIgnoreCursorEvents(true);
      manualResult = '✅ overlay 子窗口（"manual-ignore-cursor-overlay"，800×600 Float）已 setIgnoreCursorEvents(true)。\n' +
        '验证步骤（30 秒窗口）：\n' +
        '  T0 触摸/点击穿透：点击 overlay 深色卡片覆盖区域 → 点击应落到下层主窗口（主窗口按钮可点/有反应，overlay 不响应不获焦）\n' +
        '  T1 hover 穿透：鼠标悬停 overlay 覆盖的主窗口按钮 → hover 高亮应生效\n' +
        '  30 秒后自动恢复 touchable（overlay 重新消费事件）。';
      onMessage(manualResult);
      setTimeout(async () => {
        try {
          await overlayIgnoreCursorWin?.setIgnoreCursorEvents(false);
          onMessage('Restored: overlay setIgnoreCursorEvents(false) — overlay consumes events again.');
        } catch (e) {
          onMessage('overlay restore failed: ' + e);
        }
      }, 30000);
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

      // 4 mapped variants (should show icons)
      const mapped = [
        { variant: NativeIcon.Add, label: 'Add (mapped: ohos_star)' },
        { variant: NativeIcon.LockLocked, label: 'LockLocked (mapped: ohos_lock)' },
        { variant: NativeIcon.Network, label: 'Network (mapped: ohos_wifi)' },
        { variant: NativeIcon.Folder, label: 'Folder (mapped: folder)' },
      ];

      // unmapped variants (should show no icon)
      const unmapped = [
        { variant: NativeIcon.Home, label: 'Home (unmapped)' },
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
        '  • Network → 📶 (ohos_wifi)\n' +
        '  • Folder → 📁 (folder, no ohos_ prefix)\n\n' +
        'Unmapped → no icons (Home, Share, etc.)\n\n' +
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
  // Tracks the label of the most-recently-created Float sub-window so the BG
  // buttons (set_background_color) can target it instead of the main window.
  // @tauri-apps/api Window.setBackgroundColor omits `label` in the invoke payload
  // (upstream bug), so we invoke the command directly with this label.
  let lastCreatedWindowLabel = $state(null);

  async function manualCreateBorderlessWindow() {
    await wrapManual('createBorderlessWindow', async () => {
      const windowId = 'borderless-test-' + Date.now();
      await invoke('create_borderless_window', { windowId });
      lastCreatedWindowLabel = windowId;
      manualResult = `Borderless window created (id: "${windowId}").\n\n` +
        `Expected: Window should appear WITHOUT title bar, drag area, or close button.\n` +
        `Only the dark content area with "🖼️ Borderless Window" text should be visible.\n\n` +
        `If no title bar visible → PASS.\n` +
        `If title bar still visible → FAIL (decorations=false not working).\n\n` +
        `This window is now the BG color target — click a Set BG button below to change its background.\n\n` +
        `Close with Ctrl+W or Cmd+W.`;
      onMessage(manualResult);
    });
  }

  async function manualCreateTransparentBorderlessWindow() {
    await wrapManual('createTransparentBorderlessWindow', async () => {
      const windowId = 'transparent-borderless-' + Date.now();
      await invoke('create_transparent_borderless_window', { windowId });
      lastCreatedWindowLabel = windowId;
      manualResult = `Transparent + borderless window created (id: "${windowId}").\n\n` +
        `Expected: Window should appear WITHOUT title bar AND with transparent background.\n` +
        `You should see the desktop/apps behind the window through the transparent areas.\n` +
        `Only the floating card with "✨ Transparent + Borderless" should be opaque.\n\n` +
        `If transparent AND no title bar → PASS.\n` +
        `If opaque background → transparent=true not working.\n` +
        `If title bar visible → decorations=false not working.\n\n` +
        `This window is now the BG color target — click a Set BG button below to change its background.\n\n` +
        `Close with Ctrl+W or Cmd+W.`;
      onMessage(manualResult);
    });
  }

  async function manualCreateDecoratedWindow() {
    await wrapManual('createDecoratedWindow', async () => {
      const windowId = 'decorated-' + Date.now();
      await invoke('create_decorated_window', { windowId });
      const win = await WebviewWindow.getByLabel(windowId);
      if (!win) throw new Error('decorated window not created');
      lastCreatedWindowLabel = windowId;
      // Set a title (setWindowTitle → LocalStorage 'title' → FloatPage title bar)
      try { await win.setTitle('🪟 Decorated Test Window'); } catch (e) { /* may fail on main window, ignore */ }
      manualResult = `Decorated window created (id: "${windowId}").\n\n` +
        `Expected: Window WITH title bar + minimize/maximize/close buttons.\n` +
        `Title bar should show "🪟 Decorated Test Window".\n\n` +
        `Test decoration flags below:\n` +
        `- Toggle Closable → close button appears/disappears\n` +
        `- Toggle Maximizable → maximize button appears/disappears\n` +
        `- Toggle Minimizable → minimize button appears/disappears\n` +
        `- setFocusable(false) → window won't accept focus\n\n` +
        `This window is now the decoration flags target.\n\n` +
        `Close with the title bar close button or Ctrl+W.`;
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

  // Set the background color on the most-recently-created Float sub-window
  // (click "Create Borderless Window" or "Create Transparent+Borderless" first).
  //
  // Why not win.setBackgroundColor(): @tauri-apps/api Window.setBackgroundColor
  // (window.ts) does NOT pass `label` in the invoke payload (unlike setDecorations
  // etc.), so the Rust command `get_window(window, label=None)` always resolves to
  // the main window (windowId=0), whose background is masked by the XComponent
  // content layer. We invoke the command directly with the sub-window's label so
  // it targets the correct Float sub-window. Upstream bug — should be fixed in
  // @tauri-apps/api. See ohos-window-test-mapping.md row "窗口背景色".
  async function manualSetBackgroundColor(color, label) {
    await wrapManual(`setBackgroundColor(${label})`, async () => {
      if (!lastCreatedWindowLabel) {
        manualResult = `No sub-window target. Click "Create Borderless Window" or "Create Transparent+Borderless" first, then click a Set BG button.`;
        onMessage(manualResult);
        return;
      }
      if (color === null) {
        // Reset: restore the sub-window background to default (opaque white)
        await invoke('plugin:window|set_background_color', { label: lastCreatedWindowLabel, value: null });
        manualResult = `Background color reset to default on sub-window "${lastCreatedWindowLabel}".`;
      } else {
        await invoke('plugin:window|set_background_color', { label: lastCreatedWindowLabel, value: color });
        const [r, g, b, a] = color;
        manualResult = `Background color set to [${r},${g},${b},${a}] (${label}) on sub-window "${lastCreatedWindowLabel}".\n\n` +
          `Expected: The sub-window background should be ${label}.\n` +
          `Alpha=${a} (${a === 255 ? 'fully opaque' : a === 0 ? 'fully transparent (invisible)' : 'semi-transparent'}).\n\n` +
          `If visual matches → PASS.\nIf no change → FAIL.`;
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
      if (!lastCreatedWindowLabel) { manualResult = 'No sub-window. Click Create Borderless/Decorated first.'; onMessage(manualResult); return; }
      const win = await WebviewWindow.getByLabel(lastCreatedWindowLabel);
      if (!win) throw new Error(`sub-window "${lastCreatedWindowLabel}" not found`);
      const orig = await win.outerPosition();
      const tx = orig.x < 200 ? 400 : 100, ty = orig.y < 200 ? 400 : 100;
      await win.setPosition(new PhysicalPosition(tx, ty));
      await delay(600);
      const after = await win.outerPosition();
      ohosWinState = `outerPosition (${orig.x},${orig.y}) → (${after.x},${after.y}) target (${tx},${ty}) [on ${lastCreatedWindowLabel}]`;
      manualResult = `setOuterPosition(${tx},${ty}) on sub-window "${lastCreatedWindowLabel}"。\n\nExpected: 子窗口左上角移动到 (${tx},${ty})。\n实际: (${after.x},${after.y})。\n若位置变化 → PASS。`;
      onMessage(manualResult);
    });
  }

  async function manualSetInnerSize() {
    await wrapManual('setInnerSize', async () => {
      if (!lastCreatedWindowLabel) { manualResult = 'No sub-window. Click Create Borderless/Decorated first.'; onMessage(manualResult); return; }
      const win = await WebviewWindow.getByLabel(lastCreatedWindowLabel);
      if (!win) throw new Error(`sub-window "${lastCreatedWindowLabel}" not found`);
      const orig = await win.innerSize();
      const tw = Math.max(400, Math.floor(orig.width / 2));
      const th = Math.max(300, Math.floor(orig.height / 2));
      await win.setSize(new PhysicalSize(tw, th));
      await delay(700);
      const after = await win.innerSize();
      ohosWinState = `innerSize ${orig.width}×${orig.height} → ${after.width}×${after.height} target ${tw}×${th} [on ${lastCreatedWindowLabel}]`;
      manualResult = `setInnerSize(${tw}×${th}) on sub-window "${lastCreatedWindowLabel}"。\n\nExpected: 子窗口内容区变为 ${tw}×${th}。\n实际: ${after.width}×${after.height}。\n若尺寸变化 → PASS。`;
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

  // 主窗口 Hide/Show — hide=hideAbility,show=startAbility(instanceKey='main' 复用)
  async function manualShowHide() {
    await wrapManual('showHide', async () => {
      const win = getCurrentWindow();
      await win.hide();
      ohosWinState = `main hide dispatched; 2s 后 show(startAbility)`;
      manualResult = `hide() on main window (hideAbility → app 后台)。\n2 秒后 show() (startAbility instanceKey='main' → onAcceptWant 复用实例)。\n若主窗口先消失再恢复 → PASS。`;
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
      manualResult = `setAlwaysOnTop(${!before}) dispatched。\n\n已调用 OHOS setWindowTopmost(API 14+,需 WINDOW_TOPMOST 权限)。\nisAlwaysOnTop()=${after}。\n主窗口已置顶(跨应用常驻最前)。\n验证:切到其他 app,主窗口应仍可见(不被遮挡) → PASS。`;
      onMessage(manualResult);
    });
  }

  // 装饰按钮组:作用在最后创建的 Float 子窗口(主窗口 no-op)
  async function manualSetClosable() {
    await wrapManual('setClosable', async () => {
      if (!lastCreatedWindowLabel) { manualResult = 'No sub-window. Click Create Borderless/Transparent+Borderless first.'; onMessage(manualResult); return; }
      const win = await WebviewWindow.getByLabel(lastCreatedWindowLabel);
      if (!win) throw new Error(`sub-window "${lastCreatedWindowLabel}" not found`);
      const before = await win.isClosable();
      await win.setClosable(!before);
      const after = await win.isClosable();
      ohosWinState = `isClosable: ${before} → ${after} (on ${lastCreatedWindowLabel})`;
      manualResult = `setClosable(${!before}) on sub-window "${lastCreatedWindowLabel}"。\n\nExpected(decorations=true 时):关闭按钮 ${after ? '显示' : '隐藏'}。\nclosable 是唯一被 FloatPage 消费的 flag(line 155 控制关闭按钮显隐)。`;
      onMessage(manualResult);
    });
  }

  async function manualSetMaximizable() {
    await wrapManual('setMaximizable', async () => {
      if (!lastCreatedWindowLabel) { manualResult = 'No sub-window. Click Create Borderless/Transparent+Borderless first.'; onMessage(manualResult); return; }
      const win = await WebviewWindow.getByLabel(lastCreatedWindowLabel);
      if (!win) throw new Error(`sub-window "${lastCreatedWindowLabel}" not found`);
      const before = await win.isMaximizable();
      await win.setMaximizable(!before);
      const after = await win.isMaximizable();
      ohosWinState = `isMaximizable: ${before} → ${after} (on ${lastCreatedWindowLabel})`;
      manualResult = `setMaximizable(${!before}) on sub-window "${lastCreatedWindowLabel}"。\n\n⚠️ FloatPage 声明了 @LocalStorageProp('maximizable') 但没消费(无最大化按钮)。\nflag 写入 LocalStorage 但无 UI 效果。`;
      onMessage(manualResult);
    });
  }

  async function manualSetMinimizable() {
    await wrapManual('setMinimizable', async () => {
      if (!lastCreatedWindowLabel) { manualResult = 'No sub-window. Click Create Borderless/Transparent+Borderless first.'; onMessage(manualResult); return; }
      const win = await WebviewWindow.getByLabel(lastCreatedWindowLabel);
      if (!win) throw new Error(`sub-window "${lastCreatedWindowLabel}" not found`);
      const before = await win.isMinimizable();
      await win.setMinimizable(!before);
      const after = await win.isMinimizable();
      ohosWinState = `isMinimizable: ${before} → ${after} (on ${lastCreatedWindowLabel})`;
      manualResult = `setMinimizable(${!before}) on sub-window "${lastCreatedWindowLabel}"。\n\n⚠️ FloatPage 声明了 @LocalStorageProp('minimizable') 但没消费(无最小化按钮)。\nflag 写入 LocalStorage 但无 UI 效果。`;
      onMessage(manualResult);
    });
  }

  async function manualSetResizable() {
    await wrapManual('setResizable', async () => {
      if (!lastCreatedWindowLabel) { manualResult = 'No sub-window. Click Create Borderless/Transparent+Borderless first.'; onMessage(manualResult); return; }
      const win = await WebviewWindow.getByLabel(lastCreatedWindowLabel);
      if (!win) throw new Error(`sub-window "${lastCreatedWindowLabel}" not found`);
      const before = await win.isResizable();
      await win.setResizable(!before);
      const after = await win.isResizable();
      ohosWinState = `isResizable: ${before} → ${after} (on ${lastCreatedWindowLabel})`;
      manualResult = `setResizable(${!before}) on sub-window "${lastCreatedWindowLabel}"。\n\n⚠️ FloatPage 声明了 @LocalStorageProp('resizable') 但没消费(无 resize 手柄)。\nflag 写入 LocalStorage 但无 UI 效果。要真正禁用 resize 需走 enableDrag(false) API。`;
      onMessage(manualResult);
    });
  }

  async function manualSetFocusable() {
    await wrapManual('setFocusable', async () => {
      if (!lastCreatedWindowLabel) {
        manualResult = `No sub-window target. Click "Create Borderless Window" or "Create Transparent+Borderless" first.`;
        onMessage(manualResult);
        return;
      }
      const win = await WebviewWindow.getByLabel(lastCreatedWindowLabel);
      if (!win) throw new Error(`sub-window "${lastCreatedWindowLabel}" not found`);
      // Self-verifying (2026-08-27): setWindowFocusable has NO visual effect — the
      // observable criterion is whether the sub-window steals keyboard focus from
      // the main window when clicked. is_focused reads the app-level HAS_FOCUS flag
      // (main-window focus); normal sub-window click → false, focusable=false click
      // → stays true (device-verified A/B). Programmatic setFocus() can't be used
      // (raiseToAppTop only raises z-order, never transfers focus).
      const main = getCurrentWindow();
      const baseline = await main.isFocused();
      if (!baseline) {
        manualResult = `主窗口当前未持有焦点(创建子窗口会抢走焦点)。\n请先点击主窗口任意空白区域,再点本按钮。`;
        onMessage(manualResult);
        return;
      }
      await win.setFocusable(false);
      ohosWinState = `setFocusable(false) on "${lastCreatedWindowLabel}" → 3s 后恢复`;
      manualResult = `setFocusable(false) dispatched on sub-window "${lastCreatedWindowLabel}"。\n\n👉 请在 3 秒内点击子窗口一次,等待自动判定...`;
      onMessage(manualResult);
      // Poll main-window focus during the 3s window; restore afterwards and judge.
      let focusStolen = false;
      const started = Date.now();
      const poll = setInterval(async () => {
        if (!(await main.isFocused())) focusStolen = true;
      }, 250);
      setTimeout(async () => {
        clearInterval(poll);
        try { await win.setFocusable(true); } catch { /* best-effort restore */ }
        if (focusStolen) {
          manualResult = `❌ FAIL: 3 秒内主窗口焦点丢失 — 子窗口仍抢走了焦点(setWindowFocusable 未生效)。`;
        } else {
          manualResult = `✅ PASS: 3 秒内主窗口焦点保持 — 子窗口拒绝了焦点点击(setWindowFocusable 生效,无视觉变化属正常语义)。\n（前提:期间确实点击过子窗口;点其他窗口/桌面也会导致 FAIL）`;
        }
        ohosWinState = `setFocusable(true) restored on "${lastCreatedWindowLabel}"`;
        onMessage(manualResult);
      }, 3000);
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

  // ─── 补充手动测试:自动测试覆盖但无按钮的窗口能力 ───

  // 1. 窗口 ID — getCurrentWindow().label
  async function manualWindowId() {
    await wrapManual('windowId', async () => {
      const win = getCurrentWindow();
      const label = win.label;
      const ok = typeof label === 'string' && label.length > 0;
      manualResult = `getCurrentWindow() → label="${label}"\n${ok ? '✓ 非空字符串 → PASS' : '✗ 空 → FAIL'}`;
      onMessage(manualResult);
    });
  }

  // 2. 窗口销毁 — 建临时子窗口 → onCloseRequested → 关闭 → 看是否收到
  async function manualCloseRequested() {
    await wrapManual('closeRequested', async () => {
      const id = 'close-test-' + Date.now();
      await invoke('create_transparent_window', { windowId: id });
      const win = await WebviewWindow.getByLabel(id);
      if (!win) throw new Error('close-test sub-window not created');
      let got = false;
      const un = await win.onCloseRequested(() => { got = true; });
      await new Promise((r) => setTimeout(r, 300));
      try { await win.close(); } catch {}
      await new Promise((r) => setTimeout(r, 600));
      try { un?.(); } catch {}
      manualResult = `onCloseRequested ${got ? 'fired ✓ → PASS' : 'NOT fired → FAIL'}\n(临时子窗口 "${id}" 已关闭)`;
      onMessage(manualResult);
    });
  }

  // 3. 多窗口 — window.open (Allow 模式)
  async function manualOnNewWindow() {
    await wrapManual('on_new_window:Allow', async () => {
      await invoke('set_deny_new_window', { deny: false });
      await invoke('set_create_new_window', { create: true });
      window.open('https://example.com/manual-newwin', '_blank');
      await new Promise((r) => setTimeout(r, 1500));
      manualResult = `window.open dispatched (Allow mode).\n若弹出子窗口 → PASS;若无 → FAIL\n(on_new_window: Allow 触发新建 OS 窗口)`;
      onMessage(manualResult);
    });
  }

  // 4. Cursor grab — OH_WindowManager_LockCursor/UnlockCursor (NDK C API 22+,
  //    ohos.permission.LOCK_WINDOW_CURSOR normal permission, declared in entry_desktop module.json5).
  //    Confined mode (isCursorFollowMovement=true): cursor stays inside the window but keeps
  //    moving; auto-released on focus loss.
  async function manualCursorGrab() {
    await wrapManual('setCursorGrab', async () => {
      try {
        await getCurrentWindow().setCursorGrab(true);
        manualResult = `setCursorGrab(true) → no throw ✓ 已锁定(5 秒后自动解锁)\n\nExpected: 移动鼠标 — 光标被限制在窗口内无法移出(窗口内仍可移动)。\n锁定期间点击其他窗口可验证失焦自动解锁(光标立即恢复自由)。`;
        onMessage(manualResult);
        await new Promise((r) => setTimeout(r, 5000));
        try {
          await getCurrentWindow().setCursorGrab(false);
          manualResult = `setCursorGrab(false) → 已解锁\n\nExpected: 鼠标光标恢复自由移动,可移出窗口。`;
        } catch (e) {
          // unlock-after-auto-release (1300002) is idempotent on the Rust side and
          // should not surface here; if another window was clicked during the lock,
          // the cursor is already free via focus-loss auto-unlock.
          manualResult = `setCursorGrab(false) threw: ${e}\n光标应已恢复自由(失焦自动解锁兜底)。若仍被锁定请上报。`;
        }
      } catch (e) {
        manualResult = `setCursorGrab threw: ${e}\n预期:锁定/解锁成功不抛错(权限已声明)。抛错常见原因:权限缺失(hilog 201)/ API < 22 设备(NotSupported)`;
      }
      onMessage(manualResult);
    });
  }

  // 5. 窗口事件 — toggle 监听 Resized/Moved/FocusChanged
  async function toggleWinEventWatch() {
    if (winEventWatchActive) {
      winEventUnlistens?.forEach((un) => { try { un?.(); } catch {} });
      winEventUnlistens = null;
      winEventWatchActive = false;
      manualResult = `Stopped watching. Total events: ${winEventCount}\nTypes: ${winEventTypes.join(', ') || '(none)'}\n${winEventCount > 0 ? '✓ PASS' : '✗ FAIL (no events)'}`;
      onMessage(manualResult);
    } else {
      winEventCount = 0;
      winEventTypes = [];
      const win = getCurrentWindow();
      const unR = await win.onResized(() => { winEventCount++; winEventTypes = [...winEventTypes, 'Resized']; });
      const unM = await win.onMoved(() => { winEventCount++; winEventTypes = [...winEventTypes, 'Moved']; });
      const unF = await win.onFocusChanged(({ payload }) => { winEventCount++; winEventTypes = [...winEventTypes, `Focus=${payload}`]; });
      winEventUnlistens = [unR, unM, unF];
      winEventWatchActive = true;
      manualResult = `Watching Resized/Moved/FocusChanged (n=${winEventCount}).\n切后台再回来触发 FocusChanged(推荐,不触发 sizeChange 风暴)。\n⚠️ 避免拖拽/缩放主窗口 — 会触发 OnSizeChange 风暴导致 appfreeze(OHOS 既有问题)。\n再点 "Stop Watch" 看事件数。`;
      onMessage(manualResult);
    }
  }

  // 6. 窗口状态持久化 — window-state save+restore
  // NOTE: 不调 setSize 改尺寸 — 主窗口尺寸变化会触发 OnSizeChange 事件风暴导致
  // appfreeze(THREAD_BLOCK_6S,OHOS 既有适配问题)。只验证 filename + save + restore
  // 不报错(插件层功能),尺寸 round-trip 由自动测试(子进程/CI)覆盖。
  async function manualWindowState() {
    await wrapManual('window-state', async () => {
      const fname = await windowStateFilename();
      const win = getCurrentWindow();
      const size = await win.innerSize();
      // save 当前尺寸(不改尺寸)→ restore → 验证不报错
      await saveWindowState(StateFlags.SIZE);
      await restoreStateCurrent(StateFlags.SIZE);
      await new Promise((r) => setTimeout(r, 200));
      const ok = typeof fname === 'string' && fname.length > 0;
      manualResult = `filename="${fname}"\n当前尺寸: ${size.width}×${size.height}\nsaveWindowState+restoreStateCurrent OK(未改尺寸,避免 sizeChange 风暴)\n${ok ? '✓ → PASS' : '✗ filename 空 → FAIL'}`;
      onMessage(manualResult);
    });
  }

  // 7. set_bounds — webview 层 set position+size round-trip
  async function manualSetBounds() {
    await wrapManual('set_bounds', async () => {
      const report = await invoke('set_bounds_test');
      const ok = report?.set_ok === true;
      manualResult = `set_bounds_test → set_ok=${report?.set_ok}\n${ok ? '✓ PASS' : '✗ FAIL'}\n(webview 层 set position+size round-trip)`;
      onMessage(manualResult);
    });
  }

  // 8. 窗口标题 — 直接在主窗口设(主窗口标题栏可见,Float 子窗口 setDecorations 无效)
  async function manualSetTitle() {
    await wrapManual('setTitle', async () => {
      const win = getCurrentWindow();
      const titles = ['🪟 Tauri OHOS 测试标题', 'Hello 华为账号', 'Tauri OpenHarmony'];
      const idx = (manualTitleIdx ?? -1) + 1;
      manualTitleIdx = idx % titles.length;
      const title = titles[manualTitleIdx];
      await win.setTitle(title);
      manualResult = `setTitle("${title}") dispatched on main window.\n\nExpected: 主窗口标题栏文字变为 "${title}"。\n(图标不可改;set_title 走 setWindowTitle API15+)\nIf title bar shows new text → PASS.`;
      onMessage(manualResult);
    });
  }
  let manualTitleIdx = $state(0);

  // 9. 窗口大小限制 — 主窗口设最小 1600×1200
  async function manualSetMinSize() {
    await wrapManual('setMinSize', async () => {
      const win = getCurrentWindow();
      // setMinSize → tao set_min_inner_size → setWindowLimits(min, 0, 0, 0)
      // ⚠️ LogicalSize 会乘 scale_factor 转 px;设备 scale≈2.0 → 1600×1200 logical = 3200×2400 px > 屏幕 3120×2080
      // 超屏幕会触发 resize → sizeChange 风暴 → appfreeze。改用 PhysicalSize 直接传 px 避免转换。
      await win.setMinSize(new LogicalSize(1600, 1200));
      manualResult = `setMinSize(LogicalSize 1600×1200) dispatched on main window.\n\n⚠️ scale≈2.0 → 实际 px ≈ 3200×2400 > 屏幕 3120×2080,可能卡死。\n若未卡死:拖拽窗口不能小于 1600×1200 logical → PASS。\n卡死 → force-stop 重启,点 Reset Min Size 清除。`;
      onMessage(manualResult);
    });
  }

  // 取消最小尺寸限制 — setWindowLimits 传 0 = "不改变",不是清除(无 reset 接口)
  // 要恢复自由缩放,设 min=1(让系统下限 760×570 接管)
  async function manualResetMinSize() {
    await wrapManual('resetMinSize', async () => {
      const win = getCurrentWindow();
      // setMinSize(1,1) → tao set_min_inner_size(Some(1,1)) → setWindowLimits(1,1,0,0)
      // min=1 让系统下限接管(760×570),比 1600×1200 小,恢复自由缩放
      await win.setMinSize(new LogicalSize(1, 1));
      manualResult = `Reset: setMinSize(1×1) dispatched — min 设为 1×1 logical。\n系统下限 760×570 接管,窗口可缩到 760×570(比 1600×1200 小)。\n拖拽窗口边缘缩小验证 → 若能缩到 < 1600×1200 → PASS。`;
      onMessage(manualResult);
    });
  }

  // 同时设 min + max — 验证 tao set_min/max_inner_size "四值同下" 修复。
  // 修复前: setMaxSize 会把之前 setMinSize 的 min 清零(max 那次写 min=0);修复后 min 保留。
  async function manualSetMinAndMaxSize() {
    await wrapManual('setMinAndMaxSize', async () => {
      const win = getCurrentWindow();
      // PhysicalSize 直接传 px,避免 LogicalSize × scale(≈2.0) 超屏幕卡死。
      // 屏幕 3120×2080 px;min 1600×1200 < max 2400×1800 < 屏幕,安全。
      await win.setMinSize(new PhysicalSize(1600, 1200));
      // setMinSize → tao set_min_inner_size: 缓存 min, 读 max=0 → setWindowLimits(1600,1200,0,0)
      await win.setMaxSize(new PhysicalSize(2400, 1800));
      // setMaxSize → tao set_max_inner_size: 缓存 max, 读 min
      //   修复前: setWindowLimits(0,0,2400,1800) ← min 丢!
      //   修复后: setWindowLimits(1600,1200,2400,1800) ← min 保留 ✓
      manualResult = `setMinSize(1600×1200 px) + setMaxSize(2400×1800 px) dispatched.\n\n验证(看 hilog tag WindowManager):\n  setWindowLimits ... OK: min=1600×1200 max=0×0      ← setMinSize\n  setWindowLimits ... OK: min=1600×1200 max=2400×1800 ← setMaxSize(min 保留=修复生效)\n修复前第二次会 min=0×0(min 丢)。\n\n拖拽验证:窗口不能缩到 < 1600×1200,不能放到 > 2400×1800。`;
      onMessage(manualResult);
    });
  }

  // 10. 窗口主题 — toggle Dark/Light/System
  let themeState = $state(0); // 0=Light, 1=Dark, 2=System
  async function manualSetTheme() {
    await wrapManual('setTheme', async () => {
      const win = getCurrentWindow();
      const themes = ['light', 'dark', null]; // null = system follow
      const labels = ['Light', 'Dark', 'System (follow)'];
      const next = (themeState + 1) % 3;
      themeState = next;
      const t = themes[next];
      await win.setTheme(t);
      manualResult = `setTheme(${labels[next]}) dispatched.\n\nExpected: 窗口深浅色切换。\n- Light: 浅色背景\n- Dark: 深色背景\n- System: 跟随系统设置\n(底层 setColorMode: LIGHT/DARK/NOT_SET)\nIf visual matches → PASS.`;
      onMessage(manualResult);
    });
  }

  async function manualRequestUserAttention() {
    await wrapManual('requestUserAttention', async () => {
      const win = getCurrentWindow();
      // tauri 内置 window API → tao → openharmony-ability → notificationManager
      // UserAttentionType.Critical=1, Informational=2(OHOS 不区分,统一发通知)
      await win.requestUserAttention(UserAttentionType.Informational);
      manualResult = 'requestUserAttention dispatched.\n\nExpected: 系统通知中心弹出 "Tauri App / 请查看应用窗口" 通知。\n首次点击会弹"是否允许发送通知"授权框,允许后再点一次。\n底层: tao → openharmony-ability → notificationManager.publish (1600004 时 requestEnableNotification)。\nIf notification appears → PASS.';
      onMessage(manualResult);
    });
  }

  async function manualSetImePosition() {
    await wrapManual('setImePosition', async () => {
      // 聚焦 HTML input → updateCursor 上报光标位置 → 回读 ArkTS 侧真实结果
      // 链路: invoke → tao set_ime_position → openharmony-ability →
      //   inputMethod.getController().updateCursor(CursorInfo{left,top,width,height})
      // 前置条件:窗口内有聚焦的编辑框(HTML input 即可,ArkWeb 走系统输入法框架)
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = 'IME test input (auto-focused)';
      inp.style.cssText = 'position:fixed;bottom:60px;left:24px;width:320px;height:36px;font-size:16px;background:#fff;color:#111;border:1px solid #888;padding:0 8px;z-index:9999;';
      document.body.appendChild(inp);
      const startTs = Date.now();
      try {
        inp.focus();
        await delay(600);
        await invoke('set_ime_position_test', { x: 200, y: 400 });
        await delay(800); // updateCursor promise 异步结算,等结果落盘再回读
        const raw = await invoke('get_ime_position_result');
        const r = JSON.parse(raw);
        if (r.code === -1 && String(r.message).includes('not supported')) {
          manualResult = '⏭️ 非 OHOS 平台(stub 返回 not supported)→ SKIP';
        } else if (r.ts < startTs) {
          // 回读到陈旧记录:本次 promise 未在等待窗口内结算(或同步抛出)
          manualResult = `已聚焦输入框并上报光标位置 (200,400)。\n` +
            `结果未就绪:回读到陈旧记录(ts=${r.ts} 早于本次按压,code=${r.code} ${r.message})→ 重试一次;持续出现则 FAIL`;
        } else {
          manualResult = `已聚焦输入框并上报光标位置 (200,400)。\n` +
            `updateCursor 返回: ${r.ok ? 'OK ✅ → PASS' : `失败 code=${r.code} ${r.message} → FAIL`}\n` +
            `上报 CursorInfo: left=${r.x} top=${r.y}(物理像素,tao 透传)`;
        }
      } catch (e) {
        manualResult = `invoke/解析失败: ${e}\n(链路未走完,不能作为能力判定依据)`;
      } finally {
        // 无论成败都移除注入的输入框(否则聚焦 input 残留 DOM 影响后续 IME 行为)
        inp.blur();
        inp.remove();
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
      const { currentMonitor, monitorFromPoint } = await import('@tauri-apps/api/window');
      const m = await currentMonitor();
      if (!m) { manualResult = 'No monitor'; onMessage(manualResult); return; }
      const w = m.size.width, h = m.size.height;
      // OHOS single-display boundary check (spec ohos-monitor-real-values):
      // points inside the half-open rect [0,w) x [0,h) return Some(monitor), else null.
      const cases = [
        ['(100,200) 屏内', 100, 200, true],
        [`(${w - 1},${h - 1}) 右下角内`, w - 1, h - 1, true],
        [`(${w},${h}) 刚好越界`, w, h, false],
        ['(-1,0) 负坐标', -1, 0, false],
        ['(99999,0) 超远', 99999, 0, false]
      ];
      const lines = [`monitor size: ${w}x${h} (DisplayManager 物理像素)`, ''];
      let allPass = true;
      for (const [label, x, y, expectSome] of cases) {
        let got = '', pass = false;
        try {
          const r = await monitorFromPoint(x, y);
          got = r ? 'Some(monitor)' : 'null';
          pass = expectSome ? !!r : !r;
        } catch (e) {
          got = `err: ${e}`;
        }
        if (!pass) allPass = false;
        lines.push(`${pass ? '✅' : '❌'} ${label} → ${got}（预期 ${expectSome ? 'Some' : 'None'}）`);
      }
      lines.push('', allPass ? 'ALL PASS ✅' : 'SOME FAILED ❌');
      manualResult = lines.join('\n');
      onMessage(manualResult);
    });
  }

  // OHOS: display refresh rate probe (Rust-only value; JS Monitor API has no
  // refreshRate on any platform). Rust reads DisplayManager via NDK (same
  // source as tao video_modes); rAF measurement is a webview-side cross-check.
  async function manualOhosDisplayRefreshRate() {
    await wrapManual('display.refresh_rate', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      let probe;
      try {
        probe = await invoke('probe_display_refresh_rate');
      } catch (e) {
        manualResult = `probe_display_refresh_rate error: ${e}`;
        onMessage(manualResult);
        return;
      }
      const frames = await new Promise((resolve) => {
        let count = 0;
        const start = performance.now();
        const tick = () => {
          count++;
          if (performance.now() - start < 1000) requestAnimationFrame(tick);
          else resolve(count);
        };
        requestAnimationFrame(tick);
      });
      manualResult = `${probe}\n` +
        `webview rAF measured: ~${frames} fps (LTPO may throttle when idle)\n` +
        `Note: refresh rate is Rust-only (tao video_modes source), not in JS Monitor API.`;
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
      manualResult = 'Test webview created with use_https_scheme=true.\nInit script logs isSecureContext / crypto.subtle / external+subresource fetch probes to hilog (ARKWEB-CONSOLE).\nJudge: window renders + [https-scheme] lines.';
      onMessage(manualResult);
    });
  }

  async function manualOhosTestDragOverlay() {
    await wrapManual('drag_drop_overlay=true', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('create_ohos_test_webview', {
        windowId: 'test-drag-' + Date.now(),
        label: 'Drag Overlay test',
        dragDropOverlay: true,
      });
      manualResult = 'Test webview created with drag_drop_overlay=true.\n1. Drag a file from 文件管理器 into the window → hilog [DRAG-TEST] Enter/Over/Drop(paths)/Leave.\n2. Click / scroll / select text in the window → pointer must still work (passthrough).';
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

  // Listen for OHOS print-job terminal states (succeed/fail/cancel/block) emitted
  // from Rust (openharmony-ability print-state channel → "ohos-print-state" event).
  onMount(async () => {
    const unlisten = await listen('ohos-print-state', (event) => {
      const { id, state, error } = event.payload;
      const msg = `[PRINT-STATE] webview ${id}: ${state}${error ? ` — ${error}` : ''}`;
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

      // Render snapshot to canvas for visual verification.
      // The backend returns a base64 PNG (not raw RGBA — web_page_snapshot omits
      // the pixel buffer for NAPI efficiency), so decode via Image + drawImage.
      snapshotWidth = result.width;
      snapshotHeight = result.height;
      hasSnapshot = true;

      // Wait for canvas element to be mounted
      await new Promise(r => setTimeout(r, 50));

      if (canvasEl) {
        const ctx = canvasEl.getContext('2d');
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, result.width, result.height);
        img.src = `data:image/png;base64,${result.png_base64}`;
      }

      manualResult = `Snapshot captured: ${result.width}×${result.height}, base64 ${result.png_base64?.length ?? 0} chars\n` +
        `Check: canvas below should match the current WebView content.\n` +
        `If visual matches → PASS.`;
      onMessage(manualResult);
    });
  }

  // ─── on_new_window Manual Tests ───
  async function manualNewWindowAllow() {
    await wrapManual('newWindowAllow', async () => {
      await invoke('set_deny_new_window', { deny: false });
      // Explicitly reset create flag: a prior Create-button press sets it true,
      // and Allow must open the in-page dialog (not a Float OS window).
      await invoke('set_create_new_window', { create: false });
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

  // Notification action button (onAction emit/Channel, manual_tests.md §三十二 ③④).
  // One button covers warm-start (background → tap action) and cold-start
  // (kill app → tap action relaunches it). The listener stays registered so
  // the callback survives backgrounding.
  let notificationActionListener = null;
  let notificationActionCount = 0;
  async function manualNotificationAction() {
    await wrapManual('notificationAction', async () => {
      const { onAction, registerActionTypes, sendNotification, isPermissionGranted } = await import('@tauri-apps/plugin-notification');
      const granted = await isPermissionGranted();
      if (!granted) {
        manualResult = '⚠️ 通知权限未授予。请先点击 "Request Permission" 按钮请求权限。';
        onMessage(manualResult);
        return;
      }
      await registerActionTypes([{
        id: 'manual-action-type',
        actions: [{ id: 'manual-action', title: 'Tap Me' }],
      }]);
      // Re-register: drop the previous listener and reset the counter.
      notificationActionListener?.unregister();
      notificationActionListener = null;
      notificationActionCount = 0;
      notificationActionListener = await onAction((n) => {
        notificationActionCount += 1;
        const payload = JSON.stringify(n);
        onMessage(`[onAction] fired (${notificationActionCount}): ${payload}`);
        const actionIdMatch = n.actionId === 'manual-action';
        manualResult = `✅ onAction 回调触发（第 ${notificationActionCount} 次）：${payload}\n` +
          `断言：id=${n.id}, actionId="${n.actionId}"` +
          `${actionIdMatch ? ' === "manual-action" ✅' : ' ≠ "manual-action" ❌'}`;
      });
      sendNotification({
        id: 9001,
        title: 'Action 手动测试',
        body: '展开通知点击 "Tap Me" 按钮',
        actionTypeId: 'manual-action-type',
      });
      manualResult = '✅ 已发送带 actionTypeId 的通知（id=9001）。验证步骤：\n' +
        '  热启动：切应用到后台 → 通知中心展开本通知 → 点 "Tap Me" → 应用回前台且回调触发（actionId=manual-action）\n' +
        '  冷启动：任务管理器结束 com.tauri.api → 点通知 "Tap Me" → 应用被拉起（冷启动 emit 早于 webview 注册监听，回调预期不触发，以应用拉起+hilog 派发为准）';
      onMessage('Action notification sent (id=9001, actionTypeId=manual-action-type)');
    });
  }

  // Notification received callback (onNotificationReceived, manual_tests.md §三十).
  // Registers a listener, sends a notification, waits up to 15s for the callback.
  // OHOS PLATFORM LIMITATION (verified in source, NOT a timing issue): there is no
  // three-party-accessible subscription API for "notification received" events —
  // Plugin.ets:633 "no corresponding OHOS subscription API; registration succeeds
  // but no events will be delivered". notificationManager.subscribe is @systemapi
  // (needs NOTIFICATION_CONTROLLER, system_basic, three-party apps not eligible),
  // so the implementation never subscribes and there is no event source driving
  // the listener channel. fired=false is the EXPECTED terminal state, not a
  // harness failure. Listener stays registered so the path can be re-tested if
  // the platform ever exposes it.
  let notificationReceivedListener = null;
  async function manualNotificationReceived() {
    await wrapManual('notificationReceived', async () => {
      const { onNotificationReceived, sendNotification, isPermissionGranted } = await import('@tauri-apps/plugin-notification');
      const granted = await isPermissionGranted();
      if (!granted) {
        manualResult = '⚠️ 通知权限未授予。请先点击 "Request Permission" 按钮请求权限。';
        onMessage(manualResult);
        return;
      }
      notificationReceivedListener?.unregister();
      notificationReceivedListener = null;
      let fired = false;
      notificationReceivedListener = await onNotificationReceived((n) => {
        fired = true;
        const payload = JSON.stringify(n);
        onMessage(`[onNotificationReceived] fired: ${payload}`);
        manualResult = `✅ onNotificationReceived 回调触发：${payload}`;
      });
      sendNotification({
        id: 9002,
        title: 'onNotificationReceived 手动测试',
        body: '回调应在通知投递后 15s 内触发',
      });
      for (let i = 0; i < 15 && !fired; i++) {
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!fired) {
        manualResult = '⏳ 15s 内未触发 onNotificationReceived 回调（OHOS 平台限制：无三方可用的通知到达订阅 API，回调预期不投递——记录形态。见 Plugin.ets:633 & manual_tests.md §三十）';
      }
      onMessage(`onNotificationReceived manual: fired=${fired}`);
    });
  }

  // ─── Accessibility Manual Tests ───
  async function manualFontScale() {
    await wrapManual('fontScale', async () => {
      const { getFontScale } = await import('@tauri-apps/plugin-accessibility');
      const scale = await getFontScale();
      manualResult = `getFontScale() → ${scale}\n\n` +
        '验证步骤：\n' +
        '  1. 记录当前值（默认 1.0）\n' +
        '  2. 系统设置 → 显示和亮度 → 字体大小与显示大小，调大字号\n' +
        '  3. 返回应用重新点击本按钮\n' +
        '  4. 断言：第二次返回值 > 第一次（fontSizeScale 跟随系统设置变化）';
      onMessage(`fontScale = ${scale}`);
    });
  }

  async function manualScreenReaderQueries() {
    await wrapManual('screenReaderQueries', async () => {
      const { isScreenReaderEnabled, isTouchExploreEnabled } = await import('@tauri-apps/plugin-accessibility');
      const sr = await isScreenReaderEnabled();
      const te = await isTouchExploreEnabled();
      manualResult = `isScreenReaderEnabled() → ${sr}\nisTouchExploreEnabled() → ${te}\n\n` +
        '验证步骤：\n' +
        '  1. 设置 → 辅助功能（无障碍），记录屏幕阅读器开关状态\n' +
        '  2. 对照上方查询值与系统开关是否一致\n' +
        '  3. 切换系统开关后重新点击本按钮，断言查询值跟随变化\n' +
        '（注：查询零权限拒绝——真机实测 ACCESSIBILITY 只读不设防）';
      onMessage(`screenReader=${sr}, touchExplore=${te}`);
    });
  }

  async function manualAccessibilityStateChange() {
    await wrapManual('accessibilityStateChange', async () => {
      const { onAccessibilityStateChange } = await import('@tauri-apps/plugin-accessibility');
      let events = 0;
      let last = '(none)';
      const unlisten = await onAccessibilityStateChange((enabled) => {
        events += 1;
        last = String(enabled);
      });
      // Collect state-change events for up to 20s while the tester toggles the reader.
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        manualResult = `onAccessibilityStateChange 已注册，等待事件… (${i + 1}s/20s)\n\n` +
          '验证步骤：设置 → 辅助功能，开关屏幕阅读器\n\n' +
          `已收到 ${events} 次状态事件\n最近一次: ${last}`;
      }
      unlisten();
      manualResult = (events > 0
        ? `✅ 状态事件链路验证通过：共 ${events} 次事件，最近一次 enabled=${last}\n` +
          '（bridge subscribe → Observer → Rust emit → JS listen 端到端）'
        : '⚠️ 20s 内未收到状态事件。订阅注册本身已实锤（hilog Observer has subscribed）；\n' +
          '请确认期间确实开关了系统屏幕阅读器');
      onMessage(`accessibility state change: ${events} events, last=${last}`);
    });
  }

  // ─── Geolocation Manual Tests ───
  async function manualGeolocationPermission() {
    await wrapManual('geolocationPermission', async () => {
      const { requestPermissions } = await import('@tauri-apps/plugin-geolocation');
      const { invoke } = await import('@tauri-apps/api/core');
      // 1) App-level permission dialog (LOCATION + APPROXIMATELY_LOCATION).
      const status = await requestPermissions();
      // 2) Jump to system location settings for the master switch
      //    (BusinessError 3301100 gate — app permission alone is not enough).
      let settings = '未跳转';
      try {
        await invoke('plugin:geolocation|open_location_settings');
        settings = '已请求跳转（设置页应已打开）';
      } catch (e) {
        settings = `跳转失败: ${String(e)}`;
      }
      manualResult = `requestPermissions() → ${JSON.stringify(status)}\n` +
        `open_location_settings() → ${settings}\n` +
        '验证步骤：\n' +
        '  1. 如系统弹出权限对话框，选择"允许"（应用级位置权限）\n' +
        '  2. 设置页打开后，开启"定位服务"总开关\n' +
        '  3. 返回本应用，点击 "Watch Position (emit)" 按钮进行功能测试';
      onMessage('geolocation permission + location settings opened');
    });
  }

  async function manualGeolocationWatch() {
    await wrapManual('geolocationWatch', async () => {
      const { watchPosition, clearWatch } = await import('@tauri-apps/plugin-geolocation');
      let count = 0;
      let last = '(none)';
      const channelId = await watchPosition(
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
        (location, error) => {
          if (error) {
            last = `error: ${error}`;
          } else if (location) {
            count += 1;
            last = `lat=${location.coords.latitude}, lng=${location.coords.longitude}, acc=${location.coords.accuracy}`;
          }
        }
      );
      // Collect Channel-emit events for up to 10s, updating the result live.
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        manualResult = `watchPosition() 已注册 (channelId=${channelId})，等待位置事件… (${i + 1}s/10s)\n` +
          `已收到 ${count} 次位置更新\n最近一次: ${last}`;
      }
      await clearWatch(channelId);
      manualResult = '✅ watchPosition/clearWatch 链路完成。\n' +
        `共收到 ${count} 次位置更新（Channel emit 事件）\n最近一次: ${last}\n\n` +
        (count > 0
          ? '✅ emit 端到端链路验证通过：locationChange → Plugin.emit → NAPI → Channel → JS 回调'
          : '⚠️ 未收到位置事件（设备未产生位置 fix）。注册/注销链路已验证；' +
            '事件流验证需设备能产生位置 fix（Wi-Fi/网络定位）');
      onMessage(`geolocation watch: ${count} events, last=${last}`);
    });
  }

  async function manualGeolocationCurrent() {
    await wrapManual('geolocationCurrent', async () => {
      const { getCurrentPosition } = await import('@tauri-apps/plugin-geolocation');
      try {
        const pos = await getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 0 });
        const c = pos.coords;
        manualResult = '✅ getCurrentPosition() 返回：\n' +
          `lat=${c.latitude}, lng=${c.longitude}, acc=${c.accuracy}, alt=${c.altitude}\n` +
          `timestamp=${pos.timestamp}\n` +
          '断言：latitude/longitude 为合理数值（Wi-Fi/网络定位）';
        onMessage(`getCurrentPosition: ${c.latitude},${c.longitude}`);
      } catch (e) {
        manualResult = `❌ getCurrentPosition() reject：${e}\n` +
          'PC 无 GPS 时可能超时 reject——记录形态即可（manual_tests §三十一 geolocation 备注）';
        onMessage(manualResult);
      }
    });
  }

  // ─── Mobile Native Plugins Manual Tests (manual_tests.md §三十一) ───
  // These five plugins have no JS package dependency in examples/api — raw
  // invoke() against the plugin commands, same convention as
  // ohos-mobile-plugins.ts autotests.
  async function manualBarcodeScan() {
    await wrapManual('barcodeScan', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      const perm = await invoke('plugin:barcode-scanner|check_permissions');
      let camera = perm?.camera;
      if (camera !== 'granted') {
        const r = await invoke('plugin:barcode-scanner|request_permissions');
        camera = r?.camera;
      }
      if (camera !== 'granted') {
        manualResult = `⚠️ 相机权限未授予（${camera}），scan 无法拉起相机。`;
        onMessage(manualResult);
        return;
      }
      try {
        const result = await invoke('plugin:barcode-scanner|scan');
        manualResult = '✅ scan() 返回：\n' +
          `content=${result?.content}\nformat=${result?.format}\n` +
          '断言：content 为二维码实际内容，相机扫码 UI 正常拉起与关闭';
        onMessage(`barcode scan: ${result?.content} (${result?.format})`);
      } catch (e) {
        manualResult = `❌ scan() reject：${e}\n（无摄像头设备 reject 且报错清晰也属预期结果）`;
        onMessage(manualResult);
      }
    });
  }

  async function manualBarcodeVibrate() {
    await wrapManual('barcodeVibrate', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('plugin:barcode-scanner|vibrate');
        manualResult = '✅ vibrate() resolve\n断言：设备振动 100ms（@ohos.vibrator.startVibration，同 haptics 路径）';
        onMessage('barcode vibrate: 设备振动');
      } catch (e) {
        manualResult = `❌ vibrate() reject：${e}\n（无马达设备 reject 也属预期结果）`;
        onMessage(manualResult);
      }
    });
  }

  async function manualBiometricAuth() {
    await wrapManual('biometricAuth', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke('plugin:biometric|status');
      const statusStr = JSON.stringify(status);
      if (!status?.isAvailable) {
        manualResult = `ℹ️ biometric status：${statusStr}\n设备无生物识别硬件/未录入指纹（isAvailable=false，PC 预期形态，认证 UI 不会拉起）。`;
        onMessage(manualResult);
        return;
      }
      try {
        await invoke('plugin:biometric|authenticate', { reason: '手动测试认证' });
        manualResult = `✅ authenticate() resolve（认证成功）。\nstatus=${statusStr}`;
        onMessage('biometric authenticate: success');
      } catch (e) {
        manualResult = `❌ authenticate() reject（取消/失败）：${e}\nstatus=${statusStr}\n断言：errorCode 清晰，系统认证 UI 正常显示过`;
        onMessage(manualResult);
      }
    });
  }

  async function manualNfc() {
    await wrapManual('nfc', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      const r = await invoke('plugin:nfc|is_available');
      let scanResult = '';
      try {
        await invoke('plugin:nfc|scan');
        scanResult = 'scan resolve（意外：当前设计应 reject）';
      } catch (e) {
        scanResult = `scan reject（预期）：${e}`;
      }
      manualResult = `is_available → ${JSON.stringify(r)}\n${scanResult}\n` +
        '断言：is_available 返回布尔；scan 报错信息含能力说明（未实现，设计决策）';
      onMessage(`nfc isAvailable=${JSON.stringify(r)}`);
    });
  }

  async function manualHaptics() {
    await wrapManual('haptics', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      const attempts = [
        ['vibrate(200)', () => invoke('plugin:haptics|vibrate', { duration: 200 })],
        ['impactFeedback(Medium)', () => invoke('plugin:haptics|impact_feedback', { style: 'Medium' })],
        ['notificationFeedback(Success)', () => invoke('plugin:haptics|notification_feedback', { type: 'Success' })],
        ['selectionFeedback()', () => invoke('plugin:haptics|selection_feedback')],
      ];
      const results = [];
      for (const [name, fn] of attempts) {
        try { await fn(); results.push(`${name}: resolve ✅`); } catch (e) { results.push(`${name}: reject ${e}`); }
      }
      manualResult = results.join('\n') +
        '\n断言：无马达设备各命令 BusinessError 801 → skip（路由链已验证）；有马达设备产生对应振动';
      onMessage(results.join(' | '));
    });
  }

  async function manualHuaweiAccount() {
    await wrapManual('huaweiAccount', async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      let loginResult;
      try {
        const r = await invoke('plugin:huawei-account|login');
        loginResult = '✅ login() resolve: ' + JSON.stringify(r);
      } catch (e) {
        loginResult = `❌ login() reject：${e}\n（需 AppGallery Connect 配置 + 设备已登录华为账号；缺配置时记录报错形态）`;
      }
      let silentResult;
      try {
        silentResult = 'silent_login resolve: ' + JSON.stringify(await invoke('plugin:huawei-account|silent_login'));
      } catch (e) {
        silentResult = `silent_login reject：${e}`;
      }
      try { await invoke('plugin:huawei-account|logout'); } catch (e) { /* ignore */ }
      manualResult = `${loginResult}\n${silentResult}\n(logout 已调用)`;
      onMessage(manualResult);
      onMessage('huawei-account flow attempted');
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
          // Command not registered (shouldn't happen — sentry_test_panic has no cfg gate)
          manualResult += '\n\n⚠️ sentry_test_panic command not found.';
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
      try {
        await revealItemInDir(filePath);
        manualResult = `revealItemInDir(${filePath}) → FM opened (UNEXPECTED for a sandbox path).\nFile left at: ${filePath}`;
      } catch (e) {
        manualResult = `revealItemInDir(${filePath}) → documented error (expected):\n${String(e)}\n→ PASS if the error mentions "app-sandbox paths" / platform limitation.\nFile left at: ${filePath}`;
      }
      onMessage(manualResult);
    });
  }

  async function manualOpenerRevealPublic() {
    await wrapManual('opener.revealItemInDir (public dir)', async () => {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      const target = revealPublicPath.trim();
      if (!target) {
        manualResult = 'Enter a real filesystem path first (default points under Docs).';
        onMessage(manualResult);
        return;
      }
      // The path must EXIST on device (reveal_item_in_dir canonicalizes it).
      // Default is the Docs/IDEProjects directory: its parent (Docs) is revealed
      // → FM opens "我的电脑 > 文档". A file path under Docs works the same way
      // (its parent dir is revealed). OHOS cannot highlight a specific file —
      // only the parent directory is opened (platform limitation).
      try {
        await revealItemInDir(target);
        manualResult = `revealItemInDir(${target}) called.\nCheck: FM opens the PARENT directory of the entered path (OHOS cannot highlight a specific file).\nNo error → PASS.`;
      } catch (e) {
        manualResult = `revealItemInDir(${target}) FAILED:\n${String(e)}`;
      }
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
      <button class="btn" onclick={manualOverlayIgnoreCursor}>Overlay Ignore Cursor (穿透, §二十八)</button>
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
        <button class="btn" onclick={manualCreateDecoratedWindow}>Create Decorated Window (title bar)</button>
      </div>
      <h5 class="my-1 mt-2 text-xs text-gray-500">Window Background Color (Phase 3) — first create a sub-window above, then click a BG button</h5>
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
      <h5 class="my-1 text-xs text-gray-500">OHOS Window Ops — 自动测试补充(无按钮能力)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualWindowId}>Window ID (getCurrentWindow)</button>
        <button class="btn" onclick={manualCloseRequested}>CloseRequested (close sub-window)</button>
        <button class="btn" onclick={manualOnNewWindow}>on_new_window: Allow (window.open)</button>
        <button class="btn" onclick={manualCursorGrab}>setCursorGrab(true) 5s (Lock to window)</button>
        <button class="btn" onclick={toggleWinEventWatch}>
          {winEventWatchActive ? 'Stop Watch Window Events' : 'Watch Window Events'}
        </button>
        <button class="btn" onclick={manualWindowState}>window-state save+restore</button>
        <button class="btn" onclick={manualSetBounds}>set_bounds round-trip (webview)</button>
        <button class="btn" onclick={manualSetTitle}>Set Title (main window)</button>
        <button class="btn" onclick={manualSetMinSize}>Set Min Size 1600×1200 (main window)</button>
        <button class="btn" onclick={manualSetMinAndMaxSize}>Set Min+Max (1600×1200 / 2400×1800 px)</button>
        <button class="btn" onclick={manualResetMinSize}>Reset Min Size (null)</button>
        <button class="btn" onclick={manualSetTheme}>Set Theme (toggle Light/Dark/System)</button>
        <button class="btn" onclick={manualRequestUserAttention}>Request User Attention (notification)</button>
        <button class="btn" onclick={manualSetImePosition}>Set IME Position (200,400)</button>
      </div>
      <h5 class="my-1 mt-2 text-xs text-gray-500">IME 测试输入框 — 点击聚焦(弹软键盘),保持焦点后点 Set IME Position</h5>
      <input
        type="text"
        placeholder="点击此处聚焦输入框,然后点 Set IME Position..."
        class="w-full p-2 border border-gray-300 rounded text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
      />
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
        <button class="btn" onclick={manualOhosMonitorFromPoint}>monitorFromPoint (边界测试)</button>
        <button class="btn" onclick={manualOhosDisplayRefreshRate}>Display Refresh Rate</button>
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
        <button class="btn" onclick={manualOhosTestDragOverlay}>Drag Overlay (§二十六)</button>
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
        <button class="btn" onclick={manualNotificationAction}>Send With Action Button (onAction)</button>
        <button class="btn" onclick={manualNotificationReceived}>Send & Listen (onNotificationReceived)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Accessibility Manual Tests (fontScale/屏幕阅读器)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualFontScale}>Font Scale 查询</button>
        <button class="btn" onclick={manualScreenReaderQueries}>Screen Reader 查询对照</button>
        <button class="btn" onclick={manualAccessibilityStateChange}>State Change Watch (20s)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Geolocation Manual Tests (emit/Channel 验证)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualGeolocationPermission}>请求权限 + 打开定位设置</button>
        <button class="btn" onclick={manualGeolocationCurrent}>Get Current Position</button>
        <button class="btn" onclick={manualGeolocationWatch}>Watch Position (emit)</button>
      </div>
    </div>
    <div class="mt-2 pt-2 border-t-1 border-solid border-code">
      <h5 class="my-1 text-xs text-gray-500">Mobile Native Plugins Manual Tests (barcode/biometric/nfc/haptics/huawei-account)</h5>
      <div class="flex gap-2 flex-wrap">
        <button class="btn" onclick={manualBarcodeScan}>Barcode Scan (camera)</button>
        <button class="btn" onclick={manualBarcodeVibrate}>Barcode Vibrate (扫码振动反馈)</button>
        <button class="btn" onclick={manualBiometricAuth}>Biometric Authenticate</button>
        <button class="btn" onclick={manualNfc}>NFC isAvailable + scan</button>
        <button class="btn" onclick={manualHaptics}>Haptics (vibrate/impact/notification/selection)</button>
        <button class="btn" onclick={manualHuaweiAccount}>Huawei Account (login/silent/logout)</button>
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
        <button class="btn" onclick={manualOpenerReveal}>Opener revealItemInDir (sandbox→err)</button>
        <div class="flex items-center gap-2">
          <input class="btn text-left font-mono text-xs" style="min-width:24rem"
                 bind:value={revealPublicPath}
                 placeholder="/storage/media/100/local/files/Docs/..." />
          <button class="btn" onclick={manualOpenerRevealPublic}>Opener revealItemInDir (public dir→FM)</button>
        </div>
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
