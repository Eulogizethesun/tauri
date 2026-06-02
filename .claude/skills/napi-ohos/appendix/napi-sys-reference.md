# napi-sys-ohos 速查表

> 底层 FFI 函数参考。优先使用高层 API（`napi_ohos::bindgen_prelude`），仅在必要时使用本附录。

## 目录
- [核心类型](#核心类型)
- [值类型枚举](#值类型枚举)
- [状态枚举](#状态枚举)
- [常用 FFI 函数](#常用-ffi-函数)
- [与高层 API 对应关系](#与高层-api-对应关系)

---

## 核心类型

| 类型 | 说明 |
|------|------|
| `napi_env` | N-API 环境指针，代表 JS 引擎上下文 |
| `napi_value` | JS 值的不透明句柄 |
| `napi_ref` | 对 JS 值的持久引用 |
| `napi_callback_info` | 回调函数信息 |
| `napi_handle_scope` | 句柄作用域 |
| `napi_escapable_handle_scope` | 可逃逸的句柄作用域 |
| `napi_deferred` | 延迟 Promise 句柄 |
| `napi_threadsafe_function` | 线程安全函数 |
| `napi_async_work` | 异步工作项 |
| `napi_callback` | 回调函数类型 `extern "C" fn(napi_env, napi_callback_info) -> napi_value` |
| `napi_finalize` | 终结回调类型 |
| `napi_property_descriptor` | 属性描述符 |

---

## 值类型枚举

`napi_value_type`：

| 值 | 说明 |
|----|------|
| `napi_undefined` | undefined |
| `napi_null` | null |
| `napi_boolean` | boolean |
| `napi_number` | number |
| `napi_string` | string |
| `napi_symbol` | symbol |
| `napi_object` | object |
| `napi_function` | function |
| `napi_external` | external |
| `napi_bigint` | bigint |

---

## 状态枚举

`napi_status`：

| 值 | 说明 |
|----|------|
| `napi_ok` | 成功 (0) |
| `napi_invalid_arg` | 参数无效 |
| `napi_object_expected` | 期望对象 |
| `napi_string_expected` | 期望字符串 |
| `napi_name_expected` | 期望名称 |
| `napi_function_expected` | 期望函数 |
| `napi_number_expected` | 期望数字 |
| `napi_boolean_expected` | 期望布尔 |
| `napi_array_expected` | 期望数组 |
| `napi_generic_failure` | 通用失败 |
| `napi_pending_exception` | 有未处理异常 |
| `napi_cancelled` | 已取消 |
| `napi_escape_called_twice` | escape 被调用两次 |
| `napi_handle_scope_mismatch` | 句柄作用域不匹配 |
| `napi_callback_scope_mismatch` | 回调作用域不匹配 |
| `napi_queue_full` | 队列已满 |
| `napi_closing` | 正在关闭 |
| `napi_bigint_expected` | 期望 BigInt |
| `napi_date_expected` | 期望 Date |
| `napi_arraybuffer_expected` | 期望 ArrayBuffer |
| `napi_detachable_arraybuffer_expected` | 期望可分离 ArrayBuffer |
| `napi_would_deadlock` | 会死锁 |
| `napi_no_external_buffers_allowed` | 不允许外部缓冲区 |

---

## 常用 FFI 函数

### 创建值

| 函数 | 说明 |
|------|------|
| `napi_create_object` | 创建空对象 |
| `napi_create_array` | 创建空数组 |
| `napi_create_array_with_length` | 创建指定长度的数组 |
| `napi_create_double` | 从 f64 创建数字 |
| `napi_create_int32` | 从 i32 创建数字 |
| `napi_create_uint32` | 从 u32 创建数字 |
| `napi_create_int64` | 从 i64 创建数字 |
| `napi_create_string_utf8` | 从 UTF-8 字符串创建 string |
| `napi_create_string_utf16` | 从 UTF-16 字符串创建 string |
| `napi_create_string_latin1` | 从 Latin1 字符串创建 string |
| `napi_create_boolean` | 从 bool 创建布尔值 |
| `napi_create_null` | 创建 null |
| `napi_create_undefined` | 创建 undefined |
| `napi_create_function` | 创建函数 |
| `napi_create_buffer` | 创建 Buffer |
| `napi_create_buffer_copy` | 创建 Buffer 拷贝 |
| `napi_create_external_buffer` | 创建外部 Buffer |
| `napi_create_arraybuffer` | 创建 ArrayBuffer |
| `napi_create_external_arraybuffer` | 创建外部 ArrayBuffer |
| `napi_create_date` | 创建 Date (napi5) |
| `napi_create_bigint_int64` | 从 i64 创建 BigInt (napi6) |
| `napi_create_bigint_uint64` | 从 u64 创建 BigInt (napi6) |
| `napi_create_bigint_words` | 从 words 创建 BigInt (napi6) |
| `napi_create_symbol` | 创建 Symbol |
| `napi_create_error` | 创建 Error |
| `napi_create_type_error` | 创建 TypeError |
| `napi_create_range_error` | 创建 RangeError |
| `napi_create_external` | 创建 External |

### 获取值

| 函数 | 说明 |
|------|------|
| `napi_get_boolean` | 获取布尔值 |
| `napi_get_null` | 获取 null |
| `napi_get_undefined` | 获取 undefined |
| `napi_get_value_bool` | 获取 bool 值 |
| `napi_get_value_double` | 获取 f64 值 |
| `napi_get_value_int32` | 获取 i32 值 |
| `napi_get_value_int64` | 获取 i64 值 |
| `napi_get_value_uint32` | 获取 u32 值 |
| `napi_get_value_bigint_int64` | 获取 BigInt i64 (napi6) |
| `napi_get_value_bigint_uint64` | 获取 BigInt u64 (napi6) |
| `napi_get_value_bigint_words` | 获取 BigInt words (napi6) |
| `napi_get_value_string_utf8` | 获取 UTF-8 字符串 |
| `napi_get_value_string_utf16` | 获取 UTF-16 字符串 |
| `napi_get_value_string_latin1` | 获取 Latin1 字符串 |
| `napi_get_value_external` | 获取 External 数据 |
| `napi_get_date_value` | 获取 Date 值 (napi5) |
| `napi_get_array_length` | 获取数组长度 |
| `napi_get_buffer_info` | 获取 Buffer 信息 |
| `napi_get_arraybuffer_info` | 获取 ArrayBuffer 信息 |

### 属性操作

| 函数 | 说明 |
|------|------|
| `napi_get_property` | 获取属性值 |
| `napi_set_property` | 设置属性值 |
| `napi_has_property` | 检查属性是否存在 |
| `napi_delete_property` | 删除属性 |
| `napi_get_named_property` | 获取命名属性 |
| `napi_set_named_property` | 设置命名属性 |
| `napi_has_named_property` | 检查命名属性是否存在 |
| `napi_get_prototype` | 获取原型 |
| `napi_define_properties` | 批量定义属性 |
| `napi_get_property_names` | 获取属性名列表 |
| `napi_get_all_property_names` | 获取所有属性名 (napi6) |
| `napi_has_own_property` | 检查自身属性 |

### 数组操作

| 函数 | 说明 |
|------|------|
| `napi_get_element` | 获取数组元素 |
| `napi_set_element` | 设置数组元素 |
| `napi_has_element` | 检查数组元素是否存在 |
| `napi_delete_element` | 删除数组元素 |

### 函数调用

| 函数 | 说明 |
|------|------|
| `napi_call_function` | 调用函数 |
| `napi_get_cb_info` | 获取回调信息 |
| `napi_get_new_target` | 获取 new.target |
| `napi_new_instance` | 创建类实例 |

### 引用管理

| 函数 | 说明 |
|------|------|
| `napi_create_reference` | 创建引用 |
| `napi_delete_reference` | 删除引用 |
| `napi_reference_ref` | 增加引用计数 |
| `napi_reference_unref` | 减少引用计数 |
| `napi_get_reference_value` | 获取引用值 |

### 类型检查

| 函数 | 说明 |
|------|------|
| `napi_typeof` | 获取值类型 |
| `napi_is_array` | 检查是否为数组 |
| `napi_is_error` | 检查是否为 Error |
| `napi_strict_equals` | 严格相等比较 |
| `napi_coerce_to_bool` | 强制转换为布尔 |
| `napi_coerce_to_number` | 强制转换为数字 |
| `napi_coerce_to_object` | 强制转换为对象 |
| `napi_coerce_to_string` | 强制转换为字符串 |

### 异常处理

| 函数 | 说明 |
|------|------|
| `napi_throw` | 抛出任意值 |
| `napi_throw_error` | 抛出 Error |
| `napi_throw_type_error` | 抛出 TypeError |
| `napi_throw_range_error` | 抛出 RangeError |
| `napi_is_exception_pending` | 检查是否有未处理异常 |
| `napi_get_and_clear_last_exception` | 获取并清除最后的异常 |
| `napi_fatal_error` | 致命错误（终止进程） |
| `napi_fatal_exception` | 触发 uncaughtException |

### 全局与作用域

| 函数 | 说明 |
|------|------|
| `napi_get_global` | 获取全局对象 |
| `napi_open_handle_scope` | 打开句柄作用域 |
| `napi_close_handle_scope` | 关闭句柄作用域 |
| `napi_open_escapable_handle_scope` | 打开可逃逸作用域 |
| `napi_close_escapable_handle_scope` | 关闭可逃逸作用域 |
| `napi_escape_handle` | 从可逃逸作用域逃逸值 |

### Promise

| 函数 | 说明 |
|------|------|
| `napi_create_promise` | 创建 Promise |
| `napi_resolve_deferred` | resolve Promise |
| `napi_reject_deferred` | reject Promise |
| `napi_is_promise` | 检查是否为 Promise |

### 线程安全函数

| 函数 | 说明 |
|------|------|
| `napi_create_threadsafe_function` | 创建线程安全函数 |
| `napi_get_threadsafe_function_context` | 获取上下文 |
| `napi_call_threadsafe_function` | 调用线程安全函数 |
| `napi_release_threadsafe_function` | 释放线程安全函数 |
| `napi_acquire_threadsafe_function` | 获取线程安全函数 |
| `napi_ref_threadsafe_function` | 引用 |
| `napi_unref_threadsafe_function` | 取消引用 |

### 异步工作

| 函数 | 说明 |
|------|------|
| `napi_create_async_work` | 创建异步工作 |
| `napi_delete_async_work` | 删除异步工作 |
| `napi_queue_async_work` | 排队异步工作 |
| `napi_cancel_async_work` | 取消异步工作 |

### OpenHarmony 特有

| 函数 | 说明 |
|------|------|
| `napi_load_module` | 加载 ArkTS 模块 |
| `napi_load_module_with_info` | 带信息加载模块 |
| `napi_run_script_path` | 执行脚本（替代 napi_run_script） |

---

## 与高层 API 对应关系

| FFI 函数 | 高层 API |
|----------|---------|
| `napi_create_object` | `Object::new(env)` |
| `napi_create_string_utf8` | `env.create_string()` |
| `napi_get_named_property` | `obj.get_named_property()` |
| `napi_set_named_property` | `obj.set_named_property()` / `obj.set()` |
| `napi_call_function` | `Function::call()` |
| `napi_create_reference` | `obj.create_ref()` / `ObjectRef` |
| `napi_get_reference_value` | `obj_ref.get_value()` / `ObjectRef::get_value()` |
| `napi_delete_reference` | `obj_ref.unref()` |
| `napi_typeof` | `value.get_type()` |
| `napi_is_array` | `obj.is_array()` |
| `napi_throw_error` | `env.throw_error()` / `JsError::throw_into()` |
| `napi_create_error` | `env.create_error()` |
| `napi_create_function` | `env.create_function()` |
| `napi_create_promise` | `env.create_deferred()` |
| `napi_create_async_work` | `env.spawn()` |
| `napi_load_module` | `env.load()` |
| `napi_run_script_path` | `env.run_script()` |
| `napi_define_properties` | `obj.define_properties()` |
| `napi_wrap` | `obj.wrap()` |
| `napi_unwrap` | `obj.unwrap()` |
| `napi_create_buffer` | `Buffer::from(vec![...])` |
| `napi_get_buffer_info` | `Buffer::as_ref()` |
| `napi_create_threadsafe_function` | `Function::build_threadsafe_function()` |

---

## 相关文档

- [类型系统](02-type-system-and-js-values.md)
- [Object 操作](05-object-and-reference.md)
- [错误处理](08-error-handling.md)
