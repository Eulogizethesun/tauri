# openharmony-ability ↔ Tauri 解耦适配计划

**创建时间**：2026-08-12
**功能描述**：基于 bridge 迁移完成后的代码现状（decoupling-plan-v2.md），将 openharmony-ability 核心仓中的 Tauri 运行时耦合彻底解耦，实现「平台 crate 对 Tauri 零认知、tauri 仓单向依赖」的目标。
**判断依据**：涉及 8 个代码层，预估 49 个文件（去重后）
**前置依赖**：Bridge Architecture Migration（p0-bridge-merge 至 p4-tray-menu-bridge 全部完成）

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 0 | 清理双轨旧代码 | p0-decoupling | ✓ 设计完成 | openharmony-ability, wry | 7 | cargo check + 旧 channel 标 #[deprecated] |
| 1 | Facade 补齐 + Consumer 迁移 | p1-decoupling | ✓ 设计完成 | openharmony-ability plugin crates, plugins-workspace, tao, tauri, window-vibrancy | 15 | cargo check (每个 consumer 独立) |
| 2 | 内部重构 | p2-decoupling | ✓ 设计完成 | openharmony-ability core, tao | 11 | cargo check + cursor/waker 行为回归 |
| 3 | Plugin crate channel 再迁移 | p3-decoupling | ✓ 设计完成 | openharmony-ability plugin crates, muda, tray-icon | 5 | cargo check + 设备端菜单/tray 点击 |
| 4 | ArkHelper 收尾 + N8 泛化 + Menu/Statusbar ArkTS | p4-decoupling | ✓ 设计完成 | openharmony-ability core + ArkTS + plugins, tauri core | ~12 | cargo check + 设备端验证 |
| 5 | 注释清理 + 结构优化 + 验收 | p5-decoupling | ✓ 设计完成 | 全部仓库 | ~14 | 注释 grep=0 + 全量验收标准 |

## 依赖关系

```
Phase 0 (清理双轨旧代码)
    ↓
Phase 1 (Facade 补齐 + Consumer 迁移)
    ↓
Phase 2 (内部重构) ←── Phase 3 (channel 再迁移) 可并行
    ↓
Phase 4 (ArkHelper 收尾)
    ↓
Phase 5 (注释清理 + 验收)
```

**关键约束**：
- Phase 0 → Phase 1：旧 channel 标 deprecated 后才能开始 consumer 迁移（防止新代码误用旧 API）
- Phase 1 → Phase 2：consumer 全部迁到 facade 后才能清理核心 crate 内部（cursor 全局、TSFN 全局等）
- Phase 1 → Phase 4：consumer 全部迁走旧 API 后才能删 ArkHelper 调用链
- Phase 3 可与 Phase 2 并行：plugin crate channel 迁到 muda/tray-icon 不影响内部重构
- **⚠️ 审计发现**：plugin-menu/plugin-statusbar 无 ArkTS 插件（无 MenuPlugin.ets/StatusbarPlugin.ets），需要 menu/statusbar facade 的 consumer（N13 tauri core window、N4 tauri core menu）延迟到 Phase 4

## Phase 详细说明

### Phase 0: 清理双轨旧代码

- **目标**：标记 deprecated、删除死代码、清理空壳 feature
- **改动点**：
  - `menu/mod.rs` 旧 channel 标 `#[deprecated]`（`MENU_EVENT_CHANNEL` + 相关函数）
  - `statusbar/event.rs` 旧 channel 标 `#[deprecated]`（`ICON_CLICK_CHANNEL` + `MENU_CLICK_CHANNEL`）
  - `lib.rs:132-141` 清理旧 channel re-export（全限定调用已零命中）
  - `helper/webview.rs`（970 行死代码）+ `helper/mod.rs:13,25` 的 `#[cfg(feature = "webview")]` 声明删除
  - `ability/Cargo.toml` + `wry/Cargo.toml` 移除 `drag_and_drop` 空壳 feature
- **文件列表**（7 个）：
  - `openharmony-ability/crates/ability/src/menu/mod.rs`
  - `openharmony-ability/crates/ability/src/statusbar/event.rs`
  - `openharmony-ability/crates/ability/src/lib.rs`
  - `openharmony-ability/crates/ability/src/helper/webview.rs`（删除）
  - `openharmony-ability/crates/ability/src/helper/mod.rs`
  - `openharmony-ability/crates/ability/Cargo.toml`
  - `wry/Cargo.toml`
- **依赖**：无
- **验证**：`cargo check --target aarch64-unknown-linux-ohos` 编译通过

### Phase 1: Facade 覆盖度补齐 + Consumer 迁移

- **目标**：补齐 plugin facade 缺口，将所有 consumer 从直调核心 crate 迁移到 plugin facade
- **子步骤**：
  - 1a. plugin-window 补 `set_window_touchable` action（N12 facade 缺口）
  - 1b. plugin-menu 补 `is_menubar_visible` + `set_menu_json` action（N13 facade 缺口）
  - 1c. consumer 迁移（12 个文件，按插件逐个迁移）：
    - deep-link → `DeepLinkClient`
    - single-instance → `DeepLinkClient`
    - autostart → `AutostartClient`
    - clipboard-manager → `ClipboardClient`
    - opener → `OpenerClient`
    - window-vibrancy → `WindowClient`
    - tauri-runtime-wry → `WindowClient`（N11）
    - tao → `WindowClient`（N12）
    - global-shortcut → `GlobalShortcutClient`（N14，含 enum→String 适配）
    - **延迟到 Phase 4**：tauri core window（N13）、tauri core menu（N4）——需要 MenuPlugin.ets ArkTS 插件就位
  - 1d. 删除旧 API：`take_initial_want_uri` / `take_want_parameters` / `INITIAL_WANT_URI` / `init_forwarder` / `DISPATCHER`
- **文件列表**（17 个）：
  - `openharmony-ability/crates/plugin-window/src/lib.rs`
  - `openharmony-ability/crates/plugin-menu/src/lib.rs`
  - `plugins-workspace/plugins/deep-link/src/lib.rs`
  - `plugins-workspace/plugins/single-instance/src/platform_impl/ohos.rs`
  - `plugins-workspace/plugins/global-shortcut/src/lib.rs`
  - `plugins-workspace/plugins/autostart/src/lib.rs`
  - `plugins-workspace/plugins/clipboard-manager/src/desktop.rs`
  - `plugins-workspace/plugins/opener/src/open.rs`
  - `plugins-workspace/plugins/opener/src/reveal_item_in_dir.rs`
  - `window-vibrancy/src/ohos.rs`
  - `tauri/crates/tauri-runtime-wry/src/lib.rs`
  - `tao/src/platform_impl/ohos/mod.rs`
  - `tauri/crates/tauri/src/window/mod.rs`
  - `tauri/crates/tauri/src/menu/plugin.rs`
  - `openharmony-ability/crates/ability/src/app.rs`（删 `take_*` + `INITIAL_WANT_URI`）
  - `openharmony-ability/crates/ability/src/global_shortcut/mod.rs`（删 `init_forwarder` + `DISPATCHER`）
  - `openharmony-ability/crates/ability/src/lib.rs`（清理旧 re-export）
- **依赖**：Phase 0 完成
- **验证**：`cargo check` 每个 consumer crate 独立通过

### Phase 2: 内部重构

- **目标**：清理核心 crate 内部的全局单例耦合、TSFN 遗留、unsoundness
- **改动点**：
  - 接缝 3 cursor：tao 本地缓存 `cursor_x/y` → 删全局 `CURSOR_POSITION_X/Y` + NAPI `update_cursor_position`
  - 接缝 1 close 队列：评估 tauri-runtime-wry 自建队列 vs 中性化注释保留
  - N2 waker：评估 tao EventLoop 自带 waker 可行性
  - N1 `GLOBAL_DISPATCHER`：随接缝 #4 删除
  - N3 TSFN 全局 13 个：随 consumer 迁移完成后删除对应 helper 子模块
  - §3.4 unsoundness 5 处修复（transmute + ptr::read + ManuallyDrop）
- **文件列表**（11 个）：
  - `openharmony-ability/crates/ability/src/app.rs`（cursor 全局 + waker + unsoundness）
  - `openharmony-ability/crates/ability/src/waker.rs`
  - `openharmony-ability/crates/ability/src/menu/event.rs`（GLOBAL_DISPATCHER）
  - `openharmony-ability/crates/ability/src/helper/mod.rs`（GLOBAL_HELPER + unsoundness）
  - `openharmony-ability/crates/ability/src/helper/account.rs`（3 TSFN）
  - `openharmony-ability/crates/ability/src/helper/opener.rs`（2 TSFN）
  - `openharmony-ability/crates/ability/src/helper/autostart.rs`（3 TSFN）
  - `openharmony-ability/crates/ability/src/helper/restart.rs`（1 TSFN）
  - `openharmony-ability/crates/ability/src/helper/permission.rs`（1 TSFN）
  - `openharmony-ability/crates/ability/src/helper/updater.rs`（3 TSFN）
  - `tao/src/platform_impl/ohos/mod.rs`（cursor 本地缓存）
- **依赖**：Phase 1 完成
- **验证**：cargo check + cursor/waker 行为回归

### Phase 3: Plugin crate channel 再迁移

- **目标**：将 plugin-menu/plugin-statusbar 的 consumer-facing channel API 迁到 muda/tray-icon OHOS 适配层
- **改动点**：
  - `menu_event_receiver` / `send_menu_event` → muda `platform_impl/ohos`
  - `icon_click_receiver` / `menu_click_receiver` → tray-icon `platform_impl/ohos`
  - plugin crate 保留 bridge 对接 + 类型契约，删除 consumer-facing channel API
- **文件列表**（5 个）：
  - `openharmony-ability/crates/plugin-menu/src/lib.rs`
  - `openharmony-ability/crates/plugin-statusbar/src/lib.rs`
  - `muda/src/platform_impl/ohos/mod.rs`
  - `tray-icon/src/platform_impl/ohos/event.rs`
  - `tray-icon/src/platform_impl/ohos/mod.rs`
- **依赖**：Phase 1 完成（可与 Phase 2 并行）
- **验证**：cargo check (muda/tray-icon) + 设备端菜单/tray 点击验证

### Phase 4: ArkHelper 收尾 + N8 泛化 + Menu/Statusbar ArkTS 插件

- **目标**：删除旧 ArkHelper 调用链，泛化 ArkTS 层 Tauri 硬编码键名，新建 plugin-account facade，创建 MenuPlugin.ets / StatusbarPlugin.ets ArkTS 插件，迁移延迟的 menu consumer
- **改动点**：
  - **新建 MenuPlugin.ets**：实现 `ohos.menu` ArkTS bridge 插件（set-menubar / popup / set-menubar-visible / execute-predefined action handlers）
  - **新建 StatusbarPlugin.ets**：实现 `ohos.statusbar` ArkTS bridge 插件
  - 注册到 EntryAbility.bridgePlugins
  - 迁移延迟 consumer：tauri core window（N13）+ tauri core menu（N4）
  - 删除 menu 旧 API（`set_menu_json` / `is_menubar_visible` / `start_popup_forwarder` / `MENU_CHANNEL`）
  - `window/mod.rs` 整组方法（20+ 处 `get_helper()` 调用）迁移到 plugin-window bridge 或确认已由 facade 覆盖
  - `clipboard/mod.rs` 迁移到 plugin-clipboard bridge
  - `opener.rs` 迁移到 plugin-url/opener bridge
  - `StatusBarUtils.ets` 解耦 ArkHelper 类型依赖
  - N8 NativeAbility.ets `tauri_window_id`/`tauri_transparent` 泛化为 `ohos_window_id`/`ohos_transparent`
  - N6 huawei-account：新建 plugin-account facade crate（或确认核心特权）
  - 删除 ArkHelper.ets（或仅保留通用能力方法）
- **文件列表**（~12 个，含新增 ArkTS 插件）：
  - `openharmony-ability/plugins/menu/src/main/ets/MenuPlugin.ets`（**新建**）
  - `openharmony-ability/plugins/statusbar/src/main/ets/StatusbarPlugin.ets`（**新建**）
  - `openharmony-ability/demo/entry/src/main/ets/entryability/EntryAbility.ets`（注册新插件）
  - `tauri/crates/tauri/src/window/mod.rs`（N13 延迟迁移）
  - `tauri/crates/tauri/src/menu/plugin.rs`（N4 延迟迁移）
  - `openharmony-ability/crates/ability/src/window/mod.rs`
  - `openharmony-ability/crates/ability/src/clipboard/mod.rs`
  - `openharmony-ability/crates/ability/src/opener.rs`
  - `openharmony-ability/native_ability/src/main/ets/helper/StatusBarUtils.ets`
  - `openharmony-ability/native_ability/src/main/ets/ability/NativeAbility.ets`
  - `openharmony-ability/package/src/main/ets/ability/ArkHelper.ets`
  - `plugins-workspace/plugins/huawei-account/src/ohos.rs`
- **依赖**：Phase 1 + Phase 2 完成
- **验证**：cargo check + 设备端 window/clipboard/opener 功能验证

### Phase 5: 注释清理 + 结构优化 + 验收

- **目标**：Tauri 耦合注释降至 0，re-export 收敛，全量验收标准检查
- **改动点**：
  - ~39 处 Tauri 耦合注释中性化或删除（跨 ~10 文件）
  - plugin crate 注释清理（muda/tray-icon/wry 引用 ~18 处）
  - N15 tauri-runtime `RuntimeInitArgs.app` 类型抽象化评估
  - N16 tao/tauri blanket re-export 收敛为按需 `use`
  - 全量验收标准逐项检查（§七）
- **文件列表**（~14 个，多数为前序 Phase 已改文件的注释清理）：
  - `openharmony-ability/crates/ability/src/app.rs`
  - `openharmony-ability/crates/ability/src/menu/mod.rs`
  - `openharmony-ability/crates/ability/src/window/mod.rs`
  - `openharmony-ability/crates/ability/src/version.rs`
  - `openharmony-ability/crates/ability/src/global_shortcut/mod.rs`
  - `openharmony-ability/crates/ability/src/global_shortcut/event.rs`
  - `openharmony-ability/crates/plugin-menu/src/lib.rs`
  - `openharmony-ability/crates/plugin-statusbar/src/lib.rs`
  - `openharmony-ability/crates/plugin-webview/src/lib.rs`
  - `tauri/crates/tauri-runtime/src/lib.rs`（N15）
  - `tao/src/platform/ohos.rs`（N16）
  - `tauri/crates/tauri/src/ohos.rs`（N16）
  - 其他前序 Phase 涉及文件的注释清理
- **依赖**：Phase 0-4 全部完成
- **验证**：
  - 非版权头 Tauri 注释 grep 命中 = 0
  - 5 组接缝在通用层消失
  - 16 项遗漏场景全部处理
  - Tauri 侧行为不回归
