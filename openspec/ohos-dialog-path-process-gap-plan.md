# OHOS 对话框/路径/进程/启动画面 缺口补齐计划

**创建时间**：2026-07-20
**功能描述**：补齐对话框（R181 文件夹选择、R184 错误对话框）、路径 API（R190 桌面目录降级）、进程 API（R192 重启契约补档）、启动画面（R226 系统配置）、平台限制降级（R195/R223-224/R227-230）的 openspec 契约文档。
**判断依据**：复核已有代码后，多数项已实现或为平台限制降级，仅需补档契约；R184 需小幅代码修改。

## 现状复核结论

| 行 | 功能 | 现有代码 | 判定 |
|----|------|---------|------|
| R181 | 文件夹选择对话框 | `commands.rs` OHOS 分支返回 `FolderPickerNotImplemented` | 平台限制降级，契约补档 |
| R184 | 错误对话框 | `tauri-runtime-wry/dialog/mod.rs` 非 Windows `unimplemented!()` | 需 OHOS 安全降级实现 |
| R190 | 其他路径（桌面/字体/运行时/模板） | `path/mod.rs` cfg 隔离，OHOS 不暴露 | 平台限制降级，契约补档 |
| R192 | 重启应用 | `app.rs::do_restart` + plugin-process `ohos::restart` 已用 `appRecovery.restartApp` | 已实现，契约补档 |
| R193 | AppImage 检测 | `process.rs` `cfg(all(linux, not(ohos)))` 已隔离 | 平台限制降级，归入 R192 规范 |
| R194 | 单实例限制 | `ohos-single-instance` spec 已存在 | 契约已满足 |
| R195 | 多进程 | OHOS 无通用 spawn | 平台限制降级 |
| R196 | 自动启动 | `ohos-autostart` spec 已存在 | 契约已满足 |
| R222 | 全局快捷键 | 3 phase 已归档实现 | 契约已满足（归档） |
| R223/224 | 全局托盘/菜单事件监听 | desktop 形态归 tray/menu 规范（只读） | 降级/归其他规范 |
| R226 | 启动画面 | OHOS 系统 splash via module.json5 | 模板配置降级 |
| R227 | 字体 | 无 Tauri 字体插件 | 平台限制降级 |
| R228 | 应用接续 | OHOS continuationManager，无 Tauri 对应 | 未来工作 |
| R229 | 截图取色 | OHOS screenshot（系统应用），无 Tauri 插件 | 未来工作 |
| R230 | 无障碍 | OHOS accessibility，无 Tauri 对应 | 未来工作 |

## Phase 列表

| Phase | 名称 | 涉及 spec | 代码改动 | 状态 |
|-------|------|----------|---------|------|
| 1 | 契约补档（无代码） | ohos-dialog-folder-picker, ohos-path-desktop-dirs, ohos-process-restart, ohos-splash, ohos-platform-limitations | 无 | ✓ spec 已写 |
| 2 | R184 dialog::error OHOS 降级 | ohos-dialog-error | `tauri-runtime-wry/src/dialog/mod.rs` 增加 `#[cfg(target_env = "ohos")]` log 分支 | 待实现 |
| 3 | 审计已有 spec 完整性 | ohos-dialog-plugin, ohos-single-instance, ohos-autostart | 无 | ✓ 审计完成（见报告） |

## Phase 2 详细说明（唯一需代码改动项）

### 目标
将 `tauri-runtime-wry::dialog::error()` 在 OHOS target 从 `unimplemented!()` 改为 `log::error!` 安全降级。

### 文件列表
- `crates/tauri-runtime-wry/src/dialog/mod.rs`：
  - 当前 `#[cfg(not(windows))]` 分支 `unimplemented!()`
  - 新增 `#[cfg(target_env = "ohos")]` 分支：`log::error!("[dialog::error] {}", _err.as_ref())`
  - 调整 cfg 优先级：`#[cfg(windows)]` → `#[cfg(target_env = "ohos")]` → 其余 `#[cfg(not(any(windows, target_env = "ohos")))]` 保留 `unimplemented!()` 或同步降级（不强制）

### 验证
- `cargo check -p tauri-runtime-wry --target ohos`：编译通过，无 `unimplemented!` 在 OHOS 分支
- 单元测试：无法直接测试 log 输出，但可通过 `cargo test` 确认函数不 panic
- 设备端：由于 `webview_runtime_installed` 在 OHOS 始终为 true，`dialog::error` 实际不被调用；本改动为防御性契约补齐

## 关键未知项
1. **OHOS 文件夹选择 API**：截至 API 21 确认无第三方目录选择器；若 API 22+ 新增需升级 `ohos-dialog-folder-picker` 规范。
2. **appRecovery.restartApp 设备覆盖**：API 9+ 模块，理论支持全设备形态；wearable 返回 801 时当前实现已 `log::error!` + `exit(0)` 降级，符合契约。
3. **OHOS 系统 splash 模板字段**：需确认 `tauri-cli` OHOS 模板 `module.json5` 是否已生成 `startWindowIcon`；若未生成需在模板层补齐（属 tauri-cli 范围，本计划仅记录）。

## 不创建新 spec 的项
- **ohos-global-shortcut**：3 phase 已归档（`p1/p2/p3-global-shortcut`），契约已满足，不重复创建 active spec。
- **ohos-single-instance**：active spec 已存在且完整。
- **ohos-autostart**：active spec 已存在且完整。
- **ohos-dialog-plugin**：active spec 已存在，覆盖 open/save/message/ask/confirm；R179/180/182/183 契约已满足。
