## Why

Bridge 迁移后，openharmony-ability 的 plugin facade（plugin-window / plugin-menu / plugin-global-shortcut 等）已覆盖大部分能力，但存在 3 个 facade 覆盖度缺口（`set_window_touchable`、`is_menubar_visible`、`set_menu_json`）和 14 个 consumer 仍绕过 facade 直调核心 crate。这阻碍了解耦的最终目标——「所有仓调用鸿蒙系统能力必须经过 plugin facade」。Phase 1 补齐 facade 缺口并将全部 consumer 迁移到 facade，为后续内部重构和旧 API 删除铺路。

## What Changes

- plugin-window 新增 `set-touchable` bridge action + `WindowClient::set_window_touchable()` 方法
- plugin-menu 新增 `is_menubar_visible()` 同步状态查询 + `set_menu_json()` 方法（映射到 `set-menubar` action）
- 14 个 consumer 文件从直调 `openharmony_ability::*` 迁移到对应 plugin facade client
- global-shortcut 全套 API 迁移（~20 处，含 `ShortcutModifier`/`ShortcutKey` enum → `Vec<String>`/`&str` 适配）
- 删除旧 API：`take_initial_want_uri`、`take_want_parameters`、`INITIAL_WANT_URI`、`init_forwarder`、`DISPATCHER`
- **BREAKING**: 删除上述旧 API 后，任何仍引用它们的外部代码将编译失败

## Capabilities

### New Capabilities
- `decoupling-facade-gaps`: 补齐 plugin-window 的 `set_window_touchable` 和 plugin-menu 的 `is_menubar_visible` / `set_menu_json` facade 缺口
- `decoupling-consumer-migration`: 将 14 个 consumer 从直调核心 crate 迁移到 plugin facade，删除旧 API

### Modified Capabilities
（无——facade 缺口补齐是在现有 plugin 内新增 action，不改变已有 spec 级行为）

## Impact

- **plugin-window**：新增 1 个 request type + 1 个 client method + ArkTS 侧 action handler
- **plugin-menu**：新增本地状态缓存 + 2 个 client method（`is_menubar_visible` 同步 / `set_menu_json` 异步）
- **14 个 consumer 文件**：import 和调用点变更，从 `openharmony_ability::*` 切到 `*_plugin::*` facade
- **ability core**：删除 5 个旧 API 符号（`take_initial_want_uri` / `take_want_parameters` / `INITIAL_WANT_URI` / `init_forwarder` / `DISPATCHER`）
- **Cargo.toml**：consumer crates 需添加对应 plugin facade crate 依赖
