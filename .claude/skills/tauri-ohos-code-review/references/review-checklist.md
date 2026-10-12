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
- [ ] C5: NAPI 重入上下文（经 Rust `func.call` 调用的 ArkTS 函数，第一个 `await` 之前的同步段）的 `catch` 块 SHALL 使用 `safeLogError` 而非 `hilog.error` → 🔵。`hilog.error` 在 NAPI 重入上下文可能抛 `Argc mismatch`（ohos-constraints 2.3），若原始错误与 hilog 错误同时发生，hilog 错误会掩盖原始失败，用户看到 `Argc mismatch` 而非真实错误。**检查方法**：grep `getUIAbilityContext\|hilog.error` 在 ArkHelper.ets 等桥接文件，确认所有被 NAPI 调用链触及的同步 catch 都用 `safeLogError`（本次检视发现共享 `getUIAbilityContext` 漏了对齐，account 操作已正确）。**边界（勿扩大化，2026-09-29 AF7 误分类实例）**：OS 生命周期回调（`onWindowStageCreate` 等）里由 ArkTS 发起的 NAPI 调用**不属于**重入上下文——hilog.error 安全；判据 = 调用链上是否存在 Rust 经 `func.call` 回调入 ArkTS 的帧，而非"catch 里有没有 NAPI 调用"
- [ ] C6: 勿以仓库旧注释为据断言 NAPI i64 编组行为 — 仓内 WindowManager.ets 等处注释称「Rust NAPI i64 arrives as BigInt」，但 napi-ohos 1.2.0 的 i64↔JS 实际经 `napi_create_int64`/`napi_get_value_int64` 编解码为 **JS number**（`bindgen_runtime/js_values/number.rs`），BigInt 仅在 Rust 侧显式使用 `BigInt` 类型时出现。检视中既勿据旧注释放大「BigInt key 失配」类风险，也勿据其提议删除 `Number()` 归一化防御（无害 no-op，历史兜底）。关键编组断言应对照 `~/.cargo/registry` 中 napi-ohos 源码实证。（p1-cursor-grab 检视中一轮 finding 因此前提被对抗性验证反驳）

## D — 线程模型

- [ ] D1: 无 `run_on_main_thread + rx.recv()` 阻塞模式（死锁风险）
- [ ] D2: Mutex 未跨越阻塞 I/O 操作持有
- [ ] D3: `Function::call()` 未在 `render()` / `@Builder` 上下文中调用
- [ ] D4: 代际戳/令牌必须在与其守护的变更同一临界区内获取 → 🟡。"先取号、锁内变更、后台按号条件撤销"的模式（如 global-shortcut 的 registration stamp：同步插入 Map，worker 在 ArkTS 拒绝时按 stamp 条件删除），若取号发生在锁外，两线程对同一 key 并发注册可能出现取号序与插入序倒挂（旧号覆盖新号后，旧 worker 的条件撤销反而成立，删掉新注册）。**要求**：取号（如 `next_stamp()`）必须在持有该 Map 锁的同一临界区内调用，保证取号序 ≡ 插入序。**检查方法**：grep 代际戳/AtomicU64 计数器的获取点与对应 `lock`+`insert` 的相对位置，凡取号在锁外即 finding。（来源：2026-09-16 rebase 检视 global-shortcut 同 id 并发注册竞态加固）
- [ ] D5: 面向异步注册窗口的创建期属性下发必须门控到注册握手之后 → 🟡。spawned UIAbility 窗口（id>0）的 stage 注册是异步的（D7 握手），`Window::new` 不等握手即返回；若创建后立刻向该 windowId 派发 `set_window_decorations` / `set_window_limits` 等桥调用，调用可能先于新实例 `onWindowStageCreate` 落地 → ArkTS `requireWindow` 抛 Unknown OS sub-window，属性丢失（仅 warn）。wry 的 webview 操作已有 `pending_ops` 按 window_id 排队至握手的先例，窗口属性下发需同等门控（Rust 侧排队或 ArkTS 侧为 pending id 缓冲）。**守卫状态（原未守卫点已修）**：tao `platform_impl/ohos/window.rs` 创建期 decorations(false) 与 `apply_window_limits`——spawned 窗口竞态已修：创建期属性经 `PENDING_WINDOW_OPS` 按 window_id 排队至 D7 注册握手后下发（Eulogizethesun/tao#26，issue 7，E4 验证）；主窗口 id 0 本就无竞态（stage 先于 runtime 就绪）。**检查方法**：审查任何 `start_ui_ability` 之后立刻向该 windowId 派发桥操作的代码，确认有握手门控或排队 → 🟡。（来源：2026-09-16 rebase 检视发现）

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
- [ ] G13: 托盘/系统面板触发的窗口前后台与生命周期操作必须有焦点恢复竞态守卫 → 🟡。托盘菜单点击回调里**立即**执行 `hideAbility()` / `minimizeWindow()` / `terminateSelf()` 等操作时，面板关闭会并发触发 sceneboard 焦点恢复（`startSceneFromOther` → `RequestSceneSessionActivation`，最终是一次真实 StartAbility）；若激活晚于操作落地，会把已隐藏/已最小化/正在退出的 app 拉回前台，操作被静默撤销（实测竞态窗口 ~10-30ms，满负载下约 1/6 点击失败）。此类时序问题无法靠单测复现，检视时必须**携带竞态模型**对照检查。**要求**：每个此类操作走守卫族 — `minimizeWithRestoreGuard` / `hideWithRestoreGuard` 模式（等主窗口 WINDOW_ACTIVE 落定后再执行，50ms 超时兜底，`consumed` 防重入，`win.off('windowEvent')` 清理，所有 promise 路径 `.catch(() => resolve())`），或 menubar 路径的 `setPendingAction`。**陷阱**：托盘菜单项走 `notify_only:true`（rightMenuClick 而非 startAbility），WINDOW_ACTIVE 可能永不到来 → `setPendingAction` 的 2s 超时会直接**丢动作**，因此托盘路径依赖各操作的内联守卫而非 pendingAction（见 StatusbarPlugin.ets 注释；menubar 路径两者叠加）。**检查方法**：对 PredefinedActionExecutor 每个 case（及任何新增的托盘/面板触发操作）追踪到 WindowManager 实际调用，确认守卫存在；重点盯 `terminateSelf` 裸调路径（quit 的 exitFn、次级 UIAbility 实例的 closeWindow 目前均无守卫，属已知未守卫点）。（来源：2026-08-31 Full Test Tray hide 失效根因分析 + 全仓同族竞态排查，hideAbility 修复见 openharmony-ability PR #48）
- [ ] G14: rebase 取 upstream 或 PR 内设计定案变更后，测试/文档不得继续断言被丢弃的行为 → 🟡。冲突解决取 upstream 实现时，本地为旧行为写的测试断言与文档引用（错误文案、Err/Ok 形态、skip 条件）变成"断言不存在的契约"，真机必挂。**要求**：每完成一处 upstream-first 决策，grep 测试与 references 文档中对旧行为的断言/引用并同步改写。**检查方法**：对 diff 中被 upstream 化的插件，grep 其 JS 测试的 OHOS 分支断言与 `.claude/skills/**/references/*.md` 引用是否与实现一致。（来源：2026-09-16 rebase 检视——clipboard readText 已随 upstream 改为 resolve 空串，plugins.ts 仍断言 unified Err 拒绝、ohos-constraints.md 仍列为统一 Err 示例，两处同步改写）。**同型扩展（PR 内设计转向，2026-09-29 round-3）**：PR 自身的方案 pivot 同理——launchType 定案 `specified`+onAcceptWant 后，examples 判据文本（"launchType not standard → FAIL"）、注释、跨仓文档中仍以 `standard` 为前提的断言须同步改写。（tauri#166 TA4-2b）
- [ ] G15: 异步注册失败路径必须回滚预注册状态 → 🟡。fire-and-forget 的异步创建（`start_ui_ability` / bridge call）失败时，调用前已写入的注册表/pending 条目（`register_pending_ui_ability` / `register_window_label` 等）若无回滚将永久滞留：下游就绪判据（`is_window_ready` 组合门）对失败 id 恒 false，操作队列永久**静默**压队；死 label 条目还违反 "never spawned → primary(0)" 契约（死 id ≠ 0）。**要求**：每个"先注册、后异步派发"的模式，失败分支必须成对调用 unregister/drop，或注释显式标注滞留后果与真实消费者。**检查方法**：grep `register_pending_*` / `register_window_label` 调用点，追踪对应异步调用的 Err 分支是否回滚。（来源：2026-09-29 五仓 babysit 自检——tao `start_ui_ability` 失败 pending 泄漏、ability `register_window_label` 拒绝路径无回滚、pending 注册表 "no consumer … harmless" 注释前提被组合门推翻，三处同型）。**扩展（accepted ≠ created，2026-09-29 round-3）→ 🟡**：失败腿不止 Rust 侧 bridge Err——桥已 accepted、ArkTS `setTimeout` 后 `startAbility` 才被 AMS 拒绝（实例过多/限流）的**延迟失败腿**，调用方已带 accepted=true 返回；若无「ArkTS catch → bridge 反向通知 → Rust 回滚」链路，两端 pending 注册表（tao `PENDING_UI_ABILITIES` + ability `WINDOW_ID_BY_LABEL`）同时楔死且零日志，唯一症状是后续 op 无声排队。**要求**：延迟执行的注册类操作，ArkTS 侧 catch 必须经 bridge 反向通知 Rust 走与 Err 腿相同的回滚。（来源补充：ability#53 AF3 + tao#26 O10-3——AppControlPlugin setTimeout startAbility 失败仅 console.error）
- [ ] G16: app 级 API 迁移 per-window（id 键控）时主窗（id 0）必须保留改前语义 → 🟡。把 app 级共享状态的读取改为按调用窗口 id 键控解析时，主窗（id 0，含 never-spawned label 解析到 0 的契约语义）必须逐一对照改前行为——共享状态的 app 级更新路径（如 `RunEvent::Opened` 写共享 current）对 id 0 仍需生效，否则主窗查询类 API 静默回归（改前返回新值、改后返回陈旧 memo）。**修法提示**：id 0 回退共享状态通常是正确的（cross-talk 顾虑只针对 spawned 窗读主窗状态）。**检查方法**：对每个新增 `*_for_window` API，验证 `window_id == 0` 路径与旧 app 级实现行为等价（含后续更新事件的可见性）。（来源：2026-09-29 plugins#34 自检——JS getCurrent 全窗路由 `get_current_for_window` 后主窗永不读共享 current，warm-start 深链返回陈旧冷启动值）
- [ ] G17: derive codegen 新增 NAPI 参数不得破坏旧 HAR 降级路径 → 🟡。`#[ability]` derive 生成的 NAPI 入口新增必填参数（如 `window_id: i64`）时，旧 HAR（ohpm 注册表模式）按旧签名调用不会在 argc 层快速失败（`required_argc=None`），缺参在编组层抛 `napi_number_expected`——对 `render` 类入口即白屏。**要求**：codegen 对新增的 window_id 类参数生成 `Option<i64>` + `unwrap_or(0)`，与手写入口的 `window_id_arg` 容错模式（lifecycle.rs）一致。**检查方法**：审 derive 模板新增参数的类型——必填 i64 且存在旧 HAR 调用方可能性的即 finding。（来源：2026-09-29 ability#53 自检——derive `:32`/`:228` 两处必填 i64，同 PR 已有 `Option<i64>` 正确先例）
- [ ] G18: 同 PR 改动使注释/doc/测试前提失效须同步改写 → 🔵。PR 改动某机制后，仓内注释/doc 对该机制的断言（"no consumer … harmless"、"Consumed by the X facade"、README 的构建前置承诺）可能变成假话；跨仓注释断言兄弟仓实现细节的（如 tao 注释断言 plugins 的 cfg gate）在兄弟 PR 合入后同样过时。**要求**：对 diff 触及的机制 grep 其注释/doc 断言并同步改写；跨仓断言改为指向目标仓而非复制其内容。**检查方法**：对每个行为变更点，grep 关键词（函数名 / harmless / Consumed / works without）在 `.rs`/`.ets`/`.md` 中的断言。（来源：2026-09-29 五仓 babysit 自检——tao decor-watch 残留注释、ability "no consumer" 注释、app.rs facade 过期 doc、plugins README 与 build.rs 矛盾，四处同型）。**同查测试与死字段（2026-09-29 round-3）**：facade/存储位置迁移后，仍驱动旧写入口的测试是确定性红（写 inner 读模块静态，plugin-continuation AF1）；切换后无读者的字段同步删除或标注留存原因（`DeepLinkClient.app` AF8）。
- [ ] G19: 插件 `on_lifecycle` 处理 Ability 级事件须按 `window_id == 0` 门控主窗域状态 → 🟡。`AbilityCreated`/`AbilityDestroyed` 等 Ability 级事件在多 UIAbility 下每个 spawned 实例都会触发；插件在处理这类事件时若无条件清空/替换**主窗域**状态（如 `replace_resource_manager(None)`），任一 spawned 实例的创建/销毁都会误伤主窗句柄；且 D12 join 模型下 joined 实例跳过 `configurePlugins`/`onInstall`、就绪推送不会重发 → 主窗访问**持续**失效（非瞬时）。**正确先例**：plugin-webview 对同款事件以 `window_id: 0` 门控（R11 注释）。**检查方法**：对每个订阅 Ability 级事件的插件，确认主窗域状态的写操作在 `window_id == 0` 门内。（来源：2026-09-29 round-3 ability#53 AF2——plugin-resource 漏门控，同 PR 的 plugin-webview 为正确对照）
- [ ] G20: per-window 参数化改造后须清扫同簇/同构代码中的硬编码主窗 id → 🟡。事件派发或状态查询改成按 window_id 路由后，同簇兄弟路径（如 ModifiersChanged vs KeyboardInput）与同构文件（MainPage.ets vs FloatPage.ets）中残留的 `WindowId(0)`/`MAIN_WINDOW_ID` 硬编码即遗漏：单窗时代无害，多窗激活后 spawned 窗口的事件/按键被静默路由到主窗（可观察后果：ESC 恢复的是主窗全屏、修饰键状态挂主窗 id）。**检查方法**：对新增 window_id 参数化的 PR，grep 同文件与同构文件的 `WindowId(0)`/`MAIN_WINDOW_ID` 硬编码残留，对照同构实现的参数化写法逐处核对。（来源：2026-09-29 round-3——tao#26 O10-1 ModifiersChanged 硬编码 + ability#53 AF5 MainPage.ets 三处硬编码，两仓同型；FloatPage.ets 为正确对照）
- [ ] G21: 修复轮写入的断言性注释/doc/判据须逐条对照源码实证 → 🔵。修复时顺手补的说明文字（"tauri 层已按 label 门控"、"flag 只在 OHOS 构建导出"、"新实例加载默认页"）若凭修复意图推断而非读实现，会成为**修复自己引入的假断言**——且因披着"修复"外衣，下一轮检视的默认信任度更高、更难被发现。**要求**：每条新断言（尤其跨仓/跨层的"上游会 X"、"只有 Y 会发生"类）写前 grep 到消费方源码行；测试判据文本须对照实现命令实参（如 WebviewUrl 实传值）；**wire 级断言**（"X 不是 want parameter"/"键名是 Y"类描述 wire payload 形态的句子）须对照实际序列化/反序列化点验证——注释宣称键已写入 wire 而实现从未写入（死键）是重灾区。**检查方法**：对修复 diff 新增的注释/doc/判据行，抽出其中的事实性断言逐条反向验证；重点盯修复说明里的因果链（"X 之后 Y 不再发生"）。（来源：2026-09-29 round-3 对抗性确认轮——修复层假断言 5 例：tao is_focused doc、TestRunner 判据两处+flag 注释、deep-link/continuation doc、tray 镜像 doc；wire 级：2026-10-08 round-4 tao#26 4214028714——tauri_window_url 注释宣称的 wire 传递实为死键）
- [ ] G22: `@tauri-apps/api` 实例 setter 的 invoke payload 必须带实例路由键（`label: this.label`）→ 🟡。后端 window/webview 插件命令由 setter! 宏统一生成，签名恒为 `(window, label: Option<String>, value)`——label 缺失时 get_window 回退到 **invoke 发起窗**。因此 API 层实例方法漏传 label 时，`getByLabel(x).setter()` 从另一窗发起会错打**发起窗**而非目标窗 `x`；且错误后果可长期潜伏（错打的窗口层被页面内容遮盖，仅在系统特定行为下显形，如 OHOS 拖拽 resize 时 WMS 拉伸旧帧露出窗口系统背景色）。**检查方法**：对 packages/api 新增/修改的实例方法，逐键对照同文件既有 setter 的 payload 模式（set_decorations/set_resizable 均传 label）；对跨窗调用的套件用例按"发起窗≠目标窗"推演实际路由终点。（来源：2026-10-08 round-4 真机验证——setBackgroundColor 三处漏 label，套件 Float 用例从主窗发起把主窗系统背景打红，拖拽 resize 显形红色，修复 tauri 3ff13dff9）
- [ ] G23: 命令与全局标志须全生命周期闭环（新增必有读者，删除五处配套）→ 🟡。**新增**命令/全局 static：grep 全仓确认存在真实消费方，零读者的"预留"命令即是死标志（还会骗过后续检视——代码看似支持某功能实际是摆设）。**删除**示例 app 命令：五处配套必须齐删——① cmd.rs 命令+static ② lib.rs invoke_handler 注册 ③ build.rs AppManifest 权限声明 ④ capabilities/*.json 授权 ⑤ 前端调用点；漏删 ④ 会导致 tauri-build panic（构建期才炸），漏删 ③ 会留下幽灵权限声明。**检查方法**：diff 新增 static/命令时 grep 读者；diff 删除命令时逐处核对五配套清单。（来源：2026-10-08 round-4——4214029742 EXIT_PREVENT_GUARD 零读者死标志删除；c7bfa9076 验证轮现修：capabilities 漏删 allow-set-exit-prevention 致 tauri-build panic）
- [ ] G24: 进程级单例状态须审查 per-instance 事件的消耗路径（exit_state 烧毁模式）→ 🟡。app 级 OnceLock/AtomicBool 哨兵/去重标志，若置位点挂在 per-instance 事件回调（UIAbility 生命周期/探询/窗口事件）上，**spawned 实例会先消耗标志**，主实例随后被静默短路（零日志）——语义是 app 级、触发主体却是 per-instance。此类 bug 触发序列刁钻（须先由非主实例走一遍置位路径），套件/检视多轮可能都踩不到，真机特定操作序列才暴露。**要求**：凡 per-instance 回调可达的置位点，语义 app 级的须 gate（如 ArkTS 侧 `abilityWindowId !== 0` 直接短路）或在派发层区分实例。**检查方法**：对新增/改动的进程级 static 标志，列出全部置位路径并标注每条的触发主体（哪个实例/哪个窗口）；凡"per-instance 可达 + app 级语义"组合即提交 finding。（来源：2026-10-08 round-4 真机验证——ability 15277ca：spawned 实例探询消耗 runtime-wry 进程级 exit_state 标志，主窗 prevent_exit 静默失效；#117（09-15）引入，三轮检视未发现）
- [ ] G25: 套件用例对进程级单例资源的副作用须可恢复或判据可避开 → 🔵。OHOS 全进程共享一个系统托盘槽位（StatusbarManager 单槽）；套件 tray 用例各自 create/remove 动的是**同一槽位**，若结尾最后操作是 remove 且不恢复，后续一切"套件后看图标"类验证被假阴性误导（图标消失≠回归，实为套件副作用）。同类资源：全局 app 菜单、全局快捷键注册表。**检查方法**：新增套件用例涉及全局槽位类资源时，确认结尾状态恢复（teardown 重建）或判据设计避开（套件前观察渲染+链内自动验证点击）；检视测试代码时把"进程级单例资源"与普通 per-window 资源（用例自建自删即净）区分对待。（来源：2026-10-08 round-4 真机验证——托盘 #11 排查：套件结尾 ohos-init.chain.window-menu-tray created+removed 删完不恢复，setup tray-1 图标永久消失，定性既有测试副作用非回归）
- [ ] G26: 新增跨 ArkTS/Rust 注册表结构必须带能力探针或 stale-HAR 握手 → 🟡。跨语言注册表/pending Map（Rust 侧登记、ArkTS 侧消费，或反向）在 HAR 与宿主版本不匹配（stale HAR：本地改动未编进 HAR、或注册表结构演进）时，登记条目永挂或静默丢失——表现是功能"无响应"而非报错。**要求**：新注册表结构须带能力握手旗标（注册时声明能力键，消费方检查键存在性，不存在即 fail-fast 报"stale HAR/版本不匹配"）或带过期/超时语义，禁止裸 Map 无握手。**检查方法**：diff 新增 bridge 注册表/Map 结构时，确认存在握手/超时/版本核对路径；对照 FLOAT_PENDING_TRACKING（正例）模式。（来源：2026-10-08 round-4——ability#53 4214028985：UIAbility pending 注册表缺 stale-HAR 能力握手，修复仿 FLOAT_PENDING_TRACKING 加握手旗标 5322a5c）
- [ ] G27: 会话武装前守卫的次序 — 校验必须先于状态武装，同步拒绝路径零残留 → 🔴。「武装 pending/armed 会话状态 → 校验 → 异步派发」次序颠倒时，被拒请求已留下武装残留（pending invoke/message 已置位而关联字段未设），三重后果：①后续合法调用被入口 pending 检查拒绝，报出误导性错误（如 'connected tag not found'）直到某次成功调用重新武装会话；②状态派生判定（hasSession 类）看到残留，驱动错误的下游动作（如前台切换重注册一个无过滤的监听）；③极端情况下**被拒请求的数据被物理执行**（无过滤回调把被拒 payload 写到任意后续出现的资源上）。与 G15 的分工：G15 管**异步失败腿**的回滚，本条管**同步拒绝腿**的次序——修复 = 校验前置（与同文件既有正确次序对齐，如 handleScan 之于 handleWrite），拒绝 return 前不得触碰任何会话状态；对照同函数的兄弟失败路径（如 registerReaderMode 失败三字段全清）可确认"拒绝零残留"是文件内既有设计意图。**检查方法**：对每个「写 pending/armed 状态 + 随后校验」的序列，推演每个校验拒绝分支 return 时的 armed 字段是否全零；凡拒绝路径上有已置位未清场的状态即 finding。（来源：2026-10-08 round-5 plugins#34——nfc handleWrite 守卫位于武装赋值之后，被拒 write 残留 pendingWriteInvoke，后续合法 write 全被锁死 + 前台切换注册无过滤 readerMode 物理写入被拒消息，修复 86de4d5c）
- [ ] G28: 预校验谓词的量化符必须与被守卫逻辑的量化语义一致 → 🔵。提前拒绝守卫（「这组参数永不可能命中」类）若与被守卫的匹配逻辑使用不同量化符，会产生假阴性放行：被守卫语义为 AND-within-list / OR-across-lists（单个列表须全部 entry 同时出现在目标上才算匹配）时，「该列表永不可能匹配」的正确判定是 `length > 0 && every(entry 可分发)`；误用 `some(entry 可分发)` 会让混合列表（[可匹配项, 永不可匹配项]）通过守卫——而 AND 语义同时要求那个永不可匹配项——会话随后永久 pending（等待一个结构上永不到来的匹配）。**检查方法**：对每个提前拒绝守卫，写出被守卫逻辑的真值表达式，核对守卫谓词是其严格否定（德摩根对偶）；重点盯 `some`/`every` 与 AND/OR 语义的混用，以及空列表边界（`length > 0` 前置）。（来源：2026-10-08 round-5 plugins#34——techListsCanEverMatch 用 `some` 校验 AND-within-list 语义的 matchesTechLists，混合列表 [NfcA, NfcBarcode] 被放行后 write 会话永挂，修复 86de4d5c）
- [ ] G29: 注释/文档中的测试计数等可度量数字必须以生成产物为准，不得从旧注释/旧文档转抄 → 🔵。套件规模、用例数、基线通过数等数字随开发持续增长，从邻近旧注释或旧计划文档转抄（而非度量当前产物）会写入双向漂移的过期值——同仓曾同时存在 293（抄自旧注释）与 291（旧计划）两个数，而真值是 310；后续检视者与文档读者以注释为锚会再传播一轮。**要求**：写任何「N 例 / N% / N 通过」类数字前，以最近一次生成的产物（test-report 行数、report footer、实测输出）为唯一 ground truth，并在注释中注明出处与日期；发现存量过期计数即改写。**检查方法**：对 diff 中新出现的数字断言，追溯其度量产物与日期；无产物支撑、或与最近报告冲突的计数即 finding。（来源：2026-10-08 round-5 tauri#166——TestRunner.svelte '293-case set' 与 test-plan '291 例/基线 290' 均为转抄过期值，真机产物 310 例 = 305✅/5⏭(已知环境限制)/0❌，修复 45914a14a）

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
- [ ] H2: `.gitattributes` 应保持 `eol=lf`（CRLF 会导致 OHOS 构建异常）→ 🟡。**例外**：upstream 本身为 CRLF 的文件（tauri 仓 `crates/tauri-runtime-wry/Cargo.toml`、`crates/tauri/src/app.rs`）必须以 `-text` 条目保真——否则 `* text=auto eol=lf` 在暂存时把它们重归一化成整文件 churn（真实改动被 ~190 行 EOL 噪声包裹，09-29 tauri#166 TA1 实例）。⚠️ `crates/tauri-runtime-wry/src/lib.rs` 实为 LF，**不在例外内**（10-12 committer 检视发现其曾被误列于 CRLF 块下后订正——对 LF 文件 `-text` 反而会放行 CRLF 混入；以 `git ls-files --eol` 实测为准，勿按注释块推断）。**检查方法**：改动这类文件时 diff 须只剩真实改动行；验证 blob CRLF 保真用 `git ls-files --eol` 或 `tr -dc '\r' < 文件 | wc -c`——MSYS `grep -c $'\r'` 在文本模式静默返回 0，不可信。（来源：2026-09-29 五仓 babysit 修复轮；2026-10-12 committer 检视 C10 订正）
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
- [ ] H9: openspec 文档（tasks.md / proposal.md）必须反映最终采用方案 → 🔵
  - 适用所有仓的 `openspec/changes/<change>/tasks.md`
  - **检查方法**：若 PR 的 plan.md/proposal.md 标注某方案已回退/Rejected，tasks.md 中对应待办项必须同步标注「已回退」或删除，不得保留描述废弃方案的未勾选待办项
  - 同时核对 tasks.md 描述的实现与实际代码/design.md 一致（如 tasks.md 说 no-op 但代码/design 用 recover_window，则为陈旧错误）
  - PR 中代码注释也不得引用已删除的代码（如引用已回退的 `Event::Resumed` handler）
  - **proposal.md 是变更的权威意图声明**：方案转向后仍断言已放弃路线而无「已放弃」标注 → finding；改写为实际路线，或显式标注弃用+原因。（来源补充：2026-09-29 round-3 tauri#166 TA4-2——multi-uiability-windows proposal.md 仍断言 singleton→standard+showWindowMethod，全文件无 specified/onAcceptWant；最终设计在 design.md:161-185）
- [ ] H10: cli 模板与本地 gen/ohos 手工产物的权限对账 → 🟡（验证前置，非 PR diff 检查）。`gen/ohos/` 被 gitignore、跨 build 存活、手工维护；cli 模板演进（如新增 requestPermissions 条目）不会自动同步进本地 gen——包内权限缺失时系统**静默不调**对应回调（零日志、功能完全无效，不报错不降级）。**检查方法**：① 涉及权限/模板文件（module.json5、requestPermissions）的 PR，装机验证前 `bm dump -n com.tauri.api` 核对装机包实际权限清单 vs cli 模板+预期全集；② 权限敏感功能（依赖系统回调，如 PREPARE_APP_TERMINATE→onPrepareToTerminateAsync）验证失败时，**先查包内权限再查代码**；③ `tauri ohos init` 重建 gen 后逐项核对模板外手工补回的权限清单。（来源：2026-10-08 round-4 真机验证——Exit Confirm #9 首验 ✕ 直关不弹框，根因 cli 模板 405dadbe1 加了 PREPARE_APP_TERMINATE 而本地 gen module.json5 手工维护只带回 1/4，系统零日志不调探针）
