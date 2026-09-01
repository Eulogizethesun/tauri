# Design: p1-ohos-screenshot

## Context

WebviewPlugin 已持有每个 webview 的 controller(`controllers` 注册表,controllerEntry 先例),ArkWeb 提供 `WebviewController.webPageSnapshot()`(webview 官方截图 API,返回完整 PixelMap;仓内 web-page-snapshot action 已有带重试+超时的验证封装)。PixelMap `readPixels` 固定按 BGRA_8888 输出;`image.ImagePacker` 可编码 PNG。原调研的 `getSurfaceId()+createPixelMapFromSurface` 路径因 Region 尺寸循环依赖被否(见 D1 修订)。

## Goals / Non-Goals

**Goals**
- `capture-webview { id }` → `{ pngBase64, width, height }`:整窗截图
- `pick-color { id, x, y }` → `{ r, g, b, a }`:单像素取色(内部小区域 readPixels)
- cargo check 双侧 0 error,HAR 内 WebviewPlugin 含 capture-webview/pick-color(D1 修订:无独立 ScreenshotPlugin)

**Non-Goals**
- 屏幕级/应用外截图(`@ohos.screenshot` 系统权限,三方不可申请)
- 屏幕任意位置取色(同上)
- 任意区域截图的 Region 直传(平台要求 Region.x/y=0;任意区域用全截+crop,本 Phase 不暴露 crop)
- plugins-workspace 插件与 JS API(p2-ohos-screenshot)

## Decisions

### D1: 实现路径 — WebviewPlugin 内置 webPageSnapshot actions(实现期修订)

原方案(surfaceId 中转)存在**确定性缺陷**:`createPixelMapFromSurface(Sync)` 的 Region.size 必须 ≤ surface 实际像素尺寸且不 clamp(超尺寸报 401),但 Web 组件没有 XComponent 那样的 surface 尺寸查询 API,尺寸只能建 PixelMap 后回读——鸡生蛋循环,无法构造合法全尺寸 Region。

**修订决策:截图/取色 action 直接实现在 WebviewPlugin 内**,走 ArkWeb 官方 webview 截图 API `controller.webPageSnapshot`(仓内已有带重试+超时的验证封装,webPageSnapshot 先例),返回完整 PixelMap:
- 插件隔离原则决定 PixelMap 必须在 controller 所在的 WebviewPlugin 内创建与消费(跨插件传 PixelMap 无通道)
- 截图/取色本质是 webview 域能力,放 WebviewPlugin 语义准确(与原 D1 "surfaceId 归属 webview 域"同构)
- **不再需要** ScreenshotPlugin ArkTS 插件、get-surface-id action、pack-plugins 17、模板/gen 注册——注册面零新增
- Rust 侧仍建 `crates/plugin-screenshot/` facade:`ScreenshotClient` 内部持 `WebviewClient`(依赖 openharmony-ability-plugin-webview),调 `ohos.webview` 的 capture-webview / pick-color action,对外提供 `ScreenshotExt::screenshot()` 类型化接口(满足 2b tauri-plugin-screenshot 的消费需求)

SYNC_RENDER(透明)webview 不再被排除:webPageSnapshot 是 DOM 级渲染,与 RenderMode 无关(留 p2 真机确认)。

### D2: 截图实现 — webPageSnapshot PixelMap → ImagePacker PNG → base64

```
controller.webPageSnapshot({id:"capture"}, cb) → result.imagePixelMap
  → getImageInfoSync() 回读宽高
  → image.createImagePacker().packing(pixelMap, { format: "image/png" }) → Promise<ArrayBuffer>
  → buffer.from(arrayBuffer).toString('base64')(import { buffer } from '@kit.ArkTS')
  → { pngBase64, width, height }
```
- PNG 编码:packing(API 8+;API 13 废弃但基线 API 12 只能用它)
- **base64 而非裸 bytes 跨桥**:PNG 二进制若走 `#[napi(object)]` Vec<u8> 会变 Array<number>(每字节一个 JS number,几百 KB 截图内存放大 8x+);base64 string 跨桥零陷阱,Rust 侧 `base64` crate 解码。取色场景不传图,无此问题
- 快照重试:复用既有 webPageSnapshot 的 retry+timeout 模式(500ms 初始延迟 + 3 次重试,10s 超时;webview 未完成首帧时 status=false)

### D3: 取色实现 — 同一 PixelMap 小区域 readPixels(BGRA_8888 固定输出)

`pick-color`:同样 webPageSnapshot 拿 PixelMap → `readPixels(area: PositionArea)`。**readPixels 固定按 BGRA_8888 格式输出,与 PixelMap 自身 pixelFormat 无关**(官方文档明确),因此不做 pixelFormat 检查。

调用形态(调用方必须提供 ArrayBuffer,readPixels 写入不返回):
```ts
const area: image.PositionArea = {
  pixels: new ArrayBuffer(4),   // 1px × 4 bytes
  offset: 0,
  stride: 4,                     // >= region.size.width * 4
  region: { x, y, size: { width: 1, height: 1 } }
};
await pixelMap.readPixels(area);
const b = new Uint8Array(area.pixels);
// BGRA 字节序: b[0]=B, b[1]=G, b[2]=R, b[3]=A
return { r: b[2], g: b[1], b: b[0], a: b[3] };
```
坐标语义:x/y 为快图像素坐标(与返回的 width/height 同一坐标系);越界由 readPixels 报错,经结构化错误透传。

### D4: 同步 vs 异步 — invokeAsync + 全 Promise

webPageSnapshot 是 callback API(包 Promise);packing/readPixels 是 Promise。整体走 `invokeAsync`(AsyncPluginBase),ArkTS async 方法内 await,无主线程 block_on(bridge call_async 本就异步等 Promise)。

### D5: 错误面

| 错误 | 触发 | Rust 变体 |
|---|---|---|
| UnknownWebview | id 不在 controllers 注册表(controllerEntry 抛 "Unknown WebView controller") | `ScreenshotError::UnknownWebview` |
| SnapshotUnavailable | webPageSnapshot 重试耗尽/超时/status=false/返回空 PixelMap | `ScreenshotError::SnapshotUnavailable` |
| 内部错误 | packing/readPixels/getImageInfo 失败 | `ScreenshotError::Internal(code,msg)` |

ArkTS 错误模式与 accessibility D3 一致:action 内 try/catch 捕获 BusinessError 后 `throw new Error`(bridge runtime 转 Rust Err),**不做 `{ok:false}` 返回**(会与声明 Response 的 NAPI 类型不匹配)。Rust facade 按错误消息标记映射枚举("Unknown WebView controller"→UnknownWebview、"snapshot"/"timed out"→SnapshotUnavailable、其余→Internal),不 panic。原 SyncRenderUnsupported/SurfaceUnavailable 随 surface 路径一并移除(D1 修订)。

### D6: 资源生命周期

PixelMap 与 ImagePacker 用毕 `release()`(try/finally),防句柄泄漏(官方文档明确要求);同一 action 内完成创建→使用→释放,不缓存 PixelMap(跨调用缓存有 GC/失效风险,无必要)。webPageSnapshot 的既有封装已在 finally 中 release;新 action 复用同模式(先消费后 release)。

### D7: 注册链路

**零新增 ArkTS 插件**(D1 修订):无 ScreenshotPlugin.ets、无 pack-plugins 16→17、无模板/gen 注册。Rust 侧仅新增 `crates/plugin-screenshot/` facade crate(结构参照 plugin-clipboard;`ScreenshotExt::screenshot() -> Result<ScreenshotClient>`,内部经 `openharmony-ability-plugin-webview` 的 WebviewClient 调 action);workspace Cargo.toml 加一条 dependencies。2b 阶段 tauri-plugin-screenshot init 时 `register_plugin(WebviewBridgePlugin)` 已由 tauri-runtime-wry set_ohos_window_client 统一注册(既有链路,零额外动作)。

## Risks / Trade-offs

- [webPageSnapshot 在 webview 未完成首帧时 status=false] → 复用既有 retry(3 次/500ms)+ 10s 超时模式;冷启动时序 p2 真机验证
- [webPageSnapshot 对 SYNC_RENDER(透明)webview 的行为未知] → DOM 级渲染理论上无关 RenderMode;p2 用透明窗口用例顺带验证
- [大截图 base64 跨桥内存峰值(3120x2080 PNG ~ MB 级)] → 本期接受;后续如需优化改 TSFN 流式(无先例,不冒进)

## Migration Plan

纯新增(WebviewPlugin 新增 2 个 action + plugin-screenshot facade crate),无破坏。回滚 revert 即可。

## Open Questions

- readPixels BGRA 输出的字节序在真机的实测确认(p2 取色断言时核对 B/R 通道是否需要对调)
- webPageSnapshot 快图像素坐标系与窗口逻辑坐标的映射(密度换算)在 p2 demo 中对齐
