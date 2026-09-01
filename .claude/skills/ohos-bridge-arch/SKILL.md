---
name: ohos-bridge-arch
description: openharmony-ability bridge 插件新架构适配指南——新增桥接能力(ArkTS 插件 + Rust facade)与适配新 Tauri 插件模块到 OHOS 的完整流程、注册链路、HAR 重建、已知坑与验证方法
---

# ohos-bridge-arch：bridge 插件架构适配

openharmony-ability 已完成 pluginize 重构(解耦方案 v1→v3):旧 ArkHelper TSFN 通道**已全部删除**,所有系统能力走 **typed bridge plugin** 模式。本 skill 是新增/修改 OHOS 系统能力时的架构速查与操作手册。

## 架构总览

```
ArkTS (openharmony-ability)
  native_ability/src/main/ets/ability/type.ets
    PluginBase / AsyncPluginBase / SyncPluginBase (抽象基类)
  plugins/<name>/src/main/ets/<Name>Plugin.ets   ← 15 个桥接插件
    id="ohos.<name>"  requires=["ability"]  invokeAsync(action, payload)

Rust (openharmony-ability)
  crates/ability/src/bridge/mod.rs
    trait BridgePlugin (AsyncBridge / SyncBridge 双模式)
    impl_bridge_napi_type! 宏
    OpenHarmonyApp::bridge() -> Result<BridgeRuntime>
    BridgeRuntime::call_async::<P, Req, Resp>(action, req)
  crates/plugin-<name>/           ← 类型化 facade crate(如 ClipboardClient)
  crates/ability/src/<name>.rs    ← 核心特权能力可内联在 ability crate
    (account.rs / updater.rs 先例,不建新 crate)

注册链路
  EntryAbility.ets bridgePlugins 数组 new LazyPlugin(() => new XxxPlugin())
  ├─ tauri-cli 模板: crates/tauri-cli/templates/mobile/open-harmony/
  │    entry_{desktop,mobile}/.../EntryAbility.ets.hbs   ← 改后须重装 cli
  └─ examples/api: gen/ohos/entry_{desktop,mobile}/.../EntryAbility.ets
       (gen 不重生成时手改可持久,但 re-init 会覆盖 → 改模板为准)
```

**当前 15 插件**:app-control / account / autostart / clipboard / deep-link / files / global-shortcut / menu / permission / resource / statusbar / updater / url / webview / window(pack-plugins.ps1 `$plugins` 列表)。

**核心特权 vs 通用插件**:15 插件中 **13 个**建 `plugin-*` facade crate,**2 个**(account/updater)按核心特权定性内联 ability crate,经 `HuaweiAccount::new(&OpenHarmonyApp) -> Result<Self>` / `app.updater() -> Result<Updater>` 消费。account(非 default)与 updater(default 中)由 feature cfg 门控。

## 场景 A:新增一个桥接能力(标准步骤)

1. **ArkTS 插件**(5 文件,从 `plugins/clipboard/` 复制改):
   - `plugins/<name>/oh-package.json5`(name=`@ohos-rs/ability-plugin-<name>`,deps `@ohos-rs/ability: file:../../native_ability`)
   - `src/main/ets/<Name>Plugin.ets`:继承 `AsyncPluginBase`,`id = "ohos.<name>"`,`requires = ["ability"]`,`invokeAsync` 按 action 分发
   - `index.ets` / `build-profile.json5` / `src/main/module.json5`(module=`plugin_<name>`)
2. **pack-plugins.ps1**:`$plugins` 数组追加一行 + 计数注释同步(如 15→16)
3. **Rust 侧**:
   - 通用能力:新建 `crates/plugin-<name>/`,参照 `plugin-clipboard`(BridgePlugin impl + `#[napi(object)]` Req/Resp struct + `impl_bridge_napi_type!` + `call_async`)
   - 核心特权:内联 `crates/ability/src/<name>.rs`,破坏性 API `Xxx::new(&OpenHarmonyApp) -> Result<Self>` 持 BridgeRuntime
4. **EntryAbility 注册**:cli 模板 .hbs 加 import + `new LazyPlugin(() => new XxxPlugin())`;gen/ohos 两个 EntryAbility.ets 手动同步(或重 init)
5. **重建 HAR + 构建部署**(见下)

## 场景 B:适配新 Tauri 插件模块到 OHOS

把 plugins-workspace 的一个插件(如 notification/sql/nfc)适配到鸿蒙。bridge 层(场景 A)只是其中一环,完整流程:

### 0. 前置判断
- 能力**需要系统能力**(ArkTS API)→ 先按场景 A 补 bridge 层,再做本流程
- **纯 JS/Rust 逻辑**(无系统能力调用)→ 只需 cfg 接入(步骤 1-3),无 bridge 层

### 1. 上游结构分析
读插件 `plugins/<name>/src/`:`lib.rs`(cfg 矩阵)、`commands.rs`(命令面)、`desktop.rs`/`mobile.rs`(平台实现分层)。产出:哪些命令需要 OHOS 实现、复用 desktop 还是 mobile 层逻辑。

### 2. 选接入形态(两个已验证先例)
- **形态 1——既有插件补 OHOS**(clipboard-manager/notification 先例):平台层文件内加 `#[cfg(target_env = "ohos")]` 专属段调用 facade;`lib.rs` 的门控从 `cfg(desktop)` 扩成 `cfg(any(desktop, target_env = "ohos"))`、原 desktop 段收紧为 `cfg(all(desktop, not(target_env = "ohos")))`。适合插件已有跨平台分层、OHOS 可复用其命令面
- **形态 2——OHOS 专属新插件**(huawei-account 先例):独立 `src/ohos.rs`(`#[cfg(target_env = "ohos")]`,含 `#[tauri::command]`) + `commands.rs`/`models.rs`,lib.rs 按 target 分流。适合 OHOS 独有能力

### 3. Cargo.toml
OHOS target 段按形态声明依赖(**path 都是三个 `..`**,从 `plugins-workspace/plugins/<name>/` 解析到仓库根;facade crate 不在 workspace [patch.crates-io] 表内,必须显式带 path):
```toml
# 形态 1(经 facade crate)—— clipboard-manager 先例:
[target.'cfg(target_env = "ohos")'.dependencies]
openharmony-ability-plugin-clipboard = { path = "../../../openharmony-ability/crates/plugin-clipboard" }

# 形态 2(核心特权,直依赖 ability crate + feature)—— huawei-account 先例:
[target.'cfg(target_env = "ohos")'.dependencies]
openharmony-ability = { path = "../../../openharmony-ability/crates/ability", features = ["account"] }
```
- Linux 依赖段必须加 `not(target_env = "ohos")`(铁律#2,否则拉 gtk/gio-sys)
- 若需给 tauri 开 `wry` feature,可用 `cfg(any(target_os = "ios", target_env = "ohos"))` 段(notification 先例:与 iOS 共用声明)

### 4. 桥接层对接(形态内调用方式)
- 通用能力:经 plugin-* facade 的类型化 client(如 `ClipboardExt::clipboard()`)
- 核心特权:从 `tauri::ohos::APP` 锁取 app(MutexGuard **在 await 前 drop**),调 `HuaweiAccount::new(&app)`/`app.updater()`
- 注意 feature unification:消费者可能 `default-features=false` 不开 `wry`——桥接初始化调用若依赖 wry 相关组件需 `#[cfg(feature = "wry")]` 门控(tauri app.rs 先例)

### 5. examples/api 接入
- `examples/api/src-tauri/Cargo.toml` 加 path 依赖(`../../../../plugins-workspace/plugins/<name>`)
- 前端测试页 + invoke 命令绑定;需要 JS API 时改插件 `guest-js/` 并重建 dist-js

### 6. 构建与验证
- **dist-js 防 stale**:run-tests.sh 的 prerequisites 会自动 pnpm build 全部插件 dist-js——手动构建时勿漏(notification dist-js 过期曾致假失败)
- `cargo check` 双侧(plugins-workspace 内该插件包;注意 workspace patch 块已把 tauri 栈指向本地 fork)
- 真机验证走 ohos-build skill 流程
- **grep 盲区教训**:手动测试按钮经 前端→cmd.rs→facade 间接调用,**grep 插件仓源码/autotest 都抓不到**这类调用链;判"是否有消费者"必须追 `#[tauri::command]` 注册表与前端 invoke

### 推荐工作流
用 ohos-debug skill 的分工:design(方案+上游分析)→audit(复核)→apply(落地)→build(构建部署回归)。

## 构建链路(改 ArkTS 后必须)


```bash
# 1. 重建 HAR(pack.bat 必须经 cmd.exe 显式调用,git bash/PowerShell 直接跑会吃字符静默失败)
cd /d/xuqiu/tauri-3.0/openharmony-ability
cmd.exe //c "D:\\xuqiu\\tauri-3.0\\openharmony-ability\\pack.bat"
# 验证镜像含新代码:
ls package/src/main/ets/plugins/<name>/   # 应有 <Name>Plugin.ets
grep -rc "ohos.<name>" package/ | head -3

# 2. 构建(ohpm 同步由 CLI 自动完成,严禁手动 ohpm install)
cd /d/xuqiu/tauri-3.0/tauri/examples/api/src-tauri
OHOS_DEVICE_TYPE=desktop bash /d/xuqiu/tauri-3.0/tauri/.claude/skills/ohos-build/scripts/run-tests.sh "" desktop
```

改 tauri-cli 模板(.hbs)后:`cargo install --path crates/tauri-cli --locked` 重装才对**新** init 生效;重 init 会丢签名/main_pages/module.json5/项目 .ets,须备份恢复(详见 ohos-build skill「init 后补充步骤」)。

## Rust→ArkTS 桥接硬规则(踩过的坑)

| 规则 | 违反后果 |
|---|---|
| ArkTS interface 字段名与 NAPI wire **全 camelCase** 对齐 | tray `no valid icon data` / muda `json_data must be a string` 类静默失败 |
| 取 abilityContext 用 `context.abilityContext` + `requires:["ability"]`;禁止 `getAbilityContext()` global | 恒 null → `abilityInfo of null` |
| ArkTS 禁 `as any`/`as unknown`(arkts-no-any-unknown);旧代码迁移用 interface cast | ArkTS 编译错 |
| `#[napi(object)]` 内 `Vec<u8>` 跨桥是 `Array<number>` **非 Uint8Array**;ArkTS 侧 `new Uint8Array(len).set(arr)` 拷贝 | `.buffer.slice()` undefined 崩溃 |
| serde `Option` 字段加 `skip_serializing_if` | null(非 absent)触发 OHOS API 401 |
| **主线程禁 block_on / recv / recv_timeout 等 ArkTS 响应**——一律 fire-and-forget(TSFN)或异步事件(emit)回调 | 主线程死锁 THREAD_BLOCK_3S |
| 返回值走 `Promise<BridgeTypedValue>`(invokeAsync)或 emit 事件,不同步等结果 | 同上 |
| 跨 await 前先 drop `MutexGuard`(作用域块包住) | !Send 编译错/死锁 |
| `#[napi]` 生成的 JS 名默认 camelCase;多参数 TSFN 回调用 `FnArgs` 包裹 | 参数错位 |
| OHOS 代码 `cfg(target_env = "ohos")` 隔离;Linux 依赖加 `not(target_env = "ohos")`(铁律#2) | 拉进 gtk/gio-sys 破坏交叉编译 |

## 验证

- cargo check 双侧 0 error:`cargo check -p openharmony-ability` + `--target aarch64-unknown-linux-ohos`;ability crate 双侧 0 warning
- hilog 判断桥接断点:ArkTS 方法 ENTER 日志**有** → NAPI 通,问题在 ArkTS/系统层;**无** → Rust 侧断裂(常见:`let _ =` 吞错)
- 插件注册验证:启动后 `hilog -x | grep -aE '<PluginName>|not installed'` 无 "not installed for 'api_lib'" 报错

## 废弃通道(勿再使用/勿复活)

- ~~ArkHelper TSFN~~:`set_helper` 从未被调用(derive 重构后零调用方),`get_helper()` 恒 None;全部 eager TSFN init 已从 `render/xcomponent.rs` 删除,**不要重新添加**
- ~~menu/statusbar 旧 channel~~、~~deep-link 旧 API~~、~~cursor 全局~~、~~opener.rs/helper/{opener,window_info,account,updater}.rs~~:均已删除
- 判死标准:不能只 grep 直接 import——须追 **app handle ext 方法间接调用链**(如 `app.updater()`);且"有消费者"≠"链路通"(曾误判 account/updater 为活代码)

## 相关 skill

- 构建部署全流程 → `ohos-build`
- 调试工作流(设计/审计/落地/构建分工) → `ohos-debug`
- 详细设计规范 → `tauri-ohos-design/references/ohos-constraints.md`
