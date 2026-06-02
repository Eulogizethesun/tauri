# 错误处理

## 目录
- [Error 与 Result](#error-与-result)
- [Status 枚举](#status-枚举)
- [check_status! 宏](#check_status-宏)
- [check_pending_exception! 宏](#check_pending_exception-宏)
- [JsError 类型](#jserror-类型)
- [抛出错误](#抛出错误)
- [throw_into](#throw_into)
- [create_error](#create_error)
- [fatal_error/fatal_exception](#fatal_errorfatal_exception)
- [anyhow 集成](#anyhow-集成)

---

## Error 与 Result

### Error 结构

```rust
pub struct Error<S: AsRef<str> = Status> {
    pub status: S,           // 错误状态码
    pub reason: String,      // 错误描述
    pub cause: Option<Box<Error>>,  // 原因链
    pub(crate) maybe_raw: sys::napi_ref,  // 原始 JS Error 引用
    pub(crate) maybe_env: sys::napi_env,
}
```

### Result 类型

```rust
pub type Result<T, S = Status> = std::result::Result<T, Error<S>>;
```

napi-ohos 的 `Result<T>` 是 `std::result::Result<T, Error>` 的别名。

### 创建错误

```rust
use napi_ohos::{Error, Result, Status};

// 使用 Error::new
fn my_function() -> Result<()> {
    Err(Error::new(Status::InvalidArg, "Invalid argument provided"))
}

// 使用 Error::from_status
fn another_function() -> Result<()> {
    Err(Error::from_status(Status::GenericFailure))
}

// 使用 Error::from_reason
fn yet_another() -> Result<()> {
    Err(Error::from_reason("Something went wrong"))
}
```

### 错误链

```rust
let mut error = Error::new(Status::GenericFailure, "Outer error");
let cause = Error::new(Status::InvalidArg, "Inner error");
error.set_cause(cause);
```

---

## Status 枚举

常用状态值：

| 状态 | 说明 |
|------|------|
| `Ok` | 成功 |
| `InvalidArg` | 参数无效 |
| `GenericFailure` | 通用失败 |
| `PendingException` | 有未处理的异常 |
| `Cancelled` | 已取消（AsyncWork 取消时） |
| `QueueFull` | ThreadsafeFunction 队列已满 |
| `Closing` | ThreadsafeFunction 正在关闭 |
| `ArrayExpected` | 期望数组 |
| `StringExpected` | 期望字符串 |
| `NameExpected` | 期望名称 |
| `FunctionExpected` | 期望函数 |
| `NumberExpected` | 期望数字 |
| `ObjectExpected` | 期望对象 |
| `NoExternalBuffersAllowed` | 不允许外部缓冲区 |
| `Unknown` | 未知状态（版本不匹配时） |

---

## check_status! 宏

检查 N-API 调用状态，失败时返回错误。

### 基本用法

```rust
use napi_ohos::{check_status, sys, Result};

fn create_value(env: sys::napi_env) -> Result<sys::napi_value> {
    let mut result = std::ptr::null_mut();
    check_status!(
        unsafe { sys::napi_create_object(env, &mut result) },
        "Failed to create object"
    )?;
    Ok(result)
}
```

### 带格式化消息

```rust
check_status!(
    unsafe { sys::napi_get_named_property(env, obj, name.as_ptr(), &mut result) },
    "Failed to get property '{}'", name
)?;
```

---

## check_pending_exception! 宏

专门用于 OpenHarmony ArkVM 的异常处理。

### 用法

```rust
use napi_ohos::{check_pending_exception, sys, Result};

fn load_module(env: sys::napi_env) -> Result<sys::napi_value> {
    let mut module = std::ptr::null_mut();
    check_pending_exception!(
        env,
        unsafe { sys::napi_load_module(env, path.as_ptr(), &mut module) }
    )?;
    Ok(module)
}
```

### 与 check_status! 的区别

| 宏 | 行为 |
|----|------|
| `check_status!` | 检查返回值是否为 `napi_ok` |
| `check_pending_exception!` | 检查是否有 pending exception，如果有则获取并转换为 `Error` |

在 OpenHarmony 平台上，许多 N-API 调用使用 `check_pending_exception!` 而非 `check_status!`。

---

## check_status_or_throw! 宏

检查状态，失败时抛出错误（不返回）。

```rust
use napi_ohos::check_status_or_throw;

// 在不需要返回错误的场景使用
check_status_or_throw!(
    env,
    unsafe { sys::napi_create_object(env, &mut obj) },
    "Failed to create object"
);
```

---

## JsError 类型

### JsError

将 `Error` 转换为 JS Error 对象并抛出。

```rust
use napi_ohos::JsError;

// 从 Error 创建
let js_error = JsError::from(Error::new(Status::GenericFailure, "Something failed"));

// 抛出
js_error.throw_into(env);
```

### JsTypeError

```rust
use napi_ohos::JsTypeError;

let type_error = JsTypeError::from(Error::new(
    Status::InvalidArg,
    "Expected a string",
));
type_error.throw_into(env);
```

### JsRangeError

```rust
use napi_ohos::JsRangeError;

let range_error = JsRangeError::from(Error::new(
    Status::GenericFailure,
    "Value out of range",
));
range_error.throw_into(env);
```

### JsSyntaxError

需要 `napi9` feature。

```rust
#[cfg(feature = "napi9")]
use napi_ohos::JsSyntaxError;

let syntax_error = JsSyntaxError::from(Error::new(
    Status::GenericFailure,
    "Invalid syntax",
));
syntax_error.throw_into(env);
```

---

## 抛出错误

### Env::throw

抛出任意 JS 值。

```rust
#[napi]
pub fn throw_custom_error(env: &Env) -> Result<()> {
    env.throw("Custom error message")?;
    Err(Error::from_status(Status::GenericFailure))
}
```

### Env::throw_error

抛出 JS Error。

```rust
#[napi]
pub fn throw_error_example(env: &Env) -> Result<()> {
    env.throw_error("Something went wrong", Some("CUSTOM_CODE"))?;
    Err(Error::from_status(Status::GenericFailure))
}
```

### Env::throw_type_error

```rust
#[napi]
pub fn throw_type_error_example(env: &Env) -> Result<()> {
    env.throw_type_error("Invalid type", None)?;
    Err(Error::from_status(Status::GenericFailure))
}
```

### Env::throw_range_error

```rust
#[napi]
pub fn throw_range_error_example(env: &Env) -> Result<()> {
    env.throw_range_error("Value out of range", None)?;
    Err(Error::from_status(Status::GenericFailure))
}
```

### Env::throw_syntax_error

需要 `napi9` feature。

```rust
#[cfg(feature = "napi9")]
#[napi]
pub fn throw_syntax_error_example(env: &Env) {
    env.throw_syntax_error("Invalid syntax", Some("SYNTAX_ERR"));
}
```

---

## throw_into

消费型抛出，消耗 `JsError` 自身。通常在底层代码中使用。

```rust
use napi_ohos::{Env, JsError, Error, Status, Result};

fn throw_custom_error(env: &Env, message: String) {
    let error = Error::new(Status::GenericFailure, message);
    let js_error = JsError::from(error);
    js_error.throw_into(env.raw());
}
```

在 `#[napi]` 函数中，直接返回 `Err(Error)` 即可，不需要手动 `throw_into`。

---

## create_error

创建错误对象但不抛出。

```rust
#[napi]
pub fn create_error_obj(env: &Env) -> Result<Object<'static>> {
    let error = Error::new(Status::GenericFailure, "Custom error");
    env.create_error(error)
}
```

---

## fatal_error/fatal_exception

### fatal_error

立即终止进程。

```rust
#[napi]
pub fn fatal_error_example(env: Env) {
    env.fatal_error("MyModule", "Unrecoverable error occurred");
    // 进程立即终止，后续代码不会执行
}
```

### fatal_exception

触发 `uncaughtException`。

```rust
#[cfg(feature = "napi3")]
#[napi]
pub fn fatal_exception_example(env: &Env) {
    let error = Error::new(Status::GenericFailure, "Async error");
    env.fatal_exception(error);
}
```

---

## anyhow 集成

启用 `error_anyhow` feature 后，`anyhow::Error` 可以自动转换为 `napi_ohos::Error`。

### 配置

```toml
[dependencies]
napi-ohos = { version = "1.2", features = ["error_anyhow"] }
anyhow = "1"
```

### 使用

```rust
use napi_ohos::Result;
use napi_derive_ohos::napi;

#[napi]
pub fn anyhow_example() -> Result<()> {
    let content = std::fs::read_to_string("config.json")?;  // anyhow::Error
    Ok(())
}
```

### 转换

```rust
use napi_ohos::{Error, Status};

fn convert_anyhow(e: anyhow::Error) -> Error {
    Error::new(Status::GenericFailure, format!("{:?}", e))
}
```

### 错误链

`Error` 支持 `cause` 字段，可以构建错误链：

```rust
let mut error = Error::new(Status::GenericFailure, "Outer error");
let cause = Error::new(Status::InvalidArg, "Inner error");
error.set_cause(cause);
```

在 JS 侧，`cause` 会作为 Error 的 `cause` 属性：

```js
try {
    myModule.doSomething();
} catch (e) {
    console.log(e.cause);  // Inner error
}
```

---

## 相关文档

- [类型系统](02-type-system-and-js-values.md#resultt-处理)
- [核心概念](01-core-concepts.md)
