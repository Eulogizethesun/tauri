# p3-restore-state-lock-hygiene Design

## 背景

save_window_state AB 死锁（2026-08-25 已修复验证）的同类暴露点：restore_state 在
`WindowStateCache` 锁内调 `available_monitors()`（`window_getter!` → `rx.recv()`
阻塞环回）。cmd.rs 异步命令路径在 tokio worker 执行，主线程 Resized handler
`cache.lock()` 等锁 → 互等。

触发条件：`StateFlags` 含 POSITION。**默认 `StateFlags::all()` 含 POSITION**，
生产按 README 用法即触发；examples/api 只传 SIZE 是测试盲区。

## D1. OHOS 路径三段式（核心修法）

```
段0（无锁）  fs::read saved-state 文件 → Option<HashMap<String, WindowState>>
段1（短锁）  {
               if let Some(saved) = file_cache.get(label) { c.insert(label, saved.clone()) }
               let saved = c.get(label).filter(|s| s != &&WindowState::default()).cloned();
               if saved.is_none() { c.insert(label.into(), WindowState::default()); }
             } // drop(c)
段2（无锁）  if let Some(state) = saved {
               POSITION  → available_monitors()? + intersects + set_position
               SIZE      → set_size
               DECORATIONS → cfg(desktop) set_decorations
               MAXIMIZED && state.maximized → cfg(desktop) maximize
               FULLSCREEN → cfg(desktop) set_fullscreen
               should_show = state.visible
             }
             VISIBLE && should_show → show + set_focus
```

### 判据

- **段2 全部 setter 是 fire-and-forget**（dispatch 发消息不 recv，前序审计已证）：
  从任何线程调用均不阻塞主线程环回 → 锁外调用安全，且 setter 不触碰 cache，
  无互斥需求
- **`available_monitors()` 是段2 唯一 getter 环回**：挪出锁后即使 worker 调用
  阻塞等主线程，主线程无锁可等（cache 锁已释放）→ 死锁环打破
- **fs::read 挪锁外**：同 save 侧"fs::write 挪锁外"先例，消除锁内磁盘 I/O

### 语义保持点

| 原行为 | 新行为 | 等价性 |
|---|---|---|
| 锁内 fs::read 失败 → 跳过文件重读 | 锁外读，失败同样跳过 | ✅ 错误吞掉语义不变 |
| `c.get(label).filter(!= default)` 命中 → 走 restore 分支 | 段1 clone 后段2 判断 | ✅ clone 快照，期间无并发写 cache 的合法路径（save 也在锁外采集，写回前会重取锁） |
| 未命中 → else 分支 insert default（OHOS 无 getter） | 段1 `saved.is_none()` 时 insert default | ✅ OHOS else 分支本就无 getter，metadata 恒 default |
| `available_monitors()?` Err → 中止返回 Err | 段2 同样 `?` 传播 | ✅ 仅位置从锁内到锁外 |
| RestoringWindowState 持有到函数尾 | 保持 | ✅ handler 侧全 try_lock 非阻塞，无死锁参与面；防覆写语义需覆盖 setter→Moved 事件全窗口 |

### 已知微小差异（接受）

- 段1 clone 与段2 之间若并发 Resized/Moved 写 cache：新值会被 restore 覆写
  （restore 语义本就是"用 saved 值覆盖"），且 RestoringWindowState 守卫使
  handler try_lock 失败直接跳过 → 实际不可达，无行为差异

## D2. 非 OHOS 路径

原函数体在 `cfg(not(target_env = "ohos"))` 下逐字节保留（含锁内 getter——桌面
事件循环 inline 短路无死锁面）。铁律 2 隔离。

## D3. RestoringWindowState 守卫

不动。证据：L599-633 Moved/Resized handler 均为 `try_lock().is_ok()` 非阻塞；
守卫语义（恢复期间防 cache 被 Moved/Resized 覆写）要求持有到 set_position 生效
后的事件回流，跨全函数是正确且安全的。

## D4. 不修清单

- CloseRequested handler 锁内 update_state：主线程短路 inline 执行，非死锁点
  （前轮审计判定，P2 观察项维持）
- 非 OHOS restore_state 锁内 getter：桌面无环回阻塞面
- tauri-runtime-wry `window_getter!` 宏本身：平台层传输机制，插件侧锁纪律
  是正确修法层面

## D5. 验证设计

1. cargo check：aarch64-unknown-linux-ohos + host 双目标
2. 真机套件回归：基线 281✅/1❌(#86)/1⏭️(#271)，faultlog 零新增
3. **盲区补测**：现有测试不传 POSITION。验证时通过 hilog/探针触发一次
   `restoreState(label, StateFlags.ALL)`（JS 侧 API），确认：无 appfreeze、
   saved 位置被正确恢复（hdc 读 .window-state.json 前后 diff 或窗口位移观察）
