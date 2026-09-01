## Context

OHOS examples/api 测试期（30s 内创建/销毁 30+ 子窗口）出现过一次瞬态 appfreeze
（THREAD_BLOCK_6S，OnSizeChange）。根因（openspec change p1-window-state-per-window-rect
遗留问题 #2 调研定性）：

1. **锁竞争（已修最强的点）**：window-state `save_window_state` 持 `cache` Mutex 做
   `fs::write`，与主线程 Resized handler 竞争——已改为持锁序列化后 drop 再写盘，且
   旧构建的 appfreeze 栈实锤了该路径。
2. **事件风暴**：faultlog 显示主线程 Immediate/Low 队列积压 12+ 事件；且主窗口存在
   **双重注册**（NativeAbility.ets 与 BridgeHost.ets 在同一 window 上各注册
   windowSizeChange + windowRectChange，每次变更产生两份重复事件）。

层1 锁卫生穷尽审计结论：主线程事件链上**再无 appfreeze 级锁问题**——
`window_event_listeners`/`webviews_lock`/`js_event_listeners`/`bounds.lock` 的注册与
使用全部在主线程（同线程无竞争），OHOS `webview.eval()` 是 fire-and-forget
（`dispatch_or_queue → runtime.spawn`，wry/src/ohos/mod.rs:824），临界区微秒级。

附带发现（p1 遗留 #1 验证结果）：`: ESObject` 注解消除了
`arkts-no-untyped-obj-literals` 但引入 `arkts-limited-esobj`——彻底修法是声明真正的
interface。折入本 change 一起做（改动同文件）。

约束：三条铁律（oha 唯一 ArkTS 桥接仓、cfg 隔离不影响其他平台、OHOS_DEVICE_TYPE
形态门控）。层1 三个修法均为平台无关锁范围收窄，无需 cfg。

## Goals / Non-Goals

**Goals:**
- 层1：消除 `on_close_requested` 路径的潜在同线程 Mutex 重入死锁（callback 移出锁外）；
  顺路收窄两处 worker 线程持锁跨阻塞调用的卫生问题。
- 层2：ArkTS 侧 per-window 事件节流（leading+trailing 16ms），治理事件风暴 + 主窗口
  双重注册去重；pending-destroy 窗口事件丢弃 + timer 清理防泄漏。
- wrapped 对象 interface 化，消除 `arkts-limited-esobj` WARN。

**Non-Goals:**
- 不实现架构级根治（事件管线脱离主线程）——记为已知限制，等生产证据再立项。
- 不修复 tauri-runtime-wry L5510 创建时同步读 `inner_size` 的既有 0x0 缺陷（rect cache
  空时 `inner_size` 无 0x0 兜底，`add_child` 显式 bounds 路径产生 inf/NaN 比率）——
  现状已如此，节流不恶化。
- 不节流 avoidAreaChange/keyboardHeightChange/windowStageEvent（低频、不同管线）。
- 不改 B/C/D/F 锁点（审计判定维持，见 D1 的不改清单）。

## Decisions

### D1. 层1 锁卫生：修法 1/2/3 + 不改清单

**修法 1（P3 纯锁序卫生，本 change 落地；审计降级说明）**：
`on_close_requested`（tauri-runtime-wry/src/lib.rs:4846-4878，锁 L4860，callback
L4867-4870 均在锁内）——审计追实了 callback 链路：标准 tauri API 链路上
`Window::on_window_event` 注册走 `proxy.send_event` **异步入队**，下一轮事件循环才
`lock().insert()`，不存在同步重入 `window_event_listeners` 的路径，**死锁不可达**
（原 P2 定性降级）。仍落地：与主事件路径（L4701-4709，先 callback 后锁）模式
对齐的防御性统一，改动无语义回归。平台无关。

**修法 2（P3，顺路落地）**：`response_cache.lock()`
（tauri/src/protocol/tauri.rs:167-184）持锁横跨 `safe_block_on(r.bytes())` 网络读。
改法：NOT_MODIFIED 检查保持在首次持锁期间；body 读取移出锁外，完成后重新 acquire
insert（并发 last-writer-wins，cache 语义允许）。平台无关。

**修法 3（P3，顺路落地）**：`reparent`/`cookies_for_url`
（tauri-runtime-wry/src/lib.rs:1924-1955）的 `window_id` named guard 横跨
`rx.recv()`。改法：读值后立即释放 guard，`recv()` 后重新 acquire 写新值。平台无关。
OHOS 上 `reparent` 本就立即返回 Err（L4060-4063），实际影响极小。**审计注记**：
桌面端 guard 释放后，reparent 阻塞期间同 webview 的其他 op（set_position/set_focus/
set_cookie）可并发读到旧 window_id（原为 guard 串行化）——用户代码不应在 reparent
进行中并发操作同一 webview，实现时加注释说明此行为变更。

**不改清单**（审计判定维持）：
- `plugins.lock()`（runtime 级，lib.rs:3567）——仅主线程访问。
- `window_event_listeners.lock()` 主路径（lib.rs:4705/4679）——注册经
  `run_on_main_thread` 也在主线程，同线程无竞争；`Box<dyn Fn>` 不可 clone，
  改 `Arc` 是全平台类型变更，无收益。
- `webviews_lock()` in emit_filter（tauri/src/manager/mod.rs:607）——OHOS eval
  fire-and-forget，临界区微秒级；对侧 `webviews()` 是 clone-and-release。
- `js_event_listeners.lock()`（tauri/src/event/listener.rs:281）——对侧
  listen_js/unlisten_js 微秒级，锁序一致（C→D）无死锁。
- `bounds.lock()`（lib.rs:4755 等 5 处）——全部主线程。
- `plugins.lock()`（Tauri 级导航，manager/webview.rs:607）——ArkWeb 导航线程，
  非 main-thread 事件链。
- EventTracker.run_events——examples/api 测试脚手架，非生产代码。

### D2. 层2 节流策略：leading + trailing，16ms，per-window

**选择**：per-windowId 的 leading+trailing 节流（非纯 trailing）：
- **leading**：16ms 窗口内首个事件立即派发——子窗口 `createSubWindow` 注册后紧跟
  resize/move/show（L942-946）触发事件，首事件立即进 rect cache，缩短 0x0 空窗期；
  测试期快速创建 30+ 子窗口时每窗首次 rect 立即入缓存。
- **trailing**：窗口内后续事件合并，timer 到期只派发最后一次 payload——终态必达。
- **save 与 rect cache 新鲜度**：window-state `save_window_state` 同步读 rect cache
  不阻塞等事件，但 cache 新鲜度依赖 trailing 终态必达（16ms 内必新）。save 恰落在
  最后一次 rect 变更后 16ms 窗口内的风险由两点覆盖：OHOS 上 save 为用户显式触发
  （Exit 自动 save 已跳过，lib.rs L669-673，非 destroy 时自动跑）+ 状态文件 diff 验证。
  （审计修正：原"即使 trailing 丢失 save 仍正确"表述有逻辑缺陷——trailing 丢失则
  cache 停在次新值，save 落盘陈旧 rect。）

**数据结构**（WindowManager 单例字段，非模块级——WindowManager 是窗口生命周期中心，
销毁清理与 removeWindow 同处内聚）。rect 与 size 是两种格式的事件，需两套独立
throttle state（timers/pending/leading）防互相覆盖。

**windowSizeChange 闭包不写 rect cache**（lifecycle.rs:174-188 只派发事件），
rect cache 仅由 windowRectChange 闭包写入——size 事件节流只影响 tauri 管线频率，
不影响 rect cache 内容。

**为什么放 ArkTS 而非 Rust**：节流源头化（NAPI 跨界本身就是每次事件的成本），
Rust NAPI ABI 零变化、无 HAR 之外的 Rust 改动。

**备选**：纯 trailing——否决，首事件延迟 16ms 扩大新窗口 rect 0x0 空窗期。
Rust 侧节流（tao run_loop 内合并）——否决，NABI 边界成本已付，且 Rust 侧难按
windowId 做定时器（主线程闭包模型）。

### D3. 各注册点改造与主窗口双重注册去重

| 注册点 | 改造 |
|--------|------|
| NativeAbility.ets L417-425 windowSizeChange | wrap 后走 `throttledRectDispatch(0, wrapped, dispatchFn, 'size')` |
| NativeAbility.ets L426-438 windowRectChange | RECOVER→menubar 逻辑**保持同步不节流**（UI 逻辑）；rect dispatch 走 `throttledRectDispatch(0, ..., 'rect')` |
| BridgeHost.ets L588-611 onSizeChange/onRectChange | 走同一 `throttledRectDispatch(0, ...)`；保留既有 `closing/disposed` 守卫 |
| WindowManager.ets L865-873 子窗口 rectChangeHandler | 走 `throttledRectDispatch(windowId, ..., 'rect')` |

NativeAbility 与 BridgeHost 注册在同一主窗口上——同一 per-window(0) 节流器自动合并
两路重复事件，**双重注册去重免费获得**。

### D4. pending-destroy 丢弃 + timer 清理

- `WindowEntry` 接口新增 `destroying: boolean`（createSubWindow 初始化 false）。
- 设置点：`destroyWindow`（L679-691）与 `closeWindow` Float 路径（L700-728）在
  `await win.destroyWindow()` **之前**设 true。
- `throttledRectDispatch` 入口与 trailing timer 回调内都查 `entry?.destroying`，
  为 true 直接丢弃（销毁中窗口的 rect 事件无消费者）。主窗口（id=0）不在 windows
  Map，`undefined` falsy 不受影响。
- timer 清理：`removeWindow`（L1366-1402）clearTimeout + 清 6 个 throttle Map 条目；
  `unregisterUIAbilityStage`（L182-198）清**该调用传入的 windowId**（二级
  UIAbility 实例 id>0，非硬编码 0）的条目——防销毁后 timer 触发 stale dispatch。
  **守卫分工**（审计明确）：removeWindow 后的清除依赖 **clearTimeout**（ArkTS 单线程
  事件循环下可靠，timer 回调无法与同步执行的 removeWindow 交错）；`destroying` 标志
  是"销毁进行中"（destroyWindow/closeWindow 已调用但 removeWindow 未跑）的守卫。
  两者缺一不可，不可依赖 `entry?.destroying` 的 falsy 单独兜底。

### D5. wrapped 对象 interface 化（消 arkts-limited-esobj）

声明真正的 interface 代替 `ESObject`：
```typescript
interface WindowSizeEventWrap { windowId: number; width: number; height: number }
interface WindowRectEventWrap { windowId: number; reason: window.RectChangeReason; rect: window.Rect }
```
throttle Map / dispatchFn 参数 / 回调局部变量全部用具名 interface；
`WindowManager.rectChangeCallback` 签名改 `(options: WindowRectEventWrap) => void`
（调用方仅 rectChangeHandler L869 + 注册 L1226，爆炸半径小；`window.RectChangeReason`/
`window.Rect` 已在现有代码使用，API 可用性已核实）。
（传给 lifecycle 回调时 interface 实例可赋给 ESObject/object 参数，不产生新 WARN。）

**pending payload 深拷贝（审计补充）**：`options.rect` 是系统传入对象引用，若 ArkUI
复用/变更同一 Rect 实例，pending Map 中的引用可能被改写。trailing pending 存**字段
拷贝**（`{ left, top, width, height }` 平铺进 wrap 对象或构造新 Rect 值对象），不存
原引用；leading 路径直接派发不受影响。

### D6. 验证打点

`throttledRectDispatch` 加 hilog：入口 `[THROTTLE-IN] wid kind`（原始触发次数）、
实际派发 `[THROTTLE-OUT] wid kind edge=leading|trailing`。真机跑套件后 grep 统计
削峰比（预期 OUT << IN），并查 faultlog 无新 appfreeze。

## Risks / Trade-offs

- **[高→低] trailing 事件丢失** → timer 清理时窗口已销毁则丢弃正确（无消费者）；
  活跃窗口 trailing 必达；save 读 cache 不依赖事件。终态无损用
  `.window-state.json` 前后 diff 验证。
- **[中] HAR 缓存陷阱** → ArkTS 改动后删 oh_modules + 清 CompileArkTS 缓存 +
  pack.bat（cmd.exe 调用）。
- **[低] setTimeout 精度** → 主线程事件循环 16ms 精度足够（60fps 帧间隔 16.6ms）。
- **[低] 修法 1/2/3 语义** → 均为锁范围收窄；修法 2 并发 insert last-writer-wins
  （cache 语义允许）；修法 3 recv 期间 window_id 不会变（同一 webview 不会并发 reparent）。

## Migration Plan

构建顺序：oha ArkTS（WindowManager/NativeAbility/BridgeHost）改 → cargo check（oha，
层1 涉及 tauri/runtime-wry 另行 check）→ `ohrs build --arch arm64` + pack.bat
（cmd.exe）→ 删 oh_modules + 清 CompileArkTS 缓存 → `cargo tauri ohos build/run`
（方式二套件）→ hilog 节流统计 + faultlog 检查 + 状态文件 diff。

回滚：层1 与层2 相互独立，可分别 revert；层2 revert 恢复直接派发（无 ABI 变化）。

## Open Questions

- **Q1**：主窗口 onWindowStageDestroy 不 off 监听器（系统窗口随 stage 销毁）是既有
  问题——节流 timer 在 unregisterUIAbilityStage 清理后，stale listener 理论上仍可能
  在 stage 销毁后触发（try/catch 吞掉）。实现期观察 hilog 有无 stale 触发，有则补 off。
- **Q2**：BridgeHost 侧注册在 attachComponentWindow（component window）——它与
  NativeAbility 侧注册的 window 实例是否严格同一对象？若是两个对象（主窗口 +
  component window），per-window(0) 节流器仍合并（同 windowId），但事件源可能产生
  不同 rect 值。实现期用 [THROTTLE-IN] 打点观察两路是否交错出现。
