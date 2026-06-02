# 迭代器与生成器

## 目录
- [Generator trait](#generator-trait)
- [ScopedGenerator trait](#scopedgenerator-trait)
- [类迭代器](#类迭代器)
- [异步迭代器](#异步迭代器)
- [使用示例](#使用示例)

---

## Generator trait

`Generator` trait 用于实现 JavaScript 的 Generator 对象，支持 `next()`、`return()`、`throw()`。

> 注意：此功能标记为实验性，可能不稳定。

### 定义

```rust
pub trait Generator {
    type Yield: ToNapiValue;       // yield 的值类型
    type Next: FromNapiValue;      // next() 传入的参数类型
    type Return: FromNapiValue;    // return() 传入的参数类型

    fn next(&mut self, value: Option<Self::Next>) -> Option<Self::Yield>;
    fn complete(&mut self, value: Option<Self::Return>) -> Option<Self::Yield>;
    fn catch(&mut self, env: Env, value: Unknown) -> Result<Option<Self::Yield>, Unknown>;
}
```

### 基本实现

```rust
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

#[napi]
pub struct Counter {
    current: i32,
    max: i32,
}

#[napi]
impl Counter {
    #[napi(constructor)]
    pub fn new(max: i32) -> Self {
        Self { current: 0, max }
    }
}

impl Generator for Counter {
    type Yield = i32;
    type Next = ();
    type Return = ();

    fn next(&mut self, _value: Option<Self::Next>) -> Option<Self::Yield> {
        if self.current < self.max {
            let val = self.current;
            self.current += 1;
            Some(val)
        } else {
            None
        }
    }

    fn complete(&mut self, _value: Option<Self::Return>) -> Option<Self::Yield> {
        None
    }
}
```

JS 使用：
```js
const counter = new Counter(5);
for (const value of counter) {
    console.log(value);  // 0, 1, 2, 3, 4
}
```

---

## ScopedGenerator trait

`ScopedGenerator<'env>` 与 `Generator` 类似，但带有生命周期约束，允许在方法中访问 `Env`。

### 定义

```rust
pub trait ScopedGenerator<'env> {
    type Yield: ToNapiValue + 'env;
    type Next: FromNapiValue;
    type Return: FromNapiValue;

    fn next(&mut self, env: &'env Env, value: Option<Self::Next>) -> Option<Self::Yield>;
    fn complete(&mut self, value: Option<Self::Return>) -> Option<Self::Yield>;
    fn catch(&'env mut self, env: &'env Env, value: Unknown<'env>) -> Result<Option<Self::Yield>, Unknown<'env>>;
}
```

### 与 Generator 的区别

| 特性 | Generator | ScopedGenerator |
|------|-----------|-----------------|
| Env 访问 | 不可直接访问 | `next()` 方法接收 `Env` |
| 生命周期 | 无约束 | 带 `'env` 生命周期 |
| 使用场景 | 简单迭代 | 需要创建 JS 值的迭代 |

### 实现

```rust
impl<'env> ScopedGenerator<'env> for Counter {
    type Yield = i32;
    type Next = ();
    type Return = ();

    fn next(&mut self, _env: &'env Env, _value: Option<Self::Next>) -> Option<Self::Yield> {
        if self.current < self.max {
            let val = self.current;
            self.current += 1;
            Some(val)
        } else {
            None
        }
    }
}
```

---

## 类迭代器

napi-ohos 会自动为实现了 `Generator` 或 `ScopedGenerator` 的类设置迭代器。

### 自动设置

当类实现了 `Generator` trait 后，`napi_register_module_v1` 会自动：
1. 获取 `Global.Iterator` 构造函数
2. 将类的原型设置为继承自 `Iterator.prototype`
3. 在实例上设置 `Symbol.iterator`、`next()`、`return()`、`throw()` 方法

### JS 使用方式

```js
// for...of 循环
for (const item of myGenerator) {
    console.log(item);
}

// 手动调用 next
const iter = myGenerator[Symbol.iterator]();
console.log(iter.next());  // { value: 0, done: false }
console.log(iter.next());  // { value: 1, done: false }
console.log(iter.next());  // { value: undefined, done: true }

// return 提前结束
const iter2 = myGenerator[Symbol.iterator]();
iter2.return("early exit");

// throw 抛出异常
try {
    iter2.throw(new Error("test"));
} catch (e) {
    console.log(e);
}
```

---

## 异步迭代器

需要 `tokio_rt` feature。

> 注意：此功能标记为实验性，可能不稳定。

### AsyncGenerator trait

```rust
pub trait AsyncGenerator {
    type Yield: ToNapiValue + Send + 'static;
    type Next: FromNapiValue;
    type Return: FromNapiValue;

    fn next(
        &mut self,
        value: Option<Self::Next>,
    ) -> impl Future<Output = Result<Option<Self::Yield>>> + Send + 'static;

    fn complete(
        &mut self,
        value: Option<Self::Return>,
    ) -> impl Future<Output = Result<Option<Self::Yield>>> + Send + 'static;

    fn catch(
        &mut self,
        env: Env,
        value: Unknown,
    ) -> impl Future<Output = Result<Option<Self::Yield>>> + Send + 'static;
}
```

### 实现

```rust
use napi_ohos::bindgen_prelude::AsyncGenerator;

#[napi]
pub struct AsyncCounter {
    current: i32,
    max: i32,
}

#[napi]
impl AsyncCounter {
    #[napi(constructor)]
    pub fn new(max: i32) -> Self {
        Self { current: 0, max }
    }
}

impl AsyncGenerator for AsyncCounter {
    type Yield = i32;
    type Next = ();
    type Return = ();

    async fn next(&mut self, _value: Option<Self::Next>) -> napi_ohos::Result<Option<Self::Yield>> {
        if self.current < self.max {
            // 可以执行异步操作
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            let val = self.current;
            self.current += 1;
            Ok(Some(val))
        } else {
            Ok(None)
        }
    }
}
```

JS 使用：
```js
for await (const value of asyncCounter) {
    console.log(value);  // 0, 1, 2, 3, 4 (每个间隔 100ms)
}
```

---

## 使用示例

### 范围迭代器

```rust
#[napi]
pub struct Range {
    start: i32,
    end: i32,
}

#[napi]
impl Range {
    #[napi(constructor)]
    pub fn new(start: i32, end: i32) -> Self {
        Self { start, end }
    }
}

impl Generator for Range {
    type Yield = i32;
    type Next = ();
    type Return = ();

    fn next(&mut self, _value: Option<Self::Next>) -> Option<Self::Yield> {
        if self.start < self.end {
            let val = self.start;
            self.start += 1;
            Some(val)
        } else {
            None
        }
    }
}
```

JS：
```js
for (const n of new Range(0, 5)) {
    console.log(n);  // 0, 1, 2, 3, 4
}
```

### 带 next 参数的迭代器

```rust
#[napi]
pub struct StepRange {
    current: i32,
    end: i32,
}

#[napi]
impl StepRange {
    #[napi(constructor)]
    pub fn new(end: i32) -> Self {
        Self { current: 0, end }
    }
}

impl Generator for StepRange {
    type Yield = i32;
    type Next = i32;  // next(step) 可以传入步长
    type Return = ();

    fn next(&mut self, value: Option<Self::Next>) -> Option<Self::Yield> {
        let step = value.unwrap_or(1);
        if self.current < self.end {
            let val = self.current;
            self.current += step;
            Some(val)
        } else {
            None
        }
    }
}
```

JS：
```js
const iter = new StepRange(10);
for (const n of iter) {
    console.log(n);  // 0, 1, 2, 3, 4, 5, 6, 7, 8, 9
}
```

### catch 处理

```rust
impl Generator for MyGenerator {
    // ...

    fn catch(&mut self, env: Env, value: Unknown) -> Result<Option<Self::Yield>, Unknown> {
        // 可以选择处理异常并继续，或直接返回错误
        eprintln!("Generator caught: {:?}", value);
        Err(value)  // 重新抛出
    }
}
```

---

## 相关文档

- [类与枚举](04-classes-and-enums.md)
- [异步模式](09-async-patterns.md)
