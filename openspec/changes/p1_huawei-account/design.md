## Context

openharmony-ability 是 Tauri OHOS 的唯一 ArkTS 桥接仓(CLAUDE.md 铁律 1)。其能力模块统一采用"ArkHelper 对象桥 + TSFN"范式(参考 `updater`/`autostart` 样板):Rust 持有 ArkTS 传入的 `ArkHelper` ObjectRef,跨线程调用经 ThreadsafeFunction 调度到主线程取 `get_named_property("xxx").call(())`,ArkTS 侧 `helper/<name>.ets` 实现真实系统能力并以 Promise 返回,Rust 侧用 oneshot channel + `call_with_return_value` + `.then/.catch` 把 Promise 转成 Future。TSFN 在 `render/xcomponent.rs::render()`(于 `set_main_thread_env` 之后)按 Cargo feature 初始化。

Account Kit API(arkts-helper 已核实):`@kit.AccountKit` → `authentication`;`new authentication.HuaweiIDProvider().createLoginWithHuaweiIDRequest()` 设 `forceLogin`(false 静默 / true 交互)+ `state=util.generateRandomUUID()`;`new authentication.AuthenticationController().executeRequest(req)` → `LoginWithHuaweiIDResponse`,`response.data`(`LoginWithHuaweiIDCredential`)含 `authorizationCode/openId/unionId/uid/displayName/avatarUri/accessToken`;退出用 `createSignOutRequest()`。API since 12(满足 demo 默认 API 12),PC/2in1 全支持,能力检测 `canIUse('SystemCapability.Account.OAuth')`,未登录错误码 `1001502001`。

## Goals / Non-Goals

**Goals:**
- 在 openharmony-ability 内封装 Account Kit,暴露 `HuaweiAccount::{login,silent_login,logout}` 异步公共 API,返回 `AccountInfo`。
- 完全遵守 ohos-constraints(TSFN `callee_handled::<false>`、NonBlocking、无 `run_on_main_thread+recv`、camelCase、cfg 隔离)。
- `account` feature 默认关闭,不影响现有构建产物;`native_ability/`+`package/` 双镜像同步并重建 `ability.har`。

**Non-Goals:**
- 不做 `tauri-plugin-huawei-account` 插件(Phase 2)。
- 不做 examples/api 集成、`module.json5` 的 `client_id`/`INTERNET` 声明(Phase 3)。
- 不做前端测试用例(Phase 4)。
- 不申请手机号等需企业权限的敏感 scope。

## Decisions

### D1:能力模块放在 openharmony-ability 内(Option B)
**选择**:在 openharmony-ability 仓内新增 `account` 模块,Account Kit 调用集中在仓内 ArkTS。
**理由**:用户明确要求"必须经过 openharmony-ability 调 ArkTS",且符合铁律 1 字面(所有 ArkTS 调用收口本仓)。插件层因此成为纯 Rust+JS 薄壳(Phase 2),不再自带业务 ArkTS。
**备选(否决)**:Option A——插件自带 ArkTS 直接调 `@kit.AccountKit`(如 notification 插件)。虽更省一层桥接,但违反用户约束与铁律 1 的收口意图。

### D2:沿用 updater 样板的 TSFN + Promise→Future 桥接
**选择**:Rust 侧 `helper/account.rs` 建 3 个 TSFN(`accountLogin`/`accountSilentLogin`/`accountLogout`),`account.rs` 用 oneshot + `call_with_return_value` + `handle_account_promise`(`.then` 抽字段 / `.catch` 透传错误)。
**理由**:updater 样板已验证"结构化对象返回 + Promise 解析"场景可行,且自带 serde UT 范式。Account Kit 返回 `LoginWithHuaweiIDCredential` 正是此形态。复用可降低 NAPI/TSFN 踩坑风险。
**关键约束落实**:`callee_handled::<false>()`(避免参数偏移);TSFN 数据无全局 Mutex 中转(每调用独立 oneshot);Promise 字段必须在 JS 线程 `parse_account_info`(NAPI 值不可跨线程)。
**实现更新(2026-07-30)**:`login`/`silent_login` 共用私有 async `account_info_request(tsfn, label)` helper(避免三处复制 oneshot+call_with_return_value 样板),`logout` 走 `handle_void_promise`。另在 `account.ets` 的 `loginWithHuaweiID` 中新增 **CSRF state 响应校验**:`if (response.state && request.state !== response.state) throw` —— design 原文只要求设置 `state=util.generateRandomUUID()`,实现额外校验响应 state 一致性(安全加固,失败码 `1001502002`,见 D5)。

### D3:公共 API 形态——`HuaweiAccount` 结构体 + async 方法
**选择**:`pub struct HuaweiAccount;` + `impl { pub fn new()->Self; pub async fn login(&self)->Result<AccountInfo>; silent_login; logout }`,内部调用全局 TSFN(由 `render()` 初始化)。无需 `OpenHarmonyApp` 句柄(Account Kit 无 per-app 状态)。
**备选**:`OpenHarmonyApp::huawei_account()` 访问器(仿 `updater()`)。否决——会增加插件取句柄成本,而 account 无需 app 状态。
**备选**:模块级自由函数 `account::login()`。否决——结构体更易未来扩展(如缓存上一次 AccountInfo)且与 updater 一致。

### D4:`AccountInfo` serde camelCase + JS 线程解析
**选择**:`#[derive(Serialize,Deserialize)] #[serde(rename_all="camelCase")]`,字段 `uid/open_id/union_id/display_name/avatar_uri/authorization_code/access_token`(Option)。ArkTS `account.ets` **构造规范字段名的 `AccountInfo` 对象**(从 Account Kit `LoginWithHuaweiIDCredential` 映射),Rust `parse_account_info` 只读这些规范键(参考 `parse_check_result`)。
**理由**:与 updater `CheckResult` 一致(ArkTS 返回规范对象、Rust 读规范键);驼峰 JSON 便于 Phase 2 插件直接透传给 JS。
**字段大小写风险隔离**:arkts-helper 对 `LoginWithHuaweiIDCredential` 字段大小写回答冲突(`openId` vs `openID`)。因 ArkTS 侧负责映射到规范键,Rust 侧只读规范 `openId`/`unionId`/`avatarUri` 等,Account Kit 真实大小写风险被隔离到 `account.ets` 单文件,实现时由 DevEco 自动补全/官方 API 参考确认即可,不影响 Rust 侧与 spec。

### D5:能力检测与错误映射在 ArkTS 侧
**选择**:`account.ets` 每个方法入口 `if (!canIUse('SystemCapability.Account.OAuth')) throw { code: 'UNSUPPORTED' ...}`;Account Kit 的 `BusinessError` 透传,由 Rust 侧 `handle_account_promise` 的 `.catch` 把 `code`+`message` 转成字符串错误,Rust 再映射为 `Error::from_reason`(保留原始 code 串)。
**理由**:ArkTS 侧 `canIUse` 是 OHOS 官方检测手段;错误码透传让调用方(插件)可识别 `1001502001`(未登录)以降级。Rust 侧不硬编码 OHOS 错误码枚举(保持底层仓不耦合业务语义),仅透传——降级策略由 Phase 2 插件层决定。
**权衡**:spec 要求区分"不支持/取消/未登录/其他"。底层以 `Error::from_reason("rejected: <code>:<msg>")` 透传,插件层解析 code 分类;底层 UT 仅验证 `AccountInfo` serde(roundtrip / 可选字段缺失 / default)。`parse_account_info` 入参为 napi `Object`(需 Env fixture),无法作纯函数 UT,与 updater 的 `parse_check_result` 同——逻辑简单且镜像样板,留待设备端集成测试覆盖。
**实现更新(2026-07-30)**:错误归一**实际落在 ArkTS 侧而非 Rust 侧**——Rust `handle_account_promise`/`handle_void_promise` 的 `.catch` 只对 rejection 做 `coerce_to_string`(对 `BusinessError` 对象会得到 `"Error: msg"` 而**丢失 code**),无法在 Rust 侧提取 code+message。故由 `account.ets` 的 `errToCodeMessage` 把所有错误归一为 `"<code>:<message>"` **字符串**后 `throw`(`BusinessError` → `${code}:${message}`;已是字符串 → 透传;其他 → `String()`),Rust `.catch` 收到该字符串后包成 `Error::from_reason("rejected: <code>:<message>")`。插件层从 reason 中解析 code 分类。UNSUPPORTED 不再抛 `{code:'UNSUPPORTED'}` 对象,改抛数字伪码字符串:`1001500001`(UNSUPPORTED)、`1001502002`(state mismatch,见 D2);Account Kit 自身 `BusinessError`(如 `1001502001` 未登录)原码原样透传。

### D6:无版本守卫
**选择**:不加 `sdk_api_version()`/`distribution_api_version()` 守卫。
**理由**:Account Kit API since 12,等于 demo 默认最低版本;`canIUse` 已覆盖能力检测。若未来 demo 降 compatibleSdkVersion 再评估。

### D7:feature 隔离与双镜像
**选择**:Cargo `account = []`(默认关闭);`lib.rs`/`helper/mod.rs` 用 `#[cfg(feature="account")]`;`xcomponent.rs::render()` 内 `#[cfg(feature="account")]` 初始化 3 个 TSFN。ArkTS 侧 `native_ability/` 与 `package/` 两份镜像同步新增 `helper/account.ets` 及 `ArkHelper.ets`/`type.ets`/`helper/index.ets` 改动;改完 `pack.bat` 重建 `ability.har`。
**理由**:默认关闭保证不污染当前 tauri 构建直至 Phase 2 显式启用;双镜像是仓内既有约束(HAR 发布镜像)。
**实现更新(2026-07-30)**:Rust 侧门控**仅用 `#[cfg(feature = "account")]`,未叠加 `cfg(target_env = "ohos")`**——本仓(openharmony-ability)是 OHOS-only 桥接仓(依赖 napi-ohos/ohos-*-binding,本身只在 ohos target 编译),既有模块(updater/window/menu)均仅 feature 门控、不加 `cfg(target_env=ohos)`。本实现遵循仓内约定;design 原文"cfg(target_env=ohos) + feature=account"对本仓冗余。未污染已由 6.2(默认 `cargo check` 通过)实证。注:tauri/CLAUDE.md 铁律 2 的 `cfg(target_env=ohos)` 要求针对 tauri/tao/wry 等跨平台仓,不适用于本 OHOS-only 仓。

### D8:logout 映射为"取消授权"(`createCancelAuthorizationRequest`)
**选择**:`HuaweiAccount::logout` 在 ArkTS 侧用 `new authentication.HuaweiIDProvider().createCancelAuthorizationRequest()` + `AuthenticationController().executeRequest()` 实现。
**理由**:arkts-helper 引用官方 API 参考表确认 `HuaweiIDProvider` 是"认证工厂类",仅有 `createLoginWithHuaweiIDRequest`/`createAuthorizationWithHuaweiIDRequest`/`createCancelAuthorizationRequest` 三个方法,**不存在 `signOut()` 或 `createSignOutRequest()`**。Account Kit 的"退出登录"语义即"取消应用授权",`createCancelAuthorizationRequest` 是其官方对应物,清除应用在该设备上的登录/授权状态,满足 spec"退出登录"需求。
**备选(否决)**:仅丢弃本地 token 不通知系统——会导致系统侧授权状态不一致。

### D9:登录流不返回用户资料 —— AccountInfo 资料字段留空(Phase 1 hvigor 编译期发现)
**发现(2026-07-30,hvigor 编译 account.ets 时实证)**:`createLoginWithHuaweiIDRequest` + `executeRequest` 返回的 `LoginWithHuaweiIDCredential` **仅含** `openID`/`unionID`/`authorizationCode`(+ `idToken`),**不含** `uid`/`displayName`/`avatarUri`/`accessToken`(编译报 `Property 'uid'/'displayName'/'avatarUri'/'accessToken' does not exist on type 'LoginWithHuaweiIDCredential'`)。arkts-helper 早期回答称登录返回完整资料,**不准确**;hvigor 编译是唯一可靠证实。
**选择(Phase 1)**:`account.ets::toAccountInfo` 只读 `openID`/`unionID`/`authorizationCode` 三个真实字段;`uid`/`displayName`/`avatarUri` 留空字符串,`accessToken` 留 `null`。Rust `AccountInfo` 结构不变(字段仍在,只是登录流填不满),`parse_account_info` 不变。
**理由**:Phase 1 是底层桥接,忠实返回登录流实际提供的字段;不强填不存在的字段。spec"displayName/avatarUri 可能为空""accessToken MAY"被满足;spec"uid 非空"与 Account Kit 无 `uid` 字段冲突——见下方 spec 缺口。
**资料字段如何获取(已决策:选项 A,2026-07-30)**:arkts-helper 确认取昵称/头像需**单独**的 `createAuthorizationWithHuaweiIDRequest` + `scopes=['profile']`(授权流,非登录流),返回 `HuaweiIDCredential`(含 nickName/avatarUri)。`uid` Account Kit 无对应;`accessToken` 由服务端用 authorizationCode 换取,不在端上。**采纳选项 A**:Phase 1/2 登录返回精简 AccountInfo(仅 `openId`/`unionId`/`authorizationCode` 非空,`uid`/`displayName`/`avatarUri` 空字符串、`accessToken` null);资料字段由业务层需要时自行经授权流获取,不在本桥接/插件层处理。选项 B(Phase 3 增加授权流合并返回完整资料)**否决**——保持底层桥接单一职责,避免耦合授权语义。
**spec 同步修订**:spec"账号信息结构"与"字段完整返回"场景原假设登录返回 `uid` 非空——与 Account Kit 无 `uid` 矛盾,已按选项 A 修订 spec(登录流仅保证 `openId`/`unionId`/`authorizationCode` 非空,`uid`/`displayName`/`avatarUri` 可为空)。AccountInfo 结构字段不变(uid/displayName/avatarUri 保留,留作业务/未来授权流填充)。
**关联**:修正 D4(字段大小写风险隔离)——`openID`/`unionID` 大写 ID 已由 hvigor 编译证实正确;`uid`/`displayName`/`avatarUri`/`accessToken` 不是大小写问题而是字段不存在。

## Risks / Trade-offs

- **[Account Kit 实际返回字段差异]** → `parse_account_info` 对每个字段用 `unwrap_or_default`/`get().ok().flatten()`,缺失字段降级为空而非报错(对应 spec"可选字段缺失")。
- **[TSFN 未初始化即被调用]** → `HuaweiAccount::*` 在 `get_account_*_tsfn()` 返回 `None` 时返回 `Error::from_reason("account TSFN not initialized")`(仿 updater)。
- **[NAPI 重入上下文禁用 hilog]** → `account.ets` 被 Rust `func.call` 间接触发的路径内避免 `hilog`,改用 `console` 或 `safeLogError` 模式(ohos-constraints 2.3)。
- **[HAR 重建全链]** → 改动 ArkTS 后必须 `pack.bat` 重建 `ability.har` 并在 Phase 2/3 重新 `ohpm install`(ohos-constraints 3.2)。
- **[未登录降级不在底层做]** → 底层只透传 `1001502001`,降级为交互式登录由插件层负责,避免底层耦合业务策略(权衡:插件层需识别错误码)。
- **[ArkTS 严格模式约束(hvigor 编译期发现,新通用约束)]** → ArkTS 严格模式两条硬规则影响 account.ets:D5 原设计的"throw 字符串透传 code"违反 `arkts-limited-throw`(throw 只接受 Error 对象)——改为 `throw new Error("<code>:<message>")`,code 嵌进 message;`as any` 违反 `arkts-no-any-unknown`——改用类型化 `LoginWithHuaweiIDCredential` 访问(顺带实证字段大小写)。建议加入 `ohos-constraints.md` ArkTS 框架约束一节。注:既有 native_ability 代码(DefaultWebview/WindowManager 等)存在大量预存严格模式违规,demo 工程在严格模式下本就不干净——account.ets 是在严格模式下零错误通过的新代码。

## Migration Plan

1. 合并本 Phase 后,openharmony-ability 重建 `ability.har`。
2. tauri 侧在 Phase 2 启用 `openharmony-ability/account` feature 并新建插件。
3. 回滚:关闭 `account` feature 即可移除全部新代码路径;ArkTS 镜像改动可随 HAR 回退到上一版本。

## Open Questions

- `client_id` 是否需在 HAR 侧声明还是仅 entry 侧?(倾向仅 entry,Phase 3 处理;HAR 不自带 module.json5 能力声明。)
- ~~**导入路径待实现时确认**~~ → **已确认(arkts-helper)**:用 `@kit.AccountKit`→`authentication`(`@hms.core.authentication` 为 API 11 前旧路径,不采用)。
- ~~**`canIUse` 字符串待设备核实**~~ → **已确认(arkts-helper)**:用 `SystemCapability.Account.OAuth`(非 `.AppKit`)。实现采用 `canIUse('SystemCapability.Account.OAuth')`,无效则 try/catch Account Kit 调用降级(不影响 spec"不支持则不调用 Account Kit/不崩溃"行为)。Phase 3 仍需设备端实测复核。
- ~~**`LoginWithHuaweiIDCredential` 字段精确大小写**~~ → **已确认(arkts-helper)**:`authorizationCode`/`openID`/`unionID`(大写 ID)/`uid`/`displayName`/`avatarUri`/`accessToken`。已通过 D4 将风险隔离到 `account.ets` 单文件,ArkTS 侧按此大小写读取并映射到规范驼峰键。
- **`AuthenticationController` 是否需要 context**(实现期新增):arkts-helper 交互式登录示例传入 `UIAbilityContext`,但静默登录示例与官方 silent-login 指南用无参 `new authentication.AuthenticationController()`。本 Phase 按设计 D3/D5 采用无参构造(forceLogin=true 的 UI 拉起由系统 ability 完成);若 Phase 3 设备端 forceLogin=true 路径失败,再改为经 `getUIAbilityContext()` 传 context,风险隔离在 `account.ets` 单文件。
