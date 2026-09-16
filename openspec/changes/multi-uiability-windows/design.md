# Design — multi-uiability-windows

> 调研子 agent 方案 + 审计子 agent 复核（46 单例全景 S1-S46、17 验证盲区 E1-E17、14 硬约束
> HC-1..HC-14）+ 主线程四项抽查（HAS_EVENT/WAKER/BridgeHost 独占/cmd.rs 命令，全部属实）
> 综合定稿。2026-09-14。

## 1. 背景

- PR #19（tao `58ad4377`，2026-08-07）旧框架 multiton：`Window::new` 第二个 UIAbility 预分配 id、
  调 `start_ui_ability` 经 `want.parameters` 启动新 EntryAbility，新实例 `onWindowStageCreate` 经
  NAPI `register_ui_ability_stage(window_id)` 回报。
- PR #22（`73212e1e`，2026-08-31）bridge facade 迁移判 "not ported"（tao mod.rs:1320-1323 注释），
  单 UIAbility + Float 子窗口成为现状；`upstream-ohdev-rebase-window-ops/design.md` 偏差 c 明载
  该 deferred gap。
- 现状代码里多 UIAbility 管道大半预埋：`WindowManager.uiAbilityStages: Map<number, WindowStage>`
  （WindowManager.ets:66）+ `registerUIAbilityStage(windowId,...)` 参数化（:200）；
  `MainPage.ets:24-25` `@LocalStorageProp('windowId')`（注释明说 Subsequent UIAbility instances 经
  LocalStorage 收 id）；`DefaultXComponent({moduleName, windowId})` 双模式（:66-96）；
  Rust `next_window_id()`/`register_ui_ability_stage()` 存活（window/mod.rs:223,238）；
  PR #22 `f45745e` 已把 `WindowId` 真 i64 化。
- examples/api 已有测试命令：`create_ui_ability_window`（cmd.rs:923，注释承认现状"第二实例只加载
  默认页 MainPage，非 WebviewUrl；窗口系统管理 resize/move 返回 1300002"）与
  `create_ui_ability_windows_x3`（build.rs:56）。

## 2. Goals / Non-Goals

**Goals**
- G1 多 UIAbility 实例并发：各自 WindowStage/主窗口/生命周期状态。
- G2 每实例唯一 windowId（Rust `next_window_id()` 预分配，经 `want.parameters` 送达新实例）。
- G3 input/IME/axis/focus/redraw/destroy 事件按真实 windowId 路由（当前 14 处硬编码 0）。
- G4 bridge 会话与生命周期状态 per-ability 正确（聚合模型，进程级插件不分家）。
- G5 startAbility 异步握手事件驱动（注册表 + waker），**禁 block_on / recv_timeout**。
- G6 launchType `standard` 化且 tray/menu/statusbar 恢复路径不产生重复实例。
- G7 desktop/mobile 两形态验证（mobile 允许结论为"维持 singleton"）。
- G8 Float 子窗口路径（291 例已验证）零回归。
- G9 全部改动 `cfg(target_env = "ohos")` 隔离；ArkTS 改动只进 openharmony-ability。

**Non-Goals**
- NG1 Sub-UIAbility 键盘合成降级维持现状（MainPage.ets:126-134 注释已入 platform-limitations spec）。
- NG2 cursor 全局单值（`CURSOR_POSITION_X/Y`，app.rs:1040,1045）不升级 per-window——
  MainPage-relative 语义，多窗口 cursor 追踪另行立项（已知限制 E9）。
- NG3 进程级插件（tray/global-shortcut/menu/statusbar/accessibility）不 per-ability 实例化——
  它们本质是进程级服务；只保证事件路由带对 windowId。
- NG4 单 Runtime 多路复用：不为每 ability 建第二个 tauri Runtime/EventLoop
  （`OHOS_WINDOW_CLIENT`/`OHOS_APP` OnceLock、tauri `APP` 单例、`new_any_thread` unimplemented! 维持，
  见 D14 分诊表）；第二窗口只是同一 app 的又一个 Window。
- NG5 接续（continuation）多实例语义延期（`CONTINUATION_*` 单值静态，E11）。
- NG6 `EventLoop::run` 的 `Box::leak`（mod.rs:522）不动——tao 架构约束，与多 UIAbility 正交。
- NG7 `content_rect` 单 Rect / `native_window` 单句柄（S7/S8）不在本期——第二 UIAbility 窗口的
  `raw_window_handle` 暂缺，标注为已知限制。

## 3. 硬约束（任何实现必须全部满足）

| # | 约束 | 依据 |
|---|------|------|
| HC-1 | openharmony-ability 唯一 ArkTS 桥接仓；`start_ui_ability` 复活必须在其 Rust crate 内 `#[napi]`/bridge facade 暴露，tao 只经 `OpenHarmonyApp` 间接调用 | CLAUDE.md 铁律① |
| HC-2 | `cfg(target_env="ohos")` 隔离；OHOS 的 target_os="linux" 依赖加 `not(target_env="ohos")` | 铁律② |
| HC-3 | desktop/mobile 两形态分别验证 | 铁律③ |
| HC-4 | gen/ohos 不重生成：改 tauri-cli 模板须手动同步 gen 目录 + 迁移文档；模板禁 `{{#each}}` 插 bridge plugin import | 已验证行为 |
| HC-5 | 新路径禁主线程 block_on / recv_timeout 同步等待 ArkTS 回报（tray-icon/muda/vibrancy 同族死锁） | mod.rs:88-94 fire-and-forget 模式 |
| HC-6 | `UIABILITY_CREATED` guard 必须移除或参数化 | mod.rs:975,1332-1334 |
| HC-7 | AppStorage 全局单值（bridgeSessionId/__native_module__/initialWantUri/wantUri）必须解决 | NativeAbility.ets:89,241; ProcessInitializer.ets:124 |
| HC-8 | 14 处 `WindowId(0)` 派发硬编码必须参数化 | mod.rs:203,274,299,309,333,357,388,466,596,624,636,648,697,703 |
| HC-9 | `HAS_EVENT`+`WAKER` 双单例必须 per-instance 化（已抽查属实：app.rs:30 静默 no-op；waker.rs:35 全局） | app.rs:30,910-921; waker.rs:35 |
| HC-10 | `registerUIAbilityStage(0,...)` 及其镜像 `unregisterUIAbilityStage(0)`(:540) 必须参数化——后者不改会**误清第一实例** | NativeAbility.ets:374,540 |
| HC-11 | launchType standard 化的 3 个自定位 startAbility 调用点必须同步迁移 | menu.ets:73; StatusBarUtils.ets:40; AppControlPlugin.ets:181 |
| HC-12 | ArkTS 销毁须同步 Rust 注册表（已知同类坑：僵尸句柄） | unregisterUIAbilityStage 路径 |
| HC-13 | `new_any_thread` OHOS `unimplemented!()`——不得依赖多线程 EventLoop | tauri-runtime-wry lib.rs:3504-3507 |
| HC-14 | `createSubWindow` 锁 stage 0（WindowManager.ets:1136）——Float 子窗口须从**调用者所属 stage** 创建 | WindowManager.ets:1136,1161,1164 |

## 4. 架构基线

**三条窗口创建路径**（改动波及面）：

| 路径 | 链路 | 现状 |
|------|------|------|
| A (Float) | Rust `create_os_window` → TSFN → ArkTS `WindowManager.createSubWindow` → FloatPage | 291 例已验证，**零回归红线** |
| B (UIAbility) | OHOS startAbility 新实例 → `onWindowStageCreate` → `registerUIAbilityStage(0)` → `loadContentByName` | 本变更主对象 |
| C (Plugin) | WindowPlugin.ets:535 `create-os-window` → `context.getWindowStage().createSubWindow`（绕过 WindowManager） | 无生产调用方（plugin-window/src/lib.rs:390 注释）；本期标记 deprecated 注释 + 多实例语义说明，不实现 |

**单例全景**：审计 S1-S46 共 46 项（tao 10 / oha-Rust 19 / tauri-runtime-wry 3 / tauri 1 /
ArkTS 8 / 插件层 5），分诊见 §6。最严重：S11 `HAS_EVENT`（第二事件循环静默死亡）、S12 `WAKER`
（唤醒全打第一实例）、S34 bridgeSessionId AppStorage 单值（第二实例覆盖第一实例的响应式订阅）、
S30/S31 `OHOS_WINDOW_CLIENT`/`OHOS_APP` OnceLock 二连 set 降级 no-op、S1 guard 硬拒、
**S-BH BridgeHost 模块独占**（BridgeHost.ets:1832 `prepare()` 对已属活跃 session 的模块直接抛
"already belongs to active Ability session"，LocalUnit.test.ets:530 单测背书——同模块第二实例
必炸，调研初稿 D6 未覆盖，本设计升为 D12）。

## 5. Decisions

### D1 恢复 `start_ui_ability`（缺口1）— bridge facade 路线

`crates/ability/src/window/mod.rs`（L251 后新增）。走 app-control bridge 的 `start-ui-ability`
action（fire-and-forget），非直接 `#[napi]`——保持单一桥接架构（HC-1）+ 异步传输无死锁面（HC-5）：

```rust
pub fn start_ui_ability(app: &OpenHarmonyApp, label: String, url: String, transparent: bool) -> Result<i64> {
    let window_id = next_window_id();
    app.app_control().start_ui_ability(window_id, label, url, transparent)?; // fire-and-forget
    Ok(window_id)
}
```

ArkTS 侧（app-control bridge plugin 新 action）：
```typescript
async handleStartUiAbility(payload: { windowId: number; label: string; url: string; transparent: boolean }) {
  let params: Record<string, Object> = {
    'tauri_window_id': String(payload.windowId), 'tauri_window_label': payload.label,
    'tauri_window_url': payload.url, 'tauri_transparent': String(payload.transparent) };
  let fullWant: Want = { bundleName: context.applicationInfo.name, abilityName: 'EntryAbility', parameters: params };
  setTimeout(() => context.startAbility(fullWant).catch(err => hilog.error(...)), 0); // 关键：逃出 NAPI 重入上下文，否则 AMS 丢 want.parameters
}
```
旧实现考古：`git show 58ad4377`（tao）+ openharmony-ability `git log --all -S "start_ui_ability"`。
**备选** 直接 `#[napi]` 旁路 bridge——拒绝（违反 HC-1，需复活 ArkHelper.ets）。

**落地偏差（2026-09-14 Phase 2）**：facade 实际落在 `crates/plugin-app-control/src/lib.rs`
（自由 async fn `start_ui_ability(app, window_id, label, url, transparent)`，走
`BridgeRuntime::call_sync_from_worker`），编排点在 **tao** `Window::new`（同步分配 id +
注册 pending + 挂 waker，`bridge_executor.spawn` fire-and-forget 派发 startAbility），
而非本节伪代码的 ability `window/mod.rs` + `app.app_control()` 扩展方法。原因：
① 分层——ability crate 不能依赖 plugin-app-control（依赖方向是 plugin → ability）；
tao 已依赖 plugin-app-control（mod.rs:18 既有 import），编排放 tao 零新依赖；
② 线程——`Window::new` 是同步 fn 且可能在 tokio worker 上执行（命令线程建窗，
Float 路径已实证），不能用带 `Env` 的 `with_main_thread_bridge`，必须 worker 侧
`call_sync_from_worker`（其自带主线程自调用拒绝守卫）。HC-1"tao 只经 OpenHarmonyApp
间接调用"仍字面成立（facade 以 `&OpenHarmonyApp` 为参）。id 预分配保持同步在 tao 侧
（D2 伪代码语义不变）。

### D2 tao guard 换闩锁（缺口4）

`mod.rs:975` 删 `UIABILITY_CREATED`，换 `FIRST_WINDOW_CREATED`（闩锁，只约束**首窗口必须是
UIAbility**——Float 无容器可挂）：

```rust
let kind = pl_attrs.window_kind.unwrap_or(OHOSWindowKind::UIAbility);
if !FIRST_WINDOW_CREATED.load(Ordering::SeqCst) && kind != OHOSWindowKind::UIAbility { return Err(os_error!(OsError)); }
let window_id = match kind {
  OHOSWindowKind::UIAbility if is_first => Some(0),
  OHOSWindowKind::UIAbility => Some(start_ui_ability(&el.app, label, String::new(), transparent)?),
  OHOSWindowKind::Float => /* create_os_window 路径不动 */,
};
```
注意 `Window::new` 不等握手（D7），直接以预分配 id 构造 Window 返回。

### D3 NativeAbility 窗口标识参数化（缺口2 + 审计扩展）

恢复 upstream `readWindowId()` 语义（偏差 f，upstream-ohdev-rebase-window-ops/design.md:304-313）：

```typescript
// onCreate: this.abilityWindowId = Number(want.parameters?.['tauri_window_id'] ?? 0)
// onWindowStageCreate: registerUIAbilityStage(this.abilityWindowId, windowStage, this.context, false)
// onWindowStageDestroy: unregisterUIAbilityStage(this.abilityWindowId)   // HC-10 镜像——不改则误清实例1
// onWindowStageRestore(:534): 走 onWindowStageCreate 同链，abilityWindowId 实例字段天然一致
// loadContentByName(Entry.RouteName, storage)  ← 新建 LocalStorage{windowId, bridgeSessionId, initialWantUri, wantUri}
```
同源硬编码 0 一并替换（`this.abilityWindowId`）：notifyWindowStatus(:482,489)、
WindowSizeEventWrap(:435)、WindowRectEventWrap(:451)、setMenuClickHandler(:330)、
setMenuBarRecoverFn(:335)。

### D4 launchType 迁移 + 恢复路径（缺口3，HC-11）——2026-09-15 二次修订：`specified` + `onAcceptWant`

**演进**：一版 `standard` + 三调用点迁 `showWindowMethod(0)` → 同日真机回归（托盘 Hide 后
ShowAll 无法回前台，splash 闪一下即灭）→ 修订为 `specified` + AbilityStage `onAcceptWant`
实例路由。

module.json5（tauri-cli 模板 + examples/api gen）**分形态**：entry_desktop → `"specified"` +
模块级 `srcEntry` → 新增 `ets/abilitystage/EntryAbilityStage.ets`；entry_mobile 维持
`"singleton"`（OQ1 结论位；singleton 不咨询 onAcceptWant，不加 srcEntry）；examples/api gen
entry_desktop 照写（验证载体）（HC-4：模板与 gen 手动双写）。

**onAcceptWant 路由规则**（模板自带，零 HAR 依赖；返回值即 AMS 实例 key）：
- 带 `tauri_window_id` → `tauri-window-${id}`（每窗唯一）→ AMS 新建实例（D1/D2 多窗语义
  不变）；同 id 重复 start → 路由到既有实例 onNewWant（消灭同 id 双实例白屏隐患）
- 裸 want（图标/任务栏/托盘面板/深链二次拉起）→ 固定 `tauri-primary` → AMS 复用主实例
  **拉回栈顶 + onNewWant**（AbilityStage.d.ts 官方语义 "pull it back to the top of the
  stack"，API 9+）

**修订动因**（standard + 窗口级恢复 = 真机回归）：`context.hideAbility()` 是 ability 级
后台化，`restore()`/`showWindow()` 窗口级 API 撤销不了；singleton 时代的实际恢复机制是
"系统 startAbility → onNewWant → GoForeground"（WindowManager.ets Pending Action 注释
自证），standard 下该 startAbility 变成重复实例 spawn（splash 闪现），D4b terminateSelf 后
无人前台化主窗。specified 让裸 want 重新落到主实例——singleton 等价 + 多窗保留 + 无闪现。
一版拒绝 specified 的理由（"instanceKey 在 standard 下被忽略"）不成立于本方案：切换
launchType 本身，onAcceptWant 生效。

3 个自定位 startAbility 调用点（menu.ets showAbility / StatusBarUtils.ets iconClickHandler /
AppControlPlugin.ets show-ability）**维持 startAbility(self)**（5.1 曾迁 showWindowMethod(0)，
随本次修订回退）——specified 下裸 startAbility 即官方前台化原语（拉回栈顶，覆盖可见/最小
化/隐藏全状态）；`showWindowMethod(0)` 保留给 D4b 兜底（主窗可见时 raise）与子窗口路径。
跨应用 startAbility（Autostart/Url/barcode/geolocation 5 处）不受影响。

**D4b plain-relaunch 单实例式守护**（2026-09-15 定案，5.1b 落地）：desktop standard 化后，
外部 relaunch（图标/任务栏/深链二次拉起）的 want 无 `tauri_window_id` → 缺省 0 →
`registerUIAbilityStage(0)`（WindowManager.ets:202 盲 `Map.set`，无防护）覆盖主实例条目（R4
真机实证腐蚀）。守护语义取**单实例式 (b)**：裸 want 且 stage 0 已注册 → ① 禁止覆盖
uiAbilityStages[0] ② `showWindowMethod(0)` 置前主窗 ③ want URI 转发至主实例分区（深链运行中
点击不回归——今天 singleton 下 onNewWant 可收）④ 新实例 terminateSelf。带 `tauri_window_id`
的 want 不受影响，照常开新窗。语义对齐：macOS 原生行为 = Windows+single-instance 插件生产
配方 = OHOS singleton 现状；(a) 新窗式仅是 Windows 未配置时的兜底，默认改变全体 app 的
relaunch/深链 UX，弃。
（2026-09-15 specified 修订：裸 want 由 onAcceptWant 路由到主实例 onNewWant，正常路径不再
产生重复实例；D4b **降级为纵深防御**——仅覆盖 AbilityStage 缺失/路由异常时仍 spawn 出的
裸实例，守护语义不变。）

### D5 事件派发按真实 windowId（缺口5，HC-8）

ArkTS `render/xcomponent.rs:16` `render()` 加 `window_id: i64` 参数（由 DefaultXComponent 经
`nativeModule.render(rootSlot, renderOwner, windowId)` 传入），onTouch/onKey/onMouse/onAxis 闭包
捕获并写进 `InputEvent`/`KeyEvent`/`MouseEvent`/`AxisEvent`/`ImeEvent` 结构体新字段 `window_id`。
tao mod.rs 14 处 `WindowId(0)` → `WindowId(event.window_id)`：

203 Touch / 274 Key / 299,309,333,357 IME / 388 Mouse / 466 Axis / 596 Redraw /
624 GainedFocus / 636 LostFocus / 697 WindowDestroy / 703 WindowClose。
**648 ConfigChanged 维持 WindowId(0)**（app 级事件，R10）。
已是 per-window 不动：584 WindowResize、609 ContentRectChange（参照模式）。
顺带：mouse/axis/IME 的 `DeviceId(0)`（:390,467,311,335,359）维持 0（tao DeviceId 无 per-device
语义消费方，S6 分诊"维持"）；`HAS_FOCUS`（mod.rs:33）维持 app 级（B 实例获焦 ⇒ A 实例
LostFocus，由 624/636 事件对驱动，不改读取位）。
Float 子窗口输入由 ArkWeb 内部消费、不进 tao 派发——D5 对 primary 实例 `real_id==0`，
**纯增量，291 例路径无行为变化**。

### D6 bridgeSessionId per-instance（缺口6）

`NativeAbility.ets:89` 不再写 AppStorage；随 D3 的 LocalStorage 下发。
`DefaultXComponent.ets:74` `@StorageProp("bridgeSessionId")` → `@LocalStorageProp("bridgeSessionId")`。
`onDestroy`(:605) 写 `""` 的清空逻辑同步删除（那是全局单值时代的清场，per-instance 后误伤存活实例）。
BridgeHostRegistry 本身多 host 能力完好（sessions 二级 Map + moduleOwners，BridgeHost.ets:1805-1807），
问题只在 AppStorage 单值桥——审计判定与调研初稿一致（缺口6"有偏差"结论）。
**备选** 命名空间 AppStorage key（`bridgeSessionId_${windowId}`）——拒绝：`@StorageProp` key 须编译期常量。

### D7 异步握手：注册表 + waker（缺口7，HC-5）

`window/mod.rs` 新增（状态机，非阻塞）：

```rust
struct PendingAbility { stage_registered: bool, waker: Option<Waker> }
static PENDING_UI_ABILITIES: Mutex<HashMap<i64, PendingAbility>> = ...;
pub fn register_pending_ui_ability(id: i64) { ... insert(false, None) }
#[napi] pub fn register_ui_ability_stage(window_id: i64) { ... set true + waker.wake() }  // 扩展现有函数
pub fn is_ui_ability_stage_ready(id: i64) -> bool { ... }   // 未知 id → true（首实例兼容）
pub fn set_ui_ability_waker(id: i64, w: Waker) { ... }       // 已注册则立即 wake
```

时序链：start_ui_ability(预分配 id) → 注册 pending → fire-and-forget bridge → tao 立即以 id 建
Window 返回 → wry 把 webview 操作排进既有 `pending_ops` 队列（wry/src/ohos/mod.rs:125，天然覆盖
此竞态）→ ArkTS startAbility → 新实例 onCreate 读 id → onWindowStageCreate →
registerUIAbilityStage(id) → wake() → 事件循环下一轮派发窗口事件 → wry 排空 pending_ops。
平台固有约束注记：OHOS **不 await async onCreate**（NativeAbility.ets:137-144 已有 runtime 先行
push 缓解），多实例放大此竞态窗口——Phase 1 专项观测（E13）。
**备选** oneshot + recv_timeout——拒绝（死锁家族铁律）。

**落地语义注记（2026-09-16 6.5 真机实证）**：绕过 `register_pending_ui_ability` 的裸
`aa start --ps tauri_window_id N` 只产出 ArkTS 壳——实例创建、stage 注册
（`UIAbility stage registered: id=N`）、bridge session join（joined=true）齐全，但 Rust 侧
无 pending 握手 → tao/wry 不建窗口/webview → 空 XComponent 白窗（wry 告警
`OHOS pending status drained but no matching window`）。此为**设计内语义**（`window/mod.rs`
`register_ui_ability_stage` 的 `None` 分支注释即此决策）：第二实例 webview 只经设计路径
`start_ui_ability`（facade/tao `Window::new`，examples/api 的 createUIAbilityWindow 按钮）
产出。白窗自身焦点/最小化/关闭（stage unregistered 链）行为正常。

### D8 生命周期聚合模型（缺口8）

`crates/ability/src/bridge/mod.rs:459-465`：

```rust
struct AbilitySessionState { readiness: BridgeContextReadiness, lifecycle_history: Vec<PluginLifecycleEvent>, session_active: bool }
struct BridgePluginRegistryState {
  plugins: BTreeMap<String, RegisteredPluginEntry>,          // 进程级插件不分家（NG3）
  sessions: HashMap<i64, AbilitySessionState>,              // key = window_id，0 = 首实例
}
```
`PluginLifecycleEvent` 各变体加 `window_id: i64`；`dispatch_lifecycle`(:609) 按 event.window_id
取 session——`AbilityCreated` 只重置**该** ability 的 session（第二实例上线不清第一实例历史，
这是现状单 bool 的核心缺陷）。ArkTS 侧 `forEachLifecycle`（NativeAbility.ets:52-60）遍历的是
实例级 `moduleRuntimes`，天然 per-instance，无须改。
**备选** 每 ability 一个 `OpenHarmonyApp`——拒绝：`static APP: LazyLock`（derive/lib.rs:85）
per-native-module，多 app 需重构整个 derive/注册体系（与 D12 join 模型二选一时同判）。

### D9 want URI per-instance（HC-7 子项，审计扩展）

ArkTS 侧 `initialWantUri`/`wantUri`（NativeAbility.ets:67-68）→ LocalStorage（随 D3 下发）。
Rust 侧 `INITIAL_WANT_URI`/`WANT_PARAMETERS` Mutex 单值（app.rs:1158,1134，S17/S18）→
`HashMap<i64, String>` keyed by window_id（store 时带 id，`on_ability_create_with_want` 闭包签名
加 id）。deep-link `getCurrent()` 按 calling window 的 id 取。

### D10 `HAS_EVENT`/`WAKER` per-instance（HC-9，已抽查属实）

- `app.rs:30` 删全局 `HAS_EVENT` → `OpenHarmonyApp` 实例字段 `event_loop_installed: Cell<bool>`；
  `run_loop`(:910-921) 静默 return 改为带 error log 的 per-instance 守卫。
- `waker.rs:35` 全局 `WAKER: RwLock<Option<TSFN>>` → 移入 `OpenHarmonyApp.waker` 实例字段；
  `OpenHarmonyWaker::new(app)` 实时读实例（沿用"实时读非快照"教训——waker 快照时序 bug 先例）。

### D11 WindowManager stage 0 参数化（HC-14，含审计扩展）

`uiAbilityStages.get(0)` 共 7 处（:1136,1161,1164,1410,1412,1435,1665,1679）→ 方法签名加
`parent_window_id: i64`（默认 0 保持 Float 现路径行为）。`createSubWindow` 由调用方传所属 ability
的 windowId；`isUIAbilityMainWindow`(:258) 依赖 `windowKinds` 正确登记多 UIAbility 窗口为
UIAbility——否则 `closeWindow`(:946) 会误走 `destroyWindow()` 而非 `terminateSelf()`。
按窗口类型分支的 5 个方法（closeWindow/setDecorations/setWindowBackgroundColor/
showWindowMethod/setDecorationFlags）为回归敏感点，Phase 6 全量回归。

**落地结局（2026-09-16，6.3）**：D11 的 `parent_window_id` 参数化**未实现**——OQ2 实验
（见 §9）证明非 primary stage 可行但触发 child 级联销毁，Float 保持挂 primary
（`get(0)` 不变，决策点注释存证）。5 方法审计发现并修复 1 个真 bug：plugin
"set-decorations" 曾旁路直调 `setWindowDecorVisible`（pluginize 迁移只实现 UIAbility
半边），Float 子窗 decorEnabled:false → 恒 no-op；修复为委托
`WindowManager.setDecorations`（Float 分支写 LocalStorage 'decorations' 驱动自绘标题栏，
与 set-fullscreen/set-blur 委托先例同式）。closeWindow Float 分支经审计确认仅菜单路径
可达（Float 无菜单），为防御性代码，不自动化。回归：新增 `window Float kind-branch ops`
自动用例（299 例套件 297✅/0❌/2⏭，基线 296 零回归）。

### D12（新增，审计发现）BridgeHost 模块归属：join 模型

`BridgeHostRegistry.prepare()`（BridgeHost.ets:1810-1848）对已属活跃 session 的模块抛
"already belongs to active Ability session"（:1832，单测 LocalUnit.test.ets:530 断言）——
**同模块第二实例必炸**。方案：**join-existing-session**——

1. `prepare()` 遇模块已属活跃 session 时不再抛异常，改为返回该既有 session 的 join 语义
   （`moduleOwners: Map<string,string>` 已存在，:1807 直接可查）。
2. 第二实例的 `DefaultXComponent` attach 用**既有 sessionId**（LocalStorage 下发的即首实例
   session id，D6 链路自然覆盖）+ 自己的 `renderOwner`（ArkTS 侧 `${sessionId}:${moduleName}:${n}`
   计数器天然唯一）。
3. Rust 侧 `OpenHarmonyApp` 单实例维持（NG4/D8 同判）；`render_owner` 单占用（app.rs:210
   `claim_render_owner` 拒绝二次占用，S-BH 同族）改为 `render_owners: HashMap<i64, String>`
   keyed by window_id，或（若实现复杂度超预期）第二窗口的 render 走既有 owner 的多 root 挂载
   ——Phase 3 实测后二选一，见 OQ3。

**备选** 每 ability 独立 native module（模块独占语义不动）——拒绝：要求应用编译多份 .so +
模板/moduleNames 多模块声明，对用户是破坏性配置；upstream DefaultXComponent doc 注释
（:63 "declaring and assigning a distinct module to each one"）保留为显式多模块进阶用法。

### D13（新增）销毁与残留（HC-12）

第二实例 `onWindowStageDestroy`/`onDestroy`：`unregisterUIAbilityStage(this.abilityWindowId)`
（D3 已含）+ Rust 侧 `PENDING_UI_ABILITIES`/`sessions`/`render_owners`/want-URI map 清理
（加 `unregister_ui_ability(window_id)` NAPI 或复用既有 destroy 事件链）。
已知同类坑：ArkTS 销毁绕过注册表 → 僵尸句柄（ohos-subwindow-destroy-rust-desync）——
Phase 6 专项验证反复建/销第二实例无泄漏（E4）。

**已落地（2026-09-15）**：统一销毁钩子 `OpenHarmonyApp::unregister_ui_ability_state(window_id)`
由 lifecycle.rs `on_ability_destroy` 在 dispatch_plugin_lifecycle 之后调用，一次清理
PENDING_UI_ABILITIES（D7 握手表）/INITIAL_WANT_URI/WANT_PARAMETERS（D9 lazy-take）/
WINDOW_ID_BY_LABEL/window_rects；ArkTS `unregisterUIAbilityStage` 扩展清理
preMaximizeRects/windowBlurRadii/blurRefreshCallbacks/pendingComponentRootCallbacks/
lastFocusedWindow/lastUserInteractedWindow/key_synthesis 控制器/clipboard/zoom 标志，
`removeWindow`（Float 路径）同步覆盖后三类；deep-link 每窗 memo 经 tauri `.on_event`
`WindowEvent::Destroyed` + `window_id_for_label != 0` 守卫移除（A5；Float/未注册 label
解析为 0 不动主窗条目）；`createSubWindow` 显式 `windowKinds.set(Float)`（B2，消除
"缺省即 Float" 隐式依赖）。两前提已论证：window id 由 `NEXT_WINDOW_ID` 单调分配不复用
（按 id 删除不与未来实例冲突）；Float 子窗销毁走 closeWindow→PENDING_WINDOW_CLOSES→
tao Destroyed 链，永不触发 onAbilityDestroy（清理钩子只作用于 UIAbility 实例）。

**E4 验证收口（2026-09-15，HAD-W32 真机）**：探针 10 轮（aa-start specified，
id=101-110，含 0.7-1.7s 快速连销轮）+ 真实派生 2 轮（`create_ui_ability_window` 按钮路径，
id=1 常规存活 / id=2 即建即关 1.2s——A10 stranded-future 观察）。每轮六行销毁证据
（on_window_close→deep-link memo removed→RunEvent Destroyed→stage unregistered→
bridge partitions→unregister_ui_ability_state）齐发，注册表读数十二轮全部一致回落基线
`stages=1 sessions=1 history=1 pending=0 want_params=0 want_uris=1`（want_uris=1 为主窗
自身条目，多轮不涨即无泄漏实证）；THREAD_BLOCK_3S=0；进程全程存活；探针 eval 撞已销毁
窗口零告警。`WMSLife: NotifyWMSWindowDestroyed listener is nullptr` 为每窗销毁一条的既有
框架噪音（与 D13 无关，实证 12 次=销毁总数）。

### D14（新增）单例分诊表

46 项全景处置（审计 S1-S46 + 本设计新增项），四类：

| 处置 | 项 |
|------|-----|
| **本设计解决** | S1(guard→D2) S5(14处→D5) S11/S12(D10) S17/S18(D9) S34(D6) S37/S39/S40/S41(D3) S-BH(D12) render_owner(D12) |
| **by-design 保留 + 措施** | S30/S31/S31(OnceLock 二连 set——NG4 单 Runtime 不变量：第二窗口不 init 第二 Runtime，set 只发生一次；tauri S33 同) S35(`__native_module__` 进程级单模块 by-design，notifyWindowStatus 已带 windowId 参数) S13/S22/S24/S25/S29(计数器/缓存，合理) S2/S3(app 级语义) S28(label 键控) S42 tray-icon `OHOS_APP.set().expect()` 二连 set panic → 改 `set().ok()`+warn（防炸，1 行） |
| **维持现状（无消费方/低风险）** | S4(PRESSED_KEYS thread_local) S6(DeviceId(0)) S23(last-writer-wins 测试用) S26/S27/S43/S44/S45/S46(进程级插件通道，NG3) |
| **延期（已知限制，标注文档）** | S7(content_rect 单 Rect) S8(native_window 单句柄→raw_window_handle 第二 UIAbility 窗口缺) S14(cursor 全局，NG2/E9) S15/S16(pending 队列待查是否已带 id，Phase 2 顺带核实) S19/S20/S21(接续，NG5) S38(tray pendingAction 单值，E12→OQ6) |

## 6. 风险

| # | 风险 | 级别 | 缓解 |
|---|------|------|------|
| R1 | AppStorage bridgeSessionId 覆盖竞态（@StorageProp 响应式串台） | 高 | D6 LocalStorage 根除；Phase 3 并发建窗测试 |
| R2 | WAKER/HAS_EVENT 错位（第二实例事件静默丢失/循环死亡） | 高 | D10；Phase 2 hilog 判据 |
| R3 | start_ui_ability 主线程死锁 | 高 | D1 fire-and-forget + D7 状态机；THREAD_BLOCK_3S 零容忍判据 |
| R4 | standard 下 tray/statusbar 恢复 spawn 重复实例 | 高 | D4 三调用点同步迁移；漏一个即重复实例，Phase 5 判据显式覆盖。**Phase 1 实证升级（2026-09-14）**：重复实例 want 无 tauri_window_id → 缺省 0 → `registerUIAbilityStage(0)` 覆盖主实例 uiAbilityStages 条目（真机实测）——腐蚀面比原判更大。**收口（2026-09-15）**：外部 relaunch（图标/任务栏/深链）同属缺省 0 路径，由 D4b 单实例式守护统一防护（禁止覆盖+置前+URI 转发+terminateSelf），5.1b 落地、5.4 判据覆盖 |
| R5 | Float 路径回归（createSubWindow stage/按类分支 5 方法） | 中 | D5 纯增量（primary id==0）；D11 默认 0 兼容；291 例每阶段回归 |
| R6 | ohpm har 缓存跑旧 ArkTS | 中 | 每 Phase 删 oh_modules + CompileArkTS 缓存重建（既有配方） |
| R7 | SCB clientProxyMap 僵尸加速泄漏 | 低 | 平台问题；atm dump 监控，复现场景杀 sceneboard |
| R8 | 291 例回归 | 中 | Phase 6 全量 + 每阶段抽跑 |
| R9 | EventLoop Box::leak 多次泄漏 | 低 | NG4 单 EventLoop 不变量规避 |
| R10 | ConfigChanged app 级派发误改 | 低 | D5 明确保留 WindowId(0) |
| R11 | BridgeHost join 后事件/回调串台（D12 新引入面） | 中 | Phase 3 双实例 bridge 调用隔离判据；join 语义单测改写 LocalUnit.test.ets:530 |

## 7. 分阶段计划（每阶段真机验证通过才进下一阶段）

**Phase 1 — 纯 ArkTS 验证（0.5 天，零 Rust）**：gen module.json5 手改 standard；onCreate 加
hilog 读 `want.parameters.tauri_window_id`；`hdc shell aa start -b <bundle> -a EntryAbility --ps
tauri_window_id 1` 起第二实例。判据：任务卡片双实例、hilog 收到 id、`register_ui_ability_stage:
id=1`（Rust 侧）、**prepare() 是否抛 already-belongs（D12 前置实证）**、tray 点击不重复 spawn（E13
时序观测）。
**Phase 2 — Rust 握手 + tao guard（2-3 天）**：D7 注册表 → D1 start_ui_ability → D2 闩锁 →
D10 HAS_EVENT/WAKER。判据：examples/api `create_ui_ability_window` 按钮起窗、window_id>0、
新窗 WindowResize 带对 id、主窗功能无损、hilog 无 THREAD_BLOCK_3S。
**Phase 3 — 会话与生命周期隔离（2-3 天）**：D6 LocalStorage → D12 join 模型 → D8 sessions 分区 →
D9 want URI。判据：双实例 bridge 调用互不串台、session_active 独立、deep-link getCurrent() 各自
正确、WAKER 唤醒对实例。
**Phase 4 — 输入路由（1-2 天）**：D5（xcomponent.rs window_id 穿线 + 14 处派发）。判据：A 窗点击
派发到 A、B 窗到 B、IME 跟焦点窗、Float 子窗照常。
**Phase 5 — launchType 迁移（0.5 天）**：D4 三调用点 + 模板/gen 双写 + HAR 重建。判据：
tray/statusbar/show-ability 恢复不重复 spawn、create_ui_ability_window 起新实例。
**Phase 6 — 全量回归（1-2 天）**：291 例套件 + 手动套件 + Float 专项 + 反复建销第二实例无残留
（E4）+ desktop/mobile 双形态 + ohpm 缓存净重建。

**合计 7-11 天，~15-20 文件跨 3 仓 + 模板/gen。**

## 8. 验证盲区专项（审计 E1-E17 精选，验证方案必须显式覆盖）

E1 会话覆盖竞态 / E2 第二实例最小化恢复（onWindowStageRestore 重载内容与接线） / E3 任务卡片
多实例切换焦点 / E4 销毁残留 / E5 WAKER 错位 / E6 HAS_EVENT 静默死 / E8 输入路由 / E9 cursor
偏移（NG2 已知限制，文档标注） / E10 window-state 同 label 覆盖（label 唯一性约定） / E12 tray
点击恢复目标实例（→OQ6） / E15 OnceLock 二连 set 降级（NG4 不变量声明后不应触发） /
E16 Path C context 错用（deprecated 注释后无生产调用方） / E17 tauri APP 单例（同 NG4）。

**E2/E3/E12 定案（2026-09-16 openspec 6.5 真机全过，判据与证据见 tasks.md 6.5）**：
- E2：系统标题栏最小化=**每窗 session 级对称**（setVisibilityMinimizeSession 单
  persistentId，主窗/第二实例窗只隐藏自身，焦点自然回落另一扇窗）；恢复链=
  NotifySessionForeground → windowStageEvent SHOWN → webview OnRenderToForeground，
  **不触发 onWindowStageRestore**（仅 stage 销毁温恢复路径，如接续）**也不触发
  onNewWant**（活任务恢复绕过 onAcceptWant 路由）；webview 状态跨周期保留。
- E3：任务卡片切换=每 webview 干净 OnBlur/OnFocus 对 + 焦点翻转 + ZOrd 提升。
- E12：随 OQ6 定案——tray/statusbar 点击经 specified+onAcceptWant 裸 want 固定恢复
  primary 实例。

## 9. Open Questions

- OQ1 mobile 形态同模块多实例行为（Phase 1 mobile 设备验证；允许结论=mobile 维持 singleton）。
  **状态（2026-09-16）**：随 6.4 双形态验证延期——阻塞 Mate 70 设备，结论位
  entry_mobile 维持 singleton（Phase 5 决策），待移动真机复验后回填。
- OQ2 `createSubWindow` 在非 primary stage 上调用的平台可行性（D11 Phase 4 实测；不行则 Float
  始终挂 primary stage 并文档化）。
  **已定（2026-09-16 零代码实验，openspec 6.3）**：**可行**。scratch 补丁将 createSubWindow
  stage 选择改首个 key>0，spawn 201 实例后建 Float，四项实测：① createSubWindowWithOptions
  非 primary stage 创建成功无抛错；② FloatPage 正常渲染；③ 输入正常（uinput 拖拽随动）；
  ④ **child 级联销毁**——关闭该实例 → 其 stage 上全部 Float 依 windowId 序 system close
  陪葬（9ms 内完成，主实例存活）。语义同 Windows `WebviewWindowBuilder.parent()` 的
  owner-with-auto-destroy。生产决策：**Float 保持挂 primary stage**（个别实例销毁不连坐
  Float，跨实例稳定）；per-instance Float 为 feasible-but-not-implemented，未来若做
  `parent()` OHOS 载体即按本实验结论路由 stage。决策点注释存证
  （WindowManager.ets createSubWindow，openharmony-ability）。
- OQ3 `render_owner` 单占用改造（D12.3 二选一：HashMap keyed by window_id vs 多 root 挂载）。
  **已定（2026-09-14 实现落定）：多 root 挂载**——spawned 窗口经
  `getComponentRoot windowId=N found=false → deferring → found=true → mounted to subRoot`
  各自持有 componentRoot+UIContext，`render_owner` 保持 primary 单占用不动（OQ3 后者）。
  P3-6 真机证据：双窗渲染互不覆盖（spawned 渲染自身 hello.html，主窗 TestRunner 不受扰）。
- OQ4 `OHOS_APP`/`ohos_dispatch_exit` 多实例下终止哪个 ability（建议：调用者所属实例，经
  windowId 路由；Phase 3 定）。
  **已定（2026-09-14 实现落定）**：`lifecycle.rs` `on_ability_destroy` 闭包内
  `window_id == 0` 才 `h(Event::Destroy)`——spawned 实例销毁仅走
  `AbilityDestroyed{window_id}` → `bridge/mod.rs` 移除该 windowId 的 session 分区
  （sessions + lifecycle_history），共享 session、模块桥、primary 退出链全保留。
  真机证据：关闭全部 spawned 窗口后进程存活、主窗保焦点；ArkTS 侧 joined 实例
  `onDestroy` 只发 windowId 分派后立即 return（跳过 beginClosing/dispose 队列，设计内）。
- OQ5 第二实例 WebviewUrl 加载（现状 cmd.rs:923 注释承认只加载默认 MainPage——D1 的 url 参数
  已穿线，Phase 2 验证 want.parameters.url 是否可达新实例 webview；不可达则二期）。
  **已定（2026-09-14 Phase 2/3 实现落定 + 真机证据）**：**可达，但机制不是 want.parameters.url**。
  实际链路：tao `Window::new`（UIAbility kind）预分配 id + `register_pending_ui_ability` 后，
  want.parameters 里只带空 url（仅 AMS 记账用）；**webview URL 是 wry 属性**，经 wry 的
  pending_ops 队列按 window_id 排队，待实例 stage 注册握手完成后以
  WebviewCreateRequest/load_url 投递（tao `platform_impl/ohos/mod.rs` OQ5 注释即此结论）。
  真机证据：spawned 窗渲染 builder 传入的 `hello.html`（P2.7 起窗实测 + P3-6 双窗互不覆盖 +
  6.5 用户目视"helloword/计数器/输入框"），非默认 TestRunner 页。cmd.rs 旧注释（"loads the
  app's default page (MainPage), not the WebviewUrl passed here"）系 D1 落地前的过时描述，
  已随本项修正。
- OQ6 tray/statusbar 点击在多实例下的恢复目标（建议 last-interacted / primary，S38 pendingAction
  单值随决策处理）。
  **已定（2026-09-16，openspec 6.5 真机实证）**：**恢复目标 = primary 实例**。tray/statusbar
  show-ability 经 specified+onAcceptWant 裸 want → `tauri-primary` 固定路由主实例（Phase 5.4
  已实证零新实例）；hideAbility 系 ability 级，天然只作用于主实例。系统级最小化为**每窗对称**
  （主窗/第二实例窗各自 setVisibilityMinimizeSession 单 persistentId，焦点自然回落另一扇窗，
  6.5 双向实证），各窗独立恢复走各自任务卡片（webview 状态保留）。因此 S38 pendingAction
  单值足够（tray 永远只以主实例为目标，无 per-instance pendingAction 需求），S38 维持延期表
  "已知限制"定性。E12 随本项一并定案。

## 10. 设计文档同步点（落地时执行）

1. `upstream-ohdev-rebase-window-ops/design.md` 偏差 c：由"留作后续专项"改为指向本 change。
2. 偏差 f：`readWindowId()` 语义恢复后更新描述。
3. `p1-window-state-per-window-rect/design.md` D1 key 体系注记多 UIAbility 扩展。
4. `ohos-platform-limitations`（platform-limitations spec）：NG1/NG2/NG7/S8 已知限制条目。
