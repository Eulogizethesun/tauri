# Design: p2-cursor-grab

## Context

p1-cursor-grab 完成底层实现(dlopen/dlsym FFI + CursorGrabError 映射),真机冒烟证据:`[tao-ohos] set_cursor_grab(true) failed for window 0: window manager error code 201`——链路通,仅缺权限。本 change 交付权限声明、真实测试与文档纠偏。

关键事实(Phase 1 已核实,Phase 2 探索确认):

- `ohos.permission.LOCK_WINDOW_CURSOR`:normal 级 / system_grant / API 22+ / General 全设备,**在官方「开放权限」列表**(permissions-for-all);声明只需 `{"name": ...}`,无需 reason/usedScene(user_grant 才强制)。
- **HAR 的 module.json5 requestPermissions 不合并进宿主 HAP**——权限必须声明在 HAP(entry)模块;现网 SET_WINDOW_TRANSPARENT 双声明(HAR + 模板)正是此因。
- 模板改动只有重新 `cargo tauri ohos init` 才进 gen 产物(且需重装 cli);直接改 gen 产物是本项目既有做法(如 entry_desktop 插件依赖修复)。
- 本 change 无 Rust/ArkTS 代码变更 → 无需 HAR 重建;HAP 重建由 beforeBuildCommand(pnpm build)+ hvigorw 完成。

## Goals / Non-Goals

**Goals:**

- 设备上 `setCursorGrab(true)` 真实锁定光标(confined 模式),`setCursorGrab(false)` 解锁,失焦自动解锁
- 未来新生成项目开箱即带权限(模板)
- 文档与事实一致(推翻「平台限制」错误结论)

**Non-Goals:**

- `isCursorFollowMovement=false` 冻结模式暴露(上游 API 演进)
- 子窗口锁定自动化测试(手动用例覆盖;自动测试无法从 JS 断言光标物理约束)
- entry_mobile gen 产物修改(api demo 仅构建 desktop 形态;模板已覆盖未来 mobile 项目)

## Decisions

### D1:权限落点——gen 产物 + 双模板 + HAR 三层

| 落点 | 目的 | 理由 |
|------|------|------|
| `examples/api/src-tauri/gen/ohos/entry_desktop/src/main/module.json5` | 当前 demo 生效 | 唯一被 hvigorw 打进 HAP 的声明点;直接改产物避免 cli 重装 + init 全链 |
| `tauri-cli/templates/.../entry_desktop/entry_mobile/module.json5` | 未来项目 | 模板是新项目源头;desktop/mobile 都加(权限 General 全设备,mobile 设备上 system_grant 无弹窗零负担) |
| `openharmony-ability/native_ability/src/main/module.json5` | 自文档化 | 跟随 SET_WINDOW_TRANSPARENT 先例标注 HAR 能力依赖;不参与合并,纯声明性 |

声明内容(normal 级 system_grant 无需 usedScene):

```json
{ "name": "ohos.permission.LOCK_WINDOW_CURSOR" }
```

### D2:TestRunner 按钮升级——单按钮 5 秒锁定 + 人工判据文案

**选择**:把「setCursorGrab (platform limit)」(现断言 no-throw)替换为「setCursorGrab(true) 5s」:点击 → `setCursorGrab(true)` → 显示锁定判据文案 → 5 秒后 `setCursorGrab(false)` → 显示解锁判据。调用抛错时显示错误(如权限缺失)。

**理由**:
- 与 p1 spec 三个手动场景一一对应:锁定(confined)/解锁/失焦自动解锁(文案引导用户在 5 秒内点击其他窗口验证)。
- 5 秒自动解锁避免用户被锁住出不来(失焦自动解锁是系统兜底,应用侧不该依赖)。
- 不引入 toggle 状态(现 TestRunner 手动区无状态按钮是主流,Window.svelte 已有 checkbox 型 toggle 覆盖)。
- 按钮保留在「自动测试补充」分区原名位置,减少对既有测试布局的扰动。

### D3:文档纠偏——记录正确 API 链路与历史误判原因

两份文档的「平台限制」结论均源于**只 grep ArkTS `.d.ts`**;LockCursor 仅在 NDK native 侧(oh_window.h + libnative_window_manager.so)暴露。修正时显式记录这一点(防止后续再犯),并标注行为差异(失焦自动解锁 vs Windows ClipCursor 持续锁定)。

mapping 文档光标抓取行更新为:`set_cursor_grab` → `openharmony-ability::window::set_cursor_grab`(dlopen 弱加载)→ `OH_WindowManager_LockCursor/UnlockCursor`(API 22+,LOCK_WINDOW_CURSOR normal 权限)。

## Risks / Trade-offs

- [模板改动不生效于已有 gen 项目] → 直接改 gen 产物(既有做法);模板改动在下次 init 才生效,已在 proposal Impact 标注。
- [老设备(API < 22)声明了不存在的权限] → 遵循既有模式:demo 已声明 SET_WINDOW_TRANSPARENT(API 20)/WINDOW_TOPMOST(API 13)而 compatibleSdk 12,OHOS 对未知 normal 权限安装不硬失败;运行时由 p1 的 dlsym null → NotSupported 兜底。
- [锁定期间用户切走导致状态文案滞后] → 失焦自动解锁是系统行为,5 秒后 unlock 调用幂等(已解锁再 unlock 返回 OK 或 STATE_ABNORMAL,均无害)。

## Migration Plan

无破坏性变更:行为从「201 拒绝」变为「真实锁定」;前端旧断言(no-throw)在新行为下依然成立(成功 resolve 而非 throw)。

## Open Questions

(无)
