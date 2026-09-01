# Phase 4 设计 — 华为账号登录 前端测试 + typed JS 包集成

> 基线:p1(桥接)+ p2(插件)+ p3(设备集成,2026-08-03 实测全通过)已完成。本 Phase 纯前端 + JS 包,不动 Rust。

## D1:typed JS 包构建策略 — 首次手动构建,不依赖 build-ohos.sh Step 2.5

**选择**:首次集成手动执行 `cd plugins-workspace/plugins/huawei-account && pnpm build` 产 `dist-js/`,再 `cd examples/api && pnpm install` 把含 dist-js 的目录复制进 `.pnpm` 虚拟仓库。

**理由**:`build-ohos.sh` Step 1(install)在 Step 2.5(build)之前;pnpm `file:` 依赖会把源目录**复制**进 `.pnpm/.../node_modules/@tauri-apps/plugin-huawei-account`(真实副本,非 symlink),`examples/api/node_modules` 再 symlink 到该副本。首次集成时若 install 前未构建,复制的目录无 dist-js,Step 2.5 后构建的 dist-js 不会进入 .pnpm 副本 → vite 解析 `import` 失败。必须先 build 再 install。

**后续维护**:`guest-js/index.ts` 改动后,需重跑 `cd examples/api && pnpm install` 刷新 .pnpm 副本(.pnpm 副本是复制不是 symlink,源 dist-js 改动不自动反映)。`build-ohos.sh` Step 2.5 的 root `pnpm build` 会重建 dist-js(幂等),但不刷新 .pnpm 副本。

## D2:silentLogin 改 auto,error-shape 联合断言(不依赖 platform 分支)

**选择**:
```
try { info = await silentLogin(); assert(AccountInfo 形状: openId/unionId/authorizationCode 是 string) }
catch (e) { assert(String(e) ∈ {"unsupported","not-logged-in"}) }
```

**理由**:silentLogin 的错误集合跨平台确定——desktop 永远 "unsupported"、OHOS 未登录 "not-logged-in"、OHOS 已登录成功(p3 D6 实测;silentLogin 无 UI 不产生 cancelled)。联合断言三种路径都通过,任何意外错误(cancelled/other)正确 fail。不引入 plugin-os 的 platform 分支(增加耦合非必要)。

**否决 login 改 auto**:login 在 OHOS 未登录时拉起交互 UI 面板(p3 D6),auto 超时(5000ms)必 fail。

## D3:login 保持 manual,纯文档化(对齐 deep-link 模式)

**选择**:login manual 的 `fn()` 改纯 `console.log`(说明预期行为 + 如何验证),去掉 invoke/assert/catch。

**理由**:manual 用例 `fn()` 被 test-runner skip(test-runner.ts:74-85,从不执行);TestRunner.svelte 按钮(TestRunner.svelte:211-245)才是实际手动测试入口。deep-link manual 用例(plugins.ts:990-997)已是纯 console.log 模式,对齐一致。现有 silentLogin manual 用例转为 auto 后删除(冗余)。

## D4:TestRunner.svelte 按钮改 typed import

**选择**:3 个按钮(manualHuaweiLogin/SilentLogin/Logout)从 `invoke('plugin:huawei-account|xxx')` 改为 `import { login, silentLogin, logout } from '@tauri-apps/plugin-huawei-account'` 后调用。保留 try/catch(UI 需 catch 显示错误给用户,这是 UI 行为非测试断言)。

**理由**:与 plugins.ts 约定一致(所有其他插件用 typed import);typed import 给出 AccountInfo 类型提示(IDE 补全 + 编译期检查);import 失败能尽早暴露 dist-js 缺失(而非 invoke 时报 command not found)。

## D5:logout side-effect 补 error-shape 断言

**选择**:
```
try { await logout(); }  // OHOS 已登录:成功(void)
catch (e) { assert(String(e) ∈ {"unsupported","not-logged-in"}) }
```

**理由**:logout 当前无 assert(plugins.ts:1035-1046 空壳)。side-effect 自动跑,需真断言。断言集合:desktop="unsupported";OHOS 已登录=成功(void);OHOS **未登录="not-logged-in"**(设备实测发现:未登录时 `createCancelAuthorizationRequest` 抛 1001502001,无账号可取消授权,合理行为非失败)。联合断言跨登录状态都 pass,与 silentLogin(D2)一致。若抛其他错误(cancelled/other)assert fail 正确暴露异常。

## D6:不动 Rust / desktop stub / error 分类

**选择**:Phase 4 纯前端 + JS 包,不改 `commands.rs`/`error.rs`/`ohos.rs`/Cargo.toml。

**理由**:desktop stub 返回 `Unsupported` 是设计意图(Cargo.toml platforms.support 标注 windows/linux/macos level="none");p3 D5 已 runtime 验证降级;error 分类 p3 D3 已补全 Cancelled。无差距需对齐。

## Risks / Trade-offs

- **[.pnpm 副本过期]** → guest-js/index.ts 改动后只 `pnpm build` 不 `pnpm install` → vite 用旧 dist-js。D1 明确记录刷新步骤。
- **[测试顺序]** → logout 改变授权状态,确保 silentLogin auto 在 logout side-effect 之前(plugins.ts 数组顺序)。p3 D6 实测:logout 后系统账号仍登录时 silentLogin 仍成功(Account Kit 自动重授权),但顺序仍应保证 silentLogin 先。
- **[dist-js 构建失败]** → `plugins-workspace/node_modules` 已有 rollup/typescript/@rollup/plugin-typescript(已核实),预期可直接 `pnpm build`。若报 "Cannot find module",先 `cd plugins-workspace && pnpm install`。
