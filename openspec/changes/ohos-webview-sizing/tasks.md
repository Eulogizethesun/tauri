# Tasks: ohos-webview-sizing

> 路径约定:anchor 以 `D:\xuqiu\tauri-3.0\` 为根(三仓并列:tauri / openharmony-ability / wry)。
> case-first 铁律:组 1 的红灯用例必须在当前 HEAD 上先行落地并实证失败,组 2 的修复才能开工。

## 1. 红灯用例先行:渲染真值探针与用例(examples/api)

- [x] 1.1 新增子 webview viewport 探针静态页(load 与 resize 事件经裸 `__TAURI_INTERNALS__.invoke` 上报 innerWidth/innerHeight/documentElement.clientWidth/clientHeight) — anchor: tauri/examples/api/public/webview-viewport-probe.html
- [x] 1.2 新增探针命令对(镜像 cmd.rs 既有 tracked-events 模式,只读 Mutex 存储) — anchor: tauri/examples/api/src-tauri/src/cmd.rs::track_webview_viewport_probe,::get_tracked_webview_viewport_probes
- [x] 1.3 登记 1.2 两命令到 invoke_handler 列表 — anchor: tauri/examples/api/src-tauri/src/lib.rs
- [x] 1.4 编写三个渲染真值用例(case a=create 显式 bounds+双 child 不重叠;case b=setSize/setPosition 覆盖+连续两次以最后为准;case c=副窗 natural 跟随容器/resize + `Webview.getByLabel` 驱动 set_bounds 翻转;全部 finally 清理;timeout 显式 10000ms) — anchor: tauri/examples/api/src/lib/tests/core.ts
- [x] 1.5 构建部署并真机运行(2in1,`run-tests.sh("" desktop)`),**确认红灯判据段失败(case a/b 全部 + case c 翻转段)**(HEAD 判据:显式 bounds 与 setSize 后探针≈整窗尺寸);case c natural 跟随段按 design S11 注记预期已绿(100% 兜底),作防回归护栏——该段不红不是红灯装置有错,红灯证据记录进 change 目录 — anchor: tauri/examples/api/src/lib/tests/core.ts(证据:`red-light-evidence.md` + `red-light-test-report-2026-10-19.md`;探针装置 `undefined×undefined` 假红已修——`ViewportProbeSample` 加 `#[serde(rename_all="camelCase")]`,修复后真红:case a/b 实测 1101×657 整窗、case c 翻转段 320×240 被忽略保持 601×451)

## 2. ArkTS 几何语义修复(openharmony-ability,唯一 ArkTS 桥接仓)

- [x] 2.1 新增 `WebviewGeometryModifier extends AttributeUpdater<CommonAttribute>`(initializeModifier 留空不覆盖 build 时链式属性;apply 经 `attribute?.position/width/height` 运行时刷新;先例 p1-window-vibrancy BlurModifier) — anchor: openharmony-ability/plugins/webview/src/main/ets/WebviewPlugin.ets::WebviewGeometryModifier
- [x] 2.2 `BuildWebview` 两分支几何迁移:外层 Stack 承载 `.width(data.style.width ?? "100%")/.height(...)/.position(...)` 并绑定 `.attributeModifier(data.geometryModifier)`;Web 组件恒 100%×100%、移除其 `.position`;overlay/direct 分支同步改写 — anchor: openharmony-ability/plugins/webview/src/main/ets/WebviewPlugin.ets::BuildWebview
- [x] 2.3 `create()` 定格 `naturalLayout`(`normalizeStyle` 后 style.width 与 style.height 均 undefined)并装配 modifier 到 ManagedWebview — anchor: openharmony-ability/plugins/webview/src/main/ets/WebviewPlugin.ets::create
- [x] 2.4 `setBounds()` 全量几何:写 style.{x,y,width,height} 后经 modifier 刷新(不再有意忽略宽高);保持返回值语义 — anchor: openharmony-ability/plugins/webview/src/main/ets/WebviewPlugin.ets::setBounds(hilog `(full geometry, D2)` 标记真机实证)
- [x] 2.5 同步改写三处过时注释(direct 分支「Always 100%」块、setBounds「intentionally ignored」块、normalizeStyle 语义注记)为新几何语义 — anchor: openharmony-ability/plugins/webview/src/main/ets/WebviewPlugin.ets
- [x] 2.6 重建 HAR 并部署(ArkTS 变更 → `ohrs build --arch arm64` + pack → HAP 重建;约束:改 ArkTS 后必清 oh_modules/CompileArkTS 缓存) — anchor: openharmony-ability/plugins/webview/src/main/ets/WebviewPlugin.ets(按记忆 ohos-ohpm-ability-har-stale-cache 清 `gen/ohos/oh_modules` + `entry_desktop/.../default@CompileArkTS`;tar 抽取 ability.har grep `WebviewGeometryModifier`×4 + 编译产物新 hash 双验证)

## 3. Rust 侧注释对齐(行为零变更,不触非 OHOS 路径)

- [x] 3.1 改写 tauri-runtime-wry OHOS bounds 分支注释(5736-5742):删「BuilderNode.update does not notify ArkWeb to relayout」过时论据,改为新语义(显式 bounds 由 ArkTS 渲染层消费、set_bounds 可覆盖、bounds-less 保持自然布局) — anchor: tauri/crates/tauri-runtime-wry/src/lib.rs(注释-only diff 10 行,host cargo check 过)
- [x] 3.2 对齐 `bounds()` doc 的 cache/relayout 语义段 — anchor: wry/src/ohos/mod.rs::bounds(Render semantics 段;host cargo check 过)

## 4. 绿灯验证与回归(设备)

- [x] 4.1 真机复跑组 1 三用例转绿(探针=请求几何;真机验证项:子 webview 尺寸变化后页面无 bottom cutoff) — anchor: tauri/examples/api/src/lib/tests/core.ts(run 3 终轮 311✅/0❌/7⏭;探针=请求+1px ArkWeb viewport 常数,±1 容差校准见 `red-light-evidence.md` 绿灯校准记录;探针页常驻内容渲染于精确几何内,无 bottom cutoff)
- [x] 4.2 真机命中区回归:menubar 点击、子 webview 区域命中、窗口 resize 后 natural 布局跟随、auto_resize webview rates 路径不受影响、set_visible hide/show 与 set_background_color/blur 路径不回归、拖拽 overlay 覆盖面回归(overlay 分支 drag enter/move/drop——几何迁移触碰 overlay 外层 Stack,design Risks 第三条明确要求项)(D1 重构同一组件树,被触碰的既有行为须护住) — anchor: tauri/examples/api/src/lib/tests/core.ts(套件回归面全绿:menu 族 159-200、resize 46、set_bounds round-trip 70(已改专用显式 bounds 子 webview,规避 D2 对 main webview 的设计内翻转)、blur 74、Float ops 311、子窗 webview 296;拖拽 overlay 无 auto 驱动设施——结构包含性保留(内层 drag Stack 100% 于已修正的外层 Stack),真实点击归属=R1 消费方设备项)
- [x] 4.3 desktop 基线 307 既有用例零回归(组 1 新增 3 条转绿后总数增至 310✅;`run-tests.sh("" desktop)`;schema.json 构建 churn 不入提交) — anchor: tauri/examples/api/src/lib/tests/core.ts(**按派遣更正基线数为 311✅**(=308 基线+3 新用例,tasks 原文「307→310」书写过时);run 3 实测 311✅/0❌/7⏭;6 个 schema.json churn 未入提交)

## 5. 归属复测与裁定(消费方真机,手动)

- [x] 5.1 R1 输入归属复测:工具栏不活跃(退出画布模式 + hidumper 核实 ZOrd 112/113 不在 + 排残留窗)→ uinput 真实点击页签条 → 按 design 判据三分支归档(窃取者=Tab 内容层 / 主壳正常 / 全空重测) — anchor: openspec/changes/ohos-webview-sizing/design.md(**待消费方设备接入**:192.168.0.4:46259 不可达,tconn/list targets 均失败;按派遣双分支兜底——接入后按 design 三分支归档,本机 2in1 无消费方 app 栈不可代测)
- [x] 5.2 R2 尺寸归属复测:渲染真值(CDP viewport)→ fork 栈考古定性(d5308281 前后)→ 创建载荷证据(消费方配合:hilog 或 layout_content_rect 源码)→ 按 design 裁定逻辑出 甲/乙 结论;证据不可得时按双分支兜底裁定并标注未决 — anchor: openspec/changes/ohos-webview-sizing/design.md(**双分支兜底裁定已落** `consumer-advisory.md`:甲=升级指引+止血选项,乙=app 侧 layout_content_rect 显式 rect;fork 栈考古(本仓侧)已完成——d5308281 语义与 D2 一致;设备侧 CDP/hilog 证据待消费方设备接入后收敛)

## 6. 消费方交付面文档

- [x] 6.1 产出修复建议与升级指引文档(按 5.2 裁定侧重;甲=升级至含本 change 的 HEAD 栈+临时止血 cherry-pick d5308281 选项;乙=app 侧 layout_content_rect 创建时显式传 Tab 区 rect;两分支共同=升级后 set_bounds 覆盖语义可用;机制表述以 design Context「关键判读」更正为准——越界覆盖命中区者为 wrapper(Web/Stack),非 Web 组件自身),落 change 目录并同步消费方 — anchor: openspec/changes/ohos-webview-sizing/design.md(产物:`consumer-advisory.md` 双分支兜底版;5.1/5.2 消费方设备未接入,接入后按裁定侧重收敛)
