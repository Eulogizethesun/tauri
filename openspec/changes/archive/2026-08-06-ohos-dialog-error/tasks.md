# ohos-dialog-error Tasks

- [x] 1. `tauri-runtime-wry/src/dialog/mod.rs` `error()` 新增 `cfg(all(not(windows), target_env = "ohos"))` 分支，`log::error!` 降级；其余非 Windows 保留 `unimplemented!()`
