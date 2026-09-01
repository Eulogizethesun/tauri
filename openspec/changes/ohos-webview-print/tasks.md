# ohos-webview-print Tasks

- [x] 1. wry `print()`：page_loaded guard + temp 路径 + 调 `Webview::print(path)`
- [x] 2. ability `Webview::print(path: String)` NAPI 方法
- [x] 3. DefaultWebview.ets `printPage(path)`（createPdf → `@ohos.print`）+ import
- [x] 4. Utils.ets JsHelper 接口 + ProxyJsHelper 加 `print`
- [ ] 5. 设备验证：print 触发系统打印；PrintKit 不可用降级

## 真机验证发现（2026-08-06，API 23 desktop）

- [ ] 6. **`webview.print()` JS API 未暴露（FAIL，已修复待重验）**：wry/tauri Rust 侧 `print()` 已实现（wry lib.rs:2107 + ohos/mod.rs:407），但两个问题导致前端调用失败：
  - **根因 1**：`tauri/src/webview/plugin.rs:227` print.js 注入脚本（`window.print = invoke('plugin:webview|print')`）只在 `cfg(macos/ios)` 注入，OHOS 不在内 → `window.print` 未重写。**已修复**：加入 `target_env = "ohos"` 条件。
  - **根因 2**：`manualOhosPrint` 调 `getCurrentWebview().print()`（Webview 类方法），但 Webview JS 类无 print 方法；正确入口是 `window.print()`（print.js 注入的全局函数）。**已修复**：改调 `window.print()`。
  - hilog：`[ManualTest] print() error: TypeError: e(...).print is not a function`
  - **待重验**：重建部署后点 WebView Print 按钮，预期触发 createPdf → @ohos.print 系统打印对话框。

## 二次验证发现（2026-08-06，print.js 修复后）

- [x] 7. **print.js 注入修复验证（PASS）**：`window.print()` 不再报 not a function，全链路执行：
  - wry OHOS print 生成 PDF：`print(/data/storage/el2/base/cache/wry_print_*.pdf)`
  - createPdf 渲染：`OhosPrintManager page 0`
  - @ohos.print 创建任务：`jobId: *_940`
- [x] 8. **print 权限缺失（ErrorCode 201，已修复验证通过）**：`printkit: no permission to access print service`——app 缺 `ohos.permission.PRINT`。
  - **已修复**：tauri-cli 模板 `entry_desktop/src/main/module.json5` + `entry_mobile/src/main/module.json5` 的 `requestPermissions` 加 `ohos.permission.PRINT`。
  - **已验证**：权限通过后打印任务创建成功（`jobId: *_149` + `call client's StartPrint interface`），系统打印对话框弹出。

## 三次修复叠加（2026-08-06）

1. **print.js 注入**（`tauri/src/webview/plugin.rs`）：OHOS 加 `target_env = "ohos"` 到 print.js 注入条件（原只 macOS/iOS）。
2. **PRINT 权限**（tauri-cli 模板 module.json5）：`requestPermissions` 加 `ohos.permission.PRINT`。
3. **printPage 路径转换**（`openharmony-ability DefaultWebview.ets`）：`printKit.print([path])` → `printKit.print([fileUri.getUriFromPath(path)], getContext())`——print 要求 file URI（非绝对路径）+ UIAbilityContext。
- 真机验证（API 23 desktop）：点 WebView Print → 系统打印对话框弹出 ✓
