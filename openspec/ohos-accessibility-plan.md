# OHOS 无障碍(accessibility)最小 API 适配计划

**创建时间**:2026-08-27
**功能描述**:为 Tauri OHOS 适配提供无障碍最小 API——`fontScale` 字号缩放查询(零权限)、`isScreenReaderEnabled`/无障碍状态变化事件(系统权限,真机实测失败则降级)。Web 内容无障碍由 ArkWeb 内置 ARIA 支持,不在本计划范围。
**判断依据**:涉及 3 个代码层(openharmony-ability / plugins-workspace / examples),预估 ~23 文件
**JS API 形态**:完整 plugins-workspace 插件(参照 huawei-account 先例,OHOS 专属新插件)

## 背景(2026-08-27 调研结论)

- `Configuration.fontScale`:`UIAbilityContext.config.fontScale`,零权限,确定可做
- `@ohos.accessibility`:`isOpenAccessibility()` / `on('accessibilityStateChange')`,权限 `ohos.permission.ACCESSIBILITY`(系统级,三方只读查询能否调通**待真机验证**)
- `AccessibilityExtensionAbility`(无障碍服务提供方):三方不可注册,不做
- Tauri 上游无无障碍 API,无跨平台契约要对齐
- 需同步更新 `ohos-platform-limitations` spec:R230 从"SHALL NOT"改为本计划的边界声明

## Phase 列表

| Phase | 名称 | openspec change | 状态 | 涉及层 | 预估文件 | 验证方式 |
|-------|------|----------------|------|--------|---------|---------|
| 1a | 无障碍 bridge 层 | p1-ohos-accessibility | ✓ 已实现 | openharmony-ability | 9 | cargo check 双侧 0 error + HAR 含 AccessibilityPlugin |
| 2a | 无障碍插件+集成验证 | p2-ohos-accessibility | ✓ 已实现 | plugins-workspace + examples | 14 | 真机:fontScale ✅ + 查询无权限拒绝实锤 + 订阅 Observer has subscribed |

## Phase 详细说明

### Phase 1a: 无障碍 bridge 层
- **目标**:openharmony-ability 新增 `plugins/accessibility/`(ArkTS AccessibilityPlugin,id="ohos.accessibility")+ `crates/plugin-accessibility/`(Rust facade),actions:`get-font-scale` / `is-open-accessibility` / `is-touch-explore-enabled` / `subscribe-state-change`(emit 事件模式)。pack-plugins.ps1 15→16。EntryAbility.ets.hbs 模板(desktop+mobile)加 import+LazyPlugin。
- **文件列表**:plugins/accessibility/{oh-package.json5, index.ets, build-profile.json5, src/main/module.json5, src/main/ets/AccessibilityPlugin.ets};crates/plugin-accessibility/{Cargo.toml, src/lib.rs};pack-plugins.ps1;templates/mobile/open-harmony/entry_{desktop,mobile}/.../EntryAbility.ets.hbs
- **依赖**:无

### Phase 2a: 无障碍插件+集成验证
- **目标**:plugins-workspace 新建 `tauri-plugin-accessibility`(OHOS 专属,形态 2):commands(get_font_scale/is_screen_reader_enabled/on_state_change 事件)→ guest-js API → 权限文件 → dist-js 构建;examples/api 接入(Cargo path 依赖 + demo 页 + core/plugins.ts 测试用例);真机验证 fontScale、权限行为(ACCESSIBILITY 拒绝则 API 返回明确错误码)、事件;更新 ohos-platform-limitations spec。
- **文件列表**:plugins-workspace/plugins/accessibility/{Cargo.toml, src/lib.rs, src/commands.rs, src/ohos.rs, permissions/default.toml, guest-js/index.ts, guest-js/package.json, build.rs 等 ~10};examples/api/src-tauri/Cargo.toml;demo 页/测试 ~3;ohos-platform-limitations spec 修订
- **依赖**:Phase 1a 完成
