---
name: tauri-ohos-pr-babysit
description: Tauri OHOS PR 自动巡检。使用场景：(1) 定期扫描所有仓库的 open PR 并自动检视，(2) 发现跨仓关联 PR 并一起检视，(3) 作者 push 新代码后自动重新检视。通过 /loop 驱动，每小时执行一次。
---

# Tauri OHOS PR 自动巡检

本技能实现 PR baby-sitting 功能：定期扫描所有关联仓库的 open PR → 过滤已检视且无更新的 PR → 关联分组 → 本地拉取 → 代码检视 → 对抗性自检 → 提交 review 到 GitHub。

> **驱动方式**：通过 `/loop` 命令触发，由 `/loop` 的内置调度机制实现周期性执行。
>
> **独立性**：本 skill 拥有完整的检视流程，不依赖 `tauri-ohos-code-review` skill。检视时复用其 references（checklist、report template、GitHub API 参考）。

## 状态追踪

使用 Claude TaskList 追踪每个 Step 的执行状态。

### Guard: 启动时初始化

**每次 skill 被调用时，首先检查 TaskList**：
- 如果 TaskList 非空 → 找到当前 `in_progress` 的 task，从该 step 继续
  - 如果 Step 4 为 in_progress → 检查 Group 子任务，找到第一个 pending/in_progress 的 Group，继续该组
  - 如果所有 Group 已完成 → Step 4 completed，进入 Step 5
- 如果 TaskList 为空 → 立即创建以下 task（不可跳过）：

```
TaskCreate: "Step 1: 扫描所有仓库的 open PR"
TaskCreate: "Step 2: 过滤 — 识别需要 (re-)review 的 PR"
TaskCreate: "Step 3: 关联分组 — 按作者和主题聚合 PR"
TaskCreate: "Step 4: 逐组检视 — checkout + diff + review + verify + submit + cleanup"
TaskCreate: "Step 5: 汇总报告"
TaskCreate: "Step 6: Checklist 演进 — 提取通用规则"
```

> Step 4 的 Group 子任务在 Step 3 完成时动态创建（见 Step 3 "持久化分组结果"）。

创建后 TaskUpdate 第一个为 `in_progress`，开始执行。

## 前置条件

- `gh` CLI 已安装并认证（`gh auth status` 通过）
- 所有关联仓库已在本地克隆（路径在 `D:\workspace\tauri\` 下）

## 步骤

### Step 1: 扫描所有仓库的 open PR

遍历所有关联仓库，收集全部 open PR。

#### 仓库列表

| 仓库 | 远端 |
|------|------|
| tauri | Eulogizethesun/tauri |
| tao | Eulogizethesun/tao |
| wry | Eulogizethesun/wry |
| muda | Eulogizethesun/muda |
| tray-icon | Eulogizethesun/tray-icon |
| openharmony-ability | Eulogizethesun/openharmony-ability |
| plugins-workspace | Eulogizethesun/plugins-workspace |
| sentry-tauri | Eulogizethesun/sentry-tauri |
| window-vibrancy | Eulogizethesun/window-vibrancy |

#### 执行

对每个仓库执行：

```bash
gh pr list --repo Eulogizethesun/<repo> --state open --json number,title,author,headRefName,createdAt,isDraft,url
```

将所有结果汇总为扁平列表，每条记录包含 `repo` 字段标记来源仓库。

#### ⚠️ Guard: 禁止使用记忆/快照中的 PR 编号列表

**每次 Step 1 必须重新调用 `gh pr list` 获取全量 open PR，不得用上一轮的记忆或硬编码编号列表代替。** 这是不可绕过的强约束。

历史教训：曾因贪图省 API 调用，把 Step 1 的动态扫描替换成硬编码的 PR 编号快照（如 `for entry in "tauri 56" "tauri 55" "tauri 54" ...; do`）。该快照是某轮的静态副本，之后从不更新 → **新开的 PR（实际发生过 #58/#13/#16/#37/#59 等）永远不会进入扫描，长期无人 review**，直到用户手动指出才发现。

正确做法（每轮 Step 1 必须执行，不可用记忆代替）：

```bash
for repo in tauri tao wry muda tray-icon openharmony-ability plugins-workspace sentry-tauri window-vibrancy; do
  gh pr list --repo "Eulogizethesun/$repo" --state open --json number --jq '.[].number'
done
```

API 成本可接受且**不是优化目标**：9 次 `gh pr list` + 每个开放 PR 2 次查询（commits + reviews）。漏检新 PR 的代价（用户发现、信任损失）远高于多调几次 API。若为减少轮次而想"复用上轮列表"——禁止，必须重新扫描。详见 `references/pr-discovery.md`「反模式」一节。

#### 输出

```
## Step 1: PR Scan
Scanned 9 repos, found 8 open PRs:
  - tauri#25: "feat(menu): add dark mode" by contributor-x
  - tauri#26: "fix: crash on startup" by contributor-y
  - tao#8: "feat(menu): add dark mode support" by contributor-x
  - wry#12: "feat: window vibrancy for ohos" by contributor-z
  - muda#3: "feat: menu bar dark mode" by contributor-x
  - openharmony-ability#15: "fix: TSFN callback" by contributor-y
  - sentry-tauri#2: "feat: add ohos support" by contributor-w
  - window-vibrancy#1: "feat: initial ohos impl" by contributor-z
```

TaskUpdate → completed，进入 Step 2。

### Step 2: 过滤 — 识别需要 (re-)review 的 PR

对每个 PR 判断是否需要 review（或 re-review）。

#### 判断逻辑

```
对每个 PR (repo, N):

1. 跳过 draft PR:
   如果 isDraft == true → 跳过，标记 reason: "draft"

2. 获取 PR 最新 commit 时间:
   gh pr view N --repo Eulogizethesun/<repo> --json commits \
     --jq '.commits[-1].committedDate'

3. 获取当前认证用户:
   gh api user --jq .login

4. 获取我们上次的 review 记录:
   gh api repos/Eulogizethesun/<repo>/pulls/N/reviews \
     --jq '[.[] | select(.user.login == "<my_login>")] | sort_by(.submitted_at) | last'

5. 判断:
   - 无 review 记录 → needs_review: true, reason: "new"
   - latest_commit_date > last_review_date → needs_review: true, reason: "updated"
   - latest_commit_date <= last_review_date → needs_review: false, reason: "already_reviewed"
```

> ISO 8601 时间戳可直接字符串比较（字典序 = 时间序）。

#### 输出

```
## Step 2: Filter Results
PRs needing review: 5
  - tauri#25: NEW (never reviewed)
  - tao#8: NEW (never reviewed)
  - muda#3: NEW (never reviewed)
  - sentry-tauri#2: UPDATED (new commits since last review)
  - window-vibrancy#1: NEW (never reviewed)

Skipped: 3
  - tauri#26: already reviewed, no new commits
  - wry#12: already reviewed, no new commits
  - openharmony-ability#15: draft PR
```

如果没有需要 review 的 PR → 跳到 Step 5（输出空报告）→ Step 6（Checklist 演进，通常无新项）。

TaskUpdate → completed，进入 Step 3。

### Step 3: 关联分组 — 按作者和主题聚合 PR

将需要 review 的 PR 分组，以便跨仓关联检视。

#### 分组算法

1. **按作者聚合**：将所有 PR 按 `author.login` 分组
2. **按主题二次聚合**：同一作者的多个 PR，根据 title 关键词相似度进一步分组
   - 去掉 type prefix（`feat(...)`, `fix:` 等），按空格分词，转小写
   - 过滤停用词：`feat, fix, refactor, chore, docs, test, add, support, for, the, a, an, ohos, oh, harmony, initial, impl, implementation`
   - 如果两个 PR 的 title 共享 ≥1 个关键词 → 合并为一组（传递性：A↔B, B↔C → A,B,C 同组）
   - 无关键词重叠 → 保持独立组

> 详细算法见 `references/pr-discovery.md`

#### 持久化分组结果

分组完成后，**必须**将结果写入 TaskList，为每个组创建独立子任务：

```
对每个组 G_i:
  TaskCreate: "Group i/N: <author> / <topic> — <PR列表>"
  TaskUpdate G_i: addBlockedBy: ["Step 3 task"]
```

示例：
```
TaskCreate: "Group 1/3: contributor-x / menu dark mode — tauri#25, tao#8, muda#3"
TaskCreate: "Group 2/3: contributor-z / window vibrancy — window-vibrancy#1"
TaskCreate: "Group 3/3: contributor-w / sentry ohos — sentry-tauri#2"
```

同时输出到对话：

```
## Step 3: PR Groups
Group 1: author=contributor-x, topic="menu dark mode" (3 PRs)
  - tauri#25: "feat(menu): add dark mode"
  - tao#8: "feat(menu): add dark mode support"
  - muda#3: "feat: menu bar dark mode"
...
```

TaskUpdate Step 3 → completed，进入 Step 4。

### Step 4: 逐组检视

**核心规则：一次只处理一个组。完成当前组的 4a→4f 全流程后，才进入下一组。**

#### 执行流程

```
while TaskList 中存在 pending 的 Group task:
  1. 选取第一个 pending 的 Group task
  2. TaskUpdate → in_progress
  3. 依次执行 4a → 4b → 4c → 4d → 4e → 4f（全部针对本组 PR）
  4. TaskUpdate → completed
  5. 回到循环开头，选取下一个 pending Group
```

> **禁止**跨组并行处理。一组的分支必须全部清理（4f）后才能 checkout 下一组的分支，
> 否则不同组的分支会互相冲突。

#### 远程名检测

各仓库的 remote 命名不统一，fetch 前必须先检测指向 `Eulogizethesun/<repo>` 的 remote 名：

```bash
cd D:\workspace\tauri\<repo>
# 找到指向 Eulogizethesun 的 remote 名（通常是 eulogizethesun 或 upstream）
REMOTE=$(git remote -v | grep "Eulogizethesun/<repo>" | grep fetch | head -1 | awk '{print $1}')
# 如果找不到，使用 origin（兜底）
REMOTE=${REMOTE:-origin}
```

后续 4a 中的 `git fetch` 统一使用此 `$REMOTE`。

#### 4a. Checkout PR 分支

对组内每个 PR：

```bash
cd D:\workspace\tauri\<repo>

# 记录原始分支名（用于 4f 切回）
ORIGINAL_BRANCH=$(git branch --show-current)

# 保存 uncommitted 改动（仅当有改动时）
if [ -n "$(git status --porcelain)" ]; then
    git stash push -u -m "babysit: $ORIGINAL_BRANCH WIP"
    STASHED=true
else
    STASHED=false
fi

# fetch PR 分支（使用检测到的 remote 名）
git fetch $REMOTE pull/<N>/head:review/pr-<N>

# checkout
git checkout review/pr-<N>
```

**记录到内存**（供 4f 使用）：
- `ORIGINAL_BRANCH`：切回的目标分支
- `STASHED`：是否需要 stash pop
- 如果仓库未克隆 → 标记 "❌ repo not cloned"，跳过该 PR

输出：
```
## 4a: Checkout
✅ tauri → review/pr-25 (original: ohdev, stashed)
✅ tao → review/pr-8 (original: ohdev, clean)
✅ muda → review/pr-3 (original: ohdev, clean)
```

#### 4b. 获取 diff

对组内每个 PR：

```bash
gh pr diff <N> --repo Eulogizethesun/<repo>
```

同时获取变更文件列表：

```bash
gh pr view <N> --repo Eulogizethesun/<repo> --json files --jq '.files[].path'
```

输出：
```
## 4b: Diff
✅ tauri#25: 12 files changed
✅ tao#8: 3 files changed
✅ muda#3: 5 files changed
```

#### 4c. 多轮代码检视（loop-until-dry）

对照 `tauri-ohos-code-review/references/review-checklist.md`（A-H 共 8 大类 22 项）进行多轮检视。

##### Round 1: Diff 扫描 + Checklist 快速检查

按文件分组扫描 diff：
- **代码文件**：`.rs` / `.ets` / `.ts` / `Cargo.toml`（A-G 类检查）
- **仓库配置文件**：`.gitattributes` / `.gitignore`（H 类检查）
- **文档/openspec**：`openspec/` / `doc/`（H3/H5/H6 检查）

##### Round 2: 源码深读 + Openspec 对照

使用 `Agent` 工具并行派发 subagent，每个 subagent 负责一个文件的深度审查：

```
Agent("深度审查 <file_path>"):
  - Read 完整文件源码
  - 检查 cfg gate、错误处理、关联代码同步
  - 对照 openspec design.md 检查实现完整性
  - 输出 findings 列表
```

跨仓场景额外检查：wry↔tauri API 签名一致性、openharmony-ability NAPI 接口匹配。

##### Round 3+: 专项深挖

根据前两轮 findings 模式定向深挖（错误路径、线程安全、API 兼容性、cfg 覆盖）。

##### 退出条件

```
连续 2 轮无新 finding → 退出（dry_count >= 2）
最大轮次：5
```

##### 生成最终 Findings

合并去重后按仓库分组，每个 finding 包含：

```
Finding:
  repo, file, line, severity (🔴/🟡/🔵/ℹ️), category, description, suggestion
```

输出：
```
## 4c: Review Complete (3 rounds)
tauri#25: 5 findings (1 🔴, 2 🟡, 2 🔵)
tao#8: 2 findings (0 🔴, 1 🟡, 1 🔵)
muda#3: 1 finding (0 🔴, 1 🟡, 0 🔵)
```

#### 4d. 对抗性自检 (Adversarial Self-Verify)

对 4c 产出的每个 finding，派发独立 subagent 尝试反驳：

```
Agent("尝试反驳 finding"):
  prompt: |
    你是一个代码检视质疑者。以下是检视发现：

    ## Finding
    - 描述: <description>
    - 文件: <file>:<line>
    - 严重级别: <severity>
    - 分类: <category>

    ## 你的任务
    1. 阅读该文件的完整源码（Read 工具）
    2. 阅读 PR diff
    3. 尝试证明这个 finding 是误报
    4. 给出判断：refuted: true/false + 理由

    ## 偏向规则
    如果不确定，默认 refuted: true。宁可漏掉一个真阳性，也不提交一个误报。
```

**过滤规则**：`refuted: true` → 丢弃；`refuted: false` → 保留；不确定 → 丢弃。

多个 finding 的质疑者可并行派发。

输出：
```
## 4d: Adversarial Verify
tauri#25: 5 findings → 3 survived, 2 refuted
  Refuted: F3 (cfg gate already in parent module), F5 (Mutex::lock unwrap allowed per G2)
tao#8: 2 findings → 2 survived, 0 refuted
muda#3: 1 finding → 1 survived, 0 refuted
```

#### 4e. 提交 review 到 GitHub

使用 `gh api` 对每个 PR 提交 review。API 用法参考 `tauri-ohos-code-review/references/github-review-api.md`。

1. **获取 Head Commit SHA**：
   ```bash
   gh pr view <N> --repo Eulogizethesun/<repo> --json headRefOid --jq '.headRefOid'
   ```

2. **判断 review 类型**：
   - 有 🔴 Blocker → `event: "REQUEST_CHANGES"`
   - 无 Blocker → `event: "COMMENT"`

3. **提交 review**（每个 PR 独立调用）：
   ```bash
   gh api repos/Eulogizethesun/<repo>/pulls/<N>/reviews \
     -X POST --input - <<'ENDJSON'
   {
     "commit_id": "<head_commit_sha>",
     "event": "<event>",
     "body": "## OHOS Code Review — <repo>#<N>\n\n| 🔴 | 🟡 | 🔵 | ℹ️ |\n|---|---|---|---|\n| ... |\n\n详细 inline comments 见下方各文件标注。",
     "comments": [
       {
         "path": "<file_path>",
         "line": <diff_line_number>,
         "side": "RIGHT",
         "body": "<severity> **[<category>]** <description>\n\n<fix_suggestion>"
       }
     ]
   }
   ENDJSON
   ```

4. **行号定位**：`comments[].line` 是 diff 中的行号，不是文件绝对行号。保存 diff 后用 `grep -n` 定位。

输出：
```
## 4e: Reviews Submitted
✅ tauri#25: https://github.com/Eulogizethesun/tauri/pull/25#pullrequestreview-xxx (3 inline comments, COMMENT)
✅ tao#8: https://github.com/Eulogizethesun/tao/pull/8#pullrequestreview-xxx (2 inline comments, COMMENT)
✅ muda#3: https://github.com/Eulogizethesun/muda/pull/3#pullrequestreview-xxx (1 inline comment, COMMENT)
```

#### 4f. 清理本地分支

**必须在本组完成，不可延迟到下一组。** 对组内每个 PR 的仓库：

```bash
cd D:\workspace\tauri\<repo>

# 1. 切回原始分支
git checkout $ORIGINAL_BRANCH 2>&1

# 2. 恢复 uncommitted 改动（仅当 4a 中做了 stash 时）
if [ "$STASHED" = true ]; then
    git stash pop 2>&1 || echo "⚠️ stash pop failed — record for manual fix"
fi

# 3. 删除临时 review 分支
git branch -D review/pr-<N> 2>&1

# 4. 验证工作区干净
git status --short
```

**如果 checkout 失败**（如 review 分支有未提交改动）：
- 先 `git stash push -m "babysit: leftover"` 保存改动
- 再 checkout 原始分支
- 最后删除 review 分支

输出：
```
## 4f: Cleanup
✅ tauri → ohdev (stash popped, branch deleted)
✅ tao → ohdev (clean, branch deleted)
✅ muda → ohdev (clean, branch deleted)
```

**本组 Group task → TaskUpdate completed。** 然后回到 Step 4 开头，选取下一个 pending Group。
所有 Group 处理完毕后进入 Step 5。

### Step 5: 汇总报告

输出本次巡检的完整报告：

```
## PR Babysit Summary — <timestamp>

### Scan
- Repos scanned: 9
- Open PRs found: 8
- Skipped: 3 (2 already reviewed + up-to-date, 1 draft)
- Needing review: 5

### Groups
- Group 1: contributor-x / "menu dark mode" (3 PRs: tauri#25, tao#8, muda#3)
- Group 2: contributor-z / "window vibrancy" (1 PR: window-vibrancy#1)
- Group 3: contributor-w / "sentry ohos" (1 PR: sentry-tauri#2)

### Reviews Submitted

#### Group 1: contributor-x / menu dark mode
| PR | Findings | Review | URL |
|----|----------|--------|-----|
| tauri#25 | 3 (filtered 2) | COMMENT | https://github.com/.../pull/25#pullrequestreview-xxx |
| tao#8 | 2 | COMMENT | https://github.com/.../pull/8#pullrequestreview-xxx |
| muda#3 | 1 | COMMENT | https://github.com/.../pull/3#pullrequestreview-xxx |

#### Group 2: contributor-z / window vibrancy
| PR | Findings | Review | URL |
|----|----------|--------|-----|
| window-vibrancy#1 | 0 | Clean | — |

#### Group 3: contributor-w / sentry ohos
| PR | Findings | Review | URL |
|----|----------|--------|-----|
| sentry-tauri#2 | 3 (filtered 1) | REQUEST_CHANGES (1 🔴) | https://github.com/.../pull/2#pullrequestreview-xxx |

### Totals
- PRs reviewed: 5
- Reviews submitted: 5 (4 COMMENT, 1 REQUEST_CHANGES)
```

TaskUpdate → completed，进入 Step 6。

### Step 6: Checklist 演进 — 提取通用规则

汇总本次巡检所有组、所有 PR 产生的 findings（含被对抗性验证 refuted 的），判断是否有可提取的通用规则应补充到 checklist。

#### 6a. 审视 findings

回顾本次巡检的全部 findings，逐条评估：

- 这个 finding 对应的问题是否是**反复出现的模式**？（同类问题在多个文件/多个 PR 中出现）
- 这个 finding 对应的检查项是否**已经被 checklist 覆盖**？
- 如果未覆盖，是否可以抽象为一个**通用的检查规则**？

**适合提取为 checklist 项的特征**：
- 同类问题在本次巡检中出现 ≥2 次
- 该问题属于 OHOS 适配的特有陷阱，开发者容易忽略
- 可以用一句简洁的规则描述

**不适合提取的情况**：
- 过于具体的代码问题（仅某个函数特有的 bug）
- 已经被现有 checklist 项覆盖（检查是否遗漏而非规则缺失）

#### 6b. 更新 checklist

如果有新的通用规则，读取当前 checklist：

```bash
cat D:\workspace\tauri\tauri\.claude\skills\tauri-ohos-code-review\references\review-checklist.md
```

按以下格式追加新项到对应分类下（A-H）：

```markdown
- [ ] <分类编号><序号>: <规则描述>
```

示例：
```markdown
## G — 代码质量

- [ ] G5: OHOS 平台的 `log` 宏使用 `hilog` 而非 `println!`（`println!` 在 OHOS 上无输出）
```

如果新规则不属于任何现有分类，可新增分类（如 `## I — xxx`）。

#### 6c. Commit + Push + PR

如果 checklist 有变更：

```bash
cd D:\workspace\tauri\tauri

# 确认 remote 配置
git remote -v
# origin = 用户 fork, upstream = Eulogizethesun/tauri

# 确保在 ohdev 分支且是最新
git checkout ohdev
git fetch upstream
git rebase upstream/ohdev

# 提交变更
git add .claude/skills/tauri-ohos-code-review/references/review-checklist.md
git commit -m "chore(review): update review checklist with new items from PR babysit"

# Push 到用户 fork
git push origin ohdev

# 创建 PR 到 upstream
gh pr create \
  --repo Eulogizethesun/tauri \
  --base ohdev \
  --head <your-username>:ohdev \
  --title "chore(review): update review checklist with new items" \
  --body "## Changes\n- 新增 checklist 项，来源于本次 PR 巡检中发现的通用模式\n\n## New Items\n- <列出新增的 checklist 项>"
```

#### 6d. 输出

```
## Step 6: Checklist Evolution
New items added: 2
  - G5: OHOS log 宏使用 hilog 而非 println!
  - H8: OHOS 权限声明需在 module.json5 的 requestPermissions 中

PR created: https://github.com/Eulogizethesun/tauri/pull/XX
```

如果没有新增项：
```
## Step 6: Checklist Evolution
No new items — all findings covered by existing checklist.
```

TaskUpdate → completed。所有 task 完成。

## 错误处理

| 错误场景 | 处理方式 |
|---------|---------|
| `gh` CLI 未安装或未认证 | Step 1 前检测，提示用户 `gh auth login`，终止执行 |
| 某个仓库 `gh pr list` 失败 | 标记该仓库为 "❌ scan failed"，继续其他仓库 |
| 仓库未本地克隆 | 标记 "❌ repo not cloned"，跳过该 PR（仍可通过 `gh pr diff` 远程审查） |
| `git fetch $REMOTE` 失败 | 尝试从 PR 的 head fork 直接 fetch：`git fetch <fork_url> <branch>:review/pr-<N>`；仍失败则标记 "❌ fetch failed" |
| `git checkout` 冲突 | 先 `git stash push -m "babysit: conflict"` 再 checkout；仍失败则跳过该 PR |
| 检视过程异常 | 记录错误，跳过该组，继续下一组 |
| `gh api` review 提交失败 | 保留 findings 内容输出到报告，标记 "❌ submit failed"；常见原因：pending review 冲突、PR 已合并 |
| 所有 PR 都不需要 review | 正常输出空报告，跳到 Step 5 |
| `git stash pop` 冲突 | 记录冲突文件，提示用户手动处理，继续下一组 |
| 4f 清理失败 | 记录未清理的分支，在汇总报告中标注 "⚠️ needs manual cleanup"，不影响后续组 |

## 参考文档

- [PR 发现与分组参考](references/pr-discovery.md) — gh pr list 查询、review 状态检测、分组算法
- [检视清单](../tauri-ohos-code-review/references/review-checklist.md) — OHOS 约束检查清单（A-H 共 22 项）
- [GitHub Review API](../tauri-ohos-code-review/references/github-review-api.md) — gh api + inline comments 用法
- [报告模板](../tauri-ohos-code-review/references/review-report-template.md) — 检视报告格式模板
