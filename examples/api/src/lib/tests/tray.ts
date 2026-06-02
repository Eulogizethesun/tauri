import type { TestCase } from '../test-runner';
import { invoke } from '@tauri-apps/api/core';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

const TEST_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Skip test silently if simulate commands are not available (non-OHOS). */
async function skipIfNoSimulate(): Promise<boolean> {
  try {
    await invoke('plugin:app-menu|simulate_menu_click', { itemId: '__probe__' });
    return false;
  } catch (e: any) {
    if (String(e).includes('only available on OHOS')) return true;
    return false;
  }
}

let sharedTray: any = null;

export const trayTests: TestCase[] = [
  // ─── A 组：生命周期测试（涉及 create/destroy，保留 delay） ───
  {
    name: '@tauri-apps/api/tray.TrayIcon.new',
    category: 'auto',
    async fn() {
      await delay(500);
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      sharedTray = await TrayIcon.new({ icon: TEST_ICON });
      assert(sharedTray !== undefined, 'TrayIcon.new returned undefined');
      assert(sharedTray.id.length > 0, `tray.id returned empty: ${sharedTray.id}`);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.new_with_id',
    category: 'auto',
    async fn() {
      await delay(500);
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const tray = await TrayIcon.new({ id: 'my-custom-tray', icon: TEST_ICON });
      assert(tray.id === 'my-custom-tray', `tray.id mismatch: "${tray.id}"`);
      await TrayIcon.removeById('my-custom-tray');
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.getById',
    category: 'auto',
    async fn() {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      assert(sharedTray !== null, 'sharedTray not initialized');
      const found = await TrayIcon.getById(sharedTray.id);
      assert(found !== null, 'getById returned null for existing tray');
      assert(found.id === sharedTray.id, `getById id mismatch: "${found.id}"`);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.getById_not_found',
    category: 'auto',
    async fn() {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const found = await TrayIcon.getById('non-existent-tray-id');
      assert(found === null, `getById should return null, got ${found}`);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.removeById',
    category: 'side-effect',
    async fn() {
      await delay(500);
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const tray = await TrayIcon.new({ id: 'test-remove', icon: TEST_ICON });
      await TrayIcon.removeById('test-remove');
      const found = await TrayIcon.getById('test-remove');
      assert(found === null, 'getById should return null after removeById');
    },
  },
  // ─── B 组：操作测试（复用 sharedTray，无 create/destroy） ───
  {
    name: '@tauri-apps/api/tray.TrayIcon.setIcon',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setIcon(TEST_ICON);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.setIcon_null',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setIcon(null);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.setMenu',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ text: 'Item' });
      const menu = await Menu.new({ items: [item] });
      await sharedTray.setMenu(menu);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.setMenu_null',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setMenu(null);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.setTooltip',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setTooltip('test tooltip');
      await sharedTray.setTooltip(null);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.setTitle',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setTitle('test title');
      await sharedTray.setTitle(null);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.setVisible',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setIcon(TEST_ICON);
      await sharedTray.setVisible(false);
      await sharedTray.setVisible(true);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.setTempDirPath',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setTempDirPath('/tmp');
      await sharedTray.setTempDirPath(null);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.setIconAsTemplate',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setIconAsTemplate(true);
      await sharedTray.setIconAsTemplate(false);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.setShowMenuOnLeftClick',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setShowMenuOnLeftClick(true);
      await sharedTray.setShowMenuOnLeftClick(false);
    },
  },
  // ─── C 组：功能验证测试（有实际断言） ───
  {
    name: '@tauri-apps/api/tray.TrayIcon.getById_after_setVisible_false',
    category: 'auto',
    async fn() {
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setIcon(TEST_ICON);
      await sharedTray.setVisible(false);
      const found = await TrayIcon.getById(sharedTray.id);
      assert(found !== null, 'hidden tray should still exist in registry');
      assert(found.id === sharedTray.id, 'hidden tray id mismatch');
      await sharedTray.setVisible(true);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.new_with_full_options',
    category: 'auto',
    async fn() {
      await delay(500);
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ text: 'Option A' });
      const menu = await Menu.new({ items: [item] });
      const tray = await TrayIcon.new({
        id: 'full-opts-tray',
        icon: TEST_ICON,
        tooltip: 'Full options test',
        title: 'Test Title',
        menu,
      });
      assert(tray.id === 'full-opts-tray', `id mismatch: "${tray.id}"`);
      const found = await TrayIcon.getById('full-opts-tray');
      assert(found !== null, 'full-opts tray not found by getById');
      await TrayIcon.removeById('full-opts-tray');
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.removeById_then_recreate',
    category: 'auto',
    async fn() {
      await delay(500);
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const tray1 = await TrayIcon.new({ id: 'recreate-tray', icon: TEST_ICON });
      assert(tray1.id === 'recreate-tray', 'first create id mismatch');
      await TrayIcon.removeById('recreate-tray');
      const gone = await TrayIcon.getById('recreate-tray');
      assert(gone === null, 'should be null after removeById');
      await delay(500);
      const tray2 = await TrayIcon.new({ id: 'recreate-tray', icon: TEST_ICON });
      assert(tray2.id === 'recreate-tray', 'recreate id mismatch');
      const found = await TrayIcon.getById('recreate-tray');
      assert(found !== null, 'recreated tray not found');
      await TrayIcon.removeById('recreate-tray');
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.setMenu_replace',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const item1 = await MenuItem.new({ text: 'First' });
      const menu1 = await Menu.new({ items: [item1] });
      await sharedTray.setMenu(menu1);
      await sharedTray.setMenu(null);
      const item2 = await MenuItem.new({ text: 'Second' });
      const item3 = await MenuItem.new({ text: 'Third' });
      const menu2 = await Menu.new({ items: [item2, item3] });
      await sharedTray.setMenu(menu2);
      await sharedTray.setMenu(null);
    },
  },
  // ─── QuickOperation 测试（OHOS only，其他平台 no-op） ───
  {
    name: '@tauri-apps/api/tray.TrayIcon.setQuickOperation',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setQuickOperation({
        title: 'Test Panel',
        height: 250,
        abilityName: 'TestTrayAbility',
        moduleName: 'entry',
      });
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.setQuickOperation_null',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setQuickOperation(null);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.setQuickOperation_update',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      await sharedTray.setQuickOperation({
        title: 'Updated Panel',
        height: 350,
        abilityName: 'TestTrayAbility',
      });
      await sharedTray.setQuickOperation(null);
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.event_handler_register',
    category: 'auto',
    async fn() {
      await delay(500);
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      let callbackInvoked = false;
      const tray = await TrayIcon.new({
        id: 'event-tray',
        icon: TEST_ICON,
        action: (_event) => { callbackInvoked = true; },
      });
      assert(tray.id === 'event-tray', 'event tray id mismatch');
      const found = await TrayIcon.getById('event-tray');
      assert(found !== null, 'event tray should exist');
      await TrayIcon.removeById('event-tray');
    },
  },
  {
    name: '@tauri-apps/api/tray.TrayIcon.cleanup',
    category: 'auto',
    async fn() {
      assert(sharedTray !== null, 'sharedTray not initialized');
      sharedTray.close();
      sharedTray = null;
    },
  },

  // ==================== NEW AUTO TESTS ====================

  // --- Full Test Tray (cross-platform) ---
  {
    name: '@tauri-apps/api/tray.TrayIcon.full_test_tray',
    category: 'auto',
    async fn() {
      await delay(500);
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const { Menu, MenuItem, CheckMenuItem, IconMenuItem, PredefinedMenuItem } = await import('@tauri-apps/api/menu');

      const normalItem = await MenuItem.new({ text: 'Normal Item' });
      const checkItem = await CheckMenuItem.new({ text: 'Check Item', checked: false });
      const iconItem = await IconMenuItem.new({ text: 'Icon Item', icon: TEST_ICON });
      const sep1 = await PredefinedMenuItem.new({ item: 'Separator' });
      const copy = await PredefinedMenuItem.new({ item: 'Copy' });
      const cut = await PredefinedMenuItem.new({ item: 'Cut' });
      const paste = await PredefinedMenuItem.new({ item: 'Paste' });
      const undo = await PredefinedMenuItem.new({ item: 'Undo' });
      const redo = await PredefinedMenuItem.new({ item: 'Redo' });
      const sep2 = await PredefinedMenuItem.new({ item: 'Separator' });
      const minimize = await PredefinedMenuItem.new({ item: 'Minimize' });
      const maximize = await PredefinedMenuItem.new({ item: 'Maximize' });
      const fullscreen = await PredefinedMenuItem.new({ item: 'Fullscreen' });
      const closeWindow = await PredefinedMenuItem.new({ item: 'CloseWindow' });
      const sep3 = await PredefinedMenuItem.new({ item: 'Separator' });
      const hide = await PredefinedMenuItem.new({ item: 'Hide' });
      const quit = await PredefinedMenuItem.new({ item: 'Quit' });

      const menu = await Menu.new({
        items: [
          normalItem, checkItem, iconItem, sep1,
          copy, cut, paste, sep2,
          undo, redo, sep3,
          minimize, maximize, fullscreen, closeWindow,
          hide, quit,
        ],
      });

      const tray = await TrayIcon.new({
        id: 'full-test-tray-auto',
        icon: TEST_ICON,
        tooltip: 'Full Test Tray Auto',
        menu,
      });

      assert(tray.id === 'full-test-tray-auto', `tray id mismatch: "${tray.id}"`);
      const found = await TrayIcon.getById('full-test-tray-auto');
      assert(found !== null, 'full test tray not found by getById');

      await TrayIcon.removeById('full-test-tray-auto');
      const gone = await TrayIcon.getById('full-test-tray-auto');
      assert(gone === null, 'full test tray should be removed');
    },
  },

  // --- Tray event chain (OHOS-only) ---
  {
    name: '@tauri-apps/api/tray.TrayIcon.tray_event_chain',
    category: 'auto',
    async fn() {
      if (await skipIfNoSimulate()) return;
      await delay(500);

      const { TrayIcon } = await import('@tauri-apps/api/tray');

      let callbackFired = false;
      const tray = await TrayIcon.new({
        id: 'event-chain-tray',
        icon: TEST_ICON,
        action: (_event: any) => { callbackFired = true; },
      });

      await invoke('simulate_tray_click', { button: 'Left' });
      await delay(1000);

      assert(callbackFired === true, 'tray action callback should have been invoked via simulate_tray_click');

      await TrayIcon.removeById('event-chain-tray');
    },
  },

  // --- Tray menu item click (OHOS-only) ---
  {
    name: '@tauri-apps/api/tray.TrayIcon.tray_menu_item_click',
    category: 'auto',
    async fn() {
      if (await skipIfNoSimulate()) return;
      await delay(500);

      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');

      const menuItem = await MenuItem.new({ text: 'Tray Menu Click Item' });
      const menu = await Menu.new({ items: [menuItem] });

      const tray = await TrayIcon.new({
        id: 'menu-click-tray',
        icon: TEST_ICON,
        menu,
      });

      await invoke('clear_tracked_events');
      await invoke('plugin:app-menu|simulate_menu_click', { itemId: menuItem.id });
      await delay(1000);

      const tracked = await invoke('get_tracked_menu_events') as string[];
      assert(tracked.includes(menuItem.id),
        `get_tracked_menu_events should contain "${menuItem.id}", got: ${JSON.stringify(tracked)}`);

      await TrayIcon.removeById('menu-click-tray');
    },
  },

  // --- Tray multi-item menu (cross-platform) ---
  {
    name: '@tauri-apps/api/tray.TrayIcon.tray_multi_item_menu',
    category: 'auto',
    async fn() {
      await delay(500);
      const { TrayIcon } = await import('@tauri-apps/api/tray');
      const { Menu, MenuItem, CheckMenuItem, IconMenuItem, PredefinedMenuItem } = await import('@tauri-apps/api/menu');

      const menu = await Menu.new({
        items: [
          await MenuItem.new({ text: 'Multi 1' }),
          await MenuItem.new({ text: 'Multi 2' }),
          await CheckMenuItem.new({ text: 'Multi Check', checked: true }),
          await IconMenuItem.new({ text: 'Multi Icon', icon: TEST_ICON }),
          await PredefinedMenuItem.new({ item: 'Separator' }),
          await PredefinedMenuItem.new({ item: 'Copy' }),
        ],
      });

      const tray = await TrayIcon.new({
        id: 'multi-item-tray',
        icon: TEST_ICON,
        tooltip: 'Multi Item Tray',
        menu,
      });

      assert(tray.id === 'multi-item-tray', `tray id mismatch: "${tray.id}"`);
      const found = await TrayIcon.getById('multi-item-tray');
      assert(found !== null, 'multi item tray not found');

      await TrayIcon.removeById('multi-item-tray');
      const gone = await TrayIcon.getById('multi-item-tray');
      assert(gone === null, 'multi item tray should be removed');
    },
  },
];