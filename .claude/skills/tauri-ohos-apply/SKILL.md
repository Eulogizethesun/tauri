---
name: tauri-ohos-apply
description: Tauri OHOS 适配实现阶段。使用场景：(1) 设计文档就绪，开始编写代码，(2) 使用 openspec CLI 逐 task 实现，(3) 实现完成后进行审计检查。
---

# Tauri OHOS 实现阶段

本技能直接驱动 openspec CLI 完成实现：加载 change → 逐 task 实现 → 状态追踪 → 审计。

> **openspec 目录说明**：openspec 初始化在 **tauri 仓库根目录**（`<项目根目录>/tauri/`），不是项目根目录。所有 openspec 命令必须在 tauri 仓库目录下执行。

## 状态追踪

使用 Claude TaskList 追踪每个 Step 的执行状态。Agent 不需要靠对话记忆定位自己。

### Guard: 启动时初始化

**每次 skill 被调用时，首先检查 TaskList**：
- 如果 TaskList 非空 → 找到当前 `in_progress` 的 task，从该 step 继续
- 如果 TaskList 为空 → 立即创建以下 task（不可跳过）：

```
TaskCreate: "Step 1: 加载任务 — openspec 查询 change 状态和 task 列表"
TaskCreate: "Step 2: 逐 task 实现 — 编码 + 标记 [x] + 验证状态"
TaskCreate: "Step 3: 审计检查 — spec 符合性 / API 正确性 / 约束遵守 / 平台隔离"
TaskCreate: "Step 4: 完成报告 — openspec status 确认 + 汇总"
```

创建后 TaskUpdate 第一个为 `in_progress`，开始执行。

### 状态流转规则

每个 Step 开始时：`TaskUpdate → in_progress`
每个 Step 完成后：`TaskUpdate → completed`

## 步骤

### Step 1: 加载任务和进度

#### 1a. 检查 change 是否存在

```bash
openspec list --json
```

如果没有 active change，提示用户先使用 **tauri-ohos-design** Skill 创建设计文档。

#### 1b. 获取 apply 指令

```bash
openspec instructions apply --change "<change-name>" --json
```

解析返回的 JSON，获取：
- `contextFiles`：artifact ID → 文件路径映射
- `progress`：`{ total, complete, remaining }`
- `tasks`：任务列表及状态
- `state`：当前状态（`ready` / `blocked` / `all_done`）

#### 1c. 读取上下文文件

读取 `contextFiles` 中列出的所有文件：
- `proposal.md` — what & why
- `design.md` — how
- `tasks.md` — implementation steps
- `specs/` — requirements

#### 1d. 报告当前进度

```
## 实现进度：<change-name>

**总任务**：<total>
**已完成**：<complete>
**剩余**：<remaining>

### 待实现任务
- [ ] Task 1: <description>
- [ ] Task 2: <description>
...
```

**完成后**：TaskUpdate → completed

### Step 2: 逐 task 实现

循环处理每个未完成 task：

1. **报告当前 task**：
   ```
   正在实现 Task N/M: <task description>
   ```

2. **实现代码变更**：
   - 遵循 [`ohos-constraints.md`](../tauri-ohos-design/references/ohos-constraints.md) 中的所有技术约束
   - 所有 OHOS 代码通过 `cfg(target_env = "ohos")` 隔离
   - 调用鸿蒙系统能力必须经过 openharmony-ability
   - NAPI 函数名 snake_case → camelCase 自动转换
   - 禁止 `run_on_main_thread + rx.recv()` 阻塞
   - 实现测试时参考：
     - [ohos-rust-ut Skill](../ohos-rust-ut/SKILL.md) — Rust 单元测试（设备端运行）
     - [frontend-api-testing Skill](../frontend-api-testing/SKILL.md) — 前端 API 测试（auto/side-effect/manual）

3. **标记完成**：在 tasks.md 中将 `- [ ]` 改为 `- [x]`

4. **验证状态**：
   ```bash
   openspec status --change "<change-name>" --json
   ```
   报告进度更新：
   ```
   ✓ Task N/M 完成  (Progress: X/Y)
   ```

5. **遇到阻塞时**：
   - 任务不清晰 → 读取 design.md/specs 获取更多上下文，仍不清则询问用户
   - 设计缺陷 → 建议更新 design.md，暂停等待用户确认
   - 编译错误 → 报告错误，尝试修复

**完成后**：TaskUpdate → completed

### Step 3: 审计（所有 task 完成后）

所有 task 实现完成后，读取 `references/audit-checklist.md` 逐项检查：

#### 3.1 Spec 符合性
- design.md 中定义的每个功能点是否都已实现？
- 不支持的 API 是否按设计做了 stub/fallback？
- 接口签名是否与 spec 一致？

#### 3.2 OHOS API 正确性
- 使用 **arkts-helper MCP** 核对：
  - NAPI 调用方式是否正确？
  - ArkTS 代码是否符合 ArkUI 框架规范？
  - 是否有更新的 API 可以替代当前用法？

#### 3.3 约束遵守
- 对照 [`ohos-constraints.md`](../tauri-ohos-design/references/ohos-constraints.md) 检查：
  - cfg 隔离是否正确？
  - 是否有 `run_on_main_thread + recv()` 死锁风险？
  - TSFN 是否用了 `callee_handled::<false>()`？
  - NAPI 函数名是否正确（camelCase）？
  - 是否有全局 Mutex 中转 TSFN 数据？

#### 3.4 平台隔离
- Windows/macOS/Linux 原有实现是否未受影响？
- 是否有遗漏的 cfg gate？
- Linux 依赖是否加了 `not(target_env = "ohos")` 排除？

#### 3.5 新通用约束发现
- 本次实现是否发现新的 OHOS 通用约束（不在 `ohos-constraints.md` 中的模式）？
- 如有发现，记录并建议更新 [`ohos-constraints.md`](../tauri-ohos-design/references/ohos-constraints.md)

#### 3.6 修复审计问题
- **必须修复**：死锁风险、cfg 遗漏、NAPI 调用错误、平台隔离问题
- **建议修复**：代码风格、性能优化、文档补充
- 修复后重新审计相关检查项

**完成后**：TaskUpdate → completed

### Step 4: 完成报告

```bash
openspec status --change "<change-name>"
```

**输出汇总**：
```
## 实现完成：<change-name>

**进度**：<total>/<total> tasks complete ✓

### 已完成
- [x] Task 1
- [x] Task 2
...

### 审计结果
- Spec 符合性：✓ / ✗ (问题: ...)
- OHOS API 正确性：✓ / ✗
- 约束遵守：✓ / ✗
- 平台隔离：✓ / ✗

### 下一步
使用 tauri-ohos-verify Skill 进行构建部署和测试。
```

**完成后**：TaskUpdate → completed（最后一个 task）

## 参考文档

- [审计清单](references/audit-checklist.md) — 完整的审计检查项
- [技术约束](../tauri-ohos-design/references/ohos-constraints.md) — OHOS 开发约束
- [ohos-rust-ut Skill](../ohos-rust-ut/SKILL.md) — Rust 单元测试（设备端交叉编译 + 运行）
- [frontend-api-testing Skill](../frontend-api-testing/SKILL.md) — 前端 API 测试编写
- [ohos-build Skill](../ohos-build/SKILL.md) — 构建部署、设备日志、排错
