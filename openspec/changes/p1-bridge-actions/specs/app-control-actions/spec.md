# app-control-actions spec

## plugin: ohos.app-control

Plugin ID: `ohos.app-control`
Execution: `sync-main-thread`
Context requirement: `ability`

## 现有 actions

### terminate

| 字段 | 值 |
|------|-----|
| action | `terminate` |
| reqType | `ohos.app_control.TerminateRequest` |
| respType | `ohos.app_control.TerminateResponse` |

**TerminateRequest**: `{ code: i32 }`
**TerminateResponse**: `{ accepted: bool }`

**ArkTS**：`new process.ProcessManager().exit(code)`。

## 新增 actions

### hide-ability

| 字段 | 值 |
|------|-----|
| action | `hide-ability` |
| reqType | `ohos.app_control.HideAbilityRequest` |
| respType | `ohos.app_control.HideAbilityResponse` |

**HideAbilityRequest**: `{}`（空结构体）

**HideAbilityResponse**: `{ accepted: bool }`

**ArkTS**：`context.abilityContext.hideAbility(callback)` — fire-and-forget。`hideAbility()` **仅支持 callback，不支持 Promise**，必须传入 `AsyncCallback<void>`。callback 中记录错误但不阻塞返回。立即返回 `{ accepted: true }`。

**语义**：ack 表示"调用已发起"，非"隐藏已完成"。`hideAbility()` 仅 UIAbility 主窗口可用；Float 子窗口用 plugin-window 的 `minimize` action。等效于 macOS Cmd+H（所有窗口不可见，进程存活）。

**约束**：
- `hideAbility()` 是 `common.UIAbilityContext` 的方法，REQUIRED_CONTEXTS: `ability` 已保证 context 可用。
- hide 后 show 可能不对称（OHOS 已知限制）。

### show-ability

| 字段 | 值 |
|------|-----|
| action | `show-ability` |
| reqType | `ohos.app_control.ShowAbilityRequest` |
| respType | `ohos.app_control.ShowAbilityResponse` |

**ShowAbilityRequest**: `{}`（空结构体）

**ShowAbilityResponse**: `{ accepted: bool }`

**ArkTS**：
```typescript
const ctx = context.abilityContext;
const want: Want = {
  bundleName: ctx.abilityInfo.bundleName,
  abilityName: ctx.abilityInfo.name,
};
// startAbility(want) supports Promise (unlike hideAbility which is callback-only)
ctx.startAbility(want).catch(...);  // fire-and-forget
```

**语义**：通过 `startAbility` 将隐藏的 Ability 恢复到前台。ack 表示"调用已发起"。

**约束**：`ctx.abilityInfo` 需在 ability created 后才可用（REQUIRED_CONTEXTS: `ability` 保证）。`Want` 类型从 `@kit.AbilityKit` 导入。

## Rust facade 扩展

```rust
pub trait AppControlExt {
    fn terminate(&self, env: &Env, code: i32) -> Result<()>;
    fn hide_ability(&self, env: &Env) -> Result<()>;
    fn show_ability(&self, env: &Env) -> Result<()>;
}
```

`hide_ability` / `show_ability` 通过 `with_main_thread_bridge(env, |bridge| { bridge.call_sync::<AppControlBridgePlugin, ...>(...) })` 调用，与 `terminate` 一致。

## WindowPlugin BlurModifier 迁移

**目标**：将 `BlurModifier` 类和 `AttributeUpdater` 动态刷新逻辑从 `_legacy/DefaultWebview.ets` 移入 `plugins/window/` 目录。

**BlurModifier 类**：
```typescript
import { AttributeUpdater } from "@kit.ArkUI";

export class BlurModifier extends AttributeUpdater<CommonAttribute> {
  initializeModifier(_instance: CommonAttribute): void { /* empty */ }
}
```

**运行时刷新**（因 `BuilderNode.update` 不刷新 `backdropBlur`）：
```typescript
modifier.attribute?.backdropBlur(radius);
modifier.attribute?.backgroundColor(color);
```

**放置位置**：`plugins/window/src/main/ets/BlurModifier.ets` 或 WindowPlugin.ets 内部。由 WindowPlugin 的 `set-blur` action 在调用 `setWindowShadowRadius` 的同时，通过关联的 content 节点的 AttributeUpdater 刷新 `backdropBlur`。

**约束**（ohos-constraints 4.1）：
- `AttributeUpdater` 适合 `@Builder`/`BuilderNode` 场景，不需 `@State`。
- `BuilderNode.update` 不刷新 `backdropBlur` / `backgroundColor` 等属性。
