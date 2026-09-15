# Tauri OHOS 适配待提交代码量统计报告

- **统计日期**：2026-08-26
- **统计方式**：git fetch 官方分支到本地后，用 `git diff --numstat` / `git rev-list` 自动统计
- **本地代码**：各仓 `ohtemp` 分支（2026-08-26 已 rebase 到最新 `origin/ohdev`）

---

## 一、对比基线

| 仓库 | 官方基线 | 官方分支 tip | 本地分支 |
|---|---|---|---|
| tauri | tauri-apps/tauri `feat/open-harmony` | e3bf6eb1（2026-07-30） | ohtemp |
| tao | tauri-apps/tao `feat/open-harmony` | 813572fb（2026-07-29） | ohtemp |
| wry | tauri-apps/wry `feat/open-harmony` | 6aaf4b84（2026-07-30） | ohtemp |
| muda | tauri-apps/muda `feat/open-harmony` | 155dc13c（2026-07-29） | ohtemp |
| tray-icon | tauri-apps/tray-icon `feat/open-harmony` | e05dab06（2026-07-27） | ohtemp |
| cargo-mobile2 | tauri-apps/cargo-mobile2 `feat/ohos` | 549bb6d6（2026-07-30） | ohtemp |
| plugins-workspace | tauri-apps/plugins-workspace `feat/open-harmony` | cc9ec9b4（2026-07-29） | ohtemp |
| openharmony-ability | harmony-contrib/openharmony-ability `main` | 746a00a（2026-08-19） | ohtemp |

## 二、关键发现：官方分支与本地代码的关系

1. **官方分支源自本团队的适配线**。cargo-mobile2 的 merge-base（2026-06-08）位于官方分支内部，证明官方 `feat/ohos` 就是本团队工作被 Tauri 官方成员（Tony）收编 rebase 后的版本；tao / wry 的官方 OHOS 目录是本地代码的**早期快照**：
   - tao：官方 `src/platform_impl/ohos/` 1290 行 vs 本地 2348 行，直接差异仅 **+1113 / -149**
   - wry：官方 `src/ohos/` 295 行 vs 本地 623 行，直接差异仅 **+376 / -48**
2. **muda / tray-icon / plugins-workspace 的官方分支没有任何 OHOS 内容**（相对 dev 的 ahead=0，仅为旧版 dev 快照），这三个仓的全部 OHOS 代码都需要提交。
3. **openharmony-ability 与上游 harmony-contrib/main 双向演进**：本地 ahead 53 / behind 11（上游 8 月还在合入其他人的 PR）。
4. **基线偏移说明**：官方分支已多次合并最新 dev（至 2026-07），本地基线较旧（2026-03~05），因此两点差异中的**删除行大部分是基线偏移噪声**（把官方已合并的新版 dev 改动"退回"），实际 PR 提交后这些删除行不会出现。衡量真实工作量以**插入行**为准。

## 三、总览表（已剔除非代码内容）

剔除项：`.claude/`（skills）、`openspec/`（设计文档）、`doc/` 及所有 Markdown 文档、`CLAUDE.md`、lock 文件（Cargo.lock / pnpm-lock.yaml）、图片、gitignore 等杂项。

| 仓库 | 独有提交数 | 代码量（两点 diff） | 独有提交净增（三点 diff） | OHOS 专属路径核心增量 |
|---|---|---|---|---|
| tauri | 194 | **+35,394 / -18,753** | +34,335 / -12,871 | +6,669 / -779（101 个文件） |
| openharmony-ability | 53 | **+17,358 / -15,224** | +15,147 / -330 | 全仓即 OHOS 代码 |
| tao | 48 | **+2,749 / -2,206** | +2,431 / -25 | +1,113 / -149 |
| plugins-workspace | 41 | **+2,994 / -1,623** | +2,312 / -371 | +276 / 0 |
| tray-icon | 14 | **+1,600 / -72** | +1,556 / -14 | +1,402 / 0 |
| wry | 37 | **+1,975 / -2,326** | +780 / -43 | +376 / -48 |
| muda | 6 | **+1,593 / -3,894** | +935 / -7 | +855 / 0 |
| cargo-mobile2 | 3 | **+161 / -4** | +161 / -4 | +161 / -4 |
| **合计** | **396** | **+63,824 / -44,102** | **+57,657 / -13,665** | — |

口径说明：
- **两点 diff**（官方 tip → 本地 HEAD）：把本地代码直接应用到官方分支上的差异，即 PR 呈现的近似规模
- **三点 diff**（merge-base → 本地 HEAD）：本地独有提交的净改动，不含基线偏移噪声，删除行更接近真实情况
- **OHOS 专属路径核心增量**：路径中含 `ohos` / `harmony` 的代码+配置文件相对官方分支的直接差异（tauri 的大部分改动散布在既有文件如 `tauri-runtime-wry`、CLI、build 流程中，故该列小于总量）

## 四、按语言分布（两点 diff 代码部分，全仓合计）

| 语言 | 文件数 | 插入行 | 删除行 |
|---|---|---|---|
| Rust | 372 | **+42,571** | -33,778 |
| ArkTS（.ets） | 100 | **+9,358** | -7,449 |
| TypeScript | 44 | **+5,399** | -1,040 |
| Svelte | 20 | **+4,600** | -1,319 |
| 前端/脚本/胶水（HTML/CSS/JS/HBS/C++/Kotlin/Swift/Shell/Bat） | 58 | **+1,896** | -516 |
| **合计** | 594 | **+63,824** | **-44,102** |

## 五、各仓明细

### tauri（194 个独有提交）
- Rust：146 个文件 +22,725 / -17,459
- TypeScript +5,255、Svelte +4,312、ArkTS +1,409、HTML +356、Shell +797、其他约 +590
- 配置（Cargo.toml/json/yaml 等）：+4,420 / -2,599
- **已剔除的非代码内容**：`.claude/` skills +12,338、`openspec/` 设计文档 +26,293、`doc/` +50,939、其他 Markdown（含中文文档名）约 +1,800、Cargo.lock -12,192
- 说明：删除行中约 5,000 行为官方分支 7 月 dev 合并产生的基线偏移；OHOS 路径核心增量 +6,669 集中在 `crates/tauri/src/ohos/`、CLI 模板、构建流程

### openharmony-ability（53 个独有提交，对比 harmony-contrib/main）
- Rust：63 个文件 +9,338 / -6,868
- ArkTS：73 个文件 +7,949 / -7,428（harmony 目录双侧均有大量演进）
- 独有提交净增：Rust +7,841 / ArkTS +7,252 —— **这是最真实的待提交量**
- 上游 main 8 月仍在合入他人 PR（behind 11），提交前需再 rebase

### tao（48 个独有提交）
- Rust：35 个文件 +2,749 / -2,206（其中 OHOS 目录 +1,113 / -149）
- 删除行中约 2,000 行为官方分支 tao 0.36 重构产生的基线偏移

### wry（37 个独有提交）
- Rust：23 个文件 +1,822 / -2,132（其中 OHOS 目录 +376 / -48）
- Kotlin：+153 / -194；Cargo.lock -4,620 已剔除

### muda（6 个独有提交）
- Rust：31 个文件 +1,593 / -3,894；净增仅 **+935 / -7**
- 官方分支无 OHOS 内容，删除行几乎全部是基线偏移

### tray-icon（14 个独有提交）
- Rust：8 个文件 +1,600 / -72；净增 +1,556 / -14
- 官方分支无 OHOS 内容，**全部为净新增，直接可提交**

### cargo-mobile2（3 个独有提交）
- Rust：+161 / -4 —— 官方分支即本团队工作搬运版，仅差 3 个提交，**最接近可直接合入**

### plugins-workspace（41 个独有提交）
- Rust：62 个文件 +2,583 / -1,143
- Svelte +288、TS +83；配置（权限 schema json 等）+1,432 / -945
- 官方分支无 OHOS 内容

## 六、结论

1. **待提交代码总量约 5.8~6.4 万行（插入侧）**：三点口径（独有提交净增）**+57,657**，两点口径（含基线偏移噪声）+63,824 / -44,102
2. **主体在 tauri 主仓（约 60%）和 openharmony-ability 桥接仓（约 26%）**，符合"系统调用收敛到桥接仓、主仓做集成"的架构设计
3. **成熟度排序**（提交难度从低到高）：cargo-mobile2（3 提交，官方分支即我方血统）→ tray-icon / muda（官方无 OHOS 内容，纯新增）→ tao / wry（官方有早期快照，需做增量合并）→ plugins-workspace → tauri / openharmony-ability（改动面最大，且官方分支和上游均在活跃演进，需尽快 rebase 提交以免进一步偏移）
4. 已剔除的非代码内容合计约 **9.5 万行**（skills 12,338 + openspec 设计文档 26,293 + doc 50,939 + 各类 Markdown 约 6,000），如后续 PR 需要附带设计文档可另行整理

---

*统计命令：`git fetch <官方URL> <分支>` 后 `git diff --numstat FETCH_HEAD ohtemp`（两点）及 `git diff --numstat $(git merge-base FETCH_HEAD ohtemp) ohtemp`（三点），按扩展名与路径分类聚合。*
