# Phase B1: tao bridge 适配

## 概述

将 tao 的 OHOS 后端 (`tao/src/platform_impl/ohos/mod.rs`) 从旧的 openharmony-ability 直接 NAPI 调用模型迁移到 A0 引入的 pluginized bridge 架构。

旧模型使用 `get_named_property("method_name")` + `Function::call` 字符串直调 ArkTS 函数；新模型使用 `bridgeInvoke(pluginId, action, reqType, respType, value, timeout)` 具名契约传输层，通过 `WindowClient` / `AppControlExt` 等 facade 调用。

Phase B1 是 Track B 的第一个 change，仅依赖 A0（plugin-window / plugin-app-control facade 已存在）。

## 动机

A0 (PR #67/#68) 引入了 pluginized bridge 架构，将旧的 `window/mod.rs` 中基于 `get_named_property` 的直接 NAPI 函数迁移到 `bridgeInvoke` 具名契约模型。tao 的 OHOS 后端目前直接依赖旧 API：

1. **编译断裂**：`OpenHarmonyApp::exit()` 和 `OpenHarmonyApp::set_color_mode()` 已在 A0 中被移除，tao 代码当前无法编译通过 `cargo check --target aarch64-unknown-linux-ohos`
2. **架构一致性**：旧模型中 tao 通过 `use openharmony_ability::window::{resize_window, move_window_to, ...}` 直接调用散函数，绕过了 bridge 的类型契约检查，与新的 plugin 架构不一致
3. **线程安全**：旧模型中部分函数需要 `get_main_thread_env()` thread_local（仅主线程可用），新 bridge 通过 TSFN 天然支持跨线程调用
4. **错误感知**：旧模型的 fire-and-forget TSFN 函数无法感知 ArkTS Promise reject，新 bridge 通过 `BridgeCallOptions` + Promise 跟踪提供更好的错误反馈

## 影响范围

### 主要改动文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `tao/src/platform_impl/ohos/mod.rs` | 重写 ~10 处调用点 | window ops 迁移到 `WindowClient`，exit/set_color_mode 迁移到 `AppControlExt` |
| `tao/Cargo.toml` | 依赖调整 | 添加 `openharmony-ability-plugin-window` / `openharmony-ability-plugin-app-control` / `tokio` |

### 跨仓依赖（不在 B1 实现范围，但需标注）

| 依赖项 | 来源 Phase | B1 处理方式 |
|--------|-----------|------------|
| `plugin-app-control` `set-color-mode` action | 需新增（A1 未覆盖） | B1 在 plugin-app-control 中添加此 action（~30 行，与 terminate 同模式） |
| `plugin-app-control` `hide-ability` / `show-ability` action | A1 | B1 暂用 minimize/restore workaround stub，A1 完成后接入 |
| `plugin-window` `create-os-window` 同步语义 | A1（可选） | B1 暂保留 `create_os_window` 为 core（同步 NAPI），见 design.md 3.1 节 |

### 不受影响

- Windows / macOS / Linux / iOS / Android 平台实现：所有改动在 `#[cfg(target_env = "ohos")]` 内
- tao 的公共 API 签名不变（`set_inner_size`、`is_maximized` 等签名保持不变）
- openharmony-ability 的 bridge 核心 (`bridge/mod.rs`)：B1 不修改 bridge 框架本身
