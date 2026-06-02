# 序列化

## 目录
- [serde-json feature](#serde-json-feature)
- [from_js_value](#from_js_value)
- [to_js_value](#to_js_value)
- [自定义序列化](#自定义序列化)
- [常见类型映射](#常见类型映射)
- [错误处理](#错误处理)

---

## serde-json feature

启用 serde 集成需要在 `Cargo.toml` 中添加配置：

```toml
[dependencies]
napi-ohos = { version = "1.2", features = ["serde-json"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

启用后，`Env` 提供 `from_js_value` 和 `to_js_value` 方法。

---

## from_js_value

将 JS 值反序列化为 Rust 类型。

### 基本用法

```rust
use napi_ohos::{Env, Result};
use napi_ohos::bindgen_prelude::Unknown;
use napi_derive_ohos::napi;
use serde::Deserialize;

#[derive(Deserialize)]
struct Person {
    name: String,
    age: u32,
    email: Option<String>,
}

#[napi]
pub fn deserialize_person(env: &Env, js_value: Unknown<'_>) -> Result<String> {
    let person: Person = env.from_js_value(js_value)?;
    Ok(format!("{} is {} years old", person.name, person.age))
}
```

### 直接使用类型参数

在 `#[napi]` 函数中，如果参数类型实现了 `Deserialize`，napi-ohos 会自动处理：

```rust
#[derive(Deserialize)]
struct Config {
    debug: bool,
    max_retries: u32,
}

#[napi]
pub fn apply_config(config: Config) -> Result<()> {
    if config.debug {
        eprintln!("Debug mode enabled");
    }
    Ok(())
}
```

JS 调用：
```js
applyConfig({ debug: true, maxRetries: 3 });
```

---

## to_js_value

将 Rust 类型序列化为 JS 值。

### 基本用法

```rust
use napi_ohos::{Env, Result};
use napi_derive_ohos::napi;
use serde::Serialize;

#[derive(Serialize)]
struct Response {
    success: bool,
    data: String,
}

#[napi]
pub fn create_response(env: &Env) -> Result<Unknown<'static>> {
    let response = Response {
        success: true,
        data: "Hello".to_string(),
    };
    env.to_js_value(&response)
}
```

### 在函数返回值中使用

```rust
#[derive(Serialize)]
struct Stats {
    count: u32,
    average: f64,
}

#[napi]
pub fn get_stats(env: &Env) -> Result<Unknown<'static>> {
    let stats = Stats {
        count: 100,
        average: 42.5,
    };
    env.to_js_value(&stats)
}
```

---

## 自定义序列化

### 字段重命名

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct User {
    user_name: String,
    email_address: String,
}
```

JS 中使用：
```js
{ userName: "alice", emailAddress: "alice@example.com" }
```

### 跳过字段

```rust
#[derive(Serialize, Deserialize)]
struct Data {
    public_field: String,
    #[serde(skip)]
    internal_data: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    optional_field: Option<String>,
}
```

### 自定义序列化函数

```rust
use serde::{Serialize, Serializer, Deserialize, Deserializer};

#[derive(Serialize, Deserialize)]
struct Item {
    #[serde(serialize_with = "serialize_hex")]
    #[serde(deserialize_with = "deserialize_hex")]
    id: Vec<u8>,
}

fn serialize_hex<S>(bytes: &[u8], serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&hex::encode(bytes))
}

fn deserialize_hex<'de, D>(deserializer: D) -> Result<Vec<u8>, D::Error>
where
    D: Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    hex::decode(&s).map_err(serde::de::Error::custom)
}
```

---

## 常见类型映射

### struct → Object

```rust
#[derive(Serialize, Deserialize)]
struct Point {
    x: f64,
    y: f64,
}
```

JS：`{ x: 1.0, y: 2.0 }`

### enum → String

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Color {
    Red,
    Green,
    Blue,
}
```

JS：`"red"`, `"green"`, `"blue"`

### enum → Tagged Object

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
enum Message {
    Text(String),
    Number(i32),
    Empty,
}
```

JS：
```js
{ type: "Text", value: "hello" }
{ type: "Number", value: 42 }
{ type: "Empty" }
```

### tuple → Array

```rust
#[derive(Serialize, Deserialize)]
struct Pair(i32, String);
```

JS：`[42, "hello"]`

### HashMap → Object

```rust
use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
struct Config {
    settings: HashMap<String, String>,
}
```

JS：`{ settings: { key1: "val1", key2: "val2" } }`

### Vec → Array

```rust
#[derive(Serialize, Deserialize)]
struct Data {
    items: Vec<i32>,
}
```

JS：`{ items: [1, 2, 3] }`

---

## 错误处理

### 反序列化错误

```rust
#[napi]
pub fn parse_config(env: &Env, js_value: Unknown<'_>) -> Result<Config> {
    match env.from_js_value(js_value) {
        Ok(config) => Ok(config),
        Err(e) => Err(Error::new(
            Status::InvalidArg,
            format!("Failed to parse config: {}", e),
        )),
    }
}
```

### 序列化错误

```rust
#[napi]
pub fn serialize_data(env: &Env, data: Data) -> Result<Unknown<'static>> {
    env.to_js_value(&data).map_err(|e| {
        Error::new(
            Status::GenericFailure,
            format!("Serialization failed: {}", e),
        )
    })
}
```

### 常见错误

| 错误 | 原因 |
|------|------|
| `InvalidArg` | JS 值类型与目标 Rust 类型不匹配 |
| `GenericFailure` | 序列化/反序列化过程中发生其他错误 |

---

## 相关文档

- [类型系统](02-type-system-and-js-values.md)
- [Object 操作](05-object-and-reference.md)
- [错误处理](08-error-handling.md)
