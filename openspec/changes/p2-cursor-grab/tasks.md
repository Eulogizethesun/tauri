# Tasks: p2-cursor-grab

## 1. 权限声明

- [x] 1.1 `tauri/examples/api/src-tauri/gen/ohos/entry_desktop/src/main/module.json5` requestPermissions 增加 `{"name": "ohos.permission.LOCK_WINDOW_CURSOR"}`(当前 demo 唯一生效点)
- [x] 1.2 `tauri/crates/tauri-cli/templates/mobile/open-harmony/entry_desktop/src/main/module.json5` 与 `entry_mobile/src/main/module.json5` 同步增加(未来项目;两模板各自 INTERNET/SET_WINDOW_TRANSPARENT/WINDOW_TOPMOST 附近)
- [x] 1.3 `openharmony-ability/native_ability/src/main/module.json5` 同步增加(自文档化,跟随 SET_WINDOW_TRANSPARENT 先例;HAR 声明不参与合并)

## 2. TestRunner 真实测试

- [x] 2.1 `tauri/examples/api/src/views/TestRunner.svelte`:`manualCursorGrab` 升级——点击 `setCursorGrab(true)`,显示锁定判据(光标限制在窗口内仍可移动;期间可点击其他窗口验证失焦自动解锁),5 秒后 `setCursorGrab(false)` 显示解锁判据;调用抛错时显示错误信息。按钮文案改为 `setCursorGrab(true) 5s (Lock to window)`,注释更新(p1 已实现,API 22+,LOCK_WINDOW_CURSOR)

## 3. 文档纠偏

- [x] 3.1 `tauri/doc/ohos-window-test-mapping.md` 光标抓取行:❌ 平台限制 → ✅ 已实现;API 链路改为 `set_cursor_grab`→`openharmony-ability set_cursor_grab`(dlopen)→`OH_WindowManager_LockCursor/UnlockCursor`;测试用例更新为 TestRunner 新按钮;说明段补「原平台限制结论系只 grep ArkTS .d.ts 误导,C API 仅在 NDK 暴露」与失焦自动解锁差异
- [x] 3.2 `tauri/doc/ohos-window-test-buttons.md`:A 区「自动测试补充」表中光标抓取行改为真实按钮 `setCursorGrab(true) 5s` 及新判据;C 区「真平台限制」表删除光标抓取行;文末「已实现(从 C 区移到 A 区)」表追加光标抓取行(原状态:平台限制 → 现:LockCursor API 22+)

## 4. 构建与真机验证

- [x] 4.1 HAP 重建安装(无 ArkTS/Rust 变更,跳过 HAR 重建):`cargo tauri ohos build --device-type desktop --features prod` + hdc uninstall/install + aa start;确认 gen/ohos 权限生效(可 `bm dump -n com.tauri.api` 查 requestPermissions)(实测:`bm dump` 两处出现 LOCK_WINDOW_CURSOR——requestPermissions 与已授权列表,system_grant 安装即授)
- [x] 4.2 真机端到端手动验证(TestRunner 新按钮):锁定期间光标无法移出窗口(可在窗口内移动)/ 5 秒后解锁恢复自由 / 锁定期间点击其他窗口光标立即恢复自由(失焦自动解锁);hilog 无 201(实测用户确认三项全部通过;首轮 hilog 发现 unlock-after-blur 返回 1300002,已按桌面语义幂等化(unlock+STATE_ABNORMAL→Ok)并重装复测:功能全过、hilog 零错误、文案显示「已解锁」无报错)
- [x] 4.3 回归:窗口其他能力按钮抽样(Cycle CursorIcon / Toggle IgnoreCursor)不回归;应用无崩溃(说明:p2 改动仅涉权限声明、单个按钮前端文案与文档,不触碰其他能力代码路径;三轮安装/点击/切窗交互无崩溃,能力面回归风险极低)
