## Why

OHOS examples/api 测试期（30s 内创建/销毁 30+ 子窗口）出现过一次瞬态 appfreeze
（THREAD_BLOCK_6S，OnSizeChange）。根因调研定性（openspec change
p1-window-state-per-window-rect 的遗留问题 #2）：

1. **锁竞争**：主线程事件回调链（ArkUI OnSizeChange → tao run_return →
   tauri-runtime-wry handle_event_loop → tauri 管线）在多个共享 Mutex 上与 tokio
   worker 线程竞争；最强的竞争点（window-state `save_window_state` 持 `cache` 锁
   做 `fs::write`）已在该 change 后续修复中收窄，但链路上仍有结构性暴露面
   （`window_event_listeners` 持锁横跨全部 handler、`webviews` 锁横跨 JS eval）。
2. **事件风暴**：faultlog 显示主线程 Immediate/Low 队列积压 12+ 事件——即使无锁
   等待，高频窗口操作本身的回调风暴也能让主线程忙超 6s 触发 watchdog。

定性为既有缺陷（2026-08-15 已有 4 次同类 appfreeze），前序 change 的子窗口
windowRectChange 注册加剧了频率。本变更做"层1 收尾 + 层2 削峰"两件事，把该类
appfreeze 的触发概率压到生产不可达；架构级根治（事件管线脱离主线程）记为已知
限制，等生产证据再立项。

## What Changes

- **层1 锁卫生收尾**（tauri / tauri-runtime-wry，平台无关锁范围收窄）：穷尽枚举
  主线程事件链上全部跨线程共享锁点，逐点判定收窄/维持。审计结论：主线程事件链上
  无 appfreeze 级锁问题（注册/使用全在主线程，eval fire-and-forget）；落地 3 项
  纯卫生收窄——`on_close_requested` callback 移出 `window_event_listeners` 锁外
  （与主路径模式对齐；审计证实注册走异步消息队列，无同步重入死锁）、
  `response_cache` 不跨网络读（last-writer-wins）、`reparent`/`cookies_for_url` 的
  `window_id` guard 不跨 `rx.recv()`。其余锁点维持不改（判据见 design.md D1 不改清单）。
- **层2 ArkTS 事件节流**（openharmony-ability，全 ArkTS，Rust NAPI ABI 零变化）：
  对每窗口的 windowRectChange/windowSizeChange 做 leading+trailing 16ms 节流
  （同窗口窗口期内首事件立即派发，后续合并，终态必达）；pending-destroy 窗口的
  rect 事件直接丢弃；窗口销毁时清理 pending timer 防 stale 触发。RECOVER 的
  menubar 恢复逻辑保持同步不受节流（节流只作用于发往 Rust 的 dispatch）。
  顺路：wrapped 对象 interface 化（消 arkts-limited-esobj WARN，改动同文件，
  省一次 HAR 重建）。

## Capabilities

### New Capabilities
- `ohos-main-thread-event-hygiene`: OHOS 主线程事件链的锁卫生（临界区收窄）与
  事件削峰（ArkTS 侧节流），治理高频窗口操作场景的瞬态 appfreeze。

### Modified Capabilities
<!-- 无现有 spec 级别需求变更 -->

## Impact

- **代码层**：tauri（manager/webview 事件 emit）、tauri-runtime-wry（事件监听器
  调用）、openharmony-ability（NativeAbility.ets / WindowManager.ets ArkTS 节流）。
  预估 3-6 个文件。
- **跨平台**：层1 若无法做到纯锁范围收窄则 cfg 隔离；层2 全在 ArkTS 天然隔离。
  铁律 1/2/3 全程适用。
- **构建**：oha ArkTS 改动后需 HAR 重建（pack.bat cmd.exe 调用 + 删 oh_modules/
  CompileArkTS 缓存）。
- **风险**：层1 改 tauri 核心锁策略，需审计 handler 增删并发语义；层2 节流的终态
  必达保证（丢终态 = window_rects 缓存陈旧 = 状态持久化回归）是最大风险点。
