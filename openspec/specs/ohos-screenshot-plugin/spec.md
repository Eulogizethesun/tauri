# ohos-screenshot-plugin Specification

## Purpose
TBD - created by archiving change p2-ohos-screenshot. Update Purpose after archive.
## Requirements
### Requirement: tauri-plugin-screenshot 提供 OHOS 应用内 webview 截图取色插件
`plugins-workspace/plugins/screenshot/` SHALL 提供 OHOS 专属插件 `tauri-plugin-screenshot`：命令 `capture_webview` / `pick_color` 经 Phase 1b 交付的 `openharmony-ability-plugin-screenshot` facade（`ScreenshotClient`）调用 ArkTS bridge action `capture-webview` / `pick-color`。所有 OHOS 代码 SHALL 通过 `cfg(target_env = "ohos")` 隔离；非 OHOS 平台命令 SHALL 返回 `Unsupported` 错误。

#### Scenario: JS 调用 captureWebview
- **WHEN** 前端调用 `captureWebview()`（invoke `plugin:screenshot|capture_webview`）
- **THEN** 后端 SHALL 用自动注入的 `tauri::Webview<R>` 的 `label()` 作为 bridge webview id
- **AND** SHALL 返回 `CapturedImage { pngBase64: string, width: number, height: number }`（serde camelCase）
- **AND** `pngBase64` SHALL 是合法 PNG 的 base64 编码

#### Scenario: JS 调用 pickColorAt
- **WHEN** 前端调用 `pickColorAt(x, y)`（invoke `plugin:screenshot|pick_color`）
- **THEN** 后端 SHALL 以同一 label 解析 controller 并在 (x, y) 读取 1×1 像素
- **AND** SHALL 返回 `Rgba { r, g, b, a }`（readPixels BGRA → RGBA 转换后的通道）
- **AND** x/y 超出截图边界时 SHALL 返回结构化错误（"out of captured bounds"）

#### Scenario: 非 OHOS 平台调用
- **WHEN** 在 Windows/macOS/Linux/mobile 非 OHOS 平台调用任一命令
- **THEN** SHALL 返回 `Unsupported` 错误且不触碰任何 OHOS API

### Requirement: 错误按 ScreenshotError 分类透传
插件命令 SHALL 将 bridge 错误 reason 映射为面向 JS 的结构化错误文案：Unknown WebView controller → "unknown webview"、webpagesnapshot/timed out → "snapshot unavailable"、其余 → 原文透传。

#### Scenario: webview 不存在
- **WHEN** label 对应的 webview 未注册（如窗口已销毁）
- **THEN** SHALL 返回 "unknown webview" 类错误，而非 panic 或挂起

### Requirement: 插件无需额外 ArkTS 注册与系统权限
插件 setup SHALL NOT 注册新的 ArkTS bridge plugin（WebviewBridgePlugin 已由 tauri-runtime-wry 全局注册）；screenshot 能力 SHALL NOT 需要任何 module.json5 权限声明（应用内 webview 快照，零系统权限）。

#### Scenario: 权限配置
- **WHEN** 应用接入 `screenshot:default` capability
- **THEN** SHALL 仅授权 allow-capture-webview / allow-pick-color 两个命令
- **AND** module.json5 SHALL NOT 需要新增 requestPermissions 条目

### Requirement: examples/api 提供已知色块 demo 与自动化断言
examples/api SHALL 提供 `Screenshot.svelte` demo 页（≥5 个已知纯色色块）+ `ohos-screenshot.ts` 测试套件：
- auto 用例：captureWebview 断言 PNG base64 前缀与正数宽高
- side-effect 用例：pickColorAt 对已知红色块取色，断言 RGB 通道在宽容阈值内
- manual 用例：截图预览人工确认

#### Scenario: 自动化截图断言
- **WHEN** TestRunner 跑 ohos-screenshot 套件
- **THEN** captureWebview 用例 SHALL 断言 `pngBase64.startsWith("iVBOR")` 且 width/height > 0
- **AND** pickColorAt 用例 SHALL 对红色块断言 r>200、g<60、b<60（阈值可按实测回填）

