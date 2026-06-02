---
name: tauri-ohos-submit
description: Tauri OHOS 代码提交。使用场景：(1) 验证通过后需要提交代码，(2) 需要 push 到个人 fork 并创建 PR，(3) 需要 rebase 上游最新代码。
---

# Tauri OHOS 代码提交

本技能引导完成代码提交流程：多仓库扫描 → 文件过滤 → commit → rebase → push → 创建 PR。

> **openspec 目录说明**：openspec 位于 **tauri 仓库根目录**（`<项目根目录>/tauri/openspec/`），属于 tauri 仓库的 git 管理范围。提交 tauri 仓库时包含 openspec 目录。

## 状态追踪

使用 Claude TaskList 追踪每个 Step 的执行状态。

### Guard: 启动时初始化

**每次 skill 被调用时，首先检查 TaskList**：
- 如果 TaskList 非空 → 找到当前 `in_progress` 的 task，从该 step 继续
- 如果 TaskList 为空 → 立即创建以下 task（不可跳过）：

```
TaskCreate: "Step 1: 扫描多仓库变更"
TaskCreate: "Step 2: 文件过滤"
TaskCreate: "Step 3: Git Add + Commit"
TaskCreate: "Step 4: Fetch + Rebase 上游"
TaskCreate: "Step 5: Push + 创建 PR"
```

创建后 TaskUpdate 第一个为 `in_progress`，开始执行。

## 步骤

### Step 1: 扫描多仓库变更

检查以下关联仓库的 git status（路径相对于项目根目录）：

| 仓库 | 相对路径 |
|------|----------|
| tauri | `tauri` |
| tao | `tao` |
| wry | `wry` |
| muda | `muda` |
| tray-icon | `tray-icon` |
| openharmony-ability | `openharmony-ability` |

对每个仓库执行 `git status --short`，汇总变更情况：
- 有变更的仓库 → 列出变更文件摘要
- 无变更的仓库 → 标记为"无变更，跳过"

### Step 2: 文件过滤

读取 `references/commit-filter.md`，对每个有变更的仓库进行文件过滤。

**需要提交** ✓：
- 源码 (.rs, .ets, .ts, .js)
- 文档 (.md)
- 配置 (Cargo.toml, oh-package.json5, build-profile.json5)
- openspec 设计文档 (`openspec/changes/`, `openspec/archive/`)
- 测试文件 (core.ts, plugins.ts)
- 资源文件 (color.json, media/)

**不提交** ✗：
- 自动生成 (gen/ohos/, build/)
- 构建产物 (.so, .hap, .hsp)
- 依赖目录 (node_modules/, oh_modules/)
- 签名证书 (.p12, .cer, .p7b)
- 测试报告 (test-report.md)
- HAR 包 (ability.har)
- IDE 文件 (.idea/, .vscode/)

列出将要提交的文件清单，供用户确认。

### Step 3: Git Add + Commit

对每个有变更的仓库：

```bash
cd <repo_path>
git add <filtered_files>
git commit -m "<描述性 commit message>"
```

**Commit message 规范**：
- 格式：`<type>(<scope>): <description>`
- type: feat / fix / refactor / docs / test / chore
- scope: 影响的模块名
- description: 简洁描述变更内容
- 示例：`feat(menu): add dark mode support for menubar`

每个仓库独立 commit，不跨仓库混合提交。

### Step 4: Fetch + Rebase 上游

对每个有 commit 的仓库：

```bash
# 确保 upstream remote 存在
git remote -v
# 如果没有 upstream:
# git remote add upstream https://github.com/Eulogizethesun/<repo>.git

git fetch upstream
git rebase upstream/ohdev
```

**如果 rebase 出现冲突**：
1. 提示用户手动解决冲突
2. 用户解决后执行 `git add <conflicted_files>` + `git rebase --continue`
3. 不自动合并冲突

### Step 5: Push + 创建 PR

#### 5a. 确保 gh CLI 可用

检查 `gh --version` 是否可执行。如不可用，自动安装：

```bash
winget install --id GitHub.cli --accept-source-agreements --accept-package-agreements
```

安装后需要用户在终端执行 `gh auth login` 完成认证（交互式流程）。如果 `gh auth status` 显示未登录，提示用户手动登录后再继续。

> **Windows 注意**：winget 安装后 `gh` 可能不在当前 shell 的 PATH 中，需要使用完整路径（如 `/c/Program Files/GitHub CLI/gh.exe`）或重启终端。

#### 5b. 确认 remote 配置

**⚠️ 严禁直接 push 到上游仓库（Eulogizethesun）。** 必须 push 到用户自己的 fork。

对每个有 commit 的仓库，确认 remote 配置：

```bash
git remote -v
```

- `origin` = **用户自己的 fork**（如 `https://github.com/<your-username>/<repo>.git`）
- `upstream` = **Eulogizethesun 主仓**（`https://github.com/Eulogizethesun/<repo>.git`）

如果 `origin` 指向 `Eulogizethesun`，**停止并提示用户**重新配置 remote：

```bash
git remote rename origin upstream
git remote add origin https://github.com/<your-username>/<repo>.git
```

#### 5c. Push + 创建 PR

```bash
git push origin ohdev
gh pr create --repo Eulogizethesun/<repo> --base ohdev --head <your-username>:ohdev --title "<PR title>" --body "<PR body>"
```

**PR 规范**：
- title: 与 commit message 一致或概括多个 commit
- body: 简述变更内容、影响范围、测试结果
- 附上测试报告摘要

报告所有创建的 PR 链接。

## 参考文档

- [文件过滤规则](references/commit-filter.md) — 提交/不提交的文件分类
- [Git 工作流](references/git-workflow.md) — upstream/origin 配置、rebase 指南、PR 规范
