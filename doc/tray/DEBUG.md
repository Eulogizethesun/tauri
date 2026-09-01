# Tray 模块 OHOS 适配问题修复记录

> 本文档记录 tray 模块 OHOS 适配过程中发现和修复的所有问题，按修复顺序排列。

---

## Fix 1: `run_item_main_thread!` 宏 OHOS 分支恢复

**问题**：`menu/mod.rs` 中的 `run_item_main_thread!` 宏被错误修改，添加了未提交的 OHOS 分支。

**根因**：Menu 模块的 OHOS 实现是纯 Rust 数据结构，直接执行完全安全，不需要特殊处理。

**修复**：恢复宏的原始实现（`run_on_main_thread + channel`），移除未提交的 OHOS 分支。

**文件**：`crates/tauri/src/menu/mod.rs`

---

## Fix 2: `build_inner` 死锁修复

**问题**：`tray/mod.rs` 中的 `build_inner` 方法在 OHOS 上调用 `run_on_main_thread + channel` 导致死锁。

**根因**：OHOS 的 event loop 运行在 Chrome_IOThread 上，不是 ArkTS 主线程。`run_on_main_thread` → `send_user_message` → `proxy.send_event()` → event loop 处理，仍在 Chrome_IOThread 执行。

**修复**：改用 ThreadsafeFunction 确保回调在 ArkTS 主线程执行。

**文件**：`crates/tauri/src/tray/mod.rs`

---

## Fix 3: ThreadsafeFunction 基础设施实现

**问题**：tray-icon OHOS 实现调用 `openharmony_ability::statusbar::*`，内部有 NAPI 操作（`Uint8Array::new()`），必须在 ArkTS 主线程执行。

**修复**：
- 在 `statusbar/manager.rs` 中添加 5 个 ThreadsafeFunction 全局变量
- 在 `helper/mod.rs` 的 `set_helper` 中调用 `init_tray_tsfn()` 初始化
- 在 `tray/mod.rs` 中为 `build_inner`、`set_icon`、`set_menu`、`set_tooltip`、`set_visible`、`set_title`、`rect` 添加 `#[cfg(target_env = "ohos")]` 分支直接调用 TSFN

**文件**：
- `openharmony-ability/crates/ability/src/statusbar/manager.rs`
- `openharmony-ability/crates/ability/src/helper/mod.rs`
- `crates/tauri/src/tray/mod.rs`

---

## Fix 4: ArkTS 菜单 API 兼容性修复

**问题**：本地 `openharmony-ability/package` 中的 menu 代码使用了 SDK 5.0.0(12) 中不存在的 API。

**根因**：代码引用了更高版本 SDK 才有的类型和组件。

**修复**：
| 错误引用 | 位置 | 正确替代 |
|---------|------|---------|
| `SymbolGlyphOptions` | `menu_types.ets:41-42` | `SymbolGlyphModifier` (API 12+) |
| `MenuDivider()` | `menu.ets:94,138` | `MenuItemGroup({ header: '' }) { MenuItem... }` |
| `MenuItemType.Check` | `menu.ets:108,151` | `.selected().selectIcon(true)` |

**文件**：
- `openharmony-ability/native_ability/src/main/ets/helper/menu_types.ets`
- `openharmony-ability/native_ability/src/main/ets/helper/menu.ets`

---

## Fix 5: 本地 HAR 包依赖配置

**问题**：Tauri demo 项目默认依赖 `@ohos-rs/ability: "0.4.0-beta.7"`（从 ohpm 中心仓下载），不包含 tray 相关的 ArkTS helper 方法。

**修复**：
1. 构建本地 HAR 包：`pack.bat` → `tar -czf ability.har package`
2. 修改 `entry/oh-package.json5`：
   ```json5
   {
     "dependencies": {
       "libentry.so": "file:./src/main/cpp/types/libentry",
       "@ohos-rs/ability": "file:../../../../../../../openharmony-ability/ability.har"
     }
   }
   ```
3. 同步更新模板：`tauri-cli/templates/mobile/open-harmony/entry/oh-package.json5`

**文件**：
- `tauri/examples/api/src-tauri/gen/ohos/entry/oh-package.json5`
- `tauri/crates/tauri-cli/templates/mobile/open-harmony/entry/oh-package.json5`

---

## Fix 6: TSFN 回调参数传递修复

**问题**：初次实现 TSFN 时，回调返回 `Result<()>`，导致传给 ArkTS 函数的参数是**空元组**，所有参数都是 `undefined`。

**根因**：查看 `napi-ohos` 源码 `threadsafe_function.rs` 第 740-747 行：
```rust
let ret = val.and_then(|v| {
    (callback)(ThreadsafeCallContext { env, value: v.data })
        .and_then(|ret| Ok((ret.into_vec(raw_env)?, ...)))
```
TSFN 的 `callee_handled` 回调**返回值会被转换成 JS 函数的参数**。返回 `()` 意味着空参数。

**修复**：让回调直接返回参数元组，让 TSFN 自动调用 JS 函数：
```rust
// 错误：返回 ()，JS 函数收到 undefined 参数
.build_callback(move |_ctx: ThreadsafeCallContext<()>| {
    call_add_to_status_bar()  // 返回 Result<()>
})?;

// 正确：返回参数元组，TSFN 自动调用 JS 函数
.build_callback(move |ctx: ThreadsafeCallContext<()>| {
    build_add_to_status_bar_args(ctx.env)  // 返回 Result<(Object, f64, Object, ...)>
})?;
```

**文件**：`openharmony-ability/crates/ability/src/statusbar/manager.rs`

---

## Fix 7: TSFN 类型定义更新

**问题**：由于回调返回类型改变，TSFN 静态变量类型也需要更新。

**修复**：
```rust
type TrayTsfnAdd = ThreadsafeFunction<
    (),
    (),
    (Object<'static>, f64, Object<'static>, Option<Vec<Vec<Object<'static>>>>, Option<String>),
>;
type TrayTsfnUpdateIcon = ThreadsafeFunction<(), (), (Object<'static>, u32)>;
type TrayTsfnUpdateMenu = ThreadsafeFunction<(), (), (Vec<Vec<Object<'static>>>,)>;
type TrayTsfnUpdateTips = ThreadsafeFunction<(), (), (String,)>;
```

**文件**：`openharmony-ability/crates/ability/src/statusbar/manager.rs`

---

## Fix 8: abilityName 获取方式修复

**问题**：初次尝试使用 `context.elementName.abilityName` 获取 ability 名称，但 `elementName` 在 SDK 5.0.0(12) 的 `UIAbilityContext` 上不存在。

**修复**：`Want.abilityName` 在 SDK 5.0.0(12) 中直接可用：
```typescript
// NativeAbility.ets
async onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): Promise<void> {
    setCurrentAbilityName(want.abilityName ?? "");
    // ...
}
```

**文件**：`openharmony-ability/native_ability/src/main/ets/ability/NativeAbility.ets`

---

## Fix 9: ArkTS 侧 abilityName 补充

**问题**：Rust 侧通过 TSFN 调用 `addToStatusBarWithRgba` 时，如果 `quickOperation.abilityName` 为空字符串，OHOS 系统校验会失败（Error code: 401）。

**修复**：在 `DefaultXComponent.ets` 的 `addToStatusBarWithRgba` 中，如果 Rust 侧传的 `quickOperation.abilityName` 为空，则使用全局存储的值：
```typescript
addToStatusBarWithRgba: (iconsRgba, iconSize, quickOperation, ...) => {
    if (!quickOperation.abilityName || quickOperation.abilityName === '') {
        quickOperation.abilityName = currentAbilityName;
    }
    statusBarManager.addToStatusBar(context, { ... });
}
```

**文件**：`openharmony-ability/native_ability/src/main/ets/components/DefaultXComponent.ets`

> **桥接迁移后更正（2026-08-13 device 验证）**：本条所述「空 `quickOperation.abilityName` → 401」**已证伪**。桥接迁移用 `StatusbarPlugin.ets` 取代 `DefaultXComponent.ets` 后，example app 的 `quick_operation.ability_name` = `"TestTrayAbility"`（非空），故空串场景未触发；即便 `??` vs `||` 行为一致，401 依旧。真正 401 根因是 `menu_json` 内层 `subMenu: null`（present-but-null 而非 absent），见 spec §7.3。legacy 路径此处的 abilityName 回退填充**保留**（语义无害），但非 401 原因。

---

## Fix 10: `build_menu_item_object_static` 函数实现

**问题**：TSFN 回调需要在主线程上构建菜单项对象，但原有的 `build_menu_item_object` 使用了生命周期参数 `'a`，无法返回 `'static` 对象。

**修复**：创建新的 `build_menu_item_object_static` 函数，专门用于 TSFN 回调中构建 `Object<'static>` 类型的菜单项对象。

**文件**：`openharmony-ability/crates/ability/src/statusbar/manager.rs`

---

## Fix 11: TSFN `callee_handled` 参数偏移修复

**问题**：`iconsRgba` 参数为 `null`，导致 ArkTS 侧 `Cannot read property white of null` 崩溃。

**根因**：查看 `napi-ohos` 源码 `threadsafe_function.rs` 第 759-762 行：
```rust
let args: Vec<sys::napi_value> = if CalleeHandled {
    let mut js_null = ptr::null_mut();
    unsafe { sys::napi_get_null(raw_env, &mut js_null) };
    core::iter::once(js_null).chain(values).collect()
} else {
    values
};
```
当 `CalleeHandled = true` 时，napi-ohos 会在 callback 返回值前自动插入一个 `null` 作为第一个参数（用于传递 Error）。这导致 JS 函数收到的参数整体右移一位，第一个参数变成 `null`。

**修复**：将所有 TSFN 的 `callee_handled::<true>()` 改为 `callee_handled::<false>()`，同时更新类型定义显式指定第 5 个泛型参数为 `false`：
```rust
type TrayTsfnAdd = ThreadsafeFunction<
    (),
    (),
    FnArgs<(Object<'static>, f64, Object<'static>, Option<Vec<Vec<Object<'static>>>>, Option<String>)>,
    Status,
    false,  // CalleeHandled = false
>;
```

同时使用 `FnArgs<>` 包装 tuple，因为裸 tuple 的 `ToNapiValue` 实现会将其序列化为 JS Array 而不是展开为独立参数。

**文件**：`openharmony-ability/crates/ability/src/statusbar/manager.rs`

---

## Fix 12: OHOS SDK 参数校验修复（statusBarGroupMenu / hoverTips）

**问题**：连续 3 次崩溃，原因分别是：
1. `Cannot read property abilityName of undefined` — `quickOperation` 为 `undefined`
2. `Cannot read property length of null` — `statusBarGroupMenu` 为 `undefined`，SDK 内部调用 `.length`
3. `The string length exceeds the threshold` — `hoverTips` 超长或为空字符串

**根因**：Rust 侧 `Option<T>` 为 `None` 时序列化为 JS `undefined`，但 OHOS `statusBarManager.addToStatusBar` 内部校验不兼容 `undefined`。

**修复**：在 ArkTS 侧提供安全默认值：
```typescript
addToStatusBarWithRgba: (iconsRgba, iconSize, quickOperation, statusBarGroupMenu?, hoverTips?) => {
    // 空图标直接返回
    if (Object.keys(icons).length === 0) return;

    // 构建参数对象，仅在有值时添加 hoverTips
    const opts: ESObject = {
        icons: icons,
        quickOperation: quickOperation,
        statusBarGroupMenu: statusBarGroupMenu ?? []
    };
    if (hoverTips && hoverTips.length > 0 && hoverTips.length <= 128) {
        opts.hoverTips = hoverTips;
    }
    statusBarManager.addToStatusBar(context, opts);
}
```

**文件**：`openharmony-ability/native_ability/src/main/ets/components/DefaultXComponent.ets`

---

## Fix 13: OHOS SDK 频率限制修复

**问题**：`removeFromStatusBar` 调用时报错 `The API is being called too frequently`。

**根因**：OHOS SDK 对状态栏 API 有调用频率限制。

**修复**：对所有状态栏操作添加 try-catch，忽略频率限制错误：
```typescript
removeFromStatusBar: () => {
    try { statusBarManager.removeFromStatusBar(context); } catch (_) {}
},
updateStatusBarIconWithRgba: (...) => {
    try { statusBarManager.updateStatusBarIcon(context, icons); } catch (_) {}
},
updateStatusBarMenu: (...) => {
    try { statusBarManager.updateStatusBarMenu(context, statusBarGroupMenu); } catch (_) {}
},
updateStatusBarHoverTips: (...) => {
    try { statusBarManager.updateStatusBarHoverTips(context, hoverTips); } catch (_) {}
},
```

**文件**：`openharmony-ability/native_ability/src/main/ets/components/DefaultXComponent.ets`

---

## Fix 14: 事件处理器重复注册导致主线程 freeze

**问题**：应用启动后主线程阻塞 6 秒（THREAD_BLOCK_6S），event queue 中 `vSyncTask` 的 handle time 异常。

**根因**：`register_icon_click_handler()` 和 `register_menu_click_handler()` 在每次 `add_to_status_bar` 的 TSFN 回调中被调用。每次调用都会创建新的 JS Function 对象并注册到 OHOS 系统，导致：
1. 重复注册多个相同事件的 handler
2. 每次注册都在主线程上执行 NAPI 操作（`create_function_from_closure` + `get_named_property` + `call`）
3. 大量 JS 对象创建阻塞了 ArkUI 的 vSync 渲染任务

**修复**：
1. 将 handler 注册从 TSFN 回调移到 `init_tray_tsfn()` 中，仅在初始化时执行一次
2. 使用 `OnceLock` 替代 `LazyLock` 管理 channel，避免隐式初始化
3. 移除 `AtomicBool` 守卫（不再需要，因为只在 init 时调用一次）

```rust
// event.rs - 使用 OnceLock
static ICON_CLICK_CHANNEL: OnceLock<(Sender<StatusBarClickEvent>, Receiver<StatusBarClickEvent>)> =
    OnceLock::new();

fn icon_click_channel() -> &'static (...) {
    ICON_CLICK_CHANNEL.get_or_init(|| crossbeam_channel::unbounded())
}

// manager.rs - 在 init_tray_tsfn 中注册
pub fn init_tray_tsfn(env: &Env) -> Result<()> {
    // ... 创建 TSFN ...

    // 注册 click/menu handlers 一次（不在 TSFN 回调中）
    let _ = super::event::register_icon_click_handler();
    let _ = super::event::register_menu_click_handler();

    Ok(())
}
```

**文件**：
- `openharmony-ability/crates/ability/src/statusbar/event.rs`
- `openharmony-ability/crates/ability/src/statusbar/manager.rs`

---

## Fix 15: tray-icon OHOS 平台层修复

**问题**：多个 API 行为不一致和错误处理问题。

**修复**：
| 问题 | 修复 |
|------|------|
| `menu_to_status_bar_items` 空菜单仍创建包装项 | 改为 `and_then`，空时返回 `None` |
| `set_icon(None)` 不清除图标 | 传入空 `StatusBarIcon::default()` |
| `set_tooltip` 无法清除 tooltip | 改为 `unwrap_or_default()` 始终调用 API |
| `build_item_from_attrs` 字段不一致 | 统一 `ability_name`/`module_name` 默认值 |
| 错误被 `.ok()` 静默丢弃 | 保留 `.map_err` 转换 |

**文件**：`tray-icon/src/platform_impl/ohos/mod.rs`

---

## Fix 16: statusBarManager 错误透传（console.error 日志）

**问题**：`updateStatusBarIconWithRgba`、`updateStatusBarMenu`、`updateStatusBarHoverTips`、`removeFromStatusBar` 的 try-catch 块静默吞掉所有错误，用户和开发者无法感知。

**修复**：添加 `console.error` 日志记录错误码和消息：
```typescript
import { BusinessError } from "@kit.BasicServicesKit";

updateStatusBarIconWithRgba: (...) => {
    try {
        statusBarManager.updateStatusBarIcon(context, icons);
    } catch (e) {
        const err = e as BusinessError;
        console.error(`[StatusBar] updateStatusBarIcon failed: ${err.code} ${err.message}`);
    }
},
// ... 其他类似操作
```

**文件**：`openharmony-ability/native_ability/src/main/ets/components/DefaultXComponent.ets`

---

## Fix 17: Windows 编译修复

**问题**：Windows 上 `cargo tauri build` 失败，原因：
1. `run_item_main_thread!` 宏中 `popup_inner` 闭包返回 `Ok(())` 导致 Result 嵌套
2. `submenu.rs` 的 `items()` 方法中 `self.0.app_handle` 导致引用逃逸
3. `desktop-plugins.json` 引用了未安装的 `notification`/`dialog` 插件

**修复**：
1. 去掉 `menu.rs` 和 `submenu.rs` 中 `popup_inner` 闭包的 `Ok(())`，让闭包返回 `()` 而不是 `Result<()>`
2. 把 `submenu.rs:528` 的 `self.0.app_handle` 改为 `self_.0.app_handle`（`self_` 是 clone 后发送到主线程的版本）
3. 用 `[target.'cfg(not(target_env = "ohos"))'.dependencies]` 隔离 `tauri-plugin-notification` 和 `tauri-plugin-dialog`，Windows 可用，OHOS 不受影响

**文件**：
- `crates/tauri/src/menu/menu.rs`（去掉 `Ok(())`）
- `crates/tauri/src/menu/submenu.rs`（去掉 `Ok(())` + 修复 `self.0.app_handle`）
- `examples/api/src-tauri/Cargo.toml`（target 隔离插件依赖）

---

## Fix 18: Phase 6 TSFN 数据传递重构解决 Freeze 问题

**问题**：在 OHOS Desktop 模式下运行 tray 测试时，测试用例全部 timeout，应用 freeze。Freeze 日志分析显示主线程（Tid: 61428）SyncWaitTime: 4139 ms，调用栈全部在 `libapi_lib.so` 内部，最终回到 ArkUI 的 `UIDisplaySync::OnFrame()`。

**根因**：全局 Mutex 中转模式下的并发竞争。15 个 `static DATA_*: Mutex<Option<...>>` 在快速连续调用时产生交叉写入，导致 ArkTS 主线程回调读到不一致的数据。

**修复**：将数据传递方式从"全局 Mutex 中转"改为"TSFN 泛型参数直接携带数据"（详见 `impl/phase6-statusbar-tsfn-refactor-design.md`）：
- 删除 15 个 `DATA_*` 静态变量
- 新增 4 个数据结构：`AddStatusBarData`、`UpdateIconData`、`UpdateMenuData`、`UpdateTipsData`
- TSFN 类型从 `ThreadsafeFunction<(), ...>` 改为 `ThreadsafeFunction<AddStatusBarData, ...>` 等
- 公开 API 构造 struct 后直接 `tsfn.call(data, NonBlocking)`，每次调用独立 Box 入队，天然隔离

**验证结果**（2026-05-18）：
- 122 项 autotest 全部运行，tray 相关 15 项（#108-#122）全部通过
- 5 项失败为预存问题（core.Channel、plugin-http/autostart/clipboard-manager 未注册），与 tray 无关

**文件**：`openharmony-ability/crates/ability/src/statusbar/manager.rs`

---

## Fix 19: IPC 协议回调 Mutex 持锁时间过长导致死锁

**问题**：用户在 Tray 页面输入文件路径（如 `/data/storage/el2/base/cache/lift.png`）创建 TrayIcon 时，应用永久 freeze（非超时恢复）。

**现象**：
- appfreeze 日志显示主线程（TID 1299）和 Chrome_IOThread（TID 2491）同时阻塞在 `libapi_lib.so` 内的 futex wait
- 主线程从 VSync 回调（`UIDisplaySync::OnFrame()`）进入我们的代码后阻塞
- Chrome_IOThread 从 scheme handler（`NWebSchemeHandlerFactory::Create`）进入后阻塞
- 阻塞持续 3+ 分钟，应用永久无响应

**根因**：`openharmony-ability/crates/ability/src/helper/webview.rs` 的 `custom_protocol_async` 中：
```rust
let cbs = Arc::new(Mutex::new(cbs));  // line 350

// line 412: 锁在整个回调执行期间持有
cbs.lock().unwrap()(&url, request, req.is_main_frame(), responder);
```

死锁过程：
1. Chrome_IOThread 收到 tray `new` IPC 请求 → 锁住 `cbs` Mutex → 开始执行命令（`std::fs::read` + `image::load_from_memory` 解码大 PNG）
2. 在此期间，webview 发起另一个请求（资源加载），回调在主线程触发
3. 主线程尝试 `cbs.lock()` → 被阻塞（Chrome_IOThread 持有锁）
4. Chrome_IOThread 完成命令后调用 `req_handle.receive_response()` → 需要主线程处理响应
5. 死锁：主线程等 Mutex，Chrome_IOThread 等主线程

**修复**：复制 `&'static F` 引用后立即释放锁，回调在无锁状态下执行：
```rust
// 之前：锁在整个回调执行期间持有
cbs.lock().unwrap()(&url, request, req.is_main_frame(), responder);

// 之后：复制引用后立即释放锁
let cb = *cbs.lock().unwrap();  // MutexGuard 在分号处 drop，锁释放
cb(&url, request, req.is_main_frame(), responder);  // 无锁调用
```

`cbs` 类型是 `Arc<Mutex<&'static F>>`，`&'static F` 是 `Copy` 的，所以 `*guard` 只是复制一个指针，MutexGuard 在语句结束时 drop 释放锁。

**影响范围**：仅修改 `openharmony-ability` crate，不影响 Windows/macOS/Linux。

**文件**：`openharmony-ability/crates/ability/src/helper/webview.rs`

---

## Fix 20: App Freeze（永久阻塞）

**现象**：连续点击 Create Tray 按钮后应用永久冻结（appfreeze）

**根因**：`tauri/crates/tauri/src/tray/mod.rs` 中 `build_inner` 使用 `run_on_main_thread` + `rx.recv()` 阻塞 Chrome_IOThread，而 ArkTS 主线程正在处理 TSFN 回调需要 Chrome_IOThread，形成死锁。

**修复**：OHOS 上 `TrayIcon::new` 内部使用 TSFN NonBlocking（立即返回），不需要 `run_on_main_thread`。添加 `#[cfg(target_env = "ohos")]` 分支直接调用 `build()`，跳过 `run_on_main_thread` + channel。

**文件**：`tauri/crates/tauri/src/tray/mod.rs` (`build_inner` 函数)

---

## Fix 21: Icon 透明/不显示

**现象**：状态栏图标位置为空，看不到任何图标

**根因**：ArkTS 中 `createPixelMapFromRgba` 使用 `pm.writePixelsSync({ pixels: rgbaData, ... })`，但 OHOS `PositionArea.pixels` 字段要求 `ArrayBuffer` 类型，而 `rgbaData` 是从 Rust TSFN 传来的 `Uint8Array`。类型不匹配导致写入静默失败（被 try-catch 吞掉），PixelMap 保持初始全透明状态。

**修复**：改用 `pm.writeBufferToPixelsSync(rgbaData.buffer.slice(rgbaData.byteOffset, rgbaData.byteOffset + rgbaData.byteLength))` 正确提取 ArrayBuffer 并写入。

**文件**：`openharmony-ability/native_ability/src/main/ets/components/DefaultXComponent.ets` (`createPixelMapFromRgba` 函数)

**补充**：最初还尝试了模板转换（将 RGB 替换为纯白/纯黑，保留 alpha 作为形状），但 app icon 的 alpha 全为 255（无透明背景），导致显示为纯色方块。最终方案是直接传原始 RGBA 彩色数据，OHOS 状态栏支持彩色 PixelMap 渲染。

---

## Fix 22: Icon 模糊

**现象**：图标显示但非常模糊

**根因**：强制将所有图标缩放到 24x24，源图标为 32x32，nearest-neighbor 缩放损失质量。

**修复**：不再强制缩放，保持原始尺寸传入。OHOS statusBarManager 接受任意尺寸 PixelMap，系统自行缩放到显示尺寸。

**文件**：`tray-icon/src/platform_impl/ohos/icon.rs` (`icon_to_status_bar_icon` 函数)

---

## Fix 23: Menu Click 事件不触发（Predefined 无效果）

**现象**：点击 tray 菜单项（如 Quit、Minimize）无任何效果，hilog 中无 `_onMenuClick` 回调日志

**根因链**：

1. **`Function::call()` 在 render() 同步上下文中静默失败**：`init_tray_tsfn` 在 napi module 的 `render()` 函数中被调用。此时 `Function::call()` 不会报错但也不会执行。原来的 `register_icon_click_handler` / `register_menu_click_handler` 通过 `Function::call()` 调用 ArkTS 的 `statusBarManager.on()`，但调用被静默吞掉。

2. **`statusBarManager.on()` 必须在 `addToStatusBar` 之后调用**：OHOS 内部的 `ScbServerMessageReceiver` 只在 `addToStatusBar` 成功后才初始化（异步，约 16ms）。在此之前调用 `on()` 注册事件处理器无效。

3. **`log::info!` 在 render() 上下文中不可见**：hilog backend（tauri_plugin_log）在 Tauri builder chain 中较晚初始化，render() 时尚未就绪。`env.run_script("console.info(...)")` 同样无输出。只有 TSFN 触发的代码能产生可见日志。

**修复**（三步）：

1. **绕过 Function::call()**：在 `init_tray_tsfn` 中，不再调用 `registerIconClickHandler`/`registerMenuClickHandler`，而是直接在 helper 对象上设置闭包属性：
   ```rust
   helper_obj.set("_onIconClick", on_icon_click_closure)?;
   helper_obj.set("_onMenuClick", on_menu_click_closure)?;
   ```
   `helper_obj.set()` 是属性赋值，不涉及 JS 函数调用，在 render() 上下文中正常工作。

2. **延迟注册事件处理器**：ArkTS 侧在 `addToStatusBar` 成功后使用 `setTimeout(200ms)` 注册：
   ```typescript
   statusBarManager.addToStatusBar(context, opts);
   setTimeout(() => {
     statusBarManager.on('statusBarIconClick', helper._onIconClick);
     statusBarManager.on('rightMenuClick', helper._onMenuClick);
   }, 200);
   ```

3. **存储 helper 引用**：`aboutToAppear` 中 `helperRef = this.helper`，确保 `addToStatusBarWithRgba` 执行时能访问到已设置了 `_onIconClick`/`_onMenuClick` 的 helper 对象。

**文件**：
- `openharmony-ability/crates/ability/src/statusbar/manager.rs` (`init_tray_tsfn` 函数)
- `openharmony-ability/crates/ability/src/statusbar/event.rs` (添加 `icon_click_sender`/`menu_click_sender` 公开访问器)
- `openharmony-ability/native_ability/src/main/ets/components/DefaultXComponent.ets` (`addToStatusBarWithRgba` + `aboutToAppear`)

**关键教训**：napi-rs 的 `Function::call()` 在某些同步上下文中会静默失败（不抛错、不执行）。如果需要在这类上下文中向 JS 对象传递回调，应使用 `Object::set()` 设置属性，让 JS 侧在合适时机读取并注册。

---

## Fix 24: Predefined minimize/hide/close 不生效（窗口激活竞争）

**现象**：
- 点击 minimize/hide 后窗口缩了一下然后立马还原，仍在前台
- 点击 close（destroyWindow）完全无效果

**根因**：OHOS statusbar 菜单点击时，系统根据 `menuAction.abilityName` 通过 `startSceneFromOther` 激活窗口（带到前台）。这个激活与 `executePredefinedAction` 的 TSFN 调用是异步竞争的：

```
时间线：
  T+0ms   用户点击菜单项
  T+5ms   系统开始激活窗口（startSceneFromOther）
  T+10ms  rightMenuClick 事件触发 → Rust 收到 → TSFN 调用 minimize()
  T+50ms  minimize() 执行，窗口开始最小化
  T+100ms 系统的窗口激活动画完成 → 窗口被拉回前台（覆盖了 minimize）
```

`notifyOnly: true` 理论上应该阻止窗口激活，但实测无效 — 系统仍然激活窗口。

对于 close（destroyWindow）：主窗口被销毁后 WindowStage 无法重建，ability 变成无窗口状态。且系统激活可能干扰 destroyWindow 的执行。

**修复**：

1. **minimize/hide/close 使用 setTimeout(300ms) 延迟执行**：等系统的窗口激活完成后再执行动作。300ms 足够覆盖系统激活动画时间。

2. **close 改为 minimize**：OHOS 上 `destroyWindow()` 销毁主窗口后无法恢复（WindowStage 不能重建窗口）。Windows 上 close 的典型用法是"关窗口、应用继续在 tray 运行"，OHOS 上 `minimize()` 是最接近的等价行为。

```typescript
case 'minimize':
case 'hide':
  setTimeout(() => {
    context.windowStage.getMainWindowSync().minimize();
  }, 300);
  break;
case 'close':
  setTimeout(() => {
    context.windowStage.getMainWindowSync().minimize();
  }, 300);
  break;
case 'maximize':
case 'fullscreen':
  // 不需要延迟 — 窗口激活是期望行为
  context.windowStage.getMainWindowSync().maximize();
  break;
```

**验证结果**：
- minimize/hide：窗口先闪现（系统激活），300ms 后最小化到后台 ✅
- close：同 minimize 行为 ✅
- maximize/fullscreen：窗口激活并最大化 ✅（系统激活 + maximize 方向一致，无竞争）
- quit：直接 exit(0)，不经过 TSFN ✅

**平台限制**：minimize 时的"先闪现再最小化"是 OHOS 平台限制（abilityName 导致系统激活窗口），目前无法避免。`notifyOnly: true` 不能阻止此行为。

**文件**：`openharmony-ability/native_ability/src/main/ets/components/DefaultXComponent.ets` (`executePredefinedAction`)

---

## 总结

| Fix | 问题类型 | 严重程度 | 状态 |
|-----|---------|---------|------|
| 1 | 宏定义错误 | 中 | ✅ 已修复 |
| 2 | 死锁问题 | 高 | ✅ 已修复 |
| 3 | 线程安全问题 | 高 | ✅ 已修复 |
| 4 | API 兼容性 | 高 | ✅ 已修复 |
| 5 | 依赖配置 | 中 | ✅ 已修复 |
| 6 | TSFN 参数传递 | 高 | ✅ 已修复 |
| 7 | 类型定义 | 中 | ✅ 已修复 |
| 8 | API 兼容性 | 高 | ✅ 已修复 |
| 9 | 参数校验 | 高 | ✅ 已修复 |
| 10 | 生命周期问题 | 中 | ✅ 已修复 |
| 11 | TSFN callee_handled 参数偏移 | 高 | ✅ 已修复 |
| 12 | OHOS SDK 参数校验 | 高 | ✅ 已修复 |
| 13 | OHOS SDK 频率限制 | 中 | ✅ 已修复 |
| 14 | 事件处理器重复注册导致 freeze | 高 | ✅ 已修复 |
| 15 | tray-icon 平台层不一致 | 中 | ✅ 已修复 |
| 16 | 错误静默吞掉 | 中 | ✅ 已修复 |
| 17 | Windows 编译失败 | 高 | ✅ 已修复 |
| 18 | TSFN 数据传递并发竞争 | 高 | ✅ 已修复 |
| 19 | IPC 回调 Mutex 死锁 | 高 | ✅ 已修复 |
| 20 | build_inner 永久阻塞 | 高 | ✅ 已修复 |
| 21 | Icon 透明/不显示 | 高 | ✅ 已修复 |
| 22 | Icon 模糊 | 中 | ✅ 已修复 |
| 23 | Menu Click 事件不触发 | 高 | ✅ 已修复 |
| 24 | Predefined 窗口激活竞争 | 高 | ✅ 已修复 |
| 25 | NAPI camelCase 命名导致回调未注册 | 高 | ✅ 已修复 |
| 26 | Tray predefined actions 全部失效 | 高 | ✅ 已修复 |
| 27 | Tray fullscreen 与 maximize 行为一致，未进入沉浸模式 | 中 | ✅ 已修复 |

**编译验证**：`cargo check --target aarch64-unknown-linux-ohos` 通过

---

## Fix 25: NAPI camelCase 命名转换导致 Menu popup 回调未注册

**现象**：点击 Popup 按钮无任何反应，hilog 中无 `[Menu]` 日志。

**调试过程**：
1. 加入 `log::error!` 日志后发现 `tauri_plugin_log` 的 `Stdout` target 在 OHOS 上不输出到 hilog（stdout 不连接 hilog）
2. 改用 `hilog` crate 直接初始化后，日志可见
3. 日志显示 Rust 端流程完整执行：`popup command called` → `popup_context_menu called` → `forwarder received request` → **`POPUP_CALLBACK is None`**

**根因**：`napi-derive-ohos` 的 `#[napi]` 宏默认将 Rust 的 snake_case 函数名转换为 JavaScript 的 camelCase：
- `on_popup_request` → JS 端实际导出名为 `onPopupRequest`
- `emit_menu_event` → JS 端实际导出名为 `emitMenuEvent`

但 ArkTS 代码中使用的是 snake_case 名称：
```typescript
// NativeAbility.ets — 检查永远为 true，直接 return
if (!module || typeof module.on_popup_request !== "function") {
    return;  // 永远走这里！
}
module.on_popup_request(callback);  // 永远不会执行

// menu.ets
import { emit_menu_event } from 'libnative_ability.so';  // 导入名错误
```

**修复**：将 ArkTS 端改为 camelCase 名称：
```typescript
// NativeAbility.ets
if (!module || typeof module.onPopupRequest !== "function") { return; }
module.onPopupRequest(callback);

// menu.ets
import { emitMenuEvent } from 'libnative_ability.so';
emitMenuEvent(item.id);

// type.ets
onPopupRequest?: (callback: ...) => void;
```

**附带修复**：`tauri_plugin_log` 在 OHOS 上使用 `TargetKind::Stdout`，但 OHOS 的 stdout 不连接 hilog，导致所有 `log::*!` 宏输出不可见。改为直接使用 `hilog` crate 初始化 log facade（tag: `"tauritest"`）。

**关键教训**：
1. `napi-derive-ohos` 默认 snake_case → camelCase 转换。如需保留原名，必须用 `#[napi(js_name = "原名")]`
2. OHOS 上 `console.error` 和 `log::error!`（Stdout target）都不输出到 hilog，必须用 `hilog` crate 或 `TargetKind::Stderr` 才能在 `hilog -T tag` 中看到
3. 调试 NAPI 函数是否存在时，`typeof obj.fn !== "function"` 的 false 分支被静默跳过，不会报错

**文件**：
- `openharmony-ability/native_ability/src/main/ets/ability/NativeAbility.ets`
- `openharmony-ability/native_ability/src/main/ets/ability/type.ets`
- `openharmony-ability/native_ability/src/main/ets/helper/menu.ets`
- `tauri/examples/api/src-tauri/src/lib.rs`（hilog 初始化）

---

## Fix 26: Tray predefined actions 全部失效 (OHOS sceneboard PID 注册表溢出)

**现象**: Tray 菜单的所有 predefined action（minimize, hide, close, maximize, fullscreen, quit, about）点击后无效果。Phase 8 完成时这些功能正常工作，menubar commits 后失效。

**调试过程**:

1. 通过 hilog 确认 sceneboard **确实收到了菜单点击事件**: `menuCode: 134, notifyOnly: true` + `AppClientNotifier: Notify client menu clicked start`
2. 但应用进程中 `_onMenuClick` 回调**从不被调用**
3. hilog 中持续出现系统级错误: `AppClientNotifier: Register client pid fail: out of range`
4. 通过 `git diff 1dd56b7..dd6d3fe` 对比 phase 8 完成时的代码与 menubar commits 后的代码，确认 **menubar commits 对 statusbar 代码的影响为零**（无任何 statusbar 相关文件被修改）

**已排除的假设**:
- ❌ menubar commits 引入的代码回归 → git diff 证明 statusbar 代码未被修改
- ❌ `updateStatusBarMenu` 激活 notifyOnly → 尝试后 PID 注册仍失败
- ❌ `removeFromStatusBar` 清理残留注册 → 尝试后 PID 注册仍失败
- ❌ 不设置 `menuAction.abilityName` → OHOS API 文档表明是必填字段

**根因**: OHOS sceneboard 的 `AppClientNotifier` 进程注册表（PID table）溢出。

OHOS StatusBar 菜单点击通过两种机制投递:
1. **Emitter 机制** (`rightMenuClick`): `menuAction.notifyOnly=true` + `menuCode` 时，sceneboard 通过 IPC (`AppClientNotifier`) 投递 emitter 事件到应用进程
2. **Ability Start 机制** (`onNewWant`): 通过 Ability lifecycle 投递，但 Want 参数**不含 menuCode**

当 `statusBarManager.on('rightMenuClick', callback)` 注册时，sceneboard 在 `AppClientNotifier` 中为应用 PID 建立 IPC 映射。该注册表有容量限制，反复的 debug 部署（install/uninstall/crash）在表中留下残留条目且不会自动清理。表满后 PID 注册失败 → IPC 通知无法投递 → `_onMenuClick` 永远不被调用。

**为何看起来像 menubar commits 导致**: 时间巧合。menubar 开发期间反复部署测试，累积了足够多的残留条目使注册表溢出。

**修复**: 重启 OHOS 设备。设备重启时 sceneboard 服务重新初始化，PID 注册表清空，新的注册请求成功。重启后 predefined actions 立即恢复正常。

**关键教训**:
1. `AppClientNotifier: Register client pid fail: out of range` 是 OHOS 系统级错误，不是应用代码问题
2. 反复 debug 部署可能导致 sceneboard 进程表溢出，重启设备即可恢复
3. 排查此类问题时，先通过 git diff 确认代码是否真的有变更，避免在代码层面做无用修改

**文件**:
- `openharmony-ability/.../DefaultXComponent.ets` (addToStatusBar + emitter 注册)
- `openharmony-ability/.../statusbar/event.rs` (_onMenuClick NAPI 闭包)
- `tray-icon/.../event.rs` (execute_predefined_action 路径)

---

## Fix 27: Tray fullscreen 与 maximize 行为一致，未进入沉浸模式

**现象**: Tray 菜单的 "Fullscreen" 和 "Maximize" 行为完全一致，都只是最大化窗口。Fullscreen 后 menubar 仍然显示，说明没有进入沉浸模式。Menu predefined 的 Fullscreen 则正常进入沉浸模式且 menubar 消失。

**根因**: Tray 的 `executePredefinedAction('fullscreen')` (DefaultXComponent.ets) 调用了 `maximize(ENTER_IMMERSIVE)` 但**没有设置 menubar 可见性状态为 false**。

Menubar 渲染条件 (MainPage.ets:310):
```typescript
if (this.isDesktop && this.menubarItems.length > 0 && this.menubarVisible)
```

`menubarVisible` 由 `@StorageProp("__openharmony_ability_menubar_visible__::main")` 驱动，默认 `true`。Menu 版本在进入沉浸模式前显式设置为 `false`，tray 版本遗漏了这一步，导致 menubar 继续渲染在沉浸窗口上方。

**修复**: 在 tray 的 fullscreen case 中添加 AppStorage 状态设置：
```typescript
case 'fullscreen': {
  AppStorage.setOrCreate("__openharmony_ability_menubar_visible__::main", false);
  AppStorage.setOrCreate("__openharmony_ability_menu_shown__::main", false);
  const fullscreenWin = context.windowStage.getMainWindowSync();
  fullscreenWin.maximize(window.MaximizePresentation.ENTER_IMMERSIVE);
  break;
}
```

退出沉浸模式时，`windowRectChange` 事件的 `RECOVER` reason 会自动恢复 `menubarVisible = true` (NativeAbility.ets:222-226)。

**文件**:
- `openharmony-ability/.../DefaultXComponent.ets` (executePredefinedAction fullscreen case)

---

## OHOS 系统级错误汇总

开发调试过程中遇到的 OHOS 平台级错误，非应用代码问题：

| 错误 | 说明 | 解决方案 |
|------|------|----------|
| `AppClientNotifier: Register client pid fail: out of range` | sceneboard PID 注册表溢出，反复 debug 部署累积残留条目 | 重启设备 |
| `Multi-instance is not supported` (16000078) | statusBarManager 内部 `getCurrentInstanceKey` 对 singleton 调用方**按设计抛出**并被内部 catch/日志（add & remove 路径均出现） | **无需处理**——非致命、不导致 401。device 验证：tray 成功注册（`worker: add Ok`）时此日志仍出现。见 spec §7.5 |
| `The size of the pixelmap exceeds the limit` (1010710001) | PixelMap 为固定物理像素，未按 24vp × display.densityPixels 校正 | **已修复**——`StatusBarUtils.ets::createPixelMapFromRgba` 用 `display.getDefaultDisplaySync().densityPixels` + `scaleSync` 做 density 校正（src=32→target=46）。见 spec §7.4 |
