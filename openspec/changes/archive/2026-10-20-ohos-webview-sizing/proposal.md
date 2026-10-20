# Proposal: ohos-webview-sizing

## Why

消费方 zhkt60 教师端(HarmonyOS PC 2in1 真机)实测:同窗多 webview 场景下,Tab 内容层 webview 拿到整窗尺寸(1103×735,原点 (450,225),位置正确)——渲染层几何越界:承载 Web 的 wrapper(Web/Stack)恒 100%×100% 铺满整窗,覆盖页签条/关闭按钮的命中区 → 点不动。注意:该 webview 自身实测几何为 (0,48)+1103×735,不含顶部 48px 页签带(页签条/关闭按钮所在),顶部带失灵只能由越界的 wrapper 解释(design Context「关键判读」)。指纹与我方历史 HAR 路径 `DefaultWebview.ets` 的 naturalLayout 语义(`d5308281`/`0cac4c3`)一致;代码考古进一步证实:**当前 HEAD 的新桥 ArkTS 渲染层存在同构语义缺口**——`WebviewPlugin.ets` 的 Web 组件恒 `.width("100%").height("100%")`、`setBounds()` 有意忽略 width/height(仅 position 生效),`normalizeStyle` 透传的 style.width/height 从未被渲染层消费。即:任何 `add_child` 显式 bounds 的子 webview 在 HEAD 上都渲染为整窗尺寸(仅位置正确),「Rust 记录正确、ArkTS 渲染错」,而现有 multi-webview 用例只断言 Rust 回读,完全盲区。

## What Changes

- **openharmony-ability(唯一 ArkTS 桥接仓)**:`WebviewPlugin.ets` 几何语义修正——
  - 显式尺寸语义落地:create 请求携带的 `style.width/height` 真正驱动渲染(显式 bounds 的子 webview 按请求尺寸渲染,不再整窗兜底);
  - `setBounds()` 从「仅 x/y」改为「x/y/width/height 全量生效」——后续 `set_bounds` 覆盖尺寸,对齐上游 wry/tauri 语义(`WebViewAttributes::bounds` / `set_bounds` / `setSize` 均应生效);
  - naturalLayout 语义收窄为精确形态:「创建时无显式尺寸 → 跟随父容器(100%)」,首次显式几何到达后翻转为显式尺寸;
  - 运行时几何刷新走 `AttributeUpdater` 模式(`BuilderNode.update` 不刷新链式组件属性,约束 4.1;沿用 p1-window-vibrancy BlurModifier 先例);
  - 几何挂载点从 Web 组件移到外层 Stack 容器,Web 恒 100% 跟随容器——使 ArkWeb viewport 经由容器布局机制跟踪尺寸变化(与 natural layout 已实证的路径同构),规避「固定 px 直打 Web 组件」的历史 bottom-cutoff 缺陷。
- **tauri/wry(Rust 侧)**:行为不变,仅注释/文档对齐——tauri-runtime-wry OHOS bounds 分支注释(`crates/tauri-runtime-wry/src/lib.rs:5736-5742`)与 `wry/src/ohos/mod.rs` `bounds()` doc 中「BuilderNode.update 不通知 ArkWeb relayout」的过时论据改为新语义。
- **examples/api 套件(case-first 红灯先行)**:新增子 webview 渲染真值用例——create 显式 bounds 与后续 `setSize`/`setBounds` 后,断言子 webview 页面内 `window.innerWidth/innerHeight` 探针值等于请求几何(ArkTS 渲染层真值,非 Rust 回读);配套新增 demo 探针命令。
- **归属复测(消费方真机)+ 裁定**:在工具栏不活跃条件下复测输入归属(排除 ZOrd 112/113 全屏窗污染),并按证据裁定修复点归属(甲=适配层栈缺陷→升级路径;乙=消费方 app 侧 layout_content_rect 缺陷→app 侧修复建议);产出消费方交付面说明。

## Capabilities

### New Capabilities

(无——本 change 全部落在既有 capability `ohos-webview-bounds` 的行为域内,不新建能力。)

### Modified Capabilities

- `ohos-webview-bounds`:该 capability 现有需求描述的是已删除的 HAR webview 路径(DefaultWebview.ets/NewWindowDialog.ets/Utils.ets 由 commit 694cce82 清理删除;ArkHelper.ets 与 OHA NAPI set_bounds 由 pluginization 提交 ec27af65/c40ad0a2 删除)。本 change:
  - REMOVED 6 条以已删除代码为主体的需求(wry set_bounds NAPI 链路 / OHA Webview set_bounds NAPI 方法 / ArkHelper setBounds / JsHelper setBounds / DefaultWebview 参数化宽高 / EmbeddedWebBuilder position);
  - MODIFIED 1 条(WebviewStyle width/height:从「字段存在、渲染层忽略」改为「渲染层真实消费」);
  - ADDED 3 条新桥渲染语义需求(显式 bounds 决定渲染几何 / 运行时 set_bounds 全量覆盖含 naturalLayout 翻转 / bounds-less 自然布局跟随容器)。

## Impact

- **交付仓**:`openharmony-ability`(ArkTS WebviewPlugin.ets,唯一 ArkTS 桥接仓,符合铁律 1);`tauri`(tauri-runtime-wry 注释)、`wry`(ohos/mod.rs doc 注释)——Rust 行为零变更,不触 Windows/macOS/Linux 路径(注释仅涉及 OHOS 分支),符合铁律 2。
- **测试设施**:examples/api 套件新增用例(desktop 基线 307✅ 须保持);`src-tauri/src/cmd.rs` 新增探针命令并登记 `lib.rs` invoke_handler。
- **消费方受益路径**(ohdev-git 落后分支,仍用已删除的 HAR webview 路径):
  - 不升级:本 change 产出的修复建议文档给出其 fork 内可落地的两条路(cherry-pick 我方历史 naturalLayout 语义修正;或 app 侧 create 时显式传 Tab 区 rect——在 `d5308281` 语义下 naturalLayout=false 即显式尺寸生效);
  - 升级到 HEAD + 本 change:`set_bounds` 覆盖语义可用,「创建时无尺寸、后续 set_bounds」形态直接修复。
- **风险面**:几何挂载点迁移涉及 overlay/direct 两个渲染分支与命中区(menubar 焦点门控 onMouse 绑定在 wrapper 上),须真机回归验证命中区与 resize 行为;`AttributeUpdater` 对 BuilderNode 挂载组件的宽高刷新在本仓无直接先例(BlurModifier 先例为旧 NodeController 路径),标注待实现期真机验证。
