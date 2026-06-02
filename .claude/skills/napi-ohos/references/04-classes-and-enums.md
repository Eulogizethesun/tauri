# 类与枚举

## 目录
- [struct 导出为类](#struct-导出为类)
- [构造函数](#构造函数)
- [属性与方法](#属性与方法)
- [ObjectFinalize trait](#objectfinalize-trait)
- [ClassInstance](#classinstance)
- [This 类型](#this-类型)
- [enum 导出](#enum-导出)
- [类属性](#类属性)

---

## struct 导出为类

使用 `#[napi]` 标注 struct 可将其导出为 JS 类。

### 基本用法

```rust
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

#[napi]
pub struct Point {
    pub x: f64,
    pub y: f64,
}
```

JS 使用：
```js
const point = new Point();
point.x = 10;
point.y = 20;
```

### 私有字段

不标记 `pub` 的字段不会暴露给 JS：

```rust
#[napi]
pub struct Counter {
    count: i32,  // 私有字段
}

#[napi]
impl Counter {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self { count: 0 }
    }
}
```

---

## 构造函数

### #[napi(constructor)]

```rust
#[napi]
pub struct Person {
    pub name: String,
    pub age: u32,
}

#[napi]
impl Person {
    #[napi(constructor)]
    pub fn new(name: String, age: u32) -> Self {
        Self { name, age }
    }
}
```

JS 使用：
```js
const person = new Person("Alice", 30);
```

### #[napi(factory)] 工厂方法

```rust
#[napi]
impl Person {
    #[napi(factory)]
    pub fn from_json(json: String) -> Result<Self> {
        // 解析 JSON 创建实例
        let data: PersonData = serde_json::from_str(&json)?;
        Ok(Self {
            name: data.name,
            age: data.age,
        })
    }
}
```

JS 使用：
```js
const person = Person.fromJson('{"name":"Bob","age":25}');
```

---

## 属性与方法

### Getter 和 Setter

```rust
#[napi]
pub struct Rectangle {
    width: f64,
    height: f64,
}

#[napi]
impl Rectangle {
    #[napi(constructor)]
    pub fn new(width: f64, height: f64) -> Self {
        Self { width, height }
    }

    #[napi(getter)]
    pub fn area(&self) -> f64 {
        self.width * self.height
    }

    #[napi(getter)]
    pub fn width(&self) -> f64 {
        self.width
    }

    #[napi(setter)]
    pub fn set_width(&mut self, w: f64) {
        self.width = w;
    }
}
```

JS 使用：
```js
const rect = new Rectangle(10, 20);
console.log(rect.area);   // 200
console.log(rect.width);  // 10
rect.width = 15;
```

### 实例方法

```rust
#[napi]
impl Rectangle {
    #[napi]
    pub fn scale(&mut self, factor: f64) {
        self.width *= factor;
        self.height *= factor;
    }

    #[napi]
    pub fn clone_rect(&self) -> Self {
        Self {
            width: self.width,
            height: self.height,
        }
    }
}
```

### 静态方法

```rust
#[napi]
impl Rectangle {
    #[napi]
    pub fn from_square(size: f64) -> Self {
        Self {
            width: size,
            height: size,
        }
    }
}
```

JS 使用：
```js
const square = Rectangle.fromSquare(10);
```

---

## ObjectFinalize trait

当 JS 对象被 GC 回收时，会调用 `ObjectFinalize::finalize` 方法。

### 基本用法

```rust
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

#[napi]
pub struct FileHandle {
    path: String,
    // 假设持有某种需要清理的资源
}

impl ObjectFinalize for FileHandle {
    fn finalize(self, env: Env) -> Result<()> {
        eprintln!("Closing file: {}", self.path);
        // 清理资源
        Ok(())
    }
}

#[napi]
impl FileHandle {
    #[napi(constructor)]
    pub fn new(path: String) -> Self {
        eprintln!("Opening file: {}", path);
        Self { path }
    }
}
```

### 注意事项

- `finalize` 在 GC 线程调用，不能保证立即执行
- 不应在 `finalize` 中执行可能阻塞的操作
- 如果 `finalize` 返回 `Err`，错误会被抛出到 JS
- 默认情况下 `ObjectFinalize` 的实现会被忽略，需要 `#[napi(custom_finalize)]` 才能生效

---

## ClassInstance

`ClassInstance<'env, T>` 表示 JS 中 Rust 类的实例。

### 创建实例

通过 `JavaScriptClassExt::into_instance` 创建：

```rust
use napi_ohos::bindgen_prelude::*;

#[napi]
impl MyClass {
    #[napi]
    pub fn create_child(&self, env: &Env) -> Result<ClassInstance<'_, MyClass>> {
        let child = MyClass::new();
        child.into_instance(env)
    }
}
```

### assign_to_this

将实例赋值给 `this` 对象：

```rust
use napi_ohos::bindgen_prelude::{ClassInstance, This};

#[napi]
impl MyClass {
    #[napi]
    pub fn attach_to_this(
        &self,
        mut this: This<Unknown>,
        env: &Env,
    ) -> Result<ClassInstance<'_, ChildClass>> {
        let child = ChildClass::new();
        let instance = child.into_instance(env)?;
        instance.assign_to_this("child", &mut this)
    }
}
```

### as_object

将 `ClassInstance` 转为 `Object` 进行通用操作：

```rust
#[napi]
impl MyClass {
    #[napi]
    pub fn to_object(&self, env: &Env) -> Result<ClassInstance<'_, MyClass>> {
        let instance = self.clone().into_instance(env)?;
        let obj = instance.as_object(env);
        // 可以对 obj 进行 Object 操作
        Ok(instance)
    }
}
```

### instance_of

检查 JS 值是否为某个类的实例：

```rust
#[napi]
pub fn check_instance(value: Object<'_>, env: &Env) -> Result<bool> {
    MyClass::instance_of(env, &value)
}
```

### into_reference

将类实例转为 `Reference<T>`：

```rust
#[napi]
pub fn to_reference(instance: MyClass, env: Env) -> Result<Reference<MyClass>> {
    instance.into_reference(env)
}
```

---

## This 类型

`This<'env, T>` 表示 JS 方法调用时的 `this` 对象。

### 在方法中使用 this

```rust
use napi_ohos::bindgen_prelude::This;

#[napi]
impl MyClass {
    #[napi]
    pub fn modify_this(&self, mut this: This<Object<'_>>) -> Result<()> {
        this.set("modified", true)?;
        Ok(())
    }
}
```

### This 的解引用

`This<T>` 实现了 `Deref` 和 `DerefMut`，可以直接访问内部对象：

```rust
#[napi]
impl MyClass {
    #[napi]
    pub fn read_this(&self, this: This<Object<'_>>) -> Result<bool> {
        // 直接访问 this 的属性
        let val: Option<bool> = this.get("flag")?;
        Ok(val.unwrap_or(false))
    }
}
```

---

## enum 导出

### 数字枚举

`#[napi]` enum 默认导出为数字枚举（i32）：

```rust
#[napi]
pub enum Status {
    Ok = 0,
    Error = 1,
    Pending = 2,
}
```

JS 使用：
```js
Status.Ok    // 0
Status.Error // 1
Status.Pending // 2
```

### 字符串枚举

使用 `#[napi(string_enum)]` 导出为字符串：

```rust
#[napi(string_enum)]
pub enum Color {
    Red,
    Green,
    Blue,
}
```

JS 使用：
```js
Color.Red    // "Red"
Color.Green  // "Green"
Color.Blue   // "Blue"
```

支持自定义命名格式：`#[napi(string_enum = "camelCase")]`，可选值：`lowercase`、`UPPERCASE`、`PascalCase`、`camelCase`、`snake_case`、`UPPER_SNAKE`、`kebab-case`、`UPPER-KEBAB-CASE`。

### 结构化枚举

带关联数据的枚举会导出为 tagged object：

```rust
#[napi]
pub enum Message {
    Text(String),
    Number(i32),
    Empty,
}
```

JS 使用：
```js
{ type: "Text", value: "hello" }
{ type: "Number", value: 42 }
{ type: "Empty" }
```

可通过 `#[napi(discriminant = "kind")]` 自定义标签字段名。

### 作为参数和返回值

```rust
#[napi]
pub fn get_default_color() -> Color {
    Color::Red
}

#[napi]
pub fn is_error_status(status: Status) -> bool {
    status == Status::Error
}
```

---

## 类属性

### Property 类型

用于定义类或对象的属性描述符：

```rust
use napi_ohos::{Property, PropertyAttributes};

// 创建只读属性
let readonly_prop = Property::new()
    .with_utf8_name("readOnly")
    .with_value(&some_value)
    .with_property_attributes(PropertyAttributes::ReadOnly);
```

### PropertyAttributes

| 属性 | 说明 |
|------|------|
| `Default` | 可写、可枚举、可配置 |
| `Writable` | 可写 |
| `Enumerable` | 可枚举 |
| `Configurable` | 可配置 |
| `ReadOnly` | 只读（不可写） |
| `Static` | 静态属性 |

---

## name 转换规则

`#[napi]` 宏默认将 Rust 标识符转换为 JS 友好的命名格式：

| Rust 类型 | Rust 名称示例 | JS 名称（默认） | 转换规则 |
|-----------|-------------|----------------|---------|
| struct | `my_struct` | `MyStruct` | snake_case → PascalCase |
| enum | `status_code` | `StatusCode` | snake_case → PascalCase |
| function | `get_user_info` | `getUserInfo` | snake_case → camelCase |
| method | `get_name` | `getName` | snake_case → camelCase |
| getter | `fn is_active` | `isActive` | 自动转为 camelCase |
| setter | `fn set_age` | `setAge` | 去掉 set_ 前缀 + camelCase |
| field | `user_name` | `userName` | snake_case → camelCase |
| enum variant (数字) | `Ok` / `NotFound` | `Ok` / `NotFound` | 保持原样 |
| enum variant (字符串) | `not_found` | `notFound` | snake_case → camelCase |

### 自定义名称

使用 `js_name` 覆盖默认转换：

```rust
// 函数自定义名称
#[napi(js_name = "fetchUser")]
pub fn get_user(id: i32) -> User { ... }

// 结构体自定义类名
#[napi(js_name = "Point2D")]
pub struct MyPoint { ... }

// 字段自定义名称
struct Config {
    #[napi(js_name = "maxRet")]
    max_retries: u32,
}

// getter/setter 自定义名称
#[napi(getter = "isEnabled")]
pub fn is_active(&self) -> bool { active }

#[napi(setter = "setEnabled")]
pub fn set_active(&mut self, val: bool) { active = val; }
```

### 模块级名称空间

使用 `namespace` 将多个导出组织到 JS 命名空间下：

```rust
#[napi(namespace = "math")]
pub fn add(a: i32, b: i32) -> i32 { a + b }

#[napi(namespace = "math")]
pub fn subtract(a: i32, b: i32) -> i32 { a - b }
```

JS 使用：
```js
math.add(1, 2);       // 3
math.subtract(5, 3);  // 2
```

---

## #[napi] 属性完整参考

`#[napi]` 宏支持多种属性参数，用于控制导出行为。

### struct 级别属性

| 属性 | 说明 | 示例 |
|------|------|------|
| `#[napi]` | 基本导出 | `#[napi] pub struct Foo {}` |
| `#[napi(object)]` | 导出为 JS 对象（非类） | `#[napi(object)] pub struct Config {}` |
| `#[napi(js_name = "MyClass")]` | 自定义 JS 类名 | `#[napi(js_name = "MyClass")]` |
| `#[napi(namespace = "ns")]` | 导出到命名空间 | `#[napi(namespace = "utils")]` |
| `#[napi(custom_finalize)]` | 允许自定义 finalize | 见下方 |
| `#[napi(iterator)]` | 类实现迭代器 | 见 [迭代器文档](06-iterator-and-generator.md) |
| `#[napi(async_iterator)]` | 类实现异步迭代器 | 见 [迭代器文档](06-iterator-and-generator.md) |
| `#[napi(object_from_js)]` | 允许从 JS 对象构造 | 默认启用 |
| `#[napi(object_to_js)]` | 允许转换为 JS 对象 | 默认启用 |
| `#[napi(catch_unwind)]` | 捕获 panic 并转为 JS 错误 | `#[napi(catch_unwind)]` |
| `#[napi(async_runtime)]` | 使用自定义异步运行时 | `#[napi(async_runtime)]` |
| `#[napi(transparent)]` | 透明包装器（单字段 struct） | `#[napi(transparent)]` |
| `#[napi(array)]` | 导出为数组式对象 | `#[napi(array)]` |
| `#[napi(no_export)]` | 不导出到模块（仅内部使用） | `#[napi(no_export)]` |
| `#[napi(use_nullable)]` | TS 中使用 nullable 类型 | `#[napi(use_nullable)]` |

### impl 方法级别属性

| 属性 | 说明 |
|------|------|
| `#[napi(constructor)]` | 构造函数 |
| `#[napi(factory)]` | 工厂方法（静态方法返回实例） |
| `#[napi(getter)]` | getter 属性 |
| `#[napi(getter = name)]` | 自定义 getter 名称 |
| `#[napi(setter)]` | setter 属性 |
| `#[napi(setter = name)]` | 自定义 setter 名称 |
| `#[napi(readonly)]` | 只读属性 |
| `#[napi(enumerable)]` | 可枚举 |
| `#[napi(enumerable = false)]` | 不可枚举 |
| `#[napi(writable)]` | 可写 |
| `#[napi(configurable)]` | 可配置 |
| `#[napi(return_if_invalid)]` | 参数无效时返回 undefined 而非抛出错误 |
| `#[napi(strict)]` | 严格模式，未使用的属性会报错 |
| `#[napi(js_name = "myMethod")]` | 自定义 JS 方法名 |
| `#[napi(skip)]` | 跳过该字段/方法（不导出） |
| `#[napi(skip_typescript)]` | 跳过 TypeScript 类型生成 |

### 字段级别属性

| 属性 | 说明 |
|------|------|
| `#[napi(skip)]` | 跳过该字段 |
| `#[napi(js_name = "fieldName")]` | 自定义 JS 字段名 |

### object 模式

使用 `#[napi(object)]` 将 struct 导出为 plain JS object 而非 class：

```rust
#[napi(object)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[napi]
pub fn create_point() -> Point {
    Point { x: 1.0, y: 2.0 }
}
```

JS 使用：
```js
const point = createPoint();  // { x: 1.0, y: 2.0 }
// 注意：不能用 new Point()
```

### custom_finalize

默认情况下，`ObjectFinalize` 的实现会被忽略。使用 `#[napi(custom_finalize)]` 启用自定义 finalize：

```rust
#[napi(custom_finalize)]
pub struct Resource {
    handle: *mut c_void,
}

impl ObjectFinalize for Resource {
    fn finalize(self, _env: Env) -> Result<()> {
        unsafe { free_resource(self.handle) };
        Ok(())
    }
}
```

### return_if_invalid

当参数类型不匹配时，默认会抛出错误。使用 `return_if_invalid` 改为返回 undefined：

```rust
#[napi(return_if_invalid)]
pub fn process_data(data: String) -> String {
    data.to_uppercase()
}
```

### namespace

将多个导出组织到命名空间下：

```rust
#[napi(namespace = "math")]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[napi(namespace = "math")]
pub fn subtract(a: i32, b: i32) -> i32 {
    a - b
}
```

JS 使用：
```js
math.add(1, 2);       // 3
math.subtract(5, 3);  // 2
```

### TypeScript 类型控制

```rust
// 自定义 TS 参数类型
#[napi(ts_args_type = "data: string | Buffer")]
pub fn process(data: String) -> String {
    data
}

// 自定义 TS 返回类型
#[napi(ts_return_type = "Promise<MyCustomType>")]
pub fn async_op() -> String {
    "result".to_string()
}

// 跳过 TS 类型生成
#[napi(skip_typescript)]
pub fn internal_helper() {}
```

---

## 相关文档

- [类型系统](02-type-system-and-js-values.md)
- [Object 操作与引用](05-object-and-reference.md)
- [迭代器与生成器](06-iterator-and-generator.md)
