## 1. Rust TSFN 基础设施

- [x] 1.1 新建 `crates/ability/src/helper/account.rs`,仿 `helper/updater.rs` 创建 `create_account_login_tsfn`/`create_account_silent_login_tsfn`/`create_account_logout_tsfn`(closure 内 `get_helper().get_named_property("accountLogin"/"accountSilentLogin"/"accountLogout").call(())`,`callee_handled::<false>()`,`LazyLock<RwLock<Option<Arc<Tsfn>>>>` 存储)
- [x] 1.2 实现 `get_account_login_tsfn`/`get_account_silent_login_tsfn`/`get_account_logout_tsfn` 访问器
- [x] 1.3 在 `crates/ability/src/helper/mod.rs` 加 `#[cfg(feature = "account")] mod account; pub use account::*;`

## 2. Rust 公共 API 与数据模型

- [x] 2.1 新建 `crates/ability/src/account.rs`,定义 `AccountInfo`(`#[serde(rename_all="camelCase")]`,字段 uid/open_id/union_id/display_name/avatar_uri/authorization_code/access_token)
- [x] 2.2 实现 `pub struct HuaweiAccount;` + `new()`,async `login`/`silent_login`/logout`(oneshot + `call_with_return_value` + NonBlocking,参考 `updater.rs::check`)
- [x] 2.3 实现 `handle_account_promise`(`.then` 调 `parse_account_info` / `.catch` 透传 `code:message`)与 `parse_account_info`(逐字段 `get_named_property`,缺失降级空)
- [x] 2.4 实现 `send_once` 复用(或引用 updater 的)与 TSFN 未初始化错误分支
- [x] 2.5 加 `#[cfg(test)]` serde roundtrip / 可选字段缺失 / parse 纯函数 UT
  - **注**:实现为 serde roundtrip + 可选字段缺失 + default 三类 UT,与 updater 样板一致。`parse_account_info` 入参为 napi `Object<'static>`,需 NAPI Env fixture,无法作纯函数 UT(updater 的 `parse_check_result` 同样未测);逻辑简单且镜像样板,留待设备端集成测试覆盖。

## 3. Rust 模块注册与 feature

- [x] 3.1 `crates/ability/src/lib.rs` 加 `#[cfg(feature = "account")] mod account;` 与 `pub use account::*;`
- [x] 3.2 `crates/ability/src/render/xcomponent.rs::render()` 内加 `#[cfg(feature = "account")] { create_account_*_tsfn(env)?; }` 初始化块(置于 `set_main_thread_env` 之后)
- [x] 3.3 `crates/ability/Cargo.toml` `[features]` 加 `account = []`(默认关闭)

## 4. ArkTS 实现(双镜像)

- [x] 4.1 新建 `native_ability/src/main/ets/helper/account.ets`:导入 Account Kit 认证模块(`@kit.AccountKit`→`authentication` 优先,回退 `@hms.core.authentication`)+ `util.generateRandomUUID`;`login(forceLogin=true)`/`silentLogin()`(均经 `createLoginWithHuaweiIDRequest`)/`logout()`(经 `createCancelAuthorizationRequest()` + `executeRequest`,即取消授权);入口能力检测(`canIUse('SystemCapability.Account.OAuth')`,无效则 try/catch 降级,不支持则 `throw { code:'UNSUPPORTED' }`);**ArkTS 侧构造规范字段名 `AccountInfo` 对象**(从 `LoginWithHuaweiIDCredential` 映射,字段大小写以 DevEco 补全为准);`BusinessError` 透传
  - **实现注**:导入路径已确认用 `@kit.AccountKit`(无回退);canIUse 已确认用 `.OAuth`;错误统一归一为 `"<code>:<message>"` 字符串透传(design D5);`openID`/`unionID` 大小写已确认并加 lowercase fallback(design D4)。
- [x] 4.2 `package/src/main/ets/helper/account.ets` 同步镜像
- [x] 4.3 `native_ability` 与 `package` 的 `helper/index.ets` 加 `export * from "./account";`

## 5. ArkHelper 转发与接口(双镜像)

- [x] 5.1 `native_ability/src/main/ets/ability/ArkHelper.ets` 在 `createArkHelper()` 返回对象加 `accountLogin`/`accountSilentLogin`/`accountLogout` 转发(调 `account.ets` 对应函数,无需 context;用 `safeLogError` 模式)
- [x] 5.2 `package/.../ArkHelper.ets` 同步镜像
- [x] 5.3 `native_ability` 与 `package` 的 `ability/type.ets`:`ArkHelper` 接口加三方法签名 + `AccountInfo` interface

## 6. 构建与验证

- [x] 6.1 `cargo check -p openharmony-ability --features account --target aarch64-unknown-linux-ohos` 通过
- [x] 6.2 不带 `account` feature 的默认 `cargo check` 仍通过(未污染)
- [x] 6.3 设备端跑 `account.rs` 的 `#[cfg(test)]` UT(参考 ohos-rust-ut skill,`--test-threads=1`)
  - **注**:交叉编译 UT 二进制 → `hdc file send` → 设备端 `--test-threads=1` 运行,4 个用例(account_info_serde_roundtrip / _optional_access_token_null / _optional_access_token_missing_key / _default_empty)全部通过。
- [x] 6.4 `pack.bat` 重建 `ability.har`,确认含 `account.ets` 产物
