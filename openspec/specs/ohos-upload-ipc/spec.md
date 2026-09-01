# ohos-upload-ipc Specification

## Purpose
TBD - created by archiving change p1-upload-ohos-fix. Update Purpose after archive.
## Requirements
### Requirement: OHOS IPC 传输路径选择

在 OHOS（`cfg(target_env = "ohos")`，所有设备形态）上，tauri 核心 IPC 初始化脚本 SHALL 将前端 invoke 路由到 `window.ipc.postMessage` 路径，而非 `fetch('ipc://...')` custom-protocol 路径。这是通过将 `InvokeInitializationScript.os_name` 在 OHOS 上设为 `"ohos"`，并在 `ipc-protocol.js` 中将 `canUseCustomProtocol` 守卫排除 `'ohos'` 实现的。其他平台（Windows/macOS/Linux/Android/iOS）的 `os_name` 取值与传输路径选择 MUST 保持不变。

**实施顺序约束**：本 Requirement 的实现（D1+D2）MUST 以 "OHOS 诊断日志" Requirement 的设备端验证通过为硬性先决条件。根因假设（custom-protocol POST body 不可靠）未经 D3 设备端日志确认前，D1+D2 不得合入。

#### Scenario: OHOS 上 invoke 走 postMessage
- **WHEN** 在 `cfg(target_env = "ohos")` 构建的 app 中，前端调用 `window.__TAURI_INTERNALS__.invoke('plugin:upload|upload', args)`
- **THEN** IPC 消息经 `window.ipc.postMessage` 投递（而非 `fetch('ipc://localhost/...')`），后端 `handle_ipc_message` 从消息字符串反序列化得到 `InvokeBody::Json(args)`，其中 `args` 为完整参数对象

#### Scenario: 其他平台传输路径不变
- **WHEN** 在非 OHOS 平台构建
- **THEN** `InvokeInitializationScript.os_name` 取 `std::env::consts::OS`，`canUseCustomProtocol` 守卫不排除该平台，传输路径与现状一致

### Requirement: upload 命令结构化参数在 OHOS 反序列化

`plugin:upload|upload` 命令的 `on_progress: Channel<ProgressPayload>`、`headers: HashMap<String,String>`、`method: Option<HttpMethod>`（`#[serde(rename_all = "UPPERCASE")]`）参数 SHALL 在 OHOS desktop 上从 `InvokeBody::Json` 正确反序列化。反序列化失败时 MUST 通过 hilog 可见诊断信息。

#### Scenario: Channel 参数反序列化
- **WHEN** 前端发送 `onProgress` 为 `Channel` 实例（`toJSON()` → `"__CHANNEL__:<id>"`）的 invoke
- **THEN** 后端 `Channel::from_command` 从 `payload["onProgress"]` 读出字符串，`JavaScriptChannelId::from_str` 解析成功，`channel_on(webview)` 返回有效 `Channel<ProgressPayload>`

#### Scenario: HashMap 参数反序列化
- **WHEN** 前端发送 `headers` 为 JSON 对象（`{}` 或 `{"key":"value"}`）
- **THEN** 后端 `HashMap<String,String>::deserialize` 从 `payload["headers"]` 成功构造 HashMap

#### Scenario: enum 参数反序列化
- **WHEN** 前端发送 `method` 为 `"POST"` / `"PUT"` / `"PATCH"` 字符串之一（默认 `"POST"`）
- **THEN** 后端 `Option<HttpMethod>::deserialize` 经 `rename_all="UPPERCASE"` 映射成功构造 `Some(HttpMethod::Post/Put/Patch)`

#### Scenario: 反序列化失败可诊断
- **WHEN** OHOS 上 `parse_invoke_request` 处理任意 invoke 请求
- **THEN** 在 `cfg(target_env = "ohos")` 下，cmd、Content-Type、body 字节数、`InvokeBody` 变体（Json/Raw）、`has_payload` 通过 `log` facade（经宿主 hilog backend）输出

### Requirement: OHOS 诊断日志作为 D1+D2 硬性先决门槛

D3 诊断日志 SHALL 作为 D1+D2（IPC 传输路径修复）的硬性先决门槛。根因假设 A（custom-protocol POST body 不可靠）的源码路径分析虽已审计核对（`ipc-protocol.js:20`、`app.rs` `os_name`、`window/plugin.rs:268` 三处无误），但 "body 不可靠" 事实结论 MUST 经设备端 hilog 日志验证后方可作为定论推进 D1+D2。D3 诊断日志本身无条件合入（`cfg` 隔离、零平台影响、不论假设 A 是否成立均有价值）。

#### Scenario: D3 门槛通过
- **WHEN** 设备端 hilog 显示 `parse_invoke_request` 在 upload invoke 时 body 空 / Content-Type 丢失 / `InvokeBody::Raw` 或空 `Json({})`
- **THEN** 假设 A 与观测一致，D1+D2 获准推进实施

#### Scenario: D3 门槛证伪
- **WHEN** 设备端 hilog 显示 body 为合法 JSON 且 `InvokeBody::Json` 但 upload 命令仍反序列化失败
- **THEN** 假设 A 被证伪，D1+D2 MUST 暂停合入，回 design.md "根因分析" 修正假设与方案（转查 Channel/HashMap/enum 反序列化或 ACL）后重新评估

#### Scenario: D3 门槛未预期
- **WHEN** 设备端 hilog 显示未预期变体（既非 A 描述、亦非合法 Json）
- **THEN** D1+D2 MUST 暂停合入，据实修正 design.md 根因分析与 D1/D2 决策，必要时新增决策项

### Requirement: upload/download 端到端行为

`upload` 与 `download` 命令在 OHOS desktop 上 SHALL 端到端可用，行为与 Windows/macOS 一致：上传/下载完成、`onProgress` 收到 `ProgressPayload` 事件、响应 text 正确返回前端。

#### Scenario: upload 端到端
- **WHEN** 前端调用 `upload(url, filePath, onProgress, headers, HttpMethod.Post)`
- **THEN** 文件被 POST 到 `url`，`onProgress` 回调收到一个或多个 `ProgressPayload`（`progress`/`progressTotal`/`total`/`transferSpeed` 字段），invoke promise resolve 为服务器响应 text

#### Scenario: download 端到端
- **WHEN** 前端调用 `download(url, filePath, onProgress, headers, body)`
- **THEN** 文件被下载到 `filePath`，`onProgress` 回调收到 `ProgressPayload` 事件，invoke promise resolve

#### Scenario: HTTP 方法变体
- **WHEN** 前端分别以 `HttpMethod.Put` / `HttpMethod.Patch` 调用 upload
- **THEN** 后端分别用 PUT / PATCH 方法发送请求，行为与 Windows/macOS 一致

### Requirement: 平台隔离与非回归

所有 OHOS 相关变更 MUST 通过 `cfg(target_env = "ohos")`（Rust）与 `osName !== 'ohos'`（JS）隔离，不影响 Windows/macOS/Linux/Android/iOS 既有功能。upload 插件公开 API（`upload`/`download`/`HttpMethod`）MUST 保持不变。

#### Scenario: 非 OHOS 回归
- **WHEN** 在 Windows/macOS/Linux 上 `cargo check -p tauri` 与 `cargo check -p tauri-plugin-upload`
- **THEN** 编译通过，且 OHOS 诊断日志代码因 `cfg` 隔离不参与编译

#### Scenario: OHOS 编译
- **WHEN** `cargo check --target aarch64-linux-ohos -p tauri` 与 `cargo check --target aarch64-linux-ohos -p tauri-plugin-upload`
- **THEN** 编译通过

