# OHOS 应用内截图取色(screen capture)适配计划

**创建时间**:2026-08-27
**功能描述**:为 Tauri OHOS 适配提供应用内截图与取色 API——`captureWindow()`(窗口截图返回 PNG/RGBA)、`pickColorAt(x, y)`(指定坐标取色)。仅应用自身窗口;屏幕级截图/任意位置取色为平台硬限制(系统权限),不做。
**判断依据**:涉及 3 个代码层(openharmony-ability / plugins-workspace / examples),预估 ~23 文件
**JS API 形态**:完整 plugins-workspace 插件(参照 huawei-account 先例,OHOS 专属新插件)

## 背景(2026-08-27 调研结论)

- 含 Web 组件场景官方推荐 `image.createPixelMapFromSurface(surfaceId, region)`(ComponentSnapshot 对 Web 不适用)
- 取色:PixelMap `readPixels(area)` 写入 ArrayBuffer(RGBA_8888),小区域读取,读完 `release()`
- `@ohos.screenshot`(屏幕级)需系统权限,三方不可申请 → 边界声明
- surfaceId 获取路径:webview 场景需从 ArkTS 侧拿(设计阶段确认具体 API:window 实例 `getWindowProperties`? 或 webview surfaceId);ClipboardPlugin 已有 PixelMap 处理先例(writeImageToClipboard)
- Tauri 上游无截图插件,无跨平台契约要对齐
- 需同步更新 `ohos-platform-limitations` spec:R229 边界更新

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1b | 截图取色 bridge 层 | p1-ohos-screenshot | ✓ 已实现 | openharmony-ability | 9 | cargo check 双侧 0 error + HAR 含 capture-webview/pick-color(D1 修订:action 内置 WebviewPlugin,无独立 ScreenshotPlugin) |
| 2b | 截图插件+集成验证 | p2-ohos-screenshot | ✓ 已实现 | plugins-workspace + examples | 14 | 真机:红块取色 rgba(255,0,0,255) 像素级精确 + 3 用例全绿 |

## Phase 详细说明

### Phase 1b: 截图取色 bridge 层
- **目标**:openharmony-ability 新增 `plugins/screenshot/`(ArkTS ScreenshotPlugin,id="ohos.screenshot")+ `crates/plugin-screenshot/`(Rust facade),actions:`capture-window`(返回 base64 PNG 或 RGBA bytes+宽高)、`pick-color`(x,y → {r,g,b,a})。Vec<u8> 跨桥双类型接收(Array<number>/Uint8Array)。pack-plugins.ps1 16→17。EntryAbility.ets.hbs 模板×2 注册。
- **文件列表**:同 Phase 1a 结构(screenshot 版 9 文件)
- **依赖**:无(与 1a 并行无冲突,按序执行)

### Phase 2b: 截图插件+集成验证
- **目标**:plugins-workspace 新建 `tauri-plugin-screenshot`(OHOS 专属,形态 2);examples/api demo 页渲染已知色块→截屏→取色比对(自动化断言);更新 ohos-platform-limitations spec R229。
- **文件列表**:同 Phase 2a 结构(screenshot 版 ~14 文件)
- **依赖**:Phase 1b 完成
