## Why

Phase 0-4 完成后，解耦的实质性工作已就绪，但代码中仍残留约 39 处 Tauri 耦合注释和 ~18 处 plugin crate 描述性引用。此外 `tao/src/platform/ohos.rs` 和 `tauri/src/ohos.rs` 使用 blanket re-export 放大耦合面，`tauri-runtime` 的 `RuntimeInitArgs.app` 直接暴露 ability 类型。Phase 5 是最终清理和验收。

## What Changes

- 39 处 Tauri 耦合注释中性化或删除（跨 ~10 文件）
- plugin crate 注释清理（muda/tray-icon/wry 引用 ~18 处）
- N15 tauri-runtime `RuntimeInitArgs.app` 类型抽象化评估
- N16 tao/tauri blanket re-export 收敛为按需 `use`
- 全量验收标准逐项检查（§七）

## Capabilities

### New Capabilities
- `decoupling-final-cleanup`: 注释清理 + re-export 收敛 + 全量验收

### Modified Capabilities
（无——纯清理和验收）

## Impact

- **全仓库**：~14 个文件的注释修改
- **tao/tauri**：re-export 结构调整
- **验收**：全部验收标准逐项确认
