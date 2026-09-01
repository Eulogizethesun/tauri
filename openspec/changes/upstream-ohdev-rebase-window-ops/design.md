# upstream-ohdev-rebase-window-ops Design

## 背景

上游 PR#45（oha 8 commits）/ PR#20（tao 5）/ PR#73（tauri 9）在旧 ArkHelper TSFN
框架上实现了 window ops 桥接 + cursor grab + 窗口状态回灌 + FloatPage 装饰 +
naturalLayout + inner/outer 补偿。本地 `c40ad0a` 已把桥接整体 pluginize（旧通道
删除）。rebase 是语义移植，不是文本合并。

数据源事实（两侧相同，已核实）：
- ArkTS `win.on("windowRectChange")` 回调的 rect 是**含系统标题栏的外框**（上游
  实测 decorated 窗口 window_rect − content_rect = 146px）
- `content_rect`（XComponent surface rect）只反映**主窗口**（render surface owner，
  oha app.rs `self.rect`，主窗口专属）
- 本地 `window_rects: HashMap<i64, Rect>` per-window 存储（d7de2f4d）是上游没有的资产
- tao `MainEvent::ContentRectChange` 载荷实为 windowRectChange 的外框 rect（按
  window_id 路由）——本地 Resized 事件带 outer 尺寸

## D1. 上游 22 commits 分类判定表

### ① 纯 FFI / 纯 Rust / NAPI 直调——原样并入

| 功能 | 上游实现 | 落点 |
|---|---|---|
| `set_cursor_grab` | dlopen `libnative_window_manager.so` + `OH_WindowManager_LockCursor/UnlockCursor`（API22+），confined-follow 语义，失焦自动释放 | oha `crates/ability/src/window/mod.rs`：`CursorLockApi`/`cursor_lock_api()`/`set_cursor_grab(real_window_id, grab)`/`CursorGrabError`/`WM_ERRORCODE_*` 照搬；**签名改为收 real_window_id**（id 解析上移，见 D3.7） |
| `notify_window_status` | `#[napi] pub fn notify_window_status(window_id: i32, status: i32)` + `drain_pending_window_status()` + `PENDING_WINDOW_STATUS` static（NAPI 直调，不经 ArkHelper） | oha `app.rs`：仿既有 `notify_window_close`/`drain_pending_window_closes` 模式原样并入 |
| `apply_window_status` | `Window::apply_window_status(status: i32)` + `enum WindowStatus`+`From<i32>`，写 visible/fullscreen 镜像位，maximized/minimized 查系统；删两个僵尸 `AtomicBool` | tao mod.rs 原样并入；**先决**：本地 `is_maximized/is_minimized` 当前读镜像位，先改成查系统（`is-maximized`/`is-minimized` action 已有）再删字段 |
| theme global | `static APP_THEME_OVERRIDE: AtomicU8`（0=Light/1=Dark/2=FOLLOW），`theme()` FOLLOW 时回落 config color_mode | tao mod.rs 并入；**保留**本地 `ColorModeExt::set_color_mode` bridge 调用，只把 per-window `theme` 字段换全局 override |
| min/max 缓存 | 4×`AtomicU32`（min/max w/h）：`setWindowLimits` 一次性写四值（0=无限制）非增量，不缓存会互相清零 | tao mod.rs 原样并入（`set_min/max_inner_size` 真实现的前提） |
| FLAG 拦截 | `set_minimized/set_maximized` 查 `FLAG_MINIMIZABLE/MAXIMIZABLE`、`set_inner_size` 查 `FLAG_RESIZABLE`（decoration_flags=0 时拒绝） | tao mod.rs 并入，加在现有 facade 版函数开头（与 async 兼容） |

### ② 移植成 WindowPlugin bridge action（7 个）

全部扩展现有 `ohos.window` 插件（plugins/window/WindowPlugin.ets 现有 19 action），
**不建新插件**。每个 action：ArkTS interface（字段全 camelCase）→ invokeAsync 分发 →
`plugin-window::WindowClient` async 方法 → tao `runtime.spawn` fire-and-forget。

| action | ArkTS 实现 | API 门控 | tao 调用方 |
|---|---|---|---|
| `set-topmost` | `win.setWindowTopmost(bool)` | API14+，需 `WINDOW_TOPMOST` 权限 | `set_always_on_top` |
| `set-title` | `win.setWindowTitle(string)` | API9+ | `set_title`（Float 也支持） |
| `set-limits` | `win.setWindowLimits(minW,minH,maxW,maxH)` | API11+ | `set_min/max_inner_size`（配 4×AtomicU32 缓存） |
| `request-user-attention` | `notificationManager.publish()` + `requestEnableNotification()` 回退；**notif id 单调递增计数器存插件实例字段**（上游 review 修复） | — | `request_user_attention`（不传 windowId） |
| `set-ime-position` | `inputMethod.getController().updateCursor(CursorInfo)`；**直接 await 返回结果**（放弃上游 poll 模式——invokeAsync 本身是 Promise） | API10+ | `set_ime_position`（物理像素） |
| `set-draggable` | `win.enableDrag(bool)`；**API20 守卫**（上游 review 修复，<20 时 undefined TypeError） | API20+ | `drag_resize_window` |
| `get-real-window-id` | `win.getWindowProperties().id` | — | `set_cursor_grab` 前置（见 D3.7） |

静态 import：`notificationManager`（@kit.NotificationManager）、`inputMethod`
（@kit.IMEKit）——**必须静态 import**（print 无对话框先例：动态 import 在 bridge
上下文失效）。

### ③ 纯 ArkTS 修复——手动等价迁移（上游 patch 基于已删除/重写的文件）

| 修复 | 迁移目标 |
|---|---|
| 主窗口 show 用 `restore()`（`showWindow()` 无法从 MINIMIZE 恢复主窗口） | WindowManager `showWindowMethod` + WindowPlugin `show` action（加 `isUIAbilityMainWindow` 判断） |
| hide 统一 `minimize()`（去 `hideAbility`） | WindowManager `hideWindow` |
| `getDecorationFlag` + minimize/maximize/destroy 拦截 + createSubWindow 初始化 flags | WindowManager |
| `setPointerStyle` 用 `getWindowProperties().id` 真实 ID + console 降级（C5） | WindowManager |
| FloatPage：标题文本 + min/max/恢复按钮 + `isMaximized` + `startMoving`(API14，带 sdkApiVersion<14 守卫) 替换 PanGesture + windowStatusChange 注册（**注册后 seed 初始态**） | FloatPage.ets |
| DefaultWebview `naturalLayout`：无显式 bounds 不设 width/height，`updateWebviewStyle` 剥离 | DefaultWebview.ets + tauri `with_bounds` OHOS 留空（e4930fc） |
| windowStatusChange 注册 + seed | NativeAbility.ets onWindowStageCreate |

### ④ 文档/skill/openspec

纯新增直接取上游（frontend-api-testing、review-checklist C6/E4/F4/G10/G11、
openspec p1/p2-cursor-grab、doc/*.md、cursor-grab-plan）。`ohos-build/SKILL.md`
取并集（保留本地 hilog 详细版 + footer 轮询 + pack.bat 陷阱；吸收上游 @tauri
junctions 注意事项）。`tauri-ohos-init/SKILL.md` URL 置空取上游。

## D2. inner/outer 混合策略（核心择优决策）

**决策：上游语义 × 本地 per-window 数据底座。**

### 规格定义

```
decor_height(id) = if id 是 Float 子窗口（无系统标题栏） { 0 }
                   else { 主窗口 window_rect_for(0).height − content_rect().height }
                   （上游论证：系统标题栏高度 app 级统一，主窗口差值可作全局标量；
                     clamp ≥ 0；content 未初始化（=0）时取 0）
                   最大化/全屏标题栏消失 → 差值自然归零，自愈

inner_size(id)      = window_rect_for(id) 尺寸 − decor_height(id)（高度方向）
inner_position      = window.top + content.top + decor_height（修实测 146px 漏算 bug）
set_inner_size      = resize(inner + decor_height(id))（写侧补偿，width 不补偿）
outer_size/position = window_rect_for(id) 原样（不变）
```

### 择优依据

| 维度 | 纯本地（inner=outer） | 纯上游（共享 rect 补偿） | 混合 |
|---|---|---|---|
| tao 契约（inner=客户区） | ❌ 差 146px | ✅ | ✅ |
| 多窗口（Float）正确性 | ✅ per-window | ❌ 存主窗口 content 尺寸 | ✅ per-window |
| inner_position 146px bug | ❌ 未修 | ✅ 已修 | ✅ |
| save→restore 幂等 | ✅ | ✅（仅主窗口） | ✅（全窗口） |
| 补偿脆弱性 | 无补偿 | 共享 rect + kind 特判 | 单一标量 + Float 判定 |

Float 判定：**强制用 `Window` struct 既有的 `window_kind: Option<OHOSWindowKind>`
字段**（mod.rs:968，从 builder `pl_attrs.window_kind` 读取）。**禁止 `window_id != 0`
近似**——本地存在多 UIAbility 窗口路径（WindowManager.ets WindowKind 注释：UIAbility
窗口 id 可 >0），id 近似会把 decorated 的多 UIAbility 窗口误判为 Float → decor_height
错 0，inner 语义反向破坏。需核查 createSubWindow（Float）与多 UIAbility 建窗两条路径
均填充 `window_kind`。

**已知限制**（审计 S2，非回归）：Float 子窗口的 inner_position 仍用主窗口
content.top 偏移（content_rect 主窗口专属），Float 自管定位影响有限，与上游行为一致。

### D2-r. decor 实时差竞态与两层修复（Phase 4 真机验证发现）

D2 规格初版用**实时差** `window_rect_for(0).height − content_rect().height` 取
decor_height。真机发现该差值的两个输入**异步更新**：WM rect（windowRectChange，
立即）与 surface rect（XComponent onSurfaceChanged，滞后 10-40ms；启动前端加载
期间滞后 ~10s）。间隙期读取产生垃圾 decor（实测 824/770/292，真值 146），经
inner_size 读回 → setSize 反馈 → window-state 保存污染，复利成**主窗口逐轮缩小**
（用户报告的复现 bug）。

**层1（锁存）**：decor 仅在 surface 事件（两 rect 一致点）锁存
（`app.rs latch_decor_height`）：diff==0 → 0；0<diff≤320 → 锁存；负值/超限拒绝
保留旧值。消费方（tao inner_size/set_inner_size/inner_position）全部改读缓存
`app.decor_height()`。

**层2（事件驱动自校正）**：启动期布局收敛晚于 window-state restore（restore 时
锁存瞬态 70，前端加载后收敛 146）→ restore 派发偏低 76px。修复：`set_inner_size`
经**每窗口常驻 watcher**（`run_decor_watch`，unbounded channel 排序
Dispatch/Decor/Recheck 消息）派发；decor 锁存值变化经 `decor_change_callbacks`
（app.rs，锁内回调契约：仅 lock-free send）推送到 watcher；decor **上向**变化且
窗口高度仍等于上次派发值 → 重派 `req_h + decor_now`。停正规则：decor 下向变化
（menubar 运行时隐藏：内容区自然变大，重派会错误缩外框）/ 外部 resize（高度 !=
上次派发值）/ 新 Dispatch 顶替 / Recheck 预算耗尽（60×500ms，覆盖 resize 未落地
的病态时序，审计 P1-B）。Float 窗口不进 watcher（decor=0，fire-and-forget）。
窗口 Drop 注销回调（双端关通道，watcher 退出）。替代了此前的 15s 轮询版（魔数
漏慢冷启动；轮询间隙误判外部 resize），无定时器周期、慢冷启动（20-30s）仍可校正。
146 分解：系统标题栏 ~66px + 应用 MenuBarRow 40vp×scale2=80px（menubar 运行时可
切换 → decor 动态；MenuBarComponent @State 默认可见，不跨会话持久化）。

### 破坏面与缓解（D7）

- **存量 window-state 文件**（审计 W3 定稿）：旧缓存存 outer 尺寸，混合策略下首次
  restore = `旧outer + decor_height` → **接受一次性长高一个标题栏（≈146px）**，
  不写迁移检测代码（无法可靠区分 stale-outer 与用户有意尺寸；状态文件是缓存，
  长高一次后新 save 存真 inner，永久稳定）。在 doc/OHOS窗口遗留问题.md 记录该
  一次性迁移行为。#46 测试不受影响（同运行内 save→restore 两侧均为新语义）。
- **自动测试基线**：#46 all-flags round-trip 在混合下 save(真 inner)→restore
  (补偿回同 inner) 依然幂等，应保持绿；window-ops 若有 inner_size 数值断言按新
  语义校正（预期 inner = outer − decor_height）。
- **Resized 事件**：载荷是 outer rect（windowRectChange），与 inner_size getter
  语义不同——**事件不改动**（webview sizing 已被 naturalLayout 解耦，Resized 的
  消费者是 tauri resize handler）。

## D3. 移植实现规格

### D3.7 set_cursor_grab 两段式（错误语义保持）

```
tao set_cursor_grab(grab) -> Result<(), ExternalError>:
  1. 同步检查 sdkApiVersion < 22 → Err(NotSupported)（version::init 已有缓存，零开销）
  2. fire-and-forget: runtime.spawn {
       real_id = WindowClient.get_real_window_id(window_id).await?   // bridge
       set_cursor_grab(real_id, grab)                                  // 纯 FFI，任意线程安全
     }
  3. 返回 Ok(())（运行期 FFI 错误 log::warn，不上抛——与 tao 其余 fire-and-forget
     窗口 ops 一致；NotSupported 是唯一必须同步返回的语义）
```

**为何 id 解析在 tao 层而非 oha 内部**（审计 S1 权衡）：依赖方向 plugin-window →
ability（facade 依赖 ability crate，反向会循环依赖），ability crate 的 window/mod.rs
拿不到 WindowClient，无法在 oha 内完成 `get_real_window_id` bridge 调用。两段式是
架构约束下的正确位置，多一次 bridge 往返（毫秒级）可接受。

### D3.8 IME 简化

上游 poll 模式（setImePosition 同步返回 + getImePositionResult 轮询回读）是为绕开
旧通道同步限制。新架构 `set-ime-position` action 内直接 `await updateCursor()`，
Promise resolve/reject 即结果——**不实现 `get-ime-position-result`**。examples/api
cmd.rs 的 `get_ime_position_result` 命令改为调 facade 的
`set_ime_position_with_result`（await 返回 JSON 字符串），前端测试面不变。

### D3.9 theme global

删 per-window `theme: AtomicU8`；`APP_THEME_OVERRIDE: AtomicU8` 全局；`set_theme`
写 override + 保留本地 `set_color_mode` bridge 调用；`theme()` 读 override，FOLLOW
回落 `app.config().color_mode`（ConfigChanged 持续刷新）。`EventLoopWindowTarget::
set_theme` 同步写 override。

## D4. rebase 流程

```
顺序：oha → tao → tauri（每仓 rebase 后 cargo check 0 error 再进下一仓）

oha (ohdev, 5 local commits):
  git rebase upstream/ohdev
  冲突处理：ArkHelper.ets DELETE/MODIFY → 弃上游（rm）
    window/mod.rs → 整文件取本地 + 手动并入 cursor grab FFI 块
    WindowManager/NativeAbility/type.ets/FloatPage/DefaultWebview/app.rs → 取本地 +
    手动应用 ③ 类修复逻辑
    module.json5 → 合并加 2 权限
  然后：② 类 7 个 action 落地（WindowPlugin + plugin-window）

tao (ohdev-adjust, 3 local commits):
  git rebase upstream/ohdev
  冲突处理：mod.rs import 块/Window struct/窗口 ops 函数群 → 逐函数择优
    （架构取本地 facade；上游独有功能按 D1①/D3 移植）
    inner/outer 三函数按 D2 重写（不取任一原版）
  apply_window_status / theme global / min-max 缓存 / FLAG 拦截并入
  platform/ohos.rs: apply_window_status trait 方法并入

tauri (ohdev-adjust, 11 local commits):
  ⚠️ 前置（审计 W1）：工作树有 2026-08-26 上午 stats-union 实验留下的未提交改动
  （= 上游改动中本地未触碰的 9 文件原样子集 + 上游新增未跟踪文件）。
  处置：git stash push -u 保存（不丢弃，可恢复）；stats-union 分支（1bc355a，
  上游改动中本地也改过的 7 个冲突文件的手工 union，含 TestRunner.svelte +655）
  保留作 rebase 冲突解决的参考底稿。
  逐 commit 重放（审计 S3：勿交互式压扁；6b0f6ce 锁卫生与 812db8d facade 改的
  closes drain 区域与上游 status drain 插入点相邻），每步 host cargo check 过了
  再进下一步；冲突解决时对照 stats-union 1bc355a 的 union 结果
  runtime-wry: status drain 块——本地 stash 中的 WIP 已含等价实现（含 unmatched
  warn），取该版本或上游版择优（内容等价）；with_bounds OHOS 留空取上游（e4930fc）
  TestRunner.svelte/cmd.rs/build.rs/capabilities/Cargo.toml/module.json5 模板:
    对照 stats-union 1bc355a 的手工 union 结果落
  cli 模板 module.json5: 加 WINDOW_TOPMOST + LOCK_WINDOW_CURSOR（与本地 ±10 行
  改动合并）；oha native_ability/module.json5 仅加 LOCK_WINDOW_CURSOR（审计 W4，
  与上游一致；WINDOW_TOPMOST 只进 cli 模板 + gen/ohos entry）
  pnpm-lock.yaml: 取任一侧，落地后重跑 pnpm install 再重新生成
  文档/skill 按 D1④
```

## D5. 验证计划

1. **逐仓 cargo check**：oha 双侧（host + aarch64-unknown-linux-ohos）0 error 0
   warning；tao/tauri OHOS target 0 error
2. **架构审计子agent**（落地前）：复核本 design 的分类判定无遗漏（22 commits 逐个
   对账）、D2 混合规格自洽（幂等推演）、cfg 隔离完整、上游 4 个 review 修复等价保留
3. **构建部署**：pack.bat（cmd.exe）重建 HAR → run-tests.sh 全量套件 → 基线
   282✅/1❌(#87)/1⏭️(#272) 持平
4. **手动用例**：cursor grab（需真机 API22+）、set min+max size、set title、
   always on top、IME position（聚焦 input 后）、window state save→restore 两轮
   （验证 D2 幂等：两轮后 inner_size 不变）
5. **faultlog 零新增**：hilog appfreeze 检查

## D6. 风险登记

| 风险 | 缓解 |
|---|---|
| decor_height 瞬态为 0（content 未初始化/事件乱序） | inner_size 短暂偏大，无功能影响；clamp 后不产生负值 |
| Float 误判为 decorated | 强制 `window_kind` 字段判定（D2），禁 id 近似；落地时核查建窗路径填充 |
| 上游 review 修复语义丢失（4 项） | D1③ 表逐项列入 tasks 验收项 |
| examples/api cmd.rs 两边重构区重叠致丢命令 | rebase 后逐一比对 invoke_handler 注册表与 build.rs 命令清单；对照 stats-union union 结果 |
| runtime-wry closes drain 与 status drain 插入点边界冲突（审计 S3） | 逐 commit 重放 + 每步 host cargo check；closes 块取本地，status 块取 stash WIP/上游 |
| 存量 window-state 一次性长高 | D7 定稿：接受一次性跳变，doc 记录，不写迁移代码 |
| pnpm-lock 手合出错 | 不手合，重跑 pnpm install 生成 |

## D8. 落地偏差记录（2026-08-26 实施时）

设计假设与实际架构冲突处，落地时的决策与理由：

### 偏差 a：maximized/minimized 镜像位保留（未删）

design D1② 前置说 "is_maximized/is_minimized 改查系统再删僵尸字段"——该假设
基于上游旧框架存在 `getWindowStatus()` 同步 NAPI getter。本地 facade 架构中
`WindowClient::is_window_maximized` 是 async，而 tao 的 `is_maximized()` 是
sync，无法直接改查系统。决策：保留 AtomicBool 镜像位，写入路径双轨——setter
写意图 + `apply_window_status` 事件回灌真值（FullScreen/Maximize/Minimize/
Floating 四态全回灌 maximized/minimized/visible/fullscreen；SplitScreen 不动
maximized——半屏无法可靠推断）。tao commit 73212e1e 注释块记录了该决策。

### 偏差 b：bridge action 7 个 → 9 个

D1② 列了 7 个 action，落地发现 tao 侧还有两个调用点需要 facade 通道：

1. `set-cursor-icon`（wry cursor_changed 热路径 → WindowManager.setPointerStyle，
   ArkTS 侧内部解析真实 windowId）
2. `set-decoration-flags`（upstream FLAG 位域特性 → WindowManager.
   setDecorationFlags，FloatPage LocalStorage）

oha commit 0696dc0。

### 偏差 c：未移植项（deferred gaps）

- **start_ui_ability 多 UIAbility 建窗**：本地保留 single-UIAbility guard
  （第二个 UIAbility 窗口请求被 tao 拒绝并 log error）。upstream 的
  create_ui_ability_window 系命令/按钮保留在 examples/api（编译通过），
  运行时表现为优雅报错——留作后续专项。
- **set_cursor_visible 维持 no-op**：upstream 自身 TODO-untested，且全局 vs
  窗口级语义未定，不移植。

### 偏差 d：inner_size getter 侧补偿为 D2 补全项

落地时发现 pre-D2 的 inner_size 返回裸 outer rect，而 set_inner_size 已做
+decor_height 补偿——两者不对称导致 save→restore 每轮长高一个标题栏。D2 规格
（getter −decor / setter +decor 幂等闭环）在 tao commit a06d44c1 补全，其中
inner_size 的 per-window `window_rect_for` 取自本地 commit f45745e5（设计时
未预见 rebase 会自动带回该基础设施）。

### 偏差 e：examples/api IME 命令的实现形态

D3.8 说 "set-ime-position 直接 await updateCursor 返回结果（不实现 poll）"。
examples/api 侧落地为：`set_ime_position_test` 改 async 命令直取
WindowClient::set_ime_position 结果存 Rust static；`get_ime_position_result`
读 static（前端回读契约不变，删已不存在的 ArkHelper poll API）。
tauri commit 85904d9。

### 偏差 f：NativeAbility windowStatusChange 的 windowId 字面量 0

upstream NativeAbility.ets 在 onWindowStageCreate 里用 `const windowId =
this.readWindowId()`（多 UIAbility 场景从 want 读，首实例返回 0）。本地单
UIAbility 架构无 readWindowId，rebase 带回的 windowStatusChange 注册块引用裸
`windowId` 标识符 → ArkTS 编译错（Cannot find name 'windowId'）。修正为字面量
`0`（主窗口哨兵，与同方法 line 422/439 的 `windowId: 0` 模式一致）。路由一致性
验证：runtime-wry 按 `w.window_id() == Some(ohos_win_id)` 匹配，tao 主窗口
window_id=Some(0)；Float 子窗口两侧（tao create_os_window 返回值 ↔ FloatPage
LocalStorage windowId）共用 NEXT_WINDOW_ID(从 1 起) 虚拟 id 命名空间，无碰撞。

### 偏差 g：Float 子窗口 maximize/recover 三个平台行为缺陷（2026-08-27 修复+真机验证）

用户报告「子窗口最大化后还原,窗口从创建时的屏幕左边跑到右边」,三层根因:

1. **maximizeSupported 缺失（Fix A）**:API19+ `createSubWindowWithOptions(name,
   {title:'', decorEnabled:false, maximizeSupported:true})` 才允许 Float 子窗口
   `maximize()`;漏传 options 或 maximizeSupported 时报 1300004(□ 点击无反应)。
   API<19 回退 createSubWindow,Float 子窗口不可最大化(系统限制)。
2. **recover() 指针锚定落点(Fix C)**:WMS `recover()` 用 GetFullScreenToFloatingRect
   重算浮动落点——该 API 为**拖离标题栏还原**设计,落点按指针位置锚定,不是
   maximize 前位置(实测 [0,0] 创建 → maximize → recover → [1913,0];二次循环
   [1908,0],每次重算)。修法:WindowManager `preMaximizeRects: Map<number, Rect>`
   在 maximize 前 snapshot(has-guard 防二次最大化覆盖为全屏 rect),recover 后
   `moveTo(saved.left, saved.top)` 回原位(best-effort),removeWindow 清理。两条
   路径均覆盖:FloatPage ❐/□→maximizeWindow/recoverWindow;tao bridge(WindowPlugin
   maximize/recover action)经共享 helper snapshotPreMaximizeRect/
   restorePreMaximizeRect——bridge 路径不能委托 fire-and-forget 的 maximizeWindow
   (调用方 recover 后立即查 is-maximized,须保 await 完成语义)。
3. **startMoving 冒泡抢答(Fix D)**:FloatPage 标题栏 Row `onTouch(TouchType.Down)
   → startMoving()` 对子按钮(❐/—/✕)触摸同样触发(ArkUI onTouch 冒泡)。最大化态
   下按下 ❐ 的**瞬间**(9ms 后)WMS 即拖离还原(指针锚定),窗口移走 → touch-UP
   out of region → click 手势被拒 → onClick 从未执行(hilog 实锤:"this MOVE/UP
   event is out of region, try to reject click gesture")。即用户点 ❐ 实际执行的
   是 WMS 拖离还原,recoverWindow 从未被调用——Fix C 无从生效。修法:isMaximized
   时跳过 startMoving(最大化态牺牲标题栏拖拽,还原走 ❐ 按钮)。同机制曾连带
   最大化态 —/✕ 失效,一并修复。浮动态下按钮点击不受影响(startMoving 无位移
   不干扰 click)。

已知边界(有意不覆盖):menu.ets 主窗口菜单 'maximize' 直调 win.maximize() 不经
快照(主窗口无位置恢复需求,系统管理);tao `set_maximized` 主窗口路径同理。
真机验证 2026-08-27:hilog `maximizeWindow 1 OK` → `recoverWindow 1 OK
(restored pre-maximize rect)`,窗口回原位;tao bridge 路径此前已验证(WMS rect
链 [0,0]→[0,0,3120,1955]→[0,0,1140,760] 位置尺寸均精确恢复)。
