# ohos-webview-flag-zoom-hotkeys 实施计划

**创建时间**：2026-07-20
**功能描述**：让 wry `zoom_hotkeys_enabled` 在 OHOS 后端真正禁用缩放热键——flag=false 时拦截 ArkWeb 原生 Ctrl+=/-/0；flag=true 时协调 Tauri JS 注入路径与 ArkWeb 原生路径避免双重缩放。
**关联 spec**：`openspec/specs/ohos-webview-flag-zoom-hotkeys/spec.md`
**取代**：`webview-desktop-features` spec 中「R91 Hotkey zoom works on OHOS desktop」旧结论（仅覆盖 JS 路径，未覆盖 flag=false 缺口）

## 背景
OHOS 桌面端缩放有两路：
1. Tauri 注入 `zoom-hotkey.js`（`crates/tauri/src/manager/webview.rs:562-581`，`cfg(all(desktop, not(target_os = "windows")))`）——已尊重 flag，false 时不注入
2. ArkWeb 原生 Ctrl+=/-/0——不受 flag 控制，flag=false 时仍生效

契约差距 = 第 2 路无法禁用。本计划转发 flag + onKeyPreIme 拦截原生热键。

## Phase 列表

| Phase | 名称 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|--------|---------|---------|
| 1 | ETS 端 onKeyPreIme 拦截 + ZOOM_HOTKEY_ACCELERATORS | ArkTS | 4 | flag=false 时 Ctrl+= 不缩放 |
| 2 | Rust flag 转发 + NAPI 桥接 | wry+OHA | 4 | WebviewInitData.zoomHotkeys 正确传递 |
| 3 | JS/原生双重缩放协调 | tauri | 1 | flag=true 时 Ctrl+= 仅缩放一档 |
| 4 | 验证 | 全栈 | 0 | 三场景 + 程序化缩放不受影响 |

## Phase 详细说明

### Phase 1: ETS 端 onKeyPreIme 拦截
- **目标**：在 `accelerator_matcher.ets` 新增 `ZOOM_HOTKEY_ACCELERATORS` 常量；在 `MainPage.ets` / `FloatPage.ets` 的 `onKeyPreIme` 新增 zoom 拦截分支（仅 desktop）；在 `WebviewInitData` 新增 `zoomHotkeys?: boolean` 字段
- **文件列表**：
  - `openharmony-ability/native_ability/src/main/ets/helper/accelerator_matcher.ets`（新增 `ZOOM_HOTKEY_ACCELERATORS`；`matches` 跳过这些组合键的菜单匹配）
  - `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets`（`WebviewInitData.zoomHotkeys` 字段）
  - `openharmony-ability/native_ability/src/main/ets/components/MainPage.ets`（onKeyPreIme zoom 拦截，门控 `__openharmony_ability_is_desktop__`）
  - `openharmony-ability/native_ability/src/main/ets/components/FloatPage.ets`（同上）
- **拦截逻辑**（伪代码）：
  ```ts
  if (event.type === KeyType.Down && this.isDesktop && data?.zoomHotkeys !== true) {
    const combo = buildCombo(event);
    if (ZOOM_HOTKEY_ACCELERATORS.has(combo)) return true;
  }
  ```
- **依赖**：Phase 2 提供 `data.zoomHotkeys`；Phase 1 可先硬编码 false 验证

### Phase 2: Rust flag 转发 + NAPI 桥接
- **目标**：`InnerWebView::new_inner` 显式解构 `zoom_hotkeys_enabled`，经 `WebViewBuilder::zoom_hotkeys_enabled(bool)` → NAPI → ArkTS `WebviewInitData.zoomHotkeys`
- **文件列表**：
  - `wry/src/ohos/mod.rs`（解构 `zoom_hotkeys_enabled`，调用 `.zoom_hotkeys_enabled(...)`）
  - `openharmony-ability/crates/ability/src/native_web/mod.rs`（`WebViewBuilder` 加 setter）
  - `openharmony-ability/crates/ability/src/helper/webview.rs`（如需 NAPI 透传）
  - `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets`（build 路径透传）
- **依赖**：Phase 1 的 `WebviewInitData.zoomHotkeys` 字段定义

### Phase 3: JS/原生双重缩放协调
- **目标**：flag=true 时避免 `zoom-hotkey.js` 与 ArkWeb 原生同时缩放
- **文件列表**：
  - `tauri/crates/tauri/src/manager/webview.rs`（OHOS desktop 短路 JS 注入，方案 A；或 `zoom-hotkey.js` 模板加 `os_name === "ohos"` 早退，方案 B）
- **决策**：推荐方案 A（OHOS desktop 不注入 JS，完全依赖 ArkWeb 原生 + `controller.zoom()` 程序化 API），因 ArkWeb 原生已覆盖 Ctrl+=/-/0
- **依赖**：Phase 1 + Phase 2

### Phase 4: 验证
- **验证用例**：
  1. `zoom_hotkeys_enabled=false` + OHOS desktop + Ctrl+= → 不缩放
  2. `zoom_hotkeys_enabled=true` + OHOS desktop + Ctrl+= → 缩放一档（非两档）
  3. `zoom_hotkeys_enabled=false` + 程序化 `webview.zoom(1.5)` → 正常缩放
  4. `zoom_hotkeys_enabled=false` + Ctrl+C（非 zoom 键） → 不拦截
  5. mobile 形态 + `zoom_hotkeys_enabled=false` + Ctrl+= → 不拦截（mobile 不门控）
- **依赖**：Phase 1-3 完成

## 风险
- ArkWeb 原生 Ctrl+=/-/0 的 keyCode/keyText 需确认与 `accelerator_matcher.getKeyText` 归一化输出匹配（`=`、`-`、`0`）。若 OHOS 返回 `KEYCODE_EQUALS` 等需在 SPECIAL_KEY_MAP 加映射
- 方案 A 短路 JS 注入会改变 OHOS desktop 既有行为（原本 JS 路径生效），需确认 ArkWeb 原生缩放级别与 JS 路径 `set_webview_zoom` IPC 的级别语义一致（`controller.zoom(factor)` vs JS `document.body.style.zoom`）
- 若既有用户依赖 JS 路径的 `set_webview_zoom` IPC 命令，方案 A 移除后需评估兼容性
