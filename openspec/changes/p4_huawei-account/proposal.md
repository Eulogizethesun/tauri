## Why

> **Revised 2026-08-06(D7-revised)**:本 Phase 原"examples/api 前端测试 + typed JS 集成"改动已随 D7-revised 全部回退(examples/api 不再集成 huawei-account)。typed JS 包(`dist-js/`)构建成果保留(插件层不变);前端测试用例 + TestRunner 按钮代码搬到新应用 `examples/huawei-account/`(最小应用,无 TestRunner/auto 框架,3 按钮直接调 typed import)。下方"What Changes"保留原文(历史决策),实际实现见 examples/huawei-account/。

Phase 3 设备实测全通过(login/silentLogin/logout/cancel/未登录降级),但前端测试层是**空壳**:`plugins.ts:999-1046` 的 3 个用例 try/catch 吞错——login/silentLogin 的 assert 永不触发、logout 无 assert。且 typed JS 包未构建未集成:`examples/api/package.json` 列了 12 个插件 file: 依赖唯独缺 `huawei-account`;测试用裸 `invoke()` 违背 plugins.ts 约定(其他插件都用 `import`)。Phase 4 收尾前端测试 + typed JS 包集成,使华为账号登录的测试覆盖达到与其他插件一致的标准。

## What Changes

- **typed JS 包构建与集成**:构建插件 `dist-js`(`pnpm build` 产 ESM/CJS/`.d.ts`/IIFE),`examples/api/package.json` 加 `@tauri-apps/plugin-huawei-account` file: 依赖。
- **plugins.ts 测试改造**:
  - `silentLogin` 从 manual 改 **auto**(typed import + 联合 error-shape 断言:成功→AccountInfo 形状;失败→error ∈ {"unsupported","not-logged-in"},跨平台确定性)
  - `logout` side-effect **补 assert**(成功或 catch "unsupported")
  - `login` 保持 manual 但**纯文档化**(对齐 deep-link 模式,去掉吞错 catch / invoke / assert)
- **TestRunner.svelte 按钮改造**:3 个手动按钮(login/silentLogin/logout)从裸 `invoke()` 改为 typed import。
- 本 Phase **不含**:desktop stub 行为审计/修改(p3 D5 已验证返回 Unsupported 是设计意图)、Windows host runtime 验证(p2 7.4 低风险遗留)。

## Capabilities

### Modified Capabilities
- `huawei-account`(p3 归档):前端测试入口从"manual/side-effect 裸 invoke"升级为"typed JS 包导入 + auto error-shape 断言"。插件 Rust 公共 API、AccountInfo 结构、error 分类均不变。

## Impact

- **代码**:`examples/api/package.json`(改)、`examples/api/src/lib/tests/plugins.ts`(改)、`examples/api/src/views/TestRunner.svelte`(改);`plugins-workspace/plugins/huawei-account/dist-js/`(构建产物,gitignore)。
- **依赖**:examples/api 前端新增 `@tauri-apps/plugin-huawei-account`(file: 依赖)。
- **API**:不改变插件公共 API / AccountInfo / error 分类。
- **平台隔离**:typed JS 包跨平台(ESM/CJS);auto 用例 error-shape 断言覆盖 desktop(unsupported)/OHOS(成功或 not-logged-in)。
- **关联**:依赖 p1(bridge)+ p2(插件)+ p3(设备集成,已验证)完成。
