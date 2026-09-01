# Manual Tests — Huawei Account Test App

> 前置:OHOS 设备(2in1/desktop),应用 `com.richerfu.huaweiaccount` 已安装启动,AGC 已配置 client_id + 签名 SHA256。
> 签名:`account.p12` + `tauriAccountDebug.p7b` + `tauriTest.cer`(手动签名套,见 openspec p3 design D8)。
> Account Kit 一键登录能力需 AGC 已授权(否则 login 报权限错误)。

## @tauri-apps/plugin-huawei-account

### MT-HUAWEI-ACCOUNT-01:login(已登录已授权,静默返回)

**前置**:系统已登录华为账号,且本应用已授权。

**步骤**:应用主界面 → 点 `login` 按钮

**预期**:不拉起交互面板,返回 `AccountInfo`:`openId`/`unionId`/`authorizationCode` 非空;`displayName`/`avatarUri`/`uid` 空字符串;`accessToken` null(选项 A)

---

### MT-HUAWEI-ACCOUNT-02:login(系统未登录,拉起交互面板)

**前置**:系统**未登录**华为账号(设置 → 退出华为账号)。

**步骤**:应用主界面 → 点 `login` 按钮

**预期**:拉起华为账号一键登录交互面板,登录后返回 `AccountInfo`

---

### MT-HUAWEI-ACCOUNT-03:silentLogin(未登录降级)

**前置**:系统**未登录**华为账号。

**步骤**:应用主界面 → 点 `silentLogin` 按钮

**预期**:不拉起 UI,直接失败,显示 `silentLogin error → not-logged-in`(code `1001502001`)

---

### MT-HUAWEI-ACCOUNT-04:login 取消

**前置**:系统未登录(或 logout 取消授权),使 login 能拉起面板。

**步骤**:应用主界面 → 点 `login` → 面板弹出后点**取消**

**预期**:显示 `login error → cancelled`(code `1001502012`)

---

### MT-HUAWEI-ACCOUNT-05:logout(取消授权)

**前置**:已登录已授权(MT-01 状态)。

**步骤**:应用主界面 → 点 `logout` 按钮

**预期**:显示 `logout → OK`。logout 取消的是**应用授权**,不是退出系统华为账号。

---

### MT-HUAWEI-ACCOUNT-06:silentLogin(logout 后,系统仍登录)

**前置**:系统**已登录**华为账号,刚执行过 logout(MT-05,应用授权已取消)。

**步骤**:应用主界面 → 点 `silentLogin` 按钮

**预期**:**仍静默成功返回 AccountInfo**(Account Kit 在系统账号在场时自动重新授权,logout 不能制造 silentLogin 失败)。silentLogin 失败只发生在**系统未登录**(MT-03)。

---

## 测试入口

应用主界面有 3 个按钮(login / silentLogin / logout),结果区显示返回的 AccountInfo JSON 或错误字符串。无 TestRunner/auto 测试框架(最小应用)。

## 构建运行

```bash
source D:/ohdev/tauri/.claude/skills/ohos-build/scripts/env.sh
cd D:/ohdev/tauri/examples/huawei-account/src-tauri
cargo tauri ohos run --device-type desktop
```

> 注:`cargo tauri ohos run` 路径无关(resolve_tauri_dir 自动定位)。ohos-build skill 脚本硬编码 examples/api,不能用于本应用。
> re-init(gen/ohos 重新生成)后需重新追加 `module.json5` 的 `client_id` metadata(模板不含)。
