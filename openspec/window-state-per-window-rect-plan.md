# window-state per-window rect 持久化适配计划

**创建时间**：2026-08-25
**功能描述**：根治 OHOS 窗口状态持久化 bug（主窗口重启缩小到 760×570 at (0,0)），通过 oha
per-window rect 存储 + tao per-key 读取与事件路由 + window-state 插件 save 无条件刷新。
**判断依据**：涉及 3 个代码层（openharmony-ability / tao / window-state 插件），预估 12 个文件。

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | 插件 save 无条件刷新 + main gate | p1-window-state-per-window-rect | ✓ 已归档 | window-state 插件 | 1 | cargo check 双平台 + 真机重启恢复 |
| 2 | oha per-window rect + 子窗口 windowRectChange 注册 + tao per-key 读取 | （同 change，tasks §2） | ✓ 已归档 | oha + tao + ArkTS | 9 | cargo check + 多窗口状态文件核对 |
| 3 | tao 事件按窗口路由 | （同 change，tasks §3） | ✓ 已归档 | tao + runtime-wry | 4 | cargo check + 子窗口 resize 路由验证 |

## Phase 详细说明

### Phase 1: 插件 save 无条件刷新 + main gate（零 ArkTS）
- **目标**：修复主窗口 bug——save 时无条件刷新主窗口 size+position，不依赖 flags 门控/事件缓存。
  Phase 1 临时 gate `label=="main"`（per-window rect 未生效前，避免把主窗口 rect 写进子窗口 state）。
- **文件列表**：`plugins-workspace/plugins/window-state/src/lib.rs`
- **依赖**：无

### Phase 2: oha per-window rect 存储 + 子窗口 windowRectChange 注册 + tao per-key 读取
- **目标**：建立 per-window rect 架构 + 主窗口 windowId 包装 + 子窗口新增 windowRectChange 注册
  （在 WindowManager.createSubWindow，非 attachComponent 透传——子窗口不经过 attachComponent）。
  删除 Phase 1 main gate。
- **文件列表**：`oha/crates/ability/src/app.rs`、`oha/crates/ability/src/lifecycle.rs`、
  `oha/crates/ability/src/event.rs`、`oha/crates/ability/src/area/mod.rs`、
  `oha/native_ability/.../NativeAbility.ets`、`oha/native_ability/.../WindowManager.ets`、
  `oha/native_ability/.../BridgeHost.ets`、`tao/src/platform_impl/ohos/mod.rs`、
  `plugins-workspace/plugins/window-state/src/lib.rs`（删 gate）
- **依赖**：Phase 1 完成（不强制，但便于隔离验证）

### Phase 3: tao 事件按窗口路由
- **目标**：修复事实3（ZST WindowId 致子窗口事件全记主窗口）——WindowId 携带 u64 + window_id_map 注入。
- **文件列表**：`tao/src/platform_impl/ohos/mod.rs`、`tauri/crates/tauri-runtime-wry/src/lib.rs`
- **依赖**：Phase 2 完成

## 状态说明
- `○ 待开始` / `● 进行中` / `✓ 设计完成` / `✓ 已归档`

设计文档：`openspec/changes/p1-window-state-per-window-rect/`（proposal.md / design.md /
specs/ohos-window-state-persistence/spec.md / tasks.md）
