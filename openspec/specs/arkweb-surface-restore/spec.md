# arkweb-surface-restore Specification

## Purpose
TBD - created by archiving change p1-arkweb-surface-restore. Update Purpose after archive.
## Requirements
### Requirement: WebView uses natural ArkUI layout for sizing (OHOS)
On OHOS, the Web component SHALL use `.width("100%")` / `.height("100%")` (natural ArkUI layout) instead of `.width(data.style?.width)` / `.height(data.style?.height)` (set_bounds via BuilderNode.update). BuilderNode.update only changes the ArkUI layout-tree size constraint; it does NOT notify the ArkWeb render engine to relayout. With natural layout, the Web follows the Stack/window naturally on resize → ArkUI triggers ArkWeb relayout.

> **Rejected alternative (Event::Resumed → set_bounds reattach):** An earlier approach emitted `Event::Resumed` on `MainEvent::Start` and called `set_bounds()` to reattach the ArkWeb surface after minimize→restore. This was a misdiagnosis — minimize→restore works naturally without set_bounds (ArkWeb rebinds on its own). The set_bounds call actually interfered with ArkWeb's natural rebind, causing a 2-cycle bottom-cutoff issue. The Event::Resumed handler and tao's MainEvent::Start→Resumed emission were both reverted.

#### Scenario: resize preserves bottom content
- **WHEN** the user drags the window edge to resize and releases
- **THEN** the bottom content of the page is fully visible (no cutoff)
- **AND** the Web component follows the window size naturally via `.width("100%")` / `.height("100%")`

#### Scenario: minimize→restore preserves bottom content
- **WHEN** the window is minimized and then restored from the taskbar
- **THEN** the bottom content is fully visible (ArkWeb rebinds naturally, no set_bounds interference)

#### Scenario: set_bounds still works for positioning
- **WHEN** `set_bounds()` is called (e.g., by the Resized handler)
- **THEN** the Web component's `.position({x, y})` is updated for sub-window placement
- **AND** the Web's `.width` / `.height` remain `"100%"` (sizing is natural, only positioning uses set_bounds)

#### Scenario: non-OHOS platforms unaffected
- **WHEN** the app runs on Windows/macOS/Linux
- **THEN** the Web component sizing behavior is unchanged (the fix is in openharmony-ability's ArkTS code, OHOS-only)

