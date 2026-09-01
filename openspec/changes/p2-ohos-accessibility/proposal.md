# Proposal: p2-ohos-accessibility

## What

在 plugins-workspace 新建 OHOS 专属插件 `tauri-plugin-accessibility`,把 Phase 1a 完成的 openharmony-ability 无障碍 bridge 层(AccessibilityPlugin / `openharmony-ability-plugin-accessibility`)暴露为 Tauri 插件 JS API:

- `getFontScale(): Promise<number>` — 系统字号缩放(零权限)
- `isScreenReaderEnabled(): Promise<boolean>` — 屏幕阅读器开关状态
- `isTouchExploreEnabled(): Promise<boolean>` — 触摸浏览(触摸引导)状态
- `onAccessibilityStateChange(handler): Promise<UnlistenFn>` — 屏幕阅读器状态变化事件

并接入 examples/api(demo + 测试用例)完成真机验证;同步修订 `ohos-platform-limitations` spec 的 R230 边界声明。

## Why

- R230 此前判定"无障碍暂不实现";Phase 1a 已打通 bridge 层(fontScale 零权限确定可做,screen-reader 查询/事件待真机实测),插件层是 JS API 形态的最后一公里。
- 参照 huawei-account 先例(OHOS 专属新插件、其他平台 stub 返回 Unsupported),无上游跨平台契约需对齐。

## What Changes

- **新增** `plugins-workspace/plugins/accessibility/`(crate tauri-plugin-accessibility:Cargo.toml/build.rs/lib.rs/commands.rs/ohos.rs/error.rs/permissions/guest-js/rollup/tsconfig/package.json,~13 文件)
- **接入** `tauri/examples/api/src-tauri/Cargo.toml`(OHOS target 依赖)+ `src/lib.rs` OHOS 块 `.plugin(...)` + `capabilities/ohos-plugins.json` 加 `accessibility:default`
- **前端** examples/api 测试用例(plugins.ts:auto 类 fontScale/touch-explore + manual 类 screen-reader 事件)+ demo 按钮(可选,manual 用例经 console 指引)
- **spec 修订** `openspec/specs/ohos-platform-limitations/spec.md` R230 从"SHALL NOT 提供无障碍 API"改为指向本插件的最小 API 边界声明

## Impact / Affected Specs

- `ohos-platform-limitations`(R230 修订)
- 新 spec:`ohos-accessibility-plugin`
- 不影响其他平台:插件 crate 非 OHOS 平台编译为 Unsupported stub(huawei-account 模式),examples/api 依赖声明在 `[target.'cfg(target_env = "ohos")'.dependencies]`
