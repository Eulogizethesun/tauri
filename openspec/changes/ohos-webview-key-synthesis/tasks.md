# ohos-webview-key-synthesis Tasks

- [x] 1. 探针定案：四层链路实证（系统连发 / onKeyPreIme 连发 Down / DOM 空壳+假对 / IME 插入）
- [x] 2. `native_ability/helper/key_synthesis.ets`：映射表 + Set 检测 + 修饰键跟踪 + controller 注册表 + shim 常量
- [x] 3. `MainPage.onKeyPreIme` fall-through 接线
- [x] 4. `WebviewPlugin`：controller 注册（含主窗口）+ shim 注入（scriptRules 并集修复）
- [x] 5. pack.bat 重建 HAR + ohpm 刷新 + hvigor 构建 + 真机部署
- [x] 6. 真机验收：长按连发 repeat=true、灰色对消失、文字无翻倍、无 KeySynthesis 告警
- [x] 7. manual_tests.md 补 T0 用例
- [x] 8. ohos-platform-limitations 补 ArkWeb keydown 退化记录
- [x] 9. 支持表"重复按键"行更新为最终定性
