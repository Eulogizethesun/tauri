# Implementation Tasks: Phase 5 — 注释清理 + 验收

## 5.1 Tauri 耦合注释清理

- [ ] **5.1** app.rs 注释中性化（8 处）
  - 文件: `openharmony-ability/crates/ability/src/app.rs`
  - `tauri-runtime-wrey event loop` → `consumer event loop`
  - `WindowsStore` → `window store` 或删除
  - `tao ZST WindowId` → `ZST WindowId`
  - `tao reads these values` → `the windowing backend reads these values`

- [ ] **5.2** menu/mod.rs 注释中性化（11 处）
  - 文件: `openharmony-ability/crates/ability/src/menu/mod.rs`
  - `for muda` → `for the menu consumer`
  - `tauri's on_menu_event chain` → `consumer's menu event chain`
  - 其他 muda/tauri 引用中性化

- [ ] **5.3** window/mod.rs 注释中性化（9 处）
  - 文件: `openharmony-ability/crates/ability/src/window/mod.rs`
  - `tao caller` → `the windowing backend caller`
  - `tao's Window::close` → `the windowing backend's Window::close`
  - `wry/WebView` → `the webview backend`

- [ ] **5.4** global_shortcut + version.rs 注释中性化（4+1 处）
  - 文件: `openharmony-ability/crates/ability/src/global_shortcut/mod.rs`（3 处）
  - 文件: `openharmony-ability/crates/ability/src/global_shortcut/event.rs`（1 处）
  - 文件: `openharmony-ability/crates/ability/src/version.rs`（1 处）
  - `AppHandle::run_on_main_thread` → `main thread dispatch`
  - `tauri-plugin-global-shortcut` → `the global-shortcut consumer`
  - Tauri 主仓 UT 路径 → 删除或通用描述

## 5.2 Plugin crate 注释清理

- [ ] **5.5** plugin-menu 注释清理（8 处）
  - 文件: `openharmony-ability/crates/plugin-menu/src/lib.rs`
  - `muda's event listener thread` → `consumer's event listener thread`
  - `tray-icon to bridge` → `consumer bridge`
  - 其他 muda/tray-icon 引用中性化

- [ ] **5.6** plugin-statusbar 注释清理（4 处）
  - 文件: `openharmony-ability/crates/plugin-statusbar/src/lib.rs`
  - `tray-icon's event-forward thread` → `consumer's event-forward thread`
  - `used by tray-icon` → `used by the statusbar consumer`

- [ ] **5.7** plugin-webview 注释清理（6 处）
  - 文件: `openharmony-ability/crates/plugin-webview/src/lib.rs`
  - `installed by wry` → `installed by the webview consumer`
  - `wry's InnerWebView drop` → `consumer's InnerWebView drop`

## 5.3 Re-export 收敛 + RuntimeInitArgs 评估

- [ ] **5.8** N16 tao blanket re-export 收敛
  - 文件: `tao/src/platform/ohos.rs`
  - `pub use openharmony_ability::*;` → `pub use openharmony_ability::{OpenHarmonyApp, ...}`（按需列表）
  - cargo check 验证编译通过

- [ ] **5.9** N16 tauri blanket re-export 收敛
  - 文件: `tauri/crates/tauri/src/ohos.rs`
  - `pub use openharmony_ability;`（或 `::*`）→ 按需 `use` 或仅 re-export 少数类型
  - cargo check 验证编译通过

- [ ] **5.10** N15 RuntimeInitArgs.app 类型评估
  - 文件: `tauri/crates/tauri-runtime/src/lib.rs`
  - 评估 `RuntimeInitArgs.app: openharmony_ability::OpenHarmonyApp` 是否需要 trait object 抽象
  - 记录决策: 接受为运行时集成层合法耦合（倾向选项 B）或 trait 抽象
  - 若接受: 加注释说明"运行时集成层合法耦合"

## 5.4 全量验收

- [ ] **5.11** 注释 grep 验收
  - grep 非版权头 `tauri`/`tao`/`wry`/`muda`/`tray-icon`/`RunEvent`/`AppHandle`/`WindowsStore`/`on_menu_event`/`tauri-plugin-*` 注释
  - 确认命中 = 0
  - 确认版权头（`Copyright` 行）保留

- [ ] **5.12** 全量验收标准逐项检查
  - 对照 §七验收标准逐项 checklist:
    - [ ] Cargo.toml 无 tauri 系依赖
    - [ ] 5 组接缝在通用层消失
    - [ ] 16 项遗漏场景全部处理（N1-N16）
    - [ ] plugin-menu/plugin-statusbar 不再暴露 channel API
    - [ ] ArkHelper.ets 删除或仅保留通用方法
    - [ ] `_legacy/` 目录清空
    - [ ] 通用层经 bridge plugin 暴露能力
    - [ ] Tauri 侧行为不回归
