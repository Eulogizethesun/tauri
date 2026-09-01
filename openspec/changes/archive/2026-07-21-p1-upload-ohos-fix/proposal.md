## Why

`tauri-plugin-upload` 的 `upload` 命令（`plugin:upload|upload`）在 OHOS desktop 上 invoke 时后端反序列化失败，前端收到错误（表现为 "unexpected invoke body" 类反序列化错误），导致上传/下载功能完全不可用。命令签名包含 `on_progress: Channel<ProgressPayload>`、`headers: HashMap<String,String>`、`method: Option<HttpMethod>`（`#[serde(rename_all = "UPPERCASE")]` enum）三个结构化参数，这些参数在 OHOS 上无法从后端收到的 `InvokeBody` 中正常反序列化。需定位根因并以 cfg 隔离的最小修复使 upload/download 在 OHOS desktop 上端到端可用，行为与 Windows/macOS 一致。

## What Changes

- **根因假设（tauri 核心 IPC 路由，待设备端验证）**：OHOS 上 `InvokeInitializationScript.os_name` 当前取 `std::env::consts::OS`（OHOS 上为 `"linux"`），使前端 `ipc-protocol.js` 中 `canUseCustomProtocol = osName !== 'android'` 为 `true`，于是所有 invoke 走 `fetch('ipc://localhost/<cmd>', { method: POST, body, headers })` 自定义协议路径。**假设** ArkWeb 对自定义 scheme 的 POST 请求拦截（`onInterceptRequest` / `on_request_start`）不能可靠把请求体作为 JSON 交付给 `parse_invoke_request`（body stream 为空或 `Content-Type` 被剥离 → `InvokeBody::Raw` / 空 `{}`），导致所有期望 JSON 对象的命令参数（`url`、`file_path`、`headers`、`method`、`on_progress`）反序列化失败。upload 因全部参数为结构化类型而首当其冲，Channel/HashMap/enum 是受害者而非根因。该假设的源码路径分析已审计核对（`ipc-protocol.js:20`、`app.rs` `os_name`、`window/plugin.rs:268` 三处无误），但 "body 不可靠" 事实结论需经 D3 设备端日志验证后方可作为定论。
- **诊断先行（D3，硬性先决门槛）**：在 `crates/tauri/src/ipc/protocol.rs` 的 `parse_invoke_request` 内增加 `cfg(target_env = "ohos")` 隔离的 hilog 诊断日志（Content-Type、body 长度、`InvokeBody` 变体），设备端复现一次 upload invoke 后判定：日志与假设一致 → 推进 D1+D2；日志证伪假设 → D1+D2 暂停，回设计修正。D3 日志本身无条件合入。
- **修复（tauri 核心，cfg 隔离，D3 门槛通过后执行）**：在 `crates/tauri/src/app.rs` 的 `InvokeInitializationScript` 构造处，对 `cfg!(target_env = "ohos")` 将 `os_name` 设为 `"ohos"`（与 `window/plugin.rs` drag.js 的既有做法一致）；在 `crates/tauri/scripts/ipc-protocol.js` 将 `canUseCustomProtocol` 守卫改为 `osName !== 'android' && osName !== 'ohos'`，使 OHOS 走 `window.ipc.postMessage` 路径（ArkWeb `WebProxy` 已注册 `ipc.postMessage`，body 在消息字符串内可靠交付，与 Android 同策略，复用既有桥接不新增 NAPI）。
- **upload 插件本体**：不修改命令逻辑（已正确）；仅在 `Cargo.toml` `[package.metadata.platforms.support]` 补充 OHOS 支持级别，`README.md` 补充 OHOS 说明。
- 不修改 Windows/macOS/Linux/Android/iOS 既有路径；所有 OHOS 变更通过 `cfg(target_env = "ohos")` 隔离。

## Capabilities

### New Capabilities
- `ohos-upload-ipc`: upload 插件在 OHOS 上的 IPC 传输与命令参数反序列化行为，确保 `Channel`/`HashMap`/enum 参数在 OHOS desktop 上正确反序列化，上传/下载端到端可用。

### Modified Capabilities
<!-- 无既有 spec 级别需求变更 -->

## Impact

- **代码**：`crates/tauri/src/app.rs`（`InvokeInitializationScript.os_name` OHOS 分支）、`crates/tauri/scripts/ipc-protocol.js`（`canUseCustomProtocol` 守卫）、`crates/tauri/src/ipc/protocol.rs`（OHOS 诊断日志）；`plugins-workspace/plugins/upload/Cargo.toml`（平台元数据）、`README.md`（文档）。
- **API**：插件公开 API（`upload`/`download`/`HttpMethod`）不变；tauri 核心 JS IPC 初始化脚本行为仅在 OHOS 上改变（custom-protocol → postMessage），其他平台 `os_name` 与守卫行为不变。
- **依赖**：无新增依赖。
- **桥接**：不调用 ArkTS/NAPI 新接口；复用既有 `WebProxy` 的 `ipc.postMessage` 与 `handle_ipc_message` 路径，符合 "openharmony-ability 唯一桥接" 铁律（无新桥接需求）。
- **其他平台**：`cfg(target_env = "ohos")` 与 `osName !== 'ohos'` 守卫双重隔离，零影响 Windows/macOS/Linux/Android/iOS。
- **副作用**：OHOS 上所有插件 invoke 改走 postMessage（与 Android 一致），可能带来微量性能变化（eval 路径 vs fetch 路径），但正确性优先；Channel 大 payload 的 `FETCH_CHANNEL_DATA_COMMAND` 仍按既有逻辑在 postMessage 通道内运行。
