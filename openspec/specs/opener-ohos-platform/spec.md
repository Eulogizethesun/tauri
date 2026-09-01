# opener-ohos-platform Specification

## Purpose
TBD - created by archiving change p1-opener-ohos-fix. Update Purpose after archive.
## Requirements
### Requirement: OHOS 平台 open_url 实现

`tauri-plugin-opener` 在 `cfg(target_env = "ohos")` 上 SHALL 经 `openharmony-ability` NAPI 桥接 ArkTS `UIAbilityContext.startAbility(Want{ action: 'ohos.want.action.viewData', uri, entities: ['entity.system.browsable'] })` 实现 `open_url`，使系统默认浏览器/应用打开 URL（`ohos.want.action.viewData` 为 OHOS 标准 `wantConstant.Action.VIEW_DATA` 常量值；`ohos.want.action.view` 非标准常量，不得使用）。`with`（指定程序）参数在 OHOS 上 SHALL 被忽略（与 Android/iOS 一致）。

#### Scenario: open_url 调起系统浏览器
- **WHEN** 前端调用 `invoke('plugin:opener|open_url', { url: 'https://github.com/tauri-apps/tauri', with: undefined })` 于 OHOS desktop
- **THEN** 后端经 ACL scope 校验通过后，调用 `openharmony-ability::open_with_system("https://github.com/tauri-apps/tauri")`，ArkTS 侧 `startAbility` 拉起系统默认浏览器打开该 URL，命令 resolve 成功

#### Scenario: open_url 被 scope 拒绝
- **WHEN** 前端调用 `open_url` 传入未在 opener permissions allow 列表中的 URL
- **THEN** 后端返回 `ForbiddenUrl` 错误，**不**调用 `openharmony-ability` NAPI（scope 校验先于平台执行，行为与 Windows/macOS 一致）

#### Scenario: with 参数忽略
- **WHEN** 前端调用 `open_url('https://...', 'firefox')` 于 OHOS
- **THEN** 系统默认浏览器打开 URL，`with: 'firefox'` 被静默忽略，命令成功

### Requirement: OHOS 平台 open_path 实现

`tauri-plugin-opener` 在 OHOS 上 SHALL 将 `path` 转为 `file://` URI 后经 `openharmony-ability::open_with_system` 拉起系统默认应用打开。`with` 参数 SHALL 被忽略。

#### Scenario: open_path 打开文件
- **WHEN** 前端调用 `invoke('plugin:opener|open_path', { path: '/data/storage/users/current/files/doc.txt', with: undefined })` 于 OHOS
- **THEN** 后端将 path 转为 `file://` URI，调用 NAPI，系统默认应用打开该文件，命令成功

#### Scenario: open_path 无匹配应用
- **WHEN** OHOS 上无应用能处理该文件类型，`startAbility` 返回的 Promise reject
- **THEN** 后端 await Promise 模式经 `promise.catch` 捕获 reject 原因，映射为 `Error::OpenharmonyAbility(reject_msg)` 返回，前端 invoke reject（**不**采用 fire-and-forget，否则 reject 无法捕获、命令会误 resolve Ok）

### Requirement: OHOS 平台 reveal_item_in_dir 降级实现

`reveal_item_in_dir` 在 OHOS 上 SHALL 降级为"用文件管理器打开父目录"（OHOS 无"选中文件"系统 API）。多文件 `reveal_items_in_dir` SHALL 取第一个文件的父目录。

#### Scenario: reveal_item_in_dir 打开父目录
- **WHEN** 前端调用 `invoke('plugin:opener|reveal_item_in_dir', { paths: ['/data/storage/users/current/files/doc.txt'] })` 于 OHOS
- **THEN** 后端取 `path.parent()`，转 `file://` URI，调用 `openharmony-ability::reveal_in_dir(dir_uri)`，文件管理器打开父目录（不选中文件），命令成功

#### Scenario: reveal_item_in_dir 根路径无父目录
- **WHEN** 传入路径的 `parent()` 为 None
- **THEN** 后端返回 `NoParent` 错误，不调用 NAPI

#### Scenario: reveal_items_in_dir 多文件降级
- **WHEN** 前端传入多个路径 `[a, b, c]` 于 OHOS
- **THEN** 后端取第一个文件 `a` 的父目录打开，不批量选中（平台差异，文档标注）

### Requirement: cfg 隔离——OHOS 不进入 Linux/zbus 实现

`reveal_item_in_dir.rs` 的 zbus/D-Bus `imp` 模块 cfg 门控 SHALL 排除 OHOS：`target_os = "linux"` 分支 MUST 改为 `all(target_os = "linux", not(target_env = "ohos"))`（dragonfly/freebsd/netbsd/openbsd 同理）。`reveal_item_in_dir` / `reveal_items_in_dir` 函数体顶部的分发 cfg `any(windows, target_os = "macos", target_os = "linux", ...)` MUST 同样追加 `not(target_env = "ohos")`，否则 OHOS 仍命中 `target_os = "linux"` 分发到 zbus `imp`。`error.rs` 的 `Zbus` variant cfg SHALL 同样排除 OHOS。**`Cargo.toml` 的 linux/BSD target-dep gate MUST 收紧为 `cfg(all(any(target_os = "linux", ...), not(target_env = "ohos")))`**，使 `zbus` 与 `url` 同时从 OHOS 编译图移除（仅改代码级 cfg 不足以隔离，因为 `target_os = "linux"` 在 OHOS 上为真）。`url` 作为纯 Rust crate 在新增的 `[target.'cfg(target_env = "ohos")'.dependencies]` 段重新声明，供 OHOS 分支使用。`zbus` SHALL 不进入 OHOS 编译图。

**`url` 重声明必要性（响应审计意见）**：`url` 重声明非死依赖——`commands.rs` 的 `#[cfg(target_env = "ohos")]` 分支内有两处新增 `url::Url::from_file_path` 引用：(1) `open_path` 命令 OHOS 分支的路径→`file://` URI 转换；(2) `reveal_item_in_dir` 命令 OHOS 分支的父目录→URI 转换。当前源码中 `url` 仅在 `reveal_item_in_dir.rs` L235/L260 的 linux/BSD 分支内使用（该分支正被 OHOS 排除），审计据此对重声明必要性存疑；上述两处 OHOS 引用系本次新增代码（位于 `commands.rs`，不在当前源码中）。实现完成后 MUST 核对 OHOS cfg 分支内确有 `url::` 引用；若实现变更导致 OHOS 分支不再引用 `url`，则 MUST 删除该重声明以避免死依赖。

#### Scenario: OHOS 编译不引入 zbus
- **WHEN** 执行 `cargo check --target aarch64-linux-ohos -p tauri-plugin-opener` 与 `cargo tree --target aarch64-linux-ohos -p tauri-plugin-opener`
- **THEN** 编译成功，`zbus` 不出现在 OHOS 依赖图（`cargo tree` 输出无 zbus），不编译 D-Bus 代码

#### Scenario: Linux 回归不受影响
- **WHEN** 执行 `cargo check --target x86_64-unknown-linux-gnu -p tauri-plugin-opener`
- **THEN** zbus Linux 实现照常编译，行为不变

#### Scenario: url 依赖必要性核对
- **WHEN** 实现完成后执行 `grep -rn "url::" plugins-workspace/plugins/opener/src/ --include="*.rs"` 检查 OHOS cfg 分支内的 `url::Url::from_file_path` 引用
- **THEN** 至少一处 `url::` 引用位于 `commands.rs` 的 `#[cfg(target_env = "ohos")]` 分支内（`open_path` 命令分支与/或 `reveal_item_in_dir` 命令分支），`url` 重声明为活依赖；若 OHOS 分支内无任何 `url::` 引用，则 MUST 从 `[target.'cfg(target_env = "ohos")'.dependencies]` 删除 `url` 声明，且 `cargo check --target aarch64-linux-ohos -p tauri-plugin-opener` 仍退出码 0

### Requirement: OHOS 错误类型接线

OHOS 分支的错误 SHALL 经 opener `Error` 枚举新增的 `#[cfg(target_env = "ohos")] OpenharmonyAbility(String)` 变体返回。`openharmony-ability` 公开 API 返回 `napi_ohos::Error`（经 `Error::from_reason(String)` 构造），**非** `AbilityError`（后者仅 openharmony-ability 内部主线程校验用，不跨 crate 返回）。opener SHALL 用 `.map_err(|e| Error::OpenharmonyAbility(e.to_string()))` 映射，**不**经 `tauri::Error` 透传（`tauri::Error` 无 `From<napi_ohos::Error>` 实现），**不**使用 `#[from]`（避免 opener 显式依赖 napi_ohos crate）。`napi_ohos::Error` 实现 `Display`，`.to_string()` 在调用端可用。

#### Scenario: startAbility reject 错误回传
- **WHEN** `openharmony-ability::open_with_system` 返回 `Err(napi_ohos::Error)`（reject 原因已由 `promise.catch` → `Error::from_reason` 封装）
- **THEN** opener 将其映射为 `Error::OpenharmonyAbility(msg)`，前端 invoke reject 收到该错误字符串

### Requirement: await Promise 模式（非 fire-and-forget，禁止 block_on）

`open_with_system` / `reveal_in_dir` 的 Rust 实现 SHALL 采用 `call_with_return_value` + `oneshot::channel` + `tokio::time::timeout` await ArkTS `startAbility` 返回的 Promise（与 `AutostartManager::enable` 一致），**非** fire-and-forget。opener 的三个命令 `open_url` / `open_path` / `reveal_item_in_dir` 本身是 `async fn`，tauri 在 tokio worker 线程上 poll 命令 future。OHOS 分支 SHALL 直接在命令体 `#[cfg(target_env = "ohos")]` 内 `.await` 该 async NAPI 调用。**禁止** `tauri::async_runtime::block_on(...)` 桥接——`block_on` 在 tokio runtime worker 线程内会 panic（`"Cannot block the current thread from within a runtime"`），此与约束 1.2 的 `run_on_main_thread + recv()` 死锁无关，不得以"不在 ArkTS 主线程"为由使用。同步 `open()` / `reveal_items_in_dir()` 在 OHOS 命令路径上 SHALL NOT 被调用。

#### Scenario: 命令正常 resolve
- **WHEN** `startAbility` Promise resolve
- **THEN** Rust 侧 await 完成，命令 resolve Ok

#### Scenario: Promise 超时
- **WHEN** `startAbility` Promise 10 秒内未 resolve/reject
- **THEN** Rust 侧 `tokio::time::timeout` 触发，返回 `Error::OpenharmonyAbility("... timed out")`，前端 invoke reject

### Requirement: reveal 仍受 canonicalize 约束（命令体 OHOS 分支）

原同步 `reveal_items_in_dir()` 在 cfg 分发前先调 `canonicalize(path)`（非 windows 走 `std::fs::canonicalize`）。OHOS 命令路径不再调用该同步函数（在 `reveal_item_in_dir` 命令体 OHOS 分支短路），为保留行为一致性，命令体的 OHOS 分支 SHALL 对 `paths[0]` 显式调 `canonicalize()`，失败即返回 `Error::Io`。因此 OHOS 上 reveal 传入不存在的路径 SHALL 先返回 `Error::Io`（与 Linux/macOS 一致），不到达 NAPI。此行为与 `open_path` 命令（OHOS 跳过 `metadata()` 校验）不同，平台差异在 `design.md` 显式标注。

#### Scenario: reveal 不存在路径
- **WHEN** 前端调用 `reveal_item_in_dir('/nonexistent/path')` 于 OHOS
- **THEN** 后端在 canonicalize 阶段返回 `Io` 错误，不调用 `openharmony-ability::reveal_in_dir`

### Requirement: 其他平台零影响

所有 OHOS 新增代码 MUST 用 `cfg(target_env = "ohos")` 隔离。Windows/macOS/Linux/Android/iOS 的命令执行路径、cfg 分支、依赖图 SHALL 字节级不变。

#### Scenario: Windows/macOS 回归
- **WHEN** 在 Windows/macOS 上调用 `open_url` / `open_path` / `reveal_item_in_dir`
- **THEN** 行为与变更前完全一致（分别走 `open` crate / `SHOpenFolderAndSelectItems` / `NSWorkspace` / zbus 路径）

### Requirement: ACL scope 行为跨平台一致

opener permissions 的 `CommandScope<Entry>` / `GlobalScope<Entry>` 解析与 `Application` enum 反序列化 SHALL 在 OHOS 上与其他平台行为一致。本变更 SHALL NOT 修改 `scope.rs` / `scope_entry.rs` / `commands.rs`。

#### Scenario: scope 反序列化路径不变
- **WHEN** OHOS 上 opener permissions 配置了 allow/deny 条目
- **THEN** `Entry::deserialize` 从 ACL resolved scope 解析（不从 invoke body），`Application` enum 的 `#[serde(untagged)]` 行为与 Windows/macOS 一致，allow/deny 校验结果一致

