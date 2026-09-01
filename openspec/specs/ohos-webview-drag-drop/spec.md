# ohos-webview-drag-drop Specification

## Purpose
为 wry OHOS 的 `drag_and_drop` feature 提供端到端文件拖拽支持：激活 feature flag、接通 wry `drag_drop_handler`、补全 openharmony-ability `drag.rs`、并在 ArkTS `DefaultWebview.ets` 的 Web 组件上挂接 OHOS 拖拽事件，使外部文件拖入 webview 时能以 `DragDropEvent::{Enter, Over, Drop, Leave}` 形式回传给 wry 用户回调。

## ADDED Requirements

### Requirement: wry SHALL activate the drag_and_drop feature flag on OHOS
`wry` OHOS build SHALL enable the `drag_and_drop` cargo feature by default (or document the activation path), and the `WebViewBuilder` SHALL accept a `drag_drop_handler` that is wired through to the OHOS webview. The existing `openharmony-ability` `on_drag_and_drop` builder field (already feature-gated) SHALL be populated when a handler is present.

#### Scenario: drag_drop_handler set on builder
- **WHEN** a wry `WebViewBuilder` is configured with `drag_drop_handler(Some(handler))` on OHOS
- **THEN** `openharmony_ability::WebViewBuilder::on_drag_and_drop` SHALL receive a non-null closure
- **AND** the closure SHALL be transported to ArkTS as the `onDragAndDrop` field of `WebViewInitData`

#### Scenario: no drag_drop_handler
- **WHEN** no `drag_drop_handler` is set
- **THEN** `WebViewInitData.onDragAndDrop` SHALL be `undefined`/`null`
- **AND** the Web component SHALL NOT attach drag event listeners (no overhead)

### Requirement: openharmony-ability SHALL bridge on_drag_and_drop to ArkTS
The `openharmony-ability` Rust crate SHALL (under `feature = "drag_and_drop"`) expose `WebViewBuilder::on_drag_and_drop<F: Fn(String)>(self, handler: F)` (already present) and SHALL transport the handler as an NAPI `Function<String, ()>` in `WebViewInitData.onDragAndDrop`. The handler receives a **pipe-string payload** of the form `<type>|<paths_nul>|<x>,<y>` (NOT JSON), matching the format consumed by `wry/src/ohos/mod.rs`. The `drag.rs` module SHALL define a `DragDropEvent` enum (`Enter { paths, position }`, `Over { position }`, `Drop { paths, position }`, `Leave`) — mirroring `wry::DragDropEvent` — and provide a `from_arkts_pipe(&str)` constructor that parses the pipe-string.

The pipe-string wire format (identical to `ohos-webview-drag-drop-overlay` spec):
- `type` ∈ `enter` | `over` | `drop` | `leave`
- `paths_nul` = file URIs with `file://`/`datashare://` scheme stripped, joined by `\0` (null byte) so paths containing commas survive intact (empty string for `enter`/`over`/`leave` when no preview paths are available, or whenever `type` is not `drop`)
- `<x>,<y>` = drop position in webview content-area coordinates; fallback `0,0` when unavailable
- Fields are joined by `|`; the wry-side parser uses `raw.splitn(3, '|')` so `paths_nul` may never contain `|` (URIs don't), and `paths_nul` is split on `\0` with empty entries filtered out

#### Scenario: DragDropEvent pipe-string shape
- **WHEN** an OHOS drag event of type Drop occurs with files `["file://docs/a.txt", "file://docs/b.pdf"]` at position `(120, 64)`
- **THEN** the ArkTS bridge SHALL invoke `data.onDragAndDrop` with the pipe-string `drop|docs/a.txt\0docs/b.pdf|120,64`
- **AND** the wry-side handler SHALL `splitn(3, '|')` it into `["drop", "docs/a.txt\0docs/b.pdf", "120,64"]`, split the middle on `\0` into paths, parse the tail as `(x, y)`, and produce `DragDropEvent::Drop { paths: Vec<PathBuf>, position: (i32, i32) }`

#### Scenario: enter/over/leave pipe-string shape
- **WHEN** the drag pointer enters/moves over/leaves the webview bounds
- **THEN** ArkTS SHALL call `data.onDragAndDrop` with `enter|<paths_nul>|<x>,<y>` / `over|<paths_nul>|<x>,<y>` / `leave|<paths_nul>|<x>,<y>` (when preview paths are unavailable, `paths_nul` is the empty string, e.g. `over||0,0` / `leave||0,0`)
- **AND** wry SHALL map them to `DragDropEvent::{Enter { paths, position }, Over { position }, Leave}`

#### Scenario: drag.rs no longer a stub
- **WHEN** `cargo build` runs with `drag_and_drop` feature on OHOS
- **THEN** `crates/ability/src/webview/drag.rs` SHALL compile a non-stub `DragDropEvent` enum (mirroring `wry::DragDropEvent`: `Enter { paths: Vec<PathBuf>, position: (i32, i32) }`/`Over { position }`/`Drop { paths, position }`/`Leave`) with a `from_arkts_pipe(&str) -> Option<Self>` constructor that performs `splitn(3, '|')` + `\0`-split path parsing, and a `to_arkts_pipe(&self) -> String` inverse for tests/debug

### Requirement: ArkTS Web component SHALL attach drag event listeners
`DefaultWebview.ets` `WebBuilder` and `EmbeddedWebBuilder` SHALL, when `data.onDragAndDrop` is a function, attach OHOS ArkUI drag event handlers (`.onDragStart`/`.onDragEnter`/`.onDragMove`/`.onDragLeave`/`.onDrop`) to the `Web` component (or its wrapping `Stack`). The handlers SHALL extract the dragged file URIs from the OHOS `DragEvent` and forward a **pipe-string payload** `<type>|<paths_nul>|<x>,<y>` to `data.onDragAndDrop` (same wire format as the overlay spec; NOT JSON).

#### Scenario: file dropped onto webview
- **WHEN** a user drags a file from the OHOS file manager and drops it onto the webview
- **THEN** the `.onDrop` handler SHALL read `dragEvent.getData()`/`primitive`/`summary` URIs, strip the `file://`/`datashare://` scheme, join them with `\0` (null byte) into `paths_nul`, and call `data.onDragAndDrop('drop|' + paths_nul + '|' + x + ',' + y)` (matching `DefaultWebview.ets` line `data.onDragAndDrop('drop|' + path + '|0,0')`)
- **AND** the wry `drag_drop_handler` SHALL receive `DragDropEvent::Drop { paths, position }` on the Rust event loop thread

#### Scenario: drag enter/over/leave forwarded
- **WHEN** the drag pointer enters/moves over/leaves the webview bounds
- **THEN** the corresponding `.onDragEnter`/`.onDragMove`/`.onDragLeave` handler SHALL call `data.onDragAndDrop` with `enter|<paths_nul>|<x>,<y>` / `over|<paths_nul>|<x>,<y>` / `leave|<paths_nul>|<x>,<y>` (when preview paths are unavailable, `paths_nul` is empty — e.g. `enter||0,0`, `over||0,0`, `leave||0,0`, matching `DefaultWebview.ets`)
- **AND** wry SHALL map them to `DragDropEvent::{Enter { paths, position }, Over { position }, Leave}`

### Requirement: Platform limitation SHALL be documented when ArkWeb rejects file drops
If investigation reveals that the OHOS ArkWeb `Web` component does not surface OS-level file drag events to ArkUI (i.e., the Web component consumes HTML5 DnD internally and never emits ArkUI `onDrop`), the design SHALL fall back to one of: (a) rely on HTML5 drag-and-drop inside the page (no wry callback), or (b) overlay a transparent drop-target `Stack` above the Web component. The chosen fallback SHALL be documented in `ohos-webview-drag-drop-plan.md` and the spec updated with a MODIFIED Requirement naming the platform limitation.

#### Scenario: ArkWeb consumes drag events internally
- **WHEN** OHOS ArkWeb does not bubble file drag events to ArkUI `onDrop`
- **THEN** the implementation SHALL use the overlay `Stack` drop-target approach (transparent `Stack` above `Web` that receives ArkUI drag events and forwards them)
- **AND** the wry `drag_drop_handler` SHALL still receive `DragDropEvent::Drop` with the file paths

### Requirement: HTML5 in-page drag-and-drop SHALL remain functional
Activating the OHOS drag-and-drop bridge SHALL NOT break existing HTML5 drag-and-drop inside web pages (e.g., dragging elements within the DOM). The overlay (if used) SHALL not intercept in-page DnD events that originate inside the Web component.

#### Scenario: in-page HTML5 DnD unaffected
- **WHEN** a web page implements HTML5 drag-and-drop between DOM elements
- **THEN** the OHOS drag bridge SHALL NOT interfere (no swallowed events, no duplicate callbacks)
- **AND** only OS-level file drag from outside the webview triggers `DragDropEvent`
