# ohos-webview-key-synthesis

## Why

ArkWeb 在 OHOS 上把物理键盘文本录入路由到 IME 插入管线（2026-08-28 真机四探针实证）：

- DOM `keydown` 每次物理按压只发一次，且 `key`/`code` **为空**（无按键身份）
- auto-repeat 不产生重复 keydown——重复字符由 IME 直接插入，`preventDefault` 拦不住
- 每个重复周期 ArkWeb 还合成一对无身份的 keydown/keyup（假 keyup 会破坏 Set 法重复检测）
- 按键身份只在物理抬起的 `keyup` 上出现一次

后果：前端所有依赖 `e.repeat` / `e.code` 的逻辑（撤销分组、游戏按键、快捷键库）在 ArkWeb 上结构性失效。tao 侧的 `PRESSED_KEYS` repeat 检测对 tauri 应用也不可达（NDK XComponent 键盘回调在 WebView 覆盖下不触发，且 tauri-runtime-wry 不转发 `KeyboardInput`）。

`MainPage.onKeyPreIme`（IME 之前）收到的是**干净的连发**：连续 Down 携带 keyCode（~51ms 间隔，无假 Up 真机实证）——这是应用层唯一可用的修复挂载点。

## What Changes

全部改动在 openharmony-ability 仓（铁律#1），tauri/tao/wry 零改动：

- **新增 `native_ability/src/main/ets/helper/key_synthesis.ets`**：
  - 按下键集合（Set 法 repeat 检测，与 tao `PRESSED_KEYS` 同构）
  - OHOS keyCode → DOM `code`/`key`/legacy `keyCode`/`location` 映射表（字母/数字/F 键/小键盘按连续段计算，特殊键查表）
  - 修饰键状态从按键流自跟踪（Ctrl/Shift/Alt/Meta）
  - controller 注册表：`notifyKeySynthesisController(windowId, controller)`（executor 注册表模式）
  - 入口 `synthesizeDomKeyEvent(event, windowId)`：Down→查集合判 repeat→`runJavaScript` 派发合成 `KeyboardEvent`（带 `__ohosSynthetic` 标记 + `isTrusted` defineProperty 补真）；Up→仅当 Down 曾派发才派发 keyup（防止被拦截快捷键产生孤儿 keyup）
  - `KEY_SYNTHESIS_SHIM`：页面初始化脚本，window 捕获阶段 `stopImmediatePropagation` 掉所有非合成 keydown/keyup（只停传播不 preventDefault，IME 插字不受影响）
- **`MainPage.onKeyPreIme`**：既有拦截链（clipboard/zoom/accelerator/ESC）不动，fall-through 路径喂给 synthesizeDomKeyEvent——被消费的快捷键不会泄入页面
- **`WebviewPlugin.ets`**：
  - `handleControllerAttached` 注册 controller（**含主窗口**，与 WindowManager 的子窗口专属 map 分离，不碰 menu 语义）
  - `javaScriptOnDocumentStart` 追加 shim——**仅主窗口**（Float 子窗口无 key-synthesis 接线，注入 shim 会丢失全部按键事件）
  - shim 的 `scriptRules` 取应用自身初始化脚本规则的**并集**（空数组=不匹配任何文档；`*` 不匹配 `tauri://localhost` 自定义协议——两个真机踩坑）

## Impact

- 主窗口前端 keydown/keyup 获得完整按键身份与 `repeat=true` 连发，原生退化事件被抑制
- 文本录入不受影响（IME 插入路径未动，实测无双重插入）
- Float 子窗口、sub-UIAbility 实例窗口（id>0）、无 webview 应用（egui 类）行为不变
- 合成事件 `isTrusted` 经 defineProperty 补真（Chromium 系可行，真机验证通过）

## 已知边界（文档化）

- Shift+数字等布局相关符号 key 值不还原（返回未修饰键值）
- 焦点在 iframe 内时事件派发到顶层 activeElement
- tao/tauri 侧 `KeyboardInput` 转发**不做**（无消费者；出现 Rust 侧需求再立项）
- 既有行为：长按快捷键连发会重复触发 accelerator（本变更前已存在，未改）
- sub-UIAbility 实例窗口（id>0）维持退化：合成与 shim 注入均仅限主窗口（id=0）——实例窗口加载同一 MainPage 但无 shim，合成若不加窗门会造成双份事件（合成 + 未抑制原生）

## 验证

真机（API 23 desktop）Key Repeat Detection 按钮验收：
- 长按 j：连续绿色 `D key="j" code=KeyJ repeat=true`（首行 false），无灰色原生对，`SetR=true`
- 松开：单行 `U key="j" code=KeyJ`
- 点按（非长按）：`repeat=false`
- 输入框文字正常连出，无翻倍
- hilog 无 `KeySynthesis` 告警
