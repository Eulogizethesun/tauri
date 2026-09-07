---
name: tauri-ohos-publish
description: 将 openharmony-ability HAR 包发布到 OHPM 三方库中心仓。使用场景：(1) 首次发布配置（账号、密钥），(2) 版本号更新与发布，(3) 发布后审核跟踪，(4) ohdev-git 消费侧同步。
---

# Tauri OHOS HAR 发布（OHPM）

本技能引导完成 openharmony-ability HAR 包发布到 [OHPM 三方库中心仓](https://ohpm.openharmony.cn) 的完整流程。

> **当前包信息**：`@ylong-rs/ohrs-ability`，源码仓 `Eulogizethesun/openharmony-ability`

## 发布模型（先读）

- **双分支模型**：全部 10 个仓都有 `ohdev`（工作区开发态，path/`file:` 依赖）和 `ohdev-git`（外部分发态，git 依赖 + OHPM 注册表依赖）两条分支族。**发布产物的消费者是 `ohdev-git` 分支族**——发布上架后要做一轮 ohdev-git 同步（见 Step 5）。
- **包定位**：`@ylong-rs/ohrs-ability` 是上游 richerfu `@ohos-rs/ability` 的团队替代品，且是**聚合全家桶**——上游按"基座 + 独立插件包"分发，我们把基座 + 16 个 bridge 插件聚合成一个自包含 HAR，整体替换上游家族。
- **权威源**：`openharmony-ability/native_ability/`（版本号、README、CHANGELOG 在这里改；**LICENSE 真文本在仓根**——`native_ability/LICENSE*` 是 `../` symlink，Windows 检出是坏引用，发布流程绕过它直接取仓根）。`package/` 是 `pack.bat` 的生成镜像，不是源。
- **发布身份与发布文件都只存在于生成物上，源头零修改**：源码 manifest 保留上游身份 `@ohos-rs/ability`（本地 `file:` 消费按这个名字匹配）。本 skill 的 `scripts/pack-publish.ps1` 对 openharmony-ability 生成出来的 `package/` 副本补齐 OHPM 必需文件并盖发布身份（包名 + repository + README 引用），打包完成后把 `package/` 还原成 `pack.bat` 的原始产物——整个流程不产生任何源码修改。脚本承载的是发布身份策略（`@ylong-rs/ohrs-ability` / Eulogizethesun），属于发布流程而非代码仓，所以住在 skill 里；openharmony-ability 因此保持**零改动**。
- **两个产物**：`ability.har` = 开发 HAR（源身份，供 `file:` 依赖消费）；`ohrs-ability-<version>.har` = 发布 HAR（盖过身份，只有它能 `ohpm publish`）。

## 状态追踪

使用 Claude TaskList 追踪每个 Step 的执行状态。

### Guard: 启动时初始化

**每次 skill 被调用时，首先检查 TaskList**：
- 如果 TaskList 非空 → 找到当前 `in_progress` 的 task，从该 step 继续
- 如果 TaskList 为空 → 立即创建以下 task（不可跳过）：

```
TaskCreate: "Step 1: OHPM 账号与认证配置"
TaskCreate: "Step 2: 发布信息确认（版本/CHANGELOG/组织）"
TaskCreate: "Step 3: 构建 HAR 包"
TaskCreate: "Step 4: 发布到 OHPM"
TaskCreate: "Step 5: 发布后处理（含 ohdev-git 同步）"
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

### Step 2: 发布信息确认（版本 / CHANGELOG / 组织）

> 权威源在 `native_ability/`，所有确认都在源头上做；发布身份（包名/仓库地址）不用确认——由 `pack-publish.bat` 固定盖为 `@ylong-rs/ohrs-ability` / `Eulogizethesun/openharmony-ability`。

#### 2a. 确认版本号

`native_ability/oh-package.json5` 的 `version` 是唯一权威。当前为 `1.0.0-beta.1`（对应重构后的聚合架构，`native_ability/CHANGELOG.md` 已有该版本条目）。

**版本号规则**：
- 正式版：`1.0.0`、`1.1.0`、`2.0.0`
- 预览版：`1.0.0-beta.1`、`1.0.0-beta.2`
- 每次发布**必须**递增，否则 OHPM 拒绝

若要发新版本，使用 **AskUserQuestion** 确认后修改 `native_ability/oh-package.json5`。

#### 2b. 更新 CHANGELOG（发新版本时）

在 `native_ability/CHANGELOG.md` **顶部**添加新版本变更记录。

#### 2c. 确认 OHPM 组织已创建

包名组织前缀 `@ylong-rs` 对应的组织必须已在 OHPM 上创建并完成认证，否则发布会报 `Failed to verify the OHPM package group`。

**提示用户**：OHPM → 个人中心 → 组织管理 → 确认组织存在且已认证。

#### 2d. 必需文件自检

OHPM 发布**必须**在 HAR 根目录（即 `package/`）包含 4 个文件，另带双许可证文本与 module 描述。这些文件**开发流程（`pack.bat`）不产出**，由 `pack-publish.ps1` 在发布时自动补齐到生成物上，正常无需手工准备：

| 文件 | 发布时取自 |
|------|------|
| `package/oh-package.json5` | `pack.bat` 从 `native_ability/oh-package.json5` 镜像 |
| `package/README.md` | `native_ability/README.md` |
| `package/CHANGELOG.md` | `native_ability/CHANGELOG.md` |
| `package/LICENSE` | **仓根** `LICENSE`（真实文本，305 字节） |
| `package/LICENSE-APACHE` / `package/LICENSE-MIT` | **仓根**同名文件（11346 / 1073 字节） |
| `package/src/main/module.json5` | `native_ability/src/main/module.json5` |

快速自检（确认仓根 license 是真文本而非引用）：

```bash
cd ${PROJECT_ROOT}/openharmony-ability
head -1 LICENSE    # 应显示 "This repository is dual-licensed..."
wc -c LICENSE LICENSE-APACHE LICENSE-MIT
# 期望：305 / 11346 / 1073（与上游已过审 HAR 逐字节一致）
```

> **注意**：`native_ability/LICENSE*` 是 `../LICENSE*` symlink，Windows 检出成坏引用文本（LICENSE 10 字节、LICENSE-APACHE 17 字节、LICENSE-MIT 14 字节）——**这是常态，不要去修它**，发布流程直接从仓根取真文本。若仓根文件缺失/可疑，pack-publish 会报错拒绝打包。
>
> **README 已知取舍**：发布用的是上游原文，其中"能力在独立插件包"的描述与 `@ohos-rs/ability-plugin-webview` 导入示例对本聚合包不完全准确（保持仓库最小改动的选择）。要修正就改 `native_ability/README.md`（会进仓库 diff）。

**完成后**：TaskUpdate → completed

### Step 3: 构建 HAR 包

#### 3a. 运行 pack-publish.ps1

脚本在本 skill 的 `scripts/` 下，接受目标仓路径参数（不依赖自身位置），直接对 openharmony-ability 检出目录执行：

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\\PF\\projects\\codehub\\tauri_code\\tauri\\.claude\\skills\\tauri-ohos-publish\\scripts\\pack-publish.ps1" "D:\\PF\\projects\\codehub\\tauri_code\\openharmony-ability"
```

`pack-publish.ps1`（内部先跑完整 `pack.bat`，再在生成物上补文件 + 盖身份）完成：
1. 跑原生 `pack.bat`（**该脚本与 `native_ability/` 均零改动**）：重建 `package/` 镜像（含 16 个 bridge 插件聚合、barrel 导出）+ 开发 HAR `ability.har`（源身份，`file:` 消费用）
2. 向生成物补齐 OHPM 必需文件（README/CHANGELOG/module.json5 来自 `native_ability/`，LICENSE×3 来自仓根）
3. 对**生成的** `package/oh-package.json5` 盖 `@ylong-rs/ohrs-ability` + `Eulogizethesun` 仓库地址，对 `package/README.md` 改写包名引用（`@ohos-rs/ability-plugin-*` 引用保持不动）
4. 打出发布 HAR `ohrs-ability-<version>.har`
5. 删除补的文件、还原 `package/` 为 `pack.bat` 原始产物（装配/盖章/打包全程包在 try/finally 里，中途失败也会还原）——**源码零修改，无任何还原操作**

#### 3b. 验证发布 HAR

```bash
cd ${PROJECT_ROOT}/openharmony-ability
HAR=ohrs-ability-$(grep -o '"version"[^"]*"[^"]*"' native_ability/oh-package.json5 | head -1 | sed 's/.*"\([^"]*\)"$/\1/').har
rm -rf /tmp/pubcheck && mkdir -p /tmp/pubcheck && cd /tmp/pubcheck
tar -xzf ${PROJECT_ROOT}/openharmony-ability/$HAR

# ① 4 必需文件 + 双许可 + module.json5（7 个都要在）
ls package/README.md package/CHANGELOG.md package/LICENSE package/LICENSE-APACHE package/LICENSE-MIT package/oh-package.json5 package/src/main/module.json5

# ② 发布身份正确
grep -E '"name"|"repository"|"version"' package/oh-package.json5
# 期望：name=@ylong-rs/ohrs-ability、repository=.../Eulogizethesun/...、version 与源一致

# ③ README 包名一致性（OHPM 常见驳回原因）
grep -c "@ylong-rs/ohrs-ability" package/README.md   # 应 >0（标题/安装命令/import 均已盖名）
grep -n "@ohos-rs/ability" package/README.md | grep -v "ability-plugin"   # 应无输出（-plugin-* 引用是刻意保留的，先排除）

# ④ 16 插件聚合完整 + 关键功能代码在内
ls package/src/main/ets/plugins/ | wc -l             # 应为 16
grep -rc "webPageSnapshot" package/src/main/ets/ | grep -v ":0"   # 换成本版本的特性标记
```

> **别发错包**：`ability.har` 是开发身份（`@ohos-rs/ability`）；仓里历史遗留的旧 `ohrs-ability.har`（旧流程产物，无版本号文件名）已过期，二者都不能发布。只发布版本化的 `ohrs-ability-<version>.har`。

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
grep -r -i -E "password|secret|token|private.key|api.key" /tmp/pubcheck/package/ --include="*.ets" --include="*.json5" --include="*.ts" | head -10
```

#### 4c. 执行发布

> **⚠️ `ohpm publish` 需要交互式输入密钥密码**，无法通过管道或参数传入。必须由用户在终端中手动执行。

**Windows 用户**（CMD 或 PowerShell）：
```
cd D:\path\to\openharmony-ability
D:\PE\softwares\DevEcoStudioRel\tools\ohpm\bin\ohpm.bat publish ohrs-ability-<version>.har
```

**Git Bash / Linux**：
```bash
$OHPM publish ohrs-ability-<version>.har
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
2. 根据驳回原因**在源头**（`native_ability/`，必要时 `plugins/`、`pack.bat`）修复问题
3. 重跑 Step 3a 的 pack-publish.ps1 命令重新产出发布 HAR（源头修复会被自动带进生成物；pack-publish 不会覆盖源头，所以没有任何中间状态要清理）
4. 重跑 Step 3b 验证
5. 重新 `ohpm publish`（**不需要递增版本号**，被拒绝的版本未上架，可直接重发）

**完成后**：TaskUpdate → completed

### Step 5: 发布后处理（含 ohdev-git 同步）

#### 5a. 审核通过后

登录 OHPM 个人中心 → Package 管理，确认包已上架。

用户即可通过以下命令安装：
```bash
ohpm install @ylong-rs/ohrs-ability
```

#### 5b. 确认仓库无发布残留

pack-publish 盖的发布身份只存在于生成物上，打包后已自动清理。发布完成后自检一次——若 `package/` 残留了 `@ylong-rs/ohrs-ability`，本地 `file:` 依赖按 `@ohos-rs/ability` 匹配会失效，下次构建就坏，还可能被误提交：

```bash
cd ${PROJECT_ROOT}/openharmony-ability
grep '"name": "@' native_ability/oh-package.json5 package/oh-package.json5
# 两行都应仍是 @ohos-rs/ability
```

#### 5c. 提交变更

发布流程本身**不改任何源码，也不在 openharmony-ability 留下任何文件**——打包脚本住在本 skill 的 `scripts/` 里，发布后 openharmony-ability 的 `git status` 应为空。若发的是新版本，`git status` 会有 `native_ability/oh-package.json5`（版本号）与 `native_ability/CHANGELOG.md` 两处修改需要提交。发布 HAR（`*.har`）已 gitignore，不入库。

#### 5d. ohdev-git 发布列车（消费侧同步）

发布上架后，`ohdev-git` 分支族才能消费新版本。这是独立的一轮工作：

1. **现状盘点**：ohdev-git 落后 ohdev 约 7 周（停在 `0.4.0-beta.9`、重构前的旧单体布局）。同步前先 `git log --oneline ohdev..origin/ohdev-git` / 反向盘点各仓差距。
2. **同步 10 仓**：把各仓 `ohdev` 的变更合入各自 `ohdev-git`（tauri、tao、wry、muda、tray-icon、openharmony-ability、window-vibrancy、plugins-workspace、cargo-mobile2、sentry-tauri）。
3. **tauri-cli 模板换代**（关键差异，随同步吸收）：
   - ArkTS 依赖：`"@ylong-rs/ohrs-ability": "0.4.0-beta.9"` → 新版本号
   - `EntryAbility.ets.hbs` 旧版只 `import { NativeAbility }`；新版是双通道架构——16 个 bridge 插件 import + `bridgePlugins` 数组，加 `@tauri/app` 的 `PluginManager`/`STATIC_PLUGINS`（JS 层插件）
   - **import 必须改写**：ohdev 侧模板 import 的是源身份 `'@ohos-rs/ability'`（工作区 `file:` 依赖按它匹配），合入 ohdev-git 时 mobile/desktop 两个模板的 import 都要改写为 `'@ylong-rs/ohrs-ability'`——直接合并会把 desktop 模板里已正确的 import 覆盖回源身份，悄悄回归已知 bug
   - **已知 bug**：ohdev-git 的 **mobile** 模板 `EntryAbility.ets.hbs` import 的是 `'@ohos-rs/ability'` 而 dep 是 `@ylong-rs/ohrs-ability`（desktop 模板已正确），换代时一并修正
4. **验证**：用 ohdev-git 分支族的 tauri-cli 走一次 `tauri ohos init` + 构建，确认从 OHPM 拉到的 `@ylong-rs/ohrs-ability@<新版本>` 能编译启动。

#### 5e. 下次发布清单

1. `native_ability/oh-package.json5` 递增 version + `native_ability/CHANGELOG.md` 顶部加条目
2. 跑 Step 3a 的 pack-publish.ps1 命令，一步产出发布 HAR
3. Step 3b 验证 → `ohpm publish ohrs-ability-<version>.har`
4. 审核通过后：提交源侧变更 + ohdev-git 列车（5d）

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
| `native_ability/LICENSE` 内容是 `../LICENSE` | symlink 在 Windows 检出的形态，**正常现象** | 无需处理——pack-publish 从仓根取真实文本 |
| pack.bat 静默假成功 | git bash / PowerShell 直接跑 `.bat` 吃行首字符 | pack-publish.ps1 内部经 `cmd.exe /c` 调它，不受影响；单独手跑 pack.bat 时用 `cmd.exe //c "完整路径\\pack.bat"` |
| 发布被拒：版本号已存在 | 未递增版本号 | 更新 `native_ability/oh-package.json5` 的 `version` |
| 发布被拒：缺少必要文件 | HAR 内缺少 4 个必需文件之一 | 检查 `native_ability/` 对应文件是否存在且非空，重跑 pack-publish |
| 发布被拒：README 包名不一致 | README 安装命令包名与 manifest `name` 不同 | pack-publish 已自动改写 README；若手改过 README，确认裸 `@ohos-rs/ability` 引用未残留（`-plugin-*` 引用除外） |
| 发布被拒：Failed to verify OHPM package group | 组织未创建或未认证 | OHPM → 个人中心 → 组织管理 → 创建并认证 `ylong-rs` |
| `Private key without passphrase is not supported` | 密钥未设置密码 | 重新生成密钥时设置非空密码 |
| `ohpm: command not found` | ohpm 不在 PATH 中 | 从 DevEco Studio 目录找到完整路径（Step 1d） |
| `Saving key failed: No such file or directory` | `~` 路径展开失败 | 使用完整路径如 `/c/Users/<user>/.ssh/ohpm_publish_key` |
| `ohpm WARN: contains source code` | ArkTS 包包含源码 | 预期行为，忽略即可 |
| Windows CMD 报 `命令语法不正确` | 使用了 Git Bash 路径格式 | 改用 Windows 路径 + `ohpm.bat`（Step 4c） |
| 拿 `ability.har` 或旧 `ohrs-ability.har` 去发布 | 混淆开发产物/旧流程产物 | 只发布 `ohrs-ability-<version>.har`（Step 3a） |
