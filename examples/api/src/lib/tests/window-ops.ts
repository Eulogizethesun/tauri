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

/// issue#97 验收口径是「精确相等、零容差」。轮询只消除 resize-inner 异步桥
/// 往返的时序抖动（单次固定 delay 在慢路径下会读到旧值），不放松断言：
/// 超时即 fail，报错带历次读值。
async function readBackEquals(
  read: () => Promise<{ width: number; height: number }>,
  w: number,
  h: number,
  label: string,
  timeoutMs = 5000,
): Promise<void> {
  const seen: string[] = [];
  const start = Date.now();
  for (;;) {
    const cur = await read();
    if (cur.width === w && cur.height === h) return;
    seen.push(`${cur.width}×${cur.height}`);
    if (Date.now() - start > timeoutMs) {
      throw new Error(`${label}: 期望 ${w}×${h}，${timeoutMs}ms 内读回 ${seen.join(' → ')}`);
    }
    await delay(200);
  }
}

/// 主窗口 resize 仅在自由悬浮形态（PC/2in1）生效；手机全屏主窗是系统级
/// no-op（见 doc/ohos-window-test-mapping.md 窗口大小调整行）。outerSize≈
/// 显示器视为全屏形态，跳过主窗尺寸用例（与 maximize 用例的 alreadyMax
/// 早退同策；代价是 PC 最大化状态下也会跳过）。
async function mainWindowResizable(): Promise<boolean> {
  const win = getCurrentWindow();
  const mon = await currentMonitor();
  if (!mon) return true; // 无显示器信息时按可 resize 尝试
  const outer = await win.outerSize();
  return !(outer.width >= mon.size.width * 0.95 && outer.height >= mon.size.height * 0.95);
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
      // "test-" prefix matches the run-app capability window patterns ([test-*])
      // so the spawned instance's webview is allowed to invoke commands.
      const label = 'test-uiability-' + Date.now();
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
  // ─── 问题七 repro (doc/OHOS窗口遗留问题.md 问题七)：spawned UIAbility 窗口创建期属性竞态 ───
  // decorations(false) + min_inner_size(400,300) + build 后立即 set_decorations(false)
  // 三路下发均在 startAbility 握手完成前到达 ArkTS。bug 证据=hilog 的
  // 'Unknown OS sub-window' warn + 窗口带系统标题栏/无尺寸下限（hilog/截图核对）；
  // 本用例固定触发路径并诊断 min-size 下限是否生效（setSize 到下限以下再读回）。
  {
    name: 'window.createUIAbilityWindowRacyAttrs (issue-7 repro)',
    category: 'auto',
    async fn() {
      const label = 'test-uia-racy-' + Date.now();
      const result = await invoke<{
        label: string;
        webview_acquired: boolean;
        ohos_window_id: number;
      }>('create_ui_ability_window_racy_attrs', { windowId: label });
      assert(
        result.webview_acquired === true,
        `webview not acquired: ${JSON.stringify(result)}`
      );
      // 等 3s 让 tao 侧排队属性在新实例 stage 注册后回放（issue-7 修复）+ webview 稳定。
      await delay(3000);
      // 硬断言（2026-09-17 真机定论：setWindowLimits 对编程式 resize 有夹持；
      // 修复后 floor ENFORCED 且 outer==inner 无标题栏——doc/OHOS窗口遗留问题.md 问题七）。
      // 尺寸语义（D2）：setWindowLimits 夹持 outer rect（win.resize 目标），
      // innerSize = outer − 标题栏；判据用 outerSize × scaleFactor 换算物理像素
      // 与 400×300 逻辑下限比较（首轮探针曾拿物理 innerSize 直比逻辑下限，
      // 300×200@1.9x 也会误判 ENFORCED——已修）。
      const { LogicalSize } = await import('@tauri-apps/api/dpi');
      const win = await Window.getByLabel(label);
      assert(win, `window not found by label after settle: ${label}`);
      const before = await win.outerSize();
      await win.setSize(new LogicalSize(300, 200));
      await delay(800);
      const after = await win.outerSize();
      const inner = await win.innerSize();
      const scale = await win.scaleFactor();
      const floorW = Math.floor(400 * scale);
      const floorH = Math.floor(300 * scale);
      // ① setSize 必须产生效果（防 floor 断言假绿：若 resize 整体失效、窗口停在
      //    原尺寸（≥下限），②会误通过）
      assert(
        after.width !== before.width || after.height !== before.height,
        `setSize(300×200) had no effect: outer ${before.width}×${before.height} → ${after.width}×${after.height}`
      );
      // ② 400×300 逻辑下限夹持（issue-7 回归守卫：min_inner_size 创建期下发不再丢失）
      assert(
        after.width >= floorW - 2 && after.height >= floorH - 2,
        `min_inner_size(400×300) floor not enforced: outer ${after.width}×${after.height} physical ` +
          `< ${floorW}×${floorH} (scale ${scale}) — creation-time attributes lost to the ` +
          `stage-registration race (issue 7)`
      );
      // ③ 无标题栏（issue-7 回归守卫：decorations(false) 创建期下发不再丢失）——
      //    decorated 窗 inner = outer − 标题栏，borderless 则两者相等
      assert(
        Math.abs(after.width - inner.width) <= 2 && Math.abs(after.height - inner.height) <= 2,
        `decorations(false) not applied: outer ${after.width}×${after.height} vs inner ` +
          `${inner.width}×${inner.height} (title bar present — issue 7 race)`
      );
      console.log(
        '[issue7-diag]',
        `ohos_id=${result.ohos_window_id} scale=${scale} setSize(300×200 logical) → ` +
          `outer ${after.width}×${after.height} / inner ${inner.width}×${inner.height} ` +
          `(floor ${floorW}×${floorH} ENFORCED, borderless OK)`
      );
    },
  },
  // ─── Float 窗口创建期竞态 (doc/OHOS窗口遗留问题.md 问题七附注) ───
  // create_os_window 为 fire-and-forget: Rust 侧预分配 id 即返回, ArkTS
  // WindowManager.createSubWindow 链(createSubWindowWithOptions →
  // loadContentByName → FloatPage 加载)仍在进行。build() 后立即下发的
  // set_size(260×180) 与创建链并发, pre-fix 在窗口注册进 WindowManager.windows
  // 前到达 → requireWindow 抛 "Unknown OS sub-window" → op 静默丢失
  // (全轮 22 条 warn 的家族)。修复判据: PENDING_FLOAT_WINDOWS 握手排队,
  // notifyFloatWindowRegistered(在 createSubWindow promise END)后回放。
  // setSize 由 Rust 侧命令立即下发 —— JS 侧 setSize 赛的是 tauri IPC
  // (window-not-found) 而非 ArkTS 注册, 复现不了本竞态(issue-7 教训)。
  {
    name: 'window.createFloatWindowRacyAttrs (float creation race)',
    category: 'auto',
    async fn() {
      const label = 'test-float-racy-' + Date.now();
      const result = await invoke<{
        label: string;
        webview_acquired: boolean;
        ohos_window_id: number;
      }>('create_float_window_racy_attrs', { windowId: label });
      assert(
        result.webview_acquired === true,
        `webview not acquired: ${JSON.stringify(result)}`
      );
      // 等 2s: notify 在 ArkTS createSubWindow promise END(含 FloatPage 加载)
      // 才发, 排队的 set_size 回放需要时间。
      await delay(2000);
      const win = await Window.getByLabel(label);
      assert(win, `window not found by label after settle: ${label}`);
      const outer = await win.outerSize();
      const scale = await win.scaleFactor();
      const targetW = Math.round(260 * scale);
      const targetH = Math.round(180 * scale);
      const buildW = Math.round(500 * scale);
      const buildH = Math.round(400 * scale);
      // ① 必须脱离构造尺寸 (防假绿: 若 Float resize 整体失效、窗口停在
      //    500×400, ②会因「接近目标」判据不成立而失败, 但①给出更准确的
      //    失败语义——resize 从未生效, 而非竞态丢失)
      assert(
        Math.abs(outer.width - buildW) > 8 || Math.abs(outer.height - buildH) > 8,
        `window stuck at builder size: outer ${outer.width}×${outer.height} ≈ ` +
          `${buildW}×${buildH} physical — the racing setSize never took effect at all`
      );
      // ② 立即下发的 set_size(260×180 逻辑) 在注册前到达也被排队回放
      //    (float race 修复回归守卫; 容差 ±8 物理像素吸收取整差异)
      assert(
        Math.abs(outer.width - targetW) <= 8 && Math.abs(outer.height - targetH) <= 8,
        `immediate set_size(260×180 logical) lost to float creation race: outer ` +
          `${outer.width}×${outer.height} physical ≠ ${targetW}×${targetH} ` +
          `(scale ${scale}) — op dropped pre-registration (问题七附注)`
      );
      console.log(
        '[float-race-diag]',
        `ohos_id=${result.ohos_window_id} scale=${scale} outer ` +
          `${outer.width}×${outer.height} physical = 260×180 logical REPLAYED, ` +
          `builder 500×400 overridden`
      );
      // 清理: destroy 走 Window::drop → unregister_pending_float(晚到 notify
      // 无害化), 顺带覆盖 V5 观察路径
      await win.destroy();
      await delay(400);
    },
  },
  // ─── 真实读回验证（Float 子窗口） ───
  {
    name: 'window.setInnerSize actually resizes (main window)',
    category: 'auto',
    async fn() {
      if (!(await mainWindowResizable())) return;
      const { PhysicalSize, LogicalSize } = await import('@tauri-apps/api/dpi');
      const win = getCurrentWindow();
      const orig = await win.innerSize();
      const sf = await win.scaleFactor();
      // demo 主窗在 desktop cfg 下带 min_inner_size(600,400)（src-tauri lib.rs），
      // tao 建窗即换算成物理像素下发 setWindowLimits；不清掉的话小目标会被
      // 钳制（参考 PC density 1.9 → 最小 1140×760）。测完还原。
      await win.setMinSize(null);
      // set-limits 是 fire-and-forget 桥调用（系统调用完成不早于 ack 有保证），
      // 等 600ms 让解除先落地再 resize——否则小目标可能被旧 min 抢先钳住
      // （setWindowLimits 完成顺序 vs resize 在系统内无顺序保证）。
      await delay(600);
      try {
        // 目标取原值一半，下限用 issue#97 的人工验证基准 1000×700
        const targetW = Math.max(1000, Math.floor(orig.width / 2));
        const targetH = Math.max(700, Math.floor(orig.height / 2));
        // issue#97 验收口径：精确相等、零容差。读回源是系统 drawableRect
        // 快照（inner_size → inner_rect_for），不是 tao 自己算的值。
        await win.setSize(new PhysicalSize(targetW, targetH));
        await readBackEquals(
          () => win.innerSize(),
          targetW,
          targetH,
          `setSize(${targetW}×${targetH}) 精确读回 (scaleFactor=${sf})`,
        );
        // issue#97 场景「连续两次 set」：中间设一个不同值并确认落地，最终
        // 读回必须是第二次的值（防止连续 set 被合并/丢失）。
        const midW = targetW + 100;
        const midH = targetH + 80;
        await win.setSize(new PhysicalSize(midW, midH));
        await readBackEquals(() => win.innerSize(), midW, midH, `setSize(${midW}×${midH}) 精确读回`);
        await win.setSize(new PhysicalSize(targetW, targetH));
        await readBackEquals(
          () => win.innerSize(),
          targetW,
          targetH,
          `连续两次 setSize 后读回 (期望 ${targetW}×${targetH}, scaleFactor=${sf})`,
        );
      } finally {
        // 还原尺寸与 demo 的最小尺寸约束（lib.rs: min_inner_size(600,400) 逻辑像素；
        // 先还原尺寸再恢复约束，orig 本来就满足约束不会引发再钳制）
        await win.setSize(new PhysicalSize(orig.width, orig.height));
        await delay(400);
        await win.setMinSize(new LogicalSize(600, 400));
      }
    },
  },
  {
    // issue#97 验收 3：save/restore 零漂移（shrinking-main-window 永久回归保护）。
    // 会话内代理：读 inner → 写回同值 → 再读，5 轮全部精确相等。跨重启的
    // window-state 循环 JS 无法重启 UIAbility，仍按 issue97-verify-plan.md §F
    // 人工执行；本用例保护同一漂移机制（读侧 drawableRect ↔ 写侧 resize-inner）。
    name: 'window.setInnerSize save/restore zero drift (5 rounds)',
    category: 'auto',
    async fn() {
      if (!(await mainWindowResizable())) return;
      const { PhysicalSize, LogicalSize } = await import('@tauri-apps/api/dpi');
      const win = getCurrentWindow();
      const orig = await win.innerSize();
      // 同用例一：清掉 600×400 逻辑最小约束，否则 1000×700 会被钳制
      await win.setMinSize(null);
      await delay(600); // 同用例一：等 fire-and-forget 的解除先落地
      try {
        const targetW = 1000, targetH = 700; // issue#97 人工验证基准
        await win.setSize(new PhysicalSize(targetW, targetH));
        await readBackEquals(
          () => win.innerSize(),
          targetW,
          targetH,
          `setSize(${targetW}×${targetH}) 精确读回 (scaleFactor=${await win.scaleFactor()})`,
        );
        for (let i = 1; i <= 5; i++) {
          const cur = await win.innerSize(); // save
          await win.setSize(new PhysicalSize(cur.width, cur.height)); // restore
          await readBackEquals(
            () => win.innerSize(),
            targetW,
            targetH,
            `第 ${i} 轮 save/restore 漂移: ${cur.width}×${cur.height} 写回后期望恒为 ${targetW}×${targetH}`,
          );
        }
      } finally {
        // 还原（不还原会经 window-state 插件跨轮投毒：下一轮 orig=1000×700，
        // 用例一的原值一半目标会低于最小约束）
        await win.setSize(new PhysicalSize(orig.width, orig.height));
        await delay(400);
        await win.setMinSize(new LogicalSize(600, 400));
      }
    },
  },
  {
    // issue#97 场景 2：Float 子窗口（decor=0，chrome 构造性为 0）精确读回。
    // 沿用 core.ts 的 float 窗口惯例：不主动销毁，留给手动 Close All 清理；
    // label 用 test- 前缀（cmd.rs 惯例：非 test- 前缀会注入 STATUS_SCRIPT 轮询）。
    name: 'float window setInnerSize exact readback (decor=0)',
    category: 'auto',
    async fn() {
      const { PhysicalSize } = await import('@tauri-apps/api/dpi');
      const w = await createFloatWindow('test-size-' + Date.now());
      await w.setSize(new PhysicalSize(760, 1100));
      await readBackEquals(
        () => w.innerSize(),
        760,
        1100,
        `float setSize(760×1100) 精确读回 (scaleFactor=${await w.scaleFactor()})`,
      );
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
  // ─── 6.3 Float 专项：D11 按 windowKinds 分支的方法在 Float 子窗口上的行为 ───
  // 生产入口审计（2026-09-16）：show→showWindowMethod（Float 分支 win.showWindow）；
  // set-decoration-flags→setDecorationFlags（Float 分支写 LocalStorage 4 键驱动
  // FloatPage 按钮显隐）；set-decorations→setDecorations（Float 分支写 LocalStorage
  // 'decorations' 驱动自绘标题栏显隐——pluginize 迁移期曾旁路直调 setWindowDecorVisible
  // 致 Float no-op，2026-09-16 修复为委托 WindowManager）；set-background-color→子窗
  // 句柄直调（两 kind 同 API 无分支语义）；closeWindow→仅菜单路径可达（Float 无菜单，
  // 分支为防御性代码，代码审计定案不自动化）。
  {
    name: 'window Float kind-branch ops (D11: decorations/flags/minimize/show)',
    category: 'auto',
    async fn() {
      const label = 'test-float-' + Date.now();
      await invoke('create_decorated_window', { windowId: label });
      await delay(600);
      const w = await Window.getByLabel(label);
      assert(w, `Float window "${label}" not found after create`);

      // ① setDecorations（decorated Float 起点 decorations=true）。
      //    isDecorated 只读 tao 镜像（round-trip 自证）；Float 真实语义 =
      //    FloatPage 自绘标题栏显隐（LocalStorage 'decorations'），视觉/hilog 证据归手动章。
      assert((await w.isDecorated()) === true, 'decorated Float should start decorated');
      await w.setDecorations(false);
      assert((await w.isDecorated()) === false, 'setDecorations(false) mirror readback');
      await w.setDecorations(true);
      assert((await w.isDecorated()) === true, 'setDecorations(true) mirror readback');

      // ② decoration flags：Float 分支写 LocalStorage 4 键。is*() 读 tao 位域（自证），
      //    真实效果 = FloatPage 按钮显隐，归 hilog/手动章；主窗口 no-op 对照见上用例。
      await w.setClosable(false);
      assert((await w.isClosable()) === false, 'setClosable(false) readback');
      await w.setMaximizable(false);
      assert((await w.isMaximizable()) === false, 'setMaximizable(false) readback');
      await w.setMinimizable(false);
      assert((await w.isMinimizable()) === false, 'setMinimizable(false) readback');
      await w.setResizable(false);
      assert((await w.isResizable()) === false, 'setResizable(false) readback');
      await w.setClosable(true);
      assert((await w.isClosable()) === true, 'setClosable(true) readback');
      await w.setMaximizable(true);
      assert((await w.isMaximizable()) === true, 'setMaximizable(true) readback');
      await w.setMinimizable(true);
      assert((await w.isMinimizable()) === true, 'setMinimizable(true) readback');
      await w.setResizable(true);
      assert((await w.isResizable()) === true, 'setResizable(true) readback');

      // ③ minimize → show：isMinimized 读 ArkTS getWindowStatus() 活状态（非 tao 镜像），
      //    真实断言。show 走 showWindowMethod Float 分支（win.showWindow()）。
      await w.minimize();
      await delay(500);
      assert((await w.isMinimized()) === true, 'Float minimize should reflect in live window status');
      await w.show();
      await delay(500);
      assert((await w.isMinimized()) === false, 'Float show (showWindowMethod Float branch) should restore from minimized');

      // ④ setBackgroundColor：Float = 子窗句柄直调（与 UIAbility 分支同 API），仅 smoke。
      await smoke(() => w.setBackgroundColor([255, 0, 0, 255]), 'Float setBackgroundColor');

      // 收尾：flags 已还原 true；close 走 destroy-window 幂等路径（best-effort；
      // 若留残留窗与既有套件行为一致——core.ts 时间戳 label 同理防重跑碰撞）。
      await w.close().catch(() => {});
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
  // Content protection (issue Eulogizethesun/tauri#115): on OHOS this reaches
  // OH_WindowManager_SetWindowPrivacyMode — the window is excluded from
  // screenshot/recording/casting. Invoked via a demo command because
  // @tauri-apps/api/window has no setContentProtection. The visual effect
  // (screenshot of the window turns black) is verified manually.
  {
    name: 'window.setContentProtection (demo cmd)',
    category: 'auto',
    async fn() {
      await invoke('set_content_protection', { enabled: true });
      await new Promise((r) => setTimeout(r, 300));
      await invoke('set_content_protection', { enabled: false });
    },
  },
];
