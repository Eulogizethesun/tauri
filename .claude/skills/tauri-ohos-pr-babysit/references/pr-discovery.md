# PR 发现与分组参考

## ⚠️ 反模式：硬编码 PR 编号列表

**Step 1 每轮必须重新执行 `gh pr list` 全量扫描，禁止用记忆/快照/上轮列表代替。** 对应 SKILL.md Step 1 的 Guard。

```bash
for repo in tauri tao wry muda tray-icon openharmony-ability plugins-workspace sentry-tauri window-vibrancy; do
  prs=$(gh pr list --repo "Eulogizethesun/$repo" --state open --json number --jq '.[].number')
  for pr in $prs; do
    # 对每个 PR 查 commits + reviews 做过滤（Step 2）
  done
done
```

## gh pr list 查询

### 基本查询

```bash
gh pr list --repo Eulogizethesun/<repo> --state open --json number,title,author,headRefName,createdAt,isDraft,url
```

返回 JSON 数组：

```json
[
  {
    "number": 25,
    "title": "feat(menu): add dark mode support",
    "author": { "login": "contributor-x" },
    "headRefName": "contributor-x/dark-mode",
    "createdAt": "2026-06-20T10:30:00Z",
    "isDraft": false,
    "url": "https://github.com/Eulogizethesun/tauri/pull/25"
  }
]
```

### 批量查询所有仓库

```bash
REPOS="tauri tao wry muda tray-icon openharmony-ability plugins-workspace sentry-tauri window-vibrancy"

for repo in $REPOS; do
  echo "=== $repo ==="
  gh pr list --repo Eulogizethesun/$repo --state open \
    --json number,title,author,headRefName,createdAt,isDraft,url \
    --jq '.[] | "\(.number)\t\(.title)\t\(.author.login)\t\(.isDraft)\t\(.url)"'
done
```

---

## Review 状态检测

### 判断 PR 是否需要 (re-)review

核心逻辑：比较 **最新 commit 时间** 与 **上次 review 时间**。

#### 1. 获取当前认证用户

```bash
gh api user --jq '.login'
```

#### 2. 获取 PR 最新 commit 时间

```bash
gh pr view <N> --repo Eulogizethesun/<repo> --json commits \
  --jq '.commits | sort_by(.committedDate) | last | .committedDate'
```

返回 ISO 8601 时间戳：`"2026-06-22T08:15:00Z"`

#### 3. 获取我们的上次 review 时间

```bash
gh api repos/Eulogizethesun/<repo>/pulls/<N>/reviews \
  --jq '[.[] | select(.user.login == "<my_login>")] | sort_by(.submitted_at) | last | .submitted_at'
```

- 如果有 review → 返回时间戳字符串
- 如果无 review → 返回 `null`

#### 4. 比较判断

```
if last_review is null:
    → needs_review = true, reason = "new"

elif latest_commit_date > last_review_date:
    → needs_review = true, reason = "updated"
    # 作者在上次 review 后又 push 了新 commit

else:
    → needs_review = false, reason = "already_reviewed"
    # 已 review 且没有新提交
```

#### 时间比较方法

ISO 8601 时间戳可以直接字符串比较（字典序 = 时间序）：

```bash
# Bash 中比较
if [[ "$latest_commit_date" > "$last_review_date" ]]; then
    echo "needs re-review"
fi
```

### 特殊情况

| 情况 | 处理 |
|------|------|
| PR 有多个 commit | 取最新一个的 `committedDate` |
| Review 被 dismiss 或删除 | `reviews` API 不返回 → 视为 "new" |
| Force push（rewrote history） | `commits` 列表会更新，`committedDate` 反映最新 |
| PR 已 merge 或 closed | `gh pr list --state open` 不会返回，不会进入流程 |

---

## 分组算法

### 输入

扁平的 PR 列表（Step 2 过滤后）：

```
[
  { repo: "tauri",  number: 25, author: "contributor-x", title: "feat(menu): add dark mode" },
  { repo: "tao",    number: 8,  author: "contributor-x", title: "feat(menu): add dark mode support" },
  { repo: "muda",   number: 3,  author: "contributor-x", title: "feat: menu bar dark mode" },
  { repo: "tauri",  number: 26, author: "contributor-x", title: "fix: crash on startup" },
  { repo: "wry",    number: 12, author: "contributor-z", title: "feat: window vibrancy" },
]
```

### 算法

```
Step 1: 按 author.login 分桶
  contributor-x → [tauri#25, tao#8, muda#3, tauri#26]
  contributor-z → [wry#12]

Step 2: 同作者内，按 title 关键词二次分组
  提取 title 关键词:
    tauri#25: ["menu", "dark", "mode"]
    tao#8:    ["menu", "dark", "mode", "support"]
    muda#3:   ["menu", "bar", "dark", "mode"]
    tauri#26: ["crash", "startup"]

  关键词重叠矩阵:
    tauri#25 ↔ tao#8:   共享 ["menu", "dark", "mode"] → 合并
    tauri#25 ↔ muda#3:  共享 ["menu", "dark", "mode"] → 合并
    tauri#25 ↔ tauri#26: 无共享 → 不合并
    tao#8 ↔ muda#3:     共享 ["menu", "dark", "mode"] → 已同组
    tauri#26: 孤立 → 独立组

结果:
  Group 1: contributor-x / "menu dark mode" → [tauri#25, tao#8, muda#3]
  Group 2: contributor-x / "crash startup"  → [tauri#26]
  Group 3: contributor-z / "window vibrancy" → [wry#12]
```

### 关键词提取规则

从 PR title 中提取有意义的关键词（排除以下停用词）：

```
停用词: feat, fix, refactor, chore, docs, test, add, support, for, the, a, an,
        ohos, oh, harmony, initial, impl, implementation
```

提取方法：
1. 去掉 type prefix（`feat(...)`, `fix:` 等）
2. 按空格和标点分词
3. 转小写
4. 过滤停用词
5. 剩余词作为关键词

### 合并阈值

- 两个 PR 共享 **≥1 个关键词** → 合并为同组
- 传递性：A↔B 合并，B↔C 合并 → A,B,C 同组（union-find）

---

## 边缘情况

### Draft PR

`isDraft: true` 的 PR 直接跳过。作者在 draft 中标记为 "work in progress"，不应 review。

### 空 PR（无文件变更）

`gh pr view N --json files --jq '.files | length'` 返回 0 → 跳过，标记 "empty PR"。

### 超大 PR（文件数 > 50）

正常 review，但在报告中特别标注 "⚠️ large PR (N files)"。Review skill 的 loop-until-dry 可能需要更多轮次。

### PR 有冲突

`git fetch origin pull/N/head:review/pr-N` 不会受冲突影响（它直接 fetch commit，不 merge）。但如果 review skill 需要 rebase 到 ohdev，冲突会导致失败 → 跳过该 PR，报告 "has conflicts with base branch"。

### 关联 PR 中部分仓库缺失

如果分组中某个 PR 的仓库在本地不存在 → 跳过该 PR，报告 "repo not cloned: <repo>"。其他 PR 继续 review。

---

## 对抗性验证策略

### 目的

Review skill 的 Step 2f 对所有模式（PR 检视、本地 commit 检视、batch mode）执行对抗性自检，在提交前过滤掉 false positive。误报会损害审查者信任，因此每个 finding 都必须经过独立质疑。

### 质疑者 Prompt 设计

```
你是一个代码检视质疑者。你的工作是尝试推翻以下检视发现。

## Finding
- 描述: <description>
- 文件: <file>:<line>
- 严重级别: <severity>
- 分类: <category>
- PR diff 中该行的内容: <diff_context>

## 你的任务
1. 阅读完整文件源码（Read 工具）
2. 阅读 PR diff（gh pr diff）
3. 尝试证明这个 finding 是误报：
   - 代码是否真的有问题？还是质疑者理解有误？
   - 是否有上下文信息（注释、文档、调用方）使其合理？
   - 建议的修复是否可行？会不会引入新问题？

4. 给出判断：
   - refuted: true — 误报，理由: ...
   - refuted: false — 确认真阳性，理由: ...

## 偏向规则
如果不确定，默认 refuted: true。宁可漏掉一个真阳性，也不提交一个误报。
```

### 验证统计

Review skill 在 Step 2f 输出验证统计：

```
Adversarial Verify: 12 findings → 9 survived, 3 refuted
  Refuted:
    - tauri#25 F3: cfg gate already present in parent module
    - tauri#25 F5: unwrap is on Mutex::lock (allowed per checklist G2)
    - sentry-tauri#2 F2: callback pattern is correct for this API
```
