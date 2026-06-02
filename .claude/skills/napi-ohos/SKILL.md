# napi-ohos Skill

为 OpenHarmony/HarmonyOS 平台编写 Rust N-API 原生模块的完整指南。

> 基于 [napi-ohos](https://crates.io/crates/napi-ohos) v1.2.0，fork 自 [napi-rs](https://github.com/napi-rs/napi-rs)。MSRV: Rust 1.88.0。

## 快速开始

```rust
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

#[napi]
pub fn fibonacci(n: u32) -> u32 {
    match n {
        1 | 2 => 1,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}
```

## 核心 Crate 生态

| Crate | 用途 |
|-------|------|
| `napi-ohos` | 高层 Rust API，绑定 OpenHarmony N-API |
| `napi-derive-ohos` | 过程宏 `#[napi]`，自动导出函数/类/枚举 |
| `napi-sys-ohos` | 底层 FFI 绑定（`napi_env`, `napi_value` 等） |
| `napi-build-ohos` | 构建脚本工具 |

### 导入约定

```rust
// 推荐：使用 bindgen_prelude 获取所有高层 API
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

// ThreadsafeFunction 相关类型需要单独导入
use napi_ohos::threadsafe_function::{
    ThreadsafeFunction, ThreadsafeCallContext,
    ThreadsafeFunctionCallMode, ThreadsafeFunctionPriority,
};
```

## Reference 文档索引

| # | 文档 | 内容概要 |
|---|------|----------|
| [01](references/01-core-concepts.md) | **核心概念** | `Env` 上下文、N-API 版本机制、模块注册流程、生命周期管理 |
| [02](references/02-type-system-and-js-values.md) | **类型系统与 JS 值** | `ToNapiValue`/`FromNapiValue` trait、所有 JS 值类型详解、`BigInt`/`Buffer`/`Date`/`External` |
| [03](references/03-functions-and-callbacks.md) | **函数与回调** | `#[napi]` 函数导出、回调 `Fn`/`FnMut`/`FnOnce`、`Function` 类型、闭包函数、`module_exports` |
| [04](references/04-classes-and-enums.md) | **类与枚举** | struct/class/enum 导出、`ObjectFinalize`、`ClassInstance`、`#[napi]` 属性完整参考 |
| [05](references/05-object-and-reference.md) | **Object 操作与引用** | Object 属性操作、`Reference`/`WeakReference`/`SharedReference`、`ObjectRef` |
| [06](references/06-iterator-and-generator.md) | **迭代器与生成器** | `Generator`/`ScopedGenerator`/`AsyncGenerator` trait、同步/异步迭代器 |
| [07](references/07-serialization.md) | **序列化** | serde-json 集成、`from_js_value`/`to_js_value`、自定义序列化、错误处理 |
| [08](references/08-error-handling.md) | **错误处理** | `Error`/`Result`、`JsError`/`JsTypeError`、`check_status!` 宏、`Status` 枚举、anyhow 集成 |
| [09](references/09-async-patterns.md) | **异步模式** | `Task`/`ScopedTask` trait、`AsyncWorkPromise`、tokio 运行时、`PromiseRaw`/`Promise`、`AsyncBlockBuilder` |
| [10](references/10-threadsafe-function.md) | **线程安全函数** | `ThreadsafeFunction` 7 个类型参数、构建器链式 API、`CalleeHandled` 模式、优先级调用 |
| [11](references/11-ohos-specific.md) | **OpenHarmony 特有** | `env.load()` 加载模块、`Module` 类型、`spawn_with_qos`、平台差异、ArkVM 注意事项 |
| [12](references/12-build-and-setup.md) | **构建与配置** | `napi-build-ohos`、`ohrs` CLI、完整 feature flags、Cargo.toml |

## 附录

| 文档 | 内容 |
|------|------|
| [napi-sys-ohos 速查](appendix/napi-sys-reference.md) | 底层 FFI 函数速查表、核心类型、枚举值、与高层 API 对应关系 |

## 常用导入模式

```rust
// 推荐：使用 bindgen_prelude 获取所有高层 API
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

// ThreadsafeFunction 相关类型需要单独导入
use napi_ohos::threadsafe_function::{
    ThreadsafeFunction, ThreadsafeCallContext,
    ThreadsafeFunctionCallMode, ThreadsafeFunctionPriority,
};

// 按需导入
use napi_ohos::{Env, Result, Error, Status};
use napi_ohos::bindgen_prelude::{Object, Array, Buffer, Function, Reference};
```

## 构建命令

```sh
# 使用 ohrs CLI
ohrs build
ohrs build --arch aarch

# 手动构建
cargo build --target aarch64-unknown-linux-ohos --release

# 查看宏展开（调试用）
NAPI_DEBUG_GENERATED_CODE=1 cargo build --target aarch64-unknown-linux-ohos
```
