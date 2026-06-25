# Unstable Feature 适配计划

**创建时间**：2026-06-23
**功能描述**：Tauri unstable feature（窗口与 webview 解耦、多 webview、reparent）在 OHOS desktop 上的支持
**判断依据**：涉及 5 个代码层（ArkTS → OHA Rust → wry → tauri-runtime-wry → tauri crate），预估 10 个文件

## OHOS 系统能力验证结论

- ✅ 单窗口多 Web 组件（RustWebviewNodeController 已支持）
- ✅ Web 组件定位 `.position({x, y})`（已使用）
- ✅ Web 组件自定义尺寸 `.width()`/`.height()`（系统支持，代码硬编码 "100%" 待改）
- ✅ 运行时样式更新（`BuilderNode.update()` 已有机制）
- ✅ Web 组件可见性（`.visibility()` + OHA `set_visible` 已实现，wry 未调用）
- ⚠️ bounds 查询：替代方案为 Rust 侧缓存最后设置值
- ❌ true reparent（跨窗口迁移）：BuilderNode 绑定 UIContext，需降级处理（Error 或模拟）

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | 底层 webview 几何能力 | p1-unstable-feature | ✓ 设计完成 | ArkTS + OHA Rust + wry | 5 | 单元测试 + 设备端验证 |
| 2 | 运行时集成与安全防护 | p2-unstable-feature | ✓ 设计完成 | tauri-runtime-wry | 2 | 编译检查 + 死锁防护验证 |
| 3 | tauri API 解除阻塞 | p3-unstable-feature | ✓ 设计完成 | tauri crate | 4 | cargo check + multiwebview example |
| 4 | 前端 API 测试 | p4_unstable-feature | ○ 待开始 | tauri (JS) | 2 | auto test + 设备端测试 |

## Phase 详细说明

### Phase 1: 底层 webview 几何能力
- **目标**：为 OHOS webview 补齐几何操作能力（set_bounds/bounds/set_visible），使 wry 层不再是 no-op
- **文件列表**：
  - `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets` — WebviewStyle 增加 width/height，`.width()`/`.height()` 改用 style 值
  - `openharmony-ability/native_ability/src/main/ets/ability/ArkHelper.ets` — applyStyle 扩展支持 position/size 更新
  - `openharmony-ability/native_ability/src/main/ets/ability/type.ets` — WebviewStyle 接口同步
  - `openharmony-ability/crates/ability/src/helper/webview.rs` — 新增 set_bounds/bounds NAPI 方法，set_visible 接线
  - `wry/src/ohos/mod.rs` — set_bounds/set_visible/bounds 从 no-op 改为实际调用
- **依赖**：无

### Phase 2: 运行时集成与安全防护
- **目标**：tauri-runtime-wry 层补齐 OHOS 的 Reparent 安全返回（防死锁），确认 WebviewBounds 定位链路通畅
- **文件列表**：
  - `tauri-runtime-wry/src/lib.rs` — Reparent handler 为 OHOS 添加安全 Error 返回；WithWebview OHOS 分支
- **依赖**：Phase 1 完成

### Phase 3: tauri API 解除阻塞
- **目标**：移除 tauri crate 层对 OHOS 的 unstable 功能排除，使 add_child/create_webview/reparent 可编译可用
- **文件列表**：
  - `tauri/src/window/mod.rs` — 移除 add_child 的 not(target_env = "ohos") 排除
  - `tauri/src/webview/mod.rs` — reparent 行为确认
  - `tauri/src/webview/plugin.rs` — 确保 create_webview 命令编译通过
  - `tauri/src/lib.rs` — 确认 re-export 和 Manager 方法在 OHOS 可用
- **依赖**：Phase 2 完成

### Phase 4: 前端 API 测试
- **目标**：设计并实现 create_webview、reparent、set_webview_size、set_webview_position 的前端测试
- **文件列表**：
  - 前端测试用例文件（core.ts / plugins.ts 中的测试设计）
  - 设备端验证脚本
- **依赖**：Phase 3 完成
