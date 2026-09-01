import type { TestCase } from '../test-runner';
import { getCurrentWindow, currentMonitor, Window } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

/// 仅校验调用不抛错。用于无 getter 可读回的能力（cursor/focus 等），
/// **不**证明 OHOS 实际生效——效果需手动按钮验证。
async function smoke(fn: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await fn();
  } catch (e) {
    throw new Error(`${label} should not throw (smoke), got: ${e}`);
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/// 创建一个 Float 子窗口用于测试 resize/move。
/// 主 UIAbility 窗口由系统管理，win.resize()/moveWindowTo() 被拒绝（no-op）；
/// Float 子窗口可自由 resize/move（FloatPage resize 手柄亦证此）。
async function createFloatWindow(label: string): Promise<Window> {
  await invoke('create_borderless_window', { windowId: label });
  await delay(600);
  const w = await Window.getByLabel(label);
  assert(w, `Float window "${label}" not found after create`);
  return w;
}

/// 诚实测试：只断言能从 JS 真实观测到的效果。
/// - setInnerSize：主窗口严格读回（resize 触发尺寸回调，读回可靠）。
/// - setOuterPosition：smoke（不抛错）。moveWindowTo 只改位置、不触发我们监听的
///   rect 回调，outer_position() 读回恒为旧值，无法从 JS 验证移动效果（见 #143 注释）。
/// - maximize：主窗口 innerSize 接近显示器。
/// - cursor / focus / focusable / ignoreCursor / 装饰 flag：无 getter 或主窗口 no-op，
///   仅 smoke（不抛错），效果靠手动按钮验证。
export const windowOpsTests: TestCase[] = [
  // ─── Diagnosis: setFullscreen real behavior on the main window (run first so it always executes) ───
  {
    name: 'window.setFullscreen diag (main window)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      const diag: string[] = [];
      const log = (s: string) => { diag.push(s); console.log('[diag-fs]', s); };
      const before = await win.isFullscreen();
      const beforeInner = await win.innerSize();
      const beforeOuter = await win.outerSize();
      log(`before: isFullscreen=${before} inner=${beforeInner.width}×${beforeInner.height} outer=${beforeOuter.width}×${beforeOuter.height}`);
      await win.setFullscreen(true);
      await delay(1000);
      const afterOn = await win.isFullscreen();
      const onInner = await win.innerSize();
      const onOuter = await win.outerSize();
      log(`after on: isFullscreen=${afterOn} inner=${onInner.width}×${onInner.height} outer=${onOuter.width}×${onOuter.height}`);
      await win.setFullscreen(false);
      await delay(800);
      const afterOff = await win.isFullscreen();
      log(`after off: isFullscreen=${afterOff}`);
      // Diagnostic only — no hard assertion. The diag lines above are logged to
      // console for manual inspection (fullscreen on OHOS main window is often a
      // no-op or resolve-but-noop; verify via the printed values, not an assert).
    },
  },
  // ─── 多 UIAbility 实例 (startAbility 路径) —— 放最前，确保跑得到 ───
  // 创建单个 UIAbility 实例，等 3s 让新实例加载 hello.html 并发 IPC。
  // 验证 webview 注册成功 + 主实例存活。IPC label 诊断由 protocol.rs 日志覆盖。
  {
    name: 'window.createUIAbilityWindow (webview registered + new instance IPC)',
    category: 'auto',
    async fn() {
      const label = 'uiability-' + Date.now();
      const result = await invoke<{
        label: string;
        webview_acquired: boolean;
        all_webview_labels: string[];
      }>('create_ui_ability_window', { windowId: label });

      assert(
        result.webview_acquired === true,
        `webview not acquired: label=${result.label}, all_labels=${JSON.stringify(result.all_webview_labels)}`
      );

      // 等 3s 让新实例加载 hello.html，页面 JS 发 IPC（sentry 等）
      // 如果新实例 WebView 的 IPC label 不匹配，会在 hilog 报
      // "failed to acquire webview reference" + protocol.rs 打印 label
      await delay(3000);

      // 主实例仍存活
      await smoke(() => invoke('dummy_command'), 'dummy_command (post-create alive check)');
    },
  },
  // ─── 真实读回验证（Float 子窗口） ───
  {
    name: 'window.setInnerSize actually resizes (main window)',
    category: 'auto',
    async fn() {
      const { PhysicalSize } = await import('@tauri-apps/api/dpi');
      const win = getCurrentWindow();
      const orig = await win.innerSize();
      // 目标取原值一半，确保差距足够大（避免容差漏洞）
      const targetW = Math.max(400, Math.floor(orig.width / 2));
      const targetH = Math.max(300, Math.floor(orig.height / 2));
      await win.setSize(new PhysicalSize(targetW, targetH));
      await delay(800);
      const after = await win.innerSize();
      // 严格断言：读回值必须比 orig 更接近 target。no-op 时 after=orig，不满足。
      const closerW = Math.abs(after.width - targetW) < Math.abs(orig.width - targetW) - 1;
      const closerH = Math.abs(after.height - targetH) < Math.abs(orig.height - targetH) - 1;
      assert(
        closerW && closerH,
        `setSize(${targetW}×${targetH}) 未生效: innerSize ${orig.width}×${orig.height} → ${after.width}×${after.height}`
      );
      // 还原
      await win.setSize(new PhysicalSize(orig.width, orig.height));
      await delay(400);
    },
  },
  {
    // OHOS 上 setOuterPosition 的「实际移动」效果**无法从 JS 可靠读回验证**：
    // outerPosition() 读自 window_rect，由 ArkTS window_rect_change 回调填充
    // (lifecycle.rs:175-179)。resize 会触发尺寸回调 → #142 setInnerSize 读回可靠；
    // 但纯 moveWindowTo 只改位置、不触发我们监听的 rect 回调，故读回恒为旧值
    // (实测 Float 子窗口 orig(515,343)→after(515,343) 完全不变)。主窗口上则由系统
    // 自由窗口 WM 非确定性重定位 (如 (699,651))，读回时 pass 时 fail。两种窗口都
    // 无法满足「after 比 orig 更接近 target」断言。hilog 实测 moveWindowTo 解析成功、
    // 无 1300002 reject(ArkTS 仅 .catch 时 warn，全程零失败日志)——调用本身不抛错。
    // 故降为 smoke：校验 setPosition 不抛错即可，移动效果靠手动按钮验证。
    // (与 #137 fullscreen / #138 minimize / #139 alwaysOnTop 等主窗口不可验证能力同策)
    name: 'window.setOuterPosition smoke (move unverifiable from JS)',
    category: 'auto',
    async fn() {
      const { PhysicalPosition } = await import('@tauri-apps/api/dpi');
      const win = getCurrentWindow();
      const orig = await win.outerPosition();
      const targetX = orig.x < 200 ? 400 : 100;
      const targetY = orig.y < 200 ? 400 : 100;
      await smoke(() => win.setPosition(new PhysicalPosition(targetX, targetY)), 'setPosition(target)');
      await delay(400);
      // 还原(即便读回不反映，仍尝试复位)
      await smoke(() => win.setPosition(new PhysicalPosition(orig.x, orig.y)), 'setPosition(orig)');
      await delay(200);
    },
  },
  {
    name: 'window.maximize fills monitor',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      const mon = await currentMonitor();
      const before = await win.innerSize();
      await win.maximize();
      await delay(600);
      const after = await win.innerSize();
      const afterOuter = await win.outerSize();
      await win.unmaximize();
      await delay(400);
      if (!mon) {
        // 无 monitor 信息，仅校验 maximize 不抛错
        return;
      }
      // 最大化后 innerSize 应接近显示器尺寸（若原本未全屏）。
      // 若原本已全屏（before 已 ≈ monitor），则 maximize 为 no-op，跳过强校验。
      const alreadyMax = before.width >= mon.size.width * 0.95 && before.height >= mon.size.height * 0.95;
      if (alreadyMax) return;
      // D2 语义（OHOS）：innerSize = outer − 装饰(标题栏)。"铺满显示器"以 outerSize
      // 断言；innerSize 校验内容区宽度铺满 + 高度扣除装饰后仍占大头（≥80%）。
      assert(
        afterOuter.width >= mon.size.width * 0.9 && afterOuter.height >= mon.size.height * 0.9,
        `maximize 后 outerSize ${afterOuter.width}×${afterOuter.height} 未接近显示器 ${mon.size.width}×${mon.size.height}`
      );
      assert(
        after.width >= mon.size.width * 0.9 && after.height >= mon.size.height * 0.8,
        `maximize 后 innerSize ${after.width}×${after.height} 未接近显示器 ${mon.size.width}×${mon.size.height}`
      );
    },
  },

  // ─── smoke：无 getter，仅校验不抛错。效果靠手动按钮验证。 ───
  {
    name: 'window.setFullscreen smoke (effect unverifiable from JS)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      await smoke(() => win.setFullscreen(true), 'setFullscreen(true)');
      await delay(400);
      await smoke(() => win.setFullscreen(false), 'setFullscreen(false)');
      await delay(400);
    },
  },
  {
    name: 'window.minimize smoke (effect unverifiable from JS)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      await smoke(() => win.minimize(), 'minimize');
      await delay(400);
      await smoke(() => win.unminimize(), 'unminimize');
      await delay(400);
    },
  },
  {
    name: 'window.setAlwaysOnTop smoke (OHOS partial: flag only, no z-order API)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      // isAlwaysOnTop 只读 tao AtomicBool，round-trip 是自证，不作断言。
      await smoke(() => win.setAlwaysOnTop(true), 'setAlwaysOnTop(true)');
      await smoke(() => win.setAlwaysOnTop(false), 'setAlwaysOnTop(false)');
    },
  },
  {
    name: 'window.setIgnoreCursorEvents smoke',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      await smoke(() => win.setIgnoreCursorEvents(true), 'setIgnoreCursorEvents(true)');
      await smoke(() => win.setIgnoreCursorEvents(false), 'setIgnoreCursorEvents(false)');
    },
  },
  {
    name: 'window decoration flags smoke (D group, main window no-op)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      // 主窗口 setDecorationFlags 为 no-op；is*() 只读 tao 位域，round-trip 自证。
      // 仅校验调用不抛错。效果在 Float 子窗口上手动验证。
      await smoke(() => win.setClosable(false), 'setClosable(false)');
      await smoke(() => win.setClosable(true), 'setClosable(true)');
      await smoke(() => win.setMaximizable(false), 'setMaximizable(false)');
      await smoke(() => win.setMaximizable(true), 'setMaximizable(true)');
      await smoke(() => win.setMinimizable(false), 'setMinimizable(false)');
      await smoke(() => win.setMinimizable(true), 'setMinimizable(true)');
      await smoke(() => win.setResizable(false), 'setResizable(false)');
      await smoke(() => win.setResizable(true), 'setResizable(true)');
      await smoke(() => win.setFocusable(false), 'setFocusable(false)');
      await smoke(() => win.setFocusable(true), 'setFocusable(true)');
    },
  },
  {
    name: 'window cursor smoke (E group, no getter)',
    category: 'auto',
    async fn() {
      const win = getCurrentWindow();
      await smoke(() => win.setCursorVisible(false), 'setCursorVisible(false)');
      await smoke(() => win.setCursorVisible(true), 'setCursorVisible(true)');
      for (const icon of ['hand', 'crosshair', 'text', 'wait', 'copy', 'not-allowed', 'grab', 'zoom-in', 'default']) {
        await smoke(() => win.setCursorIcon(icon), `setCursorIcon(${icon})`);
      }
      await smoke(() => win.setFocus(), 'setFocus');
    },
  },
];
