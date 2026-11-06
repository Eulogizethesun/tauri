# ohos-committer-issues-followup Tasks

## 约束(实现须遵守)

- cfg 铁律:tao/wry 运行时库 OHOS 新代码一律 `cfg(target_env = "ohos")` 隔离,不影响 Windows/macOS/Linux;Linux 依赖排除加 `not(target_env = "ohos")`
- 英文注释 ASCII;测试用例 `ut_`/`sdv_` 前缀 + `# Brief` 编号步骤;内部延迟 ≥3s 的用例显式 timeout(#291 教训)
- 改 ArkTS 后必清 oh_modules + CompileArkTS 再重编 HAR
- 不动 MenuBarComponent.ets(归乙 #205;其 :11/:661 仅注释提及 FloatPage)
- commit 显式点名文件,禁 `git add -A`;schema.json churn 过滤;不 push、不回 GitHub(须用户另行确认)
- 设备 UT tao 用 `--lib`;examples/api 回归判据 = report 文件 footer(324 case-rows,⏭=8 基线:52 cookie/99·103·104 clipboard/117 notification/148 NFC/293 haptics/314 version-gate)
- Bash 每条命令子壳 cd 或绝对路径;>2min 命令 run_in_background 禁前台 tail
- 交叉编译产物目录复用,禁删 aarch64-unknown-linux-ohos / release 12G / x86_64-ohos 7.6G / plugins-workspace(D 盘紧张)
- 组顺序固定 G1→G5 串行(G3 命名扫尾覆盖 G2 新增代码);实现只做 tasks 内事项,越界须先回 PM

## 1. G1 #237 窗口可见性诚实化

- [x] 1.1 autotest 新例:主窗 `hide()` 拒绝(期望 reject + message 含 not supported on OpenHarmony)
  —— anchor: examples/api/src(窗口操作用例页,新增 ut_ 用例)
- [x] 1.2 autotest 新例:可见最大化窗 `show()` 后保持最大化(ut_ 前缀)
  —— anchor: examples/api/src(窗口操作用例页)
- [x] 1.3 tao 设备 UT:set_visible(false) 无派发且 mirror.minimized 不变
  —— anchor: tao/src/platform_impl/ohos/window.rs(ut 模块)
- [x] 1.4 runtime-wry:`WryWindowDispatcher::hide` OHOS 早退 `ohos_unsupported`
  —— anchor: tauri/crates/tauri-runtime-wry/src/lib.rs::WryWindowDispatcher::hide
- [x] 1.5 tao:`set_visible(false)` 删 minimize 降级与 mirror 写入,改 log::error+return
  —— anchor: tao/src/platform_impl/ohos/window.rs::Window::set_visible
- [x] 1.6 tao:`set_visible(true)` 镜像条件化(minimized→restore+show+清位;else→仅 show;API12 warn 分支保留)
  —— anchor: tao/src/platform_impl/ohos/window.rs::Window::set_visible
- [x] 1.7 ArkTS:删死代码 `hideWindow` 与 :966-968 误导注释
  —— anchor: openharmony-ability/native_ability/src/main/ets/window/WindowManager.ets::hideWindow
- [x] 1.8 接口文档:`WebviewWindow::hide` rustdoc 补 OHOS 差异(不支持,待 A1)
  —— anchor: tauri/crates/tauri/src/webview/webview_window.rs::hide
- [x] 1.9 文档:ohos-window-test-mapping.md:36 可见性行改写为 Err + 条件化 show 口径
  —— anchor: tauri/doc/ohos-window-test-mapping.md
- [x] 1.10 更新既有套件用例 `float.hide+show+center`(driver-generated.ts:552-555):hide() 断言 reject(含 not supported 文案),show+center 流程保留(不进 ⏭ 清单)
  —— anchor: tauri/examples/api/src/lib/tests/driver-generated.ts::driverCase('float.hide+show+center')
- [x] 1.11 托盘 toggle OHOS 适配(tray.rs:138-149):hide 分支改 is_minimized 判定 + minimize()/show(),cfg(ohos) 隔离,桌面平台原逻辑不动;行为变化记入披露清单
  —— anchor: tauri/examples/api/src-tauri/src/tray.rs(托盘 toggle 分支)

## 2. G2 #238 主窗装饰按钮诚实化

- [x] 2.1 真机 spot-check:2in1 主窗 setDecorButtonStyle/装饰按钮逐钮控制反证探测(预期无;有反证升级 PM)
  —— anchor: openharmony-ability(手动验证,证据落 hilog/文本)
  —— 结论(10-26): SDK d.ts 静态反证探测完成——@ohos.window 无操作级 enable/disable API(setWindowMaximizable/Minimizable/Closable 零命中),Err 契约维持,无升级项;但 @since14 setWindowTitleButtonVisible(逐钮可见性)/setDecorButtonStyle/setWindowDecorVisible 存在,"无逐钮控制 API"字面表述过强,已精化 5 处注释(tauri ed5278cc4/tao 7ebf9aac/ability 69b1278);运行时腿由 6.3 D-group 用例覆盖
  —— 证据: @ohos.window.d.ts :8057(setDecorButtonStyle)/:8112(setWindowTitleButtonVisible)/:10144(grayOutMaximizeButton)/:7877(setWindowDecorVisible)
- [x] 2.2 autotest 新例:主窗三 setter 拒绝 ×3 + 主窗 isMinimizable/isMaximizable/isClosable 返回 true
  —— anchor: examples/api/src(窗口操作用例页,ut_ 用例)
- [x] 2.3 tao:`Window` 重引本地 `kind: OHOSWindowKind` 字段(创建期 :718-722 解析赋值)+ 访问器挂 tao::platform::ohos;:453-458/:498-500 注释更新(区分 #97 删的是下发死链)
  —— anchor: tao/src/platform_impl/ohos/window.rs::Window
- [x] 2.4 tao:三 setter 主窗 log::error+return(不写位不派发);set_resizable 不动
  —— anchor: tao/src/platform_impl/ohos/window.rs::set_decoration_flag
- [x] 2.5 tao:is_minimizable/is_maximizable/is_closable 主窗回 true、子窗回位
  —— anchor: tao/src/platform_impl/ohos/window.rs::is_minimizable
- [x] 2.6 tao:创建期装饰 seed 主窗 warn+忽略
  —— anchor: tao/src/platform_impl/ohos/window.rs::Window::new
- [x] 2.7 runtime-wry:WryWindowDispatcher 增 is_ui_ability_main(两构造点捕获)+ 三 setter 主窗 Err
  —— anchor: tauri/crates/tauri-runtime-wry/src/lib.rs::WryWindowDispatcher
- [x] 2.8 ArkTS:setDecorationFlags 主窗分支 hilog no-op → throw(#219 模式,:1130-1132)
  —— anchor: openharmony-ability/native_ability/src/main/ets/window/WindowManager.ets::setDecorationFlags
- [x] 2.9 接口文档:三 setter rustdoc 补 OHOS 主窗差异 + window-ops D 组冒烟注释更新
  —— anchor: tauri/crates/tauri/src/webview/webview_window.rs::set_minimizable
- [x] 2.10 ability UT:plugin-window `set-window-decoration-flags` 主窗 id 返回错误(bridge 面 throw 断言)
  —— anchor: openharmony-ability/crates/plugin-window/src/lib.rs::window_command

## 3. G3 #240 SubWindow 命名与死字段清理

- [x] 3.1 tao:删 `OHOSWindowType` 枚举 + window_type 局部/填充/构造传参
  —— anchor: tao/src/platform_impl/ohos/window.rs
- [x] 3.2 ability:删 `WindowCreateParams.window_type` 字段与 Default(核验零引用)
  —— anchor: openharmony-ability/crates/ability/src/window/mod.rs
- [x] 3.3 四层改名 `OHOSWindowKind::Float`→`SubWindow`(tao 枚举/tauri-runtime 枚举/runtime-wry match/tauri::ohos 面)+ examples 11 处同步(cmd.rs ×9 + tray.rs:156 + lib.rs:666)
  —— anchor: tauri/crates/tauri-runtime/src/window.rs
- [x] 3.4 ArkTS:`WindowKind.Float`→`SubWindow` + `FloatPage.ets`→`SubWindowPage.ets` 全代码引用改名(ProcessInitializer/type.ets/cursor_feed/WindowAttachmentRegistry/WindowManager/app.rs 注释;MenuBarComponent.ets 不动)
  —— anchor: openharmony-ability/native_ability/src/main/ets/window/WindowManager.ets
- [x] 3.5 文档口径:tauri-runtime :501-517 注释重写(应用子窗口 vs TYPE_FLOAT 全局悬浮窗)+ test-mapping :22 + tauri/doc Float 语义扫
  —— anchor: tauri/crates/tauri-runtime/src/window.rs
- [x] 3.6 零残留验证:三仓 grep `OHOSWindowType|OHOSWindowKind::Float|WindowKind\.Float|FloatPage` 零命中(MenuBarComponent.ets 注释豁免,记录披露文本)
  —— anchor: 三仓 grep 验证(无代码锚点)

## 4. G4 #242 OHOS 入口属性双写机制

- [x] 4.1 tauri-macros UT ×4 先写:属性识别/兄弟属性摘除/双平台产物/其他属性不受影响
  —— anchor: tauri/crates/tauri-macros/src/mobile.rs(tests)
- [x] 4.2 mobile.rs:唯一实现 `entry_point` + `is_entry_point_attr` 全路径兄弟摘除 + 产物互补门控(mobile 半边 not(target_env="ohos"),OHOS 半边 target_env="ohos")
  —— anchor: tauri/crates/tauri-macros/src/mobile.rs::entry_point
- [x] 4.3 lib.rs:新增 `#[proc_macro_attribute] ohos_entry_point`
  —— anchor: tauri/crates/tauri-macros/src/lib.rs::ohos_entry_point
- [x] 4.4 tauri/src/ohos.rs:`ohos_entry_point as entry_point` re-export + rustdoc(两行写法示例)
  —— anchor: tauri/crates/tauri/src/ohos.rs
- [x] 4.5 examples/api 与 examples/huawei-account 改两行写法
  —— anchor: tauri/examples/api/src-tauri/src/lib.rs
- [x] 4.6 dev_eco_studio_script.rs:bail/warn 文案(:192/:213/:219)指向两个属性;REQUIRED_SYMBOL_FRAGMENT 不变
  —— anchor: tauri/crates/tauri-cli/src/mobile/open_harmony/dev_eco_studio_script.rs
- [x] 4.7 CLI 三模板改两行写法(app + plugin/__example-api + plugin/__example-basic)
  —— anchor: tauri/crates/tauri-cli/templates
- [x] 4.8 检视清单 A5 同步(any(mobile, target_env="ohos") 单行仍合法;唯一错写=仅 cfg_attr(mobile,...))
  —— anchor: tauri/.claude/skills/tauri-ohos-code-review/references/review-checklist.md
- [x] 4.9 交叉矩阵验证:4 写法 × 2 形态(正向 openharmony_ability_mod 存在;负向上游单行+desktop 形态 E0433),载体=examples/api 双形态 + examples/huawei-account desktop cargo check + host 回归 + rustfmt --check
  —— anchor: 交叉编译 harness(无代码锚点)
  —— 结果(10-26, probe242 临时 crate 已删除): 9 OK + 1 负向 FAIL——row1-upstream+desktop(2in1 形态)胶水未展开=E0425(实测码,比预估 E0433 更精确:探针 fn 对未发射 glue 的引用不可解析;E0433 是中间轮探针缺依赖的基建伪签名);其余 9 组合(含 row3-forward/reverse 双形态、row4-ohos-only、row2-any 单行 any)全 OK。examples/api host 检查走 6.1;探针基建修正三处:TAURI_ANDROID_PACKAGE_NAME_{PREFIX,APP_NAME} 注入、build.rs rerun-if-env-changed、assert 改引用不调用;rustfmt --check 九文件改动区全净(既有漂移未触碰)

## 5. G5 #239 cfg 形态别名迁移立项草案(仅文档)

- [x] 5.1 草案文档七节:现状三锚点/目标态/发射点改造/三分类迁移法+盘点命令+分波/乙协同面/phone+tablet 回归策略/风险与上游合并成本(#178/#182/#238 联动)
  —— anchor: D:\xuqiu\tauri-3.0\OHOS-CFG-ALIAS-MIGRATION-PLAN-2026-10-26.md(工作区根,不入仓)
- [x] 5.2 对账检查:七节覆盖 issue #239 要求 1-4 全部条目
  —— anchor: D:\xuqiu\tauri-3.0\.tmp\issue-239-body.md(对账源)

## 6. G6 回归门(全 change)

- [x] 6.1 host:tauri-macros UT + tauri/runtime-wry cargo check + examples check(_start_app 存在、双属性无 E0428)
  —— anchor: host cargo 验证(无代码锚点)
  —— 结果: tauri-macros 4 UT 全绿(ut_entry_point_* ×4);tauri/runtime-wry cargo check 过;examples host `cargo check -p api` exit 0(37s,双属性行无 E0428,_start_app 由 OHOS 形态展开——host 侧以 4.9 OHOS 交叉矩阵 9 OK 证明展开正确)
- [x] 6.2 HAR 链:清 oh_modules + CompileArkTS + 重打包(#238/#240 ArkTS 波及)
  —— anchor: openharmony-ability(HAR 构建)
  —— 结果: pack.bat 重打 ability.har(10-26 14:05,199931B);消费端走 skill 铁律(改 HAR 后仅重跑 cargo tauri ohos build,CLI 自检 HAR 变化重装包;手动清 oh_modules 属禁忌操作会致 00304056/00625003)——desktop 套件流水线已完成重装+重打包+真机安装,report 为今日新件即链路通证
- [x] 6.3 examples/api 套件:324 基线 0❌、⏭=8 不增、新增用例全绿(判据=report footer)
  —— anchor: tauri/examples/api(套件 report)
  —— 结果(10-26 desktop 形态,Mate 70 3QC0124C11000038,run-tests.sh 全链): **327 例 319✅/8⏭/0❌**,footer 在;324→327 增量恰为本 change 三新例(:318/:319/:320),⏭ 集与 10-23 基线逐行同一(不增);D 组例(:316,改名沿用)基线即 ✅;点名全绿=:316 D 组 smoke(#238)/:318 hide-reject(#237)/:319 show-keeps-maximized(#237)/:320 主窗装饰按钮(#238);报告存 examples/api/test-report-1026-g6-desktop.md
- [x] 6.4 设备 UT:tao `--lib` 全绿 + ability UT 全绿
  —— anchor: tao / openharmony-ability(设备 UT)
  —— 结果(10-26 Mate 70 3QC0124C11000038): tao 103 passed/0 failed(0.03s)、openharmony-ability 92 passed/0 failed(0.02s),二进制交叉编译后 hdc 推送执行
- [x] 6.5 #238 真机 spot-check 结论落档(2.1 的证据归档,无反证即收口)
  —— anchor: openharmony-ability(验证记录)
  —— 结论: 无操作级反证,Err 契约收口;证据落档=三仓五处注释精化(tauri ed5278cc4 webview_window.rs/runtime-wry lib.rs/window-ops.ts、tao 7ebf9aac window.rs、ability 69b1278 WindowManager.ets,均引用 setWindowTitleButtonVisible API14+/setDecorButtonStyle/setWindowDecorVisible 与 d.ts 行号)+2.1 注记;未来若采 setWindowTitleButtonVisible 做"隐藏式"实现属设计级决策,已列 concerns 供 PM 裁量
