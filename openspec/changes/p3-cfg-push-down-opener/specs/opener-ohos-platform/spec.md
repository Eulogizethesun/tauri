# Specification: opener-ohos-platform (MODIFIED by p3-cfg-push-down-opener)

> Behavior preserved; implementation location moves from `commands.rs` `#[cfg(target_env = "ohos")]` branches into the backend free fns / `mod imp`. The requirements below are MODIFIED only where the implementation location or the await site changes. All other requirements in `opener-ohos-platform` (startAbility Want action, ACL scope-first, with-ignored, NoParent, error mapping via `OpenharmonyAbility(String)`, await-not-block_on) remain in force unchanged.

## MODIFIED Requirements

### Requirement: OHOS 平台 open_path 实现

`tauri-plugin-opener` 在 OHOS 上 SHALL 将 `path` 转为 `file://` URI 后经 `openharmony-ability::open_with_system` 拉起系统默认应用打开。`with` 参数 SHALL 被忽略。**实现位置（变更）**：该 canonicalize→`file://`→`open_with_system` 逻辑 SHALL 位于 `open.rs` 的 `pub async fn open_path` 的 `#[cfg(target_env = "ohos")]` 分支内，而**非** `commands.rs` 命令体的 `cfg` 分支。`commands.rs::open_path` SHALL 仅做 scope 校验后 `app.opener().open_path(path, with).await` 分派，不含 OHOS `cfg` 分支。行为（canonicalize、`file://` URI、错误映射 `Error::OpenharmonyAbility`）与变更前逐字一致。

#### Scenario: open_path 打开文件
- **WHEN** 前端调用 `invoke('plugin:opener|open_path', { path: '/data/storage/users/current/files/doc.txt', with: undefined })` 于 OHOS
- **THEN** 后端 `open_path` free fn 的 OHOS 分支将 path canonicalize 转为 `file://` URI，调用 `openharmony-ability::open_with_system`，系统默认应用打开该文件，命令成功

#### Scenario: open_path 无匹配应用
- **WHEN** OHOS 上无应用能处理该文件类型，`startAbility` 返回的 Promise reject
- **THEN** 后端 await Promise 模式经 `promise.catch` 捕获 reject 原因，映射为 `Error::OpenharmonyAbility(reject_msg)` 返回，前端 invoke reject

### Requirement: OHOS 平台 reveal_item_in_dir 降级实现

`reveal_item_in_dir` 在 OHOS 上 SHALL 降级为"用文件管理器打开父目录"。多文件 `reveal_items_in_dir` SHALL 取第一个文件的父目录。**实现位置（变更）**：该逻辑 SHALL 位于 `reveal_item_in_dir.rs` 的 `#[cfg(target_env = "ohos")] mod imp` 内的 `pub async fn reveal_items_in_dir`，而**非** `commands.rs` 命令体的 `cfg` 分支。`commands.rs::reveal_item_in_dir` SHALL 仅 `crate::reveal_items_in_dir(&paths).await` 分派，不含 OHOS `cfg` 分支。行为（parent-dir 取值、`file://` URI、`reveal_in_dir`、first-path-only 降级、`NoParent` 错误）与变更前逐字一致。

#### Scenario: reveal_item_in_dir 打开父目录
- **WHEN** 前端调用 `invoke('plugin:opener|reveal_item_in_dir', { paths: ['/data/storage/users/current/files/doc.txt'] })` 于 OHOS
- **THEN** 后端 OHOS `mod imp` 取 `path.parent()`，转 `file://` URI，调用 `openharmony-ability::reveal_in_dir(dir_uri)`，文件管理器打开父目录，命令成功

#### Scenario: reveal_item_in_dir 根路径无父目录
- **WHEN** 传入路径的 `parent()` 为 None
- **THEN** 后端返回 `NoParent` 错误，不调用 NAPI

#### Scenario: reveal_items_in_dir 多文件降级
- **WHEN** 前端传入多个路径 `[a, b, c]` 于 OHOS
- **THEN** 后端取第一个文件 `a` 的父目录打开，不批量选中（平台差异，文档标注）

### Requirement: await Promise 模式（非 fire-and-forget，禁止 block_on）

`open_with_system` / `reveal_in_dir` 的 Rust 实现 SHALL 采用 `call_with_return_value` + `oneshot::channel` + `tokio::time::timeout` await ArkTS `startAbility` 返回的 Promise，**非** fire-and-forget。**await 位置（变更）**：该 `.await` SHALL 发生在 backend free fn（`open.rs::open_url`/`open_path` 与 `reveal_item_in_dir.rs::reveal_items_in_dir` OHOS 分支）内，而**非** `commands.rs` 命令体的 `#[cfg(target_env = "ohos")]` 块内（该块已删除）。命令体仅 `.await` backend free fn。opener 命令 `open_url` / `open_path` / `reveal_item_in_dir` 本身仍是 `async fn`，tauri 在 tokio worker 线程上 poll 命令 future，命令 future 再 poll backend future——await 链贯通，无主线程阻塞。**禁止** `tauri::async_runtime::block_on(...)`。

#### Scenario: 命令正常 resolve
- **WHEN** OHOS `startAbility` Promise resolve
- **THEN** backend free fn 的 `.await` 返回 Ok，命令 future resolve Ok，前端 invoke resolve

### Requirement: cfg 隔离——OHOS 不进入 Linux/zbus 实现

`reveal_item_in_dir.rs` 的 zbus/D-Bus `imp` 模块 cfg 门控 SHALL 排除 OHOS；`target_os = "linux"` 分支 MUST 为 `all(target_os = "linux", not(target_env = "ohos"))`。`error.rs` 的 `Zbus` variant cfg SHALL 排除 OHOS。`Cargo.toml` linux/BSD target-dep gate MUST 收紧为 `cfg(all(any(target_os = "linux", ...), not(target_env = "ohos")))`；`url` 在 `[target.'cfg(target_env = "ohos")'.dependencies]` 重新声明。**`url` 引用位置（变更）**：变更后 OHOS `cfg` 分支内的 `url::Url::from_file_path` 引用 SHALL 位于 `open.rs`（`open_path` OHOS 分支）与 `reveal_item_in_dir.rs`（OHOS `mod imp`），而**非** `commands.rs`。实现完成后 MUST 核对 `grep -rn "url::" plugins-workspace/plugins/opener/src/ --include="*.rs"` 的 OHOS cfg 分支内确有 `url::` 引用位于 `open.rs`/`reveal_item_in_dir.rs`；`url` 重声明的活依赖性质不变。

#### Scenario: OHOS 编译不引入 zbus
- **WHEN** 执行 `cargo check --target aarch64-linux-ohos -p tauri-plugin-opener` 与 `cargo tree --target aarch64-linux-ohos -p tauri-plugin-opener`
- **THEN** 编译成功，`zbus` 不出现在 OHOS 依赖图

#### Scenario: url 依赖必要性核对
- **WHEN** 实现完成后执行 `grep -rn "url::" plugins-workspace/plugins/opener/src/ --include="*.rs"`
- **THEN** 至少一处 `url::` 引用位于 `open.rs` 或 `reveal_item_in_dir.rs` 的 `#[cfg(target_env = "ohos")]` 分支内（非 `commands.rs`），`url` 重声明为活依赖
