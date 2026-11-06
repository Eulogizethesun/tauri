# Tasks: p1-ohos-screenshot

> 实现期修订(D1):surface 捕获路径被否(Region 尺寸循环依赖),改用 webPageSnapshot;action 实现在 WebviewPlugin 内,无独立 ScreenshotPlugin ArkTS 插件/注册链路变更。

## 1. WebviewPlugin ArkTS actions

- [x] 1.1 WebviewPlugin.ets 新增 `capture-webview { id }` action:复用 webPageSnapshot 重试封装拿 PixelMap → getImageInfoSync 回读宽高 → ImagePacker.packing PNG → `buffer.from(arrayBuffer).toString('base64')`(import { buffer } from '@kit.ArkTS')→ `{ pngBase64, width, height }`;try/finally 释放 PixelMap/ImagePacker;action try/catch 后 throw 结构化错误(同 accessibility D3,不做 {ok:false});interface 字段全 camelCase
- [x] 1.2 WebviewPlugin.ets 新增 `pick-color { id, x, y }` action:webPageSnapshot PixelMap → `readPixels(PositionArea)` 正确形态 `{ pixels: new ArrayBuffer(4), offset: 0, stride: 4, region: { x, y, size: { width: 1, height: 1 } } }` → 按 BGRA 字节序(b[0]=B,b[1]=G,b[2]=R,b[3]=A)转换返回 `{r,g,b,a}`;不做 pixelFormat 检查;同样 try/finally 释放

## 2. plugin-webview Rust facade

- [x] 2.1 crates/plugin-webview 加 Req/Resp napi object + impl_bridge_napi_type!:`WebviewCaptureRequest`(id 复用 ControllerRequest)、`WebviewCaptureResponse { png_base64, width, height }`、`WebviewPickColorRequest { id, x, y }`(复用 ControllerRequest 扩展或独立类型)、`WebviewPickColorResponse { r, g, b, a }`
- [x] 2.2 WebviewHandle 加 `capture_png() -> Result<WebviewCaptureResponse>` 与 `pick_color(x, y) -> Result<WebviewPickColorResponse>` 方法(经既有 call 通道)

## 3. plugin-screenshot Rust facade

- [x] 3.1 创建 `openharmony-ability/crates/plugin-screenshot/`(Cargo.toml + src/lib.rs,依赖 openharmony-ability + openharmony-ability-plugin-webview):`ScreenshotError` 枚举(UnknownWebview/SnapshotUnavailable/Internal,按错误消息标记映射)、`CapturedImage`/`Rgba` 类型
- [x] 3.2 实现 `ScreenshotClient`(ScreenshotExt 扩展 OpenHarmonyApp):`capture_webview(id)` / `pick_color(id, x, y)`,内部经 WebviewClient.handle(id) 调 action,错误映射后返回;含类型契约与错误映射单元测试

## 4. 构建验证

- [x] 4.1 `cargo check -p openharmony-ability-plugin-screenshot -p openharmony-ability-plugin-webview` host + `--target aarch64-unknown-linux-ohos` 双侧 0 error 0 warning
- [x] 4.2 cmd.exe 显式跑 pack.bat 重建 HAR,验证 package 内 WebviewPlugin.ets 含 capture-webview/pick-color 分支;grep 校验 package 镜像与源一致;pack-plugins 计数保持 16
