## 1. typed JS 包构建

- [x] 1.1 验证 `plugins-workspace/node_modules` 存在(rollup/typescript/@rollup/plugin-typescript)— 已核实,若 `pnpm build` 报错则 `cd plugins-workspace && pnpm install`
- [x] 1.2 构建插件 dist-js:`cd D:/ohdev/plugins-workspace/plugins/huawei-account && pnpm build`(产 `dist-js/index.js`、`index.cjs`、`index.d.ts`、`api-iife.js`)
- [x] 1.3 验证 `dist-js/index.d.ts` 导出 `AccountInfo` interface + `login`/`silentLogin`/`logout` 函数(对比 `guest-js/index.ts:15-40`)

## 2. examples/api 依赖集成

- [x] 2.1 `examples/api/package.json` line 26 后加 `"@tauri-apps/plugin-huawei-account": "file:../../../plugins-workspace/plugins/huawei-account"`
- [x] 2.2 `cd D:/ohdev/tauri/examples/api && pnpm install`(复制含 dist-js 的目录进 .pnpm)
- [x] 2.3 验证 `examples/api/node_modules/@tauri-apps/plugin-huawei-account/dist-js/index.js` 存在
- [x] 2.4 验证 `cd examples/api && pnpm build`(vite)能解析 `import { login } from '@tauri-apps/plugin-huawei-account'`(无解析错误)

## 3. 前端测试改造(plugins.ts)

- [x] 3.1 删除现有 3 个空壳用例(`plugins.ts:999-1046`:login manual / silentLogin manual / logout side-effect)
- [x] 3.2 新增 silentLogin **auto** 用例(typed import + 联合 error-shape 断言,见 design D2)
- [x] 3.3 新增 logout **side-effect** 用例(typed import + error-shape 断言,见 design D5)
- [x] 3.4 新增 login **manual** 用例(纯 console.log 文档化,见 design D3)
- [x] 3.5 验证 plugins.ts 无 TypeScript 编译错误(`pnpm build`)

## 4. TestRunner.svelte 按钮改造

- [x] 4.1 3 个按钮(manualHuaweiLogin/SilentLogin/Logout,`TestRunner.svelte:211-245`)从裸 `invoke()` 改为 typed import
- [x] 4.2 保留 try/catch(UI 显示错误),调用改为 `login()`/`silentLogin()`/`logout()`
- [x] 4.3 验证 TestRunner.svelte 无编译错误

## 5. 验证

- [x] 5.1 host:`cargo test -p tauri-plugin-huawei-account`(5 UT 无回归)
- [x] 5.2 host:`cd examples/api && pnpm build`(vite typed import 解析成功)
- [x] 5.3 OHOS:`run-tests.sh "" desktop` → BUILD SUCCESSFUL → 安装启动
- [x] 5.4 OHOS 自动测试:silentLogin auto ✅(已登录→AccountInfo 形状 / 未登录→"not-logged-in")+ logout side-effect ✅
- [x] 5.5 OHOS 手动:TestRunner 按钮 login/silentLogin/logout typed import 调用正常(2026-08-03 设备实测:已登录 login/silentLogin 返回 AccountInfo、logout OK;未登录 login 拉起面板、silentLogin/logout 返回 not-logged-in;typed import 全正常)
- [x] 5.6 确认无回归:原有 243 pass 基线不变(新增 auto/side-effect 用例 pass,不引入新 fail;现 244 pass/2 fail,2 失败为预存 Resumed 等)
- [ ] 5.7 desktop(可选):`cargo tauri dev` → silentLogin auto catch "unsupported" pass / logout side-effect catch "unsupported" pass(examples/api Windows host build.rs 缺 deep-link:default ACL,低风险遗留,后置)

## 6. openspec 产物

- [x] 6.1 创建 `openspec/changes/p4_huawei-account/` 目录结构
- [x] 6.2 填写 .openspec.yaml / proposal.md / design.md / tasks.md / specs/huawei-account/spec.md
- [x] 6.3 openspec validate p4_huawei-account(若 CLI 可用)
