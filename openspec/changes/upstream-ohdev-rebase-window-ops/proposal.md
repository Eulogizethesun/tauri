# upstream-ohdev-rebase-window-ops

## Why

2026-08-26 fetch `upstream/ohdev`：3 仓有更新（其余 7 仓 0 behind）：

- openharmony-ability：8 commits（PR#45，merge-base 5989181）
- tao：5 commits（PR#20，merge-base 9d41cbd0）
- tauri：9 commits（PR#73，merge-base c30d28b）

上游新增功能：window ops bridge（topmost/title/limits/user-attention/ime/draggable）、
cursor grab（NDK LockCursor FFI）、窗口状态回灌（windowStatusChange）、FloatPage 装饰、
webview naturalLayout、inner/outer 补偿、theme global。

**核心矛盾**：上游全部在旧 ArkHelper TSFN 框架上开发（`git ls-tree upstream/ohdev`
证实：oha 树里只有 ArkHelper.ets，无 bridge/ 无 plugins/），与本地 `c40ad0a`
pluginize 重构（15 个 typed bridge plugin + Rust facade）架构不兼容。上游调用的
7 个同步函数（`openharmony_ability::window::{set_window_topmost,...}`）在本地已删除。
**纯 `git rebase` 必然编译失败**——需要 rebase + 按功能点语义移植。

## What Changes

三仓协调 rebase（顺序 oha → tao → tauri，依赖链从底向上），上游 22 个 commit 按
四类处置（详见 design.md D1 分类判定表）：

1. **纯 FFI / 纯 Rust，原样并入**：`set_cursor_grab`（dlopen
   `OH_WindowManager_LockCursor`，API22+）、`notify_window_status` NAPI 直调 +
   `drain_pending_window_status`、tao `apply_window_status` + `WindowStatus` enum、
   theme global override、min/max inner size 4×AtomicU32 缓存
2. **移植成 WindowPlugin bridge action（7 个）**：`set-topmost` / `set-title` /
   `set-limits` / `request-user-attention` / `set-ime-position` /
   `set-draggable` / `get-real-window-id`——扩展现有 `ohos.window` 插件（现有
   19 个 action 基础上加），Rust 侧 `plugin-window::WindowClient` 加 async 方法，
   tao 侧用现有 `runtime.spawn` fire-and-forget 模式
3. **纯 ArkTS 修复手动迁移**（上游 patch 不适用，逻辑等价应用到本地重写版）：
   WindowManager 主窗口 show 改 `restore()`、hide 统一 `minimize()`、
   `getDecorationFlag` 拦截、`setPointerStyle` 真实 ID；FloatPage 装饰 +
   `startMoving`；DefaultWebview `naturalLayout`；tauri `with_bounds` OHOS 留空
4. **文档/skill/openspec**：纯新增直接取上游；`ohos-build/SKILL.md` 取并集；
   `pnpm-lock.yaml` rebase 后重跑 `pnpm install` 不手合

**inner/outer 尺寸策略取混合**（design.md D2，择优决策）：上游的语义（inner=客户区、
写侧补偿、inner_position 补 decor_height——实测标题栏 146px 漏算 bug 本地仍存在）×
本地的数据底座（per-window `window_rect_for`，上游共享 rect 对 Float 子窗口完全错误）。

### 不改清单

- 本地 pluginize 架构（15 插件注册链路、BridgeRuntime、EntryAbility 模板）不动
- 本地 11+5+3 个 commit 的既有修复全部保留（emit/Channel、window-state per-window、
  锁卫生、coverage/fault-injection、WindowId per-window routing）
- 非 OHOS 平台代码路径（铁律 2：所有并入代码 `cfg(target_env = "ohos")` 隔离）
- 上游 tao 的 inner/outer 补偿实现**不原样采纳**（依赖共享 rect + kind 字段特判，
  用 D2 混合方案替代）；上游 IME poll 回读模式不采纳（bridge await 直返更干净）
- wry / muda / tray-icon / window-vibrancy / plugins-workspace / cargo-mobile2 /
  sentry-tauri：upstream 无更新，不动

## Impact

- **代码**：openharmony-ability（WindowPlugin.ets + plugin-window + window/mod.rs +
  app.rs + WindowManager/FloatPage/DefaultWebview/NativeAbility + module.json5 权限）、
  tao（mod.rs 窗口 ops 函数群 + platform/ohos.rs ext trait）、tauri（runtime-wry
  status drain + bounds fix + TestRunner/cmd.rs 测试面 + cli 模板权限）
- **迁移风险**：D2 混合策略改变 inner_size 语义 → 存量 window-state 文件一次性
  长高一个标题栏（D7 缓解）；自动测试基线需复核（#46 幂等性保持，数值断言校正）
- **权限**：module.json5 需加 `ohos.permission.WINDOW_TOPMOST` +
  `ohos.permission.LOCK_WINDOW_CURSOR`（cli 模板 + gen/ohos 手动同步）
- **验证**：三仓 cargo check 双侧 0 error → HAR 重建 → 真机 282 基线回归 +
  cursor grab/IME/topmost 手动用例
