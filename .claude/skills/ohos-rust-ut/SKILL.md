---
name: ohos-rust-ut
description: 在 OpenHarmony 设备上交叉编译并运行 Rust 单元测试。支持 mobile/desktop 两种设备类型。使用场景：(1) 为 ohos target 特有代码（#[cfg(target_env = "ohos")]）编写和验证单元测试，(2) 宿主机无法编译的 OHOS 平台逻辑需要 UT 覆盖，(3) 排查 ohos 目标的编译错误，(4) CI 中加入 ohos target 测试环节。
---

# ohos-rust-ut

在鸿蒙设备上运行 Rust `#[cfg(test)]` 单元测试。用于覆盖 `#[cfg(target_env = "ohos")]` 门控的代码——这些代码在 Windows/Linux/macOS 宿主机上编译不到。

## 设备类型（OHOS_DEVICE_TYPE）

OpenHarmony 设备分为多种类型，通过 `OHOS_DEVICE_TYPE` 环境变量控制编译模式：

| 值 | 说明 | 编译特性 |
|---|------|---------|
| `mobile` | 手机/平板 | `cfg(mobile)` 生效 |
| `desktop` | PC/桌面设备（默认） | `cfg(desktop)` 生效 |

设置方式：
```bash
# desktop 模式（默认）
export OHOS_DEVICE_TYPE=desktop

# mobile 模式
export OHOS_DEVICE_TYPE=mobile
```

## 环境要求

- 已安装 `ohos-build` skill 的所有依赖（DevEco Studio、OHOS SDK、hdc）
- Rust 已安装 `aarch64-unknown-linux-ohos` target：
  ```bash
  rustup target add aarch64-unknown-linux-ohos
  ```
- 至少一台通过 hdc 连接的鸿蒙设备或模拟器
- Python 3（用于解析 cargo JSON 输出）

## 一键运行

```bash
# 跑 tauri crate 的所有测试（默认 desktop 模式）
bash D:/workspace/tauri/tauri/.claude/skills/ohos-rust-ut/scripts/run-ut.sh

# 跑 openharmony-ability crate 的所有测试（含 menu feature）
PACKAGE=openharmony-ability FEATURES=menu bash D:/workspace/tauri/tauri/.claude/skills/ohos-rust-ut/scripts/run-ut.sh

# 跑 muda crate 的所有测试
PACKAGE=muda bash D:/workspace/tauri/tauri/.claude/skills/ohos-rust-ut/scripts/run-ut.sh

# desktop 模式 + 测试过滤
OHOS_DEVICE_TYPE=desktop PACKAGE=openharmony-ability FEATURES=menu bash D:/workspace/tauri/tauri/.claude/skills/ohos-rust-ut/scripts/run-ut.sh menu::

# 指定设备
DEVICE_SN=3QC0124C03000579 bash .../run-ut.sh path::ohos
```

### 自动检测规则

脚本会动态扫描 `REPO_ROOT` 下所有包含 `[workspace]` 的 `Cargo.toml`，自动匹配 `PACKAGE` 名称：

1. 检查 workspace 的 `members` 列表中是否包含目标 package
2. 检查 `crates/*` 等通配符模式下的子 crate
3. 检查非 workspace 的单包 crate

无需硬编码任何 package 名称，新增 crate 时脚本自动适配。

### 独立 crate（muda、tray-icon 等）

脚本会自动扫描 `D:/workspace/tauri/` 下所有子目录的 `Cargo.toml`，按 `PACKAGE` 名称匹配，无需手动指定路径。

```bash
# muda
PACKAGE=muda bash D:/workspace/tauri/tauri/.claude/skills/ohos-rust-ut/scripts/run-ut.sh

# tray-icon
PACKAGE=tray-icon bash D:/workspace/tauri/tauri/.claude/skills/ohos-rust-ut/scripts/run-ut.sh

# desktop 模式
PACKAGE=tray-icon OHOS_DEVICE_TYPE=desktop bash .../run-ut.sh

# 测试过滤
PACKAGE=muda bash .../run-ut.sh menu::tests
```

## 工作流程

```
cargo test --target aarch64-unknown-linux-ohos --no-run
    ↓ (交叉编译产出 ELF 二进制)
hdc file send → /data/local/tmp/tauri-xxx
    ↓ (推送到设备)
hdc shell /data/local/tmp/tauri-xxx <filter> --test-threads=1
    ↓ (在设备上执行)
stdout 即标准 libtest 报告
```

## 编写 UT 的约束

### 1. 不能依赖 `crate::test` 中的 mock runtime

`crates/tauri/src/test/mock_runtime.rs` 是为 desktop 写的（使用 `tao::event_loop::EventLoop` 等），在 ohos target 下编译失败。本项目已通过 `#[cfg(all(..., not(target_env = "ohos")))]` 把该模块排除。

**因此 ohos 测试不能用 `mock_app()`、`mock_builder()` 等。** 只能写纯逻辑测试。

### 2. 提取纯函数便于测试

`PathResolver` 依赖 `AppHandle`，不好直接 mock。做法是把逻辑抽成独立函数，测试函数而不是方法：

```rust
// ohos.rs — the HAP module name comes from the ability init context
// (currentHapModuleInfo.name, injected as hap_module_name) and is stored
// separately from MODULE_NAME, which carries the .so library name.
fn compute_resource_dir(hap_module_name: Option<&str>) -> Result<PathBuf> {
    let module = hap_module_name.ok_or(Error::UnknownPath)?;
    Ok(PathBuf::from("/data/storage/el1/bundle")
        .join(module)
        .join("resources")
        .join("resfile"))
}

pub fn resource_dir(&self) -> Result<PathBuf> {
    let hap = crate::ohos::HAP_MODULE_NAME.get().and_then(|m| m.as_deref());
    compute_resource_dir(hap)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resource_dir_errors_when_hap_module_missing() {
        assert!(compute_resource_dir(None).is_err());
    }

    #[test]
    fn resource_dir_points_at_the_extracted_resfile() {
        assert_eq!(
            compute_resource_dir(Some("entry_desktop")).unwrap(),
            PathBuf::from("/data/storage/el1/bundle/entry_desktop/resources/resfile")
        );
    }
}
```

### 3. 注意 OnceLock 单次初始化语义

`crate::ohos::BASE_PATH` 是 `OnceLock`，整个测试进程中只能 set 一次。多个测试共享同一个实例：
- 不要依赖 `BASE_PATH` 未初始化的状态（除非是第一个跑的测试，顺序不稳定）
- 测试无状态依赖的纯函数最安全

### 4. 平台隔离原则

**Windows/iOS/desktop 编译时不应看到任何 OHOS 特有代码。** `ohos.rs` 整个文件已经被 `#[cfg(target_env = "ohos")]` 门控，所以其中的 `#[cfg(test)]` 块也只在 ohos target 编译。这是正确的分层。

## 已有的适配

为了让 ohos target 的 `cargo test` 能通过编译，项目里做了以下 cfg 调整：

| 文件 | 修改 | 原因 |
|------|------|------|
| `crates/tauri/src/lib.rs` | `pub mod test` 加 `not(target_env = "ohos")` | mock_runtime 依赖 desktop 平台 |
| `crates/tauri/src/window/mod.rs` | `add_child` 的 cfg 加 `not(target_env = "ohos")` | 使用 WebviewBuilder::build (desktop-only) |
| `crates/tauri/src/manager/mod.rs` | `mod test` 加 `not(target_env = "ohos")` | 依赖 crate::test::mock_app |
| `crates/tauri/src/ipc/protocol.rs` | `mod tests` 加 `not(target_env = "ohos")` | 同上 |
| `crates/tauri/src/path/plugin.rs` | `mod tests` 加 `not(target_env = "ohos")` | 同上 |

新增 ohos 特有 UT 时，**不需要**再改其他文件，只需在对应 `ohos.rs` 里加 `#[cfg(test)]` 模块。

## Desktop 模式测试

当 `OHOS_DEVICE_TYPE=desktop` 时，`cfg(desktop)` 生效，`cfg(mobile)` 不生效。
这意味着：
- 可以测试 `#[cfg(all(target_env = "ohos", desktop))]` 门控的代码
- `#[cfg(mobile)]` 门控的代码不会被编译

**注意**：desktop 模式下，`supports_multiple_windows` 等桌面特有 API 会被排除（因为 ohos 不支持真正的桌面窗口管理）。

## 脚本参数

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PACKAGE` | `tauri` | cargo 包名 |
| `FEATURES` | `""` | 启用的 features (e.g. "menu,webview") |
| `DEVICE_SN` | 空（自动） | 设备 SN，多设备时指定 |
| `DEVICE_DIR` | `/data/local/tmp` | 设备上二进制临时目录 |
| `OHOS_DEVICE_TYPE` | `desktop` | 设备类型：`mobile` 或 `desktop` |

### 自动检测逻辑

脚本根据 `PACKAGE` 名称自动扫描 `Cargo.toml` 文件，动态查找对应的 workspace 根目录：

1. 扫描 `REPO_ROOT` 下所有包含 `[workspace]` 的 `Cargo.toml`
2. 检查 `members` 列表和 `crates/*` 通配符模式
3. 匹配到后自动设置工作目录

**无需手动配置**，新增 crate 时脚本自动适配。

## 输出示例

```
=== OHOS Rust UT Runner ===
Package:       tauri
Test filter:   path::ohos
Device type:   desktop
Target:        aarch64-unknown-linux-ohos
Device:        auto
Working dir:   /d/workspace/tauri/tauri

>>> Step 1: Cross-compiling test binary...
    Binary: target/aarch64-unknown-linux-ohos/debug/deps/tauri-0d63b635557f5650
    Size:   123 MB
```

## 排错

### `error: could not compile "tauri" (lib test)`

OHOS target 下 libtest 编译失败，通常是某处 `#[cfg(test)]` 代码用了 desktop-only API。解决：
1. 读错误信息找到文件位置
2. 把对应的 `#[cfg(test)]` 改为 `#[cfg(all(test, not(target_env = "ohos")))]`

### `FileTransfer failed`

设备未连接或磁盘满。先 `cmd.exe /c "hdc list targets"` 确认设备可见。

### `Permission denied` 执行时

设备上 `/data/local/tmp` 权限问题。检查：
```bash
cmd.exe /c "hdc shell ls -la /data/local/tmp/"
cmd.exe /c "hdc shell chmod +x /data/local/tmp/<binary-name>"
```

### 测试二进制很大（>100MB）

正常现象，debug build 包含全部符号。用 `TEST_FILTER` 缩小运行范围不能减少二进制大小，但可以加速设备端执行。如需减小可加 `--release`（编辑脚本）。
