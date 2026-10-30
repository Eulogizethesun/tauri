# Design

## Context

### 四层链路与 Err 出口唯一性(全 change 的架构基线)

以 `hide()` 为例,调用链四层:

1. **tauri 公共 API**:`WebviewWindow::show()`/`hide()`(crates/tauri/src/webview/webview_window.rs:2279/:2284),均返回 `crate::Result<()>`——应用唯一可见出口;
2. **tauri-runtime-wry dispatcher**:`WryWindowDispatcher::show/hide`(crates/tauri-runtime-wry/src/lib.rs:2475/:2482)经 `send_user_message`(:327-347)fire-and-forget 发 `WindowMessage::Show/Hide`;
3. **event-loop handler**(:3899-3900)调 tao `set_visible(bool)`,**有意丢弃 tao 返回值**(tao 本就是 void);
4. **tao OHOS 实现**:`Window::set_visible`(src/platform_impl/ohos/window.rs:1548-1598),void 签名与 upstream 一致不可分叉。

**Err 出口唯一性由既有 helper 自证**:runtime-wry `ohos_unsupported(op)`(:189-196)文档注释明确——"Applied at the dispatcher layer (not tao) because the runtime-wry message handlers intentionally discard tao Results, so a tao-level Err never reaches the caller"。因此 #237/#238 的 Err 一律落 **dispatcher 层**,tao 层降级为 `log::error`(防直接 tao 调用方假成功)。此模式有先例:主 spec "set_enabled on OHOS reports unsupported instead of faking success"。

### 五条 issue 现场(正文已核实,锚点为当前树实测行号)

| Issue | 现场要点 |
|---|---|
| #237 | tao `set_visible(false)` 降级 minimize + 写 mirror.minimized(:1548-1598 内);OHOS @ohos.window 无窗口级 hide 方法(仅 keyboard*Hide 事件);hideAbility 是 UIAbility 级且 PC/2in1 不可用(WindowManager.ets:966-968 注释自证),属 A1 权益范围外 |
| #238 | ArkTS `setDecorationFlags` 主窗分支显式 no-op(WindowManager.ets:1119-1126 hilog+return);仅 Float 子窗写 LocalStorage;tao 三 setter 正常写位+派发(set_decoration_flag :1753-1778);is_* 读 mirror 位与真实行为分叉 |
| #240 | 子窗创建走 `createSubWindow`(API19+ options 变体)非 TYPE_FLOAT;`OHOSWindowType` 带 `#[allow(dead_code)]` 零消费(:514-529);`WindowCreateParams.window_type` 下发链路断裂(TSFN 元组与 `build_create_sub_window_args` 均无此字段);tauri-runtime 注释称 "TYPE_FLOAT" 失实 |
| #242 | OHOS 入口胶水与设备形态解耦:2in1 也是 Ability 模型但 `cfg(mobile)`=false → 上游单行 `cfg_attr(mobile, ...)` 不展开 → `.so` 无 NAPI 入口;宏展开期看不到目标平台(env NotPresent 实测);两个展开器同模块重复定义(E0428)是硬约束;对方已在工作区验证 10 文件方案 |
| #239 | `desktop` 别名被 OHOS PC/2in1 复用;三发射锚点(tauri-utils platform.rs:110-159 / tauri build.rs:265-268 / tauri-build lib.rs:479-482);全仓 `target_env="ohos"` 357 处(runtime-wry 93);`ohos_desktop` 零命中 |

### 归域与顺序

- 顺序 **G1(#237)→G2(#238)→G3(#240)→G4(#242)→G5(#239)→G6(回归门)**:语义修复先(稳定 issue 锚点),命名扫尾后(#240 的 Float→SubWindow 全仓 sweep 覆盖 #238 新增代码);单 phase 单 developer 串行执行,#238/#240 同触 tao window.rs / WindowManager.ets 的冲突由顺序消解,无并行写。
- #239 草案放工作区根(不入仓):rb-ship Step 1 范围检查在 tauri 仓内跑 git diff,仓外文档天然零越界;内容供用户与乙单位对齐,后续由 issue 回复引用。

---

## D1 #237:hide 语义裁定与 Err 落点

**证据链**:@ohos.window d.ts(10450 行)零窗口级 `hide()` 方法;`minimize()`(:7578)是唯一窗口消失手段但表现为任务栏最小化(语义≠hide);`hideAbility()` 属 plugin-app-control 的 UIAbility 级操作且 PC/2in1 不可用(WindowManager.ets:966-968),A1 权益落地前无真实现路径。

**决策**(三件套):

1. **runtime-wry dispatcher 层 Err**:`WryWindowDispatcher::hide`(lib.rs:2482)加 `cfg(target_env = "ohos")` 早退分支 `return Err(ohos_unsupported("hiding windows"))`——tauri 公共 `WebviewWindow::hide()` 由此得到 `Err(NotSupported)`,文案含 "not supported on OpenHarmony"。
2. **tao 层防御**:`set_visible(false)`(:1548 附近 false 分支)删 minimize 降级与 `mirror.minimized.store(true)`,改 `log::error!` + 直接 return(不派发、不写镜像);签名保持 void(upstream 对齐)。
3. **非 OHOS 不动**:`WindowMessage::Hide` handler 分支(:3900)与 tao 其他平台实现零改动;dispatcher 早退分支整体 `cfg(target_env = "ohos")` 隔离。

**show() 不 Err 的理由**:`showWindow()` API 9 真实存在、全形态可用、语义成立(抬起/显示窗口),与 hide 不同类。

**既有调用方影响盘点(实现必须处置,不得遗漏)**——hide Err 对全部窗口生效(含 Float 子窗;issue 口径=OHOS 无窗口级 hide API,不按窗型收窄),树内两个 OHOS 可达调用方:

1. **套件用例 `float.hide+show+center`**(examples/api/src/lib/tests/driver-generated.ts:552-555):`await w.hide()` 在 Err 后必 reject → 用例必红。处置:该用例更新为断言 hide() reject(message 含 not supported),show+center 流程保留——用例锁定新语义,不进 ⏭ 跳过清单(任务 1.10)。
2. **托盘 toggle**(examples/api/src-tauri/src/tray.rs:138-149):`is_visible → hide()`,Err 被 `let _` 吞后窗口不再消失、`is_visible` 恒 true,toggle 永卡 "Show" 分支,示例真实功能退化。处置:OHOS 路径改 `is_minimized` 判定 + `minimize()`/`show()`(任务栏语义的最接近替代;show 经 D2 条件化会恢复最小化窗),cfg(ohos) 隔离,桌面平台原逻辑不动(任务 1.11);行为变化在 issue 回复披露。

## D2 #237:show 路径镜像条件化(修 un-maximize 危害)

**现状缺陷**:`set_visible(true)` 无条件 `restore_window + show_window` 双发。WindowManager.ets:948 注释自证:**restore 对非最小化的最大化窗会取消最大化**(F3/D 已知危害);降级删除前该路径必然被执行(hide 降级 → minimized → show 恢复),降级删除后若保持无条件双发,普通可见窗的 `show()` 反而引入新危害。

**决策**:

```rust
// set_visible(true) OHOS branch
if self.mirror.minimized.load() {
    self.restore_window(...);  // API14+ version guard 保留;API12 warn 降级保留
    self.show_window(...);
    self.mirror.minimized.store(false);
} else {
    self.show_window(...);     // 仅抬起,不动最大化状态
}
```

- `mirror.minimized` 写入方在降级删除后仅剩 `set_minimized(true)`(:1780-1815 既有)、show 恢复清除、以及 `apply_window_status` 系统真值回填系(:137-158)——`is_minimized` 读本地镜像(facade 无同步查询,镜像+回填是唯一读源),降级删除后镜像不再被 hide 路径污染,与系统回填口径一致;
- ArkTS `showWindowMethod`(:926-964)的守卫路由保持不动(它已按主窗/子窗+minimized 分流),Rust 侧条件化后调用面收窄但语义一致。

## D3 #237:ArkTS 死代码与文档口径

- `hideWindow(windowId)`(WindowManager.ets:969-975)零调用方(facade plugin-window 无 hide action——actions 仅 minimize/maximize/restore/recover/show/destroy-window;全 ets 树仅定义处)→ **删除**,连同 :966-968 的 hideAbility 误导注释,以及 `showWindowMethod` 内 :927/:957 两处引用 hideWindow 的悬空注释一并清扫;
- `doc/ohos-window-test-mapping.md:36` 窗口可见性行本就失实(描述了不存在的 hide_window action)→ 改写为 Err 口径 + show 条件化语义;
- tauri 公共 API 文档:`WebviewWindow::hide()` rustdoc 补 OHOS 差异(隐藏窗口不支持,返回 NotSupported;待 A1 hide_ability 权益落地后恢复真实现)——issue 要求 3。

## D4 #238:主窗装饰系统手段调查结论(SDK 实证)

**d.ts 证据链**(sdk/default/openharmony/ets/api/@ohos.window.d.ts):

| API | 位置 | 结论 |
|---|---|---|
| `DecorButtonStyle`(since 14) | :1666-1728 | 字段全为样式:colorMode、buttonBackgroundSize、spacingBetweenButtons、closeButtonRightMargin、buttonIconSize(20)、buttonBackgroundCornerRadius(20)——**无逐钮 enable/hide** |
| `setDecorButtonStyle` | :8057 | 仅样式注入,且"takes effect only for the main window and the child window with the window title enabled"——样式面,非控制面 |
| `setWindowDecorVisible` | :7877 | **整条装饰条**显隐,非逐钮 |
| `getDecorButtonRect` | — | getter,与控制无关 |

**结论:系统无主窗逐钮启停 API** → 按 issue 要求 2 走 Err 路径。保留一道真机 spot-check 验证步(2in1 主窗 setDecorButtonStyle/装饰按钮行为观察):预期无反证;若发现可逐钮控制的系统手段,升级 PM 重议路径(真语义实现),设计其余部分不受影响(is_*/子窗/创建期 seed 决策独立成立)。

## D5 #238:Err 落点三件套(镜像 #237 架构)

1. **runtime-wry dispatcher**:`WryWindowDispatcher` 增 `cfg(target_env = "ohos")` 字段 `is_ui_ability_main: bool`;`set_minimizable`(:2429)/`set_maximizable`(:2422)/`set_closable`(:2436)在 OHOS 且主窗时早退 `Err(ohos_unsupported("setting window buttons on the main window"))`。kind 捕获按构造点分路(两处时序不同):
   - **:3402**(event-loop 内 `create_window(...)` 返回的 tao window 在手):直接调访问器捕获进字段;
   - **:440**(用户线程 `Context::create_window`,tao 窗口由事件循环异步创建,构造 dispatcher 时**不在手**):OHOS 分支本就阻塞 `receiver.recv()` 等 creation reply(:425-434)——事件循环侧在填充 `main_thread.windows` 表的同点先把 `window_id → is_ui_ability_main` 写入 Context 新增的线程安全注册表(`Mutex<HashMap<WindowId, bool>>`,cfg(ohos) 隔离),dispatcher 构造在 recv() 返回后读注册表;先写后应答的顺序保证 recv() 返回时注册表已填。
2. **tao 层**:`set_minimizable`(:1736)/`set_maximizable`(:1740)/`set_closable`(:1744)主窗 → `log::error!` + return(不写 decoration_flags、不派发);**`set_resizable`(:1710)不门控**——它同走 `set_decoration_flag` 但 resizable 有 set_resize_by_drag 真实面,#238 范围外,门控 helper 而非三个入口会造成误伤。
3. **ArkTS**:`setDecorationFlags`(:1118-1138)主窗分支从 hilog.info no-op(:1119-1126)改为 **throw**(镜像 #219 unknown-window throw 模式 :1130-1132)——防非 tao 调用方假成功;文案注明 OHOS 主窗不支持逐钮控制、子窗口支持。

## D6 #238:tao kind 判定与 is_* 一致性

- `struct Window`(:450-512)在 #97 后已无 kind 字段(:453-458 注释解释删除动机=window_type 下发死链);#238 需要主窗判定 → **重新引入本地 `kind: OHOSWindowKind` 字段**(UIAbility/Float),创建期用既有 kind 解析逻辑(:718-722)赋值;新增实例访问器挂 `tao::platform::ohos` 的 **`WindowExtOpenHarmony`** trait(src/platform/ohos.rs :46-66 既有实例 trait;`with_window_kind` :106/:118 属 builder trait `WindowBuilderExtOpenHarmony`,非实例面)供 runtime-wry 两构造点捕获。
- is_* 主窗恒 true 的边界在 rustdoc 注明:不覆盖 `set_decorations(false)`/`setWindowDecorVisible` 隐藏整条装饰条的情形(整条隐藏后三查询仍报 true,与上游 Win32 行为一致)。
- **与 #240 无冲突**:#240 删的是 `window_type` **下发死链**(WindowCreateParams/TSFN/ArkTS),kind 本地判定字段保留——两者是不同物;#97 的删除动机(零消费的下发链)不适用于本地判定消费。此区别写入 :453-458 与 :498-500(decoration_flags)注释更新。
- `is_minimizable`(:2042)/`is_maximizable`(:2046)/`is_closable`(:2050):主窗 → `true`(OS 管控下三按钮恒可用=真状态,消除"查询为真、行为为假"分叉——行为面由 setter Err 诚实化,查询面回真值);子窗 → decoration_flags 位(子窗路径真实生效,现状保持)。`is_resizable`(:2038)不动。

## D7 #238:创建期装饰 seed 主窗 warn+忽略

- `WindowAttributes.minimizable/maximizable/closable` 位在主窗创建期:warn + 忽略,**不 fail 创建**——软偏好不阻断启动,与不支持的创建属性先例一致;运行期 setter 才 Err(诚实出口)。子窗创建期 seed 现状(写 LocalStorage 控制 SubWindowPage 按钮)保持。
- **连带效应披露**:`set_maximized(true)` 守卫读 FLAG_MAXIMIZABLE(window.rs:2756 附近),主窗 maximizable seed 被忽略后该守卫恒放行 → `attrs.maximizable=false` 的主窗仍可被程序化最大化——与"主窗三钮 OS 管控"口径一致(可最大化性恒真),issue 回复披露;主 spec :129 播种需求同步 MODIFIED(见 specs delta)。
- window-ops D 组冒烟注释("decoration flags smoke, main window no-op")随行为变化更新。

## D8 #240:对外枚举直接改名

`OHOSWindowKind::Float`→`SubWindow`,四层同步(tauri-runtime 枚举 :512-517 / tao 枚举 :60 / runtime-wry match :1435-1438 / tauri::ohos re-export 面 ohos.rs:5)+ examples **11 处**(cmd.rs ×9:568/672/710/838/926/981/1311/1662/2356、tray.rs:156、lib.rs:666;examples/api lib.rs:49 是入口属性行非 Float 用点,不入清单)。**不走兼容别名**(已定决策:仓未发布无兼容负担,issue 要求 2 允许破坏性处理;Rust 侧编译器 E0599 逐点暴露零漏改)。

## D9 #240:window_type 死链删除

- tao:`enum OHOSWindowType`(:514-529,`#[allow(dead_code)]` 自证零消费)整体删;`window_type` 局部与填充(:754-760)、`WindowCreateParams` 构造点(:950)摘除该字段传参;
- ability:`WindowCreateParams.window_type`(crates/ability/src/window/mod.rs:28)字段 + `Default` 实现(:53)+ 回填函数(:193-209)核验零引用后删除——issue 正文已核 TSFN 元组 `(name, id, w, h, x, y, decorations, transparent, background_color)` 与 `SubWindowOptions` 均无此字段,全链路无读取方;
- 删除后 grep `window_type|OHOSWindowType` 三仓零命中为完成判据(排除无关同名,如 ArkTS 侧 windowType 属性引用若有则单独评估——`createWindow` 路径已不存在于本仓)。

## D10 #240:ArkTS FloatPage→SubWindowPage 与冻结边界

- `WindowKind.Float`→`SubWindow`(枚举 :48-51、windowKinds.set :1689、全部 match/读取点);`FloatPage.ets`→`SubWindowPage.ets` + 全部**代码**引用改名:ProcessInitializer.ets(:149/:186)、type.ets(:203/:205/:209/:220)、cursor_feed.ets(:4/:7)、WindowAttachmentRegistry.ets、WindowManager.ets;Rust 侧注释 crates/ability/src/app.rs:1281 一并改(不属冻结)。
- **MenuBarComponent.ets 不动**::11/:661 仅**注释**提及 FloatPage,零代码引用;该文件归乙 #205 冻结。注释陈旧在 #240 issue 回复中披露。
- 完成判据:三仓 grep `FloatPage|WindowKind\.Float|OHOSWindowKind::Float|OHOSWindowType` 零命中(MenuBarComponent.ets 注释两处豁免并披露)。

## D11 #240:文档口径校正

- tauri-runtime `ohos_window_kind`/枚举注释(:501-517)重写:`SubWindow` = **应用子窗口**(windowStage.createSubWindow,API19+ options 变体 {title, decorEnabled, maximizeSupported}),手机/平板/PC 全形态可用、不可移出应用窗口区域;与 **TYPE_FLOAT 全局悬浮窗**并列(仅 PC/2in1、可移出应用区域、window.createWindow 创建)——两者设备支持面与窗口范围语义均不同,实现走前者。
- `doc/ohos-window-test-mapping.md:22` "createSubWindow(TypeFloat)" → "createSubWindow(应用子窗口)";`doc/ohos-window-design.md` 内 kind 语义提及处同步(#240 要求 "等" 文档,以 grep `Float` 于 tauri/doc/ 与两个 window 注释源为盘点面)。

## D12 #242:双属性机制照已验证设计落地

**十文件清单**(issue §实施状态 verbatim,验证要求同引):

1. `crates/tauri-macros/src/mobile.rs`——唯一实现 `entry_point`(:30-102 现状重构);新增 `is_entry_point_attr` 兄弟属性判定:**全路径**匹配 `tauri::mobile_entry_point` / `tauri::ohos::entry_point`,先展开者从透传函数上摘除内层属性(cfg_attr 已被 rustc 求值,摘除后内层不再展开)→ 任一书写顺序恰好一个展开器;发射产物按平台互补门控:iOS `start_app`/Android JNI 绑定 `#[cfg(not(target_env = "ohos"))]`(带保险),OHOS `openharmony_ability_mod` 半边 `#[cfg(target_env = "ohos")]`——宏展开期看不到目标平台(CARGO_CFG_* 在 proc macro 内 NotPresent 实测),互补 cfg 是唯一解;
2. `crates/tauri-macros/src/lib.rs`——两个 `#[proc_macro_attribute]`(mobile_entry_point :39-42 旁新增 `ohos_entry_point`);
3. `crates/tauri/src/ohos.rs`——`pub use tauri_macros::ohos_entry_point as entry_point;` + rustdoc(推荐两行写法示例);
4. `examples/api/src-tauri/src/lib.rs:49` + `examples/huawei-account/src-tauri/src/lib.rs:18`——两行写法(cfg_attr(mobile) + cfg_attr(target_env="ohos"),顺序不限);
5. `crates/tauri-cli/src/mobile/open_harmony/dev_eco_studio_script.rs`——`REQUIRED_SYMBOL_FRAGMENT`(:175 "openharmony_ability_mod")不变;:192/:213 bail 文案从"missing the tauri::mobile_entry_point macro usage"改为指向**两个**属性;:219 warn 同步;
6-8. CLI 三模板(`templates/app/src-tauri/src/lib.rs:7`、`templates/plugin/__example-api/tauri-app/src-tauri/src/lib.rs`、`templates/plugin/__example-basic/vanilla/src-tauri/src/lib.rs`)两行写法;
9. `.claude/skills/tauri-ohos-code-review/references/review-checklist.md:20` A5 同步——`any(mobile, target_env = "ohos")` 单行**仍合法**;唯一错写是仅 `cfg_attr(mobile, ...)`;
10. tauri-macros 单测 ≥4(属性识别 / 兄弟属性摘除 / 双平台产物 / 其他属性不受影响)。

**兼容矩阵**(aarch64-unknown-linux-ohos 实测口径,实现后重验):

| 写法 | 手机/平板 | 2in1 |
|---|---|---|
| 仅 `cfg_attr(mobile, mobile_entry_point)`(上游单行) | ✅ | ❌ 不展开(固有边界) |
| 仅 `cfg_attr(any(mobile, target_env="ohos"), mobile_entry_point)` | ✅ | ✅ |
| 两行共存(任一顺序) | ✅ | ✅ |
| 仅 `cfg_attr(target_env="ohos", ohos::entry_point)` | ✅ | ✅ |

**已知边界(披露于 issue 回复,不修)**:①别名导入(`use tauri::ohos::entry_point as x`)使摘除失效退化为 E0428(构建期可见,非静默);②上游单行在 2in1 固有失效(cfg(mobile)=false 属性根本不展开,任何宏机制改不了);③可选后续(`tauri::ohos` doc(hidden) 未移、`mobile_entry_point` 导出门控未收紧)不做——已定决策。

**验证**:矩阵 8 格逐项(正向断言 `openharmony_ability_mod` 符号存在 + 负向对照 desktop 形态上游单行确实 E0433)+ host 回归(`_start_app` 存在、双属性无重复)+ `rustfmt --check` 改动文件干净。

## D13 #239:cfg 形态别名迁移立项草案(零实现)

产出 `D:\xuqiu\tauri-3.0\OHOS-CFG-ALIAS-MIGRATION-PLAN-2026-10-26.md`(工作区根,不入仓),七节:

1. **现状**:三发射锚点(tauri-utils platform.rs:110-159 `is_mobile_target` 读 `OHOS_DEVICE_TYPE`;tauri build.rs:265-268 + tauri-build lib.rs:479-482 `alias("desktop", !mobile)`/`alias("mobile", mobile)`);OHOS PC/2in1 复用通用 `desktop`;357 处 `target_env="ohos"`(runtime-wry 93;均为 issue 时点值——10-26 实测 crates 下 396 处、runtime-wry lib.rs 单文件 130,草案落笔时须重测定数);补丁组合实例(runtime-wry :3565 `all(desktop, not(ohos))` / :3635 `all(desktop, ohos)`,10-26 实测行号)。
2. **目标态**:`desktop` 对 OHOS 不再为真;OHOS 上 `mobile`(手机/平板)+ 新 `ohos_desktop`(PC/2in1)两形态;非 OHOS 平台 `desktop`/`mobile` 语义不变。
3. **发射点改造**:`is_mobile_target()` 语义调整 + 两发射点改 `alias("ohos_desktop", ohos && desktop_form)` 类发射(具体签名在草案中给出方案选项);`OHOS_DEVICE_TYPE` 继续为形态真源。
4. **三分类迁移法**:`all(desktop, target_env="ohos")` → 收敛 `ohos_desktop`;`all(desktop, not(target_env="ohos"))` → 回归纯 `desktop`;双生效点 → `any(desktop, ohos_desktop)` 或语义化组合逐一评审(如 tray/menu bar 类)。含盘点命令(rg pattern 族)与分波建议(先 runtime-wry 93 处试点 → tauri/crates 全量 → CLI/模板乙协同面)。
5. **乙协同面**:tauri-cli 与模板的 desktop/mobile 消费点盘点与迁移分工。
6. **回归策略**:phone/tablet(`mobile` 路径行为不变)+ 2in1(`ohos_desktop` 新路径)+ 三桌面平台(`desktop` 不回归污染)。
7. **风险与上游合并成本**:漏改 → 形态缺陷回潮(ignore_cursor_events 型);上游每个 desktop 门控改动的合并审计负担;与 #178/#182/#238 联动点(迁移后可形态 cfg 直判)。

## D14:验证矩阵

| 层 | 内容 | 判据 |
|---|---|---|
| host 单测 | `cargo test -p tauri-macros`(≥4 UT) | 全绿 |
| host 编译 | tauri/runtime-wry/tauri-build `cargo check`(Windows host) | 0 error |
| host 回归 | `mobile_entry_point` 胶水(`_start_app` 存在)、双属性无重复 | 编译产物符号在 |
| 交叉矩阵 | 4 写法 × 2 形态(aarch64-unknown-linux-ohos,OHOS_DEVICE_TYPE=mobile/desktop),载体=examples/api 双形态 + examples/huawei-account desktop `cargo check`(issue #242 验证口径) | 正向 `openharmony_ability_mod` 在;负向(上游单行+desktop)E0433 |
| 改名零残留 | 三仓 grep `OHOSWindowType|window_type 下发|OHOSWindowKind::Float|WindowKind\.Float|FloatPage` | 零命中(MenuBarComponent.ets 注释豁免) |
| 设备 UT | tao `--lib`(基线 79)+ ability UT | 全绿 |
| HAR 链 | 清 oh_modules + CompileArkTS + 重打包(#238/#240 ArkTS 波及) | 构建成功 |
| examples/api 套件 | 324 基线 + 新增用例 | 0❌,⏭=8 不增 |
| 真机 spot-check | #238 主窗装饰按钮 2in1 观察 | 预期无逐钮控制反证 |

## D15:commit 计划与文件归属

- 实现串行 G1→G5,commit 按 issue × 仓分立,显式点名文件(禁 `git add -A`),schema.json churn 过滤:tao #237 → tao #238 → ability #237+#238(死代码删+throw,同 ArkTS 文件合一 commit)→ tauri #237/#238(dispatcher 层)→ tao/ability/tauri-runtime/tauri #240(各仓一 commit)→ tauri #242 → tauri docs(#237 差异注释并入 #237 commit)。
- #239 无 commit(仓外文档);全部**不 push、不回 GitHub**(须用户另行确认)。
- wry 零触碰;origin-tauri 禁止提交;分支统一 ohdev。

## Risks

| 风险 | 缓解 |
|---|---|
| 既有 hide() 调用方行为回归 | D1 影响盘点两处已列处置(套件用例更新断言 / 托盘 toggle OHOS 适配),任务 1.10/1.11 锁定;回归门 6.3 兜底 |
| #240 改名漏点 | Rust 侧编译器 E0599 逐点暴露;ArkTS 侧 grep 双扫(FloatPage/WindowKind.Float)+ HAR 全链重编;MenuBarComponent.ets 注释豁免已披露 |
| kind 字段回归被误读为推翻 #97 | D6 已区分:删的是下发死链,加的是本地判定;注释更新写明 |
| #238 spot-check 发现系统反证 | 设计仅 Err 路径受影响,升级 PM 重议;is_*/子窗/seed 决策独立成立 |
| 交叉矩阵 8 格构建时间(>8min/格) | run_in_background + 产物目录复用;禁删 aarch64-unknown-linux-ohos/release/x86_64-ohos(D 盘紧张) |
| un-maximize 修复的行为回归 | 现有用例无 "show 后最大化被重置" 断言(D 组手查);新增 ut 用例锁定新语义 |
| HAR 缓存陷阱 | ArkTS 改后必清 oh_modules + CompileArkTS(既有坑) |
| MenuBarComponent.ets 冻结冲突 | 零代码引用实证,不触碰;注释陈旧披露 |

## Test Design

| Spec 需求(specs/) | 测试 | 期望值 |
|---|---|---|
| ohos-window-ops: hide surfaces NotSupported | examples/api autotest 新例 `hide() rejects on OHOS`(# Brief 编号步骤) | promise reject;message 含 `not supported on OpenHarmony` |
| ohos-window-ops: hide 无降级副作用 | tao 设备 UT `ut_set_visible_false_no_dispatch` | set_visible(false) 后无 window 消息派发、mirror.minimized 保持 false |
| ohos-window-ops: show restores only minimized | autotest `show() keeps maximized state` | 可见最大化窗 show() 后 `isMaximized()===true`;最小化窗 show() 后 `isMinimized()===false` |
| ohos-window-ops: main-window setters reject | autotest 三例 `setMaximizable/setMinimizable/setClosable reject on main window` | 三者均 reject + `not supported on OpenHarmony` |
| ohos-window-ops: sub-window setters keep effect | 既有 D 组 decoration 冒烟回归(真机) | 子窗三 setter resolve + 按钮显隐生效(现状不回归) |
| ohos-window-ops: is_* main returns true | autotest `isMinimizable/isMaximizable/isClosable true on main window` | 主窗三者均 `true`;子窗回 seed 位 |
| ohos-entry-point-attributes: exactly one expander | tauri-macros UT ×4(属性识别/兄弟摘除/双平台产物/其他属性不受影响) | 双属性任一顺序展开产物恰好一套胶水;非入口属性原样透传 |
| ohos-entry-point-attributes: compat matrix | 交叉编译矩阵 4 写法 × 2 形态 | 表格 8 格结论与 D12 矩阵一致(正向符号在;上游单行+desktop E0433) |
| ohos-entry-point-attributes: host glue preserved | host `cargo test -p tauri` + examples check | `_start_app` 存在;双属性共存无 E0428 |
| ohos-window-ops: hide surfaces NotSupported(non-OHOS unaffected 场景) | host `cargo check`(tao + tauri-runtime-wry,Windows host) | 0 error;OHOS 早退分支未编入,桌面 hide/show 行为不变 |
| ohos-window-ops: ArkTS facade throws for main window | ability UT:plugin-window `set-window-decoration-flags` 主窗 id | bridge 命令返回错误(错误文案含主窗不支持) |
| ohos-window-ops: creation with button seeds succeeds | tao 设备 UT:主窗 attrs 带三钮 seed 创建 | 创建 Ok + warn 日志一行;flags 未写 |
| ohos-window-ops: docs describe application sub-window semantics | 文档检查(grep/评审):tauri-runtime 枚举 rustdoc + test-mapping :22 | 两处均含 createSubWindow 应用子窗口语义 + TYPE_FLOAT 全局悬浮窗对照(设备支持面/可否移出) |
| ohos-entry-point-attributes: missing symbol error text | dev_eco 符号校验文案断言(UT 或字符串检查) | 失败文案同时含 `tauri::mobile_entry_point` 与 `tauri::ohos::entry_point` 两个属性名 |
| #240 命名/死字段(设计约束,非 spec 场景) | 三仓 cargo build/test + grep 零残留(D14) | 编译过;`OHOSWindowType`/`Float` 族零命中 |
| #239 草案(仓外交付) | checklist:七节齐备 + 锚点/数量与 issue #239 对账 | 文档存在且覆盖 issue 要求 1-4 |

## Task Signals

tags: [ohos]
routed_skills: [rust-ohos]

(rust-ohos 已消费:OHOS 平台 Rust 适配域清单;gn-guide 不适用——本 change 零 BUILD.gn 面。)
