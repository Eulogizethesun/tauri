# Proposal: p2-cursor-grab

## Why

p1-cursor-grab 已打通 tao → openharmony-ability → `OH_WindowManager_LockCursor` FFI 链路(真机 hilog 实证:错误码 201 NO_PERMISSION 来自系统窗口管理器)。但 `ohos.permission.LOCK_WINDOW_CURSOR` 尚未声明,锁定调用被系统拒绝;TestRunner 测试按钮仍按「平台限制」断言(不崩溃即 PASS);两份窗口能力文档仍记载已被推翻的「OHOS 无指针锁定 API」结论。需要声明权限、把测试升级为真实验证、纠正文档,完成端到端闭环。

## What Changes

- **权限声明**(3 处 + 1 可选):tauri-cli 模板 `entry_desktop` / `entry_mobile` 的 module.json5、api demo 已生成的 `gen/ohos/entry_desktop` module.json5 各增加 `ohos.permission.LOCK_WINDOW_CURSOR`(normal 级 system_grant,仅需 name 字段);openharmony-ability HAR 的 module.json5 同步声明(跟随 SET_WINDOW_TRANSPARENT 双声明先例,自文档化,HAR 声明不参与合并)。
- **TestRunner 真实测试**:「setCursorGrab (platform limit)」按钮升级为「setCursorGrab(true) 5s」——锁定 5 秒自动解锁,操作结果给出人工验证判据(光标限制在窗口内 / 解锁后自由移动 / 失焦自动解锁)。
- **文档纠偏**:`doc/ohos-window-test-mapping.md` 光标抓取行(❌ 平台限制 → ✅ 已实现 + LockCursor API 链路);`doc/ohos-window-test-buttons.md` 从 C 区「真平台限制」移除、A 区补真实按钮、修正对「系统应用专用 API」的错误论述。
- 不改任何 Rust/ArkTS 代码(p1 已完成);无 HAR 重建需求(仅前端 + module.json5)。

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

(无——p1 的 cursor-grab spec 已覆盖带权限后的目标行为;本 change 是配置/测试/文档交付,无 spec 级行为变更,已设 `skip_specs: true`)

## Impact

- **tauri-cli 模板**:`templates/mobile/open-harmony/entry_{desktop,mobile}/src/main/module.json5`——影响未来新生成的项目(模板改动不重装 cli 不生效,本项目直接改 gen 产物绕过)。
- **examples/api**:`gen/ohos/entry_desktop/src/main/module.json5` + `src/views/TestRunner.svelte`——当前 demo 即时生效。
- **文档**:`doc/ohos-window-test-mapping.md`、`doc/ohos-window-test-buttons.md`。
- **验证**:HAP 重建(前端 + 权限变更,无 HAR 重建)→ 真机手动测试:锁定期间光标无法移出窗口、解锁恢复、切焦点自动解锁。
