# 代码检视 Checklist

> Review PR 时逐项检查，发现违规则提交 inline comment。

## 严重级别定义

| 级别 | 含义 | 处理 |
|------|------|------|
| 🔴 Blocker | 必须修复才能合并 | event = `REQUEST_CHANGES` |
| 🟡 Major | 强烈建议修复 | event = `COMMENT` |
| 🔵 Minor | 建议改进 | event = `COMMENT` |
| ℹ️ Info | 信息提示 | event = `COMMENT` |

## A — OHOS cfg 隔离

- [ ] A1: OHOS 特有代码使用 `cfg(target_env = "ohos")` 或组合 gate
- [ ] A2: Linux 依赖加了 `not(target_env = "ohos")` 排除（OHOS `target_os` 是 `"linux"`）
- [ ] A3: desktop/mobile 区分使用 `cfg(all(target_env = "ohos", desktop))` / `cfg(all(target_env = "ohos", mobile))`
- [ ] A4: `OHOS_DEVICE_TYPE` 正确使用（`desktop` 默认，含 tray/menu bar；`mobile` 手机/平板）
- [ ] A5: `cfg_attr(mobile, ...)` 类宏门控必须覆盖 OHOS desktop — 当 `OHOS_DEVICE_TYPE=desktop` 时 `cfg(mobile)` 为 false（tauri-build 中 `device_type != "desktop"`），`cfg_attr(mobile, tauri::mobile_entry_point)` 等宏不会展开 → 缺少 `openharmony` NAPI 入口 → HAP 加载失败。正确写法：`cfg_attr(any(mobile, target_env = "ohos"), ...)`

## B — 平台隔离

- [ ] B1: Windows/macOS/Linux 原有实现未受影响
- [ ] B2: 无遗漏的 cfg gate（`git diff` 检查非 OHOS 路径）
- [ ] B3: 其他平台的编译未受影响

## C — NAPI/TSFN

- [ ] C1: ArkTS 中 NAPI 函数名使用 camelCase
- [ ] C2: TSFN 使用 `callee_handled::<false>()`（非 `true`）
- [ ] C3: TSFN 数据通过泛型参数携带，非全局 Mutex
- [ ] C4: `FnArgs<>` 包装 tuple 参数

## D — 线程模型

- [ ] D1: 无 `run_on_main_thread + rx.recv()` 阻塞模式（死锁风险）
- [ ] D2: Mutex 未跨越阻塞 I/O 操作持有
- [ ] D3: `Function::call()` 未在 `render()` / `@Builder` 上下文中调用

## E — ArkTS 框架

- [ ] E1: WebView 事件在 `@Builder` 内 pre-build 注册
- [ ] E2: 多窗口状态使用 `@LocalStorageProp` 隔离（FloatPage）
- [ ] E3: `@Builder` 在 `@Component` 内（需要 `this` 时）

## F — openharmony-ability 桥接

- [ ] F1: 所有仓调用鸿蒙系统能力必须经过 `openharmony-ability`
- [ ] F2: 禁止在其他仓直接调用 ArkTS API 或 NAPI 函数
- [ ] F3: ArkTS↔Rust 错误传播对称 — ArkTS 端注册/调用失败（如 inputConsumer 返回 801/4200002/4200003）必须反向通知 Rust，Rust 据实更新内部状态（HashMap 等）并返回 `Err`；禁止 ArkTS 仅 log、Rust 仍写状态并返回 `Ok(())`，否则导致 Rust 侧认为已注册/注销但系统侧实际未生效的不一致

## G — 代码质量

- [ ] G1: 无 unused import / unused variable 编译警告
- [ ] G2: 错误处理完整（非测试代码中避免 unwrap/expect，**但 `Mutex::lock().unwrap()` 除外** — 仅当持锁线程 panic 时才会 poison，实际极少发生，属标准用法）
- [ ] G3: 异步回调路径完整（无 callback 丢失/drop）
- [ ] G4: API 签名跨仓一致（如 wry 与 tauri 之间的参数传递）
- [ ] G5: `#[serde(default)]` 不应用于语义上必填的字段（如 `id: String`, `name: String`）— 否则反序列化会静默接受空字符串，导致无效数据被存储而无法查找 → 🟡

## H — 仓库级规范

- [ ] H1: 不应提交的文件未出现在 PR 中 → 🟡
  - **Cargo.lock** — 已在 .gitignore 中，自动生成
  - **自动生成目录** — `gen/ohos/`、`build/`、`target/`
  - **编译产物** — `.so`、`.o`、`.a`、`.hap`、`.hsp`、`.app`、`ability.har`、`*.har`
  - **依赖目录** — `node_modules/`、`oh_modules/`
  - **签名证书** — `.p12`、`.cer`、`.p7b`、`.csr`
  - **测试产物** — `test-report.md`、`console-log.txt`
  - **IDE 文件** — `.idea/`、`.vscode/`、`*.swp`
  - **环境/lock 文件** — `.env.local`、`oh-package-lock.json5`
  - **检查方法**：`git diff <base-branch> --name-only` 逐一核对上述路径模式
- [ ] H2: `.gitattributes` 应保持 `eol=lf`（CRLF 会导致 OHOS 构建异常）→ 🟡
- [ ] H3: openspec 文件必须归档到 `openspec/changes/`（不能散落在仓库根目录）→ 🔵
- [ ] H4: 模板文件 `.ets.hbs` 重命名需验证 CLI template.rs 能正确处理 → 🟡
- [ ] H5: **仅 tauri 仓**：检查 `doc/manual_tests.md` 是否归档了新手动用例（🟡）
  - ⚠️ 此条仅适用于 `tauri/tauri` 仓库，其他仓（wry/tao/openharmony-ability/plugins-workspace 等）跳过
  - **检查方法**：`git diff <base-branch> -- doc/manual_tests.md`，对比 PR 新增功能是否有对应的手动用例追加
  - 如果 PR 新增了用户可操作的功能/API（如 createPdf、tray、menu 等），但 `doc/manual_tests.md` 未变更 → 提交 finding
  - 格式要求：按模块章节追加表格行，末尾更新统计表（T0/T1/合计）
  - 参考模板：`.claude/skills/tauri-ohos-verify/references/manual-test-template.md`
- [ ] H6: **仅 tauri 仓**：检查 `openspec/changes/` 下是否归档了对应的 openspec 设计文档（🟡）
  - ⚠️ 此条仅适用于 `tauri/tauri` 仓库，其他仓跳过
  - **检查方法**：`git diff <base-branch> --name-only -- openspec/changes/`，确认 PR 对应的 openspec 变更已归档
  - 如果 PR 实现了某个 feature 的完整设计（有 proposal.md、design.md、tasks.md 等），但 `openspec/changes/` 下无对应目录 → 提交 finding
  - 如果 openspec 文件散落在仓库根目录（不在 `openspec/changes/<change-name>/` 下） → 提交 finding
  - **深度检查**：读取 openspec 文档，核对 design.md 的每个功能点是否在代码中实现，spec.md 的每个 requirement 是否被满足
- [ ] H7: 注释必须使用英文 → 🔵
  - PR 新增或修改的注释（`//`、`/* */`、`///`）不得包含中文
  - **检查方法**：`git diff <base-branch>` 中搜索中文字符 `[一-鿿]`，定位到注释行
  - 已有未修改的中文注释不要求（仅检查 PR 变更范围内新增/修改的注释）
