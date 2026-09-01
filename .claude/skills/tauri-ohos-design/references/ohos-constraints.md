# OHOS 适配通用约束

> 本文档是 Tauri OpenHarmony 适配的完整约束参考，自包含于 Skill 体系中。
> 修改 OHOS 相关代码前必须先阅读并遵守这些规则。

---

## 1. 通用架构约束

### 1.1 cfg 隔离规则

| 规则 | 说明 |
|------|------|
| `cfg(target_env = "ohos")` 是所有设备形态通用 | 不要滥用。OHOS 上的 desktop/mobile 差异用 `cfg(all(target_env = "ohos", desktop))` / `cfg(all(target_env = "ohos", mobile))` |
| `cfg(desktop)` 由 `OHOS_DEVICE_TYPE=desktop` 控制 | 包含 tray/menu bar。`cfg(mobile)` 不含 tray/menu |
| 功能在 desktop+mobile 都可用时用 `ohos` cfg | 仅 desktop, 用 `ohos+desktop` |

### 1.2 线程模型：Chrome_IOThread 是 event loop

| 规则 | 说明 |
|------|------|
| **禁止** `run_on_main_thread + rx.recv()` 阻塞模式 | 会死锁： Chrome_IOThread 等 ArkTS 主线程, ArkTS 主线程等 Chrome_IOThread |
| 所有跨线程 NAPI 操作必须用 **TSFN NonBlocking** | `run_on_main_thread` 调度到 Chrome_IOThread (非 ArkTS 主线程), 阻塞 recv 会死锁 |
| Mutex 不得跨越阻塞 I/O 操作持有 | `Arc<Mutex<&'static F>>` 必须 copy 后立即 release: `let cb = *cbs.lock().unwrap(); cb(...);` |
| TrayIcon 是 Sync+Send, 无主线程限制 | tray 操作通过 TSFN 内部处理线程安全, 不限制调用线程 |

### 1.3 Menu 是纯 Rust 数据 + JSON, 不是原生 OS menu

| 规则 | 说明 |
|------|------|
| Menu items 是 Rust `MenuChild` 结构, 通过 JSON 推送到 ArkTS | OHOS 无原生 menubar API (无 HMENU / GTK menu)。整个 menu 系统是自定义实现 |
| 动态更新 (setText/setEnabled) 需要 `refresh_menubar()` | 重新序列化完整 JSON + TSFN 推送。无增量更新机制 |
| Menu 图标通过 **base64 PNG** 编码在 JSON 中 | ArkTS 侧解码为 PixelMap。必须追踪并释放过期 PixelMap (`cleanupStaleIcons`) |
| Menu 文本 `&` (mnemonic) 被静默移除 | `"Save &As"` → `"Save As"`。OHOS 不支持键盘 mnemonic |

### 1.4 Tray 使用 StatusBar API, 不是系统 tray

| 规则 | 说明 |
|------|------|
| Tray icon 通过 `statusBarManager.addToStatusBar()` 实现 | OHOS 无传统系统 tray (Notification Area)。使用桌面扩展 API (`@kit.DeskTopExtensionKit`) |
| Tray 仅在 desktop 模式可用 | mobile 设备无 tray 功能 |
| Tray `rect()` 始终返回 None | StatusBar API 不提供图标位置/尺寸。`AvoidArea.topRect` 返回整个状态栏区域, 不是单个图标 |
| Tray 事件数据有限 | 只有 `iconClickType` ("leftClick"/"rightClick") 和 `menuCode`。无坐标、无双击、无 hover、无中键 |

### 1.5 tao OHOS 层 ExternalError 错误转换限制

| 规则 | 说明 |
|------|------|
| `ExternalError` 无 `From<String>` | tao 的 `ExternalError` 仅 `NotSupported(NotSupportedError)` / `Os(OsError)` 两变体，OHOS `OsError` 是 unit struct（`pub struct OsError;`）不携带消息字符串。**不能** `ExternalError::from(e.to_string())` 编译 |
| ability 函数失败只能 `warn! + NotSupported` | tao OHOS 层调 `openharmony_ability::xxx()` 失败时，用 `warn!` 记录错误详情（`{:?}`），返回 `ExternalError::NotSupported(NotSupportedError::new())`（唯一可用变体） |
| 匹配文件 idiom | 对齐 `set_focus`/`set_focusable`/`set_decorations` 等：`warn!` 记录 + 静默/返回默认值，不携带具体错误消息到上层 |
| Err 仅表示桥接未就绪 | TSFN fire-and-forget 函数（`set_window_blur`/`set_window_touchable` 等）返回 Err 仅当 TSFN 未初始化或 call status 非 Ok（init/编程错误），**不是** 1300002/1300003 运行时失败 — 那些 Promise reject 在 ArkTS `.catch` 捕获、不反向通知 Rust |

> 来源：ohos-window-ignore-cursor-events Phase 2 实现期审计（design D4 原写的 `ExternalError::from(e.to_string())` 无法编译）。

---

## 2. NAPI / TSFN 规则

### 2.1 napi-derive-ohos 自动 camelCase 转换

- **Rust `#[napi]` 函数名 snake_case → JS camelCase**。如 `emit_menu_event` → `emitMenuEvent`, `on_popup_request` → `onPopupRequest`
- ArkTS 代码必须使用 **camelCase** 名称调用 napi 函数
- 如需保留原名, 必须用 `#[napi(js_name = "original_name")]`
- 使用 snake_case 会导致 `typeof module.on_popup_request !== "function"` 返回 `true` (函数实际名为 `onPopupRequest`), **静默失败不报错**
- **`napi_ohos::Result<T, S>` 的 `S` 是 Error 载荷类型, 不是自由错误类型**: 本仓 napi-ohos 版本定义为 `pub type Result<T, S = Status> = std::result::Result<T, Error<S>>` 且 `Error<S: AsRef<str>>`。要返回自定义错误枚举必须显式写 `std::result::Result<T, MyError>`;误写 `Result<T, MyError>` 会要求 `MyError: AsRef<str>`, 产生十余个 E0277/E0308 编译错误(p1-cursor-grab 踩坑, 见 `openharmony-ability/crates/ability/src/window/mod.rs` 的 `CursorGrabError`)

### 2.2 TSFN 参数传递规则

| 规则 | 说明 |
|------|------|
| TSFN 回调必须返回 **参数元组**, 不是 `Result<()>` | 返回 `()` = 空 JS 参数 (全部 `undefined`)。返回 `FnArgs { data: (arg1, arg2) }` |
| **禁止** 使用 `callee_handled::<true>()` | napi-ohos 在 `CalleeHandled=true` 时自动在首位插入 `null`, 导致参数偏移。必须用 `callee_handled::<false>()` |
| 裸 tuple 类型会序列化为 JS Array | 必须用 `FnArgs<>` 包装 tuple, 否则 JS 函数收到数组而非展开参数 |
| **`Function::call` 也有同样 bug** | `func.call((arg1, arg2))` 裸 tuple 走通用 impl 只传 1 个参数。必须 `Function<'_, FnArgs<(T1,T2)>, R>` + `func.call(FnArgs { data: (arg1, arg2) })`。p1-window-vibrancy 的 set_window_blur 因此从未工作过 |
| TSFN 数据必须通过泛型参数携带, 不是全局 Mutex | 全局 `Mutex<Option<Data>>` 中转模式在快速连续调用时产生数据竞态, 导致 freeze。每个 TSFN 调用独立 Box 入队, 天然隔离 |

### 2.3 NAPI 上下文限制

| 规则 | 说明 |
|------|------|
| `Function::call()` 在 `render()` 上下文中静默失败 | 不抛错、不执行。必须用 `Object::set()` 设置属性, 让 JS 侧延迟读取 |
| `statusBarManager.on()` 必须在 `addToStatusBar` 之后 200ms 注册 | OHOS 内部 `ScbServerReceiver` 在 `addToStatusBar` 后异步初始化。提前注册的 handler 被静默丢弃 |
| NAPI `Env` 只在获取它的线程有效 | `MAIN_THREAD_ENV` 存储在 `thread_local!` 中, 其他线程调用 `get_main_thread_env()` 返回 `None` |
| `ObjectRef` (napi_ref) 不是 Send/Sync | 必须通过 `Mutex<SendableHelper>` + `ptr::read` 跨线程共享, `unsafe impl Send/Sync` |
| **hilog 在 NAPI 回调上下文抛 Argc mismatch** | 被 Rust NAPI `func.call` 调的 ArkTS 函数内部用 `hilog.info`/`hilog.error` 会抛 `"assertion (false) failed: Argc mismatch"`（疑 NAPI 重入限制）。异常被 catch 吞成 `failed: {}`。被 NAPI 调的函数内部禁用 hilog；纯 ArkTS 调用链（如 registerController）里 hilog 正常 |

---

## 3. 构建与环境规则

### 3.1 构建环境

| 规则 | 说明 |
|------|------|
| 使用 **Git Bash** 运行构建脚本 | PowerShell/cmd.exe 不兼容 Unix 路径格式 (sed, bash 特性) |
| Rust 交叉编译需要 OHOS clang/sysroot | `CC=clang.exe`, `CFLAGS=--target=aarch64-linux-ohos --sysroot=... -D__MUSL__`, `AR=llvm-ar.exe`, linker=clang.exe |
| 必须使用 `--features prod` 构建标志 | 不加则 app 连接 localhost:1420, 无法加载打包前端 |
| `OHOS_NDK_HOME` 路径不带 `/native` 后缀 | `D:/app/DevEco-Studio/sdk/default/openharmony` (不是 `.../native`) |
| `hdc` 命令中设备路径必须加引号 | Git Bash 会将 `/data/...` 转为 Windows 路径。用 `hdc shell "cat /data/..."` |

### 3.2 HAR 包管理

| 规则 | 说明 |
|------|------|
| 修改 `openharmony-ability` ArkTS 源码后必须重建 HAR | `ohrs build --arch arm64` + `pack.bat`（含 tar 打 har）；改 Rust 源码跳过，直接 `cargo tauri ohos build` |
| 严禁手动 `ohpm install` | cargo tauri ohos build/run 内部自动同步；手动会删 lock/junction/本地包 |
| HAR 重建后 HAP 也必须重建 | ArkTS 代码变更 → HAR → HAP 全链重建 |

### 3.3 签名与部署

| 规则 | 说明 |
|------|------|
| 每次构建生成新的 debug 证书 | 必须先卸载旧版 (`bm uninstall`) 再安装新版 |
| 卸载会清除所有应用数据 | 不适合持久化数据的生产测试 |
| `hvigorw` 需要通过 `cmd.exe /c` 运行 | PowerShell 直接运行可能失败 |
| `hvigorw` 需要 `JAVA_HOME` 和 `DEVECO_SDK_HOME` 环境变量 | 签名步骤需要 Java (`spawn java ENOENT`) |
| `tauriPlugin` 在独立构建时必须禁用 | hvigorfile.ts 中的 tauriPlugin 需要 TCP 回调 tauri CLI |

### 3.4 日志规则

| 规则 | 说明 |
|------|------|
| `log::*!` + `Stdout` target 在 OHOS 上不可见 | stdout 不连接 hilog。必须用 `hilog` crate 或 `TargetKind::Stderr` |
| ArkTS `console.error` 在某些上下文不输出到 hilog | 需要 `hilog` crate 直接写入, 或确认 `console` 在当前上下文可用 |

---

## 4. ArkTS 框架约束

### 4.1 @Builder 上下文

| 规则 | 说明 |
|------|------|
| 模块级 `@Builder function` 没有 `this` 上下文 | 全局 `@Builder` 无法访问组件实例属性和方法。只有 `@Component` 内的 `private @Builder` 方法才有 `this` |
| 递归 `@Builder`（如子菜单渲染）必须在 `@Component` 内 | 模块级 `@Builder` 调用其他 `@Builder` 时, `this` 为 `undefined`, 导致 `TypeError`。这是 menu Phase 4→6→9 三次方案演进的根本原因 |
| WebView 事件必须在 `@Builder` 内 pre-build 注册 | ArkUI 约束: 事件回调不能在 `@Builder` 外部动态绑定。所有 `onLoadIntercept`、`onPageBegin` 等必须在构建时注册 |
| **`BuilderNode.update` 不刷新组件属性** | `.backdropBlur(data.style.blurRadius)` 等属性在 update 时不重新求值。build 时通过 `addWebview` 注入值；**运行时刷新用 `AttributeUpdater`**：`modifier.attribute?.backdropBlur(radius)` 立即触发组件更新（不需 @State, 适合 @Builder/BuilderNode）。vibrancy BlurModifier 用此机制刷新 backdropBlur/backgroundColor |

### 4.2 语义反转

| 规则 | 说明 |
|------|------|
| `onLoadIntercept` 返回值语义与 Tauri `on_navigation` 相反 | OHOS: `true` = 拦截（阻止导航）, `false` = 允许。Tauri: `true` = 允许, `false` = 阻止。ArkTS 层必须 `!ret` 反转 |

### 4.3 异步竞态

| 规则 | 说明 |
|------|------|
| Rust 创建窗口可能早于 ArkTS controller 就绪 | 必须用 `ProxyJsHelper` 代理模式: 缓存操作 → controller 就绪后回放。`WindowManager` 三级队列: `pendingInits` / `pendingJsHelperProxies` / `pendingUrls` |
| `setColorMode` 必须异步调用 | `setColorMode` 同步触发 `onConfigurationUpdate` 回调 → 回调 Rust → 主线程死锁。必须 `setTimeout(() => setColorMode(), 0)` 延迟到下一事件循环 |
| 多窗口状态隔离: `AppStorage` 是全局的 | `MainPage` 用 `@StorageProp`（全局 `AppStorage`）, `FloatPage` 用 `@LocalStorageProp`（per-window 隔离）。全局状态（如菜单 JSON）必须带 `windowId` 键 |

---

## 5. cfg 模式参考

以下是 OHOS 适配中常用的 `cfg` 组合模式:

### 5.1 OHOS 特有

| 模式 | 语义 | 示例用途 |
|------|------|---------|
| `cfg(target_env = "ohos")` | 所有 OHOS 设备形态 | OHOS 平台实现代码 |
| `cfg(all(target_env = "ohos", desktop))` | OHOS 桌面设备 | tray/menu bar |
| `cfg(all(target_env = "ohos", mobile))` | OHOS 移动设备 | 移动端特有逻辑 |
| `cfg(any(mobile, target_env = "ohos"))` | 移动设备 **或** OHOS | 需要同时覆盖原生移动和 OHOS 的代码 |

### 5.2 排除 OHOS

| 模式 | 语义 | 示例用途 |
|------|------|---------|
| `cfg(not(target_env = "ohos"))` | 所有平台除了 OHOS | 非 OHOS 的默认实现 |
| `cfg(all(target_os = "linux", not(target_env = "ohos")))` | 真正的 Linux（不是 OHOS） | Linux 依赖排除（因为 OHOS 的 target_os 是 "linux"） |
| `cfg(all(any(linux, BSDs), not(target_env = "ohos")))` | Unix/GTK（不是 OHOS） | GTK 依赖排除 |
| `cfg(all(desktop, not(target_env = "ohos")))` | 桌面平台（不是 OHOS） | 原生桌面功能 |
| `cfg(all(test, not(target_env = "ohos")))` | 测试（排除 OHOS） | tauri crate 中依赖 mock_runtime 的测试 |

### 5.3 跨平台组合

| 模式 | 语义 | 示例用途 |
|------|------|---------|
| `cfg(not(any(android, ios, ohos)))` | 非移动平台 | 桌面专用功能 |
| `cfg(any(android, ios, ohos))` | 所有移动平台 | 移动通用代码 |
| `cfg(any(macos, ohos))` | macOS 或 OHOS | 共享行为（如 muda 图标处理） |

### 5.4 重要注意事项

| 规则 | 说明 |
|------|------|
| OHOS 的 `target_os` 是 `"linux"` | 所有 Linux 依赖必须加 `not(target_env = "ohos")` 排除 |
| OHOS 不自动是 `mobile` | `desktop`/`mobile` 由 `OHOS_DEVICE_TYPE` 环境变量编译时决定 |
| tauri crate 测试在 OHOS 上排除 | 因为 `mock_runtime` 依赖 tao EventLoop（desktop-only） |
| OHOS 特有测试只在 openharmony-ability 内 | 使用 `cfg(all(test, target_env = "ohos"))` |

---

## 6. API 版本管理

OHOS 平台存在多版本 API（OpenHarmony 底座 + HarmonyOS 发行版），使用高版本 API 时必须添加版本守卫，确保低版本设备不会崩溃。

### 6.1 三个版本检测 API

```rust
use openharmony_ability::version;

version::sdk_api_version()           // OpenHarmony 底座 API Level（12, 14, 20...）
version::distribution_api_version()  // HarmonyOS 发行版 API 版本（50000, 50001, 60000...）
version::can_i_use("SystemCapability.xxx")  // 设备硬件能力检测
```

### 6.2 选择哪个 API？

| API 文档标注 | 使用 | 示例 |
|-------------|------|------|
| `openharmony/` 模块 + `since N` | `sdk_api_version() >= N` | `@ohos.multimedia.image` |
| `hms/` 模块 + `since 5.0.1(13)` | `distribution_api_version() >= 50001` | `@hms.core.xxx` |
| `SystemCapability.xxx` | `can_i_use("SystemCapability.xxx")` | NFC、传感器、摄像头 |

### 6.3 降级模式速查

| 模式 | 说明 | 示例 |
|------|------|------|
| 静默跳过 | 版本不满足时直接跳过，不写 else，不打日志 | 视觉效果、增强功能 |
| 函数降级 | 新旧 API 都有实现 | `activate_v2()` vs `activate()` |
| 强制回退值 | 返回安全的默认值 | 主题回退为 Light |
| 参数覆写 | 修改参数使功能安全降级 | 低版本强制不透明 |
| canIUse + 版本号 | 先硬件能力，后软件版本 | 定位服务 |

### 6.4 关键规则

| 规则 | 说明 |
|------|------|
| **tauri api demo 默认 API 版本为 12** | 应用 `compileSdkVersion` / `compatibleSdkVersion` 配置为 API 12（最低版本）。使用 > 12 的 API 必须加版本守卫，否则低版本设备崩溃 |
| **版本隔离是底层仓的职责** | 给 tao/wry/muda/openharmony-ability 内部使用，不是给应用开发者用的 |
| **静默跳过是默认策略** | 与 Windows/macOS 一致：不满足条件时直接跳过，不写 else 分支，不打日志 |
| **区分版本体系** | OpenHarmony 接口用 `sdk_api_version()`，HarmonyOS 专有用 `distribution_api_version()`，不要混用 |
| **组合检查先硬件后软件** | 先 `can_i_use()`，后版本号 |
| **ArkTS 侧也有版本守卫** | `deviceInfo.sdkApiVersion` / `deviceInfo.distributionOSApiVersion` / `canIUse()` |

### 6.5 完整参考

详细的决策矩阵、版本号计算、6 种降级模式的代码示例（含 Windows/macOS 真实参考），参见 [ohos-version-isolation Skill](../../ohos-version-isolation/SKILL.md)。

---

## 7. 测试约束

### 7.1 Rust 单元测试

| 规则 | 说明 |
|------|------|
| tauri crate 的 `mock_runtime` 在 OHOS 上不可用 | 依赖 `tao::event_loop::EventLoop`（desktop-only）。模块用 `not(target_env = "ohos")` 排除 |
| OHOS UT 只能测纯函数 | 不能依赖 `AppHandle`、`mock_app()`、`mock_builder()`。提取不依赖运行时的逻辑为独立函数 |
| 设备上 `--test-threads=1` | 设备端不支持并行测试执行 |
| `OnceLock` 语义: 只能设置一次 | `crate::ohos::BASE_PATH` 等 `OnceLock` 变量在测试进程中只能初始化一次 |

### 7.2 前端测试

| 规则 | 说明 |
|------|------|
| 每个测试 5 秒超时 | `TEST_TIMEOUT_MS = 5000`。防止 API stub 导致无限挂起 |
| 测试分类: `auto` / `side-effect` / `manual` | `auto`: 可断言; `side-effect`: 有副作用但可验证; `manual`: 需人工确认 |
| 不支持的 plugin 用 `cfg(not(target_env = "ohos"))` 排除 | JS 侧用动态 `import()` 防止加载失败阻塞其他测试 |
