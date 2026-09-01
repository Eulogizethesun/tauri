# OHOS 窗口遗留问题

> 本文记录 Tauri OHOS 适配中尚未解决的遗留问题。各问题相互独立,按主题分章,内部小节结构对齐(现象 → 机制 → 后果 → 修复 → 验证)。
>
> **已收录问题**:
> - **问题一**:窗口事件路由架构债 —— ZST WindowId + MainEvent 无载荷导致的关窗旁路与多窗口事件路由错乱
> - **问题二**:inner_size / outer_size 语义错位 —— 读路径分离正确,写路径 `set_inner_size` 实际改的是外尺寸
> - **问题三**:hide_window 语义错位与 OHOS API 限制 —— hideAbility 仅 UIAbility 可用且需状态栏前置条件,Float 无真正 hide,当前用 minimize 冒充致语义不符;show/hide 不对称
> - **问题四**:set_minimizable/set_maximizable/set_closable 语义错位 —— 名义控制"窗口能否最小化/最大化/关闭",实际只控制装饰按钮显隐,不拦截编程式 API,与应有语义无关
> - **问题五**:Window 大量 Atomic 镜像位与 ArkTS 真实状态不同步 —— 单向写不回读、maximized/minimized 为僵尸字段、系统状态变化不回灌,导致 is_* 查询与实际状态脱节
> - **问题六**:set_cursor_visible / set_ignore_cursor_events / set_cursor_icon / set_always_on_top 尚未测试 —— 前三者已 dispatch 到系统 API 但行为未验证,always_on_top 为 no-op 无 z-order API
>
> **姊妹文档**:[多窗口特性实现文档.md](多窗口特性实现文档.md) 描述多窗口的正向实现(创建/路由/竞态);本文档专门记录正向文档未覆盖的遗留问题。

---

## 问题一:窗口事件路由架构债

> **状态**:中期重构级技术债,非紧急。单窗口应用完全不受影响;多窗口关窗已临时补偿;多窗口其他事件类型的路由正确性是持续渗血点。
>
> **关联代码**:
> - [tao `MainEvent::WindowDestroy`](../../tao/src/platform_impl/ohos/mod.rs) — 已改为 no-op
> - [openharmony-ability `drain_pending_window_closes`](../../openharmony-ability/crates/ability/src/app.rs) — OHOS 唯一关窗通道
> - [runtime-wry drain 调用点](../crates/tauri-runtime-wry/src/lib.rs) — 在 `match event` 之前 drain

### 现象与量级

Tauri OHOS 适配在多窗口场景下,窗口关闭事件的派发路径与其他平台存在结构性差异。这不是适配者的疏忽,而是 **OHOS 窗口模型与 tao/winit 设计假设之间的模型不匹配**,由此产生了一系列补偿性旁路(ZST 占位、drain 旁路、no-op 屏蔽)。

- **不是 bug**:当前代码在它支持的场景下能跑通(7-anchor 测试 PASS)。
- **是架构债**:多窗口下用 ad-hoc 旁路绕过了 tao 的设计假设,债务随功能演进暴露。
- **紧急度**:中期重构级,非紧急。单窗口不受影响;多窗口关窗已补偿;多窗口其他事件路由是持续渗血点。

**为什么"现在还能跑":**
- 单窗口下 ZST 无害——只有一个窗口,覆盖不覆盖都一样。早期 OHOS 只支持单窗口,ZST 是省事占位,无后果。
- 多窗口是 2026-06 才加的(openspec `ohos-window-lifecycle`、`ohos-predefined-multi-window` 归档)。债务随多窗口功能才显现。
- drain 补偿了最痛的关窗场景——关错窗口会直接导致主窗口 webview 被移除,是最先暴露、最痛的点,所以最先被补。

### 两个接口谁在用

#### `MainEvent::WindowDestroy`(无主事件)

**产生端(ArkTS → Rust):**
```
OHOS 系统 onWindowStageDestroy 回调
  → NativeAbility.ets: onWindowStageDestroy()
    → forEachLifecycle → windowStageEventCallback.onWindowStageDestroy()
      → Rust NAPI 闭包 (lifecycle.rs: on_window_stage_destroy)
        → h(Event::WindowDestroy)  // 塞进 event loop 的 mpsc channel
```

**消费端(Rust):** 整个代码库**只有一处**消费 `MainEvent::WindowDestroy` —— tao 的 `EventLoop::run` match 分支。该分支当前已是 **no-op(空操作)**,只保留注释。

**致命缺陷:不携带窗口身份。**
```rust
// openharmony-ability/crates/ability/src/event.rs
pub enum Event<'a> {
    WindowCreate,       // 无载荷
    WindowDestroy,      // 无载荷 ← 问题根源
    WindowResize(IntervalInfo),  // 有载荷
    ...
}
```
ArkTS 端 `onWindowStageDestroy` 其实**知道**自己销毁的是哪个窗口(`this.readWindowId()`),但这个值只用于 `unregisterUIAbilityStage`,**没有随 `WindowDestroy` 事件传给 Rust**。所以它天生是个"无主"事件——只能告诉你"某个 windowStage 销毁了",却说不出是谁。

#### `drain_pending_window_closes`(唯一关窗通道)

这是 OHOS 上**真正携带窗口身份**的关窗通道。

**产生端(ArkTS → Rust 全局队列):** ArkTS 在真正销毁窗口之前,同步调 NAPI `notifyWindowClose(windowId: i32)`,把**真实的 `i32` windowId** 压进全局 `PENDING_WINDOW_CLOSES: Mutex<Vec<i32>>` 队列。调用点(全部在 `destroyWindow` 之前):

| 调用点 | 文件 | 场景 |
|---|---|---|
| FloatPage 编程式关闭 | `native_ability/.../components/FloatPage.ets` | Float 子窗口关闭按钮 onClick |
| FloatPage `aboutToDisappear` | 同上 | Float 子窗口系统关闭(组件销毁) |
| ArkHelper `onCloseWindow` | `native_ability/.../ability/ArkHelper.ets` | UIAbility onCloseWindow 回调 |
| menu 子窗口关闭 | `native_ability/.../helper/menu.ets` | 菜单触发关闭子窗口 |

**消费端(Rust):** 整个代码库**只有一处**调用 `drain_pending_window_closes` —— runtime-wry 事件循环每轮迭代的最开头(`match event` 之前):
```rust
// crates/tauri-runtime-wry/src/lib.rs
#[cfg(target_env = "ohos")]
{
  let pending_closes = tao::platform::ohos::ability::drain_pending_window_closes();
  for ohos_win_id in pending_closes {           // ← 真实 i32 windowId
    let matching_id = windows.0.borrow().iter().find_map(|(id, wrapper)| {
      wrapper.inner.as_ref()
        .and_then(|w| w.window_id())            // ← tao Window 持有的 i64
        .and_then(|wid| if wid == ohos_win_id as i64 { Some(*id) } else { None })
    });
    if let Some(window_id) = matching_id {
      on_close_requested(callback, window_id, windows.clone(), exit_state.clone());
    }
  }
}
```
它用真实 `i32` windowId 去 `WindowsStore` 精确匹配,找到对应的 Tauri `WindowId`,再走 `on_close_requested` → `on_window_close` → 派发 `CloseRequested` + `Destroyed`(带正确 label)。

#### "最终用户"是谁

关窗的三类发起者,全部汇聚到 `on_close_requested` / `on_window_close`:

| 发起者 | 路径 | OHOS 如何到达 `on_close_requested` |
|---|---|---|
| 前端 JS 调 `getCurrent().close()` | `webview_window.rs` → runtime-wry `close()` → `proxy.send_event(Message::Window(id, WindowMessage::Close))` → `Message::Window` match 分支直接调 `on_close_requested` | **不走 drain**(已有 Tauri windowId) |
| 用户点窗口关闭按钮/菜单 | ArkTS 检测到 → `notifyWindowClose(ohosId)` 入队 | **走 drain** |
| 系统发起的销毁(返回键、划任务、内存回收) | ArkTS `onWindowStageDestroy` → `MainEvent::WindowDestroy` | **走 no-op**(当前实现) |

所以 **drain 的最终用户 = "OHOS 上点关闭按钮的用户"**,经由 ArkTS → NAPI 队列 → runtime-wry 事件循环 → `on_close_requested`。前端 JS 主动调 `close()` 不走 drain(它已有 Tauri windowId,直接走 `Message::Window` 通道)。

### 为什么像"两个事件循环"

关键澄清:**不是两个事件循环,是三个层次的循环,但只有一个是真正的"事件循环"**。

```
┌─────────────────────────────────────────────────────────┐
│ 第 1 层:OHOS 系统 UIAbility 生命周期(不是循环,是回调)  │
│   onWindowStageCreate / onWindowStageDestroy / ...      │
│   → openharmony-ability 把回调包成 MainEvent,          │
│     塞进 mpsc channel                                   │
└──────────────────────┬──────────────────────────────────┘
                       ↓ channel.send
┌──────────────────────┴──────────────────────────────────┐
│ 第 2 层:tao 的事件循环(真正的循环)                     │
│   EventLoop::run → 循环 channel.recv()                  │
│   match MainEvent { WindowCreate / WindowDestroy / ... } │
│   ← 这一层在 OHOS 上"残缺":不处理关窗(tao 无 close 实现)│
└──────────────────────┬──────────────────────────────────┘
                       ↓ tao 把 Event 转发
┌──────────────────────┴──────────────────────────────────┐
│ 第 3 层:runtime-wry 的事件回调(每轮迭代调一次)         │
│   window_event_callback 里:先 drain,再 match event     │
│   ← OHOS 关窗真正在这一层处理                            │
└─────────────────────────────────────────────────────────┘
```

tao 和 runtime-wry 的职责在 OHOS 上被强行分工:
- **tao 第 2 层**:只把 OHOS 系统 MainEvent 翻译成 tao `Event`。但它**没有 OHOS 关窗能力**——`platform_impl/ohos/mod.rs` 里根本没有 `close`/`CloseRequested`/`Destroyed` 的实现,`WindowId` 还是 ZST。
- **runtime-wry 第 3 层**:补上了 tao 缺的关窗逻辑。它绕过 tao 的事件通道,直接用 `drain_pending_window_closes` + `WindowsStore` 自己匹配窗口、自己调 `on_close_requested`。

"两个事件循环"错觉的根源:**tao 的循环还在转,但 OHOS 关窗这件事被 runtime-wry 截胡在 tao 之前处理了**(drain 在 `match event` 之前)。

### 其他平台对照

其他平台**只有一条路径,天然带 windowId,不需要 drain**:

| 平台 | 关窗信号源 | windowId 来源 | tao 是否处理关窗 | runtime-wry 是否需要 drain |
|---|---|---|---|---|
| Windows | `WM_CLOSE` 消息 | HWND(`WindowId(isize)`) | ✅ | ❌ |
| macOS | `windowShouldClose:` delegate | WindowState(每 NSWindow 一 delegate) | ✅ | ❌ |
| Linux | GTK `delete_event` | X11 id(`WindowId(u32)`) | ✅ | ❌ |
| **OHOS** | `onWindowStageDestroy` / `aboutToDisappear` | **无**(MainEvent 无载荷) | **❌**(tao 无实现) | **✅**(唯一通道) |

**共同模式**:系统原生 API 把"关哪个窗口"作为参数直接传给 tao,tao 用原生 ID 构造 `WindowId`,派发 `CloseRequested`。runtime-wry 只是被动接收 `TaoWindowEvent::CloseRequested` 再调 `on_close_requested`,不需要 drain。

**OHOS 为何不同**:OHOS 窗口系统是 UIAbility + ArkUI,关闭信号挂在 Ability 生命周期回调上,**不带窗口 id 给 Rust**;ArkTS 管理的 Float 子窗口关闭走 `aboutToDisappear`,也没法直接塞进 tao 的 Event 通道。所以只能"曲线救国":ArkTS 把 windowId 压进一个 Rust 全局队列,让 runtime-wry 每轮去 drain。

### 根因:模型不匹配

tao/winit 的设计假设:**窗口 = 事件源,WindowId = 路由 key,系统 API 按窗口分发事件**。Windows 的 HWND、Linux 的 X11 id、macOS 的 NSWindow delegate 都天然满足。

OHOS 的窗口模型是 **UIAbility + ArkUI 生命周期回调**:
- 事件源是 Ability 级别(`onWindowStageDestroy`),不是窗口级别;
- 回调不带窗口 id 给 Rust(`MainEvent::WindowDestroy` 无载荷);
- 一个进程多个 UIAbility 实例,全挤进同一个 tao event loop,却用同一个 ZST WindowId。

这是**两种世界观的冲突**。适配者面对的不是"没写好",而是"OHOS 模型和 tao 假设根本对不上",于是只能打补丁:ZST 占位、drain 旁路、no-op 屏蔽。每个补丁单独看都合理,叠起来就是当前这副样子。

### 更广影响:ZST WindowId 不只影响关窗

ZST WindowId 的影响**远不止关窗**。`window_id_map.get(&ZST)` 出现在 runtime-wry 的每个窗口事件路由点:

| 路由点 | runtime-wry 位置 | 多窗口下的后果 |
|---|---|---|
| `RedrawRequested` | `window_event_callback` match `RedrawRequested` | 重绘请求路由到错误窗口 |
| `WindowEvent`(Resized/Focused/键盘/鼠标) | `window_event_callback` match `WindowEvent` | **所有**窗口事件路由到最后插入的窗口 |
| `CloseRequested`/`Destroyed` | `window_event_callback` match 两个事件 | 关错窗口(已被 drain 补偿) |

也就是说:**OHOS 上只要存在多个窗口,非最后创建的窗口的几乎所有事件都会路由错误或丢失**。drain 只对"关窗"这一个点做了补偿,其他事件类型目前完全裸奔。

> **待验证**:Float 子窗口的输入事件(鼠标/键盘/触摸)可能走了独立 NAPI 通道直接送达,不经 tao `WindowEvent` 派发——若如此,则这些事件不受 ZST 影响。需运行时验证多窗口下第二个窗口的交互是否正常。若不正常,此问题优先级需上调。

### 根治路径(按代价从小到大)

**路径 1:给 `MainEvent::WindowDestroy` 加 `i32` 载荷(最小改动)**
ArkTS 的 `onWindowStageDestroy` 已有 `readWindowId()`,只需把这个值传给 Rust。把 `Event::WindowDestroy` 改成 `Event::WindowDestroy(i32)`。
- **收益**:覆盖系统销毁兜底路径(返回键、划任务、内存回收),用真实 windowId 精确派发 `Destroyed`,消除当前 no-op 导致的"系统直接销毁路径丢失 Destroyed"风险。
- **局限**:只解决关窗兜底,不解决 ZST 导致的其他事件路由问题。

**路径 2:让 tao 的 `WindowId` 携带真实 OHOS `i64`(治本)**
把 `platform_impl::WindowId` 从 ZST 改成 `struct WindowId(i64)`,让 `window_id_map` 能正确路由。
- **收益**:同时解决关窗和**所有其他事件类型**的路由问题(上节列出的全部路由点)。
- **代价**:改动面较大,需审计 tao OHOS 层所有 `window::WindowId(WindowId)` 构造点(都要传入真实 id)。

**路径 3:让 tao OHOS 层实现 `CloseRequested`/`Destroyed`(收尾)**
补齐其他平台都有的关窗事件实现,消除 runtime-wry 的 drain 旁路,让 OHOS 走和其他平台一样的单路径。
- **前提**:依赖路径 2(WindowId 带身份)才能正确派发。

**推荐顺序**:路径 2 是关键——它同时解决关窗和所有其他事件的路由问题。建议短期先做路径 1(低成本兜底,消除 no-op 风险),中期做路径 2 + 路径 3(根治,统一事件路由模型)。

### 当前正确性边界

在根治完成前,当前 `MainEvent::WindowDestroy` no-op + drain 组合的正确性边界:

| 销毁路径 | 是否派发 Destroyed | 说明 |
|---|---|---|
| 前端 JS `close()` | ✅ | 走 `Message::Window` → `on_close_requested` |
| Float 子窗口关闭按钮/菜单 | ✅ | 走 `notifyWindowClose` → drain |
| Float 子窗口系统关闭(`aboutToDisappear`) | ✅ | 同上 |
| UIAbility `onCloseWindow` | ✅ | 同上 |
| 系统返回键/划任务(主窗口) | ❌ | 走 `MainEvent::WindowDestroy` no-op,由 `LoopDestroyed` 兜底发 `ExitRequested` |
| 系统内存回收杀进程 | ❌ | 同上,进程退出兜底 |

旧代码(派发 CloseRequested+Destroyed)在这些路径上同样不可靠——因 ZST 碰撞会命中错误窗口。故当前 no-op 是净改进:消除"错误窗口被 Destroyed"的确定 bug,代价是极端路径下可能丢失"正确窗口的 Destroyed",而正确窗口的销毁本就由 drain 在 `notifyWindowClose` 触发时处理。

### 验证清单(根治前)

重构前需运行时验证以下场景,以校准上节"待验证"项的优先级:

- [ ] 多窗口下,非最后创建的 Float 子窗口:鼠标点击/拖拽是否生效
- [ ] 多窗口下,非最后创建的 Float 子窗口:键盘输入是否到达正确窗口
- [ ] 多窗口下,非最后创建的 Float 子窗口:resize 事件是否影响错误窗口
- [ ] 多窗口下,关闭非最后创建的窗口:主窗口 webview 是否被误移除(已由 drain 补偿,验证补偿有效性)
- [ ] 系统返回键关闭主窗口:`ExitRequested` 是否由 `LoopDestroyed` 正确兜底

---

## 问题二:inner_size / outer_size 语义错位

> **状态**:语义缺陷,与问题一无关。inner 与 outer 的读路径分离正确,但写路径 `set_inner_size` 实际改的是外尺寸,导致 inner/outer 语义错位、save→restore 不幂等。
>
> **关联代码**:
> - [tao `inner_size` / `outer_size` / `set_inner_size`](../../tao/src/platform_impl/ohos/mod.rs)

### 现象

`inner_size()` 与 `outer_size()` 的**读取**正确分离,但 `set_inner_size()` 的**写入**走的是改外尺寸的 API,名实不符:

| 操作 | 名义语义 | 实际行为 | 是否一致 |
|---|---|---|---|
| `inner_size()` 读 | 内容区尺寸 | 返回 XComponent rect(内容区) | ✅ 一致 |
| `outer_size()` 读 | 窗口外尺寸 | 返回 window_rect(OS 窗口含装饰) | ✅ 一致 |
| `set_inner_size()` 写 | 设置内容区尺寸 | 调 `win.resize` 设的是**外尺寸** | ❌ **不一致** |

### 数据来源:两个独立的 Rect

openharmony-ability 的 `AppInner` 维护两个矩形,由不同的 ArkTS 回调更新:

| 字段 | 更新来源 | 含义 |
|---|---|---|
| `rect` | XComponent 的 `on_surface_created` / `on_surface_changed` 回调 | XComponent 的 size + offset(WebView 渲染表面) |
| `window_rect` | OHOS `window.on("windowRectChange")` 回调 | OS 窗口的 rect(含标题栏等装饰) |

```
OHOS 层次: Screen → Window(window_rect) → Container → XComponent(rect)
                                   ↑ outer                  ↑ inner
```

### 实现详解

**`inner_size()`(读)**:
```rust
pub fn inner_size(&self) -> PhysicalSize<u32> {
  let rect = self.app.content_rect();   // ← XComponent 的 rect
  PhysicalSize::new(rect.width as _, rect.height as _)
}
```
返回 XComponent(WebView 渲染表面)尺寸——窗口内容区,不含标题栏/装饰。这是 OHOS 能提供的最接近"inner size"的值。

**`outer_size()`(读)**:
```rust
pub fn outer_size(&self) -> PhysicalSize<u32> {
  let window = self.app.window_rect();   // ← OS window rect
  if window.width > 0 && window.height > 0 {
    PhysicalSize::new(window.width as _, window.height as _)
  } else {
    let content = self.app.content_rect();   // 未初始化时回退
    PhysicalSize::new(content.width as _, content.height as _)
  }
}
```
返回 OS 窗口尺寸(含装饰);回退到 content_rect 是因为 `windowRectChange` 回调可能尚未触发(初始化竞态)。

**`set_inner_size()`(写)**:
```rust
pub fn set_inner_size(&self, size: Size) {
  let s = size.to_physical::<u32>(self.scale_factor());
  let _ = resize_window(self.ohos_win_id(), s.width as i64, s.height as i64);
}
```
→ ArkTS `WindowManager.resizeWindow` → OHOS `win.resize(width, height)`。

**关键错位**:OHOS 的 `win.resize(w, h)` 设置的是**整个 OS 窗口的外尺寸**(含标题栏),不是 inner。所以 `set_inner_size` 传进去的"inner"值被当成 outer 用了——传入 800×600,窗口外尺寸变 800×600,实际内容区 = 800×(600 − 标题栏高度)。

### 后果:save→restore 不幂等

旧代码(已被本 PR 改掉)曾让 `inner_size()` 也返回 window_rect(外尺寸),目的是让 save→resize 幂等:
```
旧: save inner_size(=outer) → resize(outer) → outer 不变 ✅ 幂等
```

新代码把 `inner_size()` 读改成正确的 content_rect(inner),写仍走 `win.resize`(outer),**save→restore 不再幂等**:
```
新: save inner_size(=content, 不含标题栏)
    → resize(content)              // win.resize 把 content 当外尺寸
    → 窗口外尺寸 = content
    → 实际内容区 = content − 标题栏 < 原值
```

**每次 save→restore 循环,窗口缩小一个标题栏高度。**

### 主窗口的特殊情况

主窗口(windowId=0,UIAbility)的 `win.resize` / `moveWindowTo` 返回 1300002("window state is abnormal")——UIAbility 主窗口系统管理。故 `set_inner_size` 对主窗口是静默 no-op(报错被 `.catch` 吞掉)。只有 Float 子窗口的 `set_inner_size` 真正生效,且承受上节的缩水问题。

### 正确做法

inner 就该对 inner,outer 就该对 outer。修复方向:

- **`set_inner_size` 应补偿标题栏高度**:在调 `win.resize` 前,把传入的 inner 尺寸加上装饰区高度(可从 avoid_area / window_rect − content_rect 推算),使 resize 后的内容区等于传入值。
- 或**openharmony-ability 提供 inner-aware 的 resize 封装**:由 ArkTS 侧读取标题栏高度后调 `win.resize(inner.w + decoration, inner.h + decoration)`,Rust 侧只传 inner 意图。
- `set_outer_size`(若暴露)则保持直接调 `win.resize`。

### 验证清单

- [ ] Float 子窗口:`set_inner_size(800,600)` 后,`inner_size()` 是否返回 800×600(而非更小)
- [ ] save→restore 循环 3 次:窗口是否逐次缩小(复现上节后果)
- [ ] 主窗口:`set_inner_size` 是否真的静默 no-op(不报错给上层)
- [ ] `outer_size()` 在 `windowRectChange` 未触发时回退 content_rect:是否导致 outer < 实际外尺寸

---

## 问题三:hide_window 语义错位与 OHOS API 限制

> **状态**:语义缺陷 + OHOS API 固有限制,与问题一、二无关。OHOS 没有通用的窗口级 hide API,`hideAbility` 仅 UIAbility 可用且带前置条件,Float 子窗口无真正 hide,当前用 `minimize` 冒充,行为不符预期;且 show/hide 不对称。
>
> **关联代码**:
> - [tao `set_visible`](../../tao/src/platform_impl/ohos/mod.rs) — 调 `hide_window` / `show_window`
> - [openharmony-ability Rust `hide_window`](../../openharmony-ability/crates/ability/src/window/mod.rs) — NAPI 转发到 ArkTS `hideWindow`
> - [ArkTS `WindowManager.hideWindow` / `hideAbility`](../../openharmony-ability/native_ability/src/main/ets/window/WindowManager.ets) — 按窗口类型分流

### 现象

`set_visible(false)` 在 OHOS 上没有统一的 hide 实现,按窗口类型分流到两个语义不同的 API:

| 窗口类型 | hide 实现 | OHOS API | 行为 |
|---|---|---|---|
| UIAbility 主窗口 | `hideAbility()` | `context.hideAbility()` | 整个 Ability 切后台,所有窗口不可见,进程存活 |
| Float 子窗口 | `win.minimize()` | `window.minimize()` | **能生效,但语义不符**:变成最小化态而非隐藏 |

### OHOS API 限制(根因)

#### 限制一:hideAbility 仅 UIAbility 可用

`context.hideAbility()` 是 `UIAbilityContext` 的方法,**只在 UIAbility 上下文里存在**。Float 子窗口是系统窗口(`createSubWindow` 创建),没有 UIAbilityContext,无法调用 hideAbility。代码里 `hideWindow` 的分流正是基于此([WindowManager.ets:413-423](../../openharmony-ability/native_ability/src/main/ets/window/WindowManager.ets)):

```typescript
hideWindow(windowId: number): void {
  if (this.isUIAbilityMainWindow(windowId)) {
    this.hideAbility();   // ← 仅 UIAbility 有 context
    return;
  }
  // Float 子窗口:无 hideAbility 可用,退而用 minimize
  const win = this.getWindow(windowId);
  win.minimize().catch(...);   // ← 冒充 hide
}
```

#### 限制二:hideAbility 需状态栏前置条件

`hideAbility` 不是无条件可用——应用必须预先在状态栏(StatusBar)注册/添加后,hideAbility 才能正常生效。未满足该前置条件时,hideAbility 无法正确隐藏(行为不可靠或无效)。

> 此限制来自实际开发验证,非代码注释。状态栏注册的具体方式与 module.json5 配置相关,后续需补充官方文档链接与精确配置说明。

#### 限制三:Float 子窗口无真正的 hide API

OHOS 系统窗口(`TYPE_FLOAT` 等)没有独立的 hideWindow API。当前用 `win.minimize()` 冒充,但 minimize 的语义是"最小化"(窗口进入最小化态、`getWindowStatus()` 返回 MINIMIZE),不是"隐藏"。运行时已确认:**Float 调 minimize 能生效,但行为不符 hide 预期**——`is_minimized()` 会误报 true(与 Windows/macOS 的 hide 不同,后者不改变最小化状态)。

### 实现详解

**① tao 层**([tao/mod.rs:1073-1077](../../tao/src/platform_impl/ohos/mod.rs)):
```rust
pub fn set_visible(&self, visibility: bool) {
  self.visible.store(visibility, Ordering::Release);   // 镜像状态
  let id = self.ohos_win_id();
  let _ = if visibility { show_window(id) } else { hide_window(id) };
}
```

**② openharmony-ability Rust**([window/mod.rs:493-501](../../openharmony-ability/crates/ability/src/window/mod.rs)):
```rust
/// `set_visible(false)` → main window hideAbility; sub-window minimize
/// (OHOS has no standalone hide API).
pub fn hide_window(window_id: i64) -> napi_ohos::Result<()> {
    // ... NAPI 调 ArkTS hideWindow(windowId)
}
```

**③ ArkTS 分流**([WindowManager.ets:413-423](../../openharmony-ability/native_ability/src/main/ets/window/WindowManager.ets)):
- UIAbility 主窗口 → `hideAbility()` → `context.hideAbility()`(整 Ability 后台)
- Float 子窗口 → `win.minimize()`(冒充 hide,语义不符)

### 后果一:Float hide 语义不符

Float 子窗口 `set_visible(false)` 后:
- 窗口确实不可见(minimize 生效);
- 但 `getWindowStatus()` 返回 MINIMIZE,`is_minimized()` 误报 true;
- 与其他平台 hide 语义不一致(其他平台 hide 不改变最小化状态)。

旧代码注释(本 PR 已删)曾说明此副作用:
> OHOS has no direct window-hide API, so set_visible(false) uses minimize as a
> workaround. Side effect: getWindowStatus() returns MINIMIZE afterwards, so
> is_minimized() returns true (unlike Windows/macOS hide).

### 后果二:show/hide 不对称

`hide_window` 与 `show_window` 的语义不对称,这是 OHOS 限制的直接体现:

| 操作 | 主窗口 | 子窗口 |
|---|---|---|
| `hide_window` | `hideAbility()`(整 Ability 后台) | `win.minimize()` |
| `show_window` | `win.showWindow()` | `win.showWindow()` |

Rust 侧注释明确([window/mod.rs:419](../../openharmony-ability/crates/ability/src/window/mod.rs)):
> `showWindow only restores hidden subwindows, not minimized main windows.`

- **子窗口**:hide=minimize,show=showWindow,minimize→showWindow 能恢复,**对称**。
- **主窗口**:hide=hideAbility(切后台),show=showWindow(只显示窗口,不恢复 Ability 到前台)。**hide 后用 show 无法真正恢复**——Ability 在后台时 `showWindow` 不把它拉回前台,需要 `context.startAbility` 或用户点任务卡片。

### 正确做法

hide 就该对 hide,show 就该对 show。修复方向:

- **Float 子窗口**:无真正 hide API,只能用 minimize 冒充。应在 `set_visible` 文档/返回值明确告知"Float hide 实为 minimize,`is_minimized` 会变 true",让上层有预期;或上层对 Float 用 `destroy` + 重建代替 hide。
- **UIAbility 主窗口**:
  - hide 前确保状态栏前置条件已满足(应用已注册到状态栏),否则 hideAbility 不可靠。
  - show 路径不能只用 `showWindow`,需 `context.startAbility` 把 Ability 拉回前台,与 hideAbility 对称。
- **长期**:推动 openharmony-ability 封装统一的 hide/show 语义,内部按窗口类型正确分流,对外只暴露一致的 `hide_window` / `show_window`。

### 验证清单

- [ ] UIAbility 主窗口 `set_visible(false)`:未注册状态栏时 hideAbility 是否失效
- [ ] UIAbility 主窗口 hide 后 `set_visible(true)`:showWindow 能否恢复(预期不能,需 startAbility)
- [ ] Float 子窗口 `set_visible(false)` 后 `is_minimized()`:是否误报 true
- [ ] Float 子窗口 hide(minimize)后 show(showWindow):能否正确恢复
- [ ] 状态栏前置条件的精确配置(module.json5 字段)待补充官方文档链接

---

## 问题四:set_minimizable / set_maximizable / set_closable 语义错位

> **状态**:语义缺陷,与问题一~三无关。这三个 setter 名义上是"控制窗口能否被最小化/最大化/关闭",实际只控制装饰按钮的显隐,完全不拦截编程式 API,与应有语义是两回事。
>
> **关联代码**:
> - [tao `set_minimizable` / `set_maximizable` / `set_closable` / `set_resizable`](../../tao/src/platform_impl/ohos/mod.rs) — 位域打包,派发到 ArkTS
> - [ArkTS `WindowManager.setDecorationFlags`](../../openharmony-ability/native_ability/src/main/ets/window/WindowManager.ets) — 写 LocalStorage
> - [FloatPage `@LocalStorageProp`](../../openharmony-ability/native_ability/src/main/ets/components/FloatPage.ets) — 仅用于按钮显隐

### 现象

三个 setter 的应有语义是"控制窗口**能否**执行某操作"(最小化/最大化/关闭),与其他平台一致——例如 Windows 上 `set_minimizable(false)` 应让系统拦截最小化。但 OHOS 实现实际只控制装饰按钮的**显隐**,与应有语义无关:

| setter 名义语义 | 实际行为 | 是否一致 |
|---|---|---|
| `set_minimizable(false)` | 隐藏 FloatPage 最小化按钮 | ❌ 仅 UI,不拦截 `set_minimized(true)` |
| `set_maximizable(false)` | 隐藏 FloatPage 最大化按钮 | ❌ 仅 UI,不拦截 `set_maximized(true)` |
| `set_closable(false)` | 隐藏 FloatPage 关闭按钮 | ❌ 仅 UI,不拦截 `close()` / `destroy_window()` |
| `set_resizable(false)` | 隐藏 resize handle | ❌ 仅 UI,不拦截 `set_inner_size()` |

### 实现详解

**① tao 层**([tao/mod.rs:1099-1121](../../tao/src/platform_impl/ohos/mod.rs))—— 位域打包:
```rust
const FLAG_CLOSABLE: u8 = 1;      // bit0
const FLAG_MAXIMIZABLE: u8 = 2;   // bit1
const FLAG_MINIMIZABLE: u8 = 4;   // bit2
const FLAG_RESIZABLE: u8 = 8;     // bit3

pub fn set_minimizable(&self, minimizable: bool) {
  self.set_decoration_flag(FLAG_MINIMIZABLE, minimizable);
}
// set_maximizable / set_closable / set_resizable 同理

fn set_decoration_flag(&self, flag: u8, on: bool) {
  let mut flags = self.decoration_flags.load(Ordering::Acquire);
  if on { flags |= flag; } else { flags &= !flag; }
  self.decoration_flags.store(flags, Ordering::Release);   // 本地镜像
  let _ = set_window_decoration_flags(self.ohos_win_id(), flags);  // 派发到 ArkTS
}
```

**② ArkTS 层**([WindowManager.ets:474-488](../../openharmony-ability/native_ability/src/main/ets/window/WindowManager.ets))—— 写 LocalStorage:
```typescript
setDecorationFlags(windowId, flags) {
  if (this.isUIAbilityMainWindow(windowId)) { return; }  // 主窗口 no-op
  entry.storage.setOrCreate('closable', (flags & 1) !== 0);
  entry.storage.setOrCreate('maximizable', (flags & 2) !== 0);
  entry.storage.setOrCreate('minimizable', (flags & 4) !== 0);
  entry.storage.setOrCreate('resizable', (flags & 8) !== 0);
}
```

**③ FloatPage 消费**([FloatPage.ets:155, 221](../../openharmony-ability/native_ability/src/main/ets/components/FloatPage.ets))—— **仅用于按钮显隐**:
```typescript
if (this.decorations && this.closable) {   // ← 关闭按钮显隐
  Button() { Image($r('sys.media.ohos_ic_public_cancel')) ... }
}
if (this.isDesktop && this.windowClass && this.resizable) {   // ← resize handle 显隐
  // Right edge resize handle ...
}
```

整条链路里**没有任何一处**检查这些 flag 来拦截 `set_minimized` / `set_maximized` / `close` / `set_inner_size`。

### 后果

1. **`set_minimizable(false)` 后仍可最小化**:`set_minimized(true)` 不检查 `decoration_flags`,窗口照样最小化。按钮隐藏只是视觉欺骗,不构成能力限制。
2. **`set_closable(false)` 后仍可关闭**:`close()` / `destroy_window()` 不检查 flag,窗口照样关闭。
3. **`is_minimizable()` 等查询返回假承诺**:tao 从本地 `AtomicU8` 位域读([mod.rs:1200-1214](../../tao/src/platform_impl/ohos/mod.rs)),返回"true"只表示"按钮可见",不表示"系统允许最小化"。上层据此判断会误判。
4. **主窗口完全 no-op**:UIAbility 主窗口的装饰由系统提供,`setDecorationFlags` 直接 return,这些 setter 对主窗口无任何效果(连按钮显隐都做不到)。

### 正确做法

这三个 setter 应真正控制"能否"而非"按钮显隐"。修复方向:

- **拦截编程式 API**:`set_minimized` / `set_maximized` / `close` / `set_inner_size` 在 tao 层执行前先检查对应 `decoration_flags` 位,为 0 时直接 return(或返回 Err)。
- **FloatPage 按钮显隐保留**:UI 层的 `@LocalStorageProp` 消费可继续保留(视觉一致性),但拦截逻辑必须放在 API 执行路径,而非 UI 层。
- **主窗口**:UIAbility 主窗口装饰系统管理,这些 setter 本就应 no-op 或文档说明"主窗口不支持"。

### 验证清单

- [ ] `set_minimizable(false)` 后调 `set_minimized(true)`:窗口是否仍最小化(预期仍最小化 = bug)
- [ ] `set_closable(false)` 后调 `close()`:窗口是否仍关闭(预期仍关闭 = bug)
- [ ] `set_resizable(false)` 后调 `set_inner_size()`:窗口是否仍 resize(预期仍 resize = bug)
- [ ] `is_minimizable()` 在 `set_minimizable(false)` 后返回 false,但实际仍能最小化——确认查询与行为不符

---

## 问题五:Window Atomic 镜像位与 ArkTS 真实状态不同步

> **状态**:系统性缺陷,横跨问题一~四。tao `Window` 结构体堆砌了大量 `AtomicBool`/`AtomicU8` 镜像位,用于在 Rust 侧快速读窗口状态,但这些位与 ArkTS 侧的真实状态缺乏双向同步机制,极易脱节。
>
> **5.2/5.3 已实现(方案 A:事件回灌,2026-08-14)**:补 `windowStatusChange` 事件回灌链路,让 `visible`/`fullscreen` 镜像位由系统回灌维护;theme 改全局 `APP_THEME_OVERRIDE` + `app.config().color_mode`(`onConfigurationUpdated` 已自动刷新)。已全量编译通过(`cargo tauri ohos build --device-type desktop --features prod`),NAPI `notifyWindowStatus` 导出已生成。真机验证清单见下文。实现详见 [memory: ohos-window-status-readback-fix]。
>
> **关联代码**:
> - [tao `Window` 结构体 Atomic 字段](../../tao/src/platform_impl/ohos/mod.rs) — 8 个镜像位
> - [tao 各 `is_*` 查询方法](../../tao/src/platform_impl/ohos/mod.rs) — 读源不一致(部分读本地,部分查系统)

### 现象

`Window` 结构体维护 8 个 Atomic 镜像位:

| 字段 | 类型 | 读源(`is_*`/`fullscreen`) | 写源(`set_*`) | 同步情况 |
|---|---|---|---|---|
| `theme` | AtomicU8 | 本地 | `set_theme` store | 单向,系统主题变化不回灌 |
| `decorations` | AtomicBool | 本地(`is_decorated`) | `set_decorations` store | 单向 |
| `transparent` | bool(非 Atomic) | 本地 | 构造时定,不可变 | ✅ 正确(immutable) |
| `maximized` | AtomicBool | **查系统**(`is_maximized`→`is_window_maximized`) | **从不 store** | ❌ **僵尸字段** |
| `minimized` | AtomicBool | **查系统**(`is_minimized`→`is_window_minimized`) | **从不 store** | ❌ **僵尸字段** |
| `visible` | AtomicBool | 本地(`is_visible`) | `set_visible` store | 单向 |
| `fullscreen` | AtomicBool | 本地(`fullscreen()`) | `set_fullscreen` store | 单向 |
| `always_on_top` | AtomicBool | 本地(`is_always_on_top`) | `set_always_on_top` store | 单向(且 OHOS 无 API 执行,纯意图) |
| `decoration_flags` | AtomicU8 | 本地(`is_resizable` 等) | `set_decoration_flag` store | 单向(见问题四) |

### 三类问题

#### 问题 5.1:maximized / minimized 是僵尸字段

`maximized` 和 `minimized` 两个字段在初始化时设为 false([mod.rs:972-973](../../tao/src/platform_impl/ohos/mod.rs)),之后**既无 store 也无 load**(全代码库零匹配)。`is_maximized`/`is_minimized` 实际查的是 OHOS 系统 API:

```rust
pub fn is_maximized(&self) -> bool {
  let id = self.ohos_win_id();
  is_window_maximized(id).unwrap_or_else(|e| { ...; false })   // ← 查系统,不读 self.maximized
}
pub fn is_minimized(&self) -> bool {
  is_window_minimized(id).unwrap_or_else(...)                   // ← 同上
}
```

这两个字段是**纯死代码**——占内存、误导维护者以为有镜像,实际从未使用。`set_maximized`/`set_minimized` 也不更新它们。

#### 问题 5.2:单向写不回读(visible / fullscreen / decorations / always_on_top / theme / decoration_flags)

这 6 个字段在 `set_*` 时 store 到本地,`is_*`/`fullscreen()` 从本地读。但 **OHOS 系统侧的状态变化不会回灌**:

- 用户点系统最大化按钮 → OHOS 窗口进入最大化态 → tao 的 `maximized`(即便它被用)仍是 false。
- 系统因内存压力最小化窗口 → tao 的 `visible` 仍是 true。
- 系统全屏状态被外部改变 → tao 的 `fullscreen` 仍是旧值。

`is_visible()` 返回本地 `visible`,**不反映系统真实可见性**。上层据此判断"窗口是否可见"会误判。

> 注:`maximized`/`minimized` 若按 5.1 描述查系统,反而是这堆字段里**唯一读源正确**的——但它们本身的僵尸状态仍是冗余。

#### 问题 5.3:无系统状态回灌机制

根因是 OHOS 侧的窗口状态变化事件(`windowStageEvent`、`windowSizeChange` 等)没有回灌到 tao 的这些 Atomic 位。ArkTS 的 `windowStageEvent` 回调([NativeAbility.ets](../../openharmony-ability/native_ability/src/main/ets/ability/NativeAbility.ets))只 forward 到 `MainEvent::ContentRectChange` 等,不更新 tao Window 的 `maximized`/`minimized`/`visible`/`fullscreen`。

> **回灌主信号选型(已定)**:用 `window.on("windowStatusChange")` + `win.getWindowStatus()`(API 11+,`SystemCapability.WindowManager.WindowManager.Core`),`WindowStatusType` 枚举 `FULL_SCREEN=1 / MAXIMIZE=2 / MINIMIZE=3 / FLOATING=4 / SPLIT_SCREEN=5` 恰好覆盖。**不是** `windowRectChange`:`RectChangeReason`(API 12+)的 `MAXIMIZE` 把 maximize 与 fullscreen 合并、且**无 MINIMIZE** 态,无法表达最小化,故不能作主信号。`windowStageEvent` 的 `MINIMIZED` 等是 ability 级生命周期、粒度粗,亦不取。

对比其他平台:Windows 的 `WM_SIZE`/`WM_SHOWWINDOW`、macOS 的 `windowDidMiniaturize:` 等NSEvent 都会同步更新 tao 的窗口状态字段。OHOS 缺这条回灌链路。

### 后果

1. **`is_visible()` 不可信**:系统最小化/隐藏窗口后,`is_visible()` 仍返回本地 store 的 true。
2. **`fullscreen()` 不可信**:系统全屏态变化不回灌,`fullscreen()` 返回旧值。
3. **僵尸字段误导**:`maximized`/`minimized` 字段存在但无用,维护者可能误以为已镜像、据此写代码,埋下隐患。
4. **与问题四叠加**:`is_resizable` 等读 `decoration_flags` 本地镜像,而该位只被 `set_*` 更新、不被系统回灌,查询结果与系统实际装饰状态可能脱节。

### 正确做法

- **删除僵尸字段**:`maximized`/`minimized` 既不被读也不被写,直接删除,避免误导。`is_maximized`/`is_minimized` 已查系统,不依赖它们。
- **统一读源策略**:每个状态要么"始终查系统"(如 maximized/minimized,准确但慢),要么"本地镜像 + 系统回灌"(如 visible/fullscreen,快但需同步)。不可"本地写、不回灌"。
- **补系统状态回灌(已实现)**:用 `window.on("windowStatusChange")` + `win.getWindowStatus()` seed 初始态,经 NAPI `notifyWindowStatus(windowId, status)` → `PENDING_WINDOW_STATUS` 队列 → `drain_pending_window_status()` → wry 用真实 windowId 路由到对应 tao Window 调 `apply_window_status(status)` 更新 `visible`/`fullscreen` 镜像。链路复制自 `notify_window_close`/`drain_pending_window_closes`,**不依赖 tao ZST WindowId**,多窗口下正确(与问题一治本解耦)。两个注册点:UIAbility 主窗口([NativeAbility.ets](../../openharmony-ability/native_ability/src/main/ets/ability/NativeAbility.ets))、Float 子窗口([FloatPage.ets](../../openharmony-ability/native_ability/src/main/ets/components/FloatPage.ets)),均 try/catch 静默降级。
- **`always_on_top`** 因 OHOS 无 API,本质是纯意图标志(无系统态可同步),可保留本地镜像但文档说明"仅意图,不反映系统"。
- **theme(已实现)**:删 per-window `theme` 字段,改全局 `APP_THEME_OVERRIDE`(`Light`/`Dark`/`Follow`);`Follow` 时 `theme()` 回退 `app.config().color_mode`(由 `onConfigurationUpdated` 自动刷新),无需新通道。`set_theme` 写 `APP_THEME_OVERRIDE` + dispatch `setColorMode`。

### 验证清单(2026-08-14 真机人工验证,设备 HAD-W32 API23 desktop)

> 验证方法:临时给 `notify_window_status`/`apply_window_status`/`ConfigChanged`/`theme()` 四处加 `log::info!` 诊断日志 → 重编装设备 → 操作设备抓 hilog → 验证后撤回诊断日志(源码已恢复正式态)。日志 tag `tauritest`(Rust,domain 0xA00000)+ `NativeAbility`/`FloatPage`(ArkTS,domain 0x1999)。

- [x] `maximized`/`minimized` 字段全代码库零 store/零 load(确认僵尸)
- [x] `windowStageEvent` 回调是否回灌到 tao Window 的任何 Atomic 字段(已实现 — 改走 `windowStatusChange` 回灌 `visible`/`fullscreen`)
- [x] 系统最大化窗口后 `is_maximized()`:返回 true(autotest `maximize then is_maximized reflects state` 通过;日志 status=2 → apply)
- [x] 系统最小化窗口后回灌:日志 status=3(MINIMIZE)→ `apply_window_status` visible=false(操作设备亲见)
- [x] 最大化→还原:status=2(MAXIMIZE)→ 4(FLOATING),系统 Recover 动画 + rect 回复(亲见)
- [x] `set_fullscreen(true)`→系统退出全屏:status=1(FULL_SCREEN)→apply fullscreen=true;退出 status=4→apply fullscreen=false(亲见)
- [x] 深浅色切换 → `theme()` 反映系统:系统设置切深↔浅,`ConfigChanged recv: color_mode=Light`(09:53:20)/`=Dark`(09:53:22),`theme()` FOLLOW 分支读此值(亲见)
- [x] 多窗口不串扰(UIAbility 子窗口):开 Window A/B,日志 `notify_window_status recv` window_id=0(主)/12/13 各自独立,`apply_window_status` 全命中无 `no matching`(亲见)
- [x] Float TYPE_FLOAT 子窗口:开 borderless Float 窗口 14/15,FloatPage.aboutToAppear 注册 + seed status=4 触发,window_id=14/15 路由命中(亲见)。seed 恒 FLOATING(4);minimize/maximize 的 status 变化未单独点测(非核心)
- [x] 回灌链路端到端:`notify_window_status recv` + `apply_window_status applied` 成对出现,真实 windowId 路由,wry drain 无 `no matching Tauri window` 警告
- [x] 回归(autotest):257 passed / 4 failed(连跑两遍一致),4 个失败均与改动无关(#33 Resumed 生命周期、#86 clipboard write_text 不支持、#122 websocket 连接拒绝、#144 maximize innerSize 受 avoid-area 影响——均改动前既有)
- [ ] 手机端(mobile 构建):`windowStatusChange` 注册 try/catch 不崩;`is_maximized`/`is_minimized` 恒 false 符合预期 — 需 `OHOS_DEVICE_TYPE=mobile` 构建,未测(消极验证:不崩即过)

---

## 问题六:set_cursor_visible / set_ignore_cursor_events / set_cursor_icon / set_always_on_top 尚未测试

> **状态**:待测试。四个函数中三个已真实 dispatch 到 OHOS 系统 API 但运行时行为未经真机验证;`set_always_on_top` 是 no-op(根因是 OHOS 无 z-order 公开 API,已在问题五镜像位表中列出)。此处聚焦"未测试"这一遗留项,不复述 no-op 本身。
>
> **关联代码**:
> - [tao `set_cursor_visible` / `set_cursor_icon` / `set_ignore_cursor_events` / `set_always_on_top`](../../tao/src/platform_impl/ohos/mod.rs) — 四个函数实现
> - [openharmony-ability `set_pointer_visible` / `set_pointer_style` / `set_window_touchable`](../../openharmony-ability/crates/ability/src/window/mod.rs) — 桥接层
> - [ArkTS `setPointerVisible` / `setPointerStyle` / `setWindowTouchable`](../../openharmony-ability/native_ability/src/main/ets/window/WindowManager.ets) — 系统调用落点

### 现象

这四个光标/置顶相关接口在 OHOS 适配中已有实现,但**从未在真机测试中覆盖**(autotest 无对应用例,manual_tests 无对应手动步骤)。代码静态检视显示前三者确实调到了系统 API,但"调到了"不等于"行为符合 tao 语义"——OHOS 各系统 API 的实际效果、前置条件、副作用需真机验证。

### 四个函数的实现现状

| 函数 | tao 实现 | 桥接层 | ArkTS 系统调用 | 性质 |
|------|---------|--------|---------------|------|
| `set_cursor_visible(visible)` | dispatch | `set_pointer_visible` | `pointer.setPointerVisible` | **全局**光标显隐,非窗口级 |
| `set_ignore_cursor_events(ignore)` | dispatch,`touchable=!ignore` 翻转 | `set_window_touchable` | `win.setWindowTouchable` | 窗口级点击穿透 |
| `set_cursor_icon(icon)` | dispatch,经 `ohos_pointer_style` 映射 | `set_pointer_style` | `pointer.setPointerStyleSync` | 按 windowId 设光标样式 |
| `set_always_on_top(b)` | **no-op** + warn,仅 `always_on_top.store` | 无 | 无 | OHOS 无 z-order API(见问题五) |

前三者代码路径完整,问题在于**未验证**;第四者代码已诚实标注 no-op,问题在于**无 API 可接**。

### 待验证的语义风险点(前三者)

1. **`set_cursor_visible` 作用域**:tao 语义是窗口级光标显隐,OHOS `pointer.setPointerVisible` 是**全局**光标显隐(影响整个设备所有窗口,非当前窗口)。多窗口下隐藏 A 窗口光标会连带隐藏 B 窗口——与 tao 语义不符。需真机确认作用域。
2. **`set_ignore_cursor_events` 的 touchable 翻转**:tao `ignore=true` = 忽略光标事件(点击穿透);OHOS `setWindowTouchable(true)` = 可触摸、`false` = 穿透。当前代码 `touchable = !ignore` 方向正确,但需验证:
   - 穿透模式下窗口是否仍可见但不响应触摸;
   - 穿透事件是否落到下层窗口(Float 子窗口穿透到主窗口的预期行为);
   - `setWindowTouchable` 在主 UIAbility 窗口与 Float 子窗口上行为是否一致。
3. **`set_cursor_icon` 的 style 映射**:`ohos_pointer_style` 把 tao `CursorIcon` 枚举映射到 OHOS `PointerStyle` 整数。需验证:
   - 映射表是否覆盖 tao 全部变体(漏映射会落到默认箭头);
   - `setPointerStyleSync` 在触摸态设备(无光标显示)上是否报错或静默无效;
   - 按 windowId 设置是否对 Float 子窗口生效(PointerStyle 是否区分窗口)。
4. **`set_always_on_top` 的 no-op 影响**:Float 子窗口天然浮于主窗口之上(系统行为),故 Float 上调 `set_always_on_top(true)` 看似"生效"但实为系统默认;主窗口上调则完全不生效,仅 store 本地镜像位(问题五已记)。需验证用户是否依赖此 API 做 z-order 排列。

### 后果

1. **静默失效风险**:前三者若 dispatch 失败,仅 `log::warn!` 记录,不返回 `Err`(`set_ignore_cursor_events` 甚至直接 `Ok(())`)。调用方无法感知失败,会以为已生效。
2. **多窗口语义错位**:`set_cursor_visible` 全局作用域与 tao 窗口语义不符,多窗口下产生意外连带效果(已记于上表第 1 点)。
3. **`is_always_on_top()` 不可信**:读本地镜像,而 `set_always_on_top` 是 no-op,镜像与系统真实 z-order 无任何关系(问题五镜像位表已列)。
4. **无测试兜底**:autotest 无覆盖,后续重构这些函数时无回归保障,容易改坏而不自知。

### 正确做法

- **补测试(首要)**:为前三者补真机手动用例与(可行的)autotest 用例。验证清单见下。`set_always_on_top` 因无 API,测试重点改为"确认 no-op 行为符合预期 + warn 日志产出"。
- **`set_cursor_visible` 作用域确认**:真机验证后,若确为全局作用域且 OHOS 无窗口级光标显隐 API,在文档与 tao 注释中明确标注"OHOS 为全局光标显隐,非窗口级",避免调用方误用;若存在窗口级 API(需查 SDK 更新),改用窗口级。
- **`set_always_on_top` 根治路径**:依赖 OHOS 后续开放 `setWindowType` / z-level API。开放前保留 no-op + warn,不引入本地镜像位的虚假"已置顶"假象——可考虑不再 store(与问题五"删僵尸/单向写"方向一致)。

### 验证清单(待真机执行)

- [ ] `set_cursor_visible(false)`:当前窗口光标是否隐藏;**其他窗口**光标是否也被隐藏(验证全局 vs 窗口级)
- [ ] `set_cursor_visible(true)` 恢复:光标是否恢复显示
- [ ] `set_ignore_cursor_events(true)`:当前窗口是否可穿透(可见但点击落到下层);`false` 恢复后是否重新响应触摸
- [ ] `set_ignore_cursor_events` 在主 UIAbility 窗口与 Float 子窗口上行为是否一致
- [ ] `set_cursor_icon(各变体)`:逐一验证光标样式是否正确切换;映射表是否有漏映射变体(漏者落默认箭头)
- [ ] `set_cursor_icon` 在触摸态设备(无光标显示)上:是否报错或静默无效
- [ ] `set_cursor_icon` 对 Float 子窗口是否生效(PointerStyle 是否区分窗口)
- [ ] `set_always_on_top(true)` 主窗口:warn 日志是否产出;`is_always_on_top()` 返回值(预期 true,但为本地镜像非系统态)
- [ ] `set_always_on_top(true)` Float 子窗口:是否因系统默认浮于主窗口而看似"生效"
- [ ] autotest / manual_tests 是否有对应用例(预期否,待补)
