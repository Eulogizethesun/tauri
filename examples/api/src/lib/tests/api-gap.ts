import type { TestCase } from '../test-runner';
import { invoke } from '@tauri-apps/api/core';
import { emitTo } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Webview } from '@tauri-apps/api/webview';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Menu } from '@tauri-apps/api/menu';
import { Image } from '@tauri-apps/api/image';
import * as path from '@tauri-apps/api/path';
import * as fs from '@tauri-apps/plugin-fs';
import { Store } from '@tauri-apps/plugin-store';
import {
  sendNotification,
  requestPermission,
  removeActive,
} from '@tauri-apps/plugin-notification';
import {
  getCurrentPosition,
  watchPosition,
  clearWatch,
} from '@tauri-apps/plugin-geolocation';

// API 缺口补充批（S10）：点亮接口覆盖率报告中的未执行命令。
// 语义与 driver-generated 盲调用一致——执行即覆盖（FNDA>0），成功/错误分支
// 同点亮；单个失败不连坐。仅 VITE_COVERAGE_TESTS（cov-build.sh 插桩形态）
// 注入，283 例标准 demo 不含本批。
// 危险项不补（process exit/restart、dialog open/save 系统阻塞 UI、
// updater 需服务端、huawei-account 需账号 UI）——见 s9-api-coverage.md §5。

const MINIMAL_PNG = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83,
  222, 0, 0, 0, 12, 73, 68, 65, 84, 120, 156, 99, 248, 207, 192, 0,
  0, 3, 1, 1, 0, 201, 254, 146, 239, 0, 0, 0, 0, 73, 69, 78,
  68, 174, 66, 96, 130,
]);

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/// 永不结算的 Promise（permission 弹窗 / 定位）超时兜底——超时不算失败：
/// handler 在设备侧已执行（FNDA 已点亮），只是响应未回。
const withTimeout = (p: Promise<unknown>, ms: number): Promise<unknown> =>
  Promise.race([p.catch(() => null), delay(ms).then(() => null)]);

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

/// 错误统一转字符串：invoke 拒绝是 Error（取 message），
/// 部分 ACL 拒绝是普通 object（JSON 化），String(e) 只会得到 "[object Object]"。
function errText(e: unknown): string {
  if (e instanceof Error) return `${e.message}`;
  try {
    return JSON.stringify(e) || String(e);
  } catch {
    return String(e);
  }
}

/// 步级日志：fs 等多步用例逐步落 console（经 console-capture 缓冲），
/// 由批次末尾的 flush gapCase 落盘 console-log.txt——盲调用语义下错误
/// 不影响用例状态，但必须可见（S10 两轮后 fs write/lines 仍 FNDA=0 的教训）。
const gapLog = (msg: string) => console.log(`[api-gap] ${msg}`);

function gapCase(name: string, fn: () => Promise<unknown>, timeout = 6000): TestCase {
  return {
    name: 'api-gap: ' + name,
    category: 'driver',
    timeout,
    fn: async () => {
      try {
        await fn();
      } catch (e) {
        // 错误分支同样点亮 handler（盲调用语义），不抛
        gapLog(`${name}:err(${errText(e).slice(0, 300)})`);
      }
    },
  };
}

export const apiGapTests: TestCase[] = [
  // ── core:path 纯函数（6 条，最易） ──
  gapCase('path.basename', async () => {
    const b = await path.basename('/a/b/c.txt');
    assert(b === 'c.txt', `basename should be c.txt, got ${b}`);
  }),
  gapCase('path.dirname', async () => {
    const d = await path.dirname('/a/b/c.txt');
    assert(d === '/a/b', `dirname should be /a/b, got ${d}`);
  }),
  gapCase('path.extname', async () => {
    // Rust Path::extension 语义：无前导点（"txt"），与 Node path.extname（".txt"）不同
    const e = await path.extname('/a/b/c.txt');
    assert(e === 'txt', `extname should be txt, got ${e}`);
  }),
  gapCase('path.isAbsolute', async () => {
    assert((await path.isAbsolute('/a')) === true, 'isAbsolute(/a) should be true');
    assert((await path.isAbsolute('a')) === false, 'isAbsolute(a) should be false');
  }),
  gapCase('path.normalize', async () => {
    const n = await path.normalize('/a/./b/../c');
    assert(n === '/a/c', `normalize should be /a/c, got ${n}`);
  }),
  gapCase('path.resolve', async () => {
    const r = await path.resolve('a', 'b');
    assert((await path.isAbsolute(r)) === true, `resolve result should be absolute, got ${r}`);
  }),

  // ── fs：open + write + read_text_file_lines(_next)（appcache scope 已授权） ──
  // S10R3 定案：R1/R2 的 forbidden path 是本文件自己的 bug——appCacheDir()
  // 返回值无尾斜杠，模板串缺 '/' 分隔符，路径逃出 $APPCACHE/** scope 被
  // 正确拒绝。driver 测试的 `d + '/' + ...` 写法才是对的。
  gapCase('fs.open+write', async () => {
    const p = `${await path.appCacheDir()}/api-gap.bin`;
    const file = await fs.open(p, { write: true, create: true, truncate: true });
    gapLog('fs.open:ok(rid=' + (file as any)?.rid + ')');
    const n = await file.write(MINIMAL_PNG);
    gapLog('fs.write:ok(bytes=' + n + ')');
    await file.close();
    gapLog('fs.close:ok');
  }),
  gapCase('fs.readTextFileLines+next', async () => {
    const p = `${await path.appCacheDir()}/api-gap.txt`;
    await fs.writeTextFile(p, 'line1\nline2\n');
    gapLog('fs.writeTextFile:ok');
    const lines = await fs.readTextFileLines(p);
    const first = await lines.next();
    gapLog('fs.lines.next:ok(value=' + first.value + ')');
    assert(first.value === 'line1', `first line should be line1, got ${first.value}`);
  }),

  // ── core:image from_path（依赖上面的 PNG 文件） ──
  gapCase('image.fromPath', async () => {
    const p = `${await path.appCacheDir()}/api-gap.bin`;
    const img = await Image.fromPath(p);
    const size = await img.size();
    assert(size.width === 1 && size.height === 1, `PNG size should be 1x1, got ${size.width}x${size.height}`);
  }),

  // ── store get_store ──
  gapCase('store.get', async () => {
    // get 不创建：文件不存在返回 null，handler 已执行即覆盖
    const s = await Store.get('test-api-gap-store.json');
    console.log(`[api-gap] store.get → ${s ? 'instance' : 'null'}`);
  }),

  // ── core:event emit_to ──
  gapCase('event.emitTo', async () => {
    await emitTo('main', 'api-gap-event', { v: 1 });
  }),

  // ── http fetch_cancel / fetch_cancel_body（非法 rid 走错误分支） ──
  gapCase('http.fetch_cancel', async () => {
    await invoke('plugin:http|fetch_cancel', { rid: 999999 });
  }),
  gapCase('http.fetch_cancel_body', async () => {
    await invoke('plugin:http|fetch_cancel_body', { rid: 999999 });
  }),

  // ── core:webview 5 条 ──
  gapCase('webview.set_webview_auto_resize', async () => {
    // setter 宏参数名是 value（非 autoResize）
    await invoke('plugin:webview|set_webview_auto_resize', { label: 'main', value: true });
  }),
  gapCase('webview.reparent', async () => {
    // reparent 到自身窗口：合法空操作
    await invoke('plugin:webview|reparent', { label: 'main', window: 'main' });
  }),
  gapCase('webview.create_webview+webview_close', async () => {
    // label test- 前缀：capability windows 只匹配 main/main-*/test-*
    const label = `test-gap-wv-${Date.now()}`;
    const wv = new Webview(getCurrentWindow(), label, { url: 'index.html' });
    await withTimeout(wv.once('tauri://created'), 3000);
    await delay(300);
    await invoke('plugin:webview|webview_close', { label });
  }),
  gapCase('webview.create_webview_window', async () => {
    const label = `test-gap-wvw-${Date.now()}`;
    const wvw = new WebviewWindow(label, { url: 'index.html' });
    await withTimeout(wvw.once('tauri://created'), 4000);
    await delay(300);
    await wvw.close();
  }),

  // ── core:window 2 条 ──
  gapCase('window.internal_toggle_maximize', async () => {
    // toggle 两次恢复原状态
    await invoke('plugin:window|internal_toggle_maximize', { label: 'main' });
    await delay(200);
    await invoke('plugin:window|internal_toggle_maximize', { label: 'main' });
  }),
  gapCase('window.set_simple_fullscreen', async () => {
    // setter 宏参数名是 value（非 fullscreen）
    await invoke('plugin:window|set_simple_fullscreen', { label: 'main', value: true });
    await delay(300);
    await invoke('plugin:window|set_simple_fullscreen', { label: 'main', value: false });
  }),

  // ── notification 3 条（permission 弹窗可能永不结算 → 超时兜底） ──
  gapCase('notification.request_permission', async () => {
    await withTimeout(requestPermission(), 3000);
  }),
  gapCase('notification.notify', async () => {
    await withTimeout(sendNotification({ title: 'api-gap', body: 'coverage' }), 3000);
  }),
  gapCase('notification.remove_active', async () => {
    await removeActive();
  }),

  // ── geolocation 3 条（定位可能挂起 → 超时兜底；handler 已执行即覆盖） ──
  gapCase('geolocation.get_current_position', async () => {
    await withTimeout(getCurrentPosition(), 3000);
  }),
  gapCase('geolocation.watch_position', async () => {
    // JS 签名 watchPosition(options, cb)；PositionOptions 三字段必填
    // （enable_high_accuracy/timeout/maximum_age 无 serde default，缺字段
    // 反序列化失败 → handler 不执行 → FNDA=0，S10R2 教训）
    const id = await withTimeout(
      watchPosition(
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
        () => {},
      ),
      3000,
    ).catch(() => -1);
    const idNum = Number(id);
    if (typeof idNum === 'number' && idNum >= 0) await clearWatch(idNum);
  }),
  gapCase('geolocation.open_location_settings', async () => {
    await invoke('plugin:geolocation|open_location_settings');
    // 等待设置页拉起后立即回前台，避免 app 悬在后台
    await delay(800);
    await invoke('plugin:app|app_show');
  }),

  // ── core:menu 4 条（nsapp 两条无 JS 绑定，走 raw invoke；在 OHOS 报错但 handler 已执行） ──
  gapCase('menu.set_as_app_menu+window_menu+nsapp', async () => {
    const m = await Menu.new();
    await m.setAsAppMenu();
    await m.setAsWindowMenu(getCurrentWindow());
    await invoke('plugin:menu|set_as_help_menu_for_nsapp', { rid: m.rid });
    await invoke('plugin:menu|set_as_windows_menu_for_nsapp', { rid: m.rid });
    // 注：set_as_app_menu 无 clear/None 形态（rid 是必填 u32，null 会反序列化
    // 失败——R3 实证），空 menu 即最终态；本批是套件末尾，无后续用例受影响。
  }),

  // ── core:app 3 条（隐显放最后，避免干扰前置用例） ──
  gapCase('app.hide+show', async () => {
    await invoke('plugin:app|app_hide');
    await delay(400);
    await invoke('plugin:app|app_show');
  }),
  gapCase('app.set_dock_visibility', async () => {
    await invoke('plugin:app|set_dock_visibility', { visible: true });
  }),

  // ── 批次末尾：落盘本批 console 缓冲（含步级日志与盲调用错误） ──
  // console-capture 全局 patch console.log → Rust 侧缓冲，但 cov 套件的
  // 最后一次 flush 在 ops2（早于本批）——不补这条则本批所有错误日志
  // 永远留在内存缓冲里，S10R2 的 fs 三连 FNDA=0 无从诊断。
  gapCase('flush-console-log', async () => {
    const { flushConsoleLog } = await import('../console-capture');
    await flushConsoleLog();
  }),
];
