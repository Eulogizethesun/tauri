# Design

## Context

见 proposal.md - Why。机制链与关键事实(plan 文件「关键事实」节全量实证):

- OHOS 上 `ipc-protocol.js:20` 将 ohos 排除出 fetch 通道 → 全部 invoke 走 `window.ipc.postMessage` 单向上行(jsProxy 注入所有 frame,红灯用例 hasIpc 实证)
- Rust 侧三类回调(invoke 响应 `format_callback.rs:103`、Channel `channel.rs:179/275`、事件 `event/mod.rs:233`)统一拼 `window.__TAURI_INTERNALS__.runCallback(id, js)` → wry eval → ArkTS `WebviewController.runJavaScript` —— 仅主 document 执行,ArkWeb 无 frame 定向参数(官方文档 10 处签名查证)
- init scripts 注入所有 frame(wry `scriptRules "*"` 合并单 ScriptItem)→ 子 frame 有完整 callbacks Map,但 `runCallback` eval 永不抵达
- callback id 为 `crypto.getRandomValues(Uint32Array)` 32 位随机数(core.js:6-8),各 frame 独立随机命名空间
- 主 frame `runCallback` miss 时现状仅 `console.warn("Couldn't find callback id ...")` 丢弃(core.js:44-46)
- ArkWeb iframe↔parent `window.postMessage` 双向可用(红灯用例 ready/run/result 三层握手实证)

## Goals / Non-Goals

**Goals:**

- OHOS 平台,同源子 frame 内注册的 invoke/事件/Channel 回调收到响应(specs 全部 requirement)
- 主 frame hit 路径与非 OHOS 平台行为零变化
- 单文件实现(`crates/tauri/scripts/core.js`),不碰 Rust/wry/ArkTS

**Non-Goals:**

- 跨源 iframe 回调送达(保持现状丢失;同源投递是安全边界,见 D3)
- Android 激活(上游同病,但本 change 经用户裁定仅 OHOS;JS 中继形态对上游通用,扩名单即可,留作上游 PR)
- 桌面平台 iframe 事件/Channel 路由缺陷(上游 fetch 通道下事件同样只 eval 主 frame;不在本 change 激活范围)
- custom protocol fetch 通道的 POST body 补齐(方案 B,见 D1 弃选理由)

## Decisions

### D1: JS 层中继(选定)vs 备选方案

| 方案 | 结论 | 理由 |
|---|---|---|
| **A. core.js JS 层中继** | ✅ 选定 | 单文件改动;不碰 Rust/wry/ArkTS;通道(postMessage)已被红灯用例实证;主 frame miss 才转发,零路径覆盖 |
| B. OHOS 改走 fetch custom protocol | ❌ | 需 ArkWeb onInterceptRequest 读 POST body(能力存疑,上游因同类 Android 限制而排除 ohos)+ wry body 通路 + ipc-protocol.js 三层改动;风险与工作量不成比例 |
| C. Rust/ArkTS 侧记录"发起 frame"并定向回投 | ❌ | 上行 `window.ipc.postMessage` 是 jsProxy 调用,ArkTS 端不携带来源 frame 信息,注册表无从建起;ArkWeb 亦无定向 eval API |
| D. 子 frame 轮询邮箱 | ❌ | 无 per-frame 可轮询通道(邮箱只能放 custom protocol,回到方案 B 的 body 问题) |

### D2: 插入点 = 主 frame `runCallback` 的 miss 分支

现状 miss 分支只 `console.warn`。在 warn 之后追加"向直接子 frame 广播"即完成主 frame 侧;主 frame hit 分支(hall现路径)一行不动。三类回调(invoke/event/Channel)在此单点汇合,一个插入点全覆盖。

### D3: 广播语义与同源边界

- 遍历 `window.frames`(标准 DOM API,当前 frame 的直接子 frame 集合),逐个 `postMessage(payload, window.location.origin)`;每次调用独立 `try/catch` —— iframe 可能已被业务代码移除,postMessage 到已销毁 frame 会抛错,单个 dead frame 不得中断对其余 frame 的广播
- **targetOrigin = 主 frame 自身 origin**:同源子 frame 收到;跨源 frame 由 postMessage 标准语义不投递(targetOrigin 不匹配即丢弃)——跨源保持现状丢失,且响应数据不泄漏给跨源 frame。安全模型不劣化:同源 frame 本可直接访问 `parent.__TAURI_INTERNALS__`(同源全信任),中继未引入新攻击面
- 每层只发直接子 frame;嵌套场景由子 frame miss 后继续向自己的子 frame 转发(链式,方向单向向下,无环)

### D4: 子 frame 接收端

- init script(core.js)在每个 frame 的 document start 注入 → 监听器先于任何业务代码就位,无时序窗口
- 监听 `message` 事件,双重校验:`event.origin === window.location.origin` 且 `event.source === window.parent` —— 只接受直接父级转发的同源消息,拒绝任意同源窗口/伪造来源
- 收到后调本地 `runCallback(id, data)`(与 eval 直达完全同一条执行路径):hit 执行(once wrapper 照常删 id);miss 且自身有子 frame → 继续向下转发;miss 且无子 frame → 走现有 warn(消息含"forwarded"语境,便于 hilog 定位)

### D5: 转发消息协议

```
{ __TAURI_FRAME_CALLBACK__: true, id: number, data: <runCallback 第二参数原值> }
```

- `__TAURI_FRAME_CALLBACK__` 布尔标记区分手工 postMessage 业务消息(业务 traffic 不带此标记即被忽略,零冲突;命名对齐 `__TAURI_INTERNALS__` / `__TAURI__` 前缀惯例)
- `data` 经 postMessage structured clone 传递:runCallback 的第二参数来自 Rust JSON 序列化(裸字面量或 `JSON.parse('...')` 结果),恒为可克隆的 plain JSON 值,无函数/循环引用/克隆失败路径
- 不转发"错误回调"特殊标记:错误与成功统一走 runCallback(id, data),iframe 侧 reject 逻辑已在 `invoke` 的 error wrapper 内

### D6: 平台门控 = `osName === 'ohos'`

core.js 已有 `__TEMPLATE_os_name__` 模板变量(编译期注入)。与 `ipc-protocol.js:20` 的 postMessage 模式名单(`android/ohos`)同构但**收紧为仅 ohos**(用户裁定 2026-10-19)。桌面/Android 产物中中继代码为死分支,行为字节级不变。注释互相引用两处名单,注明"扩至 android 可惠及上游,留作上游 PR"。

### D7: 主 frame 判定 = `window.top === window`

OHOS 多 webview 场景下每个 webview 的主 frame 都满足 `window.top === window`(frame 树以 webview 为根),互不串扰;isolation iframe(`__tauri_isolation__`)是子 frame,走接收端分支,其内部回调(若直接使用 internals)顺带被修复,主 frame 代理路径不受影响。

## Risks / Trade-offs

- [随机 id 跨 frame 撞号(~n²/2³²),响应被主 frame 先执行] → 与现状行为完全一致(eval 本就只进主 frame,主 frame hit 即执行),非新增风险;design/specs 如实披露,不做 id 分段(复杂度不值当)
- [postMessage 转发时序晚于 eval 直达] → 子 frame 回调本就从不送达,不存在"变慢"回归;同 frame 间消息保序
- [广播放大:miss 时向 N 个直接子 frame 各发一条] → miss 只发生于子 frame 回调场景(低频);N 为当前 frame 直接子 frame 数,典型 ≤ 个位数;嵌套深度典型 1-2
- [`window.frames`/`postMessage` 在 ArkWeb 的边缘兼容性] → postMessage 双向已被红灯用例实证;`window.frames` 是标准 DOM API,且红灯用例的 iframe 为动态 `appendChild` 插入,转发必经 `window.frames` 路径——用例转绿即验收该 API;若真机出现兼容问题,退路为遍历 `document.querySelectorAll('iframe')` 取 `contentWindow`(等价语义,实现期可一键切换)
- [跨源 frame 保持丢失] → 显式 Non-Goal;安全边界优先(targetOrigin 投递);业务(同源 iframe)场景已覆盖
- [多 webview / 多窗口] → 广播以 frame 树为界(window 内),不跨 webview、不跨窗口;`window.top === window` 判定天然隔离

## Migration Plan

- 部署:core.js 随 tauri crate 编译进 init script → 重建 examples/api HAP 即生效(标准 ohos-build 流程);无数据/配置迁移
- 验证:红灯用例转绿 → 全量套件(desktop)回归比对基线(307✅/1❌ → 308✅/0❌,skip 数不变)→ 主 frame 常规用例(ipc/event/channel 相关既有用例)无回归
- 回滚:revert core.js 单文件提交,重建即回退;无持久化状态

## Open Questions

(无——实现期唯一自由度是 D4 的 warn 文案与 `window.frames` 退路选择,均不改变 specs/approach/tasks)

## Phase B Addendum(2026-10-19):probe 改走真实 invoke 路径

Phase A/B 三轮仪器化(commit 128bee8d3/250c01f32/a6a3a22c3)后,中继本体(ab53e6479)被证端到端工作且传输完备;唯一红灯归因于 **probe 自身设计缺陷**——红灯 probe 在 isolation 应用里手搓裸 IPC 路径。本节修订 probe/测试设计,不改变 D1-D7(产品侧中继)任何决策。

### 错误前提与修正

原 probe 头注释假设「isolation layer only the main document sets up」,据此手搓 `transformCallback + __TAURI_INTERNALS__.postMessage` 裸路径。两轮证据推翻:

1. **isolation 机器每帧完整装配**:`crates/tauri/scripts/isolation.js` 在每个非 isolation-src frame 的 `DOMContentLoaded` 挂自己的 sandboxed(allow-scripts → opaque origin)`__tauri_isolation__` iframe;设备证据 = ghost 流全链(child 内排队 → t=490 child 的 isolation READY → AES-GCM flush → 响应回流)在 diag blob 中可见,parentEnv `tauriPattern: "isolation"` 同证。
2. **Rust 侧按设计拒收裸 payload**:`crates/tauri/src/ipc/protocol.rs` `handle_ipc_message` 在 `Pattern::Isolation` 下将 `window.ipc.postMessage` body 强制反序列化为 `IsolationMessage`(payload 须为 `RawIsolationPayload{nonce,payload,contentType}`);裸 payload 反序列化失败(missing field `nonce`)进 `Err` 分支,仅 eval `console.error` 到主 frame,callback/error 均不 eval。设备铁证:两轮套件 hilog 均捕获 3 条 `JSON error: missing field \`nonce\``(child echo + child MISSING_CMD + grandchild echo 三个裸 payload),且 probe 注册的 4 个 id 零 miss 警告。这是 isolation pattern 的安全语义(裸 IPC 不得绕过加密层),非缺陷。

### Phase B 修订内容

- `examples/api/public/iframe-ipc-child.js` 的 `invokeFromIframe` 改为 `window.__TAURI_INTERNALS__.invoke(cmd, args)`(@tauri-apps/api `invoke()` 的委托目标;pattern 无关——brownfield 走裸 postMessage,isolation 走每帧 isolation iframe,两者响应都经主 frame eval → 中继回流)。返回形态(`{settled,result}` / `{settled,error}` / `{settled:false,phase:'timeout'}` / try-catch `{settled:true,thrown}`)与 6s 超时 + `settledAt` 晚到捕获语义不变;core.ts 断言本体零改动(数据形态链已核:对象 payload → `application/json` → Rust Json body → echo 回 Json → 小 payload 直 eval 对象字面量 → `result.message` 可断言)。
- 诊断字段:`registeredIds`/`registeredByProbe` 转 vestigial(真实 invoke 内部注册 id,probe 不可观测,恒空/恒 false,注释说明);`echoPending`/`errorPending` 转为真实 invoke 的 settle 驱动活跃标志;`matrix`/`relayArrivals`/`isolationCallbackIds`/`messageLog`/`runReceivedAt` 观测链保留。
- 新增 ghost-caller 归因观测:`transformCallback`/`invoke`/`postMessage` 均被 core.js 以 non-writable defineProperty 封死,不可包装;改以 `Map.prototype.set` 只读 shim 记录进入本 frame callback Map 的注册栈(原始 set 恒执行、返回值恒保留,零行为变更),`ghostRegistrations` 进 diag。ghost 注册若早于 probe 脚本 eval 则列表为空,本身即归因证据(定位到 document-start init 期)。

### 断点定论(Phase B 起点)

- S1(opaque origin 对投递跳排除)✅ 维持——中继实测工作(主 frame miss 后 1ms 到达 child,child 本地 map 命中执行)。
- S2(isolation 沙盒)改写定论:不是链路某跳死,而是 isolation 机器在 child frame 内也完整运转(每帧自己的 sandboxed iframe),且 Rust 侧按设计拒收绕过加密层的裸 payload。
- S3(event.origin 怪象)非主要矛盾,维持不追。
- 终局:P3 中继修复(ab53e6479)端到端工作且传输完备;剩余红灯 = probe 设计缺陷,Phase B 修 probe 而非产品代码。
