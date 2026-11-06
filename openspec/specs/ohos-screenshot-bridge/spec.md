# ohos-screenshot-bridge Specification

## Purpose
TBD - created by archiving change p1-ohos-screenshot. Update Purpose after archive.
## Requirements
### Requirement: WebviewPlugin SHALL 提供应用内 webview 截图 action
WebviewPlugin(id=`ohos.webview`)SHALL 新增 `capture-webview { id }` action,经 `controller.webPageSnapshot()`(带重试+超时,复用既有 web-page-snapshot 封装模式)获得完整 PixelMap,经 ImagePacker 编码 PNG 并以 base64 字符串跨桥(避免 Vec<u8>→Array<number> 陷阱),返回 `{ pngBase64, width, height }`。PixelMap 与 ImagePacker SHALL 在使用完毕(含异常路径)后 `release()`,SHALL NOT 跨 action 缓存。

#### Scenario: 截取已渲染的主窗口 webview
- **WHEN** webview 已完成首帧渲染且调用 `capture_webview(id)`
- **THEN** SHALL 返回有效 PNG(base64 可解码为 PNG 魔数)与实际宽高

#### Scenario: webview id 不存在
- **WHEN** 传入未注册的 webview id
- **THEN** SHALL 返回 `UnknownWebview` 错误,SHALL NOT panic

#### Scenario: 快照不可用
- **WHEN** webPageSnapshot 重试耗尽/超时/status=false(如 webview 尚未首帧)
- **THEN** SHALL 返回 `SnapshotUnavailable` 结构化错误

### Requirement: WebviewPlugin SHALL 提供单像素取色 action
`pick-color { id, x, y }` action SHALL 以同一 webPageSnapshot PixelMap 路径执行 `readPixels(PositionArea)` 读取指定坐标 1px 区域。readPixels 固定按 **BGRA_8888** 输出(与 PixelMap 自身 pixelFormat 无关),ArkTS 侧 SHALL 按字节序 b[0]=B/b[1]=G/b[2]=R/b[3]=A 转换后返回 `{ r, g, b, a }`。PositionArea SHALL 由调用方提供 ArrayBuffer(`pixels: new ArrayBuffer(4), offset: 0, stride: 4, region: {x, y, size: {width: 1, height: 1}}`)。坐标为快图像素坐标;越界 SHALL 返回结构化错误,SHALL NOT panic。

#### Scenario: 对已知纯色区域取色
- **WHEN** webview 渲染已知 #FF0000 色块且对其坐标调用 `pick_color`
- **THEN** SHALL 返回 `{ r: 255, g: 0, b: 0, a: 255 }`(±1 容差由 p2 断言处理)

#### Scenario: 坐标越界
- **WHEN** x/y 超出快照尺寸
- **THEN** SHALL 返回结构化错误

### Requirement: 错误 SHALL 以 throw 结构化透传
所有 action SHALL 在 try/catch 捕获 BusinessError 后 `throw new Error`(bridge runtime 转 Rust Err),SHALL NOT 返回 `{ok:false}` 结构或未捕获异常。Rust facade SHALL 按错误消息标记映射 `ScreenshotError` 枚举(UnknownWebview/SnapshotUnavailable/Internal),SHALL NOT panic 或静默吞错。

#### Scenario: 系统错误透传
- **WHEN** packing 或 readPixels 抛出 BusinessError
- **THEN** Rust 侧 SHALL 收到 `ScreenshotError::Internal` 携带原始错误信息

### Requirement: Rust facade SHALL 以类型化 client 暴露
`crates/plugin-screenshot` SHALL 提供 `ScreenshotClient`(`ScreenshotExt::screenshot(&OpenHarmonyApp)` 构造),内部经 `openharmony-ability-plugin-webview` 的 `WebviewClient` 调用上述 action,方法 `capture_webview(id) -> Result<CapturedImage{png_base64,width,height}>` 与 `pick_color(id, x, y) -> Result<Rgba>`。全部 `cfg(target_env = "ohos")` 隔离(经 plugin-webview 依赖自然隔离),主线程禁 block_on。

#### Scenario: 非 OHOS 平台隔离
- **WHEN** 非 OHOS target 编译 openharmony-ability workspace
- **THEN** plugin-screenshot OHOS 专属代码 SHALL NOT 参与 Windows/macOS/Linux 构建

#### Scenario: facade 编译
- **WHEN** `cargo check -p openharmony-ability-plugin-screenshot` host 与 aarch64-unknown-linux-ohos 双侧
- **THEN** SHALL 0 error 0 warning

### Requirement: 注册链路 SHALL 零新增 ArkTS 插件
本变更 SHALL NOT 新增 ArkTS 插件、pack-plugins 收录条目或 EntryAbility 模板/gen 注册(D1 修订);WebviewBridgePlugin 的 Rust 侧注册已由 tauri-runtime-wry `set_ohos_window_client` 既有链路承担。

#### Scenario: 构建产物验证
- **WHEN** 重建 HAR
- **THEN** package 内 WebviewPlugin.ets SHALL 含 `capture-webview` 与 `pick-color` action 分支
- **AND** pack-plugins.ps1 插件计数保持 16

