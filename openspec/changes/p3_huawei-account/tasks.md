## 0. AGC 前置(包名 + 签名 + client_id)

- [x] 0.1 ~~改 examples/api bundle name 为 `com.richerfu.huaweiaccount`~~ **[D7-revised 2026-08-06] 已回退:examples/api 保持 com.tauri.api,华为账号功能移至新应用 examples/huawei-account/(包名 com.richerfu.huaweiaccount)**
- [x] 0.2 用户在 AGC 创建 HarmonyOS 应用(包名 `com.richerfu.huaweiaccount`),获取 client_id = `6917612311388969281`
- [x] 0.3 签名证书 SHA256 已登记 AGC(D8 方案 B):debug 证书 SHA256 `61:00:4F:7F:6F:53:59:09:9C:6D:68:6D:00:74:65:47:C9:F3:95:9E:C1:D6:A0:F4:62:51:95:14:6F:F3:A5:DA`(.cer 7/27 生成,Phase 2 构建复用 → 稳定)
- [x] 0.4 client_id + 签名 SHA256 已登记 AGC

## 1. module.json5 client_id 声明

- [x] 1.1 `entry_mobile/src/main/module.json5`:新增 module 级 `metadata: [{name:"client_id", value:"6917612311388969281"}]`
- [x] 1.2 `entry_desktop/src/main/module.json5`:同上

## 2. capabilities 授权

- [x] 2.1 新建 `capabilities/huawei-account.json`(`huawei-account:default`,windows main/main-*,全平台)

## 3. error 分类补全(Cancelled)

- [x] 3.1 `error.rs`:`from_napi_reason` 加 `"1001502012" => Error::Cancelled` + doc 更新
- [x] 3.2 UT `parse_cancelled` 通过(host cargo test 5/5)

## 4. 前端测试入口

- [x] 4.1 `plugins.ts` 加 huawei-account 测试用例(login/silentLogin manual + logout side-effect,直接 invoke,跨平台容错,断言 AccountInfo 形状)
- [ ] 4.2 确认 TestRunner 能列出并运行 huawei-account 用例(待构建验证)

## 5. 构建与设备验证

- [x] 5.1 `cargo test -p tauri-plugin-huawei-account`(host)通过(5 UT,含 parse_cancelled)
- [x] 5.2 ~~ohos-build 构建 examples/api~~ **[D7-revised] 改为 cargo tauri ohos run 构建 examples/huawei-account → BUILD SUCCESSFUL(SignHap 通过)→ 安装启动 com.richerfu.huaweiaccount ✓**
- [x] 5.3 设备实测 `silent_login`:已登录已授权 → 返回 AccountInfo(手动)— ✓ 已登录已授权静默返回 openId/unionId/authorizationCode
- [x] 5.4 设备实测 `login`:拉起交互界面 → 用户确认 → 返回 AccountInfo(手动)— ✓ 系统未登录时拉起交互面板(context 修复后),登录返回 AccountInfo
- [x] 5.5 设备实测未登录降级:`silent_login` 失败(1001502001)→ `login` 拉起 → 返回 AccountInfo(手动)— ✓ silentLogin 返回 `not-logged-in`(1001502001→NotLoggedIn)
- [x] 5.6 设备实测取消:登录界面取消 → `cancelled`(1001502012)(手动)— ✓ hilog 铁证 `1001502012:The user canceled the authorization.`→Cancelled
- [x] 5.7 复核 p1 移交项:`canIUse('.OAuth')` 生效;`AuthenticationController` 无参构造 forceLogin=true 路径正常(随 5.3-5.6 实测)— ✓ canIUse 设备返回 false 已移除;无参构造失败,已改传 context(见 design D6)
- [ ] 5.8 desktop 构建运行测试用例 → 三命令 `unsupported` 不崩溃(补 p2 7.4)(Windows host build.rs 缺 deep-link:default ACL,低风险遗留,后置)

## 6. 手动用例整理

- [x] 6.1 ~~huawei-account 手动用例追加到 examples/api/doc/manual_tests.md~~ **[D7-revised] 搬移到 examples/huawei-account/doc/manual_tests.md(6 个手动用例,步骤改"主界面按钮")**
