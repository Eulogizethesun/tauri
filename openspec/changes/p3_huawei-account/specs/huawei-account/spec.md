## Purpose

设备集成层:使 p1/p2 的华为账号登录能力在 OHOS 设备端真实可用(经 `module.json5` client_id 声明 + capabilities 授权),补全错误分类(取消码),并提供前端测试入口;非 OHOS 平台返回 `unsupported`。

## MODIFIED Requirements

### Requirement: 错误分类透传

系统 SHALL 把底层透传的 `"<code>:<message>"` 错误按 code 映射为前端可识别的分类错误,至少区分:`unsupported`(code `1001500001`)、`not-logged-in`(code `1001502001`)、`cancelled`(用户取消,code `1001502012`)、`other`(其他业务错误,保留原始 code 与 message)。

> p2 D4 更新(2026-07-30,arkts-helper 确认):取消码为 `1001502012`(`ERROR_CODE_USER_CANCEL`),补入 `Cancelled` 分类。其余映射不变。

#### Scenario: 用户取消登录
- **WHEN** 用户在登录界面取消授权(底层返回 code `1001502012`)
- **THEN** 前端收到 `cancelled` 分类错误,且不返回任何账号信息

#### Scenario: 未登录错误分类
- **WHEN** 底层返回 code `1001502001`
- **THEN** 前端收到 `not-logged-in` 分类错误

#### Scenario: 其他业务错误透传
- **WHEN** 底层返回非已知分类的 code
- **THEN** 前端收到 `other` 错误,且错误信息保留原始 code 与 message

## ADDED Requirements

### Requirement: client_id 声明

OHOS 应用的 entry `module.json5` SHALL 在 `module.metadata` 声明 `{ "name": "client_id", "value": "<AppGallery Connect OAuth2 client_id>" }`,以供 Account Kit 校验应用身份;无该声明 SHALL 导致登录失败。`ohos.permission.INTERNET` SHALL 已在 `requestPermissions` 声明(Account Kit 网络请求)。

#### Scenario: client_id 已配置
- **WHEN** module.json5 声明了正确的 client_id 且设备已登录华为账号
- **THEN** Account Kit 登录可正常完成身份校验

#### Scenario: client_id 缺失或错误
- **WHEN** module.json5 未声明 client_id 或值与 AppGallery Connect 不匹配
- **THEN** 登录以业务错误失败

### Requirement: capabilities 授权

应用 SHALL 经 capabilities 授权 `huawei-account:default`(含 `allow-login`/`allow-silent-login`/`allow-logout`)给主窗口;未授权时前端 invoke 命令 SHALL 被 ACL 拒绝。

#### Scenario: 已授权
- **WHEN** 主窗口 capability 包含 `huawei-account:default`
- **THEN** `login`/`silent_login`/`logout` 命令可被前端 invoke

### Requirement: OHOS 设备真实登录

在已配置 client_id + 授权的 OHOS 设备上,`silent_login` SHALL 在已登录已授权时静默返回 `AccountInfo`(`openId`/`unionId`/`authorizationCode` 非空,`uid`/`displayName`/`avatarUri` 空字符串、`accessToken` null,选项 A);`login` SHALL 拉起交互界面并返回 `AccountInfo`;未登录时 `silent_login` 以 `not-logged-in` 失败,由前端降级为 `login`。

#### Scenario: 静默登录成功
- **WHEN** 设备已登录华为账号且应用已授权,调用 `silent_login`
- **THEN** 不弹界面并返回 `AccountInfo`(`openId`/`unionId`/`authorizationCode` 非空)

#### Scenario: 交互式登录成功
- **WHEN** 调用 `login` 且用户确认授权
- **THEN** 返回 `AccountInfo`,后续 `silent_login` 可静默成功

#### Scenario: 未登录降级
- **WHEN** 设备未登录,先 `silent_login` 失败(`not-logged-in`),再 `login`
- **THEN** `login` 拉起登录界面,用户登录后返回 `AccountInfo`

### Requirement: desktop 降级

在非 OHOS 平台,`login`/`silent_login`/`logout` SHALL 返回 `unsupported` 错误,不调用任何 Account Kit 接口,不崩溃。

#### Scenario: 非 OHOS 调用
- **WHEN** 在 Windows/macOS/Linux 调用任一命令
- **THEN** 返回 `unsupported`,应用不崩溃

### Requirement: 前端测试入口

examples/api SHALL 提供触发 `login`/`silent_login`/`logout` 的测试入口(经 plugins.ts manual/side-effect 用例 + TestRunner),用于设备端人工/半自动验证登录返回与错误降级。

#### Scenario: 测试入口可用
- **WHEN** 在 TestRunner 运行 huawei-account 测试用例
- **THEN** 能触发三命令并展示返回的 `AccountInfo` 或分类错误
