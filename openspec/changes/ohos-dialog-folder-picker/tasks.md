# ohos-dialog-folder-picker Tasks

- [x] 1. lib.rs `FileDialogPayload` 加 `directory` + `payload(multiple, directory)`
- [x] 2. mobile.rs pick_file/files/save_file payload 调用更新
- [x] 3. mobile.rs 新增 `pick_folder`/`pick_folders`
- [x] 4. lib.rs `pick_folder`/`pick_folders`/`blocking_pick_folder`/`blocking_pick_folders` cfg → `desktop`
- [x] 5. commands.rs folder 分支拆三（OHOS-desktop FOLDER 实现 / mobile 错误 / 非OHOS-desktop 不变）
- [x] 6. Plugin.ets `OpenArgs.directory` + `handleOpen` + `showDocumentPicker` FOLDER 模式
- [ ] 7. 设备验证：desktop 选目录返回 URI；mobile 返回错误
