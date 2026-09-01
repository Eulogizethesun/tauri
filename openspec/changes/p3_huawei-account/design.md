## Context

p1 完成 openharmony-ability 的 `HuaweiAccount` 桥接(返回 `AccountInfo`,错误以 `Error::from_reason("rejected: Error: <code>:<msg>")` 透传;`account.ets` 已通过 demo hvigor 编译 + 设备 serde UT;登录流仅返回 `openId`/`unionID`/`authorizationCode`,资料字段空——选项 A,见 p1 D9)。p2 完成 `tauri-plugin-huawei-account` 薄插件(`ohos.rs` 直接 `HuaweiAccount::new().login().await` 绕开 mobile 管道;`commands.rs` desktop stub `Unsupported`;`error.rs` 按 code 分类 `Unsupported`/`Cancelled`/`NotLoggedIn`/`Other`,Cancelled 码 TBD),已验证 examples/api ohos 构建通过(hvigor 编译 account.ets ✓、App 启动加载插件 ✓、242/244 无回归)并归档。

本 Phase 设备集成探索结论:
- `examples/api/src-tauri/gen/ohos/entry_{mobile,desktop}/src/main/module.json5`:已有 `requestPermissions`(`ohos.permission.INTERNET` + `SET_WINDOW_TRANSPARENT`),`metadata` 仅在 `extensionAbilities`(backup)内,**无 module 级 metadata** → 需新增 module 级 `metadata`。
- capabilities:`run-app.json` 覆盖主窗口;`desktop-plugins.json` 限 macOS/windows/linux。无 ohos 专用 capability。权限标识格式 `"plugin:default"` 或 `"plugin:allow-xxx"`。
- 前端测试:`src/lib/tests/plugins.ts` 的 `pluginTests: TestCase[]`,`TestCase.category = 'auto'|'side-effect'|'manual'`,经 `TestRunner.svelte` 运行。
- arkts-helper 确认:client_id 声明为 `module.metadata` 数组项 `{name:"client_id", value:"<OAuth2 client_id>"}`(取自 AppGallery Connect 项目设置);Account Kit 取消码 = `1001502012`(`ERROR_CODE_USER_CANCEL`)。

## Goals / Non-Goals

**Goals:**
- module.json5 声明 client_id(双 entry),使 Account Kit 身份校验通过。
- capabilities 授权 huawei-account 权限给主窗口。
- 补全 error.rs 取消码(1001502012 → Cancelled)+ UT。
- 前端 JS 集成(dist-js + examples/api 依赖)+ plugins.ts 测试入口,供设备验证。
- 设备实测:真实 silentLogin/login 返回 AccountInfo、未登录降级、cancel→Cancelled、canIUse/controller 复核。
- desktop 降级 runtime 验证(unsupported 不崩溃)。

**Non-Goals:**
- 不做前端 auto 测试用例完善与 desktop stub 行为对齐审计(Phase 4)。
- 不改 openharmony-ability(p1)与插件公共 API/AccountInfo 结构。
- 不申请手机号等需企业权限的敏感 scope(选项 A:不增加授权流取资料)。

## Decisions

### D1:client_id 声明在 module 级 metadata(双 entry)
**选择**:在 `entry_mobile` 与 `entry_desktop` 的 `module.json5` 的 `module` 节点新增 `metadata: [{ "name": "client_id", "value": "<占位>" }]`(与 `requestPermissions`/`abilities` 同级)。INTERNET 已存在不加。
**理由**:arkts-helper 确认 Account Kit 要求 module 级 `client_id` metadata;双 entry 因 examples/api 同时有 mobile/desktop 两个 entry(分别对应手机/平板与 PC/2in1),两处都需声明。
**client_id 来源**:AppGallery Connect → 项目设置 → 常规 → 应用 → OAuth 2.0 客户端 ID。**设计仅定结构,值由用户填入**(敏感凭据,不入设计文档)。
**备选(否决)**:仅改 entry_mobile —— desktop 设备(2in1 PC)也需登录,两 entry 都要。

### D2:新建 huawei-account.json capability(全平台)
**选择**:新建 `examples/api/src-tauri/capabilities/huawei-account.json`,`identifier: "huawei-account"`,`windows: ["main","main-*"]`,`permissions: ["huawei-account:default"]`,**不限制 platforms**(ohos 真实 + desktop stub 均需 ACL 放行才能 invoke)。
**理由**:huawei-account 命令在 ohos 与 desktop 都存在( desktop 为 stub),ACL 需在两端都授权;不加 `platforms` 即全平台生效,与 `run-app.json` 同模式。`huawei-account:default`(p2 permissions/default.toml)含三条 allow。
**备选(否决)**:加进 `run-app.json` —— 语义混杂(run-app 是测试基础设施权限);独立 capability 更清晰。

### D3:补 error.rs Cancelled 映射(1001502012)
**选择**:插件 `src/error.rs::from_napi_reason` 的 match 增加 `"1001502012" => Error::Cancelled`;补 UT(`parse_cancelled`)。其余映射(1001500001→Unsupported、1001502001→NotLoggedIn、else→Other)不变。
**理由**:arkts-helper 确认取消码 1001502012(p2 D4 TBD 解决)。取消是登录常见路径,前端需识别以静默处理(不弹错误 Toast)。改的是 p2 已归档的 error.rs,但代码未 commit,可直接改。
**一致性**:与 p1 透传的 code 串、p2 的 `from_napi_reason` 解析(剥 "rejected: "/"Error: " 前缀)一致。

### D4:前端用直接 invoke,plugins.ts 加 manual/side-effect 用例
**选择**:`plugins.ts` 增加 huawei-account 测试用例,用 `import { invoke } from '@tauri-apps/api/core'` 直接 `invoke('plugin:huawei-account|login'|'silent_login'|'logout')`(不依赖插件 JS 包的 typed 导出),category 为 `manual`(login/silentLogin 需设备+人工)或 `side-effect`(logout)。断言:ohos 返回 AccountInfo 形状(`openId`/`unionId`/`authorizationCode` 字段存在)、desktop 返回 unsupported 错误。
**理由**:直接 invoke 避免插件 JS dist-js 构建依赖(file: 依赖 + dist-js 时序问题,ohos-build gotcha #5);examples/api 是测试载体,直接 invoke 足够验证命令契约。TestRunner 已提供运行 UI(即 plan 的"测试页")。
**备选(否决)**:import `@tauri-apps/plugin-huawei-account` typed API —— 需构建 dist-js + 加 examples/api 前端 file: 依赖 + 时序处理,Phase 3 设备验证不需要。
**注**:Phase 4 若引入 typed JS 包做正式 auto 测试,再补 dist-js + 依赖;本 Phase 不做。

### D5:desktop 降级 runtime 验证(经 plugins.ts + 设备/desktop 构建)
**选择**:desktop 降级已在 p2 `commands.rs` stub 实现(`Err(Unsupported)`),本 Phase 经 plugins.ts 的 desktop 测试用例 + examples/api desktop 构建启动验证三命令返回 `unsupported` 不崩溃。不改插件代码。
**理由**:p2 已 cargo check + error UT 覆盖 desktop stub;本 Phase 补 runtime 验证(plan 7.4)。

### D6:设备实测项(p1 移交复核)— ✓ 已实测(2026-08-03)
**选择**:设备实测时复核 p1 移交项:① `canIUse('SystemCapability.Account.OAuth')` 实际生效;② `AuthenticationController` 无参构造在 forceLogin=true 路径是否需 context(若失败,改 account.ets 经 `getUIAbilityContext()` 传 context,回 p1 仓修 + 重建 HAR);③ 真实登录返回 `openId`/`unionID`/`authorizationCode`(资料字段空,选项 A);④ 取消登录→code 1001502012→Cancelled;⑤ 未登录(1001502001)→NotLoggedIn→降级 login。
**理由**:p1 design Open Questions 的设备实测项,本 Phase 是首次真实登录,必须复核。若 account.ets 需改,走 openharmony-ability 修改 + pack.bat 重建 HAR + ohpm install 全链(ohos-constraints 3.2)。

**实测结论(2026-08-03,设备 desktop/2in1,bundle `com.richerfu.huaweiaccount`)**:
- ① **canIUse 已移除**:`canIUse('SystemCapability.Account.OAuth')` 在测试设备(HarmonyOS PC)返回 false,尽管 Account Kit 可用 → 预检查会阻断所有登录。account.ets 已直接调用 Account Kit(见 account.ets 注释,p3 device-verify),若设备真缺能力,Account Kit 抛真实 BusinessError 透传(不崩溃)。
- ② **AuthenticationController 必须传 context(无参失败)**:forceLogin=true 且系统未登录时,无参 `AuthenticationController()` 抛 `Parameter error. Incorrect context parameter type`;改用 `AuthenticationController(context)`(context 经 ArkHelper `getUIAbilityContext()` 传入)后正常拉起交互面板。**account.ets `loginWithHuaweiID` / `login` / `silentLogin` 均改为接收 `common.UIAbilityContext`**;ArkHelper `accountLogin`/`accountSilentLogin` 内部获取 context 透传(type.ets 对外接口仍 `() => Promise<Object>`,context 在 ArkHelper 内部获取,不影响 Rust TSFN 无参调用)。已重建 HAR + ohpm install。
- ③ **login 返回 AccountInfo**:`openId`/`unionId`/`authorizationCode` 有值,资料字段(displayName/avatarUri/uid)空、accessToken null(选项 A ✓)。
- ④ **取消码 1001502012 → Cancelled ✓**:hilog 铁证 `account.ets: loginWithHuaweiID failed: 1001502012:The user canceled the authorization.` → error.rs 映射 Cancelled。
- ⑤ **未登录 1001502001 → NotLoggedIn ✓**:系统未登录时 silentLogin 返回 `not-logged-in`(Error::NotLoggedIn 序列化值,即 1001502001)。
- **已登录已授权静默返回**:系统已登录且已授权时,login(forceLogin=true)不弹面板直接返回凭证(Account Kit 正常行为,非 bug);logout(`createCancelAuthorizationRequest`)取消应用授权后,login 仍静默重授权返回(系统账号在 → 静默成功)。
- **silentLogin 失败条件比预期窄(实测发现,2026-08-03)**:silentLogin(`forceLogin=false`)只在**系统未登录**时失败(1001502001);"系统已登录 + 应用授权已取消(logout 后)"场景下 silentLogin **仍静默成功返回 AccountInfo**(Account Kit 自动重新授权,因系统账号在场)。即 logout 不能用来制造 silentLogin 失败——降级场景只能靠"系统未登录"触发。前端若需"授权取消后强制重新交互登录",应显式调 `login`(forceLogin=true),不能依赖 silentLogin 失败降级。

### D7:改 examples/api bundle name 为 `com.richerfu.huaweiaccount`(AGC 包名冲突)
**背景**:`com.tauri.api`(examples/api 默认 bundle name)在 AGC 全局已被其他开发者注册,本机用户无法用它创建 AGC 应用 → Account Kit client_id 无从获取。
**选择**:把 examples/api 的 bundle name 改为用户独有的 `com.richerfu.huaweiaccount`,并在 AGC 注册该包名的应用以获取 client_id。
**改动范围(已核实,很小)**:
- `examples/api/src-tauri/tauri.conf.json` 的 `identifier`(源头)
- `examples/api/src-tauri/gen/ohos/AppScope/app.json5` 的 `bundleName`(生成产物,直接改)
- 其余 `.hvigor`/`build/` 缓存引用旧名 → 重新构建自动刷新
- `ohos-build/scripts/run-tests.sh` 的测试报告路径**动态读** `app.json5` 的 `bundleName`(line 20-21,`$BUNDLE_NAME`),不硬编码 → 无需改脚本
- capabilities 用 window label 不用包名 → 不受影响;242/244 自动测试不受影响
**理由**:Account Kit 鉴权要求 AGC 应用包名与 App 实际包名一致;`com.tauri.api` 不可用,必须改用用户独有包名。动态读取避免脚本改动。
**注**:设备上旧 `com.tauri.api` 应用残留无关(不同 bundle,各自卸载)。

### D7-revised:回退 examples/api 包名 + 新建独立测试应用(2026-08-06,reviewer 反馈)

**背景**:reviewer 指出 D7 改 examples/api 包名(`com.tauri.api` → `com.richerfu.huaweiaccount`)影响面太大(examples/api 是多插件集成示例应用,包名变更连带 hdcinstall.bat / 测试提示文本 / AGC 配置等),要求回退。华为账号功能改为独立最小应用承载。

**选择**:
- **examples/api 完全回退** `com.tauri.api`:identifier / Cargo.toml / lib.rs / package.json / plugins.ts / TestRunner.svelte / capabilities / doc/manual_tests.md 全部回到 PR 之前状态(`git diff origin/ohdev -- examples/api` 为空)。examples/api 不再集成 huawei-account。
- **新建 `examples/huawei-account/` 独立最小应用**:包名 `com.richerfu.huaweiaccount`(AGC 已登记),只集成 `tauri-plugin-huawei-account` + 3 按钮(login/silentLogin/logout)+ 结果显示。无 TestRunner/auto 测试框架(最小应用)。加入 workspace members + pnpm-workspace。
- **AGC 配置复用**:client_id `6917612311388969281` + 签名套(account.p12 + tauriAccountDebug.p7b + tauriTest.cer)同包名同证书,直接从 examples/api 复制到新应用 `gen/ohos/`(agconnect-services.json + build-profile.json5 signingConfigs)。
- **构建**:`cargo tauri ohos run --device-type desktop`(ohos-build skill 脚本硬编码 examples/api 不能用,但 CLI 路径无关)。新应用设备验证 BUILD SUCCESSFUL + SignHap 通过 + 安装启动 ✓。

**理由**:
- examples/api 保持 `com.tauri.api` 不影响其他功能(Reviewer 顾虑消除)。
- 华为账号功能隔离在独立应用,包名 `com.richerfu.huaweiaccount` 与 AGC 登记一致,Account Kit 鉴权可用。
- 保留 examples/api 原集成会破坏测试(回退 com.tauri.api 后 AGC package_name 不匹配 → auto 断言失败),故一并删除集成。

**改动范围**:
- examples/api:8 处包名回退 + 删 huawei-account 集成(Cargo.toml dep / lib.rs 两处 plugin / capabilities / package.json / plugins.ts 3 用例 / TestRunner 3 函数+按钮 / manual_tests.md)
- 新增 examples/huawei-account/(14 文件:Cargo.toml / tauri.conf.json / lib.rs / main.rs / build.rs / capabilities / package.json / vite.config / svelte.config / index.html / src/main.js / src/App.svelte / doc/manual_tests.md)
- tauri 根 Cargo.toml + pnpm-workspace.yaml 加 member
- 手动用例文档搬移到 examples/huawei-account/doc/manual_tests.md(步骤从"TestRunner 按钮"改"主界面按钮")

**注**:D7 原文保留(决策演进轨迹)。D8 签名证书现归新应用 examples/huawei-account(examples/api 回退 DevEco 自动签名 default_ohos 套)。

### D8:稳定签名证书(Account Kit 鉴权前置)
**背景**:Account Kit 鉴权要求 AGC 登记的应用**签名证书 SHA256** 与 App 实际签名证书一致。examples/api 当前用 `C:\Users\admin\.ohos\config\default_ohos_*.p12` 自动 debug keystore,存在每次构建/重新 init 证书变化的风险(ohos-constraints 3.3)→ SHA256 变化 → 与 AGC 登记不符 → 鉴权失败。
**实现更新(2026-07-30)**:改 bundle name(D7)后,原签名配置失效(`bundleName does not match SigningConfigs`)。re-init 清空了 signingConfigs;经 DevEco「Project Structure → Signing Configs → Automatically generate signature」重新生成。**证书发生了变化**:旧证书是 "unknown(...),Development" 占位证书(SHA256 `61:00:...`),DevEco 重新生成后变为**绑定开发者身份(赵超)的正式 debug 证书**(SHA256 `E4:4D:6F:E2:89:ED:95:3A:B8:CF:20:BD:76:55:32:B3:7C:15:D4:3F:41:0E:85:9A:52:A0:C4:F7:01:E9:32:F9`)。AGC 已更新登记为新 SHA256(旧 61:00:... 已替换)。
**选择(实现时二选一)**:
- **方案 A(推荐,稳定)**:生成一个用户自有的固定 keystore,在 `gen/ohos/build-profile.json5` 的 `signingConfigs` 配置其 `storeFile`/`keyAlias`/密码,取其 SHA256 登记到 AGC。
- **方案 B(快速验证)**:用当前 debug `.p12` 的证书,取其 SHA256 登记到 AGC;若后续重新构建证书不变则可用,若变化则转方案 A。
**实际采用**:方案 B(DevEco auto-signing 生成的开发者正式 debug 证书)。该证书绑定开发者账号,DevEco 复用,稳定性优于旧 "unknown" 占位证书。
**前置**:用户已在 AGC「项目设置 → 常规 → 应用」登记新 SHA256(`E4:4D:...`)。

**D8-revised(2026-08-06,随 D7-revised)**:D7-revised 回退 examples/api 包名后,签名证书分离:
- **examples/huawei-account(新应用)**:用 AGC 登记的手动签名套(`account.p12` + `tauriAccountDebug.p7b` + `tauriTest.cer`,keyAlias=tauri,SHA256withECDSA),包名 `com.richerfu.huaweiaccount` 与 p7b 绑定包名一致。Account Kit 鉴权用这套。设备验证 SignHap 通过。
- **examples/api(回退)**:重新用 DevEco 自动签名(`default_ohos_*.p12` 套,keyAlias=debugKey),为 `com.tauri.api` 重新申请 profile。不含 AGC 配置(无华为账号功能)。

## Risks / Trade-offs

- **[gen/ohos 是生成产物]** → module.json5 在 `gen/ohos/entry_*/`,tauri-cli ohos init 会重新生成可能覆盖 client_id。权衡:Phase 3 直接改 gen(实际构建用的就是 gen);若后续 re-init 丢失,需重新填入。建议长期把 client_id 纳入 init 模板(超出本 Phase)。
- **[client_id 未填]** → 设计用占位值,设备实测前用户必须从 AppGallery Connect 获取并填入真实 client_id,否则登录身份校验失败。
- **[AuthenticationController 无参构造]** → ~~p1 D3/D5 选无参,arkts-helper 交互式示例传 context。forceLogin=true 路径若设备失败,按 D6 改 account.ets(风险隔离 p1 单文件)。~~ **已消解(2026-08-03 实测)**:无参构造在 forceLogin=true 需拉起 UI 时抛 `Incorrect context parameter type`,已改为 `AuthenticationController(context)`,见 D6 结论。
- **[取消码来源]** → 1001502012 由 arkts-helper 给出(引用 @hms.core.account 文档);~~设备实测确认 catch 到该码即 Cancelled,若不符则调整。~~ **已确认(2026-08-03 hilog 实证)**:面板取消返回 `1001502012:The user canceled the authorization.` → Cancelled,映射正确。
- **[前端 file: 依赖时序]** → D4 选直接 invoke 规避;若 Phase 4 引入 typed JS 包,需处理 dist-js 构建与 ohpm/pnpm install 时序(ohos-build gotcha #5)。
