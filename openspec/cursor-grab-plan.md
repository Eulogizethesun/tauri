# cursor-grab 适配计划

**创建时间**:2026-08-19
**功能描述**:窗口光标抓取 `set_cursor_grab` 从「平台限制空实现(Err NotSupported)」升级为真实实现,基于 OHOS NDK C API `OH_WindowManager_LockCursor`/`UnlockCursor`(API 22+,`ohos.permission.LOCK_WINDOW_CURSOR` normal 级 system_grant 开放权限)
**判断依据**:涉及 4 个代码层(openharmony-ability ArkTS/Rust、tao、tauri-cli 模板、examples/api),预估 11 个文件

## 已核实事实(设计输入)

- **C API**(本地 SDK `oh_window.h:386/402` + 官方文档 capi-oh-window-h 交叉验证):
  - `int32_t OH_WindowManager_LockCursor(int32_t windowId, bool isCursorFollowMovement)` — @permission ohos.permission.LOCK_WINDOW_CURSOR @since 22
  - `int32_t OH_WindowManager_UnlockCursor(int32_t windowId)` — 同权限同版本
  - 库:`libnative_window_manager.so`(本地 sysroot llvm-nm 确认公开导出)
- **行为约束**:仅获焦窗口生效;失焦自动解除锁定;`isCursorFollowMovement=true` 光标跟随移动(限制在窗口区域内)、`=false` 冻结光标
- **错误码**:`OK=0` / `NO_PERMISSION=201` / `DEVICE_NOT_SUPPORTED=801` / `STATE_ABNORMAL=1300002` / `SYSTEM_ABNORMAL=1300003`
- **无 ArkTS 层 API**(SDK ets/api 全量 grep 确认)→ 唯一路径是 NDK FFI 从 Rust 直调
- **windowId 语义**:C API 需要真实 OHOS windowId(= ArkTS `getWindowProperties().id`),tao 内部 id(主窗口=0)不可直接传
- **设备**:MateBook Pro HAD-W24,HarmonyOS 6.1.0.117(API ≥ 22)✅ 满足运行时要求
- **用户决策**:`isCursorFollowMovement` 固定传 **true**(与 Windows ClipCursor confined 语义一致)

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | 底层实现 | p1-cursor-grab | ✓ 已归档 | openharmony-ability(ArkTS + Rust)+ tao | 5 | cargo check + 真机 hilog 冒烟 |
| 2 | 权限与端到端验证 | p2-cursor-grab | ✓ 已归档 | tauri-cli 模板 + examples/api + 文档 | 6 | 设备端手动测试(锁定/解锁/失焦) |

## Phase 详细说明

### Phase 1: 底层实现
- **目标**:打通 tao `set_cursor_grab` → openharmony-ability → `OH_WindowManager_LockCursor/UnlockCursor` FFI 链路
- **文件列表**:
  1. `openharmony-ability/native_ability/src/main/ets/window/WindowManager.ets` — 新增 `getRealWindowId(windowId): number`(复用 `getWindow()` + `getWindowProperties().id`)
  2. `openharmony-ability/native_ability/src/main/ets/ability/ArkHelper.ets` — helper 对象新增 `getRealWindowId` 属性
  3. `openharmony-ability/native_ability/src/main/ets/ability/type.ets` — helper 类型接口新增声明
  4. `openharmony-ability/crates/ability/src/window/mod.rs` — 新增 `set_cursor_grab(window_id, grab)`(NAPI 同步查 realWindowId + `#[link(name = "native_window_manager")]` FFI + 错误码映射)
  5. `tao/src/platform_impl/ohos/mod.rs` — `set_cursor_grab` 由 `Err(NotSupported)` 改为调用 openharmony-ability,错误映射 `ExternalError`
- **依赖**:无

### Phase 2: 权限与端到端验证
- **目标**:声明权限、更新测试入口与文档,真机验证全链路
- **文件列表**:
  1. `tauri/crates/tauri-cli/templates/mobile/open-harmony/entry_desktop/src/main/module.json5` — requestPermissions 增加 `ohos.permission.LOCK_WINDOW_CURSOR`
  2. `tauri/crates/tauri-cli/templates/mobile/open-harmony/entry_mobile/src/main/module.json5` — 同上(General 全设备,保持模板一致)
  3. `tauri/examples/api/src-tauri/gen/ohos/entry_desktop/src/main/module.json5` — 已生成项目同步加权限
  4. `tauri/examples/api/src/views/TestRunner.svelte` — `setCursorGrab (platform limit)` 按钮升级为真实测试(锁定→验证光标无法移出窗口→解锁;失焦自动解锁验证)
  5. `tauri/doc/ohos-window-test-mapping.md` — 光标抓取行:❌ 平台限制 → ✅ 已实现
  6. `tauri/doc/ohos-window-test-buttons.md` — C 区「真平台限制」移除光标抓取,移入 A 区真实按钮
- **依赖**:Phase 1 完成
- **备注**:`openharmony-ability/native_ability/src/main/module.json5`(HAR)可选声明同权限(跟随 SET_WINDOW_TRANSPARENT 先例),归入 Phase 2 评估

## 状态说明
- `○ 待开始` — 未开始设计
- `● 进行中` — 正在设计或实现
- `✓ 设计完成` — 设计文档已生成并通过审计
- `✓ 已归档` — 已完成实现、测试并归档
