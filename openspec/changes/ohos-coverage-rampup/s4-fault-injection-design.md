# S4 设计：openharmony-ability 故障注入（fault-injection）

> 由 design 子agent 产出（2026-08-23），**已经 audit 复核**（同日）：主体断言全部与实际代码一致；1 个 P1 已并入本文（timeout 分支改 throw）；4 个 P2 落地项已并入（feature 落点、requires: []、ack class 风格、stale cache）。design.md §四为骨架，本文为实现级设计。

## 审计修正记录

- **P1（已并入）**：原设计 timeout 分支 `return await new Promise(() => {})` 会泄漏 callState——`removeActiveCall` 绑定在 operation 的 `.finally`（BridgeHost.ets:898），pending Promise 使 operation 永不 settle、`.finally` 永不执行。**修正**：timeout 分支改为 `throw new Error("Bridge call '...' timed out after Nms")`（与 withTimeout reject 等价，operation reject → `.finally` 正常清理）。
- **P2（已并入）**：① feature `fault-injection = []` 必须落在 `crates/ability/Cargo.toml` `[features]`（examples/api 侧只做转发）；② FaultInjectionPlugin 显式 `readonly requires: []`（空依赖，UI context 就绪前即可注入）；③ ack 返回值用 class 实例 `new FaultInjectionAck(true)` 对齐 NodeAcknowledgement 先例；④ 改 ArkTS 后删 oh_modules + CompileArkTS 缓存（ohpm stale 陷阱）；pack.bat 必须从 cmd.exe 跑（字符吞噬坑），改后手动校验 package/ 同步。

## 0. 设计目标与口径

点亮 S2 之后剩余的 **bridge 失败类错误分支**——即 ArkTS bridge call 返回 `error(code)` / `throw exception` / 永不返回（timeout），导致 Rust 侧 `if let Err` / `.await?` / `.catch` handler 体从未执行的分支。S3 实测增益≈0 已证明 JS 可达的错误分支全部点亮完毕，剩余未覆盖错误分支几乎只能靠"在 ArkTS dispatch 边界注入失败"点亮。

产线约束：`cargo check`（无 `fault-injection` feature）+ 正常 hap 构建中**无任何注入代码生效**——单 boolean 读，开销可忽略。

## 1. ArkTS 侧：FaultInjectionRegistry + 注入点

### 1.1 新增文件

**`openharmony-ability/native_ability/src/main/ets/bridge/FaultInjection.ets`**（新增，约 120 行）

**(a) FaultInjectionRegistry 模块级单例**

```ts
interface FaultRule {
  pluginId: string;
  action: string;       // 空 = 匹配该 plugin 所有 action
  outcome: FaultOutcome;
  hits: number;         // 剩余命中次数；-1 = 永久直到 clear
  consumed: number;     // 已命中次数（仅日志/断言用）
}

type FaultOutcome =
  | { kind: "error"; code: number; message?: string }
  | { kind: "exception"; message: string }
  | { kind: "delay"; ms: number }
  | { kind: "timeout" };   // 永不 resolve

class FaultInjectionRegistry {
  private rules: FaultRule[] = [];
  private enabled: boolean = false;   // ← 运行时 flag

  enable(): void  { this.enabled = true; }
  disable(): void { this.enabled = false; this.rules = []; }
  setRule(rule: FaultRule): void { this.rules.unshift(rule); }
  clear(): void   { this.rules = []; }

  match(pluginId: string, action: string): FaultOutcome | undefined {
    if (!this.enabled) return undefined;
    for (let i = 0; i < this.rules.length; i++) {
      const r = this.rules[i];
      if (r.pluginId !== pluginId) continue;
      if (r.action !== "" && r.action !== action) continue;
      const outcome = r.outcome;
      r.consumed++;
      if (r.hits !== -1) { r.hits--; if (r.hits <= 0) this.rules.splice(i, 1); }
      return outcome;
    }
    return undefined;
  }
}
const FAULT_REGISTRY = new FaultInjectionRegistry();
```

match 语义：`hits` 控制一次性 vs 永久规则；`action===""` 匹配该 plugin 所有 action；规则 LIFO（unshift），后插优先。

**(b) FaultInjectionPlugin built-in bridge plugin**（仿 NodeSurfacePlugin，BridgeHost.ets:84-155）

```ts
const FAULT_PLUGIN_ID = "ohos.fault-injection";

class FaultInjectionPlugin implements AsyncBridgePlugin {
  readonly id = FAULT_PLUGIN_ID;
  readonly requires: BridgeContextRequirement[] = [];   // 无 context 要求
  readonly execution: "async" = "async";

  async invokeAsync(action, request, _ctx): Promise<BridgeTypedValue> {
    if (action === "enable")  { FAULT_REGISTRY.enable();  return ack(true); }
    if (action === "disable") { FAULT_REGISTRY.disable(); return ack(true); }
    if (action === "clear")   { FAULT_REGISTRY.clear();   return ack(true); }
    if (action === "set-rule") {
      const r = request.value as FaultRuleWire;
      FAULT_REGISTRY.setRule({ pluginId: r.pluginId, action: r.action ?? "", outcome: r.outcome, hits: r.hits ?? -1, consumed: 0 });
      return ack(true);
    }
    throw new Error(`Unsupported ohos.fault-injection action '${action}'`);
  }
}
```

**(c) BridgeHost 安装 hook**（仿 installNodeSurfacePlugin，BridgeHost.ets:353-360）：构造器末尾（line 278 之后）追加 `this.installFaultInjectionPlugin()`，直接 `this.plugins.set(...)`，不走 configurePlugins、不进 BridgePluginDeclaration、不进 EntryAbility bridgePlugins / STATIC_PLUGINS。

### 1.2 注入点（精确行号）

**注入点 A — `BridgeHost.invokeAsync`（BridgeHost.ets:860-911）**：line 887 `assertCallActive` 之后、line 888 真实 `invokeAsync` 之前插入：

```ts
const fault = FAULT_REGISTRY.match(pluginId, action);
if (fault !== undefined) {
  if (fault.kind === "error")    throw new Error(`${fault.code}:${fault.message ?? "fault-injected"}`);
  if (fault.kind === "exception") throw new Error(fault.message);
  if (fault.kind === "delay") {
    await new Promise<void>((r) => setTimeout(r, fault.ms));
    // delay 后 fall through 到正常 invokeAsync
  }
  if (fault.kind === "timeout") {
    // 【audit 修正】不返回 pending Promise（会泄漏 callState——removeActiveCall 绑定在
    // operation .finally，pending 使其永不执行）。改 throw 超时格式 Error：
    // 与 withTimeout reject 等价，operation reject → .finally 正常清理。
    throw new Error(`Bridge call '${pluginId}.${action}' timed out after injected timeout`);
  }
}
const result = await asyncPlugin.invokeAsync(action, request, this.callContext(...));
```

**注入点 B — `BridgeHost.invokeSync`（BridgeHost.ets:913-952）**：line 944/945 之间插入同构块（sync 路径只支持 error/exception——不能阻塞 NAPI callback 线程）。

**为何选这两点**：钉在 dispatch 层、所有 plugin 调用必经；`lookup` 已校验 plugin 存在——注入只对真实存在的 plugin 生效；error/exception 走 throw → ArkTS Promise reject → Rust 侧 `attach_promise` 的 `.catch`（bridge/mod.rs:1025-1033）→ `send_once_cell(&reject_sender, Err(message))` → `call_raw` `.map_err`（mod.rs:886）返回 Err。timeout 让 `withTimeout`（BridgeHost.ets:1696-1718）触发 onTimeout→reject。

## 2. Rust 侧：set_rule / clear 命令 + wire 格式

### 2.1 注册位置

仓：openharmony-ability（铁律#1）。新增 `crates/ability/src/fault_injection.rs`（约 90 行），lib.rs 挂 feature-gated module。

### 2.2 Wire 格式

```rust
#[napi(object)]
#[derive(Clone, Debug)]
pub struct FaultRuleWire {
  pub plugin_id: String,        // → pluginId；如 "ohos.window"
  pub action: Option<String>,   // → action；None = 匹配所有 action
  pub outcome: FaultOutcomeWire,
  pub hits: Option<i32>,        // → hits；None = -1（永久）
}

// napi-derive-ohos 对 tagged union enum 支持有限，用 struct + kind 字段：
#[napi(object)]
#[derive(Clone, Debug)]
pub struct FaultOutcomeWire {
  pub kind: String,             // "error" | "exception" | "delay" | "timeout"
  pub code: Option<i32>,
  pub message: Option<String>,
  pub ms: Option<u32>,
}
impl_bridge_napi_type!(FaultRuleWire, "ohos.fault-injection.SetRuleRequest");

#[napi(object)]
#[derive(Clone, Debug, Default)]
pub struct FaultInjectionAck { pub accepted: bool }
impl_bridge_napi_type!(FaultInjectionAck, "ohos.fault-injection.Ack");
```

JSON 示例（前端 `invoke('fault_injection_set_rule', { rule })`）：

```json
{ "pluginId": "ohos.window", "action": "set-fullscreen", "outcome": { "kind": "error", "code": 1300004, "message": "injected" }, "hits": 1 }
```

### 2.3 下发通道

经现有 `bridgeInvoke` TSFN（BridgeClient::call_raw），plugin_id = "ohos.fault-injection"。built-in 不进 Rust BridgePluginDeclaration，不能走 `call_async::<P>`，改用 crate-private 透传：

```rust
impl BridgeClient {
  #[cfg(feature = "fault-injection")]
  pub(crate) async fn call_fault_injection(&self, action: &str, request: FaultRuleWire) -> Result<FaultInjectionAck> {
    self.call_raw::<FaultRuleWire, FaultInjectionAck>("ohos.fault-injection", action, request, BridgeCallOptions::default()).await
  }
}
```

`call_raw`（bridge/mod.rs:820）现为 private——提升为 pub(crate)。

### 2.4 对外 facade（OpenHarmonyApp 方法，feature-gated）

app.rs 追加 `set_fault_rule(rule)`（首次调用自动 enable）与 `clear_fault_rules()`。enable/clear/set-rule 的 request 体各自带合法 typeName（NoopRequest/SetRuleRequest/Ack）。

### 2.5 tauri command（examples/api）

cmd.rs 追加（仿 dump_coverage at cmd.rs:1820）：

```rust
#[cfg(all(target_env = "ohos", feature = "fault-injection"))]
#[command]
pub async fn fault_injection_set_rule(app: tauri::AppHandle, rule: serde_json::Value) -> tauri::Result<()> {
  let oha_app = tauri::ohos::APP.lock()...as_ref().ok_or(...)?.clone();
  let wire: FaultRuleWire = serde_json::from_value(rule)?;
  oha_app.set_fault_rule(wire).await.map_err(...)?;
  Ok(())
}
// + fault_injection_clear
```

`tauri::ohos::APP` 是 `Mutex<Option<OpenHarmonyApp>>`（tauri/crates/tauri/src/ohos.rs:18），先例 window/mod.rs:62。

### 2.6 feature 声明

examples/api Cargo.toml：`fault-injection = ["openharmony-ability/fault-injection"]`；oha crates/ability/Cargo.toml：`[features] fault-injection = []`。cov-build.sh 构建时传 `--features cov-dump,fault-injection`。

## 3. feature 门控（产线零代码）

| 层 | 门控 | 产线行为 |
|---|---|---|
| Rust facade/bridge helper/module | `#[cfg(feature = "fault-injection")]` | 不编译 |
| examples/api command | `cfg(all(target_env="ohos", feature="fault-injection"))` | 命令不存在，invoke reject |
| ArkTS FaultInjection.ets | 无条件编译，运行时 flag | `enabled===false`，match 首行短路返回 |

ArkTS 运行时 flag：只有 Rust 侧（feature on）调 `enable` 才置 true。产线无调用方 → 永不 enable → 零注入零开销。

产线验证：`cargo check`（无 feature）零 fault 符号；hap 中 ArkTS 文件存在但无 Rust 调用方。

## 4. 铁律合规自查（design 子agent 自评，待 audit 复核）

- 铁律#1 ✓：注入点/facade 全在 openharmony-ability；examples/api 只调 Rust facade
- 铁律#2 ✓：全部 Rust 代码 feature 门控；command 加 target_env="ohos"
- 铁律#3 ✓：与 desktop/mobile 无关，不加形态 cfg
- NAPI/TSFN ✓：走既有 NonBlocking TSFN；#[napi(object)] camelCase；timeout 返回 pending Promise 不阻塞主线程
- pack/HAR：pack.bat xcopy 全量拷 native_ability ets tree，新文件自动进 HAR，无需改 pack.bat（待 audit 验证）
- gen/ohos：built-in 不进 EntryAbility/STATIC_PLUGINS/BridgePluginDeclaration，模板零改动（待 audit 验证 NodeSurfacePlugin 链路）

## 5. 用例设计（52 个注入用例）

对照 uncovered-fns-s2.json 按"点亮哪个 Err handler"分组。每用例 = (pluginId, action, outcome)；用例间 clear 防串扰。

### 5.1 oha plugin-webview WebviewHandle 系列（15 用例，~110 exec）
set-zoom/set-bounds/set-visible/set-background-color/set-web-debugging-access/reload/focus/set-cookie → error/exception；controller-request/web-page-snapshot → timeout；register-https-intercept/clear-attached-state/remove/create → error；""（全量）→ error 1300004。

### 5.2 oha plugin-window（8 用例，~45 exec）
set-fullscreen/set-focusable/set-focus/query-avoid-area/set-decorations/set-size → error；set-position → timeout；create → error。

### 5.3 oha statusbar/menu/clipboard/global-shortcut（8 用例，~40 exec）
statusbar add 401/remove/update-menu；menu set-items/popup(timeout)；clipboard write-text error / read-text timeout；global-shortcut register error。

### 5.4 bridge/mod.rs attach_promise + call_raw（6 用例，~80 exec）
ohos.window "" exception/error/timeout 三连 → attach_promise catch + call_raw map_err + withTimeout reject；ohos.webview "" exception；ohos.node create-container error；ohos.account login timeout。

### 5.5 oha app/lifecycle/waker（5 用例，~25 exec）
node mount-into-root / updater check / url open / permission request timeout / resource get。

### 5.6 tauri-runtime-wry / tauri Err 消费链（8 用例，~90 exec）
注入 oha facade 失败点亮 tauri-runtime-wry/src/lib.rs（1334 uncov，最大块）与 tauri/src/app.rs（423 uncov）的 Err handler：window set-size/maximize/set-minimized/set-decorations、webview set-zoom/set-position/create(error)/print(timeout)。

### 5.7 串扰/delay 验证（2 用例）
全量污染后 clear 生效验证；delay 50ms 后正常返回验证。

### 5.8 量化预估

| 组 | 用例 | 估点亮 exec |
|---|---|---|
| webview facade | 15 | ~110 |
| window facade | 8 | ~45 |
| 其他 oha plugin | 8 | ~40 |
| bridge attach_promise | 6 | ~70 |
| oha misc | 5 | ~25 |
| tauri/tao/wry handler | 8 | ~90 |
| 串扰/delay | 2 | ~5 |
| **合计** | **52** | **~385 exec** |

- oha 增量 ~240 exec：63.5% → ~68.9%（+5.4pt）
- team 增量 ~385 exec：62.8% → **~65.5%（+2.7pt）**；保守估（错误沿调用链向上传播多帧点亮），实际可能 +400-500 exec（+3-3.5pt）
- 显式错误构造行覆盖：~0 → **~65%**（验收 ≥60% 达标）

## 6. 风险与回退

| 风险 | 缓解 |
|---|---|
| 规则残留串扰 | 每用例 teardown clear；多数用例 hits:1 自动移除 |
| timeout 注入与 runner 3s/5s 超时交互 | timeout 用例 ≤3 个、hits:1、放最后一组；或用 delay(2500) 配合 |
| delay 线程安全 | ArkTS 单线程事件循环，match 在 dispatch 同步段，无真并发 |
| 产线回归 | feature 全门控 + ArkTS flag 短路；audit 复核产线零符号 |
| pack/HAR stale 缓存 | 删 oh_modules + CompileArkTS 缓存；cov-build.sh 含 pack.bat + 卸载重装 |
| built-in 注册时序 | BridgeHost 构造器安装，早于 configurePlugins/activateAbility |

## 7. 实施步骤（apply 文件清单）

| 步 | 仓 | 文件 | 改动 | 行数级 |
|---|---|---|---|---|
| 1 | oha | native_ability/.../bridge/FaultInjection.ets | 新增 | +120 |
| 2 | oha | native_ability/.../bridge/BridgeHost.ets | 注入点 A/B + 构造器安装 + import | +35 |
| 3 | oha | crates/ability/Cargo.toml | feature 声明 | +1 |
| 4 | oha | crates/ability/src/lib.rs | feature-gated module | +2 |
| 5 | oha | crates/ability/src/fault_injection.rs | 新增 wire 类型 | +90 |
| 6 | oha | crates/ability/src/bridge/mod.rs | call_raw pub(crate) + call_fault_injection | +15 |
| 7 | oha | crates/ability/src/app.rs | set_fault_rule/clear_fault_rules | +25 |
| 8 | tauri | examples/api/src-tauri/Cargo.toml | feature 声明 | +1 |
| 9 | tauri | examples/api/src-tauri/src/cmd.rs | 两命令 | +35 |
| 10 | tauri | examples/api/src-tauri/src/lib.rs | invoke_handler 注册 | +3 |
| 11 | tauri | examples/api/src/lib/tests/fault-injection-generated.ts | 52 用例 | +200 |
| 12 | tauri | examples/api/src/views/TestRunner.svelte | 挂载 + clear | +8 |
| 13 | — | cov-build.sh | --features cov-dump,fault-injection | +1 改 |
| 14 | oha | pack.bat / gen/ohos 模板 | **零改动**（xcopy 覆盖 / built-in 不进模板） | 0 |

验证顺序：cargo check（feature on）→ cargo check（无 feature 零符号）→ pack.bat → cov-build → 52 用例跑 → 回收合并 → 对照 §5.8 预估。

## 关键文件路径索引

- ArkTS 注入点：`openharmony-ability/native_ability/src/main/ets/bridge/BridgeHost.ets`（invokeAsync 860-911 / invokeSync 913-952 / 构造器 267-278 / NodeSurfacePlugin 先例 84-155、353-360 / withTimeout 1696-1718）
- Rust bridge：`openharmony-ability/crates/ability/src/bridge/mod.rs`（call_raw:820 / attach_promise:997-1046 / callee_handled::<false>:1223）
- facade 先例：`openharmony-ability/crates/ability/src/account.rs:46-54`
- OpenHarmonyApp.bridge()：`openharmony-ability/crates/ability/src/app.rs:517`
- cov-dump feature 先例：`tauri/examples/api/src-tauri/Cargo.toml:109`、`build.rs:135-159`、`src/cmd.rs:1820-1828`、`src/lib.rs:199-241`
- tauri::ohos::APP：`tauri/crates/tauri/src/ohos.rs:18`（先例 window/mod.rs:62）
- 覆盖率数据：`s2-cov/uncovered-fns-s2.json`、`s2-cov/s2-exec.json`
