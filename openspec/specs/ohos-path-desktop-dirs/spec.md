# ohos-path-desktop-dirs Specification

## Purpose
定义 Tauri `PathResolver` 在 OHOS 平台对"桌面专用目录"（desktop / font / runtime / template / executable）的契约。这些目录在桌面 OS（Windows/macOS/Linux）由 `dirs` crate 提供，但在 OHOS 沙箱应用模型下无对应概念。本规范明确 OHOS 平台 SHALL 通过 cfg 隔离移除这些 API，调用方 SHALL 在 OHOS 上不引用这些方法，补齐 R190（其他路径）的跨平台契约。

## 现状审计
- `crates/tauri/src/path/mod.rs` 中 `desktop_dir` / `font_dir` / `runtime_dir` / `template_dir` / `executable_dir` 方法及其在 `resolve()` 中的 `BaseDirectory::Desktop/Font/Runtime/Template/Executable` 分支均带 `#[cfg(all(not(target_os = "android"), not(target_env = "ohos")))]`。
- `crates/tauri/src/path/ohos.rs` 未定义上述方法；OHOS `PathResolver` 仅提供 audio/cache/config/data/local_data/document/download/picture/public/video/resource/app_*/temp/home 等沙箱目录。
- 因此 OHOS 平台编译产物中这些"桌面目录"API 不存在，调用方代码若引用会在 OHOS target 编译失败（契约强制隔离）。

## ADDED Requirements

### Requirement: OHOS PathResolver SHALL 不提供桌面专用目录
OHOS `PathResolver` SHALL 不实现 `desktop_dir` / `font_dir` / `runtime_dir` / `template_dir` / `executable_dir` 方法；这些方法 SHALL 通过 `cfg(all(not(target_os = "android"), not(target_env = "ohos"))))` 从 OHOS 编译产物中排除。

#### Scenario: OHOS 编译不含桌面目录方法
- **WHEN** 使用 OHOS target 编译 `tauri` crate
- **THEN** `PathResolver` 结构体 SHALL 不含 `desktop_dir` / `font_dir` / `runtime_dir` / `template_dir` / `executable_dir` 方法
- **AND** 引用这些方法的下游代码在 OHOS target 编译失败（编译期契约）

#### Scenario: 桌面平台方法不变
- **WHEN** 在 Windows/macOS/Linux 编译
- **THEN** 这些方法 SHALL 通过 `dirs` crate 返回对应系统目录
- **AND** 行为与 OHOS 适配前完全一致

### Requirement: BaseDirectory 枚举在 OHOS SHALL 排除桌面目录变体
`path::BaseDirectory::Desktop` / `Font` / `Runtime` / `Template` / `Executable` 在 OHOS target SHALL 被排除，或在 `resolve()` 匹配分支被 cfg 隔离，使得 OHOS 上 `resolve(path, BaseDirectory::Desktop)` 不编译。

#### Scenario: resolve() 桌面分支在 OHOS 不存在
- **WHEN** 在 OHOS target 调用 `resolver.resolve(p, BaseDirectory::Desktop)`
- **THEN** 该 match 分支 `#[cfg(all(not(target_os = "android"), not(target_env = "ohos")))]` 被排除
- **AND** 编译期即阻止误用

### Requirement: OHOS 文档 SHALL 指明替代目录
OHOS 平台文档 SHALL 指明：需要"桌面/字体/运行时/模板"语义的应用应映射到 OHOS 已有目录：
- 桌面 → 无对应（OHOS 无桌面概念）；可降级为 `home_dir()` 或返回 `Error::UnknownPath`
- 字体 → 应用自有字体应放在 `resource_dir()` 下；系统字体无第三方 API
- 运行时 → OHOS 无 POSIX runtime dir 概念；可降级为 `temp_dir()`
- 模板 → OHOS 无模板目录概念；可降级为 `document_dir()`
- 可执行 → OHOS 不暴露应用二进制路径；使用 `resource_dir()` 或 `app_data_dir()`

#### Scenario: 应用查询字体目录
- **WHEN** 应用在 OHOS 需要加载自有字体
- **THEN** 应用 SHALL 使用 `resource_dir()` 拼接字体资源路径
- **AND** 不调用 `font_dir()`（该方法在 OHOS 不存在）

## 平台限制说明
- OHOS 应用沙箱模型不暴露桌面/字体系统目录/运行时目录/模板目录/可执行文件路径。
- 这些限制对 `OHOS_DEVICE_TYPE=desktop` 同样成立：即便设备形态为 desktop，应用沙箱仍不提供这些目录（OHOS desktop 形态仅影响窗口/托盘/菜单 cfg，不改变文件沙箱）。
- 若未来 OHOS 开放对应系统目录 API，本规范应升级为实现映射。
