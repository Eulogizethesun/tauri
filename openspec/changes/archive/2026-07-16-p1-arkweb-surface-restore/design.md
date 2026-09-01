## Context

OHOS 上窗口最小化时,XComponent 的渲染 surface 被销毁(`on_surface_destroyed` → `Event::SurfaceDestroy` → `Event::Suspended`)。恢复时 surface 重建(`on_surface_created` → `Event::SurfaceCreate` → `Event::Resumed`)。

tauri-runtime-wry 的事件处理:
- `Event::Resumed`(line 4513):只调 `callback(RunEvent::Resumed)`,**不触发 webview set_bounds**。
- `WindowEvent::Resized`(line 4673):才调 `webview.set_bounds()` 强制 ArkWeb 重新 attach surface。

因此 minimize→restore 虽然触发了 `Resumed`,但 webview 不知道 surface 变了,ArkWeb `Web` 组件停留在旧/销毁的渲染表面 → 底部内容永久缺失。

maximize→unmaximize 触发 `WindowResize` → `Resized` → `set_bounds()` → 修复(验证了 set_bounds 是正确的修复点)。

## Goals / Non-Goals

**Goals:**
- 在 `Event::Resumed` 时对每个 webview 调用 `set_bounds(current_bounds)`,强制 ArkWeb 重新 attach surface。
- 仅 OHOS 生效(cfg 隔离),不影响其他平台。

**Non-Goals:**
- 不修改 wry 或 tao(修复点在 tauri-runtime-wry 的事件路由层)。
- 不改变 webview 尺寸(用缓存值,只触发 setBounds 回调)。

## Decisions

### D1: 新增 Event::Resumed match arm + 在其中调用 set_bounds

**审计发现**:tauri-runtime-wry 当前**没有** `Event::Resumed` 的 match arm(line 4513 是 `StartCause::Poll` → `RunEvent::Resumed`,每次轮询触发,与 surface 重建无关)。tao OHOS 发送的 `event::Event::Resumed`(来自 `SurfaceCreate`)被 `_ => ()` 静默丢弃。

**修复**:新增 `Event::Resumed` match arm,在其中对每个 webview 调用 `set_bounds(cached_bounds)`。

```rust
// 新增 match arm(当前缺失,Event::Resumed 被 _ => () 丢弃)
Event::Resumed => {
  #[cfg(target_env = "ohos")]
  {
    // On OHOS, Resumed fires when XComponent surface is recreated (e.g. after
    // minimize→restore). The ArkWeb Web component doesn't auto-reattach to the
    // new surface, so we must force a set_bounds() call to trigger reattachment.
    // Without this, bottom content permanently disappears after minimize→restore.
    // Note: Resumed also fires on initial app startup (from SurfaceCreate) —
    // the set_bounds call is harmless then (same size, no visual change).
    //
    // Borrow pattern: clone data out of the RefCell BEFORE calling set_bounds,
    // to avoid holding an immutable borrow during NAPI/ArkTS callbacks that may
    // re-enter and borrow_mut. This mirrors the Resized handler (lib.rs:4674-4678).
    let webview_list: Vec<(f32, f32, f32, f32, Rc<WebView>)> = {
      let windows_ref = windows.0.borrow();
      let mut result = Vec::new();
      for window in windows_ref.values() {
        if let Some(w) = window.inner.as_ref() {
          let win_size = w.inner_size().to_logical::<f32>(w.scale_factor());
          for webview in &window.webviews {
            if let Some(b) = &*webview.bounds.lock().unwrap() {
              // WebviewBounds is rate-based, multiply by window size for absolute Rect
              result.push((
                win_size.width * b.x_rate,
                win_size.height * b.y_rate,
                win_size.width * b.width_rate,
                win_size.height * b.height_rate,
                webview.inner.clone(), // Rc<WebView>
              ));
            }
          }
        }
      }
      result
    }; // Ref dropped here — safe to call set_bounds
    for (x, y, w, h, webview) in webview_list {
      if let Err(e) = webview.set_bounds(wry::Rect {
        position: LogicalPosition::new(x, y).into(),
        size: LogicalSize::new(w, h).into(),
      }) {
        log::warn!("[runtime-wry] failed to reattach webview on resume: {e}");
      }
    }
  }
}
```

**注意**:
- 不在 `Event::NewEvents(StartCause::Poll)` 中加代码 — 该分支每次轮询触发,会导致每帧调 set_bounds(性能问题)。
- `webview.bounds` 是 `Arc<Mutex<Option<WebviewBounds>>>`,`WebviewBounds` 存的是 rate(f32),不是绝对坐标。必须乘以窗口 `inner_size()` 转换为绝对 `wry::Rect`(与现有 `Resized` handler lib.rs:4682-4688 一致)。
- `window.inner` 可能为 None(刚创建未初始化),用 `if let Some(w) = window.inner.as_ref()` 守卫。
- `Event::Resumed` 也在 app 启动时触发(初始 SurfaceCreate),set_bounds 调用无害(尺寸不变,无视觉变化)。

**理由**:`Event::Resumed` 仅在 surface 重建时触发(tao `SurfaceCreate` → `Event::Resumed`),频率低、语义准确。`set_bounds()` → ArkTS `setBounds()` → `updateWebviewStyle` → Web 组件重新渲染 → surface 重新 attach。maximize→unmaximize 已验证此路径有效。

**备选**:
1. 在 tao OHOS 的 `SurfaceCreate` 后发一个 `WindowResize` 事件 — 更底层但侵入 tao,且尺寸没变不会触发 ArkTS setBounds。
2. 在 wry OHOS 加 `pub fn reattach_surface()` — 过度设计,set_bounds 已满足需求。
3. 在 ArkTS WindowManager 的 `WINDOW_SHOWN` 事件中调 `setBounds` — 不经过 Rust,无法复用 set_bounds 逻辑。

## Risks / Trade-offs

- **[set_bounds 副作用]** set_bounds 可能触发不必要的 ArkTS Web 组件重渲染。缓解:仅在 Resumed 时调用(不是每帧),且用缓存值(尺寸不变,ArkTS 可能跳过实际渲染)。
- **[多窗口]** 多窗口时遍历所有 webviews 可能有性能影响。缓解:Resumed 不频繁(仅 surface 重建时),开销可忽略。
- **[bounds 未初始化]** webview 的 bounds 可能为 None(刚创建未设置)。缓解:用 `if let Some(b)` 守卫,跳过未初始化的 webview。
