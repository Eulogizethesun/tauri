# Proposal: p1-ohos-accessibility

## Why

OHOS 适配兼容性表 R230 将无障碍标记为"不支持";Tauri 应用在 OHOS 上无法感知系统字号缩放与读屏状态,前端无法做响应式字号适配。调研确认存在零权限可用的最小 API 子集(`Configuration.fontScale`),且 Web 内容无障碍已由 ArkWeb 内置 ARIA 覆盖,缺的只是状态查询通道。

## What Changes

- openharmony-ability 新增第 16 个桥接插件 `accessibility`(ArkTS `AccessibilityPlugin`,id=`ohos.accessibility`)+ Rust facade crate `plugin-accessibility`
- 提供 4 个 action:`get-font-scale`(零权限)、`is-open-accessibility`、`is-touch-explore-enabled`(系统权限风险,ArkTS 侧捕获权限错误结构化返回)、`subscribe-state-change`(emit 事件模式)
- EntryAbility.ets.hbs 模板(desktop+mobile)注册新插件
- 本 Phase 仅 bridge 层;plugins-workspace 插件与 demo 集成归 p2-ohos-accessibility

## Capabilities

### New Capabilities
- `ohos-accessibility-bridge`: openharmony-ability 无障碍状态查询桥接能力(fontScale/读屏状态/触摸探索/状态变化事件)

### Modified Capabilities
- `ohos-platform-limitations`: R230 无障碍从"SHALL NOT 提供无障碍 API"降级边界修订为"提供最小状态查询 API;Web 内容无障碍仍由 ArkWeb ARIA 承担"(spec 级行为变化,需 delta spec,归 p2 阶段落地时一并提交)

## Impact

- 新增文件:plugins/accessibility/ 5 文件 + crates/plugin-accessibility/ 2 文件
- 修改:pack-plugins.ps1(插件表 15→16)、tauri-cli 模板 entry_desktop/entry_mobile EntryAbility.ets.hbs(改模板须重装 tauri-cli)
- 无破坏性变更;不影响其他平台(纯新增 + 模板追加)
- 依赖:@ohos.accessibility(API 9+)、@ohos.app.ability.Configuration.fontScale(API 9+),均在项目 API 12 基线内
