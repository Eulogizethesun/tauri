# Technical Design: HarmonyOS WebView createPdf

## 架构概览

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tauri App (Rust)                         │
│                                                                 │
│  wry/src/ohos/mod.rs                                            │
│  ┌─────────────────┐                                            │
│  │  InnerWebView   │── create_pdf() ──→ Result<()>              │
│  │                 │── eval(), zoom(), load_url() ...           │
│  └────────┬────────┘                                            │
│           │ 调用 Webview 的方法                                   │
│           ▼                                                     │
│  openharmony-ability/crates/ability/src/helper/webview.rs       │
│  ┌─────────────────┐                                            │
│  │    Webview       │── 通过 NAPI ObjectRef 调用 ArkTS 函数       │
│  │   (Rust struct)  │── getUrl, loadUrl, zoom, refresh ...      │
│  └────────┬────────┘   ⬆ 新增 createPdf                         │
└───────────┼─────────────────────────────────────────────────────┘
            │  NAPI 桥接 (napi-ohos)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ArkTS 层 (HarmonyOS)                          │
│                                                                 │
│  webview/Utils.ets                                              │
│  ┌─────────────────┐                                            │
│  │    JsHelper     │── 接口定义：getUrl, loadUrl, zoom ...       │
│  │   (interface)   │   ⬆ 新增 createPdf                         │
│  └─────────────────┘                                            │
│                                                                 │
│  webview/DefaultWebview.ets                                     │
│  ┌─────────────────┐                                            │
│  │ buildJsHelper() │── 构建 JsHelper 实现，绑定到                  │
│  │                 │   WebviewController 的真实方法               │
│  └────────┬────────┘                                            │
│           ▼                                                     │
│  ┌─────────────────────────┐                                    │
│  │  WebviewController      │ ← createPdf() 在这里！              │
│  │  (@ohos.web.webview)    │   API version 14+                  │
│  └─────────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 数据流

### 调用链路

```
~~Tauri App (Rust)~~
~~  webview.create_pdf("/path/to/output.pdf", config, callback)~~
~~       │~~
~~       ▼~~
~~wry InnerWebView::create_pdf(path, config, callback)~~
~~       │~~
~~       ▼~~
~~openharmony-ability Webview::create_pdf(path, config, callback)~~
~~       │  PdfConfig → HashMap<camelCase keys> → NAPI~~
~~       ▼~~
~~ArkTS JsHelper.createPdf(path, configMap, callback)~~
~~       │  { ...DEFAULT_PDF_CONFIG, ...configMap }~~
~~       ▼~~
~~controller.createPdf(merged) → PdfData → pdfArrayBuffer() → fileIo.write → callback(true/false)~~

Tauri App (Rust)
  webview.create_pdf("/path/to/output.pdf", callback)
       │
       ▼
wry InnerWebView::create_pdf(path, callback)
       │
       ▼
openharmony-ability Webview::create_pdf(path, callback)
       │  NAPI
       ▼
ArkTS JsHelper.createPdf(path, callback)
       │  固定使用 DEFAULT_PDF_CONFIG (A4)
       ▼
controller.createPdf(DEFAULT_PDF_CONFIG) → PdfData → pdfArrayBuffer() → fileIo.write → callback(true/false)
```

~~### 配置参数流转~~
~~```~~
~~Rust 调用方:~~
~~  create_pdf("/path/to/out.pdf", Some(PdfConfig {~~
~~    width: Some(11.69),       // 横向 A4~~
~~    height: Some(8.27),~~
~~    ..Default::default()      // 其余用默认值~~
~~  }))~~

~~       │~~
~~       ▼  NAPI 传输 (HashMap<String, Either<f64, bool>>)~~

~~ArkTS 侧接收:~~
~~  createPdf(path, { width: 11.69, height: 8.27 }, callback)~~
~~  ~~
~~       │~~
~~       ▼  合并默认值~~

~~实际调用:~~
~~  controller.createPdf({~~
~~    width: 11.69,~~
~~    height: 8.27,~~
~~    marginTop: 0,         ← 默认值补全~~
~~    marginBottom: 0,~~
~~    marginRight: 0,~~
~~    marginLeft: 0,~~
~~    shouldPrintBackground: true~~
~~  })~~
~~```~~

## 核心设计决策

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
PdfConfig 不在任何层级定义或传递。ArkTS 端固定使用内置的 `DEFAULT_PDF_CONFIG`（A4 尺寸，无页边距，打印背景）。

**理由：**
- 简化全链路：无需在 openharmony-ability → wry → tauri 三层定义和透传 config
- tauri 公共 API 保持简洁，只接受 `path` + `callback`
- 默认 A4 配置满足当前需求

#### 调用方式

```rust
// 全链路统一签名：path + callback
webview.create_pdf("/path/to/output.pdf", move |success| {
    println!("PDF 生成: {}", if success { "成功" } else { "失败" });
})?;
```

#### ArkTS 侧固定默认值

```typescript
const DEFAULT_PDF_CONFIG: webview.PdfConfiguration = {
  width: 8.27,              // A4 宽度 (210mm ÷ 25.4)
  height: 11.69,            // A4 高度 (297mm ÷ 25.4)
  marginTop: 0,
  marginBottom: 0,
  marginRight: 0,
  marginLeft: 0,
  shouldPrintBackground: true
};

// 直接使用默认配置，不接收外部参数
controller.createPdf(DEFAULT_PDF_CONFIG);
```

### 4. API 命名

**选择：新增 `create_pdf()` 方法**（而非填充现有的 `print()` 空实现）

**理由：**
- `print()` 语义模糊，可能暗示打印到物理打印机
- `create_pdf()` 语义明确，符合 HarmonyOS API 命名
- 未来可以同时支持 `print()` 和 `create_pdf()`

## API 签名

### Rust 侧

```rust
// ~~wry::InnerWebView~~
// ~~pub fn create_pdf(~~
// ~~    &self, ~~
// ~~    path: &str,~~
// ~~    config: Option<PdfConfig>,~~
// ~~    callback: Box<dyn Fn(bool) + Send + 'static>~~
// ~~) -> Result<()>~~

// wry::InnerWebView (updated: 移除 PdfConfig)
pub fn create_pdf(
    &self, 
    path: &str,
    callback: Box<dyn Fn(bool) + Send + 'static>
) -> Result<()>

// tauri::Webview (未变)
pub fn create_pdf(
    &self,
    path: impl AsRef<std::path::Path>,
    callback: impl Fn(bool) + Send + 'static
) -> crate::Result<()>
```

### ArkTS 侧

```typescript
// ~~JsHelper 接口~~
// ~~createPdf: (~~
// ~~    path: string,~~
// ~~    config: Record<string, number | boolean>,~~
// ~~    callback: (success: boolean) => void~~
// ~~) => void~~

// JsHelper 接口 (updated: 移除 config 参数)
createPdf: (
    path: string,
    callback: (success: boolean) => void
) => void
```

## 关键设计细节

### 异步回调模式

参考现有的 `runJavaScript` 模式——它是目前 JsHelper 里唯一用 callback 的方法：

```
现有 runJavaScript 的模式:

Rust 侧:
  evaluate_script_with_callback(js, callback)
    → 取 "runJavaScript" 函数
    → 创建一个 NAPI closure 作为 callback
    → 调用 runJavaScript(code, cb)

ArkTS 侧 (buildJsHelper):
  runJavaScript: (code, cb) => {
    controller.runJavaScript(code).then(ret => cb(ret))
                                  .catch(err => cb(undefined))
  }
```

`createPdf` 完全复用这个模式：

```
ArkTS 侧:
  // ~~createPdf: (path, config, cb) => {~~
  // ~~  const mergedConfig = { ...DEFAULT_PDF_CONFIG, ...config };~~
  // ~~  controller.createPdf(mergedConfig)~~
  createPdf: (path, cb) => {
    controller.createPdf(DEFAULT_PDF_CONFIG)
      .then(result => {
        写文件...
        cb(true)
      })
      .catch(err => cb(false))
  }

Rust 侧:
  // ~~Webview::create_pdf(path, config, callback)~~
  // ~~  → 取 "createPdf" 函数~~
  // ~~  → 创建 NAPI closure~~
  // ~~  → 调用 createPdf(path, configMap, cb)~~
  Webview::create_pdf(path, callback)
    → 取 "createPdf" 函数
    → 创建 NAPI closure
    → 调用 createPdf(path, cb)
```

### 文件写入策略

```typescript
controller.createPdf(mergedConfig)
  .then((result) => {
    try {
      const buffer = result.pdfArrayBuffer();
      const file = fileIo.openSync(path, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE);
      try {
        await fileIo.write(file.fd, buffer);
        callback(true);
      } catch (writeErr) {
        hilog.error(DOMAIN, 'DefaultWebview', 'createPdf write failed: %{public}s', JSON.stringify(writeErr));
        callback(false);
      } finally {
        fileIo.closeSync(file);  // 确保文件句柄释放
      }
    } catch (err) {
      hilog.error(DOMAIN, 'DefaultWebview', 'createPdf file IO failed: %{public}s', JSON.stringify(err));
      callback(false);
    }
  })
```

### WebviewController 的访问

`createPdf` 是 `WebviewController` 上的方法，当前代码中 `WebviewController` 实例被封装在 `WebviewNodeData` 里：

```typescript
DefaultWebview.ets:
  
  WebviewNodeData {
    controller: WebviewController   ← 这里持有真实实例
  }
  
  buildJsHelper(controller: WebviewController): JsHelper {
    // ← controller 已经作为参数传入了，直接可用！
    // 现有方法 controller.getUrl(), controller.runJavaScript() 都是这样用的
    // createPdf 也一样：controller.createPdf(config)
  }
```

`buildJsHelper` 已经接收了 `controller` 参数，所以 `createPdf` 的实现和其他方法完全一致，不需要额外的架构调整。

### ProxyJsHelper 支持

`ProxyJsHelper` 也需要加上 `createPdf` 的代理实现。当 `WindowManager` 还没就绪时，Rust 拿到的是 `ProxyJsHelper`。如果不加，在窗口未就绪时调用 `createPdf` 会直接失败：

```typescript
ProxyJsHelper {
  // ~~createPdf(path, config, callback) {~~
  // ~~  if (this.realController) {~~
  // ~~    this.realController.createPdf(path, config, callback);~~
  // ~~  } else {~~
  // ~~    // 缓存到 pendingOperations~~
  // ~~    this.pendingOperations.push(() => this.realController!.createPdf(path, config, callback));~~
  // ~~  }~~
  // ~~}~~
  createPdf(path, callback) {
    if (this.realController) {
      this.realController.createPdf(path, callback);
    } else {
      this.pendingOperations.push(() => this.realController!.createPdf(path, callback));
    }
  }
}
```

## 修改文件清单

### ArkTS 层 (4 文件)

| 文件 | 改动 |
|------|------|
| `native_ability/src/main/ets/webview/Utils.ets` | JsHelper 接口 + ProxyJsHelper 新增 `createPdf` |
| `native_ability/src/main/ets/webview/DefaultWebview.ets` | `DEFAULT_PDF_CONFIG` + `createPdf` 实现 + fileIo import |
| `package/src/main/ets/webview/Utils.ets` | 同上 (package 副本，.gitignore 忽略) |
| `package/src/main/ets/webview/DefaultWebview.ets` | 同上 (package 副本，.gitignore 忽略) |

### Rust 层 (6 文件)

| 文件 | 改动 |
|------|------|
| ~~`crates/ability/src/helper/webview.rs`~~ | ~~`PdfConfig` 结构体 + `to_napi_map()` + `Webview::create_pdf()`~~ |
| `crates/ability/src/helper/webview.rs` | ~~`PdfConfig` 结构体~~ `Webview::create_pdf()` (不传 config，NAPI 只传 path + callback) |
| ~~`wry/src/ohos/mod.rs`~~ | ~~`InnerWebView::create_pdf()` + PdfConfig re-export~~ |
| `wry/src/ohos/mod.rs` | `InnerWebView::create_pdf()` (~~PdfConfig re-export~~ 已移除) |
| `wry/src/webkitgtk/mod.rs` | `create_pdf` stub (返回 Ok) |
| `wry/src/webview2/mod.rs` | `create_pdf` stub (返回 Ok) |
| `wry/src/wkwebview/mod.rs` | `create_pdf` stub (返回 Ok) |
| `wry/src/android/mod.rs` | `create_pdf` stub (返回 Ok) |

### Tauri 层 (11 文件)

| 文件 | 改动 |
|------|------|
| `crates/tauri-runtime/src/lib.rs` | `WebviewDispatch::create_pdf` trait 方法 |
| `crates/tauri-runtime-wry/src/lib.rs` | `CreatePdf` 消息 + dispatch + impl |
| `crates/tauri/src/test/mock_runtime.rs` | `create_pdf` 桩 |
| `crates/tauri/src/webview/mod.rs` | `Webview::create_pdf()` public API |
| `crates/tauri/src/webview/webview_window.rs` | `WebviewWindow::create_pdf()` 委托 |
| `examples/api/src-tauri/src/cmd.rs` | `test_create_pdf` 命令 |
| `examples/api/src-tauri/src/lib.rs` | 注册命令 |
| `examples/api/src-tauri/capabilities/run-app.json` | ACL 权限 |
| `examples/api/src-tauri/permissions/autogenerated/test_create_pdf.toml` | 权限文件 |
| `examples/api/src/lib/tests/core.ts` | 自动测试用例 |
| `examples/api/src/views/TestRunner.svelte` | 手动测试按钮 |

## 检视发现

### ~~问题 #1：平台 stub 的 callback 泄漏~~ (已修复)

~~**严重程度：⚠️ 中**~~

~~wry 四个平台 stub（webkitgtk / webview2 / wkwebview / android）的 `create_pdf` 返回 `Ok(())` 但**永远不会调用 callback**。如果调用方在等待回调，会永远挂起。~~

~~**当前影响：** 无。目前只在 OHOS 设备上运行。~~

**修复：** 公共 API `create_pdf()` 已加 `#[cfg(target_env = "ohos")]` 门控，四个平台 stub 已删除。非 OHOS 平台编译期不可调用。

### 问题 #2：~~NAPI 层异常路径的 callback 泄漏~~ → callback 异常路径处理

~~**严重程度：⚠️ 中**~~

~~`openharmony-ability/crates/ability/src/helper/webview.rs` 中，如果 `get_main_thread_env()` 返回 `None`，直接返回 `Err`，callback 不会被调用。~~

**已修复：** `create_pdf()` 重构为在 callback 被 move 消费前的所有错误路径（env 不可用、NAPI 函数获取失败）调用 `callback(false)` 后再返回 `Err`。

**已知限制：** callback 被 move 进 NAPI closure 后，如果 `create_function_from_closure` 或 `call()` 发生灾难性失败（极罕见），callback 无法回收调用。tauri dispatch 层已添加注释说明。

### 问题 #3：窗口不存在时静默返回

**严重程度：💡 低**

`examples/api/src-tauri/src/cmd.rs` 中，如果 `get_webview_window("main")` 返回 `None`，命令返回 `Ok(())` 但不 emit 任何事件。前端的 `listen` 会一直等待直到超时。

**当前影响：** 低。测试环境中 `main` 窗口始终存在。

**修复建议（未来）：**
```rust
} else {
    let _ = app.emit("create-pdf-result", "false:window not found");
}
```
