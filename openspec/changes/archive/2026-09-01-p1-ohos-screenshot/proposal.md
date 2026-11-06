# Proposal: p1-ohos-screenshot

## Why

兼容性表 R229 将截图取色标记为"不支持"。调研确认:屏幕级截图是平台硬限制(系统权限,三方不可申请),但**应用内**截图取色完全可做——`WebviewController.getSurfaceId()`(API 12)+ `image.createPixelMapFromSurface(Sync)`(API 11/12)+ PixelMap `readPixels`。Tauri 应用(如取色器、分享缩略图、可视化回归测试)有真实需求。

## What Changes

- openharmony-ability 新增第 17 个桥接插件 `screenshot`(ArkTS ScreenshotPlugin,id=`ohos.screenshot`)+ Rust facade crate `plugin-screenshot`
- 提供 action:`capture-webview`(指定 webview id 截图,返回 base64 PNG + 宽高)、`pick-color`(指定 webview id + x/y,返回 `{r,g,b,a}`)
- EntryAbility.ets.hbs 模板(desktop+mobile)注册
- 本 Phase 仅 bridge 层;plugins-workspace 插件与 demo 集成归 p2-ohos-screenshot

## Capabilities

### New Capabilities
- `ohos-screenshot-bridge`: openharmony-ability 应用内截图/取色桥接能力(surfaceId 获取 + PixelMap 截图 + 像素读取 + PNG 编码)

### Modified Capabilities
- `ohos-platform-limitations`: R229 边界修订为"应用内截图取色可用;屏幕级(应用外)截图/任意位置取色仍为平台限制"(spec 级行为变化,delta spec 归 p2 阶段一并提交)

## Impact

- 新增文件:plugins/screenshot/ 5 文件 + crates/plugin-screenshot/ 2 文件
- 修改:pack-plugins.ps1(16→17)、tauri-cli 模板 entry_{desktop,mobile} EntryAbility.ets.hbs
- 依赖:@kit.ArkWeb getSurfaceId(API 12)、@kit.ImageKit createPixelMapFromSurface(Sync)(API 11/12)、ImagePacker(API 8+),均在 API 12 基线内
- 已知边界:仅 ASYNC_RENDER 模式 webview(SYNC_RENDER 透明窗口 getSurfaceId 无效);Region 必须从 (0,0) 开始(任意区域 = 全截后 crop)
