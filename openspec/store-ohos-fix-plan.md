# Store OHOS 适配计划

**创建时间**：2026-07-17
**功能描述**：硬化 `tauri-plugin-store` 2.4.3 的 `.on_event`（`RunEvent::Exit`）退出保存路径，在 OHOS 上对 stores map 的 `RwLock` 与 `StoreInner` 的 `Mutex` 采用 `try_read`/`try_lock` 降级，争用时跳过本次退出保存并告警，避免主线程阻塞触发 appfreeze/SIGABRT。其他平台锁语义字节级不变。
**判断依据**：涉及 1 个代码层（tauri-plugin-store 纯 Rust），预估 4 个文件。不涉及 ArkTS / NAPI / openharmony-ability 桥接（store 是纯 Rust 文件 IO，运行期无 OHOS 系统能力调用）。

> **源码状态声明（针对设计审计）**：当前版本（2.4.3）`plugins/store/Cargo.toml` 无 `notify` 依赖，`src/store.rs` 与 `src/lib.rs` 无任何 watcher/notify/inotify 代码，`StoreBuilder` 无 `watch` 字段，`reload()`（`store.rs` L533）是前端手动命令（`lib.rs` L224 `reload` 命令）而非文件事件触发。早期版本设计中的 "inotify 事件风暴→try_lock 失败→主线程阻塞→SIGABRT" 因果链不成立，已整体推翻。本计划不引入 `watch` / `disable_watch` / `DEFAULT_WATCH` 等 API，仅硬化真实存在的 L448-460 代码路径。若未来版本计划引入 notify watch，需另起 change 重新核对。

## 问题根因

`tauri-plugin-store` 2.4.3 的插件 `Builder::build` 在 `.on_event` 处理器（`plugins/store/src/lib.rs` L448-460）的 `RunEvent::Exit` 分支中遍历所有 store 并逐个调用 `save()`。该路径使用阻塞式锁，与文件 watch 无关：

- L451：`collection.stores.read().unwrap()` — `StoreState::stores: Arc<RwLock<HashMap<PathBuf, ResourceId>>>` 的阻塞式读锁。
- L454：`store.save()` — 内部 `self.store.lock().unwrap()`（`store.rs` L549）获取 `StoreInner: Mutex` 的阻塞式锁。

争用来源：

1. **`stores` RwLock 写锁持有方**：`StoreBuilder::build_inner`（`store.rs` L191，store 创建时短暂持有写锁插入 HashMap）与 `Store::close`（`store.rs` L437-443，`Resource::close` 关闭时持有写锁移除条目）。两者均为短临界段，但若与 `RunEvent::Exit` 在 OHOS 主线程上并发，`read().unwrap()` 会阻塞等待。
2. **`StoreInner` Mutex 持有方**：auto-save debounce 任务（`store.rs` L565-598）运行在 `tauri::async_runtime`（tokio）线程池上；`sleep(debounce)` 到期后执行 `store.lock().unwrap().save()`（L592）。`RunEvent::Exit` 触发 `store.save()` 时，若一次 debounce 保存正在 tokio 线程上持有 `Mutex`，主线程 `lock().unwrap()` 阻塞。注意 `Store::save`（L545-549）首行 `auto_save_debounce_sender.lock().unwrap().take()` 并 `send(Cancel)` 仅取消 `recv()` 等待阶段的待决任务，对已在执行 `store.lock().unwrap().save()` 的任务无效。

**OHOS 风险**：OHOS appfreeze 看门狗对主线程无响应约 5s 触发 `SIGABRT`。`RunEvent::Exit` 在主线程执行，阻塞式锁争用在最坏情况下拖延主线程，构成 appfreeze 风险。该风险在所有平台理论上存在，但 OHOS 的看门狗阈值与进程退出时序使其实际可观测，故仅在 OHOS 上做防御性硬化。

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | on_event Exit 路径锁硬化 | p1-store-ohos-fix | ✓ 设计完成 | tauri-plugin-store | 4 | `cargo check --target aarch64-linux-ohos` + 设备端争用压测 |

## Phase 详细说明

### Phase 1: on_event Exit 路径锁硬化
- **目标**：硬化 `.on_event`（`RunEvent::Exit`）处理器，OHOS 上 stores map 与 `StoreInner` 锁争用时降级跳过而非阻塞主线程；所有 OHOS 改动用 `cfg(target_env = "ohos")` 隔离，Windows/macOS/Linux/Android/iOS 构建与运行行为字节级不变；不引入面向应用的配置 API、不修改依赖图、不修改 store 序列化格式或前端 JS 命令。
- **文件列表**：
  1. `plugins/store/src/store.rs`（新增 `pub(crate) fn save_or_skip(&self) -> crate::Result<()>`：OHOS 分支 `try_lock` 降级 + 取消待决 auto-save debounce + `guard.save()`；其他平台分支直接透传 `self.save()`）
  2. `plugins/store/src/lib.rs`（`.on_event` `RunEvent::Exit` 分支：OHOS 用 `try_read()` 争用失败 warn 并 `return`，其他平台保持 `read().unwrap()`；循环内 `store.save()` 改为 `store.save_or_skip()`）
  3. `plugins/store/Cargo.toml`（`[package.metadata.platforms.support]` 增加 `ohos` 元数据声明）
  4. `plugins/store/README.md`（增加 "OHOS" 小节：说明 Exit 路径硬化与退出时锁争用降级语义，不提及文件 watch）
- **依赖**：无新增、无修改任何 Rust crate 依赖（当前版本无 `notify`）。

## 方案排除

**替代方案 A（统一所有平台 `try_read`/`try_lock`）**：将 `on_event` 的 stores map 读锁与单 store `save` 的 `Mutex` 在所有平台改为 `try_read`/`try_lock` 降级。排除原因：改变 Windows/macOS/Linux 现有阻塞式保存语义，违反"不影响其他平台"铁律。OHOS 看门狗风险是本平台特有可观测问题，硬化应仅限于 OHOS。

**替代方案 B（Exit 时 `tauri::async_runtime::spawn` 异步保存）**：在 `RunEvent::Exit` 中把保存任务 spawn 到 tokio 线程池异步执行以避免主线程阻塞。排除原因：Exit 后 runtime 可能立即销毁，spawn 任务不一定执行完；且不解决主线程在 `stores.read()`/`store.save()` 调用点的阻塞问题（仍需同步获取遍历句柄）。

**替代方案 C（引入 `watch`/`disable_watch`/`DEFAULT_WATCH` 配置 API 在 OHOS 默认关闭文件 watch）**：排除原因：当前版本（2.4.3）无 `notify` 依赖、无任何 watcher/inotify 代码、`StoreBuilder` 无 `watch` 字段（见源码状态声明）。配置一个不存在的功能会引入死 API 面与误导性 spec，且与真实根因（Exit 路径阻塞式锁争用）无关。若未来版本引入 notify watch，需另起 change 重新核对因果链。

## OHOS 三铁律遵守

1. **cfg 隔离**：所有 OHOS 硬化用 `cfg(target_env = "ohos")` / `cfg(not(target_env = "ohos"))` 编译期分支。`on_event` 的 `try_read` 降级与 `save_or_skip` 的 `try_lock` 降级均为 OHOS 分支；其他平台编译为原 `read().unwrap()` / 直接透传 `save()`。不引入 `cfg(all(target_env = "ohos", desktop))`——mobile 同样有 appfreeze 看门狗与 auto-save debounce 争用路径，同样硬化。不引入 `cfg!(target_env = "ohos")` 编译期默认常量（无 `DEFAULT_WATCH`，不新增配置）。
2. **不影响其他平台**：不修改任何依赖图（无 `notify` 可改）；不改 Windows/macOS/Linux/Android/iOS 的 `on_event` 锁语义与 `save` 行为；不新增面向应用的 Rust 配置方法或 JS `LoadStoreOptions` 字段；`save_or_skip` 为内部 `pub(crate)` 方法。
3. **无 ArkTS 桥接**：本 Phase 不调用任何 OHOS 系统能力，不需要 openharmony-ability。store 是纯 Rust 文件 IO，硬化仅作用于 Rust 侧锁获取路径。
