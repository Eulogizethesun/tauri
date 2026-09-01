## Context

`tauri-plugin-deep-link` 负责 URI scheme 唤起处理。当前实现（`plugins-workspace/plugins/deep-link/src/lib.rs`）按平台分三路：Android（`register_android_plugin` + Channel 回调）、iOS/macOS（`RunEvent::Opened` 消费）、Desktop（CLI 参数 + 注册表/xdg）。

OHOS 适配的现状是**零实现且无法编译**，根因有三：
1. `init_deep_link`（`lib.rs:19-85`）仅 android/ios/desktop 三分支，OHOS（`target_os="linux"` + `cfg(desktop)=false`）无匹配分支 → 函数无返回值。
2. `register`/`unregister`/`is_registered` 的 `#[cfg(target_os="linux")]` 误命中 OHOS（`target_os="linux"`）→ 错误调用 `xdg-mime`。
3. `Cargo.toml:45` 误把 `rust-ini` 引入 OHOS。

但同时，OHOS 运行时**已端到端产生 `RunEvent::Opened`**（`NativeAbility.onNewWant` → `lifecycle Event::NewWant{uri}` → `tao Event::Opened{urls}` → `tauri-runtime-wry` → `RunEvent::Opened`），且 cfg 已含 `target_env="ohos"`。`single-instance` 插件（`ohos-single-instance` spec）已验证此路径。deep-link 的 `on_event` 仅因 `#[cfg(any(macos, ios))]` 排除而丢弃了该事件。

**约束**（三条铁律）：OHOS 代码用 `cfg(target_env="ohos")` 隔离；Linux 依赖加 `not(target_env="ohos")`；不影响其他平台。deep-link 是 plugins-workspace 插件仓，事件驱动型，无需 ArkTS Plugin 类。但首启动 `get_current` 需读取冷启动 `onCreate` 的 `want.uri`，该能力 openharmony-ability 当前缺失（`onCreate` 未提取 uri），需在 openharmony-ability 补 `take_initial_want_uri` getter（复刻 `take_want_parameters` 模式），涉及 openharmony-ability 的 ArkTS（NativeAbility.ets/type.ets）+ Rust（app.rs/lifecycle.rs）改动——这是 getter 通道，非插件类。

## Goals / Non-Goals

**Goals:**
- deep-link crate 在 OHOS target `cargo check` 通过
- app 运行中收到 `onNewWant` 有效 URI 时 emit `deep-link://new-url`
- 首启动（冷启动 `onCreate`）由链接拉起时 `get_current` 返回初始 URI（经 openharmony-ability `take_initial_want_uri` getter，由 `init_deep_link` 注入 `current`）
- 正确处理 OHOS 空 URI 再启动语义（不误触发）
- `register`/`unregister` 在 OHOS 返回 `Ok(())`（no-op），`is_registered` 返回 `Ok(false)`
- 零 tauri/tao/wry 核心仓改动

**Non-Goals:**
- scheme 注册声明（module.json5 skills 注入）→ Phase 2
- 前端测试用例与 examples → Phase 3
- 动态运行时 scheme 注册（OHOS 不支持，永久 Non-Goal）

## Decisions

### D1: 复用 `RunEvent::Opened` 事件链路，而非新建 ArkTS 插件
**选择**：在 `on_event` 闭包扩展 cfg 含 `target_env="ohos"`，消费现成 `RunEvent::Opened{urls}`，emit `deep-link://new-url`。

**理由**：
- 链路已端到端就绪（tao `mod.rs:595` → tauri-runtime-wry `lib.rs:4737` → tauri `app.rs:2675`），`single-instance` 已验证
- deep-link 是事件驱动型（非命令型），无需 ArkTS Plugin 类、无需 `register_ohos_plugin`、无需进 `STATIC_PLUGINS`
- 与 iOS 分支（`lib.rs:66-71`）行为一致：`init_deep_link` 仅返回 `DeepLink{app, current, config}`

**备选（否决）**：仿 Android 建 ArkTS `DeepLinkPlugin` + `register_ohos_plugin` + `run_mobile_plugin("setEventHandler", Channel)`。否决理由：OHOS 的 `onNewWant` 不经 ArkTS 插件广播，而是直接进 runtime 事件循环（与 Android 无 `RunEvent` 直达不同）；Android 的 Channel 模式是为弥补该缺口，OHOS 无此缺口，引入 ArkTS 插件属冗余。

### D2: 过滤 `urls.is_empty()`
**选择**：OHOS 分支在 `on_event` 中 `if !urls.is_empty()` 才 emit + 更新 `current`。

**理由**：OHOS singleton 模式下 `onNewWant` 每次再启动都触发，即使无 URI 也 emit 空 `Vec`（`tao mod.rs:596` `uri.is_empty() → vec![]`）。macOS/iOS 不会产生空 `Opened`，故现有 `#[cfg(any(macos, ios))]` 分支无需过滤；OHOS 必须过滤，否则前端 `on_open_url` 监听器会在无链接的再启动时误触发。

**实现**：由于 OHOS 与 macOS/iOS 共用同一 `on_event` 闭包，过滤逻辑对三者都安全（macOS/iOS 本就不产生空 `urls`），故直接在扩展后的统一分支内加 `if !urls.is_empty()`，无需再按平台细分。

### D3: register/unregister no-op，is_registered 返回 Ok(false)
**选择**：OHOS 独立分支（见 D4）中，`register`/`unregister` 返回 `Ok(())`（no-op），`is_registered` 返回 `Ok(false)`。

**理由**：OHOS scheme 声明通过 module.json5 skills（Phase 2），是构建时静态声明，无运行时动态注册 API。`register`/`unregister` no-op 使前端代码无需针对 OHOS 特殊处理（调用不报错，实际 scheme 由 module.json5 声明）。`is_registered` 返回 `Ok(false)` 表明 OHOS 无运行时注册状态（保守语义）。与 iOS（返回 UnsupportedPlatform）不同——这是 OHOS 的明确选择，使前端体验更平滑。

### D4: cfg 修复——独立 OHOS 分支 + Linux 分支隔离
**选择**：
- 为 `register`/`unregister`/`is_registered` 新增独立 `#[cfg(target_env="ohos")]` 分支（D3 的 no-op 语义）
- Linux 分支：`#[cfg(target_os="linux")]` → `#[cfg(all(target_os="linux", not(target_env="ohos")))]`（避免 OHOS 同时命中 Linux 分支与 ohos 分支导致 E0592 重复定义）
- fallback 分支 `#[cfg(not(any(windows, target_os="linux")))]` 不变（OHOS 的 `target_os="linux"` 使其不命中 fallback，由 ohos 分支处理；macOS/iOS 仍命中 fallback 返回 UnsupportedPlatform）

**理由**：OHOS 的 `target_os="linux"`，若不加独立 ohos 分支，OHOS 会命中 Linux 分支调 `xdg-mime`；若只加 ohos 分支不改 Linux 分支，OHOS 同时命中两个分支导致编译错误。故须：ohos 分支处理 OHOS，Linux 分支加 `not(ohos)` 排除 OHOS。fallback 无需改。此方案比"改 fallback cfg"更清晰——OHOS 有独立的 no-op 语义，与 macOS/iOS 的 UnsupportedPlatform 分开。

**备选（否决，原 D4）**：双分支联动改 fallback cfg。否决理由：fallback 返回 UnsupportedPlatform，无法表达 OHOS 的 no-op 语义；且 OHOS 需与 macOS/iOS 不同行为，独立分支更清晰。

### D5: `init_deep_link` OHOS 分支不调 `register_ohos_plugin`
**选择**：OHOS 分支返回 `DeepLink{app: app.clone(), current: Default::default(), config: api.config().clone()}`，与 iOS 分支（`lib.rs:66-71`）完全一致。

**理由**：deep-link 是事件驱动型，事件经 `RunEvent::Opened` 直达 `on_event`，无需 ArkTS 插件句柄。`DeepLink` 结构使用 `#[cfg(not(target_os="android"))]` 的 imp 模块（含 `current: Mutex` + `config`），OHOS 天然落入该模块，与 iOS 共用。

### D6: 首启动 get_current 提前到 Phase 1（take_initial_want_uri 由 init 注入 current）
**选择**：Phase 1 实现首启动 `get_current`。`openharmony-ability` 新增 `take_initial_want_uri()` getter（复刻 `take_want_parameters`，pull 模型，无新 Event 变体），在 `NativeAbility.onCreate` 提取 `want.uri` 存储；deep-link 的 `init_deep_link` OHOS 分支在返回前调 `take_initial_want_uri()`，将首启动 uri 解析为 `Url` 存入 `current`。`get_current` 无需特殊处理，统一返回 `current`（首启动值由 init 注入，运行中值由 `on_event` 更新）。

**理由**：`RunEvent::Opened` 仅 `onNewWant`（再启动）触发，`onCreate`（冷启动）不触发（`ohos-single-instance` spec 确认"首次启动不触发 callback"）。首启动链接读取需 `onCreate` 的 `want.uri`。`take_want_parameters`（`app.rs:792/795/812`）已验证"ArkTS 主线程 store → Rust 事件循环线程 take"的跨线程 Mutex 模式，`take_initial_want_uri` 完全复刻。get_current 是 pull 模型，无需新 Event 变体。将 take 放在 `init_deep_link`（而非 get_current）避免 take 一次性语义导致的多次调用问题——init 只调一次，首启动值一次性注入 current，后续 get_current 直接读 current。

**时序**：`onCreate` 在 app 启动早期同步执行 store；`init_deep_link` 在 plugin setup 阶段（onCreate 之后）执行 take，时序天然满足。

### D7: build.rs 无需结构性改动（审计修正）
**选择**：Phase 1 不修改 deep-link `build.rs` 的 `try_build()` 调用（不新增 `.ohos_path()`）。

**理由**：`tauri-plugin` 的 `mobile::setup`（`tauri-plugin/src/build/mobile.rs:118-138`）OHOS 分支为 `if let Some(path) = ohos_path`——当 `ohos_path=None` 时**安全跳过、不报错**。OHOS 的 `CARGO_CFG_TARGET_OS="linux"` 走 `match` 的 `_` 分支，`android_path` 仅在 `target_os="android"` 时处理（`mobile.rs:74`），不会误触发 Android 复制逻辑。Phase 1 deep-link 无 ArkTS 插件，不需要 `ohos_path` 复制 tauri-api 框架。`update_android_manifest`（`build.rs:97`）与 entitlements（`build.rs:109`）仅在 `TAURI_DEEP_LINK_PLUGIN_CONFIG` 环境变量设置时执行，OHOS 构建流程不设置该变量时自动跳过。

**备选（否决）**：新增 `.ohos_path("openharmony")` + 空 openharmony 目录。否决理由：deep-link Phase 1 无 ArkTS 插件，`ohos_path` 仅用于复制 tauri-api 框架到插件 openharmony 目录，无插件实现时无意义，徒增空目录。Phase 2 的 scheme 注入若需介入 module.json5，届时再评估是否引入 `ohos_path`。

### D8: openharmony-ability 改动清单（take_initial_want_uri getter）
**选择**：在 openharmony-ability 新增 4 文件改动，建立 `onCreate want.uri → Rust getter` 通道：

| 文件 | 改动 |
|------|------|
| `crates/ability/src/app.rs` | 新增 `static INITIAL_WANT_URI: Mutex<String>` + `pub(crate) fn store_initial_want_uri(&str)` + `pub fn take_initial_want_uri() -> String`（紧邻 `WANT_PARAMETERS`，`app.rs:789-820`）。`lib.rs:90` 的 `pub use app::*` 自动导出 `take_initial_want_uri` |
| `crates/ability/src/lifecycle.rs` | `WindowStageEventCallback`（:21-33）新增 `on_ability_create_with_want` 字段；`create_lifecycle_handle`（:61）创建闭包：从 ctx 取 `uri` → `store_initial_want_uri`。不投递 Event（pull 模型） |
| `native_ability/src/main/ets/ability/type.ets` | `WindowStageEventCallback`（:28-39）新增 `onAbilityCreateWithWant: (data: { uri: string }) => void` |
| `native_ability/src/main/ets/ability/NativeAbility.ets` | `onCreate`（:80）中 `onAbilityCreate`（:127）附近新增 `forEachLifecycle((lifecycle) => lifecycle.windowStageEventCallback.onAbilityCreateWithWant?.({ uri: want.uri ?? '' }))` |

**理由**：`take_want_parameters` 的 store 在 `on_new_want` 闭包（`lifecycle.rs:295`），该闭包已接收 `{uri, parametersJson}` 对象；而 `on_ability_create` 闭包（`lifecycle.rs:235-241`）签名 `move |_ctx|` 不接收 want 数据，故须新增 `onAbilityCreateWithWant` 闭包通道透传 uri。这是复刻时的唯一新增工作量。`index.d.ts` 由 NAPI 自动重新生成。

**备选（否决）**：扩展 `onAbilityCreate` 签名携带 uri。否决理由：改变现有 NAPI 契约（`index.d.ts:31`）和所有调用方，影响面大。新增独立闭包字段不破坏现有 `onAbilityCreate(restoredState)` 契约。

## Risks / Trade-offs

- **[空事件误触发]** → D2 过滤 `urls.is_empty()`；macOS/iOS 共用分支本就不产生空 `urls`，过滤对它们无副作用。
- **[cfg 分支冲突]** → D4 独立 ohos 分支 + Linux 分支加 `not(ohos)`，避免 E0592 重复定义；Step 5 审计逐函数核对 register/unregister/is_registered 三函数。
- **[非 OHOS 平台回归]** → 所有改动用 `cfg(target_env="ohos")` 或 `not(target_env="ohos")` 隔离；Linux 依赖排除不影响真 Linux（`rust-ini` 仍对 `all(target_os="linux", not(target_env="ohos"))` 生效）。
- **[openharmony-ability 改动跨 ArkTS+Rust]** → D8 复刻已验证的 `take_want_parameters` 模式，store/take 用 `Mutex<String>` 保证线程安全；新增 `onAbilityCreateWithWant` 闭包不破坏现有 `onAbilityCreate` 契约。
- **[take 一次性语义]** → `take_initial_want_uri` 读后清空；D6 将 take 放在 `init_deep_link`（只调一次），首启动值一次性注入 `current`，避免 get_current 多次调 take 取到空串。
- **[OHOS 多 Ability 场景]** → OHOS app 为 singleton 模式（`ohos-single-instance` spec 语境），`onNewWant`/`onCreate` 投递到主 Ability，无多实例竞态。
