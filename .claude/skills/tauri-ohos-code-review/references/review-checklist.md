# 代码检视 Checklist

> Review PR 时逐项检查，发现违规则提交 inline comment。

## 严重级别定义

| 级别 | 含义 | 处理 |
|------|------|------|
| 🔴 Blocker | 必须修复才能合并 | event = `REQUEST_CHANGES` |
| 🟡 Major | 强烈建议修复 | event = `COMMENT` |
| 🔵 Minor | 建议改进 | event = `COMMENT` |
| ℹ️ Info | 信息提示 | event = `COMMENT` |

## A — OHOS cfg 隔离

- [ ] A1: OHOS 特有代码使用 `cfg(target_env = "ohos")` 或组合 gate
- [ ] A2: Linux 依赖加了 `not(target_env = "ohos")` 排除（OHOS `target_os` 是 `"linux"`）
- [ ] A3: desktop/mobile 区分使用 `cfg(all(target_env = "ohos", desktop))` / `cfg(all(target_env = "ohos", mobile))`
- [ ] A4: `OHOS_DEVICE_TYPE` 正确使用（`desktop` 默认，含 tray/menu bar；`mobile` 手机/平板）
- [ ] A5: `cfg_attr(mobile, ...)` 类宏门控必须覆盖 OHOS desktop — 当 `OHOS_DEVICE_TYPE=desktop` 时 `cfg(mobile)` 为 false（tauri-build 中 `device_type != "desktop"`），`cfg_attr(mobile, tauri::mobile_entry_point)` 等宏不会展开 → 缺少 `openharmony` NAPI 入口 → HAP 加载失败。正确写法：`cfg_attr(any(mobile, target_env = "ohos"), ...)`

## B — 平台隔离

- [ ] B1: Windows/macOS/Linux 原有实现未受影响
- [ ] B2: 无遗漏的 cfg gate（`git diff` 检查非 OHOS 路径）
- [ ] B3: 其他平台的编译未受影响

## C — NAPI/TSFN

- [ ] C1: ArkTS 中 NAPI 函数名使用 camelCase
- [ ] C2: TSFN 使用 `callee_handled::<false>()`（非 `true`）
- [ ] C3: TSFN 数据通过泛型参数携带，非全局 Mutex
- [ ] C4: `FnArgs<>` 包装 tuple 参数
- [ ] C5: NAPI 重入上下文（经 Rust `func.call` 调用的 ArkTS 函数，第一个 `await` 之前的同步段）的 `catch` 块 SHALL 使用 `safeLogError` 而非 `hilog.error` → 🔵。`hilog.error` 在 NAPI 重入上下文可能抛 `Argc mismatch`（ohos-constraints 2.3），若原始错误与 hilog 错误同时发生，hilog 错误会掩盖原始失败，用户看到 `Argc mismatch` 而非真实错误。**检查方法**：grep `getUIAbilityContext\|hilog.error` 在 ArkHelper.ets 等桥接文件，确认所有被 NAPI 调用链触及的同步 catch 都用 `safeLogError`（本次检视发现共享 `getUIAbilityContext` 漏了对齐，account 操作已正确）。
- [ ] C6: 勿以仓库旧注释为据断言 NAPI i64 编组行为 — 仓内 WindowManager.ets 等处注释称「Rust NAPI i64 arrives as BigInt」，但 napi-ohos 1.2.0 的 i64↔JS 实际经 `napi_create_int64`/`napi_get_value_int64` 编解码为 **JS number**（`bindgen_runtime/js_values/number.rs`），BigInt 仅在 Rust 侧显式使用 `BigInt` 类型时出现。检视中既勿据旧注释放大「BigInt key 失配」类风险，也勿据其提议删除 `Number()` 归一化防御（无害 no-op，历史兜底）。关键编组断言应对照 `~/.cargo/registry` 中 napi-ohos 源码实证。（p1-cursor-grab 检视中一轮 finding 因此前提被对抗性验证反驳）

## D — 线程模型

- [ ] D1: 无 `run_on_main_thread + rx.recv()` 阻塞模式（死锁风险）
- [ ] D2: Mutex 未跨越阻塞 I/O 操作持有
- [ ] D3: `Function::call()` 未在 `render()` / `@Builder` 上下文中调用

## E — ArkTS 框架

- [ ] E1: WebView 事件在 `@Builder` 内 pre-build 注册
- [ ] E2: 多窗口状态使用 `@LocalStorageProp` 隔离（FloatPage）
- [ ] E3: `@Builder` 在 `@Component` 内（需要 `this` 时）
- [ ] E4: Web 组件尺寸策略改动必须同时覆盖 natural 与 explicit 两个场景 → 🟡。`WebBuilder`/`EmbeddedWebBuilder` 的 `.width/.height` 若统一用 `"100%"` 自然布局，会破坏子 webview 的显式矩形（wry `is_child=true` 经 `WebViewStyle{x,y,w,h}` 传入的 bounds 失效，子 webview 变全窗口尺寸+位置偏移，右下溢出被窗口裁切）；若统一用 `data.style.width/height`，主 webview 在窗口 resize 后 ArkWeb 不 relayout（页面保旧布局、底部被裁，0cac4c3 曾因此回归）。正确做法：`data.style?.width ?? "100%"` 二分 + ArkTS 侧 `naturalLayout` 标记（创建时无 `style.width` → `updateWebviewStyle` 剥离运行期宽高）。**检查方法**：grep `WebBuilder`/`EmbeddedWebBuilder` 的 width/height 设置，确认两个场景都有出口且主 webview 运行期 set_bounds 宽高不会污染 "100%" → 🟡

## F — openharmony-ability 桥接

- [ ] F1: 所有仓调用鸿蒙系统能力必须经过 `openharmony-ability`
- [ ] F2: 禁止在其他仓直接调用 ArkTS API 或 NAPI 函数
- [ ] F3: ArkTS↔Rust 错误传播对称 — ArkTS 端注册/调用失败（如 inputConsumer 返回 801/4200002/4200003）必须反向通知 Rust，Rust 据实更新内部状态（HashMap 等）并返回 `Err`；禁止 ArkTS 仅 log、Rust 仍写状态并返回 `Ok(())`，否则导致 Rust 侧认为已注册/注销但系统侧实际未生效的不一致
- [ ] F4: instanceKey 实例复用必须验证 launchType/onAcceptWant 已配置 → 🟡。OHOS `startAbility(want with instanceKey)` 仅在 `launchType: "specified"` + `AbilityStage.onAcceptWant()` 返回对应 key 时才复用实例；`launchType: "standard"`(= multiton) **忽略 instanceKey**，每次 startAbility 创建新实例。tauri-cli 模板 `module.json5` 默认声明 `"standard"` → 依赖 instanceKey 复用主窗口的代码（如 `showMainAbility`）会**复制**主 Ability 而非复用。**陷阱**：`demo/entry` 的 module.json5 省略 launchType → 默认 singleton → 演示中恰好能复用，掩盖了真实生成应用(用模板的 standard)的复制 bug。**检查方法**：grep `instanceKey`/`onAcceptWant`/`startAbility`，确认复用路径有 `launchType: "specified"` + onAcceptWant 实现（注意 SDK 12 hvigor 不支持 module.json5 的 abilityStage 字段，需另寻机制），否则复用逻辑是死代码

## G — 代码质量

- [ ] G1: 无 unused import / unused variable 编译警告
- [ ] G2: 错误处理完整（非测试代码中避免 unwrap/expect，**但 `Mutex::lock().unwrap()` 除外** — 仅当持锁线程 panic 时才会 poison，实际极少发生，属标准用法）
- [ ] G3: 异步回调路径完整（无 callback 丢失/drop）
- [ ] G4: API 签名跨仓一致（如 wry 与 tauri 之间的参数传递）
- [ ] G5: `#[serde(default)]` 不应用于语义上必填的字段（如 `id: String`, `name: String`）— 否则反序列化会静默接受空字符串，导致无效数据被存储而无法查找 → 🟡
- [ ] G6: `ohos_win_id()` / `window_id.unwrap_or(0)` 失败路径检查 — 任何 `Option<i64>` window_id 在创建失败后 `unwrap_or(0)` 会把后续所有窗口操作静默路由到主窗口 (id=0)。Window::new 里 `create_os_window(...).ok()` / `start_ui_ability` 失败时必须 `return Err`，不能继续构造 `window_id: None` 的 Window → 🟡。**检查方法**：grep `\.ok()` 和 `unwrap_or(0)` 在 OHOS Window 创建路径，确认失败分支都走 `Err(os_error!(OsError))`
- [ ] G7: OHOS 窗口尺寸 outer/inner 语义对齐 — `win.resize(w,h)` 设的是 **outer** 尺寸（ArkTS `WindowManager.resizeWindow` 不补偿标题栏 inset）。若 `inner_size()` 返回 content_rect（inner，比 outer 小装饰 inset），而 `set_inner_size()` 直接把该值传给 `resize_window`，则 save→restore 循环会按 inset 量级逐次缩小窗口 → 🟡。**检查方法**：确认 `inner_size()` 与 `set_inner_size()` 对 outer/inner 口径一致（要么都 outer 要么都 inner+补偿），注释说明差异
- [ ] G8: OHOS 窗口可见性 restore+show 配对 — MINIMIZE 状态的窗口 `showWindow()` 不会自动 restore 到 FLOATING，需先 `restore()`/`recover()`。`set_visible(true)` 若只调 `show_window` 不调 `restore_window`，则 minimize（或 `set_visible(false)`→hide_window→minimize）后无法恢复 → 🟡。**检查方法**：对照 `set_visible(true)` 实现确认有 restore 调用，或 ArkTS `showWindowMethod` 对 MINIMIZE 状态先 recover
- [ ] G9: OHOS 状态镜像 (AtomicBool) 需事件回灌 — 新增 tao 侧 `visible`/`fullscreen`/`maximized`/`minimized` 等 AtomicBool 镜像时，必须同时确认 EventLoop 有对应的 MainEvent 回灌（OHOS 系统发起的状态变更），否则 OS 标题栏操作后镜像 stale，`is_visible()` 等返回错误值 → 🔵。若为有意推迟（注释标注 future extension），至少在字段注释里写明"未回灌，OS 发起变更会 stale"。注意保持一致性：同类 getter 不能一部分查镜像、一部分查真实 OS 状态（如 `is_minimized` 查真实而 `is_visible` 查镜像）
- [ ] G10: OHOS no-op / 降级实现需可观测 — OHOS 上大量 API 是 no-op 或降级实现（如 `drag_window` 主窗口无 FloatPage 标题栏路径、`set_always_on_bottom` 空体、`request_redraw` no-op、`drag_resize_window` 退化为 enableDrag）。此类实现静默返回 `Ok(())` 或空 `{}` 时，调用方无法区分"API 已生效"与"此窗口类型/设备上 no-op"，造成可观测性盲区。**要求**：至少 `log::debug!`（或 `log::warn!` 对有副作用的降级）标注生效与否，并在注释说明在哪些窗口类型（主 UIAbility vs Float 子窗口）/设备形态（PC freeform vs 手机）上为 no-op。来源：本次检视 F6（`drag_window` 主窗口 `Ok(())` 无日志）→ 🔵
- [ ] G11: OHOS `setWindowLimits` 一次性写四值 — `win.setWindowLimits({minWidth,minHeight,maxWidth,maxHeight})` 一次设置全部四值，0 = 无限制。tao 的 `set_min_inner_size` / `set_max_inner_size` 若各自单独调 `set_window_limits(min,min,0,0)` / `set_window_limits(0,0,max,max)`，则后调者把另一维度重置为 0（无限制）→ 同时设置 min+max 会丢失一个约束。**检查方法**：grep `set_window_limits` / `set_min_inner_size` / `set_max_inner_size`，确认两者共享缓存并在同一次 `setWindowLimits` 调用中一起下发（任一变更都重新下发四值），而非各自独立调用 → 🟡
- [ ] G12: 临时诊断日志不得进入 PR — 开发期定位问题埋的 DIAG 前缀日志（`[IPC-DIAG]`/`[DRAIN-DIAG]` 等）、状态 dump、事件链 trace、`eprintln!`、JSON payload 截断打印（`&json[..500]`/`chars().take(N)`）等，上线前必须**删除**而非降级（info→debug 只是把噪音藏到更低级别，日志语句本身仍在生产路径上）。只保留有长期运维价值的 error/warn（失败、降级模式）。**检查方法**：对 diff 新增行 grep `-DIAG\]`、`eprintln!`、`take(\d+)\.collect\(\)`、`&\[..\d+\]`；命中即 finding → 🔵。（来源：2026-08-29 八仓 PR 自查，tauri IPC-DIAG / tao DRAIN-DIAG / tray-icon trace 埋点 / window-vibrancy eprintln 四处同型）

## H — 仓库级规范

- [ ] H1: 不应提交的文件未出现在 PR 中 → 🟡
  - **Cargo.lock** — 已在 .gitignore 中，自动生成
  - **自动生成目录** — `gen/ohos/`、`build/`、`target/`
  - **编译产物** — `.so`、`.o`、`.a`、`.hap`、`.hsp`、`.app`、`ability.har`、`*.har`
  - **依赖目录** — `node_modules/`、`oh_modules/`
  - **签名证书** — `.p12`、`.cer`、`.p7b`、`.csr`
  - **测试产物** — `test-report.md`、`console-log.txt`
  - **IDE 文件** — `.idea/`、`.vscode/`、`*.swp`
  - **环境/lock 文件** — `.env.local`、`oh-package-lock.json5`
  - **检查方法**：`git diff <base-branch> --name-only` 逐一核对上述路径模式
- [ ] H2: `.gitattributes` 应保持 `eol=lf`（CRLF 会导致 OHOS 构建异常）→ 🟡
- [ ] H3: openspec 文件必须归档到 `openspec/changes/`（不能散落在仓库根目录）→ 🔵
- [ ] H4: 模板文件 `.ets.hbs` 重命名需验证 CLI template.rs 能正确处理 → 🟡
- [ ] H5: **仅 tauri 仓**：检查 `doc/manual_tests.md` 是否归档了新手动用例（🟡）
  - ⚠️ 此条仅适用于 `tauri/tauri` 仓库，其他仓（wry/tao/openharmony-ability/plugins-workspace 等）跳过
  - **检查方法**：`git diff <base-branch> -- doc/manual_tests.md`，对比 PR 新增功能是否有对应的手动用例追加
  - 如果 PR 新增了用户可操作的功能/API（如 createPdf、tray、menu 等），但 `doc/manual_tests.md` 未变更 → 提交 finding
  - 格式要求：按模块章节追加表格行，末尾更新统计表（T0/T1/合计）
  - 参考模板：`.claude/skills/tauri-ohos-verify/references/manual-test-template.md`
- [ ] H6: **仅 tauri 仓**：检查 `openspec/changes/` 下是否归档了对应的 openspec 设计文档（🟡）
  - ⚠️ 此条仅适用于 `tauri/tauri` 仓库，其他仓跳过
  - **检查方法**：`git diff <base-branch> --name-only -- openspec/changes/`，确认 PR 对应的 openspec 变更已归档
  - 如果 PR 实现了某个 feature 的完整设计（有 proposal.md、design.md、tasks.md 等），但 `openspec/changes/` 下无对应目录 → 提交 finding
  - 如果 openspec 文件散落在仓库根目录（不在 `openspec/changes/<change-name>/` 下） → 提交 finding
  - **深度检查**：读取 openspec 文档，核对 design.md 的每个功能点是否在代码中实现，spec.md 的每个 requirement 是否被满足
- [ ] H7: 注释必须使用英文 → 🔵
  - PR 新增或修改的注释（`//`、`/* */`、`///`）不得包含中文
  - **检查方法**：`git diff <base-branch>` 中搜索中文字符 `[一-鿿]`，定位到注释行
  - 已有未修改的中文注释不要求（仅检查 PR 变更范围内新增/修改的注释）
- [ ] H8: **仅 tauri 仓**：`doc/manual_tests.md` 统计表合计必须等于各模块行之和 → 🔵
  - ⚠️ 此条仅适用于 `tauri/tauri` 仓库
  - **检查方法**：PR 变更 manual_tests.md 后，核对 `合计` 行的 T0/T1/合计 = 所有模块行对应列之和（含本次新增模块行）。新增 N 个 T0 用例 → 合计 T0 必须同步 +N
  - 常见错误：新增用例行但合计只 +部分（差一）。例：旧合计 62 T0，新增 3+2=5 T0，新合计应为 67 而非 66
  - 同时核对末尾 `## 二十/二十一…` 章节编号是否随新增章节递增
- [ ] H9: openspec `tasks.md` 必须反映最终采用方案 → 🔵
  - 适用所有仓的 `openspec/changes/<change>/tasks.md`
  - **检查方法**：若 PR 的 plan.md/proposal.md 标注某方案已回退/Rejected，tasks.md 中对应待办项必须同步标注「已回退」或删除，不得保留描述废弃方案的未勾选待办项
  - 同时核对 tasks.md 描述的实现与实际代码/design.md 一致（如 tasks.md 说 no-op 但代码/design 用 recover_window，则为陈旧错误）
  - PR 中代码注释也不得引用已删除的代码（如引用已回退的 `Event::Resumed` handler）
