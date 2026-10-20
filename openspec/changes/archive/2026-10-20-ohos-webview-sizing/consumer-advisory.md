# 消费方交付面说明:zhkt60 教师端 Tab 内容层尺寸越界(ohos-webview-sizing)

> 交付对象:消费方 zhkt60 教师端(HarmonyOS PC 2in1 真机,Eulogizethesun fork ohdev-git 分支)。
> 机制表述以 change `ohos-webview-sizing` design Context「关键判读」为准;归属裁定(R1/R2)已于
> **2026-10-20 在本机 2in1 上用客户真包(v6.0.0 hap 2026-10-19 / ohrs-ability@1.0.0-beta.1)复测完成:判定甲**(§7)。
> §3 升级路径适用(含一处栈形态勘正);§4 乙分支被证伪为单独可行的修复。

## 1. 缺陷签名(消费方真机实测)

| webview | 屏幕原点 | 尺寸 | 判定 |
|---|---|---|---|
| 主壳 | (450,177) | 1103×735 | — |
| 资源预览内容层(Tab 内容层) | (450,225) | 1103×735 | ❌ 与主壳同高,应为 Tab 区高度(≈687) |
| 登录窗(独立 OS 窗) | (613,239) | 420×620 | ✅ |
| popover(独立 OS 窗) | (520,230) | 360×308 | ✅ |

- 「position 生效、size 被忽略」指纹:Tab 内容层相对窗原点 (0,48) 已生效(顶部 48px 页签带让位正确),尺寸却等于整窗。
- **越界主体是承载 Web 的 wrapper(Web/Stack),不是 Web 组件自身**:Tab 内容层自身几何 (0,48)+1103×735 并不覆盖顶部页签带,页签条/关闭按钮点不动只能由**恒 100%×100% 铺满整窗的外层 wrapper Stack** 解释——wrapper 即命中边界,越界 wrapper 把页签带的命中区盖住了。边界正确的 popover(独立窗)不抢输入佐证:是「渲染层几何越界覆盖命中区」而非「存在子 webview 就吞输入」。
- 归属复测曾被 ZOrd 112/113 全屏工具栏窗污染(六个 webview 探针全空);复测须先排除(§5)。

## 2. 根因(HEAD 栈考古确证)

消费方 fork 仍用已删除的 HAR webview 路径;其指纹(position 生效、尺寸整窗)与两段历史语义对应:

- `0cac4c3` 态:渲染层**一律 100%**(为修主 webview resize relayout 引入,副作用=任何 webview 都整窗);
- `d5308281`(2026-08-19)态:`naturalLayout = (style.width === undefined)` 创建时定格;natural webview 的运行时 set_bounds 剥掉宽高,**创建时显式尺寸生效**。

HEAD 新桥 ArkTS 渲染层(`WebviewPlugin.ets`)把「100% 兜底 + set_bounds 忽略宽高」带了过来,**没有**把「创建显式尺寸生效」带过来:

1. create 请求的 `style.width/height` 经 `normalizeStyle` 透传后**从未被渲染层消费**——Web 组件恒 `.width("100%").height("100%")`,外层 wrapper Stack 恒整窗;
2. `setBounds()` bridge action 只写 x/y,width/height 注释自陈「intentionally ignored」。

⇒ 任何 `add_child` 显式 bounds 的子 webview 在 HEAD 上都渲染为整窗尺寸(仅位置正确)——「Rust 记录正确(bounds_cache/wry 四值下发全量正确)、ArkTS 渲染错」。

## 3. 分支甲(适配层栈缺陷):升级指引

适用判据(design R2):消费方 create 请求**带正确 Tab 区 rect**(width≈1103、height≈687)却渲染整窗;或其 fork 基线早于 `d5308281`(0cac4c3 态——此时**任何**创建含显式 bounds 都整窗)。

- **根治:升级至含本 change 的 HEAD 栈**。本 change 已在 HEAD 栈落地完整几何语义(openharmony-ability `WebviewPlugin.ets`):
  - create 显式 bounds → wrapper Stack 按请求 x/y/width/height 渲染(不再整窗兜底),命中区随几何收窄,页签带可点;
  - `set_bounds` 全量生效(x/y/width/height),连续调用最后一次为准;
  - 创建无尺寸 → 自然布局跟随容器,首次显式 set_bounds 翻转为显式尺寸(翻转后不再跟随窗口 resize,与桌面「set_bounds 打破 auto-dock」语义一致)。
- **临时止血(不升级时)**:cherry-pick `d5308281`("restore explicit child webview bounds with naturalLayout guard")到其 fork——该提交在其 HAR webview 路径上恢复「创建显式尺寸生效」语义。**勘正(2026-10-20 复测)**:beta.1 实测已是新桥 `WebviewPlugin.ets` 路径(§7 R2.2),`d5308281` 修的是旧 HAR 路径、对其不直接适用;新桥路径上的等价止血目标 = 本 change 四提交(openharmony-ability `5c4b5a9` + tauri `f62e5620b`/`dd4956b63` + wry `8e381e6`)。
- 升级后其现形态(创建无尺寸 + 后续 set_bounds)**也可直接工作**(新语义 set_bounds 覆盖自然布局),无需改 app 代码。

## 4. 分支乙(app 侧 layout_content_rect 缺陷):app 侧修复建议

适用判据(design R2):消费方 create 请求**无 width/height**(或给整窗)——app 侧未在创建时给出 Tab 区尺寸,依赖后续 set_bounds,而其 fork 语义下后续 set_bounds 剥宽高 → 恒整窗。

- **app 侧修复(不升级栈)**:`layout_content_rect` 在**创建 webview 时**显式传 Tab 区 rect(width≈1103、height≈687,相对窗内容区 x=0、y=48)——其 fork 若在 `d5308281` 语义上,创建携带显式尺寸即 `naturalLayout=false`,渲染层按请求尺寸渲染。
- **升级路径下**:亦可保持「创建无尺寸 + set_bounds」形态——新语义下 set_bounds 全量覆盖并翻转自然布局,两条路都通。
- 注意:创建时**只传位置不传尺寸**正是触发本缺陷的形态;位置+尺寸必须成对(tauri 自身路径 `add_child`/`create_webview` 亦强制成对)。

## 5. 归属复测配方(设备接入后执行,裁定 甲/乙)

### R1 输入归属(排除干扰后 uinput 真实点击页签条)

1. 退出白板/画布模式(或重启 app 后不进入),使 canvas-toolbar/toolbar 两全屏窗隐藏或销毁;
2. 打点前核实:`hdc -t <target> shell "hidumper -s WindowManagerService -a '-a'"` 确认 ZOrd 112/113 不在窗口列表;
3. 排残留透明窗(重启 app 后先列窗,点击落点用 InputKeyFlow wid 定位);
4. 关闭 popover 等弹层;hilog 后台抓取(DEBUG 级,grep 锚定写法防子串陷阱);
5. uinput 真实点击页签条/关闭按钮坐标(截图定位 + down/up 注入),读消费方自带 webview 探针与 hilog。

判据三分支:Tab 内容层探针收到 pointerdown → 尺寸错误的 webview 是输入窃取者(与本文 §1 判读一致,进 R2);主壳收到且页签动作执行 → 症状在别处(如实披露,范围外);全空 → 命中链路另有拦截,回步骤 3 重测。

### R2 尺寸归属(证据链按优先级)

1. 渲染真值:CDP attach Tab 内容层 webview(构建若开放 CDP)读 `window.innerWidth/innerHeight`,确认 viewport=1103×735(排除探针误报);
2. fork 栈考古定性:确认其 fork 基线相对 `d5308281`(2026-08-19)位置——早于它 → 直接判甲;晚于它 → 继续 3;
3. 创建载荷证据(需消费方配合):其 fork 开 webview create/set-bounds debug hilog 抓 `layout_content_rect` 输出与下发载荷,或提供 `layout_content_rect` 源码/单测——带正确 Tab 区 rect 却渲染整窗 → **甲**;无 width/height(或整窗)→ **乙**。
4. 证据不可得 → 维持本文档双分支兜底,标注未决。

## 6. 验证状态(本 change 侧)

- 红灯先行:examples/api 套件新增 3 条 ArkTS 渲染真值用例(子 webview viewport 探针),HEAD 上实测红灯(case a/b 全红 + case c 翻转段红;实测值见同目录 `red-light-evidence.md`);
- 修复后转绿 + desktop 基线全量回归(见同目录红灯/绿灯证据档);
- 消费方复测(R1/R2):**已完成(2026-10-20,本机 2in1 + 客户真包),判定甲**,证据见 §7 与 `D:\xuqiu\tauri-3.0\r1-20261020\SYMPTOM-EVIDENCE-2026-10-20.md` §5。

## 7. 归属复测结果(2026-10-20,已裁定:甲)

复测环境:客户真包 `com.example.tauri_hello_ohos` v6.0.0(hap 2026-10-19,桥接 `@ylong-rs/ohrs-ability@1.0.0-beta.1`)运行于本机 2in1(3120×2080,主窗 912 = [515,281] 2090×1394,scale 1.9),用户真实鼠标点击,`hilog` 全程落盘(`hilog-app4.log`)。

### R1 输入归属 —— 分支①命中:尺寸错误的 webview 是输入窃取者(原生输入层实证)

- 页签带点击(CSS(138,24)/(177,24),物理 (777,327)/(851,327),即页签与页签关闭钮中心)全部送达 **web id 7 = 资源预览内容层**:`WebPattern::HandleMouseEvent, web id 7` ×3(15:56:05.755/06.356/06.881)+ chromium `InputRouterImpl MouseDown ack CONSUMED` + `ConsumePointerEventInner wid:912`;
- 主壳(web id 1)在内容层创建(15:30:15.777 `ohos.webview/create`)之后**零鼠标事件**——id 1 最后事件 15:30:15.766 恰是触发创建预览的那次点击;
- 期间「有反应」的最小化/最大化/关闭全部是**原生 container-modal chrome**:`AceAppBar container window double click → MaximizeFloating id:912`(15:56:15.408)/还原(15:56:16.926)、原生 `minimize button clicked → WindowSceneSessionImpl Minimize`(15:56:28.195)、close → `destroy-window`(15:56:40.317)→ 进程 exit 0。webview 内 DOM `.wc__group` 窗控组实际不可达(wrapper 命中区 + 原生 chrome 双重覆盖)——消费方症状①「窗口关闭按钮点不动」的 DOM 按钮部分与本指纹一致;
- 课件内容区点击 → web id 7 自身 DOM → 翻页正常(窃取者就是内容层,点它自己的内容当然有反应)。
- 执行偏差(不影响裁定):(a) ⑤ 关闭真实终止了 app,JS 探针随进程销毁,改用更底层的原生输入证据(AceWeb/chromium/InputKeyFlow)裁定;(b) 工具栏全屏窗 917/918 在场但已实证 click-through(SYMPTOM-EVIDENCE §3.2 判别实验),无输入污染;(c) 所点页签为当前活动页签(设计上无动作),但「点击被窃、未达主壳」的输入层证据先于该混淆成立;(d) 窗控钮测试教训:双击会命中原生标题栏双击语义(=最大化/还原),单击才测得到按钮本身。

### R2 尺寸归属 —— 判甲

1. **渲染真值(R2.1)**:CDP 读 Tab 内容层 viewport = **1101×734 CSS(= 2090×1394 物理)= 整窗**;NWeb 尺寸记录(15:30:15.808 创建):1×1 → 3120×2080 → **2090×1394**,全程无内容层高度(≈1302 物理)出现。§1 指纹在客户真包上复现。
2. **栈考古(R2.2)**:提取 beta.1 HAR 的 webview 渲染层(`wv-beta1.ets`,2798 行):
   - builder 中 Web 组件**无条件 `.width("100%").height("100%")`**——全文件仅有的 8 处 `.width/.height` 调用全部是 `"100%"` 字面量,注释自陈「only .position() below consumes style.{x,y}」;
   - create 载荷 `style.width/height` 经 `normalizeStyle`(843-881)解析入 style 后**无任何消费者**;
   - `setBounds()`(2364-2376)只写 `style.x/y`,注释「width/height are intentionally ignored」;bridge 侧 set-bounds 动作(2761-2767)校验四元数后仍丢弃宽高。
   ⇒ beta.1 =「一律 100%」态(与 §2 所述 HEAD 修复前的新桥渲染层同构,连 `normalizeStyle` 透传后无人消费的行号结构都一致),**无 naturalLayout 概念**——app 无论创建时传不传 rect、set_bounds 传什么,都渲染整窗。按 §5 R2 判据(基线语义早于 `d5308281` 的「创建显式尺寸生效」):**直接判甲**;分支乙(app 侧补 rect)单独执行**无效**。
3. **栈形态勘正**:§2 曾假设消费方「仍用已删除的 HAR webview 旧路径」——实测 beta.1 已是新桥 `WebviewPlugin.ets` 路径。§3 的 cherry-pick 止血项已相应勘正(见 §3)。
4. 消费方当前形态实测 = 创建(15:30:15.777)后紧跟 set-bounds(15:30:15.829,四元数被丢宽高)——升级至含本 change 的 HAR 后**无需改 app 代码**即可工作(§3 末条)。
