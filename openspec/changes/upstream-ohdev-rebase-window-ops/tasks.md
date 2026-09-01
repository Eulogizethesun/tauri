# upstream-ohdev-rebase-window-ops Tasks

## 0. 前置

- [x] 0.1 审计子agent 复核 design.md（2026-08-26 完成）：22 commits 对账完整、
      D2 幂等推演通过、4 个 review 修复有任务、铁律合规、**无阻断项**；4 警告
      （W1 stats-union WIP 处置 / W2 强制 window_kind 禁 id 近似 / W3 存量缓存
      定稿=接受一次性跳变 / W4 oha module.json5 仅 LOCK_WINDOW_CURSOR）已回写
      design.md

## 1. openharmony-ability（rebase + 移植）

- [x] 1.1 `git rebase upstream/ohdev`（ohdev 分支，5 local commits 重放）；
      冲突按 D4：ArkHelper.ets 弃上游（DELETE/MODIFY 取删）；window/mod.rs 取本地
      + 并入 cursor grab FFI（`CursorLockApi`/`set_cursor_grab(real_window_id, grab)`
      /`CursorGrabError`）；app.rs 并入 `notify_window_status` +
      `drain_pending_window_status` + `PENDING_WINDOW_STATUS`（仿 notify_window_close
      模式）；native_ability/module.json5 **仅加 `LOCK_WINDOW_CURSOR`**（与上游一致，
      审计 W4；WINDOW_TOPMOST 只进 tauri cli 模板 + gen/ohos）
- [x] 1.2 ② 类 7 action 落地：WindowPlugin.ets 加 `set-topmost`/`set-title`/
      `set-limits`/`request-user-attention`/`set-ime-position`/`set-draggable`/
      `get-real-window-id`（interface 字段全 camelCase；静态 import
      notificationManager/inputMethod；notif id 计数器；API14/11/20/22 门控）；
      plugin-window `WindowClient` 加对应 async 方法；`set-ime-position` 直接
      await updateCursor 返回结果（D3.8，不实现 poll）
- [x] 1.3 ③ 类 ArkTS 修复迁移：WindowManager `showWindowMethod` 主窗口 `restore()` +
      `hideWindow` 统一 `minimize()` + `getDecorationFlag` 拦截（minimize/maximize/
      destroy + createSubWindow 初始化 flags）+ `setPointerStyle` 真实 ID + console
      降级（以上 rebase 自动落地）；WindowPlugin `show` action 改委托
      `showWindowMethod`（主窗口 minimize 后 restore 而非 no-op showWindow）；
      FloatPage 装饰 + `isMaximized` + startMoving API14 守卫 + windowStatusChange
      seed（rebase 自动落地）；DefaultWebview naturalLayout（d530828 手工移植：
      natural webview 保持 100% + set_bounds 剥离 w/h，子 webview 恢复显式 bounds）；
      NativeAbility windowStatusChange 注册（rebase 自动落地）
- [x] 1.4 cargo check 双侧 0 error 0 warning（host + aarch64-unknown-linux-ohos）
- [x] 1.5 本地 commit 997bbbc（英文规范 message，不 push）

## 2. tao（rebase + 移植）

- [x] 2.1 `git rebase upstream/ohdev`（ohdev-adjust，3 local commits 重放完成：
      73212e1e window ops/facade、f45745e5 WindowId per-window 路由、9ea6235f
      unit tests，commit 2/3 无冲突自动重放）；逐函数择优落地：架构取本地
      facade；`apply_window_status` + `WindowStatus` enum（**偏差 a**：镜像位
      保留不删——facade 无同步系统查询，maximized/minimized 改事件回灌，
      FullScreen/Maximize/Minimize/Floating 四态全回灌 visible/fullscreen/
      maximized/minimized，SplitScreen 不动 maximized）、theme global override
      （保留 set_color_mode bridge）、4×AtomicU32 min/max 缓存、FLAG 拦截
      （set_minimized/set_maximized/set_inner_size）、`set_title`/
      `set_always_on_top`/`set_ime_position`/`request_user_attention`/
      `drag_resize_window`/`set_min/max_inner_size` facade 实现；platform/
      ohos.rs `apply_window_status` trait 方法；孤儿冲突标记清理 + CursorGrabError
      未用 import 删除
- [x] 2.2 `set_cursor_grab` 两段式（D3.7）完成：API<22 同步 Err(NotSupported)
      → spawn 内 `get_real_window_id` bridge → FFI `set_cursor_grab(real_id)`；
      `set_window_status` 事件接线由 apply_window_status 回灌承接
- [x] 2.3 D2 混合策略落地完成：`window_kind` 复用（explicit builder → 首窗
      UIAbility → 后续 Float 三级推导，禁 id 近似）；`inner_position` decor_height
      补偿（per-window window_rect_for）；`set_inner_size` FLAG_RESIZABLE 拦截 +
      decor_height（Float→0，width 不补偿，per-window rect）；`inner_size` 补
      getter 侧补偿 inner=outer−decor（clamp ≥0）——此前返回裸 outer 致
      save→restore 每轮长高一个标题栏，D2 幂等闭环补全（a06d44c1）
- [x] 2.4 cargo check OHOS target + host 双侧 0 error 0 warning；本地 commit
      a06d44c1（不 push）。oha 侧补第 9 个 commit 0696dc0：`set-cursor-icon`/
      `set-decoration-flags` 两 action（**偏差 b**：9 action 而非 7——tao
      set_cursor_icon 热路径 + upstream FLAG 特性需要）

## 3. tauri（rebase + 接线）

- [x] 3.0 前置（审计 W1）完成：tracked WIP stash（stash@{1} "upstream
      non-conflict subset"，rebase 后 diff 校验全被覆盖/超集化，无需恢复）；
      散落 untracked 副本处理——doc/ohos-window-*-buttons.md 与 openspec
      cursor-grab 系列均与 upstream 逐字节一致（旧 merge 尝试残留），直接删除
      由 rebase checkout 带回；stats-union 分支保留未动
- [x] 3.1 rebase 完成：11 local commits 全部重放（commit 1 = 812db8d→2038640
      7 文件冲突手工解，commits 2-10 自动，commit 11 = 4edb8f7 SKILL.md 2 处
      冲突取本地新描述）；runtime-wry status drain 块随 rebase 带回（真实
      windowId 路由 + unmatched G6 warn）；with_bounds OHOS 排除（e4930fc）
      随 rebase 落地；tao 侧补 `drain_pending_window_status` re-export
      （fa5443cd）
- [x] 3.2 examples/api 并集完成：cmd.rs 冲突取并集（upstream IME/UIAbility
      命令 + 本地 create_ohos_test_webview）；`set_ime_position_test` 改
      facade await 版（D3.8：async 命令直取 WindowClient::set_ime_position
      结果存 static，`get_ime_position_result` 读 static，保留前端回读契约，
      删已不存在的 ArkHelper poll）；build.rs/Cargo.toml/run-app.json 并集
      （plugin-window 依赖补入 ohos deps）；invoke_handler 命令注册表
      核对无丢失；run-app.json auto-merge 重复项去重（85904d9）
- [x] 3.3 TestRunner.svelte 并集完成：5 处冲突全取 upstream（window-ops
      手动按钮区 + IME/UIAbility 用例），本地 driver/fault-injection 测试面
      经 auto-merge 保留共存；import 取超集；pnpm build 验证通过
- [x] 3.4 cli 模板两个 module.json5 取并集（WINDOW_TOPMOST + LOCK_WINDOW_
      CURSOR + PRINT 三权限共存）；gen/ohos 两个 module.json5 手动同步
      （补 WINDOW_TOPMOST + LOCK_WINDOW_CURSOR）；skills/docs 本地为超集
      （ohos-build SKILL.md 冲突取本地 cargo tauri ohos run 新流程描述）
- [x] 3.5 pnpm install 无 lock 变化（auto-merge 已一致）；cargo check
      examples/api 双 target（host + aarch64-unknown-linux-ohos）0 error；
      前端 vite build 通过；本地 commit 85904d9（不 push）

## 4. 构建与真机验证（D5）

- [x] 4.1 pack.bat（cmd.exe 显式调用）重建 HAR + 校验 package 镜像含新 action
      （run-tests.sh Step 0 自动重建；package 镜像 + ability.har 均验证含
      NativeAbility windowId→0 修复与 9 action）
- [x] 4.2 run-tests.sh 全量套件：**282✅/1❌(#87)/1⏭️(#272) 与基线持平**；
      window-state #46 save/restore round-trip + #95 filename+save+restore 均
      绿；修复两处 rebase 落地问题——NativeAbility.ets windowId 编译错
      （偏差 f，oha ba2bc0e）+ maximize 断言按 D2 校正（tauri a3ba6a6，
      innerSize 3120×1809 = outer−271 装饰是新语义非回归）
- [ ] 4.3 手动用例：cursor grab（API22+ 真机）、Set Min+Max、Set Title、always on
      top、IME position（聚焦 input）、window state save→restore **两轮**（D2 幂等
      验证：两轮后 inner_size 不变）
      2026-08-27 已验证：cursorPosition() 非零（链路修复）、Toggle Decorations
      (main window)（补按钮）、BG color 四按钮（双层分发+页面透明化修复）；剩余
      cursor grab/Set Min+Max/Set Title/always on top/IME/window-state 两轮。
      2026-08-27 定性+修复：Toggle Fullscreen 双层根因（① WindowPlugin
      set-fullscreen 被 pluginize 迁移降级为纯手机路径，桌面视觉 no-op → 改委托
      WindowManager.setFullscreen 双路径；② tao fullscreen() rebase 取本地旧版恒
      None → isFullscreen 恒 false 只进不退 → 对齐 upstream 读镜像位），修复部署
      待真机验证；多 UIAbility 两按钮 + setCursorVisible 确认为偏差 c deferred
      gap 非回归。回归 282✅/1❌(#87 已知)/1⏭️(#272) 与基线持平（plugin-store
      dist-js 0 字节截断重建修复）
- [x] 4.4 faultlog 零新增（2026-08-26 两轮全量跑后 faultlogger 目录无新
      appfreeze/jscrash，最新条目停留在 2026-08-25 20:16）
- [x] 4.5 主窗口逐轮缩小根因修复（用户报告，D2-r）：WM rect 与 surface rect
      异步更新 → 实时差垃圾 decor（824/770/292 vs 真值 146）→ save/restore 复利
      缩小。两层修复：层1 surface 事件锁存 decor（oha 7f48f07）；层2 事件驱动
      per-window watcher 自校正（tao 88f3509e，替代 15s 轮询版）。审计子agent
      复核无 P0，P1×2（no-op resize 哨兵 + 有界 Recheck）已修；真机 4 轮重启
      （含清缓存冷启动）幂等 2090×1394/inner 1248，套件基线持平；残余：罕见
      冷启动竞态的校正触发日志未取得（restore 时 decor 均已先收敛），触发条件
      与派发数学已由轮询版 16:22 轮实证等价

## 5. 收尾

- [ ] 5.1 openspec change 归档（proposal/design/tasks + 验证结果）
- [ ] 5.2 三仓本地 commit 状态确认（全部 clean，不 push）
