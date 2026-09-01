## Context

`tauri-plugin-upload`（`plugins-workspace/plugins/upload/src/lib.rs`）注册两个命令：

```rust
#[command]
async fn upload(
    url: String,
    file_path: String,
    headers: HashMap<String, String>,
    method: Option<HttpMethod>,          // enum, #[serde(rename_all = "UPPERCASE")]
    on_progress: Channel<ProgressPayload>,
) -> Result<String> { ... }

#[command]
async fn download(
    url: String,
    file_path: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    on_progress: Channel<ProgressPayload>,
) -> Result<()> { ... }
```

前端 `guest-js/index.ts` 调用 `invoke('plugin:upload|upload', { id, url, filePath, headers: headers ?? {}, method: method ?? 'POST', onProgress })`，其中 `onProgress` 是 `@tauri-apps/api/core` 的 `Channel` 实例（`toJSON()` 序列化为 `__CHANNEL__:<id>` 字符串）。

**OHOS desktop 上现象**：invoke 返回后端反序列化失败（前端表现为 "unexpected invoke body" 类错误），上传/下载不可用。

### IPC 传输路径分析（OHOS）

1. `crates/tauri/scripts/ipc-protocol.js` 中 `const canUseCustomProtocol = osName !== 'android'`。
2. `crates/tauri/src/app.rs` `InvokeInitializationScript` 的 `os_name` 字段取 `std::env::consts::OS`。OHOS 的 `target_os = "linux"`，故 `os_name = "linux"`。
3. 因此 OHOS 上 `canUseCustomProtocol = true`，invoke 走 `fetch('ipc://localhost/<cmd>', { method: 'POST', body, headers })`。
4. `ipc://` scheme 由 `crates/tauri/src/manager/webview.rs` 注册为 custom protocol，经 `wry/src/ohos/mod.rs` → `openharmony-ability` `Webview::custom_protocol_async` → ArkWeb `on_request_start`（`onInterceptRequest`）拦截。
5. `openharmony-ability/crates/ability/src/helper/webview.rs` `custom_protocol_async` 通过 `req.http_body_stream()` 读取 POST body，组装 `http::Request<Vec<u8>>` 交给 tauri 的 `parse_invoke_request`。
6. `crates/tauri/src/ipc/protocol.rs` `parse_invoke_request` 依据 `Content-Type` 头判定 `InvokeBody`：`application/json` → `InvokeBody::Json(Value)`；缺失/其他 → 默认 `APPLICATION_OCTET_STREAM` → `InvokeBody::Raw(bytes)`；空 body + json → `InvokeBody::Json(Value::Object(default))`。

**关键既有先例**：`crates/tauri/src/window/plugin.rs` L268 对 `drag.js` 脚本已在 `cfg!(target_env = "ohos")` 时把 `os_name` 设为 `"ohos"`（而非 `"linux"`），说明 OHOS 上对 `osName` 做平台特化是既有模式。

### OHOS 约束（铁律）

1. **cfg 隔离** — OHOS 变更用 `cfg(target_env = "ohos")`；`OHOS_DEVICE_TYPE=desktop` 时 `cfg(desktop)=true`、`cfg(mobile)=false`（`crates/tauri/build.rs` L266-276）。本修复对所有 OHOS 设备形态通用，用 `cfg(target_env = "ohos")`。
2. **openharmony-ability 唯一桥接** — 复用既有 `WebProxy` 的 `ipc.postMessage` 与 `handle_ipc_message`，不新增 ArkTS/NAPI 桥接。
3. **不影响其他平台** — `os_name` 仅 OHOS 改值；`canUseCustomProtocol` 守卫仅排除 `'ohos'`；其他平台 `osName` 与行为不变。
4. **日志（§3.4）** — `log::*!` + stdout 在 OHOS 不可见；诊断日志用 `hilog` crate 或宿主 `ohos_log` 已接的 `log` facade。

## 根因分析

| 假设 | 说明 | 评估 |
|------|------|------|
| **A. custom-protocol POST body 未作为 JSON 交付** | ArkWeb `onInterceptRequest` 对自定义 scheme 的 `fetch` POST 请求不能可靠交付 body：`req.http_body_stream()` 返回 `None`/空，或 `Content-Type: application/json` 头被剥离。前者 → `parse_invoke_request` 得空 body + json → `InvokeBody::Json({})`；后者 → 默认 `APPLICATION_OCTET_STREAM` → `InvokeBody::Raw(bytes)`。两种情况下 upload 的 `url`/`file_path`/`headers`/`method`/`on_progress` 均无法从 `InvokeBody` 反序列化（`CommandItem::deserialize_json` 对 `Raw` 直接报 "expected a value for key X but the IPC call used a bytes payload"；对空 `{}` 报 "missing required key X"） | **最可能**——upload 全部参数为结构化类型，任一缺失/错型即整体失败，Channel/HashMap/enum 是受害者 |
| B. Channel 反序列化本身在 OHOS 损坏 | `Channel<ProgressPayload>` 的 `CommandArg` 实现读 `payload["onProgress"]` 字符串并 `JavaScriptChannelId::from_str`。该实现平台无关，postMessage 路径下 payload 为 `serde_json::Value`，字符串 `__CHANNEL__:<id>` 可正常解析 | 不成立——实现无平台分支 |
| C. HashMap/enum serde 在 OHOS 损坏 | `HashMap<String,String>` 与 `Option<HttpMethod>`（`rename_all="UPPERCASE"`）均为标准 serde，无平台分支；JS 发送 `headers:{}` 对象、`method:"POST"` 字符串与 Rust 期望一致 | 不成立——serde 行为跨平台一致 |
| D. postMessage 回退路径也损坏 | 若 custom-protocol fetch 失败，`ipc-protocol.js` 设 `customProtocolIpcFailed=true` 回退到 `window.ipc.postMessage`。`handle_ipc_message` 从消息字符串反序列化 `Message`，`payload` 为 `serde_json::Value`，`InvokeBody::Json` 路径正常 | 回退路径应可用；若回退已生效则 upload 不会失败，反证 A（即 custom-protocol 未触发回退但 body 损坏，或回退未生效） |
| E. reqwest 在 OHOS 不可用 | `upload` 用 `reqwest::Client::new()`。若 reqwest 未编译则命令注册阶段即失败，表现为 "Command not found" 而非反序列化错误 | 与症状不符 |

**当前判断（待设备端验证）**：根因疑为 A。OHOS 上 IPC 走 custom-protocol fetch 路径，ArkWeb 对自定义 scheme POST body 交付疑似不可靠，导致 `parse_invoke_request` 得到空/错型 `InvokeBody`，upload 结构化参数反序列化失败。**注意**：假设 A 的源码路径分析已通过审计核对（`ipc-protocol.js:20` `canUseCustomProtocol=osName!=='android'`、`app.rs` `InvokeInitializationScript.os_name=std::env::consts::OS`（OHOS 上为 `"linux"`）、`window/plugin.rs:268` 已有 OHOS 设 `os_name='ohos'` 先例三处均无误），但 "body 不可靠" 这一事实结论尚未经设备端日志验证，不得在 D3 门槛通过前作为定论推进 D1+D2。

> **强制验证门槛（D3 先行，D1+D2 不得并行）**：D1+D2 的实施 **以 D3 诊断日志设备端验证通过为硬性先决条件**。实现顺序严格为：先合入 D3 → 构建设备端 app → 复现一次 `plugin:upload|upload` invoke → hilog 抓取 cmd / Content-Type / body 字节数 / `InvokeBody` 变体 → 与假设 A 比对：
> - **若日志与 A 一致**（body 空 / Content-Type 丢失 / `InvokeBody::Raw` 或空 `Json({})`）→ 推进 D1+D2，方案不变。
> - **若日志显示 body 为合法 JSON 且 `InvokeBody::Json` 但 upload 仍失败** → 假设 A 被证伪，根因转查 B/C/D，**D1+D2 暂停合入**，回到本节修正根因与方案后再推进。
> - **若日志显示其他未预期变体** → 据实修正 design.md 根因分析与 D1/D2 决策，必要时新增决策项。
>
> D3 诊断日志本身无条件合入（有价值、`cfg` 隔离零影响），不论假设 A 是否成立。

## Goals / Non-Goals

**Goals:**
- OHOS desktop 上 `plugin:upload|upload` 与 `plugin:upload|download` 端到端可用：前端调用成功上传/下载，`onProgress` 收到 `ProgressPayload` 事件，响应 text 正确返回。
- `Channel<ProgressPayload>`、`HashMap<String,String>`、`Option<HttpMethod>` 三类参数在 OHOS 上正确反序列化。
- OHOS IPC 传输路径选择修复（custom-protocol → postMessage）cfg 隔离，不影响其他平台。
- 失败可诊断：`parse_invoke_request` 在 OHOS 上输出 Content-Type/body/InvokeBody 诊断信息到 hilog。

**Non-Goals:**
- 不修改 upload 命令的业务逻辑（reqwest 上传/下载流式逻辑保持不变）。
- 不替换 reqwest 或改 HTTP 栈。
- 不改动 openharmony-ability / wry 的 custom_protocol_async 实现（仅改 tauri 核心的路径选择）。
- 不优化 postMessage 路径性能（正确性优先；性能后续评估）。
- 不处理 upload 的 ACL/权限配置（沿用既有 capability）。

## Decisions

### D1: OHOS 上 `InvokeInitializationScript.os_name` 设为 `"ohos"`

**选择**：在 `crates/tauri/src/app.rs` `Builder::new()` 构造 `InvokeInitializationScript` 处，将 `os_name` 由 `std::env::consts::OS` 改为平台特化：

```rust
os_name: if cfg!(target_env = "ohos") {
  "ohos"
} else {
  std::env::consts::OS
},
```

**理由**：
- 与 `window/plugin.rs` L268 对 `drag.js` 的既有做法一致（OHOS 上 `os_name = "ohos"`）。
- 使 `ipc-protocol.js` 能区分 OHOS，单独控制传输路径。
- 其他平台 `os_name` 不变。

### D2: `ipc-protocol.js` 排除 OHOS 走 custom-protocol

**选择**：`crates/tauri/scripts/ipc-protocol.js` 将
```js
const canUseCustomProtocol = osName !== 'android'
```
改为
```js
const canUseCustomProtocol = osName !== 'android' && osName !== 'ohos'
```

**理由**：
- OHOS 与 Android 同属"ArkWeb 自定义 scheme POST body 交付不可靠"类别，应走 postMessage。
- `window.ipc.postMessage` 由 `wry/src/ohos/mod.rs` 的 `WebProxyBuilder::new(id, "ipc").add_method("postMessage", ...)` 注册，`handle_ipc_message` 从消息字符串反序列化 `Message`，`payload` 作为 `serde_json::Value` → `InvokeBody::Json`，结构化参数可正常反序列化。
- `FETCH_CHANNEL_DATA_COMMAND`（Channel 大 payload 回拉）在 `canUseCustomProtocol=false` 时仍走 postMessage（`sendIpcMessage` 的 else 分支），`fetch` 命令从 `options.headers` 读 `Tauri-Channel-Id`，响应经 `runCallback` 回前端，链路完整。
- 其他平台 `osName` 不含 `'ohos'`，守卫行为不变。

**备选**：
- 在 `openharmony-ability` 修复 `custom_protocol_async` 的 body 读取（让 custom-protocol POST 可靠）——侵入桥接仓、改动大、影响 asset/tauri scheme 等所有 custom protocol，风险高。**不选**（留作长期优化）。
- 在 upload 插件内自定义 invoke 路径——违背"IPC 传输是 tauri 核心职责"，且其他插件同样受损。**不选**。

### D3: `parse_invoke_request` 增加 OHOS 诊断日志（D1+D2 硬性先决门槛）

**选择**：在 `crates/tauri/src/ipc/protocol.rs` `parse_invoke_request` 内，`cfg(target_env = "ohos")` 隔离地记录：cmd、Content-Type、body 字节数、最终 `InvokeBody` 变体（Json/Raw）、以及 `has_payload`。日志走 `log::trace!`/`log::warn!`（OHOS 宿主 `ohos_log::init()` 已把 `log` facade 接到 hilog，符合 §3.4）。

```rust
#[cfg(target_env = "ohos")]
log::trace!(
  "[ipc] cmd={cmd} content_type={ct} has_payload={has} body_len={len} variant={variant}",
  ...
);
```

**理由**：
- **作为 D1+D2 的硬性先决门槛**：假设 A 的 "custom-protocol POST body 不可靠" 未经设备端验证，D3 日志是将其从假设升为定论、或证伪后转查他因的唯一依据。D1+D2 不得在 D3 门槛通过前合入。
- 后续 IPC 类问题（含其他插件）可快速定位。
- `cfg` 隔离，其他平台零开销零影响。
- 用 `log` 而非直接 `hilog` crate，避免给 tauri 核心新增 OHOS-only 依赖。

**门槛判定标准**（实现时严格按此执行）：
- 通过：hilog 显示 body 空 / Content-Type 丢失 / `InvokeBody::Raw` 或空 `Json({})` → 与假设 A 一致 → 推进 D1+D2。
- 未通过：hilog 显示 body 为合法 JSON 且 `InvokeBody::Json` 但 upload 仍失败 → 假设 A 证伪 → D1+D2 暂停，回 design.md 修正根因与方案。

### D4: upload 插件平台元数据与文档

- `plugins-workspace/plugins/upload/Cargo.toml` `[package.metadata.platforms.support]` 增加 `ohos = { level = "full", notes = "" }`（参考其他已适配插件）。
- `README.md` 增加 OHOS 小节：IPC 走 postMessage、需 `ohos.permission.INTERNET`（reqwest 网络访问）、诊断日志经 hilog。
- 不改 `src/lib.rs` 命令逻辑。

## API 映射 (Tauri ↔ OHOS)

| Tauri / 跨平台 | OHOS 映射 | 说明 |
|---------------|-----------|------|
| `invoke('plugin:upload\|upload', args)` → `fetch('ipc://...')` (custom protocol) | `window.ipc.postMessage(JSON)` → `WebProxy` `ipc.postMessage` → `handle_ipc_message` | OHOS 改走 postMessage 路径（D1+D2） |
| `Channel<ProgressPayload>` 参数反序列化 | `payload["onProgress"]` 字符串 `__CHANNEL__:<id>` → `JavaScriptChannelId::from_str` → `channel_on(webview)` | 平台无关，postMessage 下 `InvokeBody::Json` 可正常取值 |
| `Channel::send` 进度回调 | `webview.eval(format_raw_js(cb, json))`（小 payload） / `FETCH_CHANNEL_DATA_COMMAND` invoke（大 payload） | OHOS 下 eval 与 invoke 均走 postMessage 通道，链路完整 |
| `HashMap<String,String>` headers | `serde_json::Value::Object` → `HashMap::deserialize` | 平台无关 |
| `Option<HttpMethod>` enum (`UPPERCASE`) | `serde_json` 字符串 `"POST"/"PUT"/"PATCH"` → enum | 平台无关；JS 端 `HttpMethod.Post='POST'` 与 Rust `rename_all="UPPERCASE"` 对齐 |
| `parse_invoke_request` Content-Type 判定 | OHOS 诊断日志（D3） | 不改判定逻辑，仅观测 |
| `reqwest::Client` HTTP 上传/下载 | OHOS 网络栈（需 `ohos.permission.INTERNET`） | reqwest aarch64-linux-ohos 可用，无需改 |

## Risks / Trade-offs

- **[风险] 假设 A 误判（已设硬性门槛控制）** → 假设 A 的源码路径分析已审计核对无误（`ipc-protocol.js:20`、`app.rs` `os_name`、`window/plugin.rs:268` 三处），但 "body 不可靠" 事实结论未设备端验证。D3 诊断日志设为 D1+D2 的 **硬性先决门槛**：日志与 A 一致方推进 D1+D2；日志证伪 A 则 D1+D2 暂停、回设计修正。此为可接受的风险控制（审计意见），不构成阻断性问题。诊断日志本身无条件合入。
- **[风险] OHOS 全量 invoke 改走 postMessage 影响其他插件** → postMessage 路径是 Android 既有的成熟路径，`handle_ipc_message` 与 `parse_invoke_request` 在 tauri 核心长期并存且等价；正确性优先于性能。需在验证阶段回归核心命令（window/event/log 等）。
- **[权衡] 不修 `openharmony-ability` custom_protocol body** → 短期用 postMessage 绕开；长期若要恢复 custom-protocol fetch 性能，再单独评估桥接仓 body 读取修复。本期不涉及。
- **[风险] Channel 大 payload 回拉在 postMessage 下性能下降** → `FETCH_CHANNEL_DATA_COMMAND` 经 postMessage 走 `fetch` 命令，response 经 `Channel::from_callback_fn` eval 回前端；upload 进度 payload 小（<8KB）走 eval 直投，不触发回拉。风险低。
- **[风险] `OHOS_DEVICE_TYPE=mobile` 形态** → `cfg(target_env="ohos")` 覆盖所有形态；mobile 形态下 `cfg(mobile)=true`，插件命令本就走 `run_mobile_plugin` 路径（不经 `parse_invoke_request`），D1+D2 对 mobile 形态无负面影响（postMessage 路径仅 `cfg(desktop)` 形态的 invoke 使用）。需文档注明。

## Migration Plan

1. **D3 先行（硬性门槛，不得与 D1+D2 并行）**：加 `parse_invoke_request` OHOS 诊断日志，构建 app，设备端复现 upload invoke，hilog 抓取 cmd / Content-Type / body 字节数 / `InvokeBody` 变体。
2. **门槛判定**：日志与假设 A 一致（body 空 / Content-Type 丢失 / `InvokeBody::Raw` 或空 `Json({})`）→ 进入步骤 3；日志证伪 A（body 合法 JSON 且 `InvokeBody::Json` 但 upload 仍失败）→ **D1+D2 暂停**，回 "根因分析" 修正假设与方案后重新评估；日志显示其他未预期变体 → 据实修正 design.md。
3. D1+D2：改 `app.rs` `os_name` 与 `ipc-protocol.js` 守卫（仅在步骤 2 通过后执行）。
4. `cargo check --target aarch64-linux-ohos -p tauri` + `cargo check --target aarch64-linux-ohos -p tauri-plugin-upload` 通过。
5. 非 OHOS 回归：`cargo check -p tauri` / `cargo check -p tauri-plugin-upload`（Windows/macOS/Linux）通过。
6. 设备端：前端 `upload(url, filePath, onProgress, headers, method)` 期望成功 + `onProgress` 收到事件 + 响应 text 正确；`download` 同样验证。
7. 回归核心命令（window/event/log）确认 postMessage 路径无退化。
8. 回滚：还原 `app.rs` / `ipc-protocol.js` / `protocol.rs` 三处 cfg 隔离改动（单 PR 可整体回退）。

## Open Questions

- 假设 A 确认后，是否在本次 PR 顺手修复 `openharmony-ability` custom_protocol body？**建议否**——单 PR 聚焦 tauri 核心路径修复，桥接仓改动另立 Phase。
- OHOS mobile 形态是否需要 upload 适配？mobile 形态走 `run_mobile_plugin`，upload 插件未提供 ArkTS 插件模块，mobile 形态下 upload 不可用是已知限制（与 dialog 同理）。本期仅覆盖 desktop。

## 审计结论（已通过，无阻断性问题）

- **IPC 路径分析**：源码核对无误——`ipc-protocol.js:20` `canUseCustomProtocol=osName!=='android'`、`app.rs` `InvokeInitializationScript.os_name=std::env::consts::OS`（OHOS 上为 `"linux"`）、`window/plugin.rs:268` 已有 OHOS 设 `os_name='ohos'` 先例三处均正确。
- **D1+D2 postMessage 策略**：与 Android 同策略，复用既有 `WebProxy.postMessage`，不新增 NAPI，符合 openharmony-ability 唯一桥接铁律。
- **cfg 隔离**：`cfg(target_env='ohos')` 隔离正确；日志走 `log` facade → hilog 符合 §3.4。
- **D3 诊断先行**：稳健做法，实现时严格按 D3 门槛执行。
- **非阻断性风险**：根因假设 A 未经设备端验证即为定论——已通过 D3 硬性先决门槛控制（日志不符则 D1+D2 暂停回退修正），属可接受的风险控制，不构成阻断性 issue。
