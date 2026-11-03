# Proposal: ohos-committer-issues-followup

## Why

10-26 对账扫描发现 Eulogizethesun/tauri #168-#236 批次外有五条漏排 committer issue(#237/#238/#239/#240/#242),用户已批准归域方案:#237/#238/#240 纯甲、#242 甲主责、#239 甲牵头双仓协同(仅立项草案)。五条正文已逐条核实,我方树均未顺带修复(基线 tauri 8fdbbdb21 / tao 50d04f8c / openharmony-ability 7b6ff77,ohdev 分支)。

五条共同根因两类:

1. **静默假成功违反本仓修复口径**:#237 `hide()` 降级为最小化(语义错误 + `is_minimized` 镜像分叉)、#238 主窗 setMaximizable/setMinimizable/setClosable 静默 no-op——修复口径明确"不支持的能力应返回错误(Err/throw)并在接口文档注明平台差异,不得静默假成功";
2. **命名/口径漂移**:#240 Float 命名与 createSubWindow 应用子窗口实现不符 + `window_type` 死字段、#242 入口属性在 OHOS 桌面形态的 cfg 语义缺口、#239 `desktop` 别名复用导致组合补丁爆炸——按名推断行为会失准,且持续抬高上游合并成本。

## What Changes

四条修复 + 一条立项草案:

1. **#237 窗口可见性诚实化**(tao + tauri-runtime-wry + openharmony-ability + docs):删 `set_visible(false)` 的 minimize 降级,`hide()` 在 tauri 公共 API 层返回 `Err(NotSupported)`;`set_visible(true)` 镜像条件化(仅最小化窗走 restore+show,修复对可见最大化窗的 un-maximize 危害);删 ArkTS 死代码 `hideWindow`;接口文档补 OHOS 差异(待 A1 hide_ability 权益后恢复)。
2. **#238 主窗装饰按钮诚实化**(同上四层):SDK d.ts 实证 OHOS 无主窗逐钮启停 API → 三个 setter 主窗返回 `Err(NotSupported)`(ArkTS 侧 throw);`is_minimizable/is_maximizable/is_closable` 主窗回真状态(true)、子窗回 intent 位;Float 子窗路径回归保持;创建期装饰 seed 主窗 warn+忽略。
3. **#240 SubWindow 命名与死字段清理**(tao + ability + tauri-runtime + examples + docs):删 `OHOSWindowType` 与 `window_type` 全链路;`OHOSWindowKind::Float`→`SubWindow` 直接改名(仓未发布无兼容负担);ArkTS `WindowKind.Float`→`SubWindow`、`FloatPage`→`SubWindowPage`;文档口径校正(应用子窗口 vs TYPE_FLOAT 全局悬浮窗)。
4. **#242 OHOS 入口属性双写机制**(tauri-macros + tauri + examples + tauri-cli):按 issue #242 正文已验证设计落地 `tauri::ohos::entry_point`(兄弟属性摘除防 E0428、平台互补 cfg 门控),10 文件迁移 + 4 写法×2 形态兼容矩阵验证;可选后续(doc 可见性/导出门控收紧)不做,回复中披露。
5. **#239 cfg 形态别名迁移立项草案**(仅文档,零实现):产出协调文档供用户与乙单位对齐(工作区根,不入仓)——别名发射点改造、~357 处门控盘点方法、三分类迁移法、分波建议、乙协同面、phone/tablet 回归策略、上游合并成本。

## Capabilities

### New Capabilities

- **ohos-entry-point-attributes**:OHOS 入口属性双写机制——`tauri::mobile_entry_point` 与 `tauri::ohos::entry_point` 同写时恰好一个展开器生效(兄弟属性摘除),四写法×两形态兼容矩阵成立,入口胶水按平台互补 cfg 裁剪。

### Modified Capabilities

- **ohos-window-ops**:可见性需求推翻重写(hide 诚实 Err、show 镜像条件化不 un-maximize);新增主窗装饰按钮诚实化需求(三 setter 主窗 Err、is_* 真状态、子窗回归保持、创建期 seed warn);新增 SubWindow 命名与死字段清除需求。

## Impact

- **波及仓**:tao / openharmony-ability / tauri(tauri-runtime、tauri-runtime-wry、tauri-macros、tauri-cli、examples);**不改 wry**。
- **规模**:预估 ~1000-1500 行(tao ~250 / ability ~250 / tauri 含 macros+examples+CLI 模板 ~700 / 文档若干)+ #239 草案一份(仓外)。
- **破坏性变更**:#240 `OHOSWindowKind::Float`→`SubWindow` 直接改名(已定决策:仓未发布无兼容负担,examples 11 处同步);#237 `hide()` 行为从降级最小化变为 Err(调用方可见行为变化,issue 要求 2)——两个树内调用方同步处置:套件用例 `float.hide+show+center` 更新为 reject 断言、托盘 toggle OHOS 路径改 minimize/show 适配,均在 issue 回复披露。
- **HAR 波及**:#238/#240 改 ArkTS → 重打 HAR 且须清 oh_modules + CompileArkTS。
- **回归面**:examples/api 套件 324 基线(⏭=8)+ tao/ability 设备 UT + tauri-macros UT(≥4)+ OHOS 交叉编译双形态矩阵(4 写法×2 形态)+ host 回归。
- **范围外**:push 与 issue 回复须用户另行确认;#239 草案文档位于工作区根(D:\xuqiu\tauri-3.0\),不进任何仓,rb-ship 范围检查不涉及;MenuBarComponent.ets 不动(归乙 #205,其 :11/:661 仅注释提及 FloatPage,代码零引用,注释陈旧在 issue 回复披露);#238 真机 spot-check 若发现系统反证 API 则升级 PM 重议路径。
