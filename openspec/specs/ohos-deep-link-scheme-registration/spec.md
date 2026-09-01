# ohos-deep-link-scheme-registration Specification

## Purpose
TBD - created by archiving change p2-deep-link. Update Purpose after archive.
## Requirements
### Requirement: update_ohos_module_json 注入 API
`tauri-plugin` SHALL 提供 `mobile::update_ohos_module_json(skills: serde_json::Value)` 函数。该函数 SHALL 读 `TAURI_OHOS_PROJECT_PATH` 环境变量自门控（未设则 no-op 返回 `Ok(())`）；定位 `{project_path}/entry_{OHOS_DEVICE_TYPE}/src/main/module.json5`；用 json5 parse → mutate → serialize 写回。skill 对象 SHALL 追加到 `module.abilities[0].skills` 数组。

#### Scenario: OHOS 构建时注入 skills
- **WHEN** OHOS 构建，`TAURI_OHOS_PROJECT_PATH` 已设，deep-link `config.mobile` 含 `AssociatedDomain{scheme:["myapp"]}`
- **THEN** `entry_mobile/src/main/module.json5` 的 `abilities[0].skills` SHALL 追加含 `uris:[{scheme:"myapp"}]` 的独立 skill 对象

#### Scenario: 非 OHOS 构建 no-op
- **WHEN** `TAURI_OHOS_PROJECT_PATH` 未设置（非 OHOS 构建）
- **THEN** `update_ohos_module_json` SHALL no-op，不修改任何文件，返回 `Ok(())`

### Requirement: 幂等性——重复构建不累积
重复构建时，`update_ohos_module_json` SHALL 先移除 `abilities[0].skills` 中已有的 deep-link skill（按 `actions` 含 `ohos.want.action.viewData` 且 `entities` 含 `entity.system.browsable` 签名匹配），再按 config 重新注入，不得累积重复 skill 对象。

#### Scenario: 重复构建不累积
- **WHEN** 连续两次 OHOS 构建，`config.mobile` 不变
- **THEN** `module.json5` 的 `skills` 数组 SHALL 只含一份 deep-link skill 对象，不重复

#### Scenario: 配置变更后重新注入
- **WHEN** 第一次构建注入 `scheme:["myapp"]`，第二次构建 `config.mobile` 改为 `scheme:["myapp2"]`
- **THEN** 第二次构建后 SHALL 只含 `scheme:"myapp2"` 的 skill，旧的 `scheme:"myapp"` 被移除

### Requirement: home 入口 skill 不被破坏
注入 SHALL 追加独立 skill 对象到 `abilities[0].skills` 末尾，不修改现有 home 入口 skill（`entities:["entity.system.home"]`、`actions:["action.system.home"]`）。

#### Scenario: home skill 保留
- **WHEN** 注入 deep-link skills
- **THEN** home 入口 skill SHALL 保持不变（`entities:["entity.system.home"]`、`actions:["action.system.home"]`），deep-link skill 为独立新增对象

### Requirement: AssociatedDomain→OHOS skill 字段映射
deep-link `build.rs` SHALL 把 `config.mobile` 的每个 `AssociatedDomain` 映射为一个 OHOS skill 对象：`scheme`→`uris[].scheme`（多 scheme 生成多个 uris 对象）、`host`→`uris[].host`、`path`→`uris[].path`、`path_pattern`→`uris[].pathRegex`、`path_prefix`→`uris[].pathStartWith`、`path_suffix`丢弃（OHOS 无对应）、`app_link=true`→`domainVerify:true`；固定 `entities:["entity.system.browsable"]`、`actions:["ohos.want.action.viewData"]`。

#### Scenario: 自定义 scheme 映射
- **WHEN** `config.mobile` 含 `AssociatedDomain{scheme:["myapp"], host:None}`
- **THEN** 生成 skill `{entities:["entity.system.browsable"], actions:["ohos.want.action.viewData"], uris:[{scheme:"myapp"}], domainVerify:false}`

#### Scenario: App Link（https）映射
- **WHEN** `config.mobile` 含 `AssociatedDomain{scheme:["https"], host:"example.com", app_link:true}`
- **THEN** 生成 skill `{entities:["entity.system.browsable"], actions:["ohos.want.action.viewData"], uris:[{scheme:"https", host:"example.com"}], domainVerify:true}`

#### Scenario: path 映射名称差异
- **WHEN** `config.mobile` 含 `AssociatedDomain{scheme:["myapp"], path_pattern:["^/d+$"], path_prefix:["/app"]}`
- **THEN** uris 含 `pathRegex:"^/d+$"` 和 `pathStartWith:"/app"`（非 Android 的 pathPattern/pathPrefix）

#### Scenario: 多 scheme 生成多 uris 对象
- **WHEN** `config.mobile` 含 `AssociatedDomain{scheme:["myapp","myapp2"]}`
- **THEN** skill 的 `uris` 数组 SHALL 含两个对象 `{scheme:"myapp"}` 和 `{scheme:"myapp2"}`

### Requirement: 多 form（mobile/desktop）覆盖
注入 SHALL 根据 `OHOS_DEVICE_TYPE` 环境变量定位 `entry_{form}` 模块的 `module.json5`，确保 mobile 和 desktop form 都被正确注入（`--app` 模式多次 build 时每次 form 切换重跑 build.rs）。

#### Scenario: mobile form 注入
- **WHEN** `OHOS_DEVICE_TYPE=mobile`
- **THEN** `entry_mobile/src/main/module.json5` SHALL 被注入 deep-link skills

#### Scenario: desktop form 注入
- **WHEN** `OHOS_DEVICE_TYPE=desktop`
- **THEN** `entry_desktop/src/main/module.json5` SHALL 被注入 deep-link skills

