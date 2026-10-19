# 消费方交付面说明:zhkt60 教师端 Tab 内容层尺寸越界(ohos-webview-sizing)

> 交付对象:消费方 zhkt60 教师端(HarmonyOS PC 2in1 真机,Eulogizethesun fork ohdev-git 分支)。
> 机制表述以 change `ohos-webview-sizing` design Context「关键判读」为准;归属裁定(R1/R2)因
> 消费方设备未接入而**未决**,本文档按双分支兜底交付(甲=适配层栈缺陷→升级路径;乙=app 侧
> layout_content_rect 缺陷→app 侧修复建议)。设备接入后按 §5 配方复测,裁定结果决定 §3/§4 的适用侧重。

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
- **临时止血(不升级时)**:cherry-pick `d5308281`("restore explicit child webview bounds with naturalLayout guard")到其 fork——该提交在其 HAR webview 路径上恢复「创建显式尺寸生效」语义。
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
- 消费方复测(R1/R2):**待消费方设备接入**,双分支兜底未决(§5 配方备妥)。
