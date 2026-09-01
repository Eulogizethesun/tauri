# ArkWeb 渲染面 / WebView 尺寸适配计划

**创建时间**：2026-07-14
**完成时间**：2026-07-14
**功能描述**：修复窗口 resize 后 ArkWeb 底部内容缺失的问题。

## 真正的 Bug 与根因

**Bug**：拖动窗口边缘 resize（松手后）底部内容缺失。

**根因**：commit `6fd8c0a`（ljy9810，PR #38）把 Web 组件的 sizing 从 `.width("100%")`（自然 ArkUI 布局）改成 `.width(data.style?.width)`（由 `set_bounds` 设置）。

- `set_bounds` 走 `BuilderNode.update`：只更新 ArkUI 布局树的尺寸约束，**不通知 ArkWeb 渲染内核重算视口**。
- resize 时 Resized handler 调 `set_bounds` → Web 节点尺寸变了，但 ArkWeb 视口没跟着 relayout → 网页按旧视口渲染 → 底部被裁。
- 之前用 `"100%"` 时，Web 跟着 Stack/Window 自然缩放，ArkUI 触发 ArkWeb relayout → 没问题。

**minimize→restore 不受影响**：minimize→restore 不调 set_bounds，ArkWeb 自然 rebind → 正常。（早期误以为是 minimize→restore 问题，是误触 resize 导致的误判。）

## 修复

**Web 组件 sizing 改回 `"100%"`（自然 ArkUI 布局）**，保留 set_bounds 的 `.position`（子窗口定位仍需要）。

- `openharmony-ability` `native_ability/.../webview/DefaultWebview.ets`：WebBuilder / EmbeddedWebBuilder 的 Web 与 Stack 的 `.width/.height` 从 `data.style?.width` 改回 `"100%"`；保留 `.position({x, y})`。
- 撤回 `6fd8c0a` 对 sizing 的改动，保留它对 positioning + NAPI 基础设施的改动。
- set_bounds 仍被调用（定位），其 width/height 数据对主窗口 Web sizing 不再生效（dead data，无害）。

## 误诊的修复（已回退）

早期基于"minimize→restore 需要 reattach"的误诊，做了两处修复，**均已回退**（多余且有害）：

1. **tao** `MainEvent::Start → Event::Resumed`（让 restore 时发 Resumed）—— 已回退为原 TODO stub。minimize→restore 本不需要它。
2. **tauri-runtime-wry** `Event::Resumed → set_bounds` reattach handler —— 已移除。`set_bounds`/`BuilderNode.update` 反而干扰 ArkWeb 自然 rebind，导致 2-cycle 底部缺失。

另：commit `8aac5ed`（`WINDOW_SHOWN→setBounds` 坏块，引用未定义成员导致 HAR 编译失败）也是基于同一误诊的未完成尝试，已删除。

## Phase 列表

| Phase | 名称 | 状态 | 涉及层 | 验证方式 |
|-------|------|------|--------|---------|
| 1 | Web sizing 改回 "100%" 自然布局 | ✓ 已实现并验证 | openharmony-ability | 设备端：resize（松手）后底部不缺失；minimize→restore 正常 |

## 验证结果（2026-07-14，MateBook Pro HAD-W32）

- resize（拖边缘松手）→ 底部不缺失 ✅
- minimize→restore → 正常 ✅（ArkWeb 自然 rebind）
- autotest：245 ✅ / 2 ❌（2 个 pre-existing：#33 RunEvent::Resumed 启动时序、#88 clipboard-manager 无 OHOS HAR），on_new_window / borderless / transparent / createPdf / on_download 全过 ✅
- 子窗口（EmbeddedWebBuilder）同样改为 "100%"，多窗口测试通过。

## 后续注意

- HAR 重建流程：改 openharmony-ability 后必须 `pack.sh` + `tar ability.har` + `ohpm install --all`；`cargo tauri ohos run` 不自动重建 HAR。
- set_bounds 的 width/height 数据对主窗口 Web sizing 不再生效（Web 用 "100%"）；如未来需要精确尺寸控制（非满铺），需另寻不干扰 ArkWeb relayout 的 sizing 机制。
