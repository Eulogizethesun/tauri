## Why
`tauri-runtime-wry/src/dialog/mod.rs` 的 `error()` 在非 Windows 平台（含 OHOS）走 `unimplemented!()`，是 panic 隐患（footgun）。虽然运行时调用点仅在 `cfg(windows)` 触发，OHOS 实际不会走到，但函数体本身不应 panic。

## What Changes
- `error()` 拆分 cfg：`#[cfg(all(not(windows), target_env = "ohos"))]` 分支改为 `log::error!` 降级；其余非 Windows 平台保留 `unimplemented!()` 不变。

## Impact
- OHOS 不再因 error() panic
- 其他平台完全不变
- 用户级错误对话框语义已由 `ohos-dialog-plugin` 的 `MessageDialogKind::Error` + `showMessageDialog` 覆盖（OHOS 不按 kind 切图标，已在 dialog-plugin spec 标注）
