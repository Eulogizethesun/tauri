---
name: dep-switch-to-path
description: 将 Tauri OHOS 项目的 git 依赖恢复为本地 path 依赖。使用场景：(1) 需要本地调测多个仓库，(2) 离线开发，(3) 快速迭代时避免 git clone 开销。
---

# dep-switch-to-path

将 7 个仓库中所有跨仓 `git` 依赖恢复为本地 `path` 依赖，方便本地联调开发。

> **工作区根目录**（包含这 10 个并列 git 仓的目录，当前为 `D:/xuqiu/tauri-3.0/`）。下文命令中的路径均以此为根。
>
> **不会修改**：仓内（intra-repo）path 依赖、`schemars_derive`（git 指向 `tauri-apps/schemars`，与本工作区无关）。
> ⚠️ `cargo-mobile2` **必须**恢复为 `path = "../cargo-mobile2"`（本地工作区有 `app::build (assembleApp)` 等 bundler 改动，`tauri-apps` 上游没有）。
>
> ℹ️ **2026-11-05 重校准**：ohdev-git 分支基于当前 ohdev 重建，本 skill 的条目已按重建后的依赖图核对。完整 crate↔path↔git 对照以 [mapping-table.md](references/mapping-table.md) 为准；以 Step 1 的 `grep Eulogizethesun` 扫描结果为唯一事实源，扫描出的条目数若与本文不符，以扫描为准。

## 执行流程

### Step 1: 扫描当前状态

检查以下仓库中是否有 Eulogizethesun git 依赖：

```bash
cd D:/xuqiu/tauri-3.0/<repo>
grep -rn 'Eulogizethesun' --include="Cargo.toml" . | grep -v target/ | grep -v '^\s*#'
```

预期条目数（重校准后）：tauri 63 / tao 4 / wry 3 / muda 1 / tray-icon 3 / plugins-workspace 25 / window-vibrancy 2。

如果扫描结果中**没有** Eulogizethesun git 引用，输出 "✅ 所有依赖已为 path 模式" 并退出。

### Step 2: 逐文件替换

> ⚠️ **替换顺序很重要**：`openharmony-ability-derive` 必须在 `openharmony-ability` 之前替换，否则 derive 会被错误匹配。
> ⚠️ **插件必须逐个替换**：不能用通配模式，否则所有插件路径会变成同一个。

使用 Edit 工具，按以下映射表逐条替换。将 git 依赖恢复为 path 依赖。

---

#### 2.1 tauri/Cargo.toml — [patch.crates-io]

```
# derive 必须在 ability 之前！
from: openharmony-ability-derive = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-derive = { path = "../openharmony-ability/crates/derive" }

from: openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability = { path = "../openharmony-ability/crates/ability" }

from: wry = { git = "https://github.com/Eulogizethesun/wry", branch = "ohdev-git" }
to:   wry = { path = "../wry" }

from: tao = { git = "https://github.com/Eulogizethesun/tao", branch = "ohdev-git" }
to:   tao = { path = "../tao" }

from: muda = { git = "https://github.com/Eulogizethesun/muda", branch = "ohdev-git" }
to:   muda = { path = "../muda" }

from: tray-icon = { git = "https://github.com/Eulogizethesun/tray-icon", branch = "ohdev-git" }
to:   tray-icon = { path = "../tray-icon" }

# [NEW 2026-11-05] cargo-mobile2（保留 default-features = false）
from: cargo-mobile2 = { git = "https://github.com/Eulogizethesun/cargo-mobile2", branch = "ohdev-git" }
to:   cargo-mobile2 = { path = "../cargo-mobile2" }

# [NEW 2026-11-05] window-vibrancy
from: window-vibrancy = { git = "https://github.com/Eulogizethesun/window-vibrancy", branch = "ohdev-git" }
to:   window-vibrancy = { path = "../window-vibrancy" }
```

> ⚠️ **不要动** L72 `schemars_derive`（`tauri-apps/schemars` git）与 L73-75 `tauri`/`tauri-plugin`/`tauri-utils` 的 `path = "./crates/..."`（仓内自引用）。

#### 2.2 tauri/crates/tauri/Cargo.toml — muda/tray-icon（无需处理）

> [OBSOLETE 2026-11-05] 原版 skill 在此（以及 §2.3）列有 `muda`/`tray-icon` 的 git 条目。当前 ohdev 的 `crates/tauri` 已把它们改回纯 version 依赖（由 `[patch.crates-io]` 重定向），**没有** git 条目需要恢复。

#### 2.3 tauri/crates/tauri/Cargo.toml — ohos deps

```
# derive 必须在 ability 之前！
from: openharmony-ability-derive = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-derive = { path = "../../../openharmony-ability/crates/derive" }

# 不带 features（menu 能力由 plugin-menu 子 crate 承载）
from: openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability = { path = "../../../openharmony-ability/crates/ability" }

from: openharmony-ability-plugin-menu = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-plugin-menu = { path = "../../../openharmony-ability/crates/plugin-menu" }

# [NEW 2026-11-05]
from: openharmony-ability-plugin-app-control = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-plugin-app-control = { path = "../../../openharmony-ability/crates/plugin-app-control" }
```

> ⚠️ **不要动** L203/L204 `tauri-build`/`tauri-utils` 仓内自引用与 L270-306 example 路径。

#### 2.4 tauri/crates/tauri-runtime/Cargo.toml

```
from: openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability = { path = "../../../openharmony-ability/crates/ability" }
```

#### 2.5 tauri/crates/tauri-runtime-wry/Cargo.toml

```
from: wry = { git = "https://github.com/Eulogizethesun/wry", branch = "ohdev-git", default-features = false, features = [
        "protocol",
        "os-webview",
        "linux-body",
      ] }
to:   wry = { path = "../../../wry", default-features = false, features = [
        "protocol",
        "os-webview",
        "linux-body",
      ] }

from: tao = { git = "https://github.com/Eulogizethesun/tao", branch = "ohdev-git",  default-features = false, features = ["rwh_06"] }
to:   tao = { path = "../../../tao",  default-features = false, features = ["rwh_06"] }

from: openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability = { path = "../../../openharmony-ability/crates/ability" }

# [NEW 2026-11-05] plugin-window / plugin-url
from: openharmony-ability-plugin-window = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-plugin-window = { path = "../../../openharmony-ability/crates/plugin-window" }

from: openharmony-ability-plugin-url = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-plugin-url = { path = "../../../openharmony-ability/crates/plugin-url" }
```

#### 2.6 tauri/examples/api/src-tauri/Cargo.toml — plugins (逐个替换)

> ⚠️ 每个插件必须单独替换，不能用批量模式。
> ⚠️ `tauri-plugin-dialog` 和 `tauri-plugin-deep-link` 各出现两次（non-OHOS + OHOS 段，L51/L66 与 L55/L69），使用 `replace_all: true`。
> ⚠️ 该文件共 **42 处** Eulogizethesun git 引用。完整 crate→path 对照见 [mapping-table.md](references/mapping-table.md) 的 plugins 表（`path = "../../../../plugins-workspace/plugins/<name>"`）；此处只列**形态易错**的条目：

```
# fs 带 features（多行形态，两行一起替换）
from: tauri-plugin-fs = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git", features = [
  "watch",
] }
to:   tauri-plugin-fs = { path = "../../../../plugins-workspace/plugins/fs", features = [
  "watch",
] }

# sql 带 features（单行）
from: tauri-plugin-sql = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git", features = ["sqlite"] }
to:   tauri-plugin-sql = { path = "../../../../plugins-workspace/plugins/sql", features = ["sqlite"] }

# sentry-tauri 是独立仓（不是 plugins-workspace）
from: tauri-plugin-sentry = { git = "https://github.com/Eulogizethesun/sentry-tauri", branch = "ohdev-git" }
to:   tauri-plugin-sentry = { path = "../../../../sentry-tauri" }

# OHOS 段的 openharmony-ability 子 crate（路径与插件不同：../../../../openharmony-ability/crates/<sub>）
from: openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability = { path = "../../../../openharmony-ability/crates/ability" }

from: openharmony-ability-plugin-webview = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-plugin-webview = { path = "../../../../openharmony-ability/crates/plugin-webview" }

from: openharmony-ability-plugin-window = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-plugin-window = { path = "../../../../openharmony-ability/crates/plugin-window" }

# muda / tray-icon 直接依赖（不是 plugins-workspace）
from: muda = { git = "https://github.com/Eulogizethesun/muda", branch = "ohdev-git" }
to:   muda = { path = "../../../../muda" }

from: tray-icon = { git = "https://github.com/Eulogizethesun/tray-icon", branch = "ohdev-git" }
to:   tray-icon = { path = "../../../../tray-icon" }
```

> ⚠️ **不要动** L14 `tauri-build`、L25 `tauri-plugin-sample`、L101/L114 `path = "../../../crates/tauri"`（仓内自引用）。

#### 2.6b tauri/examples/huawei-account/src-tauri/Cargo.toml

```
from: tauri-plugin-huawei-account = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }
to:   tauri-plugin-huawei-account = { path = "../../../../plugins-workspace/plugins/huawei-account" }

from: openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability = { path = "../../../../openharmony-ability/crates/ability" }
```

#### 2.7 tao/Cargo.toml

```
# derive 必须在 ability 之前！
from: openharmony-ability-derive = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-derive = { path = "../openharmony-ability/crates/derive" }

from: openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability = { path = "../openharmony-ability/crates/ability" }

from: openharmony-ability-plugin-window = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-plugin-window = { path = "../openharmony-ability/crates/plugin-window" }

# [NEW 2026-11-05]
from: openharmony-ability-plugin-app-control = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-plugin-app-control = { path = "../openharmony-ability/crates/plugin-app-control" }
```

> ⚠️ **不要动** L109 `tao-macros = { version = "0.1.0", path = "./tao-macros" }`（仓内自引用）。

#### 2.8 wry/Cargo.toml

同 2.7 的映射模式，但插件是 `plugin-webview`（不是 plugin-window/app-control）：`openharmony-ability`、`openharmony-ability-derive`、`openharmony-ability-plugin-webview` 三条。

#### 2.9 muda/Cargo.toml

> [CHANGED 2026-11-05] 原版 skill 的 `openharmony-ability`（带 `features = ["menu"]`）已重构为 plugin 子 crate 依赖。

```
from: openharmony-ability-plugin-menu = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-plugin-menu = { path = "../openharmony-ability/crates/plugin-menu" }
```

#### 2.10 tray-icon/Cargo.toml

> [CHANGED 2026-11-05] 原版 skill 的 `muda` [patch.crates-io] 条目已不存在；`openharmony-ability` 无 features。当前共 3 条：

```
from: openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability = { path = "../openharmony-ability/crates/ability" }

from: openharmony-ability-plugin-statusbar = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-plugin-statusbar = { path = "../openharmony-ability/crates/plugin-statusbar" }

from: openharmony-ability-plugin-menu = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-plugin-menu = { path = "../openharmony-ability/crates/plugin-menu" }
```

#### 2.11 plugins-workspace/Cargo.toml — [patch.crates-io]

> [CHANGED 2026-11-05] 当前共 **13 条**：tauri 核心 6 条（`tauri`/`tauri-build`/`tauri-utils`/`tauri-runtime`/`tauri-runtime-wry`/`tauri-plugin`，全部 `path = "../tauri/crates/<name>"`）+ `wry`/`tao`/`muda`/`tray-icon`/`window-vibrancy`（`path = "../<repo>"`）+ `openharmony-ability`/`openharmony-ability-derive`（`path = "../openharmony-ability/crates/<sub>"`）。完整对照见 mapping-table.md。

```
# derive 必须在 ability 之前！
from: openharmony-ability-derive = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-derive = { path = "../openharmony-ability/crates/derive" }

from: openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability = { path = "../openharmony-ability/crates/ability" }

from: tauri = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }
to:   tauri = { path = "../tauri/crates/tauri" }

from: wry = { git = "https://github.com/Eulogizethesun/wry", branch = "ohdev-git" }
to:   wry = { path = "../wry" }

from: window-vibrancy = { git = "https://github.com/Eulogizethesun/window-vibrancy", branch = "ohdev-git" }
to:   window-vibrancy = { path = "../window-vibrancy" }
```

> ⚠️ 剩余 8 条（tauri-build/tauri-utils/tauri-runtime/tauri-runtime-wry/tauri-plugin/tao/muda/tray-icon）同模式逐条替换。

#### 2.12 plugins-workspace/plugins/*/Cargo.toml

> [CHANGED 2026-11-05] 当前共 **12 个**插件文件有跨仓 git 依赖，多数已重构为 `openharmony-ability-plugin-*` 子 crate（`path = "../../../openharmony-ability/crates/<plugin>"`）。完整清单见 mapping-table.md 的 openharmony-ability 子 crate 表。形态易错的两条（直接依赖 ability crate 且带 features）：

```
huawei-account:
from: openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git", features = ["account"] }
to:   openharmony-ability = { path = "../../../openharmony-ability/crates/ability", features = ["account"] }

updater:
from: openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git", features = ["updater"] }
to:   openharmony-ability = { path = "../../../openharmony-ability/crates/ability", features = ["updater"] }
```

其余 10 个（accessibility/autostart/clipboard-manager/continuation/deep-link/global-shortcut/opener/screenshot/shell/single-instance）均为无 features 的 `openharmony-ability-plugin-<name>` 形态，注意 single-instance 依赖的是 **plugin-deep-link**、opener 和 shell 依赖的是 **plugin-url**。

#### 2.13 window-vibrancy/Cargo.toml

```
from: openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git", default-features = false, features = ["window"] }
to:   openharmony-ability = { path = "../openharmony-ability/crates/ability", default-features = false, features = ["window"] }

from: openharmony-ability-plugin-window = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
to:   openharmony-ability-plugin-window = { path = "../openharmony-ability/crates/plugin-window" }
```

> ⚠️ 仓内自引用（`examples/tauri/src-tauri/Cargo.toml` 的 `window-vibrancy = { path = "../../../" }`）保留不动。

#### 2.14 CLI 脚手架模板 ArkTS 身份（切回 path 模式时一并核对）

> [NEW 2026-11-06] 模板身份是**分支持有**的差异：ohdev-git 分支的 tauri-cli 模板消费 OHPM 注册表的 `@ylong-rs/ohrs-ability`（分支特殊性，背景与坑见 dep-switch-to-git skill §2.14）；ohdev 分支的模板用 `file: + @ohos-rs/ability`。正常 `git switch` 会各自带对形态，**无需手工干预**。仅当 ohdev 工作区里出现 ohdev-git 形态的模板（误携提交、移植 patch 等）时，才须把 4 个文件翻回：

```
crates/tauri-cli/templates/mobile/open-harmony/entry_{desktop,mobile}/oh-package.json5:
from: "@ylong-rs/ohrs-ability": "1.0.0-beta.2",
to:   "@ohos-rs/ability": "file:{{{ability-har-rel}}}",

crates/tauri-cli/templates/mobile/open-harmony/entry_{desktop,mobile}/src/main/ets/entryability/EntryAbility.ets.hbs:
from: } from '@ylong-rs/ohrs-ability'
to:   } from '@ohos-rs/ability'

from: // `allBridgePlugins` is exported by `@ylong-rs/ohrs-ability` and covers every bridge
to:   // `allBridgePlugins` is exported by `@ohos-rs/ability` and covers every bridge
```

> 包名=导入名必须同步翻回；本地 `file:` 模式直连 dev HAR，不受 OHPM 上架版本约束（无 beta.2 前置）。

### Step 3: 验证

```bash
cd D:/xuqiu/tauri-3.0/tauri
cargo check --workspace 2>&1 | head -50
```

### Step 4: 报告

```
✅ 已恢复 N 处本地 path 依赖
（预期 101 处：tauri 63 / tao 4 / wry 3 / muda 1 / tray-icon 3 /
  plugins-workspace 25 / window-vibrancy 2）

⚠️ 提醒：path 模式下 Cargo.lock 会产生差异，提交代码前请运行 dep-switch-to-git 切换回 git 模式。
```

## 下游用户注意

如果你使用 Eulogizethesun fork 开发自己的项目，需要在你的 `Cargo.toml` 中添加 `[patch.crates-io]`。详见 [下游 patch 指南](references/downstream-patch-guide.md)。

## 参考文档

- [完整映射表](references/mapping-table.md) — crate 名称、git URL、本地路径对照
- [下游 patch 指南](references/downstream-patch-guide.md) — 下游用户需要的 [patch.crates-io] 配置
