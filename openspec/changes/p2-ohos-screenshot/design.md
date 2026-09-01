# Design: p2-ohos-screenshot

## Context

- Phase 1b 已交付 bridge 层（change p1-ohos-screenshot）：`openharmony-ability-plugin-screenshot` crate 提供 `ScreenshotExt::screenshot()` → `ScreenshotClient`，`capture_webview(id)` / `pick_color(id, x, y)` 返回 `CapturedImage{png_base64,width,height}` / `Rgba{r,g,b,a}`，类型化错误 `ScreenshotError::{UnknownWebview,SnapshotUnavailable,Internal}`。
- **webview id 解析（关键调研结论）**：bridge 侧 `WebviewSurface.entries: Map<string, WebviewEntry>` 的 key = Rust `WebviewCreateRequest.id`，而 tauri-runtime-wry `create_webview` 传给 wry 的 `with_id(&label)` 就是 tauri webview label（tauri-runtime-wry/src/lib.rs:5370-5371）。**因此 bridge id == webview.label()**，主窗口即 `"main"`。native_ability `WindowManager.controllers`（numeric window id）是另一套注册表，与 screenshot 无关。
- 命令参数注入：tauri 命令可声明 `webview: tauri::Webview<R>`（positioner `move_window(window: tauri::Window<R>)` 先例）自动注入调用来源 webview，`.label()` 即 bridge id，**JS 无需传 label，不向 JS 暴露 bridge id 概念**。
- `ScreenshotClient` 获取：`tauri::ohos::APP.lock() → .as_ref().ok_or(...)?.screenshot()?`，clipboard-manager desktop.rs:177-184 同款模式，每命令调用时取（cheap clone）。
- setup 无需 register_plugin：screenshot 无独立 ArkTS 插件；WebviewBridgePlugin 已由 tauri-runtime-wry `set_ohos_window_client`（lib.rs:150-158）注册。

## Goals / Non-Goals

- **Goals**: OHOS 专属 `tauri-plugin-screenshot` 暴露 `captureWebview`/`pickColorAt` JS API；examples/api 已知色块 demo + 自动化断言；R229 spec 修订。
- **Non-Goals**: 系统级 `@ohos.screenshot`（仅系统应用）；跨 webview 截图（`label: Option<String>` 参数，留未来）；`with_webview` + `PlatformWebview::inner()` 路径（async 回调需 channel 回收，比 APP 路径繁琐，不采用）；非 OHOS 平台实现（stub 返回 Unsupported）。

## Decisions

### D1: 插件骨架 = accessibility 骨架 + clipboard APP.lock 模式（无 ArkTS 注册）

Builder 双分支（OHOS `invoke_handler` 指 ohos.rs，非 OHOS 指 commands.rs stub）。crate 级 `#![cfg(not(any(target_os = "android", target_os = "ios")))]` 排除原生 mobile 平台（与 accessibility 一致）。OHOS 分支 setup 仅 log（无 register_plugin、无事件订阅）。crate 无 `[target.'cfg(target_env = "ohos")'.dependencies]` 之外的桥接依赖：`openharmony-ability-plugin-screenshot` path 依赖 + tauri/serde/thiserror/log workspace 依赖。build.rs COMMANDS = `["capture_webview", "pick_color"]`（snake_case，自动生成 allow-capture-webview / allow-pick-color 权限）。Cargo.toml platforms.support 逐平台声明（参照 accessibility Cargo.toml），ohos notes = "webview screenshot + color pick"。

### D2: 命令签名与 id 解析

```rust
#[tauri::command]
async fn capture_webview<R: tauri::Runtime>(webview: tauri::Webview<R>) -> Result<CapturedImageDto, Error>
#[tauri::command]
async fn pick_color<R: tauri::Runtime>(webview: tauri::Webview<R>, x: u32, y: u32) -> Result<RgbaDto, Error>
```

- **serde DTO**：bridge 层 `CapturedImage`/`Rgba`（openharmony-ability-plugin-screenshot）是纯 Rust facade 类型，**未 derive Serialize**，不能直接作命令返回类型。插件在 ohos.rs 定义 `CapturedImageDto { png_base64, width, height }` / `RgbaDto { r, g, b, a }`，derive `Serialize` + `#[serde(rename_all = "camelCase")]`，经 `From<bridge::CapturedImage>` / `From<bridge::Rgba>` 转换。
- `webview` 由 tauri 自动注入（调用来源 webview，`CommandArg for Webview` 实现，clipboard-manager/fs 先例）；`webview.label()` 即 bridge id。
- client 获取走独立 `client()` helper（同 accessibility ohos.rs 模式），guard 在 helper 返回时 drop，不跨 .await：
  `let client = tauri::ohos::APP.lock().map_err(|_| Error::Screenshot("OHOS APP mutex poisoned".into()))?.as_ref().ok_or_else(...)?.screenshot().map_err(...)?;` 之后 `client.capture_webview(webview.label()).await`。
- 错误映射：`ScreenshotError` → 插件 `Error::Screenshot(String)`，from_reason 按 bridge reason 归类文案（UnknownWebview → "unknown webview"、SnapshotUnavailable → "snapshot unavailable"、Internal → 原文透传）。

### D3: JS API 形态（不暴露 label/bridge id）

guest-js：`captureWebview(): Promise<CapturedImage>`、`pickColorAt(x: number, y: number): Promise<Rgba>`（invoke `plugin:screenshot|capture_webview` / `plugin:screenshot|pick_color`）。序列化字段：`{ pngBase64, width, height }` / `{ r, g, b, a }`（tauri command 返回 struct 走 serde camelCase 惯例，Rust 结构体加 `#[serde(rename_all = "camelCase")]`）。

### D4: 已知色块 demo + 取色断言

- `src/views/Screenshot.svelte`：5 个已知纯色 div（#FF0000/#00FF00/#0000FF/#FFFFFF/#000000，尺寸 ≥80px 见方），每个色块标注其在视口中的取色坐标（由 getBoundingClientRect + window.devicePixelRatio 计算）。
- 测试 `src/lib/tests/ohos-screenshot.ts`：
  - auto `captureWebview`：断言 `pngBase64` 以 `"iVBOR"`（PNG base64 头）开头、width/height > 0。
  - side-effect `pickColorAt`：对红色块中心取色，断言 r>200、g<60、b<60（容忍压缩/渲染偏差）；失败时打印实际值供人工判读。
  - manual `screenshotDemo`：引导人工查看 demo 页截图预览（img src=data:image/png;base64）。
- 坐标系说明：ArkWeb snapshot 像素坐标 = webview CSS 像素 × devicePixelRatio；demo 页计算取色坐标时乘 dpr（snapshot 尺寸即验证基准，captureWebview 返回的 width/height 可用于按比例换算，比盲乘 dpr 更稳——实现时优先用返回 width / innerWidth 比例换算）。

### D5: 权限

screenshot 零系统权限（应用内 webview 快照）。permissions/default.toml 仅 `allow-capture-webview` / `allow-pick-color`。module.json5 无新增声明。

### D6: examples/api 集成

Cargo.toml OHOS target 依赖 + lib.rs OHOS 块 `.plugin(tauri_plugin_screenshot::init())` + capabilities/ohos-plugins.json `"screenshot:default"` + package.json `file:` 依赖 + pnpm install。

## Risks / Trade-offs

- **取色坐标偏移**：webview 内容滚动/DPR 缩放可能让固定坐标取错位置——D4 用比例换算（capture 返回 width / window.innerWidth）缓解；断言用宽容阈值而非精确相等。
- **snapshotPixelMap 初次白屏**：ArkWeb snapshot 首次可能返回空白（1b 已有 500ms 延迟 + 3 重试 + 10s 超时兜底）；真机若仍偶发失败，测试标 side-effect 而非 auto 硬断言。
- **base64 大对象跨 bridge**：几 MB PNG 的 string 传递是已知权衡（1b D1 已定，比 Array<number> 8x 膨胀优）；demo 页不追求高清。

## Open Questions

（2026-08-27 真机验证已回填，见 Resolved Questions）

## Resolved Questions

- ✅ **pickColor 对纯色块的实际偏差** — **零偏差**。真机（HUAWEI MateBook Pro 2in1）实测红色块 `css(60,60) → snapshot(114,114)`（scale=1.900）→ **rgba(255,0,0,255)** 像素级精确；D4 的宽容阈值（r>200/g<60/b<60）远宽于实际，保留阈值不改（防其他机型合成管线差异）。
- ✅ **captureWebview 规格** — 快照 2092×1249（≈viewport CSS × 1.9 dpr），PNG base64 503,492 chars（~503KB），792ms 完成。
- ✅ **越界错误** — `pick-color coordinates (2102, 1259) out of captured bounds 2092x1249`，结构化拒绝（Internal 变体带 bounds 原文），1.4s 内返回。
- ✅ **测试结果** — 287 passed / 1 failed（唯一失败为已知 clipboard 读权限平台限制，与本插件无关）；#276/#277/#278 三用例全绿。
