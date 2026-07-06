# OHOS Permissions 适配计划

**创建时间**：2026-07-03
**功能描述**：为 OHOS 平台实现权限管理插件，对标 `tauri-plugin-macos-permissions`，支持 6 类权限的 check/request
**判断依据**：涉及 4 个代码层，预估 ~25 个文件

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | 插件框架 + Camera/Microphone + stub 权限 | p1-ohos-permissions | ✓ 已归档 | plugins-workspace + tauri-cli templates + examples | ~20 | 设备端测试全部通过 |
| 1 补充 | 辅助功能 stub | p1-ohos-permissions | ● 进行中 | plugins-workspace + examples | ~5 | 设备端测试：check 返回 false + request 空操作 |

## Phase 详细说明

### Phase 1: 插件框架 + Camera/Microphone + stub 权限（已完成）
- **目标**：搭建完整插件骨架，实现 Camera/Microphone 真实权限 + FullDiskAccess/ScreenRecording/InputMonitoring stub
- **已完成**：10 个 API 全部实现并通过测试（235 passed）

### Phase 1 补充: 辅助功能 stub
- **目标**：实现 Accessibility check/request stub（OHOS 三方应用无法注册 AccessibilityExtensionAbility）
- **设计决策**：
  - OHOS `AccessibilityExtensionAbility` 自 API 12 废弃，替代 API 仅限系统应用
  - `isOpenAccessibilitySync()` 检查的是全局辅助功能状态（如屏幕阅读器），非应用级权限
  - macOS 的 `application_is_trusted()` 是"允许此应用控制电脑"，OHOS 无等价概念
  - 因此 stub 为 `check → false`，`request → Ok(())`
- **文件列表**：
  - `plugins-workspace/plugins/ohos-permissions/src/commands/accessibility.rs`
  - `plugins-workspace/plugins/ohos-permissions/src/commands/mod.rs`（更新）
  - `plugins-workspace/plugins/ohos-permissions/build.rs`（更新）
  - `plugins-workspace/plugins/ohos-permissions/src/lib.rs`（更新）
  - `plugins-workspace/plugins/ohos-permissions/guest-js/index.ts`（更新）
  - `plugins-workspace/plugins/ohos-permissions/permissions/default.toml`（更新）
  - `tauri/examples/api/src/lib/tests/plugins.ts`（新增测试）
- **依赖**：无
