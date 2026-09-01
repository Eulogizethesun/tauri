# Design: p1-ohos-accessibility

## Context

openharmony-ability pluginize 重构后,15 个桥接插件统一走 typed bridge 模式(ArkTS `AsyncPluginBase` 插件 + Rust facade crate + EntryAbility LazyPlugin 注册)。本设计新增第 16 个插件 `accessibility`,为 Tauri OHOS 适配提供无障碍最小状态查询。

现状:全链路零实现;`ohos-platform-limitations` spec R230 判定为"未来工作"。Web 内容无障碍由 ArkWeb 内置无障碍树 + WAI-ARIA 承担(无需 Tauri 适配);原生 ArkUI 外壳无交互语义,读屏焦点即 web 内容。

## Goals / Non-Goals

**Goals**
- `get-font-scale`:系统字号缩放查询(零权限,`context.abilityContext.config.fontScale`)
- `is-open-accessibility` / `is-touch-explore-enabled`:读屏/触摸探索状态查询(若系统权限拒绝,返回结构化错误而非 panic)
- `subscribe-state-change` / `unsubscribe-state-change`:状态变化事件(emit 事件模式推送到 Rust)
- cargo check 双侧(host + aarch64-unknown-linux-ohos)0 error,HAR 打包含新插件

**Non-Goals**
- AccessibilityExtensionAbility(无障碍服务提供方,三方不可注册)
- ArkUI 组件 accessibility 属性注入(UI 在 web,无意义)
- Web 内容 ARIA 处理(ArkWeb 内置)
- plugins-workspace 插件与 JS API(p2-ohos-accessibility)
- 字号缩放设置的运行时跟随(Configuration 变更回调 `onConfigurationUpdate` 转发,留待后续需求)

## Decisions

### D1: 插件形态 — 通用 plugin-* facade crate(非核心特权内联)

无障碍是普通系统能力查询,无破坏性 API、无 feature 门控需求 → 参照 plugin-clipboard 建 `crates/plugin-accessibility/`,暴露 `AccessibilityExt::accessibility() -> Result<AccessibilityClient>`。不选 account.rs 式内联(那是给需要 feature 门控的核心特权能力用的)。

### D2: action 面 4 个,全部无请求参数或轻量参数

| action | ArkTS 实现 | 返回 |
|---|---|---|
| `get-font-scale` | `context.abilityContext.config.fontScale`(number) | `{ fontScale: f64 }` |
| `is-open-accessibility` | `accessibility.isScreenReaderOpenSync()`(同步 boolean) | `{ enabled: bool }` |
| `is-touch-explore-enabled` | `accessibility.isOpenTouchGuide()`(Promise) | `{ enabled: bool }` |
| `subscribe-state-change` / `unsubscribe-state-change` | `accessibility.on/off('screenReaderStateChange')` | ack;变化经 invokeNativeSync 推 Rust |

**导入方式**:`import { accessibility } from '@kit.AccessibilityKit'`(禁止旧写法 `import accessibility from '@ohos.accessibility'`,已废弃)。华为 AI 口径称 API 12+ 已将 `isOpenAccessibility`→`isScreenReaderOpenSync`、`isOpenTouchExploreState`→`isOpenTouchGuide`、`accessibilityStateChange`→`screenReaderStateChange`;该口径此前有被推翻先例,实现时若编译报错找不到新名,退回旧名并在 p2 真机定论,以编译通过为准。

`get-font-scale` 同步可返;后两个走 `invokeAsync`(AsyncPluginBase 既有模式,Promise 结果由 bridge call_async 等待)。**不引入 SyncPluginBase**(无既有先例,收益小)。

### D3: 权限风险处理 — ArkTS 侧 try/catch + throw 结构化错误

华为 AI 口径称查询/事件 API 需系统权限 `ohos.permission.ACCESSIBILITY`(三方不可申请),但该口径未经实测(此前"自定义协议不支持字体"的 AI 口径已被真机推翻)。设计:
- ArkTS 每个 action 包 try/catch,捕获 `BusinessError`(`const err = e as BusinessError` interface cast,ClipboardPlugin.ets:225 先例)后 `throw new Error("... code=...")` re-throw——与既有插件错误模式一致,**bridge runtime 自动将 throw 转为 Rust 侧 Err**,不做 `{ok:false}` 结构(会与声明的 Response NAPI 类型不匹配导致反序列化失败)
- Rust facade 在 `call_async` 的 Err 中匹配错误码(201=PermissionDenied)映射 `AccessibilityError` 枚举变体,**不 panic 不静默**
- module.json5 **不声明** ACCESSIBILITY 权限(三方声明系统权限会安装失败/ACL 风险,见 ACL 教训)
- 真机实测留 p2:若实测无需权限则全量可用;若需权限则 API 边界清晰

### D4: 状态变化事件 — invokeNativeSync 模式(禁 recv/block_on)

参照 WebviewPlugin 的 `notifyNative` 先例(WebviewPlugin.ets:925-940):ArkTS 回调里调 `context.invokeNativeSync("accessibility-state-changed", REQUEST_TYPE, RESPONSE_TYPE, payload)`,Rust 侧经 `BridgePlugin::on_main_thread_event` 接收(plugin-webview lib.rs:61-100 先例)。事件载荷类型须在 Rust 侧 `#[napi(object)]` + `impl_bridge_napi_type!` 声明(与 WebviewPlugin 事件类型声明模式一致)。插件在 `unsubscribe` action 与 onDispose 中 `off` 回调,防泄漏。**禁止**主线程 block_on/recv 同步等结果(铁律,见 ohos-constraints)。

### D5: 注册链路 — pack-plugins.ps1 15→16 + 模板 .hbs 双端

- `pack-plugins.ps1` `$plugins` 数组追加 `("accessibility", "AccessibilityPlugin")` + 计数注释同步
- `crates/tauri-cli/templates/mobile/open-harmony/entry_{desktop,mobile}/.../EntryAbility.ets.hbs`:import 起别名模式(参照 global-shortcut 同名冲突教训,import { AccessibilityPlugin } 不与任何 @tauri plugin JS 冲突,可直名)+ `new LazyPlugin(() => new AccessibilityPlugin())`
- examples/api 的 gen/ohos 两个 EntryAbility.ets 手动同步(模板改动对新 init 才生效,存量项目手改)
- 改模板后 `cargo install --path crates/tauri-cli --locked` 重装(本轮先手改 gen,cli 重装在 2a 一并做)

### D6: ArkTS 硬规则套用

- `import { accessibility } from '@kit.AccessibilityKit'`(见 D2 版本说明)
- interface 字段全 camelCase(`fontScale`/`enabled`)
- 取 context 用 `context.abilityContext` + `requires:["ability"]`(禁止 getAbilityContext())
- 禁 `as any`/`as unknown`,BusinessError 用 interface cast(`e as BusinessError`)
- 本插件无 Vec<u8>/二进制载荷,Uint8Array 陷阱不适用

## Risks / Trade-offs

- [ACCESSIBILITY 系统权限拒绝三方只读查询] → D3 结构化错误 + p2 真机实测;最坏情况 fontScale 单 API 仍全量可用,事件/读屏状态查询返回 PermissionDenied
- [state-change 回调在插件 dispose 后仍触发(泄漏/野指针)] → unsubscribe action 中 off + 插件 onPluginDestroy 兜底 off
- [模板改动导致 gen 与模板漂移] → 本 Phase 同时改模板与 gen 双份,pack 后 grep 验证 HAR 含 `ohos.accessibility`
- [15→16 插件计数注释漂移] → pack-plugins.ps1 计数断言已有先例,同步更新

## Migration Plan

纯新增,无迁移。回滚 = revert 插件目录 + pack-plugins 行 + 模板行。

## Open Questions

- `on('accessibilityStateChange')` 三方真机可用性(p2 实测定论,不阻塞本 Phase)
- `Configuration` 更新时 fontScale 是否需要事件化(暂不做,查询模式已满足响应式首帧需求)
