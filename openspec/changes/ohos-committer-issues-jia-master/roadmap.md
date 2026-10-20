# ohos-committer-issues-jia roadmap

## Why

committer @Eulogizethesun 于 2026-10-10 在 Eulogizethesun/tauri 仓批量提交 69 条存量代码检视 issue(#168–#236)。经 2026-10-12 九批子 agent 核验 + 怀疑者复核轮(汇总见工作区 `COMMITTER-ISSUES-168-236.md`):属实 61 / 部分属实 6 / 本地已修 2 / 误报 0,并产出两单位分工方案——甲=底座链(tao / wry / openharmony-ability 核心 / tauri 仓 runtime-wry 与 vibrancy)38 条,乙=插件/菜单/托盘/工具链 31 条。

本 roadmap 承载**甲的修复执行**(第 0-2 波)。关键背景:核验基线为 2026-10-12 HEAD,其后 10-13/10-15 对方二轮复核、10-19/10-20 BUILD-INFO(cursor-passthrough / webview-sizing / iframe-ipc)等轨道已向四仓落地大量提交,与甲条目存在已知交叠(#168 geometry 面、#179 cursor feed、#185/#198 渲染层消费侧、#180 事件路由),**须先对账残差再施工**,否则重复实现与语义冲突风险高。

## What

- **p1**:38 条全量对账表(逐条 已修/残差/未动 判定 + file:line + commit 证据)+ 甲第 0 波注释/文档/warn 披露批落地(~13 条目,零行为变更)
- **p2**:第 1 波 S 级代码修复(~13 条,视 p1 对账裁剪),波末桌面 318 例回归
- **p3**:第 2 波 M 级修复(~8 条,#179 已于 p1 对账剔除),波末 318 例回归 + 真机专项

## 澄清决策

1. **范围 = 甲 38 条**(#168–#199 共 32 条 + #219、#221、#225、#228、#231、#233);乙的 31 条不在本 roadmap(用户 2026-10-20 指令"按照 md 文件进行甲的工作修复")
2. **GitHub issue 回复与推送排除**:外部动作,须用户另行确认(md 亦规定"推送/回复启动时点经项目方确认");rb-ship 收尾时再问
3. **第 3 波 L 级专项不随本批**(#198 系统级 px/vp 契约、#225 work_area 三层设计、#187 两阶段回注等),按 md 留排期
4. **3-phase 拆分经用户确认**(AskUserQuestion,2026-10-20):p1 对账+文档批 → p2 S 级 → p3 M 级,W1→W2→W3 串行
5. **验证设备**:MateBook Pro(HAD-W32,桌面真机)在位,每波末 318 例桌面回归可执行;Mate 70 未接入(甲无 mobile 项,不受影响)
6. **openspec 基础设施落 tauri 仓**(沿用 BUILD-INFO 轨道惯例);四仓工作分支统一 ohdev
7. 对账发现的"已修"条目**不重复实现**,转披露/回复素材;对账结论改变 p2/p3 scope 时由 PM 更新本 roadmap Phase Details 并知会用户

## Phase Details

### 切割策略

所选切割维度:**按管线阶段(md 波次结构)+ 风险隔离(对账先行)组合**

理由:md 的波次结构是天然干净切分缝——每波独立完成、独立验证(波末 318 例回归)、独立归档;波间存在真实依赖(p1 对账结果决定 p2/p3 scope;p2 的 #173 WindowStateMirror focused 位是 p3 #180① Float 焦点接通的前置基建)。备选维度被否:①按 crate 拆——tao↔wry↔openharmony-ability 是强耦合底座链(分工方案的存在前提),单条目常横跨 2-3 仓(如 #233 = ArkTS 两份源同步 + wry 注释更正),按 crate 拆会拦腰截断条目;②p3 按域(window/bridge 域 ∥ webview 域)并行拆——wry mod.rs OHOS 段与 ArkTS 桥同文件冲突风险高、合并复杂度不划算,用户确认时亦选择不拆。

| Phase | 名称 | change | 状态 | 依赖 | 验证方式 | Wave |
|-------|------|--------|------|------|---------|------|
| p1 | 对账 + 第0波文档/披露批 | ohos-committer-issues-jia-p1 | ✓ 设计完成 | — | cargo check 四仓 + 对账表逐条证据核验 | W1 |
| p2 | 第1波 S 级代码修复 | ohos-committer-issues-jia-p2 | ○ 待设计 | p1 | cargo test 四仓 + 桌面 318 例回归 + #174/#181 真机仲裁 | W2 |
| p3 | 第2波 M 级修复 | ohos-committer-issues-jia-p3 | ○ 待设计 | p2 | cargo test + 318 例回归 + 真机专项(#192 SPA / #198 vp 标定) | W3 |

### Phase 1: 对账 + 第0波文档/披露批

- **目标**:
  1. 产出 **38 条全量对账表**:逐条判定 已修(哪条轨道/commit)/ 残差(具体剩什么)/ 未动,附 file:line + commit 证据;对账优先核:#168(creation-time geometry 已落地于 tao 15491f9d/823318fa + ability d7e8e3a + tauri 1a34b6b97,参数面 decoration/fullscreen/maximized/focus/visible/icon/theme 待核)、#179(cursor feed screen-global 链 + untracked→Err 契约已落地于 tao d42e8950 + ability baf4f3f/ac911c2,FloatPage onMouse 与披露文案待核)、#185/#198(webview-sizing 落的是渲染层消费侧 ability 5c4b5a9 + tauri dd4956b63 + wry 8e381e6,Physical 换算侧 virtualPixelRatio 待核)、#180(Float 焦点残差、scale 去噪待核)
  2. 落地甲第 0 波注释/文档/warn 批(零行为变更):tao #170(resize/move 1300002 三处注释)/#171(setAlwaysOnBottom warn+文档)/#172(setCursorPosition 文档 ×2)/#175/#176(空实现文档补行)/#177(intent 位语义披露)/#182(fullscreen 折叠披露)/#183(video_modes 披露)/#169(latch 不复位注释半)/#179(披露半,文案视对账;**落点仓由对账表显式落定**——代码证据指向 tao cursor feed 链,若披露需触 muda/tray-icon 侧则按分工知会乙,防静默跨界);wry #185(披露,文案视对账刷新)/#187(use_https 同步通道上限披露)/#193(拖放披露;纠偏**限于仓内文档方向修正**,GitHub 回复不在本批)/#196(window.open features 披露)/#197(init script frame 披露);tauri #228(set_effects 文档 Blur/Acrylic only)
     - **p1 对账落定(2026-10-20 设计期四簇证据)**:#179/#185/#196 三条已闭合(ledger 对应行),文档批 16→14 条目;#179 披露落点仓=tao(`d42e8950` 已落),muda/tray-icon 零动作,无需知会乙;#170 facade 锚点漂移至 window.rs:757-761/:789-793
- **预估文件**: ~16(对账表 1 + 四仓注释/文档目标 ~15)
- **Success Criteria**:
  1. 对账表 38/38 条有判定+证据,已知交叠四簇(#168/#179/#180/#185+#198)结论明确
  2. **重锚回归基线**:对当前 HEAD 跑全量桌面套件,统一 313/314/311 口径漂移,回写本 roadmap p2/p3 的"不低于基线"硬门槛数字 —— 已执行(2026-10-20,HEAD 1147f3ae5,report `examples/api/device-report-1020-desktop.md`):**318 例(311✅ / 7⏭ / 0❌)**,footer 判据成立
  2. 文档批按仓分 commit 落地,cargo check 四仓零 error
  3. 零行为变更(纯注释/文档/warn;#171 warn 一行属 md 认可的披露批内容)
- **依赖**: 无
- **关键风险**: 对账误判方向 = 把"已修"误判为"未动"导致 p2/p3 重复实现引发冲突。对策:git show 归因 + file:line 重开比对 + SDK d.ts 落证(沿用 10-12 复核轮方法论);#179/#198 交叠簇必须读 BUILD-INFO 三 change 的归档产物

### Phase 2: 第1波 S 级代码修复

- **目标**: S 级修复 ~13 条(视 p1 对账裁剪,已修条目剔除):
  - ability:#221(StageEventType From→TryFrom + unknown 日志忽略 + 单测)、#181(theme() per-module init 链尾主动灌入 getConfiguration,时序敏感必须真机)、#231(accelerator_matcher console 降级 hilog.debug 保 accel-inject-diag.sh 判读链 + WindowManager 成功日志删/失败保留 + **三副本同步**;不动 MenuBarComponent.ets——该文件归乙 #205,波次错开防同文件冲突)
  - tao:#184(bridge client 失败懒补取 + 成功覆盖,防 session 重建死句柄;p1 对账锚点纠偏——tao 无 OnceLock,实为 `window_client: Option<WindowClient>` 字段一次性捕获,修法/行号以 p1 ledger #184 行为准)、#173(WindowStateMirror 加 focused 位,初始 HAS_FOCUS 快照——p3 #180① 前置基建)、#178(setCursorGrab 异步失败 warn 结构化)
  - wry:#190(format_set_cookie_value 补 Expires/Max-Age,cookie crate 现成读取器 + IMF-fixdate≠Rfc2822 注意)、#191(clearAllBrowsingData 加 clearAllCookiesSync @since 11)、#194(eval 失败 Err 分支以 "null" 回调)、#199(invoke url_cache 预填 initial_url)、#233(createPdf scale ArkTS cfg 构造补行,**两份源文件同步** + wry 错误注释更正)、#188(visible = wry 一行直传 create_req.style.visible,零闪帧)
  - tauri:#225(set_enabled→Err,落点 dispatcher 层 runtime-wry lib.rs:2387 附近,套件无窗口 set_enabled 用例零翻红)
  - #174(主窗 setFocusable 真机仲裁 id=0 可用性→去 gate 或 warn)
- **预估文件**: ~25(每条改动面小,S 级单条 <0.5 人日;按 md 波次纪律单波一次回归,不按文件数再拆)
- **Success Criteria**:
  1. 各条目按 md 核验动作落地,新用例随波并入 examples/api(新命令同步 build.rs AppManifest 四处)
  2. cargo test 四仓全绿(tao --lib,examples 不编)
  3. 桌面 318 例回归不低于基线(311✅/7⏭,report: `examples/api/device-report-1020-desktop.md`;基数随新用例增长)
  4. #174、#181 真机仲裁/验证有结论(MateBook Pro)
- **依赖**: p1(对账裁剪 + #169 latch 注释已落)
- **关键风险**: #181 时序敏感(lifecycle 注册竞态,须真机深色冷启动验证);#231/#233 多副本同步漏拷(pack 单文件坑 + 两份 ArkTS 源);凡动 ArkTS 须清 oh_modules + CompileArkTS + 重打 HAR

### Phase 3: 第2波 M 级修复

- **目标**: M 级修复 ~9 条(视对账裁剪):
  - #168 创建期参数残差:decoration/always_on_top 播种(S 半)→ 主窗创建后补发 fullscreen/maximized/focus(走既有 pending 队列)→ visible/icon/theme 披露;几何面已修(p1 对账:tao 15491f9d+823318fa / ability d7e8e3a0 / tauri 1a34b6b97)不重做——参数面 window_attrs.{fullscreen,maximized,focus,visible} 零消费已设计期实证
  - #186 https 拦截字段三层扩展(method/headers/响应头;getRequestMethod@9/getRequestHeader@8/setResponseHeader@9 全 d.ts 实锤;body 平台无访问器→披露;保 CORS 4 例基线)
  - #189 主 webview Drop no-op 修复:去 is_child 门控(ArkTS remove 幂等已就绪;bridge 15s 超时兜底;关窗链全量回归)
  - #192 url() 同步 get-url 桥(镜像 cookie 三态分流;url() 实际在主线程执行,同步桥是主路径必需件;须避开主线程 block_on 死锁族)
  - #195 open_devtools PendingOp 排队重放 + 进程级布尔(对齐 ArkWeb 语义)+ 注入/命令注册门控对齐
  - #198 setBounds Physical 换算单仓版:ability 暴露 virtualPixelRatio → wry 接入(Logical 链路零变化);p1 对账收窄为实现侧(披露/注释半已由 wry 8e381e6 完成,mod.rs 失准注释更正剔除);与已落地渲染层消费侧(webview-sizing)衔接,真机 vp 标定一次
  - #180① Float 焦点接通(按 lastFocusedWindowId 变化沿去重防双发;依赖 p2 #173 前置基建)+ scale 事件去噪(S 半)
  - #188 incognito(incognitoMode@11 + cookie 桥 incognito 参数联动,真机)
  - #219 4 类窗口命令 ack 链:serializeOpTracked 变体 + 操作型命令 await+throw;void-setter 族成效依赖 tao 侧消费 Result,**同波前置**;318 全量硬门槛,回归面最大
  - #179 M 档(FloatPage onMouse)——**已剔除**(p1 对账:cursor feed 轨道 baf4f3f9+ac911c2 已覆盖,ledger #179 行判已修)
- **预估文件**: ~30
- **Success Criteria**:
  1. cargo test 四仓全绿;新用例随波并入(#168 builder 参数、#173 多窗口 isFocused 互斥等按批次报告"验证方式")
  2. 318 例回归零新增 ❌(基线 report: `examples/api/device-report-1020-desktop.md`;#219 ack 语义变化后必须全量)
  3. 真机专项结论:#192 controller.getUrl() 对 pushState 即时性(SPA 用例)、#198 virtualPixelRatio 与 vp 基准一致性、#188 incognito 联动、#189 关窗链日志观察
- **依赖**: p2(#173 前置基建 + S 波回归基线)
- **关键风险**: #219 回归面最大(ack 语义变化波及 4 类命令);#186 不得破坏 CORS 4 例基线;#192 同步桥主线程语义;#198 与 webview-sizing 轨道的衔接缝

## 跨 phase 架构约束

1. **cfg 隔离铁律**:OHOS 代码 `cfg(target_env = "ohos")`,Linux 依赖 `not(ohos)`;cfg 铁律只适用 tao/wry 运行时库(OHOS CLI vs runtime cfg gating)
2. **凡动 ArkTS**:清 oh_modules + CompileArkTS + **重打 HAR**(ability.har 缓存坑,否则修复无效假象);gen/ohos 手改跨 build 存活须点名核验
3. **NAPI 命名契约两端同步**(#[napi] 默认 camelCase;wire 字段名 camelCase);Option 序列化用 skip_serializing_if 防 null vs absent
4. **三处副本同步**(plugins→package→native_ability);pack-plugins 单文件 gap 教训
5. **构建 churn 提交前过滤**:schema.json 纯空白 diff(3 仓 33 文件)、openharmony/.tauri/ 副本、ability.har、profraw/target-cov 覆盖率产物
6. **新用例随波并入 examples/api**:新增命令须同步 build.rs AppManifest 四处(命令权限唯一真源);318 基数随波增长;套件 report 文件 footer=跑完判据(report 为准非 hilog)
7. **桥接语义铁律**:setter! 命令 payload 键=value;bridge 禁 recv_timeout(必须 emit 异步事件模式);OHOS 主线程 block_on 死锁族(tray THREAD_BLOCK_3S / muda refresh_menubar 教训)——#192 同步桥与 #219 ack 链设计必须避开
8. **回复纪律**(供后续回复素材,不在本批执行):回复必须附 HEAD 证据(file:line + commit + 回归报告行),从 diff 现场 derive;#236/#232/#214/#190③/#193 五处正文失实须纠偏
9. **分支与推送**:测试统一用 ohdev 分支;origin-tauri 禁止提交;push 须用户确认(rb-ship 时问);与乙并行的同文件唯一冲突对 = #231×#205(MenuBarComponent.ets),靠波次错开消解——p2 #231 不动该文件
10. **设备纪律**:318 例回归跑前禁 hilog -r(残留窗吃点击排查干扰);#211 类真机先验不适用(甲域);Bash 命令显式绝对 cd
11. **scope 锚纪律**:roadmap 条目内的具体类型替换与行号落点(如 #184 OnceLock→Mutex、#225 lib.rs:2387)源自 10-12 核验快照,**仅为 scope 锚**——per-phase designer 须从 HEAD 现场重新 derive,不得照抄
