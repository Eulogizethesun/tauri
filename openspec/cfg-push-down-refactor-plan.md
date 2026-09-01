# cfg 散点下沉重构计划

**创建时间**：2026-08-12
**功能描述**：消除三个 1.6 反例——OHOS 差异代码散点在共享命令/方法里，应下沉到底层后端或通过宏机制吸收。三个点：(1) 菜单/tray ~89 处 `run_main_thread!` 成对 cfg，(2) clipboard write_image 命令内联 TSFN 逻辑，(3) opener reveal_item_in_dir/open_path 命令内联 OHOS async 调用。
**判断依据**：涉及 2 个代码层（plugins-workspace 插件后端 + tauri crates 宏），预估 14 个文件。

## 核心约束（探索结论）

- **OHOS 主线程死锁**：所有 OHOS async 能力（open_with_system/reveal_in_dir/clipboard_write_image）和 muda NAPI 操作依赖 ArkTS 主线程事件循环。主线程任何阻塞等待（block_on 或 rx.recv()）→ 死锁。排除"sync 后端里 block_on async"和"OHOS 用 run_main_thread! 宏"两条捷径。
- **无 trait 约束**：OpenerExt/ClipboardExt 只有访问器方法，open_url/write_image 等是 inherent 方法。改 async 不破坏 trait 契约。
- **点3 不彻底**：宏透传只能消减 ~64%（57/89 处 getter/构造/tray），剩 32 处 menu mutation 因 auto_refresh_menubar（OHOS 独有后置刷新）无法透传。

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | 菜单/tray 宏透传 + refresh hook | p1-cfg-push-down-menu | ✓ 设计完成（已审计，2 项修订） | tauri crates (menu/*, tray/mod, 宏) | 8 | Windows cargo check + OHOS desktop/mobile build + 菜单功能设备验证 |
| 2 | clipboard write_image async 下沉 | p2-cfg-push-down-clipboard | ✓ 设计完成（已审计，0 项修订） | plugins-workspace clipboard-manager | 3 | Windows cargo check + OHOS build + 剪贴板设备验证 |
| 3 | opener reveal/open async 下沉 | p3-cfg-push-down-opener | ✓ 设计完成（已审计，1 项修订） | plugins-workspace opener | 4 | Windows cargo check + OHOS build + 打开/在文件夹中显示设备验证 |

## Phase 详细说明

### Phase 1: 菜单/tray 宏透传 + refresh hook
- **目标**：让 `run_main_thread!`/`run_item_main_thread!` 在 OHOS target 透传（直接执行闭包，跳过 run_on_main_thread+recv 死锁路径），消减菜单/tray 系列的成对 cfg 分流。tray/mod.rs（10 处，无 refresh）彻底透传归一；menu 系列 getter/构造（~25 处）透传归一；menu mutation（~32 处）保留极小单边 `#[cfg(target_env="ohos")] auto_refresh_menubar(...)` 后置调用。
- **文件列表**：
  - `crates/tauri/src/lib.rs`（run_main_thread! 宏定义 L1097）
  - `crates/tauri/src/menu/mod.rs`（run_item_main_thread! 宏定义 L25、auto_refresh_menubar L785）
  - `crates/tauri/src/menu/submenu.rs`（22 处）
  - `crates/tauri/src/menu/predefined.rs`（20 处）
  - `crates/tauri/src/menu/icon.rs`（11 处）
  - `crates/tauri/src/menu/menu.rs`（10 处）
  - `crates/tauri/src/menu/check.rs`（9 处）
  - `crates/tauri/src/menu/normal.rs`（7 处）
  - `crates/tauri/src/tray/mod.rs`（10 处，无 refresh，可彻底归一）
- **方案细节**：
  - 宏内部加 `#[cfg(target_env="ohos")]` 分支：直接执行闭包返回结果（OHOS muda 后端主线程安全，TrayIcon 文档明说 Sync+Send）。
  - menu mutation 方法：透传后，在方法体末尾保留单行 `#[cfg(target_env="ohos")] super::auto_refresh_menubar(&self.app_handle())`——从"成对 cfg 分流"降级为"单边 OHOS-only 后置调用"。
  - 预期 cfg 点：89 → ~32（mutation 的单边 refresh），消减 ~64%。
- **依赖**：无
- **风险**：宏透传改变了 OHOS 上闭包执行的线程上下文（从投递到 Chrome_IOThread 改为调用线程直接执行）。需确认 OHOS 调用线程（通常是 ArkTS 主线程回调链）上直接调 muda 是否安全——探索结论是 muda OHOS 后端通过 TSFN 内部处理线程安全，但需设备验证。

### Phase 2: clipboard write_image async 下沉
- **目标**：把 commands.rs:54-86 的 OHOS 分支（20 行 TSFN 调用 + 资源锁作用域）下沉到 desktop.rs 的 OHOS `Clipboard` impl，新增 `pub async fn write_image`；desktop `write_image` 改 async；commands.rs 删除整个 OHOS 分支，统一为 `clipboard.write_image(&image).await`。
- **文件列表**：
  - `plugins/clipboard-manager/src/commands.rs`（write_image 命令，删 OHOS 分支）
  - `plugins/clipboard-manager/src/desktop.rs`（OHOS impl 加 async write_image；desktop write_image 改 async）
  - `plugins/clipboard-manager/src/mobile.rs`（mobile write_image 保持 unsupported sync，不影响）
- **依赖**：无（与 Phase 1 独立）
- **pub API breaking**：`Clipboard::write_image` 签名 sync→async。标注 breaking-change，配合 tauri-plugin next major。无 trait 约束（ClipboardExt 只有访问器），唯一内部调用者 commands.rs:84。
- **作为 async 下沉试点**：验证"后端改 async + 命令 .await"模式可行，为 Phase 3 做参照。

### Phase 3: opener reveal/open async 下沉
- **目标**：把 commands.rs reveal_item_in_dir/open_path 的 OHOS 分支下沉到 reveal_item_in_dir.rs/open.rs 的 OHOS `mod imp`；底层 free fn + inherent 方法改 async；commands.rs 回归纯分派。
- **文件列表**：
  - `plugins/opener/src/commands.rs`（reveal_item_in_dir/open_path/open_url 删 OHOS 分支）
  - `plugins/opener/src/reveal_item_in_dir.rs`（加 `#[cfg(target_env="ohos")] mod imp` async；free fn 改 async）
  - `plugins/opener/src/open.rs`（加 OHOS async 分支；open_url/open_path 改 async）
  - `plugins/opener/src/lib.rs`（4 个 inherent 方法改 async + .await）
- **依赖**：无（与 Phase 1/2 独立），但借 Phase 2 验证过的 async 模式
- **pub API breaking**：free fn `pub use`（reveal_items_in_dir/open_url/open_path）+ 4 个 inherent 方法 sync→async。标注 breaking-change，配合 next major（commands.rs:104 TODO 已在规划）。约 7 个内部调用点改 .await，桌面 3 个 mod imp 改 async 零成本（函数体不变）。
