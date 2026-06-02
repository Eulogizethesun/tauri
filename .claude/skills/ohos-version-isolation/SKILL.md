---
name: ohos-version-isolation
description: OHOS API 版本隔离最佳实践。使用场景：(1) 在 tao/wry/muda/openharmony-ability 中使用高版本 OHOS API 需要加版本守卫，(2) 判断某个 OHOS API 在低版本设备上是否可用，(3) 实现版本降级方案，(4) 查询 SystemCapability 是否支持。
---

# OHOS API 版本隔离

在 Tauri OHOS 适配中使用高版本 API 时，必须添加版本守卫（version guard），确保低版本设备不会崩溃。本 skill 指导何时、如何使用版本检测接口。

## 重要前提

版本隔离 API 是给 **tao / wry / muda / openharmony-ability** 等底层仓内部使用的，**不是给应用开发者使用的**。这与 Windows（`tao::platform_impl::windows::util::WIN_VERSION`）和 macOS（`wry::wkwebview::util::operating_system_version()`）的模式一致。

## 三个 API

```rust
use openharmony_ability::version;

// 1. OpenHarmony 底座 API Level（整数，如 12, 14, 20）
version::sdk_api_version() -> i32

// 2. HarmonyOS 发行版 API 版本（整数，如 50001, 60000）
version::distribution_api_version() -> i32

// 3. 设备能力检测（SystemCapability 字符串）
version::can_i_use("SystemCapability.Window.SessionManager") -> bool
```

## 决策矩阵：用哪个 API？

| 场景 | API 文档标注 | 使用 | 示例 |
|------|-------------|------|------|
| OpenHarmony 底座接口 | `since 14` | `sdk_api_version() >= 14` | `@ohos.multimedia.image` |
| HarmonyOS 专有接口 | `since 5.0.1(13)` | `distribution_api_version() >= 50001` | `@hms.core.xxx` |
| 硬件能力 | SystemCapability | `can_i_use("SystemCapability.xxx")` | NFC、传感器、摄像头 |
| 软件版本 + 硬件能力 | 两者都有 | 先 `can_i_use`，后版本号 | 定位（需要硬件 + 软件版本）|

**判断规则**：查看 API 文档的**模块路径**：
- `openharmony/` → `sdk_api_version()`
- `hms/` → `distribution_api_version()`
- 标注 `SystemCapability.xxx` → `can_i_use()`

## 版本号计算

### distribution_api_version 计算公式

```
整数值 = M × 10000 + S × 100 + F
```

| HarmonyOS 版本 | since 标注 | 整数值 |
|---------------|-----------|--------|
| 5.0.0 | `since 5.0.0(12)` | 50000 |
| 5.0.1 | `since 5.0.1(13)` | 50001 |
| 5.0.2 | `since 5.0.2(14)` | 50002 |
| 5.1.0 | `since 5.1.0(15)` | 50100 |
| 6.0.0 | `since 6.0.0(20)` | 60000 |

### sdk_api_version 对应关系

| API Level | 对应 HarmonyOS |
|-----------|---------------|
| 12 | 5.0.0 |
| 13 | 5.0.1 |
| 14 | 5.0.2 |
| 15 | 5.1.0 |
| 20 | 6.0.0 |

## 降级模式

以下模式从 tao/wry 的 Windows 和 macOS 实现中提炼，OHOS 应保持一致。

### 模式 1：静默跳过（最常见）

版本不满足时直接跳过，**不写 else 分支，不打日志**。这是 Windows/macOS 中最常用的模式。

```rust
use openharmony_ability::version;

fn setup_window_effects(window: &Window) {
    // HarmonyOS 6.0.0 = 6*10000 + 0*100 + 0 = 60000
    if version::distribution_api_version() >= 60000 {
        window.set_special_effect(...);
    }
    // 低版本设备：静默跳过，不做任何事
}
```

**Windows 真实参考**（tao `dark_mode.rs`）：
```rust
// 暗色模式仅在 Windows 10 1809+ 启用
if *DARK_MODE_SUPPORTED {
    // 设置暗色模式
}
// 低版本：静默跳过，不 log
```

**macOS 真实参考**（wry `wkwebview/mod.rs`）：
```rust
// underPageBackgroundColor 仅在 macOS 12+ 可用
if os_major_version >= 12 {
    webview.setUnderPageBackgroundColor(Some(&color));
}
// macOS < 12：静默跳过
```

### 模式 2：函数降级（新旧 API 都有实现）

新旧版本使用不同的 API 实现同一功能，两个分支都有代码。

```rust
use openharmony_ability::version;

fn activate_window(window: &Window) {
    if version::sdk_api_version() >= 14 {
        // API 14+ 新接口
        window::activate_v2(window)
    } else {
        // API 12/13 旧接口
        #[allow(deprecated)]
        window::activate(window)
    }
}
```

**Windows 真实参考**（tao `dark_mode.rs`）：
```rust
// Windows 10 1903+ 使用新 API，旧版使用旧 API
if util::WIN_VERSION.build < 18362 {
    unsafe { _allow_dark_mode_for_app(is_dark_mode) };
} else {
    let mode = if is_dark_mode { PreferredAppMode::AllowDark } else { PreferredAppMode::Default };
    unsafe { _set_preferred_app_mode(mode) };
}
```

**macOS 真实参考**（wry `wkwebview/mod.rs`）：
```rust
// macOS 14+ 使用新 API，旧版使用已废弃 API
if os_major_version >= 14 {
    NSApplication::activate(&app);
} else {
    #[allow(deprecated)]
    NSApplication::activateIgnoringOtherApps(&app, true);
}
```

### 模式 3：强制回退值

版本不满足时返回一个安全的默认值，而不是跳过。

```rust
use openharmony_ability::version;

fn get_theme() -> Theme {
    // HarmonyOS 5.1.0 = 5*10000 + 1*100 + 0 = 50100
    if version::distribution_api_version() >= 50100 {
        system::get_current_theme()
    } else {
        Theme::Light // 低版本强制浅色
    }
}
```

**Windows 真实参考**（tao `dark_mode.rs`）：
```rust
pub fn try_window_theme(...) -> Theme {
    if *DARK_MODE_SUPPORTED {
        // 查询系统主题
    } else {
        Theme::Light  // 不支持暗色模式的系统强制浅色
    }
}
```

### 模式 4：参数覆写

版本不满足时修改参数值，使功能安全降级。

```rust
use openharmony_ability::version;

fn set_webview_background(transparent: bool) -> RGBA {
    let (r, g, b, mut a) = get_background_color();
    // 低版本不支持透明
    if version::sdk_api_version() < 14 {
        a = 255; // 强制不透明
    }
    RGBA(r, g, b, a)
}
```

**Windows 真实参考**（wry `webview2/mod.rs`）：
```rust
// Windows 7 不支持 WebView2 透明
unsafe fn set_background_color(controller: &ICoreWebView2Controller, bg: RGBA) -> Result<()> {
    let (r, g, b, mut a) = bg;
    if is_windows_7() || a != 0 {
        a = 255; // Win7 强制不透明
    }
    // ...
}
```

### 模式 5：组合使用 canIUse + 版本号（OHOS 特有）

先检查硬件能力是否存在，再检查软件版本是否满足。

```rust
use openharmony_ability::version;

fn use_location_service() {
    // 第一步：硬件能力检测
    if !version::can_i_use("SystemCapability.Location.Location.Core") {
        return;
    }

    // 第二步：软件版本检查 + 函数降级
    if version::sdk_api_version() >= 14 {
        location::get_current_location_v2()
    } else {
        location::get_current_location()
    }
}
```

### 模式 6：ArkTS 侧版本守卫

```typescript
import { deviceInfo } from '@kit.BasicServicesKit';

// OpenHarmony 底座接口
if (deviceInfo.sdkApiVersion >= 14) {
    // API 14+ 新特性
}

// HarmonyOS 专有接口
// 5.0.1 → 5*10000 + 0*100 + 1 = 50001
if (deviceInfo.distributionOSApiVersion >= 50001) {
    // HarmonyOS 5.0.1+ 新特性
}

// 能力检测（canIUse 是 ArkTS 全局函数）
if (canIUse('SystemCapability.Window.SessionManager')) {
    // 使用窗口管理 API
}
```

ArkTS UI 组件属性兼容（使用 `AttributeModifier`）：

```typescript
import { deviceInfo } from '@kit.BasicServicesKit';

class MyListModifier implements AttributeModifier<ListAttribute> {
    applyNormalAttribute(instance: ListAttribute): void {
        // API 15+ 才有 backToTop 属性
        if (deviceInfo.sdkApiVersion >= 15) {
            instance.backToTop(true);
        }
    }
}

List() {
    // 列表内容
}
.attributeModifier(new MyListModifier())
```

## 最佳实践

### ✅ DO

- **始终添加版本守卫**：调用高版本 API 前，先检查版本号
- **使用原始整数比较**：`sdk_api_version() >= 14`，与 Windows `WIN_VERSION.build >= 17763` 风格一致
- **内联注释版本号计算**：`// 5.0.1 → 50001`
- **静默跳过不重要的功能**：与 Windows/macOS 一致，不满足条件时直接跳过，不写 else 分支，不打日志
- **新旧 API 都有实现时用函数降级**：`if >= N { new_api } else { old_api }`
- **区分版本体系**：OpenHarmony 底座用 `sdk_api_version()`，HarmonyOS 专有用 `distribution_api_version()`
- **能力检测优先**：硬件能力用 `can_i_use()`，不依赖版本号猜测
- **组合检查时先硬件后软件**：`can_i_use()` 在前，版本号在后

### ❌ DON'T

- **不要假设设备能力**：即使是高端设备也可能缺少某些硬件
- **不要混用版本体系**：OpenHarmony 接口用 `sdk_api_version()`，不要用 `distribution_api_version()`
- **不要在热路径频繁调用 `can_i_use`**：虽然有 NAPI 开销（微秒级），但不建议每帧调用
- **不要硬编码版本号字符串**：始终使用整数比较
- **不要在版本守卫的 else 分支打日志**：Windows/macOS 的版本降级全部是静默跳过，不打 log

## 端到端示例

### 场景：使用 API 14+ 的新图片处理接口

API 文档标注 `since 14`，模块路径 `openharmony/`，因此使用 `sdk_api_version()`。

**Step 1: Rust 侧添加版本守卫（模式 2：函数降级）**

```rust
use openharmony_ability::version;

fn process_image(data: &[u8]) -> Result<ProcessedImage> {
    if version::sdk_api_version() >= 14 {
        let image = image::create_from_data_v2(data, FilterType::Advanced)?;
        image.apply_advanced_filter(FilterPreset::Cinematic)
    } else {
        let image = image::create_from_data(data)?;
        image.apply_basic_filter(FilterPreset::Standard)
    }
}
```

**Step 2: ArkTS 侧添加版本守卫（如果需要）**

```typescript
import { deviceInfo } from '@kit.BasicServicesKit';
import { image } from '@kit.MultimediaKit';

async function processImage(data: ArrayBuffer): Promise<ImageResult> {
    if (deviceInfo.sdkApiVersion >= 14) {
        const img = await image.createImageV2(data, { filter: 'advanced' });
        return await img.applyFilter('cinematic');
    } else {
        const img = await image.createImage(data);
        return await img.applyFilter('standard');
    }
}
```

## 参考文档

- API 源码：`openharmony-ability/crates/ability/src/version.rs`
- [OpenHarmony 版本说明](https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/app-compatibility-api-compatibility)
- [SystemCapability 列表](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/syscap)
