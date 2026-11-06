# Proposal: ohos-committer-issues-jia-p2

## Why

roadmap `ohos-committer-issues-jia-master` Phase 2 = 甲第 1 波 S 级代码修复(md 第 1 波甲侧,13 条)。p1 对账表(reconciliation-ledger)已把 38 条落定为 已修 3 / 残差 18 / 未动 17,并给出 p2 scope 的权威裁剪:#179/#185 剔除、#190 收窄(①Expires/Max-Age)、#184 修法锚点纠偏(`Option<WindowClient>` 字段懒补取,非 OnceLock)、#225 落点重 derive。本 phase 把 p1 裁剪后的 S 级残差逐条落成代码修复,并为 p3 提供两块前置:#173 的 WindowStateMirror focused 位(#180① Float 焦点接通的基建)与波末回归基线。

本 phase 是**行为波**(区别于 p1 零行为变更):凡动 ArkTS 走全链(清 oh_modules + CompileArkTS + 重打 HAR),NAPI 契约两端同步,波末桌面回归是硬门槛(318 例基线 = 311✅/7⏭/0❌,report `examples/api/device-report-1020-desktop.md`)。

## What Changes

S 级修复 13 条 + 真机仲裁 1 项,按仓分组(p1 对账裁剪后):

- **openharmony-ability**:#221(StageEventType `From<i32>` panic → `TryFrom` + unknown 值日志忽略 + host 单测)、#181(theme 首回调前恒 Light → module init 链尾主动灌入初始 Configuration,**SDK 事实纠偏:本地 SDK20 无 `Context.getConfiguration()`,改用 `resourceManager.getConfigurationSync()` 拼装**)、#231(accelerator_matcher 3 处 console.info → hilog.debug 保 accel-inject-diag.sh 判读链 + WindowManager setPointerStyle 成功日志删/失败保留;**不动 MenuBarComponent.ets**——归乙 #205)、#191(clearAllBrowsingData 补 `clearAllCookiesSync(false)`)+ #233(WebviewPlugin.ets createPdf cfg 构造补 scale 行,`plugins/webview` + `package` 两份源同步)。
- **tao**:#184(bridge client 失败懒补取 + 成功覆盖,`window_client` 改 `Mutex<Option<WindowClient>>`)、#173(WindowStateMirror 加 focused 位 + 注册时 HAS_FOCUS 快照播种 + GainedFocus/LostFocus 写入;p3 #180① 前置基建,`is_focused` 语义本波不变)、#178(setCursorGrab 异步失败 warn 结构化)、#174(主窗 setFocusable 真机仲裁:去 gate 或结构化 warn,双支路判据见 design D6)。
- **wry**:#190①(format_set_cookie_value 补 Expires/Max-Age,cookie 0.18.2 `pub use time` 零新依赖,IMF-fixdate≠Rfc2822)、#194(PendingOp::Eval Err 分支以 `"null"` 回调)、#199(url_cache 预填 initial_url)、#233(wry ohos/mod.rs 失实注释更正)、#188(create_req.style.visible 直传,facade doc 同步)、#191 披露半(clear_all_browsing_data doc 补 OHOS 行:已清面 + SSL cache/clientAuthCache 两缺口)。
- **tauri**:#225(set_enabled OHOS cfg 早退 `Err(NotSupported)`,落点 `WindowDispatcher::set_enabled`,**:3889 主线程 arm 不改**——p1 锚重 derive 后收窄)、#178(tauri-runtime-wry `let _ = window.set_cursor_grab(grab)` 改 warn)。
- **examples/api**:新增 1 条 auto 用例(#191 clearAllBrowsingData 清 cookie 断言);#174/#181 真机仲裁/验证在 MateBook Pro(3QC0124C11000038)出结论。

## Capabilities

### New Capabilities

- **ohos-window-focus-state**:per-window 焦点态保真——WindowStateMirror focused 位(初始 HAS_FOCUS 快照、GainedFocus/LostFocus 写入)与主窗 setFocusable 不再静默假成功(去 gate 生效或结构化 warn,双支路以真机仲裁收束)。
- **ohos-theme-forwarding**:启动期主题保真——module init 链尾把设备当前配置(colorMode)灌入既有 onConfigurationUpdate 转发链,`theme()` 首次查询即返回系统真值。
- **ohos-webview-bridge-fidelity**:wry 桥载荷保真——eval 失败以 `"null"` 回调、invoke URL 预填 initial_url、create 通道直传 `style.visible`。

### Modified Capabilities

- **webview-cookie-mgmt**:MODIFIED「Set a single cookie」补 Expires/Max-Age 透传(#190①);ADDED「clearAllBrowsingData 清 cookie」(#191)。
- **ohos-webview-print**:ADDED「createPdf 转发 scale」(#233)。
- **ohos-window-ops**:ADDED bridge client 懒补取(#184)、set_enabled OHOS 报 Err(#225)、set_cursor_grab 异步失败结构化 warn(#178)。
- **ohos-event-lifecycle-forward**:ADDED 未知 StageEventType 值日志忽略不 panic(#221)。

## Impact

- **依赖 p1**:对账裁剪(ledger 残差去向列 = 本 scope 权威来源);#169 latch 注释已落(9627c4e0);p1 四仓文档批 commit(tao 9627c4e0 / ability 3d10f73 / wry 28f8c08 / tauri 1147f3ae5 + 4f37e9f96)为施工起点。
- **为 p3 提供**:#173 focused 位(#180① Float 焦点接通的写入面已就位,Float 信号补齐后 mirror 即闭环);波末回归基线 report。
- **行为面**:13 条 S 级行为变更(详见 design D1-D13);ArkTS 面(#181/#231/#191/#233)触发 HAR 全链重打;NAPI 契约零变更(#188 复用既有 `WebviewStyle.visible` wire 字段,#233 复用既有 `WebviewPdfConfig.scale`)。
- **外部动作排除**:GitHub 回复、push 不在本 phase(澄清决策 2);#190③ 披露纠偏归回复素材不在本批。
