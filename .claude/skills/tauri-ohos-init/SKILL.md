---
name: tauri-ohos-init
description: Tauri OHOS 环境初始化。使用场景：(1) 新成员首次加入项目搭建开发环境，(2) 环境出问题需要重新安装工具，(3) 检测关联仓库是否就绪。
---

# Tauri OHOS 环境初始化

本技能引导完成 Tauri OHOS 适配项目的环境搭建和检测。

> **路径说明**：以下路径均相对于**项目根目录**（所有仓库的父目录，即 `.mcp.json` 所在目录）。tauri 仓库本身是项目根目录下的 `tauri/` 子目录。

## 状态追踪

使用 Claude TaskList 追踪每个 Step 的执行状态。

### Guard: 启动时初始化

**每次 skill 被调用时，首先检查 TaskList**：
- 如果 TaskList 非空 → 找到当前 `in_progress` 的 task，从该 step 继续
- 如果 TaskList 为空 → 立即创建以下 task（不可跳过）：

```
TaskCreate: "Step 1: 安装 arkts-helper MCP"
TaskCreate: "Step 2: 安装 OpenSpec CLI"
TaskCreate: "Step 3: 提示用户安装 Superpowers Plugin"
TaskCreate: "Step 4: 检测并克隆关联仓库"
TaskCreate: "Step 5: 环境状态汇总"
```

创建后 TaskUpdate 第一个为 `in_progress`，开始执行。

## 步骤

### Step 1: 安装 arkts-helper MCP

arkts-helper 提供 ArkTS/ArkUI 文档检索和华为官方 AI 问答能力。

1. 检查项目根目录下 `.mcp.json` 中是否已有 `arkts-helper` 配置
2. 如已配置，报告 "✓ arkts-helper MCP 已安装"，跳到 Step 2
3. 如未配置：
   ```bash
   cd <项目根目录>
   git clone https://github.com/LongLiveY96/arkts-helper-mcp.git
   cd arkts-helper-mcp
   npm install
   npm run build
   ```
4. 将 MCP 配置添加到项目根目录的 `.mcp.json` 的 `mcpServers` 字段：
   ```json
   {
     "mcpServers": {
       "arkts-helper": {
         "command": "node",
         "args": ["<项目根目录的绝对路径>/arkts-helper-mcp/dist/index.js"]
       }
     }
   }
   ```
   > **注意**：`.mcp.json` 的 `args` 中需要使用**绝对路径**。请根据实际项目根目录位置填写。
5. 报告 "✓ arkts-helper MCP 安装成功"

> **注意**：`.mcp.json` 包含本地绝对路径，属于个人配置，不要提交到 git。

### Step 2: 安装 OpenSpec CLI

OpenSpec 提供 spec-driven 工作流（explore/propose/apply/archive）。

1. 检查 `openspec --version` 是否可执行
2. 如可执行，报告 "✓ OpenSpec 已安装 (vX.X.X)"，跳到 Step 3
3. 如不可用：
   ```bash
   npm install -g @fission-ai/openspec@latest
   ```
4. 在 tauri 仓库目录初始化（如果 openspec/ 目录不存在）：
   ```bash
   cd <项目根目录>/tauri
   openspec init
   ```
5. 报告 "✓ OpenSpec 安装成功"

### Step 3: 安装 Superpowers Plugin

Superpowers 提供 TDD、systematic debugging、subagent 驱动开发等方法论。

1. 提示用户手动执行：
   ```
   /plugin install superpowers@claude-plugins-official
   ```
2. 说明 Superpowers 提供的能力：brainstorming、TDD、systematic debugging、code review 等

### Step 4: 检测关联仓库

检测项目根目录下的关联仓库是否存在（所有仓库与 tauri 仓库并列）：

| 仓库 | 相对路径（相对项目根目录） | 远端地址 | 默认分支 |
|------|--------------------------|----------|----------|
| tauri | `tauri` | https://github.com/Eulogizethesun/tauri.git | ohdev |
| tao | `tao` | https://github.com/Eulogizethesun/tao.git | ohdev |
| wry | `wry` | https://github.com/Eulogizethesun/wry.git | ohdev |
| muda | `muda` | https://github.com/Eulogizethesun/muda.git | ohdev |
| tray-icon | `tray-icon` | https://github.com/Eulogizethesun/tray-icon.git | ohdev |
| openharmony-ability | `openharmony-ability` | https://github.com/Eulogizethesun/openharmony-ability.git | ohdev |

对每个仓库：
- 目录存在 → "✓ <repo> 就绪"
- 目录不存在 → 自动克隆：
  ```bash
  cd <项目根目录>
  git clone -b <默认分支> <远端地址>
  ```
  克隆成功后 → "✓ <repo> 已克隆"
  克隆失败 → "✗ <repo> 克隆失败，请检查网络或手动克隆"

### Step 5: 环境状态汇总

输出汇总表格：

```
## 环境状态

| 组件 | 状态 |
|------|------|
| arkts-helper MCP | ✓ / ✗ |
| OpenSpec CLI | ✓ (vX.X.X) / ✗ |
| Superpowers | ✓ / 需手动安装 |
| tauri | ✓ / ✗ |
| tao | ✓ / ✗ |
| wry | ✓ / ✗ |
| muda | ✓ / ✗ |
| tray-icon | ✓ / ✗ |
| openharmony-ability | ✓ / ✗ |

全部就绪 → 可以开始 OHOS 适配工作。
有缺失项 → 请按上方步骤完成安装。
```

## 参考文档

详细安装说明和故障排查见 [references/setup-guide.md](references/setup-guide.md)。
