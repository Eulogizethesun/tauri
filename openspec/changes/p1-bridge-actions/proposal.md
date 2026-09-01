# Phase A1: 补 action（webview + window + clipboard）

## 概述

在 openharmony-ability 完成 PR #67/#68（A0）引入的 pluginized bridge 架构基础上，为内置插件补充缺失的 action，覆盖 Tauri 本地特有功能。本 phase 新增 webview 域的打印、拖拽、新窗口、页面生命周期、自定义 UA 等 action；app-control 域的 hide/show ability；clipboard 域的文本读写。所有新增 action 遵循 `bridgeInvoke(pluginId, action, reqType, respType, value, timeout)` 具名契约模型，不影响 Windows/macOS/Linux 平台。

## 动机

A0 merge 后内置插件仅覆盖了基础 action 子集。wry（B2）和 tao（B1）的 OHOS 后端适配依赖完整的 action 覆盖：

- **wry webview 改写（B2）** 是 all-or-nothing 迁移，需要所有 webview action 就位后才能整体编译通过。缺失 `create-pdf`、`drag-*`、`new-window-request`、`page-begin/end`、`set-user-agent` 会导致 wry 编译失败或功能退化。
- **tao 窗口适配（B1）** 的 hide/show ability 依赖 A1 补全的 app-control action。
- **clipboard 文本读写** 是 clipboard-manager 插件的基础能力，当前仅有 `write-image`（遗留 TSFN 模型），文本读写完全缺失。

本 phase 是 Track B 消费方适配的前置条件：A1 完成后 B2 可启动，B1 的 hide/show 可接入。

## 影响范围

### Rust crate 改动

| crate | 改动类型 | 说明 |
|-------|---------|------|
| `crates/plugin-webview` | 扩展 | 新增 req/resp 类型 + facade 方法 + callbacks 扩展 |
| `crates/plugin-app-control` | 扩展 | 新增 hide/show ability req/resp 类型 + facade |
| `crates/plugin-clipboard` | **新建** | 文本读写 + 迁移 write-image 到 bridge 模型 |
| `crates/ability` | 收窄 | clipboard/mod.rs 标记 deprecated（功能迁移到 plugin-clipboard） |
| `crates/ability/src/bridge/mod.rs` | 无改动 | 现有 BridgeMainThreadEvent/BridgeRuntime 已支持所需模式 |

### ArkTS 插件改动

| 插件 | 改动 |
|------|------|
| `plugins/webview/.../WebviewPlugin.ets` | 补 create-pdf/set-user-agent action + drag/page/new-window 反向事件 + create 扩展字段 |
| `plugins/app-control/.../AppControlPlugin.ets` | 补 hide-ability/show-ability action |
| `plugins/clipboard/.../ClipboardPlugin.ets` | **新建** ClipboardPlugin + read-text/write-text/write-image |
| `plugins/window/.../WindowPlugin.ets` | 移入 BlurModifier + AttributeUpdater 动态刷新逻辑 |

### 不涉及的平台

- Windows / macOS / Linux：无改动（所有改动在 `cfg(target_env = "ohos")` 隔离内或 ArkTS 专属层）
- 消费方仓库（tao/wry/tauri）：本 phase 不改动，B1/B2 阶段接入
