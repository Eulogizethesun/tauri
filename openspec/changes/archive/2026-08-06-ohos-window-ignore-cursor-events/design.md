## Context

Tauri/tao 提供 `Window::set_ignore_cursor_events(ignore: bool)`：`ignore=true` 时窗口不消费鼠标/触摸事件，事件穿透到下层窗口。Windows 用 `WindowFlags::IGNORE_CURSOR_EVENT`，macOS 用 `NSWindow setIgnoresMouseEvents`。OHOS 后端当前空实现返回 `NotSupported`。

OHOS `ohos.window.setWindowTouchable(isTouchable: boolean): Promise<void>`（API 9+，元服务 12+，`SystemCapability.WindowManager.WindowManager.Core`）。官方智能问答（最新版）确认 `false` 时触摸+鼠标事件穿透到下层窗口；本地缓存文档与 ask_ai 在版本号和穿透语义上存在矛盾，**真机验证为定论步骤**。

当前 `ohdev` 旧模型已有两套 window 能力模式：
- **同步直调**（`set_window_decorations`/`focus_window`）：`get_helper()` + `get_named_property("xxx").call()`，仅主线程
- **TSFN 跨线程**（`set_window_blur`/`set_window_background_color`）：`init_vibrancy_tsfn` 建全局 TSFN，任意线程 fire-and-forget 调

`set-touchable` 走 **TSFN 模式**（对称 `set_window_blur`），因为 tao 命令可能在 worker 线程，同步直调在 worker 上会因 `get_main_thread_env()==None` 失败。

## Goals / Non-Goals

**Goals:**
- 在 `openharmony-ability` 新增 `set_window_touchable(window_id, touchable)` TSFN 函数，对称 `set_window_blur`。
- ArkHelper 暴露 `setWindowTouchable(windowId, touchable)`，调 `wm.setWindowTouchable`，`.catch` 处理 Promise reject。
- 为 Phase 2 的 tao `set_ignore_cursor_events` 填实提供函数基础。
- 逻辑取反映射：Tauri `ignore=true`（穿透）↔ OHOS `touchable=false`（穿透），取反在 tao 层。

**Non-Goals:**
- 不在 Phase 1 填实 tao（Phase 2）。
- 不做真机验证（Phase 2）。
- 不实现组件级 `hitTestBehavior` 穿透（仅当 Phase 2 真机验证 hover 不穿透时才追加）。
- 不改变 `set_window_blur` 等现有 TSFN 能力。
- 不考虑新模型 plugin-window 重构（本设计基于当前 ohdev 旧模型）。

## Decisions

### D1: TSFN 模式 — 对称 `set_window_blur`

完全照搬 `set_window_blur` 的实现结构（`window/mod.rs:172-245`）：

```rust
// window/mod.rs
type SetWindowTouchableTsfn = ThreadsafeFunction<(i64, bool), (), FnArgs<(i64, bool)>, Status, false>;
static TSFN_SET_WINDOW_TOUCHABLE: OnceLock<SetWindowTouchableTsfn> = OnceLock::new();

// 在 init_vibrancy_tsfn 内追加（或新建 init 函数）：
let touchable_fn: Function<'_, FnArgs<(i64, bool)>, ()> = helper_obj
    .get_named_property("setWindowTouchable")?;
let touchable_tsfn = touchable_fn
    .build_threadsafe_function::<(i64, bool)>()
    .callee_handled::<false>()
    .build_callback(move |ctx: ThreadsafeCallContext<(i64, bool)>| {
        Ok(FnArgs { data: ctx.value })
    })?;
let _ = TSFN_SET_WINDOW_TOUCHABLE.set(touchable_tsfn);

/// Sets window touchable state via TSFN (threadsafe, callable from any thread).
/// touchable=false → events pass through to windows below (ignore cursor events).
pub fn set_window_touchable(window_id: i64, touchable: bool) -> napi_ohos::Result<()> {
    let tsfn = TSFN_SET_WINDOW_TOUCHABLE.get()
        .ok_or_else(|| Error::from_reason("set_window_touchable TSFN not initialized"))?;
    let status = tsfn.call((window_id, touchable), ThreadsafeFunctionCallMode::NonBlocking);
    if status != Status::Ok {
        return Err(Error::from_reason(format!("TSFN call failed: {:?}", status)));
    }
    Ok(())
}
```

### D2: ArkTS 侧 — WindowManager 封装 + ArkHelper 转发

**审计修正**：旧模型 window 能力走两层——`ArkHelper.ets` 转发到 `WindowManager.ets` 的封装方法（参照 `setWindowFocusable`）。`WindowManager` 用 `getWindow(windowId)`（非 `getWindowById`）取窗口实例，再调 `win.setWindowTouchable(touchable).then().catch()`。

**WindowManager.ets**（对称 `setWindowFocusable:201-212`）：
```typescript
setWindowTouchable(windowId: number, touchable: boolean): void {
  const win = this.getWindow(windowId);
  if (!win) {
    hilog.warn(DOMAIN, 'WindowManager', 'setWindowTouchable: window %{public}d not found', windowId);
    return;
  }
  win.setWindowTouchable(touchable).then(() => {
    hilog.debug(DOMAIN, 'WindowManager', 'setWindowTouchable: window %{public}d touchable=%{public}s', windowId, String(touchable));
  }).catch((err: ESObject) => {
    // 必须.catch：setWindowTouchable返回Promise，401/1300002/1300003均reject异步传递
    // 此处是Promise异步回调，不在NAPI-reentrant调用栈，hilog.error安全（参照setWindowFocusable:210）
    hilog.error(DOMAIN, 'WindowManager', 'setWindowTouchable failed: %{public}s', JSON.stringify(err));
  });
}
```

**ArkHelper.ets**（转发，对称 `setWindowFocusable:558-565`）：
```typescript
setWindowTouchable: (windowId: number, touchable: boolean): void => {
  try {
    const wm = WindowManager.getInstance();
    wm.setWindowTouchable(windowId, touchable);
  } catch (err) {
    // 同步阶段异常（WindowManager构造或getWindow同步抛出）
    // 此处在NAPI-reentrant调用栈（TSFN回调），用safeLogError避免hilog Argc mismatch
    safeLogError('setWindowTouchable', err);
  }
},
```

**关键**：
- `setWindowTouchable` 返回 Promise，错误（401/1300002/1300003）通过 reject 异步传递（审计确认）。必须 `.catch`，否则 ArkTS 闪退。
- `WindowManager` 里的 catch 是 Promise 异步回调，**不在 NAPI-reentrant 调用栈**，`hilog.error` 安全（参照 `setWindowFocusable:210` 直接用 hilog）。
- `ArkHelper` 里的同步 catch 在 NAPI-reentrant 上下文（TSFN 回调），用 `safeLogError`（已确认它 try hilog → catch → console，安全）。

### D3: fire-and-forget 的错误传播限制（F3 不对称）

TSFN fire-and-forget 模式下，ArkTS 的 Promise reject **无法反向通知 Rust**——Rust 侧 `set_window_touchable` 始终返回 `Ok(())`（只要 TSFN call status==Ok）。这和 `set_window_blur` 是同样的限制（`ArkHelper.ets:630` 注释明说"error is NOT propagated to Rust"）。

**后果**：1300002/1300003 发生时，Rust 侧以为成功，但实际没设置。对 `setIgnoreCursorEvents` 影响有限——它是"尽量设置"语义，失败只是穿透没生效，不致命。

**若需错误感知**（Phase 2 视需求）：改用 `call_with_return_value` + oneshot channel（如 `clipboard_write_image` 模式），让 Rust await ArkTS 的 Promise 结果。但这会引入阻塞，Phase 1 先用 fire-and-forget，Phase 2 真机验证后再定。

### D4: 逻辑取反在 tao 层（Phase 2）

ability 层 `set_window_touchable(touchable)` 直传 bool，不取反（和 `set_window_blur` 直传 radius 一样）。tao 的 `set_ignore_cursor_events(ignore)` 调用时取反：

```rust
// tao/platform_impl/ohos/mod.rs (Phase 2)
// Window struct: app: OpenHarmonyApp, window_id: Option<i64> (mod.rs:816-817)
pub fn set_ignore_cursor_events(&self, ignore: bool) -> Result<(), ExternalError> {
    let window_id = self.window_id
        .ok_or_else(|| error::ExternalError::NotSupported(error::NotSupportedError::new()))?;  // Option<i64> → i64
    // 取反：Tauri ignore=true(穿透) ↔ OHOS touchable=false(不消费事件)
    if let Err(e) = openharmony_ability::set_window_touchable(window_id, !ignore) {
        warn!("set_ignore_cursor_events: set_window_touchable failed for window {}: {:?}", window_id, e);
        return Err(error::ExternalError::NotSupported(error::NotSupportedError::new()));
    }
    Ok(())
}
```

**错误转换修正（实现期审计发现）**：原设计的 `.map_err(|e| error::ExternalError::from(e.to_string()))` **无法编译** — tao 的 `ExternalError` 无 `From<String>` 实现，OHOS `OsError` 是 unit struct（`pub struct OsError;`）不携带消息字符串。实际采用 `warn!` 记录错误详情 + 返回 `NotSupported`（唯一可用变体），匹配文件内 `set_focus`/`set_focusable` 的 idiom（它们也是 `warn!` + 静默/返回默认值）。此为 tao OHOS 层的通用约束，已记入 [`ohos-constraints.md`](../../../.claude/skills/tauri-ohos-design/references/ohos-constraints.md) §1.5。

**Err 语义说明**：`set_window_touchable` 是 TSFN fire-and-forget，返回 Err 仅当 TSFN 未初始化或 call status 非 Ok（init/编程错误）—— **不是** 1300002/1300003 等运行时失败，那些 Promise reject 在 ArkTS `.catch` 捕获、不反向通知 Rust（见 D3）。故此处的 NotSupported 实际只在桥接未就绪时触发。

**审计确认**：`Window` struct 有 `app: OpenHarmonyApp` + `window_id: Option<i64>` 字段（`mod.rs:816-817`），`set_ignore_cursor_events(&self, ...)` 可直接访问。但 `window_id` 是 `Option<i64>`，需 `ok_or` 解包（None 时返回 NotSupported，表示该 window 无 OS 窗口 id，如嵌入式 webview）。

| 调用方 | 参数 | 语义 |
|--------|------|------|
| tauri/tao `set_ignore_cursor_events(ignore)` | `ignore=true` | 忽略事件 = 穿透 |
| ability `set_window_touchable(touchable)` | `touchable=false` | 不可触 = 穿透 |

## Risks / Trade-offs

### R1: 穿透语义未真机验证（最高风险）
官方两版文档矛盾。Phase 2 真机为定论。
- 触摸+hover 都穿透 → 单 `setWindowTouchable` 足够。
- 触摸 OK 但 hover 不穿透 → Phase 2 追加组件级 `hitTestBehavior(HitTestMode.Transparent)`（R72 drag-drop-overlay 已验证）。

### R2: fire-and-forget 错误不可感知
D3 所述。Phase 1 接受此限制（与 `set_window_blur` 一致）。Phase 2 若需感知改 oneshot 模式。

### R3: setWindowTouchable 的 Promise reject 闪退风险
ArkTS 侧必须 `.catch`（D2）。漏 catch 会闪退。Phase 1 design 已要求 catch，Phase 2 真机验证 catch 是否在 NAPI-reentrant 上下文安全。

### R4: 1300002 跨进程约束
tao 多窗口同进程，OK。

### R5: API 版本差异
本地 9+/12+ vs ask_ai 7+/11+。demo API 12 满足。

### R6: TSFN 传 bool 无现成先例
`set_window_blur`(i64,f64) / clipboard(Uint8Array,u32,u32) 都没传过 bool。`set_window_decorations`/`set_window_focusable` 同步直调用 `Function<'_, (i64, bool), ()>` 传 bool 是 OK 的，TSFN 传 bool 理论可行（napi-ohos 支持 bool 的 ToNapiValue/FromNapiValue）。但无现成 TSFN+bool 先例验证，Phase 2 真机需确认 `(i64, bool)` 元组经 TSFN 到 ArkTS 后 `touchable` 字段类型正确（boolean 而非被转成 number）。若出问题，fallback 改用 `(i64, u32)`（0/1）再 ArkTS 侧 `!!touchable` 转换。

### R6: 逻辑取反易错
D4 的 `!ignore` 在 tao 层。ability 直传，design 已显式标注映射表。

## Alternatives Considered

- **同步直调模式（`set_window_decorations` 那种）**：worker 上 `get_main_thread_env()==None` 失败，tao 命令可能跑 worker。TSFN 更合适。
- **oneshot 返回值模式（`clipboard_write_image`）**：能感知错误，但引入阻塞。Phase 1 先 fire-and-forget，Phase 2 视需求升级。
- **组件级 `hitTestBehavior` 替代窗口级**：Tauri 语义是窗口级，`setWindowTouchable` 更贴 Tauri。组件级作为 hover fallback（R1）。
