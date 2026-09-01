## Purpose

前端测试 + typed JS 包集成层:把 p3 的"manual/side-effect 裸 invoke"测试入口升级为"typed JS 包导入 + auto error-shape 断言",使华为账号登录的测试覆盖达到与其他插件(os/fs/dialog 等)一致的标准。不改插件 Rust 公共 API / AccountInfo / error 分类。

## MODIFIED Requirements

### Requirement: 前端测试入口

examples/api SHALL 经 typed JS 包(`@tauri-apps/plugin-huawei-account`)导入调用 `login`/`silentLogin`/`logout`(非裸 `invoke`),与其他插件约定一致。`silentLogin` SHALL 有 **auto** 用例做跨平台 error-shape 断言;`logout` SHALL 有 **side-effect** 用例断言;`login` SHALL 保持 **manual**(可能拉起 UI)。TestRunner.svelte 手动按钮 SHALL 使用 typed 导入。

> p3 版本升级:从"manual/side-effect 裸 invoke"→"typed import + auto error-shape 断言"。

#### Scenario: typed JS 包可用

- **WHEN** examples/api vite build 时 `import { silentLogin } from '@tauri-apps/plugin-huawei-account'`
- **THEN** 解析成功(插件 dist-js 已构建并经 file: 依赖集成),不报 "Cannot resolve"

#### Scenario: silentLogin auto 跨平台通过

- **WHEN** 在 auto 测试模式运行 silentLogin 用例
- **THEN** desktop → catch "unsupported" → assert pass;OHOS 已登录 → 返回 AccountInfo(openId/unionId/authorizationCode 非空)→ assert pass;OHOS 未登录 → catch "not-logged-in" → assert pass

#### Scenario: logout side-effect 跨平台通过

- **WHEN** 在 side-effect 测试模式运行 logout 用例
- **THEN** desktop → catch "unsupported" → assert pass;OHOS 已登录 → 成功(void)→ pass;OHOS 未登录 → catch "not-logged-in" → assert pass(无账号可取消授权,合理)

#### Scenario: login manual 文档化

- **WHEN** TestRunner 运行 manual 用例
- **THEN** login 用例被 skip(test-runner 自动跳过 manual),实际手动测试经 TestRunner.svelte 按钮触发(typed import 调用)

#### Scenario: 意外错误正确暴露

- **WHEN** silentLogin/logout 返回非预期错误(如 cancelled / other:...)
- **THEN** assert fail(测试失败),正确暴露异常而非假 pass

## ADDED Requirements

### Requirement: typed JS 包构建

插件 SHALL 经 `pnpm build`(rollup,shared/rollup.config.js)产出 `dist-js/`(ESM `index.js` + CJS `index.cjs` + 类型声明 `index.d.ts` + IIFE `api-iife.js`),供 examples/api file: 依赖集成。`guest-js/index.ts` 改动后 SHALL 重跑 `examples/api && pnpm install` 刷新 .pnpm 副本。

#### Scenario: dist-js 构建产物

- **WHEN** `cd plugins-workspace/plugins/huawei-account && pnpm build`
- **THEN** 产出 `dist-js/index.js`、`dist-js/index.cjs`、`dist-js/index.d.ts`(导出 AccountInfo interface + login/silentLogin/logout)
