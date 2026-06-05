# HMOS Webview createPdf - 网页转 PDF 功能

## Status
**Proposed** - 等待评审

## Summary
在 HarmonyOS (HMOS) 平台上为 Tauri WebView 实现 `createPdf()` 方法，使用 `WebviewController.createPdf()` API 将当前加载的网页转换为 PDF 文件。~~支持用户自定义 PDF 配置参数，未提供时使用默认 A4 配置。~~ 固定使用默认 A4 配置，不暴露 PdfConfig 参数到 tauri 公共 API。

## Motivation
用户需要在 HMOS 设备上实现网页转 PDF 功能。HarmonyOS 从 API version 14 开始提供 `WebviewController.createPdf()` 方法，可以将 Web 组件渲染的内容转换为 PDF 数据流。

## Design Decisions

### 1. 文件路径策略
**选择：Rust 传入目标路径**

```
Rust 侧:
  // ~~webview.create_pdf("/data/storage/myfile.pdf", config)~~
  webview.create_pdf("/data/storage/myfile.pdf", callback)
       │
       ▼
  NAPI 传输路径字符串
       │
       ▼
ArkTS 侧:
  接收路径 → 创建文件 → 写入 PDF 数据
```

**理由：**
- 调用方（Rust）对文件路径有完全控制权
- 可以更好地管理文件命名、组织结构
- 与 Rust 侧的文件管理逻辑保持一致

### 2. 页面就绪保证
**选择：Rust 侧自行保证**

Rust 调用方需要在 `onPageEnd` 回调触发后再调用 `create_pdf()`。ArkTS 层不做额外的加载状态检查。

**理由：**
- 简化 ArkTS 层实现
- Rust 侧已有 `on_page_end` 回调机制
- 避免跨层状态同步的复杂性

### 3. ~~配置参数~~ → 配置参数策略
~~**选择：用户可输入具体配置，未输入时使用默认 A4**~~

~~#### Rust 侧定义~~

~~```rust~~
~~#[derive(Default)]~~
~~pub struct PdfConfig {~~
~~    pub width: Option<f64>,               // 页面宽度（英寸），默认 8.27~~
~~    pub height: Option<f64>,              // 页面高度（英寸），默认 11.69~~
~~    pub margin_top: Option<f64>,          // 上边距（英寸），默认 0~~
~~    pub margin_bottom: Option<f64>,       // 下边距（英寸），默认 0~~
~~    pub margin_left: Option<f64>,         // 左边距（英寸），默认 0~~
~~    pub margin_right: Option<f64>,        // 右边距（英寸），默认 0~~
~~    pub should_print_background: Option<bool>, // 是否打印背景，默认 true~~
~~}~~
~~```~~

~~所有字段均为 `Option`，`None` 表示使用默认值。`PdfConfig` 自身实现 `Default`，`PdfConfig::default()` 等价于全部字段为 `None`。~~

~~#### 调用方式~~

~~```rust~~
~~// 方式 1：不传配置 → 全部使用默认 A4~~
~~webview.create_pdf("/path/to/output.pdf", None, callback)?;~~

~~// 方式 2：传部分配置 → 未指定的字段使用默认值~~
~~webview.create_pdf("/path/to/output.pdf", Some(PdfConfig {~~
~~    width: Some(11.69),   // 横向 A4~~
~~    height: Some(8.27),~~
~~    margin_top: Some(0.5),~~
~~    ..Default::default()  // 其余用默认值~~
~~}), callback)?;~~

~~// 方式 3：传空配置 → 等价于方式 1~~
~~webview.create_pdf("/path/to/output.pdf", Some(PdfConfig::default()), callback)?;~~
~~```~~

~~#### ArkTS 侧默认值合并~~

~~```typescript~~
~~const DEFAULT_PDF_CONFIG: webview.PdfConfiguration = {~~
~~  width: 8.27,              // A4 宽度 (210mm ÷ 25.4)~~
~~  height: 11.69,            // A4 高度 (297mm ÷ 25.4)~~
~~  marginTop: 0,~~
~~  marginBottom: 0,~~
~~  marginRight: 0,~~
~~  marginLeft: 0,~~
~~  shouldPrintBackground: true~~
~~};~~

~~// 合并：用户传入的配置覆盖默认值~~
~~const merged = { ...DEFAULT_PDF_CONFIG, ...userConfig };~~
~~controller.createPdf(merged);~~
~~```~~

~~#### NAPI 传输格式~~

~~Rust `PdfConfig` 序列化为 `HashMap<String, Either<f64, bool>>`，仅包含用户显式设置的字段（`Some` 的值），`None` 的字段不传输，由 ArkTS 侧用默认值补全。~~

~~```~~
~~Rust:  PdfConfig { width: Some(11.69), height: Some(8.27), margin_top: None, ... }~~
~~                                    │~~
~~                                    ▼  NAPI (仅传 Some 字段)~~
~~ArkTS: { width: 11.69, height: 8.27 }~~
~~                                    │~~
~~                                    ▼  合并默认值~~
~~实际:  { width: 11.69, height: 8.27, marginTop: 0, ..., shouldPrintBackground: true }~~
~~```~~

**选择：不暴露 PdfConfig，固定使用默认 A4 配置**

tauri 公共 API 不接受 config 参数，`create_pdf(path, callback)` 只传路径和回调。
PdfConfig 不在任何层级定义或传递。ArkTS 端固定使用内置的 `DEFAULT_PDF_CONFIG`。

#### 调用方式

```rust
webview.create_pdf("/path/to/output.pdf", move |success| {
    println!("PDF: {}", if success { "成功" } else { "失败" });
})?;
```

#### ArkTS 侧固定默认值

```typescript
const DEFAULT_PDF_CONFIG: webview.PdfConfiguration = {
  width: 8.27, height: 11.69, marginTop: 0, marginBottom: 0,
  marginRight: 0, marginLeft: 0, shouldPrintBackground: true
};
controller.createPdf(DEFAULT_PDF_CONFIG);
```

### 4. API 命名
**选择：新增 `create_pdf()` 方法**（而非填充现有的 `print()` 空实现）

**理由：**
- `print()` 语义模糊，可能暗示打印到物理打印机
- `create_pdf()` 语义明确，符合 HarmonyOS API 命名
- 未来可以同时支持 `print()` 和 `create_pdf()`

## Architecture

### 调用链路

```
┌──────────────────────────────────────────────────────────────────┐
│  Rust 调用方                                                      │
│                                                                  │
│  // ~~webview.create_pdf(path, config, callback)~~               │
│  webview.create_pdf(path, callback)  →  Result<()>               │
│    path: &str                                                    │
│    // ~~config: Option<PdfConfig>~~                              │
│    callback: Box<dyn Fn(bool) + Send + 'static>                  │
└────────────┬─────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────────┐
│  wry/src/ohos/mod.rs                                             │
│                                                                  │
│  // ~~InnerWebView::create_pdf(path, config, callback)~~         │
│  InnerWebView::create_pdf(path, callback)                        │
│    // ~~└─ self.webview.create_pdf(path, config, callback)~~     │
│    └─ self.webview.create_pdf(path, callback)                    │
└────────────┬─────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────────┐
│  openharmony-ability/crates/ability/src/helper/webview.rs        │
│                                                                  │
│  // ~~Webview::create_pdf(path, config, callback)~~              │
│  Webview::create_pdf(path, callback)                             │
│    // ~~│  将 PdfConfig 序列化为 HashMap~~                        │
│    // ~~│  通过 NAPI 调用 JsHelper.createPdf(path, configMap, cb)~~│
│    │  通过 NAPI 调用 JsHelper.createPdf(path, cb)                │
│    └─ callback(success: bool)                                    │
└────────────┬─────────────────────────────────────────────────────┘
             │  NAPI (napi-ohos)
             ▼
┌──────────────────────────────────────────────────────────────────┐
│  ArkTS: webview/Utils.ets                                        │
│                                                                  │
│  JsHelper.createPdf(                                             │
│    path: string,                                                 │
│    // ~~config: Record<string, number | boolean>,~~              │
│    callback: (success: boolean) => void                          │
│  )                                                               │
└────────────┬─────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────────┐
│  ArkTS: webview/DefaultWebview.ets                               │
│                                                                  │
│  buildJsHelper() {                                               │
│    // ~~createPdf: (path, config, callback) => {~~               │
│    // ~~  const merged = { ...DEFAULT_PDF_CONFIG, ...config };~~ │
│    // ~~  controller.createPdf(merged)~~                         │
│    createPdf: (path, callback) => {                              │
│      controller.createPdf(DEFAULT_PDF_CONFIG)                    │
│        .then(result => {                                         │
│          const buffer = result.pdfArrayBuffer();                   │
│          const file = fileIo.openSync(path, CREATE|READ_WRITE);  │
│          await fileIo.write(file.fd, buffer);                     │
│          fileIo.closeSync(file);                                 │
│          callback(true);                                         │
│        })                                                        │
│        .catch(err => callback(false))                            │
│    }                                                             │
│  }                                                               │
└──────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: ArkTS 层

#### 1.1 更新 JsHelper 接口
**文件：** `openharmony-ability/native_ability/src/main/ets/webview/Utils.ets`

```typescript
export interface JsHelper {
  // ... existing methods ...
  
  // ~~createPdf: (path: string, config: Record<string, number | boolean>, callback: (success: boolean) => void) => void;~~
  createPdf: (path: string, callback: (success: boolean) => void) => void;
}
```

#### 1.2 更新 ProxyJsHelper
**文件：** `openharmony-ability/native_ability/src/main/ets/webview/Utils.ets`

```typescript
export class ProxyJsHelper implements JsHelper {
  // ... existing methods ...
  
  // ~~createPdf(path: string, config: Record<string, number | boolean>, callback: (success: boolean) => void): void {~~
  // ~~  if (this.realController) {~~
  // ~~    this.realController.createPdf(path, config, callback);~~
  // ~~  } else {~~
  // ~~    this.pendingOperations.push(() => this.realController!.createPdf(path, config, callback));~~
  // ~~  }~~
  // ~~}~~
  createPdf(path: string, callback: (success: boolean) => void): void {
    if (this.realController) {
      this.realController.createPdf(path, callback);
    } else {
      this.pendingOperations.push(() => this.realController!.createPdf(path, callback));
    }
  }
}
```

#### 1.3 在 buildJsHelper 中实现 createPdf
**文件：** `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets`

```typescript
import { fileIo } from '@kit.CoreFileKit';

const DEFAULT_PDF_CONFIG: webview.PdfConfiguration = {
  width: 8.27,              // A4 宽度 (210mm ÷ 25.4)
  height: 11.69,            // A4 高度 (297mm ÷ 25.4)
  marginTop: 0,
  marginBottom: 0,
  marginRight: 0,
  marginLeft: 0,
  shouldPrintBackground: true
};

function buildJsHelper(controller: WebviewController): JsHelper {
  // ... existing methods ...
  
  // ~~const createPdf = (path: string, config: Record<string, number | boolean>, callback: (success: boolean) => void) => {~~
  // ~~  // 合并用户配置与默认值~~
  // ~~  const mergedConfig: webview.PdfConfiguration = { ...DEFAULT_PDF_CONFIG };~~
  // ~~  if (config) {~~
  // ~~    if (config['width'] !== undefined) mergedConfig.width = config['width'] as number;~~
  // ~~    if (config['height'] !== undefined) mergedConfig.height = config['height'] as number;~~
  // ~~    if (config['marginTop'] !== undefined) mergedConfig.marginTop = config['marginTop'] as number;~~
  // ~~    if (config['marginBottom'] !== undefined) mergedConfig.marginBottom = config['marginBottom'] as number;~~
  // ~~    if (config['marginLeft'] !== undefined) mergedConfig.marginLeft = config['marginLeft'] as number;~~
  // ~~    if (config['marginRight'] !== undefined) mergedConfig.marginRight = config['marginRight'] as number;~~
  // ~~    if (config['shouldPrintBackground'] !== undefined) mergedConfig.shouldPrintBackground = config['shouldPrintBackground'] as boolean;~~
  // ~~  }~~
  // ~~  ~~
  // ~~  controller.createPdf(mergedConfig)~~
  const createPdf = (path: string, callback: (success: boolean) => void) => {
    controller.createPdf(DEFAULT_PDF_CONFIG)
      .then((result) => {
        try {
          const buffer = result.pdfArrayBuffer();
          const file = fileIo.openSync(path, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE);
          await fileIo.write(file.fd, buffer);
          fileIo.closeSync(file);
          callback(true);
        } catch (err) {
          hilog.error(DOMAIN, 'DefaultWebview', 'createPdf write failed: %{public}s', JSON.stringify(err));
          callback(false);
        }
      })
      .catch((err) => {
        hilog.error(DOMAIN, 'DefaultWebview', 'createPdf failed: %{public}s', JSON.stringify(err));
        callback(false);
      });
  };
  
  return {
    // ... existing properties ...
    createPdf,
  } as JsHelper;
}
```

### Phase 2: Rust 层

#### ~~2.1 定义 PdfConfig 结构体~~ (已移除)
~~**文件：** `openharmony-ability/crates/ability/src/helper/webview.rs`~~

~~```rust~~
~~use std::collections::HashMap;~~

~~#[derive(Default, Clone, Debug)]~~
~~pub struct PdfConfig {~~
~~    pub width: Option<f64>,~~
~~    pub height: Option<f64>,~~
~~    pub margin_top: Option<f64>,~~
~~    pub margin_bottom: Option<f64>,~~
~~    pub margin_left: Option<f64>,~~
~~    pub margin_right: Option<f64>,~~
~~    pub should_print_background: Option<bool>,~~
~~}~~

~~impl PdfConfig {~~
~~    /// 将 PdfConfig 转换为 HashMap，仅包含 Some 值的字段~~
~~    /// key 使用 camelCase 以匹配 ArkTS 侧的 PdfConfiguration~~
~~    pub fn to_napi_map(&self) -> HashMap<String, Either<f64, bool>> {~~
~~        let mut map = HashMap::new();~~
~~        if let Some(v) = self.width { map.insert("width".to_string(), Either::A(v)); }~~
~~        if let Some(v) = self.height { map.insert("height".to_string(), Either::A(v)); }~~
~~        if let Some(v) = self.margin_top { map.insert("marginTop".to_string(), Either::A(v)); }~~
~~        if let Some(v) = self.margin_bottom { map.insert("marginBottom".to_string(), Either::A(v)); }~~
~~        if let Some(v) = self.margin_left { map.insert("marginLeft".to_string(), Either::A(v)); }~~
~~        if let Some(v) = self.margin_right { map.insert("marginRight".to_string(), Either::A(v)); }~~
~~        if let Some(v) = self.should_print_background { map.insert("shouldPrintBackground".to_string(), Either::B(v)); }~~
~~        map~~
~~    }~~
~~}~~
~~```~~

#### 2.2 在 Webview 中添加 create_pdf 方法
**文件：** `openharmony-ability/crates/ability/src/helper/webview.rs`

```rust
// ~~pub fn create_pdf(~~
// ~~    &self,~~
// ~~    path: &str,~~
// ~~    config: Option<PdfConfig>,~~
// ~~    callback: Box<dyn Fn(bool) + Send + 'static>,~~
// ~~) -> Result<()> {~~
// ~~    if let Some(env) = get_main_thread_env().borrow().as_ref() {~~
// ~~        let config_map = config.unwrap_or_default().to_napi_map();~~
// ~~        let create_pdf_fn = self~~
// ~~            .inner~~
// ~~            .get_value(env)?~~
// ~~            .get_named_property::<Function<~~
// ~~                '_,~~
// ~~                FnArgs<(String, HashMap<String, Either<f64, bool>>, Function<'_, bool, ()>)>,~~
// ~~                (),~~
// ~~            >>("createPdf")?;~~
// ~~        ...~~
// ~~        create_pdf_fn.call((path.to_string(), config_map, cb).into())?;~~

pub fn create_pdf(
    &self,
    path: &str,
    callback: Box<dyn Fn(bool) + Send + 'static>,
) -> Result<()> {
    if let Some(env) = get_main_thread_env().borrow().as_ref() {
        let create_pdf_fn = self
            .inner
            .get_value(env)?
            .get_named_property::<Function<
                '_,
                FnArgs<(String, Function<'_, bool, ()>)>,
                (),
            >>("createPdf")?;

        let cb = env.create_function_from_closure("create_pdf_callback", move |ctx| {
            let success = ctx.try_get::<bool>(0)?;
            let success = match success {
                Either::A(b) => b,
                Either::B(_) => false,
            };
            callback(success);
            Ok(())
        })?;

        create_pdf_fn.call((path.to_string(), cb).into())?;
        Ok(())
    } else {
        Err(Error::from_reason("Failed to get main thread env"))
    }
}
```

#### 2.3 在 InnerWebView 中添加 create_pdf 方法
**文件：** `wry/src/ohos/mod.rs`

```rust
// ~~use openharmony_ability::helper::webview::PdfConfig;~~

// ~~pub fn create_pdf(~~
// ~~    &self,~~
// ~~    path: &str,~~
// ~~    config: Option<PdfConfig>,~~
// ~~    callback: Box<dyn Fn(bool) + Send + 'static>,~~
// ~~) -> Result<()> {~~
// ~~    self.webview~~
// ~~        .create_pdf(path, config, callback)~~

pub fn create_pdf(
    &self,
    path: &str,
    callback: Box<dyn Fn(bool) + Send + 'static>,
) -> Result<()> {
    self.webview
        .create_pdf(path, callback)
        .map_err(|e| Error::OpenHarmonyWebviewError(format!("Failed to create PDF: {}", e)))
}
```

## Usage Example

```rust
// === ~~示例 1：默认 A4 配置~~ → 示例 1：生成 PDF ===
// ~~webview.create_pdf("/data/storage/output.pdf", None, move |success| {~~
webview.create_pdf("/data/storage/output.pdf", move |success| {
    println!("PDF 生成: {}", if success { "成功" } else { "失败" });
}).unwrap();

// === ~~示例 2：横向 A4，带边距~~ → (已移除：不再支持自定义配置) ===
// ~~use openharmony_ability::helper::webview::PdfConfig;~~
// ~~webview.create_pdf("/data/storage/landscape.pdf", Some(PdfConfig {~~
// ~~    width: Some(11.69),~~
// ~~    height: Some(8.27),~~
// ~~    margin_top: Some(0.5),~~
// ~~    ...~~
// ~~}), move |success| { ... }).unwrap();~~

// === ~~示例 3：只改背景打印，其余默认 A4~~ → (已移除) ===
// ~~webview.create_pdf("/data/storage/no-bg.pdf", Some(PdfConfig {~~
// ~~    should_print_background: Some(false),~~
// ~~    ..Default::default()~~
// ~~}), move |success| { ... }).unwrap();~~

// === 完整示例：在页面加载完成后生成 PDF ===
use tauri::Manager;

let app = tauri::Builder::default()
    .setup(|app| {
        let window = app.get_webview_window("main").unwrap();
        let webview = window.webview();
        
        webview.on_page_load(move |event| {
            if event == PageLoadEvent::Finished {
                let output_path = "/data/storage/el2/base/files/output.pdf";
                // ~~webview.create_pdf(output_path, None, move |success| {~~
                webview.create_pdf(output_path, move |success| {
                    if success {
                        println!("PDF 生成成功: {}", output_path);
                    } else {
                        eprintln!("PDF 生成失败");
                    }
                }).unwrap();
            }
        });
        
        Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");
```

## Testing Plan

1. ~~**默认配置测试**~~ → **基础 PDF 生成测试**
   - ~~不传 config（`None`），验证生成 A4 尺寸 PDF~~
   - ~~传空 `PdfConfig::default()`，验证等价于 `None`~~
   - 调用 `create_pdf(path, callback)` 验证生成 A4 尺寸 PDF（固定默认配置）

~~2. **自定义配置测试**~~ (已移除：不再支持自定义配置)
   - ~~只设置 width/height（横向 A4），验证页面方向正确~~
   - ~~设置 margin，验证 PDF 边距符合预期~~
   - ~~设置 shouldPrintBackground=false，验证背景未打印~~
   - ~~部分字段设置 + 部分字段默认，验证合并逻辑正确~~

3. **基础功能测试**
   - 加载简单 HTML 页面后生成 PDF
   - 验证 PDF 文件是否正确生成
   - 检查 PDF 内容是否与网页一致

4. **异步回调测试**
   - 验证回调函数正确触发
   - 测试成功和失败两种情况

5. **文件路径测试**
   - 测试不同路径格式
   - 测试路径不存在时的行为

6. **页面就绪测试**
   - 在 onPageEnd 之前调用（预期失败）
   - 在 onPageEnd 之后调用（预期成功）

7. **性能测试**
   - 生成大型网页的 PDF（多个页面、复杂样式）
   - 测试内存占用和生成时间

## Open Questions

1. **权限要求**
   - 是否需要额外的文件写入权限？
   - 是否需要网络权限（如果网页从网络加载）？

2. **错误处理**
   - 页面未加载完成时调用应该返回什么错误？
   - 文件写入失败时是否需要清理临时文件？

3. **同步 API**
   - 是否需要提供同步版本的 `create_pdf_sync()`？
   - 还是只提供异步回调版本？

## Related
- [使用Web组件保存前端页面为PDF - HarmonyOS 官方文档](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/web-createpdf)
- [WebviewController.createPdf API Reference](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-webview#webviewwebviewcontrollercreatepdf14)
