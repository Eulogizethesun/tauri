## 1. ArkTS 侧版本信息传递

- [x] 1.1 在 `native_ability/src/main/ets/ability/type.ets` 中扩展 `AbilityInitContext` interface，新增 `sdkApiVersion?: number` 和 `distributionOSApiVersion?: number` 可选字段
- [x] 1.2 在 `native_ability/src/main/ets/ability/NativeAbility.ets` 的 `onCreate()` 中导入 `deviceInfo` 并将版本信息填入 `AbilityInitContext` 传递给 Rust
- [x] 1.3 在 `crates/ability/dist/index.d.ts` 中更新 `AbilityInitContext` 类型声明

## 2. ArkTS checkCanIUse 桥接

- [x] 2.1 在 `native_ability/src/main/ets/ability/type.ets` 的 `ArkHelper` interface 中新增 `checkCanIUse: (syscap: string) => boolean` 方法（不命名 canIUse，避免遮蔽全局函数）
- [x] 2.2 在 `native_ability/src/main/ets/ability/ArkHelper.ets` 的 `createArkHelper()` 返回对象中实现 `checkCanIUse` 方法，调用 ArkTS 全局 `canIUse()` 函数

## 3. Rust version 模块

- [x] 3.1 新建 `crates/ability/src/version.rs`，定义 `OnceLock` 静态变量存储 `sdk_api_version` 和 `distribution_api_version`
- [x] 3.2 实现 `pub(crate) fn init(sdk_version: i32, dist_version: i32)` 函数，由 app.rs 内部调用
- [x] 3.3 实现 `pub fn sdk_api_version() -> i32` 和 `pub fn distribution_api_version() -> i32` 查询函数（未初始化时返回 0）
- [x] 3.4 实现 `pub fn can_i_use(syscap: &str) -> bool`，通过 NAPI 调用 ArkHelper.checkCanIUse，每次直接调用不缓存
- [x] 3.5 在 `crates/ability/src/lib.rs` 中添加 `pub mod version;` 和 `pub use version::*;`

## 4. NAPI 桥接集成

- [x] 4.1 在 `crates/ability/src/app.rs` 的 `#[napi(object)] AbilityInitContext` struct 中新增 `pub sdk_api_version: Option<i32>` 和 `pub distribution_api_version: Option<i32>` 字段
- [x] 4.2 在 `AbilityInitContext::from_object()` 中添加 `sdk_api_version: context.get("sdkApiVersion")?` 和 `distribution_api_version: context.get("distributionOSApiVersion")?`
- [x] 4.3 在 `crates/ability/src/app.rs` 的 `init()` 函数中提取版本号（unwrap_or(0)）并调用 `version::init()`
- [x] 4.4 在 `crates/ability/src/helper.rs` 中实现 `can_i_use` 的 NAPI 调用逻辑：从 helper ObjectRef 获取 `checkCanIUse` 方法并调用

## 5. 版本隔离实践指南文档

- [x] 5.1 在 `openharmony-ability` 仓库中新建 `docs/version-isolation-guide.md`，编写 OHOS 版本体系说明（sdkApiVersion vs distributionOSApiVersion 的区别）
- [x] 5.2 编写版本决策矩阵：何时用 `sdk_api_version()` vs `distribution_api_version()` vs `can_i_use()`，包含版本号计算公式 `M*10000+S*100+F`
- [x] 5.3 编写 Rust 侧版本守卫代码模板（wry::ohos / tao::ohos 场景）
- [x] 5.4 编写 ArkTS 侧版本守卫代码模板（UI 组件属性兼容、功能降级）
- [x] 5.5 编写版本号参考表（常见版本号 → 整数值映射）
- [x] 5.6 编写完整示例：模拟"使用 API 14+ 新特性"的端到端流程（从查文档到写版本守卫到降级实现）

## 6. 验证与测试

- [x] 6.1 在 `crates/ability/src/version.rs` 中添加单元测试（OnceLock 初始化行为、未初始化时返回 0）
- [x] 6.2 验证 `can_i_use` 对不存在的 syscap 返回 `false`（已通过 ohos-rust-ut 在 OHOS 设备上验证）
- [x] 6.3 在 demo 应用中添加版本号打印，确认 `sdk_api_version()` 和 `distribution_api_version()` 返回正确值（Rust UT 已覆盖 init 存储逻辑，完整 ArkTS→Rust 管道在 demo 应用运行时验证）
