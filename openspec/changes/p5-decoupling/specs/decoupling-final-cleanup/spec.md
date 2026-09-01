## Requirements

### 注释清理

#### Requirement: Tauri 耦合注释降至 0
All non-copyright-header comments referencing `tauri`/`tao`/`wry`/`muda`/`tray-icon`/`RunEvent`/`AppHandle`/`WindowsStore`/`on_menu_event`/`tauri-plugin-*` SHALL be neutralized (replaced with neutral terminology) or deleted across all files in the repository.

#### Requirement: 版权头保留
Copyright headers (`Copyright 2019-2024 Tauri Programme within The Commons Conservancy`) as Apache-2.0/MIT dual-license legal attribution SHALL be retained and SHALL NOT count as hits in the comment grep verification.

#### Scenario: 注释 grep 命中为 0
- **WHEN** a grep for non-copyright `tauri`/`tao`/`wry`/`muda`/`tray-icon` comments is run across the ability crate and plugin crates
- **THEN** zero hits are returned (excluding copyright headers in files with `Copyright` line)

#### Scenario: app.rs 注释中性化
- **WHEN** `app.rs` comments referencing `tauri-runtime-wry event loop`/`WindowsStore`/`tao ZST WindowId` are reviewed
- **THEN** the references are replaced with neutral terms (e.g., `consumer event loop`, `window store`, `ZST WindowId`)
- **AND** the functional comments retain their technical meaning

#### Scenario: plugin crate 注释清理
- **WHEN** plugin-menu/plugin-statusbar/plugin-webview comments referencing `muda`/`tray-icon`/`wry` are reviewed
- **THEN** the references are replaced with neutral terms (e.g., `consumer`, `the menu consumer`, `the webview consumer`)

### Re-export 收敛

#### Requirement: tao blanket re-export 收敛
The `tao/src/platform/ohos.rs` SHALL replace `pub use openharmony_ability::*;` with an explicit list of only the types that tao actually needs to re-export (e.g., `OpenHarmonyApp`).

#### Requirement: tauri blanket re-export 收敛
The `tauri/crates/tauri/src/ohos.rs` SHALL replace `pub use openharmony_ability;` (or `pub use openharmony_ability::*;`) with an explicit list of only the types that tauri needs to re-export.

#### Scenario: re-export 收敛后编译通过
- **WHEN** the blanket re-exports are replaced with explicit lists
- **THEN** `cargo check` for tao succeeds
- **AND** `cargo check` for tauri succeeds
- **AND** ability internal pub changes do not automatically leak to tao/tauri public API

### 全量验收标准检查

#### Requirement: 验收标准逐项检查
All acceptance criteria from §七 of decoupling-plan-v2.md SHALL be verified item by item, including: comment grep = 0, Cargo.toml dependency check, 5 seam resolution, 16 omission scenario completion, channel API removal, ArkHelper cleanup, `_legacy/` cleanup, and Tauri-side behavior non-regression.

#### Scenario: 5 组接缝在通用层消失
- **WHEN** the 5 seams are reviewed
- **THEN** seam 1 (close queue): neutralized or migrated to tauri-runtime-wry adapter
- **AND** seam 2 (deep-link): old API deleted, tauri side uses DeepLinkClient
- **AND** seam 3 (cursor): tao self-maintained, global variables deleted
- **AND** seam 4 (channel): old channel + GLOBAL_DISPATCHER deleted, plugin crate channel API migrated to muda/tray-icon
- **AND** seam 5 (dispatcher): old API deleted, tauri side uses GlobalShortcutClient

#### Scenario: 16 项遗漏场景全部处理
- **WHEN** the 16 omission scenarios (N1-N16) are reviewed
- **THEN** each scenario has been addressed with a documented decision or implementation

#### Scenario: Tauri 侧行为不回归
- **WHEN** Tauri-side behavior is tested
- **THEN** close batch drain semantics work correctly
- **AND** cursor synchronous read returns correct values
- **AND** deep-link cold start injection works
- **AND** hotkey main thread dispatch works
- **AND** menu/statusBar click chain works
