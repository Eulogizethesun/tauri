# 环境安装详细指南

> **路径说明**：以下路径均相对于**项目根目录**（所有仓库的父目录，即 `.mcp.json` 所在目录）。

## arkts-helper MCP

### 前置要求
- Node.js 18+
- npm

### 安装步骤
```bash
cd <项目根目录>
git clone https://github.com/LongLiveY96/arkts-helper-mcp.git
cd arkts-helper-mcp
npm install
npm run build
```

### 配置
在项目根目录的 `.mcp.json` 中添加 mcpServers 配置：
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

### AI 问答认证（可选）
匿名模式有次数限制。如需解除：
1. 登录 developer.huawei.com
2. F12 → Network → 使用智能问答提问
3. 找到 dialog/submission 请求，复制 Cookie
4. 调用 `set_ai_auth({ cookie: "你的Cookie" })`

### 故障排查
- `npm install` 失败：检查网络代理设置
- `npm run build` 失败：确认 Node.js 版本 >= 18
- MCP 连接失败：确认 `dist/index.js` 文件存在，且 `.mcp.json` 中路径正确

## OpenSpec CLI

### 安装
```bash
npm install -g @fission-ai/openspec@latest
```

### 项目初始化
```bash
cd <项目根目录>/tauri
openspec init
```

### 更新
```bash
npm install -g @fission-ai/openspec@latest
openspec update
```

### 故障排查
- `openspec: command not found`：确认 npm global 路径在 PATH 中
- `openspec init` 失败：确认在 tauri 仓库根目录（有 Cargo.toml 的目录）

## Superpowers Plugin

### 安装（Claude Code）
```
/plugin install superpowers@claude-plugins-official
```

### 提供的核心能力
- **brainstorming** — 苏格拉底式设计讨论
- **test-driven-development** — RED-GREEN-REFACTOR 循环
- **systematic-debugging** — 4 阶段根因分析
- **subagent-driven-development** — subagent 驱动开发 + 两阶段审查
- **requesting-code-review** — 代码审查

## 关联仓库

所有仓库需要在项目根目录下并列存在，通过 tauri 的 `Cargo.toml [patch.crates-io]` 引用：

```
<项目根目录>/
├── tauri/
├── tao/
├── wry/
├── muda/
├── tray-icon/
├── openharmony-ability/
└── .mcp.json
```

### 仓库地址与分支

| 仓库 | 远端地址 | 默认分支 |
|------|----------|----------|
| tauri | https://github.com/Eulogizethesun/tauri.git | ohdev |
| tao | https://github.com/Eulogizethesun/tao.git | ohdev |
| wry | https://github.com/Eulogizethesun/wry.git | ohdev |
| muda | https://github.com/Eulogizethesun/muda.git | ohdev |
| tray-icon | https://github.com/Eulogizethesun/tray-icon.git | ohdev |
| openharmony-ability | https://github.com/Eulogizethesun/openharmony-ability.git | ohdev |

### 克隆缺失仓库

```bash
cd <项目根目录>
git clone -b ohdev https://github.com/Eulogizethesun/<repo>.git
```
