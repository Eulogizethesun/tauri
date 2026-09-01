## Why
`tauri-plugin-dialog` 在 OHOS 上对 `options.directory=true` 统一返回 `FolderPickerNotImplemented`。经 SDK 核实，`DocumentViewPicker` 配 `DocumentSelectMode.FOLDER`（API 11+）支持目录选择，**仅 2-in-1/桌面设备**。desktop 应实现，mobile 维持降级。

## What Changes
- **dialog lib.rs**：`FileDialogPayload` 加 `directory: bool`；`payload(multiple, directory)`；`pick_folder`/`pick_folders`/`blocking_pick_folder`/`blocking_pick_folders` 的 cfg 从 `all(desktop, not(ohos))` 放宽到 `desktop`（含 OHOS-desktop）
- **dialog mobile.rs**：新增 `pick_folder`/`pick_folders`（showFilePicker with `directory=true`）；pick_file/files/save_file 调整 payload 调用
- **dialog commands.rs**：folder 分支拆三：非OHOS-desktop（原 blocking_pick_folder）/ OHOS-desktop（FOLDER 实现 + scope）/ mobile（FolderPickerNotImplemented）
- **tauri-cli 模板 Plugin.ets**：`OpenArgs` 加 `directory`；`handleOpen` 传递；`showDocumentPicker` 在 directory 时设 `selectMode = DocumentSelectMode.FOLDER`

## Impact
- OHOS desktop 支持文件夹选择
- OHOS mobile / android / iOS 维持不支持（明确错误）
- 非 OHOS 桌面完全不变
