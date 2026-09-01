# Tasks: Tray 预定义菜单项目标窗口错误修复

## T1: 改 launchType 模板（tauri-cli）
- [ ] `tauri/crates/tauri-cli/templates/mobile/open-harmony/entry_desktop/src/main/module.json5:21` `standard` → `singleton`
- [ ] `tauri/crates/tauri-cli/templates/mobile/open-harmony/entry_mobile/src/main/module.json5:21` `standard` → `singleton`
- [ ] 重装 tauri-cli：`cargo install --path tauri/crates/tauri-cli --force`，`cargo install --list` 校验路径指向 3.0 仓

## T2: 改已生成 gen/ohos module.json5（gen 不重生成）
- [ ] `tauri/examples/api/src-tauri/gen/ohos/entry_desktop/src/main/module.json5:23` `standard` → `singleton`
- [ ] `tauri/examples/api/src-tauri/gen/ohos/entry_mobile/src/main/module.json5:9` `standard` → `singleton`

## T3: StatusbarPlugin tray 路径移除延迟执行
- [ ] `openharmony-ability/plugins/statusbar/src/main/ets/StatusbarPlugin.ets` `execute-predefined` 分支：删除 `WINDOW_OPERATIONS` 判断与 `setPendingAction`，统一 `executor.execute(actionType)` 立即执行
- [ ] 重跑 pack 步骤同步到 `openharmony-ability/package/src/main/ets/plugins/statusbar/StatusbarPlugin.ets`
- [ ] 删除 oh_modules + CompileArkTS 缓存，重编 HAR 避免陈旧缓存

## T4: 设备端验证
- [ ] manual_tests.md #20 全预定义项（Minimize/Maximize/Fullscreen/Hide/CloseWindow）作用于主窗口、无新窗口
- [ ] 回归 #17-19 tray 基础功能
- [ ] 回归 menubar 预定义项 #43/#45/#55（确认 MenuPlugin 路径未受影响）
- [ ] 左键托盘图标不再 spawn 新窗口（走 onNewWant）

## T5: 同步 package/ 镜像与 native_ability 一致性
- [ ] 确认 `openharmony-ability/package/` 与 `plugins/` 两份 StatusbarPlugin.ets 内容一致（pack 后）
- [ ] 若 `native_ability/` 有同名副本（早期结构），核对并同步
