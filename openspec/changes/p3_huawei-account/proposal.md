## Why

> **Revised 2026-08-06(D7-revised)**:reviewer 反馈 examples/api 改包名影响面太大,本 Phase 涉及 examples/api 的改动(bundle name 改名 / huawei-account 集成 / capabilities / 前端测试 / manual_tests)**已全部回退**,examples/api 回到 PR 之前状态(`com.tauri.api`)。华为账号功能改为在新建独立应用 `examples/huawei-account/`(包名 `com.richerfu.huaweiaccount`)承载。下方"What Changes"保留原文(历史决策),实际实现见 design.md D7-revised + examples/huawei-account/。

Phase 1 完成 openharmony-ability 底层桥接(`HuaweiAccount`),Phase 2 完成 `tauri-plugin-huawei-account` 薄插件骨架(Rust+JS,ohos 路由 + desktop stub)并验证编译通过 + App 加载。但此时 OHOS 端还无法真实登录——`module.json5` 未声明 Account Kit 所需的 `client_id`,capabilities 未授权 `huawei-account` 权限,错误分类缺取消码,前端无触发入口。本 Phase 完成设备集成与 desktop 降级,使华为账号登录在 OHOS 设备端真实可用、在非 OHOS 平台确定返回 `unsupported`。

## What Changes

- **module.json5**(`examples/api/src-tauri/gen/ohos/entry_mobile` + `entry_desktop`):在 `module` 节点新增 `metadata: [{ "name": "client_id", "value": "<AppGallery Connect OAuth2 client_id>" }]`。`ohos.permission.INTERNET` 已存在,无需新增。client_id 由用户从 AppGallery Connect 获取后填入(设计仅定结构与占位)。
- **bundle name 改名(D7)**:`com.tauri.api` 在 AGC 全局已被他人注册,无法用于 Account Kit。改 examples/api bundle name 为用户独有的 `com.richerfu.huaweiaccount`(`tauri.conf.json` identifier + `gen/ohos/AppScope/app.json5` bundleName);`run-tests.sh` 动态读 bundleName,无需改脚本。
- **稳定签名证书(D8)**:Account Kit 鉴权要求 AGC 登记的签名 SHA256 与实际签名一致;当前 debug keystore 有变化风险。取当前 `.p12` 证书 SHA256 登记到 AGC,若不稳定则配置固定 keystore 到 `gen/ohos/build-profile.json5`。
- **capabilities**:新建 `examples/api/src-tauri/capabilities/huawei-account.json`,授权 `huawei-account:default`(含 allow-login/allow-silent-login/allow-logout),windows `["main","main-*"]`,全平台(ohos 真实 + desktop stub 均需 ACL 放行)。
- **error 分类补全**:插件 `src/error.rs` 的 `from_napi_reason` 增加 `1001502012`(`ERROR_CODE_USER_CANCEL`)→ `Cancelled` 映射(p2 design D4 的 TBD 项,arkts-helper 已确认取消码);补对应 UT。
- **前端 JS 集成**:构建插件 `dist-js`(rollup),`examples/api` 前端加 `@tauri-apps/plugin-huawei-account` 依赖(file: 指向 `plugins-workspace/plugins/huawei-account`);`plugins.ts` 增加 huawei-account 测试用例(manual/side-effect:login/silentLogin/logout,断言 `AccountInfo` 形状、desktop 返回 unsupported),经 TestRunner 触发用于设备端验证。
- **desktop 降级验证**:确认非 OHOS 平台三命令返回 `unsupported` 不崩溃(经 plugins.ts 测试用例 + runtime)。
- 本 Phase **不含**:前端 auto 测试用例完善与 desktop stub 行为对齐审计(Phase 4)。

## Capabilities

### New Capabilities
- `huawei-account-device`: 设备集成层——module.json5 client_id 声明、capabilities ACL 授权、Account Kit 取消码错误分类补全、前端测试入口,使华为账号登录在 OHOS 设备端真实可用(返回 `openId`/`unionId`/`authorizationCode`,资料字段空,选项 A)并在非 OHOS 平台返回 `unsupported`。

### Modified Capabilities
- `huawei-account`(p2 归档):错误分类补 `Cancelled`(code `1001502012`),原 `Unsupported`/`NotLoggedIn`/`Other` 不变;`AccountInfo` 结构与字段不变。

## Impact

- **代码**:`examples/api/src-tauri/gen/ohos/entry_{mobile,desktop}/src/main/module.json5`(改 2);`examples/api/src-tauri/capabilities/huawei-account.json`(新建);`plugins-workspace/plugins/huawei-account/src/error.rs`(改 + UT);`examples/api/package.json` + 前端 `src/lib/tests/plugins.ts`(改);插件 `dist-js` 构建。
- **API**:不改变插件公共 API(仅 error.rs 补 Cancelled 分类);AccountInfo 不变。
- **依赖**:examples/api 前端新增 `@tauri-apps/plugin-huawei-account`(file: 依赖,本地 dist-js)。
- **平台隔离**:module.json5 client_id 仅 OHOS entry 生效;capabilities 全平台(ohos+desktop);error.rs 改动跨平台一致。
- **配置**:client_id 是 AppGallery Connect 应用凭据,需用户填入真实值;gen/ohos 为生成产物,re-init 可能覆盖(见 design 风险)。
- **关联**:依赖 p1(bridge)+ p2(插件,已归档)完成;本 Phase 设备实测将复核 p1 的 `canIUse('.OAuth')`/`AuthenticationController` 无参构造,并验证 p1 `account.ets` 在真实登录路径的运行时行为。
