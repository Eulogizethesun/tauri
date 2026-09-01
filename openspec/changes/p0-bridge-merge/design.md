## Context

本地 `ohdev` 分支（`78a8a17`）基于旧的 `get_named_property` 字符串直调模型，包含 9 项 Tauri 适配功能（R75/R82/R83/R91/R72/R140/R136 等）。上游 `harmony-contrib/openharmony-ability` 已完成 pluginized bridge 重构：

- **PR #67**（`c6c4c9a`，已合入 harmony-contrib/main）：核心 bridge 传输层 + `#[ability]` 宏重构
- **PR #68**（`7030df1`，harmony-contrib/feat/pr63-pluginized）：11 个内置插件实现

merge base 为 `6c52bb4`。尝试 `git merge harmony-contrib/main` 产生 30 个冲突（11 modify/delete + 19 content）。

**约束**：
- openharmony-ability 是唯一 ArkTS 桥接仓（铁律 #1）
- 不影响其他平台（铁律 #2）
- merge 后需要 `cargo check --target aarch64-unknown-linux-ohos` 编译通过

## Goals / Non-Goals

**Goals:**
- 将 PR #67 + #68 合入本地 ohdev 分支
- 解决所有 30+ 个冲突，保留两端改动
- 将被删除文件中的本地功能代码暂存到 `_legacy/` 目录，供后续 Phase 搬迁
- merge 后 openharmony-ability 能通过 OHOS 交叉编译
- ArkHelper.ets 废弃状态确认和处置

**Non-Goals:**
- 不改动消费方代码（wry/tao/tauri/tray-icon/muda）— 后续 Phase 做
- 不实现补 action — 后续 Phase A1 做
- 不验证设备端功能 — 后续 Phase 做
- 不解决 R75 同步语义问题 — 后续 Phase A2 做

## Decisions

### D1: merge 策略选择

**方案一**（推荐）：先 merge harmony-contrib/main（PR #67），再 merge feat/pr63-pluginized（PR #68）
- 优点：分两步解决冲突，每步冲突较少，便于定位问题
- 缺点：需要两次 merge 操作

**方案二**：直接 merge feat/pr63-pluginized（已包含 main）
- 优点：一步到位
- 缺点：冲突更多，定位困难

**选择方案一**，先用 `--no-commit` 试跑确认冲突数。

### D2: modify/delete 文件处置

11 个 modify/delete 文件（helper/webview.rs, webview/mod.rs, webview/drag.rs, DefaultWebview.ets, Utils.ets 等）：
- **接受删除**（新架构已将这些功能搬入 plugin）
- **暂存本地改动**到 `crates/ability/src/_legacy/` 目录（Rust 侧）和 `native_ability/src/main/ets/_legacy/`（ArkTS 侧）
- 暂存代码作为后续 Phase A1 的搬迁参考，不编译

### D3: content 冲突解决原则

- `app.rs`：保留本地的 refresh_rate/display_width/height + 合入上游的 bridge()/register_plugin()
- `lib.rs`：以上游为主（新模块导出），补入本地需要的 re-export
- `derive/src/lib.rs`：以上游为主（`#[ability]` 无参数版本）
- `Cargo.toml`：以上游为主（新 workspace 成员），补入本地依赖
- `NativeAbility.ets`：以上游为主，保留本地的 `moduleName` 配置
- `type.ets`：以上游为主，补入本地字段（如有）
- `MainPage.ets`：以上游为主，本地 drag overlay + onKeyPreIme 暂存到 `_legacy/`
- demo/ 和 rust_example/：以上游为主

### D4: ArkHelper.ets 处置

merge 后检查 ArkHelper.ets 是否仍被引用：
- 如果已废弃：将本地改动（clipboard/zoom/https 装配代码）暂存到 `_legacy/ArkHelper.ets.bak`
- 如果仍在使用：保留，添加 `// @deprecated - use BridgeHost.ets instead` 注释

### D5: 分支策略

- 在 ohdev 上直接 merge（不创建新分支），因为 ohdev 是工作分支
- merge 前创建 tag `pre-bridge-merge` 作为回退点

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| merge 后编译失败 | 逐文件解决冲突，每解决 5 个文件做一次 cargo check |
| 暂存代码遗漏 | 在 `_legacy/` 目录下创建 `README.md` 列出所有暂存文件及其原始位置和功能说明 |
| ArkHelper.ets 处置不当 | merge 后 `grep -r "ArkHelper" --include="*.ets"` 确认引用状态 |
| 新架构 API 变化超出预期 | 先完成 merge 和编译通过，API 适配放后续 Phase |
