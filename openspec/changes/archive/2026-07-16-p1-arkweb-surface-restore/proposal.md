## Why

窗口 resize(拖边缘松手)后 ArkWeb 底部内容缺失。根因:commit `6fd8c0a` 把 Web 组件 sizing 从 `.width("100%")`(自然 ArkUI 布局)改为 `.width(data.style?.width)`(由 `set_bounds` 设置)。`set_bounds` 走 `BuilderNode.update`,只更新 ArkUI 布局树的尺寸约束,**不通知 ArkWeb 渲染内核重算视口**。resize 时 Web 节点尺寸变了,但 ArkWeb 视口没 relayout → 底部被裁。

minimize→restore 不受影响(不调 set_bounds,ArkWeb 自然 rebind)。之前的 Event::Resumed → set_bounds 方案是误诊,反而干扰 ArkWeb 自然 rebind(引入 2-cycle 问题),已回退。

## What Changes

- `openharmony-ability` `native_ability/.../webview/DefaultWebview.ets`: WebBuilder 和 EmbeddedWebBuilder 的 Web 组件 `.width/.height` 从 `data.style?.width ?? "100%"` 改回 `"100%"`(自然 ArkUI 布局)。保留 `.position({x, y})` 用于子窗口定位。
- 撤回 `6fd8c0a` 对 sizing 的改动,保留其 positioning + NAPI 基础设施。

### Rejected Alternatives

- **Event::Resumed → set_bounds reattach**: 在 tauri-runtime-wry 的 `Event::Resumed` 中调 `set_bounds()` 强制 ArkWeb 重新 attach surface。误诊——minimize→restore 本不需要(ArkWeb 自然 rebind),set_bounds 反而干扰自然 rebind 导致 2-cycle 底部缺失。已回退。
- **tao MainEvent::Start → Event::Resumed**: 让 desktop restore 时发 Resumed。同样基于误诊,已回退为原 TODO stub。

## Capabilities

### New Capabilities
- `arkweb-surface-restore`: OHOS 上 Web 组件使用自然 ArkUI 布局(`"100%"`),确保 resize 后 ArkWeb 正确 relayout,底部内容不缺失。

### Modified Capabilities
<!-- 无既有 spec 的需求变更 -->

## Impact

- **openharmony-ability**: `native_ability/.../webview/DefaultWebview.ets`(Web sizing 改回 "100%")。
- **tauri-runtime-wry**: 无改动(Event::Resumed handler 已移除)。
- **tao**: 无改动(MainEvent::Start 已回退为 TODO stub)。
- **API 版本**: 无新增 OHOS API 调用。
- **依赖**: 无新增依赖。
