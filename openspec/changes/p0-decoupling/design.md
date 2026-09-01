## Context

Bridge 迁移（PR #67/#68）将 openharmony-ability 从旧的 `get_named_property` 直调模型迁移到 pluginized bridge 架构。迁移完成后，核心仓 `crates/ability` 中遗留了多条与新架构并行的旧代码路径：

1. **旧 menu channel**（`menu/mod.rs:64` `MENU_EVENT_CHANNEL`）和 **旧 statusbar channel**（`statusbar/event.rs:8,11`）仍存活，但所有外部消费者已迁移到 plugin facade（plugin-menu / plugin-statusbar）。全限定路径搜索确认外部零命中。
2. **`helper/webview.rs`**（970 行）被 `helper/mod.rs:13` 的 `#[cfg(feature = "webview")]` 声明守护，但 `Cargo.toml:8-18` 的 features 中**未定义 `webview`**。模块永不编译，是旧架构遗留的 webview 直调代码。
3. **`drag_and_drop = []`** feature（`Cargo.toml:10`）仅 gate 死代码（`_legacy/` 目录 + `helper/webview.rs`），wry 的 `Cargo.toml` 启用它但无实际效果。
4. **`lib.rs:132-141`** 的 menu re-export 和 `:147-151` 的 global_shortcut re-export 仍暴露旧 API，虽然外部全限定调用已零命中。

## Goals / Non-Goals

**Goals:**
- 为旧 channel API 添加 `#[deprecated]` 标注，发出明确的弃用信号
- 删除永不编译的 `helper/webview.rs` 死代码模块（970 行）
- 移除空壳 `drag_and_drop` feature 定义和启用
- 确保清理后 `cargo check --target aarch64-unknown-linux-ohos` 仍通过
- 不破坏任何现有外部消费者的编译

**Non-Goals:**
- 不删除旧 channel 本身（留给后续 Phase，当消费者全部迁走后删除）
- 不迁移任何 consumer 到新 facade（Phase 1 的工作）
- 不重构内部代码结构（Phase 2 的工作）
- 不清理 Tauri 耦合注释（Phase 5 的工作）

## Decisions

### D1: `#[deprecated]` vs 直接删除旧 channel

**选择**：`#[deprecated(note = "Use plugin-menu/plugin-statusbar facade instead")]`

**理由**：
- 虽然全限定调用搜索确认外部零命中，但 `lib.rs:132-141` 的 re-export 使这些函数仍是 `openharmony_ability` 的公共 API
- 直接删除可能影响通过 `pub use menu::*` 或 `pub use statusbar::*` 间接引用的代码
- `#[deprecated]` 提供安全过渡期：编译仍通过，但产生 warning

**替代方案**：直接删除 → 风险过高，无法 100% 确认无间接消费者

### D2: `helper/webview.rs` 删除策略

**选择**：直接删除文件 + 移除 `helper/mod.rs:13-14,25-26` 的 cfg 声明

**理由**：
- 模块永不编译（feature `webview` 未定义），零运行时影响
- 970 行死代码制造维护负担和注释扫描噪音
- 文件内容是旧架构直调 ArkHelper 的 webview 代码，已被 plugin-webview 完全替代

### D3: `drag_and_drop` feature 处理

**选择**：从 `ability/Cargo.toml` 和 `wry/Cargo.toml` 同时移除

**理由**：
- feature 仅 gate 死代码（`_legacy/` 目录 + `helper/webview.rs`，均未编译）
- wry 启用一个空操作 feature 是配置噪音
- 移除不影响任何编译路径

### D4: `lib.rs` re-export 清理范围

**选择**：仅清理 `lib.rs:132-141` 的 menu re-export 中标记为 deprecated 的函数

**理由**：
- re-export 的函数（`menu_event_receiver`, `send_menu_event`, `popup_request_receiver` 等）将被标记 deprecated
- re-export 本身保留但添加 `#[allow(deprecated)]` 避免 self-deprecation warning
- global_shortcut re-export（`:147-151`）暂不处理——Phase 1 consumer 迁移完成后统一清理

## Risks / Trade-offs

- **[间接消费者]** `#[deprecated]` 不阻止编译，但可能触发 CI 中 `deny(warnings)` → 在 deprecation 标注上添加 `#[allow(deprecated)]` 到内部使用点
- **[feature 删除后 wry 编译]** wry 移除 `drag_and_drop` feature 后，如果 wry 的 OHOS 代码中有 `#[cfg(feature = "drag_and_drop")]` gate → 需确认 wry OHOS 代码中无此 cfg gate（已在 Phase 0 文件列表中验证）
- **[re-export 断裂]** `lib.rs` 的 menu re-export 被外部通过 `openharmony_ability::menu_event_receiver` 调用 → 已确认零命中，风险可控
