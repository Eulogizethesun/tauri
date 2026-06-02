# 文件过滤规则

## 需要提交的文件 ✓

| 类型 | 文件扩展名/路径 | 说明 |
|------|----------------|------|
| Rust 源码 | `.rs` | 所有 Rust 代码变更 |
| ArkTS 源码 | `.ets` | openharmony-ability 中的 ArkTS 代码 |
| TypeScript | `.ts`, `.js` | 前端代码、测试代码 |
| 文档 | `.md` | 设计文档、进度文档、README |
| Cargo 配置 | `Cargo.toml` | 依赖变更 |
| OHOS 配置 | `oh-package.json5`, `build-profile.json5`, `module.json5` | OHOS 项目配置 |
| OpenSpec 设计文档 | `openspec/changes/`, `openspec/archive/` | proposal, design, specs, tasks 及归档副本（仅 tauri 仓库） |
| 测试文件 | `core.ts`, `plugins.ts` | 前端 API 测试 |
| 资源文件 | `color.json`, `media/` | 颜色配置、图标等 |
| 构建脚本 | `*.sh` (skills 下的脚本) | 构建和测试脚本 |

## 不应提交的文件 ✗

| 类型 | 文件扩展名/路径 | 原因 |
|------|----------------|------|
| Cargo.lock | `Cargo.lock` | 已在 .gitignore 中，自动生成 |
| 自动生成 | `gen/ohos/`, `build/`, `target/` | 构建工具自动生成 |
| 编译产物 | `.so`, `.o`, `.a` | 编译中间产物 |
| HAP 包 | `.hap`, `.hsp`, `.app` | 打包产物 |
| 依赖目录 | `node_modules/`, `oh_modules/` | 包管理器安装 |
| 签名证书 | `.p12`, `.cer`, `.p7b`, `.csr` | 敏感凭证 |
| 测试报告 | `test-report.md`, `console-log.txt` | 测试运行产物 |
| HAR 包 | `ability.har`, `*.har` | 打包产物 |
| IDE 文件 | `.idea/`, `.vscode/`, `*.swp` | IDE 配置（个人化） |
| 环境文件 | `.env.local` | 本地环境配置 |
| lock 文件 | `oh-package-lock.json5` | 自动生成 |

## 多仓库路径

所有仓库与 tauri 仓库并列在项目根目录下：

| 仓库 | 相对路径（相对项目根目录） | 对应 Eulogizethesun 仓库 |
|------|--------------------------|--------------------------|
| tauri | `tauri` | Eulogizethesun/tauri |
| tao | `tao` | Eulogizethesun/tao |
| wry | `wry` | Eulogizethesun/wry |
| muda | `muda` | Eulogizethesun/muda |
| tray-icon | `tray-icon` | Eulogizethesun/tray-icon |
| openharmony-ability | `openharmony-ability` | Eulogizethesun/openharmony-ability |
