# ohos-window-ops — ohos-committer-issues-followup Spec Delta

## REMOVED Requirements

### Requirement: Window visibility can be controlled on OHOS with hide workaround
**原因**:minimize 降级被 issue #237 推翻——`hide()` 语义错误(表现为任务栏最小化)且 `is_minimized` 镜像与真实状态分叉,违反本仓修复口径"不支持的能力应返回错误,不做降级假成功";OHOS @ohos.window 无窗口级 hide 方法(d.ts 实证),待 A1 hide_ability 权益落地前无真实现路径。新语义(hide 诚实 Err + show 镜像条件化)由本 delta 的 ADDED 需求承载。

## MODIFIED Requirements

### Requirement: Creation-time window attributes SHALL seed and replay via pending ops

窗口创建时 `WindowAttributes` 中的创建期参数 SHALL 在 build() 尾经既有 setter 通道接入(dispatch_or_queue:窗口未就绪时入 PENDING_WINDOW_OPS 队列,握手后由 drain_ready_pending_window_ops 补发):

- **播种**:`always_on_top` 与 `decoration_flags` 与默认值存在差异时调用既有 setter——**OHOS UIAbility 主窗的 minimizable/maximizable/closable 三钮除外**(系统无主窗逐钮控制,seed warn+忽略、不阻断创建,见本 delta ADDED 需求;子窗照常播种);
- **补发**:`fullscreen`/`maximized`/`focused` 三参数按 attrs 存在性一次性补发。

禁止绕过队列直接调用未就绪的 bridge;默认值不产生多余命令。几何类 attrs(位置/尺寸)已由既有创建通道处理,不在本 requirement 范围。主窗 decorations 的既有 apply 通道(8dd79f77)与 SubWindow create params 传递不受影响。

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

#### Scenario: OHOS main-window three-button seeds are skipped
- **WHEN** OHOS UIAbility 主窗以 `minimizable(false)`(或 maximizable/closable)attrs 创建
- **THEN** 三钮 seed SHALL warn+忽略(不入 pending 队列、不调 setter),创建不被阻断;子窗不受此排除影响

## ADDED Requirements

### Requirement: Window hide on OHOS surfaces NotSupported instead of minimizing
On OHOS the system SHALL make window hiding fail visibly: `WebviewWindow::hide()` SHALL return an error (NotSupported, message naming OpenHarmony), implemented at the tauri-runtime-wry dispatcher layer. tao `Window::set_visible(false)` SHALL log an error and MUST NOT minimize the window, MUST NOT dispatch any window message, and MUST NOT mutate the minimized mirror. Non-OHOS platforms SHALL be unaffected.

#### Scenario: hide rejects on OHOS
- **WHEN** `hide()` is called on a window on OHOS
- **THEN** the call rejects with a NotSupported error whose message mentions the operation is not supported on OpenHarmony

#### Scenario: tao-level hide leaves state untouched
- **WHEN** `set_visible(false)` reaches the tao OHOS backend directly
- **THEN** no window message is dispatched and the minimized mirror remains unchanged (no minimize side effect)

#### Scenario: non-OHOS builds unaffected
- **WHEN** tao/tauri-runtime-wry are built for Windows/macOS/Linux
- **THEN** existing show/hide behavior compiles and behaves unchanged (OHOS early-return is cfg-gated)

### Requirement: Window show on OHOS restores only minimized windows
On OHOS `set_visible(true)` SHALL be conditional on the minimized mirror: a minimized window SHALL get restore (API ≥14; on API 12 restore is unavailable → showWindow best-effort + warn, preserved) followed by showWindow, and the mirror SHALL be cleared; a non-minimized window SHALL get showWindow only, so the maximized state of a visible window is never reset by `show()`.

#### Scenario: show a minimized window restores it
- **WHEN** the window is minimized and `set_visible(true)` is called
- **THEN** restore + showWindow are invoked (API 12 degrades to showWindow + warn) and the window is visible

#### Scenario: show on a visible maximized window keeps maximized state
- **WHEN** a visible maximized window calls `set_visible(true)` (or `show()`)
- **THEN** only showWindow is invoked and `is_maximized()` still returns true

### Requirement: Main-window decoration buttons surface NotSupported on OHOS
On OHOS the UIAbility main window has no per-button decoration control (SDK evidence), so `set_minimizable`/`set_maximizable`/`set_closable` SHALL return NotSupported for the main window at the tauri level; tao SHALL log and skip (no flag write, no dispatch); ArkTS `setDecorationFlags` SHALL throw for main windows. Sub-windows SHALL keep the existing effective path; `set_resizable` SHALL NOT be affected.

#### Scenario: main-window setters reject
- **WHEN** `setMinimizable(false)`/`setMaximizable(false)`/`setClosable(false)` is called on the UIAbility main window on OHOS
- **THEN** each call rejects with a NotSupported error naming OpenHarmony

#### Scenario: sub-window setters keep effect
- **WHEN** the same setters are called on a sub-window
- **THEN** the calls resolve and the sub-window decoration buttons reflect the flags (existing behavior preserved)

#### Scenario: ArkTS facade throws for main window
- **WHEN** `setDecorationFlags` is invoked with a UIAbility main-window id
- **THEN** the call throws (mirrors the unknown-window throw pattern) instead of silently no-oping

### Requirement: Decoration button queries return true state on the OHOS main window
On OHOS `is_minimizable`/`is_maximizable`/`is_closable` SHALL report the real system state for the UIAbility main window: `true` (OS-controlled buttons are always available). For sub-windows they SHALL continue to report the intent flags that actually drive behavior. Queries and behavior SHALL not diverge.

#### Scenario: main-window queries return true
- **WHEN** `isMinimizable()`/`isMaximizable()`/`isClosable()` is called on the main window
- **THEN** each returns true (matching the OS-controlled reality)

#### Scenario: sub-window queries reflect flags
- **WHEN** the same queries are called on a sub-window whose flags were set
- **THEN** the values reflect the flags driving its decoration buttons

### Requirement: Creation-time decoration seeds warn and are ignored for the OHOS main window
On OHOS, creation-time `minimizable`/`maximizable`/`closable` window attributes on the UIAbility main window SHALL be ignored with a warning (creation must not fail on this soft preference); sub-window creation-time seeds SHALL keep the existing effect.

#### Scenario: main-window creation with button seeds succeeds
- **WHEN** a main window is created with `minimizable(false)` (or the other two) in its attributes
- **THEN** creation succeeds, a warning is logged, and the buttons remain OS-controlled

### Requirement: OHOS sub-window kind is named SubWindow
The system SHALL name the OHOS sub-window kind `SubWindow` across all layers: Rust `OHOSWindowKind::SubWindow`, ArkTS `WindowKind.SubWindow`, and the `SubWindowPage` component. The `Float` naming SHALL be removed with no compatibility alias (repo unpublished, no compat burden).

#### Scenario: Rust enum exposes SubWindow
- **WHEN** crate code references the OHOS window kind for sub-windows
- **THEN** the variant is `OHOSWindowKind::SubWindow` and `Float` no longer compiles (no alias)

### Requirement: Dead window_type chain is removed on OHOS
The dead `window_type` chain SHALL be deleted: the `OHOSWindowType` enum, `WindowCreateParams.window_type`, and the tao fill sites. Nothing in the sub-window creation path SHALL carry a window_type value.

#### Scenario: dead window_type chain removed
- **WHEN** the workspace builds after the change
- **THEN** `OHOSWindowType` and the `window_type` plumbing are gone from tao and openharmony-ability (zero grep hits)

### Requirement: Docs distinguish application sub-window from TYPE_FLOAT global float window
Documentation SHALL state that the OHOS implementation uses the application sub-window (createSubWindow), and SHALL distinguish it from the TYPE_FLOAT global float window on device support surface and movability outside the app region.

#### Scenario: docs describe application sub-window semantics
- **WHEN** a developer reads the `ohos_window_kind` docs or the window test-mapping doc
- **THEN** the text says application sub-window (createSubWindow, all form factors, cannot move outside the app region) and contrasts the TYPE_FLOAT global float window (PC/2in1 only)
