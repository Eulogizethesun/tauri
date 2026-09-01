# OHOS 应用接续(app continuation)适配计划

**创建时间**:2026-08-27
**功能描述**:为 Tauri OHOS 适配"被动应用接续"最小 API——目标端恢复查询与数据回传(launchReason/wantParam)、源端状态保存(onContinue 预注册快照)、module.json5 continuable 构建期门控。主动发起迁移由系统 UI 独占,不做。
**判断依据**:涉及 4 个代码层(openharmony-ability / plugins-workspace / tauri-cli 模板 / examples),预估 ~30-35 文件
**JS API 形态**:完整 plugins-workspace 插件(参照 accessibility/screenshot 先例,OHOS 专属新插件)
**调研结论**(2026-08-27 子代理调研,华为官方文档核实):
- continuationManager 独立 API 已废弃,接续由 UIAbility 生命周期驱动(onContinue / launchReason===CONTINUATION)
- 三方可用,无需系统签名/ACL;纯 wantParam 键值对无需 DISTRIBUTED_DATASYNC 权限;wantParam 上限 100KB
- 主动迁移(层 d)系统 UI 独占,三方不可做——明确排除
- 恢复链路复刻 deep-link INITIAL_WANT_URI lazy-take 先例(lifecycle.rs:331-348 / app.rs:1115-1151)
- launchReason 当前未被 NativeAbility 读取转发——主要缺口;onRestoreState Rust 已定义 ArkTS 未打通——天然接续缺口

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1c | 接续 bridge/lifecycle 层 | p1-ohos-continuation | ✓ 已实现 | openharmony-ability | 10 | cargo check 双侧 0 error + 设备侧 UT(70/70 含 3 接续测试;真机部署冷启动无异常) |
| 2c | 接续插件+集成验证 | p2-ohos-continuation | ✓ 已实现 | plugins-workspace + examples | 14 | 真机 289 passed/#279/#280 两 auto 用例绿(135ms/183ms) |
| 3c | 源端保存+模板门控+双设备 | p3-ohos-continuation | ✓ 已实现 | openharmony-ability + tauri-cli + examples | 18 | cargo check 双侧 0 error + 设备侧 UT + auto 用例绿(291 例 290/1，唯一失败为已知剪贴板平台限制)；双设备 T1 手动用例已文档化（执行依赖用户第二台设备，task 5.4 不阻塞交付） |

## Phase 详细说明

### Phase 1c: 接续 bridge/lifecycle 层
- **状态**:✓ 已实现(2026-08-27)。实现要点:ArkTS 侧符号比较 launchReason===CONTINUATION 传布尔 isContinuation(非数值);wire 两处对齐(type.ets + Rust 闭包,napi d.ts 为 `(arg: object)` 宽松类型无需改);Rust 侧 CONTINUATION_RESTORE(peek)/CONTINUATION_DATA(draining take) 双 Mutex + 非接续启动清残留;`crates/plugin-continuation/` 纯同步零 bridge facade;unwrap_or house style 读可选字段。实现期顺手修复 app.rs mod tests cursor 测试的设备侧编译断(cfg 门控 import 缺失)。设计审计+实现审计双通过。
- **目标**:打通"目标端恢复"信号链——NativeAbility `onCreate`/`onNewWant` 读取 `launchParam.launchReason` 与 `want.parameters` 接续 payload 并转发进 lifecycle 闭包链;Rust 侧 `take_launch_reason()` / `take_continuation_data()` Mutex(同 deep-link take 模式);`crates/plugin-continuation/` facade(ContinuationClient:is_restore_launch 热查询/冷启动 take 双路径)。注意 onNewWant 已有 parametersJson 转发,冷启动 onAbilityCreateWithWant 目前只传 uri——补 parameters+launchReason。
- **文件列表**:native_ability/.../NativeAbility.ets(lifecycle 扩展);crates/ability/src/lifecycle.rs(闭包+INITIAL Mutex);crates/ability/src/app.rs(take_*);crates/plugin-continuation/{Cargo.toml,src/lib.rs};pack-plugins.ps1(如需 ArkTS 插件则 +plugins/continuation/);模板 EntryAbility 注册(如有)
- **依赖**:无

### Phase 2c: 接续插件+集成验证
- **状态**:✓ 已实现(2026-08-27)。`tauri-plugin-continuation`(is_continuation_restore peek / get_continuation_data draining take 空串→null 归一化;Error 仅 Unsupported;零 bridge 零权限);examples/api Continuation demo 页+ohos-continuation.ts 两 auto 用例真机绿;R228 修订为"被动恢复最小 API 已提供,主动迁移系统 UI 独占不可用";manual_tests.md §三十四 +1 边界用例(hdc aa start 带 parameters 不误判接续),合计实核修正 92/79/171。实现审计通过(唯一发现为先验统计幽灵 T0,已修)。
- **目标**:plugins-workspace 新建 `tauri-plugin-continuation`:commands(is_continuation_restore_launch / get_continuation_data)→ guest-js(isContinuationRestoreLaunch/getContinuationData)→ dist-js;examples/api 接入+单设备验证(adb 侧 fake want/单元断言);R228 spec 从"暂不实现"修订为分阶段边界声明(查询/恢复可用;主动迁移不可用;源端保存见 Phase 3c)。
- **文件列表**:plugins-workspace/plugins/continuation/ ~10 文件;examples/api 集成 4 文件;测试 ~3;ohos-platform-limitations spec 修订
- **依赖**:Phase 1c 完成

### Phase 3c: 源端保存+模板门控+双设备
- **状态**:✓ 已实现(2026-08-27,单设备验证全绿;双设备 T1 待用户执行)。实现要点:预注册快照 `CONTINUATION_SNAPSHOT: Mutex<String>`(peek 不 drain,取消迁移可重试)+ `#[napi] read_continue_snapshot` 同步导出(update_cursor_position 先例);NativeAbility `onContinue` 经 ProcessInitializer.getNativeModules() 直读,非空写 `wantParam.continuationData` 返回 AGREE、空返回 MISMATCH(显式 opt-in),全程零 block_on;tauri.conf.json `bundle.openHarmony.continuable`/`continueType` 新可选字段 + tauri-cli `write_entry_continuation`(write_entry_device_types 同点注入,缺省回退 `["<identifier>"]`,非 true 移除 key 支持切回);插件 `setContinuationData`(96KB 上限 → PayloadTooLarge);manual_tests.md 双设备 T1 两例 + 统计二次实核修正 91/81/172。验证:实现审计 0 缺陷;5.3 module.json5 门控端到端(hvigor 接受点号 continueType,json5 重写无污染);5.2 真机全套件 291 例 290 passed/1 failed(唯一失败 #87 剪贴板为已知平台限制非回归),新增 #281 setContinuationData 用例绿,hilog 零 crash;5.4 双设备 T1 已文档化不阻塞交付。首轮 53/290 截断假阳性已定因(遗留孤儿构建 install-over 杀 app)并加固脚本。
- **目标**:NativeAbility `onContinue` override(预注册快照方案:Rust 侧 set_continue_data 镜像快照,onContinue 直读返回 AGREE,不等 JS 回填——规避主线程死锁);tauri-cli gen/ohos 模板 module.json5 `continuable`/`continueType` 可选门控;双设备真机完整迁移流验证;manual_tests.md 双设备用例。
- **文件列表**:NativeAbility.ets(onContinue);crates(快照 Mutex+命令);tauri-cli 模板;examples demo;manual_tests.md
- **依赖**:Phase 2c 完成;双设备环境(MateBook Pro + 手机/二合一,同华为账号)
