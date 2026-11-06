# ohos-main-window-close-zombie

## Why

外部应用方(artcraft)提交的 bug 报告 `D:\xuqiu\craft\artcraft\TAURI-OHOS-BUG-MAIN-WINDOW-CLOSE-ZOMBIE.md`(2026-11-03,两轮独立复现,复现率 100%)证实:单主窗应用前端 `getCurrent().close()` 触发主窗关闭后,OS 窗口不关闭、进程存活,但 Rust 侧 `WindowsStore` 记账已被无条件摘除——此后全部窗口命令(getter 与 min/max/close alike)静默失效,窗口进入"僵尸态",只能 force-stop 恢复。

核查结论(Task #12,2026-11-04 行号级核对):缺陷链六点在 ohdev 终链(tauri 3127de89a / tao 6968a6cc / ability 5942fc2)完整存在:

1. `on_window_close_ohos` 无条件先摘 store(destroy 之前、不看结果)— tauri-runtime-wry/src/lib.rs:5678
2. destroy 为 fire-and-forget、失败仅 log 无回滚 — tao src/platform_impl/ohos/window.rs:1878-1893(tauri 侧注释 :5692-5697 自述主窗 id=0 rejected fire-and-forget 为已知未处置)
3. `WindowEvent::Destroyed` 在窗口实际还活着时无条件派发 — lib.rs:5710-5714
4. all-closed 臂不设 `ControlFlow::Exit`,赌系统 LoopDestroyed(主窗 destroy 失败时永不兑现)→ 进程永活 — lib.rs:5734-5739(返回值被 :5403 `let _` 丢弃)
5. ArkTS `destroy-window` 对 `windowId===0` 直接 throw — openharmony-ability WindowPlugin.ets:1324-1326(平台语义正确,主 UIAbility 窗不可当 sub-window 销毁)
6. 主窗 close 未接任何终止能力 — close 链零 terminate 接线

相邻已修件构成修复前提:AppControl `terminate` 已是 graceful `terminateSelf`(AppControlPlugin.ets:177-190,含 appspawn/SIGABRT 勘误);`app.exit()` 链已接 `ControlFlow::Exit → tao pending-exit → LoopDestroyed → RunEvent::Exit → terminate(env,0)`(issue #100,commit 27cd63671)。缺口纯在 close 链未接此成熟链路。

顺带发现(报告 §6)同样未处置:close 路径 ExitRequested 触发后进程不退;假 Destroyed 误导 app 侧状态机(artcraft 每秒 4 条 persist 错误);`doc/OHOS窗口遗留问题.md` 问题一"单窗口应用完全不受影响"被本报告直接证伪,未收录。

## What Changes

- **tauri(crates/tauri-runtime-wry/src/lib.rs)**:`on_window_close_ohos` 按 `ohos_is_ui_ability_main` 分臂重构——主窗臂走 ExitRequested 门→terminate 链;子窗臂改确认驱动记账(destroy 成功确认后才摘 store/派发 Destroyed)。all-closed 确认路径接 `ControlFlow::Exit`。
- **tao(src/platform_impl/ohos/window.rs + event_loop.rs)**:`close()` 的 destroy 结果经事件回传(成功确认事件;失败静默留账)。
- **tauri(doc/OHOS窗口遗留问题.md)**:问题一证伪句修正+新问题收录(引用报告)。
- 验收:设备 3QC0124C11000038 按报告 §3 五步判据复现验证+套件回归。

## Capabilities

### New Capabilities

- 主窗(UIAbility kind)close 语义:CloseRequested 未 prevent → ExitRequested 门 → 未 prevent → 优雅 terminateSelf 退出(经 #100 成熟链),prevent 则取消关闭且记账完整(按钮继续可用,零僵尸)。
- 子窗 destroy 失败免疫:destroy 失败时 store/registry 记账保留,窗口命令继续可用(结构性消灭僵尸而非回滚补丁)。

### Modified Capabilities

- `WindowEvent::Destroyed` 派发时序:由 close 发起时无条件同步派发,改为真实销毁确认后派发(与 upstream 语义对齐:OS 驱动记账摘除)。
- `WindowMessage::Destroy`(webview destroy 路径):同样走确认驱动(OHOS 偏离 upstream 无条件移除,理由=真实状态优先)。

## Impact

- 依赖(既有,零新增):`ohos_main_window_registry` 主窗判别(insert 时 `is_ui_ability_main`,#238/#247 已建立);tao pending-exit→terminate 链(#100);AppControl graceful terminateSelf(ability 仓,无需改动)。
- 被影响面:tauri-runtime-wry close/destroy 四臂(CloseRequested 事件臂/Message::Window Close 臂/Message::Window Destroy 臂/Destroyed 安全网臂)与在途守卫;tao `close()` 与事件发射;examples/api 设备套件子窗 close 族用例(时序敏感,须回归)。
- 不改动:openharmony-ability(方案 2 选 Rust 侧接线 ②,ArkTS destroy-window id=0 throw 保留为守卫);upstream 非 OHOS 路径(`#[cfg(target_env="ohos")]` 隔离)。
