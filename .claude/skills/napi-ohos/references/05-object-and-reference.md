# Object 操作与引用

## 目录
- [Object 创建与操作](#object-创建与操作)
- [属性检查](#属性检查)
- [属性删除](#属性删除)
- [属性名称](#属性名称)
- [数组操作](#数组操作)
- [原型链](#原型链)
- [wrap/unwrap](#wrapunwrap)
- [add_finalizer](#add_finalizer)
- [Object.freeze/seal](#objectfreeseal)
- [Ref 引用](#ref-引用)
- [ObjectRef 引用](#objectref-引用)

---

## Object 创建与操作

### 创建 Object

```rust
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

#[napi]
pub fn create_object(env: &Env) -> Result<Object<'static>> {
    Object::new(env)
}
```

### 设置属性

```rust
#[napi]
pub fn build_object(env: &Env) -> Result<Object<'static>> {
    let mut obj = Object::new(env)?;
    obj.set("name", "Alice")?;
    obj.set("age", 30)?;
    obj.set("active", true)?;
    Ok(obj)
}

// 使用 set_named_property
#[napi]
pub fn build_with_named_prop(env: &Env) -> Result<Object<'static>> {
    let mut obj = Object::new(env)?;
    obj.set_named_property("data", vec![1, 2, 3])?;
    Ok(obj)
}
```

### 获取属性

```rust
#[napi]
pub fn read_object(obj: Object<'_>) -> Result<String> {
    // get() 返回 Option，属性不存在时返回 None
    let name: Option<String> = obj.get("name")?;
    Ok(name.unwrap_or_default())
}

// get_named_property 要求属性存在且类型匹配
#[napi]
pub fn get_required(obj: Object<'_>) -> Result<String> {
    let name: String = obj.get_named_property("name")?;
    Ok(name)
}

// 不检查类型（更快但不安全）
#[napi]
pub fn get_unchecked(obj: Object<'_>) -> Result<String> {
    let name: String = obj.get_named_property_unchecked("name")?;
    Ok(name)
}
```

---

## 属性检查

```rust
#[napi]
pub fn check_properties(obj: Object<'_>, env: &Env) -> Result<Object<'static>> {
    let mut result = Object::new(env)?;

    // has_named_property: 检查命名属性是否存在
    result.set("hasName", obj.has_named_property("name")?)?;

    // has_own_property: 检查是否为自身属性（非原型链）
    result.set("isOwn", obj.has_own_property("name")?)?;

    // has_property: 检查属性（包括原型链）
    result.set("hasProp", obj.has_property("name")?)?;

    // has_property_js: 使用 JsValue 作为键
    result.set("hasPropJs", obj.has_property_js("name")?)?;

    Ok(result)
}
```

---

## 属性删除

```rust
#[napi]
pub fn remove_property(mut obj: Object<'_>) -> Result<bool> {
    // delete_named_property
    obj.delete_named_property("temp")
}

// delete_property 使用 JsValue 作为键
#[napi]
pub fn delete_by_key(mut obj: Object<'_>, key: String) -> Result<bool> {
    obj.delete_property(key)
}
```

---

## 属性名称

```rust
#[napi]
pub fn list_keys(obj: Object<'_>, env: &Env) -> Result<Vec<String>> {
    Object::keys(&obj)
}

// 获取属性名数组（返回 JS Array）
#[napi]
pub fn get_property_names(obj: Object<'_>) -> Result<Object<'_>> {
    obj.get_property_names()
}

// 获取所有属性名（napi6）
#[cfg(feature = "napi6")]
#[napi]
pub fn get_all_names(obj: Object<'_>, env: &Env) -> Result<Object<'_>> {
    use napi_ohos::bindgen_prelude::{KeyCollectionMode, KeyFilter, KeyConversion};

    obj.get_all_property_names(
        KeyCollectionMode::OwnOnly,
        KeyFilter::AllProperties,
        KeyConversion::KeepNumbers,
    )
}
```

---

## 数组操作

### Vec 自动转换（推荐）

在大多数场景下，直接使用 `Vec<T>` 即可，napi-ohos 会自动将其转换为 JS Array：

```rust
use napi_ohos::bindgen_prelude::*;
use napi_derive_ohos::napi;

// Vec<T> 自动转换为 JS Array
#[napi]
pub fn numbers() -> Vec<i32> {
    vec![1, 2, 3, 4, 5]
}

// JS Array 自动转换为 Vec<T>
#[napi]
pub fn sum(arr: Vec<i32>) -> i32 {
    arr.iter().sum()
}
```

### Array 类型

`Array` 类型主要用于接收 JS Array 并进行操作：

```rust
#[napi]
pub fn read_array(arr: Array) -> Result<Vec<String>> {
    let len = arr.len();
    let mut result = Vec::with_capacity(len as usize);
    for i in 0..len {
        if let Some(val) = arr.get::<String>(i)? {
            result.push(val);
        }
    }
    Ok(result)
}
```

### 数组元素操作

```rust
#[napi]
pub fn array_operations(mut arr: Array) -> Result<Object<'static>> {
    let mut result = Object::new()?;

    // 检查元素
    result.set("hasFirst", arr.has_element(0)?)?;

    // 获取元素 (返回 Option<T>)
    let first: Option<String> = arr.get(0)?;
    result.set("first", first)?;

    // 设置元素
    arr.set(0, "updated")?;

    // 插入元素到末尾
    arr.insert("new_item")?;

    // 删除元素
    arr.delete_element(1)?;

    // 获取长度
    result.set("length", arr.len())?;

    Ok(result)
}
```

---

## 原型链

```rust
#[napi]
pub fn get_prototype_info(obj: Object<'_>, env: &Env) -> Result<Object<'static>> {
    let mut result = Object::new(env)?;

    // 获取原型
    let proto = obj.get_prototype()?;
    result.set("hasPrototype", !proto.is_null_or_undefined())?;

    // 获取原型（不检查类型）
    let proto_obj: Result<Object<'_>> = obj.get_prototype_unchecked();

    Ok(result)
}
```

### define_properties

批量定义属性：

```rust
use napi_ohos::Property;

#[napi]
pub fn define_props(mut obj: Object<'_>, env: &Env) -> Result<()> {
    obj.define_properties(&[
        Property::new()
            .with_utf8_name("readonlyProp")?
            .with_value("constant")
            .with_property_attributes(PropertyAttributes::ReadOnly),
        Property::new()
            .with_utf8_name("hiddenProp")?
            .with_value(42)
            .with_property_attributes(PropertyAttributes::Enumerable),
    ])?;
    Ok(())
}
```

---

## wrap/unwrap

将 Rust 原生值包装到 JS 对象中。

### wrap

```rust
#[napi]
pub fn wrap_data(mut obj: Object<'_>) -> Result<()> {
    let data = MyData { value: 42 };
    obj.wrap(data, None)?;  // None 表示不提供 size_hint
    Ok(())
}

// 带 size_hint 帮助 GC
#[napi]
pub fn wrap_with_hint(mut obj: Object<'_>) -> Result<()> {
    let data = vec![0u8; 1024 * 1024];  // 1MB
    obj.wrap(data, Some(1024 * 1024))?;
    Ok(())
}
```

### unwrap

```rust
#[napi]
pub fn unwrap_data(obj: Object<'_>) -> Result<i32> {
    let data: &mut MyData = obj.unwrap()?;
    Ok(data.value)
}
```

### remove_wrapped

```rust
#[napi]
pub fn remove_data(mut obj: Object<'_>) -> Result<()> {
    obj.remove_wrapped::<MyData>()?;
    Ok(())
}
```

---

## add_finalizer

在对象被 GC 时执行回调。需要 `napi5` feature。

```rust
#[cfg(feature = "napi5")]
#[napi]
pub fn with_finalizer(mut obj: Object<'_>, env: &Env) -> Result<()> {
    obj.add_finalizer(
        MyResource::new(),
        "hint data",
        |ctx: FinalizeContext<MyResource, &str>| {
            eprintln!("Finalizing resource: {:?}", ctx.value);
            eprintln!("Hint: {}", ctx.hint);
        },
    )?;
    Ok(())
}
```

### FinalizeContext

```rust
pub struct FinalizeContext<T: 'static, Hint: 'static> {
    pub env: Env,
    pub value: T,
    pub hint: Hint,
}
```

---

## Object.freeze/seal

需要 `napi8` feature。

### freeze

冻结对象，禁止修改：

```rust
#[cfg(feature = "napi8")]
#[napi]
pub fn freeze_object(mut obj: Object<'_>) -> Result<()> {
    obj.freeze()?;
    Ok(())
}
```

### seal

密封对象，禁止添加/删除属性：

```rust
#[cfg(feature = "napi8")]
#[napi]
pub fn seal_object(mut obj: Object<'_>) -> Result<()> {
    obj.seal()?;
    Ok(())
}
```

---

## Reference 引用

`Reference<T>` 用于对 `#[napi]` 类实例的持久引用，防止被 GC 回收。

### 创建引用

`Reference<T>` 通常通过从 JS 接收类实例自动创建：

```rust
use napi_ohos::bindgen_prelude::Reference;

#[napi]
pub fn receive_reference(instance: Reference<MyClass>) -> Result<()> {
    // 通过 Deref 直接访问内部数据
    let value = instance.some_field;
    Ok(())
}
```

### 克隆引用

```rust
#[napi]
pub fn clone_reference(r: &Reference<MyClass>, env: &Env) -> Result<Reference<MyClass>> {
    r.clone(*env)
}
```

### WeakReference

`WeakReference<T>` 是弱引用，不会阻止 GC：

```rust
use napi_ohos::bindgen_prelude::WeakReference;

#[napi]
pub fn downgrade(r: &Reference<MyClass>) -> WeakReference<MyClass> {
    r.downgrade()
}

#[napi]
pub fn upgrade_weak(weak: &WeakReference<MyClass>, env: &Env) -> Result<Option<Reference<MyClass>>> {
    weak.upgrade(*env)
}

#[napi]
pub fn get_weak_value(weak: &WeakReference<MyClass>) -> Option<&MyClass> {
    weak.get()
}
```

### SharedReference

`SharedReference<T, S>` 允许在类实例上共享额外数据：

```rust
use napi_ohos::bindgen_prelude::SharedReference;

#[napi]
pub fn share_data(r: Reference<MyClass>, env: Env) -> Result<SharedReference<MyClass, String>> {
    r.share_with(env, |inner| {
        Ok(format!("shared: {}", inner.some_field))
    })
}
```

---

## ObjectRef 引用

`ObjectRef` 是对 JS 对象的引用，必须手动 `unref` 释放。

### 创建与使用

```rust
use napi_ohos::bindgen_prelude::ObjectRef;

#[napi]
pub fn create_object_ref(obj: Object<'_>) -> Result<ObjectRef> {
    obj.create_ref()
}

#[napi]
pub fn use_object_ref(obj_ref: &ObjectRef, env: &Env) -> Result<Object<'_>> {
    obj_ref.get_value(env)
}
```

### 释放引用

```rust
#[napi]
pub fn release_object_ref(obj_ref: ObjectRef, env: &Env) -> Result<()> {
    obj_ref.unref(env)
}
```

### LEAK_CHECK

`ObjectRef<const LEAK_CHECK: bool>` 默认在 drop 时如果未 unref 会打印警告：

```rust
// 禁用泄漏检查
#[napi]
pub fn create_ref_no_check(obj: Object<'_>) -> Result<ObjectRef<false>> {
    obj.create_ref()
}
```

### 注意事项

- **必须调用 `unref`**，否则对象永远不会被 GC
- `ObjectRef` 在 drop 时如果 `LEAK_CHECK=true` 且未 unref，会打印警告信息
- 适合需要跨函数/跨回调保持对象引用的场景

---

## 相关文档

- [类型系统](02-type-system-and-js-values.md#object-类型)
- [类与枚举](04-classes-and-enums.md)
- [序列化](07-serialization.md)
