# Tasks: p1-ohos-continuation

## 1. ArkTS 生命周期扩展（native_ability，源码在 native_ability/src/main/ets/ability/ 下）

- [x] 1.1 `NativeAbility.ets` `onCreate`（签名已含 launchParam，AbilityConstant 已 import——审计核实）：读取 `launchParam.launchReason`，比较 `AbilityConstant.LaunchReason.CONTINUATION` 得 `isContinuation`；`onAbilityCreateWithWant` 调用点（`:169` per-module 循环内）payload 从 `{ uri }` 扩展为 `{ uri, isContinuation, parametersJson: JSON.stringify(want.parameters ?? {}) }`；不新增回调注入点、不改既有回调顺序
- [x] 1.2 `NativeAbility.ets` `onNewWant`（`:576-600`，签名已含 launchParam）：同样计算 `isContinuation`，`onNewWant({ uri, parametersJson, isContinuation })` 转发；AppStorage wantUri 更新等既有逻辑不动
- [x] 1.3 `type.ets`：`onAbilityCreateWithWant` payload 类型加 `isContinuation?: boolean; parametersJson?: string`；`NewWantData` 加 `isContinuation?: boolean`（审计已核实：napi-generated d.ts 为 `(arg: object)` 宽松类型无需改，两处对齐即可；package 镜像与源码目前 IDENTICAL，改后经 pack.bat 同步）

## 2. Rust lifecycle 链（crates/ability）

- [x] 2.1 `lifecycle.rs` `on_ability_create_with_want` 闭包（`:342-348`）：`get_named_property::<bool>("isContinuation").unwrap_or(false)` + `get_named_property::<String>("parametersJson").unwrap_or(String::new())`（同文件 `:179`/`:205-207` unwrap_or house style，勿用无先例的 Option 泛型）；调 `store_continuation` 两分支处理
- [x] 2.2 `lifecycle.rs` `on_new_want` 闭包（`:331-340`）：同上读 `isContinuation`（parametersJson 既有 required 读取保持）；既有 `store_want_parameters` 调用保持
- [x] 2.3 `app.rs`：新增 `CONTINUATION_RESTORE: Mutex<bool>` + `CONTINUATION_DATA: Mutex<String>` static 与 `store_continuation(is_continuation: bool, parameters_json: &str)` / `is_continuation_restore() -> bool`（peek）/ `take_continuation_data() -> String`（drain）三函数；store 语义：true → 写两者，false → false+清空
- [x] 2.4 `app.rs` `#[cfg(test)]` continuation 模块：take 两次第二次空串 / 非接续 store 清残留 / is_continuation_restore peek 不 drain 三组断言

## 3. plugin-continuation facade

- [x] 3.1 新建 `crates/plugin-continuation/{Cargo.toml, src/lib.rs}`：`ContinuationClient`（is_continuation_restore / take_continuation_data 委托 app.rs 函数）+ `ContinuationExt` trait on OpenHarmonyApp + `continuation()` 扩展方法；无 bridge 依赖、无 ArkTS 插件、无 pack-plugins 变更
- [x] 3.2 workspace 成员注册（如 crates/ 有 Cargo.toml workspace 则加 members）

## 4. 构建与验证

- [x] 4.1 HAR 重建：`cmd.exe //c pack.bat`（cmd 显式调用防吃字符）+ 手动校验 package 镜像 diff（type.ets/NativeAbility.ets 改动同步）+ HAR 内 grep 新字段标记
- [x] 4.2 cargo check：crates/ability 与 crates/plugin-continuation host + aarch64-unknown-linux-ohos 双侧 0 error
- [x] 4.3 run-ut.sh 真机执行：接续 UT 断言全绿（PACKAGE=openharmony-ability）
- [x] 4.4 真机部署后 hilog 抽查：普通冷启动路径 `isContinuation=false` 正常转发（无接续真实触发条件，仅验证链路代码生效、onCreate 无异常）
