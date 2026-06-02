## Why

Tauri 在 OHOS 上**完全没有运行时 API 版本检测机制**。当前所有 OHOS 代码仅依赖编译期 `#[cfg(target_env = "ohos")]` 做平台判断，没有任何运行时版本探测。当应用部署到低版本设备时，调用高版本才有的 API 会导致崩溃。随着 HarmonyOS API 版本快速迭代（API 12→14→20），版本隔离已成为生产可用性的硬性要求。

## What Changes

- **新增 `ohos-version` 模块**：在 `openharmony-ability` 中提供统一的版本检测 API，包括：
  - `sdk_api_version()` — 获取 OpenHarmony 底座 API Level（对应文档 `since N`）
  - `distribution_api_version()` — 获取 HarmonyOS 发行版 API 版本（对应文档 `since M.S.F(N)`）
  - `can_i_use(syscap)` — 查询设备是否支持特定系统能力（SystemCapability）
- **新增版本隔离实践指南**：提供一份面向开发者的文档，指导后续在 Tauri/tao/wry 中使用高版本 API 时的标准做法（版本号判断 + canIUse + 降级模式）
- **ArkTS 侧初始化**：在 `NativeAbility.ets` 启动时将版本信息传递给 Rust 侧缓存

## Capabilities

### New Capabilities
- `ohos-version-api`: openharmony-ability 中的版本检测与能力探测 Rust API（sdk_api_version, distribution_api_version, can_i_use, 便捷判断函数）
- `ohos-version-guide`: 版本隔离实践指南文档，指导后续开发者在 Tauri 生态中使用高版本 OHOS API 的标准模式

### Modified Capabilities
<!-- 无需修改现有 spec -->

## Impact

- **openharmony-ability crate**：新增 `version` 模块，需要 ArkTS 侧（`NativeAbility.ets`）配合在启动时传递版本信息
- **NAPI 桥接**：canIUse 需要从 Rust 通过 NAPI 调用 ArkTS 全局函数，需在 `ArkHelper` 接口中新增 method
- **tao / wry / tauri**：作为消费者受益，无需立即修改（版本检测 API 为可选调用），但后续使用高版本 API 时需要参考指南添加版本守卫
- **依赖**：不需要新建 `ohos-deviceinfo-binding` crate，通过 NAPI 从 ArkTS 侧读取即可，避免增加外部 crate 维护成本
- **构建配置**：无变化，`compatibleSdkVersion` 等由应用层 `build-profile.json5` 控制
