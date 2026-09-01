## Context

Bridge 迁移为 openharmony-ability 引入了 plugin facade 架构（`plugin-window`、`plugin-menu`、`plugin-global-shortcut` 等），但 3 个 facade 覆盖度缺口和 14 个 consumer 绕过 facade 直调核心 crate 的模式仍未解决。这导致：
- 旧 API 无法删除（仍有消费者）
- 核心 crate 对 Tauri 运行时的隐式耦合无法解除
- 解耦验收标准中 16 项遗漏（N1-N16）的大部分无法推进

### 现有 Facade 模式

每个 plugin facade 遵循统一模式：
- Rust 侧：`BridgePlugin` trait 实现 + `BridgeNapiType` request/response 类型 + `*Client` 异步 facade
- ArkTS 侧：plugin 组件处理 bridge action 并调用 OHOS API
- 传输层：`bridgeInvoke(pluginId, action, reqType, respType, value)` 类型安全传输

## Goals / Non-Goals

**Goals:**
- 补齐 plugin-window 的 `set_window_touchable` action（N12 facade 缺口）
- 补齐 plugin-menu 的 `is_menubar_visible`（同步）和 `set_menu_json`（异步）方法（N13 facade 缺口）
- 将全部 14 个 consumer 从直调核心 crate 迁移到 plugin facade
- 删除旧 API：`take_initial_want_uri` / `take_want_parameters` / `INITIAL_WANT_URI` / `init_forwarder` / `DISPATCHER`
- 确保每个 consumer 迁移后 `cargo check` 独立通过

**Non-Goals:**
- 不重构核心 crate 内部结构（Phase 2）
- 不迁移 plugin crate 的 channel API 到 muda/tray-icon（Phase 3）
- 不删除 ArkHelper 调用链（Phase 4）
- 不清理 Tauri 耦合注释（Phase 5）

## Decisions

### D1: `set_window_touchable` — 标准 bridge action 模式

**选择**：新增 `WindowTouchableRequest` 类型 + `set-touchable` action + `WindowClient::set_window_touchable()` 方法

**理由**：
- 与现有 `set_window_focusable`（`WindowFocusableRequest` + `set-focusable`）模式完全一致
- ArkTS 侧 `setWindowTouchable` 已在 `WindowPlugin.ets` 中实现（旧 TSFN 路径），只需添加 bridge action 路由
- 签名 `(window_id: i64, touchable: bool)` 与 `WindowFocusableRequest` 相同，可考虑复用类型——但保持独立类型以维持语义清晰

**替代方案**：复用 `WindowFocusableRequest` 并改名 `WindowBoolRequest` → 破坏已有类型名稳定性（`ohos.window.FocusableRequest` 已对外暴露）

### D2: `is_menubar_visible` — Rust 本地状态缓存（非 bridge 查询）

**选择**：在 plugin-menu crate 内维护 `LazyLock<RwLock<HashMap<String, bool>>>` 状态缓存，`set_menubar_visible` 时更新缓存，`is_menubar_visible` 从缓存读取

**理由**：
- `is_menubar_visible` 在 tauri core 中是同步调用（`window/mod.rs:1510`），bridge action 是异步的，无法直接替代
- 状态完全由 Rust 侧控制（`set_menubar_visible` 和 `set_menu_json` 都从 Rust 发起），无需从 ArkTS 查询
- 当前 `menu/mod.rs:133` 的实现已是纯 Rust 状态查询（读 `MENUBAR_VISIBLE` + `MENU_HAS_CONTENT`），只需将状态移到 plugin-menu crate

**实现细节**：
- `is_menubar_visible(window_id) = menubar_visible.get(window_id) && menu_has_content.get(window_id)`
- `set_menubar_visible` 更新 `menubar_visible` 缓存
- `set_menu_json` 更新 `menu_has_content` 缓存（JSON != "[]" 时为 true）
- 默认值为 true（与当前行为一致）

### D3: `set_menu_json` — 映射到现有 `set-menubar` action

**选择**：`MenuClient::set_menu_json(json_data, window_id)` 内部调用 `set-menubar` action（与 `set_menubar` 共享 ArkTS handler）

**理由**：
- 当前 `set_menu_json`（`menu/mod.rs:243`）和 `set_menubar` 功能相同：将 menu JSON 推送到 ArkTS 侧渲染
- 区别仅在旧 API 通过 `MENU_CHANNEL` + forwarder TSFN 路径，新 API 直接走 bridge
- ArkTS 侧的 `set-menubar` handler 已处理 JSON 更新逻辑，无需新建 action

**签名适配**：
- 旧：`set_menu_json(json_data: String, window_id: String)` — 直接传 String
- 新：`set_menu_json(json_data: String, window_id: String)` → 内部构造 `MenuSetMenubarRequest { json_data, window_id }`

### D4: Consumer 迁移顺序

**选择**：按依赖复杂度分 3 批迁移

**批次**：
1. **低成本迁移**（facade 已就绪，仅改 import + 调用点）：deep-link、single-instance、autostart、clipboard-manager、opener、window-vibrancy
2. **中成本迁移**（需 facade 缺口补齐后迁移）：tao（N12）、tauri-runtime-wry（N11）、tauri core window（N13）、tauri core menu（N4）
3. **高成本迁移**（整条 API 管线重写）：global-shortcut（N14，~20 处 + enum→String 适配）

### D5: Global-shortcut enum→String 适配

**选择**：在 consumer 迁移层添加 `ShortcutModifier`/`ShortcutKey` → `Vec<String>`/`&str` 转换函数

**理由**：
- 旧 API 使用 `ShortcutModifier` enum + `ShortcutKey` enum
- 新 `GlobalShortcutClient::register` 接受 `Vec<String>` 修饰键 + `&str` key
- 转换逻辑：`ShortcutModifier::Control → "Control"`, `ShortcutKey::KeyA → "A"` 等
- 在 `plugins-workspace/plugins/global-shortcut/src/lib.rs` 内实现，不影响 facade API

## Risks / Trade-offs

- **[⚠️ 审计发现：menu/statusbar 无 ArkTS 插件]** `plugin-menu` 和 `plugin-statusbar` 的 Rust facade 已创建，但 `plugins/` 目录下无 `MenuPlugin.ets` / `StatusbarPlugin.ets`，demo `EntryAbility.ets` 的 `bridgePlugins` 也未注册。**`MenuClient` / `StatusBarClient` 的 bridge 调用在 ArkTS 侧无 handler，运行时会失败。**
  → **缓解方案**：Phase 1 中需要 menu facade 的 consumer（tauri core window N13、tauri core menu N4）**延迟迁移**到 Phase 4（ArkHelper 收尾阶段创建 MenuPlugin.ets/StatusbarPlugin.ets 后迁移）。Phase 1 仅迁移不依赖 menu/statusbar facade 的 consumer
  → **影响范围**：tasks 3.3（tauri core window）和 3.4（tauri core menu）移到 Phase 4；tasks 1.3-1.5（plugin-menu 状态缓存）保留——Rust 侧准备就绪，等 ArkTS 插件就位后即可使用
- **[is_menubar_visible 状态漂移]** 缓存可能与 ArkTS 侧实际状态不一致（如 ArkTS 侧独立修改了 visibility） → 当前实现中 ArkTS 不会独立修改 visibility，风险可控；若未来需要双向同步，可添加 bridge action 查询
- **[global-shortcut 适配工作量]** ~20 处调用 + enum 转换层 → 单独作为 Phase 1 中最大的迁移项，需充分测试
- **[旧 API 删除时机]** 删除 `take_initial_want_uri` 等旧 API 必须在所有 consumer 迁移完成后 → 作为 Phase 1 的最后步骤执行。注意：menu 旧 API（`set_menu_json`/`is_menubar_visible`/`start_popup_forwarder`）延迟到 Phase 4 删除
- **[consumer Cargo.toml 变更]** 每个 consumer crate 需添加对应 plugin facade crate 依赖 → 增加 workspace 内部依赖图复杂度
