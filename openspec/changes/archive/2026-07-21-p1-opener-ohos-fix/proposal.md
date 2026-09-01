## Why

`tauri-plugin-opener` 在 OHOS desktop 上三个命令（`open_url` / `open_path` / `reveal_item_in_dir`）均不可用：插件缺少 `cfg(target_env = "ohos")` 平台实现，`open` crate v5 与 `reveal_item_in_dir.rs` 的 cfg 门控都落入 `target_os = "linux"` 分支（OHOS 的 `target_os` 即 `"linux"`），前者调用 OHOS 不存在的 `xdg-open`/`gio`，后者编译进 zbus/D-Bus 实现（违反铁律 #3：Linux 依赖未加 `not(target_env = "ohos")` 排除）。用户报告的 `"unexpected invoke body"` 是表象错误——`Application` enum / scope `Entry` 的 `#[serde(untagged)]` 反序列化来自 ACL 配置，跨平台一致，并非根因；真正失败发生在参数反序列化完成之后的平台执行层。需为 opener 增加 OHOS 平台实现，经 `openharmony-ability` NAPI 桥接 ArkTS `startAbility(Want)`，并修复 cfg 隔离。

## What Changes

- 在 `openharmony-ability` 新增 NAPI 函数 `open_with_system`（Rust snake_case → ArkTS `openWithSystem`）：接收 `uri: String`（已含 scheme，如 `https://...` / `file://...`），ArkTS 侧调用 `UIAbilityContext.startAbility({ action: 'ohos.want.action.viewData', uri, entities: ['entity.system.browsable'] })` 并返回 Promise。Rust 侧 `pub async fn open_with_system(uri) -> napi_ohos::Result<()>`，沿用 autostart 的 `call_with_return_value` + `oneshot` + `tokio::timeout` await Promise 模式（**非 fire-and-forget**），捕获 reject 原因经 `Error::from_reason` 回传。
- 在 `openharmony-ability` 新增 NAPI 函数 `reveal_in_dir`（ArkTS `revealInDir`）：接收 `dir_uri: String`（父目录的 `file://` URI），ArkTS 侧 `startAbility` 拉起文件管理器打开该目录，同样 await Promise。**降级语义**：OHOS 无"在文件夹中选中指定文件"的系统 API（无 `SHOpenFolderAndSelectItems` 等价物），只能打开父目录；此平台差异在 `design.md` 与 `spec.md` 显式标注。
- 修改 `plugins-workspace/plugins/opener/src/commands.rs`：在 `open_url` / `open_path` / `reveal_item_in_dir` 三个 `async fn` 命令体顶部插入 `#[cfg(target_env = "ohos")] { ... return Ok(()); }` 短路分支，**直接 `.await openharmony-ability::open_with_system(uri)` / `reveal_in_dir(dir_uri)`**。**禁止** `tauri::async_runtime::block_on(...)`——命令本身是 async fn，tauri 在 tokio worker 线程 poll 其 future，`block_on` 在 runtime 内会 panic（`"Cannot block the current thread from within a runtime"`）。错误映射为 `Error::OpenharmonyAbility(e.to_string())`。`with`（指定程序）参数在 OHOS 上忽略（与 Android/iOS 一致，文档标注）。`open_path` 命令 OHOS 分支用 `url::Url::from_file_path` 转 `file://` URI 并跳过 `metadata()` 校验；`reveal_item_in_dir` 命令 OHOS 分支对 `paths[0]` canonicalize 后取 `parent()` 转 URI 调 `reveal_in_dir`。**不**修改同步 `open()`（`open.rs`）与同步 `reveal_items_in_dir()`——OHOS 命令路径不调用它们。
- 修改 `plugins-workspace/plugins/opener/src/reveal_item_in_dir.rs`：将 `imp` 模块的 cfg 门控由 `target_os = "linux"` 收紧为 `all(target_os = "linux", not(target_env = "ohos"))`（dragonfly/freebsd/netbsd/openbsd 同理）；**同时**将 `reveal_item_in_dir` / `reveal_items_in_dir` 函数体顶部的分发 cfg 追加 `not(target_env = "ohos")`（编译期隔离 zbus，OHOS 命令路径已短路不调用此同步函数）。**不**新增 `#[cfg(target_env = "ohos")] mod imp`——OHOS reveal 逻辑在命令体。
- 修改 `plugins-workspace/plugins/opener/src/error.rs`：`Zbus` variant 的 cfg 追加 `not(target_env = "ohos")`；新增 `#[cfg(target_env = "ohos")] #[error("OpenHarmony ability error: {0}")] OpenharmonyAbility(String)` 变体。澄清：openharmony-ability 公开 API 返回 `napi_ohos::Error`（非 `AbilityError`，后者仅内部主线程校验用），`tauri::Error` 无 `From<napi_ohos::Error>` 实现，故不经 `Tauri` 变体透传，改用字符串变体 + `.map_err(|e| Error::OpenharmonyAbility(e.to_string()))`，opener 无需显式依赖 napi_ohos。
- 修改 `plugins-workspace/plugins/opener/Cargo.toml`：将 `Cargo.toml:47` 的 linux/BSD target-dep gate 收紧为 `cfg(all(any(target_os = "linux", ...), not(target_env = "ohos")))`，使 `zbus` 与 `url` 同时从 OHOS 编译图移除（铁律 #3，仅改代码级 cfg 不足）；新增 `[target.'cfg(target_env = "ohos")'.dependencies]` 段声明 `openharmony-ability = { workspace = true }` 与 `url = { workspace = true }`。`url` 重声明非死依赖：`commands.rs` 的 OHOS cfg 分支有两处新增引用——`open_path` 与 `reveal_item_in_dir` 命令体的 `url::Url::from_file_path(path|parent)` 路径→`file://` URI 转换（当前源码这两处尚不存在，系本次新增，故审计基于现状核对看不到引用）。实现时 MUST 核对 OHOS cfg 分支内确有 `url::` 引用，若实现变更导致不再引用则删除该声明（响应审计"实现时确认"建议）；`[package.metadata.platforms.support]` 增加 `ohos = { level = "partial", notes = "reveal_item_in_dir degrades to opening parent directory; 'open with' ignored" }`。
- ACL/scope 行为不变：opener permissions 的 allow/deny 仍由 `CommandScope`/`GlobalScope` 在命令入口校验，OHOS 上反序列化路径与其他平台一致。`commands.rs` 仅新增 `#[cfg(target_env = "ohos")]` 命令体分支，**不**修改 scope 校验逻辑、命令签名或参数反序列化（不修改 `scope.rs` / `scope_entry.rs`）。

## Capabilities

### New Capabilities
- `opener-ohos-platform`: opener 插件在 OHOS（desktop + mobile 通用）上经 `openharmony-ability` NAPI 桥接 ArkTS `startAbility(Want{action:'ohos.want.action.viewData'})` 实现 `open_url` / `open_path` / `reveal_item_in_dir`（后者降级为打开父目录），并通过 `cfg(target_env = "ohos")` 隔离，不影响其他平台。

### Modified Capabilities
<!-- 无既有 spec-level 行为变更。本变更仅新增 OHOS 平台实现并修复 cfg 隔离，不改变 opener 的命令签名、权限模型或前端 JS API。 -->

## Impact

- **代码**：`openharmony-ability`（新增 2 个 NAPI 函数 + 对应 ArkTS 封装）；`plugins-workspace/plugins/opener/src/commands.rs`、`reveal_item_in_dir.rs`、`error.rs`、`Cargo.toml`；`lib.rs` 仅在需要时调整 Builder（预计无改动）。
- **依赖**：opener 插件在 OHOS target 上新增 `openharmony-ability`（workspace 内 crate，非外部依赖）与 `url`（纯 Rust，重新声明在 OHOS target-dep 段，供 OHOS 分支 `Url::from_file_path` 路径→URI 转换使用，非死依赖）；不新增外部 crate。`zbus` 通过 Cargo.toml target-dep gate 收紧（`not(target_env = "ohos")`）不再进入 OHOS 编译图；`url` 从 linux gate 移除后在 OHOS gate 重新声明。实现时核对 OHOS 分支实际引用 `url::`，否则删除重声明。
- **平台**：OHOS desktop + mobile（`open_url`/`open_path` 通用；`reveal_item_in_dir` 通用降级）。Windows/macOS/Linux/Android/iOS 路径字节级不变（铁律 #2/#3）。
- **ACL**：opener permissions / scope 反序列化路径不变，跨平台行为一致。
- **验证**：`cargo check --target aarch64-linux-ohos -p tauri-plugin-opener` 通过；非 OHOS 目标回归通过；设备端三命令端到端验证。
