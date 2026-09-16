# Test Plan — multi-uiability-windows

> 实现前定稿（2026-09-14），实现完成后按 Phase 直接开测。每用例固定四要素：
> 操作 / 判据 / 证据形态（hilog · 截图 · 套件断言 · 任务卡片）/ 所属 Phase。
> 与 tasks.md 各 Phase 验收项一一对应；design.md §8 盲区专项在 §5 映射收口。

## 1. 回归层（每阶段执行）

| 层 | 内容 | 频率 |
|---|---|---|
| 291 例自动套件 | 基线 **290/291**（唯一失败=已知剪贴板限制） | 每阶段抽跑（建议 ≥30 例：window-ops / window-state / decor / emit / menu 各抽）；Phase 6 全量 |
| Float 专项 5 方法 | `closeWindow` / `setDecorations` / `setWindowBackgroundColor` / `showWindowMethod` / `setDecorationFlags`（D11 按 windowKinds 分支的回归敏感点） | Phase 4、6 |
| 手动套件 | manual_tests.md 既有 169 例中窗口相关章 | Phase 6 |
| 故障面 | `hdc shell faultlog` 零新增 appfreeze；hilog 零 `THREAD_BLOCK_3S` | 每阶段 |

## 2. 分阶段用例矩阵

### Phase 1 — 纯 ArkTS 验证

| # | 用例 | 操作 | 判据 | 证据 |
|---|---|---|---|---|
| P1-1 | 第二实例可起 | `hdc shell aa start -b <bundleName> -a EntryAbility --ps tauri_window_id 1` | 任务卡片出现双实例 | 截图 |
| P1-2 | id 送达 | 同上 | onCreate hilog 收到 `tauri_window_id=1` | hilog |
| P1-3 | **prepare 行为（D12 前置实证）** | 第二实例完成 onWindowStageCreate + loadContent | 记录 `prepare()` 是否抛 `already belongs to active Ability session`；抛 → D12 join 路线必要性实证；不抛 → 记录实际归属 | hilog |
| P1-4 | tray 不重复 spawn | standard 下点 tray icon | 不出现第三实例 | 任务卡片 |
| P1-5 | E13 时序观测 | 双实例并存期间操作 | 记录 onCreate 不被 await 的竞态窗口表现 | hilog |
| P1-6 | mobile 形态 | P1-1~P1-3 在 mobile 设备重复 | OQ1 结论落档（允许结论=mobile 维持 singleton） | 记录 |

### Phase 2 — Rust 握手 + tao guard

| # | 用例 | 操作 | 判据 | 证据 |
|---|---|---|---|---|
| P2-1 | 建窗端到端 | examples/api `create_ui_ability_window` 按钮 | 新窗出现，`window_id > 0` | hilog `register_ui_ability_stage: id=N` |
| P2-2 | 事件带对 id | 起第二实例后拖拽 resize | WindowResize 事件 `window_id` == 预分配 id | hilog |
| P2-3 | 主窗无损 | 主窗全功能操作（菜单/输入/窗口 op） | 零回归 | 手动 |
| P2-4 | 无死锁 | 全程 | 零 `THREAD_BLOCK_3S`、零 appfreeze | hilog/faultlog |
| P2-5 | 套件抽跑 | §1 抽样 | ≥ 基线比例通过 | 套件 |

### Phase 3 — 会话与生命周期隔离

| # | 用例 | 操作 | 判据 | 证据 |
|---|---|---|---|---|
| P3-1 | bridge 互不串台 | 双实例各发 bridge 调用（window op / 任意 invoke） | 响应回到发起实例，无串台 | hilog / 前端 |
| P3-2 | 生命周期独立 | 起第二实例（AbilityCreated） | 只重置该 ability 的 session；第一实例生命周期历史保留 | Rust 侧观测 |
| P3-3 | deep-link 各自正确 | 双实例各调 `getCurrent()` | 各返回自己的启动 URI（D9） | 前端 / 套件 |
| P3-4 | WAKER 唤醒对实例 | 第二实例触发事件 | wake 打到对的事件循环（D10） | hilog |
| P3-5 | E1 并发建窗竞态 | 快速连点 / `create_ui_ability_windows_x3` | 三窗 id 各异、无串、无死锁 | hilog / 截图 |
| P3-6 | join 后隔离（R11） | 双实例共享 session 下各自渲染 | renderOwner 各归各、渲染互不覆盖 | hilog / 截图 |

### Phase 4 — 输入路由

| # | 用例 | 操作 | 判据 | 证据 |
|---|---|---|---|---|
| P4-1 | A 窗点击路由 | 主窗（id=0）点击/按键 | 事件派发 `WindowId(0)` | hilog |
| P4-2 | B 窗点击路由 | 第二实例窗点击/按键 | 事件派发 `WindowId(N)`（D5） | hilog |
| P4-3 | IME 跟焦点窗 | 在 B 窗 input 聚焦输入 | IME 事件带 B 的 id | hilog |
| P4-4 | Float 子窗照常 | Float 子窗全操作 | ArkWeb 内部消费路径无变化 | 手动 |
| P4-5 | Float 5 方法专项 | §1 Float 层 | 零回归 | 套件/手动 |

### Phase 5 — launchType 迁移

| # | 用例 | 操作 | 判据 | 证据 |
|---|---|---|---|---|
| P5-1 | tray 恢复不重复 | 主窗最小化 → 点 tray | restore 既有实例，无新任务卡片 | 任务卡片 |
| P5-2 | 其余两调用点 | menu.ets / StatusBarUtils / AppControlPlugin 三路径恢复 | 同上（D4 三调用点全量） | 任务卡片 |
| P5-3 | 建窗走新实例 | `create_ui_ability_window` | 产生**新**任务卡片（standard 语义生效） | 截图 |

### Phase 6 — 全量回归与残留

| # | 用例 | 操作 | 判据 | 证据 |
|---|---|---|---|---|
| P6-1 | 反复建销 ×10 | 建/销第二实例循环 10 轮（E4） | `PENDING_UI_ABILITIES` / `sessions` / `render_owners` / want-URI map 无残留（D13） | Rust 侧观测 |
| P6-2 | 291 全量 | 全套件 | ≥ 基线 290/291 | 套件 |
| P6-3 | E2 最小化恢复 | 第二实例最小化 → 恢复 | onWindowStageRestore 链正确、内容不白屏 | 手动/截图 |
| P6-4 | E3 任务卡片切换 | 双实例互切 | 焦点事件成对（Gained/Lost 落对实例） | hilog |
| P6-5 | 双形态 | desktop + mobile 全套 | OQ1 最终结论落文档 | 记录 |
| P6-6 | ohpm 净重建 | 删 oh_modules + CompileArkTS 缓存重建后复跑 | 全绿复验（R6） | 套件 |

## 3. 测试钩子（须随实现落地，否则"直接开测"不成立）

- **新增命令 `get_current_window_id`**（examples/api，Phase 2/3 一并实现）：前端回读本实例
  windowId——一条命令验 D3 全链（want.parameters → abilityWindowId → LocalStorage → 前端可见）。
- **复用既有**：`create_ui_ability_window`（cmd.rs:923）、`create_ui_ability_windows_x3`（build.rs:56）、
  deep-link `getCurrent()`。
- **OQ5 依赖声明**：第二实例当前只加载默认 MainPage（非测试前端）。若 D1 的 url 参数不可达
  新实例 webview（Phase 2 判定），P3-1/P3-3 的前端证据形态降级为 hilog/Rust 侧观测——**判据不变，
  证据形态换**；此降级不算失败。
  （2026-09-16 注：降级未触发——url 可达，机制为 wry 待队列在 stage 注册后投递
  WebviewCreateRequest，spawned 窗渲染 hello.html；P3-1/P3-3 均取前端证据，OQ5 已定案。）

## 4. 观测 runbook

```bash
# 起第二实例（Phase 1 手动 / 全程兜底）
hdc shell aa start -b <bundleName> -a EntryAbility --ps tauri_window_id 1

# hilog 关键字（每用例按需 grep）
register_ui_ability_stage   # 握手回报（P1-2/P2-1）
start-ui-ability            # D1 bridge action 发出
already belongs             # D12 prepare 冲突（P1-3）
render_owner                # D12.3 归属（P3-6）
THREAD_BLOCK_3S             # 死锁零容忍（P2-4）

# 故障面
hdc shell faultlog | grep -i appfreeze   # 零新增

# ArkTS 改动后（每 Phase）
删 oh_modules + CompileArkTS 缓存 → pack.bat 重建 HAR（R6）
```

## 5. 盲区映射（design §8 E1-E17 → 本计划用例收口）

E1→P3-5 · E2→P6-3 · E3→P6-4 · E4→P6-1 · E5→P3-4 · E6→P2-4/Phase 2 判据 ·
E8→P4-1/2/3 · E9→文档已知限制（NG2，不设用例） · E10→window-state label 唯一性约定（文档） ·
E12→OQ6（tray 恢复目标，Phase 5 后决策） · E13→P1-5 · E15→NG4 不变量声明（不设用例） ·
E16→Path C deprecated 注释（无生产调用方） · E17→NG4

## 6. OQ 验证出口

OQ1→P1-6/P6-5 · OQ2→Phase 4 实测（Float 从第二实例 stage 创建；不可行则文档化挂 primary） ·
OQ3→P3-6 后二选一 · OQ4→Phase 3（ohos_dispatch_exit 经 windowId 路由） · OQ5→P2 判定 ·
OQ6→Phase 5 后（tray pendingAction 单值随决策处理）
