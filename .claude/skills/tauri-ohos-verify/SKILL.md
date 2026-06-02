---
name: tauri-ohos-verify
description: Tauri OHOS 适配验证阶段。使用场景：(1) 代码实现和审计通过后需要构建部署和测试，(2) 测试失败需要定位问题，(3) 测试通过后需要可选 commit、归档和整理手动用例。
---

# Tauri OHOS 验证阶段

本技能直接驱动构建和测试流程：构建部署 → 运行测试 → 问题定位 → 归档。

> **openspec 目录说明**：openspec 初始化在 **tauri 仓库根目录**（`<项目根目录>/tauri/`），不是项目根目录。所有 openspec 命令必须在 tauri 仓库目录下执行。

> **前提**：测试用例已在 tauri-ohos-design 阶段（openspec propose/spec）设计完成，写入 specs/ 和 tasks.md。本阶段只负责执行测试和排查失败。

## 状态追踪

使用 Claude TaskList 追踪每个 Step 的执行状态。Agent 不需要靠对话记忆定位自己。

### Guard: 启动时初始化

**每次 skill 被调用时，首先检查 TaskList**：
- 如果 TaskList 非空 → 找到当前 `in_progress` 的 task，从该 step 继续
- 如果 TaskList 为空 → 立即创建以下 task（不可跳过）：

```
TaskCreate: "Step 1: 构建-测试循环 — 构建部署 + 检查报告 + 问题修复（循环直到通过）"
TaskCreate: "Step 2: 可选 Commit — 询问用户是否提交当前 Phase 修改"
TaskCreate: "Step 3: 归档 — openspec archive + 更新 plan 文件"
TaskCreate: "Step 4: 整理手动用例 — 追加到 doc/manual_tests.md"
```

创建后 TaskUpdate 第一个为 `in_progress`，开始执行。

### 状态流转规则

每个 Step 开始时：`TaskUpdate → in_progress`
每个 Step 完成后：`TaskUpdate → completed`

注意：Step 1 是一个**循环**（构建 → 测试 → 修复 → 重建），整个循环期间保持 `in_progress`，直到测试全部通过后才标 `completed`。

## 步骤

### Step 1: 构建-测试循环

此步骤包含内部循环，直到测试全部通过。

#### 1a. 构建部署到设备

使用 [ohos-build Skill](../ohos-build/SKILL.md) 进行一键构建部署：

```bash
source .claude/skills/ohos-build/scripts/env.sh
bash .claude/skills/ohos-build/scripts/run-tests.sh "" desktop
```

详细的环境配置、设备日志、HAR 重建、排错指南见 ohos-build Skill。

脚本自动完成：
1. 检测 openharmony-ability 变更，自动重建 HAR
2. 前端构建 + Rust 交叉编译
3. 签名打包 HAP
4. 卸载旧版 → 安装 → 启动
5. 等待 30s → 拉取测试报告

#### 1b. 检查测试报告

读取 `test-report.md` 的内容：
- ✅ 通过
- ❌ 失败
- ⏭️ 跳过

**如果全部通过** → 标记 TaskUpdate → completed，进入 Step 2（可选 Commit）

**如果有失败** → 进入 1c（问题定位），然后回到 1a 重新构建

#### 1c. 问题定位与修复

读取 `references/troubleshooting-guide.md`，按失败类型选择排查路径：

##### Freeze / 卡死
```bash
hdc shell "ls -lt /data/log/faultlog/faultlogger/ | grep appfreeze | head -5"
hdc shell "cat /data/log/faultlog/faultlogger/appfreeze-最新文件名"
```
常见原因：`run_on_main_thread + recv()` 死锁、全局 Mutex 数据竞态

##### Crash / 崩溃
```bash
# JS crash
hdc shell "ls -lt /data/log/faultlog/faultlogger/ | grep jscrash.*tauri | head -5"
hdc shell "cat /data/log/faultlog/faultlogger/jscrash-com.tauri.api-最新文件名"

# C++ crash
hdc shell "ls -lt /data/log/faultlog/faultlogger/ | grep cppcrash.*tauri | head -5"
```

##### 静默无效果
```bash
hdc shell hilog -r
hdc shell "hilog -x | grep '关键词'"
```
常见原因：NAPI 函数名 snake_case（应用 camelCase）、`Function::call()` 在 render 上下文

##### 编译失败
- 检查 cfg gate 是否遗漏 Linux 排除
- 检查 `not(target_env = "ohos")` 是否正确添加

##### 分层定位策略
1. 先确认是 Rust 层还是 ArkTS 层（看 hilog 哪层有报错）
2. Rust 层 → 检查 cfg gate、NAPI 调用、线程模型
3. ArkTS 层 → 检查组件生命周期、事件注册、异步竞态
4. 无报错但无效果 → 大概率是静默失败

修复问题后 → **回到 1a 重新构建部署**

### Step 2: 可选 Commit

测试全部通过后，询问用户是否要在归档前提交当前 Phase 的代码修改。

#### 2a. 询问用户

使用 **AskUserQuestion** 询问：
> "当前 Phase 测试已全部通过，是否需要在归档前 commit 当前修改？"

- 用户选择 **跳过** → TaskUpdate → completed，进入 Step 3（归档）
- 用户选择 **Commit** → 继续 2b

#### 2b. 扫描并过滤文件

读取 [tauri-ohos-submit 的文件过滤规则](../tauri-ohos-submit/references/commit-filter.md)，扫描所有关联仓库的变更并按规则过滤。

#### 2c. Commit

列出待提交文件清单，供用户确认后执行：

```bash
cd <repo_path>
git add <filtered_files>
git commit -m "<type>(<scope>): <description>"
```

**完成后**：TaskUpdate → completed，进入 Step 3（归档）

### Step 3: 归档

执行 openspec 归档和 plan 状态更新：

#### 3a. 验证 openspec change 状态

```bash
openspec status --change "<change-name>" --json
```

确认所有 task 已完成。

#### 3b. 执行 openspec 归档

```bash
openspec archive --change "<change-name>"
```

归档到 `openspec/archive/` 目录下。openspec/ 目录已纳入 git，归档文件会被提交。

#### 3c. 确认归档完成

```bash
openspec list --json
```

确认该 change 已不在 active changes 列表中。

#### 3d. 更新 plan 文件

读取 `openspec/{feature}-plan.md`，将当前 Phase 的状态更新为 `✓ 已归档`。

**完成后**：TaskUpdate → completed

### Step 4: 整理手动用例

读取 `references/manual-test-template.md`，将本次适配的手动测试用例追加到 `doc/manual_tests.md`：
- 按模块追加（Tray/Menu/...）
- 使用统一格式：一级场景/二级场景/三级场景/用例名称/级别/前置条件/步骤/预期结果/备注
- 级别分为 T0（冒烟必测）和 T1（重要回归）

**完成后**：TaskUpdate → completed（最后一个 task）

### 完成报告

```
## 验证完成：<change-name>

### 测试结果
- 自动测试：<X> 通过 / <Y> 失败 / <Z> 跳过
- 手动测试：已整理到 doc/manual_tests.md

### 构建-测试循环
- 总构建次数：<N> 次（含修复后重建）

### 归档
- 位置：openspec/archive/<change-name>/
- 状态：✓ 已归档

### 下一步
- 如有更多 Phase，回到 tauri-ohos-design 处理下一个 Phase
- 如全部完成，使用 tauri-ohos-submit 提交代码
```

## 参考文档

- [ohos-build Skill](../ohos-build/SKILL.md) — 构建部署、设备日志、HAR 重建、排错
- [ohos-rust-ut Skill](../ohos-rust-ut/SKILL.md) — 设备端 Rust 单元测试
- [问题排查指南](references/troubleshooting-guide.md) — 常见失败模式、分层定位
- [手动用例模板](references/manual-test-template.md) — 用例格式模板
