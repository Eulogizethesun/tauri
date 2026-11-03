# ohos-cursor-passthrough 规格

## ADDED Requirements

### Requirement: 全窗口光标位置喂入

OHOS 运行时上,SHALL 任何由 runtime 创建的窗口(主窗 MainPage、Float 子窗 FloatPage)在其页面收到鼠标 Move 或 Press 事件时,都以该事件的**屏幕全局坐标**(设备屏幕参照系)更新进程级光标快照;最后喂入的值即为 `cursor_position` 的数据源。

#### Scenario: 主窗 Move 喂入

- **WHEN** 光标在主窗页面内移动(MainPage onMouse,action=Move)
- **THEN** 进程光标快照更新为该事件的屏幕全局坐标,`cursor_position()` 读出「全局坐标 × scale」的物理 px 值

#### Scenario: 子窗喂入覆盖旧值(非主窗坐标新鲜度)

- **WHEN** 光标从主窗移动到一个 Float 子窗(如工具栏窗)之上并产生 Move 事件
- **THEN** FloatPage 的 onMouse 喂入子窗上的屏幕全局坐标,`cursor_position()` 读数随之更新为子窗上方位置(不再是主窗的陈旧值)

#### Scenario: 子窗上的 Press 同样喂入

- **WHEN** 光标在 Float 子窗上按下鼠标(action=Press)
- **THEN** 快照更新为按下点屏幕全局坐标(与 MainPage 的 Move/Press 守卫一致,Release 不喂)

### Requirement: 全局屏幕坐标系语义

OHOS 上 `cursor_position` SHALL 返回**屏幕全局物理 px**坐标(以设备屏幕左上角为原点),与任何单个窗口的原点、组件位置无关——对齐 tao 上游 `Window::cursor_position` 语义(Windows 实现为 `GetCursorPos` 全局屏幕坐标)。desktop 设备形态下的 JS 侧 `cursorPosition()` 命令(上游 `cfg(desktop)`)与四处公开 Rust API(`AppHandle`/`Window`/`Webview`/`WebviewWindow::cursor_position`)读同一契约值。

#### Scenario: 读数为屏幕全局坐标

- **WHEN** 以宿主注入手段将光标置于屏幕已知坐标 P(已知某 Float 子窗的全局原点 + 窗内偏移)且该子窗收到 Move 事件
- **THEN** `cursor_position()` 读数 ≈ P(容差 ±40px),而非「窗口相对坐标」(两者差异 ≥ 窗口全局原点偏移量)

#### Scenario: 读数不随窗口原点漂移(与窗口相对假设可区分)

- **WHEN** 光标被宿主注入手段依次置于某 Float 子窗上至少两个已知窗内位置所对应的屏幕物理点,且各注入点均落在该子窗当前窗位范围内
- **THEN** `cursor_position()` 每次读数均 ≈ 对应注入点的屏幕全局坐标(容差 ±40px),而非「窗口相对坐标」——读数与窗内偏移假设之差 ≥ 窗口原点模长 − 80px(窗口原点模长 > 80px 时两假设不可混淆);物理移窗仅为可选增强刺激,非本场景验证的必要条件

### Requirement: 未跟踪态 fail-safe 契约

OHOS 上,SHALL 当进程从未收到任何鼠标喂入时,`cursor_position` 返回类型化错误(tao 层为 `Err(NotSupported)`,经 runtime-wry `FailedToGetCursorPosition` 传导为 tauri 命令 Err;desktop 设备形态下 JS `cursorPosition()` reject;Rust 侧 `AppHandle`/`Window`/`Webview`/`WebviewWindow::cursor_position` 同契约透传 Err);一旦发生喂入即恢复返回坐标。调用方(app)纪律:捕获该错误或坐标不可信时一律 `set_ignore_cursor_events(true)`(默认穿透),命中测试匹配才置可触。

#### Scenario: 冷启动未喂入 → reject

- **WHEN** 应用启动后无任何鼠标 Move/Press 到达任何窗口,desktop 设备形态下 JS 侧调 `cursorPosition()`
- **THEN** Promise reject(而非解析出 `(0,0)` 垃圾值);app 捕获后应保持穿透

#### Scenario: 喂入后恢复 resolve

- **WHEN** 任意窗口产生一次 Move/Press 喂入后调 `cursorPosition()`
- **THEN** Promise resolve 为全局坐标值

#### Scenario: Err 只表示「未跟踪」,不表示运行时失败

- **WHEN** 喂入已发生但穿透链调用(`set_ignore_cursor_events`)出现 fire-and-forget 层错误
- **THEN** 两者错误通道互不影响:cursor_position 仍 resolve 坐标;穿透错误维持既有「Promise reject 不反向通知 Rust」模型

### Requirement: 喂入值守卫

ArkTS 喂入 helper SHALL 仅在坐标字段为有限数值时调用 `updateCursorPosition`;字段缺失或非数值时跳过喂入、保留上次快照值。版本守卫:API ≥ 20 且 `globalDisplayX` 为数值时优先采用,否则采用 `displayX`。

#### Scenario: 非数值字段不覆盖快照

- **WHEN** 某次 onMouse 事件的 `displayX/displayY`(及 `globalDisplayX/Y`)非数值(如 undefined)
- **THEN** 不调用 NAPI 喂入,快照保持上次值(不产生 NaN 污染)

#### Scenario: API 20+ 优先全局显示字段

- **WHEN** 设备 `sdkApiVersion ≥ 20` 且事件携带数值型 `globalDisplayX/globalDisplayY`
- **THEN** 喂入值取 `globalDisplayX/globalDisplayY`;API < 20 设备喂入 `displayX/displayY`

### Requirement: 穿透链零回归

`set_ignore_cursor_events → setWindowTouchable(!ignore)` 穿透链的实现、错误模型(fire-and-forget、reject 不反向通知)SHALL 保持不变;本 change 仅修正其依赖的 `cursor_position` 数据源。

#### Scenario: 既有穿透 smoke 用例保持

- **WHEN** 运行既有 `ohos-adapter.window.ignore-cursor-events` 用例(`setIgnoreCursorEvents(false)` smoke + 手动穿透/恢复步骤)
- **THEN** 行为与改动前一致(调用 OK、hilog 痕迹一致、穿透视觉验证可复现)

### Requirement: 平台隔离

本 change 全部改动 SHALL 落在 openharmony-ability(ArkTS + 仅 ohos 目标的 Rust)与 tao 的 OHOS 平台实现文件内;Windows/macOS/Linux 的 `cursor_position` 实现与行为不变;tauri crate 运行时代码零改动。

#### Scenario: 非 OHOS 编译不受影响

- **WHEN** 为 Windows/macOS/Linux 编译 tao 与 tauri
- **THEN** 编译通过且 `cursor_position` 走各平台原有实现,不引用任何 OHOS 喂入/未跟踪逻辑

#### Scenario: tauri 运行时零改动

- **WHEN** 审查 tauri crate 的 `crates/tauri` 目录
- **THEN** 无源码变更(仅 examples/api 测试与文档变更)
