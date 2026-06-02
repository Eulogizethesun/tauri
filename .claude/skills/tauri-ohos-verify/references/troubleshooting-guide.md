# OHOS 问题排查指南

## 日志获取方法

> **命令前缀说明**：所有命令均在宿主机通过 `hdc shell` 转发到设备执行。为简洁，hilog 命令简写为 `hdc shell hilog ...`，读取设备文件简写为 `hdc shell "cat ..."`。

### 缓存日志（hilog -x）
```bash
# 先清理缓冲区，再读取缓存中的历史日志
hdc shell hilog -r
hdc shell "hilog -x | grep '关键词'"

# Rust 日志（domain 为 A00000，tag 为 tauritest）
hdc shell "hilog -x | grep 'A00000'"
hdc shell "hilog -x | grep 'tauritest'"
```
> **注意**：`-x` 读取的是 hilog 缓冲区中的缓存日志，缓冲区有容量上限（通常几百 KB），日志量大时早期日志会被覆盖丢失。适合问题刚发生后快速捞取。

### 实时流式日志（hilog）
```bash
# 直接启动 hilog，实时监听设备输出（Ctrl+C 停止）
hdc shell "hilog | grep '关键词'"
hdc shell "hilog | grep 'A00000'"
```
> **注意**：不带 `-x` 的 `hilog` 是流式实时监听，不会漏日志，适合在触发问题前启动，完整捕获问题发生过程。缓冲区溢出场景下优先使用此方式。

### Freeze 日志（主线程阻塞 3s+）
```bash
hdc shell "ls -lt /data/log/faultlog/faultlogger/ | grep appfreeze | head -5"
hdc shell "cat /data/log/faultlog/faultlogger/appfreeze-最新文件名"
```

### Crash 日志
```bash
# JS crash
hdc shell "ls -lt /data/log/faultlog/faultlogger/ | grep jscrash.*tauri | head -5"
hdc shell "cat /data/log/faultlog/faultlogger/jscrash-com.tauri.api-最新文件名"

# C++ crash
hdc shell "ls -lt /data/log/faultlog/faultlogger/ | grep cppcrash.*tauri | head -5"
hdc shell "cat /data/log/faultlog/faultlogger/cppcrash-com.tauri.api-最新文件名"
```

### hilog 归档文件
```bash
hdc shell "ls -lt /data/log/hilog/ | grep -v hilog_kmsg | grep hilog | head -3"
hdc shell "zcat /data/log/hilog/hilog.最新序号.时间戳.gz | grep 关键词"
```

## 常见失败模式

### 1. 死锁 / Freeze

**现象**：应用无响应，3s 后出现 appfreeze 日志

**排查路径**：
1. 查看 appfreeze 日志中的线程堆栈
2. 检查是否有 `run_on_main_thread` + `rx.recv()` 模式
3. 检查是否有全局 Mutex 在快速连续调用中产生竞态

**解决方案**：
- OHOS 上使用直接执行路径，不走阻塞模式
- TSFN 数据独立 Box 入队

### 2. 静默无效果

**现象**：调用 API 无效果，不报错，hilog 中无异常

**排查路径**：
1. 检查 NAPI 函数名是否使用了 camelCase
2. 检查是否在 `render()` 上下文中调用了 `Function::call()`
3. 检查 `statusBarManager.on()` 是否在 `addToStatusBar` 后 200ms 注册

**解决方案**：
- ArkTS 中一律用 camelCase 调用 NAPI 函数
- 用 `Object::set()` 设置属性，让 JS 侧延迟读取

### 3. 语义反转

**现象**：导航被错误拦截或放行

**排查路径**：
1. 检查 `onLoadIntercept` 返回值
2. 确认是否需要 `!ret` 反转

**解决方案**：OHOS `onLoadIntercept` 返回 `true` = 拦截，Tauri `on_navigation` 返回 `true` = 允许

### 4. 编译失败

**常见原因**：
- Linux 依赖未加 `not(target_env = "ohos")` 排除
- 遗漏 `cfg(target_env = "ohos")` gate
- `mock_runtime` 模块在 OHOS 上编译（应排除）

### 5. ArkTS 运行时异常

**常见原因**：
- 模块级 `@Builder` 中访问 `this`（undefined）
- Rust 创建窗口早于 ArkTS controller 就绪（需要 ProxyJsHelper）
- `setColorMode` 同步调用导致死锁（需要 setTimeout）

## 分层定位策略

```
问题出现
    │
    ├── hilog 中有 Rust 层报错？
    │   └── 是 → 检查 cfg gate、NAPI 调用参数、线程模型
    │
    ├── hilog 中有 ArkTS 层报错？
    │   └── 是 → 检查组件生命周期、事件注册、类型错误
    │
    ├── faultlog 中有 freeze/crash？
    │   └── 是 → 查看堆栈，定位死锁或空指针
    │
    └── 无任何报错但无效果？
        └── 大概率静默失败 → 检查 NAPI 函数名、render 上下文
```
