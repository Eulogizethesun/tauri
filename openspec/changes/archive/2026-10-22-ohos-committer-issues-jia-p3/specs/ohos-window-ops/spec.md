# ohos-window-ops Specification

## ADDED Requirements

### Requirement: Creation-time window attributes SHALL seed and replay via pending ops

窗口创建时 `WindowAttributes` 中的创建期参数 SHALL 在 build() 尾经既有 setter 通道接入(dispatch_or_queue:窗口未就绪时入 PENDING_WINDOW_OPS 队列,握手后由 drain_ready_pending_window_ops 补发):

- **播种**:`always_on_top` 与 `decoration_flags` 与默认值存在差异时调用既有 setter;
- **补发**:`fullscreen`/`maximized`/`focused` 三参数按 attrs 存在性一次性补发(HEAD 实证其此前零消费;upstream windows 后端构造尾 attrs 应用先例同形态)。

禁止绕过队列直接调用未就绪的 bridge;默认值不产生多余命令。几何类 attrs(位置/尺寸)已由既有创建通道处理,不在本 requirement 范围。主窗 decorations 的既有 apply 通道(8dd79f77)与 Float create params 传递不受影响。

#### Scenario: always_on_top seeds before ready

- **WHEN** 窗口以 `with_always_on_top(true)` 创建且 bridge client 尚未就绪
- **THEN** build() 尾调用的 set_always_on_top SHALL 入 pending 队列
- **AND** 握手完成后补发,窗口最终置顶生效

#### Scenario: fullscreen attr replays after handshake

- **WHEN** 窗口以 `with_fullscreen(true)`(或等价 attrs)创建且创建时 bridge 未就绪
- **THEN** build() 尾的补发调用 SHALL 入 pending 队列,握手后重放
- **AND** 窗口最终进入 fullscreen 态

#### Scenario: already-ready window applies immediately

- **WHEN** build() 尾 setter 执行时窗口已就绪
- **THEN** SHALL 立即下发而非排队(与运行期同名 setter 语义一致)

#### Scenario: default attributes produce no extra traffic

- **WHEN** 窗口创建未设置 always_on_top/fullscreen/maximized/focused 且 decoration_flags 为 FLAG_ALL 默认值
- **THEN** build() 尾 SHALL 不发多余命令(仅与默认值存在差异的参数才播种/补发)

### Requirement: Window command failures SHALL surface as invoke errors

窗口命令在 ArkTS 侧执行失败时 SHALL 不再被 serializeOp 的 catch 静默吞掉:操作型命令(set-title/set-topmost/set-cursor-icon/set-cursor-visible)SHALL await 执行结果并在失败时 reject 桥接 promise(经既有 windowCommand await 先例);void-setter 类(set-decoration-flags/set-fullscreen/show)SHALL 以 try/throw 上抛。Rust 侧消费沿用既有 `call::<Req, WindowAcknowledgement>().ensure()` ack 通道与 throw→Rust Err 先例(focus/set-decorations),预期零新增传输代码。新增的 tracked 序列化路径(serializeOpTracked)SHALL 保持命令链延续语义(后续命令不因前序失败而停摆)。

#### Scenario: set-title failure propagates

- **WHEN** ArkTS setWindowTitle 抛出(如窗口已销毁)且 Rust 侧发起 set-title
- **THEN** 桥接 promise SHALL reject
- **AND** Rust `ensure()` SHALL 得到 Err(而非默认 WindowAcknowledgement 假成功)

#### Scenario: void-setter failure throws

- **WHEN** set-decoration-flags 执行抛出
- **THEN** 异常 SHALL 上抛至桥层形成 reject(serializeOpTracked 的 catch 不再吞错,只记日志)

#### Scenario: command chain continues after a tracked failure

- **WHEN** 某命令 tracked promise reject 后同一窗口继续下发后续命令
- **THEN** 后续命令 SHALL 正常执行(链延续,无队列停摆)

#### Scenario: success path unchanged

- **WHEN** 命令执行成功
- **THEN** WindowAcknowledgement 返回路径与现状一致,零行为变化
