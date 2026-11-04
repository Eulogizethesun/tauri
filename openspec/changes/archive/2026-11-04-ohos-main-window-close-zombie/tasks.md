# tasks.md — ohos-main-window-close-zombie

## 1. 探索钉板(实现前置,只读)

- [x] 1.1 钉死 tao 销毁确认事件源映射 — anchor: tao/src/platform_impl/ohos/event_loop.rs
  - 枚举 OHOS 上产生 `Event::CloseRequested` 与 `Event::Destroyed` 的全部 MainEvent/桥回调发射点;对"Rust 发起的 destroy 成功/失败/ArkTS 先行销毁"三情形各到达哪个事件逐一定性;据此定 (b) 主通道+(a) 兜底的取舍(design D2)
  - 结论: (b) 回环不保证到达(已销毁窗=幂等 ack 无新 aboutToDisappear;失败=静默)→(a) tao Ok-resolve 补发确认必须保留(判据记录 zombie-notes.md Task 1.1 节)
- [x] 1.2 复核 registry 读写时序与 #247 摘除点共存 — anchor: crates/tauri-runtime-wry/src/lib.rs::ohos_record_main_window,::ohos_is_ui_ability_main,::ohos_registry_remove

## 2. 纯逻辑层(host 可测,测试先行)

- [x] 2.1 主窗门决策纯函数 UT(先写) — anchor: crates/tauri-runtime-wry/src/lib.rs::ohos_exit_gate_decision
  - 三态决策表:(exit_state=true,任意)→ProceedTeardown;(false,Prevent)→Cancel;(false,NoPrevent)→TeardownAndExit
- [x] 2.2 实现 `ohos_exit_gate_decision` 使 UT 绿 — anchor: crates/tauri-runtime-wry/src/lib.rs::ohos_exit_gate_decision
  - 设备 UT 6/6 绿(ohos_exit_gate_tests,run-ut.sh,3QC0124C11000038;证据 .tmp/zombie-fix-evidence/ut-group2-green.log)
- [x] 2.3 all-closed 出口谓词纯函数 UT(先写,仅子窗执行器语义) — anchor: crates/tauri-runtime-wry/src/lib.rs::ohos_all_closed_exit_predicate
  - (empty,exit_state=false)→SetExit;(empty,true)→Noop;(nonempty,任意)→Noop;主窗臂不消费本谓词(设计 D6)
- [x] 2.4 实现 `ohos_all_closed_exit_predicate` 使 UT 绿 — anchor: crates/tauri-runtime-wry/src/lib.rs::ohos_all_closed_exit_predicate

## 3. 主窗臂(A 组,先行回归;设备用例编写先于实现执行)

- [x] 3.1 编写设备用例:主窗 close 未 prevent→terminate / prevent→记账完整 / 零 destroy-window 桥调用 — anchor: examples/api
  - 用例名 `ut_main_window_close_terminates`/`ut_main_window_close_prevented_keeps_accounting`/§3 五步脚本桥流量断言;套件 exit/restart 状态机族模式(终止兼容位)
  - 落点: examples/api/src/lib/tests/zombie-close.ts(prevent 臂 auto 用例,EXIT_CONFIRM_MODE+confirm-exit-requested 断言+Destroyed 零差值+getByLabel('main') 存活);
    TestRunner.svelte process-phase 新增 main-close-launched 相位(terminate 兼容位,boot1 runAll 后 arm→close→8s 观测,boot N+1 仅在外部拉起时出现)
- [x] 3.2 `on_window_close_ohos` 分臂重构:主窗走 ExitRequested 门+无条件 ControlFlow::Exit 出口,不调用 inner.close() — anchor: crates/tauri-runtime-wry/src/lib.rs::on_window_close_ohos
  - 读 registry 判别(先读后摘);prevent→取消零记账触碰;未 prevent→摘 store+registry+派发 Destroyed+设 ControlFlow::Exit(#100 链);`#[cfg(target_env = "ohos")]` 隔离
  - 实现落点: ohos_main_window_close_gate(:5786,经 ohos_dispatch_close_ohos 路由,registry true AND OS id==0 双条件防多 UIAbility 误杀);OHOS 目标 cargo check 绿
- [x] 3.3 设备 §3 五步判据验证(报告验收标准)+3.1 用例执行 — anchor: crates/tauri-runtime-wry/src/lib.rs
  - 设备 3QC0124C11000038:close→terminate 链+进程退出+无 persist 错误环+零 destroy-window 桥调用;hilog 证据留 .tmp
  - 结论: 五步链全过(11:15:56.555 ExitRequested should_prevent:false→Destroyed(main)→Exit×2→terminateSelf×2→root session 1025 2ms 内拆);反指纹四条全零;prevent 臂三形态三发;子窗回环 33 次零重复;p-run-report 326✅/9⏭/0❌;多 UIAbility 残留进程拖尾定性=已知限制进 doc(terminateSelf 只杀 root,spawned 实例保活至系统回收 ~11min)
- [x] 3.4 修后必挂(mutation)红臂:主窗门 — anchor: crates/tauri-runtime-wry/src/lib.rs::on_window_close_ohos
  - 变异(摘 exit_state 检查或摘记账摘除)→定向设备 UT 必挂;还原字节级一致重绿
  - 结论: 双判别两处 `false &&` 变异→325✅/1❌/9⏭(行 329 红,消息逐字命中)+旧 bug 签名回归(Cannot destroy the main Ability window (id 0));mut34-report/mut34-hilog;还原 diff 零差
- [x] 3.5 套件回归(A 组收口):examples/api std 形态全量,基线 328✅/8⏭/0❌ 零回归 — anchor: examples/api
  - 结论: std-run1 326✅/9⏭/0❌ 与 1030 基线(327 例 319✅/8⏭)逐例对账零翻转;+7 zombie(6✅+1⏭ 预期)+1 #244 新例;基线口径差异已消解

## 4. 子窗臂(B 组,独立回归;设备用例编写先于实现执行)

- [x] 4.1 编写设备用例:成功确认摘账/失败记账保留/在途回环恰一次 CloseRequested/drain 路径/Destroy 消息路径/幂等 ack/prevent 不派发 — anchor: examples/api
  - 用例名映射 design Test Design 表:`ut_subwindow_destroy_success_confirmed_removal`/`ut_subwindow_destroy_failure_keeps_accounting`/`ut_subwindow_close_roundtrip_single_closerequested`/`ut_pending_close_drain_confirms_removal`/`ut_window_destroy_message_confirmed_removal`/`ut_already_destroyed_idempotent_ack`/`ut_subwindow_prevent_close_no_dispatch`
  - 落点: zombie-close.ts 8 例(7 子窗名全配+主窗 prevent 臂);drain 路径 ArkTS-initiated 入口=SubWindowPage ✕ 属 UI 交互,套件 JS 不可驱动→manual 形态(uinput 步骤内联,4.5 设备执行);失败注入=fault_injection_set_rule(pluginId ohos.window/action destroy-window,cov 构建运行、std 构建按 withFault 惯例 skip);TestRunner.svelte 已注册(std 批尾插,既有用例编号零位移)
- [x] 4.2 发起侧只派发不摘账+在途守卫:四臂统一,在途集合登记/判别/移除 — anchor: crates/tauri-runtime-wry/src/lib.rs::on_close_requested_ohos,::on_window_close_ohos
  - 在途回环 CloseRequested=销毁确认(不再向 app 派发,直接确认执行);CloseRequested 事件臂/Message Close 臂/Message Destroy 臂统一发起语义
  - 实现落点: ohos_pending_close_insert/take(:5675,:5687,take 非 peek 防双通道重复进执行器);on_close_requested_ohos 在途守卫;OHOS 目标 cargo check 绿
- [x] 4.3 确认执行器:销毁确认到达时摘 store+registry+派发 Destroyed+all-closed 出口(子窗谓词) — anchor: crates/tauri-runtime-wry/src/lib.rs::on_window_close_ohos
  - 实现落点: on_window_close_ohos(:5882,idempotent 早退;Destroyed 仅在 removed=Some 时派发恰一次;veto 的 all-closed 不置 exit_state)
- [x] 4.4 tao 确认事件回传((a) 兜底臂:destroy_window resolve Ok 时补发确认事件) — anchor: tao/src/platform_impl/ohos/window.rs::close, tao/src/platform_impl/ohos/event_loop.rs
  - 1.1 结论若 (b) 必然到达可裁 (a),须留判据记录
  - 裁定: 不裁——(b) 不保证到达(1.1 判据);实现=DESTROY_CONFIRMATIONS 全局队列+close() Ok 臂 enqueue+waker;event_loop dispatch drain 合成 Destroyed
- [x] 4.5 设备用例执行(4.1)+失败注入路径核验 — anchor: examples/api
  - 结论: fault-injection 构建(prod,fault-injection 无插桩)行 335 ⏭→✅(3475ms,327✅/0❌/8⏭);注入 1300004 恰 1 发(hilog window 28);Destroyed delta=0+getByLabel 在+isVisible true
- [x] 4.6 修后必挂(mutation)红臂:确认驱动(变异回"先摘后发"形态→失败注入用例必挂) — anchor: crates/tauri-runtime-wry/src/lib.rs::on_window_close_ohos
  - 结论: 变异=ohos_initiate_destroy_ohos 在 inner.close() 前插 10 行纯插入(摘 store+registry+派发 Destroyed)→行 335 红(326✅/1❌/8⏭,`destroy FAILED but accounting was torn down (Destroyed delta 1)`);行 329-334 全绿零附带破坏;还原 diff 零差,绿证据=Q 跑行 335 ✅(同字节源)
- [x] 4.7 套件回归(B 组收口):子窗 close 族用例逐例判属(时序敏感翻红=修用例等待;假=披露) — anchor: examples/api
  - 结论: 子窗族 6 例在三种形态(std/进程/fault-injection)全绿零时序翻红;mut34/q2 变异跑中子窗成功路径例(330-333)亦不挂=变异外科性旁证

## 5. 文档+收尾

- [x] 5.1 doc/OHOS窗口遗留问题.md:问题一证伪句修正+新问题条目(引用报告与修复)+静态检索断言("单窗口应用完全不受影响"零命中) — anchor: doc/OHOS窗口遗留问题.md
  - 结论: 问题八正文节完整(现象/机制六点/后果/复现/修复 D1-D6/验证/已知限制);静态断言过(证伪短语仅 strikethrough/引用形态两处);验证节含双变异红臂+失败注入证据
- [x] 5.2 全链验证:host 四仓基线+设备套件全量+commit(显式点名文件) — anchor: crates/tauri-runtime-wry/src/lib.rs
  - 结论: host cargo check 双绿(runtime-wry 2.91s 重编译还原树+tao 暖缓存);设备三形态(std 326✅/9⏭/进程 326✅/9⏭/fault-injection 327✅/8⏭)零回归;commit=tauri 三笔(0d70166e7 fix/e84141b4c test/2264cf68a docs)+tao 一笔(545698d7);churn 族+scratch+skill 零触碰;**push 待用户确认**
