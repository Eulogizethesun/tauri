## Why

Tauri 的 `unstable` feature 启用窗口与 webview 解耦能力（多 webview、独立定位/尺寸、reparent）。在 OHOS desktop 上，此 feature 完全不可用：`Window::add_child` 被 `not(target_env = "ohos")` 显式排除；wry OHOS 后端的 `set_bounds`/`set_visible`/`bounds` 均为 no-op；`reparent` 运行时 handler 被排除导致调用即死锁。OHOS 系统能力（ArkUI Web 组件）本身支持多 webview、定位、自定义尺寸和运行时样式更新，差距全部在 Tauri 适配层。

## What Changes

- **ArkTS `WebviewStyle` 扩展**：`DefaultWebview.ets` 和 `type.ets` 中的 `WebviewStyle` 接口新增 `width` 和 `height` 字段（`number | string`），`.width()`/`.height()` 从硬编码 `"100%"` 改为读取 style 值（默认 `"100%"` 保持兼容）
- **ArkTS `setBounds` 控制器方法**：`ArkHelper.ets` 的 `createWebview` 和 `createEmbeddedWebview` 中，在 `ret.controller` 上新增 `setBounds(x, y, width, height)` 方法，通过 `applyStyle({ x, y, width, height })` 触发 `updateWebviewStyle` 重渲染
- **OHA Rust NAPI `set_bounds`/`bounds` 方法**：`helper/webview.rs` 的 `Webview` 结构体新增 `set_bounds(&self, x: f64, y: f64, width: f64, height: f64) -> Result<()>` 和 `bounds(&self) -> Result<(f64, f64, f64, f64)>` 方法，遵循现有 `set_visible` 的 NAPI 调用模式
- **wry OHOS `set_bounds`/`set_visible`/`bounds` 实现**：`src/ohos/mod.rs` 中 `set_bounds` 从 no-op 改为调用 `self.webview.set_bounds()`；`set_visible` 从 no-op 改为调用 `self.webview.set_visible()`；`bounds` 从返回默认值改为调用 `self.webview.bounds()`（Rust 侧缓存最后设置值，与 macOS/Windows 行为一致）

## Capabilities

### New Capabilities
- `ohos-webview-bounds`: OHOS webview 几何操作能力（bounds 设置/查询、visible 切换），使 wry OHOS 后端不再是 no-op，为上层 multi-webview 和 unstable feature 提供底层支撑

### Modified Capabilities
（无现有 capability 的需求变更）

## Impact

- **openharmony-ability (ArkTS)**：`DefaultWebview.ets`（WebviewStyle 扩展 + `.width()`/`.height()` 参数化 3 处 + `EmbeddedWebBuilder` 添加 `.position()` + `buildJsHelper` 添加 setBounds 桩）、`ArkHelper.ets`（`setBounds` 控制器方法 2 处）、`Utils.ets`（`JsHelper` 接口 + `ProxyJsHelper` 缓存实现）、`type.ets`（WebviewStyle 接口同步）
- **openharmony-ability (Rust)**：`helper/webview.rs` 新增 `set_bounds`/`bounds` NAPI 方法 + `WebViewStyle` 结构体新增 width/height 字段
- **wry (Rust)**：`src/ohos/mod.rs` 的 `set_bounds`/`set_visible`/`bounds` 从 no-op 改为实际调用 + `bounds_cache` 字段 + 初始 bounds 应用
- **API 兼容性**：不引入新公开 API，仅补齐 wry trait 方法的 OHOS 实现。`WebviewStyle` 新增字段默认 `None`，不影响现有行为
- **向下兼容**：`.width()`/`.height()` 默认回退 `"100%"`，`set_bounds` 调用时才设置具体值，单 webview 场景行为不变
