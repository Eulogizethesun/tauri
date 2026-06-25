# Phase 1: 底层 webview 几何能力 - 实施任务

## 1. ArkTS WebviewStyle 扩展

- [x] 1.1 在 `DefaultWebview.ets` 的 `WebviewStyle` 接口（约 line 71-76）新增 `width?: number | string` 和 `height?: number | string` 字段
- [x] 1.2 在 `type.ets` 的 `WebViewStyle` 接口（约 line 79-84）同步新增 `width` 和 `height` 字段
- [x] 1.3 修改 `DefaultWebview.ets` 的 `WebBuilder`（约 line 117-118）：`.width("100%")` → `.width(data.style?.width ?? "100%")`，`.height("100%")` → `.height(data.style?.height ?? "100%")`
- [x] 1.4 修改 `DefaultWebview.ets` 的 `EmbeddedWebBuilder` 内部 Web 组件（约 line 246-247）：同上参数化 `.width()`/`.height()`
- [x] 1.5 修改 `DefaultWebview.ets` 的 `EmbeddedWebBuilder` 外部 Stack 容器（约 line 339-340）：同上参数化 `.width()`/`.height()`
- [x] 1.6 在 `DefaultWebview.ets` 的 `EmbeddedWebBuilder` 外部 Stack 容器（约 line 339 后）新增 `.position({ x: data.style?.x ?? 0, y: data.style?.y ?? 0 })`（与 `WebBuilder` line 119-122 对齐）
- [x] 1.7 在 `Utils.ets` 的 `JsWebviewStyle` 接口（约 line 33-38）同步新增 `width?: number | string` 和 `height?: number | string` 字段（该接口当前未被使用，但为一致性更新）

## 2. ArkTS setBounds 控制器方法

- [x] 2.1 在 `ArkHelper.ets` 的 `createWebview` 函数（约 line 309-315 后）新增 `ret.controller.setBounds = (x: number, y: number, width: number, height: number) => { applyStyle({ x, y, width, height }); }`
- [x] 2.2 在 `ArkHelper.ets` 的 `createEmbeddedWebview` 函数（约 line 386-392 后）同上新增 `setBounds` 方法
- [x] 2.3 在 `DefaultWebview.ets` 的 `WebviewController` 扩展声明（约 line 768-774）新增 `setBounds: (x: number, y: number, width: number, height: number) => void` 声明

## 3. ArkTS JsHelper / ProxyJsHelper / buildJsHelper 链路

- [x] 3.1 在 `Utils.ets` 的 `JsHelper` 接口（约 line 46-61）新增 `setBounds: (x: number, y: number, width: number, height: number) => void` 方法签名
- [x] 3.2 在 `Utils.ets` 的 `ProxyJsHelper`（约 line 68-191）新增 `setBounds` 方法，遵循 `setVisible` 的缓存模式：`if (this.realController) { this.realController.setBounds(x, y, width, height); } else { this.pendingOperations.push(() => this.realController!.setBounds(x, y, width, height)); }`
- [x] 3.3 在 `DefaultWebview.ets` 的 `buildJsHelper` 返回对象（约 line 614-629）新增 `setBounds: (_x: number, _y: number, _w: number, _h: number) => {}` no-op 桩（与 `setBackgroundColor`/`setVisible`/`dispose` 桩一致）

## 4. OHA Rust NAPI set_bounds/bounds 方法

- [x] 4.1 在 `openharmony-ability/crates/ability/src/helper/webview.rs` 的 `WebViewStyle` 结构体新增 `width: Option<Either<f64, String>>` 和 `height: Option<Either<f64, String>>` 字段
- [x] 4.2 在 `Webview` impl 块新增 `set_bounds(&self, x: f64, y: f64, width: f64, height: f64) -> Result<()>` 方法，遵循 `load_url_with_headers` 的多参数 NAPI 模式：`get_named_property::<Function<'_, FnArgs<(f64, f64, f64, f64)>, ()>>("setBounds")` → `.call((x, y, width, height).into())`
- [x] 4.3 验证 NAPI 函数名：ArkTS 侧方法名为 `setBounds`（在 ArkHelper.ets 中手动挂载），Rust 侧 `get_named_property("setBounds")` 名称需精确匹配（注意大小写）
- [x] 4.4 在 `Webview` impl 块新增 `bounds(&self) -> Result<(f64, f64, f64, f64)>` 方法（可选：通过 NAPI 查询，或返回错误提示使用 wry 层缓存）— wry 层使用缓存值，OHA 层不需要 bounds 方法

## 5. wry OHOS set_bounds/bounds/set_visible 实现

- [x] 5.1 在 `wry/src/ohos/mod.rs` 的 `InnerWebView` 结构体新增 `bounds_cache: std::sync::Mutex<wry::Rect>` 字段
- [x] 5.2 修改 `InnerWebView::new`：在 `WebViewAttributes` 解构中提取 `bounds`（当前在 `..` 中被忽略），通过 `to_logical::<f64>(1.0)` 转为 `f64` 值传入 `WebViewStyle` 的 x/y/width/height，并初始化 `bounds_cache` — 注：初始 bounds 通过创建后调用 `webview.set_bounds()` 设置，`WebViewStyle` 的 width/height 保持 `None`（避免 wry 引入 `Either` 依赖）
- [x] 5.3 修改 `InnerWebView::new` 的 `WebViewStyle` 初始化：从 `WebViewStyle { x: None, y: None, visible: None, background_color }` 改为包含 `width`/`height` 和从 `attributes.bounds` 提取的 x/y 值
- [x] 5.4 修改 `set_bounds`（约 line 393-395）：将参数 `_bounds` 改为 `bounds`（移除下划线前缀），从 `Ok(())` 改为先将 `bounds.position.to_logical::<f64>(1.0).into()` 和 `bounds.size.to_logical::<f64>(1.0).into()` 提取 x/y/width/height（参照 Decision 8），调用 `self.webview.set_bounds(x, y, w, h)`，再更新 `*self.bounds_cache.lock().unwrap() = bounds`，返回结果
- [x] 5.5 修改 `bounds`（约 line 389-391）：从 `Ok(Rect::default())` 改为 `Ok(*self.bounds_cache.lock().unwrap())`（`Rect` 是 `Copy`）
- [x] 5.6 修改 `set_visible`（约 line 397-399）：从 `Ok(())` 改为 `self.webview.set_visible(_visible).map_err(|e| Error::OpenHarmonyWebviewError(format!("Failed to set visible: {}", e)))`
- [x] 5.7 修改 `InnerWebView::new` 的返回语句（约 line 244）：从 `Ok(Self { id, webview, page_loaded })` 改为 `Ok(Self { id, webview, page_loaded, bounds_cache: Mutex::new(initial_bounds) })`，其中 `initial_bounds` 从 `attributes.bounds` 提取或 `Rect::default()`

## 6. 构建验证

- [ ] 6.1 重建 openharmony-ability HAR 包（`ohrs build --arch arm64` + `pack.sh` + `tar` + `ohpm install`）
- [ ] 6.2 在 OHOS desktop target 上 `cargo check` wry crate
- [ ] 6.3 在 OHOS desktop target 上 `cargo check` tauri-runtime-wry crate
- [ ] 6.4 验证向下兼容：不调用 set_bounds 时 webview 仍为 100% 尺寸

## 7. 设备端验证

- [ ] 7.1 创建临时测试应用：在 setup 中创建窗口 + 两个子 webview，分别设置不同 bounds，验证定位和尺寸
- [ ] 7.2 验证 set_visible：隐藏一个 webview，确认另一个不受影响
- [ ] 7.3 验证窗口 resize 后 auto_resize webview 的 bounds 更新（tauri-runtime-wry 的 WebviewBounds rate-based 重算）
- [ ] 7.4 验证 ProxyJsHelper 回放：在 controller 未就绪时调用 setBounds，确认 controller 就绪后位置正确应用
