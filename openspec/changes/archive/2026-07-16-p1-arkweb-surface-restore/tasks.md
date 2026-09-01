## 1. 实现 surface restore 修复

> **已回退**: 下方原 1.1–1.7 描述的 `Event::Resumed → set_bounds` reattach 方案经核实为误诊
> (minimize→restore 本不需要 set_bounds,ArkWeb 自然 rebind;set_bounds 反而干扰自然 rebind,
> 导致 2-cycle 底部缺失)。该 handler 已移除,tao `MainEvent::Start → Event::Resumed` 也已回退。
> 详见 plan.md「误诊的修复(已回退)」与 proposal.md「Rejected Alternatives」。
> 最终采用的修复在 openharmony-ability 仓(DefaultWebview.ets Web sizing 改回 "100%"),本仓无代码改动。

- [x] 1.0 (最终方案) openharmony-ability `DefaultWebview.ets` 的 Web 组件 `.width/.height` 改回 `"100%"` 自然布局,保留 `.position({x,y})` 用于子窗口定位(已实现并设备验证)

## 2. 设备验证

- [x] 2.1 构建部署 examples/api 到 desktop 设备(MateBook Pro HAD-W32,2026-07-14)
- [x] 2.2 自动测试通过(245 ✅ / 2 ❌,2 个 pre-existing:#33 RunEvent::Resumed 启动时序、#88 clipboard-manager 无 OHOS HAR;无底部内容缺失回归)
- [x] 2.3 手动验证:resize(松手)后底部不缺失 ✅;minimize→restore(隔离)底部完整 ✅(详见 plan.md「验证结果」)
