# Tauri OHOS 项目规则

## OHOS 适配三条铁律

修改任何 OHOS 相关代码前，必须遵守以下约束：

1. **openharmony-ability 是唯一 ArkTS 桥接仓** — 所有仓（tauri、tao、wry、muda、tray-icon）调用鸿蒙系统能力必须经过 `openharmony-ability`，禁止在其他仓直接调用 ArkTS API 或 NAPI 函数。

2. **不影响其他平台原有实现** — 所有修改不得影响 Windows/macOS/Linux 的现有功能和代码路径。OHOS 代码必须通过 `cfg(target_env = "ohos")` 隔离。Linux 依赖必须加 `not(target_env = "ohos")` 排除（因为 OHOS 的 `target_os` 是 `"linux"`）。

3. **TAURI_OHOS_DEVICE_TYPE 决定设备形态** — `TAURI_OHOS_DEVICE_TYPE=desktop` 启用 `cfg(desktop)`（含 tray/menu bar），`TAURI_OHOS_DEVICE_TYPE=mobile`（默认）启用 `cfg(mobile)`。`cfg(target_env = "ohos")` 隔离所有设备形态通用的代码；`cfg(all(target_env = "ohos", desktop))` 或 `cfg(all(target_env = "ohos", mobile))` 隔离特定设备形态的代码。

## 技术约束详细参考

完整的 OHOS 技术约束（cfg 隔离、NAPI/TSFN 规则、线程模型、ArkTS 框架约束、构建环境、测试约束）详见 [`.claude/skills/tauri-ohos-design/references/ohos-constraints.md`](.claude/skills/tauri-ohos-design/references/ohos-constraints.md)。修改 OHOS 相关代码前必须阅读并遵守。
