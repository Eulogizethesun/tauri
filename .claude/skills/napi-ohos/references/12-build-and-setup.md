# 构建与配置

## 目录
- [Cargo.toml 配置](#cargotoml-配置)
- [build.rs](#buildrs)
- [ohrs CLI](#ohrs-cli)
- [手动构建](#手动构建)
- [Feature Flags](#feature-flags)
- [项目结构](#项目结构)
- [调试](#调试)
- [MSRV](#msrv)

---

## Cargo.toml 配置

### 基本配置

```toml
[package]
name = "my-napi-module"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
napi-ohos = { version = "1.2", features = ["napi8"] }
napi-derive-ohos = "1.2"

[build-dependencies]
napi-build-ohos = "1.2"
```

### 带异步支持

```toml
[dependencies]
napi-ohos = { version = "1.2", features = ["napi8", "tokio_rt"] }
napi-derive-ohos = "1.2"
tokio = { version = "1", features = ["full"] }
```

### 带序列化支持

```toml
[dependencies]
napi-ohos = { version = "1.2", features = ["napi8", "serde-json"] }
napi-derive-ohos = "1.2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

---

## build.rs

### 基本用法

```rust
fn main() {
    napi_build_ohos::setup();
}
```

### 作用

`napi_build_ohos::setup()` 会：
1. 设置目标名称环境变量（`NAPI_BUILD_TARGET_NAME`）
2. 配置正确的链接参数
3. 为 `napi-derive-ohos` 提供构建信息

---

## ohrs CLI

[ohrs](https://ohos.rs/) 是 OpenHarmony Rust 开发的官方 CLI 工具。

### 安装

```sh
# 使用 ohos.rs 提供的安装脚本
curl -sSf https://ohos.rs/install.sh | sh
```

### 初始化项目

```sh
ohrs init my-project
cd my-project
```

### 构建

```sh
# 构建所有架构
ohrs build

# 构建指定架构
ohrs build --arch aarch

# 发布模式
ohrs build --release
```

### 支持的架构

| 架构 | 参数 | target |
|------|------|--------|
| ARM64 | `--arch aarch` | `aarch64-unknown-linux-ohos` |
| ARM32 | `--arch arm` | `armv7-unknown-linux-ohos` |
| x86_64 | `--arch x86_64` | `x86_64-unknown-linux-ohos` |

---

## 手动构建

### 添加 target

```sh
rustup target add aarch64-unknown-linux-ohos
```

### 构建命令

```sh
# 开发模式
cargo build --target aarch64-unknown-linux-ohos

# 发布模式
cargo build --target aarch64-unknown-linux-ohos --release
```

### 输出位置

```
target/aarch64-unknown-linux-ohos/debug/libmy_napi_module.so
target/aarch64-unknown-linux-ohos/release/libmy_napi_module.so
```

---

## Feature Flags

### N-API 版本

| Feature | 说明 |
|---------|------|
| `napi1` | 基础 API |
| `napi2` | UV 事件循环 |
| `napi3` | 环境清理钩子 |
| `napi4` | ThreadsafeFunction |
| `napi5` | Date、闭包函数 |
| `napi6` | BigInt、实例数据 |
| `napi7` | 初始属性 |
| `napi8` | AsyncCleanupHook、Object.freeze/seal |
| `napi9` | JsSyntaxError |
| `napi10` | 最新 API |

### 功能特性

| Feature | 说明 |
|---------|------|
| `tokio_rt` | 启用 tokio 异步运行时（自动启用 napi4） |
| `serde-json` | 启用 serde 序列化/反序列化 |
| `serde-json-ordered` | serde-json + 保留对象键顺序 |
| `compat-mode` | 兼容旧版 API（已废弃） |
| `error_anyhow` | anyhow::Error 集成 |
| `chrono_date` | chrono 日期支持（需要 napi5） |
| `web_stream` | Web Stream 支持（需要 napi4 + tokio_rt） |
| `tracing` | tracing 日志集成 |
| `latin1` | Latin1 字符串解码 |
| `noop` | 空操作模式（用于文档生成） |
| `dyn-symbols` | 动态符号加载 |
| `node_version_detect` | Node 版本检测 |
| `experimental` | 实验性功能 |
| `deferred_trace` | Deferred 追踪（需要 napi4） |
| `object_indexmap` | 使用 indexmap 保持对象键顺序 |
| `full` | 完整功能集（latin1 + napi8 + async + serde-json + chrono_date） |
| `async` | `tokio_rt` 的别名 |

### 推荐配置

```toml
# 最小配置
napi-ohos = { version = "1.2", features = ["napi8"] }

# 完整配置
napi-ohos = { version = "1.2", features = [
    "napi8",
    "tokio_rt",
    "serde-json",
    "error_anyhow",
] }
```

---

## 项目结构

### 推荐目录组织

```
my-napi-module/
├── Cargo.toml
├── build.rs
├── src/
│   └── lib.rs
└── dist/              # 构建输出，复制到 OpenHarmony 项目
    └── libs/
        └── arm64-v8a/
            └── libmy_napi_module.so
```

### 集成到 OpenHarmony 项目

将 `dist` 目录复制到 OpenHarmony 项目的 `entry/src/main/` 下：

```
MyHarmonyApp/
├── entry/
│   └── src/
│       └── main/
│           ├── libs/
│           │   └── arm64-v8a/
│           │       └── libmy_napi_module.so
│           └── ets/
│               └── ...
```

在 ArkTS 中导入：
```typescript
import { fibonacci, greet } from 'libmy_napi_module.so';
```

---

## 调试

### 查看宏展开

设置环境变量查看 `#[napi]` 宏展开后的代码：

```sh
NAPI_DEBUG_GENERATED_CODE=1 cargo build --target aarch64-unknown-linux-ohos
```

### 日志输出

在 Rust 代码中使用 `console.log`：

```rust
use napi_ohos::bindgen_prelude::*;

// 在代码中调用 JS console
let env = /* ... */;
unsafe {
    napi_ohos::__private::log_js_value(
        "log",
        env.raw(),
        &[/* napi_values */],
    );
}
```

或使用 OpenHarmony 的 hilog：

```rust
use ohos_hilog_binding::hilog_info;

hilog_info!("Debug message: {}", value);
```

---

## MSRV

napi-ohos v1.2.0 的最低 Rust 版本要求：**Rust 1.88.0**

### 检查版本

```sh
rustc --version
```

### 更新 Rust

```sh
rustup update
```

---

## 相关文档

- [核心概念](01-core-concepts.md#n-api-版本机制)
- [OpenHarmony 特有功能](11-ohos-specific.md)
