# OHOS 适配审计清单

> 所有 task 实现完成后，逐项检查以下清单。

## 1. Spec 符合性

- [ ] design.md 中定义的每个功能点都已实现
- [ ] 不支持的 API 按设计做了 stub/fallback
- [ ] 接口签名与 spec 一致
- [ ] tasks.md 中所有 task 已标记为 `[x]`

## 2. OHOS API 正确性

- [ ] NAPI 调用方式正确（使用 arkts-helper find_docs/ask_ai 核对）
- [ ] ArkTS 代码符合 ArkUI 框架规范
- [ ] `@Builder` 在 `@Component` 内（需要 `this` 时）
- [ ] `onLoadIntercept` 返回值已正确反转（`!ret`）
- [ ] 异步竞态已处理（ProxyJsHelper 或 WindowManager 队列）

## 3. 约束遵守

### cfg 隔离
- [ ] OHOS 特有代码使用 `cfg(target_env = "ohos")` 或组合
- [ ] Linux 依赖加了 `not(target_env = "ohos")` 排除
- [ ] desktop/mobile 区分使用 `cfg(all(target_env = "ohos", desktop/mobile))`

### NAPI/TSFN
- [ ] ArkTS 中 NAPI 函数名使用 camelCase
- [ ] TSFN 使用 `callee_handled::<false>()`
- [ ] TSFN 数据通过泛型参数携带，非全局 Mutex
- [ ] `FnArgs<>` 包装 tuple 参数

### 线程模型
- [ ] 无 `run_on_main_thread + rx.recv()` 阻塞模式
- [ ] Mutex 未跨越阻塞 I/O 操作持有
- [ ] `Function::call()` 未在 `render()` 上下文中调用

### ArkTS 框架
- [ ] WebView 事件在 `@Builder` 内 pre-build 注册
- [ ] 多窗口状态使用 `@LocalStorageProp` 隔离（FloatPage）

## 4. 平台隔离

- [ ] Windows/macOS/Linux 原有实现未受影响
- [ ] 无遗漏的 cfg gate（`git diff` 检查非 OHOS 路径）
- [ ] 其他平台的编译未受影响（`cargo check` 在 Windows/Linux 通过）

## 5. 新通用约束

- [ ] 本次实现未发现新的 OHOS 通用约束
- [ ] 如有发现，已记录并建议更新 [`ohos-constraints.md`](../../tauri-ohos-design/references/ohos-constraints.md)
