# Phase B4: tray-icon/muda bridge 适配

## 概述

将 tray-icon 和 muda 的 OHOS 后端从旧的 `openharmony_ability::statusbar::*` / `openharmony_ability::menu::*` 散函数直调模型迁移到 A0 引入的 pluginized bridge 具名契约模型（`bridgeInvoke(pluginId, action, reqType, respType, value, timeout)`）。

A0 merge 后，`openharmony-ability` 引入了 `BridgePlugin` / `BridgeRuntime` / `BridgeClient` 架构，并将原有能力域拆分为独立 plugin crate（`plugin-window`、`plugin-webview` 等）。Phase B4 的目标是让 tray-icon 和 muda 这两个独立仓消费新的 `plugin-statusbar` 和 `plugin-menu` facade，完成消费侧迁移。

## 动机

1. **统一桥接架构**：A0 引入了类型安全、生命周期感知的 bridge 传输层。tray-icon 和 muda 是仅剩两个仍使用旧 `get_named_property` + TSFN 散函数模型的消费方。不迁移会形成架构分裂。
2. **消除全局 TSFN 状态**：旧 `statusbar/manager.rs` 使用 6 个 `static Mutex<Option<TSFN>>` 全局变量，新 bridge 模型通过 `BridgeClient`（cloneable、worker-safe）消除全局可变状态。
3. **生命周期感知**：旧模型无 Ability 生命周期 gating；新模型通过 `BridgeContextRequirement` 确保 tray/menu 操作仅在上下文就绪后执行。
4. **类型安全契约**：旧模型通过 `serde_json::to_string` + TSFN 回调内 `serde_json::from_str` 传递数据，类型不安全。新模型通过 `BridgeNapiType` + `impl_bridge_napi_type!` 在编译期固定 request/response 类型名。
5. **B5 前置依赖**：tauri 集成（B5）需要所有消费方统一在 bridge 模型上，否则 `EntryAbility.bridgePlugins` 注册表不完整。

## 影响范围

### 直接修改的 crate

| Crate | 文件 | 改动类型 |
|-------|------|---------|
| tray-icon | `src/platform_impl/ohos/mod.rs` | 重写所有 `openharmony_ability::statusbar::*` 调用为 `StatusBarClient` bridge call |
| tray-icon | `src/platform_impl/ohos/event.rs` | 重写事件转发线程为 `on_main_thread_event` 接收 |
| tray-icon | `src/platform_impl/ohos/icon.rs` | 无需改动（纯 Rust 数据转换） |
| tray-icon | `Cargo.toml` | 依赖从 `openharmony-ability` (features=menu,statusbar) 改为 `openharmony-ability-plugin-statusbar` |
| muda | `src/platform_impl/ohos/mod.rs` | 重写 `openharmony_ability::menu::*` 调用为 `MenuClient` bridge call |
| muda | `src/platform_impl/ohos/icon.rs` | 无需改动（纯 Rust 数据转换） |
| muda | `Cargo.toml` | 依赖从 `openharmony-ability` (features=menu) 改为 `openharmony-ability-plugin-menu` |

### 前置依赖（A0 产出）

Phase B4 依赖 A0 merge 产出以下尚不存在的 crate（截至审计时 `crates/plugin-statusbar/` 和 `crates/plugin-menu/` 目录不存在）：

| 前置 crate | 对应旧模块 | 说明 |
|-----------|-----------|------|
| `plugin-statusbar` | `ability/src/statusbar/` | 封装 add/remove/update-icon/update-menu/update-tips + icon-click/menu-click 反向事件 |
| `plugin-menu` | `ability/src/menu/` | 封装 set-menubar/popup/set-menubar-visible + menu-click 反向事件 + predefined-action |

如果 A0 未创建这些 crate，B4 需要自行创建（工作量 +2-3 天）。

### 不受影响

- Windows / macOS / Linux 实现（通过 `cfg(target_env = "ohos")` 隔离）
- `tray-icon/src/platform_impl/ohos/icon.rs` 中的 PNG 解码和 RGBA 缩放逻辑（纯 Rust，不涉及 ArkTS 桥接）
- `muda/src/platform_impl/ohos/icon.rs` 中的 `PlatformIcon` 结构（纯数据）
- tray-icon 和 muda 的公共 API 签名（`TrayIcon::new`、`Menu::popup` 等保持不变）
