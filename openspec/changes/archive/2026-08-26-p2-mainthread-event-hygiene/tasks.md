# p2-mainthread-event-hygiene Tasks

## 1. 层1 锁卫生（Rust，平台无关）

- [x] 1.1 修法1：tauri-runtime-wry `on_close_requested`（lib.rs:4846-4878）——
  handler 循环完成后 `drop(listeners)` 再调 `callback(RunEvent::WindowEvent)`，
  与主事件路径（L4701-4709）模式对齐（审计降级 P3 纯卫生：注册走异步消息队列，
  无同步重入死锁）
- [x] 1.2 修法2：tauri `protocol/tauri.rs:167-184`——NOT_MODIFIED 检查保持首次
  持锁；`safe_block_on(r.bytes())` 移出锁外；完成后重新 acquire insert
  （last-writer-wins，注释说明）
- [x] 1.3 修法3：tauri-runtime-wry `reparent`/`cookies_for_url`
  （lib.rs:1924-1955）——`window_id` guard 读值后立即释放，`rx.recv()` 后重新
  acquire 写回；加注释说明桌面端锁持有期变更（同 webview op 串行化→允许并发读
  旧 id）
- [x] 1.4 cargo check：tauri + tauri-runtime-wry（host 目标即可，纯平台无关改动）

## 2. 层2 ArkTS 节流（openharmony-ability，Rust ABI 零变化）

- [x] 2.1 WindowManager.ets：声明 `WindowSizeEventWrap`/`WindowRectEventWrap`
  interface（D5）；新增 6 个 throttle Map 字段 + `THROTTLE_MS=16` 常量 +
  `throttledRectDispatch(windowId, payload, dispatchFn, kind)`（D2/D6，含
  `[THROTTLE-IN]/[THROTTLE-OUT]` hilog 与 try/catch）；trailing pending 存
  rect/size 字段拷贝，不存系统传入对象引用（审计补充）
- [x] 2.2 WindowManager.ets：`WindowEntry` 加 `destroying: boolean`；`destroyWindow`
  （L679-691）与 `closeWindow` Float 路径（L700-728）在 await 前置 true（D4）
- [x] 2.3 WindowManager.ets：`removeWindow`（L1366-1402）与
  `unregisterUIAbilityStage`（L182-198）清对应 windowId（unregister 传参 wid，
  非硬编码 0）的 6 个 throttle Map 条目 + clearTimeout（D4；clearTimeout 是
  "已移除"守卫，destroying 是"销毁进行中"守卫，分工见 design D4）
- [x] 2.4 WindowManager.ets：子窗口 `rectChangeHandler`（L865-873）改走
  `throttledRectDispatch(windowId, ..., 'rect')`（D3）
- [x] 2.5 NativeAbility.ets：L417-438 windowSizeChange/windowRectChange 改走
  `throttledRectDispatch(0, ...)`；RECOVER→menubar 逻辑保持同步不节流（D3）；
  顺路把 L421/L434 的 `: ESObject` 替换为具名 interface（D5）
- [x] 2.6 BridgeHost.ets：L588-611 onSizeChange/onRectChange 改走同一
  `throttledRectDispatch(0, ...)`；保留 `closing/disposed` 守卫（D3）

## 3. 审计与构建验证

- [x] 3.1 审计子agent：复核层1 三修法（并发语义无回归）+ 层2 设计落地
  （终态必达、销毁清理、RECOVER 不受节流、interface 化无新 WARN）
- [x] 3.2 构建验证：cargo check（tauri/runtime-wry/oha）→ ohrs build + pack.bat
  （cmd.exe）→ 删 oh_modules + 清 CompileArkTS 缓存 → 方式二全量套件
  （基线 281✅/1❌/1⏭️）→ THROTTLE 削峰统计 + faultlog 无新 appfreeze +
  `.window-state.json` 前后 diff + arkts-limited-esobj WARN 消除确认

## 4. 收尾

- [x] 4.1 openspec change 归档（proposal/design/tasks + 验证结果）
- [x] 4.2 分仓 commit（oha / tauri 各自隔离层1层2 改动）

## 验证结果（2026-08-25 真机）

- 套件 281✅/1❌(#86 clipboard 平台限制)/1⏭️(#271 haptics)，与基线持平；#82 HTTPS 从
  appfreeze 干扰中恢复（643ms）
- THROTTLE 节流 104 IN / 98 OUT（削峰 5.8%，0 失败）；Q2 双源合流正常；
  arkts-limited-esobj WARN 在目标行消除
- faultlog 零新增；`.window-state.json` 数值合理
- 附带成果：save_window_state AB 死锁（P0 既有缺陷）在本 change 验证期间实锤并同款修复，
  真机验证通过（faultlog 三份拍到双方栈，monomorphization hash 跨构建一致）
