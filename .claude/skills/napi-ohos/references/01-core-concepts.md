# 核心概念

## 目录
- [Env 上下文](#env-上下文)
- [N-API 版本机制](#n-api-版本机制)
- [模块注册流程](#模块注册流程)
- [bindgen_prelude 模块](#bindgen_prelude-模块)
- [生命周期管理](#生命周期管理)

---

## Env 上下文

`Env` 是 N-API 的核心上下文，代表底层 JavaScript 引擎的执行环境。

### 基本用法

```rust
use napi_ohos::{Env, Result};
use napi_derive_ohos::napi;

#[napi]
pub fn greet(env: &Env, name: String) -> Result<String> {
    Ok(format!("Hello, {}!", name))
}
```

### 关键约束

- **同一 Env 只能在同一 Worker 线程使用**，不能跨线程传递
- **Env 在 addon 卸载后失效**
- 所有 N-API 调用都需要有效的 `env` 参数

### 常用方法

```rust
// 创建 JS 值（bindgen 模式推荐直接使用类型构造器）
Object::new()?;                        // Object
env.create_string("hello")?;          // JsString（compat-mode，bindgen 模式用 String 自动转换）

// 抛出错误
env.throw_error("something went wrong", None)?;
env.throw_type_error("invalid type", None)?;

// 获取全局对象
let global = env.get_global()?;

// 运行脚本
let result: String = env.run_script("1 + 1")?;

// 加载 ArkTS 模块 (OpenHarmony 特有)
let hilog = env.load("@ohos.hilog")?;

// 生成异步任务
let promise = env.spawn(my_task)?;
let promise = env.spawn_future(my_future)?;
```

详见 [OpenHarmony 特有功能](11-ohos-specific.md#envload)。

---

## N-API 版本机制

N-API 有版本概念，不同版本提供不同的 API 能力。通过 Cargo feature flags 选择。

### Feature Flags

| Feature | 说明 | 对应 Node.js 版本 |
|---------|------|-------------------|
| `napi1` | 基础 API | Node.js 8.0+ |
| `napi2` | `napi_get_uv_event_loop` | Node.js 10.0+ |
| `napi3` | `add_env_cleanup_hook` | Node.js 10.0+ |
| `napi4` | `ThreadsafeFunction`, `napi_threadsafe_function` | Node.js 10.0+ |
| `napi5` | `Date`, `create_function_from_closure`, `add_finalizer` | Node.js 11.0+ |
| `napi6` | `BigInt`, `InstanceData`, `get_all_property_names` | Node.js 12.0+ |
| `napi7` | `napi_add_initial_property` | Node.js 14.0+ |
| `napi8` | `AsyncCleanupHook`, `Object.freeze/seal` | Node.js 16.0+ |
| `napi9` | `JsSyntaxError` | Node.js 18.0+ |
| `napi10` | 最新 API | Node.js 20.0+ |

### 推荐配置

```toml
[dependencies]
napi-ohos = { version = "1.2", features = ["napi8"] }
napi-derive-ohos = "1.2"
```

对于 OpenHarmony 平台，推荐至少启用 `napi8`，以获得完整的异步和对象操作能力。

### 条件编译

```rust
#[cfg(feature = "napi5")]
pub fn create_date_example(env: &Env) -> Result<()> {
    let date = env.create_date(0.0)?;
    Ok(())
}

#[cfg(feature = "napi6")]
pub fn bigint_example() -> BigInt {
    BigInt::from_i64(9007199254740992)
}
```

---

## 模块注册流程

### 自动注册（推荐）

使用 `#[napi]` 宏时，模块注册是自动完成的：

```rust
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

// 第一个 #[napi] 宏会自动生成模块注册代码
#[napi]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[napi]
pub struct Calculator {
    value: i32,
}

#[napi]
impl Calculator {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self { value: 0 }
    }

    #[napi]
    pub fn add(&mut self, n: i32) {
        self.value += n;
    }
}
```

### 注册机制

1. 第一个 `#[napi]` 宏展开时会插入 `#[module_init]` 属性
2. `module_init` 使用 `ctor` crate 在库加载时自动执行
3. 调用 `napi_module_register` 注册模块
4. 运行时 ArkVM 加载 `.so` 时触发 `napi_register_module_v1`

### 手动注册入口

```rust
use napi_derive_ohos::module_init;

#[module_init]
fn my_init() {
    // 自定义初始化逻辑
}
```

### 模块名称

模块名称按以下优先级获取：
1. `NAPI_BUILD_TARGET_NAME` 环境变量
2. `CARGO_CRATE_NAME` 环境变量
3. `CARGO_PKG_NAME` 环境变量
4. 默认 `"entry"`

名称会被转换为 `snake_case`。

---

## bindgen_prelude 模块

`bindgen_prelude` 是 napi-ohos 提供的高层 API 集合，包含所有常用的 trait 和类型。

### 导入方式

```rust
// 推荐：一次性导入所有高层 API
use napi_ohos::bindgen_prelude::*;

// 按需导入
use napi_ohos::bindgen_prelude::{
    Object, Array, Buffer, Function,
    ToNapiValue, FromNapiValue,
    Result, Error, Status,
};
```

### 包含的核心内容

| 类别 | 内容 |
|------|------|
| Trait | `ToNapiValue`, `FromNapiValue`, `ValidateNapiValue`, `TypeName`, `JsValue`, `JsObjectValue`, `ObjectFinalize` |
| 值类型 | `Object`, `Array`, `Buffer`, `BufferSlice`, `Function`, `Either`, `External`, `Unknown` |
| 错误 | `Result`, `Error`, `Status`, `JsError` |
| 宏 | `check_status!`, `check_pending_exception!`, `check_status_or_throw!` |
| 异步 | `Task`, `PromiseRaw`, `Generator`, `AsyncGenerator` |

### 与 compat-mode 的区别

napi-ohos 支持两种编程模式：

| 模式 | 说明 | 状态 |
|------|------|------|
| **bindgen 模式** | 使用 `bindgen_prelude`，类型自动转换 | **推荐** |
| **compat-mode** | 使用 `Env` 方法手动创建/转换值 | 已废弃 |

compat-mode 中的许多 `Env` 方法已被标记为 `deprecated`：

```rust
// 不推荐（compat-mode）
#[napi]
pub fn old_style(env: &Env) -> Result<JsObject> {
    env.create_object()
}

// 推荐（bindgen 模式）
#[napi]
pub fn new_style() -> Object<'static> {
    Object::new().unwrap()
}
```

详见 [类型系统](02-type-system-and-js-values.md#bindgen-模式-vs-compat-mode)。

---

## 生命周期管理

### Env 有效性

`Env` 仅在以下场景有效：
- 在 `#[napi]` 标注的函数执行期间
- 在 `ThreadsafeFunction` 回调中（通过 `Env::from_raw`）
- 在 finalizer 回调中

### 环境清理钩子

```rust
use napi_ohos::{Env, Result};
use napi_derive_ohos::napi;

#[napi]
pub fn setup_cleanup(env: &Env) -> Result<()> {
    env.add_env_cleanup_hook(
        "cleanup data".to_string(),
        |data| {
            eprintln!("Cleaning up: {}", data);
        },
    )?;
    Ok(())
}
```

需要 `napi3` feature。

### 实例数据

```rust
#[cfg(feature = "napi6")]
pub fn set_instance_data(env: &Env) -> Result<()> {
    env.set_instance_data(
        MyData { value: 42 },
        "hint data",
        |ctx| {
            eprintln!("Finalizing: {:?}", ctx.value);
        },
    )?;
    Ok(())
}
```

### tokio 运行时清理

启用 `tokio_rt` + `napi4` 时，napi-ohos 会自动：
1. 在模块注册时启动 tokio 运行时
2. 在模块卸载时关闭运行时
3. 通过 `thread_cleanup` 回调处理多模块场景

---

## 相关文档

- [类型系统与 JS 值](02-type-system-and-js-values.md)
- [函数与回调](03-functions-and-callbacks.md)
- [构建与配置](12-build-and-setup.md#feature-flags)
