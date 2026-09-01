# Design: p1-cursor-grab

## Context

调用链自上而下已通到 tao:JS `setCursorGrab` → tauri 插件命令(OHOS 构建下 `desktop` cfg 为 true,`mobile = ios||android` 不含 ohos)→ tauri-runtime-wry(`WindowMessage::SetCursorGrab`)→ tao `platform_impl/ohos/mod.rs:1470` 返回 `Err(NotSupported)` —— 全链路唯一断点,tauri/wry 零改动。

OHOS 侧唯一可用的系统接口是 NDK C API(本地 SDK 头文件与官方文档双重确认,SDK `ets/api` 无对应 ArkTS API):

```c
// libnative_window_manager.so,API 22+,权限 ohos.permission.LOCK_WINDOW_CURSOR(normal/system_grant)
int32_t OH_WindowManager_LockCursor(int32_t windowId, bool isCursorFollowMovement);
int32_t OH_WindowManager_UnlockCursor(int32_t windowId);
```

两个既有事实约束方案形态:

1. **windowId 陷阱**:tao 的 window_id 是内部 ID(主窗口恒 0,Float 子窗口 >0),而 C API 要求真实 OHOS windowId(= ArkTS `getWindowProperties().id`;官方 Snapshot 接口文档明示该取法)。ArkTS `WindowManager.getWindow()` 已实现 taoId→window 实例解析(主窗口走 `getMainWindowSync()`,子窗口走 windows map)。
2. **版本约束**:api demo `compatibleSdkVersion` 为 API 12,LockCursor since 22——低版本设备上符号不存在,直接静态链接有加载期符号解析失败风险。

其他背景见 proposal.md(Why / What Changes)。

## Goals / Non-Goals

**Goals:**

- 打通 tao `set_cursor_grab` → openharmony-ability → `OH_WindowManager_LockCursor/UnlockCursor` 的完整实现链路
- API < 22 设备安全降级(返回 NotSupported,不崩溃、不影响加载)
- 错误码忠实传播(201/801/1300002/1300003),供 hilog 排障

**Non-Goals:**

- 权限声明(module.json5)、TestRunner 真实测试、文档更新 —— Phase 2(`p2-cursor-grab`)
- 暴露 `isCursorFollowMovement` 两种模式给上层(tao 的 bool API 无模式维度;固定 `true`)
- 失焦后自动 re-grab(Windows/macOS 的 tao 实现均无此逻辑;应用侧可监听 `Focused` 自行处理)
- `set_cursor_position` 实现(独立能力,不在本 change)

## Decisions

### D1:FFI 采用运行时 dlopen + dlsym 弱加载,而非静态链接

**选择**:`dlopen("libnative_window_manager.so")` + `dlsym` 解析两个符号,函数指针缓存于 `OnceLock`,进程内只解析一次。

**理由**:
- `compatibleSdkVersion = API 12`,应用可装到 < 22 设备;静态链接时若设备系统库不导出该符号,存在加载期解析失败导致应用无法启动的风险(musl 的 PLT 绑定时机不可依赖)。
- dlsym 返回 null 本身就是精确的版本守卫(符号存在 ⟺ 设备 API ≥ 22),无需再叠加 `sdk_api_version()` 检查——比版本号比对更准确(设备分支/阉割版系统按符号实际存在性判断)。
- `libnative_window_manager.so` 是系统库且进程内已加载(窗口管理链路在用),dlopen 仅取已有句柄,无额外加载开销。

**备选(否决)**:`#[link(name = "native_window_manager")]` 静态链接 + `sdk_api_version() >= 22` 运行时守卫——守卫挡不住加载期符号解析,守卫形同虚设。

### D2:真实 windowId 采用调用时惰性查询(ArkTS 同步 helper)

**选择**:openharmony-ability Rust 侧经 NAPI 调用新增的 ArkTS helper `getRealWindowId(windowId): number`,同步取回真实窗口 ID;未找到窗口返回 `-1` 哨兵值。

**理由**:
- 同步返回模式已有真机验证先例:`is_window_maximized` 用 `Function<'_, i64, bool>` + `func.call(id)`(`window/mod.rs:550`),`getRealWindowId` 与之同构。
- 惰性查询不触碰窗口注册流程(主窗口/UIAbility 实例/Float 子窗口三条注册路径零改动),天然规避注册时序竞态与销毁失效问题。
- ArkTS 侧实现直接复用 `getWindow()` + `getWindowProperties().id`(`setPointerStyle` 已用同一组合,真机验证过主窗口与子窗口均可达)。

**备选(否决)**:窗口注册时把 realId 推送到 Rust 维护映射——需改动三条注册路径 + 销毁清理,复杂度不成比例。

**约束**:`getRealWindowId` 函数体内**禁用 hilog**(被 Rust NAPI `func.call` 调用的 ArkTS 函数内部 hilog 会触发 `Argc mismatch` 异常);失败路径靠 `-1` 哨兵表达。其内部调用的 `getWindow()` catch 分支含 hilog.warn 属既有代码,`isMaximized` 同路径真机可行,保持原样。

### D3:层职责划分——FFI 全部收在 openharmony-ability,tao 只做错误映射

**选择**(遵守「openharmony-ability 是唯一桥接仓」铁律):

```
tao ohos set_cursor_grab(grab)
  → openharmony_ability::window::set_cursor_grab(window_id, grab)   // NAPI: getRealWindowId 查询
    → 窗口不存在 / NAPI 桥接不可用 → Err(CursorGrabError::Bridge)
    → dlsym 句柄 null 或 FFI 返回 801 → Err(CursorGrabError::NotSupported)
    → FFI 返回 201/1300002/1300003 → Err(CursorGrabError::OsCode(code))
  → tao 映射为 ExternalError
```

ability 层新增类型化错误枚举(新函数无历史包袱,不复用 `napi_ohos::Result<()>` 的字符串 reason——tao 层需要按错误类别映射,字符串判别脆弱):

```rust
pub enum CursorGrabError {
  /// 系统不支持:dlsym 失败(API < 22)或 FFI 返回 801
  NotSupported,
  /// FFI 错误码:201(权限)/ 1300002(窗口状态)/ 1300003(服务异常)
  OsCode(i32),
  /// NAPI 桥接不可用(helper/env 未就绪)或窗口不存在(realWindowId ≤ 0)
  Bridge(String),
}
```

tao 侧错误映射(对齐现有 `os_error!(OsError)` 风格):

| 来源 | tao 返回 |
|------|----------|
| `CursorGrabError::NotSupported`(dlsym null / FFI 801) | `Err(ExternalError::NotSupported(...))` —— 与改动前行为一致,老设备语义不变 |
| `CursorGrabError::OsCode` / `CursorGrabError::Bridge`(窗口不存在、权限缺失、状态异常等) | `Err(ExternalError::Os(os_error!(OsError)))`,Rust 侧 log 具体错误码 |

**幂等解锁**(2026-08-19 真机实测后补充):unlock 时 FFI 返回 1300002(STATE_ABNORMAL)按成功处理——系统失焦自动解锁后应用再次 unlock 会拿到 1300002,报错属于噪音;Windows 解锁未锁定窗口(ClipCursor flag 清除)本就静默成功,幂等化与桌面语义对齐。lock 时 1300002 仍为错误。

**理由**:dlopen/dlsym/NAPI 细节不泄漏到 tao;tao 保持与其他窗口函数一致的「调用封装 + 错误映射」形态;错误码留日志(ability 的 `log` 宏经 ohos-hilog-binding 输出,非 NAPI console,无重入问题)便于真机排障——权限缺失 201 是 Phase 2 权限就位前的预期冒烟信号。

### D4:`isCursorFollowMovement` 固定传 `true`

**选择**:锁定时固定 `LockCursor(real_id, true)`(confined:光标限制在窗口区域内仍可移动)。

**理由**:与 Windows ClipCursor 语义一致,是 bool `set_cursor_grab` 的主流解读;macOS tao 实现(dissociate,冻结光标)是异类。冻结模式(`false`,FPS 视角场景)无上层 API 可表达,属未来扩展(暴露模式枚举属 tauri 上游 API 演进,不在本项目)。用户已确认此映射。

### D5:线程模型——零新增线程,主线程同步直调

**选择**:FFI 调用发生在 tao 事件循环线程(= ArkTS 主线程):tauri-runtime-wry 经 `WindowMessage::SetCursorGrab` 派发到事件循环,与现有全部窗口操作同路径;NAPI helper 调用本就要求主线程 env。

**理由**:不引入 TSFN、不触碰 `run_on_main_thread + recv()` 禁止模式;窗口管理类 C API 建议主线程调用(华为官方答复),现有链路天然满足。LockCursor 同步生效,无异步回调。

## API 映射(Tauri ↔ OHOS)

| Tauri/tao | OHOS | 说明 |
|-----------|------|------|
| `Window::set_cursor_grab(true)` | `OH_WindowManager_LockCursor(realWindowId, true)` | confined 锁定,获焦窗口生效 |
| `Window::set_cursor_grab(false)` | `OH_WindowManager_UnlockCursor(realWindowId)` | 解锁,恢复自由移动 |
| (无对应) | 失焦自动解锁 | 系统行为,与 Windows 差异,文档标注 |
| (无对应) | `isCursorFollowMovement=false`(冻结模式) | 未暴露,固定 true |
| realWindowId 解析 | ArkTS `getWindowProperties().id` | 经 `getRealWindowId` helper 惰性查询 |

## Risks / Trade-offs

- [老设备(API < 22)行为变化] → dlopen/dlsym 弱加载 + NotSupported 降级,行为与改动前完全一致(返回同一个 `NotSupportedError`),零回归面。
- [失焦自动解锁与 Windows 语义不一致] → spec 已定义为正式行为并在文档显式标注;需要持续锁定的应用监听 `Focused(true)` re-grab,属应用侧职责。
- [未声明权限时调用返回 201] → Phase 1 阶段(权限未加)真机冒烟预期信号;错误码进 hilog,不崩溃。Phase 2 权限就位后消失。
- [子窗口锁定需先获焦] → API 仅对获焦窗口生效;测试用例设计为先 `setFocus` 再 grab(手动用例覆盖)。
- [dlsym/dlopen 错误处理遗漏] → dlopen 失败、dlsym null、OnceLock 未初始化三种路径统一落到 NotSupported 降级,不 panic。
- [ask_ai 历史幻觉风险] → 本设计所有 API 结论以本地 SDK 头文件直读 + 官方文档页(harmonyos_developer_knowledge)为准,ask_ai 仅用于线程约束/权限合并行为等辅助判断,且线程结论与现有架构天然一致,不构成依赖。

## Migration Plan

- 无破坏性变更:对外行为从「恒 Err(NotSupported)」变为「真实实现 + 不支持设备上 Err(NotSupported)」;现有前端测试按 no-throw 断言,升级后依然通过。
- 部署顺序:Phase 1 合入(底层)→ Phase 2 权限 + 测试 → 真机验证。
- 回滚:revert tao `set_cursor_grab` 函数体即可恢复旧行为;openharmony-ability 新增函数无其他调用方,可留可删。

## Open Questions

(无)
