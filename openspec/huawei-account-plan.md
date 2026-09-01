# 华为账号一键登录 (Huawei Account One-Tap Login) 适配计划

**创建时间**：2026-07-29（重设计，覆盖旧 Option A 方案）
**功能描述**：在 Tauri OHOS 应用中接入 HarmonyOS Account Kit，实现华为账号一键登录（silentLogin 静默 + 交互式 login + logout），返回 `AccountInfo`（uid/openId/unionId/displayName/avatarUri/authorizationCode/accessToken）供客户端识别与服务端校验。mobile + desktop 均做。
**判断依据**：涉及 3 个代码层 + ArkTS，预估 ~30 文件（以新建为主）；既有底层桥接又有上层插件集成 + 前端测试 → 拆 4 Phase。

## 关键架构决策（Option B：经 openharmony-ability 调 ArkTS）

1. **Account Kit 调用收进 `openharmony-ability` 仓**（符合 CLAUDE.md 铁律 1）。
   - 在 openharmony-ability 内新增 `account` 能力模块，参考 autostart/updater 样板：Rust 侧 `helper/account.rs`（TSFN）+ `account.rs`（公共 API，oneshot 把 ArkTS Promise 转 Rust Future）；ArkTS 侧 `helper/account.ets`（`import { authentication } from '@kit.AccountKit'` 真实实现）+ `ArkHelper.ets` 转发 + `type.ets` 接口。
   - 插件 `tauri-plugin-huawei-account` 为**纯 Rust + JS 薄插件**：`commands.rs` 在 `cfg(target_env="ohos")` 下直接 `await openharmony_ability::account::*`，**绕开** `run_mobile_plugin`/`dispatch_run_command`/`PENDING_PLUGIN_CALLS` 插件命令管道；插件**无业务 ArkTS**。
   - Windows/macOS/Linux：`desktop.rs` stub 返回 `unsupported`。

2. **Account Kit API（arkts-helper 已核实）**：
   - `@kit.AccountKit` → `authentication`；`HuaweiIDProvider().createLoginWithHuaweiIDRequest()`（`forceLogin=false` 静默 / `true` 交互，`state=util.generateRandomUUID()`）+ `new AuthenticationController().executeRequest(req)` → `LoginWithHuaweiIDResponse.data`（`LoginWithHuaweiIDCredential`：authorizationCode/openId/unionId/uid/displayName/avatarUri/accessToken）。退出登录用 `createCancelAuthorizationRequest()` + `executeRequest()`（即"取消授权"，Account Kit 无 `signOut()`/`createSignOutRequest()`，见 design D8）。
   - API since 12（HarmonyOS 5.0.0+）→ 满足 demo 默认 API 12，**无需版本守卫**。
   - 能力检测 `canIUse('SystemCapability.Account.OAuth')`（arkts-helper 已确认，非 `.AppKit`；Phase 3 设备端复核，无效则改用 try/catch 调用降级）；未登录错误码 `1001502001` → 降级交互式登录。

3. **平台支持**：OHOS mobile + desktop 真实实现（PC/2in1 完全可用）；其他平台 stub。

4. **配置**：app entry `module.json5` 加 `metadata: client_id` + `requestPermissions: ohos.permission.INTERNET`（HAR 不自带能力声明）。

## 工具就绪状态

- ✅ **arkts-helper MCP 已连接** — Account Kit API 签名/版本/PC 可用性已核实，旧 plan 的三个 ⚠️ 待验证风险全部消解。
- ✅ **openspec CLI 1.7.0 已安装** — Phase 1 设计文档已由 openspec 驱动生成并通过 `openspec validate`。

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | openharmony-ability account 桥接模块 | p1_huawei-account | ✓ 已实现并验证 | openharmony-ability Rust + ArkTS | 4 新增+10 改 | cargo check(ohos) ✓ + HAR 出包 ✓ + 设备端 UT 4/4 ✓ |
| 2 | 插件骨架 + 编译打通 | p2_huawei-account | ✓ 已归档 | tauri-plugin Rust + JS + examples 注册 | ~14 | cargo check(ohos+desktop) + App 启动含插件 |
| 3 | 设备集成 + desktop 降级 | p3_huawei-account | ✓ 已实现并验证 | examples/api module.json5 + capabilities + 测试页 | ~7 | 设备端登录返回真实 AccountInfo；desktop 返回 unsupported |
| 4 | 前端测试 + 差距修复 | p4_huawei-account | ✓ 已实现并验证 | examples/api 测试用例 + desktop stub 审计 | ~5 | auto/side-effect/manual 用例通过；stub 行为对齐 |

## Phase 详细说明

### Phase 1: openharmony-ability account 桥接模块（✓ 已实现并验证，2026-07-30）
- **目标**：在 openharmony-ability 内新增 `account` 能力模块，Rust 侧暴露 `account::login/silent_login/logout` 异步公共 API（返回 `AccountInfo`），ArkTS 侧真实接入 `@kit.AccountKit`；重建 `ability.har`。
- **实际产出**：`HuaweiAccount::new()` + async `login`/`silent_login`/`logout`（返回 `Result<AccountInfo>` / `Result<()>`）；`AccountInfo`(camelCase serde)；错误以 `Error::from_reason("rejected: <code>:<msg>")` 透传；`account` feature 默认关闭；`ability.har` 已重建含 `account.ets`。详见桌面 `p1_huawei-account-变更清单.md` 与 `openspec/changes/p1_huawei-account/design.md`。
- **文件列表（实际）**：
  - 新建 `crates/ability/src/helper/account.rs`（TSFN：`create_account_login_tsfn`/`create_account_silent_login_tsfn`/`create_account_logout_tsfn` + `get_*_tsfn`）
  - 新建 `crates/ability/src/account.rs`（`pub struct HuaweiAccount`/`AccountInfo`(serde) + async login/silent_login/logout + `handle_account_promise`/`parse_account_info`/`send_once` + 4 个 serde UT）
  - 改 `crates/ability/src/lib.rs`（`mod account; pub use` + feature gate）
  - 改 `crates/ability/src/helper/mod.rs`（`mod account`）
  - 改 `crates/ability/src/render/xcomponent.rs`（`render()` 内 `#[cfg(feature="account")]` 初始化 TSFN）
  - 改 `crates/ability/Cargo.toml`（`account = []` feature）
  - 新建 `native_ability/src/main/ets/helper/account.ets` + `package/src/main/ets/helper/account.ets`（双镜像，真实实现 + `canIUse` 检测 + 错误归一透传）
  - 改 `native_ability`/`package` 的 `ability/ArkHelper.ets`（`accountLogin/accountSilentLogin/accountLogout` 转发）、`ability/type.ets`（接口 + `AccountInfo`）、`helper/index.ets`（export）
  - **未做（design D3 否决）**：原计划的 `app.rs` `pub fn huawei_account()` 访问器——Account Kit 无 per-app 状态，改用 `HuaweiAccount::new()` 独立句柄。
- **依赖**：无
- **验证（实际）**：`cargo check --features account --target aarch64-unknown-linux-ohos` ✓；默认 `cargo check`（无 account）✓ 未污染；`pack.bat` 重建 `ability.har` 含 `account.ets` ✓；设备端 UT 4/4 通过（serde roundtrip / 可选字段 null / 缺 key / default，`--test-threads=1`）。`parse_account_info` 需 NAPI fixture 不可纯函数测，与 updater 一致。
- **残留（移交后续 Phase）**：① ~~ArkTS `account.ets` 未经 hvigor 编译~~ → **已补验证(2026-07-30)**：经 demo 工程 hvigor 编译,修复 2 处 ArkTS 严格模式错误(throw 字符串→`throw new Error`;`as any`→类型化访问),account.ets 现零错误;并发现 `LoginWithHuaweiIDCredential` 仅含 `openID`/`unionID`/`authorizationCode`,**不含** `uid`/`displayName`/`avatarUri`/`accessToken`(见 design D9)——**已决策选项 A**:登录返回精简 AccountInfo(资料字段留空,业务另行获取),不增加授权流;② `canIUse('.OAuth')` 与 `AuthenticationController` 无参构造待 Phase 3 设备实测复核。

### Phase 2: 插件骨架 + 编译打通（✓ 已归档，2026-07-30 验证通过）
- **目标**：新建 `tauri-plugin-huawei-account` 纯 Rust+JS 插件；OHOS 命令路由到 `openharmony_ability::HuaweiAccount`，desktop stub `unsupported`；注册进 examples/api；命令可被 invoke。
- **实际产出**：插件 crate(14 新增 + 5 build.rs 自动生成)+ examples/api 集成。OHOS 命令直接 `HuaweiAccount::new().login().await` 绕开 mobile 插件管道;插件本地 `AccountInfo` model;`Error` 按 code 分类(Unsupported/NotLoggedIn/Cancelled/Other)+ 4 UT。详见桌面 `p2_huawei-account-变更清单.md` 与 `openspec/changes/p2_huawei-account/design.md`。
- **文件列表（实际）**：
  - `plugins-workspace/plugins/huawei-account/Cargo.toml`、`build.rs`、`src/{lib.rs,ohos.rs,commands.rs,error.rs,models.rs}`（注:无 `desktop.rs`/`mobile.rs`,用 `ohos.rs`+`commands.rs` 双 cfg 分文件,仿 updater）
  - `plugins-workspace/plugins/huawei-account/{package.json,rollup.config.js,tsconfig.json,guest-js/index.ts}`
  - `permissions/default.toml` + `autogenerated/commands/{login,silent_login,logout}.toml`（**allow-*.toml 由 build.rs 自动生成,非手写**,design D7 更新）
  - `examples/api/src-tauri/Cargo.toml`（依赖）、`src/lib.rs`（`.plugin(tauri_plugin_huawei_account::init())`）
- **依赖**：Phase 1 完成
- **验证（实际）**：`cargo check -p tauri-plugin-huawei-account --target aarch64-unknown-linux-ohos` ✓；`cargo check -p tauri-plugin-huawei-account`（desktop,不引入 openharmony-ability）✓；`cargo check -p api --target aarch64-unknown-linux-ohos` ✓；error 分类 UT 4/4 ✓。
- **残留（移交后续 Phase）**：① 7.4 runtime invoke(desktop 启动调三命令返回 unsupported 不崩溃)留待 tauri-ohos-verify;② Cancelled 错误码未知,Phase 2 暂归 Other,Phase 3 设备实测补;③ examples/api ohos hvigor 构建将是 p1 `account.ets` 首次经真实消费者编译(p1 已 demo 单独验证),Phase 3 若报错回 openharmony-ability 修 + 重建 HAR + ohpm install;④ capabilities 授权 huawei-account 权限(Phase 3)。

### Phase 3: 设备集成 + desktop 降级
- **目标**：entry `module.json5` 加 `client_id` + `INTERNET`；capabilities 授权；测试页 svelte；desktop 降级路径验证；真实设备 silentLogin + 交互式登录。
- **文件列表**：
  - `examples/api/src-tauri/gen/ohos/entry_*/src/main/module.json5`（client_id + INTERNET）
  - `examples/api/src-tauri/capabilities/*.json`（授权 huawei-account 权限）
  - `examples/api/src/`（测试页 svelte 组件）
  - `src/mobile.rs`/`src/commands.rs`（desktop 降级分支确认）
- **依赖**：Phase 2 完成
- **验证**：手机/平板/2in1 设备端 silentLogin + 交互登录返回真实 `openId`/`unionId`/`authorizationCode`(`uid`/`displayName`/`avatarUri` 空字符串、`accessToken` null,见 design D9 选项 A);未登录降级交互式;desktop 返回 unsupported 不崩溃。

### Phase 4: 前端测试 + 差距修复
- **目标**：examples/api 前端测试用例（auto/side-effect/manual）；对照 Windows/macOS stub 行为审计差距并修复。
- **文件列表**：
  - 前端测试用例文件（参考 frontend-api-testing，auto/side-effect/manual 分类）
  - `src/desktop.rs`（stub 行为对齐审计/修复）
  - `examples/api/src/`（测试页完善）
- **依赖**：Phase 3 完成
- **验证**：auto 用例通过；side-effect/manual 用例设备端可执行；desktop stub 返回一致 unsupported。

## 状态说明
- `○ 待开始` / `● 进行中` / `✓ 设计完成` / `✓ 已归档`

## 下一步

Phase 3 设计已完成(`openspec/changes/p3_huawei-account/`,4/4 artifact 通过 `openspec validate`,审计通过)。**下一步是 Phase 3 实现**:

### Step 1 — Phase 3 实现（tauri-ohos-apply Skill）
按 `p3_huawei-account/tasks.md` 6 组任务实现,方案变动及时回写 design.md:
- `module.json5`(entry_mobile + entry_desktop):新增 module 级 `metadata: [{name:"client_id", value:"<AppGallery Connect>"}]`(INTERNET 已有);**用户需填入真实 client_id**
- 新建 `capabilities/huawei-account.json`(`huawei-account:default`,主窗口,全平台)
- 插件 `error.rs`:`from_napi_reason` 加 `1001502012 → Cancelled` + UT(p2 D4 补全)
- `plugins.ts`:加 huawei-account 测试用例(直接 `invoke`,manual/side-effect,断言 AccountInfo 形状 + desktop unsupported)
- 关键决策见 `p3_huawei-account/design.md` D1~D6

### Step 2 — Phase 3 验证（tauri-ohos-verify Skill）
- ohos-build 构建 examples/api(含 client_id + capabilities + error 改动)→ hvigor BUILD SUCCESSFUL → 安装启动
- 设备实测:silentLogin/login 返回真实 `openId`/`unionId`/`authorizationCode`(资料字段空,选项 A);未登录(1001502001)降级;取消(1001502012)→Cancelled;`canIUse('.OAuth')` + `AuthenticationController` 无参构造复核(若失败回 p1 account.ets 改 + 重建 HAR)
- desktop 构建运行测试用例 → 三命令 `unsupported` 不崩溃(补 p2 7.4)
- huawei-account 手动用例整理到 `doc/manual_tests.md`

### Step 3 — Phase 4 设计(Phase 3 实现并验证后)
前端测试 + 差距修复:auto/side-effect/manual 用例完善、desktop stub 行为对齐审计、(可选)typed JS 包集成。

### 移交项(累计)
- Phase 3 设备实测:canIUse/controller 无参/真实登录返回/未登录降级/取消码 Cancelled
- Phase 4 前端 auto 测试 + desktop stub 对齐 + Windows desktop runtime 复核(Phase 2 7.4 低风险)
