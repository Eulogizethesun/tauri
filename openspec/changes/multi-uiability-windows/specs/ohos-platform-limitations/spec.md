## ADDED Requirements

<!-- Note: this change also adds one row (`R-multiuiab-singleton`) to the existing
     "平台限制汇总（增补）" summary table in openspec/specs/ohos-platform-limitations/spec.md.
     The table is not a Requirement, so it is recorded here as a note rather than a delta entry. -->

### Requirement: 多 UIAbility 架构下 cursor 全局单值与第二窗口 raw_window_handle 为已知限制
多 UIAbility 窗口支持（`multi-uiability-windows` change）落地后，两项单例残留因语义/优先级原因维持现状并标注为已知限制：① `CURSOR_POSITION_X/Y` 为进程级全局单值（app.rs），多窗口下不区分来源窗口——OHOS 鼠标位置语义为 MainPage-relative，per-window cursor 追踪另行立项；② `content_rect` 单 Rect / `native_window` 单句柄——第二 UIAbility 实例窗口（id>0）的 `raw_window_handle` 暂缺，依赖 raw window handle 的 API 在该类窗口上不可用。多实例事件路由（input/IME/axis/focus/destroy 按 windowId）不受影响。

#### Scenario: 多窗口并存时读取鼠标位置
- **WHEN** 主窗口与第二 UIAbility 实例窗并存，应用读取 cursor 位置
- **THEN** 返回值 SHALL 为进程级单值（不区分来源窗口），语义维持 MainPage-relative
- **AND** SHALL NOT 因多窗口并存产生崩溃或错误（只是不区分来源）

#### Scenario: 在第二 UIAbility 实例窗上请求 raw window handle
- **WHEN** 第二 UIAbility 实例窗口（windowId>0）调用依赖 raw_window_handle 的 API
- **THEN** 该窗口 SHALL 无 native_window 句柄可返回（已知限制，返回缺省/错误按各 API 既有降级路径）
- **AND** 主窗口（windowId=0）与 Float 子窗口的 raw_window_handle SHALL 不受影响
