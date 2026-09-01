# ohos-dialog-error Specification

## Purpose
定义 `tauri-runtime-wry` 中底层 `dialog::error()` 函数在 OHOS 平台的行为契约。该函数在 Windows 上弹出原生错误对话框（用于 WebView2 运行时缺失等致命错误提示），但在非 Windows 平台当前为 `unimplemented!()`，会在误调用时导致进程 panic。本规范要求 OHOS 平台提供安全的降级实现（记录日志而非 panic），补齐 R184（错误对话框）的跨平台契约。

## 现状审计
- 调用点：`tauri-runtime-wry/src/lib.rs::create_webview` 中 `#[cfg(all(not(debug_assertions), windows))]` 分支调用 `dialog::error(...)` —— 该调用点本身仅 Windows 启用。
- OHOS 上 `context.webview_runtime_installed` 始终为 `true`（ArkUI Web 组件随系统提供），故 `dialog::error()` 在 OHOS 运行时实际不会被调用。
- 但 `dialog::error()` 函数体在 OHOS 编译时仍存在 `unimplemented!()` 分支，属于潜在 footgun：任何未来新增的调用点在 OHOS 上都会 panic。
- 用户级"错误对话框"语义已由 `ohos-dialog-plugin` 的 `showMessageDialog` + `MessageDialogKind::Error` 覆盖；本规范仅针对 runtime-wry 底层 `dialog::error()` 函数。

## ADDED Requirements

### Requirement: OHOS 平台 `dialog::error` SHALL 安全降级
`tauri-runtime-wry::dialog::error()` 在 OHOS target 编译时 SHALL 不展开为 `unimplemented!()`，SHALL 通过 `log::error!` 记录错误信息并安全返回，不触发 panic。

#### Scenario: OHOS 调用 error 不 panic
- **WHEN** 在 OHOS target 编译的 `tauri-runtime-wry` 中调用 `dialog::error("some fatal message")`
- **THEN** 函数 SHALL 通过 `log::error!` 输出消息（带 `[dialog::error]` 前缀）
- **AND** 函数 SHALL 正常返回，不 `panic!` / `unimplemented!`
- **AND** 进程继续运行（由调用方决定后续退出逻辑）

#### Scenario: 多行错误信息完整记录
- **WHEN** 调用 `dialog::error` 传入多行字符串（如 WebView2 缺失提示）
- **THEN** 日志 SHALL 完整记录全部行
- **AND** 不因换行符或长度截断而丢失信息

### Requirement: 实现 SHALL 通过 cfg 隔离不影响其他平台
OHOS 降级实现 SHALL 通过 `cfg(target_env = "ohos")` 隔离；Windows 原生错误对话框实现 SHALL 保持不变；其他非 Windows 非 OHOS 平台的 `unimplemented!()` 行为可保留或同步降级，但不由本规范强制。

#### Scenario: Windows 实现不变
- **WHEN** 在 Windows target 编译
- **THEN** `dialog::error()` SHALL 调用 `windows::error(_err)` 弹出原生 MessageBox
- **AND** OHOS 降级代码不参与编译

#### Scenario: OHOS 实现隔离
- **WHEN** 在 OHOS target 编译
- **THEN** `dialog::error()` 函数体 SHALL 进入 OHOS 降级分支（`log::error!`）
- **AND** 不引用 `windows` 模块，不依赖任何 Windows API

### Requirement: OHOS 降级 SHALL 不引入 ArkTS 桥接
`dialog::error()` 是 runtime-wry 启动早期的底层函数，此时 openharmony-ability 的 TSFN 可能尚未初始化，因此 OHOS 降级 SHALL 仅使用 `log` crate，SHALL NOT 调用 `promptAction` 或任何 ArkTS 桥接 API。

#### Scenario: 不依赖 TSFN
- **WHEN** 在 OHOS ability 初始化之前 `dialog::error()` 被调用
- **THEN** 函数 SHALL 仅依赖 `log` crate 输出
- **AND** 不调用 `openharmony-ability` 任何 API
- **AND** 不因 TSFN 未初始化而失败

## 设计要点
- 实现方式：在 `crates/tauri-runtime-wry/src/dialog/mod.rs` 增加 `#[cfg(target_env = "ohos")]` 分支，调用 `log::error!("[dialog::error] {}", _err.as_ref())`。
- 可选：同时将"其他非 Windows 非 OHOS"平台从 `unimplemented!()` 改为 `log::error!` 降级，但本规范不强制（避免影响 macOS/Linux 现有行为）。
- 不在 `ohos-dialog-plugin` 范围内重复实现——plugin 层的错误对话框语义已由 `MessageDialogKind::Error` 满足。
