# iframe-ipc-response-routing 适配计划

**创建时间**:2026-10-19
**功能描述**:修复 OHOS 平台 iframe 子 frame 内 `invoke` / `listen` / `Channel` 回调路由缺失 —— 响应 eval(`window.__TAURI_INTERNALS__.runCallback(id, js)`)经 ArkTS `runJavaScript` 只进主 document,而 init scripts 注入所有 frame,子 frame 注册的 callback 永远收不到响应(BUILD-INFO P3:头像点"账号登录"弹不出,`Couldn't find callback id`)。
**判断依据**:涉及 1 个代码层(tauri init script),预估 1 个文件 —— 单 Phase 不拆分(用户已确认 2026-10-19)。

**红灯用例**(已就位,真机已确认失败):`examples/api` `@tauri-apps/api/core.invoke (iframe child frame routing)` —— 307✅/1❌,`invoke('echo') from the iframe never settled (timeout)`,前置注入断言全过(init scripts / transformCallback / window.ipc 均已到达 iframe)。

**激活范围**(用户已确认 2026-10-19):仅 `osName === 'ohos'` 激活中继;Android 保持上游现状零变化;桌面 fetch 通道平台零影响。

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1 | iframe IPC 响应中继 | p1-iframe-ipc-response-routing | ✓ 设计完成 | tauri(scripts/core.js) | 1 | 红灯用例转绿 + 全量回归(ohos-build run-tests.sh desktop) |

## Phase 详细说明

### Phase 1: iframe IPC 响应中继
- **目标**:OHOS 平台上,`runCallback` eval 在主 frame Map miss 时,将响应经 `window.frames` 广播转发至子 frame(同源 targetOrigin 投递);子 frame init script 挂 message 监听执行本地 Map;嵌套 frame 链式转发。`invoke` 响应、事件(`listen` handler)、`Channel` 投递三类回调统一覆盖。
- **文件列表**:
  - `tauri/crates/tauri/scripts/core.js`(唯一实现文件;`osName === 'ohos'` 门控)
- **依赖**:无(红灯用例已就位:`src/lib/tests/core.ts` + `public/iframe-ipc-child.{html,js}`)

## 关键事实(设计输入,探索已实证)

1. callback id 为 32 位随机数(`crypto.getRandomValues`,core.js:6-8),各 frame 独立随机命名空间,撞号概率可忽略 → 无需 id 分段
2. 三类回调共用 eval 链:`format_callback.rs:103`(invoke)、`channel.rs:179/275`(Channel)、`event/mod.rs:233`(event)→ 全部 `window.__TAURI_INTERNALS__.runCallback(id, js)`
3. ArkWeb `runJavaScript`/`runJavaScriptExt` 无 frame 参数(官方文档 10 处签名 0 处提及 frame)→ 定向 eval 不可行,JS 层中继是唯一低风险路径
4. init scripts 注入所有 frame(scriptRules `""`→`"*"` 合并单 ScriptItem);`window.ipc` jsProxy 亦到达 iframe(红灯用例 hasIpc 断言实证)
5. iframe 间 `window.postMessage` 双向可用(红灯用例 ready/run/result 三层握手全走 postMessage 成功)→ 中继通道可行性已实证
6. 方案 B(改走 custom protocol fetch)不可行:上游因 WebView 拿不到 POST body 排除 Android/OHOS,wry OHOS 无 body 通路,补齐需动 ArkTS+wry+ipc-protocol.js 三层
7. 上游 Android 同病(`ipc-protocol.js` 同构排除 + evaluateJavascript 主 frame)—— 本修复限 OHOS 激活,Android 留待上游讨论
