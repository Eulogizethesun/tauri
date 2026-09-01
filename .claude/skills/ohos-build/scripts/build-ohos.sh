#!/bin/bash
# Tauri OpenHarmony Build Script
# 前置准备 (prerequisites.sh) + cargo tauri ohos build
#
# cargo tauri ohos build 已实现：模板检测/init、Rust 编译、.so 拷贝、
# hvigorw assembleHap、tauriPlugin 禁用(TAURI_OHOS_SKIP_DEVECO_SCRIPT)、
# 签名(sign_if_configured)、前端构建(beforeBuildCommand, 继承 VITE_AUTOTEST 等)。
# 本脚本只补 CLI 不覆盖的 monorepo 前置 (prerequisites.sh)。
#
# 产出：entry_{form}/build/default/outputs/default/entry_{form}-default-signed.hap

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env.sh"
source "$SCRIPT_DIR/prerequisites.sh"

SRC_TAURI="$PROJECT_ROOT/examples/api/src-tauri"

echo "=== Tauri OpenHarmony Build (prerequisites + cargo tauri ohos build) ==="
echo "DEVECO_HOME=$DEVECO_HOME"
echo "PROJECT_ROOT=$PROJECT_ROOT"
echo "OHOS_DEVICE_TYPE=$OHOS_DEVICE_TYPE"
echo ""

# ─── 前置：pnpm install / build:api / 插件 dist-js / ACL ───
ohos_prerequisites

# ─── cargo tauri ohos build（前端构建由 beforeBuildCommand 触发，继承 VITE_AUTOTEST）───
# 项目专属的 cargo feature（如 examples/api 的 `prod`）由调用方通过
# TAURI_BUILD_FEATURES 环境变量传入，空格分隔。skill 不写死任何项目专属 feature。
echo ""
echo ">>> cargo tauri ohos build (device_type=${OHOS_DEVICE_TYPE:-desktop}, features=${TAURI_BUILD_FEATURES:-none}, VITE_AUTOTEST=${VITE_AUTOTEST:-false})..."
BUILD_ARGS=(ohos build --device-type "${OHOS_DEVICE_TYPE:-desktop}")
if [ -n "$TAURI_BUILD_FEATURES" ]; then
    BUILD_ARGS+=(--features "$TAURI_BUILD_FEATURES")
fi
(cd "$SRC_TAURI" && cargo tauri "${BUILD_ARGS[@]}")

# ─── 验证产物 ───
OHOS_PROJECT="$SRC_TAURI/gen/ohos"
ENTRY_DIR="entry_${OHOS_DEVICE_TYPE:-desktop}"
SIGNED_HAP="$OHOS_PROJECT/$ENTRY_DIR/build/default/outputs/default/$ENTRY_DIR-default-signed.hap"
if [ ! -f "$SIGNED_HAP" ]; then
    echo "ERROR: Build failed - signed HAP not found at:"
    echo "  $SIGNED_HAP"
    echo "If signing is not configured in build-profile.json5, set OHOS signing env vars"
    echo "(OHOS_KEYSTORE_FILE, etc.) or configure signingConfigs in DevEco."
    exit 1
fi

echo ""
echo "=== Build Complete ==="
echo "HAP: $SIGNED_HAP"
