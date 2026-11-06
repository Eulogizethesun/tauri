# Tauri OHOS 适配工作流指南

> 本文档面向项目成员，介绍 Tauri OpenHarmony 适配项目的架构、工作流、方法论和常见问题。
> 新成员加入项目时，请先阅读本文档了解全貌。

---

## 第一章：项目全景

### 1.1 四层架构

Tauri OHOS 适配采用四层架构，每层有独立的代码仓库：

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Tauri App (用户代码)                               │
│  └── WebviewWindowBuilder / Menu / Tray / Event / Path ...  │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: tauri-runtime-wry (胶水层)                        │
│  └── WindowBuilder → tao, WebViewBuilder → wry             │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: tao + wry (平台抽象)                               │
│  └── platform_impl/ohos/ → OHOS 窗口/WebView 实现           │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: openharmony-ability (Rust + ArkTS 桥接)           │
│  └── NAPI/TSFN ↔ ArkUI ↔ OHOS 系统 API                    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 代码仓库拓扑

所有仓库在项目根目录下并列存放：

| 仓库 | 路径 | 职责 | 远端地址 | 默认分支 |
|------|------|------|----------|----------|
| **tauri** | `tauri` | 主框架 | github.com/Eulogizethesun/tauri.git | ohdev |
| **tao** | `tao` | 窗口管理抽象 | github.com/Eulogizethesun/tao.git | ohdev |
| **wry** | `wry` | WebView 渲染抽象 | github.com/Eulogizethesun/wry.git | ohdev |
| **muda** | `muda` | 菜单系统 | github.com/Eulogizethesun/muda.git | ohdev |
| **tray-icon** | `tray-icon` | 系统托盘 | github.com/Eulogizethesun/tray-icon.git | ohdev |
| **openharmony-ability** | `openharmony-ability` | NAPI 桥接层（唯一 ArkTS 桥接仓） | github.com/Eulogizethesun/openharmony-ability.git | ohdev |

所有仓库通过 `tauri/Cargo.toml` 的 `[patch.crates-io]` 指向本地路径。

### 1.3 文档索引

| 文档 | 内容 |
|------|------|
| `doc/ohos-workflow-guide.md` | 本文档（项目概览 + 工作流 + 排错） |
| `CLAUDE.md` | 三条铁律 + 技术约束引用（agent 入口） |
| `.claude/skills/tauri-ohos-design/references/ohos-constraints.md` | 完整 OHOS 技术约束 |
| `doc/menu/` | Menu 模块设计文档归档（14 phases） |
| `doc/tray/` | Tray 模块设计文档归档（9 phases） |
| `doc/ohos_feature/` | 基础编译适配归档（4 phases） |
| `doc/manual_tests.md` | 手动测试用例归档 |
| `openspec/` | openspec 工作目录（初始化在 tauri 仓库根目录下，非项目根目录） |
| `openspec/changes/` | 活跃的 openspec change（proposal/design/specs/tasks） |
| `openspec/archive/` | 已归档的 openspec change |
| `openspec/{feature}-plan.md` | 功能级 Phase 拆分计划和进度 |

---

## 第二章：开发环境

### 2.1 环境搭建

使用 `tauri-ohos-init` skill 完成环境搭建，它会自动：
1. 安装 arkts-helper MCP（ArkTS/ArkUI 文档检索 + 华为 AI 问答）
2. 安装 OpenSpec CLI（spec-driven 工作流引擎）
3. 检测并克隆缺失的关联仓库

### 2.2 构建部署

```bash
source .claude/skills/ohos-build/scripts/env.sh
bash .claude/skills/ohos-build/scripts/run-tests.sh "" desktop
```

脚本自动完成：检测变更 → 重建 HAR → 前端构建 → Rust 交叉编译 → 签名 → 安装 → 启动 → 拉取测试报告。

---

## 第三章：OHOS 适配通用约束

### 3.1 三条铁律

| # | 铁律 | 说明 |
|---|------|------|
| 1 | **openharmony-ability 是唯一 ArkTS 桥接仓** | 所有仓调用鸿蒙系统能力必须经过 openharmony-ability，禁止直接调用 ArkTS API |
| 2 | **不影响其他平台原有实现** | 所有修改不得影响 Windows/macOS/Linux。OHOS 代码用 `cfg(target_env = "ohos")` 隔离 |
| 3 | **TAURI_OHOS_DEVICE_TYPE 决定设备形态** | `desktop` 启用 tray/menu，`mobile`（默认）不启用 |

### 3.2 约束速查

完整约束详见 [`ohos-constraints.md`](../.claude/skills/tauri-ohos-design/references/ohos-constraints.md)。

**cfg 隔离**：
- OHOS 的 `target_os` 是 `"linux"` → Linux 依赖必须加 `not(target_env = "ohos")`
- `desktop`/`mobile` 由环境变量编译时决定，不是自动的

**NAPI/TSFN**：
- `snake_case` → `camelCase` 自动转换（用错名字静默失败）
- `callee_handled::<false>()` 必须（true 会插入 null 偏移参数）
- TSFN 数据独立 Box 入队（禁止全局 Mutex 中转 → freeze）

**线程模型**：
- **禁止** `run_on_main_thread + rx.recv()` 阻塞（死锁）

**ArkTS 框架**：
- 模块级 `@Builder` 无 `this`（递归 Builder 必须在 @Component 内）
- `onLoadIntercept` 语义与 Tauri `on_navigation` 相反（必须 `!ret`）

**API 版本管理**：
- tauri api demo 默认 API 版本为 12，使用 > 12 的 API 必须加版本守卫
- 三个版本检测 API：`sdk_api_version()` / `distribution_api_version()` / `can_i_use()`
- 静默跳过是默认降级策略（与 Windows/macOS 一致）

---

## 第四章：新功能适配工作流

### 4.1 整体流程

```
  ┌──────────────────────────────┐
  │     tauri-ohos-design        │
  │  探索 → 拆分 → 生成 → 审计    │──── 每个 Phase 循环
  └──────────────┬───────────────┘
                 ▼
  ┌──────────────────────────────┐
  │      tauri-ohos-apply        │
  │      逐 task 实现 + 审计      │
  └──────────────┬───────────────┘
                 ▼
  ┌──────────────────────────────┐
  │     tauri-ohos-verify        │
  │   构建 → 测试 → 归档          │
  └──────────────┬───────────────┘
                 ▼
  ┌──────────────────────────────┐
  │     tauri-ohos-submit        │
  │   commit → rebase → PR       │
  └──────────────────────────────┘
```

一个完整的功能适配可能包含多个 Phase，每个 Phase 独立走完 design → apply → verify 的循环。

### 4.2 设计阶段（tauri-ohos-design）

设计阶段分为 6 个步骤：

| Step | 内容 | 产出 |
|------|------|------|
| 1 | 理解任务 — 探索代码，统计涉及的层数和文件数 | 探索结果报告 |
| 2 | Phase 拆分 — agent 自动判断，用户确认 | plan 文件 |
| 3 | 方案探索 — 查阅 OHOS API，探索 API 映射 | 探索笔记 |
| 4 | 生成设计文档 — 通过 openspec CLI 生成 | proposal + design + tasks + specs |
| 5 | 方案审计 — 对照官方文档 + 其他 OS 实现 + 约束 | 审计报告 |
| 6 | 验证状态 — 确认所有 artifact 完成 | 就绪报告 |

其中 Step 5 审计发现问题时，直接修改 artifact 文件后重新审计，直到通过。

### 4.3 实现阶段（tauri-ohos-apply）

通过 openspec CLI 加载 task 列表，逐项实现代码变更，完成后执行四维审计（spec 符合性 / API 正确性 / 约束遵守 / 平台隔离）。

### 4.4 验证阶段（tauri-ohos-verify）

构建部署到设备，运行自动测试，失败时按分层策略定位问题。测试全部通过后：
1. 执行 `openspec archive` 归档（归档到 `openspec/archive/`，纳入 git）
2. 更新 plan 文件状态为 `✓ 已归档`

### 4.5 提交阶段（tauri-ohos-submit）

扫描所有关联仓库的变更，过滤自动生成文件，commit → rebase → push → 创建 PR。

---

## 第五章：Phase 拆分方法论

### 5.1 何时拆分

| 条件 | 建议 |
|------|------|
| 涉及 > 2 个代码层（openharmony-ability / muda / tauri / ArkTS） | 拆分 |
| 预估影响文件 > 10 个 | 拆分 |
| 既有底层实现又有上层集成 | 拆分 |
| 只涉及 1 个层且影响文件 ≤ 5 个 | 不拆分 |

### 5.2 底层先行模式

从 menu（14 phases）、tray（9 phases）、ohos_feature（4 phases）的实战中提炼出标准模式：

```
① 编译打通 → ② 底层实现 → ③ 上层集成 → ④ 前端测试 → ⑤ 差距修复
```

| Phase 类型 | 目标 | 涉及层级 | 示例 |
|-----------|------|---------|------|
| ① 编译打通 | 让 OHOS target 能编译 | stub → cfg 解除 | ohos_feature Phase 0-3 |
| ② 底层实现 | NAPI + platform_impl | openharmony-ability + muda/tray-icon | menu Phase 0-3, tray Phase 0-3 |
| ③ 上层集成 | tauri 适配 + 端到端测试 | tauri + examples | menu Phase 4-5, tray Phase 4-5 |
| ④ 前端测试 | frontend API 测试设计和实现 | tauri + frontend-api-testing | auto/side-effect/manual 分类测试 |
| ⑤ 差距修复 | 审计 gap → 修复 → 对等验证 | 跨层 | menu Phase 11-14, tray Phase 6-9 |

> **前端测试 Phase**：涉及多个 Phase 时，在上层集成之后、差距修复之前，增加一个专门的前端 API 测试 Phase。负责设计和实现 `core.ts` / `plugins.ts` 中的测试用例（auto / side-effect / manual 分类），确保前端 API 行为与 Windows/macOS 一致。不涉及前端 API 的功能可跳过。

### 5.3 粒度参考

| 粒度 | 文件数 | 说明 |
|------|--------|------|
| 小型 | 2-5 | 单一关注点，不拆分 |
| **中型（推荐）** | **5-10** | **最常见的舒适粒度** |
| 大型 | 10-15 | 跨切面，考虑拆分 |

上限 15 个文件，超过就该拆。

### 5.4 独立可验证原则

每个 Phase 完成后应能**独立构建和测试**，不需要等所有 Phase 都完成才能验证。

拆分时需考虑：
- 该 Phase 的产出是否可以独立编译？
- 该 Phase 是否有明确的验证标准（单元测试 / 设备端功能验证）？
- 如果某个 Phase 无法独立验证（如纯底层 NAPI 实现），应包含 stub 或 mock 使其可测试

**反面案例**：拆分出"定义所有数据结构"作为独立 Phase，但没有任何功能可以验证 → 应合并到包含功能实现的 Phase 中。

### 5.5 Phase vs Task

| | Phase（规划层） | Task（执行层） |
|---|---|---|
| 粒度 | 5-10 个文件 | 1 个 session 内可完成 |
| 数量 | 一个功能 3-5 个 phase | 一个 phase 5-10 个 task |
| 谁决定 | agent 提出方案，用户确认 | openspec 自动生成 |
| 产出 | 多个 openspec change | 一个 tasks.md |

### 5.6 Plan 文件

Phase 拆分方案确认后，写入 `openspec/{feature}-plan.md`。它记录：
- 所有 Phase 的名称、涉及层、验证方式
- 每个 Phase 的当前状态（○ 待开始 / ● 进行中 / ✓ 设计完成 / ✓ 已归档）
- 各 Phase 之间的依赖关系

**openspec change 命名规范**：`p<N>_<feature-name>`（如 `p1_multi-window`、`p2_multi-window`）

**作用**：
- 会话中断后可恢复进度
- 每个 Phase 归档后更新状态，保留完整历史
- 人类和 agent 都能直观看到整体进度

### 5.7 内部质量循环

每个 Phase 内部都有 **实现 → 审计 → 修复 → 达标** 的循环：
- 审计发现的问题在当前 Phase 内修复，不留到下个 Phase

### 5.8 跨模块共享

- 第一个功能模块承担基础设施建设（NAPI 框架、ArkTS 类型定义）
- 后续模块复用，直接从 platform_impl 开始
- 示例：Menu 和 Tray 共享 Phase 0（muda OHOS backend）

---

## 第六章：常见陷阱与排错

### 6.1 死锁：run_on_main_thread + recv()

**现象**：应用 freeze，无响应

**原因**：Chrome_IOThread 等 ArkTS 主线程，ArkTS 主线程等 Chrome_IOThread → 死锁

**解决方案**：OHOS 上使用直接执行路径，不走 `run_on_main_thread + rx.recv()` 模式；跨线程操作用 TSFN NonBlocking

**预防**：编写 OHOS 代码时，永远不要用阻塞 recv 等待主线程结果

### 6.2 静默失败：snake_case NAPI 调用

**现象**：调用 NAPI 函数无效果，不报错

**原因**：Rust `snake_case` 函数名自动转为 JS `camelCase`，ArkTS 用 snake_case 调用时找不到函数

**解决方案**：ArkTS 代码中使用 camelCase 名称调用 NAPI 函数

### 6.3 语义反转：onLoadIntercept

**现象**：导航被错误拦截或放行

**原因**：OHOS `onLoadIntercept` 返回 `true` = 拦截，Tauri `on_navigation` 返回 `true` = 允许

**解决方案**：ArkTS 层 `return !ret`

### 6.4 异步竞态：Rust 早于 ArkTS controller 就绪

**现象**：WebView 创建后操作无效果

**原因**：Rust 调用 `createWebview()` 时 ArkTS 的 controller 尚未初始化

**解决方案**：使用 `ProxyJsHelper` 代理模式 — 缓存操作，controller 就绪后回放

### 6.5 全局 Mutex freeze：TSFN 数据中转

**现象**：快速连续调用 TSFN 时应用 freeze

**原因**：全局 `Mutex<Option<Data>>` 中转模式在快速调用时产生数据竞态

**解决方案**：每个 TSFN 调用独立 Box 入队，通过泛型参数携带数据

### 6.6 设备日志排查

> **命令前缀说明**：所有命令均在宿主机通过 `hdc shell` 转发到设备执行。`hilog` 是设备端指令，`cat /data/log/...` 是读取设备端文件。

**常规日志**：
```bash
hdc shell hilog -r
hdc shell "hilog -x | grep '关键词'"
hdc shell "hilog -x | grep 'A00000'"   # Rust 日志，domain 为 A00000
```

**Freeze 日志**：
```bash
hdc shell "ls -lt /data/log/faultlog/faultlogger/ | grep appfreeze | head -5"
hdc shell "cat /data/log/faultlog/faultlogger/appfreeze-最新文件名"
```

**Crash 日志**：
```bash
# JS crash
hdc shell "ls -lt /data/log/faultlog/faultlogger/ | grep jscrash | head -5"
hdc shell "cat /data/log/faultlog/faultlogger/jscrash-com.tauri.api-最新文件名"

# C++ crash
hdc shell "ls -lt /data/log/faultlog/faultlogger/ | grep cppcrash | head -5"
```

**分层定位策略**：
1. 先确认是 Rust 层还是 ArkTS 层（看 hilog 中哪层有报错）
2. Rust 层 → 检查 cfg gate、NAPI 调用、线程模型
3. ArkTS 层 → 检查组件生命周期、事件注册、异步竞态
4. 无报错但无效果 → 大概率是静默失败（NAPI 函数名、render 上下文调用）
