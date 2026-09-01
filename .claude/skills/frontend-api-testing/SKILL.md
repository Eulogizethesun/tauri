---
name: frontend-api-testing
description: Tauri 前端 API 自动化测试开发技能。使用场景：(1) 为新的 Tauri API 或 plugin 编写前端测试用例，(2) 添加测试到 core.ts 或 plugins.ts，(3) 配置 plugin 的 JS/Rust 依赖和权限，(4) 验证测试在 Windows/ohos 平台运行，(5) 分析测试报告定位问题。
---

# Tauri 前端 API 测试开发

本技能指导 agent 为 Tauri API 和 plugins 编写增量前端自动化测试。

## 快速导航

| 任务 | 跳转 |
|------|------|
| 添加自动测试 | [添加自动测试](#添加自动测试) |
| 添加手动测试 | [添加手动测试](#添加手动测试) |
| 添加自定义测试命令 | [添加自定义测试命令](#添加自定义测试命令) |
| 接入新 plugin | [接入新 plugin](#接入新-plugin) |
| 运行测试 | [运行测试](#运行测试) |
| 查看报告 | [测试报告](#测试报告) |
| 排查问题 | [常见问题](#常见问题) |

## 文件位置

```
examples/api/src/
├── lib/
│   ├── test-runner.ts          # 测试引擎（不要修改）
│   └── tests/
│       ├── core.ts             # @tauri-apps/api 测试
│       └── plugins.ts          # @tauri-apps/plugin-* 测试
├── views/
│   └── TestRunner.svelte       # Tests 视图（按钮 + 手动测试 UI）
└── App.svelte                  # autotest 触发 + 默认视图
```

## Tests 视图

打开 Tests 视图时会自动执行一次全部测试（`onMount(() => runAll())`）。视图顶部有 3 个手动触发按钮：

| 按钮 | 行为 |
|------|------|
| **Run All** | 运行所有 `auto` + `side-effect` 测试（`manual` 自动跳过） |
| **Run Auto** | 仅运行 `category: 'auto'` 测试 |
| **Run Side-Effect** | 仅运行 `category: 'side-effect'` 测试 |

测试完成后自动调用 `invoke('write_test_report', ...)` 将报告写入设备。

视图下方是手动测试按钮区域，用于验证 autotest 无法覆盖的语义（如 `isFocused` 在用户主动操作时必须为 `true`）。

### 测试类别

| 类别 | 适用场景 | 自动执行 |
|------|----------|----------|
| `auto` | 纯函数调用，有返回值可断言 | ✓ |
| `side-effect` | 有副作用但可程序验证（fs、clipboard） | ✓ |
| `manual` | 需人工确认（dialog、notification） | ✗（跳过） |

## 添加自动测试

适用于可程序化断言的 API（返回值可验证、无需用户交互）。

1. 在 `core.ts`（核心 API）或 `plugins.ts`（plugin）添加 TestCase
2. 选择 category：纯读取用 `auto`，有副作用用 `side-effect`
3. 在 `fn()` 中调用 API 并用 `assert()` 验证
4. 如果是新 plugin，先完成 [接入新 plugin](#接入新-plugin) 的配置

**核心 API**：静态 import
```typescript
import { currentMonitor } from '@tauri-apps/api/window';

{
  name: '@tauri-apps/api/window.currentMonitor',
  category: 'auto',
  async fn() {
    const monitor = await currentMonitor();
    assert(monitor !== null, 'currentMonitor returned null');
    assert(monitor.size.width > 0, 'width should be positive');
  },
},
```

**Plugin**：动态 import（避免加载失败影响其他测试）
```typescript
{
  name: '@tauri-apps/plugin-fs.mkdir',
  category: 'side-effect',
  async fn() {
    const { mkdir } = await import('@tauri-apps/plugin-fs');
    await mkdir('test-dir', { baseDir: 1 });
  },
},
```

## 添加手动测试

适用于返回值依赖用户交互状态、或需要人工观察确认的 API。触发条件：

- 返回值依赖交互状态（焦点、前后台）
- 需要人工观察（UI 弹窗、通知）
- autotest 只能验证类型/非空，无法验证语义

### Console Log 自动捕获

手动测试结果会自动保存到 `console-log.txt`（与 `test-report.md` 同目录），供 agent 自动拉取分析。

**拉取命令：**
```powershell
cmd.exe /c "hdc file recv /data/app/el2/100/base/com.tauri.api/cache/console-log.txt D:\workspace\tauri\tauri\examples\api\console-log.txt"
```

### 添加步骤

1. 在 `TestRunner.svelte` 中添加 handler，使用 `wrapManual()` 包装
2. 将结果赋值给 `manualResult`
3. 在 Manual Tests 区域添加 `<button>` 绑定 handler

```typescript
async function manualMyApi() {
  await wrapManual('myApi', async () => {
    const value = await someApi();
    const ok = value === expectedValue;
    manualResult = `someApi() → ${value} ${ok ? '[OK]' : '[UNEXPECTED]'}`;
    onMessage(manualResult);
  });
}
```

```svelte
<button class="btn" onclick={manualMyApi}>My API (should be X)</button>
```

**关键点：**
- 必须使用 `wrapManual('名称', fn)` 包装，它会自动记录 console log
- 将测试结果赋值给 `manualResult`，`wrapManual` 会自动捕获
- 按钮文案建议包含预期结果（如 `isFocused (should be true)`）

## 添加自定义测试命令（app command）

手动测试/自动测试若需调用自定义 Rust 命令（`#[command]`，如 `set_ime_position_test`），必须**三处都注册**，漏任何一处症状不同：

| # | 位置 | 作用 | 漏了的症状 |
|---|------|------|-----------|
| 1 | `src-tauri/src/cmd.rs` 定义 + `src/lib.rs` `invoke_handler` 注册 | 命令存在且可路由 | 编译错 `cannot find` / invoke 报 `unknown command` |
| 2 | `src-tauri/build.rs` `AppManifest::new().commands(&[...])` 清单 | 生成 ACL 权限标识 | **构建期 panic**：`Permission xxx not found`（改 build.rs 后会触发 codegen 重跑，暴露其他漏网命令） |
| 3 | `src-tauri/capabilities/run-app.json` 加 `"allow-<命令名>"` | 运行时授权 | **编译安装正常，点击按钮时报 `not allowed. Permissions associated with this command: allow-xxx`**（ACL 拦截，见 hilog ARKWEB-CONSOLE） |

> 坑点：第 3 处最隐蔽——前两处漏了会在编译期暴露，第 3 处只有真机点击才触发。新增命令后顺手检查 run-app.json（对照同批已有命令如 `allow-set-ime-position-test` 的位置追加）。

另需注意命令的 cfg 门控要对称：`#[cfg(target_env = "ohos")]` 实现和 `#[cfg(not(...))]` stub 都要定义，否则其他平台编译失败。

## 接入新 plugin

除了添加 TestCase，还需配置依赖和权限。

**1. Rust 依赖** — `examples/api/src-tauri/Cargo.toml`:
```toml
tauri-plugin-xxx = { path = "../../../../plugins-workspace/plugins/xxx" }
```

若 plugin 不支持 ohos：
```toml
[target.'cfg(not(target_env = "ohos"))'.dependencies]
tauri-plugin-xxx = { path = "../../../../plugins-workspace/plugins/xxx" }
```

**2. 注册 plugin** — `examples/api/src-tauri/src/lib.rs`:
```rust
#[cfg(not(target_env = "ohos"))]
let builder = builder.plugin(tauri_plugin_xxx::init());
```

**3. JS 依赖** — `examples/api/package.json`:
```json
"@tauri-apps/plugin-xxx": "file:../../../plugins-workspace/plugins/xxx"
```

**4. 权限** — `examples/api/src-tauri/capabilities/run-app.json`:
```json
"xxx:default"
```

## 约定

### 命名规范

- 核心 API：`@tauri-apps/api/<模块>.<函数名>`
- Plugin：`@tauri-apps/plugin-<名称>.<函数名>`
- 多函数组合：`@tauri-apps/plugin-fs.mkdir+writeFile+readFile`

### 断言

```typescript
function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

assert(typeof version === 'string', `expected string, got ${typeof version}`);
assert(result === expected, `mismatch: "${result}" vs "${expected}"`);
```

## 运行测试

### Windows

```powershell
cd D:\workspace\tauri\tauri\examples\api
pnpm build
cargo tauri dev
```

打开后默认进入 Tests 视图并自动执行一轮测试。也可通过 URL 参数触发：`http://localhost:1420/?autotest=true`

### ohos 设备

使用 `ohos-build` skill 构建并运行，详见该 skill 的 SKILL.md。

## 测试报告

报告以 Markdown 表格格式写入 `test-report.md`，每个用例执行完后自动追加：

```markdown
# Test Report

*Generated: 2026-05-21T04:41:42.577002500+00:00*

| # | Test | Status | Duration | Error |
|---|------|--------|----------|-------|
| 1 | @tauri-apps/api/app.getVersion | ✅ | 10ms |  |
| 2 | @tauri-apps/api/core.invoke | ✅ | 13ms |  |
| 3 | @tauri-apps/api/core.Channel | ❌ | 16ms | expected 1000 messages, got 66 |
| 4 | @tauri-apps/plugin-fs.mkdir | ⏭️ | 0ms | skipped |
```

状态图标：`✅` = pass, `❌` = fail, `⏭️` = skip

Windows：Console 面板实时输出；ohos：写入设备 `test-report.md`。

### ohos 拉取报告

```bash
# 检查报告是否写完
hdc shell "wc -l /data/app/el2/100/base/com.tauri.api/cache/test-report.md"

# 读取报告内容
hdc shell "cat /data/app/el2/100/base/com.tauri.api/cache/test-report.md"
```

## 常见问题

**Plugin command 未注册** — 检查 `capabilities/run-app.json` 是否包含对应权限。

**App command 报 `not allowed`（编译安装都正常）** — 命令在 build.rs 和 lib.rs 都注册了，但 `capabilities/run-app.json` 漏了 `allow-<命令名>` 授权。真机点击时 hilog（ARKWEB-CONSOLE）可见 `xxx not allowed. Permissions associated with this command: allow-xxx`。详见 [添加自定义测试命令](#添加自定义测试命令)。

**HTTP scope 限制** — `plugin-http` fetch 需声明 URL scope：
```json
{ "identifier": "http:default", "allow": [{ "url": "https://www.example.com/*" }] }
```

**Plugin 在 ohos 编译失败** — Cargo.toml 用 `cfg(not(target_env = "ohos"))` 排除。测试保留，失败即为待适配项。

**动态 import 失败** — 确保 `plugins-workspace` 已执行 `pnpm build`。

## 参考资料

- [test-template.md](references/test-template.md) - 测试用例模板
