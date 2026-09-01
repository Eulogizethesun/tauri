# Technical Design: Phase 5 — 注释清理 + 验收

## Context

Phase 0-4 完成后，解耦的实质性工作已就绪。但代码中仍残留约 39 处 Tauri 耦合注释（跨 ~7 文件）和 ~18 处 plugin crate 描述性引用（muda/tray-icon/wry）。此外 `tao/src/platform/ohos.rs` 和 `tauri/crates/tauri/src/ohos.rs` 使用 blanket re-export (`pub use openharmony_ability::*`) 放大耦合面，`tauri-runtime` 的 `RuntimeInitArgs.app` 直接暴露 ability 类型。

Phase 5 是最终清理和验收：注释中性化、re-export 收敛、全量验收标准逐项检查。

## Goals

- 39 处 Tauri 耦合注释中性化或删除（跨 ~7 文件）
- plugin crate 注释清理（muda/tray-icon/wry 引用 ~18 处）
- N16 tao/tauri blanket re-export 收敛为按需 `use`
- N15 tauri-runtime `RuntimeInitArgs.app` 类型抽象化评估
- 全量验收标准逐项检查

## Non-Goals

- 不改变任何功能行为（纯注释和 re-export 结构调整）
- 不新增能力或迁移 consumer
- 不删除 ArkHelper 调用链（Phase 4 已完成）

## Decisions

### D1 注释中性化策略

**决策**：tauri/tao/wry/muda/tray-icon 引用替换为中性术语或直接删除。

**中性化术语对照表**：

| 原始引用 | 中性化替换 | 适用场景 |
|----------|-----------|---------|
| `tauri-runtime-wry event loop` | `consumer event loop` | close 队列注释 |
| `WindowsStore` | `window store` 或删除 | close 队列注释 |
| `tao ZST WindowId` | `ZST WindowId` 或删除 | close 队列注释 |
| `tao reads these values` | `the windowing backend reads these values` | cursor 注释 |
| `for muda` / `muda's event listener thread` | `for the menu consumer` / `consumer's event listener thread` | menu 注释 |
| `tray-icon's event-forward thread` | `consumer's event-forward thread` | statusbar 注释 |
| `installed by wry` / `wry's InnerWebView drop` | `installed by the webview consumer` / `consumer's InnerWebView drop` | webview 注释 |
| `tauri's on_menu_event chain` | `consumer's menu event chain` | menu 注释 |
| `AppHandle::run_on_main_thread` | `main thread dispatch` | global-shortcut 注释 |
| `tauri-plugin-global-shortcut` | `the global-shortcut consumer` | global-shortcut 注释 |
| Tauri 主仓 UT 路径 | 删除或改为通用描述 | version.rs 注释 |

**清理范围**：
- `app.rs`（8 处）
- `menu/mod.rs`（11 处）
- `window/mod.rs`（9 处）
- `helper/webview.rs`（6 处 — Phase 0/2 已删除此文件，若仍有残留则清理）
- `global_shortcut/mod.rs`（3 处）
- `global_shortcut/event.rs`（1 处）
- `version.rs`（1 处）
- plugin crate: `plugin-menu/src/lib.rs`（8 处）、`plugin-statusbar/src/lib.rs`（4 处）、`plugin-webview/src/lib.rs`（6 处）

**验收**：非版权头 Tauri 注释 grep 命中 = 0。版权头（`Copyright 2019-2024 Tauri Programme within The Commons Conservancy`）作为 Apache-2.0/MIT 双许可法定署名保留，不计入命中数。

### D2 re-export 收敛

**决策**：`pub use openharmony_ability::*` → `pub use openharmony_ability::{OpenHarmonyApp, ...}` 按需列表。

**收敛文件**：
- `tao/src/platform/ohos.rs:136`：`pub use openharmony_ability::*;` → 仅 re-export tao 实际使用的类型
- `tauri/crates/tauri/src/ohos.rs:4`：`pub use openharmony_ability;` → 收敛为按需 `use` 或仅 re-export `OpenHarmonyApp` 等少数类型

**理由**：全量 re-export 使 ability crate 的全部 pub 项成为 tao/tauri 公共 API，任何 ability 内部 pub 变更都外溢。收敛后 ability 内部变更不自动影响 tao/tauri 公共 API 面。

**收敛原则**：仅 re-export 真正需要对外暴露的类型（`OpenHarmonyApp`、`OpenHarmonyRuntime`、`RuntimeInitArgs` 等少数），其余由消费者自行 `use openharmony_ability::SpecificType`。

### D3 RuntimeInitArgs.app: 评估 trait object 抽象 vs 接受为运行时集成层合法耦合

**决策**：评估 `RuntimeInitArgs.app: openharmony_ability::OpenHarmonyApp` 是否需要用 trait object 抽象隐藏具体类型。

**评估方向**：
- **选项 A（trait object 抽象）**：定义 `trait OhosApp`（或类似），`RuntimeInitArgs.app: Box<dyn OhosApp>`，隐藏 `OpenHarmonyApp` 具体类型
- **选项 B（接受为合法耦合）**：`RuntimeInitArgs` 本身就是 tauri-runtime 的 OHOS 运行时初始化参数，其类型暴露 ability 类型是运行时集成层的合法耦合

**倾向**：选项 B。`RuntimeInitArgs` 是 tauri-runtime 的 OHOS 特定初始化结构，其 `app` 字段携带 `OpenHarmonyApp` 是运行时集成的自然结果——tauri-runtime 需要知道用什么来初始化 OHOS 运行时。用 trait object 抽象会增加复杂度但收益有限（`RuntimeInitArgs` 仅在 OHOS cfg 下存在，其他平台不受影响）。

**若选择 B**：记录为已知决策，加注释说明"运行时集成层合法耦合"，Phase 5 验收时确认。

**涉及文件**：
- `tauri/crates/tauri-runtime/src/lib.rs:405`

## Risks

| 风险 | 级别 | 缓解 |
|------|------|------|
| 注释中性化遗漏（grep 仍有命中） | 低 | 验收阶段逐文件 grep 确认 |
| re-export 收敛后 tao/tauri 编译失败（缺少类型） | 中 | 收敛后 cargo check 验证，按编译器提示补全 re-export 列表 |
| RuntimeInitArgs.app 抽象引入运行时开销 | 低 | 倾向选项 B（不抽象），避免不必要复杂度 |
| 验收标准遗漏项未检查 | 中 | 对照 §七验收标准逐项 checklist |
