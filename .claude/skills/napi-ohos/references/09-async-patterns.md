# 异步模式

## 目录
- [tokio_rt feature](#tokio_rt-feature)
- [async fn 导出](#async-fn-导出)
- [Task trait](#task-trait)
- [ScopedTask trait](#scopedtask-trait)
- [AsyncWorkPromise](#asyncworkpromise)
- [spawn_future](#spawn_future)
- [spawn_future_with_callback](#spawn_future_with_callback)
- [create_deferred](#create_deferred)
- [PromiseRaw](#promiseraw)
- [自定义 Tokio 运行时](#自定义-tokio-运行时)
- [AsyncBlockBuilder](#asyncblockbuilder)
- [ohos-ffrt 替代方案](#ohos-ffrt-替代方案)

---

## tokio_rt feature

启用 tokio 异步运行时：

```toml
[dependencies]
napi-ohos = { version = "1.2", features = ["tokio_rt", "napi4"] }
tokio = { version = "1", features = ["full"] }
```

### 运行时生命周期

启用 `tokio_rt` 后，napi-ohos 会：
1. 在模块注册时（`napi_register_module_v1`）自动启动 tokio 多核运行时
2. 在模块卸载时自动关闭运行时
3. 提供 `spawn_future` 等方法直接在 JS 线程返回 Promise

### 运行时架构

```
┌─────────────────────────────────────────────┐
│              JS 主线程 (ArkVM)               │
│  #[napi] async fn → 返回 Promise             │
│  spawn_future → 返回 PromiseRaw              │
│  resolve/reject/finalize 回调在此执行         │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│         Tokio 运行时 (独立线程池)             │
│  async fn 的 .await 在此执行                  │
│  spawn_blocking 闭包在此执行                  │
└─────────────────────────────────────────────┘
```

### 关键约束

- **不要在 async fn 中持有 `Env` 跨越 `.await`**，因为 `Env` 不是 `Send`
- 如果需要在 `.await` 后使用 `Env`，使用 `spawn_future_with_callback`
- 多线程 tokio 在非 WASM 平台上使用 `new_multi_thread()`，WASM 上使用 `new_current_thread()`

---

## async fn 导出

最简单的异步模式，直接返回 Promise。

### 基本用法

```rust
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

#[napi]
pub async fn read_file(path: String) -> Result<Buffer> {
    Ok(tokio::fs::read(path).await?.into())
}

#[napi]
pub async fn fetch_data(url: String) -> Result<String> {
    let response = reqwest::get(&url).await?;
    Ok(response.text().await?)
}
```

JS 使用：
```js
const content = await readFile('./config.json');
const data = await fetchData('https://api.example.com/data');
```

### 底层机制

`#[napi] async fn` 被宏展开为：
1. 创建一个 `JsDeferred`
2. 将 async block 发送到 tokio 运行时
3. 如果 future panic，自动 reject Promise
4. 如果 future resolve，调用 resolver 将结果转换回 JS 值

### 注意事项

- 需要 `tokio_rt` + `napi4` feature
- `async fn` 自动返回 JavaScript Promise
- 函数体中可以使用任何 `await` 表达式
- **不能**在 async fn 中直接使用 `Env`（因为 `Env` 不是 `Send`）

---

## Task trait

`Task` trait 用于在后台线程池中执行 CPU 密集型任务，与 JS 线程分离。

### 定义

```rust
pub trait Task: Send + Sized {
    type Output: Send + Sized + 'static;   // compute 的返回值
    type JsValue: ToNapiValue + TypeName;  // 最终返回给 JS 的值

    fn compute(&mut self) -> Result<Self::Output>;
    fn resolve(&mut self, env: Env, output: Self::Output) -> Result<Self::JsValue>;
    fn reject(&mut self, env: Env, err: Error) -> Result<Self::JsValue>;  // 可选
    fn finally(self, env: Env) -> Result<()>;                              // 可选
}
```

### 执行流程

```
JS 线程调用 env.spawn(task)
    │
    ▼
┌─────────────────────────────────────────┐
│ 后台线程池                               │
│   compute()  ← 在此执行 CPU 密集型计算    │
│   如果 panic，错误被捕获并传递到 reject   │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│ JS 线程                                  │
│   resolve(env, output)  ← compute 成功   │
│   或 reject(env, err)   ← compute 失败   │
│   或 finally(env)        ← resolve/reject 后执行
│   最终返回 Promise<JsValue>              │
└─────────────────────────────────────────┘
```

### 完整实现

```rust
use napi_ohos::{Env, Result, Error, Task};
use napi_derive_ohos::napi;

pub struct HashTask {
    data: Vec<u8>,
    algorithm: String,
}

impl Task for HashTask {
    type Output = Vec<u8>;        // compute 返回的中间结果
    type JsValue = String;        // 最终返回给 JS 的值

    // 在后台线程执行
    fn compute(&mut self) -> Result<Self::Output> {
        // CPU 密集型计算
        match self.algorithm.as_str() {
            "sha256" => Ok(sha2::Sha256::digest(&self.data).to_vec()),
            "md5" => Ok(md5::compute(&self.data).to_vec()),
            _ => Err(Error::new(
                napi_ohos::Status::InvalidArg,
                format!("Unknown algorithm: {}", self.algorithm),
            )),
        }
    }

    // 在 JS 线程执行，compute 成功时调用
    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(hex::encode(output))
    }

    // 在 JS 线程执行，compute 失败时调用（可选，默认直接传播错误）
    fn reject(&mut self, _env: Env, err: Error) -> Result<Self::JsValue> {
        // 可以将错误转换为其他 JS 值，或者直接返回 Err
        Err(err)
    }

    // 在 JS 线程执行，resolve 或 reject 之后调用（可选）
    fn finally(self, _env: Env) -> Result<()> {
        eprintln!("HashTask completed for algorithm: {}", self.algorithm);
        Ok(())
    }
}

#[napi]
pub fn compute_hash(data: Buffer, algorithm: String, env: &Env) -> Result<AsyncWorkPromise<'_, String>> {
    env.spawn(HashTask {
        data: data.to_vec(),
        algorithm,
    })
}
```

### 何时使用 Task vs async fn

| 场景 | 推荐方式 |
|------|---------|
| IO 操作（文件、网络） | `async fn` |
| CPU 密集型计算 | `Task` |
| 需要调用阻塞的 C 库函数 | `Task` |
| 需要精细控制 resolve/reject 逻辑 | `Task` |
| 简单的异步操作 | `async fn` |

---

## ScopedTask trait

`ScopedTask<'task>` 是 `Task` 的泛化版本，支持带生命周期的返回值。

### 与 Task 的区别

| 特性 | Task | ScopedTask<'task> |
|------|------|-------------------|
| 生命周期 | 无约束 | 带 `'task` 生命周期 |
| resolve 返回值 | `Result<Self::JsValue>` | `Result<Self::JsValue>`（可带生命周期） |
| 适用场景 | 通用场景 | 需要返回带生命周期的 JS 值 |

### 实现

```rust
use napi_ohos::{Env, Result, ScopedTask};

pub struct MyScopedTask {
    data: Vec<u8>,
}

impl<'task> ScopedTask<'task> for MyScopedTask {
    type Output = Vec<u8>;
    type JsValue = Buffer;  // Buffer 带生命周期

    fn compute(&mut self) -> Result<Self::Output> {
        // 后台线程中的计算
        Ok(self.data.clone())
    }

    fn resolve(&mut self, _env: &'task Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output.into())
    }

    fn reject(&mut self, _env: &'task Env, err: Error) -> Result<Self::JsValue> {
        Err(err)
    }

    fn finally(self, _env: Env) -> Result<()> {
        Ok(())
    }
}
```

注意：所有 `Task` 自动实现了 `ScopedTask`，所以通常直接使用 `Task` 即可。

---

## AsyncWorkPromise

`AsyncWorkPromise` 是 `env.spawn()` 返回的 Promise 类型。

### 创建

```rust
#[napi]
pub fn run_task(data: Vec<u8>, env: &Env) -> Result<AsyncWorkPromise<'_, String>> {
    env.spawn(ProcessTask { data })
}
```

### 方法

```rust
impl<T> AsyncWorkPromise<T> {
    // 获取底层 PromiseRaw 对象
    pub fn promise_object<'env>(&self) -> PromiseRaw<'env, T>;

    // 取消异步任务（必须在主线程调用）
    pub fn cancel(&mut self) -> Result<()>;
}
```

### 取消任务

```rust
#[napi]
pub fn cancellable_task(env: &Env) -> Result<AsyncWorkPromise<'_, String>> {
    let mut promise = env.spawn(LongRunningTask)?;

    // 可以在后续某个时间点取消
    // promise.cancel()?;

    Ok(promise)
}
```

取消后，Promise 会被 reject 为一个 `AbortError`。

### OpenHarmony QoS

在 OpenHarmony 平台上，可以使用 `spawn_with_qos` 指定任务优先级：

```rust
use napi_ohos::async_work::AsyncWorkQos;

#[napi]
pub fn run_with_priority(data: Vec<u8>, env: &Env) -> Result<AsyncWorkPromise<'_, String>> {
    env.spawn_with_qos(ProcessTask { data }, AsyncWorkQos::UserInitiated)
}
```

详见 [OpenHarmony 特有功能](11-ohos-specific.md#spawn_with_qos)。

---

## spawn_future

直接在 tokio 运行时中执行 Future，返回 Promise。

### 基本用法

```rust
use napi_ohos::{Env, Result};
use napi_derive_ohos::napi;

#[napi]
pub fn async_operation(env: &Env) -> Result<PromiseRaw<'_, String>> {
    env.spawn_future(async {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        Ok("Done!".to_string())
    })
}
```

### 与 async fn 的区别

| 方式 | 使用场景 |
|------|---------|
| `#[napi] async fn` | 简单场景，函数本身就是异步 |
| `spawn_future` | 需要在同步函数中启动异步操作 |

### 与 Task 的区别

| 方式 | 执行位置 | 适用场景 |
|------|---------|---------|
| `Task::compute` | 后台线程池（非 tokio） | CPU 密集型计算 |
| `spawn_future` | tokio 运行时 | IO 密集型、需要 await 的操作 |

---

## spawn_future_with_callback

Future 完成后可访问 `Env`。

### 用法

```rust
#[napi]
pub fn async_with_callback(env: &Env) -> Result<PromiseRaw<'_, Object<'static>>> {
    env.spawn_future_with_callback(
        async {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            Ok(vec![1, 2, 3, 4, 5])
        },
        |env, data| {
            let mut obj = Object::new()?;
            obj.set("sum", data.iter().sum::<i32>())?;
            obj.set("count", data.len())?;
            obj.set("data", data)
        },
    )
}
```

### 回调签名

```rust
FnOnce(&'env Env, T) -> Result<V>
```

- `env`: 当前环境的引用，生命周期为 `'env`
- `T`: Future 的输出
- `V`: 要返回给 JS 的值

### 何时使用

当你需要在 async 操作完成后创建 JS 对象时使用：

```rust
#[napi]
pub fn create_result_after_delay(env: &Env) -> Result<PromiseRaw<'_, Object<'static>>> {
    env.spawn_future_with_callback(
        async {
            // 执行异步操作
            Ok(())
        },
        |env, ()| {
            // 在 JS 线程创建对象
            Object::new()
        },
    )
}
```

---

## create_deferred

手动控制 Promise 的 resolve/reject。

### 用法

```rust
use napi_ohos::{Env, Result, JsDeferred, Error, Status};
use napi_derive_ohos::napi;

#[napi]
pub fn create_deferred_example(env: &Env) -> Result<Object<'_>> {
    let (deferred, promise) = env.create_deferred::<String, fn(Env) -> Result<String>>()?;

    // 在后台线程中执行
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(1));
        // resolve: 提供一个回调函数，在 JS 线程执行
        deferred.resolve(|_env| Ok("Done!".to_string()));
        // 或 reject:
        // deferred.reject(Error::new(Status::GenericFailure, "Failed"));
    });

    // 返回 promise 给 JS
    Ok(promise)
}
```

### JsDeferred API

```rust
use napi_ohos::JsDeferred;

pub struct JsDeferred<Data: ToNapiValue, Resolver: FnOnce(Env) -> Result<Data>> {
    // ...
}

impl<Data, Resolver> JsDeferred<Data, Resolver> {
    pub fn resolve(self, resolver: Resolver);
    pub fn reject(self, error: Error);
}
```

### 注意事项

- `resolve` 的回调函数在 **JS 线程** 执行，可以安全访问 JS API
- `reject` 直接抛出错误
- `JsDeferred` 和 `promise`（Object）可以从不同线程使用
- `JsDeferred` 内部使用 ThreadsafeFunction 实现跨线程通信

---

## PromiseRaw

原始 Promise 类型，带类型参数。

### 使用

```rust
#[napi]
pub fn returns_promise(env: &Env) -> Result<PromiseRaw<'_, i32>> {
    env.spawn_future(async {
        Ok(42)
    })
}
```

### PromiseRaw 方法

```rust
impl<'env, T: ToNapiValue> PromiseRaw<'env, T> {
    // 创建一个已 resolve 的 Promise
    pub fn resolve(env: &Env, value: T) -> Result<Self>;

    // 创建一个已 reject 的 Promise
    pub fn reject<E: ToNapiValue>(env: &Env, error: E) -> Result<Self>;

    // .then() 链式调用
    pub fn then<'then, Callback, U>(&self, cb: Callback) -> Result<PromiseRaw<'env, U>>;

    // .catch() 链式调用
    pub fn catch<'catch, E, U, Callback>(&self, cb: Callback) -> Result<PromiseRaw<'env, U>>;

    // .finally() 链式调用
    pub fn finally<'finally, U, Callback>(&mut self, cb: Callback) -> Result<PromiseRaw<'env, T>>;

    // 转为可 await 的 Promise<T>
    pub fn into_sendable_promise(self) -> Result<Promise<T>>;
}
```

### Promise<T> (可 await)

`Promise<T>` 是可以从 JS 接收并在 Rust 中 await 的 Promise 类型：

```rust
use napi_ohos::bindgen_prelude::Promise;

#[napi]
pub async fn await_js_promise(promise: Promise<String>) -> Result<String> {
    let value = promise.await?;
    Ok(format!("Resolved: {}", value))
}
```

注意：`Promise<T>` 不能传回给 JS，只能用于接收和 await。如需传回 JS，使用 `PromiseRaw`。

---

## 自定义 Tokio 运行时

napi-ohos 允许你提供自定义的 Tokio 运行时。

### 使用场景

- 需要控制线程数量
- 需要自定义线程栈大小
- 需要集成现有的 tokio 运行时

### 配置

```rust
use napi_ohos::create_custom_tokio_runtime;
use napi_derive_ohos::module_init;
use tokio::runtime::Builder;

#[module_init]
fn init() {
    let rt = Builder::new_multi_thread()
        .enable_all()
        .thread_stack_size(32 * 1024 * 1024)  // 32MB 栈
        .worker_threads(4)
        .build()
        .unwrap();
    create_custom_tokio_runtime(rt);
}
```

### 运行时工具函数

```rust
use napi_ohos::tokio_runtime::{spawn, spawn_blocking, block_on, within_runtime_if_available};

// 在 tokio 运行时中 spawn 一个 future
spawn(async {
    // ...
});

// 在 tokio 阻塞线程池中运行闭包
let handle = spawn_blocking(|| {
    // CPU 密集型操作
    42
});

// 阻塞等待 future 完成（谨慎使用，会阻塞 JS 线程）
let result = block_on(async {
    tokio::fs::read("file.txt").await
});

// 在 tokio 运行时上下文中执行闭包
let result = within_runtime_if_available(|| {
    // 这里可以调用 tokio API
    tokio::runtime::Handle::current()
});
```

### 运行时生命周期管理

```rust
use napi_ohos::tokio_runtime::{start_async_runtime, shutdown_async_runtime};

// 手动启动运行时（Electron 热重载场景）
start_async_runtime();

// 手动关闭运行时
shutdown_async_runtime();
```

---

## AsyncBlockBuilder

`AsyncBlockBuilder` 提供了一种更灵活的方式来构建异步操作，支持 dispose 回调。

### 基本用法

```rust
use napi_ohos::tokio_runtime::AsyncBlockBuilder;
use napi_derive_ohos::napi;

#[napi]
pub fn async_block_example(env: &Env) -> Result<AsyncBlock<String>> {
    AsyncBlockBuilder::new(async {
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        Ok("result".to_string())
    })
    .build(env)
}
```

### 带 dispose 回调

```rust
#[napi]
pub fn async_with_dispose(env: &Env) -> Result<AsyncBlock<String>> {
    AsyncBlockBuilder::with(async {
        // 异步操作
        Ok("result".to_string())
    })
    .with_dispose(|env| {
        // 在 Promise resolve/reject 后执行的清理逻辑
        eprintln!("Async operation completed");
        Ok(())
    })
    .build(env)
}
```

### 带值转换

```rust
#[napi]
pub fn async_with_map(env: &Env) -> Result<AsyncBlock<Object<'static>>> {
    AsyncBlockBuilder::build_with_map(
        env,
        async {
            Ok(vec![1, 2, 3])
        },
        |env, data| {
            let mut obj = Object::new()?;
            obj.set("values", data)?;
            Ok(obj)
        },
    )
}
```

---

## ohos-ffrt 替代方案

对于不需要完整 tokio 运行时的场景，可以使用 [ohos-ffrt](https://github.com/ohos-rs/ohos-ffrt) 作为轻量级异步运行时。

### 对比

| 特性 | tokio | ohos-ffrt |
|------|-------|-----------|
| 大小 | 较大 | 轻量 |
| 功能 | 完整（网络、IO、定时器等） | 基础异步 |
| 适用场景 | 复杂异步逻辑 | 简单后台任务 |

---

## 相关文档

- [线程安全函数](10-threadsafe-function.md)
- [OpenHarmony 特有功能](11-ohos-specific.md#spawn_with_qos)
- [构建与配置](12-build-and-setup.md#feature-flags)
