# Step 5 审计报告 — cfg 散点下沉重构（三 Phase）

**审计时间**：2026-08-12
**审计范围**：`p1-cfg-push-down-menu` / `p2-cfg-push-down-clipboard` / `p3-cfg-push-down-opener`
**审计依据**：`.claude/skills/tauri-ohos-design/references/ohos-constraints.md` 全文逐条 + 源码核验
**审计方法**：(1) 全文 8.1–8.4 数据点人工 grep 盘点；(2) 三个并行 Explore agent 深度核验 muda 线程安全 / clipboard Send 性 / opener cfg 矩阵；(3) 对照 ohos-constraints §1–7 逐条。

---

## 审计结论总表

| Phase | 关键约束核验 | 源码证据 | 结论 |
|-------|------------|---------|------|
| P1 | §1.2 主线程死锁、TSFN 线程安全 | muda OHOS setter 纯 Rust/AtomicBool；popup/refresh 走 crossbeam channel→专线程→TSFN NonBlocking | **通过**，含 2 项设计修订 |
| P2 | §1.2 MutexGuard !Send、async future Send | clipboard_write_image future 仅持 oneshot Receiver（Send）；arboard 同步；MutexGuard !Send | **通过** |
| P3 | §1.2 TSFN 模式、§5 cfg 矩阵、§2.1 camelCase | open_with_system/reveal_in_dir 走 oneshot+timeout（Send）；cfg 矩阵核验；url 在 OHOS deps | **通过** |

---

## P1 审计：菜单/tray 宏透传

### A. 数据点核验（design 声明 vs 源码实际）

| design 声明 | 源码盘点 | 结论 |
|------------|---------|------|
| ~89 处 cfg 点 | `run_item_main_thread!`=55（6 menu 文件 45 + tray 10）+ `run_main_thread!`=34 = **89** | ✓ 精确 |
| ~32 处 menu mutation（需 refresh） | `auto_refresh_menubar` 调用 11+1+5+8+4+3 = **32**（submenu/predefined/icon/menu/check/normal） | ✓ 精确 |
| ~57 处 getter/constructor/tray 可透传归一 | 89 − 32 = 57 | ✓ 自洽 |
| tray/mod.rs「**fully normalized, zero residual cfg**」 | tray/mod.rs 有 **3 处单边 OHOS-only 站点**不消减 | ✗ **设计声明错误，需修订** |

**✗ 差异 1（设计修订）：tray/mod.rs 不是「zero residual cfg」**

盘点 tray/mod.rs 全部 OHOS cfg 站点（ohos=13, not(ohos)=10），其中 3 处为单边 OHOS-only：

1. **L360 `quick_operation(config)`**（builder 方法）— OHOS StatusBar 弹窗面板专属 API（`statusBarManager.addToStatusBar`），其他平台无此功能。`#[cfg(target_env="ohos")]` 全函数门控，**无对应 not-ohos 分支可折叠**。→ 保留单边。
2. **L698 `set_quick_operation(config)`** — 同上，OHOS 专属 setter。→ 保留单边。
3. **L664-676 `set_icon_as_template(is_template)`** — **三路平台拆分**：`#[cfg(macos)]` 走宏 / `#[cfg(target_env="ohos")]` 直接调 `self.inner.set_icon_as_template` / `#[cfg(not(any(macos, ohos)))]` no-op。宏透传后，OHOS 可复用宏（宏在 OHOS 直接执行），**可简化**为 `#[cfg(any(target_os="macos", target_env="ohos"))]` 单宏调用 + else no-op。→ 简化但仍残留 `any(macos,ohos)` cfg。

**修订**：design.md 的「tray/mod.rs fully normalized, zero residual OHOS cfg」应改为「tray/mod.rs 10 处成对 `run_item_main_thread!` 分支折叠为 10 处单宏调用；2 处 OHOS-only 专属功能（quick_operation / set_quick_operation）保留单边 cfg（无对应非 OHOS 实现可折叠，非 V8）；1 处三路拆分（set_icon_as_template）简化为 `cfg(any(macos,ohos))` 单宏 + no-op」。

### B. muda 线程安全核验（§1.2 / §1.3）

| 约束条款 | 核验结果 |
|---------|---------|
| §1.2「TrayIcon Sync+Send, 通过 TSFN 内部处理线程安全」 | ✓ 已知，tray 后端 TSFN NonBlocking |
| §1.2 隐含：MenuItem/Submenu/CheckMenuItem 是否也线程安全？ | **✓ 核验通过**（见下） |
| §1.3「Menu 动态更新需 refresh_menubar，重新序列化 JSON + TSFN 推送」 | ✓ 设计保留 32 处单边 refresh 调用，符合 |

**muda OHOS 后端线程安全证据**（agent 深度核验，`muda/src/platform_impl/ohos/mod.rs`）：

- menu item setter 全是**纯 Rust 字段写入**，无 FFI、无 NAPI：
  - `set_text` → `self.text = text.to_string()`（L379-381）
  - `set_enabled` → `self.enabled = enabled`（L387-389）
  - `set_checked` → `AtomicBool::store(Ordering::Release)`（L408-415）
  - `is_checked` → `AtomicBool::load(Ordering::Relaxed)`（L401-406）
- 唯一的 ArkTS 跨界是 `Menu::popup` / `Menu::refresh_menubar`（L121-136），它们调 `openharmony_ability::menu::popup_context_menu` / `set_menu_json`（`openharmony-ability/crates/ability/src/menu/mod.rs:235-257`），后者仅做 `crossbeam_channel.send()` 进静态 `LazyLock<(Sender,Receiver)>` + `Mutex<HashMap>` 写入——皆 `Sync+Send`——再由专转发线程（L204-227）调 `tsfn.call(data, NonBlocking)`。

**结论**：OHOS menu item setter 在任意非主线程调用安全（甚至比 tray 更简单——不触及 ArkTS）。宏透传在 OHOS 上闭包内联执行**安全**。

### C. Windows 对照：`run_on_main_thread` 是否必要（非仅防御）

**核验发现**（`muda/src/platform_impl/windows/mod.rs`）：Windows setter 调 Win32 API 后**每次都调 `DrawMenuBar(hwnd)`**（L706/L735/L788/L811）。`DrawMenuBar` 发同步 `WM_NCPAINT`/`WM_ERASEBKGND`，**必须在拥有窗口的线程执行**——非 owner 线程调用不重绘。

**审计意义**：这证明 Windows 上 `run_on_main_thread` 分派是**正确性必需**，非仅防御性。design.md「non-OHOS behavior byte-for-byte unchanged」的承诺因此更有分量——OHOS 透传不是"放弃了一个本来可以省的分派"，而是"OHOS 根本不需要 Windows 那种线程亲和分派"。

### D. ⚠ 新增风险（design 未记录）：`Rc<RefCell<MenuChild>>` 是 `!Send`

agent 发现 muda OHOS `MenuChild` 存于 `Rc<RefCell<MenuChild>>`（`ohos/mod.rs:140-152`），`!Send`。

- **透传安全**：宏 OHOS 臂 `Ok($ex($self.clone()))` 在调用线程内联执行闭包，`Rc` 不跨线程——**安全**。
- **但设计须记录约束**：menu/tray 包装方法（`pub fn set_text` 等）**必须保持同步 `fn`**（非 `async`），且 `Rc` 不得跨 `.await`。当前菜单 `#[tauri::command]` 是否 async？菜单命令在 tauri crate 内调用 `item.set_text(text)?`（同步），`Rc` 不跨 `.await`。design.md 应新增一条 Non-Goal 或 Risk：「menu/tray 包装方法保持同步签名，不引入 async，避免 `Rc<RefCell<MenuChild>>` 跨 `.await` 破坏 future 的 `Send`」。

**建议**：将此风险补入 design.md Risks 段。

### E. 平台隔离（§1.1 / §5.2）

- 宏 OHOS 臂 `#[cfg(target_env="ohos")]` 全臂门控，非 OHOS 不编译内联臂 ✓
- 非 OHOS 臂 `#[cfg(not(target_env="ohos"))]` 保留原 `run_on_main_thread+recv` ✓
- 符合铁律#2（OHOS 代码 `cfg(target_env="ohos")` 隔离，不影响其他平台）

### P1 审计裁决：**通过**，附 2 项设计修订（差异 1 tray 残留 cfg、风险 D Rc !Send）须补入 design.md。

---

## P2 审计：clipboard write_image async 下沉

### A. async / Send 核验（§1.2 / §1.2 MutexGuard）

| 设计要点 | 源码核验 | 结论 |
|---------|---------|------|
| `clipboard_write_image` 是 async 且 future Send | `openharmony-ability/crates/ability/src/clipboard/mod.rs:84` `pub async fn`；future 仅持 `oneshot::Receiver<Result<(),String>>`（Send）跨 `.await`（L96,165）；`Rc<Cell<...>>`（L124-125）在 `move|result,_env|` 闭包内（同步注册，不进 future 状态机） | ✓ |
| arboard 同步 | `desktop.rs:54` `pub fn write_image` 无 `.await`；`set_image` 即返回；arboard 无 async runtime | ✓ |
| write_image 命令无条件注册（mobile 须对齐签名） | `lib.rs:50` `commands::write_image` 在 `generate_handler!`，无 cfg；`mobile.rs:62-66` 立即返回 `Err(Unsupported)` | ✓ |
| MutexGuard !Send，块作用域提取必要 | `webview/mod.rs:2340` `fn resources_table() -> MutexGuard<'_, ResourceTable>`（`std::sync::MutexGuard`，!Send by design）；`commands.rs:69-73` 块作用域在 L74 `.await` 前 drop guard | ✓ |

### B. 行为保持核验

- OHOS 分支：`clipboard_write_image(rgba,w,h).await` 从 command 内联移入 `Clipboard::write_image` 方法，**逐字一致**（含 `.map_err(|e| Error::Clipboard(e.to_string()))`）✓
- desktop arboard：`&Image<'_>` → `(rgba, w, h)` triple，`ImageData{bytes:Cow::Borrowed(rgba), width, height}` 构造等价（arboard 仅需 bytes+dims）✓
- mobile：签名对齐（sync→async + triple），返回 `Err(PlatformNotSupported)` 不变 ✓

### C. 平台隔离（§1.1）

- OHOS TSFN 逻辑移入 `#[cfg(target_env="ohos")] impl Clipboard`（已存在该 cfg 门控块）✓
- command 变平台中立（无 cfg 分支）✓

### D. pub API breaking 评估

- `Clipboard::write_image` sync→async + 签名 `&Image` → `(rgba,w,h)`：**breaking**，plugin-internal 类型，外部直调少见。design 已标 `breaking-change` + next major。✓ 标注充分。
- `ClipboardExt` trait 仅 `clipboard()` 访问器，无 trait 契约破坏 ✓

### P2 审计裁决：**通过**，无修订项。设计文档已覆盖所有约束。

---

## P3 审计：opener reveal/open async 下沉

### A. async / Send 核验（§1.2）

| 设计要点 | 源码核验 | 结论 |
|---------|---------|------|
| `open_with_system` / `reveal_in_dir` 是 async 且 Send | `openharmony-ability/crates/ability/src/opener.rs:37` `pub async fn open_with_system(uri:String)`；L75 `reveal_in_dir`；走 `call_with_return_value + oneshot + tokio::time::timeout`（L41-67/L79-105）；`tx_cell: Rc<Cell<...>>` 在回调闭包内不进 future；仅 `rx: oneshot::Receiver`（Send）跨 `.await`；**当前 commands.rs L46/94/121 已 `.await` 这些 future 且 crate 编译通过**（tauri command 要求 Send）→ 经验证 Send | ✓ |
| OHOS 分支只持 owned 数据（String/PathBuf/Url）跨 .await | OHOS 臂持 `String`/`PathBuf`/`url::Url`，皆 Send | ✓ |

### B. cfg 矩阵核验（§5.1 / §5.4）— **关键审计点**

当前 `lib.rs` inherent 方法 cfg：
- L61 `#[cfg(desktop)]`（open_url desktop 臂）/ L115 `#[cfg(desktop)]`（open_path desktop 臂）
- L87 `#[cfg(all(mobile, not(target_env="ohos")))]`（open_url mobile 臂）/ L145 同（open_path mobile 臂）

按 CLAUDE.md：`OHOS_DEVICE_TYPE=desktop` → `cfg(desktop)`=true；`OHOS_DEVICE_TYPE=mobile` → `cfg(mobile)`=true。

**当前缺陷**（核验确认 design 诊断）：
- OHOS-desktop：`cfg(desktop)`=true → desktop 臂编译 → 调 `crate::open::open()` → `::open::that_detached`（open crate，OHOS 上损坏）。**当前 OHOS-desktop 走的是损坏的 open crate 路径**——这也解释了为何 OHOS 逻辑只能内联在 command 而非 backend。
- OHOS-mobile：desktop 臂 false；mobile 臂 `all(true, not(true))`=false → **inherent 方法不存在**。

**design 修订方案核验**（`#[cfg(any(desktop, target_env="ohos"))]` desktop + `#[cfg(all(mobile, not(target_env="ohos")))]` mobile）：
- OHOS-desktop：`any(true, true)`=true → desktop 臂；mobile 臂 `all(false, false)`=false。**单一臂**✓
- OHOS-mobile：`any(false, true)`=true → desktop 臂；mobile 臂 `all(true, false)`=false。**单一臂**✓
- Android/iOS：desktop 臂 false（非 desktop、非 ohos）；mobile 臂 `all(true, true)`=true → mobile 臂。**走 run_mobile_plugin**✓

**结论**：design 的 cfg 修订正确覆盖两种 OHOS 设备形态，且不破坏 Android/iOS。✓

### C. 依赖隔离核验（§5.2 / §5.4）

`plugins/opener/Cargo.toml`：
- L47-49 linux/BSD deps（zbus + url）门控 `cfg(all(any(linux, BSDs), not(target_env="ohos")))` → OHOS 不引入 zbus ✓
- L64-66 `[target.'cfg(target_env="ohos")'.dependencies]` 含 `openharmony-ability` + `url` → **url 在 OHOS 可用** ✓

design 将 `url::Url::from_file_path` 从 commands.rs OHOS 臂移至 open.rs/reveal_item_in_dir.rs OHOS 臂——`url` 仍是 OHOS 活依赖 ✓

### D. mod imp 冲突核验

`reveal_item_in_dir.rs` 现有 `mod imp` 门控：
- L87 `#[cfg(windows)]`
- L203-209 `#[cfg(any(all(target_os="linux", not(target_env="ohos")), BSDs))]`
- L283 `#[cfg(target_os="macos")]`

**无 `#[cfg(target_env="ohos")] mod imp`**——design 新增不冲突 ✓。free fn 顶部分发 `any(...)` 已排除 OHOS（fallback 返回 `UnsupportedPlatform`），design 须将分发 `any(...)` 加入 `target_env="ohos"` 使 OHOS 命中新 `mod imp`——design 已隐含此项（task 2.2「dispatch imp::...await on OHOS」），但 design.md Decision 2 应**明示**「同时修订 free fn 顶部分发 cfg 的 `any(...)` 加入 `target_env="ohos"`」。

**建议**：design.md Decision 2 补一句明示分发 cfg 修订。

### E. await 模式合规（§opener-ohos-platform spec「禁止 block_on」）

design 将 `.await` 从 command 体内联臂移至 backend free fn OHOS 臂——await 链贯通（command future → backend future），无 `block_on`，无主线程阻塞 ✓。符合 spec「await Promise 模式，非 fire-and-forget，禁止 block_on」。

### F. pub API breaking 评估

3 free fn（`open_url`/`open_path`/`reveal_items_in_dir`，re-export `lib.rs:29-30`）+ `reveal_item_in_dir` + 4 inherent 方法 sync→async：**最大 breaking 面**。design 已标 `breaking-change` + next major，与 `commands.rs:104` TODO 一致 ✓。

### P3 审计裁决：**通过**，附 1 项设计补充建议（D 项分发 cfg 明示）。

---

## 跨 Phase 通用约束核验

| 约束（ohos-constraints） | P1 | P2 | P3 |
|------------------------|----|----|----|
| §1.1 cfg 隔离（OHOS 代码 `cfg(target_env="ohos")`，不影响其他平台） | ✓ 宏臂门控 | ✓ OHOS impl 块门控 | ✓ OHOS mod imp/臂门控 |
| §1.2 禁止 run_on_main_thread+recv 死锁 | ✓ 透传消除该路径 | N/A（无主线程分派） | N/A |
| §1.2 TSFN NonBlocking 跨线程安全 | ✓ muda OHOS 已核 | ✓ clipboard_write_image Send | ✓ open_with_system Send |
| §1.2 MutexGuard 不跨阻塞 I/O | N/A | ✓ 块作用域 drop | N/A |
| §5.2 not(target_env="ohos") 排除 Linux 依赖 | N/A | N/A | ✓ zbus 已排除 |
| §5.4 OHOS 不自动是 mobile；desktop/mobile 由 OHOS_DEVICE_TYPE | ✓ auto_refresh_menubar 用 `all(ohos, desktop)` | N/A | ✓ cfg 矩阵核验 |
| 平台隔离铁律#2 | ✓ | ✓ | ✓ |
| 无 trait 契约破坏 | ✓ 宏 pub(crate) | ✓ ClipboardExt 仅访问器 | ✓ OpenerExt 仅访问器 |

---

## 须补入设计文档的修订项汇总

| # | Phase | 文件 | 修订内容 |
|---|-------|------|---------|
| 1 | P1 | design.md「Goals」「Decision 2」 | tray/mod.rs「fully normalized, zero residual cfg」→「10 处成对分支折叠为单宏；2 处 OHOS-only 专属功能（quick_operation/set_quick_operation）保留单边 cfg；set_icon_as_template 三路拆分简化为 `cfg(any(macos,ohos))` 单宏 + no-op」 |
| 2 | P1 | design.md「Risks」 | 新增：muda OHOS `MenuChild` 存于 `Rc<RefCell<MenuChild>>`（!Send）；透传安全（内联执行不跨线程），但 menu/tray 包装方法须保持同步签名，避免 Rc 跨 `.await` 破坏 future Send |
| 3 | P3 | design.md「Decision 2」 | 明示：free fn `reveal_items_in_dir` 顶部分发 cfg `any(...)` 须加入 `target_env="ohos"` 使 OHOS 命中新 `mod imp`（当前仅 task 2.2 隐含） |

---

## 最终裁决

三 Phase 设计**审计通过**。所有关键事实经源码核验，核心约束（§1.2 死锁/TSFN/Send、§5 cfg 隔离矩阵）满足。发现 3 项设计文档修订项（非阻塞），其中 P1 差异 1（tray 残留 cfg 声明错误）与 P1 风险 2（Rc !Send 未记录）为**必须修订**，P3 建议 3 为补充明示。修订后三 Phase 可进入实现期验证（tasks.md 的 cargo check + OHOS build + 设备验证）。
