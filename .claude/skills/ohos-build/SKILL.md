---
name: ohos-build
description: 编译 Tauri OpenHarmony 项目（examples/api），生成 HAP 包并签名安装到设备。使用场景：(1) 一键构建部署，(2) HAR 包重建与安装，(3) 模板修改后重新生成，(4) 设备日志与故障诊断。
---

# ohos-build

编译 Tauri OpenHarmony 项目（examples/api），生成 HAP 包并签名安装到设备。

> **路径约定**: 以下脚本中 `${PROJECT_ROOT}` 指 tauri 和 openharmony-ability 共同的父目录。
> 例如本地布局为 `/d/xuqiu/tauri-2.0/{tauri,openharmony-ability}` 时，`PROJECT_ROOT=/d/xuqiu/tauri-2.0`。
> 使用前请先 `export PROJECT_ROOT=...` 或在 env.sh 中设置。
 
## 构建方式

### 方式一：cargo tauri ohos run（推荐）

```bash
cd ${PROJECT_ROOT}/tauri/examples/api/src-tauri
source ${PROJECT_ROOT}/tauri/.claude/skills/ohos-build/scripts/env.sh
cargo tauri ohos run --device-type desktop
```

一条龙完成：前端构建 → Rust 交叉编译 → HAP 打包签名 → 安装 → 启动。

> **注意**：`run` 是 **attach 模式**——部署启动成功后不退出，持续转发设备日志（适合现场看输出）。后台/脚本调用会一直挂着：要么接受其常驻，要么用 `cargo tauri ohos build` + `install.sh` 分离部署。构建成功与否以 HAP 产物 mtime / 设备 app 启动时间为准，别等命令退出。

`--device-type` 参数：
- `desktop` — PC/桌面设备（cfg(desktop)，Tray/Menu 功能需要）
- `mobile` — 手机/平板（cfg(mobile)）

> **注意**：此命令不包含自动测试（不设 `VITE_AUTOTEST`，app 启动后不自动跑套件，需手动点 Run All，为 283 例标准集）。如需自动测试，使用方式二。

### 前端门控双变量（TestRunner.svelte）

| 变量 | 语义 | 谁设置 |
|---|---|---|
| `VITE_AUTOTEST` | 自动跑测试（主窗口 mount 即跑，**283 例标准集**） | run-tests.sh、cov-build.sh |
| `VITE_COVERAGE_TESTS` | 注入覆盖率批次（driver/side-replay/bad-input/fault，共 312 例，合计 595） | 仅 cov-build.sh 插桩形态 |

两变量都不设（方式一/方式三）→ 普通交互 demo，不自动跑测试。

### 方式二：run-tests.sh（含自动测试）

```bash
OHOS_DEVICE_TYPE=desktop bash ${PROJECT_ROOT}/tauri/.claude/skills/ohos-build/scripts/run-tests.sh "" desktop
```

**注意**：必须先设置 `OHOS_DEVICE_TYPE` 环境变量再调用脚本。不要先 `source env.sh`，因为 `env.sh` 会设置 `OHOS_DEVICE_TYPE` 默认值，可能覆盖你传入的参数。

脚本自动完成全部流程：
1. 检测 `openharmony-ability/` 源码变更，自动重建 HAR 包（ohpm 同步由第 3 步 `cargo tauri ohos run` 内部完成，不手动 ohpm）
2. prerequisites（CLI 不做的前置）：pnpm install / build:api / 插件 dist-js / ACL 检查
3. `cargo tauri ohos run` 一步完成：
   - 前端构建（beforeBuildCommand，继承 VITE_AUTOTEST=true）
   - Rust 交叉编译（aarch64-unknown-linux-ohos，release，--features prod）
   - .so 拷贝 + hvigorw assembleHap（TAURI_OHOS_SKIP_DEVECO_SCRIPT 禁用 tauriPlugin，build-profile.json5 证书签名）
   - 安装已签名 HAP（带 hdc false-success 检测）→ 启动
4. 轮询 test-report footer（`*Report generated at end of test run.*`，5s 间隔，最长 `WAIT_SECONDS`=180s）→ 拉取报告 → 分析结果

### 方式三：cargo tauri ohos build --app（多形态打包）

```bash
cd ${PROJECT_ROOT}/tauri/examples/api/src-tauri
source ${PROJECT_ROOT}/tauri/.claude/skills/ohos-build/scripts/env.sh
cargo tauri ohos build --app
```

根据 `tauri.conf.json` 中 `bundle.openHarmony.deviceTypes` 配置，同时构建 mobile 和 desktop 两个 HAP。

## 环境要求

- **运行环境**: Git Bash（`C:\Program Files (x86)\Git\bin\bash.exe`）
- DevEco Studio（含 OpenHarmony SDK、ohpm、hvigor、JBR）
- pnpm、Rust + `aarch64-unknown-linux-ohos` target
- hdc（设备连接工具，SDK 自带）
- 设备已通过 USB 连接（`hdc list targets` 可见）

首次使用如果 DevEco Studio 自动检测失败：
```bash
echo 'DEVECO_HOME="/d/ohos-deveco"' > ${PROJECT_ROOT}/tauri/.claude/skills/ohos-build/scripts/.env.local
```

## 设备类型与项目结构

PR #59 将 app 拆分为 mobile 和 desktop 两个 entry 模块：

| `OHOS_DEVICE_TYPE` | 激活模块 | `cfg` 特性 | deviceTypes（tauri.conf.json） |
|---|------|---------|------|
| `desktop` | `entry_desktop` | `cfg(desktop)` | `{ "desktop": ["2in1"] }` |
| `mobile` | `entry_mobile` | `cfg(mobile)` | `{ "mobile": ["phone", "tablet"] }` |

`tauri.conf.json` 中的 deviceTypes 配置格式：
```json
"openHarmony": {
  "deviceTypes": {
    "mobile": ["phone", "tablet"],
    "desktop": ["2in1"]
  }
}
```

## 脚本说明

| 脚本 | 功能 |
|------|------|
| `env.sh` | 环境配置：DevEco Studio 路径解析（`DEV_ECO_STUDIO_INSTALL_PATH` 优先 → `DEVECO_HOME` → 自动检测，不落盘）、CC/linker/JAVA_HOME/PATH，必须在其他脚本前 source |
| `prerequisites.sh` | CLI 不做的开发期前置：pnpm install / build:api / 插件 dist-js / ACL 检查。被 build-ohos.sh 和 run-tests.sh source，不直接执行 |
| `run-tests.sh` | 一键全流程：HAR 重建 → prerequisites → `cargo tauri ohos run`（build+install+launch，带 hdc false-success 检测）→ 轮询报告 footer → 拉取报告 → 分析 |
| `build-ohos.sh` | prerequisites + `cargo tauri ohos build`（Rust 编译/.so/hvigorw/签名由 CLI 处理）。项目专属 feature 经 `TAURI_BUILD_FEATURES` 传入 |
| `install.sh` | 仅安装启动（使用已签名 HAP），不构建不签名。日常流程已被 `cargo tauri ohos run` 替代；保留供单独安装场景 |

## openharmony-ability ArkTS 源码修改后的完整生效流程

修改了 `openharmony-ability/` 下的 **ArkTS 源码**（非 Rust）后，HAR 必须重建，否则 entry 模块仍引用 stale HAR（新代码从未编译进 HAP）。

### ⚠️ 必须改真实源，不要改 package/ 镜像

`openharmony-ability/package/` 是 **pack.bat 的产物**，不是源！`pack.bat` 每次运行会：
1. `rmdir /s /q package\src\main\ets` 删掉整个 package ets 源
2. 从 `native_ability/src/main/ets/` 重新拷贝
3. `pack-plugins.ps1` 从 `plugins/<name>/src/main/ets/` 重新拷贝每个插件源，并改写 import 路径（`@ohos-rs/ability` → `../../ability_exports`）

**真实源位置**：
- 基础能力（ArkHelper/WindowManager/menu.ets/helper/*）：`openharmony-ability/native_ability/src/main/ets/`
- 桥接插件（WebviewPlugin/StatusbarPlugin/MenuPlugin 等 13 个）：`openharmony-ability/plugins/<name>/src/main/ets/<PluginClass>.ets`

改 package/ 镜像会被下次 pack.bat 覆盖，改动丢失。改源后必须跑 pack.bat 才能让改动进 HAR。

### 完整流程

```bash
cd ${PROJECT_ROOT}/openharmony-ability
source ${PROJECT_ROOT}/tauri/.claude/skills/ohos-build/scripts/env.sh
./pack.bat            # Windows 批处理：同步 native_ability ETS → package/ + 13 插件聚合 + tar 打 ability.har
# 验证 HAR 含新代码（HAR 是 tar.gz 不是 zip）：
#   cp ability.har /tmp/x.tar.gz && cd /tmp && mkdir hc && cd hc && tar -xzf x.tar.gz
#   grep -c "你的标记" package/src/main/ets/...
cd ${PROJECT_ROOT}/tauri/examples/api/src-tauri
cargo tauri ohos build --device-type desktop --features prod
```

`cargo tauri ohos build/run` 内部自动跑 ohpm install 同步依赖（受 `oh-package-lock.json5` 约束）。**严禁手动 `ohpm install` / `rm -rf oh_modules/@ohos-rs+ability`** —— 会删 lock、清空 `oh_modules/@tauri/` junction、误删本地包，导致 00304056 / 00625003。改 HAR 后只需重新 `cargo tauri ohos build`，CLI 会检测 HAR 变化并重新装包。

> 也可用 `run-tests.sh`，其 Step 0 自动检测 openharmony-ability 源码变更并重建 HAR，无需手动 pack。

### pack.bat 执行注意（Windows 批处理吃字符陷阱）

git bash / PowerShell 直接跑 `pack.bat` 会**吃掉前 2 字符**（`set`/`del`/`xcopy` 等行静默 no-op），导致 package 同步不完整但 pack.bat exit=0 假成功。必须用 **cmd.exe 显式调用**：
```bash
cmd.exe //c "D:\\xuqiu\\tauri-3.0\\openharmony-ability\\pack.bat"
```
跑完后手动校验 package 镜像 diff 是否与源一致，或验证 HAR 内含新代码标记。

## 模板修改后的完整生效流程

修改了 `crates/tauri-cli/templates/mobile/open-harmony/` 下的模板文件后，需要：

```bash
# 1. 重装 tauri-cli（模板编译进二进制，必须重装）
cargo install --path crates/tauri-cli --locked

# 2. 删除旧项目并重新生成
cmd.exe /c "rmdir /s /q ${PROJECT_ROOT}\\tauri\\examples\\api\\src-tauri\\gen\\ohos"
(cd examples/api/src-tauri && cargo tauri ohos init --skip-targets-install --ci)

# 3. 执行「init 后补充步骤」（见下方章节）

# 4. 重建 HAR（仅当改了 openharmony-ability 的 ArkTS 源码；改 Rust 源码跳过此步）
cd ${PROJECT_ROOT}/openharmony-ability
source ${PROJECT_ROOT}/tauri/.claude/skills/ohos-build/scripts/env.sh
./pack.bat            # Windows 批处理：同步 native_ability ETS → package/ + tar 打 ability.har
# 5. 构建 HAP —— cargo tauri 内部会自动跑 ohpm install 同步依赖，严禁手动 ohpm
cd ${PROJECT_ROOT}/tauri/examples/api/src-tauri
cargo tauri ohos build --device-type desktop --features prod
```

> **严禁手动 `ohpm install`**：`cargo tauri ohos build/run` 内部会跑 ohpm 同步依赖（受 `oh-package-lock.json5` 约束，安全）。手动 `ohpm install --all` 会删掉 lock 文件、清空 `oh_modules/@tauri/` junction、误删本地包目录，导致 hvigorw 00304056 / 00625003。详见 memory `ohos-arkts-rebuild-flow`。

## init 后补充步骤（每次 `tauri ohos init` 后必须执行）

`tauri ohos init` 重新生成 `gen/ohos/` 后，以下内容会丢失或缺失，需要手动补充：

### ① 签名配置（build-profile.json5）

`signingConfigs` 会被重置为 `[]`，必须在 **DevEco Studio** 中重新配置：
- 打开项目 `examples/api/src-tauri/gen/ohos/`
- File → Project Structure → Signing Configs → 配置自动签名或手动签名
- 保存

### ② 页面路由（main_pages.json）

`main_pages.json` 会被模板覆盖为仅包含 `pages/Index`，需要手动添加：

```json5
// gen/ohos/entry_desktop/src/main/resources/base/profile/main_pages.json
// gen/ohos/entry_mobile/src/main/resources/base/profile/main_pages.json
{
  "src": [
    "pages/Index",
    "pages/TestTrayPage",           // ← QuickOperation 面板页面
    "pages/TransparencyTestPage"    // ← WebView 透明度测试页面
  ]
}
```

> **注意**：PR #59 后 entry 模块拆分为 `entry_desktop/` 和 `entry_mobile/`，两个模块的 main_pages.json 都需要补充。

- `TestTrayPage` 是 `TestTrayAbility`（QuickOperation 面板）的内容页面，缺少此路由注册会导致面板打开后内容为空。
- `TransparencyTestPage` 是 WebView 容器透明背景测试页面（Float 子窗口穿透测试）。

### ③ TestTrayPage.ets 和 TestTrayAbility.ets 文件

这两个文件不在模板中（属于 examples/api 项目特有），`tauri ohos init` 不会生成它们。如果之前删除了整个 `gen/ohos/` 目录，需要手动恢复到 `entry_desktop/` 和 `entry_mobile/`：
- `gen/ohos/entry_desktop/src/main/ets/pages/TestTrayPage.ets`
- `gen/ohos/entry_desktop/src/main/ets/testtrayability/TestTrayAbility.ets`
- `gen/ohos/entry_desktop/src/main/ets/pages/TransparencyTestPage.ets`
- `gen/ohos/entry_mobile/src/main/ets/pages/TestTrayPage.ets`
- `gen/ohos/entry_mobile/src/main/ets/testtrayability/TestTrayAbility.ets`
- `gen/ohos/entry_mobile/src/main/ets/pages/TransparencyTestPage.ets`

**归档位置**: 这些文件已归档在 `.claude/skills/ohos-build/templates/` 目录下：
- `templates/pages/TestTrayPage.ets`
- `templates/testtrayability/TestTrayAbility.ets`
- `templates/pages/TransparencyTestPage.ets`

恢复命令（以 entry_desktop 为例，entry_mobile 同理）：
```bash
cp ${PROJECT_ROOT}/tauri/.claude/skills/ohos-build/templates/pages/TestTrayPage.ets \
     ${PROJECT_ROOT}/tauri/examples/api/src-tauri/gen/ohos/entry_desktop/src/main/ets/pages/
cp ${PROJECT_ROOT}/tauri/.claude/skills/ohos-build/templates/pages/TransparencyTestPage.ets \
     ${PROJECT_ROOT}/tauri/examples/api/src-tauri/gen/ohos/entry_desktop/src/main/ets/pages/
cp ${PROJECT_ROOT}/tauri/.claude/skills/ohos-build/templates/testtrayability/TestTrayAbility.ets \
     ${PROJECT_ROOT}/tauri/examples/api/src-tauri/gen/ohos/entry_desktop/src/main/ets/testtrayability/
```

### ④ 扩展能力和权限（module.json5）

`module.json5` 会被模板覆盖，需要手动补充 `TestTrayAbility` 扩展和**模板缺失的权限**。

> **模板现状**（`crates/tauri-cli/templates/.../module.json5`）已内置：`INTERNET`、`SET_WINDOW_TRANSPARENT`、`WINDOW_TOPMOST`、`LOCK_WINDOW_CURSOR`、`PRINT`（desktop 带 reason/usedScene，mobile 不带）。模板**未内置**下列 5 个权限——它们只存在于本地 `gen/ohos` 生成产物中（被 gitignore，未提交、不会随 PR 上游）。重新 `tauri ohos init` 后这 5 个会被清掉，必须手动补回，否则对应功能静默失败：
> - `VIBRATE` → §十三 haptics 失败
> - `LOCATION` / `APPROXIMATELY_LOCATION` → §二十八 geolocation 失败（需 `reason` + `usedScene`，否则 ACL 校验拒绝）
> - `CAMERA` → 相机功能失败（需 `reason` + `usedScene`）
> - `ACCESS_BIOMETRIC` → §三十一 biometric 失败

补充后的完整配置（`gen/ohos/entry_desktop/src/main/module.json5` 和 `gen/ohos/entry_mobile/src/main/module.json5` 都要补，mobile 的 PRINT 不带 reason/usedScene）：

```json5
// gen/ohos/entry_desktop/src/main/module.json5
// gen/ohos/entry_mobile/src/main/module.json5
{
  "module": {
    // ... 其他配置保持不变 ...
    "extensionAbilities": [
      {
        "name": "EntryBackupAbility",
        "srcEntry": "./ets/entrybackupability/EntryBackupAbility.ets",
        "type": "backup",
        "exported": false,
        "metadata": [
          {
            "name": "ohos.extension.backup",
            "resource": "$profile:backup_config"
          }
        ]
      },
      {
        "name": "TestTrayAbility",
        "srcEntry": "./ets/testtrayability/TestTrayAbility.ets",
        "type": "statusBarView",
        "exported": true
      }
    ],
    "requestPermissions": [
      // ── 模板已内置（init 后保留，无需补）──
      { "name": "ohos.permission.INTERNET" },
      { "name": "ohos.permission.SET_WINDOW_TRANSPARENT" },
      { "name": "ohos.permission.WINDOW_TOPMOST" },
      { "name": "ohos.permission.LOCK_WINDOW_CURSOR" },
      {
        "name": "ohos.permission.PRINT",
        "reason": "$string:reason_print",            // ← mobile 模板无此两行，desktop 模板有
        "usedScene": { "abilities": ["EntryAbility"], "when": "inuse" }
      },
      // ── 模板缺失，init 后必须手动补回 ──
      { "name": "ohos.permission.VIBRATE" },
      {
        "name": "ohos.permission.LOCATION",
        "reason": "$string:reason_location",
        "usedScene": { "abilities": ["EntryAbility"], "when": "inuse" }
      },
      {
        "name": "ohos.permission.APPROXIMATELY_LOCATION",
        "reason": "$string:reason_location",
        "usedScene": { "abilities": ["EntryAbility"], "when": "inuse" }
      },
      {
        "name": "ohos.permission.CAMERA",
        "reason": "$string:reason_camera",
        "usedScene": { "abilities": ["EntryAbility"], "when": "inuse" }
      },
      { "name": "ohos.permission.ACCESS_BIOMETRIC" }
    ]
  }
}
```

- `TestTrayAbility` 是系统托盘 QuickOperation 面板的扩展能力，`type` 必须为 `statusBarView`
- `ohos.permission.SET_WINDOW_TRANSPARENT` 是 2in1 设备上 `setWindowContainerColor` API 所需的权限，缺少会导致透明窗口功能失效（error 201）
- `LOCATION`/`CAMERA` 等敏感权限的 `reason` 引用的字符串资源（`reason_print`/`reason_location`/`reason_camera`）需在 `entry_*/src/main/resources/base/element/string.json` 中定义，否则 ACL 校验报错
- 长期方案：把这 5 个权限写进 `crates/tauri-cli/templates/mobile/open-harmony/entry_*/src/main/module.json5`，让它们随 PR 上游、init 后自动生成（当前它们只在本地 gen 产物，不会随 PR 提交）

## 关键注意事项

1. **env.sh 必须先 source** — 设置 OHOS linker/CC/JAVA_HOME，否则 Rust 编译报 `cc not found`
2. **prod feature** — 不加则 app 连接 localhost:1420 而非加载打包前端。脚本已自动包含。
3. **hdc 路径转义** — Git Bash 把 `/data/...` 转为 Windows 路径。设备路径命令用 `hdc shell "cat ..."` 加引号。
4. **签名由 hvigorw 完成** — build-profile.json5 中配置了含 system_basic 权限的证书，hvigorw assembleHap 自动签名。无需手动签名。
5. **HAR 缓存** — 修改了 openharmony-ability 后必须重建 HAR。`run-tests.sh` Step 0 自动检测并处理。
6. **tauriPlugin** — hvigorfile.ts 中的 tauriPlugin 需要 TCP 回调 tauri CLI，独立构建时必须禁用。`build-ohos.sh` 和 `run-tests.sh` 自动处理。
7. **tauri-cli 修改后必须重装** — 如果修改了 `crates/tauri-cli/` 下的 Rust 源码（非模板文件），必须重新安装 tauri-cli，否则 `cargo` 使用缓存的旧二进制，改动不生效：
   ```bash
   cargo install --path crates/tauri-cli --locked
   ```
   仅修改模板文件（`templates/` 下）不需要重装，`build-ohos.sh` 会自动检测模板 mtime 并重建 `gen/ohos/`。
8. **插件 dist-js 自动构建** — `build-ohos.sh` Step 2.5 每次执行 `pnpm build` 构建 `plugins-workspace/` 下所有插件的 `dist-js`，防止 git pull/rebase 后插件产物过期导致测试失败（如 notification 插件 `index.js` 过期）。
9. **cargo-mobile2 仓库** — `tauri-cli` 依赖 `cargo-mobile2`（位于 `${PROJECT_ROOT}/cargo-mobile2`）。如果 tauri-cli 编译报 `unresolved import cargo_mobile2::open_harmony::app`，说明 cargo-mobile2 需要 rebase 到 upstream/ohdev。
10. **PR #59 双 Entry 模块** — 项目结构从单一 `entry/` 拆分为 `entry_desktop/` + `entry_mobile/`。`OHOS_DEVICE_TYPE` 决定激活哪个模块（`active_entry_module()` 返回 `entry_{form}`）。`cargo tauri ohos build --app` 同时构建两个模块。

## 设备日志与故障诊断

```bash

# 实时日志（持续输出，Ctrl+C 停止）
hdc shell "hilog | grep -i 关键词"

# 缓冲区日志（非阻塞，-z 取最后 N 行）
# Rust log::info/error 的 domain 为 A00000，tag 为 tauritest
hdc shell "hilog -x" | grep "com.tauri"

# hilog 归档文件（选 hilog.*.gz，忽略 hilog_kmsg.*.gz）
hdc shell "ls -lt /data/log/hilog/ | grep -v hilog_kmsg | grep hilog | head -3"
hdc shell "zcat /data/log/hilog/hilog.最新序号.时间戳.gz | grep 关键词"

# Crash 日志（jscrash / cppcrash）
hdc shell "ls -lt /data/log/faultlog/faultlogger/ | grep tauri | head -5"
hdc shell "cat /data/log/faultlog/faultlogger/jscrash-com.tauri.api-最新文件名"

# Freeze 日志（主线程阻塞 3s+）
hdc shell "ls -lt /data/log/faultlog/faultlogger/ | grep appfreeze | head -5"

# Rust panic
hdc shell "cat /data/app/el2/100/base/com.tauri.api/cache/panic.log"
```

## 文件系统路径

| 视角 | 路径 | 说明 |
|------|------|------|
| App 内部（Rust 代码中） | `/data/storage/el2/base/cache/` | 应用沙箱路径 |
| 外部（hdc 访问） | `/data/app/el2/100/base/com.tauri.api/cache/` | 实际物理路径 |
