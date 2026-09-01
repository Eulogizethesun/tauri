# OHOS WebView HTTPS 协议 (ohos-webview-https-scheme) 适配计划

**创建时间**：2026-07-20
**功能描述**：让 wry OHOS 的 `WebViewBuilderExtOhos::with_https_scheme(true)` 真正生效——custom protocol 请求以 `https://<scheme>.<path>` 为 origin，使 secure-context API（`crypto.subtle`、service workers 等）在 OHOS webview 中可用。当前状态：API 外壳存在（`PlatformSpecificWebViewAttributes.use_https` 字段 + `with_https_scheme` 方法），但 `wry/src/ohos/mod.rs:338-340` 仅 `log::warn!` 提示「未实现」。

**目标设备形态**：OHOS 桌面/移动（desktop + mobile 均适用，无设备形态差异代码）

**判断依据**：
- 涉及 3 个代码层：openharmony-ability（NAPI + ArkTS）、wry（Rust 适配）、ArkTS ETS（`DefaultWebview.ets` / `ArkHelper.ets` / `Utils.ets`）
- 预估影响 7 个文件
- 既有底层 NAPI + ArkTS 链路改造，又有 wry 上层集成与端到端验证 → 拆分

**目标级别**：完整实现（ArkWeb 支持自定义 https origin secure-context 的前提下）+ 显式降级（设备验证不支持时回退为 no-op + warn，保留 API 形态）

## 现状（已核实）

- **wry 外壳**：`wry/src/lib.rs:1934-1971` 已定义 `PlatformSpecificWebViewAttributes.use_https` 与 `WebViewBuilderExtOhos::with_https_scheme`
- **wry 消费**：`wry/src/ohos/mod.rs:101-104` 读取 `use_https` 仅 debug log；`:325-336` 的 `custom_protocol_async` 注册仅注册原始 scheme（经 `OH_ArkWeb_SetSchemeHandler` 原生 API，不拦截 https）；`:338-340` warn 未实现
- **openharmony-ability**：`crates/ability/src/webview/mod.rs` `WebViewBuilder` 无 `use_https_intercept` / `https_intercept_protocols` 字段；`crates/ability/src/helper/webview.rs` `Webview` 无 `register_https_intercept` NAPI 方法
- **ArkTS**：`DefaultWebview.ets` 的 `WebBuilder` / `EmbeddedWebBuilder` 挂载了 `onLoadIntercept`（用于 `onNavigationRequest` 与 close-window URL），但未挂载 `onInterceptRequest`；`Utils.ets` `JsHelper` 接口无 `registerHttpsIntercept` 签名
- **ohos_web_binding 0.1.1**：`Web::custom_protocol` 调用 `OH_ArkWeb_SetSchemeHandler(protocol, web_tag, handle)`，只对原始 scheme 生效；`OH_ArkWeb_RegisterCustomSchemes` 必须在 web init 前调（`CustomProtocol::register()`）。不能用于 `https`（会全局拦截所有 https）
- **参考实现**：Android wry（`wry/src/android/mod.rs:211-288`）使用 `shouldInterceptRequest` + `custom_protocol_workaround` 模式，把 `https://<protocol>.localhost/<path>` 还原为 `<protocol>://localhost/<path>`。OHOS 的 `onInterceptRequest` 是 Android `shouldInterceptRequest` 的直接等价物（`web.d.ts:8719`，since 11/12——since 11 deprecated + since 12 current，无 since 9）

## OHOS API 关键未知项（需设备验证）

1. **`onInterceptRequest` 是否对主框架导航触发**：文档（`web.d.ts:8693-8719`）描述为「resources loading is intercepted」，对主框架 `loadUrl` 是否触发需设备验证。若不触发，初始 URL 加载需 `onLoadIntercept` 配合（fallback 见 Phase 2）。
   - 验证方法：在 `onInterceptRequest` 回调内 `hilog.info('intercept: ' + url)`，加载 `https://tauri.localhost/index.html`，观察日志是否出现主框架 URL。
2. **`WebResourceResponse.setResponseIsReady(false)` + 异步 `setResponseIsReady(true)` 异步交付模式是否成立**：`web.d.ts:4048` `setResponseIsReady(IsReady: boolean)` since 9，文档未明确「先返回 false 后异步填数据再设 true」是否触发 ArkWeb 交付。若不支持，需降级为同步阻塞（违反 ohos-constraints §1.2 线程模型，不可行）或改用 service worker 方案。
   - 验证方法：构造最小用例——`onInterceptRequest` 返回 `setResponseIsReady(false)` 的 response，`setTimeout(() => { response.setResponseData('hello'); response.setResponseIsReady(true); }, 100)`，观察页面是否收到 `hello`。
3. **ArkWeb 是否把 `https://<custom-scheme>.localhost` 识别为 secure context**：W3C 标准 `localhost` 是 secure context，但 ArkWeb 是否对 `tauri.localhost` 这类自定义子域应用 secure-context 规则需验证。若不支持，`crypto.subtle` 仍不可用，本特性失去意义。
   - 验证方法：加载 `https://tauri.localhost/test.html`，页面内执行 `console.log(window.isSecureContext, typeof crypto?.subtle)`，hilog 观察输出。
4. **`onInterceptRequest` 是否对 `fetch()` / `XMLHttpRequest` 子资源请求触发**：文档说「resources loading」，预期触发，但需确认是否包括 XHR/fetch（Android `shouldInterceptRequest` 触发）。
   - 验证方法：页面内 `fetch('https://tauri.localhost/api')`，观察 `onInterceptRequest` 日志。
5. **请求 headers / method 透传**：`WebResourceRequest.getRequestHeader()` 与 `getRequestMethod()` 可用（since 8/11），但 NAPI 侧 `dispatchHttpsIntercept` 是否需要把这些透传给 Rust 的 `http::Request`？若不透传，custom_protocol 闭包收到的请求 method 恒为 GET、headers 为空——对 GET-only 资源（前端静态资源）无影响，对 POST/XHR 有影响。
   - **首期决策**：首期只透传 url，method 默认 GET，headers 为空。POST/XHR 完整透传作为 Phase 5 增强项（设备验证后再加）。
6. **`setResponseData(ArrayBuffer)` vs `setResponseData(string)`**：`web.d.ts:3904` 接受 `string | number | Resource | ArrayBuffer`。二进制响应（图片、wasm）必须用 `ArrayBuffer`；文本响应可用 string。NAPI 侧 `applyResponse` 应统一传 `Uint8Array`（ArkTS 自动视为 ArrayBuffer）。
7. **`onInterceptRequest` 回调返回 null 与返回 `undefined` 的等价性**：文档说「If the response value is null, the Web will continue to load」。ArkTS `undefined` 是否等价 `null`？保守起见显式 `return null`。

## Phase 列表

| Phase | 名称 | 涉及层 | 预估文件 | 验证方式 | 状态 |
|-------|------|--------|---------|---------|------|
| 1 | 底层 ArkTS `onInterceptRequest` + NAPI dispatchHttpsIntercept | openharmony-ability (Rust + ArkTS) | 4 | cargo check + 设备端最小用例（手测 onInterceptRequest 触发） | ○ 待开始 |
| 2 | wry 消费 `use_https`：URL 改写 + register_https_intercept 调用 | wry | 1 | cargo check + 设备端 `with_https_scheme(true)` 端到端加载 | ○ 待开始 |
| 3 | secure-context 端到端验证 + 降级路径 | 全层 + 测试 | 2 | 设备端 `crypto.subtle` 可用性测试 + 降级开关 | ○ 待开始 |

## Phase 详细说明

### Phase 1: 底层 ArkTS `onInterceptRequest` + NAPI dispatchHttpsIntercept

- **目标**：
  - `openharmony-ability/crates/ability/src/webview/mod.rs` `WebViewBuilder` 增加 `use_https_intercept: bool` 与 `https_intercept_protocols: Vec<String>` 字段及 builder 方法；`build()` 透传到 `WebViewInitData`。
  - `openharmony-ability/crates/ability/src/helper/webview.rs`：
    - `WebViewInitData` NAPI 结构增加 `use_https_intercept: Option<bool>` 与 `https_intercept_protocols: Option<Vec<String>>` 字段。
    - `Webview` 增加 `pub fn register_https_intercept(&self, protocols: Vec<String>) -> Result<()>`，NAPI 调 `ret.controller.registerHttpsIntercept(protocols)`。
    - 新增 `pub fn dispatch_https_intercept(...)`（或在 `custom_protocol_async` 闭包内捕获 webview 引用，由闭包直接调 `applyResponse` NAPI 回调）——具体形态见下方「实现说明」。
  - `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets`：
    - `WebViewInitData` 接口增加 `useHttpsIntercept?: boolean` 与 `httpsInterceptProtocols?: string[]` 字段。
    - `WebBuilder` 与 `EmbeddedWebBuilder` 在 `data.useHttpsIntercept === true` 时挂载 `.onInterceptRequest(callback)`。callback 实现：URL 匹配 → 创建 `WebResourceResponse` → `setResponseIsReady(false)` → 异步调 Rust → 返回 response；不匹配 → 返回 `null`。
  - `openharmony-ability/native_ability/src/main/ets/webview/Utils.ets`：`JsHelper` 接口增加 `registerHttpsIntercept: (protocols: string[]) => void` 签名；`buildJsHelper` 返回对象增加 no-op stub；`ProxyJsHelper` 增加缓存 + 回放。
  - `openharmony-ability/native_ability/src/main/ets/ability/ArkHelper.ets`：`createWebview` / `createEmbeddedWebview` 在 `ret.controller` 挂载 `registerHttpsIntercept(protocols: string[])` 实现（合并入 per-webview `httpsInterceptProtocols: Set<string>`）。

- **文件**：
  - `openharmony-ability/crates/ability/src/webview/mod.rs`
  - `openharmony-ability/crates/ability/src/helper/webview.rs`
  - `openharmony-ability/native_ability/src/main/ets/webview/DefaultWebview.ets`
  - `openharmony-ability/native_ability/src/main/ets/webview/Utils.ets`
  - `openharmony-ability/native_ability/src/main/ets/ability/ArkHelper.ets`
  - （`package/` 目录下的 mirror 副本同步更新，不计入预估文件数）

- **依赖**：无

- **实现说明（dispatchHttpsIntercept 形态选择）**：
  - **方案 A（推荐）**：不新增独立 NAPI 函数。在 `custom_protocol_async` 闭包内捕获 `webview: Webview` 引用 + `applyResponse: Function`（由 ArkTS 传入）。当 `use_https_intercept=true` 时，ArkTS `onInterceptRequest` 不直接调 NAPI，而是把 `applyResponse` 函数存入 per-request 上下文，然后调用 `controller.dispatchHttpsIntercept(url, applyResponse)` NAPI 方法。Rust 侧 `dispatch_https_intercept` 方法内：还原 URL → 找到对应 protocol 的 `custom_protocol_async` 闭包 → 构造 Request + responder → 闭包执行 → responder 触发时 `Function::call(applyResponse, FnArgs{ data: (statusCode, headers, mimeType, body) })`。
  - **方案 B**：新增模块级 NAPI 函数 `dispatch_https_intercept(webview_id, url, applyResponse)`，通过全局 `HashMap<webview_id, CustomProtocolCtx>` 查找闭包。**不推荐**——违反 ohos-constraints §2.2「TSFN 数据必须通过泛型参数携带，不是全局 Mutex」。
  - 选用方案 A：把 `applyResponse` 函数作为 `dispatchHttpsIntercept` 的参数传入，闭包内 capture。

- **未知项**：1、2、4、5、6、7（设备验证）

### Phase 2: wry 消费 `use_https`：URL 改写 + register_https_intercept 调用

- **目标**：
  - `wry/src/ohos/mod.rs` `InnerWebView::new_inner`：
    1. 删除 `:102-104` 的 `log::debug!`（保留 `use_https` 读取）与 `:338-340` 的 `log::warn!`。
    2. 在 `let webview_builder = WebViewBuilder::new()...` 链中，若 `use_https && !custom_protocols.is_empty()`：调用 `.use_https_intercept(true).https_intercept_protocols(protocols.clone())`，其中 `protocols` 是 `custom_protocols.keys().collect::<Vec<_>>()`。
    3. 在 url/html 分支前，若 `use_https && initial_url` 匹配某 custom_protocol scheme：用 `custom_protocol_workaround::apply_uri_work_around(url, "https", protocol)` 改写 `initial_url`，再传给 `webview_builder.url(...)`。
  - 现有 `custom_protocol_async` 注册（`:325-336`）**保持不变**——原始 scheme 注册仍保留（向后兼容，custom_protocol_workaround 模式下不会被触发，因为页面 url 已改写为 https）。
  - IPC handler 闭包（`:303-323`）保持不变：`ipc_webview.url()` 在 https 模式下返回 `https://...`，与 webview 当前 url 一致，无需改写。

- **文件**：
  - `wry/src/ohos/mod.rs`

- **依赖**：Phase 1 完成

- **未知项**：无新增（依赖 Phase 1 验证结果）

- **降级路径**：若 Phase 1 验证发现 `onInterceptRequest` 不触发主框架导航（未知项 1），且 fallback 经 `onLoadIntercept` 也不可行，则 Phase 2 在 `use_https=true` 时改为：
  - 仍改写 url（让 origin 为 https）
  - 不挂 `onInterceptRequest`，但保留 `custom_protocol_async` 经 `OH_ArkWeb_SetSchemeHandler` 注册原始 scheme
  - 这样 https 请求会失败（custom_protocol 闭包收不到 https 请求）——退化为本特性「不支持」状态，需在 `with_https_scheme` doc 显式标注

### Phase 3: secure-context 端到端验证 + 降级路径

- **目标**：
  - 在 `tauri api demo` 或独立测试 app 中：`with_https_scheme(true)` + 注册 `tauri://` custom_protocol，加载 `tauri://localhost/index.html`（自动改写为 `https://tauri.localhost/index.html`）。
  - 页面内执行：
    ```js
    console.log('isSecureContext:', window.isSecureContext);
    console.log('crypto.subtle:', typeof crypto?.subtle);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hello'));
    console.log('digest ok:', digest.byteLength === 32);
    ```
  - 通过 hilog 观察输出。
  - 若 `isSecureContext === true` 且 `crypto.subtle` 可用 → 特性验收通过。
  - 若 `isSecureContext === false` 或 `crypto.subtle === undefined` → 触发降级路径：
    - **降级 A**：尝试反向域名 `https://localhost.<protocol>/index.html`（修改 `custom_protocol_workaround` 增加反向模式）。
    - **降级 B**：在 `with_https_scheme` doc 显式标注「OHOS ArkWeb 当前版本不支持自定义 https origin secure-context」，保留 API 形态为 no-op + warn。
    - **降级 C**：调研 `OH_ArkWeb_RegisterCustomSchemes("https", Standard)` 是否可重注册 https（几乎确定不行——会破坏外部 https，但需验证确认）。
  - 在 spec.md 的「Secure-context behavior SHALL be verified on device」Requirement 下记录验证结论。

- **文件**：
  - `tauri/examples/ohos-api-demo`（或现有测试 app，增加测试页面）
  - `openspec/specs/ohos-webview-https-scheme/spec.md`（追加验证结论 Scenario）

- **依赖**：Phase 1-2 完成

- **未知项**：3（核心未知项）

## 实现顺序建议

1. **先做 Phase 1 的 ArkTS 改造**（`DefaultWebview.ets` / `ArkHelper.ets` / `Utils.ets`）—— `onInterceptRequest` 挂载 + 协议集合管理 + `WebResourceResponse` 创建/填充。这部分可在设备上独立验证（hardcode 一个 protocol，手动触发 fetch，看 hilog）。
2. **再做 Phase 1 的 NAPI 桥接**（`webview/mod.rs` + `helper/webview.rs`）—— `dispatchHttpsIntercept` 闭包模式 + `applyResponse` 回调。
3. **Phase 2 wry 改造**—— URL 改写 + 字段透传。
4. **Phase 3 端到端验证**。

## 测试用例设计

### auto（可自动断言）
- `custom_protocol_workaround::apply_uri_work_around("tauri://localhost/x", "https", "tauri")` == `"https://tauri.localhost/x"`（已有 UT，OHOS 复用）
- `custom_protocol_workaround::revert_uri_work_around("https://tauri.localhost/x", "https", "tauri")` == `"tauri://localhost/x"`
- `is_work_around_uri("https://tauri.localhost/x", "https", "tauri")` == `true`
- `is_work_around_uri("https://example.com/x", "https", "tauri")` == `false`
- wry OHOS `with_https_scheme(true)` + `custom_protocols={"tauri"}` + url=`tauri://localhost/index.html` → 传给 `WebViewBuilder::build()` 的 url == `https://tauri.localhost/index.html`（需要 mock WebViewBuilder 或提取改写逻辑为纯函数）

### side-effect（有副作用但可验证）
- 设备端加载 `https://tauri.localhost/index.html` → `onInterceptRequest` 触发 → custom_protocol 闭包被调用 → 页面渲染闭包返回的 HTML
- `register_https_intercept(["tauri"])` 后，新发起的 `https://tauri.localhost/...` 请求被拦截

### manual（需人工确认）
- `window.isSecureContext === true`（hilog 观察）
- `crypto.subtle.digest(...)` 成功（hilog 观察）
- 外部 https 站点（`https://example.com`）正常加载（未被误拦截）
- 主框架导航到 `https://tauri.localhost/index.html` 正常加载（验证未知项 1）
- 子资源 fetch/XHR 正常被拦截（验证未知项 4）

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| `setResponseIsReady(false)` 异步模式不被 ArkWeb 支持 | Phase 1 先做最小验证用例；不支持则改方案为同步阻塞（需评估线程模型）或 service worker |
| `onInterceptRequest` 不触发主框架导航 | 用 `onLoadIntercept` 配合，但 `onLoadIntercept` 只返回 boolean（block/allow），无法交付 response——需让 `onLoadIntercept` 对匹配 URL 返回 false（允许），同时让 `onInterceptRequest` 接管资源加载；主框架 HTML 由 `onInterceptRequest` 交付 |
| ArkWeb 不识别 `tauri.localhost` 为 secure context | 降级 A/B/C（见 Phase 3） |
| NAPI `Function::call` 在 `onInterceptRequest` 上下文静默失败（ohos-constraints §2.3） | `applyResponse` 不在 `render()` 上下文调；`onInterceptRequest` 是事件回调，非 render。但仍需设备验证 |
| `custom_protocol_async` 闭包捕获 `webview: Webview` 导致循环引用 | `Webview` 内部 `Rc<ObjectRef>` + `Rc<Web>`，无强引用环；闭包持有 `Webview` clone（Rc 引用计数 +1），生命周期与 webview 一致，Drop 时释放 |
| 请求 method/headers 未透传导致 POST 请求失败 | 首期只支持 GET（前端静态资源场景）；POST 透传作为 Phase 5 增强项 |

## 真机验证发现（2026-08-06，API 23 desktop）

通过 TestRunner `HTTPS Scheme` 按钮（`create_ohos_test_webview` + `https_scheme=true`）验证：

- **根因（已修复）**：`tauri-runtime-wry/src/lib.rs` OHOS 分支（`#[cfg(target_env = "ohos")]`）只传了 `with_window_id`，**漏传 `with_https_scheme`**——而 Windows/Android 分支都传了。导致 OHOS 上 `pl_attrs.use_https` 始终为 false（默认），`rewrite_https_url_if_matching` 条件 `use_https &&` 不满足，URL 不改写。hilog 确认导航 URL 仍为 `tauri://localhost/`。
- **`custom_protocols` 非空**：tauri `manager/webview.rs:275` 注册 `tauri://` 到 `pending.register_uri_scheme_protocol`，build 时传给 wry `custom_protocols`——所以 `custom_protocols.is_empty()` 不是问题，`use_https=false` 才是。
- **修复**：OHOS 分支加 `webview_builder = webview_builder.with_https_scheme(webview_attributes.use_https_scheme)`。
- **重验结果（PASS）**：重建后点 HTTPS Scheme 按钮，hilog 确认 `onLoadIntercept → onNavigationRequest called: https://tauri.localhost/`（之前是 `tauri://localhost/`，现已改写为 `https://`）。URL 改写成功，origin 为 `https://tauri.localhost`。
- **`isSecureContext` 最终验证（PASS）**：通过 init script 自动检查（无需 DevTools），hilog 确认：
  - `isSecureContext=true` ✅
  - `location.href=https://tauri.localhost/` ✅（URL 改写成功）
  - `crypto.subtle OK, bytes=32` ✅（SHA-256 digest 返回 32 字节，secure-context API 可用）
  - R75 https-scheme 最终验收门槛全部通过。

## 与现有 spec 的关系

- **ohos-webview-bounds**（`specs/ohos-webview-bounds/spec.md`）：无关，本特性不涉及 bounds
- **ohos-webview-drag-drop**：无关
- **ohos-webview-print**：无关
- **ohos-webview-proxy-config**：无关
- **webview-transparent-bg**：无关
- 本特性是 `wry/src/ohos/mod.rs:338-340` warn 标记的真 gap，独立设计

## 状态流转

- `○ 待开始` — 未开始设计
- `● 进行中` — 正在设计或实现
- `✓ 设计完成` — 设计文档已生成并通过审计
- `✓ 已归档` — 已完成实现、测试并归档
