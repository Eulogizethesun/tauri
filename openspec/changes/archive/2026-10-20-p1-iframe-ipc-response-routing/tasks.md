# Tasks

## 1. core.js 中继实现(单文件 `crates/tauri/scripts/core.js`)

- [x] 1.1 主 frame 端:`osName === 'ohos'` 且 `window.top === window` 时,`runCallback` 本地 Map miss 分支在现有 `console.warn` 后向 `window.frames` 各直接子 frame 广播 `{ __TAURI_FRAME_CALLBACK__: true, id, data }`,`targetOrigin = window.location.origin`,每次 postMessage 独立 `try/catch`(已销毁 frame 不中断广播);其余平台/主 frame hit 路径零改动。验证:代码对照 design D2/D3/D6 review;非 ohos 平台该分支为死分支(模板 `__TEMPLATE_os_name__` 门控)
- [x] 1.2 子 frame 端:OHOS 门控下挂 `message` 监听,校验 `event.origin === window.location.origin` 且 `event.source === window.parent`;通过后以本地 `runCallback(id, event.data.data)` 执行(与 eval 直达同路径,once 语义保持);本地 miss 且 `window.frames.length > 0` 时向子 frame 链式转发;本地 miss 且无子 frame 时走 warn(forwarded 语境)。验证:代码对照 design D4/D5 review

## 2. 测试扩展(examples/api,红灯用例已就位)

- [x] 2.1 `public/iframe-ipc-child.js` probe 增加错误路径:hand-roll invoke 一个返回 Err 的命令,记录 reject settle 形态。验证:probe 返回 `invokeError` 字段
- [x] 2.2 嵌套场景:`iframe-ipc-child.html` 内嵌同源孙 iframe(复用同一 probe 页),孙 frame invoke 结果经两级 postMessage 上报。验证:probe 返回 `grandchildInvoke` 字段
- [x] 2.3 伪造消息防护:child 监听器收到不满足校验(source ≠ parent)的 `__TAURI_FRAME_CALLBACK__` 消息时忽略并记录。验证:probe 返回 `forgedIgnored === true`
- [x] 2.4 `src/lib/tests/core.ts` 用例断言扩展:`invokeError` settled 且 reject、`grandchildInvoke` settled、`forgedIgnored` true;`pnpm build` 编译通过。验证:前端构建无 TS 错误

## 3. 真机验证与回归(ohos-build run-tests.sh desktop)

- [x] 3.1 全量套件:iframe IPC 用例(含新断言)转绿,总结果相对基线 307✅/1❌ 无新增失败(skip 数不变)。验证:examples/api test-report.md
- [x] 3.2 主 frame 回归:既有 IPC/事件/Channel 相关用例(core.event、core.invoke、Channel 组)全部保持绿。验证:test-report.md 分组核对

## Workflow follow-up

- 实现使用 tauri-ohos-apply Skill(用户指定流程)
- 实现完成后 `openspec validate p1-iframe-ipc-response-routing --strict` 通过
- 消费仓(zhkt60,基于 ohdev-git 分支)同步:本修复位于 tauri crate init script,不涉 openharmony-ability HAR;消费仓升级路径与 HAR webview 路径删除(694cce82)问题独立评估
- 归档按项目复核流程(对方复核收敛规则)

## Phase B addendum(2026-10-19)

- 上列 2.1-2.4 的勾选状态维持不变(红灯 probe 已交付并仪器化三轮);Phase B 将 `iframe-ipc-child.js` 的 `invokeFromIframe` 由手搓裸 postMessage 路径改为真实 `__TAURI_INTERNALS__.invoke` 路径——isolation pattern 按设计拒收裸 payload(protocol.rs `handle_ipc_message`,设备 hilog 铁证 `missing field \`nonce\``),core.ts 断言本体零改动,依据与证据链见 design.md「Phase B Addendum」。3.1/3.2 按 Phase B 修复后的全量真机结果收口。
