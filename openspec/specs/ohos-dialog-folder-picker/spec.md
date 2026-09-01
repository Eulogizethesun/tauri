# ohos-dialog-folder-picker Specification

## Purpose
定义 `tauri-plugin-dialog` 在 OHOS 平台上对"文件夹选择"（`options.directory = true`）请求的契约。本规范**修订**早期"OHOS 无目录选择器"的结论——经 SDK `.d.ts` 核实（`@ohos.file.picker.d.ts`），`DocumentViewPicker` 配合 `DocumentSelectOptions.selectMode = DocumentSelectMode.FOLDER`（API 11+）支持目录选择，**仅限 2-in-1 / 桌面设备**。因此：
- **OHOS desktop**（`TAURI_OHOS_DEVICE_TYPE=desktop`）SHALL 用 `DocumentViewPicker.select({ selectMode: FOLDER })` 实现文件夹选择；
- **OHOS mobile** SHALL 以显式错误降级（2-in-1 only 平台限制）。

本规范补齐跨平台契约中 R181（文件夹选择对话框）的 OHOS 分支。

## ADDED Requirements

### Requirement: OHOS desktop 文件夹选择 SHALL 使用 DocumentViewPicker + FOLDER 模式
当 `dialog.open` 命令在 OHOS desktop（`cfg(all(target_env = "ohos", desktop))`）被调用且 `options.directory == true` 时，插件 SHALL 调用 `run_mobile_plugin("showFilePicker", ...)`（或等价命令）并在 ArkTS 侧以 `new picker.DocumentViewPicker()` 调用 `select({ selectMode: picker.DocumentSelectMode.FOLDER, maxSelectNumber })`，返回选中的目录 URI 列表。SHALL NOT 返回 `FolderPickerNotImplemented`。

#### Scenario: desktop 单选目录
- **WHEN** 前端在 OHOS desktop 调用 `dialog.open({ directory: true })`
- **THEN** 命令处理器进入 `#[cfg(all(target_env = "ohos", desktop))]` 分支
- **AND** 经 `run_mobile_plugin` 派发到 ArkTS，ArkTS 以 `DocumentSelectMode.FOLDER` + `maxSelectNumber: 1` 调用 `DocumentViewPicker.select()`
- **AND** 返回用户选中的目录 URI（单条）

#### Scenario: desktop 多选目录
- **WHEN** 前端在 OHOS desktop 调用 `dialog.open({ directory: true, multiple: true })`
- **THEN** ArkTS 以 `DocumentSelectMode.FOLDER` + `maxSelectNumber > 1`（或上限值）调用 `DocumentViewPicker.select()`
- **AND** 返回用户选中的目录 URI 列表

#### Scenario: desktop 文件夹选择返回目录 URI
- **WHEN** `DocumentViewPicker.select({ selectMode: FOLDER })` resolve
- **THEN** 返回的 URI 指向目录（file URI scheme），非文件
- **AND** 前端收到的路径为目录路径

### Requirement: OHOS mobile 文件夹选择 SHALL 返回明确错误
当 `dialog.open` 命令在 OHOS mobile（`cfg(all(target_env = "ohos", mobile))`）被调用且 `options.directory == true` 时，插件 SHALL 返回 `Error::FolderPickerNotImplemented`，不弹出任何选择器 UI。`DocumentSelectMode.FOLDER` 的"仅 2-in-1 设备支持"限制使 mobile 无法使用该能力。

#### Scenario: mobile 单选/多选目录
- **WHEN** 前端在 OHOS mobile 调用 `dialog.open({ directory: true [, multiple: true] })`
- **THEN** 命令处理器进入 `#[cfg(all(target_env = "ohos", mobile))]` 分支
- **AND** 返回 `Err(crate::Error::FolderPickerNotImplemented)`
- **AND** 不调用 `run_mobile_plugin("showFilePicker", ...)`、不创建 `DocumentViewPicker` 实例
- **AND** `multiple` 标志不影响降级结果

#### Scenario: 文件选择不受影响
- **WHEN** 前端调用 `dialog.open({ directory: false })` 在 OHOS（任意设备形态）
- **THEN** 插件 SHALL 正常调用 `showFilePicker` 走 `DocumentViewPicker.select()`（`selectMode` 默认 FILE）路径
- **AND** 文件选择功能不受文件夹选择分支的影响

### Requirement: cfg 隔离 SHALL 精确区分 OHOS desktop / mobile / 其它平台
文件夹选择的 OHOS 分支 SHALL 按 `TAURI_OHOS_DEVICE_TYPE` 精确拆分：
- `cfg(all(target_env = "ohos", desktop))` → FOLDER 选择实现；
- `cfg(all(target_env = "ohos", mobile))` → 返回 `FolderPickerNotImplemented`；
- `cfg(all(desktop, not(target_env = "ohos")))` → 保留原有 `blocking_pick_folder` / `blocking_pick_folders`（Windows/macOS/Linux）；
- `cfg(mobile)`（非 OHOS，如 Android/iOS）→ 保留原有降级。

当前代码 `commands.rs` 用 `cfg(any(mobile, target_env = "ohos"))` 统一返回错误，**需重构**为上述四分支。

#### Scenario: 桌面平台（非 OHOS）文件夹选择不变
- **WHEN** 在 Windows/macOS/Linux 调用 `dialog.open({ directory: true })`
- **THEN** 走 `#[cfg(all(desktop, not(target_env = "ohos")))]` 分支
- **AND** 调用 `dialog_builder.blocking_pick_folder()` 或 `blocking_pick_folders()`
- **AND** 返回选中的目录路径

### Requirement: 错误类型 SHALL 可被前端识别
`Error::FolderPickerNotImplemented` SHALL 通过 Tauri 命令错误链路序列化为可被前端识别的错误，错误信息 SHALL 明确指出当前设备形态不支持文件夹选择。

#### Scenario: 前端捕获错误（mobile）
- **WHEN** 前端在 OHOS mobile `await dialog.open({ directory: true })` 收到拒绝
- **THEN** 前端 SHALL 收到一个 error，其 message 包含 "folder picker" 或 "not implemented" 语义
- **AND** 前端可据此显示替代 UI（如手动输入路径或使用文件选择）

### Requirement: ArkTS 桥接 SHALL 经现有 showFilePicker 通道扩展
desktop 文件夹选择 SHALL 复用 `tauri-cli` OHOS 模板中 `Plugin.ets` 的 `showFilePicker` 通道（经 `run_mobile_plugin`），通过入参携带 `directory` 标志，由 ArkTS 侧据此设置 `DocumentSelectOptions.selectMode`。SHALL NOT 在 plugin Rust 端直接 NAPI 调用 `DocumentViewPicker`（铁律 #1：openharmony-ability / 模板 ETS 是唯一 ArkTS 桥接层）。

#### Scenario: showFilePicker 携带 directory 标志
- **WHEN** `run_mobile_plugin("showFilePicker", { directory: true, multiple: false })` 在 OHOS desktop 派发
- **THEN** ArkTS `showFilePicker` 处理器 SHALL 构造 `DocumentSelectOptions` 并设 `selectMode = DocumentSelectMode.FOLDER`
- **AND** 调用 `DocumentViewPicker.select(options)` 返回目录 URI

## 平台限制说明
- `DocumentSelectMode.FOLDER`（`@ohos.file.picker`）自 **API 11** 起提供，文档明确 "Only 2-in-1 devices are supported"——即仅 OHOS 桌面/2-in-1 形态可用，mobile 不可用。证据：`@ohos.file.picker.d.ts` `DocumentSelectMode` 枚举与 `DocumentSelectOptions.selectMode` 字段。
- `DocumentViewPicker.select()` 返回 `Promise<Array<string>>`（URI 数组）；`selectMode` 默认 `FILE`。
- mobile 降级为 `FolderPickerNotImplemented`，不属于"未实现"而是"平台能力限制"。
- 替代方案：mobile 上应用可通过 `@ohos.file.fs` 自行实现目录浏览 UI，但该方案不属于本契约范围，应作为独立插件设计。

## 修订说明
本 spec 推翻早期"OHOS 截至 API 21 无第三方目录选择器、统一返回错误"的结论。`TAURI_OHOS_DEVICE_TYPE=desktop` 场景下文件夹选择 SHALL 实现，不再降级。表格 R181 的处置相应从"平台限制（全 ❌）"调整为"desktop 可实现 / mobile 降级"。
