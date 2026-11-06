# Proposal: ohos-cursor-passthrough

## Why

消费方 app(zhkt60 教师端,HarmonyOS PC 2in1 真机)用「全屏透明窗 + `set_ignore_cursor_events` 穿透」实现浮动工具栏(圆盘 + 右侧栏,经 runtime 创建的 Float 子窗)。真机实测:工具栏完整渲染,但真实鼠标点击圆盘无反应。

根因(`openharmony-ability/crates/ability/src/app.rs` 的 `CURSOR_POSITION_X/Y` 注释与 `MainPage.ets:219-232` 喂点自陈,现场文档 `D:\支撑Task\zhkt60-6.0.0-20261019\BUILD-INFO.md`「工具栏:可见性已修,可点击性不可用」节):

1. **喂入源单一**:`cursor_position` 只由主窗 `MainPage.onMouse` 经 NAPI `update_cursor_position` 喂入;Float 子窗宿主 `FloatPage.ets` 全文无 `onMouse`——光标移到工具栏窗上时主窗不触发,坐标保持陈旧 → app 侧命中测试永不匹配 → `ignore` 恒 true → 全部穿透。
2. **坐标系错位**:喂入值是 MainPage 组件相对 vp,而消费方命中测试按屏幕全局坐标处理(减去工具栏窗全局原点);tao 上游 `cursor_position` 语义是**全局屏幕物理 px**(Windows 实现即 `GetCursorPos`)——OHOS 实现两头不靠。

系统级光标读取不可用(公共 SDK `@ohos.multimodalInput.pointer.d.ts` 无 `getPointerLocation`,仅 style/visible/custom-cursor API),ArkUI 事件喂入是唯一路径。

## What Changes

**方向裁定**:采纳 **方向 A(修正 cursor_position 本身:全窗口喂入 + 全局坐标系)+ 方向 B 的 fail-safe 纪律(读不到/不可信 → 一律 ignore=true)**;方向 B 的「按 interactive 形状并集矩形收窗几何」**不采纳**进 runtime(圆盘类形状外接矩形四角死区会挡住下层 canvas 书写窗,且需消费方在落后数十 commit 的分支上重写工具栏架构),记录为 app 侧备选(见 design.md D0/D6)。

改动文件:

| 仓 | 文件 | 变更 |
|---|---|---|
| openharmony-ability | `native_ability/src/main/ets/components/FloatPage.ets` | 根 Stack 挂 `onMouse`(Move/Press)喂光标(根因一修复) |
| openharmony-ability | `native_ability/src/main/ets/components/MainPage.ets` | 喂入源从 `event.x/y`(组件系)换成 `event.displayX/displayY`(设备屏幕系)(根因二修复) |
| openharmony-ability | `native_ability/src/main/ets/helper/cursor_feed.ets`(新建) | 两页共用喂入 helper:API 版本守卫(API 20+ 优先 `globalDisplayX`)、有限数值守卫(`Number.isFinite`)、模块引用由调用方传入(不读 AppStorage)、camelCase NAPI 调用 |
| openharmony-ability | `crates/ability/src/app.rs` | `cursor_position()` 未跟踪态契约化( EVER_FED 标记 + 纯函数拆分可 UT);喂入注释从「MainPage 相对」改为「屏幕全局」 |
| tao | `src/platform_impl/ohos/event_loop.rs` | `cursor_position_from_app` 传播「未跟踪 → Err(NotSupported)」;注释同步 |
| tauri | `examples/api/src/lib/tests/core.ts` | `cursorPosition` 用例升级:容忍 untracked reject + tracked 数值域断言(红灯盲区修复) |
| tauri | `examples/api/src/lib/tests/ohos-adapter.ts` | 新增子窗坐标新鲜度注入式用例(manual/半自动,鼠标模式 uinput 配方);`ignore-cursor-events` 用例补 fail-safe 指引 |
| tauri | `doc/manual_tests.md` | 归档新手动用例 + app 侧 fail-safe 纪律章节 |

NAPI 函数 `update_cursor_position(x, y)` **签名不变**——仅参数语义从「组件相对 vp」升为「屏幕全局 vp」,`Module` 接口零改动。

## Capabilities

### New Capabilities

- **ohos-cursor-passthrough**:OHOS 上 `cursor_position` 的全窗口喂入 + 全局坐标系语义 + 未跟踪 fail-safe 契约,使「全屏透明窗 + 穿透 + app 侧命中测试」模式在非主窗上可用。

### Modified Capabilities

- 无新增/删除断点。`set_ignore_cursor_events → setWindowTouchable` 穿透链(2026-08-06 ohos-window-ignore-cursor-events 交付)行为不变,仅其依赖的 `cursor_position` 数据源被修正。

## Impact

- **依赖**:无新依赖。复用既有 per-window rect 快照设施之外的全部链路(NAPI 直调、getter! 命令、runtime-wry `FailedToGetCursorPosition` 错误通道均已存在)。
- **提供**:消费方命中测试所需的正确数据源——业务代码零改动,同步 openharmony-ability / tao fork commit 重打 HAR+HAP 即得;若消费方需 fail-safe 纪律,按 manual_tests 新章节补 `catch → ignore=true` 一行级守卫(design「交付面」同款限定)。
- **风险接受**:`MouseEvent.displayX` 的「设备屏幕」语义与单位(vp)以真机注入式用例为定论(见 design.md R1);多显示器场景 `displayX` 参照系未定(API 20 `globalDisplayX` 才声明全局),本 change 以单显 2in1 PC 为验收面并预留 API 20 优先分支。
- **交付面**:见 design.md「交付面」节——改动落 openharmony-ability / tao 两仓 fork + tauri 仓测试;消费方(ohdev-git 落后分支)零业务代码改动;`cursor_position` 未喂态契约变化(未喂 → Err,R5)记入交付说明供消费方知悉,与 design「交付面」/R5 限定对齐。
