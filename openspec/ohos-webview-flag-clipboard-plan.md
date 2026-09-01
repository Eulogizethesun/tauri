# ohos-webview-flag-clipboard 实施计划

**创建时间**：2026-07-20
**功能描述**：让 wry `with_clipboard(bool)` 在 OHOS 后端生效——flag=false 时拦截剪贴板组合键（Ctrl+C/X/V/A/Z/Y），flag=true 时维持 ArkWeb 原生行为。
**关联 spec**：`openspec/specs/ohos-webview-flag-clipboard/spec.md`
**取代**：`webview-desktop-features` spec 中「R82 Clipboard attribute is always-on」旧决策

## 背景
ArkWeb 默认允许页面剪贴板访问。wry 的 `clipboard` 字段在 `wry/src/ohos/mod.rs:61-84` 解构时落入 `..` catch-all 被丢弃，开发者设 false 无法禁用。`accelerator_matcher.ets` 已有 `CLIPBOARD_ACCELERATORS` 集合用于「菜单加速器跳过剪贴板键」，本计划复用该集合作为拦截源。

## Phase 列表

| Phase | 名称 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|--------|---------|---------|
| 1 | ETS 端 onKeyPreIme 拦截 | ArkTS | 3 | clipboard=false 时 Ctrl+C 不复制 |
| 2 | Rust flag 转发 + NAPI 桥接 | wry+OHA | 4 | WebviewInitData.clipboard 正确传递 |
| 3 | 验证与协调 | 全栈 | 0 | clipboard=true 原生行为 + 与加速器协调 |

## Phase 详细说明

### Phase 1: ETS 端 onKeyPreIme 拦截
- **目标**：在 `MainPage.ets` / `FloatPage.ets` 的 `onKeyPreIme` 中新增剪贴板拦截分支；在 `WebviewInitData` 新增 `clipboard?: boolean` 字段
- **文件列表**：
  - `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets`（`WebviewInitData` 加 `clipboard` 字段）
  - `openharmony-ability/native_ability/src/main/ets/components/MainPage.ets`（onKeyPreIme 加拦截分支）
  - `openharmony-ability/native_ability/src/main/ets/components/FloatPage.ets`（同上，浮窗路径）
- **拦截逻辑**（伪代码）：
  ```ts
  // 在 AcceleratorMatcher.matches 调用之前
  if (event.type === KeyType.Down && data?.clipboard !== true) {
    const combo = buildCombo(event); // ctrl+c / ctrl+x / ...
    if (CLIPBOARD_ACCELERATORS.has(combo)) return true; // 消费，阻止下发 ArkWeb
  }
  ```
- **协调**：与 `AcceleratorMatcher.matches` 既有的 CLIPBOARD_ACCELERATORS 跳过逻辑正交——matcher 总是跳过剪贴板键（返回 false 不触发菜单），拦截器在 flag=false 时消费。两者组合见 spec 协调 Requirement。
- **依赖**：Phase 2 提供 `data.clipboard` 字段；Phase 1 可先用硬编码 false 验证拦截，再接 Phase 2

### Phase 2: Rust flag 转发 + NAPI 桥接
- **目标**：`InnerWebView::new_inner` 显式解构 `clipboard`，经 `WebViewBuilder::clipboard(bool)` → NAPI → ArkTS `WebviewInitData.clipboard`
- **文件列表**：
  - `wry/src/ohos/mod.rs`（解构 `clipboard`，调用 `.clipboard(clipboard)`）
  - `openharmony-ability/crates/ability/src/native_web/mod.rs`（`WebViewBuilder` 加 `clipboard` setter，存入 init data）
  - `openharmony-ability/crates/ability/src/helper/webview.rs`（如需 NAPI 透传，视实现而定）
  - `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets`（`WebviewInitData.clipboard` 字段已在 Phase 1 添加；本 Phase 确认 build 路径透传）
- **依赖**：Phase 1 的 `WebviewInitData.clipboard` 字段定义

### Phase 3: 验证与协调
- **目标**：端到端验证三种场景 + 与菜单加速器协调
- **验证用例**：
  1. `with_clipboard(false)` + 页面选中文本 + Ctrl+C → 剪贴板内容不变
  2. `with_clipboard(true)` + Ctrl+C → 正常复制
  3. `with_clipboard(false)` + 菜单含 Ctrl+C 加速器 + Ctrl+C → 既不复制也不触发菜单（拦截器消费）
  4. `with_clipboard(false)` + Ctrl+F（非剪贴板键） → 正常（不拦截）
  5. 程序化 `@ohos.pasteboard` 读写不受影响
- **依赖**：Phase 1 + Phase 2 完成

## 风险
- ArkUI `onKeyPreIme` 对 Web 组件焦点的覆盖范围：需确认 Web 组件获得焦点时父容器的 onKeyPreIme 仍能收到事件（既有加速器路径已验证此点，剪贴板拦截复用同一入口，风险低）
- `CLIPBOARD_ACCELERATORS` 含 `ctrl+a/z/y`——`ctrl+a`（全选）拦截可能影响文本框全选体验。这是 flag=false 的预期语义（与 Windows `with_clipboard(false)` 一致），但需在文档中明确
