# Tasks: p1-ohos-accessibility

## 1. ArkTS 插件

- [x] 1.1 创建 `openharmony-ability/plugins/accessibility/` 5 文件骨架(oh-package.json5 / index.ets / build-profile.json5 / src/main/module.json5 / src/main/ets/AccessibilityPlugin.ets),从 plugins/clipboard 复制改
- [x] 1.2 实现 AccessibilityPlugin.ets:id=`ohos.accessibility`,requires=`["ability"]`,invokeAsync 分发 `get-font-scale` / `is-open-accessibility` / `is-touch-explore-enabled` / `subscribe-state-change` / `unsubscribe-state-change`;导入 `import { accessibility } from '@kit.AccessibilityKit'`,调 `isScreenReaderOpenSync()` / `isOpenTouchGuide()`(编译不过则退回旧名 isOpenAccessibility/isOpenTouchExploreState 并记录);全部 action try/catch 后 throw 结构化错误(BusinessError interface cast 先例),不做 {ok:false} 返回;interface 字段全 camelCase
- [x] 1.3 实现状态变化回调:subscribe 时 `accessibility.on('screenReaderStateChange')` → `context.invokeNativeSync("accessibility-state-changed", ...)`(notifyNative 先例,事件类型 Rust 侧 #[napi(object)] 声明);unsubscribe 与 onPluginDestroy 兜底 off

## 2. Rust facade

- [x] 2.1 创建 `openharmony-ability/crates/plugin-accessibility/`(Cargo.toml + src/lib.rs):BridgePlugin impl(ID/REQUIRED_CONTEXTS)、`#[napi(object)]` Req/Resp + `impl_bridge_napi_type!`、`AccessibilityError` 枚举(PermissionDenied/Unavailable/Other)
- [x] 2.2 实现 `AccessibilityClient`(AccessibilityExt 扩展 OpenHarmonyApp):get_font_scale / is_open_accessibility / is_touch_explore_enabled / subscribe_state_change / unsubscribe_state_change,经 `bridge.call_async`,全 `cfg(target_env = "ohos")`

## 3. 注册链路

- [x] 3.1 pack-plugins.ps1 `$plugins` 追加 accessibility 行 + 计数注释 15→16
- [x] 3.2 tauri-cli 模板 entry_desktop 与 entry_mobile 的 EntryAbility.ets.hbs 加 import + LazyPlugin 注册
- [x] 3.3 examples/api gen/ohos 两个 EntryAbility.ets 手动同步注册

## 4. 构建验证

- [x] 4.1 `cargo check -p openharmony-ability-plugin-accessibility` host + `--target aarch64-unknown-linux-ohos` 双侧 0 error(ability crate 双侧 0 warning)
- [x] 4.2 cmd.exe 显式跑 pack.bat 重建 HAR,验证 package/src/main/ets/plugins/accessibility/ 存在且含 `ohos.accessibility`;grep 校验 package 镜像与源一致
