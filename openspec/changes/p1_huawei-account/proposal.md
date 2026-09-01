## Why

Tauri OHOS 应用需要华为账号一键登录能力(silentLogin 静默登录 + 交互式 login + logout),供客户端识别用户与服务端校验。按 CLAUDE.md 铁律 1,所有鸿蒙系统能力调用必须收口在 `openharmony-ability` 唯一 ArkTS 桥接仓内,因此本 Phase 在 openharmony-ability 仓内新增 `account` 能力模块,封装 `@kit.AccountKit` 的 `authentication` 服务,对上暴露 Rust 异步公共 API,供后续 Phase 的 `tauri-plugin-huawei-account` 薄插件直接调用。

## What Changes

- 新增 openharmony-ability `account` 能力模块(Rust + ArkTS),参考 autostart/updater 样板:
  - Rust 侧 `helper/account.rs`(TSFN 基础设施)+ `account.rs`(公共 API:`HuaweiAccount` 句柄、`AccountInfo` serde 结构、async `login`/`silent_login`/`logout`)。
  - ArkTS 侧 `helper/account.ets`(`import { authentication } from '@kit.AccountKit'`,真实实现 `HuaweiIDProvider`/`AuthenticationController` 流程)。
  - `ArkHelper.ets` 新增 `accountLogin`/`accountSilentLogin`/`accountLogout` 转发方法;`type.ets` 新增接口与 `AccountInfo`;`helper/index.ets` 导出。
  - `lib.rs`/`helper/mod.rs`/`render/xcomponent.rs` 注册模块与 TSFN 初始化;`Cargo.toml` 新增 `account` feature。
  - `native_ability/` 与 `package/` 双镜像同步;重建 `ability.har`。
- Account Kit API 已由 arkts-helper 核实:API since 12(满足 demo 默认 API 12,无需版本守卫);PC/2in1 完全可用;仅需 `canIUse('SystemCapability.Account.OAuth')` 运行时检测;未登录错误码 `1001502001` 由调用方降级为交互式登录。
- 本 Phase 仅做底层桥接,**不**含插件、不含 examples/api 集成(后续 Phase)。

## Capabilities

### New Capabilities
- `huawei-account`: openharmony-ability 对华为账号一键登录的桥接能力——暴露 `login`(交互式)/`silent_login`(静默)/`logout` 三个异步 Rust 公共 API,返回 `AccountInfo`(uid/openId/unionId/displayName/avatarUri/authorizationCode/accessToken),ArkTS 侧封装 `@kit.AccountKit` 的 `authentication` 服务并做能力检测与错误透传。

### Modified Capabilities
<!-- 无既有 spec 的需求变更 -->

## Impact

- **代码**:`D:\ohdev\openharmony-ability` 仓 Rust 侧(`crates/ability/src/`)与 ArkTS 侧(`native_ability/`+`package/` 双镜像)新增/修改 ~13 文件;重建 `ability.har`。
- **API**:openharmony-ability 新增 `account` feature 与 `account::*` 公共 API;不改变现有任何 API。
- **依赖**:ArkTS 侧新增对 `@kit.AccountKit` 的依赖(系统 Kit,无需 ohpm 包);Rust 侧无新 crate 依赖(复用 napi-ohos/serde/futures-channel)。
- **平台隔离**:全部新增代码在 `cfg(target_env = "ohos")` + `feature = "account"` 下,不影响 Windows/macOS/Linux;`account` feature 默认关闭,不影响现有 openharmony-ability 构建产物,直至 tauri 显式启用。
- **配置**:本 Phase 不涉及 `module.json5`(HAR 不自带能力声明);`client_id` + `ohos.permission.INTERNET` 由 Phase 3 在 app entry 声明。
