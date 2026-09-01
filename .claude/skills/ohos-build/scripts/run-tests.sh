#!/bin/bash
# Tauri OpenHarmony 自动化测试脚本
# 流程：HAR重建 → prerequisites → cargo tauri ohos build → hdc install → aa start → 等待 → 拉取报告 → 分析
#
# 原 `cargo tauri ohos run` 一步化拆为三步分离：
#   Step 2: cargo tauri ohos build --device-type desktop --features prod
#           产物: gen/ohos/entry_{form}/build/default/outputs/default/entry_{form}-default-signed.hap
#   Step 3: hdc -t <SN> shell bm uninstall -n com.tauri.api   (卸旧)
#           hdc -t <SN> install <WIN_HAP>                     (装新，带 false-success 检测)
#   Step 4: hdc -t <SN> shell aa start -b com.tauri.api -a EntryAbility  (启动)
# build 不需设备 SN；install/launch 用 DEVICE_SN。便于只重 install/launch 抓日志。

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Read CLI params BEFORE sourcing env.sh (env.sh sets default which would shadow $2)
DEVICE_SN="${DEVICE_SN:-$1}"
# $2 takes priority over inherited OHOS_DEVICE_TYPE (fixes stale parent shell value)
if [ -n "$2" ]; then
    OHOS_DEVICE_TYPE="$2"
fi
export OHOS_DEVICE_TYPE

source "$SCRIPT_DIR/env.sh"
source "$SCRIPT_DIR/prerequisites.sh"

OHOS_PROJECT="$PROJECT_ROOT/examples/api/src-tauri/gen/ohos"
APP_JSON="$OHOS_PROJECT/AppScope/app.json5"
BUNDLE_NAME=$(grep -o '"bundleName"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP_JSON" | head -1 | sed 's/.*"bundleName"[[:space:]]*:[[:space:]]*"//;s/"//')
REPORT_DEVICE_PATH="/data/app/el2/100/base/$BUNDLE_NAME/cache/test-report.md"
REPORT_LOCAL="$PROJECT_ROOT/examples/api/test-report.md"
REPORT_LOCAL_WIN=$(echo "$REPORT_LOCAL" | sed 's|^/\(.\)/|\U\1:\\|; s|/|\\|g')
# 轮询总时长（秒）。套件跑完的标志是报告 footer "*Report generated at end of
# test run.*"，283 例约 45-60s、595 例 >90s，180s 兜底足够；按 5s 间隔轮询。
WAIT_SECONDS="${WAIT_SECONDS:-180}"

# HAP 产物路径（cargo tauri ohos build 输出，见 build-ohos.sh）
ENTRY_MODULE="entry_${OHOS_DEVICE_TYPE:-desktop}"
SIGNED_HAP="$OHOS_PROJECT/${ENTRY_MODULE}/build/default/outputs/default/${ENTRY_MODULE}-default-signed.hap"
# Git Bash → Windows 路径（hdc install 需要 Windows 格式）
SIGNED_HAP_WIN=$(echo "$SIGNED_HAP" | sed 's|^/\(.\)/|\U\1:\\|; s|/|\\|g')

echo "=== Tauri OpenHarmony Auto Test ==="
echo "Bundle: $BUNDLE_NAME"
echo "Device: ${DEVICE_SN:-auto-detect}"
echo "Device Type: ${OHOS_DEVICE_TYPE:-desktop}"
echo ""

# Step 0: Rebuild openharmony-ability HAR if sources changed
ABILITY_ROOT="$PROJECT_ROOT/../openharmony-ability"
ABILITY_HAR="$ABILITY_ROOT/ability.har"

if [ -d "$ABILITY_ROOT" ]; then
    ABILITY_CHANGED=false
    if [ ! -f "$ABILITY_HAR" ]; then
        ABILITY_CHANGED=true
    else
        # Check if any source file is newer than the HAR
        NEWER=$(find "$ABILITY_ROOT/native_ability/src" "$ABILITY_ROOT/crates" "$ABILITY_ROOT/plugins" -newer "$ABILITY_HAR" -type f 2>/dev/null | head -1)
        if [ -n "$NEWER" ]; then
            ABILITY_CHANGED=true
        fi
    fi

    if [ "$ABILITY_CHANGED" = true ]; then
        echo ">>> Step 0: Rebuilding openharmony-ability HAR..."
        pushd "$ABILITY_ROOT" > /dev/null
        ohrs build --arch arm64 --skip-napi-check 2>&1 | tail -5 || true
        # pack.bat syncs native_ability ETS → package/ and tars ability.har.
        # Run via PowerShell: Git Bash can't invoke .bat directly (cmd escape hell).
        ABILITY_WIN=$(cygpath -w "$ABILITY_ROOT" 2>/dev/null || echo "$ABILITY_ROOT")
        powershell.exe -NoProfile -Command "Set-Location -LiteralPath '$ABILITY_WIN'; & '.\pack.bat'" 2>&1 | tail -3
        popd > /dev/null
        echo "    HAR rebuilt. ohpm sync deferred to cargo tauri ohos run (Step 3)."
    else
        echo ">>> Step 0: openharmony-ability HAR is up-to-date, skipping."
    fi
fi

# Step 1: Prerequisites (pnpm install / build:api / 插件 dist-js / ACL)
echo ""
echo ">>> Step 1: Prerequisites..."
ohos_prerequisites

# Step 2: cargo tauri ohos build (纯编译，不需设备)
#   - 前端构建由 beforeBuildCommand 触发，继承 VITE_AUTOTEST=true
#   - examples/api 专属：--features prod (tauri/custom-protocol) 让 app 加载打包前端而非连 dev server
#   - TAURI_OHOS_SKIP_DEVECO_SCRIPT=1 由 cargo tauri ohos CLI 自动设置，禁用 tauriPlugin TCP 回调
echo ""
echo ">>> Step 2: cargo tauri ohos build (device_type=${OHOS_DEVICE_TYPE:-desktop})..."
export VITE_AUTOTEST=true
export OHOS_DEVICE_TYPE="${OHOS_DEVICE_TYPE:-desktop}"
export TAURI_BUILD_FEATURES="prod"
SRC_TAURI="$PROJECT_ROOT/examples/api/src-tauri"
BUILD_ARGS=(ohos build --device-type "${OHOS_DEVICE_TYPE:-desktop}" --features prod)
(cd "$SRC_TAURI" && cargo tauri "${BUILD_ARGS[@]}")

# 验证 build 产物（signed HAP 必须存在，否则后续 install 无意义）
if [ ! -f "$SIGNED_HAP" ]; then
    echo "ERROR: Build failed — signed HAP not found at:"
    echo "  $SIGNED_HAP"
    echo "若签名未配置，在 build-profile.json5 中配置 signingConfigs 或设置 OHOS_KEYSTORE_FILE 等 env。"
    exit 1
fi
echo "    HAP: $SIGNED_HAP"

# Step 3: hdc install (卸旧 → 装新，带 false-success 检测)
#   hdc install 失败时可能仍返回 0（如签名不匹配、空间不足），必须解析 stdout 的
#   "msg" 字段判断真实结果。device SN 缺省时 hdc 自动选单设备。
#   多设备时用 -t <SN> 指定；单设备省略 -t。
echo ""
echo ">>> Step 3: hdc install..."
if [ -n "$DEVICE_SN" ]; then
    HDC_T=(hdc -t "$DEVICE_SN")
else
    HDC_T=(hdc)
fi

echo "    Uninstalling old bundle ($BUNDLE_NAME)..."
"${HDC_T[@]}" shell bm uninstall -n "$BUNDLE_NAME" 2>&1 | tr -d '\r' || true

echo "    Installing HAP..."
INSTALL_OUT=$("${HDC_T[@]}" install "$SIGNED_HAP_WIN" 2>&1 | tr -d '\r')
echo "$INSTALL_OUT"
# false-success 检测：hdc install 返回 0 但实际失败（msg 含 error/failed/false）
if echo "$INSTALL_OUT" | grep -qiE 'error|failed|false|install.*fail|not enough|signature'; then
    echo "ERROR: hdc install failed (false-success: exit 0 but msg indicates failure)."
    echo "常见原因: 签名不匹配 / 空间不足 / bundleName 冲突 / 权限降级。"
    exit 1
fi
# 成功标志：含 "msg" 且无 error，或显式 "successfully"
if ! echo "$INSTALL_OUT" | grep -qiE 'success|msg.:.*operation|install.*finish'; then
    echo "WARNING: install stdout 未见明确成功标志，可能仍 OK，继续后续步骤。"
fi

# Step 4: aa start (启动 EntryAbility)
echo ""
echo ">>> Step 4: aa start (launch EntryAbility)..."
# 启动前清掉设备旧报告——防陈旧 footer 让 Step 5 轮询误判"套件已跑完"
"${HDC_T[@]}" shell "rm -f $REPORT_DEVICE_PATH" 2>&1 | tr -d '\r' || true
START_OUT=$("${HDC_T[@]}" shell aa start -b "$BUNDLE_NAME" -a EntryAbility 2>&1 | tr -d '\r')
echo "$START_OUT"
if echo "$START_OUT" | grep -qiE 'error|fail|not.*found'; then
    echo "ERROR: aa start failed."
    exit 1
fi

# Step 5: Poll for test completion (轮询报告 footer，取代固定 sleep)
#   footer "*Report generated at end of test run.*" 由 TestRunner 在 runAll
#   末尾写入——出现即套件真正跑完；轮询避免固定等待截断尾部用例。
echo ""
echo ">>> Step 5: Polling for test completion (up to ${WAIT_SECONDS}s, every 5s)..."
REPORT_DONE=false
for ((i=5; i<=WAIT_SECONDS; i+=5)); do
    sleep 5
    FOOTER=$("${HDC_T[@]}" shell "tail -3 $REPORT_DEVICE_PATH" 2>/dev/null | tr -d '\r' || true)
    if echo "$FOOTER" | grep -q "Report generated at end of test run"; then
        echo "    Suite finished (footer detected after ${i}s)."
        REPORT_DONE=true
        break
    fi
done
if [ "$REPORT_DONE" != true ]; then
    echo "    WARNING: footer not seen within ${WAIT_SECONDS}s — suite may still be running or app failed to start. Pulling whatever exists..."
fi

# Step 6: Pull report (MSYS_NO_PATHCONV=1 prevents Git Bash mangling device paths
# like /data/app/.../com.tauri.api/... into Windows paths)
echo ""
echo ">>> Step 6: Pulling test report..."
rm -f "$REPORT_LOCAL"
if [ -n "$DEVICE_SN" ]; then
    MSYS_NO_PATHCONV=1 cmd.exe /c "hdc -t $DEVICE_SN file recv $REPORT_DEVICE_PATH $REPORT_LOCAL_WIN" 2>&1 | tr -d '\r'
else
    MSYS_NO_PATHCONV=1 cmd.exe /c "hdc file recv $REPORT_DEVICE_PATH $REPORT_LOCAL_WIN" 2>&1 | tr -d '\r'
fi

if [ ! -f "$REPORT_LOCAL" ]; then
    echo "ERROR: Failed to pull test report from device."
    echo "Expected at: $REPORT_DEVICE_PATH"
    echo ""
    echo "Try increasing WAIT_SECONDS (current: $WAIT_SECONDS)"
    echo "Or check if the app started correctly on device."
    exit 1
fi

# Step 7: Analyze report
echo ""
echo "=== Test Report ==="
echo ""
cat "$REPORT_LOCAL"
echo ""

# Count pass/fail from markdown table (uses emoji markers)
PASS_COUNT=$(grep -c '✅' "$REPORT_LOCAL" || true)
FAIL_COUNT=$(grep -c '❌' "$REPORT_LOCAL" || true)
: "${PASS_COUNT:=0}"
: "${FAIL_COUNT:=0}"

echo "=================================================="
echo "Summary: $PASS_COUNT passed, $FAIL_COUNT failed"

if [ "$FAIL_COUNT" -gt 0 ]; then
    echo ""
    echo "FAILED tests:"
    grep '❌' "$REPORT_LOCAL" | sed 's/|/  /g'
    exit 1
elif [ "$REPORT_DONE" != true ]; then
    # A partial report (footer never appeared) usually means the app was killed
    # mid-suite or the suite hung — treat it as a failure to avoid mistaking a
    # truncated report for all-green (e.g. the 2026-08-27 53/290 false positive).
    echo ""
    echo "ERROR: report incomplete (footer never appeared) — suite was killed or hung."
    echo "Pulled rows: $PASS_COUNT. Treat as FAILURE; check hilog for app death/restart."
    exit 1
else
    echo "ALL TESTS PASSED!"
fi
