# Design: ohos-webview-sizing

## Context

### 问题现场(消费方真机实测,HarmonyOS PC 2in1)

同一窗内多 webview 实测尺寸(见 `D:\支撑Task\zhkt60-6.0.0-20261019\BUILD-INFO.md`):

| webview | 屏幕原点 | 尺寸 | 判定 |
|---|---|---|---|
| 主壳 | (450,177) | 1103×735 | — |
| 资源预览内容层(Tab 内容层) | (450,225) | 1103×735 | ❌ 与主壳同高,应为 Tab 区高度(≈687) |
| 登录窗(独立 OS 窗) | (613,239) | 420×620 | ✅ |
| popover(独立 OS 窗) | (520,230) | 360×308 | ✅ |

关键判读:
- Tab 内容层位置 (0,48)(相对窗原点)**已生效**,尺寸却等于整窗 → 「position 生效、size 被忽略」指纹。
- **重要更正**:并非「存在子 webview 就吞整窗输入」——边界正确的 popover(独立窗)不抢输入。是**渲染层几何越界覆盖命中区**才点不动。越界者是 **wrapper(Web/Stack)** 而非 Web 组件自身:按上表,Tab 内容层自身几何为 (0,48)+1103×735,不覆盖顶部 48px 页签带(页签条/关闭按钮所在)——顶部带失灵只能由 HEAD 上恒 100%×100% 的外层 wrapper Stack 解释(D1 理由 2:wrapper Stack 即命中边界);D1 把 wrapper 收窄到显式 rect 后 Web 与 wrapper 同时收窄,无论越界主体是 Web 组件还是 wrapper,修复均有效。
- 归属测试曾被污染:往页签条打真实点击时六个 webview 探针全空,因 canvas-toolbar/toolbar 两个全屏窗(ZOrd 112/113)压在最上层。

### 我方代码现状(HEAD,已核实)

新桥链路(HEAD;HAR webview 路径已删——ArkHelper.ets 与 OHA NAPI set_bounds 由 pluginization 提交 ec27af65/c40ad0a2 删除,残留的 DefaultWebview.ets/NewWindowDialog.ets/Utils.ets 由 694cce82 清理):

1. `tauri/crates/tauri/src/webview/mod.rs:806` — `add_child`/`create_webview` 必经路径:`webview_attributes.bounds = Some(rect)`(position+size 强制成对)。
2. `tauri/crates/tauri-runtime-wry/src/lib.rs:5696-5704` — bounds Some → `with_bounds(bounds)` 传给 wry;`:5736-5742` — OHOS 分支:bounds None 的 webview 保持 bounds-less(自然布局,注释自称 natural)。**该分支行为本身正确,不是缺陷点**。
3. `wry/src/ohos/mod.rs:730-738` — `is_child && bounds.is_some()` → create 请求 `style.{x,y,width,height}` 四值全量下发;`:1130-1136` — `set_bounds` → `PendingOp::SetBounds(x,y,w,h)` 全量下发,`bounds_cache` 记录。
4. `openharmony-ability/crates/plugin-webview/src/lib.rs:1564-1576` — `WebviewHandle::set_bounds` → bridge action `set-bounds`,四值全量。
5. **缺陷点**:`openharmony-ability/plugins/webview/src/main/ets/WebviewPlugin.ets`
   - `:877-915` `normalizeStyle` 透传 style.width/height(ArkTS 接口 `:92-103` 亦声明 width/height 字段)——但渲染层从不消费;
   - `:1340-1342`(overlay 分支)/ `:1466-1468`(direct 分支)Web 组件恒 `.width("100%").height("100%").position({x,y})`,style.width/height 被丢弃;
   - `:2690-2702` `setBounds()` 只写 `style.x/y` 后 `entry.node.update(entry.data)`,width/height 注释自陈「intentionally ignored」。

即 HEAD 上:**显式 bounds 的子 webview 一律渲染为整窗尺寸、位置正确**——与消费方症状同构(消费方 Tab 内容层即此形态)。历史对应物:openharmony-ability `0cac4c3` 引入「一律 100%」(修复主 webview resize relayout 缺陷,却使子 webview 变整窗),`d5308281` 收窄为 naturalLayout 守卫(创建无 style.width → natural,运行时 set_bounds 剥宽高);HAR 路径删除分两步(ArkHelper.ets/OHA NAPI set_bounds 由 pluginization ec27af65/c40ad0a2 先删,承载 naturalLayout 语义的 DefaultWebview.ets/NewWindowDialog.ets/Utils.ets 残留由 694cce82 后删),新桥把「100% 兜底 + set_bounds 忽略宽高」带了过来而**没有**把「创建显式尺寸生效」带过来。

### 历史语义考古(消费方 fork 基线)

消费方在 Eulogizethesun fork ohdev-git 分支(落后数十 commit),仍用已删除的 HAR webview 路径:
- `0cac4c3` 态:一律 100%(任何 webview 都整窗);
- `d5308281` 态(2026-08-19):`naturalLayout = (style.width === undefined)` 于创建时定格;natural webview 的运行时 set_bounds 剥掉宽高(`DefaultWebview.ets:826`/`:1165`)。

消费方指纹(position 生效、尺寸整窗)在 `d5308281` 语义下 ⇒ 其创建请求**无 style.width**。来源二选一:乙=其 app 的 `layout_content_rect` 创建时未给出尺寸(或给出整窗);甲=其 app 给了但被栈吞(其 fork 若早于 d5308281,即 0cac4c3 态,则即使给了也整窗)。两者的复测判据见「归属复测方案」。

### 技术约束(design 需知)

- `BuilderNode.update` 不刷新链式组件属性(`.claude/skills/tauri-ohos-design/references/ohos-constraints.md` §4.1;vibrancy backdropBlur 反例);运行时刷新用 `AttributeUpdater`(`modifier.attribute?.width(w)` 立即生效,不需 @State;先例 p1-window-vibrancy BlurModifier,`openspec/changes/archive/2026-07-04-p1-window-vibrancy/design.md:131-144`)。
- 「BuilderNode.update 不通知 ArkWeb relayout」(tauri-runtime-wry `:5736-5740` 注释)是历史上放弃固定 px 的论据;但 natural layout 下 ArkWeb 经**容器布局**跟踪尺寸已大量实证(各 Float 子窗、窗口 resize)。⇒ 修复选容器布局路径而非直改 Web 组件属性(见决策 D1)。
- 命中区即组件几何:direct 分支外层 Stack 的 `onMouse` 焦点门控(WebviewPlugin.ets:1548-1562;overlay 分支同构门控在 1430-1446,两分支门控均绑定在各自外层 Stack 上)绑定在 wrapper 上,几何迁移到 wrapper 后门控区域随几何收窄,语义不变。
- 套件盲区(实证):`examples/api/src/lib/tests/core.ts:1416-1420` multi-webview 用例仅断言 Rust 回读(`child.position()/size()` = wry bounds_cache);`cmd.rs:2152` `set_bounds_test` 同病(cache 往返)。本缺陷形态即「Rust 记录正确、ArkTS 渲染错」。

## Goals & Non-Goals

### Goals

1. HEAD 新桥落地完整几何语义:create 显式 bounds 生效;`set_bounds` x/y/width/height 全量生效;naturalLayout 收窄为「创建时无显式尺寸 → 跟随父容器」且首次显式几何翻转。
2. 红灯先行:新增断言 ArkTS 渲染层真值的用例,在当前 HEAD 上实证失败,修复后转绿。
3. desktop 基线(307✅)零回归;命中区与 resize 行为真机回归。
4. 归属复测方案 + 裁定逻辑(甲/乙),产出消费方交付面文档。

### Non-Goals

- 不修消费方 app 代码(Eulogizethesun fork 非我方仓);仅产出修复建议。
- 不改 wry/tauri-runtime-wry 的 Rust 行为(bounds 下发链路已全量正确)。
- 不处理同用 `entry.node.update` 机制、可能同样受 BuilderNode.update 限制的 `setVisible`/`setBackgroundColor`/blurRadius 刷新(独立问题,记 concerns)。
- 不实现 hit-region 真实 uinput 注入进 auto 套件(driver 危险命令不入 auto 套件);真实点击验证仅在归属复测(手动/设备)中执行。
- 不动 `wry OHOS bounds SHALL return cached value` 与 `set_visible` 两条既有需求(行为未变)。

## Decisions

### 决策 D1:几何挂载点迁移到外层 Stack + AttributeUpdater(WebviewGeometryModifier)

**选择**:overlay/direct 两分支中,外层 Stack 容器承载几何(`.position/.width/.height`),Web 组件恒 `.width("100%").height("100%")` 不再携带 `.position`;运行时刷新经 `WebviewGeometryModifier extends AttributeUpdater<CommonAttribute>` 驱动。

**结构**(两分支一致):

```
Stack()                                        ← 几何承载者:build 时链式属性取 data.style;
  .attributeModifier(data.geometryModifier)    ← 挂在外层 Stack 上(不是 Web 组件)
  Web(...).width("100%").height("100%")        ← Web 恒 100% 跟随容器(容器布局驱动 ArkWeb viewport)
```

- build 时:Stack `.width(data.style.width ?? "100%").height(data.style.height ?? "100%").position({x: style.x ?? 0, y: style.y ?? 0})`——显式 bounds 直接生效,natural 保持 100%。
- 运行时(`setBounds` bridge action):写 `data.style.{x,y,width,height}` 后调 `geometryModifier.apply({x,y,width,height})`(内部 `attribute?.position(...)`/`attribute?.width(...)`/`attribute?.height(...)`)——绕开 BuilderNode.update 不刷新链式属性的限制;`entry.node.update(entry.data)` 保留用于其他属性。
- `initializeModifier` 留空(BlurModifier 先例:不覆盖 build 时链式属性)。

**为什么几何上移到 Stack(而非直改 Web 组件尺寸)**:
1. ArkWeb viewport 经容器布局跟踪尺寸的路径已被 natural layout 大量实证(所有 Float 子窗、窗口 resize 场景);直改 Web 组件属性是否触发 ArkWeb 内部 relayout 无实证,且历史注释(「bottom cutoff」)提示存在风险。
2. 命中区自动对齐:wrapper Stack 即命中边界(HEAD 上顶部页签带失灵正是由恒 100% 的越界 wrapper 解释,见 Context「关键判读」),wrapper 收窄到显式 rect 后页签条/关闭按钮命中区不再被越界 wrapper 覆盖(popover 佐证:边界正确的 webview 不抢输入)。焦点门控 onMouse 语义保持(门控区域=web 区域)。
3. overlay 分支的拖拽 Stack 与 direct 分支的焦点门控 Stack 本来就是外层,几何上移让「拖拽/门控覆盖面=web 实际区域」精确成立(direct 分支现有注释 1453-1455 声称的语义在 100% Stack 下并不精确)。

**备选与弃用理由**:
- 直改 Web `.width(w).height(w)` + modifier:ArkWeb relayout 无实证,历史 bottom-cutoff 论据无法排除 → 弃。
- 重建 BuilderNode(rebuild):Web 组件重建丢页面状态、闪屏 → 弃。
- 仅靠 `entry.node.update` 重跑 builder:约束 4.1 实证不刷新链式属性 → 弃(但保留 update 调用,处理非几何属性)。

### 决策 D2:naturalLayout 收窄与首次显式几何翻转

**选择**:
- `ManagedWebview` 新增 `naturalLayout: boolean`(create 时定格:`normalizeStyle` 后 `style.width === undefined && style.height === undefined`)。
- 创建:natural → Stack 100%(行为不变,主 webview WindowContent 路径即此);显式 → Stack 按 style 尺寸。
- 运行时 `setBounds(x,y,w,h)`:**全量生效,不论 naturalLayout**——首次显式 set_bounds 将 natural webview 翻转为显式尺寸(modifier 写入显式宽高)。
- 翻转后窗口 resize 不再自动跟随(tauri-runtime-wry autoresize 只跟踪 `webview_bounds` Some 且 `auto_resize=true` 的 webview,`tauri-runtime-wry:4901`;auto_resize 默认 false,`tauri-runtime/webview.rs:551`)。
- 边缘形态(部分 bounds):仅 width/height 之一显式 → `naturalLayout=false`,该维按显式值、另一维按 `?? "100%"` 兜底——build 链良好定义;该形态在 tauri 自身路径不可达(`add_child`/`create_webview` 的 bounds 位置+尺寸强制成对,webview/mod.rs:806),不设 spec 场景(N/A)。

**理由**:「后续 set_bounds 应能覆盖」是上游契约(wry `set_bounds`、tauri `Webview::setSize/setPosition` 均应生效);消费方形态(创建无尺寸、后续 set_bounds)在新语义下直接修复。翻转后不再跟随窗口 resize 与桌面平台语义一致(桌面非 auto_resize webview 调 set_bounds 后同样脱离默认布局)。主 webview 若被显式 set_bounds 即 opt-out 自然布局——与桌面「auto-dock 被 set_bounds 打破」同构,记录为已知权衡。

**备选与弃用理由**:维持 d5308281 语义(natural 永久剥宽高)→ 正是消费方缺陷本体,弃。

### 决策 D3:渲染真值断言 = 子 webview viewport 探针

**选择**:demo 注册探针命令对,子 webview 页面内脚本上报 `window.innerWidth/innerHeight`(+`document.documentElement.clientWidth/clientHeight`),测试主窗读取并断言等于请求几何。

- 探针命令(镜像 `cmd.rs` 既有 tracked-events 模式,如 `get_tracked_window_events`):
  - `track_webview_viewport_probe(tag, inner_width, inner_height, doc_width, doc_height)` — 子 webview 页面调用,Mutex 存储;
  - `get_tracked_webview_viewport_probes()` — 测试主窗轮询读取。
- 子 webview URL 用 `examples/api/public/` 下新增静态页(如 `webview-viewport-probe.html`),脚本在 load 与 `resize` 事件时上报(init scripts 已注入 `__TAURI_INTERNALS__`,child webview 与主窗同链路,iframe 探针先例 core.ts:41-98 佐证 IPC 可达性;子 webview 页面用裸 `__TAURI_INTERNALS__.invoke` 免依赖打包)。
- 为何 viewport 即渲染真值:Web 组件尺寸决定 ArkWeb viewport;「组件整窗、请求 300×200」时 viewport≈整窗(HEAD 红灯形态),修复后 viewport=300×200。viewport 同时决定内容布局与该 webview 的内容命中面,是缺陷的终端可观察量。

**备选与弃用理由**:
- 新增 ArkTS 侧 FrameNode rect 读回 bridge action(如 get-layout):直接读 ArkUI 组件真值,但为测试目的在生产桥加永久面 → 弃;若实现期 viewport 探针与组件真值出现背离,再补(记录为后续选项)。
- uinput 真实点击命中区用例:归归属复测(手动),不入 auto 套件。

### 决策 D4:Rust 侧零行为变更,注释对齐

- `tauri-runtime-wry/src/lib.rs:5736-5742` OHOS 分支:行为保留(bounds-less → natural 正确);注释改写——删除「BuilderNode.update does not notify ArkWeb to relayout」过时论据,改为「bounds-less webview 保持自然布局跟随容器;显式 bounds 的子 webview 由 ArkTS 渲染层按 style 尺寸渲染(set_bounds 可覆盖,见 ohos-webview-sizing)」。
- `wry/src/ohos/mod.rs:1105-1128` `bounds()` doc:cache 语义段不变;「ArkUI-initiated layout changes are not observed」段补充显式 bounds 语义现状。
- `WebviewPlugin.ets` 内三处「intentionally ignored / only .position() consumes」注释(direct 分支 1462-1465、setBounds 2695-2697、以及 wry create 注释如涉及)随语义改写。

## 归属复测方案(裁定 甲 vs 乙)

> 目标:区分「适配层栈缺陷(甲)」与「消费方 app 侧 layout_content_rect 缺陷(乙)」,按结果走不同交付分支。**本 change 的 ArkTS 语义修复(D1/D2)两分支下都落地**——HEAD 缺口已由代码考古独立确证,不依赖复测结论。

### R1 输入归属复测(消费方真机 192.168.0.4:46259,工具栏不活跃)

前置与干扰排除:
1. 退出白板/画布模式(或重启 app 后不进入),使 canvas-toolbar/toolbar 两全屏窗隐藏或销毁;
2. 打点前核实:`hdc -t <target> shell "hidumper -s WindowManagerService -a '-a'"` 确认 ZOrd 112/113 不在窗口列表(排除工具栏窗);
3. 排除残留透明窗(历史坑:全屏透明残留窗吃点击)——重启 app 后先列窗、点击落点用 InputKeyFlow wid 定位配方;
4. 关闭 popover 等弹层;`hilog` 后台抓取(grep --line-buffered 落文件配方)。

步骤:
1. 确认六个 webview 探针存活(消费方 app 自带探针);
2. uinput 真实点击页签条/关闭按钮坐标(截图定位 + down/up 注入配方);
3. 读探针与 hilog。

判据:
- **Tab 内容层探针收到 pointerdown** → 尺寸错误的 webview 是输入窃取者,与本 change 假设一致 → 进入 R2;
- **主壳收到 pointerdown 且页签动作执行** → 输入链路本身通,症状在别处(如点击后 IPC 丢失,与「账号登录弹不出」同族)→ 本 change 范围外,如实披露;
- **全空** → 命中测试链路另有拦截(残留窗/透明窗家族)→ 回到排除步骤 3 重测。

### R2 尺寸归属复测(裁定 甲/乙)

证据链(按优先级):
1. **渲染真值**:CDP attach Tab 内容层 webview(构建若开放 CDP)读 `window.innerWidth/innerHeight`——确认 viewport=1103×735(渲染层整窗),排除探针误报;
2. **fork 栈考古定性**:确认消费方 fork 基线相对 `d5308281`(2026-08-19)的位置——早于它(0cac4c3 态)则**任何**创建(含显式 bounds)都整窗 → 直接判甲(栈缺陷,升级路径);晚于它则继续 3;
3. **创建载荷证据**(需消费方配合,二选一):其 fork 开 webview create/set-bounds debug hilog 抓 `layout_content_rect` 输出与下发载荷;或其提供 `layout_content_rect` 源码/单测。
   - create 请求带正确 Tab 区 rect(width≈1103、height≈687)却渲染整窗 → **甲**(栈吞显式尺寸);
   - create 请求无 width/height(或整窗)→ **乙**(app 侧未在创建时给出尺寸,依赖后续 set_bounds)。

裁定逻辑与交付分支:
- **甲** → 本 change 落地修复(D1/D2)+ 交付文档给出升级指引(升级至含本 change 的 HEAD 栈后,显式 bounds 与 set_bounds 覆盖均生效);若其 fork 早于 d5308281,另附「临时止血:cherry-pick d5308281」选项。
- **乙** → 本 change 落地修复(D1/D2,语义缺口的配套修正)+ 交付文档给出消费方 app 侧修复建议:`layout_content_rect` 在创建时显式传 Tab 区 rect(其 fork 的 d5308281 语义下 naturalLayout=false 即生效);升级路径下亦可保持「创建无尺寸 + set_bounds」形态(新语义支持覆盖)。
- 两种裁定的共同部分:HEAD 语义修复、红灯转绿、desktop 基线回归——在复测结论之前即可开工(任务组 1-4);裁定仅决定任务组 5/6 的文档内容侧重。

## Risks & Trade-offs

- [AttributeUpdater 宽高刷新对 BuilderNode 挂载组件无本仓直接先例(BlurModifier 先例为旧 NodeController 路径)] → 实现期第一步即真机红灯用例验证;若 `attribute?.width()` 不生效,回退方案为对 Stack 用 FrameNode 布局属性或重建前先验证 `node.update` 对 Stack 尺寸的实际行为(以红灯用例输出为准,不静默换路径)。
- [ArkWeb viewport 对容器布局尺寸变化的跟踪仅在「窗口级 resize」实证过,子 webview 局部容器 resize 未单测过] → viewport 探针用例同时覆盖 create 显式与 setSize 两形态;真机验证项:子 webview 尺寸变化后页面内容无 bottom cutoff(与历史缺陷对照)。
- [几何迁移改动 direct/overlay 两分支 + 焦点门控 onMouse 区域] → 真机回归:menubar 点击、子 webview 命中、拖拽 overlay 覆盖面;desktop 基线 307✅ 全量复跑。
- [natural→explicit 翻转后 webview 不再跟随窗口 resize] → 与桌面语义一致,属正确行为;文档标注;auto_resize 用户不受影响(rates 路径照常)。
- [探针命令新增为 demo 生产面] → 只读、无副作用,命名与既有 tracked-events 族一致,不引入 ACL 变化(examples/api build.rs AppManifest 为权限唯一真源,探针为普通 command 无需权限)。
- [消费方复测依赖其配合程度] → R2 第 3 环证据不可得时,裁定降级为「双分支交付」:文档同时含甲升级指引与乙 app 侧建议,并明确标注未决;不阻塞本 change 收口。

## Test Design

### 测试策略

- 设备用例(examples/api,`tests/core.ts` 追加,run 经 `.claude/skills/ohos-build/scripts/run-tests.sh("" desktop)`):红灯先行——在当前 HEAD 上必须失败(断言 ArkTS 渲染真值),修复后转绿;desktop 基线 307✅ 回归。
- ArkTS 侧无单测设施(约束 §7.1:OHOS UT 只能测纯函数,几何刷新为设备行为)→ 语义正确性由设备用例承载;Rust 侧行为零变更,不新增 Rust UT。
- error path 维度定性 N/A:本 change 不新增错误面——`set-bounds` bridge action 与参数校验已存在(WebviewPlugin.ets:3147-3162),探针命令只读存储;错误路径由既有套件覆盖,不为本 change 重复造错误用例。
- 归属复测为设备手动流程(R1/R2),不进 auto 套件,产出记录进裁定文档。

### Spec → Test 映射

delta 共 11 个 MODIFIED/ADDED scenario,全部可追溯:

| Spec Scenario | Test Function | Type | 期望值 |
|---------------|--------------|------|--------|
| [MODIFIED] Web component uses style width/height when set (S1) | `webview child created with explicit bounds renders at requested size` (core.ts,case a 第一段) | 设备 auto | 请求 (x=50,y=50,w=300,h=200) → 探针 innerWidth=300 且 innerHeight=200(±0;2in1 PC density 1.0,vp==px,判据来源:wry bounds() doc 单位契约 wry/src/ohos/mod.rs:1108-1116)——红灯判据:HEAD 上实测≈整窗 |
| [MODIFIED] width/height carried through the bridge wire (S3) | 同 case a(可观察代理) | 设备 auto | 渲染几何==请求几何即为 wire 全量消费的可观察代理;wire 四值下发已由代码考古核实(wry/src/ohos/mod.rs:730-738,无需运行时断言) |
| [ADDED] child webview created with explicit bounds renders at requested size (S4) | 同 case a | 设备 auto | 同 S1(300×200) |
| [ADDED] oversized rendering is the defect signature (S6,红灯判据) | 同 case a 红灯分支 | 设备 auto | 精确谓词:case a 前先读主窗 viewport 宽 M(主窗页面 window.innerWidth);HEAD 上 child innerWidth === M 且 ≠ 300 → 红灯成立;修复后 innerWidth === 300 → 绿 |
| [ADDED] two non-overlapping child webviews each keep their own geometry (S5) | 同 case a 第二段(创建第二个 child 于不重叠 rect,两探针各自上报) | 设备 auto | 两 viewport 互不等于整窗、互等于各自请求值;主窗 `child.position()/size()` Rust 回读同值(双真值一致)。注:命中区不覆盖子句以 viewport 等值为 auto 代理(收窄),真实点击归属由 R1 手动复测承载(design 归属复测方案) |
| [ADDED] setSize changes the rendered viewport of a child webview (S7) | `webview child setSize/setPosition change rendered geometry` (core.ts,case b) | 设备 auto | 初始 300×200 → `child.setSize(new LogicalSize(400,300))` + `child.setPosition(...)` 后探针 resize 事件上报 innerWidth=400/innerHeight=300——红灯判据:HEAD 上尺寸不变(仅位置可能变) |
| [ADDED] consecutive set_bounds calls — last one wins (S8) | 同 case b 第三段 | 设备 auto | 再 setSize(250,150) → 探针=250×150(防合并/丢弃,镜像 window-ops.ts:394-399 形态) |
| [MODIFIED] Web component defaults to 100% when width/height not set (S2) | `sub-window natural webview follows container then flips explicit via set_bounds` (core.ts,case c 前置段) | 设备 auto | `new WebviewWindow(label,{url:探针页,width:500,height:400})` 副窗主 webview 天然 bounds-less(WindowContent)→ 断言真值=副窗页自报探针 innerWidth/innerHeight(对照创建参数的期望内容区);主窗读 innerSize 仅作粗核(副窗可能带装饰/安全区,内容区≠innerSize,不做严格相等断言) |
| [ADDED] bounds-less webview viewport equals container size (S10) | 同 case c 前置段 | 设备 auto | 同 S2(探针==容器内容区) |
| [ADDED] bounds-less webview follows window resize without Rust re-issue (S11) | 同 case c 中段 | 设备 auto | 副窗 setSize(600,450) 后轮询探针 → 探针跟随新内容区尺寸(±0);HEAD 上此段已绿(100% 兜底),作防回归护栏 |
| [ADDED] set_bounds overrides natural layout (S9) | 同 case c 末段(翻转) | 设备 auto | `await Webview.getByLabel(副窗label)` → `setSize(new LogicalSize(320,240))` → 探针 resize 上报=320×240(自然布局被首次显式几何覆盖)——HEAD 上红灯(尺寸不变);清理 finally `win.destroy()` |

位置断言载体注记(与 S5 命中子句收窄注记同风格):S4 的 AND「渲染位置 SHALL 等于请求位置」、S7 的 THEN「渲染位置变为 (60,70)」、S8/S9 的「最终渲染几何」中的位置分量,在 auto 层不设载体——探针(task 1.1)仅上报 viewport 尺寸,ArkWeb 子 webview 的 window.screenX/screenY 对 webview 屏幕位置是否可靠无实证,不纳入探针上报;位置断言由 task 4.2 真机手动命中区回归承载(子 webview 渲染于请求位置=命中回归落点前提)。位置语义在 HEAD 已由 Web `.position({x,y})` 生效(Context「position 生效、size 被忽略」指纹),红灯/绿灯差异全在尺寸分量,auto 层不漏判。

用例全部 auto 类且 finally 清理(close/destroy),不遗留子 webview 干扰后续用例;探针轮询预算显式 timeout:10000(镜像 window-ops.ts:361-365 预算理由)。

### 测试基础设施

- Fixtures:`webview-viewport-probe.html`(examples/api/public/,静态探针页)+ demo 探针命令对(`cmd.rs::track_webview_viewport_probe` / `cmd.rs::get_tracked_webview_viewport_probes`,登记 `lib.rs` generate_handler)。
- Shared:复用 core.ts 既有 `assert`/`delay` 与套件 TestCase 框架(`{name, category:'auto', timeout}`)。
- 外部依赖:无新增 npm 依赖;子页面用裸 `__TAURI_INTERNALS__.invoke`;翻转驱动用 `Webview.getByLabel`(packages/api/src/webview.ts:225)+ `Webview.setSize`(webview.ts:453),无需新增 demo 命令。

## Task Signals

tags: [ohos]
routed_skills: [rust-ohos]

(rust-ohos 已查——域内容为 BUILD.gn 构建模板,与本 change 的 tauri-ohos fork 栈不适用,无模式可吸收;OHOS 约束改以 `.claude/skills/tauri-ohos-design/references/ohos-constraints.md` 为准。PB-A/PB-C:.botbrain/.projectbrain 不存在,⚠️ unavailable。)
