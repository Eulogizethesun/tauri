# OHOS 适配约束模板

> 以下内容在 openspec propose 时注入，确保设计方案遵守通用约束。

## 三条铁律（必须遵守）

1. **openharmony-ability 是唯一 ArkTS 桥接仓** — 所有仓（tauri、tao、wry、muda、tray-icon）调用鸿蒙系统能力必须经过 openharmony-ability，禁止在其他仓直接调用 ArkTS API 或 NAPI 函数。

2. **不影响其他平台原有实现** — 所有修改不得影响 Windows/macOS/Linux 的现有功能和代码路径。OHOS 代码必须通过 `cfg(target_env = "ohos")` 隔离。

3. **TAURI_OHOS_DEVICE_TYPE 决定设备形态** — desktop/mobile 由环境变量编译时决定。通用代码用 `cfg(target_env = "ohos")`，形态特有代码用 `cfg(all(target_env = "ohos", desktop))` 或 `cfg(all(target_env = "ohos", mobile))`。

## cfg 隔离关键规则

- OHOS 的 `target_os` 是 `"linux"` → Linux 依赖必须加 `not(target_env = "ohos")` 排除
- tauri crate 的测试在 OHOS 上排除（mock_runtime 依赖 desktop EventLoop）
- OHOS 不自动是 `mobile`，需要 `any(mobile, target_env = "ohos")` 才能同时覆盖

## NAPI/TSFN 关键规则

- `snake_case` → `camelCase` 自动转换（ArkTS 用错名字静默失败不报错）
- `callee_handled::<false>()` 必须（true 会在首位插入 null 导致参数偏移）
- TSFN 数据独立 Box 入队，禁止全局 Mutex<Option<Data>> 中转（freeze 风险）

## 线程模型关键规则

- **禁止** `run_on_main_thread + rx.recv()` 阻塞模式（Chrome_IOThread ↔ ArkTS 主线程死锁）
- Mutex 不得跨越阻塞 I/O 操作持有

## ArkTS 框架关键规则

- 模块级 `@Builder` 无 `this` 上下文（递归 Builder 必须在 @Component 内）
- `onLoadIntercept` 语义与 Tauri `on_navigation` 相反（必须 `!ret`）
- Rust 创建窗口可能早于 ArkTS controller 就绪（需要 ProxyJsHelper 代理回放）

## 构建环境关键规则

- 必须用 Git Bash（PowerShell 不兼容）
- 必须 `--features prod`（不加则连接 localhost:1420）
- 修改 openharmony-ability 后必须全链重建 HAR

## API 版本管理关键规则

- **tauri api demo 默认 API 版本为 12**（最低支持版本），使用 > 12 的 API 必须加版本守卫，否则低版本设备崩溃
- 版本隔离是底层仓（tao/wry/muda/openharmony-ability）内部职责，不是应用开发者的
- 静默跳过是默认降级策略（与 Windows/macOS 一致）
- 三个版本检测 API：`sdk_api_version()`（OpenHarmony 底座）/ `distribution_api_version()`（HarmonyOS 发行版）/ `can_i_use()`（硬件能力）
- 组合检查时先硬件能力后软件版本

完整的决策矩阵、版本号计算、6 种降级模式代码示例，参见 [ohos-version-isolation Skill](../ohos-version-isolation/SKILL.md)。

## 完整约束参考

详见 [`ohos-constraints.md`](ohos-constraints.md)。
