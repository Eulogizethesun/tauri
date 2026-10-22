# Proposal: ohos-committer-issues-jia-p3

## Why

roadmap `ohos-committer-issues-jia-master` Phase 3 = 甲第 2 波 M 级代码修复(9 条,#179 已剔除)。p1 对账表给出条目级残差;本 phase 主要实现锚按 R8 纪律从 HEAD 现场 re-derive,derive 结果相对 ledger 快照有四处修正(详见 design Context):①#168 几何播种半已由 8dd79f77 闭合(主窗 decorations apply + Float create params 已带 decorations),播种半收敛为 always_on_top/decoration_flags,补发半(fullscreen/maximized/focused)HEAD 实证零消费 → 本波纳入实现;②#198 披露半已由 wry 8e381e6 闭合(文档侧),本波只做实现侧 vp 接入,且 vp 走既有 `ohos_display_binding` 绑定薄包装、零新增 NAPI wire;③#219 已存在 `call::<Req, WindowAcknowledgement>().ensure()` ack 通道与 throw→Rust Err 先例(focus :739/:751、set-decorations bool→throw),收敛点是 ArkTS 侧 serializeOp 吞错而非新增传输层;④#186 请求头 wire 用并行数组 `Vec<String>`(BridgeNapiType 手写宏无嵌套 map 先例)。

p2 已交付本波依赖:#173 WindowStateMirror focused 位(#180① 的写入面)、#199 url_cache 预填 initial_url(#192 的回落面)、#174 Branch A 定案、波末回归基线 319 例(311✅/8⏭/0❌,report `examples/api/device-report-1021-desktop.md`)。

本 phase 是行为波:凡动 ArkTS 走全链(清 oh_modules + CompileArkTS + 重打 HAR),NAPI 命名契约两端同步(#[napi] 默认 camelCase、Option 用 skip_serializing_if),bridge 禁 recv_timeout/block_on,波末桌面回归是硬门槛(**319 例全量,SC2 = 零新增 ❌**)。

## What Changes

9 条 M 级修复,按仓分组:

- **openharmony-ability**(Rust NAPI + ArkTS canonical 双面):
  - #186 拦截请求字段扩展:ArkTS `getRequestMethod()`/`getRequestHeader()` 采集 → payload `method`/请求头并行数组(`headerNames`/`headerValues` 同序)字段 → NAPI struct → wry Request builder 三层穿透;`setResponseHeader` 在 SDK20 副本缺席,设计含**当次构建 SDK 复核前置门**(缺席则 headers 写路径降级披露);请求 body 无平台访问器随披露;保 CORS 4 例基线不回归。
  - #198 实现侧 virtualPixelRatio:消费既有 `ohos_display_binding` 绑定(`default_display_virtual_pixel_ratio()` 与 scaledDensity 同族已导出),ability 侧薄包装(≤0 回落 1.0)供 wry `to_logical(vp)`;零新增 NAPI wire、零 ArkTS 面(HEAD re-derive 相对 ledger 的收敛项)。
  - #180① Float 焦点接通:`notify_window_focus` NAPI + FloatPage.ets `windowEvent`(WINDOW_ACTIVE/WINDOW_INACTIVE)订阅(typeof probe + @since 20 降级)。
  - #188 incognito:`WebviewStyle.incognito` + `Web().incognitoMode` 两分支创建;cookie 桥 fetchCookieSync/configCookieSync incognito 第三参透传。
  - #192 同步插件:`WebviewUrlBridgePlugin`(ID `ohos.webview-url`)随 `set_cookie_sync_app` 同点注册(COOKIE_SYNC_APP 复用),供 wry Main 态同步读 URL。
  - #219 窗口命令 ack 链:WindowManager.ets `serializeOpTracked` 变体(链延续 + tracked promise 拒绝)与 WindowPlugin.ets 命令臂分工;4 类操作型命令 await+throw(set-title/set-topmost/set-cursor-icon/set-cursor-visible),3 个 void-setter try/throw(set-decoration-flags/set-fullscreen/show);tao 消费侧核验(预期零代码)。
- **wry**:
  - #186 `Request::builder()` 补 `.method()`/`.headers()`(并行数组 zip 重组;坏头/坏 method 回落 + debug)。
  - #189 主 webview Drop 去 is_child 门控:`dispose_child` 去 `self.is_child` 判断,关窗链全量回归;未就绪排队悬挂注记。
  - #192 url() 同步桥:三态分流(Main→COOKIE_SYNC_APP 同步桥 get-url + 写回 url_cache;Worker→cache 回落;Uninitialized→cache 回落),**零 block_on/recv_timeout**。
  - #195 open_devtools:`PendingOp::SetDevtools` 排队 + 进程级 static bool(tracked state 语义对齐)+ tauri 层门控对齐核验。
  - #198 set_bounds/create 走 `to_logical::<f64>(vp)`(Physical 输入 ÷ vp,Logical 输入恒等;vp=1 时零行为变化;bounds() cache 回读不经换算)。
- **tao**:
  - #180① `notify_window_focus` 消费:`LAST_FOCUSED_WINDOW_ID` AtomicI64 变化沿去重 → GainedFocus/LostFocus → WindowStateMirror(p2 #173 focused 位闭环);**增益沿对前持焦窗合成失焦(配对语义)**;stage 两臂同步 last 快照,跨路径重复沿共享去重。
  - scale 事件去噪:`LAST_EFFECTIVE_SCALE` AtomicU64,ScaleFactorChanged 仅真变化时转发(镜像 ThemeChanged 沿检测)。
  - #168 构造尾 attrs 接入:build() 尾播种(always_on_top/decoration_flags 差异才发)+ 补发(fullscreen/maximized/focused 按存在性一次性应用),全走既有 dispatch_or_queue 播种→补发;visible/icon/theme 披露不动。
- **examples/api**:新增 auto 用例(#192 url 同步读取、#188 incognito 创建、#219 失败 ack 错误链);#198 vp 换算与 #189 关窗链归真机专项(SC3);新命令同步 build.rs AppManifest 四处。

## Capabilities

### New Capabilities

- **ohos-window-scale-events**:ScaleFactorChanged 变化沿去噪——仅当 effective scale 相对上次快照变化时才向上转发,消除 ArkTS 侧重复 scale 事件抖动(镜像 ThemeChanged 沿检测先例)。

### Modified Capabilities

- **ohos-window-focus-state**(续挂 p2 change-local):ADDED Float 窗口焦点沿接通(notify_window_focus → 变化沿去重 + 配对合成 → WindowStateMirror focused 位闭环)。
- **ohos-webview-bridge-fidelity**(续挂 p2 change-local):ADDED url() 同步读取三态语义(含新同步插件注册契约)、创建通道转发 incognitoMode。
- **ohos-window-ops**:ADDED 创建期 attrs 播种与补发(#168)、窗口命令失败经 ack 链传播为 invoke 错误(#219)。
- **webview-cookie-mgmt**:MODIFIED「Set a single cookie」补 incognito 语境透传(#188)。
- **ohos-with-webview**:ADDED webview Drop 无条件 dispose(去 is_child 门控,#189)。
- **webview-devtools-focus**:ADDED open_devtools 在 controller 未就绪时排队重放(#195)。
- **ohos-webview-https-scheme**:ADDED 拦截请求携带 method 与请求头(#186)。
- **ohos-webview-bounds**:ADDED bounds 换算接入 virtualPixelRatio(#198)。
- **ohos-platform-limitations**:ADDED 披露(#168 visible/icon/theme 创建参数不生效、#186 setResponseHeader SDK 缺席降级 + 请求 body 无访问器边界)。

## Impact

- **依赖 p2**:#173 focused 位(#180① 只差 Float 信号补齐)、#199 url_cache(#192 回落面)、319 例回归基线;四仓 head:ability 84/0 UT、wry 20/0、tao 设备 90/0、tauri-runtime-wry 15/0 为施工起点。
- **行为面**:9 条行为变更(详见 design D1-D12);ArkTS 面(#186/#188/#219 + #180① FloatPage)触发 HAR 全链重打;NAPI 契约新增字段(notify_window_focus、payload method/请求头并行数组、WebviewStyle.incognito)两端同步;#192 新同步插件两端注册;#198 走既有 display 绑定零 wire。
- **回归面**:#219 触碰 WindowManager.ets 串行化链、#189 触碰关窗链,两者叠加使 319 全量回归成为硬门槛(SC2);CORS 4 例是 #186 的定向回归面。
- **外部动作排除**:不 push、不回 GitHub;不动 MenuBarComponent.ets(归乙 #205);bot-gate 不作门槛(存量红项 tauri-utils clippy::derivable_impls + metric BM002)。
