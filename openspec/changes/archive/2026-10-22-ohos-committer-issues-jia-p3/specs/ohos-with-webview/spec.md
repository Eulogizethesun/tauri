# ohos-with-webview Specification

## ADDED Requirements

### Requirement: webview Drop SHALL dispose unconditionally

wry OHOS 后端的 `dispose_child` 与 `InnerWebView::Drop` SHALL 不再以 `is_child` 作前置门控:任何 webview(主 webview 与子 webview)在销毁时 SHALL 触发 `PendingOp::Remove` 派发(dispatch_or_queue:未就绪入队、就绪直发),幂等标志(`disposed` swap)保持不变。该门控原本只对主 webview 跳过 dispose,导致 ArkTS Web 组件残留(僵尸组件吃点击/占资源);移除后主 webview 销毁链与子 webview 一致。桥未就绪时排队的 Remove 若永不补发,由 bridge 既有 15s 超时兜底(DEFAULT_TIMEOUT_MS),设计注释 SHALL 记录该悬挂边界。

#### Scenario: Main webview Drop triggers dispose

- **WHEN** 主窗 webview(非 child)被 Drop(如窗口关闭链)
- **THEN** `PendingOp::Remove` SHALL 派发(dispatch 或入队)
- **AND** ArkTS 侧对应 Web 组件被销毁,不再残留

#### Scenario: Child webview behavior unchanged

- **WHEN** 子 webview Drop(既有路径)
- **THEN** 行为与移除门控前一致(仍走同一 dispatch_or_queue)

#### Scenario: Double dispose remains idempotent

- **WHEN** dispose 被显式调用后 Drop 再次触发
- **THEN** `disposed` AtomicBool swap SHALL 吞掉第二次,只派发一次 Remove

#### Scenario: Not-yet-ready window queues Remove

- **WHEN** Drop 发生在 bridge 握手完成前
- **THEN** Remove SHALL 入 pending 队列;若窗口永不就绪,由 bridge 15s 超时兜底,不悬挂进程退出
