# Implementation Tasks — multi-uiability-windows

按 design.md 六阶段交付。每阶段真机验证通过才进下一阶段；291 例套件每阶段抽跑、Phase 6 全量。
ArkTS 改动后一律删 oh_modules + CompileArkTS 缓存重建（R6）。
**测试用例矩阵已定稿 → [test-plan.md](./test-plan.md)**：分阶段用例×判据×证据形态 +
观测 runbook + 盲区/OQ 映射；实现完成后按 Phase 直接开测。7.3 的 manual_tests
章从其 §2 提炼。

## 0. 前置考古（已由调研/审计完成，实现前可复查）

- [x] 0.1 tao 旧 multiton：`git show 58ad4377`（tao 仓）
- [x] 0.2 已删 Rust start_ui_ability：openharmony-ability `git log --all -S "start_ui_ability"`
- [x] 0.3 upstream readWindowId 语义：upstream-ohdev-rebase-window-ops/design.md 偏差 f
- [x] 0.4 单例全景 S1-S46 分诊（design.md §5 D14）

## 1. Phase 1 — 纯 ArkTS 验证（零 Rust）

- [x] 1.1 examples/api gen `entry_desktop/src/main/module.json5` launchType → `"standard"`（仅 gen，不动模板）
- [x] 1.2 `NativeAbility.ets` onCreate 临时 hilog 读 `want.parameters.tauri_window_id`
- [x] 1.3 构建部署（SODIUM_LIB_DIR 配方）+ `aa start --ps tauri_window_id 1` 起第二实例
- [x] 1.4 判据：任务卡片双实例；hilog 收到 id；Rust `register_ui_ability_stage: id=1`；
      **prepare() 是否抛 already-belongs**（D12 join 可行性实证）；tray 点击无重复 spawn；E13 时序观测
- [ ] 1.5 mobile 形态重复 1.3-1.4（OQ1；允许结论=mobile 维持 singleton）——无 mobile 设备在线，待 Mate 70
- [x] 1.6 还原 1.1-1.2 临时改动（保留验证记录）

### Phase 1 验证记录（2026-09-14，HAD-W32 desktop，pid 49832 单进程）

| 用例 | 结果 | 证据（hilog / aa dump） |
|---|---|---|
| P1-1 双实例 | ✅ | Mission #1119 + #1121 同 FOREGROUND，同 pid（单进程多实例，NG4 前提成立） |
| P1-2 id 送达 | ✅ | `[P1] onCreate: tauri_window_id=1 (raw="1")`——want.parameters 四键链路通 |
| P1-3 prepare 独占 | ✅ **抛** | `Native module 'api_lib' already belongs to active Ability session 'bridge-1789356939233-1'`——D12 join 必要性真机实证；第二实例白屏（无 bridge session）符合预期 |
| Rust id=1 回报 | ✅ | `register_ui_ability_stage: id=1`（tauritest tag）；id=0/id=1 stage 注册无串台（HC-10 镜像生效） |
| P1-4 重复 spawn | ✅ R4 实锤 | 自定位 startAbility（同形 want，无 --ps）→ 第 3 任务卡片 + 第 3 次 onCreate |
| 死锁 | ✅ 零 | THREAD_BLOCK_3S 全程 0 次 |
| E13 时序 | ✅ 干净 | 第二实例 onCreate→stage 注册间隔 6ms，无 await 竞态表现 |

**新发现（设计外，加重 D4 必要性）**：无参自定位 spawn 的重复实例 `tauri_window_id` 缺省为 0，
`registerUIAbilityStage(0)` **覆盖主实例在 uiAbilityStages 的条目**（第三实例 `UIAbility stage
registered: id=0` 实测）——R4 从"重复实例"升级为"重复实例+主实例注册表腐蚀"。已回写 design.md R4。

另：菜单「窗口→还原所有窗口」经 uinput 点击未触发可见 spawn（菜单点击注册表键控/焦点路由噪音，
Phase 5 D4 落地时复验）；spawn 机制已由同形 want 的 aa start 直接实证，不影响 P1-4 结论。

## 2. Phase 2 — Rust 握手 + tao guard（D7/D1/D2/D10）

- [x] 2.1 `window/mod.rs`：`PENDING_UI_ABILITIES` 注册表 + `register_pending_ui_ability` +
      `is_ui_ability_stage_ready` + `set_ui_ability_waker`；扩展现有 `register_ui_ability_stage` 完成握手
      （含补接 ArkTS 回报端：`WindowManager.registerUIAbilityStage` 调 NAPI
      `registerUiAbilityStage(wid)`——旧调用点随 ArkHelper.ets 删除成死导出，D7 链最后一环）
- [x] 2.2 app-control bridge 加 `start-ui-ability` action（ArkTS `setTimeout(0)` 逃 NAPI 重入；
      want.parameters 四键）；Rust `start_ui_ability(app, label, url, transparent) -> i64`（D1；
      落点偏差见 design.md D1 落地偏差注：facade 在 plugin-app-control 自由 async fn，
      编排在 tao `Window::new`，worker 侧 `call_sync_from_worker`）
- [x] 2.3 tao：删 `UIABILITY_CREATED`，加 `FIRST_WINDOW_CREATED` 闩锁；第二 UIAbility 走
      `start_ui_ability` 预分配 id（D2；顺带 decorations 块硬编码 0 参数化防误伤主窗）
- [x] 2.4 `app.rs`：HAS_EVENT → per-app `event_loop_installed`（带 error log）；`waker.rs` WAKER →
      `OpenHarmonyApp.waker` 实例字段实时读（D10；`notify_window_close` 无 app 句柄，经
      waker.rs 进程级别名槽 `wake_installed_app` 唤醒——NG4 单 app 下与实例槽恒等）
- [x] 2.5 tray-icon `OHOS_APP.set().expect()` → `is_err()`+warn（D14 防炸）
- [x] 2.6 双平台 cargo check 0 error（OHOS：ability workspace+app-control tests/tao/tray-icon+muda
      全 exit 0；Windows host：tao/tray-icon exit 0）
- [x] 2.7 真机判据：`create_ui_ability_window`（cmd.rs:923）起窗；window_id>0；新窗 WindowResize
      带对 id；主窗功能无损；hilog 无 THREAD_BLOCK_3S；291 例抽跑无回归
      （gen entry_desktop launchType 已临时 standard，Phase 5 任务 5.2 做模板/gen 双写）
      （2026-09-14 HAD-W32 实测全过：起窗✓ id=1✓ THROTTLE-IN wid=1 size/rect✓；
      自动测试 296 passed/2 skipped/0 failed——第二实例全程存活跑完（stage unregistered id=1
      于 15:08:40 干净销毁），无回归；18475 行 hilog 零 THREAD_BLOCK 零 panic。注：uinput
      注入点击曾误中侧栏链接致上轮"静默失败"假象，本轮人工点击 32ms 完成全链）

## 3. Phase 3 — 会话与生命周期隔离（D6/D12/D8/D9）

- [x] 3.1 `NativeAbility.ets`：`abilityWindowId`（want.parameters）+ registerUIAbilityStage/
      unregisterUIAbilityStage/notifyWindowStatus/setMenuClickHandler/setMenuBarRecoverFn 参数化（D3）
      （销毁侧证据：hilog `WindowManager: UIAbility stage unregistered: id=1`）
- [x] 3.2 `loadContentByName` 传 LocalStorage{windowId, bridgeSessionId, initialWantUri, wantUri}；
      `DefaultXComponent` bridgeSessionId → `@LocalStorageProp`；删 onDestroy 清空（D6/D9）
- [x] 3.3 `BridgeHostRegistry.prepare()` already-belongs 抛异常 → join 语义（返回既有 session；
      改写 LocalUnit.test.ets:530 断言）（D12.1-2）
- [x] 3.4 `render_owner` 单占用改造（OQ3 二选一：HashMap by window_id / 多 root 挂载）（D12.3）
      （落定：多 root 挂载——getComponentRoot found→deferring→mounted to subRoot，不动 render_owner）
- [x] 3.5 `bridge/mod.rs`：`sessions: HashMap<i64, AbilitySessionState>` + 事件变体加 window_id +
      dispatch_lifecycle 按 session（D8）
- [x] 3.6 Rust `INITIAL_WANT_URI`/`WANT_PARAMETERS` → per-windowId map（D9）
      （2026-09-14 补修：deep-link `get_current_for_window` 原回退读进程级 `current` 缓存——OHOS 上该
      缓存唯一活性写入点是主窗自己的 lazy-take（无 OHOS 生产者发 RunEvent::Opened），主窗先读后
      spawned 窗读会拿到主窗 URI（P3-3 串台）。改为插件内 OHOS-only per-window memo
      `ohos_window_current: HashMap<i64, Vec<Url>>`，shared `current` 不再被 per-window 路径触碰；
      双 target cargo check 0 error）
- [x] 3.7 真机判据：双实例 bridge 调用互不串台；session_active 独立；deep-link getCurrent() 各自
      正确；WAKER 唤醒对实例；E1 并发建窗竞态专项
      （2026-09-14 HAD-W32 六判据全过：
      P3-1 join 后 dummy_command/window op 响应各归各✓；P3-2 spawned 销毁链
      onWillBackground→…→onDestroy+stage unregistered id=N，主窗存活✓；P3-3 deep-link 差异化
      取证✓——冷启动 `-U taurideeplink://p3primary` 后主窗 getCurrent 得
      `["taurideeplink://p3primary"]`（UI 消息区+hilog lazy-take id=0 双证），主窗先读 15s 后
      spawned 窗探针 3 轮全部 `deep_link=null`+`lazy-take id=1 returned: ""`（串台序位实测无
      串台，per-window memo 修复后）；P3-4 spawned 拖拽/缩放 154 rect+88 size 事件全部 wid=1、
      wid=0 零条✓；P3-5 5 实例并发（+transparent=6）id 各异无死锁 THREAD_BLOCK=0✓；P3-6 双窗
      渲染互不覆盖（截图）✓。探针教训：raw fetch tauri://localhost/ 拿到 index.html 资产非 IPC，
      必须 __TAURI_INTERNALS__.invoke）
      （收尾验证 2026-09-14 晚：openharmony-ability 设备 UT 79 passed/0 failed（08-22 基线 40→79）；
      291 例回归 296 passed/0 failed/2 skipped（#70 transparent UIAbility/#284 createUIAbilityWindow/
      #118-121 deep-link 四用例全过）；探针与 per-window memo 修复随包复测无回归）

## 4. Phase 4 — 输入路由（D5）

- [x] 4.1 `render/xcomponent.rs` `render()` 加 window_id 参数，onTouch/onKey/onMouse/onAxis 闭包
      写入事件结构体 `window_id` 字段；DefaultXComponent 传入
      （2026-09-14 完成：Event 枚举 5 变体改窗位形态——`Input { window_id, input }`/
      `WindowRedraw { window_id, info }`/`GainedFocus { window_id }`/`LostFocus { window_id }`/
      `WindowDestroy { window_id }`；xcomponent.rs render() 签名+touch/key/mouse/redraw/resize 闭包
      全带 id；ime.rs ime_ts_fn 四闭包带 id；lifecycle.rs 重构门控——Active/Inactive 按窗分发不再
      ==0 门、Shown/Hidden/Resumed/Paused 保持 ==0（映射 app 级事件）、on_window_stage_destroy
      拆 ==0 门改无条件带 id 分发；derive/lib.rs 生成 render 加 window_id 参数；
      DefaultXComponent.ets 主路径 nativeModule.render(slot, owner, this.windowId)（spawned
      UIAbility 模式 113-120 早退不调 render，见 OQ3）；type.ets Module.render 三参。注：onAxis
      闭包不存在——AxisEventData 运行时无生产者（ohos-xcomponent-binding 0.3.2 无 axis 回调，
      mouse_event.rs:180 注释过时），variant 级 window_id 字段已统一覆盖。openharmony-ability
      全 workspace OHOS check EXIT=0）
- [x] 4.2 tao mod.rs 14 处 `WindowId(0)` → `WindowId(event.window_id)`（648 ConfigChanged 保留 0）
      （2026-09-14 完成：203 Touch/274 Key/4×IME/388 Mouse/466 Axis/596 Redraw/624 GainedFocus/
      636 LostFocus/697 CloseRequested/703 Destroyed 共 14 处全参数化；handle_input_event/
      handle_mouse_event/handle_axis_event 三 wrapper 加 window_id 参数；648 ConfigChanged 保留
      WindowId(0)（R10 app 级）；DeviceId(0) 站位不动（S6 分诊）；HAS_FOCUS 保持单一 app 级
      AtomicBool（mod.rs:1923 读点未动）。配套：30 处旧测试调用点批量补参+新增
      input_events_dispatch_with_originating_window_id 路由测试（id 7/7/3 三事件断言）。
      验证：tao OHOS lib/--tests/host 三 check EXIT=0；HAD-W32 设备 UT 71 passed/0 failed
      （input_tests 21/21 含新路由测试）；中途修复 handle_input_event 内部 249/252 两处转发漏参）
- [x] 4.3 真机判据：A/B 窗点击各达各的 handler；IME 跟焦点窗；Float 子窗照常（ArkWeb 内部消费）；
      291 例抽跑
      （2026-09-15 HAD-W32 全过。A/B 焦点往返 3 组 FOCUS/BLUR 无幻影（09:12:09.585 子窗 BLUR+main
      FOCUS / 09:12:12.494 反向 / 09:19:45.339 main FOCUS+子窗 BLUR），deep-link 探针子窗自解析
      window_id=1；点击路由：[spawned-page] click #15~#22 全落子窗 webview，主窗零串扰；IME 差分：
      焦点在子窗时软键盘/uinput 注入全进子窗（ime input "h ihi"），焦点回主窗后子窗零事件、主窗输入
      框出 "ab"（截图双证）；Float smoke：Decorated Float STATUS_SCRIPT 500ms isDecorated 轮询
      （invoke+evaluate-script 回投）自建窗起 15min 不间断，✕ Close 点击→CloseRequested→
      ohos.window/destroy-window→Destroyed→焦点回流 main（FOCUS label=main，第 4 个正确路由事件）；
      套件 298 例 296✅+2⏭️+0❌（#270 clipboard READ_PASTEBOARD 平台限制、#275 HAD-W32 无马达，
      均已知非回归）。证据：hilog-p4c.log / p4-report.md）

## 5. Phase 5 — launchType 迁移（D4 + D4b）

- [x] 5.1 menu.ets:73 / StatusBarUtils.ets:40 / AppControlPlugin.ets:181 → `showWindowMethod(0)`
      （2026-09-15 完成：三调用点全迁——menu.ets showAbility / StatusBarUtils.ets iconClickHandler /
      AppControlPlugin.ets show-ability action（restart=进程级 relaunch 与 start-ui-ability=多窗
      spawn 两路径不动）；menu/StatusBarUtils 的 Want import 已删，AppControlPlugin 保留
      （restart/start-ui-ability 仍用）+ WindowManager 入 @ohos-rs/ability import（barrel
      index.ets:32）；showWindowMethod 主窗 raise 分支已补——可见窗 showWindow() 置顶不触发
      restore() 反最大化（PR#45 F3/D），最小化窗仍走 restoreWindow）
      （**2026-09-15 二次修订回退**：真机回归——托盘 Hide（context.hideAbility() ability 级
      后台化）后 ShowAll/图标点击无法回前台（splash 闪一下即灭），窗口级 showWindowMethod
      撤销不了 ability 级隐藏；specified + onAcceptWant 落地后三调用点恢复 startAbility(self)
      （AMS 拉回栈顶原语），见 5.2b）
- [x] 5.1b plain-relaunch 单实例式守护（D4b，2026-09-15 定案）：裸 want（无 tauri_window_id）且
      stage 0 已注册 → ① 禁止覆盖 uiAbilityStages[0]（腐蚀点 WindowManager.ets:202 盲 set，R4
      真机实证）② showWindowMethod(0) 置前主窗 ③ want URI 转发至主实例分区（深链运行中点击
      不回归）④ 新实例 terminateSelf；带 tauri_window_id 的 want 照常开新窗
      （2026-09-15 完成：NativeAbility.ets onCreate 守护在 id 解析后/AppStorage 写入前——
      forEachLifecycle→onAbilityCreateWithWant({uri,isContinuation,parametersJson},0) 仅写
      INITIAL_WANT_URI[0]（Rust 侧不开 session 分区）+ showWindowMethod(0) + terminateSelf
      异步；terminateSelf 异步故四个后续回调全门控 isDuplicatePrimary——onWindowStageCreate/
      Destroy/onNewWant 跳过、onDestroy 跳过 onAbilityDestroy(0)（否则触发主实例退出链自杀）；
      防御纵深=WindowManager.registerUIAbilityStage 拒绝同 id 不同 context 的重注册（REFUSED
      日志），同 context 温重建放行）
- [x] 5.2 tauri-cli 模板分形态（2026-09-15 定案）：entry_desktop → `"standard"`；entry_mobile
      维持 `"singleton"`（OQ1 结论位）；examples/api 两 gen 目录照写 `"standard"`（验证载体）
      （HC-4 模板/gen 双写）
      （2026-09-15 完成：模板 entry_desktop/src/main/module.json5:21 singleton→standard；
      entry_mobile 模板:21 维持 singleton；examples/api gen entry_desktop:13=standard（Phase 1
      已改）、gen entry_mobile:9=singleton——四文件实核）
      （**2026-09-15 二次修订**：entry_desktop 改 `"specified"` + 模块级 srcEntry → 新增
      AbilityStage，见 5.2b）
- [x] 5.2b specified + onAcceptWant 实例路由（2026-09-15 二次修订，修 hide 后无法回前台回归）：
      模板+gen 双写——entry_desktop launchType `standard`→`specified` + 模块级
      `"srcEntry": "./ets/abilitystage/EntryAbilityStage.ets"` + 新增该文件（onAcceptWant：
      带 tauri_window_id → `tauri-window-${id}` 新实例；裸 want → `tauri-primary` 复用主实例
      拉回栈顶+onNewWant，API 9+ 官方语义）；HAR 三调用点回退 startAbility(self)（5.1 注）；
      D4b 降级纵深防御；design.md D4 已修订。
      真机证据（hilog-p5b.log, 2026-09-15 15:09-15:32）：AMS `AddSpecifiedRequest`/`launchType:2`；
      路由矩阵 5 项全过——裸 want 冷启 → onCreate windowId=0；裸 want 热 → 同 pid onNewWant
      复用；id=3/4 → 各自新实例+独立注册（多实例支持实证，同进程多 UIAbility 实例）；
      id=3 重复 → onNewWant 复用（同 key 去重）；深链 URI → 主实例 onNewWant 收 uri。
      附注：AppKit 启动时报 `onAcceptWantAsync unimplemented` 属运行时先探异步变体的噪音，
      同步 onAcceptWant 正常生效
- [x] 5.3 HAR 重建（删 oh_modules + CompileArkTS 缓存）（2026-09-15 14:37 pack.bat + package
      同步校验三文件 + entry_desktop oh_modules/build 全清 + `ohos build --device-type desktop`
      注意：默认 device-type=mobile 只出 entry_mobile）
- [x] 5.4 真机判据（specified 修订后）：hide（hideAbility）→ ShowAll/图标点击回前台**无闪现**；
      托盘菜单点击无重复实例 splash；裸 want relaunch 走主实例 onNewWant（无新 onCreate、
      stage 0 无腐蚀）；深链 relaunch URI 主窗可收（onNewWant 路径）；create_ui_ability_window
      起新实例（多窗不变）；restart（restartApp）/terminateSelf 复验；套件回归。
      **全过（2026-09-15 HAD-W32）**：ShowAll → onNewWant×2 → `GoForeground: reason:4` 零新实例
      （用户肉眼确认无闪现）；系统托盘面板 startAbility 全部路由主实例；手动
      createUIAbilityWindow/createTransparentUIAbility 按钮起 windowId=1/2 实例成功；spawned
      实例 X 销毁 + 主窗 X → onWindowStageDestroy→onDestroy→进程干净退出（terminateSelf 同族
      退出链）；冷启动路由两次实证（install 后 + 重开 pid 18304）；套件 **296✅/0❌/2⏭️ 与基线
      持平**（app 内 report 为准，hilog console 计数 273 系 socket 丢行）。restartApp 未直测，
      组合定性：进程级 kill 与 launchType 无关（09-07 singleton 下全链实证）+ 冷启动 specified
      路由已实证；无 demo 构建入口，不为复验重建 VITE_PROCESS_TESTS 构建。
      遗留观察（非回归，OQ6 范畴）：hide/ShowAll 仅作用于主实例（hideAbility 为 ability 级），
      spawned 实例不受影响——旧 standard 下行为相同，跨实例 app 级 hide/restore 归 OQ6/Phase 6

## 6. Phase 6 — 全量回归与残留（D13 + E 盲区）

- [x] 6.1 D13 销毁清理：unregister 链 + Rust map 清理；反复建/销第二实例 10 轮无残留（E4）
      **全过（2026-09-15 HAD-W32）**：统一钩子 `unregister_ui_ability_state` 落地（lifecycle.rs
      on_ability_destroy 后置调用；PENDING/want-URI/want-params/label/rects 五表一次清）+
      ArkTS unregisterUIAbilityStage/removeWindow 扩展（blur/callbacks/focus/key_synthesis/
      clipboard/zoom）+ A5 deep-link 每窗 memo（Destroyed 事件 + id≠0 守卫）+ B2 windowKinds
      显式 Float。E4 判据：探针 10 轮（id=101-110，含 0.7-1.7s 快销轮）+ 真实派生 2 轮
      （按钮路径 id=1 常规 / id=2 即建即关 1.2s=A10 stranded-future 观察），十二轮销毁链六行
      证据齐发（on_window_close→memo removed→Destroyed→stage unregistered→bridge partitions→
      unregister_ui_ability_state），读数全部一致回落基线 stages=1 sessions=1 history=1
      pending=0 want_params=0 want_uris=1；THREAD_BLOCK_3S=0；进程全程存活；
      `WMSLife listener nullptr` 为既有每窗销毁框架噪音（12 次=销毁总数，非回归）。
      B3（spawned 实例内建 Float 的 createSubWindow stage 参数化）无 tasks 项且涉 OQ2
      平台可行性，已于 2026-09-16 零代码实验定案（见 6.3：可行 + child 级联销毁语义，
      生产保持挂 primary）
- [ ] 6.2 291 例套件全量（基线 290/291）+ 手动套件
      **自动部分全过（2026-09-15 HAD-W32，18:18 Run All 真机全量）**：判据以 app 沙箱
      report 文件为准（cmd.rs append_test_result 逐行落盘，无 socket 丢行）——
      `/data/storage/el2/base/cache/test-report.md`（实机路径 /data/app/el2/100/base/
      com.tauri.api/cache/），已拉取存证 examples/api/p6-report.md：**pass=296 fail=0
      skip=2 other=0**，footer 落盘（套件完整跑完，末例 #298 stronghold vault），
      与 Phase 6 改造前基线完全持平（零回归）。2 例 skip 均为已知平台限制：#270 剪贴板
      writeHtml/readText（READ_PASTEBOARD 受限）、#275 haptics（HAD-W32 无振动马达）。
      THREAD_BLOCK_3S=0 全程；进程 43330 存活至跑完；hilog console 交叉核对 271/0/2
      （socket 丢行已知，report 为准）。跑后残留 7 个测试子窗 + api1/api2 系 core.ts
      有意设计（autotest 内关闭会留幽灵窗）；清场 = force-stop + 重启单窗净态。
      副观察（供 6.5/E2 参考）：点测试窗标题栏按钮区触发**app 级最小化**（同 app 全部
      窗口一齐隐藏，hidumper 仍列 10 窗，bare want 可唤醒）。**（6.5 修正：此观察系套件
      残留窗特例——6.5 单实例配对实测系统标题栏最小化为每窗 session 级
      （setVisibilityMinimizeSession persistentId 单窗），主窗/第二实例窗对称，仅隐藏
      被点窗自身；6.2 当晚为多残留窗叠加态，误读为按 app 聚合。）****手动套件：用户当晚亲验（约定），结果未回填前本项
      不勾**。
- [x] 6.3 Float 专项（D11 按 windowKinds 分支的 5 方法：closeWindow/setDecorations/
      setWindowBackgroundColor/showWindowMethod/setDecorationFlags）
      **全过（2026-09-16 HAD-W32）**。生产入口审计：show→showWindowMethod（Float 分支
      win.showWindow）、set-decoration-flags→setDecorationFlags（Float 分支写 LocalStorage
      4 键驱动 FloatPage 按钮显隐）、set-background-color→子窗句柄直调（两 kind 同 API
      无分支语义）、closeWindow→仅菜单路径可达（Float 无菜单，分支为防御性代码，代码
      审计定案不自动化）。**setDecorations 发现真 bug**：plugin "set-decorations" 旁路
      直调 win.setWindowDecorVisible（pluginize 迁移期只实现了 UIAbility 半边），而 Float
      子窗 decorEnabled:false 系统装饰恒关 → Float 上静默 no-op、FloatPage 自绘标题栏
      永不响应；修复 = 委托 WindowManager.setDecorations（Float 分支写 LocalStorage
      'decorations'，与 set-fullscreen/set-blur 委托先例同式），openharmony-ability
      plugins/window/WindowPlugin.ets。新增自动用例 `window Float kind-branch ops`（
      window-ops.ts #293：decorated Float 起点→setDecorations 假/真镜像读回→4 flag
      假/真读回→minimize 真实 isMinimized 断言（读 ArkTS 活状态）→show 恢复→
      setBackgroundColor smoke→close）；套件 **297✅/0❌/2⏭（299 例，基线 296+1 新例
      零回归）**；hilog 证据：`Decorations set to false/true for Float window 13
      (LocalStorage)`（修复生效）、`showWindowMethod 13 OK`×2、setDecorationFlags
      主窗 no-op 8 次全 id=0（id=13 误路由 0 次）、close 真实销毁（`Removing window 13
      from all maps`——cmd.rs:736 "programmatic close 不销毁 Float" 注释已过时）。
      **B3/OQ2 零代码实验（同日）**：scratch 补丁 createSubWindow stage 选择改首个
      key>0（[B3-EXP] 标记），spawn 201 实例（aa start --ps tauri_window_id 201）后建
      Float——**四项定案**：① createSubWindowWithOptions 在非 primary stage 可运行
      （创建成功无抛错）；② FloatPage 正常渲染（标题栏+内容，截图 b3-2）；③ 输入正常
      （uinput 拖拽标题栏窗口随动，b3-3）；④ **级联销毁**：关 201 实例 → 三个 stage-201
      Float 全部 system close 陪葬（hilog 窗1/2/3 依次 Removing + stage unregistered，
      9ms 内完成，主实例 remaining stages=1 存活无恙）= child 语义（同 Windows
      WebviewWindowBuilder.parent owner 语义）。结论：**per-instance Float 技术可行**，
      生产保持 Float 挂 primary stage（个别实例销毁不连坐 Float）；OQ2 已可回填
      （feasible-but-not-implemented，天然 owner 语义适合未来 parent() API 载体）。
      scratch 已还原，决策点留注释存证（WindowManager.ets createSubWindow）；证据
      examples/api/hilog-b3.log + b3-*.jpeg。副产物：snapspawn 实验中目测"hello 窗
      移动/幸存"系 sceneboard 任务视图缩略图类陈旧帧（hidumper 全表无此窗），非 tauri
      行为；uinput X 定位以 dump 矩形为准（api1 [789,287] 右缘 2879），目测截图坐标
      不可靠。
- [ ] 6.4 desktop + mobile 双形态（OQ1 结论落文档）
- [x] 6.5 E2/E3 专项：第二实例最小化恢复、任务卡片切换焦点
      **全过（2026-09-16 HAD-W32，pid 16393）**。观测栈：hilog 过滤器（app 行 + 系统
      WMSFocus/sceneboard）+ hidumper Focus/ZOrd + JS focus-probe 三层交叉。设计路径建窗链
      完整：`register_pending_ui_ability: id=1`（12:32:38.525）→ `UIAbility stage
      registered: id=1`（.565）→ Window[297, api2] → `SetDrawMode 0, nweb_id = 2` →
      `OnFocus nweb_id = 2`。**E3a 点击焦点往返**：点主窗 → Id:294 + `OnFocus nweb_id=1`
      （11:51:18）；点第二实例窗 → Id:296 + `OnBlur nweb_id=1`（12:25:16）——白窗（裸
      aa start）照样吃焦点，两 leg NotifySessionFocused/webview OnFocus/OnBlur/hidumper
      Focus 三层一致。**E2 最小化/恢复**（第二实例窗系统标题栏最小化钮，12:34:47 与
      12:38:43 两轮）：`setVisibilityMinimizeSession persistentId: 297`（containerId: 63）+
      `windowNum:2->1 id:297`——**每窗最小化，主窗保持可见**；生命周期=windowStageEvent
      3(INACTIVE)+4(HIDDEN)+NotifySessionBackground，无 onWindowStageDestroy/onDestroy
      （webview 存活）。任务卡片恢复（12:36:31/12:38:46）：NotifySessionForeground →
      `WebDelegate::OnRenderToForeground`（scope 100002）→ windowStageEvent 1(SHOWN) →
      Id:297 → `OnFocus nweb_id = 2`，**不触发 onWindowStageRestore**（那是 stage 销毁
      温恢复路径）**也不触发 onNewWant**（活任务恢复绕过 onAcceptWant 路由，specified
      配方注意）；计数器跨最小化→恢复周期保持（counter=1 用户目验）——无重载无白屏。
      **E3b 任务卡片切换**（点主窗卡片，12:44:21）：`OnBlur nweb_id=2`/`OnFocus nweb_id=1`
      干净对 + 焦点翻转 + ZOrd 提升。**OQ6 对称性素材**（主窗最小化钮，12:45:49）：
      `InputKeyFlow wid:294 IsHitTitleBar` 实锤落点 → 焦点回落第二实例窗（Id:297 +
      JS 层 `[focus-probe] FOCUS label=test-uiability-*`/`BLUR label=main` 对 +
      自有 `Last focused window updated: id=1` 跟踪正确）→
      `setVisibilityMinimizeSession persistentId: 294`（containerId: 61）+
      `windowNum:2->1 id:294`——第二实例窗保持可见并接焦。**每窗最小化 primary/spawned
      对称**；6.2"minimize 按 app 聚合"观察系套件残留窗特例（修正，见 6.2 注）。
      **副发现（设计内语义，非 bug）**：裸 `aa start --ps tauri_window_id N` 绕过
      register_pending_ui_ability → ArkTS 壳 + stage 注册 + bridge session join（joined=true）
      齐全但无 pending 握手 → 不建 wry 窗口/webview → 空 XComponent 白窗（11:47:40 spawn
      全程零 nweb_id=2 链；✕ 关闭 12:31:29 stage unregistered id=201 链正常）。第二实例
      webview 只经设计路径（start_ui_ability / createUIAbilityWindow 按钮）产出，语义注记
      已回写 design.md D7。证据：openharmony-ability/hilog-e23b.log（11:47-12:45 全程）+
      examples/api/e23-*.jpeg/e23-dump*.txt（gitignore 覆盖，磁盘保留）。OQ6/E12 随本项
      定案（design.md §9 已回填）。
- [x] 6.6 ohpm 缓存净重建后全绿复验
      **（2026-09-16 HAD-W32 通过）**净重建：`rm -rf` gen/ohos 全部 11 模块 oh_modules +
      build 目录 + .hvigor → CLI 内部流程重建（cargo tauri ohos build --device-type desktop，
      cargo 全缓存 no-op；ohpm 全新解析 install completed 0s 406ms，新 har 内容哈希
      `@ohos-rs+ability@lcujuuntryk+…`；CompileArkTS 干净编译 10s 639ms；BUILD SUCCESSFUL
      29s 157ms；签名 HAP 20896777B @13:15）。安装后链路级复核：entry_desktop/oh_modules/
      @tauri/* 与 @ohos-rs/ability junction 由 CLI 内部 ohpm install 自动重建（13:15，指向
      .ohpm 新哈希目录）；已装 har 内容含 setDecorations 修复（WindowPlugin.ets 委托版）且
      无 B3-EXP scratch——设备跑的 ArkTS 与仓库当前源一致。净重建 HAP 安装冷启（pid 32652，
      裸 want→tauri-primary）后全量套件 **299 例 297✅/0❌/2⏭ 与基线完全持平**（skip 仍为
      #270 clipboard READ_PASTEBOARD 平台限制 + #275 HAD-W32 无马达，均已知）；footer 落盘
      （末例 #299 stronghold）= 完整跑完；THREAD_BLOCK_3S=0；pid 32652 存活到底。
      证据：examples/api/build-p66.log / hilog-p66.log / p66-report.md（gitignore 覆盖，
      磁盘保留）。R6 规则（ArkTS 改动后一律删 oh_modules+CompileArkTS 缓存重建）就此闭环实证。

## 7. 收尾

- [x] 7.1 design.md §10 四处设计文档同步（upstream-ohdev 偏差 c/f、p1-window-state D1、
      platform-limitations 已知限制）
      **（2026-09-16 完成）**① 偏差 c 加终态注记：专项已落地，guard 已由 D7 握手取代，
      launchType 终态 specified（非 standard），剩余延期仅 mobile 双形态+手动套件；② 偏差 f
      加 readWindowId 语义恢复注记（D3 abilityWindowId 参数化，字面量 0 修正被取代；NEXT_WINDOW_ID
      命名空间扩为 Float+UIAbility 实例共用）；③ p1-window-state D1 加 key 体系扩展注记
      （start_ui_ability 预分配 id 同取 NEXT_WINDOW_ID，per-window rect HashMap 键域零改动服务
      三类窗口）；④ platform-limitations spec 增 R-multiuiab-singleton 条目（NG2 cursor 全局单值 +
      NG7/S8 第二实例窗 raw_window_handle 缺失，双 Scenario；NG1 sub-UIAbility 键盘退化既有条目
      已覆盖）。
- [x] 7.2 tauri-ohos-api-support.md / dev-guide.md 窗口章节同步
      **（2026-09-16 完成，两文档同源同步）**§1.1/§2.1 窗口模型改三类窗口（主窗/Float 子窗/
      UIAbility 实例窗）+ specified+onAcceptWant 路由语义 + 实例窗行为契约（几何系统管理 1300002、
      WebviewUrl 经 wry 待队列、每窗 session 级最小化、关闭只清自身分区）+ 已知限制；§1.6/§2.6
      OHOSWindowKind 行更新（UIAbility=独立实例窗）；§9.3/§10.3 输入事件条目修正（主窗+实例窗）+
      实例窗 raw_window_handle 限制条目；§9.1/§10.1 套件数更新至 299 例 297✅/0❌/2⏭️（含
      Float kind-branch 新例与净重建复验）。
- [x] 7.3 manual_tests.md 增多 UIAbility 用例章
      **（2026-09-16 完成）**新增 §三十七（6 例=3 T0+3 T1：每窗最小化对称/任务卡片切换/IME
      双向差分/tray 恢复目标恒主实例/桌面图标二次拉起守护/Float 级联不连坐），原统计汇总顺延
      §三十八，合计 118 T0/106 T1/224（grep 实核）。同文件修正两处过时事实：§36.5 最小化
      "按 app 聚合"误读按 6.5 更正为每窗对称；§36.6 实例窗加载页 MainPage→hello.html（OQ5）。
- [x] 7.4 Open Questions OQ2-OQ6 结论回填
      **（2026-09-16 完成）**OQ2/OQ3/OQ4/OQ6 已定块此前已就位（6.3/6.5）；本轮补 OQ5 已定
      （url 可达，机制=wry 待队列投递 WebviewCreateRequest 非 want 参数，真机证据 spawned 渲染
      hello.html；cmd.rs 过时注释同步修正）+ OQ1 状态标注（随 6.4 延期，阻塞 Mate 70）；test-plan.md
      OQ5 降级条款加未触发注记。§9 六 OQ 全部有终态（5 定案+1 延期）。
