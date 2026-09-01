## Context

`tauri-plugin-opener` v2.5.4 的三个命令在 OHOS desktop 上全部失败：

- `open_url` / `open_path` → 底层 `crate::open::open()` 调用 `open` crate v5。该 crate 在 `target_os = "linux"`（OHOS 的 `target_os` 即 `"linux"`）时尝试 `xdg-open` / `gio open` / `gvfs-open` / `wslview`，这些可执行文件在 OHOS 上均不存在 → 返回 `io::Error`（`No such file or directory`）。
- `reveal_item_in_dir` → `reveal_item_in_dir.rs` 的 `imp` 模块 cfg 门控为 `cfg(any(target_os = "linux", target_os = "dragonfly", ...))`，OHOS 命中 `target_os = "linux"` 分支，编译进 zbus (D-Bus) 实现。zbus 需要 session bus（OHOS 无 D-Bus），且 `zbus` / `url` 作为 Linux 依赖进入 OHOS 编译图，**违反铁律 #3**（Linux 依赖必须 `not(target_env = "ohos")` 排除）。

用户报告的 `"unexpected invoke body"` 是表象错误。经核查：opener 的 `CommandScope<Entry>` / `GlobalScope<Entry>` 是 `CommandArg`，从 ACL resolved scope（`scope_id` → `get_command_scope_typed` → `Entry::deserialize`）解析，**不**从 invoke body 反序列化；`Application` enum 的 `#[serde(untagged)]` 作用于 ACL 配置 Value，跨平台一致。OHOS 上 invoke body 经 postMessage IPC（`handle_ipc_message` → `Message { payload: serde_json::Value }`）正常投递，`path`/`with`/`paths` 参数反序列化路径与其他平台相同。失败发生在参数解析之后的平台执行层（`open` crate / zbus）。

OHOS 系统能力映射：打开 URL/文件用 `UIAbilityContext.startAbility(Want{ action: 'ohos.want.action.viewData', uri, entities: ['entity.system.browsable'] })`（`ohos.want.action.viewData` 是 OHOS 标准 `wantConstant.Action.VIEW_DATA` 常量值；`ohos.want.action.view` 非标准常量，arkts-helper 语料中唯一出现的 `ohos.want.action.*` 形式为 `viewData`，配合 `entity.system.browsable` 拉起浏览器打开 URL）；"在文件夹中选中文件"无对应系统 API（无 `SHOpenFolderAndSelectItems` 等价），只能降级为打开父目录。

openharmony-ability 已有 TSFN + ArkTS helper 桥接模式（见 `helper/autostart.rs`：TSFN 在 ability init 时创建，回调内 `helper.get_named_property("autostartEnable").call(...)`，`callee_handled::<false>()`）。本设计沿用该模式。

## Goals / Non-Goals

**Goals:**
- `open_url(url)` / `open_path(path)` 在 OHOS desktop+mobile 上用系统默认应用打开（经 `openharmony-ability` NAPI → ArkTS `startAbility`）。
- `reveal_item_in_dir(path)` 在 OHOS 上降级为"用文件管理器打开父目录"，平台差异在文档与 spec 显式标注。
- 修复 `reveal_item_in_dir.rs` / `error.rs` 的 cfg 门控，将 OHOS 从 Linux/zbus 分支排除（铁律 #3）。
- 所有 OHOS 代码用 `cfg(target_env = "ohos")` 隔离，不影响其他平台（铁律 #2）。
- ACL/scope 行为不变（opener permissions 的 allow/deny 仍生效）。

**Non-Goals:**
- 不在 OHOS 上支持 `with`（指定程序打开）参数——与 Android/iOS 一致忽略，文档标注。
- 不实现"在文件管理器中选中指定文件"——OHOS 无此 API，留作未来 P2。
- 不修改 `scope.rs` / `scope_entry.rs` / 前端 JS API（`commands.rs` 仅新增 `#[cfg(target_env = "ohos")]` 命令体分支，不改 scope 校验逻辑、命令签名或参数反序列化）。
- 不替换 `open` crate 上游实现（OHOS 分支在 opener 插件内短路，不进入 `open` crate）。
- 不为 `reveal_item_in_dir` 的多文件批量选中做额外优化（OHOS 降级只打开第一个父目录）。

## Decisions

### Decision 1: 在 openharmony-ability 新增 2 个 NAPI，而非扩展 `open` crate

**选择**：在 `openharmony-ability/crates/ability/src/helper/` 新增 `opener.rs`（或并入现有 helper 模块），定义两个 TSFN + 两个 `pub async fn`：
- `open_with_system(uri: String) -> napi_ohos::Result<()>`（async）：ArkTS 侧 `helper.openWithSystem(uri)` → `context.startAbility({ action: 'ohos.want.action.viewData', uri, entities: ['entity.system.browsable'] })`。
- `reveal_in_dir(dir_uri: String) -> napi_ohos::Result<()>`（async）：ArkTS 侧 `helper.revealInDir(dirUri)` → `context.startAbility({ action: 'ohos.want.action.viewData', uri: dir_uri })`（拉起文件管理器打开目录；`viewData` 为 OHOS 标准常量，reveal 场景是否需附加 entities 或改用其他 action 需设备端验证，见 Open Questions）。

ArkTS helper（`package/index.ets` 或 helper 对象）新增 `openWithSystem(uri: string): Promise<void>` 与 `revealInDir(dirUri: string): Promise<void>` 方法，内部 `this.context.startAbility(want)`。

**备选 A（patch `open` crate 加 OHOS 后端）**：否决——`open` crate 是外部依赖，patch 不可移植；且 OHOS 需 ArkTS 桥接，必须经 openharmony-ability（铁律 #1），`open` crate 无法直接调用 NAPI。

**备选 B（opener 插件内直接 `std::process::Command` 调 OHOS shell）**：否决——OHOS 无 `xdg-open` 等可执行文件；且系统应用拉起必须经 `startAbility`，shell 不可达。

### Decision 2: TSFN 参数传递用 `FnArgs<(String,)>` + await Promise（沿用 autostart 模式）

TSFN 回调签名 `Function<'a, FnArgs<(String,)>, Unknown<'a>>`，调用 `fn_ref.call(FnArgs { data: (uri,) })`。**禁止**裸 tuple（会序列化为 JS Array，JS 侧收到数组而非展开参数）。`callee_handled::<false>()`（约束 2.2：`true` 会插入 null 导致参数偏移）。回调返回 `Unknown`（即 ArkTS `startAbility` 返回的 Promise）。

**采用 await Promise 模式（与 `helper/autostart.rs` + `autostart.rs` 一致），否决 fire-and-forget**。理由：

- spec 的 "open_path 无匹配应用" 场景要求后端回传 ArkTS reject 原因；fire-and-forget 无法捕获 reject，命令会立即 resolve Ok，与 spec 自相矛盾。
- 已有 `AutostartManager::enable()` 真实模式为 `call_with_return_value` + `oneshot::channel` + `tokio::time::timeout` await Promise，reject 经 `promise.catch` → `coerce_to_string` → `send_once(Err(msg))` 回传。本设计沿用该模式，不发明新模式。
- `open::that_detached` 的 "detached" 语义在 OHOS 上不等价（OHOS 无子进程，`startAbility` 是异步能力拉起，其 Promise resolve/reject 反映 ability 是否成功调起，应当等待）。

**接线**：`openharmony-ability` 暴露 `pub async fn open_with_system(uri: String) -> napi_ohos::Result<()>` 与 `pub async fn reveal_in_dir(dir_uri: String) -> napi_ohos::Result<()>`，内部 `tsfn.call_with_return_value(FnArgs { data: (uri,) }, NonBlocking, |result, env| { ... handle_void_promise(...) ... })` + `timeout(Duration::from_secs(10), rx)`（复用 `autostart.rs` 的 `handle_void_promise` / `send_once` 辅助函数，或提取到公共模块）。reject 字符串经 `Error::from_reason(msg)` 返回。

**禁止 `block_on` 桥接**：opener 的三个命令 `open_url` / `open_path` / `reveal_item_in_dir` 本身是 `async fn`（见 `commands.rs:14`/`43`/`73`），tauri 在 tokio worker 线程上 poll 命令 future。若在命令体内用 `tauri::async_runtime::block_on(openharmony_ability::open_with_system(uri))` 桥接 NAPI async 调用，`block_on` 会在已处于 tokio runtime 内的 worker 线程上 panic（`"Cannot block the current thread from within a runtime"`）——这是约束 1.2 之外的另一类线程错误，与 `run_on_main_thread + recv()` 死锁无关，不能用"不在 ArkTS 主线程"论证安全。

**修复方案**：OHOS 分支直接在命令体 `#[cfg(target_env = "ohos")]` 内 `.await` NAPI 调用，**不经过**同步 `open()` / `reveal_items_in_dir()`，**不使用** `block_on`。即在 `open_url` / `open_path` / `reveal_item_in_dir` 命令体顶部插入 `#[cfg(target_env = "ohos")] { ... openharmony_ability::open_with_system(uri).await ... return Ok(()); }` 短路返回；非 OHOS 平台走原有同步路径（`app.opener().open_url()` / `crate::reveal_items_in_dir()`）。同步 `open()`（`open.rs`）与同步 `reveal_items_in_dir()`（`reveal_item_in_dir.rs`）在 OHOS 命令路径上不被调用，故**不**为它们新增 `#[cfg(target_env = "ohos")]` 分支（若从 Rust setup 直接调用同步 `open_url`/`open_path` 公开 API，仍走 `open` crate 失败路径，属 Non-Goal，不在本次修复范围）。路径→`file://` URI 转换、`parent()` 取父目录、canonicalize 均在命令体的 OHOS 分支内完成（见 Decision 3/4/7）。

### Decision 3: 路径 → `file://` URI 转换在命令体 OHOS 分支完成

`open_path` 命令收到的是平台路径字符串。OHOS 上 `startAbility` 的 `uri` 需 `file://` scheme。在 `open_path` 命令体的 `#[cfg(target_env = "ohos")]` 分支内用 `url::Url::from_file_path(&path)` 转换（这是 OHOS 分支引用 `url` crate 的两处之一，另一处在 Decision 4 的 reveal 父目录转换；两处均位于 `commands.rs` 的 OHOS cfg 分支内）。`url` 是纯 Rust crate（无平台依赖），经 Decision 5 的 Cargo.toml gate 修复后，从 linux gate 移除并在新增的 `[target.'cfg(target_env = "ohos")'.dependencies]` 段重新声明，故 OHOS target 可用。若 `path` 本身已是 URL（`open_url` 命令路径），`open_url` 的 OHOS 分支直接透传字符串给 `open_with_system(uri).await`，不做转换。

**边界**：`open_path` 命令的 OHOS 分支不调用 `path.metadata()` 校验存在性（Linux/macOS 分支会校验），因为 OHOS 沙箱路径语义不同；交由 `startAbility` 失败时返回错误。

### Decision 4: `reveal_item_in_dir` 降级语义——打开父目录（命令体 OHOS 分支）

OHOS 无"选中文件"API。降级策略在 `reveal_item_in_dir` 命令体的 `#[cfg(target_env = "ohos")]` 分支内执行：`paths[0].canonicalize()`? → `path.parent()` 取父目录 → `Url::from_file_path(parent)` → `openharmony_ability::reveal_in_dir(dir_uri).await` 拉起文件管理器（此处 `Url::from_file_path` 是 OHOS 分支引用 `url` crate 的第二处，第一处在 Decision 3 的 `open_path` 命令分支；两处均在 `commands.rs` 的 OHOS cfg 分支内）。若 `path.parent()` 为 None（根路径），返回 `Error::NoParent`（复用现有 windows 变体语义）。多文件 `reveal_item_in_dir` 命令在 OHOS 上取第一个文件的父目录（批量选中不支持，文档标注）。**不**调用同步 `crate::reveal_items_in_dir()`（避免同步函数在 OHOS 上落入 zbus 分支或需另加 cfg 分支）。

### Decision 5: cfg 门控修复 + Cargo.toml target-dep gate 修复

**代码级 cfg（reveal_item_in_dir.rs / error.rs）**：

- `reveal_item_in_dir.rs` 的 `imp` 模块 cfg：`target_os = "linux"` → `all(target_os = "linux", not(target_env = "ohos"))`；dragonfly/freebsd/netbsd/openbsd 同理追加 `not(target_env = "ohos")`（守卫一致性，虽这些 BSD 不会触发 OHOS）。同时 `reveal_item_in_dir` / `reveal_items_in_dir` 函数体顶部的分发 cfg `any(windows, target_os = "macos", target_os = "linux", ...)` 也 MUST 追加 `not(target_env = "ohos")`（否则 OHOS 命中 `target_os = "linux"` 分发到 zbus `imp`；OHOS 命令路径虽已短路不调用此同步函数，但 cfg 仍须正确以避免编译进 zbus 代码）。**不**为 `reveal_item_in_dir.rs` 新增 `#[cfg(target_env = "ohos")] mod imp`——OHOS reveal 逻辑在命令体（Decision 4），同步 `reveal_items_in_dir()` 在 OHOS 上不被命令路径调用。
- `error.rs`：`Zbus` variant cfg 追加 `not(target_env = "ohos")`。
- **不**为 `open.rs` 的同步 `open()` 函数新增 `#[cfg(target_env = "ohos")]` 分支——OHOS open 逻辑在 `open_url` / `open_path` 命令体（Decision 2/3），同步 `open()` 在 OHOS 上不被命令路径调用。`open.rs` 不引入 `url::` 引用（路径→URI 转换在 `commands.rs` 的 OHOS 分支内）。

**Cargo.toml target-dep gate 修复（铁律 #3，Issue 1）**：

`plugins/opener/Cargo.toml:47` 现有 gate `[target.'cfg(any(target_os = "linux", target_os = "dragonfly", target_os = "freebsd", target_os = "netbsd", target_os = "openbsd"))'.dependencies]` 同时引入 `zbus` 与 `url`。该 gate 在 OHOS 上为真（`target_os = "linux"`），导致 `zbus` 进入 OHOS 编译图，违反铁律 #3 与 spec "zbus 不出现在 OHOS 依赖图"。tasks 2.1/2.2 仅修改代码级 cfg，未改此 Cargo.toml gate，**不足以隔离**。

MUST 将该 gate 收紧为 `cfg(all(any(target_os = "linux", target_os = "dragonfly", target_os = "freebsd", target_os = "netbsd", target_os = "openbsd"), not(target_env = "ohos")))`，使 `zbus` 与 `url` 同时从 OHOS 编译图移除。

`url` 是纯 Rust crate（无平台依赖），OHOS 分支**确实引用**它，共两处（非死依赖，均位于 `commands.rs` 的 `#[cfg(target_env = "ohos")]` 分支内）：
1. **`open_path` 命令的 OHOS 分支**（Decision 3）：`url::Url::from_file_path(path)` 将平台路径转为 `file://` URI 传入 `open_with_system(uri).await`。
2. **`reveal_item_in_dir` 命令的 OHOS 分支**（Decision 4）：`paths[0].parent()` 取父目录后同样用 `Url::from_file_path(parent)` 转 URI 传入 `reveal_in_dir(dir_uri).await`。

审计意见指出：源码核对显示 `url` 仅在 `reveal_item_in_dir.rs` L235/L260 的 linux/BSD 分支内使用（该分支正被 OHOS 排除），故 `url` 重声明必要性存疑。上述两处 OHOS 分支引用正是必要性的来源——它们是**本次新增**的代码（位于 `commands.rs`，不在当前源码中），因此审计基于现状的核对看不到。`open.rs` 与 `reveal_item_in_dir.rs` 均不引入 OHOS 专属的 `url::` 引用。

因此在新增的 `[target.'cfg(target_env = "ohos")'.dependencies]` 下重新声明 `url = { workspace = true }`（与 `openharmony-ability = { workspace = true }` 并列）。这会在非 OHOS 的 Linux target 上与原 gate 重复声明 `url`，但 Cargo 允许同 crate 多 target 声明（不冲突、不重复计入依赖图），可接受。

**实现时核对（响应审计建议）**：实现完成后 MUST 执行 `grep -rn "url::" plugins-workspace/plugins/opener/src/ --include="*.rs"` 或等价检查，确认 `commands.rs` 的 `#[cfg(target_env = "ohos")]` 分支内确有 `url::Url::from_file_path` 引用。若实现变更导致 OHOS 分支不再引用 `url`（例如改用手工拼 `file://` 字符串），则 MUST 删除该重声明，避免死依赖。tasks 3.4 与 spec "url 依赖必要性核对" 场景落实此核对。

**错误类型接线（Issue 3）**：

澄清：`openharmony-ability` 公开 API（如 `AutostartManager::enable`、新增的 `open_with_system`）返回 `napi_ohos::Result<()>`，错误类型是 **`napi_ohos::Error`**（经 `Error::from_reason(String)` 构造），**不是** `AbilityError`。`AbilityError`（`crates/ability/src/error.rs`）仅用于内部 "OnlyRunWithMainThread" 主线程校验，不作为跨 crate 公开错误返回。`tauri::Error` **没有** `From<napi_ohos::Error>` 实现（tauri crate 不依赖 napi_ohos 的错误转换），故原 Decision 5 "经 `#[from] tauri::Error` 透传 `openharmony_ability::Error`" 的链路不存在。

采用方案：在 opener `error.rs` 新增专用字符串变体：

```rust
#[cfg(target_env = "ohos")]
#[error("OpenHarmony ability error: {0}")]
OpenharmonyAbility(String),
```

OHOS 分支映射：`openharmony_ability::open_with_system(uri).map_err(|e| crate::Error::OpenharmonyAbility(e.to_string()))`。`napi_ohos::Error` 实现 `Display`，`.to_string()` 在调用端可用，opener 无需直接依赖 `napi_ohos`（类型经 openharmony-ability 返回值进入作用域，`Display` 是 prelude trait）。不使用 `#[from]`（避免 opener 显式依赖 napi_ohos crate）。`#[non_exhaustive]` 枚举新增 cfg 变体不破坏现有匹配。

### Decision 6: `open` crate 在 OHOS target 仍保留依赖但不被调用

`Cargo.toml` 中 `open = { version = "5", ... }` 是无 target 限定依赖，OHOS 上仍编译但不调用（`open.rs` 的 OHOS 分支短路）。`open` crate v5 在 OHOS 上能否编译需验证（它对 linux 调 `std::process::Command`，纯 std，应可编译）。若不能编译，再加 `cfg(not(target_env = "ohos"))` 限定——留作验证阶段决策。注意：`open` crate 自身不引入 zbus/url（那些是 opener 直接依赖），故其无 target 限定不违反铁律 #3。

### Decision 7: `reveal_item_in_dir` 的 canonicalize 约束（命令体 OHOS 分支，次要，文档标注）

原同步 `reveal_items_in_dir()` 在 cfg 分发**之前**先调 `canonicalize(path)`（非 windows 走 `std::fs::canonicalize`），路径不存在即返回 `io::Error`。OHOS 命令路径不再调用该同步函数（Decision 4 在命令体 OHOS 分支短路），为保留"路径不存在先返回 `Io` 错误、不到达 NAPI"的行为一致性，命令体的 OHOS 分支 MUST 对 `paths[0]` 显式调用 `canonicalize()`（或 `std::fs::canonicalize`），失败即返回 `Error::Io`，与 Linux/macOS 行为一致。design 此前仅声明 `open_path` 跳过 `metadata()` 校验，未说明 reveal 仍受 canonicalize 约束。spec 场景假设路径存在，可接受，但在此显式注明：OHOS 上 reveal 的错误返回包含 canonicalize 失败的 `Io` 变体路径（与 Linux/macOS 一致），`open_path` 跳过 metadata 校验是 OHOS 独有差异。

## Risks / Trade-offs

- **[风险] `open` crate v5 在 `aarch64-linux-ohos` 编译失败** → 缓解：先 `cargo check` 验证；若失败，将 `open` 依赖改为 `cfg(not(target_env = "ohos"))` 限定，OHOS 分支完全不引用 `::open`。
- **[风险] TSFN 参数传递踩坑（裸 tuple / callee_handled=true）** → 缓解：严格按约束 2.2 用 `FnArgs<(String,)>` + `callee_handled::<false>()`，参考 `p1-window-vibrancy` 的 `set_window_blur` 教训。
- **[风险] `startAbility` 在无匹配 ability 时 reject** → 缓解：await Promise 模式（Decision 2）经 `promise.catch` → `coerce_to_string` 捕获 reject 原因，经 `oneshot` 回传 Rust，最终映射为 `Error::OpenharmonyAbility(msg)` 返回前端。注意约束 2.3：被 NAPI 调的 ArkTS 函数内部禁用 hilog（会抛 Argc mismatch），reject 文本由 `promise.catch` 的 `coerce_to_string` 提取，不依赖 hilog。
- **[风险] `file://` URI 在 OHOS 沙箱下不被文件管理器识别** → 缓解：OHOS 文件管理器接受 `file://docs/storage/...` 形式；设备端验证；若不识别，降级为返回 `UnsupportedPlatform` 而非崩溃。
- **[权衡] `reveal_item_in_dir` 降级为打开父目录** → 用户体验弱于 Windows/macOS（不选中文件），但 OHOS 系统层无此能力，属合理降级；spec 显式标注。
- **[权衡] `with` 参数忽略** → 与 Android/iOS 一致，前端 JS API 不变，文档标注 OHOS 行为。
- **[风险] helper 对象未就绪时 TSFN 调用** → 缓解：沿用 autostart 模式，TSFN 在 ability init（`render/xcomponent.rs`）时创建；opener 调用发生在 webview 加载后，helper 必已就绪。

## Migration Plan

1. 合并后，OHOS 构建者重建 openharmony-ability HAR（`ohrs build --arch arm64` + `pack.sh` + HAP 重建），使新增 NAPI 与 ArkTS helper 方法生效。
2. `cargo check --target aarch64-linux-ohos -p tauri-plugin-opener` 验证编译。
3. 设备端验证三命令。
4. 回滚：还原 `commands.rs` / `reveal_item_in_dir.rs` / `error.rs` / `Cargo.toml` 与 openharmony-ability 新增文件，无数据迁移。

## Open Questions

- `open` crate v5 是否在 `aarch64-linux-ohos` 干净编译？需验证（Decision 6）。
- OHOS 文件管理器对 `file://` 父目录 URI 的实际接受格式（沙箱路径前缀）需设备端确认。
- 是否需要为 OHOS 单独申请 `ohos.permission.START_ABILITY` 类权限（通常系统 ability 调起无需额外权限，但需确认）。
- **Want action 常量准确性**：`openWithSystem` 用 `ohos.want.action.viewData`（标准 `wantConstant.Action.VIEW_DATA`）+ `entity.system.browsable` 拉起浏览器打开 URL，与 arkts-helper 语料一致。`reveal_in_dir` 同样使用 `viewData` 拉起文件管理器，但 arkts-helper 语料中无目录场景的直接用例，需在设备端验证该 action 能否解析到文件管理器 ability；若不能，需在设备端确认正确的 action（如 `ohos.want.action.get_data` 或文件管理器专属 action）后再定稿。

---

## 实现期补充修复 (2026-07-21，手动测试阶段)

OHOS impl（open_with_system / reveal_in_dir）落地后，手动测试 `openPath` 仍报 `Not allowed to open path`。经 `[fs-scope-dbg]` 调试日志确认：`fs_scope.is_allowed`（条件1）= true（opener 的 `$APPCACHE/*` 字面量模式匹配，OHOS bind-mount 对 canonicalize 透明不报错），拒绝纯粹来自**条件2 `matches_path_program`**。

**根因 = capability 配置 `app: "default"` 的 serde 反序列化**：opener `Application` 枚举 `#[serde(untagged)]`（Default=无值/null、Enable(bool)、App(String)），`"app": "default"` 是字符串 → 反序列化成 `Application::App("default")`（把 "default" 当 app 名），**不是** `Application::Default` → `matches_path_program(with=None)` = `App("default").matches(None)` = `Some("default")==None` = **false** → `is_path_allowed` false → `ForbiddenPath`。

> 注：原 plan 中"`Application` enum/scope 反序列化非根因"是针对原始 "unexpected invoke body"（open crate xdg-open 失败）问题——那个确实非 scope 问题。`app: "default"` 是独立的、后续手动测试才暴露的 scope 配置问题，二者不矛盾。

**修复（最小改动，测试 app 配置层）**：`examples/api/src-tauri/capabilities/run-app.json` 把 `opener:allow-open-path` 的 `allow: [{"path":"$APPCACHE/*","app":"default"}]` 改为 `[{"path":"$APPCACHE/*"}]`（去掉 `app`，`#[serde(default)]` → `Application::Default` → 匹配 None=true）。tauri 核心 fs.rs 无改动（曾尝试 OHOS 跳过 canonicalize，后经调试日志证明 condition1 本就 true，已还原）。

验证：hilog `[ManualTest] openPath(...) called.` + `Completed in 68ms`，无 ForbiddenPath；设备端直接打开文件。revealItemInDir 走系统 intent 弹"选择打开方式"（目录 URI，OHOS 无桌面式"在文件管理器中定位"，属正常降级）。

### Review 修复 (2026-07-22)
- `open_path` OHOS 分支:canonicalize 路径后再转 `file://` URI(对齐 `reveal_item_in_dir`,相对路径不再 `InvalidPath`)。
- `reveal_item_in_dir` OHOS 分支:文档化**单路径限制**——OHOS 无多文件"reveal/select" API,startAbility(viewData) on 目录 URI 只开一个选择器,故只处理 `paths.first()`,其余路径忽略(非 OHOS `crate::reveal_items_in_dir` 处理全部路径)。
