# OpenHarmony 特有功能

## 目录
- [env.load()](#envload)
- [env.load_with_info()](#envload_with_info)
- [Module 类型](#module-类型)
- [spawn_with_qos](#spawn_with_qos)
- [run_script](#run_script)
- [平台差异](#平台差异)
- [ArkVM 注意事项](#arkvm-注意事项)

---

## env.load()

加载 ArkTS 内置模块或用户模块。

### 基本用法

```rust
use napi_ohos::{Env, Result};
use napi_derive_ohos::napi;

#[napi]
pub fn load_hilog(env: &Env) -> Result<()> {
    let hilog = env.load("@ohos.hilog")?;
    // 使用 hilog 模块
    Ok(())
}
```

### 常用内置模块

| 模块 | 说明 |
|------|------|
| `@ohos.hilog` | 日志系统 |
| `@ohos.file.fs` | 文件系统 |
| `@ohos.net.http` | HTTP 请求 |
| `@ohos.sensor` | 传感器 |

### 示例：使用 hilog

```rust
#[napi]
pub fn log_example(env: &Env) -> Result<()> {
    let hilog = env.load("@ohos.hilog")?;
    // 直接调用模块方法
    hilog.call_without_args::<_, ()>("info")?;
    // 或使用 call 带参数
    hilog.call("info", (0, "MyTag", "Hello from Rust"))?;
    Ok(())
}
```

### 注意事项

- **只能在主线程调用**
- 模块路径使用 `@ohos.*` 格式
- 加载失败会返回 `Error`

---

## env.load_with_info()

带模块信息加载，用于加载用户模块。

### 用法

```rust
#[napi]
pub fn load_user_module(env: &Env) -> Result<()> {
    let module = env.load_with_info(
        "@ohos-rs/crc32",
        "com.example.myapplication/entry",
    )?;
    Ok(())
}
```

### 参数

- `path`: 模块路径
- `info`: 模块信息，通常为 `bundleName/moduleName` 格式

---

## Module 类型

`Module` 表示已加载的模块，位于 `napi_ohos::ohos::Module`。

### 获取导出值

```rust
use napi_ohos::ohos::Module;
use napi_derive_ohos::napi;

// 作为参数接收
#[napi]
pub fn use_module(module: Module) -> napi_ohos::Result<()> {
    // 获取方法/字段
    let name: String = module.get("name")?;

    // 获取子模块
    let logger: Module = module.get("Logger")?;

    // 调用方法（带参数）
    let result: String = module.call("format", (name, "suffix"))?;

    // 调用方法（无参数）
    let version: String = module.call_without_args("getVersion")?;

    Ok(())
}
```

### 创建方式

`Module` 只能通过 `env.load()` 或 `env.load_with_info()` 创建，也可以作为 `#[napi]` 函数的参数接收。

---

## spawn_with_qos

带优先级的异步任务调度，OpenHarmony 特有。

### AsyncWorkQos

```rust
pub enum AsyncWorkQos {
    UserInitiated,   // 最高优先级，用户发起
    Default,         // 默认优先级
    Utility,         // 低优先级，工具类任务
    Background,      // 最低优先级，后台任务
}
```

### 使用

```rust
use napi_ohos::async_work::AsyncWorkQos;

#[napi]
pub fn run_high_priority_task(data: Vec<u8>, env: &Env) -> Result<AsyncWorkPromise<'_, String>> {
    env.spawn_with_qos(
        ProcessTask { data },
        AsyncWorkQos::UserInitiated,
    )
}

#[napi]
pub fn run_background_task(data: Vec<u8>, env: &Env) -> Result<AsyncWorkPromise<'_, String>> {
    env.spawn_with_qos(
        ProcessTask { data },
        AsyncWorkQos::Background,
    )
}
```

### 选择建议

| QoS | 适用场景 |
|-----|---------|
| `UserInitiated` | 用户操作直接相关的计算、即时响应 |
| `Default` | 一般任务 |
| `Utility` | 数据预处理、缓存更新 |
| `Background` | 日志写入、数据同步 |

---

## run_script

执行 JavaScript 脚本。

### 用法

```rust
#[napi]
pub fn execute_script(env: &Env) -> Result<i32> {
    let result: i32 = env.run_script("1 + 2 * 3")?;
    Ok(result)  // 7
}
```

### 返回值类型

可以指定任意实现了 `FromNapiValue` 的类型：

```rust
#[napi]
pub fn get_global_names(env: &Env) -> Result<Vec<String>> {
    let names: Vec<String> = env.run_script("Object.keys(globalThis)")?;
    Ok(names)
}
```

### 限制

- 脚本不能访问模块作用域（没有 `require`）
- 可以访问全局对象
- `var` 声明会添加到全局对象
- `let`/`const` 声明全局可见但不添加到全局对象

### OpenHarmony 特有

在 OpenHarmony 平台上，底层调用的是 `napi_run_script_path` 而非 `napi_run_script`。

---

## 平台差异

### 与 Node.js napi-rs 的差异

| 功能 | Node.js | OpenHarmony |
|------|---------|-------------|
| `napi_adjust_external_memory` | 支持 | 返回 0（无操作） |
| `napi_run_script` | `napi_run_script` | `napi_run_script_path` |
| `napi_create_symbol` | 支持 | 不支持（已隐藏） |
| `napi_get_node_version` | 支持 | 不支持 |
| 外部 Buffer | 支持 | 部分运行时不支持 |
| UV 事件循环 | 支持 | 不支持 |

### 不支持的功能

```rust
// 在 OpenHarmony 上这些 API 不可用或行为不同：
// - napi_get_uv_event_loop
// - napi_create_symbol (已隐藏)
// - napi_get_node_version
```

### 外部内存调整

```rust
// 在 OpenHarmony 上，adjust_external_memory 始终返回 0
#[cfg(any(target_family = "wasm", target_env = "ohos", feature = "arkvm-test"))]
pub fn adjust_external_memory(&self, size: i64) -> Result<i64> {
    Ok(0)
}
```

---

## ArkVM 注意事项

### ArkVM vs V8

| 特性 | V8 (Node.js) | ArkVM (OpenHarmony) |
|------|-------------|---------------------|
| 垃圾回收 | 标记-清除 | 引用计数 + GC |
| 外部 Buffer | 完全支持 | 部分支持 |
| 异常处理 | `napi_pending_exception` | `check_pending_exception!` |
| 模块加载 | `require()` | `@ohos.*` 格式 |

### 异常处理

在 OpenHarmony 上，推荐使用 `check_pending_exception!` 而非 `check_status!`：

```rust
// 推荐
check_pending_exception!(
    env,
    unsafe { napi_sys_ohos::napi_load_module(env, path, &mut module) }
)?;

// 不推荐（可能丢失异常信息）
check_status!(
    unsafe { napi_sys_ohos::napi_load_module(env, path, &mut module) }
)?;
```

---

## 相关文档

- [异步模式](09-async-patterns.md#asyncworkpromise)
- [核心概念](01-core-concepts.md#env-上下文)
