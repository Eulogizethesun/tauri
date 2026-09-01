## Context

Phase 1 实现了 deep-link 的事件接入和 `get_current`，但 OHOS 系统无法路由 deep link 到 app——`module.json5` 的 `skills` 仅 home 入口，无 `uris/scheme`。需构建时注入 skills。

**现有可复用基础设施**：
- `update_android_manifest`（`tauri-utils/build.rs:108-131`）：env 自门控（读 `TAURI_ANDROID_PROJECT_PATH`，未设 no-op）+ 块注释幂等
- `write_entry_device_types`（`tauri-cli/.../plugins.rs:649-677`）：**OHOS 侧 json5 parse/serialize 修改 module.json5 的既定模式**（`parse_json5`/`serialize_json5`）——这是 OHOS 改 module.json5 的正确方式，非 Android 的块注释文本注入
- `TAURI_DEEP_LINK_PLUGIN_CONFIG` 在 OHOS build 时已就绪（`helpers/config.rs:218-226`）；`TAURI_OHOS_PROJECT_PATH`（`mod.rs:191`）、`OHOS_DEVICE_TYPE`（`build.rs:116`）均已设置
- skills 语法（`module-configuration-file.md:363-393`）：`scheme/host/path/pathStartWith/pathRegex` + `entity.system.browsable` + `ohos.want.action.viewData`
- 关键规则（`deep-linking-startup.md:18`）：home skill 不能配 uris，**需创建独立 skill 对象**

**时序兼容性**：deep-link build.rs（build 步骤6，`open_harmony/build.rs:229`）在 `write_entry_device_types`（步骤7，`:355`）前运行，两者都 json5 round-trip，deep-link 注入的 skills 被步骤7 保留（步骤7 只改 deviceTypes）。

**约束**（三条铁律）：cfg/env 隔离；不影响其他平台；OHOS 代码不误入非 OHOS。

## Goals / Non-Goals

**Goals:**
- 构建时把 deep-link `config.mobile` 的 scheme/domain 注入 `module.json5` 的 `skills/uris`
- 幂等（重复构建不累积）
- 不破坏 home 入口 skill
- 非 OHOS 平台 no-op
- 多 form（mobile/desktop）覆盖

**Non-Goals:**
- 运行时动态 scheme 注册（OHOS 不支持，永久 Non-Goal）
- tauri-cli 模板钩子（运行时注入即可，无需改模板）
- `path_suffix` 支持（OHOS 无对应字段，丢弃）

## Decisions

### D1: update_ohos_module_json 用 json5 parse/serialize（非块注释）
**选择**：新增 `update_ohos_module_json(skills: serde_json::Value)`，用 json5 parse module.json5 → mutate → serialize 写回，参考 `write_entry_device_types`（`plugins.rs:649-677`）。

**理由**：OHOS module.json5 是 JSON5 格式，Android 的块注释文本注入（`insert_into_xml`，`build.rs:133-167`）不适用（JSON5 数组内无法用块注释做幂等标记）。`write_entry_device_types` 已验证 json5 parse/serialize 是 OHOS 侧改 module.json5 的正确模式。

### D2: env 自门控（TAURI_OHOS_PROJECT_PATH）
**选择**：读 `TAURI_OHOS_PROJECT_PATH`，未设则 `return Ok(())` no-op。

**理由**：对标 `update_android_manifest` 读 `TAURI_ANDROID_PROJECT_PATH`（`build.rs:119`）。非 OHOS 构建时该 env 未设，函数自动 no-op，无需 cfg 门控。定位 entry 模块：`{project_path}/entry_{OHOS_DEVICE_TYPE}/src/main/module.json5`（默认 `entry_mobile`）。

### D3: 幂等——按 skill 签名去重
**选择**：注入前先移除 `abilities[0].skills` 数组中已有的 deep-link skill（按 `actions` 含 `ohos.want.action.viewData` 单字段匹配），再按 config 重新注入。

**理由**：JSON5 无块注释做幂等标记。按 skill 签名（`actions` 含 `ohos.want.action.viewData`）去重是可靠方案——`ohos.want.action.viewData` 是 deep-link 专属 action，home skill 用 `action.system.home`，单字段即可严格区分，无需叠加 `entities` 条件。重复构建时先删后插，不累积。

### D4: 追加独立 skill 对象，不改 home skill
**选择**：把新生成的 deep-link skill 对象**追加**到 `abilities[0].skills` 数组末尾，不修改现有 home skill。

**理由**：`deep-linking-startup.md:18` 明确："skills 标签下默认包含一个 skill 对象用于标识应用入口。应用跳转链接不能在该 skill 对象中配置，需要创建独立的 skill 对象。" home skill 必须保留（否则 app 无桌面图标入口）。

### D5: AssociatedDomain→OHOS skill 字段映射
**选择**：

| AssociatedDomain 字段 | OHOS skill 字段 | 说明 |
|---|---|---|
| `scheme`（Vec） | `uris[].scheme` | 多 scheme 生成多个 uris 对象（OHOS SkillUri 一个对象一个 scheme） |
| `host`（Option） | `uris[].host` | |
| `path`（Vec） | `uris[].path` | 全匹配 |
| `path_pattern` | `uris[].pathRegex` | **名称不同**：Android pathPattern → OHOS pathRegex |
| `path_prefix` | `uris[].pathStartWith` | **名称不同**：Android pathPrefix → OHOS pathStartWith |
| `path_suffix` | （丢弃） | OHOS 无对应字段 |
| `app_link=true` | `domainVerify: true` | App Linking 域名校验 |
| 固定 | `entities: ["entity.system.browsable"]` | |
| 固定 | `actions: ["ohos.want.action.viewData"]` | |

**理由**：字段映射对照 OHOS 官方 `uris` 标签（`module-configuration-file.md:384-393`）+ Android intent_filter 映射（`build.rs:12-73`）。`path_suffix` 无 OHOS 对应，丢弃并日志告警。

### D6: tauri-plugin Cargo.toml 新增 json5 依赖
**选择**：`tauri-plugin/Cargo.toml` 的 `[build-dependencies]` 加 `json5`（tauri-utils 已用 `json5 0.4`，`Cargo.toml:40,91`，但 tauri-plugin 未启用 `config-json5` feature，`Cargo.toml:30-32` `default-features=false`）。

**理由**：`update_ohos_module_json` 需 json5 解析。直接给 tauri-plugin 加 `json5` 依赖（而非启用 tauri-utils `config-json5`）更轻量，避免引入 tauri-utils 的 config 解析链。

### D7: 无需 tauri-cli 模板钩子
**选择**：不改 `entry_mobile/src/main/module.json5` 和 `entry_desktop/src/main/module.json5` 模板，纯运行时注入。

**理由**：对标 `update_android_manifest`（纯运行时文本注入，无模板钩子）。时序兼容已验证：deep-link build.rs 注入 skills（步骤6）→ `write_entry_device_types`（步骤7）只改 deviceTypes 并 round-trip，保留 skills。

## Risks / Trade-offs

- **[json5 依赖新增]** → D6 直接加 `json5 0.4`（tauri-utils 已验证可用），小风险。
- **[幂等去重签名误匹配]** → D3 按 `ohos.want.action.viewData` 单字段签名匹配，与 home skill（`action.system.home`）严格区分；审计核对。
- **[多 form 注入]** → `--app` 模式循环 set `OHOS_DEVICE_TYPE` 多次 build，deep-link build.rs 每次 form 切换重跑，注入到当前 `entry_{form}`；两个 entry 都被覆盖。低风险，env 驱动。
- **[OHOS schema 校验]** → 注入字段对照 `module-configuration-file.md:363-393` 确认合法（scheme/host/path/pathStartWith/pathRegex/domainVerify/entities/actions）。
- **[path_suffix 丢弃]** → OHOS 无对应字段，D5 丢弃并日志告警；影响小（path_suffix 使用率低）。
