## Why

OHOS 真机上 `examples/api` demo 重启后主窗口缩小到 760×570 且贴左上角 (0,0)。根因是
`window-state` 插件 + `tao`/`openharmony-ability` 的 OHOS 路径存在三处缺陷叠加：

1. 插件 `save_window_state` 在 OHOS 上跳过 `update_state()` 活查询，只读事件驱动缓存；缓存靠
   Resized/Moved 事件异步刷新 → "改完立刻 save" 竞态落盘旧尺寸。
2. OHOS 上 tao 把 `windowRectChange`（MOVE/DRAG）派发为 `ContentRectChange` → `Resized`，而非
   `Moved` → 插件的 Moved 处理器从不触发 → 缓存 x/y 停留在创建默认值 (0,0)。
3. `AppInner.window_rect` 是单字段，主窗口与所有 Float 子窗口的 `windowRectChange` 都写同一字段
   （last-writer-wins）→ 多窗口场景下任意窗口的 `inner_size()/outer_position()` 读到的都是"最近
   变化的那个窗口"的 rect。

本变更根治上述三处缺陷，使 OHOS 的窗口状态持久化在单窗口与多窗口场景下均正确。

## What Changes

- **openharmony-ability**：`windowRectChange` 回调携带窗口标识；`AppInner.window_rect: Rect`
  → `window_rects: HashMap<i64, Rect>`（key = windowId，0 = 主窗口）；新增按 key 查询/写入接口；
  Float 子窗口在 `WindowManager.createSubWindow` 新增 windowRectChange 注册（子窗口当前无注册）。
  **BREAKING**（oha 内部 ABI）：`window_rect_change` NAPI 闭包签名读取的 options 对象新增
  `windowId` 字段；ArkTS `onWindowRectChange` 调用方须传入带 `windowId` 的包装对象。
- **tao**：`inner_size()/outer_position()` 按窗口自身 key 读 per-window rect（主窗口 = key 0）；
  `MainEvent::ContentRectChange`/`WindowResize` 携带 windowId，事件按窗口路由正确的 `window::WindowId`
  （顺带修复子窗口 resize 事件全部记到主窗口头上的正确性 bug，含 xcomponent.rs:139 第三构造点）。
- **window-state 插件**：OHOS `save_window_state` 分支无条件刷新 size + position（Phase 1 临时 gate
  `label=="main"`，Phase 2 per-window rect 生效后删 gate；不再依赖 `StateFlags::POSITION` 门控，因
  serde 序列化整个 struct，SIZE-only save 也会把陈旧 x/y 写盘）；`maximized/minimized` 维持跳过
  （同步 NAPI 阻塞）。
- **ArkTS**：`NativeAbility.ets`（主窗口 windowRectChange，windowId=0）、`WindowManager.createSubWindow`
  （Float 子窗口新增 windowRectChange 注册）、`BridgeHost.ets`（主窗口 component window 第二注册，
  windowId=0）三处回调包装 options 附带 `windowId`。

## Capabilities

### New Capabilities
- `ohos-window-state-persistence`: OHOS 窗口状态（尺寸/位置）的 per-window 持久化与正确恢复，
  覆盖 oha per-window rect 存储、tao per-window 读取与事件路由、window-state 插件 save 刷新策略。

### Modified Capabilities
<!-- 无现有 spec 级别需求变更 -->

## Impact

- **代码层**：openharmony-ability（Rust + ArkTS）、tao（OHOS platform_impl）、plugins-workspace
  window-state 插件。涉及 3 个仓库、约 12 个文件。
- **ABI 变更**：oha `window_rect_change` 闭包读取的 options 新增 `windowId`；ArkTS 侧三处回调包装
  （NativeAbility / WindowManager.createSubWindow / BridgeHost）。受 `cfg(target_env="ohos")` 隔离，
  其他平台零影响（铁律 2）。
- **构建**：oha ArkTS 改动后必须 `pack.bat`（cmd.exe 调用）重建 HAR + 清 oh_modules/CompileArkTS
  缓存（已知坑），再重建 HAP。
- **风险**：tao `WindowId` 由 ZST 改为携带 u64 的事件路由是本变更最高风险点，影响 tao 所有 OHOS
  事件派发（16 处）。采用分阶段交付，Phase 1（插件 save 刷新 + main gate）零 ArkTS 风险，先修复
  主窗口 bug。Phase 2 子窗口 windowRectChange 注册（新注册点，非 attachComponent 透传）。
