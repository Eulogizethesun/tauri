# Dependency Mapping Table

This table maps every cross-repo dependency between its **path** form (local development) and **git** form (Eulogizethesun/ohdev-git).

> **工作区根目录**（包含这 10 个并列 git 仓的目录，当前为 `D:/xuqiu/tauri-3.0/`）。下文"本地路径"列均相对于各仓根目录。

## Git URL Pattern

All git dependencies use: `git = "https://github.com/Eulogizethesun/<repo>", branch = "ohdev-git"`

## Core Crates (tauri ecosystem)

| Crate | Git Repo | Local Path (relative to repo root) |
|-------|----------|------------------------------------|
| `tauri` | `Eulogizethesun/tauri` | `../tauri/crates/tauri` |
| `tauri-build` | `Eulogizethesun/tauri` | `../tauri/crates/tauri-build` |
| `tauri-utils` | `Eulogizethesun/tauri` | `../tauri/crates/tauri-utils` |
| `tauri-runtime` | `Eulogizethesun/tauri` | `../tauri/crates/tauri-runtime` |
| `tauri-runtime-wry` | `Eulogizethesun/tauri` | `../tauri/crates/tauri-runtime-wry` |
| `tauri-plugin` | `Eulogizethesun/tauri` | `../tauri/crates/tauri-plugin` |
| `wry` | `Eulogizethesun/wry` | `../wry` |
| `tao` | `Eulogizethesun/tao` | `../tao` |
| `muda` | `Eulogizethesun/muda` | `../muda` |
| `tray-icon` | `Eulogizethesun/tray-icon` | `../tray-icon` |
| `window-vibrancy` | `Eulogizethesun/window-vibrancy` | `../window-vibrancy` |
| `cargo-mobile2` | `Eulogizethesun/cargo-mobile2` | `../cargo-mobile2` |

## openharmony-ability Crates (all from one repo)

| Crate | Git Repo | Local Path (relative to repo root) |
|-------|----------|------------------------------------|
| `openharmony-ability` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/ability` |
| `openharmony-ability-derive` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/derive` |
| `openharmony-ability-plugin-window` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/plugin-window` |
| `openharmony-ability-plugin-webview` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/plugin-webview` |
| `openharmony-ability-plugin-menu` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/plugin-menu` |
| `openharmony-ability-plugin-statusbar` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/plugin-statusbar` |
| `openharmony-ability-plugin-url` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/plugin-url` |
| `openharmony-ability-plugin-screenshot` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/plugin-screenshot` |
| `openharmony-ability-plugin-accessibility` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/plugin-accessibility` |
| `openharmony-ability-plugin-autostart` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/plugin-autostart` |
| `openharmony-ability-plugin-clipboard` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/plugin-clipboard` |
| `openharmony-ability-plugin-continuation` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/plugin-continuation` |
| `openharmony-ability-plugin-deep-link` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/plugin-deep-link` |
| `openharmony-ability-plugin-global-shortcut` | `Eulogizethesun/openharmony-ability` | `../openharmony-ability/crates/plugin-global-shortcut` |

## Tauri Plugins (all from plugins-workspace)

All `tauri-plugin-*` crates listed below resolve to the same git repo:

`git = "https://github.com/Eulogizethesun/plugins-workspace", branch = "ohdev-git"`

| Plugin Crate | Local Path (from tauri/examples/api) |
|--------------|--------------------------------------|
| `tauri-plugin-http` | `../../../../plugins-workspace/plugins/http` |
| `tauri-plugin-os` | `../../../../plugins-workspace/plugins/os` |
| `tauri-plugin-fs` | `../../../../plugins-workspace/plugins/fs` |
| `tauri-plugin-persisted-scope` | `../../../../plugins-workspace/plugins/persisted-scope` |
| `tauri-plugin-shell` | `../../../../plugins-workspace/plugins/shell` |
| `tauri-plugin-clipboard-manager` | `../../../../plugins-workspace/plugins/clipboard-manager` |
| `tauri-plugin-process` | `../../../../plugins-workspace/plugins/process` |
| `tauri-plugin-updater` | `../../../../plugins-workspace/plugins/updater` |
| `tauri-plugin-autostart` | `../../../../plugins-workspace/plugins/autostart` |
| `tauri-plugin-log` | `../../../../plugins-workspace/plugins/log` |
| `tauri-plugin-notification` | `../../../../plugins-workspace/plugins/notification` |
| `tauri-plugin-window-state` | `../../../../plugins-workspace/plugins/window-state` |
| `tauri-plugin-dialog` | `../../../../plugins-workspace/plugins/dialog` |
| `tauri-plugin-single-instance` | `../../../../plugins-workspace/plugins/single-instance` |
| `tauri-plugin-global-shortcut` | `../../../../plugins-workspace/plugins/global-shortcut` |
| `tauri-plugin-deep-link` | `../../../../plugins-workspace/plugins/deep-link` |
| `tauri-plugin-store` | `../../../../plugins-workspace/plugins/store` |
| `tauri-plugin-sql` | `../../../../plugins-workspace/plugins/sql` |
| `tauri-plugin-websocket` | `../../../../plugins-workspace/plugins/websocket` |
| `tauri-plugin-cli` | `../../../../plugins-workspace/plugins/cli` |
| `tauri-plugin-upload` | `../../../../plugins-workspace/plugins/upload` |
| `tauri-plugin-localhost` | `../../../../plugins-workspace/plugins/localhost` |
| `tauri-plugin-opener` | `../../../../plugins-workspace/plugins/opener` |
| `tauri-plugin-positioner` | `../../../../plugins-workspace/plugins/positioner` |
| `tauri-plugin-haptics` | `../../../../plugins-workspace/plugins/haptics` |
| `tauri-plugin-geolocation` | `../../../../plugins-workspace/plugins/geolocation` |
| `tauri-plugin-biometric` | `../../../../plugins-workspace/plugins/biometric` |
| `tauri-plugin-nfc` | `../../../../plugins-workspace/plugins/nfc` |
| `tauri-plugin-barcode-scanner` | `../../../../plugins-workspace/plugins/barcode-scanner` |
| `tauri-plugin-huawei-account` | `../../../../plugins-workspace/plugins/huawei-account` |
| `tauri-plugin-accessibility` | `../../../../plugins-workspace/plugins/accessibility` |
| `tauri-plugin-screenshot` | `../../../../plugins-workspace/plugins/screenshot` |
| `tauri-plugin-continuation` | `../../../../plugins-workspace/plugins/continuation` |

## Sentry (separate repo)

| Crate | Git Repo | Local Path |
|-------|----------|------------|
| `tauri-plugin-sentry` | `Eulogizethesun/sentry-tauri` | `../../../../sentry-tauri` |

## Entries NOT modified (stay as-is in both modes)

- `schemars_derive` in `tauri/Cargo.toml` [patch] — already git dep to `tauri-apps/schemars` branch `feat/preserve-description-newlines`
- All intra-repo (workspace-internal) path dependencies, including:
  - tauri repo: `tauri`/`tauri-plugin`/`tauri-utils` self-references in `[patch.crates-io]` (`path = "./crates/..."`), `tauri-runtime`/`tauri-macros`/`tauri-utils`/`tauri-codegen`/`tauri-build` inter-crate refs, `tauri-cli`/`tauri-bundler`/`tauri-macos-sign` refs, bench example `path = "../../../../crates/..."` refs
  - tao: `tao-macros = { path = "./tao-macros" }`
  - wry: `wry = { path = "../../" }` in `bench/tests/Cargo.toml`
  - muda: `muda = { path = "../../", ... }` in `examples/windows-common-controls-v6/Cargo.toml`
  - tray-icon: (no intra-repo path deps beyond the ones already covered)
  - window-vibrancy: `window-vibrancy = { path = "../../../" }` in `examples/tauri/src-tauri/Cargo.toml`
  - plugins-workspace: plugin-to-plugin refs (e.g., `tauri-plugin-fs = { path = "../fs" }`, `tauri-plugin-deep-link = { path = "../deep-link" }`), example self-refs (`path = "../../../"`)
  - sentry-tauri: `tauri-plugin-sentry = { path = "../../.." }` in `examples/basic-app/src-tauri/Cargo.toml`

## cargo-mobile2 migration note

> ⚠️ **`cargo-mobile2` MUST be migrated** to `Eulogizethesun/cargo-mobile2#ohdev-git`.
>
> The ohdev workspace forked `cargo-mobile2` into the local workspace (`path = "../cargo-mobile2"`) to add `app::build (assembleApp)` and other OHOS bundler changes. The upstream `tauri-apps/cargo-mobile2#feat/ohos` branch does NOT have these changes. Therefore the git target must be `Eulogizethesun/cargo-mobile2` branch `ohdev-git`, consistent with all other dependencies.
>
> Affected files:
> - `tauri/Cargo.toml` [patch.crates-io]: `cargo-mobile2 = { path = "../cargo-mobile2", default-features = false }` → git
> - `tauri/crates/tauri-cli/Cargo.toml`: `cargo-mobile2 = { path = "../../../cargo-mobile2", default-features = false }` → git

## Downstream User [patch.crates-io]

Users who depend on Eulogizethesun forks via git need this in their own `Cargo.toml`:

```toml
[patch.crates-io]
tauri = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }
tauri-build = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }
tauri-utils = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }
tauri-runtime = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }
tauri-runtime-wry = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }
tauri-plugin = { git = "https://github.com/Eulogizethesun/tauri", branch = "ohdev-git" }
wry = { git = "https://github.com/Eulogizethesun/wry", branch = "ohdev-git" }
tao = { git = "https://github.com/Eulogizethesun/tao", branch = "ohdev-git" }
muda = { git = "https://github.com/Eulogizethesun/muda", branch = "ohdev-git" }
tray-icon = { git = "https://github.com/Eulogizethesun/tray-icon", branch = "ohdev-git" }
window-vibrancy = { git = "https://github.com/Eulogizethesun/window-vibrancy", branch = "ohdev-git" }
openharmony-ability = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
openharmony-ability-derive = { git = "https://github.com/Eulogizethesun/openharmony-ability", branch = "ohdev-git" }
```

All 13 crates are published on crates.io, so patches are necessary to redirect transitive crates.io dependencies to our git forks.
