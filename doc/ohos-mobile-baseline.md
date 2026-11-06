# OHOS mobile 形态基线（Mate 70 真机，2026-10-08/09）

> 内部验证记录。桌面（2in1）形态基线见 `ohos-test-coverage.md` 各轮与 2026-10-08 round-5（310 例 305✅）；本文记录 phone 形态基线的建立过程、修复链与终态。报告文件出处：`examples/api/device-report-1009-mobile-r8.md`（r7/r8 时代）、`examples/api/device-report-1013-mobile.md`（2026-10-13 检视修复批终验，313 例）、`examples/api/device-report-1009-desktop.md`（桌面零回归复验）。

## 一、概述

- **设备**：Mate 70（CLS-AL00，API 26，物理屏 1216×2688 px）
- **套件**：examples/api 自动化套件 mobile 形态（`OHOS_DEVICE_TYPE=mobile`，entry_mobile 模块），r1-r8 时代 311 例；2026-10-13 检视修复批起 313 例（+2 桌面专属 `skipOnMobile`）
- **终态结论**：
  - mobile：**167✅ / 0❌ / 146⏭**（313 例，2026-10-13 检视修复批终验 r9，`examples/api/device-report-1013-mobile.md`；r7/r8 311 例时代为 167✅/0❌/144⏭ 双跑稳定）
  - 桌面零回归：2026-10-09 HAD-W32 复验 **305✅ / 0❌ / 6⏭**（311 例），与 2026-10-08 round-5 基线（310 例 305✅/0❌/5⏭）✅/❌ 完全持平；唯一差异 = 新增 #137 NFC 用例在无 NFC 硬件的 HAD-W32 上按设计 skip（skip 理由串明示"needs an NFC-capable device"）

## 二、轨迹

| 轮次 | 例数 | ✅ | ❌ | ⏭ | 说明 |
|---|---|---|---|---|---|
| r1（旧 app，未含修复） | 311 | 168 | 138 | 5 | 首轮基线；138❌ 四类定性见 §三 |
| r5（修复链落位后） | 311 | 166 | 2 | 143 | footer 首次完整出现；2❌ = #294/#295 setInnerSize 5s 超时（后改 skip） |
| r6（终验） | 311 | 166 | 0 | 145 | **mobile 套件零失败收官**，exit 0；#291/#292 fail-fast 理由串完整落位 |
| r7/r8（NFC on） | 311 | 167 | 0 | 144 | #137 ⏭→✅（1382ms）；含弹窗钳制修复复验（7 行 Phone clamp 日志） |
| r9（检视修复批终验，2026-10-13） | 313 | 167 | 0 | 146 | 首跑 166✅/1❌（#138 步⑥：drain 步骤仍编码 F4 前的 scan 守卫顺序——非法 scan 不再结算挂起写入）；用例适配（⑥证守卫零副作用+⑦合法 scan 结算）后复跑零失败；force 前台重注册链实机复核（onForeground→notifyForeground→readerMode off/on 对） |
| 桌面复验（HAD-W32） | 311 | 305 | 0 | 6 | 2026-10-09；零回归（见 §一） |

## 三、r1 138❌ 四类定性

1. **mobile fail-fast 吞错链（真缺口，已修）**：tao desktop-only 门控（window.rs ~:472）的 Err 在 tauri 栈上不可见——runtime-wry `Message::CreateWindow` 变体无回复通道，`send_user_message` 内联跑完无条件 Ok → build() 返回 Ok → label-only 僵尸窗。上游同款设计，不可改共享代码。
2. **"Plugin not found: window"（≈26 例，上游设计）**：上游 plugin.rs 47 处 `#[cfg(desktop)]` 命令 mobile 构建编译期即无。
3. **menu/tray 106 例**：lib.rs `#[cfg(all(desktop, not(test)))]`，设计如此。
4. **平台差异长尾**：手机沙盒禁 exec 系统二进制（shell EACCES 13，#308/#309 skip）；autostart 设置页 URI `pc_app_setup_settings` 2in1 专属（#99 skipOnMobile）；手机 ArkWeb window.open native 不提供 URL（真 gap，已披露）；setInnerSize 手机全屏窗永不落地（#294/#295 skipOnMobile）。

## 四、修复链（全 mobile 门控，desktop 零变化，桌面复验见 §一）

1. **fail-fast 吞错链三处修**：① openharmony-ability `note_ui_ability_spawn_rejected`/`take_ui_ability_spawn_rejection`（crates/ability/src/window/mod.rs，消费式 label 键控）；② tao 门控前上移 label 解析+记痕（src/platform_impl/ohos/window.rs）；③ examples/api cmd.rs 四命令 build() Ok 后 `if mobile_form { take_... }` 填 mobile_fail_fast。
2. **套件冻结家族根因**：#99 autostart enable() 的 startAbility(设置页) 把调用方 UIAbility 最小化（AMS `MinimizeUIAbilityBySCB`）→ 30s lifecycle 检测超时 → Doze + `FreezeFreezeUnit` cgroup 冻结整个进程 → 套件 JS 停摆；被冻测试 duration ≡ 冻结时长。修复 = AutostartPlugin.ets 前置 `deviceInfo.deviceType === "phone"` 拒绝（返回 false → "rejected the requested operation"）。
3. **手机窗口溢出屏**：套件窗口事件测试各建 tauri 默认 800×600 logical 窗，tao 送 ArkTS 的 resize 值已是物理 px（2600×1950@密度3.25），WMS 对超屏子窗照单全收 → 窗比屏宽 2.1×、关闭按钮出屏。修复 = WindowManager.ets 两处 phone 钳制（createSubWindow 创建几何+顶点重锚、resizeWindow op 路径），`deviceInfo.deviceType === "phone"` 门控。
4. **capability 穿透**：run-app.json 漏 `allow-get-device-form`（加命令改四处：cmd.rs + build.rs AppManifest + capability + lib.rs generate_handler）。

## 五、NFC 专项

- **自动用例**：NFC 开启后 #138 techLists fail-fast 全链 ✅（NfcBarcode 单/混 scan 双拒、write 双拒、重复 write 零残留、合法 write 无标签正确 pending）；2in1 无 NFC 硬件从未跑过此链。drain 语义随检视轮 F4（scan 守卫前置）两段化：⑥非法 scan 证守卫零副作用（挂起合法写入不被触碰）、⑦合法 scan 做会话替换结算（写入收 'cancelled'）——会话 pending 时合法 write 被 'connected tag not found' 拒，合法 scan 是唯一替换路径；⑦收尾留 armed-but-replaceable 会话（promise 已挂 catch），后续请求可随时替换。
- **前台 force 重注册（检视轮 F1 修复实机复核）**：后台 ≥30s（cgroup 冻结窗）后回前台，`EntryAbility onForeground → [PluginManager] notifyForeground → [NfcPlugin] readerMode unregistered + registered` force 对完整落位（2026-10-13 11:19:46，后台 46s；同日上午两次自然熄屏/亮屏周期同序列）——armed 会话的注册丢失可重建。**端到端终证（同日 14:14-14:17）**：武装 → HOME 后台 40s（冻结窗内）→ 回前台 force 对（38ms）→ 物理贴 tag → 发现后 94ms resolve 出标签 payload → readerMode 干净注销——重建后的注册真实可用，非仅有重建日志。另实证一处长存活：一次武装 scan 在同进程跨后台/冻结 pending 达 2h55m（每次 resume 被 force 重建），最终被后续 scan 正常替换结算，promise 未永久悬挂。
- **NFC_TAG 仅靠插件 HAR 声明（检视轮 F7 负对照，三层实证；可复现步骤已固化至 plugins-workspace `plugins/nfc/README.md` 的 "Verifying the HAR-side NFC_TAG grant (negative control)" 小节——删 entry 声明→重编→`unzip -p <hap> module.json | grep NFC_TAG`→`bm dump` reqPermissionDetails→真机 NFC 用例+物理贴 tag）**：entry module.json5 删 NFC_TAG 重编（其余不变，.so 仅 build-id 噪声差）——①结构：打包 module.json 仍含全部 13 权限（NFC_TAG 挪至列表末尾追加位，entry 各权限原位不动 = HAR 合并 append 语义的直接证据）；②装机：`bm dump` 的 reqPermissionDetails 含 NFC_TAG；③行为：负对照机上套件 167✅/0❌/146⏭（#138 techLists 链真调 `tag.on('readerMode')`）+ 手动武装→物理贴 tag→resolve（arm 到结算 5.6s，无 201 Permission denied）。消费方免 entry 声明的契约成立。
- **物理标签 scan**：✅ `{id:[187,74,24,163], kind:["IsoDep","NfcA","NfcA","MifareClassic","Ndef"], records:[]}`，发现→派发→resolve→readerMode 干净注销全链 <100ms。
- **物理标签 write**：❌ 已定性为**平台限制非 port bug**——标签为双协议门禁卡（Mifare Classic 家族）；发现期 NDEF 探测成功于 MifareClassic 通道，但 `ndefTag.connect()` 落在 index 0 IsoDep 通道，而 OHOS `TagSession.connect()` 签名 `connect(): void` **无 tech 参数**（SDK tagSession.d.ts:85，弃用版 connectTag() 同样无参），无法选通道 → 该通道上标签非 NDEF → writeNdef 拒绝（3100201）。华为官方确认此点；建议的 MifareClassicTag 裸写扇区方案（重实现 MAD/TLV/鉴权）超出插件合理范围。标准单协议 NDEF 标签（NTAG213/215/216）上 write 应正常，无空白贴纸可实证，**以披露收口**。
- **`ParseNdefParamInner: Wrong argument type. Number Array expected.` 告警 = 良性**：OHOS `createNdefMessage` 双重载（`number[]` 在前 / `NdefRecord[]` 在后），native 先探测 number[] 重载失败打日志、再匹配 NdefRecord[] 重载成功（无 401 抛出，流程继续）。

## 六、已知限制与披露项（mobile 专属）

| 项 | 状态 |
|---|---|
| 手机沙盒禁 exec（shell #308/#309） | 已定性（skip 理由串注明 2in1 同例通过） |
| #99 autostart startAbility 手机拒绝 | 修复+skip 披露（no-throw 契约手机上不再成立） |
| #294/#295 setInnerSize 手机全屏窗 | skipOnMobile（"precise decor unavailable"） |
| ArkWeb window.open native 无 URL | 真 gap，已上游披露 |
| NFC write 双协议卡 | 平台限制（§五），披露收口 |
| WindowManager.ets ~:957 `display.width > 800` 判 isDesktop 用物理 px，手机 1216 也判真 | **当前恰好无害（fallback 兜底），待上游披露**（建议改 `deviceInfo.deviceType`） |

## 七、方法论沉淀

- mobile 上 app 被冻结先查 SUSPEND_MANAGER（FreezeFreezeUnit/MinimizeUIAbilityBySCB/LifecycleDetectTimeoutProc）而非 faultlog；被冻测试的 duration 就是冻结窗口定位法
- 任何测试调 startAbility/开设置页/launch 别的 ability 都会把调用方打到后台——手机上等于判死刑，须前置形态门控
- webview（前端 JS）console.log 经 **ARKWEB-CONSOLE**（A01194 域）进 hilog，`[ManualTest] Starting:` 行可作手动用例触发判据；ArkTS console 走 JSAPP（A03D00）域（如 `[NfcPlugin]`）；报告 footer（cmd.rs Rust 侧）是套件跑完判据。判"点击未命中"优先看 `[ManualTest] Starting:` 行有无,比截图肉眼判可靠
- `display.getDefaultDisplaySync().width/height` = 物理 px；tao 送 ArkTS 的几何值同单位可直接 min()
- 构建 stronghold 依赖需 `SODIUM_LIB_DIR` 指向预编译库（skill env.sh 已带守卫自动设置）
