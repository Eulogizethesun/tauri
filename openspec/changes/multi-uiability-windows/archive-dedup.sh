#!/bin/bash
# archive-dedup.sh — multi-uiability-windows 的机械化归档(tauri#166 D7,第二轮复核)
#
# 背景:本 change 的 ohos-platform-limitations delta 采用"有意双写"(TA3)——
# live spec 的同名小节先于归档落盘(live spec 是当前读者——含本仓 verify
# skill——的实际读点,回退会让正文在归档前缺失该 Requirement),delta 保留
# 同一正文以便 openspec archive 正常合入。两者逐字相同是本脚本的前提;
# 归档时的去重按以下机械步骤执行,不做手工编辑:
#
#   1. 校验 live spec 小节与 delta 正文逐字一致(漂移即中止——"勿在 delta
#      侧单独演化"在此是检查项,不是请求);
#   2. 从 live spec 删除先行落盘的小节与汇总表行(R-multiuiab-singleton);
#   3. openspec archive(从 delta 重新合入正文);
#   4. 回填汇总表行(delta 以 note 记录该行,archive 不搬运非 Requirement
#      内容);
#   5. 往返校验:终态 live spec 与起始内容逐字一致(全链零丢失、零重复)。
#
# 用法(在 tauri 仓根):
#   bash openspec/changes/multi-uiability-windows/archive-dedup.sh [--dry-run]
# --dry-run:执行 1/2/4/5 的全部检查与临时文件演算,但跳过第 3 步真实
# archive(终态写回也跳过)——用于归档前演练与 CI 漂移检查。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LIVE="$ROOT/openspec/specs/ohos-platform-limitations/spec.md"
DELTA="$ROOT/openspec/changes/multi-uiability-windows/specs/ohos-platform-limitations/spec.md"
CHANGE=multi-uiability-windows
REQ_HEADING='^### Requirement: 多 UIAbility'
TABLE_ROW='^| R-multiuiab-singleton '
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ─── 1. 漂移校验:live 小节 == delta 正文 ───
awk -v h="$REQ_HEADING" '$0 ~ h {f=1} f' "$LIVE"   > "$TMP/live-section.md"
awk -v h="$REQ_HEADING" '$0 ~ h {f=1} f' "$DELTA"  > "$TMP/delta-body.md"
if ! diff -q "$TMP/live-section.md" "$TMP/delta-body.md" >/dev/null; then
  echo "ERROR: live spec 小节与 delta 正文出现漂移(双写前提被破坏):" >&2
  diff "$TMP/live-section.md" "$TMP/delta-body.md" >&2 || true
  echo "先以 delta 为准对齐 live spec(或反向修 delta)后再归档。" >&2
  exit 1
fi
echo "[1/5] 漂移校验通过:live 小节与 delta 正文逐字一致。"

# ─── 2. 删除 live spec 中的先行落盘内容 ───
cp "$LIVE" "$TMP/live-original.md"
# 2a. 删 Requirement 小节(该小节是 live spec 最后一节,截到其标题前即止;
#     若其后将来出现新内容,漂移校验[1]会先拦住结构变化)。
awk -v h="$REQ_HEADING" '$0 ~ h {exit} {print}' "$LIVE" > "$TMP/live-stripped.md"
# 2b. 删汇总表行。
grep -v "$TABLE_ROW" "$TMP/live-stripped.md" > "$TMP/live-stripped2.md" || true
# 2c. 收敛尾部空行为单个换行。
printf '%s\n' "$(cat "$TMP/live-stripped2.md")" > "$TMP/live-stripped3.md"
echo "[2/5] live spec 先行落盘内容已剥离(演练产物)。"

# ─── 3. 归档 ───
if [ "$DRY_RUN" = 1 ]; then
  echo "[3/5] --dry-run:跳过真实 openspec archive。"
  # 演算终态:剥离版 + delta 正文(步骤 5 拼装)+ 回填表行,应与原文逐字一致。
  cp "$TMP/live-stripped3.md" "$TMP/live-final.md"
else
  cp "$TMP/live-stripped3.md" "$LIVE"
  if ! (cd "$ROOT" && openspec archive "$CHANGE" --yes); then
    cp "$TMP/live-original.md" "$LIVE"
    echo "ERROR: openspec archive 失败(校验未过/CLI 异常),live spec 已回滚到起始内容。" >&2
    exit 1
  fi
  cp "$LIVE" "$TMP/live-final.md"
fi

# ─── 4. 回填汇总表行(archive 不搬运 note 记录的表行) ───
ROW="$(grep "$TABLE_ROW" "$TMP/live-original.md")"
# 表行插在汇总表 R-arkweb-key 行之后(该行是表中最后一行;若未来表新增
# 行,插到表末行后同理)。基线行缺失即报错。
if ! grep -q '^| R-arkweb-key ' "$TMP/live-final.md"; then
  echo "ERROR: 汇总表基线行缺失,无法回填 R-multiuiab-singleton。" >&2
  exit 1
fi
awk -v row="$ROW" '
  { lines[NR]=$0 }
  END {
    for (i=1; i<=NR; i++) {
      print lines[i]
      if (lines[i] ~ /^\| R-arkweb-key /) print row
    }
  }
' "$TMP/live-final.md" > "$TMP/live-final2.md"
echo "[4/5] 汇总表行已回填(演练产物)。"

# ─── 5. 往返校验 ───
if [ "$DRY_RUN" = 1 ]; then
  # 演算终态:剥离版 + 表行回填(步骤 4 已做)+ 空行 + delta 正文
  # (模拟 archive 合入),应与原文逐字一致。
  printf '\n' >> "$TMP/live-final2.md"
  cat "$TMP/delta-body.md" >> "$TMP/live-final2.md"
fi
if ! diff -q "$TMP/live-original.md" "$TMP/live-final2.md" >/dev/null; then
  echo "ERROR: 往返校验失败——终态与起始内容不一致:" >&2
  diff "$TMP/live-original.md" "$TMP/live-final2.md" >&2 || true
  if [ "$DRY_RUN" = 0 ]; then
    # 真实模式:live spec 已被步骤 2/3 改写,先回滚到起始内容再退出,
    # 归档交人工(archive 已发生的目录移动不回滚,重跑前先恢复 change 目录)。
    cp "$TMP/live-original.md" "$LIVE"
    echo "已将 live spec 回滚到起始内容。openspec archive 可能已把 change 移入 archive/,重跑本脚本前需先恢复 change 目录。" >&2
  fi
  exit 1
fi
if [ "$DRY_RUN" = 0 ]; then
  cp "$TMP/live-final2.md" "$LIVE"
fi
echo "[5/5] 往返校验通过:去重-归档-回填全链零丢失、零重复。"
echo "DONE${DRY_RUN:+ (dry-run)}"
