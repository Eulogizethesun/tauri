## 1. openharmony-ability 底层 NAPI

- [ ] 1.1 新增 `openharmony-ability/crates/ability/src/helper/opener.rs`：定义 `open_with_system` 与 `reveal_in_dir` 两个 TSFN（`LazyLock<RwLock<Option<Arc<Tsfn>>>>` + `create_*_tsfn` + `get_*_tsfn`），TSFN 回调签名 `Function<'a, FnArgs<(String,)>, Unknown<'a>>` + `callee_handled::<false>()`（约束 2.2），`fn_ref.call(FnArgs { data: (uri,) })`
- [ ] 1.2 新增 `pub async fn open_with_system(uri: String) -> napi_ohos::Result<()>` 与 `pub async fn reveal_in_dir(dir_uri: String) -> napi_ohos::Result<()>`（位于 `crates/ability/src/opener.rs`，对齐 `autostart.rs`）：用 `tsfn.call_with_return_value(FnArgs { data: (uri,) }, NonBlocking, |result, env| { ... })` + `oneshot::channel` + `tokio::time::timeout(Duration::from_secs(10), rx)` await Promise；复用/提取 `autostart.rs` 的 `handle_void_promise` / `send_once` 辅助函数；reject 经 `promise.catch` → `coerce_to_string` → `Error::from_reason(msg)` 回传（**await Promise 模式，非 fire-and-forget**——Decision 2）
- [ ] 1.3 在 `helper/mod.rs` 导出新模块；在 `crates/ability/src/lib.rs` `pub use opener::*`；在 `render/xcomponent.rs`（或 ability init 处）调用 `create_open_with_system_tsfn` / `create_reveal_in_dir_tsfn`
- [ ] 1.4 ArkTS helper 对象（`package/index.ets`）新增 `openWithSystem(uri: string): Promise<void>` 与 `revealInDir(dirUri: string): Promise<void>` 方法，内部 `return this.context.startAbility({ action: 'ohos.want.action.viewData', uri, entities: ['entity.system.browsable'] })`（`viewData` 为 OHOS 标准 `wantConstant.Action.VIEW_DATA` 常量值，`ohos.want.action.view` 非标准；`revealInDir` 同用 `viewData` 但不带 entities，目录场景 action 需设备端验证）；返回 Promise 供 Rust 侧 await；不在 ArkTS 侧 catch，reject 由 Rust `promise.catch` 捕获）；注意约束 2.3：被 NAPI 调函数内部禁用 hilog
- [ ] 1.5 重建 HAR：`ohrs build --arch arm64` + `pack.sh` + `tar -czf ability.har package` + 项目根 `ohpm install`

## 2. opener 插件 cfg 隔离修复（代码级 + Cargo.toml gate）

- [ ] 2.1 `plugins/opener/src/reveal_item_in_dir.rs`：将 `imp` 模块 cfg 的 `target_os = "linux"` 改为 `all(target_os = "linux", not(target_env = "ohos"))`，dragonfly/freebsd/netbsd/openbsd 同理追加 `not(target_env = "ohos")`；**同时**修改 `reveal_item_in_dir` / `reveal_items_in_dir` 函数体顶部的分发 cfg `any(windows, target_os = "macos", target_os = "linux", ...)` 追加 `, not(target_env = "ohos")`，否则 OHOS 仍命中 `target_os = "linux"` 分发到 zbus `imp`
- [ ] 2.2 `plugins/opener/src/error.rs`：`Zbus` variant cfg 追加 `not(target_env = "ohos")`
- [ ] 2.3 **Cargo.toml target-dep gate 修复（铁律 #3，Issue 1）**：将 `plugins/opener/Cargo.toml:47` 的 gate 从 `cfg(any(target_os = "linux", target_os = "dragonfly", target_os = "freebsd", target_os = "netbsd", target_os = "openbsd"))` 改为 `cfg(all(any(target_os = "linux", target_os = "dragonfly", target_os = "freebsd", target_os = "netbsd", target_os = "openbsd"), not(target_env = "ohos")))`，使 `zbus` 与 `url` 同时从 OHOS 编译图移除
- [ ] 2.4 验证 `cargo check --target aarch64-linux-ohos -p tauri-plugin-opener` 不再引入 zbus（`cargo tree -t aarch64-linux-ohos | grep zbus` 为空）；`cargo check --target x86_64-unknown-linux-gnu -p tauri-plugin-opener` 回归通过

## 3. opener 插件 OHOS 平台实现（命令体 OHOS 分支，禁止 block_on）

- [ ] 3.1 `plugins-workspace/plugins/opener/src/commands.rs`：在 `open_url` / `open_path` / `reveal_item_in_dir` 三个 `async fn` 命令体顶部插入 `#[cfg(target_env = "ohos")] { ... return Ok(()); }` 短路分支。**禁止** `tauri::async_runtime::block_on(...)`——命令本身是 async fn，tauri 在 tokio worker 线程 poll 其 future，`block_on` 在 runtime 内会 panic（`"Cannot block the current thread from within a runtime"`，Decision 2）。OHOS 分支直接 `.await openharmony_ability::open_with_system(uri)` / `.await openharmony_ability::reveal_in_dir(dir_uri)`；错误经 `.map_err(|e| crate::Error::OpenharmonyAbility(e.to_string()))` 映射。非 OHOS 平台走原有同步路径（`app.opener().open_url()` / `crate::reveal_items_in_dir()`），不动
- [ ] 3.2 路径 → `file://` URI 转换：`open_path` 命令体的 OHOS 分支用 `url::Url::from_file_path(&path)` 转换（`url` 在 OHOS target 经 task 3.4 显式声明）；`open_url` 命令体的 OHOS 分支直接透传 URL 字符串给 `open_with_system(url).await`，不做转换；`open_path` 的 OHOS 分支跳过 `path.metadata()` 校验
- [ ] 3.3 `reveal_item_in_dir` 命令体 OHOS 分支：对 `paths[0]` 调 `canonicalize()`（保留与 Linux/macOS 一致的"路径不存在先返回 `Io` 错误"行为，Decision 7）→ `paths[0].parent()` 取父目录 → `url::Url::from_file_path(parent)` 转 URI → `openharmony_ability::reveal_in_dir(dir_uri).await`（同样 `.map_err(|e| crate::Error::OpenharmonyAbility(e.to_string()))`）；`parent()` 为 None 时返回 `Error::NoParent`。**不**调用同步 `crate::reveal_items_in_dir()`，**不**为 `reveal_item_in_dir.rs` 新增 `#[cfg(target_env = "ohos")] mod imp`
- [ ] 3.4 `plugins-workspace/plugins/opener/Cargo.toml`：新增 `[target.'cfg(target_env = "ohos")'.dependencies]` 段，声明 `openharmony-ability = { workspace = true }` 与 `url = { workspace = true }`（`url` 已从 task 2.3 收紧后的 linux gate 移除，须在此重新声明供 OHOS 分支使用；与 linux gate 在非 OHOS 上重复声明 `url` 可接受）。**`url` 重声明必要性核对（响应审计意见）**：`url` 供 task 3.2（`open_path` 命令 OHOS 分支的 `Url::from_file_path`）与 task 3.3（`reveal_item_in_dir` 命令 OHOS 分支父目录的 `Url::from_file_path`）两处引用，均位于 `commands.rs` 的 OHOS cfg 分支内，非死依赖——当前源码这两处尚不存在（系本次新增），故审计基于现状核对看不到引用。`[package.metadata.platforms.support]` 增加 `ohos = { level = "partial", notes = "reveal_item_in_dir degrades to opening parent directory; 'open with' ignored" }`
- [ ] 3.5 `error.rs`：新增 `#[cfg(target_env = "ohos")] #[error("OpenHarmony ability error: {0}")] OpenharmonyAbility(String)` 变体（Decision 5，Issue 3）。**不**使用 `#[from]`（避免 opener 显式依赖 napi_ohos），**不**经 `tauri::Error` 透传（tauri::Error 无 `From<napi_ohos::Error>` 实现）。`AbilityError` 不参与此链路（仅内部主线程校验用）

## 4. 验证

- [ ] 4.1 `cargo check --target aarch64-linux-ohos -p tauri-plugin-opener` 退出码 0
- [ ] 4.2 `cargo check -p tauri-plugin-opener`（host 默认目标）回归通过
- [ ] 4.3 `cargo check --target x86_64-pc-windows-msvc -p tauri-plugin-opener` 回归通过（若环境支持）
- [ ] 4.4 **url 依赖必要性核对（响应审计意见）**：实现完成后执行 `grep -rn "url::" plugins-workspace/plugins/opener/src/ --include="*.rs"`，确认所有 `url::Url::from_file_path` 引用中至少有一处位于 `commands.rs` 的 `#[cfg(target_env = "ohos")]` 分支内（task 3.2 的 `open_path` 命令分支与/或 task 3.3 的 `reveal_item_in_dir` 命令分支）。若 OHOS cfg 分支内无任何 `url::` 引用，则 `url` 重声明为死依赖，MUST 从 `[target.'cfg(target_env = "ohos")'.dependencies]` 删除 `url = { workspace = true }` 行；删除后重跑 4.1 确认仍编译通过
- [ ] 4.5 设备端：`openUrl('https://github.com/tauri-apps/tauri')` 调起系统浏览器
- [ ] 4.6 设备端：`openPath('/path/to/file')` 用默认应用打开
- [ ] 4.7 设备端：`revealItemInDir('/path/to/file')` 打开父目录（降级验证）
- [ ] 4.8 设备端：opener permissions allow/deny 在 OHOS 上生效（scope 校验先于平台执行）

## 5. 文档

- [ ] 5.1 在 `design.md` / spec 已标注的平台差异（reveal 降级、with 忽略）同步到 `plugins/opener/README.md` 的 "Platform-specific" 小节
- [ ] 5.2 更新 `openspec/opener-ohos-fix-plan.md` Phase 1 状态为 `✓ 设计完成`
