## Purpose

为 openharmony-ability 提供华为账号一键登录的桥接能力:封装 HarmonyOS Account Kit 的统一认证服务,对上暴露静默登录、交互式登录、退出登录三个异步操作,并返回结构化账号信息,供 Tauri 插件层调用。

## ADDED Requirements

### Requirement: 交互式登录

系统 SHALL 提供 `login` 异步操作,拉起华为账号登录界面由用户确认授权,成功后返回 `AccountInfo`。

#### Scenario: 用户确认授权
- **WHEN** 调用 `login` 且设备已登录华为账号、用户在弹出的登录界面确认授权
- **THEN** 操作成功完成并返回包含 `authorizationCode`、`openId`、`unionId` 的 `AccountInfo`(`uid`/`displayName`/`avatarUri` 为空字符串,`accessToken` 为 null,见 design D9)

#### Scenario: 用户取消授权
- **WHEN** 调用 `login` 且用户在登录界面取消
- **THEN** 操作以"取消"错误失败,且不返回任何账号信息

### Requirement: 静默登录

系统 SHALL 提供 `silent_login` 异步操作,在用户已授权且设备已登录华为账号时不弹界面自动完成登录,返回 `AccountInfo`。

#### Scenario: 已授权且已登录
- **WHEN** 调用 `silent_login` 且设备已登录华为账号、应用此前已获授权
- **THEN** 操作不弹出任何界面并返回 `AccountInfo`

#### Scenario: 未登录或未授权
- **WHEN** 调用 `silent_login` 且设备未登录华为账号或应用未获授权
- **THEN** 操作以"未登录"错误失败(对应 Account Kit 错误码 `1001502001`),由调用方决定是否降级为交互式登录

### Requirement: 退出登录

系统 SHALL 提供 `logout` 异步操作,清除当前应用在该设备上的华为账号登录/授权状态(对应 Account Kit 的"取消授权"语义)。

#### Scenario: 退出成功
- **WHEN** 调用 `logout` 且退出流程成功完成
- **THEN** 操作成功完成,后续 `silent_login` 将不再返回已登录状态

#### Scenario: 退出失败
- **WHEN** 调用 `logout` 且底层退出流程抛出错误
- **THEN** 操作以透传的错误失败

### Requirement: 账号信息结构

`AccountInfo` SHALL 至少包含以下字段:`uid`、`openId`、`unionId`、`displayName`、`avatarUri`、`authorizationCode`,并 MAY 包含 `accessToken`。所有字段 SHALL 可被序列化为驼峰命名的 JSON,供跨语言传递。

> 注(design D9,选项 A):`createLoginWithHuaweiIDRequest` 登录流仅返回 `openId`/`unionId`/`authorizationCode`;`uid`/`displayName`/`avatarUri` 在登录返回的 `AccountInfo` 中为空字符串,`accessToken` 为 null。资料字段(昵称/头像)需业务层另行经 `createAuthorizationWithHuaweiIDRequest`+`scopes=['profile']` 授权流获取,不在本桥接层处理。

#### Scenario: 字段完整返回
- **WHEN** 登录成功且 Account Kit 返回登录凭证
- **THEN** `AccountInfo` 包含非空的 `authorizationCode`、`openId`、`unionId`;`uid`、`displayName`、`avatarUri` 为空字符串(登录流不返回这些字段),`accessToken` 为 null

#### Scenario: 可选字段缺失
- **WHEN** Account Kit 未返回 `accessToken`
- **THEN** `AccountInfo` 的 `accessToken` 字段为空而不引发错误

### Requirement: 能力可用性检测

> **MODIFIED (p3 D6, 2026-08-03,device-verified)**: 原 requirement 要求 `canIUse('SystemCapability.Account.OAuth')` 预检测。设备实测 `canIUse` 在 HarmonyOS PC 返回 `false` 尽管 Account Kit 实际可用 → 预检阻断所有登录。p3 D6 决定移除 `canIUse` 预检,改为直接调 Account Kit,由 Account Kit 自身在不支持时抛 `BusinessError` 透传(`1001500001` → `unsupported`),不崩溃。下方 requirement 已反映实际方案。

系统 SHALL 直接调用 Account Kit 接口(`HuaweiIDProvider`/`AuthenticationController`),**不做 `canIUse` 预检测**;若设备不具备 Account Kit 能力,Account Kit 自身 SHALL 抛 `BusinessError`(code `1001500001`),经 ArkTS `normalizeError` 透传为 `"<code>:<message>"` Error,Rust 侧 `from_napi_reason` 映射为 `Error::Unsupported`,不崩溃。

#### Scenario: 设备不支持 Account Kit
- **WHEN** 设备不具备 Account Kit 能力时调用 `login`/`silent_login`/`logout`
- **THEN** Account Kit 抛 `BusinessError`(`1001500001`),透传为 `unsupported` 错误,不崩溃

#### Scenario: 设备支持 Account Kit
- **WHEN** 设备具备 Account Kit 能力时调用登录操作
- **THEN** 系统正常进入 Account Kit 调用流程(无 `canIUse` 预检阻断)

### Requirement: 平台与设备形态支持

本能力 SHALL 在 OHOS mobile(手机/平板)与 OHOS desktop(2in1 PC)设备形态上均可工作;在非 OHOS 平台上 SHALL 不编译此模块(`account` feature 默认关闭,且仅于 `cfg(target_env = "ohos")` 下编译)。

#### Scenario: PC/2in1 设备登录
- **WHEN** 在 2in1 PC(HarmonyOS 5.0.0+)上调用 `silent_login` 或 `login`
- **THEN** 行为与手机/平板一致,返回 `AccountInfo` 或相应错误

#### Scenario: 非 OHOS 平台隔离
- **WHEN** 在 Windows/macOS/Linux 上构建 openharmony-ability
- **THEN** `account` 模块不参与编译,不影响其他平台构建产物

### Requirement: 错误透传

系统 SHALL 将 Account Kit 抛出的业务错误(含错误码与消息)透传给调用方,映射为统一的错误类型,至少区分:不支持、取消、未登录、其他业务错误。

#### Scenario: 业务错误透传
- **WHEN** Account Kit 抛出非取消、非未登录的业务错误
- **THEN** 调用方收到包含原始错误码与消息的错误
