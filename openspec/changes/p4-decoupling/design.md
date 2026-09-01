# Technical Design: Phase 4 — ArkHelper 收尾

## Context

Phase 1 迁移了大部分 consumer，但依赖 ArkHelper 旧 TSFN 路径的模块（`window/mod.rs`、`clipboard/mod.rs`、`opener.rs`）和依赖 menu/statusbar ArkTS 插件的 consumer（tauri core N13/N4）仍未处理。此外 plugin-menu/plugin-statusbar 缺少 ArkTS 插件（无 MenuPlugin.ets/StatusbarPlugin.ets），导致需要 menu/statusbar facade 的 consumer 延迟到 Phase 4。

Phase 4 收尾这些遗留：创建 MenuPlugin.ets/StatusbarPlugin.ets 补齐 ArkTS 侧，迁移延迟 consumer，删除旧 ArkHelper 调用链，泛化 ArkTS 层 Tauri 硬编码键名，处理 huawei-account facade。

## Goals

- 新建 MenuPlugin.ets：实现 `ohos.menu` ArkTS bridge 插件
- 新建 StatusbarPlugin.ets：实现 `ohos.statusbar` ArkTS bridge 插件
- 迁移延迟 consumer：tauri core window（N13）+ tauri core menu（N4）
- 删除 menu 旧 API（`set_menu_json`/`is_menubar_visible`/`start_popup_forwarder`/`MENU_CHANNEL`/`MENU_CALLBACK`）
- `window/mod.rs` 20+ 处 `get_helper()` 调用迁移或确认已由 plugin-window facade 覆盖
- `clipboard/mod.rs` + `opener.rs` 迁移到 bridge
- `StatusBarUtils.ets` 解耦 ArkHelper 类型
- N8 NativeAbility.ets `tauri_window_id`/`tauri_transparent` 泛化
- N6 huawei-account facade 决策
- 删除 ArkHelper.ets 或仅保留通用能力方法

## Non-Goals

- 不清理 Tauri 耦合注释（Phase 5 负责）
- 不收敛 re-export（Phase 5 负责）
- 不评估 RuntimeInitArgs.app 类型抽象（Phase 5 负责）
- 不影响其他平台实现

## Decisions

### D1 MenuPlugin.ets: 基于 WindowPlugin.ets 模式新建

**决策**：基于现有 `WindowPlugin.ets` 的模式新建 `MenuPlugin.ets`，处理 `set-menubar`/`popup`/`set-menubar-visible`/`execute-predefined` action。

**设计**：
- Plugin ID: `ohos.menu`
- 注册到 `EntryAbility.bridgePlugins`
- Action handlers:
  - `set-menubar`: 接收菜单 JSON，设置窗口菜单栏
  - `popup`: 在指定坐标弹出上下文菜单
  - `set-menubar-visible`: 切换菜单栏可见性
  - `execute-predefined`: 执行预定义菜单动作

**理由**：
- plugin-menu 的 Rust facade 已就绪（Phase 1 补齐了 `is_menubar_visible` + `set_menu_json` action）
- 缺少 ArkTS 侧 bridge 插件导致 N13（tauri core window）和 N4（tauri core menu）延迟
- WindowPlugin.ets 模式已验证可行，复用模式降低实现风险

**涉及文件**：
- `openharmony-ability/plugins/menu/src/main/ets/MenuPlugin.ets`（新建）
- `openharmony-ability/demo/entry/src/main/ets/entryability/EntryAbility.ets`（注册插件）

### D2 StatusbarPlugin.ets: 新建

**决策**：新建 `StatusbarPlugin.ets`，处理 `add`/`remove`/`update-icon`/`update-menu`/`update-tips` action。

**设计**：
- Plugin ID: `ohos.statusbar`
- 注册到 `EntryAbility.bridgePlugins`
- Action handlers:
  - `add`: 创建状态栏图标 + 菜单
  - `remove`: 移除状态栏图标
  - `update-icon`: 更新图标
  - `update-menu`: 更新菜单
  - `update-tips`: 更新提示文本

**理由**：plugin-statusbar Rust facade 已就绪，需要 ArkTS 侧 bridge 插件补齐。

**涉及文件**：
- `openharmony-ability/plugins/statusbar/src/main/ets/StatusbarPlugin.ets`（新建）
- `openharmony-ability/demo/entry/src/main/ets/entryability/EntryAbility.ets`（注册插件）

### D3 window/mod.rs: 确认 facade 覆盖度后删除旧代码

**决策**：确认 `plugin-window` 的 `WindowClient` facade 已覆盖 `window/mod.rs` 全部方法后删除旧代码；不覆盖的方法补 facade action。

**评估流程**：
1. 列出 `window/mod.rs` 中所有 `get_helper()` 调用（20+ 处）
2. 逐一对照 `WindowClient` facade 的 action 列表
3. 覆盖的方法：迁移调用方到 facade
4. 未覆盖的方法：在 plugin-window 补 facade action
5. 全部迁移后删除 `window/mod.rs`（或迁移到 `_legacy/`）

**理由**：`window/mod.rs` 是 ArkHelper 双轨中最大的活跃旧代码模块，其 20+ 处 `get_helper()` 调用是解耦的主要障碍。

**涉及文件**：
- `openharmony-ability/crates/ability/src/window/mod.rs`
- `openharmony-ability/crates/plugin-window/src/lib.rs`（补 action 缺口）

### D4 N8 泛化: tauri_window_id → ohos_window_id

**决策**：将 `NativeAbility.ets` 中的 `tauri_window_id` → `ohos_window_id`，`tauri_transparent` → `ohos_transparent`。

**同步更新**：
- ArkTS 侧读取 want 参数的键名
- Rust 侧传递 want 参数的键名（若有）
- 保证功能等价（仅键名变更）

**理由**：ArkTS 层不应硬编码 Tauri 命名约定。`ohos_window_id`/`ohos_transparent` 是中性命名，任何 OHOS 应用均可使用。

**涉及文件**：
- `openharmony-ability/native_ability/src/main/ets/ability/NativeAbility.ets`
- Rust 侧传递 want 参数的对应代码（若有）

### D5 huawei-account: 评估新建 plugin-account facade vs 核心特权

**决策**：评估华为账号是否为通用 OHOS 能力。若任意 OHOS 应用都可能需要华为账号登录，则新建 `plugin-account` facade crate；若仅 Tauri 应用需要，则确认为核心特权并保留现状。

**评估倾向**：华为账号登录是通用 OHOS 平台能力（非 Tauri 专属），建议新建 `plugin-account` facade crate。

**涉及文件**：
- `plugins-workspace/plugins/huawei-account/src/ohos.rs`
- `plugins-workspace/plugins/huawei-account/src/models.rs`
- 若新建 facade: `openharmony-ability/crates/plugin-account/`（新建 crate）

## Risks

| 风险 | 级别 | 缓解 |
|------|------|------|
| MenuPlugin.ets/StatusbarPlugin.ets 实现引入功能回归 | 中 | 基于 WindowPlugin.ets 验证模式，设备端逐 action 验证 |
| window/mod.rs facade 覆盖度不完整导致遗漏 | 中 | 逐一对照 + cargo check 验证每个迁移步骤 |
| N8 键名变更遗漏同步点（ArkTS/Rust 双侧） | 中 | grep `tauri_window_id`/`tauri_transparent` 确认全部更新 |
| huawei-account facade 新建引入额外维护成本 | 低 | 评估后决定，若新建则复用现有 plugin crate 模式 |
| ArkHelper.ets 删除过早导致功能断裂 | 高 | 先迁移全部活跃调用方，最后删除 ArkHelper.ets |
