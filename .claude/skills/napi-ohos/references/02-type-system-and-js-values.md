# 类型系统与 JS 值

## 目录
- [核心 trait 体系](#核心-trait-体系)
- [类型转换规则](#类型转换规则)
- [基本类型](#基本类型)
- [BigInt](#bigint)
- [Buffer 与 ArrayBuffer](#buffer-与-arraybuffer)
- [Date](#date)
- [Either 类型](#either-类型)
- [External](#external)
- [Nil 与 Undefined](#nil-与-undefined)
- [智能指针](#智能指针)
- [bindgen 模式 vs compat-mode](#bindgen-模式-vs-compat-mode)

---

## 核心 trait 体系

napi-ohos 通过一套 trait 实现 Rust 类型与 JS 值之间的自动转换。

### ToNapiValue

将 Rust 值转换为 JS 值。

```rust
pub trait ToNapiValue: Sized {
    unsafe fn to_napi_value(env: sys::napi_env, val: Self) -> Result<sys::napi_value>;

    fn into_unknown(self, env: &Env) -> Result<Unknown<'_>>;
}
```

**已实现的类型**：
- 所有基本类型：`i8`~`i64`, `u8`~`u32`, `f32`, `f64`, `bool`, `String`, `&str`
- `Option<T>` where `T: ToNapiValue`
- `Result<T>` where `T: ToNapiValue`
- 所有 `JsValue` 类型：`Object`, `Array`, `Buffer`, `Function` 等
- `Rc<T>`, `Arc<T>`, `Mutex<T>` where `T: ToNapiValue + Clone`
- `sys::napi_value`（透传）

### FromNapiValue

将 JS 值转换为 Rust 值。

```rust
pub trait FromNapiValue: Sized {
    unsafe fn from_napi_value(env: sys::napi_env, napi_val: sys::napi_value) -> Result<Self>;
    fn from_unknown(value: Unknown) -> Result<Self>;
}
```

**已实现的类型**：
- 所有基本类型
- `Option<T>` where `T: FromNapiValue`
- `Vec<T>`, `HashMap<K, V>`, `HashSet<T>`
- 所有 `JsValue` 类型
- `Rc<T>`, `Arc<T>`, `Mutex<T>` where `T: FromNapiValue`
- `ObjectRef`

### ValidateNapiValue

验证 JS 值类型是否匹配预期。

```rust
pub trait ValidateNapiValue: TypeName {
    unsafe fn validate(env: sys::napi_env, napi_val: sys::napi_value) -> Result<sys::napi_value>;
}
```

当类型不匹配时，返回错误。对 `Option<T>`，如果值为 `null`/`undefined` 则跳过验证。

### TypeName

提供类型的名称和 ValueType。

```rust
pub trait TypeName {
    fn type_name() -> &'static str;
    fn value_type() -> ValueType;
}
```

### JsValue 与 JsObjectValue

```rust
pub trait JsValue<'env> {
    fn value(&self) -> Value;
}

pub trait JsObjectValue<'env>: JsValue<'env> {
    // 提供 set_property, get_property, set_named_property 等方法
}
```

`Object`, `Array`, `Function`, `ClassInstance` 等都实现了 `JsObjectValue`。

---

## 类型转换规则

### Rust → JS 映射表

| Rust 类型 | JS 类型 | 说明 |
|-----------|---------|------|
| `i8`, `i16`, `i32` | `number` | 安全转换 |
| `u8`, `u16`, `u32` | `number` | 安全转换 |
| `i64` | `number` | 可能丢失精度 |
| `f32`, `f64` | `number` | 直接转换 |
| `bool` | `boolean` | 直接转换 |
| `String`, `&str` | `string` | UTF-8 编码 |
| `Vec<u8>` | `Buffer` | 零拷贝 |
| `Vec<T>` | `Array` | 元素逐个转换 |
| `HashMap<K, V>` | `Object` | 键值对转换 |
| `()` | `undefined` | 空值 |
| `Option<T>` | `T` 或 `null` | `None` → `null` |
| `Result<T>` | `T` 或 `Error` | `Err` → 抛出错误 |
| `Either<A, B>` | A 或 B 的 JS 值 | 联合类型 |

### JS → Rust 映射表

| JS 类型 | Rust 类型 | 说明 |
|---------|-----------|------|
| `number` | `i32`, `u32`, `f64` 等 | 可能截断 |
| `boolean` | `bool` | 直接转换 |
| `string` | `String`, `&str` | UTF-8 解码 |
| `object` | `Object`, `HashMap<K,V>`, `BTreeMap<K,V>`, struct | 根据上下文 |
| `array` | `Vec<T>`, `Array`, `HashSet<T>`, `BTreeSet<T>` | 元素逐个转换 |
| `function` | `Function` | 函数引用 |
| `null`/`undefined` | `Option<T>` → `None` | 可选值 |
| `bigint` | `BigInt`, `i64`, `u128` | 需要 `napi6` |

### Option<T> 处理

```rust
// JS undefined/null → Rust None
// JS value → Rust Some(value)

#[napi]
pub fn optional_param(name: Option<String>) -> String {
    match name {
        Some(n) => format!("Hello, {}!", n),
        None => "Hello, stranger!".to_string(),
    }
}
```

### Result<T> 处理

```rust
// Ok(value) → JS value
// Err(e) → 抛出 JS Error

#[napi]
pub fn fallible(divisor: f64) -> Result<f64> {
    if divisor == 0.0 {
        Err(Error::new(Status::InvalidArg, "Division by zero"))
    } else {
        Ok(100.0 / divisor)
    }
}
```

---

## 基本类型

### 整数

```rust
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

#[napi]
pub fn add_i32(a: i32, b: i32) -> i32 {
    a + b
}

#[napi]
pub fn add_u32(a: u32, b: u32) -> u32 {
    a + b
}
```

### 浮点数

```rust
#[napi]
pub fn multiply(a: f64, b: f64) -> f64 {
    a * b
}
```

### 布尔值

```rust
#[napi]
pub fn is_even(n: i32) -> bool {
    n % 2 == 0
}
```

### 字符串

```rust
#[napi]
pub fn to_upper(s: String) -> String {
    s.to_uppercase()
}

// 使用 &str 避免额外分配
#[napi]
pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
```

---

## BigInt

需要 `napi6` feature。`BigInt` 是一个结构体，包含 `sign_bit` 和 `words`：

```rust
use napi_ohos::bindgen_prelude::BigInt;
use napi_derive_ohos::napi;

// i64/u64/i128/u128 自动转换为 BigInt
#[napi]
pub fn big_from_i64(val: i64) -> BigInt {
    val.into()
}

#[napi]
pub fn big_from_u128(val: u128) -> BigInt {
    val.into()
}

// 手动构造
#[napi]
pub fn big_from_words() -> BigInt {
    BigInt {
        sign_bit: false,
        words: vec![0, 1],
    }
}

// 从 JS 接收 BigInt 并读取值
#[napi]
pub fn read_bigint(big: BigInt) -> String {
    let (signed, value, lossless) = big.get_u128();
    format!("signed={}, value={}, lossless={}", signed, value, lossless)
}
```

`BigInt` 提供的方法：
- `get_u64() -> (bool, u64, bool)` — (sign_bit, value, lossless)
- `get_i64() -> (i64, bool)` — (value, lossless)
- `get_i128() -> (i128, bool)` — (value, lossless)
- `get_u128() -> (bool, u128, bool)` — (sign_bit, value, lossless)

---

## Buffer 与 ArrayBuffer

### Buffer

```rust
#[napi]
pub fn create_buffer(len: usize) -> Buffer {
    let buf = vec![0u8; len];
    buf.into()
}

#[napi]
pub fn process_buffer(mut buf: Buffer) -> Buffer {
    for byte in buf.iter_mut() {
        *byte = byte.wrapping_add(1);
    }
    buf
}
```

### BufferSlice

```rust
use napi_ohos::{Env, Result};
use napi_ohos::bindgen_prelude::BufferSlice;
use napi_derive_ohos::napi;

// 从数据创建
#[napi]
pub fn from_data(env: &Env) -> Result<BufferSlice> {
    let data = vec![1, 2, 3, 4];
    BufferSlice::from_data(env, data)
}

// 从外部数据创建（零拷贝）
#[napi]
pub unsafe fn from_external(env: &Env) -> Result<BufferSlice> {
    let data = Box::new([1u8, 2, 3, 4]);
    let len = data.len();
    let ptr = Box::into_raw(data) as *mut u8;
    BufferSlice::from_external(
        env,
        ptr,
        len,
        ptr,
        |_, hint| { drop(Box::from_raw(hint as *mut [u8; 4])); },
    )
}
```

### ArrayBuffer

```rust
use napi_ohos::{Env, Result};
use napi_ohos::bindgen_prelude::ArrayBuffer;
use napi_derive_ohos::napi;

#[napi]
pub fn create_arraybuffer(env: &Env) -> Result<ArrayBuffer> {
    let data = vec![1.0f64, 2.0, 3.0];
    ArrayBuffer::from_data(env, data)
}
```

---

## Date

需要 `napi5` feature。`Date` 类型（即 `JsDate`）用于接收 JS Date 对象：

```rust
use napi_ohos::bindgen_prelude::Date;
use napi_derive_ohos::napi;

#[napi]
pub fn get_timestamp(date: Date) -> f64 {
    date.value_of()  // 返回毫秒时间戳
}
```

注意：napi-ohos 不提供创建 Date 的便捷方法。如需创建 Date，使用 `env.create_date(timestamp)`（compat-mode API）或通过 `Object::new()` 调用 JS 的 `new Date()`。

---

## Either 类型

`Either<A, B>` 表示 JS 中可以是 A 或 B 类型的值。

```rust
use napi_ohos::bindgen_prelude::Either;

#[napi]
pub fn process_input(input: Either<String, i32>) -> String {
    match input {
        Either::A(s) => format!("String: {}", s),
        Either::B(n) => format!("Number: {}", n),
    }
}

// 嵌套 Either
#[napi]
pub fn complex_input(input: Either<String, Either<i32, bool>>) -> String {
    match input {
        Either::A(s) => format!("String: {}", s),
        Either::B(Either::A(n)) => format!("Number: {}", n),
        Either::B(Either::B(b)) => format!("Bool: {}", b),
    }
}

// 作为返回值
#[napi]
pub fn get_value(flag: bool) -> Either<String, i32> {
    if flag {
        Either::A("hello".to_string())
    } else {
        Either::B(42)
    }
}
```

---

## External

`External<T>` 用于在 JS 中持有 Rust 原生指针。

```rust
use napi_ohos::bindgen_prelude::External;

#[napi]
pub fn create_external() -> External<MyData> {
    External::new(MyData { value: 42 })
}

// 带 size_hint 用于 GC 优化
#[napi]
pub fn create_external_with_size() -> External<MyData> {
    External::new_with_size_hint(MyData { value: 42 }, 1024)
}

#[napi]
pub fn use_external(ext: &External<MyData>) -> i32 {
    ext.value
}
```

### 自定义 Finalize

`External` 的 finalize 由 `raw_finalize::<External<T>>` 自动处理。如果需要自定义清理逻辑，使用 `Object::add_finalizer`：

```rust
use napi_ohos::bindgen_prelude::*;

#[napi]
pub fn external_with_finalize(mut obj: Object<'_>) -> Result<()> {
    let data = MyData { value: 42 };
    obj.add_finalizer(
        data,
        (),
        |ctx: FinalizeContext<MyData, ()>| {
            eprintln!("Finalizing MyData: {}", ctx.value.value);
        },
    )?;
    Ok(())
}
```

### ExternalRef

`ExternalRef<T>` 是带引用的 External，适合需要持久引用的场景：

```rust
use napi_ohos::bindgen_prelude::ExternalRef;

#[napi]
pub fn create_external_ref(env: &Env) -> Result<ExternalRef<MyData>> {
    ExternalRef::new(env, MyData { value: 42 })
}

#[napi]
pub fn use_external_ref(ext: &ExternalRef<MyData>) -> i32 {
    ext.value  // 通过 Deref 访问
}
```

---

## Nil 与 Undefined

```rust
use napi_ohos::bindgen_prelude::Undefined;

// 返回 undefined
#[napi]
pub fn do_nothing() -> Undefined {
    Undefined
}

// () 也会转换为 undefined
#[napi]
pub fn returns_unit() {
    // 隐式返回 ()
}
```

---

## 集合类型

### HashMap / BTreeMap

JS Object 可以自动转换为 `HashMap` 或 `BTreeMap`：

```rust
use std::collections::{HashMap, BTreeMap};

#[napi]
pub fn process_map(map: HashMap<String, i32>) -> Result<BTreeMap<String, i32>> {
    let mut sorted = BTreeMap::new();
    for (k, v) in map {
        sorted.insert(k, v * 2);
    }
    Ok(sorted)
}
```

### HashSet / BTreeSet

JS Array 可以自动转换为 `HashSet` 或 `BTreeSet`：

```rust
use std::collections::HashSet;

#[napi]
pub fn unique_items(items: Vec<String>) -> HashSet<String> {
    items.into_iter().collect()
}

#[napi]
pub fn check_contains(set: HashSet<String>, item: String) -> bool {
    set.contains(&item)
}
```

---

## 智能指针

`Rc<T>`, `Arc<T>`, `Mutex<T>` 实现了类型转换 trait，可以在 JS ↔ Rust 间传递。

```rust
use std::sync::{Arc, Mutex};

#[napi]
pub fn shared_data(data: Arc<MyData>) -> Arc<MyData> {
    // Arc 可以在多线程间安全共享
    data
}

#[napi]
pub fn mutable_shared_data(data: Arc<Mutex<MyData>>) -> Arc<Mutex<MyData>> {
    let mut guard = data.lock().unwrap();
    guard.value += 1;
    data
}
```

---

## bindgen 模式 vs compat-mode

napi-ohos 支持两种编程模式：

### bindgen 模式（推荐）

```rust
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

#[napi]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[napi]
pub fn create_obj() -> Object<'static> {
    Object::new().unwrap()
}
```

特点：
- 类型自动转换，无需手动调用 `Env` 方法
- 使用 `bindgen_prelude::*` 导入
- 函数签名直接使用 Rust 类型

### compat-mode（已废弃）

```rust
use napi_ohos::{Env, JsObject, JsNumber, Result};
use napi_derive_ohos::napi;

#[napi]
pub fn add(env: &Env, a: i32, b: i32) -> Result<JsNumber> {
    env.create_int32(a + b)
}

#[napi]
pub fn create_obj(env: &Env) -> Result<JsObject> {
    env.create_object()
}
```

特点：
- 需要手动调用 `Env` 方法创建/转换值
- 返回 `JsObject`, `JsNumber` 等包装类型
- 许多 `Env` 方法已标记为 `deprecated`

### 迁移建议

| compat-mode | bindgen 模式 |
|-------------|-------------|
| `env.create_object()` | `Object::new()` |
| `env.create_int32(n)` | 直接返回 `i32` |
| `env.create_double(n)` | 直接返回 `f64` |
| `env.create_buffer_with_data(data)` | `Buffer::from(data)` |
| `env.from_js_value(js_val)?` | 直接使用类型参数 |

---

## 相关文档

- [核心概念](01-core-concepts.md#bindgen_prelude-模块)
- [Object 操作与引用](05-object-and-reference.md)
- [序列化](07-serialization.md)
