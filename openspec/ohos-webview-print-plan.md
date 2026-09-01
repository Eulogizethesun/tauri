# OHOS WebView 打印 (ohos-webview-print) 计划

**创建时间**：2026-07-20
**功能描述**：把 wry OHOS `print()` 从空 `Ok(())` no-op 改为真实实现，经 openharmony-ability NAPI 调 ArkTS `print()`，最终调用 OHOS `@kit.PrintKit`（`@ohos.print`）系统打印服务；PrintKit 不可用时降级为复用已有 `create_pdf` 生成 PDF。
**目标设备形态**：OHOS 桌面/大屏（mobile 形态同样适用，打印服务在手机端亦可用）
**判断依据**：`create_pdf` 已实现（archive `2026-06-01-hmos-webview-create-pdf`），`print()` 可复用其 PDF 生成链路；旧 plan Phase 5 标 `○ 待开始`
**目标级别**：完整实现（PrintKit 可用时）+ 显式降级（PrintKit 不可用时映射到 create_pdf）

## 与旧 plan 的关系
`openspec/webview-gap-completion-plan.md` Phase 5「打印」标 `○ 待开始`。本计划取代 Phase 5，细化了：
- 不再「接 OHOS 打印服务 **或** 映射到 create_pdf」二选一悬而未决，而是 **PrintKit 优先 + create_pdf 降级** 的双路径
- 明确 `print()` 复用 `page_loaded` guard（与 `create_pdf` 一致）
- 明确 `print()` 是运行时动作，不需扩展 `WebViewInitData`

## OHOS API 关键未知项
1. **`@kit.PrintKit` (`@ohos.print`) 的 API 形态**：华为文档需现场查证。预期主入口为 `print.print(documentName: string, callback)` 或 `print.printByPrinter(printDocumentAttributes, callback)`。是否接受 PDF 文件路径 / 文件描述符 / URI 是最大未知。
   - 验证方法：`import print from '@ohos.print';` 后 `typeof print.print`；若 import 失败 → 直接走降级路径。
   - 若 PrintKit 接受 `print.PrintDocumentAdapter` 回调流（流式分页），需实现 Adapter；若接受 PDF 文件 fd 则直接复用 create_pdf 产物。
2. **API 版本要求**：`@ohos.print` 起始版本（API 12？13？）。若 > 当前最低支持 API 12，需 `deviceInfo.sdkApiVersion` guard。
3. **ArkWeb 是否原生支持 `window.print()`**：若 ArkWeb 拦截 `window.print()` 并触发系统打印，则最简实现是 `controller.runJavaScript('window.print()')`，无需走 PrintKit。需设备验证。
4. **临时 PDF 路径**：需用 app sandbox cache 目录（`PathResolver.cacheDir` 或 `getContext().cacheDir`），不能硬编码。

## Phase 列表

| Phase | 名称 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|--------|---------|---------|
| 1 | 底层 NAPI + ArkTS print() | openharmony-ability (Rust + ArkTS) | 3 | ability Webview::print 编译；ArkTS print() 可调用 |
| 2 | wry 接通 print() | wry | 1 | wry print() 调 ability print() 而非 no-op |
| 3 | PrintKit 集成或降级 | ArkTS | 1 | 设备端 print() 触发系统打印 / 或降级生成 PDF |
| 4 | 验证 | 全层 | 1 | 手动用例 + 自动回归 |

## Phase 详细说明

### Phase 1: 底层 NAPI + ArkTS print()
- **目标**：
  - `openharmony-ability/crates/ability/src/helper/webview.rs` 增加 `pub fn print(&self) -> Result<()>`，查 `print` named property 并 call。
  - `Utils.ets` `JsHelper` 接口增加 `print: () => void`；`ProxyJsHelper` 增加 `print()` 委托 + pendingOperations 缓存。
  - `DefaultWebview.ets` `buildJsHelper` 返回对象增加 `print` 实现（Phase 3 填充真实逻辑，本 Phase 先放占位 `() => {}` 或直接调 createPdf 降级）。
- **文件**：
  - `openharmony-ability/crates/ability/src/helper/webview.rs`
  - `openharmony-ability/native_ability/src/main/ets/webview/Utils.ets`
  - `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets`
- **未知项**：无（NAPI 模式与 `set_background_color` 一致）

### Phase 2: wry 接通 print()
- **目标**：`wry/src/ohos/mod.rs` `pub fn print(&self) -> crate::Result<()>` 从 `Ok(())` 改为 `self.webview.print().map_err(...)`。
- **文件**：
  - `wry/src/ohos/mod.rs`（line 312-314）
- **依赖**：Phase 1
- **未知项**：无

### Phase 3: PrintKit 集成或降级
- **目标**：`DefaultWebview.ets` `buildJsHelper` 的 `print` 实现：
  1. 检查 `page_loaded`（通过 controller 状态或外部传入标志）—— 若未加载，hilog warn 并返回。
  2. 尝试 `import print from '@ohos.print'`；若失败或 `typeof print.print !== 'function'` → 降级路径：调 `createPdf` 写入 `${cacheDir}/wry_print_<ts>.pdf`，hilog warn，返回。
  3. 否则：调 `createPdf` 生成临时 PDF → 用 `@ohos.print` API 提交打印任务 → 清理临时文件。
- **文件**：
  - `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets`
- **依赖**：Phase 1-2
- **未知项**：见上「关键未知项 1-3」

### Phase 4: 验证
- **目标**：设备端验证 `print()` 触发系统打印对话框（或降级生成 PDF）；新增 `examples/api` `print_test` 命令 + 手动用例。
- **文件**：
  - `tauri/examples/api`（新增命令 + manual_tests.md）
- **依赖**：Phase 1-3
- **未知项**：无

## 状态
- ○ 待开始

## 备注
- 不影响其它平台：`print()` 改动限于 `cfg(target_env = "ohos")`；wry 公共 `WebView::print()` 签名不变
- 铁律遵守：ArkTS 调用经 openharmony-ability，不在 wry 直接调 NAPI
- 复用 `create_pdf` 链路：`PdfConfig` 默认值（A4）已在 `DefaultWebview.ets` 定义，print 直接复用
- 与 `webview-gap-completion-plan.md` Phase 5 的区别：本计划明确「PrintKit 优先 + create_pdf 降级」双路径，不留二选一悬念
