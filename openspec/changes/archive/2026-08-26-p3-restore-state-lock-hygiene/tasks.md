# p3-restore-state-lock-hygiene Tasks

## 1. 落地（plugins-workspace/plugins/window-state/src/lib.rs）

- [x] 1.1 `Window::restore_state` OHOS 路径三段式重构（D1）：段0 锁外 fs::read
  文件重读；段1 短锁（文件值写回 + saved clone + 无 saved 时 insert default）；
  段2 锁外全部窗口操作（available_monitors/set_position/set_size/cfg(desktop)
  setter/show/set_focus）
- [x] 1.2 非 OHOS 路径 `cfg(not(target_env = "ohos"))` 原样保留（D2）；
  `RestoringWindowState` 守卫保持跨全函数（D3）
- [x] 1.3 语义保持核对（D1 表格逐项）：fs::read 失败跳过、`?` 错误传播、
  default insert、filter(!= default)
- [x] 1.4 cargo check：OHOS（aarch64-unknown-linux-ohos）+ host 双目标零 error

## 2. 审计与真机验证

- [x] 2.1 审计子agent：复核三段式落地（锁内零环回/零磁盘 I/O）、语义等价表
  逐项、非 OHOS 路径逐字节不动、cfg 隔离完整
- [x] 2.2 构建部署 + 全量套件：基线 281✅/1❌(#86)/1⏭️(#271) 持平 + faultlog
  零新增
- [x] 2.3 盲区补测（D5）：触发 `restore_state` 全 flags（含 POSITION）路径，
  确认无 appfreeze 且位置正确恢复

## 3. 收尾

- [x] 3.1 openspec change 归档（proposal/design/tasks + 验证结果）
- [x] 3.2 plugins-workspace 本地 commit（与 p2 死锁修复合并或续接，不 push）

## 验证结果（2026-08-25 真机）

- 审计全过：三段式锁纪律与 D1-D5 逐项吻合，语义等价表五项保持，非 OHOS 路径逐字节等价
- 套件 282✅/1❌(clipboard)/1⏭️(haptics)（+1 为盲区测试临时转 auto）
- D5 盲区补测：`invoke('plugin:window-state|restore_state', { flags: 63 })` 全 flags 含
  POSITION，走 cmd.rs worker 线程（死锁风险路径），705ms 完成无 appfreeze，位置正确恢复
- faultlog 零新增（最新仍为 20:16:47 修复前旧构建）
- 后续（2026-08-26）：盲区测试转正为 auto（examples/api core.ts，含回归守卫注释），
  新基线 282✅/1❌/1⏭️
