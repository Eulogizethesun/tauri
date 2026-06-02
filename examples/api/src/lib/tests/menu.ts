import type { TestCase } from '../test-runner';
import { invoke } from '@tauri-apps/api/core';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// 1x1 transparent PNG in base64
const TEST_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Skip test silently if simulate_menu_click is not available (non-OHOS). */
async function skipIfNoSimulate(): Promise<boolean> {
  try {
    await invoke('plugin:app-menu|simulate_menu_click', { itemId: '__probe__' });
    return false; // available
  } catch (e: any) {
    if (String(e).includes('only available on OHOS')) return true;
    return false; // available (probe item just not found)
  }
}

export const menuTests: TestCase[] = [
  // ==================== Menu 测试 ====================

  // --- 创建方法 ---
  {
    name: '@tauri-apps/api/menu.Menu.new',
    category: 'auto',
    async fn() {
      const { Menu } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new();
      assert(menu !== undefined, 'Menu.new returned undefined');
      assert(menu.id.length > 0, `menu.id returned empty: ${menu.id}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.with_id',
    category: 'auto',
    async fn() {
      const { Menu } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new({ id: 'custom-menu-id' });
      assert(menu.id === 'custom-menu-id', `menu.id mismatch: "${menu.id}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.with_items',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const item1 = await MenuItem.new({ text: 'Item 1' });
      const item2 = await MenuItem.new({ text: 'Item 2' });
      const menu = await Menu.new({ items: [item1, item2] });
      const items = await menu.items();
      assert(items.length === 2, `items.length should be 2, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.with_id_and_items',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ text: 'Item' });
      const menu = await Menu.new({ id: 'mixed-menu', items: [item] });
      assert(menu.id === 'mixed-menu', `menu.id mismatch: "${menu.id}"`);
      const items = await menu.items();
      assert(items.length === 1, `items.length should be 1, got ${items.length}`);
    },
  },

  // --- 菜单项管�?---
  {
    name: '@tauri-apps/api/menu.Menu.append',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new();
      const item = await MenuItem.new({ text: 'Item' });
      await menu.append(item);
      const items = await menu.items();
      assert(items.length === 1, `items.length should be 1, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.append_items',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new();
      const item1 = await MenuItem.new({ text: 'A' });
      const item2 = await MenuItem.new({ text: 'B' });
      await menu.append([item1, item2]);
      const items = await menu.items();
      assert(items.length === 2, `items.length should be 2, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.prepend',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new();
      const existing = await MenuItem.new({ text: 'Existing' });
      await menu.append(existing);
      const prepended = await MenuItem.new({ text: 'Prepended' });
      await menu.prepend(prepended);
      const items = await menu.items();
      assert(items.length === 2, `items.length should be 2, got ${items.length}`);
      assert(items[0].id === prepended.id, `prepend failed: first id "${items[0].id}" != "${prepended.id}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.prepend_items',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new();
      const existing = await MenuItem.new({ text: 'Existing' });
      await menu.append(existing);
      const a = await MenuItem.new({ text: 'A' });
      const b = await MenuItem.new({ text: 'B' });
      await menu.prepend([a, b]);
      const items = await menu.items();
      assert(items.length === 3, `items.length should be 3, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.insert',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new();
      const first = await MenuItem.new({ text: 'First' });
      const second = await MenuItem.new({ text: 'Second' });
      await menu.append(first);
      await menu.append(second);
      const inserted = await MenuItem.new({ text: 'Inserted' });
      await menu.insert(inserted, 1);
      const items = await menu.items();
      assert(items.length === 3, `items.length should be 3, got ${items.length}`);
      assert(items[1].id === inserted.id, `insert failed: mid id "${items[1].id}" != "${inserted.id}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.insert_items',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new();
      const first = await MenuItem.new({ text: 'First' });
      await menu.append(first);
      const a = await MenuItem.new({ text: 'A' });
      const b = await MenuItem.new({ text: 'B' });
      await menu.insert([a, b], 1);
      const items = await menu.items();
      assert(items.length === 3, `items.length should be 3, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.remove',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new();
      const item = await MenuItem.new({ text: 'ToRemove' });
      await menu.append(item);
      await menu.remove(item);
      const items = await menu.items();
      assert(items.length === 0, `items.length should be 0 after remove, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.removeAt',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new();
      await menu.append(await MenuItem.new({ text: 'A' }));
      await menu.append(await MenuItem.new({ text: 'B' }));
      await menu.removeAt(0);
      const items = await menu.items();
      assert(items.length === 1, `items.length should be 1, got ${items.length}`);
      const text = await items[0].text();
      assert(text === 'B', `removeAt(0) failed: remaining text "${text}" != "B"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.get',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new();
      const item = await MenuItem.new({ id: 'lookup-item', text: 'Lookup' });
      await menu.append(item);
      const found = await menu.get('lookup-item');
      assert(found !== null, 'menu.get() returned null');
      assert(found!.id === 'lookup-item', `get() id mismatch: "${found!.id}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.items',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new();
      await menu.append(await MenuItem.new({ text: 'A' }));
      await menu.append(await MenuItem.new({ text: 'B' }));
      const items = await menu.items();
      assert(Array.isArray(items), 'items() should return array');
      assert(items.length === 2, `items.length should be 2, got ${items.length}`);
    },
  },

  // --- Popup (manual) ---
  {
    name: '@tauri-apps/api/menu.Menu.popup',
    category: 'manual',
    async fn() {
      const { Menu, MenuItem, PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new({
        items: [
          await MenuItem.new({ text: 'Test' }),
          await PredefinedMenuItem.new({ item: 'Separator' }),
        ],
      });
      await menu.popup();
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.popup_at',
    category: 'manual',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new({ items: [await MenuItem.new({ text: 'Test' })] });
      await menu.popup({ x: 100, y: 200 });
    },
  },

  // ==================== MenuItem 测试 ====================

  {
    name: '@tauri-apps/api/menu.MenuItem.new',
    category: 'auto',
    async fn() {
      const { MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ text: 'Test Item' });
      assert(item !== undefined, 'MenuItem.new returned undefined');
      const text = await item.text();
      assert(text === 'Test Item', `text mismatch: ${text}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.MenuItem.with_id',
    category: 'auto',
    async fn() {
      const { MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ id: 'mi-custom', text: 'Test' });
      assert(item.id === 'mi-custom', `id mismatch: "${item.id}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.MenuItem.text',
    category: 'auto',
    async fn() {
      const { MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ text: 'Original' });
      const text = await item.text();
      assert(text === 'Original', `text mismatch: ${text}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.MenuItem.setText',
    category: 'auto',
    async fn() {
      const { MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ text: 'Original' });
      await item.setText('Updated');
      const text = await item.text();
      assert(text === 'Updated', `setText failed: "${text}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.MenuItem.isEnabled',
    category: 'auto',
    async fn() {
      const { MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ text: 'Test', enabled: true });
      const enabled = await item.isEnabled();
      assert(enabled === true, `isEnabled should be true, got ${enabled}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.MenuItem.setEnabled',
    category: 'auto',
    async fn() {
      const { MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ text: 'Test', enabled: true });
      await item.setEnabled(false);
      const enabled = await item.isEnabled();
      assert(enabled === false, `setEnabled(false) failed: ${enabled}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.MenuItem.setAccelerator',
    category: 'auto',
    async fn() {
      const { MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ text: 'Test' });
      await item.setAccelerator('Ctrl+O');
    },
  },

  // ==================== Submenu 测试 ====================

  {
    name: '@tauri-apps/api/menu.Submenu.new',
    category: 'auto',
    async fn() {
      const { Submenu } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Submenu' });
      assert(submenu !== undefined, 'Submenu.new returned undefined');
      assert(submenu.id.length > 0, `submenu.id returned empty: ${submenu.id}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.with_id',
    category: 'auto',
    async fn() {
      const { Submenu } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ id: 'sm-custom', text: 'Submenu' });
      assert(submenu.id === 'sm-custom', `id mismatch: "${submenu.id}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.with_items',
    category: 'auto',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const items = [
        await MenuItem.new({ text: 'A' }),
        await MenuItem.new({ text: 'B' }),
      ];
      const submenu = await Submenu.new({ text: 'Sub', items });
      const result = await submenu.items();
      assert(result.length === 2, `items.length should be 2, got ${result.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.append',
    category: 'auto',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Sub' });
      const item = await MenuItem.new({ text: 'Item' });
      await submenu.append(item);
      const items = await submenu.items();
      assert(items.length === 1, `items.length should be 1, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.append_items',
    category: 'auto',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Sub' });
      await submenu.append([
        await MenuItem.new({ text: 'A' }),
        await MenuItem.new({ text: 'B' }),
      ]);
      const items = await submenu.items();
      assert(items.length === 2, `items.length should be 2, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.prepend',
    category: 'auto',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Sub' });
      const existing = await MenuItem.new({ text: 'Existing' });
      await submenu.append(existing);
      const prepended = await MenuItem.new({ text: 'Prepended' });
      await submenu.prepend(prepended);
      const items = await submenu.items();
      assert(items.length === 2, `items.length should be 2, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.prepend_items',
    category: 'auto',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Sub' });
      await submenu.append(await MenuItem.new({ text: 'Existing' }));
      await submenu.prepend([
        await MenuItem.new({ text: 'A' }),
        await MenuItem.new({ text: 'B' }),
      ]);
      const items = await submenu.items();
      assert(items.length === 3, `items.length should be 3, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.insert',
    category: 'auto',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Sub' });
      await submenu.append(await MenuItem.new({ text: 'First' }));
      await submenu.append(await MenuItem.new({ text: 'Second' }));
      const inserted = await MenuItem.new({ text: 'Inserted' });
      await submenu.insert(inserted, 1);
      const items = await submenu.items();
      assert(items.length === 3, `items.length should be 3, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.insert_items',
    category: 'auto',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Sub' });
      await submenu.append(await MenuItem.new({ text: 'First' }));
      await submenu.insert([
        await MenuItem.new({ text: 'A' }),
        await MenuItem.new({ text: 'B' }),
      ], 1);
      const items = await submenu.items();
      assert(items.length === 3, `items.length should be 3, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.remove',
    category: 'auto',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Sub' });
      const item = await MenuItem.new({ text: 'ToRemove' });
      await submenu.append(item);
      await submenu.remove(item);
      const items = await submenu.items();
      assert(items.length === 0, `items.length should be 0, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.removeAt',
    category: 'auto',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Sub' });
      await submenu.append(await MenuItem.new({ text: 'A' }));
      await submenu.append(await MenuItem.new({ text: 'B' }));
      await submenu.removeAt(0);
      const items = await submenu.items();
      assert(items.length === 1, `items.length should be 1, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.items',
    category: 'auto',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Sub' });
      await submenu.append(await MenuItem.new({ text: 'A' }));
      await submenu.append(await MenuItem.new({ text: 'B' }));
      const items = await submenu.items();
      assert(Array.isArray(items), 'items() should return array');
      assert(items.length === 2, `items.length should be 2, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.get',
    category: 'auto',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Sub' });
      const item = await MenuItem.new({ id: 'lookup-sm', text: 'Lookup' });
      await submenu.append(item);
      const found = await submenu.get('lookup-sm');
      assert(found !== null, 'submenu.get() returned null');
      assert(found!.id === 'lookup-sm', `get() id mismatch: "${found!.id}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.text',
    category: 'auto',
    async fn() {
      const { Submenu } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Original' });
      const text = await submenu.text();
      assert(text === 'Original', `text mismatch: ${text}`);
      await submenu.setText('Updated');
      const updated = await submenu.text();
      assert(updated === 'Updated', `setText failed: "${updated}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.isEnabled',
    category: 'auto',
    async fn() {
      const { Submenu } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Sub', enabled: true });
      const enabled = await submenu.isEnabled();
      assert(enabled === true, `isEnabled should be true, got ${enabled}`);
      await submenu.setEnabled(false);
      const disabled = await submenu.isEnabled();
      assert(disabled === false, `setEnabled(false) failed: ${disabled}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.setIcon',
    category: 'auto',
    async fn() {
      const { Submenu } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Sub' });
      await submenu.setIcon(TEST_ICON);
    },
  },

  // --- Submenu Popup (manual) ---
  {
    name: '@tauri-apps/api/menu.Submenu.popup',
    category: 'manual',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({
        text: 'Sub',
        items: [await MenuItem.new({ text: 'Item' })],
      });
      await submenu.popup();
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.popup_at',
    category: 'manual',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({
        text: 'Sub',
        items: [await MenuItem.new({ text: 'Item' })],
      });
      await submenu.popup({ x: 100, y: 200 });
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.nested',
    category: 'manual',
    async fn() {
      const { Menu, Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const nested = await Submenu.new({
        text: 'Nested',
        items: [await MenuItem.new({ text: 'Deep Item' })],
      });
      const parent = await Submenu.new({
        text: 'Parent',
        items: [await MenuItem.new({ text: 'Item' }), nested],
      });
      const menu = await Menu.new({ items: [parent] });
      await menu.popup();
    },
  },

  // ==================== PredefinedMenuItem 测试 ====================

  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.separator',
    category: 'auto',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const sep = await PredefinedMenuItem.new({ item: 'Separator' });
      assert(sep !== undefined, 'separator returned undefined');
      assert(sep.id.length > 0, `separator id empty: "${sep.id}"`);
      // Note: separator text is intentionally empty across all platforms
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.copy',
    category: 'auto',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'Copy' });
      assert(item !== undefined, 'copy returned undefined');
      const text = await item.text();
      assert(text.length > 0, `copy text empty: "${text}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.cut',
    category: 'auto',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'Cut' });
      assert(item !== undefined, 'cut returned undefined');
      const text = await item.text();
      assert(text.length > 0, `cut text empty: "${text}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.paste',
    category: 'auto',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'Paste' });
      assert(item !== undefined, 'paste returned undefined');
      const text = await item.text();
      assert(text.length > 0, `paste text empty: "${text}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.selectAll',
    category: 'auto',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'SelectAll' });
      assert(item !== undefined, 'selectAll returned undefined');
      const text = await item.text();
      assert(text.length > 0, `selectAll text empty: "${text}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.undo',
    category: 'auto',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'Undo' });
      assert(item !== undefined, 'undo returned undefined');
      const text = await item.text();
      assert(text.length > 0, `undo text empty: "${text}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.redo',
    category: 'auto',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'Redo' });
      assert(item !== undefined, 'redo returned undefined');
      const text = await item.text();
      assert(text.length > 0, `redo text empty: "${text}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.fullscreen',
    category: 'auto',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'Fullscreen' });
      assert(item !== undefined, 'fullscreen returned undefined');
      const text = await item.text();
      assert(text.length > 0, `fullscreen text empty: "${text}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.minimize',
    category: 'manual',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'Minimize' });
      assert(item !== undefined, 'minimize returned undefined');
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.maximize',
    category: 'manual',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'Maximize' });
      assert(item !== undefined, 'maximize returned undefined');
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.closeWindow',
    category: 'manual',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'CloseWindow' });
      assert(item !== undefined, 'closeWindow returned undefined');
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.hide',
    category: 'manual',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'Hide' });
      assert(item !== undefined, 'hide returned undefined');
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.quit',
    category: 'manual',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'Quit' });
      assert(item !== undefined, 'quit returned undefined');
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.text',
    category: 'auto',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'Copy', text: 'Custom Copy' });
      const text = await item.text();
      assert(text === 'Custom Copy', `text mismatch: "${text}"`);
      await item.setText('Updated Copy');
      const updated = await item.text();
      assert(updated === 'Updated Copy', `setText failed: "${updated}"`);
    },
  },

  // ==================== CheckMenuItem 测试 ====================

  {
    name: '@tauri-apps/api/menu.CheckMenuItem.new',
    category: 'auto',
    async fn() {
      const { CheckMenuItem } = await import('@tauri-apps/api/menu');
      const item = await CheckMenuItem.new({ text: 'Check Item', checked: true });
      assert(item !== undefined, 'CheckMenuItem.new returned undefined');
      assert(item.id.length > 0, `id empty: "${item.id}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.CheckMenuItem.isChecked',
    category: 'auto',
    async fn() {
      const { CheckMenuItem } = await import('@tauri-apps/api/menu');
      const item = await CheckMenuItem.new({ text: 'Check', checked: true });
      const checked = await item.isChecked();
      assert(checked === true, `isChecked should be true, got ${checked}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.CheckMenuItem.setChecked',
    category: 'auto',
    async fn() {
      const { CheckMenuItem } = await import('@tauri-apps/api/menu');
      const item = await CheckMenuItem.new({ text: 'Check', checked: true });
      await item.setChecked(false);
      const checked = await item.isChecked();
      assert(checked === false, `setChecked(false) failed: ${checked}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.CheckMenuItem.text',
    category: 'auto',
    async fn() {
      const { CheckMenuItem } = await import('@tauri-apps/api/menu');
      const item = await CheckMenuItem.new({ text: 'Original', checked: false });
      const text = await item.text();
      assert(text === 'Original', `text mismatch: ${text}`);
      await item.setText('Updated');
      const updated = await item.text();
      assert(updated === 'Updated', `setText failed: "${updated}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.CheckMenuItem.isEnabled',
    category: 'auto',
    async fn() {
      const { CheckMenuItem } = await import('@tauri-apps/api/menu');
      const item = await CheckMenuItem.new({ text: 'Check', enabled: true, checked: false });
      const enabled = await item.isEnabled();
      assert(enabled === true, `isEnabled should be true, got ${enabled}`);
      await item.setEnabled(false);
      const disabled = await item.isEnabled();
      assert(disabled === false, `setEnabled(false) failed: ${disabled}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.CheckMenuItem.setAccelerator',
    category: 'auto',
    async fn() {
      const { CheckMenuItem } = await import('@tauri-apps/api/menu');
      const item = await CheckMenuItem.new({ text: 'Check', checked: false });
      await item.setAccelerator('Ctrl+K');
    },
  },

  // ==================== IconMenuItem 测试 ====================

  {
    name: '@tauri-apps/api/menu.IconMenuItem.new',
    category: 'auto',
    async fn() {
      const { IconMenuItem } = await import('@tauri-apps/api/menu');
      const item = await IconMenuItem.new({ text: 'Icon Item', icon: TEST_ICON });
      assert(item !== undefined, 'IconMenuItem.new returned undefined');
      assert(item.id.length > 0, `id empty: "${item.id}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.IconMenuItem.with_id',
    category: 'auto',
    async fn() {
      const { IconMenuItem } = await import('@tauri-apps/api/menu');
      const item = await IconMenuItem.new({ id: 'ic-custom', text: 'Icon', icon: TEST_ICON });
      assert(item.id === 'ic-custom', `id mismatch: "${item.id}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.IconMenuItem.setIcon',
    category: 'auto',
    async fn() {
      const { IconMenuItem } = await import('@tauri-apps/api/menu');
      const item = await IconMenuItem.new({ text: 'Icon', icon: TEST_ICON });
      await item.setIcon(TEST_ICON);
    },
  },
  {
    name: '@tauri-apps/api/menu.IconMenuItem.text',
    category: 'auto',
    async fn() {
      const { IconMenuItem } = await import('@tauri-apps/api/menu');
      const item = await IconMenuItem.new({ text: 'Original', icon: TEST_ICON });
      const text = await item.text();
      assert(text === 'Original', `text mismatch: ${text}`);
      await item.setText('Updated');
      const updated = await item.text();
      assert(updated === 'Updated', `setText failed: "${updated}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.IconMenuItem.isEnabled',
    category: 'auto',
    async fn() {
      const { IconMenuItem } = await import('@tauri-apps/api/menu');
      const item = await IconMenuItem.new({ text: 'Icon', enabled: true, icon: TEST_ICON });
      const enabled = await item.isEnabled();
      assert(enabled === true, `isEnabled should be true, got ${enabled}`);
      await item.setEnabled(false);
      const disabled = await item.isEnabled();
      assert(disabled === false, `setEnabled(false) failed: ${disabled}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.IconMenuItem.setAccelerator',
    category: 'auto',
    async fn() {
      const { IconMenuItem } = await import('@tauri-apps/api/menu');
      const item = await IconMenuItem.new({ text: 'Icon', icon: TEST_ICON });
      await item.setAccelerator('Ctrl+I');
    },
  },

  // ==================== MenuEvent 测试 ====================

  {
    name: '@tauri-apps/api/menu.MenuItem.action',
    category: 'auto',
    async fn() {
      const { MenuItem } = await import('@tauri-apps/api/menu');
      let receivedId: string | undefined;
      const item = await MenuItem.new({
        id: 'action-test',
        text: 'Action Test',
        action: (id) => { receivedId = id; },
      });
      assert(item.id === 'action-test', `item id mismatch: "${item.id}"`);
      // Note: action callback is only triggered when user clicks the menu item in UI
      // This test verifies the callback is registered without errors
    },
  },

  // ==================== MenuItemKind 测试 ====================

  {
    name: '@tauri-apps/api/menu.MenuItem.kind',
    category: 'auto',
    async fn() {
      const { MenuItem } = await import('@tauri-apps/api/menu');
      const item = await MenuItem.new({ id: 'kind-test', text: 'Kind Test' });
      assert(item.kind === 'MenuItem', `kind mismatch: "${item.kind}"`);
      assert(item.id === 'kind-test', `id mismatch: "${item.id}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.kind',
    category: 'auto',
    async fn() {
      const { Submenu } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({ text: 'Kind Sub' });
      assert(submenu.kind === 'Submenu', `kind mismatch: "${submenu.kind}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.kind',
    category: 'auto',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({ item: 'Copy' });
      assert(item.kind === 'Predefined', `kind mismatch: "${item.kind}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.CheckMenuItem.kind',
    category: 'auto',
    async fn() {
      const { CheckMenuItem } = await import('@tauri-apps/api/menu');
      const item = await CheckMenuItem.new({ text: 'Check', checked: false });
      assert(item.kind === 'Check', `kind mismatch: "${item.kind}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.IconMenuItem.kind',
    category: 'auto',
    async fn() {
      const { IconMenuItem } = await import('@tauri-apps/api/menu');
      const item = await IconMenuItem.new({ text: 'Icon', icon: TEST_ICON });
      assert(item.kind === 'Icon', `kind mismatch: "${item.kind}"`);
    },
  },

  // ==================== AboutMetadata 测试 ====================

  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.about',
    category: 'auto',
    async fn() {
      const { PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const item = await PredefinedMenuItem.new({
        item: { About: { name: 'Test App', version: '1.0.0' } },
      });
      assert(item !== undefined, 'about PredefinedMenuItem returned undefined');
      const text = await item.text();
      assert(text.length > 0, `about text empty: "${text}"`);
    },
  },
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.about_exec',
    category: 'manual',
    async fn() {
      // Click about item to verify AlertDialog pops up
    },
  },

  // ==================== 集成测试 ====================

  {
    name: '@tauri-apps/api/menu.Menu.full_workflow',
    category: 'manual',
    async fn() {
      // Full workflow: create menu �?add items �?popup �?click �?action callback
      // Requires manual verification of UI and event handling
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.with_submenu',
    category: 'manual',
    async fn() {
      const { Menu, Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({
        text: 'Sub',
        items: [await MenuItem.new({ text: 'Sub Item' })],
      });
      const menu = await Menu.new({
        items: [await MenuItem.new({ text: 'Item' }), submenu],
      });
      await menu.popup();
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.mixed_items',
    category: 'auto',
    async fn() {
      const { Menu, MenuItem, Submenu, PredefinedMenuItem, CheckMenuItem, IconMenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new({
        items: [
          await MenuItem.new({ text: 'Regular' }),
          await Submenu.new({ text: 'Sub', items: [] }),
          await PredefinedMenuItem.new({ item: 'Separator' }),
          await CheckMenuItem.new({ text: 'Check', checked: false }),
          await IconMenuItem.new({ text: 'Icon', icon: TEST_ICON }),
        ],
      });
      const items = await menu.items();
      assert(items.length === 5, `mixed items.length should be 5, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.popup_at_position',
    category: 'manual',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new({ items: [await MenuItem.new({ text: 'Test' })] });
      await menu.popup({ x: 100, y: 200 });
    },
  },
  // Phase 13: Verify clipboard primitives used by predefined copy/paste
  {
    name: '@tauri-apps/api/menu.predefined_clipboard_primitives',
    category: 'side-effect',
    async fn() {
      // 1. Verify window.getSelection works (used by menu copy/cut)
      const textarea = document.createElement('textarea');
      textarea.value = 'phase13-test-text';
      document.body.appendChild(textarea);
      textarea.select();
      const selection = window.getSelection()?.toString();
      assert(selection === 'phase13-test-text',
        `getSelection should return selected text, got "${selection}"`);

      // 2. Verify execCommand("insertText") works (used by menu paste)
      textarea.value = '';
      textarea.focus();
      const inserted = document.execCommand('insertText', false, 'pasted-content');
      assert(inserted !== false, 'execCommand("insertText") returned false');
      assert(textarea.value === 'pasted-content',
        `textarea should contain inserted text, got "${textarea.value}"`);

      // 3. Verify execCommand("selectAll") works (used by menu selectAll)
      textarea.select();
      const selectedAll = window.getSelection()?.toString();
      assert(selectedAll === 'pasted-content',
        `selectAll should select all textarea content, got "${selectedAll}"`);

      document.body.removeChild(textarea);
    },
  },

  // ==================== NEW AUTO TESTS ====================

  // --- Popup tests (side-effect) ---
  {
    name: '@tauri-apps/api/menu.Menu.popup_auto',
    category: 'side-effect',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const menu = await Menu.new({
        items: [
          await MenuItem.new({ text: 'Auto Item 1' }),
          await MenuItem.new({ text: 'Auto Item 2' }),
          await MenuItem.new({ text: 'Auto Item 3' }),
        ],
      });
      await menu.popup();
      const items = await menu.items();
      assert(items.length === 3, `expected 3 items after popup, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.popup_at_auto',
    category: 'side-effect',
    async fn() {
      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');
      const { LogicalPosition } = await import('@tauri-apps/api/dpi');
      const menu = await Menu.new({
        items: [
          await MenuItem.new({ text: 'Pos Item 1' }),
          await MenuItem.new({ text: 'Pos Item 2' }),
        ],
      });
      await menu.popup(new LogicalPosition(100, 200));
      const items = await menu.items();
      assert(items.length === 2, `expected 2 items after popup_at, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.popup_auto',
    category: 'side-effect',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const submenu = await Submenu.new({
        text: 'Sub Auto',
        items: [
          await MenuItem.new({ text: 'Sub Auto Item 1' }),
          await MenuItem.new({ text: 'Sub Auto Item 2' }),
        ],
      });
      await submenu.popup();
      const items = await submenu.items();
      assert(items.length === 2, `expected 2 submenu items after popup, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.popup_at_auto',
    category: 'side-effect',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const { LogicalPosition } = await import('@tauri-apps/api/dpi');
      const submenu = await Submenu.new({
        text: 'Sub Pos Auto',
        items: [
          await MenuItem.new({ text: 'Sub Pos Item 1' }),
          await MenuItem.new({ text: 'Sub Pos Item 2' }),
        ],
      });
      await submenu.popup(new LogicalPosition(100, 200));
      const items = await submenu.items();
      assert(items.length === 2, `expected 2 submenu items after popup_at, got ${items.length}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Submenu.nested_auto',
    category: 'side-effect',
    async fn() {
      const { Submenu, MenuItem } = await import('@tauri-apps/api/menu');
      const childSub = await Submenu.new({
        text: 'Nested Child',
        items: [
          await MenuItem.new({ text: 'Deep Item 1' }),
          await MenuItem.new({ text: 'Deep Item 2' }),
        ],
      });
      const parentSub = await Submenu.new({
        text: 'Nested Parent',
        items: [
          await MenuItem.new({ text: 'Parent Item' }),
          childSub,
        ],
      });
      await parentSub.popup();
      const parentItems = await parentSub.items();
      assert(parentItems.length === 2, `expected 2 parent items, got ${parentItems.length}`);
      const childItems = await childSub.items();
      assert(childItems.length === 2, `expected 2 child items, got ${childItems.length}`);
    },
  },

  // --- About test (side-effect) ---
  {
    name: '@tauri-apps/api/menu.PredefinedMenuItem.about_exec_auto',
    category: 'side-effect',
    async fn() {
      const { Menu, PredefinedMenuItem } = await import('@tauri-apps/api/menu');
      const aboutItem = await PredefinedMenuItem.new({
        item: { About: { name: 'TestApp', version: '1.0.0' } },
      });
      assert(aboutItem.id.length > 0, `about item id should not be empty, got "${aboutItem.id}"`);
      const text = await aboutItem.text();
      assert(text.length > 0, `about item text should not be empty, got "${text}"`);
      const menu = await Menu.new({ items: [aboutItem] });
      await menu.popup();
      const items = await menu.items();
      assert(items.length === 1, `expected 1 item in menu after popup, got ${items.length}`);
    },
  },

  // --- Integration tests (auto, OHOS-only) ---
  {
    name: '@tauri-apps/api/menu.Menu.full_workflow_auto',
    category: 'auto',
    async fn() {
      if (await skipIfNoSimulate()) return; // skip on non-OHOS

      const { Menu, MenuItem } = await import('@tauri-apps/api/menu');

      let callbackFired = false;
      const item = await MenuItem.new({
        text: 'Workflow Item',
        action: (_id: string) => { callbackFired = true; },
      });
      const menu = await Menu.new({ items: [item] });
      await menu.popup();

      await invoke('clear_tracked_events');
      await invoke('plugin:app-menu|simulate_menu_click', { itemId: item.id });
      await delay(1000);

      assert(callbackFired === true, 'action callback should have been invoked via simulate_menu_click');
      const tracked = await invoke('get_tracked_menu_events') as string[];
      assert(tracked.includes(item.id),
        `get_tracked_menu_events should contain "${item.id}", got: ${JSON.stringify(tracked)}`);
    },
  },
  {
    name: '@tauri-apps/api/menu.Menu.with_submenu_auto',
    category: 'auto',
    async fn() {
      if (await skipIfNoSimulate()) return; // skip on non-OHOS

      const { Menu, Submenu, MenuItem } = await import('@tauri-apps/api/menu');

      let subCallbackFired = false;
      const subItem = await MenuItem.new({
        text: 'Sub Workflow Item',
        action: (_id: string) => { subCallbackFired = true; },
      });
      const submenu = await Submenu.new({
        text: 'Workflow Sub',
        items: [subItem],
      });
      const menu = await Menu.new({ items: [submenu] });
      await menu.popup();

      await invoke('clear_tracked_events');
      await invoke('plugin:app-menu|simulate_menu_click', { itemId: subItem.id });
      await delay(1000);

      assert(subCallbackFired === true, 'submenu item action callback should have been invoked');
      const tracked = await invoke('get_tracked_menu_events') as string[];
      assert(tracked.includes(subItem.id),
        `get_tracked_menu_events should contain "${subItem.id}", got: ${JSON.stringify(tracked)}`);
    },
  },
];
