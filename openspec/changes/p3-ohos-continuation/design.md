# Design: p3-ohos-continuation

## Context

Phase 1c（目标端信号链）与 2c（`tauri-plugin-continuation` 恢复查询）已交付。本 Phase 补齐源端保存（`onContinue`）与构建期门控（`module.json5` `continuable`/`continueType`）。

华为官方文档核实结论（arkts-helper，2026-08-27）：
- `onContinue(wantParam: Record<string, Object>): AbilityConstant.OnContinueResult` **同步回调**，禁止异步操作——状态须运行期预维护（官方 AppStorage 模式印证预注册快照方案）。
- `OnContinueResult`：`AGREE`（同意迁移）/ `MISMATCH`（拒绝）/ `DATA_READY`（异步就绪，不用）。
- `module.json5` abilities 内 `continuable: true` + `continueType: string[]`；同账号 + 同 continueType 匹配目标设备。
- wantParam 键值对传递无需 `DISTRIBUTED_DATASYNC` 权限。

## Goals / Non-Goals

**Goals**：源端 onContinue 快照保存（零死锁）；tauri.conf.json → module.json5 构建期门控；插件 `setContinuationData` 命令；examples demo + 单设备 auto 用例 + 双设备 T1 手动用例。

**Non-Goals**：主动发起迁移（系统 UI 独占，R228 永久排除）；异步 `DATA_READY` 模式；跨版本协商（wantParam.version 由业务自行处理）。

## Decisions

### D1: 预注册快照 + 同步直读（死锁规避的核心）

JS 侧**提前**调用 `setContinuationData(data)` → Rust `CONTINUATION_SNAPSHOT: Mutex<String>`（全局 static，同 `CONTINUATION_DATA` 先例）。`onContinue` 触发时 ArkTS **同步 NAPI 直读**快照写入 `wantParam` 后立即返回 `AGREE`——全程无 `block_on`、无 `recv`、无 Promise 等待。

**Why not** 让 onContinue 里异步回调 JS 要数据：onContinue 是同步回调（官方明确禁止异步操作）；而 block_on 主线程等 JS 是 tray-icon/muda 死锁同型错误（THREAD_BLOCK_3S/6S 教训）。快照方案让迁移数据像官方 AppStorage 模式一样"实时维护、回调时只读"。

**Snapshot 语义（peek 不 drain）**：迁移被用户取消后可原样重试；新 `set` 覆盖旧值；`setContinuationData("")` 清空。不提供独立 clear 命令（空串即清空，YAGNI）。

### D2: 空快照 → MISMATCH

`onContinue` 读到空快照时返回 `AbilityConstant.OnContinueResult.MISMATCH`（拒绝接续）。

**Why**: 未注册数据的应用不应把空状态"成功"迁移出去；MISMATCH 是官方的"无有效数据"语义（官方示例 imgUrls 为空时同样返回 MISMATCH）。副作用：仅声明 `continuable: true` 但从不 set 数据的 app，源端迁移被拒——这是显式 opt-in 语义，写进文档。

### D3: reserved key `continuationData` 往返约定

源端 `onContinue` 把快照字符串原样写入 `wantParam.continuationData`（单 key，不 parse 不合并）。目标端 `getContinuationData()`（2c 已交付）返回完整 `want.parameters` JSON——消费方 `JSON.parse(...)` 后取 `.continuationData` 字段。

**Why not** 在 set 时 parse 成键值对合并进 wantParam：快照可能是非 JSON 任意字符串（插件契约是 string）；单 reserved key 往返最可预测，且 2c 的 getContinuationData 语义零改动（不破坏已交付 API）。往返写进 guest-js JSDoc 与 demo。

### D4: 同步 NAPI 导出 `read_continue_snapshot`

`app.rs` 新增（紧邻 `update_cursor_position` 先例，~:1039）：

```rust
#[napi]
#[cfg(target_env = "ohos")]
pub fn read_continue_snapshot() -> String {
  crate::app::peek_continue_snapshot()
}
```

ArkTS 侧（NativeAbility.ets `onContinue`）经 **`ProcessInitializer.getNativeModules()`** 取 primary module 调 `readContinueSnapshot()`（camelCase 自动转换）。带 `typeof === 'function'` 守卫 + try/catch（`forEachLifecycle` 既有防御模式）。

**Why not** `AppStorage.get(NATIVE_MODULE_STORAGE_KEY)`：onContinue 时机（源端运行中）模块已加载，但 ProcessInitializer 是 NativeAbility 直接可达的既有静态注册表（setupMenuPopup :253 同款用法），不依赖 AppStorage 写入时序。

### D5: 构建期门控——build 时写入而非模板硬编码

`tauri.conf.json` `bundle.openHarmony` 新增可选字段：

```json
"openHarmony": {
  "continuable": true,
  "continueType": ["my-app-continue"]
}
```

- `tauri-utils` `OpenHarmonyConfig` 加 `continuable: Option<bool>` / `continue_type: Option<Vec<String>>`（serde camelCase + alias kebab，`skip_serializing_none` 已在 struct 上）。**缺省 None = 行为不变**（不写 key）。
- tauri-cli `plugins.rs` 新增 `write_entry_continuation(project_dir, form, continuable, continue_type)`，在 `write_entry_device_types` 两个调用点（build.rs:211 form 循环、build.rs:355 单 form build）**同点追加调用**：
  - `continuable == Some(true)` → abilities[0] 写 `continuable: true`；`continueType` 取 conf 值，缺省（None 或显式空数组，后者视为用户误配）回退 `["<identifier>"]`（同 app 双设备天然匹配）。
  - 否则 → 从 abilities[0] **移除**两 key（支持从 true 切回 false 生效）。
- 模板 `module.json5` **不加占位符**——build 时写入对已存在的 `gen/ohos`（不重生成，见 gen/ohos stale 记忆）同样生效，与 deviceTypes 对齐策略一致。

**Why not** 模板 `{{placeholder}}`：gen/ohos 不随 build 重生成，模板改了旧项目也不生效；build 时改写（deviceTypes 先例）才是对存量项目生效的正确层。

### D6: 插件命令 + 96KB 上限（JS 契约层约束）

`tauri-plugin-continuation` 新增 `set_continuation_data(data: String) -> Result<()>`：
- OHOS：`ContinuationClient::default().set_continuation_data(data)`。
- **体积上限 96 * 1024 字节**（wantParam 官方建议几百 KB 内、接续契约 100KB；留头部余量）→ 超限返回新错误变体 `Error::PayloadTooLarge`（比 Unsupported 语义准确，仅 1 个新变体）。
- **96KB 校验仅位于插件命令层（JS 契约层）**；facade `set_continuation_data` 是薄委托不校验——Rust 侧直接调 facade 的调用者自行约束（当前无此类调用方，YAGNI）。
- 非 OHOS stub 返回 `Error::Unsupported`（签名与 ohos.rs 完全一致，2c 风格）。
- build.rs `COMMANDS` 追加；permissions/default.toml 追加 `allow-set-continuation-data`；guest-js `setContinuationData(data: string): Promise<void>`。

## Risks / Trade-offs

- **快照陈旧**：迁移成功后源端快照残留——无害（下次 set 覆盖；不 drain 是为支持取消重试的有意取舍）。
- **facade 无 96KB 校验**：超长写入仅能经 JS 命令路径被拦截；Rust 侧直接调 facade 的潜在调用者须自行约束（D6，当前无此调用方）。
- **continueType 缺省回退格式**（已验证）：`["<identifier>"]`（如 `["com.tauri.api"]`）含点号 reverse-DNS 串被 hvigor 构建接受（task 5.3 实测 BUILD SUCCESSFUL + 签名 HAP 安装启动成功），无需去点变体。
- **onContinue 单设备不可触发**：无系统迁移 UI 注入路径，AGREE/MISMATCH 行为只能双设备验证；单设备 auto 用例只覆盖 set 命令往返（命令 resolve + 空/超限边界），onContinue 分支列入 T1 双设备手动用例。**不阻塞交付**。
- **schema 再生成**：OpenHarmonyConfig 有 `#[cfg_attr(feature = "schema", derive(JsonSchema))]`，加字段会改 schema——遵循 deviceTypes 先例（无额外动作），但注意 host cargo check 重写 gen/schemas 丢 OHOS ACL 的已知坑，不在 host 跑 schema build。
- **静态快照跨 Ability 实例存活**：同 CONTINUATION_DATA 的既有语义（static 存活），非接续启动不清快照——快照是源端状态而非一次性信号，不清是正确行为（与 D1 peek 语义一致）。

## Migration Plan

纯增量：无现有项目设置 `continuable` → 行为完全不变；插件新命令不影响既有两命令。R228 在本 Phase 收尾改写为"被动恢复 + 源端保存均已提供；主动迁移系统 UI 独占不可用"。

## Open Questions

（设计期已全部解决，无遗留。两项验证依赖项：双设备验证执行依赖用户第二台设备；continueType identifier 回退格式在 task 5.3 构建断言——实现完成后引导用户执行 T1 用例，非设计疑问。）

## 实现注意（审计建议项）

- onContinue override 签名类型用官方大写 `Record<string, Object>`（勿从 onSaveState 的小写 `object` 复制）。
- onContinue 只放 NativeAbility 基类（同 onSaveState 模式）；EntryAbility 模板不得 override onContinue（会 shadow 快照逻辑）。
- `CONTINUATION_SNAPSHOT`（源端 peek）与 `CONTINUATION_DATA`（目标端 drain）static 注释须显式标注 source/target 方向，防混淆。
- continuation_tests 新增用例末尾 `store_continue_snapshot("")` 清理，避免污染同 mod 其他用例（--test-threads=1 串行）。
