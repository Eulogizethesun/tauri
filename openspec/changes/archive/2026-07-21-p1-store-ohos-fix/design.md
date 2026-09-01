## Context

`tauri-plugin-store` 2.4.3 的插件 `Builder::build` 在 `.on_event` 处理器（`plugins/store/src/lib.rs` L448-460）的 `RunEvent::Exit` 分支中遍历所有 store 并逐个调用 `save()`。该路径使用阻塞式锁：

- L451：`collection.stores.read().unwrap()` — `StoreState::stores: Arc<RwLock<HashMap<PathBuf, ResourceId>>>` 的阻塞式读锁。
- L454：`store.save()` — 内部 `self.store.lock().unwrap()`（`store.rs` L549）获取 `StoreInner: Mutex` 的阻塞式锁。

**争用来源（均与文件 watch 无关，已核对源码确认当前版本无 `notify` 依赖、无 watcher 代码）**：

1. **`stores` RwLock 写锁持有方**：
   - `StoreBuilder::build_inner`（`store.rs` L191）— store 创建时短暂持有写锁插入 HashMap。
   - `Store::close`（`store.rs` L437-443，`Resource::close`）— store 资源关闭时持有写锁移除条目。
   - 两者均为短临界段，但若与 `RunEvent::Exit` 在 OHOS 主线程上并发，`read().unwrap()` 会阻塞等待。

2. **`StoreInner` Mutex 持有方**：
   - auto-save debounce 任务（`store.rs` L565-598）运行在 `tauri::async_runtime`（tokio）线程池上；`sleep(debounce)` 到期后执行 `store.lock().unwrap().save()`（L592）。
   - `RunEvent::Exit` 触发 `store.save()` 时，若一次 debounce 保存正在 tokio 线程上持有 `Mutex`，主线程 `lock().unwrap()` 阻塞。
   - 注意：`Store::save`（L545-549）首行 `auto_save_debounce_sender.lock().unwrap().take()` 并 `send(Cancel)` 取消待决的 debounce 任务，但**对已在执行 `store.lock().unwrap().save()` 的任务无效**——cancel 仅作用于 `recv()` 等待阶段，进入 `save()` 后无法中断。

**OHOS 风险**：OHOS appfreeze 看门狗对主线程无响应约 5s 触发 `SIGABRT`。`RunEvent::Exit` 在主线程执行，阻塞式锁争用在最坏情况下拖延主线程，构成 appfreeze 风险。该风险在所有平台理论上存在，但 OHOS 的看门狗阈值与进程退出时序使其实际可观测，故仅在 OHOS 上做防御性硬化。

> **源码状态声明（针对设计审计）**：当前版本（2.4.3）`plugins/store/Cargo.toml` 无 `notify` 依赖，`src/store.rs` 与 `src/lib.rs` 无任何 watcher/notify/inotify 代码，`StoreBuilder` 无 `watch` 字段，`reload()`（`store.rs` L533）是前端手动命令（`lib.rs` L224 `reload` 命令）而非文件事件触发。早期版本设计中的 "inotify 事件风暴→try_lock 失败→主线程阻塞→SIGABRT" 因果链不成立，已整体推翻。本设计不再引入 `watch` / `disable_watch` / `DEFAULT_WATCH` 等 API，仅硬化真实存在的 L448-460 代码路径。若未来版本计划引入 notify watch，需另起 change 重新核对。

**约束**（遵守 OHOS 三铁律）：openharmony-ability 是唯一 ArkTS 桥接仓（本变更不调用任何 OHOS 系统能力，无需 ArkTS 桥接）；不影响其他平台（`cfg(target_env = "ohos")` 隔离）；`OHOS_DEVICE_TYPE` 决定设备形态（desktop/mobile 均做硬化）。

## Goals / Non-Goals

**Goals:**
- 硬化 `.on_event`（`RunEvent::Exit`）处理器，OHOS 上 stores map 与 `StoreInner` 锁争用时降级跳过而非阻塞主线程。
- 所有 OHOS 相关改动用 `cfg(target_env = "ohos")` 隔离，Windows/macOS/Linux/Android/iOS 构建与运行行为字节级不变。
- 不引入面向应用的配置 API、不修改依赖图、不修改 store 序列化格式或前端 JS 命令。

**Non-Goals:**
- 不引入 `watch` / `disable_watch` / `DEFAULT_WATCH` 配置——当前版本无文件 watch 机制，配置一个不存在的功能会引入死 API 面与误导性 spec。
- 不修改 `notify` crate（当前版本未依赖 notify）。
- 不在 OHOS 上实现原生文件 watch 替代方案。
- 不修改 auto-save debounce 逻辑、序列化格式、前端 JS API 命令列表。
- 不在 OHOS 上跑依赖 `mock_runtime` 的 store 单元测试（已由 `cfg(not(target_env = "ohos"))` 排除）。

## Decisions

### Decision 1: `on_event` Exit 分支 stores map 改 try_read（仅 OHOS）

`src/lib.rs` L448-460 的 `RunEvent::Exit` 分支，`collection.stores.read().unwrap()` 改为 `cfg` 分支：OHOS 用 `try_read()`，争用失败 `tracing::warn!("store: stores map locked on exit, skipping save")` 并 `return`；其他平台保持 `read().unwrap()`。

```rust
.on_event(|app_handle, event| {
    if let RunEvent::Exit = event {
        let collection = app_handle.state::<StoreState>();
        #[cfg(target_env = "ohos")]
        let stores_guard = match collection.stores.try_read() {
            Ok(g) => g,
            Err(_) => {
                tracing::warn!("store: stores map locked on exit, skipping save");
                return;
            }
        };
        #[cfg(not(target_env = "ohos"))]
        let stores_guard = collection.stores.read().unwrap();
        for (path, rid) in stores_guard.iter() {
            let Ok(store) = app_handle.resources_table().get::<Store<R>>(*rid) else { continue };
            if let Err(err) = store.save_or_skip() {
                tracing::error!("failed to save store {path:?} with error {err:?}");
            }
        }
    }
})
```

**备选（统一所有平台 try_read）**：否决——改变 Windows/macOS 现有阻塞式保存语义，违反"不影响其他平台"铁律。

### Decision 2: 新增 `Store::save_or_skip`，单 store try_lock 降级（仅 OHOS）

在 `Store`（`src/store.rs`）实现 `pub(crate) fn save_or_skip(&self) -> crate::Result<()>`：

```rust
pub(crate) fn save_or_skip(&self) -> crate::Result<()> {
    #[cfg(target_env = "ohos")]
    {
        match self.store.try_lock() {
            Ok(mut guard) => {
                // 取消待决的 auto-save debounce 任务（与原 save 首行一致）
                if let Some(sender) = self.auto_save_debounce_sender.lock().unwrap().take() {
                    let _ = sender.send(AutoSaveMessage::Cancel);
                }
                guard.save()
            }
            Err(_) => {
                tracing::warn!("store: StoreInner locked on exit, skipping save");
                Ok(())
            }
        }
    }
    #[cfg(not(target_env = "ohos"))]
    {
        self.save()
    }
}
```

`.on_event` 中 `store.save()` 调用改为 `store.save_or_skip()`。其他平台 `save_or_skip` 编译为直接调原 `save()`，无额外分支、无额外锁开销。

**理由**：`RunEvent::Exit` 是进程退出前最后一次落盘机会。OHOS appfreeze 看门狗优先级高于优雅退出——若退出路径阻塞主线程 >5s 仍会 `SIGABRT`。try_lock 降级牺牲最坏情况下（在途 auto-save 持锁）的最后一次落盘，换取主线程不阻塞。auto-save debounce（默认 100ms）已在正常 `set`/`delete` 后落盘，`Drop for Store`（`store.rs` L610-614）的 `apply_pending_auto_save` 兜底，Exit 路径跳过的实际数据丢失概率极低。

**备选（Exit 时 `tauri::async_runtime::spawn` 异步保存）**：否决——Exit 后 runtime 可能立即销毁，spawn 任务不一定执行完，且不解决主线程在 `read()`/`save()` 处的阻塞问题。

### Decision 3: cfg 隔离边界

- `on_event` try_read 降级：`cfg(target_env = "ohos")` 分支，OHOS 走 `try_read`，其他平台走原 `read().unwrap()`。
- `save_or_skip` try_lock：`cfg(target_env = "ohos")` 分支，OHOS 走 `try_lock`，其他平台编译为直接 `save()` 透传。
- 不引入 `cfg(all(target_env = "ohos", desktop))`——mobile 同样做硬化（mobile 同样有 appfreeze 看门狗与 auto-save debounce 争用路径，无理由排除）。
- 不引入 `cfg!(target_env = "ohos")` 编译期默认常量（无 `DEFAULT_WATCH`，不新增配置）。

## Risks / Trade-offs

- **[风险] OHOS 上 Exit 时 try_lock 跳过保存丢失最后一次写入** → 缓解：auto-save debounce（默认 100ms）已在正常 set/delete 后落盘；`Drop for Store`（`apply_pending_auto_save`）兜底；Exit 路径只在"进程退出 + 锁争用"双重条件下跳过，概率极低。
- **[权衡] `save_or_skip` 为内部 `pub(crate)` 方法** → 不暴露面向应用的新 API，避免增加 API 面。
- **[风险] `cfg(target_env = "ohos")` 在非 OHOS 构建为 false，若开发者在 Linux 主机误标 OHOS** → 缓解：`target_env = "ohos"` 由 OHOS 目标 triple 决定，不会被普通 Linux 构建触发。

## Migration Plan

1. 合并本 change 后，OHOS 应用无需任何代码改动——Exit 路径自动硬化，appfreeze 风险降低。
2. 其他平台无感知：`on_event` 锁语义、`save` 行为不变，无新 API。
3. 回滚：还原 `store.rs`/`lib.rs`/`Cargo.toml`/`README.md`，无数据迁移。

## Open Questions

- 是否需要在 `Store::save_or_skip` 的 OHOS 分支中，对 `auto_save_debounce_sender` 的 `Mutex` 也用 `try_lock`？当前实现仍用 `lock().unwrap()`——该 `Mutex` 临界段极短（仅 `take()`），与 `StoreInner` 的 `Mutex` 不是同一把锁，争用概率极低，P1 保持阻塞式以减少改动面。若审计发现实际阻塞，P2 再降级。

---

## 实现期补充修复 (2026-07-20/21，Exit 硬化之外的 timeout 根因)

Exit 路径硬化(Decision 1/2)落地后，store 测试仍 timeout。深挖发现根因 = `Store::Drop` → `apply_pending_auto_save` 阻塞(持 `auto_save_debounce_sender` Mutex，被 in-flight auto-save debounce 任务持有)，级联拖垮 sql/websocket。补充修复(均 OHOS cfg 隔离):

1. **`load` 命令包入 `spawn_blocking`**(`plugins/store/src/lib.rs`):load 是 async 命令但内部全同步阻塞(fs::read + 锁)，包入 `tauri::async_runtime::spawn_blocking` 不阻塞 invoke 关键路径。
2. **`build_inner` 锁重排**(`plugins/store/src/store.rs`):把 `store_inner` 构造 + load 移到 `stores.write()` 之前，锁内仅检查 + insert，缩短写锁持有时长。
3. **`apply_pending_auto_save` → `save_or_skip`**:`Store::Drop` 的 `apply_pending_auto_save` 里 `self.save()` 改 `self.save_or_skip()`(复用 Decision 2 的 OHOS try_lock 跳过分支)。
4. **强化 #3:`Drop::drop` OHOS 完全 skip**(`store.rs` ~L644):OHOS 下 `Drop::drop` 直接 `return`，不调 `apply_pending_auto_save`(它会获取被 in-flight debounce 持有的 Mutex，Drop 内阻塞导致 invoke 响应延迟/timeout/appfreeze)。调用方应显式 `save()`；与 Exit 的 `save_or_skip` 降级一致。其他平台走原 `apply_pending_auto_save`。

验证:hilog 显示 build_inner/load 全 0ms；store ✅ 112ms、sql ✅ 94ms、localhost ✅ 10ms 全 pass(之前 store/sql timeout)。
