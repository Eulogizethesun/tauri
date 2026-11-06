# Proposal

## Why

OHOS 平台上,webview 内 iframe 子 frame 发起的 Tauri IPC 永远无法 settle:`ipc-protocol.js` 因 ArkWeb custom protocol 拿不到 POST body 而将 OHOS 排除在 fetch 通道外(与 Android 同构),全部 invoke 走 `window.ipc.postMessage` 单向上行;而 Rust 侧响应以 `window.__TAURI_INTERNALS__.runCallback(id, js)` 形式经 wry eval → ArkTS `WebviewController.runJavaScript` 回投——该 API 只在主 document 执行(ArkWeb 无 frame 定向参数,官方文档 10 处签名查证)。init scripts 却注入所有 frame,子 frame 里注册的 callback id 因此永远收不到响应。

真实业务已受阻断(zhkt60 教师端 BUILD-INFO P3:业务 iframe 加载后主 frame IPC 回调丢失,`Couldn't find callback id`,头像"账号登录"弹不出)。红灯用例已在真机确认:examples/api `@tauri-apps/api/core.invoke (iframe child frame routing)` 失败于 `invoke('echo') from the iframe never settled (timeout)`,而注入侧断言(init scripts / transformCallback / window.ipc 到达 iframe)全部通过——缺陷精确锁定在响应路由。

同一断裂覆盖三类回调:`invoke` 响应(`format_callback.rs:103`)、Channel 投递(`channel.rs:179/275`)、事件 handler(`event/mod.rs:233`)——全部经同一条主-frame-only eval 链。

## What Changes

- `crates/tauri/scripts/core.js`(OHOS 门控,唯一实现文件):
  - 主 frame:`runCallback` 在本地 callbacks Map miss 时(现状仅 `console.warn` 后丢弃),将 `{id, data}` 经 `window.frames` 广播转发至子 frame,`targetOrigin = window.location.origin`(同源投递;跨源 frame 不投递,保持现状)
  - 子 frame:init script 挂 `message` 监听(校验 `event.origin === window.location.origin` 且 `event.source === window.parent`),收到转发后以本地 Map 执行 `runCallback`;本地 miss 且自身有子 frame 时链式继续向下转发(支持嵌套 iframe)
  - 激活条件 `osName === 'ohos'`(用户裁定 2026-10-19):Android 保持上游现状零变化,桌面 fetch 通道平台零影响
- 无 Rust / wry / ArkTS 改动;callback id 为 32 位随机数(`crypto.getRandomValues`),各 frame 独立命名空间,无需 id 分段重编
- 验收:红灯用例转绿 + examples/api 全量套件(desktop)回归 + 转发消息可被 hilog/console 观测

## Capabilities

### New Capabilities
- `ohos-ipc-frame-routing`: OHOS 平台 IPC 回调的跨 frame 路由——postMessage IPC 模式下,`runCallback` 响应(invoke 结果、Channel 数据、事件)从主 frame 中继至注册该回调的子 frame;含同源投递边界、嵌套 frame 链式转发、非 OHOS 平台行为不变。

### Modified Capabilities

(无——现有 specs 无 IPC 路由相关能力;`ohos-multi-webview`、`ohos-webview-*` 均为窗口/容器层行为,不涉 frame 内回调路由)

## Impact

- **代码**:`tauri/crates/tauri/scripts/core.js`(1 文件)。该文件是编译进 `__TAURI_INTERNALS__` 初始化的 init script 模板,随 `tauri` crate 发布;改动经 `__TEMPLATE_os_name__` 门控,其余平台产物字节级不变
- **测试**(已就位,随本 change 一并提交):`examples/api/src/lib/tests/core.ts` 新用例 + `examples/api/public/iframe-ipc-child.{html,js}` 探针页
- **依赖**:零新增;postMessage/structured clone 为 Web 标准 API,ArkWeb 支持性已由红灯用例的 ready/run/result 三层握手实证
- **上游对齐**:上游 Android 存在同构缺陷(evaluateJavascript 亦主 frame only);本修复的 JS 中继形态对上游通用,激活名单扩至 android 即可惠及,留作上游 PR 讨论
- **风险**:主 frame miss 才转发,主 frame hit 路径不变;随机 id 撞号(主/子 frame 同时持有同 id,概率 ~n²/2³²)时响应被主 frame 执行——与现状行为一致,非新增风险
