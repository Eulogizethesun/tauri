# design.md — ohos-main-window-close-zombie

## Context

现状代码状态(行号=ohdev 终链 tauri 3127de89a / tao 6968a6cc / ability 5942fc2,已逐点核对):

- **close 链执行器** `on_window_close_ohos`(crates/tauri-runtime-wry/src/lib.rs:5670-5744):无条件 `windows.0.borrow_mut().remove(&window_id)`(:5678)→ registry 摘除(:5687)→ `inner.close()` fire-and-forget(:5704)→ `WindowEvent::Destroyed` 无条件派发(:5710)→ all-closed 判定+ExitRequested 去重(exit_state)(:5717-5741),返回 true 但四个调用点全部 `let _` 丢弃(:5403/:5436/:5511/:5527),不设 `ControlFlow::Exit`。
- **tao `close()`**(src/platform_impl/ohos/window.rs:1878-1893):`spawn_or_queue` 异步 `client.destroy_window(window_id)`,Err 仅 `log::warn!`。主窗(id=0)必 throw(ability WindowPlugin.ets:1324-1326 守卫,平台语义正确)。
- **成熟终止链(既有,勿重建)**:`ControlFlow::Exit` → tao pending-exit(`window_target.p.exit`,event_loop.rs:1477)→ `Event::LoopDestroyed` 派发 + `app.terminate(env, 0)`(AppControlExt,MainThreadSync 桥调用,event_loop.rs:1487-1495)→ ArkTS `ctx.terminateSelf()`(AppControlPlugin.ets:187-193,graceful,含 appspawn/SIGABRT 勘误注释)。`Message::Exit` 臂(lib.rs:5497-5503)已实证此链(issue #100)。
- **主窗判别(既有)**:`ohos_main_window_registry: HashMap<WindowId, bool>`,insert 时 `is_ui_ability_main`(lib.rs:435-441),读侧 `ohos_is_ui_ability_main`(:447-455,未知 id 读 false=子窗)。#238 建立写入,#247 建立失败路径摘除。
- **事件回传通道(既有)**:tao 事件循环把 MainEvent 映射为 `Event::CloseRequested`/`Event::Destroyed` 等;tauri-runtime-wry `handle_event_loop` 的 Destroyed 臂(:5412-5443)对 OHOS 调 `on_window_close_ohos` 作安全网(幂等 remove)。
- **报告证据链**:报告 §4 时间线(destroy-window throw→ExitRequested 已发→假 Destroyed→34s 后按钮死亡);§3 五步复现判据;§7 未定位的第二触发路径(方案 1 理论免疫)。

技术约束(全局铁律):所有改动 `#[cfg(target_env = "ohos")]` 隔离,非 OHOS 路径零触碰;桥禁 recv_timeout(异步事件模式);ArkTS 侧不新增改动(方案 2 选 Rust 侧接线);tao 事件循环需 N-API env,host UT 无法构造完整执行器(#247 已证)。

## Goals & Non-Goals

**Goals**

1. 单主窗应用前端 close → 进程优雅退出(terminateSelf 经 #100 链),零僵尸:窗口关闭、进程退出、无假事件误导 app。
2. ExitRequested veto 语义保真:app prevent 后关闭取消,store/registry 记账完整,窗口命令继续可用。
3. 子窗 destroy 失败免疫:失败时记账保留(结构性消灭,非回滚补丁)——报告 §7 第二触发路径理论免疫。
4. `Destroyed` 只在真实销毁确认后派发(对齐 upstream "OS 驱动记账摘除"语义)。
5. 文档对齐:`doc/OHOS窗口遗留问题.md` 问题一证伪句修正+新问题收录。

**Non-Goals**

- 不改 openharmony-ability 仓(ArkTS id=0 throw 守卫保留;terminate 能力已存在)。
- 不改 upstream 非 OHOS close/destroy 路径(425101c15 已恢复的 verbatim 语义不动)。
- 不实现 destroy 结果的同步等待/回执超时(桥禁 recv_timeout;确认=事件,失败=沉默留账,见 Decisions D3)。
- 不处理多 UIAbility 形态(multi-uiability-windows change 另行)。
- 不为子窗补"销毁失败后的用户可见错误通知"(仅 log,记账完整即目标)。

## Decisions

### D1 主窗 close 语义 = ExitRequested 门 + #100 终止链(方案 2,Rust 侧接线 ②)

主窗(Registry `is_ui_ability_main==true`)close 未被 CloseRequested prevent 后,**不再派发 destroy**(id=0 必拒,现注释 :5692-5697 自述已知),改走:

```
ExitRequested 门(exit_state 去重):
  已 true → teardown in flight → 直接进入摘除+Destroyed+Exit(与 Message::Exit 幂等合流)
  未发过 → 派发 RunEvent::ExitRequested{code:None}:
    prevent → 关闭取消:log + return(记账零触碰,零僵尸,按钮仍可用)
    未 prevent → exit_state=true → 摘 store+registry → 派发 Destroyed(此刻 truthful:终止在途)
              → 设 ControlFlow::Exit → tao pending-exit → LoopDestroyed(RunEvent::Exit)→ terminate(env,0) → terminateSelf
```

- 备选 ①(ArkTS WindowPlugin.ets destroy-window id=0 → terminateSelf):否决——绕过 Rust 侧 ExitRequested veto(terminate 无条件发生);且把"窗口销毁"与"能力终止"两个语义糊在一个桥命令里,ArkTS 守卫的诚实性(主窗不可当 sub-window 销毁)被牺牲。
- 备选 ③(最小止血回滚):否决——报告自评只救后半场,假 Destroyed 已发,ExitRequested 已发,§7 路径不免疫。
- veto 语义:CloseRequested(第一次 veto)与 ExitRequested(第二次 veto)两级,与 upstream 桌面一致;OHOS 结构上"prevent exit 但主窗已关"不可实现(能力窗=应用根),故 ExitRequested prevent = 整体取消关闭。

### D2 子窗 close 记账改确认驱动(方案 1,事件即回执)

子窗臂:发起侧(close/destroy 消息)**只派发 `inner.close()`,不摘 store、不摘 registry、不派发 Destroyed、不做 all-closed 判定**;摘除+事件+判定全部移到**销毁确认事件**到达时(既有 Destroyed 安全网臂 :5434 就是确认执行点之一):

- destroy 成功 → ArkTS 真销毁 → tao 派发销毁确认事件 → 确认执行器:摘 store+registry → 派发 Destroyed → all-closed 判定 →(空且未 prevent)设 `ControlFlow::Exit`(复用 D1 出口)。
- destroy 失败(含 id=0 被拒、窗已不存在之外的真失败)→ 无确认事件 → 记账完整 → 窗口命令继续可用。

**在途守卫(审计 F1 修复,递归熔断的替代物)**:现状递归熔断=「发起即摘除→重入 CloseRequested 命中 `removed==None` 早退」(:5699-5702);确认驱动拆除了它,必须补等价物——发起侧派发 destroy 时在**在途集合**(`pending_close: Mutex<HashSet<WindowId>>` 或复用 registry 值域扩展)登记该窗;`on_close_requested_ohos`(:5624)入口先查在途集合:

- **在途** → 本次 CloseRequested 即 ArkTS aboutToDisappear→notifyWindowClose 回环(发起侧自己 destroy 触发的)——**跳过向 app 派发 CloseRequested**(app 已在发起时收过一次且未 prevent;二次派发=重复事件,其 prevent 也挡不住在途 destroy,veto 空转),直接作为销毁确认进入确认执行器(摘账+Destroyed+all-closed),摘账时同步移除在途登记。
- **不在途** → 正常用户关窗路径(CloseRequested 派发+veto+发起)。

幂等性由两层保证:在途集合登记/移除幂等;确认执行器 `removed==None` 早退(现有结构保留)。这使 (b) 从"备选"升为**主确认通道**(Rust 发起 close 的回环 CloseRequested 天然携带确认语义);(a) tao Ok-resolve 主动补发事件降为 belt-and-suspenders(若任务 1.1 实证 (b) 必然到达,(a) 可裁)。

**确认事件形态(任务 1.1 钉板)**:在 (a)/(b) 间实证择一,默认 (b) 主 + (a) 兜底(幂等共存):
- (b) ArkTS aboutToDisappear→notifyWindowClose 回环 CloseRequested + 在途守卫判别(上文);
- (a) tao `close()` 在 destroy_window resolve Ok 时主动补发确认事件(新 MainEvent 映射到 `Event::Destroyed` 携该窗 id)——不依赖 ArkTS 回调时序。

- 备选(回滚式):保持先摘+失败回填。否决——回填与假 Destroyed/假 ExitRequested 竞态(事件已发无法撤回),报告自评"只救后半场";且需要结果回执通道,复杂度与 (a) 相当而语义更差。

### D3 失败=沉默留账(无超时、无轮询)

destroy 失败不产生事件、不回滚、不通知 app(仅 tao `close()` 既有 `log::warn!`)。理由:桥禁 recv_timeout(同步等待结构性不可行);沉默留账=记账与真实世界一致(窗口活着+记账在=一致);超时判定会引入第二条真源。披露:app 无法感知 close 失败(按钮再点会再走一遍完整链,幂等)。

### D4 `Message::Window Destroy` 臂同走确认驱动

upstream destroy() 是无条件移除;OHOS 偏离,理由=真实状态优先(假 Destroyed 正是本 bug 的误导源之一)。`#[cfg(target_env="ohos")]` 隔离,非 OHOS 平台 verbatim 保留。CloseRequested 事件臂(:5395)与 Message Close 臂(:5506)对子窗统一走"发起→等确认"。

### D5 主窗臂不调用 `inner.close()`

主窗 close 不再触达 destroy_window(id=0 必拒,免制造一条必失败的桥调用+warn 噪音);终止能力由 D1 的 ControlFlow::Exit→terminate 链承载。tao `close()` 对 id=0 的调用仅剩理论路径(Registry 判别缺失的退化情形),其后果=ArkTS destroy-window id=0 throw(ability 仓守卫是真正的 backstop;tao `close()` 自身无 id=0 守卫,失败仅 warn——确认驱动下失败=沉默留账,后果无害)。

### D6 all-closed 出口(两臂语义刻意不同,审计 F2 修复)

**子窗确认执行器**:摘账后 store 空 + exit_state 未置 + ExitRequested 未 prevent → `exit_state=true` + 设 `ControlFlow::Exit`。谓词仅适用于子窗确认路径——子窗逐个关闭,最后一条经确认摘除时进程退出(与归档 spec ohos-window-lifecycle"所有窗口关闭时触发 ExitRequested"的既有 SHALL 一致:未 prevent 即设 ControlFlow::Exit)。

**主窗臂**:ExitRequested 门未 prevent 后**无条件**设 `ControlFlow::Exit`(不看 store 是否为空)——平台语义:能力窗=应用根,主窗关闭=全应用终止(子窗随 terminateSelf 全灭)。两臂谓词不同是多窗语义的刻意分叉,非矛盾。现状 :5736 注释"系统已启动销毁流,勿设 Exit"随本设计作废——子窗确认到达时系统销毁确在途,主窗臂终止已显式请求,设 Exit 在两个分支都正确且必要(#100 链是唯一进程出口)。

### 文件粒度规划

- tauri-runtime-wry/src/lib.rs:执行器重构集中 `on_window_close_ohos` + 新增主窗门 helper(估 ±180 行,函数拆分:确认执行器/主窗门各 ≤80 行,防单函数超 150)。
- tao:window.rs `close()` 结果回传 + event_loop.rs 确认事件映射(估 +60 行)。
- 文档:doc/OHOS窗口遗留问题.md(±40 行)。
- 全部改动 `#[cfg(target_env = "ohos")]` 隔离;非 OHOS 编译面零 diff。

## Risks & Trade-offs

- [子窗确认事件若在某些路径不到达(窗口已被 ArkTS 侧先销毁→destroy_window 幂等 ack 但无 aboutToDisappear)] → 记账滞留=命令 lookup 仍命中但窗已亡。缓解:(a) 方案的主动补发事件在 Ok resolve 时发(幂等 ack 也算 Ok)——已销毁窗的 destroy_window 返回幂等成功 ack(ability :1330-1335),故主动补发路径覆盖此情形;实现期以设备用例(子窗关闭→立即再关)实证。
- [子窗 Destroyed 派发从"同步近似"变"异步确认",套件时序敏感用例可能翻红] → 分组实现(A 组主窗先行回归,B 组子窗独立回归),B 组翻红逐例判属(真时序依赖=修用例等待逻辑;假=披露)。
- [ExitRequested veto 在主窗 close 的介入改变现行为:现状先摘再发(必发),新设计先发再摘(prevent 则不发摘)] → veto 前 store 未动=取消后状态完整,严格优于现状;现状的"已摘空所以必发"本身是 bug 的一部分(报告 §4 :19:37:20.460 证据行)。
- [多窗应用关主窗=全应用终止(子窗随之亡,子窗 Destroyed 不逐一派发)] → 披露为平台语义边界(能力窗=应用根,terminate 自带全灭);主窗 Destroyed 在 terminate 前派发(它因用户 close 而关);子窗 Destroyed 缺席记 Known Limitation。
- [§7 第二触发路径未定位] → 方案 1 结构性免疫(记账永不先于真实销毁);若修复后仍复现,另案(报告已预留此口径)。
- [registry 读取时序:主窗臂需在摘除前读 is_ui_ability_main] → 读序固定为"先读后摘",与 #247 摘除点共存(同一函数内顺序保证)。
- [LoopDestroyed 臂(:5229)会在 terminate 链再发一次 ExitRequested 去重检查] → exit_state 已置,天然去重,无需改。

## Test Design

### 测试策略

- **单元测试(host)**:执行器整体需 N-API env(#247 已证不可构造),host UT 覆盖面=纯逻辑 helper:主窗门决策函数(ExitRequested prevent/未 prevent/已 in-flight 三态)、all-closed 出口谓词(空/非空 × exit_state 置/未置)、registry 读后摘顺序不变量(既有 registry UT 扩展)。决策逻辑抽纯函数(`fn ohos_exit_gate_decision(exit_state_set: bool, should_prevent: bool) -> GateAction` 形态)使 host 可测。
- **设备测试(3QC0124C11000038)**:
  - 修后必挂(mutation)红臂:主窗门摘除行变异(去掉 exit_state 检查或去掉记账摘除)→ 定向设备 UT 必挂;
  - §3 五步判据(报告验收标准):close→hilog destroy 链+terminate 链+进程退出+无"每秒 4 条 persist 错误"环;
  - 套件回归:examples/api 全量(std 形态),子窗 close 族重点。
- **集成(套件新增用例)**:主窗 close 用例须置于套件终止兼容位(exit/restart 状态机族既有模式),close 后 app 退出由 autotest 外层判定。

### Spec → Test 映射

| Spec Scenario | Test Function | Type | 期望值 |
|---------------|--------------|------|--------|
| 主窗 close 未 prevent → 优雅退出 | 设备 §3 五步脚本+`ut_main_window_close_terminates` | integration(device) | 进程退出(hilog terminateSelf 链 + app 进程消亡);无 persist 错误环 [报告 §3 判据/§4 时间线反向] |
| 主窗 close ExitRequested prevent → 取消+记账完整 | `ut_main_window_close_prevented_keeps_accounting` | integration(device) | store 查询(getter)仍应答;窗口可见;再次 close 可重入 [upstream 两级 veto 语义;报告 §5.0-2 标准用法] |
| 主窗 close 不触达 destroy-window 桥命令 | §3 五步脚本断言(hilog 桥流量计数) | integration(device) | 捕获窗内 `ohos.window/destroy-window` 桥调用数=0 [报告 §4 对照:修前每次 close 恰 1 次调用+throw] |
| 子窗 destroy 失败 → 记账保留 | `ut_subwindow_destroy_failure_keeps_accounting` | integration(device) | 失败注入(未注册 id 变体/桥拒绝)后 getter 仍应答;无 Destroyed 事件 [设计 D2/D3;报告 §5.1-8 lookup-miss 机理反向] |
| 子窗 destroy 成功 → 确认后摘+Destroyed | `ut_subwindow_destroy_success_confirmed_removal` | integration(device) | Destroyed 恰派发一次;store 摘除;最后窗时触发 Exit [设计 D2;归档 spec ohos-window-lifecycle requirement 1/2 语义] |
| 子窗在途回环 CloseRequested 不重发不空转 veto | `ut_subwindow_close_roundtrip_single_closerequested` | integration(device) | 一次用户 close → app 收 CloseRequested 恰一次(回环不再派发);确认摘账恰一次 [设计 D2 在途守卫;报告 §5.1-1 三类关窗发起者表] |
| pending close drain 路径确认摘账 | `ut_pending_close_drain_confirms_removal` | integration(device) | ArkTS 发起关窗(SubWindowPage X)→CloseRequested 恰一次(veto 有效)→未 prevent→确认摘账+Destroyed 恰一次 [归档 spec ohos-window-lifecycle"OHOS pending close drain"场景语义] |
| Message::Destroy 路径(无 CloseRequested)确认摘账 | `ut_window_destroy_message_confirmed_removal` | integration(device) | Destroy 消息→销毁指令派发→确认摘账+Destroyed 恰一次;零 CloseRequested 派发 [归档 spec ohos-window-lifecycle"系统直接发送 WindowMessage::Destroy"场景语义] |
| 已被 ArkTS 先行销毁的幂等路径 | `ut_already_destroyed_idempotent_ack` | integration(device) | 幂等 ack 确认驱动摘账+Destroyed 恰一次;二次确认早退零重复 [ability WindowPlugin.ets:1330-1335 幂等 ack 契约] |
| 子窗 CloseRequested prevent → 不派发不摘账 | `ut_subwindow_prevent_close_no_dispatch` | integration(device) | prevent 后零销毁指令、记账保持、零 Destroyed [归档 spec ohos-window-lifecycle"用户代码在 CloseRequested 中阻止关闭"场景语义] |
| 主窗门决策三态 | `ohos_exit_gate_decision` 纯函数 UT | unit(host) | (exit_state=true,*)→ProceedTeardown;(false,Prevent)→Cancel;(false,NoPrevent)→TeardownAndExit [设计 D1 决策表;upstream ExitRequested veto 语义] |
| all-closed 出口谓词(仅子窗执行器) | `ohos_all_closed_exit_predicate` 纯函数 UT | unit(host) | (empty,exit_state=false)→SetExit;(empty,true)→Noop;(nonempty,*)→Noop [归档 spec ohos-window-lifecycle"所有窗口关闭时触发 ExitRequested" SHALL;设计 D6 子窗臂] |
| 主窗臂无条件 Exit(多窗在亦终止) | `ohos_exit_gate_decision` UT(主窗臂形态)+设备多窗用例 | unit(host)+integration(device) | 主窗臂不消费 store 空谓词;多窗下关主窗→terminate 全灭 [设计 D6 主窗臂;报告平台语义:能力窗=应用根] |
| Destroyed 仅真实销毁后派发(主窗) | §3 五步脚本断言 | integration(device) | Destroyed 派发时刻 ≤ terminate 派发时刻,且 close 取消时零派发 [设计 D1;报告 §4 假 Destroyed 证据反向] |
| registry 未知 id 读 false 回退子窗臂 | 既有 registry UT 扩展 | unit(host) | unknown→false(现行为保持) [源码 lib.rs:447-455] |
| 文档修正后检索 | 静态检索断言(脚本/人工) | static | "单窗口应用完全不受影响"零命中;新条目含报告路径 [报告 §6 顺带发现三] |

### 测试基础设施

- Fixtures:纯决策函数(无 mock 需求);设备侧复用 examples/api autotest 框架既有 exit/restart 状态机族模式。
- Shared:tauri-runtime-wry 既有 #[cfg(test)] registry UT 模块(#247 建立)。
- 外部依赖:无新增(设备 hilog/hdc 既有配方)。

## Task Signals

tags: [ohos, async, error-handling]
routed_skills: [rust-ohos, rust-async]
