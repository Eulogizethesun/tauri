# ohos-webview-sizing — ohos-webview-bounds Spec Delta

## REMOVED Requirements

### Requirement: wry OHOS set_bounds SHALL call OHA NAPI
**原因**:描述的 NAPI ObjectRef 链路(webview.set_bounds → `openharmony_ability::Webview::set_bounds()` → ArkTS `applyStyle`/`updateWebviewStyle`)属已删除的 HAR webview 路径(ArkHelper.ets 与 OHA NAPI set_bounds 由 pluginization 提交 ec27af65/c40ad0a2 删除;DefaultWebview.ets/NewWindowDialog.ets/Utils.ets 残留由 694cce82 清理);新桥语义由本 delta 的 ADDED 需求以 bridge action 形式承载。

### Requirement: OHA Webview SHALL expose set_bounds NAPI method
**原因**:主体 `openharmony_ability::Webview` NAPI set_bounds 方法属已删除的 HAR webview 路径;新桥 set-bounds 经 bridge action 下发,四值全量,行为由 ADDED 需求描述。

### Requirement: ArkHelper SHALL attach setBounds to controller
**原因**:ArkHelper.ets 已随 HAR webview 路径删除。

### Requirement: JsHelper interface SHALL include setBounds method
**原因**:Utils.ets 的 JsHelper/ProxyJsHelper 已随 HAR webview 路径删除。

### Requirement: DefaultWebview SHALL parameterize width and height
**原因**:DefaultWebview.ets 已随 HAR webview 路径删除;新桥渲染层的尺寸消费语义由本 delta 的 MODIFIED/ADDED 需求承载。

### Requirement: EmbeddedWebBuilder SHALL support position
**原因**:EmbeddedWebBuilder 已随 HAR webview 路径删除;新桥的 position 消费语义并入 ADDED 需求(显式 bounds 决定渲染几何)。

## MODIFIED Requirements

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

## ADDED Requirements

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
