## Purpose

为 Tauri 应用提供华为账号一键登录的前端可调用能力:把 openharmony-ability 的 `HuaweiAccount` 底层桥接封装为 `tauri-plugin-huawei-account` 的三个 invoke 命令(`login`/`silent_login`/`logout`),OHOS 上返回 `AccountInfo`,非 OHOS 平台返回 `unsupported`,错误按 code 分类透传。

## ADDED Requirements

### Requirement: 交互式登录命令

系统 SHALL 提供 `login` invoke 命令,在 OHOS 上拉起华为账号交互式登录界面,成功后返回 `AccountInfo`;在非 OHOS 平台 SHALL 返回 `unsupported` 错误而不触发任何账号能力调用。

#### Scenario: OHOS 登录成功
- **WHEN** 在 OHOS 设备上调用 `login` 且用户确认授权
- **THEN** 命令成功返回 `AccountInfo`,其中 `openId`/`unionId`/`authorizationCode` 非空(资料字段 `uid`/`displayName`/`avatarUri` 为空字符串、`accessToken` 为 null,见 p1 design D9 选项 A)

#### Scenario: 非 OHOS 平台
- **WHEN** 在 Windows/macOS/Linux 上调用 `login`
- **THEN** 命令以 `unsupported` 错误失败,不调用任何 openharmony-ability 或 Account Kit 接口

### Requirement: 静默登录命令

系统 SHALL 提供 `silent_login` invoke 命令,在 OHOS 上已授权且设备已登录时静默返回 `AccountInfo`;未登录/未授权时以"未登录"错误失败,供调用方降级为交互式登录;非 OHOS 平台返回 `unsupported`。

#### Scenario: OHOS 静默登录成功
- **WHEN** 在 OHOS 设备上调用 `silent_login` 且已授权已登录
- **THEN** 命令不弹界面并返回 `AccountInfo`(`openId`/`unionId`/`authorizationCode` 非空)

#### Scenario: OHOS 未登录降级
- **WHEN** 在 OHOS 设备上调用 `silent_login` 且未登录或未授权
- **THEN** 命令以 `not-logged-in` 错误失败(对应 Account Kit 错误码 `1001502001`),由前端决定是否降级为 `login`

### Requirement: 退出登录命令

系统 SHALL 提供 `logout` invoke 命令,在 OHOS 上清除应用在该设备的华为账号授权状态;非 OHOS 平台返回 `unsupported`。

#### Scenario: OHOS 退出成功
- **WHEN** 在 OHOS 设备上调用 `logout` 且退出流程成功
- **THEN** 命令成功完成(无返回值)

#### Scenario: 非 OHOS 平台
- **WHEN** 在非 OHOS 平台调用 `logout`
- **THEN** 命令以 `unsupported` 错误失败

### Requirement: 错误分类透传

系统 SHALL 把底层透传的 `"<code>:<message>"` 错误按 code 映射为前端可识别的分类错误,至少区分:`unsupported`(不支持,code `1001500001`)、`not-logged-in`(未登录,code `1001502001`)、`cancelled`(用户取消)、`other`(其他业务错误,保留原始 code 与 message)。

#### Scenario: 未登录错误分类
- **WHEN** 底层返回 code `1001502001`
- **THEN** 前端收到 `not-logged-in` 分类错误

#### Scenario: 其他业务错误透传
- **WHEN** 底层返回非已知分类的 code
- **THEN** 前端收到 `other` 错误,且错误信息保留原始 code 与 message

### Requirement: 账号信息结构(插件层)

插件返回的 `AccountInfo` SHALL 与 openharmony-ability 层结构一致(驼峰 JSON):`uid`/`openId`/`unionId`/`displayName`/`avatarUri`/`authorizationCode` 为字符串、`accessToken` 为字符串或 null。SHALL 在 OHOS 上从 openharmony-ability 的 `AccountInfo` 转换得到。

#### Scenario: 字段映射一致
- **WHEN** OHOS 登录成功
- **THEN** 插件 `AccountInfo` 各字段值与 openharmony-ability 返回一致(登录流资料字段为空,选项 A)

### Requirement: 平台隔离

插件 SHALL 在非 OHOS 平台不引入对 openharmony-ability 的编译依赖;OHOS 真实实现经 `cfg(target_env = "ohos")` 隔离,desktop stub 经 `cfg(not(target_env = "ohos"))` 隔离,不污染 Windows/macOS/Linux 既有构建。

#### Scenario: 非 OHOS 构建隔离
- **WHEN** 在 Windows/macOS/Linux 构建含本插件的 Tauri 应用
- **THEN** openharmony-ability 不参与编译,三个命令返回 `unsupported`,构建产物不受影响

### Requirement: 权限控制

插件 SHALL 提供 `huawei-account` 权限集,含 `allow-login`/`allow-silent-login`/`allow-logout` 三条命令权限与 `default` 默认集合;前端 invoke 命令前 SHALL 经 capabilities 授权。

#### Scenario: 默认权限集
- **WHEN** 应用启用 `huawei-account:default` 权限
- **THEN** `login`/`silent_login`/`logout` 三个命令均被允许
