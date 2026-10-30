# ohos-webview-bounds Specification

## Purpose
OHOS 平台 webview 几何语义:set_bounds/bounds 下发链路、WebviewStyle 宽高消费、自然布局兜底。(2026-10-19 由 change ohos-webview-sizing 规范化节头;原文件误用 delta 节头导致 requirements 不可解析。)

## Requirements

### Requirement: wry OHOS bounds SHALL return cached value
wry OHOS 后端的 `InnerWebView::bounds` SHALL 返回 `bounds_cache` 中缓存的最后设置值，而非 `Rect::default()`。

#### Scenario: bounds returns last set value
- **WHEN** 先调用 `set_bounds(Rect { position: (10, 20), size: (800, 600) })`，再调用 `bounds()`
- **THEN** SHALL 返回 `Rect { position: (10, 20), size: (800, 600) }`

#### Scenario: bounds returns initial value before any set_bounds
- **WHEN** webview 创建时 `WebViewAttributes::bounds` 为 `Some(Rect { position: (0, 0), size: (200, 200) })`（wry 默认值），且未调用 `set_bounds` 时调用 `bounds()`
- **THEN** SHALL 返回初始 bounds 值 `Rect { position: (0, 0), size: (200, 200) }`（由 `InnerWebView::new` 从 `attributes.bounds` 初始化 `bounds_cache`）

#### Scenario: bounds returns default when no initial bounds
- **WHEN** webview 创建时 `WebViewAttributes::bounds` 为 `None`，且未调用 `set_bounds` 时调用 `bounds()`
- **THEN** SHALL 返回 `Rect::default()`（全零）

### Requirement: wry OHOS set_visible SHALL call OHA set_visible
wry OHOS 后端的 `InnerWebView::set_visible` SHALL 调用 `openharmony_ability::Webview::set_visible()` 切换 Web 组件可见性，而非返回 no-op。

#### Scenario: hide webview
- **WHEN** tauri-runtime-wry 调用 `webview.set_visible(false)`
- **THEN** wry OHOS SHALL 调用 `self.webview.set_visible(false)`
- **AND** ArkTS `applyStyle({ visible: false })` SHALL 触发 `updateWebviewStyle`
- **AND** Web 组件 `.visibility(Visibility.Hidden)` SHALL 生效

#### Scenario: show webview
- **WHEN** tauri-runtime-wry 调用 `webview.set_visible(true)`
- **THEN** wry OHOS SHALL 调用 `self.webview.set_visible(true)`
- **AND** Web 组件 `.visibility(Visibility.Visible)` SHALL 生效

### Requirement: WebviewStyle SHALL support width and height fields
`WebviewStyle` 的 `width`/`height` 字段 SHALL 被新桥 ArkTS 渲染层真实消费,决定 Web 组件的实际渲染尺寸;未携带时保持整容器兜底(自然布局)。

#### Scenario: Web component uses style width/height when set
- **WHEN** create 请求携带 `style.width = 400`、`style.height = 300`(vp)
- **THEN** Web 组件的实际渲染尺寸 SHALL 为 400×300(以页面 viewport 可观察),而非整容器尺寸

#### Scenario: Web component defaults to 100% when width/height not set
- **WHEN** create 请求未携带 `style.width`/`style.height`
- **THEN** Web 组件 SHALL 填满其父容器(100% 兜底,自然布局)
- **AND** 父容器随窗口 resize 变化时,渲染尺寸 SHALL 跟随变化

#### Scenario: width/height carried through the bridge wire
- **WHEN** tauri-runtime-wry 以显式 bounds 创建 OHOS 子 webview
- **THEN** wry OHOS SHALL 在 create 请求的 style 中携带 `x/y/width/height` 四值
- **AND** ArkTS 渲染层 SHALL 消费全部四值,不再忽略 width/height

### Requirement: Explicit bounds SHALL determine the child webview rendered geometry
创建时携带显式 bounds 的子 webview SHALL 按请求的位置与尺寸渲染,不得放大为整容器尺寸。

#### Scenario: child webview created with explicit bounds renders at requested size
- **WHEN** 经 `add_child`/`create_webview` 在主窗内创建子 webview,bounds 为 (x=50, y=50, w=300, h=200)
- **THEN** 该 webview 页面的 viewport(innerWidth/innerHeight)SHALL 等于请求尺寸 300×200
- **AND** 其渲染位置 SHALL 等于请求位置(整窗原点 + (50,50))

#### Scenario: two non-overlapping child webviews each keep their own geometry
- **WHEN** 同一窗内先后创建两个 bounds 不重叠的子 webview
- **THEN** 两个 webview 的 viewport SHALL 各自等于各自请求尺寸
- **AND** 任一 webview 的渲染区域 SHALL 不覆盖另一 webview 或窗内非 bounds 区域的命中区

#### Scenario: oversized rendering is the defect signature (red-light reference)
- **WHEN** 子 webview 携带小于容器的显式 bounds 渲染
- **THEN** 其渲染 viewport SHALL NOT 等于整容器尺寸——渲染层不得把显式 bounds 子 webview 放大为整容器尺寸,整容器渲染即缺陷签名(如消费方实测 Tab 内容层 1103×735)

### Requirement: Runtime set_bounds SHALL override the rendered geometry
webview 创建后调用 `set_bounds`/`setSize`/`setPosition` SHALL 同时作用于渲染位置与渲染尺寸,以最后一次调用为准。

#### Scenario: setSize changes the rendered viewport of a child webview
- **WHEN** 对渲染中的子 webview 调用 `setSize(400,300)` 与 `setPosition(60,70)`
- **THEN** 其页面 viewport SHALL 变为 400×300 且渲染位置变为 (60,70)

#### Scenario: consecutive set_bounds calls — last one wins
- **WHEN** 连续两次 set_bounds(如 (0,0,300,200) 后 (30,40,250,150))
- **THEN** 最终渲染几何 SHALL 为最后一次值 (30,40,250,150),不发生合并或丢弃

#### Scenario: set_bounds overrides natural layout
- **WHEN** 创建时未携带 bounds 的 webview(自然布局、填满容器)被调用 `set_bounds(x, y, w, h)`
- **THEN** 其渲染几何 SHALL 变为显式的 (x, y, w, h)(自然布局被首次显式几何覆盖)
- **AND** 后续窗口 resize 不再自动驱动该 webview 尺寸(与桌面非 auto_resize webview 语义一致)

### Requirement: Bounds-less webviews SHALL follow their parent container
创建时未携带 bounds 的 webview SHALL 保持自然布局,渲染尺寸跟随父容器,无需 Rust 侧重发 bounds。

#### Scenario: bounds-less webview viewport equals container size
- **WHEN** webview 创建时未携带 bounds
- **THEN** 其页面 viewport SHALL 等于其父容器内容区尺寸(如主窗 webview 等于窗口内容区)

#### Scenario: bounds-less webview follows window resize without Rust re-issue
- **WHEN** 承载自然布局 webview 的窗口发生 resize
- **THEN** webview 渲染尺寸 SHALL 经容器布局跟随新窗口尺寸
- **AND** 运行时不因自然布局 webview 触发 autoresize 重发(其无 rates 缓存)

### Requirement: Bounds conversion SHALL apply virtualPixelRatio

wry OHOS 后端的 bounds 换算 SHALL 接入 virtualPixelRatio(vp):`set_bounds`/create 的 `to_logical::<f64>(1.0)` 改为 `to_logical::<f64>(vp)`。vp 来源为 openharmony-ability 既有 display 绑定的薄包装(绑定返回 ≤0/异常时回落 1.0),零新增 NAPI wire、零 ArkTS 面。`bounds()` 回读 SHALL 维持 cache 语义,不经 vp 换算。

#### Scenario: vp=1.0 keeps conversion identical

- **WHEN** 绑定返回 vp=1.0(桌面基线)且 set_bounds 以 Physical Rect 调用
- **THEN** 换算结果 SHALL 与现状逐值一致(to_logical 对 Physical 输入 = 物理值 ÷ scale,除以 1.0 恒等;Logical 输入本就恒等)

#### Scenario: vp≠1.0 divides physical by vp

- **WHEN** 真机绑定报告 vp=2.0 且 set_bounds 以 Physical (200,100) 调用
- **THEN** 下发 ArkUI 的值 SHALL 为 (100,50) vp(物理 ÷ vp,窗口与物理像素对齐)
- **AND** `bounds()` 回读 SHALL 返回设置值原样(cache 语义不变,不经 vp 换算)

#### Scenario: Fallback when binding is unavailable

- **WHEN** 绑定 API 返回 ≤0 或异常(早期调用或设备不支持)
- **THEN** `virtual_pixel_ratio()` 包装 SHALL 返回 1.0,不 panic、不阻塞

#### Scenario: bounds cache semantics unchanged

- **WHEN** vp 接入后调用 `bounds()`
- **THEN** 既有「wry OHOS bounds SHALL return cached value」requirement 全部场景保持成立
