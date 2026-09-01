# ohos-webview-print Specification

## Purpose
为 wry OHOS 的 `print()` 提供真实实现，替换当前的空 `Ok(())` no-op。`print()` SHALL 调用 OHOS 打印服务（`@kit.PrintKit` / `@ohos.print`）打印当前 webview 内容；若打印服务在当前设备/SDK 不可用，SHALL 降级为复用已有 `create_pdf` 生成 PDF 并返回路径提示。

## ADDED Requirements

### Requirement: wry print() SHALL invoke the OHOS print service
`wry` OHOS `InnerWebView::print()` SHALL NOT be a no-op. It SHALL delegate to `openharmony-ability` `Webview::print()`, which SHALL call the ArkTS `print()` method on the JsHelper. The ArkTS `print()` SHALL use OHOS `@kit.PrintKit` (`@ohos.print`) to launch the system print flow for the current webview content.

#### Scenario: print() launches system print dialog
- **WHEN** `webview.print()` is called on OHOS
- **THEN** the system print dialog SHALL be presented to the user (or the default printer job is queued, depending on device)
- **AND** `print()` SHALL return `Ok(())` after the print job is submitted

#### Scenario: print() no longer a no-op
- **WHEN** `webview.print()` is called
- **THEN** the implementation SHALL NOT return `Ok(())` without performing any print action
- **AND** a debug log SHALL be emitted indicating the print path was invoked

### Requirement: ArkTS print() SHALL use OHOS PrintKit
The ArkTS `JsHelper.print()` method SHALL be added to the `JsHelper` interface (`Utils.ets`) and implemented in `buildJsHelper` (`DefaultWebview.ets`). It SHALL call `@ohos.print` with the current page's PDF (generated via the existing `controller.createPdf()` path) as the print input. 

**已确认 API 签名（SDK `.d.ts` 核实，2026-07-20）**：`@ohos.print` 暴露多个 `print` 重载，均接受**文件 URI 数组**（非 fd）：
- `function print(files: Array<string>): Promise<PrintTask>`（无 context，本实现采用此重载——`buildJsHelper` 作用域无 `Context` 访问）
- `function print(files: Array<string>, context: Context): Promise<PrintTask>`（带 context，设备验证若发现无 context 重载不弹打印 UI，则改用此重载并从 `RustWebviewNodeController.uiContext` 取 context）
- 流式重载 `function print(jobName: string, printAdapter: PrintDocumentAdapter, printAttributes: PrintAttributes, context: Context): Promise<PrintTask>` 供按页渲染（本实现不使用）

本实现 SHALL 使用无 context 的 files 重载，将 `createPdf` 生成的临时 PDF 文件 URI 作为 `Array<string>` 传入；打印完成/失败后 SHALL 用 `fileIo.unlinkSync` 清理临时 PDF。

#### Scenario: print via PrintKit with generated PDF
- **WHEN** `print()` is called and the page is fully loaded (`page_loaded == true`)
- **THEN** the ArkTS bridge SHALL generate a PDF via `controller.createPdf()` to a temp file and obtain its file URI
- **AND** SHALL call `@ohos.print` `print(files: Array<string>, context)` with the temp PDF URI（签名 `print(files: Array<string>, context): Promise<PrintTask>`）
- **AND** SHALL clean up the temp file after the print job completes or fails

#### Scenario: print called before page load
- **WHEN** `print()` is called and `page_loaded` is `false`
- **THEN** the implementation SHALL return `Err` with a "Page not fully loaded" message (mirroring `create_pdf`'s guard)
- **AND** SHALL NOT invoke the print service

### Requirement: Fallback to create_pdf when PrintKit is unavailable
If `@ohos.print` is not available on the device（打印服务缺失或 `print.print` 不可调用），`print()` SHALL fall back to invoking the existing `create_pdf` behavior (generate a PDF to a temp path) and return `Ok(())` after writing the file, emitting a `log::warn!` that print degraded to PDF generation.（API 签名已确认存在；设备端是否实际完成打印仍需实机验证，见"待设备验证"。）

#### Scenario: PrintKit unavailable degrades to PDF
- **WHEN** `print()` is called and `@ohos.print` import fails or `print.print` is not a function
- **THEN** the implementation SHALL fall back to `create_pdf` with a default temp path (e.g., `${cacheDir}/wry_print_<timestamp>.pdf`)
- **AND** SHALL emit `log::warn!("[wry] print: PrintKit unavailable, generated PDF at <path>")`
- **AND** SHALL return `Ok(())`

### Requirement: print() SHALL be cfg-gated to OHOS only
The `print()` OHOS implementation SHALL be isolated under `cfg(target_env = "ohos")` and SHALL NOT affect the `print()` implementation of Windows/macOS/Linux/Android/iOS.

#### Scenario: other platforms unaffected
- **WHEN** `webview.print()` is called on Windows/macOS/Linux
- **THEN** the existing platform-specific `print()` implementation SHALL run unchanged
- **AND** no OHOS code path SHALL be compiled in

## MODIFIED Requirements

### Requirement: openharmony-ability Webview SHALL expose print()
`openharmony-ability` `Webview` SHALL add a `print(&self) -> Result<()>` method that calls the ArkTS `print` named property on the JsHelper inner object, mirroring the pattern of `set_background_color`/`clear_all_browsing_data`. The `WebViewInitData` need not change (print is a runtime action, not a build-time attribute).

#### Scenario: ability Webview::print dispatches to ArkTS
- **WHEN** `wry` calls `self.webview.print()`
- **THEN** `openharmony-ability` SHALL look up the `print` property on the inner ObjectRef and call it with no arguments
- **AND** SHALL propagate ArkTS errors as `Error::from_reason`
