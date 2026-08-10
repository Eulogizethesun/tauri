# OHOS 事件/显示器/托盘适配计划

**创建时间**：2026-07-20
**功能描述**：tao 事件生命周期转发（Start/SaveState）、tao 显示器真实值与降级、
tray-icon 平台限制降级的 openspec 设计补齐。
**判断依据**：复核 tao `platform_impl/ohos/mod.rs`、muda `platform_impl/ohos/mod.rs`、
tray-icon `platform_impl/ohos/mod.rs`、openharmony-ability `event.rs`/`app.rs`、
`ohos-display-binding` / `ohos-display-sys` crate API 面。

## 范围与判定总表

| 行 | 功能 | 现有spec? | 复核后真实代码 | 契约判定 | 处置 |
|----|------|----------|---------------|---------|------|
| R135 | SaveState | 无 | `MainEvent::SaveState` warn 未转发 | 平台限制降级（tao 无对应 Event/StartCause 变体） | spec `ohos-event-lifecycle-forward`（降级 + warn→debug） |
| R136 | Start (NewEvents-Start) | 无 | `MainEvent::Start` warn 未转发 | 需新实现（转发为 `Event::Resumed`） | spec `ohos-event-lifecycle-forward` |
| R137 | 销毁事件 | 无 | `MainEvent::Destroy → Event::LoopDestroyed` 已转发 | 契约已满足 | 不写 spec（报告说明） |
| R139 | 位深 | 无 | 硬编码 32 | 平台限制降级（OHOS 无 bit-depth API，32=RGBA8888 真实值） | spec `ohos-monitor-degradation` |
| R140 | 刷新率 | 无 | 硬编码 60 | 需新实现（`default_display_refresh_rate()` 可用） | spec `ohos-monitor-real-values` |
| R142 | 显示器位置 | 无 | 固定 (0,0) | 平台限制降级（单显示器，原点真实为 0,0） | spec `ohos-monitor-degradation` |
| R143 | 显示器名称 | 无 | 固定 "OpenHarmony Device" | 平台限制降级（OHOS 无 name API） | spec `ohos-monitor-degradation` |
| R147 | monitor_from_point | 无 | 返回 None + warn | 需新实现（单显示器边界判定） | spec `ohos-monitor-real-values` |
| muda | 菜单系统 | menu-auto-tests 已覆盖 | append/insert/remove/popup 委托共享 impl | 契约已满足 | 不写 spec（报告说明） |
| R176 | 托盘临时目录 | 无 | `set_temp_dir_path` no-op | 平台限制降级（NAPI RGBA 传输，无临时目录） | spec `ohos-tray-degradation` |
| R177 | 托盘 rect() | 无 | `rect()` 返回 None | 平台限制降级（StatusBar 不提供位置） | spec `ohos-tray-degradation` |
| R178 | 托盘模板图标 | tray-icon-template 已覆盖 | white/black 双图标已实现 | 契约已满足 | 不写 spec（报告说明） |

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及仓 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | 事件生命周期转发 + 降级 | ohos-event-lifecycle-forward | ✓ 设计完成 | tao | 1 | cargo check(ohos) + 设备端 SHOWN/SaveState 验证 |
| 2 | 显示器真实值 + 点查询 | ohos-monitor-real-values | ✓ 设计完成 | openharmony-ability + tao | 2-3 | cargo check(ohos) + 高刷新率设备验证 refresh_rate |
| 3 | 显示器降级文档化 | ohos-monitor-degradation | ✓ 设计完成 | tao | 1 | 注释审查 + cargo check |
| 4 | 托盘降级文档化 | ohos-tray-degradation | ✓ 设计完成 | tray-icon | 1 | 注释审查 + cargo check |

## Phase 详细说明

### Phase 1: 事件生命周期转发 + 降级（ohos-event-lifecycle-forward）

- **目标**：
  - `MainEvent::Start` → `Event::Resumed`（移除 warn）
  - `MainEvent::SaveState` → `debug!` 降级（移除 warn）
- **关键发现**：
  - tao `StartCause` 枚举仅 `ResumeTimeReached`/`WaitCancelled`/`Poll`/`Init`，**无 `Autosave` 变体** → SaveState 无法映射到 `NewEvents(StartCause::*)`。
  - `Event::Resumed` 是 OHOS SHOWN 信号的最接近语义（tao 无 window-shown 事件）。
  - 与 SurfaceCreate/Resume 重复触发 Resumed 需下游幂等（tauri `RunEvent::Resumed` 已具备）。
- **文件**：`tao/src/platform_impl/ohos/mod.rs`（run_loop 闭包内 Start/SaveState 分支）
- **依赖**：无

### Phase 2: 显示器真实值 + 点查询（ohos-monitor-real-values）

- **目标**：
  - `MonitorHandle::video_modes()` 刷新率取自 `default_display_refresh_rate()`
  - `monitor_from_point` 基于单显示器边界判定
  - `MonitorHandle::size()` 取自 DisplayManager 物理像素
- **关键发现**：
  - `ohos-display-binding` crate 提供 `default_display_refresh_rate()` / `default_display_width/height`（已存在，openharmony-ability 已用其 `default_display_scaled_density`）。
  - OHOS DisplayManager 仅有 "default display" API，无多屏枚举 → `monitor_from_point` 用边界判定返回 Some(primary)/None。
  - 按 CLAUDE.md 铁律#1，tao 不得直接依赖 `ohos-display-binding`，须经 openharmony-ability 暴露。
- **文件**：
  - `openharmony-ability/crates/ability/src/app.rs`（新增 `refresh_rate()` / `display_size()` 方法）
  - `tao/src/platform_impl/ohos/mod.rs`（MonitorHandle::video_modes / size / monitor_from_point）
- **依赖**：Phase 1 无关，可并行

### Phase 3: 显示器降级文档化（ohos-monitor-degradation）

- **目标**：bit_depth=32、position=(0,0)、name="OpenHarmony Device" 的降级在源码
  注释中显式说明并引用 spec。
- **关键发现**：
  - OHOS DisplayManager API 面已审计：无 `BitDepth`/`Name`/多屏枚举。
  - 32 位深 = OHOS RGBA8888 真实值（非近似）；(0,0) = 单屏真实原点。
- **文件**：`tao/src/platform_impl/ohos/mod.rs`（MonitorHandle::name/position/video_modes 注释）
- **依赖**：Phase 2（同文件协同修改）

### Phase 4: 托盘降级文档化（ohos-tray-degradation）

- **目标**：`set_temp_dir_path` no-op 与 `rect()` 返回 None 在源码注释中引用 spec，
  `set_temp_dir_path` 移除潜在 warn（当前已是空函数体，仅需注释补充）。
- **关键发现**：
  - `rect()` 既有注释已说明 AvoidArea.topRect 不可用，本 phase 仅补充 spec 引用。
  - `set_temp_dir_path` 当前 `pub fn set_temp_dir_path<P>(&mut self, _path: Option<P>) {}` 无 warn。
  - 与 Linux 行为对齐（Linux `rect()` 也返回 None）。
- **文件**：`tray-icon/src/platform_impl/ohos/mod.rs`
- **依赖**：无

## 已满足契约（不写 spec）

- **R137 销毁事件**：`MainEvent::Destroy → Event::LoopDestroyed` 已在 mod.rs:592-596 转发；
  另 `WindowDestroy` 分支补发 `CloseRequested` + `Destroyed`，契约完整。
- **muda 菜单系统**：`Menu::add_menu_item`/`remove`/`items`/`popup`/`refresh_menubar`
  均在 ohos `mod.rs` 实现；`MenuItemData` 序列化 + ArkTS 渲染链路完整；
  `menu-auto-tests` spec 已覆盖 popup/insert/remove 自动测试。措辞"共享 impl 委托"
  复核后：ohos 确有独立 `Menu`/`MenuChild` impl（非共享 cfg），功能等价，契约满足。
- **R178 托盘模板图标**：`tray-icon-template` spec 已覆盖 white/black 双图标、
  `set_icon_as_template` 运行时切换、`set_icon_with_as_template` 组合设置，
  实现已于 `icon.rs` + `mod.rs::build_item_from_attrs` 完成。

## 平台限制降级清单（确认无法实现）

| 项 | OHOS API 现状 | 降级处置 |
|----|--------------|---------|
| R135 SaveState 转发 | tao Event/StartCause 无对应变体 | 不转发，debug 日志 |
| R139 bit_depth | DisplayManager 无 bit-depth API | 固定 32（=RGBA8888 真实值） |
| R142 position | 无多屏 API | 固定 (0,0)（单屏真实原点） |
| R143 name | 无 display-name API | 固定 "OpenHarmony Device" |
| R176 set_temp_dir_path | StatusBar 用 NAPI RGBA 传输 | no-op |
| R177 rect | StatusBar 不提供托盘位置 | 返回 None |

## OHOS API 关键未知项

- **DisplayManager 多屏**：当前 NDK 仅暴露 default display。若未来 OHOS NDK 新增
  `GetAllDisplays`，`available_monitors` / `monitor_from_point` 可升级为真实多屏。
- **DisplayCutoutInfo**：`default_display_cutout_info()` 已可用但 tao 未消费，
  若需刘海屏安全区可后续引入。
- **DisplayChangeListener**：`OH_NativeDisplayManager_RegisterDisplayChangeListener`
  已存在，可用于监听刷新率/分辨率动态变化（当前 spec 仅做静态查询）。
