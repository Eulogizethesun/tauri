---
name: tauri-ohos-design
description: Tauri OHOS 适配设计阶段。使用场景：(1) 开始新的 OHOS 功能适配需要做方案设计，(2) 需要进行 Phase 拆分规划，(3) 使用 openspec explore/propose 生成设计文档。
---

# Tauri OHOS 设计阶段

本技能直接驱动 OHOS 功能适配的设计流程：代码探索 → Phase 拆分 → 方案探索 → 文档生成 → 方案审计 → 验证。

> **openspec 目录说明**：openspec 初始化在 **tauri 仓库根目录**（`<项目根目录>/tauri/`），不是项目根目录。所有 openspec 命令必须在 tauri 仓库目录下执行。plan 文件、changes、archive 均位于 `tauri/openspec/` 下。

## 状态追踪

使用 Claude TaskList 追踪每个 Step 的执行状态。Agent 不需要靠对话记忆定位自己。

### Guard: 启动时初始化

**每次 skill 被调用时，按顺序检查**：

1. **检查 plan 文件**：`openspec/{feature}-plan.md` 是否存在？
   - 存在 → 读取 plan 文件，找到第一个状态为 `○ 待开始` 的 Phase
   - 不存在 → 继续检查 TaskList

2. **检查 TaskList**：
   - 非空 → 找到当前 `in_progress` 的 task，从该 step 继续
   - 为空 → 立即创建以下 task（不可跳过）：

```
TaskCreate: "Step 1: 理解任务 — 探索代码，统计涉及的层数和文件数"
TaskCreate: "Step 2: Phase 拆分 — agent 自动判断，写入 plan 文件，用户确认"
TaskCreate: "Step 3: 方案探索 — arkts-helper 查阅 OHOS API"
TaskCreate: "Step 4: 生成设计文档 — openspec CLI 驱动"
TaskCreate: "Step 5: 方案审计 — 对照 arkts-helper 文档和其他 OS 实现审查已生成的文档"
TaskCreate: "Step 6: 验证状态 — openspec status 确认所有 artifact 完成"
```

3. **恢复逻辑**：
   - 如果 plan 文件存在且有待开始的 Phase → 跳过 Step 1-2，从 Step 3 开始（为下一个 Phase 做探索）
   - 否则从头开始

### 状态流转规则

每个 Step 开始时：`TaskUpdate → in_progress`
每个 Step 完成后：`TaskUpdate → completed`
下一个 Step 开始时：自动 `TaskUpdate → in_progress`

## 步骤

### Step 1: 理解任务

1. 询问用户要适配的 OHOS 功能：
   - 对应哪些 Tauri API？
   - 用户期望的目标（完整实现 / 先打通编译 / 最小可用）

2. **openspec explore 探索**（必须执行，不可跳过）：
   使用 `/opsx:explore` 进入探索模式，围绕用户描述的功能进行深度调研：
   - 使用 `mcp__arkts-helper__find_docs` / `mcp__arkts-helper__ask_ai` 了解 OHOS API 能力
   - 使用 Grep/Glob 搜索源码，定位需要修改的文件和模块
   - 统计涉及的代码层数（openharmony-ability / muda / tauri / tauri-runtime-wry / ArkTS）
   - 统计预估影响文件数

3. 向用户汇报探索结果，格式：
   ```
   ## 代码探索结果

   **功能**：<功能名称>
   **涉及代码层**：<层列表>
   **预估影响文件**：<数量> 个
   **关键发现**：
   - <发现 1>
   - <发现 2>
   ```

**完成后**：TaskUpdate → completed

### Step 2: Phase 拆分

根据 Step 1 的代码探索结果，agent 自动判断是否需要拆分。

**判断标准**（agent 自动评估）：
- 涉及 > 2 个代码层 → 拆分
- 预估影响文件 > 10 个 → 拆分
- 既有底层实现又有上层集成 → 拆分
- 只涉及 1 个层且影响文件 ≤ 5 个 → 不拆分

**拆分模式**（底层先行）：
1. 底层实现 — openharmony-ability NAPI + platform_impl
2. 上层集成 — tauri 适配 + 端到端测试
3. 前端测试 — frontend API 测试设计和实现（参考 [frontend-api-testing Skill](../frontend-api-testing/SKILL.md)）
4. 差距修复 — 审计 gap → 修复

> **前端测试 Phase**：涉及多个 Phase 时，在上层集成之后、差距修复之前，增加一个专门的前端 API 测试 Phase。该 Phase 负责设计和实现 `core.ts` / `plugins.ts` 中的测试用例（auto / side-effect / manual 分类），确保前端 API 行为与 Windows/macOS 一致。如果功能不涉及前端 API（纯底层适配），可跳过此 Phase。

**粒度**：每个 Phase 5-10 个文件。上限 15 个文件。

**独立可验证**：每个 Phase 完成后应能独立构建和测试。拆分时考虑：
- 该 Phase 的产出是否可以独立编译？
- 该 Phase 是否有明确的验证标准（单元测试 / 设备端功能验证）？
- 如果某个 Phase 无法独立验证（如纯底层 NAPI 实现），应包含 stub 或 mock 使其可测试

**向用户展示拆分方案并确认**：
```
## Phase 拆分方案

**判断依据**：涉及 N 个代码层，预估 M 个文件

| Phase | 名称 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|--------|---------|---------|
| 1 | <名称> | <层> | <文件列表> | <验证方式> |
| 2 | ... | ... | ... | ... |

是否确认此方案？
```

使用 **AskUserQuestion** 等待用户确认后再继续。

**确认后立即写入 plan 文件**：`openspec/{feature}-plan.md`

```markdown
# {Feature} 适配计划

**创建时间**：2026-06-01
**功能描述**：<用户描述的功能>
**判断依据**：涉及 N 个代码层，预估 M 个文件

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | 编译打通 | p1_{feature} | ● 进行中 | tauri + tao | 5 | cargo check |
| 2 | 底层实现 | p2_{feature} | ○ 待开始 | openharmony-ability + tao | 8 | 单元测试 |
| 3 | 上层集成 | p3_{feature} | ○ 待开始 | tauri + examples | 6 | 设备端测试 |

## Phase 详细说明

### Phase 1: 编译打通
- **目标**：<具体目标>
- **文件列表**：<预估要修改的文件>
- **依赖**：无

### Phase 2: 底层实现
- **目标**：<具体目标>
- **文件列表**：<预估要修改的文件>
- **依赖**：Phase 1 完成

### Phase 3: 上层集成
- **目标**：<具体目标>
- **文件列表**：<预估要修改的文件>
- **依赖**：Phase 2 完成
```

**状态说明**：
- `○ 待开始` — 未开始设计
- `● 进行中` — 正在设计或实现
- `✓ 设计完成` — 设计文档已生成并通过审计
- `✓ 已归档` — 已完成实现、测试并归档

⚠️ **Phase vs Task**：Phase 是 agent 提出的规划建议（"分几步做"），Task 是 openspec 自动生成的执行拆分（"具体动作"）。Agent 负责拆 Phase，openspec 负责拆 Task。

**完成后**：TaskUpdate → completed

### Step 3: 方案探索

**首先读取 plan 文件**，确定当前 Phase：

```bash
# 读取 openspec/{feature}-plan.md
# 找到状态为 "● 进行中" 的 Phase（当前正在做的）
# 如果没有 "● 进行中"，找到第一个 "○ 待开始" 的 Phase，将其更新为 "● 进行中"
```

对用户确认的当前 Phase，agent 直接执行探索：

1. 使用 **arkts-helper MCP** 查阅相关鸿蒙 API：
   - `mcp__arkts-helper__find_docs` 搜索 ArkTS/ArkUI 官方文档
   - `mcp__arkts-helper__ask_ai` 查询华为官方 AI 获取整合回答
2. 探索 Tauri API ↔ OHOS API 映射
3. 识别不支持的 API（需要 stub 或 fallback）
4. 将探索结论整理为文字，作为下一步生成文档的输入

**完成后**：TaskUpdate → completed

### Step 4: 生成设计文档（直接驱动 openspec CLI）

Agent 直接执行 openspec CLI 命令生成 artifact，**不引导用户手动操作**。

#### 4a. 检查已有 changes

```bash
openspec list --json
```

如果已有同名 change，询问用户是继续还是新建。

#### 4b. 创建 openspec change

**命名规范**：`p<N>_<feature-name>`（如 `p1_multi-window`、`p2_multi-window`、`p3_multi-window`）

- `p<N>` — Phase 序号，与 plan 文件中的 Phase 编号对应
- `<feature-name>` — 功能名称，kebab-case，与 plan 文件名 `{feature}-plan.md` 一致

```bash
openspec new change "p<N>_<feature-name>"
```

#### 4c. 获取 artifact 构建顺序

```bash
openspec status --change "<phase-name>" --json
```

解析 JSON，获取：
- `applyRequires`：实现前必须完成的 artifact ID 列表
- `artifacts`：所有 artifact 及其状态和依赖关系

#### 4d. 按依赖顺序生成 artifact

循环处理每个 `ready`（依赖已满足）的 artifact：

1. **获取生成指令**：
   ```bash
   openspec instructions <artifact-id> --change "<phase-name>" --json
   ```
   返回的 JSON 包含：
   - `context`：项目背景（约束，不写入文件）
   - `rules`：artifact 规则（约束，不写入文件）
   - `template`：输出文件的结构模板
   - `instruction`：该 artifact 类型的生成指南
   - `outputPath`：写入路径
   - `dependencies`：需要先读取的已完成 artifact

2. **参考 OHOS 约束**：
   读取 `references/constraints.md`，在生成 artifact 文件时自行遵守这些约束（约束不写入 artifact 文件内容）。

3. **读取依赖 artifact** 获取上下文。

4. **生成 artifact 文件**：
   - 使用 `template` 作为结构
   - 应用 `context` 和 `rules` 作为约束（不复制进文件）
   - 结合 Step 3 探索结论
   - 写入 `outputPath` 指定的路径

5. **报告进度**：
   ```
   ✓ Created <artifact-id>
   ```

6. **重新检查状态**：
   ```bash
   openspec status --change "<phase-name>" --json
   ```
   检查 `applyRequires` 中的 artifact 是否全部 `status: "done"`。

#### 4e. 循环直到 apply-ready

重复 4d 直到所有 `applyRequires` 的 artifact 都完成。

**每个 Phase 的 specs/ 应包含**：
- **功能需求**：本 Phase 要实现的具体功能点
- **测试用例设计**（参考 [frontend-api-testing Skill](../frontend-api-testing/SKILL.md) 和 [ohos-rust-ut Skill](../ohos-rust-ut/SKILL.md)）：
  - `auto`：可自动断言的测试（如 API 返回值、状态变更）
  - `side-effect`：有副作用但可验证的测试（如窗口创建、事件触发）
  - `manual`：需人工确认的测试（如 UI 渲染效果、交互体验）
- **API 映射**：Tauri API ↔ OHOS API 的对应关系
- **边界情况**：不支持的功能、降级行为、错误处理

**完成后**：TaskUpdate → completed

### Step 5: 方案审计

对已生成的设计文档（proposal.md / design.md / tasks.md / specs/）进行审查，对照权威来源确认其正确性。

**审计对象**：刚生成的 artifact 文件，不是凭空审查方案思路。

#### 5a. 对照 OHOS 官方文档

逐项核对 design.md 和 specs/ 中涉及的关键 API：

- 方案中使用的 OHOS API 是否存在？参数签名是否正确？
- API 的版本要求（`since N`）是否满足？（tauri api demo 默认 API 12）
- 是否有更合适的 API 替代方案？
- ArkTS 侧的使用方式是否符合 ArkUI 框架规范？

```rust
// 示例：design.md 中写了使用 statusBarManager.addToStatusBar()
// → 用 find_docs 确认 API 签名、参数、版本要求
// → 用 ask_ai 确认实际使用中的注意事项
```

#### 5b. 对照其他 OS 实现

阅读 tao / wry 中 Windows 和 macOS 的对应实现，确保 design.md 中的设计与它们的设计意图一致：

- **接口一致性**：OHOS 实现暴露的 Rust 接口是否与 Windows/macOS 保持一致？
- **行为一致性**：相同输入在 OHOS 上是否产生与 Windows/macOS 相同的可观察行为？
- **降级模式**：不支持的功能是否按 [ohos-version-isolation Skill](../ohos-version-isolation/SKILL.md) 的模式处理？
- **平台差异显式化**：OHOS 特有的行为（如 Tray 只有 StatusBar 没有系统 tray）是否在 design.md 中显式标注？

#### 5c. 对照 OHOS 约束

读取 `references/ohos-constraints.md`，逐项检查 design.md 和 specs/ 是否踩坑：

- 线程模型：是否有 `run_on_main_thread + recv()` 死锁风险？
- NAPI/TSFN：函数名 camelCase？`callee_handled::<false>()`？
- ArkTS 框架：`@Builder` 上下文？`onLoadIntercept` 语义反转？
- cfg 隔离：是否正确隔离？Linux 依赖是否排除？
- 版本管理：使用了 > 12 的 API 是否标注了版本守卫？

#### 5d. 审计结论

输出审计报告，列出：
- ✅ 已确认正确的设计点
- ⚠️ 需要修改的设计点（附修改建议）
- ❌ 不支持的功能（附 stub/fallback 方案）

**修复循环**：如果审计发现问题：
1. 直接修改对应的 artifact 文件（design.md / specs/ / tasks.md）
2. 修改后重新执行 5a-5c 检查修改的部分
3. 重复直到所有问题都解决

使用 **AskUserQuestion** 确认审计通过后继续。

**完成后**：TaskUpdate → completed

### Step 6: 验证最终状态

```bash
openspec status --change "<phase-name>"
```

**更新 plan 文件**：当前 Phase 的状态改为 `✓ 设计完成`。

**输出汇总**：
```
## 设计文档生成完成

**Change**: <phase-name>
**位置**: openspec/changes/<phase-name>/

### 生成的 Artifact
- [x] proposal.md — <简述>
- [x] design.md — <简述>
- [x] tasks.md — <简述>
- [x] specs/ — <简述>

### 审计结论
<Step 5 的审计结果摘要>

### Plan 进度
<从 plan 文件中读取当前整体进度>

### 下一步
使用 tauri-ohos-apply Skill 开始实现当前 Phase。
```

**如果 plan 文件中还有 `○ 待开始` 的 Phase**：提示用户当前 Phase 实现完成后，回到 Step 3 处理下一个 Phase。

**完成后**：TaskUpdate → completed（最后一个 task）

## 参考文档

- [约束模板](references/constraints.md) — propose 时注入的约束
- [技术约束](references/ohos-constraints.md) — 完整 OHOS 技术约束
- [版本隔离](../ohos-version-isolation/SKILL.md) — API 版本管理最佳实践
- [frontend-api-testing Skill](../frontend-api-testing/SKILL.md) — 前端测试用例设计（auto/side-effect/manual）
- [ohos-rust-ut Skill](../ohos-rust-ut/SKILL.md) — Rust 单元测试设计（设备端运行）
- [ohos-build Skill](../ohos-build/SKILL.md) — 构建部署流程
