# Git 工作流参考

## 仓库拓扑

```
Eulogizethesun/<repo> (upstream, 主仓 — 只接收 PR，不直接 push)
    └── ohdev 分支 (主开发分支)
         ↑
         │ PR (from <your-username>:ohdev)
         │
<your-username>/<repo> (origin, 个人 fork)
    └── ohdev 分支 (个人开发分支)
         ↑
         │ push
         │
本地 ohdev 分支 (工作分支)
```

> **⚠️ 严禁直接 push 到 upstream（Eulogizethesun）。** 所有变更必须通过 PR 从个人 fork 提交。

## Remote 配置

首次设置：

```bash
# origin = 你的个人 fork
git remote set-url origin https://github.com/<your-username>/<repo>.git

# upstream = Eulogizethesun 主仓
git remote add upstream https://github.com/Eulogizethesun/<repo>.git

# 验证 — 确认 origin 是你的 fork，不是 Eulogizethesun
git remote -v
```

如果 clone 自 Eulogizethesun 仓库，需要重新配置：

```bash
git remote rename origin upstream
git remote add origin https://github.com/<your-username>/<repo>.git
```

## Rebase 流程

```bash
# 1. 获取上游最新代码
git fetch upstream

# 2. 将本地 ohdev rebase 到上游最新
git rebase upstream/ohdev

# 3. 如果无冲突，直接 push
git push origin ohdev

# 4. 如果有冲突
#    a. 手动编辑冲突文件
#    b. git add <resolved_files>
#    c. git rebase --continue
#    d. git push origin ohdev
```

## Commit Message 规范

```
<type>(<scope>): <description>

[可选的详细描述]

[可选的脚注]
```

### Type 分类

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 bug |
| `refactor` | 重构（不改变功能） |
| `docs` | 文档变更 |
| `test` | 测试相关 |
| `chore` | 构建/工具链变更 |
| `perf` | 性能优化 |

### 示例

```
feat(menu): add dark mode support for menubar

- Use system color resources ($r('sys.color.*')) instead of hardcoded colors
- Add tao OHOS Window set_theme() implementation
- MenuBar component follows light/dark mode automatically
```

## PR 创建

### gh CLI 安装（如未安装）

```bash
winget install --id GitHub.cli --accept-source-agreements --accept-package-agreements
gh auth login   # 交互式登录
```

### 创建 PR

```bash
# 使用 gh CLI — PR 从个人 fork 提交到 upstream
gh pr create \
  --repo Eulogizethesun/<repo> \
  --base ohdev \
  --head <your-username>:ohdev \
  --title "feat(menu): add dark mode support" \
  --body "## Changes\n- ...\n\n## Testing\n- 120/128 tests pass"
```

### PR Body 模板

```markdown
## Changes
- 简述变更内容

## Impact
- 影响的仓库和模块

## Testing
- Rust UT: X/Y pass
- Frontend auto tests: X/Y pass
- Manual tests: verified on device

## Related
- Closes #issue-number (if applicable)
```
