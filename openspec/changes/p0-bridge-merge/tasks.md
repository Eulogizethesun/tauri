## 1. 准备工作

- [x] 1.1 创建回退 tag：`git tag pre-bridge-merge`
- [x] 1.2 试跑方案一：`git merge harmony-contrib/main --no-commit`，记录冲突数（30 个），然后 `git merge --abort`
- [x] 1.3 试跑方案二：`git merge harmony-contrib/feat/pr63-pluginized --no-commit`，记录冲突数（35 个），然后 `git merge --abort`
- [x] 1.4 选择冲突数少的方案，正式执行 merge — **选择方案一**（30 < 35）

## 2. 解决 modify/delete 冲突（11 个文件）

- [x] 2.1 创建暂存目录 `crates/ability/src/_legacy/` 和 `native_ability/src/main/ets/_legacy/`
- [x] 2.2 暂存 `crates/ability/src/helper/webview.rs` 到 `_legacy/`，接受上游删除
- [x] 2.3 暂存 `crates/ability/src/helper/mod.rs` 到 `_legacy/`，接受上游删除（后从 HEAD 恢复完整 helper 模块以修复编译）
- [x] 2.4 暂存 `crates/ability/src/webview/mod.rs` 到 `_legacy/`，接受上游删除
- [x] 2.5 暂存 `crates/ability/src/webview/drag.rs` 到 `_legacy/`，接受上游删除
- [x] 2.6 暂存 `native_ability/.../webview/DefaultWebview.ets` 到 `_legacy/`，接受上游删除
- [x] 2.7 暂存 `native_ability/.../webview/Utils.ets` 到 `_legacy/`，接受上游删除
- [x] 2.8 暂存 `native_ability/.../helper/index.ets` 到 `_legacy/`，接受上游删除
- [x] 2.9 暂存 `native_ability/.../helper/object.ts` 到 `_legacy/`，接受上游删除
- [x] 2.10 暂存 `native_ability/.../helper/os.ets` 到 `_legacy/`，接受上游删除
- [x] 2.11 处理 `Cargo.lock` modify/delete 冲突（接受上游版本）
- [x] 2.12 处理 3 个 `oh-package-lock.json5` modify/delete 冲突（接受上游版本）
- [x] 2.13 处理 `scripts/pack.sh` modify/delete 冲突（接受上游版本）

## 3. 解决 content 冲突（~19 个文件）

- [x] 3.1 解决 `.gitignore` 冲突（合入两端改动）
- [x] 3.2 解决 `Cargo.toml` 冲突（以上游为主，补入本地依赖，更新 xcomponent-sys 0.0.2→0.1）
- [x] 3.3 解决 `crates/ability/Cargo.toml` 冲突（以上游为主，补入本地 features，去除 webview feature）
- [x] 3.4 解决 `crates/ability/src/app.rs` 冲突（保留 display_size/refresh_rate/updater/want_parameters，去除已删除 helper 依赖的方法）
- [x] 3.5 解决 `crates/ability/src/lib.rs` 冲突（合入 bridge/node + 恢复 helper module 声明）
- [x] 3.6 解决 `crates/ability/src/render/xcomponent.rs` 冲突（使用上游 on_mouse_event API，保留 TSFN 初始化）
- [x] 3.7 解决 `crates/derive/src/lib.rs` 冲突（以上游无参数 `#[ability]` 为主）
- [x] 3.8 解决 `native_ability/.../ability/NativeAbility.ets` 冲突（保留 HEAD 的 ProcessInitializer 生命周期）
- [x] 3.9 解决 `native_ability/.../ability/type.ets` 冲突（保留旧 ArkHelper/WebView 类型 + 新增 bridge 类型）
- [x] 3.10 解决 `native_ability/.../components/DefaultXComponent.ets` 冲突（采用上游 bridge 架构）
- [x] 3.11 解决 `native_ability/.../components/MainPage.ets` 冲突（保留 HEAD 的 MenuBar/WindowManager 集成）
- [x] 3.12 解决 `native_ability/BuildProfile.ets` 冲突
- [x] 3.13 解决 `native_ability/src/main/module.json5` 冲突
- [x] 3.14 解决 `demo/entry/.../Index.d.ts` 冲突（以上游为主）
- [x] 3.15 解决 `demo/entry/.../Index.ets` 冲突（以上游为主）
- [x] 3.16 解决 `demo/entry/.../module.json5` 冲突（以上游为主）
- [x] 3.17 解决 `demo/entry/.../main_pages.json` 冲突（以上游为主）
- [x] 3.18 解决 `rust_example/demo_native/Cargo.toml` 冲突（以上游为主）
- [x] 3.19 解决 `rust_example/demo_native/src/lib.rs` 冲突（以上游为主）

## 4. ArkHelper.ets 处置

- [x] 4.1 merge 完成后执行 `grep -r "ArkHelper" --include="*.ets" native_ability/` 检查引用状态 → 无活跃导入
- [x] 4.2 如已废弃：添加 `// @deprecated` 注释，保留文件供迁移参考
- [x] 4.3 ~~如仍在使用：保留文件，添加废弃注释~~（已废弃，无活跃引用）

## 5. 收尾和验证

- [x] 5.1 创建 `_legacy/README.md`，列出所有暂存文件的原始路径、功能摘要、目标 Phase
- [x] 5.2 执行 `cargo check --target aarch64-unknown-linux-ohos`，修复编译错误 → **0 errors**（OHOS + Windows 双平台通过）
- [x] 5.3 提交 merge commit：`git commit -m "Merge harmony-contrib/main (PR #67 pluginized bridge core + PR #68 plugins)"`
- [x] 5.4 验证 `git log --oneline -5` 确认 merge commit 正确
