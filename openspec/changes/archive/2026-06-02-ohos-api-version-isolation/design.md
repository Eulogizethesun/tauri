## Context

### 当前状态

Tauri 在 OHOS 上的版本管理存在空白：
- `openharmony-ability` 没有任何运行时版本检测 API
### 约束
- `tao` 和 `tauri-runtime-wry` 仅依赖 `#[cfg(target_env = "ohos")]` 做编译期平台判断
- 对比其他平台：Windows 有 `windows_version::OsVersion` + `GetProcAddress` 级联降级；macOS 有 `NSAppKitVersionNumber` + `respondsToSelector`；Android 有 `Build.VERSION.SDK_INT`

### OHOS 版本体系

OHOS 采用**双版本系统**：
- `sdkApiVersion`：OpenHarmony 底座 API Level（整数，如 12, 14, 20），对应文档标注 `since N`
- `distributionOSApiVersion`：HarmonyOS 发行版 API 版本（格式 M×10000+S×100+F），对应文档标注 `since M.S.F(N)`
- `canIUse(syscap)`：ArkTS 全局函数，检测设备是否支持特定 SystemCapability（无对应 NDK C API）

### 约束

- `ohos-*-binding` crate 是外部维护的，不在 `openharmony-ability` 仓库内
- `openharmony-ability` 采用 NAPI-first 架构（Rust ↔ ArkTS 双向桥接），无直接 `extern "C"` FFI
- 版本检测是低频操作（启动时一次），NAPI 开销可忽略

## Goals / Non-Goals

**Goals:**
- 提供统一的 Rust API 查询 OHOS 版本号（sdk_api_version / distribution_api_version）
- 提供 `can_i_use(syscap)` 能力探测 API
- 版本号信息在应用启动时一次性传递并缓存，后续查询零开销
- 输出实践指南文档，指导后续开发者在 Tauri 生态中使用高版本 API

**Non-Goals:**
- 不为每个 OHOS API 版本编写版本守卫代码（由后续开发者按需添加）
- 不新建 `ohos-deviceinfo-binding` crate（避免增加外部 crate 维护成本）
- 不修改 `build-profile.json5`（那是应用层配置，非框架职责）
- 不实现编译期条件编译（ArkTS 无 `#ifdef`，且同一 HAP 包需兼容多版本设备）

## Decisions

### 决策 1：版本号传递方式 — NAPI init() 参数扩展（而非 NDK C FFI）

**选择**：通过扩展现有的 `AbilityInitContext` NAPI 对象，在 ArkTS 侧读取 `deviceInfo` 后传递给 Rust。

**理由**：
- `openharmony-ability` 是 NAPI-first 架构，所有 Rust↔ArkTS 通信都走 NAPI
- `ohos-*-binding` crate 是外部维护的，新建 `ohos-deviceinfo-binding` 需要额外发布和维护
- 版本号只在启动时读取一次，NAPI 开销可忽略（<1ms）
- 与现有模式一致：`AbilityInitContext` 已包含 `base_path`, `pref_path`, `module_name` 等启动信息

**替代方案**：
- 新建 `ohos-deviceinfo-binding` crate + `extern "C" { fn OH_GetSdkApiVersion() }` — 性能略好，但增加外部 crate 维护负担
- 在 `openharmony-ability` 内部直接加 `extern "C"` — 打破现有模式（其他系统调用都走 `ohos-*-binding`）

### 决策 2：canIUse 实现方式 — NAPI 直接调用（不缓存）

**选择**：`can_i_use(syscap)` 每次从 Rust 通过 NAPI 调用 ArkTS 全局 `canIUse()` 函数，**不做缓存**。

**理由**：
- `canIUse` 是 ArkTS 全局函数，没有对应的 NDK C API
- NAPI 同步调用开销极小（微秒级），和现有 `getUrl()`、`restart()` 等调用模式一致
- canIUse 调用频率低（通常在初始化/feature gate 时），缓存带来的收益远不值得增加 `RwLock<HashMap>` 的复杂度
- 不缓存更简单、更可靠——不存在缓存一致性问题

**数据流**：
```
Rust: can_i_use("SystemCapability.xxx")
  → NAPI: ArkHelper.checkCanIUse("SystemCapability.xxx")
    → ArkTS: canIUse("SystemCapability.xxx") → boolean
  ← 直接返回（无缓存）
```

### 决策 3：Rust API 设计 — 模块级函数 + OnceLock 缓存

**选择**：新增 `crates/ability/src/version.rs` 模块，提供模块级函数，版本号存储在 `OnceLock` 中。

**API 设计**：
```rust
// openharmony-ability::version

/// OpenHarmony 底座 API Level（since N），未初始化时返回 0
pub fn sdk_api_version() -> i32;

/// HarmonyOS 发行版 API 版本（M×10000+S×100+F），未初始化时返回 0
pub fn distribution_api_version() -> i32;

/// 查询设备是否支持特定系统能力（通过 NAPI 调用 ArkHelper.checkCanIUse）
pub fn can_i_use(syscap: &str) -> bool;

// 内部使用
pub(crate) fn init(sdk_version: i32, dist_version: i32);
```

**不提供便捷比较函数**（如 `sdk_at_least()` / `dist_at_least()`）。理由：
- Windows/macOS 均不封装便捷函数，消费者直接做整数比较：
  - Windows: `WIN_VERSION.build >= 17763`（直接字段访问）
  - macOS wry: `os_major_version >= 12`（解构元组后比较）
  - macOS tao: `NSAppKitVersionNumber > NSAppKitVersionNumber10_12`
- OHOS 也应保持一致，消费者直接写 `sdk_api_version() >= 14` 或 `distribution_api_version() >= 60000`
- 版本号转换公式 `M*10000 + S*100 + F` 在实践指南文档中说明即可，不需要在 API 层隐藏

**理由（OnceLock）**：
- `OnceLock` 保证版本号只初始化一次，后续查询零开销（直接读内存）
- 模块级函数比全局 struct 更简洁，调用方不需要持有引用
- `init()` 由 `app.rs` 的 `init()` 函数内部调用，对消费者透明
- 与 Windows `Lazy<OsVersion>` 模式类似（均为一次性初始化 + 全局缓存），但因 OHOS 无直接 C API（需走 NAPI），无法用 `Lazy` 自动初始化，必须显式 init

### 决策 4：ArkTS 侧扩展 — AbilityInitContext + ArkHelper.checkCanIUse

**选择**：
1. 扩展 `AbilityInitContext` NAPI 对象，新增**可选**字段 `sdkApiVersion?: number` 和 `distributionOSApiVersion?: number`
2. 在 `ArkHelper` 接口中新增 `checkCanIUse(syscap: string): boolean` method（**不**命名为 `canIUse`）

**关于命名**：`checkCanIUse` 而非 `canIUse`。原因：`canIUse` 是 ArkTS 全局函数，如果在 ArkHelper 对象/接口中定义同名方法，方法体内调用 `canIUse()` 可能因作用域遮蔽而指向自身，导致无限递归。现有代码中已有类似模式：`import { check as updaterCheckFn }` 用别名避免冲突。`checkCanIUse` 既保持了与 `canIUse` 的语义关联，又避免了命名冲突。

**关于 Option 字段**：`AbilityInitContext` 现有字段全部为 `Option<T>`（`base_path: Option<String>` 等），新增字段也应保持 `Option<i32>`，确保旧版 ArkTS 不传版本号时 Rust 侧收到 `None`，`sdk_api_version()` 返回 `0`。

**ArkTS 代码**：
```typescript
// NativeAbility.ets — onCreate() 中
import { deviceInfo } from '@kit.BasicServicesKit';

const context: AbilityInitContext = {
  basePath: ...,
  prefPath: ...,
  moduleName: ...,
  sdkApiVersion: deviceInfo.sdkApiVersion,           // 新增
  distributionOSApiVersion: deviceInfo.distributionOSApiVersion, // 新增
};
nativeModule.init(context);

// ArkHelper.ets — 新增（注意方法名是 checkCanIUse，不是 canIUse）
checkCanIUse: (syscap: string): boolean => {
  return canIUse(syscap);  // 调用全局 canIUse，不会遮蔽
}
```

## Risks / Trade-offs

**[风险] canIUse 调用失败** → 缓解：NAPI 调用失败时返回 `false`（保守策略），并 log warning
**[风险] ArkTS 侧未正确传递版本号** → 缓解：`init()` 时对版本号做基本校验（>0），否则 panic with clear error message
**[权衡] NAPI 开销 vs 外部 crate 维护** → 选择 NAPI，因为版本号是低频查询，而外部 crate 维护是长期成本
**[风险] 文档过时** → 缓解：文档中明确标注"基于 API 20 (6.0.0) 编写"，后续版本变更需更新文档
