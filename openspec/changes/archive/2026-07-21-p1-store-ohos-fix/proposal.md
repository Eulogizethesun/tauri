## Why

`tauri-plugin-store` 2.4.3 的插件 `Builder::build` 在 `.on_event` 处理器（`plugins/store/src/lib.rs` L448-460）的 `RunEvent::Exit` 分支中，以阻塞式锁遍历并保存所有 store：

```rust
.on_event(|app_handle, event| {
    if let RunEvent::Exit = event {
        let collection = app_handle.state::<StoreState>();
        let stores = collection.stores.read().unwrap();          // L451 阻塞式 read
        for (path, rid) in stores.iter() {
            if let Ok(store) = app_handle.resources_table().get::<Store<R>>(*rid) {
                if let Err(err) = store.save() {                  // L454 内部 store.lock().unwrap() 阻塞
                    tracing::error!("failed to save store {path:?} with error {err:?}");
                }
            }
        }
    }
})
```

该路径在 OHOS 上存在两条阻塞主线程的隐患，与文件 watch 无关：

1. **`collection.stores.read()` 阻塞** — `StoreState::stores` 是 `Arc<RwLock<HashMap>>`，写锁持有方为 `StoreBuilder::build_inner`（L191，store 创建）与 `Store::close`（L441，Resource 关闭）。`RunEvent::Exit` 与一次并发的 `close`/`build_inner` 在 OHOS 主线程上相遇时，`read().unwrap()` 会自旋等待写锁释放，阻塞 ArkTS UI 主线程。
2. **`store.save()` 内部 `store.lock().unwrap()` 阻塞** — `Store::save`（`store.rs` L545）获取 `StoreInner` 的 `Mutex`。auto-save debounce 任务（`store.rs` L590-592，运行在 `tauri::async_runtime` tokio 线程池上）在 `sleep(debounce)` 到期时会执行 `store.lock().unwrap().save()`。Exit 与一次在途的 debounce 保存相遇时，主线程 `save()` 阻塞等待 tokio 线程释放 `Mutex`。

OHOS appfreeze 看门狗对主线程无响应约 5s 触发 `SIGABRT`。Exit 路径的阻塞式锁在争用时构成主线程阻塞风险，需做防御性硬化。

> **说明（针对设计审计意见）**：早期版本设计曾基于"`tauri-plugin-store` 通过 notify crate 对 store 文件目录建立 inotify watch 触发 reload、事件风暴导致 try_lock 失败→主线程阻塞→SIGABRT"的根因。经核对 `plugins-workspace/plugins/store/Cargo.toml`（2.4.3）与 `src/store.rs` / `src/lib.rs` 源码：**当前版本无 `notify` 依赖，无任何 watcher/inotify 代码，`StoreBuilder` 无 `watch` 字段，`reload()` 是前端手动命令而非文件事件触发**。原 inotify 事件风暴因果链不成立，已整体推翻。本变更不再引入 `watch` / `disable_watch` / `DEFAULT_WATCH` 等 API，仅保留对真实存在代码（L448-460）的 Exit 路径防御性硬化。若未来版本计划引入 notify watch，需另起 change 并重新核对因果链。

## What Changes

- 硬化 `Builder::build` 的 `.on_event` 处理器（`src/lib.rs` L448-460）`RunEvent::Exit` 分支：在 `cfg(target_env = "ohos")` 目标上，将 `collection.stores.read().unwrap()` 改为 `try_read()`，争用失败时 `tracing::warn` 记录并跳过本次退出保存、立即返回；其他平台保持原 `read().unwrap()` 阻塞语义，行为字节级不变。
- 在 `Store` 上新增 `save_or_skip(&self) -> crate::Result<()>`（`src/store.rs`）：`cfg(target_env = "ohos")` 目标上用 `try_lock()` 获取 `StoreInner` 的 `Mutex`，争用失败时 `tracing::warn` 并返回 `Ok(())` 跳过本次保存；其他平台编译为直接调用原 `save()`（透传，无额外分支）。`.on_event` 中对每个 store 调用 `save_or_skip()` 替代 `store.save()`。
- 所有 OHOS 分支用 `cfg(target_env = "ohos")` / `cfg!(target_env = "ohos")` 编译期隔离；Windows/macOS/Linux/Android/iOS 的 `on_event` 锁语义与 `save` 行为不变。
- `Cargo.toml` `[package.metadata.platforms.support]` 增加 `ohos` 元数据声明；`README.md` 增加 "OHOS" 小节说明 Exit 路径硬化与退出时落盘的降级语义。

## Capabilities

### New Capabilities
- `store-ohos-exit-path-hardening`: OHOS 上 `RunEvent::Exit` 退出保存路径的防御性锁硬化——stores map `try_read`、单 store `try_lock`，争用时跳过并告警，避免主线程阻塞触发 appfreeze/SIGABRT；其他平台锁语义不变。

### Modified Capabilities
<!-- 无既有 spec-level 行为变更面向最终用户 API；硬化仅由 cfg 隔离在 OHOS 生效，其他平台无可观察行为差异。 -->

## Impact

- **代码**：`plugins/store/src/lib.rs`（`.on_event` Exit 分支 try_read 降级，调用 `save_or_skip`）、`plugins/store/src/store.rs`（新增 `save_or_skip`）、`plugins/store/Cargo.toml`（平台元数据）、`plugins/store/README.md`。
- **依赖**：不新增、不修改任何 Rust crate 依赖（当前版本无 `notify`，不存在跳过 watcher 创建的需求）。
- **平台**：OHOS desktop/mobile（Exit 路径 try_read/try_lock 降级）；Windows/macOS/Linux/Android/iOS 行为不变（`cfg(not(target_env = "ohos"))` 走原 `read().unwrap()` / `lock().unwrap()` 路径）。
- **API**：不新增面向应用的 Rust 配置方法或 JS 选项；`save_or_skip` 为内部方法。
- **验证**：`cargo check --target aarch64-linux-ohos -p tauri-plugin-store` 通过；OHOS 设备端构造 Exit 与并发 auto-save/close 争用场景，主线程不阻塞、无 `SIGABRT`；其他平台 `cargo check` 回归通过。
