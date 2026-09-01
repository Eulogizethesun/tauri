---
name: tauri-ohos-publish
description: 将 openharmony-ability HAR 包发布到 OHPM 三方库中心仓。使用场景：(1) 首次发布配置（账号、密钥），(2) 版本号更新与发布，(3) 发布后审核跟踪。
---

# Tauri OHOS HAR 发布（OHPM）

本技能引导完成 openharmony-ability HAR 包发布到 [OHPM 三方库中心仓](https://ohpm.openharmony.cn) 的完整流程。

> **当前包信息**：`@ylong-rs/ohrs-ability`，源码仓 `Eulogizethesun/openharmony-ability`

## 状态追踪

使用 Claude TaskList 追踪每个 Step 的执行状态。

### Guard: 启动时初始化

**每次 skill 被调用时，首先检查 TaskList**：
- 如果 TaskList 非空 → 找到当前 `in_progress` 的 task，从该 step 继续
- 如果 TaskList 为空 → 立即创建以下 task（不可跳过）：

```
TaskCreate: "Step 1: OHPM 账号与认证配置"
TaskCreate: "Step 2: 包文件准备与修复"
TaskCreate: "Step 3: 构建 HAR 包"
TaskCreate: "Step 4: 发布到 OHPM"
TaskCreate: "Step 5: 发布后处理"
```

创建后 TaskUpdate 第一个为 `in_progress`，开始执行。

## 步骤

### Step 1: OHPM 账号与认证配置

> 仅需首次发布时执行。已配置过则跳过。

#### 1a. 注册 OHPM 账号

1. 打开 https://ohpm.openharmony.cn
2. 点击右上角「注册」，使用手机号或邮箱注册
3. 登录后进入「个人中心」

**提示用户手动完成**：注册是交互式操作，agent 无法代替。

#### 1b. 生成 SSH 密钥对

```bash
ssh-keygen -m PEM -t RSA -b 4096 -f ~/.ssh/ohpm_publish_key
```

> **⚠️ 密码必须非空**：OHPM 要求私钥必须设置非空密码（`Private key without passphrase is not supported`）。如果 `~` 路径展开失败，使用完整路径如 `/c/Users/<username>/.ssh/ohpm_publish_key`。

#### 1c. 上传公钥到 OHPM

1. 登录 OHPM → 个人中心 → 认证管理
2. 点击「新增」
3. 将 `~/.ssh/ohpm_publish_key.pub` 的内容粘贴到公钥输入框
4. 保存

**提示用户手动完成**：上传公钥是 Web 操作。

#### 1d. 定位 ohpm 命令

`ohpm` 通常不在系统 PATH 中，需要从 DevEco Studio 安装目录找到：

```bash
# 查找 ohpm 位置
find /d/ -path "*/tools/ohpm/bin/ohpm" 2>/dev/null | head -1
# 常见路径：/d/PE/softwares/DevEcoStudioRel/tools/ohpm/bin/ohpm

# 设置变量（后续步骤统一使用）
export OHPM=/d/PE/softwares/DevEcoStudioRel/tools/ohpm/bin/ohpm
$OHPM --version
```

> **注意**：如果 `ohpm` 已在 PATH 中（`which ohpm` 能找到），可直接用 `ohpm` 代替 `$OHPM`。

#### 1e. 配置本地 .ohpmrc

```bash
$OHPM config set publish_id <your_publish_id>

# 配置发布地址（OHPM 中心仓）
$OHPM config set publish_registry https://ohpm.openharmony.cn/ohpm

# 配置私钥路径
$OHPM config set key_path ~/.ssh/ohpm_publish_key
```

#### 1f. 验证配置

```bash
$OHPM config list
```

确认 `publish_id`、`publish_registry`、`key_path` 均已设置。

**完成后**：TaskUpdate → completed

### Step 2: 包文件准备与修复

OHPM 发布**必须**包含 4 个文件（缺一不可），位于 `package/` 目录下（`package/` 就是发布包的根目录，OHPM 文档中的"根目录"指的就是这里）：

| 文件 | 要求 | 说明 |
|------|------|------|
| `package/oh-package.json5` | 包含 name、version、description、license | **权威源文件**，在此编辑版本号 |
| `package/README.md` | 非空，包含安装和使用说明 | **权威源文件**，在此编辑 |
| `package/CHANGELOG.md` | 非空，包含版本变更记录 | **权威源文件**，在此编辑 |
| `package/LICENSE` | 非空，实际许可证文本（非引用） | 需确保内容正确 |

> **重要**：`package/` 下的 oh-package.json5、README.md、CHANGELOG.md 是权威源文件，`pack.bat` 不应覆盖它们。根目录的同名文件与发布无关。

#### 2a. 检查包文件

```bash
cd ${PROJECT_ROOT}/openharmony-ability
for f in oh-package.json5 README.md LICENSE CHANGELOG.md; do
  if [ -f "package/$f" ]; then
    echo "✅ $f ($(wc -c < package/$f) bytes)"
    head -3 "package/$f"
  else
    echo "❌ $f MISSING"
  fi
  echo "---"
done
```

#### 2b. 修复 LICENSE 文件

`package/LICENSE` 可能只是 `../LICENSE` 引用文本（broken reference），需要替换为实际内容：

```bash
# 检查是否是 broken reference
head -1 package/LICENSE
# 如果输出 "../LICENSE"，则需要修复：
cp LICENSE package/LICENSE
```

验证：`head -3 package/LICENSE` 应显示 `MIT License` 而非 `../LICENSE`。

#### 2c. 确认 pack.bat 不覆盖发布文件

`pack.bat` 应该：
- ✅ 复制 `.ets` 源码到 `package/src/main/ets/`
- ✅ 仅在 `package/LICENSE` 是 broken reference 时修复
- ❌ **不应**覆盖 `package/CHANGELOG.md`、`package/README.md`、`package/oh-package.json5`

#### 2d. 更新版本号

在 `package/oh-package.json5` 中递增 `version` 字段。

**版本号规则**：
- 正式版：`1.0.0`、`1.1.0`、`2.0.0`
- 预览版：`1.0.0-beta.1`、`1.0.0-beta.2`
- 每次发布**必须**递增，否则 OHPM 拒绝

使用 **AskUserQuestion** 确认新版本号。

#### 2e. 更新 CHANGELOG

在 `package/CHANGELOG.md` **顶部**添加新版本变更记录：

```markdown
# [新版本号]
- feat(webview): add webPageSnapshot support
- fix(webview): add timeout for Promise

---
# [旧版本号]
（已有内容保持不变）
```

#### 2f. 发布前临时修改（不提交到仓库）

以下修改仅用于发布，**发布后必须还原**。这些修改不应提交到上游仓库，因为会影响其他依赖此仓的项目。

**2f-1. 修改发布包名**（影响 3 个文件）：

默认包名：`@ylong-rs/ohrs-ability`

```bash
# package/oh-package.json5 — name 字段
# native_ability/oh-package.json5 — name 字段（ohrs artifact 从此读取生成 module.json5）
# package/README.md — 标题、安装命令、import 语句中的包名
```

使用 **AskUserQuestion** 确认发布包名（默认 `@ylong-rs/ohrs-ability`）。

**2f-2. 修改 repository URL**（影响 1 个文件）：

默认值：`https://github.com/Eulogizethesun/openharmony-ability.git`

```bash
# package/oh-package.json5 — repository 字段改为发布者的仓库地址
```

#### 2g. 包名一致性检查

**⚠️ 审核常见驳回原因**：README 中的安装命令包名与 `oh-package.json5` 的 `name` 不一致。

修改包名后，必须检查以下所有位置是否一致：

```bash
# 搜索所有旧包名引用（替换 OLD_NAME 为新包名）
grep -rn "旧包名" package/ --include="*.md" --include="*.json5" --include="*.ets" --include="*.ts"
```

需要检查的文件：
- `package/oh-package.json5` — `name` 字段
- `package/README.md` — 标题、安装命令、import 语句
- `native_ability/oh-package.json5` — `name` 字段（**重要**：`ohrs artifact` 从此文件读取模块名生成 `package/src/main/module.json5`）
- `package/src/main/module.json5` — `name` 字段（由 `ohrs artifact` 自动生成，改 `native_ability/oh-package.json5` 后重跑 `pack.bat` 即可更新）

#### 2g. 确认 OHPM 组织已创建

如果使用 `@group/package` 格式的包名，`group` 对应的组织必须已在 OHPM 上创建并完成认证。否则发布会报 `Failed to verify the OHPM package group` 错误。

**提示用户**：OHPM → 个人中心 → 组织管理 → 创建组织并完成认证。

**完成后**：TaskUpdate → completed

### Step 3: 构建 HAR 包

#### 3a. 运行 pack.bat

```bash
cd ${PROJECT_ROOT}/openharmony-ability
source ${PROJECT_ROOT}/tauri/.claude/skills/ohos-build/scripts/env.sh
./pack.bat
```

`pack.bat` 完成：
1. 清除 `package/src/main/ets/` 和 `dist/`
2. 从 `native_ability/src/main/ets/` 复制源码到 `package/src/main/ets/`
3. 运行 `ohrs artifact --skip-libs` 生成构建产物（会**自动生成** `package/src/main/module.json5`，其中 `name` 取自 `oh-package.json5`）
4. 修复 `package/LICENSE`（如果是 broken reference）

> **注意**：`pack.bat` 不会覆盖 `package/CHANGELOG.md`、`package/README.md`、`package/oh-package.json5`，这些是权威源文件。

#### 3b. 打包 HAR

```bash
cd ${PROJECT_ROOT}/openharmony-ability
tar -czf ohrs-ability.har package/
```

#### 3c. 验证 HAR 内容

```bash
# 检查 HAR 包含所有必需文件
tar -tzf <har_file> | grep -E "oh-package.json5|README.md|LICENSE|CHANGELOG.md"
```

应输出 4 个文件路径。缺少任何一个都会导致发布失败。

```bash
# 检查包名一致性（HAR 内所有文件中的包名应一致）
tar -xzf <har_file>
grep -rn "包名" package/ --include="*.md" --include="*.json5" --include="*.ets" --include="*.ts"
rm -rf package/src/main/ets package/dist  # 清理解压的生成文件
```

```bash
# 检查关键功能代码是否包含
tar -xzf <har_file> -O package/src/main/ets/webview/DefaultWebview.ets | grep -c "webPageSnapshot"
```

应返回 > 0。

**完成后**：TaskUpdate → completed

### Step 4: 发布到 OHPM

#### 4a. 确认发布配置

```bash
$OHPM config list
```

确认 `publish_id`、`publish_registry`、`key_path` 已配置。

#### 4b. 敏感信息检查

发布前检查包内是否有敏感信息：

```bash
# 检查密码、密钥、token 等
tar -xzf ohrs-ability.har
grep -r -i -E "password|secret|token|private.key|api.key" package/ --include="*.ets" --include="*.json5" --include="*.ts" | head -10
rm -rf package/  # 清理解压目录
```

#### 4c. 执行发布

> **⚠️ `ohpm publish` 需要交互式输入密钥密码**，无法通过管道或参数传入。必须由用户在终端中手动执行。

**Windows 用户**（CMD 或 PowerShell）：
```
cd D:\path\to\openharmony-ability
D:\PE\softwares\DevEcoStudioRel\tools\ohpm\bin\ohpm.bat publish <har_file>
```

**Git Bash / Linux**：
```bash
$OHPM publish <har_file>
```

输入密钥密码后开始上传。

> **预期警告**：`the har file contains source code, which may cause code asset leakage` — ArkTS 包本身包含源码，这是预期行为，可以忽略。

#### 4d. 确认发布状态

发布成功后，OHPM 会发送「创建上架审核单成功」通知。

登录 https://ohpm.openharmony.cn → 个人中心 → 消息，查看审核进度。

**审核周期**：通常 1-3 个工作日。

**审核结果查看**：
- **审核通过**：个人中心 → Package 管理可看到上架状态
- **审核拒绝**：个人中心 → Package 管理页面 → 查看对应版本的审核状态和**驳回详情**（消息通知中不含具体驳回原因，必须到 Package 管理页面查看）

**审核拒绝后处理流程**：
1. 在 Package 管理页面查看具体驳回原因
2. 根据驳回原因定位并修复问题（可能在 `package/`、`native_ability/`、`scripts/` 或其他位置）
3. 重新跑 `pack.bat`（安全操作：只重新生成 `package/src/main/ets/`、`module.json5` 等派生文件，不会覆盖 `README.md`、`CHANGELOG.md`、`oh-package.json5` 等权威源文件）
   - **注意**：`module.json5` 的 `name` 字段由 `ohrs artifact` 从 `native_ability/oh-package.json5` 读取生成。如果修改了包名，必须同时更新 `native_ability/oh-package.json5` 中的 `name`，否则 `pack.bat` 会生成旧名字的 `module.json5`
4. 重新打包 HAR（`tar -czf <har_file> package/`）
5. 执行 Step 3c 全面检查（包名一致性、必需文件、功能代码）
6. 重新 `ohpm publish`（**不需要递增版本号**，被拒绝的版本未上架，可直接重发）

**完成后**：TaskUpdate → completed

### Step 5: 发布后处理

#### 5a. 审核通过后

登录 OHPM 个人中心 → Package 管理，确认包已上架。

用户即可通过以下命令安装：
```bash
ohpm install @ylong-rs/ohrs-ability
```

#### 5b. 还原发布前临时修改

**⚠️ 必须在提交代码前还原 Step 2f 中的临时修改**，否则会影响其他依赖此仓的项目：

```bash
cd ${PROJECT_ROOT}/openharmony-ability
git checkout -- native_ability/oh-package.json5
git checkout -- package/oh-package.json5
git checkout -- package/README.md
git checkout -- package/src/main/module.json5
```

验证：`git status --short` 应只剩永久变更（CHANGELOG、LICENSE、pack.bat）。

#### 5c. 提交永久代码变更

只提交应入库的永久变更：

```bash
cd ${PROJECT_ROOT}/openharmony-ability
git add package/CHANGELOG.md package/LICENSE pack.bat
git commit -m "chore: add X.Y.Z changelog, fix LICENSE, improve pack.bat"
git push origin ohdev
```

**不应提交的文件**：
- `native_ability/oh-package.json5`（包名是发布身份，不是代码变更）
- `package/oh-package.json5`（包名、repository URL 是发布配置）
- `package/README.md`（包名引用）
- `package/src/main/module.json5`（由 ohrs artifact 生成）

#### 5d. 下次发布清单

下次发布需要：
1. **永久变更**（提交到仓库）：递增 `package/oh-package.json5` 版本 → 更新 `package/CHANGELOG.md`
2. **临时修改**（发布后还原）：按 Step 2f 修改包名和 repository → 按 Step 2g 检查一致性
3. `./pack.bat && tar -czf ohrs-ability.har package/`
4. `ohpm publish ohrs-ability.har`
5. 审核通过后按 Step 5b 还原临时修改，按 Step 5c 提交永久变更

**完成后**：TaskUpdate → completed

## 参考链接

- [OHPM 中心仓](https://ohpm.openharmony.cn)
- [创建及发布三方库](https://ohpm.openharmony.cn/#/cn/help/createandpublish)
- [三方库名称指南](https://ohpm.openharmony.cn/#/cn/help/guidename)
- [三方库发布的必要文件](https://ohpm.openharmony.cn/#/cn/help/publishrequirefile)
- [oh-package.json5 配置说明](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/ide-oh-package-json5)

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `LICENSE` 内容为 `../LICENSE` | pack.bat 未复制根目录 LICENSE | pack.bat 已自动修复（Step 2b） |
| 发布被拒：版本号已存在 | 未递增版本号 | 更新 `package/oh-package.json5` 中的 `version` |
| 发布被拒：缺少必要文件 | HAR 内缺少 4 个必需文件之一 | 检查 pack.bat 是否复制完整（Step 3c） |
| 发布被拒：README 包名不一致 | README 中的安装命令包名与 oh-package.json5 的 name 不同 | 全局搜索替换旧包名（Step 2f） |
| 发布被拒：Failed to verify OHPM package group | 组织未创建或未认证 | OHPM → 个人中心 → 组织管理 → 创建并认证 |
| `Private key without passphrase is not supported` | 密钥未设置密码 | 重新生成密钥时设置非空密码 |
| `ohpm: command not found` | ohpm 不在 PATH 中 | 从 DevEco Studio 目录找到完整路径（Step 1d） |
| `Saving key failed: No such file or directory` | `~` 路径展开失败 | 使用完整路径如 `/c/Users/<user>/.ssh/ohpm_publish_key` |
| `ohpm WARN: contains source code` | ArkTS 包包含源码 | 预期行为，忽略即可 |
| Windows CMD 报 `命令语法不正确` | 使用了 Git Bash 路径格式 | 改用 Windows 路径 + `ohpm.bat`（Step 4c） |
