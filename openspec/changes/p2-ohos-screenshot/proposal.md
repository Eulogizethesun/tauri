# Proposal: p2-ohos-screenshot

## Why

Phase 1b（change: p1-ohos-screenshot）已在 openharmony-ability 交付截图取色 bridge 层：ArkTS `captureWebview`（webPageSnapshot → ImagePacker → base64 PNG）与 `pickColor`（readPixels 1×1 BGRA→RGBA），以及 Rust facade crate `openharmony-ability-plugin-screenshot`（`ScreenshotClient::capture_webview(id)` / `pick_color(id, x, y)`）。但这些能力尚未以 plugins-workspace 插件形态暴露给 JS 前端，examples/api 也没有 demo 页与自动化断言。本 Phase 完成上层集成，兑现 R229 的降级修订（应用内 webview 截图/取色可用，系统级 `@ohos.screenshot` 仅系统应用）。

## What Changes

1. **新建 `plugins-workspace/plugins/screenshot/`**（`tauri-plugin-screenshot`，OHOS 专属插件，参照 tauri-plugin-accessibility 形态）：
   - 命令 `capture_webview` / `pick_color`：OHOS 分支经 `tauri::ohos::APP.lock() → app.screenshot()`（`ScreenshotExt`，clipboard-manager 先例）拿 `ScreenshotClient`，webview id 取自 tauri 命令参数自动注入的 `tauri::Webview<R>` 的 `label()`（bridge 注册表 key = webview label，主窗口为 `"main"`，无需 JS 显式传参）；非 OHOS 分支返回 `Unsupported` stub。
   - setup：无需 register_plugin（screenshot 无独立 ArkTS 插件，WebviewBridgePlugin 已由 tauri-runtime-wry 全局注册）。
   - guest-js：`captureWebview(): Promise<CapturedImage>`（`{ pngBase64, width, height }`）、`pickColorAt(x, y): Promise<Rgba>`（`{ r, g, b, a }`）；dist-js 构建。
   - permissions/default.toml：allow-capture-webview / allow-pick-color。
2. **examples/api 接入**：
   - src-tauri OHOS target 依赖 + `.plugin(tauri_plugin_screenshot::init())` + capabilities/ohos-plugins.json 加 `"screenshot:default"`；package.json 加 `file:` 依赖。
   - 新建 `src/views/Screenshot.svelte` demo 页：渲染已知纯色色块（#FF0000 / #00FF00 / #0000FF / #FFFFFF / #000000），注册进 App.svelte views 数组。
   - 新建 `src/lib/tests/ohos-screenshot.ts` 测试套件（auto：capture_webview 断言 base64 前缀+宽高>0；side-effect：pickColorAt 对已知色块中心取色断言 RGB 误差≤阈值）并注册进 test-runner。
3. **spec 修订**：`ohos-platform-limitations` R229 从"暂不实现"改为指向本插件的最小 API 边界声明（应用内 webview 截图可用；`@ohos.screenshot` 系统级截图仍不可用）+ 汇总表行更新。

## Impact

- 新增代码：plugins-workspace/plugins/screenshot/（~10 文件）、examples/api demo 页+测试套件（~3 文件）
- 修订：examples/api src-tauri 集成 4 文件、ohos-platform-limitations spec、ohos-screenshot-plan.md 状态
- 不修改任何既有平台（Windows/macOS/Linux）路径；所有 OHOS 代码 `cfg(target_env = "ohos")` 隔离
- 依赖：Phase 1b bridge 层已交付（crates/plugin-screenshot + WebviewPlugin.ets capture-webview/pick-color action）
