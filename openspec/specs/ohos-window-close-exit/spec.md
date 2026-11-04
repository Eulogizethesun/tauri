# ohos-window-close-exit Specification

## Purpose
TBD - created by archiving change ohos-main-window-close-zombie. Update Purpose after archive.

## Requirements

### Requirement: 主窗关闭优雅退出

单 UIAbility 主窗(Registry `is_ui_ability_main`)的前端 close 在 CloseRequested 与 ExitRequested 两级 veto 均未 prevent 时,应用 SHALL 经 app-control 桥优雅终止(terminateSelf),进程退出,不残留"窗口活着但记账已删"的僵尸态。

#### Scenario: 主窗 close 全链未 prevent

- **WHEN** 前端对主窗调用 `getCurrent().close()` 且两级 veto 均未 prevent
- **THEN** 进程退出(hilog 出现 terminateSelf 终止链,app 进程消亡);`WindowEvent::Destroyed` 在终止派发前恰派发一次;不存在窗口命令静默失效的窗口期

#### Scenario: 主窗 close 被 ExitRequested prevent

- **WHEN** 前端 close 主窗且 app 在 ExitRequested 回调中 prevent
- **THEN** 关闭整体取消:OS 窗口保持可见,store/registry 记账不变,后续窗口命令(getter 与 min/max/close alike)继续应答;再次 close 可重入同一门

#### Scenario: 主窗 close 不触达 destroy-window 桥命令

- **WHEN** 主窗走 close 链
- **THEN** 零 `ohos.window/destroy-window` 桥调用派发(主窗 id=0 必拒的调用不再产生)

### Requirement: 全窗关闭退出出口统一

任何路径(主窗门或子窗销毁确认)摘除最后一个 store 条目且 ExitRequested 未 prevent 时,事件循环 SHALL 设置退出控制流,进程经 app-control 桥 terminate 退出;ExitRequested 派发与退出控制流设置均恰一次(exit_state 去重)。

#### Scenario: 最后一个窗口经子窗确认路径关闭

- **WHEN** 销毁确认后 store 变空且 ExitRequested 未 prevent
- **THEN** 进程经与主窗相同的终止链退出(显式设置循环退出,非依赖系统 LoopDestroyed 兜底)

#### Scenario: 退出出口去重

- **WHEN** ExitRequested 已派发过(exit_state 已置)后再次到达摘除最后条目的路径
- **THEN** 不重复派发 ExitRequested,退出控制流设置恰一次

### Requirement: 文档证伪修正

`doc/OHOS窗口遗留问题.md` 问题一的"单窗口应用完全不受影响"陈述 SHALL 按外部报告证伪修正,并收录主窗关闭僵尸问题条目(引用报告与修复语义)。

#### Scenario: 文档修正后检索

- **WHEN** 在该文档中检索问题一相关陈述
- **THEN** "单窗口应用完全不受影响"原句已修正,新条目含报告路径引用与修复语义描述
