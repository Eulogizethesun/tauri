---
name: dep-switch-to-git
description: 将 Tauri OHOS 项目的本地 path 依赖替换为 Eulogizethesun/ohdev-git git 依赖。使用场景：(1) 本地开发完成后准备提交代码，(2) 确保 Cargo.toml 中无跨仓 path 引用，(3) CI 或发布前清理。
---

# dep-switch-to-git

将 10 个仓库中所有跨仓 `path` 依赖替换为 `git` 依赖（`Eulogizethesun/<repo>`, branch `ohdev-git`）。

> **工作区根目录**（包含这 10 个并列 git 仓的目录，当前为 `D:/xuqiu/tauri-3.0/`）。下文命令中 `$WS_ROOT` 指此目录；执行时可用实际路径 `D:/xuqiu/tauri-3.0`。
>
> **不会修改**：仓内（intra-repo）path 依赖、`schemars_derive` 等已有 git 依赖。
>
> ⚠️ **`cargo-mobile2` 需要迁移**：`ohdev` 将 `cargo-mobile2` 收回本地工作区（`path = "../cargo-mobile2"`）以加入 `app::build (assembleApp)` 等改动，而 `tauri-apps/cargo-mobile2#feat/ohos` 没有这些改动。因此 `cargo-mobile2` 必须迁移到 `Eulogizethesun/cargo-mobile2#ohdev-git`（与其他依赖一致），不能保留 path、也不能用旧的 `tauri-apps` 目标。
>
> ⚠️ **ohdev 新增大量 `openharmony-ability-plugin-*` 子 crate**：原版 skill 只处理 `openharmony-ability` 和 `openharmony-ability-derive` 两个 crate。ohdev 后续将各仓对 `openharmony-ability` 的直接依赖拆分成了 plugin-specific 子 crate（如 `openharmony-ability-plugin-menu`、`openharmony-ability-plugin-window`、`openharmony-ability-plugin-url`、`openharmony-ability-plugin-webview`、`openharmony-ability-plugin-statusbar`、`openharmony-ability-plugin-screenshot`、`openharmony-ability-plugin-accessibility`、`openharmony-ability-plugin-autostart`、`openharmony-ability-plugin-clipboard`、`openharmony-ability-plugin-continuation`、`openharmony-ability-plugin-deep-link`、`openharmony-ability-plugin-global-shortcut` 等）。这些子 crate 全部指向 `Eulogizethesun/openharmony-ability` 仓（与 ability/derive 同一 git URL）。
>
> ⚠️ **plugins-workspace 的 `[patch.crates-io]` 已扩展**：原版 skill 只列了 `openharmony-ability` + `openharmony-ability-derive`。当前 ohdev 已把 tauri 核心 crate（`tauri`、`tauri-build`、`tauri-utils`、`tauri-runtime`、`tauri-runtime-wry`、`tauri-plugin`）以及 `wry`、`tao`、`muda`、`tray-icon`、`window-vibrancy` 也加入 `[patch.crates-io]` 作为 path 依赖。原版注释"不要修改 `tauri-plugin` 行（已是 git 依赖）"**已过时**——`tauri-plugin` 现在是 path 依赖，必须迁移。

## 执行流程

### Step 1: 扫描当前状态

检查以下仓库中是否还有跨仓 path 依赖（路径均相对于工作区根 `$WS_ROOT/`）：

| 仓库 | 目录 | 跨仓依赖条目数 |
|------|------|--------------|
| tauri | `$WS_ROOT/tauri/` | 64 |
| tao | `$WS_ROOT/tao/` | 3 |
| wry | `$WS_ROOT/wry/` | 3 |
| muda | `$WS_ROOT/muda/` | 1 |
| tray-icon | `$WS_ROOT/tray-icon/` | 4 |
| plugins-workspace | `$WS_ROOT/plugins-workspace/` | 23 |
| window-vibrancy | `$WS_ROOT/window-vibrancy/` | 2 |
| openharmony-ability | `$WS_ROOT/openharmony-ability/`（叶子节点，无需改动） | 0 |
| cargo-mobile2 | `$WS_ROOT/cargo-mobile2/`（叶子节点，无跨仓依赖；但被 tauri 引用） | 0 |
| sentry-tauri | `$WS_ROOT/sentry-tauri/`（叶子节点，无跨仓依赖；被 tauri 引用） | 0 |

对每个仓库执行：
```bash
cd $WS_ROOT/<repo>
grep -rn 'path\s*=\s*"\.\.' --include="Cargo.toml" . | grep -v target/
```

如果扫描结果中**没有**跨仓引用（即所有 `path = ".."` 都指向仓内），输出 "✅ 所有跨仓依赖已为 git 模式" 并退出。

### Step 2: 逐文件替换

使用 Edit 工具，按以下映射表逐条替换。**必须精确匹配 old_string**，仅修改 `path` 部分，保留所有 `features`、`default-features`、`optional`、`version` 等属性。

> ⚠️ **不要修改** 被注释的行（以 `#` 开头）。
> ⚠️ **不要修改** `schemars_derive` 相关行（已是 git 依赖，`tauri/Cargo.toml` L72）。
> ⚠️ **`cargo-mobile2` 必须迁移**（见 2.1、2.1b），目标为 `Eulogizethesun/cargo-mobile2#ohdev-git`，不要保留 path、也不要用旧的 `tauri-apps` 目标。
> ⚠️ **替换顺序很重要**：`openharmony-ability-derive` 必须在 `openharmony-ability` 之前替换（同一文件内两者相邻时，先替换 derive 可避免前缀匹配歧义）。
> ⚠️ **插件必须逐个替换**：不能用通配模式。

---

#### 2.1 tauri/Cargo.toml — [patch.crates-io]

```
# derive 必须在 ability 之前！
from: openharmony-ability-derive = { path = "../openharmony-ability/crates/derive" }
to:   openharmony-ability-derive = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

from: openharmony-ability = { path = "../openharmony-ability/crates/ability" }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

from: wry = { path = "../wry" }
to:   wry = { git = "https://github.com/Eulogizethesun/wry", branch = "ohdev-git" }

from: tao = { path = "../tao" }
to:   tao = { git = "https://github.com/Eulogizethesun/tao", branch = "ohdev-git" }

from: muda = { path = "../muda" }
to:   muda = { git = "https://github.com/Eulogizethesun/muda", branch = "ohdev-git" }

from: tray-icon = { path = "../tray-icon" }
to:   tray-icon = { git = "https://github.com/Eulogizethesun/tray-icon", branch = "ohdev-git" }

# cargo-mobile2: 目标必须是 Eulogizethesun (不是 tauri-apps), 因本地工作区有 app::build 改动
from: cargo-mobile2 = { path = "../cargo-mobile2", default-features = false }
to:   cargo-mobile2 = { git = "https://github.com/Eulogizethesun/cargo-mobile2", branch = "ohdev-git", default-features = false }

# window-vibrancy: ohdev 新增的跨仓依赖
from: window-vibrancy = { path = "../window-vibrancy" }
to:   window-vibrancy = { git = "https://github.com/Eulogizethesun/window-vibrancy", branch = "ohdev-git" }
```

> ⚠️ **不要修改** L72 `schemars_derive` 行（已是 git 依赖）。
> ⚠️ **不要修改** L73-75 `tauri`/`tauri-plugin`/`tauri-utils` 的 `path = "./crates/..."` 行（仓内自引用）。
> ⚠️ **不要修改** L78 被注释的 `#tao = { git = ... }` 行。

#### 2.1b tauri/crates/tauri-cli/Cargo.toml — cargo-mobile2

```
from: cargo-mobile2 = { path = "../../../cargo-mobile2", default-features = false }
to:   cargo-mobile2 = { git = "https://github.com/Eulogizethesun/cargo-mobile2", branch = "ohdev-git", default-features = false }
```

#### 2.2 tauri/crates/tauri/Cargo.toml — desktop deps (cfg not ohos)

```
from: muda = { path = "../../../muda", default-features = false, features = [
        "serde",
        "gtk",
      ] }
to:   muda = { git = "https://github.com/Eulogizethesun/muda", branch = "ohdev-git", default-features = false, features = [
        "serde",
        "gtk",
      ] }

from: tray-icon = { path = "../../../tray-icon", default-features = false, features = [
        "serde",
      ], optional = true }
to:   tray-icon = { git = "https://github.com/Eulogizethesun/tray-icon", branch = "ohdev-git", default-features = false, features = [
        "serde",
      ], optional = true }
```

#### 2.3 tauri/crates/tauri/Cargo.toml — ohos deps

```
from: muda = { path = "../../../muda", default-features = false, features = [
        "serde",
      ] }
to:   muda = { git = "https://github.com/Eulogizethesun/muda", branch = "ohdev-git", default-features = false, features = [
        "serde",
      ] }

from: tray-icon = { path = "../../../tray-icon", default-features = false, features = [
        "serde",
      ], optional = true }
to:   tray-icon = { git = "https://github.com/Eulogizethesun/tray-icon", branch = "ohdev-git", default-features = false, features = [
        "serde",
      ], optional = true }

# derive 必须在 ability 之前！
from: openharmony-ability-derive = { path = "../../../openharmony-ability/crates/derive" }
to:   openharmony-ability-derive = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

from: openharmony-ability = { path = "../../../openharmony-ability/crates/ability", features = ["menu"] }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git", features = ["menu"] }

# [NEW] openharmony-ability-plugin-menu: ohdev 后续新增的 plugin 子 crate
from: openharmony-ability-plugin-menu = { path = "../../../openharmony-ability/crates/plugin-menu" }
to:   openharmony-ability-plugin-menu = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
```

> ⚠️ 注意 §2.2 和 §2.3 中的 `muda`/`tray-icon` 行**文本相同**（`path = "../../../muda"` 和 `path = "../../../tray-icon"`），但 features 不同。替换时必须连同 features 数组一起匹配，确保精确命中目标行。可用 Edit 工具的上下文匹配（含 features 数组的多行 old_string）区分。
>
> ⚠️ **不要修改** L188 `tauri-build = { path = "../tauri-build/", ... }`、L189 `tauri-utils = { path = "../tauri-utils/", ... }`（仓内自引用）。
> ⚠️ **不要修改** L255-292 的 `path = "../../examples/..."` 行（仓内 example 路径，非依赖）。

#### 2.4 tauri/crates/tauri-runtime/Cargo.toml

```
from: openharmony-ability = { path = "../../../openharmony-ability/crates/ability" }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
```

#### 2.5 tauri/crates/tauri-runtime-wry/Cargo.toml

```
from: wry = { path = "../../../wry", default-features = false, features = [
        "protocol",
        "os-webview",
        "linux-body",
      ] }
to:   wry = { git = "https://github.com/Eulogizethesun/wry", branch = "ohdev-git", default-features = false, features = [
        "protocol",
        "os-webview",
        "linux-body",
      ] }

from: tao = { path = "../../../tao",  default-features = false, features = ["rwh_06"] }
to:   tao = { git = "https://github.com/Eulogizethesun/tao", branch = "ohdev-git",  default-features = false, features = ["rwh_06"] }

from: openharmony-ability = { path = "../../../openharmony-ability/crates/ability" }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [NEW] openharmony-ability-plugin-window
from: openharmony-ability-plugin-window = { path = "../../../openharmony-ability/crates/plugin-window" }
to:   openharmony-ability-plugin-window = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [NEW] openharmony-ability-plugin-url
from: openharmony-ability-plugin-url = { path = "../../../openharmony-ability/crates/plugin-url" }
to:   openharmony-ability-plugin-url = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
```

> ⚠️ **不要修改** L29 `tauri-runtime = { ..., path = "../tauri-runtime" }` 和 L30 `tauri-utils = { ..., path = "../tauri-utils" }`（仓内自引用）。

#### 2.6 tauri/examples/api/src-tauri/Cargo.toml — plugins (逐个替换)

> ⚠️ 每个插件必须单独替换，不能用批量模式。
> ⚠️ `tauri-plugin-dialog` 和 `tauri-plugin-deep-link` 各出现两次（non-OHOS + OHOS 段），使用 `replace_all: true`。

**原版已有的插件条目：**

```
from: tauri-plugin-http = { path = "../../../../plugins-workspace/plugins/http" }
to:   tauri-plugin-http = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-os = { path = "../../../../plugins-workspace/plugins/os" }
to:   tauri-plugin-os = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-fs = { path = "../../../../plugins-workspace/plugins/fs" }
to:   tauri-plugin-fs = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-shell = { path = "../../../../plugins-workspace/plugins/shell" }
to:   tauri-plugin-shell = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-clipboard-manager = { path = "../../../../plugins-workspace/plugins/clipboard-manager" }
to:   tauri-plugin-clipboard-manager = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-process = { path = "../../../../plugins-workspace/plugins/process" }
to:   tauri-plugin-process = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-updater = { path = "../../../../plugins-workspace/plugins/updater" }
to:   tauri-plugin-updater = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-autostart = { path = "../../../../plugins-workspace/plugins/autostart" }
to:   tauri-plugin-autostart = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-log = { path = "../../../../plugins-workspace/plugins/log" }
to:   tauri-plugin-log = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-notification = { path = "../../../../plugins-workspace/plugins/notification" }
to:   tauri-plugin-notification = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

# dialog 出现两次 (L49 non-OHOS + L65 OHOS)，使用 replace_all: true
from: tauri-plugin-dialog = { path = "../../../../plugins-workspace/plugins/dialog" }
to:   tauri-plugin-dialog = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-single-instance = { path = "../../../../plugins-workspace/plugins/single-instance" }
to:   tauri-plugin-single-instance = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-global-shortcut = { path = "../../../../plugins-workspace/plugins/global-shortcut" }
to:   tauri-plugin-global-shortcut = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

# sentry-tauri 是独立仓 (不是 plugins-workspace 子目录), 指向 Eulogizethesun/sentry-tauri
from: tauri-plugin-sentry = { path = "../../../../sentry-tauri" }
to:   tauri-plugin-sentry = { git = "https://github.com/Eulogizethesun/sentry-tauri", branch = "ohdev-git" }
```

**[NEW] ohdev 新增插件条目（原版 skill 缺失）：**

```
from: tauri-plugin-persisted-scope = { path = "../../../../plugins-workspace/plugins/persisted-scope" }
to:   tauri-plugin-persisted-scope = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-window-state = { path = "../../../../plugins-workspace/plugins/window-state" }
to:   tauri-plugin-window-state = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

# deep-link 出现两次 (L54 non-OHOS + L68 OHOS)，使用 replace_all: true
from: tauri-plugin-deep-link = { path = "../../../../plugins-workspace/plugins/deep-link" }
to:   tauri-plugin-deep-link = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-store = { path = "../../../../plugins-workspace/plugins/store" }
to:   tauri-plugin-store = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-sql = { path = "../../../../plugins-workspace/plugins/sql", features = ["sqlite"] }
to:   tauri-plugin-sql = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git", features = ["sqlite"] }

from: tauri-plugin-websocket = { path = "../../../../plugins-workspace/plugins/websocket" }
to:   tauri-plugin-websocket = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-cli = { path = "../../../../plugins-workspace/plugins/cli" }
to:   tauri-plugin-cli = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-upload = { path = "../../../../plugins-workspace/plugins/upload" }
to:   tauri-plugin-upload = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-localhost = { path = "../../../../plugins-workspace/plugins/localhost" }
to:   tauri-plugin-localhost = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-opener = { path = "../../../../plugins-workspace/plugins/opener" }
to:   tauri-plugin-opener = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-positioner = { path = "../../../../plugins-workspace/plugins/positioner" }
to:   tauri-plugin-positioner = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-haptics = { path = "../../../../plugins-workspace/plugins/haptics" }
to:   tauri-plugin-haptics = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-geolocation = { path = "../../../../plugins-workspace/plugins/geolocation" }
to:   tauri-plugin-geolocation = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-biometric = { path = "../../../../plugins-workspace/plugins/biometric" }
to:   tauri-plugin-biometric = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-nfc = { path = "../../../../plugins-workspace/plugins/nfc" }
to:   tauri-plugin-nfc = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-barcode-scanner = { path = "../../../../plugins-workspace/plugins/barcode-scanner" }
to:   tauri-plugin-barcode-scanner = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-huawei-account = { path = "../../../../plugins-workspace/plugins/huawei-account" }
to:   tauri-plugin-huawei-account = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-accessibility = { path = "../../../../plugins-workspace/plugins/accessibility" }
to:   tauri-plugin-accessibility = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-screenshot = { path = "../../../../plugins-workspace/plugins/screenshot" }
to:   tauri-plugin-screenshot = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: tauri-plugin-continuation = { path = "../../../../plugins-workspace/plugins/continuation" }
to:   tauri-plugin-continuation = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }
```

**[NEW] openharmony-ability 子 crate + muda/tray-icon 直接依赖（OHOS 段）：**

```
from: openharmony-ability = { path = "../../../../openharmony-ability/crates/ability" }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

from: openharmony-ability-plugin-webview = { path = "../../../../openharmony-ability/crates/plugin-webview" }
to:   openharmony-ability-plugin-webview = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

from: openharmony-ability-plugin-window = { path = "../../../../openharmony-ability/crates/plugin-window" }
to:   openharmony-ability-plugin-window = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

from: muda = { path = "../../../../muda" }
to:   muda = { git = "https://github.com/Eulogizethesun/muda", branch = "ohdev-git" }

from: tray-icon = { path = "../../../../tray-icon" }
to:   tray-icon = { git = "https://github.com/Eulogizethesun/tray-icon", branch = "ohdev-git" }
```

> ⚠️ **不要修改** L14 `tauri-build = { path = "../../../crates/tauri-build", ... }`（仓内自引用）。
> ⚠️ **不要修改** L25 `tauri-plugin-sample = { path = "./tauri-plugin-sample/" }`（仓内自引用）。
> ⚠️ **不要修改** L96/L109 `path = "../../../crates/tauri"`（`[dependencies.tauri]` / `[dev-dependencies.tauri]` 表内的仓内 path，非跨仓依赖）。

#### 2.6b tauri/examples/huawei-account/src-tauri/Cargo.toml

> [NEW] 此文件原版 skill 未涵盖。ohdev 新增的独立 huawei-account 示例。

```
from: tauri-plugin-huawei-account = { path = "../../../../plugins-workspace/plugins/huawei-account" }
to:   tauri-plugin-huawei-account = { git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git" }

from: openharmony-ability = { path = "../../../../openharmony-ability/crates/ability" }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
```

> ⚠️ **不要修改** L14 `tauri-build = { path = "../../../crates/tauri-build", ... }` 和 L30 `path = "../../../crates/tauri"`（仓内自引用）。

#### 2.7 tao/Cargo.toml

```
# derive 必须在 ability 之前！
from: openharmony-ability-derive = { path = "../openharmony-ability/crates/derive" }
to:   openharmony-ability-derive = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

from: openharmony-ability = { path = "../openharmony-ability/crates/ability" }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [NEW] openharmony-ability-plugin-window
from: openharmony-ability-plugin-window = { path = "../openharmony-ability/crates/plugin-window" }
to:   openharmony-ability-plugin-window = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
```

> ⚠️ **不要修改** L109 `tao-macros = { version = "0.1.0", path = "./tao-macros" }`（仓内自引用）。

#### 2.8 wry/Cargo.toml

```
# derive 必须在 ability 之前！
from: openharmony-ability-derive = { path = "../openharmony-ability/crates/derive" }
to:   openharmony-ability-derive = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

from: openharmony-ability = { path = "../openharmony-ability/crates/ability" }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [NEW] openharmony-ability-plugin-webview
from: openharmony-ability-plugin-webview = { path = "../openharmony-ability/crates/plugin-webview" }
to:   openharmony-ability-plugin-webview = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
```

> ⚠️ **不要修改** `bench/tests/Cargo.toml` 的 `wry = { path = "../../" }`（仓内自引用，bench 指回 wry 根）。

#### 2.9 muda/Cargo.toml

> [CHANGED] 原版 skill 的 `openharmony-ability = { path = "...", features = ["menu"] }` 已被重构为 `openharmony-ability-plugin-menu` 子 crate 依赖（不再直接依赖 `openharmony-ability` ability crate，features 也随之移除）。

```
from: openharmony-ability-plugin-menu = { path = "../openharmony-ability/crates/plugin-menu" }
to:   openharmony-ability-plugin-menu = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
```

> ⚠️ **不要修改** `examples/windows-common-controls-v6/Cargo.toml` 的 `muda = { path = "../../", ... }`（仓内自引用，example 指回 muda 根）。

#### 2.10 tray-icon/Cargo.toml

> [CHANGED] 原版 skill 的 `openharmony-ability = { path = "...", features = ["menu", "statusbar"] }` 已被重构：`openharmony-ability` 保留但**移除了 features**（裸 path），同时新增 `openharmony-ability-plugin-statusbar` 和 `openharmony-ability-plugin-menu` 子 crate 依赖。

```
# muda 在 [patch.crates-io] 段
from: muda = { path = "../muda" }
to:   muda = { git = "https://github.com/Eulogizethesun/muda", branch = "ohdev-git" }

# [CHANGED] features 已移除
from: openharmony-ability = { path = "../openharmony-ability/crates/ability" }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [NEW]
from: openharmony-ability-plugin-statusbar = { path = "../openharmony-ability/crates/plugin-statusbar" }
to:   openharmony-ability-plugin-statusbar = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [NEW]
from: openharmony-ability-plugin-menu = { path = "../openharmony-ability/crates/plugin-menu" }
to:   openharmony-ability-plugin-menu = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
```

#### 2.11 plugins-workspace/Cargo.toml — [patch.crates-io]

> [CHANGED] 原版 skill 仅列了 `openharmony-ability` + `openharmony-ability-derive` 两条，并注释"不要修改 `tauri-plugin` 行（已是 git 依赖）"。当前 ohdev 已将 tauri 核心 crate 和其他仓全部加入 `[patch.crates-io]` 作为 path 依赖，必须全部迁移。`tauri-plugin` 不再是 git 依赖——它现在是 path 依赖。

```
# tauri 核心 crate 全部指向 Eulogizethesun/tauri
from: tauri = { path = "../tauri/crates/tauri" }
to:   tauri = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }

from: tauri-build = { path = "../tauri/crates/tauri-build" }
to:   tauri-build = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }

from: tauri-utils = { path = "../tauri/crates/tauri-utils" }
to:   tauri-utils = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }

from: tauri-runtime = { path = "../tauri/crates/tauri-runtime" }
to:   tauri-runtime = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }

from: tauri-runtime-wry = { path = "../tauri/crates/tauri-runtime-wry" }
to:   tauri-runtime-wry = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }

from: tauri-plugin = { path = "../tauri/crates/tauri-plugin" }
to:   tauri-plugin = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }

# 其他仓
from: wry = { path = "../wry" }
to:   wry = { git = "https://github.com/Eulogizethesun/wry", branch = "ohdev-git" }

from: tao = { path = "../tao" }
to:   tao = { git = "https://github.com/Eulogizethesun/tao", branch = "ohdev-git" }

from: muda = { path = "../muda" }
to:   muda = { git = "https://github.com/Eulogizethesun/muda", branch = "ohdev-git" }

from: tray-icon = { path = "../tray-icon" }
to:   tray-icon = { git = "https://github.com/Eulogizethesun/tray-icon", branch = "ohdev-git" }

# [NEW] window-vibrancy
from: window-vibrancy = { path = "../window-vibrancy" }
to:   window-vibrancy = { git = "https://github.com/Eulogizethesun/window-vibrancy", branch = "ohdev-git" }

# derive 必须在 ability 之前！
from: openharmony-ability-derive = { path = "../openharmony-ability/crates/derive" }
to:   openharmony-ability-derive = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

from: openharmony-ability = { path = "../openharmony-ability/crates/ability" }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
```

#### 2.12 plugins-workspace/plugins/*/Cargo.toml

> [CHANGED] 原版 skill 的 autostart/clipboard-manager/single-instance/global-shortcut 条目直接依赖 `openharmony-ability`（ability crate）。当前 ohdev 已重构为依赖 plugin-specific 子 crate（如 `openharmony-ability-plugin-autostart`、`openharmony-ability-plugin-clipboard` 等）。以下为当前实际状态。

```
# [NEW] accessibility
plugins/accessibility/Cargo.toml:
from: openharmony-ability-plugin-accessibility = { path = "../../../openharmony-ability/crates/plugin-accessibility" }
to:   openharmony-ability-plugin-accessibility = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [CHANGED] 原为 openharmony-ability = { path = "...", } (无 features)
plugins/autostart/Cargo.toml:
from: openharmony-ability-plugin-autostart = { path = "../../../openharmony-ability/crates/plugin-autostart" }
to:   openharmony-ability-plugin-autostart = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [CHANGED] 原为 openharmony-ability = { path = "...", features = ["clipboard"] }
plugins/clipboard-manager/Cargo.toml:
from: openharmony-ability-plugin-clipboard = { path = "../../../openharmony-ability/crates/plugin-clipboard" }
to:   openharmony-ability-plugin-clipboard = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [NEW] continuation
plugins/continuation/Cargo.toml:
from: openharmony-ability-plugin-continuation = { path = "../../../openharmony-ability/crates/plugin-continuation" }
to:   openharmony-ability-plugin-continuation = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [NEW] deep-link
plugins/deep-link/Cargo.toml:
from: openharmony-ability-plugin-deep-link = { path = "../../../openharmony-ability/crates/plugin-deep-link" }
to:   openharmony-ability-plugin-deep-link = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [CHANGED] 原为 openharmony-ability = { path = "...", features = ["global_shortcut"] }
plugins/global-shortcut/Cargo.toml:
from: openharmony-ability-plugin-global-shortcut = { path = "../../../openharmony-ability/crates/plugin-global-shortcut" }
to:   openharmony-ability-plugin-global-shortcut = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [NEW] huawei-account (直接依赖 ability crate, 带 features)
plugins/huawei-account/Cargo.toml:
from: openharmony-ability = { path = "../../../openharmony-ability/crates/ability", features = ["account"] }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git", features = ["account"] }

# [NEW] opener
plugins/opener/Cargo.toml:
from: openharmony-ability-plugin-url = { path = "../../../openharmony-ability/crates/plugin-url" }
to:   openharmony-ability-plugin-url = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [NEW] screenshot
plugins/screenshot/Cargo.toml:
from: openharmony-ability-plugin-screenshot = { path = "../../../openharmony-ability/crates/plugin-screenshot" }
to:   openharmony-ability-plugin-screenshot = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [CHANGED] 原为 openharmony-ability = { path = "...", } (无 features)
plugins/single-instance/Cargo.toml:
from: openharmony-ability-plugin-deep-link = { path = "../../../openharmony-ability/crates/plugin-deep-link" }
to:   openharmony-ability-plugin-deep-link = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }

# [NEW] updater (直接依赖 ability crate, 带 features)
plugins/updater/Cargo.toml:
from: openharmony-ability = { path = "../../../openharmony-ability/crates/ability", features = ["updater"] }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git", features = ["updater"] }
```

> ⚠️ **不要修改** 仓内插件互引（如 `plugins/dialog/Cargo.toml` 的 `tauri-plugin-fs = { path = "../fs", ... }`、`plugins/single-instance/Cargo.toml` 的 `tauri-plugin-deep-link = { path = "../deep-link", ... }` 等——这些是 plugins-workspace 内部成员互引，非跨仓）。
> ⚠️ **不要修改** 各插件 `examples/*/src-tauri/Cargo.toml` 中的 `path = "../../../"` 类仓内自引用。

#### 2.13 window-vibrancy/Cargo.toml — openharmony-ability

window-vibrancy 是 ohdev 新加入工作区的仓，自身有跨仓 `openharmony-ability` 依赖需要迁移（保留 `default-features = false, features = ["window"]`）。

```
from: openharmony-ability = { path = "../openharmony-ability/crates/ability", default-features = false, features = ["window"] }
to:   openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git", default-features = false, features = ["window"] }

# [NEW] openharmony-ability-plugin-window
from: openharmony-ability-plugin-window = { path = "../openharmony-ability/crates/plugin-window" }
to:   openharmony-ability-plugin-window = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
```

> ⚠️ 仓内自引用（`examples/tauri/src-tauri/Cargo.toml` 的 `window-vibrancy = { path = "../../../" }`）保留不动。

### Step 3: 验证

替换完成后执行：
```bash
cd D:/xuqiu/tauri-3.0/tauri
cargo check --workspace 2>&1 | head -50
```

如果网络可用，Cargo 会 clone 所有 git 依赖并验证解析。如果网络不可用，记录警告但不阻塞。

验证无残留跨仓 path 依赖：
```bash
cd D:/xuqiu/tauri-3.0
for repo in tauri tao wry muda tray-icon plugins-workspace window-vibrancy; do
  echo "=== $repo ==="
  (cd "$repo" && grep -rn 'path\s*=\s*"\.\.' --include="Cargo.toml" . | grep -v target/ | grep -v '#')
done
```

残留行应全部为仓内自引用（如 `path = "../tauri-runtime"` 在 tauri 仓内、`path = "./tao-macros"` 在 tao 仓内等），无跨仓 `path = "../<sibling-repo>"` 残留。

### Step 4: 报告

输出替换总结：
```
✅ 已替换 100 处跨仓 path 依赖
- tauri: 64 处
- tao: 3 处
- wry: 3 处
- muda: 1 处
- tray-icon: 4 处
- plugins-workspace: 23 处 (root 12 + plugins 11)
- window-vibrancy: 2 处
- openharmony-ability: 0 (叶子节点)
- cargo-mobile2: 0 (叶子节点)
- sentry-tauri: 0 (叶子节点)
```

## 参考文档

- [完整映射表](references/mapping-table.md) — crate 名称、git URL、本地路径对照
