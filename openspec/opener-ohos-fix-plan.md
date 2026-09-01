# Opener 插件 OHOS 适配修复 适配计划

**创建时间**：2026-07-17
**功能描述**：opener 插件 `plugin:opener|open_path` / `open_url` / `reveal_item_in_dir` 在 OHOS desktop 上 invoke 失败。根因：opener 缺少 OHOS 平台实现——`open` crate v5 在 OHOS 上走 `target_os="linux"` 分支调用不存在的 `xdg-open`/`gio`；`reveal_item_in_dir.rs` 的 cfg 门控包含 `target_os="linux"`（OHOS 为 true）导致编译进 zbus/D-Bus 实现（违反铁律 #3：Linux 依赖未加 `not(target_env="ohos")` 排除）。用户报告的 "unexpected invoke body" 为表象错误，`Application` enum/scope 反序列化非根因（scope 来自 ACL 配置，跨平台一致）。需通过 `openharmony-ability` NAPI 桥接 ArkTS `startAbility(Want)` 实现真正可用，并修复 cfg 隔离。
**判断依据**：涉及 2 个代码层（openharmony-ability 底层 NAPI + opener 插件上层），预估影响 6-8 个文件。按用户指定生成单 change `p1_opener-ohos-fix`：底层 NAPI 复用既有 startAbility 桥接模式（增量小），上层为 cfg 隔离 + 路由，二者紧耦合不宜拆分。单 Phase 完成。

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | OHOS 平台实现 + cfg 隔离修复 | p1-opener-ohos-fix | ✓ 设计完成 | openharmony-ability (NAPI) + opener 插件 | 6-8 | cargo check OHOS + 设备端 open_url/open_path/reveal_item_in_dir 端到端 |

## Phase 详细说明

### Phase 1: OHOS 平台实现 + cfg 隔离修复
- **目标**：
  1. 在 `openharmony-ability` 新增 NAPI 函数（经 ArkTS `UIAbilityContext.startAbility` 打开 URL/路径；以文件管理器打开父目录作为 reveal 的降级实现）。
  2. 在 opener 插件 `open.rs` / `reveal_item_in_dir.rs` 增加 `cfg(target_env="ohos")` 分支，路由到 openharmony-ability NAPI；修复 `reveal_item_in_dir.rs` 与 `error.rs` 的代码级 cfg 门控，将 OHOS 从 Linux/zbus 分支排除（`not(target_env="ohos")`）。
  3. **[MUST，铁律 #3] 收紧 `plugins/opener/Cargo.toml:47` 的 linux/BSD target-dep gate**：将 `cfg(any(target_os="linux", target_os="dragonfly", target_os="freebsd", target_os="netbsd", target_os="openbsd"))` 改为 `cfg(all(any(target_os="linux", target_os="dragonfly", target_os="freebsd", target_os="netbsd", target_os="openbsd"), not(target_env="ohos")))`，使 `zbus` 与 `url` 同时从 OHOS 编译图移除。源码核对确认现有 gate 不含 ohos 排除，OHOS 上 `target_os="linux"` 为真 → zbus 进入 OHOS 编译图，违反铁律 #3。**仅改代码级 cfg 不足以隔离**（design.md Decision5 Issue1 明确此点），Cargo.toml gate 收紧为独立 MUST 项，不得漏列。`url`（纯 Rust）从 linux gate 移除后，在新增的 `[target.'cfg(target_env = "ohos")'.dependencies]` 段重新声明供 OHOS 分支使用。
  4. `open_url`/`open_path` 在 OHOS desktop 行为与 Windows/macOS 一致（系统默认应用打开）；`reveal_item_in_dir` 在 OHOS 上降级为"打开父目录"（OHOS 无选中文件 API，显式标注平台差异）。
  5. 不影响 Windows/macOS/Linux/Android/iOS 既有路径（铁律 #2/#3）。
- **文件列表（预估）**：
  - `openharmony-ability/crates/ability/src/helper/...`（新增 open_with_system / reveal_in_dir NAPI，Rust 侧）
  - `openharmony-ability/.../ArkTS` 侧（新增 startAbility 封装）
  - `plugins-workspace/plugins/opener/src/open.rs`（OHOS 分支）
  - `plugins-workspace/plugins/opener/src/reveal_item_in_dir.rs`（cfg 修复 + OHOS 分支）
  - `plugins-workspace/plugins/opener/src/error.rs`（cfg 修复 Zbus variant 排除 OHOS；新增 OHOS 错误变体）
  - `plugins-workspace/plugins/opener/src/lib.rs`（如需 Builder/编译适配）
  - `plugins-workspace/plugins/opener/Cargo.toml`（**MUST：收紧 Cargo.toml:47 的 linux/BSD target-dep gate，追加 `not(target_env="ohos")`，使 `zbus`+`url` 从 OHOS 编译图移除（铁律 #3，仅改代码级 cfg 不足以隔离）**；新增 `[target.'cfg(target_env = "ohos")'.dependencies]` 段声明 `openharmony-ability` 与 `url`；`[package.metadata.platforms.support]` 增加 `ohos = { level = "partial", ... }`）
- **依赖**：无
- **验证方式**：
  - `cargo check --target aarch64-linux-ohos -p tauri-plugin-opener` 退出码 0
  - `cargo tree --target aarch64-linux-ohos -p tauri-plugin-opener | grep zbus` 输出为空（验证 Cargo.toml gate 收紧生效，zbus 不进入 OHOS 编译图）
  - 非 OHOS 目标 `cargo check --target x86_64-unknown-linux-gnu -p tauri-plugin-opener` 回归通过（zbus Linux 实现照常编译）
  - 设备端：`openUrl('https://...')` 调起系统浏览器；`openPath('/path/file')` 用默认应用打开；`revealItemInDir('/path/file')` 打开父目录（降级）
  - ACL scope 行为：opener permissions 配置的 allow/deny 在 OHOS 上仍生效（scope 反序列化路径不变）

## 状态说明
- `○ 待开始` — 未开始设计
- `● 进行中` — 正在设计或实现
- `✓ 设计完成` — 设计文档已生成并通过审计
- `✓ 已归档` — 已完成实现、测试并归档
