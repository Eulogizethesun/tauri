# Tasks: p3-ohos-continuation

## 1. openharmony-ability 源端快照层

- [x] 1.1 `crates/ability/src/app.rs`：新增 `CONTINUATION_SNAPSHOT: Mutex<String>` + `store_continue_snapshot(&str)`（pub，供 plugin-continuation UT 驱动）+ `peek_continue_snapshot() -> String`（非 drain）；mutex poisoned 走 `crate::error!` 同 store_continuation 风格
- [x] 1.2 `crates/ability/src/app.rs`：`#[napi] #[cfg(target_env = "ohos")] pub fn read_continue_snapshot() -> String`（紧邻 update_cursor_position）；mod continuation_tests 追加 3 用例：peek 两次同值、store 覆盖、空串清空
- [x] 1.3 `crates/plugin-continuation/src/lib.rs`：ContinuationClient 增加 `set_continuation_data(String)` 委托 store_continue_snapshot
- [x] 1.4 `native_ability/src/main/ets/ability/NativeAbility.ets`：override `onContinue(wantParam)`——ProcessInitializer.getNativeModules() 取 primary module（typeof readContinueSnapshot === 'function' 守卫 + try/catch），非空写 `wantParam.continuationData` 返回 AGREE，否则 MISMATCH；hilog 记录结果与快照长度（不记内容）
- [x] 1.5 pack.bat 重建 HAR + 校验 package 镜像含 onContinue；run-ut.sh 设备侧跑 ability crate（含新增 3 用例）

## 2. tauri-cli 构建期门控

- [x] 2.1 `crates/tauri-utils/src/config.rs`：OpenHarmonyConfig 加 `continuable: Option<bool>` / `continue_type: Option<Vec<String>>`（camelCase+kebab alias；Default None）
- [x] 2.2 `crates/tauri-cli/src/mobile/open_harmony/plugins.rs`：新增 `write_entry_continuation(project_dir, form, continuable, continue_type, identifier)`——true 写 abilities[0].continuable/continueType（缺省回退 `["<identifier>"]`），非 true 移除两 key
- [x] 2.3 `crates/tauri-cli/src/mobile/open_harmony/build.rs`：两个 write_entry_device_types 调用点同点追加 write_entry_continuation（conf 值经 tauri_config.bundle.open_harmony 传入）
- [x] 2.4 cargo check tauri-cli + tauri-utils 双侧 0 error

## 3. 插件命令

- [x] 3.1 `plugins-workspace/plugins/continuation/`：src/ohos.rs 加 `set_continuation_data(data: String)`（96KB 上限 → 新 Error 变体 PayloadTooLarge）；src/commands.rs 非 OHOS stub 同签名返回 Unsupported；src/error.rs 加 PayloadTooLarge
- [x] 3.2 build.rs COMMANDS 追加 "set_continuation_data"；permissions/default.toml 追加 allow-set-continuation-data；guest-js/index.ts 加 setContinuationData（JSDoc 含 peek 语义 + continuationData 往返约定 + 96KB 限制）；npm run build 产 dist-js 非零校验

## 4. examples + 文档

- [x] 4.1 Continuation.svelte 加"保存接续数据"区（输入框 + set 按钮 + 空串清空按钮 + 超限按钮），结果区展示 resolve/reject
- [x] 4.2 ohos-continuation.ts 追加 auto 用例：set resolve / set("") 清空边界 / 超长串 reject PayloadTooLarge
- [x] 4.3 manual_tests.md §三十四 追加 T1 双设备用例（源端 set + 系统迁移 + 目标端验证往返约定 + onContinue AGREE hilog 判据），统计行同步实数更新
- [x] 4.4 R228 收尾修订（被动恢复 + 源端保存均提供；主动迁移系统 UI 独占）；ohos-continuation-plan.md Phase 3c 状态更新

## 5. 验证

- [x] 5.1 cargo check：ability/plugin-continuation host+OHOS 双侧、tauri-plugin-continuation 双侧、tauri-cli host 均 0 error
- [x] 5.2 run-tests.sh 真机（desktop）：新增 auto 用例绿；HAR 含 onContinue（hilog 验证 app 正常启动无异常）
  - 验证结论（2026-08-27）：全套件 291 例 = 290 passed / 1 failed；唯一失败 #87 clipboard-manager 为已知 OHOS 剪贴板读权限平台限制（与基线一致，非回归）。新增用例 #281 `setContinuationData (save + clear + size budget)` ✅ 574ms；#279/#280 既有 continuation 用例无回归。footer 70s 出现（报告完整无截断）；hilog 零 crash/fatal，faultlog 无新增条目。排障附注：首轮 53/290 截断假阳性根因是压缩前遗留的无 VITE_AUTOTEST 孤儿构建在套件运行中 install-over 杀死 app 实例；已加固 run-tests.sh Step 7（footer 缺失按失败处理）+ test-runner appendResult 5s 超时。
- [x] 5.3 examples/api conf 开 continuable 后 build，抽查 gen/ohos entry_desktop module.json5 含 continuable:true + continueType，**显式断言 hvigor 构建不报 continueType 格式错**（identifier 含点号格式待验证，报错则改回退变体并回填 design）；然后按验证结论决定 conf 是否回退缺省
  - 验证结论（2026-08-27）：`continuable: true` + `continueType: ["com.tauri.api"]` 已写入 entry_desktop module.json5 abilities[0]；hvigor BUILD SUCCESSFUL、签名 HAP 安装启动成功——点号格式被接受，design Risk 已回填。extensionAbilities/requestPermissions 等手工补充内容完好（json5 重写无污染）。conf 保留 `"continuable": true`（task 5.4 双设备 T1 验证需要，且仅影响 OHOS 构建，其他平台无感）。
- [x] 5.4 双设备 T1 完整迁移流：引导用户在第二台设备执行（不阻塞交付；用例已文档化）
  - 验证结论（2026-08-29）：双设备真机 PASS（源 Mate 70 CLS-AL00 → 目标 MateBook Pro），用例与判据见 doc/manual_tests.md §三十四 source-save / source-restore（hilog `onContinue - AGREE, snapshot length: 23`、状态机 0→1→2→3 完整流转、目标端三判据全过，含 onWindowStageRestore 冷/热双路径）。
