# Proposal: ohos-committer-issues-jia-p1

## Why

committer 检视 69 条(#168–#236)中归属甲(底座链)38 条的修复由 roadmap `ohos-committer-issues-jia-master` 承载,分 p1(对账+第 0 波文档批)→ p2(S 级)→ p3(M 级)。核验基线为 2026-10-12,其后 10-13 复核波、10-19/10-20 BUILD-INFO 三 change(cursor-passthrough / webview-sizing / iframe-ipc)已向四仓落地大量提交,与甲条目存在已知交叠(#168 geometry、#179 cursor feed、#185/#198 渲染层消费侧、#180 事件路由)。**不先对账残差就施工,会重复实现或与已落地语义冲突**(roadmap 关键风险)。

同时,md 第 0 波的注释/文档/warn 披露批(~13 条目,零行为变更)是无对账依赖风险的净收益面,可与对账同 phase 落地。桌面套件基数在多轨提交后已口径漂移(313/314/311 并存),p2/p3 的"不低于基线"硬门槛需要一次 HEAD 现场重锚。

## What Changes

1. **38 条全量对账表**(新产物 `reconciliation-ledger.md`):逐条判定 已修(轨道/commit)/ 残差(剩余子项)/ 未动,附 file:line + commit 双证据;四簇交叠项(#168/#179/#180/#185+#198)由本设计先行给出证据级结论(D3),其余 34 条由任务期按 D1 方法论执行。
2. **甲第 0 波注释/文档/warn 披露批**(零行为变更,按仓分 commit):
   - tao:#169(latch 注释)/#170(facade ×2 失实注释更正)/#171(warn 一行 + facade 文档)/#172(文档 ×2)/#175/#176/#177(文档 ×2)/#182/#183;
   - ability:#170(WindowManager.ets 注释更正,**native_ability + package 两份副本同步**);
   - wry:#187(with_https_scheme / with_asynchronous_custom_protocol 文档)/#193(drag-drop 披露 + 仓内纠偏)/#197(init script frame 披露);#185/#196 经对账判定文档已闭合,零必需改动;
   - tauri:#228(set_effects 两处 Platform-specific 补 OHOS 行)。
3. **重锚回归基线**:MateBook Pro(HAD-W32)桌面真机全量跑 examples/api 套件,统一 313/314/311 口径漂移,产出新基线数字并回写 master roadmap p2/p3 硬门槛。

## Capabilities

### New Capabilities

- 无(本 phase 零行为变更,不新增运行时能力)。

### Modified Capabilities

- **ohos-platform-limitations**:ADDED 需求——把第 0 波披露批落地的平台限制文档固化为可回归校验的规格契约(窗口空实现/意图位/光标/全屏折叠/显示模式/use_https 同步通道/拖放语义/init script frame/window.open features/特效支持范围),见 `specs/ohos-platform-limitations/spec.md`。

## Impact

- **行为**:零运行时行为变更(纯注释/doc/warn;唯一代码行为是 tao #171 的一行 `log::warn!`,属 md 第 0 波明文认可项)。ArkTS 侧仅注释行,按 D7 裁定**不触发 HAR 重打/设备部署**(零行为变更无设备验证依赖,重打随 p2/p3 行为波统一执行)。
- **对账对 p2/p3 的影响**(D3 结论,供 PM 更新 roadmap,澄清决策 7):#179 M 档(FloatPage onMouse)剔除——cursor-passthrough 轨道已覆盖;#185 剔除——webview-sizing 轨道已修复;#198 收窄为实现侧(披露/注释半已落);#196 收敛为回复素材(文档已闭合);#184 修法锚点纠偏(非 OnceLock,为 `window_client: Option<WindowClient>` 字段一次性捕获)。
- **风险**:对账误判方向(把"已修"误判"未动"→ p2/p3 重复实现)由 D1 防误判护栏约束;"未动"判定必须附 HEAD 现场取证,不得以"报告没提"为由。
- **外部动作排除**:GitHub 回复、push 不在本 phase(澄清决策 2);#193 纠偏限于仓内文档(roadmap 明文)。
