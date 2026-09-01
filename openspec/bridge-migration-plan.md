# Bridge Architecture Migration 适配计划

**创建时间**：2026-08-12
**最后更新**：2026-08-12（审计修正）
**功能描述**：openharmony-ability 桥接架构重构（PR #67 pluginized bridge + PR #68 内置插件），将旧的 `get_named_property` 字符串直调模型迁移到统一的 `bridgeInvoke(pluginId, action, reqType, respType, value, timeout)` 具名契约传输层。
**判断依据**：涉及 5 个代码层（openharmony-ability / wry / tao / tray-icon+muda / tauri+plugins-workspace），预估 90 个文件

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 仓库 | 预估文件 | 依赖 | 验证方式 |
|-------|------|----------------|------|------|---------|------|---------|
| A0 | Merge + 冲突解决 | p0-bridge-merge | ✓ 已完成 | openharmony-ability | ~30 | 无 | cargo check (OHOS target) |
| A1 | 补 action（webview + window + clipboard） | p1-bridge-actions | ✓ 已完成 | openharmony-ability | ~21 | A0 | cargo check 通过 |
| A2 | R75 https 拦截验证 | p2-bridge-https-intercept | ✓ 已完成 | openharmony-ability | ~7 | A0 | cargo check 通过 |
| A3 | 自建插件 | p3-bridge-custom-plugins | ✓ 已完成 | openharmony-ability | ~30 | A0 | cargo check 通过 |
| B1 | tao bridge 适配 | p1-tao-bridge | ✓ 已完成 | tao | ~8 | A0 | cargo check 通过 |
| B2 | wry webview 改写 | p2-wry-webview-bridge | ✓ 已完成 | wry | ~10 | A1 | cargo check 通过 |
| B3 | wry https 拦截 | p3_wry-https-intercept | ○ 待开始 | wry | ~3 | A2 | 设备端 https 拦截验证 |
| B4 | tray-icon/muda bridge 适配 | p4-tray-menu-bridge | ✓ 已完成 | tray-icon, muda | ~10 | A0 | cargo check 通过 |
| B5 | tauri 集成 + 全量回归 | p5_tauri-integration | ○ 待开始 | tauri, plugins-workspace | ~15 | A2, A3, B1-B4 | 全量测试回归 |

## Phase A+: ArkTS NativeAbility Bridge Session 接线（白屏修复）

- **状态**：⏳ 实施完成，构建验证中
- **目标**：补全 merge f59b910 引入的新 Rust 桥接架构在 ArkTS 侧缺失的 session 创建/销毁生命周期。merge NativeAbility.ets 有完整 teardown（onDestroy 调 `BridgeHostRegistry.dispose`）但 onCreate 从未写 session creation；ProcessInitializer 用 1-arg `module.init(context)` 调已变为 3-arg 的 Rust derive，导致 `get_named_property("bridgeInvoke")` N-API 报错、`bridgeSessionId` 永为空、DefaultXComponent 抛 "cannot render before bridge session" 被 ArkUI 静默吞掉 → 白屏
- **范围**：
  1. `openharmony-ability/native_ability/src/main/ets/ability/ProcessInitializer.ets` — 删除 `lifecycles` 字段/getter、`createInitContext` 改 public、删除 `module.init` 块，session creation 所有权移交 NativeAbility
  2. `openharmony-ability/native_ability/src/main/ets/ability/NativeAbility.ets` — 补全 8 个属性（acceptingLifecycle/abilityGeneration/windowStageGeneration/bridgeSessionId/moduleRuntimes/windowStageActive/bridgePlugins/lifecycleQueue）+ 8 个方法（enqueueLifecycleOperation/notifyBridgeLifecycle/detachWindowListeners/destroyWindowStageIfActive/releaseModuleBridges/updateAppStorage/serializeSavedStateMap/loadWindowStageContent）+ onCreate 完整 session 创建（prepare→init→configurePlugins→attachEventSink→activateAbility）+ onWindowStageCreate setWindowStage + onWindowStageDestroy clear + forEachLifecycle/onSaveState 改读 moduleRuntimes
  3. `openharmony-ability/native_ability/index.ets` — 导出 `BridgePluginDeclaration` type
  4. `tauri-cli/templates/mobile/open-harmony/entry_{desktop,mobile}/.../EntryAbility.ets.hbs` — 加 LazyPlugin import + 13 个 ArkTS BridgePlugin import + `bridgePlugins` 数组
  5. `tauri/examples/api/src-tauri/gen/ohos/entry_desktop/.../EntryAbility.ets` — 同步 bridgePlugins（GlobalShortcutPlugin 用 OhosGlobalShortcutPlugin 别名避开与 `@tauri/plugin-global-shortcut` 同名冲突）
- **依赖**：A0-A3（已满足）+ B1-B4（已满足）
- **验证**：hvigor `BUILD SUCCESSFUL` + 设备非白屏 + webview 渲染前端 + hilog 显示 `Bridge session created: bridge-<ts>-<N>` + DefaultXComponent `render() completed` + plugin `installed` 日志
- **设计要点**：
  - BridgeBindings 三个函数：`bridgeInvoke`/`bridgeInvokeSync` 转发到 `BridgeHostRegistry.invokeAsync/invokeSync`；`bridgeDispatch` 是 TSFN no-op trampoline（Rust `MainThreadTask::run()` 在 build_callback 里跑）
  - `APP_CONFIGURED` OnceLock：Rust derive 只在第一次 `init` 跑用户的 `#[ability]` fn；ProcessInitializer 不再调 init，NativeAbility 的 3-arg 调用是唯一入口
  - `loadWindowStageContent` 为 protected 可覆写：demo EntryAbility 覆写加载自定义 page，tauri-cli 模板用默认 impl 加载 `Entry.RouteName`

## Phase A++: Bridge Plugin 聚合打包（单 HAR 全家桶）

- **状态**：⏳ 实施完成，构建验证中
- **背景**：A+ 把 13 个 ArkTS BridgePlugin 接进 `bridgePlugins` 数组后，首次外部消费暴露两个问题：
  1. **13 个 cross-module import 错误**——每个 plugin 的 `index.ets` 用 `export { XxxPlugin } from "./src/main/ets/XxxPlugin"`，作为 `file:` 依赖被 entry_desktop 消费时，hvigor 报 `Cannot import files outside of the current module using relative paths`（源码目录依赖跨模块边界）
  2. **11 个 plugin 源码 strict/SDK 错误**——这些 plugin 源码此前从未被外部 ohpm 模块编译过（PR #68），首次走 hvigor strict 编译暴露：webview 的对象字面量类型 / `webview.OnWindowNewEvent` / `printRequest.PrinterInfo` 动态命名空间；app-control 的 `@ohos.app.ability` 废弃模块路径 / `hideAbility()` 签名变更
- **方案**：Strategy A 全家桶——base 源码 + 13 个 plugin 源码打进**同一个** `ability.har`，消费者只依赖一个 `@ohos-rs/ability` 包
  - 13 个 plugin 之间**零依赖**、ohpm 依赖完全相同（仅 `@ohos-rs/ability`）、build-profile 完全一致（无 native cpp），平铺进一个模块无冲突
  - 聚合后 plugin 与 base 同属一个 ohpm 模块，相对路径合法 → 13 个 cross-module 错误自动消失
- **机制**（`pack.bat` → `pack-plugins.ps1`，在 base 复制后、`tar` 前执行）：
  1. 把 `plugins/<name>/src/main/ets/<Name>Plugin.ets` 复制到 `package/src/main/ets/plugins/<name>/`
  2. 生成内部 barrel `package/src/main/ets/ability_exports.ets`：从 `native_ability/index.ets` 派生，把 `./src/main/ets/` 前缀改写成 `./`（相对 `package/src/main/ets/` 定位 base 文件）
  3. 把复制出的 plugin 源码里 `from "@ohos-rs/ability"` 改写成 `from "../ability_exports"`——**无环**：barrel→base（单向），plugin→barrel，index→base+plugin。plugin 不导入 index，避免 `index re-export plugin → plugin import index` 的循环
  4. `package/index.ets` 追加 13 个 `export { XxxPlugin } from "./src/main/ets/plugins/<name>/XxxPlugin"`，base 导出保持在前（plugin 类继承 base 类，解析顺序安全）
- **消费侧改动**：
  - 三处 `oh-package.json5`（entry_desktop/mobile 模板 + examples/api）删除 13 个 `@ohos-rs/ability-plugin-*` 依赖，只留 `@ohos-rs/ability`
  - 三处 `EntryAbility.ets`（desktop/mobile 模板 + examples/api）把 13 个独立 import 合并为单一 `import { ..., XxxPlugin, ... } from '@ohos-rs/ability'`；examples/api 的 `GlobalShortcutPlugin` 仍用 `as OhosGlobalShortcutPlugin` 别名避开与 `@tauri/plugin-global-shortcut` JS 层插件同名
- **plugin 源码修复**（修后 standalone 与聚合两种消费方式都能编译）：
  - webview：`{ request: WebResourceRequest }` 对象字面量类型 → `interface WebInterceptRequestEvent`；`webview.OnWindowNewEvent` → 全局 `OnWindowNewEvent`（ArkUI 全局类型，不在 webview namespace）；`printPdf` 删除死变量 `PrinterInfo`，`@ohos.print` 动态 import 结果转 ESObject 调用，`Promise.resolve()` 归一化 await
  - app-control：`from "@ohos.app.ability"` → `from "@kit.AbilityKit"`（`ConfigurationConstant` 仍被使用，仅换模块路径）；`hideAbility(callback)` → `hideAbility()`（SDK 签名已变为 0 参 fire-and-forget）
- **plugin 仍保持 standalone 可构建**：源码仍写 `from "@ohos-rs/ability"`，改写只发生在 `package/` 副本上。13 个 `plugins/*/oh-package.json5` 与 `index.ets` 保留，便于单独开发/测试
- **依赖**：Phase A+（plugin factory 必须先接入 NativeAbility）
- **验证**：`pack.bat` 产出 `ability.har` ≥135KB（含 plugin）+ hvigor `BUILD SUCCESSFUL` + EntryAbility 能从 `@ohos-rs/ability` 解析 13 个 plugin 类

## 双轨并行依赖图

```
Track A (openharmony-ability)          Track B (consumer repos)
─────────────────────────────          ─────────────────────────

A0: Merge + 冲突解决 (5-8天)
       │
A1: 补action webview+window+clipboard ─→ B2: wry webview 改写 (8-12天)
    (7-9天)                                │
       │
A2: R75 https 拦截验证 (2-4天) ───────→ B3: wry https 拦截 (2-3天)
       │
A3: 自建插件 (8-12天) ────────────────→ B5: tauri 集成 (3-5天)
    global-shortcut (5-7天)                + 留core回归 + 全量测试
    deep-link (2-3天)
    autostart (2-3天)
                                         B1: tao 适配 (3-4天)     ← A0 完成即可启动
                                         B4: tray-icon/muda (3-4天) ← A0 完成即可启动
```

## 并行窗口说明

- **A0 完成后**：B1（tao）和 B4（tray-icon/muda）可立即启动，因为 plugin-window/app-control/menu/statusbar 的 facade 在 A0 merge 后已存在
- **A1 完成后**：B2（wry）可启动，因为 plugin-webview facade 完整（含补全的 action）
- **A2 完成后**：B3（wry https）可启动
- **A2 + A3 + B1-B4 全部完成后**：B5（tauri 集成）可启动。B5 还依赖 A2 的结论（是否需要扩展 bridge 框架）

## Phase 详细说明

### Phase A0: Merge + 冲突解决

- **目标**：将 harmony-contrib/main (PR #67) 和 feat/pr63-pluginized (PR #68) 合入本地 ohdev 分支，解决 30+ 个冲突
- **merge 顺序验证**：
  - 方案一：先 merge main，再 merge feat/pr63-pluginized — 分两步解决冲突，每步冲突较少
  - 方案二：直接 merge feat/pr63-pluginized（已包含 main）— 一步到位，但冲突更多
  - **建议先用 `--no-commit` 两种都试一次，选冲突少的方案**
- **关键冲突文件**：
  - `crates/ability/src/app.rs` — content 冲突（保留 refresh_rate/display_width/height，合入 bridge 入口）
  - `crates/ability/src/helper/webview.rs` — modify/delete（删除，功能搬到 plugin-webview）
  - `crates/ability/src/webview/mod.rs` — modify/delete（删除，功能搬到 plugin-webview）
  - `crates/ability/src/webview/drag.rs` — modify/delete（删除）
  - `native_ability/.../DefaultWebview.ets` — modify/delete（删除，功能搬到 plugins/webview）
  - `native_ability/.../Utils.ets` — modify/delete（删除）
  - `crates/ability/src/lib.rs` — content（合入新模块导出）
  - `crates/derive/src/lib.rs` — content（`#[ability]` 宏参数变化）
  - `Cargo.toml` — content（新 workspace 成员）
- **ArkHelper.ets 处置**：
  - 新架构用 `BridgeHost.ets` + `BridgeNodeSlot.ets` + `NativeModuleLoader.ets` 取代 ArkHelper.ets
  - ArkHelper.ets 虽然在 PR #67 文件清单中未被删除，但功能已被新架构覆盖
  - **处理策略**：merge 后检查 ArkHelper.ets 是否仍被引用。如已废弃，将本地改动（clipboard/zoom/https 装配）搬到对应的新 plugin 位置；如仍在使用，保留并添加 `@Deprecated` 注释
- **处理策略**：
  1. 验证两种 merge 顺序的冲突数，选优
  2. modify/delete 文件：接受删除，将本地功能代码暂存到 `crates/ability/src/_legacy/` 临时目录，后续 Phase 搬入新架构
  3. content 冲突：逐文件手工合并，保留两端改动
- **依赖**：无
- **验证**：`cargo check --target aarch64-unknown-linux-ohos` 编译通过

### Phase A1: 补 action（webview + window + clipboard）

- **目标**：在内置插件中补充缺失的 action，覆盖本地 Tauri 特有功能
- **webview 域需补的 action**：
  - `print` — R83 打印功能
  - `drag-enter/drag-over/drag-drop/drag-leave` — R72 拖拽 4 个反向事件
  - `new-window-request` — 新窗口请求反向事件
  - `page-begin/page-end` — 页面生命周期反向事件
  - `set-user-agent` — 自定义 UA
  - `create` 入参扩展：`clipboard` flag、`zoom_hotkeys` flag、`drag_drop_overlay` 配置
  - `close-window` — 由 `navigation-request` 路由（url.startsWith('close-window.invalid')）
  - `multiWindowAccess/allowWindowOpenMethod` — 随 new-window 落地
- **window 域需补的 action**：
  - `hide/show ability` — 应用级显隐（app-control 缺此 action，来源 3d7e5ab）
  - BlurModifier AttributeUpdater 动态刷新逻辑搬进 WindowPlugin.ets（来源 f2a4303）
- **clipboard 域需补的 action**：
  - 文本读写 — plugin-clipboard 当前只有 `write-image`，缺文本读写 action
- **文件列表**：
  - `crates/plugin-webview/src/lib.rs` — 补 request/response 类型 + facade
  - `plugins/webview/.../WebviewPlugin.ets` — 补 ArkTS 实现
  - `crates/plugin-app-control/src/lib.rs` — 补 hide/show action
  - `plugins/app-control/.../AppControlPlugin.ets` — 补 ArkTS 实现
  - `crates/plugin-clipboard/src/lib.rs` — 补文本读写 action
  - `plugins/clipboard/.../ClipboardPlugin.ets` — 补 ArkTS 实现
  - `crates/ability/src/bridge/mod.rs` — 如需扩展反向事件支持
- **依赖**：A0 完成
- **验证**：openharmony-ability demo 能触发所有新 action

### Phase A2: R75 https 拦截技术验证

- **目标**：验证新 bridge 模型能否支持 R75 https 拦截的同步 request/response 语义
- **技术挑战**：
  - 旧模型：thread_local registry + 同步阻塞 NAPI `dispatch_https_intercept`，在 `onInterceptRequest` 回调中同步返回 `WebResourceResponse`
  - 新模型：`on_bridge_sync_event` 是异步单向的，`BridgeMainThreadEvent` 的 `respond()` 必须在 env 失效前完成
  - 核心问题：能否在 `on_main_thread_event` 回调中，在 env 失效前同步执行 Rust 闭包并返回 `WebResourceResponse`
- **可能的方案（按优先级）**：
  1. **利用 `BridgeMainThreadEvent::respond()` 同步返回** — 如果 env 生命周期覆盖整个 `onInterceptRequest` 回调，这是最小改动方案
  2. **扩展 bridge 框架支持同步双向 dispatch** — 如果方案 1 不可行，需要在 bridge/mod.rs 中加同步请求/响应通道（增加 3-5 天工期）
  3. **降级为异步拦截 + 缓存** — 不走 bridge，保留旧模型散函数（在新架构中兼容旧 NAPI 导出），性能可能受影响
- **回退方案**：
  - 如果方案 1 和 2 都不可行，采用方案 3：R75 不走 bridge，保留 `dispatch_https_intercept` NAPI 散函数作为 bridge 框架的旁路
  - 这意味着 A2 不会成为 B3 的阻塞项——B3 可以直接使用旧的 NAPI 散函数
- **文件列表**：
  - `crates/ability/src/bridge/mod.rs` — 可能需要扩展
  - `crates/plugin-webview/src/lib.rs` — `set-https-intercept-handler` action
  - `plugins/webview/.../WebviewPlugin.ets` — `onInterceptRequest` 改造
- **依赖**：A0 完成
- **验证**：最小可运行 demo，https 请求被 Rust 侧拦截并返回自定义响应

### Phase A3: 自建插件

- **目标**：为新模型无内置插件的 3 个能力域创建成对插件
- **子任务**：
  - `ohos.global-shortcut`（~930 行）— forwarder thread + crossbeam + 60+ key code 映射 + inputConsumer API (API14+)
  - `ohos.deep-link`（~200 行）— 存储留 core app.rs（`INITIAL_WANT_URI`/`WANT_PARAMETERS` Mutex），插件读取层自建
  - `ohos.autostart`（~150 行）— autoStartupManager (API21+) + 设置页跳转
- **文件列表**：
  - `crates/plugin-global-shortcut/src/lib.rs` — Rust facade
  - `plugins/global-shortcut/.../*.ets` — ArkTS 实现
  - `crates/plugin-deep-link/src/lib.rs`
  - `plugins/deep-link/.../*.ets`
  - `crates/plugin-autostart/src/lib.rs`
  - `plugins/autostart/.../*.ets`
- **依赖**：A0 完成
- **验证**：各插件独立单元测试通过

### Phase B1: tao bridge 适配

- **目标**：将 tao 的 OHOS 后端从旧 API 迁移到 bridge API
- **改动点**：
  - `self.app.exit(0)` → `app-control` 插件 `terminate`
  - `self.app.set_color_mode(m)` → `app-control` 插件 `set-color-mode`
  - `self.app.display_width()` → `version` 插件或留 core
  - window ops (move/resize/min/max/...) → `plugin-window` 对应 action
  - monitor (refresh_rate/display_width/height) → 留 core（纯 Rust binding）
  - hide/show ability → `app-control` 插件新补的 action（来自 A1，**在 A1 完成前暂用 stub，A1 完成后接入**）
- **文件列表**：
  - `tao/src/platform_impl/ohos/mod.rs` — ~10 处调用点
  - `tao/Cargo.toml` — 依赖 openharmony-ability-plugin-*
- **依赖**：A0 完成（plugin-window/app-control facade 已存在）。**注意**：hide/show action 来自 A1，B1 可先做其他改动，hide/show 留 stub 等 A1 完成后接入
- **验证**：`cargo check` + 设备端窗口操作功能验证

### Phase B2: wry webview 改写

- **目标**：重写 wry 的 OHOS webview 后端，使用新 `plugin-webview` facade
- **关键改动**：
  - `pub type OhosWebviewHandle = Webview` → `WebviewHandle { id, runtime }`
  - ~20 个方法调用全部改为 bridge call（load_url, load_html, set_bounds, set_visible, set_background_color, set_zoom, reload, focus, evaluate_script, get_url, cookies, clear_browsing_data, set_cookie, snapshot, create_pdf, set_debugging_access, print 等）
  - WebView 反向回调从 Function 闭包改为 `on_main_thread_event` 分发（navigation-request, download-start, download-end, title-change, controller-attached 等）
  - WebViewBuilder 字段和方法签名更新
- **文件列表**：
  - `wry/src/ohos/mod.rs` — 重写 ~203 行
  - `wry/src/lib.rs` — webview 调用点更新（涉及 WebViewBuilder 字段、方法透传）
  - `wry/Cargo.toml` — 依赖调整
  - `wry/src/webview/mod.rs` — WebViewBuilder 签名变更（如有）
- **依赖**：A1 完成（plugin-webview facade 完整，含所有补全的 action）
- **验证**：`cargo check` + 设备端 webview 功能验证（load_url/evaluate_script/navigation/download/title/...）
- **注意**：这是 all-or-nothing 迁移——类型一换全部编译失败，无法分 action 逐步验证。必须整体改完能编译才是一个验证点

### Phase B3: wry https 拦截

- **目标**：将 wry 的 https 拦截功能迁移到 A2 确定的方案
- **文件列表**：
  - `wry/src/ohos/mod.rs` — https 拦截改造
- **依赖**：A2 完成（如果 A2 选择回退方案 3，B3 直接使用旧 NAPI 散函数，不需要等 bridge 方案）
- **验证**：设备端 https 请求拦截验证

### Phase B4: tray-icon/muda bridge 适配

- **目标**：将 tray-icon 和 muda 的 OHOS 后端迁移到 bridge API
- **改动点**：
  - tray-icon：改调 `plugin-statusbar` 的 add/remove/update-icon/update-menu/update-tips + icon-click/menu-click 反向事件
  - muda：改调 `plugin-menu` 的 set-menubar/popup/set-menubar-visible + menu-click 反向事件 + predefined-action
- **文件列表**：
  - `tray-icon/src/platform_impl/ohos.rs`
  - `muda/src/platform_impl/ohos.rs`
  - `tray-icon/Cargo.toml` / `muda/Cargo.toml`
- **依赖**：A0 完成（plugin-menu/statusbar facade 已存在）
- **验证**：`cargo check` + 设备端托盘/菜单功能验证

### Phase B5: tauri 集成 + 全量回归

- **目标**：整合所有改动，确保 tauri 全家桶在 OHOS 上正常工作
- **改动点**：
  - workspace 依赖更新
  - OHOS cfg 下的集成代码
  - plugins-workspace 适配（opener/window-state 等既有 mobile 适配缺口）
  - global-shortcut/deep-link/autostart 插件注册（ArkTS 侧 EntryAbility.bridgePlugins 数组）
  - **留 core 项功能回归**（见下）
- **留 core 项验证清单**：
  | 能力域 | 验证方式 |
  |--------|---------|
  | monitor refresh_rate/display_width/display_height | 设备端读取值，确认非零 |
  | monitor_from_point / MonitorHandle::size | 设备端调用，确认返回正确 |
  | mouse event / hover / scroll wheel | 设备端鼠标操作验证 |
  | pinch scale / input source | 设备端捏合手势验证 |
  | cursor position (AtomicU64) | 设备端光标位置验证 |
  | key repeat test overlay | 设备端按键长按验证 |
  | R136 Start→Resumed / R135 SaveState | 设备端生命周期验证 |
  | R82/R91 ArkTS onKeyPreIme 拦截 | 设备端 Ctrl+C/V/+/-/0 拦截验证 |
  | napi_reference_unref crash 修复 | 设备端稳定性验证 |
  | ProxyJsHelper objectAssign | 代码审查确认保留 |
  | onCloseWindow + notify_window_close | 设备端窗口关闭验证 |
  | evaluate_script off-by-one | 代码审查确认保留 |
- **文件列表**：
  - `tauri/Cargo.toml` — 依赖更新
  - `tauri/src/...` — 集成代码
  - `plugins-workspace/...` — 插件适配
  - 测试文件
- **依赖**：A2 结论确认 + A3 完成 + B1-B4 全部完成
- **验证**：全量测试回归通过 + 留 core 项逐项功能验证通过

## 工作量估算

| Track | 工作量 | 说明 |
|-------|--------|------|
| Track A (A0-A3) | 22-33 天 | 基础设施层（含 A2 扩展到 2-4 天） |
| Track B (B1-B5) | 19-28 天 | 消费方适配（含 B2 扩展到 8-12 天） |
| 验证穿插 | 7-12 天 | 分阶段验证（已含在 Phase 估算中） |
| **总计** | **48-73 天** | 单人全职 |

## 关键风险

1. **R75 https 拦截**（Phase A2）— 同步语义与新模型异步单向事件冲突，可能需要扩展 bridge 框架。已有 3 级回退方案
2. **global_shortcut 自建**（Phase A3）— 930 行 + forwarder 架构重设计
3. **wry all-or-nothing**（Phase B2）— Webview 类型一换全部编译失败，无法分 action 逐步验证
4. **tray-icon/muda 独立仓库**— 消费方改动容易被遗漏

## 审计记录

### 2026-08-12 初次审计

修正了 7 项遗漏 + 1 项依赖错误：

| 编号 | 修正项 | 修正内容 |
|------|--------|---------|
| W1 | A1 补充 window/clipboard 域 | 新增 app-control hide/show、clipboard 文本读写、close-window、multiWindowAccess |
| W2 | B5 补充留 core 项回归 | 新增 12 项留 core 功能的验证清单 |
| W3 | A0 补充 ArkHelper.ets 处置 | 明确 merge 后检查废弃状态，废弃则搬迁到新 plugin |
| W4 | A2 估算修正 | 1-2 天 → 2-4 天 |
| W5 | A2 补充回退方案 | 3 级回退：respond() 同步返回 → 扩展 bridge → 保留旧 NAPI 散函数 |
| W6 | B2 估算修正 | 6-10 天 → 8-12 天 |
| W7 | A0 补充 merge 顺序验证 | 两种方案 `--no-commit` 试跑，选冲突少的 |
| E1 | B5 依赖条件补全 | 新增 A2 结论确认作为 B5 前置依赖 |

### 2026-08-12 二次审计

| 编号 | 审计项 | 结果 |
|------|--------|------|
| 修正验证 | W1-W7 + E1 全部正确应用 | ✅ |
| 工作量一致性 | Track A/B 各 Phase 相加与汇总表一致 | ✅ |
| B1 依赖精确化 | hide/show 来自 A1，B1 先用 stub 后接入 | ✅ 已修正 |
| A1/A2 文件冲突 | 两者都改 WebviewPlugin.ets 和 plugin-webview/src/lib.rs，但改不同 action，不冲突 | ✅ 无风险 |
| B3 回退依赖 | A2 选择方案 3 时 B3 不阻塞，描述正确 | ✅ |
