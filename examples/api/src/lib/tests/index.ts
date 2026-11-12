// Test-array barrel（23 数组：17 std + 6 cov）。
//
// 目的：给 TestRunner.svelte / App.svelte 一个单一 import 面，并让 scripts/sow-check.mjs
// 能 headless bundle+求值全部数组做账目核对。cov 的运行时门控（VITE_COVERAGE_TESTS）
// 保持在消费方（TestRunner.svelte），barrel 无条件导出原始数组——门控语义与既有行为一致。
// SOW 注册表（sow-registry.ts 及其分片）不经此 barrel：那是账本不是用例。
export { coreTests } from './core';
export { pluginTests } from './plugins';
export { dpiTests } from './dpi';
export { windowDpiTests } from './window-dpi';
export { imageTests } from './image';
export { menuTests } from './menu';
export { trayTests } from './tray';
export { ohosAdapterTests } from './ohos-adapter';
export { ohosInitTests } from './ohos-init';
export { ohosGapTests } from './ohos-gap';
export { ohosMobilePluginTests } from './ohos-mobile-plugins';
export { ohosScreenshotTests } from './ohos-screenshot';
export { ohosContinuationTests } from './ohos-continuation';
export { windowOpsTests } from './window-ops';
export { riskSupplementTests } from './risk-supplement';
export { strongholdTests } from './stronghold';
export { zombieCloseTests } from './zombie-close';
export { driverTests, sideReplayTests, badInputTests } from './driver-generated';
export { faultInjectionTests } from './fault-injection-generated';
export { windowOpsExtraTests } from './window-ops-extra';
export { apiGapTests } from './api-gap';
