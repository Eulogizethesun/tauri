# Global Shortcut No Response Fix 适配计划

**创建时间**：2026-08-18
**功能描述**：修复 OHOS 上 Ctrl+Shift+T 全局快捷键无反应问题
**判断依据**：涉及 2 个代码层（plugins-workspace ArkTS + Rust），预估 3 个文件，不拆分

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | JS Plugin 修复 + 错误日志增强 | p1-global-shortcut-no-response | ✓ 设计完成 | plugins-workspace (ArkTS + Rust) | 3 | 设备端 hilog 验证 |

## Phase 详细说明

### Phase 1: JS Plugin 修复 + 错误日志增强
- **目标**：(1) 修复 JS Plugin 静默成功 latent bug (2) 增强 Rust 端错误日志以诊断实际根因
- **文件列表**：
  - `plugins-workspace/plugins/global-shortcut/openharmony/src/main/ets/Plugin.ets` — JS Plugin handlers 改为 reject
  - `plugins-workspace/plugins/global-shortcut/src/lib.rs` — 升级 fire-and-forget 错误日志为 error 级别 + 添加 ohos_setup 诊断
  - `tauri/examples/api/src-tauri/gen/ohos/global-shortcut/src/main/ets/Plugin.ets` — 自动重生成
- **依赖**：无
