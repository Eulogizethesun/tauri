import type { SowItem } from './sow-registry';

// SOW §四 工具链（cargo-mobile2 + CLI）：10 条，全部流程级豁免（SOW L82 原文：
// 「工具链不在 api 工程用例覆盖内，以“创建工程—构建—签名—部署”全流程验收（examples/api
// 工程即其验证载体）」）。证据 note 记代码通路与流程级验证载体，不对应任何套件数组条目。
export const sowS4: SowItem[] = [
  {
    id: 'S4-001',
    section: '四',
    group: '工程脚手架',
    name: '创建鸿蒙工程',
    plan: { kind: 'excluded', batch: 'S4', reason: 'SOW L82 工具链豁免：流程级验收（examples/api 工程即验证载体）' },
    note: 'fresh-init + demo 双级注册表路线已闭环（OHPM beta.2 上架）；gen/ohos 目录为生成产物'
  },
  {
    id: 'S4-002',
    section: '四',
    group: '工程脚手架',
    name: '模板校验',
    plan: { kind: 'excluded', batch: 'S4', reason: 'SOW L82 工具链豁免：流程级验收' },
    note: 'examples/api 全量用例矩阵即模板能力面（337 实跑条目为模板产物的运行时校验）'
  },
  {
    id: 'S4-003',
    section: '四',
    group: '构建流水线',
    name: '开发模式构建',
    plan: { kind: 'excluded', batch: 'S4', reason: 'SOW L82 工具链豁免：流程级验收' },
    note: '--app 代码通路在（build.rs:73-78/274-292）；无专项验证轮=披露项（1109 审计口径）'
  },
  {
    id: 'S4-004',
    section: '四',
    group: '构建流水线',
    name: '发布模式构建',
    plan: { kind: 'excluded', batch: 'S4', reason: 'SOW L82 工具链豁免：流程级验收' },
    note: '--release 代码通路在（cargo-mobile2 target.rs:194-195）；无专项验证轮=披露项'
  },
  {
    id: 'S4-005',
    section: '四',
    group: '打包签名与部署',
    name: '生成HAP',
    plan: { kind: 'excluded', batch: 'S4', reason: 'SOW L82 工具链豁免：流程级验收' },
    note: 'gen/ohos 构建链产物；fat hap ABI 累积陷阱记录（单 target 构建不刷新另一 ABI libs/）即实跑证据'
  },
  {
    id: 'S4-006',
    section: '四',
    group: '打包签名与部署',
    name: '生成APP',
    plan: { kind: 'excluded', batch: 'S4', reason: 'SOW L82 工具链豁免：流程级验收' },
    note: '双形态发布产物；与「双形态签名产包」同批流程验收'
  },
  {
    id: 'S4-007',
    section: '四',
    group: '打包签名与部署',
    name: '双形态签名产包',
    plan: { kind: 'excluded', batch: 'S4', reason: 'SOW L82 工具链豁免：流程级验收' },
    note: '自备签名材料链已验证（certpath 须完整链 + material 密码 decipher-util 三坑记录）'
  },
  {
    id: 'S4-008',
    section: '四',
    group: '打包签名与部署',
    name: '真机部署',
    plan: { kind: 'excluded', batch: 'S4', reason: 'SOW L82 工具链豁免：流程级验收' },
    note: '历轮真机报告 provenance 链：desktop 314(10-15)→327(10-30)→337(11-06 全绿)'
  },
  {
    id: 'S4-009',
    section: '四',
    group: '日志与调试',
    name: '日志输出',
    plan: { kind: 'excluded', batch: 'S4', reason: 'SOW L82 工具链豁免：流程级验收' },
    note: 'hilog 稳定抓取链（grep --line-buffered 后台流 + 回放缓冲区）与 console-log.txt 双源对账'
  },
  {
    id: 'S4-010',
    section: '四',
    group: '日志与调试',
    name: 'DevTools 调试',
    plan: { kind: 'excluded', batch: 'S4', reason: 'SOW L82 工具链豁免：流程级验收' },
    note: 'ArkWeb DevTools/CDP 驱动链已验证（fport 挂接 + fire-and-poll 配方）'
  }
];
