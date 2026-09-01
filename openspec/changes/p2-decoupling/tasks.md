# Implementation Tasks: Phase 2 — 内部重构

## 2.1 Cursor 全局删除 + tao 本地缓存

- [ ] **2.1** tao `handle_mouse_event` Move 分支存 `self.cursor_x/y`
  - 文件: `tao/src/platform_impl/ohos/mod.rs`
  - 在 Move 分支中缓存 `mouse_event.x/y` 到本地字段
  - 添加 `cursor_x: AtomicI32` / `cursor_y: AtomicI32` 或等效本地存储

- [ ] **2.2** tao `cursor_position()` 改读本地缓存
  - 文件: `tao/src/platform_impl/ohos/mod.rs`
  - 删除 `openharmony_ability::CURSOR_POSITION_X/Y.load(...)` 调用
  - 改读 `self.cursor_x/y` 本地缓存

- [ ] **2.3** 删除 `app.rs` cursor 全局 + NAPI 入口
  - 文件: `openharmony-ability/crates/ability/src/app.rs`
  - 删除 `CURSOR_POSITION_X`/`CURSOR_POSITION_Y` 全局变量
  - 删除 `update_cursor_position` NAPI 函数
  - 删除 ArkTS `onMouse→NAPI` 旁路（若存在对应 ArkTS 代码）

- [ ] **2.4** 验证 cursor 行为回归
  - 编译: `cargo check --target aarch64-unknown-linux-ohos`
  - 设备端验证: 鼠标移动后 `cursor_position()` 返回最新坐标

## 2.2 Waker 全局评估

- [ ] **2.5** 评估 tao EventLoop waker 可行性
  - 文件: `openharmony-ability/crates/ability/src/waker.rs`
  - 文件: `openharmony-ability/crates/ability/src/app.rs`（`create_waker` 调用点）
  - 确认 tao `ProxyJsHelper`/EventLoopProxy 是否可独立唤醒主线程
  - 若可复用: 删除 `WAKER` 全局 + `waker.rs` 模块 + `app.rs:create_waker`
  - 若不可复用: 保留 `waker.rs`，加中性化注释说明"运行时集成层基础设施"角色

## 2.3 TSFN 全局删除

- [ ] **2.6** 删除 helper/account.rs 3 个 TSFN 全局
  - 文件: `openharmony-ability/crates/ability/src/helper/account.rs`
  - grep 确认零活跃引用后删除

- [ ] **2.7** 删除 helper/opener.rs 2 个 TSFN 全局
  - 文件: `openharmony-ability/crates/ability/src/helper/opener.rs`
  - grep 确认零活跃引用后删除

- [ ] **2.8** 删除 helper/autostart.rs 3 个 TSFN 全局
  - 文件: `openharmony-ability/crates/ability/src/helper/autostart.rs`
  - grep 确认零活跃引用后删除

- [ ] **2.9** 删除 helper/restart.rs 1 个 TSFN 全局
  - 文件: `openharmony-ability/crates/ability/src/helper/restart.rs`
  - grep 确认零活跃引用后删除

- [ ] **2.10** 删除 helper/permission.rs 1 个 TSFN 全局
  - 文件: `openharmony-ability/crates/ability/src/helper/permission.rs`
  - grep 确认零活跃引用后删除

- [ ] **2.11** 删除 helper/updater.rs 3 个 TSFN 全局
  - 文件: `openharmony-ability/crates/ability/src/helper/updater.rs`
  - grep 确认零活跃引用后删除

## 2.4 Unsoundness 修复

- [ ] **2.12** 修复 helper/mod.rs ptr::read + ManuallyDrop (#1, #2, #5)
  - 文件: `openharmony-ability/crates/ability/src/helper/mod.rs`
  - `std::mem::forget(helper)` → 安全 handle 持有 ownership
  - `ptr::read` + `ManuallyDrop` 包裹 `ObjectRef` → NAPI safe handle API + 显式生命周期
  - 移除 `ManuallyDrop` import

- [ ] **2.13** 修复 app.rs run_loop transmute (#3)
  - 文件: `openharmony-ability/crates/ability/src/app.rs`
  - `transmute<Box<dyn FnMut(Event)+'a>, Box<dyn FnMut(Event)+'static+Sync+Send>>` → 安全回调封装
  - 保持功能等价

- [ ] **2.14** 修复 app.rs on_back_press_intercept transmute (#4)
  - 文件: `openharmony-ability/crates/ability/src/app.rs`
  - 同款 transmute → 安全回调封装

## 2.5 Close 队列 + GLOBAL_DISPATCHER

- [ ] **2.15** 删除 menu/event.rs GLOBAL_DISPATCHER
  - 文件: `openharmony-ability/crates/ability/src/menu/event.rs`
  - 确认零活跃引用后删除 `GLOBAL_DISPATCHER` + `MenuEventDispatcher` 相关代码

- [ ] **2.16** close 队列注释中性化
  - 文件: `openharmony-ability/crates/ability/src/app.rs`
  - `PENDING_WINDOW_CLOSES`/`notify_window_close`/`drain_pending_window_closes` 注释
  - 移除 `tauri-runtime-wry`/`WindowsStore`/`tao ZST WindowId` 引用
  - 替换为中性术语（如 "consumer event loop"）
