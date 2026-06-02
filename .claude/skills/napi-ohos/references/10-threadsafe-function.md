# 线程安全函数

## 目录
- [概述](#概述)
- [7 个类型参数详解](#7-个类型参数详解)
- [构建器链式 API](#构建器链式-api)
- [调用方法](#调用方法)
- [CalleeHandled 参数详解](#calleehandled-参数详解)
- [完整模式矩阵](#完整模式矩阵)
- [生命周期与资源管理](#生命周期与资源管理)
- [OpenHarmony 特有：优先级调用](#openharmony-特有优先级调用)
- [自定义 GC 机制](#自定义-gc-机制)

---

## 概述

`ThreadsafeFunction` 用于从非 JS 线程安全地调用 JavaScript 函数。

### 使用场景

- 后台线程需要通知 JS 层（如进度更新、事件通知）
- C/Rust 库回调需要转发到 JS
- 多线程数据需要同步到 JS 线程

### 需要 feature

```toml
napi-ohos = { version = "1.2", features = ["napi4"] }
```

---

## 7 个类型参数详解

`ThreadsafeFunction` 有 7 个类型/常量参数，每个参数控制不同的行为：

```rust
pub struct ThreadsafeFunction<
    T: 'static,                                          // 1. 传入数据的类型
    Return: 'static + FromNapiValue = Unknown<'static>,  // 2. JS 回调返回值的类型
    CallJsBackArgs: 'static + JsValuesTupleIntoVec = T,  // 3. 传给 JS 回调的参数类型
    ErrorStatus: AsRef<str> + From<Status> = Status,     // 4. 错误状态类型
    const CalleeHandled: bool = true,                    // 5. 错误是否由被调用方处理
    const Weak: bool = false,                            // 6. 是否为弱引用
    const MaxQueueSize: usize = 0,                       // 7. 最大队列大小
> {
    pub handle: Arc<ThreadsafeFunctionHandle>,
    _phantom: PhantomData<(T, CallJsBackArgs, Return, ErrorStatus)>,
}
```

### 1. `T` — 传入数据的类型

从后台线程通过 `call()` 传递给 `ThreadsafeFunction` 的数据类型。

```rust
// 单个值
ThreadsafeFunction<String, ...>

// 元组（多个值）
ThreadsafeFunction<(u32, bool, String), ...>
```

`T` 必须满足 `'static` 约束，因为数据会被发送到 JS 线程。

### 2. `Return` — JS 回调返回值的类型

JS 回调函数执行后返回的值类型。仅在需要获取 JS 回调返回值时使用。

```rust
// 不关心返回值（默认）
ThreadsafeFunction<String, Unknown<'static>, ...>

// 需要获取返回值
ThreadsafeFunction<String, String, ...>
```

### 3. `CallJsBackArgs` — 传给 JS 回调的参数类型

经过 `build_callback` 中的转换函数处理后，实际传递给 JS 回调的参数类型。

```rust
// 默认与 T 相同（不做转换）
ThreadsafeFunction<String, Unknown<'static>, String, ...>

// 转换后传递（如将复杂数据转为元组）
ThreadsafeFunction<MyData, Unknown<'static>, (u32, String), ...>
```

转换在 `build_callback` 中定义：

```rust
.build_callback(|ctx: ThreadsafeCallContext<MyData>| {
    // ctx.value 是 MyData 类型
    // 返回值决定 CallJsBackArgs
    Ok((ctx.value.id, ctx.value.name))  // CallJsBackArgs = (u32, String)
})
```

### 4. `ErrorStatus` — 错误状态类型

当 `call()` 传入 `Result<T, ErrorStatus>` 时使用的错误类型。

```rust
// 默认使用 Status
ThreadsafeFunction<String, ..., Status, ...>

// 自定义错误类型
ThreadsafeFunction<String, ..., MyError, ...>
```

自定义错误类型需实现 `AsRef<str>` 和 `From<Status>`。

### 5. `CalleeHandled` — 错误处理模式

控制 JS 回调是否接收错误作为第一个参数。

| 值 | 行为 | JS 回调签名 |
|----|------|-------------|
| `true`（默认） | 错误作为第一个参数传给 JS 回调（Node.js 风格） | `(err, ...args) => {}` |
| `false` | 错误直接通过 `napi_fatal_exception` 抛出 | `(...args) => {}` |

详见 [CalleeHandled 参数详解](#calleehandled-参数详解)。

### 6. `Weak` — 弱引用模式

| 值 | 行为 |
|----|------|
| `false`（默认） | ThreadsafeFunction 会阻止事件循环退出 |
| `true` | 不会阻止事件循环退出，适合后台任务 |

```rust
// 弱引用：进程可以在有未完成的 tsfn 调用时退出
callback.build_threadsafe_function()
    .weak::<true>()
    .build_callback(|ctx| Ok(ctx.value))?;
```

### 7. `MaxQueueSize` — 最大队列大小

| 值 | 行为 |
|----|------|
| `0`（默认） | 无限制 |
| `> 0` | 队列满时 `call()` 返回 `Status::QueueFull` |

```rust
// 限制队列大小为 10
callback.build_threadsafe_function()
    .max_queue_size::<10>()
    .build_callback(|ctx| Ok(ctx.value))?;
```

---

## 构建器链式 API

通过 `Function::build_threadsafe_function()` 获取构建器，然后链式配置：

```rust
use napi_ohos::bindgen_prelude::*;
use napi_ohos::threadsafe_function::{
    ThreadsafeFunction, ThreadsafeCallContext,
    ThreadsafeFunctionCallMode, ThreadsafeFunctionPriority,
};
use napi_derive_ohos::napi;

#[napi]
pub fn setup_tsfn(
    callback: Function<'static, String, ()>,
) -> Result<ThreadsafeFunction<String>> {
    callback
        .build_threadsafe_function()
        // 可选配置（可链式组合）
        .max_queue_size::<10>()     // 队列大小限制
        .weak::<true>()             // 弱引用模式
        .callee_handled::<true>()   // 错误处理模式
        // 必须调用 build_callback 或 build
        .build_callback(|ctx: ThreadsafeCallContext<String>| {
            Ok(ctx.value)  // 直接传递原始值
        })
}
```

注意：`ThreadsafeFunction`、`ThreadsafeCallContext`、`ThreadsafeFunctionCallMode`、`ThreadsafeFunctionPriority` 都需要从 `napi_ohos::threadsafe_function` 导入，而非 `bindgen_prelude`。

### 构建器方法

| 方法 | 默认值 | 说明 |
|------|--------|------|
| `max_queue_size::<N>()` | `0`（无限制） | 设置最大队列大小 |
| `weak::<W>()` | `false` | 设置是否为弱引用 |
| `callee_handled::<C>()` | `true` | 设置错误是否由被调用方处理 |
| `error_status::<E>()` | `Status` | 设置错误状态类型 |
| `build_callback(cb)` | — | 构建并设置转换回调 |
| `build()` | — | 构建（仅当 `T` 实现了 `JsValuesTupleIntoVec` 时可用） |

### build_callback vs build

- `build_callback(cb)`：设置转换函数，`cb` 将 `T` 转换为 `CallJsBackArgs`
- `build()`：当 `T` 本身就可以作为 JS 参数时使用（`T: JsValuesTupleIntoVec`），无需转换

```rust
// 使用 build_callback（需要转换）
.build_callback(|ctx: ThreadsafeCallContext<MyData>| {
    Ok((ctx.data.id, ctx.data.name))
})

// 使用 build（T 本身就是元组等可转换类型）
.build()
```

---

## 调用方法

### call — 基本调用

```rust
// CalleeHandled = true（默认）
tsfn.call(Ok("hello".to_string()), ThreadsafeFunctionCallMode::Blocking);

// 传递错误（CalleeHandled = true 时，错误会作为第一个参数传给 JS）
tsfn.call(Err(Status::GenericFailure), ThreadsafeFunctionCallMode::NonBlocking);
```

`ThreadsafeFunctionCallMode`：

| 模式 | 说明 |
|------|------|
| `Blocking` | 阻塞等待 JS 回调执行完成 |
| `NonBlocking` | 不阻塞，立即返回 |

### call_with_return_value — 带返回值回调

获取 JS 回调的返回值，在后台线程处理：

```rust
tsfn.call_with_return_value(
    Ok("hello".to_string()),
    ThreadsafeFunctionCallMode::Blocking,
    |result: Result<String>, env: Env| {
        match result {
            Ok(value) => eprintln!("JS returned: {}", value),
            Err(e) => eprintln!("JS callback error: {}", e),
        }
        Ok(())
    },
);
```

### call_async — 异步等待返回值

在 `async` 函数中使用，await JS 回调的返回值：

```rust
#[napi]
pub async fn async_tsfn_example(tsfn: ThreadsafeFunction<String, String>) -> Result<String> {
    let result = tsfn.call_async(Ok("hello".to_string())).await?;
    Ok(result)
}
```

注意：`call_async` 内部使用 `NonBlocking` 模式，通过 oneshot channel 等待返回值。

---

## CalleeHandled 参数详解

`CalleeHandled` 控制错误传递方式，这是 `ThreadsafeFunction` 最核心也最容易混淆的参数。

### CalleeHandled = true（默认）

错误作为第一个参数传递给 JS 回调（遵循 Node.js 回调约定）：

```rust
// Rust 侧
tsfn.call(Err(Status::GenericFailure), ThreadsafeFunctionCallMode::Blocking);

// JS 侧 — 回调签名: (err, ...args)
(err, data) => {
    if (err) {
        console.error("Error:", err);
        return;
    }
    console.log("Data:", data);
}
```

当 Rust 侧传入 `Ok(data)` 时，JS 回调收到 `(null, data)`。
当 Rust 侧传入 `Err(e)` 时，JS 回调收到 `(Error, undefined)`。

### CalleeHandled = false

错误不传递给 JS 回调，而是通过 `napi_fatal_exception` 直接抛出：

```rust
// Rust 侧 — 注意 call 签名不同，不接受 Result
tsfn.call("hello".to_string(), ThreadsafeFunctionCallMode::Blocking);

// JS 侧 — 回调签名: (...args)，没有 err 参数
(data) => {
    console.log("Data:", data);
}
```

如果 Rust 侧的转换回调（`build_callback` 中的闭包）返回错误，该错误会通过 `napi_fatal_exception` 抛出，触发进程的 `uncaughtException`。

### 对比表

| 特性 | CalleeHandled = true | CalleeHandled = false |
|------|---------------------|----------------------|
| `call()` 签名 | `call(Result<T, ErrorStatus>, mode)` | `call(T, mode)` |
| JS 回调签名 | `(err, ...args)` | `(...args)` |
| 错误传递 | 作为第一个参数传给 JS | 通过 `fatal_exception` 抛出 |
| 适用场景 | 需要 JS 侧处理错误 | 错误应该终止进程 |

---

## 完整模式矩阵

以下是常见场景的推荐配置：

### 场景 1：简单事件通知（最常见）

```rust
ThreadsafeFunction<String>
// 等价于:
// T = String
// Return = Unknown<'static>
// CallJsBackArgs = String
// ErrorStatus = Status
// CalleeHandled = true
// Weak = false
// MaxQueueSize = 0
```

### 场景 2：后台任务进度回调

```rust
// 弱引用 + 限制队列大小
callback
    .build_threadsafe_function()
    .weak::<true>()
    .max_queue_size::<5>()
    .build_callback(|ctx: ThreadsafeCallContext<Progress>| {
        Ok((ctx.value.percent, ctx.value.message))
    })?;
// ThreadsafeFunction<Progress, Unknown, (u32, String)>
```

### 场景 3：需要获取 JS 回调返回值

```rust
callback
    .build_threadsafe_function()
    .build_callback(|ctx: ThreadsafeCallContext<String>| {
        Ok(ctx.value)
    })?;
// ThreadsafeFunction<String, String, String>

// 使用 call_async 获取返回值
let result = tsfn.call_async(Ok("data".to_string())).await?;
```

### 场景 4：不需要错误处理（CalleeHandled = false）

```rust
callback
    .build_threadsafe_function()
    .callee_handled::<false>()
    .build_callback(|ctx: ThreadsafeCallContext<String>| {
        Ok(ctx.value)
    })?;
// ThreadsafeFunction<String, Unknown, String, Status, false>

// call 直接传值，不需要 Result
tsfn.call("hello".to_string(), ThreadsafeFunctionCallMode::Blocking);
```

### 场景 5：数据转换

```rust
#[napi]
pub struct ComplexData {
    pub id: u32,
    pub name: String,
    pub tags: Vec<String>,
}

callback
    .build_threadsafe_function()
    .build_callback(|ctx: ThreadsafeCallContext<ComplexData>| {
        // 将 ComplexData 转换为 JS 友好的元组
        Ok((ctx.value.id, ctx.value.name, ctx.value.tags))
    })?;
// ThreadsafeFunction<ComplexData, Unknown, (u32, String, Vec<String>)>
```

---

## 生命周期与资源管理

### 自动释放

当所有 `ThreadsafeFunction` 的引用被 drop 时，底层资源会自动释放。不需要手动调用释放方法。

```rust
{
    let tsfn = callback.build_threadsafe_function()
        .build_callback(|ctx| Ok(ctx.value))?;
    
    // 使用 tsfn...
} // tsfn drop，资源自动释放
```

### clone

`ThreadsafeFunction` 内部使用 `Arc<ThreadsafeFunctionHandle>`，可以安全地 clone 并在多线程间共享：

```rust
let tsfn = callback.build_threadsafe_function()
    .build_callback(|ctx| Ok(ctx.value))?;

let tsfn_clone = tsfn.clone();

std::thread::spawn(move || {
    tsfn_clone.call(Ok("from thread".to_string()), ThreadsafeFunctionCallMode::NonBlocking);
});
```

### aborted 检查

```rust
if tsfn.aborted() {
    // ThreadsafeFunction 已被释放，不应再调用
    return;
}
```

### abort（已废弃）

```rust
#[deprecated]
tsfn.abort()?;  // 不推荐使用，drop 即可
```

---

## OpenHarmony 特有：优先级调用

在 OpenHarmony 平台上，可以使用 `call_with_priority` 指定调用优先级。

### ThreadsafeFunctionPriority

```rust
pub enum ThreadsafeFunctionPriority {
    Immediate,  // 最高优先级，立即执行
    High,       // 高优先级
    Low,        // 低优先级
    Idle,       // 空闲时执行
}
```

### 使用

```rust
use napi_ohos::threadsafe_function::ThreadsafeFunctionPriority;

// 高优先级调用
tsfn.call_with_priority(
    Ok("urgent".to_string()),
    ThreadsafeFunctionPriority::High,
);

// 低优先级调用（不影响主线程性能）
tsfn.call_with_priority(
    Ok("background".to_string()),
    ThreadsafeFunctionPriority::Idle,
);
```

### 选择建议

| 优先级 | 适用场景 |
|--------|---------|
| `Immediate` | 紧急事件、崩溃报告 |
| `High` | 用户交互反馈、UI 更新 |
| `Low` | 日志写入、数据统计 |
| `Idle` | 后台同步、缓存清理 |

---

## 自定义 GC 机制

napi-ohos 在模块注册时会自动创建 CustomGC ThreadsafeFunction，用于在非主线程创建的 Buffer/ArrayBuffer 的引用回收。

### 机制

1. 非主线程创建的 Buffer 引用会被记录
2. CustomGC 将这些引用切换到主线程
3. 在主线程上安全地 unref 和 delete reference

### 对用户的影响

通常不需要手动处理，但需要注意：
- 在后台线程创建的 Buffer 会在适当的时机被回收
- 如果进程快速退出，可能来不及回收（但不会影响正确性）

---

## 相关文档

- [异步模式](09-async-patterns.md)
- [核心概念](01-core-concepts.md#生命周期管理)
- [OpenHarmony 特有功能](11-ohos-specific.md#spawn_with_qos)
