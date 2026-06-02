# 函数与回调

## 目录
- [#[napi] 函数导出](#napi-函数导出)
- [回调函数](#回调函数)
- [Function 类型](#function-类型)
- [闭包函数](#闭包函数)
- [模块导出函数](#模块导出函数)

---

## #[napi] 函数导出

### 基本用法

```rust
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

#[napi]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[napi]
pub fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}
```

### 参数与返回值

参数和返回值可以是任何实现了 `FromNapiValue` / `ToNapiValue` 的类型。

```rust
#[napi]
pub fn process(
    name: String,
    count: u32,
    enabled: bool,
) -> Vec<String> {
    vec![name; count as usize]
}
```

### 泛型函数

```rust
// 使用泛型约束回调函数签名
#[napi]
pub fn with_callback<T>(callback: T) -> Result<()>
where
    T: Fn(String) -> Result<()>,
{
    callback("hello".to_string())
}

// 简写形式
#[napi]
pub fn with_callback_short<F: Fn(String) -> Result<()>>(callback: F) {
    callback("hello".to_string()).unwrap();
}
```

### 可选参数

使用 `Option<T>` 表示可选参数：

```rust
#[napi]
pub fn greet_optional(name: Option<String>) -> String {
    match name {
        Some(n) => format!("Hello, {}!", n),
        None => "Hello!".to_string(),
    }
}
```

JS 调用：
```js
greetOptional("World");  // "Hello, World!"
greetOptional();         // "Hello!"
greetOptional(undefined); // "Hello!"
```

---

## 回调函数

napi-ohos 支持使用 `Fn`, `FnMut`, `FnOnce` trait 定义 JS 回调。

### Fn 回调

可多次调用，不可变借用。

```rust
#[napi]
pub fn call_multiple_times<F: Fn(i32) -> Result<()>>(callback: F, times: u32) -> Result<()> {
    for i in 0..times {
        callback(i as i32)?;
    }
    Ok(())
}
```

### FnMut 回调

可多次调用，可变借用。

```rust
#[napi]
pub fn accumulate<F: FnMut(i32) -> Result<()>>(mut callback: F, times: u32) -> Result<()> {
    for i in 0..times {
        callback(i as i32)?;
    }
    Ok(())
}
```

### FnOnce 回调

只能调用一次，消耗自身。

```rust
#[napi]
pub fn call_once<F: FnOnce(String) -> Result<()>>(callback: F) -> Result<()> {
    callback("done".to_string())
}
```

### 回调返回值

回调的返回值必须为 `Result<T>`：

```rust
// 正确
#[napi]
pub fn map_values<F: Fn(i32) -> Result<i32>>(callback: F) -> Result<Vec<i32>> {
    let mut results = Vec::new();
    for i in 0..10 {
        results.push(callback(i)?);
    }
    Ok(results)
}

// 回调返回 undefined
#[napi]
pub fn for_each<F: Fn(i32) -> Result<()>>(callback: F) -> Result<()> {
    for i in 0..10 {
        callback(i)?;
    }
    Ok(())
}
```

---

## Function 类型

`Function<'env, Args, Return>` 表示对 JS 函数的引用。

### 获取函数引用

```rust
use napi_ohos::bindgen_prelude::{Function, Object};

#[napi]
pub fn receive_function(callback: Function<'static, String, ()>) -> Result<()> {
    callback.call("hello".to_string())?;
    Ok(())
}

// 从 Object 获取
#[napi]
pub fn get_method(obj: Object<'_>) -> Result<()> {
    let func: Function<'_, String, i32> = obj.get_named_property("compute")?;
    let result = func.call("input".to_string())?;
    Ok(())
}
```

### 调用函数

```rust
#[napi]
pub fn call_function(
    func: Function<'static, (String, i32), String>,
) -> Result<String> {
    func.call(("hello".to_string(), 42))
}
```

### 函数属性

```rust
#[napi]
pub fn inspect_function(func: Function<'static, (), ()>) -> Result<String> {
    let name = func.name()?;
    Ok(name)
}
```

### 其他方法

```rust
// create_ref — 创建持久引用，可跨函数使用
let func_ref = func.create_ref()?;

// borrow_back — 从引用中恢复 Function
let func = func_ref.borrow_back(&env)?;

// apply — 指定 this 值调用
func.apply(this_object, args)?;

// bind — 绑定 this 值，返回新函数
let bound = func.bind(this_object)?;

// new_instance — 作为构造函数调用
let instance = func.new_instance(args)?;
```

---

## 闭包函数

使用 `Env::create_function_from_closure` 创建带捕获上下文的 JS 函数。

需要 `napi5` feature。

```rust
use napi_ohos::{Env, Result};
use napi_ohos::bindgen_prelude::FunctionCallContext;
use napi_derive_ohos::napi;

#[napi]
pub fn create_counter(env: &Env) -> Result<Function<'_, (), i32>> {
    use std::rc::Rc;
    use std::cell::Cell;

    let count = Rc::new(Cell::new(0i32));

    env.create_function_from_closure(
        "counter",
        move |_ctx: FunctionCallContext| -> Result<i32> {
            let current = count.get();
            count.set(current + 1);
            Ok(current)
        },
    )
}
```

### 注意事项

- 闭包捕获的数据必须满足 `'static` 生命周期
- 闭包会被包装为 `Box` 并通过 finalizer 管理生命周期
- 适合创建需要保持内部状态的 JS 函数

---

## 模块导出函数

### module_exports

使用 `#[napi(module_exports)]` 自定义模块导出：

```rust
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

#[napi(module_exports)]
pub fn init(mut exports: Object) -> Result<()> {
    exports.set("version", "1.0.0")?;
    exports.set("name", "my-module")?;
    Ok(())
}
```

### 带 Env 的 module_exports

```rust
#[napi(module_exports)]
pub fn init_with_env(exports: Object, env: Env) -> Result<()> {
    exports.set("nodeVersion", env.get_napi_version()?)?;
    Ok(())
}
```

---

## 相关文档

- [核心概念](01-core-concepts.md#napi-函数导出)
- [类与枚举](04-classes-and-enums.md)
- [线程安全函数](10-threadsafe-function.md)
